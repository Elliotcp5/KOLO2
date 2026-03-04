# KOLO - Payment Routes (Stripe)
from fastapi import APIRouter, HTTPException, Request
from starlette.responses import RedirectResponse
from datetime import datetime, timezone, timedelta
import os
import uuid
import logging
import stripe

from models import (
    CreateCheckoutRequest, CreateCheckoutResponse, GeoResponse,
    BillingPortalRequest, PaymentTransaction, PaymentSuccess
)
from database import get_db, require_active_subscription
from utils import get_pricing_for_country

logger = logging.getLogger(__name__)
router = APIRouter(tags=["payments"])

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
stripe.api_key = STRIPE_API_KEY

@router.get("/geo", response_model=GeoResponse)
async def get_geo_info(request: Request, locale: str = None, country: str = None):
    """Get geo-based pricing info"""
    detected_country = country or request.headers.get('CF-IPCountry', 'US')
    detected_locale = locale or request.headers.get('Accept-Language', 'en-US').split(',')[0]
    
    pricing = get_pricing_for_country(detected_country)
    
    return GeoResponse(
        country=detected_country,
        currency=pricing['currency'].upper(),
        amount=pricing['amount'],
        symbol=pricing['symbol'],
        locale=detected_locale
    )

@router.post("/payments/create-checkout", response_model=CreateCheckoutResponse)
async def create_checkout(request: CreateCheckoutRequest, http_request: Request):
    """Create Stripe checkout session"""
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest
    )
    
    country = request.country or http_request.headers.get('CF-IPCountry', 'US')
    pricing = get_pricing_for_country(country)
    
    success_url = f"{request.origin_url}/create-account?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/subscribe"
    
    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    checkout_request = CheckoutSessionRequest(
        amount=pricing['amount'],
        currency=pricing['currency'],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "email": request.email or "",
            "locale": request.locale or "en",
            "country": country,
            "type": "subscription"
        },
        payment_methods=['card']
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    db = get_db()
    transaction = PaymentTransaction(
        session_id=session.session_id,
        user_email=request.email,
        amount=pricing['amount'],
        currency=pricing['currency'],
        payment_status="pending",
        metadata={"country": country, "locale": request.locale}
    )
    txn_doc = transaction.model_dump()
    txn_doc['created_at'] = txn_doc['created_at'].isoformat()
    txn_doc['updated_at'] = txn_doc['updated_at'].isoformat()
    await db.payment_transactions.insert_one(txn_doc)
    
    return CreateCheckoutResponse(url=session.url, session_id=session.session_id)

@router.get("/payments/checkout-redirect")
async def checkout_redirect(http_request: Request, locale: str = "en", country: str = "US", email: str = ""):
    """Direct redirect to Stripe checkout with trial"""
    db = get_db()
    
    referer = http_request.headers.get('referer', '')
    if referer:
        from urllib.parse import urlparse
        parsed = urlparse(referer)
        origin_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        origin_url = str(http_request.base_url).rstrip('/')
    
    if email:
        existing_user = await db.users.find_one({
            "email": email,
            "subscription_status": "active"
        })
        if existing_user:
            return RedirectResponse(url=f"{origin_url}/subscribe?error=already_subscribed", status_code=303)
    
    pricing = get_pricing_for_country(country)
    success_url = f"{origin_url}/create-account?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/subscribe"
    
    try:
        price_lookup_key = f"kolo_trial_{pricing['currency'].lower()}"
        existing_prices = stripe.Price.list(lookup_keys=[price_lookup_key], limit=1)
        
        if existing_prices.data:
            price_id = existing_prices.data[0].id
        else:
            product = stripe.Product.create(
                name="Essayez KOLO",
                description="7 jours gratuits"
            )
            price = stripe.Price.create(
                product=product.id,
                unit_amount=pricing['amount'],
                currency=pricing['currency'].lower(),
                recurring={"interval": "month"},
                lookup_key=price_lookup_key
            )
            price_id = price.id
        
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            subscription_data={
                "trial_period_days": 7,
                "metadata": {"email": email, "locale": locale, "country": country}
            },
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"email": email, "locale": locale, "country": country, "type": "subscription_with_trial"}
        )
        
        return RedirectResponse(url=session.url, status_code=303)
    except Exception as e:
        logger.error(f"Checkout redirect error: {e}")
        return RedirectResponse(url=f"{origin_url}/subscribe?error=payment_failed", status_code=303)

