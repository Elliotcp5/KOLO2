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
# --------------------------------------------------------------------------
# maxItems — volontairement bas côté test (compte Apify à quota réduit,
# budget quelques dollars). Le plafond n'est PAS un bug, c'est un choix.
# En production réelle, la valeur sera montée par variable d'env quand les
# robinets seront ouverts. On garde 30 par défaut pour maîtriser le coût.
# --------------------------------------------------------------------------
MAX_PARALLEL_RUNS = 5
MAX_ITEMS_PER_ZIP = int(os.environ.get("APIFY_MAX_ITEMS_PER_ZIP", "30"))
POLL_INTERVAL_SEC = 5
POLL_MAX_SEC = 180              # 3 min per single-ZIP run max

# Top-50 curated FR cities (biggest lead pools for real-estate agents).
STATIC_TOP_ZIPS: list[str] = []  # DEPRECATED — supprimé build 2.23.1
# La cible est désormais TOUJOURS calculée dynamiquement via
# `_resolve_target_zips` depuis les zones des utilisateurs actifs.
# Toute retombée vers cette liste en dur est un bug — laisse vide.


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def _mongo() -> AsyncIOMotorClient:
    mongo_url = os.environ["MONGO_URL"]
    return AsyncIOMotorClient(mongo_url)


async def _resolve_target_zips(db, extra_zips: list[str] | None = None) -> list[str]:
    """Cible du scrape : ZIPs des utilisateurs ACTIFS (build 2.22.1).

    Contexte : le compte Apify est sur un quota bas (quelques dollars).
    Faire tourner le scrape sur 57 CPs alors que seulement 3 sont
    utilisés (13008, 69003, 75017) gaspille 94 % du budget. On restreint
    donc la cible aux CPs qui ont au moins un utilisateur actif.

    Source de vérité (par ordre de préférence) :
      1. `users.zones_perso` — les CP explicitement suivis par un user
         connecté durant les 30 derniers jours.
      2. `users.zones_couvertes` — champ historique équivalent.
      3. `v2_prospecting_logs` (7 jours) — CPs cherchés dans l'app.
      4. Fallback : le paramètre `--zips` en CLI ou `PROD_TARGET_ZIPS`
         en variable d'env (jamais utilisé en prod normale).

    Le CP fictif « 99999 » est exclu (marker de zone Découverte, sans
    listings réels — la génération le rejette pour fraîcheur nulle).
    """
    if extra_zips:
        return sorted({z.strip() for z in extra_zips if z.strip().isdigit()
                        and len(z.strip()) == 5 and z.strip() != "99999"})

    zips: set[str] = set()
    # 1. Users actifs (session touchée dans les 30 derniers jours)
    try:
        since = datetime.now(timezone.utc) - timedelta(days=30)
        cursor = db.users.find(
            {"$or": [
                {"last_seen_at": {"$gte": since}},
                {"updated_at": {"$gte": since.isoformat()}},
                {"derniere_connexion": {"$gte": since.isoformat()}},
            ]},
            {"_id": 0, "zones_perso": 1, "zones_couvertes": 1},
        )
        n_users = 0
        async for u in cursor:
            n_users += 1
            for k in ("zones_perso", "zones_couvertes"):
                for z in (u.get(k) or []):
                    z = str(z).strip()
                    if z.isdigit() and len(z) == 5:
                        zips.add(z)
        logger.info(f"[target-zips] {n_users} users actifs 30j → {len(zips)} CP")
    except Exception as e:
        logger.warning(f"Could not read users zones: {e}")

    # 2. Complément via prospecting logs (7 jours) — permet aux users
    #    non actifs mais qui prospectent quand même d'être servis.
    try:
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        cursor = db.v2_prospecting_logs.find(
            {"kind": "listings", "created_at": {"$gte": since}},
            {"_id": 0, "params": 1},
        )
        async for row in cursor:
            sector = (row.get("params") or {}).get("sector") or ""
            for tok in sector.split(","):
                z = tok.strip()
                if z.isdigit() and len(z) == 5:
                    zips.add(z)
    except Exception as e:
        logger.warning(f"Could not read prospecting logs: {e}")

    # 3. Exclure 99999 (marker Découverte, sans listings réels)
    zips.discard("99999")

    # 4. Ultime filet — si aucun user actif ET aucun log prospection,
    #    override par variable d'env pour ne PAS faire tourner à vide.
    if not zips:
        override = os.environ.get("SCRAPE_TARGET_ZIPS_FALLBACK", "")
        for z in override.split(","):
            z = z.strip()
            if z.isdigit() and len(z) == 5 and z != "99999":
                zips.add(z)
        if zips:
            logger.warning(f"[target-zips] aucune donnée user → fallback env: {sorted(zips)}")
        else:
            logger.error("[target-zips] AUCUNE cible détectée. Scrape va être vide.")

    out = sorted(zips)
    logger.info(f"[target-zips] cible finale = {len(out)} CP : {out[:20]}{'…' if len(out) > 20 else ''}")
    return out


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


