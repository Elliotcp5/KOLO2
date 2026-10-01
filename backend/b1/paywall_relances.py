"""KOLO — Bloc 9 : relances paywall email (J+1 et J+3).

Flow :
  1. Chaque fois qu'un user visite `/app-b1/paywall`, le frontend POST un event
     `paywall_visite` dans `events` (déjà en place via `b3tracking.track`).
  2. Cron quotidien à 10h Paris : lit les events `paywall_visite` entre
     [maintenant - 25h, maintenant - 23h] (fenêtre d'1h → J+1) et entre
     [maintenant - 73h, maintenant - 71h] (fenêtre d'1h → J+3).
  3. Pour chaque user de la fenêtre :
      - Vérifie `email_relances_actives != False` (opt-out)
      - Vérifie que l'user N'A PAS acheté entre-temps (`plan != pro*`)
      - Vérifie qu'on ne lui a pas déjà envoyé cette relance
        (collection `paywall_relances`, keyé par `(user_id, variante)`)
      - Calcule `n_pool` + `top_zone` via la même requête que `/api/me/pool-zones`
      - Envoie le mail via Resend (texte validé par le user Bloc 9 étape 5)
      - Logge l'envoi dans `paywall_relances`

Désinscription : lien `?opt_out_token={jwt}` qui pose `email_relances_actives=False`.
"""
import asyncio
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)


async def _calcul_top_zone(db, zones_perso):
    """Même requête que `/api/me/pool-zones` → renvoie {cp, count} de la zone
    avec le plus d'opps en pool, ou None si tout est à zéro."""
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


def _is_pro(user):
    plan = (user.get("plan") or "").lower()
    return (
        plan in {"pro", "pro_plus", "pro_lifetime"}
        or user.get("pro_lifetime") is True
        or user.get("subscription_status") == "active"
    )


async def _get_or_create_opt_out_token(db, user_id):
    """Token de désinscription stable par user — jamais régénéré."""
    doc = await db.users.find_one({"user_id": user_id}, {"email_opt_out_token": 1})
    tok = doc.get("email_opt_out_token") if doc else None
    if tok:
        return tok
    tok = secrets.token_urlsafe(24)
    await db.users.update_one({"user_id": user_id}, {"$set": {"email_opt_out_token": tok}})
    return tok


def _build_mail(variante, prenom, n_pool, cp, paywall_url, unsubscribe_url):
    if variante == "j1":
        sujet = "Votre zone a bougé pendant la nuit"
        corps_html = f"""
<p>Bonjour {prenom},</p>
<p>Hier vous avez jeté un œil à KOLO Pro. Depuis, <strong>{n_pool} nouvelle{"s" if n_pool > 1 else ""} opportunité{"s" if n_pool > 1 else ""} de mandats</strong> sont apparues dans le <strong>{cp}</strong>. Ce sont des biens dont les propriétaires envisagent de vendre, repérés avant qu'ils arrivent chez vos confrères.</p>
<p>La version Pro vous ouvre l'accès complet à ce flux, aux estimations illimitées, à la veille sur les biens déjà en vente et à l'assistant KOLO. Un seul abonnement, zéro engagement.</p>
<p><a href="{paywall_url}" style="display:inline-block;padding:14px 28px;background:#EC8690;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;">Reprendre où j'en étais →</a></p>
<p style="color:#6B7280;font-size:12px;margin-top:48px;">— L'équipe KOLO</p>
<p style="color:#6B7280;font-size:11px;">Vous recevez ce message parce que vous avez consulté KOLO Pro. <a href="{unsubscribe_url}" style="color:#6B7280;">Me désinscrire des relances</a>.</p>
""".strip()
    else:  # "j3"
        sujet = "La prospection commence demain à 7h"
        corps_html = f"""
<p>Bonjour {prenom},</p>
<p>Chaque matin à 7h, KOLO dépose une pile fraîche d'opportunités de mandats dans votre zone. <strong>{n_pool} biens</strong> sont déjà passés dans votre <strong>{cp}</strong> depuis votre dernière visite — vous les auriez vus en premier avec Pro.</p>
<p>On ne va pas vous relancer après celui-ci. Si KOLO Pro n'est pas pour vous aujourd'hui, nous respectons votre choix et vous n'entendrez plus parler de ce sujet.</p>
<p><a href="{paywall_url}" style="display:inline-block;padding:14px 28px;background:#EC8690;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;">Activer KOLO Pro →</a></p>
<p style="color:#6B7280;font-size:12px;margin-top:48px;">— L'équipe KOLO</p>
<p style="color:#6B7280;font-size:11px;"><a href="{unsubscribe_url}" style="color:#6B7280;">Me désinscrire définitivement</a>.</p>
""".strip()
    return sujet, corps_html


