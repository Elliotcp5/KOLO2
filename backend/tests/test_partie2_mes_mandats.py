"""KOLO — Régression Partie 2 : swipe + Mes opportunités de mandats.

Verrouille :
1. Endpoints backend `mes-mandats` et `statut-mandat` montés + valident les
   statuts.
2. Page `MesMandatsPage` existe, montée sur `/app-b1/mes-mandats`.
3. `MesMandatsButton` (bouton permanent) présent dans `B1Shell`.
4. `SwipeCard` pilote via ref DOM, pas via `useState` — donc aucun re-render
   pendant le drag.
5. Statut labels traduits dans 4 langues.
"""
from __future__ import annotations

import re
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from b1.routes import router as b1_router


def _paths(router, method: str) -> set[str]:
    return {
        r.path for r in router.routes
        if method in (getattr(r, "methods", set()) or set())
    }


def test_endpoint_mes_mandats_monte():
    assert "/api/opportunites/mes-mandats" in _paths(b1_router, "GET")


def test_endpoint_statut_mandat_monte():
    assert "/api/opportunites/{opportunite_id}/statut-mandat" in _paths(b1_router, "PATCH")


def test_mes_mandats_page_composant_existe():
    src = Path("/app/frontend/src/b1/B1MesMandats.jsx").read_text()
    assert "export function MesMandatsPage" in src
    assert "export function MesMandatsButton" in src
    # 5 statuts métier
    for s in ["a_demarcher", "demarche", "mandat_signe", "abandon", "deja_en_vente"]:
        assert s in src, f"statut manquant : {s}"
    # Double confirmation pour abandon
    assert "AbandonModal" in src
    assert "b1-mm-abandon-confirm" in src
    # 1-tap déjà en vente (sans confirmation)
    assert "onDejaEnVente" in src
    assert "b1-mm-deja-en-vente-" in src


def test_route_mes_mandats_dans_app():
    src = Path("/app/frontend/src/App.js").read_text()
    assert "/app-b1/mes-mandats" in src
    assert "MesMandatsPage" in src


def test_bouton_permanent_dans_opportunites_page():
    """Le bouton `MesMandatsButton` DOIT être présent dans B1Shell,
    entre </div> de la screen et <BottomTabPill>, pour qu'il soit visible
    au-dessus de la tab bar même quand la pile est vide."""
    src = Path("/app/frontend/src/b1/B1Shell.jsx").read_text()
    assert "MesMandatsButton" in src
    # Ordre : MesMandatsButton APRÈS le contenu, AVANT BottomTabPill
    m = re.search(r"<MesMandatsButton\s*/>[\s\S]{0,200}<BottomTabPill", src)
    assert m, "MesMandatsButton doit être JUSTE au-dessus de BottomTabPill"


def test_swipecard_pilote_via_ref_pas_setstate():
    """SwipeCard NE DOIT PAS re-render pendant le drag.
    On vérifie que le composant utilise `useRef` pour piloter le DOM directement,
    et n'utilise PAS `setDrag` (l'ancien useState qui causait le jank)."""
    src = Path("/app/frontend/src/b1/B1Nav.jsx").read_text()
    assert "useRef" in src
    assert "cardRef" in src
    assert "requestAnimationFrame" in src
    # L'ancien setDrag qui re-render à chaque pointermove doit avoir disparu
    assert "setDrag(" not in src, \
        "setDrag ne doit PAS être appelé pendant le drag — cause du jank sur iPhone"
    # Seuil 30% width
    assert "0.30" in src or "0.3" in src, "seuil 30% width attendu"


def test_swipecard_haptic_feedback():
    src = Path("/app/frontend/src/b1/B1Nav.jsx").read_text()
    assert "hapticLight" in src or "vibrate" in src, \
        "retour haptique manquant (Capacitor Haptics OU navigator.vibrate)"


def test_i18n_mes_mandats_coverage_4_langues():
    """Toutes les clés `opp.mes_mandats.*` et `opp.statut.*` doivent exister
    dans les 4 langues (fr, en, it, de)."""
    src = Path("/app/frontend/src/b1/b1i18n.js").read_text()
    keys = [
        "opp.mes_mandats.bouton", "opp.mes_mandats.titre",
        "opp.mes_mandats.vide.titre", "opp.mes_mandats.vide.sous",
        "opp.mes_mandats.deja_en_vente",
        "opp.mes_mandats.abandon_confirm.titre",
        "opp.statut.a_demarcher", "opp.statut.demarche",
        "opp.statut.mandat_signe", "opp.statut.abandon",
        "opp.statut.deja_en_vente",
    ]
    # Chaque clé doit apparaître AU MOINS 4 fois (une par langue)
    for k in keys:
        count = src.count(f"'{k}'")
        assert count >= 4, f"clé {k} présente {count}x, attendu ≥ 4 (fr+en+it+de)"


def test_swipe_endpoint_reste_intact():
    """Le fix historique `POST /api/opportunites/{id}/swipe` ne doit pas avoir
    régressé — c'est la ceinture de sécurité contre les redirections vers
    Estimation."""
    src = Path("/app/frontend/src/b1/B1Shell.jsx").read_text()
    # swipe() dans OpportunitesPage NE DOIT PAS naviguer vers estimation
    swipe_fn = re.search(r"const swipe = async \(sens\)[\s\S]{0,1500}?  \};", src)
    assert swipe_fn, "swipe function non trouvée"
    body = swipe_fn.group(0)
    assert "navigate(" not in body or "estimation" not in body, \
        "swipe ne DOIT PAS rediriger vers l'onglet Estimation"
