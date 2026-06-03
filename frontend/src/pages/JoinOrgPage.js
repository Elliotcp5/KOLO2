import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { toast } from 'sonner';
import { CheckCircle2, ArrowRight } from 'lucide-react';

const JoinOrgPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { loading: authLoading, isAuthenticated, user } = useAuth();
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      // Save the join token in localStorage so we can resume after login
      localStorage.setItem('kolo_pending_invite', token);
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, token, navigate]);

  const accept = async () => {
    setAccepting(true); setError(null);
    try {
      const t = localStorage.getItem('kolo_token');
      const r = await fetch(`${API_URL}/api/orgs/accept-invite/${token}`, {
        method: 'POST',
        credentials: 'include',
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Erreur');
      setDone(true);
      localStorage.removeItem('kolo_pending_invite');
      toast.success(`Bienvenue dans ${d.org?.name || 'l\'organisation'}`);
      setTimeout(() => navigate('/org'), 1500);
    } catch (e) { setError(e.message); }
    finally { setAccepting(false); }
  };

  if (authLoading) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ maxWidth: 460, textAlign: 'center' }} data-testid="join-org-page">
        {done ? (
          <>
            <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto 20px' }} />
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 800 }}>Tu as rejoint l'organisation !</h1>
            <p style={{ color: 'var(--ink-mid)' }}>Redirection en cours…</p>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 800, marginBottom: 12 }}>Rejoindre l'organisation</h1>
            <p style={{ color: 'var(--ink-mid)', marginBottom: 24 }}>Tu es invité·e en tant que membre d'une organisation KOLO. En acceptant, tu auras accès à son espace partagé.</p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 24 }}>Connecté en tant que <strong>{user?.email}</strong></p>
            {error && <div style={{ color: '#EF4444', marginBottom: 16, fontSize: 14 }}>{error}</div>}
            <button
              data-testid="accept-invite-btn"
              onClick={accept}
              disabled={accepting}
              style={{ background: 'var(--grad)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 28px', fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
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
