import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Phone, MessageCircle, Calendar, Mic, ArrowLeft, ExternalLink,
  Upload, FileAudio, Check, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { toast } from 'sonner';
import '../styles/admin.css';
import '../styles/org.css';

const auth = () => { const t = localStorage.getItem('kolo_token'); return t ? { Authorization: `Bearer ${t}` } : {}; };

const StatusPill = ({ ok, soon, custom }) => (
  <span className={`integration-status-pill ${soon ? 'soon' : ok ? 'ok' : 'ko'}`}>
    {custom || (ok ? <><Check size={12} /> Actif</> : soon ? 'Bientôt' : <><X size={12} /> Non configuré</>)}
  </span>
);

const Card = ({ icon: Icon, title, description, badge, children, color = '#8B5CF6' }) => (
  <div className="integration-card">
    <div className="header">
      <div className="icon-circle" style={{ background: `${color}15`, color }}><Icon size={22} strokeWidth={1.75} /></div>
      <h3>{title}</h3>
      {badge && <span style={{ marginLeft: 'auto' }}>{badge}</span>}
    </div>
    {description && <p className="desc">{description}</p>}
    <div className="actions" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>{children}</div>
  </div>
);

// ===========================================================================
// Native dialer card
// ===========================================================================
const NativeCallCard = () => {
  const [to, setTo] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState('dial'); // dial or log

  const dial = (e) => {
    e.preventDefault();
    if (!to.trim()) return;
    // Open the user's native dialer
    window.location.href = `tel:${to.trim()}`;
    setStep('log');
  };

  const logCall = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/api/integrations/calls/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ to, duration_sec: parseInt(duration || '0', 10), notes, outcome: 'completed' }),
      });
      toast.success('Appel enregistré dans ton historique');
      setTo(''); setDuration(''); setNotes(''); setStep('dial');
    } catch (e) { toast.error('Erreur'); }
  };

  return (
    <Card
      icon={Phone}
      title="Appels (ton numéro)"
      description="Appelle directement depuis ton iPhone, Android ou ton Mac. Le prospect voit ton numéro — pas un numéro Twilio. KOLO enregistre l'historique."
      badge={<StatusPill ok />}
      color="#10B981"
    >
      {step === 'dial' ? (
        <form onSubmit={dial} style={{ display: 'flex', gap: 8 }}>
          <input
            data-testid="native-call-to"
            required
            type="tel"
            placeholder="+33612345678"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 14 }}
          />
          <button data-testid="native-call-btn" type="submit" className="org-btn-primary"><Phone size={14} /> Appeler</button>
        </form>
      ) : (
        <form onSubmit={logCall} style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="call-log-form">
          <div style={{ fontSize: 13, color: 'var(--ink-mid)' }}>Appel passé à <strong>{to}</strong>. Note ce qu'il s'est dit :</div>
          <input data-testid="call-log-duration" type="number" placeholder="Durée en secondes" value={duration} onChange={(e) => setDuration(e.target.value)} style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14 }} />
          <textarea data-testid="call-log-notes" rows={2} placeholder="Notes (optionnel)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 14, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => setStep('dial')} className="admin-btn" style={{ flex: 1 }}>Annuler</button>
            <button data-testid="call-log-submit" type="submit" className="org-btn-primary" style={{ flex: 2 }}>Enregistrer</button>
          </div>
        </form>
      )}
    </Card>
  );
};

