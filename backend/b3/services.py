"""B3 — Services partagés : emails transactionnels + push APNs.

**Emails** : passent par Resend (déjà configuré dans le server pour les codes de
connexion V2). On réutilise `RESEND_API_KEY`. Si absent : log-only.

**Push APNs** : nécessite `.p8` + Key ID + Team ID + Bundle ID. Tant qu'ils ne
sont pas fournis, les envois sont **journalisés uniquement** (pas de crash).
Les envois passent par `apns2` si dispo, sinon HTTPX vers `api.push.apple.com`
avec un JWT signé ES256 (méthode standard, sans SDK).
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Nom d'expéditeur / adresse pour Resend
_RESEND_FROM = os.environ.get("RESEND_FROM_TRANSACTIONAL") or "KOLO <notifications@trykolo.io>"

# APNs
_APNS_KEY_ID = os.environ.get("APNS_KEY_ID", "").strip()
_APNS_TEAM_ID = os.environ.get("APNS_TEAM_ID", "").strip()
_APNS_BUNDLE_ID = os.environ.get("APNS_BUNDLE_ID", "").strip()
_APNS_KEY_P8 = os.environ.get("APNS_KEY_P8", "").strip()  # contenu PEM inline
_APNS_ENV = os.environ.get("APNS_ENV", "production").strip()  # "sandbox" ou "production"


# ---------------------------------------------------------------------------
# Copie textuelle serveur (mirroir des clés i18n front) — utilisée pour les
# envois push et emails. Locale FR par défaut ; l'utilisateur choisit sa locale
# côté front, le back utilise `user.locale` si présent.
# ---------------------------------------------------------------------------
NOTIF_STRINGS = {
    "fr": {
        "notif.rappel.matin_one": "Bonjour. 1 opportunité vous attend ce matin dans vos zones.",
        "notif.rappel.matin_other": "Bonjour. {n} opportunités vous attendent ce matin dans vos zones.",
        "notif.rappel.milieu_matin_one": "Il reste 1 opportunité à traiter avant midi.",
        "notif.rappel.milieu_matin_other": "Il reste {n} opportunités à traiter avant midi.",
        "notif.rappel.debut_aprem_one": "On reprend ? 1 opportunité en attente dans vos zones.",
        "notif.rappel.debut_aprem_other": "On reprend ? {n} opportunités en attente dans vos zones.",
        "notif.rappel.fin_journee_one": "1 opportunité encore ouverte avant la fin de la journée.",
        "notif.rappel.fin_journee_other": "{n} opportunités encore ouvertes avant la fin de la journée.",
        "notif.streak.encours": "Vous avez tenu {jours_streak} jours d'affilée. Encore {n} jours pour votre opportunité bonus.",
        "notif.streak.dernier": "Un swipe aujourd'hui et votre opportunité bonus est débloquée.",
        "notif.decouverte.relance": "Vous avez utilisé votre opportunité de la semaine. Le plan Pro vous donne toutes les opportunités de vos zones, chaque jour.",
        "notif.zone_ouverte": "Bonne nouvelle. Le {cp} est maintenant couvert par KOLO.",
        "notif.groupee_one": "1 nouvelle information vous attend dans KOLO.",
        "notif.groupee_other": "{n} nouvelles informations vous attendent dans KOLO.",
        "email.zone.sujet": "Le {cp} est maintenant couvert par KOLO",
        "email.zone.corps": (
            "Bonjour {prenom},\n\n"
            "Vous nous aviez indiqué le {cp} comme zone de prospection. C'est fait : "
            "KOLO couvre désormais ce code postal.\n\n"
            "À votre prochaine ouverture de l'app, vos premières opportunités de mandats "
            "dans cette zone vous attendront.\n\n"
            "À bientôt,\nL'équipe KOLO"
        ),
    },
}


def _t(locale: str, key: str, params: Optional[dict] = None) -> str:
    """Traduction serveur avec pluralisation `_one` / `_other`. FR fallback."""
    params = params or {}
    dict_ = NOTIF_STRINGS.get(locale) or NOTIF_STRINGS["fr"]
    s = dict_.get(key) or NOTIF_STRINGS["fr"].get(key) or key
    for k, v in params.items():
        s = s.replace("{" + k + "}", str(v))
    return s


def render_notif(user_locale: Optional[str], key: str, params: Optional[dict] = None) -> str:
    """Rendu final avec pluralisation automatique : si `n` dans params, choisit _one/_other."""
    params = params or {}
    locale = user_locale or "fr"
    if "n" in params:
        n = int(params["n"])
        base = key.rsplit("_one", 1)[0].rsplit("_other", 1)[0]
        base = base if not base.endswith("_one") and not base.endswith("_other") else base
        variant = "_one" if n == 1 else "_other"
        # Si la clé finit déjà par _one/_other, on garde ; sinon on ajoute.
        if not key.endswith("_one") and not key.endswith("_other"):
            key = f"{key}{variant}"
    return _t(locale, key, params)


# ---------------------------------------------------------------------------
# Email — Resend
# ---------------------------------------------------------------------------
async def send_zone_ouverte_email(email: str, prenom: str, cp: str, locale: str = "fr") -> bool:
    subject = _t(locale, "email.zone.sujet", {"cp": cp})
    body = _t(locale, "email.zone.corps", {"prenom": prenom or "", "cp": cp})
    return await _send_email_resend(to=email, subject=subject, text=body)


async def _send_email_resend(to: str, subject: str, text: str) -> bool:
    key = (os.environ.get("RESEND_API_KEY") or "").strip()
    if not key or not to:
        logger.warning(f"[b3.email] Resend absent — log only. to={to} subject={subject!r}")
        return False
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"from": _RESEND_FROM, "to": [to], "subject": subject, "text": text},
            )
            if r.status_code >= 300:
                logger.warning(f"[b3.email] Resend {r.status_code}: {r.text[:200]}")
                return False
        return True
    except Exception as e:
        logger.warning(f"[b3.email] send error: {e}")
        return False


# ---------------------------------------------------------------------------
# APNs — JWT ES256, HTTP/2. Sans SDK.
# Si les 4 variables APNS_* ne sont pas fournies, on journalise en no-op.
# ---------------------------------------------------------------------------
_APNS_JWT_CACHE: dict = {"token": None, "at": 0.0}


def _apns_ready() -> bool:
    return bool(_APNS_KEY_ID and _APNS_TEAM_ID and _APNS_BUNDLE_ID and _APNS_KEY_P8)


def _apns_jwt() -> Optional[str]:
    """Génère un JWT ES256 pour APNs. Renouvelle toutes les 45 min (Apple max 60)."""
    import time
    now = int(time.time())
    if _APNS_JWT_CACHE["token"] and (now - _APNS_JWT_CACHE["at"] < 45 * 60):
        return _APNS_JWT_CACHE["token"]
    if not _apns_ready():
        return None
    try:
        import jwt  # PyJWT
        headers = {"alg": "ES256", "kid": _APNS_KEY_ID}
        payload = {"iss": _APNS_TEAM_ID, "iat": now}
        token = jwt.encode(payload, _APNS_KEY_P8, algorithm="ES256", headers=headers)
        _APNS_JWT_CACHE["token"] = token
        _APNS_JWT_CACHE["at"] = now
        return token
    except Exception as e:
        logger.warning(f"[b3.apns] JWT sign error: {e}")
        return None


async def send_push_to_user(db, user_id: str, key: str, params: Optional[dict] = None) -> int:
    """Envoie une notif push à tous les device_tokens de l'utilisateur.

    Retourne le nombre d'envois effectifs (ou 0 si APNs non configuré).
    """
    params = params or {}
    tokens = [t async for t in db.device_tokens.find({"user_id": user_id}, {"token": 1, "plateforme": 1, "_id": 0})]
    if not tokens:
        return 0

    # Locale utilisateur
    u = await db.users.find_one({"user_id": user_id}, {"locale": 1, "_id": 0})
    locale = (u or {}).get("locale") or "fr"
    body = render_notif(locale, key, params)

    # Journalisation systématique (utile même sans APNs)
    from a2.tz import now_utc_iso
    await db.push_logs.insert_one({
        "user_id": user_id, "key": key, "params": params, "body": body,
        "envoyes": 0, "tokens_cibles": len(tokens), "date": now_utc_iso(),
        "apns_ready": _apns_ready(),
    })

    if not _apns_ready():
        logger.info(f"[b3.push] Not configured — log only. user={user_id} key={key} body={body!r}")
        return 0

    jwt_token = _apns_jwt()
    if not jwt_token:
        return 0

    import httpx
    host = "api.push.apple.com" if _APNS_ENV == "production" else "api.sandbox.push.apple.com"
    sent = 0
    payload = {"aps": {"alert": {"body": body}, "sound": "default"}}
    body_json = json.dumps(payload)
    async with httpx.AsyncClient(http2=True, timeout=10) as client:
        for t in tokens:
            tok = t["token"]
            try:
                r = await client.post(
                    f"https://{host}/3/device/{tok}",
                    headers={
                        "authorization": f"bearer {jwt_token}",
                        "apns-topic": _APNS_BUNDLE_ID,
                        "apns-push-type": "alert",
                        "content-type": "application/json",
                    },
                    content=body_json,
                )
                if r.status_code == 200:
                    sent += 1
                elif r.status_code == 410:
                    # Token invalidé — retire
                    await db.device_tokens.delete_one({"user_id": user_id, "token": tok})
                else:
                    logger.warning(f"[b3.apns] HTTP {r.status_code}: {r.text[:200]}")
            except Exception as e:
                logger.warning(f"[b3.apns] send error to {tok[:8]}: {e}")

    if sent:
        await db.push_logs.update_one(
            {"user_id": user_id, "key": key, "date": {"$exists": True}},
            {"$set": {"envoyes": sent}}, upsert=False,
        )
    return sent
