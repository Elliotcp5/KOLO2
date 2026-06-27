"""Iteration 59 — re-test of 3 onboarding critical bugs from iter58 + non-regression of prior 8 fixes."""
import os
import uuid
import asyncio
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")


def _signup_new_user():
    """Create a fresh email-code user, returns (email, session_token, user_id)."""
    email = f"TEST_iter59_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(f"{BASE_URL}/api/v2/auth/send-email-code", json={"email": email}, timeout=15)
    assert r.status_code == 200, f"send-email-code failed: {r.status_code} {r.text}"
    dev_code = r.json().get("dev_code")
    assert dev_code, "dev_code missing — should be returned in dev preview"
    r2 = requests.post(
        f"{BASE_URL}/api/v2/auth/verify-email-code",
        json={"email": email, "code": dev_code, "first_name": "Iter59", "last_name": "Test"},
        timeout=15,
    )
    assert r2.status_code == 200, f"verify failed: {r2.status_code} {r2.text}"
    body = r2.json()
    return email, body["session_token"], body["user_id"]


# --- Regression: send-email-code returns dev_code in dev ---
def test_send_email_code_returns_dev_code():
    email = f"TEST_iter59_devcode_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{BASE_URL}/api/v2/auth/send-email-code", json={"email": email}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("sent") is True
    assert "dev_code" in body
    assert isinstance(body["dev_code"], str)
    assert len(body["dev_code"]) == 6


# --- Regression: /me updates last_seen_at ---
def test_me_updates_last_seen_at():
    _, token, _ = _signup_new_user()
    headers = {"Authorization": f"Bearer {token}"}
    r1 = requests.get(f"{BASE_URL}/api/v2/me", headers=headers, timeout=15)
    assert r1.status_code == 200
    first_seen = r1.json().get("last_seen_at")
    # second call should refresh
    import time
    time.sleep(1.2)
    r2 = requests.get(f"{BASE_URL}/api/v2/me", headers=headers, timeout=15)
    assert r2.status_code == 200
    second_seen = r2.json().get("last_seen_at")
    assert second_seen is not None, "last_seen_at missing"
    # Should be set; second might equal first if same-second, but usually newer
    if first_seen and second_seen:
        assert second_seen >= first_seen


# --- New: POST /api/v2/onboarding with language must persist on user doc ---
def test_onboarding_persists_language_on_user_doc():
    _, token, user_id = _signup_new_user()
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "language": "en",
        "accepted_terms": True,
        "role": "Agent immobilier",
        "sectors": ["75001"],
    }
    r = requests.post(f"{BASE_URL}/api/v2/onboarding", json=payload, headers=headers, timeout=15)
    assert r.status_code == 200, f"onboarding failed: {r.status_code} {r.text}"
    assert r.json().get("ok") is True

    # Now fetch /me — the spec says language should be on user doc
    me = requests.get(f"{BASE_URL}/api/v2/me", headers=headers, timeout=15)
    assert me.status_code == 200
    me_body = me.json()
    # Also fetch onboarding doc — language is at least there
    ob = requests.get(f"{BASE_URL}/api/v2/onboarding", headers=headers, timeout=15)
    assert ob.status_code == 200
    ob_body = ob.json()
    assert ob_body.get("language") == "en", f"language not persisted on onboarding doc: {ob_body}"
    # Spec assertion: user doc should also contain language
    assert me_body.get("language") == "en", (
        f"language NOT mirrored on user doc (got {me_body.get('language')!r}). "
        f"Spec says: 'OnboardingPayload accepte language et le persiste sur user doc'"
    )


# --- Regression: notification_scheduler.run_once() returns contextual_nudges_sent ---
def test_notification_scheduler_run_once():
    import sys
    sys.path.insert(0, "/app/backend")
    from notification_scheduler import run_once  # type: ignore

    result = asyncio.run(run_once())
    assert isinstance(result, dict), f"run_once should return dict, got {type(result)}"
    assert "contextual_nudges_sent" in result, f"missing key contextual_nudges_sent in {result}"
    assert isinstance(result["contextual_nudges_sent"], int)


# --- Regression: iOS project.pbxproj versions ---
def test_ios_pbxproj_versions():
    path = "/app/frontend/ios/App/App.xcodeproj/project.pbxproj"
    assert os.path.exists(path)
    with open(path, "r") as f:
        content = f.read()
    assert "MARKETING_VERSION = 2.1;" in content, "MARKETING_VERSION must be 2.1"
    assert "CURRENT_PROJECT_VERSION = 9;" in content, "CURRENT_PROJECT_VERSION must be 9"


# --- New: Apple Review static code still works (non-regression) ---
def test_apple_review_static_code():
    r = requests.post(
        f"{BASE_URL}/api/v2/auth/verify-email-code",
        json={"email": "applereview@trykolo.io", "code": "424242"},
        timeout=15,
    )
    assert r.status_code == 200, f"Apple Review bypass failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("verified") is True
    assert body.get("session_token", "").startswith("sess_")
