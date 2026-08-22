"""
KOLO — Apify → Supabase ingestion (daily cron)
==============================================

Purpose
-------
Read the items from the **latest successful run** of the Apify actor
`dltik/pige-immo-fr-scraper` and upsert them into Supabase `listings`.

Split from `scrape_listings_cron.py`:
  - `scrape_listings_cron.py` KICKS OFF new runs (fresh scraping).
  - `ingest_apify.py`         reads the LATEST SUCCEEDED run only, no scraping.

The daily cron ties both together:
  1. Kick off a new Apify run  (scrape_listings_cron.run_once)
  2. Wait for it to succeed    (built into scrape_listings_cron)
  3. Ingest from the latest    (this module)

But the endpoint `POST /api/ingest/apify` calls (2)+(3) only — it will happily
re-import the last successful run's items if you call it standalone.

Behaviour required by product
-----------------------------
- Upsert on (portal, external_id)
- Update `last_seen_at` = run started_at for every item revisited
- Store the raw item in `raw_data`
- Deactivate (`is_active=false`) any listing whose postal_code was in this
  run's coverage BUT whose `last_seen_at` is older than 48 h (stale).
- Return {inserted, updated, deactivated}.

Env
---
- APIFY_API_TOKEN           (required)
- APIFY_ACTOR_PIGE_IMMO     (default: dltik/pige-immo-fr-scraper)
- SUPABASE_URL              (required)
- SUPABASE_SECRET_KEY       (required — service_role)
"""
from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Iterable, Optional

import httpx

logger = logging.getLogger("ingest_apify")

APIFY_TOKEN = (os.environ.get("APIFY_API_TOKEN") or "").strip()
APIFY_ACTOR = (os.environ.get("APIFY_ACTOR_PIGE_IMMO") or "dltik/pige-immo-fr-scraper").strip().replace("/", "~")
SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_KEY = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()

STALE_HOURS = 48
CHUNK_SIZE = 500  # Supabase REST upsert batch size


# --------------------------------------------------------------------------
# Apify
# --------------------------------------------------------------------------
async def fetch_latest_run_items(client: httpx.AsyncClient) -> tuple[Optional[dict], list[dict]]:
    """Fetch items from the *latest SUCCEEDED* run of the configured actor.

    Returns (run_meta, items). `run_meta` contains {id, started_at, finished_at,
    dataset_id, status}. `items` is the dataset list. On any error, returns
    (None, []).
    """
    if not APIFY_TOKEN:
        logger.error("APIFY_API_TOKEN missing")
        return None, []

    # Apify exposes /acts/{actor}/runs/last with a `?status=SUCCEEDED` filter.
    run_url = f"https://api.apify.com/v2/acts/{APIFY_ACTOR}/runs/last"
    try:
        r = await client.get(
            run_url,
            params={"token": APIFY_TOKEN, "status": "SUCCEEDED"},
            timeout=20,
        )
        if r.status_code != 200:
            logger.warning(f"Apify last-run HTTP {r.status_code}: {r.text[:200]}")
            return None, []
        run = (r.json() or {}).get("data") or {}
    except Exception as e:
        logger.warning(f"Apify last-run fetch failed: {e}")
        return None, []

    dataset_id = run.get("defaultDatasetId")
    if not dataset_id:
        logger.warning("No dataset id on latest run")
        return None, []

    items: list[dict] = []
    offset = 0
    page = 1000
    try:
        while True:
            dr = await client.get(
                f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                params={"token": APIFY_TOKEN, "clean": "true", "limit": page, "offset": offset},
                timeout=30,
            )
            if dr.status_code != 200:
                logger.warning(f"Dataset fetch HTTP {dr.status_code}")
                break
            chunk = dr.json() or []
            if not chunk:
                break
            items.extend(chunk)
            if len(chunk) < page:
                break
            offset += page
    except Exception as e:
        logger.warning(f"Dataset paging failed at offset={offset}: {e}")

    meta = {
        "id": run.get("id"),
        "started_at": run.get("startedAt"),
        "finished_at": run.get("finishedAt"),
        "dataset_id": dataset_id,
        "status": run.get("status"),
        "item_count": len(items),
    }
    logger.info(f"Apify latest run {meta['id']} → {len(items)} items")
    return meta, items


# --------------------------------------------------------------------------
# Supabase mapping
# --------------------------------------------------------------------------
def _stable_external_id(raw_id: Any) -> str:
    """Normalize the external_id: keep digit-only ids as-is, hash everything
    else to a compact 24-char hex so the composite key (portal, external_id)
    stays deterministic even when the portal doesn't expose a numeric id.
    """
    s = str(raw_id or "").strip()
    if not s:
        return ""
    if s.isdigit():
        return s
    return hashlib.sha1(s.encode()).hexdigest()[:24]


