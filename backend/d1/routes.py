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
from .migration_v2_to_b1 import bascule_to_b1, bascule_to_v2, compute_suggested_zones
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


def _check_admin(request: Request) -> None:
    """Admin via X-Admin-Secret. Utilisé pour la bascule V2↔B1."""
    import os
    provided = (request.headers.get("x-admin-secret") or "").strip()
    expected = (os.environ.get("ADMIN_SECRET") or "").strip()
    if not expected or provided != expected:
        raise HTTPException(status_code=403, detail="Admin access required")


# ===========================================================================
# BASCULE V2 ↔ B1  (admin uniquement)
# ===========================================================================
from pydantic import BaseModel


class BasculePayload(BaseModel):
    user_ids: list[str] = []
    email: str | None = None


@router.post("/api/d1/admin/bascule-b1")
async def admin_bascule_b1(payload: BasculePayload, request: Request):
    _check_admin(request)
    targets: list[str] = list(payload.user_ids or [])
    if payload.email:
        u = await _db().users.find_one({"email": payload.email.strip().lower()}, {"user_id": 1})
        if u and u.get("user_id"):
            targets.append(u["user_id"])
    if not targets:
        raise HTTPException(status_code=400, detail="no_targets")
    results = [await bascule_to_b1(_db(), uid) for uid in targets]
    return {"total": len(results), "results": results}


@router.post("/api/d1/admin/bascule-v2")
async def admin_bascule_v2(payload: BasculePayload, request: Request):
    _check_admin(request)
    targets: list[str] = list(payload.user_ids or [])
    if payload.email:
        u = await _db().users.find_one({"email": payload.email.strip().lower()}, {"user_id": 1})
        if u and u.get("user_id"):
            targets.append(u["user_id"])
    if not targets:
        raise HTTPException(status_code=400, detail="no_targets")
    results = [await bascule_to_v2(_db(), uid) for uid in targets]
    return {"total": len(results), "results": results}


# ---------------------------------------------------------------------------
# ADMIN one-shot : diagnostic + état compte + seed prod
# ---------------------------------------------------------------------------
@router.get("/api/d1/admin/etat-compte")
async def admin_etat_compte(email: str, request: Request):
    """Lecture seule — permet de vérifier depuis prod qu'une bascule a pris.

    **Normalisation du plan** — la valeur `pro_plus` est un vestige de
    l'ancienne app. Ici on remonte l'état effectif normalisé (`pro` ou
    `decouverte`) pour éviter toute alternance selon le chemin de lecture.
    """
    _check_admin(request)
    e = (email or "").strip().lower()
    u = await _db().users.find_one({"email": e})
    if not u:
        return {"found": False, "email": e}
    uid = u.get("user_id")
    n_opps = await _db().opportunites.count_documents({"assigne_a": uid, "statut": "proposee"})
    n_zc = await _db().zones_couvertes.count_documents({})
    # Normalisation stricte : seules deux valeurs sortent d'ici — `pro` ou
    # `decouverte`. `pro_plus`/`pro_lifetime` sont des vestiges → `pro`.
    raw_plan = (u.get("plan") or "").lower()
    if raw_plan in ("pro", "pro_plus", "pro_lifetime"):
        plan_normalise = "pro"
    else:
        plan_normalise = "decouverte"
    return {
        "found": True,
        "email": e,
        "user_id": uid,
        "app_version": u.get("app_version"),
        "zones_confirmees": bool(u.get("zones_confirmees", False)),
        "zones_perso": u.get("zones_perso") or [],
        "zones_suggestions": u.get("zones_suggestions") or [],
        "tour_guide_vu": bool(u.get("tour_guide_vu", False)),
        "role": u.get("role"),
        "plan": plan_normalise,
        "plan_raw": raw_plan or None,
        "opps_proposees_attribuees": n_opps,
        "zones_couvertes_total": n_zc,
    }


@router.post("/api/d1/admin/seed-zones-couvertes")
async def admin_seed_zones(request: Request):
    _check_admin(request)
    volumes = {"75017": 1300, "13008": 800, "69003": 700, "99999": 4}
    now_iso = now_utc_iso()
    upserts = []
    for cp, vol in volumes.items():
        r = await _db().zones_couvertes.update_one(
            {"code_postal": cp},
            {"$set": {
                "code_postal": cp, "actif": True, "volume_attendu": vol,
                "demo": cp == "99999", "updated_at": now_iso,
            }},
            upsert=True,
        )
        upserts.append({"cp": cp, "modified": r.modified_count, "upserted": r.upserted_id is not None})
    return {"seeded": upserts, "total_zones_couvertes": await _db().zones_couvertes.count_documents({})}


