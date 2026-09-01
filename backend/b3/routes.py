"""B3 — Endpoints Performances, Funnel, Notifications control, Emails.

Toutes les routes sont préfixées `/api`. Auth via `get_user_from_session` (B1).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from a2.tz import period_bounds_utc, now_paris, to_paris

router = APIRouter(tags=["b3"])


def _db():
    from server import db  # type: ignore
    return db


async def _user(request: Request) -> dict[str, Any]:
    from server import get_user_from_session  # type: ignore
    u = await get_user_from_session(request)
    if not u:
        raise HTTPException(status_code=401, detail="Not authenticated")
    doc = await _db().users.find_one({"user_id": u.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")
    return doc


# ---------------------------------------------------------------------------
# GET /api/me/performances?periode=mois|trimestre|annee
# ---------------------------------------------------------------------------
# Statuts pris en compte :
#   Opportunités = swipes à droite = statuts "demarche", "mandat_signe" (et
#     tous statuts positifs — voir _POSITIVE_STATUTS ci-dessous).
#   Démarchées   = statuts "demarche" + "mandat_signe".
#   Mandats      = statut "mandat_signe" uniquement.
#
# STRICTEMENT EXCLUS : veille_a_surveiller, veille_ignoree, veille_demarchee
# (dans la collection veille_actions), et deja_en_vente_signale (dans
# opportunites.statut) — ni démarché ni abandon.
_STATUTS_POSITIFS = {"demarche", "mandat_signe"}
_STATUTS_DEMARCHES = {"demarche", "mandat_signe"}
_STATUT_MANDAT = "mandat_signe"
_STATUTS_EXCLUS = {"deja_en_vente_signale"}


def _period_range(periode: str) -> tuple[datetime, datetime]:
    """Retourne [start_utc, end_utc[ pour mois / trimestre / annee.

    Les bornes basculent à 00h00 Europe/Paris.
    """
    now = now_paris()
    if periode == "mois":
        return period_bounds_utc("mensuel", now)
    if periode == "annee":
        start_local = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_local = start_local.replace(year=start_local.year + 1)
        return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)
    # trimestre
    q = (now.month - 1) // 3
    start_month = q * 3 + 1
    start_local = now.replace(month=start_month, day=1, hour=0, minute=0, second=0, microsecond=0)
    end_month = start_month + 3
    if end_month > 12:
        end_local = start_local.replace(year=start_local.year + 1, month=1)
    else:
        end_local = start_local.replace(month=end_month)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


@router.get("/api/me/performances")
async def get_my_performances(request: Request, periode: str = Query("mois")):
    if periode not in ("mois", "trimestre", "annee"):
        raise HTTPException(status_code=400, detail="periode_invalide")
    user = await _user(request)
    start, end = _period_range(periode)
    start_iso, end_iso = start.isoformat(), end.isoformat()

    base = {
        "user_id": user["user_id"],
        "date_dernier_statut": {"$gte": start_iso, "$lt": end_iso},
        "statut": {"$nin": list(_STATUTS_EXCLUS)},
    }

    async def _count(extra: dict) -> int:
        q = {**base, **extra}
        try:
            return await _db().opportunites.count_documents(q)
        except Exception:
            return 0

    n_opp = await _count({"statut": {"$in": list(_STATUTS_POSITIFS), "$nin": list(_STATUTS_EXCLUS)}})
    n_dem = await _count({"statut": {"$in": list(_STATUTS_DEMARCHES), "$nin": list(_STATUTS_EXCLUS)}})
    n_man = await _count({"statut": _STATUT_MANDAT})

    # Courbe cumulée jour par jour (basée sur mandats signés = statut mandat_signe)
    pipeline = [
        {"$match": {
            "user_id": user["user_id"],
            "statut": _STATUT_MANDAT,
            "date_dernier_statut": {"$gte": start_iso, "$lt": end_iso},
        }},
        {"$project": {
            "jour": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$dateFromString": {"dateString": "$date_dernier_statut"}}}},
        }},
        {"$group": {"_id": "$jour", "n": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    try:
        agg = await _db().opportunites.aggregate(pipeline).to_list(length=None)
    except Exception:
        agg = []
    # Cumul chronologique
    cumul: list[dict] = []
    total = 0
    for row in agg:
        total += int(row.get("n") or 0)
        cumul.append({"jour": row["_id"], "cumule": total})

    return {
        "ok": True,
        "periode": periode,
        "borne_debut": start_iso,
        "borne_fin": end_iso,
        "jauges": {
            "opportunites": n_opp,
            "demarchees": n_dem,
            "mandats": n_man,
        },
        "entonnoir": {
            "pct_demarchees_sur_opportunites": round(n_dem * 100 / n_opp) if n_opp else 0,
            "pct_mandats_sur_demarchees": round(n_man * 100 / n_dem) if n_dem else 0,
        },
        "courbe_mandats": cumul,
    }


# ---------------------------------------------------------------------------
# GET /api/admin/funnel?debut=&fin=
# ---------------------------------------------------------------------------
@router.get("/api/admin/funnel")
async def get_admin_funnel(
    request: Request,
    debut: Optional[str] = Query(None),
    fin: Optional[str] = Query(None),
):
    """Entonnoir de conversion — 4 étapes, chiffres absolus + % de l'étape précédente.

    Admin uniquement. La collection `events` reçoit les 18 événements front (POST /api/events).
    """
    user = await _user(request)
    if not (user.get("is_super_admin") or (user.get("role") == "super_admin")):
        raise HTTPException(status_code=403, detail="admin_only")

    # Défaut : les 30 derniers jours
    now = datetime.now(timezone.utc)
    debut_dt = datetime.fromisoformat(debut) if debut else (now - timedelta(days=30))
    fin_dt = datetime.fromisoformat(fin) if fin else now
    q = {"date": {"$gte": debut_dt.isoformat(), "$lt": fin_dt.isoformat()}}

    async def _n(event_filter: dict) -> int:
        try:
            return await _db().events.count_documents({**q, **event_filter})
        except Exception:
            return 0

    n_comptes = await _n({"nom": "onboarding_debut"})
    n_paywall = await _n({"nom": "paywall_affiche"})
    n_plan = await _n({"nom": "plan_choisi"})
    n_plan_pro = await _n({"nom": "plan_choisi", "params.plan": "pro"})
    n_plan_dec = await _n({"nom": "plan_choisi", "params.plan": "decouverte"})
    n_swipe_j1 = await _n({"nom": "premier_swipe"})
    n_quota = await _n({"nom": "quota_atteint"})
    n_upgrade = await _n({"nom": "upgrade_depuis_quota"})

    def _pct(a: int, b: int) -> Optional[int]:
        return round(a * 100 / b) if b else None

    return {
        "ok": True,
        "debut": debut_dt.isoformat(), "fin": fin_dt.isoformat(),
        "etapes": [
            {"cle": "comptes", "n": n_comptes, "pct_prec": 100 if n_comptes else 0},
            {"cle": "paywall", "n": n_paywall, "pct_prec": _pct(n_paywall, n_comptes)},
            {"cle": "plan", "n": n_plan, "pct_prec": _pct(n_plan, n_paywall),
             "detail": {"pro": n_plan_pro, "decouverte": n_plan_dec}},
            {"cle": "swipe_j1", "n": n_swipe_j1, "pct_prec": _pct(n_swipe_j1, n_plan)},
            {"cle": "quota", "n": n_quota, "pct_prec": _pct(n_quota, n_swipe_j1),
             "detail": {"upgrade": n_upgrade}},
        ],
    }


# ---------------------------------------------------------------------------
# POST /api/me/notifications/permission — mémorise la décision utilisateur
# (« autoriser » / « plus tard »). L'API système iOS gère la permission réelle,
# le back n'a besoin que de connaître l'intention pour ne pas re-proposer.
# ---------------------------------------------------------------------------
class NotifPermPayload(BaseModel):
    decision: str  # "autorise" | "plus_tard" | "refuse"


@router.post("/api/me/notifications/permission")
async def notif_permission(payload: NotifPermPayload, request: Request):
    if payload.decision not in ("autorise", "plus_tard", "refuse"):
        raise HTTPException(status_code=400, detail="decision_invalide")
    user = await _user(request)
    from a2.tz import now_utc_iso
    await _db().users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "notif_permission_decision": payload.decision,
            "notif_permission_decision_at": now_utc_iso(),
        }},
    )
    return {"ok": True, "decision": payload.decision}


# ---------------------------------------------------------------------------
# POST /api/me/device-token — enregistre un token APNs (multi-appareils OK)
# ---------------------------------------------------------------------------
class DeviceTokenPayload(BaseModel):
    token: str
    plateforme: str = "ios"


@router.post("/api/me/device-token")
async def register_device_token(payload: DeviceTokenPayload, request: Request):
    user = await _user(request)
    from a2.tz import now_utc_iso
    await _db().device_tokens.update_one(
        {"user_id": user["user_id"], "token": payload.token},
        {"$set": {"plateforme": payload.plateforme, "updated_at": now_utc_iso()},
         "$setOnInsert": {"user_id": user["user_id"], "token": payload.token,
                          "created_at": now_utc_iso()}},
        upsert=True,
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# POST /api/admin/zones/{cp}/ouvrir — bascule zone_couvertes.actif=true
# + envoi email + notif push aux utilisateurs de zones_demandees.
# ---------------------------------------------------------------------------
@router.post("/api/admin/zones/{cp}/ouvrir")
async def admin_ouvrir_zone(cp: str, request: Request):
    user = await _user(request)
    if not (user.get("is_super_admin") or user.get("role") == "super_admin"):
        raise HTTPException(status_code=403, detail="admin_only")

    from a2.tz import now_utc_iso
    from b1.ville_resolver import resolve_ville

    # 1. Insert / activate zone
    ville = resolve_ville(cp)
    await _db().zones_couvertes.update_one(
        {"code_postal": cp},
        {"$set": {"actif": True, "libelle": ville or cp, "updated_at": now_utc_iso()},
         "$setOnInsert": {"code_postal": cp, "created_at": now_utc_iso()}},
        upsert=True,
    )
    # 2. Récupère tous les utilisateurs qui l'avaient demandée (idempotent — filtre notifie:false)
    cur = _db().zones_demandees.find({"code_postal": cp, "notifie": False})
    envois = 0
    async for zd in cur:
        user_id = zd.get("user_id")
        email = zd.get("email")
        if not user_id:
            continue
        u = await _db().users.find_one({"user_id": user_id})
        prenom = (u or {}).get("prenom") or ""

        # Email
        try:
            from .services import send_zone_ouverte_email
            if email:
                await send_zone_ouverte_email(email=email, prenom=prenom, cp=cp)
        except Exception:
            pass

        # Push (best effort — tokens multi-appareils)
        try:
            from .services import send_push_to_user
            await send_push_to_user(_db(), user_id, key="notif.zone_ouverte", params={"cp": cp})
        except Exception:
            pass

        await _db().zones_demandees.update_one(
            {"_id": zd["_id"]},
            {"$set": {"notifie": True, "notifie_at": now_utc_iso()}},
        )
        envois += 1

    return {"ok": True, "cp": cp, "envois": envois}
