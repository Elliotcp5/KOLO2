from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import hashlib

ROOT_DIR = Path(__file__).parent

# Load .env without override - allows K8s env vars to take precedence in production
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

# Regional pricing configuration (in cents - 999 = 9.99)
PRICING = {
    'EUR': {'amount': 999, 'currency': 'eur', 'symbol': '€', 'display': '9,99'},
    'GBP': {'amount': 999, 'currency': 'gbp', 'symbol': '£', 'display': '9.99'},
    'USD': {'amount': 999, 'currency': 'usd', 'symbol': '$', 'display': '9.99'},
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

# Configure logging with immediate flush
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    force=True
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Add stream handler to ensure immediate output
import sys
handler = logging.StreamHandler(sys.stderr)
handler.setLevel(logging.DEBUG)
handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(handler)

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
    subscription_status: str = "none"  # none, trialing, active, canceled, past_due
    subscription_id: Optional[str] = None
    trial_ends_at: Optional[datetime] = None
    subscription_ends_at: Optional[datetime] = None
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

class RegisterRequest(BaseModel):
    """Request for free trial registration (no payment required)"""
    email: str
    password: str
    full_name: str
    phone: str
    country_code: str = "+33"

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
    
    # Check if user has active subscription
    if user.subscription_status == 'active':
        return user
    
    # Check if user is in valid trial period
    if user.subscription_status == 'trialing':
        if user.trial_ends_at:
            trial_end = user.trial_ends_at
            if isinstance(trial_end, str):
                trial_end = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
            if trial_end.tzinfo is None:
                trial_end = trial_end.replace(tzinfo=timezone.utc)
            
            if datetime.now(timezone.utc) <= trial_end:
                return user
            else:
                # Trial has expired - update status in DB
                await db.users.update_one(
                    {"user_id": user.user_id},
                    {"$set": {"subscription_status": "expired"}}
                )
                raise HTTPException(
                    status_code=403, 
                    detail="Votre essai gratuit est terminé. Abonnez-vous pour continuer à utiliser KOLO."
                )
        else:
            # No trial_ends_at set, allow access (legacy trialing users)
            return user
    
    # User has no active subscription or trial
    raise HTTPException(
        status_code=403, 
        detail="Abonnement requis pour accéder à cette fonctionnalité."
    )

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
                    description="Aucune activité depuis plus d'une semaine. Pensez à recontacter ce prospect.",
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
    # Check for session token in cookies first, then in Authorization header
    session_token = request.cookies.get('session_token')
    
    if not session_token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            session_token = auth_header[7:]
    
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
async def checkout_redirect(http_request: Request, locale: str = "en", country: str = "US", email: str = ""):
    """Direct server-side redirect to Stripe checkout - bypasses JavaScript issues"""
    from starlette.responses import RedirectResponse
    
    # Get origin from referer or use host
    referer = http_request.headers.get('referer', '')
    if referer:
        from urllib.parse import urlparse
        parsed = urlparse(referer)
        origin_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        origin_url = str(http_request.base_url).rstrip('/')
    
    # Check if email has already paid in the last 30 days (prevent double billing)
    if email:
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        
        # Check for existing active user with this email
        existing_user = await db.users.find_one({
            "email": email,
            "subscription_status": "active"
        })
        
        if existing_user:
            # User already has active subscription
            return RedirectResponse(url=f"{origin_url}/subscribe?error=already_subscribed", status_code=303)
        
        # Check for recent successful payment
        recent_payment = await db.payment_success.find_one({
            "email": email,
            "created_at": {"$gte": thirty_days_ago}
        })
        
        if recent_payment:
            # Already paid recently, redirect to account creation
            return RedirectResponse(url=f"{origin_url}/create-account?session_id={recent_payment.get('session_id', '')}", status_code=303)
    
    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    
    success_url = f"{origin_url}/create-account?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/subscribe"
    
    # Get pricing based on country
    pricing = get_pricing_for_country(country)
    
    # Use Stripe directly for subscription with 3-day free trial
    import stripe
    stripe.api_key = STRIPE_API_KEY
    
    try:
        # First, get or create the price for this currency
        # We use a lookup key based on currency
        price_lookup_key = f"kolo_trial_{pricing['currency'].lower()}"
        
        # Try to find existing price with this lookup key
        existing_prices = stripe.Price.list(lookup_keys=[price_lookup_key], limit=1)
        
        if existing_prices.data:
            price_id = existing_prices.data[0].id
        else:
            # Create a dedicated product for trials with simple name
            product = stripe.Product.create(
                name="Essayez KOLO",
                description="7 jours gratuits"
            )
            product_id = product.id
            
            # Create price with lookup key
            price = stripe.Price.create(
                product=product_id,
                unit_amount=pricing['amount'],
                currency=pricing['currency'].lower(),
                recurring={"interval": "month"},
                lookup_key=price_lookup_key
            )
            price_id = price.id
        
        # Create checkout session with subscription and 7-day trial
        # Using only 'card' payment method to avoid duplicate Apple Pay buttons
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{
                "price": price_id,
                "quantity": 1
            }],
            subscription_data={
                "trial_period_days": 7,
                "metadata": {
                    "email": email,
                    "locale": locale,
                    "country": country
                }
            },
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "email": email,
                "locale": locale,
                "country": country,
                "type": "subscription_with_trial"
            },
            allow_promotion_codes=False
        )
        
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
    
    import stripe
    stripe.api_key = STRIPE_API_KEY
    
    try:
        # Parse the event from Stripe
        event = stripe.Webhook.construct_event(
            body, signature, os.environ.get('STRIPE_WEBHOOK_SECRET', '')
        ) if signature and os.environ.get('STRIPE_WEBHOOK_SECRET') else None
        
        # If no webhook secret, parse event directly (development mode)
        if not event:
            import json
            event_data = json.loads(body)
            event = stripe.Event.construct_from(event_data, stripe.api_key)
        
        event_type = event.type
        logger.info(f"Stripe webhook received: {event_type}")
        
        # Handle subscription events
        if event_type == "customer.subscription.created":
            sub = event.data.object
            await handle_subscription_update(sub)
        
        elif event_type == "customer.subscription.updated":
            sub = event.data.object
            await handle_subscription_update(sub)
        
        elif event_type == "customer.subscription.deleted":
            sub = event.data.object
            await handle_subscription_deleted(sub)
        
        elif event_type == "checkout.session.completed":
            session = event.data.object
            email = session.metadata.get("email") or session.customer_email
            subscription_id = session.subscription
            customer_id = session.customer
            
            if email and subscription_id:
                # Get subscription details
                sub = stripe.Subscription.retrieve(subscription_id)
                trial_end = datetime.fromtimestamp(sub.trial_end, tz=timezone.utc) if sub.trial_end else None
                
                # Store payment success
                token_doc = {
                    "session_id": session.id,
                    "email": email,
                    "subscription_id": subscription_id,
                    "customer_id": customer_id,
                    "status": sub.status,
                    "trial_ends_at": trial_end.isoformat() if trial_end else None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "token": f"pay_{uuid.uuid4().hex}",
                    "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
                    "used": False
                }
                await db.payment_success.insert_one(token_doc)
                logger.info(f"Payment success recorded for {email}")
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

