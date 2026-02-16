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

# VAPID keys for web push
# These should match the public key in the frontend
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', 'your-private-key-here')
VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
VAPID_CLAIMS = {
    "sub": "mailto:contact@trykolo.io"
}

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
        payload = json.dumps({
            "title": title,
            "body": body,
            "icon": "/logo192.png",
            "badge": "/logo192.png",
            "url": url,
            "tag": "kolo-daily-reminder"
        })
        
        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS
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
        return
    
    logger.info(f"Found {len(user_tasks)} users with tasks today")
    
    sent_count = 0
    failed_count = 0
    
    for user_id, tasks in user_tasks.items():
        # Get push subscription
        subscription = await get_push_subscription(user_id)
        
        if not subscription:
            logger.debug(f"No push subscription for user {user_id}")
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
    
    logger.info(f"Daily reminders complete: {sent_count} sent, {failed_count} failed")

async def check_and_generate_follow_up_tasks():
    """Check for inactive prospects and generate follow-up tasks"""
    logger.info("Checking for inactive prospects...")
    
    now = datetime.now(timezone.utc)
    one_week_ago = now - timedelta(days=7)
    
    # Find prospects that are not closed/lost and have no recent activity
    prospects = await db.prospects.find({
        "status": {"$nin": ["closed", "lost"]},
        "$or": [
            {"last_activity_date": {"$lt": one_week_ago.isoformat()}},
            {"last_activity_date": None}
        ]
    }, {"_id": 0}).to_list(10000)
    
    tasks_created = 0
    
    for prospect in prospects:
        user_id = prospect.get("user_id")
        prospect_id = prospect.get("prospect_id")
        
        # Check if there's already an uncompleted auto-generated task
        existing_task = await db.tasks.find_one({
            "prospect_id": prospect_id,
            "user_id": user_id,
            "auto_generated": True,
            "completed": False
        })
        
        if not existing_task:
            # Create a new follow-up task
            task = {
                "task_id": f"task_auto_{prospect_id}_{int(now.timestamp())}",
                "user_id": user_id,
                "prospect_id": prospect_id,
                "title": f"Suivi {prospect.get('full_name', 'Prospect')}",
                "description": "Aucune activité depuis plus d'une semaine. Pensez à recontacter ce prospect.",
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

async def run_scheduler():
    """Run the scheduler loop"""
    logger.info("KOLO Notification Scheduler started")
    
    while True:
        try:
            # Check current time
            now = datetime.now(timezone.utc)
            
            # Run at 8:00 AM UTC (9:00 AM Paris time)
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
    await check_and_generate_follow_up_tasks()
    await send_daily_reminders()
    logger.info("Job complete")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--once":
        # Run once for testing
        asyncio.run(run_once())
    else:
        # Run scheduler loop
        asyncio.run(run_scheduler())
