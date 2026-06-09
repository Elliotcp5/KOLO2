import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { toast } from 'sonner';
import { CheckCircle2, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

const TitleStyle = { fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 800, marginBottom: 12 };
const PStyle = { color: 'var(--ink-mid)', marginBottom: 24, lineHeight: 1.55 };

const JoinOrgPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { loading: authLoading, isAuthenticated, user } = useAuth();
  const [info, setInfo] = useState(null); // {found, accepted, expired, you_are_member, you_are_in_other_org, other_org_name, org, role}
  const [infoLoading, setInfoLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  // Send unauthenticated users to /login keeping the token for resume
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      localStorage.setItem('kolo_pending_invite', token);
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, token, navigate]);

  // Pre-flight: fetch invite status so we can show the right UI without consuming it
  const fetchInfo = useCallback(async () => {
    setInfoLoading(true);
    try {
      const t = localStorage.getItem('kolo_token');
      const r = await fetch(`${API_URL}/api/orgs/invite/${token}`, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      const d = await r.json().catch(() => ({}));
      setInfo(r.ok ? d : { found: false });
    } catch (_e) {
      setInfo({ found: false, network_error: true });
    } finally {
      setInfoLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    fetchInfo();
  }, [authLoading, isAuthenticated, fetchInfo]);

  // Auto-redirect when user is already a member of this org
  useEffect(() => {
    if (info?.found && info?.you_are_member) {
      toast.success(`Bienvenue dans ${info.org?.name || 'l\'organisation'}`);
      setTimeout(() => navigate('/org'), 800);
    }
  }, [info, navigate]);

  const accept = async () => {
    setAccepting(true); setError(null);
    try {
      const t = localStorage.getItem('kolo_token');
      if (!t) throw new Error('Session expirée — reconnecte-toi.');
      const r = await fetch(`${API_URL}/api/orgs/accept-invite/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = d.detail || `Erreur ${r.status}`;
        throw new Error(typeof msg === 'string' ? msg : 'Erreur inconnue');
      }
      setDone(true);
      localStorage.removeItem('kolo_pending_invite');
      toast.success(`Bienvenue dans ${d.org?.name || 'l\'organisation'}`);
      setTimeout(() => navigate('/org'), 1500);
    } catch (e) {
      const message = e?.message || String(e);
      setError(
        message.includes('Load failed') || message.includes('Failed to fetch')
          ? 'Connexion impossible. Vérifie ta connexion ou réessaie dans quelques secondes.'
          : message,
      );
    }
    finally { setAccepting(false); }
  };

  if (authLoading || !isAuthenticated) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }} data-testid="join-org-page">
        {/* Done state */}
        {done && (
          <>
            <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto 20px' }} />
            <h1 style={TitleStyle}>Tu as rejoint l'organisation&nbsp;!</h1>
            <p style={PStyle}>Redirection en cours…</p>
          </>
        )}

        {/* Loading state (pre-flight) */}
        {!done && infoLoading && (
          <>
            <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--ink-mid)', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--ink-mid)' }}>Vérification de l'invitation…</p>
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </>
        )}

        {/* Invite NOT found */}
        {!done && !infoLoading && info && !info.found && (
          <>
            <AlertCircle size={48} color="#EF4444" style={{ margin: '0 auto 20px' }} />
            <h1 style={TitleStyle}>Invitation introuvable</h1>
            <p style={PStyle}>
              Ce lien n'est plus valide. Demande à l'administrateur de l'organisation un nouveau lien d'invitation.
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 20 }}>
              Connecté en tant que <strong>{user?.email}</strong>
            </p>
            <button
              onClick={() => navigate('/app')}
              data-testid="back-to-app-btn"
              style={{ background: 'var(--grad)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 28px', fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              Retour à mon espace KOLO
            </button>
          </>
        )}

        {/* Already accepted (and you're not a member - someone else accepted it) */}
        {!done && !infoLoading && info?.found && info.accepted && !info.you_are_member && (
          <>
            <AlertCircle size={48} color="#F59E0B" style={{ margin: '0 auto 20px' }} />
            <h1 style={TitleStyle}>Invitation déjà utilisée</h1>
            <p style={PStyle}>
              Cette invitation a été acceptée par un autre utilisateur. Demande à l'administrateur de te renvoyer un nouveau lien.
            </p>
            <button onClick={() => navigate('/app')} style={{ background: 'var(--grad)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 28px', fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Retour à mon espace KOLO
            </button>
          </>
        )}

        {/* Expired */}
        {!done && !infoLoading && info?.found && !info.accepted && info.expired && (
          <>
            <AlertCircle size={48} color="#F59E0B" style={{ margin: '0 auto 20px' }} />
            <h1 style={TitleStyle}>Invitation expirée</h1>
            <p style={PStyle}>
              Ce lien d'invitation a expiré. Demande à l'administrateur de l'organisation un nouveau lien.
            </p>
            <button onClick={() => navigate('/app')} style={{ background: 'var(--grad)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 28px', fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Retour à mon espace KOLO
            </button>
          </>
        )}

        {/* User in another org */}
        {!done && !infoLoading && info?.found && !info.accepted && !info.expired && info.you_are_in_other_org && (
          <>
            <AlertCircle size={48} color="#F59E0B" style={{ margin: '0 auto 20px' }} />
            <h1 style={TitleStyle}>Tu fais déjà partie d'une autre organisation</h1>
            <p style={PStyle}>
              Tu es actuellement membre de <strong>{info.other_org_name || 'une autre organisation'}</strong>.
              Quitte-la depuis ton espace pour rejoindre <strong>{info.org?.name}</strong>.
            </p>
            <button onClick={() => navigate('/org')} style={{ background: 'var(--grad)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 28px', fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Aller à mon espace entreprise
            </button>
          </>
        )}

        {/* Ready to accept */}
        {!done && !infoLoading && info?.found && !info.accepted && !info.expired && !info.you_are_member && !info.you_are_in_other_org && (
          <>
            {info.org?.logo_url && (
              <img
                src={info.org.logo_url}
                alt={info.org.name}
                style={{ maxHeight: 64, maxWidth: 200, objectFit: 'contain', margin: '0 auto 16px', display: 'block' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <h1 style={TitleStyle}>Rejoindre {info.org?.name || 'l\'organisation'}</h1>
            {info.org?.tagline && (
              <p style={{ ...PStyle, fontStyle: 'italic', marginBottom: 8 }}>{info.org.tagline}</p>
            )}
            <p style={PStyle}>
              Tu es invité·e en tant que <strong>{info.role === 'org_admin' ? 'administrateur·trice' : 'membre'}</strong> d'une organisation KOLO.
              En acceptant, tu auras accès à son espace partagé.
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 24 }}>
              Connecté en tant que <strong>{user?.email}</strong>
            </p>
            {error && <div style={{ color: '#EF4444', marginBottom: 16, fontSize: 14 }} data-testid="join-org-error">{error}</div>}
            <button
              data-testid="accept-invite-btn"
              onClick={accept}
              disabled={accepting}
              style={{
                background: info.org?.primary_color ? `linear-gradient(135deg, ${info.org.primary_color}, ${info.org.primary_color}cc)` : 'var(--grad)',
                color: '#fff', border: 'none', borderRadius: 12, padding: '14px 28px',
                fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700,
                cursor: accepting ? 'not-allowed' : 'pointer', opacity: accepting ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              {accepting ? 'En cours…' : <>Accepter l'invitation <ArrowRight size={16} /></>}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default JoinOrgPage;
