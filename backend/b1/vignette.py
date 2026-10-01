"""KOLO — Mapbox Static Images vignette pour les cartes d'opportunités.

Endpoint `/api/opportunites/{opp_id}/vignette` :
  - Récupère lat/lng de l'opportunité en base.
  - Si `MAPBOX_ACCESS_TOKEN` est posé en env : interroge Mapbox Static Images,
    cache le résultat en base (collection `static_map_cache`, keyé par opp_id,
    index unique) et renvoie les bytes. Un seul appel externe à vie par opp.
  - Si token absent, lat/lng manquants, ou toute erreur Mapbox : renvoie 404
    pour que le frontend tombe sur le fallback aplat + icône + DPE.

Conforme Apple : aucun SDK Mapbox embarqué dans l'app, uniquement HTTPS côté
back → front. Token secret jamais exposé au client. Attribution Mapbox posée
côté UI (voir `b1-opp-vignette` qui ajoute un lien discret si image servie).

Bloc 7 étape 2.
"""
import asyncio
import logging
import os
from urllib.parse import quote

import httpx
from bson import Binary
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

logger = logging.getLogger(__name__)

router = APIRouter()

# Timeout court pour éviter de tenir une connexion sur une opp introuvable.
_HTTP_TIMEOUT_S = 12
# Taille d'image : 300×160 CSS, @2x pour Retina → 600×320 à la source.
_MAP_W = 300
_MAP_H = 160
# Zoom : 15 = quartier (voit la rue + 4-5 blocs autour).
_ZOOM = 15
# Marqueur rose de marque KOLO.
_MARKER_HEX = "ec8690"
# Fallback style public Mapbox tant que la version brandée KOLO n'est pas
# créée dans Mapbox Studio. Dès que `MAPBOX_STYLE_URL` est posé, on bascule.
_DEFAULT_STYLE_USER = "mapbox"
_DEFAULT_STYLE_ID = "light-v11"


def _parse_style_url(url: str):
    """`mapbox://styles/user/style-id`  →  (user, style-id)."""
    prefix = "mapbox://styles/"
    if not url or not url.startswith(prefix):
        return (_DEFAULT_STYLE_USER, _DEFAULT_STYLE_ID)
    parts = url.split("/")
    if len(parts) != 5:
        return (_DEFAULT_STYLE_USER, _DEFAULT_STYLE_ID)
    return (parts[3], parts[4])


def _build_mapbox_url(lon: float, lat: float) -> str:
    token = os.environ.get("MAPBOX_ACCESS_TOKEN", "")
    style_url = os.environ.get("MAPBOX_STYLE_URL", "")
    user, style_id = _parse_style_url(style_url)
    overlay = f"pin-s+{_MARKER_HEX}({lon:.6f},{lat:.6f})"
    return (
        f"https://api.mapbox.com/styles/v1/{quote(user)}/{quote(style_id)}/static/"
        f"{overlay}/{lon:.6f},{lat:.6f},{_ZOOM}/{_MAP_W}x{_MAP_H}@2x.png"
        f"?access_token={token}&attribution=true"
    )


def _db():
    from server import db  # type: ignore
    return db


async def _ensure_index(db):
    try:
        await db.static_map_cache.create_index("key", unique=True)
    except Exception:
        pass


@router.get("/api/opportunites/{opp_id}/vignette")
async def opportunite_vignette(opp_id: str, request: Request):
    db = _db()
    token = os.environ.get("MAPBOX_ACCESS_TOKEN")
    if not token:
        # Fallback silencieux : le frontend affichera l'aplat de couleur.
        raise HTTPException(status_code=404, detail="mapbox_not_configured")

    # Lookup lat/lng — l'opportunité peut être keyée par `id` (string ulid)
    # OU `_id` (ObjectId Mongo historique). On tente les 2.
    opp = await db.opportunites.find_one(
        {"id": opp_id},
        {"lat": 1, "lng": 1, "latitude": 1, "longitude": 1, "adresse": 1},
    )
    if not opp:
        try:
            from bson import ObjectId
            opp = await db.opportunites.find_one(
                {"_id": ObjectId(opp_id)},
                {"lat": 1, "lng": 1, "latitude": 1, "longitude": 1, "adresse": 1},
            )
        except Exception:
            opp = None
    if not opp:
        opp = await db.opportunites.find_one(
            {"_id": opp_id},
            {"lat": 1, "lng": 1, "latitude": 1, "longitude": 1, "adresse": 1},
        )
    if not opp:
        raise HTTPException(status_code=404, detail="opp_not_found")
    lat = opp.get("lat") or opp.get("latitude")
    lng = opp.get("lng") or opp.get("longitude")
    if lat is None or lng is None:
        raise HTTPException(status_code=404, detail="coords_missing")

    await _ensure_index(db)

    key = f"opp:{opp_id}"
    existing = await db.static_map_cache.find_one({"key": key})
    if existing and existing.get("status") == "ready":
        return Response(bytes(existing["data"]), media_type=existing.get("content_type", "image/png"))
    if existing and existing.get("status") == "error":
        raise HTTPException(status_code=404, detail="mapbox_previous_error")

    if existing and existing.get("status") == "fetching":
        # Un autre worker a réservé la clé : on poll quelques fois puis timeout.
        for _ in range(40):
            await asyncio.sleep(0.2)
            existing = await db.static_map_cache.find_one({"key": key})
            if existing and existing.get("status") == "ready":
                return Response(bytes(existing["data"]), media_type=existing.get("content_type", "image/png"))
            if existing and existing.get("status") == "error":
                raise HTTPException(status_code=404, detail="mapbox_previous_error")
        raise HTTPException(status_code=503, detail="vignette_in_progress")

    # Réservation atomique via l'index unique.
    try:
        await db.static_map_cache.insert_one({
            "key": key, "status": "fetching", "lat": float(lat), "lng": float(lng),
        })
    except Exception as e:
        if "duplicate" in str(e).lower() or "e11000" in str(e).lower():
            # Un autre worker vient de passer, on relance la logique.
            return await opportunite_vignette(opp_id, request)
        raise HTTPException(status_code=500, detail="cache_insert_failed")

    url = _build_mapbox_url(float(lng), float(lat))
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
            r = await client.get(url)
        if r.status_code != 200:
            logger.warning("Mapbox non-200 for opp=%s status=%s", opp_id, r.status_code)
            await db.static_map_cache.update_one({"key": key}, {"$set": {"status": "error"}})
            raise HTTPException(status_code=404, detail="mapbox_fetch_failed")
        ctype = r.headers.get("content-type", "image/png")
        if not ctype.startswith("image/"):
            await db.static_map_cache.update_one({"key": key}, {"$set": {"status": "error"}})
            raise HTTPException(status_code=404, detail="mapbox_non_image")
        await db.static_map_cache.update_one(
            {"key": key},
            {"$set": {"status": "ready", "data": Binary(r.content), "content_type": ctype}},
        )
        return Response(r.content, media_type=ctype)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Mapbox fetch exception for opp=%s: %s", opp_id, e)
        await db.static_map_cache.update_one({"key": key}, {"$set": {"status": "error"}})
        raise HTTPException(status_code=404, detail="mapbox_exception")
