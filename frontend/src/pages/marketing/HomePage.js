import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Search, Sparkles, CalendarDays } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';

// ---------------------------------------------------------------------------
// iOS screenshots — REAL app captures delivered by the user.
// Order in the cascade: center, right1, left1, right2, left2.
// ---------------------------------------------------------------------------
const IOS_SCREENS = [
  // Center — Home "Bon après-midi …" (dashboard)
  'https://customer-assets.emergentagent.com/job_d14305e1-37e6-4a71-b89b-88f10626bbb5/artifacts/z7ee6z7t_IMG_6511.webp',
  // Right — Prospection
  'https://customer-assets.emergentagent.com/job_d14305e1-37e6-4a71-b89b-88f10626bbb5/artifacts/w2b9gvuk_IMG_6513.webp',
  // Left — Parler à KOLO chat
  'https://customer-assets.emergentagent.com/job_d14305e1-37e6-4a71-b89b-88f10626bbb5/artifacts/jn28f7py_IMG_6517.webp',
  // Right-far — Dossiers
  'https://customer-assets.emergentagent.com/job_d14305e1-37e6-4a71-b89b-88f10626bbb5/artifacts/uw71z1u2_IMG_6514.webp',
  // Left-far — Contacts
  'https://customer-assets.emergentagent.com/job_d14305e1-37e6-4a71-b89b-88f10626bbb5/artifacts/mpva8qq7_IMG_6515.webp',
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
// Synthetic Home-screen mockup rendered as JSX inside the CENTER phone.
// User asked for a full "Bonjour Jean" home view with avatar JN, Conseil du
// jour, and 4/6 · 3/5 metrics. Because we render it as HTML (not a raw
// screenshot), we can control every piece of copy.
// ---------------------------------------------------------------------------
const HomeMockupScreen = () => (
  <div style={{
    width: '100%', height: '100%',
    background: 'linear-gradient(180deg, #F5EAE2 0%, #E9D5CC 32%, #C8BEE6 72%, #A9B5E8 100%)',
    padding: '46px 14px 14px',
    display: 'flex', flexDirection: 'column', gap: 10,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
    color: '#1B1B25',
    overflow: 'hidden',
    position: 'relative',
  }}>
    <div style={{
      position: 'absolute', top: 8, left: 0, right: 0,
      display: 'flex', justifyContent: 'space-between',
      padding: '0 22px', fontSize: 10, fontWeight: 600, color: '#1B1B25',
    }}>
      <span>14:23</span>
      <span>••• 5G ●●●</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
      <div style={{ width: 22, height: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <span style={{ width: '100%', height: 2, background: '#1B1B25', borderRadius: 1 }} />
        <span style={{ width: '80%', height: 2, background: '#1B1B25', borderRadius: 1 }} />
        <span style={{ width: '60%', height: 2, background: '#1B1B25', borderRadius: 1 }} />
      </div>
      <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 900, fontSize: 22, color: '#1B1B25' }}>K</div>
      <div style={{ width: 22, height: 22, borderRadius: 999, border: '1.5px solid #1B1B25', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>🔔</div>
    </div>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 6 }}>
      <div>
        <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Bonjour Jean</div>
        <div style={{ fontSize: 9.5, color: 'rgba(27,27,37,0.6)', marginTop: 2 }}>jeudi 9 juillet</div>
      </div>
      <div style={{
        width: 30, height: 30, borderRadius: 999,
        background: 'rgba(27,27,37,0.12)',
        color: '#1B1B25', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 10.5,
      }}>JN</div>
    </div>
    <div style={{
      marginTop: 4,
      padding: '10px 12px',
      borderRadius: 14,
      background: 'rgba(255,255,255,0.55)',
      border: '1px solid rgba(255,255,255,0.7)',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(27,27,37,0.55)', marginBottom: 4 }}>◆ CONSEIL DU JOUR</div>
      <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 700, fontSize: 12.5, marginBottom: 4 }}>Salut Jean !</div>
      <div style={{ fontSize: 9.5, lineHeight: 1.4, color: 'rgba(27,27,37,0.75)' }}>
        Salut Jean ! Avant de démarrer, pense à relancer les 2 vendeurs en attente depuis 5 jours.
      </div>
      <div style={{
        marginTop: 8,
        padding: '7px 10px',
        borderRadius: 999,
        background: '#1B1B25', color: '#F5EAE2',
        fontSize: 9.5, fontWeight: 700, textAlign: 'center',
      }}>◆ Demander à KOLO</div>
    </div>
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(27,27,37,0.55)', marginBottom: 6 }}>AUJOURD&apos;HUI</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{
          padding: '10px 8px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(255,255,255,0.7)',
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: '#1B1B25' }}>4/6</div>
          <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(27,27,37,0.55)', marginTop: 2 }}>FAITS</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#1B1B25', marginTop: 3 }}>RAPPELS</div>
          <div style={{ fontSize: 8, color: 'rgba(27,27,37,0.55)', marginTop: 1 }}>2 restants</div>
        </div>
        <div style={{
          padding: '10px 8px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(255,255,255,0.7)',
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: '#1B1B25' }}>3/5</div>
          <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(27,27,37,0.55)', marginTop: 2 }}>TRAITÉES</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#1B1B25', marginTop: 3 }}>NOTES</div>
          <div style={{ fontSize: 8, color: 'rgba(27,27,37,0.55)', marginTop: 1 }}>À jour</div>
        </div>
      </div>
    </div>
    <div style={{ marginTop: 4, flex: 1 }}>
      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(27,27,37,0.55)', marginBottom: 4 }}>DOSSIERS RÉCENTS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { role: 'V', name: 'M. Dubois',  meta: '35 m² · Paris 3e' },
          { role: 'V', name: 'Mme Petit',  meta: '25.6 m² · Lemercier' },
          { role: 'A', name: 'M. Moreau',  meta: '3p · Paris 11e' },
        ].map((d) => (
          <div key={d.name} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 8px', borderRadius: 8,
            background: 'rgba(255,255,255,0.35)',
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: 999,
              background: d.role === 'V' ? '#1B1B25' : 'rgba(27,27,37,0.35)',
              color: '#F5EAE2', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 7, fontWeight: 700,
            }}>{d.role}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#1B1B25' }}>{d.name}</span>
            <span style={{ fontSize: 8, color: 'rgba(27,27,37,0.55)' }}>{d.meta}</span>
          </div>
        ))}
      </div>
    </div>
    <div style={{
      marginTop: 4,
      display: 'flex', justifyContent: 'space-around',
      padding: '8px 0 4px',
      borderTop: '1px solid rgba(27,27,37,0.12)',
      fontSize: 8, fontWeight: 600, color: 'rgba(27,27,37,0.45)',
    }}>
      <span style={{ color: '#1B1B25' }}>◆ Accueil</span>
      <span>Prospection</span>
      <span>Dossiers</span>
      <span>Contacts</span>
      <span>Agenda</span>
    </div>
  </div>
);

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
      <img src={IOS_SCREENS[0]} alt="KOLO app" loading="eager" />
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
// These reproduce the *real* KOLO screens with fake but realistic data
// (first name Jean, real listing formats, real chat quick-actions) so a
// visitor understands the app without ever having opened it.
// ---------------------------------------------------------------------------
const VisualProspection = () => (
  <div className="mkt-feature-visual" data-testid="visual-prospection">
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      <Search size={16} color="#A1A1AA" />
      <span style={{ color: '#A1A1AA', fontSize: 13.5, fontWeight: 500 }}>
        Prospection · 75016
      </span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[
        { title: 'Vente Appartement 6 pièces', meta: 'Paris 16e · 129 m² · 6p · 1 695 000 €', tag: 'Particulier' },
        { title: 'Vente Appartement 5 pièces', meta: 'Paris 16e · 133 m² · 5p · 1 795 000 €', tag: 'Particulier' },
        { title: 'Studio · Avenue d\u2019Iéna',        meta: 'Paris 16e · 22 m² · 1p · 279 000 €',     tag: 'Particulier' },
        { title: 'Vente Appartement 3 pièces', meta: 'Paris 16e · 68 m² · 3p · 890 000 €',   tag: 'Agence' },
      ].map((row, i) => (
        <motion.div
          key={row.title + i}
          initial={{ opacity: 0, x: -18 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: i * 0.1, ease: easeOut }}
          style={{
            padding: '12px 14px',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>{row.title}</div>
              <div style={{ color: '#A1A1AA', fontSize: 12.5 }}>{row.meta}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <span style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 10.5, fontWeight: 600 }}>{row.tag}</span>
              <span style={{ padding: '3px 8px', borderRadius: 999, background: '#fff', color: '#050505', fontSize: 10.5, fontWeight: 700 }}>+ Dossier</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

const VisualAssistant = () => (
  <div className="mkt-feature-visual" data-testid="visual-assistant">
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      <Sparkles size={16} color="#A1A1AA" />
      <span style={{ color: '#A1A1AA', fontSize: 13.5, fontWeight: 500 }}>Parler à KOLO</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <motion.div
        className="mkt-chat-bubble kolo"
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: easeOut }}
        style={{ maxWidth: '90%' }}
      >
        Bonjour <span aria-hidden>👋</span> Je suis KOLO, ton copilote immo. Pose-moi une question (prospection, relance, négo…) ou dicte ton brief terrain.
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.3, ease: easeOut }}
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {['Voir mes tâches du jour', 'Créer un contact vendeur', 'Recevoir un conseil de prospection'].map((q, i) => (
          <div key={q} style={{
            padding: '10px 14px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.02)',
            color: '#fff',
            fontSize: 13.5,
            fontWeight: 500,
            textAlign: 'left',
          }}>{q}</div>
        ))}
      </motion.div>
      <motion.div
        className="mkt-chat-bubble user"
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.9, ease: easeOut }}
      >
        Estime moi ce 3 pièces de 68 m² à Paris 16e.
      </motion.div>
      <motion.div
        className="mkt-chat-bubble kolo"
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 1.3, ease: easeOut }}
        style={{ maxWidth: '90%' }}
      >
        Fourchette <strong>862 000 &ndash; 918 000&nbsp;€</strong> sur la base de 14 comparables DVF vendus dans les 6 derniers mois.
      </motion.div>
    </div>
  </div>
);

