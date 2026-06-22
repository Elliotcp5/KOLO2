// =============================================================
// KOLO v2 — Auth pages (Login + Signup with email code) + Google
// =============================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { V2Logo } from '../V2Layout';
import v2api from '../v2api';
import '../../styles/v2.css';

export default function V2AuthPage({ mode = 'login' }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('email'); // email | code
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState(null);

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
      const r = await v2api.verifyEmailCode({ email, code, first_name: firstName, last_name: lastName });
      v2api.setSession(r.session_token);
      navigate(r.new_user ? '/app-v2/onboarding' : '/app-v2');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--v2-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <V2Logo size={56} />
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 14 }}>KOLO</div>
          <div style={{ fontSize: 13.5, color: 'var(--v2-muted)', marginTop: 4 }}>
            Ton copilote IA terrain
          </div>
        </div>

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
            <button className="v2-btn secondary full" onClick={() => alert('Google Sign-In bientôt disponible')} data-testid="auth-google">
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
