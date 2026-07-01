// =============================================================
// KOLO v2 — Extras: Prospecting (DPE + Listings), Guide, Settings
// =============================================================
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ExternalLink, Plus, BookOpen, LogOut, Trash2, X as XIcon } from 'lucide-react';
import V2Layout from '../V2Layout';
import v2api from '../v2api';
import v2t from '../v2i18n';
import '../../styles/v2.css';

const useAuthedUser = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { v2api.me().then(setUser).catch(() => navigate('/app-v2/login')); }, [navigate]);
  return user;
};

// ============================================================
// PROSPECTING
// ============================================================
export const V2ProspectingPage = () => {
  const user = useAuthedUser();
  const navigate = useNavigate();
  const [mode, setMode] = useState('dpe');
  // Multi-sector chips: the user adds several postal codes / cities (ex.
  // "75001", "75002", "Lyon 3"). All chips are sent to the backend as a
  // comma-separated list and the API expands them into an OR clause.
  const [sectors, setSectors] = useState([]);
  const [sectorInput, setSectorInput] = useState('');
  const [score, setScore] = useState('');
  const [age, setAge] = useState('');
  // Committed filters → only these trigger an API call. The raw `sectors`
  // stays a controlled input so the user can type freely (no debounce
  // burning the free 1-search/week quota at every keystroke).
  const [committed, setCommitted] = useState({ sectors: [], score: '', age: '', mode: 'dpe', nonce: 0 });
  const [items, setItems] = useState([]);
  const [source, setSource] = useState('');
  const [quotaError, setQuotaError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const pollTimerRef = React.useRef(null);

  const clearPoll = () => {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
  };

  const addSector = () => {
    const v = sectorInput.trim();
    if (!v) return;
    // Allow comma-pasting "75001, 75002, 75003" → split into individual chips
    const parts = v.split(',').map(p => p.trim()).filter(Boolean);
    const next = [...sectors];
    for (const p of parts) {
      if (!next.some(s => s.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    setSectors(next);
    setSectorInput('');
  };
  const removeSector = (s) => setSectors(prev => prev.filter(x => x !== s));

  const runSearch = () => {
    // Auto-commit any pending text in the input before searching
    let finalSectors = sectors;
    const pending = sectorInput.trim();
    if (pending) {
      const parts = pending.split(',').map(p => p.trim()).filter(Boolean);
      finalSectors = [...sectors];
      for (const p of parts) {
        if (!finalSectors.some(s => s.toLowerCase() === p.toLowerCase())) finalSectors.push(p);
      }
      setSectors(finalSectors);
      setSectorInput('');
    }
    // Blur active input so the iOS keyboard collapses before the loader appears
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (_) {}
    setHasSearched(true);
    setCommitted({ sectors: finalSectors, score, age, mode, nonce: Date.now() });
  };

  const reload = (isPoll = false) => {
    if (!isPoll) {
      setQuotaError('');
      setLoading(true);
      clearPoll();
    }
    const { sectors: secs, score: sc, age: a, mode: m } = committed;
    const sectorParam = (secs || []).join(',');
    if (m === 'dpe') {
      const p = {};
      if (sectorParam) p.sector = sectorParam;
      if (sc) p.score = sc;
      if (a === '30') p.days = 30;
      if (a === '90') p.days = 90;
      v2api.dpe(p)
        .then(r => {
          setItems(r.items || []);
          setSource(r.source || '');
          setLoading(false);
        })
        .catch(e => {
          setItems([]); setSource(''); setLoading(false);
          if ((e.message || '').includes('Quota')) setQuotaError(e.message);
        });
    } else {
      const p = {};
      if (sectorParam) p.sector = sectorParam;
      v2api.listings(p)
        .then(r => {
          const src = r.source || '';
          setItems(r.items || []);
          setSource(src);
          // If still scraping, keep loader on and poll every 8s (max ~3 min)
          if (src === 'scraping_in_progress') {
            pollTimerRef.current = setTimeout(() => reload(true), 8000);
          } else {
            setLoading(false);
            clearPoll();
          }
        })
        .catch(e => {
          setItems([]); setSource(''); setLoading(false); clearPoll();
          if ((e.message || '').includes('Quota')) setQuotaError(e.message);
        });
    }
  };
  // Only trigger an API call when the user explicitly commits the filters
  // (button click or Enter) — NOT on every keystroke.
  useEffect(() => {
    if (!hasSearched) return;
    reload();
    return clearPoll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed.nonce]);
  if (!user) return <div className="v2-app" />;

  const convertToCase = async (it) => {
    try {
      await v2api.createCase({
        type: 'seller',
        contact_ids: [],
        property_kind: 'apartment',
        surface_m2: it.surface || it.surface_m2 || null,
        rooms: it.rooms || null,
        price: it.price || null,
        address: it.address || it.sector || '',
        sectors: [], notes: '',
      });
      alert('Dossier créé ✓');
    } catch (e) { alert(e.message); }
  };

  const canSearch = sectors.length > 0 || sectorInput.trim().length > 0;

  return (
    <V2Layout user={user}>
      <button className="v2-icon-btn" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}><ChevronLeft size={16} /></button>
      <h1 className="v2-hello" style={{ fontSize: 22 }}>{v2t('pige.title')}</h1>
      <div className="v2-filter-tabs" style={{ marginTop: 12 }}>
        <button className={`v2-filter-tab ${mode === 'dpe' ? 'active' : ''}`} onClick={() => setMode('dpe')} data-testid="prosp-dpe">{v2t('pige.dpe')}</button>
        <button className={`v2-filter-tab ${mode === 'ads' ? 'active' : ''}`} onClick={() => setMode('ads')} data-testid="prosp-ads">{v2t('pige.ads')}</button>
      </div>

      <div className="v2-field" style={{ marginTop: 14 }}>
        <label className="v2-label">{v2t('pige.sectors_label')}</label>
        {sectors.length > 0 && (
          <div className="v2-multi" style={{ marginBottom: 8 }} data-testid="prosp-sectors-selected">
            {sectors.map(s => (
              <button
                key={s}
                type="button"
                className="v2-chip-remove"
                onClick={() => removeSector(s)}
                data-testid={`prosp-sector-chip-${s}`}
              >
                {s}
                <span className="xicon"><XIcon size={11} strokeWidth={2.5} /></span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="v2-input"
            value={sectorInput}
            onChange={(e) => setSectorInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addSector();
              }
            }}
            placeholder={v2t('pige.sectors_placeholder')}
            inputMode="search"
            enterKeyHint="done"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            data-testid="prosp-sector"
          />
          <button
            type="button"
            className="v2-btn primary"
            style={{ padding: '13px 16px' }}
            onClick={addSector}
            disabled={!sectorInput.trim()}
            data-testid="prosp-sector-add"
            aria-label="Ajouter ce secteur"
          >
            <Plus size={16} />
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--v2-muted-2)', marginTop: 6 }}>
          {v2t('pige.sectors_hint')}
        </p>
      </div>
      {mode === 'dpe' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="v2-field"><label className="v2-label">Score</label>
            <select className="v2-select" value={score} onChange={(e) => setScore(e.target.value)} data-testid="prosp-score">
              <option value="">Tous</option>{['A','B','C','D','E','F','G'].map(s => <option key={s} value={s}>{s}</option>)}
            </select></div>
          <div className="v2-field"><label className="v2-label">Période</label>
            <select className="v2-select" value={age} onChange={(e) => setAge(e.target.value)} data-testid="prosp-age">
              <option value="">Tous</option><option value="30">- 30 jours</option><option value="90">- 3 mois</option>
            </select></div>
        </div>
      )}

      {/* Explicit "Rechercher" button. Free users only have 1 search per
          week, so we never auto-search on each keystroke — the user has
          to commit their filters explicitly. */}
      <button
        type="button"
        className="v2-btn primary full"
        style={{ marginTop: 8 }}
        onClick={runSearch}
        disabled={loading || !canSearch}
        data-testid="prosp-search"
      >
        {loading
          ? 'Recherche…'
          : (canSearch
              ? `Rechercher ${sectors.length + (sectorInput.trim() ? 1 : 0) > 1 ? `· ${sectors.length + (sectorInput.trim() ? 1 : 0)} secteurs` : (sectors[0] ? `· ${sectors[0]}` : `· ${sectorInput.trim()}`)}`
              : 'Ajoute au moins un secteur')}
      </button>

      {!hasSearched && !loading && (
        <div style={{ marginTop: 18, fontSize: 13.5, color: 'var(--v2-muted)', textAlign: 'center', lineHeight: 1.5 }} data-testid="prosp-empty-hint">
          Empile un ou plusieurs secteurs — par ex. <strong style={{ color: 'var(--v2-ink)' }}>75001</strong>, <strong style={{ color: 'var(--v2-ink)' }}>75002</strong>, <strong style={{ color: 'var(--v2-ink)' }}>Lyon 3</strong> — puis touche <strong style={{ color: 'var(--v2-ink)' }}>Rechercher</strong>.
        </div>
      )}

      {quotaError && (
        <div
          className="v2-card"
          style={{ marginTop: 14, background: 'linear-gradient(135deg, #FEF3C7 0%, #FCE7F3 100%)', border: '1px solid #FCD34D' }}
          data-testid="prosp-quota-error"
        >
          <div style={{ fontWeight: 600, color: '#92400E', fontSize: 14 }}>Quota gratuit atteint</div>
          <div style={{ color: '#7C2D12', fontSize: 13.5, marginTop: 4 }}>{quotaError}</div>
          <button
            className="v2-btn primary"
            style={{ marginTop: 10 }}
            onClick={() => navigate('/app-v2/settings/subscription')}
            data-testid="prosp-quota-upgrade"
          >
            Passer Pro · 24,99€/mois
          </button>
        </div>
      )}

      {/* Unified loader - clean spinner "Analyse en cours" */}
      {loading && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '18px 16px', marginTop: 14,
            background: 'var(--v2-surface)',
            border: '1px solid var(--v2-line)',
            borderRadius: 14,
          }}
          data-testid="prosp-loading"
        >
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: '2.5px solid rgba(10,132,255,0.18)',
            borderTopColor: '#0A84FF',
            animation: 'v2spin 0.8s linear infinite',
          }} />
          <div style={{ fontSize: 14, color: 'var(--v2-ink)', fontWeight: 500 }}>
            Analyse en cours…
            <div style={{ fontSize: 12, color: 'var(--v2-muted)', marginTop: 2, fontWeight: 400 }}>
              {mode === 'ads' ? 'Tu peux quitter cette page, on te notifie dès que c\'est prêt.' : 'Récupération des données ADEME en temps réel.'}
            </div>
          </div>
        </div>
      )}

      {mode === 'ads' && source === 'not_subscribed' && !loading && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 12, padding: '10px 14px', marginTop: 12, fontSize: 12.5 }} data-testid="prosp-not-subscribed">
          Service Pige indisponible — réessaie dans quelques minutes.
        </div>
      )}

      {mode === 'dpe' ? items.map((it, i) => (
        <div key={i} className="v2-card" style={{ marginBottom: 10 }} data-testid={`prosp-dpe-item-${i}`}>
          <div className="v2-row-title">{it.address}</div>
          <div className="v2-row-sub">
            {it.surface ? `Surface ${it.surface}m² · ` : ''}Énergie {it.energy} · Climat {it.climate} · {it.issued_at}
            {it.building_type ? ` · ${it.building_type}` : ''}
            {it.construction_period ? ` · Constr. ${it.construction_period}` : (it.construction_year ? ` · ${it.construction_year}` : '')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <a
              className="v2-btn secondary"
              href={it.dpe_url || `https://observatoire-dpe-audit.ademe.fr/afficher-dpe/${encodeURIComponent(it.numero_dpe || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`prosp-dpe-open-${i}`}
            >
              Voir la fiche DPE <ExternalLink size={14} />
            </a>
            <button className="v2-btn primary" onClick={() => convertToCase(it)} data-testid={`prosp-dpe-convert-${i}`}>
              <Plus size={14} /> Dossier
            </button>
          </div>
        </div>
      )) : items.map((it, i) => (
        <div key={i} className="v2-card" style={{ marginBottom: 10 }} data-testid={`prosp-ad-item-${i}`}>
          <div className="v2-row-title">{it.title}</div>
          <div className="v2-row-sub">{it.sector} · {it.surface}m² · {it.rooms}p · {it.price?.toLocaleString('fr-FR')}€ · {it.kind === 'pro' ? 'Pro' : 'Particulier'}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <a className="v2-btn secondary" href={it.url} target="_blank" rel="noopener noreferrer">Voir plus <ExternalLink size={14} /></a>
            <button className="v2-btn primary" onClick={() => convertToCase(it)} data-testid={`prosp-ad-convert-${i}`}>
              <Plus size={14} /> Dossier
            </button>
          </div>
        </div>
      ))}
    </V2Layout>
  );
};

// ============================================================
// GUIDE KOLO
// ============================================================
export const V2GuidePage = () => {
  const user = useAuthedUser();
  const navigate = useNavigate();
  const guides = [
    { title: 'Démarrer en 3 minutes', body: "Crée ton premier contact, ton premier dossier, et dicte ta première note terrain. Tu es opérationnel." },
    { title: 'La règle des 7 contacts', body: "80% des deals se signent entre le 5e et le 12e contact. Programme tes relances dès le premier RDV." },
    { title: 'La bonne note terrain', body: 'Toujours : qui, ce qui s\'est dit, prochaine étape, deadline. Ne dépasse pas 30 secondes.' },
    { title: 'WhatsApp vs Email', body: 'WhatsApp pour le suivi conversationnel (taux de réponse x3). Email pour les pièces écrites.' },
    { title: 'Découper ton secteur', body: "Trop large = inefficace. Découpe par micro-zones de 800 à 1500 logements pour densifier ta présence." },
  ];
  if (!user) return <div className="v2-app" />;
  return (
    <V2Layout user={user}>
      <button className="v2-icon-btn" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}><ChevronLeft size={16} /></button>
      <h1 className="v2-hello" style={{ fontSize: 22 }}>Guide KOLO</h1>
      <p className="v2-card-body" style={{ marginTop: 0 }}>Astuces métier et tips d'utilisation pour maîtriser KOLO en quelques minutes.</p>
      {guides.map((g, i) => (
        <div key={i} className="v2-card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="v2-row-avatar" style={{ width: 36, height: 36 }}><BookOpen size={16} /></div>
            <div className="v2-row-title">{g.title}</div>
          </div>
          <div className="v2-card-body" style={{ marginTop: 8 }}>{g.body}</div>
        </div>
      ))}
    </V2Layout>
  );
};

// ============================================================
// REFERRAL — parrainage avec lien unique
// ============================================================
export const V2ReferralPage = () => {
  const user = useAuthedUser();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { v2api.myReferral().then(setData).catch(() => {}); }, []);
  if (!user) return <div className="v2-app" />;
  const copy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.share_url);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <V2Layout user={user}>
      <button className="v2-icon-btn" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}><ChevronLeft size={16} /></button>
      <h1 className="v2-hello" style={{ fontSize: 26 }}>Parrainage</h1>
      <p className="v2-card-body" style={{ marginTop: 4 }}>Chaque ami qui passe Pro grâce à ton lien te fait gagner 1 mois Pro offert. Sans limite.</p>

      <div className="v2-referral-card" style={{ marginTop: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#A5B4FC' }}>Ton lien unique</div>
        <div className="v2-referral-link" data-testid="referral-link">{data?.share_url || 'Chargement…'}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="v2-btn ai-btn full" onClick={copy} disabled={!data} data-testid="referral-copy">
            {copied ? '✓ Copié' : 'Copier le lien'}
          </button>
          <button className="v2-btn secondary" onClick={() => navigator.share && navigator.share({ title: 'KOLO', text: 'Découvre KOLO, le copilote IA des agents immo', url: data?.share_url })} aria-label="Share">
            Partager
          </button>
        </div>
      </div>

      <div className="v2-grid-2" style={{ marginTop: 16 }}>
        <div className="v2-stat-card">
          <div className="v2-stat-num">{data?.referrals_total ?? 0}</div>
          <div className="v2-stat-label">Filleuls inscrits</div>
        </div>
        <div className="v2-stat-card">
          <div className="v2-stat-num">{data?.free_months_earned ?? 0}</div>
          <div className="v2-stat-label">Mois Pro gagnés</div>
        </div>
      </div>

      <div className="v2-card" style={{ marginTop: 16 }}>
        <div className="v2-tag">Comment ça marche</div>
        <ul style={{ paddingLeft: 18, marginTop: 10, fontSize: 14, color: 'var(--v2-muted)', lineHeight: 1.6 }}>
          <li>Partage ton lien unique à un confrère agent immo</li>
          <li>Il s'inscrit sur KOLO via ton lien</li>
          <li>Quand il passe Pro (24,99€/mois), tu reçois +1 mois Pro offert sur ton compte</li>
          <li>Aucune limite : parraine 1, 10 ou 100 personnes</li>
        </ul>
      </div>
    </V2Layout>
  );
};
export const V2SettingsPage = () => {
  const user = useAuthedUser();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  useEffect(() => { v2api.dashboard().then(setDashboard).catch(() => {}); }, []);
  if (!user) return <div className="v2-app" />;

  const logout = () => { v2api.clearSession(); localStorage.removeItem('session_token'); navigate('/app-v2/login'); };

  return (
    <V2Layout user={user} dashboard={dashboard}>
      <button className="v2-icon-btn" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}><ChevronLeft size={16} /></button>
      <h1 className="v2-hello" style={{ fontSize: 22 }}>Profil & paramètres</h1>

      <div className="v2-card" style={{ marginTop: 14 }}>
        <div className="v2-tag">Identité</div>
        <div className="v2-row-title" style={{ marginTop: 6 }}>{user.first_name} {user.last_name}</div>
        <div className="v2-row-sub">{user.email}</div>
      </div>

      <div className="v2-card" style={{ marginTop: 10 }}>
        <div className="v2-tag">Abonnement</div>
        <div className="v2-row-title" style={{ marginTop: 6 }}>{dashboard?.has_pro ? 'KOLO Pro' : 'KOLO Gratuit'}</div>
        <div className="v2-row-sub">{dashboard?.has_pro ? 'Toutes les fonctionnalités, sans limite.' : `${dashboard?.free_contacts_left ?? 10} contacts gratuits restants`}</div>
        {!dashboard?.has_pro && (
          <button className="v2-btn ai-btn full" style={{ marginTop: 12 }} onClick={() => navigate('/app-v2/settings/subscription')}>Passer Pro · 24,99€/mois</button>
        )}
      </div>

      <div className="v2-card" style={{ marginTop: 10 }}>
        <div className="v2-tag">Langue</div>
        <div className="v2-row-sub" style={{ marginTop: 6, marginBottom: 12 }}>
          Choisis la langue de l'application.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }} data-testid="settings-language-grid">
          {[
            { code: 'fr', label: '🇫🇷  Français' },
            { code: 'en', label: '🇬🇧  English' },
            { code: 'de', label: '🇩🇪  Deutsch' },
            { code: 'it', label: '🇮🇹  Italiano' },
          ].map((l) => {
            const current = (typeof localStorage !== 'undefined' && localStorage.getItem('kolo_locale')) || 'fr';
            const active = current === l.code;
            return (
              <button
                key={l.code}
                type="button"
                className={`v2-btn ${active ? 'primary' : 'secondary'}`}
                onClick={() => {
                  try {
                    localStorage.setItem('kolo_locale', l.code);
                    localStorage.setItem('kolo_locale_manual', 'true');
                  } catch (_) { /* noop */ }
                  // Persist server-side so the AI replies in this language.
                  v2api.setLanguage(l.code).catch(() => { /* silent */ });
                  window.location.reload();
                }}
                data-testid={`settings-lang-${l.code}`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="v2-card" style={{ marginTop: 10 }}>
        <div className="v2-tag">Notifications push</div>
        <div className="v2-row-sub" style={{ marginTop: 6 }}>
          Reçois un push instantané quand tu crées un rappel et chaque matin un récap de ta journée.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            className="v2-btn primary"
            onClick={async () => {
              const pushService = (await import('../../services/pushNotifications')).default;
              await pushService.initWeb();
              const ok = await pushService.requestPermission();
              if (!ok) { alert('Permission refusée'); return; }
              await pushService.subscribe(user.user_id);
              alert('Notifications activées ✓');
            }}
            data-testid="settings-push-enable"
          >
            Activer
          </button>
          <button
            className="v2-btn secondary"
            onClick={async () => {
              try {
                const r = await v2api.testPush();
                alert(r.sent ? 'Test envoyé ✓' : "Envoi échoué");
              } catch (e) { alert(e.message); }
            }}
            data-testid="settings-push-test"
          >
            Test notif
          </button>
        </div>
      </div>

      <button className="v2-card" style={{ width: '100%', marginTop: 10, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }} onClick={logout} data-testid="settings-logout">
        <LogOut size={18} /> Se déconnecter
      </button>

      <button style={{ display: 'block', margin: '36px auto 0', background: 'none', border: 'none', color: '#DC2626', fontSize: 13, cursor: 'pointer' }} onClick={() => alert('Pour supprimer ton compte, écris-nous à contact@trykolo.io')} data-testid="settings-delete">
        Supprimer mon compte
      </button>
    </V2Layout>
  );
};
