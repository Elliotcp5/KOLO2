import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users as UsersIcon,
  Briefcase,
  LogOut,
  RefreshCw,
  Search,
  ChevronRight,
  ArrowLeft,
  Building2,
} from 'lucide-react';
import WhiteLabelTab from '../components/WhiteLabelTab';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import '../styles/admin.css';

const STATUS_LABELS = {
  new: { label: 'Nouveau', color: '#3B82F6' },
  contacted: { label: 'Contacté', color: '#F59E0B' },
  converted: { label: 'Converti', color: '#10B981' },
  rejected: { label: 'Refusé', color: '#6B7280' },
};

const SUB_LABELS = {
  active: { label: 'Active', color: '#10B981' },
  trialing: { label: 'Trial', color: '#3B82F6' },
  canceled: { label: 'Cancel', color: '#EF4444' },
  past_due: { label: 'Past due', color: '#F59E0B' },
  none: { label: 'Aucun', color: '#6B7280' },
  expired: { label: 'Expiré', color: '#6B7280' },
};

const authHeaders = () => {
  const token = localStorage.getItem('kolo_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fetchAdmin = async (path) => {
  const resp = await fetch(`${API_URL}${path}`, {
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`Failed: ${path}`);
  return resp.json();
};

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const SidebarItem = ({ icon: Icon, label, active, onClick, testid }) => (
  <button
    data-testid={testid}
    onClick={onClick}
    className={`admin-sidebar-item ${active ? 'is-active' : ''}`}
  >
    <Icon size={18} strokeWidth={1.75} />
    <span>{label}</span>
  </button>
);

const StatCard = ({ label, value, sub, testid }) => (
  <div data-testid={testid} className="admin-stat-card">
    <div className="admin-stat-label">{label}</div>
    <div className="admin-stat-value">{value}</div>
    {sub ? <div className="admin-stat-sub">{sub}</div> : null}
  </div>
);

const StatusPill = ({ value, mapping = STATUS_LABELS }) => {
  const conf = mapping[value] || { label: value, color: '#6B7280' };
  return (
    <span
      className="admin-pill"
      style={{ background: `${conf.color}1A`, color: conf.color, borderColor: `${conf.color}33` }}
    >
      {conf.label}
    </span>
  );
};

// =========================================================================
// Overview tab
// =========================================================================
const Overview = ({ stats, loading, onRefresh }) => (
  <div>
    <div className="admin-section-header">
      <div>
        <h1>Vue d'ensemble</h1>
        <p className="admin-section-sub">KPIs en temps réel — utilisateurs, abonnements, leads B2B.</p>
      </div>
      <button data-testid="admin-refresh-btn" onClick={onRefresh} className="admin-icon-btn" disabled={loading}>
        <RefreshCw size={16} className={loading ? 'spin' : ''} />
        <span>Rafraîchir</span>
      </button>
    </div>

    <div className="admin-stat-grid">
      <StatCard testid="stat-total-users" label="Utilisateurs" value={stats?.users?.total ?? '—'} sub={`+${stats?.users?.recent_signups_7d ?? 0} cette semaine`} />
      <StatCard testid="stat-active-subs" label="Abonnements actifs" value={stats?.users?.active ?? '—'} sub={`${stats?.users?.trialing ?? 0} en trial`} />
      <StatCard testid="stat-leads-new" label="Leads B2B à traiter" value={stats?.leads?.new ?? '—'} sub={`${stats?.leads?.total ?? 0} au total`} />
      <StatCard testid="stat-prospects" label="Prospects (réseau)" value={stats?.prospects_total ?? '—'} />
    </div>

    <div className="admin-stat-grid" style={{ marginTop: 16 }}>
      <StatCard testid="stat-google" label="Comptes Google" value={stats?.users?.google ?? '—'} />
      <StatCard testid="stat-email" label="Comptes email" value={stats?.users?.email ?? '—'} />
      <StatCard testid="stat-leads-converted" label="Leads convertis" value={stats?.leads?.converted ?? '—'} />
      <StatCard testid="stat-leads-contacted" label="Leads contactés" value={stats?.leads?.contacted ?? '—'} />
    </div>
  </div>
);

// =========================================================================
// Leads tab
// =========================================================================
const Leads = () => {
  const [leads, setLeads] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdmin(`/api/admin/leads?status=${statusFilter}&limit=200`);
      setLeads(data.leads || []);
    } catch (e) { /* noop */ }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const updateLead = async (leadId, payload) => {
    setUpdating(true);
    try {
      const resp = await fetch(`${API_URL}/api/admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        const data = await resp.json();
        setSelected(data.lead);
        await load();
      }
    } finally { setUpdating(false); }
  };

  return (
    <div className="admin-grid-2col">
      <div>
        <div className="admin-section-header">
          <div>
            <h1>Leads B2B</h1>
            <p className="admin-section-sub">Demandes de démo entreprises — depuis la page /business.</p>
          </div>
        </div>

        <div className="admin-filter-row" data-testid="leads-filter-row">
          {['all', 'new', 'contacted', 'converted', 'rejected'].map((s) => (
            <button
              key={s}
              data-testid={`leads-filter-${s}`}
              onClick={() => setStatusFilter(s)}
              className={`admin-chip ${statusFilter === s ? 'is-active' : ''}`}
            >
              {s === 'all' ? 'Tous' : (STATUS_LABELS[s]?.label || s)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="admin-empty">Chargement…</div>
        ) : leads.length === 0 ? (
          <div className="admin-empty">Aucun lead pour ce filtre.</div>
        ) : (
          <div className="admin-list" data-testid="admin-leads-list">
            {leads.map((lead) => (
              <button
                key={lead.lead_id}
                data-testid={`lead-row-${lead.lead_id}`}
                onClick={() => setSelected(lead)}
                className={`admin-list-row ${selected?.lead_id === lead.lead_id ? 'is-active' : ''}`}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>{lead.company}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-mid)' }}>{lead.first_name} {lead.last_name} · {lead.size}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{formatDate(lead.created_at)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <StatusPill value={lead.status} />
                  <ChevronRight size={16} strokeWidth={1.5} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {!selected ? (
          <div className="admin-empty">Sélectionne un lead pour voir le détail.</div>
        ) : (
          <div className="admin-detail" data-testid="admin-lead-detail">
            <h2 style={{ margin: 0 }}>{selected.company}</h2>
            <div style={{ color: 'var(--ink-mid)', marginBottom: 16 }}>{selected.size}</div>
            <div className="admin-detail-row"><span>Nom</span><strong>{selected.first_name} {selected.last_name}</strong></div>
            <div className="admin-detail-row"><span>Email</span><strong><a href={`mailto:${selected.email}`}>{selected.email}</a></strong></div>
            <div className="admin-detail-row"><span>Téléphone</span><strong>{selected.phone || '—'}</strong></div>
            <div className="admin-detail-row"><span>Date</span><strong>{formatDate(selected.created_at)}</strong></div>
            <div className="admin-detail-row"><span>Statut</span><strong><StatusPill value={selected.status} /></strong></div>
            {selected.message ? (
              <div className="admin-detail-block">
                <div className="admin-detail-block-label">Message</div>
                <p>{selected.message}</p>
              </div>
            ) : null}
            {selected.admin_notes ? (
              <div className="admin-detail-block">
                <div className="admin-detail-block-label">Notes internes</div>
                <p>{selected.admin_notes}</p>
              </div>
            ) : null}

            <div className="admin-actions-row">
              {['new', 'contacted', 'converted', 'rejected'].map((s) => (
                <button
                  key={s}
                  data-testid={`lead-set-status-${s}`}
                  disabled={updating || selected.status === s}
                  onClick={() => updateLead(selected.lead_id, { status: s })}
                  className={`admin-btn ${selected.status === s ? 'is-active' : ''}`}
                >
                  {STATUS_LABELS[s].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// Users tab
// =========================================================================
const Users = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200', status });
      if (q.trim()) params.append('q', q.trim());
      const data = await fetchAdmin(`/api/admin/users?${params.toString()}`);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e) { /* noop */ }
    finally { setLoading(false); }
  }, [q, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="admin-section-header">
        <div>
          <h1>Utilisateurs</h1>
          <p className="admin-section-sub">{total} comptes — recherche par email / nom.</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={16} strokeWidth={1.5} />
          <input
            data-testid="users-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Email, nom…"
          />
        </div>
        <div className="admin-filter-row">
          {['all', 'active', 'trialing', 'canceled', 'none'].map((s) => (
            <button
              key={s}
              data-testid={`users-filter-${s}`}
              onClick={() => setStatus(s)}
              className={`admin-chip ${status === s ? 'is-active' : ''}`}
            >
              {s === 'all' ? 'Tous' : (SUB_LABELS[s]?.label || s)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="admin-empty">Chargement…</div>
      ) : users.length === 0 ? (
        <div className="admin-empty">Aucun utilisateur.</div>
      ) : (
        <div className="admin-table-wrap" data-testid="admin-users-list">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Nom</th>
                <th>Provider</th>
                <th>Statut</th>
                <th>Plan</th>
                <th>Pays</th>
                <th>Inscrit</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} data-testid={`user-row-${u.user_id}`}>
                  <td>{u.email}</td>
                  <td>{u.name || '—'}</td>
                  <td>{u.auth_provider || '—'}</td>
                  <td><StatusPill value={u.subscription_status || 'none'} mapping={SUB_LABELS} /></td>
                  <td>{u.plan || 'free'}</td>
                  <td>{u.country || '—'}</td>
                  <td>{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// Root component
// =========================================================================
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchAdmin('/api/admin/stats');
      setStats(data);
    } catch (e) { /* noop */ }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="admin-shell" data-testid="kolo-admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>KOLO</span>
          <span className="admin-brand-dot" />
          <span className="admin-brand-tag">Admin</span>
        </div>

        {/* Back to app */}
        <button
          data-testid="admin-back-btn"
          onClick={() => navigate('/app')}
          className="admin-sidebar-item"
          style={{ marginBottom: 8, opacity: 0.85 }}
        >
          <ArrowLeft size={16} strokeWidth={2} />
          <span>Retour à l'app</span>
        </button>

        <nav className="admin-nav">
          <SidebarItem testid="admin-nav-overview" icon={LayoutDashboard} label="Vue d'ensemble" active={tab === 'overview'} onClick={() => setTab('overview')} />
          <SidebarItem testid="admin-nav-leads" icon={Briefcase} label="Leads B2B" active={tab === 'leads'} onClick={() => setTab('leads')} />
          <SidebarItem testid="admin-nav-users" icon={UsersIcon} label="Utilisateurs" active={tab === 'users'} onClick={() => setTab('users')} />
          <SidebarItem testid="admin-nav-whitelabel" icon={Building2} label="Marque blanche" active={tab === 'whitelabel'} onClick={() => setTab('whitelabel')} />
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-card">
            <div className="admin-user-email">{user?.email || '—'}</div>
            <div className="admin-user-role">Super admin</div>
          </div>
          <button data-testid="admin-logout-btn" onClick={handleLogout} className="admin-logout">
            <LogOut size={16} strokeWidth={1.75} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        {tab === 'overview' && <Overview stats={stats} loading={statsLoading} onRefresh={loadStats} />}
        {tab === 'leads' && <Leads />}
        {tab === 'users' && <Users />}
        {tab === 'whitelabel' && <WhiteLabelTab />}
      </main>
    </div>
  );
};

export default AdminDashboard;
