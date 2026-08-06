"""
KOLO Private Dashboard (/dashboard on trykolo.io)
==================================================

Standalone analytics dashboard for the founder. Completely separate from the
old super_admin logic — no session cookies, no allowlist, no shared middleware.

Auth model
----------
Single hardcoded email + bcrypt-hashed password stored in .env.
Login exchanges creds for a JWT (7 days) which is passed as
`Authorization: Bearer <token>` on every protected call.

Public tracking endpoints
-------------------------
- POST /api/track/pageview  — page view sent by the marketing frontend
- POST /api/track/cta-click — CTA click sent by the marketing frontend

Protected analytics endpoints
-----------------------------
- POST /api/dashboard/login
- GET  /api/dashboard/me
- GET  /api/dashboard/summary
- GET  /api/dashboard/users
- GET  /api/dashboard/pageviews
- GET  /api/dashboard/timeseries
- GET  /api/dashboard/top-pages
- GET  /api/dashboard/referrers
- GET  /api/dashboard/cta-clicks
"""

from __future__ import annotations

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Any, Dict

import bcrypt
import jwt as pyjwt
import httpx
from fastapi import APIRouter, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from user_agents import parse as parse_ua

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DASHBOARD_EMAIL = (os.environ.get("DASHBOARD_EMAIL") or "").strip().lower()
DASHBOARD_PASSWORD_HASH = os.environ.get("DASHBOARD_PASSWORD_HASH") or ""
DASHBOARD_JWT_SECRET = os.environ.get("DASHBOARD_JWT_SECRET") or "kolo_dashboard_dev"
JWT_ALG = "HS256"
JWT_TTL_DAYS = 7

# In-memory cache for GeoIP lookups (IP -> {country, city}) to avoid burning
# the 1000 req/day quota on repeat visitors from the same IP.
_geoip_cache: Dict[str, Dict[str, str]] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _create_token(email: str) -> str:
    payload = {
        "sub": email,
        "role": "dashboard",
        "iat": int(_now().timestamp()),
        "exp": int((_now() + timedelta(days=JWT_TTL_DAYS)).timestamp()),
    }
    return pyjwt.encode(payload, DASHBOARD_JWT_SECRET, algorithm=JWT_ALG)


def _decode_token(token: str) -> Dict[str, Any]:
    try:
        return pyjwt.decode(token, DASHBOARD_JWT_SECRET, algorithms=[JWT_ALG])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _require_auth(request: Request) -> Dict[str, Any]:
    auth = request.headers.get("authorization") or request.headers.get("Authorization") or ""
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth.split(" ", 1)[1].strip()
    payload = _decode_token(token)
    if (payload.get("sub") or "").lower() != DASHBOARD_EMAIL:
        raise HTTPException(status_code=403, detail="Forbidden")
    return payload


def _client_ip(request: Request) -> str:
    # Respect proxy headers (K8s ingress sets X-Forwarded-For)
    xff = request.headers.get("x-forwarded-for") or ""
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _lookup_geoip(ip: str) -> Dict[str, str]:
    """Query ipapi.co for country + city. Cached forever in-memory."""
    if not ip or ip in {"unknown", "127.0.0.1", "::1"}:
        return {"country": "-", "city": "-"}
    if ip in _geoip_cache:
        return _geoip_cache[ip]
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"https://ipapi.co/{ip}/json/")
            if r.status_code == 200:
                data = r.json()
                result = {
                    "country": (data.get("country_name") or "-").strip() or "-",
                    "city": (data.get("city") or "-").strip() or "-",
                }
                _geoip_cache[ip] = result
                return result
    except Exception as e:
        logger.warning(f"GeoIP lookup failed for {ip}: {e}")
    result = {"country": "-", "city": "-"}
    _geoip_cache[ip] = result
    return result


def _parse_ua(ua_string: str) -> Dict[str, str]:
    if not ua_string:
        return {"device_type": "unknown", "browser": "-", "os": "-"}
    try:
        ua = parse_ua(ua_string)
        if ua.is_mobile:
            device = "mobile"
        elif ua.is_tablet:
            device = "tablet"
        elif ua.is_bot:
            device = "bot"
        else:
            device = "desktop"
        return {
            "device_type": device,
            "browser": ua.browser.family or "-",
            "os": ua.os.family or "-",
        }
    except Exception:
        return {"device_type": "unknown", "browser": "-", "os": "-"}


