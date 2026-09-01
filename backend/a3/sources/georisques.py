"""KOLO A3 — Géorisques (état des risques par point).

⚠️ Piège : le paramètre `latlon` de l'API v1 attend « lon,lat », pas « lat,lon ».
Inverser silencieusement renvoie des risques d'une autre commune.

API lente (jusqu'à 10 s). À appeler EN TÂCHE DE FOND, jamais en bloquant.
Cache 6 mois dans `enrichissements`.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

BASE = "https://georisques.gouv.fr/api/v1/resultats_rapport_risque"
CACHE_DAYS = 180  # 6 mois


async def fetch_risques(
    client: httpx.AsyncClient, lat: float, lng: float
) -> Optional[dict]:
    """Retourne le rapport de risques. ATTENTION : ordre longitude d'abord."""
    try:
        r = await client.get(
            BASE,
            params={"latlon": f"{float(lng)},{float(lat)}"},  # lon,lat
            timeout=15,
        )
        if r.status_code != 200:
            logger.warning(f"georisques HTTP {r.status_code} for {lng},{lat}")
            return None
        return r.json() or {}
    except Exception as e:
        logger.warning(f"georisques.fetch_risques failed: {e}")
        return None


async def get_or_fetch_by_parcelle(
    db, client: httpx.AsyncClient, id_parcelle: str, lat: float, lng: float
) -> Optional[dict]:
    """Cache par identifiant de parcelle 14 caractères."""
    cached = await db.enrichissements.find_one({"_id": id_parcelle})
    if cached and cached.get("georisques"):
        try:
            date_maj = datetime.fromisoformat(cached["date_maj"].replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - date_maj) < timedelta(days=CACHE_DAYS):
                return cached["georisques"]
        except Exception:
            pass
    data = await fetch_risques(client, lat, lng)
    if data is None:
        return None
    await db.enrichissements.update_one(
        {"_id": id_parcelle},
        {"$set": {
            "georisques": data,
            "date_maj": datetime.now(timezone.utc).isoformat(),
            "lat": lat, "lng": lng,
        }},
        upsert=True,
    )
    return data
