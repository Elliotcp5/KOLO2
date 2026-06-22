// =============================================================
// KOLO v2 — Notification Prompt (push subscribe inline card)
// Shown on V2HomePage when permission == 'default' and user has not dismissed it.
// Uses the existing /api/notifications/subscribe pipeline (V1 + V2 tokens accepted).
// =============================================================
import React, { useEffect, useState } from 'react';
import { Bell, X, Sparkles } from 'lucide-react';
import pushService from '../services/pushNotifications';

const STORAGE_DISMISS_KEY = 'kolo_v2_push_prompt_dismissed';

export default function V2NotificationPrompt({ userId }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    // Already subscribed?
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    try {
      if (localStorage.getItem(STORAGE_DISMISS_KEY) === '1') return;
    } catch (_) {}
    setVisible(true);
  }, [userId]);

  const enable = async () => {
    setBusy(true);
    try {
      // Initialize service worker + VAPID
      await pushService.initWeb();
      const granted = await pushService.requestPermission();
      if (!granted) {
        setVisible(false);
        return;
      }
      await pushService.subscribe(userId);
      setVisible(false);
    } catch (e) {
      console.error('Push subscription failed', e);
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_DISMISS_KEY, '1'); } catch (_) {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="v2-push-prompt" data-testid="v2-push-prompt">
      <button className="v2-push-close" onClick={dismiss} aria-label="Fermer" data-testid="v2-push-dismiss">
        <X size={14} />
      </button>
      <div className="v2-push-icon"><Bell size={20} /></div>
      <div className="v2-push-content">
        <div className="v2-push-title">
          <Sparkles size={12} /> Active tes notifications
        </div>
        <div className="v2-push-body">
          On te prévient quand un rappel arrive, une note attend ton traitement ou ton copilote a une idée pour toi.
        </div>
        <button className="v2-btn primary" style={{ marginTop: 12, padding: '10px 14px' }} onClick={enable} disabled={busy} data-testid="v2-push-enable">
          {busy ? 'Activation…' : 'Activer les notifications'}
        </button>
      </div>
    </div>
  );
}