async def handle_subscription_update(sub):
    """Handle subscription created or updated"""
    customer_id = sub.customer
    subscription_id = sub.id
    status = sub.status
    trial_end = datetime.fromtimestamp(sub.trial_end, tz=timezone.utc) if sub.trial_end else None
    current_period_end = datetime.fromtimestamp(sub.current_period_end, tz=timezone.utc) if sub.current_period_end else None
    cancel_at_period_end = sub.cancel_at_period_end
    
    # Find user by stripe customer ID
    user_doc = await db.users.find_one({"stripe_customer_id": customer_id})
    
    if user_doc:
        await db.users.update_one(
            {"stripe_customer_id": customer_id},
            {"$set": {
                "subscription_id": subscription_id,
                "subscription_status": status,
                "trial_ends_at": trial_end.isoformat() if trial_end else None,
                "subscription_ends_at": current_period_end.isoformat() if current_period_end else None,
                "cancel_at_period_end": cancel_at_period_end,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"Updated subscription status for customer {customer_id}: {status}")

async def handle_subscription_deleted(sub):
    """Handle subscription cancelled/deleted"""
    customer_id = sub.customer
    
    await db.users.update_one(
        {"stripe_customer_id": customer_id},
        {"$set": {
            "subscription_status": "canceled",
            "cancel_at_period_end": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    logger.info(f"Subscription cancelled for customer {customer_id}")

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

class BillingPortalRequest(BaseModel):
    action: str  # payment_method, billing_address, change_email

@api_router.post("/billing/portal")
async def create_billing_portal(request: BillingPortalRequest, http_request: Request):
    """Create a Stripe Customer Portal session for billing management"""
    user = await require_active_subscription(http_request)
    
    import stripe
    stripe.api_key = STRIPE_API_KEY
    
    # Check if user has a stripe customer ID
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    stripe_customer_id = user_doc.get("stripe_customer_id") if user_doc else None
    
    if not stripe_customer_id:
        # Try to find or create customer
        try:
            # First, check if customer exists by email
            customers = stripe.Customer.list(email=user.email, limit=1)
            if customers.data:
                stripe_customer_id = customers.data[0].id
            else:
                # Create a new Stripe customer
                customer = stripe.Customer.create(
                    email=user.email,
                    metadata={"user_id": user.user_id}
                )
                stripe_customer_id = customer.id
            
            # Save customer ID for future use
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$set": {"stripe_customer_id": stripe_customer_id}}
            )
        except Exception as e:
            logger.error(f"Stripe customer creation error: {e}")
            raise HTTPException(status_code=400, detail="Impossible de créer le profil de facturation. Veuillez réessayer.")
    
    try:
        # Get origin URL for return
        referer = http_request.headers.get('referer', '')
        if referer:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            return_url = f"{parsed.scheme}://{parsed.netloc}/app"
        else:
            return_url = str(http_request.base_url).rstrip('/') + "/app"
        
        # Create Customer Portal session
        portal_session = stripe.billing_portal.Session.create(
            customer=stripe_customer_id,
            return_url=return_url
        )
        
        return {"url": portal_session.url}
    except Exception as e:
        logger.error(f"Billing portal error: {e}")
        raise HTTPException(status_code=500, detail="Impossible d'accéder au portail de facturation. Veuillez réessayer.")

@api_router.get("/subscription/status")
async def get_subscription_status(http_request: Request):
    """Get detailed subscription status for current user"""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = user["user_id"]
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # If user has a subscription ID, check Stripe for current status
    subscription_id = user_doc.get("subscription_id")
    if subscription_id:
        try:
            import stripe
            stripe.api_key = STRIPE_API_KEY
            sub = stripe.Subscription.retrieve(subscription_id)
            
            # Update local status
            status = sub.status  # trialing, active, canceled, past_due, etc.
            trial_end = datetime.fromtimestamp(sub.trial_end, tz=timezone.utc) if sub.trial_end else None
            current_period_end = datetime.fromtimestamp(sub.current_period_end, tz=timezone.utc) if sub.current_period_end else None
            cancel_at_period_end = sub.cancel_at_period_end
            
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {
                    "subscription_status": status,
                    "trial_ends_at": trial_end.isoformat() if trial_end else None,
                    "subscription_ends_at": current_period_end.isoformat() if current_period_end else None,
                    "cancel_at_period_end": cancel_at_period_end
                }}
            )
            
            return {
                "status": status,
                "trial_ends_at": trial_end.isoformat() if trial_end else None,
                "subscription_ends_at": current_period_end.isoformat() if current_period_end else None,
                "cancel_at_period_end": cancel_at_period_end,
                "is_active": status in ["trialing", "active"]
            }
        except Exception as e:
            logger.error(f"Stripe subscription check error: {e}")
    
    # Fallback to local data
    return {
        "status": user_doc.get("subscription_status", "none"),
        "trial_ends_at": user_doc.get("trial_ends_at"),
        "subscription_ends_at": user_doc.get("subscription_ends_at"),
        "cancel_at_period_end": user_doc.get("cancel_at_period_end", False),
        "is_active": user_doc.get("subscription_status") in ["trialing", "active"]
    }

@api_router.post("/subscription/cancel")
async def cancel_subscription(http_request: Request):
    """Cancel subscription at end of current period"""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = user["user_id"]
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription_id = user_doc.get("subscription_id")
    if not subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    try:
        import stripe
        stripe.api_key = STRIPE_API_KEY
        
        # Cancel at end of period (not immediately)
        sub = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True
        )
        
        # Get current_period_end from subscription items (new Stripe API structure)
        current_period_end = None
        items_data = sub.get('items', {})
        if items_data and items_data.get('data'):
            item_period_end = items_data['data'][0].get('current_period_end')
            if item_period_end:
                current_period_end = datetime.fromtimestamp(item_period_end, tz=timezone.utc)
        
        # Fallback to trial_end if in trial period
        if not current_period_end and sub.trial_end:
            current_period_end = datetime.fromtimestamp(sub.trial_end, tz=timezone.utc)
        
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "cancel_at_period_end": True,
                "subscription_ends_at": current_period_end.isoformat() if current_period_end else None
            }}
        )
        
        return {
            "message": "Subscription will be cancelled at end of period",
            "ends_at": current_period_end.isoformat() if current_period_end else None
        }
    except Exception as e:
        logger.error(f"Cancel subscription error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to cancel subscription")

