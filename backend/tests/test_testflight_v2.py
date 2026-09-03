"""KOLO — Régression TestFlight 2e passe (2026-09-03).

Ces tests gèlent les fixes du 2e retour TestFlight :

1. `POST /api/opportunites/{id}/marquer-a-demarcher` DOIT exister — c'est ce
   que la carte swipe droite déclenche pour faire apparaître l'opportunité
   dans « Mes opportunités de mandats ».
2. Le statut posé DOIT être `a_demarcher` (pas `acceptee`).
3. `OpportunitesPage` NE DOIT PLUS jamais retomber sur `DEMO_OPPORTUNITES`
   quand l'API retourne une liste vide — sinon un vrai compte voit des
   cartes fictives et ne peut plus distinguer un vrai bien d'un faux.
4. Le swipe droite NE DOIT PLUS rediriger vers `/app-b1/estimation/flow`.
5. `_auto_migrer_prod` est branché sur `@app.on_event("startup")` — la prod
   se répare à chaque redémarrage backend (fix `enrichissements.id_parcelle`).
6. Assistant `SYSTEM_PROMPT` DOIT contenir la contrainte 4 phrases + 3 points.
7. Assistant `max_tokens` DOIT être capé (via `with_max_tokens`).
8. `DossierListPage` (onglet Rapport) DOIT avoir `BottomTabPill` — sinon
   l'écran est un cul-de-sac dès qu'on clique dessus.
"""
from __future__ import annotations

from pathlib import Path
from b1.routes import router as b1_router


def test_marquer_a_demarcher_endpoint_exists():
    paths = {}
    for r in b1_router.routes:
        for m in getattr(r, "methods", set()) or set():
            paths.setdefault(m, set()).add(r.path)
    assert "/api/opportunites/{opportunite_id}/marquer-a-demarcher" in paths.get("POST", set())
    # `/accepter` reste comme alias historique
    assert "/api/opportunites/{opportunite_id}/accepter" in paths.get("POST", set())


def test_swipe_right_sets_a_demarcher_status():
    src = Path("/app/backend/b1/routes.py").read_text()
    idx = src.find("async def marquer_opportunite_a_demarcher")
    assert idx > 0
    body = src[idx:idx + 1200]
    assert '"statut": "a_demarcher"' in body, \
        "swipe droite doit poser statut='a_demarcher' (pas 'acceptee')"
    # Filtre : ne change QUE les opps de cet utilisateur en `proposee`
    assert '"assigne_a": user["user_id"]' in body
    assert '"statut": "proposee"' in body


def test_frontend_no_demo_fallback_on_empty_api():
    """OpportunitesPage NE DOIT PLUS retomber sur DEMO_OPPORTUNITES quand
    l'API renvoie {items: []}. Un vrai compte doit voir l'empty state,
    pas une carte fictive."""
    src = Path("/app/frontend/src/b1/B1Shell.jsx").read_text()
    idx = src.find("Charge les opportunités attribuées")
    assert idx > 0
    body = src[idx:idx + 2000]
    # Bug qu'on veut empêcher : fallback aveugle sur DEMO_OPPORTUNITES
    assert "if (r?.items?.length) setItems(r.items);\n        else setItems(DEMO_OPPORTUNITES);" not in body
    assert "setItems(r?.items || [])" in body
    # Le seul cas OK : 401 anonyme + tour guidé actif
    assert "e.status === 401" in body
    assert "kolo_b1_show_tour" in body


def test_swipe_right_does_not_redirect_to_estimation():
    """Le swipe droite NE DOIT PLUS rediriger vers /app-b1/estimation/flow
    ni /app-b1/estimation/adresse — on reste sur la pile, prochaine carte."""
    src = Path("/app/frontend/src/b1/B1Shell.jsx").read_text()
    idx = src.find("const swipe = async (sens)")
    assert idx > 0
    # extrait la fonction swipe (~40 lignes)
    end = src.find("const next = ", idx)  # peut être avant
    end = src.find("useEffect", idx)
    body = src[idx:end]
    assert "navigate('/app-b1/estimation" not in body, \
        "swipe ne doit plus rediriger vers /app-b1/estimation"
    # Doit appeler swipeOpportunite ou marquerADemarcher
    assert "swipeOpportunite" in body or "marquerADemarcher" in body


def test_auto_migrer_prod_on_startup():
    """`_auto_migrer_prod` DOIT être décoré `@app.on_event('startup')` —
    garantit que chaque redémarrage backend répare silencieusement l'index
    `enrichissements.id_parcelle` qui bloque la génération d'opps en prod."""
    src = Path("/app/backend/server.py").read_text()
    idx = src.find('async def _auto_migrer_prod')
    assert idx > 0
    # startup event juste avant
    prefix = src[max(0, idx - 200):idx]
    assert '@app.on_event("startup")' in prefix


def test_assistant_system_prompt_short_answer_guardrail():
    src = Path("/app/backend/assistant/routes.py").read_text()
    # 4 phrases max + 3 points max
    assert "quatre phrases courtes" in src
    assert "trois points" in src


def test_assistant_max_tokens_capped():
    """`with_max_tokens(300)` OU `with_max_tokens(400)` DOIT être appelé sur
    le chat pour capper la réponse — le prompt seul ne suffit pas."""
    src = Path("/app/backend/assistant/routes.py").read_text()
    assert "with_max_tokens(300)" in src or "with_max_tokens(400)" in src


def test_dossier_list_has_bottom_tab_pill():
    """DossierListPage (onglet Rapport) DOIT avoir BottomTabPill —
    sinon l'onglet Rapport est un cul-de-sac."""
    src = Path("/app/frontend/src/b1/B1Dossier.jsx").read_text()
    assert "import { BottomTabPill } from './B1Shell'" in src
    idx = src.find("export function DossierListPage")
    end = src.find("export function DossierEditorPage")
    body = src[idx:end]
    assert '<BottomTabPill active="rapport" />' in body


def test_chat_bubbles_css_defined():
    """CSS bulles chat (rose/bleu, coins arrondis + pointe) doit être
    défini pour l'assistant."""
    src = Path("/app/frontend/src/b1/b1.css").read_text()
    assert ".as-bubble--bot" in src
    assert ".as-bubble--user" in src
    # Bulle bot rose avec coin bas-gauche pointu (pointe vers locuteur)
    assert "20px 20px 20px 6px" in src  # bot bubble
    assert "20px 20px 6px 20px" in src  # user bubble
    assert ".as-send" in src            # bouton rond bleu
