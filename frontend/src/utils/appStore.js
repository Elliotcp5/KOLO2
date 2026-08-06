/**
 * Universal App Store CTA opener + scroll-lock safety net.
 *
 * Why a dedicated helper?
 * -----------------------
 * On iOS Safari, `<a target="_blank" rel="noreferrer" href="apps.apple.com/…">`
 * combined with a JS click handler (e.g. `trackCTA()`) is often **blocked by
 * the popup blocker** — the tap yields nothing visible, users leave.
 *
 * Inside Instagram / Facebook / TikTok / LinkedIn in-app browsers
 * (WKWebView), `https://apps.apple.com/…` only opens the App Store *web
 * page* inside the tiny in-app browser — it does NOT trigger the native App
 * Store app hand-off. Users see the page but can't download. This is the
 * root cause of "lots of visits, zero downloads" from social ads.
 *
 * Rules used here
 * ---------------
 *   - On iOS/iPadOS → use `itms-apps://` scheme. This forces the native
 *     App Store to open in ALL browser contexts, including Instagram,
 *     Facebook, TikTok, LinkedIn, Twitter and Safari itself.
 *   - Fallback: if the App Store doesn't take over the tab within 1.5 s,
 *     the page navigates to `https://apps.apple.com/…` as a graceful degrade
 *     (only fires if the page is still visible → the user is still stuck
 *     on the site because itms-apps was blocked).
 *   - Desktop → open in a new tab.
 */

import { trackCTA } from './koloTracker';

const APP_ID = '6761818371';
const APP_STORE_URL = `https://apps.apple.com/fr/app/kolo-ai-real-estate/id${APP_ID}`;
const APP_STORE_DEEPLINK = `itms-apps://apps.apple.com/fr/app/kolo-ai-real-estate/id${APP_ID}`;

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iPadOS = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
};

const isAndroid = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
};

const isMobile = () => isIOS() || isAndroid();

/**
 * Detect an in-app browser (Instagram, Facebook, TikTok, LinkedIn, Twitter,
 * Snapchat, WeChat, Line). These WebViews strip Universal Link handoff, so
 * we must use the `itms-apps://` deep link to reliably open the App Store.
 */
export const isInAppBrowser = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|Twitter|Line|MicroMessenger|LinkedInApp|Snapchat|TikTok|Pinterest/i.test(ua);
};

export const unlockScroll = () => {
  try {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.documentElement.style.overflow = '';
  } catch (_) { /* silent */ }
};

/**
 * Open the KOLO App Store page reliably across devices AND in-app browsers.
 * Call from a real user event (click/tap) — do not delay with async work.
 */
export const openAppStore = (ctaId) => {
  try { trackCTA(ctaId || 'unknown'); } catch (_) { /* silent */ }
  unlockScroll();
  if (typeof window === 'undefined') return;

  if (isIOS()) {
    // Primary: itms-apps:// forces the native App Store app to open,
    // even inside Instagram / Facebook / TikTok / LinkedIn in-app browsers.
    window.location.href = APP_STORE_DEEPLINK;

    // Fallback after 1.5 s: if the App Store didn't take over the tab
    // (visibility still "visible" = user still on site), navigate to the
    // regular https URL as a graceful degrade.
    setTimeout(() => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          window.location.href = APP_STORE_URL;
        }
      } catch (_) { /* silent */ }
    }, 1500);
    return;
  }

  if (isAndroid()) {
    // KOLO is iOS-only for now — send Android users to the App Store info page.
    window.location.href = APP_STORE_URL;
    return;
  }

  // Desktop: keep the marketing tab open, launch App Store in a new tab.
  const w = window.open(APP_STORE_URL, '_blank', 'noopener');
  if (!w) {
    window.location.href = APP_STORE_URL;
  }
};

/**
 * Ready-to-spread props for App Store `<a>` tags. Ensures the link stays
 * accessible (right-click, keyboard, no-JS) while the onClick handles all
 * the smart navigation.
 */
export const appStoreLinkProps = (ctaId) => ({
  href: APP_STORE_URL,
  onClick: (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    openAppStore(ctaId);
  },
});

export { APP_STORE_URL, APP_STORE_DEEPLINK, isIOS, isAndroid, isMobile };
