"""
KOLO Push Notification Scheduler
Sends daily task reminders to users with push subscriptions
"""
import asyncio
import os
import logging
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from pywebpush import webpush, WebPushException
import json
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# VAPID configuration
VAPID_PRIVATE_KEY_FILE = os.environ.get('VAPID_PRIVATE_KEY_FILE', '/app/backend/vapid_private.pem')
VAPID_EMAIL = os.environ.get('VAPID_EMAIL', 'mailto:contact@trykolo.io')

async def get_users_with_tasks_today():
    """Get users who have tasks due today or overdue"""
    now = datetime.now(timezone.utc)
    end_of_today = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    # Find all uncompleted tasks due today or overdue
    tasks = await db.tasks.find({
        "completed": False,
        "due_date": {"$lte": end_of_today.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    # Group by user_id
    user_tasks = {}
    for task in tasks:
        user_id = task.get("user_id")
        if user_id not in user_tasks:
            user_tasks[user_id] = []
        user_tasks[user_id].append(task)
    
    return user_tasks

async def get_push_subscription(user_id: str):
    """Get push subscription for a user"""
    sub = await db.push_subscriptions.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    return sub.get("subscription") if sub else None

async def send_push_notification(subscription: dict, title: str, body: str, url: str = "/app"):
    """Send a push notification to a subscription"""
    try:
        # Validate subscription has required fields
        if not subscription.get("endpoint") or not subscription.get("keys"):
            logger.warning("Invalid subscription format")
            return False
        
        # Skip test/mock subscriptions
        if "test.push.com" in subscription.get("endpoint", ""):
            logger.info("Skipping test subscription")
            return True
        
        payload = json.dumps({
            "title": title,
            "body": body,
            "icon": "/logo192.png",
            "badge": "/logo192.png",
            "url": url,
            "tag": "kolo-daily-reminder"
        })
        
        # Check if VAPID key file exists
        if not os.path.exists(VAPID_PRIVATE_KEY_FILE):
            logger.warning(f"VAPID key file not found: {VAPID_PRIVATE_KEY_FILE}")
            return False
        
        # Read private key from file
        try:
            with open(VAPID_PRIVATE_KEY_FILE, 'r') as f:
                vapid_private_key = f.read().strip()
        except Exception as e:
            logger.error(f"Failed to read VAPID key file: {e}")
            return False
        
        # Validate key format
        if not vapid_private_key:
            logger.error("VAPID key file is empty")
            return False
        
        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=vapid_private_key,
            vapid_claims={"sub": VAPID_EMAIL}
        )
        
        logger.info(f"Push notification sent successfully")
        return True
        
    except WebPushException as e:
        logger.error(f"Push notification failed: {e}")
        
        # If subscription is expired/invalid, remove it
        if e.response and e.response.status_code in [404, 410]:
            logger.info("Removing invalid subscription")
            await db.push_subscriptions.delete_one({"subscription.endpoint": subscription.get("endpoint")})
        
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending push: {e}")
        return False

async def send_daily_reminders():
    """Main function to send daily task reminders"""
    logger.info("Starting daily reminder job...")
    
    # Get users with tasks
    user_tasks = await get_users_with_tasks_today()
    
    if not user_tasks:
        logger.info("No tasks due today")
        return {"sent": 0, "failed": 0, "no_subscription": 0}
    
    logger.info(f"Found {len(user_tasks)} users with tasks today")
    
    sent_count = 0
    failed_count = 0
    no_sub_count = 0
    
    for user_id, tasks in user_tasks.items():
        # Get push subscription
        subscription = await get_push_subscription(user_id)
        
        if not subscription:
            logger.debug(f"No push subscription for user {user_id}")
            no_sub_count += 1
            continue
        
        # Build notification message
        task_count = len(tasks)
        
        if task_count == 1:
            # Single task - show the task title
            title = "KOLO - Rappel"
            body = tasks[0].get("title", "Vous avez une tâche à faire")
        else:
            # Multiple tasks
            title = "KOLO - Vos tâches du jour"
            body = f"Vous avez {task_count} tâches à effectuer aujourd'hui"
        
        # Send notification
        success = await send_push_notification(subscription, title, body)
        
        if success:
            sent_count += 1
        else:
            failed_count += 1
    
    logger.info(f"Daily reminders complete: {sent_count} sent, {failed_count} failed, {no_sub_count} no subscription")
    return {"sent": sent_count, "failed": failed_count, "no_subscription": no_sub_count}

async def check_and_generate_follow_up_tasks():
    """Check for prospects that need follow-up tasks based on specific rules:
    - Prospect created more than 2 days ago with NO tasks linked
    - Prospect with no completed tasks in the last 7 days AND no uncompleted tasks linked
    """
    logger.info("Checking for prospects needing follow-up tasks...")
    
    now = datetime.now(timezone.utc)
    two_days_ago = now - timedelta(days=2)
    one_week_ago = now - timedelta(days=7)
    
    # Find all active prospects (not closed/lost)
    prospects = await db.prospects.find({
        "status": {"$nin": ["closed", "lost"]}
    }, {"_id": 0}).to_list(10000)
    
    tasks_created = 0
    
    for prospect in prospects:
        user_id = prospect.get("user_id")
        prospect_id = prospect.get("prospect_id")
        created_at = prospect.get("created_at")
        
        # Check if there's already an uncompleted task for this prospect (any task, not just auto)
        existing_uncompleted_task = await db.tasks.find_one({
            "prospect_id": prospect_id,
            "completed": False
        })
        
        # If there's already an uncompleted task linked, skip this prospect
        if existing_uncompleted_task:
            continue
        
        # Check if there's already an uncompleted auto-generated follow-up task
        existing_auto_task = await db.tasks.find_one({
            "prospect_id": prospect_id,
            "user_id": user_id,
            "auto_generated": True,
            "completed": False
        })
        
        if existing_auto_task:
            continue
        
        should_create_task = False
        
        # Rule 1: Prospect created more than 2 days ago with NO tasks at all
        if created_at:
            try:
                if isinstance(created_at, str):
                    # Handle ISO format
                    created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                else:
                    created_date = created_at
                
                if created_date.tzinfo is None:
                    created_date = created_date.replace(tzinfo=timezone.utc)
                
                # Check if prospect is older than 2 days
                if created_date < two_days_ago:
                    # Check if there are ANY tasks for this prospect
                    any_task = await db.tasks.find_one({"prospect_id": prospect_id})
                    if not any_task:
                        should_create_task = True
                        logger.info(f"Rule 1: Prospect {prospect_id} created {(now - created_date).days} days ago with no tasks")
            except Exception as e:
                logger.error(f"Error parsing created_at for prospect {prospect_id}: {e}")
        
        # Rule 2: No completed tasks in the last 7 days AND no pending tasks
        if not should_create_task:
            # Find the most recent completed task for this prospect
            recent_completed_task = await db.tasks.find_one(
                {
                    "prospect_id": prospect_id,
                    "completed": True
                },
                sort=[("completed_at", -1)]
            )
            
            if recent_completed_task:
                completed_at = recent_completed_task.get("completed_at")
                if completed_at:
                    try:
                        if isinstance(completed_at, str):
                            completed_date = datetime.fromisoformat(completed_at.replace('Z', '+00:00'))
                        else:
                            completed_date = completed_at
                        
                        if completed_date.tzinfo is None:
                            completed_date = completed_date.replace(tzinfo=timezone.utc)
                        
                        # If no task completed in the last 7 days
                        if completed_date < one_week_ago:
                            should_create_task = True
                            logger.info(f"Rule 2: Prospect {prospect_id} last task completed {(now - completed_date).days} days ago")
                    except Exception as e:
                        logger.error(f"Error parsing completed_at: {e}")
        
        if should_create_task:
            # Create a new follow-up task
            task = {
                "task_id": f"task_auto_{prospect_id}_{int(now.timestamp())}",
                "user_id": user_id,
                "prospect_id": prospect_id,
                "title": f"Suivi {prospect.get('full_name', 'Prospect')}",
                "description": "Tâche de suivi générée automatiquement.",
                "task_type": "follow_up",
                "due_date": now.isoformat(),
                "completed": False,
                "auto_generated": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            
            await db.tasks.insert_one(task)
            tasks_created += 1
            
            # Update prospect with next task info
            await db.prospects.update_one(
                {"prospect_id": prospect_id},
                {"$set": {
                    "next_task_id": task["task_id"],
                    "next_task_date": now.isoformat(),
                    "next_task_title": task["title"],
                    "updated_at": now.isoformat()
                }}
            )
    
    logger.info(f"Generated {tasks_created} follow-up tasks")
    return {"tasks_created": tasks_created}

async def run_scheduler():
    """Run the scheduler loop"""
    logger.info("KOLO Notification Scheduler started")
    
    while True:
        try:
            # Check current time
            now = datetime.now(timezone.utc)
            
            # Run at 8:00 AM UTC (9:00 AM Paris time in winter, 10:00 AM in summer)
            target_hour = 8
            
            if now.hour == target_hour and now.minute < 5:
                logger.info("Running scheduled jobs...")
                
                # Generate follow-up tasks first
                await check_and_generate_follow_up_tasks()
                
                # Then send reminders
                await send_daily_reminders()
                
                # Wait until next hour to avoid running multiple times
                await asyncio.sleep(3600)
            else:
                # Check every minute
                await asyncio.sleep(60)
                
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
            await asyncio.sleep(60)

async def run_once():
    """Run the notification job once (for testing or manual trigger)"""
    logger.info("Running notification job (manual trigger)...")
    tasks_result = await check_and_generate_follow_up_tasks()
    notif_result = await send_daily_reminders()
    logger.info("Job complete")
    return {**tasks_result, **notif_result}

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--once":
        # Run once for testing
        result = asyncio.run(run_once())
        print(json.dumps(result, indent=2))
    else:
        # Run scheduler loop
        asyncio.run(run_scheduler())
