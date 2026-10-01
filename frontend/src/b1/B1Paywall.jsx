// KOLO — Écran paywall natif (Build 2.24 · 8/2/2026)
// -----------------------------------------------------------------------------
// Remplace la route morte `/app-v2/settings/subscription` qui menait à un
// redirect vers /app-b1 → « au clic il ne se passe rien » remonté par l'user.
// Hiérarchie demandée : chiffre de la zone > phrase bénéfice > bouton IAP.
// Conforme Apple : aucun prix affiché, aucun lien externe, achat via IAP.
//
// Bloc 4 étape 6 — correctif récupération produit Apple :
// Avant, le code appelait `iap.initIapStore?.()` et `iap.orderProduct?.()`
// qui N'EXISTENT PAS dans ../services/iapStore.js. Les vrais noms sont
// `initIAP` et `purchasePlan`. L'optional chaining masquait l'absence et
// le click ne faisait littéralement rien. On appelle maintenant les BONS
// noms, on vérifie `areProductsReady()`, on affiche en toutes lettres le
// code renvoyé (`product_not_found`, `product_unavailable`, `no_offer`,
// `not_initialized`, `apple_timeout`, etc.) et on journalise dans la
// console avec un marqueur [paywall-iap].
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
  const [errorCode, setErrorCode] = useState('');

  useEffect(() => {
    b1api.getPoolZones().then(setPool).catch(() => setPool({ zones: [], total: 0, top_zone: null }));
    // Trace : « paywall_affiche » (analytics existants)
    try {
      import('./b3tracking').then((m) => m.track?.('paywall_affiche', {})).catch(() => {});
    } catch (_) {}
  }, []);

  const acheter = async () => {
    setBusy(true); setError(''); setErrorCode('');
    try {
      if (!Capacitor.isNativePlatform()) {
        setErrorCode('not_ios');
        setError(b1t('paywall.err.pas_ios') || "Achat disponible uniquement dans l'app iOS.");
        console.warn('[paywall-iap] not_ios — preview web : CdvPurchase indisponible.');
        return;
      }
      const iap = await import('../services/iapStore');
      // Récupérer user + token pour l'init
      let userId = ''; let token = '';
      try {
        token = localStorage.getItem('kolo_v2_session') || localStorage.getItem('kolo_token') || '';
        const prof = await b1api.getProfil().catch(() => null);
        userId = prof?.user?.user_id || '';
      } catch (_) {}
      const initRes = await iap.initIAP({ userId, token });
      console.info('[paywall-iap] initIAP →', initRes);
      if (!initRes?.ok) {
        setErrorCode(initRes?.reason || 'init_failed');
        setError(`${b1t('paywall.err.init') || 'Impossible de contacter l\'App Store'} (code: ${initRes?.reason || 'init_failed'}).`);
        return;
      }
      // Diag : log le produit avant de commander
      const products = iap.getProducts?.() || null;
      const ready = iap.areProductsReady?.() === true;
      console.info('[paywall-iap] product_id interrogé =', IAP_PRODUCT_ID,
                   '| areProductsReady =', ready,
                   '| products =', products);
      if (!ready) {
        setErrorCode('product_not_loaded');
        setError(`${b1t('paywall.err.produit') || 'Produit non récupéré depuis l\'App Store'} (code: product_not_loaded, id: ${IAP_PRODUCT_ID}). Vérifiez App Store Connect.`);
        return;
      }
      const r = await iap.purchasePlan('pro_plus', 'monthly');
      console.info('[paywall-iap] purchasePlan →', r);
      if (r?.success) {
        navigate('/app-b1', { replace: true });
      } else if (r?.userCancelled) {
        setErrorCode('user_cancelled');
      } else {
        setErrorCode(r?.error || 'echec_inconnu');
        setError(`${b1t('paywall.err.echec') || 'Achat impossible pour le moment'} (code: ${r?.error || 'echec_inconnu'}).`);
      }
    } catch (e) {
      const msg = String(e?.message || e);
      setErrorCode('exception');
      setError(`${msg} (code: exception)`);
      console.error('[paywall-iap] exception', e);
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
              {errorCode && (
                <div style={{ marginTop: 4, fontFamily: 'DM Mono, monospace', fontSize: 11, opacity: 0.7 }}
                     data-testid="b1-paywall-error-code">
                  code technique : {errorCode} · produit : {IAP_PRODUCT_ID}
                </div>
              )}
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
