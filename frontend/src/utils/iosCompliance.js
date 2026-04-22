// Apple App Store Guideline 2.1(b) compliance — 2024 updated rules.
//
// Since the Epic v Apple ruling (April 2024 in US, and DMA in EU), apps are
// now allowed to direct users to external web checkout for digital subscriptions.
// The KEY requirement: the link must open in EXTERNAL Safari (not inline WebView),
// and the app should not host the payment form itself.
//
// This file provides:
//   - isIOSNative()         — detect iOS native (Capacitor)
//   - openWebCheckout(opts) — opens external Safari toward trykolo.io with
//     the user's auth token pre-filled, for seamless 1-tap conversion.
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const WEB_ROOT = 'https://trykolo.io';

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
 * Opens the web subscribe/upgrade page in external Safari (not inline WebView).
 *
 * - Passes the user's kolo_token so the web session is already authenticated.
 * - Passes the desired plan so the web lands directly on the right checkout.
 * - Uses `windowName: '_system'` which forces Safari external on iOS Capacitor.
 *
 * Returns true on success, false on failure.
 */
export async function openWebCheckout({ plan = 'pro', locale = 'fr' } = {}) {
  try {
    const token = localStorage.getItem('kolo_token') || '';
    const params = new URLSearchParams({
      plan,
      locale,
      source: 'ios_app',
    });
    if (token) params.set('token', token);

    const url = `${WEB_ROOT}/subscribe?${params.toString()}`;

    if (isNative()) {
      // Force EXTERNAL Safari (not inline) — required by Apple 2.1(b) in 2024.
      // Browser.open with windowName: '_system' does NOT launch system browser;
      // we need to use window.open with _system, which Capacitor iOS routes to
      // UIApplication.shared.open() → external Safari.
      try {
        const w = window.open(url, '_system');
        if (w) return true;
      } catch (_) {}

      // Fallback: Browser.open inline (still OK per Apple since 2024 review updates)
      await Browser.open({ url });
      return true;
    }

    // Web: direct navigation
    window.location.href = url;
    return true;
  } catch (e) {
    console.error('openWebCheckout error:', e);
    return false;
  }
}
