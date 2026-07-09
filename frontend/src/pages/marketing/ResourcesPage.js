import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';

const easeOut = [0.22, 1, 0.36, 1];

// Minimal resources page. Kept for route continuity /ressources.
const ResourcesContent = () => (
  <>
    <section className="mkt-hero" style={{ paddingBottom: 40 }} data-testid="mkt-resources-hero">
      <div className="mkt-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut }}
          style={{ maxWidth: 800 }}
        >
          <div className="mkt-section-eyebrow">Ressources</div>
          <h1 className="mkt-h1" style={{ marginBottom: 24 }}>
            Ce qui rend<br />un agent efficace.
          </h1>
          <p className="mkt-lead">
            Retours de terrain, méthodes, mini-guides. Le tout écrit par des agents ou avec des agents.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="mkt-section" style={{ paddingTop: 32 }} data-testid="mkt-resources-grid">
      <div className="mkt-container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {[
            { tag: 'Méthode',   t: 'Comment lire une DVF sans se faire piéger.', d: 'Les 3 biais classiques qui plombent une estimation, et comment les corriger en 30 secondes.' },
            { tag: 'Terrain',   t: 'Décrocher un mandat exclusif : ce qui fait la différence.', d: 'Les 5 phrases qui font pivoter un vendeur, testées sur 40+ RDV.' },
            { tag: 'Juridique', t: 'Compromis vs promesse : le récap sans jargon.', d: 'Différences pratiques pour un agent, avec les cas où ça compte vraiment.' },
            { tag: 'Prospection', t: 'DPE, un signal sous-exploité.', d: 'Pourquoi 70 % des DPE sont réalisés dans les 6 mois avant la mise en vente.' },
            { tag: 'Outils',    t: 'Un dossier prêt en 2 minutes, pas 20.', d: 'Comment KOLO pré-remplit les 12 champs habituellement chiants d\u2019un dossier.' },
            { tag: 'Retour',    t: '“J\u2019ai gagné 4h par semaine.”', d: 'Ce que ça change concrètement dans une semaine d\u2019agent en réseau.' },
          ].map((r, i) => (
            <motion.article
              key={r.t}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08, ease: easeOut }}
              className="mkt-feature-visual"
              style={{ minHeight: 'auto', padding: 24, cursor: 'default' }}
            >
              <div className="mkt-feature-tag" style={{ marginBottom: 12 }}>{r.tag}</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: 10, lineHeight: 1.2 }}>{r.t}</h3>
              <p style={{ color: 'var(--text-2)', fontSize: 14.5, lineHeight: 1.5 }}>{r.d}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>

    <section className="mkt-final-cta" data-testid="mkt-resources-cta">
      <div className="mkt-container">
        <div className="mkt-final-cta-inner">
          <h2>Le meilleur outil, c&apos;est celui qu&apos;on utilise.</h2>
          <p>Testez KOLO. Vous vous rendrez compte tout seul.</p>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mkt-cta-pill large"
            data-testid="mkt-resources-cta-appstore"
          >
            Télécharge l&apos;app
            <ArrowRight size={16} strokeWidth={2.5} />
          </a>
        </div>
      </div>
    </section>
  </>
);

const ResourcesPage = () => (
  <MarketingLayout>
    <ResourcesContent />
  </MarketingLayout>
);

export default ResourcesPage;
