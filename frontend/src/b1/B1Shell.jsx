// KOLO — BLOC B1 Shell (bottom nav + tour + opportunités + placeholders + profil)
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, Home, MapPin, CreditCard, Compass, HeadphonesIcon, Trash2, User, Users, LogOut, Crown, ArrowLeft, X, Heart } from 'lucide-react';
import b1t from './b1i18n';
import b1api from './b1api';
import { track, EVENTS } from './b3tracking';
import { IconSwipe, IconCalc, IconReport, IconRobot, IconStats, IconUser } from './B1Icons';
import { DEMO_OPPORTUNITES } from './demoOpportunites';
import { NetworkBanner } from './B3Perf';
import './b1.css';

// ============================================================================
// Bottom nav — pill floating
// Optional ambre badge on Opportunités tab quand des cartes de veille attendent.
// Ne concerne QUE Pro (l'API renvoie 402 pour Découverte, on ignore silencieux).
// N'entre JAMAIS dans la barre de progression des opportunités.
// ============================================================================
const _veilleBadgeCache = { count: null, at: 0 };

export function BottomTabPill({ active }) {
  const navigate = useNavigate();
  const [badge, setBadge] = useState(_veilleBadgeCache.count || 0);
  useEffect(() => {
    // Cache 60s pour ne pas taper l'API à chaque changement d'onglet.
    const stale = Date.now() - _veilleBadgeCache.at > 60_000;
    if (!stale && _veilleBadgeCache.count != null) {
      setBadge(_veilleBadgeCache.count);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { veilleApi } = await import('./B1Veille');
        const r = await veilleApi.fileDuJour();
        const n = r?.actif ? (r.cartes || []).length : 0;
        _veilleBadgeCache.count = n;
        _veilleBadgeCache.at = Date.now();
        if (!cancelled) setBadge(n);
      } catch (_e) {
        // 402 (Découverte) / 401 (anonyme) → pas de badge
        _veilleBadgeCache.count = 0;
        _veilleBadgeCache.at = Date.now();
        if (!cancelled) setBadge(0);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const tabs = [
    { id: 'opportunites', to: '/app-b1', Icon: IconSwipe, label: b1t('nav.opportunites') },
    { id: 'estimation',   to: '/app-b1/estimation', Icon: IconCalc,  label: b1t('nav.estimation') },
    { id: 'rapport',      to: '/app-b1/rapport',    Icon: IconReport,label: b1t('nav.rapport') },
    { id: 'assistant',    to: '/app-b1/assistant',  Icon: IconRobot, label: b1t('nav.assistant') },
  ];
  return (
    <nav className="b1-tabbar" data-testid="b1-bottom-tab-bar" aria-label="Navigation">
      {tabs.map((t) => (
        <button
          key={t.id}
          className="b1-tab"
          data-active={active === t.id}
          data-testid={`b1-tab-${t.id}`}
          onClick={() => navigate(t.to)}
          aria-label={t.label}
          style={{ position: 'relative' }}
        >
          <t.Icon size={24} />
          {t.id === 'opportunites' && badge > 0 && (
            <span
              className="b1-tab-badge"
              data-testid="b1-tab-veille-badge"
              aria-label={`${badge} biens en vente à surveiller`}
            >
              {badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

// ============================================================================
// Header (stats + profile)
// ============================================================================
function ShellHeader({ onProfile, onStats }) {
  return (
    <div className="b1-screen-header" style={{ padding: '4px 4px 0' }}>
      <div style={{ width: 40 }} />
      <div className="b1-header-icons">
        <button className="b1-header-icon" data-testid="b1-header-stats" onClick={onStats} aria-label="Performances">
          <IconStats size={20} />
        </button>
        <button className="b1-header-icon" data-testid="b1-header-profile" onClick={onProfile} aria-label="Profil">
          <IconUser size={22} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Guided Tour (6 bulles)
// ============================================================================
export function GuidedTour({ onDone }) {
  const [step, setStep] = useState(1);
  const bubbles = useMemo(() => [
    { key: '1', hand: true },
    { key: '2' }, { key: '3' }, { key: '4' }, { key: '5' }, { key: '6' },
  ], []);
  const cur = bubbles[step - 1];
  const isLast = step === bubbles.length;
  const done = (termine) => {
    track(termine ? EVENTS.TOUR_GUIDE_TERMINE : EVENTS.TOUR_GUIDE_PASSE, termine ? { bulles_vues: step } : { bulle_arret: step });
    onDone();
  };
  return (
    <div className="b1-tour-backdrop" data-testid="b1-tour-overlay">
      <div className="b1-tour-bubble" data-testid={`b1-tour-bubble-${step}`}>
        <div className="b1-tour-step">{b1t('tour.progress', { step })}</div>
        <h2 className="b1-tour-title">{b1t(`tour.${cur.key}.titre`)}</h2>
        {cur.hand && (
          <div className="b1-tour-hand" data-testid="b1-tour-swipe-hand">
            <span className="b1-tour-hand-icon" role="img" aria-label="swipe">
              <IconSwipe size={40} />
            </span>
          </div>
        )}
        <p className="b1-tour-text">{b1t(`tour.${cur.key}.texte`)}</p>
        <div className="b1-tour-actions">
          <button className="b1-tour-skip" data-testid="b1-tour-skip" onClick={() => done(false)}>
            {b1t('tour.passer')}
          </button>
          <button
            className="b1-pill b1-pill--primary"
            data-testid="b1-tour-next"
            style={{ minHeight: 44, padding: '10px 24px', fontSize: 15 }}
            onClick={() => (isLast ? done(true) : setStep(step + 1))}
          >
            {isLast ? b1t('tour.terminer') : b1t('tour.suivant')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Page — Opportunités (swipe simple)
// ============================================================================
export function OpportunitesPage() {
  const navigate = useNavigate();
  const [showTour, setShowTour] = useState(() => localStorage.getItem('kolo_b1_show_tour') === '1');
  const [idx, setIdx] = useState(0);
  const [items] = useState(() => DEMO_OPPORTUNITES);
  const [veilleDispo, setVeilleDispo] = useState(false);
  const cur = items[idx];
  const closeTour = useCallback(() => {
    localStorage.removeItem('kolo_b1_show_tour');
    localStorage.setItem('kolo_b1_tour_seen', '1');
    setShowTour(false);
    // Après tour guidé, on demande l'autorisation notifications (une fois par compte).
    try {
      if (!localStorage.getItem('kolo_b1_notif_perm_asked')) {
        localStorage.setItem('kolo_b1_notif_perm_asked', '1');
        setTimeout(() => navigate('/app-b1/notifications/permission'), 350);
      }
    } catch { /* localStorage indisponible */ }
  }, [navigate]);
  const next = () => setIdx((i) => Math.min(i + 1, items.length));
  const swipe = (sens) => {
    // premier_swipe distinct de swipe — clé métrique d'activation
    try {
      if (!localStorage.getItem('kolo_b1_first_swipe_done')) {
        localStorage.setItem('kolo_b1_first_swipe_done', '1');
        track(EVENTS.PREMIER_SWIPE, { sens });
      }
    } catch {}
    track(EVENTS.SWIPE, { sens, type_carte: 'opportunite' });
    // Droite = j'accepte → on ouvre l'estimation avec le bien pré-rempli.
    // Gauche = j'ignore → carte suivante.
    if (sens === 'droite' && cur) {
      const caracs = cur.caracteristiques || {};
      const bien = {
        adresse: cur.adresse,
        code_postal: cur.code_postal || caracs.code_postal,
        lat: cur.lat || caracs.latitude,
        lng: cur.lng || caracs.longitude,
        type_bien: caracs.type_batiment === 'maison' ? 'Maison' : 'Appartement',
        surface_habitable: caracs.surface_habitable || cur.superficie,
        classe_dpe: caracs.classe_dpe || cur.dpe,
        annee_construction: caracs.annee_construction,
        // Passe le DPE complet pour le pré-remplissage (etage_dpe, nb_niveaux, etc.)
        caracteristiques: caracs,
        listing: cur.listing || null,
      };
      // Démo : pas de lat/lng → on retombe sur l'estimation depuis adresse.
      if (bien.lat == null || bien.lng == null) {
        next();
        navigate('/app-b1/estimation/adresse');
        return;
      }
      navigate('/app-b1/estimation/flow', {
        state: { bien, opportunite_id: cur.id || cur._id },
      });
      return;
    }
    next();
  };

  // Fin de pile atteinte → vérifie si une pile de veille est disponible pour cet
  // utilisateur (Pro + quota_du_jour < seuil + zones couvertes ayant des cartes).
  // 402 pour Découverte → on n'affiche jamais l'intercalaire.
  useEffect(() => {
    if (idx < items.length) return;
    let cancelled = false;
    (async () => {
      try {
        const { veilleApi } = await import('./B1Veille');
        const r = await veilleApi.fileDuJour();
        if (cancelled) return;
        setVeilleDispo(r.actif && (r.cartes || []).length > 0);
      } catch (_e) { /* 402 Découverte ou 401 anonyme → pas d'intercalaire */ }
    })();
    return () => { cancelled = true; };
  }, [idx, items.length]);

  return (
    <div className="b1-root">
      <NetworkBanner />
      <div className="b1-shell">
        <div className="b1-screen">
          <ShellHeader
            onProfile={() => navigate('/app-b1/profil')}
            onStats={() => navigate('/app-b1/performances')}
          />
          <div className="b1-opp-header">
            <div className="b1-opp-count" data-testid="b1-opp-count">{Math.min(idx + 1, items.length)}/{items.length}</div>
            <div className="b1-progress-track" style={{ margin: '8px 40px' }}>
              <div className="b1-progress-fill" style={{ width: `${(Math.min(idx + 1, items.length) / Math.max(items.length, 1)) * 100}%` }} />
            </div>
            <div className="b1-opp-title">{b1t('opp.titre_quotidien')}</div>
          </div>
          {cur ? (
            <div className="b1-opp-card" data-testid="b1-opp-card">
              <div className="b1-opp-illus">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12l9-9 9 9" />
                  <path d="M5 10v10h14V10" />
                  <rect x="9" y="14" width="6" height="6" />
                </svg>
              </div>
              <h3 className="b1-opp-address">{cur.adresse}</h3>
              <div className="b1-opp-details">
                DPE : {cur.dpe} · {cur.note}<br />
                Superficie : {cur.superficie} m²<br />
                Source : {cur.source}
              </div>
              <div>
                <span className="b1-opp-chip">{b1t('sys.aucune_annonce')} · {cur.demo ? 'Démo' : 'Détails partiels'}</span>
              </div>
              <div className="b1-opp-actions">
                <button className="b1-opp-action-btn b1-opp-action-btn--reject" onClick={() => swipe('gauche')} data-testid="b1-opp-reject" aria-label={b1t('opp.rejeter') || 'Rejeter'}>
                  <X size={26} strokeWidth={2.5} />
                </button>
                <button className="b1-opp-action-btn b1-opp-action-btn--accept" onClick={() => swipe('droite')} data-testid="b1-opp-accept" aria-label={b1t('opp.accepter') || 'Accepter'}>
                  <Heart size={26} strokeWidth={2.5} fill="currentColor" />
                </button>
              </div>
            </div>
          ) : veilleDispo ? (
            // Intercalaire — ambre franc, jamais rose, jamais dans la pile d'opps.
            <React.Suspense fallback={null}>
              <VeilleIntercalaireLazy
                onOuvrir={() => navigate('/app-b1/veille')}
                onPlusTard={() => setVeilleDispo(false)}
              />
            </React.Suspense>
          ) : (
            <div className="b1-opp-empty" data-testid="b1-opp-empty">
              <p>{b1t('opp.vide.titre')}</p>
              <p className="b1-small" style={{ marginTop: 8 }}>{b1t('opp.vide.sous')}</p>
            </div>
          )}
        </div>
        <BottomTabPill active="opportunites" />
        {showTour && <GuidedTour onDone={closeTour} />}
      </div>
    </div>
  );
}

// Lazy-loaded veille intercalaire — evite le cycle d'import
const VeilleIntercalaireLazy = React.lazy(() =>
  import('./B1Veille').then((m) => ({ default: m.VeilleIntercalaire }))
);

// ============================================================================
// Placeholder pages (Estimation / Rapport / Assistant)
// ============================================================================
function PlaceholderPage({ tab }) {
  const navigate = useNavigate();
  return (
    <div className="b1-root">
      <div className="b1-shell">
        <div className="b1-screen">
          <ShellHeader
            onProfile={() => navigate('/app-b1/profil')}
            onStats={() => navigate('/app-b1/performances')}
          />
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div style={{
              width: 96, height: 96, borderRadius: 999,
              background: 'var(--b1-accent-light)', color: 'var(--b1-accent)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 24,
            }}>
              {tab === 'estimation' && <IconCalc size={44} />}
              {tab === 'rapport' && <IconReport size={44} />}
              {tab === 'assistant' && <IconRobot size={44} />}
            </div>
            <h1 className="b1-h1">{b1t('placeholder.bientot')}</h1>
            <p className="b1-lead" style={{ marginTop: 8 }}>{b1t('placeholder.sous')}</p>
          </div>
        </div>
        <BottomTabPill active={tab} />
      </div>
    </div>
  );
}
export const RapportPage = () => <PlaceholderPage tab="rapport" />;
export const AssistantPage = () => <PlaceholderPage tab="assistant" />;

// ============================================================================
// Profile page + subpages
// ============================================================================
function BackHeader({ label }) {
  const navigate = useNavigate();
  return (
    <div className="b1-screen-header">
      <button className="b1-back-btn" data-testid="b1-back-btn" onClick={() => navigate(-1)} aria-label="Retour">
        <ArrowLeft size={20} />
      </button>
      <div className="b1-h2" style={{ fontSize: 17 }}>{label}</div>
      <div style={{ width: 40 }} />
    </div>
  );
}

export function ProfilPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  useEffect(() => { b1api.getProfil().then((r) => setMe(r.user)).catch(() => {}); }, []);
  const isPro = (me?.plan || '') === 'pro';
  const isDirecteur = me?.role === 'directeur' && !!me?.organisation_id;
  const menu = [
    ...(isDirecteur ? [{
      id: 'directeur',
      to: '/app-b1/directeur/repartition',
      icon: Users,
      label: b1t('dir.repartition.titre'),
    }] : []),
    { id: 'perso', to: '/app-b1/profil/perso', icon: User, label: b1t('profil.menu.perso') },
    { id: 'pro', to: '/app-b1/profil/pro', icon: HeadphonesIcon, label: b1t('profil.menu.pro') },
    { id: 'zones', to: '/app-b1/profil/zones', icon: MapPin, label: b1t('profil.menu.zones') },
    { id: 'veille', to: '/app-b1/veille/suivis', icon: Compass, label: b1t('veille.section.titre') },
    { id: 'paiement', to: '/app-b1/profil/paiement', icon: CreditCard, label: b1t('profil.menu.paiement') },
    { id: 'tour', to: '/app-b1', icon: Compass, label: b1t('profil.menu.tour'), onSelect: () => localStorage.setItem('kolo_b1_show_tour', '1') },
    { id: 'support', to: 'mailto:contact@trykolo.io', icon: HeadphonesIcon, label: b1t('profil.menu.support'), external: true },
    { id: 'suppr', to: '/app-b1/profil/supprimer', icon: Trash2, label: b1t('profil.menu.suppr'), danger: true },
  ];
  const logout = () => {
    try { localStorage.removeItem('kolo_v2_session'); } catch {}
    navigate('/app-v2/login');
  };
  return (
    <div className="b1-root">
      <div className="b1-screen">
        <BackHeader label={b1t('nav.opportunites')} />
        <div className="b1-profil-plan" data-testid="b1-profil-plan-card">
          <div className="b1-profil-plan-eyebrow">{b1t('profil.plan.titre')}</div>
          <div className="b1-profil-plan-name">
            <Crown size={30} strokeWidth={2.2} />
            {isPro ? b1t('profil.plan.pro') : b1t('profil.plan.decouverte')}
          </div>
          {isPro && me?.subscription_ends_at && (
            <div className="b1-profil-plan-renouv">
              {b1t('profil.plan.renouv', { date: new Date(me.subscription_ends_at).toLocaleDateString() })}
            </div>
          )}
          {!isPro && (
            <button className="b1-profil-plan-cta" data-testid="b1-profil-passer-pro" onClick={() => navigate('/app-v2/settings/subscription')}>
              {b1t('profil.plan.passer_pro')}
            </button>
          )}
        </div>
        <div className="b1-profil-menu">
          {menu.map((m) => (
            <button
              key={m.id}
              className="b1-profil-menu-item"
              data-testid={`b1-profil-menu-${m.id}`}
              data-danger={m.danger ? 'true' : 'false'}
              onClick={() => {
                if (m.onSelect) m.onSelect();
                if (m.external) { window.location.href = m.to; return; }
                navigate(m.to);
              }}
            >
              <div className="b1-profil-menu-item-icon"><m.icon size={20} /></div>
              <div className="b1-profil-menu-item-label">{m.label}</div>
              <ChevronRight size={20} className="b1-profil-menu-item-chev" />
            </button>
          ))}
        </div>
        <button className="b1-logout" data-testid="b1-profil-logout" onClick={logout}>
          {b1t('profil.menu.logout')}
        </button>
      </div>
    </div>
  );
}

// -- Perso subpage
export function ProfilPersoPage() {
  const [me, setMe] = useState(null);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({});
  useEffect(() => {
    b1api.getProfil().then((r) => {
      setMe(r.user);
      setValues({
        prenom: r.user?.prenom || '',
        nom: r.user?.nom || '',
        phone: r.user?.phone || '',
        email: r.user?.email || '',
        adresse: r.user?.adresse || '',
        code_postal_perso: r.user?.code_postal_perso || '',
        ville_perso: r.user?.ville_perso || '',
      });
    }).catch(() => {});
  }, []);
  const setV = (k, v) => setValues((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setSaving(true);
    try { await b1api.patchProfil({ perso: values }); } finally { setSaving(false); }
  };
  return (
    <div className="b1-root">
      <div className="b1-screen">
        <BackHeader label={b1t('profil.perso.titre')} />
        {['prenom', 'nom', 'phone', 'email', 'adresse', 'code_postal_perso', 'ville_perso'].map((k) => (
          <div key={k}>
            <div className="b1-input-label">{b1t(`profil.perso.${k === 'code_postal_perso' ? 'cp' : k === 'ville_perso' ? 'ville' : k === 'phone' ? 'tel' : k}`)}</div>
            <input
              className="b1-input"
              data-testid={`b1-perso-${k}`}
              value={values[k] || ''}
              onChange={(e) => setV(k, e.target.value)}
              inputMode={k === 'phone' || k === 'code_postal_perso' ? 'numeric' : undefined}
              autoComplete={k === 'email' ? 'email' : k === 'phone' ? 'tel' : undefined}
            />
          </div>
        ))}
        <button className="b1-pill b1-pill--primary b1-pill--fullwidth" data-testid="b1-perso-save" onClick={save} disabled={saving}>
          {b1t('profil.perso.enregistrer')}
        </button>
      </div>
    </div>
  );
}

// -- Pro subpage
export function ProfilProPage() {
  const [state, setState] = useState({ infos_pro: {}, completude: 0 });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    b1api.getProfil().then((r) => setState({ infos_pro: r.user?.infos_pro || {}, completude: r.user?.infos_pro_completude || 0 })).catch(() => {});
  }, []);
  const setF = (k, v) => setState((s) => ({ ...s, infos_pro: { ...s.infos_pro, [k]: v } }));
  const save = async () => {
    setSaving(true);
    try {
      const r = await b1api.patchProfil({ infos_pro: state.infos_pro });
      setState({ infos_pro: r.user?.infos_pro || state.infos_pro, completude: r.infos_pro_completude || 0 });
    } finally { setSaving(false); }
  };
  const textFields = [
    { k: 'siren' }, { k: 'agence' }, { k: 'carte_t' }, { k: 'cci' },
    { k: 'rcp_assureur' }, { k: 'rcp_police' }, { k: 'garantie' },
  ];
  const pondFields = ['pond_terrasse', 'pond_balcon_loggia', 'pond_combles', 'pond_cave_cellier', 'pond_garage', 'pond_place_parking', 'pond_jardin'];
  return (
    <div className="b1-root">
      <div className="b1-screen">
        <BackHeader label={b1t('profil.pro.titre')} />
        <div className="b1-card">
          <div className="b1-small" style={{ marginBottom: 6 }}>
            {b1t('profil.pro.completude', { pct: state.completude })}
          </div>
          <div className="b1-completude-bar">
            <div className="b1-completude-bar-fill" style={{ width: `${state.completude}%` }} />
          </div>
        </div>
        <div>
          <div className="b1-input-label">{b1t('profil.pro.statut_juridique')}</div>
          <select className="b1-select" data-testid="b1-pro-statut_juridique" value={state.infos_pro.statut_juridique || ''} onChange={(e) => setF('statut_juridique', e.target.value)}>
            <option value=""></option>
            {['auto', 'eurl', 'sarl', 'sas', 'salarie', 'autre'].map(s => (
              <option key={s} value={s}>{b1t(`profil.pro.statut.${s}`)}</option>
            ))}
          </select>
        </div>
        {textFields.map(({ k }) => (
          <div key={k}>
            <div className="b1-input-label">{b1t(`profil.pro.${k}`)}</div>
            <input className="b1-input" data-testid={`b1-pro-${k}`} value={state.infos_pro[k] || ''} onChange={(e) => setF(k, e.target.value)} />
          </div>
        ))}
        <div>
          <div className="b1-input-label">{b1t('profil.pro.taux')}</div>
          <input className="b1-input" data-testid="b1-pro-taux_honoraires_pct" inputMode="decimal" value={state.infos_pro.taux_honoraires_pct || ''} onChange={(e) => setF('taux_honoraires_pct', e.target.value)} />
        </div>
        <div>
          <div className="b1-input-label">{b1t('profil.pro.charge')}</div>
          <select className="b1-select" data-testid="b1-pro-honoraires_charge" value={state.infos_pro.honoraires_charge || ''} onChange={(e) => setF('honoraires_charge', e.target.value)}>
            <option value=""></option>
            {['vendeur', 'acquereur', 'partages'].map(s => (
              <option key={s} value={s}>{b1t(`profil.pro.charge.${s}`)}</option>
            ))}
          </select>
        </div>
        <div className="b1-card">
          <div className="b1-h2" style={{ fontSize: 17, marginBottom: 4 }}>{b1t('profil.pro.grille.titre')}</div>
          <div className="b1-small" style={{ marginBottom: 12 }}>{b1t('profil.pro.grille.sous')}</div>
          {pondFields.map((k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--b1-border)' }}>
              <div style={{ flex: 1, fontSize: 14 }}>{b1t(`profil.pro.${k}`)}</div>
              <input
                className="b1-input"
                data-testid={`b1-pro-${k}`}
                inputMode="decimal"
                style={{ maxWidth: 100, height: 44, fontSize: 15 }}
                value={state.infos_pro[k] ?? ''}
                onChange={(e) => setF(k, e.target.value)}
              />
            </div>
          ))}
        </div>
        <button className="b1-pill b1-pill--primary b1-pill--fullwidth" data-testid="b1-pro-save" onClick={save} disabled={saving}>
          {b1t('profil.perso.enregistrer')}
        </button>
      </div>
    </div>
  );
}

// -- Zones subpage
export function ProfilZonesPage() {
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [cps, setCps] = useState([]);
  const [cp, setCp] = useState('');
  const [errModif, setErrModif] = useState('');
  const [villes, setVilles] = useState({}); // cp -> ville

  const refresh = useCallback(() => {
    b1api.getProfil().then(async (r) => {
      setUser(r.user);
      const zones = (r.user?.zones_perso || []);
      setCps(zones.map((c) => ({ cp: c, ville: null })));
      // Enrichit chaque CP avec sa commune (résolue via /api/villes)
      const map = {};
      await Promise.all(zones.map(async (c) => {
        try { const vr = await b1api.getVille(c); if (vr?.ville) map[c] = vr.ville; } catch { /* noop */ }
      }));
      setVilles(map);
    }).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const isDecouverte = (user?.plan || 'decouverte') !== 'pro';
  const dejaModif = !!user?.zones_deja_modifiees;

  const requestEdit = () => {
    setErrModif('');
    if (isDecouverte && dejaModif) {
      setShowBlock(true);
      return;
    }
    if (isDecouverte) {
      setShowBlock(true); // afficher avertissement 1 modif
      return;
    }
    setEditing(true);
  };
  const confirmModif = () => { setShowBlock(false); setEditing(true); };
  const addCp = () => {
    if (cp.length !== 5 || cps.some(x => x.cp === cp) || cps.length >= 2) return;
    setCps([...cps, { cp, ville: null }]);
    setCp('');
  };
  const removeCp = (idx) => setCps(cps.filter((_, i) => i !== idx));
  const save = async () => {
    try {
      await b1api.patchZones(cps.map((x) => x.cp));
      setEditing(false);
      refresh();
    } catch (e) {
      if (e.status === 402) setErrModif(b1t('profil.zones.modif.epuise'));
      else setErrModif(e.message);
    }
  };

  return (
    <div className="b1-root">
      <div className="b1-screen">
        <BackHeader label={b1t('profil.zones.titre')} />
        {!editing && (user?.zones_perso || []).length === 0 && (
          <div className="b1-card" data-testid="b1-zones-vide">
            <div className="b1-card-title">{b1t('profil.zones.vide.titre')}</div>
            <div className="b1-card-sub" style={{ marginTop: 6 }}>{b1t('profil.zones.vide.sous')}</div>
          </div>
        )}
        {!editing && (user?.zones_perso || []).map((c) => {
          const ville = villes[c];
          const couverte = !!ville; // v1 : couverte dès que la commune est reconnue
          return (
            <div key={c} className="b1-card" data-testid={`b1-zone-item-${c}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div className="b1-card-title">{c}{ville ? ` · ${ville}` : ''}</div>
                  <div className="b1-card-sub" style={{ color: couverte ? 'var(--b1-accent)' : 'var(--b1-text-muted)' }}>
                    {couverte ? b1t('profil.zones.couverte') : b1t('profil.zones.attente')}
                  </div>
                </div>
                <span style={{ color: 'var(--b1-accent)', display: 'inline-flex' }}><MapPin size={22} /></span>
              </div>
            </div>
          );
        })}
        {editing && (
          <>
            {cps.map((z, idx) => (
              <div className="b1-zone-chip" key={z.cp}>
                <div>
                  <div className="b1-zone-chip-cp">{z.cp}</div>
                  {z.ville && <div className="b1-zone-chip-ville">{z.ville}</div>}
                </div>
                <button className="b1-zone-chip-remove" onClick={() => removeCp(idx)} aria-label="Retirer" data-testid={`b1-zone-modif-remove-${idx}`}>
                  <X size={16} />
                </button>
              </div>
            ))}
            {cps.length < 2 && (
              <div>
                <input
                  className="b1-input"
                  data-testid="b1-zone-modif-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={5}
                  value={cp}
                  onChange={(e) => setCp(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
                  placeholder={b1t('onb.zones.placeholder')}
                />
                <button className="b1-pill b1-pill--ghost" style={{ marginTop: 12, width: '100%', minHeight: 48 }} onClick={addCp} disabled={cp.length !== 5} data-testid="b1-zone-modif-add">
                  {b1t('onb.zones.ajouter')}
                </button>
              </div>
            )}
            {errModif && <div className="b1-small" style={{ color: 'var(--b1-danger)' }}>{errModif}</div>}
          </>
        )}
        <div style={{ flex: 1 }} />
        {!editing ? (
          <button className="b1-pill b1-pill--primary b1-pill--fullwidth" data-testid="b1-zones-modifier" onClick={requestEdit}>
            {b1t('profil.zones.modifier')}
          </button>
        ) : (
          <button className="b1-pill b1-pill--primary b1-pill--fullwidth" data-testid="b1-zones-enregistrer" onClick={save} disabled={cps.length === 0}>
            {b1t('profil.zones.modif.enregistrer')}
          </button>
        )}
        {showBlock && (
          <div className="b1-sheet-backdrop" onClick={() => setShowBlock(false)}>
            <div className="b1-sheet" onClick={(e) => e.stopPropagation()} data-testid="b1-zones-modal">
              <div className="b1-sheet-handle" />
              <h2 className="b1-h2">{b1t('profil.zones.modif.titre')}</h2>
              <p className="b1-lead" style={{ marginTop: 8 }}>
                {dejaModif ? b1t('profil.zones.modif.epuise') : b1t('profil.zones.modif.decouverte')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                {!dejaModif && (
                  <button className="b1-pill b1-pill--primary b1-pill--fullwidth" data-testid="b1-zones-modal-maintenant" onClick={confirmModif}>
                    {b1t('profil.zones.modif.maintenant')}
                  </button>
                )}
                <button className="b1-pill b1-pill--ghost b1-pill--fullwidth" data-testid="b1-zones-modal-pro" onClick={() => { setShowBlock(false); window.location.href = '/app-v2/settings/subscription'; }}>
                  {b1t('profil.plan.passer_pro')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -- Delete account subpage (2-tap flow)
export function ProfilDeletePage() {
  const [confirmStep, setConfirmStep] = useState(0);
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => { b1api.getProfil().then((r) => setMe(r.user)).catch(() => {}); }, []);
  const role = me?.role === 'directeur' ? 'directeur' : me?.organisation_id ? 'conseiller' : 'indep';
  const suffix = role === 'directeur' ? 'directeur' : role === 'conseiller' ? 'conseil' : 'indep';

  const doDelete = async () => {
    setError('');
    try {
      await b1api.deleteMe();
      try { localStorage.clear(); } catch {}
      navigate('/app-v2/login');
    } catch (e) {
      setError(e.message);
    }
  };

  const openIosSubs = () => {
    // Best-effort deeplink vers les réglages d'abonnement iOS
    try { window.location.href = 'https://apps.apple.com/account/subscriptions'; } catch {}
  };

  return (
    <div className="b1-root">
      <div className="b1-screen">
        <BackHeader label={b1t(`profil.suppr.titre.${suffix}`)} />
        <div className="b1-card" style={{ background: 'rgba(220,38,38,0.05)' }}>
          <p className="b1-lead">{b1t(`profil.suppr.texte.${suffix}`)}</p>
        </div>
        <div className="b1-card">
          <div className="b1-small" style={{ marginBottom: 12 }}>{b1t('profil.suppr.abonnement')}</div>
          <button className="b1-pill b1-pill--ghost b1-pill--fullwidth" data-testid="b1-suppr-open-ios-subs" onClick={openIosSubs}>
            {b1t('profil.suppr.abonnement_cta')}
          </button>
        </div>
        {error && <div className="b1-small" style={{ color: 'var(--b1-danger)' }}>{error}</div>}
        <div style={{ flex: 1 }} />
        {confirmStep === 0 && (
          <>
            <button className="b1-pill b1-pill--danger b1-pill--fullwidth" data-testid="b1-suppr-cta1" onClick={() => setConfirmStep(1)}>
              {b1t(`profil.suppr.cta1.${suffix}`)}
            </button>
            <button className="b1-pill b1-pill--ghost b1-pill--fullwidth" data-testid="b1-suppr-annuler" onClick={() => navigate(-1)}>
              {b1t('profil.suppr.annuler')}
            </button>
          </>
        )}
        {confirmStep === 1 && (
          <>
            <button className="b1-pill b1-pill--danger b1-pill--fullwidth" data-testid="b1-suppr-cta2" onClick={doDelete}>
              {b1t('profil.suppr.cta2')}
            </button>
            <button className="b1-pill b1-pill--ghost b1-pill--fullwidth" data-testid="b1-suppr-annuler-2" onClick={() => setConfirmStep(0)}>
              {b1t('profil.suppr.annuler')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Paiement page (délégué à V2 existant)
export function ProfilPaiementPage() {
  useEffect(() => { window.location.href = '/app-v2/settings/subscription'; }, []);
  return <div className="b1-root"><div className="b1-screen"><p className="b1-lead">{b1t('sys.un_instant')}</p></div></div>;
}
