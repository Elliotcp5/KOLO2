import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Search, Sparkles, CalendarDays } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';

// ---------------------------------------------------------------------------
// iOS screenshots delivered by the user for the animated 3D mockup in the hero.
// Mixing several app views so a first-time visitor immediately understands
// what the app does: main dashboard, prospection, KOLO chat, agenda, contacts.
// ---------------------------------------------------------------------------
const IOS_SCREENS = [
  // Center phone — main dashboard (most representative)
  'https://customer-assets.emergentagent.com/job_d14305e1-37e6-4a71-b89b-88f10626bbb5/artifacts/koky24nz_IMG_0805.PNG',
  // Right phone — prospection multi-portails view
  'https://customer-assets.emergentagent.com/job_d14305e1-37e6-4a71-b89b-88f10626bbb5/artifacts/kldljvw7_IMG_0804.PNG',
  // Left phone — KOLO assistant chat view
  'https://customer-assets.emergentagent.com/job_d14305e1-37e6-4a71-b89b-88f10626bbb5/artifacts/5d1uv06m_IMG_0803.PNG',
  // Right-far phone — additional feature (agenda / contact)
  'https://customer-assets.emergentagent.com/job_d14305e1-37e6-4a71-b89b-88f10626bbb5/artifacts/szhp9s8r_IMG_0796.PNG',
  // Left-far phone — additional feature
  'https://customer-assets.emergentagent.com/job_d14305e1-37e6-4a71-b89b-88f10626bbb5/artifacts/fl35qbir_IMG_0794.PNG',
];

const FOUNDER_PHOTO = 'https://customer-assets.emergentagent.com/job_d14305e1-37e6-4a71-b89b-88f10626bbb5/artifacts/g3cfqfz1_Photo%20Elliot%20png%20sans%20fond-2.png';

// Networks whose agents already use KOLO — critical social proof, kept as
// sober typographic marquee (no fake logos, no cheesy badges).
const NETWORKS = [
  'Century 21', 'Orpi', 'Laforêt', 'IAD France', 'Safti',
  'Guy Hoquet', 'ERA Immobilier', 'Stéphane Plaza', 'L\'Adresse',
  'Nestenn', 'Human Immobilier', 'Sextant',
];

// ---------------------------------------------------------------------------
// Motion helpers — subtle, high-end, no bounce
// ---------------------------------------------------------------------------
const easeOut = [0.22, 1, 0.36, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.8, ease: easeOut } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

// Continuous floating animation for each phone in the 3D mockup — staggered
// so the composition feels alive without any single element being distracting.
const floatAnim = (delay = 0, distance = 18) => ({
  animate: {
    y: [0, -distance, 0],
    transition: {
      duration: 6 + Math.random() * 2,
      repeat: Infinity,
      repeatType: 'mirror',
      ease: 'easeInOut',
      delay,
    },
  },
});

// ---------------------------------------------------------------------------
// 3D iOS mockup — 5 phones arrayed in an isometric cascade
// Each phone floats on its own timing → the whole feels like a subtle
// stop-motion video, not a static screenshot. That's the "give life to the
// site" cue from Qonto.
// ---------------------------------------------------------------------------
const Mockup3D = () => (
  <div className="mkt-mockup-stage" data-testid="hero-mockup-3d">
    <div className="mkt-mockup-glow" aria-hidden />
    <motion.div className="mkt-mockup-phone p-left2"  {...floatAnim(0.4)}>
      <img src={IOS_SCREENS[4]} alt="" loading="eager" />
    </motion.div>
    <motion.div className="mkt-mockup-phone p-right2" {...floatAnim(0.9)}>
      <img src={IOS_SCREENS[3]} alt="" loading="eager" />
    </motion.div>
    <motion.div className="mkt-mockup-phone p-left1"  {...floatAnim(0.0)}>
      <img src={IOS_SCREENS[2]} alt="" loading="eager" />
    </motion.div>
    <motion.div className="mkt-mockup-phone p-right1" {...floatAnim(0.6)}>
      <img src={IOS_SCREENS[1]} alt="" loading="eager" />
    </motion.div>
    <motion.div className="mkt-mockup-phone p-center" {...floatAnim(0.2, 12)}>
      <img src={IOS_SCREENS[0]} alt="KOLO iOS app" loading="eager" />
    </motion.div>
  </div>
);

