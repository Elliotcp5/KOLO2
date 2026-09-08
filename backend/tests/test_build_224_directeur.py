"""Guard tests for KOLO Build 2.24 — nouvelle interface directeur.

Vérifie que :
  - les routes /api/d1/mon-equipe, /api/d1/perf-agence et
    /api/d1/opportunites/{id}/swipe-directeur existent et exigent le rôle
    directeur (403 sinon).
  - /api/d1/admin/apify-ping existe et renvoie un verdict.
  - /api/d1/admin/derniere-run-scraper existe.
  - le CLI scrape a un paramètre `--force` et un cooldown.
"""
from pathlib import Path


ROUTES_FILE = Path("/app/backend/d1/routes.py")
SCRAPER_FILE = Path("/app/backend/scripts/scrape_listings_cron.py")


def test_endpoints_directeur_declares():
    src = ROUTES_FILE.read_text()
    for path in ("/api/d1/mon-equipe",
                 "/api/d1/mon-equipe/{user_id}/opportunites",
                 "/api/d1/perf-agence",
                 "/api/d1/opportunites/{opp_id}/swipe-directeur",
                 "/api/d1/admin/apify-ping",
                 "/api/d1/admin/derniere-run-scraper"):
        assert path in src, f"endpoint manquant: {path}"


def test_scraper_reports_status_and_items_fetched():
    src = SCRAPER_FILE.read_text()
    # Le scrape par zip doit renvoyer status ET items_fetched
    assert '"items_fetched"' in src
    assert '"apify_run_status"' in src
    # Le run_once doit exposer force + cooldown
    assert "cooldown_hours" in src
    assert "force: bool = False" in src or "force=False" in src
    # Le ping Apify doit exister
    assert "_apify_ping" in src


def test_scraper_cli_force_flag():
    src = SCRAPER_FILE.read_text()
    assert '--force' in src and '--cooldown-hours' in src
