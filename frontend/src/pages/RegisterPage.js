import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Mail, Lock, Sparkles, Phone, User, ChevronDown } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { API_URL } from '../config/api';
import { trackSignUp, trackTrialStarted, setUserId } from '../utils/analytics';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";

// Country codes for phone numbers
const COUNTRY_CODES = [
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'France' },
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'USA' },
  { code: '+1', country: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'UK' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: '+34', country: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: '+39', country: 'IT', flag: '🇮🇹', name: 'Italy' },
  { code: '+32', country: 'BE', flag: '🇧🇪', name: 'Belgium' },
  { code: '+41', country: 'CH', flag: '🇨🇭', name: 'Switzerland' },
  { code: '+352', country: 'LU', flag: '🇱🇺', name: 'Luxembourg' },
  { code: '+377', country: 'MC', flag: '🇲🇨', name: 'Monaco' },
  { code: '+351', country: 'PT', flag: '🇵🇹', name: 'Portugal' },
  { code: '+31', country: 'NL', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+212', country: 'MA', flag: '🇲🇦', name: 'Morocco' },
  { code: '+216', country: 'TN', flag: '🇹🇳', name: 'Tunisia' },
  { code: '+213', country: 'DZ', flag: '🇩🇿', name: 'Algeria' },
];

const RegisterPage = () => {
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const { login } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+33');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  const handleRegister = async (e) => {
    e.preventDefault();
    
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim().replace(/\s/g, '');
    
    if (!trimmedName || !trimmedEmail || !password || !trimmedPhone) {
      toast.error(locale === 'fr' ? 'Veuillez remplir tous les champs' : 'Please fill all fields');
      return;
    }
    
    if (trimmedName.length < 2) {
      toast.error(locale === 'fr' ? 'Nom invalide' : 'Invalid name');
      return;
    }
    
    if (password.length < 6) {
      toast.error(locale === 'fr' ? 'Le mot de passe doit contenir au moins 6 caractères' : 'Password must be at least 6 characters');
      return;
    }
    
    if (trimmedPhone.length < 6) {
      toast.error(locale === 'fr' ? 'Numéro de téléphone invalide' : 'Invalid phone number');
      return;
    }
    
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ 
          email: trimmedEmail, 
          password,
          full_name: trimmedName,
          phone: trimmedPhone,
          country_code: countryCode
        }),
        cache: 'no-store'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.token) {
          localStorage.setItem('kolo_token', data.token);
        }
        
        // Track signup and trial start
        trackSignUp('email');
        trackTrialStarted();
        setUserId(data.user_id);
        
        login({
          user_id: data.user_id,
          email: data.email,
          name: trimmedName,
          subscription_status: data.subscription_status,
          trial_ends_at: data.trial_ends_at,
          token: data.token
        });
        
        toast.success(locale === 'fr' ? 'Compte créé ! Bienvenue sur KOLO' : 'Account created! Welcome to KOLO');
        window.location.href = '/app';
      } else {
        const errorMsg = data.detail || (locale === 'fr' ? 'Erreur lors de l\'inscription' : 'Registration error');
        toast.error(errorMsg);
        setLoading(false);
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(locale === 'fr' ? 'Erreur de connexion au serveur' : 'Server connection error');
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
          <div className="logo-placeholder" style={{ marginTop: '16px', marginBottom: '16px' }}>
            <img 
              src={LOGO_URL} 
              alt="KOLO" 
              className="logo-image"
              style={{ maxHeight: '40px' }}
            />
          </div>

          {/* Trial badge */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
            border: '1px solid rgba(236, 72, 153, 0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Sparkles size={18} style={{ color: '#EC4899' }} />
            <span style={{ 
              fontSize: '14px',
              background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: '500'
            }}>
              {locale === 'fr' ? '7 jours gratuits • Sans carte bancaire' : '7 days free • No credit card'}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-title" style={{ textAlign: 'center', marginBottom: '24px', fontSize: '24px' }}>
            {locale === 'fr' ? 'Créez votre compte' : 'Create your account'}
          </h1>

          <form onSubmit={handleRegister}>
            {/* Name input */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <User 
                size={18} 
                style={{ 
                  position: 'absolute', 
                  left: '16px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--muted-dark)'
                }} 
              />
              <input
                type="text"
                className="input-dark"
                placeholder={locale === 'fr' ? 'Prénom et Nom' : 'Full Name'}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ paddingLeft: '44px', height: '48px' }}
                data-testid="name-input"
                autoComplete="name"
              />
            </div>

            {/* Email input */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Mail 
                size={18} 
                style={{ 
                  position: 'absolute', 
                  left: '16px', 
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
                style={{ paddingLeft: '44px', height: '48px' }}
                data-testid="email-input"
                autoComplete="email"
              />
            </div>

            {/* Phone input with country selector */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {/* Country code selector */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowCountryPicker(!showCountryPicker)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--surface-light)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '0 12px',
                    height: '48px',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    minWidth: '90px'
                  }}
                  data-testid="country-selector"
                >
                  <span style={{ fontSize: '18px' }}>{selectedCountry.flag}</span>
                  <span style={{ fontSize: '14px' }}>{countryCode}</span>
                  <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
                </button>
                
                {/* Country dropdown */}
                {showCountryPicker && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    zIndex: 100,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    width: '180px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                  }}>
                    {COUNTRY_CODES.map((country, index) => (
                      <button
                        key={`${country.code}-${country.country}`}
                        type="button"
                        onClick={() => {
                          setCountryCode(country.code);
                          setShowCountryPicker(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '10px 12px',
                          background: countryCode === country.code ? 'var(--surface-light)' : 'transparent',
                          border: 'none',
                          color: 'var(--text)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '14px'
                        }}
                      >
                        <span>{country.flag}</span>
                        <span style={{ flex: 1 }}>{country.name}</span>
                        <span style={{ color: 'var(--muted)' }}>{country.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Phone number input */}
              <div style={{ position: 'relative', flex: 1 }}>
                <Phone 
                  size={18} 
                  style={{ 
                    position: 'absolute', 
                    left: '16px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: 'var(--muted-dark)'
                  }} 
                />
                <input
                  type="tel"
                  className="input-dark"
                  placeholder={locale === 'fr' ? 'Numéro de téléphone' : 'Phone number'}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ paddingLeft: '44px', height: '48px' }}
                  data-testid="phone-input"
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* Password input */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Lock 
                size={18} 
                style={{ 
                  position: 'absolute', 
                  left: '16px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--muted-dark)'
                }} 
              />
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-dark"
                placeholder={locale === 'fr' ? 'Mot de passe (min. 6 car.)' : 'Password (min. 6 char.)'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '44px', paddingRight: '44px', height: '48px' }}
                data-testid="password-input"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Info notice */}
            <p style={{ 
              fontSize: '11px', 
              color: 'var(--muted)', 
              marginBottom: '16px',
              textAlign: 'center',
              lineHeight: '1.4'
            }}>
              {locale === 'fr' 
                ? 'Votre nom apparaîtra comme expéditeur des SMS. Les prospects pourront vous répondre sur votre numéro.'
                : 'Your name will appear as SMS sender. Prospects can reply to your number.'
              }
            </p>

            {/* Register Button */}
            <button 
              type="submit"
              className="btn-primary"
              disabled={!fullName || !email || !password || !phone || loading}
              data-testid="register-button"
              style={{ marginBottom: '16px', height: '48px' }}
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
          <p className="text-small text-muted" style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '16px', paddingBottom: '16px', fontSize: '11px' }}>
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
