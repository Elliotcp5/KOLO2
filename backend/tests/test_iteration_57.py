"""
Iteration 57 — V2 fixes regression tests
Tests for: dashboard ring counters, prospecting (no fake placeholder),
promo codes redeem flow, regression on auth.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/v2"

APPLE_EMAIL = "applereview@trykolo.io"
APPLE_CODE = "424242"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def apple_token(session):
    # Apple Review bypass
    r = session.post(f"{API}/auth/verify-email-code", json={"email": APPLE_EMAIL, "code": APPLE_CODE})
    assert r.status_code == 200, f"Apple bypass failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("verified") is True
    assert data.get("session_token", "").startswith("sess_")
    return data["session_token"]


@pytest.fixture(scope="session")
def apple_headers(apple_token):
    return {"Authorization": f"Bearer {apple_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def fresh_user(session):
    """Create a brand-new user via dev email-code flow → returns (email, token, user_id)."""
    email = f"test_iter57_{uuid.uuid4().hex[:8]}@trykolo.io"
    r1 = session.post(f"{API}/auth/send-email-code", json={"email": email})
    assert r1.status_code == 200, r1.text
    dev_code = r1.json().get("dev_code")
    assert dev_code, "dev_code missing"
    r2 = session.post(f"{API}/auth/verify-email-code", json={"email": email, "code": dev_code})
    assert r2.status_code == 200, r2.text
    d = r2.json()
    return {"email": email, "token": d["session_token"], "user_id": d["user_id"]}


@pytest.fixture(scope="session")
def fresh_user2(session):
    email = f"test_iter57b_{uuid.uuid4().hex[:8]}@trykolo.io"
    r1 = session.post(f"{API}/auth/send-email-code", json={"email": email})
    dev_code = r1.json().get("dev_code")
    r2 = session.post(f"{API}/auth/verify-email-code", json={"email": email, "code": dev_code})
    d = r2.json()
    return {"email": email, "token": d["session_token"], "user_id": d["user_id"]}


# ---------- Auth regression ----------
class TestAuthRegression:
    def test_send_email_code(self, session):
        email = f"reg_{uuid.uuid4().hex[:6]}@trykolo.io"
        r = session.post(f"{API}/auth/send-email-code", json={"email": email})
        assert r.status_code == 200
        body = r.json()
        assert body.get("sent") is True
        assert body.get("dev_code"), "dev_code should be returned in dev"

    def test_apple_bypass_login(self, apple_token):
        assert apple_token.startswith("sess_")


# ---------- Dashboard ring counters ----------
class TestDashboardCounters:
    def test_dashboard_has_new_counter_fields(self, session, apple_headers):
        r = session.get(f"{API}/dashboard", headers=apple_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        for field in (
            "reminders_completed_today",
            "reminders_created_today",
            "notes_processed_today",
            "notes_created_today",
        ):
            assert field in data, f"Missing field {field} in dashboard. Got: {list(data.keys())}"
            assert isinstance(data[field], (int, float)), f"{field} should be numeric, got {type(data[field])}"

    def test_fresh_user_dashboard_counters_are_zero(self, session, fresh_user):
        h = {"Authorization": f"Bearer {fresh_user['token']}"}
        r = session.get(f"{API}/dashboard", headers=h)
        assert r.status_code == 200
        d = r.json()
        assert d.get("reminders_created_today", -1) == 0
        assert d.get("notes_created_today", -1) == 0
        assert d.get("reminders_completed_today", -1) == 0
        assert d.get("notes_processed_today", -1) == 0


# ---------- Prospecting listings (no fake placeholder) ----------
class TestProspectingListings:
    def test_listings_no_placeholder(self, session, apple_headers):
        r = session.get(f"{API}/prospecting/listings", params={"sector": "Lyon"}, headers=apple_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        # Must NOT use the legacy 'placeholder' source
        assert d.get("source") != "placeholder", f"Backend still returns placeholder data: {d}"
        # Either scraping_in_progress with items:[] OR real items list
        source = d.get("source", "")
        items = d.get("items", [])
        assert isinstance(items, list)
        if source == "scraping_in_progress":
            assert items == [], "scraping_in_progress should return empty items"


# ---------- Promo codes ----------
class TestPromoCodes:
    def test_redeem_unknown_code(self, session, fresh_user):
        h = {"Authorization": f"Bearer {fresh_user['token']}"}
        r = session.post(f"{API}/promo/redeem", json={"code": "DOES_NOT_EXIST_XYZ"}, headers=h)
        assert r.status_code == 404

    def test_redeem_welcome30_success(self, session, fresh_user):
        h = {"Authorization": f"Bearer {fresh_user['token']}"}
        r = session.post(f"{API}/promo/redeem", json={"code": "WELCOME30"}, headers=h)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("granted_days") == 30
        assert d.get("pro_until"), "pro_until missing"

    def test_redeem_welcome30_twice_returns_409(self, session, fresh_user):
        h = {"Authorization": f"Bearer {fresh_user['token']}"}
        # First redeem already done in previous test; redo defensively
        session.post(f"{API}/promo/redeem", json={"code": "WELCOME30"}, headers=h)
        r2 = session.post(f"{API}/promo/redeem", json={"code": "WELCOME30"}, headers=h)
        assert r2.status_code == 409, f"Expected 409 on re-redeem, got {r2.status_code}: {r2.text}"

    def test_dashboard_has_pro_after_redeem(self, session, fresh_user):
        h = {"Authorization": f"Bearer {fresh_user['token']}"}
        # Ensure redeem happened
        session.post(f"{API}/promo/redeem", json={"code": "WELCOME30"}, headers=h)
        r = session.get(f"{API}/dashboard", headers=h)
        assert r.status_code == 200
        d = r.json()
        assert d.get("has_pro") is True, f"has_pro should be True after promo redeem, got: {d.get('has_pro')}"

    def test_vip_once_single_use(self, session, fresh_user2):
        """VIP-ONCE is single-use (max_redemptions=1). First user gets 200, second user gets 410."""
        h2 = {"Authorization": f"Bearer {fresh_user2['token']}"}
        # Check current state
        import pymongo
        client = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[os.environ.get("DB_NAME", "test_database")]
        promo = db.v2_promo_codes.find_one({"code": "VIP-ONCE"})
        already_used = (promo or {}).get("redeemed_count", 0) >= 1

        r = session.post(f"{API}/promo/redeem", json={"code": "VIP-ONCE"}, headers=h2)
        if already_used:
            # Limit reached → 410
            assert r.status_code == 410, f"Expected 410 (limit), got {r.status_code}: {r.text}"
        else:
            # First redemption → 200
            assert r.status_code == 200, r.text
            assert r.json().get("granted_days") == 90

    def test_redeem_requires_auth(self, session):
        r = session.post(f"{API}/promo/redeem", json={"code": "WELCOME30"})
        assert r.status_code == 401


# ---------- Standard v2 endpoints regression ----------
class TestV2Regression:
    @pytest.mark.parametrize("path", [
        "/dashboard",
        "/cases",
        "/contacts",
        "/reminders",
        "/notes",
        "/referral/me",
    ])
    def test_endpoint_responds(self, session, apple_headers, path):
        r = session.get(f"{API}{path}", headers=apple_headers)
        assert r.status_code in (200, 204), f"{path} → {r.status_code}: {r.text[:200]}"
