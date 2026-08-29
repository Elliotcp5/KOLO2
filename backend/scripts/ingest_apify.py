"""
KOLO — Apify → Supabase ingestion
=================================

Reads items from Apify runs and upserts them into Supabase `listings`.

Two calling modes
-----------------
1. **ingest_runs(run_ids)** — ingest a specific list of runs (the daily cron
   uses this: it captures the run_ids it kicked off and passes them here).
2. **ingest_latest_run()** — fallback for manual/adhoc invocations: reads
   the single most recent SUCCEEDED run of the configured actor.

Both go through the same `_ingest_one_run()` per-run pipeline:
  a. Fetch the run metadata (status, input, stats, dataset_id).
  b. Skip the run if it isn't SUCCEEDED, or if it clearly hit a cost / max-
     items limit (Apify usually surfaces this on `stats.datasetItemCount ==
     options.maxItems`, or on `statusMessage` containing "limit"/"cost").
     Upsert still happens, but deactivation does NOT — the run didn't
     cover the full market so we can't trust the "not seen" signal.
  c. Upsert items into Supabase (portal, external_id) with counts.
  d. Deactivate stale listings — ONLY for postal codes that were explicitly
     in the run's `input.postalCodes` AND only when the run was clean.

Env required: APIFY_API_TOKEN, SUPABASE_URL, SUPABASE_SECRET_KEY.
"""
from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Iterable, Optional

import httpx

# A1 — normalisation partagée : garantit que chaque ligne écrite dans
# `listings` porte transaction / type_normalise / est_logement.
try:
    from normalization import apply_normalization, enrich_from_apify_row  # type: ignore
except Exception:  # pragma: no cover — script peut être exécuté hors backend/
    from backend.normalization import apply_normalization, enrich_from_apify_row  # type: ignore

logger = logging.getLogger("ingest_apify")

APIFY_TOKEN = (os.environ.get("APIFY_API_TOKEN") or "").strip()
APIFY_ACTOR = (os.environ.get("APIFY_ACTOR_PIGE_IMMO") or "dltik/pige-immo-fr-scraper").strip().replace("/", "~")
SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_KEY = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()

STALE_HOURS = 48
CHUNK_SIZE = 500  # Supabase REST upsert batch size

# Signals that a SUCCEEDED run was probably truncated (cost/item/time limit).
# We keep the ingest but skip the deactivation step for those runs.
_LIMIT_HINTS = ("cost", "limit", "budget", "max", "truncat", "abort")


# ==========================================================================
# Utils
# ==========================================================================
def _stable_external_id(raw_id: Any) -> str:
    s = str(raw_id or "").strip()
    if not s:
        return ""
    if s.isdigit():
        return s
    return hashlib.sha1(s.encode()).hexdigest()[:24]


def _dedupe(rows: list[dict]) -> list[dict]:
    seen: set[tuple[str, str]] = set()
    out: list[dict] = []
    for r in rows:
        k = (r["portal"], r["external_id"])
        if k in seen:
            continue
        seen.add(k)
        out.append(r)
    return out


