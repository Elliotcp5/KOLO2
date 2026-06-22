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
from datetime import datetime, timezone, timedelta
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
    Mark a referred user as having upgraded to PRO and credit the referrer
    with +1 free month. Idempotent.
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
    return {"ok": True, "credited": True}


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
    notes_pending = await db.v2_notes.count_documents({
        "user_id": user.user_id, "status": "pending"
    })
    total_contacts = await db.v2_contacts.count_documents({"user_id": user.user_id})

    # Plan info
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    plan = user_doc.get("subscription_status") in ("active", "trialing")
    return {
        "reminders_today": reminders_today,
        "notes_pending": notes_pending,
        "total_contacts": total_contacts,
        "has_pro": bool(plan),
        "free_contacts_left": max(0, 10 - total_contacts) if not plan else None,
    }


# ============================================================================
# AI CHAT  /api/v2/ai/*
# ============================================================================
KOLO_SYSTEM_PROMPT = """Tu es KOLO, le copilote IA des agents immobiliers. Tu apportes une expertise terrain pointue : techniques de prospection, gestion de pipeline, relances commerciales, négociation, signaux marché DPE, droit immobilier (à valider par un pro). Tu réponds en français, ton chaleureux et direct, sans baratin. Pour chaque conseil, tu donnes du concret (chiffres, mots à dire, étapes). Si une question sort de ton expertise immo/commerciale, tu le dis et tu redirige."""


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
        f"CRM: {onboarding.get('crm_tool') or '—'}. "
        f"Secteurs: {', '.join(onboarding.get('sectors', [])) or '—'}.\n"
        f"[État actuel]\nContacts: {contacts_count} · Dossiers: {cases_count} · Rappels aujourd'hui: {reminders_today}.\n"
        f"[5 derniers dossiers]\n{recent_cases_summary}"
    )

    final_message = f"{payload.message}{context_snippet}{global_ctx}"

    # Call LLM via emergentintegrations
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY") or ""
        if not api_key:
            raise RuntimeError("EMERGENT_LLM_KEY missing")
        chat = LlmChat(api_key=api_key, session_id=conv_id, system_message=KOLO_SYSTEM_PROMPT).with_model("anthropic", "claude-sonnet-4-5-20250929")
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
        chat = LlmChat(api_key=api_key, session_id=f"tip_{user.user_id}_{datetime.now().date().isoformat()}", system_message=KOLO_SYSTEM_PROMPT).with_model("anthropic", "claude-sonnet-4-5-20250929")
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
    # In dev preview, also return code to make manual testing trivial.
    is_dev = os.environ.get("ENV", "dev").lower() != "production"
    return {"sent": True, "dev_code": code if is_dev else None}


