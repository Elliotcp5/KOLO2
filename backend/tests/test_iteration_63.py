"""
Iteration 63 — DVF (Demandes de Valeurs Foncières) import script verification.

Module under test: /app/backend/scripts/import_dvf_mutations.py
Verifies:
  - script CLI surface (--help, BATCH_SIZE=1000, env validation)
  - Supabase `mutations` table row counts per (year, dept)
  - filter compliance (type_local, valeur_fonciere, surface_reelle_bati)
  - prix_m2 auto-computed by DB (not inserted by script)
  - adresse concatenation formatting
"""
import os
import re
import subprocess
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

BACKEND_DIR = Path("/app/backend")
SCRIPT = BACKEND_DIR / "scripts" / "import_dvf_mutations.py"
LOG = BACKEND_DIR / "logs" / "dvf_import.log"

_env = dotenv_values(BACKEND_DIR / ".env")
SUPABASE_URL = (_env.get("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_KEY = (_env.get("SUPABASE_SECRET_KEY") or "").strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL / SUPABASE_SECRET_KEY missing in /app/backend/.env")

REST = f"{SUPABASE_URL}/rest/v1/mutations"
DEPTS = ["75", "92", "13", "69", "06"]
EXPECTED = {
    (2023, "06"): 30636, (2023, "13"): 31993, (2023, "69"): 26706,
    (2023, "75"): 34305, (2023, "92"): 20258,
    (2024, "06"): 26033, (2024, "13"): 30323, (2024, "69"): 24056,
    (2024, "75"): 32338, (2024, "92"): 19572,
    (2025, "06"): 30127, (2025, "13"): 32743, (2025, "69"): 27743,
    (2025, "75"): 36683, (2025, "92"): 22101,
}
EXPECTED_TOTAL = sum(EXPECTED.values())


def _headers(extra=None):
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def sb_count(params) -> int:
    """Exact count via Content-Range without downloading rows."""
    r = requests.get(
        REST,
        params=list(params) + [("select", "id"), ("limit", "1")],
        headers=_headers({"Prefer": "count=exact", "Range": "0-0"}),
        timeout=120,
    )
    assert r.status_code in (200, 206), f"HTTP {r.status_code}: {r.text[:300]}"
    cr = r.headers.get("content-range", "")
    m = re.search(r"/(\d+|\*)$", cr)
    assert m and m.group(1) != "*", f"No exact count in Content-Range: {cr!r}"
    return int(m.group(1))


def sb_get(params, limit=5):
    r = requests.get(
        REST,
        params=list(params) + [("limit", str(limit))],
        headers=_headers(),
        timeout=120,
    )
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
    return r.json()


# --- Script surface -------------------------------------------------------
class TestScriptSurface:
    def test_script_exists_and_help_works(self):
        assert SCRIPT.exists()
        p = subprocess.run(["python3", str(SCRIPT), "--help"], capture_output=True, text=True, timeout=120)
        assert p.returncode == 0, p.stderr
        for flag in ("--years", "--depts", "--dry-run"):
            assert flag in p.stdout

    def test_batch_size_is_1000(self):
        src = SCRIPT.read_text()
        assert "BATCH_SIZE = 1000" in src

    def test_does_not_insert_prix_m2(self):
        src = SCRIPT.read_text()
        # prix_m2 must not appear as an inserted key in map_to_rows
        assert '"prix_m2"' not in src.split("def map_to_rows")[1].split("def ")[0]

    def test_uses_service_role_key_not_anon(self):
        src = SCRIPT.read_text()
        assert "SUPABASE_SECRET_KEY" in src
        assert "SUPABASE_PUBLISHABLE_KEY" not in src
        assert "SUPABASE_ANON_KEY" not in src

    def test_missing_secret_key_raises_clear_error(self):
        env = dict(os.environ)
        env["SUPABASE_SECRET_KEY"] = ""
        env["SUPABASE_URL"] = SUPABASE_URL or "https://x.supabase.co"
        # Point dotenv at an empty dir so the real .env is not reloaded
        code = (
            "import sys, os;"
            "sys.argv=['x','--years','2023','--depts','75'];"
            "import importlib.util;"
            f"spec=importlib.util.spec_from_file_location('m', r'{SCRIPT}');"
            "m=importlib.util.module_from_spec(spec);"
            "spec.loader.exec_module(m);"
            "m.SUPABASE_KEY='';\n"
            "try:\n"
            "    m._validate_env()\n"
            "except SystemExit as e:\n"
            "    print('SYSTEMEXIT:', e); sys.exit(0)\n"
            "print('NO_ERROR'); sys.exit(1)\n"
        )
        p = subprocess.run(["python3", "-c", code], capture_output=True, text=True, env=env, timeout=180)
        assert p.returncode == 0 and "SYSTEMEXIT" in p.stdout, f"out={p.stdout[-500:]} err={p.stderr[-500:]}"
        assert "SUPABASE_SECRET_KEY" in p.stdout


# --- Data verification ----------------------------------------------------
class TestMutationsData:
    @pytest.mark.parametrize("year,dept", sorted(EXPECTED.keys()))
    def test_count_per_year_dept(self, year, dept):
        n = sb_count([
            ("code_departement", f"eq.{dept}"),
            ("date_mutation", f"gte.{year}-01-01"),
            ("date_mutation", f"lt.{year + 1}-01-01"),
        ])
        assert n == EXPECTED[(year, dept)], f"{year}/{dept}: got {n}, expected {EXPECTED[(year, dept)]}"

    def test_total_rows_in_scope(self):
        total = sb_count([
            ("code_departement", f"in.({','.join(DEPTS)})"),
            ("date_mutation", "gte.2023-01-01"),
            ("date_mutation", "lt.2026-01-01"),
        ])
        assert total == EXPECTED_TOTAL, f"got {total}, expected {EXPECTED_TOTAL}"

    def test_no_invalid_type_local(self):
        n = sb_count([("type_local", "not.in.(Appartement,Maison)")])
        assert n == 0, f"{n} rows with invalid type_local"

    def test_no_null_type_local(self):
        assert sb_count([("type_local", "is.null")]) == 0

    def test_valeur_fonciere_positive_and_not_null(self):
        assert sb_count([("valeur_fonciere", "is.null")]) == 0
        assert sb_count([("valeur_fonciere", "lte.0")]) == 0

    def test_surface_reelle_bati_gt_9(self):
        assert sb_count([("surface_reelle_bati", "is.null")]) == 0
        assert sb_count([("surface_reelle_bati", "lte.9")]) == 0

    def test_prix_m2_auto_computed(self):
        rows = sb_get([
            ("select", "valeur_fonciere,surface_reelle_bati,prix_m2"),
            ("prix_m2", "not.is.null"),
        ], limit=10)
        assert rows, "no rows with prix_m2 — generated column may not be populated"
        for r in rows:
            expected = r["valeur_fonciere"] / r["surface_reelle_bati"]
            assert abs(r["prix_m2"] - expected) <= 1.5, f"prix_m2 mismatch: {r}"

    def test_prix_m2_never_null(self):
        assert sb_count([("prix_m2", "is.null")]) == 0

    def test_adresse_format(self):
        rows = sb_get([("select", "adresse"), ("adresse", "not.is.null")], limit=20)
        assert rows
        for r in rows:
            a = r["adresse"]
            assert a == a.strip(), f"untrimmed adresse: {a!r}"
            assert "  " not in a, f"double space in adresse: {a!r}"
            assert a.lower() not in ("none", "nan")
            assert "nan" not in a.lower().split(), f"'nan' token in adresse: {a!r}"

    def test_no_bad_adresse_tokens(self):
        for bad in ("None", "nan", "NaN"):
            assert sb_count([("adresse", f"eq.{bad}")]) == 0, f"rows with adresse == {bad}"

    def test_required_columns_present(self):
        rows = sb_get([("select", "*")], limit=1)
        assert rows
        cols = set(rows[0].keys())
        for c in ["id_mutation", "date_mutation", "valeur_fonciere", "code_postal",
                  "nom_commune", "code_departement", "id_parcelle", "type_local",
                  "surface_reelle_bati", "nombre_pieces_principales", "surface_terrain",
                  "longitude", "latitude", "adresse", "prix_m2"]:
            assert c in cols, f"missing column {c}"

    def test_no_out_of_scope_departments(self):
        n = sb_count([("code_departement", f"not.in.({','.join(DEPTS)})")])
        assert n == 0, f"{n} rows outside the 5 target departments"


# --- Log evidence ---------------------------------------------------------
class TestImportLog:
    def test_log_exists_with_total(self):
        assert LOG.exists()
        content = LOG.read_text()
        assert "425,617" in content
        assert "Import finished" in content