def _map_item_to_listing(row: dict, last_seen_at_iso: str, portal_default: str = "leboncoin") -> Optional[dict]:
    """Map one raw Apify item to a `listings` row. Returns None if unusable."""
    external_id_raw = row.get("external_id") or row.get("id") or row.get("url") or ""
    external_id = _stable_external_id(external_id_raw)
    if not external_id:
        return None

    portal = (row.get("source") or row.get("portal") or portal_default or "").lower() or portal_default
    postal_code = str(row.get("postalCode") or row.get("postal_code") or "").strip() or None
    url = (row.get("url") or row.get("link") or "").strip()
    if not url:
        return None

    thumbnail_url = (
        row.get("main_photo_url")
        or row.get("thumbnail_url")
        or ((row.get("photos") or [None])[0] if isinstance(row.get("photos"), list) and row.get("photos") else None)
        or row.get("photo")
        or row.get("image")
        or ""
    )

    kind = "pro" if (
        row.get("ownerType") == "agency"
        or row.get("isPro")
        or (row.get("is_owner_listing") is False)
    ) else "private"

    def _safe_int(v):
        try:
            iv = int(float(v))
            return iv if iv > 0 else None
        except (TypeError, ValueError):
            return None

    return {
        "external_id": external_id,
        "portal": portal,
        "postal_code": postal_code,
        "city": row.get("city") or row.get("commune") or None,
        "price": _safe_int(row.get("price")),
        "surface": _safe_int(row.get("surface") or row.get("area")),
        "rooms": _safe_int(row.get("rooms") or row.get("nbRooms")),
        "title": (row.get("title") or (row.get("description") or "")[:120] or "Annonce"),
        "url": url,
        "thumbnail_url": thumbnail_url,
        "energy_class": row.get("dpe") or row.get("energy") or row.get("energy_class") or None,
        "kind": kind,
        "raw_data": row,
        "last_seen_at": last_seen_at_iso,
        "is_active": True,
        "updated_at": last_seen_at_iso,
    }


def _dedupe(rows: list[dict]) -> list[dict]:
    """Drop dup (portal, external_id) — keeps the first occurrence."""
    seen: set[tuple[str, str]] = set()
    out: list[dict] = []
    for r in rows:
        k = (r["portal"], r["external_id"])
        if k in seen:
            continue
        seen.add(k)
        out.append(r)
    return out


def _chunks(seq: list[dict], n: int) -> Iterable[list[dict]]:
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


# --------------------------------------------------------------------------
# Supabase I/O
# --------------------------------------------------------------------------
def _sb_headers(prefer: str = "") -> dict:
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


async def _select_existing_keys(
    client: httpx.AsyncClient, rows: list[dict]
) -> set[tuple[str, str]]:
    """Return the set of (portal, external_id) that ALREADY exist in Supabase.
    Uses a batched IN() query. Empty set on any error (treat everything as
    insert, best-effort counting).
    """
    if not rows:
        return set()
    existing: set[tuple[str, str]] = set()
    # Batch by portal to keep the OR filter simple. Realistically we only have
    # 5 portals — one call per portal.
    by_portal: dict[str, list[str]] = {}
    for r in rows:
        by_portal.setdefault(r["portal"], []).append(r["external_id"])

    for portal, ext_ids in by_portal.items():
        # Chunk the IN() list into groups of 200 to keep URL length sane.
        for group in _chunks([{"external_id": e} for e in ext_ids], 200):
            ids_csv = ",".join(f'"{r["external_id"]}"' for r in group)
            params = {
                "select": "external_id",
                "portal": f"eq.{portal}",
                "external_id": f"in.({ids_csv})",
                "limit": "1000",
            }
            try:
                r = await client.get(
                    f"{SUPABASE_URL}/rest/v1/listings",
                    params=params,
                    headers=_sb_headers(),
                    timeout=15,
                )
                if r.status_code == 200:
                    for row in r.json() or []:
                        existing.add((portal, str(row["external_id"])))
                else:
                    logger.warning(f"Supabase select HTTP {r.status_code}: {r.text[:150]}")
            except Exception as e:
                logger.warning(f"Supabase select failed for portal={portal}: {e}")
    return existing


