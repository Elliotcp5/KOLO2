"""KOLO — Régression build 2.20 (75) : 11 correctifs urgents.

Verrouille les fixes 1-10 (le 11 est manuel prod).
"""
from __future__ import annotations

from pathlib import Path


def _b1css() -> str:
    return Path("/app/frontend/src/b1/b1.css").read_text()


# ------------------------------------------------------------------
# 1. Champ de saisie assistant sous la tab bar → marge basse
# ------------------------------------------------------------------
def test_composer_assistant_pas_masque_par_tabbar():
    css = _b1css()
    # Le composer DOIT avoir un margin-bottom qui laisse passer la tab bar
    # (76px + safe-area). Sinon le champ est masqué et le chat inutilisable.
    assert "margin-bottom: calc(76px + env(safe-area-inset-bottom)" in css, \
        "as-composer doit avoir margin-bottom compensant la tab bar fixed"


# ------------------------------------------------------------------
# 2. Bouton « Estimer ce bien » depuis Mes mandats → pas de redirect page 1
# ------------------------------------------------------------------
def test_bouton_estimer_dans_mes_mandats():
    src = Path("/app/frontend/src/b1/B1MesMandats.jsx").read_text()
    assert "b1-mm-estimer-" in src, "bouton Estimer présent dans MandatCard"
    assert "onEstimer" in src, "callback onEstimer prop de MandatCard"
    assert "/app-b1/estimation/flow" in src, \
        "nav vers estimation/flow avec state.bien"
    # PAS de redirect vers /app-b1 (page 1) depuis la nav Estimer
    assert "navigate('/app-b1')" not in src.split("onEstimer")[1].split("})}")[0], \
        "pas de redirect page 1 dans onEstimer"


# ------------------------------------------------------------------
# 3. Boutons statut visibles — pastilles pleines colorées
# ------------------------------------------------------------------
def test_pastilles_statut_pleines_couleurs():
    css = _b1css()
    # État actif : chaque statut a sa couleur pleine + ombre franche
    assert 'b1-mm-toggle-btn[data-active="true"][data-key="demarche"]' in css
    assert 'background: #EC8690' in css or 'background:#EC8690' in css
    assert 'b1-mm-toggle-btn[data-active="true"][data-key="mandat_signe"]' in css
    assert 'background: #10B981' in css or 'background:#10B981' in css
    # Boutons hauteur min 44px (tactile Apple HIG)
    assert "min-height: 44px" in css.split(".b1-mm-toggle-btn")[1].split("}")[0], \
        "pastilles ≥ 44px de haut (tactile)"


# ------------------------------------------------------------------
# 4. Performance — lazy-loading + BottomTabPill memoized
# ------------------------------------------------------------------
def test_routes_lourdes_lazy_loaded():
    src = Path("/app/frontend/src/App.js").read_text()
    # Estimation, Dossier, Assistant, Veille, Directeur sont lazy
    for name in ["C1EstimationHome", "C2DossierList", "B1AssistantPage",
                 "B1VeillePileDuJourPage", "D1DirecteurRepartitionPage"]:
        assert f"const {name} = lazy(" in src, \
            f"{name} DOIT être lazy-loadée pour alléger le bundle initial"
    # Suspense englobe les routes
    assert "<Suspense fallback=" in src, "Suspense manquant autour de <Routes>"


def test_bottom_tab_pill_memoized():
    src = Path("/app/frontend/src/b1/B1Shell.jsx").read_text()
    assert "React.memo(_BottomTabPill)" in src, \
        "BottomTabPill DOIT être React.memo (évite re-render à chaque tab switch)"


# ------------------------------------------------------------------
# 5. Marges globales + safe-area haute (encoche iOS)
# ------------------------------------------------------------------
def test_marge_safe_area_top_appliquee():
    css = _b1css()
    # .b1-screen doit inclure env(safe-area-inset-top) dans son padding
    screen_block = css.split(".b1-screen {")[1].split("}")[0]
    assert "safe-area-inset-top" in screen_block, \
        ".b1-screen doit respecter env(safe-area-inset-top) — Dynamic Island / encoche"
    assert "20px" in screen_block, "20px de marge horizontale"


# ------------------------------------------------------------------
# 7. Assistant — bulles rose franc/bleu franc + typing indicator
# ------------------------------------------------------------------
def test_bulles_assistant_couleurs_franches():
    css = _b1css()
    bot_block = css.split(".as-bubble--bot {")[1].split("}")[0]
    assert "#EC8690" in bot_block, "bulle assistant rose #EC8690"
    assert "#FFFFFF" in bot_block or "white" in bot_block.lower(), \
        "texte blanc sur bulle assistant"
    user_block = css.split(".as-bubble--user {")[1].split("}")[0]
    assert "#3B82F6" in user_block, "bulle user bleu franc #3B82F6"


def test_typing_indicator_present():
    src = Path("/app/frontend/src/b1/B1Assistant.jsx").read_text()
    assert "as-typing-indicator" in src, \
        "indicateur de frappe (3 points animés) manquant"
    css = _b1css()
    assert "@keyframes as-typing-bounce" in css, \
        "animation CSS des 3 points de frappe manquante"


# ------------------------------------------------------------------
# 8. Fin de pile — récap + bouton Voir mes mandats
# ------------------------------------------------------------------
def test_fin_pile_recap_et_bouton_mandats():
    src = Path("/app/frontend/src/b1/B1FinDePile.jsx").read_text()
    # Récap journée : « Vous avez traité N opportunités aujourd'hui, dont M retenues »
    assert "b1-fin-pile-recap" in src, "récap journée manquant"
    assert "traitees" in src and "retenues" in src, \
        "compteurs traitées/retenues manquants"
    # Bouton « Voir mes opportunités de mandats »
    assert "b1-fin-pile-voir-mandats" in src, \
        "bouton Voir mes opportunités de mandats manquant"
    assert "/app-b1/mes-mandats" in src


# ------------------------------------------------------------------
# 10. Logo — repli texte KOLO stylisé League Spartan
# ------------------------------------------------------------------
def test_logo_login_est_texte_league_spartan():
    src = Path("/app/frontend/src/v2/pages/V2AuthPage.js").read_text()
    # Le PNG n'est plus rendu comme img avec auth-logo
    assert "League Spartan" in src, "logotype doit utiliser League Spartan"
    # Le texte KOLO doit être présent avec fontWeight 900 (gras extra)
    assert "fontWeight: 900" in src, \
        "logotype doit être en gras extra pour ressembler à une marque"
    assert "letterSpacing:" in src, "interlettrage resserré"
