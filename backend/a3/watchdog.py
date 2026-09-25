"""KOLO — Watchdog des schedulers.

Ce module résout la troisième récurrence du même bug prod (build 78, 80, 84) :
les schedulers `d1.scheduler` (APScheduler) et `a3.scheduler` (boucle asyncio)
meurent en silence après un redémarrage de pod ou une exception non gérée.
Résultat : le scrape Apify quotidien de 02h00 ne tourne plus, la génération
de 03h00 n'a pas de listings à croiser, la distribution de 06h00 n'attribue
rien, et personne ne s'en rend compte pendant une semaine entière.

Comportement au boot :
  - Appelle immédiatement `start_scheduler(d1)` + `start_a3_scheduler(a3)`
    avec `force=False` (idempotent — no-op si déjà vivants).
  - Persiste un heartbeat `watchdog_startup_at`.

Comportement récurrent (toutes les 30 min) :
  - `d1.scheduler._scheduler.running` doit être `True`. Sinon → force restart.
  - `a3.scheduler._a3_task` doit être en cours. Sinon → force restart.
  - Interroge `jobs_runs` pour la dernière exécution `done` de
    `scraper_quotidien` et `generer_opportunites_quotidien`. Si l'un des deux
    date de plus de 24 h → envoie un email d'alerte via Resend
    (dedup 12 h par (job, status) pour ne pas spammer).

Interface :
  - `start_watchdog(db)` — démarre la boucle infinie via `asyncio.create_task`.
  - `watchdog_status()` — dict pour l'endpoint admin.
  - `check_and_repair(db)` — un tour manuel, exposé via
    `/api/d1/admin/watchdog/tick` (utile pour tester en preview).
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

# 30 min entre deux checks — équilibre entre réactivité et charge.
CHECK_INTERVAL_SECONDS = 30 * 60

# Alerte email si un job n'a pas tourné depuis plus de 24 h.
STALE_THRESHOLD_HOURS = 24

# Dedup entre 2 emails pour le même (job, code) — 12 h.
ALERT_DEDUP_HOURS = 12

# Jobs quotidiens critiques surveillés pour la fraîcheur.
DAILY_JOBS = ["scraper_quotidien", "generer_opportunites_quotidien"]

# Gestionnaire de tâche globale — permet à `/api/d1/admin/watchdog/status`
# de savoir si la boucle est vivante.
_watchdog_task: Optional[asyncio.Task] = None
_last_check_at: Optional[str] = None
_last_check_result: dict[str, Any] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(s: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


async def _send_alert_email(db, subject: str, body: str, code: str) -> bool:
    """Envoi via Resend. Dedup 12 h par `code` via collection `scheduler_alerts`."""
    api_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    to_email = (os.environ.get("SCHEDULER_ALERT_EMAIL") or "").strip()
    if not api_key or not to_email:
        logger.warning("[watchdog] alert email skipped — RESEND_API_KEY ou SCHEDULER_ALERT_EMAIL absent")
        return False
    # Dedup — 12 h par code d'alerte.
    since = (datetime.now(timezone.utc) - timedelta(hours=ALERT_DEDUP_HOURS)).isoformat()
    already = await db.scheduler_alerts.find_one({"code": code, "sent_at": {"$gte": since}})
    if already:
        logger.info(f"[watchdog] alerte {code} déjà envoyée récemment — skip")
        return False
    sender = (os.environ.get("SENDER_EMAIL") or "noreply@trykolo.io").strip()
    try:
        import resend  # type: ignore
        resend.api_key = api_key
        await asyncio.to_thread(
            resend.Emails.send,
            {
                "from": f"KOLO Watchdog <{sender}>",
                "to": [to_email],
                "subject": subject,
                "text": body,
            },
        )
        await db.scheduler_alerts.insert_one({
            "code": code, "subject": subject, "sent_at": _now_iso(),
        })
        logger.info(f"[watchdog] alerte email envoyée : {code}")
        return True
    except Exception as e:
        logger.error(f"[watchdog] envoi email échoué ({code}) : {e}")
        return False


async def _check_daily_job_freshness(db) -> list[dict]:
    """Retourne la liste des jobs quotidiens dont le dernier `done` est stale."""
    stale: list[dict] = []
    threshold = datetime.now(timezone.utc) - timedelta(hours=STALE_THRESHOLD_HOURS)
    for job in DAILY_JOBS:
        last = await db.jobs_runs.find_one(
            {"job": job, "status": "done"},
            sort=[("start", -1)],
        )
        if not last:
            stale.append({"job": job, "last_done_at": None, "reason": "never_ran"})
            continue
        parsed = _parse_iso(last.get("start") or "")
        if parsed is None or parsed < threshold:
            stale.append({
                "job": job,
                "last_done_at": last.get("start"),
                "reason": "stale",
                "hours_ago": (datetime.now(timezone.utc) - parsed).total_seconds() / 3600 if parsed else None,
            })
    return stale


async def _repair_schedulers(db) -> dict[str, Any]:
    """Vérifie que les 2 schedulers sont vivants. Relance si mort. Retourne l'état."""
    out: dict[str, Any] = {"d1": None, "a3": None, "repaired": []}

    # d1 (APScheduler)
    try:
        from d1.scheduler import _scheduler as d1_sched, start_scheduler as start_d1
        d1_running = bool(d1_sched and getattr(d1_sched, "running", False))
        if not d1_running:
            logger.warning("[watchdog] d1 scheduler mort ou absent — restart forcé")
            s = start_d1(db, force=True)
            out["d1"] = {
                "restarted": True,
                "running": bool(getattr(s, "running", False)),
                "jobs": [j.id for j in s.get_jobs()],
            }
            out["repaired"].append("d1")
        else:
            out["d1"] = {
                "restarted": False,
                "running": True,
                "jobs": [j.id for j in d1_sched.get_jobs()],
            }
    except Exception as e:
        logger.error(f"[watchdog] d1 repair failed: {e}")
        out["d1"] = {"error": f"{type(e).__name__}: {e}"}

    # a3 (asyncio task)
    try:
        from a3.scheduler import start_a3_scheduler, a3_scheduler_status
        status = a3_scheduler_status()
        if not status.get("running"):
            logger.warning(f"[watchdog] a3 loop morte ({status.get('state')}) — restart forcé")
            start_a3_scheduler(db, force=True)
            new_status = a3_scheduler_status()
            out["a3"] = {"restarted": True, **new_status}
            out["repaired"].append("a3")
        else:
            out["a3"] = {"restarted": False, **status}
    except Exception as e:
        logger.error(f"[watchdog] a3 repair failed: {e}")
        out["a3"] = {"error": f"{type(e).__name__}: {e}"}

    return out


