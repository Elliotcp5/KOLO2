"""KOLO — BLOC B1 routes : onboarding, /me/profil, /me/zones, /me/quotas.

Toutes les routes sont préfixées `/api` (via api_router du serveur).

Conventions :
- L'utilisateur est authentifié via `get_user_from_session(request)`.
- Les zones tapent `zones_couvertes` / `zones_demandees` (collections A2).
- Le CP démo `99999` est TOUJOURS considéré couvert (whitelist en dur).
- Les quotas sont lus via `a2.quotas.verifier_quota` (jamais dupliqué).
- Découverte = 1 modification de zones autorisée à vie. Pro = illimité.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from a2.quotas import verifier_quota
from a2.tz import now_utc_iso

from .ville_resolver import DEMO_CODE_POSTAL, resolve_ville

router = APIRouter(tags=["b1"])


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _db():
    from server import db  # type: ignore
    return db


async def _current_user_doc(request: Request) -> dict[str, Any]:
    """Auth requise. Retourne le user_doc Mongo (pas le modèle Pydantic)."""
    from server import get_user_from_session  # type: ignore

    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    doc = await _db().users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")
    return doc


def _normalize_cp(cp: str) -> str:
    cp = (cp or "").strip()
    if not cp.isdigit() or len(cp) != 5:
        raise HTTPException(status_code=400, detail=f"Code postal invalide : {cp!r}")
    return cp


async def _is_zone_couverte(cp: str) -> bool:
    """Zone couverte = whitelist démo + zones_couvertes actives."""
    if cp == DEMO_CODE_POSTAL:
        return True
    doc = await _db().zones_couvertes.find_one({"code_postal": cp, "actif": True})
    return bool(doc)


async def _record_zone_demandee(user_doc: dict, cp: str) -> None:
    """Insère (idempotent) le CP dans `zones_demandees` pour la carte des zones à ouvrir."""
    await _db().zones_demandees.update_one(
        {"user_id": user_doc["user_id"], "code_postal": cp},
        {
            "$set": {"notifie": False, "updated_at": now_utc_iso()},
            "$setOnInsert": {
                "user_id": user_doc["user_id"],
                "code_postal": cp,
                "email": user_doc.get("email"),
                "created_at": now_utc_iso(),
            },
        },
        upsert=True,
    )


# ---------------------------------------------------------------------------
# GET /api/b1/ville/{cp} — resolve city name for a postal code
# ---------------------------------------------------------------------------
@router.get("/api/b1/ville/{cp}")
async def get_ville(cp: str):
    """Route publique — utilisée par l'écran Zones de l'onboarding."""
    cp_clean = (cp or "").strip()
    if not cp_clean.isdigit() or len(cp_clean) != 5:
        raise HTTPException(status_code=400, detail="cp_invalide")
    ville = resolve_ville(cp_clean)
    return {
        "code_postal": cp_clean,
        "ville": ville,
        "connu": ville is not None,
    }


# ---------------------------------------------------------------------------
# POST /api/onboarding/profil
# ---------------------------------------------------------------------------
class ProfilPayload(BaseModel):
    prenom: str
    nom: str
    statut_declare: str  # "agent" | "directeur"

    @field_validator("prenom", "nom")
    @classmethod
    def _strip_short(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 1:
            raise ValueError("empty")
        return v[:80]

    @field_validator("statut_declare")
    @classmethod
    def _statut(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in {"agent", "directeur"}:
            raise ValueError("statut_invalide")
        return v


@router.post("/api/onboarding/profil")
async def onboarding_profil(payload: ProfilPayload, request: Request):
    user = await _current_user_doc(request)
    # Conformité Apple : quel que soit le statut déclaré, le compte créé
    # depuis l'app iOS est TOUJOURS `independant`. L'élévation en `directeur`
    # (rattachement à une organisation) se fait exclusivement via le
    # back-office administrateur, après vente et paiement.
    # `statut_declare` reste posé comme donnée de segmentation.
    update = {
        "prenom": payload.prenom,
        "nom": payload.nom,
        "name": f"{payload.prenom} {payload.nom}".strip(),
        "statut_declare": payload.statut_declare,
        "role": "independant",
        "updated_at": now_utc_iso(),
    }
    await _db().users.update_one({"user_id": user["user_id"]}, {"$set": update})
    return {"ok": True, "user": {**user, **update}}


# ---------------------------------------------------------------------------
# POST /api/onboarding/zones
# ---------------------------------------------------------------------------
class ZonesPayload(BaseModel):
    codes_postaux: list[str] = Field(..., min_length=1, max_length=2)


@router.post("/api/onboarding/zones")
async def onboarding_zones(payload: ZonesPayload, request: Request):
    """Vérifie chaque CP contre `zones_couvertes` + démo `99999`.

    Toujours enregistrer les CP NON couverts dans `zones_demandees` (carte à
    ouvrir). Retourne un rapport par CP + un booléen `au_moins_une_couverte`.
    """
    user = await _current_user_doc(request)
    resultats = []
    au_moins_une_couverte = False

    for raw in payload.codes_postaux:
        cp = _normalize_cp(raw)
        ville = resolve_ville(cp)
        couverte = await _is_zone_couverte(cp)
        if not couverte:
            await _record_zone_demandee(user, cp)
        else:
            au_moins_une_couverte = True
        resultats.append({"code_postal": cp, "ville": ville, "couverte": couverte})

    # Mémorise les zones perso demandées par l'utilisateur (ce qu'il a saisi)
    zones_perso = [r["code_postal"] for r in resultats]
    await _db().users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "zones_perso": zones_perso,
                "zones_derniere_verification_at": now_utc_iso(),
                "updated_at": now_utc_iso(),
            }
        },
    )
    return {
        "ok": True,
        "resultats": resultats,
        "au_moins_une_couverte": au_moins_une_couverte,
    }


# ---------------------------------------------------------------------------
# POST /api/onboarding/plan
# ---------------------------------------------------------------------------
class PlanPayload(BaseModel):
    plan: str  # "decouverte" | "pro"

    @field_validator("plan")
    @classmethod
    def _plan(cls, v: str) -> str:
        v = (v or "").strip().lower().replace("découverte", "decouverte")
        if v not in {"decouverte", "pro"}:
            raise ValueError("plan_invalide")
        return v


@router.post("/api/onboarding/plan")
async def onboarding_plan(payload: PlanPayload, request: Request):
    """Enregistre l'intention de plan (Découverte ou Pro).

    Note : « Pro » n'est réellement activé qu'après validation du receipt Apple
    (`POST /api/iap/verify-apple-receipt`, déjà en place côté serveur). Ici on
    marque seulement l'intention pour permettre à l'onboarding d'avancer, et on
    laisse le webhook Apple / le verify basculer le plan effectif à "pro".
    """
    user = await _current_user_doc(request)
    now = now_utc_iso()
    if payload.plan == "pro":
        set_fields = {
            "plan_intention": "pro",
            "plan_intention_at": now,
            "updated_at": now,
        }
    else:
        # Découverte : bascule immédiate — pas d'IAP à valider.
        set_fields = {
            "plan": "decouverte",
            "plan_depuis": now,
            "plan_intention": "decouverte",
            "plan_intention_at": now,
            "updated_at": now,
        }
    await _db().users.update_one({"user_id": user["user_id"]}, {"$set": set_fields})
    return {"ok": True, "plan_intention": payload.plan}


# ---------------------------------------------------------------------------
# POST /api/onboarding/termine
# ---------------------------------------------------------------------------
@router.post("/api/onboarding/termine")
async def onboarding_termine(request: Request):
    """Marque l'onboarding comme terminé + crédite l'opportunité de bienvenue."""
    user = await _current_user_doc(request)
    now = now_utc_iso()
    await _db().users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "onboarding_infos_ok": True,
                "onboarding_termine_at": now,
                "bonus_bienvenue_a_crediter": True,  # traité par l'engine A3 au prochain job
                "updated_at": now,
            }
        },
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# GET /api/me/quotas
# ---------------------------------------------------------------------------
@router.get("/api/me/quotas")
async def get_my_quotas(request: Request):
    user = await _current_user_doc(request)
    db = _db()
    payload = {}
    for qtype in ("opportunite", "estimation", "dossier"):
        ok, ctx = await verifier_quota(db, user, qtype)  # type: ignore[arg-type]
        payload[qtype] = {
            "autorise": ok,
            "compteur": ctx.get("compteur", 0),
            "limite": ctx.get("limite", 0),
            "kind": ctx.get("kind"),
            "periode": ctx.get("periode"),
        }
    return {"ok": True, "plan": user.get("plan"), "quotas": payload}


# ---------------------------------------------------------------------------
# GET /api/me/profil
# ---------------------------------------------------------------------------
_INFOS_PERSO_FIELDS = ["prenom", "nom", "phone", "email", "adresse", "code_postal_perso", "ville_perso"]

_INFOS_PRO_FIELDS = [
    "statut_juridique", "siren", "agence_nom", "carte_t_num", "cci_delivrance",
    "rcp_assureur", "rcp_police", "garantie_financiere", "taux_honoraires_pct",
    "honoraires_charge",
    # Grille de pondération des surfaces annexes (coefficients)
    "pond_terrasse", "pond_balcon_loggia", "pond_combles",
    "pond_cave_cellier", "pond_garage", "pond_place_parking", "pond_jardin",
]

_INFOS_PRO_DEFAULTS = {
    "pond_terrasse": 0.35,
    "pond_balcon_loggia": 0.25,
    "pond_combles": 0.30,
    "pond_cave_cellier": 0.12,
    "pond_garage": 0.40,
    "pond_place_parking": 0.30,
    "pond_jardin": 0.10,
}


def _completude_pro(infos_pro: dict[str, Any]) -> int:
    """Renvoie un pourcentage 0-100 de complétude du bloc infos_pro."""
    if not infos_pro:
        return 0
    remplis = 0
    for k in _INFOS_PRO_FIELDS:
        v = infos_pro.get(k)
        if v is None or v == "" or v == 0:
            continue
        remplis += 1
    return round(remplis * 100 / len(_INFOS_PRO_FIELDS))


@router.get("/api/me/profil")
async def get_my_profil(request: Request):
    user = await _current_user_doc(request)
    infos_pro = user.get("infos_pro") or {}
    # Pré-remplissage des coefficients (défauts) si absents
    for k, v in _INFOS_PRO_DEFAULTS.items():
        infos_pro.setdefault(k, v)
    return {
        "ok": True,
        "user": {
            "user_id": user.get("user_id"),
            "email": user.get("email"),
            "prenom": user.get("prenom"),
            "nom": user.get("nom"),
            "phone": user.get("phone"),
            "adresse": user.get("adresse"),
            "code_postal_perso": user.get("code_postal_perso"),
            "ville_perso": user.get("ville_perso"),
            "role": user.get("role"),
            "statut_declare": user.get("statut_declare"),
            "plan": user.get("plan"),
            "plan_depuis": user.get("plan_depuis"),
            "subscription_ends_at": user.get("subscription_ends_at"),
            "zones_perso": user.get("zones_perso") or [],
            "zones_deja_modifiees": bool(user.get("zones_deja_modifiees")),
            "infos_pro": infos_pro,
            "infos_pro_completude": _completude_pro(infos_pro),
        },
    }


# ---------------------------------------------------------------------------
# PATCH /api/me/profil — champs perso + infos_pro (bloc distinct)
# ---------------------------------------------------------------------------
class ProfilPatch(BaseModel):
    perso: Optional[dict[str, Any]] = None
    infos_pro: Optional[dict[str, Any]] = None


def _sanitize(sub: dict[str, Any], allowed: list[str]) -> dict[str, Any]:
    """Filtre les clés autorisées + trim strings + limite longueur."""
    out: dict[str, Any] = {}
    for k in allowed:
        if k not in sub:
            continue
        v = sub[k]
        if isinstance(v, str):
            v = v.strip()[:200]
        out[k] = v
    return out


@router.patch("/api/me/profil")
async def patch_my_profil(payload: ProfilPatch, request: Request):
    user = await _current_user_doc(request)
    set_fields: dict[str, Any] = {"updated_at": now_utc_iso()}
    if payload.perso:
        clean = _sanitize(payload.perso, _INFOS_PERSO_FIELDS)
        for k, v in clean.items():
            set_fields[k] = v
        # Miroir historique `name`
        p = clean.get("prenom", user.get("prenom"))
        n = clean.get("nom", user.get("nom"))
        if p or n:
            set_fields["name"] = f"{p or ''} {n or ''}".strip()
    if payload.infos_pro:
        current = user.get("infos_pro") or {}
        clean = _sanitize(payload.infos_pro, _INFOS_PRO_FIELDS)
        new_infos_pro = {**current, **clean}
        set_fields["infos_pro"] = new_infos_pro
        set_fields["infos_pro_completude"] = _completude_pro(new_infos_pro)

    await _db().users.update_one({"user_id": user["user_id"]}, {"$set": set_fields})
    fresh = await _db().users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    infos_pro = (fresh or {}).get("infos_pro") or {}
    for k, v in _INFOS_PRO_DEFAULTS.items():
        infos_pro.setdefault(k, v)
    return {
        "ok": True,
        "user": fresh,
        "infos_pro_completude": _completude_pro(infos_pro),
    }


# ---------------------------------------------------------------------------
# PATCH /api/me/zones — règle Découverte : 1 modif, Pro : illimité
# ---------------------------------------------------------------------------
class ZonesPatchPayload(BaseModel):
    codes_postaux: list[str] = Field(..., min_length=1, max_length=2)


def _plan_effectif(user: dict[str, Any]) -> str:
    """decouverte / pro / agence. Aligné sur `a2.quotas._plan_for_quota`."""
    if user.get("organisation_id"):
        return "agence"
    p = (user.get("plan") or "").lower().strip()
    if p in ("pro", "pro_plus", "pro_lifetime"):
        return "pro"
    return "decouverte"


@router.patch("/api/me/zones")
async def patch_my_zones(payload: ZonesPatchPayload, request: Request):
    user = await _current_user_doc(request)
    plan = _plan_effectif(user)

    if plan == "decouverte" and user.get("zones_deja_modifiees"):
        raise HTTPException(
            status_code=402,
            detail={"code": "modif_zones_epuisee", "plan": "decouverte"},
        )

    # Vérifie couverture (et logge en zones_demandees les CP rouges)
    resultats = []
    au_moins_une_couverte = False
    for raw in payload.codes_postaux:
        cp = _normalize_cp(raw)
        couverte = await _is_zone_couverte(cp)
        if not couverte:
            await _record_zone_demandee(user, cp)
        else:
            au_moins_une_couverte = True
        resultats.append({
            "code_postal": cp,
            "ville": resolve_ville(cp),
            "couverte": couverte,
        })

    set_fields: dict[str, Any] = {
        "zones_perso": [r["code_postal"] for r in resultats],
        "zones_derniere_verification_at": now_utc_iso(),
        "updated_at": now_utc_iso(),
    }
    if plan == "decouverte":
        set_fields["zones_deja_modifiees"] = True

    await _db().users.update_one({"user_id": user["user_id"]}, {"$set": set_fields})
    return {
        "ok": True,
        "resultats": resultats,
        "au_moins_une_couverte": au_moins_une_couverte,
        "plan": plan,
        "zones_deja_modifiees": set_fields.get("zones_deja_modifiees", user.get("zones_deja_modifiees", False)),
    }


# ---------------------------------------------------------------------------
# DELETE /api/me — Apple 5.1.1(v) compliance (in-app deletion, 2-tap flow)
# ---------------------------------------------------------------------------
@router.delete("/api/me")
async def delete_my_account(request: Request):
    user = await _current_user_doc(request)
    user_id = user["user_id"]
    role = user.get("role")

    # Directeur : conserve l'organisation, note l'événement pour le SI
    if role == "directeur" and user.get("organisation_id"):
        await _db().events.insert_one({
            "nom": "directeur_supprime_compte_perso",
            "user_id": user_id,
            "email": user.get("email"),
            "organisation_id": user.get("organisation_id"),
            "date": now_utc_iso(),
        })
    elif role == "conseiller" and user.get("organisation_id"):
        # Notifie l'organisation (event dédié) + retire le lien
        await _db().events.insert_one({
            "nom": "conseiller_quitte_agence_via_suppression",
            "user_id": user_id,
            "email": user.get("email"),
            "organisation_id": user.get("organisation_id"),
            "date": now_utc_iso(),
        })

    # Purge des données utilisateur (garde les zones_demandees pour la carte des ouvertures futures)
    collections_a_purger = [
        "prospects", "tasks", "interactions", "ai_suggestions", "ai_usage",
        "sms_logs", "notifications", "push_subscriptions", "login_attempts",
        "payment_success", "trial_events",
        # B1 / A2
        "opportunites", "conversations", "estimations", "signalements",
        "quotas", "rapprochements", "device_tokens",
        # V2
        "v2_reminders", "v2_notes", "v2_contacts", "v2_cases",
        "v2_ai_messages", "v2_email_codes", "v2_onboarding",
        "v2_referrals_redeemed", "v2_prospecting_log",
    ]
    for c in collections_a_purger:
        try:
            await _db()[c].delete_many({"user_id": user_id})
        except Exception:
            pass
    try:
        await _db().user_sessions.delete_many({"user_id": user_id})
    except Exception:
        pass
    await _db().users.delete_one({"user_id": user_id})

    return {"ok": True, "message": "Compte et données supprimés."}


# ---------------------------------------------------------------------------
# Bootstrap — appelé au startup pour garantir la démo Apple + zones réelles
# ---------------------------------------------------------------------------
async def ensure_b1_bootstrap(db) -> None:
    """Idempotent — insère `99999` (démo) + `13008/69003/75017` s'ils manquent."""
    from .ville_resolver import BOOTSTRAP_ZONES_COUVERTES

    for cp in BOOTSTRAP_ZONES_COUVERTES:
        ville = resolve_ville(cp)
        await db.zones_couvertes.update_one(
            {"code_postal": cp},
            {
                "$setOnInsert": {
                    "code_postal": cp,
                    "libelle": ville or cp,
                    "actif": True,
                    "created_at": now_utc_iso(),
                    "demo": cp == DEMO_CODE_POSTAL,
                },
                "$set": {"updated_at": now_utc_iso()},
            },
            upsert=True,
        )


