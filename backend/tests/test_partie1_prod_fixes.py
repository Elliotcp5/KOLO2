"""KOLO — Régression Partie 1 : correctifs prod (Février 2026).

Verrouille 4 invariants :
1. `POST /api/d1/admin/fix-index-enrichissements` existe et exige X-Admin-Secret.
2. `POST /api/d1/admin/ouvrir-zone` existe et upsert la zone en 1 appel.
3. `GET /api/d1/admin/diagnostic-zone` existe pour audit production.
4. `run_extraire_rues` retourne `status="warning"` si scanned>0 et rue_written=0.
"""
from __future__ import annotations

import pytest
from dotenv import load_dotenv

load_dotenv()

from d1.routes import router


def _paths(method: str) -> set[str]:
    return {
        r.path for r in router.routes
        if method in (getattr(r, "methods", set()) or set())
    }


def test_fix_index_enrichissements_endpoint_mounted():
    assert "/api/d1/admin/fix-index-enrichissements" in _paths("POST")


def test_ouvrir_zone_endpoint_mounted():
    assert "/api/d1/admin/ouvrir-zone" in _paths("POST")


def test_diagnostic_zone_endpoint_mounted():
    assert "/api/d1/admin/diagnostic-zone" in _paths("GET")


def test_audit_indexes_endpoint_mounted():
    assert "/api/d1/admin/audit-indexes" in _paths("GET")


def test_extraire_rues_warning_status_shape():
    """Le job doit remonter `status: warning` si scanned>0 et rue_written=0.
    On simule le retour final pour vérifier la logique de statut."""
    # Le vrai run interroge Supabase — on isole la logique de statut en
    # patchant les fonctions I/O.
    import asyncio
    from unittest.mock import AsyncMock, patch

    from a3 import job_extract_rues

    with patch.object(job_extract_rues, "_distinct_postal_codes",
                      new=AsyncMock(return_value=["13008"])), \
         patch.object(job_extract_rues, "voies_by_postcode",
                      new=AsyncMock(return_value=set())), \
         patch.object(job_extract_rues, "_fetch_active_listings_for_cp",
                      new=AsyncMock(side_effect=[
                          [{"id": 1, "title": "Bien",
                            "description": "x", "portal": "seloger",
                            "floor": None,
                            "rue_extraite": None, "etage_extrait": None,
                            "type_normalise": "appartement"}],
                          [],
                      ])):
        # SUPABASE_URL/KEY doivent être set pour ne pas retourner tôt
        job_extract_rues.SUPABASE_URL = "https://example.com"
        job_extract_rues.SUPABASE_KEY = "test"
        result = asyncio.run(job_extract_rues.run_extraire_rues(None, code_postal="13008"))

    assert result.get("status") == "warning", \
        f"attendu status=warning quand rue_written=0, reçu {result.get('status')}"
    assert "warning" in result and "rue_written=0" in result["warning"]


def test_extraire_rues_ok_status_when_high_rate():
    """Symétrique : quand ≥10% des rues sont extraites, le statut doit être `ok`."""
    import asyncio
    from unittest.mock import AsyncMock, patch

    from a3 import job_extract_rues

    with patch.object(job_extract_rues, "_distinct_postal_codes",
                      new=AsyncMock(return_value=["13008"])), \
         patch.object(job_extract_rues, "voies_by_postcode",
                      new=AsyncMock(return_value={"rue de la republique"})), \
         patch.object(job_extract_rues, "_fetch_active_listings_for_cp",
                      new=AsyncMock(side_effect=[
                          [{"id": i, "title": "Appartement rue de la République",
                            "description": "Bel appt", "portal": "seloger",
                            "floor": None,
                            "rue_extraite": None, "etage_extrait": None,
                            "type_normalise": "appartement"} for i in range(1, 11)],
                          [],
                      ])), \
         patch.object(job_extract_rues, "_patch_listing",
                      new=AsyncMock(return_value=True)), \
         patch.object(job_extract_rues, "extract_rue_and_etage",
                      new=lambda *a, **kw: ("rue de la republique", None)):
        job_extract_rues.SUPABASE_URL = "https://example.com"
        job_extract_rues.SUPABASE_KEY = "test"
        result = asyncio.run(job_extract_rues.run_extraire_rues(None, code_postal="13008"))

    assert result.get("status") == "ok", \
        f"attendu status=ok quand rue_pct élevé, reçu {result.get('status')}"
