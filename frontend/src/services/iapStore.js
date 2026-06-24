// Apple StoreKit 2 In-App Purchases service — direct integration, no third-party.
//
// Uses cordova-plugin-purchase v13 with the StoreKit 2 adapter. On purchase,
// the Apple receipt is sent to our FastAPI backend (`/api/iap/verify-apple-receipt`)
// which contacts Apple's verifyReceipt endpoint, confirms the receipt, and
// updates MongoDB (users.plan / subscription_status).
//
// Defensive design: every async step has a hard timeout so the UI can never
// hang indefinitely, even if the App Store or our backend is unresponsive.
//
// Products (mirror App Store Connect subscription group "KOLO PRO"):
//   - PRO               (monthly) → plan "pro"
//   - PRO_Plus          (monthly) → plan "pro_plus"
//   - Pro_simple_yearly (annual)  → plan "pro"
//   - PROYearly         (annual)  → plan "pro_plus"
import { Capacitor } from '@capacitor/core';
import 'cordova-plugin-purchase';

const API_URL = 'https://trykolo.io';

export const PRODUCT_IDS = {
  // Un seul produit IAP actif Apple = "PRO_Plus" affiché "KOLO PRO" 24,99€/mois
  pro_monthly: 'PRO_Plus',
  pro_plus_monthly: 'PRO_Plus',
  pro_yearly: 'PRO_Plus',
  pro_plus_yearly: 'PRO_Plus',
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
let _initializing = null;
let _currentUserId = null;
let _currentToken = null;
const _verifiedListeners = new Set();

function log(...args) {
  try { console.log('[IAP]', ...args); } catch (_) {}
}

// Hard timeout helper — every async network call must use this.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timeout:${label || 'unknown'}`)), ms)
    ),
  ]);
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
 * Send the Apple receipt to our backend with a hard 12s timeout.
 * Even if the backend is down, we never block the user indefinitely.
 */
async function verifyReceiptWithBackend({ receipt, productId }) {
  if (!_currentToken || !receipt) {
    return { success: false, error: 'missing_auth_or_receipt' };
  }
  try {
    log('verifying receipt with backend for product', productId);
    const res = await withTimeout(
      fetch(`${API_URL}/api/iap/verify-apple-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${_currentToken}`,
        },
        body: JSON.stringify({ receipt, product_id: productId || null }),
      }),
      12000,
      'verify-receipt'
    );
    const data = await res.json();
    if (!res.ok) {
      log('backend verify failed', res.status, data);
      return { success: false, error: data?.detail || 'verify_failed' };
    }
    log('backend verify ok', data);
    return { success: true, ...data };
  } catch (e) {
    log('backend verify error', e?.message || e);
    return { success: false, error: e?.message || 'network_error' };
  }
}

export function setIAPUser({ userId, token }) {
  if (userId) _currentUserId = String(userId);
  if (token) _currentToken = token;
}

/**
 * Initialize cordova-plugin-purchase + register our subscription products.
 * Idempotent. Hard 25s timeout so we never hang on store.initialize().
 */
export async function initIAP({ userId, token } = {}) {
  if (!isIOSNative()) return { ok: false, reason: 'not_ios' };

  setIAPUser({ userId, token });

  if (_initializing) return _initializing;
  if (_initialized && _store) return { ok: true };

  _initializing = (async () => {
    try {
      _CdvPurchase = window.CdvPurchase;
      if (!_CdvPurchase || !_CdvPurchase.store) {
        log('CdvPurchase global not available — plugin may not be synced to iOS');
        return { ok: false, reason: 'plugin_not_available' };
      }
      const { store, ProductType, Platform, LogLevel } = _CdvPurchase;
      _store = store;
      store.verbosity = LogLevel.WARNING;

      store.register([
        { id: PRODUCT_IDS.pro_monthly, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.APPLE_APPSTORE },
        { id: PRODUCT_IDS.pro_plus_monthly, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.APPLE_APPSTORE },
        { id: PRODUCT_IDS.pro_yearly, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.APPLE_APPSTORE },
        { id: PRODUCT_IDS.pro_plus_yearly, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.APPLE_APPSTORE },
      ]);

      // Receipt verification flow — fire and forget, but with verification timeouts.
      store
        .when()
        .approved(async (transaction) => {
          try {
            // Use the parent receipt's appStoreReceipt (full base64 data) — the
            // only reliable source. transactionId alone is NOT a valid receipt.
            const receipt =
              transaction.parentReceipt?.nativeData?.appStoreReceipt ||
              transaction.nativeData?.appStoreReceipt ||
              null;
            const productId =
              transaction.products?.[0]?.id ||
              transaction.products?.[0]?.productId ||
              null;
            log('transaction approved', productId, 'has-receipt:', !!receipt);

            if (!receipt) {
              // Without a receipt we can't verify — but we MUST finish the
              // transaction or StoreKit will retry forever.
              log('no receipt available — finishing tx anyway');
              transaction.finish();
              emitVerified({ plan: PRODUCT_TO_PLAN[productId] || null, status: 'unknown', productId });
              return;
            }

            const verify = await verifyReceiptWithBackend({ receipt, productId });
            // ALWAYS finish the transaction so StoreKit doesn't loop. Backend
            // verification can also be re-tried via Restore Purchases.
            transaction.finish();
            emitVerified({
              plan: verify.success ? verify.plan : (PRODUCT_TO_PLAN[productId] || null),
              status: verify.success ? verify.status : 'pending_verification',
              productId,
            });
          } catch (e) {
            log('approved handler error', e);
            try { transaction.finish(); } catch (_) {}
          }
        })
        .verified((receipt) => {
          try { receipt.finish(); } catch (_) {}
        })
        .finished((_t) => { log('transaction finished'); });

      store.error((err) => {
        log('store error', err?.code, err?.message);
      });

      // Hard timeout on store.initialize — Apple's reviewer device can be slow.
      await withTimeout(
        store.initialize([_CdvPurchase.Platform.APPLE_APPSTORE]),
        25000,
        'store-initialize'
      );
      try { store.applicationUsername = _currentUserId || ''; } catch (_) {}
      _initialized = true;
      log('IAP initialized successfully');
      return { ok: true };
    } catch (e) {
      log('init failed', e?.message || e);
      // Mark as initialized anyway — we may still try to order on click,
      // and the plugin handles partial init better than no init at all.
      _initialized = true;
      return { ok: false, reason: 'init_error', error: String(e?.message || e) };
    } finally {
      _initializing = null;
    }
  })();

  return _initializing;
}

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

