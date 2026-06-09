import React, { useEffect, useState } from 'react';
import { ShieldCheck, Trash2, Plus, Copy, X, Loader2, Mail, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../config/api';

const authHeaders = () => {
  const token = localStorage.getItem('kolo_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const AdminsTab = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState({ email: '', role: 'simple_admin' });
  const [inviteResult, setInviteResult] = useState(null);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/admins`, { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        setAdmins(d.admins || []);
      }
    } catch (_e) { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchAdmins(); }, []);

  const sendInvite = async () => {
    const email = invite.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Email invalide');
      return;
    }
    setInviting(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/admins/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email, role: invite.role }),
      });
      if (r.ok) {
        const d = await r.json();
        setInviteResult(d);
        toast.success(`${email} ajouté comme ${invite.role === 'super_admin' ? 'super admin' : 'admin simple'}`);
        fetchAdmins();
      } else {
        const err = await r.json().catch(() => ({}));
        toast.error(err.detail || 'Erreur');
      }
    } catch (_e) { toast.error('Erreur réseau'); }
    setInviting(false);
  };

  const changeRole = async (email, currentRole) => {
    const next = currentRole === 'super_admin' ? 'simple_admin' : 'super_admin';
    if (!window.confirm(`Passer ${email} en ${next === 'super_admin' ? 'super admin' : 'admin simple'} ?`)) return;
    try {
      const r = await fetch(`${API_URL}/api/admin/admins/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ role: next }),
      });
      if (r.ok) {
        toast.success(`Rôle modifié`);
        fetchAdmins();
      } else {
        const err = await r.json().catch(() => ({}));
        toast.error(err.detail || 'Erreur');
      }
    } catch (_e) { toast.error('Erreur réseau'); }
  };

  const removeAdmin = async (email) => {
    if (!window.confirm(`Retirer le statut admin à ${email} ?`)) return;
    try {
      const r = await fetch(`${API_URL}/api/admin/admins/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (r.ok) {
        toast.success('Admin retiré');
        fetchAdmins();
      } else {
        const err = await r.json().catch(() => ({}));
        toast.error(err.detail || 'Erreur');
      }
    } catch (_e) { toast.error('Erreur réseau'); }
  };

  const copyLink = (url) => {
    navigator.clipboard.writeText(url).then(() => toast.success('Lien copié'));
  };

  return (
    <div className="admin-panel" data-testid="admins-tab" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: 'var(--font-heading)' }}>Administrateurs KOLO</h2>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Super admins (accès total) et admins simples (création de marques blanches uniquement).</p>
        </div>
        <button
          onClick={() => { setInviteResult(null); setShowInvite(true); }}
          data-testid="admins-add-btn"
          className="org-btn-primary"
          style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={15} strokeWidth={2.4} /> Ajouter un admin
        </button>
      </div>

      <div className="admin-stat-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: 'center', color: '#6B7280' }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle' }} />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280' }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280' }}>Rôle</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.email} style={{ borderBottom: '1px solid var(--border)' }} data-testid={`admin-row-${a.email}`}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--ink)' }}>
                    <Mail size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle', color: '#9CA3AF' }} />
                    {a.email}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 999,
                      background: a.role === 'super_admin' ? 'rgba(139,92,246,0.13)' : 'rgba(59,130,246,0.13)',
                      color: a.role === 'super_admin' ? '#7C3AED' : '#1D4ED8',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
                    }}>
                      <ShieldCheck size={11} strokeWidth={2.4} />
                      {a.role === 'super_admin' ? 'Super admin' : 'Admin simple'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => changeRole(a.email, a.role)}
                      title="Promouvoir/rétrograder"
                      data-testid={`admin-toggle-role-${a.email}`}
                      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', marginRight: 6, color: 'var(--ink)', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <ArrowUpDown size={12} /> {a.role === 'super_admin' ? 'Rétrograder' : 'Promouvoir'}
                    </button>
                    <button
                      onClick={() => removeAdmin(a.email)}
                      title="Retirer"
                      data-testid={`admin-remove-${a.email}`}
                      style={{ background: 'transparent', border: '1px solid rgba(220,38,38,0.3)', color: '#DC2626', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && (
        <div onClick={() => setShowInvite(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }} data-testid="admin-invite-modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, fontFamily: 'var(--font-heading)' }}>Inviter un administrateur</h3>
              <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><X size={20} /></button>
            </div>

            {!inviteResult ? (
              <>
                <label style={{ display: 'block', fontSize: 13, color: '#6B7280', fontWeight: 600, marginBottom: 6 }}>Email</label>
                <input
                  type="email" placeholder="prenom.nom@exemple.com"
                  value={invite.email}
                  onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                  data-testid="admin-invite-email"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 14, marginBottom: 14 }}
                />
                <label style={{ display: 'block', fontSize: 13, color: '#6B7280', fontWeight: 600, marginBottom: 6 }}>{"Niveau d'accès"}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
                  {[
                    { val: 'simple_admin', title: 'Admin simple', desc: 'Création de marques blanches uniquement' },
                    { val: 'super_admin', title: 'Super admin', desc: 'Accès total à la plateforme' },
                  ].map(opt => (
                    <button key={opt.val}
                      onClick={() => setInvite({ ...invite, role: opt.val })}
                      data-testid={`admin-invite-role-${opt.val}`}
                      style={{
                        padding: '12px 14px', borderRadius: 12,
                        border: `1.5px solid ${invite.role === opt.val ? '#8B5CF6' : 'var(--border)'}`,
                        background: invite.role === opt.val ? 'rgba(139,92,246,0.08)' : 'transparent',
                        cursor: 'pointer', textAlign: 'left',
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{opt.title}</div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4, lineHeight: 1.3 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={sendInvite}
                  disabled={inviting}
                  data-testid="admin-invite-send"
                  className="org-btn-primary"
                  style={{ width: '100%', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', padding: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {inviting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Envoi…</> : <><Mail size={14} /> {"Envoyer l'invitation"}</>}
                </button>
              </>
            ) : (
              <>
                <div style={{ padding: 14, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, marginBottom: 14, color: '#15803D', fontSize: 13 }}>
                  ✅ {inviteResult.email} a été ajouté en {inviteResult.role === 'super_admin' ? 'super admin' : 'admin simple'} (email envoyé).
                </div>
                <label style={{ display: 'block', fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 6 }}>{"Lien d'activation (à partager si l'email n'arrive pas)"}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    readOnly value={inviteResult.invite_url}
                    data-testid="admin-invite-url"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 12, fontFamily: 'monospace' }}
                  />
                  <button onClick={() => copyLink(inviteResult.invite_url)} style={{ padding: '0 14px', borderRadius: 10, background: '#8B5CF6', color: 'white', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Copy size={13} /> Copier
                  </button>
                </div>
                <button
                  onClick={() => { setShowInvite(false); setInviteResult(null); setInvite({ email: '', role: 'simple_admin' }); }}
                  style={{ marginTop: 16, width: '100%', padding: '11px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}
                >
                  Fermer
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminsTab;
