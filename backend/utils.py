# KOLO - Utility Functions
from datetime import datetime, timezone, timedelta
import hashlib
import re

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
