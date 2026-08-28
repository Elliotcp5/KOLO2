"""
KOLO — One-shot DVF (Demandes de Valeurs Foncières) import into Supabase
=========================================================================

Loads the geo-DVF CSVs published by data.gouv.fr into the shared Supabase
`mutations` table used by the estimation module of the iOS app.

Source
------
https://files.data.gouv.fr/geo-dvf/latest/csv/{YEAR}/departements/{DEPT}.csv.gz
(one gzip-compressed CSV per department per year)

Years: 2023, 2024, 2025
Departments: 75 (Paris), 92 (Hauts-de-Seine), 13 (Bouches-du-Rhône),
             69 (Rhône), 06 (Alpes-Maritimes)

Filters
-------
- nature_mutation == "Vente"
- type_local ∈ {"Appartement", "Maison"}
- valeur_fonciere is not null / not empty
- surface_reelle_bati > 9

Insert mapping
--------------
DVF field                   →  mutations column
------------------------------------------------
id_mutation                    id_mutation
date_mutation                  date_mutation
valeur_fonciere                valeur_fonciere
code_postal                    code_postal
nom_commune                    nom_commune
code_departement               code_departement
id_parcelle                    id_parcelle
type_local                     type_local
surface_reelle_bati            surface_reelle_bati
nombre_pieces_principales      nombre_pieces_principales
surface_terrain                surface_terrain
longitude                      longitude
latitude                       latitude
adresse_numero + suffixe +     adresse (concatenated, single-spaced,
adresse_nom_voie                        trimmed)

`prix_m2` is NOT populated — the DB computes it via a generated column /
trigger.

Idempotency
-----------
For each year processed, we DELETE existing rows matching:
  code_departement IN (75, 92, 13, 69, 06)
  AND date_mutation >= '<year>-01-01'
  AND date_mutation <  '<year+1>-01-01'
BEFORE inserting the fresh data. Safe to re-run.

Auth: SUPABASE_SECRET_KEY (service role) — NOT the anon key.
"""
from __future__ import annotations

import argparse
import gzip
import io
import logging
import os
import sys
import time
from pathlib import Path
from typing import Iterable

import pandas as pd
import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - dvf-import - %(levelname)s - %(message)s",
)
logger = logging.getLogger("dvf-import")

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_KEY = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()

YEARS = [2023, 2024, 2025]
DEPARTMENTS = ["75", "92", "13", "69", "06"]
DVF_URL_TMPL = "https://files.data.gouv.fr/geo-dvf/latest/csv/{year}/departements/{dept}.csv.gz"

BATCH_SIZE = 1000
DOWNLOAD_TIMEOUT = 300  # 5 min per file — some departments are >100 MB
SUPABASE_TIMEOUT = 60

