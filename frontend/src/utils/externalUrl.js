// Utilitaire pour ouvrir les URLs externes (Stripe, liens, etc.)
// Utilise le plugin Capacitor Browser en natif (iOS/Android), fallback window.open/window.location.href en web.
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export async function openExternalUrl(url, { sameTab = true } = {}) {
  if (!url) return;

  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({
        url,
        presentationStyle: 'fullscreen',
        windowName: '_self',
      });
      return;
    } catch (err) {
      console.error('Browser.open failed, falling back:', err);
    }
  }

  if (sameTab) {
    window.location.href = url;
  } else {
    window.open(url, '_blank');
  }
}
