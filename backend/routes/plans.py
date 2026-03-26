"""
Plans and Subscription Routes
Handles plan management, trials, pricing, and feature checks
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/plans", tags=["plans"])

# Plan features configuration
PLAN_FEATURES = {
    "free": {
        "max_prospects": 30,
        "daily_ai_suggestions": 1,
        "sms_one_click": False,
        "budget_slider": False,
        "interaction_history": False,
        "heat_score": False,
        "roi_dashboard": False,
        "weekly_reports": False,
        "dedicated_support": False,
        "priority_access": False
    },
    "pro": {
        "max_prospects": None,  # Unlimited
        "daily_ai_suggestions": None,  # Unlimited
        "sms_one_click": True,
        "budget_slider": True,
        "interaction_history": True,
        "heat_score": False,
        "roi_dashboard": False,
        "weekly_reports": False,
        "dedicated_support": False,
        "priority_access": False
    },
    "pro_plus": {
        "max_prospects": None,
        "daily_ai_suggestions": None,
        "sms_one_click": True,
        "budget_slider": True,
        "interaction_history": True,
        "heat_score": True,
        "roi_dashboard": True,
        "weekly_reports": True,
        "dedicated_support": True,
        "priority_access": True
    }
}

# Pricing configuration
PRICING = {
    "EUR": {
        "free": {"monthly": 0, "annual": 0},
        "pro": {"monthly": 999, "annual": 9990},  # cents
        "pro_plus": {"monthly": 2499, "annual": 24990}
    },
    "USD": {
        "free": {"monthly": 0, "annual": 0},
        "pro": {"monthly": 1099, "annual": 10990},
        "pro_plus": {"monthly": 2799, "annual": 27990}
    },
    "GBP": {
        "free": {"monthly": 0, "annual": 0},
        "pro": {"monthly": 899, "annual": 8990},
        "pro_plus": {"monthly": 2199, "annual": 21990}
    }
}


def get_user_effective_plan(user_doc: dict) -> str:
    """Get user's effective plan considering trial status"""
    if not user_doc:
        return "free"
    
    # Check if user has an active subscription
    subscription_status = user_doc.get("subscription_status", "")
    plan = user_doc.get("plan", "free")
    
    if subscription_status == "active":
        return plan if plan else "free"
    
    # Check trial status
    if subscription_status == "trialing":
        trial_ends_str = user_doc.get("trial_ends_at")
        if trial_ends_str:
            try:
                trial_ends = datetime.fromisoformat(trial_ends_str.replace('Z', '+00:00'))
                if trial_ends > datetime.now(timezone.utc):
                    trial_plan = user_doc.get("trial_plan", "pro")
                    return trial_plan if trial_plan else "pro"
            except:
                pass
    
    return "free"


@router.get("/current")
async def get_current_plan(request: Request):
    """Get current user's plan and features"""
    from database import get_db
    from utils import get_current_user
    
    user = await get_current_user(request)
    db = get_db()
    
    user_doc = await db.users.find_one({"user_id": user["user_id"]})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    effective_plan = get_user_effective_plan(user_doc)
    features = PLAN_FEATURES.get(effective_plan, PLAN_FEATURES["free"])
    
    # Check trial status
    is_trial = user_doc.get("subscription_status") == "trialing"
    trial_ends_at = user_doc.get("trial_ends_at")
    
    return {
        "plan": user_doc.get("plan", "free"),
        "effective_plan": effective_plan,
        "features": features,
        "subscription_status": user_doc.get("subscription_status", "inactive"),
        "is_trial": is_trial,
        "trial_ends_at": trial_ends_at,
        "trial_plan": user_doc.get("trial_plan"),
        "billing_period": user_doc.get("billing_period", "monthly"),
        "currency": user_doc.get("currency", "EUR"),
        "subscription_ends_at": user_doc.get("subscription_ends_at"),
        "cancel_at_period_end": user_doc.get("cancel_at_period_end", False)
    }


@router.get("/pricing")
async def get_pricing(currency: str = "EUR"):
    """Get pricing for all plans"""
    currency = currency.upper()
    if currency not in PRICING:
        currency = "EUR"
    
    prices = PRICING[currency]
    symbol = {"EUR": "€", "USD": "$", "GBP": "£"}.get(currency, "€")
    
    def format_price(cents):
        if cents == 0:
            return "Free" if currency == "EUR" else "Free"
        return f"{symbol}{cents/100:.2f}"
    
    return {
        "currency": currency,
        "symbol": symbol,
        "plans": {
            "free": {
                "name": "STARTER",
                "price_monthly": prices["free"]["monthly"],
                "price_annual": prices["free"]["annual"],
                "display_monthly": "Gratuit" if currency == "EUR" else "Free",
                "display_annual": "Gratuit" if currency == "EUR" else "Free",
                "features": PLAN_FEATURES["free"]
            },
            "pro": {
                "name": "PRO",
                "price_monthly": prices["pro"]["monthly"],
                "price_annual": prices["pro"]["annual"],
                "display_monthly": format_price(prices["pro"]["monthly"]),
                "display_annual": format_price(prices["pro"]["annual"] // 12),
                "features": PLAN_FEATURES["pro"]
            },
            "pro_plus": {
                "name": "PRO+",
                "price_monthly": prices["pro_plus"]["monthly"],
                "price_annual": prices["pro_plus"]["annual"],
                "display_monthly": format_price(prices["pro_plus"]["monthly"]),
                "display_annual": format_price(prices["pro_plus"]["annual"] // 12),
                "features": PLAN_FEATURES["pro_plus"]
            }
        }
    }


@router.get("/check-feature/{feature}")
async def check_feature(feature: str, user=Depends(get_current_user)):
    """Check if user has access to a specific feature"""
    user_doc = await db.users.find_one({"user_id": user["user_id"]})
    effective_plan = get_user_effective_plan(user_doc)
    features = PLAN_FEATURES.get(effective_plan, PLAN_FEATURES["free"])
    
    has_feature = features.get(feature, False)
    
    return {
        "feature": feature,
        "has_access": has_feature,
        "plan": effective_plan,
        "upgrade_required": not has_feature
    }


@router.post("/set-currency")
async def set_currency(request: Request, user=Depends(get_current_user)):
    """Set user's preferred currency"""
    data = await request.json()
    currency = data.get("currency", "EUR").upper()
    
    if currency not in ["EUR", "USD", "GBP"]:
        raise HTTPException(status_code=400, detail="Invalid currency")
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"currency": currency, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "currency": currency}
