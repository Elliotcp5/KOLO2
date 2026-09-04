// KOLO — Mes opportunités de mandats
//
// C'est la LISTE DE TRAVAIL RÉELLE : le swipe sélectionne les biens à
// démarcher, cette page permet de les traiter (contact, mandat, abandon).
//
// Cycle métier :
//   À démarcher → Démarché → Mandat signé (succès)
//                       ↓
//                    Abandon (double confirm)
//                       ↓
//                    Déjà en vente (1 tap, sans confirm)
//
// Un bouton PERMANENT au-dessus de la tab bar rend l'accès à cette page
// immédiat depuis la pile de swipe, même quand elle est vide.
//
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronDown, ChevronUp, MapPin, XCircle, Check, Award,
} from 'lucide-react';
import b1t from './b1i18n';
import b1api from './b1api';
import './b1.css';

// Ordre visuel du pipeline (colonnes) — chaque section est repliable.
const STATUTS_ORDRE = ['a_demarcher', 'demarche', 'mandat_signe',
                       'deja_en_vente', 'abandon'];

// ============================================================================
// Bouton permanent à insérer par le parent au-dessus de la tab bar.
// Isolé pour être réutilisable et ne pas dupliquer la logique de navigation.
// ============================================================================
export function MesMandatsButton({ onCount = null }) {
  const navigate = useNavigate();
  const [count, setCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await b1api.getMesMandats(500);
        if (cancelled) return;
        // On compte SEULEMENT les statuts actifs (pas abandon/déjà en vente)
        const c = (r?.counts || {});
        const active = (c.a_demarcher || 0) + (c.demarche || 0) + (c.mandat_signe || 0);
        setCount(active);
        onCount?.(active);
      } catch {
        setCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, [onCount]);

  return (
    <button
      className="b1-mes-mandats-btn"
      data-testid="b1-mes-mandats-btn"
      onClick={() => navigate('/app-b1/mes-mandats')}
      aria-label={b1t('opp.mes_mandats.bouton')}
    >
      <div className="b1-mes-mandats-btn-icon">
        <Award size={18} strokeWidth={2.2} />
      </div>
      <div className="b1-mes-mandats-btn-label">
        {b1t('opp.mes_mandats.bouton')}
      </div>
      {count != null && count > 0 && (
        <div className="b1-mes-mandats-btn-count"
             data-testid="b1-mes-mandats-btn-count">
          {count}
        </div>
      )}
    </button>
  );
}

// ============================================================================
// StatutPastille — chip pastille de statut
// ============================================================================
function StatutPastille({ statut }) {
  const label = b1t(`opp.statut.${statut}`);
  const cls = `b1-mm-pastille b1-mm-pastille--${statut.replace('_', '-')}`;
  return (
    <span className={cls} data-testid={`b1-mm-pastille-${statut}`}>{label}</span>
  );
}

