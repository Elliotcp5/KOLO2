# KOLO - Tasks Routes
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
import uuid
import os
import logging

from models import Task, CreateTaskRequest, UpdateTaskRequest
from database import get_db, require_active_subscription, update_prospect_next_task, calculate_prospect_score

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tasks", tags=["tasks"])

@router.get("")
async def list_tasks(request: Request, include_completed: bool = True):
    """List all tasks for user"""
    user = await require_active_subscription(request)
    db = get_db()
    
    query = {"user_id": user.user_id}
    if not include_completed:
        query["completed"] = False
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(1000)
    
    for task in tasks:
        if task.get("prospect_id"):
            prospect = await db.prospects.find_one(
                {"prospect_id": task["prospect_id"]},
                {"_id": 0, "full_name": 1, "phone": 1, "email": 1}
            )
            if prospect:
                task["prospect"] = prospect
    
    return {"tasks": tasks}

@router.get("/today")
async def list_today_tasks(request: Request):
    """List tasks for today"""
    user = await require_active_subscription(request)
    db = get_db()
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    tasks = await db.tasks.find({
        "user_id": user.user_id,
        "completed": False,
        "$or": [
            {"due_date": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}},
            {"due_date": {"$lt": today_start.isoformat()}}  # Overdue
        ]
    }, {"_id": 0}).sort("due_date", 1).to_list(100)
    
    for task in tasks:
        if task.get("prospect_id"):
            prospect = await db.prospects.find_one(
                {"prospect_id": task["prospect_id"]},
                {"_id": 0, "full_name": 1, "phone": 1, "email": 1}
            )
            if prospect:
                task["prospect"] = prospect
    
    return {"tasks": tasks}

@router.post("")
async def create_task(request: Request, task_data: CreateTaskRequest):
    """Create new task"""
    user = await require_active_subscription(request)
    db = get_db()
    
    task = Task(
        user_id=user.user_id,
        prospect_id=task_data.prospect_id,
        title=task_data.title,
        description=task_data.description,
        task_type=task_data.task_type,
        due_date=task_data.due_date
    )
    
    task_doc = task.model_dump()
    task_doc['due_date'] = task_doc['due_date'].isoformat()
    task_doc['created_at'] = task_doc['created_at'].isoformat()
    task_doc['updated_at'] = task_doc['updated_at'].isoformat()
    
    await db.tasks.insert_one(task_doc)
    
    if task_data.prospect_id:
        await update_prospect_next_task(task_data.prospect_id, user.user_id)
    
    return {"task_id": task.task_id, "message": "Task created"}

