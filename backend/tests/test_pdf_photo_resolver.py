"""Test rapide du photo_resolver : URL relative → file:// local."""
import asyncio
import os
import sys
sys.path.insert(0, '/app/backend')

from unittest.mock import MagicMock, AsyncMock, patch
from c2.pdf.photo_resolver import resolve_photos_in_place, _RE_DOSSIER_PHOTO, _RE_LOGO


def test_regex_dossier_photo():
    m = _RE_DOSSIER_PHOTO.match("/api/dossiers/abc123/photos/xyz789")
    assert m and m.group(1) == "abc123" and m.group(2) == "xyz789"


def test_regex_logo():
    m = _RE_LOGO.match("/api/me/logo/logo_id_42")
    assert m and m.group(1) == "logo_id_42"


def test_resolve_dossier_photo_returns_file_url():
    db = MagicMock()
    db.dossier_photos.find_one = AsyncMock(return_value={"storage_path": "kolo/dossiers/u/x.jpg"})
    fake_bytes = b"\xff\xd8\xff\xe0test-jpeg-bytes"
    with patch("c2.uploads._get", return_value=(fake_bytes, "image/jpeg")):
        doc = {
            "sections": {
                "dossier": {"photo_couverture": "/api/dossiers/D1/photos/P1"},
                "redacteur": {"logo_url": "/api/me/logo/L1"},
                "annexes": {"photos": ["/api/dossiers/D1/photos/P2", "/api/dossiers/D1/photos/P3"]},
            }
        }
        # For logo, need users.find_one
        db.users.find_one = AsyncMock(return_value={"logo_path": "kolo/agents/u/logo.jpg"})
        # For all photos, dossier_photos.find_one returns the same storage_path
        asyncio.run(resolve_photos_in_place(db, doc))
        cover = doc["sections"]["dossier"]["photo_couverture"]
        logo = doc["sections"]["redacteur"]["logo_url"]
        photos = doc["sections"]["annexes"]["photos"]
        assert cover.startswith("file://"), f"cover not resolved: {cover}"
        assert os.path.exists(cover.replace("file://", "")), f"cover file missing: {cover}"
        assert logo.startswith("file://"), f"logo not resolved: {logo}"
        assert len(photos) == 2 and all(p.startswith("file://") for p in photos), f"photos: {photos}"
        print("PASS test_resolve_dossier_photo_returns_file_url")


if __name__ == "__main__":
    test_regex_dossier_photo()
    print("PASS test_regex_dossier_photo")
    test_regex_logo()
    print("PASS test_regex_logo")
    test_resolve_dossier_photo_returns_file_url()
    print("ALL PASS")
