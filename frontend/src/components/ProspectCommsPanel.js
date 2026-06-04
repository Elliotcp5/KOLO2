import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Phone, MessageCircle, Eye, Mic, X, FileAudio,
  ArrowDownToLine, ArrowUpFromLine, Calendar, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../config/api';
import { useLocale } from '../context/LocaleContext';
import VoiceDictateButton from './VoiceDictateButton';

const I18N = {
  fr: {
    call: 'Appeler', whatsapp: 'WhatsApp', agenda: 'Agenda',
    callPlaced: 'Appel passé', toward: 'Vers',
    outcome: 'Résultat', durationSec: 'Durée (secondes)',
    audioOpt: 'Enregistrement audio (optionnel)', choose: 'Choisir un fichier…',
    notes: 'Notes', notesPh: 'Ce qui a été dit, prochaine étape…',
    cancel: 'Annuler', save: 'Enregistrer', saving: 'Enregistrement…',
    completed: 'Conversation terminée', noAnswer: 'Pas de réponse', voicemail: 'Messagerie', busy: 'Occupé',
    transcribing: 'Transcription en cours…',
    transcribeFailed: "Transcription échouée — l'appel est tout de même loggé.",
    savedTranscribed: 'Appel enregistré et transcrit ✓', saved: 'Appel enregistré ✓',
    detailTitle: "Détail de l'appel", outcomeLabel: 'Résultat',
    recording: 'Enregistrement', transcription: 'Transcription',
    noTranscript: "Aucune transcription disponible. Tu peux uploader un enregistrement depuis la fiche prospect.",
    sendWA: 'Envoyer un WhatsApp', helloPrefix: 'Bonjour',
    message: 'Message',
    waNotice: "WhatsApp s'ouvrira avec le message pré-rempli. Tu cliques sur \"Envoyer\" depuis ton WhatsApp.",
    openWA: 'Ouvrir WhatsApp', sent: 'Message envoyé et enregistré',
    addToCalendar: 'Ajouter à mon agenda',
    eventTitle: 'Titre', start: 'Début', end: 'Fin',
    descOpt: 'Description (optionnel)', descPh: 'Adresse du RDV, points à aborder…',
    createEvent: "Créer l'événement", creating: 'Création…',
    eventCreated: (p) => `Événement créé dans ${p === 'google' ? 'Google Calendar' : 'Outlook'} ✓`,
    needConnect: "Connecte d'abord Google ou Outlook dans Intégrations.",
    history: 'Historique', calls: 'appel', callsPl: 'appels', msgs: 'message', msgsPl: 'messages',
    callTitle: 'Appel', recv: 'reçu', sent2: 'envoyé', wa2: 'WhatsApp', detail: 'Détail',
    emptyTitle: 'Aucun échange pour le moment',
    emptyText: 'Lance ton premier appel ou WhatsApp depuis les boutons ci-dessus — KOLO archive tout automatiquement.',
    noPhone: 'Pas de numéro de téléphone',
    noPhoneProspect: 'Pas de numéro pour ce prospect',
    appel: 'Appel',
    rdvWith: (n) => `RDV avec ${n}`,
    phoneCol: 'Téléphone',
    prospect: 'prospect',
  },
  en: {
    call: 'Call', whatsapp: 'WhatsApp', agenda: 'Calendar',
    callPlaced: 'Call placed', toward: 'To',
    outcome: 'Outcome', durationSec: 'Duration (seconds)',
    audioOpt: 'Audio recording (optional)', choose: 'Pick a file…',
    notes: 'Notes', notesPh: 'What was said, next step…',
    cancel: 'Cancel', save: 'Save', saving: 'Saving…',
    completed: 'Conversation completed', noAnswer: 'No answer', voicemail: 'Voicemail', busy: 'Busy',
    transcribing: 'Transcribing…',
    transcribeFailed: 'Transcription failed — call still logged.',
    savedTranscribed: 'Call saved and transcribed ✓', saved: 'Call saved ✓',
    detailTitle: 'Call detail', outcomeLabel: 'Outcome',
    recording: 'Recording', transcription: 'Transcript',
    noTranscript: 'No transcript available. You can upload a recording from the prospect page.',
    sendWA: 'Send a WhatsApp', helloPrefix: 'Hi',
    message: 'Message',
    waNotice: 'WhatsApp will open with the message pre-filled. Tap Send from your WhatsApp.',
    openWA: 'Open WhatsApp', sent: 'Message sent and logged',
    addToCalendar: 'Add to my calendar',
    eventTitle: 'Title', start: 'Start', end: 'End',
    descOpt: 'Description (optional)', descPh: 'Meeting address, talking points…',
    createEvent: 'Create event', creating: 'Creating…',
    eventCreated: (p) => `Event created in ${p === 'google' ? 'Google Calendar' : 'Outlook'} ✓`,
    needConnect: 'Connect Google or Outlook first in Integrations.',
    history: 'History', calls: 'call', callsPl: 'calls', msgs: 'message', msgsPl: 'messages',
    callTitle: 'Call', recv: 'received', sent2: 'sent', wa2: 'WhatsApp', detail: 'Detail',
    emptyTitle: 'No conversation yet',
    emptyText: 'Place your first call or WhatsApp from the buttons above — KOLO archives everything automatically.',
    noPhone: 'No phone number',
    noPhoneProspect: 'No phone number for this prospect',
    appel: 'Call',
    rdvWith: (n) => `Meeting with ${n}`,
    phoneCol: 'Phone',
    prospect: 'prospect',
  },
  de: {
    call: 'Anrufen', whatsapp: 'WhatsApp', agenda: 'Kalender',
    callPlaced: 'Anruf getätigt', toward: 'An',
    outcome: 'Ergebnis', durationSec: 'Dauer (Sekunden)',
    audioOpt: 'Audio (optional)', choose: 'Datei wählen…',
    notes: 'Notizen', notesPh: 'Was wurde besprochen, nächster Schritt…',
    cancel: 'Abbrechen', save: 'Speichern', saving: 'Speichern…',
    completed: 'Gespräch beendet', noAnswer: 'Keine Antwort', voicemail: 'Mailbox', busy: 'Besetzt',
    transcribing: 'Transkription läuft…',
    transcribeFailed: 'Transkription fehlgeschlagen — Anruf trotzdem gespeichert.',
    savedTranscribed: 'Anruf gespeichert und transkribiert ✓', saved: 'Anruf gespeichert ✓',
    detailTitle: 'Anrufdetails', outcomeLabel: 'Ergebnis',
    recording: 'Aufnahme', transcription: 'Transkript',
    noTranscript: 'Kein Transkript verfügbar. Du kannst eine Aufnahme hochladen.',
    sendWA: 'WhatsApp senden', helloPrefix: 'Hallo',
    message: 'Nachricht',
    waNotice: 'WhatsApp öffnet sich mit der vorbereiteten Nachricht. Tippe in WhatsApp auf Senden.',
    openWA: 'WhatsApp öffnen', sent: 'Nachricht gesendet und gespeichert',
    addToCalendar: 'Zu meinem Kalender hinzufügen',
    eventTitle: 'Titel', start: 'Beginn', end: 'Ende',
    descOpt: 'Beschreibung (optional)', descPh: 'Adresse, Themen…',
    createEvent: 'Termin erstellen', creating: 'Erstelle…',
    eventCreated: (p) => `Termin in ${p === 'google' ? 'Google Kalender' : 'Outlook'} erstellt ✓`,
    needConnect: 'Verbinde zuerst Google oder Outlook in Integrationen.',
    history: 'Verlauf', calls: 'Anruf', callsPl: 'Anrufe', msgs: 'Nachricht', msgsPl: 'Nachrichten',
    callTitle: 'Anruf', recv: 'empfangen', sent2: 'gesendet', wa2: 'WhatsApp', detail: 'Details',
    emptyTitle: 'Noch keine Unterhaltung',
    emptyText: 'Tätige deinen ersten Anruf oder WhatsApp über die Buttons oben — KOLO archiviert automatisch.',
    noPhone: 'Keine Telefonnummer',
    noPhoneProspect: 'Keine Nummer für diesen Interessenten',
    appel: 'Anruf',
    rdvWith: (n) => `Termin mit ${n}`,
    phoneCol: 'Telefon',
    prospect: 'Interessent',
  },
  it: {
    call: 'Chiama', whatsapp: 'WhatsApp', agenda: 'Calendario',
    callPlaced: 'Chiamata effettuata', toward: 'A',
    outcome: 'Esito', durationSec: 'Durata (secondi)',
    audioOpt: 'Registrazione audio (opzionale)', choose: 'Scegli un file…',
    notes: 'Note', notesPh: 'Cosa è stato detto, prossimo passo…',
    cancel: 'Annulla', save: 'Salva', saving: 'Salvataggio…',
    completed: 'Conversazione terminata', noAnswer: 'Nessuna risposta', voicemail: 'Segreteria', busy: 'Occupato',
    transcribing: 'Trascrizione in corso…',
    transcribeFailed: 'Trascrizione fallita — chiamata comunque salvata.',
    savedTranscribed: 'Chiamata salvata e trascritta ✓', saved: 'Chiamata salvata ✓',
    detailTitle: 'Dettaglio chiamata', outcomeLabel: 'Esito',
    recording: 'Registrazione', transcription: 'Trascrizione',
    noTranscript: 'Nessuna trascrizione disponibile. Puoi caricare una registrazione.',
    sendWA: 'Invia WhatsApp', helloPrefix: 'Ciao',
    message: 'Messaggio',
    waNotice: 'WhatsApp si aprirà con il messaggio precompilato. Tocca Invia da WhatsApp.',
    openWA: 'Apri WhatsApp', sent: 'Messaggio inviato e salvato',
    addToCalendar: 'Aggiungi al mio calendario',
    eventTitle: 'Titolo', start: 'Inizio', end: 'Fine',
    descOpt: 'Descrizione (opzionale)', descPh: 'Indirizzo, punti da affrontare…',
    createEvent: "Crea l'evento", creating: 'Creazione…',
    eventCreated: (p) => `Evento creato in ${p === 'google' ? 'Google Calendar' : 'Outlook'} ✓`,
    needConnect: 'Connetti prima Google o Outlook in Integrazioni.',
    history: 'Storico', calls: 'chiamata', callsPl: 'chiamate', msgs: 'messaggio', msgsPl: 'messaggi',
    callTitle: 'Chiamata', recv: 'ricevuto', sent2: 'inviato', wa2: 'WhatsApp', detail: 'Dettaglio',
    emptyTitle: 'Nessuna conversazione ancora',
    emptyText: 'Effettua la prima chiamata o WhatsApp dai pulsanti sopra — KOLO archivia tutto in automatico.',
    noPhone: 'Nessun numero',
    noPhoneProspect: 'Nessun numero per questo contatto',
    appel: 'Chiamata',
    rdvWith: (n) => `Appuntamento con ${n}`,
    phoneCol: 'Telefono',
    prospect: 'contatto',
  },
};
const useTr = () => {
  const { locale } = useLocale();
  return { tr: I18N[locale] || I18N.en, locale };
};

