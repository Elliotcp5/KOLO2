"""
Cron Routes
Handles scheduled jobs like trial reminders and weekly reports
"""

from fastapi import APIRouter, HTTPException, Request, Header
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cron", tags=["cron"])

# Import shared dependencies
from database import db

# Cron key for authentication
CRON_SECRET = "kolo_cron_secret_2026"


def verify_cron_key(x_cron_key: Optional[str] = Header(None)):
    """Verify cron request authentication"""
    if x_cron_key != CRON_SECRET:
        raise HTTPException(status_code=401, detail="Invalid cron key")
    return True


@router.post("/trial-emails")
async def send_trial_reminder_emails(request: Request, x_cron_key: str = Header(None)):
    """Send trial reminder emails (J+7, J+12, J+14)"""
    verify_cron_key(x_cron_key)
    
    now = datetime.now(timezone.utc)
    results = {
        "7_days_reminder": 0,
        "12_days_reminder": 0,
        "expired_notification": 0
    }
    errors = []
    
    try:
        from email_service import send_trial_reminder_email
        
        # Find users with trialing status
        trialing_users = await db.users.find({
            "subscription_status": "trialing"
        }).to_list(length=1000)
        
        for user in trialing_users:
            trial_ends_str = user.get("trial_ends_at")
            if not trial_ends_str:
                continue
            
            try:
                trial_ends = datetime.fromisoformat(trial_ends_str.replace('Z', '+00:00'))
                days_remaining = (trial_ends - now).days
                
                email = user.get("email")
                name = user.get("name", user.get("full_name", ""))
                
                # 7 days remaining reminder
                if days_remaining == 7:
                    sent_7 = user.get("trial_reminder_7_sent", False)
                    if not sent_7:
                        success = await send_trial_reminder_email(email, name, days_remaining)
                        if success:
                            await db.users.update_one(
                                {"user_id": user["user_id"]},
                                {"$set": {"trial_reminder_7_sent": True}}
                            )
                            results["7_days_reminder"] += 1
                
                # 2 days remaining (J+12)
                elif days_remaining == 2:
                    sent_12 = user.get("trial_reminder_12_sent", False)
                    if not sent_12:
                        success = await send_trial_reminder_email(email, name, days_remaining)
                        if success:
                            await db.users.update_one(
                                {"user_id": user["user_id"]},
                                {"$set": {"trial_reminder_12_sent": True}}
                            )
                            results["12_days_reminder"] += 1
                
                # Trial expired (J+14)
                elif days_remaining <= 0:
                    sent_expired = user.get("trial_expired_sent", False)
                    if not sent_expired:
                        success = await send_trial_reminder_email(email, name, 0)
                        if success:
                            await db.users.update_one(
                                {"user_id": user["user_id"]},
                                {"$set": {
                                    "trial_expired_sent": True,
                                    "subscription_status": "expired"
                                }}
                            )
                            results["expired_notification"] += 1
                            
            except Exception as e:
                errors.append(f"Error processing user {user.get('email')}: {str(e)}")
                logger.error(f"Trial email error for {user.get('email')}: {e}")
                
    except Exception as e:
        logger.error(f"Trial emails cron failed: {e}")
        errors.append(str(e))
    
    return {
        "success": True,
        "emails_sent": results,
        "errors": errors
    }


@router.post("/weekly-reports")
async def send_weekly_reports(request: Request, x_cron_key: str = Header(None)):
    """Send weekly reports to PRO+ users"""
    verify_cron_key(x_cron_key)
    
    results = {"sent": 0, "skipped": 0}
    errors = []
    
    try:
        from email_service import send_weekly_report_email
        from routes.plans import get_user_effective_plan
        
        # Find PRO+ users
        users = await db.users.find({
            "subscription_status": {"$in": ["active", "trialing"]}
        }).to_list(length=1000)
        
        for user in users:
            effective_plan = get_user_effective_plan(user)
            
            if effective_plan != "pro_plus":
                results["skipped"] += 1
                continue
            
            try:
                email = user.get("email")
                name = user.get("name", user.get("full_name", ""))
                user_id = user["user_id"]
                
                # Get weekly stats
                now = datetime.now(timezone.utc)
                week_start = now - timedelta(days=7)
                
                # Count prospects added
                new_prospects = await db.prospects.count_documents({
                    "user_id": user_id,
                    "created_at": {"$gte": week_start.isoformat()}
                })
                
                # Count tasks completed
                tasks_completed = await db.tasks.count_documents({
                    "user_id": user_id,
                    "completed": True,
                    "completed_at": {"$gte": week_start.isoformat()}
                })
                
                # Count sales
                sales = await db.prospects.find({
                    "user_id": user_id,
                    "status": {"$in": ["vendu", "sold"]},
                    "closed_date": {"$gte": week_start.isoformat()}
                }).to_list(length=100)
                
                revenue = sum(s.get("commission_amount", 0) for s in sales)
                
                # Get hot prospects
                hot_prospects = await db.prospects.find({
                    "user_id": user_id,
                    "heat_score": {"$gte": 70},
                    "status": {"$nin": ["vendu", "perdu", "sold", "lost"]}
                }).to_list(length=5)
                
                hot_names = [p.get("name", "Client") for p in hot_prospects]
                
                stats = {
                    "new_prospects": new_prospects,
                    "tasks_completed": tasks_completed,
                    "sales_count": len(sales),
                    "revenue": revenue,
                    "hot_prospects": hot_names
                }
                
                success = await send_weekly_report_email(email, name, stats)
                if success:
                    results["sent"] += 1
                    
            except Exception as e:
                errors.append(f"Error for {user.get('email')}: {str(e)}")
                logger.error(f"Weekly report error: {e}")
                
    except Exception as e:
        logger.error(f"Weekly reports cron failed: {e}")
        errors.append(str(e))
    
    return {
        "success": True,
        "results": results,
        "errors": errors
    }
