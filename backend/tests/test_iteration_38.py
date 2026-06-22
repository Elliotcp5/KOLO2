"""Iteration 38 — V2 Google Sign-in routing, Push V2, copy/tarif audit.
Tests:
- /api/v2/notifications/test-push (auth, with and without subscription)
- /api/v2/reminders POST today triggers push best-effort (no 500)
- /api/notifications/vapid-key (public, returns key)
- notification_scheduler.send_daily_reminders() aggregates V1+V2
- /api/auth/google/client-id (returns client_id+configured)
- /api/notifications/subscribe accepts V2 bearer token
"""
import os
import asyncio
import pytest
import requests
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Pre-seeded session (per request)
SEEDED_USER_ID = "u_227c821eafc54b53"
SEEDED_SESSION = "sess_ec7f64eac2c346648c7baf3afb7cff80"


# ----- helpers -----
def _new_email():
    return f"TEST_iter38_{uuid.uuid4().hex[:10]}@kolo.test"


@pytest.fixture(scope="module")
def fresh_v2_user():
    """Create a fresh V2 user via email-code, returns (session_token, user_id, email)."""
    email = _new_email()
    r = requests.post(f"{API}/v2/auth/send-email-code", json={"email": email}, timeout=15)
    assert r.status_code == 200, r.text
    code = r.json().get("dev_code")
    assert code, "dev_code missing"
    r2 = requests.post(
        f"{API}/v2/auth/verify-email-code",
        json={"email": email, "code": code, "first_name": "Iter38"},
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    j = r2.json()
    return {"token": j["session_token"], "user_id": j["user_id"], "email": email}


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# =========================================================
# 1. VAPID public key
# =========================================================
def test_vapid_public_key():
    r = requests.get(f"{API}/notifications/vapid-key", timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "vapid_public_key" in data
    assert isinstance(data["vapid_public_key"], str)
    assert len(data["vapid_public_key"]) > 20


# =========================================================
# 2. Google client-id (V1, reused by V2)
# =========================================================
def test_google_client_id():
    r = requests.get(f"{API}/auth/google/client-id", timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "client_id" in data
    assert "configured" in data
    assert data["configured"] is True
    assert data["client_id"]


# =========================================================
# 3. V2 test-push without subscription -> 404
# =========================================================
def test_v2_test_push_no_subscription(fresh_v2_user):
    r = requests.post(
        f"{API}/v2/notifications/test-push",
        headers=_auth_headers(fresh_v2_user["token"]),
        timeout=10,
    )
    assert r.status_code == 404, r.text
    assert "abonnement" in r.json().get("detail", "").lower() or "subscription" in r.text.lower()


# =========================================================
# 4. V2 test-push WITH (seeded) subscription -> sent:true
# =========================================================
def test_v2_test_push_with_subscription():
    r = requests.post(
        f"{API}/v2/notifications/test-push",
        headers=_auth_headers(SEEDED_SESSION),
        timeout=15,
    )
    # The seeded user has a test.push.com endpoint which is skipped intentionally returning True
    assert r.status_code == 200, f"Unexpected: {r.status_code} {r.text}"
    data = r.json()
    assert "sent" in data
    assert data["sent"] is True


# =========================================================
# 5. /api/v2/reminders POST today: never 500, triggers push best-effort
# =========================================================
def test_v2_reminder_today_no_500(fresh_v2_user):
    today = datetime.now(timezone.utc).date().isoformat()
    r = requests.post(
        f"{API}/v2/reminders",
        headers=_auth_headers(fresh_v2_user["token"]),
        json={"title": "TEST_iter38 reminder", "date": today},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "reminder_id" in data
    assert data["title"] == "TEST_iter38 reminder"
    assert data["date"] == today


def test_v2_reminder_today_with_subscription_no_500():
    today = datetime.now(timezone.utc).date().isoformat()
    r = requests.post(
        f"{API}/v2/reminders",
        headers=_auth_headers(SEEDED_SESSION),
        json={"title": "TEST_iter38 reminder seeded", "date": today},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    assert "reminder_id" in r.json()


# =========================================================
# 6. /api/notifications/subscribe accepts V2 bearer
# =========================================================
def test_v2_bearer_works_with_notifications_subscribe(fresh_v2_user):
    fake_sub = {
        "endpoint": "https://test.push.com/iter38",
        "keys": {"p256dh": "x" * 60, "auth": "y" * 22},
        "expirationTime": None,
    }
    r = requests.post(
        f"{API}/notifications/subscribe",
        headers=_auth_headers(fresh_v2_user["token"]),
        json={"subscription": fake_sub, "user_id": fresh_v2_user["user_id"]},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert "saved" in r.text.lower() or r.json().get("message")


# =========================================================
# 7. notification_scheduler.send_daily_reminders aggregates V1+V2
# =========================================================
def test_scheduler_aggregates_v1_v2():
    """Call send_daily_reminders directly and verify it picks up v2_reminders for today."""
    import sys
    sys.path.insert(0, "/app/backend")
    # Reload-safe import
    from notification_scheduler import send_daily_reminders, db as sched_db  # type: ignore

    async def _run():
        today = datetime.now(timezone.utc).date().isoformat()
        # Insert a one-off v2 reminder for the seeded user today
        await sched_db.v2_reminders.insert_one({
            "reminder_id": f"rem_TEST_{uuid.uuid4().hex[:10]}",
            "user_id": SEEDED_USER_ID,
            "title": "TEST_iter38 scheduler",
            "date": today,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        result = await send_daily_reminders()
        # cleanup test rem
        await sched_db.v2_reminders.delete_many({"title": "TEST_iter38 scheduler"})
        return result

    result = asyncio.run(_run())
    # Should return dict with sent/failed/no_subscription
    assert isinstance(result, dict)
    assert "sent" in result and "failed" in result and "no_subscription" in result
    # Seeded user has a subscription (skipped test.push.com -> sent True),
    # so at least 1 sent expected (could be more if other users also have today reminders).
    assert result["sent"] >= 1, f"Expected at least 1 sent, got {result}"


# =========================================================
# Cleanup: best-effort delete the TEST_iter38 reminders
# =========================================================
def test_cleanup_reminders(fresh_v2_user):
    # List then delete those starting with TEST_iter38
    r = requests.get(
        f"{API}/v2/reminders",
        headers=_auth_headers(fresh_v2_user["token"]),
        timeout=10,
    )
    assert r.status_code == 200
    for item in r.json().get("items", []):
        if item.get("title", "").startswith("TEST_iter38"):
            requests.delete(
                f"{API}/v2/reminders/{item['reminder_id']}",
                headers=_auth_headers(fresh_v2_user["token"]),
                timeout=10,
            )
    # Same for seeded
    r2 = requests.get(
        f"{API}/v2/reminders",
        headers=_auth_headers(SEEDED_SESSION),
        timeout=10,
    )
    if r2.status_code == 200:
        for item in r2.json().get("items", []):
            if item.get("title", "").startswith("TEST_iter38"):
                requests.delete(
                    f"{API}/v2/reminders/{item['reminder_id']}",
                    headers=_auth_headers(SEEDED_SESSION),
                    timeout=10,
                )
