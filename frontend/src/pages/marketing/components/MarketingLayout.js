import React, { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, ChevronDown } from 'lucide-react';
import '../marketing.css';
import { I18nProvider, useI18n, LANGUAGES } from '../i18n';

const APP_STORE_URL = 'https://apps.apple.com/fr/app/kolo-ai-real-estate/id6761818371';

const KoloLogo = () => (
  <Link to="/" className="mkt-logo" data-testid="mkt-logo-home">
    <span>KOLO</span>
  </Link>
);

const LanguageSwitcher = () => {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onDoc = (e) => {
      if (!e.target.closest('.mkt-lang-switcher')) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div className="mkt-lang-switcher" data-testid="mkt-lang-switcher">
      <button
        type="button"
        className="mkt-lang-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-testid="mkt-lang-trigger"
      >
        {current.label}
        <ChevronDown size={13} strokeWidth={2.5} />
      </button>
      {open && (
        <ul className="mkt-lang-menu" role="listbox" data-testid="mkt-lang-menu">
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

const HeaderInner = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { t } = useI18n();

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const NAV = [
    { to: '/', label: t('nav.home') },
    { to: '/comment-kolo', label: t('nav.how') },
    { to: '/ressources', label: t('nav.resources') },
    { to: '/a-propos', label: t('nav.about') },
  ];

  return (
    <header className={`mkt-header ${open ? 'menu-open' : ''}`} data-testid="mkt-header">
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
          <LanguageSwitcher />
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mkt-header-cta"
            data-testid="mkt-header-appstore-cta"
          >
            {t('nav.cta')} <ArrowRight size={14} strokeWidth={2.5} />
          </a>
          <button
            className="mkt-burger"
            aria-label="Menu"
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
        <div className="mkt-mobile-divider" />
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noreferrer"
          className="mkt-btn mkt-btn-primary"
          data-testid="mkt-nav-mobile-appstore"
          style={{ marginTop: 12 }}
        >
          {t('nav.cta')} <ArrowRight size={16} strokeWidth={2.5} />
        </a>
      </div>
    </header>
  );
};

const FooterInner = () => {
  const { t } = useI18n();
  return (
    <footer className="mkt-footer" data-testid="mkt-footer">
      <div className="mkt-container">
        <div className="mkt-footer-grid">
          <div className="mkt-footer-brand">
            <KoloLogo />
            <p>{t('footer.tagline')}</p>
          </div>
          <div className="mkt-footer-col">
            <h5>{t('footer.product')}</h5>
            <Link to="/comment-kolo">{t('footer.how')}</Link>
            <Link to="/ressources">{t('footer.resources')}</Link>
            <a href={APP_STORE_URL} target="_blank" rel="noreferrer">{t('footer.download')}</a>
          </div>
          <div className="mkt-footer-col">
            <h5>{t('footer.company')}</h5>
            <Link to="/a-propos">{t('footer.about')}</Link>
            <a href="mailto:contact@trykolo.io">{t('footer.contact')}</a>
          </div>
          <div className="mkt-footer-col">
            <h5>{t('footer.legal')}</h5>
            <Link to="/legal">{t('footer.legal_notice')}</Link>
            <Link to="/legal">{t('footer.privacy')}</Link>
            <Link to="/legal">{t('footer.terms')}</Link>
          </div>
        </div>
        <div className="mkt-footer-bottom">
          <div>© {new Date().getFullYear()} {t('footer.company_label')}. {t('footer.rights')}</div>
          <div>{t('footer.crafted')}</div>
        </div>
      </div>
    </footer>
  );
};

const Layout = ({ children }) => {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

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
      <HeaderInner />
      <main>{children}</main>
      <FooterInner />
    </div>
  );
};

const MarketingLayout = ({ children }) => (
  <I18nProvider>
    <Layout>{children}</Layout>
  </I18nProvider>
);

export default MarketingLayout;
export { APP_STORE_URL };
