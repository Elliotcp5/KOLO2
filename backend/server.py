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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
    subscription_status: str = "none"  # active, trialing, past_due, canceled, incomplete, none
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

class Prospect(BaseModel):
    model_config = ConfigDict(extra="ignore")
    prospect_id: str = Field(default_factory=lambda: f"prospect_{uuid.uuid4().hex[:12]}")
    user_id: str
    full_name: str
    phone: str
    email: str
    source: str = "manual"  # manual, whatsapp, email
    status: str = "new"  # new, in_progress, closed, lost
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str = Field(default_factory=lambda: f"txn_{uuid.uuid4().hex[:12]}")
    session_id: str
    user_email: Optional[str] = None
    amount: float
    currency: str
    payment_status: str = "pending"  # pending, paid, failed, expired
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

class CheckoutStatusRequest(BaseModel):
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

# ==================== HELPER FUNCTIONS ====================

def get_currency_for_country(country_code: str) -> str:
    """Determine currency based on country"""
    if country_code == 'GB':
        return 'GBP'
    elif country_code in EU_COUNTRIES:
        return 'EUR'
    else:
        return 'USD'

def get_pricing_for_country(country_code: str) -> dict:
    """Get pricing info for a country"""
    currency = get_currency_for_country(country_code)
    return PRICING[currency]

async def get_user_from_session(request: Request) -> Optional[User]:
    """Get user from session token in cookie or Authorization header"""
    session_token = request.cookies.get('session_token')
    
    if not session_token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            session_token = auth_header[7:]
    
    if not session_token:
        return None
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        return None
    
    # Check expiry
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        return None
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        return None
    
    return User(**user_doc)

async def require_auth(request: Request) -> User:
    """Require authenticated user"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_active_subscription(request: Request) -> User:
    """Require authenticated user with active subscription"""
    user = await require_auth(request)
    if user.subscription_status not in ['active', 'trialing']:
        raise HTTPException(status_code=403, detail="Active subscription required")
    return user

# ==================== GEO ENDPOINT ====================

@api_router.get("/geo", response_model=GeoResponse)
async def get_geo_info(request: Request, locale: Optional[str] = None, country: Optional[str] = None):
    """Detect country and return pricing info"""
    # Try to get country from header (set by Cloudflare/proxy) or fallback
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
    """Process Emergent OAuth session_id and create local session"""
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
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info
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
        # Create new user
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
    
    # Create session
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
        "email": email,
        "name": name,
        "picture": picture,
        "subscription_status": subscription_status
    }

@api_router.get("/auth/me")
async def get_current_user(request: Request):
    """Get current authenticated user"""
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
    """Logout user"""
    session_token = request.cookies.get('session_token')
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ==================== PAYMENT ENDPOINTS ====================

@api_router.post("/payments/create-checkout", response_model=CreateCheckoutResponse)
async def create_checkout(request: CreateCheckoutRequest, http_request: Request):
    """Create Stripe checkout session with regional pricing"""
    # Determine pricing based on country
    country = request.country or http_request.headers.get('CF-IPCountry', 'US')
    pricing = get_pricing_for_country(country)
    
    # Build URLs
    success_url = f"{request.origin_url}/create-account?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/subscribe"
    
    # Initialize Stripe
    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session
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
    
    # Record transaction
    transaction = PaymentTransaction(
        session_id=session.session_id,
        user_email=request.email,
        amount=pricing['amount'],
        currency=pricing['currency'],
        payment_status="pending",
        metadata={
            "country": country,
            "locale": request.locale
        }
    )
    txn_doc = transaction.model_dump()
    txn_doc['created_at'] = txn_doc['created_at'].isoformat()
    txn_doc['updated_at'] = txn_doc['updated_at'].isoformat()
    await db.payment_transactions.insert_one(txn_doc)
    
    return CreateCheckoutResponse(url=session.url, session_id=session.session_id)

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, http_request: Request):
    """Get payment status and create success token if paid"""
    # Initialize Stripe
    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.error(f"Stripe status error: {e}")
        raise HTTPException(status_code=400, detail="Failed to get payment status")
    
    # Update transaction in DB
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": status.payment_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # If paid, create success token
    payment_token = None
    if status.payment_status == "paid":
        # Check if token already exists
        existing_token = await db.payment_success.find_one(
            {"session_id": session_id},
            {"_id": 0}
        )
        
        if existing_token:
            payment_token = existing_token["token"]
        else:
            # Create new token
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
    """Handle Stripe webhooks"""
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Update transaction
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
    """Validate payment success token"""
    token_doc = await db.payment_success.find_one(
        {"token": token, "used": False},
        {"_id": 0}
    )
    
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or used token")
    
    # Check expiry
    expires_at = token_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    
    return {"valid": True, "email": token_doc.get("email")}

@api_router.post("/auth/create-account")
async def create_account_after_payment(request: CreateAccountRequest, response: Response):
    """Create account after successful payment (gated)"""
    # Validate payment token
    token_doc = await db.payment_success.find_one(
        {"token": request.payment_token, "used": False},
        {"_id": 0}
    )
    
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or used payment token")
    
    # Check expiry
    expires_at = token_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    
    email = request.email or token_doc.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update subscription status
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "subscription_status": "active",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # Create new user with active subscription
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = User(
            user_id=user_id,
            email=email,
            auth_provider="email",
            subscription_status="active"
        )
        user_doc = new_user.model_dump()
        user_doc['created_at'] = user_doc['created_at'].isoformat()
        user_doc['updated_at'] = user_doc['updated_at'].isoformat()
        await db.users.insert_one(user_doc)
    
    # Mark token as used
    await db.payment_success.update_one(
        {"token": request.payment_token},
        {"$set": {"used": True}}
    )
    
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
        "email": email,
        "subscription_status": "active"
    }

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
    
    prospect = Prospect(
        user_id=user.user_id,
        full_name=prospect_data.full_name,
        phone=prospect_data.phone,
        email=prospect_data.email,
        source=prospect_data.source,
        status=prospect_data.status,
        notes=prospect_data.notes
    )
    
    doc = prospect.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.prospects.insert_one(doc)
    
    return {"prospect_id": prospect.prospect_id, "message": "Prospect created"}

@api_router.get("/prospects/{prospect_id}")
async def get_prospect(request: Request, prospect_id: str):
    """Get a single prospect"""
    user = await require_active_subscription(request)
    
    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    return prospect

@api_router.put("/prospects/{prospect_id}")
async def update_prospect(request: Request, prospect_id: str, update_data: UpdateProspectRequest):
    """Update a prospect"""
    user = await require_active_subscription(request)
    
    update_fields = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_fields['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.prospects.update_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    return {"message": "Prospect updated"}

@api_router.delete("/prospects/{prospect_id}")
async def delete_prospect(request: Request, prospect_id: str):
    """Delete a prospect"""
    user = await require_active_subscription(request)
    
    result = await db.prospects.delete_one(
        {"prospect_id": prospect_id, "user_id": user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    return {"message": "Prospect deleted"}

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
