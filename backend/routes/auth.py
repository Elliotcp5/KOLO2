# KOLO - Auth Routes
from fastapi import APIRouter, HTTPException, Request, Response
from datetime import datetime, timezone, timedelta
import httpx
import uuid
import secrets
import asyncio
import os
import logging
import resend

from models import (
    User, UserSession, AuthSessionRequest, RegisterRequest, LoginRequest,
    ChangePasswordRequest, UpdatePhoneRequest, UpdateNameRequest,
    ForgotPasswordRequest, ResetPasswordRequest, CreateAccountRequest
)
from database import get_db, require_auth, require_active_subscription
from utils import hash_password, verify_password, format_phone_number_with_country

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# Resend email configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@trykolo.io')
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

@router.post("/session")
async def process_auth_session(request: AuthSessionRequest, response: Response):
    """Process OAuth session from Emergent Auth"""
    db = get_db()
    try:
        async with httpx.AsyncClient() as http_client:
            resp = await http_client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            auth_data = resp.json()
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
    
    email = auth_data.get("email")
    name = auth_data.get("name")
    picture = auth_data.get("picture")
    session_token = auth_data.get("session_token")
    
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": name,
                "picture": picture,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        subscription_status = existing_user.get("subscription_status", "none")
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = User(
            user_id=user_id,
            email=email,
            name=name,
            picture=picture,
            auth_provider="google",
            subscription_status="none"
        )
        user_doc = new_user.model_dump()
        user_doc['created_at'] = user_doc['created_at'].isoformat()
        user_doc['updated_at'] = user_doc['updated_at'].isoformat()
        await db.users.insert_one(user_doc)
        subscription_status = "none"
    
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session = UserSession(
        user_id=user_id,
        session_token=session_token,
        expires_at=expires_at
    )
    session_doc = session.model_dump()
    session_doc['expires_at'] = session_doc['expires_at'].isoformat()
    session_doc['created_at'] = session_doc['created_at'].isoformat()
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "subscription_status": subscription_status
    }

@router.get("/me")
async def get_current_user(request: Request):
    """Get current authenticated user"""
    from database import get_user_from_session
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "subscription_status": user.subscription_status
    }

