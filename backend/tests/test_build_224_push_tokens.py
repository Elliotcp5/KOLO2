"""Guard tests Build 2.24 — chaîne de device tokens push (APNs)."""
from pathlib import Path


def test_backend_register_device_ecrit_schema_canonique():
    """Le legacy endpoint /api/notifications/register-device DOIT écrire
    dans le schéma canonique b3 (`token` + `plateforme`), sinon
    send_push_to_user ne verra jamais le token → tokens_cibles=0.
    """
    src = Path("/app/backend/server.py").read_text()
    assert '"token": device_token' in src
    assert '"plateforme": platform' in src
    # Upsert sur (user_id, token), pas sur (user_id, platform).
    assert '"user_id": user_id, "token": device_token' in src


def test_send_push_lit_les_deux_schemas():
    """Rétro-compat : send_push_to_user doit lire aussi le champ
    legacy `device_token` pour ne pas rater les tokens historiques."""
    src = Path("/app/backend/b3/services.py").read_text()
    assert 'device_token' in src
    assert 't.get("token") or t.get("device_token")' in src


def test_frontend_push_bridge_installed():
    """Un listener global 'registration' doit exister au niveau App.js."""
    br = Path("/app/frontend/src/b1/B1PushBridge.jsx").read_text()
    assert "addListener('registration'" in br
    assert "/api/notifications/register-device" in br
    assert "Capacitor.isNativePlatform" in br
    app = Path("/app/frontend/src/App.js").read_text()
    assert "B1PushBridge" in app


def test_diagnostic_endpoint_declare():
    """L'endpoint d'introspection existe pour le debug prod."""
    src = Path("/app/backend/d1/routes.py").read_text()
    assert "/api/d1/admin/diagnostic-device-tokens" in src
