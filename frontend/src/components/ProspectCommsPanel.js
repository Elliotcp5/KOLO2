import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Phone, MessageCircle, Eye, Mic, X, Upload, FileAudio, Clock,
  ArrowDownToLine, ArrowUpFromLine,
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
      // 1. Log the call
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

      // 2. Upload audio if provided
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
    <div className="kolo-modal-backdrop" onClick={onClose}>
      <div className="kolo-comm-modal" onClick={(e) => e.stopPropagation()}>
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
  <div className="kolo-modal-backdrop" onClick={onClose}>
    <div className="kolo-comm-modal" onClick={(e) => e.stopPropagation()} data-testid="call-detail-modal">
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
    <div className="kolo-modal-backdrop" onClick={onClose}>
      <div className="kolo-comm-modal" onClick={(e) => e.stopPropagation()}>
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
// Main panel
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

  useEffect(() => { reload(); }, [reload]);

  const call = () => {
    if (!prospect.phone) { toast.error('Pas de numéro de téléphone'); return; }
    setPhoneCalled(prospect.phone);
    // Open native dialer
    window.location.href = `tel:${prospect.phone}`;
    // Show post-call modal after a tiny delay (so the click event flushes)
    setTimeout(() => setShowPostCall(true), 300);
  };

  return (
    <div className="kolo-comm-panel" data-testid="prospect-comms-panel">
      {/* CTA buttons */}
      <div className="kolo-comm-cta-row">
        <button data-testid="prospect-call-btn" onClick={call} className="kolo-comm-cta kolo-cta-call">
          <Phone size={16} strokeWidth={2} />
          <span>Appeler</span>
        </button>
        <button data-testid="prospect-wa-btn" onClick={() => setShowWA(true)} className="kolo-comm-cta kolo-cta-wa">
          <MessageCircle size={16} strokeWidth={2} />
          <span>WhatsApp</span>
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="kolo-comm-history" data-testid="comms-history">
          <div className="kolo-comm-history-header">
            <span>Historique</span>
            <span className="kolo-comm-count">{callsCount} appel{callsCount > 1 ? 's' : ''} · {waCount} message{waCount > 1 ? 's' : ''}</span>
          </div>
          <div className="kolo-comm-history-list">
            {history.slice(0, 8).map((item, idx) => {
              if (item._kind === 'call') {
                return (
                  <button
                    key={item.call_id}
                    data-testid={`history-call-${item.call_id}`}
                    onClick={() => setSelectedCall(item)}
                    className="kolo-comm-history-row"
                  >
                    <div className="kolo-comm-history-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                      <Phone size={14} />
                    </div>
                    <div className="kolo-comm-history-content">
                      <div className="kolo-comm-history-title">
                        Appel · {formatDuration(item.duration_sec)}
                        {item.transcript && <Mic size={11} style={{ marginLeft: 6, opacity: 0.6 }} />}
                      </div>
                      <div className="kolo-comm-history-sub">{formatDate(item.created_at)} · {item.outcome || 'completed'}</div>
                    </div>
                    <Eye size={14} className="kolo-comm-history-eye" />
                  </button>
                );
              }
              return (
                <div key={item.wa_message_id} className="kolo-comm-history-row" style={{ cursor: 'default' }}>
                  <div className="kolo-comm-history-icon" style={{ background: 'rgba(37, 211, 102, 0.1)', color: '#25D366' }}>
                    {item.direction === 'inbound' ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
                  </div>
                  <div className="kolo-comm-history-content">
                    <div className="kolo-comm-history-title">WhatsApp · {item.direction === 'inbound' ? 'reçu' : 'envoyé'}</div>
                    <div className="kolo-comm-history-sub">{formatDate(item.created_at)}{item.body ? ` · ${item.body.slice(0, 60)}${item.body.length > 60 ? '…' : ''}` : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {showPostCall && <PostCallModal prospect={prospect} phoneCalled={phoneCalled} onClose={() => setShowPostCall(false)} onSaved={reload} />}
      {showWA && <WhatsAppQuickModal prospect={prospect} onClose={() => setShowWA(false)} onSent={reload} />}
      {selectedCall && <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} />}
    </div>
  );
};

export default ProspectCommsPanel;
