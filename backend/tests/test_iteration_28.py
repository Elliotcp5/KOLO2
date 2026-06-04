"""Iteration 28 — Backend regression for:
- Email/password login (super admin)
- Google OAuth direct flow endpoints (client-id + exchange validation)
- Calendar integrations auth-url builders (Google + Outlook)
- Prospect heat-score calculator and AI suggestions
- Stability of high-traffic endpoints (/prospects, /tasks/today, /integrations/status)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "elliot.cohenpressard@trykolo.io"
ADMIN_PASSWORD = "Psychologue75007%!"


@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(http):
    r = http.post(f"{BASE_URL}/api/auth/login",
                  json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"super admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and len(data["token"]) > 10
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- Auth: email/password ----------
class TestAuthLogin:
    def test_super_admin_login_success(self, http):
        r = http.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert "token" in data and data["token"].startswith("sess_")
        assert "user_id" in data

    def test_login_wrong_password_returns_401(self, http):
        r = http.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": "wrongpassword!"})
        assert r.status_code == 401
        assert "mot de passe" in r.json().get("detail", "").lower() or "incorrect" in r.json().get("detail", "").lower()

    def test_login_unknown_email_returns_401(self, http):
        r = http.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "no.such.user@example.com", "password": "whatever"})
        assert r.status_code == 401
        assert "detail" in r.json()


# ---------- Direct Google OAuth ----------
class TestGoogleOAuthDirect:
    def test_client_id_public(self, http):
        r = http.get(f"{BASE_URL}/api/auth/google/client-id")
        assert r.status_code == 200
        data = r.json()
        assert "configured" in data
        # Backend must expose configured=true with a non-empty client_id
        assert data["configured"] is True
        assert data["client_id"] and ".apps.googleusercontent.com" in data["client_id"]

    def test_exchange_invalid_code_returns_400(self, http):
        r = http.post(f"{BASE_URL}/api/auth/google/exchange",
                      json={"code": "invalid_code_123", "redirect_uri": "https://example.com/auth/google"})
        assert r.status_code == 400, f"got {r.status_code}: {r.text}"
        body = r.json()
        assert "detail" in body and "Google" in body["detail"]

    def test_exchange_missing_body_returns_422(self, http):
        r = http.post(f"{BASE_URL}/api/auth/google/exchange", json={})
        assert r.status_code == 422


# ---------- Calendar integrations auth URLs ----------
class TestCalendarAuthUrls:
    def test_google_calendar_auth_url(self, http, auth_headers):
        r = http.get(f"{BASE_URL}/api/integrations/google-calendar/auth-url", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "authorization_url" in data
        url = data["authorization_url"]
        assert "accounts.google.com/o/oauth2" in url
        assert "client_id=" in url
        assert "redirect_uri=" in url
        assert "state=" in url

    def test_outlook_calendar_auth_url(self, http, auth_headers):
        r = http.get(f"{BASE_URL}/api/integrations/outlook-calendar/auth-url", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "authorization_url" in data
        url = data["authorization_url"]
        assert "login.microsoftonline.com" in url
        assert "client_id=" in url
        assert "redirect_uri=" in url
        assert "state=" in url


# ---------- Prospects: heat & AI suggestions ----------
@pytest.fixture(scope="module")
def prospect_id(http, auth_headers):
    # Try to fetch an existing prospect first
    r = http.get(f"{BASE_URL}/api/prospects", headers=auth_headers)
    assert r.status_code == 200, r.text
    items = r.json()
    if isinstance(items, dict):
        items = items.get("prospects") or items.get("items") or []
    if items:
        return items[0].get("prospect_id") or items[0].get("id")
    # otherwise create one
    payload = {
        "first_name": "TEST_Iter28",
        "last_name": "Prospect",
        "email": "test_iter28_prospect@example.com",
        "phone": "+33600000028",
        "source": "test",
        "type": "buyer",
    }
    rc = http.post(f"{BASE_URL}/api/prospects", json=payload, headers=auth_headers)
    assert rc.status_code in (200, 201), rc.text
    return rc.json()["id"]


class TestProspectIntel:
    def test_calculate_heat(self, http, auth_headers, prospect_id):
        r = http.post(f"{BASE_URL}/api/prospects/{prospect_id}/calculate-heat",
                      headers=auth_headers, json={})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "heat_score" in data
        score = data["heat_score"]
        assert isinstance(score, (int, float))
        assert 0 <= score <= 100
        assert data.get("status") in ("cold", "warm", "hot")

    def test_ai_suggest_for_prospect(self, http, auth_headers, prospect_id):
        r = http.get(f"{BASE_URL}/api/ai/suggest-for-prospect/{prospect_id}", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        sug = data.get("suggestion", data)
        for k in ("task_type", "task_title", "reason", "priority"):
            assert k in sug, f"missing key {k}"
        assert sug.get("ai_powered") is True
        assert sug["priority"] in ("low", "medium", "high")


# ---------- Sanity / no 500 on hot endpoints ----------
class TestHotEndpoints:
    def test_prospects_list(self, http, auth_headers):
        r = http.get(f"{BASE_URL}/api/prospects", headers=auth_headers)
        assert r.status_code == 200

    def test_tasks_today(self, http, auth_headers):
        r = http.get(f"{BASE_URL}/api/tasks/today", headers=auth_headers)
        assert r.status_code == 200

    def test_integrations_status(self, http, auth_headers):
        r = http.get(f"{BASE_URL}/api/integrations/status", headers=auth_headers)
        assert r.status_code == 200
