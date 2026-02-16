import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";

const LoginPage = () => {
  const navigate = useNavigate();
  const { t } = useLocale();

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/app';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="mobile-frame">
      <div className="page-container no-nav">
        {/* Back button */}
        <div className="header-back">
          <button 
            className="back-button"
            onClick={() => navigate('/')}
            data-testid="back-button"
          >
            <ArrowLeft size={20} strokeWidth={1.5} />
            {t('back')}
          </button>
        </div>

        <div style={{ padding: '0 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Logo */}
          <div className="logo-placeholder" style={{ marginTop: '40px', marginBottom: '48px' }}>
            <img 
              src={LOGO_URL} 
              alt="KOLO" 
              className="logo-image"
              style={{ maxHeight: '50px' }}
            />
          </div>

          {/* Title */}
          <h1 className="text-title" style={{ textAlign: 'center', marginBottom: '48px' }}>
            {t('welcomeBack')}
          </h1>

          {/* Google Login Button */}
          <button 
            className="btn-secondary"
            onClick={handleGoogleLogin}
            data-testid="google-login-button"
            style={{ marginBottom: '24px' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {t('continueWithGoogle')}
          </button>

          {/* Divider */}
          <div className="divider" style={{ marginBottom: '24px' }}>
            {t('or')}
          </div>

          {/* Email input */}
          <input
            type="email"
            className="input-dark"
            placeholder={t('email')}
            style={{ marginBottom: '16px' }}
            data-testid="email-input"
          />

          {/* Password input */}
          <input
            type="password"
            className="input-dark"
            placeholder={t('password')}
            style={{ marginBottom: '24px' }}
            data-testid="password-input"
          />

          {/* Sign In Button */}
          <button 
            className="btn-primary"
            onClick={() => {/* Email login not implemented - use Google */}}
            data-testid="signin-button"
          >
            {t('signIn')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