async def check_and_repair(db) -> dict[str, Any]:
    """Un tour complet du watchdog. Idempotent."""
    global _last_check_at, _last_check_result
    _last_check_at = _now_iso()

    # 1. Répare les schedulers morts
    repair = await _repair_schedulers(db)

    # 2. Alerte si un scheduler vient d'être ressuscité
    if repair.get("repaired"):
        code = "scheduler_revived_" + "_".join(sorted(repair["repaired"]))
        subject = f"[KOLO] Scheduler ressuscité : {', '.join(repair['repaired'])}"
        body = (
            "Le watchdog a détecté qu'un scheduler était mort et l'a redémarré.\n\n"
            f"Détail : {repair}\n\n"
            "Cause probable : redéploiement de pod, exception non gérée, ou "
            "task asyncio orpheline. Le watchdog boucle toutes les 30 min et "
            "relance automatiquement.\n\n"
            f"Timestamp : {_last_check_at}\n"
        )
        await _send_alert_email(db, subject, body, code)

    # 3. Vérifie la fraîcheur des jobs quotidiens
    stale = await _check_daily_job_freshness(db)
    if stale:
        code = "stale_daily_" + "_".join(sorted(s["job"] for s in stale))
        subject = f"[KOLO] Alerte : {len(stale)} job(s) quotidien(s) stale >{STALE_THRESHOLD_HOURS}h"
        body_lines = [
            f"Les jobs quotidiens suivants n'ont pas tourné depuis plus de {STALE_THRESHOLD_HOURS}h :\n",
        ]
        for s in stale:
            body_lines.append(
                f"  • {s['job']} — dernier `done` : {s.get('last_done_at') or 'jamais'} "
                f"({s.get('reason')}, {s.get('hours_ago', '?')}h)"
            )
        body_lines.append("")
        body_lines.append(f"État des schedulers : {repair}")
        body_lines.append(f"Timestamp : {_last_check_at}")
        await _send_alert_email(db, subject, "\n".join(body_lines), code)

    _last_check_result = {"at": _last_check_at, "repair": repair, "stale": stale}
    return _last_check_result


async def _watchdog_loop(db) -> None:
    logger.info(f"[watchdog] boucle démarrée — check toutes les {CHECK_INTERVAL_SECONDS//60} min")
    # 1er tour immédiatement au boot pour valider les schedulers.
    while True:
        try:
            await check_and_repair(db)
        except asyncio.CancelledError:
            logger.info("[watchdog] cancelled")
            return
        except Exception as e:
            logger.error(f"[watchdog] tour échoué (non-bloquant) : {e}")
        try:
            await asyncio.sleep(CHECK_INTERVAL_SECONDS)
        except asyncio.CancelledError:
            return


def start_watchdog(db, force: bool = False) -> asyncio.Task:
    """Démarre la boucle. Idempotent sauf si force=True."""
    global _watchdog_task
    if _watchdog_task is not None and not _watchdog_task.done() and not force:
        return _watchdog_task
    if _watchdog_task is not None:
        try:
            _watchdog_task.cancel()
        except Exception:
            pass
    _watchdog_task = asyncio.create_task(_watchdog_loop(db))
    return _watchdog_task


def watchdog_status() -> dict[str, Any]:
    """État actuel du watchdog (pour /api/d1/admin/watchdog/status)."""
    if _watchdog_task is None:
        return {"running": False, "state": "never_started", "last_check_at": _last_check_at}
    if _watchdog_task.done():
        exc = _watchdog_task.exception() if not _watchdog_task.cancelled() else None
        return {
            "running": False,
            "state": "dead",
            "cancelled": _watchdog_task.cancelled(),
            "exception": f"{type(exc).__name__}: {exc}" if exc else None,
            "last_check_at": _last_check_at,
            "last_check_result": _last_check_result,
        }
    return {
        "running": True,
        "state": "running",
        "check_interval_s": CHECK_INTERVAL_SECONDS,
        "stale_threshold_h": STALE_THRESHOLD_HOURS,
        "daily_jobs_watched": DAILY_JOBS,
        "last_check_at": _last_check_at,
        "last_check_result": _last_check_result,
    }
