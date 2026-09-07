"""KOLO — planificateur de production (APScheduler, tz Europe/Paris).

Jobs planifiés :
  1. `generer_opportunites_quotidien`  — 03h00 Paris  — génère sur toutes zones
     actives de `zones_couvertes`.
  2. `distribuer_quotidien`            — 06h00 Paris  — applique la règle de
     lissage `max(1, min(5, taille_pool − 3))` et attribue à chaque user actif
     selon ses `zones_perso`.
  3. `recycler_48h`                    — 07h00 Paris  — repasse en `pool` les
     opps restées en `proposee` depuis > 48 h.
  4. `recharger_decouverte_hebdo`      — Lundi 00h00 Paris — recharge le quota
     du plan Découverte (à définir : reset des compteurs hebdo).

Chaque exécution logge dans `jobs_runs` : {job, start, end, status, summary, error}.
Endpoint `GET /api/d1/admin/etat-jobs` expose ces logs.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

logger = logging.getLogger(__name__)
TZ = pytz.timezone("Europe/Paris")

_scheduler: AsyncIOScheduler | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _log_run(db, job: str, start_iso: str, status: str,
                   summary: dict | None = None, error: str | None = None):
    await db.jobs_runs.insert_one({
        "job": job, "start": start_iso, "end": _now_iso(),
        "status": status, "summary": summary or {}, "error": error,
    })


async def _run_scraper_quotidien(db):
    """Job 0 — 02h00 Paris — kick-off le scrape Apify + ingest Supabase pour
    toutes les zones actives.

    Pourquoi 02h00 : la génération à 03h00 lit la fraîcheur du dernier scrape
    via `_facteur_fraicheur`. Si le scrape date de >5j, `f_frais` tombe à 0 et
    zéro opportunité passe le seuil, quel que soit le seuil. Le scrape doit
    donc précéder la génération dans la nuit.
    """
    start = _now_iso()
    try:
        from scripts.scrape_listings_cron import run_once as _scrape_run
        from scripts.ingest_apify import ingest_runs
        scrape = await _scrape_run()
        run_ids = list(scrape.get("run_ids") or [])
        ingest: dict = {}
        if run_ids:
            ingest = await ingest_runs(run_ids, stale_hours=48)
        # Persist marker read by /api/v2/admin/scraper/status
        now_iso = _now_iso()
        await db.v2_scraper_last_run.update_one(
            {"_id": "singleton"},
            {"$set": {
                "last_run_at": now_iso,
                "scrape": {
                    "batches": scrape.get("batches"),
                    "total_upserted": scrape.get("total_upserted"),
                    "total_unique": scrape.get("total_unique"),
                    "target_zips_count": scrape.get("target_zips_count"),
                    "error": scrape.get("error"),
                },
                "ingest": {
                    "inserted": ingest.get("inserted"),
                    "updated": ingest.get("updated"),
                    "deactivated": ingest.get("deactivated"),
                    "items_fetched": ingest.get("items_fetched"),
                    "error": ingest.get("error"),
                },
            }},
            upsert=True,
        )
        await _log_run(db, "scraper_quotidien", start, "done",
                       summary={"scrape": scrape, "ingest": ingest})
    except Exception as e:
        await _log_run(db, "scraper_quotidien", start, "failed",
                       error=f"{type(e).__name__}: {e}")


async def _run_generer_opportunites(db):
    """Job 1 — génère sur toutes les zones actives."""
    from a3.job_generer_opportunites import run_generer_opportunites
    start = _now_iso()
    try:
        zones = await db.zones_couvertes.find(
            {"actif": True}, {"code_postal": 1}
        ).to_list(length=None)
        by_cp = []
        for z in zones:
            cp = z.get("code_postal")
            if not cp:
                continue
            report = await run_generer_opportunites(db, code_postal=str(cp))
            by_cp.append({"cp": cp, "report": report})
        await _log_run(db, "generer_opportunites_quotidien", start, "done",
                       summary={"zones": len(by_cp), "by_cp": by_cp})
    except Exception as e:
        await _log_run(db, "generer_opportunites_quotidien", start, "failed",
                       error=f"{type(e).__name__}: {e}")


async def _run_distribuer_quotidien(db):
    """Job 2 — attribue les opportunités du jour à chaque user actif.

    Règle de lissage : pour chaque user, il reçoit
        max(1, min(5, taille_pool_zone - 3))
    opportunités par zone. Une opp ne peut être attribuée qu'une seule fois
    (statut `pool` → `proposee` + `assigne_a` posé).
    """
    start = _now_iso()
    try:
        users = await db.users.find(
            {"app_version": "b1", "zones_perso": {"$exists": True, "$ne": []}}
        ).to_list(length=None)
        total_attrib = 0
        for u in users:
            uid = u.get("user_id")
            for cp in (u.get("zones_perso") or []):
                pool_size = await db.opportunites.count_documents(
                    {"code_postal": cp, "statut": "pool"}
                )
                if pool_size == 0:
                    continue
                n = max(1, min(5, pool_size - 3))
                cur = db.opportunites.find(
                    {"code_postal": cp, "statut": "pool"}
                ).limit(n)
                async for opp in cur:
                    now = _now_iso()
                    await db.opportunites.update_one(
                        {"_id": opp["_id"]},
                        {"$set": {
                            "user_id": uid, "assigne_a": uid,
                            "statut": "proposee",
                            "date_attribution": now, "updated_at": now,
                        }},
                    )
                    total_attrib += 1
        await _log_run(db, "distribuer_quotidien", start, "done",
                       summary={"users": len(users), "attribuees": total_attrib})
    except Exception as e:
        await _log_run(db, "distribuer_quotidien", start, "failed",
                       error=f"{type(e).__name__}: {e}")


async def _run_recycler_48h(db):
    """Job 3 — les opps `proposee` de plus de 48 h retournent en `pool`."""
    start = _now_iso()
    try:
        seuil = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
        r = await db.opportunites.update_many(
            {"statut": "proposee", "date_attribution": {"$lt": seuil}},
            {"$set": {"statut": "pool", "updated_at": _now_iso()},
             "$unset": {"assigne_a": "", "user_id": "", "date_attribution": ""}},
        )
        await _log_run(db, "recycler_48h", start, "done",
                       summary={"recyclees": r.modified_count})
    except Exception as e:
        await _log_run(db, "recycler_48h", start, "failed",
                       error=f"{type(e).__name__}: {e}")


async def _run_recharger_decouverte(db):
    """Job 4 — reset hebdomadaire du quota du plan Découverte (lundi 00h)."""
    start = _now_iso()
    try:
        r = await db.users.update_many(
            {"plan": "decouverte"},
            {"$set": {"quota_decouverte_semaine": 3,
                      "quota_decouverte_reset_at": _now_iso()}},
        )
        await _log_run(db, "recharger_decouverte_hebdo", start, "done",
                       summary={"users_reset": r.modified_count})
    except Exception as e:
        await _log_run(db, "recharger_decouverte_hebdo", start, "failed",
                       error=f"{type(e).__name__}: {e}")


def start_scheduler(db, force: bool = False):
    """Démarré au startup FastAPI. Idempotent sauf si force=True.

    Bug prod (build 80) : après un redémarrage du pod backend, le module reste
    en mémoire du worker mais l'`AsyncIOScheduler` peut être stoppé. La garde
    `if _scheduler is not None` renvoyait un objet mort. `force=True` permet
    un reset complet via l'endpoint admin `/api/d1/admin/reload-scheduler`.
    """
    global _scheduler
    if _scheduler is not None and not force:
        # Vérifie que le scheduler est bien VIVANT (running)
        if getattr(_scheduler, "running", False):
            return _scheduler
        logger.warning("[d1.scheduler] scheduler existant mais mort — restart forcé")
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:
            pass
        _scheduler = None
    sched = AsyncIOScheduler(timezone=TZ)
    # Job 0 (scrape Apify+ingest Supabase) 02h00 Paris — précède obligatoirement
    # la génération (03h00) sinon la fraîcheur tombe à 0 après 5j.
    sched.add_job(lambda: asyncio.create_task(_run_scraper_quotidien(db)),
                  CronTrigger(hour=2, minute=0, timezone=TZ), id="scraper_quotidien",
                  replace_existing=True)
    # Job 1 (génération 03h00) est déjà géré par `a3.scheduler` — on ne le
    # réenregistre pas ici pour éviter le doublon. On garde la fonction
    # `_run_generer_opportunites` pour /api/d1/admin/run-job manuel uniquement.
    sched.add_job(lambda: asyncio.create_task(_run_distribuer_quotidien(db)),
                  CronTrigger(hour=6, minute=0, timezone=TZ), id="distribuer_quotidien",
                  replace_existing=True)
    sched.add_job(lambda: asyncio.create_task(_run_recycler_48h(db)),
                  CronTrigger(hour=7, minute=0, timezone=TZ), id="recycler_48h",
                  replace_existing=True)
    sched.add_job(lambda: asyncio.create_task(_run_recharger_decouverte(db)),
                  CronTrigger(day_of_week="mon", hour=0, minute=0, timezone=TZ),
                  id="recharger_decouverte_hebdo", replace_existing=True)
    sched.start()
    _scheduler = sched
    logger.info("[d1.scheduler] démarré (Europe/Paris) — 4 jobs planifiés (généra déléguée à a3)")
    return sched
