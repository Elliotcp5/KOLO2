// =============================================================
// KOLO v2 — PAGES Dossiers / Contacts / Agenda
// =============================================================
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Plus, Phone, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import V2Layout from '../V2Layout';
import { AddCaseModal, CaseDetailModal, AddContactModal, AddReminderModal, AIChatModal } from '../V2Modals';
import v2api from '../v2api';
import '../../styles/v2.css';

const useAuthedUser = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { v2api.me().then(setUser).catch(() => navigate('/app-v2/login')); }, [navigate]);
  return user;
};

// ============================================================
// DOSSIERS
// ============================================================
export const V2CasesPage = () => {
  const user = useAuthedUser();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showCase, setShowCase] = useState(null);
  const [showAI, setShowAI] = useState(null); // case_id

  const reload = () => {
    const params = {};
    if (filter !== 'all') params.type = filter;
    if (search) params.search = search;
    v2api.listCases(params).then(r => setItems(r.items)).catch(() => setItems([]));
  };
  useEffect(() => { reload(); }, [filter, search]);
  if (!user) return null;

  return (
    <>
      <V2Layout user={user}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h1 className="v2-hello" style={{ fontSize: 22 }}>Dossiers</h1>
          <button className="v2-btn primary" onClick={() => setShowAdd(true)} data-testid="cases-add">
            <Plus size={16} /> Ajouter
          </button>
        </div>

        <div className="v2-filter-tabs" style={{ marginBottom: 12 }}>
          <button className={`v2-filter-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')} data-testid="cases-filter-all">Tous</button>
          <button className={`v2-filter-tab ${filter === 'seller' ? 'active' : ''}`} onClick={() => setFilter('seller')} data-testid="cases-filter-seller">Vendeurs</button>
          <button className={`v2-filter-tab ${filter === 'buyer' ? 'active' : ''}`} onClick={() => setFilter('buyer')} data-testid="cases-filter-buyer">Acquéreurs</button>
        </div>
        <div className="v2-search" style={{ marginBottom: 12 }}>
          <SearchIcon size={16} color="var(--v2-muted-2)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un dossier…" data-testid="cases-search" />
        </div>

        {items.length === 0 ? (
          <div className="v2-empty">
            <div className="title">Aucun dossier</div>
            <div>Ajoute ton premier dossier vendeur ou acquéreur.</div>
          </div>
        ) : (
          items.map(c => {
            const pc = c.primary_contact || { first_name: '—', last_name: '' };
            const detail = [c.surface_m2 && `${c.surface_m2} m²`, c.rooms && `${c.rooms} pièces`, c.address].filter(Boolean).join(' · ');
            return (
              <button key={c.case_id} className="v2-card" style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 10 }} onClick={() => setShowCase(c.case_id)} data-testid={`case-${c.case_id}`}>
                <div className="v2-tag" style={{ marginBottom: 6 }}>{c.type === 'seller' ? 'Vendeur' : 'Acquéreur'}</div>
                <div className="v2-row-title">{pc.first_name} {pc.last_name}</div>
                <div className="v2-row-sub">{detail || '—'}</div>
              </button>
            );
          })
        )}
      </V2Layout>

      <AddCaseModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={reload} />
      <CaseDetailModal
        open={!!showCase} onClose={() => setShowCase(null)} caseId={showCase}
        onOpenAI={(cid) => { setShowCase(null); setShowAI(cid); }}
      />
      <AIChatModal open={!!showAI} onClose={() => setShowAI(null)} caseId={showAI} />
    </>
  );
};

// ============================================================
// CONTACTS
// ============================================================
export const V2ContactsPage = () => {
  const user = useAuthedUser();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  const reload = () => v2api.listContacts(search || undefined).then(r => setItems(r.items)).catch(() => setItems([]));
  useEffect(() => { reload(); }, [search]);
  if (!user) return null;

  // Group by initial
  const grouped = items.reduce((acc, c) => {
    const k = (c.last_name?.[0] || '#').toUpperCase();
    (acc[k] = acc[k] || []).push(c);
    return acc;
  }, {});
  const letters = Object.keys(grouped).sort();

  return (
    <>
      <V2Layout user={user}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h1 className="v2-hello" style={{ fontSize: 22 }}>Contacts</h1>
          <button className="v2-btn primary" onClick={() => setShowAdd(true)} data-testid="contacts-add">
            <Plus size={16} /> Ajouter
          </button>
        </div>
        <div className="v2-search" style={{ marginBottom: 12 }}>
          <SearchIcon size={16} color="var(--v2-muted-2)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" data-testid="contacts-search" />
        </div>

        {items.length === 0 ? (
          <div className="v2-empty">
            <div className="title">Aucun contact</div>
            <div>Ajoute ton premier contact via le bouton ci-dessus.</div>
          </div>
        ) : (
          letters.map(L => (
            <div key={L}>
              <div className="v2-drawer-section" style={{ margin: '16px 4px 4px' }}>{L}</div>
              {grouped[L].map(ct => (
                <div key={ct.contact_id} className="v2-row" data-testid={`contact-${ct.contact_id}`}>
                  <div className="v2-row-left">
                    <div className="v2-row-avatar">{(ct.first_name?.[0] || '?')}{(ct.last_name?.[0] || '')}</div>
                    <div>
                      <div className="v2-row-title">{ct.first_name} {ct.last_name}</div>
                      <div className="v2-row-sub">{ct.role === 'buyer' ? 'Acheteur' : ct.role === 'seller' ? 'Vendeur' : ct.role}</div>
                    </div>
                  </div>
                  <div className="v2-row-actions">
                    {ct.phone && <a className="v2-icon-btn" href={`tel:${ct.phone}`} aria-label="Phone"><Phone size={16} /></a>}
                    {ct.email && <a className="v2-icon-btn" href={`mailto:${ct.email}`} aria-label="Email"><Mail size={16} /></a>}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </V2Layout>
      <AddContactModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={reload} />
    </>
  );
};

// ============================================================
// AGENDA
// ============================================================
const startOfWeek = (d) => {
  const day = (d.getDay() + 6) % 7; // Monday=0
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
};

export const V2AgendaPage = () => {
  const user = useAuthedUser();
  const [selected, setSelected] = useState(new Date());
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const dateStr = selected.toISOString().slice(0, 10);

  const reload = () => v2api.listReminders(dateStr).then(r => setItems(r.items)).catch(() => setItems([]));
  useEffect(() => { reload(); }, [dateStr]);
  if (!user) return null;

  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
  const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const hours = Array.from({ length: 17 }, (_, i) => i + 7); // 7h → 23h
  const minutesToTop = (h, m = 0) => ((h - 7) * 56) + ((m / 60) * 56);

  return (
    <>
      <V2Layout user={user}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h1 className="v2-hello" style={{ fontSize: 22 }}>Agenda</h1>
          <button className="v2-btn primary" onClick={() => setShowAdd(true)} data-testid="agenda-add">
            <Plus size={16} /> Ajouter
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button className="v2-icon-btn" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }} aria-label="Prev">
            <ChevronLeft size={18} />
          </button>
          <div style={{ fontSize: 13, color: 'var(--v2-muted)' }}>
            {weekStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </div>
          <button className="v2-icon-btn" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }} aria-label="Next">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="v2-week">
          {days.map((d, i) => {
            const active = d.toDateString() === selected.toDateString();
            return (
              <button key={i} className={`v2-day ${active ? 'active' : ''}`} onClick={() => setSelected(new Date(d))} data-testid={`agenda-day-${i}`}>
                <span>{dayLabels[i]}</span>
                <span className="num">{d.getDate()}</span>
              </button>
            );
          })}
        </div>

        <div className="v2-timeline" style={{ position: 'relative' }}>
          {hours.map((h) => (
            <div key={h} className="v2-hour-row">
              <div className="v2-hour-label">{h}:00</div>
            </div>
          ))}
          {items.map(r => {
            if (!r.time_start) return null;
            const [h, m] = r.time_start.split(':').map(Number);
            if (h < 7 || h > 23) return null;
            const top = minutesToTop(h, m);
            return (
              <div key={r.reminder_id} className="v2-hour-event" style={{ top: top + 6 }} data-testid={`agenda-event-${r.reminder_id}`}>
                {r.title} <span style={{ color: 'var(--v2-muted)', fontWeight: 400 }}>· {r.time_start}{r.time_end ? `–${r.time_end}` : ''}</span>
              </div>
            );
          })}
        </div>
      </V2Layout>
      <AddReminderModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={reload} defaultDate={dateStr} />
    </>
  );
};
