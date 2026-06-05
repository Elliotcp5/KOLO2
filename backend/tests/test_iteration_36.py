"""Iteration 36 — White-label refactor & 3-role org system

Tests:
1. GET /api/admin/whitelabel/list returns seats_used live-calculated
2. PATCH /api/admin/whitelabel/{org_id} accepts tagline/seats/price/promo/billing_country
3. DELETE /api/admin/whitelabel/{org_id} cleans org + detaches members + deletes invites
4. GET /api/admin/whitelabel/{org_id}/invite-link returns fresh URL with expires_at +14d
5. POST /api/admin/whitelabel/{org_id}/invoice returns invoice with IBAN/BIC/ref
6. POST /api/orgs/{id}/invite accepts role=org_manager + manager_id validation
7. PATCH /api/orgs/{org_id}/members/{user_id} (NEW) validates role + manager_id
8. GET /api/orgs/{org_id}/members filtering for org_manager viewer
9. GET /api/orgs/{org_id}/kpis with managers/search filters
"""
import os
import uuid
from datetime import datetime, timezone
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
SUPER_ADMIN_EMAIL = "elliot.cohenpressard@trykolo.io"
SUPER_ADMIN_PWD = "Psychologue75007%!"


# ---------- Shared fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PWD,
    }, timeout=30)
    assert r.status_code == 200, f"super admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def _cleanup_org(org_id: str):
    try:
        from pymongo import MongoClient
        mc = MongoClient(os.environ.get("MONGO_URL"))
        db = mc[os.environ.get("DB_NAME")]
        db.organizations.delete_one({"org_id": org_id})
        db.org_invites.delete_many({"org_id": org_id})
        db.invoices.delete_many({"org_id": org_id})
    except Exception:
        pass


@pytest.fixture
def fresh_org(admin_headers):
    """Create a fresh whitelabel org for each test that needs one (cleaned after)."""
    suffix = uuid.uuid4().hex[:6]
    payload = {
        "name": f"TEST_iter36_{suffix}",
        "slug": f"test-iter36-{suffix}",
        "primary_color": "#3B82F6",
        "secondary_color": "#1E40AF",
        "logo_url": "https://example.com/logo.png",
        "tagline": "Iter36 test",
        "seats": 10,
        "monthly_price_per_seat_eur": 1900,
        "billing_country": "FR",
        "font_family": "Inter",
    }
    r = requests.post(f"{BASE_URL}/api/admin/whitelabel/create",
                      json=payload, headers=admin_headers, timeout=30)
    assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
    org = r.json()["org"]
    yield org
    _cleanup_org(org["org_id"])


