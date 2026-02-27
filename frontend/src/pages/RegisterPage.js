import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Mail, Lock, Sparkles } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { API_URL } from '../config/api';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";

const RegisterPage = () => {
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error(locale === 'fr' ? 'Veuillez remplir tous les champs' : 'Please fill all fields');
      return;
    }
    
    if (password.length < 6) {
      toast.error(locale === 'fr' ? 'Le mot de passe doit contenir au moins 6 caractères' : 'Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.detail || (locale === 'fr' ? 'Erreur lors de l\'inscription' : 'Registration error'));
        setLoading(false);
        return;
      }
      
      // Login with returned data
      login({
        user_id: data.user_id,
        email: data.email,
        subscription_status: data.subscription_status,
        trial_ends_at: data.trial_ends_at,
        token: data.token
      });
      
      toast.success(locale === 'fr' ? 'Compte créé ! Bienvenue sur KOLO' : 'Account created! Welcome to KOLO');
      window.location.href = '/app';
    } catch (err) {
      toast.error(locale === 'fr' ? 'Erreur de connexion' : 'Connection error');
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
          <div className="logo-placeholder" style={{ marginTop: '24px', marginBottom: '24px' }}>
            <img 
              src={LOGO_URL} 
              alt="KOLO" 
              className="logo-image"
              style={{ maxHeight: '50px' }}
            />
          </div>

          {/* Trial badge */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
            border: '1px solid rgba(236, 72, 153, 0.3)',
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Sparkles size={20} color="white" />
            </div>
            <div>
              <p style={{ 
                fontWeight: '600', 
                fontSize: '15px',
                background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '2px'
              }}>
                {locale === 'fr' ? '7 jours gratuits' : '7 days free'}
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
                {locale === 'fr' ? 'Accès complet, sans carte bancaire' : 'Full access, no credit card'}
              </p>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-title" style={{ textAlign: 'center', marginBottom: '8px', fontSize: '26px' }}>
            {locale === 'fr' ? 'Créez votre compte' : 'Create your account'}
          </h1>

          <p className="text-body text-muted" style={{ textAlign: 'center', marginBottom: '32px' }}>
            {locale === 'fr' ? 'Commencez votre essai gratuit' : 'Start your free trial'}
          </p>

          <form onSubmit={handleRegister}>
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
            <div style={{ position: 'relative', marginBottom: '24px' }}>
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
                placeholder={locale === 'fr' ? 'Mot de passe (min. 6 caractères)' : 'Password (min. 6 characters)'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '52px', paddingRight: '52px' }}
                data-testid="password-input"
                autoComplete="new-password"
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

            {/* Register Button */}
            <button 
              type="submit"
              className="btn-primary"
              disabled={!email || !password || loading}
              data-testid="register-button"
              style={{ marginBottom: '16px' }}
            >
              {loading ? (
                <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
              ) : (
                locale === 'fr' ? 'Démarrer mon essai gratuit' : 'Start my free trial'
              )}
            </button>
          </form>

          {/* Login link */}
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
            {locale === 'fr' ? 'Déjà un compte ?' : 'Already have an account?'}{' '}
            <Link 
              to="/login" 
              style={{ 
                background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: '500',
                textDecoration: 'none'
              }}
            >
              {locale === 'fr' ? 'Se connecter' : 'Log in'}
            </Link>
          </p>

          {/* Terms */}
          <p className="text-small text-muted" style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '24px', paddingBottom: '24px' }}>
            {locale === 'fr' 
              ? 'En créant un compte, vous acceptez nos conditions d\'utilisation'
              : 'By creating an account, you agree to our terms of service'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
