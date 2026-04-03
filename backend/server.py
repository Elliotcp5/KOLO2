from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
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
    
    # Get full user doc for plan info
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
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
    
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "phone": getattr(user, 'phone', None),
        "picture": user.picture,
        "subscription_status": user.subscription_status,
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
        "currency": user_doc.get("currency", "EUR") if user_doc else "EUR"
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
            locale = session.metadata.get("locale", "fr")
            
            if email and subscription_id:
                # Get subscription details
                sub = stripe.Subscription.retrieve(subscription_id)
                trial_end = datetime.fromtimestamp(sub.trial_end, tz=timezone.utc) if sub.trial_end else None
                
                # Determine plan from price
                plan = "free"
                if sub.items and sub.items.data:
                    price = sub.items.data[0].price
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
    current_period_end = datetime.fromtimestamp(sub.current_period_end, tz=timezone.utc) if sub.current_period_end else None
    cancel_at_period_end = sub.cancel_at_period_end
    
    # Determine plan from subscription price
    plan = "free"
    if sub.items and sub.items.data:
        price = sub.items.data[0].price
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
    if active_sub.items and active_sub.items.data:
        price = active_sub.items.data[0].price
        amount = price.unit_amount if price else 0
        if amount >= 2000:
            plan = "pro_plus"
        elif amount >= 500:
            plan = "pro"
    
    trial_end = datetime.fromtimestamp(active_sub.trial_end, tz=timezone.utc) if active_sub.trial_end else None
    current_period_end = datetime.fromtimestamp(active_sub.current_period_end, tz=timezone.utc) if active_sub.current_period_end else None
    
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

