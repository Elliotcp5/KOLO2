"""Tests — bascule V2 → B1 + écran de reprise."""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

import pytest
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient


def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.mark.asyncio
async def test_compute_suggested_zones_fallback():
    """User sans data → fallback 75017 (jamais liste vide)."""
    from d1.migration_v2_to_b1 import compute_suggested_zones
    db = _db()
    uid = f"test_uid_{uuid.uuid4().hex[:8]}"
    await db.users.insert_one({"user_id": uid, "email": f"{uid}@t.io"})
    z = await compute_suggested_zones(db, uid)
    assert z == ["13008"]  # fallback = zone à fort volume Marseille
    await db.users.delete_one({"user_id": uid})


@pytest.mark.asyncio
async def test_compute_suggested_zones_from_estimations():
    """CP le plus fréquent dans estimations gagne."""
    from d1.migration_v2_to_b1 import compute_suggested_zones
    db = _db()
    uid = f"test_uid_{uuid.uuid4().hex[:8]}"
    await db.users.insert_one({"user_id": uid, "email": f"{uid}@t.io"})
    await db.estimations.insert_many([
        {"user_id": uid, "code_postal": "13008", "created_at": datetime.now(timezone.utc).isoformat()},
        {"user_id": uid, "code_postal": "13008", "created_at": datetime.now(timezone.utc).isoformat()},
        {"user_id": uid, "code_postal": "75017", "created_at": datetime.now(timezone.utc).isoformat()},
    ])
    z = await compute_suggested_zones(db, uid)
    assert z[0] == "13008"  # le plus fréquent
    assert "75017" in z
    # Cleanup
    await db.estimations.delete_many({"user_id": uid})
    await db.users.delete_one({"user_id": uid})


@pytest.mark.asyncio
async def test_bascule_to_b1_pose_les_champs():
    """La bascule pose app_version=b1, zones_confirmees=false, tour_guide_vu=false."""
    from d1.migration_v2_to_b1 import bascule_to_b1
    db = _db()
    uid = f"test_uid_{uuid.uuid4().hex[:8]}"
    await db.users.insert_one({
        "user_id": uid, "email": f"{uid}@t.io",
        "app_version": "v2", "zones_confirmees": True, "tour_guide_vu": True,
    })
    r = await bascule_to_b1(db, uid)
    assert r["ok"] is True
    assert r["app_version"] == "b1"
    user = await db.users.find_one({"user_id": uid})
    assert user["app_version"] == "b1"
    assert user["zones_confirmees"] is False
    assert user["tour_guide_vu"] is False
    assert user.get("zones_suggestions")  # jamais vide
    await db.users.delete_one({"user_id": uid})


@pytest.mark.asyncio
async def test_bascule_to_v2_retour_arriere():
    """Retour arrière : app_version repasse à v2 sans toucher aux autres champs."""
    from d1.migration_v2_to_b1 import bascule_to_b1, bascule_to_v2
    db = _db()
    uid = f"test_uid_{uuid.uuid4().hex[:8]}"
    await db.users.insert_one({"user_id": uid, "email": f"{uid}@t.io"})
    await bascule_to_b1(db, uid)
    r = await bascule_to_v2(db, uid)
    assert r["ok"] is True
    user = await db.users.find_one({"user_id": uid})
    assert user["app_version"] == "v2"
    # les autres champs restent inchangés
    assert user["zones_confirmees"] is False  # préservé
    await db.users.delete_one({"user_id": uid})
