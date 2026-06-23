// =============================================================
// KOLO v2 — Layout shell: Header (burger) + Sidebar drawer + Bottom nav.
// Mobile-first iOS feel. Light theme, premium minimal.
// =============================================================
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, Home as HomeIcon, FolderOpen, Users, Calendar,
  Settings, LogOut, BookOpen, Search as SearchIcon, X, Mic, Sparkles, Mail, Bell
} from 'lucide-react';
import v2api from './v2api';
import v2t from './v2i18n';

/* ---------- Logo (wordmark KOLO — League Spartan) ---------- */
export const V2Logo = ({ size = 22, accent = false }) => (
  <span className={`v2-wordmark ${size > 32 ? (size > 48 ? 'xl' : 'lg') : ''}`} style={{ fontSize: size }}>
    {accent ? <>K<span className="accent">O</span>LO</> : 'KOLO'}
  </span>
);

/* ---------- Loading screen ---------- */
export const V2Loading = () => (
  <div className="v2-loading" data-testid="v2-loading">
    <img src="/kolo-mark-v4.png" alt="KOLO" style={{ width: 80, height: 80, objectFit: 'contain' }} />
  </div>
);

/* ---------- Sidebar drawer ---------- */
const Sidebar = ({ open, onClose, user, dashboard }) => {
  const navigate = useNavigate();
  if (!open) return null;
  const onLogout = () => {
    v2api.clearSession();
    localStorage.removeItem('session_token');
    navigate('/app-v2/login');
  };
  return (
    <>
      <div className="v2-drawer-backdrop" onClick={onClose} data-testid="v2-drawer-backdrop" />
      <aside className="v2-drawer" data-testid="v2-drawer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <V2Logo size={26} accent />
          <button onClick={onClose} className="v2-icon-btn" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="v2-drawer-plan">
          <div className="label">Abonnement</div>
          <div className="value">{dashboard?.has_pro ? 'KOLO Pro' : 'KOLO Gratuit'}</div>
          <div className="sub">
            {dashboard?.has_pro
              ? 'Toutes les fonctionnalités, sans limite.'
              : 'Plan gratuit — limites du jour ↓'}
          </div>

          {!dashboard?.has_pro && (
            <div className="v2-quota-block" data-testid="drawer-quota-block">
              <div className="v2-quota-row" data-testid="quota-contacts">
                <div className="v2-quota-label">
                  <Users size={13} strokeWidth={2} /> Contacts
                </div>
                <div className="v2-quota-value">
                  <strong>{dashboard?.free_contacts_left ?? 10}</strong>
                  <span className="muted"> sur {dashboard?.free_contacts_limit ?? 10} restants</span>
                </div>
                <div className="v2-quota-bar">
                  <div
                    className="v2-quota-bar-fill"
                    style={{ width: `${Math.min(100, Math.round(((dashboard?.total_contacts ?? 0) / (dashboard?.free_contacts_limit ?? 10)) * 100))}%` }}
                  />
                </div>
              </div>
              <div className="v2-quota-row" data-testid="quota-prospecting">
                <div className="v2-quota-label">
                  <SearchIcon size={13} strokeWidth={2} /> Prospection
                </div>
                <div className="v2-quota-value">
                  <strong>{dashboard?.prospecting_left_this_week ?? 1}</strong>
                  <span className="muted"> sur {dashboard?.prospecting_limit_per_week ?? 1} restante cette semaine</span>
                </div>
                <div className="v2-quota-bar">
                  <div
                    className="v2-quota-bar-fill"
                    style={{ width: `${Math.min(100, Math.round(((dashboard?.prospecting_used_this_week ?? 0) / (dashboard?.prospecting_limit_per_week ?? 1)) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {dashboard?.has_pro && (
            <div className="v2-quota-block" data-testid="drawer-pro-block" style={{ fontSize: 13, color: 'var(--v2-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Users size={14} strokeWidth={2} /> Contacts : <strong>illimité</strong></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}><SearchIcon size={14} strokeWidth={2} /> Prospection : <strong>illimitée</strong></div>
            </div>
          )}

          {!dashboard?.has_pro && (
            <button
              className="v2-btn ai-btn full"
              style={{ marginTop: 14 }}
              onClick={() => { onClose(); navigate('/app-v2/settings/subscription'); }}
              data-testid="drawer-upgrade-btn"
            >
              Passer Pro · 24,99€/mois
            </button>
          )}
        </div>

        <div className="v2-drawer-section">Fonctionnalités</div>
        <button className="v2-drawer-item" onClick={() => { onClose(); navigate('/app-v2/prospecting'); }} data-testid="drawer-prospecting">
          <SearchIcon size={18} /> <span>Pige & Prospection</span>
          <span className="arrow">›</span>
        </button>
        <button className="v2-drawer-item" onClick={() => { onClose(); navigate('/app-v2/referral'); }} data-testid="drawer-referral">
          <Sparkles size={18} /> <span>Parrainage</span>
          <span className="arrow">›</span>
        </button>
        <button className="v2-drawer-item" onClick={() => { onClose(); navigate('/app-v2/guide'); }} data-testid="drawer-guide">
          <BookOpen size={18} /> <span>Guide KOLO</span>
          <span className="arrow">›</span>
        </button>

        <div className="v2-drawer-section">Compte</div>
        <button className="v2-drawer-item" onClick={() => { onClose(); navigate('/app-v2/settings'); }} data-testid="drawer-profile">
          <Settings size={18} /> <span>Profil & paramètres</span>
          <span className="arrow">›</span>
        </button>
        <button
          className="v2-drawer-item"
          onClick={() => {
            const subject = encodeURIComponent('Demande d\'assistance KOLO');
            const body = encodeURIComponent(`Bonjour,\n\n[Décris ton besoin ici]\n\n--\nApp: KOLO v2.0\nUser: ${user?.email || user?.user_id || ''}`);
            window.location.href = `mailto:contact@trykolo.io?subject=${subject}&body=${body}`;
          }}
          data-testid="drawer-contact"
        >
          <Mail size={18} /> <span>Contact / Assistance</span>
          <span className="arrow">›</span>
        </button>
        <button className="v2-drawer-item" onClick={onLogout} data-testid="drawer-logout">
          <LogOut size={18} /> <span>Se déconnecter</span>
        </button>

        <div className="v2-drawer-section" style={{ marginTop: 24 }}>Informations légales</div>
        <button className="v2-drawer-item tiny" onClick={() => window.open('https://trykolo.io/privacy', '_blank')} data-testid="drawer-privacy">
          Politique de confidentialité
        </button>
        <button className="v2-drawer-item tiny" onClick={() => window.open('https://trykolo.io/terms', '_blank')} data-testid="drawer-terms">
          Conditions générales d'utilisation
        </button>
        <button className="v2-drawer-item tiny" onClick={() => window.open('https://trykolo.io/legal', '_blank')} data-testid="drawer-legal">
          Mentions légales
        </button>
        <button className="v2-drawer-item tiny" onClick={() => window.open('https://trykolo.io/iap-terms', '_blank')} data-testid="drawer-iap-terms">
          Conditions d'achat in-app
        </button>

        <div className="v2-drawer-section" style={{ marginTop: 32 }}>&nbsp;</div>
        <button className="v2-drawer-item tiny danger" onClick={() => { onClose(); navigate('/app-v2/settings/delete'); }} data-testid="drawer-delete">
          Supprimer mon compte
        </button>
      </aside>
    </>
  );
};

/* ---------- Bell notification (header right) ---------- */
const V2BellNotification = () => {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/v2/notifications/unread`, { headers: { Authorization: `Bearer ${localStorage.getItem('kolo_v2_session') || ''}` } });
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) setCount(d.count || 0);
      } catch (_) { /* noop */ }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return (
    <button
      className="v2-header-bell"
      onClick={() => navigate('/app-v2/notifications')}
      aria-label="Notifications"
      data-testid="v2-bell"
    >
      <Bell size={18} strokeWidth={1.8} />
      {count > 0 && <span className="v2-bell-dot" data-testid="v2-bell-dot">{count > 9 ? '9+' : count}</span>}
    </button>
  );
};

/* ---------- Bottom Nav (with optional central mic FAB on Home) ---------- */
// Lazy haptic feedback — uses Capacitor Haptics on native, Vibration API on web.
const triggerHapticImpact = async () => {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Medium });
    return;
  } catch (_) { /* native plugin not available, fall back */ }
  try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) { /* noop */ }
};

