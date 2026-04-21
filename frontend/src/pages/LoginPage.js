import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import '../styles/landing.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const { t } = useLocale();
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

    const API_BASE = 'https://trykolo.io';
    
    // Use XMLHttpRequest to avoid fetch interception issues
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/auth/login`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    xhr.onload = function() {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = { detail: xhr.responseText };
      }
      
      if (xhr.status === 200 && data.token) {
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
        // Handle specific error messages
        const errorMessage = data.detail || '';
        if (errorMessage.includes('incorrect') || errorMessage.includes('passe') || xhr.status === 401) {
          setError(t('invalidCredentials') || 'Email ou mot de passe incorrect');
        } else {
          setError(errorMessage || t('loginError') || 'Erreur de connexion');
        }
        setLoading(false);
      }
    };
    
    xhr.onerror = function() {
      console.error('Login network error');
      setError(t('networkError') || 'Impossible de contacter le serveur');
      setLoading(false);
    };
    
    xhr.send(JSON.stringify({ 
      email: email.trim().toLowerCase(), 
      password: password 
    }));
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Back button */}
        <button 
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--ink-mid)',
            cursor: 'pointer',
            marginBottom: '32px',
            padding: 0
          }}
        >
          <ArrowLeft size={20} strokeWidth={1.5} />
          <span>{t('back')}</span>
        </button>

        {/* Logo - Text KOLO with dot */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          marginBottom: '32px'
        }}>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '36px',
            fontWeight: '800',
            color: 'var(--ink)'
          }}>KOLO</span>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--grad)',
            marginBottom: '14px'
          }}></span>
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '28px',
          fontWeight: '800',
          color: 'var(--ink)',
          textAlign: 'center',
          marginBottom: '8px'
        }}>
          {t('welcomeBack')}
        </h1>
        <p style={{
          fontSize: '15px',
          color: 'var(--ink-mid)',
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          {t('signInToAccess')}
        </p>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              color: '#EF4444',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--ink-mid)'
            }}>Email</label>
            <input
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: '100%',
                height: '52px',
                padding: '0 16px',
                background: 'var(--bg-alt)',
                border: '1.5px solid var(--border)',
                borderRadius: '12px',
                fontFamily: 'var(--font-body)',
                fontSize: '15px',
                color: 'var(--ink)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--ink-mid)'
              }}>{t('password')}</label>
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{
                  background: 'none',
                  border: 'none',
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  color: 'var(--blue)',
                  cursor: 'pointer',
                  padding: 0,
                  fontWeight: '500'
                }}
              >
                {t('forgotPassword')}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  height: '52px',
                  padding: '0 48px 0 16px',
                  background: 'var(--bg-alt)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '12px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '15px',
                  color: 'var(--ink)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
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
                  color: 'var(--ink-soft)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '100%',
              height: '52px',
              background: 'var(--grad)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontFamily: 'var(--font-heading)',
              fontSize: '15px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {loading ? (
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }}></div>
            ) : (
              t('signIn')
            )}
          </button>
        </form>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          marginTop: '24px',
          fontSize: '14px',
          color: 'var(--ink-mid)'
        }}>
          {t('noAccount')}{' '}
          <Link to="/register" style={{
            color: 'var(--blue)',
            fontWeight: '600',
            textDecoration: 'none'
          }}>
            {t('createAccount')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
