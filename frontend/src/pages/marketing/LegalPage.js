import React from 'react';
import MarketingLayout from './components/MarketingLayout';
import { useI18n } from './i18n';

const LegalContent = () => {
  const { t } = useI18n();
  const sections = t('legal.sections') || [];

  return (
    <section className="mkt-section-tight" data-testid="mkt-legal-page">
      <div className="mkt-container">
        <div className="mkt-legal-wrap">
          <h1 className="mkt-h1" style={{ fontSize: 'clamp(36px, 5vw, 56px)', marginBottom: 12 }}>
            {t('legal.title')}
          </h1>
          <div className="mkt-legal-meta" data-testid="mkt-legal-updated">{t('legal.last_updated')}</div>
          <p className="mkt-subtle" style={{ marginBottom: 32 }}>{t('legal.intro')}</p>

          {sections.map((s, i) => (
            <div key={i} className="mkt-legal-section" data-testid={`mkt-legal-section-${i + 1}`}>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const LegalPage = () => (
  <MarketingLayout>
    <LegalContent />
  </MarketingLayout>
);

export default LegalPage;
