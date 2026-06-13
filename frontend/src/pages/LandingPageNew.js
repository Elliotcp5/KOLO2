import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useLocale } from '../context/LocaleContext';
import PremiumBackdrop from '../components/PremiumBackdrop';
import PhoneMockup from '../components/PhoneMockup';
import LanguageSwitcher from '../components/LanguageSwitcher';
import '../styles/landing.css';
import '../styles/premium-backdrop.css';
import '../styles/iphone-mockup.css';

// Maps our internal locale to Apple's storefront + badge language codes.
const APP_STORE_LOCALE_MAP = {
  fr: { storefront: 'fr', badge: 'fr-fr', alt: "Télécharger dans l'App Store" },
  en: { storefront: 'us', badge: 'en-us', alt: 'Download on the App Store' },
  de: { storefront: 'de', badge: 'de-de', alt: 'Laden im App Store' },
  it: { storefront: 'it', badge: 'it-it', alt: 'Scarica su App Store' },
};

const APP_STORE_APP_ID = '6761818371';

// Localized "or" caption shown above the badge.
const APP_STORE_CAPTION = {
  fr: 'Ou téléchargez l\'app iOS',
  en: 'Or download the iOS app',
  de: 'Oder lade die iOS-App herunter',
  it: 'O scarica l\'app per iOS',
};

const AppStoreBadge = ({ locale, variant = 'default' }) => {
  // Never show this badge inside the native iOS app — they're already there.
  if (Capacitor.isNativePlatform && Capacitor.isNativePlatform()) return null;

  const loc = APP_STORE_LOCALE_MAP[locale] || APP_STORE_LOCALE_MAP.en;
  const href = `https://apps.apple.com/${loc.storefront}/app/kolo-ai-real-estate/id${APP_STORE_APP_ID}`;
  const badgeSrc = `https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/${loc.badge}`;

  const wrapStyle = variant === 'centered'
    ? { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '24px' }
    : { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '20px' };

  return (
    <div style={wrapStyle} data-testid="app-store-badge-wrap">
      <span style={{
        fontSize: '13px',
        color: 'var(--ink-mid, #6b7280)',
        letterSpacing: '0.02em',
        opacity: 0.85,
      }}>
        {APP_STORE_CAPTION[locale] || APP_STORE_CAPTION.en}
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={loc.alt}
        data-testid="app-store-download-btn"
        style={{
          display: 'inline-block',
          transition: 'transform 0.18s ease, filter 0.18s ease',
          willChange: 'transform',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
          e.currentTarget.style.filter = 'drop-shadow(0 8px 18px rgba(0,0,0,0.18))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.filter = 'none';
        }}
      >
        <img
          src={badgeSrc}
          alt={loc.alt}
          height={variant === 'centered' ? 56 : 48}
          style={{
            height: variant === 'centered' ? '56px' : '48px',
            width: 'auto',
            display: 'block',
            borderRadius: '8px',
          }}
        />
      </a>
    </div>
  );
};

const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'it', label: 'IT' },
];

const CURRENCIES = [
  { code: 'EUR', symbol: '€', label: 'EUR' },
  { code: 'USD', symbol: '$', label: 'USD' },
  { code: 'GBP', symbol: '£', label: 'GBP' },
];

// Pricing data for landing page
const LANDING_PRICING = {
  pro: {
    EUR: { monthly: '9,99€', symbol: '€' },
    USD: { monthly: '$10.99', symbol: '$' },
    GBP: { monthly: '£8.99', symbol: '£' },
  },
  pro_plus: {
    EUR: { monthly: '24,99€', symbol: '€' },
    USD: { monthly: '$27.99', symbol: '$' },
    GBP: { monthly: '£21.99', symbol: '£' },
  }
};

