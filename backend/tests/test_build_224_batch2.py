"""Guard tests Build 2.24 batch 2 (A1-A4) : dossier, logo, affectation banner."""
from pathlib import Path


def test_a1_completude_bloque_dpe_et_annee():
    """A1 · le PDF ne peut plus être exporté sans classe_dpe ni annee_construction."""
    src = Path("/app/backend/c2/routes.py").read_text()
    assert "dpe_ok" in src, "completude ne vérifie pas DPE"
    assert "annee_ok" in src, "completude ne vérifie pas annee_construction"
    assert 'all([demandeur_ok, adresse_ok, surface_ok, photo_ok,' in src, "pret_export ne bloque plus"
    assert 'dpe_ok, annee_ok' in src, "pret_export ne bloque pas sur DPE/annee"


def test_a2_logo_upload_endpoint():
    """A2 · POST /api/me/logo et GET /api/me/logo/{id} existent."""
    src = Path("/app/backend/c2/uploads.py").read_text()
    assert '/api/me/logo' in src
    assert 'upload_logo' in src
    assert 'get_logo' in src
    # renderer expose agent_logo_url dans le contexte PDF
    renderer = Path("/app/backend/c2/pdf/renderer.py").read_text()
    assert 'agent_logo_url' in renderer
    # template inclut le tag <img>
    tpl = Path("/app/backend/c2/pdf/template.html.j2").read_text()
    assert 'agent_logo_url' in tpl
    # prefill propage logo_url depuis users
    prefill = Path("/app/backend/c2/prefill.py").read_text()
    assert '"logo_url":' in prefill and 'user.get("logo_url")' in prefill


def test_a4_swipe_desactive_agence_backend():
    """A4 · POST /api/opportunites/{id}/swipe refuse (403) pour un agent
    d'agence non-directeur."""
    src = Path("/app/backend/b1/routes.py").read_text()
    assert 'swipe_desactive_agence' in src
    assert 'affectation_notif_flag' in src, "du-jour ne remonte pas le flag"
    assert '"en_agence"' in src, "du-jour ne remonte pas en_agence"


def test_a3_profil_expose_logo_url():
    """A3 · /api/me/profil retourne logo_url pour le front."""
    src = Path("/app/backend/b1/routes.py").read_text()
    assert '"logo_url": user.get("logo_url")' in src


def test_a4_bandeau_frontend():
    """A4 · le front rend la bannière et désactive le swipe."""
    src = Path("/app/frontend/src/b1/B1Shell.jsx").read_text()
    assert 'b1-opp-affectee-banner' in src
    assert 'affectation_notif_flag' in src
    assert 'en_agence' in src