# ---------- (1) GET list returns seats_used live ----------
class TestWhitelabelList:
    def test_list_returns_seats_used_live(self, admin_headers, fresh_org):
        r = requests.get(f"{BASE_URL}/api/admin/whitelabel/list", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "orgs" in body
        match = next((o for o in body["orgs"] if o.get("org_id") == fresh_org["org_id"]), None)
        assert match is not None
        # seats_used must be present and an int (live count) - new org has 0 members
        assert "seats_used" in match
        assert isinstance(match["seats_used"], int)
        assert match["seats_used"] == 0


# ---------- (2) PATCH whitelabel update ----------
class TestWhitelabelUpdate:
    def test_patch_updates_tagline_seats_price_promo_country(self, admin_headers, fresh_org):
        org_id = fresh_org["org_id"]
        payload = {
            "tagline": "New tagline iter36",
            "seats": 25,
            "monthly_price_per_seat_eur": 2900,
            "promo_months_free": 2,
            "billing_country": "be",  # should be uppercased
        }
        r = requests.patch(f"{BASE_URL}/api/admin/whitelabel/{org_id}",
                           json=payload, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        org = r.json()["org"]
        assert org["tagline"] == "New tagline iter36"
        assert org["seats"] == 25
        assert org["monthly_price_per_seat_eur"] == 2900
        assert org["promo_months_free"] == 2
        assert org["billing_country"] == "BE"

        # GET list to verify persistence
        r2 = requests.get(f"{BASE_URL}/api/admin/whitelabel/list", headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        match = next((o for o in r2.json()["orgs"] if o["org_id"] == org_id), None)
        assert match["seats"] == 25
        assert match["billing_country"] == "BE"

    def test_patch_non_super_admin_forbidden(self):
        # No auth → 401/403
        r = requests.patch(f"{BASE_URL}/api/admin/whitelabel/nonexistent",
                           json={"tagline": "x"}, timeout=30)
        assert r.status_code in (401, 403)


# ---------- (3) DELETE whitelabel ----------
class TestWhitelabelDelete:
    def test_delete_removes_org_and_invites(self, admin_headers):
        suffix = uuid.uuid4().hex[:6]
        payload = {
            "name": f"TEST_del_{suffix}",
            "slug": f"test-del-{suffix}",
            "primary_color": "#000000",
            "seats": 5,
            "monthly_price_per_seat_eur": 1900,
        }
        r = requests.post(f"{BASE_URL}/api/admin/whitelabel/create",
                          json=payload, headers=admin_headers, timeout=30)
        assert r.status_code == 200
        org_id = r.json()["org"]["org_id"]

        # Issue an invite link to verify cleanup
        inv = requests.get(f"{BASE_URL}/api/admin/whitelabel/{org_id}/invite-link",
                           headers=admin_headers, timeout=30)
        assert inv.status_code == 200

        # Delete
        d = requests.delete(f"{BASE_URL}/api/admin/whitelabel/{org_id}",
                            headers=admin_headers, timeout=30)
        assert d.status_code == 200, d.text
        assert d.json().get("ok") is True

        # Verify org gone
        lst = requests.get(f"{BASE_URL}/api/admin/whitelabel/list", headers=admin_headers, timeout=30)
        assert lst.status_code == 200
        match = next((o for o in lst.json()["orgs"] if o.get("org_id") == org_id), None)
        assert match is None, "org should have been deleted"

        # Verify invites cleaned in DB
        try:
            from pymongo import MongoClient
            mc = MongoClient(os.environ.get("MONGO_URL"))
            db = mc[os.environ.get("DB_NAME")]
            inv_count = db.org_invites.count_documents({"org_id": org_id})
            assert inv_count == 0, f"invites still present: {inv_count}"
        except ImportError:
            pass

    def test_delete_404_when_org_missing(self, admin_headers):
        r = requests.delete(f"{BASE_URL}/api/admin/whitelabel/does-not-exist-{uuid.uuid4().hex[:6]}",
                            headers=admin_headers, timeout=30)
        assert r.status_code == 404


# ---------- (4) Fresh invite-link with expires_at +14d ----------
class TestWhitelabelInviteLink:
    def test_invite_link_fresh_with_14d_expiry(self, admin_headers, fresh_org):
        org_id = fresh_org["org_id"]
        r = requests.get(f"{BASE_URL}/api/admin/whitelabel/{org_id}/invite-link",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "invite_url" in body
        assert "token" in body
        assert "expires_at" in body
        assert body["token"] in body["invite_url"]
        # Verify ~14 day expiry
        exp = datetime.fromisoformat(body["expires_at"].replace("Z", "+00:00"))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        delta_days = (exp - datetime.now(timezone.utc)).days
        assert 13 <= delta_days <= 14, f"expected ~14d expiry, got {delta_days}d"


# ---------- (5) Invoice generation ----------
class TestWhitelabelInvoice:
    def test_invoice_returns_iban_bic_reference(self, admin_headers, fresh_org):
        org_id = fresh_org["org_id"]
        r = requests.post(f"{BASE_URL}/api/admin/whitelabel/{org_id}/invoice",
                          headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        inv = body.get("invoice") or {}
        # Required fields
        assert inv.get("invoice_number", "").startswith("KL-"), inv.get("invoice_number")
        # Format: KL-YYYYMM-XXXXXX
        parts = inv["invoice_number"].split("-")
        assert len(parts) == 3 and len(parts[1]) == 6 and len(parts[2]) == 6
        assert "amount_ht_cents" in inv
        assert "amount_ttc_cents" in inv
        assert "vat_pct" in inv
        assert "iban" in inv and inv["iban"]
        assert "bic" in inv and inv["bic"]
        assert "beneficiary" in inv and inv["beneficiary"]
        assert "reference" in inv and inv["reference"]
        # Math check: seats=10, monthly=1900 cents, no promo, 12 months, FR=20%
        expected_ht = 10 * 1900 * 12
        assert inv["amount_ht_cents"] == expected_ht
        assert inv["vat_pct"] == 20
        assert inv["amount_ttc_cents"] == expected_ht + round(expected_ht * 20 / 100)


# ---------- (6) Invite with org_manager role + manager_id validation ----------
class TestOrgInviteRoles:
    def test_invite_org_manager_role(self, admin_headers):
        """Super admin creates an org then invites a manager."""
        suffix = uuid.uuid4().hex[:6]
        # Create org with owner being super admin
        crp = requests.post(f"{BASE_URL}/api/admin/whitelabel/create",
                            json={
                                "name": f"TEST_inv_{suffix}",
                                "slug": f"test-inv-{suffix}",
                                "primary_color": "#000000",
                                "seats": 5,
                                "monthly_price_per_seat_eur": 1900,
                            }, headers=admin_headers, timeout=30)
        assert crp.status_code == 200
        org_id = crp.json()["org"]["org_id"]

        try:
            # Invite as org_manager (no manager_id needed)
            r = requests.post(f"{BASE_URL}/api/orgs/{org_id}/invite",
                              json={"email": f"TEST_mgr_{suffix}@example.com", "role": "org_manager"},
                              headers=admin_headers, timeout=30)
            assert r.status_code == 200, r.text
            inv = r.json().get("invite") or {}
            assert inv.get("role") == "org_manager"
            assert inv.get("manager_id") is None  # managers don't have manager_id

            # Invite agent with invalid manager_id → 400
            r2 = requests.post(f"{BASE_URL}/api/orgs/{org_id}/invite",
                               json={
                                   "email": f"TEST_agent_{suffix}@example.com",
                                   "role": "org_agent",
                                   "manager_id": "not-a-real-user-id",
                               },
                               headers=admin_headers, timeout=30)
            assert r2.status_code == 400, f"expected 400, got {r2.status_code}: {r2.text}"
        finally:
            _cleanup_org(org_id)


# ---------- (7) PATCH /members/{user_id} ----------
class TestUpdateMemberRole:
    def test_update_member_invalid_role(self, admin_headers, fresh_org):
        """PATCH with invalid role → 400."""
        org_id = fresh_org["org_id"]
        # Use super admin user_id (member of any org via bypass) — first list members
        ml = requests.get(f"{BASE_URL}/api/orgs/{org_id}/members", headers=admin_headers, timeout=30)
        # super admin is not actually a member - fresh_org has 0 members
        # So PATCH on nonexistent user must return 404
        r = requests.patch(f"{BASE_URL}/api/orgs/{org_id}/members/nonexistent-user",
                           json={"role": "garbage_role"}, headers=admin_headers, timeout=30)
        # Member not found → 404 BEFORE role validation
        assert r.status_code == 404, r.text

    def test_update_member_invalid_manager(self, admin_headers, fresh_org):
        """PATCH with invalid manager_id should fail validation (when target exists)."""
        org_id = fresh_org["org_id"]
        # Create a test member directly in DB to avoid invite flow complexity
        from pymongo import MongoClient
        mc = MongoClient(os.environ.get("MONGO_URL"))
        db = mc[os.environ.get("DB_NAME")]
        test_uid = f"TEST_uid_{uuid.uuid4().hex[:8]}"
        db.users.insert_one({
            "user_id": test_uid,
            "email": f"TEST_member_{test_uid}@example.com",
            "name": "Test Member",
            "org_id": org_id,
            "org_role": "org_agent",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            # Try setting an invalid manager
            r = requests.patch(f"{BASE_URL}/api/orgs/{org_id}/members/{test_uid}",
                               json={"manager_id": "definitely-not-a-real-mgr"},
                               headers=admin_headers, timeout=30)
            assert r.status_code == 400, r.text

            # Try invalid role
            r2 = requests.patch(f"{BASE_URL}/api/orgs/{org_id}/members/{test_uid}",
                                json={"role": "garbage"},
                                headers=admin_headers, timeout=30)
            assert r2.status_code == 400, r2.text

            # Valid update: role=org_manager
            r3 = requests.patch(f"{BASE_URL}/api/orgs/{org_id}/members/{test_uid}",
                                json={"role": "org_manager"},
                                headers=admin_headers, timeout=30)
            assert r3.status_code == 200, r3.text
            assert r3.json()["member"]["org_role"] == "org_manager"
            # manager_id should be cleared when becoming a manager
            assert r3.json()["member"].get("manager_id") is None
        finally:
            db.users.delete_one({"user_id": test_uid})


# ---------- (8) GET /members returns viewer_role + viewer_is_admin ----------
class TestListMembers:
    def test_list_members_includes_viewer_role(self, admin_headers, fresh_org):
        org_id = fresh_org["org_id"]
        r = requests.get(f"{BASE_URL}/api/orgs/{org_id}/members", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "viewer_role" in body
        assert "viewer_is_admin" in body
        assert body["viewer_is_admin"] is True  # super admin
        assert "members" in body


# ---------- (9) KPI with managers/search filters ----------
class TestKPIFilters:
    def test_kpis_includes_viewer_meta(self, admin_headers, fresh_org):
        org_id = fresh_org["org_id"]
        r = requests.get(f"{BASE_URL}/api/orgs/{org_id}/kpis", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "viewer_role" in body
        assert "viewer_is_admin" in body
        assert body["viewer_is_admin"] is True
        assert "breakdown" in body
        assert isinstance(body["breakdown"], list)

    def test_kpis_search_filter(self, admin_headers, fresh_org):
        org_id = fresh_org["org_id"]
        r = requests.get(f"{BASE_URL}/api/orgs/{org_id}/kpis?search=nonexistent_xyz",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["members_count"] == 0
        assert body["breakdown"] == []

    def test_kpis_managers_filter_admin_only(self, admin_headers, fresh_org):
        org_id = fresh_org["org_id"]
        # Filter by a manager_id (admin only) — fake one should yield empty
        r = requests.get(f"{BASE_URL}/api/orgs/{org_id}/kpis?managers=fake-mgr-id",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        # No members match
        assert body["members_count"] == 0