@router.post("/api/d1/admin/seed-opps-13008")
async def admin_seed_opps_13008(payload: BasculePayload, request: Request):
    """Attribue 5 opps 13008 (statut proposee) à `payload.email`."""
    _check_admin(request)
    if not payload.email:
        raise HTTPException(status_code=400, detail="email_required")
    u = await _db().users.find_one({"email": payload.email.strip().lower()})
    if not u:
        raise HTTPException(status_code=404, detail="user_not_found")
    uid = u["user_id"]
    now_iso = now_utc_iso()
    # Cible : 5 opps 13008 non attribuées OU en pool
    ops = await _db().opportunites.find(
        {"code_postal": "13008", "$or": [{"statut": "pool"}, {"statut": {"$exists": False}}]}
    ).limit(5).to_list(length=5)
    for opp in ops:
        await _db().opportunites.update_one(
            {"_id": opp["_id"]},
            {"$set": {
                "user_id": uid, "assigne_a": uid, "statut": "proposee",
                "date_attribution": now_iso, "updated_at": now_iso,
            }},
        )
    n_after = await _db().opportunites.count_documents(
        {"assigne_a": uid, "statut": "proposee"}
    )
    return {"attribuees_maintenant": len(ops), "total_proposees_attribuees": n_after}


@router.get("/api/d1/admin/diagnostic")
async def admin_diagnostic(request: Request):
    """Liste les routers montés — permet de diagnostiquer un module absent en prod."""
    _check_admin(request)
    from server import app  # type: ignore
    routes = sorted({getattr(r, "path", "") for r in app.routes if getattr(r, "path", "").startswith("/api")})
    prefixes = {}
    for p in routes:
        prefix = "/".join(p.split("/")[:3]) or p  # ex /api/dossiers
        prefixes[prefix] = prefixes.get(prefix, 0) + 1
    # Contexte env
    import os as _os
    env_info = {
        "supabase_url": (_os.environ.get("SUPABASE_URL") or "").split("/")[2] if _os.environ.get("SUPABASE_URL") else None,
        "mongo_db_name": _os.environ.get("DB_NAME"),
        "has_supabase_key": bool(_os.environ.get("SUPABASE_SECRET_KEY") or _os.environ.get("SUPABASE_KEY")),
    }
    return {
        "total_routes": len(routes),
        "prefixes": prefixes,
        "env": env_info,
        "sample": routes[:80],
    }


@router.get("/api/d1/admin/etat-jobs")
async def admin_etat_jobs(request: Request):
    """Retourne pour chaque job planifié : sa dernière exécution réussie,
    sa durée, son résultat, et son statut courant."""
    _check_admin(request)
    jobs = ["extraire_rues_quotidien", "generer_opportunites_quotidien",
            "distribuer_quotidien", "recycler_48h", "recharger_decouverte_hebdo"]
    out = {}
    for j in jobs:
        last_run = await _db().jobs_runs.find_one(
            {"job": j}, sort=[("start", -1)]
        )
        last_ok = await _db().jobs_runs.find_one(
            {"job": j, "status": "done"}, sort=[("start", -1)]
        )
        def _serialize(r):
            if not r:
                return None
            r.pop("_id", None)
            return r
        out[j] = {
            "last_run": _serialize(last_run),
            "last_success": _serialize(last_ok),
        }
    # Prochaine exécution APScheduler
    try:
        from d1.scheduler import _scheduler
        if _scheduler:
            for job in _scheduler.get_jobs():
                if job.id in out:
                    nrt = job.next_run_time
                    out[job.id]["next_run"] = nrt.isoformat() if nrt else None
    except Exception:
        pass
    return out