export function areProductsReady() {
  if (!_initialized || !_store || !_CdvPurchase) return false;
  const { Platform } = _CdvPurchase;
  for (const id of Object.values(PRODUCT_IDS)) {
    const p = _store.get(id, Platform.APPLE_APPSTORE);
    if (p && (p.canPurchase || p.pricing?.price)) return true;
  }
  return false;
}

/**
 * Wait until at least one product has loaded its pricing — that's the real
 * signal that the App Store has answered.
 */
async function ensureReady(timeoutMs = 8000) {
  if (!_initialized && !_initializing && _currentUserId && _currentToken) {
    initIAP({ userId: _currentUserId, token: _currentToken });
  }
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (areProductsReady()) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 250));
  }
  return areProductsReady();
}

/**
 * Purchase a (plan, billingPeriod) combo via Apple StoreKit.
 *
 * Hard-timed at every step — never hangs:
 *   - init wait     : 8 s
 *   - store update  : 5 s (if products not loaded)
 *   - store.order   : 60 s (Apple dialog itself)
 */
export async function purchasePlan(plan, billingPeriod = 'monthly') {
  if (!isIOSNative()) return { success: false, error: 'not_ios' };

  if (!_initialized && !_initializing) {
    if (_currentUserId && _currentToken) {
      initIAP({ userId: _currentUserId, token: _currentToken });
    }
  }

  const ready = await ensureReady(8000);
  if (!ready && _store && typeof _store.update === 'function') {
    try {
      await withTimeout(_store.update(), 5000, 'store-update');
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      log('store.update failed', e?.message || e);
    }
  }

  if (!_store || !_CdvPurchase) {
    return { success: false, error: 'not_initialized' };
  }

  const { Platform } = _CdvPurchase;
  const productId = getProductId(plan, billingPeriod);
  if (!productId) return { success: false, error: 'unknown_plan' };

  const product = _store.get(productId, Platform.APPLE_APPSTORE);
  if (!product) return { success: false, error: 'product_not_found' };
  if (!product.canPurchase) return { success: false, error: 'product_unavailable' };

  try {
    const offer = product.getOffer();
    if (!offer) return { success: false, error: 'no_offer' };
    log('placing order for', productId);
    // Apple's purchase dialog can be open up to ~2 min. We cap at 60 s for
    // safety so the UI can't hang forever. Cancellation is reported via the
    // PAYMENT_CANCELLED error code.
    await withTimeout(_store.order(offer), 60000, 'store-order');
    return { success: true, pending: true };
  } catch (e) {
    if (e?.code === _CdvPurchase?.ErrorCode?.PAYMENT_CANCELLED) {
      return { success: false, userCancelled: true };
    }
    if (String(e?.message || '').startsWith('timeout:')) {
      return { success: false, error: 'apple_timeout' };
    }
    return { success: false, error: e?.message || String(e) };
  }
}

export async function restorePurchases() {
  if (!isIOSNative()) return { success: false, error: 'not_ios' };
  await ensureReady(5000);
  if (!_store) return { success: false, error: 'not_initialized' };
  try {
    await withTimeout(_store.restorePurchases(), 30000, 'store-restore');
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

export async function silentRefreshReceipt() {
  if (!isIOSNative()) return { success: false, error: 'not_ios' };
  // Don't block — fire and forget with short timeout
  if (!_store) return { success: false, error: 'not_initialized' };
  try {
    await withTimeout(_store.restorePurchases(), 8000, 'silent-refresh');
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}
