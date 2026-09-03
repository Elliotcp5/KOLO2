"""KOLO — Assistant conversationnel (bloc C, partie C bis).

- `POST /api/assistant/chat` (SSE) — gate plan Pro, plafond 100/j (heure Paris),
  contexte {opportunite|estimation|dossier}, historique tronqué à 20 tours
  (le premier message est conservé), Claude Sonnet 5, vouvoiement,
  refus juridique + refus marché sans estimation + interdit « expertise ».
- `GET /api/conversations` / `GET /api/conversations/{id}` / `DELETE /api/conversations/{id}`.
"""
from __future__ import annotations
import json, logging, os, secrets
from datetime import datetime, date, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger("assistant")
router = APIRouter(tags=["assistant"])

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
MAX_TURNS = 20
DEFAULT_QUOTA = 100
PARIS = ZoneInfo("Europe/Paris")

SYSTEM_PROMPT = (
    "Vous êtes l'assistant du conseiller immobilier français utilisateur de KOLO. "
    "Vous répondez en français, exclusivement au vouvoiement. "
    "Vos réponses font trois à quatre phrases courtes maximum, suivies du "
    "prochain pas concret. Vous n'énumérez jamais plus de trois points. "
    "Vous ne faites jamais de titres ni de sections. "
    "Vous n'employez jamais le mot \"expertise\" pour désigner un avis de valeur : "
    "dites toujours \"avis de valeur\". "
    "Vous refusez de donner un chiffre de marché tant qu'aucune estimation n'est fournie "
    "en contexte, en renvoyant l'utilisateur vers l'onglet Estimation. "
    "Vous refusez de donner un avis juridique ou fiscal, en renvoyant vers un notaire ou "
    "un juriste. "
    "Vous ne promettez jamais un résultat commercial chiffré. "
    "Vous ne mentionnez jamais d'autres utilisateurs, d'autres conseillers, ni de données "
    "ne concernant pas le conseiller qui vous interroge."
)


def _db():
    from server import db
    return db


class ChatIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[str] = None
    context: Optional[dict[str, Any]] = None  # {type: opportunite|estimation|dossier, id: ...}


