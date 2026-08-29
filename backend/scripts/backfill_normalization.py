"""
KOLO — Backfill A1 : normalisation des listings existants
==========================================================

À lancer UNE SEULE FOIS, APRÈS avoir appliqué la migration
`backend/migrations/A1_listings_extensions.sql`.

Rattrape les lignes où `type_normalise` est NULL en leur appliquant
`normalization.apply_normalization()`. Ne touche PAS aux lignes déjà
normalisées.

Usage :
    cd /app/backend && python -m scripts.backfill_normalization
    cd /app/backend && python -m scripts.backfill_normalization --dry-run
    cd /app/backend && python -m scripts.backfill_normalization --limit 5000
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path

import httpx

# Permet l'exécution `python -m scripts.backfill_normalization` ET
# `python scripts/backfill_normalization.py` depuis /app/backend.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Charge le fichier `.env` (SUPABASE_URL / SUPABASE_SECRET_KEY).
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except Exception:
    pass

from normalization import apply_normalization  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_normalization")

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_KEY = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()
PAGE = 500


def _headers(prefer: str = "") -> dict:
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


async def _fetch_batch(client: httpx.AsyncClient, offset: int, limit: int) -> list[dict]:
    r = await client.get(
        f"{SUPABASE_URL}/rest/v1/listings",
        params={
            "select": "id,external_id,portal,postal_code,city,price,raw_data",
            "type_normalise": "is.null",
            "order": "id.asc",
            "limit": str(limit),
            "offset": str(offset),
        },
        headers=_headers(),
        timeout=30,
    )
    r.raise_for_status()
    return r.json() or []


async def _update_one(client: httpx.AsyncClient, row_id: int, patch: dict) -> bool:
    r = await client.patch(
        f"{SUPABASE_URL}/rest/v1/listings",
        params={"id": f"eq.{row_id}"},
        headers=_headers(prefer="return=minimal"),
        json=patch,
        timeout=15,
    )
    if r.status_code not in (200, 204):
        logger.warning(f"row {row_id} update HTTP {r.status_code}: {r.text[:150]}")
        return False
    return True


async def backfill(limit: int | None = None, dry_run: bool = False) -> dict:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {"error": "SUPABASE_URL / SUPABASE_SECRET_KEY missing"}

    scanned = 0
    updated = 0
    async with httpx.AsyncClient() as client:
        # NB. Pas besoin de gérer un `offset` : les lignes traitées disparaissent
        # du filtre `type_normalise=is.null` après update, donc chaque itération
        # récupère bien 500 NOUVELLES lignes non normalisées.
        while True:
            page_size = PAGE if not limit else min(PAGE, limit - scanned)
            if page_size <= 0:
                break
            batch = await _fetch_batch(client, offset=0, limit=page_size)
            if not batch:
                break
            for row in batch:
                scanned += 1
                # Reconstitue un "listing" pour apply_normalization
                listing = {
                    "property_type": (row.get("raw_data") or {}).get("propertyType")
                        or (row.get("raw_data") or {}).get("property_type"),
                    "transaction": (row.get("raw_data") or {}).get("transaction"),
                    "postal_code": row.get("postal_code"),
                    "city": row.get("city"),
                    "price": row.get("price"),
                    "raw_data": row.get("raw_data") or {},
                }
                apply_normalization(listing)
                patch = {
                    "type_normalise": listing["type_normalise"],
                    "est_logement": listing["est_logement"],
                    "transaction": listing["transaction"],
                }
                if listing.get("postal_code") and listing["postal_code"] != row.get("postal_code"):
                    patch["postal_code"] = listing["postal_code"]
                if dry_run:
                    updated += 1
                else:
                    ok = await _update_one(client, row["id"], patch)
                    if ok:
                        updated += 1
            logger.info(f"scanned={scanned} updated={updated}")
            if limit and scanned >= limit:
                break
            if len(batch) < page_size:
                break

    return {"scanned": scanned, "updated": updated, "dry_run": dry_run}


def _main():
    parser = argparse.ArgumentParser(description="Backfill A1 normalisation")
    parser.add_argument("--limit", type=int, default=None, help="Max rows to process")
    parser.add_argument("--dry-run", action="store_true", help="Ne rien écrire")
    args = parser.parse_args()

    result = asyncio.run(backfill(limit=args.limit, dry_run=args.dry_run))
    print(result)


if __name__ == "__main__":
    _main()
