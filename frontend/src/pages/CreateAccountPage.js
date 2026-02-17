import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";
const API_URL = process.env.REACT_APP_BACKEND_URL;

const CreateAccountPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, locale } = useLocale();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    const sid = searchParams.get('session_id');
    if (!sid) {
      navigate('/subscribe', { replace: true });
      return;
    }
    setSessionId(sid);
  }, [searchParams, navigate]);

  const handleCreateAccount = async () => {
    if (!email || !password || !sessionId) return;
    
    if (password.length < 6) {
      toast.error(locale === 'fr' ? 'Le mot de passe doit contenir au moins 6 caractères' : 'Password must be at least 6 characters');
      return;
    }
    
    setCreating(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          payment_token: sessionId,
          email: email,
          password: password
        })
      });

      // Read JSON once
      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Failed to create account');
      }
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create account');
      }
      
      // Create a simple serializable object for login
      const userData = {
        user_id: data.user_id,
        email: data.email,
        subscription_status: data.subscription_status
      };
      
      // Login with clean data
      login(userData);
      toast.success(locale === 'fr' ? 'Compte créé avec succès!' : 'Account created successfully!');
      
      // Navigate without state to avoid cloning issues
      navigate('/app', { replace: true });
    } catch (error) {
      console.error('Create account error:', error);
      toast.error(error.message || (locale === 'fr' ? 'Erreur lors de la création du compte' : 'Failed to create account'));
      setCreating(false);
    }
  };

  if (!sessionId) {
    return null;
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

          {/* Success message */}
          <div style={{ 
            backgroundColor: 'rgba(16, 185, 129, 0.1)', 
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#10B981', fontWeight: '500' }}>
              {locale === 'fr' ? 'Paiement réussi!' : 'Payment successful!'}
            </p>
          </div>

          {/* Title */}
          <h1 className="text-title" style={{ textAlign: 'center', marginBottom: '8px' }}>
            {locale === 'fr' ? 'Créez votre compte' : 'Create your account'}
          </h1>

          <p className="text-body text-muted" style={{ textAlign: 'center', marginBottom: '32px' }}>
            {locale === 'fr' ? 'Entrez votre email et un mot de passe' : 'Enter your email and a password'}
          </p>

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
              placeholder={locale === 'fr' ? 'Mot de passe (min. 6 caractères)' : 'Password (min. 6 characters)'}
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

          {/* Create Account Button */}
          <button 
            className="btn-primary"
            onClick={handleCreateAccount}
            disabled={!email || !password || creating}
            data-testid="create-account-button"
            style={{ marginBottom: '24px' }}
          >
            {creating ? (
              <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
            ) : (
              locale === 'fr' ? 'Créer mon compte' : 'Create my account'
            )}
          </button>

          {/* Terms */}
          <p className="text-small text-muted" style={{ textAlign: 'center' }}>
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

export default CreateAccountPage;
