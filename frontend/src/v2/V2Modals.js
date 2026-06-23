// =============================================================
// KOLO v2 — Reusable modals (Add Note, Add Reminder, AI Chat,
// Add Case, Add Contact). Bottom-sheet style, iOS feel.
// =============================================================
import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Send, MicOff, Plus, Phone, Mail, Clock, Brain } from 'lucide-react';
import v2api from './v2api';

const Modal = ({ open, onClose, title, children, testid }) => {
  if (!open) return null;
  return (
    <div className="v2-modal-backdrop" onClick={onClose} data-testid={testid}>
      <div className="v2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="v2-modal-handle" />
        <div className="v2-modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
};

/* ---------- Web Speech API hook (graceful fallback if not available) ---------- */
const useSpeech = (onResult) => {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("La saisie vocale n'est pas disponible sur ce navigateur."); return; }
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const transcript = Array.from(ev.results).map(r => r[0].transcript).join(' ');
      onResult(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };
  const stop = () => { try { recRef.current && recRef.current.stop(); } catch {} setListening(false); };
  return { listening, start, stop };
};

/* ---------- Add Note ---------- */
export const AddNoteModal = ({ open, onClose, onCreated }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const { listening, start, stop } = useSpeech((t) => setText(prev => (prev ? `${prev} ${t}` : t)));
  useEffect(() => { if (open) setText(''); }, [open]);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const n = await v2api.createNote({ content: text.trim(), source: listening ? 'voice' : 'text', status: 'pending' });
      onCreated && onCreated(n);
      onClose();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle note terrain" testid="modal-add-note">
      <textarea
        className="v2-textarea"
        rows={5}
        placeholder="Écrivez ou dictez votre note (RDV, appel, échange terrain…)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-testid="add-note-text"
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <button
          className={`v2-mic-btn ${listening ? 'recording' : ''}`}
          onClick={listening ? stop : start}
          aria-label="Saisie vocale"
          data-testid="add-note-mic"
        >
          {listening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <span style={{ fontSize: 12.5, color: 'var(--v2-muted)' }}>
          {listening ? 'Enregistrement en cours…' : 'Touchez pour dicter'}
        </span>
      </div>
      <div className="v2-modal-actions">
        <button className="v2-btn secondary full" onClick={onClose}>Annuler</button>
        <button className="v2-btn primary full" onClick={submit} disabled={busy || !text.trim()} data-testid="add-note-submit">
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </Modal>
  );
};

