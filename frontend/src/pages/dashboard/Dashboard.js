import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../pages/marketing/marketing.css';
import './dashboard.css';

const API = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'kolo_dashboard_token';

// ---------------------------------------------------------------------------
// Per-user "Grant Pro / Revoke" actions cell
// ---------------------------------------------------------------------------
const UserGrantActions = ({ user, isPro, onGrant }) => {
  const [months, setMonths] = useState(1);
  return (
    <div className="dash-grant-actions" data-testid={`grant-actions-${user.user_id}`}>
      <select
        className="dash-grant-months"
        value={months}
        onChange={(e) => setMonths(parseInt(e.target.value, 10))}
        aria-label="Nombre de mois"
        data-testid={`grant-months-${user.user_id}`}
      >
        <option value={1}>1 mois</option>
        <option value={2}>2 mois</option>
        <option value={3}>3 mois</option>
        <option value={6}>6 mois</option>
        <option value={12}>12 mois</option>
      </select>
      <button
        className="dash-grant-btn dash-grant-pro"
        onClick={() => onGrant(user, 'pro', months)}
        data-testid={`grant-pro-${user.user_id}`}
      >
        Grant Pro
      </button>
      {isPro && (
        <button
          className="dash-grant-btn dash-grant-revoke"
          onClick={() => onGrant(user, 'free', 0)}
          data-testid={`revoke-${user.user_id}`}
          title="Repasser en Free"
        >
          Révoquer
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// API helper — auto-redirects to /dashboard/login on 401
// ---------------------------------------------------------------------------
const useApi = () => {
  const nav = useNavigate();
  return useCallback(
    async (path, opts = {}) => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        nav('/dashboard/login', { replace: true });
        throw new Error('no token');
      }
      const r = await fetch(`${API}${path}`, {
        ...opts,
        headers: {
          ...(opts.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
      if (r.status === 401 || r.status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        nav('/dashboard/login', { replace: true });
        throw new Error('unauthorized');
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    [nav]
  );
};

// ---------------------------------------------------------------------------
// Small bar chart for time series (pure SVG, no external chart lib)
// ---------------------------------------------------------------------------
const MiniBarChart = ({ data, height = 120, color = '#FFFFFF', label }) => {
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 100 / Math.max(1, data.length);
  return (
    <div className="dash-chart-wrap">
      <div className="dash-chart-label">{label}</div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="dash-chart-svg" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.count / max) * (height - 20);
          return (
            <g key={d.day}>
              <rect
                x={i * w + w * 0.15}
                y={height - h - 4}
                width={w * 0.7}
                height={h}
                fill={color}
                opacity={0.85}
                rx={0.5}
              >
                <title>{`${d.day} — ${d.count}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="dash-chart-x">
        <span>{data[0]?.day || ''}</span>
        <span>{data[data.length - 1]?.day || ''}</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------
const Kpi = ({ label, value, sub, testid }) => (
  <div className="dash-kpi" data-testid={testid}>
    <div className="dash-kpi-label">{label}</div>
    <div className="dash-kpi-value">{value}</div>
    {sub && <div className="dash-kpi-sub">{sub}</div>}
  </div>
);

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------
const Dashboard = () => {
  const api = useApi();
  const nav = useNavigate();
  const [summary, setSummary] = useState(null);
  const [ts, setTs] = useState(null);
  const [topPages, setTopPages] = useState([]);
  const [referrers, setReferrers] = useState([]);
  const [geo, setGeo] = useState([]);
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [hideTest, setHideTest] = useState(true);
  const [search, setSearch] = useState('');
  const [ctaClicks, setCtaClicks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [days, setDays] = useState(30);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    nav('/dashboard/login', { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, tp, rf, g, dv, cta] = await Promise.all([
        api('/api/dashboard/summary'),
        api(`/api/dashboard/timeseries?days=${days}`),
        api(`/api/dashboard/top-pages?days=${days}&limit=15`),
        api(`/api/dashboard/referrers?days=${days}&limit=15`),
        api(`/api/dashboard/geo?days=${days}&limit=20`),
        api(`/api/dashboard/devices?days=${days}`),
        api(`/api/dashboard/cta-clicks?days=${days}`),
      ]);
      setSummary(s);
      setTs(t);
      setTopPages(tp.pages || []);
      setReferrers(rf.referrers || []);
      setGeo(g.locations || []);
      setDevices(dv.devices || []);
      setCtaClicks(cta);
    } catch (e) {
      // Errors already handled by useApi (401 redirect)
    } finally {
      setLoading(false);
    }
  }, [api, days]);

  const loadUsers = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      qs.set('limit', '500');
      qs.set('hide_test', hideTest ? 'true' : 'false');
      if (search.trim()) qs.set('search', search.trim());
      const r = await api(`/api/dashboard/users?${qs.toString()}`);
      setUsers(r.users || []);
      setUsersTotal(r.total || 0);
    } catch (_) { /* redirect handled inside useApi */ }
  }, [api, hideTest, search]);

  const grantPlan = useCallback(async (user, plan, months) => {
    if (!user?.user_id) return;
    const label = plan === 'free' ? 'révoquer Pro' : `accorder ${plan.toUpperCase()} ${months} mois`;
    if (!window.confirm(`Confirmer : ${label} pour ${user.email} ?`)) return;
    try {
      const r = await api(`/api/dashboard/users/${encodeURIComponent(user.user_id)}/grant-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, months }),
      });
      // Update the row inline so the UI feels instant
      setUsers((prev) => prev.map((u) => (u.user_id === user.user_id ? {
        ...u,
        subscription_plan: r.plan,
        subscription_expires_at: r.expires_at,
      } : u)));
      window.alert(
        plan === 'free'
          ? `✅ ${user.email} repassé en Free`
          : `✅ ${user.email} → ${plan.toUpperCase()} pendant ${months} mois\nExpire : ${String(r.expires_at || '').slice(0, 10)}`
      );
    } catch (e) {
      window.alert(`❌ Erreur : ${e.message}`);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'users') loadUsers();
  }, [tab, loadUsers]);

  const plans = summary?.users?.plans || {};

  return (
    <div className="dash-root" data-testid="dashboard-root">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <img src="/kolo-mark-v5-180.png" alt="KOLO" />
            <span>KOLO · Dashboard</span>
          </div>
          <div className="dash-header-actions">
            <select
              className="dash-range"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
              data-testid="dash-range"
            >
              <option value={7}>7 derniers jours</option>
              <option value={30}>30 derniers jours</option>
              <option value={90}>90 jours</option>
              <option value={365}>12 mois</option>
            </select>
            <button className="dash-refresh" onClick={load} data-testid="dash-refresh">Actualiser</button>
            <button className="dash-logout" onClick={logout} data-testid="dash-logout">Déconnexion</button>
          </div>
        </div>
        <nav className="dash-tabs">
          {[
            { id: 'overview', label: 'Vue d\u2019ensemble' },
            { id: 'users', label: `Utilisateurs iOS (${summary?.users?.total ?? '–'})` },
            { id: 'web', label: 'Analytics site' },
            { id: 'cta', label: 'Conversion CTA' },
          ].map((t) => (
            <button
              key={t.id}
              className={`dash-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              data-testid={`dash-tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="dash-main">
        {loading && !summary && <div className="dash-loading">Chargement…</div>}

        {/* -------- OVERVIEW -------- */}
        {tab === 'overview' && summary && (
          <>
            <section className="dash-section">
              <h2 className="dash-section-title">Utilisateurs iOS</h2>
              <div className="dash-kpi-grid">
                <Kpi testid="kpi-total-users" label="Total comptes" value={summary.users.total} />
                <Kpi testid="kpi-new-7d" label="Nouveaux 7j" value={summary.users.new_7d} />
                <Kpi testid="kpi-new-30d" label="Nouveaux 30j" value={summary.users.new_30d} />
                <Kpi
                  testid="kpi-plans"
                  label="Par plan"
                  value={<span style={{ fontSize: 18 }}>{(plans.pro || 0) + (plans.pro_plus || 0)} Pro / {plans.free || 0} Free</span>}
                  sub={plans.pro_plus ? `dont ${plans.pro_plus} Pro+` : ''}
                />
              </div>
            </section>

            <section className="dash-section">
              <h2 className="dash-section-title">Site vitrine (trykolo.io)</h2>
              <div className="dash-kpi-grid">
                <Kpi testid="kpi-pv-7d" label="Pages vues 7j" value={summary.web.pageviews_7d} sub={`Total: ${summary.web.total_pageviews}`} />
                <Kpi testid="kpi-visitors-7d" label="Visiteurs uniques 7j" value={summary.web.unique_visitors_7d} />
                <Kpi testid="kpi-sessions-7d" label="Sessions 7j" value={summary.web.sessions_7d} />
                <Kpi testid="kpi-cta-7d" label="Clics CTA 7j" value={summary.conversion.cta_clicks_7d} sub={`Total: ${summary.conversion.total_cta_clicks}`} />
              </div>
            </section>

            {ts && (
              <section className="dash-section">
                <h2 className="dash-section-title">Tendance sur {days} jours</h2>
                <div className="dash-charts">
                  <MiniBarChart data={ts.pageviews} label="Pages vues / jour" color="#FFFFFF" />
                  <MiniBarChart data={ts.sessions} label="Sessions / jour" color="#B8E1FF" />
                  <MiniBarChart data={ts.signups} label="Nouveaux comptes / jour" color="#FFD1B8" />
                </div>
              </section>
            )}
          </>
        )}

        {/* -------- USERS -------- */}
        {tab === 'users' && (
          <section className="dash-section">
            <div className="dash-users-toolbar">
              <input
                className="dash-search"
                placeholder="Rechercher par email / nom…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
                data-testid="dash-users-search"
              />
              <label className="dash-toggle">
                <input
                  type="checkbox"
                  checked={hideTest}
                  onChange={(e) => setHideTest(e.target.checked)}
                  data-testid="dash-users-hidetest"
                />
                <span>Cacher comptes de test</span>
              </label>
              <span className="dash-count">{users.length} affichés / {usersTotal} au total</span>
            </div>
            <div className="dash-table-wrap">
              <table className="dash-table" data-testid="dash-users-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Email</th>
                    <th>Nom</th>
                    <th>Plan</th>
                    <th>Expire</th>
                    <th>Créé le</th>
                    <th>Dernière connexion</th>
                    <th>Localisation</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.name || '';
                    const loc = [u.last_login_city, u.last_login_country].filter(Boolean).join(', ');
                    const isPro = (u.subscription_plan || 'free') !== 'free';
                    return (
                      <tr key={u.user_id || u.email || i}>
                        <td>{i + 1}</td>
                        <td className="dash-td-email">{u.email}</td>
                        <td>{fullName}</td>
                        <td>
                          <span className={`dash-plan dash-plan-${u.subscription_plan || 'free'}`}>
                            {u.subscription_plan || 'free'}
                          </span>
                        </td>
                        <td>{u.subscription_expires_at ? String(u.subscription_expires_at).slice(0, 10) : '—'}</td>
                        <td>{u.created_at ? String(u.created_at).slice(0, 10) : '—'}</td>
                        <td>{u.last_login_at ? String(u.last_login_at).slice(0, 16).replace('T', ' ') : '—'}</td>
                        <td>{loc || '—'}</td>
                        <td>
                          <UserGrantActions
                            user={u}
                            isPro={isPro}
                            onGrant={grantPlan}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {users.length === 0 && <div className="dash-empty">Aucun utilisateur</div>}
            </div>
          </section>
        )}

        {/* -------- WEB ANALYTICS -------- */}
        {tab === 'web' && (
          <>
            <section className="dash-section">
              <h2 className="dash-section-title">Top pages ({days}j)</h2>
              <table className="dash-table" data-testid="dash-top-pages">
                <thead><tr><th>Page</th><th>Vues</th><th>Uniques</th></tr></thead>
                <tbody>
                  {topPages.map((p) => (
                    <tr key={p.path}>
                      <td className="dash-td-email">{p.path}</td>
                      <td>{p.count}</td>
                      <td>{p.unique_visitors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topPages.length === 0 && <div className="dash-empty">Aucune donnée pour le moment</div>}
            </section>

            <section className="dash-section">
              <h2 className="dash-section-title">Sources de trafic ({days}j)</h2>
              <table className="dash-table" data-testid="dash-referrers">
                <thead><tr><th>Source</th><th>Visites</th></tr></thead>
                <tbody>
                  {referrers.map((r, i) => (
                    <tr key={i}>
                      <td>{r.referrer || 'direct'}</td>
                      <td>{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {referrers.length === 0 && <div className="dash-empty">Aucune donnée</div>}
            </section>

            <div className="dash-2col">
              <section className="dash-section">
                <h2 className="dash-section-title">Localisation ({days}j)</h2>
                <table className="dash-table" data-testid="dash-geo">
                  <thead><tr><th>Pays</th><th>Ville</th><th>Vues</th></tr></thead>
                  <tbody>
                    {geo.map((r, i) => (
                      <tr key={i}>
                        <td>{r.country || '—'}</td>
                        <td>{r.city || '—'}</td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {geo.length === 0 && <div className="dash-empty">Aucune donnée</div>}
              </section>

              <section className="dash-section">
                <h2 className="dash-section-title">Appareils ({days}j)</h2>
                <table className="dash-table" data-testid="dash-devices">
                  <thead><tr><th>Type</th><th>Vues</th></tr></thead>
                  <tbody>
                    {devices.map((d, i) => (
                      <tr key={i}>
                        <td>{d.device}</td>
                        <td>{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {devices.length === 0 && <div className="dash-empty">Aucune donnée</div>}
              </section>
            </div>
          </>
        )}

        {/* -------- CTA -------- */}
        {tab === 'cta' && ctaClicks && (
          <section className="dash-section">
            <h2 className="dash-section-title">Clics CTA ({days}j) — Total : {ctaClicks.total}</h2>
            <table className="dash-table" data-testid="dash-cta-table">
              <thead><tr><th>CTA</th><th>Clics</th></tr></thead>
              <tbody>
                {ctaClicks.by_cta.map((c) => (
                  <tr key={c.cta_id}>
                    <td className="dash-td-email">{c.cta_id}</td>
                    <td>{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ctaClicks.by_cta.length === 0 && <div className="dash-empty">Aucun clic CTA sur cette période</div>}
          </section>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
