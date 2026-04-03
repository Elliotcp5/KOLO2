// v3.0.0 - Free trial without payment
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Check, Lock, Sparkles } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import { API_URL } from '../config/api';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";

const SubscribePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, formatPrice, country, locale } = useLocale();
  const [loading, setLoading] = useState(false);

  // Handle error messages from redirect
  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'already_subscribed') {
      toast.error(locale === 'fr' ? 'Vous avez déjà un abonnement actif' : 'You already have an active subscription');
    } else if (error === 'payment_failed') {
      toast.error(locale === 'fr' ? 'Le paiement a échoué' : 'Payment failed');
    }
  }, [searchParams, locale]);

  const handlePayment = () => {
    if (loading) return;
    setLoading(true);

    // Direct navigation to Stripe checkout
    const checkoutUrl = `${API_URL}/api/payments/checkout-redirect?locale=${locale || 'fr'}&country=${country || 'FR'}`;
    window.location.href = checkoutUrl;
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

          {/* Title */}
          <h1 className="text-title" style={{ textAlign: 'center', marginBottom: '8px', fontSize: '26px' }}>
            {locale === 'fr' ? 'Passez à KOLO Pro' : 'Upgrade to KOLO Pro'}
          </h1>

          <p className="text-body text-muted" style={{ textAlign: 'center', marginBottom: '32px' }}>
            {locale === 'fr' ? 'Débloquez toutes les fonctionnalités' : 'Unlock all features'}
          </p>

          {/* Plan card */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
            border: '1px solid rgba(236, 72, 153, 0.2)',
            borderRadius: '20px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
              color: 'white', 
              padding: '6px 14px', 
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              display: 'inline-block',
              marginBottom: '16px'
            }}>
              PRO
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text)', marginBottom: '8px', fontWeight: '500' }}>
              {locale === 'fr' ? 'Abonnement mensuel' : 'Monthly subscription'}
            </div>
            <div style={{ 
              fontSize: '36px', 
              fontWeight: '700',
              background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '8px'
            }}>
              {formatPrice()}
              <span style={{ fontSize: '16px', fontWeight: '400' }}> / {locale === 'fr' ? 'mois' : 'month'}</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {locale === 'fr' ? 'Résiliable à tout moment' : 'Cancel anytime'}
            </div>
          </div>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
            {[
              locale === 'fr' ? 'Prospects illimités' : 'Unlimited prospects',
              locale === 'fr' ? 'Rappels intelligents' : 'Smart reminders',
              locale === 'fr' ? 'Application mobile PWA' : 'Mobile PWA app',
              locale === 'fr' ? 'Support prioritaire' : 'Priority support'
            ].map((feature, i) => (
              <div key={`feature-${i}-${feature.slice(0,10)}`} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Check size={14} strokeWidth={2.5} style={{ color: '#EC4899' }} />
                </div>
                <span style={{ color: 'var(--text)', fontSize: '14px' }}>{feature}</span>
              </div>
            ))}
          </div>

          {/* Subscribe button */}
          <button 
            className="btn-primary"
            onClick={handlePayment}
            disabled={loading}
            data-testid="subscribe-button"
            style={{ marginBottom: '16px' }}
          >
            {loading ? (
              <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
            ) : (
              <>
                <CreditCard size={20} />
                {locale === 'fr' ? "S'abonner maintenant" : 'Subscribe now'}
              </>
            )}
          </button>

          {/* Stripe badge */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '24px'
          }}>
            <Lock size={14} style={{ color: 'var(--muted-dark)' }} />
            <span style={{ fontSize: '12px', color: 'var(--muted-dark)' }}>
              {locale === 'fr' ? 'Paiement sécurisé par Stripe' : 'Secured by Stripe'}
            </span>
          </div>

          {/* Free trial link */}
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '14px', marginTop: 'auto', paddingBottom: '24px' }}>
            {locale === 'fr' ? 'Pas encore prêt ?' : 'Not ready yet?'}{' '}
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
              {locale === 'fr' ? 'Essai gratuit 7 jours' : '7-day free trial'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscribePage;
