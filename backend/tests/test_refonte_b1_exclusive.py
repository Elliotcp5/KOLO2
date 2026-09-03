"""KOLO — Régression : refonte B1 exclusive (2026-09-03).

Ces tests gèlent l'invariant : après la "refonte", App.js NE DOIT :
  1. Contenir AUCUN `<Route ... element={<LoginPage />} />` — l'ancien écran
     password n'est plus accessible.
  2. Contenir AUCUN `<Route ... element={<AppShell />} />` — le vieux dashboard
     desktop n'est plus routé.
  3. Contenir AUCUNE double `<Route path="/login" ...>` — la duplication faisait
     que React Router prenait le vieux LoginPage AVANT V2AuthPage.
  4. Toutes les vieilles URLs (`/register`, `/forgot-password`,
     `/create-account`, `/app`, `/app-v2`) DOIVENT rediriger via `<Navigate>`.
  5. Le seul écran de connexion accessible EST `V2AuthPage` en `mode="login"`.
"""
from __future__ import annotations

import re
from pathlib import Path

APP_JS = Path("/app/frontend/src/App.js")


def test_no_login_page_route():
    """LoginPage (password-based) NE DOIT PLUS avoir de route."""
    src = APP_JS.read_text()
    assert not re.search(r'element=\{<LoginPage\s*/?>?', src), \
        "LoginPage (password) ne doit plus être routé — utiliser V2AuthPage à la place"
    assert 'import LoginPage from' not in src, \
        "import LoginPage doit être supprimé"


def test_no_appshell_route():
    """AppShell (vieux dashboard) NE DOIT PLUS avoir de route."""
    src = APP_JS.read_text()
    assert not re.search(r'element=\{[^}]*<AppShell[^}]*\}', src), \
        "AppShell ne doit plus être routé — la refonte est B1"
    assert 'import AppShell from' not in src


def test_no_register_page_route():
    src = APP_JS.read_text()
    assert 'import RegisterPage' not in src
    assert not re.search(r'element=\{<RegisterPage', src)


def test_login_route_uses_v2authpage_only():
    """Il DOIT y avoir exactement UNE route /login pointant vers V2AuthPage."""
    src = APP_JS.read_text()
    login_routes = re.findall(r'<Route\s+path="/login"[^>]*>', src)
    assert len(login_routes) == 1, \
        f"attendu exactement 1 route /login, trouvé {len(login_routes)} : {login_routes}"
    assert 'V2AuthPage' in login_routes[0], \
        f"/login DOIT utiliser V2AuthPage (code email), pas autre chose"


def test_old_urls_redirect_via_navigate():
    """Les vieilles URLs DOIVENT rediriger via <Navigate>."""
    src = APP_JS.read_text()
    for path in ["/register", "/forgot-password", "/create-account",
                 "/app", "/app-v2"]:
        # Match <Route path="/register" element={<Navigate ...>} />
        pattern = rf'<Route\s+path="{re.escape(path)}"\s+element=\{{<Navigate'
        assert re.search(pattern, src), \
            f"la route {path!r} DOIT rediriger via <Navigate>"


def test_no_dual_login_route_definitions():
    """DEUX routes /login coexistaient historiquement (LoginPage + V2AuthPage) →
    React Router prenait la 1re, l'utilisateur voyait le vieil écran malgré
    la refonte. Impossible de laisser réapparaître ce piège."""
    src = APP_JS.read_text()
    count = src.count('path="/login"')
    assert count == 1, \
        f"une seule route path=\"/login\" autorisée, trouvé {count}"


def test_native_root_redirects_to_b1_not_v2():
    """En natif (Capacitor), un utilisateur connecté DOIT aller sur /app-b1
    (jamais /app-v2). RootRedirect ne doit plus mentionner /app-v2 comme cible."""
    src = APP_JS.read_text()
    # Cherche la fonction RootRedirect
    m = re.search(r'const RootRedirect = \(\) =>\s*\{(.*?)\};\s*\n', src, re.DOTALL)
    assert m, "RootRedirect introuvable"
    body = m.group(1)
    assert '/app-b1' in body, "RootRedirect DOIT rediriger vers /app-b1"
    assert '/app-v2' not in body, \
        "RootRedirect ne DOIT PAS mentionner /app-v2 (la refonte est B1)"


def test_v2authpage_is_code_based_no_password_field():
    """V2AuthPage NE DOIT PAS contenir de champ password — c'est un code email."""
    src = Path("/app/frontend/src/v2/pages/V2AuthPage.js").read_text()
    assert 'type="password"' not in src, \
        "V2AuthPage ne doit pas avoir de champ password (code email uniquement)"
    assert 'sendEmailCode' in src or 'verifyEmailCode' in src, \
        "V2AuthPage doit utiliser le flow sendEmailCode/verifyEmailCode"
