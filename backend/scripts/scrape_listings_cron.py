"""
KOLO — Standalone cron scraper : Apify → Supabase `listings`
============================================================

Purpose
-------
Populate the shared Supabase `listings` table with real, clickable real-estate
listings so the mobile app can serve them instantly, instead of kicking off a
live Apify run (which takes 1-3 min and blocks the user).

Strategy
--------
Every 6 hours:
1. Build a **target ZIP list** = union of
      (a) all postal codes users searched in the last 7 days
          (from `v2_prospecting_logs`), and
      (b) a curated static list of top-50 French cities.
2. Batch the ZIPs (≤20 per Apify run to stay under the actor's memory cap).
3. For each batch: kick off Apify actor `dltik/pige-immo-fr-scraper` with
      sources = [leboncoin, pap, seloger, bienici, logic-immo]
      maxItems = 30 × len(batch)  (~30 per ZIP)
      onlyOwner = False (both pro and private, we'll dedupe later)
4. Poll every 5s up to 4 min. When SUCCEEDED, fetch dataset, dedupe by URL,
   upsert into Supabase via `_upsert_supabase_listings`.
5. Log a summary row to `v2_scraper_runs` (Mongo) for observability.

Runnable
--------
- One-shot:  python -m backend.scripts.scrape_listings_cron --once
- With custom ZIPs override:
      python -m backend.scripts.scrape_listings_cron --once --zips 75001,75002
- Loop (invoked by notification_scheduler every 6h).

Idempotency
-----------
Safe to re-run: the Supabase upsert is on (portal, external_id). Duplicates
are dropped in-batch before upserting. If a run is still RUNNING at the end
of the polling window, we save `run_id` in `v2_scraper_pending` so the next
tick picks up the dataset for free.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Iterable

# Ensure the parent `backend` package is importable both when run as
# `python -m backend.scripts.scrape_listings_cron` and when the file is
# executed directly.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402
load_dotenv(_BACKEND_DIR / ".env")

import httpx  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - scraper - %(levelname)s - %(message)s",
)
logger = logging.getLogger("scrape_listings")


# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------
APIFY_TOKEN = (os.environ.get("APIFY_API_TOKEN") or "").strip()
APIFY_ACTOR = (os.environ.get("APIFY_ACTOR_PIGE_IMMO") or "dltik/pige-immo-fr-scraper").strip().replace("/", "~")

# Full source portfolio (user asked for max coverage in the plan).
APIFY_SOURCES = ["leboncoin", "pap", "seloger", "bienici", "logic-immo"]

# The `pige-immo-fr-scraper` actor accepts a `postalCodes` array, but its
# internal scheduler heavily favors the FIRST codes of the array — passing
# 20 ZIPs at once returns ~1-2 items per ZIP (as we discovered in prod).
# So we run ONE ZIP per Apify run, in parallel, with a small concurrency cap
# to be nice to the Apify actor queue.
MAX_PARALLEL_RUNS = 5
MAX_ITEMS_PER_ZIP = 30
POLL_INTERVAL_SEC = 5
POLL_MAX_SEC = 180              # 3 min per single-ZIP run max

# Top-50 curated FR cities (biggest lead pools for real-estate agents).
STATIC_TOP_ZIPS = [
    # Paris (arrondissements)
    "75001", "75002", "75003", "75004", "75005", "75006", "75007", "75008",
    "75009", "75010", "75011", "75012", "75013", "75014", "75015", "75016",
    "75017", "75018", "75019", "75020",
    # Marseille (arrondissements principaux)
    "13001", "13002", "13006", "13008",
    # Lyon (arrondissements)
    "69001", "69002", "69003", "69006", "69007",
    # Toulouse, Nice, Nantes, Montpellier, Strasbourg, Bordeaux
    "31000", "06000", "06300", "44000", "34000", "67000", "33000",
    # Lille, Rennes, Reims, Saint-Étienne, Le Havre, Toulon
    "59000", "35000", "51100", "42000", "76600", "83000",
    # Grenoble, Dijon, Angers, Villeurbanne, Le Mans, Aix-en-Provence
    "38000", "21000", "49000", "69100", "72000", "13100",
    # Brest, Nîmes, Limoges, Clermont-Ferrand, Tours, Amiens, Metz
    "29200", "30000", "87000", "63000", "37000", "80000", "57000",
    # Perpignan, Boulogne-Billancourt (banlieue premium)
    "66000", "92100",
]


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def _mongo() -> AsyncIOMotorClient:
    mongo_url = os.environ["MONGO_URL"]
    return AsyncIOMotorClient(mongo_url)


async def _resolve_target_zips(db, extra_zips: list[str] | None = None) -> list[str]:
    """Union of:
        - user-searched ZIPs in the last 7 days (from v2_prospecting_logs)
        - static curated top-50 FR cities
        - CLI --zips override (if given, replaces the auto detection)
    """
    if extra_zips:
        return sorted({z.strip() for z in extra_zips if z.strip().isdigit() and len(z.strip()) == 5})

    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    user_zips: set[str] = set()
    try:
        cursor = db.v2_prospecting_logs.find(
            {"kind": "listings", "created_at": {"$gte": since}},
            {"_id": 0, "params": 1},
        )
        async for row in cursor:
            sector = (row.get("params") or {}).get("sector") or ""
            for tok in sector.split(","):
                z = tok.strip()
                if z.isdigit() and len(z) == 5:
                    user_zips.add(z)
    except Exception as e:
        logger.warning(f"Could not read prospecting logs: {e}")

    combined = sorted(user_zips | set(STATIC_TOP_ZIPS))
    logger.info(
        f"Target ZIPs = {len(user_zips)} (user-searched 7d) ∪ {len(STATIC_TOP_ZIPS)} (curated) → {len(combined)} total"
    )
    return combined


def _batch(iterable: Iterable[str], size: int) -> Iterable[list[str]]:
    buf: list[str] = []
    for it in iterable:
        buf.append(it)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


def _dedupe_by_url(rows: list[dict]) -> list[dict]:
    """Drop duplicate URLs (same listing surfaced by multiple portals).
    Keeps the first occurrence (Apify returns items in source-order).
    """
    seen: set[str] = set()
    out: list[dict] = []
    for r in rows:
        url = (r.get("url") or r.get("link") or "").strip()
        if not url or not url.startswith(("http://", "https://")):
            continue
        if url in seen:
            continue
        seen.add(url)
        out.append(r)
    return out


async def _kickoff_apify(client: httpx.AsyncClient, zips: list[str]) -> tuple[str | None, str | None]:
    """POST /acts/{actor}/runs and return (run_id, dataset_id).
    We pass a SINGLE-ZIP list because the actor is unreliable with multi-ZIP
    inputs (see MAX_PARALLEL_RUNS comment).
    """
    body = {
        "sources": APIFY_SOURCES,
        "transaction": "buy",
        "postalCodes": zips,
        "maxItems": MAX_ITEMS_PER_ZIP * len(zips),
    }
    url = f"https://api.apify.com/v2/acts/{APIFY_ACTOR}/runs?token={APIFY_TOKEN}"
    r = await client.post(url, json=body, timeout=25)
    if r.status_code not in (200, 201):
        logger.warning(f"Apify kickoff failed {r.status_code}: {r.text[:200]}")
        return None, None
    data = r.json().get("data", {})
    return data.get("id"), data.get("defaultDatasetId")


async def _poll_and_fetch(client: httpx.AsyncClient, run_id: str, dataset_id: str) -> list[dict] | None:
    """Poll a run until SUCCEEDED (or timeout). Returns the dataset or None."""
    elapsed = 0
    status = "RUNNING"
    while elapsed < POLL_MAX_SEC:
        await asyncio.sleep(POLL_INTERVAL_SEC)
        elapsed += POLL_INTERVAL_SEC
        try:
            sr = await client.get(
                f"https://api.apify.com/v2/acts/{APIFY_ACTOR}/runs/{run_id}?token={APIFY_TOKEN}",
                timeout=15,
            )
            if sr.status_code != 200:
                continue
            status = sr.json().get("data", {}).get("status", "")
            if status in ("SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"):
                break
        except Exception as e:
            logger.warning(f"Poll error: {e}")
            continue

    if status != "SUCCEEDED":
        logger.info(f"Run {run_id} ended with status={status} after {elapsed}s")
        return None

    try:
        dr = await client.get(
            f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={APIFY_TOKEN}&clean=true&limit=1000",
            timeout=30,
        )
        if dr.status_code != 200:
            logger.warning(f"Dataset fetch failed {dr.status_code}")
            return None
        return dr.json() or []
    except Exception as e:
        logger.warning(f"Dataset fetch exception: {e}")
        return None


async def _scrape_single_zip(client: httpx.AsyncClient, zip_code: str, sem: asyncio.Semaphore) -> dict:
    """Run one Apify run for exactly ONE ZIP, then dedupe & upsert.
    Concurrency is capped via the shared semaphore.
    """
    async with sem:
        logger.info(f"Kicking off Apify for ZIP {zip_code}")
        run_id, dataset_id = await _kickoff_apify(client, [zip_code])
        if not run_id or not dataset_id:
            return {"zip": zip_code, "upserted": 0, "kept_after_dedupe": 0, "status": "kickoff_failed"}

        rows = await _poll_and_fetch(client, run_id, dataset_id)
        if rows is None:
            return {"zip": zip_code, "upserted": 0, "kept_after_dedupe": 0, "status": "no_data"}

        unique = _dedupe_by_url(rows)
        logger.info(f"  {zip_code}: {len(rows)} raw → {len(unique)} unique URLs")

        # Import lazily to avoid pulling server.py into the top of this file.
        from v2_router import _upsert_supabase_listings  # type: ignore
        upserted = await _upsert_supabase_listings(unique, portal_default="leboncoin")
        return {
            "zip": zip_code,
            "upserted": upserted,
            "kept_after_dedupe": len(unique),
            "status": "ok",
        }


async def run_once(explicit_zips: list[str] | None = None) -> dict:
    """Main entry point — used by the CLI and by the notification_scheduler tick."""
    if not APIFY_TOKEN:
        logger.error("APIFY_API_TOKEN missing — aborting")
        return {"error": "missing_apify_token"}

    started_at = datetime.now(timezone.utc)
    client = _mongo()
    db = client[os.environ["DB_NAME"]]

    try:
        target_zips = await _resolve_target_zips(db, extra_zips=explicit_zips)
        if not target_zips:
            logger.info("No target ZIPs — nothing to scrape.")
            return {"batches": 0, "total_upserted": 0, "total_unique": 0}

        results: list[dict] = []
        total_upserted = 0
        total_unique = 0

        sem = asyncio.Semaphore(MAX_PARALLEL_RUNS)
        async with httpx.AsyncClient() as http_client:
            tasks = [
                _scrape_single_zip(http_client, z, sem)
                for z in target_zips
            ]
            for coro in asyncio.as_completed(tasks):
                res = await coro
                results.append(res)
                total_upserted += res.get("upserted", 0) or 0
                total_unique += res.get("kept_after_dedupe", 0) or 0

        summary = {
            "started_at": started_at.isoformat(),
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "target_zips_count": len(target_zips),
            "batches": len(results),   # kept name for backwards compat (= zip count now)
            "total_upserted": total_upserted,
            "total_unique": total_unique,
            "results": results,
        }
        try:
            await db.v2_scraper_runs.insert_one(summary)
        except Exception as e:
            logger.warning(f"Could not persist run summary: {e}")

        # Drop the Mongo _id field before returning (JSON-safe).
        summary.pop("_id", None)
        logger.info(
            f"Scrape done: {total_upserted} upserted, {total_unique} unique, {len(results)} batches"
        )
        return summary
    finally:
        client.close()


def _cli() -> None:
    parser = argparse.ArgumentParser(description="KOLO Apify → Supabase scraper")
    parser.add_argument("--once", action="store_true", help="Run one scrape cycle and exit")
    parser.add_argument(
        "--zips",
        type=str,
        default="",
        help="Comma-separated ZIP override (skips auto-detection)",
    )
    args = parser.parse_args()
    explicit = [z.strip() for z in args.zips.split(",") if z.strip()] if args.zips else None
    result = asyncio.run(run_once(explicit_zips=explicit))
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    _cli()
