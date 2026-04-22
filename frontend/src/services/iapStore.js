// Apple StoreKit 2 In-App Purchases service — direct integration, no third-party.
//
// Uses cordova-plugin-purchase v13 with the StoreKit 2 adapter. On purchase,
// the Apple receipt is sent to our FastAPI backend (`/api/iap/verify-apple-receipt`)
// which contacts Apple's verifyReceipt endpoint, confirms the receipt, and
// updates MongoDB (users.plan / subscription_status).
//
// Products (mirror App Store Connect subscription group "KOLO PRO"):
//   - PRO       → plan "pro"
//   - PRO_plus  → plan "pro_plus"
import { Capacitor } from '@capacitor/core';

const API_URL = 'https://trykolo.io';

// Product identifiers (must match App Store Connect EXACTLY — case sensitive).
// These are the Product IDs declared in App Store Connect → In-App Purchases.
export const PRODUCT_IDS = {
  pro_monthly: 'PRO',
  pro_plus_monthly: 'PRO_Plus',
  pro_yearly: 'Pro_simple_yearly',
  pro_plus_yearly: 'PROYearly',
};

// Backwards-compat aliases for callers that just know plan = 'pro' | 'pro_plus'
// and a billing period. Use getProductId(plan, billing) below.
export function getProductId(plan, billingPeriod = 'monthly') {
  if (plan === 'pro') {
    return billingPeriod === 'annual' ? PRODUCT_IDS.pro_yearly : PRODUCT_IDS.pro_monthly;
  }
  if (plan === 'pro_plus') {
    return billingPeriod === 'annual' ? PRODUCT_IDS.pro_plus_yearly : PRODUCT_IDS.pro_plus_monthly;
  }
  return null;
}

export const PRODUCT_TO_PLAN = {
  PRO: 'pro',
  PRO_Plus: 'pro_plus',
  Pro_simple_yearly: 'pro',
  PROYearly: 'pro_plus',
};

let _store = null;
let _CdvPurchase = null;
let _initialized = false;
let _currentUserId = null;
let _currentToken = null;
// Subscribers notified when a purchase/renewal/restore is confirmed by the backend.
const _verifiedListeners = new Set();

export function isIOSNative() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch (_) {
    return false;
  }
}

function emitVerified(payload) {
  for (const fn of _verifiedListeners) {
    try { fn(payload); } catch (_) {}
  }
}

export function onPurchaseVerified(listener) {
  _verifiedListeners.add(listener);
  return () => _verifiedListeners.delete(listener);
}

/**
 * Send the Apple receipt to our backend for server-side verification
 * against Apple's verifyReceipt API. Returns { success, plan, status }.
 */
