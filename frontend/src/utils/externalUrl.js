// Utilitaire pour ouvrir les URLs externes (Stripe, liens, etc.)
// Utilise le plugin Capacitor Browser en natif (iOS/Android), fallback window.open/window.location.href en web.
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export async function openExternalUrl(url, { sameTab = true } = {}) {
  if (!url) {
    console.warn('openExternalUrl called with empty url');
    return false;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({
        url,
        presentationStyle: 'fullscreen',
        windowName: '_self',
      });
      return true;
    } catch (err) {
      console.error('Browser.open failed:', err);
      // Dernière tentative : ouvrir via window.open (safari externe)
      try {
        window.open(url, '_system');
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  if (sameTab) {
    window.location.href = url;
  } else {
    window.open(url, '_blank');
  }
  return true;
}