@router.post("/api/d1/admin/run-job")
async def admin_run_job(request: Request):
    """Déclenche manuellement un job planifié. Body: {"job": "distribuer_quotidien"}."""
    _check_admin(request)
    body = await request.json()
    job = (body or {}).get("job")
    from d1.scheduler import (
        _run_generer_opportunites, _run_distribuer_quotidien,
        _run_recycler_48h, _run_recharger_decouverte,
    )

    async def _run_extraire_rues_wrapper(db):
        """Log dans jobs_runs (utile pour /api/d1/admin/etat-jobs)."""
        from a3.job_extract_rues import run_extraire_rues
        from a3.scheduler import _log_run, _now_utc_iso
        start = _now_utc_iso()
        try:
            r = await run_extraire_rues(db, code_postal=None)
            status = r.get("status") or "done"
            await _log_run(db, "extraire_rues_quotidien", start, status,
                           summary={"totals": r.get("totals"),
                                    "cps_processed": r.get("cps_processed"),
                                    "warning": r.get("warning")})
        except Exception as e:
            await _log_run(db, "extraire_rues_quotidien", start, "failed",
                           error=f"{type(e).__name__}: {e}")

    mapping = {
        "extraire_rues_quotidien": _run_extraire_rues_wrapper,
        "generer_opportunites_quotidien": _run_generer_opportunites,
        "distribuer_quotidien": _run_distribuer_quotidien,
        "recycler_48h": _run_recycler_48h,
        "recharger_decouverte_hebdo": _run_recharger_decouverte,
    }
    if job not in mapping:
        raise HTTPException(status_code=400, detail="job_inconnu")
    import asyncio
    asyncio.create_task(mapping[job](_db()))
    return {"ok": True, "job": job, "status": "running_in_background"}


@router.post("/api/d1/admin/force-zones-suggestions")
async def admin_force_zones_suggestions(request: Request):
    """Force `zones_suggestions` (et optionnellement `zones_perso`) sur un compte.
    Body: {"email": "...", "zones": ["13008"], "aussi_zones_perso": false}."""
    _check_admin(request)
    body = await request.json()
    email = (body or {}).get("email", "").strip().lower()
    zones = (body or {}).get("zones") or []
    aussi_perso = bool((body or {}).get("aussi_zones_perso"))
    u = await _db().users.find_one({"email": email})
    if not u:
        raise HTTPException(status_code=404, detail="user_not_found")
    update = {"zones_suggestions": zones, "updated_at": now_utc_iso()}
    if aussi_perso:
        update["zones_perso"] = zones
    await _db().users.update_one({"user_id": u["user_id"]}, {"$set": update})
    return {"ok": True, "email": email, "zones_suggestions": zones,
            "zones_perso": (zones if aussi_perso else u.get("zones_perso"))}


@router.post("/api/d1/admin/migrer-prod")
async def admin_migrer_prod(request: Request):
    """Applique en une passe idempotente TOUTES les migrations manquantes en
    production : indexes MongoDB cassés, seeds essentiels (`config_matching`,
    `zones_couvertes`), migration users A2, et diagnostic dépendances.

    Auth : `X-Admin-Secret`. Body : `{}` (rien attendu).

    Retour : rapport détaillé de ce qui a été corrigé, ce qui était déjà OK,
    et ce qui reste cassé. Strictement idempotent — la 2e exécution rapporte
    `already_ok` sur tout.

    Corrige notamment `enrichissements.id_parcelle` (index unique sans
    partialFilterExpression → recréé en `{$type: "string"}`).
    """
    _check_admin(request)
    from d1.migration_prod import migrer_prod
    report = await migrer_prod(_db())
    return report



@router.post("/api/d1/admin/generer-opportunites")
async def admin_generer_opportunites(request: Request):
    """One-shot admin — lance le job en tâche de fond pour éviter le timeout proxy.
    Body: {"code_postal": "13008"}
    Retour immédiat : {"job_id": "..."}. Interroger l'avancement via
    GET /api/d1/admin/generer-opportunites/{job_id}

    **Écrit dans `jobs_runs` en plus de `jobs`** — sinon `etat-jobs` continue
    à afficher un vieil échec périmé pendant qu'en réalité le job produit
    (bug remonté 2026-02).
    """
    _check_admin(request)
    import asyncio
    from uuid import uuid4
    body = await request.json()
    cp = (body or {}).get("code_postal")
    if not cp or len(str(cp)) != 5:
        raise HTTPException(status_code=400, detail="code_postal_invalide")

    job_id = f"job_{uuid4().hex[:12]}"
    now_iso = now_utc_iso()
    await _db().jobs.insert_one({
        "job_id": job_id, "type": "generer_opportunites",
        "code_postal": str(cp), "status": "running",
        "created_at": now_iso, "updated_at": now_iso,
    })

    async def _runner():
        from a3.job_generer_opportunites import run_generer_opportunites
        from d1.scheduler import _log_run, _now_iso as _sched_now
        start_iso = _sched_now()
        try:
            report = await run_generer_opportunites(_db(), code_postal=str(cp))
            await _db().jobs.update_one(
                {"job_id": job_id},
                {"$set": {"status": "done", "report": report, "updated_at": now_utc_iso()}},
            )
            # Miroir dans jobs_runs pour que etat-jobs remonte cette exécution.
            await _log_run(
                _db(), "generer_opportunites_quotidien", start_iso, "done",
                summary={"zones": 1, "code_postal": str(cp), "report": report,
                         "triggered_via": "admin_one_shot"},
            )
        except Exception as e:
            err = f"{type(e).__name__}: {e}"
            await _db().jobs.update_one(
                {"job_id": job_id},
                {"$set": {"status": "failed", "error": err,
                          "updated_at": now_utc_iso()}},
            )
            await _log_run(
                _db(), "generer_opportunites_quotidien", start_iso, "failed",
                error=err, summary={"code_postal": str(cp),
                                    "triggered_via": "admin_one_shot"},
            )

    asyncio.create_task(_runner())
    return {"job_id": job_id, "status": "running"}


