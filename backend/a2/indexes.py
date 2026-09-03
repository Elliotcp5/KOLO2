"""
KOLO — Ensure indexes A2 (Session A2)
=====================================

Idempotent — appelé au startup FastAPI et exposé via l'endpoint admin de
migration. Chaque collection A2 est provisionnée avec les indexes strictement
nécessaires à ses accès.

Les contraintes structurantes du produit sont ici, en particulier la règle
    « deux conseillers d'une même agence ne reçoivent jamais la même opportunité »
qui prend la forme d'un index unique partiel sur (organisation_id, dpe_id).
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def ensure_a2_indexes(db) -> dict[str, list[str]]:
    """Crée/vérifie les indexes de toutes les collections A2.

    Retourne `{collection: [index_names]}` pour observabilité.
    """
    created: dict[str, list[str]] = {}

    # ---- organisations -----------------------------------------------------
    created["organisations"] = [
        await db.organisations.create_index("siren", unique=False, sparse=True),
        await db.organisations.create_index("directeur_user_id"),
        await db.organisations.create_index("statut"),
    ]

    # ---- invitations -------------------------------------------------------
    created["invitations"] = [
        await db.invitations.create_index([("email", 1), ("organisation_id", 1)]),
        await db.invitations.create_index("code", unique=True, sparse=True),
        await db.invitations.create_index("statut"),
        await db.invitations.create_index("date_expiration"),
    ]

    # ---- opportunites ------------------------------------------------------
    created["opportunites"] = [
        # Règle métier : "2 conseillers d'une même agence ne reçoivent jamais
        # la même opportunité". Index unique PARTIEL — organisation_id null
        # (indépendants) est exempt. Pour dpe_id null (opportunités virtuelles),
        # on n'applique pas non plus l'unicité.
        await db.opportunites.create_index(
            [("organisation_id", 1), ("dpe_id", 1)],
            unique=True,
            partialFilterExpression={
                "organisation_id": {"$type": "objectId"},
                "dpe_id": {"$type": "string"},
            },
            name="uniq_orga_dpe",
        ),
        await db.opportunites.create_index("dpe_id"),
        await db.opportunites.create_index("code_postal"),
        await db.opportunites.create_index("statut"),
        await db.opportunites.create_index("assigne_a"),
        await db.opportunites.create_index("user_id"),
        await db.opportunites.create_index([("organisation_id", 1), ("statut", 1)]),
        await db.opportunites.create_index("date_creation"),
    ]

    # ---- zones_couvertes (zones commerciales servies) ----------------------
    created["zones_couvertes"] = [
        await db.zones_couvertes.create_index("code_postal", unique=True),
        await db.zones_couvertes.create_index("actif"),
    ]

    # ---- zones_demandees ---------------------------------------------------
    created["zones_demandees"] = [
        await db.zones_demandees.create_index(
            [("user_id", 1), ("code_postal", 1)], unique=True, name="uniq_user_cp",
        ),
        await db.zones_demandees.create_index("code_postal"),
        await db.zones_demandees.create_index("notifie"),
    ]

    # ---- quotas ------------------------------------------------------------
    created["quotas"] = [
        await db.quotas.create_index(
            [("user_id", 1), ("type", 1), ("periode", 1)],
            unique=True,
            name="uniq_user_type_periode",
        ),
    ]

    # ---- rapprochements ----------------------------------------------------
    created["rapprochements"] = [
        await db.rapprochements.create_index("dpe_id"),
        await db.rapprochements.create_index("code_postal"),
        await db.rapprochements.create_index("date_traitement"),
        await db.rapprochements.create_index("decision"),
    ]

    # ---- enrichissements ---------------------------------------------------
    # Index unique PARTIEL — un enrichissement peut avoir `id_parcelle=null`
    # (échec de résolution cadastre) ; on ne veut pas que le 2e doc null
    # échoue avec DuplicateKeyError. L'unicité ne s'applique qu'aux vrais
    # id_parcelle (strings). En prod, si un ancien index `id_parcelle_1`
    # sans partialFilter existe, `migrer-prod` (POST /api/d1/admin/migrer-prod)
    # se charge de le drop + recréer proprement.
    created["enrichissements"] = [
        await db.enrichissements.create_index(
            "id_parcelle",
            unique=True,
            partialFilterExpression={"id_parcelle": {"$type": "string"}},
            name="id_parcelle_unique_partial",
        ),
        await db.enrichissements.create_index("date_maj"),
    ]

    # ---- estimations / conversations / signalements (schéma seul) ----------
    created["estimations"] = [
        await db.estimations.create_index("user_id"),
        await db.estimations.create_index("date_creation"),
    ]
    created["conversations"] = [
        await db.conversations.create_index("user_id"),
        await db.conversations.create_index("updated_at"),
    ]
    created["signalements"] = [
        await db.signalements.create_index("user_id"),
        await db.signalements.create_index("date_signalement"),
    ]

    # ---- device_tokens -----------------------------------------------------
    created["device_tokens"] = [
        await db.device_tokens.create_index([("user_id", 1), ("token", 1)], unique=True),
        await db.device_tokens.create_index("token"),
    ]

    # ---- events (traçage produit) -----------------------------------------
    created["events"] = [
        await db.events.create_index("user_id"),
        await db.events.create_index("nom"),
        await db.events.create_index("date"),
    ]

    # ---- config_matching (singleton) --------------------------------------
    # _id textuel "singleton" — Mongo garantit l'unicité de _id nativement.

    for coll, names in created.items():
        logger.info(f"a2.ensure_indexes: {coll} → {names}")
    return created
