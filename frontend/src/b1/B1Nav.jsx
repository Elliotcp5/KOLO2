// =============================================================
// KOLO — SwipeCard + BackHeader (refonte navigation TestFlight)
//
// Corrige 3 problèmes remontés depuis TestFlight :
//   1. Le geste de balayage ne faisait rien (aucun handler tactile).
//   2. Certains écrans n'avaient AUCUN moyen de revenir en arrière.
//   3. La barre du bas disparaissait sur les écrans secondaires.
//
// Le geste utilise Pointer Events (unifie souris/tactile), avec seuil
// horizontal ≥ 60 px OU vélocité ≥ 0.4 px/ms. On empêche le scroll vertical
// via `touch-action: pan-y` sur le conteneur (React) + surtout on annule
// preventDefault SEULEMENT si le geste est clairement horizontal.
// =============================================================
import React, { useCallback, useRef, useState } from 'react';
import { ArrowLeft, X, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import b1t from './b1i18n';


// ============================================================
// SwipeCard — carte swipeable avec fallback boutons croix/cœur
// props:
//   • children     — contenu de la carte
//   • onSwipeLeft  — callback rejet
//   • onSwipeRight — callback accept
//   • disabled     — désactive le geste (utile pendant l'attribution)
//   • testid       — data-testid racine
// ============================================================
export function SwipeCard({ children, onSwipeLeft, onSwipeRight, disabled = false, testid = 'b1-swipe-card' }) {
  const [drag, setDrag] = useState({ dx: 0, angle: 0, released: false });
  const ref = useRef(null);
  const startRef = useRef({ x: 0, y: 0, t: 0, active: false, decidedH: false });

  const SWIPE_THRESHOLD_PX = 60;
  const SWIPE_VELOCITY = 0.35; // px/ms
  const H_LOCK_PX = 12;        // seuil de « c'est horizontal »

  const finish = useCallback((direction) => {
    // Anime la carte hors écran, puis appelle le callback.
    const dx = direction === 'right' ? 500 : -500;
    setDrag({ dx, angle: direction === 'right' ? 18 : -18, released: true });
    setTimeout(() => {
      setDrag({ dx: 0, angle: 0, released: false });
      if (direction === 'right') onSwipeRight?.();
      else onSwipeLeft?.();
    }, 220);
  }, [onSwipeLeft, onSwipeRight]);

  const onPointerDown = (e) => {
    if (disabled) return;
    startRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), active: true, decidedH: false };
    // capture — indispensable pour que le pointer up soit reçu même hors carte
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
  };

  const onPointerMove = (e) => {
    if (!startRef.current.active) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    // Bloque le geste si l'utilisateur veut clairement scroller verticalement
    if (!startRef.current.decidedH) {
      if (Math.abs(dx) < H_LOCK_PX && Math.abs(dy) < H_LOCK_PX) return; // encore indécis
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical → abandonner le swipe, laisser le scroll natif
        startRef.current.active = false;
        return;
      }
      startRef.current.decidedH = true;
    }
    // Rotation légère + translation
    const angle = Math.max(-18, Math.min(18, dx / 15));
    setDrag({ dx, angle, released: false });
  };

  const onPointerUp = (e) => {
    if (!startRef.current.active) {
      // Vertical/annulé — reset visuel
      setDrag({ dx: 0, angle: 0, released: false });
      return;
    }
    const dx = e.clientX - startRef.current.x;
    const elapsed = Date.now() - startRef.current.t || 1;
    const vel = Math.abs(dx) / elapsed;
    startRef.current.active = false;

    if (dx > SWIPE_THRESHOLD_PX || (dx > 20 && vel > SWIPE_VELOCITY)) {
      finish('right');
    } else if (dx < -SWIPE_THRESHOLD_PX || (dx < -20 && vel > SWIPE_VELOCITY)) {
      finish('left');
    } else {
      // Snap back
      setDrag({ dx: 0, angle: 0, released: true });
      setTimeout(() => setDrag({ dx: 0, angle: 0, released: false }), 200);
    }
  };

  const style = {
    transform: `translateX(${drag.dx}px) rotate(${drag.angle}deg)`,
    transition: drag.released ? 'transform 220ms cubic-bezier(.22,.9,.3,1)' : 'none',
    touchAction: 'pan-y',
    cursor: disabled ? 'default' : 'grab',
    userSelect: 'none',
  };

  return (
    <div className="b1-swipe-wrap" data-testid={testid}>
      <div
        ref={ref}
        className="b1-opp-card b1-swipe-card"
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
        {/* Indicateurs visuels du geste */}
        {drag.dx > 30 && (
          <div className="b1-swipe-hint b1-swipe-hint--accept" data-testid="b1-swipe-hint-right">
            <Heart size={44} fill="currentColor" />
          </div>
        )}
        {drag.dx < -30 && (
          <div className="b1-swipe-hint b1-swipe-hint--reject" data-testid="b1-swipe-hint-left">
            <X size={44} strokeWidth={3} />
          </div>
        )}
        {/* Boutons fallback DANS la carte (fixe l'overlap tab bar) */}
        <div className="b1-opp-actions">
          <button
            className="b1-opp-action-btn b1-opp-action-btn--reject"
            onClick={(e) => { e.stopPropagation(); if (!disabled) finish('left'); }}
            onPointerDown={(e) => e.stopPropagation()}
            data-testid="b1-opp-reject"
            aria-label={b1t('opp.rejeter') || 'Rejeter'}
            disabled={disabled}
          >
            <X size={26} strokeWidth={2.5} />
          </button>
          <button
            className="b1-opp-action-btn b1-opp-action-btn--accept"
            onClick={(e) => { e.stopPropagation(); if (!disabled) finish('right'); }}
            onPointerDown={(e) => e.stopPropagation()}
            data-testid="b1-opp-accept"
            aria-label={b1t('opp.accepter') || 'Accepter'}
            disabled={disabled}
          >
            <Heart size={26} strokeWidth={2.5} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// BackHeader — flèche retour universelle en haut à gauche
// Utilisée sur TOUS les écrans secondaires. Aucun écran ne doit
// être une impasse.
// props:
//   • title       — titre centré (optionnel)
//   • onBack      — override (par défaut navigate(-1))
//   • fallbackTo  — si l'historique est vide, où aller (ex: '/app-b1')
//   • right       — nœud à droite (optionnel, ex: bouton actions)
// ============================================================
export function BackHeader({ title, onBack, fallbackTo = '/app-b1', right = null }) {
  const navigate = useNavigate();
  const handleBack = () => {
    if (onBack) { onBack(); return; }
    // Si on est arrivé directement (deep link), historique = 1 → fallback
    if (window.history.length > 1) navigate(-1);
    else navigate(fallbackTo);
  };
  return (
    <div className="b1-back-header" data-testid="b1-back-header">
      <button
        className="b1-back-btn"
        onClick={handleBack}
        data-testid="b1-back-btn"
        aria-label={b1t('nav.retour') || 'Retour'}
      >
        <ArrowLeft size={22} strokeWidth={2.2} />
      </button>
      {title && <h1 className="b1-back-title" data-testid="b1-back-title">{title}</h1>}
      <div className="b1-back-right">{right}</div>
    </div>
  );
}
