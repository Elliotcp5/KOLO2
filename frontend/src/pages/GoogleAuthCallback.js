import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';

const I18N = {
  fr: {
    connecting: 'Connexion en cours…',
    finalizing: 'Finalisation avec Google',
    impossibleTitle: 'Connexion impossible',
    back: 'Retour à la connexion',
    welcomeNew: (name) => `Bienvenue sur KOLO, ${name || 'agent'} ! 🎉`,
    welcomeBack: 'Bon retour !',
    csrf: 'État OAuth invalide (CSRF)',
    missingCode: 'Code OAuth manquant',
    googleRefused: (e) => `Google a refusé la connexion : ${e}`,
    exchangeFail: 'Échec de la connexion Google',
    unexpected: 'Erreur inattendue',
  },
  en: {
    connecting: 'Connecting…',
    finalizing: 'Finalizing with Google',
    impossibleTitle: 'Sign-in failed',
    back: 'Back to login',
    welcomeNew: (name) => `Welcome to KOLO, ${name || 'agent'}! 🎉`,
    welcomeBack: 'Welcome back!',
    csrf: 'Invalid OAuth state (CSRF)',
    missingCode: 'OAuth code missing',
    googleRefused: (e) => `Google denied sign-in: ${e}`,
    exchangeFail: 'Google sign-in failed',
    unexpected: 'Unexpected error',
  },
  de: {
    connecting: 'Anmeldung läuft…',
    finalizing: 'Abschluss mit Google',
    impossibleTitle: 'Anmeldung fehlgeschlagen',
    back: 'Zurück zur Anmeldung',
    welcomeNew: (name) => `Willkommen bei KOLO, ${name || 'Agent'}! 🎉`,
    welcomeBack: 'Willkommen zurück!',
    csrf: 'Ungültiger OAuth-Zustand (CSRF)',
    missingCode: 'OAuth-Code fehlt',
    googleRefused: (e) => `Google hat die Anmeldung verweigert: ${e}`,
    exchangeFail: 'Google-Anmeldung fehlgeschlagen',
    unexpected: 'Unerwarteter Fehler',
  },
  it: {
    connecting: 'Accesso in corso…',
    finalizing: 'Completamento con Google',
    impossibleTitle: 'Accesso non riuscito',
    back: "Torna all'accesso",
    welcomeNew: (name) => `Benvenuto su KOLO, ${name || 'agente'}! 🎉`,
    welcomeBack: 'Bentornato!',
    csrf: 'Stato OAuth non valido (CSRF)',
    missingCode: 'Codice OAuth mancante',
    googleRefused: (e) => `Google ha rifiutato l'accesso: ${e}`,
    exchangeFail: 'Accesso Google non riuscito',
    unexpected: 'Errore imprevisto',
  },
};

/**
 * Google OAuth callback page.
 * Handles `https://<origin>/auth/google?code=...&state=...`
 * Exchanges the code with the backend and redirects into the app.
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 */
const GoogleAuthCallback = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login } = useAuth();
  const { locale } = useLocale();
  const tr = I18N[locale] || I18N.en;
  const [error, setError] = useState(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const errParam = params.get('error');

    if (errParam) {
      setError(tr.googleRefused(errParam));
      return;
    }
    if (!code) {
      setError(tr.missingCode);
      return;
    }
    try {
      const expected = sessionStorage.getItem('kolo_oauth_state');
      if (expected && state && expected !== state) {
        setError(tr.csrf);
        return;
      }
      sessionStorage.removeItem('kolo_oauth_state');
    } catch (_) {}

    const redirectUri = window.location.origin + '/auth/google';
    let oauthLocale = locale || 'fr';
    try { oauthLocale = sessionStorage.getItem('kolo_oauth_locale') || locale || 'fr'; } catch (_) {}

    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/auth/google/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri, locale: oauthLocale }),
        });
        const data = await r.json();
        if (!r.ok || !data.token) {
          throw new Error(data.detail || tr.exchangeFail);
        }
        localStorage.setItem('kolo_token', data.token);
        // V2 dual-store : si l'utilisateur vient de la V2, on stocke aussi pour V2
        let oauthTarget = 'v1';
        try { oauthTarget = sessionStorage.getItem('kolo_oauth_target') || 'v1'; } catch (_) {}
        if (oauthTarget === 'v2') {
          try { localStorage.setItem('kolo_v2_session', data.token); } catch (_) {}
        }
        // Attribute referral if user came via /r/:code
        let refCode = null;
        try { refCode = localStorage.getItem('kolo_referral_code'); } catch (_) {}
        if (refCode && data.user_id) {
          try {
            await fetch(`${API_URL}/api/v2/referral/attribute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
              body: JSON.stringify({ referral_code: refCode, referred_user_id: data.user_id }),
            });
            localStorage.removeItem('kolo_referral_code');
          } catch (_) {}
        }
        login({
          user_id: data.user_id,
          email: data.email,
          name: data.name,
          avatar_url: data.avatar_url,
          subscription_status: data.subscription_status,
          trial_ends_at: data.trial_ends_at,
          is_super_admin: data.is_super_admin,
          token: data.token,
        });
        let mode = 'login';
        try { mode = sessionStorage.getItem('kolo_oauth_mode') || 'login'; } catch (_) {}
        try { sessionStorage.removeItem('kolo_oauth_mode'); sessionStorage.removeItem('kolo_oauth_locale'); } catch (_) {}
        const isNewish = mode === 'register' || data.subscription_status === 'trialing';
        const firstName = (data.name || '').split(' ')[0] || '';
        toast.success(isNewish ? tr.welcomeNew(firstName) : tr.welcomeBack);
        // Cible navigation : V2 si l'utilisateur vient de la V2, sinon V1
        if (oauthTarget === 'v2') {
          // Vérifier si l'onboarding V2 est complété
          let goOnboarding = false;
          try {
            const orb = await fetch(`${API_URL}/api/v2/onboarding`, {
              headers: { Authorization: `Bearer ${data.token}` },
            });
            if (orb.ok) {
              const o = await orb.json();
              goOnboarding = !o || !o.role;
            }
          } catch (_) { goOnboarding = false; }
          try { sessionStorage.removeItem('kolo_oauth_target'); } catch (_) {}
          window.location.replace(goOnboarding ? '/app-v2/onboarding' : '/app-v2');
          return;
        }
        window.location.replace('/app');
      } catch (e) {
        console.error('Google OAuth exchange failed', e);
        setError(typeof e?.message === 'string' ? e.message : tr.unexpected);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginBottom: 24 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 800, color: 'var(--ink)' }}>KOLO</span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--grad)', marginBottom: 10 }} />
        </div>
        {!error ? (
          <>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              border: '3px solid rgba(0,0,0,0.08)',
              borderTopColor: '#8B5CF6',
              animation: 'spin 0.9s linear infinite',
              margin: '0 auto 16px',
            }} />
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
              {tr.connecting}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--ink-mid)' }}>{tr.finalizing}</p>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, color: '#EF4444', marginBottom: 10 }}>
              {tr.impossibleTitle}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--ink-mid)', marginBottom: 22 }}>{error}</p>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'var(--grad)',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '12px 22px',
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {tr.back}
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default GoogleAuthCallback;
