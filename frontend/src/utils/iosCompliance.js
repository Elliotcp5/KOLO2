// iOS native platform helpers.
//
// Historically this file redirected iOS users to an external Safari checkout
// to comply with Apple 2.1(b). Since we now use native StoreKit IAP via
// RevenueCat (see /services/revenueCat.js), this file is reduced to platform
// detection helpers + thin shims for legacy callers.
//
// Apple compliance status:
//  - 2.1(b)  : ✅ Native StoreKit IAP via RevenueCat (PRO / PRO_plus)
//  - 3.1.1   : ✅ Restore Purchases exposed on PricingPage
//  - 5.1.1(v): ✅ Account deletion (DELETE /api/auth/me)
import { Capacitor } from '@capacitor/core';

export function isIOSNative() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch (_) {
    return false;
  }
}

export function isNative() {
  try {
    return Capacitor.isNativePlatform();
  } catch (_) {
    return false;
  }
}

/**
 * Trigger the upgrade flow from any feature-gated entry point.
 * Works on all platforms — PricingPage itself decides:
 *   - iOS native → RevenueCat StoreKit purchase
 *   - Web / Android → Stripe Checkout
 *
 * Pass the react-router `navigate` function from the caller.
 */
export function triggerUpgradeFlow(navigate) {
  try {
    if (typeof navigate === 'function') {
      navigate('/pricing');
      return;
    }
  } catch (_) {}
  try {
    window.location.href = '/pricing';
  } catch (_) {}
}

/**
 * LEGACY SHIM — kept to avoid breaking older imports during the IAP rollout.
 * Callers should migrate to triggerUpgradeFlow(navigate).
 * This simply navigates to /pricing where the native IAP flow is offered.
 */
export function showSubscribeOnWebAlert() {
  try {
    window.location.href = '/pricing';
  } catch (_) {}
}

/**
 * LEGACY SHIM — previously opened Safari. Now redirects to /pricing where
 * the native RevenueCat IAP is presented for iOS.
 */
export async function openWebCheckout() {
  try {
    window.location.href = '/pricing';
    return true;
  } catch (_) {
    return false;
  }
}
