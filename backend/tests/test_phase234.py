"""
Phase 2 (Orgs / Multi-tenant), Phase 3 (Integrations) backend tests.

Seeds (TEST_*) created via mongosh in iteration_27. Tokens read from env so we
can re-seed easily.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")

ADMIN_TOKEN = os.environ.get("KOLO_ADMIN_TOKEN", "TEST_admin_sess_1780490334158")
USER_TOKEN = os.environ.get("KOLO_USER_TOKEN", "TEST_user_sess_1780490334158")
USER2_TOKEN = os.environ.get("KOLO_USER2_TOKEN", "TEST_user2_sess_1780490334158")
USER_ID = os.environ.get("KOLO_USER_ID", "TEST_user_1780490334158")
USER2_ID = os.environ.get("KOLO_USER2_ID", "TEST_user2_1780490334158")


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- Sanity ----------

def test_auth_me_admin_returns_super_admin():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(ADMIN_TOKEN), timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("is_super_admin") is True
    assert d["email"] == "elliot.cohenpressard@trykolo.io"


def test_auth_me_user_not_super_admin():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(USER_TOKEN), timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("is_super_admin") is False


# ---------- PHASE 2: Orgs ----------

ORG_ID = None  # filled by test_create_org


def test_orgs_me_empty_for_new_user():
    r = requests.get(f"{BASE_URL}/api/orgs/me", headers=H(USER_TOKEN), timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d.get("org") is None
    assert d.get("role") is None


def test_create_org_user_becomes_admin():
    global ORG_ID
    r = requests.post(
        f"{BASE_URL}/api/orgs",
        headers=H(USER_TOKEN),
        json={"name": "TEST_OrgAlpha", "primary_color": "#FF00AA"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d["org"]["name"] == "TEST_OrgAlpha"
    assert d["org"]["primary_color"] == "#FF00AA"
    assert d["org"]["owner_user_id"] == USER_ID
    ORG_ID = d["org"]["org_id"]

    # /orgs/me now returns the org with admin role
    me = requests.get(f"{BASE_URL}/api/orgs/me", headers=H(USER_TOKEN), timeout=10).json()
    assert me["org"]["org_id"] == ORG_ID
    assert me["role"] == "org_admin"


def test_create_org_second_time_fails():
    r = requests.post(
        f"{BASE_URL}/api/orgs",
        headers=H(USER_TOKEN),
        json={"name": "TEST_Second"},
        timeout=10,
    )
    assert r.status_code == 400


def test_non_member_gets_403_on_kpis():
    assert ORG_ID
    r = requests.get(f"{BASE_URL}/api/orgs/{ORG_ID}/kpis", headers=H(USER2_TOKEN), timeout=10)
    assert r.status_code == 403


def test_super_admin_bypass_can_view_kpis():
    assert ORG_ID
    r = requests.get(f"{BASE_URL}/api/orgs/{ORG_ID}/kpis", headers=H(ADMIN_TOKEN), timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "total_prospects" in d
    assert "by_score" in d
    assert "sold" in d
    assert "breakdown" in d


def test_patch_org_admin_only():
    assert ORG_ID
    # non-member 403
    r = requests.patch(f"{BASE_URL}/api/orgs/{ORG_ID}", headers=H(USER2_TOKEN), json={"name": "x"}, timeout=10)
    assert r.status_code == 403
    # admin can update
    r = requests.patch(f"{BASE_URL}/api/orgs/{ORG_ID}", headers=H(USER_TOKEN), json={"name": "TEST_OrgAlphaV2"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["org"]["name"] == "TEST_OrgAlphaV2"


INVITE_TOKEN = None


def test_invite_admin_only_and_token_generated():
    global INVITE_TOKEN
    assert ORG_ID
    # non-admin (USER2 not member) -> 403
    r = requests.post(
        f"{BASE_URL}/api/orgs/{ORG_ID}/invite",
        headers=H(USER2_TOKEN),
        json={"email": "invitee@example.com", "role": "org_agent"},
        timeout=10,
    )
    assert r.status_code == 403
    # admin creates invite
    r = requests.post(
        f"{BASE_URL}/api/orgs/{ORG_ID}/invite",
        headers=H(USER_TOKEN),
        json={"email": "phase2.user2@example.com", "role": "org_agent"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d["invite"]["token"]
    assert d["accept_url"].startswith("/org/join/")
    INVITE_TOKEN = d["invite"]["token"]


def test_accept_invite_user2_joins():
    assert INVITE_TOKEN
    r = requests.post(
        f"{BASE_URL}/api/orgs/accept-invite/{INVITE_TOKEN}",
        headers=H(USER2_TOKEN),
        timeout=10,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d["role"] == "org_agent"

    # user2 now is org member -> orgs/me returns the org
    me = requests.get(f"{BASE_URL}/api/orgs/me", headers=H(USER2_TOKEN), timeout=10).json()
    assert me["org"]["org_id"] == ORG_ID
    assert me["role"] == "org_agent"


def test_accept_invite_twice_fails():
    assert INVITE_TOKEN
    r = requests.post(
        f"{BASE_URL}/api/orgs/accept-invite/{INVITE_TOKEN}",
        headers=H(USER2_TOKEN),
        timeout=10,
    )
    assert r.status_code == 404


def test_list_members_includes_both():
    assert ORG_ID
    r = requests.get(f"{BASE_URL}/api/orgs/{ORG_ID}/members", headers=H(USER_TOKEN), timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["count"] >= 2
    emails = [m["email"] for m in d["members"]]
    assert "phase2.user@example.com" in emails
    assert "phase2.user2@example.com" in emails


def test_non_admin_member_cannot_invite():
    assert ORG_ID
    # user2 is org_agent now -> 403 on invite
    r = requests.post(
        f"{BASE_URL}/api/orgs/{ORG_ID}/invite",
        headers=H(USER2_TOKEN),
        json={"email": "newbie@example.com"},
        timeout=10,
    )
    assert r.status_code == 403


def test_dataroom_add_list_delete():
    assert ORG_ID
    r = requests.post(
        f"{BASE_URL}/api/orgs/{ORG_ID}/dataroom",
        headers=H(USER_TOKEN),
        json={"title": "TEST_Brochure", "url": "https://example.com/pdf", "category": "marketing"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    entry_id = r.json()["entry"]["entry_id"]

    r = requests.get(f"{BASE_URL}/api/orgs/{ORG_ID}/dataroom", headers=H(USER2_TOKEN), timeout=10)
    assert r.status_code == 200
    assert any(e["entry_id"] == entry_id for e in r.json()["entries"])

    # non-admin cannot delete
    r = requests.delete(f"{BASE_URL}/api/orgs/{ORG_ID}/dataroom/{entry_id}", headers=H(USER2_TOKEN), timeout=10)
    assert r.status_code == 403

    r = requests.delete(f"{BASE_URL}/api/orgs/{ORG_ID}/dataroom/{entry_id}", headers=H(USER_TOKEN), timeout=10)
    assert r.status_code == 200


def test_org_kpis_structure():
    assert ORG_ID
    r = requests.get(f"{BASE_URL}/api/orgs/{ORG_ID}/kpis", headers=H(USER_TOKEN), timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ["total_prospects", "by_score", "sold", "calls", "completed_tasks", "members_count", "breakdown"]:
        assert k in d, f"missing key {k}"
    assert set(d["by_score"].keys()) == {"chaud", "tiede", "froid"}
    assert d["members_count"] >= 2


def test_remove_member_admin_only_and_owner_protected():
    assert ORG_ID
    # non-admin: 403
    r = requests.delete(f"{BASE_URL}/api/orgs/{ORG_ID}/members/{USER_ID}", headers=H(USER2_TOKEN), timeout=10)
    assert r.status_code == 403
    # cannot remove owner
    r = requests.delete(f"{BASE_URL}/api/orgs/{ORG_ID}/members/{USER_ID}", headers=H(USER_TOKEN), timeout=10)
    assert r.status_code == 400


# ---------- PHASE 3: Integrations ----------

def test_integrations_status_shape():
    r = requests.get(f"{BASE_URL}/api/integrations/status", headers=H(USER_TOKEN), timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ["twilio", "whatsapp", "google_calendar", "outlook_calendar", "apple_calendar", "whisper"]:
        assert k in d
        assert "configured" in d[k]
        assert "missing" in d[k]
    # Whisper should be configured (EMERGENT_LLM_KEY set)
    assert d["whisper"]["configured"] is True
    # Twilio/WhatsApp/GCal not configured (placeholders)
    assert d["twilio"]["configured"] is False
    assert "TWILIO_ACCOUNT_SID" in d["twilio"]["missing"]
    assert d["whatsapp"]["configured"] is False
    assert d["google_calendar"]["configured"] is False
    # Outlook + Apple flagged "Bientôt disponible"
    assert d["outlook_calendar"].get("note") == "Bientôt disponible"
    assert d["apple_calendar"].get("note") == "Bientôt disponible"


def test_twilio_call_400_without_keys():
    r = requests.post(
        f"{BASE_URL}/api/integrations/twilio/call",
        headers=H(USER_TOKEN),
        json={"to": "+33600000000"},
        timeout=10,
    )
    assert r.status_code == 400
    assert "Twilio" in r.json().get("detail", "")


def test_whatsapp_send_400_without_keys():
    r = requests.post(
        f"{BASE_URL}/api/integrations/whatsapp/send",
        headers=H(USER_TOKEN),
        json={"to": "+33600000000", "body": "hi"},
        timeout=10,
    )
    assert r.status_code == 400
    assert "WhatsApp" in r.json().get("detail", "")


def test_gcal_auth_url_400_without_client_id():
    r = requests.get(
        f"{BASE_URL}/api/integrations/google-calendar/auth-url",
        headers=H(USER_TOKEN),
        timeout=10,
    )
    assert r.status_code == 400
    assert "GOOGLE_CAL_CLIENT_ID" in r.json().get("detail", "")


def test_whatsapp_webhook_handshake_ok():
    r = requests.get(
        f"{BASE_URL}/api/integrations/whatsapp/webhook",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "kolo_wa_verify_2026",
            "hub.challenge": "abc123",
        },
        timeout=10,
    )
    assert r.status_code == 200
    assert r.text == "abc123"


def test_whatsapp_webhook_handshake_wrong_token():
    r = requests.get(
        f"{BASE_URL}/api/integrations/whatsapp/webhook",
        params={"hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "x"},
        timeout=10,
    )
    assert r.status_code == 403


def test_whatsapp_webhook_post_stores_inbound():
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "metadata": {"phone_number_id": "PHONE_TEST"},
                            "messages": [
                                {
                                    "id": "wamid.TEST_inbound_xyz",
                                    "from": "33600000001",
                                    "type": "text",
                                    "text": {"body": "hello from test"},
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }
    r = requests.post(f"{BASE_URL}/api/integrations/whatsapp/webhook", json=payload, timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_integrations_status_requires_auth():
    r = requests.get(f"{BASE_URL}/api/integrations/status", timeout=10)
    assert r.status_code == 401
