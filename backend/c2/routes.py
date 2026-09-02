"""C2 — Routes /api/dossiers (Avis de valeur).

Endpoints :
  - POST   /api/dossiers                — crée un dossier depuis `estimation_id`
  - GET    /api/dossiers                — liste des dossiers du user
  - GET    /api/dossiers/{dossier_id}   — détail complet
  - PATCH  /api/dossiers/{dossier_id}   — mise à jour partielle (sections/niveau/statut)

Toutes préfixées `/api`. Auth requise (via `get_user_from_session`).
"""
from __future__ import annotations

import logging
import secrets
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse

from a2.config import get_config
from a2.tz import now_utc_iso

from .pdf.jobs import cancel_job, enqueue as enqueue_pdf, latest_done_job
from .prefill import build_prefill
from .schemas import (
    SECTION_IDS,
    DossierCreate,
    DossierPatch,
    DossierSections,
)

logger = logging.getLogger("c2.routes")

router = APIRouter(tags=["c2"])


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


def _new_dossier_id() -> str:
    return f"dos_{secrets.token_urlsafe(9)}"


def _empty_sections() -> dict[str, dict[str, Any]]:
    return {sid: {} for sid in SECTION_IDS}


def _merge_sections(
    base: dict[str, dict[str, Any]], patch: dict[str, dict[str, Any]]
) -> dict[str, dict[str, Any]]:
    """Remplace chaque section fournie dans le patch (pas de deep merge).

    Ignore silencieusement les section_id inconnus — c'est le rôle du front
    d'envoyer des ids valides ; le backend ne casse pas si un id obsolète
    remonte pendant une migration d'UI.
    """
    merged = dict(base)
    for section_id, content in patch.items():
        if section_id not in SECTION_IDS:
            continue
        if not isinstance(content, dict):
            continue
        merged[section_id] = content
    return merged


def _project_summary() -> dict[str, int]:
    """Projection Mongo pour la liste : garde uniquement les champs affichés."""
    return {
        "_id": 0,
        "dossier_id": 1,
        "estimation_id": 1,
        "niveau": 1,
        "statut": 1,
        "date_creation": 1,
        "date_maj": 1,
        "sections.dossier.ref": 1,
        "sections.identification.adresse": 1,
        "sections.identification.code_postal": 1,
        "sections.identification.commune": 1,
        "sections.identification.type_bien": 1,
        "sections.mission.demandeur_nom": 1,
        "sections.mission.objet": 1,
        "sections.conclusion.valeur_venale": 1,
        "sections.conclusion.prix_presentation": 1,
    }


# ---------------------------------------------------------------------------
# POST /api/dossiers — création + pré-remplissage depuis une estimation
# ---------------------------------------------------------------------------
@router.post("/api/dossiers")
async def create_dossier(payload: DossierCreate, request: Request):
    user = await _current_user_doc(request)
    db = _db()

    estim = await db.estimations.find_one(
        {"estimation_id": payload.estimation_id, "user_id": user["user_id"]}
    )
    if not estim:
        raise HTTPException(status_code=404, detail="estimation_introuvable")

    cfg = await get_config(db)

    prefill = build_prefill(
        estim=estim,
        user=user,
        config=cfg,
        creation_payload=payload.model_dump(exclude={"estimation_id", "niveau"}),
    )
    # Valide via Pydantic (rejette une clé de section inconnue par extra="forbid")
    sections = DossierSections(**prefill).model_dump()

    dossier_id = _new_dossier_id()
    now = now_utc_iso()
    doc = {
        "dossier_id": dossier_id,
        "user_id": user["user_id"],
        "estimation_id": payload.estimation_id,
        "niveau": payload.niveau,
        "statut": "brouillon",
        "sections": sections,
        "date_creation": now,
        "date_maj": now,
    }
    await db.dossiers.insert_one(doc)

    # Event tracking non bloquant (aligné sur C1)
    try:
        await db.events.insert_one({
            "nom": "dossier_cree",
            "user_id": user["user_id"],
            "dossier_id": dossier_id,
            "estimation_id": payload.estimation_id,
            "niveau": payload.niveau,
            "date": now,
        })
    except Exception:
        pass

    doc.pop("_id", None)
    return {"ok": True, "dossier": doc}


