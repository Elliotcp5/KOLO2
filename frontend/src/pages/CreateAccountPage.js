import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import PWAGuide from '../components/PWAGuide';
import pushService from '../services/pushNotifications';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";
const API_URL = process.env.REACT_APP_BACKEND_URL;

const CreateAccountPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, locale } = useLocale();
  const { createAccountAfterPayment } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [paymentToken, setPaymentToken] = useState(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showPWAGuide, setShowPWAGuide] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  // Check payment status on mount
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      navigate('/subscribe', { replace: true });
      return;
    }

    const pollPaymentStatus = async (attempts = 0) => {
      const maxAttempts = 10;
      const pollInterval = 2000;

      if (attempts >= maxAttempts) {
        setError(t('paymentFailed'));
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/payments/status/${sessionId}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.payment_status === 'paid') {
            setPaymentVerified(true);
            setPaymentToken(data.payment_token);
            setLoading(false);
            return;
          } else if (data.status === 'expired') {
            setError(t('paymentFailed'));
            setLoading(false);
            return;
          }
        }

        setTimeout(() => pollPaymentStatus(attempts + 1), pollInterval);
      } catch (err) {
        console.error('Payment status error:', err);
        setTimeout(() => pollPaymentStatus(attempts + 1), pollInterval);
      }
    };

    pollPaymentStatus();
  }, [searchParams, navigate, t]);

  const handleGoogleSignUp = () => {
    if (paymentToken) {
      sessionStorage.setItem('payment_token', paymentToken);
      sessionStorage.setItem('show_pwa_guide', 'true');
    }
    const redirectUrl = window.location.origin + '/app';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleEmailSignUp = async () => {
    if (!email || !paymentToken) return;
    
    setCreating(true);
    setError('');

    try {
      await createAccountAfterPayment(paymentToken, email);
      // Show PWA guide after successful account creation
      setShowPWAGuide(true);
    } catch (err) {
      setError(err.message || t('paymentFailed'));
      setCreating(false);
    }
  };

  const handlePWAGuideComplete = () => {
    setShowPWAGuide(false);
    setShowNotificationPrompt(true);
  };

  const handleEnableNotifications = async () => {
    const permitted = await pushService.requestPermission();
    if (permitted) {
      await pushService.init();
    }
    navigate('/app', { replace: true });
  };

  const handleSkipNotifications = () => {
    navigate('/app', { replace: true });
  };

  // Show PWA Guide
  if (showPWAGuide) {
    return <PWAGuide onComplete={handlePWAGuideComplete} />;
  }

  // Show notification prompt
  if (showNotificationPrompt) {
    return (
      <div className="mobile-frame">
        <div className="page-container no-nav" style={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '32px'
        }}>
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '25px',
            backgroundColor: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px'
          }}>
            <Bell size={48} style={{ color: 'var(--accent)' }} />
          </div>

          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: 'var(--text)',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            {locale === 'fr' ? 'Activer les notifications' : 'Enable notifications'}
          </h2>

          <p style={{
            fontSize: '16px',
            color: 'var(--muted)',
            textAlign: 'center',
            marginBottom: '40px',
            maxWidth: '280px',
            lineHeight: '1.5'
          }}>
            {locale === 'fr' 
              ? 'Recevez des rappels pour ne jamais oublier de relancer vos prospects'
              : 'Get reminders so you never forget to follow up with your prospects'
            }
          </p>

          <button 
            className="btn-primary"
            onClick={handleEnableNotifications}
            style={{ marginBottom: '16px', width: '100%', maxWidth: '300px' }}
            data-testid="enable-notifications"
          >
            {locale === 'fr' ? 'Activer' : 'Enable'}
          </button>

          <button 
            className="btn-ghost"
            onClick={handleSkipNotifications}
            style={{ color: 'var(--muted)' }}
            data-testid="skip-notifications"
          >
            {locale === 'fr' ? 'Plus tard' : 'Maybe later'}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mobile-frame">
        <div className="page-container no-nav" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="spinner"></div>
          <p className="text-muted" style={{ marginTop: '16px' }}>{t('processing')}</p>
        </div>
      </div>
    );
  }

  if (!paymentVerified) {
    return (
      <div className="mobile-frame">
        <div className="page-container no-nav" style={{ justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
          <p className="text-body" style={{ textAlign: 'center', marginBottom: '24px' }}>
            {error || t('paymentFailed')}
          </p>
          <button 
            className="btn-primary"
            onClick={() => navigate('/subscribe')}
            style={{ maxWidth: '280px' }}
          >
            {t('goToSubscribe')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-frame">
      <div className="page-container no-nav">
        {/* Back button */}
        <div className="header-back">
          <button 
            className="back-button"
            onClick={() => navigate('/subscribe')}
            data-testid="back-button"
          >
            <ArrowLeft size={20} strokeWidth={1.5} />
            {t('back')}
          </button>
        </div>

        <div style={{ padding: '0 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Logo */}
          <div className="logo-placeholder" style={{ marginTop: '24px', marginBottom: '32px' }}>
            <img 
              src={LOGO_URL} 
              alt="KOLO" 
              className="logo-image"
              style={{ maxHeight: '50px' }}
            />
          </div>

          {/* Title */}
          <h1 className="text-title" style={{ textAlign: 'center', marginBottom: '8px' }}>
            {t('createYourAccount')}
          </h1>

          <p className="text-body text-muted" style={{ textAlign: 'center', marginBottom: '32px' }}>
            {t('chooseSignUp')}
          </p>

          {/* Success message */}
          <div style={{ 
            backgroundColor: 'rgba(16, 185, 129, 0.1)', 
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#10B981', fontWeight: '500' }}>{t('paymentSuccess')}</p>
          </div>

          {/* Google button */}
          <button 
            className="btn-secondary"
            onClick={handleGoogleSignUp}
            data-testid="google-signup-button"
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
            {t('orWithEmail')}
          </div>

          {/* Email input */}
          <input
            type="email"
            className="input-dark"
            placeholder={t('email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginBottom: '24px' }}
            data-testid="email-input"
          />

          {error && (
            <p style={{ color: 'var(--error)', marginBottom: '16px', textAlign: 'center' }}>
              {error}
            </p>
          )}

          {/* Create Account Button */}
          <button 
            className="btn-primary"
            onClick={handleEmailSignUp}
            disabled={!email || creating}
            data-testid="create-account-button"
            style={{ marginBottom: '24px' }}
          >
            {creating ? <div className="spinner"></div> : t('createAccount')}
          </button>

          {/* Terms */}
          <p className="text-small" style={{ textAlign: 'center' }}>
            {t('termsLine')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreateAccountPage;