# ---------------------------------------------------------------------------
# Cartes « Biens en vente à surveiller » — Pro uniquement
# ---------------------------------------------------------------------------
async def _quota_du_jour(user: dict) -> int:
    """Nombre d'opportunités de mandat déjà vues aujourd'hui par cet utilisateur.

    Utilisé pour décider si la pile de veille s'affiche (seuil_quota_du_jour).
    """
    from a2.tz import period_bounds_utc
    start, end = period_bounds_utc("quotidien")
    q = {
        "user_id": user["user_id"],
        "date_creation": {"$gte": start.isoformat(), "$lt": end.isoformat()},
    }
    try:
        return await _db().opportunites.count_documents(q)
    except Exception:
        return 0


@router.get("/api/me/veille")
async def get_my_veille(request: Request):
    """Retourne la file de veille du jour pour l'utilisateur.

    Règles :
    - Pro uniquement (402 pour Découverte / Agence sans plan Pro).
    - Ne se déclenche que si le quota du jour < `seuil_quota_du_jour` (défaut 3).
    - Cappé à `max_par_jour` (défaut 5).
    - Filtré par les zones perso de l'utilisateur.
    - Trié par `score_veille` décroissant.
    - Exclut les cartes déjà actionnées (`veille_ignoree`, `veille_a_surveiller`,
      `veille_demarchee`) par cet utilisateur.
    """
    user = await _current_user_doc(request)
    plan = _plan_effectif(user)
    if plan != "pro":
        raise HTTPException(status_code=402, detail={"code": "veille_pro_only", "plan": plan})

    from a2.config import get_config
    cfg = await get_config(_db())
    v = (cfg.get("veille") or {})
    seuil = int(v.get("seuil_quota_du_jour", 3))
    max_par_jour = int(v.get("max_par_jour", 5))

    quota = await _quota_du_jour(user)
    if quota >= seuil:
        return {
            "ok": True, "actif": False, "raison": "quota_du_jour_atteint",
            "quota_du_jour": quota, "cartes": [],
        }

    zones = user.get("zones_perso") or []
    if not zones:
        return {"ok": True, "actif": True, "cartes": []}

    # Actions utilisateur → set de listing_id à exclure
    actions_cur = _db().veille_actions.find(
        {"user_id": user["user_id"]}, {"listing_id": 1}
    )
    seen = {a["listing_id"] async for a in actions_cur if a.get("listing_id")}

    cur = _db().veille_cards.find({"code_postal": {"$in": zones}}, {"_id": 1}).limit(0)
    docs = _db().veille_cards.find(
        {"code_postal": {"$in": zones}}
    ).sort("score_veille", -1)
    cartes = []
    async for d in docs:
        if d.get("listing_id") in seen:
            continue
        d["id"] = str(d.pop("_id", ""))
        cartes.append(d)
        if len(cartes) >= max_par_jour:
            break
    return {"ok": True, "actif": True, "quota_du_jour": quota, "cartes": cartes}


