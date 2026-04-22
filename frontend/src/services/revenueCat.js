// RevenueCat In-App Purchases service — Apple App Store Guideline 2.1(b) compliant.
//
// Handles StoreKit subscriptions for iOS native only. On web/Android this
// service is a no-op — the app falls back to Stripe Checkout via PricingPage.
//
// Products (mirrored in App Store Connect subscription group "KOLO PRO"):
//   - PRO       → plan "pro"
//   - PRO_plus  → plan "pro_plus"
import { Capacitor } from '@capacitor/core';

// Public iOS SDK key from RevenueCat. This is a PUBLIC key, safe to ship.
// Inject via REACT_APP_REVENUECAT_IOS_KEY or override here before release.
const REVENUECAT_IOS_KEY =
  process.env.REACT_APP_REVENUECAT_IOS_KEY || '';

// Product identifiers (must match App Store Connect + RevenueCat exactly — case sensitive)
export const PRODUCT_IDS = {
  pro: 'PRO',
  pro_plus: 'PRO_plus',
};

// Plan inverse map (from RevenueCat product id → internal plan key)
export const PRODUCT_TO_PLAN = {
  PRO: 'pro',
  PRO_plus: 'pro_plus',
};

let _Purchases = null;
let _initialized = false;

function isIOSNative() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch (_) {
    return false;
  }
}

/**
 * Lazy-import RevenueCat SDK (avoids loading on web where it's not needed
 * and keeps the web bundle lean).
 */
async function getPurchases() {
  if (_Purchases) return _Purchases;
  const mod = await import('@revenuecat/purchases-capacitor');
  _Purchases = mod.Purchases || mod.default || mod;
  return _Purchases;
}

/**
 * Initialize RevenueCat SDK with the logged-in user id.
 * Safe to call multiple times — it's idempotent and a no-op on non-iOS.
 */
export async function initRevenueCat(userId) {
  if (!isIOSNative()) return { ok: false, reason: 'not_ios' };
  if (!REVENUECAT_IOS_KEY) {
    console.warn('[RevenueCat] Missing REACT_APP_REVENUECAT_IOS_KEY — IAP disabled');
    return { ok: false, reason: 'no_key' };
  }
  if (!userId) return { ok: false, reason: 'no_user' };

  try {
    const Purchases = await getPurchases();
    if (!_initialized) {
      await Purchases.configure({
        apiKey: REVENUECAT_IOS_KEY,
        appUserID: String(userId),
      });
      _initialized = true;
    } else {
      // If user changed (login/logout), re-identify
      try {
        await Purchases.logIn({ appUserID: String(userId) });
      } catch (_) {}
    }
    return { ok: true };
  } catch (e) {
    console.error('[RevenueCat] init failed:', e);
    return { ok: false, reason: 'init_error', error: e };
  }
}

/**
 * Fetch the current offering (PRO + PRO_plus).
 * Returns { pro: Package|null, pro_plus: Package|null } or null on error.
 */
export async function getOfferings() {
  if (!isIOSNative()) return null;
  try {
    const Purchases = await getPurchases();
    const result = await Purchases.getOfferings();
    const current = result?.current || result?.offerings?.current;
    if (!current) return null;

    const packages = current.availablePackages || [];
    const byProduct = {};
    for (const pkg of packages) {
      const productId =
        pkg?.product?.identifier || pkg?.product?.productId || pkg?.identifier;
      if (productId === PRODUCT_IDS.pro) byProduct.pro = pkg;
      if (productId === PRODUCT_IDS.pro_plus) byProduct.pro_plus = pkg;
    }
    return byProduct;
  } catch (e) {
    console.error('[RevenueCat] getOfferings failed:', e);
    return null;
  }
}

/**
 * Initiates the StoreKit purchase flow for a given plan.
 * Returns { success, customerInfo?, userCancelled?, error? }.
 */
export async function purchasePlan(plan) {
  if (!isIOSNative()) {
    return { success: false, error: 'not_ios' };
  }
  try {
    const offerings = await getOfferings();
    const pkg = offerings?.[plan];
    if (!pkg) {
      return { success: false, error: 'package_not_found' };
    }
    const Purchases = await getPurchases();
    const result = await Purchases.purchasePackage({ aPackage: pkg });
    return { success: true, customerInfo: result?.customerInfo };
  } catch (e) {
    if (e?.userCancelled || e?.code === 'PURCHASE_CANCELLED') {
      return { success: false, userCancelled: true };
    }
    console.error('[RevenueCat] purchase failed:', e);
    return { success: false, error: e?.message || String(e) };
  }
}

/**
 * Restore previous purchases — REQUIRED by Apple Guideline 3.1.1.
 * Returns { success, customerInfo?, activeProduct? }.
 */
export async function restorePurchases() {
  if (!isIOSNative()) return { success: false, error: 'not_ios' };
  try {
    const Purchases = await getPurchases();
    const res = await Purchases.restorePurchases();
    const customerInfo = res?.customerInfo || res;
    const active = customerInfo?.activeSubscriptions || [];
    return {
      success: true,
      customerInfo,
      activeProduct: active[0] || null,
    };
  } catch (e) {
    console.error('[RevenueCat] restore failed:', e);
    return { success: false, error: e?.message || String(e) };
  }
}

/**
 * Fetch current customer info (active subscriptions, expiration, etc.).
 */
export async function getCustomerInfo() {
  if (!isIOSNative()) return null;
  try {
    const Purchases = await getPurchases();
    const res = await Purchases.getCustomerInfo();
    return res?.customerInfo || res;
  } catch (e) {
    console.error('[RevenueCat] getCustomerInfo failed:', e);
    return null;
  }
}

/**
 * Log out from RevenueCat (called on user logout to prevent cross-user leakage).
 */
export async function logoutRevenueCat() {
  if (!isIOSNative() || !_initialized) return;
  try {
    const Purchases = await getPurchases();
    await Purchases.logOut();
  } catch (_) {}
}

export { isIOSNative };
