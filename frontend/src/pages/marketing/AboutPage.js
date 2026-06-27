import React from 'react';
import { ArrowRight, Heart, Target, Zap } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';
import { useI18n } from './i18n';

const AboutContent = () => {
  const { t } = useI18n();
  const story = t('about.story') || [];

  return (
    <>
      <section className="mkt-hero" data-testid="mkt-about-hero">
        <div className="mkt-container">
          <div className="mkt-about-hero">
            <div>
              <div className="mkt-eyebrow" data-testid="mkt-about-eyebrow">
                <span className="mkt-eyebrow-dot" />
                {t('about.eyebrow')}
              </div>
              <h1 className="mkt-h1">
                {t('about.title_p1')}<br/>
                <em>{t('about.title_em')}</em>
              </h1>
              <p className="mkt-lead">{t('about.lead')}</p>
            </div>
            <div className="mkt-founder-photo">
              <img src="/marketing/assets/founder.png" alt="Elliot Coen-Pressard, fondateur de KOLO" data-testid="mkt-about-founder-photo" />
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section-tight">
        <div className="mkt-container mkt-container-narrow">
          <div className="mkt-section-eyebrow">{t('about.founder_eyebrow')}</div>
          <h2 className="mkt-h2" style={{ marginBottom: 32 }}>
            {t('about.founder_title_p1')}<br/>
            <em>{t('about.founder_title_em')}</em>
          </h2>

          <div className="mkt-prose mkt-reveal" data-testid="mkt-about-story">
            {story.map((p, i) => <p key={i}>{p}</p>)}
          </div>

          <div className="mkt-founder-quote" data-testid="mkt-about-quote">
            « {t('about.quote')} »
          </div>
          <div className="mkt-founder-name">{t('about.founder_name')}</div>
          <div className="mkt-founder-role">{t('about.founder_role')}</div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-section-head mkt-reveal">
            <div className="mkt-section-eyebrow">{t('about.values_eyebrow')}</div>
            <h2 className="mkt-h2">{t('about.values_title_p1')}<br/><em>{t('about.values_title_em')}</em></h2>
          </div>

          <div className="mkt-values" data-testid="mkt-about-values">
            <div className="mkt-value mkt-reveal">
              <div className="mkt-pillar-icon" style={{ marginBottom: 18 }}><Target size={22} strokeWidth={2} /></div>
              <h4>{t('about.value1_title')}</h4>
              <p>{t('about.value1_desc')}</p>
            </div>
            <div className="mkt-value mkt-reveal">
              <div className="mkt-pillar-icon" style={{ marginBottom: 18 }}><Zap size={22} strokeWidth={2} /></div>
              <h4>{t('about.value2_title')}</h4>
              <p>{t('about.value2_desc')}</p>
            </div>
            <div className="mkt-value mkt-reveal">
              <div className="mkt-pillar-icon" style={{ marginBottom: 18 }}><Heart size={22} strokeWidth={2} /></div>
              <h4>{t('about.value3_title')}</h4>
              <p>{t('about.value3_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-final-cta mkt-reveal" data-testid="mkt-about-final-cta">
            <h2>{t('about.final_title_p1')}<br/><em style={{ fontFamily: 'var(--mkt-font-serif)', fontStyle: 'italic', fontWeight: 400 }}>{t('about.final_title_em')}</em></h2>
            <p>{t('about.final_lead')}</p>
            <div className="mkt-cta-row">
              <a href="mailto:contact@trykolo.io" className="mkt-btn mkt-btn-primary" data-testid="mkt-about-contact-cta">
                {t('about.final_cta')} <ArrowRight size={16} strokeWidth={2.5} />
              </a>
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="mkt-btn mkt-btn-ghost" data-testid="mkt-about-appstore-cta">
                {t('about.final_cta_secondary')}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

const AboutPage = () => (
  <MarketingLayout>
    <AboutContent />
  </MarketingLayout>
);

export default AboutPage;
