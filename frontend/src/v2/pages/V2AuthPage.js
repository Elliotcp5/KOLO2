// =============================================================
// KOLO — Écran de connexion (langue visuelle B1)
// Fond uni #F0EEF8, logo KOLO noir centré, tagline vouvoyée,
// pilule rose pleine. Aucun texte en dur, aucune couleur en dur —
// i18n via b1t (FR/EN/IT/DE).
// =============================================================
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import v2api from '../v2api';
import b1t from '../../b1/b1i18n';
import B1BuildStamp from '../../b1/B1BuildStamp';
// Import webpack — URL hashée dans le bundle, chemin garanti après `cap sync ios`.
// L'asset vit dans src/assets/ pour être traité par webpack (CRA refuse les
// imports hors du dossier src/). Le PNG source est kolo-mark-black-256.png.
import koloLogoUrl from '../../assets/kolo-mark-black.png';
import '../../b1/b1.css';

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
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    const fromUrl = params.get('ref') || '';
    const fromStorage = (() => { try { return localStorage.getItem('kolo_referral_code') || ''; } catch { return ''; } })();
    const ref = (fromUrl || fromStorage || '').toUpperCase().trim();
    if (ref) {
      setReferralCode(ref);
      // referrer name loaded but not shown in the B1-style stripped UI
      v2api.referralInfo(ref).catch(() => {});
    }
  }, [params]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const sendCode = async () => {
    if (!emailValid) return;
    setError(''); setBusy(true);
    try {
      await v2api.sendEmailCode(email.trim().toLowerCase());
      setStep('code');
    } catch (e) { setError(e.message || 'error'); } finally { setBusy(false); }
  };

  const verify = async () => {
    setError(''); setBusy(true);
    try {
      const r = await v2api.verifyEmailCode({
        email: email.trim().toLowerCase(),
        code,
        first_name: firstName,
        last_name: lastName,
        referral_code: referralCode || undefined,
      });
      v2api.setSession(r.session_token);
      if (referralCode) { try { localStorage.removeItem('kolo_referral_code'); } catch (_) {} }
      try {
        if (r.app_version) localStorage.setItem('kolo_app_version', r.app_version);
        localStorage.setItem('kolo_zones_confirmees', r.zones_confirmees ? '1' : '0');
      } catch (_) {}
      if (r.app_version === 'b1') {
        if (!r.zones_confirmees) { navigate('/app-b1/reprise', { replace: true }); return; }
        navigate('/app-b1', { replace: true }); return;
      }
      navigate(r.new_user ? '/app-v2/onboarding' : '/app-v2');
    } catch (e) { setError(e.message || 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="b1-root" data-testid="auth-root">
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          position: 'relative',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Logotype KOLO — texte stylé (le PNG ne s'affichait pas au
              packaging Capacitor malgré plusieurs tentatives). Retour build
              2.20 : l'utilisateur accepte le repli texte. League Spartan,
              gras, noir, interlettrage resserré, centré. Ça doit ressembler
              à un logotype, pas à un titre de page. */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div
              data-testid="auth-logo"
              style={{
                fontFamily: '"League Spartan", "DM Sans", system-ui, -apple-system, sans-serif',
                fontWeight: 900,
                fontSize: 68,
                lineHeight: 1,
                color: '#0B0B0F',
                letterSpacing: '-0.045em',
                textAlign: 'center',
                userSelect: 'none',
                margin: '0 auto 22px',
              }}
            >
              KOLO
            </div>
            <div className="b1-lead" style={{ marginTop: 0, fontSize: 15, color: 'rgba(0,0,0,0.55)' }}>
              {b1t('auth.tagline')}
            </div>
          </div>

          {step === 'email' && (
            <>
              <div className="b1-input-label">{b1t('auth.email_label')}</div>
              <input
                className="b1-input"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={b1t('auth.email_placeholder')}
                data-testid="auth-email"
              />
              {mode === 'signup' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div>
                    <div className="b1-input-label">{b1t('auth.first_name')}</div>
                    <input className="b1-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} data-testid="auth-firstname" autoComplete="given-name" />
                  </div>
                  <div>
                    <div className="b1-input-label">{b1t('auth.last_name')}</div>
                    <input className="b1-input" value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="auth-lastname" autoComplete="family-name" />
                  </div>
                </div>
              )}
              {error && <p className="b1-small" style={{ color: 'var(--b1-danger)', marginTop: 8 }}>{error}</p>}
              <button
                className="b1-pill b1-pill--primary b1-pill--fullwidth"
                style={{ marginTop: 20 }}
                onClick={sendCode}
                disabled={busy || !emailValid}
                data-testid="auth-send-code"
              >
                {busy ? b1t('sys.un_instant') : b1t('auth.send_code')}
              </button>

              <p className="b1-small" style={{ textAlign: 'center', marginTop: 24, color: 'var(--b1-text-muted)' }}>
                {mode === 'login' ? (
                  <>{b1t('auth.no_account_q')}{' '}
                    <a
                      onClick={() => navigate('/signup')}
                      style={{ color: 'var(--b1-accent)', cursor: 'pointer', fontWeight: 600 }}
                      data-testid="auth-goto-signup"
                    >
                      {b1t('auth.create_account')}
                    </a>
                  </>
                ) : (
                  <>{b1t('auth.have_account_q')}{' '}
                    <a
                      onClick={() => navigate('/login')}
                      style={{ color: 'var(--b1-accent)', cursor: 'pointer', fontWeight: 600 }}
                      data-testid="auth-goto-login"
                    >
                      {b1t('auth.login')}
                    </a>
                  </>
                )}
              </p>
            </>
          )}

          {step === 'code' && (
            <>
              <p className="b1-lead" style={{ textAlign: 'center', marginBottom: 20 }}>
                {b1t('auth.code_sent_to', { email })}
              </p>
              <div className="b1-input-label">{b1t('auth.code_label')}</div>
              <input
                className="b1-input"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                style={{ textAlign: 'center', letterSpacing: '8px', fontSize: 20, fontWeight: 700 }}
                data-testid="auth-code-input"
                autoComplete="one-time-code"
              />
              {error && <p className="b1-small" style={{ color: 'var(--b1-danger)', marginTop: 8 }}>{error}</p>}
              <button
                className="b1-pill b1-pill--primary b1-pill--fullwidth"
                style={{ marginTop: 20 }}
                onClick={verify}
                disabled={busy || code.length !== 6}
                data-testid="auth-verify"
              >
                {busy ? b1t('auth.checking') : b1t('auth.confirm')}
              </button>
              <button
                className="b1-pill b1-pill--ghost b1-pill--fullwidth"
                style={{ marginTop: 10 }}
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                data-testid="auth-edit-email"
              >
                {b1t('auth.edit_email')}
              </button>
            </>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
          <B1BuildStamp inline />
        </div>
      </div>
    </div>
  );
}
