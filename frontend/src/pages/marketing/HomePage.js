import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mic, Target, Check, TrendingUp, Folder } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';
import LogoMarquee from './components/LogoMarquee';
import PhoneFrame from './components/PhoneFrame';
import { useI18n } from './i18n';

const HomeContent = () => {
  const { t } = useI18n();

  return (
    <>
      <section className="mkt-hero" data-testid="mkt-home-hero">
        <div className="mkt-container">
          <div className="mkt-hero-inner">
            <div>
              <span className="mkt-eyebrow" data-testid="mkt-hero-eyebrow">
                <span className="mkt-eyebrow-dot" />
                {t('home.eyebrow')}
              </span>
              <h1 className="mkt-h1" data-testid="mkt-hero-title">
                {t('home.title_part1')} <em>{t('home.title_em')}</em><br/>
                {t('home.title_part2')}
              </h1>
              <p className="mkt-lead" data-testid="mkt-hero-subtitle">
                {t('home.lead')}
              </p>
              <div className="mkt-cta-row">
                <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="mkt-btn mkt-btn-primary" data-testid="mkt-hero-appstore-cta">
                  {t('home.cta_primary')} <ArrowRight size={16} strokeWidth={2.5} />
                </a>
                <Link to="/comment-kolo" className="mkt-btn mkt-btn-ghost" data-testid="mkt-hero-secondary-cta">
                  {t('home.cta_secondary')}
                </Link>
              </div>
            </div>

            <div className="mkt-hero-visual">
              <PhoneFrame src="/marketing/assets/live_home_john.jpeg" alt="KOLO app dashboard" testId="mkt-hero-phone" />
              <div className="mkt-float-card fc-1" data-testid="mkt-hero-float-1">
                <div className="mkt-fc-row">
                  <div className="mkt-fc-icon"><Mic size={16} /></div>
                  <div>
                    <div className="mkt-fc-label">{t('home.float1_label')}</div>
                    <div className="mkt-fc-value">{t('home.float1_value')}</div>
                  </div>
                </div>
              </div>
              <div className="mkt-float-card fc-2" data-testid="mkt-hero-float-2">
                <div className="mkt-fc-row">
                  <div className="mkt-fc-icon" style={{ background: '#E6F7EC', color: '#1E7A3C' }}><TrendingUp size={16} /></div>
                  <div>
                    <div className="mkt-fc-label">{t('home.float2_label')}</div>
                    <div className="mkt-fc-value">{t('home.float2_value')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LogoMarquee />

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-section-head mkt-reveal">
            <div className="mkt-section-eyebrow">{t('home.promesse_eyebrow')}</div>
            <h2 className="mkt-h2">
              {t('home.promesse_title_p1')}<br/>
              <em>{t('home.promesse_title_em')}</em>
            </h2>
            <p className="mkt-subtle" style={{ margin: '0 auto' }}>{t('home.promesse_lead')}</p>
          </div>

          <div className="mkt-pillars">
            <div className="mkt-pillar mkt-reveal" data-testid="mkt-pillar-pige">
              <div className="mkt-pillar-icon"><Target size={22} strokeWidth={2} /></div>
              <h3 className="mkt-h3">{t('home.pillar1_title')}</h3>
              <p>{t('home.pillar1_desc')}</p>
            </div>
            <div className="mkt-pillar mkt-reveal" data-testid="mkt-pillar-dictee">
              <div className="mkt-pillar-icon"><Mic size={22} strokeWidth={2} /></div>
              <h3 className="mkt-h3">{t('home.pillar2_title')}</h3>
              <p>{t('home.pillar2_desc')}</p>
            </div>
            <div className="mkt-pillar mkt-reveal" data-testid="mkt-pillar-pilotage">
              <div className="mkt-pillar-icon"><Folder size={22} strokeWidth={2} /></div>
              <h3 className="mkt-h3">{t('home.pillar3_title')}</h3>
              <p>{t('home.pillar3_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section-tight">
        <div className="mkt-container">
          <div className="mkt-stats mkt-reveal" data-testid="mkt-stats">
            <div className="mkt-stat">
              <div className="mkt-stat-num">{t('home.stat1_num')}</div>
              <div className="mkt-stat-label">{t('home.stat1_label')}</div>
            </div>
            <div className="mkt-stat">
              <div className="mkt-stat-num">{t('home.stat2_num')}</div>
              <div className="mkt-stat-label">{t('home.stat2_label')}</div>
            </div>
            <div className="mkt-stat">
              <div className="mkt-stat-num">{t('home.stat3_num')}</div>
              <div className="mkt-stat-label">{t('home.stat3_label')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-step">
            <div className="mkt-step-text mkt-reveal">
              <div className="mkt-step-num">{t('home.step1_num')}</div>
              <h2 className="mkt-h2">{t('home.step1_title_p1')}<br/><em>{t('home.step1_title_em')}</em></h2>
              <p className="mkt-subtle">{t('home.step1_lead')}</p>
              <ul className="mkt-step-bullets">
                {(t('home.step1_bullets') || []).map((b, i) => (
                  <li key={i}><Check size={18} color="#1E7A3C" strokeWidth={2.5} /><span>{b}</span></li>
                ))}
              </ul>
            </div>
            <div className="mkt-step-visual mkt-reveal">
              <PhoneFrame src="/marketing/assets/live_pige.jpeg" alt="KOLO listings" testId="mkt-home-pige-phone" />
            </div>
          </div>

          <div className="mkt-step reverse">
            <div className="mkt-step-text mkt-reveal">
              <div className="mkt-step-num">{t('home.step2_num')}</div>
              <h2 className="mkt-h2">{t('home.step2_title_p1')}<br/><em>{t('home.step2_title_em')}</em></h2>
              <p className="mkt-subtle">{t('home.step2_lead')}</p>
              <ul className="mkt-step-bullets">
                {(t('home.step2_bullets') || []).map((b, i) => (
                  <li key={i}><Check size={18} color="#1E7A3C" strokeWidth={2.5} /><span>{b}</span></li>
                ))}
              </ul>
            </div>
            <div className="mkt-step-visual mkt-reveal">
              <PhoneFrame src="/marketing/assets/live_home_john.jpeg" alt="KOLO voice dictation" testId="mkt-home-dictee-phone" />
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section-tight">
        <div className="mkt-container mkt-container-narrow" style={{ textAlign: 'center' }}>
          <div className="mkt-reveal">
            <div style={{ fontFamily: 'var(--mkt-font-serif)', fontSize: 'clamp(24px, 3vw, 36px)', lineHeight: 1.4, fontStyle: 'italic', color: 'var(--mkt-ink-2)' }}>
              « {t('home.quote')} »
            </div>
            <div style={{ marginTop: 24, fontWeight: 600, fontSize: 14 }}>{t('home.quote_author')}</div>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-final-cta mkt-reveal" data-testid="mkt-final-cta">
            <h2>{t('home.final_title_p1')} <em style={{ fontFamily: 'var(--mkt-font-serif)', fontStyle: 'italic', fontWeight: 400 }}>{t('home.final_title_em')}</em></h2>
            <p>{t('home.final_lead')}</p>
            <div className="mkt-cta-row">
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="mkt-btn mkt-btn-primary" data-testid="mkt-final-cta-appstore">
                {t('home.final_cta')} <ArrowRight size={16} strokeWidth={2.5} />
              </a>
              <Link to="/comment-kolo" className="mkt-btn mkt-btn-ghost">
                {t('home.final_cta_secondary')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

const HomePage = () => (
  <MarketingLayout>
    <HomeContent />
  </MarketingLayout>
);

export default HomePage;
