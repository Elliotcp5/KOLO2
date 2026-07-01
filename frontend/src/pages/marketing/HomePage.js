import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Mic, Target, Check, TrendingUp, Folder, Sparkles } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';
import LogoMarquee from './components/LogoMarquee';
import PhoneFrame from './components/PhoneFrame';
import { useI18n } from './i18n';

const easeOut = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const HomeContent = () => {
  const { t } = useI18n();

  return (
    <>
      <LogoMarquee />

      {/* ========== HERO ========== */}
      <section className="mkt-hero" data-testid="mkt-home-hero">
        <div className="mkt-hero-grid" aria-hidden />
        <div className="mkt-container">
          <div className="mkt-hero-inner">
            <motion.div initial="hidden" animate="show" variants={stagger}>
              <motion.span variants={fadeUp} className="mkt-eyebrow" data-testid="mkt-hero-eyebrow">
                <span className="mkt-eyebrow-dot" />
                {t('home.eyebrow')}
              </motion.span>
              <motion.h1 variants={fadeUp} className="mkt-h1" data-testid="mkt-hero-title">
                {t('home.title_part1')} <span className="mkt-h1-accent">{t('home.title_em')}</span><br />
                {t('home.title_part2')}
              </motion.h1>
              <motion.p variants={fadeUp} className="mkt-lead" data-testid="mkt-hero-subtitle">
                {t('home.lead')}
              </motion.p>
              <motion.div variants={fadeUp} className="mkt-cta-row">
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mkt-btn mkt-btn-primary"
                  data-testid="mkt-hero-appstore-btn"
                >
                  {t('home.cta_primary')} <ArrowRight size={15} strokeWidth={2.5} />
                </a>
                <Link
                  to="/comment-kolo"
                  className="mkt-btn mkt-btn-ghost"
                  data-testid="mkt-hero-secondary-cta"
                >
                  {t('home.cta_secondary')}
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              className="mkt-hero-visual"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: easeOut, delay: 0.15 }}
            >
              <PhoneFrame
                src="/marketing/assets/live_home_john.jpeg"
                alt="KOLO app dashboard"
                testId="mkt-hero-phone"
              />

              <motion.div
                className="mkt-float-card fc-1"
                data-testid="mkt-hero-float-1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, ease: easeOut, delay: 0.6 }}
              >
                <div className="mkt-fc-row">
                  <div className="mkt-fc-icon"><Mic size={14} /></div>
                  <div>
                    <div className="mkt-fc-label">{t('home.float1_label')}</div>
                    <div className="mkt-fc-value">{t('home.float1_value')}</div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="mkt-float-card fc-2"
                data-testid="mkt-hero-float-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, ease: easeOut, delay: 0.8 }}
              >
                <div className="mkt-fc-row">
                  <div className="mkt-fc-icon mkt-fc-icon-accent"><TrendingUp size={14} /></div>
                  <div>
                    <div className="mkt-fc-label">{t('home.float2_label')}</div>
                    <div className="mkt-fc-value">{t('home.float2_value')}</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== PROMISE / PILLARS ========== */}
      <section className="mkt-section mkt-section-alt mkt-section-glow" data-testid="mkt-promise">
        <div className="mkt-container">
          <motion.div
            className="mkt-section-head"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: easeOut }}
          >
            <div className="mkt-section-eyebrow">
              <Sparkles size={12} strokeWidth={2.5} /> {t('home.promesse_eyebrow')}
            </div>
            <h2 className="mkt-h2">
              {t('home.promesse_title_p1')}<br />
              {t('home.promesse_title_em')}
            </h2>
            <p className="mkt-subtle">{t('home.promesse_lead')}</p>
          </motion.div>

          <motion.div
            className="mkt-pillars"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.div
              variants={fadeUp}
              className="mkt-pillar"
              data-testid="mkt-pillar-pige"
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
              }}
            >
              <div className="mkt-pillar-icon"><Target size={20} strokeWidth={2} /></div>
              <h3 className="mkt-h3">{t('home.pillar1_title')}</h3>
              <p>{t('home.pillar1_desc')}</p>
            </motion.div>
            <motion.div
              variants={fadeUp}
              className="mkt-pillar"
              data-testid="mkt-pillar-dictee"
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
              }}
            >
              <div className="mkt-pillar-icon"><Mic size={20} strokeWidth={2} /></div>
              <h3 className="mkt-h3">{t('home.pillar2_title')}</h3>
              <p>{t('home.pillar2_desc')}</p>
            </motion.div>
            <motion.div
              variants={fadeUp}
              className="mkt-pillar"
              data-testid="mkt-pillar-pilotage"
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
              }}
            >
              <div className="mkt-pillar-icon"><Folder size={20} strokeWidth={2} /></div>
              <h3 className="mkt-h3">{t('home.pillar3_title')}</h3>
              <p>{t('home.pillar3_desc')}</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ========== STATS ========== */}
      <section className="mkt-section-tight">
        <div className="mkt-container">
          <motion.div
            className="mkt-stats"
            data-testid="mkt-stats"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            {[1, 2, 3].map((i) => (
              <motion.div key={i} variants={fadeUp} className="mkt-stat">
                <div className="mkt-stat-num">{t(`home.stat${i}_num`)}</div>
                <div className="mkt-stat-label">{t(`home.stat${i}_label`)}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== STEPS ========== */}
      <section className="mkt-section">
        <div className="mkt-container">
          <motion.div
            className="mkt-step"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: easeOut }}
          >
            <div className="mkt-step-text">
              <span className="mkt-step-num">Étape · {t('home.step1_num')}</span>
              <h2 className="mkt-h2">{t('home.step1_title_p1')}<br />{t('home.step1_title_em')}</h2>
              <p className="mkt-subtle">{t('home.step1_lead')}</p>
              <ul className="mkt-step-bullets">
                {(t('home.step1_bullets') || []).map((b, i) => (
                  <li key={i}><Check size={16} strokeWidth={2.5} /><span>{b}</span></li>
                ))}
              </ul>
            </div>
            <div className="mkt-step-visual">
              <PhoneFrame
                src="/marketing/assets/live_pige.jpeg"
                alt="KOLO listings"
                testId="mkt-home-pige-phone"
              />
            </div>
          </motion.div>

          <motion.div
            className="mkt-step reverse"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: easeOut }}
          >
            <div className="mkt-step-text">
              <span className="mkt-step-num">Étape · {t('home.step2_num')}</span>
              <h2 className="mkt-h2">{t('home.step2_title_p1')}<br />{t('home.step2_title_em')}</h2>
              <p className="mkt-subtle">{t('home.step2_lead')}</p>
              <ul className="mkt-step-bullets">
                {(t('home.step2_bullets') || []).map((b, i) => (
                  <li key={i}><Check size={16} strokeWidth={2.5} /><span>{b}</span></li>
                ))}
              </ul>
            </div>
            <div className="mkt-step-visual">
              <PhoneFrame
                src="/marketing/assets/live_home_john.jpeg"
                alt="KOLO voice dictation"
                testId="mkt-home-dictee-phone"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== QUOTE ========== */}
      <section className="mkt-section-tight">
        <div className="mkt-container mkt-container-narrow">
          <motion.div
            className="mkt-quote-block"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: easeOut }}
          >
            <p className="mkt-quote">« {t('home.quote')} »</p>
            <div className="mkt-quote-author">
              <div className="mkt-quote-avatar">CL</div>
              <div>
                <div className="mkt-quote-author-name">{t('home.quote_author')}</div>
                <div className="mkt-quote-author-role">Utilise KOLO au quotidien</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="mkt-section">
        <div className="mkt-container">
          <motion.div
            className="mkt-final-cta"
            data-testid="mkt-final-cta"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: easeOut }}
          >
            <h2>{t('home.final_title_p1')} {t('home.final_title_em')}</h2>
            <p>{t('home.final_lead')}</p>
            <div className="mkt-cta-row">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="mkt-btn mkt-btn-primary"
                data-testid="mkt-final-cta-appstore"
              >
                {t('home.final_cta')} <ArrowRight size={15} strokeWidth={2.5} />
              </a>
              <Link to="/comment-kolo" className="mkt-btn mkt-btn-ghost">
                {t('home.final_cta_secondary')}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section className="mkt-pricing-section" data-testid="mkt-pricing">
        <div className="mkt-container">
          <motion.div
            className="mkt-section-head center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: easeOut }}
          >
            <div className="mkt-section-eyebrow" style={{ margin: '0 auto 20px' }}>
              <Sparkles size={12} strokeWidth={2.5} /> Tarif
            </div>
            <h2 className="mkt-h2">Un seul plan.<br />Tout inclus, sans limite.</h2>
            <p className="mkt-subtle" style={{ margin: '0 auto' }}>
              L&apos;outil le plus complet du marché, au prix le plus juste. Zéro option cachée, zéro palier.
            </p>
          </motion.div>

          <motion.div
            className="mkt-price-card"
            data-testid="mkt-price-card"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.8, ease: easeOut }}
          >
            <div className="mkt-price-badge">Le plus complet · Le prix le plus juste</div>
            <div className="mkt-price-name">KOLO — Tout inclus</div>
            <div className="mkt-price-amount">
              <span className="mkt-price-currency">€</span>
              <span className="mkt-price-value">24,90</span>
              <span className="mkt-price-period">/mois</span>
            </div>
            <div className="mkt-price-sub">Sans engagement. Résiliable à tout moment.</div>
            <ul className="mkt-price-features">
              <li><Check size={16} strokeWidth={2.5} /> <span>Pige immo <strong>illimitée</strong> sur tous les portails (SeLoger, LeBonCoin, PAP, Bien&apos;ici, Logic-Immo…)</span></li>
              <li><Check size={16} strokeWidth={2.5} /> <span>Recherche DPE <strong>illimitée</strong> sur toute la France (ADEME)</span></li>
              <li><Check size={16} strokeWidth={2.5} /> <span>Assistant IA KOLO <strong>illimité</strong> — mémoire persistante</span></li>
              <li><Check size={16} strokeWidth={2.5} /> <span>Dossiers, contacts et rappels <strong>illimités</strong></span></li>
              <li><Check size={16} strokeWidth={2.5} /> <span>Dictée vocale, transcriptions et notes terrain</span></li>
              <li><Check size={16} strokeWidth={2.5} /> <span>Estimation de bien via DVF + comparables</span></li>
              <li><Check size={16} strokeWidth={2.5} /> <span>App iOS native, notifications push, mises à jour incluses</span></li>
            </ul>
            <div className="mkt-price-cta-row">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="mkt-btn mkt-btn-primary"
                data-testid="mkt-price-btn"
              >
                Commencer maintenant <ArrowRight size={15} strokeWidth={2.5} />
              </a>
              <span className="mkt-price-guarantee">7 premiers jours offerts · Aucune carte requise</span>
            </div>
          </motion.div>
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
