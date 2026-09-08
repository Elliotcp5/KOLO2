// KOLO — BLOC D1 · Build 2.24 : nouvelle interface directeur
// 4 onglets partageant la MÊME bottom tab bar que l'agent : contenus changés
// selon `role === 'directeur'`.
//
//  Onglet 1 : Opportunités du jour + feuille d'affectation instantanée
//  Onglet 2 : Mon équipe (avec bouton Inviter + stats par conseiller)
//  Onglet 3 : Performances de l'agence (mois / trimestre / année)
//  Onglet 4 : Assistant (inchangé — géré ailleurs)

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Mail, Check, X, TrendingUp } from 'lucide-react';
import b1t from './b1i18n';
import b1api from './b1api';
import { SwipeCard } from './B1Nav';
import { BottomTabPill } from './B1Shell';
import './b1.css';

// ---------------------------------------------------------------------------
// Petit header interne (rien sous status-bar)
// ---------------------------------------------------------------------------
function TitleHeader({ label, right = null }) {
  return (
    <div className="b1-screen-header" style={{ padding: '4px 4px 0' }}>
      <div style={{ width: 40 }} />
      <div className="b1-h2" style={{ fontSize: 17 }}>{label}</div>
      <div style={{ width: 40, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feuille modale « À qui affecter cette opportunité ? »
// ---------------------------------------------------------------------------
function SheetAffectation({ open, conseillers, onClose, onPick, pending }) {
  if (!open) return null;
  return (
    <div className="b1-sheet-backdrop" onClick={onClose} data-testid="d1b224-sheet-backdrop">
      <div className="b1-sheet" onClick={(e) => e.stopPropagation()} data-testid="d1b224-affectation-sheet">
        <div className="b1-sheet-handle" />
        <h2 className="b1-h2">{b1t('dir.b224.sheet.titre')}</h2>
        <p className="b1-lead" style={{ marginTop: 6 }}>{b1t('dir.b224.sheet.sous')}</p>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '55vh', overflowY: 'auto' }}>
          <button
            className="b1-pill b1-pill--primary b1-pill--fullwidth"
            data-testid="d1b224-affectation-moi"
            disabled={pending}
            onClick={() => onPick(null)}
          >
            <Users size={16} style={{ marginRight: 8 }} />
            {b1t('dir.b224.sheet.moi')}
          </button>
          {conseillers.map((c) => (
            <button
              key={c.user_id}
              className="b1-pill b1-pill--ghost b1-pill--fullwidth"
              style={{ display: 'flex', justifyContent: 'space-between' }}
              disabled={pending}
              data-testid={`d1b224-affectation-user-${c.user_id}`}
              onClick={() => onPick(c.user_id)}
            >
              <span>{c.prenom} {c.nom}</span>
              <span className="b1-small" style={{ opacity: 0.7 }}>
                {b1t('dir.b224.equipe.actifs', { n: c.total_actifs || 0 })}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet 1 · Opportunités du jour (swipe + sheet affectation)
// ---------------------------------------------------------------------------
export function DirecteurOpportunitesPage() {
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [equipe, setEquipe] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const cur = items[idx];

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [ropps, requipe] = await Promise.all([
        b1api.getOpportunitesDuJour(50),
        b1api.getMonEquipe().catch(() => ({ conseillers: [] })),
      ]);
      setItems(ropps?.items || []);
      setEquipe(requipe?.conseillers || []);
    } catch (e) {
      setError(e?.data?.detail || e?.message || 'Erreur chargement');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const swipeGauche = async () => {
    if (!cur?.id || pending) return;
    setPending(true);
    try {
      await b1api.swipeDirecteur(cur.id, 'gauche');
      setIdx((i) => i + 1);
    } catch (e) {
      setError(e?.data?.detail || e?.message || 'Erreur swipe');
    } finally { setPending(false); }
  };
  const swipeDroite = () => {
    // Ouvre la feuille d'affectation
    if (!cur?.id || pending) return;
    setSheetOpen(true);
  };
  const affecter = async (userId) => {
    if (!cur?.id) return;
    setPending(true);
    try {
      await b1api.swipeDirecteur(cur.id, 'droite', userId);
      setSheetOpen(false);
      setIdx((i) => i + 1);
    } catch (e) {
      setError(e?.data?.detail || e?.message || 'Erreur affectation');
      setSheetOpen(false);
    } finally { setPending(false); }
  };

  return (
    <div className="b1-root">
      <div className="b1-shell">
        <div className="b1-screen" data-testid="d1b224-opps-page">
          <TitleHeader label={b1t('dir.b224.opps.titre')} />
          <div className="b1-opp-header">
            <div className="b1-opp-count" data-testid="d1b224-opps-count">
              {items.length > 0 ? `${Math.min(idx + 1, items.length)}/${items.length}` : '0/0'}
            </div>
            <div className="b1-opp-title">{b1t('opp.titre_quotidien') || 'Opportunités du jour'}</div>
          </div>

          {loading ? (
            <div className="b1-loading" data-testid="d1b224-opps-loading">…</div>
          ) : !cur ? (
            <div className="b1-card" style={{ marginTop: 24 }} data-testid="d1b224-opps-vide">
              <div className="b1-lead">{b1t('dir.b224.opps.vide')}</div>
            </div>
          ) : (
            <SwipeCard
              onSwipeLeft={swipeGauche}
              onSwipeRight={swipeDroite}
              disabled={pending}
              testid="d1b224-swipe"
            >
              <div className="b1-opp-illus">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" /><rect x="9" y="14" width="6" height="6" />
                </svg>
              </div>
              <h3 className="b1-opp-address">{cur.adresse}</h3>
              <div className="b1-opp-details">
                DPE : {cur.dpe} · {cur.note || ''}<br />
                Superficie : {cur.superficie} m²<br />
                Source : {cur.source}
              </div>
            </SwipeCard>
          )}

          {error && (
            <div data-testid="d1b224-opps-error" style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, background: '#FEE2E2', color: '#991B1B', fontSize: 13, textAlign: 'center' }}>
              {typeof error === 'object' ? JSON.stringify(error) : String(error)}
            </div>
          )}
        </div>

        <SheetAffectation
          open={sheetOpen}
          conseillers={equipe}
          pending={pending}
          onClose={() => !pending && setSheetOpen(false)}
          onPick={affecter}
        />
        <BottomTabPill active="opportunites" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet 2 · Mon équipe
// ---------------------------------------------------------------------------
export function DirecteurMonEquipePage() {
  const navigate = useNavigate();
  const [data, setData] = useState({ conseillers: [], organisation: null });
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [prenomInvit, setPrenomInvit] = useState('');
  const [invSending, setInvSending] = useState(false);
  const [toast, setToast] = useState('');
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await b1api.getMonEquipe();
      setData(r || { conseillers: [] });
      setForbidden(false);
    } catch (e) {
      if (e?.status === 403) setForbidden(true);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const inviter = async () => {
    setInvSending(true);
    try {
      await b1api.createInvitation(email.trim().toLowerCase());
      setToast(b1t('dir.equipe.toast.envoyee', { email }));
      setEmail(''); setPrenomInvit(''); setInviteOpen(false);
      load();
    } catch (e) {
      const code = String(e?.message || '');
      const trad = {
        deja_invite: b1t('dir.equipe.toast.deja_invite'),
        deja_membre: b1t('dir.equipe.toast.deja_membre'),
        plafond_sieges: b1t('dir.equipe.toast.plafond'),
      };
      setToast(trad[code] || code);
    } finally { setInvSending(false); }
  };

  return (
    <div className="b1-root">
      <div className="b1-shell">
        <div className="b1-screen" data-testid="d1b224-equipe-page">
          <TitleHeader label={b1t('dir.b224.equipe.titre')} />

          {forbidden ? (
            <div className="b1-card" data-testid="d1b224-equipe-forbidden" style={{ marginTop: 12, background: 'rgba(220,38,38,0.05)' }}>
              <div className="b1-h2" style={{ fontSize: 17 }}>{b1t('dir.acces_refuse.titre')}</div>
              <p className="b1-lead" style={{ marginTop: 8 }}>{b1t('dir.acces_refuse.sous')}</p>
            </div>
          ) : (
            <>
              <button
                className="b1-pill b1-pill--primary b1-pill--fullwidth"
                data-testid="d1b224-inviter-cta"
                style={{ marginTop: 12 }}
                onClick={() => setInviteOpen(true)}
              >
                <Mail size={16} style={{ marginRight: 8 }} />
                {b1t('dir.equipe.inviter')}
              </button>

              {loading && <div className="b1-lead" style={{ marginTop: 16 }}>{b1t('sys.un_instant')}</div>}

              {!loading && (data.conseillers || []).length === 0 && (
                <div className="b1-card" style={{ marginTop: 16 }} data-testid="d1b224-equipe-vide">
                  <div className="b1-lead">{b1t('dir.b224.equipe.vide')}</div>
                </div>
              )}

              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(data.conseillers || []).map((c) => (
                  <button
                    key={c.user_id}
                    className="b1-card b1-card-tap"
                    data-testid={`d1b224-equipe-row-${c.user_id}`}
                    onClick={() => navigate(`/app-b1/directeur/equipe/${encodeURIComponent(c.user_id)}`)}
                    style={{ textAlign: 'left', border: 0, cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: 600 }}>{c.prenom} {c.nom}</div>
                    <div className="b1-small" style={{ opacity: 0.7 }}>{c.email}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <span className="b1-opp-chip" data-testid={`d1b224-cell-a-${c.user_id}`}>À démarcher · {c.a_demarcher || 0}</span>
                      <span className="b1-opp-chip">Démarchées · {c.demarche || 0}</span>
                      <span className="b1-opp-chip">Mandats · {c.mandat_signe || 0}</span>
                      <span className="b1-opp-chip">Abandons · {c.abandon || 0}</span>
                    </div>
                  </button>
                ))}
              </div>

              {toast && (
                <div className="b1-card" data-testid="d1b224-equipe-toast" style={{ marginTop: 12, background: 'var(--b1-accent-light)' }}>
                  <div className="b1-small">{toast}</div>
                </div>
              )}
            </>
          )}
        </div>

        {inviteOpen && (
          <div className="b1-sheet-backdrop" onClick={() => !invSending && setInviteOpen(false)}>
            <div className="b1-sheet" onClick={(e) => e.stopPropagation()} data-testid="d1b224-invite-sheet">
              <div className="b1-sheet-handle" />
              <h2 className="b1-h2">{b1t('dir.equipe.modal.titre')}</h2>
              <p className="b1-lead" style={{ marginTop: 6 }}>{b1t('dir.equipe.modal.sous')}</p>
              <div className="b1-input-label" style={{ marginTop: 16 }}>Prénom / Nom (optionnel)</div>
              <input
                className="b1-input"
                data-testid="d1b224-invite-prenom"
                value={prenomInvit}
                onChange={(e) => setPrenomInvit(e.target.value)}
              />
              <div className="b1-input-label" style={{ marginTop: 12 }}>{b1t('dir.equipe.modal.email')}</div>
              <input
                className="b1-input"
                type="email"
                autoComplete="email"
                data-testid="d1b224-invite-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                className="b1-pill b1-pill--primary b1-pill--fullwidth"
                style={{ marginTop: 16 }}
                data-testid="d1b224-invite-envoyer"
                disabled={invSending || !email.includes('@')}
                onClick={inviter}
              >
                <Check size={16} style={{ marginRight: 8 }} />
                {b1t('dir.equipe.modal.cta')}
              </button>
            </div>
          </div>
        )}

        <BottomTabPill active="mon_equipe" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Détail d'un conseiller — opps en cours
// ---------------------------------------------------------------------------
export function DirecteurConseillerDetailPage() {
  const { user_id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState({ conseiller: null, opportunites: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await b1api.getMonEquipeConseillerOpps(user_id);
        setData(r || { conseiller: null, opportunites: [] });
      } finally { setLoading(false); }
    })();
  }, [user_id]);

  const c = data.conseiller;
  return (
    <div className="b1-root">
      <div className="b1-shell">
        <div className="b1-screen" data-testid="d1b224-conseiller-detail">
          <div className="b1-screen-header">
            <button className="b1-back-btn" data-testid="d1b224-detail-back" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </button>
            <div className="b1-h2" style={{ fontSize: 17 }}>
              {c ? b1t('dir.b224.equipe.detail.titre', { prenom: c.prenom || c.nom || '' }) : b1t('sys.un_instant')}
            </div>
            <div style={{ width: 40 }} />
          </div>
          {loading && <div className="b1-lead">{b1t('sys.un_instant')}</div>}
          {!loading && (data.opportunites || []).length === 0 && (
            <div className="b1-card" style={{ marginTop: 16 }} data-testid="d1b224-detail-vide">
              <div className="b1-lead">{b1t('dir.b224.equipe.detail.vide')}</div>
            </div>
          )}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data.opportunites || []).map((o) => (
              <div key={o.id} className="b1-card" data-testid={`d1b224-detail-opp-${o.id}`}>
                <div style={{ fontWeight: 600 }}>{o.adresse || '—'}</div>
                <div className="b1-small" style={{ marginTop: 4 }}>
                  {o.code_postal} · {b1t(`dir.b224.statut.${o.statut}`) || o.statut}
                </div>
                <div className="b1-small" style={{ marginTop: 4, opacity: 0.7 }}>
                  {o.surface ? `${o.surface} m² · ` : ''}{o.dpe ? `DPE ${o.dpe}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
        <BottomTabPill active="mon_equipe" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet 3 · Performances de l'agence
// ---------------------------------------------------------------------------
export function DirecteurPerfAgencePage() {
  const [periode, setPeriode] = useState('mois');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await b1api.getPerfAgence(periode);
        setData(r); setForbidden(false);
      } catch (e) {
        if (e?.status === 403) setForbidden(true);
      } finally { setLoading(false); }
    })();
  }, [periode]);

  const a = data?.agence || {};
  const classement = data?.classement_conseillers || [];

  return (
    <div className="b1-root">
      <div className="b1-shell">
        <div className="b1-screen" data-testid="d1b224-perf-page">
          <TitleHeader label={b1t('dir.b224.perf.titre')} />

          {forbidden ? (
            <div className="b1-card" style={{ marginTop: 12, background: 'rgba(220,38,38,0.05)' }}>
              <div className="b1-h2" style={{ fontSize: 17 }}>{b1t('dir.acces_refuse.titre')}</div>
              <p className="b1-lead" style={{ marginTop: 8 }}>{b1t('dir.acces_refuse.sous')}</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }} data-testid="d1b224-perf-tabs">
                {['mois', 'trimestre', 'annee'].map((p) => (
                  <button
                    key={p}
                    className={`b1-pill ${periode === p ? 'b1-pill--primary' : 'b1-pill--ghost'}`}
                    data-testid={`d1b224-perf-tab-${p}`}
                    onClick={() => setPeriode(p)}
                  >
                    {b1t(`dir.b224.perf.periode.${p}`)}
                  </button>
                ))}
              </div>

              {loading && <div className="b1-lead" style={{ marginTop: 16 }}>{b1t('sys.un_instant')}</div>}

              {!loading && data && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }} data-testid="d1b224-perf-kpi">
                    <StatCard label={b1t('dir.b224.perf.recues')} value={a.opportunites_recues || 0} testid="d1b224-kpi-recues" />
                    <StatCard label={b1t('dir.b224.perf.demarchees')} value={a.demarchees || 0} testid="d1b224-kpi-demarchees" />
                    <StatCard label={b1t('dir.b224.perf.signes')} value={a.mandats_signes || 0} testid="d1b224-kpi-signes" />
                    <StatCard label={b1t('dir.b224.perf.taux')} value={`${a.taux_transformation_pct || 0}%`} testid="d1b224-kpi-taux" />
                  </div>

                  <h3 className="b1-h2" style={{ marginTop: 24, fontSize: 16 }}>{b1t('dir.b224.perf.classement')}</h3>
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {classement.map((c, i) => (
                      <div key={c.user_id} className="b1-card" data-testid={`d1b224-classement-row-${c.user_id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{i + 1}. {c.prenom} {c.nom}</div>
                          <div className="b1-small" style={{ opacity: 0.7 }}>
                            {c.recues} reçues · {c.demarchees} démarchées
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700 }}>{c.signees}</div>
                          <div className="b1-small" style={{ opacity: 0.7 }}>{c.taux}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <BottomTabPill active="perf_agence" />
      </div>
    </div>
  );
}

function StatCard({ label, value, testid }) {
  return (
    <div className="b1-card" data-testid={testid} style={{ padding: 12 }}>
      <div className="b1-small" style={{ opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default {
  DirecteurOpportunitesPage,
  DirecteurMonEquipePage,
  DirecteurConseillerDetailPage,
  DirecteurPerfAgencePage,
};