# ---------------------------------------------------------------------------
# Router factory — needs `db` from server.py, so we build the router here
# and expose a function to bind it.
# ---------------------------------------------------------------------------
def build_router(db: AsyncIOMotorDatabase) -> APIRouter:
    router = APIRouter(prefix="/api")

    # --------------------- AUTH ---------------------
    @router.post("/dashboard/login")
    async def dashboard_login(request: Request):
        body = await request.json()
        email = (body.get("email") or "").strip().lower()
        password = body.get("password") or ""

        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password required")

        if email != DASHBOARD_EMAIL:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        try:
            ok = bcrypt.checkpw(password.encode("utf-8"), DASHBOARD_PASSWORD_HASH.encode("utf-8"))
        except Exception:
            ok = False
        if not ok:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = _create_token(email)
        return {"token": token, "email": email, "expires_in_days": JWT_TTL_DAYS}

    @router.get("/dashboard/me")
    async def dashboard_me(request: Request):
        payload = _require_auth(request)
        return {"email": payload["sub"], "role": payload.get("role")}

    # --------------------- TRACKING (public) ---------------------
    @router.post("/track/pageview")
    async def track_pageview(request: Request):
        try:
            body = await request.json()
        except Exception:
            body = {}
        ip = _client_ip(request)
        ua_string = request.headers.get("user-agent") or ""
        ua = _parse_ua(ua_string)
        geo = await _lookup_geoip(ip)

        doc = {
            "path": (body.get("path") or "/")[:512],
            "referrer": (body.get("referrer") or "")[:1024],
            "session_id": (body.get("session_id") or "")[:64],
            "visitor_id": (body.get("visitor_id") or "")[:64],
            "screen_width": int(body.get("screen_width") or 0) or None,
            "screen_height": int(body.get("screen_height") or 0) or None,
            "user_agent": ua_string[:512],
            "ip": ip,
            "country": geo["country"],
            "city": geo["city"],
            "device_type": ua["device_type"],
            "browser": ua["browser"],
            "os": ua["os"],
            "created_at": _now(),
        }
        await db.page_views.insert_one(doc)
        return {"ok": True}

    @router.post("/track/cta-click")
    async def track_cta_click(request: Request):
        try:
            body = await request.json()
        except Exception:
            body = {}
        ip = _client_ip(request)
        ua_string = request.headers.get("user-agent") or ""
        ua = _parse_ua(ua_string)

        doc = {
            "cta_id": (body.get("cta_id") or "unknown")[:64],
            "path": (body.get("path") or "/")[:512],
            "session_id": (body.get("session_id") or "")[:64],
            "visitor_id": (body.get("visitor_id") or "")[:64],
            "ip": ip,
            "user_agent": ua_string[:512],
            "device_type": ua["device_type"],
            "created_at": _now(),
        }
        await db.cta_clicks.insert_one(doc)
        return {"ok": True}

    # --------------------- ANALYTICS (protected) ---------------------
    @router.get("/dashboard/summary")
    async def dashboard_summary(request: Request):
        _require_auth(request)
        now = _now()
        d7 = now - timedelta(days=7)
        d30 = now - timedelta(days=30)

        # iOS users
        total_users = await db.users.count_documents({})
        new_users_7d = await db.users.count_documents({"created_at": {"$gte": d7.isoformat()}})
        new_users_30d = await db.users.count_documents({"created_at": {"$gte": d30.isoformat()}})

        plan_pipeline = [
            {"$group": {"_id": {"$ifNull": ["$subscription_plan", "free"]}, "count": {"$sum": 1}}}
        ]
        plan_dist = {}
        async for row in db.users.aggregate(plan_pipeline):
            # Legacy pro_plus records count as pro
            key = row["_id"] or "free"
            if key == "pro_plus":
                key = "pro"
            plan_dist[key] = plan_dist.get(key, 0) + row["count"]

        # Web analytics
        total_pageviews = await db.page_views.count_documents({})
        pageviews_7d = await db.page_views.count_documents({"created_at": {"$gte": d7}})
        pageviews_30d = await db.page_views.count_documents({"created_at": {"$gte": d30}})

        unique_visitors_7d_pipeline = [
            {"$match": {"created_at": {"$gte": d7}, "visitor_id": {"$ne": ""}}},
            {"$group": {"_id": "$visitor_id"}},
            {"$count": "n"},
        ]
        uv_docs = await db.page_views.aggregate(unique_visitors_7d_pipeline).to_list(1)
        unique_visitors_7d = uv_docs[0]["n"] if uv_docs else 0

        unique_sessions_7d_pipeline = [
            {"$match": {"created_at": {"$gte": d7}, "session_id": {"$ne": ""}}},
            {"$group": {"_id": "$session_id"}},
            {"$count": "n"},
        ]
        us_docs = await db.page_views.aggregate(unique_sessions_7d_pipeline).to_list(1)
        sessions_7d = us_docs[0]["n"] if us_docs else 0

        # CTA clicks
        total_cta_clicks = await db.cta_clicks.count_documents({})
        cta_clicks_7d = await db.cta_clicks.count_documents({"created_at": {"$gte": d7}})

        return {
            "generated_at": now.isoformat(),
            "users": {
                "total": total_users,
                "new_7d": new_users_7d,
                "new_30d": new_users_30d,
                "plans": plan_dist,
            },
            "web": {
                "total_pageviews": total_pageviews,
                "pageviews_7d": pageviews_7d,
                "pageviews_30d": pageviews_30d,
                "unique_visitors_7d": unique_visitors_7d,
                "sessions_7d": sessions_7d,
            },
            "conversion": {
                "total_cta_clicks": total_cta_clicks,
                "cta_clicks_7d": cta_clicks_7d,
            },
        }

    @router.get("/dashboard/users")
    async def dashboard_users(
        request: Request,
        limit: int = 500,
        hide_test: bool = True,
        plan: Optional[str] = None,
        search: Optional[str] = None,
    ):
        _require_auth(request)
        limit = max(1, min(2000, int(limit)))
        query: Dict[str, Any] = {}
        if hide_test:
            # exclude common test patterns
            query["email"] = {
                "$not": {
                    "$regex": r"(test_|@test\.com|@example\.com|newuser_|_test_|"
                              r"debug_|dup_|reg_|authme_|billing_|prospect_|"
                              r"expired@|screenshot_|health_check|score_test|"
                              r"features_|notask_|ai_full_|ai_context_|"
                              r"completed_test|task_test|today_fix|today_debug|"
                              r"stripe_|edit_test|login_test|prospect_test|"
                              r"ui_test|ui_view|ui_final|ui_v2|verify_|sms_|"
                              r"hours_test|nouveau|final_test|newtest|"
                              r"testuser|test_reset|test_authme|test_billing|"
                              r"test_prospect|test_login|test_dup|test_reg|"
                              r"test_flow|test_t1|test_format|test_phone|"
                              r"test_update|test_profile|test_tasks|"
                              r"test_lang|suivi_test|fix_today|debug_today|"
                              r"reload_test|langtest|test_onboard|test_iter|"
                              r"duptest|test@|newuser@)",
                    "$options": "i",
                }
            }
        if plan:
            query["subscription_plan"] = plan
        if search:
            existing_not = query.pop("email", None)
            regex = {"$regex": search, "$options": "i"}
            search_clauses = [{"email": regex}, {"name": regex}, {"first_name": regex}, {"last_name": regex}]
            if existing_not:
                query["$and"] = [{"email": existing_not}, {"$or": search_clauses}]
            else:
                query["$or"] = search_clauses

        projection = {
            "_id": 0,
            "user_id": 1,
            "email": 1,
            "name": 1,
            "first_name": 1,
            "last_name": 1,
            "phone": 1,
            "created_at": 1,
            "last_login_at": 1,
            "last_login_ip": 1,
            "last_login_country": 1,
            "last_login_city": 1,
            "subscription_plan": 1,
            "subscription_expires_at": 1,
            "subscription_granted_by": 1,
            "onboarding_completed": 1,
        }
        cursor = db.users.find(query, projection).sort("created_at", -1).limit(limit)
        users = await cursor.to_list(length=limit)
        # Collapse legacy pro_plus into pro so the dashboard only shows 2 plans.
        for u in users:
            if u.get("subscription_plan") == "pro_plus":
                u["subscription_plan"] = "pro"
        total = await db.users.count_documents(query)
        return {"count": len(users), "total": total, "users": users}

    @router.get("/dashboard/pageviews")
    async def dashboard_pageviews(request: Request, limit: int = 200):
        _require_auth(request)
        limit = max(1, min(2000, int(limit)))
        cursor = db.page_views.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
        rows = await cursor.to_list(length=limit)
        for r in rows:
            if isinstance(r.get("created_at"), datetime):
                r["created_at"] = r["created_at"].isoformat()
        return {"count": len(rows), "pageviews": rows}

    @router.get("/dashboard/timeseries")
    async def dashboard_timeseries(request: Request, days: int = 30):
        _require_auth(request)
        days = max(1, min(365, int(days)))
        now = _now()
        start = now - timedelta(days=days)

        # Signups per day (from ISO string created_at)
        signup_pipeline = [
            {"$match": {"created_at": {"$gte": start.isoformat()}}},
            {"$project": {"day": {"$substr": ["$created_at", 0, 10]}}},
            {"$group": {"_id": "$day", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
        ]
        signups = await db.users.aggregate(signup_pipeline).to_list(400)

        # Pageviews per day (from datetime created_at)
        pv_pipeline = [
            {"$match": {"created_at": {"$gte": start}}},
            {"$project": {"day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}}},
            {"$group": {"_id": "$day", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
        ]
        pageviews = await db.page_views.aggregate(pv_pipeline).to_list(400)

        # Sessions per day
        sess_pipeline = [
            {"$match": {"created_at": {"$gte": start}, "session_id": {"$ne": ""}}},
            {"$group": {"_id": {"day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}, "sid": "$session_id"}}},
            {"$group": {"_id": "$_id.day", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
        ]
        sessions = await db.page_views.aggregate(sess_pipeline).to_list(400)

        return {
            "days": days,
            "signups": [{"day": r["_id"], "count": r["count"]} for r in signups],
            "pageviews": [{"day": r["_id"], "count": r["count"]} for r in pageviews],
            "sessions": [{"day": r["_id"], "count": r["count"]} for r in sessions],
        }

    @router.get("/dashboard/top-pages")
    async def dashboard_top_pages(request: Request, days: int = 30, limit: int = 20):
        _require_auth(request)
        days = max(1, min(365, int(days)))
        limit = max(1, min(100, int(limit)))
        start = _now() - timedelta(days=days)
        pipeline = [
            {"$match": {"created_at": {"$gte": start}}},
            {"$group": {"_id": "$path", "count": {"$sum": 1}, "uniques": {"$addToSet": "$visitor_id"}}},
            {"$project": {"path": "$_id", "_id": 0, "count": 1, "unique_visitors": {"$size": "$uniques"}}},
            {"$sort": {"count": -1}},
            {"$limit": limit},
        ]
        pages = await db.page_views.aggregate(pipeline).to_list(limit)
        return {"pages": pages}

    @router.get("/dashboard/referrers")
    async def dashboard_referrers(request: Request, days: int = 30, limit: int = 20):
        _require_auth(request)
        days = max(1, min(365, int(days)))
        limit = max(1, min(100, int(limit)))
        start = _now() - timedelta(days=days)
        pipeline = [
            {"$match": {"created_at": {"$gte": start}}},
            {"$group": {"_id": {"$ifNull": ["$referrer", "direct"]}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit},
        ]
        refs = await db.page_views.aggregate(pipeline).to_list(limit)
        # Simplify: extract host from referrer URL
        out = []
        for r in refs:
            src = r["_id"] or "direct"
            display = src
            if src and src != "direct":
                try:
                    from urllib.parse import urlparse
                    p = urlparse(src)
                    display = p.netloc or src
                    if not display:
                        display = "direct"
                except Exception:
                    display = src
            out.append({"referrer": display, "raw": src, "count": r["count"]})
        return {"referrers": out}

    @router.get("/dashboard/geo")
    async def dashboard_geo(request: Request, days: int = 30, limit: int = 30):
        _require_auth(request)
        days = max(1, min(365, int(days)))
        limit = max(1, min(200, int(limit)))
        start = _now() - timedelta(days=days)
        pipeline = [
            {"$match": {"created_at": {"$gte": start}}},
            {"$group": {"_id": {"country": "$country", "city": "$city"}, "count": {"$sum": 1}, "uniques": {"$addToSet": "$visitor_id"}}},
            {"$project": {"country": "$_id.country", "city": "$_id.city", "_id": 0, "count": 1, "unique_visitors": {"$size": "$uniques"}}},
            {"$sort": {"count": -1}},
            {"$limit": limit},
        ]
        rows = await db.page_views.aggregate(pipeline).to_list(limit)
        return {"locations": rows}

    @router.get("/dashboard/devices")
    async def dashboard_devices(request: Request, days: int = 30):
        _require_auth(request)
        days = max(1, min(365, int(days)))
        start = _now() - timedelta(days=days)
        pipeline = [
            {"$match": {"created_at": {"$gte": start}}},
            {"$group": {"_id": "$device_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        rows = await db.page_views.aggregate(pipeline).to_list(20)
        return {"devices": [{"device": r["_id"] or "unknown", "count": r["count"]} for r in rows]}

    @router.get("/dashboard/cta-clicks")
    async def dashboard_cta_clicks(request: Request, days: int = 30):
        _require_auth(request)
        days = max(1, min(365, int(days)))
        start = _now() - timedelta(days=days)
        pipeline = [
            {"$match": {"created_at": {"$gte": start}}},
            {"$group": {"_id": "$cta_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        rows = await db.cta_clicks.aggregate(pipeline).to_list(50)
        total = await db.cta_clicks.count_documents({"created_at": {"$gte": start}})
        return {
            "total": total,
            "by_cta": [{"cta_id": r["_id"] or "unknown", "count": r["count"]} for r in rows],
        }

    # --------------------- GRANT PRO / REVOKE (protected) ---------------------
    @router.post("/dashboard/users/{user_id}/grant-plan")
    async def dashboard_grant_plan(user_id: str, request: Request):
        """
        Grant (or revoke) a subscription plan to a KOLO iOS user directly from
        the dashboard. The plan takes effect immediately on the user's next
        `/me` refresh in the iOS app.
        """
        _require_auth(request)
        body = await request.json()
        plan = (body.get("plan") or "pro").strip().lower()
        months = int(body.get("months") or 1)
        note = (body.get("note") or "").strip() or None

        if plan not in {"free", "pro"}:
            raise HTTPException(status_code=400, detail="Invalid plan (only 'free' or 'pro')")
        months = max(1, min(36, months))

        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")

        now = _now()
        if plan == "free":
            # Revoke — clear expiration + set plan back to free
            update = {
                "$set": {
                    "subscription_plan": "free",
                    "subscription_updated_at": now.isoformat(),
                    "subscription_granted_by": "dashboard",
                    "subscription_note": note,
                },
                "$unset": {"subscription_expires_at": ""},
            }
        else:
            expires_at = (now + timedelta(days=30 * months)).isoformat()
            update = {
                "$set": {
                    "subscription_plan": plan,
                    "subscription_expires_at": expires_at,
                    "subscription_granted_by": "dashboard",
                    "subscription_note": note,
                    "subscription_updated_at": now.isoformat(),
                }
            }

        await db.users.update_one({"user_id": user_id}, update)
        updated = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
        return {
            "ok": True,
            "user_id": user_id,
            "email": updated.get("email") if updated else None,
            "plan": plan,
            "months": months if plan != "free" else 0,
            "expires_at": updated.get("subscription_expires_at") if updated else None,
        }

    return router
