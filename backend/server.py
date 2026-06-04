from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, validator
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import hashlib
import re
from html import escape

# Email service
from email_service import (
    send_welcome_email, 
    send_trial_reminder_email, 
    send_trial_expired_email,
    send_password_reset_email,
    send_subscription_confirmation_email
)

# ==================== SECURITY: Rate Limiting ====================
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

ROOT_DIR = Path(__file__).parent

# Load .env without override - allows K8s env vars to take precedence in production
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ==================== SECURITY: Input Sanitization Helpers ====================
def sanitize_string(value: str, max_length: int = 1000) -> str:
    """Sanitize string input to prevent XSS"""
    if not value:
        return value
    # Escape HTML characters
    sanitized = escape(value.strip())
    # Limit length
    return sanitized[:max_length]

def validate_email_format(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_phone_format(phone: str) -> bool:
    """Validate phone number format (allows international formats)"""
    # Remove spaces, dashes, parentheses
    cleaned = re.sub(r'[\s\-\(\)]', '', phone)
    # Should be numeric with optional + prefix, 6-20 digits
    pattern = r'^\+?[0-9]{6,20}$'
    return bool(re.match(pattern, cleaned))

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

# Add rate limiter to app state and error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== SUPER ADMIN ====================
# Hard-coded allowlist of emails granted the KOLO Super Admin role.
# These users can access /kolo-admin and all /api/admin/* endpoints with
# session authentication (no shared key required).
KOLO_SUPER_ADMIN_EMAILS = {
    "elliot.cohenpressard@trykolo.io",
}

def is_super_admin_email(email: Optional[str]) -> bool:
    """True if the given email is in the super admin allowlist."""
    if not email:
        return False
    return email.lower().strip() in KOLO_SUPER_ADMIN_EMAILS

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
    phone: Optional[str] = None
    picture: Optional[str] = None
    auth_provider: str = "email"
    locale: Optional[str] = None
    country: Optional[str] = None
    currency: str = "EUR"  # EUR, USD, GBP
    stripe_customer_id: Optional[str] = None
    subscription_status: str = "none"  # none, trialing, active, canceled, past_due
    subscription_id: Optional[str] = None
    trial_ends_at: Optional[datetime] = None
    subscription_ends_at: Optional[datetime] = None
    # Plan system (FREE / PRO / PRO+)
    plan: str = "free"  # free, pro, pro_plus
    trial_plan: Optional[str] = None  # pro, pro_plus (plan being trialed)
    trial_start_date: Optional[datetime] = None
    billing_period: str = "monthly"  # monthly, annual
    # Feature usage tracking
    daily_suggestions_used: int = 0
    daily_suggestions_reset_date: Optional[datetime] = None
    # ROI Dashboard (PRO+)
    monthly_revenue: float = 0.0
    monthly_revenue_month: Optional[str] = None  # Format: "2026-03"
    # Theme & Onboarding
    theme_preference: str = "light"  # light, dark
    didacticiel_completed: bool = False
    tooltips_seen: List[str] = Field(default_factory=list)  # List of tooltip IDs seen
    # Streak tracking
    streak_current: int = 0
    streak_last_activity_date: Optional[datetime] = None
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
    source: str = "manual"  # seloger, leboncoin, reseau, recommandation, autre, manual
    status: str = "nouveau"  # nouveau, contacte, qualifie, offre, signe, closed_won, closed_lost, archived
    notes: Optional[str] = None
    last_activity_date: Optional[datetime] = None
    last_contact_date: Optional[datetime] = None
    next_task_id: Optional[str] = None
    next_task_date: Optional[datetime] = None
    next_task_title: Optional[str] = None
    # New fields from spec
    project_type: Optional[str] = None  # buyer, seller, renter
    budget_min: Optional[int] = None  # in thousands €
    budget_max: Optional[int] = None  # in thousands €
    budget_undefined: bool = False
    delay: Optional[str] = None  # urgent, 3_6_months, 6_plus_months
    # PRO+ features
    heat_score: Optional[int] = None  # 0-100, calculated
    commission_amount: Optional[int] = None  # in euros, when closed_won
    closed_date: Optional[datetime] = None
    external_activity_signal: bool = False
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

class Interaction(BaseModel):
    """Interaction history for prospects (PRO and PRO+ feature)"""
    model_config = ConfigDict(extra="ignore")
    interaction_id: str = Field(default_factory=lambda: f"int_{uuid.uuid4().hex[:12]}")
    prospect_id: str
    user_id: str
    interaction_type: str  # sms, call, visit, note, suggestion
    content: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== PLAN FEATURE FLAGS ====================

PLAN_FEATURES = {
    "free": {
        "max_prospects": 30,
        "daily_ai_suggestions": 1,
        "sms_one_click": False,
        "heat_score": False,
        "roi_dashboard": False,
        "interaction_history": False,
        "weekly_report": False,
        "budget_slider": False,
        "contextual_notes": False,
        "behavioral_alerts": False,
        "ultra_contextual_suggestions": False,
        "dedicated_support": False,
        "priority_access": False,
    },
    "pro": {
        "max_prospects": None,  # Unlimited
        "daily_ai_suggestions": None,  # Unlimited
        "sms_one_click": True,
        "heat_score": False,
        "roi_dashboard": False,
        "interaction_history": True,
        "weekly_report": False,
        "budget_slider": True,
        "contextual_notes": True,
        "behavioral_alerts": False,
        "ultra_contextual_suggestions": False,
        "dedicated_support": False,
        "priority_access": False,
    },
    "pro_plus": {
        "max_prospects": None,  # Unlimited
        "daily_ai_suggestions": None,  # Unlimited
        "sms_one_click": True,
        "heat_score": True,
        "roi_dashboard": True,
        "interaction_history": True,
        "weekly_report": True,
        "budget_slider": True,
        "contextual_notes": True,
        "behavioral_alerts": True,
        "ultra_contextual_suggestions": True,
        "dedicated_support": True,
        "priority_access": True,
    }
}

# Pricing configuration
PLAN_PRICING = {
    "pro": {
        "EUR": {"monthly": 999, "annual": 9990, "monthly_display": "9,99€", "annual_display": "99,90€", "annual_monthly": "8,33€"},
        "USD": {"monthly": 1099, "annual": 10990, "monthly_display": "$10.99", "annual_display": "$109.90", "annual_monthly": "$9.16"},
        "GBP": {"monthly": 899, "annual": 8990, "monthly_display": "£8.99", "annual_display": "£89.90", "annual_monthly": "£7.49"},
    },
    "pro_plus": {
        "EUR": {"monthly": 2499, "annual": 24990, "monthly_display": "24,99€", "annual_display": "249,90€", "annual_monthly": "20,83€"},
        "USD": {"monthly": 2799, "annual": 27990, "monthly_display": "$27.99", "annual_display": "$279.90", "annual_monthly": "$23.33"},
        "GBP": {"monthly": 2199, "annual": 21990, "monthly_display": "£21.99", "annual_display": "£219.90", "annual_monthly": "£18.33"},
    }
}

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
    email: Optional[EmailStr] = None
    source: str = "manual"
    status: str = "nouveau"
    notes: Optional[str] = None
    # New fields from spec
    project_type: Optional[str] = None  # buyer, seller, renter
    budget_min: Optional[int] = None
    budget_max: Optional[int] = None
    budget_undefined: bool = False
    delay: Optional[str] = None  # urgent, 3_6_months, 6_plus_months

class UpdateProspectRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    source: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    project_type: Optional[str] = None
    budget_min: Optional[int] = None
    budget_max: Optional[int] = None
    budget_undefined: Optional[bool] = None
    delay: Optional[str] = None
    commission_amount: Optional[int] = None  # For marking as closed_won

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
    plan: Optional[str] = None  # Optional: 'pro' or 'pro_plus' for trial

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
    
    # Super admin and lifetime access users bypass all subscription checks
    if is_super_admin_email(user.email):
        return user
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    if user_doc.get("lifetime_access") or user_doc.get("is_super_admin"):
        return user
    
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


# ============================================================================
# Account deletion (Apple App Store Guideline 5.1.1(v) compliance)
# User must be able to delete their account from within the app itself.
# ============================================================================
@api_router.delete("/auth/me")
async def delete_my_account(request: Request):
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = user.user_id
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})

    # 1. Cancel Stripe subscription if any (best-effort, don't block deletion)
    try:
        import stripe
        stripe_customer_id = user_doc.get("stripe_customer_id") if user_doc else None
        if stripe_customer_id:
            try:
                subs = stripe.Subscription.list(customer=stripe_customer_id, status="active", limit=10)
                for sub in subs.data:
                    try:
                        stripe.Subscription.delete(sub.id)
                    except Exception as e:
                        logger.warning(f"Could not cancel subscription {sub.id}: {e}")
            except Exception as e:
                logger.warning(f"Could not list subscriptions for {stripe_customer_id}: {e}")
    except Exception as e:
        logger.warning(f"Stripe cleanup error during account deletion for {user_id}: {e}")

    # 2. Delete all user-owned data (prospects, tasks, interactions, sessions, etc.)
    collections_with_user_id = [
        "prospects", "tasks", "interactions", "ai_suggestions", "ai_usage",
        "sms_logs", "notifications", "push_subscriptions", "login_attempts",
        "payment_success", "trial_events",
    ]
    for coll_name in collections_with_user_id:
        try:
            await db[coll_name].delete_many({"user_id": user_id})
        except Exception as e:
            logger.warning(f"Could not clear {coll_name} for user {user_id}: {e}")

    # 3. Delete sessions
    try:
        await db.sessions.delete_many({"user_id": user_id})
    except Exception as e:
        logger.warning(f"Could not clear sessions for user {user_id}: {e}")

    # 4. Finally remove the user document itself
    await db.users.delete_one({"user_id": user_id})

    logger.info(f"Account deletion completed for user_id={user_id}")

    return {
        "success": True,
        "message": "Account and all associated data have been permanently deleted.",
    }



@api_router.get("/auth/me")
async def get_current_user(request: Request):
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # Get full user doc for plan info
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})

    # Self-heal: if the local subscription state is not active/trialing,
    # try to recover it from Stripe. We throttle to once every 30s per user
    # to avoid hammering the Stripe API on rapid page loads.
    if user_doc and user_doc.get("subscription_status") not in ("active", "trialing"):
        last_check = user_doc.get("stripe_last_check_at")
        should_check = True
        if last_check:
            try:
                last_dt = datetime.fromisoformat(last_check.replace('Z', '+00:00'))
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                should_check = (datetime.now(timezone.utc) - last_dt).total_seconds() > 30
            except Exception:
                should_check = True
        if should_check:
            try:
                sync_result = await sync_subscription_from_stripe(user.user_id, user.email)
                # Always stamp last_check to throttle subsequent calls
                await db.users.update_one(
                    {"user_id": user.user_id},
                    {"$set": {"stripe_last_check_at": datetime.now(timezone.utc).isoformat()}},
                )
                if sync_result.get("synced") and sync_result.get("subscription_status") in ("active", "trialing"):
                    # Re-read the updated doc + user
                    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
                    user = User(**user_doc) if user_doc else user
                    logger.info(
                        f"/auth/me self-heal: recovered subscription for {user.email} "
                        f"(plan={sync_result.get('plan')}, status={sync_result.get('subscription_status')})"
                    )
            except Exception as e:
                logger.warning(f"/auth/me self-heal failed for {user.email}: {e}")

    effective_plan = get_user_effective_plan(user_doc) if user_doc else "free"
    features = PLAN_FEATURES.get(effective_plan, PLAN_FEATURES["free"])
    
    # Check limits
    prospect_limit = await check_prospect_limit(user.user_id, user_doc) if user_doc else {"can_add": True, "current": 0, "max": 30}
    ai_limit = await check_ai_suggestion_limit(user.user_id, user_doc) if user_doc else {"can_use": True, "used": 0, "max": 1}
    
    # Trial info
    trial_info = None
    if user_doc:
        trial_plan = user_doc.get("trial_plan")
        trial_end = user_doc.get("trial_ends_at")
        if trial_plan and trial_end:
            if isinstance(trial_end, str):
                trial_end = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
            trial_info = {
                "plan": trial_plan,
                "ends_at": trial_end.isoformat() if isinstance(trial_end, datetime) else trial_end,
                "days_remaining": max(0, (trial_end - datetime.now(timezone.utc)).days) if isinstance(trial_end, datetime) else 0
            }
    
    # Use the freshest subscription_status from the DB (post-self-heal)
    fresh_status = user_doc.get("subscription_status") if user_doc else user.subscription_status

    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "phone": getattr(user, 'phone', None),
        "picture": user.picture,
        "subscription_status": fresh_status,
        "theme_preference": getattr(user, 'theme_preference', 'light'),
        "didacticiel_completed": getattr(user, 'didacticiel_completed', False),
        "tooltips_seen": getattr(user, 'tooltips_seen', []),
        "streak_current": getattr(user, 'streak_current', 0),
        # Plan info
        "plan": user_doc.get("plan", "free") if user_doc else "free",
        "effective_plan": effective_plan,
        "features": features,
        "limits": {
            "prospects": prospect_limit,
            "ai_suggestions": ai_limit
        },
        "trial": trial_info,
        "currency": user_doc.get("currency", "EUR") if user_doc else "EUR",
        "is_super_admin": is_super_admin_email(user.email)
    }

@api_router.put("/auth/preferences")
async def update_user_preferences(request: Request):
    """Update user preferences (theme, etc.)"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    # Theme preference
    if "theme_preference" in body:
        if body["theme_preference"] in ["light", "dark"]:
            update_data["theme_preference"] = body["theme_preference"]
    
    # Didacticiel completed
    if "didacticiel_completed" in body:
        update_data["didacticiel_completed"] = bool(body["didacticiel_completed"])
    
    # Tooltips seen
    if "tooltip_seen" in body:
        # Add to list if not already there
        tooltips = getattr(user, 'tooltips_seen', []) or []
        if body["tooltip_seen"] not in tooltips:
            tooltips.append(body["tooltip_seen"])
        update_data["tooltips_seen"] = tooltips
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": update_data}
    )
    
    return {"message": "Preferences updated", "updated": update_data}

@api_router.get("/auth/profile")
async def get_user_profile(request: Request):
    """Get full user profile including phone and name"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name or "",
        "phone": getattr(user, 'phone', "") or "",
        "picture": user.picture,
        "subscription_status": user.subscription_status,
    }

@api_router.post("/auth/update-phone")
async def update_user_phone(request: Request):
    """Update user's phone number"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    phone = body.get("phone", "").strip()
    
    if not phone or len(phone) < 6:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    
    # Basic phone validation
    if not validate_phone_format(phone):
        raise HTTPException(status_code=400, detail="Invalid phone format")
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"phone": phone, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Phone updated", "phone": phone}

@api_router.post("/auth/update-name")
async def update_user_name(request: Request):
    """Update user's name"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    name = body.get("name", "").strip()
    
    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
    
    # Sanitize name
    import re
    name = re.sub(r'[<>"\']', '', name)[:100]  # Remove dangerous chars, limit length
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"name": name, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Name updated", "name": name}

