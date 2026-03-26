"""
Interactions Routes
Handles prospect interaction history tracking
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
from typing import Optional
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/interactions", tags=["interactions"])

# Import shared dependencies
from database import db
from utils import get_current_user, limiter


@router.post("")
@limiter.limit("60/minute")
async def create_interaction(request: Request, user=Depends(get_current_user)):
    """Log a new interaction with a prospect"""
    data = await request.json()
    
    prospect_id = data.get("prospect_id")
    interaction_type = data.get("type")  # sms, call, visit, note, email
    notes = data.get("notes", "")
    
    if not prospect_id or not interaction_type:
        raise HTTPException(status_code=400, detail="prospect_id and type required")
    
    # Verify prospect belongs to user
    prospect = await db.prospects.find_one({
        "prospect_id": prospect_id,
        "user_id": user["user_id"]
    })
    
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Check if user has interaction history feature
    user_doc = await db.users.find_one({"user_id": user["user_id"]})
    from routes.plans import get_user_effective_plan, PLAN_FEATURES
    effective_plan = get_user_effective_plan(user_doc)
    features = PLAN_FEATURES.get(effective_plan, PLAN_FEATURES["free"])
    
    if not features.get("interaction_history"):
        raise HTTPException(status_code=403, detail="Interaction history requires PRO plan")
    
    # Create interaction record
    interaction_id = f"int_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    interaction_doc = {
        "interaction_id": interaction_id,
        "prospect_id": prospect_id,
        "user_id": user["user_id"],
        "type": interaction_type,
        "notes": notes,
        "created_at": now
    }
    
    await db.interactions.insert_one(interaction_doc)
    
    # Update prospect's last contact date
    await db.prospects.update_one(
        {"prospect_id": prospect_id},
        {"$set": {
            "last_contact_date": now,
            "updated_at": now
        }}
    )
    
    logger.info(f"Interaction {interaction_id} logged for prospect {prospect_id}")
    
    return {
        "success": True,
        "interaction_id": interaction_id,
        "created_at": now
    }


@router.get("/{prospect_id}")
@limiter.limit("30/minute")
async def get_interactions(prospect_id: str, request: Request, user=Depends(get_current_user)):
    """Get all interactions for a prospect"""
    # Verify prospect belongs to user
    prospect = await db.prospects.find_one({
        "prospect_id": prospect_id,
        "user_id": user["user_id"]
    })
    
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Check if user has interaction history feature
    user_doc = await db.users.find_one({"user_id": user["user_id"]})
    from routes.plans import get_user_effective_plan, PLAN_FEATURES
    effective_plan = get_user_effective_plan(user_doc)
    features = PLAN_FEATURES.get(effective_plan, PLAN_FEATURES["free"])
    
    if not features.get("interaction_history"):
        return {
            "interactions": [],
            "locked": True,
            "upgrade_required": "pro"
        }
    
    # Get interactions sorted by date (newest first)
    interactions = await db.interactions.find(
        {"prospect_id": prospect_id, "user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)
    
    return {
        "interactions": interactions,
        "locked": False,
        "count": len(interactions)
    }
