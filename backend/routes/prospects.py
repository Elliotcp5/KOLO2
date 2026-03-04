# KOLO - Prospects Routes
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid
import httpx
import os
import logging

from models import Prospect, CreateProspectRequest, UpdateProspectRequest
from database import get_db, require_active_subscription, calculate_prospect_score, update_prospect_next_task
from utils import format_phone_number

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/prospects", tags=["prospects"])

@router.get("")
async def list_prospects(request: Request):
    """List all prospects for user"""
    user = await require_active_subscription(request)
    db = get_db()
    
    prospects = await db.prospects.find(
        {"user_id": user.user_id, "status": {"$nin": ["closed", "lost"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return {"prospects": prospects}

@router.post("")
async def create_prospect(request: Request, prospect_data: CreateProspectRequest):
    """Create new prospect"""
    user = await require_active_subscription(request)
    db = get_db()
    
    prospect = Prospect(
        user_id=user.user_id,
        full_name=prospect_data.full_name,
        phone=prospect_data.phone,
        email=prospect_data.email,
        source=prospect_data.source,
        status=prospect_data.status,
        notes=prospect_data.notes,
        last_activity_date=datetime.now(timezone.utc)
    )
    
    prospect_doc = prospect.model_dump()
    prospect_doc['created_at'] = prospect_doc['created_at'].isoformat()
    prospect_doc['updated_at'] = prospect_doc['updated_at'].isoformat()
    prospect_doc['last_activity_date'] = prospect_doc['last_activity_date'].isoformat()
    
    await db.prospects.insert_one(prospect_doc)
    await calculate_prospect_score(prospect.prospect_id, user.user_id)
    
    return {"prospect_id": prospect.prospect_id, "message": "Prospect created"}

@router.get("/{prospect_id}")
async def get_prospect(request: Request, prospect_id: str):
    """Get prospect details with tasks"""
    user = await require_active_subscription(request)
    db = get_db()
    
    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    tasks = await db.tasks.find(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    ).sort("due_date", 1).to_list(100)
    
    return {**prospect, "tasks": tasks}

@router.put("/{prospect_id}")
async def update_prospect(request: Request, prospect_id: str, update_data: UpdateProspectRequest):
    """Update prospect"""
    user = await require_active_subscription(request)
    db = get_db()
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_dict["last_activity_date"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.prospects.update_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    return {"message": "Prospect updated"}

@router.delete("/{prospect_id}")
async def delete_prospect(request: Request, prospect_id: str):
    """Delete prospect and associated tasks"""
    user = await require_active_subscription(request)
    db = get_db()
    
    result = await db.prospects.delete_one(
        {"prospect_id": prospect_id, "user_id": user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    await db.tasks.delete_many({"prospect_id": prospect_id, "user_id": user.user_id})
    
    return {"message": "Prospect deleted"}

@router.post("/{prospect_id}/score")
async def update_prospect_score(request: Request, prospect_id: str):
    """Update or calculate prospect score"""
    user = await require_active_subscription(request)
    
    body = await request.json()
    force_score = body.get("force_score")
    
    score = await calculate_prospect_score(prospect_id, user.user_id, force_score)
    return {"score": score}

@router.post("/{prospect_id}/generate-message")
async def generate_followup_message(request: Request, prospect_id: str):
    """Generate AI follow-up message for prospect"""
    user = await require_active_subscription(request)
    db = get_db()
    
    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    agent_name = user_doc.get("name", "Agent") if user_doc else "Agent"
    
    tasks = await db.tasks.find(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(5)
    
    prompt = f"""Génère un SMS de relance professionnel et amical (max 160 caractères) pour un prospect immobilier.

Contexte:
- Nom du prospect: {prospect.get('full_name')}
- Statut: {prospect.get('status')}
- Notes: {prospect.get('notes', 'Aucune note')}
- Score: {prospect.get('score', 'Non évalué')}
- Nom de l'agent: {agent_name}

Consignes:
- Message court et direct (SMS = 160 caractères max)
- Ton professionnel mais chaleureux
- Signe avec le prénom de l'agent
- Pas de formule trop formelle

Réponds uniquement avec le message SMS, sans guillemets ni explication."""

    try:
        from emergentintegrations.llm.anthropic import AnthropicClient
        llm_key = os.environ.get("EMERGENT_LLM_KEY")
        
        if llm_key:
            client = AnthropicClient(api_key=llm_key)
            response = await client.send_message(
                message=prompt,
                model="claude-3-haiku-20240307",
                max_tokens=200
            )
            message = response.strip()[:160]
        else:
            message = f"Bonjour {prospect.get('full_name').split()[0]}, j'espère que vous allez bien ! Avez-vous des questions sur votre projet immobilier ? {agent_name}"
    except Exception as e:
        logger.error(f"AI message generation error: {e}")
        message = f"Bonjour {prospect.get('full_name').split()[0]}, j'espère que vous allez bien ! Avez-vous des questions sur votre projet immobilier ? {agent_name}"
    
    return {"message": message, "context": {"prospect_name": prospect.get('full_name'), "agent_name": agent_name}}

@router.post("/{prospect_id}/send-sms")
async def send_sms_to_prospect(request: Request, prospect_id: str):
    """Send SMS to prospect via Brevo API"""
    user = await require_active_subscription(request)
    db = get_db()
    
    body = await request.json()
    message = body.get("message")
    
    if not message:
        raise HTTPException(status_code=400, detail="Message required")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    agent_name = user_doc.get("name") if user_doc else None
    agent_phone = user_doc.get("phone") if user_doc else None
    
    if not agent_phone:
        raise HTTPException(
            status_code=400, 
            detail="Numéro de téléphone non configuré. Ajoutez votre numéro dans les paramètres."
        )
    
    if not agent_name:
        raise HTTPException(
            status_code=400,
            detail="Nom non configuré. Ajoutez votre nom dans les paramètres."
        )
    
    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    if prospect.get("sms_opt_out"):
        raise HTTPException(status_code=400, detail="Ce prospect a demandé à ne plus recevoir de SMS")
    
    prospect_phone = prospect.get("phone")
    if not prospect_phone:
        raise HTTPException(status_code=400, detail="Numéro de téléphone du prospect manquant")
    
    prospect_phone = format_phone_number(prospect_phone)
    sender_name = agent_name.split()[0][:11] if agent_name else "Agent"
    
    brevo_api_key = os.environ.get("BREVO_API_KEY")
    if not brevo_api_key:
        raise HTTPException(status_code=500, detail="SMS service not configured")
    
    try:
        async with httpx.AsyncClient() as http_client:
            sms_response = await http_client.post(
                "https://api.brevo.com/v3/transactionalSMS/sms",
                headers={
                    "api-key": brevo_api_key,
                    "Content-Type": "application/json"
                },
                json={
                    "sender": sender_name,
                    "recipient": prospect_phone,
                    "content": message[:160],
                    "type": "transactional"
                },
                timeout=30.0
            )
            sms_response.raise_for_status()
            response_data = sms_response.json()
        
        sms_entry = {
            "id": f"sms_{uuid.uuid4().hex[:8]}",
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "message": message[:160],
            "sender_name": agent_name,
            "sender_phone": agent_phone,
            "recipient_phone": prospect_phone,
            "status": "sent",
            "brevo_message_id": response_data.get("messageId")
        }
        
        current_prospect = await db.prospects.find_one({"prospect_id": prospect_id}, {"sms_history": 1})
        if current_prospect and current_prospect.get("sms_history") is None:
            await db.prospects.update_one(
                {"prospect_id": prospect_id},
                {"$set": {"sms_history": []}}
            )
        
        await db.prospects.update_one(
            {"prospect_id": prospect_id},
            {
                "$push": {"sms_history": sms_entry},
                "$set": {
                    "last_activity_date": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        await calculate_prospect_score(prospect_id, user.user_id)
        
        logger.info(f"SMS sent from {sender_name} to {prospect_phone}")
        
        return {
            "success": True,
            "message_id": sms_entry["id"],
            "status": "sent",
            "sender_name": agent_name
        }
        
    except httpx.HTTPStatusError as e:
        error_body = e.response.json() if e.response.content else {}
        error_msg = error_body.get("message", str(e))
        if "not_enough_credits" in str(error_body):
            error_msg = "Crédits SMS insuffisants. Rechargez sur app.brevo.com"
        logger.error(f"SMS sending error: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        logger.error(f"SMS sending error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur d'envoi SMS: {str(e)}")

@router.post("/{prospect_id}/sms-opt-out")
async def toggle_sms_opt_out(request: Request, prospect_id: str):
    """Toggle SMS opt-out status"""
    user = await require_active_subscription(request)
    db = get_db()
    
    body = await request.json()
    opt_out = body.get("opt_out", True)
    
    await db.prospects.update_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"$set": {
            "sms_opt_out": opt_out,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"sms_opt_out": opt_out}
