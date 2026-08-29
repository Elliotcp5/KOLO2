"""Helper partagé pour tests A2. Crée un client Motor propre PAR test
(pytest-asyncio ferme le event loop entre tests, on ne peut pas partager)
mais avec des timeouts courts + retry pour tolérer les AutoReconnect.
"""
from __future__ import annotations

import asyncio
import os

from motor.motor_asyncio import AsyncIOMotorClient


def new_client() -> AsyncIOMotorClient:
    return AsyncIOMotorClient(
        os.environ["MONGO_URL"],
        serverSelectionTimeoutMS=8000,
        connectTimeoutMS=8000,
        socketTimeoutMS=8000,
        maxPoolSize=4,
        minPoolSize=0,
    )


async def reset_test_db(client: AsyncIOMotorClient, db_name: str):
    """Nettoie une DB de test sans utiliser drop_database (qui provoque des
    AutoReconnect transitoires sur Mongo local sous pression).

    Passe par un delete_many() sur chaque collection existante, ce qui est
    plus doux avec le pool de connexions.
    """
    for attempt in range(6):
        try:
            db = client[db_name]
            colls = await db.list_collection_names()
            for c in colls:
                try:
                    await db[c].drop()
                except Exception:
                    await db[c].delete_many({})
            return db
        except Exception:
            await asyncio.sleep(0.2 * (attempt + 1))
    return client[db_name]


async def close(client: AsyncIOMotorClient):
    try:
        client.close()
    except Exception:
        pass


async def _ensure_a2_indexes_with_retry(db):
    """Wrap `ensure_a2_indexes` avec retry pour tolérer les AutoReconnect
    du Mongo local sous forte pression (drop + create indexes rapproché)."""
    from a2.indexes import ensure_a2_indexes
    for attempt in range(4):
        try:
            return await ensure_a2_indexes(db)
        except Exception:
            await asyncio.sleep(0.3 * (attempt + 1))
    return await ensure_a2_indexes(db)
