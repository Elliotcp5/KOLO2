import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Briefcase, Sparkles, ArrowRight } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

// New K icon logo for landing page only
const LANDING_LOGO_URL = "https://customer-assets.emergentagent.com/job_kolo-checkout-flow/artifacts/zc3e0gj2_KOLO%20V2%20LOGO%20PNG.png";

const LandingPage = () => {
  const navigate = useNavigate();
  const { t, formatPrice, locale } = useLocale();
  const [expandedCard, setExpandedCard] = useState(null);

  const features = [
    {
      id: 'feature1',
      icon: Calendar,
      title: t('feature1Title'),
      description: t('feature1Desc'),
    },
    {
      id: 'feature2',
      icon: Briefcase,
      title: t('feature2Title'),
      description: t('feature2Desc'),
    },
    {
      id: 'feature3',
      icon: Sparkles,
      title: t('feature3Title'),
      description: t('feature3Desc'),
    },
  ];

  const handleFeatureClick = (id) => {
    setExpandedCard(expandedCard === id ? null : id);
  };

  return (
    <div className="mobile-frame">
      <div className="page-container no-nav">
        {/* Header */}
        <div className="landing-hero">
          {/* Login link - small, top right corner */}
          <div style={{ 
            position: 'absolute',
            top: 'max(12px, env(safe-area-inset-top))',
            right: '16px',
            zIndex: 10
          }}>
            <button 
              onClick={() => navigate('/login')}
              data-testid="login-link"
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '12px',
                fontWeight: '400',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              {t('loginToKolo')}
            </button>
          </div>

          {/* Large K Logo - only on landing page */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginBottom: '32px',
            marginTop: '48px'
          }}>
            <img 
              src={LANDING_LOGO_URL} 
              alt="KOLO" 
              style={{ 
                height: '120px',
                width: 'auto',
                objectFit: 'contain'
              }}
            />
          </div>

          {/* Hero headline */}
          <h2 
            className="text-headline animate-fade-in" 
            style={{ textAlign: 'center', marginBottom: '12px', fontSize: '28px', lineHeight: '1.3' }}
          >
            {t('heroHeadline')}
          </h2>

          {/* Subheadline */}
          <p 
            className="text-body text-muted animate-fade-in" 
            style={{ textAlign: 'center', marginBottom: '40px', animationDelay: '0.1s' }}
          >
            {t('heroSubheadline')}
          </p>
        </div>

        {/* Feature cards */}
        <div className="landing-features animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {features.map((feature) => (
            <div
              key={feature.id}
              className={`feature-card ${expandedCard === feature.id ? 'expanded' : ''}`}
              onClick={() => handleFeatureClick(feature.id)}
              data-testid={feature.id}
            >
              <feature.icon className="icon" strokeWidth={1.5} />
              <span className="title">{feature.title}</span>
              <span className="description">{feature.description}</span>
            </div>
          ))}
        </div>

        {/* Pricing section */}
        <div style={{ padding: '0 24px', marginTop: 'auto' }} className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
          {/* Made by line */}
          <p className="text-small" style={{ textAlign: 'center', marginBottom: '20px' }}>
            {t('madeBy')}
          </p>

          {/* Price */}
          <div className="price-display" style={{ marginBottom: '24px' }}>
            <span className="amount">{formatPrice()}</span>
            <span className="period">{t('perMonth')}</span>
          </div>

          {/* CTA Button */}
          <button 
            className="btn-primary"
            onClick={() => navigate('/subscribe')}
            data-testid="start-button"
            style={{ marginBottom: '16px' }}
          >
            {t('startButton')}
            <ArrowRight size={20} strokeWidth={2} />
          </button>

          {/* Cancel anytime */}
          <p className="text-small" style={{ textAlign: 'center', marginBottom: '40px' }}>
            {t('cancelAnytime')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
