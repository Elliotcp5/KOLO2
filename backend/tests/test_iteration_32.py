"""Iteration 32 — White-label completion: 4 lots (branding everywhere, register funnel, B2B billing, subdomain).

Covers:
- GET /api/orgs/public/{slug} (auth-less) by slug AND by custom_subdomain
- GET /api/orgs/by-domain — Host header detection (preview returns {org: null})
- POST /api/admin/whitelabel/create — new fields (custom_subdomain, monthly_price_per_seat_eur)
- GET /api/orgs/{org_id}/billing — seats + monthly cost
- POST /api/orgs/{org_id}/billing/checkout — Stripe checkout URL (super admin bypass)
- POST /api/orgs/accept-invite/{token} — seats enforcement (402 when full)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
SUPER_ADMIN_EMAIL = "elliot.cohenpressard@trykolo.io"
SUPER_ADMIN_PWD = "Psychologue75007%!"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PWD,
    })
    assert r.status_code == 200, f"Super admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def created_org(api, admin_headers):
    """Create the test org once, reuse across tests. Cleans up at end."""
    suffix = uuid.uuid4().hex[:6]
    slug = f"iad-test-e2e-{suffix}"
    sub = f"iadtest{suffix}"
    payload = {
        "name": "IAD France Test E2E",
        "slug": slug,
        "primary_color": "#EC1C24",
        "secondary_color": "#000000",
        "logo_url": "https://example.com/logo.png",
        "tagline": "Test tagline",
        "seats": 2,  # small to test enforcement
        "custom_subdomain": sub,
        "monthly_price_per_seat_eur": 1900,
    }
    r = requests.post(f"{BASE_URL}/api/admin/whitelabel/create", json=payload, headers=admin_headers)
    assert r.status_code == 200, f"whitelabel/create failed: {r.status_code} {r.text}"
    data = r.json()
    org = data["org"]
    yield {"org": org, "slug": slug, "custom_subdomain": sub, "invite_url": data.get("invite_url")}
    # Teardown — best-effort
    try:
        from pymongo import MongoClient
        mc = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db_name = os.environ.get("DB_NAME", "test_database")
        mc[db_name].organizations.delete_one({"org_id": org["org_id"]})
        mc[db_name].org_invites.delete_many({"org_id": org["org_id"]})
    except Exception:
        pass


# ---------- Public branding endpoints ----------
class TestPublicBranding:
    def test_public_branding_existing_slug(self, api):
        """GET /api/orgs/public/iad-demo (seeded) returns full branding"""
        r = api.get(f"{BASE_URL}/api/orgs/public/iad-demo")
        assert r.status_code == 200, r.text
        org = r.json().get("org")
        assert org is not None
        assert org["slug"] == "iad-demo"
        # All branding fields present
        for f in ("name", "logo_url", "primary_color", "secondary_color", "tagline", "custom_subdomain"):
            assert f in org, f"Missing field: {f}"
        assert org["logo_url"] is not None and org["logo_url"].startswith("http")
        assert org["primary_color"].startswith("#")
        assert org["tagline"]
        assert org["custom_subdomain"] == "iad"

    def test_public_branding_by_custom_subdomain(self, api):
        """GET /api/orgs/public/iad (custom_subdomain) resolves to IAD org"""
        r = api.get(f"{BASE_URL}/api/orgs/public/iad")
        assert r.status_code == 200, r.text
        org = r.json().get("org")
        assert org is not None
        assert org["custom_subdomain"] == "iad"
        assert org["slug"] == "iad-demo"

    def test_public_branding_404(self, api):
        r = api.get(f"{BASE_URL}/api/orgs/public/nonexistent-org-{uuid.uuid4().hex[:6]}")
        assert r.status_code == 404

    def test_get_org_by_domain_preview_returns_null(self, api):
        """On generic preview host, /api/orgs/by-domain returns {org: null}"""
        r = api.get(f"{BASE_URL}/api/orgs/by-domain")
        assert r.status_code == 200
        assert r.json() == {"org": None} or r.json().get("org") is None


# ---------- Whitelabel create with new fields ----------
class TestWhitelabelCreate:
    def test_create_includes_new_fields(self, created_org):
        org = created_org["org"]
        assert org["custom_subdomain"] == created_org["custom_subdomain"]
        assert org["monthly_price_per_seat_eur"] == 1900
        assert org["seats_used"] == 0
        assert org["billing_status"] == "trialing"
        assert org["white_label"] is True

    def test_public_branding_by_new_subdomain(self, api, created_org):
        """The freshly created org is reachable by its custom_subdomain via the public endpoint"""
        sub = created_org["custom_subdomain"]
        r = api.get(f"{BASE_URL}/api/orgs/public/{sub}")
        assert r.status_code == 200, r.text
        org = r.json()["org"]
        assert org["custom_subdomain"] == sub
        assert org["name"] == "IAD France Test E2E"


# ---------- Billing endpoints ----------
class TestBilling:
    def test_billing_info(self, admin_headers, created_org):
        org_id = created_org["org"]["org_id"]
        r = requests.get(f"{BASE_URL}/api/orgs/{org_id}/billing", headers=admin_headers)
        assert r.status_code == 200, r.text
        b = r.json()
        for f in ("seats_used", "seats_max", "seats_available",
                  "monthly_price_per_seat_eur", "monthly_total_eur", "billing_status"):
            assert f in b, f"Missing field {f}"
        assert b["seats_max"] == 2
        assert b["monthly_price_per_seat_eur"] == 19.0
        # Super admin not member counted → seats_used=0
        assert b["seats_used"] == 0
        assert b["monthly_total_eur"] == 38.0
        assert b["billing_status"] == "trialing"

    def test_billing_checkout_stripe_url(self, admin_headers, created_org):
        """Super admin can trigger billing/checkout (bypass org member check). Returns a real Stripe URL."""
        org_id = created_org["org"]["org_id"]
        r = requests.post(
            f"{BASE_URL}/api/orgs/{org_id}/billing/checkout",
            json={"seats": 2},
            headers=admin_headers,
        )
        # 200 expected (super admin bypass) — accept 403 ONLY if admin not bypassed (regression flag)
        assert r.status_code == 200, f"checkout failed: {r.status_code} {r.text}"
        data = r.json()
        assert "checkout_url" in data
        url = data["checkout_url"]
        assert isinstance(url, str) and "stripe.com" in url, f"Expected stripe.com URL, got: {url}"


# ---------- Seats enforcement on invite acceptance ----------
class TestSeatsEnforcement:
    def test_accept_invite_returns_402_when_full(self, api, admin_headers, created_org):
        """Manually create an invite for a 2-seat org and fill the seats via direct DB ops,
        then attempt acceptance to trigger 402."""
        org_id = created_org["org"]["org_id"]
        # Fill seats: directly mark 2 users as members in the DB
        from pymongo import MongoClient
        mc = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = mc[os.environ.get("DB_NAME", "test_database")]
        filler_ids = []
        try:
            for i in range(2):
                uid = f"TEST_filler_{uuid.uuid4().hex[:10]}"
                filler_ids.append(uid)
                db.users.insert_one({
                    "user_id": uid,
                    "email": f"TEST_filler_{uid}@example.com",
                    "org_id": org_id,
                    "org_role": "agent",
                })

            # Now register a brand new user, then try to accept an invite to this org
            email = f"TEST_invitee_{uuid.uuid4().hex[:8]}@example.com"
            reg = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": email,
                "password": "testtest123",
                "name": "Test Invitee",
                "full_name": "Test Invitee",
                "phone": f"+33600{uuid.uuid4().hex[:6]}",
            })
            assert reg.status_code in (200, 201), reg.text
            invitee_token = reg.json().get("token")
            assert invitee_token

            # Create an invite directly in DB
            inv_token = uuid.uuid4().hex
            from datetime import datetime, timezone, timedelta
            db.org_invites.insert_one({
                "token": inv_token,
                "org_id": org_id,
                "email": email,
                "role": "agent",
                "accepted": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            })

            r = requests.post(
                f"{BASE_URL}/api/orgs/accept-invite/{inv_token}",
                json={},
                headers={"Authorization": f"Bearer {invitee_token}",
                         "Content-Type": "application/json"},
            )
            assert r.status_code == 402, f"Expected 402 (seats full), got {r.status_code}: {r.text}"
            assert "place" in r.text.lower() or "seat" in r.text.lower()

            # Cleanup invitee
            db.users.delete_one({"email": email})
            db.org_invites.delete_one({"token": inv_token})
        finally:
            db.users.delete_many({"user_id": {"$in": filler_ids}})
