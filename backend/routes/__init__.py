"""
KOLO API Routes
Modular router structure for better maintainability
"""

from .plans import router as plans_router
from .ai import router as ai_router
from .interactions import router as interactions_router
from .dashboard import router as dashboard_router
from .cron import router as cron_router

__all__ = [
    'plans_router',
    'ai_router', 
    'interactions_router',
    'dashboard_router',
    'cron_router'
]
