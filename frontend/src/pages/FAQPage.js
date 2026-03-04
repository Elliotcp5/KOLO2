import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";

const FAQPage = () => {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [expandedIndex, setExpandedIndex] = useState(null);

  const faqs = [
    { question: t('faqQ1'), answer: t('faqA1') },
    { question: t('faqQ2'), answer: t('faqA2') },
    { question: t('faqQ3'), answer: t('faqA3') },
    { question: t('faqQ4'), answer: t('faqA4') },
    { question: t('faqQ5'), answer: t('faqA5') },
  ];

  const toggleFaq = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
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

        <div style={{ padding: '0 24px', flex: 1 }}>
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
          <h1 className="text-title" style={{ textAlign: 'center', marginBottom: '32px' }}>
            {t('faqTitle')}
          </h1>

          {/* FAQ Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="card"
                style={{ 
                  padding: '0',
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                onClick={() => toggleFaq(index)}
                data-testid={`faq-item-${index}`}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                }}>
                  <span style={{ 
                    fontWeight: '500', 
                    fontSize: '15px',
                    color: 'var(--text)',
                    flex: 1,
                    paddingRight: '12px'
                  }}>
                    {faq.question}
                  </span>
                  {expandedIndex === index ? (
                    <ChevronUp size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  ) : (
                    <ChevronDown size={20} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  )}
                </div>
                
                {expandedIndex === index && (
                  <div style={{
                    padding: '0 20px 16px 20px',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '16px',
                    animation: 'fadeIn 0.2s ease'
                  }}>
                    <p style={{ 
                      color: 'var(--muted)', 
                      fontSize: '14px',
                      lineHeight: '1.6'
                    }}>
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ marginTop: '40px', marginBottom: '40px', textAlign: 'center' }}>
            <button 
              className="btn-primary"
              onClick={() => navigate('/register')}
              data-testid="start-button"
            >
              {t('startButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQPage;
