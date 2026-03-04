# KOLO - Notifications Routes
from fastapi import APIRouter, HTTPException, Request
import os
import logging

from models import NotificationSubscription
from database import get_db, require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.post("/subscribe")
async def subscribe_notifications(request: Request, data: NotificationSubscription):
    """Subscribe to push notifications"""
    user = await require_auth(request)
    db = get_db()
    
    await db.push_subscriptions.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "user_id": user.user_id,
            "endpoint": data.endpoint,
            "keys": data.keys
        }},
        upsert=True
    )
    
    return {"message": "Subscribed to notifications"}

@router.delete("/unsubscribe")
async def unsubscribe_notifications(request: Request):
    """Unsubscribe from push notifications"""
    user = await require_auth(request)
    db = get_db()
    
    await db.push_subscriptions.delete_one({"user_id": user.user_id})
    return {"message": "Unsubscribed from notifications"}

@router.post("/trigger")
async def trigger_notifications(request: Request):
    """Manually trigger notifications (for testing)"""
    user = await require_auth(request)
    
    return {"message": "Notifications triggered", "user_id": user.user_id}

@router.get("/vapid-key")
async def get_vapid_public_key():
    """Get VAPID public key for push notifications"""
    vapid_public_key = os.environ.get('VAPID_PUBLIC_KEY', '')
    
    if not vapid_public_key:
        raise HTTPException(status_code=500, detail="VAPID key not configured")
    
    return {"publicKey": vapid_public_key}
