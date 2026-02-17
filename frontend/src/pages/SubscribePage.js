import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Check, Lock } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";
const API_URL = process.env.REACT_APP_BACKEND_URL;

const SubscribePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, formatPrice, country, locale } = useLocale();
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [loading, setLoading] = useState(false);

  // Handle error messages from redirect
  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'already_subscribed') {
      toast.error(t('alreadySubscribed'));
    } else if (error === 'payment_failed') {
      toast.error(t('paymentFailed'));
    }
  }, [searchParams, t]);

  const handlePayment = (method) => {
    if (loading) return;
    
    setSelectedMethod(method);
    setLoading(true);

    // Direct navigation to server endpoint - works on ALL browsers
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
          <div className="logo-placeholder" style={{ marginTop: '24px', marginBottom: '32px' }}>
            <img 
              src={LOGO_URL} 
              alt="KOLO" 
              className="logo-image"
              style={{ maxHeight: '50px' }}
            />
          </div>

          {/* Title */}
          <h1 className="text-title" style={{ textAlign: 'center', marginBottom: '8px' }}>
            {t('subscribeToKolo')}
          </h1>

          <p className="text-body text-muted" style={{ textAlign: 'center', marginBottom: '32px' }}>
            {t('startClosingDeals')}
          </p>

          {/* Plan card */}
          <div className="plan-card" style={{ marginBottom: '32px' }}>
            <div className="plan-name">{t('monthlySubscription')}</div>
            <div className="plan-price">{formatPrice()}</div>
            <div className="plan-period">{t('perMonth')}</div>
            <div className="plan-cancel">{t('cancelAnytime')}</div>
          </div>

          {/* Payment method section */}
          <h3 className="text-caption" style={{ marginBottom: '16px' }}>
            {t('choosePaymentMethod')}
          </h3>

          {/* Payment methods */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <button 
              type="button"
              className={`payment-method-card ${selectedMethod === 'card' ? 'selected' : ''}`}
              onClick={() => handlePayment('card')}
              disabled={loading}
              data-testid="payment-card"
              style={{ textAlign: 'left', width: '100%' }}
            >
              <CreditCard className="icon" strokeWidth={1.5} />
              <span className="label">{t('creditDebitCard')}</span>
              {loading && selectedMethod === 'card' && <div className="spinner" style={{ width: '20px', height: '20px' }}></div>}
            </button>
            
            <button 
              type="button"
              className={`payment-method-card ${selectedMethod === 'apple_pay' ? 'selected' : ''}`}
              onClick={() => handlePayment('apple_pay')}
              disabled={loading}
              data-testid="payment-apple-pay"
              style={{ textAlign: 'left', width: '100%' }}
            >
              <svg className="icon" viewBox="0 0 24 24" fill="white" width="32" height="32">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              <span className="label">{t('applePay')}</span>
              {loading && selectedMethod === 'apple_pay' && <div className="spinner" style={{ width: '20px', height: '20px' }}></div>}
            </button>
          </div>

          {/* Stripe security badge */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '24px',
            padding: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px'
          }}>
            <Lock size={14} style={{ color: 'var(--muted)' }} />
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {t('securedByStripe')}
            </span>
            <svg width="40" height="17" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M60 12.5C60 5.59644 53.7312 0 46.0714 0H13.9286C6.26878 0 0 5.59644 0 12.5C0 19.4036 6.26878 25 13.9286 25H46.0714C53.7312 25 60 19.4036 60 12.5Z" fill="#635BFF"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M27.5147 10.3846C27.5147 9.73077 28.0588 9.46154 28.9412 9.46154C30.2206 9.46154 31.8382 9.88462 33.1176 10.5769V7.11538C31.7206 6.53846 30.3382 6.30769 28.9412 6.30769C25.8088 6.30769 23.7353 7.96154 23.7353 10.5769C23.7353 14.6538 29.4118 14.0385 29.4118 15.7692C29.4118 16.5385 28.7353 16.8077 27.7941 16.8077C26.3971 16.8077 24.6029 16.2308 23.1765 15.4615V18.9615C24.75 19.6538 26.3382 19.9615 27.7941 19.9615C31.0147 19.9615 33.2059 18.3462 33.2059 15.6923C33.1912 11.2692 27.5147 12.0385 27.5147 10.3846ZM38.5294 3.84615L34.8529 4.65385V7.5L38.5294 7.5V3.84615ZM34.8529 8.26923H38.5294V19.6538H34.8529V8.26923ZM44.1176 8.26923L43.8529 8.26923V6.30769L40.1765 7.11538V19.6538H43.8529V11.5385C44.75 10.3077 46.3235 10.5769 46.8235 10.7692V8.26923C46.3088 8.03846 44.5 7.61538 43.8529 8.26923H44.1176ZM51.1765 6.96154L47.5 7.76923V10.5769C48.2647 9.84615 49.4118 9.46154 50.7353 9.46154C53.5735 9.46154 55.1912 11.3462 55.1912 14.1538C55.1912 17.5 53.1029 19.9615 50.0882 19.9615C48.7941 19.9615 47.6765 19.5385 46.8235 18.6538V19.6538H43.1471V7.76923L46.8235 6.96154V9.15385C47.5588 8.46154 48.6176 8.03846 49.8529 8.03846C50.3382 8.03846 50.7794 8.11538 51.1765 8.26923V6.96154ZM50.3235 17.0769C51.5 17.0769 52.3971 16.0385 52.3971 14.6154C52.3971 13.1923 51.5 12.1154 50.3235 12.1154C49.1471 12.1154 48.25 13.1923 48.25 14.6154C48.25 16.0385 49.1471 17.0769 50.3235 17.0769Z" fill="white"/>
            </svg>
          </div>

          {/* Feature line */}
          <div className="check-row" style={{ marginTop: 'auto', marginBottom: '40px' }}>
            <Check strokeWidth={2} />
            <span>{t('unlimitedLeads')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscribePage;
