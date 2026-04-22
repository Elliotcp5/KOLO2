// iOS native platform helpers.
//
// The app uses native Apple StoreKit 2 IAP for iOS subscriptions
// (see /services/iapStore.js). This file is reduced to platform detection
// helpers + thin shims for legacy callers that used to open Safari.
//
// Apple compliance status:
//  - 2.1(b)  : ✅ Native Apple StoreKit 2 IAP (PRO / PRO_Plus / yearly variants)
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
 *   - iOS native → Apple StoreKit purchase
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
 */
export function showSubscribeOnWebAlert() {
  try {
    window.location.href = '/pricing';
  } catch (_) {}
}

/**
 * LEGACY SHIM — previously opened Safari for the Stripe web checkout.
 * Now redirects to /pricing where the native StoreKit IAP is presented on iOS.
 */
export async function openWebCheckout() {
  try {
    window.location.href = '/pricing';
    return true;
  } catch (_) {
    return false;
  }
}
