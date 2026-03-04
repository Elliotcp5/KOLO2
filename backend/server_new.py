# KOLO - Real Estate CRM Backend (Refactored)
# Main server file - orchestrates all routes

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
import os
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import routes
from routes.auth import router as auth_router
from routes.prospects import router as prospects_router
from routes.tasks import router as tasks_router
from routes.payments import router as payments_router
from routes.webhooks import router as webhooks_router
from routes.notifications import router as notifications_router
from database import init_db, get_db

# Background scheduler
async def run_background_scheduler():
    """Background job scheduler for trial expiration checks"""
    from datetime import datetime, timezone
    
    while True:
        try:
            db = get_db()
            now = datetime.now(timezone.utc)
            
            # Check expired trials
            expired_result = await db.users.update_many(
                {
                    "subscription_status": "trialing",
                    "trial_ends_at": {"$lt": now.isoformat()}
                },
                {"$set": {"subscription_status": "expired"}}
            )
            
            if expired_result.modified_count > 0:
                logger.info(f"Marked {expired_result.modified_count} trials as expired")
            
            await asyncio.sleep(3600)  # Check every hour
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Background scheduler error: {e}")
            await asyncio.sleep(60)

scheduler_task = None

def start_background_scheduler():
    global scheduler_task
    if scheduler_task is None:
        scheduler_task = asyncio.create_task(run_background_scheduler())
        logger.info("Background scheduler started")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    logger.info("Database connected")
    start_background_scheduler()
    logger.info("Background notification scheduler started")
    yield
    # Shutdown
    global scheduler_task
    if scheduler_task:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass

# Create app
app = FastAPI(
    title="KOLO - CRM Immobilier",
    description="API backend for KOLO real estate CRM",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers under /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(prospects_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(webhooks_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")

# Root endpoint
@app.get("/api/")
async def root():
    return {
        "status": "healthy",
        "service": "KOLO CRM API",
        "version": "2.0.0"
    }

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
