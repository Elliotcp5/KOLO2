"""
KOLO — Accessor `config_matching` (Session A2)
==============================================

Document unique et modifiable en base. AUCUN seuil ne doit apparaître en dur dans
le code — tout se lit via `get_config()`. Un cache mémoire courte durée (30s) évite
d'aller taper Mongo à chaque appel de `verifier_quota` par exemple.

Endpoints exposés :
  - GET   /api/admin/config-matching   (voir a2/routes.py)
  - PATCH /api/admin/config-matching
"""
from __future__ import annotations

import copy
import time
from typing import Any, Optional

CONFIG_ID = "singleton"
CACHE_TTL_SECONDS = 30

# ---------------------------------------------------------------------------
# Valeurs par défaut — utilisées UNIQUEMENT lors du premier boot pour peupler
# la collection. Après ça, la vérité vit dans la collection.
# ---------------------------------------------------------------------------
DEFAULT_CONFIG: dict[str, Any] = {
    "_id": CONFIG_ID,
    "fenetre_dpe_jours": 62,
    "tolerance_surface_pct": 0.08,
    "tolerance_surface_plancher_m2": 4,
    "poids": {
        "rue": 0.35,
        "surface": 0.30,
        "classe_energie": 0.20,
        "type_bien": 0.10,
        "etage": 0.05,
    },
    "seuil_correspondance": 0.75,
    "seuil_correspondance_location": 0.80,
    "seuil_publication": 0.70,
    "score_ban_minimum": 0.8,
    "fraicheur": {"jours_plein": 3, "jours_degrade": 7},
    "facteur_location_perime": 0.85,
    "plafond_cumul_cartes": 15,
    "marge_negociation": 0.04,
    "duree_validite_dossier_mois": 3,
    "quotas": {
        # `quotidien`, `hebdo`, `mensuel` ou `illimite` (chaîne)
        "decouverte": {
            "opportunite": {"kind": "hebdo", "limite": 1},
            "estimation": {"kind": "hebdo", "limite": 1},
            "dossier": {"kind": "mensuel", "limite": 1},
        },
        "pro": {
            "opportunite": {"kind": "quotidien", "limite": 5},
            "estimation": {"kind": "hebdo", "limite": "illimite"},
            "dossier": {"kind": "mensuel", "limite": "illimite"},
        },
        "agence": {
            "opportunite": {"kind": "quotidien", "limite": 5},
            "estimation": {"kind": "hebdo", "limite": "illimite"},
            "dossier": {"kind": "mensuel", "limite": "illimite"},
        },
    },
}


class _Cache:
    value: Optional[dict[str, Any]] = None
    fetched_at: float = 0.0


_CACHE = _Cache()


def _bust_cache() -> None:
    _CACHE.value = None
    _CACHE.fetched_at = 0.0


async def ensure_config_seeded(db) -> None:
    """Insère `DEFAULT_CONFIG` si le document n'existe pas encore.

    Idempotent — n'écrase aucune valeur existante.
    """
    existing = await db.config_matching.find_one({"_id": CONFIG_ID})
    if existing is None:
        await db.config_matching.insert_one(copy.deepcopy(DEFAULT_CONFIG))
    _bust_cache()


async def get_config(db) -> dict[str, Any]:
    """Retourne la config en cours (avec cache mémoire 30s)."""
    now = time.monotonic()
    if _CACHE.value is not None and (now - _CACHE.fetched_at) < CACHE_TTL_SECONDS:
        return copy.deepcopy(_CACHE.value)
    doc = await db.config_matching.find_one({"_id": CONFIG_ID})
    if doc is None:
        await ensure_config_seeded(db)
        doc = await db.config_matching.find_one({"_id": CONFIG_ID})
    _CACHE.value = copy.deepcopy(doc or {})
    _CACHE.fetched_at = now
    return copy.deepcopy(_CACHE.value)


async def patch_config(db, updates: dict[str, Any]) -> dict[str, Any]:
    """Applique un patch partiel. Reconstruit le document via `$set` profond.

    Empêche l'écrasement complet de sous-objets si l'appelant ne fournit qu'une
    clé (ex: patcher `poids.rue` = 0.4 ne doit pas effacer les autres poids).
    """
    flat_set = _flatten_for_set(updates)
    if not flat_set:
        return await get_config(db)
    await db.config_matching.update_one(
        {"_id": CONFIG_ID},
        {"$set": flat_set},
        upsert=True,
    )
    _bust_cache()
    return await get_config(db)


def _flatten_for_set(obj: dict[str, Any], prefix: str = "") -> dict[str, Any]:
    """Aplati `{poids: {rue: 0.4}}` → `{"poids.rue": 0.4}` pour un `$set` profond."""
    out: dict[str, Any] = {}
    for k, v in obj.items():
        if k in ("_id", "id"):
            continue
        key = f"{prefix}{k}"
        if isinstance(v, dict) and v and all(isinstance(kk, str) for kk in v.keys()):
            out.update(_flatten_for_set(v, key + "."))
        else:
            out[key] = v
    return out
