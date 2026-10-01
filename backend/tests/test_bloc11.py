"""KOLO — Bloc 11 tests
1) GET /api/opportunites/du-jour pour pressardelliot@gmail.com (plan=pro, zone=13008)
   doit retourner quota_quotidien=None, reste_du_jour=None, items>=1 si pool>0.
2) GET /api/me/veille retourne cartes avec thumbnail_url populé pour >80%.
3) Attribution à la demande: si pile vide et pool>0, la pile se re-remplit au GET.
"""
from __future__ import annotations

import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
EMAIL = "pressardelliot@gmail.com"


@pytest.fixture(scope="module")
def auth_token():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/v2/auth/send-email-code", json={"email": EMAIL})
    assert r.status_code == 200, f"send-email-code failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    code = data.get("dev_code") or data.get("code")
    assert code, f"No dev_code returned: {data}"
    r = s.post(f"{API}/v2/auth/verify-email-code", json={"email": EMAIL, "code": code})
    assert r.status_code == 200, f"verify failed: {r.status_code} {r.text[:200]}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"No token: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def client(auth_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {auth_token}"})
    return s


def test_me_profile_is_pro_b1(client):
    r = client.get(f"{API}/me/profil")
    assert r.status_code == 200, r.text[:300]
    user = r.json().get("user") or r.json()
    plan = user.get("plan")
    print(f"user plan={plan} app_version={user.get('app_version')} zones={user.get('zones_perso')}")
    assert plan in ("pro", "pro_plus", "pro_lifetime") or user.get("pro_lifetime") is True


def test_opportunites_du_jour_unlimited_quota(client):
    r = client.get(f"{API}/opportunites/du-jour?limit=10")
    assert r.status_code == 200, r.text[:500]
    data = r.json()
    print(f"du-jour: quota={data.get('quota_quotidien')} reste={data.get('reste_du_jour')} count={data.get('count')} swipes={data.get('swipes_du_jour')}")
    # Plan Pro → quota_quotidien doit être None (illimité)
    assert data.get("quota_quotidien") is None, f"Pro user must have unlimited quota, got {data.get('quota_quotidien')}"
    assert data.get("reste_du_jour") is None, f"reste_du_jour must be None for Pro, got {data.get('reste_du_jour')}"
    # Au moins 1 item attendu (pool 283 opps dans 13008)
    assert data.get("count", 0) >= 1, f"Expected >=1 items for Pro user with pool>0, got {data.get('count')}"
    items = data.get("items") or []
    assert len(items) >= 1
    # chaque item a adresse + code_postal
    for it in items[:3]:
        assert it.get("id")
        assert it.get("code_postal")


def test_veille_cards_have_thumbnail(client):
    r = client.get(f"{API}/me/veille")
    assert r.status_code == 200, r.text[:500]
    data = r.json()
    cartes = data.get("cartes") or data.get("items") or []
    print(f"veille total cards={len(cartes)}")
    if not cartes:
        pytest.skip("No veille cards for this user")
    with_thumb = sum(1 for c in cartes if (c.get("thumbnail_url") or "").startswith("http"))
    ratio = with_thumb / len(cartes)
    print(f"with_thumbnail={with_thumb}/{len(cartes)} ({ratio*100:.1f}%)")
    assert ratio >= 0.8, f"Expected >=80% cards with thumbnail, got {ratio*100:.1f}%"


def test_du_jour_attribution_on_demand(client):
    """Si la pile tombe sous le seuil et pool>0, le GET recharge via distribuer_pour_user."""
    r1 = client.get(f"{API}/opportunites/du-jour?limit=5")
    assert r1.status_code == 200
    c1 = r1.json().get("count", 0)
    # Deuxième appel immédiat — doit encore retourner >=1
    time.sleep(1)
    r2 = client.get(f"{API}/opportunites/du-jour?limit=5")
    assert r2.status_code == 200
    c2 = r2.json().get("count", 0)
    print(f"Call1 count={c1}, call2 count={c2}")
    assert c2 >= 1, "Attribution à la demande ne fonctionne pas"