@api_router.post("/subscription/reactivate")
async def reactivate_subscription(http_request: Request):
    """Reactivate a cancelled subscription"""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = user["user_id"]
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription_id = user_doc.get("subscription_id")
    if not subscription_id:
        raise HTTPException(status_code=400, detail="No subscription found")
    
    try:
        import stripe
        stripe.api_key = STRIPE_API_KEY
        
        # Reactivate by removing cancel_at_period_end
        sub = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=False
        )
        
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "cancel_at_period_end": False,
                "subscription_status": sub.status
            }}
        )
        
        return {"message": "Subscription reactivated", "status": sub.status}
    except Exception as e:
        logger.error(f"Reactivate subscription error: {e}")
        raise HTTPException(status_code=500, detail="Failed to reactivate subscription")

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.post("/auth/change-password")
async def change_password(request: ChangePasswordRequest, http_request: Request):
    """Change password for authenticated user"""
    user = await require_active_subscription(http_request)
    
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit contenir au moins 6 caractères")
    
    # Get user from database
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Verify current password
    if not verify_password(request.current_password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    
    # Hash new password and update
    new_hash = hash_password(request.new_password)
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"password_hash": new_hash}}
    )
    
    return {"message": "Mot de passe modifié avec succès"}

class ForgotPasswordRequest(BaseModel):
    email: str

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Send password reset email"""
    if not request.email:
        raise HTTPException(status_code=400, detail="Email requis")
    
    # Check if user exists
    user_doc = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    # Always return success to prevent email enumeration
    if not user_doc:
        logger.info(f"Password reset requested for non-existent email: {request.email}")
        return {"message": "Si cet email existe, vous recevrez un lien de réinitialisation"}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store reset token
    await db.password_resets.delete_many({"email": request.email})  # Remove old tokens
    await db.password_resets.insert_one({
        "email": request.email,
        "token": reset_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # In production, send email here
    # For now, log the reset link
    logger.info(f"Password reset token for {request.email}: {reset_token}")
    
    return {"message": "Si cet email existe, vous recevrez un lien de réinitialisation", "reset_token": reset_token}

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password using token"""
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    
    # Find and validate reset token
    reset_doc = await db.password_resets.find_one({"token": request.token}, {"_id": 0})
    
    if not reset_doc:
        raise HTTPException(status_code=400, detail="Lien de réinitialisation invalide ou expiré")
    
    # Check expiration
    expires_at = reset_doc.get("expires_at")
    if expires_at:
        # Make sure both are timezone-aware
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            await db.password_resets.delete_one({"token": request.token})
            raise HTTPException(status_code=400, detail="Lien de réinitialisation expiré")
    
    email = reset_doc.get("email")
    
    # Update password
    new_hash = hash_password(request.new_password)
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"password_hash": new_hash}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Utilisateur non trouvé")
    
    # Delete used token
    await db.password_resets.delete_one({"token": request.token})
    
    return {"message": "Mot de passe réinitialisé avec succès"}

