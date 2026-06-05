import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users as UsersIcon, BarChart3, FolderOpen, Plug,
  ArrowLeft, Mail, Trash2, RefreshCw, Plus, Phone, MessageCircle,
  Calendar, ExternalLink, Check, X, CreditCard, Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { toast } from 'sonner';
import '../styles/admin.css';
import '../styles/org.css';
import '../styles/app-premium.css';

const authHeaders = () => {
  const t = localStorage.getItem('kolo_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const api = async (path, options = {}) => {
  const resp = await fetch(`${API_URL}${path}`, {
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
const OrgOverview = ({ org, onEdit }) => {
  const initials = (org.name || 'KO').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
  <div>
    {/* Premium hero — branded gradient with logo/initials and animated mesh */}
    <div className="kolo-org-hero" data-testid="org-overview-hero" style={{ '--org-color': org.primary_color || '#8B5CF6' }}>
      <div className="kolo-org-hero-row">
        {org.logo_url ? (
          <img src={org.logo_url} alt={org.name} style={{ width: 64, height: 64, borderRadius: 18, objectFit: 'cover', flexShrink: 0, boxShadow: '0 10px 24px -10px rgba(0,0,0,0.18)' }} />
        ) : (
          <div className="kolo-org-logo">{initials}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="kolo-org-name">{org.name}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="kolo-org-tag">Plan {org.plan}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-soft, #9CA3AF)' }}>·</span>
            <span style={{ fontSize: 12, color: 'var(--ink-mid, #6B7280)', fontFamily: 'monospace' }}>{org.slug}</span>
          </div>
        </div>
        <button data-testid="org-edit-btn" onClick={onEdit} className="admin-icon-btn" style={{ flexShrink: 0 }}><span>Modifier</span></button>
      </div>
    </div>

    <div className="admin-stat-grid" data-stagger>
      <div className="admin-stat-card">
        <div className="admin-stat-label">Couleur primaire</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <span style={{ width: 36, height: 36, borderRadius: 8, background: org.primary_color, border: '1px solid var(--border)', boxShadow: `0 6px 14px -6px ${org.primary_color}` }} />
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
};

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

const ROLE_LABEL = {
  org_agent: 'Agent',
  org_manager: 'Manager',
  org_admin: 'Administrateur',
};
const ROLE_COLOR = {
  org_agent: { bg: '#3B82F61A', fg: '#3B82F6', bd: '#3B82F633' },
  org_manager: { bg: '#F59E0B1A', fg: '#F59E0B', bd: '#F59E0B33' },
  org_admin: { bg: '#8B5CF61A', fg: '#8B5CF6', bd: '#8B5CF633' },
};

const TeamTab = ({ org, isOrgAdmin }) => {
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('org_agent');
  const [inviteManagerId, setInviteManagerId] = useState('');
  const [lastInvite, setLastInvite] = useState(null);
  const [editingMember, setEditingMember] = useState(null);

  const load = useCallback(async () => {
    try { const r = await api(`/api/orgs/${org.org_id}/members`); setMembers(r.members || []); }
    catch (e) { toast.error(e.message); }
  }, [org.org_id]);
  useEffect(() => { load(); }, [load]);

  const managers = members.filter((m) => m.org_role === 'org_manager' || m.org_role === 'org_admin');
  const memberById = (id) => members.find((m) => m.user_id === id);

  const invite = async (e) => {
    e.preventDefault();
    try {
      const body = { email: inviteEmail, role: inviteRole };
      if (inviteRole === 'org_agent' && inviteManagerId) body.manager_id = inviteManagerId;
      const r = await api(`/api/orgs/${org.org_id}/invite`, { method: 'POST', body: JSON.stringify(body) });
      setLastInvite(r.invite);
      toast.success('Invitation créée');
      setInviteEmail(''); setInviteManagerId('');
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (uid) => {
    if (!window.confirm('Retirer ce membre ?')) return;
    try { await api(`/api/orgs/${org.org_id}/members/${uid}`, { method: 'DELETE' }); toast.success('Membre retiré'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const updateMember = async (uid, patch) => {
    try {
      await api(`/api/orgs/${org.org_id}/members/${uid}`, { method: 'PATCH', body: JSON.stringify(patch) });
      toast.success('Membre mis à jour');
      setEditingMember(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="admin-section-header">
        <div>
          <h1>Équipe</h1>
          <p className="admin-section-sub">{members.length} membre{members.length > 1 ? 's' : ''} · {managers.length} manager{managers.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      {isOrgAdmin && (
        <div className="org-invite-card" data-testid="org-invite-form">
          <h3>Inviter un nouveau membre</h3>
          <form onSubmit={invite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <input data-testid="invite-email" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@exemple.com" style={{ flex: 2, minWidth: 200 }} />
            <select data-testid="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ flex: 1, minWidth: 140 }}>
              <option value="org_agent">Agent</option>
              <option value="org_manager">Manager</option>
              <option value="org_admin">Administrateur</option>
            </select>
            {inviteRole === 'org_agent' && managers.length > 0 && (
              <select data-testid="invite-manager" value={inviteManagerId} onChange={(e) => setInviteManagerId(e.target.value)} style={{ flex: 1, minWidth: 160 }}>
                <option value="">Manager (optionnel)…</option>
                {managers.map((mgr) => (
                  <option key={mgr.user_id} value={mgr.user_id}>{mgr.name || mgr.email}</option>
                ))}
              </select>
            )}
            <button data-testid="invite-submit" type="submit" className="org-btn-primary"><Plus size={16} strokeWidth={2} /> Inviter</button>
          </form>
          {lastInvite && (
            <div className="org-invite-link">
              Lien d'invitation : <code>{window.location.origin}/join-org/{lastInvite.token}</code>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join-org/${lastInvite.token}`); toast.success('Copié'); }} style={{ marginLeft: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#8B5CF6' }}>📋 Copier</button>
            </div>
          )}
        </div>
      )}

      <div className="admin-table-wrap" data-testid="org-members-list">
        <table className="admin-table">
          <thead><tr><th>Email</th><th>Nom</th><th>Rôle</th><th>Manager</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => {
              const color = ROLE_COLOR[m.org_role] || ROLE_COLOR.org_agent;
              const mgr = memberById(m.manager_id);
              return (
                <tr key={m.user_id} data-testid={`member-row-${m.user_id}`}>
                  <td>{m.email}</td>
                  <td>{m.name || '—'}</td>
                  <td><span className="admin-pill" style={{ background: color.bg, color: color.fg, borderColor: color.bd }}>{ROLE_LABEL[m.org_role] || 'Agent'}</span></td>
                  <td>{m.org_role === 'org_agent' ? (mgr ? (mgr.name || mgr.email) : '—') : <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>—</span>}</td>
                  <td>{m.subscription_status || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {isOrgAdmin && m.user_id !== org.owner_user_id && (
                      <>
                        <button data-testid={`member-edit-${m.user_id}`} onClick={() => setEditingMember(m)} style={{ background: 'transparent', border: 'none', color: '#8B5CF6', cursor: 'pointer', marginRight: 4 }} title="Modifier">✏️</button>
                        <button data-testid={`member-remove-${m.user_id}`} onClick={() => remove(m.user_id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }} title="Retirer"><Trash2 size={16} /></button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingMember && (
        <MemberEditModal
          member={editingMember}
          managers={managers}
          onClose={() => setEditingMember(null)}
          onSave={(patch) => updateMember(editingMember.user_id, patch)}
        />
      )}
    </div>
  );
};

const MemberEditModal = ({ member, managers, onClose, onSave }) => {
  const [role, setRole] = useState(member.org_role || 'org_agent');
  const [managerId, setManagerId] = useState(member.manager_id || '');
  const eligibleManagers = managers.filter((m) => m.user_id !== member.user_id);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} data-testid="member-edit-modal" style={{ background: 'var(--bg)', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Modifier {member.name || member.email}</h2>
        <p style={{ fontSize: 12, color: 'var(--ink-mid)', marginBottom: 20 }}>{member.email}</p>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-mid)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'block' }}>Rôle</span>
          <select data-testid="member-edit-role" value={role} onChange={(e) => setRole(e.target.value)} className="admin-input" style={{ width: '100%' }}>
            <option value="org_agent">Agent — accès individuel uniquement</option>
            <option value="org_manager">Manager — voit les KPI de son équipe</option>
            <option value="org_admin">Administrateur — accès complet</option>
          </select>
        </label>

        {role === 'org_agent' && (
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-mid)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'block' }}>Manager responsable</span>
            <select data-testid="member-edit-manager" value={managerId} onChange={(e) => setManagerId(e.target.value)} className="admin-input" style={{ width: '100%' }}>
              <option value="">Aucun manager</option>
              {eligibleManagers.map((mgr) => (
                <option key={mgr.user_id} value={mgr.user_id}>{mgr.name || mgr.email} · {ROLE_LABEL[mgr.org_role]}</option>
              ))}
            </select>
          </label>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="admin-btn">Annuler</button>
          <button data-testid="member-edit-save" onClick={() => onSave({ role, manager_id: role === 'org_agent' ? (managerId || '') : null })} className="admin-btn primary" style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', color: 'white', border: 'none' }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
};

const KPIsTab = ({ org }) => {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedManagers, setSelectedManagers] = useState([]);
  const [members, setMembers] = useState([]);

  // Load members for manager filter
  useEffect(() => {
    (async () => {
      try { const r = await api(`/api/orgs/${org.org_id}/members`); setMembers(r.members || []); }
      catch (_e) {}
    })();
  }, [org.org_id]);

  const managers = members.filter((m) => m.org_role === 'org_manager' || m.org_role === 'org_admin');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (selectedManagers.length > 0) params.set('managers', selectedManagers.join(','));
      const qs = params.toString();
      setKpis(await api(`/api/orgs/${org.org_id}/kpis${qs ? `?${qs}` : ''}`));
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [org.org_id, search, selectedManagers]);

  useEffect(() => { reload(); }, [reload]);

  const toggleManager = (mid) => {
    setSelectedManagers((prev) => prev.includes(mid) ? prev.filter((id) => id !== mid) : [...prev, mid]);
  };

  return (
    <div data-testid="kpis-tab">
      <div className="admin-section-header">
        <div>
          <h1>KPIs équipe</h1>
          <p className="admin-section-sub">
            {kpis?.viewer_is_admin ? 'Vue administrateur — accès complet' : 'Vue manager — ton équipe uniquement'}
            {kpis && ` · ${kpis.members_count} membre${kpis.members_count > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', flex: 1, minWidth: 260, maxWidth: 380 }}>
          <Search size={15} color="var(--ink-mid)" />
          <input
            data-testid="kpi-search"
            type="text"
            placeholder="Rechercher un agent par nom ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--ink)' }}
          />
          {search && <button onClick={() => setSearch('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-mid)' }}><X size={14} /></button>}
        </div>

        {/* Manager filter (admin only) */}
        {kpis?.viewer_is_admin && managers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} data-testid="kpi-manager-filter">
            <span style={{ fontSize: 11, color: 'var(--ink-mid)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filtrer par manager</span>
            {managers.map((mgr) => {
              const active = selectedManagers.includes(mgr.user_id);
              return (
                <button
                  key={mgr.user_id}
                  data-testid={`kpi-filter-mgr-${mgr.user_id}`}
                  onClick={() => toggleManager(mgr.user_id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 999,
                    border: '1px solid',
                    borderColor: active ? '#8B5CF6' : 'var(--border)',
                    background: active ? '#8B5CF6' : 'var(--bg)',
                    color: active ? 'white' : 'var(--ink)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {mgr.name || mgr.email} {active && '✓'}
                </button>
              );
            })}
            {selectedManagers.length > 0 && (
              <button onClick={() => setSelectedManagers([])} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-mid)', fontSize: 12, textDecoration: 'underline' }}>Tout effacer</button>
            )}
          </div>
        )}
      </div>

      {loading && !kpis ? (
        <div className="admin-empty">Chargement…</div>
      ) : !kpis ? (
        <div className="admin-empty">Aucune donnée</div>
      ) : (
        <>
          <div className="admin-stat-grid">
            <div className="admin-stat-card"><div className="admin-stat-label">Prospects</div><div className="admin-stat-value">{kpis.total_prospects}</div></div>
            <div className="admin-stat-card"><div className="admin-stat-label">Chauds</div><div className="admin-stat-value" style={{ color: '#EF4444' }}>{kpis.by_score.chaud}</div></div>
            <div className="admin-stat-card"><div className="admin-stat-label">Vendus</div><div className="admin-stat-value" style={{ color: '#10B981' }}>{kpis.sold}</div></div>
            <div className="admin-stat-card"><div className="admin-stat-label">Appels passés</div><div className="admin-stat-value">{kpis.calls}</div></div>
          </div>
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Performance par agent {kpis.breakdown.length === 0 && '(aucun résultat)'}</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Agent</th><th>Rôle</th><th>Prospects</th><th>Chauds</th><th>Vendus</th><th>Tâches</th><th>Appels</th></tr></thead>
                <tbody>
                  {kpis.breakdown.map((b) => {
                    const c = ROLE_COLOR[b.org_role] || ROLE_COLOR.org_agent;
                    return (
                      <tr key={b.user_id}>
                        <td>{b.name}</td>
                        <td><span className="admin-pill" style={{ background: c.bg, color: c.fg, borderColor: c.bd, fontSize: 10 }}>{ROLE_LABEL[b.org_role] || 'Agent'}</span></td>
                        <td>{b.prospects}</td>
                        <td>{b.chaud}</td>
                        <td>{b.sold}</td>
                        <td>{b.completed_tasks}</td>
                        <td>{b.calls}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
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
// Billing tab — seats consumed, monthly cost, checkout
// =========================================================================
const BillingTab = ({ org, isOrgAdmin }) => {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api(`/api/orgs/${org.org_id}/billing`);
      setBilling(r);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [org.org_id]);

  useEffect(() => { load(); }, [load]);

  const checkout = async () => {
    setCheckingOut(true);
    try {
      const r = await api(`/api/orgs/${org.org_id}/billing/checkout`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (r.checkout_url) {
        window.location.href = r.checkout_url;
      } else {
        toast.error('Aucune URL de paiement');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading || !billing) return <div className="admin-empty">Chargement…</div>;

  const pct = billing.seats_max > 0 ? Math.min(100, (billing.seats_used / billing.seats_max) * 100) : 0;
  const isPaid = billing.billing_status === 'active';

  return (
    <div data-testid="org-billing-tab">
      <div className="admin-section-header">
        <div>
          <h1>Facturation</h1>
          <p className="admin-section-sub">Sièges consommés · abonnement mensuel par siège.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Sièges utilisés</div>
          <div className="admin-stat-value" data-testid="billing-seats-used">
            {billing.seats_used} <span style={{ fontSize: 14, color: 'var(--ink-mid)', fontWeight: 400 }}>/ {billing.seats_max}</span>
          </div>
          <div style={{ marginTop: 10, height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: pct >= 100 ? '#EF4444' : pct >= 80 ? '#F59E0B' : 'linear-gradient(90deg, #8B5CF6, #EC4899)',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div className="admin-stat-sub">{billing.seats_available} disponibles</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-label">Prix par siège</div>
          <div className="admin-stat-value">{billing.monthly_price_per_seat_eur}€<span style={{ fontSize: 14, color: 'var(--ink-mid)', fontWeight: 400 }}> / mois</span></div>
          <div className="admin-stat-sub">facturation annuelle</div>
        </div>

        <div className="admin-stat-card" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.06))', border: '1px solid rgba(139,92,246,0.2)' }}>
          <div className="admin-stat-label">Total annuel HT</div>
          <div className="admin-stat-value" data-testid="billing-yearly-total">{billing.yearly_total_eur || billing.monthly_total_eur * 12}€</div>
          <div className="admin-stat-sub">
            {billing.promo_months_free > 0
              ? `${billing.billed_months} mois facturés (économie : ${(billing.yearly_gross_eur - billing.yearly_total_eur).toFixed(2)}€)`
              : `${billing.seats_max} sièges × ${billing.monthly_price_per_seat_eur}€ × 12 mois`}
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-label">Statut</div>
          <div className="admin-stat-value" style={{ color: isPaid ? '#22C55E' : '#F59E0B', fontSize: 18 }}>
            {isPaid ? 'Active' : (billing.billing_status === 'trialing' ? 'Essai' : billing.billing_status)}
          </div>
          {billing.stripe_subscription_id && (
            <div className="admin-stat-sub" style={{ fontFamily: 'monospace', fontSize: 11 }}>
              {billing.stripe_subscription_id.slice(0, 16)}…
            </div>
          )}
        </div>
      </div>

      {isOrgAdmin && !isPaid && (
        <div className="admin-stat-card" style={{ padding: 24, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            Activer l'abonnement annuel
          </h2>
          <p style={{ fontSize: 14, color: 'var(--ink-mid)', marginBottom: 20 }}>
            Paye {billing.yearly_total_eur || billing.monthly_total_eur * 12}€/an pour débloquer {billing.seats_max} sièges et accéder à toutes les fonctionnalités KOLO en marque blanche.
            {billing.promo_months_free > 0 && (
              <> Promotion appliquée : <strong>{billing.promo_months_free} mois offert{billing.promo_months_free > 1 ? 's' : ''}</strong>.</>
            )}
          </p>
          <button
            onClick={checkout}
            disabled={checkingOut}
            data-testid="billing-checkout-btn"
            className="org-btn-primary"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', minWidth: 220 }}
          >
            {checkingOut ? 'Redirection…' : (<><CreditCard size={16} /> Payer avec Stripe</>)}
          </button>
        </div>
      )}

      {isOrgAdmin && isPaid && (
        <div className="admin-stat-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Check size={20} color="#22C55E" />
            <div>
              <div style={{ fontWeight: 700 }}>Abonnement actif</div>
              <div style={{ fontSize: 13, color: 'var(--ink-mid)' }}>Renouvellement automatique chaque mois.</div>
            </div>
          </div>
        </div>
      )}
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
          <button onClick={() => setTab('billing')} className={`admin-sidebar-item ${tab === 'billing' ? 'is-active' : ''}`} data-testid="org-nav-billing"><CreditCard size={18} strokeWidth={1.75} /><span>Facturation</span></button>
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
        {tab === 'billing' && <BillingTab org={org} isOrgAdmin={isOrgAdmin} />}
      </main>
      {editing && <EditOrgModal org={org} onSaved={(o) => { setOrg(o); setEditing(false); }} onClose={() => setEditing(false)} />}
    </div>
  );
};

export default OrgSpace;
