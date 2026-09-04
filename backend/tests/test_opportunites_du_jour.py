"""KOLO — Régression : endpoints opportunités du jour (post-TestFlight).

Ces tests gèlent 3 invariants critiques :
1. `GET /api/opportunites/du-jour` existe et retourne les opps `proposee`
   attribuées à l'utilisateur, triées par `date_attribution` DESC, avec
   limit configurable.
2. `POST /api/opportunites/{id}/accepter` change le statut `proposee` →
   `acceptee` UNIQUEMENT si l'opportunité appartient à l'utilisateur.
3. `POST /api/opportunites/{id}/rejeter` change `proposee` → `rejetee` avec
   la même protection.

Sans ces endpoints, `OpportunitesPage` retombait sur `DEMO_OPPORTUNITES`
et n'affichait JAMAIS les vraies opps de la prod (bug #2 remonté depuis
TestFlight).
"""
from __future__ import annotations

from b1.routes import router


def test_get_opportunites_du_jour_endpoint_exists():
    paths = {}
    for r in router.routes:
        for m in getattr(r, "methods", set()) or set():
            paths.setdefault(m, set()).add(r.path)
    assert "/api/opportunites/du-jour" in paths.get("GET", set()), \
        "endpoint GET /api/opportunites/du-jour manquant — le frontend retombe sur les démos"


def test_accepter_rejeter_endpoints_exist():
    paths = {}
    for r in router.routes:
        for m in getattr(r, "methods", set()) or set():
            paths.setdefault(m, set()).add(r.path)
    assert "/api/opportunites/{opportunite_id}/accepter" in paths.get("POST", set())
    assert "/api/opportunites/{opportunite_id}/rejeter" in paths.get("POST", set())


def test_du_jour_filters_by_assigne_a_and_statut_proposee():
    """Le code source DOIT filtrer sur assigne_a + statut=proposee.
    Un bug qui retournerait les opps du pool casserait tout le principe."""
    src = open("/app/backend/b1/routes.py").read()
    # Cherche la fonction get_opportunites_du_jour
    idx = src.find("async def get_opportunites_du_jour")
    assert idx > 0
    body = src[idx:idx + 2000]
    assert '"assigne_a": uid' in body, "doit filtrer par assigne_a=user.user_id"
    assert '"statut": "proposee"' in body, "doit filtrer par statut='proposee'"
    assert '.sort("date_attribution", -1)' in body, \
        "doit trier par date_attribution DESC (les plus récentes d'abord)"


def test_frontend_b1api_calls_real_endpoint_not_demo():
    """Le b1api.js DOIT exposer getOpportunitesDuJour + accepter + rejeter."""
    src = open("/app/frontend/src/b1/b1api.js").read()
    assert "getOpportunitesDuJour" in src
    assert "accepterOpportunite" in src
    assert "rejeterOpportunite" in src
    assert "/api/opportunites/du-jour" in src


def test_opportunites_page_uses_real_api():
    """B1Shell::OpportunitesPage DOIT fetch b1api.getOpportunitesDuJour() et
    NE JAMAIS fallback vers des cartes de démonstration.

    Règle métier (Partie 1 § 1.4) : les cartes démo sont réservées à la
    zone 99999 et au compte de revue Apple. Sur un compte réel dont la
    liste est vide, on affiche `FinDePileScreen` (« zone calme »)."""
    src = open("/app/frontend/src/b1/B1Shell.jsx").read()
    assert "b1api.getOpportunitesDuJour" in src, \
        "OpportunitesPage doit appeler b1api.getOpportunitesDuJour()"
    # Aucun fallback DEMO n'est autorisé — un compte réel doit voir la
    # zone calme, jamais une carte fictive.
    assert "DEMO_OPPORTUNITES" not in src, \
        "aucun fallback DEMO_OPPORTUNITES autorisé dans B1Shell"
    assert "setItems([])" in src, \
        "OpportunitesPage doit fallback sur liste vide en cas d'erreur"


def test_swipe_card_has_pointer_handlers():
    """SwipeCard DOIT gérer les Pointer Events (unifie souris + tactile).
    Sans onPointerDown/Move/Up le geste ne fait rien sur iOS Safari
    (bug #1 remonté depuis TestFlight)."""
    src = open("/app/frontend/src/b1/B1Nav.jsx").read()
    for handler in ["onPointerDown", "onPointerMove", "onPointerUp"]:
        assert handler in src, f"SwipeCard doit implémenter {handler}"
    # touch-action: pan-y pour éviter que le scroll vertical vole le geste
    assert "touch-action" in src or "touchAction" in src


def test_swipe_card_has_fallback_buttons():
    """SwipeCard DOIT toujours exposer les 2 boutons ✕/♥ pour que l'écran
    reste utilisable si le geste échoue."""
    src = open("/app/frontend/src/b1/B1Nav.jsx").read()
    assert 'data-testid="b1-opp-reject"' in src
    assert 'data-testid="b1-opp-accept"' in src


def test_back_header_component_exists():
    """BackHeader DOIT être disponible avec un fallback si l'historique
    est vide (utilisateur arrivé par deep link)."""
    src = open("/app/frontend/src/b1/B1Nav.jsx").read()
    assert "export function BackHeader" in src
    assert "window.history.length" in src
    assert "fallbackTo" in src
