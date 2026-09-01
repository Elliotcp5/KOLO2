// KOLO — BLOC B1 · Onboarding (7 écrans séquentiels bloquants).
// Vouvoiement, i18n, scoped `.b1-root`.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { X, Check, Crown } from 'lucide-react';
import b1t, { getB1Locale } from './b1i18n';
import b1api from './b1api';
import { track, EVENTS } from './b3tracking';
import { IconStats, IconUser } from './B1Icons';
import './b1.css';

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------
function ProgressBar({ step, total }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="b1-progress-wrap" data-testid="onboarding-progress-bar">
      <div className="b1-progress-track">
        <div className="b1-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="b1-progress-label">{b1t('onb.progress', { step, total })}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen 1 — Identity
// ---------------------------------------------------------------------------
function ScreenIdentite({ initial, onNext }) {
  const [prenom, setPrenom] = useState(initial.prenom || '');
  const [nom, setNom] = useState(initial.nom || '');
  const valid = prenom.trim().length > 0 && nom.trim().length > 0;
  return (
    <div className="b1-slide" data-testid="onb-screen-identite">
      <ProgressBar step={1} total={7} />
      <h1 className="b1-h1" style={{ marginTop: 24 }}>{b1t('onb.identite.titre')}</h1>
      <p className="b1-lead">{b1t('onb.identite.sous')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
        <div>
          <div className="b1-input-label">{b1t('onb.identite.prenom')}</div>
          <input
            className="b1-input"
            data-testid="onb-input-prenom"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            autoCapitalize="words"
            autoComplete="given-name"
          />
        </div>
        <div>
          <div className="b1-input-label">{b1t('onb.identite.nom')}</div>
          <input
            className="b1-input"
            data-testid="onb-input-nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            autoCapitalize="words"
            autoComplete="family-name"
          />
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <button
        className="b1-pill b1-pill--primary b1-pill--fullwidth"
        data-testid="onb-identite-next"
        disabled={!valid}
        onClick={() => onNext({ prenom: prenom.trim(), nom: nom.trim() })}
      >
        {b1t('onb.continuer')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen 2 — Statut
// ---------------------------------------------------------------------------
function ScreenStatut({ initial, onNext }) {
  const [statut, setStatut] = useState(initial.statut_declare || null);
  return (
    <div className="b1-slide" data-testid="onb-screen-statut">
      <ProgressBar step={2} total={7} />
      <h1 className="b1-h1" style={{ marginTop: 24 }}>{b1t('onb.statut.titre')}</h1>
      <p className="b1-lead">{b1t('onb.statut.sous')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        {[
          { id: 'agent', title: b1t('onb.statut.agent.titre'), sub: b1t('onb.statut.agent.sous') },
          { id: 'directeur', title: b1t('onb.statut.directeur.titre'), sub: b1t('onb.statut.directeur.sous') },
        ].map((c) => (
          <button
            key={c.id}
            className="b1-card-tap"
            data-testid={`onb-statut-${c.id}`}
            data-active={statut === c.id}
            onClick={() => setStatut(c.id)}
          >
            <div style={{ flex: 1 }}>
              <div className="b1-card-title">{c.title}</div>
              <div className="b1-card-sub">{c.sub}</div>
            </div>
            {statut === c.id && <span style={{ color: 'var(--b1-accent)' }}><Check size={22} strokeWidth={3} /></span>}
          </button>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <button
        className="b1-pill b1-pill--primary b1-pill--fullwidth"
        data-testid="onb-statut-next"
        disabled={!statut}
        onClick={() => onNext({ statut_declare: statut })}
      >
        {b1t('onb.continuer')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen 3 — Zones
// ---------------------------------------------------------------------------
function ScreenZones({ initial, onNext }) {
  const [zones, setZones] = useState(initial.zones || []); // [{cp, ville}]
  const [cp, setCp] = useState('');
  const [villeCandidate, setVilleCandidate] = useState(null);
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    setLookupError('');
    setVilleCandidate(null);
    if (cp.length === 5) {
      let cancelled = false;
      b1api.getVille(cp)
        .then((r) => { if (!cancelled) { setVilleCandidate(r.ville || null); if (!r.connu) setLookupError(b1t('onb.zones.inconnu')); } })
        .catch(() => { if (!cancelled) setLookupError(b1t('onb.zones.inconnu')); });
      return () => { cancelled = true; };
    }
    return undefined;
  }, [cp]);

  const canAdd = cp.length === 5 && !zones.some(z => z.cp === cp) && zones.length < 2;

  const addZone = () => {
    if (!canAdd) return;
    setZones([...zones, { cp, ville: villeCandidate }]);
    setCp('');
    setVilleCandidate(null);
    setLookupError('');
  };

  const removeZone = (idx) => setZones(zones.filter((_, i) => i !== idx));
  const compteurKey = zones.length === 1 ? 'onb.zones.compteur' : 'onb.zones.compteur_pluriel';

  return (
    <div className="b1-slide" data-testid="onb-screen-zones">
      <ProgressBar step={3} total={7} />
      <h1 className="b1-h1" style={{ marginTop: 24 }}>{b1t('onb.zones.titre')}</h1>
      <p className="b1-lead">{b1t('onb.zones.sous')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {zones.map((z, idx) => (
          <div className="b1-zone-chip" key={z.cp} data-testid={`onb-zone-chip-${idx}`}>
            <div>
              <div className="b1-zone-chip-cp">{z.cp}</div>
              {z.ville && <div className="b1-zone-chip-ville">{z.ville}</div>}
            </div>
            <button className="b1-zone-chip-remove" onClick={() => removeZone(idx)} aria-label="Retirer" data-testid={`onb-zone-remove-${idx}`}>
              <X size={16} />
            </button>
          </div>
        ))}
        {zones.length < 2 && (
          <div>
            <input
              className="b1-input"
              data-testid="onb-input-cp"
              placeholder={b1t('onb.zones.placeholder')}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              value={cp}
              onChange={(e) => setCp(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
            />
            {cp.length === 5 && villeCandidate && (
              <div className="b1-zone-chip-ville" style={{ marginTop: 6, marginLeft: 4 }}>
                {cp} · {villeCandidate}
              </div>
            )}
            {lookupError && (
              <div className="b1-zone-chip-ville" style={{ marginTop: 6, marginLeft: 4, color: 'var(--b1-danger)' }} data-testid="onb-zone-error">
                {lookupError}
              </div>
            )}
            <button
              className="b1-pill b1-pill--ghost"
              data-testid="onb-zone-add"
              style={{ marginTop: 12, width: '100%', minHeight: 48 }}
              onClick={addZone}
              disabled={!canAdd}
            >
              {b1t('onb.zones.ajouter')}
            </button>
          </div>
        )}
      </div>
      <div className="b1-small" style={{ textAlign: 'center', marginTop: 8 }}>
        {b1t(compteurKey, { n: zones.length, max: 2 })}
      </div>
      <div style={{ flex: 1 }} />
      <button
        className="b1-pill b1-pill--primary b1-pill--fullwidth"
        data-testid="onb-zones-next"
        disabled={zones.length === 0}
        onClick={() => onNext({ zones })}
      >
        {b1t('onb.continuer')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen 4 — Traitement (spinner) + Screen 5 — Résultat
// ---------------------------------------------------------------------------
function ScreenTraitement({ zones, onDone }) {
  useEffect(() => {
    let cancelled = false;
    const kickoff = async () => {
      // Résultat local en fallback (utile pour session anonyme / preview).
      // La whitelist démo `99999` est TOUJOURS considérée couverte.
      // Les autres CP couverts en base : on tente l'appel API authentifié ;
      // si ça échoue, on marque non couvert (mais l'utilisateur peut modifier).
      const codes = zones.map((z) => z.cp);
      const localResults = await Promise.all(codes.map(async (cp) => {
        try {
          const v = await b1api.getVille(cp);
          return { code_postal: cp, ville: v.ville, couverte: cp === '99999' };
        } catch {
          return { code_postal: cp, ville: null, couverte: false };
        }
      }));
      let serverResults = null;
      try {
        serverResults = await b1api.postZones(codes);
      } catch (e) {
        // Session anonyme → on garde le résultat local.
      }
      await new Promise((r) => setTimeout(r, 1200));
      if (cancelled) return;
      const res = serverResults || {
        ok: true,
        resultats: localResults,
        au_moins_une_couverte: localResults.some((r) => r.couverte),
      };
      onDone(res);
    };
    kickoff();
    return () => { cancelled = true; };
  }, [zones, onDone]);
  return (
    <div className="b1-slide" style={{ textAlign: 'center', paddingTop: 80 }} data-testid="onb-screen-traitement">
      <ProgressBar step={4} total={7} />
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 60 }}>
        <div className="b1-spinner" />
      </div>
      <h2 className="b1-h2" style={{ marginTop: 32 }}>{b1t('onb.traitement.titre')}</h2>
      <p className="b1-lead" style={{ marginTop: 8 }}>{b1t('onb.traitement.sous')}</p>
    </div>
  );
}

function ScreenResultat({ resultats, au_moins_une_couverte, onOk, onModifier }) {
  const nonCouvertes = resultats.filter(r => !r.couverte);
  const isKo = !au_moins_une_couverte || nonCouvertes.length > 0;
  return (
    <div className="b1-slide" data-testid="onb-screen-resultat">
      <ProgressBar step={5} total={7} />
      <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0 24px' }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 999,
            background: isKo ? 'var(--b1-danger-tint)' : 'var(--b1-success-tint)',
            color: isKo ? 'var(--b1-danger)' : 'var(--b1-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isKo ? <X size={36} /> : <Check size={36} strokeWidth={3} />}
        </div>
      </div>
      <h1 className="b1-h1" style={{ textAlign: 'center' }}>
        {isKo ? b1t('onb.resultat.ko.titre') : b1t('onb.resultat.ok.titre')}
      </h1>
      <p className="b1-lead" style={{ textAlign: 'center', marginTop: 8 }}>
        {isKo ? b1t('onb.resultat.ko.sous') : b1t('onb.resultat.ok.sous')}
      </p>
      {isKo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
          {nonCouvertes.map((z) => (
            <div key={z.code_postal} className="b1-card" style={{ padding: 14 }}>
              <div className="b1-small">
                {b1t('onb.resultat.ko.enregistree', {
                  cp: z.code_postal,
                  ville: z.ville ? ` · ${z.ville}` : '',
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ flex: 1 }} />
      {isKo ? (
        <button
          className="b1-pill b1-pill--primary b1-pill--fullwidth"
          data-testid="onb-resultat-modifier"
          onClick={onModifier}
        >
          {b1t('onb.resultat.ko.modifier')}
        </button>
      ) : (
        <button
          className="b1-pill b1-pill--primary b1-pill--fullwidth"
          data-testid="onb-resultat-continuer"
          onClick={onOk}
        >
          {b1t('onb.continuer')}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen 6 — Plan (Pro featured, Découverte lien secondaire)
// ---------------------------------------------------------------------------
async function tryApplePurchase() {
  // Best-effort — plugin natif optionnel. Si absent, on renvoie null pour
  // basculer sur le fallback "Découverte + navigation profil".
  if (!Capacitor.isNativePlatform()) return { ok: false, reason: 'web' };
  try {
    const { CdvPurchase } = await import('cordova-plugin-purchase/www/store.js').catch(() => ({}));
    if (!CdvPurchase) return { ok: false, reason: 'no_plugin' };
    // Placeholder — l'implémentation complète du store est déjà dans /services/iapStore.js
    return { ok: false, reason: 'not_implemented' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

function ScreenPlan({ onCommit }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const goPro = async () => {
    setError('');
    setLoading(true);
    try {
      const p = await tryApplePurchase();
      // On enregistre l'intention côté backend, mais on n'échoue pas si non authentifié.
      try { await b1api.postPlan('pro'); } catch (e) { if (e.status !== 401) throw e; }
      onCommit('pro');
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const goDecouverte = async () => {
    setError('');
    setLoading(true);
    try {
      try { await b1api.postPlan('decouverte'); } catch (e) { if (e.status !== 401) throw e; }
      onCommit('decouverte');
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const openLegal = (path) => {
    try { window.open(path, '_blank'); } catch {}
  };

  return (
    <div className="b1-slide" data-testid="onb-screen-plan">
      <ProgressBar step={6} total={7} />
      <h1 className="b1-h1" style={{ marginTop: 24 }}>{b1t('onb.plan.titre')}</h1>
      <p className="b1-lead">{b1t('onb.plan.sous')}</p>

      <div className="b1-plan-pro" data-testid="onb-plan-pro-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="b1-plan-pro-title">{b1t('onb.plan.pro.nom')}</div>
            <div className="b1-plan-pro-price">{b1t('onb.plan.pro.prix')}</div>
          </div>
          <Crown size={30} strokeWidth={2.2} />
        </div>
        <div className="b1-plan-pro-feat"><Check size={18} /><span>{b1t('onb.plan.pro.l1')}</span></div>
        <div className="b1-plan-pro-feat"><Check size={18} /><span>{b1t('onb.plan.pro.l2')}</span></div>
        <div className="b1-plan-pro-feat"><Check size={18} /><span>{b1t('onb.plan.pro.l3')}</span></div>
        <button className="b1-plan-pro-cta" data-testid="onb-plan-pro-cta" onClick={goPro} disabled={loading}>
          {b1t('onb.plan.pro.cta')}
        </button>
        <div className="b1-plan-pro-mention">{b1t('onb.plan.pro.mention')}</div>
      </div>

      <button
        className="b1-plan-dec-lien"
        data-testid="onb-plan-decouverte-lien"
        onClick={goDecouverte}
        disabled={loading}
        style={{ background: 'transparent', border: 0 }}
      >
        {b1t('onb.plan.decouverte.lien')}
      </button>

      <div className="b1-plan-decouverte" data-testid="onb-plan-decouverte-card">
        <div className="b1-plan-dec-title">{b1t('onb.plan.decouverte.nom')}</div>
        <div className="b1-plan-dec-feat">• {b1t('onb.plan.decouverte.l1')}</div>
        <div className="b1-plan-dec-feat">• {b1t('onb.plan.decouverte.l2')}</div>
        <div className="b1-plan-dec-feat">• {b1t('onb.plan.decouverte.l3')}</div>
        <div className="b1-plan-dec-feat">• {b1t('onb.plan.decouverte.l4')}</div>
      </div>

      {error && <div className="b1-small" style={{ color: 'var(--b1-danger)', textAlign: 'center' }}>{error}</div>}

      <div className="b1-plan-legal">
        <a href="/terms" onClick={(e) => { e.preventDefault(); openLegal('/terms'); }} data-testid="onb-plan-tos">{b1t('onb.plan.legal.cgu')}</a>
        <a href="/privacy" onClick={(e) => { e.preventDefault(); openLegal('/privacy'); }} data-testid="onb-plan-privacy">{b1t('onb.plan.legal.privacy')}</a>
        <button data-testid="onb-plan-restore" onClick={() => openLegal('/iap-terms')}>{b1t('onb.plan.legal.restore')}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen 7 — Bienvenue final
// ---------------------------------------------------------------------------
function ScreenBienvenue({ onFinish }) {
  return (
    <div className="b1-slide" data-testid="onb-screen-bienvenue">
      <ProgressBar step={7} total={7} />
      <div style={{ display: 'flex', justifyContent: 'center', margin: '48px 0 24px' }}>
        <div
          style={{
            width: 96, height: 96, borderRadius: 999,
            background: 'linear-gradient(180deg, var(--b1-accent), var(--b1-accent-pressed))',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 20px 40px rgba(236,134,144,0.4)',
          }}
        >
          <Crown size={48} strokeWidth={2.2} />
        </div>
      </div>
      <h1 className="b1-h1" style={{ textAlign: 'center' }}>{b1t('onb.bienvenue.titre')}</h1>
      <p className="b1-lead" style={{ textAlign: 'center', marginTop: 8 }}>
        {b1t('onb.bienvenue.sous')}
      </p>
      <div style={{ flex: 1 }} />
      <button
        className="b1-pill b1-pill--primary b1-pill--fullwidth"
        data-testid="onb-bienvenue-cta"
        onClick={onFinish}
      >
        {b1t('onb.bienvenue.cta')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------
export default function B1Onboarding() {
  // Locale rerender safety
  const [, force] = useState(0);
  useEffect(() => {
    const onStorage = () => force(x => x + 1);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({});
  const [zoneResult, setZoneResult] = useState({ resultats: [], au_moins_une_couverte: false });
  const startedAt = useRef(Date.now());

  // Événement d'entrée dans l'onboarding (une fois par montage).
  useEffect(() => { track(EVENTS.ONBOARDING_DEBUT); }, []);

  const submitProfil = useCallback(async (prenom, nom, statut) => {
    try { await b1api.postProfil(prenom, nom, statut); } catch (e) { console.warn('postProfil', e); }
  }, []);

  const onFinishAll = useCallback(async () => {
    try { await b1api.postTermine(); } catch (e) { if (e.status !== 401) console.warn('postTermine', e); }
    try {
      localStorage.setItem('kolo_b1_onboarding_done', '1');
      localStorage.setItem('kolo_b1_show_tour', '1');
    } catch {}
    const elapsed = (Date.now() - startedAt.current) / 1000;
    console.info(`[B1] Onboarding terminé en ${elapsed.toFixed(1)}s`);
    navigate('/app-b1');
  }, [navigate]);

  return (
    <div className="b1-root">
      <div className="b1-screen">
        {step === 1 && (
          <ScreenIdentite
            initial={data}
            onNext={(v) => { setData({ ...data, ...v }); setStep(2); }}
          />
        )}
        {step === 2 && (
          <ScreenStatut
            initial={data}
            onNext={(v) => {
              const newData = { ...data, ...v };
              setData(newData);
              submitProfil(newData.prenom, newData.nom, newData.statut_declare);
              setStep(3);
            }}
          />
        )}
        {step === 3 && (
          <ScreenZones
            initial={data}
            onNext={(v) => {
              const cps = (v.zones || []).map((z) => z.cp);
              track(EVENTS.ZONES_VALIDEES, { cp_liste: cps, au_moins_une_couverte: null });
              setData({ ...data, ...v }); setStep(4);
            }}
          />
        )}
        {step === 4 && (
          <ScreenTraitement
            zones={data.zones || []}
            onDone={(res) => {
              setZoneResult(res);
              (res.resultats || []).filter(r => !r.couverte).forEach((r) => {
                track(EVENTS.ZONE_NON_COUVERTE, { cp: r.code_postal });
              });
              setStep(5);
            }}
          />
        )}
        {step === 5 && (
          <ScreenResultat
            resultats={zoneResult.resultats || []}
            au_moins_une_couverte={zoneResult.au_moins_une_couverte}
            onOk={() => { track(EVENTS.PAYWALL_AFFICHE, { contexte: 'onboarding' }); setStep(6); }}
            onModifier={() => setStep(3)}
          />
        )}
        {step === 6 && (
          <ScreenPlan
            onCommit={(plan) => { track(EVENTS.PLAN_CHOISI, { plan }); setStep(7); }}
          />
        )}
        {step === 7 && (
          <ScreenBienvenue onFinish={onFinishAll} />
        )}
      </div>
    </div>
  );
}
