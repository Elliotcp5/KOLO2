import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Phone, MessageCircle, Eye, Mic, X, FileAudio,
  ArrowDownToLine, ArrowUpFromLine, Calendar, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../config/api';

const auth = () => { const t = localStorage.getItem('kolo_token'); return t ? { Authorization: `Bearer ${t}` } : {}; };

const formatDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
};

const formatDuration = (s) => {
  const n = parseInt(s || 0, 10);
  if (!n) return '—';
  const m = Math.floor(n / 60); const r = n % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
};

// ===========================================================================
// Post-call log modal (note + optional audio upload for transcription)
// ===========================================================================
const PostCallModal = ({ prospect, phoneCalled, onClose, onSaved }) => {
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('completed');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/integrations/calls/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({
          to: phoneCalled,
          prospect_id: prospect.prospect_id,
          duration_sec: parseInt(duration || '0', 10),
          notes,
          outcome,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Erreur');
      const callId = data.call.call_id;

      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('prospect_id', prospect.prospect_id);
        fd.append('call_id', callId);
        toast.info('Transcription en cours…');
        const tr = await fetch(`${API_URL}/api/integrations/transcribe-upload`, {
          method: 'POST', headers: auth(), body: fd,
        });
        if (!tr.ok) {
          const td = await tr.json().catch(() => ({}));
          toast.error(td.detail || 'Transcription échouée — l\'appel est tout de même loggé.');
        } else {
          toast.success('Appel enregistré et transcrit ✓');
        }
      } else {
        toast.success('Appel enregistré ✓');
      }
      onSaved && onSaved();
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="kolo-modal-backdrop kolo-glass-backdrop" onClick={onClose}>
      <div className="kolo-comm-modal kolo-glass-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kolo-comm-modal-header">
          <div>
            <h2>Appel passé</h2>
            <p>Vers <strong>{phoneCalled}</strong> · {prospect.full_name || prospect.name}</p>
          </div>
          <button onClick={onClose} className="kolo-comm-close-btn"><X size={18} /></button>
        </div>
        <form onSubmit={save} className="kolo-comm-form">
          <label>
            <span>Résultat</span>
            <select data-testid="postcall-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="completed">Conversation terminée</option>
              <option value="no-answer">Pas de réponse</option>
              <option value="voicemail">Messagerie</option>
              <option value="busy">Occupé</option>
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              <span>Durée (secondes)</span>
              <input data-testid="postcall-duration" type="number" min="0" placeholder="0" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </label>
            <label>
              <span>Enregistrement audio (optionnel)</span>
              <button type="button" onClick={() => fileRef.current?.click()} className="kolo-comm-file-btn">
                <FileAudio size={14} />
                <span>{file ? file.name.slice(0, 22) : 'Choisir un fichier…'}</span>
              </button>
              <input ref={fileRef} data-testid="postcall-audio" type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <label>
            <span>Notes</span>
            <textarea data-testid="postcall-notes" rows={4} placeholder="Ce qui a été dit, prochaine étape…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="kolo-comm-actions">
            <button type="button" onClick={onClose} className="kolo-comm-btn-secondary">Annuler</button>
            <button data-testid="postcall-save" type="submit" disabled={busy} className="kolo-comm-btn-primary">
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ===========================================================================
// Call detail modal (transcript + audio + notes)
// ===========================================================================
const CallDetailModal = ({ call, onClose }) => (
  <div className="kolo-modal-backdrop kolo-glass-backdrop" onClick={onClose}>
    <div className="kolo-comm-modal kolo-glass-modal" onClick={(e) => e.stopPropagation()} data-testid="call-detail-modal">
      <div className="kolo-comm-modal-header">
        <div>
          <h2>Détail de l'appel</h2>
          <p>{formatDate(call.created_at)} · {formatDuration(call.duration_sec)}</p>
        </div>
        <button onClick={onClose} className="kolo-comm-close-btn"><X size={18} /></button>
      </div>
      <div className="kolo-comm-detail-body">
        <div className="kolo-comm-row"><span>Vers</span><strong>{call.to}</strong></div>
        <div className="kolo-comm-row"><span>Résultat</span><strong>{call.outcome || 'completed'}</strong></div>
        {call.notes && (
          <div className="kolo-comm-block">
            <div className="kolo-comm-block-label">Notes</div>
            <p>{call.notes}</p>
          </div>
        )}
        {call.recording_url && (
          <div className="kolo-comm-block">
            <div className="kolo-comm-block-label">Enregistrement</div>
            <audio src={call.recording_url} controls style={{ width: '100%' }} />
          </div>
        )}
        {call.transcript ? (
          <div className="kolo-comm-block">
            <div className="kolo-comm-block-label"><Mic size={12} style={{ display: 'inline', marginRight: 4 }} /> Transcription</div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{call.transcript}</p>
          </div>
        ) : (
          <div className="kolo-comm-hint">Aucune transcription disponible pour cet appel. Tu peux uploader un enregistrement depuis la fiche prospect.</div>
        )}
      </div>
    </div>
  </div>
);

// ===========================================================================
// Quick WhatsApp send modal (deep link + log)
// ===========================================================================
const WhatsAppQuickModal = ({ prospect, onClose, onSent }) => {
  const [body, setBody] = useState(`Bonjour ${(prospect.full_name || '').split(' ')[0] || ''}, `);
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!prospect.phone) { toast.error('Pas de numéro pour ce prospect'); return; }
    setBusy(true);
    const phoneClean = prospect.phone.replace(/[^\d+]/g, '').replace('+', '');
    const text = encodeURIComponent(body);
    window.open(`https://wa.me/${phoneClean}?text=${text}`, '_blank');
    try {
      await fetch(`${API_URL}/api/integrations/whatsapp/log`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ to: prospect.phone, body, prospect_id: prospect.prospect_id }),
      });
      toast.success('Message envoyé et enregistré');
      onSent && onSent();
    } catch (_) {}
    finally { setBusy(false); onClose(); }
  };

  return (
    <div className="kolo-modal-backdrop kolo-glass-backdrop" onClick={onClose}>
      <div className="kolo-comm-modal kolo-glass-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kolo-comm-modal-header">
          <div>
            <h2>Envoyer un WhatsApp</h2>
            <p>{prospect.full_name} · {prospect.phone}</p>
          </div>
          <button onClick={onClose} className="kolo-comm-close-btn"><X size={18} /></button>
        </div>
        <form onSubmit={send} className="kolo-comm-form">
          <label>
            <span>Message</span>
            <textarea data-testid="wa-quick-body" rows={5} required value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <p style={{ fontSize: 12, color: 'var(--ink-mid)', marginBottom: 0 }}>
            WhatsApp s'ouvrira avec le message pré-rempli. Tu cliques sur "Envoyer" depuis ton WhatsApp.
          </p>
          <div className="kolo-comm-actions">
            <button type="button" onClick={onClose} className="kolo-comm-btn-secondary">Annuler</button>
            <button data-testid="wa-quick-send" type="submit" disabled={busy} className="kolo-comm-btn-primary" style={{ background: '#25D366' }}>
              <MessageCircle size={14} /> Ouvrir WhatsApp
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ===========================================================================
// Add-to-calendar modal (Google / Outlook)
// ===========================================================================
const defaultEventTime = () => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
};
const toLocalInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const AddToCalendarModal = ({ prospect, providers, onClose, onSaved }) => {
  const [provider, setProvider] = useState(providers[0] || 'google');
  const [title, setTitle] = useState(`RDV avec ${prospect.full_name || prospect.name || 'prospect'}`);
  const start = defaultEventTime();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const [startStr, setStartStr] = useState(toLocalInput(start));
  const [endStr, setEndStr] = useState(toLocalInput(end));
  const [description, setDescription] = useState(prospect.phone ? `Téléphone : ${prospect.phone}` : '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !startStr || !endStr) return;
    setBusy(true);
    try {
      const startIso = new Date(startStr).toISOString();
      const endIso = new Date(endStr).toISOString();
      let r;
      if (provider === 'google') {
        r = await fetch(`${API_URL}/api/integrations/google-calendar/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...auth() },
          body: JSON.stringify({
            title,
            start_iso: startIso,
            end_iso: endIso,
            description,
            prospect_id: prospect.prospect_id,
          }),
        });
      } else {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        r = await fetch(`${API_URL}/api/integrations/outlook-calendar/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...auth() },
          body: JSON.stringify({
            subject: title,
            // Microsoft Graph wants naive datetime + timezone — send local ISO without trailing Z
            start_iso: startStr.replace('T', ' ').slice(0, 19) + ':00'.slice(-(19 - startStr.length)),
            end_iso: endStr.replace('T', ' ').slice(0, 19) + ':00'.slice(-(19 - endStr.length)),
            timezone: tz,
            body: description,
            prospect_id: prospect.prospect_id,
          }),
        });
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Erreur');
      toast.success(`Événement créé dans ${provider === 'google' ? 'Google Calendar' : 'Outlook'} ✓`);
      onSaved && onSaved(d);
      onClose();
    } catch (e) { toast.error(typeof e.message === 'string' ? e.message : 'Erreur'); }
    finally { setBusy(false); }
  };

  return (
    <div className="kolo-modal-backdrop kolo-glass-backdrop" onClick={onClose}>
      <div className="kolo-comm-modal kolo-glass-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kolo-comm-modal-header">
          <div>
            <h2>Ajouter à mon agenda</h2>
            <p>{prospect.full_name} · {prospect.phone || '—'}</p>
          </div>
          <button onClick={onClose} className="kolo-comm-close-btn"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="kolo-comm-form">
          {providers.length > 1 && (
            <div className="kolo-provider-switch" role="tablist">
              {providers.includes('google') && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={provider === 'google'}
                  data-testid="cal-pick-google"
                  className={`kolo-provider-tab ${provider === 'google' ? 'is-active' : ''}`}
                  onClick={() => setProvider('google')}
                >
                  <span className="dot" style={{ background: '#4285F4' }} />
                  Google
                </button>
              )}
              {providers.includes('outlook') && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={provider === 'outlook'}
                  data-testid="cal-pick-outlook"
                  className={`kolo-provider-tab ${provider === 'outlook' ? 'is-active' : ''}`}
                  onClick={() => setProvider('outlook')}
                >
                  <span className="dot" style={{ background: '#0078D4' }} />
                  Outlook
                </button>
              )}
              <span className="kolo-provider-slider" data-pos={provider} aria-hidden="true" />
            </div>
          )}
          <label>
            <span>Titre</span>
            <input data-testid="cal-event-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              <span>Début</span>
              <input data-testid="cal-event-start" type="datetime-local" value={startStr} onChange={(e) => setStartStr(e.target.value)} required />
            </label>
            <label>
              <span>Fin</span>
              <input data-testid="cal-event-end" type="datetime-local" value={endStr} onChange={(e) => setEndStr(e.target.value)} required />
            </label>
          </div>
          <label>
            <span>Description (optionnel)</span>
            <textarea data-testid="cal-event-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Adresse du RDV, points à aborder…" />
          </label>
          <div className="kolo-comm-actions">
            <button type="button" onClick={onClose} className="kolo-comm-btn-secondary">Annuler</button>
            <button data-testid="cal-event-save" type="submit" disabled={busy} className="kolo-comm-btn-primary" style={{ background: 'linear-gradient(135deg, #6D28D9, #EC4899)' }}>
              <Calendar size={14} /> {busy ? 'Création…' : 'Créer l\'événement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ===========================================================================
// Main panel — unified timeline + integrated CTAs
// ===========================================================================
const ProspectCommsPanel = ({ prospect }) => {
  const [history, setHistory] = useState([]);
  const [callsCount, setCallsCount] = useState(0);
  const [waCount, setWaCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPostCall, setShowPostCall] = useState(false);
  const [showWA, setShowWA] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [phoneCalled, setPhoneCalled] = useState('');
  const [showCal, setShowCal] = useState(false);
  const [calProviders, setCalProviders] = useState([]); // ['google','outlook']

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/integrations/prospect/${prospect.prospect_id}/history`, { headers: auth() });
      if (r.ok) {
        const d = await r.json();
        setHistory(d.items || []);
        setCallsCount(d.calls_count || 0);
        setWaCount(d.wa_count || 0);
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, [prospect.prospect_id]);

  // Discover which calendar providers are connected for THIS user
  const discoverCalendars = useCallback(async () => {
    const providers = [];
    try {
      const r = await fetch(`${API_URL}/api/integrations/google-calendar/events?max_results=1`, { headers: auth() });
      if (r.ok) providers.push('google');
    } catch (_) {}
    try {
      const r = await fetch(`${API_URL}/api/integrations/outlook-calendar/events?max_results=1`, { headers: auth() });
      if (r.ok) providers.push('outlook');
    } catch (_) {}
    setCalProviders(providers);
  }, []);

  useEffect(() => { reload(); discoverCalendars(); }, [reload, discoverCalendars]);

  const call = () => {
    if (!prospect.phone) { toast.error('Pas de numéro de téléphone'); return; }
    setPhoneCalled(prospect.phone);
    window.location.href = `tel:${prospect.phone}`;
    setTimeout(() => setShowPostCall(true), 300);
  };

  const openCalendar = () => {
    if (calProviders.length === 0) {
      toast.info('Connecte d\'abord Google ou Outlook dans Intégrations.');
      return;
    }
    setShowCal(true);
  };

  return (
    <div className="kolo-comm-panel" data-testid="prospect-comms-panel">
      {/* Premium action bar — call / whatsapp / calendar */}
      <div className="kolo-comm-actionbar" data-testid="prospect-action-bar">
        <button data-testid="prospect-call-btn" onClick={call} className="kolo-comm-btn" data-kind="call">
          <span className="icon"><Phone size={16} strokeWidth={2.2} /></span>
          <span>Appeler</span>
        </button>
        <button data-testid="prospect-wa-btn" onClick={() => setShowWA(true)} className="kolo-comm-btn" data-kind="whatsapp">
          <span className="icon"><MessageCircle size={16} strokeWidth={2.2} /></span>
          <span>WhatsApp</span>
        </button>
        <button
          data-testid="prospect-cal-btn"
          onClick={openCalendar}
          className="kolo-comm-btn"
          data-kind="note"
          title={calProviders.length === 0 ? 'Connecte un agenda dans Intégrations' : `${calProviders.length} agenda(s) connecté(s)`}
        >
          <span className="icon" style={{ background: 'linear-gradient(135deg, #6D28D9, #EC4899)' }}>
            <Calendar size={16} strokeWidth={2.2} />
          </span>
          <span>Agenda</span>
        </button>
      </div>

      {/* Unified timeline */}
      {history.length > 0 ? (
        <div data-testid="comms-history" style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 6px' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, color: '#6B7280' }}>
              Historique
            </span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>
              {callsCount} appel{callsCount > 1 ? 's' : ''} · {waCount} message{waCount > 1 ? 's' : ''}
            </span>
          </div>
          <div className="kolo-comm-timeline">
            {history.slice(0, 12).map((item) => {
              if (item._kind === 'call') {
                return (
                  <div key={item.call_id} className="kolo-comm-item">
                    <div className="kolo-comm-bullet" data-kind="call">
                      <Phone size={16} strokeWidth={2.4} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCall(item)}
                      className="kolo-comm-body"
                      data-testid={`history-call-${item.call_id}`}
                      style={{ textAlign: 'left', border: 'none', cursor: 'pointer', width: '100%' }}
                    >
                      <div className="kolo-comm-head">
                        <div className="kolo-comm-title">
                          Appel · {formatDuration(item.duration_sec)}
                          {item.transcript && (
                            <Mic size={11} style={{ marginLeft: 6, opacity: 0.7, verticalAlign: 'middle' }} aria-label="Transcrit" />
                          )}
                        </div>
                        <span className="kolo-comm-time">{formatDate(item.created_at)}</span>
                      </div>
                      {item.notes && <div className="kolo-comm-text">{item.notes.slice(0, 140)}{item.notes.length > 140 ? '…' : ''}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <span className="kolo-comm-meta">{item.outcome || 'completed'}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          Détail <ChevronRight size={12} />
                        </span>
                      </div>
                    </button>
                  </div>
                );
              }
              // WhatsApp item
              const isInbound = item.direction === 'inbound';
              return (
                <div key={item.wa_message_id} className="kolo-comm-item">
                  <div className="kolo-comm-bullet" data-kind="whatsapp">
                    {isInbound ? <ArrowDownToLine size={16} strokeWidth={2.4} /> : <ArrowUpFromLine size={16} strokeWidth={2.4} />}
                  </div>
                  <div className="kolo-comm-body">
                    <div className="kolo-comm-head">
                      <div className="kolo-comm-title">WhatsApp · {isInbound ? 'reçu' : 'envoyé'}</div>
                      <span className="kolo-comm-time">{formatDate(item.created_at)}</span>
                    </div>
                    {item.body && (
                      <div className="kolo-comm-text">
                        {item.body.slice(0, 200)}{item.body.length > 200 ? '…' : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : !loading ? (
        <div className="kolo-empty" data-testid="comms-empty">
          <div className="kolo-empty-art"><MessageCircle size={36} strokeWidth={1.6} /></div>
          <h3 className="kolo-empty-title">Aucun échange pour le moment</h3>
          <p className="kolo-empty-text">Lance ton premier appel ou WhatsApp depuis les boutons ci-dessus — KOLO archive tout automatiquement.</p>
        </div>
      ) : null}

      {/* Modals */}
      {showPostCall && <PostCallModal prospect={prospect} phoneCalled={phoneCalled} onClose={() => setShowPostCall(false)} onSaved={reload} />}
      {showWA && <WhatsAppQuickModal prospect={prospect} onClose={() => setShowWA(false)} onSent={reload} />}
      {selectedCall && <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} />}
      {showCal && <AddToCalendarModal prospect={prospect} providers={calProviders} onClose={() => setShowCal(false)} onSaved={reload} />}
    </div>
  );
};

export default ProspectCommsPanel;
