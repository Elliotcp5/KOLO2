"""
KOLO — Routes A2 (Session A2)
=============================

Endpoints :
  - POST  /api/events                       : traçage produit (auth requise)
  - GET   /api/admin/config-matching        : lecture (auth admin)
  - PATCH /api/admin/config-matching        : patch profond (auth admin)
  - POST  /api/admin/a2/migrate-users       : lance la migration idempotente
  - POST  /api/admin/a2/ensure-indexes      : force le passage `ensure_a2_indexes`
  - GET   /api/admin/a2/status              : diagnostic (nb docs, indexes)

Auth admin : header `X-Admin-Secret` (ADMIN_SECRET) OU utilisateur avec
`is_super_admin=True` OU email dans la whitelist admin.
"""
from __future__ import annotations

import os
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .config import get_config, patch_config, ensure_config_seeded
from .indexes import ensure_a2_indexes
from .migration_users import migrate as migrate_users
from .tz import now_utc_iso

router = APIRouter(tags=["a2"])


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _get_db():
    from server import db  # type: ignore
    return db


async def _get_user(request: Request):
    from server import get_user_from_session  # type: ignore
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def _check_admin(request: Request, user: Optional[dict] = None) -> None:
    """Autorise si X-Admin-Secret valide OU user.is_super_admin OU whitelist."""
    provided = (request.headers.get("x-admin-secret") or "").strip()
    expected = (os.environ.get("ADMIN_SECRET") or "").strip()
    if expected and provided == expected:
        return
    if user and (user.get("is_super_admin") or user.get("role") == "super_admin"):
        return
    whitelist = {
        (os.environ.get("ADMIN_ALERT_EMAIL") or "").strip().lower(),
        "elliot.cohenpressard@trykolo.io",
        "pressardelliot@gmail.com",
    }
    whitelist.discard("")
    if user and (user.get("email") or "").lower() in whitelist:
        return
    raise HTTPException(status_code=403, detail="Admin access required")


# ============================================================================
# EVENTS  —  POST /api/events
# ============================================================================
class EventIn(BaseModel):
    nom: str
    parametres: dict[str, Any] = Field(default_factory=dict)


@router.post("/api/events")
async def post_event(payload: EventIn, request: Request):
    """Enregistre un événement produit.

    Auth : soft — si l'utilisateur est loggué, `user_id` et `email` sont posés.
    Sinon on écrit quand même l'event (utile pour un premier `paywall_affiche`
    avant login), avec `user_id=None`.
    """
    if not (payload.nom or "").strip():
        raise HTTPException(status_code=400, detail="`nom` required")

    db = _get_db()
    user_doc: Optional[dict] = None
    try:
        from server import get_user_from_session  # type: ignore
        u = await get_user_from_session(request)
        if u:
            user_doc = u if isinstance(u, dict) else u.__dict__
    except Exception:
        pass

    doc = {
        "nom": payload.nom.strip(),
        "parametres": payload.parametres or {},
        "user_id": (user_doc or {}).get("user_id"),
        "email": (user_doc or {}).get("email"),
        "date": now_utc_iso(),
        "ip": request.client.host if request.client else None,
        "ua": request.headers.get("user-agent", "")[:400],
    }
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "event": doc}


# ============================================================================
# CONFIG MATCHING — /api/admin/config-matching
# ============================================================================
@router.get("/api/admin/config-matching")
async def get_config_matching(request: Request):
    db = _get_db()
    user = None
    try:
        user = await _get_user(request)
    except HTTPException:
        pass
    _check_admin(request, user)
    cfg = await get_config(db)
    return {"ok": True, "config": cfg}


class ConfigMatchingPatch(BaseModel):
    updates: dict[str, Any]


@router.patch("/api/admin/config-matching")
async def patch_config_matching(payload: ConfigMatchingPatch, request: Request):
    db = _get_db()
    user = None
    try:
        user = await _get_user(request)
    except HTTPException:
        pass
    _check_admin(request, user)
    cfg = await patch_config(db, payload.updates or {})
    return {"ok": True, "config": cfg}


# ============================================================================
# MIGRATION & INDEXES — admin
# ============================================================================
@router.post("/api/admin/a2/migrate-users")
async def admin_migrate_users(request: Request, dry_run: bool = False):
    user = None
    try:
        user = await _get_user(request)
    except HTTPException:
        pass
    _check_admin(request, user)
    result = await migrate_users(dry_run=dry_run)
    return {"ok": True, "result": result}


@router.post("/api/admin/a2/ensure-indexes")
async def admin_ensure_indexes(request: Request):
    user = None
    try:
        user = await _get_user(request)
    except HTTPException:
        pass
    _check_admin(request, user)
    db = _get_db()
    result = await ensure_a2_indexes(db)
    await ensure_config_seeded(db)
    return {"ok": True, "indexes": {k: len(v) for k, v in result.items()}}


@router.get("/api/admin/a2/status")
async def admin_a2_status(request: Request):
    user = None
    try:
        user = await _get_user(request)
    except HTTPException:
        pass
    _check_admin(request, user)
    db = _get_db()
    collections = [
        "users", "organisations", "invitations", "opportunites",
        "zones_couvertes", "zones_demandees", "quotas", "rapprochements",
        "enrichissements", "estimations", "conversations", "signalements",
        "device_tokens", "events", "config_matching",
    ]
    counts = {c: await db[c].estimated_document_count() for c in collections}
    users_valid_role = await db.users.count_documents({
        "role": {"$in": ["independant", "directeur", "conseiller"]}
    })
    return {
        "ok": True,
        "counts": counts,
        "users_valid_role": users_valid_role,
    }
