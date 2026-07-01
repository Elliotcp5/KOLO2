// =============================================================
// KOLO v2 — PAGE ACCUEIL (Dark Premium / Revolut style)
// =============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Settings, LogOut, CreditCard, ChevronRight, Clock, Brain, X as XIcon } from 'lucide-react';
import V2Layout from '../V2Layout';
import v2t from '../v2i18n';
import { AddNoteModal, AddReminderModal, AIChatModal, CaseDetailModal } from '../V2Modals';
import V2NotificationPrompt from '../V2NotificationPrompt';
import v2api from '../v2api';
import '../../styles/v2.css';

const stripEmoji = (s) => (s || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, '').replace(/\s+/g, ' ').trim();

const formatDateFR = (d) => {
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
};

const getInitials = (firstName, lastName, email) => {
  if (firstName) {
    const a = firstName.charAt(0).toUpperCase();
    const b = lastName ? lastName.charAt(0).toUpperCase() : '';
    return (a + b).slice(0, 2);
  }
  return (email || 'K').charAt(0).toUpperCase();
};

/* ---------- SVG Activity Ring (Apple Health / Revolut style) ---------- */
const ActivityRing = ({ value = 0, total = 1, color = '#FFFFFF', size = 100, stroke = 10 }) => {
  const safeTotal = Math.max(1, total);
  const safeValue = Math.max(0, Math.min(safeTotal, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = safeValue / safeTotal;
  const dashOffset = c * (1 - pct);
  return (
    <svg width={size} height={size} aria-hidden>
      <circle className="v2-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <circle
        className="v2-ring-progress"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        stroke={color}
        strokeDasharray={c}
        strokeDashoffset={dashOffset}
        style={{ '--ring-color': color }}
      />
    </svg>
  );
};

/* ---------- Profile mini sheet (triggered by Bonjour hero tap) ---------- */
const ProfileSheet = ({ open, onClose, user, dashboard, onLogout }) => {
  const navigate = useNavigate();
  if (!open) return null;
  const initials = getInitials(user?.first_name, user?.last_name, user?.email);
  const planLabel = dashboard?.has_pro ? 'KOLO Pro · Actif' : 'KOLO Gratuit';
  return (
    <div className="v2-profile-sheet-backdrop" onClick={onClose} data-testid="profile-sheet-backdrop">
      <div className="v2-profile-sheet" onClick={(e) => e.stopPropagation()} data-testid="profile-sheet">
        <div className="v2-modal-handle" />
        <div className="v2-profile-sheet-head">
          <div className="v2-profile-sheet-avatar" data-testid="profile-sheet-avatar">{initials}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="v2-profile-sheet-name" data-testid="profile-sheet-name">
              {user?.first_name || ''} {user?.last_name || ''}
            </div>
            <div className="v2-profile-sheet-email" data-testid="profile-sheet-email">{user?.email || ''}</div>
            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-muted)' }}>
              {planLabel}
            </div>
          </div>
          <button className="v2-icon-btn" onClick={onClose} aria-label="Fermer" data-testid="profile-sheet-close">
            <XIcon size={16} />
          </button>
        </div>
        <div className="v2-profile-sheet-list">
          <button className="v2-profile-sheet-item" onClick={() => { onClose(); navigate('/app-v2/settings'); }} data-testid="profile-sheet-settings">
            <Settings size={18} /> Profil & paramètres <span className="arrow">›</span>
          </button>
          {!dashboard?.has_pro && (
            <button className="v2-profile-sheet-item" onClick={() => { onClose(); navigate('/app-v2/settings/subscription'); }} data-testid="profile-sheet-upgrade">
              <CreditCard size={18} /> Passer Pro · 24,99€/mois <span className="arrow">›</span>
            </button>
          )}
          <button className="v2-profile-sheet-item" onClick={() => { onClose(); navigate('/app-v2/notifications'); }} data-testid="profile-sheet-notifications">
            <Clock size={18} /> Mes notifications <span className="arrow">›</span>
          </button>
          <button className="v2-profile-sheet-item" onClick={onLogout} data-testid="profile-sheet-logout" style={{ color: '#FF6B66' }}>
            <LogOut size={18} /> Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
};

const NotesModal = ({ open, onClose }) => {
  const [tab, setTab] = useState('pending');
  const [notes, setNotes] = useState([]);
  const reload = () => v2api.listNotes(tab === 'all' ? undefined : tab).then(r => setNotes(r.items)).catch(() => setNotes([]));
  useEffect(() => { if (open) reload(); }, [open, tab]);
  if (!open) return null;
  return (
    <div className="v2-modal-backdrop" onClick={onClose} data-testid="modal-notes-list">
      <div className="v2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="v2-modal-handle" />
        <div className="v2-modal-title">Notes terrain</div>
        <div className="v2-filter-tabs">
          <button className={`v2-filter-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>Toutes</button>
          <button className={`v2-filter-tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>À traiter</button>
          <button className={`v2-filter-tab ${tab === 'processed' ? 'active' : ''}`} onClick={() => setTab('processed')}>Traitées</button>
        </div>
        <div style={{ marginTop: 14 }}>
          {notes.length === 0 ? <div className="v2-empty">Aucune note.</div> : notes.map(n => (
            <div key={n.note_id} className="v2-card" style={{ marginBottom: 10 }}>
              <div className="v2-card-body" style={{ color: 'var(--v2-ink)', margin: 0 }}>{n.content}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <span style={{ fontSize: 11.5, color: 'var(--v2-muted-2)' }}>{new Date(n.created_at).toLocaleDateString('fr-FR')}</span>
                {n.status === 'pending' ? (
                  <button className="v2-btn secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={async () => { await v2api.updateNote(n.note_id, { status: 'processed' }); reload(); }} data-testid={`note-mark-${n.note_id}`}>Marquer traitée</button>
                ) : (
                  <span style={{ fontSize: 11.5, color: 'var(--v2-success)', fontWeight: 600 }}>Traitée</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function V2HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [tip, setTip] = useState(null);
  const [recentCases, setRecentCases] = useState([]);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiInitial, setAiInitial] = useState(null);
  const [aiCaseId, setAiCaseId] = useState(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showCase, setShowCase] = useState(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);

  const reload = () => {
    v2api.me().then(setUser).catch(() => { navigate('/app-v2/login'); });
    v2api.dashboard().then(setDashboard).catch(() => {});
    v2api.listCases({ recent: true }).then(r => setRecentCases(r.items)).catch(() => {});
    v2api.dailyTip().then(setTip).catch(() => {});
  };
  useEffect(() => { reload(); }, []);

  const onLogout = () => {
    v2api.clearSession();
    localStorage.removeItem('session_token');
    navigate('/app-v2/login');
  };

  // Ring totals — use REAL counts from backend dashboard (0/0 if nothing yet today)
  const ringData = useMemo(() => {
    const remindersDone = dashboard?.reminders_completed_today ?? 0;
    const remindersTotal = dashboard?.reminders_created_today ?? 0;
    const remindersPending = dashboard?.reminders_today ?? 0;
    const notesDone = dashboard?.notes_processed_today ?? 0;
    const notesTotal = dashboard?.notes_created_today ?? 0;
    const notesPending = dashboard?.notes_pending ?? 0;
    return {
      reminders: { value: remindersDone, total: remindersTotal, pending: remindersPending },
      notes:     { value: notesDone,     total: notesTotal,     pending: notesPending },
    };
  }, [dashboard]);

  if (!user) return <div className="v2-app" data-testid="v2-home-loading" />;
  const today = new Date();
  const initials = getInitials(user.first_name, user.last_name, user.email);

  return (
    <>
      <V2Layout user={user} dashboard={dashboard} showAddNoteFab onAddNote={() => setShowAddNote(true)}>
        <div className="v2-hero">
          <button
            type="button"
            className="v2-hero-trigger"
            onClick={() => setShowProfileSheet(true)}
            data-testid="home-hero-trigger"
            aria-label="Ouvrir le menu profil"
          >
            <div className="v2-hero-left">
              <h1 className="v2-hello" data-testid="home-hello">
                {(() => {
                  const h = new Date().getHours();
                  const key = h < 12 ? 'home.hello_morning' : (h < 18 ? 'home.hello_afternoon' : 'home.hello_evening');
                  return v2t(key, { name: user.first_name || '' });
                })()}
                {!dashboard?.has_pro && <span className="v2-pro-badge" data-testid="home-pro-badge">Passer PRO</span>}
              </h1>
              <span className="v2-date" data-testid="home-date">
                {formatDateFR(today)}
              </span>
            </div>
            <div className="v2-hero-avatar" aria-hidden data-testid="home-hero-avatar">
              {initials}
              <span className="v2-hero-avatar-dot" />
            </div>
          </button>
        </div>

        <V2NotificationPrompt userId={user.user_id} />

        {/* Daily advice — collapsible hero (div + role for valid DOM) */}
        <div
          className={`v2-tip-collapsible ${tipOpen ? 'open' : ''}`}
          onClick={() => setTipOpen(o => !o)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTipOpen(o => !o); } }}
          role="button"
          tabIndex={0}
          aria-expanded={tipOpen}
          data-testid="home-daily-advice"
        >
          <div className="v2-tip-head">
            <div className="v2-tip-head-left">
              <span className="v2-tip-eyebrow">{v2t('dailyAdvice')}</span>
              <span className="v2-tip-title">
                {tip?.tip ? stripEmoji((tip.tip.split('\n')[0] || '').replace(/^#+\s*/, '')).slice(0, 70) : 'Ton conseil du jour t\'attend'}
              </span>
              {!tipOpen && tip?.tip && (
                <span className="v2-tip-teaser">
                  {stripEmoji(tip.tip.replace(/^#+\s*[^\n]*\n+/, '')).slice(0, 90)}…
                </span>
              )}
            </div>
            <ChevronDown size={18} className="v2-tip-chevron" />
          </div>
          {tipOpen && (
            <div className="v2-tip-body" data-testid="home-daily-advice-body">
              <div className="v2-tip-content">
                {stripEmoji(tip?.tip || '') || 'Chargement de ton conseil personnalisé…'}
              </div>
              <div className="v2-tip-actions">
                <button
                  className="v2-btn primary"
                  onClick={(e) => { e.stopPropagation(); setAiInitial(tip?.tip); setShowAI(true); }}
                  data-testid="home-tip-continue"
                >
                  {v2t('continueChat')}
                </button>
                <button
                  className="v2-icon-btn"
                  onClick={(e) => { e.stopPropagation(); navigate('/app-v2/conversations'); }}
                  aria-label="Historique des conversations"
                  data-testid="home-tip-history"
                >
                  <Clock size={16} />
                </button>
              </div>
              {(tip?.suggestions || []).length > 0 && (
                <div className="v2-suggestions">
                  {(tip.suggestions || []).map(s => (
                    <span
                      key={s}
                      className="v2-suggestion-chip"
                      onClick={(e) => { e.stopPropagation(); setAiInitial(`Je voudrais : ${s}`); setShowAI(true); }}
                      data-testid={`home-tip-sugg-${s}`}
                      role="button"
                      tabIndex={0}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ask KOLO compact CTA — single brain icon */}
        <button
          className="v2-ai-cta"
          onClick={() => { setAiInitial(null); setAiCaseId(null); setShowAI(true); }}
          data-testid="home-ai-cta"
        >
          <span className="v2-ai-cta-icon"><Brain size={14} strokeWidth={2} /></span>
          <span className="v2-ai-cta-title">{v2t('askKolo')}</span>
        </button>

        {/* SVG Activity Rings — REPLACES the flat stat cards */}
        <div className="v2-section-title" style={{ marginTop: 26 }}>
          Aujourd'hui
          <button className="link" onClick={() => setShowAddReminder(true)} data-testid="home-add-reminder">+ Rappel</button>
        </div>

        <div className="v2-rings-grid" data-testid="home-rings-grid">
          <button
            type="button"
            className="v2-ring-card"
            style={{ '--ring-glow': 'rgba(50,215,75,0.20)' }}
            onClick={() => navigate('/app-v2/agenda')}
            data-testid="home-ring-reminders"
          >
            <div className="v2-ring-svg">
              <ActivityRing
                value={ringData.reminders.value}
                total={ringData.reminders.total}
                color="#32D74B"
                size={104}
                stroke={11}
              />
              <div className="v2-ring-center">
                <span className="v2-ring-value">
                  <span data-testid="ring-reminders-value">{ringData.reminders.value}</span>
                  <span className="sep">/</span>
                  <span className="total">{ringData.reminders.total}</span>
                </span>
                <span className="v2-ring-sub">faits</span>
              </div>
            </div>
            <span className="v2-ring-label">Rappels</span>
            <span className="v2-ring-status">
              <span className="dot" style={{ '--ring-color': '#32D74B' }} />
              {ringData.reminders.pending > 0 ? `${ringData.reminders.pending} restants` : 'Tout est fait'}
            </span>
          </button>

          <button
            type="button"
            className="v2-ring-card"
            style={{ '--ring-glow': 'rgba(10,132,255,0.20)' }}
            onClick={() => setShowNotes(true)}
            data-testid="home-ring-notes"
          >
            <div className="v2-ring-svg">
              <ActivityRing
                value={ringData.notes.value}
                total={ringData.notes.total}
                color="#0A84FF"
                size={104}
                stroke={11}
              />
              <div className="v2-ring-center">
                <span className="v2-ring-value">
                  <span data-testid="ring-notes-value">{ringData.notes.value}</span>
                  <span className="sep">/</span>
                  <span className="total">{ringData.notes.total}</span>
                </span>
                <span className="v2-ring-sub">traitées</span>
              </div>
            </div>
            <span className="v2-ring-label">Notes</span>
            <span className="v2-ring-status">
              <span className="dot" style={{ '--ring-color': '#0A84FF' }} />
              {ringData.notes.pending > 0 ? `${ringData.notes.pending} à traiter` : 'À jour'}
            </span>
          </button>
        </div>

        <div className="v2-section-title" style={{ marginTop: 28 }}>
          Dossiers récents
          <button className="link" onClick={() => navigate('/app-v2/dossiers')}>Voir tout</button>
        </div>
        {recentCases.length === 0 ? (
          <div className="v2-empty">
            <div className="title">Aucun dossier pour l'instant</div>
            <div>Crée ton premier dossier depuis l'onglet « Dossiers ».</div>
          </div>
        ) : (
          recentCases.map(c => {
            const pc = c.primary_contact || { first_name: '—', last_name: '' };
            const detail = [c.surface_m2 && `${c.surface_m2} m²`, c.rooms && `${c.rooms} pièces`, c.address].filter(Boolean).join(' · ');
            return (
              <div key={c.case_id} className="v2-card" style={{ marginBottom: 10 }} data-testid={`recent-case-${c.case_id}`}>
                <div className="v2-row-title">{pc.first_name} {pc.last_name}</div>
                <div className="v2-row-sub">{c.property_kind === 'apartment' ? 'Appartement' : c.property_kind === 'house' ? 'Maison' : ''} {detail}</div>
                <button className="v2-btn secondary full" style={{ marginTop: 12 }} onClick={() => setShowCase(c.case_id)} data-testid={`recent-case-view-${c.case_id}`}>
                  Voir le dossier <ChevronRight size={14} />
                </button>
              </div>
            );
          })
        )}
      </V2Layout>

      <ProfileSheet
        open={showProfileSheet}
        onClose={() => setShowProfileSheet(false)}
        user={user}
        dashboard={dashboard}
        onLogout={onLogout}
      />

      <AddNoteModal open={showAddNote} onClose={() => setShowAddNote(false)} onCreated={reload} />
      <AddReminderModal open={showAddReminder} onClose={() => setShowAddReminder(false)} onCreated={reload} />
      <AIChatModal open={showAI} onClose={() => { setShowAI(false); setAiCaseId(null); setAiInitial(null); }} initialReply={aiInitial} caseId={aiCaseId} />
      <NotesModal open={showNotes} onClose={() => { setShowNotes(false); reload(); }} />
      <CaseDetailModal open={!!showCase} onClose={() => setShowCase(null)} caseId={showCase} onOpenAI={(cid) => { setShowCase(null); setAiCaseId(cid); setAiInitial(null); setShowAI(true); }} />
    </>
  );
}