async def _kickoff_apify(client: httpx.AsyncClient, zips: list[str]) -> tuple[str | None, str | None, str | None]:
    """POST /acts/{actor}/runs and return (run_id, dataset_id, error_reason).
    We pass a SINGLE-ZIP list because the actor is unreliable with multi-ZIP
    inputs (see MAX_PARALLEL_RUNS comment).

    error_reason est renseigné dès qu'on ne peut PAS lancer un run — le
    scrape complet sortait auparavant en `total_upserted:0` sans indice.
    """
    body = {
        "sources": APIFY_SOURCES,
        "transaction": "buy",
        "postalCodes": zips,
        "maxItems": MAX_ITEMS_PER_ZIP * len(zips),
    }
    url = f"https://api.apify.com/v2/acts/{APIFY_ACTOR}/runs?token={APIFY_TOKEN}"
    try:
        r = await client.post(url, json=body, timeout=25)
    except Exception as e:
        reason = f"http_error:{type(e).__name__}:{str(e)[:120]}"
        logger.warning(f"Apify kickoff exception zips={zips}: {reason}")
        return None, None, reason
    if r.status_code not in (200, 201):
        body_txt = r.text[:400] if r.text else ""
        reason = f"http_{r.status_code}:{body_txt[:200]}"
        # 402 / 403 quota lié plateforme désactivée : on remonte spécifiquement.
        low = body_txt.lower()
        if r.status_code == 402 or "usage" in low or "plan-limit" in low or "monthly-usage" in low:
            reason = f"apify_quota_reached:{body_txt[:200]}"
        elif r.status_code == 403 or "disabled" in low or "unauthorized" in low:
            reason = f"apify_account_disabled:{body_txt[:200]}"
        logger.warning(f"Apify kickoff failed {r.status_code}: {body_txt[:200]}")
        return None, None, reason
    data = r.json().get("data", {})
    return data.get("id"), data.get("defaultDatasetId"), None


async def _poll_and_fetch(client: httpx.AsyncClient, run_id: str, dataset_id: str) -> tuple[list[dict] | None, str, int]:
    """Poll a run until SUCCEEDED (or timeout). Returns (items|None, status, items_count).

    Renvoie TOUJOURS un status explicite (`SUCCEEDED` / `FAILED` / `TIMED-OUT` /
    `ABORTED` / `POLL_TIMEOUT` / `FETCH_ERROR`), plus le nombre d'items reçus
    (0 possible même sur SUCCEEDED). Le rapport final peut donc distinguer
    « Apify a tourné mais n'a rien trouvé » de « Apify n'a jamais démarré ».
    """
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
        final = status or "POLL_TIMEOUT"
        logger.info(f"Run {run_id} ended with status={final} after {elapsed}s")
        return None, final, 0

    try:
        dr = await client.get(
            f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={APIFY_TOKEN}&clean=true&limit=1000",
            timeout=30,
        )
        if dr.status_code != 200:
            logger.warning(f"Dataset fetch failed {dr.status_code}")
            return None, "FETCH_ERROR", 0
        items = dr.json() or []
        return items, "SUCCEEDED", len(items)
    except Exception as e:
        logger.warning(f"Dataset fetch exception: {e}")
        return None, "FETCH_ERROR", 0


