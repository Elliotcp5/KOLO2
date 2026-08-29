"""
KOLO — Zones de scraping (Mongo)
=================================

Session A1. Persistance des métadonnées d'ingestion par code postal.

Collection `zones_scraping`
---------------------------
  Document (id = "{source}:{postal_code}") :
  {
    "_id":                    "leboncoin:75011",
    "postal_code":            "75011",
    "source":                 "leboncoin" | "seloger" | ...,
    "last_ingest_at":         ISO datetime,
    "last_mode":              "complet" | "incremental",
    "last_run_ids":           [str],
    "last_items_seen":        int,   # nb d'annonces vues dans le dernier run
    "last_active_count":      int,   # nb listings actives après ce run
    "total_ingests":          int,
    "created_at":             ISO datetime,
    "updated_at":             ISO datetime,
  }
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def ensure_indexes(db) -> None:
    """Crée les indexes idempotents pour la collection `zones_scraping`."""
    await db.zones_scraping.create_index([("postal_code", 1), ("source", 1)], unique=False)
    await db.zones_scraping.create_index([("last_ingest_at", -1)])


async def record_ingest(
    db,
    postal_codes: Iterable[str],
    source: str,
    mode: str,
    run_ids: Optional[list[str]] = None,
    items_seen_by_pc: Optional[dict[str, int]] = None,
    active_count_by_pc: Optional[dict[str, int]] = None,
) -> int:
    """Upsert une entrée par code postal ingéré. Retourne le nombre d'entrées touchées."""
    postal_codes = sorted({str(pc).strip() for pc in postal_codes if pc})
    if not postal_codes:
        return 0
    source = (source or "unknown").lower().strip() or "unknown"
    mode = mode if mode in ("complet", "incremental") else "incremental"
    now = _now_iso()
    run_ids = list(run_ids or [])
    items_seen_by_pc = items_seen_by_pc or {}
    active_count_by_pc = active_count_by_pc or {}

    n = 0
    for pc in postal_codes:
        doc_id = f"{source}:{pc}"
        set_fields = {
            "postal_code": pc,
            "source": source,
            "last_ingest_at": now,
            "last_mode": mode,
            "last_run_ids": run_ids,
            "last_items_seen": int(items_seen_by_pc.get(pc, 0) or 0),
            "updated_at": now,
        }
        if pc in active_count_by_pc:
            set_fields["last_active_count"] = int(active_count_by_pc.get(pc, 0) or 0)
        await db.zones_scraping.update_one(
            {"_id": doc_id},
            {
                "$set": set_fields,
                "$setOnInsert": {"created_at": now},
                "$inc": {"total_ingests": 1},
            },
            upsert=True,
        )
        n += 1
    return n


async def list_zones(db, source: Optional[str] = None, limit: int = 200) -> list[dict]:
    """Liste des zones (utile pour le dashboard admin)."""
    q = {}
    if source:
        q["source"] = source.lower()
    cursor = db.zones_scraping.find(q, {"_id": 0}).sort("last_ingest_at", -1).limit(limit)
    return [d async for d in cursor]
