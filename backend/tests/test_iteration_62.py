"""
Iteration 62 — ADMIN_SECRET rotation + /api/ingest/apify run_ids behaviour
=========================================================================
Modules covered:
- server.py  POST /api/ingest/apify  (secret gating, run_ids param)
- server.py  admin endpoints (/api/admin/sync-subscription,
  /api/admin/enterprise-leads, /api/admin/grant-plan-by-email)
- v2_router._ingest_apify_handler
- kolo_dashboard.py dashboard endpoints (JWT) — regression smoke
"""
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")

base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

ADMIN_SECRET = (backend_env.get("ADMIN_SECRET") or "").strip()
OLD_SECRET = "kolo_admin_2026"
WRONG_SECRET = "totally-random-wrong-secret-xyz-123"

INGEST = f"{BASE_URL}/api/ingest/apify"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------------------------------------------------------- secret leak
class TestSecretRotation:
    def test_admin_secret_present_and_strong(self):
        assert ADMIN_SECRET, "ADMIN_SECRET missing from /app/backend/.env"
        assert ADMIN_SECRET != OLD_SECRET
        assert len(ADMIN_SECRET) >= 24

    def test_no_hardcoded_default_in_codebase(self):
        import subprocess
        out = subprocess.run(
            ["grep", "-rn", OLD_SECRET, "/app/backend", "--include=*.py"],
            capture_output=True, text=True,
        ).stdout
        # our own test file references it; filter it out
        leaks = [l for l in out.splitlines() if "test_iteration_62" not in l]
        assert not leaks, f"hardcoded old secret still present: {leaks}"

    def test_ingest_rejects_old_secret_header(self, client):
        r = client.post(INGEST, headers={"X-Admin-Secret": OLD_SECRET}, json={})
        assert r.status_code == 401, r.text[:300]

    def test_ingest_rejects_old_secret_body(self, client):
        r = client.post(INGEST, json={"admin_key": OLD_SECRET})
        assert r.status_code == 401, r.text[:300]

    def test_ingest_rejects_wrong_secret(self, client):
        r = client.post(INGEST, headers={"X-Admin-Secret": WRONG_SECRET}, json={})
        assert r.status_code == 401, r.text[:300]

    def test_ingest_rejects_missing_secret(self, client):
        r = client.post(INGEST, json={})
        assert r.status_code == 401, r.text[:300]


# --------------------------------------------------- other admin endpoints
class TestOtherAdminEndpoints:
    def test_sync_subscription_rejects_old_secret(self, client):
        r = client.post(f"{BASE_URL}/api/admin/sync-subscription",
                        json={"admin_key": OLD_SECRET, "email": "nobody@example.test"})
        assert r.status_code == 401, r.text[:300]

    def test_enterprise_leads_rejects_old_secret(self, client):
        r = client.get(f"{BASE_URL}/api/admin/enterprise-leads",
                       params={"admin_key": OLD_SECRET})
        assert r.status_code == 401, r.text[:300]

    def test_enterprise_leads_accepts_new_secret(self, client):
        r = client.get(f"{BASE_URL}/api/admin/enterprise-leads",
                       params={"admin_key": ADMIN_SECRET})
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, (dict, list))

    def test_grant_plan_by_email_rejects_old_secret(self, client):
        r = client.post(f"{BASE_URL}/api/admin/grant-plan-by-email",
                        headers={"X-Admin-Secret": OLD_SECRET},
                        json={"email": "nobody@example.test", "plan": "pro"})
        assert r.status_code == 401, r.text[:300]

    def test_grant_plan_by_email_new_secret_not_401(self, client):
        """New secret must pass the auth gate (may 404 on unknown user)."""
        r = client.post(f"{BASE_URL}/api/admin/grant-plan-by-email",
                        headers={"X-Admin-Secret": ADMIN_SECRET},
                        json={"email": "TEST_nonexistent_qa@example.test", "plan": "pro"})
        assert r.status_code != 401, r.text[:300]
        assert r.status_code in (200, 400, 404, 422), f"{r.status_code} {r.text[:300]}"


# ------------------------------------------------------------- run_ids path
class TestIngestRunIds:
    def test_fake_run_id_returns_run_not_found(self, client):
        r = client.post(INGEST, headers={"X-Admin-Secret": ADMIN_SECRET},
                        json={"run_ids": ["FAKE_RUN_ID_QA_0001"]})
        assert r.status_code == 200, r.text[:500]
        data = r.json()
        runs = data.get("runs")
        assert isinstance(runs, list) and len(runs) == 1, data
        entry = runs[0]
        assert entry.get("error") == "run_not_found" or entry.get("skipped") is True, entry
        # No work done
        assert data.get("inserted") == 0
        assert data.get("updated") == 0
        assert data.get("deactivated") == 0
        assert data.get("items_fetched") == 0
        assert data.get("runs_total") == 1
        assert data.get("runs_clean") == 0

    def test_empty_run_ids_falls_back_to_latest(self, client):
        """run_ids=[] is falsy → must use the latest-SUCCEEDED fallback."""
        r = client.post(INGEST, headers={"X-Admin-Secret": ADMIN_SECRET},
                        json={"run_ids": []})
        assert r.status_code == 200, r.text[:500]
        data = r.json()
        assert data.get("error") != "no_run_ids", data
        assert data.get("runs_total") == 1, data

    def test_stale_hours_is_echoed_and_clamped(self, client):
        r = client.post(INGEST, headers={"X-Admin-Secret": ADMIN_SECRET},
                        json={"run_ids": ["FAKE_RUN_ID_QA_0002"], "stale_hours": 5000})
        assert r.status_code == 200, r.text[:500]
        assert r.json().get("stale_hours") == 720


