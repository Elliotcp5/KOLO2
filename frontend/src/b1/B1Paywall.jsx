// KOLO — Écran paywall natif (Build 2.24 · 8/2/2026)
// -----------------------------------------------------------------------------
// Remplace la route morte `/app-v2/settings/subscription` qui menait à un
// redirect vers /app-b1 → « au clic il ne se passe rien » remonté par l'user.
// Hiérarchie demandée : chiffre de la zone > phrase bénéfice > bouton IAP.
// Conforme Apple : aucun prix affiché, aucun lien externe, achat via IAP.
// -----------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check } from 'lucide-react';
import b1t from './b1i18n';
import b1api from './b1api';
import { Capacitor } from '@capacitor/core';

const IAP_PRODUCT_ID = 'PRO_Plus';

export default function B1Paywall() {
  const navigate = useNavigate();
  const [pool, setPool] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    b1api.getPoolZones().then(setPool).catch(() => setPool({ zones: [], total: 0, top_zone: null }));
    // Trace : « paywall_affiche » (analytics existants)
    try {
      import('./b3tracking').then((m) => m.track?.('paywall_affiche', {})).catch(() => {});
    } catch (_) {}
  }, []);

  const acheter = async () => {
    setBusy(true); setError('');
    try {
      if (!Capacitor.isNativePlatform()) {
        setError(b1t('paywall.err.pas_ios') || "Achat disponible uniquement dans l'app iOS.");
        return;
      }
      const iap = await import('../services/iapStore');
      await iap.initIapStore?.();
      const r = await iap.orderProduct?.('pro', 'monthly');
      if (r?.success) {
        // Le webhook back-end valide le receipt, on rentre chez soi.
        navigate('/app-b1', { replace: true });
      } else {
        setError(r?.error || b1t('paywall.err.echec') || 'Achat impossible pour le moment.');
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally { setBusy(false); }
  };

  const top = pool?.top_zone;
  const total = pool?.total || 0;

  return (
    <div className="b1-root">
      <div className="b1-shell">
        <div className="b1-screen" data-testid="b1-paywall">
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button
              type="button"
              className="b1-back-btn"
              data-testid="b1-paywall-close"
              onClick={() => navigate(-1)}
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>

          {/* 1. Ce que l'utilisateur RATE — chiffré, pool réel de sa zone */}
          {top && top.count > 0 ? (
            <div style={{ marginTop: 20, textAlign: 'center' }} data-testid="b1-paywall-hero">
              <div style={{ fontSize: 44, lineHeight: 1, fontWeight: 800, color: 'var(--b1-primary, #EC8690)' }}
                   data-testid="b1-paywall-count">
                {top.count}
              </div>
              <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700 }}>
                {b1t('paywall.hero.opps') || `opportunités de mandats vous attendent`}
              </div>
              <div style={{ marginTop: 6, fontSize: 15, opacity: 0.75 }}>
                {b1t('paywall.hero.zone', { cp: top.code_postal }) || `dans le ${top.code_postal}`}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 20, textAlign: 'center' }} data-testid="b1-paywall-hero-nozone">
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {b1t('paywall.hero.sans_zone') || "Passez à Pro pour recevoir vos opportunités quotidiennes"}
              </div>
            </div>
          )}

          {/* 2. Bénéfice en UNE phrase — pas de liste abstraite */}
          <div className="b1-card" style={{ marginTop: 28 }} data-testid="b1-paywall-benefits">
            <p className="b1-lead" style={{ margin: 0 }}>
              {b1t('paywall.benefit.phrase') ||
                "Pro vous donne accès à toutes vos opportunités, aux estimations illimitées et à la veille concurrentielle."}
            </p>
            <ul style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                b1t('paywall.puce.opps') || `Toutes les opportunités de vos zones${total > 0 ? ` (${total} en cours)` : ''}`,
                b1t('paywall.puce.estim') || "Estimations et dossiers PDF illimités",
                b1t('paywall.puce.veille') || "Veille concurrentielle sur les biens déjà en vente",
                b1t('paywall.puce.notif') || "Notifications quotidiennes",
              ].map((line, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Check size={18} style={{ color: 'var(--b1-primary, #EC8690)', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 14 }}>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. Bouton IAP — AUCUN PRIX AFFICHÉ (Apple compliance) */}
          <button
            type="button"
            className="b1-pill b1-pill--primary b1-pill--fullwidth"
            data-testid="b1-paywall-cta"
            disabled={busy}
            onClick={acheter}
            style={{ marginTop: 24, height: 56, fontSize: 16, fontWeight: 700 }}
          >
            {busy ? (b1t('sys.un_instant') || 'Un instant…') : (b1t('paywall.cta') || 'Débloquer Pro')}
          </button>
          {error && (
            <div data-testid="b1-paywall-error" style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: 'var(--b1-danger, #B91C1C)' }}>
              {error}
            </div>
          )}
          <div style={{ marginTop: 12, textAlign: 'center', fontSize: 11, opacity: 0.5 }}>
            {b1t('paywall.legal') || 'Renouvellement automatique. Résiliable dans Réglages > Apple ID.'}
          </div>
        </div>
      </div>
    </div>
  );
}
