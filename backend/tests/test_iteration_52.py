"""
Iteration 52 — Weekly prospecting quota + High-value signup admin alert + Adaptive AI persona
Backend tests against the public preview URL.

Run with:
    pytest /app/backend/tests/test_iteration_52.py -v --tb=short \
        --junitxml=/app/test_reports/pytest/iteration_52.xml
"""
import os
import time
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Mongo direct access for cleanup / setup (best effort)
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
_mc = MongoClient(MONGO_URL, serverSelectionTimeoutMS=2000)
db = _mc[DB_NAME]

SESSION_TOKEN = "sess_ec7f64eac2c346648c7baf3afb7cff80"
USER_ID = "u_227c821eafc54b53"


def _current_week_start():
    today = datetime.now(timezone.utc).date()
    monday = today - timedelta(days=today.weekday())
    return monday.isoformat()


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {SESSION_TOKEN}", "Content-Type": "application/json"})
    return sess


@pytest.fixture(autouse=True)
def reset_prospecting_log():
    """Reset prospecting log + ensure user is free before each test."""
    try:
        db.v2_prospecting_log.delete_many({"user_id": USER_ID})
        db.users.update_one({"user_id": USER_ID}, {"$set": {"subscription_status": "free"}})
    except Exception:
        pass
    yield
    try:
        db.v2_prospecting_log.delete_many({"user_id": USER_ID})
    except Exception:
        pass


# ============================================================
# QUOTA endpoint — weekly fields
# ============================================================
class TestWeeklyQuota:
    def test_quota_returns_weekly_fields(self, s):
        r = s.get(f"{API}/v2/quota")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["prospecting_used_this_week"] == 0
        assert d["prospecting_limit_per_week"] == 1
        assert d["prospecting_left_this_week"] == 1
        assert d["prospecting_window"] == "semaine (lundi → dimanche UTC)"
        # legacy daily fields must be gone
        assert "prospecting_used_today" not in d
        assert "prospecting_limit_per_day" not in d
        assert "prospecting_left_today" not in d

    def test_dashboard_exposes_weekly_fields(self, s):
        r = s.get(f"{API}/v2/dashboard")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "prospecting_used_this_week" in d
        assert "prospecting_limit_per_week" in d
        assert "prospecting_left_this_week" in d
        assert d["prospecting_limit_per_week"] == 1
        # legacy
        assert "prospecting_used_today" not in d


