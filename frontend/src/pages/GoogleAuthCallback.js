import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';

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
  const [error, setError] = useState(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const errParam = params.get('error');

    if (errParam) {
      setError(`Google a refusé la connexion : ${errParam}`);
      return;
    }
    if (!code) {
      setError('Code OAuth manquant');
      return;
    }
    // Verify state to prevent CSRF
    try {
      const expected = sessionStorage.getItem('kolo_oauth_state');
      if (expected && state && expected !== state) {
        setError('État OAuth invalide (CSRF)');
        return;
      }
      sessionStorage.removeItem('kolo_oauth_state');
    } catch (_) { /* ignore */ }

    const redirectUri = window.location.origin + '/auth/google';
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/auth/google/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri, locale: (navigator.language || 'fr').slice(0, 2) }),
        });
        const data = await r.json();
        if (!r.ok || !data.token) {
          throw new Error(data.detail || 'Échec de la connexion Google');
        }
        localStorage.setItem('kolo_token', data.token);
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
        toast.success('Bienvenue !');
        window.location.replace('/app');
      } catch (e) {
        console.error('Google OAuth exchange failed', e);
        setError(typeof e?.message === 'string' ? e.message : 'Erreur inattendue');
      }
    })();
  }, [params, login, navigate]);

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
        {/* KOLO Logo */}
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
              Connexion en cours…
            </h1>
            <p style={{ fontSize: 14, color: 'var(--ink-mid)' }}>Finalisation avec Google</p>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, color: '#EF4444', marginBottom: 10 }}>
              Connexion impossible
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
              Retour à la connexion
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default GoogleAuthCallback;