const VisualOrganisation = () => (
  <div className="mkt-feature-visual" data-testid="visual-organisation">
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      <CalendarDays size={16} color="#A1A1AA" />
      <span style={{ color: '#A1A1AA', fontSize: 13.5, fontWeight: 500 }}>Accueil · jeudi 9 juillet</span>
    </div>

    {/* Greeting */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: '#fff' }}>
        Bon après-midi Jean
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, position: 'relative' }}>
        JD
        <span style={{ position: 'absolute', bottom: 2, right: 2, width: 8, height: 8, borderRadius: 999, background: '#34d399', border: '2px solid #0A0A0A' }} />
      </div>
    </div>

    {/* Progress cards */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: easeOut }}
        style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}
      >
        <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 28, color: '#fff', letterSpacing: '-0.02em' }}>4/6</div>
        <div style={{ color: '#A1A1AA', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>Faits</div>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 12.5, marginTop: 8 }}>Rappels</div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.15, ease: easeOut }}
        style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}
      >
        <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 28, color: '#fff', letterSpacing: '-0.02em' }}>3/5</div>
        <div style={{ color: '#A1A1AA', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>Traitées</div>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 12.5, marginTop: 8 }}>Notes</div>
      </motion.div>
    </div>

    {/* Dossiers récents */}
    <div style={{ color: '#A1A1AA', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 500 }}>
      Dossiers récents
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        { role: 'VENDEUR',  name: 'M. Dubois',   meta: '35 m² · 2 pièces · Paris 3e' },
        { role: 'VENDEUR',  name: 'Mme Petit',   meta: '25.6 m² · 11b Rue Lemercier 75017' },
        { role: 'ACQUÉREUR', name: 'M. Moreau',  meta: 'Recherche 3p · Paris 11e · < 750 k€' },
      ].map((d, i) => (
        <motion.div
          key={d.name}
          initial={{ opacity: 0, x: 18 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: i * 0.08, ease: easeOut }}
          style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: '#A1A1AA', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em' }}>{d.role}</span>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 13.5 }}>{d.name}</span>
          </div>
          <div style={{ color: '#A1A1AA', fontSize: 12, marginTop: 4 }}>{d.meta}</div>
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
              Une seule app pour prospecter, estimer un bien, suivre vos dossiers et gérer vos contacts. Fait par des agents immo, pour des agents immo.
            </motion.p>
            <motion.div variants={fadeUp} className="mkt-cta-row">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="mkt-cta-pill large"
                data-testid="mkt-hero-cta-appstore"
              >
                Télécharge KOLO gratuitement
                <ArrowRight size={16} strokeWidth={2.5} />
              </a>
              <span className="mkt-cta-note">Téléchargement gratuit et sans engagement</span>
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

    {/* -------- VALUE PROMISE -------- */}
    <section className="mkt-value" data-testid="mkt-value-promise">
      <div className="mkt-value-glow" aria-hidden />
      <div className="mkt-value-inner">
        <motion.div className="mkt-value-eyebrow"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: easeOut }}>
          Notre promesse
        </motion.div>
        <motion.div className="mkt-value-number"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: easeOut, delay: 0.05 }}>
          +20&nbsp;000&nbsp;€
        </motion.div>
        <motion.div className="mkt-value-label"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: easeOut, delay: 0.15 }}>
          C&apos;est en moyenne ce que chaque agent fait en plus dès la première année avec KOLO.
        </motion.div>
        <motion.p className="mkt-value-sublabel"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: easeOut, delay: 0.25 }}>
          Plus de biens repérés, plus vite. Plus de vendeurs identifiés. Moins de temps perdu à jongler entre les outils.
        </motion.p>
      </div>
    </section>

    {/* -------- FEATURES -------- */}
    <section className="mkt-section section-accent-warm" data-testid="mkt-features">
      <div className="mkt-container">
        <div className="mkt-reveal">
          <div className="mkt-section-eyebrow">Ce que fait KOLO</div>
          <h2 className="mkt-section-title">
            3 leviers. Zéro perte de temps.
          </h2>
          <p className="mkt-section-lead">
            L&apos;essentiel de votre métier, dans une seule app.
          </p>
        </div>

        {/* Prospection */}
        <div className="mkt-feature mkt-reveal" data-testid="feature-prospection">
          <div className="mkt-feature-copy">
            <div className="mkt-feature-tag">01 · Trouvez des mandats</div>
            <h3>Tous les mandats à saisir, en un coup d&apos;œil.</h3>
            <p>
              Les 5 grands portails + <strong style={{color:'#fff'}}>tous les DPE émis dans votre secteur</strong>. Chaque projet de vente qui apparaît, vous le voyez avant les autres.
            </p>
            <ul className="mkt-feature-list">
              <li><Check size={16} strokeWidth={2.5} /> Vue multi-portails en direct sur votre zone</li>
              <li><Check size={16} strokeWidth={2.5} /> DPE émis = futurs vendeurs identifiés</li>
              <li><Check size={16} strokeWidth={2.5} /> Alertes push sur les nouveaux biens</li>
            </ul>
          </div>
          <VisualProspection />
        </div>

        {/* Assistant */}
        <div className="mkt-feature reverse mkt-reveal" data-testid="feature-assistant">
          <div className="mkt-feature-copy">
            <div className="mkt-feature-tag">02 · Signez plus de mandats</div>
            <h3>L&apos;expert qui vous coache avant chaque R1.</h3>
            <p>
              Estimation DVF en 3 secondes, argumentaire de signature, réponse juridique. KOLO répond, en langage d&apos;agent.
            </p>
            <ul className="mkt-feature-list">
              <li><Check size={16} strokeWidth={2.5} /> Estimation basée sur les ventes DVF de l&apos;immeuble et du quartier</li>
              <li><Check size={16} strokeWidth={2.5} /> Stratégie de signature par prospect</li>
              <li><Check size={16} strokeWidth={2.5} /> Relances suggérées automatiquement</li>
            </ul>
          </div>
          <VisualAssistant />
        </div>

        {/* Organisation */}
        <div className="mkt-feature mkt-reveal" data-testid="feature-organisation">
          <div className="mkt-feature-copy">
            <div className="mkt-feature-tag">03 · Restez rentable</div>
            <h3>Vos notes, votre agenda, vos dossiers. Ensemble.</h3>
            <p>
              Dictez une note vocale entre deux visites, KOLO la classe. Vos rappels, contacts et dossiers en cours sont au même endroit. Fini les 4 apps.
            </p>
            <ul className="mkt-feature-list">
              <li><Check size={16} strokeWidth={2.5} /> Notes vocales entre deux rendez-vous</li>
              <li><Check size={16} strokeWidth={2.5} /> Agenda et rappels synchronisés</li>
              <li><Check size={16} strokeWidth={2.5} /> Chaque dossier suivi : mandat → visite → offre → signature</li>
            </ul>
          </div>
          <VisualOrganisation />
        </div>
      </div>
    </section>

    {/* -------- PRICING -------- */}
    <section className="mkt-section section-accent-violet" data-testid="mkt-pricing">
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
    <section className="mkt-section section-accent-cool" data-testid="mkt-founder" style={{ paddingTop: 80 }}>
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
