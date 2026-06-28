// =============================================================
// KOLO v2 — Subscription page (StoreKit native iOS / Stripe web)
// Apple §3.1.1 compliant. UN seul produit : KOLO Pro 24,99€/mois.
// =============================================================
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, RotateCw } from 'lucide-react';
import V2Layout from '../V2Layout';
import v2api, { getApiBase } from '../v2api';
import {
  initIAP,
  purchasePlan,
  restorePurchases,
  isIOSNative,
  onPurchaseVerified,
} from '../../services/iapStore';
import '../../styles/v2.css';

export default function V2SubscriptionPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [iapReady, setIapReady] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const native = isIOSNative();

  const reload = () => {
    v2api.me().then(setUser).catch(() => navigate('/app-v2/login'));
    v2api.dashboard().then(setDashboard).catch(() => {});
  };

  useEffect(() => {
    reload();
    if (native) {
      (async () => {
        try {
          const token = localStorage.getItem('kolo_v2_session') || '';
          const u = await v2api.me().catch(() => null);
          await initIAP({ userId: u?.user_id, token });
          setIapReady(true);
        } catch (e) {
          console.warn('IAP init failed', e);
          setIapReady(true); // permettre le clic même si init partiel
        }
      })();
    } else {
      setIapReady(true);
    }
    const off = onPurchaseVerified((info) => {
      reload();
      if (info?.status === 'active' || info?.plan === 'pro') {
        alert('Abonnement Pro activé ✓');
        navigate('/app-v2');
      }
    });
    return () => { try { off && off(); } catch (_) {} };
  }, []); // eslint-disable-line

  const doPurchase = async () => {
    setBusy(true);
    try {
      if (native) {
        const r = await purchasePlan('pro', 'monthly');
        if (r?.cancelled) { setBusy(false); return; }
        if (r?.error) { alert(r.error); }
      } else {
        const r = await fetch(`${getApiBase()}/api/v2/billing/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('kolo_v2_session')}`,
          },
          body: JSON.stringify({ plan: 'pro', billing_period: 'monthly' }),
        }).then(x => x.json());
        if (r?.url) window.location.href = r.url;
        else alert("Impossible de démarrer le paiement.");
      }
    } catch (e) {
      alert(e?.message || 'Erreur de paiement');
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    if (!native) {
      alert("La restauration d'achat est uniquement disponible sur iOS.");
      return;
    }
    setBusy(true);
    try {
      const r = await restorePurchases();
      if (r?.restored) {
        alert('Achat restauré ✓');
        reload();
      } else {
        alert("Aucun abonnement trouvé à restaurer.");
      }
    } catch (e) {
      alert(e?.message || 'Erreur restauration');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return <div className="v2-app" />;

  const PERKS = [
    'Contacts illimités',
    'Pige immobilière live LeBonCoin + PAP — illimité',
    'IA premium avancée',
    'Rappels et notifications prioritaires',
    'DPE en un clic',
    'Support prioritaire 24/7',
    'Parrainage activé',
  ];

  const isPro = dashboard?.has_pro;

  return (
    <V2Layout user={user} dashboard={dashboard}>
      <button className="v2-icon-btn" onClick={() => navigate(-1)} style={{ marginBottom: 14 }} aria-label="Retour" data-testid="sub-back"><ChevronLeft size={18} /></button>

      <h1 className="v2-hello" style={{ fontSize: 30 }} data-testid="sub-title">
        {isPro ? 'Tu es Pro' : 'Passe en Pro'}
      </h1>
      <p style={{ color: 'var(--v2-muted)', fontSize: 14.5, lineHeight: 1.5, marginBottom: 22 }}>
        {isPro
          ? 'Toutes les fonctionnalités KOLO sont débloquées. Merci de ton soutien.'
          : 'Débloque toutes les fonctionnalités KOLO et gagne 5h par semaine.'}
      </p>

      <div className="v2-card" style={{ padding: 22 }}>
        <div className="v2-tag" style={{ color: 'var(--v2-info)' }}>KOLO PRO</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
          <span style={{ fontFamily: 'var(--v2-font-display)', fontSize: 36, fontWeight: 800, letterSpacing: '-0.025em' }} data-testid="sub-price">
            24,99 €
          </span>
          <span style={{ color: 'var(--v2-muted)', fontSize: 14 }}>/mois</span>
        </div>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PERKS.map(p => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--v2-ink-2)' }}>
              <Check size={16} style={{ color: 'var(--v2-success)', flexShrink: 0 }} /> {p}
            </div>
          ))}
        </div>

        {!isPro && (
          <>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--v2-muted)', marginBottom: 8 }}>
                Code promo
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="v2-input"
                  style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase().slice(0, 24))}
                  placeholder="Saisis ton code"
                  data-testid="sub-promo-input"
                />
                <button
                  type="button"
                  className="v2-btn secondary"
                  onClick={async () => {
                    setPromoMsg(''); setBusy(true);
                    try {
                      const API = getApiBase();
                      const token = localStorage.getItem('kolo_v2_session') || '';
                      const r = await fetch(`${API}/api/v2/promo/redeem`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ code: promoCode.trim() }),
                      });
                      const d = await r.json();
                      if (!r.ok) throw new Error(d.detail || 'Code invalide');
                      setPromoMsg(`✓ ${d.granted_days} jours Pro offerts`);
                      setTimeout(() => window.location.reload(), 1200);
                    } catch (e) {
                      setPromoMsg(e.message || 'Erreur');
                    } finally { setBusy(false); }
                  }}
                  disabled={busy || promoCode.length < 3}
                  data-testid="sub-promo-redeem-btn"
                >
                  Valider
                </button>
              </div>
              {promoMsg && (
                <div
                  style={{
                    marginTop: 8, fontSize: 12.5,
                    color: promoMsg.startsWith('✓') ? '#1E7A3C' : '#DC2626',
                  }}
                  data-testid="sub-promo-msg"
                >
                  {promoMsg}
                </div>
              )}
            </div>

            <button
              className="v2-btn primary full"
              style={{ marginTop: 20, fontSize: 15 }}
              disabled={busy || (native && !iapReady)}
              onClick={doPurchase}
              data-testid="sub-purchase-btn"
            >
              {busy ? 'Patiente…' : "S'abonner — 24,99 €/mois"}
            </button>
          </>
        )}

        {native && (
          <button
            className="v2-btn secondary full"
            style={{ marginTop: 10, fontSize: 13.5 }}
            onClick={doRestore}
            disabled={busy}
            data-testid="sub-restore-btn"
          >
            <RotateCw size={14} /> Restaurer mes achats
          </button>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--v2-muted-2)', lineHeight: 1.5, marginTop: 20, textAlign: 'center', padding: '0 12px' }}>
        {native ? (
          <>
            L'abonnement est facturé via ton compte Apple et se renouvelle automatiquement chaque mois. Tu peux gérer ou annuler à tout moment depuis Réglages iOS → ton nom → Abonnements. Aucun frais après annulation.
            <br /><br />
            <a href="https://www.trykolo.io/iap-terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--v2-ink)', textDecoration: 'underline' }}>Conditions IAP</a>
            {' · '}
            <a href="https://www.trykolo.io/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--v2-ink)', textDecoration: 'underline' }}>Confidentialité</a>
          </>
        ) : (
          <>Paiement sécurisé via Stripe. Tu peux annuler à tout moment depuis les paramètres.</>
        )}
      </p>
    </V2Layout>
  );
}
