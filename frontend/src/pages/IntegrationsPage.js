import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, MessageCircle, Calendar, Mic, Check, X, ArrowLeft, ExternalLink, Plug } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { toast } from 'sonner';
import '../styles/admin.css';
import '../styles/org.css';

const auth = () => { const t = localStorage.getItem('kolo_token'); return t ? { Authorization: `Bearer ${t}` } : {}; };

const StatusPill = ({ ok, soon, label }) => (
  <span className={`integration-status-pill ${soon ? 'soon' : ok ? 'ok' : 'ko'}`}>
    {ok ? <Check size={12} /> : soon ? null : <X size={12} />}
    {label || (soon ? 'Bientôt' : ok ? 'Connecté' : 'Non configuré')}
  </span>
);

const IntegrationCard = ({ icon: Icon, title, description, status, soon, actions }) => (
  <div className="integration-card">
    <div className="header">
      <div className="icon-circle"><Icon size={22} strokeWidth={1.75} /></div>
      <h3>{title}</h3>
      <span style={{ marginLeft: 'auto' }}><StatusPill ok={status?.configured} soon={soon} /></span>
    </div>
    <p className="desc">{description}</p>
    <div className="actions">{actions}</div>
  </div>
);

const IntegrationsPage = () => {
  const navigate = useNavigate();
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [statuses, setStatuses] = useState({});
  const [calls, setCalls] = useState([]);
  const [gcalEvents, setGcalEvents] = useState([]);
  const [callTo, setCallTo] = useState('');
  const [waTo, setWaTo] = useState('');
  const [waBody, setWaBody] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate('/login'); return; }
    if (searchParams.get('gcal') === 'connected') toast.success('Google Calendar connecté ✅');
    loadAll();
  }, [authLoading, isAuthenticated]); // eslint-disable-line

  const loadAll = async () => {
    try {
      const s = await (await fetch(`${API_URL}/api/integrations/status`, { headers: auth() })).json();
      setStatuses(s);
    } catch (_) {}
    try {
      const c = await (await fetch(`${API_URL}/api/integrations/calls?limit=20`, { headers: auth() })).json();
      setCalls(c.calls || []);
    } catch (_) {}
    if (statuses?.google_calendar?.configured) {
      try {
        const ev = await (await fetch(`${API_URL}/api/integrations/google-calendar/events?max_results=10`, { headers: auth() })).json();
        setGcalEvents(ev.events || []);
      } catch (_) {}
    }
  };

  const initiateCall = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API_URL}/api/integrations/twilio/call`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify({ to: callTo }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Erreur');
      toast.success('Appel initié'); setCallTo(''); loadAll();
    } catch (e) { toast.error(e.message); }
  };

  const sendWA = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API_URL}/api/integrations/whatsapp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify({ to: waTo, body: waBody }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || JSON.stringify(d));
      toast.success('Message envoyé'); setWaTo(''); setWaBody('');
    } catch (e) { toast.error(e.message); }
  };

  const connectGCal = async () => {
    try {
      const r = await fetch(`${API_URL}/api/integrations/google-calendar/auth-url`, { headers: auth() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail);
      window.location.href = d.authorization_url;
    } catch (e) { toast.error(e.message); }
  };

  const disconnectGCal = async () => {
    try { await fetch(`${API_URL}/api/integrations/google-calendar/disconnect`, { method: 'POST', headers: auth() }); toast.success('Déconnecté'); loadAll(); }
    catch (e) { toast.error(e.message); }
  };

  const transcribe = async (callId) => {
    toast.info('Transcription en cours…');
    try {
      const r = await fetch(`${API_URL}/api/integrations/whisper/transcribe`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify({ call_id: callId }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Échec');
      toast.success('Transcrit'); loadAll();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <button onClick={() => navigate(-1)} className="admin-icon-btn" style={{ marginBottom: 24 }}><ArrowLeft size={16} /> Retour</button>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 800, margin: '0 0 8px' }}>Intégrations</h1>
        <p style={{ color: 'var(--ink-mid)', marginBottom: 40 }}>Connecte tes outils pour automatiser appels, messages et agendas.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }} data-testid="integrations-grid">

          {/* Twilio Voice */}
          <IntegrationCard
            icon={Phone}
            title="Appels Twilio"
            description="Click-to-call vers tes prospects, recording auto, transcription via Whisper. Les appels sont historisés."
            status={statuses?.twilio}
            actions={
              statuses?.twilio?.configured ? (
                <form onSubmit={initiateCall} style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <input data-testid="twilio-to-input" required placeholder="+33612345678" value={callTo} onChange={(e) => setCallTo(e.target.value)} style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 14 }} />
                  <button data-testid="twilio-call-btn" type="submit" className="org-btn-primary">Appeler</button>
                </form>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--ink-mid)' }}>
                  Manque : {statuses?.twilio?.missing?.join(', ')}
                </span>
              )
            }
          />

          {/* WhatsApp */}
          <IntegrationCard
            icon={MessageCircle}
            title="WhatsApp Business"
            description="Envoie des messages WhatsApp à tes prospects et reçois leurs réponses dans l'app (webhook Meta automatique)."
            status={statuses?.whatsapp}
            actions={
              statuses?.whatsapp?.configured ? (
                <form onSubmit={sendWA} style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  <input data-testid="wa-to-input" required placeholder="+33612345678" value={waTo} onChange={(e) => setWaTo(e.target.value)} style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 14 }} />
                  <textarea data-testid="wa-body-input" required rows={2} placeholder="Bonjour, …" value={waBody} onChange={(e) => setWaBody(e.target.value)} style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 14, resize: 'vertical' }} />
                  <button data-testid="wa-send-btn" type="submit" className="org-btn-primary">Envoyer</button>
                </form>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--ink-mid)' }}>Manque : {statuses?.whatsapp?.missing?.join(', ')}</span>
              )
            }
          />

          {/* Google Calendar */}
          <IntegrationCard
            icon={Calendar}
            title="Google Calendar"
            description="Synchronise tes rendez-vous : crée un événement depuis KOLO, retrouve tes événements Google dans l'app."
            status={statuses?.google_calendar}
            actions={
              !statuses?.google_calendar?.configured ? (
                <span style={{ fontSize: 13, color: 'var(--ink-mid)' }}>Ajoute GOOGLE_CAL_CLIENT_ID et SECRET dans .env</span>
              ) : (
                <button data-testid="gcal-connect-btn" onClick={connectGCal} className="org-btn-primary">Connecter mon compte Google</button>
              )
            }
          />

          {/* Outlook — soon */}
          <IntegrationCard icon={Calendar} title="Outlook Calendar" description="Synchronisation Microsoft 365 — disponible prochainement." soon actions={<button disabled className="org-btn-primary" style={{ opacity: 0.4, cursor: 'not-allowed' }}>Bientôt disponible</button>} />

          {/* Apple Calendar — soon */}
          <IntegrationCard icon={Calendar} title="Apple Calendar (CalDAV)" description="Synchronisation iCloud Calendar — disponible prochainement." soon actions={<button disabled className="org-btn-primary" style={{ opacity: 0.4, cursor: 'not-allowed' }}>Bientôt disponible</button>} />

          {/* Whisper */}
          <IntegrationCard icon={Mic} title="Transcription Whisper" description="Transcription automatique des appels enregistrés (français + 50 autres langues)." status={statuses?.whisper} actions={<span style={{ fontSize: 13, color: 'var(--ink-mid)' }}>{statuses?.whisper?.configured ? 'Actif sur tous tes enregistrements' : 'EMERGENT_LLM_KEY manquante'}</span>} />
        </div>

        {/* Recent calls list */}
        {calls.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Derniers appels</h2>
            <div className="admin-table-wrap" data-testid="calls-list">
              <table className="admin-table">
                <thead><tr><th>Vers</th><th>Statut</th><th>Durée</th><th>Date</th><th>Action</th></tr></thead>
                <tbody>
                  {calls.map((c) => (
                    <tr key={c.call_id} data-testid={`call-row-${c.call_id}`}>
                      <td>{c.to}</td>
                      <td>{c.status}</td>
                      <td>{c.duration_sec ? `${c.duration_sec}s` : '—'}</td>
                      <td>{new Date(c.created_at).toLocaleString('fr-FR')}</td>
                      <td>
                        {c.recording_url && !c.transcript && <button onClick={() => transcribe(c.call_id)} className="admin-btn">Transcrire</button>}
                        {c.transcript && <details><summary style={{ cursor: 'pointer' }}>Voir transcription</summary><p style={{ fontSize: 13, marginTop: 6 }}>{c.transcript}</p></details>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {gcalEvents.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Prochains événements (Google Calendar)</h2>
            <div className="admin-list">
              {gcalEvents.map((ev) => (
                <a key={ev.id} href={ev.html_link} target="_blank" rel="noopener noreferrer" className="admin-list-row" style={{ textDecoration: 'none' }}>
                  <div><div style={{ fontWeight: 600 }}>{ev.summary || '(sans titre)'}</div><div style={{ fontSize: 13, color: 'var(--ink-mid)' }}>{(ev.start?.dateTime || ev.start?.date) ?? ''}</div></div>
                  <ExternalLink size={16} />
                </a>
              ))}
            </div>
            <button onClick={disconnectGCal} className="admin-btn" style={{ marginTop: 12 }}>Déconnecter Google Calendar</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegrationsPage;