async def _scrape_single_zip(client: httpx.AsyncClient, zip_code: str, sem: asyncio.Semaphore) -> dict:
    """Run one Apify run for exactly ONE ZIP, then dedupe & upsert.
    Concurrency is capped via the shared semaphore.

    Retourne un dict RICHE avec `status`, `apify_run_status`, `items_fetched`,
    `kept_after_dedupe`, `upserted`, `reason`. Un échec ne ressemble plus
    JAMAIS à un succès vide.
    """
    async with sem:
        logger.info(f"Kicking off Apify for ZIP {zip_code}")
        run_id, dataset_id, kickoff_error = await _kickoff_apify(client, [zip_code])
        if not run_id or not dataset_id:
            return {
                "zip": zip_code, "run_id": None,
                "status": "kickoff_failed",
                "apify_run_status": None,
                "items_fetched": 0, "kept_after_dedupe": 0, "upserted": 0,
                "reason": kickoff_error or "kickoff_failed_no_reason",
            }

        rows, apify_status, items_fetched = await _poll_and_fetch(client, run_id, dataset_id)
        if rows is None:
            return {
                "zip": zip_code, "run_id": run_id,
                "status": "no_data",
                "apify_run_status": apify_status,
                "items_fetched": items_fetched,
                "kept_after_dedupe": 0, "upserted": 0,
                "reason": f"apify_run_{apify_status.lower()}",
            }

        unique = _dedupe_by_url(rows)
        logger.info(f"  {zip_code}: {items_fetched} raw → {len(unique)} unique URLs")

        try:
            from v2_router import _upsert_supabase_listings  # type: ignore
            upserted = await _upsert_supabase_listings(unique, portal_default="leboncoin")
        except Exception as e:
            reason = f"supabase_upsert_error:{type(e).__name__}:{str(e)[:120]}"
            logger.warning(f"  {zip_code}: {reason}")
            return {
                "zip": zip_code, "run_id": run_id,
                "status": "upsert_failed",
                "apify_run_status": apify_status,
                "items_fetched": items_fetched,
                "kept_after_dedupe": len(unique), "upserted": 0,
                "reason": reason,
            }
        return {
            "zip": zip_code, "run_id": run_id,
            "status": "ok",
            "apify_run_status": apify_status,
            "items_fetched": items_fetched,
            "kept_after_dedupe": len(unique), "upserted": upserted,
            "reason": None,
        }


async def run_once(explicit_zips: list[str] | None = None,
                    force: bool = False,
                    cooldown_hours: int = 6) -> dict:
    """Main entry point — used by the CLI and by the notification_scheduler tick.

    - `force` : bypass le cooldown quotidien. Défaut False → si un run
      SUCCEEDED existe depuis <cooldown_hours>, on refuse pour préserver
      le budget Apify (build 2.24 : le user a consommé 1 mois de quota
      en 10 lancements manuels).
    - `cooldown_hours` : période de garde. 6h par défaut.

    Retour : dict TOUJOURS renseigné avec :
      - `status` : `ok` | `no_target` | `apify_disabled` | `cooldown` | `error`
      - `error` : message concis si échec
      - `apify_ping` : diagnostic ping Apify (status HTTP + snippet)
      - `results` : liste par zip avec status / items_fetched / reason
    """
    if not APIFY_TOKEN:
        logger.error("APIFY_API_TOKEN missing — aborting")
        return {"status": "error", "error": "missing_apify_token"}

    started_at = datetime.now(timezone.utc)
    client = _mongo()
    db = client[os.environ["DB_NAME"]]

    try:
        # --- Cooldown : refuse si un run récent a réussi (protection budget) ---
        if not force and cooldown_hours > 0:
            since = started_at - timedelta(hours=cooldown_hours)
            recent = await db.v2_scraper_runs.find_one(
                {"started_at": {"$gte": since.isoformat()},
                 "total_upserted": {"$gt": 0}},
                sort=[("started_at", -1)],
            )
            if recent:
                logger.info(f"[cooldown] scrape refusé — dernier succès à {recent.get('started_at')}")
                return {
                    "status": "cooldown",
                    "error": (
                        f"scrape_deja_reussi_recemment — dernier run à "
                        f"{recent.get('started_at')} (upserted={recent.get('total_upserted')}). "
                        f"Repasser --force pour outrepasser."
                    ),
                    "last_successful_at": recent.get("started_at"),
                    "last_upserted": recent.get("total_upserted"),
                    "cooldown_hours": cooldown_hours,
                }

        target_zips = await _resolve_target_zips(db, extra_zips=explicit_zips)
        if not target_zips:
            logger.info("No target ZIPs — nothing to scrape.")
            return {"status": "no_target", "batches": 0, "target_zips_count": 0,
                    "total_upserted": 0, "total_unique": 0,
                    "error": "aucune_cible_detectee — aucun user actif ni zone couverte"}

        # --- Ping Apify AVANT tout run — cadre le budget ---
        async with httpx.AsyncClient() as http_client:
            ping = await _apify_ping(http_client)

        # Si le ping remonte que le compte est désactivé/quota, on stoppe
        # AVANT d'appeler l'API 3× par zone.
        if ping.get("verdict") in ("disabled", "quota_reached"):
            return {
                "status": "apify_disabled",
                "error": f"apify_{ping.get('verdict')}",
                "apify_ping": ping,
                "target_zips_count": len(target_zips),
                "target_zips": target_zips,
                "batches": 0,
                "total_upserted": 0,
                "total_unique": 0,
                "results": [],
            }

        results: list[dict] = []
        total_upserted = 0
        total_unique = 0
        total_items_fetched = 0

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
                total_items_fetched += res.get("items_fetched", 0) or 0

        # Verdict global : `ok` si au moins un zip a réussi, sinon `error`.
        n_ok = sum(1 for r in results if r.get("status") == "ok")
        n_fail = len(results) - n_ok
        global_status = "ok" if n_ok > 0 else "error"
        summary = {
            "status": global_status,
            "started_at": started_at.isoformat(),
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "target_zips_count": len(target_zips),
            "target_zips": target_zips,
            "batches": len(results),
            "n_ok": n_ok,
            "n_fail": n_fail,
            "total_items_fetched": total_items_fetched,
            "total_upserted": total_upserted,
            "total_unique": total_unique,
            "run_ids": [r.get("run_id") for r in results if r.get("run_id")],
            "apify_ping": ping,
            "results": results,
        }
        if global_status == "error":
            # Agrège les raisons distinctes des échecs pour l'utilisateur.
            reasons = sorted({r.get("reason") for r in results if r.get("reason")})
            summary["error"] = f"aucun_zip_reussi — raisons: {reasons}"
        try:
            await db.v2_scraper_runs.insert_one(summary)
        except Exception as e:
            logger.warning(f"Could not persist run summary: {e}")

        # Drop the Mongo _id field before returning (JSON-safe).
        summary.pop("_id", None)
        logger.info(
            f"Scrape done: status={global_status} "
            f"{total_upserted} upserted, {total_unique} unique, "
            f"{n_ok}/{len(results)} zips OK"
        )
        return summary
    except Exception as e:
        # Toute exception NON prévue remonte proprement au lieu de disparaître.
        import traceback
        tb = traceback.format_exc()[:800]
        logger.exception(f"run_once fatal: {e}")
        return {
            "status": "error",
            "error": f"{type(e).__name__}: {str(e)[:200]}",
            "traceback": tb,
        }
    finally:
        client.close()


