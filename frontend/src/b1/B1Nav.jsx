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
import React, { useCallback, useRef } from 'react';
import { ArrowLeft, X, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import b1t from './b1i18n';


// ============================================================
// SwipeCard — carte swipeable (pilotage DOM direct, aucun re-render pendant le drag)
//
// Le pilotage de la transformation CSS via `ref.current.style` évite un
// re-render React à chaque `pointermove` — c'était la cause du jank sur
// appareil réel signalée en TestFlight.
//
// props:
//   • children     — contenu de la carte
//   • onSwipeLeft  — callback rejet
//   • onSwipeRight — callback accept
//   • disabled     — désactive le geste (utile pendant l'attribution)
//   • testid       — data-testid racine
// ============================================================
export function SwipeCard({ children, onSwipeLeft, onSwipeRight, disabled = false, testid = 'b1-swipe-card' }) {
  const cardRef = useRef(null);
  const heartRef = useRef(null);
  const crossRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0, t: 0, active: false, decidedH: false });
  const rafRef = useRef(null);
  const pendingDeltaRef = useRef({ dx: 0, dy: 0 });

  // Seuil : 30% de la largeur d'écran (à minima 90 px pour être sûr sur small phones)
  const thresholdPx = () => {
    const w = (typeof window !== 'undefined' ? window.innerWidth : 390);
    return Math.max(90, Math.round(w * 0.30));
  };

  // Retour haptique (best-effort, iOS Capacitor)
  const hapticLight = () => {
    try {
      // Cap 5+ Haptics plugin (si chargé)
      if (window.Capacitor?.Plugins?.Haptics?.impact) {
        window.Capacitor.Plugins.Haptics.impact({ style: 'LIGHT' });
      } else if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch { /* silence */ }
  };

  // Applique une transformation directement sur le DOM (0 setState).
  const applyTransform = (dx, dy) => {
    const card = cardRef.current;
    if (!card) return;
    // rotation proportionnelle, clampée -18°..+18°
    const angle = Math.max(-18, Math.min(18, dx / 15));
    card.style.transform = `translate3d(${dx}px, ${dy * 0.15}px, 0) rotate(${angle}deg)`;
    card.style.transition = 'none';

    // Indicateurs — opacité proportionnelle à la distance (0 à 1 sur 30% width)
    const thr = thresholdPx();
    const opacity = Math.min(1, Math.abs(dx) / thr);
    if (heartRef.current) heartRef.current.style.opacity = dx > 20 ? String(opacity) : '0';
    if (crossRef.current) crossRef.current.style.opacity = dx < -20 ? String(opacity) : '0';
  };

  const scheduleFrame = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const { dx, dy } = pendingDeltaRef.current;
      applyTransform(dx, dy);
    });
  };

  const resetVisuals = (animated = true) => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = animated
      ? 'transform 220ms cubic-bezier(.22,.9,.3,1)'
      : 'none';
    card.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
    if (heartRef.current) heartRef.current.style.opacity = '0';
    if (crossRef.current) crossRef.current.style.opacity = '0';
  };

  const finish = useCallback((direction) => {
    const card = cardRef.current;
    if (card) {
      card.style.transition = 'transform 260ms cubic-bezier(.22,.9,.3,1)';
      const off = direction === 'right' ? 600 : -600;
      const angle = direction === 'right' ? 22 : -22;
      card.style.transform = `translate3d(${off}px, 0, 0) rotate(${angle}deg)`;
    }
    hapticLight();
    setTimeout(() => {
      // reset immédiat sans animation (la prochaine carte est déjà rendue en dessous)
      resetVisuals(false);
      if (direction === 'right') onSwipeRight?.();
      else onSwipeLeft?.();
    }, 240);
  }, [onSwipeLeft, onSwipeRight]);

  const onPointerDown = (e) => {
    if (disabled) return;
    startRef.current = {
      x: e.clientX, y: e.clientY, t: Date.now(),
      active: true, decidedH: false,
    };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
  };

  const onPointerMove = (e) => {
    if (!startRef.current.active) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    const H_LOCK_PX = 12;
    if (!startRef.current.decidedH) {
      if (Math.abs(dx) < H_LOCK_PX && Math.abs(dy) < H_LOCK_PX) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        // Scroll vertical : on abandonne le swipe
        startRef.current.active = false;
        return;
      }
      startRef.current.decidedH = true;
    }
    pendingDeltaRef.current = { dx, dy };
    scheduleFrame();
  };

  const onPointerUp = (e) => {
    if (!startRef.current.active) {
      resetVisuals(false);
      return;
    }
    const dx = e.clientX - startRef.current.x;
    const elapsed = Date.now() - startRef.current.t || 1;
    const vel = Math.abs(dx) / elapsed;
    startRef.current.active = false;

    const thr = thresholdPx();
    // Validation : ≥30% width OU vélocité rapide (>0.4 px/ms) sur >20px
    if (dx > thr || (dx > 20 && vel > 0.4)) {
      finish('right');
    } else if (dx < -thr || (dx < -20 && vel > 0.4)) {
      finish('left');
    } else {
      // Retour élastique
      resetVisuals(true);
    }
  };

  return (
    <div className="b1-swipe-wrap" data-testid={testid}>
      <div
        ref={cardRef}
        className="b1-opp-card b1-swipe-card"
        style={{
          transform: 'translate3d(0, 0, 0) rotate(0deg)',
          transition: 'none',
          touchAction: 'pan-y',
          cursor: disabled ? 'default' : 'grab',
          userSelect: 'none',
          willChange: 'transform',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
        {/* Indicateurs visuels du geste — opacité pilotée en direct */}
        <div
          ref={heartRef}
          className="b1-swipe-hint b1-swipe-hint--accept"
          data-testid="b1-swipe-hint-right"
          style={{ opacity: 0, transition: 'opacity 60ms linear' }}
        >
          <Heart size={44} fill="currentColor" />
        </div>
        <div
          ref={crossRef}
          className="b1-swipe-hint b1-swipe-hint--reject"
          data-testid="b1-swipe-hint-left"
          style={{ opacity: 0, transition: 'opacity 60ms linear' }}
        >
          <X size={44} strokeWidth={3} />
        </div>
        {/* Boutons fallback DANS la carte (accessibilité clavier + confort) */}
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
