"""Helpers d'invitations — envoi email Resend + attach au signup.

Aucune donnée d'invitation n'expose de montant, de fournisseur de paiement,
ni d'URL web de paiement. Le corps du mail dirige simplement le conseiller
à ouvrir l'app KOLO et à se connecter avec son email.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

INVITATION_TTL_DAYS = 14


# ---------------------------------------------------------------------------
# Corps d'email — 4 langues (Option A : aucun lien à cliquer)
# ---------------------------------------------------------------------------
def _email_subject(lang: str, agence: str) -> str:
    if lang == "en":
        return f"{agence} invites you to join KOLO"
    if lang == "it":
        return f"{agence} ti invita a unirti a KOLO"
    if lang == "de":
        return f"{agence} lädt Sie zu KOLO ein"
    return f"{agence} vous invite à rejoindre KOLO"


def _email_body(
    lang: str, agence: str, directeur_prenom: str, directeur_nom: str, email_invite: str
) -> str:
    dir_full = f"{directeur_prenom} {directeur_nom}".strip()
    if lang == "en":
        return (
            f"Hi,\n\n"
            f"{dir_full}, director of {agence}, invites you to join their team on KOLO.\n\n"
            f"You will get access to listing opportunities in the agency's areas "
            f"and all Pro plan tools, covered by your agency.\n\n"
            f"To join: open the KOLO app and sign in with this email address "
            f"({email_invite}). You will receive a 6-digit code as usual.\n\n"
            f"This invitation is valid for 14 days.\n\n"
            f"Best,\nThe KOLO team"
        )
    if lang == "it":
        return (
            f"Ciao,\n\n"
            f"{dir_full}, direttore di {agence}, ti invita nel suo team su KOLO.\n\n"
            f"Avrai accesso alle opportunità di mandato delle zone dell'agenzia "
            f"e a tutti gli strumenti del piano Pro, coperti dalla tua agenzia.\n\n"
            f"Per iscriverti: apri l'app KOLO e accedi con questo indirizzo email "
            f"({email_invite}). Riceverai un codice a 6 cifre come di consueto.\n\n"
            f"L'invito è valido 14 giorni.\n\n"
            f"A presto,\nIl team KOLO"
        )
    if lang == "de":
        return (
            f"Hallo,\n\n"
            f"{dir_full}, Leitung von {agence}, lädt Sie in das Team auf KOLO ein.\n\n"
            f"Sie erhalten Zugriff auf die Mandats-Chancen der Gebiete der Agentur "
            f"und auf alle Tools des Pro-Tarifs, übernommen von Ihrer Agentur.\n\n"
            f"Zur Anmeldung: Öffnen Sie die KOLO-App und melden Sie sich mit dieser "
            f"E-Mail-Adresse an ({email_invite}). Sie erhalten wie gewohnt einen "
            f"6-stelligen Code.\n\n"
            f"Diese Einladung ist 14 Tage gültig.\n\n"
            f"Bis bald,\nDas KOLO-Team"
        )
    return (
        f"Bonjour,\n\n"
        f"{dir_full}, directeur de {agence}, vous invite à rejoindre son équipe sur KOLO.\n\n"
        f"Vous aurez accès aux opportunités de mandats des zones de l'agence "
        f"et à tous les outils du plan Pro, pris en charge par votre agence.\n\n"
        f"Pour rejoindre : ouvrez l'app KOLO et connectez-vous avec cette adresse "
        f"email ({email_invite}). Vous recevrez un code à 6 chiffres comme d'habitude.\n\n"
        f"Cette invitation est valable 14 jours.\n\n"
        f"À bientôt,\nL'équipe KOLO"
    )


async def send_invitation_email(
    to_email: str,
    agence: str,
    directeur_prenom: str,
    directeur_nom: str,
    lang: str = "fr",
) -> bool:
    """Envoi via Resend. Best-effort ; log si échec."""
    api_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    if not api_key:
        logger.warning("d1.send_invitation_email: RESEND_API_KEY absent — mail ignoré")
        return False
    sender = (os.environ.get("SENDER_EMAIL") or "noreply@trykolo.io").strip()
    try:
        import resend  # type: ignore
        resend.api_key = api_key
        subject = _email_subject(lang, agence)
        body = _email_body(lang, agence, directeur_prenom, directeur_nom, to_email)
        await asyncio.to_thread(
            resend.Emails.send,
            {
                "from": f"KOLO <{sender}>",
                "to": [to_email],
                "subject": subject,
                "text": body,
            },
        )
        return True
    except Exception as e:  # pragma: no cover — dépend de la clé prod
        logger.error(f"d1.send_invitation_email failed: {e}")
        return False


# ---------------------------------------------------------------------------
# Attach au signup — appelé depuis l'auth existant
# ---------------------------------------------------------------------------
def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def attach_conseiller_if_invited(db, email: str, user_id: str) -> Optional[dict]:
    """Cherche une invitation active pour cet email et rattache le user à
    l'organisation. Retourne l'invitation utilisée, ou None.

    Effets appliqués :
      - user.role = "conseiller"
      - user.organisation_id = <id>
      - user.siege_statut = "actif"
      - user.plan = "agence" (couvert par l'agence)
      - invitation.statut = "acceptee"
      - organisation.sieges_utilises ++
    Idempotent : n'agit pas si le user est déjà conseiller/rattaché.
    """
    email_norm = (email or "").strip().lower()
    if not email_norm:
        return None

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    invit = await db.invitations.find_one(
        {"email": email_norm, "statut": "envoyee"}
    )
    if not invit:
        return None

    # Expiration ?
    exp = invit.get("date_expiration")
    if isinstance(exp, str):
        try:
            exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
        except Exception:
            exp_dt = None
    elif isinstance(exp, datetime):
        exp_dt = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
    else:
        exp_dt = None
    if exp_dt and exp_dt < now:
        await db.invitations.update_one(
            {"_id": invit["_id"]}, {"$set": {"statut": "expiree", "updated_at": now_iso}}
        )
        return None

    orga_id = invit.get("organisation_id")
    if not orga_id:
        return None
    orga = await db.organisations.find_one({"_id": orga_id})
    if not orga:
        return None

    # Plafond sièges ?
    used = int(orga.get("sieges_utilises") or 0)
    total = int(orga.get("sieges_total") or 0)
    if total and used >= total:
        logger.warning(f"d1.attach: plafond atteint pour orga {orga_id}")
        return None

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "role": "conseiller",
            "organisation_id": orga_id,
            "siege_statut": "actif",
            "plan": "agence",
            "plan_depuis": now_iso,
            "invitation_id": invit.get("_id"),
            "updated_at": now_iso,
        }},
    )
    await db.invitations.update_one(
        {"_id": invit["_id"]},
        {"$set": {"statut": "acceptee", "date_acceptation": now_iso, "user_id": user_id}},
    )
    await db.organisations.update_one(
        {"_id": orga_id}, {"$inc": {"sieges_utilises": 1}, "$set": {"updated_at": now_iso}}
    )
    return {**invit, "statut": "acceptee"}


async def check_email_invited(db, email: str) -> Optional[dict]:
    """Retourne un résumé d'invitation active pour cet email, ou None.
    Utilisé par l'écran de login pour afficher « Invitation en cours ».
    """
    email_norm = (email or "").strip().lower()
    if not email_norm:
        return None
    invit = await db.invitations.find_one({"email": email_norm, "statut": "envoyee"})
    if not invit:
        return None
    exp = invit.get("date_expiration")
    if isinstance(exp, str):
        try:
            exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
        except Exception:
            exp_dt = None
    elif isinstance(exp, datetime):
        exp_dt = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
    else:
        exp_dt = None
    if exp_dt and exp_dt < datetime.now(timezone.utc):
        return None
    orga = await db.organisations.find_one({"_id": invit.get("organisation_id")})
    if not orga:
        return None
    return {
        "agence": orga.get("nom") or "",
        "expire_le": invit.get("date_expiration"),
    }


def make_expiration_iso(days: int = INVITATION_TTL_DAYS) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
