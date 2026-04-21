// Gestion des deep links Capacitor (iOS/Android) pour le retour depuis Stripe Checkout
// Schéma : io.kolo.app://checkout-success, io.kolo.app://checkout-cancelled
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { toast } from 'sonner';

export function useCapacitorDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handler = CapacitorApp.addListener('appUrlOpen', async (event) => {
      try {
        const url = event.url || '';
        // Referme le navigateur in-app Safari dès qu'un deep link KOLO est reçu
        await Browser.close().catch(() => {});

        // Parse le deep link: io.kolo.app://checkout-success?session_id=... ou kolo://...
        const lower = url.toLowerCase();

        if (lower.includes('checkout-success') || lower.includes('upgrade=success')) {
          // Extrait les query params (après ?)
          const qIdx = url.indexOf('?');
          const query = qIdx !== -1 ? url.substring(qIdx) : '?upgrade=success';
          toast.success('Paiement réussi ! Bienvenue sur KOLO 🎉');
          navigate(`/app${query}`);
          return;
        }

        if (lower.includes('checkout-cancelled') || lower.includes('upgrade=cancelled')) {
          toast.info('Paiement annulé');
          navigate('/pricing?upgrade=cancelled');
          return;
        }

        if (lower.includes('checkout-error')) {
          const reasonMatch = url.match(/reason=([^&]+)/);
          const reason = reasonMatch ? decodeURIComponent(reasonMatch[1]) : 'unknown';
          toast.error(
            reason === 'already_subscribed'
              ? 'Vous avez déjà un abonnement actif'
              : reason === 'payment_failed'
              ? 'Le paiement a échoué, veuillez réessayer'
              : 'Une erreur est survenue lors du paiement'
          );
          navigate('/pricing');
          return;
        }

        if (lower.includes('create-account')) {
          // Cas inscription via Stripe success (flow SubscribePage)
          const qIdx = url.indexOf('?');
          const query = qIdx !== -1 ? url.substring(qIdx) : '';
          navigate(`/create-account${query}`);
          return;
        }
      } catch (err) {
        console.error('Deep link handling error:', err);
      }
    });

    return () => {
      handler.then((h) => h.remove()).catch(() => {});
    };
  }, [navigate]);
}
