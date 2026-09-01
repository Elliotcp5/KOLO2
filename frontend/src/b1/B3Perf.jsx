// KOLO — B3 : Performances, bandeau réseau, écran de permission notifications.
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';
import b1t, { b1tPlural } from './b1i18n';
import { pendingCount, onNetworkChange } from './b3offline';
import './b1.css';
import './b3.css';

const API = process.env.REACT_APP_BACKEND_URL;
const _tok = () => { try { return localStorage.getItem('kolo_v2_session') || ''; } catch { return ''; } };

async function _get(path) {
  const t = _tok();
  const r = await fetch(`${API}${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ============================================================================
// Bandeau hors ligne (à monter en haut du shell)
// ============================================================================
export function NetworkBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [count, setCount] = useState(() => pendingCount());
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const off = onNetworkChange((o) => {
      setOnline(o);
      if (o) { setFlash(true); setTimeout(() => setFlash(false), 2000); }
      setCount(pendingCount());
    });
    const iv = setInterval(() => setCount(pendingCount()), 3000);
    return () => { off(); clearInterval(iv); };
  }, []);
  if (online && !flash) return null;
  const label = online
    ? b1t('net.synced')
    : count === 0
      ? b1t('net.hors_ligne_zero')
      : b1tPlural('net.hors_ligne', count);
  return (
    <div
      className={`b3-net-banner ${online ? 'b3-net-banner--ok' : 'b3-net-banner--off'}`}
      data-testid="b3-net-banner"
      role="status"
      aria-live="polite"
      aria-label={count > 0 ? b1tPlural('net.aria_pending', count) : label}
    >
      {label}
    </div>
  );
}

// ============================================================================
// Jauge circulaire — SVG anneau + centre.
// ============================================================================
function Ring({ value, max, size, label, sublabel }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const dash = c * pct;
  return (
    <div className="b3-ring" style={{ width: size }} data-testid={`b3-ring-${label}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(236,134,144,0.12)" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke="var(--b1-accent)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </svg>
      <div className="b3-ring-number">{value}</div>
      <div className="b3-ring-label">{label}</div>
      {sublabel && <div className="b3-ring-sub">{sublabel}</div>}
    </div>
  );
}

