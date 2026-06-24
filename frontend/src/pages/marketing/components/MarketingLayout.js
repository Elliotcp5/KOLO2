import React, { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import '../marketing.css';

const NAV = [
  { to: '/', label: 'Accueil' },
  { to: '/comment-kolo', label: 'Comment KOLO' },
  { to: '/ressources', label: 'Ressources' },
  { to: '/a-propos', label: 'À propos' },
];

const APP_STORE_URL = 'https://apps.apple.com/fr/app/kolo-ai-real-estate/id6761818371';

const KoloLogo = () => (
  <Link to="/" className="mkt-logo" data-testid="mkt-logo-home">
    <span>KOLO</span>
    <span className="mkt-logo-dot" />
  </Link>
);

export const MarketingHeader = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  // Close mobile nav on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <header className="mkt-header" data-testid="mkt-header">
      <div className="mkt-container mkt-header-inner">
        <KoloLogo />
        <nav className="mkt-nav" data-testid="mkt-nav-desktop">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => `mkt-nav-link ${isActive ? 'active' : ''}`}
              data-testid={`mkt-nav-link-${n.to.replace(/\W/g, '') || 'home'}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mkt-header-cta"
            data-testid="mkt-header-appstore-cta"
          >
            Télécharger <ArrowRight size={14} strokeWidth={2.5} />
          </a>
          <button
            className="mkt-burger"
            aria-label="Ouvrir le menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            data-testid="mkt-nav-burger"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <div className={`mkt-mobile-nav ${open ? 'open' : ''}`} data-testid="mkt-nav-mobile">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `mkt-nav-link ${isActive ? 'active' : ''}`}
            data-testid={`mkt-nav-mobile-link-${n.to.replace(/\W/g, '') || 'home'}`}
          >
            {n.label}
          </NavLink>
        ))}
      </div>
    </header>
  );
};

export const MarketingFooter = () => (
  <footer className="mkt-footer" data-testid="mkt-footer">
    <div className="mkt-container">
      <div className="mkt-footer-grid">
        <div className="mkt-footer-brand">
          <KoloLogo />
          <p>Le copilote IA des agents immobiliers indépendants. Pige, dictée vocale, suivi des dossiers — pensé par un agent pour les agents.</p>
        </div>
        <div className="mkt-footer-col">
          <h5>Produit</h5>
          <Link to="/comment-kolo">Comment ça marche</Link>
          <Link to="/ressources">Ressources</Link>
          <a href={APP_STORE_URL} target="_blank" rel="noreferrer">Télécharger l'app</a>
        </div>
        <div className="mkt-footer-col">
          <h5>Société</h5>
          <Link to="/a-propos">À propos</Link>
          <Link to="/business">Entreprise</Link>
          <a href="mailto:contact@trykolo.io">Contact</a>
        </div>
        <div className="mkt-footer-col">
          <h5>Légal</h5>
          <Link to="/legal">Mentions légales</Link>
          <Link to="/privacy">Confidentialité</Link>
          <Link to="/terms">CGU</Link>
        </div>
      </div>
      <div className="mkt-footer-bottom">
        <div>© {new Date().getFullYear()} KOLO. Tous droits réservés.</div>
        <div>Conçu en France · Pensé pour l'immobilier</div>
      </div>
    </div>
  </footer>
);

const MarketingLayout = ({ children }) => {
  // Scroll to top on route change
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  // Reveal-on-scroll observer
  useEffect(() => {
    const els = document.querySelectorAll('.mkt-reveal');
    if (!('IntersectionObserver' in window) || !els.length) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  });

  return (
    <div className="mkt-root" data-testid="mkt-root">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
};

export default MarketingLayout;
export { APP_STORE_URL };
