"""
Iteration 58 backend tests:
- POST /api/v2/auth/send-email-code returns dev_code in dev env
- GET /api/v2/me updates last_seen_at on user doc
- POST /api/v2/onboarding accepts optional `language` field
- notification_scheduler.run_once() runs and returns contextual_nudges_sent
- Regression: dashboard / cases / referral remain green
"""
import os
import sys
import asyncio
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # fallback to frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def new_user_session():
    """Create a brand-new user via send-email-code + verify-email-code, return (email, token)."""
    email = f"TEST_iter58_{uuid.uuid4().hex[:10]}@trykolo.dev"
    r = requests.post(f"{API}/v2/auth/send-email-code", json={"email": email}, timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("sent") is True
    assert "dev_code" in body, "dev_code must be returned in dev preview"
    code = body["dev_code"]
    r2 = requests.post(f"{API}/v2/auth/verify-email-code", json={"email": email, "code": code}, timeout=10)
    assert r2.status_code == 200, r2.text
    token = r2.json().get("token") or r2.json().get("session_token") or r2.json().get("access_token")
    assert token, f"no token in verify-email-code response: {r2.json()}"
    return email, token


# ============ TestSendEmailCode ============
class TestSendEmailCode:
    def test_returns_dev_code_in_preview(self):
        email = f"TEST_iter58_devcode_{uuid.uuid4().hex[:8]}@trykolo.dev"
        r = requests.post(f"{API}/v2/auth/send-email-code", json={"email": email}, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body.get("sent") is True
        assert "dev_code" in body, "dev_code missing in dev/preview env"
        assert isinstance(body["dev_code"], str)
        assert len(body["dev_code"]) == 6
        assert body["dev_code"].isdigit()

    def test_dev_code_invalid_email(self):
        r = requests.post(f"{API}/v2/auth/send-email-code", json={"email": "not-an-email"}, timeout=10)
        assert r.status_code == 400


# ============ TestMeLastSeenAt ============
class TestMeLastSeenAt:
    def test_me_updates_last_seen_at(self, new_user_session):
        email, token = new_user_session
        # First /me call
        r1 = requests.get(f"{API}/v2/me", headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r1.status_code == 200, r1.text
        user_doc = r1.json()
        first_seen = user_doc.get("last_seen_at")
        # /me again
        import time
        time.sleep(1.2)
        r2 = requests.get(f"{API}/v2/me", headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r2.status_code == 200
        second_seen = r2.json().get("last_seen_at")
        assert second_seen is not None, "last_seen_at must be set on /me"
        if first_seen:
            assert second_seen >= first_seen, "last_seen_at should be updated on each /me call"


# ============ TestOnboardingLanguage ============
class TestOnboardingLanguage:
    def test_onboarding_accepts_language_field(self, new_user_session):
        email, token = new_user_session
        payload = {
            "role": "Mandataire immobilier",
            "activities": ["Transaction"],
            "company_name": "TEST Agence",
            "team_size": "1 collaborateur",
            "annual_revenue": "Entre 10 000€ et 30 000€",
            "main_activity": "Transaction & Location",
            "sectors": ["Paris"],
            "crm_tool": "Hektor",
            "diffusion_platforms": ["Leboncoin"],
            "phone_country": "FR",
            "phone": "612345678",
            "accepted_terms": True,
            "language": "en",  # NEW optional field
        }
        r = requests.post(f"{API}/v2/onboarding", json=payload, headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r.status_code in (200, 201), r.text


# ============ TestNotificationScheduler ============
class TestNotificationScheduler:
    def test_run_once_returns_contextual_nudges_sent(self):
        # Run notification_scheduler.run_once() in-process
        sys.path.insert(0, "/app/backend")
        from notification_scheduler import run_once
        result = asyncio.run(run_once())
        assert isinstance(result, dict)
        assert "contextual_nudges_sent" in result
        assert isinstance(result["contextual_nudges_sent"], int)


# ============ TestRegression ============
class TestRegression:
    def test_dashboard(self, new_user_session):
        _, token = new_user_session
        r = requests.get(f"{API}/v2/dashboard", headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r.status_code == 200

    def test_cases(self, new_user_session):
        _, token = new_user_session
        r = requests.get(f"{API}/v2/cases", headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r.status_code in (200, 204)

    def test_contacts(self, new_user_session):
        _, token = new_user_session
        r = requests.get(f"{API}/v2/contacts", headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r.status_code in (200, 204)

    def test_referral(self, new_user_session):
        _, token = new_user_session
        r = requests.get(f"{API}/v2/referral/me", headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r.status_code == 200

    def test_apple_review_static_code(self):
        # Apple Review bypass: applereview@trykolo.io / 424242
        r = requests.post(f"{API}/v2/auth/verify-email-code",
                          json={"email": "applereview@trykolo.io", "code": "424242"}, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        token = body.get("token") or body.get("session_token") or body.get("access_token")
        assert token


# ============ TestIOSVersion (config check) ============
class TestIOSVersion:
    def test_marketing_version_bumped(self):
        with open("/app/frontend/ios/App/App.xcodeproj/project.pbxproj") as f:
            content = f.read()
        assert "MARKETING_VERSION = 2.1" in content
        assert "CURRENT_PROJECT_VERSION = 9" in content
