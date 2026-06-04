"""
Iteration 31 — Backend regression tests for 4 enhancements:
  1. Weekly report email contains FRONTEND_URL (https://trykolo.io/app) instead of broken kolo.app/app
  2. POST /api/prospects/{id}/mark-sold accepts new {commission_initial, commission_final}
     and remains backward compatible with {commission_amount}
  3. PUT /api/prospects/{id} accepts new status 'offre_acceptee'
  4. _send_weekly_report_for_user helper exists (refactor) and POST /api/reports/weekly still 200
"""

import os
import re
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
SUPER_ADMIN_EMAIL = "elliot.cohenpressard@trykolo.io"
SUPER_ADMIN_PASSWORD = "Psychologue75007%!"


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"super admin login failed: {r.status_code} {r.text}"
    token = r.json().get("token") or r.json().get("access_token") or r.json().get("session_token")
    assert token, f"No token in login response: {r.json()}"
    return token


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def test_prospect(headers):
    """Create a fresh prospect for mark-sold testing"""
    payload = {
        "full_name": "TEST_Iter31 MarkSold Subject",
        "phone": "+33600000031",
        "source": "manual",
        "notes": "iter31 fixture",
    }
    r = requests.post(f"{BASE_URL}/api/prospects", json=payload, headers=headers, timeout=20)
    assert r.status_code in (200, 201), f"create prospect failed: {r.status_code} {r.text}"
    prospect = r.json()
    pid = prospect.get("prospect_id") or prospect.get("id")
    assert pid
    yield pid
    # cleanup
    try:
        requests.delete(f"{BASE_URL}/api/prospects/{pid}", headers=headers, timeout=10)
    except Exception:
        pass


# ============== 1. WEEKLY REPORT URL FIX (code-level check) ==============

class TestWeeklyReportUrlFix:
    def test_helper_function_exists_in_server(self):
        """Refactor: _send_weekly_report_for_user must exist"""
        server_py = Path("/app/backend/server.py").read_text()
        assert "async def _send_weekly_report_for_user" in server_py, \
            "Helper _send_weekly_report_for_user missing — scheduler will crash with F821"

    def test_html_uses_frontend_url_not_koloapp(self):
        """The email HTML must use FRONTEND_URL env var (defaults to https://trykolo.io), not kolo.app"""
        server_py = Path("/app/backend/server.py").read_text()
        # The fixed line must build frontend_url from env with trykolo.io fallback
        assert 'os.environ.get("FRONTEND_URL")' in server_py
        assert "https://trykolo.io" in server_py
        # And the CTA must use {frontend_url}/app
        assert "{frontend_url}/app" in server_py, \
            "Weekly report HTML CTA should reference {frontend_url}/app"
        # Should NOT contain hardcoded broken url
        assert "kolo.app/app" not in server_py, "Broken kolo.app/app URL must be removed"

    def test_env_frontend_url_configured(self):
        """backend/.env must define FRONTEND_URL=https://trykolo.io"""
        env = Path("/app/backend/.env").read_text()
        assert re.search(r"^FRONTEND_URL\s*=\s*https://trykolo\.io", env, re.MULTILINE), \
            "FRONTEND_URL must be set to https://trykolo.io in backend/.env"

    def test_scheduler_calls_helper(self):
        """Background scheduler must invoke _send_weekly_report_for_user(user_id)"""
        server_py = Path("/app/backend/server.py").read_text()
        assert "_send_weekly_report_for_user(u[\"user_id\"])" in server_py or \
               "_send_weekly_report_for_user(u['user_id'])" in server_py, \
            "Scheduler should call the extracted helper"


# ============== 2. MARK-SOLD: NEW FORMAT + RETROCOMPAT ==============

