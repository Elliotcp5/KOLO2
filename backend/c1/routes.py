"""KOLO — BLOC C1 routes : POST/GET /api/estimations + géocodage BAN + DPE ADEME.

Toutes préfixées `/api`. Auth requise (via `get_user_from_session`).
Quotas via `a2.quotas.verifier_quota` (jamais dupliqué).
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from a2.config import get_config
from a2.quotas import verifier_quota
from a2.tz import now_utc_iso
from a3.sources.ademe import get_schema, _canonical_from_row

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
    """Retourne {lat, lng, adresse_normalisee, code_postal, ville, score, ban_id} ou None."""
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
        "ban_id": props.get("id"),
    }


async def _fetch_dpe_at_address(
    client: httpx.AsyncClient,
    ban_id: Optional[str],
    code_postal: Optional[str],
    adresse: Optional[str],
) -> Optional[dict]:
    """Cherche le DPE ADEME le plus récent pour cette adresse.

    Stratégie :
      1. Si `ban_id` connu (BAN a matché avec score ≥ 0,8), requête ADEME avec
         `identifiant_ban:"<ban_id>"` — 100 % fiable.
      2. Sinon, cherche par CP + rue en full-text ADEME (fallback).

    Retourne le DPE canonique le plus récent, ou None si rien trouvé.
    Timeout court (5 s) — pas question de bloquer l'estimation si ADEME est lent.
    """
    schema = await get_schema(client)
    if not schema.is_ready():
        return None

    lines_url = schema.lines_url()
    select_fields = [schema.field(c) for c in schema.to_dict().keys() if schema.field(c)]
    date_field = schema.field("date_etablissement")

    # 1) Requête par BAN id
    if ban_id and schema.has("ban_id"):
        ban_field = schema.field("ban_id")
        params = {
            "size": "3",
            "select": ",".join(select_fields),
            "qs": f'{ban_field}:"{ban_id}"',
            "sort": f"-{date_field}" if date_field else None,
        }
        params = {k: v for k, v in params.items() if v is not None}
        try:
            r = await client.get(lines_url, params=params, timeout=5)
            if r.status_code == 200:
                rows = (r.json() or {}).get("results") or []
                if rows:
                    return _canonical_from_row(rows[0], schema)
        except Exception as e:
            logger.info(f"ADEME lookup by ban_id failed: {e}")

    # 2) Fallback CP + adresse
    if code_postal and adresse and schema.has("code_postal") and schema.has("adresse"):
        cp_field = schema.field("code_postal")
        adr_field = schema.field("adresse")
        # ADEME full-text : on tolère la casse, on garde les 3 premiers tokens de l'adresse
        adr_hint = " ".join(adresse.replace(",", " ").split()[:3])
        params = {
            "size": "3",
            "select": ",".join(select_fields),
            "qs": f'{cp_field}:"{code_postal}" AND {adr_field}:({adr_hint})',
            "sort": f"-{date_field}" if date_field else None,
        }
        params = {k: v for k, v in params.items() if v is not None}
        try:
            r = await client.get(lines_url, params=params, timeout=5)
            if r.status_code == 200:
                rows = (r.json() or {}).get("results") or []
                if rows:
                    return _canonical_from_row(rows[0], schema)
        except Exception as e:
            logger.info(f"ADEME lookup by CP+adresse failed: {e}")

    return None


def _dpe_to_prefill(dpe: dict) -> dict:
    """Extrait les champs utiles au pré-remplissage depuis un DPE ADEME canonique.

    Ajoute `etage_dpe` (int) extrait de `complement_adresse` via le parseur A3 —
    le front `prefillFromBien` s'en sert pour skipper la question « étage ».
    """
    from a3.job_generer_opportunites import _etage_dpe_from_complement  # type: ignore
    type_bat = (dpe.get("type_batiment") or "").lower()
    type_bien = "Maison" if type_bat == "maison" else ("Appartement" if type_bat in ("appartement", "immeuble") else None)
    etage = _etage_dpe_from_complement(dpe.get("complement_adresse"))
    caracs = {k: v for k, v in dpe.items() if k != "_raw"}
    if etage is not None:
        caracs["etage_dpe"] = etage
    return {
        "type_bien": type_bien,
        "surface_habitable": dpe.get("surface_habitable"),
        "annee_construction": dpe.get("annee_construction"),
        "classe_dpe": dpe.get("classe_dpe"),
        "classe_ges": dpe.get("classe_ges"),
        "nb_niveaux": dpe.get("nb_niveaux"),
        "hauteur_sous_plafond": dpe.get("hauteur_sous_plafond"),
        "numero_dpe": dpe.get("numero_dpe"),
        "date_etablissement": dpe.get("date_etablissement"),
        "etage_dpe": etage,
        # Passe le DPE entier dans `caracteristiques` — c'est ce qui alimente
        # `prefillFromBien` côté front pour skipper les questions étage/etc.
        "caracteristiques": caracs,
    }


class GeocodePayload(BaseModel):
    adresse: str
    code_postal: Optional[str] = None


@router.post("/api/estimations/geocoder")
async def geocoder_adresse(payload: GeocodePayload, request: Request):
    """Géocodage BAN + lookup DPE ADEME (best-effort) pour pré-remplir le bien.

    Retourne :
      { ok: true, resultat: {...BAN...}, dpe: {...si trouvé...}, dpe_manquant?: true }
    Le front décide ensuite : DPE trouvé ⇒ file d'estimation sans demander type/surface ;
    DPE absent ⇒ demande type + surface (message explicite).
    """
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
    # Lookup DPE ADEME — best-effort, ne bloque JAMAIS le géocodage
    dpe_prefill: Optional[dict] = None
    try:
        async with httpx.AsyncClient() as client:
            dpe = await _fetch_dpe_at_address(
                client,
                ban_id=result.get("ban_id"),
                code_postal=result.get("code_postal"),
                adresse=result.get("adresse_normalisee") or payload.adresse,
            )
        if dpe:
            dpe_prefill = _dpe_to_prefill(dpe)
    except Exception as e:
        logger.info(f"ADEME lookup skipped (non-fatal): {e}")

    return {
        "ok": True,
        "resultat": result,
        "dpe": dpe_prefill,
        "dpe_manquant": dpe_prefill is None,
    }


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
