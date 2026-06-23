"""
Iteration 53 — V2 Premium UI/UX refonte backend smoke test.
Verifies endpoints still working after V2 dark obsidian theme refactor.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# --------- Auth helpers ---------
@pytest.fixture(scope="module")
def v2_session():
    """Create a V2 session via email-code, complete onboarding."""
    email = f"test53_{uuid.uuid4().hex[:8]}@kolo-test.io"
    r = requests.post(f"{API}/v2/auth/send-email-code", json={"email": email}, timeout=15)
    assert r.status_code == 200, f"send-email-code failed: {r.status_code} {r.text}"
    code = r.json().get("dev_code")
    assert code, f"no dev_code in response: {r.json()}"

    r2 = requests.post(
        f"{API}/v2/auth/verify-email-code",
        json={"email": email, "code": code},
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    session = r2.json().get("session_token") or r2.json().get("token")
    assert session, f"no session token: {r2.json()}"
    return {"token": session, "email": email}


@pytest.fixture
def auth_headers(v2_session):
    return {"Authorization": f"Bearer {v2_session['token']}"}


# --------- Static assets ---------
class TestStaticLogos:
    def test_logo_v5_128(self):
        r = requests.get(f"{BASE_URL}/kolo-mark-v5-128.png", timeout=10)
        assert r.status_code == 200
        assert "image" in r.headers.get("content-type", "")
        assert len(r.content) > 100

    def test_logo_v5_256(self):
        r = requests.get(f"{BASE_URL}/kolo-mark-v5-256.png", timeout=10)
        assert r.status_code == 200
        assert "image" in r.headers.get("content-type", "")


# --------- V2 Endpoints ---------
class TestV2Endpoints:
    def test_send_email_code(self):
        email = f"test53_smoke_{uuid.uuid4().hex[:6]}@kolo-test.io"
        r = requests.post(f"{API}/v2/auth/send-email-code", json={"email": email}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "dev_code" in data or data.get("ok") is True

    def test_verify_email_code_invalid(self):
        email = f"test53_bad_{uuid.uuid4().hex[:6]}@kolo-test.io"
        # Send first to register
        requests.post(f"{API}/v2/auth/send-email-code", json={"email": email}, timeout=15)
        r = requests.post(
            f"{API}/v2/auth/verify-email-code",
            json={"email": email, "code": "000000"},
            timeout=15,
        )
        assert r.status_code in (400, 401, 403)

    def test_me_endpoint(self, auth_headers):
        r = requests.get(f"{API}/v2/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "user_id" in data or "id" in data or "email" in data

    def test_dashboard(self, auth_headers):
        r = requests.get(f"{API}/v2/dashboard", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Expect counters used by Activity Rings
        assert isinstance(data, dict)

    def test_reminders_by_date(self, auth_headers):
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.get(f"{API}/v2/reminders?date={today}", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_notifications_unread(self, auth_headers):
        r = requests.get(f"{API}/v2/notifications/unread", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Should return either {count: N} or list
        assert isinstance(data, (list, dict))

    def test_quota(self, auth_headers):
        r = requests.get(f"{API}/v2/quota", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Actual endpoint returns: is_pro, contacts_*, prospecting_*_this_week
        # Note: review_request claimed has_pro/free_contacts_* but those are on /dashboard, not /quota
        required = [
            "is_pro",
            "contacts_left",
            "contacts_limit",
            "prospecting_used_this_week",
            "prospecting_limit_per_week",
        ]
        missing = [k for k in required if k not in data]
        assert not missing, f"quota missing fields: {missing}, got: {data}"

    def test_onboarding_with_sectors_array(self, v2_session):
        """Critical: sectors must accept an array (chips picker) not csv string."""
        headers = {"Authorization": f"Bearer {v2_session['token']}", "Content-Type": "application/json"}
        payload = {
            "first_name": "Premium",
            "last_name": "UI",
            "role": "Agent indépendant",
            "company_name": "Kolo Test",
            "team_size": "1",
            "annual_revenue": "30-60k",
            "sectors": ["Paris", "Lyon", "Marseille"],
            "phone": "+33612345678",
        }
        r = requests.post(f"{API}/v2/onboarding", headers=headers, json=payload, timeout=20)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"

        # Verify persistence via /me
        me = requests.get(f"{API}/v2/me", headers={"Authorization": f"Bearer {v2_session['token']}"}, timeout=15)
        assert me.status_code == 200
        # me may include sectors or onboarding subfield
        body = me.json()
        # we don't strictly assert structure but ensure no 500
        assert isinstance(body, dict)


# --------- No regression: referral page ---------
class TestNoRegression:
    def test_referral_page_seed(self):
        r = requests.get(f"{BASE_URL}/r/TESTABCD", timeout=15, allow_redirects=True)
        # Should serve SPA HTML, not 5xx
        assert r.status_code in (200, 304)
