// KOLO — BLOC C2 : Éditeur de dossier « Avis de valeur »
// UI complète — liste, éditeur 22 sections, mur rédacteur, export, progress.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, X, FileText, Loader2, Camera } from 'lucide-react';
import b1t from './b1i18n';
import b1api, { API } from './b1api';
import { saveDraft, loadDraft, clearDraft } from './b3offline';
import './b1dossier.css';

const SECTIONS = [
  'dossier','redacteur','mission','identification','surfaces','composition',
  'technique','energie','copropriete','charges_fiscalite','environnement',
  'marche','methode','comparables','ajustements','swot','conclusion',
  'net_vendeur','strategie','mentions','annexes','signature',
];

const REDACTEUR_ORDRE = [
  'agent_nom','agent_email','agent_tel','agence_nom','agence_siren',
  'carte_pro','carte_pro_cci','rcp_assureur','rcp_police',
];

// ============================================================================
// Liste des dossiers
// ============================================================================
export function DossierListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [creating, setCreating] = useState(false);
  const [estimations, setEstimations] = useState([]);
  useEffect(() => { (async () => {
    try {
      const r = await b1api.getDossiers();
      setItems(r?.dossiers || []);
    } catch { setItems([]); }
  })(); }, []);

  const openCreate = async () => {
    try {
      const r = await b1api.getEstimations();
      setEstimations(r?.estimations || []);
      setCreating(true);
    } catch { setEstimations([]); setCreating(true); }
  };

  const doCreate = async (est) => {
    try {
      const r = await b1api.postDossier({ estimation_id: est.estimation_id, niveau: 1 });
      navigate(`/app-b1/rapport/${r.dossier.dossier_id}`);
    } catch (e) { console.error(e); }
  };

  if (items === null) return <div className="b1-root b1-page" data-testid="dos-list-loading"><p>{b1t('sys.un_instant')}</p></div>;

  return (
    <div className="b1-root b1-page" style={{ padding: '16px 20px 96px' }} data-testid="dos-list-page">
      <h1 className="b1-h1" style={{ marginBottom: 12 }}>{b1t('nav.rapport')}</h1>
      {items.length === 0 && !creating && (
        <div className="b1-card" style={{ padding: 20 }} data-testid="dos-list-empty">
          <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>{b1t('dos.liste.vide.titre')}</h3>
          <p style={{ color: 'var(--b1-text-secondary)', margin: '0 0 16px' }}>{b1t('dos.liste.vide.sous')}</p>
          <button type="button" className="b1-pill b1-pill--primary" onClick={openCreate} data-testid="dos-create-open">
            {b1t('dos.nouveau')}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <button type="button" className="b1-pill b1-pill--primary" onClick={openCreate} data-testid="dos-create-open" style={{ marginBottom: 16 }}>
            {b1t('dos.nouveau')}
          </button>
          <div className="dos-section-list">
            {items.map((d) => (
              <button
                type="button"
                key={d.dossier_id}
                className="dos-section-row"
                onClick={() => navigate(`/app-b1/rapport/${d.dossier_id}`)}
                data-testid={`dos-list-item-${d.dossier_id}`}
              >
                <FileText size={18} color="var(--b1-accent)" />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 500 }}>{d?.sections?.identification?.adresse || d?.sections?.dossier?.ref || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--b1-text-muted)' }}>
                    {d?.sections?.dossier?.ref} · {b1t(`dos.statut.${d.statut}`)}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--b1-text-muted)" />
              </button>
            ))}
          </div>
        </>
      )}

      {creating && (
        <div className="b1-card" style={{ padding: 20, marginTop: 12 }} data-testid="dos-create-panel">
          <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>{b1t('dos.creer.titre')}</h3>
          <p style={{ color: 'var(--b1-text-secondary)', margin: '0 0 12px' }}>{b1t('dos.creer.choisir')}</p>
          {estimations.length === 0 ? (
            <p style={{ color: 'var(--b1-text-muted)', fontSize: 13 }}>{b1t('dos.creer.aucune')}</p>
          ) : (
            <div className="dos-section-list">
              {estimations.map((e) => (
                <button
                  type="button"
                  key={e.estimation_id}
                  className="dos-section-row"
                  onClick={() => doCreate(e)}
                  data-testid={`dos-create-est-${e.estimation_id}`}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 500 }}>{e.adresse || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--b1-text-muted)' }}>
                      {e.type_bien} · {e.surface_habitable} m² · {e?.resultat?.prix_commercialisation?.toLocaleString('fr-FR')} €
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--b1-text-muted)" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Éditeur d'un dossier
// ============================================================================
export function DossierEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ dossier: null, completude: null, loading: true });
  const [mode, setMode] = useState('overview'); // overview | wall | export | section
  const [currentSection, setCurrentSection] = useState(null);
  const [wallIndex, setWallIndex] = useState(0);
  const [toast, setToast] = useState('');
  const draftName = `dossier_${id}`;

  // --- Chargement ---
  const load = useCallback(async () => {
    try {
      const r = await b1api.getDossier(id);
      // Merge d'un éventuel brouillon local (sections édités hors ligne)
      const draft = loadDraft(draftName);
      if (draft) {
        r.dossier.sections = { ...(r.dossier.sections || {}), ...(draft.sections || {}) };
      }
      setState({ dossier: r.dossier, completude: r.completude, ajustement: r.ajustement, loading: false });
    } catch (e) {
      setState({ dossier: null, completude: null, loading: false, error: e.message });
    }
  }, [id, draftName]);
  useEffect(() => { load(); }, [load]);

  // --- Patch (offline-safe : brouillon local systématique) ---
  const patchSection = useCallback(async (sectionId, values) => {
    const draft = loadDraft(draftName) || { sections: {} };
    draft.sections = { ...(draft.sections || {}), [sectionId]: values };
    saveDraft(draftName, draft);
    // Optimistic UI
    setState((s) => ({
      ...s,
      dossier: {
        ...s.dossier,
        sections: { ...(s.dossier.sections || {}), [sectionId]: values },
      },
    }));
    try {
      const r = await b1api.patchDossier(id, { sections: { [sectionId]: values } });
      setState((s) => ({ ...s, dossier: r.dossier, completude: r.completude, ajustement: r.ajustement }));
      // Draft utilisé et synchronisé — on peut le nettoyer sur la section persistée
      const still = loadDraft(draftName) || { sections: {} };
      if (still.sections) { delete still.sections[sectionId]; saveDraft(draftName, still); }
    } catch (e) {
      // Réseau KO : le brouillon local restera pour un flush au retour du réseau.
      console.info('[dossier] patch offline, gardé en brouillon', e);
    }
  }, [id, draftName]);

  const setLevel = useCallback(async (niveau) => {
    try {
      const r = await b1api.patchDossier(id, { niveau });
      setState((s) => ({ ...s, dossier: r.dossier, completude: r.completude }));
    } catch (e) { console.error(e); }
  }, [id]);

  // --- Rendering ---
  if (state.loading) return <div className="b1-root b1-page" style={{ padding: 20 }}>{b1t('sys.un_instant')}</div>;
  if (!state.dossier) return <div className="b1-root b1-page" style={{ padding: 20 }}>{state.error || b1t('sys.connexion_perdue')}</div>;

  const dossier = state.dossier;
  const completude = state.completude || { blocages: {}, redacteur_manquants: [], pret_export: false };
  const okCount = Object.values(completude.blocages || {}).filter(Boolean).length;

  const goExport = () => {
    if (!completude.pret_export) {
      // Mur rédacteur si c'est ça qui bloque, sinon on reste sur l'overview
      if (!completude.blocages.redacteur) { setWallIndex(0); setMode('wall'); return; }
    }
    setMode('export');
  };

  if (mode === 'wall') {
    return <RedacteurWall
      dossier={dossier}
      manquants={completude.redacteur_manquants}
      index={wallIndex}
      onIndex={setWallIndex}
      onSubmitField={async (fieldId, value) => {
        const newRedacteur = { ...(dossier.sections.redacteur || {}), [fieldId]: value };
        await patchSection('redacteur', newRedacteur);
      }}
      onDone={() => { setMode('overview'); load(); }}
      onBack={() => setMode('overview')}
    />;
  }
  if (mode === 'export') {
    return <ExportScreen
      dossier={dossier}
      onBack={() => setMode('overview')}
      onToast={(m) => setToast(m)}
    />;
  }
  if (mode === 'section' && currentSection) {
    return <SectionEditor
      dossier={dossier}
      sectionId={currentSection}
      ajustement={state.ajustement}
      onBack={() => { setCurrentSection(null); setMode('overview'); }}
      onSave={async (values) => {
        try {
          await patchSection(currentSection, values);
          setCurrentSection(null); setMode('overview');
        } catch (e) {
          // erreur remontée : le SectionEditor a déjà l'info via state
        }
      }}
    />;
  }

  // --- Vue d'ensemble ---
  return (
    <div className="b1-root b1-page dos-editor-page" data-testid="dos-editor-overview">
      <div className="dos-topbar">
        <button type="button" onClick={() => navigate('/app-b1/rapport')} aria-label={b1t('sys.retour')} data-testid="dos-back-to-list" style={{ border: 0, background: 'transparent', padding: 6 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="b1-h1" style={{ fontSize: 20, margin: 0 }}>{dossier?.sections?.dossier?.ref}</h1>
        <span className="dos-offline-tag" data-testid="dos-offline-tag">{b1t('dos.offline.saved')}</span>
      </div>

      {/* Bandeau état */}
      {completude.pret_export ? (
        <div className="dos-banner dos-banner--ready" data-testid="dos-banner-ready">
          <Check size={16} /> {b1t('dos.banniere.pret')}
        </div>
      ) : (
        <div className="dos-banner dos-banner--wip" data-testid="dos-banner-wip">
          {b1t('dos.banniere.encours')}
        </div>
      )}

      {/* Sélecteur niveau */}
      <div className="dos-level" role="tablist" data-testid="dos-level-selector">
        <button type="button" className="dos-level-opt" data-active={dossier.niveau === 1} onClick={() => setLevel(1)} data-testid="dos-level-1">
          {b1t('dos.niveau.1')}
          <span className="dos-level-opt-sub">{b1t('dos.niveau.1.sous')}</span>
        </button>
        <button type="button" className="dos-level-opt" data-active={dossier.niveau === 2} onClick={() => setLevel(2)} data-testid="dos-level-2">
          {b1t('dos.niveau.2')}
          <span className="dos-level-opt-sub">{b1t('dos.niveau.2.sous')}</span>
        </button>
      </div>

      {/* Complétude */}
      <div className="dos-completude" data-testid="dos-completude">
        <h3>{b1t('dos.completude.titre')}</h3>
        <p>{b1t('dos.completude.sous')}</p>
        <div className="dos-completude-progress"><span style={{ width: `${(okCount / 5) * 100}%` }} /></div>
        <div className="dos-completude-count">{b1t('dos.completude.compteur', { n: okCount })}</div>

        <CompletudeItem ok={completude.blocages.demandeur} labelKey="dos.completude.item.demandeur" onClick={() => { setCurrentSection('mission'); setMode('section'); }} testid="dos-comp-demandeur" />
        <CompletudeItem ok={completude.blocages.adresse} labelKey="dos.completude.item.adresse" onClick={() => { setCurrentSection('identification'); setMode('section'); }} testid="dos-comp-adresse" />
        <CompletudeItem ok={completude.blocages.surface} labelKey="dos.completude.item.surface" onClick={() => { setCurrentSection('surfaces'); setMode('section'); }} testid="dos-comp-surface" />
        <CompletudeItem ok={completude.blocages.photo} labelKey="dos.completude.item.photo" onClick={() => { setCurrentSection('dossier'); setMode('section'); }} testid="dos-comp-photo" />
        <CompletudeItem
          ok={completude.blocages.redacteur}
          labelKey="dos.completude.item.redacteur"
          detail={!completude.blocages.redacteur && completude.redacteur_manquants.length > 0
            ? b1t('dos.completude.item.redacteur.manque', {
                n: completude.redacteur_manquants.length,
                s: completude.redacteur_manquants.length > 1 ? 's' : '',
              })
            : ''}
          onClick={() => { setWallIndex(0); setMode('wall'); }}
          testid="dos-comp-redacteur"
        />
      </div>

      <button
        type="button"
        className="b1-pill b1-pill--primary"
        style={{ width: '100%', marginTop: 16 }}
        onClick={goExport}
        disabled={!completude.pret_export}
        data-testid="dos-goto-export"
      >
        {b1t('dos.action.exporter')}
      </button>

      {/* Toutes les sections (accès direct) */}
      <div style={{ marginTop: 24 }} data-testid="dos-section-list">
        <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--b1-text-muted)', marginBottom: 8 }}>Sections</div>
        <div className="dos-section-list">
          {SECTIONS.map((sid, i) => (
            <button
              type="button"
              key={sid}
              className="dos-section-row"
              onClick={() => { setCurrentSection(sid); setMode('section'); }}
              data-testid={`dos-section-${sid}`}
            >
              <span className="dos-section-row-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="dos-section-row-label">{b1t(`dos.section.${sid}`)}</span>
              <ChevronRight size={16} color="var(--b1-text-muted)" />
            </button>
          ))}
        </div>
      </div>

      {toast && <div className="dos-toast" data-testid="dos-toast">{toast}</div>}
    </div>
  );
}

function CompletudeItem({ ok, labelKey, detail, onClick, testid }) {
  return (
    <div className="dos-completude-item" data-ok={ok ? 'true' : 'false'} onClick={onClick} data-testid={testid} role="button" tabIndex={0}>
      {ok ? <Check size={16} className="dos-check" /> : <X size={16} className="dos-check" />}
      <div style={{ flex: 1 }}>
        <div className="dos-completude-item-label">{b1t(labelKey)}</div>
        {detail && <div className="dos-completude-item-detail">{detail}</div>}
      </div>
      <ChevronRight size={14} color="var(--b1-text-muted)" />
    </div>
  );
}

// ============================================================================
// Mur rédacteur — un champ par écran, avec choix carte propre / mandataire
// ============================================================================
function RedacteurWall({ dossier, manquants, index, onIndex, onSubmitField, onDone, onBack }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const statutCarte = dossier?.sections?.redacteur?.statut_carte;
  const needChoice = !statutCarte;
  const fieldId = manquants[index];
  useEffect(() => { setValue(''); }, [fieldId]);

  // Étape 0 : choix carte propre / mandataire (une seule fois)
  if (needChoice) {
    const pick = async (choice) => {
      setSaving(true);
      try { await onSubmitField('statut_carte', choice); } finally { setSaving(false); }
    };
    return (
      <div className="dos-mur b1-root" data-testid="dos-wall-choix">
        <button type="button" onClick={onBack} data-testid="dos-wall-back" style={{ border: 0, background: 'transparent', padding: 6, marginBottom: 12 }}>
          <ArrowLeft size={20} />
        </button>
        <div className="dos-mur-eyebrow">{b1t('dos.mur.choix.titre')}</div>
        <h1 className="b1-h1" style={{ marginBottom: 8 }}>{b1t('dos.mur.choix.titre')}</h1>
        <p>{b1t('dos.mur.choix.sous')}</p>
        <button type="button" className="b1-pill b1-pill--primary" style={{ width: '100%', marginBottom: 10 }} disabled={saving} onClick={() => pick('propre')} data-testid="dos-wall-choix-propre">
          {b1t('dos.mur.choix.propre')}
        </button>
        <button type="button" className="b1-pill b1-pill--ghost" style={{ width: '100%' }} disabled={saving} onClick={() => pick('mandataire')} data-testid="dos-wall-choix-mandataire">
          {b1t('dos.mur.choix.mandataire')}
        </button>
      </div>
    );
  }

  if (!fieldId) {
    return (
      <div className="dos-mur" data-testid="dos-wall-done">
        <div className="dos-mur-eyebrow">✓</div>
        <h1 className="b1-h1">{b1t('dos.mur.fini.titre')}</h1>
        <button type="button" className="b1-pill b1-pill--primary" onClick={onDone} data-testid="dos-wall-done-cta">
          {b1t('dos.mur.fini.cta')}
        </button>
      </div>
    );
  }
  const remaining = manquants.length - index;
  const submit = async () => {
    if (!value.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmitField(fieldId, value.trim());
      if (index + 1 >= manquants.length) { onDone(); } else { onIndex(index + 1); }
    } finally { setSaving(false); }
  };
  return (
    <div className="dos-mur b1-root" data-testid={`dos-wall-${fieldId}`}>
      <button type="button" onClick={onBack} data-testid="dos-wall-back" style={{ border: 0, background: 'transparent', padding: 6, marginBottom: 12 }}>
        <ArrowLeft size={20} />
      </button>
      <div className="dos-mur-eyebrow">{b1t('dos.mur.eyebrow', { n: remaining, s: remaining > 1 ? 's' : '' })}</div>
      <h1 className="b1-h1">{b1t(`dos.mur.champ.${fieldId}`)}</h1>
      <p>{b1t('dos.mur.sous')}</p>
      <input
        className="b1-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        autoFocus
        data-testid={`dos-wall-input-${fieldId}`}
      />
      <button type="button" className="b1-pill b1-pill--primary" onClick={submit} disabled={!value.trim() || saving} data-testid="dos-wall-continuer">
        {b1t('dos.mur.continuer')}
      </button>
    </div>
  );
}

// ============================================================================
// Editeur de section (formulaire simple par section critique)
// ============================================================================
function SectionEditor({ dossier, sectionId, ajustement, onBack, onSave }) {
  const initial = dossier.sections?.[sectionId] || {};
  const [values, setValues] = useState(initial);
  const [error, setError] = useState('');
  const setField = (k, v) => setValues((s) => ({ ...s, [k]: v }));

  const ecart = ajustement?.ecart;
  const seuil = ajustement?.seuil ?? 0.10;
  const motifObligatoire = sectionId === 'ajustements'
    && ecart != null && Math.abs(ecart) >= seuil;

  const trySave = async () => {
    setError('');
    if (motifObligatoire && !String(values.motif || '').trim()) {
      setError(b1t('dos.ajust.motif.obligatoire'));
      return;
    }
    try {
      await onSave(values);
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  const FIELDS = {
    mission: [
      { id: 'demandeur_nom', labelKey: 'dos.f.demandeur_nom', type: 'text' },
      { id: 'demandeur_qualite', labelKey: 'dos.f.demandeur_qualite', type: 'text' },
      { id: 'objet', labelKey: 'dos.f.objet', type: 'text' },
    ],
    identification: [
      { id: 'adresse', labelKey: 'dos.completude.item.adresse', type: 'text' },
      { id: 'code_postal', labelKey: 'profil.perso.cp', type: 'text' },
      { id: 'commune', labelKey: 'profil.perso.ville', type: 'text' },
      { id: 'annee_construction', labelKey: 'dos.f.demandeur_qualite', type: 'number' },
    ],
    surfaces: [
      { id: 'surface_habitable', labelKey: 'dos.f.surface_habitable', type: 'number' },
    ],
    composition: [
      { id: 'nb_pieces', labelKey: 'dos.f.nb_pieces', type: 'number' },
      { id: 'nb_chambres', labelKey: 'dos.f.nb_chambres', type: 'number' },
      { id: 'nb_sdb', labelKey: 'dos.f.nb_sdb', type: 'number' },
      { id: 'nb_wc', labelKey: 'dos.f.nb_wc', type: 'number' },
    ],
    dossier: [
      { id: 'photo_couverture', labelKey: 'dos.f.photo_couverture', type: 'photo', photoType: 'cover' },
      { id: 'date_visite', labelKey: 'dos.f.date_visite', type: 'date' },
    ],
    swot: [
      { id: 'atouts', labelKey: 'dos.f.atouts', type: 'lines', placeholderKey: 'dos.f.atouts.placeholder' },
      { id: 'faiblesses', labelKey: 'dos.f.faiblesses', type: 'lines', placeholderKey: 'dos.f.faiblesses.placeholder' },
    ],
    ajustements: [
      { id: 'motif', labelKey: 'dos.ajust.motif', type: 'textarea', placeholderKey: 'dos.ajust.motif.placeholder' },
    ],
  };
  const fields = FIELDS[sectionId];

  return (
    <div className="b1-root b1-page dos-editor-page" data-testid={`dos-section-editor-${sectionId}`}>
      <div className="dos-topbar">
        <button type="button" onClick={onBack} aria-label={b1t('sys.retour')} data-testid="dos-section-back" style={{ border: 0, background: 'transparent', padding: 6 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 20, margin: 0 }}>{b1t(`dos.section.${sectionId}`)}</h1>
      </div>

      {!fields ? (
        <div className="b1-card" style={{ padding: 20 }}>
          <p style={{ color: 'var(--b1-text-secondary)', margin: 0 }}>
            {b1t('placeholder.bientot')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {sectionId === 'ajustements' && (
            <div className="b1-card" style={{ padding: 16, background: 'var(--b1-accent-light)' }}>
              <div style={{ fontSize: 14, color: 'var(--b1-accent-pressed)' }}>{b1t('dos.ajust.sous')}</div>
              {ecart != null && (
                <div
                  style={{ fontSize: 13, marginTop: 8, fontFamily: 'DM Mono, monospace' }}
                  data-testid="dos-ajust-ecart"
                >
                  {b1t('dos.ajust.ecart', { n: (ecart >= 0 ? '+' : '') + (ecart * 100).toFixed(1) + ' %' })}
                </div>
              )}
              {motifObligatoire && (
                <div
                  style={{ fontSize: 13, marginTop: 6, color: 'var(--b1-danger)' }}
                  data-testid="dos-ajust-motif-obligatoire"
                >
                  {b1t('dos.ajust.motif.obligatoire')}
                </div>
              )}
            </div>
          )}
          {fields.map((f) => (
            <div key={f.id}>
              <label className="b1-input-label">{b1t(f.labelKey)}</label>
              {f.type === 'textarea' ? (
                <textarea
                  className="b1-input" rows={4}
                  value={values[f.id] || ''}
                  onChange={(e) => setField(f.id, e.target.value)}
                  placeholder={f.placeholderKey ? b1t(f.placeholderKey) : ''}
                  data-testid={`dos-f-${f.id}`}
                />
              ) : f.type === 'lines' ? (
                <textarea
                  className="b1-input" rows={5}
                  value={(values[f.id] || []).join('\n')}
                  onChange={(e) => setField(f.id, e.target.value.split('\n').filter(Boolean))}
                  placeholder={f.placeholderKey ? b1t(f.placeholderKey) : ''}
                  data-testid={`dos-f-${f.id}`}
                />
              ) : f.type === 'photo' ? (
                <PhotoField
                  dossierId={dossier.dossier_id}
                  currentUrl={values[f.id]}
                  photoType={f.photoType || 'cover'}
                  onChange={(url) => setField(f.id, url)}
                  testid={`dos-f-${f.id}`}
                />
              ) : (
                <input
                  className="b1-input"
                  type={f.type}
                  value={values[f.id] ?? ''}
                  onChange={(e) => setField(f.id, f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                  data-testid={`dos-f-${f.id}`}
                />
              )}
            </div>
          ))}
          <button type="button" className="b1-pill b1-pill--primary" onClick={trySave} data-testid="dos-section-save" style={{ marginTop: 8 }} disabled={motifObligatoire && !String(values.motif || '').trim()}>
            {b1t('dos.action.enregistrer')}
          </button>
          {error && <div style={{ color: 'var(--b1-danger)', fontSize: 13 }} data-testid="dos-section-error">{error}</div>}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Écran d'export — 3 boutons + progression + annulation + partage natif
// ============================================================================
function ExportScreen({ dossier, onBack, onToast }) {
  const [job, setJob] = useState(null);   // { job_id, status, progress }
  const [showProgress, setShowProgress] = useState(false);
  const [errored, setErrored] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const pollRef = useRef(null);
  const progressTimerRef = useRef(null);

  const cleanupPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (progressTimerRef.current) { clearTimeout(progressTimerRef.current); progressTimerRef.current = null; }
  };
  useEffect(() => () => cleanupPolling(), []);

  const startGenerate = useCallback(async () => {
    setErrored(false); setPdfReady(false);
    try {
      const r = await b1api.startDossierPdf(dossier.dossier_id);
      const j = { job_id: r.job_id, status: r.status, progress: 0 };
      setJob(j);
      // On n'affiche l'écran de progression qu'au-delà de 3 s
      progressTimerRef.current = setTimeout(() => setShowProgress(true), 3000);
      // Poll toutes les 400 ms
      pollRef.current = setInterval(async () => {
        try {
          const s = await b1api.getDossierPdfJob(dossier.dossier_id, r.job_id);
          setJob(s.job);
          if (s.job.status === 'done') {
            cleanupPolling();
            setShowProgress(false);
            setPdfReady(true);
            onToast(b1t('dos.export.reussi'));
          } else if (s.job.status === 'error') {
            cleanupPolling(); setShowProgress(false); setErrored(true);
          } else if (s.job.status === 'cancelled') {
            cleanupPolling(); setShowProgress(false);
          }
        } catch (e) { /* réessaie au prochain tick */ }
      }, 400);
    } catch (e) {
      console.error(e); setErrored(true);
    }
  }, [dossier.dossier_id, onToast]);

  const cancelGenerate = useCallback(async () => {
    if (!job) return;
    try { await b1api.cancelDossierPdfJob(dossier.dossier_id, job.job_id); } catch {}
    cleanupPolling();
    setShowProgress(false);
    setJob((j) => (j ? { ...j, status: 'cancelled' } : j));
  }, [job, dossier.dossier_id]);

  const savePdfNative = useCallback(async () => {
    // Charge le blob via l'API authentifiée
    try {
      const token = localStorage.getItem('kolo_v2_session') || localStorage.getItem('kolo_token') || '';
      const url = b1api.dossierPdfUrl(dossier.dossier_id);
      const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const blob = await r.blob();
      const filename = (r.headers.get('content-disposition') || '').match(/filename="?([^"]+)"?/)?.[1] || 'avis-de-valeur.pdf';

      // Capacitor : Share plugin natif iOS/Android
      try {
        const [{ Capacitor }, { Share }, { Filesystem, Directory }] = await Promise.all([
          import('@capacitor/core'), import('@capacitor/share'), import('@capacitor/filesystem'),
        ]);
        if (Capacitor.isNativePlatform()) {
          const b64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
            reader.readAsDataURL(blob);
          });
          const written = await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Cache });
          await Share.share({ url: written.uri, title: filename, dialogTitle: b1t('dos.export.enregistrer') });
          return;
        }
      } catch (e) { /* non natif → fallback download */ }

      // Fallback web : téléchargement direct
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) { console.error(e); onToast(b1t('dos.progress.erreur')); }
  }, [dossier.dossier_id, onToast]);

  const sendByEmail = useCallback(async () => {
    const adresse = dossier?.sections?.identification?.adresse || '';
    const subject = b1t('dos.export.mailto.sujet', { adresse });
    // Le mail natif ne peut pas embarquer un pièce jointe via mailto: sur mobile.
    // Sur natif → on ouvre le sheet de partage avec le PDF, préparé pour Mail.app.
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        await savePdfNative(); return;
      }
    } catch {}
    // Fallback web : ouvre mailto avec l'objet uniquement.
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}`;
  }, [dossier, savePdfNative]);

  if (showProgress) {
    const progressLine = job?.status === 'pending' ? b1t('dos.progress.l1')
      : job?.status === 'running' && (job?.progress || 0) < 90 ? b1t('dos.progress.l2')
      : b1t('dos.progress.l3');
    return (
      <div className="b1-root b1-page dos-editor-page" data-testid="dos-progress">
        <div className="dos-topbar">
          <h1 style={{ fontSize: 20, margin: 0 }}>{b1t('dos.export.titre')}</h1>
        </div>
        <div className="dos-progress">
          <h3>{b1t('dos.progress.titre')}</h3>
          <div className="dos-progress-lines" data-testid="dos-progress-line">{progressLine}</div>
          <div className="dos-progress-bar"><span style={{ width: `${job?.progress || 20}%` }} /></div>
          <button type="button" className="dos-progress-cancel" onClick={cancelGenerate} data-testid="dos-progress-cancel">
            {b1t('dos.progress.annuler')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="b1-root b1-page dos-editor-page" data-testid="dos-export-screen">
      <div className="dos-topbar">
        <button type="button" onClick={onBack} aria-label={b1t('sys.retour')} data-testid="dos-export-back" style={{ border: 0, background: 'transparent', padding: 6 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 20, margin: 0 }}>{b1t('dos.export.titre')}</h1>
      </div>

      {job?.status === 'cancelled' && (
        <div className="dos-banner dos-banner--wip" data-testid="dos-progress-cancelled">
          {b1t('dos.progress.annule')}
        </div>
      )}
      {errored && (
        <div className="dos-banner dos-banner--wip" data-testid="dos-progress-error">
          {b1t('dos.progress.erreur')}
        </div>
      )}

      <div className="dos-export-actions">
        <button
          type="button"
          className="b1-pill b1-pill--primary"
          onClick={startGenerate}
          disabled={job?.status === 'pending' || job?.status === 'running'}
          data-testid="dos-export-generer"
        >
          {job?.status === 'pending' || job?.status === 'running'
            ? <><Loader2 size={16} className="dos-spin" /> {b1t('dos.progress.titre')}</>
            : b1t('dos.export.generer')}
        </button>
        {pdfReady && (
          <>
            <button type="button" className="b1-pill b1-pill--ghost" onClick={savePdfNative} data-testid="dos-export-enregistrer">
              {b1t('dos.export.enregistrer')}
            </button>
            <button type="button" className="b1-pill b1-pill--ghost" onClick={sendByEmail} data-testid="dos-export-envoyer">
              {b1t('dos.export.envoyer')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default { DossierListPage, DossierEditorPage };

// ============================================================================
// PhotoField — capture native Capacitor Camera, fallback web input file
// ============================================================================
function PhotoField({ dossierId, currentUrl, photoType, onChange, testid }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const uploadBlob = useCallback(async (blob, filename = 'photo.jpg') => {
    setBusy(true); setError('');
    try {
      const token = localStorage.getItem('kolo_v2_session') || localStorage.getItem('kolo_token') || '';
      const fd = new FormData();
      fd.append('file', blob, filename);
      const res = await fetch(
        `${API}/api/dossiers/${encodeURIComponent(dossierId)}/photos?type=${photoType}`,
        { method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      onChange(j.url);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }, [dossierId, photoType, onChange]);

  const openNativeCamera = useCallback(async () => {
    try {
      const [{ Capacitor }, { Camera, CameraResultType, CameraSource }] = await Promise.all([
        import('@capacitor/core'), import('@capacitor/camera'),
      ]);
      if (!Capacitor.isNativePlatform()) throw new Error('web');
      const photo = await Camera.getPhoto({
        quality: 92, allowEditing: false, source: CameraSource.Prompt,
        resultType: CameraResultType.Base64, saveToGallery: false,
      });
      // Base64 -> blob
      const b = atob(photo.base64String);
      const arr = new Uint8Array(b.length);
      for (let i = 0; i < b.length; i++) arr[i] = b.charCodeAt(i);
      const blob = new Blob([arr], { type: `image/${photo.format || 'jpeg'}` });
      await uploadBlob(blob, `photo.${photo.format || 'jpg'}`);
    } catch (e) {
      // Fallback web
      fileInputRef.current?.click();
    }
  }, [uploadBlob]);

  const onFile = useCallback(async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    await uploadBlob(f, f.name);
    ev.target.value = '';
  }, [uploadBlob]);

  const token = (typeof window !== 'undefined')
    ? (localStorage.getItem('kolo_v2_session') || localStorage.getItem('kolo_token') || '')
    : '';
  const imgSrc = currentUrl
    ? `${API}${currentUrl}${currentUrl.includes('?') ? '&' : '?'}auth=${encodeURIComponent(token)}`
    : null;

  return (
    <div data-testid={testid}>
      {imgSrc && (
        <div style={{ marginBottom: 8 }}>
          <img
            src={imgSrc}
            alt=""
            style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid var(--b1-border)' }}
            data-testid={`${testid}-preview`}
          />
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={onFile}
        data-testid={`${testid}-input`}
      />
      <button
        type="button"
        className="b1-pill b1-pill--ghost"
        onClick={openNativeCamera}
        disabled={busy}
        data-testid={`${testid}-btn`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        <Camera size={16} />
        {busy ? b1t('sys.un_instant') : (currentUrl ? b1t('dos.f.photo_ajouter') : b1t('dos.f.photo_ajouter'))}
      </button>
      {currentUrl && (
        <button
          type="button"
          className="b1-pill b1-pill--ghost"
          style={{ marginLeft: 8 }}
          onClick={() => onChange(null)}
          data-testid={`${testid}-remove`}
        >
          {b1t('sys.supprimer') || 'Supprimer'}
        </button>
      )}
      {error && <div style={{ color: 'var(--b1-danger)', fontSize: 13, marginTop: 6 }} data-testid={`${testid}-error`}>{error}</div>}
    </div>
  );
}
