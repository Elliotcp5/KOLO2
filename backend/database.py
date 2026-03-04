# KOLO - Database Connection & Helpers
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import Request, HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional
import os

from models import User, Task

# MongoDB connection - initialized at startup
client = None
db = None

def init_db():
    """Initialize database connection"""
    global client, db
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    return db

def get_db():
    """Get database instance"""
    global db
    if db is None:
        init_db()
    return db

async def get_user_from_session(request: Request) -> Optional[User]:
    """Get user from session token (cookie or header)"""
    session_token = request.cookies.get('session_token')
    
    if not session_token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            session_token = auth_header[7:]
    
    if not session_token:
        return None
    
    db = get_db()
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
    """Require authenticated user"""
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_active_subscription(request: Request) -> User:
    """Require user with active subscription or valid trial"""
    user = await require_auth(request)
    db = get_db()
    
    if user.subscription_status == 'active':
        return user
    
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
                await db.users.update_one(
                    {"user_id": user.user_id},
                    {"$set": {"subscription_status": "expired"}}
                )
                raise HTTPException(
                    status_code=403, 
                    detail="Votre essai gratuit est terminé. Abonnez-vous pour continuer à utiliser KOLO."
                )
        else:
            return user
    
    raise HTTPException(
        status_code=403, 
        detail="Abonnement requis pour accéder à cette fonctionnalité."
    )

async def update_prospect_next_task(prospect_id: str, user_id: str):
    """Update prospect with next scheduled task info"""
    db = get_db()
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

async def calculate_prospect_score(prospect_id: str, user_id: str, force_score: str = None):
    """Calculate prospect score (chaud/tiede/froid)"""
    db = get_db()
    now = datetime.now(timezone.utc)
    
    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user_id},
        {"_id": 0}
    )
    if not prospect:
        return None
    
    if force_score and force_score in ["chaud", "tiede", "froid"]:
        await db.prospects.update_one(
            {"prospect_id": prospect_id},
            {"$set": {
                "score": force_score,
                "score_calculated_at": now.isoformat(),
                "score_manual_override": True,
                "updated_at": now.isoformat()
            }}
        )
        return force_score
    
    last_activity = prospect.get("last_activity_date") or prospect.get("created_at")
    days_inactive = 0
    if last_activity:
        if isinstance(last_activity, str):
            last_activity = datetime.fromisoformat(last_activity.replace('Z', '+00:00'))
        if last_activity.tzinfo is None:
            last_activity = last_activity.replace(tzinfo=timezone.utc)
        days_inactive = (now - last_activity).days
    
    if days_inactive >= 21:
        await db.prospects.update_one(
            {"prospect_id": prospect_id},
            {"$set": {
                "score": "froid",
                "score_calculated_at": now.isoformat(),
                "score_manual_override": False,
                "updated_at": now.isoformat()
            }}
        )
        return "froid"
    
    if days_inactive <= 7:
        freshness_score = 100
    elif days_inactive <= 14:
        freshness_score = 60
    else:
        freshness_score = 30
    
    completeness_fields = 0
    if prospect.get("full_name"): completeness_fields += 1
    if prospect.get("phone"): completeness_fields += 1
    if prospect.get("email"): completeness_fields += 1
    if prospect.get("source") and prospect.get("source") != "manual": completeness_fields += 1
    if prospect.get("notes") and len(prospect.get("notes", "")) > 10: completeness_fields += 1
    completeness_score = (completeness_fields / 5) * 100
    
    completed_tasks = await db.tasks.count_documents({
        "prospect_id": prospect_id,
        "user_id": user_id,
        "completed": True
    })
    if completed_tasks == 0:
        tasks_score = 0
    elif completed_tasks == 1:
        tasks_score = 50
    else:
        tasks_score = 100
    
    total_score = (freshness_score * 0.4) + (completeness_score * 0.3) + (tasks_score * 0.3)
    
    if total_score >= 70:
        score_label = "chaud"
    elif total_score >= 40:
        score_label = "tiede"
    else:
        score_label = "froid"
    
    await db.prospects.update_one(
        {"prospect_id": prospect_id},
        {"$set": {
            "score": score_label,
            "score_calculated_at": now.isoformat(),
            "score_manual_override": False,
            "updated_at": now.isoformat()
        }}
    )
    
    return score_label