@api_router.get("/auth/streak")
async def get_user_streak(request: Request):
    """Get user's current streak"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    streak = getattr(user, 'streak_current', 0)
    last_activity = getattr(user, 'streak_last_activity_date', None)
    
    return {
        "streak": streak,
        "last_activity_date": last_activity.isoformat() if last_activity else None
    }

async def update_user_streak(user_id: str):
    """Update streak when a task is completed"""
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        return
    
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    last_activity = user_doc.get('streak_last_activity_date')
    current_streak = user_doc.get('streak_current', 0)
    
    if last_activity:
        if isinstance(last_activity, str):
            last_activity = datetime.fromisoformat(last_activity.replace('Z', '+00:00'))
        if last_activity.tzinfo is None:
            last_activity = last_activity.replace(tzinfo=timezone.utc)
        
        last_activity_day = last_activity.replace(hour=0, minute=0, second=0, microsecond=0)
        days_diff = (today - last_activity_day).days
        
        if days_diff == 0:
            # Same day, don't increment
            return
        elif days_diff == 1:
            # Consecutive day, increment streak
            current_streak += 1
        else:
            # Streak broken, reset to 1
            current_streak = 1
    else:
        # First activity
        current_streak = 1
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "streak_current": current_streak,
            "streak_last_activity_date": now.isoformat()
        }}
    )

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
async def checkout_redirect(http_request: Request, locale: str = "en", country: str = "US", email: str = "", native: int = 0):
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

    # Native app: utilise le deep link io.kolo.app:// pour le retour Safari in-app
    native_scheme = "io.kolo.app://" if native else None
    
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
            if native_scheme:
                return RedirectResponse(url=f"{native_scheme}checkout-error?reason=already_subscribed", status_code=303)
            return RedirectResponse(url=f"{origin_url}/subscribe?error=already_subscribed", status_code=303)
        
        # Check for recent successful payment
        recent_payment = await db.payment_success.find_one({
            "email": email,
            "created_at": {"$gte": thirty_days_ago}
        })
        
        if recent_payment:
            # Already paid recently, redirect to account creation
            if native_scheme:
                return RedirectResponse(url=f"{native_scheme}create-account?session_id={recent_payment.get('session_id', '')}", status_code=303)
            return RedirectResponse(url=f"{origin_url}/create-account?session_id={recent_payment.get('session_id', '')}", status_code=303)
    
    if native_scheme:
        success_url = f"{native_scheme}create-account?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{native_scheme}checkout-cancelled"
    else:
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
        
        # Create checkout session with subscription and 14-day trial
        # Using only 'card' payment method to avoid duplicate Apple Pay buttons
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{
                "price": price_id,
                "quantity": 1
            }],
            subscription_data={
                "trial_period_days": 14,
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
        # Redirect back to subscribe page with error (native or web)
        if native_scheme:
            return RedirectResponse(url=f"{native_scheme}checkout-error?reason=payment_failed", status_code=303)
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

def _stripe_sub_current_period_end(sub):
    """
    Stripe API v2025+ moved `current_period_end` from the Subscription object
    to each Subscription Item. Reading `sub.current_period_end` directly raises
    AttributeError on newer SDKs. This helper falls back across both layouts.
    """
    try:
        items = sub["items"]
        if items and items.data:
            v = items.data[0].get("current_period_end") if hasattr(items.data[0], "get") else getattr(items.data[0], "current_period_end", None)
            if v:
                return v
    except Exception:
        pass
    try:
        return sub["current_period_end"]
    except Exception:
        return None


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
            locale = session.metadata.get("locale", "fr")
            
            if email and subscription_id:
                # Get subscription details
                sub = stripe.Subscription.retrieve(subscription_id)
                trial_end = datetime.fromtimestamp(sub.trial_end, tz=timezone.utc) if sub.trial_end else None
                
                # Determine plan from price
                plan = "free"
                sub_items = sub["items"]
                if sub_items and sub_items.data:
                    price = sub_items.data[0].price
                    amount = price.unit_amount if price else 0
                    if amount >= 2000:
                        plan = "pro_plus"
                    elif amount >= 500:
                        plan = "pro"
                
                # Store payment success
                token_doc = {
                    "session_id": session.id,
                    "email": email,
                    "subscription_id": subscription_id,
                    "customer_id": customer_id,
                    "status": sub.status,
                    "plan": plan,
                    "trial_ends_at": trial_end.isoformat() if trial_end else None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "token": f"pay_{uuid.uuid4().hex}",
                    "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
                    "used": False
                }
                await db.payment_success.insert_one(token_doc)
                logger.info(f"Payment success recorded for {email}")
                
                # CRITICAL: Update user directly by email (not just by stripe_customer_id)
                user_doc = await db.users.find_one({"email": email}, {"_id": 0})
                if user_doc:
                    update_data = {
                        "stripe_customer_id": customer_id,
                        "subscription_id": subscription_id,
                        "subscription_status": sub.status,
                        "plan": plan,
                        "trial_ends_at": trial_end.isoformat() if trial_end else None,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    if sub.status == "trialing":
                        update_data["trial_plan"] = plan
                    
                    await db.users.update_one({"email": email}, {"$set": update_data})
                    logger.info(f"Updated user {email} to plan {plan} with status {sub.status}")
                    
                    # Send confirmation email
                    try:
                        user_name = user_doc.get("full_name", user_doc.get("name", "")).split(" ")[0] or "Client"
                        await send_subscription_confirmation_email(
                            email=email,
                            name=user_name,
                            plan=plan,
                            is_trial=(sub.status == "trialing"),
                            trial_end=trial_end,
                            locale=locale
                        )
                        logger.info(f"Sent subscription confirmation email to {email}")
                    except Exception as email_err:
                        logger.error(f"Failed to send confirmation email to {email}: {email_err}")
                else:
                    logger.warning(f"User not found for email {email} during checkout completion")
        
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
    cpe_ts = _stripe_sub_current_period_end(sub)
    current_period_end = datetime.fromtimestamp(cpe_ts, tz=timezone.utc) if cpe_ts else None
    cancel_at_period_end = sub.cancel_at_period_end
    
    # Determine plan from subscription price
    plan = "free"
    sub_items = sub["items"]
    if sub_items and sub_items.data:
        price = sub_items.data[0].price
        amount = price.unit_amount if price else 0
        # PRO+ is more expensive than PRO
        if amount >= 2000:  # $20+ or equivalent
            plan = "pro_plus"
        elif amount >= 500:  # $5+ or equivalent
            plan = "pro"
    
    # Find user by stripe customer ID
    user_doc = await db.users.find_one({"stripe_customer_id": customer_id})
    
    if user_doc:
        update_data = {
            "subscription_id": subscription_id,
            "subscription_status": status,
            "trial_ends_at": trial_end.isoformat() if trial_end else None,
            "subscription_ends_at": current_period_end.isoformat() if current_period_end else None,
            "cancel_at_period_end": cancel_at_period_end,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Update plan if subscription is active or trialing
        if status in ["active", "trialing"]:
            update_data["plan"] = plan
            if status == "trialing":
                update_data["trial_plan"] = plan
        
        await db.users.update_one(
            {"stripe_customer_id": customer_id},
            {"$set": update_data}
        )
        logger.info(f"Updated subscription for customer {customer_id}: status={status}, plan={plan}")
        
        # Send confirmation email
        try:
            user_email = user_doc.get("email")
            user_name = user_doc.get("full_name", user_doc.get("name", "")).split(" ")[0]
            locale = user_doc.get("locale", "fr")
            
            if user_email and status in ["active", "trialing"]:
                await send_subscription_confirmation_email(
                    email=user_email,
                    name=user_name,
                    plan=plan,
                    is_trial=(status == "trialing"),
                    trial_end=trial_end,
                    locale=locale
                )
                logger.info(f"Sent subscription confirmation email to {user_email}")
        except Exception as e:
            logger.error(f"Failed to send confirmation email: {e}")

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


# ==================== APPLE STOREKIT IAP (iOS) ====================

# App-Specific Shared Secret from App Store Connect:
#   App Store Connect → My Apps → KOLO → In-App Purchases → Manage →
#   App-Specific Shared Secret.
#
# Resolution order:
#   1. Platform env var APPLE_IAP_SHARED_SECRET (preferred — rotatable without redeploy)
#   2. apple_iap_config.py fallback (used when the hosting provider has no way
#      to set custom env vars)
try:
    from apple_iap_config import (
        APPLE_IAP_SHARED_SECRET_FALLBACK as _APPLE_SECRET_FALLBACK,
        APPLE_BUNDLE_ID_FALLBACK as _APPLE_BUNDLE_FALLBACK,
    )
except ImportError:
    _APPLE_SECRET_FALLBACK = ''
    _APPLE_BUNDLE_FALLBACK = 'io.kolo.app'

APPLE_SHARED_SECRET = os.environ.get('APPLE_IAP_SHARED_SECRET') or _APPLE_SECRET_FALLBACK

# Bundle id expected in the Apple receipt (defense-in-depth)
APPLE_BUNDLE_ID = os.environ.get('APPLE_BUNDLE_ID') or _APPLE_BUNDLE_FALLBACK

# Map Apple product_id → internal plan key (must match App Store Connect EXACTLY — case sensitive)
APPLE_PRODUCT_TO_PLAN = {
    'PRO': 'pro',
    'PRO_Plus': 'pro_plus',
    'Pro_simple_yearly': 'pro',
    'PROYearly': 'pro_plus',
}

# Apple verifyReceipt endpoints (production + sandbox fallback)
APPLE_VERIFY_PROD = 'https://buy.itunes.apple.com/verifyReceipt'
APPLE_VERIFY_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt'


async def _apple_verify_receipt(receipt_b64: str) -> dict:
    """
    POST the base64 receipt to Apple's verifyReceipt endpoint.
    Handles the sandbox fallback automatically per Apple's docs (status 21007).
    Returns the raw Apple response dict.
    """
    payload = {
        'receipt-data': receipt_b64,
        'password': APPLE_SHARED_SECRET,
        'exclude-old-transactions': True,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(APPLE_VERIFY_PROD, json=payload)
        data = r.json()
        # Status 21007 = receipt is from sandbox; retry against sandbox endpoint.
        if data.get('status') == 21007:
            r2 = await client.post(APPLE_VERIFY_SANDBOX, json=payload)
            data = r2.json()
    return data


def _pick_latest_active_purchase(apple_response: dict) -> Optional[dict]:
    """
    From a verifyReceipt response, pick the most recent active subscription
    transaction that matches a known KOLO product. Returns None if nothing active.
    """
    latest = apple_response.get('latest_receipt_info') or []
    if not latest and apple_response.get('receipt'):
        latest = apple_response['receipt'].get('in_app') or []

    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    best = None
    best_expires_ms = 0
    for tx in latest:
        product_id = tx.get('product_id')
        if product_id not in APPLE_PRODUCT_TO_PLAN:
            continue
        # Apple expiration dates: expires_date_ms (ms since epoch, as string)
        try:
            expires_ms = int(tx.get('expires_date_ms') or 0)
        except (TypeError, ValueError):
            expires_ms = 0
        if expires_ms > best_expires_ms:
            best = tx
            best_expires_ms = expires_ms
    if not best:
        return None
    # Active if expiry in the future (plus small tolerance)
    best['_is_active'] = best_expires_ms > now_ms
    best['_expires_ms'] = best_expires_ms
    return best


@api_router.post("/iap/verify-apple-receipt")
async def iap_verify_apple_receipt(request: Request):
    """
    Verify an Apple StoreKit receipt after a successful in-app purchase or
    restoration. Updates the authenticated user's plan in MongoDB.

    Body: { "receipt": "<base64 receipt-data>", "product_id": "PRO" | "PRO_plus" }
    """
    user = await require_auth(request)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    receipt_b64 = body.get('receipt')
    if not receipt_b64 or not isinstance(receipt_b64, str):
        raise HTTPException(status_code=400, detail="Missing receipt")

    if not APPLE_SHARED_SECRET:
        logger.error("APPLE_IAP_SHARED_SECRET is not configured")
        raise HTTPException(status_code=500, detail="IAP not configured")

    try:
        apple = await _apple_verify_receipt(receipt_b64)
    except Exception as e:
        logger.error(f"Apple verifyReceipt network error: {e}")
        raise HTTPException(status_code=502, detail="Apple verification failed")

    status = apple.get('status')
    if status != 0:
        logger.warning(f"Apple verifyReceipt failed status={status} user={user.user_id}")
        return {
            "success": False,
            "status": "invalid_receipt",
            "apple_status": status,
        }

    # Defense in depth: ensure receipt is for our bundle
    bundle_id = (apple.get('receipt') or {}).get('bundle_id')
    if bundle_id and bundle_id != APPLE_BUNDLE_ID:
        logger.warning(
            f"Bundle id mismatch: receipt={bundle_id} expected={APPLE_BUNDLE_ID}"
        )
        raise HTTPException(status_code=400, detail="Bundle mismatch")

    active = _pick_latest_active_purchase(apple)
    if not active:
        # No active KOLO subscription in this receipt → downgrade to free
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {
                "plan": "free",
                "subscription_status": "expired",
                "platform": "ios",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return {"success": True, "plan": "free", "status": "expired"}

    product_id = active.get('product_id')
    plan = APPLE_PRODUCT_TO_PLAN.get(product_id, 'free')
    expires_ms = active.get('_expires_ms') or 0
    expires_iso = (
        datetime.fromtimestamp(expires_ms / 1000, tz=timezone.utc).isoformat()
        if expires_ms else None
    )
    original_tx_id = active.get('original_transaction_id')

    update = {
        "plan": plan,
        "subscription_status": "active" if active.get('_is_active') else "expired",
        "platform": "ios",
        "apple_original_transaction_id": original_tx_id,
        "apple_product_id": product_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if expires_iso:
        update["subscription_ends_at"] = expires_iso

    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": update},
    )
    logger.info(
        f"Apple IAP verified for {user.user_id}: plan={plan} expires={expires_iso}"
    )

    return {
        "success": True,
        "plan": plan,
        "status": update["subscription_status"],
        "expires_at": expires_iso,
        "product_id": product_id,
    }


@api_router.post("/admin/sync-subscription")
async def admin_sync_subscription(request: Request):
    """Admin endpoint to sync user subscription from Stripe"""
    import stripe
    stripe.api_key = STRIPE_API_KEY
    
    body = await request.json()
    email = body.get("email")
    admin_key = body.get("admin_key")
    
    # Simple admin protection
    if admin_key != os.environ.get("ADMIN_SECRET", "kolo_admin_2026"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    # Find user
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Search for customer in Stripe by email
    customers = stripe.Customer.list(email=email, limit=1)
    if not customers.data:
        return {"status": "no_stripe_customer", "message": f"No Stripe customer found for {email}"}
    
    customer = customers.data[0]
    customer_id = customer.id
    
    # Get active subscriptions
    subscriptions = stripe.Subscription.list(customer=customer_id, status="all", limit=5)
    
    active_sub = None
    for sub in subscriptions.data:
        if sub.status in ["active", "trialing"]:
            active_sub = sub
            break
    
    if not active_sub:
        return {"status": "no_active_subscription", "message": f"No active subscription found for {email}"}
    
    # Determine plan from price
    plan = "free"
    sub_items = active_sub["items"]
    if sub_items and sub_items.data:
        price = sub_items.data[0].price
        amount = price.unit_amount if price else 0
        if amount >= 2000:
            plan = "pro_plus"
        elif amount >= 500:
            plan = "pro"
    
    trial_end = datetime.fromtimestamp(active_sub.trial_end, tz=timezone.utc) if active_sub.trial_end else None
    cpe_ts = _stripe_sub_current_period_end(active_sub)
    current_period_end = datetime.fromtimestamp(cpe_ts, tz=timezone.utc) if cpe_ts else None
    
    # Update user
    update_result = await db.users.update_one(
        {"email": email},
        {"$set": {
            "stripe_customer_id": customer_id,
            "subscription_id": active_sub.id,
            "subscription_status": active_sub.status,
            "plan": plan,
            "trial_plan": plan if active_sub.status == "trialing" else None,
            "trial_ends_at": trial_end.isoformat() if trial_end else None,
            "subscription_ends_at": current_period_end.isoformat() if current_period_end else None,
            "cancel_at_period_end": active_sub.cancel_at_period_end,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "status": "success",
        "message": f"Subscription synced for {email}",
        "plan": plan,
        "subscription_status": active_sub.status,
        "trial_ends_at": trial_end.isoformat() if trial_end else None,
        "modified_count": update_result.modified_count
    }


@api_router.get("/debug/sync-status")
async def debug_sync_status(email: str, admin_key: str):
    """
    Comprehensive diagnostic endpoint that explains EXACTLY why a user's
    subscription sync is failing. Returns:
      - user document state in Mongo
      - pending payment_success records for this email
      - Stripe API key mode (test vs live)
      - All Stripe customers matching stored customer_id OR email
      - All subscriptions for those customers
      - What sync_subscription_from_stripe would return right now
    Protected by ADMIN_SECRET. Use it to debug stuck-on-pricing bugs.
    """
    if admin_key != os.environ.get("ADMIN_SECRET", "kolo_admin_2026"):
        raise HTTPException(status_code=401, detail="Unauthorized")

    import stripe
    stripe.api_key = STRIPE_API_KEY

    email_norm = (email or "").lower().strip()
    report = {
        "email_queried": email_norm,
        "stripe_api_key_present": bool(STRIPE_API_KEY),
        "stripe_api_key_mode": (
            "live" if STRIPE_API_KEY.startswith("sk_live_")
            else "test" if STRIPE_API_KEY.startswith("sk_test_")
            else "unknown"
        ),
        "stripe_webhook_secret_present": bool(os.environ.get("STRIPE_WEBHOOK_SECRET")),
    }

    # 1. User document
    user_doc = await db.users.find_one({"email": email_norm}, {"_id": 0, "password_hash": 0})
    report["user_in_db"] = user_doc if user_doc else None
    if not user_doc:
        report["conclusion"] = "USER_NOT_FOUND_IN_DB"
        return report

    # 2. payment_success records
    pay_records = await db.payment_success.find(
        {"email": email_norm},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=10)
    report["payment_success_records"] = pay_records
    report["payment_success_count"] = len(pay_records)
    report["payment_success_unused_count"] = sum(1 for r in pay_records if not r.get("used"))

    # 3. Stripe customers matching stored cid OR email
    customers_found = []
    candidate_cids = []

    stored_cid = user_doc.get("stripe_customer_id")
    if stored_cid:
        try:
            c = stripe.Customer.retrieve(stored_cid)
            customers_found.append({
                "id": c.id,
                "email": c.email,
                "source": "stored_in_user_doc",
                "deleted": getattr(c, "deleted", False),
            })
            candidate_cids.append(c.id)
        except Exception as e:
            customers_found.append({
                "id": stored_cid,
                "source": "stored_in_user_doc",
                "error": str(e),
            })

    try:
        cust_list = stripe.Customer.list(email=email_norm, limit=20)
        for c in cust_list.data:
            if c.id not in candidate_cids:
                customers_found.append({
                    "id": c.id,
                    "email": c.email,
                    "source": "matched_by_email",
                    "created": c.created,
                })
                candidate_cids.append(c.id)
    except Exception as e:
        report["stripe_customer_list_error"] = str(e)

    report["stripe_customers"] = customers_found
    report["stripe_customer_count"] = len(customers_found)

    # 4. All subscriptions across candidate customers
    all_subs = []
    for cid in candidate_cids:
        try:
            subs = stripe.Subscription.list(customer=cid, status="all", limit=10)
            for s in subs.data:
                price_amount = None
                price_id = None
                price_currency = None
                s_items = s["items"]
                if s_items and s_items.data:
                    p = s_items.data[0].price
                    if p:
                        price_amount = p.unit_amount
                        price_id = p.id
                        price_currency = p.currency
                all_subs.append({
                    "customer_id": cid,
                    "subscription_id": s.id,
                    "status": s.status,
                    "price_amount": price_amount,
                    "price_currency": price_currency,
                    "price_id": price_id,
                    "trial_end": s.trial_end,
                    "current_period_end": _stripe_sub_current_period_end(s),
                    "cancel_at_period_end": s.cancel_at_period_end,
                    "created": s.created,
                })
        except Exception as e:
            all_subs.append({"customer_id": cid, "error": str(e)})

    report["stripe_subscriptions"] = all_subs
    report["stripe_active_or_trialing_count"] = sum(
        1 for s in all_subs if s.get("status") in ("active", "trialing")
    )

    # 5. Run the actual sync function and report what it returns (read-only check)
    try:
        sync_preview = await sync_subscription_from_stripe(
            user_doc["user_id"], email_norm
        )
        report["sync_function_result"] = sync_preview
    except Exception as e:
        report["sync_function_error"] = str(e)

    # 6. Re-read user doc post-sync to confirm DB state
    user_after = await db.users.find_one({"email": email_norm}, {"_id": 0, "password_hash": 0})
    report["user_in_db_after_sync"] = user_after

    # 7. Conclusion
    if report["stripe_active_or_trialing_count"] == 0 and not report["payment_success_unused_count"]:
        report["conclusion"] = "NO_ACTIVE_SUBSCRIPTION_FOUND_IN_STRIPE_OR_PAYMENT_RECORDS"
    elif user_after and user_after.get("subscription_status") in ("active", "trialing"):
        report["conclusion"] = "SYNC_SUCCESS_USER_NOW_HAS_ACTIVE_SUBSCRIPTION"
    else:
        report["conclusion"] = "SYNC_FAILED_DESPITE_STRIPE_HAVING_ACTIVE_SUB"

    return report



class EnterpriseDemoRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    company: str
    size: str
    message: Optional[str] = ""
    locale: Optional[str] = "fr"


@api_router.post("/enterprise/demo-request")
async def submit_enterprise_demo_request(payload: EnterpriseDemoRequest, request: Request):
    """
    Public endpoint: capture a demo request from a real estate network. Stored
    in `enterprise_leads` collection for the sales team to follow up manually.
    """
    # Lightweight validation
    email = (payload.email or "").strip().lower()
    if not email or not validate_email_format(email):
        raise HTTPException(status_code=400, detail="Invalid email")

    if not payload.first_name.strip() or not payload.last_name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if not payload.company.strip():
        raise HTTPException(status_code=400, detail="Company is required")
    if not payload.size:
        raise HTTPException(status_code=400, detail="Size is required")

    lead = {
        "lead_id": f"ent_{uuid.uuid4().hex[:16]}",
        "first_name": payload.first_name.strip(),
        "last_name": payload.last_name.strip(),
        "email": email,
        "phone": payload.phone.strip(),
        "company": payload.company.strip(),
        "size": payload.size,
        "message": (payload.message or "").strip(),
        "locale": payload.locale or "fr",
        "source_ip": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent", "")[:300],
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.enterprise_leads.insert_one(lead)
    logger.info(
        f"Enterprise demo request received: {payload.company} ({email}, {payload.size})"
    )

    # === Notify the sales team via Resend ===
    try:
        import resend as _resend
        resend_api_key = os.environ.get("RESEND_API_KEY", "").strip()
        sender_email = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev").strip()
        notify_to = [
            "elliot.cohenpressard@trykolo.io",
            "hello@trykolo.io",
        ]
        if resend_api_key:
            _resend.api_key = resend_api_key
            html = f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0B0B0F;">
              <div style="background: linear-gradient(135deg, #8B5CF6, #EC4899); padding: 28px; border-radius: 16px; color: #fff;">
                <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85;">KOLO · Nouveau lead B2B</div>
                <h1 style="margin: 8px 0 0; font-size: 22px; font-weight: 800;">{lead['company']}</h1>
                <div style="opacity: 0.85; margin-top: 4px; font-size: 14px;">{lead['size']} · {payload.locale or 'fr'}</div>
              </div>
              <div style="background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 14px; padding: 22px; margin-top: 16px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr><td style="padding: 8px 0; color: #6B7280; width: 130px;">Nom</td><td style="padding: 8px 0; font-weight: 600;">{lead['first_name']} {lead['last_name']}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6B7280;">Email</td><td style="padding: 8px 0;"><a href="mailto:{lead['email']}" style="color: #8B5CF6; text-decoration: none;">{lead['email']}</a></td></tr>
                  <tr><td style="padding: 8px 0; color: #6B7280;">Téléphone</td><td style="padding: 8px 0;">{lead.get('phone') or '—'}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6B7280;">Entreprise</td><td style="padding: 8px 0; font-weight: 600;">{lead['company']}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6B7280;">Taille</td><td style="padding: 8px 0;">{lead['size']}</td></tr>
                </table>
                {f'<div style="margin-top: 18px; padding: 14px; background: rgba(139, 92, 246, 0.06); border-radius: 10px;"><div style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6B7280; margin-bottom: 6px;">Message</div><div style="font-size: 14px; line-height: 1.5; white-space: pre-wrap;">{lead["message"]}</div></div>' if lead.get('message') else ''}
                <div style="margin-top: 22px; padding-top: 16px; border-top: 1px solid rgba(0,0,0,0.06); font-size: 12px; color: #9CA3AF;">
                  Lead ID : <code>{lead['lead_id']}</code><br/>
                  IP : {lead.get('source_ip') or '—'}<br/>
                  Reçu : {lead['created_at']}
                </div>
              </div>
              <div style="text-align: center; margin-top: 20px;">
                <a href="https://trykolo.io/kolo-admin" style="display: inline-block; background: #0B0B0F; color: #fff; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 14px;">Voir dans l'admin →</a>
              </div>
              <p style="margin-top: 24px; text-align: center; color: #9CA3AF; font-size: 12px;">KOLO · Notification automatique des leads B2B</p>
            </div>
            """
            _resend.Emails.send({
                "from": f"KOLO Leads <{sender_email}>",
                "to": notify_to,
                "reply_to": [lead["email"]],
                "subject": f"[KOLO] Nouvelle demande B2B — {lead['company']} ({lead['size']})",
                "html": html,
            })
            logger.info(f"Sales notification sent for lead {lead['lead_id']}")

            # Auto-acknowledge to the lead
            ack_html = f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0B0B0F;">
              <div style="text-align: center; padding: 28px 20px;">
                <div style="font-weight: 800; font-size: 28px; letter-spacing: -0.02em;">KOLO<span style="color: #CB6CE6;">.</span></div>
              </div>
              <div style="background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 14px; padding: 28px;">
                <h1 style="margin: 0 0 16px; font-size: 22px;">Merci {lead['first_name']} 👋</h1>
                <p style="font-size: 15px; line-height: 1.6; color: #4B5563;">
                  Nous avons bien reçu votre demande pour <strong>{lead['company']}</strong>.
                  Notre équipe revient vers vous sous <strong>24h</strong> pour échanger sur vos besoins.
                </p>
                <p style="font-size: 15px; line-height: 1.6; color: #4B5563;">
                  En attendant, n'hésitez pas à découvrir KOLO :
                </p>
                <div style="text-align: center; margin-top: 20px;">
                  <a href="https://trykolo.io" style="display: inline-block; background: linear-gradient(135deg, #8B5CF6, #EC4899); color: #fff; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600;">Découvrir KOLO →</a>
                </div>
              </div>
              <p style="margin-top: 24px; text-align: center; color: #9CA3AF; font-size: 12px;">KOLO · L'agent immobilier augmenté</p>
            </div>
            """
            _resend.Emails.send({
                "from": f"KOLO <{sender_email}>",
                "to": [lead["email"]],
                "subject": "Bien reçu — l'équipe KOLO revient vers vous",
                "html": ack_html,
            })
        else:
            logger.warning("Resend API key missing — enterprise lead notification skipped")
    except Exception as _email_err:
        # Never fail the form submission if email sending fails
        logger.error(f"Failed to send enterprise lead notification: {_email_err}")

    # Don't echo back internal fields
    return {"ok": True, "lead_id": lead["lead_id"]}


@api_router.get("/admin/enterprise-leads")
async def list_enterprise_leads(admin_key: str, status: Optional[str] = None, limit: int = 200):
    """
    Admin-only: list all enterprise demo requests, newest first. Filter by
    status (new / contacted / converted / rejected) via the optional query param.
    """
    if admin_key != os.environ.get("ADMIN_SECRET", "kolo_admin_2026"):
        raise HTTPException(status_code=401, detail="Unauthorized")

    query = {}
    if status:
        query["status"] = status
    cursor = db.enterprise_leads.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    leads = await cursor.to_list(length=limit)
    return {"count": len(leads), "leads": leads}


# ==================== KOLO SUPER ADMIN ENDPOINTS ====================
# Session-authenticated admin space (/kolo-admin). The current user's email
# must be in KOLO_SUPER_ADMIN_EMAILS. Used by the AdminDashboard React page.

async def require_super_admin(request: Request) -> User:
    """Authorize: requires a logged-in user whose email is in the allowlist."""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not is_super_admin_email(user.email):
        raise HTTPException(status_code=403, detail="Forbidden — super admin only")
    return user


@api_router.get("/admin/check")
async def admin_check(request: Request):
    """Lightweight endpoint a frontend can call to confirm super admin status."""
    user = await get_user_from_session(request)
    if not user:
        return {"is_super_admin": False, "authenticated": False}
    return {
        "is_super_admin": is_super_admin_email(user.email),
        "authenticated": True,
        "email": user.email,
    }


@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    """KPI dashboard for the super admin."""
    await require_super_admin(request)

    total_users = await db.users.count_documents({})
    active_subs = await db.users.count_documents({"subscription_status": "active"})
    trialing = await db.users.count_documents({"subscription_status": "trialing"})
    canceled = await db.users.count_documents({"subscription_status": "canceled"})
    google_users = await db.users.count_documents({"auth_provider": "google"})
    email_users = await db.users.count_documents({"auth_provider": "email"})

    total_leads = await db.enterprise_leads.count_documents({})
    new_leads = await db.enterprise_leads.count_documents({"status": "new"})
    contacted_leads = await db.enterprise_leads.count_documents({"status": "contacted"})
    converted_leads = await db.enterprise_leads.count_documents({"status": "converted"})
    rejected_leads = await db.enterprise_leads.count_documents({"status": "rejected"})

    total_prospects = await db.prospects.count_documents({}) if "prospects" in (await db.list_collection_names()) else 0

    # Recent signups (last 7 days)
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_signups = await db.users.count_documents({"created_at": {"$gte": seven_days_ago}})

    return {
        "users": {
            "total": total_users,
            "active": active_subs,
            "trialing": trialing,
            "canceled": canceled,
            "google": google_users,
            "email": email_users,
            "recent_signups_7d": recent_signups,
        },
        "leads": {
            "total": total_leads,
            "new": new_leads,
            "contacted": contacted_leads,
            "converted": converted_leads,
            "rejected": rejected_leads,
        },
        "prospects_total": total_prospects,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@api_router.get("/admin/leads")
async def admin_list_leads(request: Request, status: Optional[str] = None, limit: int = 200):
    """List enterprise demo requests for the super admin (session-authenticated)."""
    await require_super_admin(request)
    query = {}
    if status and status != "all":
        query["status"] = status
    cursor = db.enterprise_leads.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    leads = await cursor.to_list(length=limit)
    return {"count": len(leads), "leads": leads}


class AdminLeadUpdate(BaseModel):
    status: Optional[str] = None  # new / contacted / converted / rejected
    notes: Optional[str] = None


@api_router.patch("/admin/leads/{lead_id}")
async def admin_update_lead(lead_id: str, payload: AdminLeadUpdate, request: Request):
    """Update a lead's status / internal notes."""
    admin_user = await require_super_admin(request)

    update_doc = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.status:
        allowed = {"new", "contacted", "converted", "rejected"}
        if payload.status not in allowed:
            raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")
        update_doc["status"] = payload.status
        update_doc["status_changed_by"] = admin_user.email
    if payload.notes is not None:
        update_doc["admin_notes"] = payload.notes

    result = await db.enterprise_leads.update_one({"lead_id": lead_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead = await db.enterprise_leads.find_one({"lead_id": lead_id}, {"_id": 0})
    return {"ok": True, "lead": lead}


@api_router.get("/admin/users")
async def admin_list_users(
    request: Request,
    q: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    """Paginated user list with optional search (email/name) and status filter."""
    await require_super_admin(request)

    query = {}
    if status and status != "all":
        query["subscription_status"] = status
    if q:
        q_clean = q.strip()
        if q_clean:
            query["$or"] = [
                {"email": {"$regex": q_clean, "$options": "i"}},
                {"name": {"$regex": q_clean, "$options": "i"}},
            ]

    total = await db.users.count_documents(query)
    projection = {
        "_id": 0,
        "user_id": 1,
        "email": 1,
        "name": 1,
        "auth_provider": 1,
        "subscription_status": 1,
        "plan": 1,
        "trial_ends_at": 1,
        "subscription_ends_at": 1,
        "created_at": 1,
        "country": 1,
        "currency": 1,
        "phone": 1,
    }
    cursor = (
        db.users.find(query, projection)
        .sort("created_at", -1)
        .skip(max(0, offset))
        .limit(min(500, max(1, limit)))
    )
    users = await cursor.to_list(length=limit)
    return {"total": total, "limit": limit, "offset": offset, "users": users}



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
            cpe_ts = _stripe_sub_current_period_end(sub)
            current_period_end = datetime.fromtimestamp(cpe_ts, tz=timezone.utc) if cpe_ts else None
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

# ==================== PLAN & FEATURE ENDPOINTS ====================

def get_user_effective_plan(user_doc: dict) -> str:
    """Get user's effective plan considering trials and subscriptions"""
    now = datetime.now(timezone.utc)
    
    # Check if user is in an active trial
    trial_plan = user_doc.get("trial_plan")
    trial_end = user_doc.get("trial_ends_at")
    
    if trial_plan and trial_end:
        if isinstance(trial_end, str):
            trial_end = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
        if trial_end.tzinfo is None:
            trial_end = trial_end.replace(tzinfo=timezone.utc)
        
        if now < trial_end:
            return trial_plan
    
    # Check subscription status
    sub_status = user_doc.get("subscription_status", "none")
    stored_plan = user_doc.get("plan", "free")
    
    # If subscription is active or trialing, return the stored plan
    if sub_status in ["active", "trialing"]:
        return stored_plan
    
    # FALLBACK: If user has a plan set (from webhook) but status wasn't updated,
    # trust the plan if there's a stripe_customer_id (meaning they paid)
    if stored_plan in ["pro", "pro_plus"] and user_doc.get("stripe_customer_id"):
        # Check subscription_id exists (they have/had a subscription)
        if user_doc.get("subscription_id"):
            return stored_plan
    
    return "free"

def check_feature_access(user_doc: dict, feature: str) -> bool:
    """Check if user has access to a specific feature"""
    effective_plan = get_user_effective_plan(user_doc)
    plan_features = PLAN_FEATURES.get(effective_plan, PLAN_FEATURES["free"])
    return plan_features.get(feature, False)

async def check_prospect_limit(user_id: str, user_doc: dict) -> dict:
    """Check if user can add more prospects"""
    effective_plan = get_user_effective_plan(user_doc)
    max_prospects = PLAN_FEATURES[effective_plan]["max_prospects"]
    
    if max_prospects is None:
        return {"can_add": True, "current": 0, "max": None}
    
    current_count = await db.prospects.count_documents({
        "user_id": user_id,
        "status": {"$nin": ["closed_won", "closed_lost", "archived"]}
    })
    
    return {
        "can_add": current_count < max_prospects,
        "current": current_count,
        "max": max_prospects
    }

async def check_ai_suggestion_limit(user_id: str, user_doc: dict) -> dict:
    """Check if user can use AI suggestions today"""
    effective_plan = get_user_effective_plan(user_doc)
    max_suggestions = PLAN_FEATURES[effective_plan]["daily_ai_suggestions"]
    
    if max_suggestions is None:
        return {"can_use": True, "used": 0, "max": None}
    
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    reset_date = user_doc.get("daily_suggestions_reset_date")
    used = user_doc.get("daily_suggestions_used", 0)
    
    if reset_date:
        if isinstance(reset_date, str):
            reset_date = datetime.fromisoformat(reset_date.replace('Z', '+00:00'))
        if reset_date.tzinfo is None:
            reset_date = reset_date.replace(tzinfo=timezone.utc)
        
        # Reset if it's a new day
        if reset_date < today:
            used = 0
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {
                    "daily_suggestions_used": 0,
                    "daily_suggestions_reset_date": today.isoformat()
                }}
            )
    
    return {
        "can_use": used < max_suggestions,
        "used": used,
        "max": max_suggestions
    }

@api_router.get("/plans/current")
async def get_current_plan(request: Request):
    """Get user's current plan and features"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    effective_plan = get_user_effective_plan(user_doc)
    features = PLAN_FEATURES.get(effective_plan, PLAN_FEATURES["free"])
    
    # Check limits
    prospect_limit = await check_prospect_limit(user.user_id, user_doc)
    ai_limit = await check_ai_suggestion_limit(user.user_id, user_doc)
    
    # Trial info
    trial_info = None
    trial_plan = user_doc.get("trial_plan")
    trial_end = user_doc.get("trial_ends_at")
    if trial_plan and trial_end:
        if isinstance(trial_end, str):
            trial_end = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
        trial_info = {
            "plan": trial_plan,
            "ends_at": trial_end.isoformat() if isinstance(trial_end, datetime) else trial_end,
            "days_remaining": max(0, (trial_end - datetime.now(timezone.utc)).days) if isinstance(trial_end, datetime) else 0
        }
    
    return {
        "plan": user_doc.get("plan", "free"),
        "effective_plan": effective_plan,
        "billing_period": user_doc.get("billing_period", "monthly"),
        "features": features,
        "limits": {
            "prospects": prospect_limit,
            "ai_suggestions": ai_limit
        },
        "trial": trial_info,
        "trial_used": user_doc.get("trial_start_date") is not None,  # Has user already used trial?
        "subscription_status": user_doc.get("subscription_status", "none"),
        "subscription_ends_at": user_doc.get("subscription_ends_at"),
        "cancel_at_period_end": user_doc.get("cancel_at_period_end", False),
        "currency": user_doc.get("currency", "EUR")
    }

@api_router.get("/plans/pricing")
async def get_pricing(request: Request, currency: Optional[str] = None):
    """Get pricing for all plans"""
    # Detect currency from user or request
    detected_currency = currency or "EUR"
    
    user = await get_user_from_session(request)
    if user:
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        if user_doc:
            detected_currency = user_doc.get("currency", "EUR")
    
    if detected_currency not in ["EUR", "USD", "GBP"]:
        detected_currency = "EUR"
    
    # Free display based on currency
    free_display = {
        "EUR": "0€",
        "USD": "$0",
        "GBP": "£0"
    }
    
    return {
        "currency": detected_currency,
        "plans": {
            "free": {
                "name": "STARTER",
                "price_monthly": 0,
                "price_annual": 0,
                "display_monthly": free_display.get(detected_currency, "0€"),
                "display_annual": free_display.get(detected_currency, "0€"),
                "features": list(PLAN_FEATURES["free"].keys())
            },
            "pro": {
                "name": "PRO",
                "price_monthly": PLAN_PRICING["pro"][detected_currency]["monthly"],
                "price_annual": PLAN_PRICING["pro"][detected_currency]["annual"],
                "display_monthly": PLAN_PRICING["pro"][detected_currency]["monthly_display"],
                "display_annual": PLAN_PRICING["pro"][detected_currency]["annual_display"],
                "display_annual_monthly": PLAN_PRICING["pro"][detected_currency]["annual_monthly"],
                "features": list(PLAN_FEATURES["pro"].keys())
            },
            "pro_plus": {
                "name": "PRO+",
                "price_monthly": PLAN_PRICING["pro_plus"][detected_currency]["monthly"],
                "price_annual": PLAN_PRICING["pro_plus"][detected_currency]["annual"],
                "display_monthly": PLAN_PRICING["pro_plus"][detected_currency]["monthly_display"],
                "display_annual": PLAN_PRICING["pro_plus"][detected_currency]["annual_display"],
                "display_annual_monthly": PLAN_PRICING["pro_plus"][detected_currency]["annual_monthly"],
                "features": list(PLAN_FEATURES["pro_plus"].keys())
            }
        }
    }

async def sync_subscription_from_stripe(user_id: str, email: str) -> dict:
    """
    Reusable helper that pulls the latest subscription state from Stripe and
    writes it to MongoDB. Returns the resulting plan / status so the caller
    can react. Safe to call at any time — idempotent.

    Used by:
      - POST /api/plans/sync   (called after Stripe checkout success)
      - POST /api/auth/login   (catches up users whose webhook silently failed)
    """
    import stripe
    stripe.api_key = STRIPE_API_KEY

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        return {"synced": False, "reason": "user_not_found"}

    # 1. Pending payment_success record (newest wins)
    payment_success = await db.payment_success.find_one(
        {"email": email, "used": False},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    if payment_success:
        plan = payment_success.get("plan", "pro")
        status = payment_success.get("status", "active")
        trial_ends_at = payment_success.get("trial_ends_at")
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "plan": plan,
                "subscription_status": status,
                "subscription_id": payment_success.get("subscription_id"),
                "stripe_customer_id": payment_success.get("customer_id"),
                "trial_ends_at": trial_ends_at,
                "trial_plan": plan if status == "trialing" else None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        await db.payment_success.update_one(
            {"token": payment_success.get("token")},
            {"$set": {"used": True}},
        )
        return {"synced": True, "source": "payment_success_record", "plan": plan, "subscription_status": status}

    # 2. Live Stripe lookup — gather every Stripe customer matching either the
    #    stored stripe_customer_id OR the email. Stripe Checkout sometimes
    #    creates a fresh customer instead of reusing the existing one, so we
    #    must search both to recover any active subscription.
    candidate_customer_ids = []

    stored_cid = user_doc.get("stripe_customer_id")
    if stored_cid:
        candidate_customer_ids.append(stored_cid)

    try:
        customers = stripe.Customer.list(email=email, limit=20)
        for c in customers.data:
            if c.id and c.id not in candidate_customer_ids:
                candidate_customer_ids.append(c.id)
    except Exception as e:
        logger.error(f"Stripe Customer.list failed for {email}: {e}")
        if not candidate_customer_ids:
            return {"synced": False, "reason": "stripe_error", "plan": user_doc.get("plan", "free")}

    if not candidate_customer_ids:
        return {"synced": False, "reason": "no_stripe_customer", "plan": user_doc.get("plan", "free")}

    # Walk all candidate customers, pick the first active/trialing subscription
    active_sub = None
    matched_customer_id = None
    for cid in candidate_customer_ids:
        try:
            subs = stripe.Subscription.list(customer=cid, status="all", limit=10)
        except Exception as e:
            logger.warning(f"Stripe Subscription.list failed for {cid}: {e}")
            continue
        for sub in subs.data:
            if sub.status in ("active", "trialing"):
                active_sub = sub
                matched_customer_id = cid
                break
        if active_sub:
            break

    if not active_sub:
        return {"synced": True, "reason": "no_active_subscription", "plan": user_doc.get("plan", "free")}

    plan = "free"
    sub_items = active_sub["items"]
    if sub_items and sub_items.data:
        price = sub_items.data[0].price
        amount = price.unit_amount if price else 0
        if amount >= 2000:
            plan = "pro_plus"
        elif amount >= 500:
            plan = "pro"

    trial_end = datetime.fromtimestamp(active_sub.trial_end, tz=timezone.utc) if active_sub.trial_end else None

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "stripe_customer_id": matched_customer_id,
            "subscription_id": active_sub.id,
            "subscription_status": active_sub.status,
            "plan": plan,
            "trial_plan": plan if active_sub.status == "trialing" else None,
            "trial_ends_at": trial_end.isoformat() if trial_end else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    return {
        "synced": True,
        "source": "stripe",
        "plan": plan,
        "subscription_status": active_sub.status,
        "trial_ends_at": trial_end.isoformat() if trial_end else None,
    }


@api_router.post("/plans/sync")
async def sync_user_plan(http_request: Request):
    """
    Sync user's subscription status from Stripe.
    Called after payment to ensure plan is updated.
    """
    user = await get_user_from_session(http_request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await sync_subscription_from_stripe(user.user_id, user.email)



class StartTrialRequest(BaseModel):
    plan: str  # pro or pro_plus

@api_router.post("/plans/start-trial")
async def start_trial(request: StartTrialRequest, http_request: Request):
    """Start a 14-day free trial for PRO or PRO+"""
    user = await get_user_from_session(http_request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if request.plan not in ["pro", "pro_plus"]:
        raise HTTPException(status_code=400, detail="Invalid plan. Must be 'pro' or 'pro_plus'")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user already had a trial
    if user_doc.get("trial_start_date"):
        raise HTTPException(status_code=400, detail="Vous avez déjà utilisé votre essai gratuit")
    
    # Check if user already has an active subscription
    if user_doc.get("subscription_status") == "active":
        raise HTTPException(status_code=400, detail="Vous avez déjà un abonnement actif")
    
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=14)
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "trial_plan": request.plan,
            "trial_start_date": now.isoformat(),
            "trial_ends_at": trial_end.isoformat(),
            "subscription_status": "trialing",
            "updated_at": now.isoformat()
        }}
    )
    
    # Send welcome email for trial (J+0)
    import asyncio
    user_name = user_doc.get("name", "").split(" ")[0] or "Agent"
    user_locale = user_doc.get("locale", "fr")
    asyncio.create_task(send_welcome_email(user.email, user_name, is_trial=True, trial_plan=request.plan, locale=user_locale))
    
    return {
        "message": f"Essai gratuit {request.plan.upper()} démarré",
        "trial_plan": request.plan,
        "trial_ends_at": trial_end.isoformat(),
        "days_remaining": 14
    }

@api_router.get("/plans/check-feature/{feature}")
async def check_feature(feature: str, request: Request):
    """Check if user has access to a specific feature"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    effective_plan = get_user_effective_plan(user_doc)
    has_access = check_feature_access(user_doc, feature)
    
    # Determine which plan is required for this feature
    required_plan = "free"
    if PLAN_FEATURES["pro"].get(feature) and not PLAN_FEATURES["free"].get(feature):
        required_plan = "pro"
    if PLAN_FEATURES["pro_plus"].get(feature) and not PLAN_FEATURES["pro"].get(feature):
        required_plan = "pro_plus"
    
    return {
        "feature": feature,
        "has_access": has_access,
        "current_plan": effective_plan,
        "required_plan": required_plan
    }

class UpgradePlanRequest(BaseModel):
    plan: str  # pro or pro_plus
    billing_period: str = "monthly"  # monthly or annual
    native: bool = False  # True si la requête vient de l'app native iOS/Android (deep links)

@api_router.post("/plans/upgrade")
async def upgrade_plan(request: UpgradePlanRequest, http_request: Request):
    """Create Stripe checkout session for plan upgrade"""
    user = await get_user_from_session(http_request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if request.plan not in ["pro", "pro_plus"]:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    if request.billing_period not in ["monthly", "annual"]:
        raise HTTPException(status_code=400, detail="Invalid billing period")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    currency = user_doc.get("currency", "EUR")
    pricing = PLAN_PRICING[request.plan][currency]
    amount = pricing["monthly"] if request.billing_period == "monthly" else pricing["annual"]
    
    import stripe
    stripe.api_key = STRIPE_API_KEY
    
    # Get or create Stripe customer
    # Also validate that the stored customer still exists in Stripe (it may have been purged
    # when rotating API keys or switching Stripe accounts). If not → create a new one.
    stripe_customer_id = user_doc.get("stripe_customer_id")
    if stripe_customer_id:
        try:
            cust = stripe.Customer.retrieve(stripe_customer_id)
            if getattr(cust, "deleted", False):
                stripe_customer_id = None
        except Exception as e:
            logger.warning(f"Stored stripe_customer_id {stripe_customer_id} invalid, will recreate: {e}")
            stripe_customer_id = None

    if not stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.name,
            metadata={"user_id": user.user_id}
        )
        stripe_customer_id = customer.id
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {"stripe_customer_id": stripe_customer_id}}
        )
    
    # Get origin URL
    referer = http_request.headers.get('referer', '')
    if referer:
        from urllib.parse import urlparse
        parsed = urlparse(referer)
        origin_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        origin_url = str(http_request.base_url).rstrip('/')

    # Native app: utilise le deep link io.kolo.app:// pour le retour Safari in-app
    native_scheme = "io.kolo.app://" if request.native else None
    
    # Create or get price
    interval = "month" if request.billing_period == "monthly" else "year"
    price_lookup_key = f"kolo_{request.plan}_{currency.lower()}_{request.billing_period}"
    
    existing_prices = stripe.Price.list(lookup_keys=[price_lookup_key], limit=1)
    
    if existing_prices.data:
        price_id = existing_prices.data[0].id
    else:
        product_name = f"KOLO {request.plan.upper().replace('_', '+')}"
        product = stripe.Product.create(name=product_name)
        
        price = stripe.Price.create(
            product=product.id,
            unit_amount=amount,
            currency=currency.lower(),
            recurring={"interval": interval},
            lookup_key=price_lookup_key
        )
        price_id = price.id
    
    # Create checkout session
    # IMPORTANT Stripe rule: cannot pass both `customer` AND `customer_email`.
    # If we have a stripe_customer_id → use it (email is already attached to that customer).
    # If we don't → fall back to customer_email so Stripe creates a new customer with that email.
    user_locale = user_doc.get("locale", "fr")
    if native_scheme:
        success_url = f"{native_scheme}checkout-success?plan={request.plan}"
        cancel_url = f"{native_scheme}checkout-cancelled"
    else:
        success_url = f"{origin_url}/app?upgrade=success&plan={request.plan}"
        cancel_url = f"{origin_url}/pricing?upgrade=cancelled"

    session_kwargs = {
        "mode": "subscription",
        "payment_method_types": ["card"],
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {
            "user_id": user.user_id,
            "email": user.email,  # CRITICAL: Include email for webhook
            "plan": request.plan,
            "billing_period": request.billing_period,
            "locale": user_locale,
        },
    }
    if stripe_customer_id:
        session_kwargs["customer"] = stripe_customer_id
    else:
        session_kwargs["customer_email"] = user.email

    session = stripe.checkout.Session.create(**session_kwargs)
    
    return {"checkout_url": session.url, "session_id": session.id}

