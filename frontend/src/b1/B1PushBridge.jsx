// KOLO — Bridge Capacitor PushNotifications (Build 2.24)
// -----------------------------------------------------------------------------
// Rôle : capter le device token APNs et l'enregistrer en base côté serveur.
// Auparavant B3Perf.jsx appelait `PushNotifications.register()` SANS listener
// `registration` → le token était perdu → `tokens_cibles: 0` sur toutes les
// envois push. Ce bridge, monté une fois au niveau routeur, installe le
// listener global et repostule le token après login / cold-start / réinstall.
//
// Contrat :
//   - Ne demande RIEN à l'user (la permission est gérée dans B3Perf.jsx).
//   - Se déclenche seulement quand la session est valide.
//   - Idempotent côté serveur : /api/notifications/register-device upsert
//     sur (user_id, token).
// -----------------------------------------------------------------------------

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Empêche double-init dans React StrictMode et hot-reload dev.
let _installed = false;

async function postToken(token, platform) {
  const authToken = (typeof window !== 'undefined')
    ? (localStorage.getItem('kolo_v2_session') || localStorage.getItem('kolo_token') || '')
    : '';
  if (!authToken) return; // Pas connecté : on retente au prochain login.
  try {
    const res = await fetch(`${API}/api/notifications/register-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ device_token: token, platform }),
    });
    if (res.ok) {
      try { localStorage.setItem('kolo_apns_token_registered_at', String(Date.now())); } catch (_) {}
    } else {
      // Ne bloque rien — le prochain cold-start réessaiera.
      console.warn('[push-bridge] server refused', res.status);
    }
  } catch (e) {
    console.warn('[push-bridge] post error', e);
  }
}

export function B1PushBridge() {
  useEffect(() => {
    if (_installed) return;
    _installed = true;

    // Ne pas planter en environnement web (le plugin n'est pas dispo).
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let PushNotifications = null;
    (async () => {
      try {
        const mod = await import('@capacitor/push-notifications');
        PushNotifications = mod.PushNotifications;
      } catch (e) {
        console.warn('[push-bridge] plugin not available', e);
        return;
      }

      const platform = Capacitor.getPlatform ? Capacitor.getPlatform() : 'ios';

      // 1. Listener global — capté à chaque `register()` (init + après grant).
      await PushNotifications.addListener('registration', async (t) => {
        console.log('[push-bridge] APNs token captured');
        await postToken(t.value, platform);
      });
      await PushNotifications.addListener('registrationError', (err) => {
        console.error('[push-bridge] APNs registrationError', err);
      });

      // 2. Cold-start : si l'user a déjà autorisé, on redemande un token —
      //    APNs peut avoir changé de token depuis la dernière ouverture,
      //    et le serveur peut avoir été purgé (410 GONE nettoie
      //    device_tokens). C'est ce qui explique le `tokens_cibles: 0`
      //    persistant : sans re-register au cold-start, le token n'est
      //    jamais réinjecté après un cycle de session.
      try {
        const perm = await PushNotifications.checkPermissions();
        if (perm?.receive === 'granted') {
          await PushNotifications.register();
        }
      } catch (e) {
        console.warn('[push-bridge] cold-start register skipped', e);
      }
    })();

    // Cleanup n'est pas nécessaire : le listener est un singleton app-scope.
  }, []);
  return null;
}

export default B1PushBridge;
