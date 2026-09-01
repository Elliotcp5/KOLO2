"""KOLO A3 — Backfill du champ `district` (et `district_source` si dispo).

Cible les listings actifs d'un code postal donné dont `district` est vide,
applique `a3.district_resolver.resolve_district` et met à jour Supabase.

Utilisation :
    python -m scripts.backfill_district --cp 75017
    python -m scripts.backfill_district --cp 75017 --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv

# Permet d'exécuter depuis /app/backend
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from a3.district_resolver import resolve_district  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("backfill_district")


SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_KEY = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()


def _sb_headers(prefer: Optional[str] = None) -> dict:
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


async def _fetch_listings_without_district(
    client: httpx.AsyncClient, cp: str,
) -> list[dict]:
    """Récupère tous les listings actifs du CP dont `district` est NULL ou
    chaîne vide. Pagine strictement (1000/page)."""
    out: list[dict] = []
    page_size = 1000
    for page_idx in range(20):
        params = {
            "select": "id,portal,url,title,description,latitude,longitude,district",
            "postal_code": f"eq.{cp}",
            "is_active": "eq.true",
            "est_logement": "eq.true",
            "or": "(district.is.null,district.eq.)",
            "order": "id.asc",
            "limit": str(page_size),
            "offset": str(page_idx * page_size),
        }
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/listings",
            params=params, headers=_sb_headers(), timeout=30,
        )
        if r.status_code != 200:
            raise RuntimeError(f"fetch failed: {r.status_code} {r.text[:200]}")
        rows = r.json() or []
        out.extend(rows)
        if len(rows) < page_size:
            break
    return out


async def _update_listing(
    client: httpx.AsyncClient, listing_id: int,
    district: str, source: str, with_source_column: bool,
) -> tuple[bool, bool]:
    """Met à jour un listing. Retourne (ok, source_column_available).

    Si `district_source` n'existe pas encore côté Supabase, la fonction bascule
    silencieusement en mode sans (retour `source_column_available=False`).
    """
    body = {"district": district}
    if with_source_column:
        body["district_source"] = source
    r = await client.patch(
        f"{SUPABASE_URL}/rest/v1/listings",
        params={"id": f"eq.{listing_id}"},
        json=body,
        headers=_sb_headers("return=minimal"),
        timeout=15,
    )
    if r.status_code in (200, 204):
        return True, with_source_column
    txt = r.text or ""
    # Colonne inexistante côté Supabase → retry sans le champ, et signale au caller
    if with_source_column and ("district_source" in txt and "PGRST" in txt or "column" in txt.lower()):
        r2 = await client.patch(
            f"{SUPABASE_URL}/rest/v1/listings",
            params={"id": f"eq.{listing_id}"},
            json={"district": district},
            headers=_sb_headers("return=minimal"),
            timeout=15,
        )
        if r2.status_code in (200, 204):
            return True, False
        logger.warning(f"update {listing_id} fallback fail: {r2.status_code} {r2.text[:200]}")
        return False, False
    logger.warning(f"update {listing_id} fail: {r.status_code} {r.text[:200]}")
    return False, with_source_column


async def run(cp: str, dry_run: bool = False) -> dict:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SECRET_KEY missing")

    stats: dict = {
        "cp": cp,
        "candidates": 0,
        "resolved": 0,
        "unresolved": 0,
        "by_source": Counter(),
        "by_source_portal": {},   # {portal: {source: n}}
        "unresolved_by_portal": Counter(),
        "dry_run": dry_run,
        "district_source_column_available": True,
    }

    async with httpx.AsyncClient() as client:
        listings = await _fetch_listings_without_district(client, cp)
        stats["candidates"] = len(listings)
        logger.info(f"cp={cp} listings sans district = {len(listings)}")

        with_source_col = True
        for L in listings:
            district, source = resolve_district(
                portal=L.get("portal"),
                url=L.get("url"),
                title=L.get("title"),
                description=L.get("description"),
                latitude=L.get("latitude"),
                longitude=L.get("longitude"),
            )
            portal = (L.get("portal") or "unknown").lower()
            if not district:
                stats["unresolved"] += 1
                stats["unresolved_by_portal"][portal] += 1
                continue
            stats["resolved"] += 1
            stats["by_source"][source] += 1
            stats["by_source_portal"].setdefault(portal, Counter())[source] += 1

            if not dry_run:
                ok, still = await _update_listing(
                    client, L["id"], district, source or "unknown", with_source_col,
                )
                if not ok:
                    stats["unresolved"] += 1  # écriture échouée
                    stats["resolved"] -= 1
                    stats["by_source"][source] -= 1
                if not still:
                    with_source_col = False
                    stats["district_source_column_available"] = False

    # Normalise counters
    stats["by_source"] = dict(stats["by_source"])
    stats["by_source_portal"] = {k: dict(v) for k, v in stats["by_source_portal"].items()}
    stats["unresolved_by_portal"] = dict(stats["unresolved_by_portal"])
    return stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cp", required=True, help="Code postal ciblé (ex: 75017)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Ne pas écrire dans Supabase, juste log les résolutions")
    args = ap.parse_args()
    stats = asyncio.run(run(args.cp, dry_run=args.dry_run))
    import json
    print(json.dumps(stats, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