class TestMarkAsSold:
    def _reset_prospect_status(self, headers, pid, status="offre"):
        # Reset before each mark-sold test to allow re-running
        r = requests.put(
            f"{BASE_URL}/api/prospects/{pid}",
            json={"status": status},
            headers=headers,
            timeout=15,
        )
        # 200 OK or sometimes 204
        assert r.status_code in (200, 204), f"reset status failed: {r.status_code} {r.text}"

    def test_mark_sold_with_new_format(self, headers, test_prospect):
        """POST with commission_initial + commission_final returns 200 and persists both fields"""
        self._reset_prospect_status(headers, test_prospect, "offre")

        r = requests.post(
            f"{BASE_URL}/api/prospects/{test_prospect}/mark-sold",
            json={"commission_initial": 1500, "commission_final": 1800},
            headers=headers,
            timeout=20,
        )
        assert r.status_code == 200, f"mark-sold new format failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("commission_initial") == 1500
        assert data.get("commission_final") == 1800
        assert data.get("commission") == 1800  # legacy = final

        # GET → verify persisted
        g = requests.get(f"{BASE_URL}/api/prospects/{test_prospect}", headers=headers, timeout=10)
        assert g.status_code == 200
        p = g.json()
        assert p.get("status") == "closed_won"
        assert p.get("commission_initial") == 1500
        assert p.get("commission_final") == 1800
        assert p.get("commission_amount") == 1800  # legacy aggregate field kept in sync

    def test_mark_sold_backward_compat_commission_amount(self, headers, test_prospect):
        """POST with only legacy commission_amount must still succeed"""
        self._reset_prospect_status(headers, test_prospect, "offre")

        r = requests.post(
            f"{BASE_URL}/api/prospects/{test_prospect}/mark-sold",
            json={"commission_amount": 2200},
            headers=headers,
            timeout=20,
        )
        assert r.status_code == 200, f"mark-sold legacy format failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("commission") == 2200
        # When only commission_amount sent, both initial & final should fall back to it
        assert data.get("commission_final") == 2200
        assert data.get("commission_initial") == 2200

        g = requests.get(f"{BASE_URL}/api/prospects/{test_prospect}", headers=headers, timeout=10)
        assert g.status_code == 200
        p = g.json()
        assert p.get("status") == "closed_won"
        assert p.get("commission_amount") == 2200

    def test_mark_sold_rejects_missing_amount(self, headers, test_prospect):
        self._reset_prospect_status(headers, test_prospect, "offre")
        r = requests.post(
            f"{BASE_URL}/api/prospects/{test_prospect}/mark-sold",
            json={},
            headers=headers,
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"


# ============== 3. NEW STATUS 'offre_acceptee' ==============

class TestOffreAccepteeStatus:
    def test_put_prospect_accepts_offre_acceptee(self, headers, test_prospect):
        """The new status 'offre_acceptee' must be accepted by PUT /prospects/{id}"""
        r = requests.put(
            f"{BASE_URL}/api/prospects/{test_prospect}",
            json={"status": "offre_acceptee"},
            headers=headers,
            timeout=15,
        )
        assert r.status_code in (200, 204), f"PUT offre_acceptee failed: {r.status_code} {r.text}"

        g = requests.get(f"{BASE_URL}/api/prospects/{test_prospect}", headers=headers, timeout=10)
        assert g.status_code == 200
        assert g.json().get("status") == "offre_acceptee"


# ============== 4. WEEKLY REPORT ENDPOINT ==============

class TestWeeklyReportEndpoint:
    def test_post_weekly_report_returns_200_with_stats(self, headers):
        r = requests.post(f"{BASE_URL}/api/reports/weekly", headers=headers, timeout=60)
        assert r.status_code == 200, f"weekly report failed: {r.status_code} {r.text}"
        data = r.json()
        assert "stats" in data
        s = data["stats"]
        for k in ("weekly_revenue", "weekly_sales", "completed_tasks", "new_prospects", "hot_prospects"):
            assert k in s, f"stat key '{k}' missing from response"
