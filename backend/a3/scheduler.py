"""KOLO A3 — Cron 03h00 Europe/Paris.

Boucle asyncio simple qui calcule le prochain 03:00 en heure de Paris, dort
jusque-là, exécute le job, se recale. Fonctionne correctement en heure d'été
et en heure d'hiver — `zoneinfo` gère les DST.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

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


async def _run_cycle(db) -> None:
    """Enchaîne extraction rues puis génération opportunités."""
    logger.info("a3.cron: DÉBUT extraction rues")
    try:
        r1 = await run_extraire_rues(db, code_postal=None)
        logger.info(f"a3.cron: extraction rues OK — {r1.get('totals')}")
    except Exception as e:
        logger.error(f"a3.cron: extraction rues FAILED — {e}")

    logger.info("a3.cron: DÉBUT génération opportunités")
    try:
        r2 = await run_generer_opportunites(db, code_postal=None)
        logger.info(f"a3.cron: génération opportunités OK — {r2.get('cps_processed')} zones")
    except Exception as e:
        logger.error(f"a3.cron: génération opportunités FAILED — {e}")


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