const auth = () => { const t = localStorage.getItem('kolo_token'); return t ? { Authorization: `Bearer ${t}` } : {}; };

const LOCALE_MAP_DATE = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', it: 'it-IT' };

const formatDate = (iso, locale = 'fr') => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(LOCALE_MAP_DATE[locale] || 'en-US', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
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
  const { tr, locale } = useTr();
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
      if (!r.ok) throw new Error(data.detail || 'Error');
      const callId = data.call.call_id;

      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('prospect_id', prospect.prospect_id);
        fd.append('call_id', callId);
        toast.info(tr.transcribing);
        const upR = await fetch(`${API_URL}/api/integrations/transcribe-upload`, {
          method: 'POST', headers: auth(), body: fd,
        });
        if (!upR.ok) {
          const td = await upR.json().catch(() => ({}));
          toast.error(td.detail || tr.transcribeFailed);
        } else {
          toast.success(tr.savedTranscribed);
        }
      } else {
        toast.success(tr.saved);
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
            <h2>{tr.callPlaced}</h2>
            <p>{tr.toward} <strong>{phoneCalled}</strong> · {prospect.full_name || prospect.name}</p>
          </div>
          <button onClick={onClose} className="kolo-comm-close-btn"><X size={18} /></button>
        </div>
        <form onSubmit={save} className="kolo-comm-form">
          <label>
            <span>{tr.outcome}</span>
            <select data-testid="postcall-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="completed">{tr.completed}</option>
              <option value="no-answer">{tr.noAnswer}</option>
              <option value="voicemail">{tr.voicemail}</option>
              <option value="busy">{tr.busy}</option>
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              <span>{tr.durationSec}</span>
              <input data-testid="postcall-duration" type="number" min="0" placeholder="0" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </label>
            <label>
              <span>{tr.audioOpt}</span>
              <button type="button" onClick={() => fileRef.current?.click()} className="kolo-comm-file-btn">
                <FileAudio size={14} />
                <span>{file ? file.name.slice(0, 22) : tr.choose}</span>
              </button>
              <input ref={fileRef} data-testid="postcall-audio" type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <label>
            <span>{tr.notes}</span>
            <div className="kolo-textarea-with-dictate">
              <textarea data-testid="postcall-notes" rows={4} placeholder={tr.notesPh} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <VoiceDictateButton value={notes} onChange={setNotes} locale={locale} testId="dictate-postcall-notes" />
            </div>
          </label>
          <div className="kolo-comm-actions">
            <button type="button" onClick={onClose} className="kolo-comm-btn-secondary">{tr.cancel}</button>
            <button data-testid="postcall-save" type="submit" disabled={busy} className="kolo-comm-btn-primary">
              {busy ? tr.saving : tr.save}
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
const CallDetailModal = ({ call, onClose }) => {
  const { tr, locale } = useTr();
  return (
  <div className="kolo-modal-backdrop kolo-glass-backdrop" onClick={onClose}>
    <div className="kolo-comm-modal kolo-glass-modal" onClick={(e) => e.stopPropagation()} data-testid="call-detail-modal">
      <div className="kolo-comm-modal-header">
        <div>
          <h2>{tr.detailTitle}</h2>
          <p>{formatDate(call.created_at, locale)} · {formatDuration(call.duration_sec)}</p>
        </div>
        <button onClick={onClose} className="kolo-comm-close-btn"><X size={18} /></button>
      </div>
      <div className="kolo-comm-detail-body">
        <div className="kolo-comm-row"><span>{tr.toward}</span><strong>{call.to}</strong></div>
        <div className="kolo-comm-row"><span>{tr.outcomeLabel}</span><strong>{call.outcome || 'completed'}</strong></div>
        {call.notes && (
          <div className="kolo-comm-block">
            <div className="kolo-comm-block-label">{tr.notes}</div>
            <p>{call.notes}</p>
          </div>
        )}
        {call.recording_url && (
          <div className="kolo-comm-block">
            <div className="kolo-comm-block-label">{tr.recording}</div>
            <audio src={call.recording_url} controls style={{ width: '100%' }} />
          </div>
        )}
        {call.transcript ? (
          <div className="kolo-comm-block">
            <div className="kolo-comm-block-label"><Mic size={12} style={{ display: 'inline', marginRight: 4 }} /> {tr.transcription}</div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{call.transcript}</p>
          </div>
        ) : (
          <div className="kolo-comm-hint">{tr.noTranscript}</div>
        )}
      </div>
    </div>
  </div>
  );
};

// ===========================================================================
// Quick WhatsApp send modal (deep link + log)
// ===========================================================================
const WhatsAppQuickModal = ({ prospect, onClose, onSent }) => {
  const { tr, locale } = useTr();
  const [body, setBody] = useState(`${tr.helloPrefix} ${(prospect.full_name || '').split(' ')[0] || ''}, `);
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!prospect.phone) { toast.error(tr.noPhoneProspect); return; }
    setBusy(true);
    const phoneClean = prospect.phone.replace(/[^\d+]/g, '').replace('+', '');
    const text = encodeURIComponent(body);
    window.open(`https://wa.me/${phoneClean}?text=${text}`, '_blank');
    try {
      await fetch(`${API_URL}/api/integrations/whatsapp/log`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ to: prospect.phone, body, prospect_id: prospect.prospect_id }),
      });
      toast.success(tr.sent);
      onSent && onSent();
    } catch (_) {}
    finally { setBusy(false); onClose(); }
  };

  return (
    <div className="kolo-modal-backdrop kolo-glass-backdrop" onClick={onClose}>
      <div className="kolo-comm-modal kolo-glass-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kolo-comm-modal-header">
          <div>
            <h2>{tr.sendWA}</h2>
            <p>{prospect.full_name} · {prospect.phone}</p>
          </div>
          <button onClick={onClose} className="kolo-comm-close-btn"><X size={18} /></button>
        </div>
        <form onSubmit={send} className="kolo-comm-form">
          <label>
            <span>{tr.message}</span>
            <div className="kolo-textarea-with-dictate">
              <textarea data-testid="wa-quick-body" rows={5} required value={body} onChange={(e) => setBody(e.target.value)} />
              <VoiceDictateButton value={body} onChange={setBody} locale={locale} testId="dictate-wa-body" />
            </div>
          </label>
          <p style={{ fontSize: 12, color: 'var(--ink-mid)', marginBottom: 0 }}>
            {tr.waNotice}
          </p>
          <div className="kolo-comm-actions">
            <button type="button" onClick={onClose} className="kolo-comm-btn-secondary">{tr.cancel}</button>
            <button data-testid="wa-quick-send" type="submit" disabled={busy} className="kolo-comm-btn-primary" style={{ background: '#25D366' }}>
              <MessageCircle size={14} /> {tr.openWA}
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
  const { tr, locale } = useTr();
  const [provider, setProvider] = useState(providers[0] || 'google');
  const [title, setTitle] = useState(tr.rdvWith(prospect.full_name || prospect.name || tr.prospect));
  const start = defaultEventTime();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const [startStr, setStartStr] = useState(toLocalInput(start));
  const [endStr, setEndStr] = useState(toLocalInput(end));
  const [description, setDescription] = useState(prospect.phone ? `${tr.phoneCol} : ${prospect.phone}` : '');
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
      if (!r.ok) throw new Error(d.detail || 'Error');
      toast.success(tr.eventCreated(provider));
      onSaved && onSaved(d);
      onClose();
    } catch (e) { toast.error(typeof e.message === 'string' ? e.message : 'Error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="kolo-modal-backdrop kolo-glass-backdrop" onClick={onClose}>
      <div className="kolo-comm-modal kolo-glass-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kolo-comm-modal-header">
          <div>
            <h2>{tr.addToCalendar}</h2>
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
            <span>{tr.eventTitle}</span>
            <input data-testid="cal-event-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              <span>{tr.start}</span>
              <input data-testid="cal-event-start" type="datetime-local" value={startStr} onChange={(e) => setStartStr(e.target.value)} required />
            </label>
            <label>
              <span>{tr.end}</span>
              <input data-testid="cal-event-end" type="datetime-local" value={endStr} onChange={(e) => setEndStr(e.target.value)} required />
            </label>
          </div>
          <label>
            <span>{tr.descOpt}</span>
            <div className="kolo-textarea-with-dictate">
              <textarea data-testid="cal-event-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tr.descPh} />
              <VoiceDictateButton value={description} onChange={setDescription} locale={locale} testId="dictate-cal-desc" />
            </div>
          </label>
          <div className="kolo-comm-actions">
            <button type="button" onClick={onClose} className="kolo-comm-btn-secondary">{tr.cancel}</button>
            <button data-testid="cal-event-save" type="submit" disabled={busy} className="kolo-comm-btn-primary" style={{ background: 'linear-gradient(135deg, #6D28D9, #EC4899)' }}>
              <Calendar size={14} /> {busy ? tr.creating : tr.createEvent}
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
  const { tr, locale } = useTr();
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
    if (!prospect.phone) { toast.error(tr.noPhone); return; }
    setPhoneCalled(prospect.phone);
    window.location.href = `tel:${prospect.phone}`;
    setTimeout(() => setShowPostCall(true), 300);
  };

  const openCalendar = () => {
    if (calProviders.length === 0) {
      toast.info(tr.needConnect);
      return;
    }
    setShowCal(true);
  };

  return (
    <div className="kolo-comm-panel" data-testid="prospect-comms-panel">
      <div className="kolo-comm-actionbar" data-testid="prospect-action-bar">
        <button data-testid="prospect-call-btn" onClick={call} className="kolo-comm-btn" data-kind="call">
          <span className="icon"><Phone size={16} strokeWidth={2.2} /></span>
          <span>{tr.call}</span>
        </button>
        <button data-testid="prospect-wa-btn" onClick={() => setShowWA(true)} className="kolo-comm-btn" data-kind="whatsapp">
          <span className="icon"><MessageCircle size={16} strokeWidth={2.2} /></span>
          <span>{tr.whatsapp}</span>
        </button>
        <button
          data-testid="prospect-cal-btn"
          onClick={openCalendar}
          className="kolo-comm-btn"
          data-kind="note"
          title={calProviders.length === 0 ? tr.needConnect : `${calProviders.length} ✓`}
        >
          <span className="icon" style={{ background: 'linear-gradient(135deg, #6D28D9, #EC4899)' }}>
            <Calendar size={16} strokeWidth={2.2} />
          </span>
          <span>{tr.agenda}</span>
        </button>
      </div>

      {history.length > 0 ? (
        <div data-testid="comms-history" style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 6px' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, color: '#6B7280' }}>
              {tr.history}
            </span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>
              {callsCount} {callsCount > 1 ? tr.callsPl : tr.calls} · {waCount} {waCount > 1 ? tr.msgsPl : tr.msgs}
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
                          {tr.callTitle} · {formatDuration(item.duration_sec)}
                          {item.transcript && (
                            <Mic size={11} style={{ marginLeft: 6, opacity: 0.7, verticalAlign: 'middle' }} aria-label="Transcribed" />
                          )}
                        </div>
                        <span className="kolo-comm-time">{formatDate(item.created_at, locale)}</span>
                      </div>
                      {item.notes && <div className="kolo-comm-text">{item.notes.slice(0, 140)}{item.notes.length > 140 ? '…' : ''}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <span className="kolo-comm-meta">{item.outcome || 'completed'}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          {tr.detail} <ChevronRight size={12} />
                        </span>
                      </div>
                    </button>
                  </div>
                );
              }
              const isInbound = item.direction === 'inbound';
              return (
                <div key={item.wa_message_id} className="kolo-comm-item">
                  <div className="kolo-comm-bullet" data-kind="whatsapp">
                    {isInbound ? <ArrowDownToLine size={16} strokeWidth={2.4} /> : <ArrowUpFromLine size={16} strokeWidth={2.4} />}
                  </div>
                  <div className="kolo-comm-body">
                    <div className="kolo-comm-head">
                      <div className="kolo-comm-title">{tr.wa2} · {isInbound ? tr.recv : tr.sent2}</div>
                      <span className="kolo-comm-time">{formatDate(item.created_at, locale)}</span>
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
          <h3 className="kolo-empty-title">{tr.emptyTitle}</h3>
          <p className="kolo-empty-text">{tr.emptyText}</p>
        </div>
      ) : null}

      {showPostCall && <PostCallModal prospect={prospect} phoneCalled={phoneCalled} onClose={() => setShowPostCall(false)} onSaved={reload} />}
      {showWA && <WhatsAppQuickModal prospect={prospect} onClose={() => setShowWA(false)} onSent={reload} />}
      {selectedCall && <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} />}
      {showCal && <AddToCalendarModal prospect={prospect} providers={calProviders} onClose={() => setShowCal(false)} onSaved={reload} />}
    </div>
  );
};

export default ProspectCommsPanel;
