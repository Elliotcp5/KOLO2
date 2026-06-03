import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users as UsersIcon, BarChart3, FolderOpen, Plug,
  ArrowLeft, Mail, Trash2, RefreshCw, Plus, Phone, MessageCircle,
  Calendar, ExternalLink, Check, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { toast } from 'sonner';
import '../styles/admin.css';
import '../styles/org.css';

const authHeaders = () => {
  const t = localStorage.getItem('kolo_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const api = async (path, options = {}) => {
  const resp = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.detail?.message || data?.detail || `HTTP ${resp.status}`);
  return data;
};

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

// =========================================================================
// Onboarding modal — create the organization
// =========================================================================
const CreateOrgModal = ({ onCreated, onClose }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#8B5CF6');
  const [logo, setLogo] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const r = await api('/api/orgs', { method: 'POST', body: JSON.stringify({ name, primary_color: color, logo_url: logo || null }) });
      toast.success('Organisation créée');
      onCreated(r.org);
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="org-modal-backdrop" onClick={onClose}>
      <div className="org-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Créer votre organisation</h2>
        <p className="org-modal-sub">Un espace dédié pour ton réseau. Tu pourras inviter tes agents juste après.</p>
        <form onSubmit={submit} className="org-form">
          <label>
            <span>Nom du réseau</span>
            <input data-testid="org-create-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Mon Agence Immo" />
          </label>
          <label>
            <span>Couleur primaire</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input data-testid="org-create-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 60, height: 40, padding: 4, border: '1px solid var(--border)', borderRadius: 8 }} />
              <input value={color} onChange={(e) => setColor(e.target.value)} style={{ flex: 1 }} />
            </div>
          </label>
          <label>
            <span>Logo URL (optionnel)</span>
            <input data-testid="org-create-logo" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://..." />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={onClose} className="admin-btn" style={{ flex: 1 }}>Annuler</button>
            <button data-testid="org-create-submit" type="submit" disabled={loading} className="org-btn-primary" style={{ flex: 2 }}>{loading ? 'Création…' : 'Créer l\'organisation'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// Tabs
// =========================================================================
const OrgOverview = ({ org, onEdit }) => (
  <div>
    <div className="admin-section-header">
      <div>
        <h1>{org.name}</h1>
        <p className="admin-section-sub">{org.slug} · Plan {org.plan}</p>
      </div>
      <button data-testid="org-edit-btn" onClick={onEdit} className="admin-icon-btn"><span>Modifier</span></button>
    </div>
    <div className="admin-stat-grid">
      <div className="admin-stat-card">
        <div className="admin-stat-label">Couleur primaire</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <span style={{ width: 36, height: 36, borderRadius: 8, background: org.primary_color, border: '1px solid var(--border)' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{org.primary_color}</span>
        </div>
      </div>
      <div className="admin-stat-card">
        <div className="admin-stat-label">Logo</div>
        {org.logo_url ? (
          <img src={org.logo_url} alt="logo" style={{ maxWidth: '100%', maxHeight: 80, marginTop: 10 }} />
        ) : (
          <div className="admin-stat-sub" style={{ marginTop: 14 }}>Pas de logo configuré</div>
        )}
      </div>
      <div className="admin-stat-card">
        <div className="admin-stat-label">Créée le</div>
        <div className="admin-stat-value" style={{ fontSize: 18 }}>{formatDate(org.created_at)}</div>
      </div>
    </div>
  </div>
);

const EditOrgModal = ({ org, onSaved, onClose }) => {
  const [name, setName] = useState(org.name);
  const [color, setColor] = useState(org.primary_color || '#8B5CF6');
  const [logo, setLogo] = useState(org.logo_url || '');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const r = await api(`/api/orgs/${org.org_id}`, { method: 'PATCH', body: JSON.stringify({ name, primary_color: color, logo_url: logo || null }) });
      toast.success('Organisation mise à jour'); onSaved(r.org);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <div className="org-modal-backdrop" onClick={onClose}>
      <div className="org-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Modifier l'organisation</h2>
        <form onSubmit={submit} className="org-form">
          <label><span>Nom</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label>
            <span>Couleur primaire</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 60, height: 40, padding: 4, border: '1px solid var(--border)', borderRadius: 8 }} />
              <input value={color} onChange={(e) => setColor(e.target.value)} style={{ flex: 1 }} />
            </div>
          </label>
          <label><span>Logo URL</span><input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://..." /></label>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={onClose} className="admin-btn" style={{ flex: 1 }}>Annuler</button>
            <button type="submit" disabled={loading} className="org-btn-primary" style={{ flex: 2 }}>{loading ? '…' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TeamTab = ({ org, isOrgAdmin }) => {
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('org_agent');
  const [lastInvite, setLastInvite] = useState(null);

  const load = useCallback(async () => {
    try { const r = await api(`/api/orgs/${org.org_id}/members`); setMembers(r.members || []); }
    catch (e) { toast.error(e.message); }
  }, [org.org_id]);
  useEffect(() => { load(); }, [load]);

  const invite = async (e) => {
    e.preventDefault();
    try {
      const r = await api(`/api/orgs/${org.org_id}/invite`, { method: 'POST', body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
      setLastInvite(r.invite);
      toast.success('Invitation créée');
      setInviteEmail('');
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (uid) => {
    if (!window.confirm('Retirer ce membre ?')) return;
    try { await api(`/api/orgs/${org.org_id}/members/${uid}`, { method: 'DELETE' }); toast.success('Membre retiré'); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="admin-section-header">
        <div>
          <h1>Équipe</h1>
          <p className="admin-section-sub">{members.length} membre{members.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      {isOrgAdmin && (
        <div className="org-invite-card" data-testid="org-invite-form">
          <h3>Inviter un agent</h3>
          <form onSubmit={invite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input data-testid="invite-email" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="agent@email.com" style={{ flex: 2, minWidth: 200 }} />
            <select data-testid="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ flex: 1, minWidth: 140 }}>
              <option value="org_agent">Agent</option>
              <option value="org_admin">Manager</option>
            </select>
            <button data-testid="invite-submit" type="submit" className="org-btn-primary"><Plus size={16} strokeWidth={2} /> Inviter</button>
          </form>
          {lastInvite && (
            <div className="org-invite-link">
              Lien d'invitation : <code>{window.location.origin}/org/join/{lastInvite.token}</code>
            </div>
          )}
        </div>
      )}

      <div className="admin-table-wrap" data-testid="org-members-list">
        <table className="admin-table">
          <thead><tr><th>Email</th><th>Nom</th><th>Rôle</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id} data-testid={`member-row-${m.user_id}`}>
                <td>{m.email}</td>
                <td>{m.name || '—'}</td>
                <td><span className="admin-pill" style={{ background: '#8B5CF61A', color: '#8B5CF6', borderColor: '#8B5CF633' }}>{m.org_role === 'org_admin' ? 'Manager' : 'Agent'}</span></td>
                <td>{m.subscription_status || '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  {isOrgAdmin && m.user_id !== org.owner_user_id && (
                    <button data-testid={`member-remove-${m.user_id}`} onClick={() => remove(m.user_id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const KPIsTab = ({ org }) => {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { try { setKpis(await api(`/api/orgs/${org.org_id}/kpis`)); } catch (e) { toast.error(e.message); } finally { setLoading(false); } })(); }, [org.org_id]);
  if (loading) return <div className="admin-empty">Chargement…</div>;
  if (!kpis) return <div className="admin-empty">Aucune donnée</div>;
  return (
    <div data-testid="kpis-tab">
      <div className="admin-section-header">
        <div>
          <h1>KPIs équipe</h1>
          <p className="admin-section-sub">{kpis.members_count} agent{kpis.members_count > 1 ? 's' : ''} dans le réseau.</p>
        </div>
      </div>
      <div className="admin-stat-grid">
        <div className="admin-stat-card"><div className="admin-stat-label">Prospects</div><div className="admin-stat-value">{kpis.total_prospects}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Chauds</div><div className="admin-stat-value" style={{ color: '#EF4444' }}>{kpis.by_score.chaud}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Vendus</div><div className="admin-stat-value" style={{ color: '#10B981' }}>{kpis.sold}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Appels passés</div><div className="admin-stat-value">{kpis.calls}</div></div>
      </div>
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Performance par agent</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Agent</th><th>Prospects</th><th>Chauds</th><th>Vendus</th><th>Tâches</th><th>Appels</th></tr></thead>
            <tbody>
              {kpis.breakdown.map((b) => (
                <tr key={b.user_id}>
                  <td>{b.name}</td>
                  <td>{b.prospects}</td>
                  <td>{b.chaud}</td>
                  <td>{b.sold}</td>
                  <td>{b.completed_tasks}</td>
                  <td>{b.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const DataroomTab = ({ org, isOrgAdmin }) => {
  const [entries, setEntries] = useState([]);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries((await api(`/api/orgs/${org.org_id}/dataroom`)).entries || []); } catch (_) {}
    finally { setLoading(false); }
  }, [org.org_id]);
  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    try {
      await api(`/api/orgs/${org.org_id}/dataroom`, { method: 'POST', body: JSON.stringify({ title, url, description: desc }) });
      toast.success('Document ajouté'); setTitle(''); setUrl(''); setDesc(''); load();
    } catch (e) { toast.error(e.message); }
  };
  const remove = async (eid) => {
    if (!window.confirm('Supprimer ce document ?')) return;
    try { await api(`/api/orgs/${org.org_id}/dataroom/${eid}`, { method: 'DELETE' }); toast.success('Supprimé'); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="admin-section-header"><div><h1>Dataroom</h1><p className="admin-section-sub">Documents partagés du réseau (URL, drive, etc.)</p></div></div>
      {isOrgAdmin && (
        <form onSubmit={add} className="org-invite-card" data-testid="dataroom-add-form">
          <h3>Ajouter un document</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 8 }}>
            <input data-testid="dataroom-title" required placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input data-testid="dataroom-url" required placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <input data-testid="dataroom-desc" placeholder="Description (optionnel)" value={desc} onChange={(e) => setDesc(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <button type="submit" className="org-btn-primary"><Plus size={16} /> Ajouter</button>
        </form>
      )}
      {loading ? <div className="admin-empty">Chargement…</div> :
       entries.length === 0 ? <div className="admin-empty">Aucun document.</div> :
       <div className="admin-list" data-testid="dataroom-list">
         {entries.map((e) => (
           <div key={e.entry_id} className="admin-list-row" style={{ cursor: 'default' }}>
             <div>
               <div style={{ fontWeight: 600 }}>{e.title}</div>
               <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--ink-mid)' }}>{e.url} <ExternalLink size={12} style={{ display: 'inline' }} /></a>
               {e.description && <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>{e.description}</div>}
             </div>
             {isOrgAdmin && <button onClick={() => remove(e.entry_id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={16} /></button>}
           </div>
         ))}
       </div>}
    </div>
  );
};

// =========================================================================
// Root
// =========================================================================
const OrgSpace = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState('overview');
  const [org, setOrg] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const loadOrg = useCallback(async () => {
    setLoading(true);
    try { const r = await api('/api/orgs/me'); setOrg(r.org); setRole(r.role); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!authLoading) loadOrg(); }, [authLoading, loadOrg]);

  if (authLoading || loading) return <div className="admin-shell"><div className="admin-empty">Chargement…</div></div>;

  if (!org) {
    return (
      <div className="admin-shell">
        <main className="admin-main">
          <button onClick={() => navigate('/app')} className="admin-icon-btn" style={{ marginBottom: 24 }}><ArrowLeft size={16} /> Retour</button>
          <div className="org-empty-state" data-testid="org-empty-state">
            <Building2 size={48} strokeWidth={1.25} />
            <h1>Tu n'as pas encore d'organisation</h1>
            <p>Crée ton espace pour gérer ton équipe, suivre tes KPIs et partager tes documents.</p>
            <button data-testid="org-create-cta" onClick={() => setShowCreate(true)} className="org-btn-primary">Créer mon organisation</button>
          </div>
          {showCreate && <CreateOrgModal onCreated={(o) => { setOrg(o); setRole('org_admin'); setShowCreate(false); }} onClose={() => setShowCreate(false)} />}
        </main>
      </div>
    );
  }

  const isOrgAdmin = role === 'org_admin';

  return (
    <div className="admin-shell" data-testid="org-space">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          {org.logo_url ? <img src={org.logo_url} alt={org.name} style={{ height: 32, maxWidth: 120 }} /> : <span>{org.name}</span>}
          <span className="admin-brand-dot" style={{ background: org.primary_color }} />
        </div>
        <nav className="admin-nav">
          <button onClick={() => setTab('overview')} className={`admin-sidebar-item ${tab === 'overview' ? 'is-active' : ''}`} data-testid="org-nav-overview"><Building2 size={18} strokeWidth={1.75} /><span>Vue d'ensemble</span></button>
          <button onClick={() => setTab('team')} className={`admin-sidebar-item ${tab === 'team' ? 'is-active' : ''}`} data-testid="org-nav-team"><UsersIcon size={18} strokeWidth={1.75} /><span>Équipe</span></button>
          <button onClick={() => setTab('kpis')} className={`admin-sidebar-item ${tab === 'kpis' ? 'is-active' : ''}`} data-testid="org-nav-kpis"><BarChart3 size={18} strokeWidth={1.75} /><span>KPIs</span></button>
          <button onClick={() => setTab('dataroom')} className={`admin-sidebar-item ${tab === 'dataroom' ? 'is-active' : ''}`} data-testid="org-nav-dataroom"><FolderOpen size={18} strokeWidth={1.75} /><span>Dataroom</span></button>
          <button onClick={() => navigate('/integrations')} className="admin-sidebar-item" data-testid="org-nav-integrations"><Plug size={18} strokeWidth={1.75} /><span>Intégrations</span></button>
        </nav>
        <div className="admin-sidebar-footer">
          <button onClick={() => navigate('/app')} className="admin-logout" style={{ color: 'var(--ink-mid)' }}><ArrowLeft size={16} /><span>Retour à l'app</span></button>
        </div>
      </aside>
      <main className="admin-main">
        {tab === 'overview' && <OrgOverview org={org} onEdit={() => setEditing(true)} />}
        {tab === 'team' && <TeamTab org={org} isOrgAdmin={isOrgAdmin} />}
        {tab === 'kpis' && <KPIsTab org={org} />}
        {tab === 'dataroom' && <DataroomTab org={org} isOrgAdmin={isOrgAdmin} />}
      </main>
      {editing && <EditOrgModal org={org} onSaved={(o) => { setOrg(o); setEditing(false); }} onClose={() => setEditing(false)} />}
    </div>
  );
};

export default OrgSpace;