@api_router.post("/plans/set-currency")
async def set_currency(request: Request):
    """Set user's preferred currency"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    currency = body.get("currency", "EUR").upper()
    
    if currency not in ["EUR", "USD", "GBP"]:
        raise HTTPException(status_code=400, detail="Invalid currency. Must be EUR, USD, or GBP")
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"currency": currency, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Currency updated", "currency": currency}

# ==================== INTERACTION HISTORY ENDPOINTS (PRO/PRO+) ====================

class CreateInteractionRequest(BaseModel):
    prospect_id: str
    interaction_type: str  # sms, call, visit, note, suggestion
    content: Optional[str] = None

@api_router.post("/interactions")
async def create_interaction(request: CreateInteractionRequest, http_request: Request):
    """Create an interaction record (PRO/PRO+ feature)"""
    user = await get_user_from_session(http_request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not check_feature_access(user_doc, "interaction_history"):
        raise HTTPException(status_code=403, detail="Cette fonctionnalité nécessite un abonnement PRO ou PRO+")
    
    # Verify prospect belongs to user
    prospect = await db.prospects.find_one({
        "prospect_id": request.prospect_id,
        "user_id": user.user_id
    })
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    interaction = Interaction(
        prospect_id=request.prospect_id,
        user_id=user.user_id,
        interaction_type=request.interaction_type,
        content=request.content
    )
    
    interaction_doc = interaction.model_dump()
    interaction_doc["created_at"] = interaction_doc["created_at"].isoformat()
    await db.interactions.insert_one(interaction_doc)
    
    # Update prospect's last_contact_date
    now = datetime.now(timezone.utc)
    await db.prospects.update_one(
        {"prospect_id": request.prospect_id},
        {"$set": {
            "last_contact_date": now.isoformat(),
            "last_activity_date": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    return {"interaction_id": interaction.interaction_id, "created_at": interaction_doc["created_at"]}

@api_router.get("/interactions/{prospect_id}")
async def get_interactions(prospect_id: str, request: Request):
    """Get interaction history for a prospect (PRO/PRO+ feature)"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not check_feature_access(user_doc, "interaction_history"):
        raise HTTPException(status_code=403, detail="Cette fonctionnalité nécessite un abonnement PRO ou PRO+")
    
    interactions = await db.interactions.find(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"interactions": interactions}

# ==================== HEAT SCORE ENDPOINTS (PRO+) ====================

def calculate_heat_score(prospect: dict) -> int:
    """Calculate heat score for a prospect (PRO+ feature)"""
    score = 100
    now = datetime.now(timezone.utc)
    
    # Days since last contact
    last_contact = prospect.get("last_contact_date")
    if last_contact:
        if isinstance(last_contact, str):
            last_contact = datetime.fromisoformat(last_contact.replace('Z', '+00:00'))
        if last_contact.tzinfo is None:
            last_contact = last_contact.replace(tzinfo=timezone.utc)
        
        days_since = (now - last_contact).days
        if days_since > 7:
            score -= (days_since - 7) * 5
    else:
        # No contact date, use created_at
        created = prospect.get("created_at")
        if created:
            if isinstance(created, str):
                created = datetime.fromisoformat(created.replace('Z', '+00:00'))
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            days_since = (now - created).days
            if days_since > 7:
                score -= (days_since - 7) * 5
    
    # Ensure score doesn't go below 0
    if score < 0:
        score = 0
    
    # Bonus for urgent delay
    if prospect.get("delay") == "urgent":
        score += 30
    
    # Bonus for external activity signal
    if prospect.get("external_activity_signal"):
        score += 20
    
    # Profile completion bonus (max 10 points)
    fields_to_check = ["full_name", "phone", "email", "project_type", "budget_min", "delay", "notes"]
    filled_fields = sum(1 for f in fields_to_check if prospect.get(f))
    score += int((filled_fields / len(fields_to_check)) * 10)
    
    # Cap at 100
    return min(100, max(0, score))

def get_heat_status(score: int) -> str:
    """Get heat status label from score"""
    if score <= 33:
        return "cold"
    elif score <= 66:
        return "warm"
    else:
        return "hot"

