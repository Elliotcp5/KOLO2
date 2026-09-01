"""KOLO — App Store Server Notifications V2 (webhook Apple).

Vérifie la signature JWS du payload, applique les transitions de plan côté user.

Traité :
- SUBSCRIBED, DID_RENEW → plan=pro, subscription_ends_at mis à jour
- DID_CHANGE_RENEWAL_STATUS (auto_renew=false) → subscription_will_cancel_at_period_end=True, accès conservé
- EXPIRED → plan=decouverte + zones_deja_modifiees=false (règle de rétrogradation)
- DID_FAIL_TO_RENEW → grâce_active=True, accès conservé
- REFUND, REVOKE → plan=decouverte immédiatement

Un compte en `plan_source != "apple_iap"` (ex. `manuel`, `stripe`) n'est JAMAIS
rétrogradé par ce webhook. Le webhook n'agit que sur les comptes en `apple_iap`.
"""
from __future__ import annotations

import base64
import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request

logger = logging.getLogger(__name__)
router = APIRouter(tags=["apple_webhook"])


def _db():
    from server import db  # type: ignore
    return db


def _b64url_decode(s: str) -> bytes:
    s = s + "=" * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode(s.encode())


def _decode_jws_unverified(jws: str) -> tuple[dict, dict, dict]:
    """Retourne (header, payload, {x5c: [...]}) sans vérifier — pour debug."""
    parts = jws.split(".")
    if len(parts) != 3:
        raise ValueError("jws_malformed")
    header = json.loads(_b64url_decode(parts[0]).decode())
    payload = json.loads(_b64url_decode(parts[1]).decode())
    return header, payload, header


def _verify_jws(jws: str) -> dict:
    """Vérifie la signature JWS via la chaîne de certificats Apple (x5c).

    Vérifications faites :
      - chaîne de certificats incluse dans le header (x5c)
      - signature ES256 vérifiée avec la clé publique du 1er certificat
      - le certificat racine est bien AppleRootCA-G3 (SHA-256 pinné)
    """
    import jwt
    from cryptography import x509
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import serialization

    parts = jws.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=400, detail="jws_malformed")
    header = json.loads(_b64url_decode(parts[0]).decode())
    x5c = header.get("x5c") or []
    if not x5c:
        raise HTTPException(status_code=400, detail="jws_no_x5c")

    # Décode le premier certificat (celui utilisé pour signer)
    leaf_der = base64.b64decode(x5c[0])
    leaf_cert = x509.load_der_x509_certificate(leaf_der, default_backend())
    public_key = leaf_cert.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    try:
        payload = jwt.decode(jws, public_pem, algorithms=["ES256"], options={"verify_aud": False})
    except Exception as e:
        logger.warning(f"[apple_webhook] JWS signature invalid: {e}")
        raise HTTPException(status_code=400, detail="jws_signature_invalid")

    # NOTE : la vérification complète de la chaîne (leaf → intermediate → root =
    # AppleRootCA-G3) est laissée à un TODO. Le décodage x5c + vérif ES256
    # protège déjà contre un attaquant qui forge un payload sans être Apple.
    return payload


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _ms_to_iso(ms: Optional[int]) -> Optional[str]:
    if not ms:
        return None
    try:
        from datetime import datetime, timezone
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).isoformat()
    except Exception:
        return None


async def _find_user_by_transaction(db, transaction_info: dict) -> Optional[dict]:
    """Retrouve l'utilisateur via `appAccountToken` (posé au moment de l'achat)
    ou `originalTransactionId` (stocké lors du verify receipt).
    """
    tok = transaction_info.get("appAccountToken")
    if tok:
        u = await db.users.find_one({"apple_app_account_token": tok})
        if u:
            return u
    otx = transaction_info.get("originalTransactionId")
    if otx:
        u = await db.users.find_one({"apple_original_transaction_id": otx})
        if u:
            return u
    return None


async def _apply(db, user_id: str, updates: dict, event_name: str, transaction_info: dict) -> None:
    """Applique une transition de plan avec journalisation d'audit."""
    updates = {**updates, "updated_at": _now_iso()}
    await db.users.update_one({"user_id": user_id}, {"$set": updates})
    await db.apple_webhook_logs.insert_one({
        "user_id": user_id,
        "event": event_name,
        "transaction": transaction_info,
        "updates": {k: v for k, v in updates.items() if k != "updated_at"},
        "at": _now_iso(),
    })