// ===========================================================================
// Native WhatsApp card
// ===========================================================================
const NativeWhatsAppCard = () => {
  const [to, setTo] = useState('');
  const [body, setBody] = useState('Bonjour, je suis votre conseiller KOLO. ');

  const send = async (e) => {
    e.preventDefault();
    if (!to.trim() || !body.trim()) return;
    // Open WhatsApp with prefilled message
    const phone = to.trim().replace(/[^\d+]/g, '');
    const text = encodeURIComponent(body);
    window.open(`https://wa.me/${phone.replace('+', '')}?text=${text}`, '_blank');
    // Log it
    try {
      await fetch(`${API_URL}/api/integrations/whatsapp/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ to, body }),
      });
      toast.success('Message envoyé et enregistré');
      setTo(''); setBody('Bonjour, je suis votre conseiller KOLO. ');
    } catch (e) { /* still opened WA */ }
  };

  return (
    <Card
      icon={MessageCircle}
      title="WhatsApp (ton compte)"
      description="Le message s'ouvre dans TON WhatsApp (perso ou Business), avec ton numéro. Tu appuies juste sur 'Envoyer' — et le prospect répond directement sur ton mobile."
      badge={<StatusPill ok />}
      color="#25D366"
    >
      <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          data-testid="native-wa-to"
          required
          type="tel"
          placeholder="+33612345678"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14 }}
        />
        <textarea
          data-testid="native-wa-body"
          required
          rows={2}
          placeholder="Bonjour…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 14, resize: 'vertical' }}
        />
        <button data-testid="native-wa-btn" type="submit" className="org-btn-primary"><MessageCircle size={14} /> Ouvrir dans WhatsApp</button>
      </form>
    </Card>
  );
};

// ===========================================================================
// Whisper upload card
// ===========================================================================
const WhisperCard = ({ configured }) => {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const transcribe = async () => {
    if (!file) return;
    setBusy(true); setResult(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch(`${API_URL}/api/integrations/transcribe-upload`, { method: 'POST', headers: auth(), body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Erreur');
      setResult(d.transcript);
      toast.success(`Transcrit (${d.char_count} caractères)`);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card
      icon={Mic}
      title="Transcription Whisper"
      description="Enregistre ton appel sur ton téléphone, glisse-dépose le fichier audio (mp3, m4a, wav, max 25 Mo) → texte exploitable en français. 50+ langues supportées."
      badge={<StatusPill ok={configured} />}
      color="#F59E0B"
    >
      {!configured ? (
        <div style={{ fontSize: 13, color: 'var(--ink-mid)' }}>EMERGENT_LLM_KEY manquante</div>
      ) : (
        <>
          <div
            data-testid="whisper-dropzone"
            onClick={() => fileRef.current?.click()}
            style={{
              border: '1.5px dashed var(--border)',
              borderRadius: 12,
              padding: 20,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 160ms',
              background: file ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
            }}
          >
            <FileAudio size={28} strokeWidth={1.25} style={{ color: 'var(--ink-mid)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: 'var(--ink-mid)' }}>{file ? file.name : 'Clique ou glisse un fichier audio ici'}</div>
            <input ref={fileRef} data-testid="whisper-file-input" type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <button data-testid="whisper-transcribe-btn" onClick={transcribe} disabled={!file || busy} className="org-btn-primary">
            {busy ? 'Transcription…' : <><Upload size={14} /> Transcrire</>}
          </button>
          {result && (
            <div style={{ marginTop: 10, padding: 12, background: 'rgba(0,0,0,0.04)', borderRadius: 8, fontSize: 13, maxHeight: 140, overflow: 'auto' }} data-testid="whisper-result">
              {result}
            </div>
          )}
        </>
      )}
    </Card>
  );
};

// ===========================================================================
// Google Calendar card
// ===========================================================================
const GoogleCalendarCard = ({ status }) => {
  const [connecting, setConnecting] = useState(false);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (status?.configured) {
      (async () => {
        try {
          const r = await fetch(`${API_URL}/api/integrations/google-calendar/events?max_results=5`, { headers: auth() });
          if (r.ok) {
            const d = await r.json();
            setEvents(d.events || []); setConnected(true);
          }
        } catch (_) {}
      })();
    }
  }, [status?.configured]);

  const connect = async () => {
    setConnecting(true);
    try {
      const r = await fetch(`${API_URL}/api/integrations/google-calendar/auth-url`, { headers: auth() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail);
      window.location.href = d.authorization_url;
    } catch (e) { toast.error(e.message); setConnecting(false); }
  };

  const disconnect = async () => {
    try { await fetch(`${API_URL}/api/integrations/google-calendar/disconnect`, { method: 'POST', headers: auth() }); setConnected(false); setEvents([]); toast.success('Déconnecté'); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <Card
      icon={Calendar}
      title="Google Calendar"
      description="Synchronise tes rendez-vous : crée un événement depuis KOLO, retrouve tes événements Google dans ton tableau de bord."
      badge={<StatusPill ok={status?.configured && connected} custom={!status?.configured ? <><X size={12} /> Non configuré côté serveur</> : null} />}
      color="#4285F4"
    >
      {!status?.configured ? (
        <div style={{ fontSize: 13, color: 'var(--ink-mid)' }}>
          Manque <code>GOOGLE_CAL_CLIENT_ID</code> et <code>GOOGLE_CAL_CLIENT_SECRET</code> dans <code>.env</code>.
          <br /><a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#4285F4' }}>Voir le guide</a>
        </div>
      ) : connected ? (
        <>
          <button data-testid="gcal-disconnect-btn" onClick={disconnect} className="admin-btn" style={{ width: '100%' }}>Déconnecter</button>
          {events.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-mid)', marginBottom: 8 }}>{events.length} prochains événements</div>
              {events.slice(0, 3).map((ev) => (
                <a key={ev.id} href={ev.html_link} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, fontSize: 13, color: 'var(--ink)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.summary || '(sans titre)'}</span>
                  <ExternalLink size={12} />
                </a>
              ))}
            </div>
          )}
        </>
      ) : (
        <button data-testid="gcal-connect-btn" onClick={connect} disabled={connecting} className="org-btn-primary"><Calendar size={14} /> {connecting ? 'Redirection…' : 'Connecter mon Google Calendar'}</button>
      )}
    </Card>
  );
};

// ===========================================================================
// Recent activity widget
// ===========================================================================
const RecentActivity = () => {
  const [calls, setCalls] = useState([]);
  const [wa, setWa] = useState([]);
  useEffect(() => {
    (async () => {
      try { setCalls((await (await fetch(`${API_URL}/api/integrations/calls?limit=10`, { headers: auth() })).json()).calls || []); } catch (_) {}
      try { setWa((await (await fetch(`${API_URL}/api/integrations/whatsapp/messages?limit=10`, { headers: auth() })).json()).messages || []); } catch (_) {}
    })();
  }, []);

  if (calls.length + wa.length === 0) return null;

  return (
    <div style={{ marginTop: 48 }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Activité récente</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
        {calls.length > 0 && (
          <div className="integration-card">
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}><Phone size={16} style={{ display: 'inline', marginRight: 6 }} /> Derniers appels</h3>
            {calls.slice(0, 5).map((c) => (
              <div key={c.call_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span>{c.to}</span>
                <span style={{ color: 'var(--ink-mid)' }}>{c.duration_sec ? `${c.duration_sec}s` : '—'} · {new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            ))}
          </div>
        )}
        {wa.length > 0 && (
          <div className="integration-card">
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}><MessageCircle size={16} style={{ display: 'inline', marginRight: 6 }} /> Derniers WhatsApp</h3>
            {wa.slice(0, 5).map((m) => (
              <div key={m.wa_message_id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{m.to}</strong>
                  <span style={{ color: 'var(--ink-mid)' }}>{new Date(m.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
                <div style={{ color: 'var(--ink-mid)', fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ===========================================================================
// Page
// ===========================================================================
const IntegrationsPage = () => {
  const navigate = useNavigate();
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [statuses, setStatuses] = useState({});
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate('/login'); return; }
    if (searchParams.get('gcal') === 'connected') toast.success('Google Calendar connecté ✅');
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/integrations/status`, { headers: auth() });
        if (r.ok) setStatuses(await r.json());
      } catch (_) {}
    })();
  }, [authLoading, isAuthenticated]); // eslint-disable-line

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <button onClick={() => navigate(-1)} className="admin-icon-btn" style={{ marginBottom: 24 }}><ArrowLeft size={16} /> Retour</button>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 800, margin: '0 0 8px' }}>Intégrations</h1>
        <p style={{ color: 'var(--ink-mid)', marginBottom: 12, maxWidth: 640, lineHeight: 1.55 }}>
          KOLO ne se met jamais entre toi et tes prospects. Tu utilises <strong>ton propre numéro</strong> de téléphone et <strong>ton WhatsApp</strong> — KOLO sert juste à logger les échanges, transcrire et synchroniser ton agenda.
        </p>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 40, fontSize: 13 }}>Pas de coût Twilio par minute. Pas de numéro tiers. Le prospect voit ton numéro.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }} data-testid="integrations-grid">
          <NativeCallCard />
          <NativeWhatsAppCard />
          <WhisperCard configured={statuses?.whisper?.configured} />
          <GoogleCalendarCard status={statuses?.google_calendar} />
          <Card icon={Calendar} title="Outlook Calendar" description="Synchronisation Microsoft 365." badge={<StatusPill soon />} color="#0078D4" />
          <Card icon={Calendar} title="Apple Calendar" description="Synchronisation iCloud via CalDAV." badge={<StatusPill soon />} color="#000000" />
        </div>

        <RecentActivity />
      </div>
    </div>
  );
};

export default IntegrationsPage;