# ---------------------------------------------------------------------------
# GET /api/dossiers — liste
# ---------------------------------------------------------------------------
@router.get("/api/dossiers")
async def list_dossiers(request: Request, response: Response):
    user = await _current_user_doc(request)
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    cur = _db().dossiers.find(
        {"user_id": user["user_id"]},
        _project_summary(),
    ).sort("date_creation", -1).limit(200)
    items = await cur.to_list(length=200)
    return {"ok": True, "dossiers": items}


# ---------------------------------------------------------------------------
# GET /api/dossiers/{id} — détail
# ---------------------------------------------------------------------------
@router.get("/api/dossiers/{dossier_id}")
async def get_dossier(dossier_id: str, request: Request, response: Response):
    user = await _current_user_doc(request)
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    doc = await _db().dossiers.find_one(
        {"dossier_id": dossier_id, "user_id": user["user_id"]},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="dossier_introuvable")
    return {"ok": True, "dossier": doc, "completude": _completude(doc)}


# ---------------------------------------------------------------------------
# Complétude — 5 blocages niveau 1 avant export
# ---------------------------------------------------------------------------
REDACTEUR_CHAMPS_BLOQUANTS_PROPRE: tuple[str, ...] = (
    "agent_nom", "agent_email", "agent_tel",
    "agence_nom", "agence_siren", "carte_pro",
    "carte_pro_cci", "rcp_assureur", "rcp_police",
)
REDACTEUR_CHAMPS_BLOQUANTS_MANDATAIRE: tuple[str, ...] = (
    "agent_nom", "agent_email", "agent_tel",
    "agence_nom", "agence_siren",
    "reseau_nom", "reseau_carte_t", "reseau_cci", "attestation_num",
    "rcp_assureur", "rcp_police",
)


def _completude(dossier_doc: dict[str, Any]) -> dict[str, Any]:
    """5 blocages niveau 1 :
      1. demandeur_nom (mission)
      2. adresse (identification)
      3. surface_habitable (surfaces)
      4. photo_couverture (dossier)
      5. redacteur complet (9 champs bloquants en carte propre,
         11 en mandataire)
    """
    s = dossier_doc.get("sections") or {}
    mission = s.get("mission") or {}
    identification = s.get("identification") or {}
    surfaces = s.get("surfaces") or {}
    dossier = s.get("dossier") or {}
    redacteur = s.get("redacteur") or {}

    demandeur_ok = bool((mission.get("demandeur_nom") or "").strip())
    adresse_ok = bool((identification.get("adresse") or "").strip())
    surface_ok = bool(surfaces.get("surface_habitable"))
    photo_ok = bool(dossier.get("photo_couverture"))

    statut_carte = (redacteur.get("statut_carte") or "propre").lower()
    bloquants = (
        REDACTEUR_CHAMPS_BLOQUANTS_MANDATAIRE
        if statut_carte == "mandataire"
        else REDACTEUR_CHAMPS_BLOQUANTS_PROPRE
    )
    manquants = [
        k for k in bloquants
        if not (str(redacteur.get(k) or "").strip())
    ]
    redacteur_ok = len(manquants) == 0

    return {
        "blocages": {
            "demandeur": demandeur_ok,
            "adresse": adresse_ok,
            "surface": surface_ok,
            "photo": photo_ok,
            "redacteur": redacteur_ok,
        },
        "redacteur_manquants": manquants,
        "statut_carte": statut_carte,
        "pret_export": all([demandeur_ok, adresse_ok, surface_ok, photo_ok, redacteur_ok]),
    }