@api_router.post("/auth/create-account")
async def create_account_after_payment(request: CreateAccountRequest, response: Response, http_request: Request):
    """Create account after successful Stripe payment - simplified and robust"""
    logger.debug(f"=== CREATE ACCOUNT CALLED ===")
    logger.debug(f"Email: {request.email}, Payment Token: {request.payment_token[:20]}...")
    
    try:
        # Validate input
        if not request.email:
            logger.debug("ERROR: Email missing")
            raise HTTPException(status_code=400, detail="Email requis")
        
        if not request.password or len(request.password) < 6:
            logger.debug("ERROR: Password too short")
            raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
        
        if not request.payment_token:
            logger.debug("ERROR: Payment token missing")
            raise HTTPException(status_code=400, detail="Session de paiement invalide")
        
        logger.debug("Step 1: Validation passed")
        
        # Check if user already exists with this email and has a password
        existing_user = await db.users.find_one({"email": request.email}, {"_id": 0})
        logger.debug(f"Step 2: Existing user check - found: {existing_user is not None}")
        if existing_user and existing_user.get("password_hash"):
            logger.debug("ERROR: Account already exists with password")
            raise HTTPException(status_code=400, detail="Ce compte existe déjà. Veuillez vous connecter.")
        
        # Verify payment with Stripe and get subscription info
        subscription_data = {}
        if request.payment_token.startswith("cs_"):
            try:
                import stripe
                stripe.api_key = STRIPE_API_KEY
                
                logger.info(f"Retrieving Stripe session: {request.payment_token}")
                session = stripe.checkout.Session.retrieve(request.payment_token)
                logger.info(f"Session retrieved - subscription: {session.subscription}, customer: {session.customer}, status: {session.status}")
                
                # For subscriptions, check the subscription status
                if session.subscription:
                    logger.info(f"Retrieving subscription: {session.subscription}")
                    sub = stripe.Subscription.retrieve(session.subscription)
                    logger.info(f"Subscription status: {sub.status}, trial_end: {sub.trial_end}")
                    
                    trial_end = datetime.fromtimestamp(sub.trial_end, tz=timezone.utc) if sub.trial_end else None
                    
                    # Get current_period_end from subscription items (new Stripe API structure)
                    current_period_end = None
                    items_data = sub.get('items', {})
                    if items_data and items_data.get('data'):
                        item_period_end = items_data['data'][0].get('current_period_end')
                        if item_period_end:
                            current_period_end = datetime.fromtimestamp(item_period_end, tz=timezone.utc)
                    
                    # Fallback to trial_end if in trial period
                    if not current_period_end and trial_end:
                        current_period_end = trial_end
                    
                    subscription_data = {
                        "subscription_id": session.subscription,
                        "stripe_customer_id": session.customer,
                        "subscription_status": sub.status,  # trialing, active, etc.
                        "trial_ends_at": trial_end.isoformat() if trial_end else None,
                        "subscription_ends_at": current_period_end.isoformat() if current_period_end else None,
                        "cancel_at_period_end": sub.cancel_at_period_end
                    }
                    logger.info(f"Subscription data prepared: {subscription_data}")
                else:
                    # One-time payment (legacy)
                    logger.info(f"No subscription, checking payment_status: {session.payment_status}")
                    if session.payment_status != "paid":
                        raise HTTPException(status_code=400, detail="Le paiement n'est pas complété. Veuillez réessayer.")
                    subscription_data = {"subscription_status": "active"}
                    
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Step 3 FAILED - Stripe verification error: {e}")
                logger.error(f"Session ID attempted: {request.payment_token}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                raise HTTPException(status_code=400, detail=f"Impossible de vérifier le paiement: {str(e)}")
        else:
            logger.error("ERROR: Payment token doesn't start with cs_")
            raise HTTPException(status_code=400, detail="Session de paiement invalide")
        
        logger.debug(f"Step 3: Stripe verification passed, subscription_data: {subscription_data}")
        
        # Create or update user
        if existing_user:
            logger.debug(f"Step 4: Updating existing user {existing_user['user_id']}")
            user_id = existing_user["user_id"]
            update_data = {
                "password_hash": hash_password(request.password),
                "stripe_session_id": request.payment_token,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                **subscription_data
            }
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": update_data}
            )
            logger.debug("Step 4: User updated successfully")
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            logger.debug(f"Step 4: Creating new user {user_id}")
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
            logger.debug("Step 4: User created successfully")
        
        # Store payment record
        logger.debug("Step 5: Storing payment record")
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
        logger.debug("Step 5: Payment record stored")
        
        # Create session
        logger.debug("Step 6: Creating session")
        session_token = f"sess_{uuid.uuid4().hex}"
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        user_session = UserSession(
            user_id=user_id,
            session_token=session_token,
            expires_at=expires_at
        )
        session_doc = user_session.model_dump()
        session_doc['expires_at'] = session_doc['expires_at'].isoformat()
        session_doc['created_at'] = session_doc['created_at'].isoformat()
        await db.user_sessions.insert_one(session_doc)
        logger.debug("Step 6: Session created successfully")
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60
        )
        
        logger.debug(f"Step 7: SUCCESS - Account created for {request.email}")
        return {
            "user_id": user_id,
            "email": request.email,
            "subscription_status": subscription_data.get("subscription_status", "active"),
            "token": session_token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GLOBAL ERROR in create_account: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Erreur serveur")

# Free Trial Registration (no payment required)
@api_router.post("/auth/register")
async def register_free_trial(request: RegisterRequest, response: Response):
    """Register for free 7-day trial without payment"""
    logger.info(f"Free trial registration attempt for: {request.email}")
    
    # Validate email format
    if not request.email or '@' not in request.email:
        raise HTTPException(status_code=400, detail="Email invalide")
    
    # Validate password
    if not request.password or len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    
    # Check if email already exists
    existing_user = await db.users.find_one({"email": request.email.lower().strip()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Un compte existant utilise déjà cette adresse email")
    
    # Calculate trial end date (7 days from now)
    trial_ends_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    # Create user with trialing status
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": request.email.lower().strip(),
        "name": request.full_name.strip(),
        "phone": request.phone.strip(),
        "auth_provider": "email",
        "password_hash": hash_password(request.password),
        "subscription_status": "trialing",
        "trial_ends_at": trial_ends_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    logger.info(f"Free trial account created for {request.email}, trial ends: {trial_ends_at}")
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    user_session = UserSession(
        user_id=user_id,
        session_token=session_token,
        expires_at=expires_at
    )
    session_doc = user_session.model_dump()
    session_doc['expires_at'] = session_doc['expires_at'].isoformat()
    session_doc['created_at'] = session_doc['created_at'].isoformat()
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
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
        "email": request.email.lower().strip(),
        "subscription_status": "trialing",
        "trial_ends_at": trial_ends_at.isoformat(),
        "token": session_token
    }

# Email/Password Login
@api_router.post("/auth/login")
async def login_with_password(request: LoginRequest, response: Response):
    """Login with email and password"""
    logger.info(f"Login attempt for email: {request.email}")
    
    user = await db.users.find_one({"email": request.email.lower().strip()}, {"_id": 0})
    
    if not user:
        logger.warning(f"Login failed: User not found for {request.email}")
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    if not user.get("password_hash"):
        logger.warning(f"Login failed: No password hash for {request.email}")
        raise HTTPException(status_code=401, detail="Veuillez réinitialiser votre mot de passe")
    
    if not verify_password(request.password, user["password_hash"]):
        logger.warning(f"Login failed: Invalid password for {request.email}")
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    # Allow login for all users (trialing, active, expired, canceled)
    # Access restrictions are handled in the frontend based on subscription status
    logger.info(f"Login successful for {request.email}")
    
    # Check if trial has expired and update status
    subscription_status = user.get("subscription_status", "none")
    trial_ends_at = user.get("trial_ends_at")
    
    if subscription_status == "trialing" and trial_ends_at:
        trial_end_date = datetime.fromisoformat(trial_ends_at.replace('Z', '+00:00'))
        if trial_end_date.tzinfo is None:
            trial_end_date = trial_end_date.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > trial_end_date:
            subscription_status = "expired"
            # Update in database
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {"subscription_status": "expired"}}
            )
    
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
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    # Return token in response body as well for localStorage fallback
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "subscription_status": subscription_status,
        "trial_ends_at": user.get("trial_ends_at"),
        "token": session_token
    }

