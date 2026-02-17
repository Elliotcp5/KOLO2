import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { API_URL } from '../config/api';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";

const LoginPage = () => {
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRecover, setShowRecover] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (!response.ok) {
        const errorMsg = data.detail || 'Login failed';
        toast.error(locale === 'fr' && errorMsg === 'Invalid email or password' 
          ? 'Email ou mot de passe incorrect' 
          : errorMsg);
        setLoading(false);
        return;
      }
      
      // Create clean user data with token
      const userData = {
        user_id: data.user_id,
        email: data.email,
        subscription_status: data.subscription_status,
        token: data.token  // Include token for localStorage storage
      };
      login(userData);
      
      // Use window.location for more reliable redirect
      window.location.href = '/app';
    } catch (err) {
      // Safely handle error without cloning issues
      const errorMsg = err && typeof err === 'object' && 'message' in err 
        ? String(err.message) 
        : 'Connection error';
      toast.error(locale === 'fr' ? 'Erreur de connexion' : errorMsg);
      setLoading(false);
    }
  };

  const handleRecover = async () => {
    if (!email || !password) return;
    
    if (password.length < 6) {
      toast.error(locale === 'fr' ? 'Le mot de passe doit contenir au moins 6 caractères' : 'Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (!response.ok) {
        const errorMsg = data.detail || 'Recovery failed';
        toast.error(locale === 'fr' ? 'Impossible de récupérer le compte' : errorMsg);
        setLoading(false);
        return;
      }
      
      // Create clean user data with token
      const userData = {
        user_id: data.user_id,
        email: data.email,
        subscription_status: data.subscription_status,
        token: data.token  // Include token for localStorage storage
      };
      login(userData);
      toast.success(locale === 'fr' ? 'Compte récupéré!' : 'Account recovered!');
      
      // Use window.location for more reliable redirect
      window.location.href = '/app';
    } catch (err) {
      const errorMsg = err && typeof err === 'object' && 'message' in err 
        ? String(err.message) 
        : 'Connection error';
      toast.error(locale === 'fr' ? 'Erreur de connexion' : errorMsg);
      setLoading(false);
    }
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
          <h1 className="text-title" style={{ textAlign: 'center', marginBottom: '32px' }}>
            {showRecover 
              ? (locale === 'fr' ? 'Récupérer mon compte' : 'Recover my account')
              : t('welcomeBack')
            }
          </h1>

          {showRecover && (
            <p className="text-body text-muted" style={{ textAlign: 'center', marginBottom: '24px' }}>
              {locale === 'fr' 
                ? 'Entrez l\'email utilisé lors du paiement et créez un mot de passe'
                : 'Enter the email used for payment and create a password'
              }
            </p>
          )}

          {/* Email input */}
          <input
            type="email"
            className="input-dark"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginBottom: '16px' }}
            data-testid="email-input"
          />

          {/* Password input */}
          <div style={{ position: 'relative', marginBottom: '24px' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              className="input-dark"
              placeholder={showRecover 
                ? (locale === 'fr' ? 'Nouveau mot de passe' : 'New password')
                : (locale === 'fr' ? 'Mot de passe' : 'Password')
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: '48px' }}
              data-testid="password-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Main Button */}
          <button 
            className="btn-primary"
            onClick={showRecover ? handleRecover : handleLogin}
            disabled={!email || !password || loading}
            data-testid="signin-button"
            style={{ marginBottom: '12px' }}
          >
            {loading ? (
              <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
            ) : showRecover ? (
              locale === 'fr' ? 'Récupérer mon compte' : 'Recover my account'
            ) : (
              t('signIn')
            )}
          </button>

          {/* Forgot Password link */}
          {!showRecover && (
            <button
              className="btn-ghost"
              onClick={() => navigate('/forgot-password')}
              style={{ 
                color: 'var(--muted)', 
                fontSize: '13px',
                marginBottom: '16px'
              }}
              data-testid="forgot-password-link"
            >
              {locale === 'fr' ? 'Mot de passe oublié ?' : 'Forgot password?'}
            </button>
          )}

          {/* Toggle recover mode */}
          <button
            className="btn-ghost"
            onClick={() => setShowRecover(!showRecover)}
            style={{ color: 'var(--accent)', fontSize: '14px' }}
            data-testid="toggle-recover"
          >
            {showRecover 
              ? (locale === 'fr' ? '← Retour à la connexion' : '← Back to login')
              : (locale === 'fr' ? 'J\'ai payé mais je n\'ai pas de compte' : 'I paid but don\'t have an account')
            }
          </button>

          {/* Subscribe link */}
          {!showRecover && (
            <div style={{ marginTop: 'auto', paddingBottom: '40px', textAlign: 'center' }}>
              <p className="text-small text-muted" style={{ marginBottom: '8px' }}>
                {locale === 'fr' ? 'Pas encore de compte?' : 'Don\'t have an account?'}
              </p>
              <button
                className="btn-ghost"
                onClick={() => navigate('/subscribe')}
                style={{ color: 'var(--accent)' }}
                data-testid="go-to-subscribe"
              >
                {locale === 'fr' ? 'S\'abonner' : 'Subscribe'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
