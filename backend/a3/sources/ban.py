"""KOLO A3 — BAN (Base Adresse Nationale).

Deux usages :
  1. `geocode(adresse, cp)` → (lat, lng, score, ban_id). Rejette < seuil.
  2. `voies_by_postcode(cp)` → liste normalisée des noms de voies, cachée.

Endpoint : https://api-adresse.data.gouv.fr (aucun jeton requis, rate limit ~50 req/s).
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

import httpx

from a3.text import normalize_voie

logger = logging.getLogger(__name__)

BAN_BASE = "https://api-adresse.data.gouv.fr"


async def geocode(
    client: httpx.AsyncClient,
    adresse: str,
    code_postal: Optional[str] = None,
    min_score: float = 0.8,
) -> Optional[dict]:
    """Retourne `{lat, lng, score, ban_id, label}` ou None si score < min_score."""
    if not adresse:
        return None
    params = {"q": adresse.strip()[:200], "limit": "1"}
    if code_postal:
        params["postcode"] = str(code_postal)
    try:
        r = await client.get(f"{BAN_BASE}/search/", params=params, timeout=10)
        if r.status_code != 200:
            return None
        j = r.json() or {}
        feats = j.get("features") or []
        if not feats:
            return None
        f = feats[0]
        props = f.get("properties") or {}
        score = float(props.get("score") or 0.0)
        if score < min_score:
            logger.info(f"ban.geocode: score {score} < {min_score} for '{adresse}'")
            return None
        coords = (f.get("geometry") or {}).get("coordinates") or [None, None]
        return {
            "lat": coords[1],
            "lng": coords[0],
            "score": score,
            "ban_id": props.get("id"),
            "label": props.get("label"),
            "street": props.get("street") or props.get("name"),
            "city": props.get("city"),
            "citycode": props.get("citycode"),
        }
    except Exception as e:
        logger.warning(f"ban.geocode failed for '{adresse}': {e}")
        return None


async def voies_by_postcode(
    client: httpx.AsyncClient, code_postal: str, db=None
) -> list[str]:
    """Retourne la liste NORMALISÉE des voies pour un CP.

    Utilise le cache Mongo `ban_voies_cache` si `db` fourni (rafraîchissement 1 an).

    NB. L'API `type=street` filtre les probes < 3 caractères et retourne 20
    résultats max par requête. On utilise donc un batch de probes (types de voies
    + trigrammes courants) en concurrent.
    """
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    cp = str(code_postal).strip()

    if db is not None:
        cached = await db.ban_voies_cache.find_one({"_id": cp})
        if cached:
            try:
                fetched_at = datetime.fromisoformat(cached["fetched_at"].replace("Z", "+00:00"))
                if (now - fetched_at) < timedelta(days=365):
                    return list(cached.get("voies") or [])
            except Exception:
                pass

    # Probes = types de voies (chacun renvoie 20 voies du CP) + trigrammes courants.
    # Une passe complète coûte ~300 requêtes réparties en concurrent (~20-30s).
    probes = [
        "rue", "avenue", "boulevard", "place", "passage", "impasse", "cite",
        "square", "villa", "allee", "sentier", "voie", "cour", "chemin",
        "cours", "esplanade", "port", "quai", "route", "faubourg", "parvis",
    ]
    # Trigrammes couvrant la plupart des débuts de mots français
    import string
    trigrammes = []
    for a in "abcdefghijklmnoprstuv":
        for b in "aeiouy":
            for c in "cdlmnprst":
                trigrammes.append(a + b + c)
    probes.extend(trigrammes[:280])

    seen: set[str] = set()
    sem = asyncio.Semaphore(15)  # 15 requêtes concurrentes max

    async def _probe(p: str) -> None:
        async with sem:
            try:
                r = await client.get(
                    f"{BAN_BASE}/search/",
                    params={"q": p, "postcode": cp, "type": "street", "limit": "20"},
                    timeout=8,
                )
                if r.status_code != 200:
                    return
                for f in ((r.json() or {}).get("features") or []):
                    p_ = f.get("properties") or {}
                    name = p_.get("name") or p_.get("street")
                    norm = normalize_voie(name)
                    if norm:
                        seen.add(norm)
            except Exception:
                pass

    await asyncio.gather(*[_probe(p) for p in probes])
    voies = sorted(seen)
    if db is not None:
        await db.ban_voies_cache.update_one(
            {"_id": cp},
            {"$set": {"voies": voies, "fetched_at": now.isoformat(), "count": len(voies)}},
            upsert=True,
        )
    logger.info(f"ban.voies_by_postcode[{cp}]: {len(voies)} voies (fresh fetch)")
    return voies
