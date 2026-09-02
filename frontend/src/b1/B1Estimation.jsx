// KOLO — BLOC C1 Estimation UI
// 3 pages : Home (choix opp/adresse), Flow (questions + résultat), MesEstimations.
// Aucune couleur en dur. Vouvoiement partout. i18n via b1i18nEstimation.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Home, MapPin, Building2, TrendingUp } from 'lucide-react';
import b1t from './b1i18n';
import b1api from './b1api';
import { BottomTabPill } from './B1Shell';
import { track, EVENTS } from './b3tracking';
import { saveDraft, loadDraft, clearDraft } from './b3offline';
import './b1.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmtEUR = (n) => {
  if (n == null) return '—';
  const v = Math.round(Number(n));
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
};

// noindex meta helper — applies to /estimations pages
function useNoIndex() {
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    return () => { try { document.head.removeChild(m); } catch (_e) { /* noop */ } };
  }, []);
}

function BackHeader({ label }) {
  const navigate = useNavigate();
  return (
    <div className="b1-screen-header">
      <button className="b1-back-btn" data-testid="est-back-btn" onClick={() => navigate(-1)} aria-label={b1t('sys.retour')}>
        <ArrowLeft size={20} />
      </button>
      <div className="b1-h2" style={{ fontSize: 17 }}>{label}</div>
      <div style={{ width: 40 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HOME — /app-b1/estimation
// ---------------------------------------------------------------------------
export function EstimationHomePage() {
  const navigate = useNavigate();
  useNoIndex();

  return (
    <div className="b1-root">
      <div className="b1-screen" style={{ paddingBottom: 120 }}>
        <div className="b1-screen-content" style={{ paddingTop: 32 }}>
          <div className="est-hero">
            <div className="est-hero-icon"><Building2 size={40} /></div>
            <h1 className="b1-h1">{b1t('est.home.titre')}</h1>
            <p className="b1-lead" style={{ marginTop: 8 }}>{b1t('est.home.sous')}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
            <button
              data-testid="est-home-cta-opp"
              className="b1-pill b1-pill--primary b1-pill--fullwidth"
              onClick={() => navigate('/app-b1')}>
              {b1t('est.home.cta_opp')}
            </button>
            <button
              data-testid="est-home-cta-adr"
              className="b1-pill b1-pill--ghost b1-pill--fullwidth"
              onClick={() => navigate('/app-b1/estimation/adresse')}>
              {b1t('est.home.cta_adr')}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link
              to="/app-b1/estimations"
              data-testid="est-home-lien-mes"
              className="b1-small"
              style={{ color: 'var(--b1-accent)', textDecoration: 'underline' }}>
              {b1t('est.home.lien_mes')}
            </Link>
          </div>
        </div>
        <BottomTabPill active="estimation" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FLOW — /app-b1/estimation/flow?opp={id}
// Piloté par un state machine minimal : questions → calcul → résultat.
// ---------------------------------------------------------------------------
const QUESTIONS_ORDER = ['etat', 'etage', 'ascenseur', 'exterieur', 'stationnement'];

// Extrait ce qui est déjà connu du DPE et de l'annonce rapprochée.
// Règle : ne demande jamais ce qu'on connaît. Pré-remplit et laisse corriger.
// Retour : { prefilled: { etage?, ascenseur?, exterieur?, exterieur_surface_m2?, stationnement? } }
function prefillFromBien(bien) {
  const out = {};
  const caracs = bien?.caracteristiques || {};
  const listing = bien?.listing || null;

  // Étage — DPE `etage_dpe` (extrait du complement_adresse) ou `floor` de l'annonce
  const etageRaw = (
    caracs.etage_dpe != null ? caracs.etage_dpe
    : listing?.floor != null ? listing.floor
    : null
  );
  if (etageRaw != null) {
    const n = Number(etageRaw);
    if (n === 0) out.etage = 'rdc';
    else if (n === 1 || n === 2 || n === 3) out.etage = String(n);
    else if (n > 3) out.etage = '3plus';
  }

  // Ascenseur — uniquement disponible via annonce
  if (listing && listing.has_elevator != null) {
    out.ascenseur = !!listing.has_elevator;
  }
  // Sur maison → pas de question ascenseur
  if ((bien?.type_bien || '').toLowerCase() === 'maison') {
    out.ascenseur = out.ascenseur ?? false; // marqueur "connu"
  }

  // Extérieur — via annonce (has_balcony/has_terrace/has_garden)
  if (listing) {
    if (listing.has_garden) out.exterieur = 'jardin';
    else if (listing.has_terrace) out.exterieur = 'terrasse';
    else if (listing.has_balcony) out.exterieur = 'balcon';
    else if (listing.has_balcony === false && listing.has_terrace === false && listing.has_garden === false) {
      out.exterieur = 'aucun';
    }
  }

  // Stationnement — via annonce (has_parking)
  if (listing) {
    if (listing.has_parking === true) out.stationnement = 'garage'; // conservateur : on ne sait pas garage vs place
    else if (listing.has_parking === false) out.stationnement = 'aucun';
  }

  return out;
}

function shouldAskQuestion(qKey, bien, prefilled) {
  // État général : rien ne le donne jamais → toujours posé.
  if (qKey === 'etat') return true;
  // Maison : pas d'étage / pas d'ascenseur.
  if (qKey === 'etage' && (bien?.type_bien || '').toLowerCase() === 'maison') return false;
  if (qKey === 'ascenseur' && (bien?.type_bien || '').toLowerCase() === 'maison') return false;
  // Si le champ est déjà pré-rempli par le DPE ou l'annonce, on n'ouvre pas la question.
  if (prefilled && Object.prototype.hasOwnProperty.call(prefilled, qKey)) return false;
  return true;
}

export function EstimationFlowPage() {
  const navigate = useNavigate();
  const location = useLocation();
  useNoIndex();

  const bien = location.state?.bien || {};
  const oppId = location.state?.opportunite_id || null;

  const prefilled = useMemo(() => prefillFromBien(bien), [bien]);
  const activeQs = useMemo(
    () => QUESTIONS_ORDER.filter((k) => shouldAskQuestion(k, bien, prefilled)),
    [bien, prefilled],
  );
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(() => ({ ...prefilled }));
  const [ext_surface, setExtSurface] = useState(() => (
    prefilled.exterieur_surface_m2 ? String(prefilled.exterieur_surface_m2) : ''
  ));
  const [calc, setCalc] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Sauvegarde d'un draft offline (réutilise b3offline)
  const draftKey = `estimation:${oppId || 'libre'}`;
  useEffect(() => {
    const d = loadDraft(draftKey);
    if (d) { setAnswers(d.answers || {}); setExtSurface(d.ext_surface || ''); }
  }, [draftKey]);
  useEffect(() => { saveDraft(draftKey, { answers, ext_surface }); }, [draftKey, answers, ext_surface]);

  const setAnswer = (k, v, opts = {}) => {
    const next = { ...answers, [k]: v };
    setAnswers(next);
    // Avance auto — SAUF pour extérieur avec valeur ≠ aucun (on veut la surface avant)
    if (opts.noAdvance) return;
    if (step < activeQs.length - 1) setStep(step + 1);
  };
  const advance = () => {
    if (step < activeQs.length - 1) setStep(step + 1);
  };

  const canLaunch = activeQs.every((k) => answers[k] !== undefined);

  const launch = useCallback(async () => {
    setCalc(true);
    setError(null);
    try {
      const payload = {
        opportunite_id: oppId,
        adresse: bien.adresse,
        code_postal: bien.code_postal,
        lat: bien.lat, lng: bien.lng,
        type_bien: bien.type_bien,
        surface_habitable: bien.surface_habitable,
        classe_dpe: bien.classe_dpe,
        annee_construction: bien.annee_construction,
        etat: answers.etat,
        etage: answers.etage,
        ascenseur: answers.ascenseur,
        exterieur: answers.exterieur,
        exterieur_surface_m2: ext_surface ? Number(ext_surface) : undefined,
        stationnement: answers.stationnement,
      };
      const t0 = Date.now();
      const res = await b1api.postEstimation(payload);
      const durationMs = Date.now() - t0;
      track(EVENTS?.ESTIMATION_LANCEE || 'estimation_lancee', {
        opp_id: oppId,
        nb_questions_posees: activeQs.length,
        source: oppId ? 'opportunite' : 'adresse',
      });
      track(EVENTS?.ESTIMATION_AFFICHEE || 'estimation_affichee', { duree_ms: durationMs });
      setResult(res);
      clearDraft(draftKey);
    } catch (e) {
      setError(e?.data?.detail?.code || e?.message || 'erreur');
      if ((e?.data?.detail?.code === 'quota_estimation_epuise') && e?.status === 402) {
        navigate('/app-b1/veille/paywall');
      }
    } finally {
      setCalc(false);
    }
  }, [answers, ext_surface, bien, oppId, draftKey, navigate]);

  if (result) {
    return <EstimationResultPage result={result} bien={bien} />;
  }

  if (calc) {
    return (
      <div className="b1-root">
        <div className="b1-screen">
          <div className="b1-screen-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 120 }}>
            <div className="est-loader" data-testid="est-loader" />
            <h1 className="b1-h2" style={{ marginTop: 24, textAlign: 'center' }}>{b1t('est.calc.titre')}</h1>
          </div>
        </div>
      </div>
    );
  }

  const qKey = activeQs[step];
  const total = activeQs.length;

  return (
    <div className="b1-root">
      <div className="b1-screen">
        <BackHeader label={bien.adresse || ''} />
        <div className="b1-progress-wrap">
          <div className="b1-progress-track">
            <div className="b1-progress-fill" style={{ width: `${((step + 1) / total) * 100}%` }} />
          </div>
          <div className="b1-progress-label">{b1t('est.q.progress', { step: step + 1, total })}</div>
        </div>

        <div className="b1-screen-content">
          {error && <div className="est-error" data-testid="est-error">{error}</div>}
          {qKey === 'etat' && <QEtat value={answers.etat} onPick={(v) => setAnswer('etat', v)} />}
          {qKey === 'etage' && <QEtage value={answers.etage} onPick={(v) => setAnswer('etage', v)} />}
          {qKey === 'ascenseur' && <QAsc value={answers.ascenseur} onPick={(v) => setAnswer('ascenseur', v)} />}
          {qKey === 'exterieur' && (
            <>
              <QExterieur
                value={answers.exterieur}
                surface={ext_surface}
                onPick={(v) => setAnswer('exterieur', v, { noAdvance: v !== 'aucun' })}
                onSurface={setExtSurface}
              />
              {answers.exterieur && answers.exterieur !== 'aucun' && (
                <button
                  data-testid="est-ext-continuer"
                  className="b1-pill b1-pill--primary b1-pill--fullwidth"
                  style={{ marginTop: 16 }}
                  onClick={advance}
                  disabled={!ext_surface || Number(ext_surface) <= 0}>
                  {b1t('est.q.suivant')}
                </button>
              )}
            </>
          )}
          {qKey === 'stationnement' && <QStat value={answers.stationnement} onPick={(v) => setAnswer('stationnement', v)} />}
        </div>

        {step === activeQs.length - 1 && (
          <div style={{ padding: '0 20px 32px' }}>
            <button
              data-testid="est-flow-launch"
              className="b1-pill b1-pill--primary b1-pill--fullwidth"
              disabled={!canLaunch}
              onClick={launch}>
              {b1t('est.bien.cta_estimer')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QUESTIONS — boutons pilule (jamais de saisie libre à l'exception surface ext)
// ---------------------------------------------------------------------------
function OptGrid({ children }) { return <div className="est-optgrid">{children}</div>; }
function OptBtn({ label, active, onClick, testid }) {
  return (
    <button
      className="est-opt"
      data-active={active ? 'true' : 'false'}
      data-testid={testid}
      onClick={onClick}>
      {label}
    </button>
  );
}

function QEtat({ value, onPick }) {
  return (
    <div>
      <h1 className="b1-h2">{b1t('est.q.etat.titre')}</h1>
      <OptGrid>
        {['a_rafraichir', 'bon_etat', 'renove', 'neuf'].map((k) => (
          <OptBtn key={k} label={b1t(`est.q.etat.${k}`)} active={value === k}
                  onClick={() => onPick(k)} testid={`est-etat-${k}`} />
        ))}
      </OptGrid>
    </div>
  );
}
function QEtage({ value, onPick }) {
  return (
    <div>
      <h1 className="b1-h2">{b1t('est.q.etage.titre')}</h1>
      <OptGrid>
        {['rdc', '1', '2', '3', '3plus'].map((k) => (
          <OptBtn key={k} label={b1t(`est.q.etage.${k}`)} active={value === k}
                  onClick={() => onPick(k)} testid={`est-etage-${k}`} />
        ))}
      </OptGrid>
    </div>
  );
}
function QAsc({ value, onPick }) {
  return (
    <div>
      <h1 className="b1-h2">{b1t('est.q.ascenseur.titre')}</h1>
      <OptGrid>
        <OptBtn label={b1t('est.q.ascenseur.oui')} active={value === true} onClick={() => onPick(true)} testid="est-asc-oui" />
        <OptBtn label={b1t('est.q.ascenseur.non')} active={value === false} onClick={() => onPick(false)} testid="est-asc-non" />
      </OptGrid>
    </div>
  );
}
function QExterieur({ value, surface, onPick, onSurface }) {
  return (
    <div>
      <h1 className="b1-h2">{b1t('est.q.exterieur.titre')}</h1>
      <OptGrid>
        {['aucun', 'balcon', 'terrasse', 'jardin'].map((k) => (
          <OptBtn key={k} label={b1t(`est.q.exterieur.${k}`)} active={value === k}
                  onClick={() => onPick(k)} testid={`est-ext-${k}`} />
        ))}
      </OptGrid>
      {value && value !== 'aucun' && (
        <div style={{ marginTop: 16 }}>
          <label className="b1-small">{b1t('est.q.exterieur.surface')}</label>
          <input
            className="b1-input"
            data-testid="est-ext-surface"
            type="number" min="0" max="1000" step="1"
            value={surface}
            onChange={(e) => onSurface(e.target.value)} />
        </div>
      )}
    </div>
  );
}
function QStat({ value, onPick }) {
  return (
    <div>
      <h1 className="b1-h2">{b1t('est.q.stationnement.titre')}</h1>
      <OptGrid>
        {['aucun', 'place', 'garage'].map((k) => (
          <OptBtn key={k} label={b1t(`est.q.stationnement.${k}`)} active={value === k}
                  onClick={() => onPick(k)} testid={`est-stat-${k}`} />
        ))}
      </OptGrid>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RÉSULTAT
// ---------------------------------------------------------------------------
function EstimationResultPage({ result, bien }) {
  const navigate = useNavigate();
  const [net, setNet] = useState(false);
  const [detail, setDetail] = useState(false);
  useNoIndex();

  const prixReco = net && result.net_vendeur ? result.net_vendeur : result.prix_commercialisation;
  const showNetWarn = net && !result.net_vendeur;

  const fiabLabel = (
    result.fiabilite === 'elevee' ? b1t('est.res.conf.elevee')
    : result.fiabilite === 'moyenne' ? b1t('est.res.conf.moyenne')
    : b1t('est.res.conf.faible')
  );

  return (
    <div className="b1-root">
      <div className="b1-screen" style={{ paddingBottom: 120 }}>
        <BackHeader label={bien.adresse || ''} />

        <div className="b1-screen-content">
          <div className="est-bandeau" data-testid="est-res-bandeau">
            {b1t('est.res.bandeau')}
          </div>

          <div className="est-prix-row" data-testid="est-res-prix-row">
            <div className="est-prix-side">
              <div className="est-prix-side-val">{fmtEUR(result.fourchette_basse)} €</div>
              <div className="est-prix-side-lbl">{b1t('est.res.label_basse')}</div>
            </div>
            <div className="est-prix-center">
              <div className="est-prix-center-val" data-testid="est-res-prix-reco">{fmtEUR(prixReco)} €</div>
              <div className="est-prix-center-lbl">{net ? b1t('est.res.net_vendeur_titre') : b1t('est.res.label_reco')}</div>
            </div>
            <div className="est-prix-side">
              <div className="est-prix-side-val">{fmtEUR(result.fourchette_haute)} €</div>
              <div className="est-prix-side-lbl">{b1t('est.res.label_haute')}</div>
            </div>
          </div>

          <div className={`est-conf est-conf--${result.fiabilite}`} data-testid={`est-res-conf-${result.fiabilite}`}>
            {fiabLabel}
          </div>
          {result.fiabilite_message && (
            <div className="est-warn" data-testid="est-res-warn">{result.fiabilite_message}</div>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <label className="est-switch" data-testid="est-res-toggle-net">
              <input type="checkbox" checked={net} onChange={(e) => setNet(e.target.checked)} />
              <span className="est-switch-slider" />
            </label>
            <span className="b1-small">{b1t('est.res.toggle_net')}</span>
          </div>
          {showNetWarn && (
            <div className="est-warn" data-testid="est-res-taux-manquant" style={{ marginTop: 8 }}>
              {b1t('est.warn.taux_manquant')}{' '}
              <button
                className="est-link"
                onClick={() => navigate('/app-b1/profil/pro')}>
                {b1t('est.warn.taux_cta')}
              </button>
            </div>
          )}

          <button
            className="est-detail-toggle"
            data-testid="est-res-detail-toggle"
            onClick={() => setDetail(!detail)}>
            <span>{b1t('est.res.detail_titre')}</span>
            {detail ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {detail && (
            <div className="est-detail" data-testid="est-res-detail">
              <div className="est-detail-row b1-small" style={{ opacity: 0.8 }}>
                {b1t('est.res.detail_stats', {
                  n: result.nb_comparables,
                  rayon: result.radius_used_m,
                  mois: result.fenetre_mois,
                })}
              </div>
              {result.mediane_locale_prix_m2 != null && (
                <div className="est-detail-row b1-small" style={{ opacity: 0.8 }}>
                  {b1t('est.res.detail_mediane', { v: fmtEUR(result.mediane_locale_prix_m2) })}
                </div>
              )}
              <div className="est-detail-row b1-small" style={{ opacity: 0.8 }}>
                {b1t('est.res.detail_surface', { v: result.surface_ponderee_m2 })}
              </div>

              <div className="est-detail-ajust-titre" style={{ marginTop: 12 }}>
                {b1t('est.res.detail_ajust_titre')}
              </div>
              <ul className="est-detail-ajust-list">
                {(result.ajustements || []).map((a) => (
                  <li key={a.code} className="est-detail-ajust-row" data-testid={`est-ajust-${a.code}`}>
                    <span>{a.libelle}</span>
                    <strong>
                      {a.unite === 'eur'
                        ? `${a.valeur > 0 ? '+' : ''}${fmtEUR(a.valeur)} €`
                        : `${a.valeur > 0 ? '+' : ''}${(a.valeur * 100).toFixed(0)} %`}
                    </strong>
                  </li>
                ))}
                <li className="est-detail-ajust-row est-detail-ajust-total">
                  <span>
                    {b1t('est.res.detail_total')}
                    {result.plafond_atteint && <em style={{ marginLeft: 6, opacity: 0.7 }}> ({b1t('est.res.detail_plafond_note')})</em>}
                  </span>
                  <strong>
                    {`${result.total_ajustement_pct > 0 ? '+' : ''}${(result.total_ajustement_pct * 100).toFixed(0)} %`}
                    {result.total_ajustement_eur !== 0 && (
                      <>{' '}·{' '}{`${result.total_ajustement_eur > 0 ? '+' : ''}${fmtEUR(result.total_ajustement_eur)} €`}</>
                    )}
                  </strong>
                </li>
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              className="b1-pill b1-pill--ghost"
              data-testid="est-res-action-enregistrer"
              onClick={() => navigate('/app-b1/estimations')}
              style={{ flex: 1 }}>
              {b1t('est.res.action_enregistrer')}
            </button>
            <button
              className="b1-pill b1-pill--primary"
              data-testid="est-res-action-dossier"
              onClick={() => navigate('/app-b1/rapport')}
              style={{ flex: 1 }}>
              {b1t('est.res.action_dossier')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADRESSE — /app-b1/estimation/adresse
// ---------------------------------------------------------------------------
export function EstimationAdressePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [cp, setCp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [manual, setManual] = useState(null); // {lat,lng,adresse,cp}
  const [dpe, setDpe] = useState(null);       // pré-remplissage DPE ADEME si trouvé
  const [type_bien, setType] = useState('Appartement');
  const [surface, setSurface] = useState('');
  useNoIndex();

  const search = async () => {
    if (!q || q.trim().length < 3) { setError(b1t('est.adr.err_introuvable')); return; }
    setLoading(true); setError(null); setDpe(null);
    try {
      const res = await b1api.geocoderAdresse(q, cp || undefined);
      if (!res.ok && res.code === 'dvf_exclu') {
        setError(b1t('est.warn.dvf_exclu'));
      } else if (!res.ok || !res.resultat) {
        setError(b1t('est.adr.err_introuvable'));
      } else {
        setManual({
          adresse: res.resultat.adresse_normalisee,
          code_postal: res.resultat.code_postal,
          lat: res.resultat.lat,
          lng: res.resultat.lng,
        });
        if (res.dpe && res.dpe.type_bien && res.dpe.surface_habitable) {
          setDpe(res.dpe);
          setType(res.dpe.type_bien);
          setSurface(String(res.dpe.surface_habitable));
        }
      }
    } catch (e) {
      setError(b1t('est.adr.err_introuvable'));
    } finally {
      setLoading(false);
    }
  };

  const startFlow = () => {
    if (!manual) return;
    if (!surface || Number(surface) < 5) { setError(b1t('est.adr.dpe_manquant')); return; }
    navigate('/app-b1/estimation/flow', {
      state: {
        bien: {
          ...manual,
          type_bien,
          surface_habitable: Number(surface),
          classe_dpe: dpe?.classe_dpe,
          annee_construction: dpe?.annee_construction,
          caracteristiques: dpe?.caracteristiques || null,
        },
      },
    });
  };

  return (
    <div className="b1-root">
      <div className="b1-screen" style={{ paddingBottom: 120 }}>
        <BackHeader label={b1t('est.adr.titre')} />
        <div className="b1-screen-content">
          <label className="b1-small">{b1t('est.adr.placeholder')}</label>
          <input
            className="b1-input"
            data-testid="est-adr-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={b1t('est.adr.placeholder')} />
          <div style={{ marginTop: 12 }}>
            <label className="b1-small">{b1t('profil.perso.cp')}</label>
            <input
              className="b1-input"
              data-testid="est-adr-cp"
              value={cp}
              onChange={(e) => setCp(e.target.value)}
              inputMode="numeric" maxLength={5} />
          </div>
          <button
            className="b1-pill b1-pill--primary b1-pill--fullwidth"
            data-testid="est-adr-search"
            style={{ marginTop: 16 }}
            disabled={loading}
            onClick={search}>
            {loading ? b1t('sys.un_instant') : b1t('est.adr.cta')}
          </button>
          {error && <div className="est-error" data-testid="est-adr-error">{error}</div>}

          {manual && (
            <div className="b1-card" style={{ marginTop: 24 }}>
              <div className="b1-h2" style={{ fontSize: 16 }}>{manual.adresse}</div>
              <div className="b1-small" style={{ marginTop: 4 }}>{manual.code_postal}</div>

              {dpe ? (
                <div style={{ marginTop: 16, padding: 12, background: 'var(--b1-accent-light)', borderRadius: 8 }} data-testid="est-adr-dpe-found">
                  <div className="b1-small" style={{ fontWeight: 600 }}>{b1t('est.adr.dpe_trouve')}</div>
                  <div className="b1-small" style={{ marginTop: 6 }}>
                    {b1t('est.adr.dpe_type')} : <strong>{dpe.type_bien === 'Maison' ? b1t('est.bien.type_maison') : b1t('est.bien.type_appart')}</strong>
                    {' · '}{b1t('est.adr.dpe_surface')} : <strong>{dpe.surface_habitable} m²</strong>
                    {dpe.classe_dpe && (<>{' · DPE '}<strong>{dpe.classe_dpe}</strong></>)}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 16 }}>
                  <div className="est-warn" data-testid="est-adr-dpe-manquant" style={{ marginBottom: 16 }}>
                    {b1t('est.adr.dpe_manquant')}
                  </div>
                  <label className="b1-small">{b1t('est.adr.q_type')}</label>
                  <OptGrid>
                    {['Appartement', 'Maison'].map((t) => (
                      <OptBtn key={t}
                              label={t === 'Appartement' ? b1t('est.bien.type_appart') : b1t('est.bien.type_maison')}
                              active={type_bien === t} onClick={() => setType(t)}
                              testid={`est-adr-type-${t.toLowerCase()}`} />
                    ))}
                  </OptGrid>

                  <div style={{ marginTop: 12 }}>
                    <label className="b1-small">{b1t('est.adr.q_surface')}</label>
                    <input
                      className="b1-input"
                      data-testid="est-adr-surface"
                      type="number" min="5" max="5000" step="1"
                      value={surface}
                      onChange={(e) => setSurface(e.target.value)} />
                  </div>
                </div>
              )}

              <button
                className="b1-pill b1-pill--primary b1-pill--fullwidth"
                data-testid="est-adr-continuer"
                style={{ marginTop: 16 }}
                onClick={startFlow}>
                {b1t('est.bien.cta_estimer')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MES ESTIMATIONS — /app-b1/estimations
// ---------------------------------------------------------------------------
export function MesEstimationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  useNoIndex();

  useEffect(() => {
    b1api.getEstimations().then((r) => setItems(r.estimations || [])).catch(() => setItems([]));
  }, []);

  return (
    <div className="b1-root">
      <div className="b1-screen" style={{ paddingBottom: 120 }}>
        <BackHeader label={b1t('mes.est.titre')} />
        <div className="b1-screen-content">
          {items === null && <div className="b1-small">{b1t('sys.un_instant')}</div>}
          {items && items.length === 0 && (
            <div className="b1-card" data-testid="mes-est-vide">
              <div className="b1-h2" style={{ fontSize: 18 }}>{b1t('mes.est.vide.titre')}</div>
              <div className="b1-lead" style={{ marginTop: 6 }}>{b1t('mes.est.vide.sous')}</div>
            </div>
          )}
          {items && items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map((it) => {
                const d = it.date_creation ? new Date(it.date_creation) : null;
                const dstr = d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                const conf = it.resultat?.fiabilite || 'faible';
                return (
                  <div
                    key={it.estimation_id}
                    className="b1-card b1-card-tap"
                    data-testid={`mes-est-item-${it.estimation_id}`}
                    onClick={() => navigate(`/app-b1/estimations/${it.estimation_id}`)}>
                    <div className="b1-card-title">{it.adresse || '—'}</div>
                    <div className="b1-card-sub">{dstr}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                      <strong>{b1t('mes.est.item_prix', { v: fmtEUR(it.resultat?.prix_commercialisation) })}</strong>
                      <span className="b1-small">{b1t('mes.est.item_conf', { niveau: conf })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EstimationDetailPage() {
  const { id } = useParams();
  const [est, setEst] = useState(null);
  const [err, setErr] = useState(null);
  useNoIndex();
  useEffect(() => {
    if (!id) return;
    b1api.getEstimation(id).then((r) => setEst(r.estimation)).catch((e) => setErr(e.message));
  }, [id]);

  if (err) return (
    <div className="b1-root">
      <div className="b1-screen">
        <BackHeader label={b1t('mes.est.titre')} />
        <div className="b1-screen-content"><div className="est-error">{err}</div></div>
      </div>
    </div>
  );
  if (!est) return (
    <div className="b1-root">
      <div className="b1-screen"><BackHeader label={b1t('mes.est.titre')} />
        <div className="b1-screen-content"><div className="b1-small">{b1t('sys.un_instant')}</div></div>
      </div>
    </div>
  );

  return <EstimationResultPage result={est.resultat} bien={{ adresse: est.adresse, code_postal: est.code_postal }} />;
}
