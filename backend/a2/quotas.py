"""
KOLO — Quotas (Session A2)
==========================

Deux fonctions uniques, TOUTES les features doivent passer par elles :

    ok, ctx = await verifier_quota(db, user, "opportunite")
    if not ok:
        # UI : afficher le paywall « quota atteint »
        ...
    else:
        # exécuter la feature
        await incrementer_quota(db, user, "opportunite")

Les compteurs vivent dans la collection `quotas`, un document par tuple
(user_id, type, période). La période est calculée en heure de Paris via
`a2.tz.period_key()` — donc bascule à 00h00 Paris pour tous les fuseaux.
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from .config import get_config
from .tz import PeriodKind, now_utc_iso, period_key

QuotaType = Literal["opportunite", "estimation", "dossier"]


def _plan_for_quota(user: dict[str, Any]) -> str:
    """Retourne le plan A2 canonique : 'decouverte' | 'pro' | 'agence'.

    Politique :
      - Si le user est rattaché à une organisation (`organisation_id`), il est
        conseiller/directeur → plan 'agence'.
      - Sinon on lit `user.plan`. Les anciennes valeurs 'free', 'pro_plus',
        'pro_lifetime' sont mappées.
    """
    if user.get("organisation_id"):
        return "agence"
    p = (user.get("plan") or "").lower().strip()
    if p in ("pro", "pro_plus", "pro_lifetime"):
        return "pro"
    if p in ("agence",):
        return "agence"
    if p in ("decouverte", "découverte"):
        return "decouverte"
    # `free`, `<none>`, autres → découverte (spec : Découverte est le tier gratuit)
    return "decouverte"


def _get_quota_rule(cfg: dict, plan: str, qtype: QuotaType) -> Optional[dict]:
    """Retourne `{ kind, limite }` ou None si non défini (= interdit)."""
    quotas_root = cfg.get("quotas") or {}
    plan_rules = quotas_root.get(plan) or quotas_root.get("decouverte") or {}
    return plan_rules.get(qtype)


async def verifier_quota(
    db, user: dict[str, Any], qtype: QuotaType
) -> tuple[bool, dict[str, Any]]:
    """Retourne (autorise, contexte).

    Le contexte contient :
      - plan             (str)   : plan retenu pour l'utilisateur
      - kind             (str)   : quotidien | hebdo | mensuel
      - limite           (int|str) : nombre autorisé ou "illimite"
      - compteur         (int)   : usage actuel dans la période
      - periode          (str)   : clé de période Paris
    """
    cfg = await get_config(db)
    plan = _plan_for_quota(user)
    rule = _get_quota_rule(cfg, plan, qtype)
    if not rule:
        return False, {"plan": plan, "kind": None, "limite": 0, "compteur": 0, "periode": None}

    kind: PeriodKind = rule.get("kind", "quotidien")  # type: ignore[assignment]
    limite = rule.get("limite", 0)
    periode = period_key(kind)

    doc = await db.quotas.find_one(
        {"user_id": user["user_id"], "type": qtype, "periode": periode}
    )
    compteur = int((doc or {}).get("compteur") or 0)

    if limite == "illimite":
        return True, {
            "plan": plan, "kind": kind, "limite": "illimite",
            "compteur": compteur, "periode": periode,
        }
    try:
        limite_i = int(limite)
    except (TypeError, ValueError):
        limite_i = 0
    autorise = compteur < limite_i
    return autorise, {
        "plan": plan, "kind": kind, "limite": limite_i,
        "compteur": compteur, "periode": periode,
    }


async def incrementer_quota(
    db, user: dict[str, Any], qtype: QuotaType, delta: int = 1
) -> dict[str, Any]:
    """Incrémente le compteur (upsert). Retourne le doc final.

    Ne fait AUCUN check de dépassement — l'appelant doit avoir appelé
    `verifier_quota` avant. C'est délibéré : le pattern verify + increment est
    parfois distant (queue, tâche différée) et on veut compter les usages
    effectifs même en cas de bug applicatif.
    """
    cfg = await get_config(db)
    plan = _plan_for_quota(user)
    rule = _get_quota_rule(cfg, plan, qtype) or {"kind": "quotidien", "limite": 0}
    kind: PeriodKind = rule.get("kind", "quotidien")  # type: ignore[assignment]
    periode = period_key(kind)

    now_iso = now_utc_iso()
    key = {"user_id": user["user_id"], "type": qtype, "periode": periode}
    await db.quotas.update_one(
        key,
        {
            "$inc": {"compteur": int(delta)},
            "$set": {"kind": kind, "plan": plan, "updated_at": now_iso},
            "$setOnInsert": {"created_at": now_iso},
        },
        upsert=True,
    )
    return (await db.quotas.find_one(key)) or {}