@router.get("/api/d1/admin/generer-opportunites/{job_id}")
async def admin_get_generer_job(job_id: str, request: Request):
    _check_admin(request)
    job = await _db().jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="job_introuvable")
    return job


# ===========================================================================
# PARTIE 1 — Correctifs prod (Février 2026)
#
# Ces endpoints existent parce que `migrer-prod` ne suffit pas à réparer un
# état déjà cassé en production (l'index unique refuse d'être écrit tant que
# les doublons null existent). Ils sont **forceurs** : ils ne demandent pas
# poliment, ils reconstruisent.
# ===========================================================================
@router.post("/api/d1/admin/fix-index-enrichissements")
async def admin_fix_index_enrichissements(request: Request):
    """Fix FORCÉ de l'index `enrichissements.id_parcelle` en production.

    Étapes :
      1. Lit et retourne la définition ACTUELLE de tous les indexes de la
         collection (utile pour comprendre ce qui bloque).
      2. Compte les documents avec `id_parcelle: null` OU champ absent.
      3. Drop TOUS les indexes existants sur `id_parcelle` (peu importe leur
         nom).
      4. Recrée l'index unique en `partialFilterExpression: { id_parcelle:
         { $type: "string" } }`. Cette expression garantit que l'unicité ne
         s'applique QUE quand la parcelle est une string non-vide.
      5. Relit la définition finale et la retourne pour confirmation.

    Retour :
    ```
    {
      "before": [ ... indexes actuels ... ],
      "docs_with_null_parcelle": N,
      "docs_with_missing_parcelle": M,
      "drop_actions": [ ... ],
      "create_action": {...},
      "after": [ ... indexes finaux ... ],
      "success": bool
    }
    ```
    """
    _check_admin(request)
    db = _db()
    target_name = "id_parcelle_unique_partial"
    target_options = {
        "unique": True,
        "partialFilterExpression": {"id_parcelle": {"$type": "string"}},
    }

    # 1) État initial
    try:
        before = await db.enrichissements.index_information()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"cannot_read_indexes: {type(e).__name__}: {e}")

    # 2) Compte des documents à problème (pour info)
    n_null = await db.enrichissements.count_documents({"id_parcelle": None})
    n_missing = await db.enrichissements.count_documents({"id_parcelle": {"$exists": False}})

    # 3) Drop TOUS les indexes qui portent sur `id_parcelle` (y compris
    # l'ancien `id_parcelle_1` cassé sans partialFilter).
    drop_actions = []
    for name, info in before.items():
        if name == "_id_":
            continue
        keys = info.get("key") or []
        if any(k == "id_parcelle" for k, _ in keys):
            try:
                await db.enrichissements.drop_index(name)
                drop_actions.append({"name": name, "status": "dropped"})
            except Exception as e:
                drop_actions.append({
                    "name": name, "status": "drop_failed",
                    "error": f"{type(e).__name__}: {e}",
                })

    # 4) Recréation de l'index cible
    create_action: dict = {"name": target_name, "options": target_options}
    try:
        created = await db.enrichissements.create_index(
            [("id_parcelle", 1)],
            name=target_name,
            **target_options,
        )
        create_action["status"] = "created"
        create_action["created_name"] = created
    except Exception as e:
        create_action["status"] = "create_failed"
        create_action["error"] = f"{type(e).__name__}: {e}"

    # 5) État final
    try:
        after = await db.enrichissements.index_information()
    except Exception as e:
        after = {"__error__": f"{type(e).__name__}: {e}"}

    success = (
        create_action.get("status") == "created"
        and any(
            n == target_name for n in after.keys()
        )
    )

    return {
        "before": before,
        "docs_with_null_parcelle": n_null,
        "docs_with_missing_parcelle": n_missing,
        "drop_actions": drop_actions,
        "create_action": create_action,
        "after": after,
        "success": success,
    }