# -------------------------------------------------------- latest run ingest
class TestIngestLatestRun:
    def test_latest_run_ingest_full_counters(self, client):
        r = client.post(INGEST, headers={"X-Admin-Secret": ADMIN_SECRET},
                        json={}, timeout=300)
        assert r.status_code == 200, r.text[:500]
        data = r.json()
        for key in ("inserted", "updated", "deactivated", "items_fetched",
                    "runs_total", "runs_clean", "stale_hours"):
            assert key in data, f"missing key {key} in {data}"
            assert isinstance(data[key], int), f"{key} not int: {data[key]!r}"
        assert data["items_fetched"] > 0, f"no items fetched: {data}"
        assert data["runs_total"] == 1
        runs = data.get("runs") or []
        assert len(runs) == 1
        assert runs[0].get("status") == "SUCCEEDED"
        assert "_id" not in data

    def test_latest_run_accepts_body_admin_key(self, client):
        r = client.post(INGEST, json={"admin_key": ADMIN_SECRET,
                                      "run_ids": ["FAKE_RUN_ID_QA_0003"]},
                        timeout=120)
        assert r.status_code == 200, r.text[:500]
        assert r.json().get("runs_total") == 1


# --------------------------------------------------- dashboard regression
DASH_CANDIDATES = [
    ("elliot.cohenpressard@trykolo.io", "Psychologue94340!"),
    ("elliot.cohenpressard@trykolo.io", "Psychologue75007%!"),
]


@pytest.fixture(scope="session")
def dash_token(client):
    last = None
    for email, pwd in DASH_CANDIDATES:
        r = client.post(f"{BASE_URL}/api/dashboard/login",
                        json={"email": email, "password": pwd})
        last = r
        if r.status_code == 200:
            tok = (r.json() or {}).get("token") or (r.json() or {}).get("access_token")
            if tok:
                return tok
    pytest.fail(f"dashboard login failed for all credentials: "
                f"{last.status_code} {last.text[:300]}")


class TestDashboardRegression:
    def test_login_returns_jwt(self, dash_token):
        assert isinstance(dash_token, str) and dash_token.count(".") == 2

    def test_summary(self, client, dash_token):
        r = client.get(f"{BASE_URL}/api/dashboard/summary",
                       headers={"Authorization": f"Bearer {dash_token}"})
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json(), dict)

    def test_users_list(self, client, dash_token):
        r = client.get(f"{BASE_URL}/api/dashboard/users",
                       params={"limit": 5},
                       headers={"Authorization": f"Bearer {dash_token}"})
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, dict)
        users = data.get("users") if isinstance(data, dict) else data
        assert isinstance(users, list)
        assert len(users) <= 5
        for u in users:
            assert "_id" not in u

    def test_summary_requires_auth(self, client):
        r = client.get(f"{BASE_URL}/api/dashboard/summary")
        assert r.status_code in (401, 403), r.status_code


# ------------------------------- unit: _run_is_clean limit gating (bug #2)
import sys
sys.path.insert(0, "/app/backend")
os.environ.setdefault("APIFY_API_TOKEN", backend_env.get("APIFY_API_TOKEN") or "x")
from scripts.ingest_apify import _run_is_clean, _extract_input_postal_codes  # noqa: E402


class TestRunIsCleanGating:
    def test_non_succeeded_is_not_clean(self):
        clean, reason = _run_is_clean({"status": "ABORTED"})
        assert clean is False
        assert "ABORTED" in reason

    def test_status_message_limit_hint_not_clean(self):
        clean, _ = _run_is_clean({"status": "SUCCEEDED",
                                  "statusMessage": "Run aborted: cost limit reached"})
        assert clean is False

    def test_max_items_reached_not_clean(self):
        clean, _ = _run_is_clean({"status": "SUCCEEDED",
                                  "options": {"maxItems": 1000},
                                  "stats": {"datasetItemCount": 1000}})
        assert clean is False

    def test_cost_cap_reached_apify_shape_not_clean(self):
        """Apify exposes the spend as top-level `usageTotalUsd` (and `usage`
        is often null). A run that burnt its full maxTotalChargeUsd must NOT
        be allowed to deactivate listings."""
        run = {
            "id": "ii2w67N4BPGlfIgMQ",
            "status": "SUCCEEDED",
            "statusMessage": None,
            "usage": None,
            "usageTotalUsd": 10,
            "options": {"maxTotalChargeUsd": 10, "isMaxTotalChargeUsdSetByUser": True,
                        "maxItems": None},
            "stats": {"datasetItemCount": 1608},
        }
        clean, reason = _run_is_clean(run)
        assert clean is False, f"cost-capped run wrongly considered clean ({reason})"

    def test_clean_run_is_clean(self):
        clean, reason = _run_is_clean({"status": "SUCCEEDED", "statusMessage": None,
                                       "options": {"maxTotalChargeUsd": 10},
                                       "usageTotalUsd": 1.2,
                                       "stats": {"datasetItemCount": 500}})
        assert clean is True, reason

    def test_input_postal_codes_extraction(self):
        assert _extract_input_postal_codes(
            {"input": {"postalCodes": ["75001", "75001", "9400", "94340", "abcde"]}}
        ) == ["75001", "94340"]
        assert _extract_input_postal_codes({"input": None}) == []
