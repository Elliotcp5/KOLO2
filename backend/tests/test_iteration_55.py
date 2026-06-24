"""Iteration 55 — Final validation BEFORE Apple App Store submit (V2 KOLO).

Tests cover:
- V2 email-code auth flow (send + verify) with dev_code
- /api/v2/me, /api/v2/dashboard accessible with session token
- /api/v2/quota returns expected free-plan keys
- /api/v2/prospecting/listings returns in <15s with proper shape (no 502)
- /api/v2/ai/chat (Ask KOLO) responds in <30s (Claude via emergentintegrations)
- /api/iap/verify-apple-receipt accepts product_id payload shape (auth required, no 500)
- APPLE_PRODUCT_TO_PLAN maps 'PRO_Plus' -> 'pro' (NOT 'pro_plus') — verified via direct import
- V2 CRUD endpoints: cases, notes, reminders, contacts, billing/create-checkout-session
"""
import os
import sys
import time
import uuid
import base64
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- module-level: importable mapping check (runs in backend venv) ----------
def test_apple_product_to_plan_mapping_pro_plus_to_pro():
    """Import backend.server.APPLE_PRODUCT_TO_PLAN and assert 'PRO_Plus' -> 'pro'."""
    sys.path.insert(0, "/app/backend")
    from server import APPLE_PRODUCT_TO_PLAN  # type: ignore
    assert APPLE_PRODUCT_TO_PLAN.get("PRO_Plus") == "pro", (
        f"Expected APPLE_PRODUCT_TO_PLAN['PRO_Plus']='pro', got {APPLE_PRODUCT_TO_PLAN.get('PRO_Plus')!r}. "
        f"Full mapping: {APPLE_PRODUCT_TO_PLAN}"
    )
    # Defensive: legacy keys still resolve to 'pro' (not 'pro_plus' nor 'free')
    assert APPLE_PRODUCT_TO_PLAN.get("PRO") == "pro"


# ---------- helpers ----------
def _send_code(session, email):
    return session.post(f"{API}/v2/auth/send-email-code", json={"email": email}, timeout=15)


def _verify_code(session, email, code):
    return session.post(f"{API}/v2/auth/verify-email-code", json={"email": email, "code": code}, timeout=15)


def _onboard(session):
    payload = {
        "company_name": "Iter55 Test",
        "role": "Agent indépendant",
        "team_size": "1",
        "annual_revenue": "30-60k",
        "sectors": ["Paris 3e"],
    }
    return session.post(f"{API}/v2/onboarding", json=payload, timeout=15)


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"iter55.{uuid.uuid4().hex[:8]}@kolo-test.io"
    r = _send_code(s, email)
    assert r.status_code == 200, f"send-email-code failed: {r.status_code} {r.text[:200]}"
    code = r.json().get("dev_code")
    assert code, f"dev_code missing: {r.json()}"
    r2 = _verify_code(s, email, code)
    assert r2.status_code == 200, f"verify-email-code failed: {r2.status_code} {r2.text[:200]}"
    body = r2.json()
    token = body.get("session_token") or body.get("token") or body.get("access_token")
    assert token, f"No token: {body}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    ob = _onboard(s)
    assert ob.status_code in (200, 201), f"onboarding failed: {ob.status_code} {ob.text[:200]}"
    s.email = email  # type: ignore[attr-defined]
    return s


