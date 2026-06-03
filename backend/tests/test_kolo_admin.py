"""
KOLO Super Admin endpoint tests (Phase 1).

Covers:
- /api/admin/check (no auth, admin, non-admin)
- /api/admin/stats (auth & shape)
- /api/admin/leads (list + filter + PATCH update + 400 + 404)
- /api/admin/users (list + search + status filter)
- /api/auth/me (is_super_admin flag for admin and non-admin)
"""
import os
import time
import pytest
import requests
from pymongo import MongoClient
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

ADMIN_EMAIL = "elliot.cohenpressard@trykolo.io"
NORMAL_EMAIL = "nonadmin.test@example.com"


@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="session")
def admin_token(mongo_db):
    mongo_db.users.delete_many({"email": ADMIN_EMAIL})
    mongo_db.user_sessions.delete_many({"user_id": {"$regex": "^test-admin-"}})
    user_id = f"test-admin-{int(time.time()*1000)}"
    token = f"test_admin_sess_{int(time.time()*1000)}"
    mongo_db.users.insert_one({
        "user_id": user_id,
        "email": ADMIN_EMAIL,
        "name": "Elliot",
        "auth_provider": "google",
        "subscription_status": "active",
        "plan": "pro",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return token


@pytest.fixture(scope="session")
def normal_token(mongo_db):
    mongo_db.users.delete_many({"email": NORMAL_EMAIL})
    mongo_db.user_sessions.delete_many({"user_id": {"$regex": "^test-normal-"}})
    user_id = f"test-normal-{int(time.time()*1000)}"
    token = f"test_normal_sess_{int(time.time()*1000)}"
    mongo_db.users.insert_one({
        "user_id": user_id,
        "email": NORMAL_EMAIL,
        "name": "Normal",
        "auth_provider": "google",
        "subscription_status": "trialing",
        "plan": "free",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return token


@pytest.fixture(scope="session")
def seeded_lead(mongo_db):
    """Insert a TEST_ lead for admin lead endpoints."""
    lead_id = f"TEST_lead_{int(time.time()*1000)}"
    mongo_db.enterprise_leads.delete_many({"lead_id": {"$regex": "^TEST_lead_"}})
    mongo_db.enterprise_leads.insert_one({
        "lead_id": lead_id,
        "email": "demo@example.com",
        "company": "TEST Corp",
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield lead_id
    mongo_db.enterprise_leads.delete_many({"lead_id": {"$regex": "^TEST_lead_"}})


# ---------- /api/admin/check ----------
class TestAdminCheck:
    def test_no_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/check")
        assert r.status_code == 200
        data = r.json()
        assert data == {"is_super_admin": False, "authenticated": False}

    def test_with_admin_token(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/check",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["is_super_admin"] is True
        assert data["authenticated"] is True
        assert data["email"] == ADMIN_EMAIL

    def test_with_normal_token(self, normal_token):
        r = requests.get(f"{BASE_URL}/api/admin/check",
                         headers={"Authorization": f"Bearer {normal_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["is_super_admin"] is False
        assert data["authenticated"] is True


# ---------- /api/admin/stats ----------
class TestAdminStats:
    def test_stats_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        assert "users" in data and "leads" in data
        for k in ("total", "active", "trialing"):
            assert k in data["users"], f"users.{k} missing"
            assert isinstance(data["users"][k], int)
        for k in ("total", "new", "converted"):
            assert k in data["leads"], f"leads.{k} missing"
        assert "prospects_total" in data
        assert "generated_at" in data

    def test_stats_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code in (401, 403)

    def test_stats_normal_user_forbidden(self, normal_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats",
                         headers={"Authorization": f"Bearer {normal_token}"})
        assert r.status_code == 403


# ---------- /api/admin/leads ----------
class TestAdminLeads:
    def test_list_leads_admin(self, admin_token, seeded_lead):
        r = requests.get(f"{BASE_URL}/api/admin/leads",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        assert "leads" in data and "count" in data
        assert isinstance(data["leads"], list)
        assert isinstance(data["count"], int)
        ids = [l.get("lead_id") for l in data["leads"]]
        assert seeded_lead in ids

    def test_list_leads_filter_new(self, admin_token, seeded_lead):
        r = requests.get(f"{BASE_URL}/api/admin/leads?status=new",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        for l in data["leads"]:
            assert l.get("status") == "new"

    def test_list_leads_forbidden(self, normal_token):
        r = requests.get(f"{BASE_URL}/api/admin/leads",
                         headers={"Authorization": f"Bearer {normal_token}"})
        assert r.status_code == 403

    def test_patch_lead_update(self, admin_token, seeded_lead):
        r = requests.patch(
            f"{BASE_URL}/api/admin/leads/{seeded_lead}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"status": "contacted"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["lead"]["status"] == "contacted"

        # Verify persisted via GET ?status=contacted
        r2 = requests.get(f"{BASE_URL}/api/admin/leads?status=contacted",
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert r2.status_code == 200
        assert seeded_lead in [l["lead_id"] for l in r2.json()["leads"]]

    def test_patch_lead_invalid_status(self, admin_token, seeded_lead):
        r = requests.patch(
            f"{BASE_URL}/api/admin/leads/{seeded_lead}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"status": "WRONG_STATUS"},
        )
        assert r.status_code == 400

    def test_patch_lead_not_found(self, admin_token):
        r = requests.patch(
            f"{BASE_URL}/api/admin/leads/does_not_exist_xyz",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"status": "contacted"},
        )
        assert r.status_code == 404


# ---------- /api/admin/users ----------
class TestAdminUsers:
    def test_list_users_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        for k in ("total", "limit", "offset", "users"):
            assert k in data
        assert isinstance(data["users"], list)
        assert isinstance(data["total"], int)

    def test_list_users_search_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users?q=admin",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        # All returned users must contain 'admin' substring (case-insensitive) in email or name
        for u in data["users"]:
            blob = ((u.get("email") or "") + " " + (u.get("name") or "")).lower()
            assert "admin" in blob

    def test_list_users_status_filter(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users?status=active",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        for u in r.json()["users"]:
            assert u.get("subscription_status") == "active"

    def test_list_users_forbidden(self, normal_token):
        r = requests.get(f"{BASE_URL}/api/admin/users",
                         headers={"Authorization": f"Bearer {normal_token}"})
        assert r.status_code == 403


# ---------- /api/auth/me is_super_admin flag ----------
class TestAuthMeSuperAdmin:
    def test_me_admin_has_flag(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data.get("is_super_admin") is True

    def test_me_normal_user_flag_false(self, normal_token):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {normal_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("is_super_admin") is False
