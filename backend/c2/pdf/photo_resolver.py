"""C2 PDF — résolution des URLs de photos relatives vers `file://` local.

Bug de fond corrigé ici (build 2.24, 12/2/2026) :

Les photos uploadées (couverture, annexes, logo agent, signature) sont
stockées dans Emergent Object Storage. En base Mongo on ne garde qu'une
URL *relative* servie par notre backend :

    photo_couverture: "/api/dossiers/{dossier_id}/photos/{photo_id}"
    logo_url        : "/api/me/logo/{logo_id}"

Le renderer WeasyPrint est SERVEUR-SIDE et ne parle pas HTTP à lui-même.
Il passait ces URLs à `optimize_image()`, qui tombait dans la branche
« fichier local » (scheme vide) → `os.path.exists("/api/dossiers/…")`
= False → retour None → **la photo disparaissait silencieusement du PDF**.

Le fix : avant de lancer WeasyPrint dans son thread, on résout toutes les
URLs relatives en récupérant les octets directement dans Object Storage
(via le helper sync `_get()`), on les écrit dans un cache disque, puis on
substitue les URLs par le chemin `file://` dans le doc dossier. `render_pdf`
n'a plus qu'à consommer le doc mutable.
"""
from __future__ import annotations

import hashlib
import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger("c2.pdf.photo_resolver")

CACHE_DIR = Path("/tmp/kolo_pdf_images")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

_RE_DOSSIER_PHOTO = re.compile(r"^/api/dossiers/([^/]+)/photos/([^/?#]+)")
_RE_LOGO = re.compile(r"^/api/me/logo/([^/?#]+)")


def _cache_path(kind: str, key: str) -> Path:
    h = hashlib.sha1(f"{kind}:{key}".encode("utf-8")).hexdigest()[:16]
    return CACHE_DIR / f"{kind}_{h}.jpg"


async def _resolve_dossier_photo(db, url_path: str) -> str | None:
    m = _RE_DOSSIER_PHOTO.match(url_path)
    if not m:
        return None
    photo_id = m.group(2)
    cache = _cache_path("dp", photo_id)
    if cache.exists() and cache.stat().st_size > 0:
        return f"file://{cache}"
    rec = await db.dossier_photos.find_one(
        {"photo_id": photo_id, "is_deleted": False},
        {"_id": 0, "storage_path": 1},
    )
    if not rec or not rec.get("storage_path"):
        logger.info("dossier_photo introuvable en Mongo: %s", photo_id)
        return None
    try:
        from ..uploads import _get  # sync helper (requests)
        data, _ct = _get(rec["storage_path"])
    except Exception as e:
        logger.warning("_get dossier_photo échec %s : %s", photo_id, e)
        return None
    try:
        cache.write_bytes(data)
    except Exception as e:
        logger.warning("write cache échec %s : %s", cache, e)
        return None
    return f"file://{cache}"


async def _resolve_logo(db, url_path: str) -> str | None:
    m = _RE_LOGO.match(url_path)
    if not m:
        return None
    logo_id = m.group(1)
    cache = _cache_path("logo", logo_id)
    if cache.exists() and cache.stat().st_size > 0:
        return f"file://{cache}"
    # Le path storage est sur users.logo_path (matché avec logo_id via logo_url)
    expected = f"/api/me/logo/{logo_id}"
    rec = await db.users.find_one(
        {"logo_url": expected},
        {"_id": 0, "logo_path": 1},
    )
    if not rec or not rec.get("logo_path"):
        logger.info("logo introuvable en Mongo: %s", logo_id)
        return None
    try:
        from ..uploads import _get
        data, _ct = _get(rec["logo_path"])
    except Exception as e:
        logger.warning("_get logo échec %s : %s", logo_id, e)
        return None
    try:
        cache.write_bytes(data)
    except Exception as e:
        logger.warning("write cache logo échec %s : %s", cache, e)
        return None
    return f"file://{cache}"


async def _resolve_one(db, url: str | None) -> str | None:
    """Retourne un `file://…` local, ou None si la source n'est pas résolvable."""
    if not url or not isinstance(url, str):
        return None
    if url.startswith("file://") or url.startswith("http://") or url.startswith("https://"):
        return url
    if _RE_DOSSIER_PHOTO.match(url):
        return await _resolve_dossier_photo(db, url)
    if _RE_LOGO.match(url):
        return await _resolve_logo(db, url)
    return url  # tel quel — le renderer se débrouillera


async def resolve_photos_in_place(db, dossier_doc: dict[str, Any]) -> None:
    """Mute `dossier_doc` en résolvant toutes les URLs de photo en `file://`.

    Champs traités :
      - sections.dossier.photo_couverture
      - sections.annexes.photos (liste)
      - sections.redacteur.logo_url
      - sections.signature.signature_image
    """
    sections = dossier_doc.get("sections") or {}

    # photo de couverture
    dossier_sec = sections.get("dossier") or {}
    cover = dossier_sec.get("photo_couverture")
    if cover:
        resolved = await _resolve_one(db, cover)
        if resolved:
            dossier_sec["photo_couverture"] = resolved
            sections["dossier"] = dossier_sec

    # photos annexes
    annexes = sections.get("annexes") or {}
    photos = annexes.get("photos") or []
    if photos:
        new_photos: list[str] = []
        for p in photos:
            r = await _resolve_one(db, p)
            if r:
                new_photos.append(r)
        annexes["photos"] = new_photos
        sections["annexes"] = annexes

    # logo agent (rédacteur)
    redacteur = sections.get("redacteur") or {}
    logo = redacteur.get("logo_url")
    if logo:
        resolved = await _resolve_one(db, logo)
        if resolved:
            redacteur["logo_url"] = resolved
            sections["redacteur"] = redacteur

    # signature
    signature = sections.get("signature") or {}
    sig = signature.get("signature_image")
    if sig:
        resolved = await _resolve_one(db, sig)
        if resolved:
            signature["signature_image"] = resolved
            sections["signature"] = signature

    dossier_doc["sections"] = sections
