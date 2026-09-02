"""KOLO — Routes D1 (BLOC D · Partie 1).

Endpoints strictement compatibles Apple :
  - AUCUN endpoint ne crée d'organisation depuis l'app iOS.
  - AUCUN endpoint n'expose de montant, de fournisseur de paiement, ni d'URL
    de paiement web.

Endpoints :
  - GET    /api/d1/organisations/me                — infos de mon agence (directeur)
  - PATCH  /api/d1/organisations/me                — patch limité
  - POST   /api/d1/invitations                     — inviter un conseiller (email)
  - GET    /api/d1/invitations                     — liste
  - POST   /api/d1/invitations/{id}/relancer       — renvoi email
  - DELETE /api/d1/invitations/{id}                — annuler
  - GET    /api/d1/equipe                          — tableau + métriques + alerte 48h
  - DELETE /api/d1/equipe/{user_id}                — retirer un conseiller
  - POST   /api/d1/opportunites/{id}/attribuer     — { user_id }
  - POST   /api/d1/opportunites/attribuer-lot      — { opportunite_ids, user_id }
  - POST   /api/d1/opportunites/auto-reste         — répartit auto le reste (proposees)
  - POST   /api/d1/opportunites/{id}/retirer       — refus si statut >= a_demarcher
  - GET    /api/d1/invitations/check?email=...     — public (est-ce que cet email est invité ?)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request

from a2.tz import now_utc_iso

from .distribution import distribuer_equilibre
from .invitations import (
    INVITATION_TTL_DAYS,
    check_email_invited,
    make_expiration_iso,
    send_invitation_email,
)
from .schemas import (
    AttribuerLotPayload,
    AttribuerPayload,
    InvitationCreate,
    OrganisationPatch,
)

router = APIRouter(tags=["d1"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _db():
    from server import db  # type: ignore
    return db


async def _current_user(request: Request) -> dict[str, Any]:
    from server import get_user_from_session  # type: ignore
    u = await get_user_from_session(request)
    if not u:
        raise HTTPException(status_code=401, detail="Not authenticated")
    doc = await _db().users.find_one({"user_id": u.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")
    return doc


async def _require_directeur(request: Request) -> dict[str, Any]:
    user = await _current_user(request)
    if user.get("role") != "directeur" or not user.get("organisation_id"):
        raise HTTPException(status_code=403, detail="Directeur d'agence requis")
    return user


def _oid(x: Any) -> ObjectId:
    if isinstance(x, ObjectId):
        return x
    try:
        return ObjectId(str(x))
    except Exception:
        raise HTTPException(status_code=400, detail="id_invalide")


# Statuts "actifs" côté conseiller : ne plus autoriser le retrait d'attribution
STATUTS_TRAITEMENT_ACTIF = {"a_demarcher", "demarchee", "mandat_signe", "abandon"}


# ===========================================================================
# ORGANISATIONS  —  lecture + patch (aucune création via iOS)
# ===========================================================================
def _serialize_orga(orga: dict) -> dict:
    """Aucun montant, aucune référence fournisseur, aucune URL paiement."""
    prochaine = orga.get("prochaine_facturation")
    return {
        "id": str(orga.get("_id")),
        "nom": orga.get("nom") or "",
        "adresse": orga.get("adresse") or "",
        "telephone": orga.get("telephone") or "",
        "zones": orga.get("zones") or [],
        "sieges_total": int(orga.get("sieges_total") or 0),
        "sieges_utilises": int(orga.get("sieges_utilises") or 0),
        "mode_repartition": orga.get("mode_repartition") or "manuel",
        "directeur_prospecte": bool(orga.get("directeur_prospecte")),
        "prochaine_facturation": prochaine,  # ISO string ou None ; jamais de montant
    }


@router.get("/api/d1/organisations/me")
async def get_my_organisation(request: Request):
    user = await _require_directeur(request)
    orga = await _db().organisations.find_one({"_id": user["organisation_id"]})
    if not orga:
        raise HTTPException(status_code=404, detail="Organisation introuvable")
    return {"organisation": _serialize_orga(orga)}


@router.patch("/api/d1/organisations/me")
async def patch_my_organisation(payload: OrganisationPatch, request: Request):
    user = await _require_directeur(request)
    update: dict[str, Any] = {}
    for k in ("nom", "adresse", "telephone", "mode_repartition"):
        v = getattr(payload, k)
        if v is not None:
            update[k] = v
    if payload.zones is not None:
        update["zones"] = payload.zones
    if payload.directeur_prospecte is not None:
        update["directeur_prospecte"] = bool(payload.directeur_prospecte)
    if not update:
        raise HTTPException(status_code=400, detail="Aucune modification")
    update["updated_at"] = now_utc_iso()
    await _db().organisations.update_one({"_id": user["organisation_id"]}, {"$set": update})
    orga = await _db().organisations.find_one({"_id": user["organisation_id"]})
    return {"organisation": _serialize_orga(orga)}


# ===========================================================================
# INVITATIONS
# ===========================================================================
def _serialize_invit(i: dict) -> dict:
    return {
        "id": str(i.get("_id")),
        "email": i.get("email") or "",
        "statut": i.get("statut") or "envoyee",
        "date_envoi": i.get("date_envoi"),
        "date_expiration": i.get("date_expiration"),
    }


@router.post("/api/d1/invitations")
async def creer_invitation(payload: InvitationCreate, request: Request):
    user = await _require_directeur(request)
    orga = await _db().organisations.find_one({"_id": user["organisation_id"]})
    if not orga:
        raise HTTPException(status_code=404, detail="Organisation introuvable")

    email = payload.email  # normalisé lower par le schéma

    # Doublon : compte existant déjà dans cette agence ?
    already = await _db().users.find_one(
        {"email": email, "organisation_id": user["organisation_id"], "siege_statut": "actif"}
    )
    if already:
        raise HTTPException(status_code=409, detail="deja_membre")

    # Invitation déjà envoyée non expirée ?
    existing = await _db().invitations.find_one({
        "email": email,
        "organisation_id": user["organisation_id"],
        "statut": "envoyee",
    })
    if existing:
        raise HTTPException(status_code=409, detail="deja_invite")

    # Plafond sièges — pending invit + membres actifs
    pending = await _db().invitations.count_documents({
        "organisation_id": user["organisation_id"], "statut": "envoyee",
    })
    used = int(orga.get("sieges_utilises") or 0)
    total = int(orga.get("sieges_total") or 0)
    if total and (used + pending) >= total:
        raise HTTPException(status_code=402, detail="plafond_sieges")

    now_iso = now_utc_iso()
    doc = {
        "organisation_id": user["organisation_id"],
        "directeur_id": user["user_id"],
        "email": email,
        "statut": "envoyee",
        "date_envoi": now_iso,
        "date_expiration": make_expiration_iso(INVITATION_TTL_DAYS),
        "created_at": now_iso,
    }
    res = await _db().invitations.insert_one(doc)
    doc["_id"] = res.inserted_id

    # Email best-effort
    lang = (user.get("langue") or "fr")[:2]
    await send_invitation_email(
        to_email=email,
        agence=orga.get("nom") or "",
        directeur_prenom=user.get("prenom") or "",
        directeur_nom=user.get("nom") or "",
        lang=lang,
    )
    return {"invitation": _serialize_invit(doc)}


@router.get("/api/d1/invitations")
async def lister_invitations(request: Request):
    user = await _require_directeur(request)
    # Filtre par défaut : on masque les invitations annulées et acceptées.
    # Les annulées peuvent être réinvitées ; les acceptées apparaissent
    # comme membres actifs dans /api/d1/equipe.
    cur = _db().invitations.find(
        {
            "organisation_id": user["organisation_id"],
            "statut": {"$in": ["envoyee", "expiree"]},
        }
    ).sort("date_envoi", -1)
    items = [_serialize_invit(i) async for i in cur]
    return {"invitations": items}


@router.post("/api/d1/invitations/{invitation_id}/relancer")
async def relancer_invitation(invitation_id: str, request: Request):
    user = await _require_directeur(request)
    _id = _oid(invitation_id)
    invit = await _db().invitations.find_one({"_id": _id})
    if not invit or invit.get("organisation_id") != user["organisation_id"]:
        raise HTTPException(status_code=404, detail="Invitation introuvable")
    if invit.get("statut") not in ("envoyee", "expiree"):
        raise HTTPException(status_code=400, detail="statut_non_relancable")
    now_iso = now_utc_iso()
    await _db().invitations.update_one(
        {"_id": _id},
        {"$set": {
            "statut": "envoyee",
            "date_envoi": now_iso,
            "date_expiration": make_expiration_iso(INVITATION_TTL_DAYS),
            "updated_at": now_iso,
        }},
    )
    orga = await _db().organisations.find_one({"_id": user["organisation_id"]})
    lang = (user.get("langue") or "fr")[:2]
    await send_invitation_email(
        to_email=invit["email"],
        agence=(orga or {}).get("nom") or "",
        directeur_prenom=user.get("prenom") or "",
        directeur_nom=user.get("nom") or "",
        lang=lang,
    )
    invit = await _db().invitations.find_one({"_id": _id})
    return {"invitation": _serialize_invit(invit)}


@router.delete("/api/d1/invitations/{invitation_id}")
async def annuler_invitation(invitation_id: str, request: Request):
    user = await _require_directeur(request)
    _id = _oid(invitation_id)
    invit = await _db().invitations.find_one({"_id": _id})
    if not invit or invit.get("organisation_id") != user["organisation_id"]:
        raise HTTPException(status_code=404, detail="Invitation introuvable")
    if invit.get("statut") == "acceptee":
        raise HTTPException(status_code=400, detail="deja_acceptee")
    await _db().invitations.update_one(
        {"_id": _id},
        {"$set": {"statut": "annulee", "updated_at": now_utc_iso()}},
    )
    return {"ok": True}


@router.get("/api/d1/invitations/check")
async def check_invitation_publique(email: str):
    """Public (utilisé par l'écran de login pour afficher « Invitation en cours »)."""
    res = await check_email_invited(_db(), email)
    if not res:
        return {"invited": False}
    return {"invited": True, "agence": res["agence"], "expire_le": res.get("expire_le")}


# ===========================================================================
# ÉQUIPE  —  tableau + métriques + alerte 48h
# ===========================================================================
def _periode_debut(periode: str) -> datetime:
    now = datetime.now(timezone.utc)
    if periode == "semaine":
        # début de la semaine (lundi) 00:00 UTC
        start_day = now - timedelta(days=now.weekday())
        return start_day.replace(hour=0, minute=0, second=0, microsecond=0)
    # défaut : début du mois
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@router.get("/api/d1/equipe")
async def lister_equipe(request: Request, periode: str = "mois"):
    user = await _require_directeur(request)
    orga_id = user["organisation_id"]

    if periode not in ("semaine", "mois"):
        periode = "mois"
    debut = _periode_debut(periode).isoformat()

    # Membres actifs
    membres = await _db().users.find(
        {"organisation_id": orga_id, "siege_statut": "actif"}
    ).to_list(length=None)
    membres = sorted(membres, key=lambda m: (m.get("role") != "directeur", m.get("prenom") or ""))

    lignes = []
    for m in membres:
        uid = m.get("user_id")
        # Compte par statut sur la période
        pipeline = [
            {"$match": {"assigne_a": uid, "date_attribution": {"$gte": debut}}},
            {"$group": {"_id": "$statut", "n": {"$sum": 1}}},
        ]
        counts: dict[str, int] = {}
        async for row in _db().opportunites.aggregate(pipeline):
            counts[row["_id"] or "proposee"] = int(row["n"])

        attribuees = sum(counts.values())
        ignorees = counts.get("ignoree", 0) + counts.get("deja_en_vente_signale", 0)
        a_demarcher = counts.get("a_demarcher", 0)
        demarchees = counts.get("demarchee", 0) + counts.get("mandat_signe", 0)
        mandats = counts.get("mandat_signe", 0)
        traitees = a_demarcher + demarchees
        taux = round((traitees / attribuees) * 100) if attribuees else 0

        lignes.append({
            "user_id": uid,
            "email": m.get("email"),
            "prenom": m.get("prenom") or "",
            "nom": m.get("nom") or "",
            "role": m.get("role"),
            "attribuees": attribuees,
            "ignorees": ignorees,
            "a_demarcher": a_demarcher,
            "demarchees": demarchees,
            "mandats": mandats,
            "taux_traitement_pct": taux,
        })

    # Alerte 48h : opps attribuées à un membre avec statut=proposee et
    # date_attribution < now - 48h
    seuil = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    alertes_cur = _db().opportunites.find(
        {
            "assigne_a": {"$in": [m.get("user_id") for m in membres]},
            "statut": "proposee",
            "date_attribution": {"$lt": seuil},
        }
    )
    alertes_par_user: dict[str, int] = {}
    alertes_total = 0
    async for opp in alertes_cur:
        uid = opp.get("assigne_a")
        alertes_par_user[uid] = alertes_par_user.get(uid, 0) + 1
        alertes_total += 1
    for ligne in lignes:
        ligne["alerte_48h"] = int(alertes_par_user.get(ligne["user_id"], 0))

    return {
        "periode": periode,
        "debut": debut,
        "equipe": lignes,
        "alerte_48h_total": alertes_total,
    }


# ===========================================================================
# RETRAIT d'un conseiller (règle métier stricte)
# ===========================================================================
@router.delete("/api/d1/equipe/{user_id}")
async def retirer_conseiller(user_id: str, request: Request):
    directeur = await _require_directeur(request)
    orga_id = directeur["organisation_id"]

    if user_id == directeur["user_id"]:
        raise HTTPException(status_code=400, detail="cannot_retire_self")

    membre = await _db().users.find_one({"user_id": user_id})
    if not membre or membre.get("organisation_id") != orga_id:
        raise HTTPException(status_code=404, detail="Membre introuvable")

    now_iso = now_utc_iso()

    # 1) Opps `proposee` du membre → retour au pool (unset assigne_a)
    await _db().opportunites.update_many(
        {"assigne_a": user_id, "statut": "proposee"},
        {"$set": {"updated_at": now_iso},
         "$unset": {"assigne_a": "", "date_attribution": ""}},
    )
    # 2) Opps déjà travaillées → restent au conseiller (aucune action)

    # 3) Retour indépendant + plan Découverte + zones réouvertes
    await _db().users.update_one(
        {"user_id": user_id},
        {"$set": {
            "role": "independant",
            "organisation_id": None,
            "siege_statut": "desactive",
            "plan": "decouverte",
            "plan_depuis": now_iso,
            "zones_deja_modifiees": False,
            "updated_at": now_iso,
        }},
    )

    # 4) Sièges utilisés −− (plancher à 0)
    orga = await _db().organisations.find_one({"_id": orga_id})
    if orga and int(orga.get("sieges_utilises") or 0) > 0:
        await _db().organisations.update_one(
            {"_id": orga_id}, {"$inc": {"sieges_utilises": -1}, "$set": {"updated_at": now_iso}}
        )
    return {"ok": True}


# ===========================================================================
# ATTRIBUTION d'opportunités
# ===========================================================================
async def _check_membre_actif(db, user_id: str, orga_id) -> dict:
    m = await db.users.find_one({"user_id": user_id})
    if not m or m.get("organisation_id") != orga_id or m.get("siege_statut") != "actif":
        raise HTTPException(status_code=400, detail="membre_invalide")
    if m.get("role") not in ("conseiller", "directeur"):
        raise HTTPException(status_code=400, detail="role_invalide")
    return m


async def _check_opp_orga(db, opp_id, orga_id) -> dict:
    opp = await db.opportunites.find_one({"_id": opp_id})
    if not opp or opp.get("organisation_id") != orga_id:
        raise HTTPException(status_code=404, detail="opportunite_introuvable")
    return opp


@router.post("/api/d1/opportunites/{opportunite_id}/attribuer")
async def attribuer_opportunite(opportunite_id: str, payload: AttribuerPayload, request: Request):
    directeur = await _require_directeur(request)
    orga_id = directeur["organisation_id"]
    _id = _oid(opportunite_id)
    opp = await _check_opp_orga(_db(), _id, orga_id)
    await _check_membre_actif(_db(), payload.user_id, orga_id)

    now_iso = now_utc_iso()
    await _db().opportunites.update_one(
        {"_id": _id},
        {"$set": {
            "assigne_a": payload.user_id,
            "date_attribution": now_iso,
            "updated_at": now_iso,
        }},
    )
    return {"ok": True, "opportunite_id": str(_id), "assigne_a": payload.user_id}


@router.post("/api/d1/opportunites/attribuer-lot")
async def attribuer_lot(payload: AttribuerLotPayload, request: Request):
    directeur = await _require_directeur(request)
    orga_id = directeur["organisation_id"]
    await _check_membre_actif(_db(), payload.user_id, orga_id)

    now_iso = now_utc_iso()
    ok = 0
    ignorees = 0
    for raw in payload.opportunite_ids:
        try:
            _id = _oid(raw)
        except HTTPException:
            ignorees += 1
            continue
        opp = await _db().opportunites.find_one({"_id": _id})
        if not opp or opp.get("organisation_id") != orga_id:
            ignorees += 1
            continue
        await _db().opportunites.update_one(
            {"_id": _id},
            {"$set": {
                "assigne_a": payload.user_id,
                "date_attribution": now_iso,
                "updated_at": now_iso,
            }},
        )
        ok += 1
    return {"ok": True, "attribuees": ok, "ignorees": ignorees}


@router.post("/api/d1/opportunites/auto-reste")
async def repartir_auto_reste(request: Request):
    directeur = await _require_directeur(request)
    orga_id = directeur["organisation_id"]
    # Toutes les opps `proposee` non attribuées de l'orga
    cur = _db().opportunites.find(
        {"organisation_id": orga_id, "statut": "proposee",
         "$or": [{"assigne_a": None}, {"assigne_a": {"$exists": False}}]}
    )
    ids = [opp["_id"] async for opp in cur]
    if not ids:
        return {"attribuees": 0, "ignorees": 0, "membres": []}
    res = await distribuer_equilibre(_db(), orga_id, ids)
    return res


@router.post("/api/d1/opportunites/{opportunite_id}/retirer")
async def retirer_attribution(opportunite_id: str, request: Request):
    directeur = await _require_directeur(request)
    orga_id = directeur["organisation_id"]
    _id = _oid(opportunite_id)
    opp = await _check_opp_orga(_db(), _id, orga_id)
    statut = opp.get("statut") or "proposee"
    if statut in STATUTS_TRAITEMENT_ACTIF:
        raise HTTPException(status_code=409, detail="retrait_refuse")
    now_iso = now_utc_iso()
    await _db().opportunites.update_one(
        {"_id": _id},
        {"$set": {"updated_at": now_iso},
         "$unset": {"assigne_a": "", "date_attribution": ""}},
    )
    return {"ok": True}