def _chunks(seq: list, n: int) -> Iterable[list]:
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def _map_item_to_listing(row: dict, last_seen_at_iso: str, portal_default: str = "leboncoin") -> Optional[dict]:
    external_id = _stable_external_id(row.get("external_id") or row.get("id") or row.get("url") or "")
    if not external_id:
        return None
    url = (row.get("url") or row.get("link") or "").strip()
    if not url:
        return None
    portal = (row.get("source") or row.get("portal") or portal_default or "").lower() or portal_default
    postal_code = str(row.get("postalCode") or row.get("postal_code") or "").strip() or None
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

    def _si(v):
        try:
            iv = int(float(v))
            return iv if iv > 0 else None
        except (TypeError, ValueError):
            return None

    listing = {
        "external_id": external_id,
        "portal": portal,
        "postal_code": postal_code,
        "city": row.get("city") or row.get("commune") or None,
        "price": _si(row.get("price")),
        "surface": _si(row.get("surface") or row.get("area")),
        "rooms": _si(row.get("rooms") or row.get("nbRooms")),
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
    # A1 bis — mappe d'abord les ~30 colonnes complémentaires (dont
    # `property_type` en snake_case, requis par apply_normalization ci-dessous).
    # rue_extraite / etage_extrait restent NULL (extraction A3).
    enrich_from_apify_row(listing, row)
    # A1 — remplit transaction / type_normalise / est_logement et corrige
    # postal_code sur Paris/Lyon/Marseille si l'arrondissement est dans city.
    apply_normalization(listing)
    return listing


# ==========================================================================
# Apify calls
# ==========================================================================
async def _fetch_run(client: httpx.AsyncClient, run_id: str) -> Optional[dict]:
    """Full run object (status, input, stats, defaultDatasetId)."""
    try:
        r = await client.get(
            f"https://api.apify.com/v2/actor-runs/{run_id}",
            params={"token": APIFY_TOKEN},
            timeout=15,
        )
        if r.status_code != 200:
            logger.warning(f"Apify run fetch HTTP {r.status_code} for {run_id}: {r.text[:200]}")
            return None
        return (r.json() or {}).get("data") or {}
    except Exception as e:
        logger.warning(f"Apify run fetch failed for {run_id}: {e}")
        return None


async def _fetch_last_succeeded_run(client: httpx.AsyncClient) -> Optional[dict]:
    """Fallback used when the caller doesn't pass explicit run_ids."""
    try:
        r = await client.get(
            f"https://api.apify.com/v2/acts/{APIFY_ACTOR}/runs/last",
            params={"token": APIFY_TOKEN, "status": "SUCCEEDED"},
            timeout=15,
        )
        if r.status_code != 200:
            return None
        return (r.json() or {}).get("data") or {}
    except Exception as e:
        logger.warning(f"Apify last-run fetch failed: {e}")
        return None


async def _fetch_dataset_items(client: httpx.AsyncClient, dataset_id: str) -> list[dict]:
    items: list[dict] = []
    offset = 0
    page = 1000
    while True:
        try:
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
            break
    return items


def _run_is_clean(run: dict) -> tuple[bool, str]:
    """Decide whether the run completed normally without hitting a
    cost / item / time limit. Return (is_clean, reason).
    Only clean runs are allowed to deactivate listings.
    """
    if (run.get("status") or "").upper() != "SUCCEEDED":
        return False, f"status={run.get('status')}"
    # statusMessage sometimes contains an explicit reason
    msg = (run.get("statusMessage") or "").lower()
    if any(h in msg for h in _LIMIT_HINTS):
        return False, f"statusMessage={run.get('statusMessage')}"
    # Item cap hit exactly
    stats = run.get("stats") or {}
    opts = run.get("options") or {}
    max_items = opts.get("maxItems")
    item_count = stats.get("datasetItemCount") or stats.get("outputBodySize") or 0
    if max_items and item_count and item_count >= max_items:
        return False, f"maxItems reached ({item_count}/{max_items})"
    # Cost limits observed via `usage.ACTOR_COMPUTE_UNITS` vs `options.maxTotalChargeUsd`
    usage_usd = ((run.get("usage") or {}).get("totalUsd")
                 or (run.get("chargedEventCounts") or {}).get("totalUsd")
                 or 0)
    max_usd = opts.get("maxTotalChargeUsd") or opts.get("maxCostUsd")
    if max_usd and usage_usd and float(usage_usd) >= float(max_usd) * 0.99:
        return False, f"cost cap reached ({usage_usd}/{max_usd} USD)"
    return True, "clean"


def _extract_input_postal_codes(run: dict) -> list[str]:
    """Return the postalCodes actually requested in the run's input."""
    inp = run.get("input") if isinstance(run, dict) else None
    if not isinstance(inp, dict):
        return []
    raw = inp.get("postalCodes") or inp.get("postal_codes") or []
    out = []
    for x in raw:
        s = str(x).strip()
        if s.isdigit() and len(s) == 5:
            out.append(s)
    return sorted(set(out))


async def _fetch_run_input(client: httpx.AsyncClient, run: dict) -> dict:
    """When the /runs response omits `input`, fetch it from the run's
    input key-value store entry.
    """
    if isinstance(run.get("input"), dict):
        return run["input"]
    kv_id = run.get("defaultKeyValueStoreId")
    if not kv_id:
        return {}
    try:
        r = await client.get(
            f"https://api.apify.com/v2/key-value-stores/{kv_id}/records/INPUT",
            params={"token": APIFY_TOKEN},
            timeout=15,
        )
        if r.status_code == 200:
            return r.json() or {}
    except Exception as e:
        logger.warning(f"Could not fetch run input from KV: {e}")
    return {}


# ==========================================================================
# Supabase I/O
# ==========================================================================
def _sb_headers(prefer: str = "") -> dict:
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


async def _select_existing_keys(client: httpx.AsyncClient, rows: list[dict]) -> set[tuple[str, str]]:
    if not rows:
        return set()
    existing: set[tuple[str, str]] = set()
    by_portal: dict[str, list[str]] = {}
    for r in rows:
        by_portal.setdefault(r["portal"], []).append(r["external_id"])

    for portal, ext_ids in by_portal.items():
        for group in _chunks(ext_ids, 200):
            ids_csv = ",".join(f'"{e}"' for e in group)
            try:
                r = await client.get(
                    f"{SUPABASE_URL}/rest/v1/listings",
                    params={
                        "select": "external_id",
                        "portal": f"eq.{portal}",
                        "external_id": f"in.({ids_csv})",
                        "limit": "1000",
                    },
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
    if not postal_codes:
        return 0
    postal_codes = sorted({p for p in postal_codes if p})
    if not postal_codes:
        return 0
    cutoff_iso = cutoff_dt.isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()
    affected = 0
    for group in _chunks(postal_codes, 200):
        pc_csv = ",".join(f'"{p}"' for p in group)
        try:
            r = await client.patch(
                f"{SUPABASE_URL}/rest/v1/listings",
                params={
                    "postal_code": f"in.({pc_csv})",
                    "last_seen_at": f"lt.{cutoff_iso}",
                    "is_active": "eq.true",
                },
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


# ==========================================================================
# Per-run ingestion
# ==========================================================================
async def _ingest_one_run(
    client: httpx.AsyncClient,
    run: dict,
    stale_hours: int,
    allow_deactivate: bool = True,
) -> dict:
    """Ingest a single Apify run.

    allow_deactivate=False force le mode incremental : upsert uniquement,
    aucune désactivation même si le run est propre.
    """
    run_id = run.get("id") or "?"
    dataset_id = run.get("defaultDatasetId")
    started_at = run.get("startedAt") or datetime.now(timezone.utc).isoformat()
    status = (run.get("status") or "").upper()

    # Ensure we have the input (needed later for deactivation scoping)
    if "input" not in run or not isinstance(run.get("input"), dict):
        run["input"] = await _fetch_run_input(client, run)

    input_pcs = _extract_input_postal_codes(run)
    clean, reason = _run_is_clean(run)

    # Skip entirely if the run itself did not succeed — no upsert, no deactivate.
    if status != "SUCCEEDED":
        logger.info(f"[run {run_id}] status={status} → skipped (no upsert, no deactivate)")
        return {
            "run_id": run_id,
            "status": status,
            "input_postal_codes_count": len(input_pcs),
            "items_fetched": 0,
            "inserted": 0,
            "updated": 0,
            "deactivated": 0,
            "clean": False,
            "reason": reason,
            "skipped": True,
        }

    # Upsert phase (always run for SUCCEEDED, even if truncated by a limit —
    # every item we did get is real).
    items = await _fetch_dataset_items(client, dataset_id) if dataset_id else []
    mapped = [_map_item_to_listing(it, started_at) for it in items]
    rows = _dedupe([r for r in mapped if r])
    existing = await _select_existing_keys(client, rows)
    would_insert = sum(1 for r in rows if (r["portal"], r["external_id"]) not in existing)
    would_update = len(rows) - would_insert
    sent = await _upsert_batch(client, rows)
    # Reflète le résultat RÉEL (Supabase peut avoir rejeté des batchs — schéma
    # manquant, contrainte violée, etc.). On préserve la répartition
    # insertion/update en la proratant.
    if sent >= len(rows):
        inserted, updated = would_insert, would_update
    elif sent <= 0:
        inserted, updated = 0, 0
    else:
        ratio = sent / max(len(rows), 1)
        inserted = int(round(would_insert * ratio))
        updated = max(0, sent - inserted)

    # Deactivation phase — GATED by the "clean run" heuristic.
    # And restricted to postal codes that were EXPLICITLY in the run input.
    # allow_deactivate=False (mode incremental du webhook) court-circuite tout.
    deactivated = 0
    if allow_deactivate and clean and input_pcs:
        try:
            started_dt = datetime.fromisoformat(str(started_at).replace("Z", "+00:00"))
        except Exception:
            started_dt = datetime.now(timezone.utc)
        cutoff = started_dt - timedelta(hours=stale_hours)
        deactivated = await _deactivate_stale(client, input_pcs, cutoff)
    else:
        logger.info(
            f"[run {run_id}] deactivation skipped — allow_deactivate={allow_deactivate}, "
            f"clean={clean}, reason={reason}, input_pcs={len(input_pcs)}"
        )

    # A1 — comptage par code postal pour alimenter zones_scraping (Mongo).
    items_by_pc: dict[str, int] = {}
    for r in rows:
        pc = r.get("postal_code")
        if not pc:
            continue
        items_by_pc[pc] = items_by_pc.get(pc, 0) + 1

    # A1 — portails distincts vus dans ce run (utile pour zones_scraping).
    sources = sorted({r["portal"] for r in rows if r.get("portal")})

    return {
        "run_id": run_id,
        "status": status,
        "run_started_at": started_at,
        "run_finished_at": run.get("finishedAt"),
        "input_postal_codes": input_pcs,
        "input_postal_codes_count": len(input_pcs),
        "items_fetched": len(items),
        "rows_kept_after_dedupe": len(rows),
        "rows_sent_to_supabase": sent,
        "inserted": inserted,
        "updated": updated,
        "deactivated": deactivated,
        "clean": clean,
        "reason": reason,
        "skipped": False,
        "items_by_postal_code": items_by_pc,
        "sources": sources,
        "allow_deactivate": allow_deactivate,
    }


# ==========================================================================
# Public entry points
# ==========================================================================
def _validate_env() -> Optional[dict]:
    if not APIFY_TOKEN:
        return {"error": "APIFY_API_TOKEN missing"}
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {"error": "SUPABASE_URL / SUPABASE_SECRET_KEY missing"}
    return None


async def ingest_runs(
    run_ids: list[str],
    stale_hours: int = STALE_HOURS,
    allow_deactivate: bool = True,
) -> dict:
    """Ingest the specific runs the daily cron just kicked off. Preferred entry.

    allow_deactivate=False → mode incremental (upsert only, jamais de
    désactivation), utilisé par le webhook A1.
    """
    err = _validate_env()
    if err:
        return err
    run_ids = [r for r in (run_ids or []) if r]
    if not run_ids:
        return {"error": "no_run_ids", "runs": [], "inserted": 0, "updated": 0, "deactivated": 0}

    per_run_results: list[dict] = []
    totals = {"inserted": 0, "updated": 0, "deactivated": 0, "items_fetched": 0, "runs_clean": 0}
    all_items_by_pc: dict[str, int] = {}
    all_input_pcs: set[str] = set()
    all_sources: set[str] = set()
    async with httpx.AsyncClient() as client:
        for rid in run_ids:
            run = await _fetch_run(client, rid)
            if not run:
                per_run_results.append({"run_id": rid, "error": "run_not_found", "skipped": True})
                continue
            res = await _ingest_one_run(
                client, run, stale_hours, allow_deactivate=allow_deactivate
            )
            per_run_results.append(res)
            totals["inserted"] += res.get("inserted", 0) or 0
            totals["updated"] += res.get("updated", 0) or 0
            totals["deactivated"] += res.get("deactivated", 0) or 0
            totals["items_fetched"] += res.get("items_fetched", 0) or 0
            if res.get("clean"):
                totals["runs_clean"] += 1
            for pc, n in (res.get("items_by_postal_code") or {}).items():
                all_items_by_pc[pc] = all_items_by_pc.get(pc, 0) + n
            for pc in res.get("input_postal_codes") or []:
                all_input_pcs.add(pc)
            for s in res.get("sources") or []:
                all_sources.add(s)

    return {
        "runs": per_run_results,
        "runs_total": len(run_ids),
        **totals,
        "stale_hours": stale_hours,
        "allow_deactivate": allow_deactivate,
        "items_by_postal_code": all_items_by_pc,
        "input_postal_codes": sorted(all_input_pcs),
        "sources": sorted(all_sources),
    }


async def ingest_latest_run(
    stale_hours: int = STALE_HOURS,
    allow_deactivate: bool = True,
) -> dict:
    """Fallback for manual invocations: ingest the LAST SUCCEEDED run."""
    err = _validate_env()
    if err:
        return err
    async with httpx.AsyncClient() as client:
        run = await _fetch_last_succeeded_run(client)
        if not run:
            return {"error": "no_last_succeeded_run", "inserted": 0, "updated": 0, "deactivated": 0}
        res = await _ingest_one_run(client, run, stale_hours, allow_deactivate=allow_deactivate)
        return {
            "runs": [res],
            "runs_total": 1,
            "inserted": res.get("inserted", 0),
            "updated": res.get("updated", 0),
            "deactivated": res.get("deactivated", 0),
            "items_fetched": res.get("items_fetched", 0),
            "runs_clean": 1 if res.get("clean") else 0,
            "stale_hours": stale_hours,
            "allow_deactivate": allow_deactivate,
            "items_by_postal_code": res.get("items_by_postal_code") or {},
            "input_postal_codes": res.get("input_postal_codes") or [],
            "sources": res.get("sources") or [],
        }
