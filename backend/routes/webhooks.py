# KOLO - Webhooks Routes (Brevo SMS)
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid
import logging

from database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/brevo-sms")
async def brevo_sms_webhook(request: Request):
    """
    Receive SMS replies from Brevo webhook.
    Brevo sends: {"senderNumber": "+33...", "message": "...", "messageId": "..."}
    """
    db = get_db()
    
    try:
        body = await request.json()
    except:
        body = {}
    
    logger.info(f"Brevo SMS webhook received: {body}")
    
    sender_number = body.get("senderNumber") or body.get("from") or body.get("phone")
    message_text = body.get("message") or body.get("text") or body.get("content")
    message_id = body.get("messageId") or body.get("id")
    
    if not sender_number or not message_text:
        logger.warning(f"Invalid webhook payload: {body}")
        return {"status": "ignored", "reason": "Missing sender or message"}
    
    # Clean phone number
    import re
    phone_clean = re.sub(r'[^\d+]', '', sender_number)
    if not phone_clean.startswith('+'):
        phone_clean = '+' + phone_clean
    
    # Find prospect by phone number
    prospect = await db.prospects.find_one(
        {"phone": {"$regex": phone_clean[-9:]}},
        {"_id": 0, "prospect_id": 1, "user_id": 1, "full_name": 1, "sms_history": 1}
    )
    
    if not prospect:
        logger.info(f"No prospect found for phone: {phone_clean}")
        return {"status": "ignored", "reason": "Prospect not found"}
    
    # Create reply entry
    reply_entry = {
        "id": f"sms_reply_{uuid.uuid4().hex[:8]}",
        "received_at": datetime.now(timezone.utc).isoformat(),
        "message": message_text,
        "sender_phone": phone_clean,
        "type": "received",
        "brevo_message_id": message_id
    }
    
    # Add to SMS history
    await db.prospects.update_one(
        {"prospect_id": prospect["prospect_id"]},
        {
            "$push": {"sms_history": reply_entry},
            "$set": {
                "last_activity_date": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    logger.info(f"SMS reply stored for prospect {prospect['prospect_id']}")
    
    return {
        "status": "received",
        "prospect_id": prospect["prospect_id"],
        "reply_id": reply_entry["id"]
    }

@router.get("/brevo-sms/setup-info")
async def brevo_webhook_setup_info(request: Request):
    """Get webhook setup instructions"""
    host = request.headers.get('host', '')
    scheme = 'https' if 'https' in str(request.url) or '.preview.' in host else 'http'
    base_url = f"{scheme}://{host}"
    webhook_url = f"{base_url}/api/webhooks/brevo-sms"
    
    return {
        "webhook_url": webhook_url,
        "instructions": {
            "fr": [
                "1. Connectez-vous à app.brevo.com",
                "2. Allez dans Settings > Webhooks",
                "3. Créez un nouveau webhook avec l'URL ci-dessus",
                "4. Sélectionnez 'reply' comme événement",
                "5. Activez le webhook"
            ],
            "en": [
                "1. Log in to app.brevo.com",
                "2. Go to Settings > Webhooks",
                "3. Create a new webhook with the URL above",
                "4. Select 'reply' as event type",
                "5. Activate the webhook"
            ]
        }
    }
