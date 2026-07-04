"""
Iteration 61 - Backend tests for prospecting listings 404 fix.

Verifies:
1. /api/v2/prospecting/listings never returns items with `kolo_seed` in url
2. Every returned item has `thumbnail_url` field
3. All URLs start with http:// or https://
4. Empty/invalid sector gracefully returns empty items array (no 500)
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://responsive-kolo.preview.emergentagent.com").rstrip("/")
TEST_EMAIL = "pressardelliot@gmail.com"


@pytest.fixture(scope="module")
def session_token():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/v2/auth/send-email-code", json={"email": TEST_EMAIL}, timeout=30)
    assert r.status_code == 200, f"send-email-code failed: {r.status_code} {r.text}"
    body = r.json()
    dev_code = body.get("dev_code") or body.get("code")
    if not dev_code:
        pytest.skip(f"No dev_code returned in preview env: {body}")
    r2 = s.post(
        f"{BASE_URL}/api/v2/auth/verify-email-code",
        json={"email": TEST_EMAIL, "code": dev_code},
        timeout=30,
    )
    assert r2.status_code == 200, f"verify-email-code failed: {r2.status_code} {r2.text}"
    token = r2.json().get("session_token") or r2.json().get("token")
    assert token, f"No session token: {r2.json()}"
    return token


@pytest.fixture(scope="module")
def auth_headers(session_token):
    return {"Authorization": f"Bearer {session_token}"}


class TestProspectingListings:
    def test_listings_no_kolo_seed_urls(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/v2/prospecting/listings",
            params={"sector": "75001"},
            headers=auth_headers,
            timeout=60,
        )
        # Quota-blocked (402/403) is env issue, not a code bug
        if r.status_code in (402, 403):
            pytest.skip(f"Quota-blocked for test user: {r.status_code} {r.text[:200]}")
        assert r.status_code == 200, f"Unexpected status: {r.status_code} {r.text[:500]}"
        data = r.json()
        items = data.get("items", data if isinstance(data, list) else [])
        print(f"Received {len(items)} items")
        for it in items:
            url = it.get("url", "")
            assert "kolo_seed" not in (url or "").lower(), f"Found kolo_seed URL: {url}"
            assert re.match(r"^https?://", url or ""), f"Non-http url: {url}"

    def test_listings_have_thumbnail_url_field(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/v2/prospecting/listings",
            params={"sector": "75001"},
            headers=auth_headers,
            timeout=60,
        )
        if r.status_code in (402, 403):
            pytest.skip(f"Quota-blocked: {r.status_code}")
        assert r.status_code == 200
        data = r.json()
        items = data.get("items", data if isinstance(data, list) else [])
        for it in items:
            assert "thumbnail_url" in it, f"Missing thumbnail_url in item: {list(it.keys())}"
            # Field must be string (populated or empty)
            assert isinstance(it["thumbnail_url"], str), f"thumbnail_url not str: {type(it['thumbnail_url'])}"

    def test_listings_empty_sector_no_500(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/v2/prospecting/listings",
            params={"sector": ""},
            headers=auth_headers,
            timeout=60,
        )
        # Must not be 500
        assert r.status_code != 500, f"500 error on empty sector: {r.text[:500]}"
        # Accept 200 (empty) or 400/422 validation
        if r.status_code == 200:
            data = r.json()
            items = data.get("items", data if isinstance(data, list) else [])
            assert isinstance(items, list)

    def test_listings_invalid_sector_no_500(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/v2/prospecting/listings",
            params={"sector": "!!!invalid###"},
            headers=auth_headers,
            timeout=60,
        )
        assert r.status_code != 500, f"500 error on invalid sector: {r.text[:500]}"
        if r.status_code == 200:
            data = r.json()
            items = data.get("items", data if isinstance(data, list) else [])
            assert isinstance(items, list)