@router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, http_request: Request):
    """Get payment status"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.error(f"Stripe status error: {e}")
        raise HTTPException(status_code=400, detail="Failed to get payment status")
    
    db = get_db()
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": status.payment_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    payment_token = None
    if status.payment_status == "paid":
        existing_token = await db.payment_success.find_one(
            {"session_id": session_id},
            {"_id": 0}
        )
        
        if existing_token:
            payment_token = existing_token["token"]
        else:
            email = status.metadata.get("email", "")
            token = PaymentSuccess(
                email=email,
                session_id=session_id,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
            )
            token_doc = token.model_dump()
            token_doc['expires_at'] = token_doc['expires_at'].isoformat()
            token_doc['created_at'] = token_doc['created_at'].isoformat()
            await db.payment_success.insert_one(token_doc)
            payment_token = token.token
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "payment_token": payment_token
    }

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    db = get_db()
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    try:
        event = stripe.Webhook.construct_event(
            body, signature, os.environ.get('STRIPE_WEBHOOK_SECRET', '')
        ) if signature and os.environ.get('STRIPE_WEBHOOK_SECRET') else None
        
        if not event:
            import json
            event_data = json.loads(body)
            event = stripe.Event.construct_from(event_data, stripe.api_key)
        
        event_type = event.type
        logger.info(f"Stripe webhook: {event_type}")
        
        if event_type in ["customer.subscription.created", "customer.subscription.updated"]:
            sub = event.data.object
            customer_id = sub.customer
            trial_end = datetime.fromtimestamp(sub.trial_end, tz=timezone.utc) if sub.trial_end else None
            
            current_period_end = None
            items_data = sub.get('items', {})
            if items_data and items_data.get('data'):
                item_period_end = items_data['data'][0].get('current_period_end')
                if item_period_end:
                    current_period_end = datetime.fromtimestamp(item_period_end, tz=timezone.utc)
            
            await db.users.update_one(
                {"stripe_customer_id": customer_id},
                {"$set": {
                    "subscription_id": sub.id,
                    "subscription_status": sub.status,
                    "trial_ends_at": trial_end.isoformat() if trial_end else None,
                    "subscription_ends_at": current_period_end.isoformat() if current_period_end else None,
                    "cancel_at_period_end": sub.cancel_at_period_end,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        elif event_type == "customer.subscription.deleted":
            sub = event.data.object
            await db.users.update_one(
                {"stripe_customer_id": sub.customer},
                {"$set": {
                    "subscription_status": "canceled",
                    "cancel_at_period_end": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        elif event_type == "checkout.session.completed":
            session = event.data.object
            email = session.metadata.get("email") or session.customer_email
            
            if email and session.subscription:
                sub = stripe.Subscription.retrieve(session.subscription)
                trial_end = datetime.fromtimestamp(sub.trial_end, tz=timezone.utc) if sub.trial_end else None
                
                await db.payment_success.insert_one({
                    "session_id": session.id,
                    "email": email,
                    "subscription_id": session.subscription,
                    "customer_id": session.customer,
                    "status": sub.status,
                    "trial_ends_at": trial_end.isoformat() if trial_end else None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "token": f"pay_{uuid.uuid4().hex}",
                    "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
                    "used": False
                })
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

@router.post("/billing/portal")
async def create_billing_portal(request: BillingPortalRequest, http_request: Request):
    """Create Stripe billing portal session"""
    user = await require_active_subscription(http_request)
    db = get_db()
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    stripe_customer_id = user_doc.get("stripe_customer_id") if user_doc else None
    
    if not stripe_customer_id:
        try:
            customers = stripe.Customer.list(email=user.email, limit=1)
            if customers.data:
                stripe_customer_id = customers.data[0].id
            else:
                customer = stripe.Customer.create(
                    email=user.email,
                    metadata={"user_id": user.user_id}
                )
                stripe_customer_id = customer.id
            
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$set": {"stripe_customer_id": stripe_customer_id}}
            )
        except Exception as e:
            logger.error(f"Stripe customer error: {e}")
            raise HTTPException(status_code=400, detail="Impossible de créer le profil de facturation.")
    
    try:
        referer = http_request.headers.get('referer', '')
        if referer:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            return_url = f"{parsed.scheme}://{parsed.netloc}/app"
        else:
            return_url = str(http_request.base_url).rstrip('/') + "/app"
        
        portal_session = stripe.billing_portal.Session.create(
            customer=stripe_customer_id,
            return_url=return_url
        )
        
        return {"url": portal_session.url}
    except Exception as e:
        logger.error(f"Billing portal error: {e}")
        raise HTTPException(status_code=500, detail="Impossible d'accéder au portail de facturation.")

@router.get("/subscription/status")
async def get_subscription_status(http_request: Request):
    """Get subscription status"""
    from routes.auth import get_current_user
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db()
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription_id = user_doc.get("subscription_id")
    if subscription_id:
        try:
            sub = stripe.Subscription.retrieve(subscription_id)
            trial_end = datetime.fromtimestamp(sub.trial_end, tz=timezone.utc) if sub.trial_end else None
            
            current_period_end = None
            items_data = sub.get('items', {})
            if items_data and items_data.get('data'):
                item_period_end = items_data['data'][0].get('current_period_end')
                if item_period_end:
                    current_period_end = datetime.fromtimestamp(item_period_end, tz=timezone.utc)
            
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {
                    "subscription_status": sub.status,
                    "trial_ends_at": trial_end.isoformat() if trial_end else None,
                    "subscription_ends_at": current_period_end.isoformat() if current_period_end else None,
                    "cancel_at_period_end": sub.cancel_at_period_end
                }}
            )
            
            return {
                "status": sub.status,
                "trial_ends_at": trial_end.isoformat() if trial_end else None,
                "subscription_ends_at": current_period_end.isoformat() if current_period_end else None,
                "cancel_at_period_end": sub.cancel_at_period_end,
                "is_active": sub.status in ["trialing", "active"]
            }
        except Exception as e:
            logger.error(f"Stripe subscription error: {e}")
    
    return {
        "status": user_doc.get("subscription_status", "none"),
        "trial_ends_at": user_doc.get("trial_ends_at"),
        "subscription_ends_at": user_doc.get("subscription_ends_at"),
        "cancel_at_period_end": user_doc.get("cancel_at_period_end", False),
        "is_active": user_doc.get("subscription_status") in ["trialing", "active"]
    }

@router.post("/subscription/cancel")
async def cancel_subscription(http_request: Request):
    """Cancel subscription at period end"""
    from routes.auth import get_current_user
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db()
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription_id = user_doc.get("subscription_id")
    if not subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    try:
        sub = stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)
        
        current_period_end = None
        items_data = sub.get('items', {})
        if items_data and items_data.get('data'):
            item_period_end = items_data['data'][0].get('current_period_end')
            if item_period_end:
                current_period_end = datetime.fromtimestamp(item_period_end, tz=timezone.utc)
        
        if not current_period_end and sub.trial_end:
            current_period_end = datetime.fromtimestamp(sub.trial_end, tz=timezone.utc)
        
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {
                "cancel_at_period_end": True,
                "subscription_ends_at": current_period_end.isoformat() if current_period_end else None
            }}
        )
        
        return {
            "message": "Subscription will be cancelled at end of period",
            "ends_at": current_period_end.isoformat() if current_period_end else None
        }
    except Exception as e:
        logger.error(f"Cancel subscription error: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel subscription")

@router.post("/subscription/reactivate")
async def reactivate_subscription(http_request: Request):
    """Reactivate cancelled subscription"""
    from routes.auth import get_current_user
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db()
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription_id = user_doc.get("subscription_id")
    if not subscription_id:
        raise HTTPException(status_code=400, detail="No subscription found")
    
    try:
        sub = stripe.Subscription.modify(subscription_id, cancel_at_period_end=False)
        
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {
                "cancel_at_period_end": False,
                "subscription_status": sub.status
            }}
        )
        
        return {"message": "Subscription reactivated", "status": sub.status}
    except Exception as e:
        logger.error(f"Reactivate subscription error: {e}")
        raise HTTPException(status_code=500, detail="Failed to reactivate subscription")

@router.post("/payments/validate-token")
async def validate_payment_token(token: str):
    """Validate payment token"""
    db = get_db()
    token_doc = await db.payment_success.find_one(
        {"token": token, "used": False},
        {"_id": 0}
    )
    
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or used token")
    
    expires_at = token_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    
    return {"valid": True, "email": token_doc.get("email")}