class VeilleStatutPayload(BaseModel):
    statut: str  # "veille_a_surveiller" | "veille_ignoree" | "veille_demarchee"

    @field_validator("statut")
    @classmethod
    def _validate(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in {"veille_a_surveiller", "veille_ignoree", "veille_demarchee"}:
            raise ValueError("statut_invalide")
        return v


@router.patch("/api/me/veille/{listing_id}/statut")
async def patch_veille_statut(listing_id: str, payload: VeilleStatutPayload, request: Request):
    """Enregistre l'action de l'utilisateur sur une carte de veille.

    Statuts propres à la veille — n'entrent JAMAIS dans les compteurs
    d'opportunités / démarchées / mandats de la page Statistiques.
    """
    user = await _current_user_doc(request)
    plan = _plan_effectif(user)
    if plan != "pro":
        raise HTTPException(status_code=402, detail={"code": "veille_pro_only", "plan": plan})

    now = now_utc_iso()
    await _db().veille_actions.update_one(
        {"user_id": user["user_id"], "listing_id": listing_id},
        {
            "$set": {"statut": payload.statut, "updated_at": now},
            "$setOnInsert": {
                "user_id": user["user_id"],
                "listing_id": listing_id,
                "created_at": now,
            },
        },
        upsert=True,
    )
    return {"ok": True, "listing_id": listing_id, "statut": payload.statut}


@router.get("/api/me/veille/suivis")
async def get_my_veille_suivis(request: Request):
    """Liste des biens que l'utilisateur a marqués « à suivre »."""
    user = await _current_user_doc(request)
    actions_cur = _db().veille_actions.find(
        {"user_id": user["user_id"], "statut": "veille_a_surveiller"}
    ).sort("updated_at", -1)
    suivis = []
    async for a in actions_cur:
        card = await _db().veille_cards.find_one({"listing_id": a["listing_id"]})
        if not card:
            continue
        card["id"] = str(card.pop("_id", ""))
        card["marque_a_surveiller_at"] = a.get("updated_at")
        suivis.append(card)
    return {"ok": True, "suivis": suivis}


# ---------------------------------------------------------------------------
# GET /api/opportunites/du-jour — les 5 cartes attribuées à l'utilisateur
# POST /api/opportunites/{id}/accepter — swipe droite (ouvre estimation)
# POST /api/opportunites/{id}/rejeter  — swipe gauche
#
# Sans ces endpoints, le frontend `OpportunitesPage` retombait sur
# `DEMO_OPPORTUNITES` et n'affichait JAMAIS les vraies opportunités de la
# base — c'est le bug numéro 2 remonté depuis TestFlight.
# ---------------------------------------------------------------------------
@router.get("/api/opportunites/du-jour")
async def get_opportunites_du_jour(request: Request, limit: int = 5):
    """Retourne les opportunités attribuées à l'utilisateur, en statut
    `proposee`, triées par date_attribution DESC (les plus récentes d'abord).
    Limite à `limit` (par défaut 5).
    """
    user = await _current_user_doc(request)
    uid = user["user_id"]
    cur = _db().opportunites.find(
        {"assigne_a": uid, "statut": "proposee"},
        {"_id": 1, "adresse": 1, "code_postal": 1, "complement_adresse": 1,
         "lat": 1, "lng": 1, "caracteristiques": 1, "score_confiance": 1,
         "motif_opportunite": 1, "date_attribution": 1, "id_parcelle": 1},
    ).sort("date_attribution", -1).limit(max(1, min(limit, 20)))
    items = []
    async for opp in cur:
        caracs = opp.get("caracteristiques") or {}
        items.append({
            "id": str(opp["_id"]),
            "adresse": opp.get("adresse") or "",
            "code_postal": opp.get("code_postal"),
            "complement_adresse": opp.get("complement_adresse"),
            "lat": opp.get("lat"),
            "lng": opp.get("lng"),
            "dpe": caracs.get("classe_dpe") or "N/A",
            "superficie": caracs.get("surface_habitable"),
            "annee_construction": caracs.get("annee_construction"),
            "type_bien": caracs.get("type_batiment"),
            "source": "DPE",
            "note": opp.get("motif_opportunite") or "",
            "score_confiance": opp.get("score_confiance"),
            "date_attribution": opp.get("date_attribution"),
            "caracteristiques": caracs,
            "id_parcelle": opp.get("id_parcelle"),
        })
    return {"ok": True, "items": items, "count": len(items)}


def _oid_or_400(raw: str):
    from bson import ObjectId
    from bson.errors import InvalidId
    try:
        return ObjectId(raw)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="opportunite_id_invalide")


