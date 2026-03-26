# KOLO - Utility Functions
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import hashlib
import re
import logging

logger = logging.getLogger(__name__)

# Rate limiter (will be set by server.py)
limiter = None

def set_limiter(l):
    global limiter
    limiter = l

# EU countries (ISO 3166-1 alpha-2)
EU_COUNTRIES = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
]

# Regional pricing configuration (in cents - 999 = 9.99)
PRICING = {
    'EUR': {'amount': 999, 'currency': 'eur', 'symbol': '€', 'display': '9,99'},
    'GBP': {'amount': 999, 'currency': 'gbp', 'symbol': '£', 'display': '9.99'},
    'USD': {'amount': 999, 'currency': 'usd', 'symbol': '$', 'display': '9.99'},
}

# Security helper
security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get current authenticated user from token"""
    from database import db
    
    token = None
    
    # Try Bearer token first
    if credentials:
        token = credentials.credentials
    
    # Try Authorization header
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    # Try cookie
    if not token:
        token = request.cookies.get("session_token")
    
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Find session
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiration
    expires_at = session.get("expires_at")
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if exp_dt < datetime.now(timezone.utc):
                raise HTTPException(status_code=401, detail="Session expired")
        except:
            pass
    
    return {"user_id": session["user_id"], "session_token": token}

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def get_currency_for_country(country_code: str) -> str:
    if country_code == 'GB':
        return 'GBP'
    elif country_code in EU_COUNTRIES or country_code in ['CH', 'MC', 'AD', 'SM', 'VA']:
        return 'EUR'
    else:
        return 'USD'

def get_pricing_for_country(country_code: str) -> dict:
    currency = get_currency_for_country(country_code)
    return PRICING[currency]

def format_phone_number_with_country(phone: str, country_code: str = "+33") -> str:
    """Format phone number with country code"""
    phone_clean = re.sub(r'[^\d+]', '', phone)
    if phone_clean.startswith('+'):
        return phone_clean
    if phone_clean.startswith('0'):
        phone_clean = phone_clean[1:]
    return f"{country_code}{phone_clean}"

def format_phone_number(phone: str) -> str:
    """Format phone number - ensure it starts with +"""
    phone_clean = re.sub(r'[^\d+]', '', phone)
    if not phone_clean.startswith('+'):
        if phone_clean.startswith('0'):
            phone_clean = '+33' + phone_clean[1:]
        else:
            phone_clean = '+' + phone_clean
    return phone_clean