# Column subset we actually parse from the CSV (huge speed / memory win).
_CSV_USE_COLS = [
    "id_mutation", "date_mutation", "nature_mutation",
    "valeur_fonciere", "code_postal", "nom_commune",
    "code_departement", "id_parcelle", "type_local",
    "surface_reelle_bati", "nombre_pieces_principales",
    "surface_terrain", "longitude", "latitude",
    "adresse_numero", "adresse_suffixe", "adresse_nom_voie",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _sb_headers(prefer: str = "") -> dict:
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


def _validate_env() -> None:
    if not SUPABASE_URL:
        raise SystemExit("SUPABASE_URL missing in backend/.env")
    if not SUPABASE_KEY:
        raise SystemExit("SUPABASE_SECRET_KEY (service role) missing in backend/.env")
    if SUPABASE_KEY.startswith("sb_publishable_") or SUPABASE_KEY.startswith("eyJ") and "anon" in SUPABASE_KEY.lower():
        # Best-effort sanity check — anon keys usually decode with role='anon'.
        # We keep it a warning, since Supabase may rename in future.
        logger.warning("SUPABASE_SECRET_KEY looks like an anon/publishable key — RLS will block writes.")


def _clean_adresse(row: pd.Series) -> str | None:
    parts = []
    for k in ("adresse_numero", "adresse_suffixe", "adresse_nom_voie"):
        v = row.get(k)
        if v is None or (isinstance(v, float) and pd.isna(v)):
            continue
        s = str(v).strip()
        if s and s.lower() != "nan":
            parts.append(s)
    joined = " ".join(parts).strip()
    return joined or None


def _to_iso_date(v) -> str | None:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return None
    # DVF format is already ISO (YYYY-MM-DD) — validate cheaply.
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    return s


def _nullable_number(v):
    """Return an int/float suitable for JSON. None on NaN / '' / non-numeric."""
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    try:
        f = float(v)
        if pd.isna(f):
            return None
        # Keep integer-valued fields as int for a smaller wire payload.
        if f.is_integer():
            return int(f)
        return f
    except (TypeError, ValueError):
        return None


def _nullable_str(v) -> str | None:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    return s or None


def _chunks(seq: list, n: int) -> Iterable[list]:
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


# ---------------------------------------------------------------------------
# Download + parse
# ---------------------------------------------------------------------------
def download_and_read(year: int, dept: str) -> pd.DataFrame:
    """Download the .csv.gz, decompress in memory, parse only the columns we
    need. Returns a filtered DataFrame ready to be mapped and inserted.
    """
    url = DVF_URL_TMPL.format(year=year, dept=dept)
    logger.info(f"[{year}/{dept}] Downloading {url}")
    r = requests.get(url, timeout=DOWNLOAD_TIMEOUT, stream=True)
    r.raise_for_status()
    raw = r.content
    logger.info(f"[{year}/{dept}] Downloaded {len(raw) / 1024 / 1024:.1f} MB")

    with gzip.GzipFile(fileobj=io.BytesIO(raw)) as gz:
        df = pd.read_csv(
            gz,
            usecols=lambda c: c in _CSV_USE_COLS,
            dtype={
                "id_mutation": "string",
                "code_postal": "string",
                "code_departement": "string",
                "nom_commune": "string",
                "id_parcelle": "string",
                "type_local": "string",
                "nature_mutation": "string",
                "adresse_numero": "string",
                "adresse_suffixe": "string",
                "adresse_nom_voie": "string",
                "date_mutation": "string",
                # numeric ones kept as string then coerced (handles ",5")
                "valeur_fonciere": "string",
                "surface_reelle_bati": "string",
                "surface_terrain": "string",
                "longitude": "string",
                "latitude": "string",
                "nombre_pieces_principales": "string",
            },
            low_memory=False,
        )

    total = len(df)

    # Filter — nature_mutation must be exactly "Vente"
    df = df[df["nature_mutation"] == "Vente"]
    # type_local must be Appartement OR Maison
    df = df[df["type_local"].isin(["Appartement", "Maison"])]
    # valeur_fonciere non-empty
    df = df[df["valeur_fonciere"].notna() & (df["valeur_fonciere"].str.strip() != "")]
    # surface_reelle_bati > 9 (need numeric conversion)
    surface_num = pd.to_numeric(df["surface_reelle_bati"].str.replace(",", ".", regex=False), errors="coerce")
    df = df[surface_num > 9]

    logger.info(f"[{year}/{dept}] {total} raw rows → {len(df)} kept after filters")
    return df


# ---------------------------------------------------------------------------
# Mapping to Supabase rows
# ---------------------------------------------------------------------------
def map_to_rows(df: pd.DataFrame) -> list[dict]:
    """Map DataFrame → list of dicts matching `mutations` schema."""
    out: list[dict] = []
    for _, row in df.iterrows():
        vf = _nullable_number(str(row.get("valeur_fonciere") or "").replace(",", "."))
        if vf is None:
            continue
        srb = _nullable_number(str(row.get("surface_reelle_bati") or "").replace(",", "."))
        if srb is None or srb <= 9:
            continue

        out.append({
            "id_mutation": _nullable_str(row.get("id_mutation")),
            "date_mutation": _to_iso_date(row.get("date_mutation")),
            "valeur_fonciere": vf,
            "code_postal": _nullable_str(row.get("code_postal")),
            "nom_commune": _nullable_str(row.get("nom_commune")),
            "code_departement": _nullable_str(row.get("code_departement")),
            "id_parcelle": _nullable_str(row.get("id_parcelle")),
            "type_local": _nullable_str(row.get("type_local")),
            "surface_reelle_bati": srb,
            "nombre_pieces_principales": _nullable_number(
                str(row.get("nombre_pieces_principales") or "").replace(",", ".")
            ),
            "surface_terrain": _nullable_number(
                str(row.get("surface_terrain") or "").replace(",", ".")
            ),
            "longitude": _nullable_number(str(row.get("longitude") or "").replace(",", ".")),
            "latitude": _nullable_number(str(row.get("latitude") or "").replace(",", ".")),
            "adresse": _clean_adresse(row),
        })
    return out


# ---------------------------------------------------------------------------
# Supabase I/O
# ---------------------------------------------------------------------------
def delete_year_scope(year: int, departments: list[str]) -> int:
    """Delete every mutations row for the given departments where
    date_mutation is inside `year`. We split the DELETE by department
    because Supabase's statement_timeout can't finish a single scan over
    hundreds of thousands of rows when there is no composite index yet.
    Returns the total number of deleted rows.
    """
    start = f"{year}-01-01"
    end = f"{year + 1}-01-01"
    deleted_total = 0
    for dept in departments:
        logger.info(f"[{year}/{dept}] Deleting existing rows …")
        # Repeated `date_mutation` filters are AND-ed by PostgREST when sent
        # as list-of-tuples (dicts would overwrite the 2nd value).
        params = [
            ("code_departement", f"eq.{dept}"),
            ("date_mutation", f"gte.{start}"),
            ("date_mutation", f"lt.{end}"),
        ]
        r = requests.delete(
            f"{SUPABASE_URL}/rest/v1/mutations",
            params=params,
            headers=_sb_headers(prefer="return=representation"),
            timeout=SUPABASE_TIMEOUT,
        )
        if r.status_code not in (200, 204):
            raise RuntimeError(
                f"Supabase delete failed for {year}/{dept} — HTTP {r.status_code}: {r.text[:400]}"
            )
        try:
            n = len(r.json() or [])
        except ValueError:
            n = 0
        deleted_total += n
        logger.info(f"[{year}/{dept}] Deleted {n} pre-existing rows")
    return deleted_total


def insert_rows(rows: list[dict]) -> int:
    """Batched insert (POST, no upsert — the year scope was cleared first)."""
    if not rows:
        return 0
    inserted = 0
    for chunk in _chunks(rows, BATCH_SIZE):
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/mutations",
            headers=_sb_headers(prefer="return=minimal"),
            json=chunk,
            timeout=SUPABASE_TIMEOUT,
        )
        if r.status_code in (200, 201, 204):
            inserted += len(chunk)
        else:
            raise RuntimeError(f"Supabase insert failed HTTP {r.status_code}: {r.text[:400]}")
    return inserted


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run(years: list[int], departments: list[str], dry_run: bool = False) -> dict:
    _validate_env()
    stats: dict[tuple[int, str], int] = {}
    t0 = time.time()

    for year in years:
        # Idempotency: wipe the year scope for our departments first.
        if not dry_run:
            try:
                delete_year_scope(year, departments)
            except Exception as e:
                logger.error(f"[{year}] delete failed → aborting year: {e}")
                for d in departments:
                    stats[(year, d)] = 0
                continue

        for dept in departments:
            try:
                df = download_and_read(year, dept)
                rows = map_to_rows(df)
                if dry_run:
                    logger.info(f"[{year}/{dept}] DRY-RUN — would insert {len(rows)} rows (first: {rows[0] if rows else 'N/A'})")
                    stats[(year, dept)] = len(rows)
                else:
                    inserted = insert_rows(rows)
                    stats[(year, dept)] = inserted
                    logger.info(f"[{year}/{dept}] Inserted {inserted} rows")
            except Exception as e:
                logger.error(f"[{year}/{dept}] FAILED: {e}")
                stats[(year, dept)] = 0

    # Final summary
    elapsed = int(time.time() - t0)
    logger.info("=" * 60)
    logger.info(f"Import finished in {elapsed // 60}m{elapsed % 60}s")
    logger.info("=" * 60)
    grand_total = 0
    print("\nInserted rows per department/year:")
    print(f"{'Year':<8}{'Dept':<8}{'Inserted':>12}")
    print("-" * 28)
    for (y, d) in sorted(stats.keys()):
        n = stats[(y, d)]
        grand_total += n
        print(f"{y:<8}{d:<8}{n:>12,}")
    print("-" * 28)
    print(f"{'TOTAL':<16}{grand_total:>12,}\n")
    return {"stats": {f"{y}/{d}": n for (y, d), n in stats.items()}, "total": grand_total, "elapsed_s": elapsed}


def _cli() -> None:
    ap = argparse.ArgumentParser(description="DVF → Supabase importer")
    ap.add_argument("--years", type=str, default=",".join(map(str, YEARS)),
                    help=f"Comma-separated years, default {YEARS}")
    ap.add_argument("--depts", type=str, default=",".join(DEPARTMENTS),
                    help=f"Comma-separated departments, default {DEPARTMENTS}")
    ap.add_argument("--dry-run", action="store_true", help="Download + map but don't touch Supabase")
    args = ap.parse_args()
    years = [int(y.strip()) for y in args.years.split(",") if y.strip()]
    depts = [d.strip().zfill(2) for d in args.depts.split(",") if d.strip()]
    run(years=years, departments=depts, dry_run=args.dry_run)


if __name__ == "__main__":
    _cli()
