import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import '../styles/landing.css';

const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'it', label: 'IT' },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { locale, changeLanguage, t } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [email, setEmail] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);

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
          KOLO<span className="logo-dot"></span>
        </a>
        
        <div className="nav-actions">
          {/* Language selector */}
          <div className="lang-selector">
            <button 
              className="lang-btn"
              onClick={() => setShowLangMenu(!showLangMenu)}
            >
              <span className="lang-full">{currentLang.label}</span>
              <span className="lang-short">{locale.toUpperCase()}</span>
              <ChevronDown size={14} />
            </button>
            {showLangMenu && (
              <div className="lang-menu">
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
          
          <button className="nav-pricing" onClick={() => navigate('/pricing')}>
            {t('pricingLink')}
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

      {/* HERO */}
      <section className="hero">
        <div className="container">
          <h1>
            {t('heroTitle1')}<br/><span className="grad-text">{t('heroTitle2')}</span>
          </h1>
          <p className="hero-sub">
            {t('heroSubtitle')}
          </p>
          <form className="hero-form" onSubmit={handleCTA}>
            <input 
              type="email" 
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="hero-btn-main">
              {t('tryForFree')} <ArrowRight size={18} />
            </button>
          </form>
          <p className="hero-micro">
            <span>✓ {t('oneMonthFree')}</span>
            <span>✓ {t('noCreditCard')}</span>
            <span>✓ {t('cancelAnytime')}</span>
          </p>
          <p className="hero-skip-trial">
            <span 
              onClick={() => navigate('/pricing')}
              style={{ 
                cursor: 'pointer',
                textDecoration: 'underline',
                opacity: 0.7
              }}
            >
              {locale === 'fr' ? 'Ou passer directement à l\'abonnement →' :
               locale === 'de' ? 'Oder direkt zum Abo →' :
               locale === 'it' ? 'O passa direttamente all\'abbonamento →' :
               'Or subscribe directly →'}
            </span>
          </p>

          {/* Phone Mockups - Symmetrical */}
          <div className="hero-phones">
            {/* Left Phone - Calendar/Relances */}
            <div className="phone-side left">
              <div className="sp-header-dark">
                <div className="sp-h">🗓 {t('aiFollowups')}</div>
              </div>
              <div className="sp-body">
                <div className="sp-stat">
                  <span className="sp-stat-label">14h00 — {t('callAction')}</span>
                  <span className="sp-stat-val red">Marie L.</span>
                </div>
                <div className="sp-stat">
                  <span className="sp-stat-label">16h30 — SMS</span>
                  <span className="sp-stat-val orange">Thomas M.</span>
                </div>
                <div className="sp-stat">
                  <span className="sp-stat-label">{t('tomorrow')} — Email</span>
                  <span className="sp-stat-val green">Sophie C.</span>
                </div>
              </div>
              <div className="sp-bar-wrap">
                <div className="sp-bar-label">{t('dealsClosedThisMonth')}</div>
                <div className="sp-bar">
                  <div className="sp-bar-fill" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>

            {/* Main Phone */}
            <div className="phone-main">
              <div className="phone-header">
                <div className="phone-notch"></div>
                <div className="phone-h">{t('myClients')} ✦</div>
                <div className="phone-sub">{t('followupsToday')}</div>
              </div>
              <div className="phone-body">
                <div className="p-contact">
                  <div className="p-avatar">ML</div>
                  <div>
                    <div className="p-name">Marie Leblanc</div>
                    <div className="p-status">{t('visitDaysAgo')}</div>
                  </div>
                  <span className="p-badge hot">🔥 {t('urgent')}</span>
                </div>
                <div className="p-contact">
                  <div className="p-avatar b">TM</div>
                  <div>
                    <div className="p-name">Thomas Moreau</div>
                    <div className="p-status">{t('contactedYesterday')}</div>
                  </div>
                  <span className="p-badge warm">⚡ {t('hot')}</span>
                </div>
                <div className="p-contact">
                  <div className="p-avatar c">SC</div>
                  <div>
                    <div className="p-name">Sophie Curel</div>
                    <div className="p-status">{t('newProspectLabel')}</div>
                  </div>
                  <span className="p-badge ok">✓ {t('qualified')}</span>
                </div>
                <div className="p-ai-card">
                  <div className="p-ai-label">✦ {t('aiTip')}</div>
                  <div className="p-ai-text">
                    {t('aiTipExample')}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Phone - Prospect Details (same style as left) */}
            <div className="phone-side right">
              <div className="sp-header-grad">
                <div className="sp-profile">
                  <div className="sp-avatar">ML</div>
                  <div>
                    <div className="sp-name">Marie Leblanc</div>
                    <div className="sp-location">📍 Paris 15e</div>
                  </div>
                  <span className="sp-badge-white">{t('active')}</span>
                </div>
              </div>
              <div className="sp-content">
                <div className="sp-card-mini">
                  <div className="sp-card-label">{t('project')}</div>
                  <div className="sp-card-text">T2 atypique · 60–75m²</div>
                  <div className="sp-card-text muted">Budget : 350 000 €</div>
                </div>
                <div className="sp-stats-mini">
                  <div className="sp-stat-item">
                    <div className="sp-stat-num">3</div>
                    <div className="sp-stat-label-sm">{t('visits')}</div>
                  </div>
                  <div className="sp-stat-item">
                    <div className="sp-stat-num">18j</div>
                    <div className="sp-stat-label-sm">{t('tracking')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="social-strip">
        <div className="strip-label">{t('socialProof')}</div>
        <div className="marquee-track">
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "J'ai closé 2 ventes en plus ce mois-ci" — Julie R., Paris 15e
          </span>
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "Mon Excel prend la poussière depuis 3 mois" — Marc T., Lyon
          </span>
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "L'IA me dit exactement quand rappeler, c'est magique" — Amira K., Bordeaux
          </span>
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "Je pensais pas qu'un outil à 10€ ferait ça" — Pierre M., Nantes
          </span>
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "Setup en 4 minutes, premier deal assisté le lendemain" — Lucie B., Toulouse
          </span>
          {/* Duplicate for seamless loop */}
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "J'ai closé 2 ventes en plus ce mois-ci" — Julie R., Paris 15e
          </span>
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "Mon Excel prend la poussière depuis 3 mois" — Marc T., Lyon
          </span>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="section">
        <div className="container">
          <div className="centered reveal">
            <div className="section-tag">{t('theProblem')}</div>
            <h2 className="section-title">
              {t('problemTitle1')}<br/><span className="grad-text">{t('problemTitle2')}</span>
            </h2>
            <p className="section-body">
              {t('problemDesc')}
            </p>
          </div>
          <div className="cards-grid">
            <div className="card reveal-scale stagger-1">
              <span className="card-icon">📱</span>
              <div className="card-title">{t('problemCard1Title')}</div>
              <p className="card-body">
                {t('problemCard1Desc')}
              </p>
            </div>
            <div className="card reveal-scale stagger-2">
              <span className="card-icon">📊</span>
              <div className="card-title">{t('problemCard2Title')}</div>
              <p className="card-body">
                {t('problemCard2Desc')}
              </p>
            </div>
            <div className="card reveal-scale stagger-3">
              <span className="card-icon">🧠</span>
              <div className="card-title">{t('problemCard3Title')}</div>
              <p className="card-body">
                {t('problemCard3Desc')}
              </p>
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
              {t('solutionTitle1')} <span className="grad-text">{t('solutionTitle2')}</span>
            </h2>
          </div>

          {/* Feature 1 */}
          <div className="feature-block">
            <div className="reveal-left">
              <div className="feature-tag">✦ {t('feature1Tag')}</div>
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

          {/* Feature 2 */}
          <div className="feature-block reverse">
            <div className="reveal-right">
              <div className="feature-tag">📱 {t('feature2TagMobile')}</div>
              <h3 className="feature-title">
                {t('feature2TitleSwipe1')}<br/>{t('feature2TitleSwipe2')}
              </h3>
              <p className="feature-body">{t('feature2DescSwipe')}</p>
              <ul className="feature-points">
                <li>{t('feature2Point1Swipe')}</li>
                <li>{t('feature2Point2Swipe')}</li>
                <li>{t('feature2Point3Swipe')}</li>
              </ul>
            </div>
            <div className="feature-visual reveal-left">
              <div className="mockup-swipe">
                <div className="swipe-header">{t('mockYourDay')}</div>
                <div className="swipe-card-active">
                  <div className="swipe-card-top">
                    <div className="swipe-av">ML</div>
                    <div>
                      <div className="swipe-name">Marie Leblanc</div>
                      <div className="swipe-meta">{t('mockVisit')}</div>
                    </div>
                    <span className="swipe-badge">🔥 {t('mockNow')}</span>
                  </div>
                  <div className="swipe-action">
                    Swipe → · {t('mockVisitDone')} ✓
                  </div>
                </div>
                <div className="swipe-done-list">
                  <div className="swipe-done">
                    <span>✅</span>
                    <span>{t('mockCallThomas')} <span className="muted">{t('mockDoneAt11')}</span></span>
                  </div>
                  <div className="swipe-done">
                    <span>✅</span>
                    <span>SMS Sophie C. <span className="muted">{t('mockDoneAt9')}</span></span>
                  </div>
                </div>
                <div className="swipe-tip">
                  <span>👆</span>
                  <div>
                    <div className="swipe-tip-title">{t('mockOneGesture')}</div>
                    <div className="swipe-tip-text">{t('mockSwipeToValidate')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="section" id="pricing">
        <div className="container">
          <div className="centered reveal">
            <div className="section-tag">{t('pricingTag')}</div>
            <h2 className="section-title">
              {t('pricingTitle1Line')} <span className="grad-text">{t('pricingTitle2Line')}</span>
            </h2>
            <p className="section-body">{t('pricingSubtitle')}</p>
          </div>
          
          <div className="pricing-grid">
            {/* FREE Plan */}
            <div className="pricing-card pricing-starter reveal-scale stagger-1">
              <div className="plan-name">STARTER</div>
              <div className="price-row">
                <span className="price-amount">0€</span>
                <span className="price-period">/{t('pricingMonth')}</span>
              </div>
              <ul className="price-features">
                <li><span className="check-icon">✓</span> {locale === 'fr' ? "Jusqu'à 30 prospects" : "Up to 30 prospects"}</li>
                <li><span className="check-icon">✓</span> {locale === 'fr' ? "1 suggestion IA/jour" : "1 AI suggestion/day"}</li>
                <li><span className="check-icon">✓</span> {locale === 'fr' ? "Gestion des tâches" : "Task management"}</li>
              </ul>
              <button className="btn-secondary full" onClick={() => navigate('/register')}>
                {locale === 'fr' ? 'Commencer gratuitement' : 'Start for free'}
              </button>
            </div>
            
            {/* PRO Plan */}
            <div className="pricing-card pricing-pro reveal-scale stagger-2">
              <div className="popular-badge">{locale === 'fr' ? 'Populaire' : 'Popular'}</div>
              <div className="plan-name">PRO</div>
              <div className="price-row">
                <span className="price-amount">{locale === 'fr' ? '9,99€' : '€9.99'}</span>
                <span className="price-period">/{t('pricingMonth')}</span>
              </div>
              <ul className="price-features">
                <li><span className="check-icon">✓</span> {locale === 'fr' ? "Prospects illimités" : "Unlimited prospects"}</li>
                <li><span className="check-icon">✓</span> {locale === 'fr' ? "Suggestions IA illimitées" : "Unlimited AI suggestions"}</li>
                <li><span className="check-icon">✓</span> {locale === 'fr' ? "SMS 1-clic IA" : "1-click AI SMS"}</li>
                <li><span className="check-icon">✓</span> {locale === 'fr' ? "Historique des interactions" : "Interaction history"}</li>
                <li><span className="check-icon">✓</span> {locale === 'fr' ? "Notes contextuelles" : "Contextual notes"}</li>
              </ul>
              <button className="btn-primary full" onClick={() => navigate('/register')}>
                {t('startFreeMonth')} <ArrowRight size={18} />
              </button>
              <p className="pricing-micro">{t('pricingBadge')}</p>
            </div>
            
            {/* PRO+ Plan */}
            <div className="pricing-card pricing-proplus reveal-scale stagger-3">
              <div className="plan-name">PRO+</div>
              <div className="price-row">
                <span className="price-amount">{locale === 'fr' ? '24,99€' : '€24.99'}</span>
                <span className="price-period">/{t('pricingMonth')}</span>
              </div>
              <ul className="price-features">
                <li><span className="check-icon">✓</span> {locale === 'fr' ? "Tout ce qui est dans PRO" : "Everything in PRO"}</li>
                <li><span className="check-icon">🔥</span> {locale === 'fr' ? "Prospects chauds identifiés auto" : "Hot leads auto-identified"}</li>
                <li><span className="check-icon">📊</span> {locale === 'fr' ? "Suivi de vos commissions" : "Commission tracking"}</li>
                <li><span className="check-icon">📧</span> {locale === 'fr' ? "Rapport hebdo par email" : "Weekly email report"}</li>
                <li><span className="check-icon">⭐</span> {locale === 'fr' ? "Support prioritaire" : "Priority support"}</li>
              </ul>
              <button className="btn-secondary full" onClick={() => navigate('/register')}>
                {t('startFreeMonth')}
              </button>
            </div>
          </div>
          
          <p className="pricing-note reveal" style={{ textAlign: 'center', marginTop: '24px', color: '#6b7280', fontSize: '14px' }}>
            {t('pricingMicro')}
          </p>
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
            {t('finalCtaTitle1')}<br/><span className="grad-text">{t('finalCtaTitle2')}</span>
          </h2>
          <p className="cta-sub reveal">{t('finalCtaSub')}</p>
          <div className="reveal">
            <button className="btn-final" onClick={() => navigate('/register')}>
              {t('finalCtaBtn')} <ArrowRight size={18} />
            </button>
            <p className="cta-micro">{t('finalCtaMicro')}</p>
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
            <button 
              onClick={() => setShowLegalModal(true)}
              className="legal-notice-btn"
            >
              {locale === 'fr' ? 'Mentions légales' : 'Legal Notice'}
            </button>
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
                {locale === 'fr' ? 'Mentions Légales' : 'Legal Notice'}
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
