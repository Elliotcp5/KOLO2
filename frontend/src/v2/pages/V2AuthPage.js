// =============================================================
// KOLO v2 — Auth pages (Login + Signup with email code) + Google
// =============================================================
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { V2Logo } from '../V2Layout';
import v2api from '../v2api';
import '../../styles/v2.css';

export default function V2AuthPage({ mode = 'login' }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState('email'); // email | code
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [referralCode, setReferralCode] = useState('');
  const [referralName, setReferralName] = useState('');

  useEffect(() => {
    // Pick up ?ref=CODE from URL or from previously stored referral (set by /r/:code landing)
    const fromUrl = params.get('ref') || '';
    const fromStorage = localStorage.getItem('kolo_referral_code') || '';
    const ref = (fromUrl || fromStorage || '').toUpperCase().trim();
    if (ref) {
      setReferralCode(ref);
      v2api.referralInfo(ref).then(r => setReferralName(r.referrer_first_name || '')).catch(() => {});
    }
  }, [params]);

  const sendCode = async () => {
    setError(''); setBusy(true);
    try {
      const r = await v2api.sendEmailCode(email);
      setDevCode(r.dev_code || null);
      setStep('code');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const verify = async () => {
    setError(''); setBusy(true);
    try {
      const r = await v2api.verifyEmailCode({ email, code, first_name: firstName, last_name: lastName, referral_code: referralCode || undefined });
      v2api.setSession(r.session_token);
      if (referralCode) localStorage.removeItem('kolo_referral_code');
      navigate(r.new_user ? '/app-v2/onboarding' : '/app-v2');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--v2-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/kolo-mark-v5-256.png" alt="KOLO" style={{ width: 72, height: 72, objectFit: 'contain' }} />
          <div style={{ fontSize: 13.5, color: 'var(--v2-muted)', marginTop: 14 }}>
            Ton copilote IA terrain
          </div>
        </div>

        {referralName && mode === 'signup' && (
          <div style={{
            background: 'linear-gradient(135deg, #EEF4FF 0%, #FAF5FF 100%)',
            border: '1px solid #E5E7FF',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 18,
            fontSize: 13.5,
            color: 'var(--v2-ink)',
            textAlign: 'center',
          }} data-testid="auth-referral-banner">
            🎁 Tu es invité par <strong>{referralName}</strong> — rejoins KOLO gratuitement.
          </div>
        )}

        {step === 'email' && (
          <>
            <div className="v2-field">
              <label className="v2-label">Email</label>
              <input className="v2-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.com" data-testid="auth-email" />
            </div>
            {mode === 'signup' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="v2-field">
                  <label className="v2-label">Prénom</label>
                  <input className="v2-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} data-testid="auth-firstname" />
                </div>
                <div className="v2-field">
                  <label className="v2-label">Nom</label>
                  <input className="v2-input" value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="auth-lastname" />
                </div>
              </div>
            )}
            {error && <p style={{ color: '#DC2626', fontSize: 13, marginTop: 0, marginBottom: 10 }}>{error}</p>}
            <button className="v2-btn primary full" onClick={sendCode} disabled={busy || !email} data-testid="auth-send-code">
              {busy ? 'Envoi…' : 'Recevoir un code par email'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0', color: 'var(--v2-muted-2)', fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--v2-line)' }} />
              <span>ou</span>
              <div style={{ flex: 1, height: 1, background: 'var(--v2-line)' }} />
            </div>
            <button className="v2-btn secondary full" onClick={async () => {
              setError('');
              try {
                const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
                const result = await SignInWithApple.authorize({
                  clientId: 'io.kolo.app.web',
                  redirectURI: `${window.location.origin}/app-v2/login`,
                  scopes: 'email name',
                });
                const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/v2/auth/apple/exchange`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    identity_token: result.response.identityToken,
                    email: result.response.email || null,
                    first_name: result.response.givenName || null,
                    last_name: result.response.familyName || null,
                  }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.detail || 'Échec Apple Sign-In');
                v2api.setSession(d.session_token);
                navigate(d.new_user ? '/app-v2/onboarding' : '/app-v2');
              } catch (e) {
                setError(e.message || 'Apple Sign-In indisponible');
              }
            }} data-testid="auth-apple">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: 6 }}>
                <path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516.024.034 1.52.087 2.475-1.258.955-1.345.762-2.391.728-2.43zm3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422.212-2.189 1.675-2.789 1.698-2.854.023-.065-.597-.79-1.254-1.157a3.692 3.692 0 0 0-1.563-.434c-1.082-.031-1.903.626-2.34.626-.438 0-1.01-.626-1.896-.626-1.082 0-2.114.626-2.839 1.496C1.498 7.391 1.054 9.4 1.832 11.698c.778 2.298 2.083 4.295 3.038 4.295.955 0 1.25-.595 2.564-.595 1.314 0 1.554.595 2.564.595 1.01 0 2.325-2.059 3.038-4.295.713-2.236 1.119-4.148 1.446-4.544z"/>
              </svg>
              Continuer avec Apple
            </button>

            <button className="v2-btn secondary full" onClick={async () => {
              try {
                const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/google/client-id`);
                const d = await r.json();
                if (!d.client_id) throw new Error('Google non configuré');
                const redirectUri = window.location.origin + '/auth/google';
                const state = Math.random().toString(36).slice(2);
                try {
                  sessionStorage.setItem('kolo_oauth_state', state);
                  sessionStorage.setItem('kolo_oauth_mode', mode);
                  sessionStorage.setItem('kolo_oauth_locale', 'fr');
                  sessionStorage.setItem('kolo_oauth_target', 'v2');
                } catch (_) {}
                const params = new URLSearchParams({
                  client_id: d.client_id,
                  redirect_uri: redirectUri,
                  response_type: 'code',
                  scope: 'openid email profile',
                  access_type: 'online',
                  include_granted_scopes: 'true',
                  prompt: 'select_account',
                  state,
                });
                window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
              } catch (e) {
                setError(e.message || 'Google indisponible');
              }
            }} data-testid="auth-google">
              Continuer avec Google
            </button>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--v2-muted)' }}>
              {mode === 'login' ? (
                <>Pas encore de compte ? <a onClick={() => navigate('/app-v2/signup')} style={{ color: 'var(--v2-accent)', cursor: 'pointer' }}>Créer un compte</a></>
              ) : (
                <>Déjà inscrit ? <a onClick={() => navigate('/app-v2/login')} style={{ color: 'var(--v2-accent)', cursor: 'pointer' }}>Se connecter</a></>
              )}
            </p>
          </>
        )}

        {step === 'code' && (
          <>
            <p style={{ fontSize: 14, color: 'var(--v2-muted)', marginBottom: 18 }}>
              Code envoyé à <strong style={{ color: 'var(--v2-ink)' }}>{email}</strong>
              {devCode && <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--v2-accent)' }}>(dev: {devCode})</span>}
            </p>
            <div className="v2-field">
              <label className="v2-label">Code à 6 chiffres</label>
              <input className="v2-input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} style={{ textAlign: 'center', letterSpacing: '8px', fontSize: 20, fontWeight: 700 }} data-testid="auth-code-input" />
            </div>
            {error && <p style={{ color: '#DC2626', fontSize: 13 }}>{error}</p>}
            <button className="v2-btn primary full" onClick={verify} disabled={busy || code.length !== 6} data-testid="auth-verify">
              {busy ? 'Vérification…' : 'Confirmer'}
            </button>
            <button className="v2-btn secondary full" style={{ marginTop: 10 }} onClick={() => setStep('email')}>Modifier l'email</button>
          </>
        )}
      </div>
    </div>
  );
}
