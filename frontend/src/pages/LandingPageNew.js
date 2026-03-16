import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react';
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

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Reveal animation on scroll
  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });
    
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
          <div className="hero-eyebrow">
            <span className="eyebrow-dot"></span>
            {t('heroEyebrow')}
          </div>
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
            <div className="card reveal" style={{ transitionDelay: '0.05s' }}>
              <span className="card-icon">📱</span>
              <div className="card-title">{t('problemCard1Title')}</div>
              <p className="card-body">
                {t('problemCard1Desc')}
              </p>
            </div>
            <div className="card reveal" style={{ transitionDelay: '0.12s' }}>
              <span className="card-icon">📊</span>
              <div className="card-title">{t('problemCard2Title')}</div>
              <p className="card-body">
                {t('problemCard2Desc')}
              </p>
            </div>
            <div className="card reveal" style={{ transitionDelay: '0.19s' }}>
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
                  <div className="mock-topbar-title">✦ {locale === 'fr' ? 'Relances du jour' : 'Today\'s follow-ups'}</div>
                  <div className="mock-topbar-sub">{locale === 'fr' ? '3 prospects à contacter — triés par urgence' : '3 prospects to contact — sorted by urgency'}</div>
                </div>
                <div className="mock-list">
                  <div className="mock-row">
                    <div className="mock-av">ML</div>
                    <div className="mock-info">
                      <div className="mock-name">Marie Leblanc</div>
                      <div className="mock-ai-msg">{locale === 'fr' ? 'A consulté l\'annonce 3x ce matin — fenêtre de closing ouverte' : 'Viewed the listing 3x this morning — closing window open'}</div>
                    </div>
                    <span className="mock-urgent urgent-red">🔥 {locale === 'fr' ? 'Maintenant' : 'Now'}</span>
                  </div>
                  <div className="mock-row">
                    <div className="mock-av b">TM</div>
                    <div className="mock-info">
                      <div className="mock-name">Thomas Moreau</div>
                      <div className="mock-ai-msg">{locale === 'fr' ? 'Pas de retour depuis 5 jours — relancer avec offre alternative' : 'No response for 5 days — follow up with alternative offer'}</div>
                    </div>
                    <span className="mock-urgent urgent-amb">⚡ {locale === 'fr' ? 'Aujourd\'hui' : 'Today'}</span>
                  </div>
                  <div className="mock-row">
                    <div className="mock-av c">SC</div>
                    <div className="mock-info">
                      <div className="mock-name">Sophie Curel</div>
                      <div className="mock-ai-msg">{locale === 'fr' ? 'Vient de visiter — envoyer récapitulatif + disponibilités' : 'Just visited — send summary + availability'}</div>
                    </div>
                    <span className="mock-urgent urgent-grn">✓ {locale === 'fr' ? 'Ce soir' : 'Tonight'}</span>
                  </div>
                </div>
                <div className="mock-ai-insight">
                  <span className="ai-spark">✦</span>
                  <div>
                    <div className="ai-ins-label">Insight IA</div>
                    <div className="ai-ins-text">
                      {locale === 'fr' 
                        ? "Marie Leblanc a 87% de probabilité de signer cette semaine. Ne laissez pas passer cette fenêtre."
                        : "Marie Leblanc has 87% probability of signing this week. Don't let this window pass."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="feature-block reverse">
            <div className="reveal-right">
              <div className="feature-tag">📱 Mobile first</div>
              <h3 className="feature-title">
                {locale === 'fr' ? (
                  <>Swipez votre journée.<br/>D'une main.</>
                ) : (
                  <>Swipe your day.<br/>One-handed.</>
                )}
              </h3>
              <p className="feature-body">
                {locale === 'fr' 
                  ? "Vous sortez d'une visite, vous glissez le contact vers la droite — c'est marqué comme fait, et la tâche suivante s'affiche. Votre journée avance toute seule, sans rien taper."
                  : "You leave a visit, swipe the contact right — it's marked as done, and the next task appears. Your day moves forward on its own, without typing."}
              </p>
              <ul className="feature-points">
                <li>{locale === 'fr' ? 'Glissez vers la droite pour valider une action en une seconde' : 'Swipe right to validate an action in one second'}</li>
                <li>{locale === 'fr' ? 'La prochaine tâche s\'affiche automatiquement' : 'The next task appears automatically'}</li>
                <li>{locale === 'fr' ? 'Zéro saisie — juste un geste, et c\'est dans l\'historique' : 'Zero typing — just a gesture, and it\'s in the history'}</li>
              </ul>
            </div>
            <div className="feature-visual reveal-left">
              <div className="mockup-swipe">
                <div className="swipe-header">{locale === 'fr' ? 'Votre journée · 1 action restante' : 'Your day · 1 action left'}</div>
                <div className="swipe-card-active">
                  <div className="swipe-card-top">
                    <div className="swipe-av">ML</div>
                    <div>
                      <div className="swipe-name">Marie Leblanc</div>
                      <div className="swipe-meta">{locale === 'fr' ? 'Visite · 14h30 · Rue Lecourbe' : 'Visit · 2:30pm · Rue Lecourbe'}</div>
                    </div>
                    <span className="swipe-badge">🔥 {locale === 'fr' ? 'Maintenant' : 'Now'}</span>
                  </div>
                  <div className="swipe-action">
                    Swipe → · {locale === 'fr' ? 'Visite faite' : 'Visit done'} ✓
                  </div>
                </div>
                <div className="swipe-done-list">
                  <div className="swipe-done">
                    <span>✅</span>
                    <span>{locale === 'fr' ? 'Appel Thomas M.' : 'Call Thomas M.'} <span className="muted">{locale === 'fr' ? '· fait à 11h02' : '· done at 11:02'}</span></span>
                  </div>
                  <div className="swipe-done">
                    <span>✅</span>
                    <span>SMS Sophie C. <span className="muted">{locale === 'fr' ? '· fait à 9h47' : '· done at 9:47'}</span></span>
                  </div>
                </div>
                <div className="swipe-tip">
                  <span>👆</span>
                  <div>
                    <div className="swipe-tip-title">{locale === 'fr' ? 'Un geste, c\'est fait' : 'One gesture, done'}</div>
                    <div className="swipe-tip-text">{locale === 'fr' ? 'Swipe → pour valider. L\'historique se met à jour automatiquement.' : 'Swipe → to validate. History updates automatically.'}</div>
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
            <div className="section-tag">{locale === 'fr' ? 'Tarif' : 'Pricing'}</div>
            <h2 className="section-title">
              {locale === 'fr' ? (
                <>Un prix. <span className="grad-text">Zéro surprise.</span></>
              ) : (
                <>One price. <span className="grad-text">Zero surprises.</span></>
              )}
            </h2>
            <p className="section-body">
              {locale === 'fr' 
                ? "Pas de formule bronze/argent/or. Pas de piège. Tout est inclus dès le premier euro."
                : "No bronze/silver/gold plans. No traps. Everything included from day one."}
            </p>
          </div>
          <div className="pricing-wrap reveal">
            <div className="pricing-card">
              <div className="pricing-badge">✓ {locale === 'fr' ? '1 mois offert, sans CB' : '1 month free, no card'}</div>
              <div className="price-row">
                <span className="price-amount">9,99€</span>
                <span className="price-period">/{locale === 'fr' ? 'mois' : 'month'}</span>
              </div>
              <p className="price-tagline">{locale === 'fr' ? 'Tout inclus · Sans engagement · Résiliable en 2 clics' : 'All included · No commitment · Cancel in 2 clicks'}</p>
              <ul className="price-features">
                {features.map((f, i) => (
                  <li key={i}>
                    <span className="check-icon">{f.icon}</span>
                    {f.text}
                  </li>
                ))}
              </ul>
              <button className="btn-primary full" onClick={() => navigate('/register')}>
                {locale === 'fr' ? 'Commencer gratuitement' : 'Start for free'} <ArrowRight size={18} />
              </button>
              <p className="pricing-micro">{locale === 'fr' ? 'Sans carte bancaire · Accès complet dès l\'inscription' : 'No credit card · Full access from signup'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section section-alt" id="faq">
        <div className="container-sm">
          <div className="centered reveal">
            <div className="section-tag">FAQ</div>
            <h2 className="section-title">
              {locale === 'fr' ? (
                <>Questions <span className="grad-text">fréquentes.</span></>
              ) : (
                <>Frequently <span className="grad-text">asked.</span></>
              )}
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
            {locale === 'fr' ? (
              <>Votre prochain deal<br/><span className="grad-text">commence ici.</span></>
            ) : (
              <>Your next deal<br/><span className="grad-text">starts here.</span></>
            )}
          </h2>
          <p className="cta-sub reveal">{locale === 'fr' ? 'Rejoignez les agents qui closent plus, sans travailler plus.' : 'Join agents who close more, without working more.'}</p>
          <div className="reveal">
            <button className="btn-final" onClick={() => navigate('/register')}>
              {locale === 'fr' ? 'Démarrer — 1 mois gratuit' : 'Start — 1 month free'} <ArrowRight size={18} />
            </button>
            <p className="cta-micro">{locale === 'fr' ? 'Sans carte bancaire · Accès complet en 2 minutes' : 'No credit card · Full access in 2 minutes'}</p>
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
            <p className="footer-copy">© 2026 KOLO. {locale === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
          </div>
        </div>
      </footer>

      {/* TOAST */}
      <div className={`toast ${showToast ? 'show' : ''}`}>
        📬 {locale === 'fr' ? 'Vérifiez votre boîte mail — à tout de suite !' : 'Check your email — see you soon!'}
      </div>
    </div>
  );
};

export default LandingPage;
