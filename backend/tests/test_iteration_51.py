"""
Iteration 51 — Free Plan V2 Quotas + Google Play Billing scaffold.

Covers:
  - GET /api/v2/quota
  - POST /api/v2/contacts free vs pro (10 max free / unlimited pro)
  - GET /api/v2/prospecting/dpe + /listings free vs pro (1/day free)
  - GET /api/v2/dashboard quota fields
  - POST /api/iap/verify-google-purchase (missing fields → 400, unconfigured env → 500)
  - POST /api/iap/verify-apple-receipt regression (still reachable)
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
SESSION = "sess_ec7f64eac2c346648c7baf3afb7cff80"
USER_ID = "u_227c821eafc54b53"
HEADERS = {"Authorization": f"Bearer {SESSION}", "Content-Type": "application/json"}

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# ----------------------------------------------------------------------
# DB helpers (synchronous wrappers via motor + asyncio)
# ----------------------------------------------------------------------
import asyncio


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _db():
    return AsyncIOMotorClient(MONGO_URL)[DB_NAME]


async def _reset_free_state():
    db = _db()
    await db.v2_contacts.delete_many({"user_id": USER_ID})
    today = datetime.now(timezone.utc).date().isoformat()
    await db.v2_prospecting_log.delete_many({"user_id": USER_ID, "date": today})
    await db.users.update_one({"user_id": USER_ID}, {"$set": {"subscription_status": "free"}}, upsert=False)


async def _set_pro(is_pro: bool):
    db = _db()
    await db.users.update_one(
        {"user_id": USER_ID},
        {"$set": {"subscription_status": "active" if is_pro else "free"}},
    )


async def _clear_prospect_log():
    db = _db()
    today = datetime.now(timezone.utc).date().isoformat()
    await db.v2_prospecting_log.delete_many({"user_id": USER_ID, "date": today})


async def _clear_contacts():
    db = _db()
    await db.v2_contacts.delete_many({"user_id": USER_ID})


# ----------------------------------------------------------------------
# Fixtures
# ----------------------------------------------------------------------
@pytest.fixture(scope="module", autouse=True)
def reset_before_after():
    _run(_reset_free_state())
    yield
    _run(_reset_free_state())


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


# ----------------------------------------------------------------------
# /api/v2/quota
# ----------------------------------------------------------------------
class TestQuotaEndpoint:
    def test_quota_free_user_initial(self, client):
        _run(_reset_free_state())
        r = client.get(f"{BASE_URL}/api/v2/quota")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["is_pro"] is False
        assert data["contacts_used"] == 0
        assert data["contacts_limit"] == 10
        assert data["contacts_left"] == 10
        assert data["prospecting_used_today"] == 0
        assert data["prospecting_limit_per_day"] == 1
        assert data["prospecting_left_today"] == 1
        assert data["prospecting_resets_at"] == "00:00 UTC"

    def test_quota_pro_user_unlimited(self, client):
        _run(_set_pro(True))
        try:
            r = client.get(f"{BASE_URL}/api/v2/quota")
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["is_pro"] is True
            assert data["contacts_limit"] is None
            assert data["contacts_left"] is None
            assert data["prospecting_limit_per_day"] is None
            assert data["prospecting_left_today"] is None
        finally:
            _run(_set_pro(False))


# ----------------------------------------------------------------------
# POST /api/v2/contacts — quota free vs pro
# ----------------------------------------------------------------------
class TestContactsQuota:
    def test_free_user_limited_to_10_contacts(self, client):
        _run(_reset_free_state())
        for i in range(10):
            payload = {"first_name": f"TEST_q{i}", "last_name": f"Iter51_{i}"}
            r = client.post(f"{BASE_URL}/api/v2/contacts", json=payload)
            assert r.status_code == 200, f"contact #{i+1} failed: {r.status_code} {r.text}"

        # 11th must be 402
        r11 = client.post(
            f"{BASE_URL}/api/v2/contacts",
            json={"first_name": "TEST_q10", "last_name": "Over"},
        )
        assert r11.status_code == 402, r11.text
        detail = r11.json().get("detail", "")
        assert "Limite gratuite atteinte" in detail
        assert "10 contacts" in detail
        assert "Pro" in detail

        # Sanity: quota now reads contacts_left=0
        q = client.get(f"{BASE_URL}/api/v2/quota").json()
        assert q["contacts_used"] == 10
        assert q["contacts_left"] == 0

    def test_pro_user_unlimited_contacts(self, client):
        _run(_clear_contacts())
        _run(_set_pro(True))
        try:
            for i in range(12):
                r = client.post(
                    f"{BASE_URL}/api/v2/contacts",
                    json={"first_name": f"TEST_pro{i}", "last_name": "Iter51_pro"},
                )
                assert r.status_code == 200, f"pro contact #{i+1} failed: {r.status_code} {r.text}"
        finally:
            _run(_set_pro(False))
            _run(_clear_contacts())


# ----------------------------------------------------------------------
# GET /api/v2/prospecting/* — quota free vs pro
# ----------------------------------------------------------------------
class TestProspectingQuota:
    def test_dpe_free_first_ok_second_402(self, client):
        _run(_clear_prospect_log())
        r1 = client.get(f"{BASE_URL}/api/v2/prospecting/dpe", params={"sector": "Lyon"})
        assert r1.status_code == 200, r1.text
        body = r1.json()
        assert "items" in body and isinstance(body["items"], list)

        r2 = client.get(f"{BASE_URL}/api/v2/prospecting/dpe", params={"sector": "Lyon"})
        assert r2.status_code == 402, r2.text
        d = r2.json().get("detail", "")
        assert "Quota Prospection gratuit atteint" in d
        assert "1 recherche" in d

    def test_listings_shares_same_quota(self, client):
        _run(_clear_prospect_log())
        # 1 call to listings consumes the daily quota
        r1 = client.get(f"{BASE_URL}/api/v2/prospecting/listings", params={"sector": "Lyon"})
        assert r1.status_code == 200, r1.text
        # Second call (any of DPE or listings) must be blocked
        r2 = client.get(f"{BASE_URL}/api/v2/prospecting/dpe", params={"sector": "Lyon"})
        assert r2.status_code == 402, r2.text
        r3 = client.get(f"{BASE_URL}/api/v2/prospecting/listings", params={"sector": "Lyon"})
        assert r3.status_code == 402, r3.text

    def test_pro_user_unlimited_prospecting(self, client):
        _run(_clear_prospect_log())
        _run(_set_pro(True))
        try:
            for i in range(4):
                r = client.get(f"{BASE_URL}/api/v2/prospecting/dpe", params={"sector": "Lyon"})
                assert r.status_code == 200, f"pro dpe #{i+1}: {r.status_code} {r.text}"
            for i in range(3):
                r = client.get(f"{BASE_URL}/api/v2/prospecting/listings", params={"sector": "Lyon"})
                assert r.status_code == 200, f"pro listings #{i+1}: {r.status_code} {r.text}"
        finally:
            _run(_set_pro(False))
            _run(_clear_prospect_log())


# ----------------------------------------------------------------------
# /api/v2/dashboard — new quota fields
# ----------------------------------------------------------------------
class TestDashboardQuotaFields:
    def test_dashboard_includes_prospecting_fields_free(self, client):
        _run(_reset_free_state())
        r = client.get(f"{BASE_URL}/api/v2/dashboard")
        assert r.status_code == 200, r.text
        d = r.json()
        for key in (
            "reminders_today", "notes_pending", "total_contacts", "has_pro",
            "free_contacts_limit", "free_contacts_left",
            "prospecting_used_today", "prospecting_limit_per_day", "prospecting_left_today",
        ):
            assert key in d, f"missing key {key} in dashboard: {d}"
        assert d["has_pro"] is False
        assert d["free_contacts_limit"] == 10
        assert d["prospecting_limit_per_day"] == 1
        assert d["prospecting_used_today"] == 0
        assert d["prospecting_left_today"] == 1

    def test_dashboard_pro_user_unlimited_fields(self, client):
        _run(_set_pro(True))
        try:
            r = client.get(f"{BASE_URL}/api/v2/dashboard")
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["has_pro"] is True
            assert d["free_contacts_limit"] is None
            assert d["prospecting_limit_per_day"] is None
            assert d["prospecting_left_today"] is None
        finally:
            _run(_set_pro(False))


# ----------------------------------------------------------------------
# Google Play IAP — unconfigured
# ----------------------------------------------------------------------
class TestGooglePlayIAP:
    def test_missing_fields_returns_400(self, client):
        r = client.post(f"{BASE_URL}/api/iap/verify-google-purchase", json={})
        assert r.status_code == 400, r.text
        assert "Missing product_id or purchase_token" in r.json().get("detail", "")

    def test_unconfigured_returns_500(self, client):
        r = client.post(
            f"{BASE_URL}/api/iap/verify-google-purchase",
            json={"product_id": "kolo_pro_monthly", "purchase_token": "dummytoken"},
        )
        # Endpoint deliberately not configured in preview
        assert r.status_code == 500, r.text
        assert "Google Play IAP not configured" in r.json().get("detail", "")


# ----------------------------------------------------------------------
# Apple IAP regression — endpoint still reachable, validates input
# ----------------------------------------------------------------------
class TestAppleIAPRegression:
    def test_apple_receipt_endpoint_exists(self, client):
        r = client.post(f"{BASE_URL}/api/iap/verify-apple-receipt", json={})
        # Either 400 (missing fields) or 422 (validation) — but NOT 404 nor 5xx unexpected
        assert r.status_code in (400, 401, 422, 500), r.text
        assert r.status_code != 404, "Apple IAP endpoint missing"
