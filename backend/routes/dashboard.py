"""
Dashboard Routes
Handles ROI dashboard and analytics
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Import shared dependencies
from database import db
from utils import get_current_user, limiter


@router.get("/roi")
@limiter.limit("20/minute")
async def get_roi_dashboard(request: Request, user=Depends(get_current_user)):
    """Get ROI dashboard data for PRO+ users"""
    user_doc = await db.users.find_one({"user_id": user["user_id"]})
    
    # Check if user has ROI dashboard feature
    from routes.plans import get_user_effective_plan, PLAN_FEATURES
    effective_plan = get_user_effective_plan(user_doc)
    features = PLAN_FEATURES.get(effective_plan, PLAN_FEATURES["free"])
    
    if not features.get("roi_dashboard"):
        return {
            "locked": True,
            "upgrade_required": "pro_plus",
            "data": None
        }
    
    # Get current month stats
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get sold prospects this month
    sold_prospects = await db.prospects.find({
        "user_id": user["user_id"],
        "status": {"$in": ["vendu", "sold"]},
        "closed_date": {"$gte": month_start.isoformat()}
    }).to_list(length=100)
    
    # Calculate totals
    total_commission = sum(p.get("commission_amount", 0) for p in sold_prospects)
    sales_count = len(sold_prospects)
    
    # Get subscription cost (for ROI calculation)
    plan = user_doc.get("plan", "free")
    billing_period = user_doc.get("billing_period", "monthly")
    currency = user_doc.get("currency", "EUR")
    
    from routes.plans import PRICING
    prices = PRICING.get(currency, PRICING["EUR"])
    plan_prices = prices.get(plan, prices["free"])
    monthly_cost = plan_prices["monthly"] / 100 if billing_period == "monthly" else plan_prices["annual"] / 1200
    
    # Calculate ROI
    roi_multiplier = (total_commission / monthly_cost) if monthly_cost > 0 else 0
    
    # Get previous month for comparison
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)
    prev_month_end = month_start - timedelta(seconds=1)
    
    prev_sold = await db.prospects.find({
        "user_id": user["user_id"],
        "status": {"$in": ["vendu", "sold"]},
        "closed_date": {
            "$gte": prev_month_start.isoformat(),
            "$lte": prev_month_end.isoformat()
        }
    }).to_list(length=100)
    
    prev_commission = sum(p.get("commission_amount", 0) for p in prev_sold)
    
    # Calculate trend
    trend = 0
    if prev_commission > 0:
        trend = ((total_commission - prev_commission) / prev_commission) * 100
    
    return {
        "locked": False,
        "data": {
            "current_month": {
                "revenue": total_commission,
                "sales_count": sales_count,
                "roi_multiplier": round(roi_multiplier, 1),
                "subscription_cost": monthly_cost
            },
            "previous_month": {
                "revenue": prev_commission,
                "sales_count": len(prev_sold)
            },
            "trend_percentage": round(trend, 1),
            "currency": currency,
            "period": {
                "start": month_start.isoformat(),
                "end": now.isoformat()
            }
        }
    }


@router.get("/stats")
@limiter.limit("30/minute")
async def get_dashboard_stats(request: Request, user=Depends(get_current_user)):
    """Get general dashboard statistics"""
    user_id = user["user_id"]
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Count active prospects
    active_prospects = await db.prospects.count_documents({
        "user_id": user_id,
        "status": {"$nin": ["vendu", "perdu", "sold", "lost"]}
    })
    
    # Count today's tasks
    tasks_today = await db.tasks.count_documents({
        "user_id": user_id,
        "scheduled_date": {"$gte": today_start.isoformat()}
    })
    
    completed_today = await db.tasks.count_documents({
        "user_id": user_id,
        "scheduled_date": {"$gte": today_start.isoformat()},
        "completed": True
    })
    
    # Get user streak
    user_doc = await db.users.find_one({"user_id": user_id})
    streak = user_doc.get("streak_current", 0) if user_doc else 0
    
    return {
        "active_prospects": active_prospects,
        "tasks_today": tasks_today,
        "completed_today": completed_today,
        "completion_rate": round((completed_today / tasks_today * 100) if tasks_today > 0 else 0),
        "streak": streak
    }
