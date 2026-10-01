// KOLO — Bloc 10 Étape 1 · Tutoriel en surimpression
// -----------------------------------------------------------------------------
// Remplace l'ancienne `GuidedTour` qui affichait juste une bulle en bas de
// l'écran, sans aucune indication visuelle sur l'onglet concerné — ce qui
// faisait que l'utilisateur ne « voyait pas » le tutoriel : il ne savait pas
// qu'il devait regarder la tab bar.
//
// Nouvelle version :
//   - overlay sombre (72 % noir) sur TOUT l'écran
//   - découpe (clip-path) autour de l'élément cible + halo rose pulsant
//   - flèche qui pointe l'élément depuis la bulle
//   - bulle positionnée au-dessus de la tab bar (toujours visible)
//   - 5 étapes maximum, une par onglet (Opportunités / Estimation / Rapport /
//     Assistant) + 1 pour l'icône profil (header).
//   - boutons « Passer » et « Suivant / Terminer »
//
// Cibles via `data-testid` : stables, déjà posés dans `B1Shell::BottomTabPill`
// et `ShellHeader`.
// -----------------------------------------------------------------------------
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import b1t from './b1i18n';
import { track, EVENTS } from './b3tracking';

// Détails des 5 étapes. L'ordre suit la logique de l'app.
const STEPS = [
  { key: 'opportunites', testid: 'b1-tab-opportunites', placement: 'top'    },
  { key: 'estimation',   testid: 'b1-tab-estimation',   placement: 'top'    },
  { key: 'rapport',      testid: 'b1-tab-rapport',      placement: 'top'    },
  { key: 'assistant',    testid: 'b1-tab-assistant',    placement: 'top'    },
  { key: 'profil',       testid: 'b1-header-profile',   placement: 'bottom' },
];

const HALO_PAD = 10;      // padding autour du rect (en px)
const BUBBLE_GAP = 16;    // espace entre halo et bulle

