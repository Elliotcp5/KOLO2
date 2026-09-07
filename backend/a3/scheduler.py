"""KOLO A3 — Cron 03h00 Europe/Paris.

Boucle asyncio simple qui calcule le prochain 03:00 en heure de Paris, dort
jusque-là, exécute le job, se recale. Fonctionne correctement en heure d'été
et en heure d'hiver — `zoneinfo` gère les DST.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from a2.tz import PARIS
from a3.job_generer_opportunites import run_generer_opportunites
from a3.job_extract_rues import run_extraire_rues

logger = logging.getLogger(__name__)


def _seconds_until_next_03h_paris() -> float:
    now = datetime.now(PARIS)
    target = now.replace(hour=3, minute=0, second=0, microsecond=0)
    if target <= now:
        target = target + timedelta(days=1)
    return (target - now).total_seconds()


def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _log_run(db, job: str, start_iso: str, status: str,
                   summary: dict | None = None, error: str | None = None) -> None:
    """Persiste chaque exécution dans `jobs_runs` — lisible via GET /api/d1/admin/etat-jobs."""
    try:
        await db.jobs_runs.insert_one({
            "job": job, "start": start_iso, "end": _now_utc_iso(),
            "status": status, "summary": summary or {}, "error": error,
        })
    except Exception as e:
        logger.warning(f"a3.scheduler: could not persist jobs_runs entry ({job}): {e}")


async def _run_cycle(db) -> None:
    """Enchaîne extraction rues puis génération opportunités. Loggue dans `jobs_runs`."""
    # --- Extraction rues ---
    start_extract = _now_utc_iso()
    logger.info("a3.cron: DÉBUT extraction rues")
    try:
        r1 = await run_extraire_rues(db, code_postal=None)
        # Un job qui scanne sans écrire n'est pas un succès — statut `warning`
        # remonté fidèlement à `jobs_runs` pour être visible dans etat-jobs.
        status = r1.get("status") or "done"
        logger.info(f"a3.cron: extraction rues {status} — {r1.get('totals')}")
        await _log_run(db, "extraire_rues_quotidien", start_extract, status,
                       summary={"totals": r1.get("totals"),
                                "cps_processed": r1.get("cps_processed"),
                                "warning": r1.get("warning")})
    except Exception as e:
        logger.error(f"a3.cron: extraction rues FAILED — {e}")
        await _log_run(db, "extraire_rues_quotidien", start_extract, "failed",
                       error=f"{type(e).__name__}: {e}")

    # --- Génération opportunités ---
    start_gen = _now_utc_iso()
    logger.info("a3.cron: DÉBUT génération opportunités")
    try:
        r2 = await run_generer_opportunites(db, code_postal=None)
        logger.info(f"a3.cron: génération opportunités OK — {r2.get('cps_processed')} zones")
        await _log_run(db, "generer_opportunites_quotidien", start_gen, "done",
                       summary={"cps_processed": r2.get("cps_processed"),
                                "totals": r2.get("totals"),
                                "by_cp": r2.get("by_cp")})
    except Exception as e:
        logger.error(f"a3.cron: génération opportunités FAILED — {e}")
        await _log_run(db, "generer_opportunites_quotidien", start_gen, "failed",
                       error=f"{type(e).__name__}: {e}")


async def scheduler_loop(db) -> None:
    """Boucle infinie 03h00 Paris."""
    logger.info("a3.scheduler: cron 03h00 Europe/Paris démarré")
    while True:
        wait = _seconds_until_next_03h_paris()
        logger.info(f"a3.scheduler: prochain déclenchement dans {wait/3600:.2f} h")
        try:
            await asyncio.sleep(wait)
        except asyncio.CancelledError:
            logger.info("a3.scheduler: cancelled")
            return
        await _run_cycle(db)
        # Petite pause pour ne pas boucler si run_cycle finit vite
        await asyncio.sleep(5)


# --- Gestionnaire de tâche globale --------------------------------------
# Bug prod (build 81) : la tâche `scheduler_loop` était démarrée UNE fois au
# boot puis perdue silencieusement après un redémarrage de pod ou un crash
# non journalisé. Ce global permet à /api/d1/admin/reload-scheduler de
# vérifier l'état et relancer.
_a3_task: asyncio.Task | None = None


def start_a3_scheduler(db, force: bool = False):
    """Démarre (ou redémarre si force=True) la boucle a3."""
    global _a3_task
    if _a3_task is not None and not _a3_task.done() and not force:
        return _a3_task
    if _a3_task is not None:
        try:
            _a3_task.cancel()
        except Exception:
            pass
    _a3_task = asyncio.create_task(scheduler_loop(db))
    return _a3_task


def a3_scheduler_status() -> dict:
    """Retourne l'état de la boucle a3 pour reload-scheduler."""
    if _a3_task is None:
        return {"running": False, "state": "never_started"}
    if _a3_task.done():
        exc = _a3_task.exception() if not _a3_task.cancelled() else None
        return {
            "running": False,
            "state": "dead",
            "cancelled": _a3_task.cancelled(),
            "exception": f"{type(exc).__name__}: {exc}" if exc else None,
        }
    return {
        "running": True,
        "state": "running",
        "jobs": ["generer_opportunites_quotidien", "extraire_rues_quotidien"],
    }