async def _apify_ping(client: httpx.AsyncClient) -> dict:
    """Diagnostic Apify : ping minimal du endpoint `users/me`.

    Retour :
      - `status_code` : HTTP status du /users/me (200 OK, 401/403 auth,
        402 quota, 5xx panne)
      - `verdict` : `ok` | `disabled` | `quota_reached` | `unauthorized` | `error`
      - `message` : extrait du body Apify (max 200 chars)
      - `checked_at` : ISO UTC
    """
    if not APIFY_TOKEN:
        return {"verdict": "error", "message": "missing_apify_token",
                "checked_at": datetime.now(timezone.utc).isoformat()}
    url = f"https://api.apify.com/v2/users/me?token={APIFY_TOKEN}"
    try:
        r = await client.get(url, timeout=10)
        body_txt = r.text[:500] if r.text else ""
    except Exception as e:
        return {"verdict": "error",
                "message": f"http_exception:{type(e).__name__}:{str(e)[:120]}",
                "checked_at": datetime.now(timezone.utc).isoformat()}
    low = body_txt.lower()
    if r.status_code == 200:
        verdict = "ok"
    elif r.status_code == 402 or "usage" in low or "plan-limit" in low or "monthly-usage" in low:
        verdict = "quota_reached"
    elif r.status_code in (401, 403) or "unauthorized" in low or "disabled" in low:
        verdict = "disabled" if "disabled" in low else "unauthorized"
    else:
        verdict = "error"
    return {
        "verdict": verdict,
        "status_code": r.status_code,
        "message": body_txt[:200],
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


def _cli() -> None:
    parser = argparse.ArgumentParser(description="KOLO Apify → Supabase scraper")
    parser.add_argument("--once", action="store_true", help="Run one scrape cycle and exit")
    parser.add_argument(
        "--zips",
        type=str,
        default="",
        help="Comma-separated ZIP override (skips auto-detection)",
    )
    parser.add_argument("--force", action="store_true",
                        help="Bypass 6h cooldown (dernier run réussi)")
    parser.add_argument("--cooldown-hours", type=int, default=6,
                        help="Période cooldown en heures (défaut 6)")
    args = parser.parse_args()
    explicit = [z.strip() for z in args.zips.split(",") if z.strip()] if args.zips else None
    result = asyncio.run(run_once(explicit_zips=explicit, force=args.force,
                                    cooldown_hours=args.cooldown_hours))
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    _cli()
