import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ChevronUp, Menu, X } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import '../styles/landing.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const { locale, changeLanguage } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [email, setEmail] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

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
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
      setTimeout(() => navigate('/register', { state: { email } }), 1500);
    } else {
      navigate('/register');
    }
  };

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "C'est quoi exactement la difference avec un CRM ?",
      a: "Un CRM comme Salesforce ou Pipedrive est concu pour des equipes commerciales avec des process complexes. KOLO c'est l'oppose : hyper simple, mobile-first, pense pour un agent solo qui veut juste ne plus oublier de relancer ses clients. Pas de modules, pas de formation, pas de consultant. Vous etes operationnel en 4 minutes."
    },
    {
      q: "Comment fonctionne le mois gratuit ?",
      a: "Vous creez votre compte sans donner de carte bancaire. Vous avez acces a 100% des fonctionnalites pendant 30 jours. A la fin du mois, si vous voulez continuer, vous rentrez votre carte. Si non, votre compte se ferme automatiquement. Aucun prelevement surprise, aucun engagement."
    },
    {
      q: "Est-ce que je peux importer mes contacts existants ?",
      a: "Oui. En un clic depuis votre carnet d'adresses telephone. La migration prend moins d'1 minute."
    },
    {
      q: "Mes donnees sont-elles securisees ?",
      a: "Vos donnees sont hebergees en Europe, chiffrees en transit et au repos, et ne sont jamais vendues ni partagees. KOLO est conforme RGPD. Vous restez proprietaire de vos donnees et pouvez les exporter ou les supprimer a tout moment."
    },
    {
      q: "Est-ce que ca marche si je suis debutant avec les outils digitaux ?",
      a: "C'est exactement pour ca que KOLO a ete cree. Si vous savez utiliser WhatsApp, vous savez utiliser KOLO. L'interface a ete pensee pour etre utilisee d'une main, entre deux visites, sans aucune formation."
    }
  ];

  const features = [
    { icon: '✓', text: 'Prospects illimites' },
    { icon: '✓', text: 'Suggestions de taches intelligentes par IA' },
    { icon: '✓', text: 'Pre-redaction de messages de relance par IA' },
    { icon: '✓', text: 'Suivi client en un coup d\'oeil' },
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

      {/* NAVBAR */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <a href="/" className="nav-logo">
          KOLO<span className="logo-dot"></span>
        </a>
        
        <div className="nav-links desktop-only">
          <a href="#features">Fonctionnalites</a>
          <a href="#pricing">Tarif</a>
          <a href="#faq">FAQ</a>
        </div>
        
        <div className="nav-actions">
          <button className="nav-login desktop-only" onClick={() => navigate('/login')}>
            Connexion
          </button>
          <button className="nav-cta" onClick={() => navigate('/register')}>
            Essayer gratuit
          </button>
          <button className="mobile-menu-btn mobile-only" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenu && (
        <div className="mobile-menu">
          <a href="#features" onClick={() => setMobileMenu(false)}>Fonctionnalites</a>
          <a href="#pricing" onClick={() => setMobileMenu(false)}>Tarif</a>
          <a href="#faq" onClick={() => setMobileMenu(false)}>FAQ</a>
          <button onClick={() => { navigate('/login'); setMobileMenu(false); }}>Connexion</button>
        </div>
      )}

      {/* HERO */}
      <section className="hero">
        <div className="container">
          <div className="hero-eyebrow">
            <span className="eyebrow-dot"></span>
            IA · Mobile · 9,99€/mois
          </div>
          <h1>
            Suivez chaque client.<br/>
            <span className="grad-text">Signez plus de deals.</span>
          </h1>
          <p className="hero-sub">
            KOLO remplace vos notes et vos tableurs Excel. L'IA suit vos prospects, 
            vous rappelle les relances, et vous dit quoi faire ensuite.
          </p>
          <form className="hero-form" onSubmit={handleCTA}>
            <input 
              type="email" 
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="hero-btn-main">
              Demarrer — c'est gratuit <ArrowRight size={18} />
            </button>
          </form>
          <p className="hero-micro">
            <span>1 mois gratuit</span>
            <span>Sans carte bancaire</span>
            <span>Resiliable a tout moment</span>
          </p>

          {/* Phone Mockups */}
          <div className="hero-phones">
            {/* Left Phone - Prospect Details */}
            <div className="phone-secondary left">
              <div className="sp-header gradient">
                <div className="sp-profile">
                  <div className="sp-avatar">ML</div>
                  <div>
                    <div className="sp-name">Marie Leblanc</div>
                    <div className="sp-location">📍 Paris 15e</div>
                  </div>
                  <span className="sp-badge">En cours</span>
                </div>
              </div>
              <div className="sp-content">
                <div className="sp-card">
                  <div className="sp-card-label">Projet</div>
                  <div className="sp-card-text">T2 atypique · 60–75m²</div>
                  <div className="sp-card-text muted">Budget : 350 000 €</div>
                  <div className="sp-card-text muted">Paris 14–15e · Lumineux</div>
                </div>
                <div className="sp-card">
                  <div className="sp-card-label">Historique</div>
                  <div className="sp-timeline">
                    <div className="sp-timeline-item">
                      <span className="dot green"></span>
                      Appel decouverte · 3 jan
                    </div>
                    <div className="sp-timeline-item">
                      <span className="dot blue"></span>
                      Visite rue Lecourbe · 10 jan
                    </div>
                    <div className="sp-timeline-item">
                      <span className="dot orange"></span>
                      Contre-offre envoyee · 14 jan
                    </div>
                  </div>
                </div>
                <div className="sp-stats">
                  <div className="sp-stat-item">
                    <div className="sp-stat-num">3</div>
                    <div className="sp-stat-label">visites</div>
                  </div>
                  <div className="sp-stat-item">
                    <div className="sp-stat-num">18j</div>
                    <div className="sp-stat-label">en suivi</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Phone */}
            <div className="phone-main">
              <div className="phone-header">
                <div className="phone-notch"></div>
                <div className="phone-h">Mes clients ✦</div>
                <div className="phone-sub">3 relances aujourd'hui</div>
              </div>
              <div className="phone-body">
                <div className="p-contact">
                  <div className="p-avatar">ML</div>
                  <div>
                    <div className="p-name">Marie Leblanc</div>
                    <div className="p-status">Visite il y a 4 jours</div>
                  </div>
                  <span className="p-badge hot">🔥 Urgent</span>
                </div>
                <div className="p-contact">
                  <div className="p-avatar b">TM</div>
                  <div>
                    <div className="p-name">Thomas Moreau</div>
                    <div className="p-status">Contacte hier</div>
                  </div>
                  <span className="p-badge warm">⚡ Chaud</span>
                </div>
                <div className="p-contact">
                  <div className="p-avatar c">SC</div>
                  <div>
                    <div className="p-name">Sophie Curel</div>
                    <div className="p-status">Nouveau prospect</div>
                  </div>
                  <span className="p-badge ok">✓ Qualifie</span>
                </div>
                <div className="p-ai-card">
                  <div className="p-ai-label">✦ Conseil IA</div>
                  <div className="p-ai-text">
                    Rappeler Marie Leblanc avant 18h pour voir si sa recherche 
                    de T2 atypique est toujours d'actualite.
                  </div>
                </div>
              </div>
            </div>

            {/* Right Phone - Calendar */}
            <div className="phone-secondary right">
              <div className="sp-header">
                <div className="sp-h">🗓 Relances IA</div>
              </div>
              <div className="sp-body">
                <div className="sp-stat">
                  <span className="sp-stat-label">14h00 — Rappeler</span>
                  <span className="sp-stat-val red">Marie L.</span>
                </div>
                <div className="sp-stat">
                  <span className="sp-stat-label">16h30 — SMS</span>
                  <span className="sp-stat-val orange">Thomas M.</span>
                </div>
                <div className="sp-stat">
                  <span className="sp-stat-label">Demain — Email</span>
                  <span className="sp-stat-val green">Sophie C.</span>
                </div>
              </div>
              <div className="sp-bar-wrap">
                <div className="sp-bar-label">Deals closes ce mois</div>
                <div className="sp-bar">
                  <div className="sp-bar-fill" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="social-strip">
        <div className="strip-label">+500 agents independants font confiance a KOLO</div>
        <div className="marquee-track">
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "J'ai close 2 ventes en plus ce mois-ci" — Julie R., Paris 15e
          </span>
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "Mon Excel prend la poussiere depuis 3 mois" — Marc T., Lyon
          </span>
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "L'IA me dit exactement quand rappeler, c'est magique" — Amira K., Bordeaux
          </span>
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "Je pensais pas qu'un outil a 10€ ferait ca" — Pierre M., Nantes
          </span>
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "Setup en 4 minutes, premier deal assiste le lendemain" — Lucie B., Toulouse
          </span>
          {/* Duplicate for seamless loop */}
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "J'ai close 2 ventes en plus ce mois-ci" — Julie R., Paris 15e
          </span>
          <span className="marquee-item">
            <span className="marquee-stars">★★★★★</span> "Mon Excel prend la poussiere depuis 3 mois" — Marc T., Lyon
          </span>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="section">
        <div className="container">
          <div className="centered reveal">
            <div className="section-tag">Le probleme</div>
            <h2 className="section-title">
              On sait comment vous<br/>travaillez <span className="grad-text">aujourd'hui.</span>
            </h2>
            <p className="section-body">
              Les agents independants sont bons pour vendre. Pas pour tracker. 
              Le resultat : des prospects qui refroidissent, des relances oubliees, des deals perdus.
            </p>
          </div>
          <div className="cards-grid">
            <div className="card reveal" style={{ transitionDelay: '0.05s' }}>
              <span className="card-icon">📱</span>
              <div className="card-title">WhatsApp comme CRM</div>
              <p className="card-body">
                Vous scrollez 10 minutes pour retrouver ou en est un client. 
                Entre les messages perso et les discussions pro, c'est un chaos impossible a tenir.
              </p>
            </div>
            <div className="card reveal" style={{ transitionDelay: '0.12s' }}>
              <span className="card-icon">📊</span>
              <div className="card-title">Excel qui prend la poussiere</div>
              <p className="card-body">
                Vous aviez cree le tableau parfait. Il y a 3 mois. 
                Depuis, il n'est plus a jour. Rajouter une ligne prend du temps — alors vous ne le faites plus.
              </p>
            </div>
            <div className="card reveal" style={{ transitionDelay: '0.19s' }}>
              <span className="card-icon">🧠</span>
              <div className="card-title">Tout est dans votre tete</div>
              <p className="card-body">
                Vous vous souvenez de tout. Jusqu'au jour ou vous oubliez de rappeler quelqu'un 
                au bon moment. Ce deal-la, vous ne le reverrez pas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="section section-alt" id="features">
        <div className="container">
          <div className="centered reveal">
            <div className="section-tag">La solution</div>
            <h2 className="section-title">
              KOLO fait ca <span className="grad-text">a votre place.</span>
            </h2>
          </div>

          {/* Feature 1 */}
          <div className="feature-block">
            <div className="reveal-left">
              <div className="feature-tag">✦ Intelligence artificielle</div>
              <h3 className="feature-title">Vos relances,<br/>pilotees par l'IA.</h3>
              <p className="feature-body">
                L'IA analyse chaque client — sa reactivite, son profil, son historique — 
                et vous dit exactement quand et quoi lui dire. Vous n'avez plus a reflechir a qui rappeler.
              </p>
              <ul className="feature-points">
                <li>Score de priorite en temps reel pour chaque prospect</li>
                <li>Message suggere adapte au contexte du client</li>
                <li>Alertes automatiques avant que ca refroidisse</li>
              </ul>
            </div>
            <div className="feature-visual reveal-right">
              <div className="mockup-relances">
                <div className="mock-topbar">
                  <div className="mock-topbar-title">✦ Relances du jour</div>
                  <div className="mock-topbar-sub">3 prospects a contacter — tries par urgence</div>
                </div>
                <div className="mock-list">
                  <div className="mock-row">
                    <div className="mock-av">ML</div>
                    <div className="mock-info">
                      <div className="mock-name">Marie Leblanc</div>
                      <div className="mock-ai-msg">A consulte l'annonce 3x ce matin — fenetre de closing ouverte</div>
                    </div>
                    <span className="mock-urgent urgent-red">🔥 Maintenant</span>
                  </div>
                  <div className="mock-row">
                    <div className="mock-av b">TM</div>
                    <div className="mock-info">
                      <div className="mock-name">Thomas Moreau</div>
                      <div className="mock-ai-msg">Pas de retour depuis 5 jours — relancer avec offre alternative</div>
                    </div>
                    <span className="mock-urgent urgent-amb">⚡ Aujourd'hui</span>
                  </div>
                  <div className="mock-row">
                    <div className="mock-av c">SC</div>
                    <div className="mock-info">
                      <div className="mock-name">Sophie Curel</div>
                      <div className="mock-ai-msg">Vient de visiter — envoyer recapitulatif + disponibilites</div>
                    </div>
                    <span className="mock-urgent urgent-grn">✓ Ce soir</span>
                  </div>
                </div>
                <div className="mock-ai-insight">
                  <span className="ai-spark">✦</span>
                  <div>
                    <div className="ai-ins-label">Insight IA</div>
                    <div className="ai-ins-text">
                      Marie Leblanc a 87% de probabilite de signer cette semaine. 
                      Ne laissez pas passer cette fenetre.
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
              <h3 className="feature-title">Swipez votre journee.<br/>En une main.</h3>
              <p className="feature-body">
                Vous sortez d'une visite, vous swipez le contact vers la droite — 
                c'est marque comme fait, et la tache suivante s'affiche. Votre journee avance toute seule, sans rien taper.
              </p>
              <ul className="feature-points">
                <li>Swipe droite pour valider une action en une seconde</li>
                <li>La prochaine tache s'affiche automatiquement</li>
                <li>Zero saisie — juste un geste, et c'est dans l'historique</li>
              </ul>
            </div>
            <div className="feature-visual reveal-left">
              <div className="mockup-swipe">
                <div className="swipe-header">Votre journee · 1 action restante</div>
                <div className="swipe-card-active">
                  <div className="swipe-card-top">
                    <div className="swipe-av">ML</div>
                    <div>
                      <div className="swipe-name">Marie Leblanc</div>
                      <div className="swipe-meta">Visite · 14h30 · Rue Lecourbe</div>
                    </div>
                    <span className="swipe-badge">🔥 Maintenant</span>
                  </div>
                  <div className="swipe-action">
                    Swipe → · Visite faite ✓
                  </div>
                </div>
                <div className="swipe-done-list">
                  <div className="swipe-done">
                    <span>✅</span>
                    <span>Appel Thomas M. <span className="muted">· fait a 11h02</span></span>
                  </div>
                  <div className="swipe-done">
                    <span>✅</span>
                    <span>SMS Sophie C. <span className="muted">· fait a 9h47</span></span>
                  </div>
                </div>
                <div className="swipe-tip">
                  <span>👆</span>
                  <div>
                    <div className="swipe-tip-title">Un geste, c'est fait</div>
                    <div className="swipe-tip-text">Swipe → pour valider. L'historique se met a jour automatiquement.</div>
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
            <div className="section-tag">Tarif</div>
            <h2 className="section-title">
              Un prix. <span className="grad-text">Zero friction.</span>
            </h2>
            <p className="section-body">
              Pas de formule bronze/argent/or. Pas de piege. Tout est inclus des le premier euro.
            </p>
          </div>
          <div className="pricing-wrap reveal">
            <div className="pricing-card">
              <div className="pricing-badge">✓ 1 mois offert, sans CB</div>
              <div className="price-row">
                <span className="price-amount">9,99€</span>
                <span className="price-period">/mois</span>
              </div>
              <p className="price-tagline">Tout inclus · Sans engagement · Resiliable en 2 clics</p>
              <ul className="price-features">
                {features.map((f, i) => (
                  <li key={i}>
                    <span className="check-icon">{f.icon}</span>
                    {f.text}
                  </li>
                ))}
              </ul>
              <button className="btn-primary full" onClick={() => navigate('/register')}>
                Commencer gratuitement <ArrowRight size={18} />
              </button>
              <p className="pricing-micro">Sans carte bancaire · Acces complet des l'inscription</p>
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
              Questions <span className="grad-text">frequentes.</span>
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
            Votre prochain deal<br/>
            <span className="grad-text">commence ici.</span>
          </h2>
          <p className="cta-sub reveal">Rejoignez les agents qui closent plus, sans travailler plus.</p>
          <div className="reveal">
            <button className="btn-final" onClick={() => navigate('/register')}>
              Demarrer — 1 mois gratuit <ArrowRight size={18} />
            </button>
            <p className="cta-micro">Sans carte bancaire · Acces complet en 2 minutes</p>
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
            <div className="footer-links">
              <a href="#features">Fonctionnalites</a>
              <a href="#pricing">Tarif</a>
              <a href="#faq">FAQ</a>
              <a href="/login">Connexion</a>
            </div>
            <p className="footer-copy">© 2026 KOLO. Tous droits reserves.</p>
          </div>
        </div>
      </footer>

      {/* TOAST */}
      <div className={`toast ${showToast ? 'show' : ''}`}>
        📬 Verifiez votre boite mail — a tout de suite !
      </div>
    </div>
  );
};

export default LandingPage;
