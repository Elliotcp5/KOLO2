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
    # Multiplicateur géographique — applique EN DEHORS de la somme pondérée
    # (cf. a3/matching.compute_multiplicateur_geo). Ne bonifie jamais ;
    # peut neutraliser (0.0 court-circuit) ou pénaliser partiellement.
    "multiplicateur_geo": {
        "mult_ecart_prix_25_40": 0.7,
        "seuil_prix_penalite": 0.25,       # ratio |écart|/médiane
        "seuil_prix_court_circuit": 0.40,
    },
    "seuil_correspondance": 0.75,
    "seuil_correspondance_location": 0.80,
    "seuil_publication": 0.70,
    "score_ban_minimum": 0.8,
    "s_rue_defaut_null": 0.5,
    "fraicheur": {"jours_plein": 3, "jours_degrade": 7},
    "facteur_location_perime": 0.85,
    "plafond_cumul_cartes": 15,
    "marge_negociation": 0.04,
    "duree_validite_dossier_mois": 3,
    # ---------------------------------------------------------------------
    # Veille des biens en vente (BLOC B) — cartes de type distinct.
    # Voir /app/memory/B1_VEILLE_COPY_FR.md.
    # ---------------------------------------------------------------------
    "veille": {
        # Signal minimum : au moins un des deux critères doit être vrai
        # pour qu'un bien `deja_en_vente` devienne carte de veille.
        "min_days_on_market": 90,
        # Plafond d'ancienneté au-delà duquel days_on_market cesse d'ajouter
        # au score : 6 mois. La baisse de prix reste le signal fort.
        "dom_cap_days": 180,
        # Poids d'une baisse de prix dans le score de tri.
        "price_drop_weight": 2,
        # Seuil de quota du jour SOUS lequel la pile de veille s'affiche.
        # Si l'utilisateur a >= 3 opportunités de mandat, on ne montre pas
        # la pile de veille (elle ne comble pas une zone pauvre).
        "seuil_quota_du_jour": 3,
        # Nombre maximum de cartes de veille par jour.
        "max_par_jour": 5,
    },
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
    # -----------------------------------------------------------------
    # B3 — Streak d'activité + plafond de notifications
    # -----------------------------------------------------------------
    "streak": {
        "objectif": 7,       # jours consécutifs pour débloquer une opportunité bonus
        "seuil_notif": 3,    # streak minimum avant d'envoyer une notif de 20h00
    },
    "notif": {
        "plafond_journalier": 5,       # max notifs / utilisateur / jour
        "horaires_rappels": [9, 11, 14, 17],   # heures locales Paris
        "heure_streak": 20,
        "heure_decouverte_relance": 18,
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

    Idempotent — n'écrase aucune valeur existante, mais **ajoute** les nouvelles
    clés introduites après le premier seed (ex. bloc `veille` en B/veille).
    """
    existing = await db.config_matching.find_one({"_id": CONFIG_ID})
    if existing is None:
        await db.config_matching.insert_one(copy.deepcopy(DEFAULT_CONFIG))
    else:
        # Ajout non destructif des clés absentes (ex. `veille`).
        to_add: dict[str, Any] = {}
        for k, v in DEFAULT_CONFIG.items():
            if k in ("_id",):
                continue
            if k not in existing:
                to_add[k] = copy.deepcopy(v)
        if to_add:
            await db.config_matching.update_one(
                {"_id": CONFIG_ID}, {"$set": to_add}
            )
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
