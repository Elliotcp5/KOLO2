// KOLO — Encart « Passez à Pro » réutilisable
// -----------------------------------------------------------------------------
// Point d'entrée vers /app-b1/paywall à poser sur chaque écran où un gratuit
// se heurte à une limite (fin de pile, veille, estimation, dossier PDF,
// assistant). Rappelle CE QUE L'UTILISATEUR RATE avec un chiffre réel de sa
// zone, puis propose un CTA plein.
//
// Conforme Apple : aucun prix affiché, la navigation mène au paywall qui
// déclenche l'IAP natif.
// -----------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Sparkles } from 'lucide-react';
import b1t from './b1i18n';
import b1api from './b1api';

// Cache local (mémoire) — évite d'appeler /pool sur chaque écran.
let _poolCache = null;
let _poolCacheAt = 0;
const POOL_TTL_MS = 90_000;

async function _getPoolOnce() {
  const now = Date.now();
  if (_poolCache && now - _poolCacheAt < POOL_TTL_MS) return _poolCache;
  try {
    _poolCache = await b1api.getPoolZones();
    _poolCacheAt = now;
  } catch {
    _poolCache = { zones: [], total: 0, top_zone: null };
    _poolCacheAt = now;
  }
  return _poolCache;
}

/**
 * @param {object} props
 * @param {'fin_pile'|'dossier_pdf'|'veille'|'assistant'|'estimation'} props.context
 * @param {boolean} [props.compact] — variante fine (une ligne + CTA)
 * @param {string} [props.testid]
 */
export function B1ProCta({ context, compact = false, testid = 'b1-pro-cta' }) {
  const navigate = useNavigate();
  const [pool, setPool] = useState(null);
  useEffect(() => { _getPoolOnce().then(setPool); }, []);

  const top = pool?.top_zone;
  const total = pool?.total || 0;

  // Hero contextuel — chiffre RÉEL de la zone de l'user
  let headline;
  if (top && top.count > 0) {
    if (context === 'fin_pile') {
      headline = b1t('procta.fin_pile.hero', { n: top.count, cp: top.code_postal })
        || `Vous en avez traité 3 aujourd'hui. ${top.count} autres opportunités vous attendent en ${top.code_postal} — accessibles en Pro.`;
    } else if (context === 'veille') {
      headline = b1t('procta.veille.hero', { n: top.count, cp: top.code_postal })
        || `${top.count} biens déjà en vente à surveiller en ${top.code_postal} — accessible en Pro.`;
    } else if (context === 'dossier_pdf') {
      headline = b1t('procta.dossier.hero', { n: total })
        || `Après votre premier dossier gratuit, la génération PDF illimitée est réservée aux Pro.`;
    } else if (context === 'estimation') {
      headline = b1t('procta.estimation.hero')
        || `Vous disposez d'une estimation offerte. Passez Pro pour estimer sans limite.`;
    } else if (context === 'assistant') {
      headline = b1t('procta.assistant.hero')
        || `L'assistant KOLO répond à vos questions terrain — réservé aux Pro.`;
    }
  } else {
    // Fallback sans zone chargée
    headline = b1t('procta.generic.hero')
      || 'Passez Pro pour débloquer toutes les opportunités, l\'estimation illimitée et la veille.';
  }

  const benefit = b1t('procta.benefit')
    || 'Toutes vos opportunités quotidiennes, estimations et dossiers PDF illimités, veille concurrentielle.';

  if (compact) {
    return (
      <div className="b1-procta b1-procta--compact" data-testid={testid} onClick={() => navigate('/app-b1/paywall')}>
        <Sparkles size={18} className="b1-procta-icon" />
        <div className="b1-procta-text">{headline}</div>
        <button
          type="button"
          className="b1-pill b1-pill--primary"
          data-testid={`${testid}-btn`}
          onClick={(e) => { e.stopPropagation(); navigate('/app-b1/paywall'); }}
        >
          {b1t('profil.plan.passer_pro') || 'Passer Pro'}
        </button>
      </div>
    );
  }

  return (
    <div className="b1-procta" data-testid={testid}>
      <div className="b1-procta-crown"><Crown size={22} /></div>
      <div className="b1-procta-headline" data-testid={`${testid}-headline`}>{headline}</div>
      <div className="b1-procta-benefit">{benefit}</div>
      <button
        type="button"
        className="b1-pill b1-pill--primary b1-pill--fullwidth b1-procta-btn"
        data-testid={`${testid}-btn`}
        onClick={() => navigate('/app-b1/paywall')}
      >
        {b1t('profil.plan.passer_pro') || 'Passer Pro'}
      </button>
    </div>
  );
}

export default B1ProCta;