export const V2BottomNav = ({ showCentralMic = false, onMicClick = () => {} }) => {
  const tabs = [
    { to: '/app-v2', icon: HomeIcon, label: 'Accueil', exact: true, tid: 'tab-home' },
    { to: '/app-v2/dossiers', icon: FolderOpen, label: 'Dossiers', tid: 'tab-cases' },
    { to: '/app-v2/contacts', icon: Users, label: 'Contacts', tid: 'tab-contacts' },
    { to: '/app-v2/agenda', icon: Calendar, label: 'Agenda', tid: 'tab-agenda' },
  ];
  // When central mic is shown, split tabs 2|MIC|2
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);
  const handleMic = () => { triggerHapticImpact(); onMicClick(); };
  return (
    <nav className={`v2-bottom-nav ${showCentralMic ? 'with-mic' : ''}`} data-testid="v2-bottom-nav">
      {(showCentralMic ? left : tabs).map(({ to, icon: Icon, label, exact, tid }) => (
        <NavLink
          to={to}
          end={exact}
          key={to}
          className={({ isActive }) => `v2-tab ${isActive ? 'active' : ''}`}
          data-testid={tid}
        >
          <Icon size={22} strokeWidth={1.8} />
          <span>{label}</span>
          <span className="tab-dot" />
        </NavLink>
      ))}
      {showCentralMic && (
        <div className="v2-mic-fab-wrap">
          <button
            type="button"
            className="v2-mic-fab"
            onClick={handleMic}
            aria-label={v2t('createNote')}
            data-testid="home-mic-fab"
          >
            <span className="v2-mic-ring" aria-hidden />
            <Mic size={26} strokeWidth={2.2} />
          </button>
          <span className="v2-mic-fab-label" data-testid="home-mic-fab-label">{v2t('createNote')}</span>
        </div>
      )}
      {showCentralMic && right.map(({ to, icon: Icon, label, exact, tid }) => (
        <NavLink
          to={to}
          end={exact}
          key={to}
          className={({ isActive }) => `v2-tab ${isActive ? 'active' : ''}`}
          data-testid={tid}
        >
          <Icon size={22} strokeWidth={1.8} />
          <span>{label}</span>
          <span className="tab-dot" />
        </NavLink>
      ))}
    </nav>
  );
};

/* ---------- Main Layout ---------- */
export const V2Layout = ({ children, user, showAddNoteFab = false, onAddNote = () => {}, dashboard = null }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);
  // V2 → FR by default (no marketing-site auto-overwrite). The user can still switch via settings.
  useEffect(() => {
    try {
      if (!localStorage.getItem('kolo_locale_manual')) {
        localStorage.setItem('kolo_locale', localStorage.getItem('kolo_locale') || 'fr');
        localStorage.setItem('kolo_locale_manual', 'true');
      }
    } catch (_) { /* noop */ }
  }, []);

  return (
    <div className="v2-app" data-testid="v2-app">
      <header className="v2-header">
        <button className="v2-header-burger" onClick={() => setDrawerOpen(true)} aria-label="Menu" data-testid="v2-burger">
          <Menu size={20} strokeWidth={1.8} />
        </button>
        <img src="/kolo-mark-v4.png" alt="KOLO" className="v2-header-mark" />
        <V2BellNotification />
      </header>
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} dashboard={dashboard} />
      <main className="v2-container">{children}</main>
      <V2BottomNav showCentralMic={showAddNoteFab} onMicClick={onAddNote} />
    </div>
  );
};

export default V2Layout;
