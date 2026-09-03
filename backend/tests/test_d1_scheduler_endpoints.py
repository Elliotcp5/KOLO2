"""KOLO — Régression : endpoints admin liés au scheduler D1 + a3.

Ces endpoints ont été cassés une fois (POST /api/d1/admin/generer-opportunites
décapité + `jobs_runs` non alimenté par le scheduler a3 + fuseau APScheduler
tombant en UTC). Le fichier gèle ces invariants.
"""
from __future__ import annotations

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from d1.routes import router


def test_generer_opportunites_post_endpoint_mounted():
    """Le POST /api/d1/admin/generer-opportunites DOIT exister (endpoint async
    qui retourne un job_id — sans lui, l'ingestion 03h00 côté prod n'a aucun
    déclencheur manuel, et /api/jobs/generer-opportunites (a3) time-out en
    proxy sur zones réelles."""
    paths_by_method = {}
    for r in router.routes:
        for m in getattr(r, "methods", set()) or set():
            paths_by_method.setdefault(m, set()).add(r.path)
    assert "/api/d1/admin/generer-opportunites" in paths_by_method.get("POST", set()), \
        "POST /api/d1/admin/generer-opportunites manquant — l'endpoint async a été supprimé"
    assert "/api/d1/admin/generer-opportunites/{job_id}" in paths_by_method.get("GET", set())


def test_etat_jobs_lists_extraire_rues():
    """etat-jobs doit inclure `extraire_rues_quotidien` (loggé par a3.scheduler)."""
    import inspect
    from d1 import routes
    src = inspect.getsource(routes.admin_etat_jobs)
    assert "extraire_rues_quotidien" in src
    assert "generer_opportunites_quotidien" in src
    assert "distribuer_quotidien" in src
    assert "recycler_48h" in src
    assert "recharger_decouverte_hebdo" in src


def test_apscheduler_uses_pytz_paris():
    """Sanity : APScheduler + `pytz.timezone("Europe/Paris")` + `CronTrigger(...,
    timezone=tz)` DOIT produire CET/CEST. Invariant aussi verrouillé au niveau
    du code source par `test_d1_scheduler_config_uses_pytz_and_trigger_tz`.
    """
    import asyncio
    tz = pytz.timezone("Europe/Paris")
    # APScheduler AsyncIO nécessite un event loop pour `start()` — on en fournit un.
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        sched_ok = AsyncIOScheduler(timezone=tz)
        sched_ok.add_job(lambda: None, CronTrigger(hour=6, minute=0, timezone=tz),
                         id="ok_pytz_check")
        sched_ok.start()
        tzname_ok = sched_ok.get_job("ok_pytz_check").next_run_time.tzname()
        sched_ok.shutdown(wait=False)
    finally:
        loop.close()
        asyncio.set_event_loop(None)
    assert tzname_ok in ("CET", "CEST"), f"attendu CET/CEST, obtenu {tzname_ok}"


def test_d1_scheduler_config_uses_pytz_and_trigger_tz():
    """Vérifie que d1/scheduler.py utilise pytz.timezone ET passe la tz au
    CronTrigger (sans quoi les jobs tournent à 06h/07h UTC)."""
    src = open("/app/backend/d1/scheduler.py").read()
    assert "import pytz" in src
    assert 'pytz.timezone("Europe/Paris")' in src
    # Chaque CronTrigger doit recevoir la tz
    assert "hour=6, minute=0, timezone=TZ" in src, "cron 06h00 doit passer timezone=TZ"
    assert "hour=7, minute=0, timezone=TZ" in src, "cron 07h00 doit passer timezone=TZ"
    assert 'day_of_week="mon", hour=0, minute=0, timezone=TZ' in src, \
        "cron hebdo (lundi 00h00) doit passer timezone=TZ"


def test_a3_scheduler_logs_to_jobs_runs():
    """Le cron a3 (03h00 Paris) doit persister dans `jobs_runs` sinon
    /api/d1/admin/etat-jobs restera vide même quand le job tourne."""
    src = open("/app/backend/a3/scheduler.py").read()
    assert "_log_run" in src
    assert "generer_opportunites_quotidien" in src
    assert "extraire_rues_quotidien" in src
    assert "jobs_runs" in src


def test_run_job_includes_extraire_rues():
    """Le mapping run-job doit permettre de déclencher extraire_rues_quotidien
    manuellement (utile pour valider en prod sans attendre 03h00)."""
    src = open("/app/backend/d1/routes.py").read()
    assert '"extraire_rues_quotidien": _run_extraire_rues_wrapper' in src
