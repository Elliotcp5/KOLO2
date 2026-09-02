// KOLO — Écran de reprise post-migration V2 → B1.
// Affiché à la première ouverture de B1 quand `zones_confirmees === false`.
// Objectif : 1 tap pour valider, jamais un champ vide.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, X, Check } from 'lucide-react';
import b1t from './b1i18n';
import b1api from './b1api';
import './b1.css';

export default function B1RepriseZones() {
  const navigate = useNavigate();
  const [cps, setCps] = useState([]);      // [{ cp, ville }]
  const [cp, setCp] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Charge les suggestions au montage (jamais un champ vide)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await b1api.getSuggestionsZones();
        // Si déjà confirmé → on redirige vers l'app
        if (r.zones_confirmees) { navigate('/app-b1', { replace: true }); return; }
        const suggestions = (r.zones_suggestions || []).slice(0, 2);
        // Enrichit chaque CP avec sa ville
        const items = await Promise.all(suggestions.map(async (c) => {
          try { const v = await b1api.getVille(c); return { cp: c, ville: v?.ville || null }; }
          catch { return { cp: c, ville: null }; }
        }));
        if (!cancelled) setCps(items.length ? items : [{ cp: '75017', ville: 'Paris 17ᵉ' }]);
      } catch (_e) {
        if (!cancelled) setCps([{ cp: '75017', ville: 'Paris 17ᵉ' }]);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const addCp = async () => {
    if (cp.length !== 5 || cps.some((x) => x.cp === cp) || cps.length >= 2) return;
    try {
      const v = await b1api.getVille(cp);
      setCps([...cps, { cp, ville: v?.ville || null }]);
    } catch { setCps([...cps, { cp, ville: null }]); }
    setCp('');
  };
  const removeCp = (i) => setCps(cps.filter((_, idx) => idx !== i));

  const valider = async () => {
    setSaving(true); setErr('');
    try {
      await b1api.confirmerZones(cps.map((x) => x.cp));
      navigate('/app-b1', { replace: true });
    } catch (e) {
      setErr(e.message || 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="b1-root">
      <div className="b1-shell">
        <div className="b1-screen">
          <h1 className="b1-h1" style={{ marginTop: 24 }}>{b1t('reprise.titre')}</h1>
          <p className="b1-lead">{b1t('reprise.sous')}</p>

          <div style={{ marginTop: 24 }}>
            {cps.map((z, i) => (
              <div className="b1-zone-chip" key={z.cp} data-testid={`b1-reprise-zone-${z.cp}`}>
                <div>
                  <div className="b1-zone-chip-cp">{z.cp}</div>
                  {z.ville && <div className="b1-zone-chip-ville">{z.ville}</div>}
                </div>
                {cps.length > 1 && (
                  <button className="b1-zone-chip-remove" onClick={() => removeCp(i)} aria-label="Retirer" data-testid={`b1-reprise-remove-${i}`}>
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}

            {cps.length < 2 && (
              <>
                <input
                  className="b1-input"
                  data-testid="b1-reprise-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={5}
                  value={cp}
                  onChange={(e) => setCp(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
                  placeholder={b1t('onb.zones.placeholder')}
                  style={{ marginTop: 12 }}
                />
                <button
                  className="b1-pill b1-pill--ghost b1-pill--fullwidth"
                  onClick={addCp}
                  disabled={cp.length !== 5}
                  data-testid="b1-reprise-add"
                  style={{ marginTop: 12 }}
                >
                  {b1t('onb.zones.ajouter')}
                </button>
              </>
            )}
          </div>

          {err && <p className="b1-small" style={{ color: 'var(--b1-danger)', marginTop: 12 }}>{err}</p>}

          <div style={{ flex: 1 }} />
          <button
            className="b1-pill b1-pill--primary b1-pill--fullwidth"
            data-testid="b1-reprise-valider"
            disabled={saving || cps.length === 0}
            onClick={valider}
          >
            <Check size={16} style={{ marginRight: 8 }} />
            {saving ? b1t('sys.un_instant') : b1t('reprise.cta')}
          </button>
        </div>
      </div>
    </div>
  );
}
