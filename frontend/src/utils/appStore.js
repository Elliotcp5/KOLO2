/**
 * Universal App Store CTA opener + scroll-lock safety net.
 *
 * Why a dedicated helper?
 * -----------------------
 * On iOS Safari, `<a target="_blank" rel="noreferrer" href="apps.apple.com/…">`
 * combined with a JS click handler (e.g. `trackCTA()`) is often **blocked by
 * the popup blocker** — the tap yields nothing visible, users leave.
 *
 * The rules used here match Apple's own recommendation:
 *   - On iOS/iPadOS/Android → open in the SAME tab (`location.href`). The
 *     App Store universal link handoff kicks in and opens the native App
 *     Store app.
 *   - On desktop → open in a new tab (`window.open`) so the marketing page
 *     stays behind.
 *
 * We also proactively unlock body scroll before navigating: if the tap
 * happens from inside the mobile menu (body has `overflow: hidden`), leaving
 * that class stuck when the user comes back to the tab is a common source of
 * "site frozen, can't scroll" complaints.
 */

import { trackCTA } from './koloTracker';

const APP_STORE_URL = 'https://apps.apple.com/fr/app/kolo-ai-real-estate/id6761818371';

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS 13+ reports as MacIntel — detect via touch support
  const iPadOS = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
};

const isAndroid = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
};

const isMobile = () => isIOS() || isAndroid();

/**
 * Force-clear any lingering scroll lock. Idempotent — safe to call anywhere.
 * We touch both `body` and `documentElement` because iOS Safari occasionally
 * ignores one but not the other, depending on which element got the initial
 * overflow: hidden.
 */
export const unlockScroll = () => {
  try {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.documentElement.style.overflow = '';
  } catch (_) {
    /* silent */
  }
};

/**
 * Open the KOLO App Store page reliably across devices.
 * Call from a real user event (click/tap) — do not delay with async work.
 */
export const openAppStore = (ctaId) => {
  // Fire-and-forget analytics — uses sendBeacon, non-blocking
  try { trackCTA(ctaId || 'unknown'); } catch (_) { /* silent */ }
  // Belt-and-braces scroll unlock — if the CTA lives inside the open mobile
  // menu, we don't want to leave the body frozen when the user returns.
  unlockScroll();

  if (typeof window === 'undefined') return;

  if (isMobile()) {
    // Same-tab navigation — Universal Link hand-off will open the App Store app.
    window.location.href = APP_STORE_URL;
  } else {
    // Desktop: new tab, keep the marketing page in view.
    const w = window.open(APP_STORE_URL, '_blank', 'noopener');
    if (!w) {
      // Popup blocked — fall back to same-tab navigation as last resort.
      window.location.href = APP_STORE_URL;
    }
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
    // Let modifier-click (ctrl/cmd/shift/middle) behave like a normal link
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    openAppStore(ctaId);
  },
  // We deliberately DO NOT set target=_blank on mobile (see file header).
  // On desktop, openAppStore() opens a new tab via window.open. Right-click
  // on the link still works normally.
});

export { APP_STORE_URL, isIOS, isAndroid, isMobile };