@router.get("/api/d1/admin/audit-indexes")
async def admin_audit_indexes(request: Request):
    """Compare l'état RÉEL des indexes en base avec la spec `EXPECTED_INDEXES`
    déclarée dans `d1.migration_prod`. Retourne la liste précise des écarts.

    Complète `migrer-prod` en lecture seule : on peut voir sans réparer.
    """
    _check_admin(request)
    from d1.migration_prod import _diagnose_indexes
    fixes, ok = await _diagnose_indexes(_db())
    return {
        "ecarts": fixes,
        "conformes": ok,
        "resume": {
            "total_attendus": len(fixes) + len(ok),
            "conformes": len(ok),
            "ecarts": len(fixes),
        },
    }


@router.get("/api/d1/admin/diagnostic-zone")
async def admin_diagnostic_zone(code_postal: str, request: Request):
    """Diagnostic complet pour une zone donnée (défaut 13008).

    Retour :
      - `zones_couvertes` : présence, actif, volume_attendu
      - `listings` (Supabase) : total_active, max_scraped_at, max_last_seen_at
      - `days_since_scrape` : nombre de jours depuis dernier scraping
      - `facteur_fraicheur` : valeur calculée par le moteur
      - `dpe_recents` : nombre de DPE ADEME <62j pour ce CP
      - `opportunites` : compte par statut
      - `verdict` : phrase claire — « fraîcheur=0 → aucun opp possible » ou OK
    """
    _check_admin(request)
    cp = (code_postal or "").strip()
    if len(cp) != 5 or not cp.isdigit():
        raise HTTPException(status_code=400, detail="code_postal_invalide")

    db = _db()
    import httpx
    from a2.config import get_config
    from a3.job_generer_opportunites import (
        _get_zone_scraping_state, _facteur_fraicheur,
    )

    # 1) Zone couverte
    zc = await db.zones_couvertes.find_one({"code_postal": cp})
    zc_serialized = None
    if zc:
        zc.pop("_id", None)
        zc_serialized = zc

    # 2) Freshness via Supabase (source de vérité)
    async with httpx.AsyncClient() as client:
        state = await _get_zone_scraping_state(db, cp, client)

    # 3) Facteur fraicheur
    cfg = await get_config(db)
    f_frais = _facteur_fraicheur(state["days_since_scrape"], cfg)

    # 4) Opportunités par statut
    opps_pipeline = [
        {"$match": {"code_postal": cp}},
        {"$group": {"_id": "$statut", "n": {"$sum": 1}}},
    ]
    opps_by_statut = {row["_id"] or "?": int(row["n"])
                      async for row in db.opportunites.aggregate(opps_pipeline)}

    # 5) Verdict
    if not zc:
        verdict = f"zone {cp} absente de zones_couvertes"
    elif not zc.get("actif"):
        verdict = f"zone {cp} présente mais inactive (actif=false)"
    elif state["active_count"] == 0:
        verdict = "aucun listing actif — Apify n'a jamais scrapé cette zone"
    elif f_frais == 0.0:
        verdict = (
            f"fraicheur=0 — dernier scraping il y a {state['days_since_scrape']}j "
            f"(>7j) — le moteur ne produit AUCUN opportunité tant qu'un nouveau "
            f"run Apify n'a pas alimenté cette zone"
        )
    elif f_frais == 0.7:
        verdict = f"fraicheur=0.7 (dégradée) — {state['days_since_scrape']}j"
    else:
        verdict = f"fraicheur=1.0 (pleine) — {state['days_since_scrape']}j"

    return {
        "code_postal": cp,
        "zone_couverte": zc_serialized,
        "listings": {
            "active_count": state["active_count"],
            "days_since_scrape": state["days_since_scrape"],
        },
        "facteur_fraicheur": f_frais,
        "config_fraicheur": cfg.get("fraicheur"),
        "opportunites_par_statut": opps_by_statut,
        "verdict": verdict,
    }