@router.post("/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    db = get_db()
    session_token = request.cookies.get('session_token')
    
    if not session_token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            session_token = auth_header[7:]
    
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

@router.post("/register")
async def register_free_trial(request: RegisterRequest, response: Response):
    """Register new user with 7-day free trial"""
    db = get_db()
    
    if not request.email or '@' not in request.email:
        raise HTTPException(status_code=400, detail="Email invalide")
    if not request.password or len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    if not request.full_name or len(request.full_name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Nom complet requis")
    if not request.phone or len(request.phone) < 6:
        raise HTTPException(status_code=400, detail="Numéro de téléphone requis")
    
    email_clean = request.email.lower().strip()
    existing = await db.users.find_one({"email": email_clean})
    if existing:
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email")
    
    phone_formatted = format_phone_number_with_country(request.phone, request.country_code)
    trial_ends_at = datetime.now(timezone.utc) + timedelta(days=7)
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    user_doc = {
        "user_id": user_id,
        "email": email_clean,
        "password_hash": hash_password(request.password),
        "name": request.full_name.strip(),
        "phone": phone_formatted,
        "auth_provider": "email",
        "subscription_status": "trialing",
        "trial_ends_at": trial_ends_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session_doc = {
        "session_id": f"sess_{uuid.uuid4().hex}",
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return {
        "success": True,
        "user_id": user_id,
        "email": email_clean,
        "name": request.full_name.strip(),
        "subscription_status": "trialing",
        "trial_ends_at": trial_ends_at.isoformat(),
        "token": session_token
    }

@router.post("/login")
async def login_with_password(request: LoginRequest, response: Response):
    """Login with email and password"""
    db = get_db()
    
    if not request.email or not request.password:
        raise HTTPException(status_code=400, detail="Email et mot de passe requis")
    
    email_clean = request.email.lower().strip()
    user_doc = await db.users.find_one({"email": email_clean}, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    password_hash = user_doc.get("password_hash")
    if not password_hash or not verify_password(request.password, password_hash):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session_doc = {
        "session_id": f"sess_{uuid.uuid4().hex}",
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return {
        "success": True,
        "user_id": user_doc["user_id"],
        "email": user_doc["email"],
        "name": user_doc.get("name"),
        "subscription_status": user_doc.get("subscription_status", "none"),
        "token": session_token
    }

@router.post("/change-password")
async def change_password(request: ChangePasswordRequest, http_request: Request):
    """Change password for authenticated user"""
    user = await require_active_subscription(http_request)
    db = get_db()
    
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit contenir au moins 6 caractères")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    if not verify_password(request.current_password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    
    new_hash = hash_password(request.new_password)
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"password_hash": new_hash}}
    )
    
    return {"message": "Mot de passe modifié avec succès"}

@router.post("/update-phone")
async def update_phone(request: UpdatePhoneRequest, http_request: Request):
    """Update user's phone number"""
    user = await require_auth(http_request)
    db = get_db()
    
    if not request.phone or len(request.phone) < 10:
        raise HTTPException(status_code=400, detail="Numéro de téléphone invalide")
    
    from utils import format_phone_number
    phone_clean = format_phone_number(request.phone)
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "phone": phone_clean,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Numéro de téléphone mis à jour", "phone": phone_clean}

@router.post("/update-name")
async def update_name(request: UpdateNameRequest, http_request: Request):
    """Update user's name"""
    user = await require_auth(http_request)
    db = get_db()
    
    if not request.name or len(request.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Nom invalide")
    
    name_clean = request.name.strip()
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "name": name_clean,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Nom mis à jour", "name": name_clean}

@router.get("/profile")
async def get_profile(request: Request):
    """Get user profile including phone number"""
    user = await require_auth(request)
    db = get_db()
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    return {
        "user_id": user_doc.get("user_id"),
        "email": user_doc.get("email"),
        "name": user_doc.get("name"),
        "phone": user_doc.get("phone"),
        "subscription_status": user_doc.get("subscription_status"),
        "trial_ends_at": user_doc.get("trial_ends_at")
    }

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, http_request: Request):
    """Send password reset email"""
    db = get_db()
    
    if not request.email:
        raise HTTPException(status_code=400, detail="Email requis")
    
    referer = http_request.headers.get('referer', '')
    if referer:
        from urllib.parse import urlparse
        parsed = urlparse(referer)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        base_url = str(http_request.base_url).rstrip('/')
    
    user_doc = await db.users.find_one({"email": request.email.lower().strip()}, {"_id": 0})
    
    if not user_doc:
        return {"message": "Si cet email existe, vous recevrez un lien de réinitialisation"}
    
    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.password_resets.delete_many({"email": request.email.lower().strip()})
    await db.password_resets.insert_one({
        "email": request.email.lower().strip(),
        "token": reset_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    if RESEND_API_KEY:
        reset_link = f"{base_url}/reset-password?token={reset_token}"
        html_content = f"""
        <!DOCTYPE html>
        <html><body style="margin: 0; padding: 0; background-color: #0B0B0F; font-family: sans-serif;">
            <table width="100%" style="background-color: #0B0B0F; padding: 40px;">
                <tr><td align="center">
                    <table style="max-width: 480px; background-color: #1A1A1F; border-radius: 16px; padding: 32px;">
                        <tr><td align="center" style="padding-bottom: 24px;">
                            <h1 style="color: #FFFFFF; font-size: 22px;">Réinitialisez votre mot de passe</h1>
                        </td></tr>
                        <tr><td align="center" style="padding-bottom: 24px;">
                            <a href="{reset_link}" style="display: inline-block; background: linear-gradient(135deg, #EC4899, #8B5CF6); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600;">
                                Réinitialiser
                            </a>
                        </td></tr>
                        <tr><td align="center"><p style="color: #6B7280; font-size: 12px;">Ce lien expire dans 1 heure.</p></td></tr>
                    </table>
                </td></tr>
            </table>
        </body></html>
        """
        try:
            await asyncio.to_thread(resend.Emails.send, {
                "from": f"KOLO <{SENDER_EMAIL}>",
                "to": [request.email.lower().strip()],
                "subject": "Réinitialisez votre mot de passe KOLO",
                "html": html_content
            })
        except Exception as e:
            logger.error(f"Failed to send reset email: {e}")
    
    return {"message": "Si cet email existe, vous recevrez un lien de réinitialisation"}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password using token"""
    db = get_db()
    
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    
    reset_doc = await db.password_resets.find_one({"token": request.token}, {"_id": 0})
    
    if not reset_doc:
        raise HTTPException(status_code=400, detail="Lien de réinitialisation invalide ou expiré")
    
    expires_at = reset_doc.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            await db.password_resets.delete_one({"token": request.token})
            raise HTTPException(status_code=400, detail="Lien de réinitialisation expiré")
    
    email = reset_doc.get("email")
    new_hash = hash_password(request.new_password)
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"password_hash": new_hash}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Utilisateur non trouvé")
    
    await db.password_resets.delete_one({"token": request.token})
    
    return {"message": "Mot de passe réinitialisé avec succès"}

@router.post("/create-account")
async def create_account_after_payment(request: CreateAccountRequest, response: Response, http_request: Request):
    """Create account after successful Stripe payment"""
    db = get_db()
    import stripe
    stripe.api_key = STRIPE_API_KEY
    
    if not request.email:
        raise HTTPException(status_code=400, detail="Email requis")
    
    if not request.password or len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    
    if not request.payment_token:
        raise HTTPException(status_code=400, detail="Session de paiement invalide")
    
    existing_user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if existing_user and existing_user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Ce compte existe déjà. Veuillez vous connecter.")
    
    subscription_data = {}
    if request.payment_token.startswith("cs_"):
        try:
            session = stripe.checkout.Session.retrieve(request.payment_token)
            
            if session.subscription:
                sub = stripe.Subscription.retrieve(session.subscription)
                trial_end = datetime.fromtimestamp(sub.trial_end, tz=timezone.utc) if sub.trial_end else None
                
                current_period_end = None
                items_data = sub.get('items', {})
                if items_data and items_data.get('data'):
                    item_period_end = items_data['data'][0].get('current_period_end')
                    if item_period_end:
                        current_period_end = datetime.fromtimestamp(item_period_end, tz=timezone.utc)
                
                if not current_period_end and trial_end:
                    current_period_end = trial_end
                
                subscription_data = {
                    "subscription_id": session.subscription,
                    "stripe_customer_id": session.customer,
                    "subscription_status": sub.status,
                    "trial_ends_at": trial_end.isoformat() if trial_end else None,
                    "subscription_ends_at": current_period_end.isoformat() if current_period_end else None,
                    "cancel_at_period_end": sub.cancel_at_period_end
                }
            else:
                if session.payment_status != "paid":
                    raise HTTPException(status_code=400, detail="Le paiement n'est pas complété.")
                subscription_data = {"subscription_status": "active"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Stripe verification error: {e}")
            raise HTTPException(status_code=400, detail=f"Impossible de vérifier le paiement: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Session de paiement invalide")
    
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "password_hash": hash_password(request.password),
                "stripe_session_id": request.payment_token,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                **subscription_data
            }}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": request.email,
            "auth_provider": "email",
            "password_hash": hash_password(request.password),
            "stripe_session_id": request.payment_token,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            **subscription_data
        }
        await db.users.insert_one(user_doc)
    
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session_doc = {
        "session_id": f"sess_{uuid.uuid4().hex}",
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return {
        "success": True,
        "user_id": user_id,
        "email": request.email,
        "subscription_status": subscription_data.get("subscription_status", "active"),
        "token": session_token
    }
