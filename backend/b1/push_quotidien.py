"""KOLO — Bloc 9 : push notifications quotidiennes.

2 jobs planifiés dans `d1.scheduler` :
  - matin  (7h30 Paris) : « N nouvelles opportunités dans votre zone ce matin »
    pour les users dont la zone a reçu de nouvelles opps (statut=pool) depuis
    minuit. Seuls les Pro reçoivent — un Découverte verrait un push qui mène
    au paywall, c'est l'email de relance qui est pour lui.
  - soir   (18h00 Paris) : rappel pour les users qui n'ont PAS ouvert l'app
    depuis > 12 h ET qui ont au moins 1 opp proposée en attente.

Garde-fous :
  - `users.notifications_push_actives != False` (opt-out)
  - Max 2 push/jour/user — stocké dans `push_log_daily` avec clé `(user_id, date)`
  - Pas d'envoi si `apns_ready()==False` ou si `device_tokens` vide pour l'user
"""
import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_MAX_PUSH_PAR_JOUR = 2


async def _peut_envoyer(db, user_id, date_key):
    """True si le quota 2/jour n'est pas atteint."""
    doc = await db.push_log_daily.find_one({"user_id": user_id, "date": date_key})
    n = (doc or {}).get("count", 0)
    return n < _MAX_PUSH_PAR_JOUR


async def _log_envoi(db, user_id, date_key, kind):
    await db.push_log_daily.update_one(
        {"user_id": user_id, "date": date_key},
        {"$inc": {"count": 1}, "$push": {"kinds": kind}},
        upsert=True,
    )


def _is_pro(user):
    plan = (user.get("plan") or "").lower()
    return (
        plan in {"pro", "pro_plus", "pro_lifetime", "agence"}
        or user.get("pro_lifetime") is True
        or user.get("subscription_status") == "active"
    )


async def _top_zone_pool(db, zones_perso):
    if not zones_perso:
        return None
    top = None
    for cp in zones_perso:
        n = await db.opportunites.count_documents({
            "code_postal": str(cp), "statut": "pool",
        })
        if n > 0 and (not top or n > top["count"]):
            top = {"cp": str(cp), "count": n}
    return top


async def job_push_matin(db):
    """7h30 Paris. Un push "N nouvelles opportunités dans le {cp} ce matin"
    pour les Pro dont la zone principale a reçu > 0 opps depuis minuit UTC.
    """
    date_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    envois = 0
    try:
        from b3.services import _apns_ready, send_push_to_user
        if not _apns_ready():
            logger.info("[push_matin] apns non prêt — skip")
            return 0
        cursor = db.users.find({
            "notifications_push_actives": {"$ne": False},
            "zones_perso": {"$exists": True, "$ne": []},
            "app_version": "b1",
        })
        async for u in cursor:
            if not _is_pro(u):
                continue
            top = await _top_zone_pool(db, u.get("zones_perso") or [])
            if not top:
                continue
            if not await _peut_envoyer(db, u["user_id"], date_key):
                continue
            try:
                n = await send_push_to_user(
                    db, u["user_id"], key="matin_opps_zone",
                    params={"message": f"{top['count']} nouvelles opportunités dans le {top['cp']} ce matin ☀️"},
                )
                if n > 0:
                    await _log_envoi(db, u["user_id"], date_key, "matin")
                    envois += 1
            except Exception as e:
                logger.warning("[push_matin] user=%s err=%s", u.get("user_id"), e)
    except Exception as e:
        logger.warning("[push_matin] exception globale: %s", e)
    logger.info("[push_matin] cycle terminé — %d envois", envois)
    return envois


async def job_push_soir(db):
    """18h00 Paris. Rappel pour les Pro qui n'ont pas ouvert l'app depuis
    > 12 h ET qui ont au moins 1 opp proposée en attente."""
    date_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    now = datetime.now(timezone.utc)
    seuil = now.timestamp() - 12 * 3600
    envois = 0
    try:
        from b3.services import _apns_ready, send_push_to_user
        if not _apns_ready():
            return 0
        cursor = db.users.find({
            "notifications_push_actives": {"$ne": False},
            "app_version": "b1",
        })
        async for u in cursor:
            if not _is_pro(u):
                continue
            # Dernière ouverture : last_seen_at (iso string). Si > 12h, on relance.
            last_seen = u.get("last_seen_at") or u.get("updated_at") or ""
            try:
                last_seen_ts = datetime.fromisoformat(last_seen.replace("Z", "+00:00")).timestamp()
            except Exception:
                last_seen_ts = 0
            if last_seen_ts > seuil:
                continue  # ouvert il y a moins de 12h → pas de rappel
            # Au moins 1 opp proposée en attente ?
            n_proposees = await db.opportunites.count_documents({
                "assigne_a": u["user_id"], "statut": "proposee",
            })
            if n_proposees == 0:
                continue
            if not await _peut_envoyer(db, u["user_id"], date_key):
                continue
            try:
                n = await send_push_to_user(
                    db, u["user_id"], key="soir_rappel",
                    params={"message": f"{n_proposees} opportunité{'s' if n_proposees > 1 else ''} vous attend{'ent' if n_proposees > 1 else ''} encore aujourd'hui."},
                )
                if n > 0:
                    await _log_envoi(db, u["user_id"], date_key, "soir")
                    envois += 1
            except Exception as e:
                logger.warning("[push_soir] user=%s err=%s", u.get("user_id"), e)
    except Exception as e:
        logger.warning("[push_soir] exception globale: %s", e)
    logger.info("[push_soir] cycle terminé — %d envois", envois)
    return envois
