import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";

const RegisterPage = () => {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const { login } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
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
    <div className="mobile-frame">
      <div className="page-container no-nav">
        <div className="header-back">
          <button className="back-button" onClick={() => navigate('/')}>
            <ArrowLeft size={20} strokeWidth={1.5} />
            {locale === 'fr' ? 'Retour' : 'Back'}
          </button>
        </div>

        <div style={{ padding: '0 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginTop: '24px', marginBottom: '24px', textAlign: 'center' }}>
            <img src={LOGO_URL} alt="KOLO" style={{ maxHeight: '50px' }} />
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
            gap: '16px'
          }}>
            <div style={{ 
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Sparkles size={20} color="white" />
            </div>
            <div>
              <p style={{ fontWeight: '600', fontSize: '15px', color: '#EC4899', marginBottom: '2px' }}>
                {locale === 'fr' ? '7 jours gratuits' : '7 days free'}
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
                {locale === 'fr' ? 'Accès complet, sans carte bancaire' : 'Full access, no credit card'}
              </p>
            </div>
          </div>

          <h1 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '26px', color: 'white' }}>
            {locale === 'fr' ? 'Créez votre compte' : 'Create your account'}
          </h1>

          <p style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--muted)' }}>
            {locale === 'fr' ? 'Commencez votre essai gratuit' : 'Start your free trial'}
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

          <form onSubmit={handleRegister}>
            <input
              type="text"
              className="input-dark"
              placeholder={locale === 'fr' ? 'Nom complet' : 'Full name'}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ marginBottom: '16px' }}
              required
            />

            <input
              type="tel"
              className="input-dark"
              placeholder={locale === 'fr' ? 'Téléphone' : 'Phone'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ marginBottom: '16px' }}
              required
            />

            <input
              type="email"
              className="input-dark"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ marginBottom: '16px' }}
              required
            />

            <div style={{ position: 'relative', marginBottom: '24px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-dark"
                placeholder={locale === 'fr' ? 'Mot de passe (min. 6 caractères)' : 'Password (min. 6 characters)'}
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

            <button 
              type="submit"
              className="btn-primary"
              disabled={!fullName || !phone || !email || !password || loading}
              style={{ marginBottom: '24px' }}
            >
              {loading ? (
                <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
              ) : (
                locale === 'fr' ? 'Commencer l\'essai gratuit' : 'Start free trial'
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
            {locale === 'fr' ? 'Déjà un compte ?' : 'Already have an account?'}{' '}
            <Link to="/login" style={{ color: 'var(--accent)', fontWeight: '500', textDecoration: 'none' }}>
              {locale === 'fr' ? 'Se connecter' : 'Sign in'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