# Recover account - for users who paid but didn't complete account creation
@api_router.post("/auth/recover")
async def recover_account(request: RecoverAccountRequest, response: Response, http_request: Request):
    """Recover account - creates account if email has a valid paid Stripe session"""
    
    if not request.password or len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    
    # Check if user already exists with password
    existing_user = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    if existing_user and existing_user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Ce compte existe déjà. Veuillez vous connecter.")
    
    # Check if there's a payment_success record for this email
    payment_success = await db.payment_success.find_one(
        {"email": request.email},
        {"_id": 0}
    )
    
    if not payment_success:
        # No payment record found - tell user to use their Stripe session ID
        raise HTTPException(
            status_code=404, 
            detail="Aucun paiement trouvé pour cet email. Si vous avez payé, utilisez le lien de confirmation Stripe ou contactez le support."
        )
    
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
        user_doc = {
            "user_id": user_id,
            "email": request.email,
            "auth_provider": "email",
            "subscription_status": "active",
            "password_hash": hash_password(request.password),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
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
        "message": "Account recovered successfully",
        "token": session_token
    }

# ==================== TASK ENDPOINTS ====================

@api_router.get("/tasks")
async def list_tasks(request: Request, include_completed: bool = True):
    """List all tasks for authenticated user - includes completed tasks from last 2 weeks"""
    user = await require_active_subscription(request)
    
    # NOTE: Auto-generation of follow-up tasks disabled - user requested manual task creation only
    # await generate_follow_up_tasks_for_user(user.user_id)
    
    two_weeks_ago = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    
    # Get non-completed tasks + completed tasks from last 2 weeks
    tasks = await db.tasks.find(
        {
            "user_id": user.user_id,
            "$or": [
                {"completed": False},
                {"completed": True, "completed_at": {"$gte": two_weeks_ago}}
            ]
        },
        {"_id": 0}
    ).sort("due_date", -1).to_list(1000)
    
    # Batch fetch prospects to avoid N+1 queries
    prospect_ids = list(set(t.get("prospect_id") for t in tasks if t.get("prospect_id")))
    prospects_map = {}
    if prospect_ids:
        prospects = await db.prospects.find(
            {"prospect_id": {"$in": prospect_ids}},
            {"_id": 0, "prospect_id": 1, "full_name": 1, "phone": 1, "email": 1, "status": 1}
        ).to_list(len(prospect_ids))
        prospects_map = {p["prospect_id"]: p for p in prospects}
    
    # Enrich tasks with prospect info
    for task in tasks:
        if task.get("prospect_id"):
            task["prospect"] = prospects_map.get(task["prospect_id"])
    
    return {"tasks": tasks}