// Landing page specific translations
const LANDING_TEXTS = {
  fr: {
    upTo30Prospects: "Jusqu'à 30 prospects",
    oneAiSuggestionDay: "1 suggestion IA/jour",
    taskManagement: "Gestion des tâches",
    startFree: "Commencer gratuitement",
    popular: "Populaire",
    unlimitedProspects: "Prospects illimités",
    unlimitedAiSuggestions: "Suggestions IA illimitées",
    oneClickSms: "SMS 1-clic IA",
    interactionHistory: "Historique des interactions",
    contextualNotes: "Notes contextuelles",
    everythingInPro: "Tout ce qui est dans PRO",
    hotLeadsAuto: "Prospects chauds identifiés auto",
    commissionTracking: "Suivi de vos commissions",
    weeklyEmailReport: "Rapport hebdo par email",
    prioritySupport: "Support prioritaire",
    legalNotice: "Mentions légales",
    blogLink: "Blog"
  },
  en: {
    upTo30Prospects: "Up to 30 prospects",
    oneAiSuggestionDay: "1 AI suggestion/day",
    taskManagement: "Task management",
    startFree: "Start for free",
    popular: "Popular",
    unlimitedProspects: "Unlimited prospects",
    unlimitedAiSuggestions: "Unlimited AI suggestions",
    oneClickSms: "1-click AI SMS",
    interactionHistory: "Interaction history",
    contextualNotes: "Contextual notes",
    everythingInPro: "Everything in PRO",
    hotLeadsAuto: "Hot leads auto-identified",
    commissionTracking: "Commission tracking",
    weeklyEmailReport: "Weekly email report",
    prioritySupport: "Priority support",
    legalNotice: "Legal Notice",
    blogLink: "Blog"
  },
  de: {
    upTo30Prospects: "Bis zu 30 Interessenten",
    oneAiSuggestionDay: "1 KI-Vorschlag/Tag",
    taskManagement: "Aufgabenverwaltung",
    startFree: "Kostenlos starten",
    popular: "Beliebt",
    unlimitedProspects: "Unbegrenzte Interessenten",
    unlimitedAiSuggestions: "Unbegrenzte KI-Vorschläge",
    oneClickSms: "1-Klick-KI-SMS",
    interactionHistory: "Interaktionsverlauf",
    contextualNotes: "Kontextuelle Notizen",
    everythingInPro: "Alles in PRO",
    hotLeadsAuto: "Heiße Leads automatisch erkannt",
    commissionTracking: "Provisionsverfolgung",
    weeklyEmailReport: "Wöchentlicher E-Mail-Bericht",
    prioritySupport: "Prioritäts-Support",
    legalNotice: "Impressum",
    blogLink: "Blog"
  },
  it: {
    upTo30Prospects: "Fino a 30 prospect",
    oneAiSuggestionDay: "1 suggerimento IA/giorno",
    taskManagement: "Gestione attività",
    startFree: "Inizia gratis",
    popular: "Popolare",
    unlimitedProspects: "Prospect illimitati",
    unlimitedAiSuggestions: "Suggerimenti IA illimitati",
    oneClickSms: "SMS IA 1-clic",
    interactionHistory: "Cronologia interazioni",
    contextualNotes: "Note contestuali",
    everythingInPro: "Tutto in PRO",
    hotLeadsAuto: "Lead caldi identificati auto",
    commissionTracking: "Monitoraggio commissioni",
    weeklyEmailReport: "Report settimanale via email",
    prioritySupport: "Supporto prioritario",
    legalNotice: "Note legali",
    blogLink: "Blog"
  }
};