async def _upsert_batch(client: httpx.AsyncClient, rows: list[dict]) -> int:
    """Upsert a batch. Returns number of rows successfully sent (may be > inserts+updates
    if Supabase silently dropped a row — used only for logging).
    """
    if not rows:
        return 0
    total = 0
    for chunk in _chunks(rows, CHUNK_SIZE):
        try:
            r = await client.post(
                f"{SUPABASE_URL}/rest/v1/listings",
                params={"on_conflict": "portal,external_id"},
                headers=_sb_headers(prefer="resolution=merge-duplicates,return=minimal"),
                json=chunk,
                timeout=25,
            )
            if r.status_code in (200, 201, 204):
                total += len(chunk)
            else:
                logger.warning(f"Supabase upsert HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e:
            logger.warning(f"Supabase upsert failed: {e}")
    return total


async def _deactivate_stale(
    client: httpx.AsyncClient,
    postal_codes: list[str],
    cutoff_dt: datetime,
) -> int:
    """Mark as inactive any listing in the given postal_codes whose
    last_seen_at is older than cutoff_dt. Returns the number of rows
    affected (best-effort — Supabase returns representation).
    """
    if not postal_codes:
        return 0
    postal_codes = sorted({p for p in postal_codes if p})
    if not postal_codes:
        return 0

    cutoff_iso = cutoff_dt.isoformat()
    affected = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    for group in _chunks([{"pc": p} for p in postal_codes], 200):
        pc_csv = ",".join(f'"{r["pc"]}"' for r in group)
        params = {
            "postal_code": f"in.({pc_csv})",
            "last_seen_at": f"lt.{cutoff_iso}",
            "is_active": "eq.true",
        }
        try:
            r = await client.patch(
                f"{SUPABASE_URL}/rest/v1/listings",
                params=params,
                headers=_sb_headers(prefer="return=representation"),
                json={"is_active": False, "updated_at": now_iso},
                timeout=25,
            )
            if r.status_code in (200, 204):
                try:
                    affected += len(r.json() or [])
                except Exception:
                    pass
            else:
                logger.warning(f"Supabase deactivate HTTP {r.status_code}: {r.text[:150]}")
        except Exception as e:
            logger.warning(f"Supabase deactivate failed: {e}")
    return affected


# --------------------------------------------------------------------------
# Public entry point
# --------------------------------------------------------------------------
async def ingest_latest_run(stale_hours: int = STALE_HOURS) -> dict:
    """
    End-to-end ingestion:
      1. Fetch items from the latest SUCCEEDED Apify run
      2. Map + dedupe on (portal, external_id)
      3. Look up which keys already exist → count inserts vs updates
      4. Upsert everything
      5. Deactivate stale listings in same postal codes

    Returns {run_id, run_started_at, inserted, updated, deactivated,
             postal_codes, items_fetched, error?}
    """
    if not APIFY_TOKEN:
        return {"error": "APIFY_API_TOKEN missing"}
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {"error": "SUPABASE_URL / SUPABASE_SECRET_KEY missing"}

    async with httpx.AsyncClient() as client:
        meta, items = await fetch_latest_run_items(client)
        if not meta or not items:
            return {
                "run_id": (meta or {}).get("id"),
                "run_started_at": (meta or {}).get("started_at"),
                "inserted": 0,
                "updated": 0,
                "deactivated": 0,
                "items_fetched": 0,
                "postal_codes": [],
                "error": "no_items" if meta else "no_run_or_fetch_error",
            }

        run_started_at = meta.get("started_at") or datetime.now(timezone.utc).isoformat()

        mapped = [_map_item_to_listing(it, run_started_at) for it in items]
        rows = [r for r in mapped if r]
        rows = _dedupe(rows)
        postal_codes = sorted({r["postal_code"] for r in rows if r.get("postal_code")})

        existing = await _select_existing_keys(client, rows)
        inserted = sum(1 for r in rows if (r["portal"], r["external_id"]) not in existing)
        updated = len(rows) - inserted

        sent = await _upsert_batch(client, rows)

        # Deactivate stale
        try:
            run_started_dt = datetime.fromisoformat(str(run_started_at).replace("Z", "+00:00"))
        except Exception:
            run_started_dt = datetime.now(timezone.utc)
        cutoff = run_started_dt - timedelta(hours=stale_hours)
        deactivated = await _deactivate_stale(client, postal_codes, cutoff)

        result = {
            "run_id": meta.get("id"),
            "run_started_at": run_started_at,
            "run_finished_at": meta.get("finished_at"),
            "items_fetched": len(items),
            "rows_kept_after_map_dedupe": len(rows),
            "rows_sent_to_supabase": sent,
            "inserted": inserted,
            "updated": updated,
            "deactivated": deactivated,
            "postal_codes_count": len(postal_codes),
            "stale_hours": stale_hours,
        }
        logger.info(
            f"Ingest done — inserted={inserted}, updated={updated}, "
            f"deactivated={deactivated}, postal_codes={len(postal_codes)}"
        )
        return result
