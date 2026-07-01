"""
KOLO v2 — Webapp refonte intégrale (Accueil / Dossiers / Contacts / Agenda).

This router exposes all endpoints required by the new mobile-first iOS-style
webapp located at /app-v2. It is intentionally kept self-contained so the
historical /api routes remain untouched.
"""
from __future__ import annotations

import os
import uuid
import random
import string
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)
from typing import Optional, List, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase


# ----------------------------------------------------------------------------
# Lazy imports of server-level helpers to avoid circular references.
# ----------------------------------------------------------------------------
def _get_db():
    from server import db  # type: ignore
    return db


async def _get_user(request: Request):
    """Auth dependency reused from server."""
    from server import get_user_from_session  # type: ignore
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


router = APIRouter(prefix="/api/v2", tags=["v2"])


# ============================================================================
# MODELS
# ============================================================================
class ReminderIn(BaseModel):
    title: str
    date: str                 # YYYY-MM-DD
    time_start: Optional[str] = None   # HH:MM
    time_end: Optional[str] = None     # HH:MM
    description: Optional[str] = ""
    case_id: Optional[str] = None
    contact_id: Optional[str] = None


class NoteIn(BaseModel):
    content: str
    source: Literal["voice", "text"] = "text"
    status: Literal["pending", "processed"] = "pending"
    case_id: Optional[str] = None


class NoteUpdate(BaseModel):
    content: Optional[str] = None
    status: Optional[Literal["pending", "processed"]] = None
    case_id: Optional[str] = None


class ContactIn(BaseModel):
    civility: Literal["M.", "Mme"] = "M."
    first_name: str
    last_name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    role: Literal["buyer", "seller", "partner", "introducer", "landlord", "tenant", "other"] = "other"


class CaseIn(BaseModel):
    type: Literal["seller", "buyer"]
    contact_ids: List[str] = Field(default_factory=list)
    # Property details (seller) OR search criteria (buyer)
    property_kind: Literal["house", "apartment", "any"] = "apartment"
    surface_m2: Optional[float] = None
    rooms: Optional[int] = None
    price: Optional[float] = None
    address: Optional[str] = ""
    sectors: List[str] = Field(default_factory=list)
    notes: Optional[str] = ""


class AiChatIn(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    case_id: Optional[str] = None
    context_kind: Optional[str] = None   # "daily_tip" | "case_memory" | "free"


class EmailCodeRequest(BaseModel):
    email: str


class EmailCodeVerify(BaseModel):
    email: str
    code: str
    first_name: Optional[str] = ""
    last_name: Optional[str] = ""
    password: Optional[str] = None
    referral_code: Optional[str] = None


class OnboardingPayload(BaseModel):
    role: Optional[str] = None
    activities: List[str] = Field(default_factory=list)
    company_name: Optional[str] = ""
    team_size: Optional[str] = ""
    annual_revenue: Optional[str] = ""
    main_activity: Optional[str] = ""
    sectors: List[str] = Field(default_factory=list)
    crm_tool: Optional[str] = ""
    diffusion_platforms: List[str] = Field(default_factory=list)
    phone_country: Optional[str] = "FR"
    phone: Optional[str] = ""
    accepted_terms: bool = False
    language: Optional[str] = None


# ============================================================================
# HELPERS
# ============================================================================
def _strip_mongo(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


# ============================================================================
# ME  /api/v2/me  (returns the full user document including first_name)
# ============================================================================
@router.get("/me")
async def me(request: Request):
    user = await _get_user(request)
    db = _get_db()
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "hashed_password": 0}) or {}
    # Best-effort fallbacks
    if not user_doc.get("first_name") and user_doc.get("name"):
        parts = user_doc["name"].split(" ", 1)
        user_doc["first_name"] = parts[0]
        user_doc["last_name"] = parts[1] if len(parts) > 1 else ""
    # Track last_seen_at (for contextual inactivity nudges) — fire-and-forget
    try:
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {"last_seen_at": datetime.now(timezone.utc).isoformat()}},
        )
    except Exception:
        pass
    return user_doc


# ============================================================================
# REFERRAL  /api/v2/referral/*
# Logic: each user gets a unique referral code.
# When a new user signs up via /r/<code> and later upgrades to PRO,
# the referrer receives +1 month of PRO (stacked, no limit on referrals).
# ============================================================================
def _gen_ref_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


@router.get("/referral/info/{code}")
async def get_referral_info(code: str):
    """PUBLIC endpoint — returns referrer first name + plan invite from a referral code.
    Used by the public landing page /r/:code.
    """
    db = _get_db()
    ref = await db.v2_referrals.find_one({"code": code.upper().strip()}, {"_id": 0})
    if not ref:
        raise HTTPException(status_code=404, detail="Code de parrainage invalide")
    referrer = await db.users.find_one(
        {"user_id": ref["user_id"]},
        {"_id": 0, "first_name": 1, "last_name": 1, "email": 1, "name": 1}
    ) or {}
    first_name = (referrer.get("first_name") or "").strip()
    if not first_name and referrer.get("name"):
        first_name = referrer["name"].split(" ", 1)[0]
    if not first_name and referrer.get("email"):
        first_name = referrer["email"].split("@", 1)[0]
    return {
        "code": ref["code"],
        "referrer_first_name": first_name or "Ton parrain",
    }


@router.get("/referral/me")
async def get_my_referral(request: Request):
    user = await _get_user(request)
    db = _get_db()
    doc = await db.v2_referrals.find_one({"user_id": user.user_id}, {"_id": 0})
    if not doc:
        code = _gen_ref_code()
        while await db.v2_referrals.find_one({"code": code}):
            code = _gen_ref_code()
        doc = {
            "user_id": user.user_id,
            "code": code,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "free_months_earned": 0,
        }
        await db.v2_referrals.insert_one(doc)
        doc.pop("_id", None)

    referred = await db.v2_referrals_redeemed.find({"referrer_user_id": user.user_id}, {"_id": 0}).to_list(500)
    return {
        "code": doc["code"],
        "share_url": f"https://trykolo.io/r/{doc['code']}",
        "free_months_earned": doc.get("free_months_earned", 0),
        "referrals_total": len(referred),
        "referrals_pro": sum(1 for r in referred if r.get("converted_pro")),
        "referrals": referred,
    }


class ReferralSignup(BaseModel):
    referral_code: str
    referred_user_id: str


