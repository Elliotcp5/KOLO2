// Apple StoreKit 2 In-App Purchases service — direct integration, no third-party.
//
// Uses cordova-plugin-purchase v13 with the StoreKit 2 adapter. On purchase,
// the Apple receipt is sent to our FastAPI backend (`/api/iap/verify-apple-receipt`)
// which contacts Apple's verifyReceipt endpoint, confirms the receipt, and
// updates MongoDB (users.plan / subscription_status).
//
// Products (mirror App Store Connect subscription group "KOLO PRO"):
//   - PRO               (monthly) → plan "pro"
//   - PRO_Plus          (monthly) → plan "pro_plus"
//   - Pro_simple_yearly (annual)  → plan "pro"
//   - PROYearly         (annual)  → plan "pro_plus"
import { Capacitor } from '@capacitor/core';
// Static import — bundled at build-time so it is guaranteed to be available
// on first access. (Dynamic import() is not reliable inside WKWebView.)
import 'cordova-plugin-purchase';

const API_URL = 'https://trykolo.io';

// Product identifiers (must match App Store Connect EXACTLY — case sensitive).
export const PRODUCT_IDS = {
  pro_monthly: 'PRO',
  pro_plus_monthly: 'PRO_Plus',
  pro_yearly: 'Pro_simple_yearly',
  pro_plus_yearly: 'PROYearly',
};

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
let _initializing = null; // in-flight init promise, for de-dupe
let _currentUserId = null;
let _currentToken = null;
const _verifiedListeners = new Set();

function log(...args) {
  try { console.log('[IAP]', ...args); } catch (_) {}
}

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
 * Send the Apple receipt to our backend for server-side verification.
 */
async function verifyReceiptWithBackend({ receipt, productId }) {
  if (!_currentToken || !receipt) return { success: false, error: 'missing_auth_or_receipt' };
  try {
    log('verifying receipt with backend for product', productId);
    const res = await fetch(`${API_URL}/api/iap/verify-apple-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${_currentToken}`,
      },
      body: JSON.stringify({ receipt, product_id: productId || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      log('backend verify failed', res.status, data);
      return { success: false, error: data?.detail || 'verify_failed' };
    }
    log('backend verify ok', data);
    return { success: true, ...data };
  } catch (e) {
    log('backend verify network error', e);
    return { success: false, error: e?.message || 'network_error' };
  }
}

/**
 * Update the auth context. Safe to call before or after init.
 * If init is pending and we now have credentials, kicks it off.
 */
export function setIAPUser({ userId, token }) {
  if (userId) _currentUserId = String(userId);
  if (token) _currentToken = token;
}

/**
 * Initialize cordova-plugin-purchase + register our subscription products.
 * Idempotent & de-duplicated — safe to call from multiple places.
 */
export async function initIAP({ userId, token } = {}) {
  if (!isIOSNative()) return { ok: false, reason: 'not_ios' };

  setIAPUser({ userId, token });

  // Reuse an in-flight init
  if (_initializing) return _initializing;
  if (_initialized && _store) return { ok: true };

  _initializing = (async () => {
    try {
      // cordova-plugin-purchase exposes a global CdvPurchase once the bundle
      // is loaded. Static import above guarantees availability at this point.
      _CdvPurchase = window.CdvPurchase;
      if (!_CdvPurchase || !_CdvPurchase.store) {
        log('CdvPurchase global not available — plugin may not be synced to iOS project');
        return { ok: false, reason: 'plugin_not_available' };
      }
      const { store, ProductType, Platform, LogLevel } = _CdvPurchase;
      _store = store;
      store.verbosity = LogLevel.DEBUG;

      // Register all 4 products
      store.register([
        { id: PRODUCT_IDS.pro_monthly, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.APPLE_APPSTORE },
        { id: PRODUCT_IDS.pro_plus_monthly, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.APPLE_APPSTORE },
        { id: PRODUCT_IDS.pro_yearly, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.APPLE_APPSTORE },
        { id: PRODUCT_IDS.pro_plus_yearly, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.APPLE_APPSTORE },
      ]);

      // Receipt verification flow
      store
        .when()
        .approved(async (transaction) => {
          try {
            const receipt =
              transaction.parentReceipt?.nativeData?.appStoreReceipt ||
              transaction.nativeData?.appStoreReceipt ||
              transaction.transactionId;
            const productId =
              transaction.products?.[0]?.id ||
              transaction.products?.[0] ||
              null;
            log('transaction approved', productId);
            const verify = await verifyReceiptWithBackend({ receipt, productId });
            if (verify.success) {
              transaction.finish();
              emitVerified({ plan: verify.plan, status: verify.status, productId });
            } else {
              log('verify rejected, not finishing transaction (will retry on next app open)');
            }
          } catch (e) {
            log('approved handler error', e);
          }
        })
        .verified((receipt) => receipt.finish())
        .finished((_t) => { log('transaction finished'); });

      store.error((err) => {
        log('store error', err?.code, err?.message);
      });

      await store.initialize([_CdvPurchase.Platform.APPLE_APPSTORE]);
      try { store.applicationUsername = _currentUserId || ''; } catch (_) {}
      _initialized = true;
      log('IAP initialized successfully');
      return { ok: true };
    } catch (e) {
      log('init failed', e);
      return { ok: false, reason: 'init_error', error: String(e) };
    } finally {
      _initializing = null;
    }
  })();

  return _initializing;
}

/**
 * Fetches current products from the store. Returns null until initialized.
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
 * Wait until the store is initialized and products are loaded, or timeout.
 */
async function ensureReady(timeoutMs = 8000) {
  if (_initialized && _store) return true;
  if (!_initializing) {
    // No init in-flight and we have credentials stored — kick one off
    if (_currentUserId && _currentToken) {
      initIAP({ userId: _currentUserId, token: _currentToken });
    } else {
      return false;
    }
  }
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (_initialized && _store) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 200));
  }
  return _initialized && _store;
}

