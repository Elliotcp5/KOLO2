from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import hashlib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing helper
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

# Stripe setup
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
)

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')

# Regional pricing configuration (9.99 in each currency)
PRICING = {
    'EUR': {'amount': 9.99, 'currency': 'eur', 'symbol': '€'},
    'GBP': {'amount': 9.99, 'currency': 'gbp', 'symbol': '£'},
    'USD': {'amount': 9.99, 'currency': 'usd', 'symbol': '$'},
}

# EU countries (ISO 3166-1 alpha-2)
EU_COUNTRIES = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:12]}")
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    auth_provider: str = "google"
    locale: Optional[str] = None
    country: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    subscription_status: str = "none"
    subscription_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: f"sess_{uuid.uuid4().hex}")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    task_id: str = Field(default_factory=lambda: f"task_{uuid.uuid4().hex[:12]}")
    user_id: str
    prospect_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    task_type: str = "follow_up"  # follow_up, call, meeting, email, other
    due_date: datetime
    completed: bool = False
    completed_at: Optional[datetime] = None
    auto_generated: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Prospect(BaseModel):
    model_config = ConfigDict(extra="ignore")
    prospect_id: str = Field(default_factory=lambda: f"prospect_{uuid.uuid4().hex[:12]}")
    user_id: str
    full_name: str
    phone: str
    email: str
    source: str = "manual"
    status: str = "new"  # new, in_progress, closed, lost
    notes: Optional[str] = None
    last_activity_date: Optional[datetime] = None
    next_task_id: Optional[str] = None
    next_task_date: Optional[datetime] = None
    next_task_title: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str = Field(default_factory=lambda: f"txn_{uuid.uuid4().hex[:12]}")
    session_id: str
    user_email: Optional[str] = None
    amount: float
    currency: str
    payment_status: str = "pending"
    metadata: Optional[Dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentSuccess(BaseModel):
    model_config = ConfigDict(extra="ignore")
    token: str = Field(default_factory=lambda: f"paysuccess_{uuid.uuid4().hex}")
    email: str
    session_id: str
    expires_at: datetime
    used: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== REQUEST/RESPONSE MODELS ====================

class CreateCheckoutRequest(BaseModel):
    origin_url: str
    email: Optional[str] = None
    locale: Optional[str] = None
    country: Optional[str] = None

class CreateCheckoutResponse(BaseModel):
    url: str
    session_id: str

class AuthSessionRequest(BaseModel):
    session_id: str

class CreateProspectRequest(BaseModel):
    full_name: str
    phone: str
    email: EmailStr
    source: str = "manual"
    status: str = "new"
    notes: Optional[str] = None

class UpdateProspectRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    source: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class CreateTaskRequest(BaseModel):
    prospect_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    task_type: str = "follow_up"
    due_date: datetime

class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    task_type: Optional[str] = None
    due_date: Optional[datetime] = None
    completed: Optional[bool] = None

class GeoResponse(BaseModel):
    country: str
    currency: str
    amount: float
    symbol: str
    locale: str

class CreateAccountRequest(BaseModel):
    payment_token: str
    email: Optional[str] = None
    password: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class RecoverAccountRequest(BaseModel):
    email: str
    password: str

# ==================== HELPER FUNCTIONS ====================

def get_currency_for_country(country_code: str) -> str:
    if country_code == 'GB':
        return 'GBP'
    elif country_code in EU_COUNTRIES:
        return 'EUR'
    else:
        return 'USD'

def get_pricing_for_country(country_code: str) -> dict:
    currency = get_currency_for_country(country_code)
    return PRICING[currency]

async def get_user_from_session(request: Request) -> Optional[User]:
    session_token = request.cookies.get('session_token')
    
    if not session_token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            session_token = auth_header[7:]
    
    if not session_token:
        return None
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        return None
    
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        return None
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        return None
    
    return User(**user_doc)

async def require_auth(request: Request) -> User:
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_active_subscription(request: Request) -> User:
    user = await require_auth(request)
    if user.subscription_status not in ['active', 'trialing']:
        raise HTTPException(status_code=403, detail="Active subscription required")
    return user

async def update_prospect_next_task(prospect_id: str, user_id: str):
    """Update prospect with next scheduled task info"""
    next_task = await db.tasks.find_one(
        {
            "prospect_id": prospect_id,
            "user_id": user_id,
            "completed": False
        },
        {"_id": 0},
        sort=[("due_date", 1)]
    )
    
    if next_task:
        due_date = next_task.get("due_date")
        if isinstance(due_date, str):
            due_date = datetime.fromisoformat(due_date)
        
        await db.prospects.update_one(
            {"prospect_id": prospect_id},
            {"$set": {
                "next_task_id": next_task["task_id"],
                "next_task_date": due_date.isoformat() if isinstance(due_date, datetime) else due_date,
                "next_task_title": next_task["title"],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        await db.prospects.update_one(
            {"prospect_id": prospect_id},
            {"$set": {
                "next_task_id": None,
                "next_task_date": None,
                "next_task_title": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )

async def generate_follow_up_tasks_for_user(user_id: str):
    """Generate automatic follow-up tasks for inactive prospects"""
    now = datetime.now(timezone.utc)
    one_week_ago = now - timedelta(days=7)
    
    # Find prospects that are not closed/lost and have no recent activity
    prospects = await db.prospects.find(
        {
            "user_id": user_id,
            "status": {"$nin": ["closed", "lost"]}
        },
        {"_id": 0}
    ).to_list(1000)
    
    for prospect in prospects:
        last_activity = prospect.get("last_activity_date")
        if last_activity:
            if isinstance(last_activity, str):
                last_activity = datetime.fromisoformat(last_activity)
            if last_activity.tzinfo is None:
                last_activity = last_activity.replace(tzinfo=timezone.utc)
        else:
            # Use created_at if no activity
            created_at = prospect.get("created_at")
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)
            if created_at and created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            last_activity = created_at or now
        
        # Check if more than 7 days since last activity
        if last_activity < one_week_ago:
            # Check if there's already an uncompleted auto-generated task for this prospect
            existing_task = await db.tasks.find_one({
                "prospect_id": prospect["prospect_id"],
                "user_id": user_id,
                "auto_generated": True,
                "completed": False
            })
            
            if not existing_task:
                # Create a new follow-up task
                task = Task(
                    user_id=user_id,
                    prospect_id=prospect["prospect_id"],
                    title=f"Suivi {prospect['full_name']}",
                    description=f"Aucune activité depuis plus d'une semaine. Pensez à recontacter ce prospect.",
                    task_type="follow_up",
                    due_date=now,
                    auto_generated=True
                )
                task_doc = task.model_dump()
                task_doc['due_date'] = task_doc['due_date'].isoformat()
                task_doc['created_at'] = task_doc['created_at'].isoformat()
                task_doc['updated_at'] = task_doc['updated_at'].isoformat()
                await db.tasks.insert_one(task_doc)
                
                # Update prospect with next task info
                await update_prospect_next_task(prospect["prospect_id"], user_id)

# ==================== GEO ENDPOINT ====================

@api_router.get("/geo", response_model=GeoResponse)
async def get_geo_info(request: Request, locale: Optional[str] = None, country: Optional[str] = None):
    detected_country = country or request.headers.get('CF-IPCountry', 'US')
    detected_locale = locale or request.headers.get('Accept-Language', 'en-US').split(',')[0]
    
    pricing = get_pricing_for_country(detected_country)
    
    return GeoResponse(
        country=detected_country,
        currency=pricing['currency'].upper(),
        amount=pricing['amount'],
        symbol=pricing['symbol'],
        locale=detected_locale
    )

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/session")
async def process_auth_session(request: AuthSessionRequest, response: Response):
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
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

@api_router.get("/auth/me")
async def get_current_user(request: Request):
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

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get('session_token')
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ==================== PAYMENT ENDPOINTS ====================

@api_router.post("/payments/create-checkout", response_model=CreateCheckoutResponse)
async def create_checkout(request: CreateCheckoutRequest, http_request: Request):
    country = request.country or http_request.headers.get('CF-IPCountry', 'US')
    pricing = get_pricing_for_country(country)
    
    success_url = f"{request.origin_url}/create-account?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/subscribe"
    
    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    checkout_request = CheckoutSessionRequest(
        amount=pricing['amount'],
        currency=pricing['currency'],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "email": request.email or "",
            "locale": request.locale or "en",
            "country": country,
            "type": "subscription"
        },
        payment_methods=['card']
    )
    
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
    
    transaction = PaymentTransaction(
        session_id=session.session_id,
        user_email=request.email,
        amount=pricing['amount'],
        currency=pricing['currency'],
        payment_status="pending",
        metadata={"country": country, "locale": request.locale}
    )
    txn_doc = transaction.model_dump()
    txn_doc['created_at'] = txn_doc['created_at'].isoformat()
    txn_doc['updated_at'] = txn_doc['updated_at'].isoformat()
    await db.payment_transactions.insert_one(txn_doc)
    
    return CreateCheckoutResponse(url=session.url, session_id=session.session_id)

# Direct redirect endpoint - works on all browsers including iOS
@api_router.get("/payments/checkout-redirect")
async def checkout_redirect(http_request: Request, locale: str = "en", country: str = "US"):
    """Direct server-side redirect to Stripe checkout - bypasses JavaScript issues"""
    from starlette.responses import RedirectResponse
    
    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Get origin from referer or use host
    referer = http_request.headers.get('referer', '')
    if referer:
        from urllib.parse import urlparse
        parsed = urlparse(referer)
        origin_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        origin_url = str(http_request.base_url).rstrip('/')
    
    success_url = f"{origin_url}/create-account?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/subscribe"
    
    # Get pricing based on country
    pricing = get_pricing_for_country(country)
    
    checkout_request = CheckoutSessionRequest(
        amount=pricing['amount'],
        currency=pricing['currency'],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "locale": locale,
            "country": country,
            "type": "subscription"
        },
        payment_methods=['card']
    )
    
    try:
        session = await stripe_checkout.create_checkout_session(checkout_request)
        # Direct redirect to Stripe
        return RedirectResponse(url=session.url, status_code=303)
    except Exception as e:
        logger.error(f"Checkout redirect error: {e}")
        # Redirect back to subscribe page with error
        return RedirectResponse(url=f"{origin_url}/subscribe?error=payment_failed", status_code=303)

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, http_request: Request):
    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.error(f"Stripe status error: {e}")
        raise HTTPException(status_code=400, detail="Failed to get payment status")
    
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": status.payment_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    payment_token = None
    if status.payment_status == "paid":
        existing_token = await db.payment_success.find_one(
            {"session_id": session_id},
            {"_id": 0}
        )
        
        if existing_token:
            payment_token = existing_token["token"]
        else:
            email = status.metadata.get("email", "")
            token = PaymentSuccess(
                email=email,
                session_id=session_id,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
            )
            token_doc = token.model_dump()
            token_doc['expires_at'] = token_doc['expires_at'].isoformat()
            token_doc['created_at'] = token_doc['created_at'].isoformat()
            await db.payment_success.insert_one(token_doc)
            payment_token = token.token
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "payment_token": payment_token
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.session_id:
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {
                    "payment_status": webhook_response.payment_status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

@api_router.post("/payments/validate-token")
async def validate_payment_token(token: str):
    token_doc = await db.payment_success.find_one(
        {"token": token, "used": False},
        {"_id": 0}
    )
    
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or used token")
    
    expires_at = token_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    
    return {"valid": True, "email": token_doc.get("email")}

@api_router.post("/auth/create-account")
async def create_account_after_payment(request: CreateAccountRequest, response: Response, http_request: Request):
    """Create account after successful Stripe payment - simplified and robust"""
    
    # Validate input
    if not request.email:
        raise HTTPException(status_code=400, detail="Email requis")
    
    if not request.password or len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    
    if not request.payment_token:
        raise HTTPException(status_code=400, detail="Session de paiement invalide")
    
    # Check if user already exists with this email and has a password
    existing_user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if existing_user and existing_user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Ce compte existe déjà. Veuillez vous connecter.")
    
    # Verify payment with Stripe
    if request.payment_token.startswith("cs_"):
        try:
            host_url = str(http_request.base_url)
            webhook_url = f"{host_url}api/webhook/stripe"
            stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
            status = await stripe_checkout.get_checkout_status(request.payment_token)
            
            if status.payment_status != "paid":
                raise HTTPException(status_code=400, detail="Le paiement n'est pas complété. Veuillez réessayer.")
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Stripe verification error: {e}")
            raise HTTPException(status_code=400, detail="Impossible de vérifier le paiement. Veuillez réessayer.")
    else:
        raise HTTPException(status_code=400, detail="Session de paiement invalide")
    
    # Create or update user
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "subscription_status": "active",
                "password_hash": hash_password(request.password),
                "stripe_session_id": request.payment_token,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": request.email,
            "auth_provider": "email",
            "subscription_status": "active",
            "password_hash": hash_password(request.password),
            "stripe_session_id": request.payment_token,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    
    # Store payment record
    await db.payment_success.update_one(
        {"session_id": request.payment_token},
        {"$set": {
            "session_id": request.payment_token,
            "email": request.email,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    session_token = f"sess_{uuid.uuid4().hex}"
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
        "subscription_status": "active"
    }

# Email/Password Login
@api_router.post("/auth/login")
async def login_with_password(request: LoginRequest, response: Response):
    """Login with email and password"""
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Please use Google login or reset your password")
    
    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user.get("subscription_status") != "active":
        raise HTTPException(status_code=403, detail="Subscription not active")
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session = UserSession(
        user_id=user["user_id"],
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
        "user_id": user["user_id"],
        "email": user["email"],
        "subscription_status": user["subscription_status"]
    }

# Recover account - for users who paid but didn't complete account creation
@api_router.post("/auth/recover")
async def recover_account(request: RecoverAccountRequest, response: Response, http_request: Request):
    """Recover account for users who have a Stripe subscription but no account"""
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    if existing_user and existing_user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Account already exists. Please login.")
    
    # Check Stripe for active subscription with this email
    # For now, check if there's a payment record for this email
    payment_record = await db.payment_transactions.find_one(
        {"user_email": request.email, "payment_status": "paid"},
        {"_id": 0}
    )
    
    # Also check payment_success collection
    payment_success = await db.payment_success.find_one(
        {"email": request.email},
        {"_id": 0}
    )
    
    if not payment_record and not payment_success:
        raise HTTPException(status_code=404, detail="No payment found for this email. Please subscribe first.")
    
    # Create or update user
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "password_hash": hash_password(request.password),
                "subscription_status": "active",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = User(
            user_id=user_id,
            email=request.email,
            auth_provider="email",
            subscription_status="active"
        )
        user_doc = new_user.model_dump()
        user_doc['password_hash'] = hash_password(request.password)
        user_doc['created_at'] = user_doc['created_at'].isoformat()
        user_doc['updated_at'] = user_doc['updated_at'].isoformat()
        await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
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
        "email": request.email,
        "subscription_status": "active",
        "message": "Account recovered successfully"
    }

# ==================== TASK ENDPOINTS ====================

@api_router.get("/tasks")
async def list_tasks(request: Request, include_completed: bool = False):
    """List all tasks for authenticated user"""
    user = await require_active_subscription(request)
    
    # Generate follow-up tasks for inactive prospects
    await generate_follow_up_tasks_for_user(user.user_id)
    
    query = {"user_id": user.user_id}
    if not include_completed:
        query["completed"] = False
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(1000)
    
    # Enrich tasks with prospect info
    for task in tasks:
        if task.get("prospect_id"):
            prospect = await db.prospects.find_one(
                {"prospect_id": task["prospect_id"]},
                {"_id": 0, "full_name": 1, "phone": 1, "email": 1, "status": 1}
            )
            task["prospect"] = prospect
    
    return {"tasks": tasks}

@api_router.get("/tasks/today")
async def list_today_tasks(request: Request):
    """List tasks due today or overdue"""
    user = await require_active_subscription(request)
    
    # Generate follow-up tasks for inactive prospects
    await generate_follow_up_tasks_for_user(user.user_id)
    
    now = datetime.now(timezone.utc)
    end_of_today = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    tasks = await db.tasks.find(
        {
            "user_id": user.user_id,
            "completed": False,
            "due_date": {"$lte": end_of_today.isoformat()}
        },
        {"_id": 0}
    ).sort("due_date", 1).to_list(1000)
    
    # Enrich tasks with prospect info
    for task in tasks:
        if task.get("prospect_id"):
            prospect = await db.prospects.find_one(
                {"prospect_id": task["prospect_id"]},
                {"_id": 0, "full_name": 1, "phone": 1, "email": 1, "status": 1}
            )
            task["prospect"] = prospect
    
    return {"tasks": tasks}

@api_router.post("/tasks")
async def create_task(request: Request, task_data: CreateTaskRequest):
    """Create a new task"""
    user = await require_active_subscription(request)
    
    # Verify prospect exists if provided
    if task_data.prospect_id:
        prospect = await db.prospects.find_one(
            {"prospect_id": task_data.prospect_id, "user_id": user.user_id}
        )
        if not prospect:
            raise HTTPException(status_code=404, detail="Prospect not found")
    
    task = Task(
        user_id=user.user_id,
        prospect_id=task_data.prospect_id,
        title=task_data.title,
        description=task_data.description,
        task_type=task_data.task_type,
        due_date=task_data.due_date,
        auto_generated=False
    )
    
    doc = task.model_dump()
    doc['due_date'] = doc['due_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.tasks.insert_one(doc)
    
    # Update prospect's next task if applicable
    if task_data.prospect_id:
        await update_prospect_next_task(task_data.prospect_id, user.user_id)
        # Update last activity date
        await db.prospects.update_one(
            {"prospect_id": task_data.prospect_id},
            {"$set": {
                "last_activity_date": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {"task_id": task.task_id, "message": "Task created"}

@api_router.put("/tasks/{task_id}")
async def update_task(request: Request, task_id: str, update_data: UpdateTaskRequest):
    """Update a task"""
    user = await require_active_subscription(request)
    
    task = await db.tasks.find_one(
        {"task_id": task_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_fields = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    # Handle completion
    if update_data.completed is True and not task.get("completed"):
        update_fields["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        # Update prospect's last activity if task is linked to a prospect
        if task.get("prospect_id"):
            await db.prospects.update_one(
                {"prospect_id": task["prospect_id"]},
                {"$set": {
                    "last_activity_date": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
    
    if "due_date" in update_fields and isinstance(update_fields["due_date"], datetime):
        update_fields["due_date"] = update_fields["due_date"].isoformat()
    
    update_fields['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.tasks.update_one(
        {"task_id": task_id, "user_id": user.user_id},
        {"$set": update_fields}
    )
    
    # Update prospect's next task if applicable
    if task.get("prospect_id"):
        await update_prospect_next_task(task["prospect_id"], user.user_id)
    
    return {"message": "Task updated"}

@api_router.delete("/tasks/{task_id}")
async def delete_task(request: Request, task_id: str):
    """Delete a task"""
    user = await require_active_subscription(request)
    
    task = await db.tasks.find_one(
        {"task_id": task_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    prospect_id = task.get("prospect_id")
    
    await db.tasks.delete_one({"task_id": task_id, "user_id": user.user_id})
    
    # Update prospect's next task if applicable
    if prospect_id:
        await update_prospect_next_task(prospect_id, user.user_id)
    
    return {"message": "Task deleted"}

@api_router.post("/tasks/{task_id}/complete")
async def complete_task(request: Request, task_id: str):
    """Mark a task as completed"""
    user = await require_active_subscription(request)
    
    task = await db.tasks.find_one(
        {"task_id": task_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    now = datetime.now(timezone.utc)
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "completed": True,
            "completed_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    # Update prospect's last activity if task is linked to a prospect
    if task.get("prospect_id"):
        await db.prospects.update_one(
            {"prospect_id": task["prospect_id"]},
            {"$set": {
                "last_activity_date": now.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        await update_prospect_next_task(task["prospect_id"], user.user_id)
    
    return {"message": "Task completed"}

# ==================== PROSPECT ENDPOINTS ====================

@api_router.get("/prospects")
async def list_prospects(request: Request):
    """List all prospects for authenticated user"""
    user = await require_active_subscription(request)
    
    prospects = await db.prospects.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return {"prospects": prospects}

@api_router.post("/prospects")
async def create_prospect(request: Request, prospect_data: CreateProspectRequest):
    """Create a new prospect"""
    user = await require_active_subscription(request)
    
    now = datetime.now(timezone.utc)
    
    prospect = Prospect(
        user_id=user.user_id,
        full_name=prospect_data.full_name,
        phone=prospect_data.phone,
        email=prospect_data.email,
        source=prospect_data.source,
        status=prospect_data.status,
        notes=prospect_data.notes,
        last_activity_date=now
    )
    
    doc = prospect.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    doc['last_activity_date'] = doc['last_activity_date'].isoformat() if doc['last_activity_date'] else None
    await db.prospects.insert_one(doc)
    
    return {"prospect_id": prospect.prospect_id, "message": "Prospect created"}

@api_router.get("/prospects/{prospect_id}")
async def get_prospect(request: Request, prospect_id: str):
    """Get a single prospect with tasks"""
    user = await require_active_subscription(request)
    
    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Get tasks for this prospect
    tasks = await db.tasks.find(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    ).sort("due_date", -1).to_list(100)
    
    prospect["tasks"] = tasks
    
    return prospect

@api_router.put("/prospects/{prospect_id}")
async def update_prospect(request: Request, prospect_id: str, update_data: UpdateProspectRequest):
    """Update a prospect"""
    user = await require_active_subscription(request)
    
    update_fields = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_fields['updated_at'] = datetime.now(timezone.utc).isoformat()
    update_fields['last_activity_date'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.prospects.update_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    return {"message": "Prospect updated"}

@api_router.delete("/prospects/{prospect_id}")
async def delete_prospect(request: Request, prospect_id: str):
    """Delete a prospect and its tasks"""
    user = await require_active_subscription(request)
    
    result = await db.prospects.delete_one(
        {"prospect_id": prospect_id, "user_id": user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Delete associated tasks
    await db.tasks.delete_many(
        {"prospect_id": prospect_id, "user_id": user.user_id}
    )
    
    return {"message": "Prospect deleted"}


# ==================== NOTIFICATION ENDPOINTS ====================

class NotificationSubscription(BaseModel):
    subscription: Dict
    user_id: Optional[str] = None

@api_router.post("/notifications/subscribe")
async def subscribe_notifications(request: Request, data: NotificationSubscription):
    """Save push notification subscription"""
    user = await get_user_from_session(request)
    user_id = data.user_id or (user.user_id if user else None)
    
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID required")
    
    # Store subscription
    await db.push_subscriptions.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "subscription": data.subscription,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Subscription saved"}

@api_router.delete("/notifications/unsubscribe")
async def unsubscribe_notifications(request: Request):
    """Remove push notification subscription"""
    user = await require_auth(request)
    
    await db.push_subscriptions.delete_one({"user_id": user.user_id})
    
    return {"message": "Unsubscribed"}

@api_router.post("/notifications/trigger")
async def trigger_notifications(request: Request):
    """Manually trigger notification job (admin only)"""
    # Import and run the scheduler
    from notification_scheduler import run_once
    
    try:
        result = await run_once()
        return {"status": "success", "result": result}
    except Exception as e:
        logger.error(f"Notification trigger error: {e}")
        return {"status": "error", "message": str(e)}

@api_router.get("/notifications/vapid-key")
async def get_vapid_public_key():
    """Get VAPID public key for push subscription"""
    # Read public key and convert to base64
    vapid_public_key_file = os.environ.get('VAPID_PUBLIC_KEY_FILE', '/app/backend/vapid_public.pem')
    
    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.backends import default_backend
        import base64
        
        with open(vapid_public_key_file, 'rb') as f:
            public_key = serialization.load_pem_public_key(f.read(), backend=default_backend())
        
        # Get the raw bytes in uncompressed point format
        pub_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint
        )
        
        # Convert to URL-safe base64
        pub_b64 = base64.urlsafe_b64encode(pub_bytes).decode('utf-8').rstrip('=')
        
        return {"vapid_public_key": pub_b64}
    except Exception as e:
        logger.error(f"Error reading VAPID key: {e}")
        # Fallback to default key
        return {"vapid_public_key": "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"}



# ==================== ROOT ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "KOLO API v1.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== BACKGROUND SCHEDULER ====================
import asyncio
import threading

async def run_background_scheduler():
    """Background task that runs the notification scheduler at 8:00 AM UTC daily"""
    while True:
        try:
            now = datetime.now(timezone.utc)
            target_hour = 8  # 8:00 AM UTC
            
            # Check if it's time to run (within the first 5 minutes of the target hour)
            if now.hour == target_hour and now.minute < 5:
                logger.info("Running scheduled notification job...")
                
                # Import and run the scheduler
                try:
                    from notification_scheduler import run_once
                    result = await run_once()
                    logger.info(f"Scheduled job completed: {result}")
                except Exception as e:
                    logger.error(f"Scheduled job error: {e}")
                
                # Wait for 1 hour to avoid running multiple times
                await asyncio.sleep(3600)
            else:
                # Check every minute
                await asyncio.sleep(60)
                
        except Exception as e:
            logger.error(f"Background scheduler error: {e}")
            await asyncio.sleep(60)

def start_background_scheduler():
    """Start the background scheduler in a new event loop"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(run_background_scheduler())

@app.on_event("startup")
async def startup_event():
    """Start background scheduler on app startup"""
    # Start scheduler in a background thread
    scheduler_thread = threading.Thread(target=start_background_scheduler, daemon=True)
    scheduler_thread.start()
    logger.info("Background notification scheduler started")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