@api_router.get("/tasks/today")
async def list_today_tasks(request: Request):
    """List tasks due today or overdue (not completed)"""
    user = await require_active_subscription(request)
    
    # NOTE: Auto-generation of follow-up tasks disabled - user requested manual task creation only
    # await generate_follow_up_tasks_for_user(user.user_id)
    
    now = datetime.now(timezone.utc)
    end_of_today = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get overdue tasks (before today, not completed) and today's tasks
    tasks = await db.tasks.find(
        {
            "user_id": user.user_id,
            "completed": False,
            "due_date": {"$lte": end_of_today.isoformat()}
        },
        {"_id": 0}
    ).sort("due_date", 1).to_list(1000)
    
    # Batch fetch prospects to avoid N+1 queries
    prospect_ids = list(set(t.get("prospect_id") for t in tasks if t.get("prospect_id")))
    prospects_map = {}
    if prospect_ids:
        prospects = await db.prospects.find(
            {"prospect_id": {"$in": prospect_ids}},
            {"_id": 0, "prospect_id": 1, "full_name": 1, "phone": 1, "email": 1, "status": 1}
        ).to_list(len(prospect_ids))
        prospects_map = {p["prospect_id"]: p for p in prospects}
    
    # Mark tasks as overdue or today and enrich with prospect info
    for task in tasks:
        task_date = datetime.fromisoformat(task["due_date"].replace('Z', '+00:00'))
        if task_date.tzinfo is None:
            task_date = task_date.replace(tzinfo=timezone.utc)
        task["is_overdue"] = task_date < start_of_today
        task["is_today"] = start_of_today <= task_date <= end_of_today
        
        # Enrich with prospect info from batch
        if task.get("prospect_id"):
            task["prospect"] = prospects_map.get(task["prospect_id"])
    
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

# ==================== AI TASK SUGGESTIONS ====================

