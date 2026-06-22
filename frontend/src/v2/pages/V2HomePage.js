// =============================================================
// KOLO v2 — PAGE ACCUEIL
// =============================================================
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight, Plus, Clock, FileText } from 'lucide-react';
import V2Layout from '../V2Layout';
import { AddNoteModal, AddReminderModal, AIChatModal, CaseDetailModal } from '../V2Modals';
import V2NotificationPrompt from '../V2NotificationPrompt';
import v2api from '../v2api';
import '../../styles/v2.css';

const formatDateFR = (d) => {
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
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
                  <span style={{ fontSize: 11.5, color: 'var(--v2-success)', fontWeight: 600 }}>✓ Traitée</span>
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

  const reload = () => {
    v2api.me().then(setUser).catch(() => { navigate('/app-v2/login'); });
    v2api.dashboard().then(setDashboard).catch(() => {});
    v2api.listCases({ recent: true }).then(r => setRecentCases(r.items)).catch(() => {});
    v2api.dailyTip().then(setTip).catch(() => {});
  };
  useEffect(() => { reload(); }, []);

  if (!user) return null;
  const today = new Date();

  return (
    <>
      <V2Layout user={user} dashboard={dashboard} showAddNoteFab onAddNote={() => setShowAddNote(true)}>
        <div className="v2-hero">
          <h1 className="v2-hello" data-testid="home-hello">
            Bonjour {user.first_name || ''}
            {!dashboard?.has_pro && <span className="v2-pro-badge" data-testid="home-pro-badge"><Sparkles size={11} /> Passer PRO</span>}
          </h1>
          <button className="v2-date" onClick={() => navigate('/app-v2/agenda')} data-testid="home-date">
            {formatDateFR(today)}
          </button>
        </div>

        <V2NotificationPrompt userId={user.user_id} />

        <div className="v2-section-title">
          Aujourd'hui
          <button className="link" onClick={() => setShowAddReminder(true)} data-testid="home-add-reminder">+ Ajouter un rappel</button>
        </div>

        <div className="v2-tip-card" onClick={() => { setAiInitial(tip?.tip); setAiCaseId(null); setShowAI(true); }} data-testid="home-daily-tip">
          <div className="v2-tag" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Sparkles size={12} /> Conseil du jour</span>
            <button className="v2-icon-btn" style={{ width: 30, height: 30 }} onClick={(e) => { e.stopPropagation(); navigate('/app-v2/conversations'); }} aria-label="Historique" data-testid="home-tip-history">
              <Clock size={14} />
            </button>
          </div>
          <div className="v2-card-body" style={{ color: 'var(--v2-ink)', marginTop: 10, whiteSpace: 'pre-wrap' }}>
            {tip?.tip || 'Chargement de ton conseil personnalisé…'}
          </div>
          <div className="v2-suggestions" style={{ marginTop: 12 }}>
            {(tip?.suggestions || []).map(s => (
              <button key={s} className="v2-suggestion-chip" onClick={(e) => { e.stopPropagation(); setAiInitial(`Je voudrais : ${s}`); setShowAI(true); }} data-testid={`home-tip-sugg-${s}`}>{s}</button>
            ))}
          </div>
        </div>

        <div className="v2-grid-2">
          <button className="v2-stat-card" onClick={() => navigate('/app-v2/agenda')} data-testid="home-stat-reminders" style={{ textAlign: 'left' }}>
            <div className="v2-stat-num">{dashboard?.reminders_today ?? 0}</div>
            <div className="v2-stat-label">Rappels aujourd'hui</div>
          </button>
          <button className="v2-stat-card" onClick={() => setShowNotes(true)} data-testid="home-stat-notes" style={{ textAlign: 'left' }}>
            <div className="v2-stat-num">{dashboard?.notes_pending ?? 0}</div>
            <div className="v2-stat-label">Notes à traiter</div>
          </button>
        </div>

        <div className="v2-section-title" style={{ marginTop: 30 }}>
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
                  Voir le dossier
                </button>
              </div>
            );
          })
        )}
      </V2Layout>

      <AddNoteModal open={showAddNote} onClose={() => setShowAddNote(false)} onCreated={reload} />
      <AddReminderModal open={showAddReminder} onClose={() => setShowAddReminder(false)} onCreated={reload} />
      <AIChatModal open={showAI} onClose={() => { setShowAI(false); setAiCaseId(null); setAiInitial(null); }} initialReply={aiInitial} caseId={aiCaseId} />
      <NotesModal open={showNotes} onClose={() => { setShowNotes(false); reload(); }} />
      <CaseDetailModal open={!!showCase} onClose={() => setShowCase(null)} caseId={showCase} onOpenAI={(cid) => { setShowCase(null); setAiCaseId(cid); setAiInitial(null); setShowAI(true); }} />
    </>
  );
}
