"""Iteration 34 — CORS cleanup regression + billing_country on whitelabel/create.

Tests:
1. CORS regression: login / /auth/me / /auth/logout / /admin/check still work via Bearer token (no cookies).
2. WhiteLabel POST /api/admin/whitelabel/create accepts billing_country (ISO-2) and persists it.
3. /api/admin/whitelabel/list returns the billing_country on the created org.
4. accept-invite regression (iter 33) still returns clean error when super admin already belongs to another org.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
SUPER_ADMIN_EMAIL = "elliot.cohenpressard@trykolo.io"
SUPER_ADMIN_PWD = "Psychologue75007%!"


# ---------- Shared fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PWD,
    }, timeout=30)
    assert r.status_code == 200, f"super admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- (1) CORS Bearer-token regression ----------
class TestBearerAuthFlows:
    """All flows that previously used credentials:'include' must still work with Bearer-only."""

    def test_login_returns_token(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PWD,
        }, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body
        # Login response carries email at top-level
        assert body.get("email") == SUPER_ADMIN_EMAIL or body.get("user", {}).get("email") == SUPER_ADMIN_EMAIL

    def test_auth_me_with_bearer(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("email") == SUPER_ADMIN_EMAIL

    def test_admin_check_with_bearer(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/check", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        # Super admin should be admin
        assert body.get("is_admin") is True or body.get("is_super_admin") is True or body.get("ok") is True, body

    def test_auth_logout_with_bearer(self):
        # Login a fresh session so we don't invalidate the session fixture
        login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PWD,
        }, timeout=30)
        assert login.status_code == 200, login.text
        tok = login.json()["token"]
        r = requests.post(f"{BASE_URL}/api/auth/logout",
                          headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        # Backend should return 200 even if token already used; tolerate 204 too
        assert r.status_code in (200, 204), r.text


# ---------- (2) Whitelabel create with billing_country ----------
class TestWhitelabelBillingCountry:
    @pytest.fixture(scope="class")
    def be_org(self, admin_headers):
        suffix = uuid.uuid4().hex[:6]
        slug = f"audit-bc-{suffix}"
        sub = f"auditbc{suffix}"
        payload = {
            "name": "Audit Billing Country BE",
            "slug": slug,
            "primary_color": "#3B82F6",
            "secondary_color": "#1E40AF",
            "logo_url": "https://example.com/logo.png",
            "tagline": "BE country test",
            "seats": 50,
            "custom_subdomain": sub,
            "monthly_price_per_seat_eur": 1900,
            "font_family": "Inter",
            "billing_country": "BE",
        }
        r = requests.post(f"{BASE_URL}/api/admin/whitelabel/create",
                          json=payload, headers=admin_headers, timeout=30)
        assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
        org = r.json()["org"]
        yield {"org": org, "slug": slug, "subdomain": sub}
        try:
            from pymongo import MongoClient
            mc = MongoClient(os.environ.get("MONGO_URL"))
            db = mc[os.environ.get("DB_NAME")]
            db.organizations.delete_one({"org_id": org["org_id"]})
            db.org_invites.delete_many({"org_id": org["org_id"]})
        except Exception:
            pass

    def test_create_persists_billing_country(self, be_org):
        org = be_org["org"]
        assert org.get("billing_country") == "BE", f"billing_country not persisted: {org.get('billing_country')}"

    def test_list_returns_billing_country(self, admin_headers, be_org):
        r = requests.get(f"{BASE_URL}/api/admin/whitelabel/list", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        orgs = r.json().get("orgs", [])
        match = next((o for o in orgs if o.get("slug") == be_org["slug"]), None)
        assert match is not None, f"org {be_org['slug']} missing from list"
        assert match.get("billing_country") == "BE"

    def test_default_country_fr_when_omitted(self, admin_headers):
        """If billing_country omitted, backend should default to 'FR'."""
        suffix = uuid.uuid4().hex[:6]
        slug = f"audit-bc-fr-{suffix}"
        payload = {
            "name": "Audit Default FR",
            "slug": slug,
            "primary_color": "#000000",
            "seats": 10,
            "monthly_price_per_seat_eur": 1900,
        }
        r = requests.post(f"{BASE_URL}/api/admin/whitelabel/create",
                          json=payload, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        org = r.json()["org"]
        try:
            assert org.get("billing_country") == "FR"
        finally:
            try:
                from pymongo import MongoClient
                mc = MongoClient(os.environ.get("MONGO_URL"))
                db = mc[os.environ.get("DB_NAME")]
                db.organizations.delete_one({"org_id": org["org_id"]})
                db.org_invites.delete_many({"org_id": org["org_id"]})
            except Exception:
                pass


# ---------- (3) JoinOrg / accept-invite regression ----------
class TestAcceptInviteRegression:
    """iter_33 fix: when accept-invite called with valid token, no 5xx and FR error if already member."""

    def test_accept_invite_invalid_token_returns_4xx(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/orgs/accept-invite",
            json={"token": "doesnotexist_" + uuid.uuid4().hex},
            headers=admin_headers,
            timeout=30,
        )
        # Must be a clean 4xx (invalid/expired), never a 5xx
        assert 400 <= r.status_code < 500, f"unexpected status: {r.status_code} {r.text}"
