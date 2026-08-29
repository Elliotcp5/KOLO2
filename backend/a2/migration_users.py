"""
KOLO — Migration users A2 (idempotente)
=======================================

Rattrape les ~186 comptes existants pour qu'ils portent la nouvelle structure
de champs demandée par la Session A2. Ne modifie AUCUN document qui a déjà été
migré (idempotent — relançable).

Usage :
    cd /app/backend
    python -m a2.migration_users --dry-run
    python -m a2.migration_users            # exécute la migration

Champs posés :
    role                 = "independant"      (uniquement si absent/invalide)
    role_v1_legacy       = <ancienne valeur>  (préserve la donnée libre)
    organisation_id      = None
    siege_statut         = "actif"
    zones_perso          = []                 (max 2 CP, indépendants seulement)
    zones_deja_modifiees = False
    plan                 = "decouverte" | "pro" | "agence"   (déduit)
    plan_depuis          = created_at
    onboarding_infos_ok  = True
    tour_guide_vu        = True
    taux_honoraires      = <inchangé si présent, absent sinon>
    honoraires_charge    = <inchangé si présent, absent sinon>
    grille_ponderation   = <inchangée si présente, {} sinon>
    infos_pro            = <inchangée si présente, {} sinon>
    prenom               = user.first_name (rétro-compat)
    nom                  = user.last_name  (rétro-compat)
    statut_declare       = "directeur" si role_v1_legacy contient 'directeur', sinon "agent"
    a2_migrated_at       = ISO now  (sentinelle pour retrouver les docs migrés)
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except Exception:
    pass

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("a2.migration_users")

VALID_ROLES = {"independant", "directeur", "conseiller"}


def _deduce_plan(user: dict) -> str:
    """Déduit le plan A2 depuis les données legacy."""
    # Ordre de priorité : pro_lifetime > organisation_id > plan legacy > free
    if user.get("pro_lifetime"):
        return "pro"
    if user.get("organisation_id"):
        return "agence"
    legacy = (user.get("plan") or "").lower().strip()
    if legacy in ("pro", "pro_plus", "pro_lifetime"):
        return "pro"
    if legacy in ("agence",):
        return "agence"
    if legacy in ("decouverte", "découverte"):
        return "decouverte"
    return "decouverte"


def _deduce_statut_declare(user: dict) -> str:
    legacy_role = (user.get("role_v1_legacy") or user.get("role") or "").lower()
    if "directeur" in legacy_role or "directrice" in legacy_role:
        return "directeur"
    return "agent"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_patch(user: dict) -> tuple[dict, dict]:
    """Retourne (set, unset) pour ce user, ou ({}, {}) si déjà migré."""
    set_fields: dict = {}
    unset_fields: dict = {}

    current_role = (user.get("role") or "").strip()

    # 1) role — n'écrase que si invalide/absent
    if current_role not in VALID_ROLES:
        if current_role and not user.get("role_v1_legacy"):
            set_fields["role_v1_legacy"] = current_role
        set_fields["role"] = "independant"

    # 2) organisation_id
    if "organisation_id" not in user:
        set_fields["organisation_id"] = None

    # 3) siege_statut
    if "siege_statut" not in user:
        set_fields["siege_statut"] = "actif"

    # 4) zones_perso — renommage éventuel depuis zones_couvertes (ancien nom user)
    if "zones_perso" not in user:
        if "zones_couvertes" in user and isinstance(user["zones_couvertes"], list):
            # Rétro-compat : renomme et cap à 2 CP pour les indépendants
            set_fields["zones_perso"] = list(user["zones_couvertes"])[:2]
            unset_fields["zones_couvertes"] = ""
        else:
            set_fields["zones_perso"] = []

    # 5) zones_deja_modifiees
    if "zones_deja_modifiees" not in user:
        set_fields["zones_deja_modifiees"] = False

    # 6) plan — DÉDUCTION
    computed_plan = _deduce_plan(user)
    if user.get("plan") not in ("decouverte", "pro", "agence"):
        # On préserve la valeur legacy si elle apporte de l'info
        legacy_plan = user.get("plan")
        if legacy_plan and legacy_plan not in ("decouverte", "pro", "agence") and not user.get("plan_v1_legacy"):
            set_fields["plan_v1_legacy"] = legacy_plan
        set_fields["plan"] = computed_plan

    # 7) plan_depuis
    if "plan_depuis" not in user:
        set_fields["plan_depuis"] = user.get("created_at") or _now_iso()

    # 8) onboarding_infos_ok / tour_guide_vu (backfill : ils ont déjà vu l'app)
    if "onboarding_infos_ok" not in user:
        set_fields["onboarding_infos_ok"] = True
    if "tour_guide_vu" not in user:
        set_fields["tour_guide_vu"] = True

    # 9) champs métier initialisés à vide
    if "grille_ponderation" not in user:
        set_fields["grille_ponderation"] = {}
    if "infos_pro" not in user:
        set_fields["infos_pro"] = {}

    # 10) prenom / nom (rétro-compat avec first_name / last_name)
    if "prenom" not in user and user.get("first_name"):
        set_fields["prenom"] = user["first_name"]
    if "nom" not in user and user.get("last_name"):
        set_fields["nom"] = user["last_name"]

    # 11) statut_declare
    if "statut_declare" not in user:
        set_fields["statut_declare"] = _deduce_statut_declare(user)

    # Sentinelle finale
    if set_fields or unset_fields:
        set_fields["a2_migrated_at"] = _now_iso()

    return set_fields, unset_fields


async def migrate(dry_run: bool = False, limit: int | None = None) -> dict:
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        return {"error": "MONGO_URL / DB_NAME missing"}

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    total = await db.users.count_documents({})
    logger.info(f"users total = {total}")

    scanned = 0
    patched = 0
    already_ok = 0
    async for user in db.users.find({}):
        scanned += 1
        set_fields, unset_fields = _build_patch(user)
        if not set_fields and not unset_fields:
            already_ok += 1
        else:
            if dry_run:
                patched += 1
            else:
                update = {}
                if set_fields:
                    update["$set"] = set_fields
                if unset_fields:
                    update["$unset"] = unset_fields
                await db.users.update_one({"_id": user["_id"]}, update)
                patched += 1
        if limit and scanned >= limit:
            break

    # ---- contrôle post-migration : aucun `role` ne doit rester invalide -----
    remaining_invalid = 0
    if not dry_run:
        async for u in db.users.find(
            {"role": {"$nin": list(VALID_ROLES)}}, {"_id": 1}
        ):
            _ = u
            remaining_invalid += 1

    return {
        "total": total,
        "scanned": scanned,
        "patched": patched,
        "already_ok": already_ok,
        "remaining_invalid_role": remaining_invalid,
        "dry_run": dry_run,
    }


def _main():
    parser = argparse.ArgumentParser(description="Migration users A2 (idempotente)")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    result = asyncio.run(migrate(dry_run=args.dry_run, limit=args.limit))
    print(result)


if __name__ == "__main__":
    _main()