/**
 * Purchase a (plan, billingPeriod) combo via Apple StoreKit.
 */
export async function purchasePlan(plan, billingPeriod = 'monthly') {
  if (!isIOSNative()) return { success: false, error: 'not_ios' };

  const ready = await ensureReady();
  if (!ready) return { success: false, error: 'not_initialized' };

  const { Platform } = _CdvPurchase;
  const productId = getProductId(plan, billingPeriod);
  if (!productId) return { success: false, error: 'unknown_plan' };

  const product = _store.get(productId, Platform.APPLE_APPSTORE);
  if (!product) {
    log('product not in store — check App Store Connect readiness', productId);
    return { success: false, error: 'product_not_found' };
  }
  if (!product.canPurchase) {
    log('product not purchasable', productId, 'state=', product.state);
    return { success: false, error: 'product_unavailable' };
  }

  try {
    const offer = product.getOffer();
    if (!offer) return { success: false, error: 'no_offer' };
    log('placing order for', productId);
    await _store.order(offer);
    return { success: true, pending: true };
  } catch (e) {
    if (e?.code === _CdvPurchase?.ErrorCode?.PAYMENT_CANCELLED) {
      return { success: false, userCancelled: true };
    }
    return { success: false, error: e?.message || String(e) };
  }
}

export async function restorePurchases() {
  if (!isIOSNative()) return { success: false, error: 'not_ios' };
  const ready = await ensureReady();
  if (!ready || !_store) return { success: false, error: 'not_initialized' };
  try {
    await _store.restorePurchases();
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

/**
 * Silent receipt refresh — asks the store to re-validate the current App Store
 * receipt against our backend, without showing any UI to the user.
 *
 * Should be called at app launch so the MongoDB `users.plan` field stays in
 * sync with Apple's latest subscription state (e.g. after a plan change or
 * expiration that happened while the app was closed).
 *
 * Implementation: the store persists the local receipt and fires `.approved()`
 * for the most recent active transaction on init; re-calling restorePurchases
 * is the official Apple-recommended way to re-sync. We do it silently —
 * the existing `.approved()` handler already verifies against our backend.
 */
export async function silentRefreshReceipt() {
  if (!isIOSNative()) return { success: false, error: 'not_ios' };
  const ready = await ensureReady();
  if (!ready || !_store) return { success: false, error: 'not_initialized' };
  try {
    await _store.restorePurchases();
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}