@api_router.get("/tasks/ai-suggestions")
async def get_ai_task_suggestions(request: Request):
    """Get AI-powered task suggestions based on inactive prospects"""
    user = await require_active_subscription(request)
    
    # Get prospects with no recent activity (no task in last 7 days)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    
    # Get all active prospects
    prospects = await db.prospects.find(
        {
            "user_id": user.user_id,
            "status": {"$nin": ["closed", "lost"]}
        },
        {"_id": 0, "prospect_id": 1, "full_name": 1, "phone": 1, "email": 1, "status": 1, "source": 1, "notes": 1, "last_activity_date": 1, "created_at": 1}
    ).to_list(100)
    
    if not prospects:
        return {"suggestions": [], "message": "Aucun prospect à analyser"}
    
    # Find inactive prospects (no activity in last 7 days)
    inactive_prospects = []
    for p in prospects:
        last_activity = p.get("last_activity_date") or p.get("created_at")
        if last_activity:
            if isinstance(last_activity, str):
                last_activity_date = datetime.fromisoformat(last_activity.replace('Z', '+00:00'))
            else:
                last_activity_date = last_activity
            if last_activity_date.tzinfo is None:
                last_activity_date = last_activity_date.replace(tzinfo=timezone.utc)
            
            days_inactive = (datetime.now(timezone.utc) - last_activity_date).days
            if days_inactive >= 3:  # At least 3 days inactive
                inactive_prospects.append({
                    **p,
                    "days_inactive": days_inactive
                })
    
    if not inactive_prospects:
        return {"suggestions": [], "message": "Tous vos prospects sont actifs !"}
    
    # Limit to 5 most inactive prospects
    inactive_prospects.sort(key=lambda x: x["days_inactive"], reverse=True)
    inactive_prospects = inactive_prospects[:5]
    
    # Generate AI suggestions
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"task_suggestions_{user.user_id}_{datetime.now().timestamp()}",
            system_message="""Tu es un assistant commercial expert en immobilier. 
Tu analyses les prospects inactifs et suggères des actions de suivi pertinentes.
Réponds UNIQUEMENT en JSON valide, sans markdown, sans ```json```, juste le JSON pur.
Format: {"suggestions": [{"prospect_id": "...", "prospect_name": "...", "task_title": "...", "task_type": "call|email|meeting|follow_up", "reason": "..."}]}
task_type doit être exactement un de: call, email, meeting, follow_up
Limite-toi à 1 suggestion par prospect."""
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        # Build context
        prospects_context = "\n".join([
            f"- {p['full_name']} (ID: {p['prospect_id']}): {p['days_inactive']} jours sans contact, statut: {p.get('status', 'nouveau')}, source: {p.get('source', 'inconnu')}, notes: {p.get('notes', 'aucune')[:100] if p.get('notes') else 'aucune'}"
            for p in inactive_prospects
        ])
        
        user_message = UserMessage(
            text=f"""Voici les prospects inactifs à relancer:

{prospects_context}

Suggère une action de suivi appropriée pour chaque prospect. Sois concis et actionnable."""
        )
        
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        import json
        import re
        
        # Clean response - remove markdown code blocks
        response_clean = response.strip()
        
        # Remove ```json ... ``` or ``` ... ```
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_clean)
        if json_match:
            response_clean = json_match.group(1).strip()
        
        # Also try to find JSON object directly
        if not response_clean.startswith('{'):
            json_obj_match = re.search(r'\{[\s\S]*\}', response_clean)
            if json_obj_match:
                response_clean = json_obj_match.group(0)
        
        suggestions_data = json.loads(response_clean)
        
        return {
            "suggestions": suggestions_data.get("suggestions", []),
            "inactive_count": len(inactive_prospects)
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"AI response parsing error: {e}, response: {response[:200] if response else 'None'}")
        # Fallback: generate simple suggestions without AI
        fallback_suggestions = []
        for p in inactive_prospects[:3]:
            fallback_suggestions.append({
                "prospect_id": p["prospect_id"],
                "prospect_name": p["full_name"],
                "task_title": f"Relancer {p['full_name']}",
                "task_type": "call",
                "reason": f"Aucun contact depuis {p['days_inactive']} jours"
            })
        return {"suggestions": fallback_suggestions, "inactive_count": len(inactive_prospects)}
    except Exception as e:
        logger.error(f"AI suggestion error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        # Fallback suggestions
        fallback_suggestions = []
        for p in inactive_prospects[:3]:
            fallback_suggestions.append({
                "prospect_id": p["prospect_id"],
                "prospect_name": p["full_name"],
                "task_title": f"Relancer {p['full_name']}",
                "task_type": "call",
                "reason": f"Aucun contact depuis {p['days_inactive']} jours"
            })
        return {"suggestions": fallback_suggestions, "inactive_count": len(inactive_prospects)}

@api_router.post("/tasks/ai-suggestions/accept")
async def accept_ai_suggestion(request: Request):
    """Create a task from an AI suggestion"""
    user = await require_active_subscription(request)
    
    body = await request.json()
    prospect_id = body.get("prospect_id")
    task_title = body.get("task_title")
    task_type = body.get("task_type", "follow_up")
    
    if not prospect_id or not task_title:
        raise HTTPException(status_code=400, detail="prospect_id and task_title required")
    
    # Verify prospect belongs to user
    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Create task for tomorrow
    due_date = datetime.now(timezone.utc) + timedelta(days=1)
    due_date = due_date.replace(hour=10, minute=0, second=0, microsecond=0)
    
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    task_doc = {
        "task_id": task_id,
        "user_id": user.user_id,
        "prospect_id": prospect_id,
        "title": task_title,
        "task_type": task_type,
        "due_date": due_date.isoformat(),
        "completed": False,
        "auto_generated": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tasks.insert_one(task_doc)
    
    # Update prospect next task
    await update_prospect_next_task(prospect_id, user.user_id)
    
    return {"task_id": task_id, "message": "Tâche créée avec succès"}

# ==================== PROSPECT ENDPOINTS ====================

@api_router.get("/prospects")
async def list_prospects(request: Request):
    """List all active prospects for authenticated user (excludes closed/lost)"""
    user = await require_active_subscription(request)
    
    # Exclude prospects with status "closed" (won) or "lost"
    prospects = await db.prospects.find(
        {
            "user_id": user.user_id,
            "status": {"$nin": ["closed", "lost"]}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return {"prospects": prospects}

@api_router.post("/prospects")
async def create_prospect(request: Request, prospect_data: CreateProspectRequest):
    """Create a new prospect and auto-create follow-up task"""
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
    
    # Auto-create follow-up task for the new prospect
    follow_up_date = now + timedelta(days=1)  # Follow up tomorrow
    task = Task(
        user_id=user.user_id,
        prospect_id=prospect.prospect_id,
        title=f"Suivi {prospect_data.full_name}",
        task_type="follow_up",
        due_date=follow_up_date,
        auto_generated=True
    )
    task_doc = task.model_dump()
    task_doc['created_at'] = task_doc['created_at'].isoformat()
    task_doc['due_date'] = task_doc['due_date'].isoformat()
    await db.tasks.insert_one(task_doc)
    
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


# Generate AI SMS message for a prospect
@api_router.post("/prospects/{prospect_id}/generate-message")
async def generate_ai_message(request: Request, prospect_id: str):
    """Generate an AI-powered SMS message for a prospect"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    user = await require_active_subscription(request)
    
    # Get prospect details
    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Get request body for context
    try:
        body = await request.json()
        context = body.get("context", "follow_up")
    except:
        context = "follow_up"
    
    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Get user name for signature
        user_data = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "name": 1})
        agent_name = user_data.get("name", "Votre agent") if user_data else "Votre agent"
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"sms_gen_{user.user_id}_{datetime.now().timestamp()}",
            system_message=f"""Agent immobilier. SMS court (<160 car), pro, signé: {agent_name}. Texte seul."""
        ).with_model("openai", "gpt-4.1-nano")
        
        # Build context
        prospect_info = f"""
Prospect: {prospect.get('full_name', 'Client')}
Statut: {prospect.get('status', 'nouveau')}
Source: {prospect.get('source', 'inconnue')}
Notes: {prospect.get('notes', 'Aucune note')[:200] if prospect.get('notes') else 'Aucune note'}
Contexte demandé: {context}
"""
        
        user_message = UserMessage(
            text=f"Génère un SMS de {context} pour ce prospect:\n{prospect_info}"
        )
        
        response = await chat.send_message(user_message)
        message = response.strip()
        
        # Remove quotes if present
        if message.startswith('"') and message.endswith('"'):
            message = message[1:-1]
        
        return {"message": message}
        
    except Exception as e:
        logger.error(f"AI message generation error: {e}")
        # Fallback message
        fallback = f"Bonjour {prospect.get('full_name', '')}, je me permets de vous recontacter concernant votre projet immobilier. Êtes-vous disponible pour en discuter ? {agent_name}"
        return {"message": fallback}


# Send SMS to prospect
@api_router.post("/prospects/{prospect_id}/send-sms")
async def send_sms_to_prospect(request: Request, prospect_id: str):
    """Send SMS to a prospect via Brevo"""
    user = await require_active_subscription(request)
    
    # Get prospect
    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    if not prospect.get("phone"):
        raise HTTPException(status_code=400, detail="Prospect has no phone number")
    
    # Get message from body
    try:
        body = await request.json()
        message = body.get("message", "")
    except:
        raise HTTPException(status_code=400, detail="Message required")
    
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # Get user name for sender
    user_data = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "name": 1, "phone": 1})
    sender_name = user_data.get("name", "KOLO")[:11] if user_data else "KOLO"
    
    # Send via Brevo
    brevo_api_key = os.environ.get("BREVO_API_KEY")
    if not brevo_api_key:
        raise HTTPException(status_code=500, detail="SMS service not configured")
    
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.brevo.com/v3/transactionalSMS/sms",
                headers={
                    "api-key": brevo_api_key,
                    "Content-Type": "application/json"
                },
                json={
                    "sender": sender_name,
                    "recipient": prospect["phone"],
                    "content": message,
                    "type": "transactional"
                }
            )
            
            if response.status_code in [200, 201]:
                # Save to SMS history
                sms_record = {
                    "direction": "outbound",
                    "message": message,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": "sent"
                }
                await db.prospects.update_one(
                    {"prospect_id": prospect_id},
                    {"$push": {"sms_history": sms_record}}
                )
                return {"status": "sent", "message_id": response.json().get("messageId")}
            else:
                logger.error(f"Brevo SMS error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail="Failed to send SMS")
    except httpx.RequestError as e:
        logger.error(f"SMS request error: {e}")
        raise HTTPException(status_code=500, detail="SMS service unavailable")


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
    vapid_public_key_file = os.environ.get('VAPID_PUBLIC_KEY_FILE', 'vapid_public.pem')
    
    # Resolve relative path from ROOT_DIR
    if not os.path.isabs(vapid_public_key_file):
        vapid_public_key_file = ROOT_DIR / vapid_public_key_file
    
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

# CORS configuration - simplified since we don't use cookies anymore
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    """Initialize app on startup"""
    logger.info("Starting KOLO API...")
    logger.info(f"Database: {os.environ.get('DB_NAME', 'unknown')}")
    
    # Start scheduler in a background thread
    scheduler_thread = threading.Thread(target=start_background_scheduler, daemon=True)
    scheduler_thread.start()
    logger.info("Background notification scheduler started")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