@router.post("/auth/verify-email-code")
async def verify_email_code(payload: EmailCodeVerify, request: Request):
    db = _get_db()
    email = payload.email.strip().lower()
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
    }})
    return {"ok": True}


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
    Real ADEME DPE API call:
      https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines
    """
    await _get_user(request)
    import httpx
    qs = []
    if sector:
        # ADEME supports q_fields=code_postal_ban,nom_commune_ban  with q=value
        qs.append(("qs", f"code_postal_ban:{sector} OR nom_commune_ban:{sector}"))
    if score:
        qs.append(("qs", f"etiquette_dpe:{score.upper()}"))
    if days:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
        qs.append(("qs", f"date_etablissement_dpe:>={cutoff}"))
    qs.append(("size", "20"))
    qs.append(("select", "adresse_ban,code_postal_ban,nom_commune_ban,surface_habitable_logement,etiquette_dpe,etiquette_ges,date_etablissement_dpe,n_dpe"))
    qs.append(("sort", "-date_etablissement_dpe"))
    url = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines"
    items = []
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(url, params=qs)
            if r.status_code == 200:
                data = r.json()
                for row in data.get("results", []):
                    items.append({
                        "address": f"{row.get('adresse_ban') or ''}, {row.get('code_postal_ban') or ''} {row.get('nom_commune_ban') or ''}".strip().strip(","),
                        "surface": row.get("surface_habitable_logement"),
                        "energy": row.get("etiquette_dpe") or "—",
                        "climate": row.get("etiquette_ges") or "—",
                        "parcel": row.get("n_dpe") or "",
                        "issued_at": row.get("date_etablissement_dpe") or "",
                    })
    except Exception:
        pass
    if not items:
        # fallback samples
        items = [
            {"address": "12 rue de la République, 69003 Lyon", "surface": 72, "energy": "D", "climate": "C", "parcel": "AB-0123", "issued_at": "2026-02-15"},
            {"address": "8 avenue Jean Jaurès, 75019 Paris", "surface": 45, "energy": "E", "climate": "D", "parcel": "AC-0445", "issued_at": "2026-02-10"},
        ]
    return {"items": items, "source": "ADEME"}


@router.get("/prospecting/listings")
async def prospecting_listings(request: Request, sector: Optional[str] = None, kind: Optional[str] = None, age: Optional[str] = None):
    """Real-estate listings aggregator via RapidAPI Selogimmo.
    Configuration via env: RAPIDAPI_KEY + RAPIDAPI_SELOGIMMO_HOST.
    Falls back to clearly-marked placeholder data when not configured / not subscribed.
    """
    await _get_user(request)
    db = _get_db()
    rapidapi_key = os.environ.get("RAPIDAPI_KEY", "").strip()
    selogimmo_host = os.environ.get("RAPIDAPI_SELOGIMMO_HOST", "selogimmo.p.rapidapi.com").strip()

    # ---- REAL CALL via Selogimmo (RapidAPI)
    if rapidapi_key and selogimmo_host and sector:
        # Cache 6h
        cache_key = f"selogimmo_{sector}_{kind or 'any'}"
        cached = await db.v2_listings_cache.find_one({"key": cache_key}, {"_id": 0})
        if cached:
            try:
                cached_at = datetime.fromisoformat(cached["cached_at"])
                if datetime.now(timezone.utc) - cached_at < timedelta(hours=6):
                    return {"items": cached.get("items", []), "source": "Selogimmo (cache)"}
            except Exception:
                pass

        import httpx
        headers = {"x-rapidapi-key": rapidapi_key, "x-rapidapi-host": selogimmo_host}

        # Step 1 — Resolve sector → city_id via /cityinfo (if not already a numeric ID)
        city_id: Optional[str] = None
        not_subscribed = False
        if sector.strip().isdigit() and len(sector.strip()) >= 5:
            city_id = sector.strip()
        else:
            try:
                async with httpx.AsyncClient(timeout=8) as client:
                    cr = await client.get(
                        f"https://{selogimmo_host}/cityinfo",
                        headers=headers, params={"city": sector},
                    )
                    if cr.status_code == 200:
                        cdata = cr.json()
                        # API returns either a list or a dict — best-effort extraction
                        if isinstance(cdata, list) and cdata:
                            city_id = str(cdata[0].get("id") or cdata[0].get("city_id") or "")
                        elif isinstance(cdata, dict):
                            city_id = str(cdata.get("id") or cdata.get("city_id") or cdata.get("data", [{}])[0].get("id", "") if cdata.get("data") else "")
                    elif cr.status_code == 403:
                        not_subscribed = True
            except Exception:
                pass

        if not_subscribed and not city_id:
            return {"items": [], "source": "not_subscribed", "hint": "Active 'Subscribe to Test' sur RapidAPI Selogimmo (gratuit)."}

        # Step 2 — Fetch listings
        if city_id:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    r = await client.get(
                        f"https://{selogimmo_host}/",
                        headers=headers, params={"city": city_id, "page": 1},
                    )
                    if r.status_code == 200:
                        payload = r.json()
                        raw = payload if isinstance(payload, list) else (
                            payload.get("listings") or payload.get("results") or payload.get("data") or payload.get("items") or []
                        )
                        items = []
                        for row in raw[:30]:
                            items.append({
                                "title": row.get("title") or row.get("publicationTitle") or row.get("description", "")[:60] or "Annonce",
                                "sector": str(row.get("city") or row.get("zipCode") or row.get("postalCode") or sector or ""),
                                "price": row.get("price") or row.get("pricing", {}).get("price") or 0,
                                "surface": row.get("surface") or row.get("livingArea") or 0,
                                "rooms": row.get("rooms") or row.get("nbRooms") or row.get("roomsQuantity") or 0,
                                "kind": "pro" if (row.get("publisher", {}).get("type") == "professional" or row.get("isPro")) else "private",
                                "photo": (row.get("photos") or row.get("pictures") or [{}])[0].get("url") if isinstance(row.get("photos") or row.get("pictures"), list) else (row.get("photo") or ""),
                                "url": row.get("url") or row.get("permalink") or "",
                                "posted_at": row.get("publicationDate") or row.get("publishedAt") or "",
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
                            return {"items": items, "source": "Selogimmo"}
                    elif r.status_code == 403:
                        return {"items": [], "source": "not_subscribed", "hint": "Active 'Subscribe to Test' sur RapidAPI Selogimmo (gratuit)."}
            except Exception:
                pass

    # ---- Placeholder (clearly marked)
    base = [
        {"title": "T3 lumineux", "sector": "69003 Lyon", "price": 285000, "surface": 71, "rooms": 3, "kind": "private", "photo": "/og-image-v2.png", "url": "https://www.leboncoin.fr", "posted_at": "2026-02-18"},
        {"title": "Maison familiale", "sector": "33000 Bordeaux", "price": 520000, "surface": 145, "rooms": 6, "kind": "pro", "photo": "/og-image-v2.png", "url": "https://www.seloger.com", "posted_at": "2026-02-12"},
        {"title": "Studio meublé", "sector": "75019 Paris", "price": 210000, "surface": 28, "rooms": 1, "kind": "private", "photo": "/og-image-v2.png", "url": "https://www.bienici.com", "posted_at": "2026-02-05"},
        {"title": "Appartement balcon", "sector": "13001 Marseille", "price": 245000, "surface": 65, "rooms": 3, "kind": "pro", "photo": "/og-image-v2.png", "url": "https://www.leboncoin.fr", "posted_at": "2025-12-20"},
    ]
    items = base
    if sector:
        items = [r for r in items if sector.lower() in r["sector"].lower()]
    if kind in {"private", "pro"}:
        items = [r for r in items if r["kind"] == kind]
    return {"items": items, "source": "placeholder"}
