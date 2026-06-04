import React, { useEffect, useState } from 'react';
import { API_URL } from '../config/api';
import { useLocale } from '../context/LocaleContext';

/**
 * Reusable Google / Apple social login buttons block.
 *
 * - Google → direct Google OAuth (no Emergent intermediary, no extra branding)
 *   Uses GOOGLE_CAL_CLIENT_ID (exposed via /api/auth/google/client-id).
 *   REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 *
 * - Apple → disabled (placeholder) until APPLE_SIGNIN_ENABLED is flipped on the server.
 */

const I18N = {
  fr: {
    continueGoogle: 'Continuer avec Google',
    signupGoogle: "S'inscrire avec Google",
    redirecting: 'Redirection…',
    unavailable: 'Google indisponible',
    orContinue: 'ou continuer avec',
    orSignup: "ou s'inscrire avec",
  },
  en: {
    continueGoogle: 'Continue with Google',
    signupGoogle: 'Sign up with Google',
    redirecting: 'Redirecting…',
    unavailable: 'Google unavailable',
    orContinue: 'or continue with',
    orSignup: 'or sign up with',
  },
  de: {
    continueGoogle: 'Mit Google fortfahren',
    signupGoogle: 'Mit Google registrieren',
    redirecting: 'Weiterleitung…',
    unavailable: 'Google nicht verfügbar',
    orContinue: 'oder fortfahren mit',
    orSignup: 'oder registrieren mit',
  },
  it: {
    continueGoogle: 'Continua con Google',
    signupGoogle: 'Registrati con Google',
    redirecting: 'Reindirizzamento…',
    unavailable: 'Google non disponibile',
    orContinue: 'o continua con',
    orSignup: 'o registrati con',
  },
};

const SocialAuthButtons = ({ dividerLabel, appleEnabled = false, mode = 'login' }) => {
  const { locale } = useLocale();
  const tr = I18N[locale] || I18N.en;
  const [clientId, setClientId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/auth/google/client-id`);
        if (r.ok) {
          const d = await r.json();
          if (alive) setClientId(d.client_id || null);
        }
      } catch (_) { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  const handleGoogle = () => {
    if (!clientId) return;
    setLoading(true);
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUri = window.location.origin + '/auth/google';
    const state = Math.random().toString(36).slice(2);
    try {
      sessionStorage.setItem('kolo_oauth_state', state);
      sessionStorage.setItem('kolo_oauth_mode', mode);
      sessionStorage.setItem('kolo_oauth_locale', locale || 'fr');
    } catch (_) {}
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      include_granted_scopes: 'true',
      prompt: 'select_account',
      state,
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const divider = dividerLabel || (mode === 'register' ? tr.orSignup : tr.orContinue);
  const ctaText = mode === 'register' ? tr.signupGoogle : tr.continueGoogle;

  const baseBtn = {
    width: '100%',
    height: '52px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    background: 'var(--bg-alt)',
    border: '1.5px solid var(--border)',
    borderRadius: '12px',
    fontFamily: 'var(--font-body)',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--ink)',
    cursor: clientId && !loading ? 'pointer' : 'not-allowed',
    opacity: clientId && !loading ? 1 : 0.6,
    transition: 'all 160ms ease',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '6px 0',
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
          color: 'var(--ink-soft)',
          letterSpacing: '0.04em',
        }}
      >
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span>{divider}</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>

      <button
        type="button"
        data-testid="google-signin-btn"
        onClick={handleGoogle}
        disabled={!clientId || loading}
        style={baseBtn}
        onMouseEnter={(e) => { if (clientId) e.currentTarget.style.borderColor = 'var(--ink-soft)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
        </svg>
        <span>{loading ? 'Redirection…' : (clientId ? ctaText : 'Google indisponible')}</span>
      </button>
    </div>
  );
};

export default SocialAuthButtons;
