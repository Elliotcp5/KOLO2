"""KOLO A3 — Cadastre (API Carto IGN, source PCI uniquement)."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

BASE = "https://apicarto.ign.fr/api/cadastre"
CACHE_DAYS = 180  # 6 mois


async def parcelle_from_latlng(
    client: httpx.AsyncClient,
    lat: float,
    lng: float,
) -> Optional[dict]:
    """Retourne `{id_parcelle, section, numero, contenance, code_insee}` ou None.

    `id_parcelle` est le code sur 14 caractères — clé de jointure universelle.
    Force `source_ign=PCI` (la BD Parcellaire n'est plus mise à jour depuis 2018).
    """
    geom = {"type": "Point", "coordinates": [float(lng), float(lat)]}
    try:
        r = await client.get(
            f"{BASE}/parcelle",
            params={"geom": json.dumps(geom, separators=(",", ":")), "source_ign": "PCI"},
            timeout=15,
        )
        if r.status_code != 200:
            return None
        feats = (r.json() or {}).get("features") or []
        if not feats:
            return None
        p = feats[0].get("properties") or {}
        return {
            "id_parcelle": p.get("idu") or p.get("id_parcelle"),
            "section": p.get("section"),
            "numero": p.get("numero"),
            "contenance": p.get("contenance"),
            "code_insee": p.get("code_insee") or p.get("code_com"),
            "commune": p.get("nom_com"),
        }
    except Exception as e:
        logger.warning(f"cadastre.parcelle_from_latlng failed: {e}")
        return None


async def get_or_fetch_parcelle(
    db, client: httpx.AsyncClient, lat: float, lng: float
) -> Optional[dict]:
    """Utilise le cache `enrichissements` (6 mois) avant d'appeler l'API."""
    # Cache par id_parcelle : on ne peut pas connaître la parcelle avant l'appel.
    # On cache donc par (lat, lng) arrondis à 5 décimales (~1 m).
    key = f"cad_{round(float(lat), 5)}_{round(float(lng), 5)}"
    cached = await db.enrichissements.find_one({"_id": key})
    if cached and cached.get("cadastre"):
        try:
            date_maj = datetime.fromisoformat(cached["date_maj"].replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - date_maj) < timedelta(days=CACHE_DAYS):
                return cached["cadastre"]
        except Exception:
            pass
    p = await parcelle_from_latlng(client, lat, lng)
    if not p or not p.get("id_parcelle"):
        return None
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.enrichissements.update_one(
        {"_id": key},
        {"$set": {"cadastre": p, "date_maj": now_iso, "lat": lat, "lng": lng}},
        upsert=True,
    )
    # Miroir par id_parcelle (permet get_or_fetch_georisques par id)
    await db.enrichissements.update_one(
        {"_id": p["id_parcelle"]},
        {"$set": {"cadastre": p, "date_maj": now_iso, "lat": lat, "lng": lng}},
        upsert=True,
    )
    return p