class OuvrirZonePayload(BaseModel):
    code_postal: str
    commune: str | None = None
    volume_attendu: int = 1000


@router.post("/api/d1/admin/ouvrir-zone")
async def admin_ouvrir_zone(payload: OuvrirZonePayload, request: Request):
    """Ouvre une nouvelle zone en 1 appel.

    Étapes :
      1. Upsert dans `zones_couvertes` avec `actif=True`.
      2. Notifie tous les users de `zones_demandees` sur ce CP (email + flag
         `notifie=True`) — best-effort, l'échec email ne fait pas échouer la
         création de la zone.
      3. Retourne un rapport détaillé.

    Le planificateur détecte automatiquement les nouvelles zones (voir
    `d1.scheduler._run_generer_opportunites` qui interroge `zones_couvertes`
    à chaque tick 03h00 — aucune liste en dur).
    """
    _check_admin(request)
    cp = (payload.code_postal or "").strip()
    if len(cp) != 5 or not cp.isdigit():
        raise HTTPException(status_code=400, detail="code_postal_invalide")

    db = _db()
    now_iso = now_utc_iso()

    # 1) Upsert zone
    existing = await db.zones_couvertes.find_one({"code_postal": cp})
    patch = {
        "code_postal": cp,
        "actif": True,
        "volume_attendu": int(payload.volume_attendu or 1000),
        "demo": False,
        "updated_at": now_iso,
    }
    if payload.commune:
        patch["commune"] = payload.commune.strip()
    if not existing:
        patch["created_at"] = now_iso
        await db.zones_couvertes.insert_one(patch)
        zone_action = "created"
    else:
        await db.zones_couvertes.update_one({"code_postal": cp}, {"$set": patch})
        zone_action = "updated" if not existing.get("actif") else "already_active"

    # 2) Notifie users en attente
    demandes = await db.zones_demandees.find(
        {"code_postal": cp, "notifie": False}
    ).to_list(length=None)
    notified = 0
    errors: list[str] = []
    for d in demandes:
        try:
            from email_service import send_email
            email = d.get("email")
            if email:
                await send_email(
                    to=email,
                    subject=f"KOLO — Votre zone {cp} vient d'ouvrir",
                    body=(
                        f"Bonjour,\n\n"
                        f"La zone {cp} que vous aviez demandée est maintenant "
                        f"couverte par KOLO. Vos premières opportunités "
                        f"arrivent demain matin.\n\n— L'équipe KOLO"
                    ),
                )
            await db.zones_demandees.update_one(
                {"_id": d["_id"]},
                {"$set": {"notifie": True, "notifie_at": now_iso}},
            )
            notified += 1
        except Exception as e:
            errors.append(f"{d.get('email')}: {type(e).__name__}")

    return {
        "ok": True,
        "code_postal": cp,
        "zone_action": zone_action,
        "volume_attendu": patch["volume_attendu"],
        "users_notifies": notified,
        "users_en_attente_total": len(demandes),
        "erreurs_notification": errors,
    }


class PromouvoirDirecteurPayload(BaseModel):
    email: str
    nom_agence: str = "Agence Test KOLO"
    sieges: int = 5
    zones: list[str] = ["13008"]
    directeur_prospecte: bool = True
    seed_opportunites_org: int = 5


