// Apple App Store Guideline 2.1(b) compliance:
// On iOS natively, we cannot perform in-app subscription checkout through Stripe
// (Apple reserves digital goods purchases for their IAP system).
//
// This helper detects iOS native and replaces any upgrade action with a polite
// modal explaining users need to subscribe from the web version (trykolo.io).
// This is the same approach used by Netflix, Spotify, Audible, YouTube, etc.
import { Capacitor } from '@capacitor/core';

export function isIOSNative() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch (_) {
    return false;
  }
}

/**
 * Returns localized messages for the "subscribe on web" modal.
 */
export function getSubscribeOnWebMessage(locale = 'en') {
  const messages = {
    fr: {
      title: 'Gérer votre abonnement',
      body: "Pour des raisons liées aux règles de l'App Store, les abonnements KOLO se gèrent depuis notre site web.\n\nRendez-vous sur trykolo.io depuis votre navigateur pour vous abonner. Votre compte sera automatiquement mis à jour ici.",
      ok: 'OK',
    },
    en: {
      title: 'Manage your subscription',
      body: 'Due to App Store rules, KOLO subscriptions are managed from our website.\n\nVisit trykolo.io in your browser to subscribe. Your account will be updated here automatically.',
      ok: 'OK',
    },
    es: {
      title: 'Gestionar tu suscripción',
      body: 'Debido a las reglas de la App Store, las suscripciones de KOLO se gestionan desde nuestro sitio web.\n\nVisita trykolo.io desde tu navegador para suscribirte. Tu cuenta se actualizará aquí automáticamente.',
      ok: 'OK',
    },
    de: {
      title: 'Abonnement verwalten',
      body: 'Aufgrund der App-Store-Regeln werden KOLO-Abonnements über unsere Website verwaltet.\n\nBesuchen Sie trykolo.io in Ihrem Browser, um zu abonnieren. Ihr Konto wird hier automatisch aktualisiert.',
      ok: 'OK',
    },
    it: {
      title: 'Gestisci il tuo abbonamento',
      body: "A causa delle regole dell'App Store, gli abbonamenti KOLO vengono gestiti dal nostro sito web.\n\nVisita trykolo.io dal tuo browser per abbonarti. Il tuo account verrà aggiornato qui automaticamente.",
      ok: 'OK',
    },
  };
  return messages[locale] || messages.en;
}

/**
 * Shows a native alert telling user to subscribe on the web.
 * Returns true when shown (iOS native), false otherwise (web can proceed normally).
 */
export function showSubscribeOnWebAlert(locale = 'en') {
  if (!isIOSNative()) return false;
  const m = getSubscribeOnWebMessage(locale);
  try {
    window.alert(`${m.title}\n\n${m.body}`);
  } catch (_) {}
  return true;
}