@router.post("/api/opportunites/{opportunite_id}/accepter")
async def accepter_opportunite(opportunite_id: str, request: Request):
    """Swipe droite : l'utilisateur accepte, on marque `acceptee`. Le front
    ouvre ensuite l'estimation avec le bien pré-rempli."""
    user = await _current_user_doc(request)
    _id = _oid_or_400(opportunite_id)
    now_iso = now_utc_iso()
    res = await _db().opportunites.update_one(
        {"_id": _id, "assigne_a": user["user_id"], "statut": "proposee"},
        {"$set": {"statut": "acceptee",
                  "date_acceptation": now_iso,
                  "date_dernier_statut": now_iso,
                  "updated_at": now_iso}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="opportunite_introuvable_ou_deja_traitee")
    return {"ok": True, "opportunite_id": opportunite_id, "statut": "acceptee"}


@router.post("/api/opportunites/{opportunite_id}/rejeter")
async def rejeter_opportunite(opportunite_id: str, request: Request):
    """Swipe gauche : l'utilisateur ignore, on marque `rejetee`."""
    user = await _current_user_doc(request)
    _id = _oid_or_400(opportunite_id)
    now_iso = now_utc_iso()
    res = await _db().opportunites.update_one(
        {"_id": _id, "assigne_a": user["user_id"], "statut": "proposee"},
        {"$set": {"statut": "rejetee",
                  "date_rejet": now_iso,
                  "date_dernier_statut": now_iso,
                  "updated_at": now_iso}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="opportunite_introuvable_ou_deja_traitee")
    return {"ok": True, "opportunite_id": opportunite_id, "statut": "rejetee"}
