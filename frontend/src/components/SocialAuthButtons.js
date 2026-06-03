import React from 'react';

/**
 * Reusable Google / Apple social login buttons block.
 *
 * - Google → redirects to Emergent OAuth.
 *   REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 *
 * - Apple → disabled (placeholder) until APPLE_SIGNIN_ENABLED is flipped on the server.
 *   Tooltip explains it's coming soon.
 */
const SocialAuthButtons = ({ dividerLabel = 'ou continuer avec', appleEnabled = false }) => {
  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

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
    cursor: 'pointer',
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
        <span>{dividerLabel}</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>

      <button
        type="button"
        data-testid="google-signin-btn"
        onClick={handleGoogle}
        style={baseBtn}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ink-soft)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
        </svg>
        <span>Continuer avec Google</span>
      </button>

      <button
        type="button"
        data-testid="apple-signin-btn"
        disabled={!appleEnabled}
        title={appleEnabled ? 'Continuer avec Apple' : 'Bientôt disponible'}
        onClick={() => {
          if (!appleEnabled) return;
          // Future: trigger Apple ID JS popup (window.AppleID.auth.signIn())
        }}
        style={{
          ...baseBtn,
          background: '#000',
          color: '#fff',
          border: '1.5px solid #000',
          opacity: appleEnabled ? 1 : 0.4,
          cursor: appleEnabled ? 'pointer' : 'not-allowed',
        }}
        onMouseEnter={(e) => { if (appleEnabled) e.currentTarget.style.opacity = '0.9'; }}
        onMouseLeave={(e) => { if (appleEnabled) e.currentTarget.style.opacity = '1'; }}
      >
        <svg width="18" height="18" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
        </svg>
        <span>Continuer avec Apple</span>
        {!appleEnabled && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              background: 'rgba(255,255,255,0.15)',
              padding: '3px 8px',
              borderRadius: '999px',
              marginLeft: '4px',
            }}
          >
            Bientôt
          </span>
        )}
      </button>
    </div>
  );
};

export default SocialAuthButtons;
