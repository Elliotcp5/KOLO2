import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import { API_URL } from '../config/api';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { locale } = useLocale();
  
  const resetToken = searchParams.get('token');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSendResetLink = async () => {
    if (!email) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setEmailSent(true);
        toast.success(locale === 'fr' 
          ? 'Si cet email existe, vous recevrez un lien de réinitialisation' 
          : 'If this email exists, you will receive a reset link'
        );
        
        // For demo: if token returned, show it (in production, this would be sent via email)
        if (data.reset_token) {
          console.log('Reset token (for testing):', data.reset_token);
          // In demo mode, redirect to reset page with token
          setTimeout(() => {
            navigate(`/forgot-password?token=${data.reset_token}`);
          }, 2000);
        }
      } else {
        toast.error(data.detail || 'Error sending reset link');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      toast.error(locale === 'fr' ? 'Erreur de connexion' : 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) return;
    
    if (newPassword !== confirmPassword) {
      toast.error(locale === 'fr' ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error(locale === 'fr' ? 'Le mot de passe doit contenir au moins 6 caractères' : 'Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: resetToken,
          new_password: newPassword 
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(locale === 'fr' ? 'Mot de passe réinitialisé avec succès' : 'Password reset successfully');
        navigate('/login');
      } else {
        toast.error(data.detail || 'Error resetting password');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      toast.error(locale === 'fr' ? 'Erreur de connexion' : 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-frame">
      <div className="page-container">
        <div className="scroll-container" style={{ 
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%'
        }}>
          {/* Header */}
          <button 
            onClick={() => navigate('/login')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              background: 'none',
              border: 'none',
              color: 'var(--text)',
              cursor: 'pointer',
              padding: '0',
              marginBottom: '32px'
            }}
            data-testid="back-button"
          >
            <ArrowLeft size={20} strokeWidth={1.5} />
            <span>{locale === 'fr' ? 'Retour' : 'Back'}</span>
          </button>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <img 
              src={LOGO_URL} 
              alt="KOLO" 
              style={{ height: '32px', marginBottom: '24px' }}
            />
            <h1 className="text-headline" style={{ marginBottom: '8px' }}>
              {resetToken 
                ? (locale === 'fr' ? 'Nouveau mot de passe' : 'New password')
                : (locale === 'fr' ? 'Mot de passe oublié' : 'Forgot password')
              }
            </h1>
            <p className="text-muted">
              {resetToken 
                ? (locale === 'fr' ? 'Entrez votre nouveau mot de passe' : 'Enter your new password')
                : (locale === 'fr' ? 'Entrez votre email pour recevoir un lien de réinitialisation' : 'Enter your email to receive a reset link')
              }
            </p>
          </div>

          {/* Form */}
          {resetToken ? (
            // Reset password form
            <>
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-dark"
                  placeholder={locale === 'fr' ? 'Nouveau mot de passe' : 'New password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ paddingRight: '48px' }}
                  data-testid="new-password-input"
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

              <input
                type={showPassword ? 'text' : 'password'}
                className="input-dark"
                placeholder={locale === 'fr' ? 'Confirmer le mot de passe' : 'Confirm password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ marginBottom: '24px' }}
                data-testid="confirm-password-input"
              />

              <button 
                className="btn-primary"
                onClick={handleResetPassword}
                disabled={!newPassword || !confirmPassword || loading}
                data-testid="reset-password-button"
              >
                {loading ? (
                  <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                ) : (
                  locale === 'fr' ? 'Réinitialiser le mot de passe' : 'Reset password'
                )}
              </button>
            </>
          ) : emailSent ? (
            // Email sent confirmation
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%', 
                background: 'var(--accent)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <p className="text-muted" style={{ marginBottom: '24px' }}>
                {locale === 'fr' 
                  ? 'Vérifiez votre boîte mail. Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.'
                  : 'Check your inbox. If an account exists with this email, you will receive a reset link.'
                }
              </p>
              <button
                className="btn-ghost"
                onClick={() => navigate('/login')}
                style={{ color: 'var(--accent)' }}
              >
                {locale === 'fr' ? 'Retour à la connexion' : 'Back to login'}
              </button>
            </div>
          ) : (
            // Email input form
            <>
              <input
                type="email"
                className="input-dark"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ marginBottom: '24px' }}
                data-testid="email-input"
              />

              <button 
                className="btn-primary"
                onClick={handleSendResetLink}
                disabled={!email || loading}
                data-testid="send-reset-link-button"
              >
                {loading ? (
                  <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                ) : (
                  locale === 'fr' ? 'Envoyer le lien' : 'Send reset link'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
