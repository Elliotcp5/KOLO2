// =============================================================
// KOLO v2 — Extras: Prospecting (DPE + Listings), Guide, Settings
// =============================================================
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ExternalLink, Plus, BookOpen, LogOut, Trash2 } from 'lucide-react';
import V2Layout from '../V2Layout';
import v2api from '../v2api';
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
  const [sector, setSector] = useState('');
  const [score, setScore] = useState('');
  const [age, setAge] = useState('');
  const [items, setItems] = useState([]);
  const [source, setSource] = useState('');

  const reload = () => {
    if (mode === 'dpe') {
      const p = {};
      if (sector) p.sector = sector;
      if (score) p.score = score;
      if (age === '30') p.days = 30;
      if (age === '90') p.days = 90;
      v2api.dpe(p).then(r => { setItems(r.items); setSource(r.source || ''); }).catch(() => { setItems([]); setSource(''); });
    } else {
      const p = {};
      if (sector) p.sector = sector;
      v2api.listings(p).then(r => { setItems(r.items); setSource(r.source || ''); }).catch(() => { setItems([]); setSource(''); });
    }
  };
  useEffect(() => { reload(); }, [mode, sector, score, age]);
  if (!user) return null;

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

  return (
    <V2Layout user={user}>
      <button className="v2-icon-btn" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}><ChevronLeft size={16} /></button>
      <h1 className="v2-hello" style={{ fontSize: 22 }}>Prospection</h1>
      <div className="v2-filter-tabs" style={{ marginTop: 12 }}>
        <button className={`v2-filter-tab ${mode === 'dpe' ? 'active' : ''}`} onClick={() => setMode('dpe')} data-testid="prosp-dpe">DPE (ADEME)</button>
        <button className={`v2-filter-tab ${mode === 'ads' ? 'active' : ''}`} onClick={() => setMode('ads')} data-testid="prosp-ads">Annonces</button>
      </div>

      <div className="v2-field" style={{ marginTop: 14 }}>
        <label className="v2-label">Secteur (ville, code postal)</label>
        <input className="v2-input" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="69003, Lyon…" data-testid="prosp-sector" />
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

      {mode === 'ads' && source === 'placeholder' && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', borderRadius: 12, padding: '10px 14px', marginTop: 12, fontSize: 12.5 }} data-testid="prosp-source-notice">
          Données d'exemple — la pige live des annonces se débloque dès la configuration RapidAPI.
        </div>
      )}
      {mode === 'ads' && source === 'not_subscribed' && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 12, padding: '10px 14px', marginTop: 12, fontSize: 12.5 }} data-testid="prosp-not-subscribed">
          API Selogimmo non souscrite. Active "Subscribe to Test" sur RapidAPI (gratuit) puis recharge.
        </div>
      )}
      {source && source !== 'placeholder' && source !== 'not_subscribed' && (
        <div style={{ color: 'var(--v2-muted-2)', fontSize: 11.5, marginTop: 8 }} data-testid="prosp-source-badge">
          Source : {source}
        </div>
      )}

      {mode === 'dpe' ? items.map((it, i) => (
        <div key={i} className="v2-card" style={{ marginBottom: 10 }} data-testid={`prosp-dpe-item-${i}`}>
          <div className="v2-row-title">{it.address}</div>
          <div className="v2-row-sub">Surface {it.surface}m² · Énergie {it.energy} · Climat {it.climate} · {it.issued_at}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <a className="v2-btn secondary" href={`https://observatoire-dpe-audit.ademe.fr/?q=${encodeURIComponent(it.address)}`} target="_blank" rel="noopener noreferrer">
              Voir DPE <ExternalLink size={14} />
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
  if (!user) return null;
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
  if (!user) return null;
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
  if (!user) return null;

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
