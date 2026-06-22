"""V2 Audit — Backend tests for refonte KOLO V2 (referral, ai, prospecting, onboarding, CRUD)."""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/v2"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    """Create a fresh user via email-code flow and return session_token + user_id."""
    email = f"test_audit_{uuid.uuid4().hex[:8]}@kolo.test"
    r = session.post(f"{API}/auth/send-email-code", json={"email": email})
    assert r.status_code == 200, r.text
    dev_code = r.json().get("dev_code")
    assert dev_code, "dev_code missing in preview"
    r2 = session.post(f"{API}/auth/verify-email-code", json={
        "email": email, "code": dev_code, "first_name": "Bob",
        "referral_code": "TESTABCD"
    })
    assert r2.status_code == 200, r2.text
    data = r2.json()
    assert data["verified"] and data["new_user"]
    return {"token": data["session_token"], "user_id": data["user_id"], "email": email}


@pytest.fixture
def auth_client(session, auth):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth['token']}",
        "Cookie": f"session_token={auth['token']}",
    })
    return s


# --- REFERRAL public endpoint ---
def test_referral_info_valid(session):
    r = session.get(f"{API}/referral/info/TESTABCD")
    assert r.status_code == 200
    d = r.json()
    assert d["code"] == "TESTABCD"
    assert d["referrer_first_name"] == "Marie"


def test_referral_info_invalid(session):
    r = session.get(f"{API}/referral/info/INVALIDXX")
    assert r.status_code == 404


# --- AUTO ATTRIBUTION on signup ---
def test_referral_auto_attribution_on_signup(auth):
    """Verify v2_referrals_redeemed contains entry for newly created user."""
    # Use admin/dev access; instead, check via /referral/me of the referrer would need their session.
    # Use the public DB via the convert endpoint side-effect: just check by calling /referral/me on a new logged-in test referrer.
    # Best practical check: use a direct DB inspection via Mongo client.
    from pymongo import MongoClient
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    client = MongoClient(mongo_url)
    db = client[db_name]
    row = db.v2_referrals_redeemed.find_one({"referred_user_id": auth["user_id"]})
    assert row is not None, "referral redemption not created"
    assert row["referrer_user_id"] == "u_testref01"
    assert row["converted_pro"] is False


# --- ME / DASHBOARD ---
def test_me(auth_client):
    r = auth_client.get(f"{API}/me")
    assert r.status_code == 200, r.text
    assert r.json().get("first_name") == "Bob"


def test_dashboard(auth_client):
    r = auth_client.get(f"{API}/dashboard")
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("reminders_today", "notes_pending", "total_contacts", "has_pro"):
        assert k in d


# --- ONBOARDING ---
def test_onboarding_save_and_get(auth_client):
    payload = {
        "role": "agent_independant", "activities": ["transaction"],
        "company_name": "ACME", "team_size": "1-5", "annual_revenue": "<100k",
        "main_activity": "transaction", "sectors": ["Lyon"], "crm_tool": "Hubspot",
        "diffusion_platforms": ["SeLoger"], "phone": "0612345678", "accepted_terms": True
    }
    r = auth_client.post(f"{API}/onboarding", json=payload)
    assert r.status_code == 200
    r2 = auth_client.get(f"{API}/onboarding")
    assert r2.status_code == 200
    d = r2.json()
    assert d.get("role") == "agent_independant"
    assert d.get("sectors") == ["Lyon"]


# --- CRUD reminders/notes/contacts/cases ---
def test_reminder_crud(auth_client):
    r = auth_client.post(f"{API}/reminders", json={"title": "Test", "date": "2026-03-01"})
    assert r.status_code == 200
    rid = r.json()["reminder_id"]
    assert auth_client.get(f"{API}/reminders").status_code == 200
    assert auth_client.patch(f"{API}/reminders/{rid}", json={"title": "Edit"}).status_code == 200
    assert auth_client.delete(f"{API}/reminders/{rid}").status_code == 200


def test_note_crud(auth_client):
    r = auth_client.post(f"{API}/notes", json={"content": "TEST note"})
    assert r.status_code == 200
    nid = r.json()["note_id"]
    assert auth_client.patch(f"{API}/notes/{nid}", json={"status": "processed"}).status_code == 200
    assert auth_client.delete(f"{API}/notes/{nid}").status_code == 200


def test_contact_crud(auth_client):
    r = auth_client.post(f"{API}/contacts", json={"first_name": "TEST_John", "last_name": "Doe", "role": "buyer"})
    assert r.status_code == 200
    cid = r.json()["contact_id"]
    assert auth_client.get(f"{API}/contacts/{cid}").status_code == 200
    assert auth_client.delete(f"{API}/contacts/{cid}").status_code == 200


def test_case_crud(auth_client):
    r = auth_client.post(f"{API}/cases", json={"type": "seller", "property_kind": "apartment"})
    assert r.status_code == 200
    csid = r.json()["case_id"]
    assert auth_client.get(f"{API}/cases/{csid}").status_code == 200
    assert auth_client.delete(f"{API}/cases/{csid}").status_code == 200


# --- REFERRAL ME ---
def test_referral_me(auth_client):
    r = auth_client.get(f"{API}/referral/me")
    assert r.status_code == 200
    d = r.json()
    assert d.get("code") and len(d["code"]) == 8
    assert d["code"] in d.get("share_url", "")
    assert "free_months_earned" in d


# --- AI ---
def test_ai_chat_global_context(auth_client):
    r = auth_client.post(f"{API}/ai/chat", json={"message": "Bonjour, comment je m'appelle ?"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("conversation_id")
    assert d.get("reply")
    # Note: not asserting the LLM mentions "Bob" strictly because of LLM variability.


def test_ai_daily_tip(auth_client):
    r = auth_client.get(f"{API}/ai/daily-tip")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("tip")
    assert isinstance(d.get("suggestions"), list) and len(d["suggestions"]) >= 1


# --- PROSPECTING ---
def test_prospecting_listings_placeholder(auth_client):
    r = auth_client.get(f"{API}/prospecting/listings", params={"sector": "Lyon"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("source") in ("placeholder", "RapidAPI", "RapidAPI (cache)")
    if not os.environ.get("RAPIDAPI_KEY"):
        assert d["source"] == "placeholder"
    assert isinstance(d.get("items"), list)


def test_prospecting_dpe(auth_client):
    r = auth_client.get(f"{API}/prospecting/dpe", params={"sector": "69003"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("source") == "ADEME"
    assert isinstance(d.get("items"), list)


# --- AUTH negative ---
def test_unauthenticated_dashboard(session):
    r = session.get(f"{API}/dashboard")
    assert r.status_code == 401