@api_router.post("/prospects/{prospect_id}/calculate-heat")
async def calculate_prospect_heat(prospect_id: str, request: Request):
    """Calculate and update heat score for a prospect (PRO+ only)"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not check_feature_access(user_doc, "heat_score"):
        raise HTTPException(status_code=403, detail="Le score de chaleur nécessite un abonnement PRO+")
    
    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    score = calculate_heat_score(prospect)
    status = get_heat_status(score)
    
    await db.prospects.update_one(
        {"prospect_id": prospect_id},
        {"$set": {"heat_score": score, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"heat_score": score, "status": status}

# ==================== ROI DASHBOARD ENDPOINTS (PRO+) ====================

class MarkAsSoldRequest(BaseModel):
    commission_amount: int  # in euros

@api_router.post("/prospects/{prospect_id}/mark-sold")
async def mark_prospect_as_sold(prospect_id: str, request: MarkAsSoldRequest, http_request: Request):
    """Mark a prospect as sold with commission (PRO+ feature)"""
    user = await get_user_from_session(http_request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not check_feature_access(user_doc, "roi_dashboard"):
        raise HTTPException(status_code=403, detail="Le dashboard ROI nécessite un abonnement PRO+")
    
    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    now = datetime.now(timezone.utc)
    
    await db.prospects.update_one(
        {"prospect_id": prospect_id},
        {"$set": {
            "status": "closed_won",
            "commission_amount": request.commission_amount,
            "closed_date": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    # Create interaction record
    interaction = Interaction(
        prospect_id=prospect_id,
        user_id=user.user_id,
        interaction_type="note",
        content=f"Vente conclue - Commission: {request.commission_amount}€"
    )
    interaction_doc = interaction.model_dump()
    interaction_doc["created_at"] = interaction_doc["created_at"].isoformat()
    await db.interactions.insert_one(interaction_doc)
    
    return {"message": "Prospect marqué comme vendu", "commission": request.commission_amount}

@api_router.get("/dashboard/roi")
async def get_roi_dashboard(request: Request):
    """Get ROI dashboard data (PRO+ feature)"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not check_feature_access(user_doc, "roi_dashboard"):
        raise HTTPException(status_code=403, detail="Le dashboard ROI nécessite un abonnement PRO+")
    
    now = datetime.now(timezone.utc)
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get all closed_won prospects this month
    pipeline = [
        {
            "$match": {
                "user_id": user.user_id,
                "status": "closed_won",
                "closed_date": {"$gte": first_of_month.isoformat()}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_revenue": {"$sum": "$commission_amount"},
                "sales_count": {"$sum": 1}
            }
        }
    ]
    
    result = await db.prospects.aggregate(pipeline).to_list(1)
    
    if result:
        total_revenue = result[0].get("total_revenue", 0)
        sales_count = result[0].get("sales_count", 0)
    else:
        total_revenue = 0
        sales_count = 0
    
    average_commission = total_revenue / sales_count if sales_count > 0 else 0
    
    # Calculate ROI multiplier based on PRO+ price
    currency = user_doc.get("currency", "EUR")
    plan_price = PLAN_PRICING.get("pro_plus", {}).get(currency, {}).get("monthly", 2499) / 100
    roi_multiplier = round(total_revenue / plan_price) if plan_price > 0 else 0
    
    return {
        "ca_this_month": total_revenue,
        "sales_this_month": sales_count,
        "average_commission": round(average_commission),
        "roi_multiplier": roi_multiplier,
        "month": now.strftime("%Y-%m")
    }

# ==================== WEEKLY REPORT ENDPOINT (PRO+) ====================

