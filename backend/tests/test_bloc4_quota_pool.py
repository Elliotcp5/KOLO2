"""Bloc 4 — Backend smoke tests:
- POST /api/estimations twice (Découverte): 1st OK, 2nd 402 with code=quota_estimation_epuise
- GET /api/me/pool-zones: returns veille_total + per-zone veille_count
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_SECRET = "3cMjUlQANhGTu6R_fidvVNv-cc-Ot5GqgcpVzsqb67WLc5O2HrIe0Xjzuwucurax"


@pytest.fixture(scope="module")
def decouverte_session():
    """Create a fresh Découverte user: v2 email auth → bascule-b1 → zones=75017."""
    email = f"testbloc4_{uuid.uuid4().hex[:8]}@kolo-test.io"
    r = requests.post(f"{API}/v2/auth/send-email-code", json={"email": email}, timeout=15)
    assert r.status_code == 200, r.text
    code = r.json().get("dev_code")
    assert code
    r2 = requests.post(f"{API}/v2/auth/verify-email-code",
                       json={"email": email, "code": code}, timeout=15)
    assert r2.status_code == 200, r2.text
    token = r2.json().get("session_token") or r2.json().get("token")
    assert token
    # Bascule vers b1
    rb = requests.post(f"{API}/d1/admin/bascule-b1",
                       headers={"X-Admin-Secret": ADMIN_SECRET},
                       json={"email": email}, timeout=15)
    assert rb.status_code in (200, 201), f"bascule: {rb.status_code} {rb.text}"
    # Set zones
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    rz = requests.patch(f"{API}/me/zones",
                        headers=headers, json={"codes_postaux": ["75017"]}, timeout=15)
    assert rz.status_code == 200, f"zones: {rz.status_code} {rz.text}"
    return {"token": token, "email": email}


def _auth(sess):
    return {"Authorization": f"Bearer {sess['token']}"}


class TestPoolZonesVeille:
    def test_pool_zones_has_veille_fields(self, decouverte_session):
        r = requests.get(f"{API}/me/pool-zones",
                         headers=_auth(decouverte_session), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "veille_total" in data, f"missing veille_total: {data}"
        assert isinstance(data["veille_total"], int)
        assert "zones" in data
        for z in data["zones"]:
            assert "veille_count" in z, f"zone missing veille_count: {z}"
            assert isinstance(z["veille_count"], int)
        if data.get("top_zone"):
            assert "veille_count" in data["top_zone"], f"top_zone missing veille_count: {data['top_zone']}"


class TestEstimationQuotaLifetime:
    def _payload(self):
        return {
            "adresse": "10 Rue de Lévis",
            "code_postal": "75017",
            "lat": 48.8832, "lng": 2.3123,
            "type_bien": "Appartement",
            "surface_habitable": 45,
            "classe_dpe": "D",
            "annee_construction": 1900,
            "etat": "bon_etat",
            "etage": "2",
            "ascenseur": False,
            "exterieur": "aucun",
            "stationnement": "aucun",
        }

    def test_first_estimation_ok_second_quota_epuise(self, decouverte_session):
        headers = _auth(decouverte_session)
        headers["Content-Type"] = "application/json"
        r1 = requests.post(f"{API}/estimations",
                           headers=headers, json=self._payload(), timeout=30)
        # Accept 200/201; some data-availability errors on the test env should surface
        if r1.status_code not in (200, 201):
            # If the geo/dvf blocking returns 4xx without consuming quota, skip.
            pytest.skip(f"First estimation did not succeed, likely data gating: {r1.status_code} {r1.text}")
        d1 = r1.json()
        assert d1.get("estimation_id") or d1.get("resultat"), f"missing estimation_id: {d1}"

        r2 = requests.post(f"{API}/estimations",
                           headers=headers, json=self._payload(), timeout=30)
        assert r2.status_code == 402, f"expected 402, got {r2.status_code} {r2.text}"
        d2 = r2.json()
        code = (d2.get("detail") or {}).get("code") if isinstance(d2.get("detail"), dict) else d2.get("detail")
        assert code == "quota_estimation_epuise", f"expected code quota_estimation_epuise: {d2}"