/* ---------- Add Reminder ---------- */
export const AddReminderModal = ({ open, onClose, onCreated, defaultDate }) => {
  const [form, setForm] = useState({ title: '', date: defaultDate || new Date().toISOString().slice(0, 10), time_start: '', time_end: '', description: '' });
  const [busy, setBusy] = useState(false);
  const { listening: lsTitle, start: startTitle, stop: stopTitle } = useSpeech((t) => setForm(prev => ({ ...prev, title: prev.title ? `${prev.title} ${t}` : t })));
  const { listening: lsDesc, start: startDesc, stop: stopDesc } = useSpeech((t) => setForm(prev => ({ ...prev, description: prev.description ? `${prev.description} ${t}` : t })));
  useEffect(() => { if (open) setForm({ title: '', date: defaultDate || new Date().toISOString().slice(0, 10), time_start: '', time_end: '', description: '' }); }, [open, defaultDate]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async () => {
    if (!form.title.trim()) return;
    setBusy(true);
    try { const r = await v2api.createReminder(form); onCreated && onCreated(r); onClose(); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nouveau rappel" testid="modal-add-reminder">
      <div className="v2-field">
        <label className="v2-label">Titre</label>
        <div className="v2-input-with-mic">
          <input className="v2-input" value={form.title} onChange={set('title')} placeholder="Appel Mme Dupont" data-testid="reminder-title" />
          <button
            type="button"
            className={`v2-input-mic ${lsTitle ? 'recording' : ''}`}
            onClick={lsTitle ? stopTitle : startTitle}
            aria-label="Dicter le titre"
            data-testid="reminder-title-mic"
          >
            {lsTitle ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
        </div>
      </div>
      <div className="v2-field">
        <label className="v2-label">Jour</label>
        <input type="date" className="v2-input" value={form.date} onChange={set('date')} data-testid="reminder-date" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="v2-field">
          <label className="v2-label">Début</label>
          <input type="time" className="v2-input" value={form.time_start} onChange={set('time_start')} data-testid="reminder-start" />
        </div>
        <div className="v2-field">
          <label className="v2-label">Fin</label>
          <input type="time" className="v2-input" value={form.time_end} onChange={set('time_end')} data-testid="reminder-end" />
        </div>
      </div>
      <div className="v2-field">
        <label className="v2-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Description (optionnelle)</span>
          <span style={{ fontSize: 9, color: 'var(--v2-muted-2)', textTransform: 'none', letterSpacing: 0 }}>
            {lsDesc ? 'Écoute en cours…' : 'Touche le micro pour dicter'}
          </span>
        </label>
        <div className="v2-textarea-with-mic">
          <textarea
            className="v2-textarea"
            rows={3}
            value={form.description}
            onChange={set('description')}
            placeholder="Ajoute du contexte, des points à aborder…"
            data-testid="reminder-description"
          />
          <button
            type="button"
            className={`v2-textarea-mic ${lsDesc ? 'recording' : ''}`}
            onClick={lsDesc ? stopDesc : startDesc}
            aria-label="Dicter la description"
            data-testid="reminder-desc-mic"
          >
            {lsDesc ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        </div>
      </div>
      <div className="v2-modal-actions">
        <button className="v2-btn secondary full" onClick={onClose}>Annuler</button>
        <button className="v2-btn primary full" onClick={submit} disabled={busy || !form.title.trim()} data-testid="reminder-submit">
          {busy ? 'Création…' : 'Valider'}
        </button>
      </div>
    </Modal>
  );
};

/* ---------- AI Chat ---------- */
export const AIChatModal = ({ open, onClose, caseId, initialReply }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const { listening, start, stop } = useSpeech((t) => setInput(prev => (prev ? `${prev} ${t}` : t)));

  useEffect(() => {
    if (!open) return;
    if (initialReply) setMessages([{ role: 'assistant', content: initialReply }]);
    else setMessages([]);
    setConversationId(null);
  }, [open, initialReply]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setMessages(m => [...m, { role: 'user', content: msg }]);
    setInput('');
    setBusy(true);
    try {
      const res = await v2api.aiChat({ message: msg, conversation_id: conversationId, case_id: caseId });
      setConversationId(res.conversation_id);
      setMessages(m => [...m, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `Erreur: ${e.message}` }]);
    } finally { setBusy(false); }
  };

  const suggestions = ['Voir mes tâches du jour', 'Créer un contact vendeur', 'Recevoir un conseil de prospection'];

  return (
    <Modal open={open} onClose={onClose} title="Parler à KOLO" testid="modal-ai-chat">
      <div className="v2-chat-list" data-testid="ai-chat-list">
        {messages.length === 0 && (
          <div className="v2-chat-msg assistant">Bonjour 👋 Je suis KOLO, ton copilote immo. Pose-moi une question (prospection, relance, négo…) ou dicte ton brief terrain.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`v2-chat-msg ${m.role}`}>{m.content}</div>
        ))}
        {busy && <div className="v2-chat-msg assistant" style={{ opacity: 0.6 }}>KOLO réfléchit…</div>}
      </div>
      {messages.length <= 1 && (
        <div className="v2-suggestions">
          {suggestions.map(s => (
            <button key={s} className="v2-suggestion-chip" onClick={() => send(s)} data-testid={`ai-sugg-${s}`}>{s}</button>
          ))}
        </div>
      )}
      <div className="v2-chat-input-row">
        <button
          className={`v2-mic-btn ${listening ? 'recording' : ''}`}
          onClick={listening ? stop : start}
          aria-label="Mic"
          data-testid="ai-chat-mic"
        >
          {listening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <input
          className="v2-chat-input"
          placeholder="Écris ton message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          data-testid="ai-chat-input"
        />
        <button className="v2-mic-btn" onClick={() => send()} aria-label="Send" data-testid="ai-chat-send">
          <Send size={18} />
        </button>
      </div>
    </Modal>
  );
};

/* ---------- Add Contact ---------- */
export const AddContactModal = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ civility: 'M.', first_name: '', last_name: '', email: '', phone: '', address: '', role: 'buyer' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setForm({ civility: 'M.', first_name: '', last_name: '', email: '', phone: '', address: '', role: 'buyer' }); }, [open]);
  const submit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setBusy(true);
    try { const c = await v2api.createContact(form); onCreated && onCreated(c); onClose(); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nouveau contact" testid="modal-add-contact">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="v2-field"><label className="v2-label">Civilité</label>
          <select className="v2-select" value={form.civility} onChange={set('civility')} data-testid="contact-civility">
            <option value="M.">Monsieur</option><option value="Mme">Madame</option>
          </select>
        </div>
        <div className="v2-field"><label className="v2-label">Rôle</label>
          <select className="v2-select" value={form.role} onChange={set('role')} data-testid="contact-role">
            <option value="buyer">Acheteur</option><option value="seller">Vendeur</option>
            <option value="partner">Partenaire</option><option value="introducer">Apporteur d'affaires</option>
            <option value="landlord">Propriétaire bailleur</option><option value="tenant">Locataire</option>
            <option value="other">Autre</option>
          </select>
        </div>
      </div>
      <div className="v2-field"><label className="v2-label">Prénom</label>
        <input className="v2-input" value={form.first_name} onChange={set('first_name')} data-testid="contact-firstname" /></div>
      <div className="v2-field"><label className="v2-label">Nom</label>
        <input className="v2-input" value={form.last_name} onChange={set('last_name')} data-testid="contact-lastname" /></div>
      <div className="v2-field"><label className="v2-label">Email</label>
        <input className="v2-input" type="email" value={form.email} onChange={set('email')} data-testid="contact-email" /></div>
      <div className="v2-field"><label className="v2-label">Téléphone</label>
        <input className="v2-input" type="tel" value={form.phone} onChange={set('phone')} data-testid="contact-phone" /></div>
      <div className="v2-field"><label className="v2-label">Adresse</label>
        <input className="v2-input" value={form.address} onChange={set('address')} data-testid="contact-address" /></div>
      <div className="v2-modal-actions">
        <button className="v2-btn secondary full" onClick={onClose}>Annuler</button>
        <button className="v2-btn primary full" onClick={submit} disabled={busy || !form.first_name.trim() || !form.last_name.trim()} data-testid="contact-submit">
          {busy ? '…' : 'Ajouter'}
        </button>
      </div>
    </Modal>
  );
};