@api_router.post("/plans/sync")
async def sync_user_plan(http_request: Request):
    """
    Sync user's subscription status from Stripe.
    Called after payment to ensure plan is updated.
    """
    import stripe
    stripe.api_key = STRIPE_API_KEY
    
    user = await get_user_from_session(http_request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    email = user.email
    
    # First check if there's a pending payment success record
    payment_success = await db.payment_success.find_one(
        {"email": email, "used": False},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if payment_success:
        # Apply the payment success directly
        plan = payment_success.get("plan", "pro")
        status = payment_success.get("status", "active")
        trial_ends_at = payment_success.get("trial_ends_at")
        
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {
                "plan": plan,
                "subscription_status": status,
                "subscription_id": payment_success.get("subscription_id"),
                "stripe_customer_id": payment_success.get("customer_id"),
                "trial_ends_at": trial_ends_at,
                "trial_plan": plan if status == "trialing" else None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Mark payment success as used
        await db.payment_success.update_one(
            {"token": payment_success.get("token")},
            {"$set": {"used": True}}
        )
        
        return {
            "synced": True,
            "source": "payment_success_record",
            "plan": plan,
            "subscription_status": status
        }
    
    # Otherwise, search in Stripe
    stripe_customer_id = user_doc.get("stripe_customer_id")
    
    if not stripe_customer_id:
        # Try to find by email
        customers = stripe.Customer.list(email=email, limit=1)
        if not customers.data:
            return {"synced": False, "reason": "no_stripe_customer", "plan": user_doc.get("plan", "free")}
        stripe_customer_id = customers.data[0].id
    
    # Get subscriptions
    try:
        subscriptions = stripe.Subscription.list(customer=stripe_customer_id, status="all", limit=5)
    except Exception as e:
        logger.error(f"Stripe error fetching subscriptions: {e}")
        return {"synced": False, "reason": "stripe_error", "plan": user_doc.get("plan", "free")}
    
    active_sub = None
    for sub in subscriptions.data:
        if sub.status in ["active", "trialing"]:
            active_sub = sub
            break
    
    if not active_sub:
        return {"synced": True, "reason": "no_active_subscription", "plan": user_doc.get("plan", "free")}
    
    # Determine plan from price
    plan = "free"
    if active_sub.items and active_sub.items.data:
        price = active_sub.items.data[0].price
        amount = price.unit_amount if price else 0
        if amount >= 2000:
            plan = "pro_plus"
        elif amount >= 500:
            plan = "pro"
    
    trial_end = datetime.fromtimestamp(active_sub.trial_end, tz=timezone.utc) if active_sub.trial_end else None
    
    # Update user
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "stripe_customer_id": stripe_customer_id,
            "subscription_id": active_sub.id,
            "subscription_status": active_sub.status,
            "plan": plan,
            "trial_plan": plan if active_sub.status == "trialing" else None,
            "trial_ends_at": trial_end.isoformat() if trial_end else None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "synced": True,
        "source": "stripe",
        "plan": plan,
        "subscription_status": active_sub.status,
        "trial_ends_at": trial_end.isoformat() if trial_end else None
    }



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
    stripe_customer_id = user_doc.get("stripe_customer_id")
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
    user_locale = user_doc.get("locale", "fr")
    session = stripe.checkout.Session.create(
        customer=stripe_customer_id,
        customer_email=user.email,  # Ensure email is set
        mode="subscription",
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{origin_url}/app?upgrade=success&plan={request.plan}",
        cancel_url=f"{origin_url}/pricing?upgrade=cancelled",
        metadata={
            "user_id": user.user_id,
            "email": user.email,  # CRITICAL: Include email for webhook
            "plan": request.plan,
            "billing_period": request.billing_period,
            "locale": user_locale
        }
    )
    
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
        base_url = "https://app.trykolo.io"
    
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
    """Register for free 14-day Pro trial without payment"""
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
    
    # Check if email already exists
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Un compte existant utilise déjà cette adresse email")
    
    # Calculate trial end date (14 days from now)
    trial_ends_at = datetime.now(timezone.utc) + timedelta(days=14)
    
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
                "initial_plan": "pro",
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
        "plan": "pro",  # Trial plan
        "trial_plan": "pro",  # Active trial
        "trial_start_date": datetime.now(timezone.utc).isoformat(),
        "subscription_status": "trialing",
        "trial_ends_at": trial_ends_at.isoformat(),
        "stripe_customer_id": stripe_customer_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    logger.info(f"MongoDB: User document inserted for {email}")
    logger.info(f"Free trial account created for {register_data.email}, trial ends: {trial_ends_at}")
    
    # Send welcome email (background)
    import asyncio
    user_locale = register_data.locale if hasattr(register_data, 'locale') and register_data.locale else "fr"
    asyncio.create_task(send_welcome_email_background(email, name, is_trial=True, trial_plan="pro", locale=user_locale))
    
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
    
    # Update user streak
    await update_user_streak(user.user_id)
    
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
    """Get AI task suggestion for a specific prospect"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get prospect
    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Get last contact date
    last_contact = prospect.get("last_contact_date")
    days_since_contact = 999
    
    if last_contact:
        try:
            last_dt = datetime.fromisoformat(last_contact.replace('Z', '+00:00'))
            days_since_contact = (datetime.now(timezone.utc) - last_dt).days
        except (ValueError, TypeError):
            pass
    
    # Generate suggestion based on context
    prospect_name = prospect.get("full_name", prospect.get("name", "Client"))
    status = prospect.get("status", "nouveau")
    
    # Determine task type and reason with full i18n support
    reasons = {
        "inactive_long": {
            "fr": f"Pas de contact depuis {days_since_contact} jours - un appel permettrait de relancer {prospect_name}",
            "en": f"No contact for {days_since_contact} days - a call would help re-engage {prospect_name}",
            "de": f"Kein Kontakt seit {days_since_contact} Tagen - ein Anruf würde helfen, {prospect_name} wieder zu aktivieren",
            "it": f"Nessun contatto da {days_since_contact} giorni - una chiamata aiuterebbe a riattivare {prospect_name}"
        },
        "inactive_medium": {
            "fr": f"Pas de nouvelles depuis {days_since_contact} jours - un SMS de suivi serait approprié",
            "en": f"No news for {days_since_contact} days - a follow-up SMS would be appropriate",
            "de": f"Keine Nachrichten seit {days_since_contact} Tagen - eine Follow-up SMS wäre angemessen",
            "it": f"Nessuna notizia da {days_since_contact} giorni - un SMS di follow-up sarebbe appropriato"
        },
        "new_prospect": {
            "fr": "Nouveau prospect - un appel de présentation permettrait de qualifier le projet",
            "en": "New prospect - an introduction call would help qualify the project",
            "de": "Neuer Interessent - ein Vorstellungsgespräch würde helfen, das Projekt zu qualifizieren",
            "it": "Nuovo prospect - una chiamata di presentazione aiuterebbe a qualificare il progetto"
        },
        "maintain_contact": {
            "fr": f"Maintenir le contact avec {prospect_name} pour rester présent",
            "en": f"Maintain contact with {prospect_name} to stay top of mind",
            "de": f"Kontakt mit {prospect_name} pflegen, um präsent zu bleiben",
            "it": f"Mantenere il contatto con {prospect_name} per restare presente"
        }
    }
    
    if days_since_contact >= 14:
        task_type = "appel"
        reason_key = "inactive_long"
    elif days_since_contact >= 7:
        task_type = "sms"
        reason_key = "inactive_medium"
    elif status in ["nouveau", "new"]:
        task_type = "appel"
        reason_key = "new_prospect"
    else:
        task_type = "sms"
        reason_key = "maintain_contact"
    
    accept_lang = request.headers.get("Accept-Language", "fr").lower()
    if accept_lang.startswith("fr"):
        locale = "fr"
    elif accept_lang.startswith("de"):
        locale = "de"
    elif accept_lang.startswith("it"):
        locale = "it"
    else:
        locale = "en"
    
    reason = reasons[reason_key].get(locale, reasons[reason_key]["en"])
    
    return {
        "suggestion": {
            "prospect_id": prospect_id,
            "prospect_name": prospect_name,
            "task_type": task_type,
            "reason": reason,
            "priority": "high" if days_since_contact > 14 else "medium"
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
