import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Check } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";
const API_URL = process.env.REACT_APP_BACKEND_URL;

const SubscribePage = () => {
  const navigate = useNavigate();
  const { t, formatPrice, country, locale } = useLocale();
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePayment = async (method) => {
    setSelectedMethod(method);
    setLoading(true);

    try {
      const originUrl = window.location.origin;
      
      const response = await fetch(`${API_URL}/api/payments/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          origin_url: originUrl,
          locale: locale,
          country: country,
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setLoading(false);
      setSelectedMethod(null);
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
            <div 
              className={`payment-method-card ${selectedMethod === 'card' ? 'selected' : ''}`}
              onClick={() => handlePayment('card')}
              data-testid="payment-card"
            >
              <CreditCard className="icon" strokeWidth={1.5} />
              <span className="label">{t('creditDebitCard')}</span>
              {loading && selectedMethod === 'card' && <div className="spinner" style={{ width: '20px', height: '20px' }}></div>}
            </div>
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
