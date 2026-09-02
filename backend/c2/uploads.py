"""C2 — Upload de photos vers Emergent Object Storage.

Endpoint auth `POST /api/dossiers/{id}/photos` : reçoit un fichier image,
recompresse silencieusement à 1600 px / JPEG q80, stocke dans le service objet
et retourne une URL téléchargeable par le rendu PDF (via `GET /api/dossiers/{id}/photos/{key}`).

- Jamais de base64 dans le doc Mongo.
- Path convention : `kolo/dossiers/{user_id}/{uuid}.jpg`.
- La photo de couverture attend `?type=cover` et met à jour `sections.dossier.photo_couverture`.
"""
from __future__ import annotations

import io
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import requests
from fastapi import APIRouter, HTTPException, Query, Request, Response, UploadFile, File, Header
from PIL import Image, ImageOps

logger = logging.getLogger("c2.uploads")

APP_NAME = "kolo"
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")

_storage_key: str | None = None


def init_storage(force: bool = False) -> str:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _put(path: str, data: bytes, content_type: str) -> dict[str, Any]:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=60,
    )
    if resp.status_code == 404:
        # Cached key devenue inactive → re-init une fois
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=60,
        )
    resp.raise_for_status()
    return resp.json()


def _get(path: str) -> tuple[bytes, str]:
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=30,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key}, timeout=30,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "image/jpeg")


def _compress_to_jpeg(data: bytes, max_width: int = 1600, quality: int = 80) -> bytes:
    """Recompression silencieuse. Retourne des octets JPEG."""
    with Image.open(io.BytesIO(data)) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        if im.width > max_width:
            ratio = max_width / float(im.width)
            new_size = (max_width, int(im.height * ratio))
            im = im.resize(new_size, Image.LANCZOS)
        out = io.BytesIO()
        im.save(out, format="JPEG", quality=quality, optimize=True)
        return out.getvalue()


router = APIRouter(tags=["c2-uploads"])


def _db():
    from server import db  # type: ignore
    return db


async def _current_user_doc(request: Request) -> dict[str, Any]:
    from server import get_user_from_session  # type: ignore
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    doc = await _db().users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")
    return doc


@router.post("/api/dossiers/{dossier_id}/photos")
async def upload_photo(
    dossier_id: str,
    request: Request,
    file: UploadFile = File(...),
    type: str = Query("annexe", pattern="^(cover|annexe)$"),
):
    """Upload d'une photo. `type=cover` remplace `photo_couverture`."""
    user = await _current_user_doc(request)
    db = _db()
    dos = await db.dossiers.find_one(
        {"dossier_id": dossier_id, "user_id": user["user_id"]}, {"_id": 0, "sections": 1},
    )
    if not dos:
        raise HTTPException(status_code=404, detail="dossier_introuvable")

    raw = await file.read()
    if len(raw) > 15 * 1024 * 1024:  # 15 Mo, largement suffisant avant compression
        raise HTTPException(status_code=413, detail="photo_trop_lourde")
    try:
        jpg = _compress_to_jpeg(raw)
    except Exception as e:
        logger.warning(f"compress failed: {e}")
        raise HTTPException(status_code=400, detail="photo_invalide")

    photo_id = uuid.uuid4().hex
    path = f"{APP_NAME}/dossiers/{user['user_id']}/{photo_id}.jpg"
    try:
        _put(path, jpg, "image/jpeg")
    except Exception as e:
        logger.exception(f"put_object failed: {e}")
        raise HTTPException(status_code=502, detail="storage_indisponible")

    # URL servie par le backend, sans exposer la clé de stockage.
    # Utilise un token de requête (`auth=`) pour permettre l'affichage <img> et
    # le rendu PDF côté serveur (WeasyPrint récupère le fichier via file:// après
    # cache local, via `optimize_image`).
    url_path = f"/api/dossiers/{dossier_id}/photos/{photo_id}"

    # Met à jour la section correspondante en base
    now = datetime.now(timezone.utc).isoformat()
    sections = dos.get("sections") or {}
    if type == "cover":
        dossier_sec = sections.get("dossier") or {}
        dossier_sec["photo_couverture"] = url_path
        sections["dossier"] = dossier_sec
    else:
        annexes = sections.get("annexes") or {}
        photos = annexes.get("photos") or []
        photos.append(url_path)
        annexes["photos"] = photos
        sections["annexes"] = annexes

    await db.dossiers.update_one(
        {"dossier_id": dossier_id, "user_id": user["user_id"]},
        {"$set": {"sections": sections, "date_maj": now}},
    )
    # Registre soft-delete des fichiers
    await db.dossier_photos.insert_one({
        "photo_id": photo_id,
        "dossier_id": dossier_id,
        "user_id": user["user_id"],
        "storage_path": path,
        "type": type,
        "size_bytes": len(jpg),
        "is_deleted": False,
        "created_at": now,
    })
    return {
        "ok": True,
        "photo_id": photo_id,
        "url": url_path,
        "size_bytes": len(jpg),
    }


