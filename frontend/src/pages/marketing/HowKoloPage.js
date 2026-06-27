import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';
import PhoneFrame from './components/PhoneFrame';
import { useI18n } from './i18n';

const STEP_IMAGES = [
  '/marketing/assets/live_pige.jpeg',
  '/marketing/assets/live_home_john.jpeg',
  '/marketing/assets/live_dossiers.jpeg',
];
const STEP_REVERSE = [false, true, false];

const HowContent = () => {
  const { t } = useI18n();
  const steps = t('how.steps') || [];

  return (
    <>
      <section className="mkt-hero" data-testid="mkt-how-hero">
        <div className="mkt-container mkt-container-narrow" style={{ textAlign: 'center' }}>
          <div className="mkt-eyebrow" style={{ margin: '0 auto 24px', display: 'inline-flex' }}>
            <span className="mkt-eyebrow-dot" />
            {t('how.eyebrow')}
          </div>
          <h1 className="mkt-h1">
            {t('how.title_p1')}<br/>
            <em>{t('how.title_em')}</em>
          </h1>
          <p className="mkt-lead" style={{ margin: '0 auto 36px' }}>{t('how.lead')}</p>
          <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="mkt-btn mkt-btn-primary" data-testid="mkt-how-cta-top">
            {t('how.cta_top')} <ArrowRight size={16} strokeWidth={2.5} />
          </a>
        </div>
      </section>

      <section className="mkt-section-tight">
        <div className="mkt-container">
          {steps.map((s, idx) => (
            <div key={idx} className={`mkt-step ${STEP_REVERSE[idx] ? 'reverse' : ''}`} data-testid={`mkt-how-step-${idx + 1}`}>
              <div className="mkt-step-text mkt-reveal">
                <div className="mkt-step-num">{s.num}</div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  <span className="mkt-tag mkt-tag-before" data-testid="mkt-tag-before" style={{ marginBottom: 0 }}>
                    <X size={12} style={{ display: 'inline', marginRight: 4, marginBottom: -1 }} strokeWidth={3} />
                    {s.before}
                  </span>
                  <span className="mkt-tag mkt-tag-after" data-testid="mkt-tag-after" style={{ marginBottom: 0 }}>
                    <Check size={12} style={{ display: 'inline', marginRight: 4, marginBottom: -1 }} strokeWidth={3} />
                    {s.after}
                  </span>
                </div>

                <h2 className="mkt-h2">{s.title}</h2>
                <p className="mkt-subtle">{s.text}</p>
                <ul className="mkt-step-bullets">
                  {(s.bullets || []).map((b, i) => (
                    <li key={i}><Check size={18} color="#1E7A3C" strokeWidth={2.5} /><span>{b}</span></li>
                  ))}
                </ul>
              </div>
              <div className="mkt-step-visual mkt-reveal">
                <PhoneFrame src={STEP_IMAGES[idx] || STEP_IMAGES[0]} alt={s.title} testId={`mkt-how-step-${idx + 1}-phone`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-final-cta mkt-reveal" data-testid="mkt-how-final-cta">
            <h2>{t('how.final_title_p1')}<br/><em style={{ fontFamily: 'var(--mkt-font-serif)', fontStyle: 'italic', fontWeight: 400 }}>{t('how.final_title_em')}</em></h2>
            <p>{t('how.final_lead')}</p>
            <div className="mkt-cta-row">
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="mkt-btn mkt-btn-primary" data-testid="mkt-how-cta-bottom">
                {t('how.cta_bottom')} <ArrowRight size={16} strokeWidth={2.5} />
              </a>
              <Link to="/ressources" className="mkt-btn mkt-btn-ghost">
                {t('how.cta_secondary')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

const HowKoloPage = () => (
  <MarketingLayout>
    <HowContent />
  </MarketingLayout>
);

export default HowKoloPage;
