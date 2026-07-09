import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';

const easeOut = [0.22, 1, 0.36, 1];

const HowContent = () => (
  <>
    <section className="mkt-hero" style={{ paddingBottom: 40 }} data-testid="mkt-how-hero">
      <div className="mkt-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut }}
          style={{ maxWidth: 800 }}
        >
          <div className="mkt-section-eyebrow">Comment ça marche</div>
          <h1 className="mkt-h1" style={{ marginBottom: 24 }}>
            Ouvrez l&apos;app.<br />C&apos;est déjà fluide.
          </h1>
          <p className="mkt-lead">
            KOLO ne demande ni configuration, ni formation. Trois zones, trois usages — tout est accessible en un tap depuis l&apos;écran d&apos;accueil.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="mkt-section" style={{ paddingTop: 40 }} data-testid="mkt-how-steps">
      <div className="mkt-container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
          {[
            {
              n: '01',
              t: 'Vous ouvrez l\u2019app.',
              d: 'Login par email en 10 secondes. Aucune installation locale, aucun paramétrage. Vous êtes sur l\u2019accueil.',
              items: ['Connexion par email · pas de mot de passe à retenir', 'Sync iCloud entre iPhone et iPad', 'Notifications push pour les leads chauds'],
            },
            {
              n: '02',
              t: 'La prospection tourne toute seule.',
              d: 'Vous définissez votre secteur une fois. Tous les nouveaux biens des 5 grands portails remontent dans KOLO, sans que vous ayez rien à faire.',
              items: ['Leboncoin · SeLoger · Bien\u2019ici · PAP · Logic-immo', 'DPE émis dans votre secteur (accès Pro)', 'Alertes push sur les biens qui matchent vos critères'],
            },
            {
              n: '03',
              t: 'Vous demandez, KOLO répond.',
              d: 'Une estimation, un conseil, une précision juridique — vous posez la question en langage naturel, KOLO répond avec ses sources.',
              items: ['Estimations sur DVF (les vraies ventes)', 'Coaching sur vos dossiers en cours', 'Suggestions d\u2019actions concrètes à faire aujourd\u2019hui'],
            },
            {
              n: '04',
              t: 'Tout est rangé au même endroit.',
              d: 'Vos dossiers, vos contacts, votre agenda. Chaque nouveau bien devient un dossier en un tap, avec toutes les infos déjà remplies.',
              items: ['Pipeline visuel : mandat → visite → offre → signature', 'Annuaire segmenté par rôle (acheteur / vendeur / apporteur)', 'Agenda synchronisé avec vos dossiers actifs'],
            },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              className="mkt-feature"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, delay: i * 0.05, ease: easeOut }}
              style={{ padding: 0 }}
            >
              <div className="mkt-feature-copy">
                <div className="mkt-feature-tag">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
                <ul className="mkt-feature-list">
                  {s.items.map((it) => (
                    <li key={it}><Check size={16} strokeWidth={2.5} /> {it}</li>
                  ))}
                </ul>
              </div>
              <div className="mkt-feature-visual" style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  fontFamily: 'Cabinet Grotesk, sans-serif',
                  fontSize: '8rem',
                  fontWeight: 900,
                  letterSpacing: '-0.06em',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1,
                }}>{s.n}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    <section className="mkt-final-cta" data-testid="mkt-how-cta">
      <div className="mkt-container">
        <div className="mkt-final-cta-inner">
          <h2>Voyez-le tourner sur votre iPhone.</h2>
          <p>2 min pour être opérationnel. Zéro CB demandée pour tester.</p>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mkt-cta-pill large"
            data-testid="mkt-how-cta-appstore"
          >
            Télécharge l&apos;app
            <ArrowRight size={16} strokeWidth={2.5} />
          </a>
        </div>
      </div>
    </section>
  </>
);

const HowKoloPage = () => (
  <MarketingLayout>
    <HowContent />
  </MarketingLayout>
);

export default HowKoloPage;