// ---------------------------------------------------------------------------
// Trust marquee (agents from these networks already use KOLO)
// ---------------------------------------------------------------------------
const TrustBar = () => {
  // Duplicate the array so the CSS marquee loops seamlessly.
  const items = [...NETWORKS, ...NETWORKS];
  return (
    <section className="mkt-trust" data-testid="mkt-trust">
      <div className="mkt-container">
        <div className="mkt-trust-label">
          Des agents de ces réseaux nous font déjà confiance
        </div>
      </div>
      <div className="mkt-marquee">
        <div className="mkt-marquee-track">
          {items.map((n, i) => (
            <span key={i} className="mkt-marquee-item">{n}</span>
          ))}
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Feature visuals (bento-style, one per feature row)
// ---------------------------------------------------------------------------
const VisualProspection = () => (
  <div className="mkt-feature-visual" data-testid="visual-prospection">
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
      <Search size={16} color="#A1A1AA" />
      <span style={{ color: '#A1A1AA', fontSize: 13.5, fontWeight: 500 }}>
        Prospection · Paris 75001
      </span>
    </div>
    <div className="mkt-visual-portals" style={{ position: 'relative', height: 300 }}>
      {[
        { src: 'Leboncoin',   time: 'il y a 3 min',  price: '890 000 €', top: 0 },
        { src: 'SeLoger',     time: 'il y a 12 min', price: '740 000 €', top: 70 },
        { src: 'Bien\u2019ici', time: 'il y a 22 min', price: '1 250 000 €', top: 140 },
        { src: 'PAP',         time: 'il y a 34 min', price: '625 000 €', top: 210 },
      ].map((p, i) => (
        <motion.div
          key={p.src}
          className="mkt-portal-card"
          style={{ top: p.top }}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: i * 0.12, ease: easeOut }}
        >
          <div>
            <div className="p-name">3 pièces · 68 m²</div>
            <div className="p-meta">{p.src} · {p.time}</div>
          </div>
          <div className="p-pill">{p.price}</div>
        </motion.div>
      ))}
    </div>
  </div>
);

const VisualAssistant = () => (
  <div className="mkt-feature-visual" data-testid="visual-assistant">
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
      <Sparkles size={16} color="#A1A1AA" />
      <span style={{ color: '#A1A1AA', fontSize: 13.5, fontWeight: 500 }}>
        Assistant KOLO
      </span>
    </div>
    <div className="mkt-visual-chat">
      <motion.div
        className="mkt-chat-bubble user"
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: easeOut }}
      >
        Estime moi ce 3 pièces de 68 m² à Paris 3e.
      </motion.div>
      <motion.div
        className="mkt-chat-bubble kolo"
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.4, ease: easeOut }}
      >
        Fourchette <strong>862 000 &ndash; 918 000 €</strong> sur la base des 14 comparables DVF vendus dans les 6 derniers mois. Prix au m² médian du secteur : <strong>13 250 €</strong>.
      </motion.div>
      <motion.div
        className="mkt-chat-bubble user"
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 1.0, ease: easeOut }}
      >
        Qu&apos;est-ce que je dois relancer aujourd&apos;hui ?
      </motion.div>
      <motion.div
        className="mkt-chat-bubble kolo"
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 1.4, ease: easeOut }}
      >
        3 dossiers en attente depuis plus de 5 jours. Le plus chaud : <strong>Mme Petit</strong> — visite planifiée jeudi, aucune relance depuis.
      </motion.div>
    </div>
  </div>
);