@api_router.post("/reports/weekly")
async def generate_weekly_report(request: Request):
    """Generate and send weekly report email (PRO+ feature)"""
    import resend
    
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not check_feature_access(user_doc, "weekly_report"):
        raise HTTPException(status_code=403, detail="Le rapport hebdomadaire nécessite un abonnement PRO+")
    
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    
    # Get statistics for the week
    # 1. Completed tasks
    completed_tasks = await db.tasks.count_documents({
        "user_id": user.user_id,
        "completed": True,
        "completed_at": {"$gte": week_ago.isoformat()}
    })
    
    # 2. New prospects
    new_prospects = await db.prospects.count_documents({
        "user_id": user.user_id,
        "created_at": {"$gte": week_ago.isoformat()}
    })
    
    # 3. Sales this week
    sales_pipeline = [
        {
            "$match": {
                "user_id": user.user_id,
                "status": "closed_won",
                "closed_date": {"$gte": week_ago.isoformat()}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_revenue": {"$sum": "$commission_amount"},
                "sales_count": {"$sum": 1}
            }
        }
    ]
    
    sales_result = await db.prospects.aggregate(sales_pipeline).to_list(1)
    weekly_revenue = sales_result[0].get("total_revenue", 0) if sales_result else 0
    weekly_sales = sales_result[0].get("sales_count", 0) if sales_result else 0
    
    # 4. Hot prospects (score > 66)
    hot_prospects = await db.prospects.count_documents({
        "user_id": user.user_id,
        "heat_score": {"$gt": 66},
        "status": {"$nin": ["closed_won", "closed_lost", "archived"]}
    })
    
    # Build email HTML
    locale = user_doc.get("locale", "fr")
    user_name = user_doc.get("name", "Agent").split(" ")[0]
    
    email_subjects = {
        "fr": "📊 Votre rapport hebdomadaire KOLO",
        "en": "📊 Your weekly KOLO report",
        "de": "📊 Ihr wöchentlicher KOLO-Bericht",
        "it": "📊 Il tuo report settimanale KOLO"
    }
    
    # Simple, clean email template
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7fa; margin: 0; padding: 20px; }}
            .container {{ max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 24px; }}
            .header {{ text-align: center; margin-bottom: 24px; }}
            .logo {{ font-size: 24px; font-weight: bold; color: #6C63FF; }}
            .greeting {{ font-size: 16px; color: #374151; margin-bottom: 20px; }}
            .stats-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }}
            .stat-card {{ background: #f7f7fa; border-radius: 12px; padding: 16px; text-align: center; }}
            .stat-value {{ font-size: 24px; font-weight: bold; color: #0E0B1E; }}
            .stat-label {{ font-size: 12px; color: #6b7280; margin-top: 4px; }}
            .highlight {{ background: linear-gradient(135deg, rgba(108,99,255,0.1), rgba(147,51,234,0.1)); border: 1px solid rgba(108,99,255,0.3); }}
            .cta {{ display: block; text-align: center; background: linear-gradient(135deg, #4F46E5, #9333EA); color: white; padding: 14px 24px; border-radius: 9999px; text-decoration: none; font-weight: 600; margin-top: 24px; }}
            .footer {{ text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">KOLO</div>
            </div>
            <p class="greeting">{"Bonjour" if locale == "fr" else "Hello"} {user_name} 👋</p>
            <p style="color: #374151; margin-bottom: 20px;">
                {"Voici votre récapitulatif de la semaine :" if locale == "fr" else "Here's your weekly summary:"}
            </p>
            
            <div class="stats-grid">
                <div class="stat-card highlight">
                    <div class="stat-value" style="color: #22c55e;">{weekly_revenue}€</div>
                    <div class="stat-label">{"CA cette semaine" if locale == "fr" else "Revenue this week"}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{weekly_sales}</div>
                    <div class="stat-label">{"Ventes" if locale == "fr" else "Sales"}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{completed_tasks}</div>
                    <div class="stat-label">{"Tâches complétées" if locale == "fr" else "Tasks completed"}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{new_prospects}</div>
                    <div class="stat-label">{"Nouveaux prospects" if locale == "fr" else "New prospects"}</div>
                </div>
            </div>
            
            <div class="stat-card" style="margin-bottom: 16px;">
                <div class="stat-value" style="color: #ef4444;">🔥 {hot_prospects}</div>
                <div class="stat-label">{"Prospects chauds à relancer" if locale == "fr" else "Hot prospects to follow up"}</div>
            </div>
            
            <a href="https://kolo.app/app" class="cta">
                {"Ouvrir KOLO" if locale == "fr" else "Open KOLO"}
            </a>
            
            <div class="footer">
                {"Vous recevez cet email car vous êtes abonné PRO+." if locale == "fr" else "You're receiving this email because you're a PRO+ subscriber."}
            </div>
        </div>
    </body>
    </html>
    """
    
    # Send email via Resend
    resend_api_key = os.environ.get("RESEND_API_KEY")
    sender_email = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    
    if not resend_api_key:
        raise HTTPException(status_code=500, detail="Email service not configured")
    
    try:
        resend.api_key = resend_api_key
        
        params = {
            "from": f"KOLO <{sender_email}>",
            "to": [user.email],
            "subject": email_subjects.get(locale, email_subjects["en"]),
            "html": html_content
        }
        
        email = resend.Emails.send(params)
        
        return {
            "message": "Rapport envoyé",
            "email_id": email.get("id") if isinstance(email, dict) else str(email),
            "stats": {
                "weekly_revenue": weekly_revenue,
                "weekly_sales": weekly_sales,
                "completed_tasks": completed_tasks,
                "new_prospects": new_prospects,
                "hot_prospects": hot_prospects
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to send weekly report: {e}")
        raise HTTPException(status_code=500, detail="Failed to send report email")

# ==================== TRIAL EMAIL CRON JOB ====================

@api_router.post("/cron/trial-emails")
async def send_trial_reminder_emails(request: Request):
    """
    Cron job endpoint to send trial reminder emails.
    Should be called daily. Sends emails for:
    - J+7: 7 days left reminder
    - J+12: 2 days left reminder  
    - J+14: Trial expired notification
    """
    # Simple API key check for cron job security
    api_key = request.headers.get("X-Cron-Key")
    expected_key = os.environ.get("CRON_API_KEY", "kolo_cron_secret_2026")
    
    if api_key != expected_key:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    now = datetime.now(timezone.utc)
    results = {"j7": 0, "j12": 0, "j14": 0, "errors": []}
    
    # Find users with active trials
    trialing_users = await db.users.find({
        "subscription_status": "trialing",
        "trial_ends_at": {"$exists": True},
        "trial_plan": {"$exists": True}
    }, {"_id": 0}).to_list(1000)
    
    for user in trialing_users:
        try:
            trial_end = user.get("trial_ends_at")
            if isinstance(trial_end, str):
                trial_end = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
            if trial_end.tzinfo is None:
                trial_end = trial_end.replace(tzinfo=timezone.utc)
            
            days_left = (trial_end - now).days
            email = user.get("email")
            user_name = user.get("name", "").split(" ")[0] or "Agent"
            trial_plan = user.get("trial_plan", "pro")
            user_locale = user.get("locale", "fr")
            
            # Check if we already sent this reminder today
            last_reminder = user.get("last_trial_reminder")
            if last_reminder:
                if isinstance(last_reminder, str):
                    last_reminder = datetime.fromisoformat(last_reminder.replace('Z', '+00:00'))
                if (now - last_reminder).days < 1:
                    continue  # Already sent a reminder today
            
            email_sent = False
            
            if days_left == 7:
                # J+7 reminder
                await send_trial_reminder_email(email, user_name, 7, trial_plan, locale=user_locale)
                results["j7"] += 1
                email_sent = True
                
            elif days_left == 2:
                # J+12 reminder (2 days left)
                await send_trial_reminder_email(email, user_name, 2, trial_plan, locale=user_locale)
                results["j12"] += 1
                email_sent = True
                
            elif days_left <= 0:
                # J+14 - Trial expired
                await send_trial_expired_email(email, user_name, trial_plan, locale=user_locale)
                results["j14"] += 1
                
                # Downgrade to free
                await db.users.update_one(
                    {"user_id": user.get("user_id")},
                    {"$set": {
                        "subscription_status": "expired",
                        "plan": "free",
                        "updated_at": now.isoformat()
                    }}
                )
                email_sent = True
            
            # Update last reminder date
            if email_sent:
                await db.users.update_one(
                    {"user_id": user.get("user_id")},
                    {"$set": {"last_trial_reminder": now.isoformat()}}
                )
                
        except Exception as e:
            results["errors"].append(f"{user.get('email')}: {str(e)}")
            logger.error(f"Error processing trial email for {user.get('email')}: {e}")
    
    logger.info(f"Trial emails cron completed: {results}")
    return {
        "success": True,
        "emails_sent": {
            "7_days_reminder": results["j7"],
            "2_days_reminder": results["j12"],
            "expired_notification": results["j14"]
        },
        "errors": results["errors"][:10]  # Limit error output
    }

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
async def forgot_password(request: ForgotPasswordRequest, http_request: Request):
    """Send password reset email"""
    import asyncio
    
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
    
    # Get base URL from request
    referer = http_request.headers.get('referer', '')
    if referer:
        from urllib.parse import urlparse
        parsed = urlparse(referer)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        base_url = os.environ.get('FRONTEND_URL', 'https://trykolo.io')
    
    # Send password reset email
    user_name = user_doc.get("name", "").split(" ")[0] or "Utilisateur"
    user_locale = user_doc.get("locale", "fr")
    asyncio.create_task(send_password_reset_email(request.email, user_name, reset_token, base_url, locale=user_locale))
    
    logger.info(f"Password reset email sent to {request.email}")
    
    return {"message": "Si cet email existe, vous recevrez un lien de réinitialisation"}

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
    logger.debug("=== CREATE ACCOUNT CALLED ===")
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
# Rate limit: 10 requests per minute per IP for auth endpoints
@api_router.post("/auth/register")
@limiter.limit("10/minute")
async def register_free_trial(request: Request, register_data: RegisterRequest, response: Response):
    """Register for free 14-day Pro/Pro+ trial without payment"""
    logger.info(f"Free trial registration attempt for: {register_data.email}")
    
    # SECURITY: Validate and sanitize email
    email = register_data.email.lower().strip()
    if not email or not validate_email_format(email):
        raise HTTPException(status_code=400, detail="Format d'email invalide")
    
    # SECURITY: Validate password strength
    if not register_data.password or len(register_data.password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    if len(register_data.password) > 128:
        raise HTTPException(status_code=400, detail="Mot de passe trop long (max 128 caractères)")
    
    # SECURITY: Sanitize name and phone
    name = sanitize_string(register_data.full_name, max_length=100)
    phone = sanitize_string(register_data.phone, max_length=20)
    
    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="Nom invalide (minimum 2 caractères)")
    
    # Determine trial plan (default to 'pro' if not specified or invalid)
    trial_plan = register_data.plan if register_data.plan in ['pro', 'pro_plus'] else 'pro'
    
    # Calculate trial end date (14 days from now)
    trial_ends_at = datetime.now(timezone.utc) + timedelta(days=14)
    
    # Check if email already exists
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Un compte existant utilise déjà cette adresse email")
    
    # Create Stripe customer for trial users
    stripe_customer_id = None
    try:
        import stripe
        stripe.api_key = STRIPE_API_KEY
        
        # Create a Stripe customer
        customer = stripe.Customer.create(
            email=email,
            name=name,
            phone=phone,
            metadata={
                "source": "kolo_registration",
                "initial_plan": trial_plan,
                "trial_status": "14_day_trial",
                "trial_ends_at": trial_ends_at.isoformat()
            }
        )
        stripe_customer_id = customer.id
        logger.info(f"Stripe customer created for new user: {stripe_customer_id}")
    except Exception as e:
        logger.warning(f"Failed to create Stripe customer for trial user {email}: {e}")
        # Continue without Stripe customer - we can create it later
    
    # Create user with trialing status
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "phone": phone,
        "auth_provider": "email",
        "password_hash": hash_password(register_data.password),
        "plan": trial_plan,  # Trial plan (pro or pro_plus)
        "trial_plan": trial_plan,  # Active trial
        "trial_start_date": datetime.now(timezone.utc).isoformat(),
        "subscription_status": "trialing",
        "trial_ends_at": trial_ends_at.isoformat(),
        "stripe_customer_id": stripe_customer_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    logger.info(f"MongoDB: User document inserted for {email}")
    logger.info(f"Free trial account created for {register_data.email} with {trial_plan} plan, trial ends: {trial_ends_at}")
    
    # Send welcome email (background)
    import asyncio
    user_locale = register_data.locale if hasattr(register_data, 'locale') and register_data.locale else "fr"
    asyncio.create_task(send_welcome_email_background(email, name, is_trial=True, trial_plan=trial_plan, locale=user_locale))
    
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
        "email": email,
        "subscription_status": "trialing",
        "trial_ends_at": trial_ends_at.isoformat(),
        "token": session_token
    }

# Background task: Send welcome email after registration
async def send_welcome_email_background(email: str, name: str, is_trial: bool = True, trial_plan: str = "pro", locale: str = "fr"):
    """Send welcome email in background"""
    try:
        await send_welcome_email(email, name, is_trial, trial_plan, locale=locale)
    except Exception as e:
        logger.error(f"Failed to send welcome email to {email}: {e}")

@api_router.post("/auth/register-with-trial")
@limiter.limit("10/minute")
async def register_with_trial(request: Request, register_data: RegisterRequest, response: Response):
    """Register with 14-day PRO trial"""
    from fastapi import BackgroundTasks
    import asyncio
    
    # Use the existing register logic
    result = await register_free_trial(request, register_data, response)
    
    # Send welcome email in background
    user_locale = register_data.locale if hasattr(register_data, 'locale') and register_data.locale else "fr"
    asyncio.create_task(send_welcome_email_background(
        register_data.email, 
        register_data.full_name, 
        is_trial=True, 
        trial_plan="pro",
        locale=user_locale
    ))
    
    return result

# Email/Password Login
# Rate limit: 10 requests per minute per IP for auth endpoints
@api_router.post("/auth/login")
@limiter.limit("10/minute")
async def login_with_password(request: Request, login_data: LoginRequest, response: Response):
    """Login with email and password"""
    logger.info(f"Login attempt for email: {login_data.email}")
    
    # SECURITY: Sanitize email input
    email = login_data.email.lower().strip() if login_data.email else ""
    if not email or not validate_email_format(email):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if not user:
        logger.warning(f"Login failed: User not found for {login_data.email}")
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    if not user.get("password_hash"):
        logger.warning(f"Login failed: No password hash for {login_data.email}")
        raise HTTPException(status_code=401, detail="Veuillez réinitialiser votre mot de passe")
    
    if not verify_password(login_data.password, user["password_hash"]):
        logger.warning(f"Login failed: Invalid password for {login_data.email}")
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    # Allow login for all users (trialing, active, expired, canceled)
    # Access restrictions are handled in the frontend based on subscription status
    logger.info(f"Login successful for {login_data.email}")
    
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

    # Self-heal: if the user is currently NOT on an active subscription locally
    # (status is none/free/expired/canceled), reach out to Stripe to see if a
    # webhook silently failed. Common case: payment succeeded on the client but
    # our webhook endpoint never processed the event (network blip, prod env
    # var missing, etc.). This guarantees the user lands on the app with the
    # correct plan immediately after re-login.
    if subscription_status not in ("active", "trialing"):
        try:
            sync_result = await sync_subscription_from_stripe(user["user_id"], email)
            if sync_result.get("synced") and sync_result.get("subscription_status") in ("active", "trialing"):
                subscription_status = sync_result["subscription_status"]
                trial_ends_at = sync_result.get("trial_ends_at")
                logger.info(
                    f"Login self-heal: recovered subscription for {email} "
                    f"(plan={sync_result.get('plan')}, status={subscription_status})"
                )
        except Exception as e:
            logger.warning(f"Login self-heal sync failed for {email}: {e}")
    
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

# ==================== DIRECT GOOGLE OAUTH (no Emergent intermediary) ====================
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

class GoogleExchangeRequest(BaseModel):
    code: str
    redirect_uri: str
    locale: Optional[str] = "fr"


@api_router.get("/auth/google/client-id")
async def google_oauth_client_id():
    """Expose the public Google OAuth client_id so the frontend can build the
    consent URL without hardcoding anything. Public information by design.
    
    Includes a hardcoded fallback for production safety, since env vars sometimes
    don't propagate. Override via GOOGLE_CAL_CLIENT_ID env var."""
    cid = (os.environ.get("GOOGLE_CAL_CLIENT_ID", "").strip()
           or "344180186708-ek99vc3nhrt6vfrv0v56rorhf8ste0cs.apps.googleusercontent.com")
    return {"client_id": cid, "configured": True}


@api_router.post("/auth/google/exchange")
async def google_oauth_exchange(payload: GoogleExchangeRequest, response: Response):
    """Exchange a Google authorization code (from the frontend `/auth/google` callback)
    for tokens, then find or create the user and return a KOLO session token.

    Frontend flow:
      1) User clicks "Continue with Google" → window.location to Google OAuth consent
         (built with GOOGLE_CAL_CLIENT_ID and redirect_uri = window.location.origin + '/auth/google')
      2) Google redirects to '<origin>/auth/google?code=...&state=...'
      3) The /auth/google React route POSTs {code, redirect_uri} here
      4) We return {token, ...} and the frontend stores it in localStorage."""
    client_id = (os.environ.get("GOOGLE_CAL_CLIENT_ID", "").strip()
                 or "344180186708-ek99vc3nhrt6vfrv0v56rorhf8ste0cs.apps.googleusercontent.com")
    client_secret = (os.environ.get("GOOGLE_CAL_CLIENT_SECRET", "").strip()
                     or "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")
    if not (client_id and client_secret):
        raise HTTPException(status_code=500, detail="Google OAuth not configured on server")

    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            tr = await hc.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": payload.code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": payload.redirect_uri,
                    "grant_type": "authorization_code",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        tokens = tr.json()
        if "access_token" not in tokens:
            logger.warning(f"Google OAuth token exchange failed: {tokens}")
            raise HTTPException(status_code=400, detail="Google OAuth: invalid code or redirect_uri")

        access_token = tokens["access_token"]
        async with httpx.AsyncClient(timeout=15) as hc:
            ur = await hc.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if ur.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google profile")
        profile = ur.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google OAuth exchange error: {e}")
        raise HTTPException(status_code=502, detail="Google OAuth exchange failed")

    email = (profile.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no verified email")

    name = profile.get("name") or profile.get("given_name") or email.split("@")[0]
    picture = profile.get("picture") or ""
    google_sub = profile.get("sub") or ""

    # Find or create user
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        is_super = email in KOLO_SUPER_ADMIN_EMAILS
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "avatar_url": picture,
            "google_sub": google_sub,
            "auth_provider": "google",
            "is_super_admin": bool(is_super),
            "plan": "pro_plus" if is_super else "free",
            "subscription_status": "active" if is_super else "trialing",
            "locale": (payload.locale or "fr"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if not is_super:
            # 7-day trial for new accounts
            user_doc["trial_ends_at"] = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        await db.users.insert_one(user_doc)
        user = user_doc
        logger.info(f"Google OAuth: created new user {email}")
    else:
        # Update Google linkage on existing accounts (idempotent)
        update_fields = {"google_sub": google_sub, "auth_provider": user.get("auth_provider") or "google"}
        if picture and not user.get("avatar_url"):
            update_fields["avatar_url"] = picture
        if name and not user.get("name"):
            update_fields["name"] = name
        # Ensure super admin status if applicable
        if email in KOLO_SUPER_ADMIN_EMAILS and not user.get("is_super_admin"):
            update_fields["is_super_admin"] = True
            update_fields["plan"] = "pro_plus"
            update_fields["subscription_status"] = "active"
        await db.users.update_one({"email": email}, {"$set": update_fields})
        user.update(update_fields)
        logger.info(f"Google OAuth: existing user {email}")

    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "user_id": user["user_id"],
        "email": email,
        "name": name,
        "avatar_url": picture,
        "subscription_status": user.get("subscription_status", "trialing"),
        "trial_ends_at": user.get("trial_ends_at"),
        "is_super_admin": bool(user.get("is_super_admin")),
        "token": session_token,
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
    
    # Best-effort: mirror to calendar (Google/Outlook) — silent on failure
    try:
        await _sync_task_to_calendar(user.user_id, task.task_id, "create", doc)
    except Exception as e:
        logger.warning(f"Calendar sync on create_task failed: {e}")

    return {"task_id": task.task_id, "message": "Task created"}


# ==================== TASK ↔ CALENDAR SYNC HELPERS ====================
async def _sync_task_to_calendar(user_id: str, task_id: str, action: str, task_doc: Optional[dict] = None):
    """Mirror task changes into the user's connected calendars (Google/Outlook).
    Stores the calendar event IDs on the task to allow later updates/deletes.
    All failures are silent (best-effort sync)."""
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0}) or {}
    has_google = bool(user_doc.get("google_calendar_tokens"))
    has_outlook = bool(user_doc.get("outlook_tokens"))
    if not (has_google or has_outlook):
        return  # No calendar connected

    if not task_doc:
        task_doc = await db.tasks.find_one({"task_id": task_id, "user_id": user_id}, {"_id": 0})
        if not task_doc:
            return

    title = (task_doc.get("title") or "Tâche KOLO")[:200]
    desc = task_doc.get("description") or ""
    if task_doc.get("prospect_id"):
        prospect = await db.prospects.find_one({"prospect_id": task_doc["prospect_id"]}, {"_id": 0})
        if prospect:
            desc = f"KOLO • Prospect: {prospect.get('full_name','')} • {prospect.get('phone','')}\n{desc}"
    due = task_doc.get("due_date")
    if not due:
        return
    if isinstance(due, str):
        try:
            start_dt = datetime.fromisoformat(due.replace('Z', '+00:00'))
        except Exception:
            return
    else:
        start_dt = due
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(minutes=30)

    existing_events = (task_doc.get("calendar_events") or {})

    # ----- GOOGLE -----
    if has_google:
        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
            tokens = user_doc["google_calendar_tokens"]
            creds = Credentials(
                token=tokens.get("access_token"),
                refresh_token=tokens.get("refresh_token"),
                token_uri="https://oauth2.googleapis.com/token",
                client_id=os.environ.get("GOOGLE_CAL_CLIENT_ID", "").strip()
                         or "344180186708-ek99vc3nhrt6vfrv0v56rorhf8ste0cs.apps.googleusercontent.com",
                client_secret=os.environ.get("GOOGLE_CAL_CLIENT_SECRET", "").strip()
                              or "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",
                scopes=tokens.get("scopes") or ["https://www.googleapis.com/auth/calendar"],
            )
            service = build("calendar", "v3", credentials=creds, cache_discovery=False)
            ev_body = {
                "summary": "🔵 " + title,
                "description": desc,
                "start": {"dateTime": start_dt.isoformat()},
                "end": {"dateTime": end_dt.isoformat()},
                "extendedProperties": {"private": {"kolo_task_id": task_id}},
            }
            g_event_id = existing_events.get("google")
            if action == "delete" and g_event_id:
                service.events().delete(calendarId="primary", eventId=g_event_id).execute()
                existing_events.pop("google", None)
            elif action == "update" and g_event_id:
                service.events().patch(calendarId="primary", eventId=g_event_id, body=ev_body).execute()
            elif action in ("create", "update"):
                created = service.events().insert(calendarId="primary", body=ev_body).execute()
                existing_events["google"] = created.get("id")
        except Exception as e:
            logger.warning(f"Google task sync failed ({action}): {e}")

    # ----- OUTLOOK -----
    if has_outlook:
        try:
            token = await _ensure_outlook_access_token(user_id)
            ms_body = {
                "subject": "🔵 " + title,
                "body": {"contentType": "HTML", "content": desc.replace("\n", "<br>")},
                "start": {"dateTime": start_dt.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "UTC"},
                "end": {"dateTime": end_dt.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "UTC"},
                "singleValueExtendedProperties": [{
                    "id": "String {a8b9c0d1-1234-5678-9abc-def012345678} Name kolo_task_id",
                    "value": task_id
                }]
            }
            ms_event_id = existing_events.get("outlook")
            async with httpx.AsyncClient(timeout=12) as hc:
                if action == "delete" and ms_event_id:
                    await hc.delete(f"https://graph.microsoft.com/v1.0/me/events/{ms_event_id}",
                                    headers={"Authorization": f"Bearer {token}"})
                    existing_events.pop("outlook", None)
                elif action == "update" and ms_event_id:
                    await hc.patch(f"https://graph.microsoft.com/v1.0/me/events/{ms_event_id}",
                                   headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                                   json=ms_body)
                elif action in ("create", "update"):
                    r = await hc.post("https://graph.microsoft.com/v1.0/me/events",
                                      headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                                      json=ms_body)
                    if r.status_code in (200, 201):
                        existing_events["outlook"] = r.json().get("id")
        except Exception as e:
            logger.warning(f"Outlook task sync failed ({action}): {e}")

    # Persist the calendar event IDs back on the task
    if action != "delete":
        await db.tasks.update_one({"task_id": task_id, "user_id": user_id},
                                  {"$set": {"calendar_events": existing_events}})
    else:
        await db.tasks.update_one({"task_id": task_id, "user_id": user_id},
                                  {"$set": {"calendar_events": existing_events}})

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
    
    # Sync to calendar: delete event if completed, else update
    try:
        if update_data.completed is True:
            await _sync_task_to_calendar(user.user_id, task_id, "delete", task)
        else:
            updated_task = await db.tasks.find_one({"task_id": task_id, "user_id": user.user_id}, {"_id": 0})
            if updated_task:
                await _sync_task_to_calendar(user.user_id, task_id, "update", updated_task)
    except Exception as e:
        logger.warning(f"Calendar sync on update_task failed: {e}")
    
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
    
    # Remove from calendar first
    try:
        await _sync_task_to_calendar(user.user_id, task_id, "delete", task)
    except Exception as e:
        logger.warning(f"Calendar sync on delete_task failed: {e}")

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
    
    # Update user streak
    await update_user_streak(user.user_id)
    
    # Remove from calendar (task done)
    try:
        await _sync_task_to_calendar(user.user_id, task_id, "delete", task)
    except Exception as e:
        logger.warning(f"Calendar sync on complete_task failed: {e}")
    
    return {"message": "Task completed"}

# ==================== AI TASK SUGGESTIONS ====================

@api_router.get("/tasks/ai-suggestions")
async def get_ai_task_suggestions(request: Request):
    """Get AI-powered task suggestions - ALWAYS returns proactive suggestions"""
    user = await require_active_subscription(request)
    
    # Get language from Accept-Language header
    accept_lang = request.headers.get("accept-language", "fr").lower()
    if accept_lang.startswith("fr"):
        lang = "fr"
    elif accept_lang.startswith("de"):
        lang = "de"
    elif accept_lang.startswith("it"):
        lang = "it"
    else:
        lang = "en"
    
    # Get all active prospects
    all_prospects = await db.prospects.find(
        {
            "user_id": user.user_id,
            "status": {"$nin": ["closed", "lost"]}
        },
        {"_id": 0, "prospect_id": 1, "full_name": 1, "phone": 1, "email": 1, "status": 1, "source": 1, "notes": 1, "last_activity_date": 1, "created_at": 1}
    ).to_list(100)
    
    # Get ALL upcoming tasks (not just today)
    upcoming_tasks = await db.tasks.find(
        {
            "user_id": user.user_id,
            "completed": False
        },
        {"_id": 0, "prospect_id": 1, "task_type": 1, "due_date": 1, "title": 1}
    ).to_list(200)
    
    # Group tasks by prospect
    tasks_by_prospect = {}
    for t in upcoming_tasks:
        pid = t.get("prospect_id")
        if pid:
            if pid not in tasks_by_prospect:
                tasks_by_prospect[pid] = []
            tasks_by_prospect[pid].append(t)
    
    # Find prospects WITHOUT any upcoming task - these need suggestions
    prospects_needing_action = []
    prospects_with_tasks = []
    
    for p in all_prospects:
        prospect_id = p.get("prospect_id")
        
        # Calculate days since last activity
        last_activity = p.get("last_activity_date") or p.get("created_at")
        days_since_activity = 0
        if last_activity:
            if isinstance(last_activity, str):
                last_activity_date = datetime.fromisoformat(last_activity.replace('Z', '+00:00'))
            else:
                last_activity_date = last_activity
            if last_activity_date.tzinfo is None:
                last_activity_date = last_activity_date.replace(tzinfo=timezone.utc)
            days_since_activity = (datetime.now(timezone.utc) - last_activity_date).days
        
        prospect_data = {
            **p, 
            "days_since_activity": days_since_activity,
            "upcoming_tasks": tasks_by_prospect.get(prospect_id, [])
        }
        
        if prospect_id in tasks_by_prospect:
            prospects_with_tasks.append(prospect_data)
        else:
            prospects_needing_action.append(prospect_data)
    
    # Sort by days since activity (most inactive first)
    prospects_needing_action.sort(key=lambda x: x["days_since_activity"], reverse=True)
    
    # Build AI context with language-aware prompts
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import json
        import re
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Language-specific system messages
        system_messages = {
            "fr": """Coach commercial IMMOBILIER. Suggère la prochaine action selon l'étape du cycle de vente:
- Nouveau prospect → Appel découverte / qualifier le projet
- Projet qualifié → Proposer des biens correspondants
- Biens proposés → Organiser une visite
- Visite faite → Recueillir les impressions / ajuster la recherche
- Intéressé → Accompagner vers l'offre
- Inactif → Relancer avec une nouveauté du marché

JSON uniquement: {"suggestions": [{"prospect_id": "ID_EXACT", "prospect_name": "...", "task_title": "...", "task_type": "call|sms|email|visit", "reason": "..."}]}
Utilise EXACTEMENT les prospect_id fournis. Pour prospection: prospect_id=null. Max 3, concis.""",
            
            "en": """Real estate SALES coach. Suggest the next action based on the sales cycle stage:
- New prospect → Discovery call / qualify the project
- Qualified project → Propose matching properties
- Properties proposed → Schedule a viewing
- Viewing done → Gather feedback / adjust search
- Interested → Guide towards offer
- Inactive → Follow up with market news

JSON only: {"suggestions": [{"prospect_id": "EXACT_ID", "prospect_name": "...", "task_title": "...", "task_type": "call|sms|email|visit", "reason": "..."}]}
Use EXACTLY the prospect_ids provided. For prospecting: prospect_id=null. Max 3, concise.""",
            
            "de": """IMMOBILIEN-Verkaufscoach. Schlage die nächste Aktion basierend auf der Verkaufsphase vor:
- Neuer Interessent → Kennenlerngespräch / Projekt qualifizieren
- Qualifiziertes Projekt → Passende Immobilien vorschlagen
- Immobilien vorgeschlagen → Besichtigung vereinbaren
- Besichtigung erfolgt → Feedback einholen / Suche anpassen
- Interessiert → Zum Angebot begleiten
- Inaktiv → Mit Marktneuigkeiten nachfassen

Nur JSON: {"suggestions": [{"prospect_id": "EXAKTE_ID", "prospect_name": "...", "task_title": "...", "task_type": "call|sms|email|visit", "reason": "..."}]}
Verwende GENAU die angegebenen prospect_ids. Für Akquise: prospect_id=null. Max 3, prägnant.""",
            
            "it": """Coach commerciale IMMOBILIARE. Suggerisci la prossima azione in base alla fase del ciclo di vendita:
- Nuovo prospect → Chiamata conoscitiva / qualificare il progetto
- Progetto qualificato → Proporre immobili corrispondenti
- Immobili proposti → Organizzare una visita
- Visita effettuata → Raccogliere feedback / adeguare la ricerca
- Interessato → Accompagnare verso l'offerta
- Inattivo → Ricontattare con novità di mercato

Solo JSON: {"suggestions": [{"prospect_id": "ID_ESATTO", "prospect_name": "...", "task_title": "...", "task_type": "call|sms|email|visit", "reason": "..."}]}
Usa ESATTAMENTE i prospect_id forniti. Per prospezione: prospect_id=null. Max 3, conciso."""
        }
        
        system_msg = system_messages.get(lang, system_messages["en"])
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"task_suggestions_{user.user_id}_{datetime.now().timestamp()}",
            system_message=system_msg
        ).with_model("openai", "gpt-4.1-nano")
        
        if prospects_needing_action:
            # Prospects without tasks - suggest next actions
            target = prospects_needing_action[:5]
            
            prompts_needing_action = {
                "fr": lambda ctx: f"""PROSPECTS SANS TÂCHE PLANIFIÉE - anticipe leur prochaine action:

{ctx}

Suggère la prochaine étape logique pour faire avancer chaque projet. Pense à l'étape suivante dans le cycle de vente immobilier.""",
                
                "en": lambda ctx: f"""PROSPECTS WITHOUT SCHEDULED TASK - anticipate their next action:

{ctx}

Suggest the next logical step to move each project forward. Think about the next step in the real estate sales cycle.""",
                
                "de": lambda ctx: f"""INTERESSENTEN OHNE GEPLANTE AUFGABE - antizipiere ihre nächste Aktion:

{ctx}

Schlage den nächsten logischen Schritt vor, um jedes Projekt voranzubringen. Denke an den nächsten Schritt im Immobilien-Verkaufszyklus.""",
                
                "it": lambda ctx: f"""PROSPECT SENZA ATTIVITÀ PIANIFICATA - anticipa la loro prossima azione:

{ctx}

Suggerisci il prossimo passo logico per far avanzare ogni progetto. Pensa alla prossima fase del ciclo di vendita immobiliare."""
            }
            
            context_templates = {
                "fr": lambda p: f"- {p['full_name']} (ID: {p['prospect_id']}): {p['days_since_activity']}j depuis dernier contact, statut: {p.get('status', 'new')}, projet: {p.get('notes', 'non précisé')[:100] if p.get('notes') else 'non précisé'}",
                "en": lambda p: f"- {p['full_name']} (ID: {p['prospect_id']}): {p['days_since_activity']} days since last contact, status: {p.get('status', 'new')}, project: {p.get('notes', 'not specified')[:100] if p.get('notes') else 'not specified'}",
                "de": lambda p: f"- {p['full_name']} (ID: {p['prospect_id']}): {p['days_since_activity']} Tage seit letztem Kontakt, Status: {p.get('status', 'new')}, Projekt: {p.get('notes', 'nicht angegeben')[:100] if p.get('notes') else 'nicht angegeben'}",
                "it": lambda p: f"- {p['full_name']} (ID: {p['prospect_id']}): {p['days_since_activity']} giorni dall'ultimo contatto, stato: {p.get('status', 'new')}, progetto: {p.get('notes', 'non specificato')[:100] if p.get('notes') else 'non specificato'}"
            }
            
            ctx_template = context_templates.get(lang, context_templates["en"])
            prospects_context = "\n".join([ctx_template(p) for p in target])
            prompt_template = prompts_needing_action.get(lang, prompts_needing_action["en"])
            prompt = prompt_template(prospects_context)

        elif prospects_with_tasks:
            # All have tasks - suggest future actions for existing prospects OR prospection
            target = prospects_with_tasks[:3]
            
            prompts_with_tasks = {
                "fr": lambda ctx: f"""Tous les prospects ont des tâches planifiées. Anticipe les PROCHAINES étapes:

{ctx}

Suggère des actions FUTURES pour ces prospects (après leurs tâches actuelles) OU une action de prospection.
IMPORTANT: Utilise les IDs exacts fournis ci-dessus, ou prospect_id=null pour prospection générique.""",
                
                "en": lambda ctx: f"""All prospects have scheduled tasks. Anticipate the NEXT steps:

{ctx}

Suggest FUTURE actions for these prospects (after their current tasks) OR a prospecting action.
IMPORTANT: Use the exact IDs provided above, or prospect_id=null for generic prospecting.""",
                
                "de": lambda ctx: f"""Alle Interessenten haben geplante Aufgaben. Antizipiere die NÄCHSTEN Schritte:

{ctx}

Schlage ZUKÜNFTIGE Aktionen für diese Interessenten vor (nach ihren aktuellen Aufgaben) ODER eine Akquise-Aktion.
WICHTIG: Verwende die exakten IDs oben, oder prospect_id=null für allgemeine Akquise.""",
                
                "it": lambda ctx: f"""Tutti i prospect hanno attività pianificate. Anticipa i PROSSIMI passi:

{ctx}

Suggerisci azioni FUTURE per questi prospect (dopo le loro attività attuali) O un'azione di prospezione.
IMPORTANTE: Usa gli ID esatti forniti sopra, o prospect_id=null per prospezione generica."""
            }
            
            task_templates = {
                "fr": lambda p: f"- {p['full_name']} (ID: {p['prospect_id']}): {len(p['upcoming_tasks'])} tâche(s) planifiée(s), projet: {p.get('notes', '?')[:60] if p.get('notes') else '?'}",
                "en": lambda p: f"- {p['full_name']} (ID: {p['prospect_id']}): {len(p['upcoming_tasks'])} scheduled task(s), project: {p.get('notes', '?')[:60] if p.get('notes') else '?'}",
                "de": lambda p: f"- {p['full_name']} (ID: {p['prospect_id']}): {len(p['upcoming_tasks'])} geplante Aufgabe(n), Projekt: {p.get('notes', '?')[:60] if p.get('notes') else '?'}",
                "it": lambda p: f"- {p['full_name']} (ID: {p['prospect_id']}): {len(p['upcoming_tasks'])} attività pianificata/e, progetto: {p.get('notes', '?')[:60] if p.get('notes') else '?'}"
            }
            
            task_template = task_templates.get(lang, task_templates["en"])
            tasks_context = "\n".join([task_template(p) for p in target])
            prompt_template = prompts_with_tasks.get(lang, prompts_with_tasks["en"])
            prompt = prompt_template(tasks_context)

        else:
            # No prospects
            no_prospect_prompts = {
                "fr": """Aucun prospect actif. Suggère des actions de prospection:
1. Prospection téléphonique (pige immo)
2. Prospection terrain
3. Réseaux sociaux / annonces""",
                "en": """No active prospects. Suggest prospecting actions:
1. Phone prospecting (real estate leads)
2. Field prospecting
3. Social media / ads""",
                "de": """Keine aktiven Interessenten. Schlage Akquise-Aktionen vor:
1. Telefonakquise (Immobilien-Leads)
2. Vor-Ort-Akquise
3. Social Media / Anzeigen""",
                "it": """Nessun prospect attivo. Suggerisci azioni di prospezione:
1. Prospezione telefonica (lead immobiliari)
2. Prospezione sul campo
3. Social media / annunci"""
            }
            prompt = no_prospect_prompts.get(lang, no_prospect_prompts["en"])
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        response_clean = response.strip()
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_clean)
        if json_match:
            response_clean = json_match.group(1).strip()
        if not response_clean.startswith('{'):
            json_obj_match = re.search(r'\{[\s\S]*\}', response_clean)
            if json_obj_match:
                response_clean = json_obj_match.group(0)
        
        suggestions_data = json.loads(response_clean)
        suggestions = suggestions_data.get("suggestions", [])
        
        return {
            "suggestions": suggestions,
            "stats": {
                "needing_action": len(prospects_needing_action),
                "with_tasks": len(prospects_with_tasks),
                "total": len(all_prospects)
            }
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"AI response parsing error: {e}")
        # Fallback - always return something
        fallback = []
        
        fallback_texts = {
            "fr": {"follow_up": "Suivre", "plan_next": "Planifier la prochaine étape", "prospecting": "Prospection", "session": "Session de prospection", "grow": "Développer votre portefeuille"},
            "en": {"follow_up": "Follow up with", "plan_next": "Plan the next step", "prospecting": "Prospecting", "session": "Prospecting session", "grow": "Grow your portfolio"},
            "de": {"follow_up": "Nachfassen bei", "plan_next": "Nächsten Schritt planen", "prospecting": "Akquise", "session": "Akquise-Sitzung", "grow": "Portfolio erweitern"},
            "it": {"follow_up": "Seguire", "plan_next": "Pianificare il prossimo passo", "prospecting": "Prospezione", "session": "Sessione di prospezione", "grow": "Espandere il portafoglio"}
        }
        texts = fallback_texts.get(lang, fallback_texts["en"])
        
        if prospects_needing_action:
            for p in prospects_needing_action[:2]:
                fallback.append({
                    "prospect_id": p["prospect_id"],
                    "prospect_name": p["full_name"],
                    "task_title": f"{texts['follow_up']} {p['full_name']}",
                    "task_type": "call",
                    "reason": texts["plan_next"],
                    "priority": "medium"
                })
        if not fallback:
            fallback.append({
                "prospect_id": None,
                "prospect_name": texts["prospecting"],
                "task_title": texts["session"],
                "task_type": "prospection",
                "reason": texts["grow"],
                "priority": "medium"
            })
        return {"suggestions": fallback}
        
    except Exception as e:
        logger.error(f"AI suggestion error: {e}")
        
        error_texts = {
            "fr": {"prospecting": "Prospection", "new_clients": "Prospection nouveaux clients", "grow": "Développez votre portefeuille"},
            "en": {"prospecting": "Prospecting", "new_clients": "New client prospecting", "grow": "Grow your portfolio"},
            "de": {"prospecting": "Akquise", "new_clients": "Neukundenakquise", "grow": "Erweitern Sie Ihr Portfolio"},
            "it": {"prospecting": "Prospezione", "new_clients": "Prospezione nuovi clienti", "grow": "Espandi il tuo portafoglio"}
        }
        texts = error_texts.get(lang, error_texts["en"])
        
        return {
            "suggestions": [{
                "prospect_id": None,
                "prospect_name": texts["prospecting"],
                "task_title": texts["new_clients"],
                "task_type": "prospection",
                "reason": texts["grow"],
                "priority": "medium"
            }]
        }

@api_router.post("/tasks/ai-suggestions/accept")
async def accept_ai_suggestion(request: Request):
    """Create a task from an AI suggestion"""
    user = await require_active_subscription(request)
    
    body = await request.json()
    prospect_id = body.get("prospect_id")  # Can be null for generic tasks
    task_title = body.get("task_title")
    task_type = body.get("task_type", "follow_up")
    
    if not task_title:
        raise HTTPException(status_code=400, detail="task_title required")
    
    # If prospect_id provided, verify it belongs to user
    if prospect_id:
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
        "prospect_id": prospect_id,  # Can be null for generic tasks
        "title": task_title,
        "task_type": task_type,
        "due_date": due_date.isoformat(),
        "completed": False,
        "auto_generated": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tasks.insert_one(task_doc)
    
    # Update prospect next task only if prospect_id provided
    if prospect_id:
        await update_prospect_next_task(prospect_id, user.user_id)
    
    # Mirror to calendar (best-effort)
    try:
        await _sync_task_to_calendar(user.user_id, task_id, "create", task_doc)
    except Exception as e:
        logger.warning(f"Calendar sync on AI task accept failed: {e}")
    
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
@limiter.limit("100/minute")
async def create_prospect(request: Request, prospect_data: CreateProspectRequest):
    """Create a new prospect and auto-create follow-up task"""
    user = await require_active_subscription(request)
    
    # Check prospect limit for FREE plan
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    prospect_limit = await check_prospect_limit(user.user_id, user_doc)
    if not prospect_limit["can_add"]:
        raise HTTPException(
            status_code=403, 
            detail=f"Vous avez atteint la limite de {prospect_limit['max']} prospects. Passez en PRO pour des prospects illimités."
        )
    
    # SECURITY: Validate and sanitize all inputs
    full_name = sanitize_string(prospect_data.full_name, max_length=100)
    if not full_name or len(full_name) < 2:
        raise HTTPException(status_code=400, detail="Nom invalide (minimum 2 caractères)")
    
    phone = sanitize_string(prospect_data.phone, max_length=20)
    email = prospect_data.email.lower().strip() if prospect_data.email else ""
    if email and not validate_email_format(email):
        raise HTTPException(status_code=400, detail="Format d'email invalide")
    
    notes = sanitize_string(prospect_data.notes or "", max_length=2000)
    source = sanitize_string(prospect_data.source or "manual", max_length=50)
    
    # Validate status against allowed values
    allowed_statuses = ['nouveau', 'contacte', 'qualifie', 'offre', 'signe', 'new', 'in_progress', 'closed', 'lost', 'closed_won', 'closed_lost', 'archived']
    status = prospect_data.status if prospect_data.status in allowed_statuses else 'nouveau'
    
    # Validate project_type
    project_type = prospect_data.project_type
    if project_type and project_type not in ['buyer', 'seller', 'renter']:
        project_type = None
    
    # Validate delay
    delay = prospect_data.delay
    if delay and delay not in ['urgent', '3_6_months', '6_plus_months']:
        delay = None
    
    now = datetime.now(timezone.utc)
    
    prospect = Prospect(
        user_id=user.user_id,
        full_name=full_name,
        phone=phone,
        email=email,
        source=source,
        status=status,
        notes=notes,
        last_activity_date=now,
        last_contact_date=now,
        # New fields
        project_type=project_type,
        budget_min=prospect_data.budget_min,
        budget_max=prospect_data.budget_max,
        budget_undefined=prospect_data.budget_undefined,
        delay=delay
    )
    
    doc = prospect.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    doc['last_activity_date'] = doc['last_activity_date'].isoformat() if doc['last_activity_date'] else None
    doc['last_contact_date'] = doc['last_contact_date'].isoformat() if doc['last_contact_date'] else None
    await db.prospects.insert_one(doc)
    
    # Calculate heat score for PRO+ users
    if check_feature_access(user_doc, "heat_score"):
        score = calculate_heat_score(doc)
        await db.prospects.update_one(
            {"prospect_id": prospect.prospect_id},
            {"$set": {"heat_score": score}}
        )
    
    return {"prospect_id": prospect.prospect_id, "message": "Prospect created"}

@api_router.post("/prospects/batch")
async def create_prospects_batch(request: Request):
    """Import multiple prospects at once (for contact import)"""
    user = await require_active_subscription(request)
    
    body = await request.json()
    prospects_data = body.get("prospects", [])
    
    if not prospects_data:
        raise HTTPException(status_code=400, detail="No prospects provided")
    
    now = datetime.now(timezone.utc)
    created_ids = []
    
    for p in prospects_data:
        prospect = Prospect(
            user_id=user.user_id,
            full_name=p.get("full_name", ""),
            phone=p.get("phone", ""),
            email=p.get("email", ""),
            source=p.get("source", "import"),
            status="nouveau",
            notes=p.get("notes", ""),
            last_activity_date=now
        )
        
        doc = prospect.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        doc['last_activity_date'] = doc['last_activity_date'].isoformat()
        await db.prospects.insert_one(doc)
        created_ids.append(prospect.prospect_id)
    
    return {"created": len(created_ids), "prospect_ids": created_ids}

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
# Rate limit: 30 requests per minute per user for AI generation endpoints
@api_router.post("/prospects/{prospect_id}/generate-message")
@limiter.limit("30/minute")
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
    except Exception:
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


# Generate AI SMS message with full project context (PRO feature)
class GenerateSMSRequest(BaseModel):
    prospect_id: str
    context: Optional[str] = None
    locale: str = "fr"

@api_router.get("/ai/suggest-for-prospect/{prospect_id}")
@limiter.limit("20/minute")
async def get_ai_suggestion_for_prospect(prospect_id: str, request: Request):
    """Get AI-powered contextual task suggestion for a specific prospect (uses Emergent LLM)."""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    # Compute days since last contact
    last_contact = prospect.get("last_contact_date")
    days_since_contact = None
    if last_contact:
        try:
            last_dt = datetime.fromisoformat(str(last_contact).replace('Z', '+00:00'))
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            days_since_contact = (datetime.now(timezone.utc) - last_dt).days
        except (ValueError, TypeError):
            days_since_contact = None

    prospect_name = prospect.get("full_name", prospect.get("name", "Client"))
    status = prospect.get("status", "nouveau")
    score = prospect.get("score") or "—"
    project_type = prospect.get("project_type") or "—"
    budget_min = prospect.get("budget_min")
    budget_max = prospect.get("budget_max")
    delay = prospect.get("delay") or "—"
    notes = (prospect.get("notes") or "")[:300]

    # Recent comms (calls + WhatsApp) to give context to the LLM
    recent_calls = await db.call_logs.find(
        {"prospect_id": prospect_id, "user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(3)
    recent_wa = await db.whatsapp_messages.find(
        {"prospect_id": prospect_id, "user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(3)

    def _fmt_call(c):
        bits = [f"appel ({c.get('outcome', '?')}, {c.get('duration_sec', 0)}s)"]
        if c.get("notes"):
            bits.append(f"notes: {c['notes'][:120]}")
        return " — ".join(bits)

    def _fmt_wa(m):
        return f"whatsapp {m.get('direction', 'out')}: {(m.get('body') or '')[:120]}"

    history_lines = [_fmt_call(c) for c in recent_calls] + [_fmt_wa(m) for m in recent_wa]
    history_block = "\n".join(f"- {h}" for h in history_lines) if history_lines else "Aucun échange enregistré."

    # Resolve locale
    accept_lang = request.headers.get("Accept-Language", "fr").lower()
    if accept_lang.startswith("fr"):
        lang = "fr"
    elif accept_lang.startswith("de"):
        lang = "de"
    elif accept_lang.startswith("it"):
        lang = "it"
    else:
        lang = "en"

    fallback_reasons = {
        "fr": f"Reprendre contact avec {prospect_name} pour relancer le projet.",
        "en": f"Reach out to {prospect_name} to keep the deal moving.",
        "de": f"Kontakt mit {prospect_name} aufnehmen, um das Projekt voranzubringen.",
        "it": f"Contattare {prospect_name} per far avanzare il progetto.",
    }

    # Try LLM-powered suggestion
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise RuntimeError("EMERGENT_LLM_KEY missing")

        system_msgs = {
            "fr": (
                "Tu es un coach commercial immobilier expert. Réponds en JSON STRICT uniquement, sans aucun texte avant ou après. "
                "Schema: {\"task_type\":\"call|sms|whatsapp|visit|note|email\",\"task_title\":\"≤8 mots\",\"reason\":\"1 phrase concrète et personnalisée ≤160 caractères\",\"priority\":\"low|medium|high\"}. "
                "Sois concret, mentionne un détail spécifique du prospect (statut, score, jours sans contact, dernier échange). Pas de formules génériques."
            ),
            "en": (
                "You are an expert real-estate sales coach. Reply with STRICT JSON only, no prose before or after. "
                "Schema: {\"task_type\":\"call|sms|whatsapp|visit|note|email\",\"task_title\":\"≤8 words\",\"reason\":\"1 concrete personalized sentence ≤160 chars\",\"priority\":\"low|medium|high\"}. "
                "Be concrete, cite a specific detail of the prospect (status, score, days since contact, last interaction). Avoid generic advice."
            ),
            "de": (
                "Du bist Immobilien-Verkaufscoach. Antworte STRENG nur in JSON, kein Text davor/danach. "
                "Schema: {\"task_type\":\"call|sms|whatsapp|visit|note|email\",\"task_title\":\"≤8 Wörter\",\"reason\":\"1 konkreter personalisierter Satz ≤160 Zeichen\",\"priority\":\"low|medium|high\"}."
            ),
            "it": (
                "Sei un coach commerciale immobiliare. Rispondi SOLO in JSON STRETTO, nessun testo prima o dopo. "
                "Schema: {\"task_type\":\"call|sms|whatsapp|visit|note|email\",\"task_title\":\"≤8 parole\",\"reason\":\"1 frase concreta personalizzata ≤160 caratteri\",\"priority\":\"low|medium|high\"}."
            ),
        }

        context_block = (
            f"Prospect : {prospect_name}\n"
            f"Statut : {status}\n"
            f"Score chaleur : {score}\n"
            f"Type de projet : {project_type}\n"
            f"Budget : {budget_min or '?'} - {budget_max or '?'}\n"
            f"Délai : {delay}\n"
            f"Jours sans contact : {days_since_contact if days_since_contact is not None else 'jamais contacté'}\n"
            f"Notes : {notes or '—'}\n"
            f"Échanges récents :\n{history_block}"
        )

        chat = LlmChat(
            api_key=api_key,
            session_id=f"prospect_suggest_{user.user_id}_{prospect_id}",
            system_message=system_msgs.get(lang, system_msgs["en"]),
        ).with_model("openai", "gpt-4.1-nano")

        msg = UserMessage(text=context_block)
        raw = await chat.send_message(msg)
        # Parse JSON
        import json as _json, re as _re
        m = _re.search(r"\{.*\}", raw, _re.S)
        if not m:
            raise ValueError("LLM returned no JSON")
        data = _json.loads(m.group(0))

        task_type = (data.get("task_type") or "call").strip().lower()
        if task_type not in {"call", "sms", "whatsapp", "visit", "note", "email"}:
            task_type = "call"
        # Map legacy
        if task_type == "call":
            legacy = "appel"
        elif task_type == "sms":
            legacy = "sms"
        else:
            legacy = task_type

        return {
            "suggestion": {
                "prospect_id": prospect_id,
                "prospect_name": prospect_name,
                "task_type": legacy,
                "task_type_normalized": task_type,
                "task_title": (data.get("task_title") or "Prochaine action")[:80],
                "reason": (data.get("reason") or fallback_reasons[lang])[:200],
                "priority": (data.get("priority") or "medium").lower(),
                "ai_powered": True,
            }
        }
    except Exception as e:
        logger.warning(f"AI suggestion fallback for {prospect_id}: {e}")

    # Fallback: deterministic rule-based suggestion
    if days_since_contact is None or days_since_contact >= 14:
        task_type, priority = "appel", "high"
    elif days_since_contact >= 7:
        task_type, priority = "sms", "medium"
    elif status in {"nouveau", "new"}:
        task_type, priority = "appel", "high"
    else:
        task_type, priority = "sms", "medium"

    return {
        "suggestion": {
            "prospect_id": prospect_id,
            "prospect_name": prospect_name,
            "task_type": task_type,
            "task_title": "Prochaine action" if lang == "fr" else "Next action",
            "reason": fallback_reasons[lang],
            "priority": priority,
            "ai_powered": False,
        }
    }


@api_router.post("/ai/generate-sms")
@limiter.limit("30/minute")
async def generate_ai_sms(request: GenerateSMSRequest, http_request: Request):
    """Generate an AI-powered SMS message with full project context (PRO feature)"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    user = await require_active_subscription(http_request)
    
    # Check if user has SMS feature (PRO)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not check_feature_access(user_doc, "sms_one_click"):
        raise HTTPException(status_code=403, detail="Cette fonctionnalité nécessite un abonnement PRO")
    
    # Get prospect details
    prospect = await db.prospects.find_one(
        {"prospect_id": request.prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Get user name for signature
        user_data = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "name": 1})
        agent_name = user_data.get("name", "Votre agent") if user_data else "Votre agent"
        
        # Language-specific system message
        lang_prompts = {
            "fr": f"Agent immobilier. SMS court (<160 car), professionnel et chaleureux. Signé: {agent_name}. Texte seul, pas de guillemets.",
            "en": f"Real estate agent. Short SMS (<160 chars), professional and friendly. Signed: {agent_name}. Text only, no quotes.",
            "de": f"Immobilienmakler. Kurze SMS (<160 Zeichen), professionell und freundlich. Unterschrieben: {agent_name}. Nur Text, keine Anführungszeichen.",
            "it": f"Agente immobiliare. SMS breve (<160 car), professionale e cordiale. Firmato: {agent_name}. Solo testo, senza virgolette."
        }
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"sms_gen_{user.user_id}_{datetime.now().timestamp()}",
            system_message=lang_prompts.get(request.locale, lang_prompts["fr"])
        ).with_model("openai", "gpt-4.1-nano")
        
        # Build rich context with project details
        project_type_labels = {
            "buyer": {"fr": "Acheteur", "en": "Buyer", "de": "Käufer", "it": "Acquirente"},
            "seller": {"fr": "Vendeur", "en": "Seller", "de": "Verkäufer", "it": "Venditore"},
            "renter": {"fr": "Locataire", "en": "Renter", "de": "Mieter", "it": "Locatario"}
        }
        
        delay_labels = {
            "urgent": {"fr": "Urgent (< 3 mois)", "en": "Urgent (< 3 months)", "de": "Dringend (< 3 Monate)", "it": "Urgente (< 3 mesi)"},
            "3_6_months": {"fr": "3-6 mois", "en": "3-6 months", "de": "3-6 Monate", "it": "3-6 mesi"},
            "6_plus_months": {"fr": "+ 6 mois", "en": "+ 6 months", "de": "+ 6 Monate", "it": "+ 6 mesi"}
        }
        
        project_type = prospect.get("project_type")
        delay = prospect.get("delay")
        budget_min = prospect.get("budget_min")
        budget_max = prospect.get("budget_max")
        budget_undefined = prospect.get("budget_undefined", False)
        
        project_type_str = project_type_labels.get(project_type, {}).get(request.locale, project_type) if project_type else "Non défini"
        delay_str = delay_labels.get(delay, {}).get(request.locale, delay) if delay else "Non défini"
        budget_str = "À définir" if budget_undefined else f"{budget_min}k€ - {budget_max}k€" if budget_min and budget_max else "Non défini"
        
        prospect_info = f"""
Prospect: {prospect.get('full_name', 'Client')}
Type de projet: {project_type_str}
Budget: {budget_str}
Délai: {delay_str}
Statut: {prospect.get('status', 'nouveau')}
Notes: {prospect.get('notes', 'Aucune note')[:200] if prospect.get('notes') else 'Aucune note'}
Contexte additionnel: {request.context or 'Relance générale'}
"""
        
        prompt_templates = {
            "fr": f"Génère un SMS personnalisé pour ce prospect. Tiens compte du type de projet et du délai pour adapter le ton:\n{prospect_info}",
            "en": f"Generate a personalized SMS for this prospect. Consider the project type and timeline to adapt the tone:\n{prospect_info}",
            "de": f"Generieren Sie eine personalisierte SMS für diesen Interessenten. Berücksichtigen Sie den Projekttyp und den Zeitrahmen:\n{prospect_info}",
            "it": f"Genera un SMS personalizzato per questo potenziale cliente. Considera il tipo di progetto e le tempistiche:\n{prospect_info}"
        }
        
        user_message = UserMessage(
            text=prompt_templates.get(request.locale, prompt_templates["fr"])
        )
        
        response = await chat.send_message(user_message)
        message = response.strip()
        
        # Remove quotes if present
        if message.startswith('"') and message.endswith('"'):
            message = message[1:-1]
        if message.startswith("'") and message.endswith("'"):
            message = message[1:-1]
        
        return {"message": message, "prospect_name": prospect.get('full_name', '')}
        
    except Exception as e:
        logger.error(f"AI SMS generation error: {e}")
        # Fallback message based on locale
        first_name = prospect.get('full_name', '').split(' ')[0]
        fallback_messages = {
            "fr": f"Bonjour {first_name}, j'espère que vous allez bien. Je me permets de vous recontacter concernant votre projet immobilier. Avez-vous un moment pour en discuter ? {agent_name}",
            "en": f"Hi {first_name}, I hope you're doing well. I wanted to follow up on your property project. Do you have a moment to discuss? {agent_name}",
            "de": f"Hallo {first_name}, ich hoffe es geht Ihnen gut. Ich wollte mich zu Ihrem Immobilienprojekt melden. Haben Sie einen Moment Zeit? {agent_name}",
            "it": f"Ciao {first_name}, spero che stia bene. Volevo ricontattarla per il suo progetto immobiliare. Ha un momento per parlarne? {agent_name}"
        }
        return {"message": fallback_messages.get(request.locale, fallback_messages["fr"]), "prospect_name": prospect.get('full_name', '')}


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
    except Exception:
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


@api_router.post("/notifications/register-device")
async def register_device_token(request: Request):
    """Register native device token (APNs for iOS, FCM for Android)"""
    user = await get_user_from_session(request)
    data = await request.json()
    
    device_token = data.get("device_token")
    platform = data.get("platform", "ios")  # 'ios' or 'android'
    
    if not device_token:
        raise HTTPException(status_code=400, detail="device_token required")
    
    user_id = user.user_id if user else data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User authentication required")
    
    # Store device token
    await db.device_tokens.update_one(
        {"user_id": user_id, "platform": platform},
        {"$set": {
            "user_id": user_id,
            "device_token": device_token,
            "platform": platform,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    logger.info(f"Device token registered for user {user_id} on {platform}")
    return {"message": "Device token registered", "platform": platform}


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




# ============================================================================
# PHASE 2 — MARQUE BLANCHE / MULTI-TENANT
# Organizations (B2B real estate networks) with roles: org_admin, org_agent.
# Theming (logo + primary_color). Team management. KPIs. Dataroom (light).
# ============================================================================

class OrgCreatePayload(BaseModel):
    name: str
    slug: Optional[str] = None
    primary_color: Optional[str] = "#8B5CF6"
    logo_url: Optional[str] = None


class OrgUpdatePayload(BaseModel):
    name: Optional[str] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None


class OrgInvitePayload(BaseModel):
    email: str
    role: Optional[str] = "org_agent"  # org_agent or org_admin


def _slugify(s: str) -> str:
    import re
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (s or "").lower()).strip("-")
    return s[:48] or f"org-{uuid.uuid4().hex[:8]}"


async def _require_org_member(request: Request, org_id: str, admin_only: bool = False):
    """Return (user, org_doc) if the user belongs to the org. 403 otherwise.
    Super admins always pass."""
    user = await require_auth(request)
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if is_super_admin_email(user.email):
        return user, org
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    if user_doc.get("org_id") != org_id:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    if admin_only and user_doc.get("org_role") != "org_admin":
        raise HTTPException(status_code=403, detail="Only org admins can perform this action")
    return user, org


@api_router.post("/orgs")
async def create_org(payload: OrgCreatePayload, request: Request):
    """Create a new organization. The creator becomes the first org_admin."""
    user = await require_auth(request)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    if user_doc.get("org_id") and not is_super_admin_email(user.email):
        raise HTTPException(status_code=400, detail="User already belongs to an organization")
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    org_id = f"org_{uuid.uuid4().hex[:14]}"
    slug = _slugify(payload.slug or payload.name)
    # Ensure unique slug
    if await db.organizations.find_one({"slug": slug}, {"_id": 0}):
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    org_doc = {
        "org_id": org_id,
        "name": payload.name.strip(),
        "slug": slug,
        "primary_color": payload.primary_color or "#8B5CF6",
        "logo_url": payload.logo_url,
        "owner_user_id": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "plan": "trial",
    }
    await db.organizations.insert_one(org_doc)
    # Super admin doesn't get its org_id overwritten (it manages all orgs)
    if not is_super_admin_email(user.email):
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {"org_id": org_id, "org_role": "org_admin", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    org_doc.pop("_id", None)
    return {"ok": True, "org": org_doc}


# ==================== WHITE-LABEL AI WIZARD ====================

class WhiteLabelScanPayload(BaseModel):
    website_url: str
    locale: Optional[str] = "fr"


@api_router.post("/admin/whitelabel/scan")
async def whitelabel_scan(payload: WhiteLabelScanPayload, request: Request):
    """Super-admin only. Scrapes a website and extracts brand assets via LLM:
    colors, logo URL, font family, sector, suggested KOLO config."""
    user = await require_auth(request)
    if not is_super_admin_email(user.email):
        raise HTTPException(status_code=403, detail="Super admin only")

    url = payload.website_url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    # Fetch HTML
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (compatible; KOLO-Bot/1.0)"
        }) as hc:
            r = await hc.get(url)
        if r.status_code >= 400:
            raise HTTPException(status_code=400, detail=f"Site inaccessible (HTTP {r.status_code})")
        html = r.text[:120000]  # cap to fit LLM context
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Scraping error: {str(e)[:200]}")

    # Extract basic signals via regex (fast, free) before LLM
    import re as _re
    title_match = _re.search(r"<title[^>]*>([^<]+)</title>", html, _re.I)
    site_title = (title_match.group(1).strip() if title_match else "")[:120]

    # Find favicon / logo candidates
    logo_candidates = []
    for m in _re.finditer(r'<(?:link|img)[^>]*(?:rel|class|id|alt|src)=["\']([^"\']*(?:logo|brand|favicon)[^"\']*)["\'][^>]*(?:href|src)=["\']([^"\']+)["\']', html, _re.I):
        logo_candidates.append(m.group(2))
    for m in _re.finditer(r'<link[^>]*rel=["\'](?:icon|shortcut icon|apple-touch-icon)["\'][^>]*href=["\']([^"\']+)["\']', html, _re.I):
        logo_candidates.append(m.group(1))

    def _absolutize(u, base):
        if u.startswith("http"): return u
        if u.startswith("//"): return "https:" + u
        if u.startswith("/"):
            from urllib.parse import urlparse
            p = urlparse(base); return f"{p.scheme}://{p.netloc}{u}"
        return base.rstrip("/") + "/" + u
    logo_candidates = [_absolutize(c, url) for c in logo_candidates[:5]]

    # Hex colors in inline styles + style tags
    colors = list(set(_re.findall(r"#([0-9a-fA-F]{6})", html)))[:30]
    # Strip pure black/white/grays
    def _luma(hx):
        r_, g_, b_ = int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16)
        return 0.2126*r_ + 0.7152*g_ + 0.0722*b_
    branded = [c for c in colors if 25 < _luma(c) < 230]
    # Quick text snippet for sector inference
    text_strip = _re.sub(r"<[^>]+>", " ", html)
    text_strip = _re.sub(r"\s+", " ", text_strip)[:4000]

    # Ask LLM to synthesize the brand identity
    suggestion = {
        "name": site_title.split("|")[0].split("-")[0].strip() or "Organisation",
        "primary_color": ("#" + branded[0]) if branded else "#8B5CF6",
        "secondary_color": ("#" + branded[1]) if len(branded) > 1 else "#EC4899",
        "logo_url": logo_candidates[0] if logo_candidates else None,
        "sector": "immobilier",
        "font_family": "Inter",
        "tagline": "",
        "pitch": "",
    }

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if api_key:
            system_msg = (
                "Tu es un expert en branding. Analyse le HTML/texte fourni et renvoie un JSON STRICT (rien avant/après) "
                "décrivant l'identité visuelle du site pour configurer une plateforme KOLO en marque blanche. "
                "Schema: {"
                "\"name\":\"nom court de la marque ≤50 char\","
                "\"primary_color\":\"#RRGGBB hex de la couleur dominante de la marque\","
                "\"secondary_color\":\"#RRGGBB hex couleur d'accent\","
                "\"sector\":\"immobilier|finance|saas|conseil|... 1-2 mots\","
                "\"font_family\":\"nom de la font principale détectée ou 'Inter'\","
                "\"tagline\":\"slogan/phrase d'accroche ≤80 char\","
                "\"pitch\":\"description courte de l'activité ≤200 char\","
                "\"agent_count_estimate\":\"approximatif si trouvé sur le site, sinon null\""
                "}. Sois précis et concret."
            )
            context = (
                f"URL: {url}\n"
                f"Title: {site_title}\n"
                f"Hex colors trouvés: {', '.join('#' + c for c in branded[:10])}\n"
                f"Logo candidates: {logo_candidates[:3]}\n"
                f"Extrait texte:\n{text_strip[:2000]}"
            )
            chat = LlmChat(api_key=api_key, session_id=f"wl_scan_{uuid.uuid4().hex[:8]}", system_message=system_msg).with_model("openai", "gpt-4.1-mini")
            raw = await chat.send_message(UserMessage(text=context))
            m = _re.search(r"\{.*\}", raw, _re.S)
            if m:
                import json as _j
                data = _j.loads(m.group(0))
                # merge LLM output
                for k in ("name", "primary_color", "secondary_color", "sector", "font_family", "tagline", "pitch"):
                    if data.get(k):
                        suggestion[k] = data[k]
                if data.get("agent_count_estimate"):
                    suggestion["agent_count_estimate"] = data["agent_count_estimate"]
                # Keep our scraped logo if LLM didn't provide one
                if data.get("logo_url"):
                    suggestion["logo_url"] = data["logo_url"]
    except Exception as e:
        logger.warning(f"WhiteLabel LLM enrich failed: {e}")

    return {
        "website_url": url,
        "suggestion": suggestion,
        "raw": {
            "title": site_title,
            "colors_found": ["#" + c for c in branded[:8]],
            "logo_candidates": logo_candidates[:5],
        }
    }


class WhiteLabelCreatePayload(BaseModel):
    name: str
    slug: Optional[str] = None
    primary_color: Optional[str] = "#8B5CF6"
    secondary_color: Optional[str] = "#EC4899"
    logo_url: Optional[str] = None
    sector: Optional[str] = "immobilier"
    font_family: Optional[str] = "Inter"
    tagline: Optional[str] = None
    pitch: Optional[str] = None
    website_url: Optional[str] = None
    agent_count_estimate: Optional[str] = None
    contact_email: Optional[str] = None
    seats: Optional[int] = 50
    plan: Optional[str] = "enterprise"


@api_router.post("/admin/whitelabel/create")
async def whitelabel_create(payload: WhiteLabelCreatePayload, request: Request):
    """Super-admin only. Creates an organization with full white-label config."""
    user = await require_auth(request)
    if not is_super_admin_email(user.email):
        raise HTTPException(status_code=403, detail="Super admin only")
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    org_id = f"org_{uuid.uuid4().hex[:14]}"
    slug = _slugify(payload.slug or payload.name)
    if await db.organizations.find_one({"slug": slug}, {"_id": 0}):
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    org_doc = {
        "org_id": org_id,
        "name": payload.name.strip(),
        "slug": slug,
        "primary_color": payload.primary_color or "#8B5CF6",
        "secondary_color": payload.secondary_color or "#EC4899",
        "logo_url": payload.logo_url,
        "sector": payload.sector or "immobilier",
        "font_family": payload.font_family or "Inter",
        "tagline": payload.tagline,
        "pitch": payload.pitch,
        "website_url": payload.website_url,
        "agent_count_estimate": payload.agent_count_estimate,
        "contact_email": payload.contact_email,
        "seats": payload.seats or 50,
        "plan": payload.plan or "enterprise",
        "owner_user_id": user.user_id,
        "white_label": True,
        "created_by": user.email,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.organizations.insert_one(org_doc)
    org_doc.pop("_id", None)

    # Generate an invite link for the org admin
    invite_token = uuid.uuid4().hex
    await db.org_invites.insert_one({
        "token": invite_token,
        "org_id": org_id,
        "email": payload.contact_email or "",
        "role": "org_admin",
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
    })
    base_url = os.environ.get("FRONTEND_URL", "").strip().rstrip("/") or "https://trykolo.io"

    return {
        "ok": True,
        "org": org_doc,
        "invite_url": f"{base_url}/join-org/{invite_token}",
        "admin_url": f"{base_url}/org",
    }


@api_router.get("/admin/whitelabel/list")
async def whitelabel_list(request: Request):
    user = await require_auth(request)
    if not is_super_admin_email(user.email):
        raise HTTPException(status_code=403, detail="Super admin only")
    orgs = await db.organizations.find({"white_label": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"count": len(orgs), "orgs": orgs}


@api_router.get("/orgs/me")
async def get_my_org(request: Request):
    user = await require_auth(request)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    org_id = user_doc.get("org_id")
    if not org_id:
        return {"org": None, "role": None}
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    return {"org": org, "role": user_doc.get("org_role")}


@api_router.patch("/orgs/{org_id}")
async def update_org(org_id: str, payload: OrgUpdatePayload, request: Request):
    await _require_org_member(request, org_id, admin_only=True)
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.name is not None: update["name"] = payload.name.strip()
    if payload.primary_color is not None: update["primary_color"] = payload.primary_color
    if payload.logo_url is not None: update["logo_url"] = payload.logo_url
    await db.organizations.update_one({"org_id": org_id}, {"$set": update})
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    return {"ok": True, "org": org}


@api_router.get("/orgs/{org_id}/members")
async def list_org_members(org_id: str, request: Request):
    await _require_org_member(request, org_id, admin_only=False)
    cursor = db.users.find(
        {"org_id": org_id},
        {"_id": 0, "user_id": 1, "email": 1, "name": 1, "org_role": 1, "phone": 1, "created_at": 1, "subscription_status": 1},
    ).sort("created_at", 1)
    members = await cursor.to_list(length=500)
    return {"count": len(members), "members": members}


@api_router.post("/orgs/{org_id}/invite")
async def invite_to_org(org_id: str, payload: OrgInvitePayload, request: Request):
    user, org = await _require_org_member(request, org_id, admin_only=True)
    email = (payload.email or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email")
    role = payload.role if payload.role in ("org_admin", "org_agent") else "org_agent"

    token = secrets.token_urlsafe(24)
    invite = {
        "invite_id": f"inv_{uuid.uuid4().hex[:14]}",
        "org_id": org_id,
        "email": email,
        "role": role,
        "token": token,
        "invited_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "accepted": False,
    }
    await db.org_invites.insert_one(invite)
    invite.pop("_id", None)
    return {"ok": True, "invite": invite, "accept_url": f"/org/join/{token}"}


@api_router.post("/orgs/accept-invite/{token}")
async def accept_org_invite(token: str, request: Request):
    user = await require_auth(request)
    invite = await db.org_invites.find_one({"token": token, "accepted": False}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found or already accepted")
    expires_at = invite.get("expires_at")
    if expires_at:
        ed = datetime.fromisoformat(expires_at) if isinstance(expires_at, str) else expires_at
        if ed.tzinfo is None: ed = ed.replace(tzinfo=timezone.utc)
        if ed < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invitation expired")

    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    if user_doc.get("org_id") and user_doc.get("org_id") != invite["org_id"]:
        raise HTTPException(status_code=400, detail="User already belongs to a different organization")

    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"org_id": invite["org_id"], "org_role": invite["role"], "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.org_invites.update_one(
        {"token": token},
        {"$set": {"accepted": True, "accepted_at": datetime.now(timezone.utc).isoformat(), "accepted_by": user.user_id}}
    )
    org = await db.organizations.find_one({"org_id": invite["org_id"]}, {"_id": 0})
    return {"ok": True, "org": org, "role": invite["role"]}


@api_router.delete("/orgs/{org_id}/members/{user_id}")
async def remove_org_member(org_id: str, user_id: str, request: Request):
    _, org = await _require_org_member(request, org_id, admin_only=True)
    if org.get("owner_user_id") == user_id:
        raise HTTPException(status_code=400, detail="Cannot remove the organization owner")
    await db.users.update_one(
        {"user_id": user_id, "org_id": org_id},
        {"$set": {"org_id": None, "org_role": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}


@api_router.get("/orgs/{org_id}/kpis")
async def org_kpis(org_id: str, request: Request):
    """KPIs for the team: prospects, calls, conversions, per-agent breakdown."""
    await _require_org_member(request, org_id, admin_only=False)
    members = await db.users.find({"org_id": org_id}, {"_id": 0, "user_id": 1, "email": 1, "name": 1}).to_list(length=500)
    member_ids = [m["user_id"] for m in members]

    total_prospects = await db.prospects.count_documents({"user_id": {"$in": member_ids}}) if member_ids else 0
    chaud = await db.prospects.count_documents({"user_id": {"$in": member_ids}, "score": "chaud"}) if member_ids else 0
    tiede = await db.prospects.count_documents({"user_id": {"$in": member_ids}, "score": "tiede"}) if member_ids else 0
    froid = await db.prospects.count_documents({"user_id": {"$in": member_ids}, "score": "froid"}) if member_ids else 0
    sold = await db.prospects.count_documents({"user_id": {"$in": member_ids}, "stage": "vendu"}) if member_ids else 0
    completed_tasks = await db.tasks.count_documents({"user_id": {"$in": member_ids}, "completed": True}) if member_ids else 0
    calls_count = await db.call_logs.count_documents({"user_id": {"$in": member_ids}}) if member_ids else 0

    # Per-agent breakdown
    breakdown = []
    for m in members:
        uid = m["user_id"]
        breakdown.append({
            "user_id": uid,
            "name": m.get("name") or m.get("email"),
            "email": m.get("email"),
            "prospects": await db.prospects.count_documents({"user_id": uid}),
            "chaud": await db.prospects.count_documents({"user_id": uid, "score": "chaud"}),
            "sold": await db.prospects.count_documents({"user_id": uid, "stage": "vendu"}),
            "completed_tasks": await db.tasks.count_documents({"user_id": uid, "completed": True}),
            "calls": await db.call_logs.count_documents({"user_id": uid}),
        })

    return {
        "total_prospects": total_prospects,
        "by_score": {"chaud": chaud, "tiede": tiede, "froid": froid},
        "sold": sold,
        "completed_tasks": completed_tasks,
        "calls": calls_count,
        "members_count": len(members),
        "breakdown": sorted(breakdown, key=lambda x: x["prospects"], reverse=True),
    }


@api_router.post("/orgs/{org_id}/prospects/reassign")
async def reassign_prospects(org_id: str, request: Request):
    """Reassign prospects from one team member to another. Body: {from_user_id, to_user_id, prospect_ids?:[]}"""
    _, org = await _require_org_member(request, org_id, admin_only=True)
    body = await request.json()
    from_user = body.get("from_user_id")
    to_user = body.get("to_user_id")
    prospect_ids = body.get("prospect_ids") or []

    if not from_user or not to_user:
        raise HTTPException(status_code=400, detail="from_user_id and to_user_id required")

    # Both must be in the same org
    members = await db.users.find({"user_id": {"$in": [from_user, to_user]}, "org_id": org_id}, {"_id": 0}).to_list(length=2)
    if len(members) != 2:
        raise HTTPException(status_code=400, detail="Both users must belong to this organization")

    q = {"user_id": from_user}
    if prospect_ids: q["prospect_id"] = {"$in": prospect_ids}

    result = await db.prospects.update_many(q, {"$set": {"user_id": to_user, "updated_at": datetime.now(timezone.utc).isoformat()}})
    await db.tasks.update_many(q, {"$set": {"user_id": to_user}})
    return {"ok": True, "reassigned": result.modified_count}


class DataroomEntry(BaseModel):
    title: str
    url: str
    description: Optional[str] = None
    category: Optional[str] = "general"


@api_router.post("/orgs/{org_id}/dataroom")
async def add_dataroom_entry(org_id: str, payload: DataroomEntry, request: Request):
    user, _ = await _require_org_member(request, org_id, admin_only=True)
    entry = {
        "entry_id": f"dr_{uuid.uuid4().hex[:14]}",
        "org_id": org_id,
        "title": payload.title.strip(),
        "url": payload.url.strip(),
        "description": (payload.description or "").strip(),
        "category": payload.category or "general",
        "uploaded_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.dataroom.insert_one(entry)
    entry.pop("_id", None)
    return {"ok": True, "entry": entry}


@api_router.get("/orgs/{org_id}/dataroom")
async def list_dataroom(org_id: str, request: Request):
    await _require_org_member(request, org_id)
    cursor = db.dataroom.find({"org_id": org_id}, {"_id": 0}).sort("created_at", -1)
    entries = await cursor.to_list(length=500)
    return {"count": len(entries), "entries": entries}


@api_router.delete("/orgs/{org_id}/dataroom/{entry_id}")
async def delete_dataroom_entry(org_id: str, entry_id: str, request: Request):
    await _require_org_member(request, org_id, admin_only=True)
    result = await db.dataroom.delete_one({"entry_id": entry_id, "org_id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"ok": True}


# Super admin can list / create orgs from the KOLO admin panel
@api_router.get("/admin/orgs")
async def admin_list_orgs(request: Request, limit: int = 200):
    await require_super_admin(request)
    cursor = db.organizations.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    orgs = await cursor.to_list(length=limit)
    # Add member counts
    for o in orgs:
        o["members_count"] = await db.users.count_documents({"org_id": o["org_id"]})
    return {"count": len(orgs), "orgs": orgs}


# ============================================================================
# PHASE 3 — INTÉGRATIONS (Twilio Voice + Whisper, WhatsApp, Google Calendar)
# Tous les endpoints existent même sans clés. Si les clés manquent, ils renvoient
# une 400 explicite. Cela permet à l'UI d'afficher "Connecter <service>".
# ============================================================================

def _integration_status(env_keys: list, optional: list = None) -> dict:
    """Return {configured: bool, missing: [...]} given env keys to check."""
    missing = [k for k in env_keys if not os.environ.get(k, "").strip()]
    return {"configured": len(missing) == 0, "missing": missing}


@api_router.get("/integrations/status")
async def integrations_status(request: Request):
    await require_auth(request)
    # Native dialer + WhatsApp deep links are ALWAYS available (use the user's own phone).
    # Twilio Voice + WhatsApp Sender remain as optional "advanced" modes (e.g. Verified
    # Caller ID, Sandbox testing, automated outbound) but are no longer the default.
    twilio_voice_keys = ["TWILIO_ACCOUNT_SID", "TWILIO_FROM_NUMBER"]
    twilio_auth_ok = bool(
        os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
        and (
            (os.environ.get("TWILIO_API_KEY_SID", "").strip() and os.environ.get("TWILIO_API_KEY_SECRET", "").strip())
            or os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
        )
    )
    voice_ok = twilio_auth_ok and bool(os.environ.get("TWILIO_FROM_NUMBER", "").strip())
    wa_ok = twilio_auth_ok and bool(os.environ.get("TWILIO_WHATSAPP_FROM", "").strip())
    return {
        # Always-on native modes (uses the agent's own phone/WhatsApp)
        "native_call": {"configured": True, "mode": "tel-link", "missing": []},
        "native_whatsapp": {"configured": True, "mode": "wa.me-link", "missing": []},
        "whisper": _integration_status(["EMERGENT_LLM_KEY"]),
        # Optional advanced Twilio modes (recording, automated outbound)
        "twilio_voice_advanced": {"configured": voice_ok, "missing": [k for k in ["TWILIO_FROM_NUMBER"] if not os.environ.get(k, "").strip()], "note": "Optionnel — recording auto + transcription. Sinon, mode natif."},
        "twilio_whatsapp_advanced": {"configured": wa_ok, "missing": [k for k in ["TWILIO_WHATSAPP_FROM"] if not os.environ.get(k, "").strip()], "note": "Optionnel — pour réception webhook. Sinon, mode natif."},
        # Calendar OAuth integrations
        "google_calendar": _integration_status(["GOOGLE_CAL_CLIENT_ID", "GOOGLE_CAL_CLIENT_SECRET"]),
        "outlook_calendar": _integration_status(["MS_CLIENT_ID", "MS_CLIENT_SECRET"]),
        "apple_calendar": {"configured": False, "missing": ["APPLE_CALDAV"], "note": "Bientôt disponible"},
    }


# ---- NATIVE DIALER & WHATSAPP (user's own phone, no Twilio cost) ---- #

class CallLogPayload(BaseModel):
    to: str
    prospect_id: Optional[str] = None
    duration_sec: Optional[int] = 0
    notes: Optional[str] = None
    outcome: Optional[str] = "completed"  # completed / no-answer / voicemail / busy


@api_router.post("/integrations/calls/log")
async def log_native_call(payload: CallLogPayload, request: Request):
    """Log a call made via the user's own phone (tel: deeplink).
    The frontend opens tel:+XXX, then calls this to record the activity."""
    user = await require_auth(request)
    log = {
        "call_id": f"call_{uuid.uuid4().hex[:14]}",
        "user_id": user.user_id,
        "prospect_id": payload.prospect_id,
        "to": payload.to,
        "from": "native",
        "duration_sec": payload.duration_sec or 0,
        "notes": (payload.notes or "").strip(),
        "outcome": payload.outcome,
        "status": "logged",
        "provider": "native",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.call_logs.insert_one(log)
    log.pop("_id", None)
    return {"ok": True, "call": log}


class WhatsAppLogPayload(BaseModel):
    to: str
    body: str
    prospect_id: Optional[str] = None


@api_router.post("/integrations/whatsapp/log")
async def log_native_whatsapp(payload: WhatsAppLogPayload, request: Request):
    """Log a WhatsApp message sent via the user's own WhatsApp (wa.me deeplink).
    The frontend opens https://wa.me/XXX?text=..., then calls this to record the activity."""
    user = await require_auth(request)
    log = {
        "wa_message_id": f"wa_{uuid.uuid4().hex[:14]}",
        "direction": "outbound",
        "user_id": user.user_id,
        "prospect_id": payload.prospect_id,
        "to": payload.to,
        "from": "native",
        "body": payload.body,
        "status": "sent",
        "provider": "native",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.whatsapp_messages.insert_one(log)
    log.pop("_id", None)
    return {"ok": True, "message": log}


@api_router.post("/integrations/transcribe-upload")
async def transcribe_upload(request: Request, file: UploadFile = File(...), prospect_id: Optional[str] = Form(None), call_id: Optional[str] = Form(None)):
    """Manually upload an audio file (mp3/m4a/wav) to get a Whisper transcript.
    Used when an agent records a call on their phone and wants the transcript."""
    user = await require_auth(request)
    key = os.environ.get("EMERGENT_LLM_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="EMERGENT_LLM_KEY missing")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 25 MB)")

    import tempfile
    suffix = "." + (file.filename or "audio.mp3").rsplit(".", 1)[-1].lower()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        stt = OpenAISpeechToText(api_key=key)
        with open(tmp_path, "rb") as af:
            resp = await stt.transcribe(file=af, model="whisper-1", response_format="json", language="fr")
        transcript_text = getattr(resp, "text", "") or str(resp)
        os.unlink(tmp_path)

        # Save transcript next to the call_log if call_id given
        if call_id:
            await db.call_logs.update_one(
                {"call_id": call_id, "user_id": user.user_id},
                {"$set": {"transcript": transcript_text, "transcript_at": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            # Standalone transcript
            await db.transcripts.insert_one({
                "transcript_id": f"tr_{uuid.uuid4().hex[:14]}",
                "user_id": user.user_id,
                "prospect_id": prospect_id,
                "filename": file.filename,
                "text": transcript_text,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        return {"ok": True, "transcript": transcript_text, "char_count": len(transcript_text)}
    except HTTPException:
        raise
    except Exception as e:
        try: os.unlink(tmp_path)
        except Exception: pass
        logger.error(f"Whisper upload transcribe: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)[:200]}")


# ---------- TWILIO VOICE ---------- #

class TwilioCallRequest(BaseModel):
    to: str
    prospect_id: Optional[str] = None


def _twilio_client():
    """Return an authenticated Twilio client using API Key SID + Secret (preferred)
    or Account SID + Auth Token (fallback). Returns None if no credentials."""
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    api_key = os.environ.get("TWILIO_API_KEY_SID", "").strip()
    api_secret = os.environ.get("TWILIO_API_KEY_SECRET", "").strip()
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    if not account_sid:
        return None
    from twilio.rest import Client
    if api_key and api_secret:
        return Client(api_key, api_secret, account_sid)
    if auth_token:
        return Client(account_sid, auth_token)
    return None


@api_router.post("/integrations/twilio/call")
async def twilio_initiate_call(payload: TwilioCallRequest, request: Request):
    """Initiate a click-to-call via Twilio Voice."""
    user = await require_auth(request)
    from_number = os.environ.get("TWILIO_FROM_NUMBER", "").strip()
    client = _twilio_client()
    if not (client and from_number):
        raise HTTPException(status_code=400, detail="Twilio non configuré — vérifie TWILIO_ACCOUNT_SID + (API_KEY/SECRET ou AUTH_TOKEN) + TWILIO_FROM_NUMBER")

    try:
        base_url = str(request.base_url).rstrip("/")
        recording_callback = f"{base_url}/api/integrations/twilio/recording-webhook?call_initiator={user.user_id}"
        twiml = f'<Response><Say language="fr-FR">Connexion en cours via KOLO.</Say><Dial record="record-from-answer" recordingStatusCallback="{recording_callback}">{payload.to}</Dial></Response>'
        call = client.calls.create(to=payload.to, from_=from_number, twiml=twiml, record=True)
        log = {
            "call_id": f"call_{uuid.uuid4().hex[:14]}",
            "twilio_sid": call.sid,
            "user_id": user.user_id,
            "prospect_id": payload.prospect_id,
            "to": payload.to,
            "from": from_number,
            "status": "initiated",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.call_logs.insert_one(log)
        log.pop("_id", None)
        return {"ok": True, "call": log}
    except Exception as e:
        logger.error(f"Twilio call error: {e}")
        raise HTTPException(status_code=500, detail=f"Twilio error: {str(e)[:200]}")


@api_router.post("/integrations/twilio/recording-webhook")
async def twilio_recording_webhook(request: Request, call_initiator: Optional[str] = None):
    """Twilio fires this when a recording is ready. We store the URL + trigger Whisper async."""
    form = await request.form()
    recording_url = form.get("RecordingUrl")
    recording_sid = form.get("RecordingSid")
    call_sid = form.get("CallSid")
    duration = form.get("RecordingDuration")

    if not recording_url:
        return {"ok": False, "error": "no recording"}

    await db.call_logs.update_one(
        {"twilio_sid": call_sid},
        {"$set": {
            "recording_url": recording_url + ".mp3",
            "recording_sid": recording_sid,
            "duration_sec": int(duration or 0),
            "status": "recorded",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"ok": True}


@api_router.post("/integrations/whisper/transcribe")
async def whisper_transcribe(request: Request):
    """Transcribe an mp3 (URL or call_id). Body: {call_id} or {url}."""
    user = await require_auth(request)
    body = await request.json()
    url = body.get("url")
    call_id = body.get("call_id")

    if call_id and not url:
        log = await db.call_logs.find_one({"call_id": call_id, "user_id": user.user_id}, {"_id": 0})
        if not log:
            raise HTTPException(status_code=404, detail="Call not found")
        url = log.get("recording_url")
        if not url:
            raise HTTPException(status_code=400, detail="Recording not ready yet")

    if not url:
        raise HTTPException(status_code=400, detail="url or call_id required")

    key = os.environ.get("EMERGENT_LLM_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="EMERGENT_LLM_KEY missing")

    try:
        import tempfile
        async with httpx.AsyncClient(timeout=60) as hc:
            # For Twilio recordings, need basic auth
            twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
            twilio_tok = os.environ.get("TWILIO_AUTH_TOKEN", "")
            auth = (twilio_sid, twilio_tok) if "twilio.com" in url else None
            r = await hc.get(url, auth=auth)
            r.raise_for_status()
            audio_bytes = r.content

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        from emergentintegrations.llm.openai import OpenAISpeechToText
        stt = OpenAISpeechToText(api_key=key)
        with open(tmp_path, "rb") as af:
            resp = await stt.transcribe(file=af, model="whisper-1", response_format="json", language="fr")
        transcript_text = getattr(resp, "text", "") or str(resp)
        os.unlink(tmp_path)

        if call_id:
            await db.call_logs.update_one({"call_id": call_id}, {"$set": {"transcript": transcript_text, "transcript_at": datetime.now(timezone.utc).isoformat()}})
        return {"ok": True, "transcript": transcript_text}
    except Exception as e:
        logger.error(f"Whisper transcribe error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)[:200]}")


@api_router.get("/integrations/calls")
async def list_calls(request: Request, limit: int = 50):
    user = await require_auth(request)
    cursor = db.call_logs.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).limit(limit)
    calls = await cursor.to_list(length=limit)
    return {"count": len(calls), "calls": calls}


@api_router.get("/integrations/prospect/{prospect_id}/history")
async def prospect_communication_history(prospect_id: str, request: Request):
    """All calls + WhatsApp messages for a single prospect (current user)."""
    user = await require_auth(request)
    calls_cur = db.call_logs.find({"user_id": user.user_id, "prospect_id": prospect_id}, {"_id": 0}).sort("created_at", -1)
    wa_cur = db.whatsapp_messages.find({"user_id": user.user_id, "prospect_id": prospect_id}, {"_id": 0}).sort("created_at", -1)
    calls = await calls_cur.to_list(length=100)
    messages = await wa_cur.to_list(length=100)
    # Merge chronologically
    items = []
    for c in calls:
        items.append({**c, "_kind": "call", "_ts": c.get("created_at", "")})
    for m in messages:
        items.append({**m, "_kind": "whatsapp", "_ts": m.get("created_at", "")})
    items.sort(key=lambda x: x["_ts"], reverse=True)
    return {"count": len(items), "items": items, "calls_count": len(calls), "wa_count": len(messages)}


@api_router.get("/integrations/calls/{call_id}")
async def get_call_detail(call_id: str, request: Request):
    user = await require_auth(request)
    call = await db.call_logs.find_one({"call_id": call_id, "user_id": user.user_id}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call


# ---------- WHATSAPP BUSINESS ---------- #

class WhatsAppSendPayload(BaseModel):
    to: str
    body: str
    prospect_id: Optional[str] = None


@api_router.post("/integrations/whatsapp/send")
async def whatsapp_send(payload: WhatsAppSendPayload, request: Request):
    """Send a WhatsApp message via Twilio (Sandbox or approved Business Sender)."""
    user = await require_auth(request)
    wa_from = os.environ.get("TWILIO_WHATSAPP_FROM", "").strip()
    client = _twilio_client()
    if not (client and wa_from):
        raise HTTPException(status_code=400, detail="WhatsApp via Twilio non configuré — ajoute TWILIO_WHATSAPP_FROM (ex: 'whatsapp:+14155238886' pour le sandbox)")

    try:
        # Twilio expects 'whatsapp:+...' prefix on both from and to
        to_number = payload.to if payload.to.startswith("whatsapp:") else f"whatsapp:{payload.to}"
        from_number = wa_from if wa_from.startswith("whatsapp:") else f"whatsapp:{wa_from}"
        msg = client.messages.create(body=payload.body, from_=from_number, to=to_number)
        log = {
            "wa_message_id": msg.sid,
            "direction": "outbound",
            "user_id": user.user_id,
            "prospect_id": payload.prospect_id,
            "to": payload.to,
            "from": wa_from,
            "body": payload.body,
            "status": getattr(msg, "status", "queued"),
            "provider": "twilio",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.whatsapp_messages.insert_one(log)
        log.pop("_id", None)
        return {"ok": True, "message": log}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"WhatsApp Twilio send error: {e}")
        raise HTTPException(status_code=500, detail=f"Twilio WhatsApp error: {str(e)[:200]}")


@api_router.post("/integrations/whatsapp/twilio-webhook")
async def whatsapp_twilio_webhook(request: Request):
    """Inbound WhatsApp messages from Twilio (webhook set on the WhatsApp number)."""
    form = await request.form()
    body = form.get("Body", "")
    from_ = form.get("From", "")  # whatsapp:+14155551234
    to_ = form.get("To", "")
    msg_sid = form.get("MessageSid")

    doc = {
        "wa_message_id": msg_sid,
        "direction": "inbound",
        "from": from_.replace("whatsapp:", ""),
        "to": to_.replace("whatsapp:", ""),
        "body": body,
        "type": "text",
        "provider": "twilio",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.whatsapp_messages.insert_one(doc)
    # Best-effort: link to a prospect by last 9 digits of phone
    if from_:
        last9 = from_.replace("whatsapp:", "")[-9:]
        await db.prospects.update_one(
            {"phone": {"$regex": last9}},
            {"$push": {"whatsapp_threads": msg_sid}}
        )
    # Twilio expects an XML 200 OK
    from fastapi.responses import Response as FResp
    return FResp(content="<Response/>", media_type="application/xml")


@api_router.get("/integrations/whatsapp/webhook")
async def whatsapp_webhook_verify(request: Request):
    """Meta webhook verification handshake."""
    params = dict(request.query_params)
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge", "")
    expected = os.environ.get("WHATSAPP_VERIFY_TOKEN", "kolo_wa_verify_2026")
    if mode == "subscribe" and token == expected:
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(challenge)
    raise HTTPException(status_code=403, detail="Invalid verify token")


@api_router.post("/integrations/whatsapp/webhook")
async def whatsapp_webhook_receive(request: Request):
    raw_body = await request.body()

    # Optional Meta signature verification (X-Hub-Signature-256) using app secret
    app_secret = os.environ.get("WHATSAPP_APP_SECRET", "").strip()
    if app_secret:
        import hashlib, hmac
        header_sig = request.headers.get("X-Hub-Signature-256", "")
        if not header_sig.startswith("sha256="):
            raise HTTPException(status_code=401, detail="Missing or invalid signature header")
        received = header_sig.split("=", 1)[1]
        expected = hmac.new(app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(received, expected):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        import json as _json_wa
        payload = _json_wa.loads(raw_body) if raw_body else {}
    except Exception:
        payload = {}
    try:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                metadata = value.get("metadata", {})
                phone_id = metadata.get("phone_number_id")
                for msg in value.get("messages", []) or []:
                    body = (msg.get("text") or {}).get("body", "") if msg.get("type") == "text" else ""
                    doc = {
                        "wa_message_id": msg.get("id"),
                        "direction": "inbound",
                        "from": msg.get("from"),
                        "to": phone_id,
                        "type": msg.get("type"),
                        "body": body,
                        "raw": msg,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                    await db.whatsapp_messages.insert_one(doc)
                    # Link to prospect by phone match (best-effort)
                    if msg.get("from"):
                        await db.prospects.update_one(
                            {"phone": {"$regex": msg["from"][-9:]}},
                            {"$push": {"whatsapp_threads": doc["wa_message_id"]}}
                        )
    except Exception as e:
        logger.warning(f"WhatsApp webhook parse error: {e}")
    return {"status": "ok"}


@api_router.get("/integrations/whatsapp/messages")
async def list_whatsapp_messages(request: Request, prospect_id: Optional[str] = None, limit: int = 100):
    user = await require_auth(request)
    q = {"user_id": user.user_id} if not prospect_id else {"$or": [{"user_id": user.user_id, "prospect_id": prospect_id}, {"prospect_id": prospect_id}]}
    cursor = db.whatsapp_messages.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    msgs = await cursor.to_list(length=limit)
    return {"count": len(msgs), "messages": msgs}


# ---------- GOOGLE CALENDAR ---------- #

GOOGLE_CAL_SCOPES = ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/userinfo.email", "openid"]


@api_router.get("/integrations/google-calendar/auth-url")
async def gcal_auth_url(request: Request, redirect_to: Optional[str] = None):
    user = await require_auth(request)
    cid = os.environ.get("GOOGLE_CAL_CLIENT_ID", "").strip()
    if not cid:
        raise HTTPException(status_code=400, detail="GOOGLE_CAL_CLIENT_ID missing — ajoute tes credentials dans .env")
    base_url = os.environ.get("FRONTEND_URL", "").strip().rstrip("/") or str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/integrations/google-calendar/callback"
    state = secrets.token_urlsafe(16)
    await db.google_cal_states.insert_one({
        "state": state,
        "user_id": user.user_id,
        "redirect_to": redirect_to or "/app",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    from urllib.parse import urlencode
    params = {
        "client_id": cid,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(GOOGLE_CAL_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return {"authorization_url": f"https://accounts.google.com/o/oauth2/auth?{urlencode(params)}"}


@api_router.get("/integrations/google-calendar/callback")
async def gcal_callback(request: Request, code: str, state: str):
    cid = os.environ.get("GOOGLE_CAL_CLIENT_ID", "").strip()
    cs = os.environ.get("GOOGLE_CAL_CLIENT_SECRET", "").strip()
    if not (cid and cs):
        raise HTTPException(status_code=400, detail="Google Calendar credentials missing")

    state_doc = await db.google_cal_states.find_one({"state": state}, {"_id": 0})
    if not state_doc:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    base_url = os.environ.get("FRONTEND_URL", "").strip().rstrip("/") or str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/integrations/google-calendar/callback"
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            tr = await hc.post("https://oauth2.googleapis.com/token", data={
                "code": code, "client_id": cid, "client_secret": cs,
                "redirect_uri": redirect_uri, "grant_type": "authorization_code"
            })
        tokens = tr.json()
        if "access_token" not in tokens:
            raise HTTPException(status_code=400, detail={"google_error": tokens})

        await db.users.update_one(
            {"user_id": state_doc["user_id"]},
            {"$set": {"google_calendar_tokens": tokens, "google_calendar_connected_at": datetime.now(timezone.utc).isoformat()}}
        )
        await db.google_cal_states.delete_one({"state": state})

        from fastapi.responses import RedirectResponse
        # Redirect back to the frontend integrations page
        return RedirectResponse(url=f"/integrations?gcal=connected")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google Calendar callback error: {e}")
        raise HTTPException(status_code=500, detail=str(e)[:200])


def _gcal_creds_for_user(tokens: dict):
    from google.oauth2.credentials import Credentials
    return Credentials(
        token=tokens.get("access_token"),
        refresh_token=tokens.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get("GOOGLE_CAL_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_CAL_CLIENT_SECRET"),
        scopes=GOOGLE_CAL_SCOPES,
    )


@api_router.get("/integrations/google-calendar/events")
async def gcal_list_events(request: Request, max_results: int = 50):
    user = await require_auth(request)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    tokens = user_doc.get("google_calendar_tokens")
    if not tokens:
        raise HTTPException(status_code=400, detail="Google Calendar non connecté")
    try:
        from googleapiclient.discovery import build
        from google.auth.transport.requests import Request as GR
        creds = _gcal_creds_for_user(tokens)
        if creds.expired and creds.refresh_token:
            creds.refresh(GR())
            await db.users.update_one({"user_id": user.user_id}, {"$set": {"google_calendar_tokens.access_token": creds.token}})
        service = build("calendar", "v3", credentials=creds, cache_discovery=False)
        result = service.events().list(
            calendarId="primary",
            timeMin=datetime.now(timezone.utc).isoformat(),
            maxResults=max_results,
            singleEvents=True,
            orderBy="startTime",
        ).execute()
        events = result.get("items", [])
        clean = []
        for ev in events:
            clean.append({
                "id": ev.get("id"),
                "summary": ev.get("summary"),
                "start": ev.get("start"),
                "end": ev.get("end"),
                "html_link": ev.get("htmlLink"),
            })
        return {"count": len(clean), "events": clean}
    except Exception as e:
        logger.error(f"GCal list events: {e}")
        raise HTTPException(status_code=500, detail=str(e)[:200])


class GCalEventCreate(BaseModel):
    title: str
    start_iso: str  # ISO 8601 datetime
    end_iso: str
    description: Optional[str] = None
    prospect_id: Optional[str] = None


@api_router.post("/integrations/google-calendar/events")
async def gcal_create_event(payload: GCalEventCreate, request: Request):
    user = await require_auth(request)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    tokens = user_doc.get("google_calendar_tokens")
    if not tokens:
        raise HTTPException(status_code=400, detail="Google Calendar non connecté")
    try:
        from googleapiclient.discovery import build
        from google.auth.transport.requests import Request as GR
        creds = _gcal_creds_for_user(tokens)
        if creds.expired and creds.refresh_token:
            creds.refresh(GR())
        service = build("calendar", "v3", credentials=creds, cache_discovery=False)
        ev = service.events().insert(calendarId="primary", body={
            "summary": payload.title,
            "description": payload.description or "",
            "start": {"dateTime": payload.start_iso},
            "end": {"dateTime": payload.end_iso},
        }).execute()
        return {"ok": True, "event": {"id": ev.get("id"), "html_link": ev.get("htmlLink")}}
    except Exception as e:
        logger.error(f"GCal create event: {e}")
        raise HTTPException(status_code=500, detail=str(e)[:200])


@api_router.post("/integrations/google-calendar/disconnect")
async def gcal_disconnect(request: Request):
    user = await require_auth(request)
    await db.users.update_one({"user_id": user.user_id}, {"$unset": {"google_calendar_tokens": "", "google_calendar_connected_at": ""}})
    return {"ok": True}


# ---------- MICROSOFT OUTLOOK CALENDAR (Graph API) ---------- #

MS_AUTHORITY = "https://login.microsoftonline.com"
MS_SCOPES = "openid profile offline_access User.Read Calendars.ReadWrite"


def _ms_base_url(request: Request) -> str:
    """Backend base URL used for OAuth callback. Prefers FRONTEND_URL env (canonical public URL)."""
    return os.environ.get("FRONTEND_URL", "").strip().rstrip("/") or str(request.base_url).rstrip("/")


@api_router.get("/integrations/outlook-calendar/auth-url")
async def outlook_auth_url(request: Request, redirect_to: Optional[str] = None):
    user = await require_auth(request)
    cid = os.environ.get("MS_CLIENT_ID", "").strip()
    if not cid:
        raise HTTPException(status_code=400, detail="MS_CLIENT_ID missing — ajoute tes credentials Microsoft dans .env")
    tenant = os.environ.get("MS_TENANT", "common").strip() or "common"
    redirect_uri = f"{_ms_base_url(request)}/api/integrations/outlook-calendar/callback"
    state = secrets.token_urlsafe(16)
    await db.outlook_states.insert_one({
        "state": state,
        "user_id": user.user_id,
        "redirect_to": redirect_to or "/integrations",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    from urllib.parse import urlencode
    params = {
        "client_id": cid,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "response_mode": "query",
        "scope": MS_SCOPES,
        "state": state,
        "prompt": "select_account",
    }
    return {"authorization_url": f"{MS_AUTHORITY}/{tenant}/oauth2/v2.0/authorize?{urlencode(params)}"}


@api_router.get("/integrations/outlook-calendar/callback")
async def outlook_callback(request: Request, code: str, state: str):
    cid = os.environ.get("MS_CLIENT_ID", "").strip()
    cs = os.environ.get("MS_CLIENT_SECRET", "").strip()
    tenant = os.environ.get("MS_TENANT", "common").strip() or "common"
    if not (cid and cs):
        raise HTTPException(status_code=400, detail="Microsoft credentials missing")

    state_doc = await db.outlook_states.find_one({"state": state}, {"_id": 0})
    if not state_doc:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    redirect_uri = f"{_ms_base_url(request)}/api/integrations/outlook-calendar/callback"
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            tr = await hc.post(
                f"{MS_AUTHORITY}/{tenant}/oauth2/v2.0/token",
                data={
                    "client_id": cid,
                    "client_secret": cs,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "scope": MS_SCOPES,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        tokens = tr.json()
        if "access_token" not in tokens:
            logger.error(f"Outlook OAuth error: {tokens}")
            raise HTTPException(status_code=400, detail={"ms_error": tokens})

        # Compute expiry
        expires_in = int(tokens.get("expires_in", 3600))
        tokens["expires_at"] = (datetime.now(timezone.utc) + timedelta(seconds=expires_in - 60)).isoformat()

        await db.users.update_one(
            {"user_id": state_doc["user_id"]},
            {"$set": {
                "outlook_tokens": tokens,
                "outlook_connected_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
        await db.outlook_states.delete_one({"state": state})

        from fastapi.responses import RedirectResponse
        return RedirectResponse(url="/integrations?outlook=connected")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Outlook callback error: {e}")
        raise HTTPException(status_code=500, detail=str(e)[:200])


async def _ensure_outlook_access_token(user_id: str) -> str:
    """Return a valid access token, refreshing it if necessary."""
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0}) or {}
    tokens = user_doc.get("outlook_tokens") or {}
    if not tokens:
        raise HTTPException(status_code=400, detail="Outlook non connecté")

    access_token = tokens.get("access_token")
    expires_at_str = tokens.get("expires_at")
    refresh_token = tokens.get("refresh_token")

    # Parse expiry
    expired = True
    if expires_at_str:
        try:
            expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            expired = datetime.now(timezone.utc) >= expires_at
        except Exception:
            expired = True

    if access_token and not expired:
        return access_token

    if not refresh_token:
        raise HTTPException(status_code=401, detail="Session Outlook expirée, reconnectez-vous")

    cid = os.environ.get("MS_CLIENT_ID", "").strip()
    cs = os.environ.get("MS_CLIENT_SECRET", "").strip()
    tenant = os.environ.get("MS_TENANT", "common").strip() or "common"

    async with httpx.AsyncClient(timeout=15) as hc:
        rr = await hc.post(
            f"{MS_AUTHORITY}/{tenant}/oauth2/v2.0/token",
            data={
                "client_id": cid,
                "client_secret": cs,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "scope": MS_SCOPES,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    new_tokens = rr.json()
    if "access_token" not in new_tokens:
        logger.error(f"Outlook refresh failed: {new_tokens}")
        raise HTTPException(status_code=401, detail="Impossible de rafraîchir le token Outlook")

    # Keep old refresh token if not rotated
    new_tokens["refresh_token"] = new_tokens.get("refresh_token", refresh_token)
    expires_in = int(new_tokens.get("expires_in", 3600))
    new_tokens["expires_at"] = (datetime.now(timezone.utc) + timedelta(seconds=expires_in - 60)).isoformat()

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"outlook_tokens": new_tokens}}
    )
    return new_tokens["access_token"]


@api_router.get("/integrations/outlook-calendar/events")
async def outlook_list_events(request: Request, max_results: int = 20):
    user = await require_auth(request)
    token = await _ensure_outlook_access_token(user.user_id)
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.get(
                f"https://graph.microsoft.com/v1.0/me/events?$top={max_results}&$orderby=start/dateTime",
                headers={"Authorization": f"Bearer {token}"},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Graph error: {r.text[:200]}")
        data = r.json()
        events = data.get("value", [])
        clean = []
        for ev in events:
            clean.append({
                "id": ev.get("id"),
                "subject": ev.get("subject"),
                "start": ev.get("start"),
                "end": ev.get("end"),
                "webLink": ev.get("webLink"),
            })
        return {"count": len(clean), "events": clean}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Outlook list events: {e}")
        raise HTTPException(status_code=500, detail=str(e)[:200])


class OutlookEventCreate(BaseModel):
    subject: str
    start_iso: str
    end_iso: str
    timezone: str = "UTC"
    body: Optional[str] = None
    prospect_id: Optional[str] = None


@api_router.post("/integrations/outlook-calendar/events")
async def outlook_create_event(payload: OutlookEventCreate, request: Request):
    user = await require_auth(request)
    token = await _ensure_outlook_access_token(user.user_id)
    event_body = {
        "subject": payload.subject,
        "body": {"contentType": "HTML", "content": payload.body or ""},
        "start": {"dateTime": payload.start_iso, "timeZone": payload.timezone},
        "end": {"dateTime": payload.end_iso, "timeZone": payload.timezone},
    }
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.post(
                "https://graph.microsoft.com/v1.0/me/events",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=event_body,
            )
        if r.status_code not in (200, 201):
            raise HTTPException(status_code=502, detail=f"Graph error: {r.text[:200]}")
        ev = r.json()
        return {"ok": True, "event": {"id": ev.get("id"), "web_link": ev.get("webLink")}}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Outlook create event: {e}")
        raise HTTPException(status_code=500, detail=str(e)[:200])


@api_router.post("/integrations/outlook-calendar/disconnect")
async def outlook_disconnect(request: Request):
    user = await require_auth(request)
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$unset": {"outlook_tokens": "", "outlook_connected_at": ""}}
    )
    return {"ok": True}


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
    """Background task: notifications daily at 8h UTC + weekly report Monday 8h UTC"""
    last_weekly_run_date = None
    while True:
        try:
            now = datetime.now(timezone.utc)
            target_hour = 8
            
            if now.hour == target_hour and now.minute < 5:
                logger.info("Running scheduled notification job...")
                try:
                    from notification_scheduler import run_once
                    result = await run_once()
                    logger.info(f"Scheduled job completed: {result}")
                except Exception as e:
                    logger.error(f"Scheduled job error: {e}")
                
                # === WEEKLY REPORT (every Monday at 8h UTC) ===
                # weekday() == 0 means Monday
                if now.weekday() == 0 and last_weekly_run_date != now.date():
                    last_weekly_run_date = now.date()
                    try:
                        # Find all PRO+ users with active subscription
                        pro_users = await db.users.find({
                            "$or": [
                                {"plan": "pro_plus"},
                                {"is_super_admin": True},
                                {"lifetime_access": True},
                            ]
                        }, {"_id": 0, "user_id": 1, "email": 1, "locale": 1}).to_list(2000)
                        logger.info(f"Sending weekly reports to {len(pro_users)} PRO+ users")
                        for u in pro_users:
                            try:
                                await _send_weekly_report_for_user(u["user_id"])
                            except Exception as ue:
                                logger.warning(f"Weekly report for {u.get('email')} failed: {ue}")
                    except Exception as e:
                        logger.error(f"Weekly report cron error: {e}")
                
                await asyncio.sleep(3600)
            else:
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
    
    # === Idempotent super admin seed ===
    # Ensures elliot.cohenpressard@trykolo.io exists with the configured password
    # in EVERY environment (preview + production) without requiring env vars.
    # The password can be overridden via SUPER_ADMIN_SEED_PASSWORD env var.
    try:
        seed_email = "elliot.cohenpressard@trykolo.io"
        seed_pwd = (os.environ.get("SUPER_ADMIN_SEED_PASSWORD", "").strip()
                    or "Psychologue75007%!")  # Hardcoded fallback for production safety
        pwd_hash = hash_password(seed_pwd)
        # Pro+ lifetime (year 2099) — super admin always has full access
        lifetime_dt = (datetime(2099, 12, 31, tzinfo=timezone.utc)).isoformat()
        existing = await db.users.find_one({"email": seed_email}, {"_id": 0})
        if existing:
            # Refresh password and ensure super admin flag set + Pro+ lifetime
            await db.users.update_one(
                {"email": seed_email},
                {"$set": {
                    "password_hash": pwd_hash,
                    "is_super_admin": True,
                    "plan": "pro_plus",
                    "subscription_status": "active",
                    "lifetime_access": True,
                    "trial_ends_at": lifetime_dt,
                    "current_period_end": lifetime_dt,
                }}
            )
            logger.info(f"Super admin {seed_email} refreshed (Pro+ lifetime)")
        else:
            await db.users.insert_one({
                "user_id": str(uuid.uuid4()),
                "email": seed_email,
                "name": "Elliot Cohen-Pressard",
                "password_hash": pwd_hash,
                "is_super_admin": True,
                "plan": "pro_plus",
                "subscription_status": "active",
                "lifetime_access": True,
                "trial_ends_at": lifetime_dt,
                "current_period_end": lifetime_dt,
                "locale": "fr",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.info(f"Super admin {seed_email} created (Pro+ lifetime)")
    except Exception as e:
        logger.error(f"Super admin seed failed: {e}")
    
    # Start scheduler in a background thread
    scheduler_thread = threading.Thread(target=start_background_scheduler, daemon=True)
    scheduler_thread.start()
    logger.info("Background notification scheduler started")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    logger.info("Database client closed")
