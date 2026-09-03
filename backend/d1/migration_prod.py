"""KOLO — Migration idempotente prod ⇄ preview.

**Contexte.** Depuis le bloc A, plusieurs fixes appliqués sur la base preview
n'ont pas été rejoués sur la prod (index `enrichissements.id_parcelle` sans
partialFilter, `html5lib` manquant côté image, `weasyprint 69.0` requis…). Ce
module scanne l'état réel de la base sur laquelle il tourne, le compare à ce
que le code attend, et applique les correctifs. Il est **strictement
idempotent** : relancé, il ne fait rien de plus, il rapporte simplement
`no_change`.

Exposé via `POST /api/d1/admin/migrer-prod` (voir `d1.routes`).

Ce que ce module gère :

1. **Indexes MongoDB** — recrée les index critiques dans le bon état :
   - `enrichissements.id_parcelle` UNIQUE PARTIEL (`{$type:"string"}`)
   - `opportunites.uniq_orga_dpe` UNIQUE PARTIEL
   - `zones_couvertes.code_postal` UNIQUE
   - `zones_demandees.uniq_user_cp` UNIQUE
   - `invitations.code` UNIQUE SPARSE
   - `device_tokens.(user_id,token)` UNIQUE
   - + tous les autres via `a2.ensure_a2_indexes` et
     `scripts.zones_scraping.ensure_indexes`.

2. **Seeds essentiels** :
   - `config_matching` (singleton A2)
   - `zones_couvertes` (75017 / 13008 / 69003 + zone démo 99999)

3. **Migration users A2** — pose `role`, `zones_perso`, `plan`, `plan_depuis`,
   `a2_migrated_at` sur les comptes legacy. N'écrase jamais un doc déjà
   migré.

4. **Diagnostic dépendances** — vérifie les versions critiques exposées via
   endpoint diag (weasyprint / html5lib) et remonte un avertissement si un
   décalage existe.

Chaque étape retourne un delta clair : ce qui a été trouvé cassé, ce qui a
été réparé, et ce qui n'a pas bougé.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Spécifications d'index attendues (source de vérité)
# Format : (collection, index_name, keys, options)
# ---------------------------------------------------------------------------
EXPECTED_INDEXES: list[tuple[str, str, list[tuple[str, int]], dict[str, Any]]] = [
    # enrichissements — LE bug qui a cassé la prod aujourd'hui
    ("enrichissements", "id_parcelle_unique_partial",
     [("id_parcelle", 1)],
     {"unique": True,
      "partialFilterExpression": {"id_parcelle": {"$type": "string"}}}),
    ("enrichissements", "date_maj_1",
     [("date_maj", 1)], {}),

    # opportunites — clé métier « 2 conseillers ne reçoivent jamais le même DPE »
    ("opportunites", "uniq_orga_dpe",
     [("organisation_id", 1), ("dpe_id", 1)],
     {"unique": True,
      "partialFilterExpression": {
          "organisation_id": {"$type": "objectId"},
          "dpe_id": {"$type": "string"},
      }}),
    ("opportunites", "dpe_id_1", [("dpe_id", 1)], {}),
    ("opportunites", "code_postal_1", [("code_postal", 1)], {}),
    ("opportunites", "statut_1", [("statut", 1)], {}),
    ("opportunites", "assigne_a_1", [("assigne_a", 1)], {}),
    ("opportunites", "user_id_1", [("user_id", 1)], {}),
    ("opportunites", "organisation_id_1_statut_1",
     [("organisation_id", 1), ("statut", 1)], {}),
    ("opportunites", "date_creation_1", [("date_creation", 1)], {}),

    # zones_couvertes
    ("zones_couvertes", "code_postal_1",
     [("code_postal", 1)], {"unique": True}),
    ("zones_couvertes", "actif_1", [("actif", 1)], {}),

    # zones_demandees
    ("zones_demandees", "uniq_user_cp",
     [("user_id", 1), ("code_postal", 1)], {"unique": True}),
    ("zones_demandees", "code_postal_1", [("code_postal", 1)], {}),
    ("zones_demandees", "notifie_1", [("notifie", 1)], {}),

    # invitations
    ("invitations", "email_1_organisation_id_1",
     [("email", 1), ("organisation_id", 1)], {}),
    ("invitations", "code_1",
     [("code", 1)], {"unique": True, "sparse": True}),
    ("invitations", "statut_1", [("statut", 1)], {}),
    ("invitations", "date_expiration_1", [("date_expiration", 1)], {}),

    # organisations
    ("organisations", "siren_1",
     [("siren", 1)], {"sparse": True}),
    ("organisations", "directeur_user_id_1", [("directeur_user_id", 1)], {}),
    ("organisations", "statut_1", [("statut", 1)], {}),

    # quotas
    ("quotas", "uniq_user_type_periode",
     [("user_id", 1), ("type", 1), ("periode", 1)], {"unique": True}),

    # rapprochements
    ("rapprochements", "dpe_id_1", [("dpe_id", 1)], {}),
    ("rapprochements", "code_postal_1", [("code_postal", 1)], {}),
    ("rapprochements", "date_traitement_1", [("date_traitement", 1)], {}),
    ("rapprochements", "decision_1", [("decision", 1)], {}),

    # estimations / conversations / signalements
    ("estimations", "user_id_1", [("user_id", 1)], {}),
    ("estimations", "date_creation_1", [("date_creation", 1)], {}),
    ("conversations", "user_id_1", [("user_id", 1)], {}),
    ("conversations", "updated_at_1", [("updated_at", 1)], {}),
    ("signalements", "user_id_1", [("user_id", 1)], {}),
    ("signalements", "date_signalement_1", [("date_signalement", 1)], {}),

    # device_tokens
    ("device_tokens", "user_id_1_token_1",
     [("user_id", 1), ("token", 1)], {"unique": True}),
    ("device_tokens", "token_1", [("token", 1)], {}),

    # events
    ("events", "user_id_1", [("user_id", 1)], {}),
    ("events", "nom_1", [("nom", 1)], {}),
    ("events", "date_1", [("date", 1)], {}),

    # zones_scraping (webhook Apify)
    ("zones_scraping", "postal_code_1_source_1",
     [("postal_code", 1), ("source", 1)], {}),
    ("zones_scraping", "last_ingest_at_-1", [("last_ingest_at", -1)], {}),

    # jobs_runs (traçabilité scheduler)
    ("jobs_runs", "job_1_start_-1", [("job", 1), ("start", -1)], {}),
]


# ---------------------------------------------------------------------------
# Zones production seed (idempotent — n'écrase jamais l'existant)
# ---------------------------------------------------------------------------
PROD_ZONES_SEED = [
    {"code_postal": "75017", "volume_attendu": 1300, "demo": False},
    {"code_postal": "13008", "volume_attendu": 800, "demo": False},
    {"code_postal": "69003", "volume_attendu": 700, "demo": False},
    {"code_postal": "99999", "volume_attendu": 4, "demo": True},
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _keys_dict(keys_list: list[tuple[str, int]]) -> dict:
    return {k: v for k, v in keys_list}


def _extract_options(idx_info: dict) -> dict:
    """Ne garde que les options structurantes pour la comparaison."""
    opts: dict[str, Any] = {}
    for k in ("unique", "sparse", "partialFilterExpression",
              "expireAfterSeconds"):
        if k in idx_info:
            opts[k] = idx_info[k]
    return opts


def _options_match(expected: dict, actual: dict) -> bool:
    """Comparaison stricte : mêmes clés, mêmes valeurs. `unique/sparse` sont
    considérés absents == False. `partialFilterExpression` doit matcher au bit
    près."""
    def _norm(o: dict) -> dict:
        n = dict(o)
        n.setdefault("unique", False)
        n.setdefault("sparse", False)
        return n
    return _norm(expected) == _norm(actual)


async def _diagnose_indexes(db) -> tuple[list[dict], list[dict]]:
    """Retourne (fixes_needed, already_ok). Chaque entry : {collection, name,
    keys, expected, actual|None, reason}."""
    fixes: list[dict] = []
    ok: list[dict] = []
    for coll, name, keys, opts in EXPECTED_INDEXES:
        expected_keys = _keys_dict(keys)
        try:
            existing = await db[coll].index_information()
        except Exception as e:
            fixes.append({
                "collection": coll, "index": name, "reason": "cannot_read_indexes",
                "error": f"{type(e).__name__}: {e}",
            })
            continue

        # Cherche un index qui matche les KEYS (pas forcément le nom)
        found_match: dict | None = None
        found_name = None
        for existing_name, info in existing.items():
            existing_keys = _keys_dict(info.get("key") or [])
            if existing_keys == expected_keys:
                found_match = _extract_options(info)
                found_name = existing_name
                break

        if found_match is None:
            fixes.append({
                "collection": coll, "index": name, "keys": keys,
                "reason": "missing",
            })
            continue

        if not _options_match(opts, found_match):
            fixes.append({
                "collection": coll, "index": name, "keys": keys,
                "existing_name": found_name,
                "expected_options": opts, "actual_options": found_match,
                "reason": "options_mismatch",
            })
            continue

        ok.append({"collection": coll, "index": found_name})
    return fixes, ok


async def _apply_index_fixes(db, fixes: list[dict]) -> list[dict]:
    """Applique les fixes. Chaque fix qui échoue est rapporté sans stopper le
    reste (souvent un fix ratera si un ancien index bloque — on drop + retry)."""
    applied: list[dict] = []
    for f in fixes:
        coll = f["collection"]
        name = f["index"]
        keys = f.get("keys") or []
        existing_name = f.get("existing_name")
        # Retrouver les options depuis EXPECTED_INDEXES
        target_opts: dict = {}
        for c, n, k, o in EXPECTED_INDEXES:
            if c == coll and n == name:
                target_opts = dict(o)
                break

        step = {"collection": coll, "index": name, "reason": f["reason"]}
        try:
            # Drop l'ancien index avec les mêmes keys si options mismatch
            if existing_name and existing_name != "_id_":
                try:
                    await db[coll].drop_index(existing_name)
                    step["dropped"] = existing_name
                except Exception as e:
                    step["drop_error"] = f"{type(e).__name__}: {e}"

            # Créer le nouvel index
            keys_pymongo = [(k, v) for k, v in keys]
            create_kwargs = dict(target_opts)
            create_kwargs["name"] = name
            created_name = await db[coll].create_index(keys_pymongo, **create_kwargs)
            step["created"] = created_name
            step["status"] = "ok"
        except Exception as e:
            step["status"] = "failed"
            step["error"] = f"{type(e).__name__}: {e}"
        applied.append(step)
    return applied


# ---------------------------------------------------------------------------
# Seeds
# ---------------------------------------------------------------------------
async def _seed_zones_couvertes(db) -> dict:
    """Idempotent : upsert zones de prod SANS écraser `actif` si déjà positionné."""
    now_iso = _now_iso()
    created = 0
    updated_meta = 0
    unchanged = 0
    for z in PROD_ZONES_SEED:
        cp = z["code_postal"]
        existing = await db.zones_couvertes.find_one({"code_postal": cp})
        if not existing:
            await db.zones_couvertes.insert_one({
                "code_postal": cp,
                "actif": True,
                "volume_attendu": z["volume_attendu"],
                "demo": z["demo"],
                "created_at": now_iso,
                "updated_at": now_iso,
            })
            created += 1
        else:
            # N'écrase JAMAIS `actif` — respect de l'état choisi côté admin.
            patch = {}
            if existing.get("volume_attendu") is None:
                patch["volume_attendu"] = z["volume_attendu"]
            if existing.get("demo") is None:
                patch["demo"] = z["demo"]
            if patch:
                patch["updated_at"] = now_iso
                await db.zones_couvertes.update_one(
                    {"code_postal": cp}, {"$set": patch}
                )
                updated_meta += 1
            else:
                unchanged += 1
    total = await db.zones_couvertes.count_documents({})
    return {"created": created, "updated_meta": updated_meta,
            "unchanged": unchanged, "total_after": total}


async def _seed_config_matching(db) -> dict:
    from a2.config import ensure_config_seeded, CONFIG_ID
    before = await db.config_matching.find_one({"_id": CONFIG_ID})
    before_keys = set((before or {}).keys())
    await ensure_config_seeded(db)
    after = await db.config_matching.find_one({"_id": CONFIG_ID})
    after_keys = set((after or {}).keys())
    added = sorted(after_keys - before_keys)
    return {
        "existed_before": bool(before),
        "keys_added": added,
        "total_keys": len(after_keys),
    }


# ---------------------------------------------------------------------------
# Diagnostic dépendances (lecture seule — ne modifie rien)
# ---------------------------------------------------------------------------
def _diagnose_dependencies() -> dict:
    """Vérifie que les paquets Python critiques sont chargeables + version."""
    out: dict[str, Any] = {}
    for pkg, expected in [
        ("weasyprint", "69.0"),
        ("html5lib", None),  # présence seule (Bloc C)
        ("pydyf", None),
        ("pyphen", None),
        ("fonttools", None),
        ("apscheduler", None),
        ("pytz", None),
    ]:
        try:
            mod = __import__(pkg)
            version = getattr(mod, "__version__", None)
            entry: dict[str, Any] = {"loaded": True, "version": version}
            if expected and version and version != expected:
                entry["warning"] = f"version {version} != attendu {expected}"
            out[pkg] = entry
        except Exception as e:
            out[pkg] = {"loaded": False, "error": f"{type(e).__name__}: {e}"}
    return out


# ---------------------------------------------------------------------------
# Migration users A2 (idempotente — délègue au script)
# ---------------------------------------------------------------------------
async def _migrate_users_a2(db) -> dict:
    """Réutilise `_build_patch` du script CLI pour poser role/plan/zones_perso
    sur les comptes legacy. N'écrase JAMAIS un doc déjà migré."""
    from a2.migration_users import _build_patch, VALID_ROLES
    total = await db.users.count_documents({})
    patched = 0
    already_ok = 0
    async for user in db.users.find({}):
        set_fields, unset_fields = _build_patch(user)
        if not set_fields and not unset_fields:
            already_ok += 1
            continue
        update: dict = {}
        if set_fields:
            update["$set"] = set_fields
        if unset_fields:
            update["$unset"] = unset_fields
        await db.users.update_one({"_id": user["_id"]}, update)
        patched += 1
    remaining_invalid = await db.users.count_documents(
        {"role": {"$nin": list(VALID_ROLES)}}
    )
    return {"total": total, "patched": patched, "already_ok": already_ok,
            "remaining_invalid_role": remaining_invalid}


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------
async def migrer_prod(db) -> dict:
    """Applique TOUTES les migrations en une passe idempotente.

    Retourne :
    {
      "started_at": "...", "finished_at": "...",
      "indexes": {
        "fixes_needed_before": [...],
        "applied": [...],
        "already_ok_count": N,
        "verified_after": true
      },
      "seeds": {
        "zones_couvertes": {...},
        "config_matching": {...}
      },
      "users_migration": {...},
      "dependencies": {...},
      "zones_scraping_indexes": [...],
      "summary": "..."
    }
    """
    started = _now_iso()
    report: dict[str, Any] = {"started_at": started}

    # 1) Diagnostic + fix des indexes
    logger.info("[migrer-prod] STEP 1/5 — diagnostic indexes")
    fixes, ok = await _diagnose_indexes(db)
    applied = await _apply_index_fixes(db, fixes) if fixes else []

    # Re-diagnostic pour vérifier que tout est OK maintenant
    logger.info("[migrer-prod] STEP 1b — re-vérif indexes après fix")
    fixes_after, ok_after = await _diagnose_indexes(db)
    report["indexes"] = {
        "fixes_needed_before": fixes,
        "applied": applied,
        "already_ok_count": len(ok),
        "still_broken_after": fixes_after,
        "verified_ok_after_count": len(ok_after),
    }

    # 2) Indexes zones_scraping (utilisés par le webhook Apify)
    logger.info("[migrer-prod] STEP 2/5 — indexes zones_scraping")
    try:
        from scripts.zones_scraping import ensure_indexes as ensure_zs
        await ensure_zs(db)
        report["zones_scraping_indexes"] = "ok"
    except Exception as e:
        report["zones_scraping_indexes"] = f"failed: {type(e).__name__}: {e}"

    # 3) Seeds
    logger.info("[migrer-prod] STEP 3/5 — seeds")
    report["seeds"] = {
        "config_matching": await _seed_config_matching(db),
        "zones_couvertes": await _seed_zones_couvertes(db),
    }

    # 4) Migration users A2
    logger.info("[migrer-prod] STEP 4/5 — migration users A2")
    try:
        report["users_migration"] = await _migrate_users_a2(db)
    except Exception as e:
        report["users_migration"] = {"error": f"{type(e).__name__}: {e}"}

    # 5) Diagnostic dépendances
    logger.info("[migrer-prod] STEP 5/5 — diagnostic dépendances Python")
    report["dependencies"] = _diagnose_dependencies()

    # Résumé
    report["finished_at"] = _now_iso()
    total_index_fixes = len([a for a in applied if a.get("status") == "ok"])
    still_broken = len(fixes_after)
    report["summary"] = (
        f"{total_index_fixes} index recréé(s) · "
        f"{still_broken} index encore cassé(s) · "
        f"zones_couvertes créées={report['seeds']['zones_couvertes']['created']} · "
        f"users patchés={report['users_migration'].get('patched', 0)}"
    )
    logger.info(f"[migrer-prod] TERMINÉ — {report['summary']}")
    return report