const VisualOrganisation = () => (
  <div className="mkt-feature-visual" data-testid="visual-organisation">
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
      <CalendarDays size={16} color="#A1A1AA" />
      <span style={{ color: '#A1A1AA', fontSize: 13.5, fontWeight: 500 }}>
        Aujourd&apos;hui · Mardi 8 juillet
      </span>
    </div>
    <div className="mkt-visual-agenda">
      {[
        { time: '09:30', label: 'Visite — Rue de Turenne', badge: 'Chaud', tone: 'hot' },
        { time: '11:00', label: 'Signature compromis — Dubois', badge: 'Signé', tone: '' },
        { time: '14:15', label: 'Estimation — 42 m² Bastille',   badge: 'DVF ok', tone: 'warm' },
        { time: '16:00', label: 'Relance Mme Petit',              badge: '5 jours', tone: 'hot' },
        { time: '17:30', label: 'RDV mandataire — Fauveau',       badge: 'Nouveau', tone: '' },
      ].map((r, i) => (
        <motion.div
          key={r.time}
          className="mkt-agenda-row"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: i * 0.08, ease: easeOut }}
        >
          <span className={`dot ${r.tone}`} />
          <span className="time">{r.time}</span>
          <span className="label">{r.label}</span>
          <span className="badge">{r.badge}</span>
        </motion.div>
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------
const HomeContent = () => (
  <>
    {/* -------- TRUST BAR (moved above the fold as requested) -------- */}
    <TrustBar />

    {/* -------- HERO -------- */}
    <section className="mkt-hero" data-testid="mkt-home-hero">
      <div className="mkt-container">
        <div className="mkt-hero-inner">
          <motion.div initial="hidden" animate="show" variants={stagger}>
            <motion.h1 variants={fadeUp} className="mkt-h1" data-testid="mkt-hero-title">
              Le co&#8209;pilote intelligent<br />
              qui booste le <em>chiffre d&apos;affaires</em><br />
              des agents immo.
            </motion.h1>
            <motion.p variants={fadeUp} className="mkt-lead" data-testid="mkt-hero-subtitle">
              Prospection multi-portails, estimations précises, agenda et dossiers réunis dans une seule app iPhone. Fait par des agents immo, pour des agents immo.
            </motion.p>
            <motion.div variants={fadeUp} className="mkt-cta-row">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="mkt-cta-pill large"
                data-testid="mkt-hero-cta-appstore"
              >
                Télécharge l&apos;app
                <ArrowRight size={16} strokeWidth={2.5} />
              </a>
              <span className="mkt-cta-note">iOS · 2 min pour démarrer</span>
            </motion.div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: easeOut, delay: 0.2 }}
          >
            <Mockup3D />
          </motion.div>
        </div>
      </div>
    </section>
    {/* -------- FEATURES -------- */}
    <section className="mkt-section" data-testid="mkt-features">
      <div className="mkt-container">
        <div className="mkt-reveal">
          <div className="mkt-section-eyebrow">Ce que fait KOLO</div>
          <h2 className="mkt-section-title">
            Tout ce dont un agent a besoin, dans son iPhone.
          </h2>
          <p className="mkt-section-lead">
            Trois piliers, pensés main dans la main avec des agents et mandataires en réseau et indépendants.
          </p>
        </div>

        {/* Prospection */}
        <div className="mkt-feature mkt-reveal" data-testid="feature-prospection">
          <div className="mkt-feature-copy">
            <div className="mkt-feature-tag">01 · Prospection</div>
            <h3>Tous les portails, une seule vue.</h3>
            <p>
              Leboncoin, SeLoger, Bien&apos;ici, PAP, Logic-immo — chaque nouveau bien qui apparaît dans votre secteur remonte en temps réel dans KOLO. Fini le multi-tabs.
            </p>
            <p>
              Un bien retient votre attention ? En un tap il devient un dossier KOLO, toutes les infos pré-remplies.
            </p>
            <ul className="mkt-feature-list">
              <li><Check size={16} strokeWidth={2.5} /> Flux temps réel des 5 principaux portails</li>
              <li><Check size={16} strokeWidth={2.5} /> Accès aux DPE émis dans votre secteur (adresse, surface, date)</li>
              <li><Check size={16} strokeWidth={2.5} /> Alertes ciblées par prix, surface, code postal</li>
            </ul>
          </div>
          <VisualProspection />
        </div>

        {/* Assistant */}
        <div className="mkt-feature reverse mkt-reveal" data-testid="feature-assistant">
          <div className="mkt-feature-copy">
            <div className="mkt-feature-tag">02 · Assistant intelligent</div>
            <h3>Le meilleur agent immo, dans votre poche.</h3>
            <p>
              Une estimation en 3 secondes, un conseil juridique, un plan d&apos;action pour un dossier bloqué — KOLO répond, sourcé, en langage d&apos;agent.
            </p>
            <p>
              Les estimations s&apos;appuient sur DVF, la base publique des ventes réelles. Pas des tendances : des transactions.
            </p>
            <ul className="mkt-feature-list">
              <li><Check size={16} strokeWidth={2.5} /> Estimations basées sur les comparables DVF de votre secteur</li>
              <li><Check size={16} strokeWidth={2.5} /> Coaching et suggestions d&apos;actions sur vos dossiers en cours</li>
              <li><Check size={16} strokeWidth={2.5} /> Précisions juridiques et contractuelles à la demande</li>
            </ul>
          </div>
          <VisualAssistant />
        </div>

        {/* Organisation */}
        <div className="mkt-feature mkt-reveal" data-testid="feature-organisation">
          <div className="mkt-feature-copy">
            <div className="mkt-feature-tag">03 · Organisation</div>
            <h3>Une seule app. Zéro dispersion.</h3>
            <p>
              Agenda, annuaire de contacts, dossiers en cours — tout est réuni. Vous voyez d&apos;un coup d&apos;œil où vous en êtes sur chaque affaire.
            </p>
            <p>
              Plus d&apos;outils = plus d&apos;erreurs. KOLO remplace les 4 apps que vous jonglez au quotidien.
            </p>
            <ul className="mkt-feature-list">
              <li><Check size={16} strokeWidth={2.5} /> Agenda synchronisé avec vos dossiers actifs</li>
              <li><Check size={16} strokeWidth={2.5} /> Annuaire acheteurs, vendeurs, apporteurs — segmenté</li>
              <li><Check size={16} strokeWidth={2.5} /> Vue pipeline : mandat → visite → offre → signature</li>
            </ul>
          </div>
          <VisualOrganisation />
        </div>
      </div>
    </section>

    {/* -------- PRICING -------- */}
    <section className="mkt-section" data-testid="mkt-pricing" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.02) 40%, transparent 100%)' }}>
      <div className="mkt-container">
        <div className="mkt-reveal">
          <div className="mkt-section-eyebrow">Tarifs</div>
          <h2 className="mkt-section-title">Deux plans. Zéro friction.</h2>
          <p className="mkt-section-lead">
            Pas d&apos;engagement, pas de frais cachés. Facturé via l&apos;App Store.
          </p>
        </div>

        <div className="mkt-pricing-grid">
          <div className="mkt-price-card mkt-reveal" data-testid="price-free">
            <div className="mkt-price-plan">Gratuit</div>
            <div className="mkt-price-name">Free</div>
            <div className="mkt-price-amount">
              <span className="val">0&nbsp;€</span>
              <span className="per">/ mois</span>
            </div>
            <p className="mkt-price-desc">
              Pour découvrir KOLO sans engagement. Les fondamentaux, gratuits.
            </p>
            <ul className="mkt-price-list">
              <li><Check size={16} strokeWidth={2.5} /> 1 prospection IA par semaine</li>
              <li><Check size={16} strokeWidth={2.5} /> 10 contacts max dans l&apos;annuaire</li>
              <li><Check size={16} strokeWidth={2.5} /> Agenda intégré</li>
              <li><Check size={16} strokeWidth={2.5} /> Assistant intelligent (usage limité)</li>
            </ul>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noreferrer"
              className="mkt-cta-ghost"
              data-testid="price-free-cta"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Télécharge l&apos;app
            </a>
          </div>

          <div className="mkt-price-card featured mkt-reveal" data-testid="price-pro">
            <div className="mkt-price-plan">Pro</div>
            <div className="mkt-price-name">Pro</div>
            <div className="mkt-price-amount">
              <span className="val">24,99&nbsp;€</span>
              <span className="per">/ mois</span>
            </div>
            <p className="mkt-price-desc">
              Pour les agents qui prospectent sans limite. Tout illimité, DPE inclus.
            </p>
            <ul className="mkt-price-list">
              <li><Check size={16} strokeWidth={2.5} /> Prospections IA <strong style={{color:'#fff'}}>illimitées</strong></li>
              <li><Check size={16} strokeWidth={2.5} /> Annuaire de contacts illimité</li>
              <li><Check size={16} strokeWidth={2.5} /> Assistant intelligent illimité (DVF, juridique, coaching)</li>
              <li><Check size={16} strokeWidth={2.5} /> Accès aux DPE de votre secteur</li>
              <li><Check size={16} strokeWidth={2.5} /> Support prioritaire</li>
            </ul>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noreferrer"
              className="mkt-cta-pill"
              data-testid="price-pro-cta"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Télécharge l&apos;app
            </a>
          </div>
        </div>
      </div>
    </section>

    {/* -------- FOUNDER -------- */}
    <section className="mkt-section" data-testid="mkt-founder" style={{ paddingTop: 80 }}>
      <div className="mkt-container">
        <div className="mkt-reveal">
          <div className="mkt-section-eyebrow">Le fondateur</div>
        </div>
        <div className="mkt-founder mkt-reveal">
          <div className="mkt-founder-photo">
            <img src={FOUNDER_PHOTO} alt="Elliot, fondateur de KOLO" />
          </div>
          <div className="mkt-founder-quote">
            <p>
              Ex-agent immobilier dans deux grands réseaux, puis parcours dans la tech.
            </p>
            <p style={{ marginBottom: 20 }}>
              «&nbsp;J&apos;ai été frappé par le manque d&apos;outils vraiment pensés par des agents immo pour des agents immo. On a construit KOLO main dans la main avec des agents en réseau, mandataires et conseillers indépendants pour régler ce problème.&nbsp;»
            </p>
            <div className="mkt-founder-sign">Elliot — Fondateur de KOLO</div>
          </div>
        </div>
      </div>
    </section>

    {/* -------- FINAL CTA -------- */}
    <section className="mkt-final-cta" data-testid="mkt-final-cta">
      <div className="mkt-container">
        <div className="mkt-final-cta-inner mkt-reveal">
          <h2>Prêt à signer comme jamais&nbsp;?</h2>
          <p>Téléchargez KOLO sur l&apos;App Store. Deux minutes pour être opérationnel.</p>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mkt-cta-pill large"
            data-testid="mkt-final-cta-appstore"
          >
            Télécharge l&apos;app
            <ArrowRight size={16} strokeWidth={2.5} />
          </a>
        </div>
      </div>
    </section>
  </>
);

const HomePage = () => (
  <MarketingLayout>
    <HomeContent />
  </MarketingLayout>
);

export default HomePage;