@router.post("/referral/attribute")
async def attribute_referral(payload: ReferralSignup, request: Request):
    """Called right after signup if the user came from a referral link."""
    db = _get_db()
    ref = await db.v2_referrals.find_one({"code": payload.referral_code.upper()})
    if not ref:
        raise HTTPException(status_code=404, detail="Code de parrainage invalide")
    # Anti-self-referral
    if ref["user_id"] == payload.referred_user_id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous parrainer vous-même")
    existing = await db.v2_referrals_redeemed.find_one({"referred_user_id": payload.referred_user_id})
    if existing:
        return {"ok": True, "already": True}
    await db.v2_referrals_redeemed.insert_one({
        "referrer_user_id": ref["user_id"],
        "referred_user_id": payload.referred_user_id,
        "code": ref["code"],
        "converted_pro": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@router.post("/referral/convert/{user_id}")
async def referral_convert_to_pro(user_id: str, request: Request):
    """
    Marque un user parrainé comme passé Pro et crédite VRAIMENT le parrain
    avec +30 jours de Pro bonus (cumulatif si déjà actif). Idempotent.
    """
    db = _get_db()
    redeem = await db.v2_referrals_redeemed.find_one({"referred_user_id": user_id})
    if not redeem or redeem.get("converted_pro"):
        return {"ok": True, "credited": False}

    await db.v2_referrals_redeemed.update_one(
        {"referred_user_id": user_id},
        {"$set": {"converted_pro": True, "converted_at": datetime.now(timezone.utc).isoformat()}},
    )
    await db.v2_referrals.update_one(
        {"user_id": redeem["referrer_user_id"]},
        {"$inc": {"free_months_earned": 1}},
    )

    # ── Crédite VRAIMENT le parrain avec +30 jours de Pro bonus
    referrer_id = redeem["referrer_user_id"]
    referrer_doc = await db.users.find_one(
        {"user_id": referrer_id}, {"_id": 0, "pro_bonus_until": 1}
    ) or {}
    now = datetime.now(timezone.utc)
    current_bonus = referrer_doc.get("pro_bonus_until")
    if current_bonus:
        try:
            if isinstance(current_bonus, str):
                current_dt = datetime.fromisoformat(current_bonus.replace("Z", "+00:00"))
            else:
                current_dt = current_bonus
            if current_dt.tzinfo is None:
                current_dt = current_dt.replace(tzinfo=timezone.utc)
            # Si bonus encore actif → extend de 30 jours. Sinon repart de now+30j.
            base = current_dt if current_dt > now else now
        except Exception:
            base = now
    else:
        base = now
    new_bonus_until = base + timedelta(days=30)
    await db.users.update_one(
        {"user_id": referrer_id},
        {"$set": {"pro_bonus_until": new_bonus_until.isoformat()}},
    )

    return {
        "ok": True,
        "credited": True,
        "referrer_pro_bonus_until": new_bonus_until.isoformat(),
    }


# ============================================================================
# REMINDERS  /api/v2/reminders
# ============================================================================
@router.post("/reminders")
async def create_reminder(payload: ReminderIn, request: Request):
    user = await _get_user(request)
    db = _get_db()
    doc = {
        "reminder_id": f"rem_{uuid.uuid4().hex[:14]}",
        "user_id": user.user_id,
        **payload.dict(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.v2_reminders.insert_one(doc)

    # Instant push if a subscription exists (best-effort, never blocks the response)
    try:
        sub = await db.push_subscriptions.find_one({"user_id": user.user_id}, {"_id": 0})
        if sub and sub.get("subscription"):
            from notification_scheduler import send_push_notification  # type: ignore
            title = "KOLO — Nouveau rappel"
            body = payload.title
            await send_push_notification(sub["subscription"], title, body, url="/app-v2/agenda")
    except Exception:
        pass

    return _strip_mongo(doc)


@router.get("/notifications/unread")
async def notifications_unread(request: Request):
    """Count of attention-worthy items for the header bell badge.
    - Today's pending reminders
    - Just-completed pige scrapings the user hasn't viewed yet
    """
    user = await _get_user(request)
    db = _get_db()
    today = datetime.now(timezone.utc).date().isoformat()
    reminders_today = await db.v2_reminders.count_documents({
        "user_id": user.user_id, "date": today, "status": "pending"
    })
    # Fresh pige results (cache populated < 30min ago)
    fresh_window = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    fresh_pige = await db.v2_listings_cache.count_documents({
        "cached_at": {"$gt": fresh_window}
    })
    count = reminders_today + (1 if fresh_pige > 0 else 0)
    return {"count": count, "reminders_today": reminders_today, "fresh_pige": fresh_pige}


@router.post("/notifications/test-push")
async def test_push_v2(request: Request):
    """Sends a test push notification to the current user (V2 push debug)."""
    user = await _get_user(request)
    db = _get_db()
    sub = await db.push_subscriptions.find_one({"user_id": user.user_id}, {"_id": 0})
    if not sub or not sub.get("subscription"):
        raise HTTPException(status_code=404, detail="Pas d'abonnement push pour cet utilisateur. Active d'abord les notifications.")
    try:
        from notification_scheduler import send_push_notification  # type: ignore
        ok = await send_push_notification(
            sub["subscription"],
            "KOLO — Test de notification",
            "Si tu vois ce message, les notifications fonctionnent ! 🎉",
            url="/app-v2",
        )
        return {"sent": bool(ok)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Push failed: {type(e).__name__}")


@router.get("/reminders")
async def list_reminders(request: Request, date: Optional[str] = None):
    user = await _get_user(request)
    db = _get_db()
    q: dict = {"user_id": user.user_id}
    if date:
        q["date"] = date
    items = await db.v2_reminders.find(q, {"_id": 0}).sort("date", 1).to_list(500)
    return {"items": items, "total": len(items)}


@router.patch("/reminders/{reminder_id}")
async def update_reminder(reminder_id: str, payload: dict, request: Request):
    user = await _get_user(request)
    db = _get_db()
    update = {k: v for k, v in payload.items() if k in {"title", "date", "time_start", "time_end", "description", "status"}}
    res = await db.v2_reminders.update_one(
        {"reminder_id": reminder_id, "user_id": user.user_id},
        {"$set": update},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"ok": True}


@router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, request: Request):
    user = await _get_user(request)
    db = _get_db()
    res = await db.v2_reminders.delete_one(
        {"reminder_id": reminder_id, "user_id": user.user_id}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"ok": True}


# ============================================================================
# NOTES  /api/v2/notes
# ============================================================================
@router.post("/notes")
async def create_note(payload: NoteIn, request: Request):
    user = await _get_user(request)
    db = _get_db()
    doc = {
        "note_id": f"nt_{uuid.uuid4().hex[:14]}",
        "user_id": user.user_id,
        **payload.dict(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.v2_notes.insert_one(doc)
    return _strip_mongo(doc)


@router.get("/notes")
async def list_notes(request: Request, status: Optional[str] = None):
    user = await _get_user(request)
    db = _get_db()
    q: dict = {"user_id": user.user_id}
    if status in {"pending", "processed"}:
        q["status"] = status
    items = await db.v2_notes.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"items": items, "total": len(items)}


@router.patch("/notes/{note_id}")
async def update_note(note_id: str, payload: NoteUpdate, request: Request):
    user = await _get_user(request)
    db = _get_db()
    update = {k: v for k, v in payload.dict(exclude_none=True).items()}
    if not update:
        return {"ok": True}
    res = await db.v2_notes.update_one(
        {"note_id": note_id, "user_id": user.user_id},
        {"$set": update},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"ok": True}


@router.delete("/notes/{note_id}")
async def delete_note(note_id: str, request: Request):
    user = await _get_user(request)
    db = _get_db()
    res = await db.v2_notes.delete_one(
        {"note_id": note_id, "user_id": user.user_id}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"ok": True}


# ============================================================================
# CONTACTS  /api/v2/contacts
# ============================================================================
@router.post("/contacts")
async def create_contact(payload: ContactIn, request: Request):
    user = await _get_user(request)
    db = _get_db()
    # Free-tier hard limit : 10 contacts max
    if not await _is_pro_user(db, user.user_id):
        current = await db.v2_contacts.count_documents({"user_id": user.user_id})
        if current >= FREE_CONTACTS_LIMIT:
            raise HTTPException(
                status_code=402,
                detail=f"Limite gratuite atteinte ({FREE_CONTACTS_LIMIT} contacts). Passe Pro pour des contacts illimités.",
            )
    doc = {
        "contact_id": f"ct_{uuid.uuid4().hex[:14]}",
        "user_id": user.user_id,
        **payload.dict(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.v2_contacts.insert_one(doc)
    return _strip_mongo(doc)


@router.get("/contacts")
async def list_contacts(request: Request, search: Optional[str] = None):
    user = await _get_user(request)
    db = _get_db()
    q: dict = {"user_id": user.user_id}
    if search:
        q["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    items = await db.v2_contacts.find(q, {"_id": 0}).sort("last_name", 1).to_list(2000)
    return {"items": items, "total": len(items)}


@router.get("/contacts/{contact_id}")
async def get_contact(contact_id: str, request: Request):
    user = await _get_user(request)
    db = _get_db()
    doc = await db.v2_contacts.find_one({"contact_id": contact_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")
    # Attach related cases
    cases = await db.v2_cases.find(
        {"user_id": user.user_id, "contact_ids": contact_id},
        {"_id": 0}
    ).to_list(200)
    return {"contact": doc, "cases": cases}


@router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, request: Request):
    user = await _get_user(request)
    db = _get_db()
    res = await db.v2_contacts.delete_one(
        {"contact_id": contact_id, "user_id": user.user_id}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"ok": True}


# ============================================================================
# CASES (dossiers)  /api/v2/cases
# ============================================================================
@router.post("/cases")
async def create_case(payload: CaseIn, request: Request):
    user = await _get_user(request)
    db = _get_db()
    doc = {
        "case_id": f"cs_{uuid.uuid4().hex[:14]}",
        "user_id": user.user_id,
        **payload.dict(),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.v2_cases.insert_one(doc)
    return _strip_mongo(doc)


@router.get("/cases")
async def list_cases(request: Request, type: Optional[str] = None, recent: bool = False, search: Optional[str] = None):
    user = await _get_user(request)
    db = _get_db()
    q: dict = {"user_id": user.user_id}
    if type in {"seller", "buyer"}:
        q["type"] = type
    if search:
        q["$or"] = [
            {"address": {"$regex": search, "$options": "i"}},
            {"notes": {"$regex": search, "$options": "i"}},
        ]
    cursor = db.v2_cases.find(q, {"_id": 0}).sort("updated_at", -1)
    limit = 7 if recent else 500
    items = await cursor.to_list(limit)

    # Enrich with primary contact name (best-effort)
    contact_ids = {cid for c in items for cid in c.get("contact_ids", [])}
    contacts_map = {}
    if contact_ids:
        contacts = await db.v2_contacts.find(
            {"user_id": user.user_id, "contact_id": {"$in": list(contact_ids)}}, {"_id": 0}
        ).to_list(2000)
        contacts_map = {c["contact_id"]: c for c in contacts}
    for c in items:
        primary = next((contacts_map.get(cid) for cid in c.get("contact_ids", []) if contacts_map.get(cid)), None)
        if primary:
            c["primary_contact"] = {
                "first_name": primary.get("first_name", ""),
                "last_name": primary.get("last_name", ""),
            }
    return {"items": items, "total": len(items)}


@router.get("/cases/{case_id}")
async def get_case(case_id: str, request: Request):
    user = await _get_user(request)
    db = _get_db()
    case = await db.v2_cases.find_one({"case_id": case_id, "user_id": user.user_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    # Related contacts, reminders, notes
    contacts = await db.v2_contacts.find(
        {"user_id": user.user_id, "contact_id": {"$in": case.get("contact_ids", [])}},
        {"_id": 0}
    ).to_list(200)
    reminders = await db.v2_reminders.find(
        {"user_id": user.user_id, "case_id": case_id}, {"_id": 0}
    ).sort("date", 1).to_list(200)
    notes = await db.v2_notes.find(
        {"user_id": user.user_id, "case_id": case_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return {"case": case, "contacts": contacts, "reminders": reminders, "notes": notes}


@router.delete("/cases/{case_id}")
async def delete_case(case_id: str, request: Request):
    user = await _get_user(request)
    db = _get_db()
    res = await db.v2_cases.delete_one(
        {"case_id": case_id, "user_id": user.user_id}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"ok": True}


# ============================================================================
# DASHBOARD  /api/v2/dashboard
# ============================================================================
@router.get("/dashboard")
async def get_dashboard(request: Request):
    """Aggregated counts for the home page (reminders today, pending notes, etc.)."""
    user = await _get_user(request)
    db = _get_db()
    today = datetime.now(timezone.utc).date().isoformat()
    reminders_today = await db.v2_reminders.count_documents({
        "user_id": user.user_id, "date": today, "status": "pending"
    })
    reminders_completed_today = await db.v2_reminders.count_documents({
        "user_id": user.user_id, "date": today, "status": "done"
    })
    reminders_created_today = reminders_today + reminders_completed_today
    notes_pending = await db.v2_notes.count_documents({
        "user_id": user.user_id, "status": "pending"
    })
    notes_processed_today = await db.v2_notes.count_documents({
        "user_id": user.user_id, "status": "processed",
        "processed_at": {"$gte": today}
    })
    notes_created_today = await db.v2_notes.count_documents({
        "user_id": user.user_id,
        "created_at": {"$gte": today}
    })
    total_contacts = await db.v2_contacts.count_documents({"user_id": user.user_id})

    # Plan info — unified check (subscription + lifetime + referral bonus)
    plan = await _is_pro_user(db, user.user_id)
    week_start = _current_week_start()
    prospecting_used_this_week = await db.v2_prospecting_log.count_documents({
        "user_id": user.user_id, "week_start": week_start
    })
    return {
        "reminders_today": reminders_today,
        "reminders_completed_today": reminders_completed_today,
        "reminders_created_today": reminders_created_today,
        "notes_pending": notes_pending,
        "notes_processed_today": notes_processed_today,
        "notes_created_today": notes_created_today,
        "total_contacts": total_contacts,
        "has_pro": bool(plan),
        "free_contacts_left": max(0, FREE_CONTACTS_LIMIT - total_contacts) if not plan else None,
        "free_contacts_limit": None if plan else FREE_CONTACTS_LIMIT,
        "prospecting_used_this_week": prospecting_used_this_week,
        "prospecting_limit_per_week": None if plan else FREE_PROSPECTING_PER_WEEK,
        "prospecting_left_this_week": None if plan else max(0, FREE_PROSPECTING_PER_WEEK - prospecting_used_this_week),
    }


# ============================================================================
# PLAN / QUOTAS  — Free tier limits
# ============================================================================
FREE_CONTACTS_LIMIT = 10
FREE_PROSPECTING_PER_WEEK = 1


async def _is_pro_user(db, user_id: str) -> bool:
    """Pro check unifié : abonnement Apple/Stripe actif OU bonus parrainage actif OU lifetime admin."""
    user_doc = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "subscription_status": 1, "pro_bonus_until": 1, "pro_lifetime": 1, "email": 1},
    ) or {}
    # 1) Pro à vie (admin/testers Apple)
    if user_doc.get("pro_lifetime"):
        return True
    # 2) Abonnement payant actif
    if user_doc.get("subscription_status") in ("active", "trialing"):
        return True
    # 3) Bonus parrainage encore valide
    bonus_until = user_doc.get("pro_bonus_until")
    if bonus_until:
        try:
            if isinstance(bonus_until, str):
                bonus_dt = datetime.fromisoformat(bonus_until.replace("Z", "+00:00"))
            else:
                bonus_dt = bonus_until
            if bonus_dt.tzinfo is None:
                bonus_dt = bonus_dt.replace(tzinfo=timezone.utc)
            if bonus_dt > datetime.now(timezone.utc):
                return True
        except Exception:
            pass
    return False
    """Returns True if user has an active or trialing subscription."""
def _current_week_start() -> str:
    """Returns the ISO date (YYYY-MM-DD) of the current week's Monday in UTC."""
    today = datetime.now(timezone.utc).date()
    monday = today - timedelta(days=today.weekday())
    return monday.isoformat()


async def _quota_snapshot(db, user_id: str) -> dict:
    """Returns the current free-plan quotas usage for a user."""
    is_pro = await _is_pro_user(db, user_id)
    contacts_used = await db.v2_contacts.count_documents({"user_id": user_id})
    week_start = _current_week_start()
    prospecting_used = await db.v2_prospecting_log.count_documents({
        "user_id": user_id, "week_start": week_start
    })
    return {
        "is_pro": is_pro,
        "contacts_used": contacts_used,
        "contacts_limit": None if is_pro else FREE_CONTACTS_LIMIT,
        "contacts_left": None if is_pro else max(0, FREE_CONTACTS_LIMIT - contacts_used),
        "prospecting_used_this_week": prospecting_used,
        "prospecting_limit_per_week": None if is_pro else FREE_PROSPECTING_PER_WEEK,
        "prospecting_left_this_week": None if is_pro else max(0, FREE_PROSPECTING_PER_WEEK - prospecting_used),
        "prospecting_window": "semaine (lundi → dimanche UTC)",
    }


async def _log_prospecting(db, user_id: str, kind: str, query: dict):
    """Logs a prospecting search (free-tier quota counting, weekly window)."""
    week_start = _current_week_start()
    await db.v2_prospecting_log.insert_one({
        "user_id": user_id,
        "week_start": week_start,
        "date": datetime.now(timezone.utc).date().isoformat(),
        "kind": kind,
        "query": query,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def _enforce_prospecting_quota(db, user_id: str):
    """Raises 402 if free user has hit this week's prospecting quota."""
    if await _is_pro_user(db, user_id):
        return
    week_start = _current_week_start()
    used = await db.v2_prospecting_log.count_documents({"user_id": user_id, "week_start": week_start})
    if used >= FREE_PROSPECTING_PER_WEEK:
        raise HTTPException(
            status_code=402,
            detail="Quota Prospection gratuit atteint (1 recherche / semaine). Passe Pro pour des recherches illimitées.",
        )


@router.get("/quota")
async def get_quota(request: Request):
    user = await _get_user(request)
    db = _get_db()
    return await _quota_snapshot(db, user.user_id)


# ============================================================================
# AI CHAT  /api/v2/ai/*
# ============================================================================
KOLO_SYSTEM_PROMPT = """Tu es KOLO, le copilote IA des agents immobiliers. Tu apportes une expertise terrain pointue : techniques de prospection, gestion de pipeline, relances commerciales, négociation, signaux marché DPE, droit immobilier (à valider par un pro). Ton chaleureux et direct, sans baratin. Pour chaque conseil, tu donnes du concret (chiffres, mots à dire, étapes). Si une question sort de ton expertise immo/commerciale, tu le dis et tu rediriges."""


LANG_INSTRUCTIONS = {
    "fr": "Tu réponds STRICTEMENT en français.",
    "en": "You MUST respond STRICTLY in English, regardless of the user's message language.",
    "it": "Devi rispondere RIGOROSAMENTE in italiano, indipendentemente dalla lingua del messaggio utente.",
    "de": "Antworte STRIKT auf Deutsch, unabhängig von der Sprache der Benutzernachricht.",
    "es": "Debes responder ESTRICTAMENTE en español, independientemente del idioma del mensaje del usuario.",
}


def _build_role_specific_persona(onboarding: dict) -> str:
    """Adapts KOLO's coaching tone to the agent profile (role, CA, séniorité)."""
    role = (onboarding.get("role") or "").lower()
    activity = (onboarding.get("main_activity") or "").lower()
    revenue = (onboarding.get("annual_revenue") or "").lower()
    team_size = (onboarding.get("team_size") or "").lower()
    sectors_count = len(onboarding.get("sectors", []) or [])

    # Default
    persona_lines = []

    # ----- ROLE
    if "directeur" in role or "réseau" in role or "reseau" in role:
        persona_lines.append(
            "L'utilisateur est un DIRIGEANT (directeur d'agence ou de réseau). "
            "Ses préoccupations : performance globale, recrutement et rétention de talents, montée en compétence des équipes, pilotage du CA, marketing/notoriété de la marque, structuration des process commerciaux, management de la motivation. "
            "Donne-lui des conseils stratégiques niveau direction : KPIs hebdo, scripts de réunion d'équipe, métriques de productivité, leviers de scale. JAMAIS de conseil 'comment décrocher un mandat' — ce n'est plus sa zone."
        )
    elif "mandataire" in role:
        persona_lines.append(
            "L'utilisateur est un MANDATAIRE indépendant (réseau type IAD/Capifrance/SAFTI). "
            "Ses spécificités : solo, multi-casquette, dépend du réseau pour les outils et la formation, marge rémunération vs charges autonome. "
            "Donne-lui des conseils d'optimisation perso : organisation, prospection en zone, dynamique de réseau, négociation honoraires, calculs net après charges."
        )
    elif "agent" in role and ("indépendant" in role or "independant" in role or "négociateur" in role or "negociateur" in role):
        persona_lines.append(
            "L'utilisateur est un AGENT INDÉPENDANT en agence ou négociateur salarié. Donne-lui du concret terrain : techniques de prospection, qualité de visite, scripts de relance, gestion du pipeline."
        )
    elif "agent" in role:
        persona_lines.append(
            "L'utilisateur est un AGENT IMMOBILIER. Donne-lui du concret terrain : techniques de prospection, qualité de visite, scripts de relance, gestion du pipeline."
        )

    # ----- SÉNIORITÉ via revenue
    if revenue in {"-30k", "0-30k", "moins de 30k", "moins_30k"}:
        persona_lines.append(
            "DÉBUTANT (CA < 30k€/an) : pédagogie maximale, vocabulaire simple, propose des actions petites et concrètes (1 par jour). Évite le jargon. Encourage et célèbre chaque progrès. Insiste sur la régularité plus que l'intensité."
        )
    elif revenue in {"30-60k", "30k-60k", "30k_60k"}:
        persona_lines.append(
            "INTERMÉDIAIRE (CA 30-60k€/an) : focus sur la professionnalisation. Process, outils, méthodes éprouvées. Comment passer de 'je fais au feeling' à 'je suis structuré'."
        )
    elif revenue in {"60-100k", "60k-100k", "60k_100k"}:
        persona_lines.append(
            "CONFIRMÉ (CA 60-100k€/an) : conseils stratégiques. Spécialisation, montée en valeur ajoutée, négociation honoraires, gestion d'un portefeuille mature. Pas de bases, va direct."
        )
    elif revenue in {"100k+", "100k_plus", "+100k", "plus de 100k"}:
        persona_lines.append(
            "EXPERT (CA > 100k€/an, top 10% du marché). Tu lui parles d'égal à égal. Aucune banalité : KPIs avancés, leverage marketing, image personnelle, expansion d'équipe, vente à haut potentiel, exit/transmission. Réponds en mode 'coach de top performeurs'."
        )

    # ----- TYPE D'ACTIVITÉ
    if "luxe" in activity or "prestige" in activity:
        persona_lines.append("Spécialité LUXE/PRESTIGE : posture commerciale haut de gamme, discrétion, networking événementiel, valorisation expérientielle, narrative storytelling premium.")
    if "neuf" in activity or "vefa" in activity:
        persona_lines.append("Spécialité NEUF/VEFA : maîtrise des dispositifs (Pinel, PTZ), travail avec promoteurs, cycles de vente longs, garanties constructeur.")
    if "commercial" in activity or "professionnel" in activity:
        persona_lines.append("Spécialité IMMO PRO/COMMERCIAL : transactions B2B, rendement, baux commerciaux, fiscalité, négociation à long terme.")
    if "location" in activity or "gestion" in activity:
        persona_lines.append("Spécialité LOCATION/GESTION : mandat de gestion, rentabilité locative, dossiers locataires, contentieux.")

    if team_size and team_size not in {"1", "solo", ""}:
        persona_lines.append(f"L'utilisateur gère/coordonne une équipe ({team_size}). Inclut des conseils de management ponctuellement.")
    if sectors_count >= 5:
        persona_lines.append("Il/elle a un large périmètre géographique — propose des conseils de priorisation et de scoring de zone.")

    if not persona_lines:
        original_role = onboarding.get("role", "") or ""
        if original_role:
            return (
                f"\n\n[Persona adaptatif]\n- L'utilisateur a indiqué le rôle '{original_role}'. "
                "Adapte tes conseils à cette spécialité immobilière. Reste pragmatique, donne du concret."
            )
        return ""

    return (
        "\n\n[Persona adaptatif — adapte STRICTEMENT tes réponses à ce profil]\n"
        + "\n".join(f"- {p}" for p in persona_lines)
    )


@router.post("/ai/chat")
async def ai_chat(payload: AiChatIn, request: Request):
    user = await _get_user(request)
    db = _get_db()
    conv_id = payload.conversation_id or f"conv_{uuid.uuid4().hex[:14]}"

    # Build optional context for case memory
    context_snippet = ""
    if payload.case_id:
        case = await db.v2_cases.find_one(
            {"case_id": payload.case_id, "user_id": user.user_id}, {"_id": 0}
        )
        if case:
            notes = await db.v2_notes.find(
                {"user_id": user.user_id, "case_id": payload.case_id}, {"_id": 0}
            ).to_list(20)
            note_lines = "\n".join(f"- {n.get('content', '')}" for n in notes[:10])
            context_snippet = (
                f"\n\n[Mémoire du dossier]\nType: {case.get('type')}\n"
                f"Bien: {case.get('property_kind')} {case.get('surface_m2') or ''}m² "
                f"{case.get('rooms') or ''} pièces\nAdresse: {case.get('address') or '—'}\n"
                f"Notes terrain:\n{note_lines or '(aucune)'}"
            )

    # Always add a lightweight global context (onboarding + counts + active dossiers)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    first_name = (user_doc.get("first_name") or "").strip() or (user_doc.get("name") or "").split(" ", 1)[0]
    onboarding = await db.v2_onboarding.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    cases_count = await db.v2_cases.count_documents({"user_id": user.user_id})
    contacts_count = await db.v2_contacts.count_documents({"user_id": user.user_id})
    today = datetime.now(timezone.utc).date().isoformat()
    reminders_today = await db.v2_reminders.count_documents({
        "user_id": user.user_id, "date": today, "status": "pending"
    })
    recent_cases = await db.v2_cases.find(
        {"user_id": user.user_id}, {"_id": 0, "type": 1, "property_kind": 1, "address": 1, "price": 1}
    ).sort("created_at", -1).to_list(5)
    recent_cases_summary = "\n".join(
        f"- {c.get('type','?')} · {c.get('property_kind','?')} · {c.get('address','—') or '—'} · {c.get('price') or '—'}€"
        for c in recent_cases
    ) or "(aucun)"

    global_ctx = (
        f"\n\n[Profil agent]\nPrénom: {first_name or '—'}. "
        f"Rôle: {onboarding.get('role') or '—'}. "
        f"Activité: {onboarding.get('main_activity') or '—'}. "
        f"CA annuel déclaré: {onboarding.get('annual_revenue') or '—'}. "
        f"Taille équipe: {onboarding.get('team_size') or '—'}. "
        f"CRM: {onboarding.get('crm_tool') or '—'}. "
        f"Secteurs: {', '.join(onboarding.get('sectors', [])) or '—'}. "
        f"Langue préférée: {user_doc.get('language') or 'fr'}.\n"
        f"[État actuel]\nContacts: {contacts_count} · Dossiers: {cases_count} · Rappels aujourd'hui: {reminders_today}.\n"
        f"[5 derniers dossiers]\n{recent_cases_summary}"
    )

    # Load the last 20 messages of this conversation so the LLM has real
    # continuity across sessions (LlmChat's own session cache is not
    # guaranteed to survive process restarts / worker rotations).
    prior_msgs = []
    if payload.conversation_id:
        cursor = db.v2_ai_messages.find(
            {"conversation_id": payload.conversation_id, "user_id": user.user_id},
            {"_id": 0, "role": 1, "content": 1},
        ).sort("created_at", -1).limit(20)
        docs = await cursor.to_list(20)
        docs.reverse()
        for d in docs:
            r = d.get("role")
            c = d.get("content") or ""
            if r and c:
                prior_msgs.append(f"[{r.upper()}] {c}")
    history_block = ("\n\n[Historique récent]\n" + "\n".join(prior_msgs)) if prior_msgs else ""

    final_message = f"{payload.message}{context_snippet}{global_ctx}{history_block}"

    # Call LLM via emergentintegrations
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY") or ""
        if not api_key:
            raise RuntimeError("EMERGENT_LLM_KEY missing")
        adaptive_persona = _build_role_specific_persona(onboarding)
        # Honor the user's language preference — captured at onboarding or
        # updated later in Settings → Language. The AI MUST answer in that
        # language even if the user's message is in another one.
        user_lang = (user_doc.get("language") or "fr").lower()[:2]
        if user_lang not in LANG_INSTRUCTIONS:
            user_lang = "fr"
        lang_directive = LANG_INSTRUCTIONS[user_lang]
        system_prompt = f"{KOLO_SYSTEM_PROMPT}\n\n{lang_directive}\n\n{adaptive_persona}"
        chat = LlmChat(api_key=api_key, session_id=conv_id, system_message=system_prompt).with_model("anthropic", "claude-sonnet-4-5-20250929")
        msg = UserMessage(text=final_message)
        response_text = await chat.send_message(msg)
    except Exception as e:
        response_text = f"Désolé, l'IA est momentanément indisponible. ({type(e).__name__})"

    # Persist
    await db.v2_ai_messages.insert_one({
        "conversation_id": conv_id,
        "user_id": user.user_id,
        "role": "user",
        "content": payload.message,
        "case_id": payload.case_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.v2_ai_messages.insert_one({
        "conversation_id": conv_id,
        "user_id": user.user_id,
        "role": "assistant",
        "content": response_text,
        "case_id": payload.case_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"conversation_id": conv_id, "reply": response_text}


@router.get("/ai/conversations")
async def list_conversations(request: Request):
    user = await _get_user(request)
    db = _get_db()
    pipeline = [
        {"$match": {"user_id": user.user_id}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$conversation_id",
            "last_message": {"$first": "$content"},
            "last_role": {"$first": "$role"},
            "last_at": {"$first": "$created_at"},
            "messages": {"$sum": 1},
        }},
        {"$sort": {"last_at": -1}},
        {"$limit": 50},
    ]
    items = await db.v2_ai_messages.aggregate(pipeline).to_list(50)
    out = [{
        "conversation_id": it["_id"],
        "last_message": (it.get("last_message") or "")[:140],
        "last_role": it.get("last_role"),
        "last_at": it.get("last_at"),
        "messages": it.get("messages", 0),
    } for it in items]
    return {"items": out}


@router.get("/ai/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, request: Request):
    user = await _get_user(request)
    db = _get_db()
    msgs = await db.v2_ai_messages.find(
        {"conversation_id": conversation_id, "user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return {"messages": msgs}


@router.get("/ai/daily-tip")
async def daily_tip(request: Request):
    """Returns a freshly generated daily tip tailored to the user's activity."""
    user = await _get_user(request)
    db = _get_db()
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    first_name = (user_doc.get("first_name") or "").strip() or (user_doc.get("name") or "").split(" ", 1)[0] or "Agent"
    contacts_count = await db.v2_contacts.count_documents({"user_id": user.user_id})
    cases_count = await db.v2_cases.count_documents({"user_id": user.user_id})
    notes_count = await db.v2_notes.count_documents({"user_id": user.user_id})
    onboarding = await db.v2_onboarding.find_one({"user_id": user.user_id}, {"_id": 0}) or {}

    activity_summary = (
        f"L'utilisateur s'appelle {first_name}. Profil onboarding: {onboarding.get('role') or '—'}. "
        f"Il a actuellement {contacts_count} contacts, {cases_count} dossiers, {notes_count} notes terrain."
    )
    prompt = (
        "Rédige un 'conseil du jour' de 4 à 6 phrases pour cet agent. "
        "Sois chaleureux, concret, expert immo. Termine par 1 question ouverte pour engager. "
        f"Données: {activity_summary}"
    )
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY") or ""
        user_lang = (user_doc.get("language") or "fr").lower()[:2]
        if user_lang not in LANG_INSTRUCTIONS:
            user_lang = "fr"
        lang_directive = LANG_INSTRUCTIONS[user_lang]
        tip_sys = f"{KOLO_SYSTEM_PROMPT}\n\n{lang_directive}\n\n{_build_role_specific_persona(onboarding)}"
        chat = LlmChat(api_key=api_key, session_id=f"tip_{user.user_id}_{datetime.now().date().isoformat()}", system_message=tip_sys).with_model("anthropic", "claude-sonnet-4-5-20250929")
        msg = UserMessage(text=prompt)
        tip = await chat.send_message(msg)
    except Exception:
        tip = f"Salut {first_name} 👋 La régularité fait la différence. Note systématiquement chaque échange terrain — c'est ce qui transforme KOLO en vrai copilote. Quel a été ton dernier échange client ?"

    suggestions = [
        "Voir mes tâches du jour",
        "Créer un contact vendeur",
        "Recevoir un conseil de prospection",
    ]
    return {"tip": tip, "suggestions": suggestions}


# ============================================================================
# EMAIL CODE AUTH  /api/v2/auth/*
# ============================================================================
def _gen_code() -> str:
    return "".join(random.choices(string.digits, k=6))


@router.post("/auth/send-email-code")
async def send_email_code(payload: EmailCodeRequest):
    db = _get_db()
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email")
    code = _gen_code()
    await db.v2_email_codes.update_one(
        {"email": email},
        {"$set": {
            "email": email,
            "code": code,
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    # Send email via Resend (best-effort)
    try:
        import resend as _resend
        resend_api_key = os.environ.get("RESEND_API_KEY", "").strip()
        sender_email = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev").strip()
        if resend_api_key:
            _resend.api_key = resend_api_key
            html = f"""
            <div style="font-family:-apple-system,Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
              <h2 style="margin:0 0 8px;font-size:22px;color:#0B0B0F;">Votre code KOLO</h2>
              <p style="font-size:14px;color:#64748B;margin:0 0 20px;">Saisissez ce code dans l'application pour confirmer votre email.</p>
              <div style="font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;padding:18px;background:#FAFAF7;border-radius:12px;">{code}</div>
              <p style="font-size:12px;color:#94A3B8;margin-top:20px;">Ce code est valable 15 minutes. Si vous n'avez pas demandé ce code, ignorez ce message.</p>
            </div>
            """
            _resend.Emails.send({
                "from": f"KOLO <{sender_email}>",
                "to": [email],
                "subject": f"Code KOLO: {code}",
                "html": html,
            })
    except Exception:
        pass
    # In dev preview, also return code so QA/curl tests can verify the flow.
    # NEVER displayed in the UI (frontend ignores dev_code).
    is_dev = os.environ.get("ENV", "dev").lower() != "production"
    return {"sent": True, **({"dev_code": code} if is_dev else {})}


class AppleAuthRequest(BaseModel):
    identity_token: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


@router.post("/auth/apple/exchange")
async def auth_apple_exchange(payload: AppleAuthRequest):
    """Verifies an Apple Sign-In identity_token (JWT RS256 from Apple),
    creates/loads a user, returns a KOLO session_token."""
    import jwt as _jwt
    db = _get_db()
    apple_client_id_ios = os.environ.get("APPLE_CLIENT_ID_IOS", "io.kolo.app").strip()
    apple_client_id_web = os.environ.get("APPLE_CLIENT_ID_WEB", "io.kolo.app.web").strip()
    try:
        jwks_client = _jwt.PyJWKClient("https://appleid.apple.com/auth/keys")
        signing_key = jwks_client.get_signing_key_from_jwt(payload.identity_token)
        decoded = _jwt.decode(
            payload.identity_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=[apple_client_id_ios, apple_client_id_web],
            issuer="https://appleid.apple.com",
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Apple token invalide: {type(e).__name__}")

    apple_user_id = decoded.get("sub")
    token_email = (decoded.get("email") or payload.email or "").lower().strip()
    if not apple_user_id:
        raise HTTPException(status_code=400, detail="Apple token sans sub")

    # Find or create user (by apple_id first, then by email)
    user_doc = await db.users.find_one({"apple_id": apple_user_id}, {"_id": 0})
    if not user_doc and token_email:
        user_doc = await db.users.find_one({"email": token_email}, {"_id": 0})

    new_user = False
    if not user_doc:
        new_user = True
        user_id = f"u_{uuid.uuid4().hex[:16]}"
        user_doc = {
            "user_id": user_id,
            "email": token_email or f"apple_{apple_user_id[:12]}@privaterelay.appleid.com",
            "first_name": payload.first_name or "",
            "last_name": payload.last_name or "",
            "name": " ".join(filter(None, [payload.first_name, payload.last_name])) or "Utilisateur",
            "apple_id": apple_user_id,
            "auth_provider": "apple",
            "subscription_status": "free",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user_doc)
    else:
        user_id = user_doc["user_id"]
        update = {"apple_id": apple_user_id, "auth_provider_last": "apple"}
        if token_email and not user_doc.get("email"):
            update["email"] = token_email
        if payload.first_name and not user_doc.get("first_name"):
            update["first_name"] = payload.first_name
        if payload.last_name and not user_doc.get("last_name"):
            update["last_name"] = payload.last_name
        await db.users.update_one({"user_id": user_id}, {"$set": update})

    session_token = f"sess_{uuid.uuid4().hex}"
    await db.v2_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"session_token": session_token, "user_id": user_id, "new_user": new_user, "email": user_doc.get("email")}


@router.post("/auth/verify-email-code")
async def verify_email_code(payload: EmailCodeVerify, request: Request):
    db = _get_db()
    email = payload.email.strip().lower()

    # ── Bypass code statique pour Apple Reviewers (uniquement applereview@trykolo.io)
    # Permet à Apple de tester l'app sans dépendre d'un mailbox réel.
    APPLE_REVIEW_EMAIL = "applereview@trykolo.io"
    APPLE_REVIEW_STATIC_CODE = "424242"
    if email == APPLE_REVIEW_EMAIL and payload.code.strip() == APPLE_REVIEW_STATIC_CODE:
        existing = await db.users.find_one({"email": email})
        if not existing:
            # Crée le compte si absent (cas edge)
            user_id = f"u_{uuid.uuid4().hex[:16]}"
            await db.users.insert_one({
                "user_id": user_id,
                "email": email,
                "first_name": "Apple",
                "last_name": "Reviewer",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "onboarding_done": True,
                "pro_lifetime": True,
                "plan": "pro",
                "subscription_status": "active",
            })
            existing = await db.users.find_one({"email": email})
        session_token = f"sess_{uuid.uuid4().hex}"
        await db.user_sessions.insert_one({
            "session_token": session_token,
            "user_id": existing["user_id"],
            "email": existing["email"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        })
        return {"verified": True, "session_token": session_token, "user_id": existing["user_id"], "new_user": False}

    record = await db.v2_email_codes.find_one({"email": email})
    if not record or record.get("code") != payload.code.strip():
        raise HTTPException(status_code=400, detail="Code incorrect")
    try:
        expires_at = datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00"))
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Code expiré")
    except HTTPException:
        raise
    except Exception:
        pass

    # If user exists → login, else create
    existing = await db.users.find_one({"email": email})
    if existing:
        # Issue a fresh session token (same pattern as server.py login flow)
        session_token = f"sess_{uuid.uuid4().hex}"
        await db.user_sessions.insert_one({
            "session_token": session_token,
            "user_id": existing["user_id"],
            "email": existing["email"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        })
        return {"verified": True, "session_token": session_token, "user_id": existing["user_id"], "new_user": False}

    # Create new user (minimal)
    user_id = f"u_{uuid.uuid4().hex[:16]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "first_name": (payload.first_name or "").strip(),
        "last_name": (payload.last_name or "").strip(),
        "auth_provider": "email_code",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "email_verified": True,
        "subscription_status": "free",
    }
    await db.users.insert_one(user_doc)
    # Auto-attribute referral if provided
    if payload.referral_code:
        try:
            ref = await db.v2_referrals.find_one({"code": payload.referral_code.upper().strip()})
            if ref and ref["user_id"] != user_id:
                existing_redeem = await db.v2_referrals_redeemed.find_one({"referred_user_id": user_id})
                if not existing_redeem:
                    await db.v2_referrals_redeemed.insert_one({
                        "referrer_user_id": ref["user_id"],
                        "referred_user_id": user_id,
                        "code": ref["code"],
                        "converted_pro": False,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    })
        except Exception:
            pass
    session_token = f"sess_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "email": email,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
    })
    return {"verified": True, "session_token": session_token, "user_id": user_id, "new_user": True}


# ============================================================================
# ONBOARDING  /api/v2/onboarding
# ============================================================================
@router.post("/onboarding")
async def save_onboarding(payload: OnboardingPayload, request: Request):
    user = await _get_user(request)
    db = _get_db()
    doc = {
        "user_id": user.user_id,
        **payload.dict(),
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.v2_onboarding.update_one(
        {"user_id": user.user_id}, {"$set": doc}, upsert=True
    )
    # Mirror essentials onto user doc
    await db.users.update_one({"user_id": user.user_id}, {"$set": {
        "onboarding_completed": True,
        "role": payload.role,
        "company_name": payload.company_name or "",
        "sectors": payload.sectors,
        "language": payload.language,
    }})

    # ---- High-value lead alert : Directeur d'agence / Réseau
    role_lower = (payload.role or "").lower()
    if any(k in role_lower for k in ("directeur", "directrice", "réseau", "reseau", "head of", "dirigeant")):
        try:
            user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
            alert_doc = {
                "alert_id": f"al_{uuid.uuid4().hex[:12]}",
                "kind": "high_value_signup",
                "user_id": user.user_id,
                "email": user_doc.get("email"),
                "first_name": user_doc.get("first_name") or "",
                "last_name": user_doc.get("last_name") or "",
                "phone": payload.phone or user_doc.get("phone"),
                "role": payload.role,
                "company_name": payload.company_name or "",
                "team_size": payload.team_size or "",
                "annual_revenue": payload.annual_revenue or "",
                "sectors": payload.sectors or [],
                "status": "new",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.v2_admin_alerts.insert_one(alert_doc)
            # Best-effort: send notification email via Resend if available
            try:
                from email_service import send_email  # type: ignore
                admin_email = os.environ.get("ADMIN_ALERT_EMAIL") or "elliot.cohenpressard@trykolo.io"

                subject = f"🚨 Compte Direction — {alert_doc['first_name']} {alert_doc['last_name']} ({payload.role})"
                html = (
                    f"<h2 style='color:#0B0B0F;'>Nouveau compte de DIRIGEANT</h2>"
                    f"<p>Un nouveau profil <strong>{payload.role}</strong> vient de finaliser son onboarding.</p>"
                    f"<table cellpadding='6' style='border-collapse:collapse;font-size:14px;'>"
                    f"<tr><td><b>Nom</b></td><td>{alert_doc['first_name']} {alert_doc['last_name']}</td></tr>"
                    f"<tr><td><b>Email</b></td><td><a href='mailto:{alert_doc['email']}'>{alert_doc['email']}</a></td></tr>"
                    f"<tr><td><b>Téléphone</b></td><td>{alert_doc['phone'] or '—'}</td></tr>"
                    f"<tr><td><b>Rôle</b></td><td>{payload.role}</td></tr>"
                    f"<tr><td><b>Entreprise</b></td><td>{payload.company_name or '—'}</td></tr>"
                    f"<tr><td><b>Taille d'équipe</b></td><td>{payload.team_size or '—'}</td></tr>"
                    f"<tr><td><b>CA annuel</b></td><td>{payload.annual_revenue or '—'}</td></tr>"
                    f"<tr><td><b>Secteurs</b></td><td>{', '.join(payload.sectors or []) or '—'}</td></tr>"
                    f"</table>"
                    f"<p style='color:#6B7280;margin-top:16px;font-size:13px;'>→ À contacter sous 24h.</p>"
                )
                await send_email(admin_email, subject, html)
            except Exception:
                pass
        except Exception:
            pass

    return {"ok": True}


class LanguageIn(BaseModel):
    language: str


@router.patch("/user/language")
async def update_user_language(payload: LanguageIn, request: Request):
    """Persist the user's preferred language so the AI answers in it.
    Called from Settings → Language when the user picks a new locale."""
    user = await _get_user(request)
    db = _get_db()
    lang = (payload.language or "fr").lower()[:2]
    if lang not in ("fr", "en", "it", "de", "es"):
        raise HTTPException(status_code=400, detail="Unsupported language")
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"language": lang}})
    await db.v2_onboarding.update_one({"user_id": user.user_id}, {"$set": {"language": lang}}, upsert=False)
    return {"ok": True, "language": lang}



@router.get("/onboarding")
async def get_onboarding(request: Request):
    user = await _get_user(request)
    db = _get_db()
    doc = await db.v2_onboarding.find_one({"user_id": user.user_id}, {"_id": 0})
    return doc or {}


# ============================================================================
# PROSPECTING — DPE (ADEME) — MOCK with realistic placeholders
# ============================================================================
@router.get("/prospecting/dpe")
async def prospecting_dpe(request: Request, sector: Optional[str] = None, score: Optional[str] = None, days: Optional[int] = None):
    """
    Real ADEME DPE API call, dataset "dpe03existant" (logements existants
    depuis juillet 2021). Uses q_fields to filter cleanly on code_postal_ban
    (the qs= structured query is blocked by the nginx WAF for arbitrary
    fields). Multi-sector queries are split into one call per token and
    merged locally, then de-duplicated on numero_dpe.

    Each item returned includes:
      - numero_dpe   : the ADEME identifier
      - dpe_url      : direct link to the official ADEME DPE viewer
                       (https://observatoire-dpe-audit.ademe.fr/afficher-dpe/<id>)
    """
    user = await _get_user(request)
    db = _get_db()
    await _enforce_prospecting_quota(db, user.user_id)
    import httpx
    parts = [p.strip() for p in (sector or "").split(",") if p.strip()]
    if not parts:
        parts = [""]  # single un-scoped call

    async def _fetch_one(token: str) -> list:
        params = [
            ("size", "30"),
            ("select", "numero_dpe,adresse_ban,code_postal_ban,nom_commune_ban,surface_habitable_logement,etiquette_dpe,etiquette_ges,date_etablissement_dpe,type_batiment,periode_construction,annee_construction"),
            ("sort", "-date_etablissement_dpe"),
        ]
        if token:
            # Token = "75001" or "Lyon 3" → filter on the appropriate BAN field
            if token.isdigit() and len(token) == 5:
                params.append(("q_fields", "code_postal_ban"))
                params.append(("q", token))
            else:
                params.append(("q_fields", "nom_commune_ban"))
                params.append(("q", token))
        if score:
            # Score filter runs as an additional fulltext on etiquette_dpe.
            # Because the WAF rejects `qs=`, we filter score client-side too.
            pass
        if days:
            # Same: date filter applied post-fetch to stay under the WAF.
            pass
        try:
            async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "KOLOApp/1.0 (contact@trykolo.io)"}) as client:
                r = await client.get(
                    "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines",
                    params=params,
                )
                if r.status_code != 200:
                    logger.warning(f"ADEME DPE HTTP {r.status_code} for token={token}")
                    return []
                return r.json().get("results", []) or []
        except Exception as e:
            logger.warning(f"ADEME DPE call failed for token={token}: {e}")
            return []

    # Fan-out (one call per sector token). Apify tokens rarely exceed 5-6.
    import asyncio as _aio
    all_rows = []
    for chunk in await _aio.gather(*[_fetch_one(t) for t in parts]):
        all_rows.extend(chunk)

    # Client-side filters (score + freshness)
    if score:
        s = score.upper()
        all_rows = [r for r in all_rows if (r.get("etiquette_dpe") or "").upper() == s]
    if days:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=int(days))).date().isoformat()
        all_rows = [r for r in all_rows if (r.get("date_etablissement_dpe") or "") >= cutoff]

    # De-duplicate on numero_dpe, keep most recent (already sorted desc)
    seen = set()
    items = []
    for row in all_rows:
        n = row.get("numero_dpe") or ""
        if not n or n in seen:
            continue
        seen.add(n)
        addr = row.get("adresse_ban") or ""
        cp = row.get("code_postal_ban") or ""
        commune = row.get("nom_commune_ban") or ""
        # Some rows already contain CP+commune in adresse_ban; keep display clean.
        display = addr if (cp in addr and commune in addr) else f"{addr}, {cp} {commune}".strip().strip(",")
        items.append({
            "numero_dpe": n,
            "address": display,
            "code_postal": cp,
            "commune": commune,
            "surface": row.get("surface_habitable_logement"),
            "energy": row.get("etiquette_dpe") or "—",
            "climate": row.get("etiquette_ges") or "—",
            "issued_at": row.get("date_etablissement_dpe") or "",
            "building_type": row.get("type_batiment") or "",
            "construction_period": row.get("periode_construction") or "",
            "construction_year": row.get("annee_construction") or None,
            # Direct link to the official ADEME public DPE viewer.
            "dpe_url": f"https://observatoire-dpe-audit.ademe.fr/afficher-dpe/{n}",
        })
        if len(items) >= 40:
            break

    await _log_prospecting(db, user.user_id, "dpe", {"sector": sector, "score": score, "days": days, "count": len(items)})
    return {"items": items, "source": "ADEME", "total_returned": len(items)}


# ============================================================================
# Supabase enrichment helpers (listings table)
# Contract: table `public.listings` created via /app/supabase_setup.sql.
# We use the REST API directly (postgrest) with the service_role key so no
# extra dependency is required — httpx is already in requirements.
# ============================================================================
def _supabase_config():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SECRET_KEY", "").strip()
    return (url, key) if (url and key) else (None, None)


def _sb_headers(key: str, prefer: str = "return=representation") -> dict:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


async def _read_supabase_listings(sector: str, age: Optional[str] = None, kind: Optional[str] = None, limit: int = 40) -> list:
    """Read listings from Supabase filtered by postal codes + freshness.
    Returns [] if the table doesn't exist yet or Supabase is unreachable.
    """
    url, key = _supabase_config()
    if not url or not key:
        return []
    parts = [p.strip() for p in (sector or "").split(",") if p.strip()]
    postal_codes = [p for p in parts if p.isdigit() and len(p) == 5]
    if not postal_codes:
        return []
    # Freshness cutoff (age = '30' | '90' | '90+' matches app UI onglets)
    cutoff = None
    if age == "30":
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    elif age == "90":
        cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    params = {
        "select": "external_id,portal,postal_code,city,price,surface,rooms,title,url,thumbnail_url,energy_class,kind,first_seen_at,last_seen_at",
        "is_active": "eq.true",
        "postal_code": f"in.({','.join(postal_codes)})",
        "order": "first_seen_at.desc",
        "limit": str(limit),
    }
    if cutoff:
        params["first_seen_at"] = f"gte.{cutoff}"
    elif age == "90+":
        cutoff_old = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        params["first_seen_at"] = f"lt.{cutoff_old}"
    if kind == "private":
        params["kind"] = "eq.private"

    import httpx
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(f"{url}/rest/v1/listings", params=params, headers=_sb_headers(key))
            if r.status_code != 200:
                if r.status_code == 404 and "listings" in (r.text or ""):
                    logger.info("Supabase listings table not found — did you run /app/supabase_setup.sql yet?")
                else:
                    logger.warning(f"Supabase read HTTP {r.status_code}: {r.text[:200]}")
                return []
            rows = r.json() or []
    except Exception as e:
        logger.warning(f"Supabase read failed: {e}")
        return []

    # Normalise to the same shape the mobile app expects.
    out = []
    for row in rows:
        out.append({
            "external_id": row.get("external_id"),
            "title": row.get("title") or "Annonce",
            "sector": row.get("city") or row.get("postal_code") or "",
            "postal_code": row.get("postal_code") or "",
            "price": row.get("price") or 0,
            "surface": row.get("surface") or 0,
            "rooms": row.get("rooms") or 0,
            "kind": row.get("kind") or "private",
            "photo": row.get("thumbnail_url") or "",
            "url": row.get("url") or "",
            "source_site": row.get("portal") or "",
            "energy_class": row.get("energy_class") or "",
            "posted_at": row.get("first_seen_at") or "",
            "first_seen_at": row.get("first_seen_at") or "",
            "last_seen_at": row.get("last_seen_at") or "",
        })
    return out


async def _upsert_supabase_listings(rows: list, portal_default: str = "leboncoin") -> int:
    """Upsert normalised Apify rows into Supabase.
    Preserves first_seen_at on conflict (portal, external_id).
    """
    url, key = _supabase_config()
    if not url or not key or not rows:
        return 0
    import httpx, hashlib as _hh
    payload = []
    now_iso = datetime.now(timezone.utc).isoformat()
    for row in rows:
        ext_id = row.get("external_id") or row.get("id") or row.get("url") or ""
        if not ext_id:
            continue
        # Use a stable hash of the URL when the portal doesn't expose a real id.
        if not str(ext_id).isdigit():
            ext_id = _hh.sha1(str(ext_id).encode()).hexdigest()[:24]
        portal = (row.get("source") or row.get("portal") or portal_default or "").lower() or portal_default
        payload.append({
            "external_id": str(ext_id),
            "portal": portal,
            "postal_code": str(row.get("postalCode") or row.get("postal_code") or "") or None,
            "city": row.get("city") or row.get("commune") or None,
            "price": int(row.get("price") or 0) or None,
            "surface": int(row.get("surface") or row.get("area") or 0) or None,
            "rooms": int(row.get("rooms") or row.get("nbRooms") or 0) or None,
            "title": row.get("title") or (row.get("description") or "")[:120] or "Annonce",
            "url": row.get("url") or row.get("link") or "",
            "thumbnail_url": (row.get("photos") or [None])[0] if isinstance(row.get("photos"), list) and row.get("photos") else (row.get("photo") or ""),
            "energy_class": row.get("dpe") or row.get("energy") or None,
            "kind": "pro" if (row.get("ownerType") == "agency" or row.get("isPro")) else "private",
            "raw_data": row,
            "last_seen_at": now_iso,
            "is_active": True,
            "updated_at": now_iso,
        })
    if not payload:
        return 0
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{url}/rest/v1/listings",
                params={"on_conflict": "portal,external_id"},
                headers={**_sb_headers(key, prefer="resolution=merge-duplicates,return=minimal")},
                json=payload,
            )
            if r.status_code in (200, 201, 204):
                return len(payload)
            logger.warning(f"Supabase upsert HTTP {r.status_code}: {r.text[:200]}")
            return 0
    except Exception as e:
        logger.warning(f"Supabase upsert failed: {e}")
        return 0



@router.get("/prospecting/listings")
async def prospecting_listings(request: Request, sector: Optional[str] = None, kind: Optional[str] = None, age: Optional[str] = None):
    """Multi-source French real-estate listings via Apify (LBC + SeLoger + PAP + Bien'ici + Logic-immo).
    Uses actor `dltik/pige-immo-fr-scraper`. Cache 6h.

    Priority read order:
      1. Supabase `listings` table (fast, persistent, tracks first_seen_at
         for accurate freshness filters — see /app/supabase_setup.sql)
      2. In-app Mongo cache (6h TTL from a previous scrape)
      3. Live Apify kickoff + short poll
      4. Empty state with hint (no fake placeholder)
    """
    user = await _get_user(request)
    db = _get_db()
    await _enforce_prospecting_quota(db, user.user_id)
    apify_token = os.environ.get("APIFY_API_TOKEN", "").strip()
    actor_id = os.environ.get("APIFY_ACTOR_PIGE_IMMO", "dltik/pige-immo-fr-scraper").strip().replace("/", "~")

    # ---- STEP 1: Try Supabase enrichment DB first ----
    # Query the shared `listings` table by postal_code(s) with the age filter
    # (age = '30' / '90' / '90+' matches ONBOARDING onglets).
    if sector:
        sb_items = await _read_supabase_listings(sector=sector, age=age, kind=kind)
        if sb_items:
            await _log_prospecting(db, user.user_id, "listings", {"sector": sector, "source": "supabase", "count": len(sb_items)})
            return {"items": sb_items, "source": "Pige (KOLO DB)", "hint": None}

    # ---- REAL CALL via Apify Pige Immo (STEP 2/3) ----
    if apify_token and sector:
        cache_key = f"apify_pige_{sector}_{kind or 'any'}"
        cached = await db.v2_listings_cache.find_one({"key": cache_key}, {"_id": 0})
        if cached:
            try:
                cached_at = datetime.fromisoformat(cached["cached_at"])
                if datetime.now(timezone.utc) - cached_at < timedelta(hours=6):
                    await _log_prospecting(db, user.user_id, "listings", {"sector": sector, "cached": True})
                    return {"items": cached.get("items", []), "source": "Pige Immo (cache)"}
            except Exception:
                pass

        # Check if a previous run is pending — if so, try to fetch its dataset now
        pending = await db.v2_listings_pending.find_one({"key": cache_key}, {"_id": 0})
        if pending:
            import httpx as _hx
            try:
                async with _hx.AsyncClient(timeout=20) as client:
                    sr = await client.get(f"https://api.apify.com/v2/acts/{pending['actor_id']}/runs/{pending['run_id']}?token={apify_token}")
                    if sr.status_code == 200:
                        pdata = sr.json().get("data", {})
                        pstatus = pdata.get("status", "")
                        if pstatus == "SUCCEEDED":
                            dr = await client.get(
                                f"https://api.apify.com/v2/datasets/{pending['dataset_id']}/items?token={apify_token}&clean=true&limit=30"
                            )
                            if dr.status_code == 200:
                                raw = dr.json() or []
                                items = []
                                for row in raw[:30]:
                                    items.append({
                                        "title": row.get("title") or row.get("description", "")[:60] or "Annonce",
                                        "sector": str(row.get("city") or row.get("postalCode") or sector),
                                        "price": row.get("price") or 0,
                                        "surface": row.get("surface") or row.get("area") or 0,
                                        "rooms": row.get("rooms") or row.get("nbRooms") or 0,
                                        "kind": "pro" if (row.get("ownerType") == "agency" or row.get("isPro")) else "private",
                                        "photo": (row.get("photos") or [None])[0] if isinstance(row.get("photos"), list) and row.get("photos") else (row.get("photo") or ""),
                                        "url": row.get("url") or row.get("link") or "",
                                        "source_site": row.get("source") or row.get("portal") or "",
                                        "energy_class": row.get("dpe") or row.get("energy") or "",
                                        "posted_at": row.get("publishedAt") or row.get("date") or "",
                                    })
                                if items:
                                    await db.v2_listings_cache.update_one(
                                        {"key": cache_key},
                                        {"$set": {"key": cache_key, "items": items, "cached_at": datetime.now(timezone.utc).isoformat()}},
                                        upsert=True,
                                    )
                                    # Enrich the shared Supabase DB so future
                                    # queries on the same postal code are instant.
                                    try:
                                        await _upsert_supabase_listings(raw, portal_default="leboncoin")
                                    except Exception as _sbe:
                                        logger.warning(f"Supabase upsert (pending path) failed: {_sbe}")
                                    await db.v2_listings_pending.delete_one({"key": cache_key})
                                    await _log_prospecting(db, user.user_id, "listings", {"sector": sector, "from_pending": True})
                                    return {"items": items, "source": "Pige Immo (LBC+PAP)"}
                        elif pstatus in ("RUNNING", "READY"):
                            return {"items": [], "source": "scraping_in_progress", "hint": "Pige toujours en cours, réessaie dans 30s."}
                        else:
                            # Failed/timed-out — wipe pending so we can try again
                            await db.v2_listings_pending.delete_one({"key": cache_key})
            except Exception as e:
                logger.warning(f"Pending check failed: {e}")

        import httpx
        # Multi-sector support: split comma-separated chips and route each
        # token to postalCodes (if it's a 5-digit ZIP) or cities (otherwise).
        parts = [p.strip() for p in sector.split(',') if p.strip()]
        postal_codes = [p for p in parts if p.isdigit() and len(p) == 5]
        cities = [p for p in parts if not (p.isdigit() and len(p) == 5)]
        apify_input = {
            "sources": ["leboncoin", "pap"],
            "transaction": "buy",
            "maxItems": 15,
        }
        if postal_codes:
            apify_input["postalCodes"] = postal_codes
        if cities:
            apify_input["cities"] = cities
        if kind == "private":
            apify_input["onlyOwner"] = True

        # Pattern: async kick off + short polling (~12s max) to avoid Cloudflare 502.
        # If still running we store the run_id and the next call picks the dataset.
        run_url = f"https://api.apify.com/v2/acts/{actor_id}/runs?token={apify_token}"
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(run_url, json=apify_input)
                if r.status_code in (200, 201):
                    run_data = r.json().get("data", {})
                    run_id = run_data.get("id")
                    dataset_id = run_data.get("defaultDatasetId")
                    if not run_id or not dataset_id:
                        raise RuntimeError("no run_id")

                    # Short poll: max ~12s (6 iters × 2s) — well below CF 524 (≈100s) but fast enough
                    # to return immediate hits when Apify warm-cached the query
                    import asyncio as _aio
                    status = "RUNNING"
                    for _ in range(6):
                        await _aio.sleep(2)
                        try:
                            sr = await client.get(f"https://api.apify.com/v2/acts/{actor_id}/runs/{run_id}?token={apify_token}")
                            if sr.status_code == 200:
                                status = sr.json().get("data", {}).get("status", "")
                                if status in ("SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"):
                                    break
                        except Exception:
                            break

                    if status == "SUCCEEDED":
                        dr = await client.get(
                            f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={apify_token}&clean=true&limit=30"
                        )
                        if dr.status_code == 200:
                            raw = dr.json() or []
                            items = []
                            for row in raw[:30]:
                                items.append({
                                    "title": row.get("title") or row.get("description", "")[:60] or "Annonce",
                                    "sector": str(row.get("city") or row.get("postalCode") or sector),
                                    "price": row.get("price") or 0,
                                    "surface": row.get("surface") or row.get("area") or 0,
                                    "rooms": row.get("rooms") or row.get("nbRooms") or 0,
                                    "kind": "pro" if (row.get("ownerType") == "agency" or row.get("isPro")) else "private",
                                    "photo": (row.get("photos") or [None])[0] if isinstance(row.get("photos"), list) and row.get("photos") else (row.get("photo") or ""),
                                    "url": row.get("url") or row.get("link") or "",
                                    "source_site": row.get("source") or row.get("portal") or "",
                                    "energy_class": row.get("dpe") or row.get("energy") or "",
                                    "posted_at": row.get("publishedAt") or row.get("date") or "",
                                })
                            if items:
                                try:
                                    await db.v2_listings_cache.update_one(
                                        {"key": cache_key},
                                        {"$set": {"key": cache_key, "items": items, "cached_at": datetime.now(timezone.utc).isoformat()}},
                                        upsert=True,
                                    )
                                except Exception:
                                    pass
                                # Also persist to Supabase for the shared enrichment DB
                                try:
                                    await _upsert_supabase_listings(raw, portal_default="leboncoin")
                                except Exception as _sbe:
                                    logger.warning(f"Supabase upsert (fresh path) failed: {_sbe}")
                                await _log_prospecting(db, user.user_id, "listings", {"sector": sector, "kind": kind})
                                return {"items": items, "source": "Pige Immo (LBC+PAP)"}
                    # If still running, store run info so next call can pick up the dataset
                    if status not in ("SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"):
                        await db.v2_listings_pending.update_one(
                            {"key": cache_key},
                            {"$set": {
                                "key": cache_key,
                                "run_id": run_id,
                                "dataset_id": dataset_id,
                                "actor_id": actor_id,
                                "started_at": datetime.now(timezone.utc).isoformat(),
                                "sector": sector,
                            }},
                            upsert=True,
                        )
                        # Don't consume quota for a pending run (user got nothing useful)
                        return {
                            "items": [],
                            "source": "scraping_in_progress",
                            "hint": "Pige en cours sur LeBonCoin + PAP — réessaie dans 1 minute. Le scraping peut prendre 1-3 min en 1ère recherche.",
                        }
                    logger.warning(f"Apify run status={status} — falling back to placeholder")
                else:
                    logger.warning(f"Apify kickoff failed {r.status_code}: {r.text[:200]}")
        except Exception as e:
            logger.warning(f"Apify error: {type(e).__name__}: {e}")

    # ---- No live data available — return empty so the UI shows
    # a clean "Analyse en cours" or "Aucun résultat" state.
    # We DO NOT return fake/sample items here (per product brief: never show
    # placeholder data to the user, it kills trust).
    await _log_prospecting(db, user.user_id, "listings", {"sector": sector, "kind": kind, "age": age})
    return {
        "items": [],
        "source": "scraping_in_progress",
        "hint": "Analyse en cours — récupération des annonces en arrière-plan.",
    }


# ============================================================================
# ESTIMATION IMMOBILIÈRE  /api/v2/estimate
# Basée sur DVF (Base des Valeurs Foncières, data.gouv.fr) + annonces récentes
# du secteur en base Supabase. Retourne prix estimé + fourchette + comparables.
# ============================================================================
class EstimateIn(BaseModel):
    postal_code: str
    surface_m2: float
    rooms: Optional[int] = None
    property_kind: Optional[str] = "apartment"  # 'apartment' | 'house'
    dpe: Optional[str] = None  # A..G
    year_built: Optional[int] = None
    address: Optional[str] = None


@router.post("/estimate")
async def estimate_property(payload: EstimateIn, request: Request):
    """Estimation immobilière basée sur DVF (transactions réelles) + annonces
    actives du CP en base Supabase. Ajustements hédoniques (DPE, période).
    Jamais de placeholder — si aucune donnée, on le dit clairement."""
    user = await _get_user(request)
    db = _get_db()
    cp = payload.postal_code.strip()
    surface = float(payload.surface_m2 or 0)
    if not cp or surface <= 0:
        raise HTTPException(status_code=400, detail="postal_code et surface_m2 requis")

    import httpx
    prices_per_m2 = []
    comparables = []

    # --- Source 1: DVF via api.cquest.org (open data DGFIP mirror) ---
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            type_local = "Appartement" if (payload.property_kind or "").lower().startswith("apart") else "Maison"
            r = await client.get(
                "https://api.cquest.org/dvf",
                params={"code_postal": cp, "type_local": type_local, "limit": 200},
            )
            if r.status_code == 200:
                data = r.json() or {}
                for row in (data.get("resultats") or []):
                    val = row.get("valeur_fonciere")
                    s = row.get("surface_reelle_bati")
                    if not val or not s or float(s) < 8 or float(s) > 500:
                        continue
                    ppm = float(val) / float(s)
                    if 500 < ppm < 30000:
                        prices_per_m2.append(ppm)
                        if len(comparables) < 8:
                            comparables.append({
                                "source": "DVF",
                                "price": int(float(val)),
                                "surface": float(s),
                                "rooms": row.get("nombre_pieces_principales"),
                                "date": row.get("date_mutation"),
                                "address": row.get("adresse_nom_voie") or row.get("commune", ""),
                                "price_per_m2": round(ppm),
                            })
    except Exception as e:
        logger.info(f"DVF fetch skipped: {e}")

    # --- Source 2: Annonces récentes (Supabase listings) ---
    if len(prices_per_m2) < 8:
        sb_url, sb_key = _supabase_config()
        if sb_url and sb_key:
            try:
                async with httpx.AsyncClient(timeout=6) as client:
                    r = await client.get(
                        f"{sb_url}/rest/v1/listings",
                        params={
                            "select": "price,surface,rooms,title,url,first_seen_at,city",
                            "postal_code": f"eq.{cp}",
                            "is_active": "eq.true",
                            "order": "first_seen_at.desc",
                            "limit": "100",
                        },
                        headers=_sb_headers(sb_key, prefer="return=representation"),
                    )
                    if r.status_code == 200:
                        for row in r.json() or []:
                            price = row.get("price") or 0
                            s = row.get("surface") or 0
                            if price > 10000 and s > 8:
                                ppm = float(price) / float(s)
                                if 500 < ppm < 30000:
                                    prices_per_m2.append(ppm)
                                    if len(comparables) < 12:
                                        comparables.append({
                                            "source": "Annonce",
                                            "price": int(price),
                                            "surface": float(s),
                                            "rooms": row.get("rooms"),
                                            "date": (row.get("first_seen_at") or "")[:10],
                                            "address": row.get("city") or cp,
                                            "url": row.get("url"),
                                            "price_per_m2": round(ppm),
                                        })
            except Exception as e:
                logger.info(f"Supabase estimate fetch skipped: {e}")

    if not prices_per_m2:
        return {
            "ok": False,
            "message": f"Pas assez de données publiques pour {cp}. Essaie une zone plus large ou lance une pige d'annonces d'abord.",
            "postal_code": cp,
        }

    prices_per_m2.sort()
    n = len(prices_per_m2)
    p10 = prices_per_m2[max(0, n // 10)]
    p90 = prices_per_m2[min(n - 1, (n * 9) // 10)]
    trimmed = [p for p in prices_per_m2 if p10 <= p <= p90] or prices_per_m2
    trimmed.sort()
    median_ppm = trimmed[len(trimmed) // 2]

    dpe_factor = {"A": 1.06, "B": 1.04, "C": 1.02, "D": 1.00, "E": 0.97, "F": 0.93, "G": 0.89}
    factor = dpe_factor.get((payload.dpe or "").upper(), 1.0)
    if payload.year_built:
        if payload.year_built >= 2015: factor *= 1.03
        elif payload.year_built <= 1948: factor *= 0.97
    if surface < 25: factor *= 1.05
    elif surface > 120: factor *= 0.97

    est_ppm = median_ppm * factor
    estimate = est_ppm * surface
    conf_pct = 0.08 if n >= 30 else (0.10 if n >= 15 else 0.15)
    return {
        "ok": True,
        "postal_code": cp,
        "surface_m2": surface,
        "sample_size": n,
        "median_price_per_m2": round(median_ppm),
        "adjusted_price_per_m2": round(est_ppm),
        "estimate": round(estimate),
        "min": round(estimate * (1 - conf_pct)),
        "max": round(estimate * (1 + conf_pct)),
        "confidence": "high" if n >= 30 else ("medium" if n >= 10 else "low"),
        "adjustments_applied": {"dpe": payload.dpe, "year_built": payload.year_built, "factor": round(factor, 3)},
        "comparables": comparables[:8],
        "source": "DVF (data.gouv.fr) + annonces KOLO",
    }


# ============================================================================
# CRON /api/v2/cron/collect-listings  (protégé par CRON_SECRET)
# Déclenchable par GitHub Actions / Vercel Cron / n'importe quel scheduler.
# ============================================================================
@router.post("/cron/collect-listings")
async def cron_collect_listings(request: Request):
    """Auth: header `X-Cron-Secret: <CRON_SECRET>`. Boucle sur CRON_POSTAL_CODES
    (defaults to major FR cities) et upsert dans Supabase."""
    secret = os.environ.get("CRON_SECRET", "")
    header_secret = request.headers.get("X-Cron-Secret", "") or request.headers.get("x-cron-secret", "")
    if not secret or header_secret != secret:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Cron-Secret header")

    apify_token = os.environ.get("APIFY_API_TOKEN", "").strip()
    actor_id = os.environ.get("APIFY_ACTOR_PIGE_IMMO", "dltik/pige-immo-fr-scraper").strip().replace("/", "~")
    if not apify_token:
        raise HTTPException(status_code=503, detail="APIFY_API_TOKEN missing")

    default_codes = "75001,75002,75003,75004,75005,75006,75007,75008,75009,75010,75011,75015,75016,75017,75018,69001,69002,69003,69006,69007,13001,13006,13008,33000,33200,31000,31100"
    codes = [c.strip() for c in (os.environ.get("CRON_POSTAL_CODES") or default_codes).split(",") if c.strip()]

    import httpx
    results = []
    async with httpx.AsyncClient(timeout=90) as client:
        for cp in codes:
            try:
                apify_input = {"sources": ["leboncoin", "pap"], "transaction": "buy", "maxItems": 40, "postalCodes": [cp]}
                r = await client.post(
                    f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items?token={apify_token}",
                    json=apify_input,
                )
                if r.status_code == 200:
                    raw = r.json() or []
                    n = await _upsert_supabase_listings(raw, portal_default="leboncoin")
                    results.append({"cp": cp, "fetched": len(raw), "upserted": n})
                else:
                    results.append({"cp": cp, "error": f"apify HTTP {r.status_code}"})
            except Exception as e:
                results.append({"cp": cp, "error": str(e)[:120]})

    return {"ok": True, "run_at": datetime.now(timezone.utc).isoformat(), "results": results}


# ============================================================================
# PROMO CODES  /api/v2/promo/*
# ============================================================================
class PromoRedeemRequest(BaseModel):
    code: str


@router.post("/promo/redeem")
async def promo_redeem(payload: PromoRedeemRequest, request: Request):
    """Redeem a promo code → grants free Pro days to the user.

    Codes are stored in `v2_promo_codes`:
      { code, days, max_redemptions (None=unlimited), redeemed_count,
        active, single_use, redeemed_by: [user_id, ...] }
    """
    user = await _get_user(request)
    db = _get_db()
    code = (payload.code or "").strip().upper()
    if not code or len(code) < 3:
        raise HTTPException(status_code=400, detail="Code invalide")

    promo = await db.v2_promo_codes.find_one({"code": code})
    if not promo or not promo.get("active", True):
        raise HTTPException(status_code=404, detail="Ce code n'existe pas ou n'est plus actif.")

    days = int(promo.get("days") or 0)
    if days <= 0:
        raise HTTPException(status_code=400, detail="Code invalide (durée nulle).")

    redeemed_by = promo.get("redeemed_by") or []
    if user.user_id in redeemed_by:
        raise HTTPException(status_code=409, detail="Tu as déjà utilisé ce code.")

    max_red = promo.get("max_redemptions")
    redeemed_count = int(promo.get("redeemed_count") or 0)
    if max_red is not None and redeemed_count >= int(max_red):
        raise HTTPException(status_code=410, detail="Ce code a atteint sa limite d'utilisations.")

    # Grant free Pro days: extend pro_bonus_until (same field used by referrals)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    now = datetime.now(timezone.utc)
    cur_until = user_doc.get("pro_bonus_until")
    try:
        base = datetime.fromisoformat(cur_until.replace("Z", "+00:00")) if isinstance(cur_until, str) else (cur_until or now)
        if base.tzinfo is None:
            base = base.replace(tzinfo=timezone.utc)
        if base < now:
            base = now
    except Exception:
        base = now
    new_until = base + timedelta(days=days)

    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"pro_bonus_until": new_until.isoformat(), "updated_at": now.isoformat()}},
    )
    await db.v2_promo_codes.update_one(
        {"code": code},
        {"$inc": {"redeemed_count": 1}, "$push": {"redeemed_by": user.user_id}},
    )
    return {
        "ok": True,
        "code": code,
        "granted_days": days,
        "pro_until": new_until.isoformat(),
    }


class PromoCreateRequest(BaseModel):
    code: Optional[str] = None
    days: int
    max_redemptions: Optional[int] = None  # None = unlimited, 1 = single-use
    label: Optional[str] = None


def _gen_promo_code(n: int = 8) -> str:
    import secrets, string
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


@router.post("/promo/admin/create")
async def promo_admin_create(payload: PromoCreateRequest, request: Request):
    """Admin-only: create a new promo code (single-use or multi-use)."""
    user = await _get_user(request)
    admin_email = os.environ.get("ADMIN_ALERT_EMAIL") or "elliot.cohenpressard@trykolo.io"
    db = _get_db()
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"email": 1, "_id": 0}) or {}
    if (user_doc.get("email") or "").lower() != admin_email.lower():
        raise HTTPException(status_code=403, detail="Admin only")
    code = (payload.code or _gen_promo_code()).upper()
    if payload.days <= 0:
        raise HTTPException(status_code=400, detail="days must be > 0")
    doc = {
        "code": code,
        "days": int(payload.days),
        "max_redemptions": int(payload.max_redemptions) if payload.max_redemptions is not None else None,
        "redeemed_count": 0,
        "redeemed_by": [],
        "active": True,
        "single_use": (payload.max_redemptions == 1),
        "label": payload.label or "",
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.v2_promo_codes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/promo/admin/list")
async def promo_admin_list(request: Request):
    user = await _get_user(request)
    admin_email = os.environ.get("ADMIN_ALERT_EMAIL") or "elliot.cohenpressard@trykolo.io"
    db = _get_db()
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"email": 1, "_id": 0}) or {}
    if (user_doc.get("email") or "").lower() != admin_email.lower():
        raise HTTPException(status_code=403, detail="Admin only")
    cursor = db.v2_promo_codes.find({}, {"_id": 0}).sort("created_at", -1)
    items = []
    async for d in cursor:
        items.append(d)
    return {"items": items}
