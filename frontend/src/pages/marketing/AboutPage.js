import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';

const FOUNDER_PHOTO = 'https://customer-assets.emergentagent.com/job_d14305e1-37e6-4a71-b89b-88f10626bbb5/artifacts/g3cfqfz1_Photo%20Elliot%20png%20sans%20fond-2.png';

const easeOut = [0.22, 1, 0.36, 1];

const AboutContent = () => (
  <>
    <section className="mkt-hero" style={{ paddingBottom: 40 }} data-testid="mkt-about-hero">
      <div className="mkt-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut }}
          style={{ maxWidth: 800 }}
        >
          <div className="mkt-section-eyebrow">À propos</div>
          <h1 className="mkt-h1" style={{ marginBottom: 24 }}>
            Fait par des agents immo,<br />pour des agents immo.
          </h1>
          <p className="mkt-lead">
            KOLO est né d&apos;un constat simple : les outils qu&apos;on nous vend n&apos;ont jamais été construits par ceux qui les utilisent.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="mkt-section" style={{ paddingTop: 32 }} data-testid="mkt-about-founder">
      <div className="mkt-container">
        <div className="mkt-founder">
          <div className="mkt-founder-photo">
            <img src={FOUNDER_PHOTO} alt="Elliot, fondateur de KOLO" />
          </div>
          <div className="mkt-founder-quote">
            <p style={{ marginBottom: 20 }}>
              « J&apos;ai été agent immobilier dans deux grands réseaux avant de basculer dans la tech. Là, j&apos;ai été frappé par une chose : personne n&apos;avait vraiment pensé un outil pour nous, sur le terrain, un téléphone à la main.
            </p>
            <p style={{
              fontFamily: 'inherit',
              fontSize: '1.0625rem',
              color: 'var(--text-2)',
              fontWeight: 400,
              letterSpacing: 0,
              lineHeight: 1.6,
              marginBottom: 16,
            }}>
              On a construit KOLO avec ceux qui allaient s&apos;en servir — agents en réseau, mandataires, conseillers indépendants. On a testé, itéré, retesté. Le résultat, c&apos;est une app qui vous fait gagner du temps sans vous demander d&apos;apprendre un nouveau logiciel. »
            </p>
            <div className="mkt-founder-sign">Elliot — Fondateur de KOLO</div>
          </div>
        </div>
      </div>
    </section>

    <section className="mkt-section" style={{ paddingTop: 40 }} data-testid="mkt-about-values">
      <div className="mkt-container">
        <div className="mkt-reveal" style={{ maxWidth: 640, marginBottom: 40 }}>
          <div className="mkt-section-eyebrow">Ce qui nous guide</div>
          <h2 className="mkt-section-title">Trois principes, tenus.</h2>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 24,
        }}>
          {[
            { t: 'Simple', d: 'Une app dans ta poche. Pas de setup, pas de formation. On ouvre, on l\u2019utilise.' },
            { t: 'Précis',  d: 'Nos estimations s\u2019appuient sur DVF, les vraies transactions. Pas de moyenne pondérée d\u2019un algo opaque.' },
            { t: 'Juste',   d: 'Un tarif clair, sans engagement. On garde nos utilisateurs parce qu\u2019on est utile — pas parce qu\u2019on les a bloqués.' },
          ].map((v, i) => (
            <motion.div
              key={v.t}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: easeOut }}
              className="mkt-feature-visual"
              style={{ minHeight: 'auto', padding: '28px 24px' }}
            >
              <h3 style={{ fontSize: '1.5rem', marginBottom: 12 }}>{v.t}</h3>
              <p style={{ color: 'var(--text-2)', fontSize: 15 }}>{v.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    <section className="mkt-final-cta" data-testid="mkt-about-cta">
      <div className="mkt-container">
        <div className="mkt-final-cta-inner">
          <h2>Voyez par vous-même.</h2>
          <p>Téléchargez KOLO. Vous vous ferez votre propre avis.</p>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mkt-cta-pill large"
            data-testid="mkt-about-cta-appstore"
          >
            Télécharge l&apos;app
            <ArrowRight size={16} strokeWidth={2.5} />
          </a>
        </div>
      </div>
    </section>
  </>
);

const AboutPage = () => (
  <MarketingLayout>
    <AboutContent />
  </MarketingLayout>
);

export default AboutPage;
