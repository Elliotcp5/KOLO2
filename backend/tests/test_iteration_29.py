"""
Iteration 29 — Regression tests for:
- Super-admin email/password login
- Google OAuth client-id + exchange (invalid code -> 400)
- Calls log, WhatsApp log, prospect history
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")

SUPER_ADMIN_EMAIL = "elliot.cohenpressard@trykolo.io"
SUPER_ADMIN_PASSWORD = "Psychologue75007%!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD,
    })
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token") or data.get("session_token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def auth_session(session, auth_token):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",
    })
    return s


# ---- Auth tests ----
class TestAuth:
    def test_super_admin_login_returns_200_and_token(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD,
        })
        assert r.status_code == 200
        data = r.json()
        token = data.get("token") or data.get("access_token") or data.get("session_token")
        assert token and isinstance(token, str) and len(token) > 10

    def test_google_client_id_configured(self, session):
        r = session.get(f"{BASE_URL}/api/auth/google/client-id")
        assert r.status_code == 200
        data = r.json()
        assert data.get("configured") is True
        assert data.get("client_id"), "client_id should be present"
        assert ".apps.googleusercontent.com" in data["client_id"]

    def test_google_exchange_invalid_code_returns_400(self, session):
        r = session.post(f"{BASE_URL}/api/auth/google/exchange", json={
            "code": "definitely_invalid_code_xyz_123",
            "redirect_uri": f"{BASE_URL}/auth/google",
        })
        # Expect 400 (Google says invalid_grant). Not 500.
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


# ---- Integrations tests ----
class TestIntegrations:
    @pytest.fixture(scope="class")
    def prospect_id(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/prospects")
        assert r.status_code == 200, f"Failed to list prospects: {r.status_code} {r.text}"
        data = r.json()
        prospects = data.get("prospects") or data.get("items") or []
        assert prospects, "No prospects found for super-admin"
        # pick first prospect
        p = prospects[0]
        pid = p.get("prospect_id") or p.get("id")
        assert pid
        return pid

    def test_calls_log_returns_200_with_call_id(self, auth_session, prospect_id):
        r = auth_session.post(f"{BASE_URL}/api/integrations/calls/log", json={
            "to": "+33612345678",
            "prospect_id": prospect_id,
            "duration_sec": 42,
            "notes": "TEST_iteration_29 call log",
            "outcome": "completed",
        })
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
        data = r.json()
        assert "call" in data
        assert data["call"].get("call_id"), f"Missing call_id in: {data}"

    def test_whatsapp_log_returns_200(self, auth_session, prospect_id):
        r = auth_session.post(f"{BASE_URL}/api/integrations/whatsapp/log", json={
            "to": "+33612345678",
            "body": "TEST_iteration_29 wa log",
            "prospect_id": prospect_id,
        })
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"

    def test_prospect_history_returns_items_counts(self, auth_session, prospect_id):
        r = auth_session.get(f"{BASE_URL}/api/integrations/prospect/{prospect_id}/history")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert "calls_count" in data
        assert "wa_count" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["calls_count"], int)
        assert isinstance(data["wa_count"], int)
        # We just logged a call and a wa, so counts should be > 0
        assert data["calls_count"] >= 1
        assert data["wa_count"] >= 1