# ============================================================
# WEEKLY prospecting quota enforcement
# ============================================================
class TestWeeklyEnforcement:
    def test_first_search_ok_second_blocked(self, s):
        r1 = s.get(f"{API}/v2/prospecting/dpe", params={"sector": "Lyon"})
        assert r1.status_code == 200, r1.text

        r2 = s.get(f"{API}/v2/prospecting/dpe", params={"sector": "Lyon"})
        assert r2.status_code == 402
        detail = r2.json().get("detail", "")
        assert "semaine" in detail.lower()
        assert "1 recherche" in detail

    def test_week_start_stored_in_log(self, s):
        r = s.get(f"{API}/v2/prospecting/dpe", params={"sector": "Paris"})
        assert r.status_code == 200
        # check DB
        log = db.v2_prospecting_log.find_one({"user_id": USER_ID})
        assert log is not None
        assert log.get("week_start") == _current_week_start()

    def test_quota_counts_on_week_window(self, s):
        # Insert a fake log from PREVIOUS week — must NOT count this week
        previous_monday = (datetime.now(timezone.utc).date() - timedelta(days=14)).isoformat()
        db.v2_prospecting_log.insert_one({
            "user_id": USER_ID,
            "week_start": previous_monday,
            "kind": "dpe",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        r = s.get(f"{API}/v2/quota")
        assert r.status_code == 200
        d = r.json()
        assert d["prospecting_used_this_week"] == 0
        assert d["prospecting_left_this_week"] == 1


# ============================================================
# High-value signup admin alert
# ============================================================
class TestHighValueSignupAlert:
    def _create_user(self, email):
        send = requests.post(f"{API}/v2/auth/send-email-code", json={"email": email}, timeout=10)
        assert send.status_code == 200, send.text
        code = send.json().get("dev_code")
        assert code, "dev_code expected in preview"
        verify = requests.post(f"{API}/v2/auth/verify-email-code", json={"email": email, "code": code}, timeout=10)
        assert verify.status_code == 200, verify.text
        body = verify.json()
        return body["session_token"], body["user_id"]

    def test_directeur_role_creates_alert(self):
        email = f"test52_dir_{uuid.uuid4().hex[:8]}@kolo-test.io"
        token, uid = self._create_user(email)
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload = {
            "role": "Directeur d_agence",
            "company_name": "Agence Test Sprint52",
            "annual_revenue": "100k+",
            "team_size": "5-10",
            "phone": "+33611111111",
            "main_activity": "Vente résidentiel",
            "sectors": ["Lyon", "Paris"],
            "crm_tool": "Aucun",
        }
        r = requests.post(f"{API}/v2/onboarding", headers=h, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        time.sleep(0.4)
        alert = db.v2_admin_alerts.find_one({"user_id": uid, "kind": "high_value_signup"})
        assert alert is not None, "Expected high_value_signup alert for Directeur"
        assert alert.get("email") == email
        assert alert.get("role") == "Directeur d_agence"
        assert alert.get("company_name") == "Agence Test Sprint52"
        assert alert.get("annual_revenue") == "100k+"
        assert alert.get("team_size") == "5-10"
        assert "Lyon" in (alert.get("sectors") or [])
        # cleanup
        db.v2_admin_alerts.delete_many({"user_id": uid})
        db.users.delete_many({"user_id": uid})
        db.v2_onboarding.delete_many({"user_id": uid})

    def test_agent_role_no_alert(self):
        email = f"test52_agent_{uuid.uuid4().hex[:8]}@kolo-test.io"
        token, uid = self._create_user(email)
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload = {
            "role": "Agent indépendant",
            "company_name": "Solo",
            "annual_revenue": "-30k",
            "main_activity": "Vente résidentiel",
            "sectors": ["Toulouse"],
            "crm_tool": "Aucun",
        }
        r = requests.post(f"{API}/v2/onboarding", headers=h, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        time.sleep(0.3)
        alert = db.v2_admin_alerts.find_one({"user_id": uid, "kind": "high_value_signup"})
        assert alert is None, "Agent indépendant must NOT trigger alert"
        # cleanup
        db.users.delete_many({"user_id": uid})
        db.v2_onboarding.delete_many({"user_id": uid})

    def test_directrice_reseau_role_triggers_alert(self):
        email = f"test52_dirf_{uuid.uuid4().hex[:8]}@kolo-test.io"
        token, uid = self._create_user(email)
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload = {
            "role": "Directrice de réseau",
            "company_name": "Réseau Premium",
            "annual_revenue": "100k+",
            "team_size": "50+",
            "main_activity": "Vente luxe",
            "sectors": ["Paris"],
            "crm_tool": "Salesforce",
        }
        r = requests.post(f"{API}/v2/onboarding", headers=h, json=payload, timeout=10)
        assert r.status_code == 200
        time.sleep(0.3)
        alert = db.v2_admin_alerts.find_one({"user_id": uid, "kind": "high_value_signup"})
        assert alert is not None
        db.v2_admin_alerts.delete_many({"user_id": uid})
        db.users.delete_many({"user_id": uid})
        db.v2_onboarding.delete_many({"user_id": uid})


# ============================================================
# Adaptive AI persona (Claude)
# ============================================================
class TestAdaptivePersona:
    def test_director_chat_strategic_tone(self, s):
        # ensure onboarding is Director with high revenue (already seeded in DB normally)
        db.v2_onboarding.update_one(
            {"user_id": USER_ID},
            {"$set": {
                "user_id": USER_ID,
                "role": "Directeur d_agence",
                "annual_revenue": "100k+",
                "main_activity": "Vente résidentiel + luxe",
                "team_size": "5-10",
                "sectors": ["Lyon"],
                "crm_tool": "Aucun",
            }},
            upsert=True,
        )
        body = {
            "message": "Quels KPIs prioritaires pour piloter mon agence ce trimestre ?",
        }
        r = s.post(f"{API}/v2/ai/chat", json=body, timeout=45)
        assert r.status_code == 200, r.text
        txt = (r.json().get("reply") or r.json().get("message") or "").lower()
        # Strategic markers
        keywords = ["kpi", "équipe", "pilot", "ca", "manag", "performance", "process", "marge", "recrut", "scale", "objectif"]
        hits = [k for k in keywords if k in txt]
        assert len(hits) >= 2, f"Expected strategic keywords in director reply, got: {txt[:400]}"

    def test_beginner_chat_pedagogic_tone(self):
        email = f"test52_begin_{uuid.uuid4().hex[:8]}@kolo-test.io"
        send = requests.post(f"{API}/v2/auth/send-email-code", json={"email": email}, timeout=10).json()
        verify = requests.post(f"{API}/v2/auth/verify-email-code", json={"email": email, "code": send["dev_code"]}, timeout=10).json()
        token, uid = verify["session_token"], verify["user_id"]
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        # onboarding beginner
        ob = {
            "role": "Agent indépendant",
            "company_name": "",
            "annual_revenue": "-30k",
            "main_activity": "Vente résidentiel",
            "sectors": ["Bordeaux"],
            "crm_tool": "Aucun",
        }
        ro = requests.post(f"{API}/v2/onboarding", headers=h, json=ob, timeout=10)
        assert ro.status_code == 200
        # chat
        r = requests.post(f"{API}/v2/ai/chat", headers=h, json={"message": "Je débute, comment trouver mon premier mandat ?"}, timeout=45)
        assert r.status_code == 200, r.text
        txt = (r.json().get("reply") or r.json().get("message") or "").lower()
        # Beginner / pedagogic markers
        keywords = ["étape", "simple", "petit", "commenc", "prospect", "mandat", "régul", "porte", "premier", "voisin", "concret"]
        hits = [k for k in keywords if k in txt]
        assert len(hits) >= 2, f"Expected pedagogic keywords in beginner reply, got: {txt[:400]}"
        # cleanup
        db.users.delete_many({"user_id": uid})
        db.v2_onboarding.delete_many({"user_id": uid})

    def test_daily_tip_director(self, s):
        db.v2_onboarding.update_one(
            {"user_id": USER_ID},
            {"$set": {"role": "Directeur d_agence", "annual_revenue": "100k+"}},
            upsert=True,
        )
        r = s.get(f"{API}/v2/ai/daily-tip", timeout=45)
        assert r.status_code == 200, r.text
        body = r.json()
        tip = (body.get("tip") or body.get("message") or body.get("reply") or "").lower()
        assert len(tip) > 30, f"Daily tip too short: {tip}"
        # Expect strategic content
        director_markers = ["équipe", "pilot", "kpi", "manag", "performance", "process", "stratég", "agence", "réseau", "recrut", "scale", "objectif", "ca", "marge"]
        hits = [k for k in director_markers if k in tip]
        assert len(hits) >= 1, f"Director daily tip should contain strategic markers, got: {tip[:400]}"
