// =============================================================
// KOLO v2 — Subscription page (StoreKit native sur iOS / Stripe sur Web)
// Apple §3.1.1 compliant : sur iOS native, on lance UNIQUEMENT StoreKit.
// =============================================================
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, RotateCw } from 'lucide-react';
import V2Layout from '../V2Layout';
import v2api from '../v2api';
import {
  initIAP,
  purchasePlan,
  restorePurchases,
  isIOSNative,
  onPurchaseVerified,
  getProducts,
} from '../../services/iapStore';
import '../../styles/v2.css';

export default function V2SubscriptionPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [billing, setBilling] = useState('monthly');
  const [busy, setBusy] = useState(false);
  const [iapReady, setIapReady] = useState(false);
  const native = isIOSNative();

  const reload = () => {
    v2api.me().then(setUser).catch(() => navigate('/app-v2/login'));
    v2api.dashboard().then(setDashboard).catch(() => {});
  };

  useEffect(() => {
    reload();
    // Init StoreKit if iOS native
    if (native) {
      (async () => {
        try {
          const token = localStorage.getItem('kolo_v2_session') || '';
          const u = await v2api.me().catch(() => null);
          await initIAP({ userId: u?.user_id, token });
          setIapReady(true);
          getProducts(); // warm-up products list
        } catch (e) {
          console.warn('IAP init failed', e);
        }
      })();
    }
    // Listen to purchase verified → reload dashboard
    const off = onPurchaseVerified((info) => {
      console.log('Purchase verified', info);
      reload();
      if (info?.status === 'active') {
        alert('Abonnement Pro activé ✓');
        navigate('/app-v2');
      }
    });
    return () => { try { off && off(); } catch (_) {} };
  }, []); // eslint-disable-line

  const doPurchase = async (plan) => {
    setBusy(true);
    try {
      if (native) {
        // iOS — lance la sheet Apple StoreKit
        const r = await purchasePlan(plan, billing);
        if (r?.cancelled) { setBusy(false); return; }
        if (r?.error) { alert(r.error); }
        // success → handled by onPurchaseVerified listener
      } else {
        // Web — redirige vers Stripe Checkout
        const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/v2/billing/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('kolo_v2_session')}`,
          },
          body: JSON.stringify({ plan, billing_period: billing }),
        }).then(x => x.json());
        if (r?.url) window.location.href = r.url;
        else alert("Impossible de démarrer le paiement. Réessaie plus tard.");
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
      alert(e?.message || 'Erreur lors de la restauration');
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

  const monthlyPrice = '24,99 €';
  const yearlyPrice = '249 €';
  const yearlyMonthEq = '20,75 €';

  return (
    <V2Layout user={user} dashboard={dashboard}>
      <button className="v2-icon-btn" onClick={() => navigate(-1)} style={{ marginBottom: 14 }} aria-label="Retour"><ChevronLeft size={18} /></button>

      <h1 className="v2-hello" style={{ fontSize: 30 }} data-testid="sub-title">Passe en Pro</h1>
      <p style={{ color: 'var(--v2-muted)', fontSize: 14.5, lineHeight: 1.5, marginBottom: 22 }}>
        Débloque toutes les fonctionnalités KOLO et gagne 5h par semaine.
      </p>

      {/* Billing toggle */}
      <div className="v2-filter-tabs" style={{ marginBottom: 18 }}>
        <button
          className={`v2-filter-tab ${billing === 'monthly' ? 'active' : ''}`}
          onClick={() => setBilling('monthly')}
          data-testid="sub-tab-monthly"
        >
          Mensuel
        </button>
        <button
          className={`v2-filter-tab ${billing === 'yearly' ? 'active' : ''}`}
          onClick={() => setBilling('yearly')}
          data-testid="sub-tab-yearly"
        >
          Annuel <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>-17%</span>
        </button>
      </div>

      {/* Plan card */}
      <div className="v2-card" style={{ padding: 22 }}>
        <div className="v2-tag" style={{ color: 'var(--v2-info)' }}>KOLO PRO</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
          <span style={{ fontFamily: 'var(--v2-font-display)', fontSize: 36, fontWeight: 800, letterSpacing: '-0.025em' }} data-testid="sub-price">
            {billing === 'monthly' ? monthlyPrice : yearlyMonthEq}
          </span>
          <span style={{ color: 'var(--v2-muted)', fontSize: 14 }}>/mois</span>
        </div>
        {billing === 'yearly' && (
          <div style={{ fontSize: 12.5, color: 'var(--v2-muted-2)', marginTop: 4 }}>
            Facturé {yearlyPrice} par an
          </div>
        )}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PERKS.map(p => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--v2-ink-2)' }}>
              <Check size={16} style={{ color: 'var(--v2-success)', flexShrink: 0 }} /> {p}
            </div>
          ))}
        </div>

        <button
          className="v2-btn primary full"
          style={{ marginTop: 20, fontSize: 15 }}
          disabled={busy || (native && !iapReady)}
          onClick={() => doPurchase('pro')}
          data-testid="sub-purchase-btn"
        >
          {busy ? 'Patiente…' : `S'abonner — ${billing === 'monthly' ? monthlyPrice : yearlyPrice}`}
        </button>

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

      <p style={{ fontSize: 11, color: 'var(--v2-muted-2)', lineHeight: 1.5, marginTop: 20, textAlign: 'center' }}>
        {native ? (
          <>
            L'abonnement est facturé via ton compte Apple à la fin de la période d'essai (s'il y en a une) et se renouvelle automatiquement. Tu peux gérer ou annuler ton abonnement à tout moment depuis les Réglages iOS → ton nom → Abonnements.
            <br /><br />
            En t'abonnant, tu acceptes les <a href="https://www.trykolo.io/iap-terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--v2-ink)', textDecoration: 'underline' }}>conditions IAP</a> et la <a href="https://www.trykolo.io/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--v2-ink)', textDecoration: 'underline' }}>politique de confidentialité</a>.
          </>
        ) : (
          <>
            Paiement sécurisé via Stripe. Tu peux annuler à tout moment depuis les paramètres.
          </>
        )}
      </p>
    </V2Layout>
  );
}