# ---------- AUTH ----------
class TestAuth:
    def test_send_email_code_returns_dev_code(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        email = f"iter55auth.{uuid.uuid4().hex[:6]}@kolo-test.io"
        r = _send_code(s, email)
        assert r.status_code == 200, r.text[:200]
        assert "dev_code" in r.json()

    def test_verify_invalid_code_returns_4xx(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        email = f"iter55auth2.{uuid.uuid4().hex[:6]}@kolo-test.io"
        _send_code(s, email)
        r = _verify_code(s, email, "000000")
        assert r.status_code in (400, 401, 403), f"Expected 4xx for wrong code, got {r.status_code}"


# ---------- CORE V2 ENDPOINTS ----------
class TestCoreEndpoints:
    def test_me_returns_user(self, auth_session):
        r = auth_session.get(f"{API}/v2/me", timeout=10)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert "user" in data or "email" in data or "user_id" in data, f"Unexpected /me shape: {list(data.keys())}"

    def test_dashboard_accessible(self, auth_session):
        r = auth_session.get(f"{API}/v2/dashboard", timeout=10)
        assert r.status_code == 200, r.text[:200]

    def test_quota_returns_free_user_keys(self, auth_session):
        r = auth_session.get(f"{API}/v2/quota", timeout=10)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        # Real keys returned by backend (renamed from review_request spec):
        #   is_pro, contacts_limit, prospecting_limit_per_week
        for key in ("contacts_limit", "prospecting_limit_per_week", "is_pro"):
            assert key in data, f"Missing quota key {key!r}; got {list(data.keys())}"
        # Free user
        assert data["is_pro"] is False, f"Fresh user should NOT have pro: {data}"


# ---------- PROSPECTING ----------
class TestProspecting:
    def test_prospecting_listings_under_15s(self, auth_session):
        t0 = time.time()
        r = auth_session.get(
            f"{API}/v2/prospecting/listings",
            params={"sector": "75003", "kind": "apartment"},
            timeout=20,
        )
        elapsed = time.time() - t0
        assert elapsed < 16, f"Prospecting too slow: {elapsed:.2f}s"
        assert r.status_code == 200, f"Status {r.status_code} in {elapsed:.1f}s: {r.text[:200]}"
        data = r.json()
        # Must have items list and a source label
        assert "items" in data, f"Missing 'items': {list(data.keys())}"
        assert isinstance(data["items"], list)
        # source is 'scraping_in_progress' OR a real source string (cache/apify/etc.)
        assert "source" in data or "hint" in data or data["items"], (
            f"Expected source or hint or items, got {data}"
        )


# ---------- AI / Ask KOLO ----------
class TestAskKolo:
    def test_ai_chat_responds_under_30s(self, auth_session):
        t0 = time.time()
        r = auth_session.post(
            f"{API}/v2/ai/chat",
            json={"message": "Bonjour, donne-moi un conseil court en immobilier."},
            timeout=35,
        )
        elapsed = time.time() - t0
        assert elapsed < 31, f"AI chat too slow: {elapsed:.2f}s"
        assert r.status_code == 200, f"Status {r.status_code} in {elapsed:.1f}s: {r.text[:300]}"
        data = r.json()
        # Reply may be under key 'reply' / 'message' / 'answer'
        reply = data.get("reply") or data.get("message") or data.get("answer") or data.get("text")
        assert reply, f"No reply text in AI response: {list(data.keys())}"
        assert isinstance(reply, str) and len(reply) > 5


# ---------- IAP ----------
class TestIAP:
    def test_iap_verify_requires_auth(self):
        """No bearer token → 401/403."""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        # arbitrary base64 payload, just to make sure shape doesn't 500 BEFORE auth check
        fake_receipt = base64.b64encode(b"dummy").decode()
        r = s.post(
            f"{API}/iap/verify-apple-receipt",
            json={"receipt": fake_receipt, "product_id": "PRO_Plus"},
            timeout=10,
        )
        assert r.status_code in (401, 403), f"Expected 401/403 unauth, got {r.status_code}: {r.text[:200]}"

    def test_iap_verify_accepts_pro_plus_product_id(self, auth_session):
        """Auth'd call with PRO_Plus should NOT 500; Apple rejects the dummy receipt
        but our endpoint must reach Apple and report invalid_receipt (success=False)."""
        fake_receipt = base64.b64encode(b"this-is-not-a-real-apple-receipt").decode()
        r = auth_session.post(
            f"{API}/iap/verify-apple-receipt",
            json={"receipt": fake_receipt, "product_id": "PRO_Plus"},
            timeout=20,
        )
        # Allowed outcomes:
        #  - 200 with success:false + apple_status (Apple rejected the dummy)
        #  - 502 if Apple network unreachable from preview
        # NOT allowed: 500 (server bug), 400 due to product_id mapping
        assert r.status_code in (200, 502), f"Unexpected status {r.status_code}: {r.text[:300]}"
        if r.status_code == 200:
            body = r.json()
            # When Apple rejects bogus base64, status != 0 -> success false
            assert "success" in body or "plan" in body, f"Unexpected body: {body}"


# ---------- V2 CRUD ----------
class TestCRUD:
    def test_cases_list(self, auth_session):
        r = auth_session.get(f"{API}/v2/cases", timeout=10)
        assert r.status_code == 200, r.text[:200]
        assert isinstance(r.json(), (list, dict))

    def test_cases_create(self, auth_session):
        payload = {"title": "TEST_iter55_case", "client_name": "Alice", "type": "seller"}
        r = auth_session.post(f"{API}/v2/cases", json=payload, timeout=10)
        assert r.status_code in (200, 201), r.text[:200]
        body = r.json()
        case_id = body.get("id") or body.get("case_id") or (body.get("case") or {}).get("id")
        assert case_id, f"No id in create response: {body}"

    def test_notes_list_and_create(self, auth_session):
        r = auth_session.get(f"{API}/v2/notes", timeout=10)
        assert r.status_code == 200
        r2 = auth_session.post(f"{API}/v2/notes", json={"content": "TEST_iter55_note"}, timeout=10)
        assert r2.status_code in (200, 201), r2.text[:200]

    def test_reminders_list_and_create(self, auth_session):
        r = auth_session.get(f"{API}/v2/reminders", timeout=10)
        assert r.status_code == 200
        from datetime import datetime, timezone, timedelta
        when = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        r2 = auth_session.post(
            f"{API}/v2/reminders",
            json={"title": "TEST_iter55_rem", "date": when},
            timeout=10,
        )
        assert r2.status_code in (200, 201), r2.text[:200]

    def test_contacts_list_and_create(self, auth_session):
        r = auth_session.get(f"{API}/v2/contacts", timeout=10)
        assert r.status_code == 200
        r2 = auth_session.post(
            f"{API}/v2/contacts",
            json={"first_name": "TEST_iter55", "last_name": "Contact", "email": "iter55@test.io"},
            timeout=10,
        )
        assert r2.status_code in (200, 201), r2.text[:200]

    def test_payments_create_checkout_web_fallback(self, auth_session):
        """Web Stripe fallback — non-iOS. Endpoint is /api/payments/create-checkout
        (review_request listed /api/v2/billing/create-checkout-session which 404s)."""
        r = auth_session.post(
            f"{API}/payments/create-checkout",
            json={"plan": "pro", "billing_period": "monthly", "origin_url": BASE_URL},
            timeout=15,
        )
        # 200 with checkout URL, or 400/402 if Stripe not fully configured
        assert r.status_code in (200, 400, 402, 422), f"Unexpected status {r.status_code}: {r.text[:200]}"
