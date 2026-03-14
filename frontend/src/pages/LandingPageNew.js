import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import '../styles/landing.css';

const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { locale, changeLanguage } = useLocale();
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
    {
      q: "C'est quoi exactement la différence avec un CRM ?",
      a: "Un CRM comme Salesforce ou Pipedrive est conçu pour des équipes commerciales avec des process complexes. KOLO c'est l'opposé : hyper simple, mobile-first, pensé pour un agent solo qui veut juste ne plus oublier de relancer ses clients. Pas de modules, pas de formation, pas de consultant. Vous êtes opérationnel en 4 minutes."
    },
    {
      q: "Comment fonctionne le mois gratuit ?",
      a: "Vous créez votre compte sans donner de carte bancaire. Vous avez accès à 100% des fonctionnalités pendant 30 jours. À la fin du mois, si vous voulez continuer, vous rentrez votre carte. Si non, votre compte se ferme automatiquement. Aucun prélèvement surprise, aucun engagement."
    },
    {
      q: "Est-ce que je peux importer mes contacts existants ?",
      a: "Oui. En un clic depuis votre carnet d'adresses téléphone. La migration prend moins d'1 minute."
    },
    {
      q: "Mes données sont-elles sécurisées ?",
      a: "Vos données sont hébergées en Europe, chiffrées en transit et au repos, et ne sont jamais vendues ni partagées. KOLO est conforme RGPD. Vous restez propriétaire de vos données et pouvez les exporter ou les supprimer à tout moment."
    },
    {
      q: "Est-ce que ça marche si je suis débutant avec les outils digitaux ?",
      a: "C'est exactement pour ça que KOLO a été créé. Si vous savez utiliser WhatsApp, vous savez utiliser KOLO. L'interface a été pensée pour être utilisée d'une main, entre deux visites, sans aucune formation."
    }
  ];

  const features = [
    { icon: '✓', text: 'Prospects illimités' },
    { icon: '✓', text: 'Suggestions de tâches intelligentes par IA' },
    { icon: '✓', text: 'Pré-rédaction de messages de relance par IA' },
    { icon: '✓', text: 'Suivi client en un coup d\'œil' },
    { icon: '✓', text: 'Import contacts en 1 clic' },
    { icon: '✓', text: 'Accessible depuis n\'importe quel navigateur' },
    { icon: '✓', text: 'Support humain inclus' }
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
              {currentLang.label}
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
            {locale === 'fr' ? 'Connexion' : 'Login'}
          </button>
          <button className="nav-cta" onClick={() => navigate('/register')}>
            {locale === 'fr' ? 'Essayer gratuitement' : 'Try for free'}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="container">
          <div className="hero-eyebrow">
            <span className="eyebrow-dot"></span>
            IA · Mobile · 9,99€/mois
          </div>
          <h1>
            {locale === 'fr' ? (
              <>Suivez chaque client.<br/><span className="grad-text">Signez plus de deals.</span></>
            ) : (
              <>Follow every client.<br/><span className="grad-text">Close more deals.</span></>
            )}
          </h1>
          <p className="hero-sub">
            {locale === 'fr' 
              ? "KOLO remplace vos notes et vos tableurs Excel. L'IA suit vos prospects, planifie vos relances, et vous dit quoi faire ensuite."
              : "KOLO replaces your notes and Excel spreadsheets. AI tracks your prospects, schedules follow-ups, and tells you what to do next."}
          </p>
          <form className="hero-form" onSubmit={handleCTA}>
            <input 
              type="email" 
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="hero-btn-main">
              {locale === 'fr' ? 'Essayer gratuitement' : 'Try for free'} <ArrowRight size={18} />
            </button>
          </form>
          <p className="hero-micro">
            <span>✓ {locale === 'fr' ? '1 mois gratuit' : '1 month free'}</span>
            <span>✓ {locale === 'fr' ? 'Sans carte bancaire' : 'No credit card'}</span>
            <span>✓ {locale === 'fr' ? 'Résiliable à tout moment' : 'Cancel anytime'}</span>
          </p>

          {/* Phone Mockups - Symmetrical */}
          <div className="hero-phones">
            {/* Left Phone - Calendar/Relances */}
            <div className="phone-side left">
              <div className="sp-header-dark">
                <div className="sp-h">🗓 {locale === 'fr' ? 'Relances IA' : 'AI Follow-ups'}</div>
              </div>
              <div className="sp-body">
                <div className="sp-stat">
                  <span className="sp-stat-label">14h00 — {locale === 'fr' ? 'Rappeler' : 'Call'}</span>
                  <span className="sp-stat-val red">Marie L.</span>
                </div>
                <div className="sp-stat">
                  <span className="sp-stat-label">16h30 — SMS</span>
                  <span className="sp-stat-val orange">Thomas M.</span>
                </div>
                <div className="sp-stat">
                  <span className="sp-stat-label">{locale === 'fr' ? 'Demain' : 'Tomorrow'} — Email</span>
                  <span className="sp-stat-val green">Sophie C.</span>
                </div>
              </div>
              <div className="sp-bar-wrap">
                <div className="sp-bar-label">{locale === 'fr' ? 'Deals closés ce mois' : 'Deals closed this month'}</div>
                <div className="sp-bar">
                  <div className="sp-bar-fill" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>

            {/* Main Phone */}
            <div className="phone-main">
              <div className="phone-header">
                <div className="phone-notch"></div>
                <div className="phone-h">{locale === 'fr' ? 'Mes clients' : 'My clients'} ✦</div>
                <div className="phone-sub">{locale === 'fr' ? '3 relances aujourd\'hui' : '3 follow-ups today'}</div>
              </div>
              <div className="phone-body">
                <div className="p-contact">
                  <div className="p-avatar">ML</div>
                  <div>
                    <div className="p-name">Marie Leblanc</div>
                    <div className="p-status">{locale === 'fr' ? 'Visite il y a 4 jours' : 'Visit 4 days ago'}</div>
                  </div>
                  <span className="p-badge hot">🔥 {locale === 'fr' ? 'Urgent' : 'Urgent'}</span>
                </div>
                <div className="p-contact">
                  <div className="p-avatar b">TM</div>
                  <div>
                    <div className="p-name">Thomas Moreau</div>
                    <div className="p-status">{locale === 'fr' ? 'Contacté hier' : 'Contacted yesterday'}</div>
                  </div>
                  <span className="p-badge warm">⚡ {locale === 'fr' ? 'Chaud' : 'Hot'}</span>
                </div>
                <div className="p-contact">
                  <div className="p-avatar c">SC</div>
                  <div>
                    <div className="p-name">Sophie Curel</div>
                    <div className="p-status">{locale === 'fr' ? 'Nouveau prospect' : 'New prospect'}</div>
                  </div>
                  <span className="p-badge ok">✓ {locale === 'fr' ? 'Qualifié' : 'Qualified'}</span>
                </div>
                <div className="p-ai-card">
                  <div className="p-ai-label">✦ {locale === 'fr' ? 'Conseil IA' : 'AI Tip'}</div>
                  <div className="p-ai-text">
                    {locale === 'fr' 
                      ? "Rappeler Marie Leblanc avant 18h pour voir si sa recherche de T2 atypique est toujours d'actualité."
                      : "Call Marie Leblanc before 6pm to check if her search for an atypical T2 is still current."}
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
                  <span className="sp-badge-white">{locale === 'fr' ? 'En cours' : 'Active'}</span>
                </div>
              </div>
              <div className="sp-content">
                <div className="sp-card-mini">
                  <div className="sp-card-label">{locale === 'fr' ? 'Projet' : 'Project'}</div>
                  <div className="sp-card-text">T2 atypique · 60–75m²</div>
                  <div className="sp-card-text muted">Budget : 350 000 €</div>
                </div>
                <div className="sp-stats-mini">
                  <div className="sp-stat-item">
                    <div className="sp-stat-num">3</div>
                    <div className="sp-stat-label-sm">{locale === 'fr' ? 'visites' : 'visits'}</div>
                  </div>
                  <div className="sp-stat-item">
                    <div className="sp-stat-num">18j</div>
                    <div className="sp-stat-label-sm">{locale === 'fr' ? 'en suivi' : 'tracking'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="social-strip">
        <div className="strip-label">{locale === 'fr' ? '+500 agents indépendants font confiance à KOLO' : '+500 independent agents trust KOLO'}</div>
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
            <div className="section-tag">{locale === 'fr' ? 'Le problème' : 'The problem'}</div>
            <h2 className="section-title">
              {locale === 'fr' ? (
                <>On sait comment vous<br/>travaillez <span className="grad-text">aujourd'hui.</span></>
              ) : (
                <>We know how you<br/>work <span className="grad-text">today.</span></>
              )}
            </h2>
            <p className="section-body">
              {locale === 'fr' 
                ? "Les agents indépendants sont bons pour vendre. Pas pour tracker. Le résultat : des prospects qui refroidissent, des relances oubliées, des deals perdus."
                : "Independent agents are good at selling. Not at tracking. The result: prospects that go cold, forgotten follow-ups, lost deals."}
            </p>
          </div>
          <div className="cards-grid">
            <div className="card reveal" style={{ transitionDelay: '0.05s' }}>
              <span className="card-icon">📱</span>
              <div className="card-title">WhatsApp comme CRM</div>
              <p className="card-body">
                {locale === 'fr' 
                  ? "Vous scrollez 10 minutes pour retrouver où en est un client. Entre les messages perso et les discussions pro, c'est un chaos impossible à tenir."
                  : "You scroll for 10 minutes to find where a client stands. Between personal messages and professional discussions, it's impossible chaos."}
              </p>
            </div>
            <div className="card reveal" style={{ transitionDelay: '0.12s' }}>
              <span className="card-icon">📊</span>
              <div className="card-title">{locale === 'fr' ? 'Excel qui prend la poussière' : 'Excel gathering dust'}</div>
              <p className="card-body">
                {locale === 'fr' 
                  ? "Vous aviez créé le tableau parfait. Il y a 3 mois. Depuis, il n'est plus à jour. Rajouter une ligne prend du temps — alors vous ne le faites plus."
                  : "You created the perfect spreadsheet. 3 months ago. Since then, it's not up to date. Adding a line takes time — so you don't anymore."}
              </p>
            </div>
            <div className="card reveal" style={{ transitionDelay: '0.19s' }}>
              <span className="card-icon">🧠</span>
              <div className="card-title">{locale === 'fr' ? 'Tout est dans votre tête' : 'Everything in your head'}</div>
              <p className="card-body">
                {locale === 'fr' 
                  ? "Vous vous souvenez de tout. Jusqu'au jour où vous oubliez de rappeler quelqu'un au bon moment. Ce deal-là, vous ne le reverrez pas."
                  : "You remember everything. Until the day you forget to call someone at the right time. That deal, you won't see again."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="section section-alt" id="features">
        <div className="container">
          <div className="centered reveal">
            <div className="section-tag">{locale === 'fr' ? 'La solution' : 'The solution'}</div>
            <h2 className="section-title">
              {locale === 'fr' ? (
                <>KOLO fait ça <span className="grad-text">à votre place.</span></>
              ) : (
                <>KOLO does it <span className="grad-text">for you.</span></>
              )}
            </h2>
          </div>

          {/* Feature 1 */}
          <div className="feature-block">
            <div className="reveal-left">
              <div className="feature-tag">✦ {locale === 'fr' ? 'Intelligence artificielle' : 'Artificial intelligence'}</div>
              <h3 className="feature-title">
                {locale === 'fr' ? (
                  <>Vos relances,<br/>pilotées par l'IA.</>
                ) : (
                  <>Your follow-ups,<br/>driven by AI.</>
                )}
              </h3>
              <p className="feature-body">
                {locale === 'fr' 
                  ? "L'IA analyse chaque client — sa réactivité, son profil, son historique — et vous dit exactement quand et quoi lui dire. Vous n'avez plus à réfléchir à qui rappeler."
                  : "AI analyzes each client — their responsiveness, profile, history — and tells you exactly when and what to say. You no longer have to think about who to call."}
              </p>
              <ul className="feature-points">
                <li>{locale === 'fr' ? 'Score de priorité en temps réel pour chaque prospect' : 'Real-time priority score for each prospect'}</li>
                <li>{locale === 'fr' ? 'Message suggéré adapté au contexte du client' : 'Suggested message adapted to client context'}</li>
                <li>{locale === 'fr' ? 'Alertes automatiques avant que ça refroidisse' : 'Automatic alerts before it goes cold'}</li>
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