function findRect(testid) {
  try {
    const el = document.querySelector(`[data-testid="${testid}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  } catch { return null; }
}

export default function B1GuidedTour({ onDone }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [tick, setTick] = useState(0); // force re-measure on resize/scroll
  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Rafraîchit la mesure sur resize / orientation change / scroll.
  useEffect(() => {
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, []);

  // Recalcule le rect de la cible à chaque changement d'étape ou de tick.
  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const r = findRect(cur.testid);
      setRect(r);
    };
    // Laisse 50 ms pour que le DOM se stabilise (fin d'animation d'onglet).
    const t1 = setTimeout(measure, 50);
    const t2 = setTimeout(measure, 250);
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2); };
  }, [cur.testid, tick, step]);

  const done = useCallback((termine) => {
    try {
      track(
        termine ? EVENTS.TOUR_GUIDE_TERMINE : EVENTS.TOUR_GUIDE_PASSE,
        termine ? { bulles_vues: step + 1 } : { bulle_arret: step + 1 }
      );
    } catch { /* ignore tracking */ }
    onDone && onDone();
  }, [onDone, step]);

  const next = () => (isLast ? done(true) : setStep((s) => s + 1));

  // Spotlight = overlay sombre + rectangle découpé centré sur `rect`.
  // Implémenté avec 4 bandes (haut, gauche, droite, bas) : marche sur
  // tous les navigateurs iOS WebView, pas de clip-path capricieux.
  const halo = useMemo(() => {
    if (!rect) return null;
    const h = {
      top: Math.max(0, rect.top - HALO_PAD),
      left: Math.max(0, rect.left - HALO_PAD),
      width: rect.width + HALO_PAD * 2,
      height: rect.height + HALO_PAD * 2,
    };
    return h;
  }, [rect]);

  const bubblePos = useMemo(() => {
    if (!halo) return null;
    const vh = window.innerHeight || 844;
    const vw = window.innerWidth || 390;
    // Place au-dessus de la cible si placement=top (tab bar en bas), sinon
    // en dessous. On garantit toujours une marge basse pour ne pas sortir
    // de l'écran.
    const bubbleEstHeight = 180;
    let top;
    if (cur.placement === 'top') {
      top = halo.top - bubbleEstHeight - BUBBLE_GAP;
      if (top < 24) top = halo.top + halo.height + BUBBLE_GAP;
    } else {
      top = halo.top + halo.height + BUBBLE_GAP;
      if (top + bubbleEstHeight > vh - 24) {
        top = Math.max(24, halo.top - bubbleEstHeight - BUBBLE_GAP);
      }
    }
    // La bulle fait toute la largeur (moins 32 px de marge).
    const left = 16;
    const width = vw - 32;
    // Pointeur de flèche : horizontalement, centre du halo.
    const arrowLeft = Math.max(24, Math.min(vw - 48, halo.left + halo.width / 2 - 12));
    // Flèche vers le bas si la bulle est au-dessus, vers le haut sinon.
    const arrowDir = (top + bubbleEstHeight < halo.top) ? 'down' : 'up';
    return { top, left, width, arrowLeft, arrowDir };
  }, [halo, cur.placement]);

  // Si on n'a pas trouvé la cible, on affiche quand même la bulle (fallback).
  const nothingToSpot = !halo;

  return (
    <div className="b1-tour2" data-testid="b1-tour-overlay" role="dialog" aria-live="polite">
      {/* 4 bandes sombres autour du halo. Clic traversant pour l'élément cible. */}
      {halo && (
        <>
          <div className="b1-tour2-dim" style={{ top: 0, left: 0, right: 0, height: halo.top }} />
          <div className="b1-tour2-dim" style={{ top: halo.top, left: 0, width: halo.left, height: halo.height }} />
          <div className="b1-tour2-dim" style={{ top: halo.top, left: halo.left + halo.width, right: 0, height: halo.height }} />
          <div className="b1-tour2-dim" style={{ top: halo.top + halo.height, left: 0, right: 0, bottom: 0 }} />
          {/* Halo pulsant autour de la cible */}
          <div
            className="b1-tour2-halo"
            style={{ top: halo.top, left: halo.left, width: halo.width, height: halo.height }}
            data-testid="b1-tour-halo"
          />
        </>
      )}
      {/* Fallback : si cible introuvable, on noircit toute la vue */}
      {nothingToSpot && <div className="b1-tour2-dim" style={{ inset: 0 }} />}

      {/* Bulle d'explication */}
      <div
        className="b1-tour2-bubble"
        data-testid={`b1-tour-bubble-${step + 1}`}
        style={bubblePos ? { top: bubblePos.top, left: bubblePos.left, width: bubblePos.width } : { bottom: 120, left: 16, right: 16 }}
      >
        {bubblePos && (
          <span
            className={`b1-tour2-arrow b1-tour2-arrow--${bubblePos.arrowDir}`}
            style={{ left: bubblePos.arrowLeft }}
            aria-hidden="true"
          />
        )}
        <div className="b1-tour2-step">{b1t('tour.progress', { step: step + 1, total: STEPS.length })}</div>
        <h2 className="b1-tour2-title" data-testid={`b1-tour-title-${cur.key}`}>
          {b1t(`tour.${cur.key}.titre`)}
        </h2>
        <p className="b1-tour2-text" data-testid={`b1-tour-text-${cur.key}`}>
          {b1t(`tour.${cur.key}.texte`)}
        </p>
        <div className="b1-tour2-actions">
          <button
            type="button"
            className="b1-tour2-skip"
            data-testid="b1-tour-skip"
            onClick={() => done(false)}
          >
            {b1t('tour.passer')}
          </button>
          <button
            type="button"
            className="b1-pill b1-pill--primary"
            data-testid="b1-tour-next"
            onClick={next}
            style={{ minHeight: 44, padding: '10px 24px', fontSize: 15 }}
          >
            {isLast ? b1t('tour.terminer') : b1t('tour.suivant')}
          </button>
        </div>
      </div>
    </div>
  );
}