async def _current_user_doc(request):
    from server import get_user_from_session, get_user_effective_plan
    u = await get_user_from_session(request)
    if not u:
        raise HTTPException(401, "Not authenticated")
    doc = await _db().users.find_one({"user_id": u.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(401, "User not found")
    plan = get_user_effective_plan(doc)
    return doc, plan


def _paris_today_key() -> str:
    return datetime.now(PARIS).date().isoformat()


async def _check_quota(db, user_id: str) -> None:
    key = _paris_today_key()
    doc = await db.assistant_quota.find_one({"user_id": user_id, "day": key})
    used = int((doc or {}).get("count") or 0)
    if used >= DEFAULT_QUOTA:
        raise HTTPException(429, {"code": "plafond_atteint", "quota": DEFAULT_QUOTA})


async def _increment_quota(db, user_id: str) -> None:
    key = _paris_today_key()
    await db.assistant_quota.update_one(
        {"user_id": user_id, "day": key},
        {"$inc": {"count": 1}, "$set": {"user_id": user_id, "day": key}},
        upsert=True,
    )


def _truncate_history(msgs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Garde le 1er + les 19 derniers pour rester sous MAX_TURNS."""
    if len(msgs) <= MAX_TURNS:
        return msgs
    return [msgs[0]] + msgs[-(MAX_TURNS - 1):]


async def _load_context_snippet(db, user_id: str, ctx: dict[str, Any] | None) -> str:
    if not ctx or not ctx.get("type") or not ctx.get("id"):
        return ""
    t, cid = ctx["type"], ctx["id"]
    if t == "estimation":
        e = await db.estimations.find_one({"estimation_id": cid, "user_id": user_id}, {"_id": 0})
        if not e:
            return ""
        r = e.get("resultat") or {}
        return (
            f"[Contexte estimation] Adresse {e.get('adresse')}, "
            f"{e.get('type_bien')} de {e.get('surface_habitable')} m², "
            f"DPE {e.get('classe_dpe') or '—'}. "
            f"Valeur vénale {r.get('valeur_venale')} €, prix de commercialisation "
            f"{r.get('prix_commercialisation')} €, fourchette "
            f"{r.get('fourchette_basse')}–{r.get('fourchette_haute')} €, "
            f"fiabilité {r.get('fiabilite')}."
        )
    if t == "dossier":
        d = await db.dossiers.find_one({"dossier_id": cid, "user_id": user_id}, {"_id": 0})
        if not d:
            return ""
        s = d.get("sections") or {}
        return (
            f"[Contexte dossier] Réf {(s.get('dossier') or {}).get('ref')}, "
            f"adresse {(s.get('identification') or {}).get('adresse')}, "
            f"valeur retenue {(s.get('conclusion') or {}).get('valeur_venale')} €, "
            f"statut {d.get('statut')}, niveau {d.get('niveau')}."
        )
    if t == "opportunite":
        return f"[Contexte opportunité] identifiant {cid}."
    return ""


@router.post("/api/assistant/chat")
async def chat(payload: ChatIn, request: Request):
    user, plan = await _current_user_doc(request)
    # Gate plan : Découverte (free) = pas d'accès
    if plan not in ("pro", "pro_plus"):
        raise HTTPException(403, {"code": "plan_insuffisant", "plan_requis": "pro"})

    db = _db()
    await _check_quota(db, user["user_id"])

    # Charge ou crée la conversation
    conv_id = payload.conversation_id or f"conv_{secrets.token_urlsafe(9)}"
    conv = await db.assistant_conversations.find_one(
        {"conversation_id": conv_id, "user_id": user["user_id"]}, {"_id": 0},
    )
    messages: list[dict[str, Any]] = (conv or {}).get("messages") or []
    is_new = conv is None

    # Contexte injectable
    context_snippet = await _load_context_snippet(db, user["user_id"], payload.context)
    user_text = payload.message.strip()
    injected = (context_snippet + "\n\n" + user_text) if context_snippet else user_text

    messages.append({"role": "user", "content": user_text, "at": datetime.now(timezone.utc).isoformat()})
    history_for_llm = _truncate_history(messages)

    # Instancie un chat neuf par tour ; rejoue l'historique via un id de session unique.
    chat = (LlmChat(api_key=EMERGENT_KEY, session_id=f"assistant-{conv_id}-{len(messages)}",
                    system_message=SYSTEM_PROMPT)
            .with_model("anthropic", "claude-sonnet-5"))
    # Contrainte de longueur — 400 tokens ≈ 300 mots ≈ 4-5 phrases FR.
    # Le prompt système impose 3-4 phrases ; on cap en dur pour être sûr.
    try:
        chat = chat.with_max_tokens(400)
    except Exception:
        pass  # méthode absente sur cette version — le prompt reste la garde
    # Injecte l'historique en un seul message pour préserver le fil sans multiplier les appels
    if len(history_for_llm) > 1:
        prior = "\n\n".join(
            f"[{m['role']}] {m['content']}" for m in history_for_llm[:-1]
        )
        prompt_body = f"[historique]\n{prior}\n\n[message courant]\n{injected}"
    else:
        prompt_body = injected

    async def gen():
        yield f"data: {json.dumps({'conversation_id': conv_id, 'is_new': is_new})}\n\n"
        try:
            answer = (await chat.send_message(UserMessage(text=prompt_body))) or ""
            answer = answer.strip()
            # Simule un streaming léger côté client : envoi par tranches
            step = 24
            for i in range(0, len(answer), step):
                yield f"data: {json.dumps({'delta': answer[i:i+step]})}\n\n"
        except Exception as e:
            logger.exception(f"stream failed: {e}")
            yield f"data: {json.dumps({'error': 'stream_failed'})}\n\n"
            return

        messages.append({"role": "assistant", "content": answer, "at": datetime.now(timezone.utc).isoformat()})
        title = messages[0]["content"][:60].strip() if messages else "Conversation"
        now = datetime.now(timezone.utc).isoformat()
        await db.assistant_conversations.update_one(
            {"conversation_id": conv_id, "user_id": user["user_id"]},
            {"$set": {
                "conversation_id": conv_id, "user_id": user["user_id"],
                "title": title, "context": payload.context,
                "messages": messages, "updated_at": now,
            }, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        await _increment_quota(db, user["user_id"])
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/api/conversations")
async def list_conversations(request: Request):
    user, _ = await _current_user_doc(request)
    cur = _db().assistant_conversations.find(
        {"user_id": user["user_id"]},
        {"_id": 0, "conversation_id": 1, "title": 1, "updated_at": 1, "context": 1},
    ).sort("updated_at", -1).limit(50)
    items = await cur.to_list(length=50)
    return {"ok": True, "conversations": items}


@router.get("/api/conversations/{cid}")
async def get_conversation(cid: str, request: Request):
    user, _ = await _current_user_doc(request)
    doc = await _db().assistant_conversations.find_one(
        {"conversation_id": cid, "user_id": user["user_id"]}, {"_id": 0},
    )
    if not doc:
        raise HTTPException(404, "conversation_introuvable")
    return {"ok": True, "conversation": doc}


@router.delete("/api/conversations/{cid}")
async def delete_conversation(cid: str, request: Request):
    user, _ = await _current_user_doc(request)
    r = await _db().assistant_conversations.delete_one(
        {"conversation_id": cid, "user_id": user["user_id"]},
    )
    if r.deleted_count == 0:
        raise HTTPException(404, "conversation_introuvable")
    return {"ok": True}


@router.get("/api/assistant/status")
async def assistant_status(request: Request):
    user, plan = await _current_user_doc(request)
    key = _paris_today_key()
    doc = await _db().assistant_quota.find_one({"user_id": user["user_id"], "day": key})
    used = int((doc or {}).get("count") or 0)
    return {
        "ok": True,
        "plan": plan,
        "access": plan in ("pro", "pro_plus"),
        "quota": {"used": used, "limit": DEFAULT_QUOTA, "day": key, "tz": "Europe/Paris"},
    }
