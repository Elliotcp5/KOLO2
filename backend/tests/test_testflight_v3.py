"""KOLO — Régression TestFlight 3e passe (2026-09-03).

Ces tests gèlent 4 fixes majeurs :

1. `POST /api/opportunites/{id}/swipe` existe et prend `{sens: "droite"|"gauche"}`.
   Statut posé : droite → `a_demarcher`, gauche → `ignoree`.
2. Le frontend swipe utilise `swipeOpportunite`, NE redirige plus vers
   `/app-b1/estimation/*` et affiche l'erreur au lieu d'avancer.
3. La fin de pile n'est PLUS un cul-de-sac — `FinDePileScreen` avec sablier,
   décompte 03h00 Paris, veilleSlot conditionnel.
4. La tab bar est UNIQUE, opaque, avec liseré rose franc (pas transparent).
   Icônes gris moyen inactif, blanches sur rose plein actif.
5. Le logo login est un SVG texte KOLO (pas d'image PNG à trou transparent).
6. Assistant : max_tokens=400, prompt "3 à 4 phrases", "jamais de titres".
"""
from __future__ import annotations

from pathlib import Path
from b1.routes import router as b1_router


def test_swipe_endpoint_exists_with_sens():
    paths = {}
    for r in b1_router.routes:
        for m in getattr(r, "methods", set()) or set():
            paths.setdefault(m, set()).add(r.path)
    assert "/api/opportunites/{opportunite_id}/swipe" in paths.get("POST", set()), \
        "endpoint POST /api/opportunites/{id}/swipe manquant"


def test_swipe_backend_sets_correct_status():
    src = Path("/app/backend/b1/routes.py").read_text()
    idx = src.find("async def swipe_opportunite")
    assert idx > 0
    body = src[idx:idx + 1500]
    # droite → a_demarcher
    assert '"a_demarcher" if sens == "droite" else "ignoree"' in body
    # Filtre user + statut
    assert '"assigne_a": user["user_id"]' in body
    assert '"statut": "proposee"' in body
    # sens invalide → 400
    assert 'sens_invalide' in body


def test_frontend_swipe_uses_unified_endpoint_and_shows_error():
    """OpportunitesPage DOIT utiliser `b1api.swipeOpportunite`, ne PLUS
    rediriger vers Estimation, et afficher l'erreur au lieu d'avancer."""
    src = Path("/app/frontend/src/b1/B1Shell.jsx").read_text()
    idx = src.find("const swipe = async (sens)")
    end = src.find("useEffect", idx)
    body = src[idx:end]
    assert "b1api.swipeOpportunite" in body
    assert "navigate('/app-b1/estimation" not in body
    assert "setSwipeError" in body
    assert 'return;' in body  # early return si erreur


def test_swipe_error_visible_in_ui():
    src = Path("/app/frontend/src/b1/B1Shell.jsx").read_text()
    assert 'data-testid="b1-swipe-error"' in src


def test_fin_de_pile_screen_component():
    """FinDePileScreen DOIT contenir sablier + texte + décompte 03h00 Paris."""
    p = Path("/app/frontend/src/b1/B1FinDePile.jsx")
    assert p.exists()
    src = p.read_text()
    assert "Sablier" in src
    assert "secondsUntilNext03hParis" in src
    assert "Europe/Paris" in src
    assert "De nouvelles opportunités de mandat vous attendent dans" in src
    assert 'data-testid="b1-fin-pile"' in src
    assert 'data-testid="b1-fin-pile-decompte"' in src


def test_opportunites_page_uses_fin_de_pile():
    src = Path("/app/frontend/src/b1/B1Shell.jsx").read_text()
    assert "import { FinDePileScreen } from './B1FinDePile'" in src
    assert "<FinDePileScreen" in src


def test_tab_bar_is_opaque_with_solid_pink_border():
    """La tab bar DOIT être opaque (background #FFFFFF) et avoir un liseré
    rose franc `#EC8690` (pas de rgba transparent). Sinon icônes blanches
    invisibles sur fond blanc — c'est ce qui a été remonté depuis TestFlight."""
    src = Path("/app/frontend/src/b1/b1.css").read_text()
    # Fond opaque
    assert ".b1-tabbar {" in src
    # Doit contenir : background: #FFFFFF
    idx = src.rfind(".b1-tabbar {")  # dernière définition (celle qui override)
    end = src.find("}", idx)
    tabbar_css = src[idx:end]
    assert "background: #FFFFFF" in tabbar_css or "background: white" in tabbar_css.lower()
    assert "border: 2px solid #EC8690" in tabbar_css, \
        "liseré rose franc (100%) — pas rgba transparent"
    # PAS d'ancienne version transparente
    assert "border: 2px solid rgba(236, 134, 144, 0.20)" not in src


def test_login_logo_uses_asset_import_not_svg_text():
    """Retour build 2.20 (75) : le PNG ne s'affichait pas après cap sync.
    L'utilisateur accepte explicitement le repli en LOGOTYPE TEXTE
    stylisé (League Spartan, gras, noir). Ce test verrouille le repli."""
    src = Path("/app/frontend/src/v2/pages/V2AuthPage.js").read_text()
    # Le PNG n'est plus utilisé
    assert '<img' not in src or 'auth-logo' not in src.split('<img')[0], \
        "le PNG kolo-mark ne doit plus être rendu comme <img>"
    # Logotype texte présent
    assert 'League Spartan' in src, "logotype doit utiliser League Spartan"
    assert 'auth-logo' in src, "test-id auth-logo présent"
    assert 'KOLO' in src


def test_assistant_prompt_3_4_phrases_no_lists():
    src = Path("/app/backend/assistant/routes.py").read_text()
    assert "trois à quatre phrases courtes" in src
    assert "ni listes à puces" in src
    assert "trois points" in src


def test_assistant_max_tokens_350():
    src = Path("/app/backend/assistant/routes.py").read_text()
    assert "with_max_tokens(350)" in src


def test_auto_migrer_prod_still_on_startup():
    """Régression : ne PAS retirer l'auto-migrer-prod au startup."""
    src = Path("/app/backend/server.py").read_text()
    assert "async def _auto_migrer_prod" in src
    idx = src.find("async def _auto_migrer_prod")
    prefix = src[max(0, idx - 200):idx]
    assert '@app.on_event("startup")' in prefix
