import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import '../styles/landing.css';

const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useLocale();
  const { login } = useAuth();
  
  // Get email from landing page if passed
  const initialEmail = location.state?.email || '';
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!fullName.trim() || !phone.trim() || !email.trim() || !password) {
      setError(locale === 'fr' ? 'Veuillez remplir tous les champs' : 'Please fill all fields');
      return;
    }
    
    if (password.length < 6) {
      setError(locale === 'fr' ? 'Le mot de passe doit contenir au moins 6 caractères' : 'Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);

    try {
      const API_BASE = window.location.origin;
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          password: password,
          full_name: fullName.trim(),
          phone: phone.trim(),
          country_code: '+33'
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
        toast.success(locale === 'fr' ? 'Compte créé ! Bienvenue sur KOLO' : 'Account created! Welcome to KOLO');
        window.location.href = '/app';
      } else {
        if (data.detail && data.detail.includes('existe')) {
          setError(locale === 'fr' ? 'Un compte existe déjà avec cet email' : 'An account already exists with this email');
        } else {
          setError(data.detail || (locale === 'fr' ? 'Erreur lors de l\'inscription' : 'Registration error'));
        }
        setLoading(false);
      }
    } catch (err) {
      console.error('Register error:', err);
      setError(locale === 'fr' ? 'Erreur de connexion au serveur' : 'Server connection error');
      setLoading(false);
    }
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
          <span>{locale === 'fr' ? 'Retour' : 'Back'}</span>
        </button>

        {/* Logo - Text KOLO with dot */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          marginBottom: '24px'
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

        {/* Trial badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: 'linear-gradient(135deg, rgba(0, 74, 173, 0.08) 0%, rgba(203, 108, 230, 0.12) 100%)',
          border: '1px solid rgba(0, 74, 173, 0.15)',
          borderRadius: '999px',
          padding: '10px 20px',
          margin: '0 auto 24px',
          width: 'fit-content'
        }}>
          <Sparkles size={16} style={{ color: 'var(--blue)' }} />
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--ink-mid)'
          }}>{locale === 'fr' ? '7 jours gratuits · Sans carte bancaire' : '7 days free · No credit card'}</span>
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
          {locale === 'fr' ? 'Créer votre compte' : 'Create your account'}
        </h1>
        <p style={{
          fontSize: '15px',
          color: 'var(--ink-mid)',
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          {locale === 'fr' ? 'Rejoignez les agents qui closent plus' : 'Join agents who close more deals'}
        </p>

        {/* Form */}
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
            }}>{locale === 'fr' ? 'Nom complet' : 'Full name'}</label>
            <input
              type="text"
              placeholder={locale === 'fr' ? 'Jean Dupont' : 'John Doe'}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
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
            <label style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--ink-mid)'
            }}>{locale === 'fr' ? 'Téléphone' : 'Phone'}</label>
            <input
              type="tel"
              placeholder="+33 6 12 34 56 78"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
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
            <label style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--ink-mid)'
            }}>{locale === 'fr' ? 'Mot de passe' : 'Password'}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={locale === 'fr' ? '6 caractères minimum' : '6 characters minimum'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
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
              locale === 'fr' ? 'Commencer gratuitement' : 'Start for free'
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
          {locale === 'fr' ? 'Déjà un compte ?' : 'Already have an account?'}{' '}
          <Link to="/login" style={{
            color: 'var(--blue)',
            fontWeight: '600',
            textDecoration: 'none'
          }}>
            {locale === 'fr' ? 'Se connecter' : 'Sign in'}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
