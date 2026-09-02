"""Backfill etage_dpe sur les opportunités déjà en base + analyse d'impact.

Contexte : la regex `_ETAGE_COMPLEMENT_RE` a longtemps échoué sur le format
`Etage : 6` (le `\\s*` ne matchait pas le `:`). Conséquence : le sous-score
« étage » du moteur d'opportunités a toujours renvoyé 0,5 (info manquante),
le poids 0,05 n'a donc jamais rien discriminé.

Ce script :
  1. Passe la nouvelle regex sur `caracteristiques.complement_adresse` de
     toutes les opportunités où `caracteristiques.etage_dpe` est absent.
  2. Met à jour les documents concernés.
  3. Rapport : nb opps mises à jour, taux de remplissage avant/après.
  4. Analyse d'impact rapprochements : combien de décisions AURAIENT changé
     si le moteur était rejoué avec le champ corrigé (zone de bascule
     ±0,025 autour des seuils 0,75 vente et 0,80 location).

Idempotent — un second passage ne modifie rien puisqu'on ne re-parse que
les documents où `etage_dpe` est encore absent.

Usage :
    python -m scripts.backfill_etage_dpe --dry-run    # rapport sans écrire
    python -m scripts.backfill_etage_dpe              # écrit les updates
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from typing import Any

# Charge le .env AVANT d'importer les modules qui lisent os.environ
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")

sys.path.insert(0, "/app/backend")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from a3.job_generer_opportunites import _etage_dpe_from_complement  # noqa: E402


THRESHOLD_VENTE = 0.75
THRESHOLD_LOCATION = 0.80
POIDS_ETAGE = 0.05
DELTA_MAX = POIDS_ETAGE * 1.0  # score peut varier de 0.025 en + ou -


def _classify_flip(meilleur_score: float, seuil: float) -> str:
    """Retourne 'flip_up', 'flip_down', ou 'stable'.

    - flip_up   : score < seuil actuellement, pourrait passer au-dessus si +0.025
    - flip_down : score >= seuil actuellement, pourrait passer en-dessous si −0.025
    - stable    : hors zone de bascule
    """
    delta = 0.5 * DELTA_MAX  # écart possible = poids × (1.0 - 0.5) = 0.025
    if meilleur_score is None:
        return "stable"
    if seuil - delta <= meilleur_score < seuil:
        return "flip_up"
    if seuil <= meilleur_score < seuil + delta:
        return "flip_down"
    return "stable"


async def _connect():
    url = os.environ["MONGO_URL"]
    dbname = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(url)
    return client, client[dbname]


async def backfill(dry_run: bool = False) -> dict[str, Any]:
    _, db = await _connect()

    # 1) Taux de remplissage AVANT (sur les opps ayant un complement_adresse)
    total_avec_complement = await db.opportunites.count_documents({
        "caracteristiques.complement_adresse": {"$nin": [None, ""]},
    })
    rempli_avant = await db.opportunites.count_documents({
        "caracteristiques.complement_adresse": {"$nin": [None, ""]},
        "caracteristiques.etage_dpe": {"$type": "int"},
    })

    # 2) Backfill
    cur = db.opportunites.find(
        {
            "caracteristiques.complement_adresse": {"$nin": [None, ""]},
            "$or": [
                {"caracteristiques.etage_dpe": None},
                {"caracteristiques.etage_dpe": {"$exists": False}},
            ],
        },
        {"_id": 1, "dpe_id": 1, "caracteristiques.complement_adresse": 1},
    )
    a_mettre_a_jour = 0
    par_valeur: dict[int, int] = {}
    updates_bulk: list[dict] = []
    async for doc in cur:
        complement = (doc.get("caracteristiques") or {}).get("complement_adresse")
        etage = _etage_dpe_from_complement(complement)
        if etage is None:
            continue
        a_mettre_a_jour += 1
        par_valeur[etage] = par_valeur.get(etage, 0) + 1
        updates_bulk.append({"_id": doc["_id"], "etage": etage})

    if not dry_run and updates_bulk:
        # Bulk update par lots de 500
        from pymongo import UpdateOne
        ops = [
            UpdateOne(
                {"_id": u["_id"]},
                {"$set": {"caracteristiques.etage_dpe": u["etage"]}},
            )
            for u in updates_bulk
        ]
        for i in range(0, len(ops), 500):
            await db.opportunites.bulk_write(ops[i:i + 500], ordered=False)

    # 3) Taux de remplissage APRÈS
    if dry_run:
        rempli_apres = rempli_avant + a_mettre_a_jour
    else:
        rempli_apres = await db.opportunites.count_documents({
            "caracteristiques.complement_adresse": {"$nin": [None, ""]},
            "caracteristiques.etage_dpe": {"$type": "int"},
        })

    # 4) Analyse d'impact sur les rapprochements — UPPER BOUND.
    #    On ne peut pas savoir a posteriori dans quels rapprochements le DPE
    #    (côté regex-buggé) avait effectivement un étage extractible depuis
    #    `complement_adresse` (les rapprochements ne stockent que `adresse_dpe`,
    #    pas le complement). On donne donc un PLAFOND : tous les rapprochements
    #    où `breakdown.etage == 0.5` ET dont le score tombe dans la zone de
    #    bascule autour du seuil.
    #
    #    C'est un upper bound car un DPE sans étage AUCUN dans complement_adresse
    #    ne bougera pas — mais on ne peut pas les distinguer sans re-fetch ADEME.
    impact = {
        "vente_flip_up": 0,      # score < 0.75, gagne 0.025 → deja_en_vente
        "vente_flip_down": 0,    # score >= 0.75, perd 0.025 → non deja_en_vente
        "location_flip_up": 0,
        "location_flip_down": 0,
        "stables_hors_bascule": 0,
        "rapprochements_scannes": 0,
    }

    async for rapp in db.rapprochements.find(
        {"breakdown.etage": 0.5},
        {
            "_id": 0, "dpe_id": 1, "decision": 1,
            "meilleur_score_vente": 1, "meilleur_score_location": 1,
        },
    ):
        impact["rapprochements_scannes"] += 1
        v_class = _classify_flip(rapp.get("meilleur_score_vente"), THRESHOLD_VENTE)
        l_class = _classify_flip(rapp.get("meilleur_score_location"), THRESHOLD_LOCATION)
        if v_class == "flip_up":
            impact["vente_flip_up"] += 1
        elif v_class == "flip_down":
            impact["vente_flip_down"] += 1
        if l_class == "flip_up":
            impact["location_flip_up"] += 1
        elif l_class == "flip_down":
            impact["location_flip_down"] += 1
        if v_class == "stable" and l_class == "stable":
            impact["stables_hors_bascule"] += 1

    # Total sur toute la table rapprochements — pour donner un dénominateur clair
    rapp_total = await db.rapprochements.count_documents({})
    rapp_with_etage_missing = await db.rapprochements.count_documents({
        "breakdown.etage": 0.5,
    })

    return {
        "dry_run": dry_run,
        "total_avec_complement": total_avec_complement,
        "rempli_avant": rempli_avant,
        "rempli_apres": rempli_apres,
        "a_mettre_a_jour": a_mettre_a_jour,
        "taux_avant": round(rempli_avant / total_avec_complement * 100, 1) if total_avec_complement else 0,
        "taux_apres": round(rempli_apres / total_avec_complement * 100, 1) if total_avec_complement else 0,
        "par_valeur_etage": dict(sorted(par_valeur.items())),
        "rapp_total": rapp_total,
        "rapp_with_etage_missing": rapp_with_etage_missing,
        "impact": impact,
    }


def _print_report(r: dict[str, Any]) -> None:
    tag = "[DRY RUN]" if r["dry_run"] else "[EXECUTED]"
    print(f"\n=== BACKFILL etage_dpe {tag} ===\n")
    print(f"Opportunités avec complement_adresse : {r['total_avec_complement']}")
    print(f"  · etage_dpe rempli AVANT  : {r['rempli_avant']:>5} ({r['taux_avant']:.1f} %)")
    print(f"  · etage_dpe rempli APRÈS  : {r['rempli_apres']:>5} ({r['taux_apres']:.1f} %)")
    print(f"  · opportunités mises à jour : {r['a_mettre_a_jour']}")
    if r["par_valeur_etage"]:
        print(f"  · Répartition par étage extrait :")
        for e, n in r["par_valeur_etage"].items():
            print(f"      étage {e:>2} : {n}")
    print()
    print(f"--- Impact sur rapprochements (upper bound — {r['rapp_total']} total) ---")
    print(f"  · rapprochements avec breakdown.etage=0.5 : {r['rapp_with_etage_missing']}")
    print(f"  · scannés                                : {r['impact']['rapprochements_scannes']}")
    print(f"  · vente flip_up   (score ∈ [0.725, 0.75), +0.025 → deja_en_vente)  : {r['impact']['vente_flip_up']}")
    print(f"  · vente flip_down (score ∈ [0.75, 0.775), −0.025 → opportunité)    : {r['impact']['vente_flip_down']}")
    print(f"  · location flip_up   (score ∈ [0.775, 0.80), +0.025 → location_recente) : {r['impact']['location_flip_up']}")
    print(f"  · location flip_down (score ∈ [0.80, 0.825), −0.025 → opportunité)      : {r['impact']['location_flip_down']}")
    print(f"  · stables (hors zone de bascule)                                        : {r['impact']['stables_hors_bascule']}")
    total_flip = (
        r['impact']['vente_flip_up']
        + r['impact']['vente_flip_down']
        + r['impact']['location_flip_up']
        + r['impact']['location_flip_down']
    )
    print(f"\n  TOTAL DÉCISIONS DONT L'ISSUE CHANGERAIT SI MOTEUR REJOUÉ : {total_flip}")
    print()


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="ne rien écrire")
    args = parser.parse_args()
    r = await backfill(dry_run=args.dry_run)
    _print_report(r)


if __name__ == "__main__":
    asyncio.run(main())