@router.put("/{task_id}")
async def update_task(request: Request, task_id: str, update_data: UpdateTaskRequest):
    """Update task"""
    user = await require_active_subscription(request)
    db = get_db()
    
    update_dict = {}
    for k, v in update_data.model_dump().items():
        if v is not None:
            if k == 'due_date':
                update_dict[k] = v.isoformat() if isinstance(v, datetime) else v
            else:
                update_dict[k] = v
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if update_data.completed:
        update_dict["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    task = await db.tasks.find_one(
        {"task_id": task_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await db.tasks.update_one(
        {"task_id": task_id, "user_id": user.user_id},
        {"$set": update_dict}
    )
    
    if task.get("prospect_id"):
        await update_prospect_next_task(task["prospect_id"], user.user_id)
    
    return {"message": "Task updated"}

@router.delete("/{task_id}")
async def delete_task(request: Request, task_id: str):
    """Delete task"""
    user = await require_active_subscription(request)
    db = get_db()
    
    task = await db.tasks.find_one(
        {"task_id": task_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await db.tasks.delete_one({"task_id": task_id, "user_id": user.user_id})
    
    if task.get("prospect_id"):
        await update_prospect_next_task(task["prospect_id"], user.user_id)
    
    return {"message": "Task deleted"}

@router.post("/{task_id}/complete")
async def complete_task(request: Request, task_id: str):
    """Mark task as completed"""
    user = await require_active_subscription(request)
    db = get_db()
    
    task = await db.tasks.find_one(
        {"task_id": task_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await db.tasks.update_one(
        {"task_id": task_id, "user_id": user.user_id},
        {"$set": {
            "completed": True,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if task.get("prospect_id"):
        await update_prospect_next_task(task["prospect_id"], user.user_id)
        
        await db.prospects.update_one(
            {"prospect_id": task["prospect_id"]},
            {"$set": {"last_activity_date": datetime.now(timezone.utc).isoformat()}}
        )
        await calculate_prospect_score(task["prospect_id"], user.user_id)
    
    return {"message": "Task completed"}

@router.get("/ai-suggestions")
async def get_ai_task_suggestions(request: Request):
    """Get AI-powered task suggestions"""
    user = await require_active_subscription(request)
    db = get_db()
    
    prospects = await db.prospects.find(
        {"user_id": user.user_id, "status": {"$nin": ["closed", "lost"]}},
        {"_id": 0}
    ).to_list(50)
    
    if not prospects:
        return {"suggestions": [], "message": "Ajoutez des prospects pour recevoir des suggestions"}
    
    now = datetime.now(timezone.utc)
    prospects_context = []
    
    for p in prospects:
        pending_tasks = await db.tasks.count_documents({
            "prospect_id": p["prospect_id"],
            "user_id": user.user_id,
            "completed": False
        })
        
        last_activity = p.get("last_activity_date") or p.get("created_at")
        days_inactive = 0
        if last_activity:
            if isinstance(last_activity, str):
                last_activity = datetime.fromisoformat(last_activity.replace('Z', '+00:00'))
            if last_activity.tzinfo is None:
                last_activity = last_activity.replace(tzinfo=timezone.utc)
            days_inactive = (now - last_activity).days
        
        prospects_context.append({
            "prospect_id": p["prospect_id"],
            "name": p["full_name"],
            "status": p.get("status", "new"),
            "score": p.get("score"),
            "days_inactive": days_inactive,
            "pending_tasks": pending_tasks
        })
    
    suggestions = []
    for p in prospects_context:
        if p["pending_tasks"] == 0 and p["days_inactive"] >= 3:
            task_type = "sms" if p["days_inactive"] < 5 else "call"
            urgency = "haute" if p["days_inactive"] >= 7 or p["score"] == "chaud" else "moyenne"
            
            suggestions.append({
                "prospect_id": p["prospect_id"],
                "prospect_name": p["name"],
                "task_title": f"Relancer {p['name'].split()[0]}",
                "task_type": task_type,
                "suggested_date": now.strftime("%Y-%m-%d"),
                "urgency": urgency,
                "reason": f"Inactif depuis {p['days_inactive']} jours"
            })
    
    if len(suggestions) < 3:
        try:
            from emergentintegrations.llm.anthropic import AnthropicClient
            llm_key = os.environ.get("EMERGENT_LLM_KEY")
            
            if llm_key:
                prompt = f"""Tu es un assistant CRM. Analyse ces prospects et suggère 1-2 actions prioritaires.
Prospects: {prospects_context[:10]}
Réponds en JSON: {{"suggestions": [{{"prospect_id": "...", "prospect_name": "...", "task_title": "...", "task_type": "call|sms|email", "urgency": "haute|moyenne", "reason": "..."}}]}}
Max 2 suggestions. Pas de prospect avec des tâches en cours."""

                client = AnthropicClient(api_key=llm_key)
                response = await client.send_message(
                    message=prompt,
                    model="claude-3-haiku-20240307",
                    max_tokens=500
                )
                
                import json
                try:
                    ai_data = json.loads(response)
                    if ai_data.get("suggestions"):
                        for s in ai_data["suggestions"]:
                            s["suggested_date"] = now.strftime("%Y-%m-%d")
                            if s not in suggestions:
                                suggestions.append(s)
                except:
                    pass
        except Exception as e:
            logger.error(f"AI suggestions error: {e}")
    
    return {"suggestions": suggestions[:5]}

@router.post("/ai-suggestions/accept")
async def accept_ai_suggestion(request: Request):
    """Accept and create task from AI suggestion"""
    user = await require_active_subscription(request)
    db = get_db()
    
    body = await request.json()
    prospect_id = body.get("prospect_id")
    task_title = body.get("task_title")
    task_type = body.get("task_type", "follow_up")
    suggested_date = body.get("suggested_date")
    
    if not prospect_id or not task_title:
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    prospect = await db.prospects.find_one(
        {"prospect_id": prospect_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    due_date = datetime.now(timezone.utc)
    if suggested_date:
        try:
            due_date = datetime.fromisoformat(suggested_date).replace(tzinfo=timezone.utc)
        except:
            pass
    
    task = Task(
        user_id=user.user_id,
        prospect_id=prospect_id,
        title=task_title,
        task_type=task_type,
        due_date=due_date,
        auto_generated=True
    )
    
    task_doc = task.model_dump()
    task_doc['due_date'] = task_doc['due_date'].isoformat()
    task_doc['created_at'] = task_doc['created_at'].isoformat()
    task_doc['updated_at'] = task_doc['updated_at'].isoformat()
    
    await db.tasks.insert_one(task_doc)
    await update_prospect_next_task(prospect_id, user.user_id)
    
    return {"task_id": task.task_id, "message": "Tâche créée"}
