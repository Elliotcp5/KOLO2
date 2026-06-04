"""Iteration 33 — FINAL audit marque blanche.

Adds coverage on top of iter_32:
- POST /api/admin/whitelabel/scan returns full suggestion including font_family
- POST /api/admin/whitelabel/create accepts font_family and persists it
- Public branding endpoint returns font_family field (used by OrgContext.loadGoogleFont on frontend)
- GET /api/orgs/public/responsive-kolo (no auth) — referenced in problem statement
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
SUPER_ADMIN_EMAIL = "elliot.cohenpressard@trykolo.io"
SUPER_ADMIN_PWD = "Psychologue75007%!"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PWD,
    })
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- Whitelabel/scan ----------
class TestWhitelabelScan:
    def test_scan_iadfrance_returns_full_suggestion(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/whitelabel/scan",
            json={"website_url": "https://www.iadfrance.fr"},
            headers=admin_headers,
            timeout=60,
        )
        assert r.status_code == 200, f"scan failed: {r.status_code} {r.text}"
        data = r.json()
        sug = data.get("suggestion") or data
        # All expected fields per problem statement
        for f in ("name", "primary_color", "secondary_color", "font_family", "tagline"):
            assert f in sug, f"Missing suggestion field: {f}. Got keys: {list(sug.keys())}"
        assert sug["primary_color"].startswith("#")
        assert sug["secondary_color"].startswith("#")
        assert isinstance(sug["font_family"], str) and len(sug["font_family"]) > 0
        assert isinstance(sug["tagline"], str)


# ---------- Whitelabel/create with font_family ----------
class TestWhitelabelCreateWithFont:
    @pytest.fixture(scope="class")
    def font_org(self, admin_headers):
        suffix = uuid.uuid4().hex[:6]
        slug = f"audit-font-{suffix}"
        sub = f"auditfont{suffix}"
        payload = {
            "name": "Audit Font Org",
            "slug": slug,
            "primary_color": "#3B82F6",
            "secondary_color": "#1E40AF",
            "logo_url": "https://example.com/logo.png",
            "tagline": "Test font tagline",
            "seats": 5,
            "custom_subdomain": sub,
            "monthly_price_per_seat_eur": 1900,
            "font_family": "Montserrat",
        }
        r = requests.post(f"{BASE_URL}/api/admin/whitelabel/create",
                          json=payload, headers=admin_headers)
        assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
        org = r.json()["org"]
        yield {"org": org, "slug": slug, "subdomain": sub}
        # Teardown
        try:
            from pymongo import MongoClient
            mc = MongoClient(os.environ.get("MONGO_URL"))
            db = mc[os.environ.get("DB_NAME")]
            db.organizations.delete_one({"org_id": org["org_id"]})
            db.org_invites.delete_many({"org_id": org["org_id"]})
        except Exception:
            pass

    def test_org_persisted_with_font(self, font_org):
        org = font_org["org"]
        assert org.get("font_family") == "Montserrat", f"font_family not persisted: {org.get('font_family')}"

    def test_public_endpoint_returns_font(self, font_org):
        r = requests.get(f"{BASE_URL}/api/orgs/public/{font_org['slug']}")
        assert r.status_code == 200, r.text
        org = r.json()["org"]
        assert org["font_family"] == "Montserrat"
        assert org["primary_color"] == "#3B82F6"

    def test_public_endpoint_by_subdomain(self, font_org):
        r = requests.get(f"{BASE_URL}/api/orgs/public/{font_org['subdomain']}")
        assert r.status_code == 200, r.text
        org = r.json()["org"]
        assert org["custom_subdomain"] == font_org["subdomain"]
        assert org["font_family"] == "Montserrat"


# ---------- responsive-kolo special endpoint per problem statement ----------
class TestResponsiveKoloPublic:
    def test_public_responsive_kolo(self):
        r = requests.get(f"{BASE_URL}/api/orgs/public/responsive-kolo")
        # Either 200 (if seeded) or 404. Per problem statement we just verify no auth + no 5xx.
        assert r.status_code in (200, 404), f"unexpected status: {r.status_code} {r.text}"
        if r.status_code == 200:
            assert r.json().get("org") is not None


# ---------- Public branding for iad-demo still exposes font_family ----------
class TestIadDemoFont:
    def test_iad_demo_font_field_present(self):
        r = requests.get(f"{BASE_URL}/api/orgs/public/iad-demo")
        assert r.status_code == 200
        org = r.json()["org"]
        assert "font_family" in org, f"font_family missing on iad-demo public payload: {list(org.keys())}"