// ============================================================================
// StatutToggle — 3 boutons segment pour changer rapidement de statut
//
// À démarcher → Démarché → Mandat signé.
// L'abandon a sa propre entrée avec double confirmation.
// ============================================================================
function StatutToggle({ current, onChange }) {
  const options = [
    { key: 'a_demarcher', color: '#EC8690' },
    { key: 'demarche',    color: '#F59E0B' },
    { key: 'mandat_signe', color: '#10B981' },
  ];
  return (
    <div className="b1-mm-toggle" data-testid="b1-mm-toggle">
      {options.map((o) => (
        <button
          key={o.key}
          className="b1-mm-toggle-btn"
          data-active={current === o.key}
          data-testid={`b1-mm-toggle-${o.key}`}
          onClick={() => onChange(o.key)}
          style={{
            '--b1-mm-toggle-color': o.color,
          }}
        >
          {b1t(`opp.statut.${o.key}`)}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// MandatCard — ligne dépliable
// ============================================================================
function MandatCard({ opp, onStatutChange, onAbandon, onDejaEnVente }) {
  const [open, setOpen] = useState(false);
  const caracs = opp.caracteristiques || {};
  return (
    <div className="b1-mm-card"
         data-testid={`b1-mm-card-${opp.id}`}
         data-statut={opp.statut}>
      <div className="b1-mm-card-header">
        <div className="b1-mm-card-header-main">
          <div className="b1-mm-card-address">
            <MapPin size={14} style={{ marginRight: 4 }} />
            {opp.adresse || '—'}
          </div>
          <div className="b1-mm-card-meta">
            {opp.type_bien || '—'}
            {opp.superficie ? ` · ${opp.superficie} m²` : ''}
            {opp.dpe && opp.dpe !== 'N/A' ? ` · DPE ${opp.dpe}` : ''}
          </div>
        </div>
        <StatutPastille statut={opp.statut} />
        <button
          className="b1-mm-card-toggle"
          data-testid={`b1-mm-card-toggle-${opp.id}`}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fermer' : 'Ouvrir'}
        >
          {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>
      {open && (
        <div className="b1-mm-card-body" data-testid={`b1-mm-card-body-${opp.id}`}>
          <div className="b1-mm-detail-grid">
            <div>
              <div className="b1-mm-detail-label">{b1t('opp.mes_mandats.detail.type')}</div>
              <div className="b1-mm-detail-value">{opp.type_bien || '—'}</div>
            </div>
            <div>
              <div className="b1-mm-detail-label">{b1t('opp.mes_mandats.detail.surface')}</div>
              <div className="b1-mm-detail-value">
                {opp.superficie ? `${opp.superficie} m²` : '—'}
              </div>
            </div>
            <div>
              <div className="b1-mm-detail-label">{b1t('opp.mes_mandats.detail.dpe')}</div>
              <div className="b1-mm-detail-value">{opp.dpe || '—'}</div>
            </div>
            <div>
              <div className="b1-mm-detail-label">{b1t('opp.mes_mandats.detail.annee')}</div>
              <div className="b1-mm-detail-value">{opp.annee_construction || '—'}</div>
            </div>
          </div>
          {opp.note && (
            <div className="b1-mm-note">{opp.note}</div>
          )}
          {/* Actions rapides : ne s'affichent QUE si la carte n'est pas déjà
              sortie du pipeline (abandon / déjà en vente). */}
          {(opp.statut === 'a_demarcher'
            || opp.statut === 'demarche'
            || opp.statut === 'mandat_signe') && (
            <>
              <StatutToggle
                current={opp.statut}
                onChange={(s) => onStatutChange(opp.id, s)}
              />
              <div className="b1-mm-card-actions">
                <button
                  className="b1-mm-quick-btn b1-mm-quick-btn--vente"
                  data-testid={`b1-mm-deja-en-vente-${opp.id}`}
                  onClick={() => onDejaEnVente(opp.id)}
                >
                  {b1t('opp.mes_mandats.deja_en_vente')}
                </button>
                <button
                  className="b1-mm-quick-btn b1-mm-quick-btn--abandon"
                  data-testid={`b1-mm-abandonner-${opp.id}`}
                  onClick={() => onAbandon(opp.id)}
                >
                  <XCircle size={16} style={{ marginRight: 4 }} />
                  {b1t('opp.statut.abandon')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Confirmation d'abandon (double tap)
// ============================================================================
function AbandonModal({ oppId, onConfirm, onCancel }) {
  return (
    <div className="b1-sheet-backdrop" data-testid="b1-mm-abandon-modal"
         onClick={onCancel}>
      <div className="b1-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="b1-sheet-handle" />
        <h2 className="b1-h2">{b1t('opp.mes_mandats.abandon_confirm.titre')}</h2>
        <p className="b1-lead" style={{ marginTop: 8 }}>
          {b1t('opp.mes_mandats.abandon_confirm.sous')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column',
                      gap: 10, marginTop: 20 }}>
          <button
            className="b1-pill b1-pill--danger b1-pill--fullwidth"
            data-testid="b1-mm-abandon-confirm"
            onClick={() => onConfirm(oppId)}
          >
            {b1t('opp.mes_mandats.abandon_confirm.oui')}
          </button>
          <button
            className="b1-pill b1-pill--ghost b1-pill--fullwidth"
            data-testid="b1-mm-abandon-cancel"
            onClick={onCancel}
          >
            {b1t('opp.mes_mandats.abandon_confirm.non')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Page principale
// ============================================================================
export function MesMandatsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [abandonId, setAbandonId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await b1api.getMesMandats(500);
      setItems(r?.items || []);
      setCounts(r?.counts || {});
    } catch (e) {
      setError(e?.data?.detail || e?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doPatch = async (oppId, statut) => {
    // Optimistic update — on remet la vraie donnée si le PATCH échoue.
    const previous = items;
    setItems((xs) => xs.map((x) => (x.id === oppId ? { ...x, statut } : x)));
    try {
      await b1api.patchStatutMandat(oppId, statut);
      // Reload pour refresh les compteurs et l'ordre
      load();
    } catch (e) {
      setItems(previous);
      setError(e?.data?.detail || e?.message || 'Échec');
    }
  };

  const groups = STATUTS_ORDRE.map((s) => ({
    key: s,
    label: b1t(`opp.statut.${s}`),
    items: items.filter((i) => i.statut === s),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="b1-root">
      <div className="b1-shell">
        <div className="b1-screen">
          <div className="b1-back-header" data-testid="b1-back-header">
            <button
              className="b1-back-btn"
              onClick={() => navigate(-1)}
              data-testid="b1-back-btn"
              aria-label={b1t('sys.retour')}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="b1-h2" style={{ fontSize: 17 }}>
              {b1t('opp.mes_mandats.titre')}
            </div>
            <div style={{ width: 40 }} />
          </div>
          {loading ? (
            <div className="b1-loading" data-testid="b1-mm-loading">
              {b1t('sys.un_instant')}
            </div>
          ) : error ? (
            <div className="b1-error" data-testid="b1-mm-error">{error}</div>
          ) : items.length === 0 ? (
            <div className="b1-empty" data-testid="b1-mm-empty">
              <h3 className="b1-h2">{b1t('opp.mes_mandats.vide.titre')}</h3>
              <p className="b1-lead" style={{ marginTop: 8 }}>
                {b1t('opp.mes_mandats.vide.sous')}
              </p>
            </div>
          ) : (
            <>
              <div className="b1-mm-summary" data-testid="b1-mm-summary">
                <div>
                  <div className="b1-mm-summary-n" data-testid="b1-mm-summary-total">
                    {items.length}
                  </div>
                  <div className="b1-mm-summary-label">
                    {b1t('opp.mes_mandats.compteur', { n: items.length })}
                  </div>
                </div>
                {counts.mandat_signe > 0 && (
                  <div className="b1-mm-summary-signed"
                       data-testid="b1-mm-summary-signed">
                    <Check size={18} />
                    {counts.mandat_signe} {b1t('opp.statut.mandat_signe')}
                  </div>
                )}
              </div>
              {groups.map((g) => (
                <div key={g.key} className="b1-mm-group"
                     data-testid={`b1-mm-group-${g.key}`}>
                  <div className="b1-mm-group-header">
                    <StatutPastille statut={g.key} />
                    <span className="b1-mm-group-count">
                      {g.items.length}
                    </span>
                  </div>
                  {g.items.map((opp) => (
                    <MandatCard
                      key={opp.id}
                      opp={opp}
                      onStatutChange={doPatch}
                      onAbandon={setAbandonId}
                      onDejaEnVente={(id) => doPatch(id, 'deja_en_vente')}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
          {abandonId && (
            <AbandonModal
              oppId={abandonId}
              onCancel={() => setAbandonId(null)}
              onConfirm={(id) => {
                doPatch(id, 'abandon');
                setAbandonId(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default MesMandatsPage;
