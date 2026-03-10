import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";

const LoginPage = () => {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const API_BASE = window.location.origin;
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          password: password 
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.token) {
        localStorage.setItem('kolo_token', data.token);
        login({
          user_id: data.user_id,
          email: data.email,
          subscription_status: data.subscription_status,
          trial_ends_at: data.trial_ends_at,
          token: data.token
        });
        window.location.href = '/app';
      } else {
        setError(data.detail || 'Email ou mot de passe incorrect');
        setLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Erreur de connexion au serveur');
      setLoading(false);
    }
  };

  return (
    <div className="mobile-frame">
      <div className="page-container no-nav">
        <div className="header-back">
          <button className="back-button" onClick={() => navigate('/')}>
            <ArrowLeft size={20} strokeWidth={1.5} />
            {locale === 'fr' ? 'Retour' : 'Back'}
          </button>
        </div>

        <div style={{ padding: '0 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginTop: '40px', marginBottom: '48px', textAlign: 'center' }}>
            <img src={LOGO_URL} alt="KOLO" style={{ maxHeight: '50px' }} />
          </div>

          <h1 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '26px', color: 'white' }}>
            {locale === 'fr' ? 'Bon retour !' : 'Welcome back!'}
          </h1>
          
          <p style={{ textAlign: 'center', marginBottom: '32px', color: 'var(--muted)' }}>
            {locale === 'fr' ? 'Connectez-vous à votre compte' : 'Sign in to your account'}
          </p>

          {error && (
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              color: '#ef4444',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <input
              type="email"
              className="input-dark"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ marginBottom: '16px' }}
              required
            />

            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-dark"
                placeholder={locale === 'fr' ? 'Mot de passe' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: '52px' }}
                required
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
                  cursor: 'pointer'
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div style={{ textAlign: 'right', marginBottom: '24px' }}>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer' }}
              >
                {locale === 'fr' ? 'Mot de passe oublié ?' : 'Forgot password?'}
              </button>
            </div>

            <button 
              type="submit"
              className="btn-primary"
              disabled={!email || !password || loading}
              style={{ marginBottom: '24px' }}
            >
              {loading ? (
                <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
              ) : (
                locale === 'fr' ? 'Se connecter' : 'Sign in'
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
            {locale === 'fr' ? 'Pas encore de compte ?' : "Don't have an account?"}{' '}
            <Link to="/register" style={{ color: 'var(--accent)', fontWeight: '500', textDecoration: 'none' }}>
              {locale === 'fr' ? 'Créer un compte' : 'Create account'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