@router.post("/api/d1/admin/promouvoir-directeur")
async def admin_promouvoir_directeur(payload: PromouvoirDirecteurPayload,
                                       request: Request):
    """Crée une organisation de test + promeut un compte en directeur en 1 appel.

    Étapes idempotentes :
      1. Cherche l'user par email → 404 si absent
      2. Upsert organisation `{nom_agence, sieges, zones, directeur_prospecte}`
      3. Patche user : `role="directeur"`, `organisation_id`, `plan="pro"`
      4. Optionnel — alimente le pool org avec N opps `pool` de la zone
         principale attribuées à l'org (statut `pool_org`)

    Ne crée AUCUN écran de tarif, aucun montant. Compatible test Apple Review.
    """
    _check_admin(request)
    db = _db()
    email = (payload.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email_required")
    u = await db.users.find_one({"email": email})
    if not u:
        raise HTTPException(status_code=404, detail="user_not_found")

    now_iso = now_utc_iso()
    # 1) Upsert organisation
    from bson import ObjectId
    existing_org = await db.organisations.find_one({"nom": payload.nom_agence})
    if existing_org:
        org_id = existing_org["_id"]
        await db.organisations.update_one(
            {"_id": org_id},
            {"$set": {
                "nom": payload.nom_agence,
                "sieges": payload.sieges,
                "zones": payload.zones,
                "directeur_prospecte": bool(payload.directeur_prospecte),
                "updated_at": now_iso,
            }},
        )
        org_action = "updated"
    else:
        org_id = ObjectId()
        await db.organisations.insert_one({
            "_id": org_id,
            "nom": payload.nom_agence,
            "sieges": int(payload.sieges),
            "zones": list(payload.zones),
            "directeur_prospecte": bool(payload.directeur_prospecte),
            "created_at": now_iso,
            "updated_at": now_iso,
        })
        org_action = "created"

    # 2) Promeut l'user
    await db.users.update_one(
        {"user_id": u["user_id"]},
        {"$set": {
            "role": "directeur",
            "organisation_id": org_id,
            "plan": "pro",
            "zones_perso": u.get("zones_perso") or payload.zones,
            "updated_at": now_iso,
        }},
    )

    # 3) Alimente le pool org (opps en `pool_org`, non encore distribuées)
    n_seed = int(payload.seed_opportunites_org or 0)
    seeded = 0
    if n_seed > 0 and payload.zones:
        cp = payload.zones[0]
        cur = db.opportunites.find(
            {"code_postal": cp, "statut": "pool"},
            {"_id": 1},
        ).limit(n_seed)
        ids = [d["_id"] async for d in cur]
        if ids:
            r = await db.opportunites.update_many(
                {"_id": {"$in": ids}},
                {"$set": {"statut": "pool_org", "organisation_id": org_id,
                          "date_pool_org": now_iso, "updated_at": now_iso}},
            )
            seeded = r.modified_count

    return {
        "ok": True,
        "email": email,
        "organisation_id": str(org_id),
        "organisation_action": org_action,
        "nom_agence": payload.nom_agence,
        "sieges": payload.sieges,
        "zones": payload.zones,
        "directeur_prospecte": payload.directeur_prospecte,
        "opportunites_pool_org_seeded": seeded,
    }


@router.post("/api/d1/admin/normaliser-plans")
async def admin_normaliser_plans(request: Request):
    """Normalise en base tous les users `pro_plus`/`pro_lifetime` → `pro`.

    B1 ne connaît que deux valeurs : `decouverte` et `pro`. Toute autre valeur
    est un vestige de l'ancienne app qui peut faire prendre un mauvais chemin
    aux vérifications de quota et d'accès à l'assistant.
    """
    _check_admin(request)
    db = _db()
    # Comptage avant
    n_pro_plus = await db.users.count_documents({"plan": "pro_plus"})
    n_pro_lifetime = await db.users.count_documents({"plan": "pro_lifetime"})
    n_other = await db.users.count_documents({
        "plan": {"$nin": ["pro", "pro_plus", "pro_lifetime", "decouverte",
                          "free", None]},
    })
    # Migration
    r_pp = await db.users.update_many(
        {"plan": "pro_plus"}, {"$set": {"plan": "pro"}}
    )
    r_pl = await db.users.update_many(
        {"plan": "pro_lifetime"}, {"$set": {"plan": "pro"}}
    )
    r_free = await db.users.update_many(
        {"plan": "free"}, {"$set": {"plan": "decouverte"}}
    )
    return {
        "before": {
            "pro_plus": n_pro_plus,
            "pro_lifetime": n_pro_lifetime,
            "autres_non_normalises": n_other,
        },
        "migrated": {
            "pro_plus_to_pro": r_pp.modified_count,
            "pro_lifetime_to_pro": r_pl.modified_count,
            "free_to_decouverte": r_free.modified_count,
        },
    }


@router.get("/api/d1/admin/diagnostic-extraction-rues")
async def admin_diagnostic_extraction_rues(code_postal: str, request: Request,
                                            limit: int = 3):
    """Diagnostic profond de l'extraction de rues pour un CP donné.

    Retourne :
      - `voies_ban_count` : nombre de voies BAN chargées pour ce CP
      - `listings_scannes` : total listings actifs
      - `rue_deja_extraite` : combien ont `rue_extraite` non-null
      - `rue_manquante` : combien ont `rue_extraite` null/absent
      - `exemples_bruts` : `limit` listings avec title/description/rue_extraite
        pour comprendre à l'œil pourquoi l'extraction échoue

    C'est le diagnostic à faire AVANT de relancer le job — si les listings
    n'ont ni title ni description, aucun run ne pourra extraire quoi que ce soit.
    """
    _check_admin(request)
    cp = (code_postal or "").strip()
    if len(cp) != 5 or not cp.isdigit():
        raise HTTPException(status_code=400, detail="code_postal_invalide")

    import httpx
    from a3.sources.ban import voies_by_postcode
    from a3.job_extract_rues import SUPABASE_URL, SUPABASE_KEY, _sb_headers

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="supabase_env_missing")

    db = _db()
    async with httpx.AsyncClient() as client:
        voies = await voies_by_postcode(client, cp, db=db)

        # Compte total actifs
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/listings",
            params={"select": "id", "postal_code": f"eq.{cp}",
                    "is_active": "eq.true", "limit": "1"},
            headers={**_sb_headers(), "Prefer": "count=exact"},
            timeout=15,
        )
        total_actifs = int(r.headers.get("content-range", "0/0").split("/")[-1] or 0)

        # Compte ceux qui ont rue_extraite déjà
        r2 = await client.get(
            f"{SUPABASE_URL}/rest/v1/listings",
            params={"select": "id", "postal_code": f"eq.{cp}",
                    "is_active": "eq.true",
                    "rue_extraite": "not.is.null", "limit": "1"},
            headers={**_sb_headers(), "Prefer": "count=exact"},
            timeout=15,
        )
        avec_rue = int(r2.headers.get("content-range", "0/0").split("/")[-1] or 0)

        # Exemples bruts
        r3 = await client.get(
            f"{SUPABASE_URL}/rest/v1/listings",
            params={"select": "id,portal,title,description,floor,rue_extraite,"
                              "etage_extrait,scraped_at",
                    "postal_code": f"eq.{cp}", "is_active": "eq.true",
                    "order": "scraped_at.desc",
                    "limit": str(max(1, min(int(limit or 3), 10)))},
            headers=_sb_headers(), timeout=15,
        )
        r3.raise_for_status()
        exemples = r3.json() or []

    return {
        "code_postal": cp,
        "voies_ban_count": len(voies),
        "listings_actifs_total": total_actifs,
        "listings_avec_rue_extraite": avec_rue,
        "listings_sans_rue": total_actifs - avec_rue,
        "couverture_actuelle_pct": round(avec_rue / total_actifs * 100, 1)
            if total_actifs else 0.0,
        "exemples_bruts": [
            {
                "id": e.get("id"),
                "portal": e.get("portal"),
                "title": (e.get("title") or "")[:200],
                "description_preview": (e.get("description") or "")[:200],
                "floor": e.get("floor"),
                "rue_extraite": e.get("rue_extraite"),
                "etage_extrait": e.get("etage_extrait"),
                "scraped_at": e.get("scraped_at"),
            }
            for e in exemples
        ],
    }