// ============================================================================
// Courbe cumulée — SVG chemin en aire.
// ============================================================================
function AreaChart({ points }) {
  if (!points || points.length === 0) return null;
  const w = 320, h = 140;
  const maxY = Math.max(1, ...points.map((p) => p.cumule));
  const stepX = w / Math.max(1, points.length - 1);
  const path = points.map((p, i) => {
    const x = i * stepX;
    const y = h - (p.cumule / maxY) * (h - 20) - 6;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const area = `${path} L ${(points.length - 1) * stepX} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="b3-chart" data-testid="b3-chart-mandats">
      <path d={area} fill="rgba(236,134,144,0.15)" />
      <path d={path} fill="none" stroke="var(--b1-accent)" strokeWidth={2.5} strokeLinecap="round" />
      <line x1="0" y1={h-1} x2={w} y2={h-1} stroke="rgba(0,0,0,0.08)" />
    </svg>
  );
}

// ============================================================================
// Page Performances
// ============================================================================
export function PerformancesPage() {
  const navigate = useNavigate();
  const [periode, setPeriode] = useState('mois');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await _get(`/api/me/performances?periode=${periode}`)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [periode]);
  useEffect(() => { load(); }, [load]);

  const j = data?.jauges || { opportunites: 0, demarchees: 0, mandats: 0 };
  const e = data?.entonnoir || {};
  const hasActivity = j.opportunites > 0 || j.demarchees > 0 || j.mandats > 0;
  const hasMandats = j.mandats > 0;

  return (
    <div className="b1-root">
      <div className="b1-screen">
        <div className="b1-screen-header">
          <button className="b1-back-btn" onClick={() => navigate(-1)} aria-label={b1t('sys.retour')} data-testid="b3-perf-back">
            <ArrowLeft size={20} />
          </button>
          <div style={{ width: 40 }} />
          <div style={{ width: 40 }} />
        </div>
        <h1 className="b1-h1" style={{ color: 'var(--b1-accent)', textAlign: 'center' }} data-testid="b3-perf-titre">
          {b1t('perf.titre')}
        </h1>

        {/* Sélecteur période */}
        <div className="b3-periode-tabs" role="tablist" data-testid="b3-perf-periode">
          {['mois', 'trimestre', 'annee'].map((p) => (
            <button
              key={p}
              className="b3-periode-tab"
              data-active={periode === p}
              data-testid={`b3-perf-periode-${p}`}
              onClick={() => setPeriode(p)}
              role="tab"
              aria-selected={periode === p}
            >
              {b1t(`perf.periode.${p}`)}
            </button>
          ))}
        </div>

        {loading && <p className="b1-small" style={{ textAlign: 'center' }}>{b1t('sys.un_instant')}</p>}
        {error && <p className="b1-small" style={{ color: 'var(--b1-danger)', textAlign: 'center' }}>{error}</p>}

        {!loading && !error && !hasActivity && (
          <div className="b1-card" style={{ textAlign: 'center' }} data-testid="b3-perf-vide">
            <div className="b1-h2" style={{ marginBottom: 8 }}>{b1t('perf.vide.titre')}</div>
            <p className="b1-lead">{b1t('perf.vide.texte')}</p>
          </div>
        )}

        {!loading && !error && hasActivity && (
          <>
            <div className="b3-rings">
              <Ring
                value={j.opportunites}
                max={Math.max(j.opportunites, 1)}
                size={140}
                label={b1t('perf.jauge.opportunites')}
              />
              <Ring
                value={j.demarchees}
                max={Math.max(j.opportunites, 1)}
                size={112}
                label={b1t('perf.jauge.demarchees')}
                sublabel={j.opportunites > 0 ? b1t('perf.entonnoir.demarchees', { pct: e.pct_demarchees_sur_opportunites || 0 }) : null}
              />
              <Ring
                value={j.mandats}
                max={Math.max(j.demarchees, 1)}
                size={92}
                label={b1t('perf.jauge.mandats')}
                sublabel={j.demarchees > 0 ? b1t('perf.entonnoir.mandats', { pct: e.pct_mandats_sur_demarchees || 0 }) : null}
              />
            </div>

            <div className="b1-card">
              <div className="b1-h2" style={{ fontSize: 17, marginBottom: 8 }}>
                {b1t(`perf.courbe.${periode}`)}
              </div>
              {hasMandats ? (
                <>
                  <AreaChart points={data?.courbe_mandats || []} />
                  <div className="b1-small" style={{ marginTop: 6 }}>{b1t('perf.axe.cumule')}</div>
                </>
              ) : (
                <p className="b1-lead">{b1t('perf.zero_mandats')}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Écran de permission notifications (après le tour guidé)
// ============================================================================
export function NotifPermissionScreen() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const send = async (decision) => {
    setBusy(true);
    try {
      const t = _tok();
      await fetch(`${API}/api/me/notifications/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ decision }),
      });
      if (decision === 'autorise') {
        // Demande système iOS (Capacitor plugin) — best-effort
        try {
          const mod = await import('@capacitor/push-notifications').catch(() => null);
          if (mod?.PushNotifications) {
            const p = await mod.PushNotifications.requestPermissions();
            if (p.receive === 'granted') await mod.PushNotifications.register();
          }
        } catch {}
      }
    } finally {
      setBusy(false);
      navigate('/app-b1');
    }
  };

  return (
    <div className="b1-root">
      <div className="b1-screen">
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{
            width: 96, height: 96, borderRadius: 999,
            background: 'var(--b1-accent-light)', color: 'var(--b1-accent)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}>
            <span style={{ color: 'var(--b1-accent)', display: 'inline-flex' }}><Bell size={44} /></span>
          </div>
          <h1 className="b1-h1" data-testid="b3-perm-titre">{b1t('notif.perm.titre')}</h1>
          <p className="b1-lead" style={{ marginTop: 12 }}>{b1t('notif.perm.texte')}</p>
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="b1-pill b1-pill--primary b1-pill--fullwidth"
          data-testid="b3-perm-autoriser"
          onClick={() => send('autorise')}
          disabled={busy}
        >
          {b1t('notif.perm.cta')}
        </button>
        <button
          className="b1-veille-inter-lien"
          style={{ color: 'var(--b1-text-muted)' }}
          data-testid="b3-perm-plus-tard"
          onClick={() => send('plus_tard')}
          disabled={busy}
        >
          {b1t('notif.perm.plus_tard')}
        </button>
      </div>
    </div>
  );
}
