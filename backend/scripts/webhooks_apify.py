"""
KOLO — Webhook Apify (Session A1)
=================================

`POST /api/webhooks/apify`

Body attendu (JSON) :
{
    "mode":       "complet" | "incremental",   # obligatoire
    "run_ids":    ["run_abc", "run_def", ...],  # optionnel
    "stale_hours": 48                            # optionnel (mode complet uniquement)
}

Auth : header `X-Apify-Secret: <APIFY_WEBHOOK_SECRET>`.

Comportement :
  - mode = "complet"      → upsert + désactivation des annonces non revues
                            (pour les codes postaux du run, si run "propre")
  - mode = "incremental"  → upsert uniquement, JAMAIS de désactivation.
                            Utile quand Apify pousse le webhook après un
                            run partiel (ex: un seul portail, un seul code
                            postal), sans que ça flaggue le reste comme
                            inactif.

Toutes les lignes écrites passent par `normalization.apply_normalization()`
(via `_map_item_to_listing`). Aucun listing ne peut donc arriver dans
`listings` sans `transaction`, `type_normalise` et `est_logement`.

Après ingestion, le webhook alimente la collection Mongo `zones_scraping`
avec un doc par (source, code postal) vu dans le run.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)


def _get_secret() -> str:
    return (os.environ.get("APIFY_WEBHOOK_SECRET") or "").strip()


def _check_auth(request: Request) -> None:
    provided = (request.headers.get("x-apify-secret") or "").strip()
    expected = _get_secret()
    if not expected:
        raise HTTPException(status_code=500, detail="APIFY_WEBHOOK_SECRET not configured")
    if not provided or provided != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Apify-Secret header")


async def handle_apify_webhook(request: Request, db) -> dict:
    """Point d'entrée du webhook. `db` = base Mongo (motor)."""
    _check_auth(request)

    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Body must be a JSON object")

    mode = str(body.get("mode") or "").strip().lower()
    if mode not in ("complet", "incremental"):
        raise HTTPException(
            status_code=400,
            detail="Field `mode` is required and must be 'complet' or 'incremental'",
        )

    stale_hours = int(body.get("stale_hours") or 48)
    stale_hours = max(1, min(720, stale_hours))
    run_ids_raw = body.get("run_ids")

    allow_deactivate = mode == "complet"

    # Import tardif pour éviter tout couplage au démarrage du serveur.
    from scripts.ingest_apify import ingest_latest_run, ingest_runs  # type: ignore
    from scripts.zones_scraping import ensure_indexes, record_ingest  # type: ignore

    if isinstance(run_ids_raw, list) and run_ids_raw:
        run_ids = [str(x).strip() for x in run_ids_raw if str(x).strip()]
        result = await ingest_runs(
            run_ids, stale_hours=stale_hours, allow_deactivate=allow_deactivate,
        )
    else:
        result = await ingest_latest_run(
            stale_hours=stale_hours, allow_deactivate=allow_deactivate,
        )

    # ---- Alimente `zones_scraping` (Mongo) --------------------------------
    zones_touched = 0
    try:
        await ensure_indexes(db)
        items_by_pc: dict[str, int] = result.get("items_by_postal_code") or {}
        input_pcs: list[str] = result.get("input_postal_codes") or []
        sources: list[str] = result.get("sources") or ["unknown"]
        run_ids_ingested: list[str] = [
            (r.get("run_id") or "").strip()
            for r in (result.get("runs") or [])
            if r.get("run_id")
        ]
        # Union pour couvrir les codes postaux qui n'ont pas produit de listing
        # (mode complet — la zone a bien été scrapée même si 0 résultat).
        pcs_touched = sorted({*items_by_pc.keys(), *input_pcs})
        for src in sources:
            zones_touched += await record_ingest(
                db,
                postal_codes=pcs_touched,
                source=src,
                mode=mode,
                run_ids=run_ids_ingested,
                items_seen_by_pc=items_by_pc,
            )
    except Exception as e:
        logger.warning(f"webhook_apify: zones_scraping update failed: {e}")

    # ---- Persist un résumé dans Mongo (utile pour le dashboard admin) -----
    try:
        summary = {
            "kind": "apify_webhook",
            "mode": mode,
            "ran_at": datetime.now(timezone.utc).isoformat(),
            "inserted": int(result.get("inserted") or 0),
            "updated": int(result.get("updated") or 0),
            "deactivated": int(result.get("deactivated") or 0),
            "items_fetched": int(result.get("items_fetched") or 0),
            "runs_total": int(result.get("runs_total") or 0),
            "runs_clean": int(result.get("runs_clean") or 0),
            "stale_hours": stale_hours,
            "allow_deactivate": allow_deactivate,
            "input_postal_codes_count": len(result.get("input_postal_codes") or []),
            "zones_touched": zones_touched,
        }
        await db.v2_apify_webhook_runs.insert_one(dict(summary))
        await db.v2_apify_webhook_last.update_one(
            {"_id": "singleton"},
            {"$set": {k: v for k, v in summary.items() if k != "_id"}},
            upsert=True,
        )
    except Exception as e:
        logger.warning(f"webhook_apify: could not persist summary: {e}")

    # Réponse compacte (les runs détaillés restent disponibles dans `result["runs"]`).
    return {
        "ok": True,
        "mode": mode,
        "allow_deactivate": allow_deactivate,
        "stale_hours": stale_hours,
        "runs_total": result.get("runs_total"),
        "runs_clean": result.get("runs_clean"),
        "items_fetched": result.get("items_fetched"),
        "inserted": result.get("inserted"),
        "updated": result.get("updated"),
        "deactivated": result.get("deactivated"),
        "zones_touched": zones_touched,
        "input_postal_codes_count": len(result.get("input_postal_codes") or []),
        "sources": result.get("sources") or [],
        "runs": result.get("runs") or [],
    }


async def get_zones_status(db, source: Optional[str] = None, limit: int = 200) -> dict:
    """Endpoint auxiliaire (dashboard admin) : liste des zones scrapées."""
    from scripts.zones_scraping import list_zones  # type: ignore
    zones = await list_zones(db, source=source, limit=limit)
    return {"zones": zones, "count": len(zones)}