async def _envoyer_relance(db, user, variante, app_base_url):
    """Envoie 1 email via Resend. Retourne True si envoyé, False sinon."""
    if user.get("email_relances_actives") is False:
        return False
    if _is_pro(user):
        return False
    # Dédup : jamais 2x le même (user_id, variante)
    already = await db.paywall_relances.find_one({
        "user_id": user["user_id"], "variante": variante,
    })
    if already:
        return False
    zones = user.get("zones_perso") or []
    top = await _calcul_top_zone(db, zones)
    if not top:
        # Pas de chiffre réel → on n'invente pas, on skip.
        return False
    api_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    if not api_key:
        logger.warning("paywall_relances: RESEND_API_KEY absent")
        return False
    import resend
    resend.api_key = api_key
    sender = os.environ.get("RESEND_SENDER") or "KOLO <no-reply@trykolo.io>"
    prenom = user.get("prenom") or user.get("full_name", "").split(" ")[0] or "l'agent"
    paywall_url = f"{app_base_url}/app-b1/paywall?utm=relance_{variante}"
    opt_out_tok = await _get_or_create_opt_out_token(db, user["user_id"])
    unsub_url = f"{app_base_url}/api/me/email-relances-stop?tok={opt_out_tok}"
    sujet, html = _build_mail(variante, prenom, top["count"], top["cp"], paywall_url, unsub_url)
    try:
        await asyncio.to_thread(
            resend.Emails.send,
            {"from": sender, "to": [user["email"]], "subject": sujet, "html": html,
             "headers": {"List-Unsubscribe": f"<{unsub_url}>"}},
        )
        await db.paywall_relances.insert_one({
            "user_id": user["user_id"], "variante": variante,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "top_zone": top["cp"], "n_pool": top["count"],
        })
        logger.info("paywall_relances: envoyé %s à %s", variante, user["email"])
        return True
    except Exception as e:
        logger.warning("paywall_relances: échec Resend %s: %s", user["email"], e)
        return False


async def job_envoyer_relances_paywall(db):
    """Cron quotidien 10h Paris. Lit les events `paywall_affiche` sur 2 fenêtres :
      - J+1 : [-25h, -23h]
      - J+3 : [-73h, -71h]
    """
    now = datetime.now(timezone.utc)
    app_base_url = (os.environ.get("REACT_APP_BASE_URL") or "https://app.trykolo.io").rstrip("/")
    envois = {"j1": 0, "j3": 0}
    for variante, bornes in [("j1", (25, 23)), ("j3", (73, 71))]:
        t_min = (now - timedelta(hours=bornes[0])).isoformat()
        t_max = (now - timedelta(hours=bornes[1])).isoformat()
        # dédup user : prendre 1 event par user dans la fenêtre
        pipeline = [
            {"$match": {"event": "paywall_affiche", "ts": {"$gte": t_min, "$lte": t_max}}},
            {"$group": {"_id": "$user_id", "ts": {"$min": "$ts"}}},
        ]
        async for g in db.events.aggregate(pipeline):
            uid = g["_id"]
            if not uid:
                continue
            u = await db.users.find_one({"user_id": uid})
            if not u:
                continue
            try:
                ok = await _envoyer_relance(db, u, variante, app_base_url)
                if ok:
                    envois[variante] += 1
            except Exception as e:
                logger.warning("paywall_relances: exception %s/%s : %s", uid, variante, e)
    logger.info("paywall_relances: cycle terminé — J1=%d J3=%d", envois["j1"], envois["j3"])
    return envois