/* ---------- Add Case ---------- */
export const AddCaseModal = ({ open, onClose, onCreated }) => {
  const [type, setType] = useState('seller');
  const [form, setForm] = useState({ property_kind: 'apartment', surface_m2: '', rooms: '', price: '', address: '', notes: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const [busy, setBusy] = useState(false);
  const { listening: lsNotes, start: startNotes, stop: stopNotes } = useSpeech((t) => setForm(prev => ({ ...prev, notes: prev.notes ? `${prev.notes} ${t}` : t })));
  useEffect(() => { if (open) { setForm({ property_kind: 'apartment', surface_m2: '', rooms: '', price: '', address: '', notes: '' }); setType('seller'); } }, [open]);
  const submit = async () => {
    setBusy(true);
    try {
      const payload = {
        type,
        contact_ids: [],
        property_kind: form.property_kind,
        surface_m2: form.surface_m2 ? Number(form.surface_m2) : null,
        rooms: form.rooms ? Number(form.rooms) : null,
        price: form.price ? Number(form.price) : null,
        address: form.address,
        sectors: [],
        notes: form.notes,
      };
      const c = await v2api.createCase(payload);
      onCreated && onCreated(c);
      onClose();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nouveau dossier" testid="modal-add-case">
      <div className="v2-filter-tabs" style={{ marginBottom: 14 }}>
        <button className={`v2-filter-tab ${type === 'seller' ? 'active' : ''}`} onClick={() => setType('seller')} data-testid="case-type-seller">Vendeur</button>
        <button className={`v2-filter-tab ${type === 'buyer' ? 'active' : ''}`} onClick={() => setType('buyer')} data-testid="case-type-buyer">Acquéreur</button>
      </div>
      <div className="v2-field"><label className="v2-label">{type === 'seller' ? 'Type de bien' : 'Type recherché'}</label>
        <select className="v2-select" value={form.property_kind} onChange={set('property_kind')} data-testid="case-kind">
          <option value="apartment">Appartement</option><option value="house">Maison</option><option value="any">Indifférent</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="v2-field"><label className="v2-label">Surface (m²)</label>
          <input className="v2-input" type="number" value={form.surface_m2} onChange={set('surface_m2')} data-testid="case-surface" /></div>
        <div className="v2-field"><label className="v2-label">Pièces</label>
          <input className="v2-input" type="number" value={form.rooms} onChange={set('rooms')} data-testid="case-rooms" /></div>
      </div>
      <div className="v2-field"><label className="v2-label">{type === 'seller' ? 'Prix demandé (€)' : 'Prix max (€)'}</label>
        <input className="v2-input" type="number" value={form.price} onChange={set('price')} data-testid="case-price" /></div>
      <div className="v2-field"><label className="v2-label">{type === 'seller' ? 'Adresse du bien' : 'Secteur recherché'}</label>
        <input className="v2-input" value={form.address} onChange={set('address')} data-testid="case-address" /></div>
      <div className="v2-field"><label className="v2-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Notes du dossier</span>
          <span style={{ fontSize: 9, color: 'var(--v2-muted-2)', textTransform: 'none', letterSpacing: 0 }}>
            {lsNotes ? 'Écoute en cours…' : 'Touche le micro pour dicter'}
          </span>
        </label>
        <div className="v2-textarea-with-mic">
          <textarea className="v2-textarea" rows={3} value={form.notes} onChange={set('notes')} placeholder="Notes terrain, contexte client, éléments à retenir…" data-testid="case-notes" />
          <button
            type="button"
            className={`v2-textarea-mic ${lsNotes ? 'recording' : ''}`}
            onClick={lsNotes ? stopNotes : startNotes}
            aria-label="Dicter les notes du dossier"
            data-testid="case-notes-mic"
          >
            {lsNotes ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        </div>
      </div>
      <div className="v2-modal-actions">
        <button className="v2-btn secondary full" onClick={onClose}>Annuler</button>
        <button className="v2-btn primary full" onClick={submit} disabled={busy} data-testid="case-submit">{busy ? '…' : 'Créer le dossier'}</button>
      </div>
    </Modal>
  );
};

/* ---------- Case detail (Suivi vendeur / acheteur) ---------- */
export const CaseDetailModal = ({ open, onClose, caseId, onOpenAI }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!open || !caseId) return;
    v2api.getCase(caseId).then(setData).catch(() => setData(null));
  }, [open, caseId]);
  if (!open) return null;
  const c = data?.case;
  return (
    <Modal open={open} onClose={onClose} title={c ? (c.type === 'seller' ? 'Suivi vendeur' : 'Suivi acquéreur') : 'Dossier'} testid="modal-case-detail">
      {!data ? <div className="v2-empty">Chargement…</div> : (
        <>
          <div className="v2-card" style={{ marginBottom: 14 }}>
            <div className="v2-tag">{c.property_kind === 'apartment' ? 'Appartement' : c.property_kind === 'house' ? 'Maison' : 'Indifférent'}</div>
            <div className="v2-card-title">{c.surface_m2 ? `${c.surface_m2} m²` : ''} {c.rooms ? `· ${c.rooms} pièces` : ''}</div>
            <div className="v2-card-body">{c.address || '—'} {c.price ? `· ${Number(c.price).toLocaleString('fr-FR')}€` : ''}</div>
          </div>

          <div className="v2-section-title" style={{ marginTop: 4 }}>Contacts ({data.contacts.length})</div>
          {data.contacts.length === 0 ? (
            <div className="v2-empty" style={{ padding: 16 }}>Aucun contact lié.</div>
          ) : (
            data.contacts.map(ct => (
              <div key={ct.contact_id} className="v2-row">
                <div className="v2-row-left">
                  <div className="v2-row-avatar">{(ct.first_name?.[0] || '?')}{(ct.last_name?.[0] || '')}</div>
                  <div>
                    <div className="v2-row-title">{ct.first_name} {ct.last_name}</div>
                    <div className="v2-row-sub">{ct.role}</div>
                  </div>
                </div>
                <div className="v2-row-actions">
                  {ct.phone && <a className="v2-icon-btn" href={`tel:${ct.phone}`}><Phone size={16} /></a>}
                  {ct.email && <a className="v2-icon-btn" href={`mailto:${ct.email}`}><Mail size={16} /></a>}
                </div>
              </div>
            ))
          )}

          <div className="v2-section-title">Rappels ({data.reminders.length})</div>
          {data.reminders.length === 0 ? <div className="v2-empty" style={{ padding: 16 }}>—</div> : (
            data.reminders.map(r => (
              <div key={r.reminder_id} className="v2-row">
                <div className="v2-row-left">
                  <div className="v2-row-avatar"><Clock size={18} /></div>
                  <div>
                    <div className="v2-row-title">{r.title}</div>
                    <div className="v2-row-sub">{r.date} {r.time_start || ''}</div>
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="v2-modal-actions">
            <button className="v2-btn ai-btn full" onClick={() => onOpenAI && onOpenAI(caseId)} data-testid="case-talk-to-kolo">Parler à KOLO</button>
          </div>
        </>
      )}
    </Modal>
  );
};