# ===========================================================================
# ONBOARDING B1 — reprise post-migration
# ===========================================================================
@router.get("/api/d1/onboarding-b1/suggestions")
async def suggestions_zones(request: Request):
    """Retourne les CP suggérés persistés ; en fallback, recalcul à la volée."""
    user = await _current_user(request)
    zs = user.get("zones_suggestions")
    if not zs:
        zs = await compute_suggested_zones(_db(), user["user_id"])
        await _db().users.update_one(
            {"user_id": user["user_id"]}, {"$set": {"zones_suggestions": zs}}
        )
    return {"zones_suggestions": zs, "zones_confirmees": bool(user.get("zones_confirmees", False))}


class ConfirmerZonesPayload(BaseModel):
    codes_postaux: list[str]


@router.post("/api/d1/onboarding-b1/confirmer-zones")
async def confirmer_zones(payload: ConfirmerZonesPayload, request: Request):
    user = await _current_user(request)
    cps: list[str] = []
    for raw in payload.codes_postaux[:2]:  # max 2 CP
        cp = (raw or "").strip()
        if len(cp) == 5 and cp.isdigit():
            cps.append(cp)
    if not cps:
        raise HTTPException(status_code=400, detail="aucun_cp_valide")
    await _db().users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "zones_perso": cps,
            "zones_confirmees": True,
            "updated_at": now_utc_iso(),
        }},
    )
    return {"ok": True, "zones_perso": cps}


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
