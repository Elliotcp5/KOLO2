import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Mail, Lock } from 'lucide-react';
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

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    
    const trimmedEmail = email.trim().toLowerCase();

    try {
      // Use fetch with cache-busting headers
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ 
          email: trimmedEmail, 
          password 
        }),
        cache: 'no-store'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Store token immediately
        if (data.token) {
          localStorage.setItem('kolo_token', data.token);
        }
        
        // Create clean user data with token
        const userData = {
          user_id: data.user_id,
          email: data.email,
          subscription_status: data.subscription_status,
          trial_ends_at: data.trial_ends_at,
          token: data.token
        };
        login(userData);
        
        window.location.href = '/app';
      } else {
        const errorMsg = data.detail || (locale === 'fr' ? 'Email ou mot de passe incorrect' : 'Invalid email or password');
        toast.error(errorMsg);
        setLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(locale === 'fr' ? 'Erreur de connexion au serveur. Vérifiez votre connexion internet.' : 'Server connection error. Check your internet.');
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
          <h1 className="text-title" style={{ textAlign: 'center', marginBottom: '8px', fontSize: '26px' }}>
            {t('welcomeBack')}
          </h1>
          
          <p className="text-body text-muted" style={{ textAlign: 'center', marginBottom: '32px' }}>
            {locale === 'fr' ? 'Connectez-vous à votre compte' : 'Sign in to your account'}
          </p>

          <form onSubmit={handleLogin}>
            {/* Email input */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Mail 
                size={20} 
                style={{ 
                  position: 'absolute', 
                  left: '20px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--muted-dark)'
                }} 
              />
              <input
                type="email"
                className="input-dark"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '52px' }}
                data-testid="email-input"
                autoComplete="email"
              />
            </div>

            {/* Password input */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Lock 
                size={20} 
                style={{ 
                  position: 'absolute', 
                  left: '20px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--muted-dark)'
                }} 
              />
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-dark"
                placeholder={locale === 'fr' ? 'Mot de passe' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '52px', paddingRight: '52px' }}
                data-testid="password-input"
                autoComplete="current-password"
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

            {/* Forgot Password link */}
            <div style={{ textAlign: 'right', marginBottom: '24px' }}>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                style={{ 
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)', 
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: 0
                }}
                data-testid="forgot-password-link"
              >
                {locale === 'fr' ? 'Mot de passe oublié ?' : 'Forgot password?'}
              </button>
            </div>

            {/* Login Button */}
            <button 
              type="submit"
              className="btn-primary"
              disabled={!email || !password || loading}
              data-testid="signin-button"
              style={{ marginBottom: '24px' }}
            >
              {loading ? (
                <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
              ) : (
                t('signIn')
              )}
            </button>
          </form>

          {/* Register link */}
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
            {locale === 'fr' ? 'Pas encore de compte ?' : 'Don\'t have an account?'}{' '}
            <Link 
              to="/register" 
              style={{ 
                background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: '500',
                textDecoration: 'none'
              }}
            >
              {locale === 'fr' ? 'Créer un compte' : 'Create account'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
