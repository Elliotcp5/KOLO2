"""KOLO — BLOC C1 routes : POST/GET /api/estimations + géocodage BAN.

Toutes préfixées `/api`. Auth requise (via `get_user_from_session`).
Quotas via `a2.quotas.verifier_quota` (jamais dupliqué).
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from a2.config import get_config
from a2.quotas import verifier_quota
from a2.tz import now_utc_iso

from .engine import (
    is_dvf_exclu,
    run_estimation,
    _TYPE_BATIMENT_TO_LOCAL,
)
from .schemas import EstimationInput

logger = logging.getLogger("c1.routes")

router = APIRouter(tags=["c1"])


def _db():
    from server import db  # type: ignore
    return db


async def _current_user_doc(request: Request) -> dict[str, Any]:
    from server import get_user_from_session  # type: ignore
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    doc = await _db().users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")
    return doc


# ---------------------------------------------------------------------------
# Géocodage BAN — utilisé pour l'estimation depuis une adresse libre
# ---------------------------------------------------------------------------
BAN_URL = "https://api-adresse.data.gouv.fr/search/"
BAN_MIN_SCORE = 0.8


async def _geocode_ban(adresse: str, code_postal: Optional[str] = None) -> Optional[dict]:
    """Retourne {lat, lng, adresse_normalisee, code_postal, ville, score} ou None."""
    q = adresse.strip()
    params = {"q": q, "limit": "1", "autocomplete": "0"}
    if code_postal:
        params["postcode"] = code_postal
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(BAN_URL, params=params)
            r.raise_for_status()
            data = r.json() or {}
    except Exception as e:
        logger.warning(f"BAN geocode failed: {e}")
        return None
    features = data.get("features") or []
    if not features:
        return None
    f = features[0]
    props = f.get("properties") or {}
    score = float(props.get("score") or 0)
    if score < BAN_MIN_SCORE:
        return None
    geom = f.get("geometry") or {}
    coords = geom.get("coordinates") or []
    if len(coords) < 2:
        return None
    return {
        "lat": float(coords[1]),
        "lng": float(coords[0]),
        "adresse_normalisee": props.get("label"),
        "code_postal": props.get("postcode"),
        "ville": props.get("city"),
        "score": score,
    }


class GeocodePayload(BaseModel):
    adresse: str
    code_postal: Optional[str] = None


@router.post("/api/estimations/geocoder")
async def geocoder_adresse(payload: GeocodePayload, request: Request):
    """Géocodage BAN utilisé par la page « Estimer depuis une adresse »."""
    await _current_user_doc(request)  # auth requise
    if not payload.adresse or len(payload.adresse.strip()) < 3:
        raise HTTPException(status_code=400, detail="adresse_trop_courte")
    result = await _geocode_ban(payload.adresse, payload.code_postal)
    if not result:
        return {"ok": False, "code": "adresse_introuvable"}
    # Blocage DVF exclu
    if is_dvf_exclu(result.get("code_postal") or ""):
        return {
            "ok": False,
            "code": "dvf_exclu",
            "resultat": result,
        }
    return {"ok": True, "resultat": result}


# ---------------------------------------------------------------------------
# POST /api/estimations — lance le moteur
# ---------------------------------------------------------------------------
@router.post("/api/estimations")
async def create_estimation(payload: EstimationInput, request: Request):
    """Exécute le moteur déterministe et persiste le résultat."""
    user = await _current_user_doc(request)
    db = _db()

    # Quota
    ok, ctx = await verifier_quota(db, user, "estimation")  # type: ignore[arg-type]
    if not ok:
        raise HTTPException(status_code=402, detail={
            "code": "quota_estimation_epuise", "quota": ctx,
        })

    # Rehydratation depuis l'opportunité si fournie
    opp_doc: Optional[dict] = None
    if payload.opportunite_id:
        try:
            from bson import ObjectId  # type: ignore
            opp_doc = await db.opportunites.find_one({"_id": ObjectId(payload.opportunite_id)})
        except Exception:
            opp_doc = None
        if not opp_doc:
            # Autoriser le fallback via champ `dpe_id` (démo)
            opp_doc = await db.opportunites.find_one({"dpe_id": payload.opportunite_id})
        if not opp_doc:
            raise HTTPException(status_code=404, detail="opportunite_introuvable")

    # Extraction des données bien
    caracs = (opp_doc or {}).get("caracteristiques") or {}
    lat = payload.lat if payload.lat is not None else (opp_doc or {}).get("lat")
    lng = payload.lng if payload.lng is not None else (opp_doc or {}).get("lng")
    if lat is None:
        lat = caracs.get("latitude")
    if lng is None:
        lng = caracs.get("longitude")

    adresse = payload.adresse or (opp_doc or {}).get("adresse") or caracs.get("adresse")
    code_postal = payload.code_postal or (opp_doc or {}).get("code_postal") or caracs.get("code_postal")

    # Blocage DVF exclu
    if code_postal and is_dvf_exclu(code_postal):
        raise HTTPException(status_code=422, detail={
            "code": "dvf_exclu",
            "message": "DVF ne couvre pas ce territoire (livre foncier).",
        })

    # Type + surface + classe DPE (opportunité > payload en priorité)
    type_bien = payload.type_bien
    if not type_bien:
        tb = (caracs.get("type_batiment") or "").lower()
        type_local = _TYPE_BATIMENT_TO_LOCAL.get(tb)
        type_bien = type_local
    if type_bien not in ("Appartement", "Maison"):
        raise HTTPException(status_code=422, detail={"code": "type_bien_requis"})

    surface = payload.surface_habitable or caracs.get("surface_habitable")
    if not surface or float(surface) < 5:
        raise HTTPException(status_code=422, detail={"code": "surface_requise"})
    surface = float(surface)

    classe_dpe = payload.classe_dpe or caracs.get("classe_dpe")
    annee_construction = payload.annee_construction or caracs.get("annee_construction")

    if lat is None or lng is None:
        # géocodage en dernier recours
        if not adresse:
            raise HTTPException(status_code=422, detail={"code": "geoloc_manquante"})
        geo = await _geocode_ban(adresse, code_postal)
        if not geo:
            raise HTTPException(status_code=422, detail={"code": "adresse_introuvable"})
        lat, lng = geo["lat"], geo["lng"]

    # Fusion des inputs pour l'engine
    inputs = {
        "type_bien": type_bien,
        "code_postal": code_postal,
        "classe_dpe": classe_dpe,
        "etat": payload.etat,
        "etage": payload.etage,
        "ascenseur": payload.ascenseur,
        "exterieur": payload.exterieur,
        "exterieur_surface_m2": payload.exterieur_surface_m2,
        "stationnement": payload.stationnement,
        "montant_travaux_eur": payload.montant_travaux_eur,
        "vue_degagee": payload.vue_degagee,
        "vis_a_vis": payload.vis_a_vis,
        "net_vendeur": payload.net_vendeur,
    }

    cfg = await get_config(db)
    infos_pro = user.get("infos_pro") or {}

    result = await run_estimation(
        inputs=inputs,
        infos_pro=infos_pro,
        config_matching=cfg,
        lat=float(lat),
        lng=float(lng),
        type_local=type_bien,
        surface=surface,
        postal_code=code_postal or "",
    )

    # Persistance — comparables figés, aucune référence aux collections vivantes
    doc = {
        "estimation_id": result["estimation_id"],
        "user_id": user["user_id"],
        "opportunite_id": payload.opportunite_id,
        "adresse": adresse,
        "code_postal": code_postal,
        "ville": (opp_doc or {}).get("ville") or caracs.get("commune"),
        "lat": float(lat), "lng": float(lng),
        "type_bien": type_bien,
        "surface_habitable": surface,
        "classe_dpe": classe_dpe,
        "annee_construction": annee_construction,
        "inputs": inputs,
        "resultat": {k: v for k, v in result.items() if k != "comparables_figes"},
        "comparables_figes": result.get("comparables_figes") or [],
        "cfg_snapshot": {
            "marge_negociation": cfg.get("marge_negociation"),
            "decote_energie": cfg.get("decote_energie"),
        },
        "date_creation": now_utc_iso(),
        "date_dernier_statut": now_utc_iso(),
        "statut": "active",
    }
    await db.estimations.insert_one(doc)

    # Event tracking (utilise la nomenclature B3)
    try:
        await db.events.insert_one({
            "nom": "estimation_lancee",
            "user_id": user["user_id"],
            "estimation_id": result["estimation_id"],
            "opportunite_id": payload.opportunite_id,
            "date": now_utc_iso(),
        })
    except Exception:
        pass

    # Renvoie sans comparables_figes (payload frontend allégé)
    payload_out = {k: v for k, v in result.items() if k != "comparables_figes"}
    payload_out["estimation_id"] = result["estimation_id"]
    return payload_out


# ---------------------------------------------------------------------------
# GET /api/estimations — page « Mes estimations »
# ---------------------------------------------------------------------------
@router.get("/api/estimations")
async def list_estimations(request: Request, response: Response):
    user = await _current_user_doc(request)
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    cur = _db().estimations.find(
        {"user_id": user["user_id"], "statut": "active"},
        {
            "_id": 0, "estimation_id": 1, "adresse": 1, "code_postal": 1, "ville": 1,
            "type_bien": 1, "surface_habitable": 1, "classe_dpe": 1,
            "date_creation": 1,
            "resultat.prix_commercialisation": 1,
            "resultat.fourchette_basse": 1,
            "resultat.fourchette_haute": 1,
            "resultat.fiabilite": 1,
        },
    ).sort("date_creation", -1).limit(200)
    items = await cur.to_list(length=200)
    return {"ok": True, "estimations": items}


@router.get("/api/estimations/{estimation_id}")
async def get_estimation(estimation_id: str, request: Request, response: Response):
    user = await _current_user_doc(request)
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    doc = await _db().estimations.find_one(
        {"estimation_id": estimation_id, "user_id": user["user_id"]},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="estimation_introuvable")
    return {"ok": True, "estimation": doc}