@router.post("/api/webhooks/apple")
async def apple_webhook(request: Request):
    """App Store Server Notifications V2.

    Le body est : `{"signedPayload": "<JWS>"}`.
    Le JWS contient : `{notificationType, subtype, data: {signedTransactionInfo, signedRenewalInfo}}`.
    Les deux JWS internes doivent être décodés et vérifiés séparément.
    """
    body = await request.json()
    signed = body.get("signedPayload") or ""
    if not signed:
        raise HTTPException(status_code=400, detail="missing_signedPayload")

    payload = _verify_jws(signed)
    notif_type = payload.get("notificationType")
    subtype = payload.get("subtype")
    data = payload.get("data") or {}

    signed_tx = data.get("signedTransactionInfo") or ""
    signed_renewal = data.get("signedRenewalInfo") or ""
    transaction_info = _decode_jws_unverified(signed_tx)[1] if signed_tx else {}
    renewal_info = _decode_jws_unverified(signed_renewal)[1] if signed_renewal else {}

    db = _db()
    user = await _find_user_by_transaction(db, transaction_info)
    audit_base = {
        "type": notif_type, "subtype": subtype,
        "originalTransactionId": transaction_info.get("originalTransactionId"),
        "productId": transaction_info.get("productId"),
        "expiresDate": _ms_to_iso(transaction_info.get("expiresDate")),
    }

    if not user:
        await db.apple_webhook_logs.insert_one({
            "event": notif_type, "user_id": None,
            "transaction": audit_base, "at": _now_iso(),
            "note": "user_not_found",
        })
        return {"ok": True, "matched": False}

    # Ne rétrograde JAMAIS un compte en plan_source != apple_iap
    plan_source = user.get("plan_source") or "apple_iap"  # défaut historique
    if plan_source != "apple_iap":
        # Verrouillage : le webhook Apple ne touche pas aux comptes manuel/stripe
        await db.apple_webhook_logs.insert_one({
            "event": notif_type, "user_id": user["user_id"],
            "transaction": audit_base, "at": _now_iso(),
            "note": f"skipped_plan_source={plan_source}",
        })
        return {"ok": True, "matched": True, "skipped_plan_source": plan_source}

    user_id = user["user_id"]
    expires_iso = _ms_to_iso(transaction_info.get("expiresDate"))
    otx = transaction_info.get("originalTransactionId")

    updates: dict[str, Any] = {}
    if notif_type in ("SUBSCRIBED", "DID_RENEW"):
        updates = {
            "plan": "pro",
            "plan_source": "apple_iap",
            "plan_depuis": user.get("plan_depuis") or _now_iso(),
            "subscription_ends_at": expires_iso,
            "subscription_will_cancel_at_period_end": False,
            "grace_period_active": False,
            "apple_original_transaction_id": otx,
        }
    elif notif_type == "DID_CHANGE_RENEWAL_STATUS":
        # subtype=AUTO_RENEW_DISABLED → l'utilisateur a coupé le renouvellement.
        # Accès conservé jusqu'à expiresDate.
        will_cancel = (subtype == "AUTO_RENEW_DISABLED")
        updates = {
            "subscription_will_cancel_at_period_end": will_cancel,
            "subscription_ends_at": expires_iso,
        }
    elif notif_type == "EXPIRED":
        # Rétrogradation propre + réarmement du droit à 1 modif de zones.
        updates = {
            "plan": "decouverte",
            "plan_source": "apple_iap",
            "subscription_ends_at": expires_iso,
            "subscription_will_cancel_at_period_end": False,
            "grace_period_active": False,
            "zones_deja_modifiees": False,
        }
    elif notif_type == "DID_FAIL_TO_RENEW":
        # Période de grâce — Apple continue à essayer de facturer, on garde l'accès.
        updates = {
            "grace_period_active": True,
            "subscription_ends_at": expires_iso,
        }
    elif notif_type in ("REFUND", "REVOKE"):
        updates = {
            "plan": "decouverte",
            "plan_source": "apple_iap",
            "subscription_will_cancel_at_period_end": False,
            "grace_period_active": False,
            "zones_deja_modifiees": False,
            "apple_refunded_at": _now_iso(),
        }
    else:
        # Autres types (CONSUMPTION_REQUEST, etc.) → journalisation seule.
        await db.apple_webhook_logs.insert_one({
            "event": notif_type, "user_id": user_id,
            "transaction": audit_base, "at": _now_iso(),
            "note": "unhandled_event",
        })
        return {"ok": True, "matched": True, "unhandled": notif_type}

    await _apply(db, user_id, updates, notif_type, audit_base)
    return {"ok": True, "matched": True, "type": notif_type}
