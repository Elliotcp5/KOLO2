// =============================================================
// KOLO v2 — Public Referral Landing /r/:code
// Minimalist: shows the referrer's first name + CTA "Créer mon compte"
// Stores the referral code in localStorage so it survives the redirect
// to /app-v2/signup where it will be attached to the verify-email-code call.
// =============================================================
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sparkles, Gift, ArrowRight, Check } from 'lucide-react';
import { V2Logo } from '../V2Layout';
import v2api from '../v2api';
import '../../styles/v2.css';

export default function V2ReferralLandingPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [referrerName, setReferrerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    v2api.referralInfo(code)
      .then(r => {
        setReferrerName(r.referrer_first_name || 'Ton parrain');
        try { localStorage.setItem('kolo_referral_code', (r.code || code).toUpperCase()); } catch (_) {}
      })
      .catch(e => setError(e.message || 'Code invalide'))
      .finally(() => setLoading(false));
  }, [code]);

  const startSignup = () => {
    const ref = (code || '').toUpperCase();
    navigate(`/app-v2/signup?ref=${ref}`);
  };

  return (
    <div className="v2-ref-landing" data-testid="v2-ref-landing">
      <header className="v2-ref-header">
        <V2Logo size={28} accent />
      </header>

      <main className="v2-ref-main">
        {loading && (
          <div className="v2-ref-card" style={{ textAlign: 'center' }}>
            <div className="v2-loading-dot" />
            <p style={{ color: 'var(--v2-muted)', marginTop: 12 }}>Chargement de l'invitation…</p>
          </div>
        )}

        {!loading && error && (
          <div className="v2-ref-card" data-testid="ref-error">
            <h1 className="v2-ref-title">Cette invitation n'est plus valide.</h1>
            <p className="v2-ref-body">Le code de parrainage est introuvable ou a expiré. Tu peux quand même créer ton compte gratuitement.</p>
            <button className="v2-btn primary full" onClick={() => navigate('/app-v2/signup')} data-testid="ref-fallback-signup">
              Créer mon compte <ArrowRight size={16} />
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="v2-ref-eyebrow"><Sparkles size={13} /> Invitation personnelle</div>
            <h1 className="v2-ref-title">
              <span className="accent">{referrerName}</span> t'invite à rejoindre KOLO.
            </h1>
            <p className="v2-ref-body">
              KOLO est le copilote IA des agents immobiliers. Ton parrain t'offre l'accès à la version premium —
              tu profites d'<strong>1 mois offert</strong>, et lui aussi.
            </p>

            <div className="v2-ref-perks">
              <div className="perk"><Check size={14} /> Copilote IA conversationnel — formé à l'immobilier</div>
              <div className="perk"><Check size={14} /> Pige DPE + annonces sur ta zone</div>
              <div className="perk"><Check size={14} /> Notes vocales, dossiers et rappels intelligents</div>
              <div className="perk"><Check size={14} /> +1 mois Pro offert pour toi <strong>et</strong> pour {referrerName}</div>
            </div>

            <button className="v2-btn primary full big" onClick={startSignup} data-testid="ref-create-account">
              <Gift size={16} /> Créer mon compte avec {referrerName} comme parrain
            </button>

            <p className="v2-ref-mini">
              Déjà un compte ?{' '}
              <a onClick={() => navigate('/app-v2/login')} style={{ color: 'var(--v2-accent)', cursor: 'pointer' }}>Se connecter</a>
            </p>
          </>
        )}
      </main>

      <footer className="v2-ref-footer">
        © {new Date().getFullYear()} KOLO · trykolo.io
      </footer>
    </div>
  );
}
