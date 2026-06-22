// =============================================================
// KOLO v2 — Layout shell: Header (burger) + Sidebar drawer + Bottom nav.
// Mobile-first iOS feel. Light theme, premium minimal.
// =============================================================
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, Home as HomeIcon, FolderOpen, Users, Calendar,
  Settings, LogOut, BookOpen, Search as SearchIcon, X, Mic, Sparkles
} from 'lucide-react';
import v2api from './v2api';

/* ---------- Logo (wordmark KOLO — League Spartan) ---------- */
export const V2Logo = ({ size = 22, accent = false }) => (
  <span className={`v2-wordmark ${size > 32 ? (size > 48 ? 'xl' : 'lg') : ''}`} style={{ fontSize: size }}>
    {accent ? <>K<span className="accent">O</span>LO</> : 'KOLO'}
  </span>
);

/* ---------- Loading screen ---------- */
export const V2Loading = () => (
  <div className="v2-loading" data-testid="v2-loading">
    <V2Logo size={64} />
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
                  <span className="emoji">📇</span> Contacts
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
                  <span className="emoji">🔍</span> Prospection
                </div>
                <div className="v2-quota-value">
                  <strong>{dashboard?.prospecting_left_today ?? 1}</strong>
                  <span className="muted"> sur {dashboard?.prospecting_limit_per_day ?? 1} restante aujourd'hui</span>
                </div>
                <div className="v2-quota-bar">
                  <div
                    className="v2-quota-bar-fill"
                    style={{ width: `${Math.min(100, Math.round(((dashboard?.prospecting_used_today ?? 0) / (dashboard?.prospecting_limit_per_day ?? 1)) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {dashboard?.has_pro && (
            <div className="v2-quota-block" data-testid="drawer-pro-block" style={{ fontSize: 13, color: 'var(--v2-muted)' }}>
              <div>📇 Contacts : <strong>illimité</strong></div>
              <div style={{ marginTop: 4 }}>🔍 Prospection : <strong>illimitée</strong></div>
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
        <button className="v2-drawer-item" onClick={onLogout} data-testid="drawer-logout">
          <LogOut size={18} /> <span>Se déconnecter</span>
        </button>

        <div className="v2-drawer-section" style={{ marginTop: 32 }}>&nbsp;</div>
        <button className="v2-drawer-item tiny danger" onClick={() => { onClose(); navigate('/app-v2/settings/delete'); }} data-testid="drawer-delete">
          Supprimer mon compte
        </button>
      </aside>
    </>
  );
};

/* ---------- Bottom Nav ---------- */
export const V2BottomNav = () => {
  const tabs = [
    { to: '/app-v2', icon: HomeIcon, label: 'Accueil', exact: true, tid: 'tab-home' },
    { to: '/app-v2/dossiers', icon: FolderOpen, label: 'Dossiers', tid: 'tab-cases' },
    { to: '/app-v2/contacts', icon: Users, label: 'Contacts', tid: 'tab-contacts' },
    { to: '/app-v2/agenda', icon: Calendar, label: 'Agenda', tid: 'tab-agenda' },
  ];
  return (
    <nav className="v2-bottom-nav" data-testid="v2-bottom-nav">
      {tabs.map(({ to, icon: Icon, label, exact, tid }) => (
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

  return (
    <div className="v2-app" data-testid="v2-app">
      <header className="v2-header">
        <button className="v2-header-burger" onClick={() => setDrawerOpen(true)} aria-label="Menu" data-testid="v2-burger">
          <Menu size={20} strokeWidth={1.8} />
        </button>
        <div className="v2-header-brand">
          <V2Logo size={22} accent />
        </div>
        <div style={{ width: 38 }} />
      </header>
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} dashboard={dashboard} />
      <main className="v2-container">{children}</main>
      {showAddNoteFab && (
        <button className="v2-add-note-fab" onClick={onAddNote} data-testid="add-note-fab">
          <Mic size={18} strokeWidth={2.2} /> Ajouter une note
        </button>
      )}
      <V2BottomNav />
    </div>
  );
};

export default V2Layout;
