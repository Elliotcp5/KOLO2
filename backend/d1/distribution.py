"""Algorithme d'attribution des opportunités — équilibrage round-robin.

Utilisé par :
  - le mode `auto` (cron nocturne — Partie 3, mais l'algo est ici),
  - le CTA `répartir automatiquement le reste` (déclenchable manuellement
    par le directeur en mode manuel/mixte).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def distribuer_equilibre(db, organisation_id: Any, opportunite_ids: list[Any]) -> dict:
    """Répartit les opportunités listées entre les conseillers actifs de l'orga.

    Règles :
      - On n'attribue que les opportunités dont `statut == "proposee"` et
        `assigne_a` est absent/null.
      - Round-robin en commençant par le conseiller ayant le moins
        d'opportunités `a_demarcher`/`demarchee`/`mandat_signe`
        actives (charge courante).
      - Si `directeur_prospecte` est vrai, le directeur est inclus.
      - Retourne un résumé { attribuees, ignorees, membres[] }.
    """
    orga = await db.organisations.find_one({"_id": organisation_id})
    if not orga:
        return {"attribuees": 0, "ignorees": 0, "membres": []}

    # Membres candidats
    query = {"organisation_id": organisation_id, "siege_statut": "actif"}
    membres = await db.users.find(query).to_list(length=None)
    membres = [m for m in membres if m.get("role") in ("conseiller", "directeur")]
    if not orga.get("directeur_prospecte"):
        membres = [m for m in membres if m.get("role") != "directeur"]
    if not membres:
        return {"attribuees": 0, "ignorees": len(opportunite_ids), "membres": []}

    # Charge courante par membre (nb d'opps actives)
    ACTIVE_STATUTS = ["a_demarcher", "demarchee", "mandat_signe"]
    charges: dict[str, int] = {}
    for m in membres:
        uid = m.get("user_id")
        n = await db.opportunites.count_documents(
            {"assigne_a": uid, "statut": {"$in": ACTIVE_STATUTS}}
        )
        charges[uid] = int(n)

    def _pick() -> str:
        # Tri stable : charge ↑ puis user_id (pour reproductibilité tests)
        return sorted(charges.items(), key=lambda kv: (kv[1], kv[0]))[0][0]

    attribuees = 0
    ignorees = 0
    now_iso = _now_iso()
    for oid in opportunite_ids:
        opp = await db.opportunites.find_one({"_id": oid})
        if not opp:
            ignorees += 1
            continue
        if (opp.get("statut") or "proposee") != "proposee":
            ignorees += 1
            continue
        if opp.get("assigne_a"):
            ignorees += 1
            continue
        target = _pick()
        await db.opportunites.update_one(
            {"_id": oid},
            {"$set": {
                "assigne_a": target,
                "date_attribution": now_iso,
                "updated_at": now_iso,
            }},
        )
        charges[target] += 1
        attribuees += 1

    return {
        "attribuees": attribuees,
        "ignorees": ignorees,
        "membres": [
            {"user_id": uid, "charge_apres": charges[uid]}
            for uid in charges
        ],
    }