@router.get("/api/dossiers/{dossier_id}/photos/{photo_id}")
async def get_photo(
    dossier_id: str,
    photo_id: str,
    request: Request,
    auth: str | None = Query(None),
    authorization: str | None = Header(None),
):
    """Renvoie le binaire d'une photo (auth session ou `?auth=<token>`)."""
    # Auth : ré-utilise get_user_from_session mais tolère le param `auth` (pour <img>)
    from server import get_user_from_session  # type: ignore
    if auth and not authorization:
        request.headers.__dict__.setdefault("_list", [])
    user = await get_user_from_session(request)
    if not user and auth:
        # Best-effort : le token de query doit correspondre à une session
        sess = await _db().user_sessions.find_one({"session_token": auth})
        if sess:
            udoc = await _db().users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
            if udoc:
                class _U: pass
                user = _U(); user.user_id = udoc["user_id"]
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    rec = await _db().dossier_photos.find_one({
        "photo_id": photo_id, "dossier_id": dossier_id,
        "user_id": user.user_id, "is_deleted": False,
    })
    if not rec:
        raise HTTPException(status_code=404, detail="photo_introuvable")
    try:
        data, ct = _get(rec["storage_path"])
    except Exception as e:
        logger.exception(f"get_object failed: {e}")
        raise HTTPException(status_code=502, detail="storage_indisponible")
    return Response(content=data, media_type=ct or "image/jpeg")


@router.delete("/api/dossiers/{dossier_id}/photos/{photo_id}")
async def delete_photo(dossier_id: str, photo_id: str, request: Request):
    """Soft-delete + désaccroche la référence dans le dossier."""
    user = await _current_user_doc(request)
    db = _db()
    rec = await db.dossier_photos.find_one({
        "photo_id": photo_id, "dossier_id": dossier_id,
        "user_id": user["user_id"], "is_deleted": False,
    })
    if not rec:
        raise HTTPException(status_code=404, detail="photo_introuvable")
    await db.dossier_photos.update_one(
        {"photo_id": photo_id}, {"$set": {"is_deleted": True}},
    )
    # Retire la référence dans le doc
    url_path = f"/api/dossiers/{dossier_id}/photos/{photo_id}"
    dos = await db.dossiers.find_one(
        {"dossier_id": dossier_id, "user_id": user["user_id"]}, {"_id": 0},
    )
    sections = dos.get("sections") or {}
    if (sections.get("dossier") or {}).get("photo_couverture") == url_path:
        sections["dossier"]["photo_couverture"] = None
    annexes = sections.get("annexes") or {}
    annexes["photos"] = [p for p in (annexes.get("photos") or []) if p != url_path]
    sections["annexes"] = annexes
    await db.dossiers.update_one(
        {"dossier_id": dossier_id, "user_id": user["user_id"]},
        {"$set": {"sections": sections, "date_maj": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}