# ---------------------------------------------------------------------------
# PATCH /api/dossiers/{id} — mise à jour partielle
# ---------------------------------------------------------------------------
@router.patch("/api/dossiers/{dossier_id}")
async def patch_dossier(dossier_id: str, payload: DossierPatch, request: Request):
    user = await _current_user_doc(request)
    db = _db()

    current = await db.dossiers.find_one(
        {"dossier_id": dossier_id, "user_id": user["user_id"]},
        {"_id": 0},
    )
    if not current:
        raise HTTPException(status_code=404, detail="dossier_introuvable")

    updates: dict[str, Any] = {"date_maj": now_utc_iso()}

    if payload.niveau is not None:
        updates["niveau"] = payload.niveau
    if payload.statut is not None:
        updates["statut"] = payload.statut

    if payload.sections is not None:
        base = _empty_sections()
        base.update(current.get("sections") or {})
        merged = _merge_sections(base, payload.sections)
        # Re-validation (extra="forbid" refuse toute section inconnue résiduelle)
        DossierSections(**merged)
        updates["sections"] = merged

    if len(updates) == 1:  # rien à faire sauf date_maj — pas d'écriture
        raise HTTPException(status_code=400, detail="patch_vide")

    await db.dossiers.update_one(
        {"dossier_id": dossier_id, "user_id": user["user_id"]},
        {"$set": updates},
    )
    doc = await db.dossiers.find_one(
        {"dossier_id": dossier_id, "user_id": user["user_id"]},
        {"_id": 0},
    )
    # Bascule automatique brouillon -> complet quand les 5 blocages passent.
    # On ne redégrade jamais un statut manuel (envoye/archive/complet forcé).
    completude = _completude(doc)
    if doc.get("statut") == "brouillon" and completude["pret_export"]:
        await db.dossiers.update_one(
            {"dossier_id": dossier_id, "user_id": user["user_id"]},
            {"$set": {"statut": "complet", "date_maj": now_utc_iso()}},
        )
        doc["statut"] = "complet"
    return {"ok": True, "dossier": doc, "completude": completude}



# ---------------------------------------------------------------------------
# POST /api/dossiers/{id}/generer-pdf — génération asynchrone
# ---------------------------------------------------------------------------
@router.post("/api/dossiers/{dossier_id}/generer-pdf")
async def start_pdf_job(dossier_id: str, request: Request):
    user = await _current_user_doc(request)
    db = _db()
    doc = await db.dossiers.find_one(
        {"dossier_id": dossier_id, "user_id": user["user_id"]},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="dossier_introuvable")

    job_id = await enqueue_pdf(db, doc)
    return {"ok": True, "job_id": job_id, "status": "pending"}


# ---------------------------------------------------------------------------
# GET /api/dossiers/{id}/generer-pdf/{job_id} — statut d'un job
# ---------------------------------------------------------------------------
@router.get("/api/dossiers/{dossier_id}/generer-pdf/{job_id}")
async def pdf_job_status(dossier_id: str, job_id: str, request: Request):
    user = await _current_user_doc(request)
    db = _db()
    job = await db.dossier_pdf_jobs.find_one(
        {"job_id": job_id, "dossier_id": dossier_id, "user_id": user["user_id"]},
        {"_id": 0, "file_path": 0},
    )
    if not job:
        raise HTTPException(status_code=404, detail="job_introuvable")
    return {"ok": True, "job": job}


# ---------------------------------------------------------------------------
# DELETE /api/dossiers/{id}/generer-pdf/{job_id} — annule un job
# ---------------------------------------------------------------------------
@router.delete("/api/dossiers/{dossier_id}/generer-pdf/{job_id}")
async def cancel_pdf_job(dossier_id: str, job_id: str, request: Request):
    user = await _current_user_doc(request)
    db = _db()
    # Vérif ownership + existence du dossier
    dos = await db.dossiers.find_one(
        {"dossier_id": dossier_id, "user_id": user["user_id"]},
        {"_id": 0, "dossier_id": 1},
    )
    if not dos:
        raise HTTPException(status_code=404, detail="dossier_introuvable")
    ok = await cancel_job(db, job_id, user["user_id"])
    if not ok:
        # Soit le job n'existe pas, soit il est déjà `done`/`error`/`cancelled`
        raise HTTPException(status_code=409, detail="job_non_annulable")
    return {"ok": True, "job_id": job_id, "status": "cancelled"}


# ---------------------------------------------------------------------------
# GET /api/dossiers/{id}/pdf — récupère le dernier PDF généré
# ---------------------------------------------------------------------------
@router.get("/api/dossiers/{dossier_id}/pdf")
async def download_pdf(dossier_id: str, request: Request):
    user = await _current_user_doc(request)
    db = _db()
    # Vérif que le dossier appartient bien au user (auth + owning)
    dos = await db.dossiers.find_one(
        {"dossier_id": dossier_id, "user_id": user["user_id"]},
        {"_id": 0, "dossier_id": 1},
    )
    if not dos:
        raise HTTPException(status_code=404, detail="dossier_introuvable")

    job = await latest_done_job(db, dossier_id, user["user_id"])
    if not job:
        raise HTTPException(status_code=404, detail="pdf_pas_encore_genere")
    file_path = Path(job.get("file_path") or "")
    if not file_path.exists():
        raise HTTPException(status_code=410, detail="pdf_expire")
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=job.get("filename") or "avis-de-valeur.pdf",
    )