async function verifyReceiptWithBackend({ receipt, productId }) {
  if (!_currentToken || !receipt) return { success: false, error: 'missing_auth_or_receipt' };
  try {
    const res = await fetch(`${API_URL}/api/iap/verify-apple-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${_currentToken}`,
      },
      body: JSON.stringify({
        receipt,
        product_id: productId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data?.detail || 'verify_failed' };
    return { success: true, ...data };
  } catch (e) {
    return { success: false, error: e?.message || 'network_error' };
  }
}

/**
 * Initialize cordova-plugin-purchase + register our 2 subscription products.
 * Safe to call multiple times — idempotent.
 */
export async function initIAP({ userId, token }) {
  if (!isIOSNative()) return { ok: false, reason: 'not_ios' };
  if (!userId || !token) return { ok: false, reason: 'no_auth' };

  _currentUserId = String(userId);
  _currentToken = token;

  if (_initialized && _store) return { ok: true };

  try {
    const mod = await import('cordova-plugin-purchase');
    _CdvPurchase = mod.CdvPurchase || mod.default || mod;
    const { store, ProductType, Platform, LogLevel } = _CdvPurchase;
    _store = store;
    store.verbosity = LogLevel.WARNING;

    // Register products — all 4 subscriptions declared in App Store Connect
    store.register([
      {
        id: PRODUCT_IDS.pro_monthly,
        type: ProductType.PAID_SUBSCRIPTION,
        platform: Platform.APPLE_APPSTORE,
      },
      {
        id: PRODUCT_IDS.pro_plus_monthly,
        type: ProductType.PAID_SUBSCRIPTION,
        platform: Platform.APPLE_APPSTORE,
      },
      {
        id: PRODUCT_IDS.pro_yearly,
        type: ProductType.PAID_SUBSCRIPTION,
        platform: Platform.APPLE_APPSTORE,
      },
      {
        id: PRODUCT_IDS.pro_plus_yearly,
        type: ProductType.PAID_SUBSCRIPTION,
        platform: Platform.APPLE_APPSTORE,
      },
    ]);

    // Receipt verification flow: Apple → 'approved' → send to backend → 'finish()'
    store
      .when()
      .approved(async (transaction) => {
        try {
          const receipt = transaction.parentReceipt?.nativeData?.appStoreReceipt
            || transaction.nativeData?.appStoreReceipt
            || transaction.transactionId;
          const productId = transaction.products?.[0]?.id
            || transaction.products?.[0]
            || null;
          const verify = await verifyReceiptWithBackend({ receipt, productId });
          if (verify.success) {
            transaction.finish();
            emitVerified({
              plan: verify.plan,
              status: verify.status,
              productId,
            });
          }
        } catch (e) {
          console.error('[IAP] approved handler error:', e);
        }
      })
      .verified((receipt) => receipt.finish())
      .finished((_t) => {});

    // Error handler — surface any store-level errors to console for debugging
    store.error((err) => {
      console.warn('[IAP] store error:', err?.code, err?.message);
    });

    await store.initialize([_CdvPurchase.Platform.APPLE_APPSTORE]);
    // Identify the user so Apple's appAccountToken can carry our user_id.
    try { store.applicationUsername = _currentUserId; } catch (_) {}
    _initialized = true;
    return { ok: true };
  } catch (e) {
    console.error('[IAP] init failed:', e);
    return { ok: false, reason: 'init_error', error: e };
  }
}

/**
 * Returns { pro_monthly, pro_plus_monthly, pro_yearly, pro_plus_yearly } with
 * localized price strings (product.pricing.price) coming from StoreKit.
 */
export function getProducts() {
  if (!_store || !_CdvPurchase) return null;
  const { Platform } = _CdvPurchase;
  return {
    pro_monthly: _store.get(PRODUCT_IDS.pro_monthly, Platform.APPLE_APPSTORE) || null,
    pro_plus_monthly: _store.get(PRODUCT_IDS.pro_plus_monthly, Platform.APPLE_APPSTORE) || null,
    pro_yearly: _store.get(PRODUCT_IDS.pro_yearly, Platform.APPLE_APPSTORE) || null,
    pro_plus_yearly: _store.get(PRODUCT_IDS.pro_plus_yearly, Platform.APPLE_APPSTORE) || null,
  };
}

/**
 * Launch Apple's StoreKit purchase UI for (plan, billingPeriod).
 *   plan          : 'pro' | 'pro_plus'
 *   billingPeriod : 'monthly' | 'annual'
 * Returns { success, pending?, userCancelled?, error? }.
 */
export async function purchasePlan(plan, billingPeriod = 'monthly') {
  if (!isIOSNative()) return { success: false, error: 'not_ios' };
  if (!_store || !_CdvPurchase) return { success: false, error: 'not_initialized' };

  const { Platform } = _CdvPurchase;
  const productId = getProductId(plan, billingPeriod);
  if (!productId) return { success: false, error: 'unknown_plan' };

  const product = _store.get(productId, Platform.APPLE_APPSTORE);
  if (!product || !product.canPurchase) {
    return { success: false, error: 'product_unavailable' };
  }

  try {
    const offer = product.getOffer();
    if (!offer) return { success: false, error: 'no_offer' };
    await _store.order(offer);
    return { success: true, pending: true };
  } catch (e) {
    if (e?.code === _CdvPurchase.ErrorCode?.PAYMENT_CANCELLED) {
      return { success: false, userCancelled: true };
    }
    return { success: false, error: e?.message || String(e) };
  }
}

/**
 * Restore previous purchases — required by Apple Guideline 3.1.1.
 * Triggers Apple's native restore flow; any active subscription will be
 * re-delivered via the `.approved()` handler.
 */
export async function restorePurchases() {
  if (!isIOSNative() || !_store) return { success: false, error: 'not_ios' };
  try {
    await _store.restorePurchases();
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}
