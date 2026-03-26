"""
AI Routes
Handles AI-powered features like SMS generation and suggestions
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
from typing import Optional
import os
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])

# Import shared dependencies
from database import db
from utils import get_current_user, limiter

# Get API URL from environment
EMERGENT_API_KEY = os.environ.get("EMERGENT_API_KEY", "")


async def generate_ai_message(prospect_name: str, project_type: str, context: str, locale: str = "fr") -> str:
    """Generate AI-powered SMS message for a prospect"""
    try:
        from emergentintegrations.llm.chat import chat, UserMessage
        
        system_prompt = f"""Tu es un assistant pour un agent immobilier. 
Génère un SMS court et professionnel (max 160 caractères) pour relancer un prospect.
Le message doit être en {"français" if locale == "fr" else "anglais"}.
Sois amical mais professionnel. Personnalise avec le nom du prospect."""

        user_prompt = f"""Prospect: {prospect_name}
Type de projet: {project_type}
Contexte: {context}

Génère un SMS de relance court et efficace."""

        response = await chat(
            api_key=EMERGENT_API_KEY,
            model="claude-sonnet-4-20250514",
            messages=[UserMessage(content=user_prompt)],
            system=system_prompt
        )
        
        return response.strip()
    except Exception as e:
        logger.error(f"AI message generation failed: {e}")
        # Fallback message
        if locale == "fr":
            return f"Bonjour {prospect_name}, j'espère que vous allez bien ! Je me permets de vous recontacter concernant votre projet immobilier. Êtes-vous disponible pour en discuter ?"
        return f"Hello {prospect_name}, I hope you're doing well! I wanted to follow up on your real estate project. Are you available to discuss?"


@router.post("/generate-sms")
@limiter.limit("20/minute")
async def generate_sms(request: Request, user=Depends(get_current_user)):
    """Generate an AI-powered SMS message for a prospect"""
    data = await request.json()
    
    prospect_id = data.get("prospect_id")
    custom_context = data.get("context", "")
    locale = data.get("locale", "fr")
    
    if not prospect_id:
        raise HTTPException(status_code=400, detail="prospect_id required")
    
    # Get prospect details
    prospect = await db.prospects.find_one({
        "prospect_id": prospect_id,
        "user_id": user["user_id"]
    })
    
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Check if user has SMS feature
    user_doc = await db.users.find_one({"user_id": user["user_id"]})
    from routes.plans import get_user_effective_plan, PLAN_FEATURES
    effective_plan = get_user_effective_plan(user_doc)
    features = PLAN_FEATURES.get(effective_plan, PLAN_FEATURES["free"])
    
    if not features.get("sms_one_click"):
        raise HTTPException(status_code=403, detail="SMS feature requires PRO plan")
    
    # Build context
    project_type = prospect.get("project_type", "achat")
    prospect_name = prospect.get("name", "Client")
    
    context_parts = [custom_context] if custom_context else []
    if prospect.get("budget_min") and prospect.get("budget_max"):
        context_parts.append(f"Budget: {prospect['budget_min']}k-{prospect['budget_max']}k€")
    if prospect.get("delay"):
        context_parts.append(f"Délai: {prospect['delay']}")
    
    context = ". ".join(context_parts) if context_parts else "Relance standard"
    
    # Generate message
    message = await generate_ai_message(prospect_name, project_type, context, locale)
    
    return {
        "success": True,
        "message": message,
        "prospect_name": prospect_name,
        "project_type": project_type
    }


@router.post("/suggest-tasks")
@limiter.limit("10/minute")
async def suggest_tasks(request: Request, user=Depends(get_current_user)):
    """Get AI-powered task suggestions based on prospects"""
    user_doc = await db.users.find_one({"user_id": user["user_id"]})
    
    # Check daily limit for free users
    from routes.plans import get_user_effective_plan, PLAN_FEATURES
    effective_plan = get_user_effective_plan(user_doc)
    features = PLAN_FEATURES.get(effective_plan, PLAN_FEATURES["free"])
    
    daily_limit = features.get("daily_ai_suggestions")
    if daily_limit is not None:  # Not unlimited
        today = datetime.now(timezone.utc).date().isoformat()
        reset_date = user_doc.get("daily_suggestions_reset_date")
        used = user_doc.get("daily_suggestions_used", 0)
        
        if reset_date != today:
            # Reset counter for new day
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {
                    "daily_suggestions_reset_date": today,
                    "daily_suggestions_used": 0
                }}
            )
            used = 0
        
        if used >= daily_limit:
            return {
                "success": False,
                "suggestions": [],
                "limit_reached": True,
                "daily_limit": daily_limit,
                "used": used
            }
    
    # Get prospects that need follow-up
    prospects = await db.prospects.find({
        "user_id": user["user_id"],
        "status": {"$nin": ["vendu", "perdu", "sold", "lost"]}
    }).sort("last_contact_date", 1).limit(10).to_list(length=10)
    
    suggestions = []
    for prospect in prospects:
        last_contact = prospect.get("last_contact_date")
        days_since_contact = 999
        
        if last_contact:
            try:
                last_dt = datetime.fromisoformat(last_contact.replace('Z', '+00:00'))
                days_since_contact = (datetime.now(timezone.utc) - last_dt).days
            except:
                pass
        
        # Suggest follow-up if no contact in 7+ days
        if days_since_contact >= 7:
            task_type = "sms" if days_since_contact < 14 else "appel"
            suggestions.append({
                "prospect_id": prospect["prospect_id"],
                "prospect_name": prospect.get("name", "Client"),
                "task_type": task_type,
                "reason": f"Pas de contact depuis {days_since_contact} jours",
                "priority": "high" if days_since_contact > 14 else "medium"
            })
    
    # Update usage counter
    if daily_limit is not None:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {"daily_suggestions_used": 1}}
        )
    
    return {
        "success": True,
        "suggestions": suggestions[:5],  # Max 5 suggestions
        "limit_reached": False
    }
