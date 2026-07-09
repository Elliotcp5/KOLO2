import React, { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown } from 'lucide-react';
import '../marketing.css';
import { I18nProvider, useI18n, LANGUAGES } from '../i18n';

// Official App Store URL for the iOS app (used as primary CTA everywhere).
const APP_STORE_URL = 'https://apps.apple.com/fr/app/kolo-ai-real-estate/id6761818371';

// New dark KOLO logo (same as the one used inside the iOS app).
const KOLO_LOGO_DARK = 'https://customer-assets.emergentagent.com/job_2eb24348-efe6-47cf-8c87-199c35e66909/artifacts/ah5kfmpv_META%20LOGO%20WEB%20APP.png';

const KoloLogo = () => (
  <Link to="/" className="mkt-logo" data-testid="mkt-logo-home" aria-label="KOLO — retour à l'accueil">
    <img src={KOLO_LOGO_DARK} alt="KOLO" />
  </Link>
);

const LanguageSwitcher = () => {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onDoc = (e) => { if (!e.target.closest('.mkt-lang')) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div className="mkt-lang" data-testid="mkt-lang-switcher">
      <button
        type="button"
        className="mkt-lang-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-testid="mkt-lang-trigger"
      >
        {current.label}
        <ChevronDown size={12} strokeWidth={2.5} />
      </button>
      {open && (
        <ul className="mkt-lang-menu" role="listbox">
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                className={`mkt-lang-item ${l.code === lang ? 'active' : ''}`}
                onClick={() => { setLang(l.code); setOpen(false); }}
                data-testid={`mkt-lang-option-${l.code}`}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Header = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const NAV = [
    { to: '/', label: 'Accueil' },
    { to: '/comment-kolo', label: 'Fonctionnalités' },
    { to: '/a-propos', label: 'À propos' },
  ];

  return (
    <header className="mkt-header" data-testid="mkt-header">
      <div className="mkt-container mkt-header-inner">
        <KoloLogo />
        <div className="mkt-header-actions">
          <LanguageSwitcher />
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mkt-cta-pill"
            data-testid="mkt-header-cta"
          >
            Télécharge l&apos;app
          </a>
          <button
            className="mkt-burger"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            data-testid="mkt-nav-burger"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
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
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noreferrer"
          className="mkt-cta-pill large"
          style={{ marginTop: 24, justifyContent: 'center' }}
          data-testid="mkt-nav-mobile-appstore"
        >
          Télécharge l&apos;app
        </a>
      </div>
    </header>
  );
};

const Footer = () => (
  <footer className="mkt-footer" data-testid="mkt-footer">
    <div className="mkt-container">
      <div className="mkt-footer-grid">
        <div className="mkt-footer-brand">
          <KoloLogo />
          <p>Le co-pilote intelligent des agents immobiliers. Disponible sur iPhone.</p>
        </div>
        <div className="mkt-footer-col">
          <h5>Produit</h5>
          <Link to="/comment-kolo" data-testid="mkt-footer-how">Fonctionnalités</Link>
          <a href={APP_STORE_URL} target="_blank" rel="noreferrer" data-testid="mkt-footer-download">
            Télécharger
          </a>
        </div>
        <div className="mkt-footer-col">
          <h5>Entreprise</h5>
          <Link to="/a-propos" data-testid="mkt-footer-about">À propos</Link>
          <a href="mailto:contact@trykolo.io">contact@trykolo.io</a>
        </div>
        <div className="mkt-footer-col">
          <h5>Légal</h5>
          <Link to="/legal">Mentions légales</Link>
          <Link to="/legal">Confidentialité</Link>
          <Link to="/legal">CGU</Link>
        </div>
      </div>
      <div className="mkt-footer-bottom">
        <div>© {new Date().getFullYear()} KOLO. Tous droits réservés.</div>
        <div>Fait par des agents immo, pour des agents immo.</div>
      </div>
    </div>
  </footer>
);

const Layout = ({ children }) => {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  // While a marketing route is mounted, force the html/body bg to obsidian
  // so the fixed glass header + any FOUC don't flash a light color.
  // We use `setProperty(..., 'important')` because App.css also sets
  // `html, body { background-color: var(--bg) }` at the same specificity.
  useEffect(() => {
    const prevHtml = document.documentElement.getAttribute('style') || '';
    const prevBody = document.body.getAttribute('style') || '';
    document.documentElement.style.setProperty('background', '#050505', 'important');
    document.body.style.setProperty('background', '#050505', 'important');
    document.body.style.setProperty('color', '#ffffff', 'important');
    return () => {
      document.documentElement.setAttribute('style', prevHtml);
      document.body.setAttribute('style', prevBody);
    };
  }, []);

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
  }, [location.pathname]);

  return (
    <div className="mkt-root" data-testid="mkt-root">
      <div className="mkt-ambient" aria-hidden />
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
};

const MarketingLayout = ({ children }) => (
  <I18nProvider>
    <Layout>{children}</Layout>
  </I18nProvider>
);

export default MarketingLayout;
export { APP_STORE_URL, KOLO_LOGO_DARK };