const LandingPage = () => {
  const navigate = useNavigate();
  const { locale, changeLanguage, t, currency, symbol, changeCurrency } = useLocale();
  const lt = LANDING_TEXTS[locale] || LANDING_TEXTS.en;
  const [scrolled, setScrolled] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [email, setEmail] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Reveal animation on scroll
  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    
    reveals.forEach(el => observer.observe(el));
    return () => reveals.forEach(el => observer.unobserve(el));
  }, []);

  const handleCTA = (e) => {
    e.preventDefault();
    if (email) {
      // Redirect to register with email pre-filled
      navigate('/register', { state: { email } });
    } else {
      navigate('/register');
    }
  };

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const currentLang = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0];

  const faqs = [
    { q: t('landingFaq1Q'), a: t('landingFaq1A') },
    { q: t('landingFaq2Q'), a: t('landingFaq2A') },
    { q: t('landingFaq3Q'), a: t('landingFaq3A') },
    { q: t('landingFaq4Q'), a: t('landingFaq4A') },
    { q: t('landingFaq5Q'), a: t('landingFaq5A') }
  ];

  const features = [
    { icon: '✓', text: t('landingFeature1') },
    { icon: '✓', text: t('landingFeature2') },
    { icon: '✓', text: t('landingFeature3') },
    { icon: '✓', text: t('landingFeature4') },
    { icon: '✓', text: t('landingFeature5') },
    { icon: '✓', text: t('landingFeature6') },
    { icon: '✓', text: t('landingFeature7') }
  ];

  return (
    <div className="landing-page">
      {/* Premium animated backdrop (orbs + dot grid + spotlight) */}
      <PremiumBackdrop />

      {/* SVG Gradient Definition */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#004AAD" />
            <stop offset="100%" stopColor="#CB6CE6" />
          </linearGradient>
        </defs>
      </svg>

      {/* NAVBAR - Minimaliste */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <a href="/" className="nav-logo">
          <span className="logo-dot"></span>KOLO
        </a>
        
        <div className="nav-actions">
          <button
            className="nav-pricing nav-business"
            onClick={() => navigate('/business')}
            data-testid="nav-business-link"
          >
            {locale === 'fr' ? 'Entreprises' :
             locale === 'de' ? 'Unternehmen' :
             locale === 'it' ? 'Aziende' :
             'Business'}
          </button>
          <button className="nav-login" onClick={() => navigate('/login')}>
            {t('loginButton')}
          </button>
          <button className="nav-cta" onClick={() => navigate('/register')}>
            <span className="cta-full">{t('tryForFree')}</span>
            <span className="cta-short">{t('tryShort')}</span>
          </button>
        </div>
      </nav>

      {/* HERO — radically simplified, leedflow style */}
      <section className="hero">
        <div className="container">
          <h1>
            {t('heroTitle1')} <br/><span className="grad-text">{t('heroTitle2')}</span>
          </h1>
          <p className="hero-sub">
            {t('heroSubtitle')}
          </p>
          <div className="hero-cta-row">
            <button
              className="hero-btn-main"
              onClick={() => navigate('/register')}
              data-testid="hero-cta-btn"
            >
              {t('tryForFree')} <ArrowRight size={18} />
            </button>
            <span className="hero-micro-inline">
              {t('noCreditCard')}
            </span>
          </div>
          <AppStoreBadge locale={locale} variant="default" />
        </div>
      </section>

      {/* PRODUCT SHOWCASE — realistic iPhone with animated KOLO app */}
      <section className="phone-showcase">
        <div className="container">
          <PhoneMockup />
        </div>
      </section>

      {/* PROBLEM SECTION REMOVED — leedflow-style: less is more */}

      {/* SANS / AVEC — comparison block (leedflow-style) */}
      <section className="section">
        <div className="container">
          <div className="centered reveal">
            <div className="section-tag">
              {locale === 'fr' ? 'Pourquoi KOLO ?' :
               locale === 'de' ? 'Warum KOLO?' :
               locale === 'it' ? 'Perché KOLO?' :
               'Why KOLO?'}
            </div>
            <h2 className="section-title">
              {locale === 'fr' ? 'Combien de ventes avez-vous perdues sans le savoir ?' :
               locale === 'de' ? 'Wie viele Verkäufe haben Sie verloren, ohne es zu wissen?' :
               locale === 'it' ? 'Quante vendite hai perso senza saperlo?' :
               'How many deals have you lost without knowing it?'}
            </h2>
          </div>

          <div className="compare-grid">
            <div className="compare-col compare-bad">
              <div className="compare-label">
                {locale === 'fr' ? 'Sans KOLO…' :
                 locale === 'de' ? 'Ohne KOLO…' :
                 locale === 'it' ? 'Senza KOLO…' :
                 'Without KOLO…'}
              </div>
              <ul className="compare-list">
                <li><X size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Des notes prises à la va-vite qu\'on ne relit jamais.' :
                   locale === 'de' ? 'Schnell hingeworfene Notizen, die nie wieder gelesen werden.' :
                   locale === 'it' ? 'Note prese di corsa che non si rileggono mai.' :
                   'Hasty notes that you never read again.'}
                </span></li>
                <li><X size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Des clients qui attendent un rappel qui ne vient pas.' :
                   locale === 'de' ? 'Kunden, die auf einen Rückruf warten, der nie kommt.' :
                   locale === 'it' ? 'Clienti che aspettano una richiamata che non arriva.' :
                   'Clients waiting for a call back that never comes.'}
                </span></li>
                <li><X size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Des relances oubliées.' :
                   locale === 'de' ? 'Vergessene Nachfassaktionen.' :
                   locale === 'it' ? 'Follow-up dimenticati.' :
                   'Forgotten follow-ups.'}
                </span></li>
                <li><X size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Des milliers d\'euros de chiffre d\'affaires perdus.' :
                   locale === 'de' ? 'Tausende Euro an verlorenen Umsätzen.' :
                   locale === 'it' ? 'Migliaia di euro di fatturato persi.' :
                   'Thousands of euros in lost revenue.'}
                </span></li>
              </ul>
            </div>

            <div className="compare-col compare-good">
              <div className="compare-label compare-label-good">
                {locale === 'fr' ? 'Avec KOLO' :
                 locale === 'de' ? 'Mit KOLO' :
                 locale === 'it' ? 'Con KOLO' :
                 'With KOLO'}
              </div>
              <ul className="compare-list">
                <li><Check size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Chaque prospect est suivi et résumé automatiquement.' :
                   locale === 'de' ? 'Jeder Interessent wird automatisch verfolgt und zusammengefasst.' :
                   locale === 'it' ? 'Ogni potenziale cliente è seguito e riassunto automaticamente.' :
                   'Every prospect is tracked and summarized automatically.'}
                </span></li>
                <li><Check size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Vos relances ajoutées à votre agenda.' :
                   locale === 'de' ? 'Ihre Erinnerungen werden Ihrem Kalender hinzugefügt.' :
                   locale === 'it' ? 'I tuoi follow-up aggiunti al tuo calendario.' :
                   'Your follow-ups added to your calendar.'}
                </span></li>
                <li><Check size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Plus aucun oubli.' :
                   locale === 'de' ? 'Keine Versäumnisse mehr.' :
                   locale === 'it' ? 'Niente più dimenticanze.' :
                   'No more forgotten leads.'}
                </span></li>
                <li><Check size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Plus aucune opportunité qui vous file entre les doigts.' :
                   locale === 'de' ? 'Keine Chance entgleitet Ihnen mehr.' :
                   locale === 'it' ? 'Nessuna opportunità ti sfugge più di mano.' :
                   'No more opportunities slipping through your fingers.'}
                </span></li>
              </ul>
            </div>
          </div>

          <div className="centered" style={{ marginTop: '48px', marginBottom: 0 }}>
            <button className="hero-btn-main" onClick={() => navigate('/register')} data-testid="why-cta-btn">
              {t('tryForFree')} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — 3 steps (leedflow-style) */}
      <section className="section section-alt">
        <div className="container">
          <div className="centered reveal">
            <div className="section-tag">
              {locale === 'fr' ? 'Comment ça marche ?' :
               locale === 'de' ? 'Wie funktioniert es?' :
               locale === 'it' ? 'Come funziona?' :
               'How it works'}
            </div>
            <h2 className="section-title">
              {locale === 'fr' ? 'Activez KOLO dès maintenant.' :
               locale === 'de' ? 'Aktivieren Sie KOLO jetzt.' :
               locale === 'it' ? 'Attiva KOLO subito.' :
               'Activate KOLO right now.'}
            </h2>
          </div>
          <div className="steps-grid">
            <div className="step">
              <div className="step-num">01.</div>
              <div className="step-title">
                {locale === 'fr' ? 'Créez votre compte' :
                 locale === 'de' ? 'Erstellen Sie Ihr Konto' :
                 locale === 'it' ? 'Crea il tuo account' :
                 'Create your account'}
              </div>
              <div className="step-body">
                {locale === 'fr' ? 'Inscription en 2 minutes. 14 jours d\'essai gratuits, sans carte.' :
                 locale === 'de' ? 'Anmeldung in 2 Minuten. 14 Tage kostenlose Testversion, ohne Kreditkarte.' :
                 locale === 'it' ? 'Registrazione in 2 minuti. 14 giorni di prova gratuita, senza carta.' :
                 'Sign up in 2 minutes. 14-day free trial, no credit card.'}
              </div>
            </div>
            <div className="step">
              <div className="step-num">02.</div>
              <div className="step-title">
                {locale === 'fr' ? 'Ajoutez vos prospects' :
                 locale === 'de' ? 'Fügen Sie Ihre Interessenten hinzu' :
                 locale === 'it' ? 'Aggiungi i tuoi potenziali clienti' :
                 'Add your prospects'}
              </div>
              <div className="step-body">
                {locale === 'fr' ? 'Quelques infos par client. KOLO comprend leur situation et leur projet.' :
                 locale === 'de' ? 'Ein paar Infos pro Kunde. KOLO versteht ihre Situation und ihr Projekt.' :
                 locale === 'it' ? 'Poche informazioni per cliente. KOLO comprende la loro situazione e il loro progetto.' :
                 'A few details per client. KOLO understands their situation and their project.'}
              </div>
            </div>
            <div className="step">
              <div className="step-num">03.</div>
              <div className="step-title">
                {locale === 'fr' ? 'KOLO s\'occupe du reste' :
                 locale === 'de' ? 'KOLO kümmert sich um den Rest' :
                 locale === 'it' ? 'KOLO si occupa del resto' :
                 'KOLO handles the rest'}
              </div>
              <div className="step-body">
                {locale === 'fr' ? 'Relances suggérées, messages prêts, priorités du jour. Comme un assistant qui ne dort jamais.' :
                 locale === 'de' ? 'Vorgeschlagene Erinnerungen, fertige Nachrichten, tägliche Prioritäten. Wie ein Assistent, der nie schläft.' :
                 locale === 'it' ? 'Follow-up suggeriti, messaggi pronti, priorità del giorno. Come un assistente che non dorme mai.' :
                 'Suggested follow-ups, ready-made messages, daily priorities. Like an assistant who never sleeps.'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="section section-alt" id="features">
        <div className="container">
          <div className="centered reveal">
            <div className="section-tag">{t('theSolution')}</div>
            <h2 className="section-title">
              {t('solutionTitle1')} {t('solutionTitle2')}
            </h2>
          </div>

          {/* Feature 1 */}
          <div className="feature-block">
            <div className="reveal-left">
              <div className="feature-tag">{t('feature1Tag')}</div>
              <h3 className="feature-title">
                {t('feature1Title')}
              </h3>
              <p className="feature-body">
                {t('feature1Desc')}
              </p>
              <ul className="feature-points">
                <li>{t('feature1Point1')}</li>
                <li>{t('feature1Point2')}</li>
                <li>{t('feature1Point3')}</li>
              </ul>
            </div>
            <div className="feature-visual reveal-right">
              <div className="mockup-relances">
                <div className="mock-topbar">
                  <div className="mock-topbar-title">✦ {t('mockTodayFollowups')}</div>
                  <div className="mock-topbar-sub">{t('mock3Prospects')}</div>
                </div>
                <div className="mock-list">
                  <div className="mock-row">
                    <div className="mock-av">ML</div>
                    <div className="mock-info">
                      <div className="mock-name">Marie Leblanc</div>
                      <div className="mock-ai-msg">{t('mockViewed3x')}</div>
                    </div>
                    <span className="mock-urgent urgent-red">🔥 {t('mockNow')}</span>
                  </div>
                  <div className="mock-row">
                    <div className="mock-av b">TM</div>
                    <div className="mock-info">
                      <div className="mock-name">Thomas Moreau</div>
                      <div className="mock-ai-msg">{t('mockNoResponse')}</div>
                    </div>
                    <span className="mock-urgent urgent-amb">⚡ {t('mockToday')}</span>
                  </div>
                  <div className="mock-row">
                    <div className="mock-av c">SC</div>
                    <div className="mock-info">
                      <div className="mock-name">Sophie Curel</div>
                      <div className="mock-ai-msg">{t('mockJustVisited')}</div>
                    </div>
                    <span className="mock-urgent urgent-grn">✓ {t('mockTonight')}</span>
                  </div>
                </div>
                <div className="mock-ai-insight">
                  <span className="ai-spark">✦</span>
                  <div>
                    <div className="ai-ins-label">{t('mockInsightIA')}</div>
                    <div className="ai-ins-text">{t('mockInsightText')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 REMOVED — only one feature block, leedflow-style */}
        </div>
      </section>

      {/* PRICING */}
      <section className="section" id="pricing">
        <div className="container">
          <div className="centered reveal">
            <div className="section-tag">{t('pricingTag')}</div>
            <h2 className="section-title">
              {t('pricingTitle1Line')} {t('pricingTitle2Line')}
            </h2>
            <p className="section-body">{t('pricingSubtitle')}</p>
          </div>
          
          <div className="pricing-grid">
            {/* FREE Plan */}
            <div className="pricing-card pricing-starter reveal-scale stagger-1">
              <div className="plan-name">STARTER</div>
              <div className="price-row">
                <span className="price-amount">{currency === 'EUR' ? '0€' : currency === 'USD' ? '$0' : '£0'}</span>
                <span className="price-period">/{t('pricingMonth')}</span>
              </div>
              <ul className="price-features">
                <li><span className="check-icon">✓</span> {lt.upTo30Prospects}</li>
                <li><span className="check-icon">✓</span> {lt.oneAiSuggestionDay}</li>
                <li><span className="check-icon">✓</span> {lt.taskManagement}</li>
              </ul>
              <button className="btn-secondary full" onClick={() => navigate('/register')}>
                {lt.startFree}
              </button>
            </div>
            
            {/* PRO Plan */}
            <div className="pricing-card pricing-pro reveal-scale stagger-2">
              <div className="popular-badge">{lt.popular}</div>
              <div className="plan-name">PRO</div>
              <div className="price-row">
                <span className="price-amount">{LANDING_PRICING.pro[currency]?.monthly || '9,99€'}</span>
                <span className="price-period">/{t('pricingMonth')}</span>
              </div>
              <ul className="price-features">
                <li><span className="check-icon">✓</span> {lt.unlimitedProspects}</li>
                <li><span className="check-icon">✓</span> {lt.unlimitedAiSuggestions}</li>
                <li><span className="check-icon">✓</span> {lt.oneClickSms}</li>
                <li><span className="check-icon">✓</span> {lt.interactionHistory}</li>
                <li><span className="check-icon">✓</span> {lt.contextualNotes}</li>
              </ul>
              <button className="btn-primary full" onClick={() => navigate('/register', { state: { plan: 'pro' } })}>
                {t('startFreeMonth')} <ArrowRight size={18} />
              </button>
              <p className="pricing-micro">{t('pricingBadge')}</p>
            </div>
            
            {/* PRO+ Plan */}
            <div className="pricing-card pricing-proplus reveal-scale stagger-3">
              <div className="plan-name">PRO+</div>
              <div className="price-row">
                <span className="price-amount">{LANDING_PRICING.pro_plus[currency]?.monthly || '24,99€'}</span>
                <span className="price-period">/{t('pricingMonth')}</span>
              </div>
              <ul className="price-features">
                <li><span className="check-icon">✓</span> {lt.everythingInPro}</li>
                <li><span className="check-icon">🔥</span> {lt.hotLeadsAuto}</li>
                <li><span className="check-icon">📊</span> {lt.commissionTracking}</li>
                <li><span className="check-icon">📧</span> {lt.weeklyEmailReport}</li>
                <li><span className="check-icon">⭐</span> {lt.prioritySupport}</li>
              </ul>
              <button className="btn-secondary full" onClick={() => navigate('/register', { state: { plan: 'pro_plus' } })}>
                {t('startFreeMonth')}
              </button>
            </div>
          </div>
          
          <p className="pricing-note reveal" style={{ textAlign: 'center', marginTop: '24px', color: '#6b7280', fontSize: '14px' }}>
            {t('pricingMicro')}
          </p>

          {/* Team callout — Leedflow-style, links to /business */}
          <div className="team-callout reveal">
            <div className="team-callout-text">
              <div className="team-callout-eyebrow">
                {locale === 'fr' ? 'Vous gérez une entreprise ?' :
                 locale === 'de' ? 'Sie verwalten ein Unternehmen?' :
                 locale === 'it' ? "Gestisci un'azienda?" :
                 'Managing a business?'}
              </div>
              <p className="team-callout-body">
                {locale === 'fr' ? 'Pilotez la performance de vos équipes avec KOLO pour les entreprises.' :
                 locale === 'de' ? 'Verwalten Sie die Leistung Ihrer Teams mit KOLO für Unternehmen.' :
                 locale === 'it' ? 'Gestisci le performance dei tuoi team con KOLO per le aziende.' :
                 'Drive your teams\' performance with KOLO for businesses.'}
              </p>
            </div>
            <button
              className="team-callout-btn"
              onClick={() => navigate('/business')}
              data-testid="pricing-team-callout-btn"
            >
              {locale === 'fr' ? 'Demander une offre' :
               locale === 'de' ? 'Angebot anfordern' :
               locale === 'it' ? 'Richiedi un\'offerta' :
               'Request an offer'}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section section-alt" id="faq">
        <div className="container-sm">
          <div className="centered reveal">
            <div className="section-tag">FAQ</div>
            <h2 className="section-title">
              {t('faqSectionTitle')}
            </h2>
          </div>
          <div className="faq-list reveal">
            {faqs.map((faq, i) => (
              <div className={`faq-item ${expandedFaq === i ? 'open' : ''}`} key={i}>
                <button className="faq-q" onClick={() => toggleFaq(i)}>
                  {faq.q}
                  <span className="faq-icon">{expandedFaq === i ? '−' : '+'}</span>
                </button>
                <div className="faq-a" style={{ maxHeight: expandedFaq === i ? '300px' : '0' }}>
                  <div className="faq-a-inner">{faq.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-final">
        <div className="container">
          <h2 className="cta-title reveal">
            {t('finalCtaTitle1')} <span className="grad-text">{t('finalCtaTitle2')}</span>
          </h2>
          <p className="cta-sub reveal">{t('finalCtaSub')}</p>
          <div className="reveal">
            <button className="btn-final" onClick={() => navigate('/register')}>
              {t('finalCtaBtn')} <ArrowRight size={18} />
            </button>
            <p className="cta-micro">{t('finalCtaMicro')}</p>
            <AppStoreBadge locale={locale} variant="centered" />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <a href="/" className="footer-logo">
              KOLO<span className="logo-dot"></span>
            </a>
            <p className="footer-copy">© 2026 KOLO. {t('footerRights')}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {/* Language selector — moved here from the nav for a cleaner top */}
              <div className="lang-selector" style={{ position: 'relative' }}>
                <button
                  className="lang-btn"
                  onClick={() => { setShowLangMenu(!showLangMenu); setShowCurrencyMenu(false); }}
                  data-testid="footer-lang-btn"
                >
                  <span className="lang-full">{currentLang.label}</span>
                  <span className="lang-short">{locale.toUpperCase()}</span>
                  <ChevronDown size={14} />
                </button>
                {showLangMenu && (
                  <div className="lang-menu" style={{ bottom: '100%', top: 'auto', marginBottom: '6px' }}>
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        className={`lang-option ${lang.code === locale ? 'active' : ''}`}
                        onClick={() => { changeLanguage(lang.code); setShowLangMenu(false); }}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Currency selector — moved here from the nav */}
              <div className="currency-selector" style={{ position: 'relative' }}>
                <button
                  className="currency-btn"
                  onClick={() => { setShowCurrencyMenu(!showCurrencyMenu); setShowLangMenu(false); }}
                  data-testid="footer-currency-btn"
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '13px', fontWeight: '500',
                    cursor: 'pointer', padding: '4px 8px',
                    borderRadius: '6px', display: 'flex',
                    alignItems: 'center', gap: '4px',
                  }}
                >
                  {CURRENCIES.find(c => c.code === currency)?.symbol || '€'}
                  <ChevronDown size={12} />
                </button>
                {showCurrencyMenu && (
                  <div className="currency-menu" style={{
                    position: 'absolute', bottom: '100%', right: 0, marginBottom: '6px',
                    background: '#1a1a24', borderRadius: '8px', padding: '4px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 100, minWidth: '90px',
                  }}>
                    {CURRENCIES.map(curr => (
                      <button
                        key={curr.code}
                        onClick={() => { changeCurrency(curr.code); setShowCurrencyMenu(false); }}
                        style={{
                          display: 'block', width: '100%', padding: '8px 12px',
                          background: currency === curr.code ? 'rgba(108, 99, 255, 0.2)' : 'transparent',
                          border: 'none', borderRadius: '6px',
                          color: currency === curr.code ? '#6C63FF' : '#a0a4ae',
                          fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {curr.symbol} {curr.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowLegalModal(true)}
                className="legal-notice-btn"
              >
                {lt.legalNotice}
              </button>
              <a
                href="/blog"
                className="legal-notice-btn"
                data-testid="footer-blog-link"
                style={{ textDecoration: 'none' }}
              >
                {lt.blogLink}
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* LEGAL MODAL */}
      {showLegalModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => setShowLegalModal(false)}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '700px',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#0E0B1E', margin: 0 }}>
                {lt.legalNotice}
              </h2>
              <button 
                onClick={() => setShowLegalModal(false)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} color="#6b7280" />
              </button>
            </div>
            <div style={{
              padding: '24px',
              overflowY: 'auto',
              fontSize: '14px',
              lineHeight: '1.7',
              color: '#374151'
            }}>
              <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '24px' }}>Last updated: March 31, 2026</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>1. COMPANY INFORMATION</h3>
              <p>KOLO is operated by:</p>
              <p><strong>KOLO.io LTD</strong><br/>124 City Road<br/>London, EC1V 2NX<br/>United Kingdom</p>
              <p>Email: contact@trykolo.io</p>
              <p>KOLO.io LTD is a company incorporated under the laws of England and Wales.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>2. PURPOSE OF THE PLATFORM</h3>
              <p>KOLO is a mobile-first SaaS (Software as a Service) platform designed to help real estate agents and other professionals optimize their workflow through artificial intelligence.</p>
              <p>The platform enables users to manage tasks, prospects, reminders, and business-related data in a structured and efficient environment.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>3. ACCESS AND USE</h3>
              <p>Access to KOLO is restricted to users with an active paid subscription.</p>
              <p>Users agree to:</p>
              <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
                <li>Provide accurate and up-to-date information</li>
                <li>Use the platform in compliance with applicable laws and regulations</li>
                <li>Not misuse, disrupt, or attempt to gain unauthorized access to the system</li>
              </ul>
              <p>KOLO reserves the right to suspend or terminate access in case of violation of these terms.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>4. DATA OWNERSHIP</h3>
              <p>All data entered into KOLO by users — including but not limited to: Prospects, Tasks, Notes, Contacts, Business-related information — remain the sole and exclusive property of the user.</p>
              <p>KOLO does not:</p>
              <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
                <li>Sell user data</li>
                <li>Exploit user data for commercial purposes</li>
                <li>Share user data with third parties for marketing or resale</li>
              </ul>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>5. DATA PRIVACY AND SECURITY</h3>
              <p>Data protection and privacy are core principles of KOLO.</p>
              <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
                <li>All data is hosted on secure servers located in France</li>
                <li>Infrastructure is compliant with the General Data Protection Regulation (GDPR)</li>
                <li>Data is stored on a sovereign, encrypted, and highly secured cloud environment</li>
              </ul>
              <p>KOLO implements industry-standard security measures including data encryption (in transit and at rest), secure authentication mechanisms, and controlled access to infrastructure.</p>
              <p>Despite best efforts, no system can guarantee absolute security. Users acknowledge this inherent limitation.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>6. PAYMENT PROCESSING</h3>
              <p>All payments on KOLO are processed via Stripe, a third-party payment provider.</p>
              <p>KOLO does not store or have access to any banking details and does not process payment information directly.</p>
              <p>Users are encouraged to review Stripe's own legal terms and privacy policies.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>7. INTERNATIONAL OPERATIONS</h3>
              <p>KOLO operates globally, with a primary focus on professionals located in Europe, United Kingdom, United States, and United Arab Emirates.</p>
              <p>Users are responsible for ensuring their use of KOLO complies with their local regulations.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>8. LIABILITY</h3>
              <p>KOLO provides tools designed to assist users in managing their business activities.</p>
              <p>KOLO does not guarantee business results, act as a real estate intermediary, or replace professional judgment.</p>
              <p>KOLO shall not be held liable for business losses, data loss caused by user actions, or service interruptions beyond reasonable control.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>9. INTELLECTUAL PROPERTY</h3>
              <p>All elements of the KOLO platform, including software, design, branding, and content are the exclusive property of KOLO.io LTD, unless otherwise stated.</p>
              <p>Any reproduction, distribution, or unauthorized use is strictly prohibited.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>10. SUPPORT</h3>
              <p>For any inquiries, support requests, or complaints:</p>
              <p>Email: contact@trykolo.io</p>
              <p>KOLO commits to responding as quickly as possible and within a reasonable timeframe.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>11. MODIFICATIONS</h3>
              <p>KOLO reserves the right to update or modify these legal notices at any time.</p>
              <p>Users will be informed of significant changes where applicable. Continued use of the platform constitutes acceptance of the updated terms.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>12. GOVERNING LAW</h3>
              <p>These legal notices are governed by the laws of England and Wales.</p>
              <p>Any disputes shall fall under the jurisdiction of the competent courts in London, United Kingdom.</p>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      <div className={`toast ${showToast ? 'show' : ''}`}>
        📬 {t('toastCheckEmail')}
      </div>
    </div>
  );
};

export default LandingPage;
