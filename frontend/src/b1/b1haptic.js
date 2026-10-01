// KOLO — Bloc 11 : haptics + animations global helpers
// -----------------------------------------------------------------------------
// `b1Haptic` : retour tactile unique, compatible Capacitor Haptics + fallback web.
// `useCountUp(target, duration)` : hook qui anime un nombre de 0 jusqu'à target.
// `useScrollReveal()` : marque un conteneur comme "stagger" dès qu'il entre
//                      dans le viewport (ajoute `.b1-stagger-active`).
// -----------------------------------------------------------------------------
import { useEffect, useRef, useState } from 'react';

/**
 * Déclenche un retour haptique léger. À appeler sur :
 *   - tap sur un bouton
 *   - swipe validé
 *   - changement d'onglet
 *   - basculement de statut
 *
 * @param {'light'|'medium'|'heavy'} [style='light']
 */
export function b1Haptic(style = 'light') {
  try {
    const Haptics = window?.Capacitor?.Plugins?.Haptics;
    if (Haptics?.impact) {
      Haptics.impact({ style: style.toUpperCase() });
      return;
    }
  } catch { /* fallback below */ }
  try {
    if (navigator?.vibrate) navigator.vibrate(style === 'heavy' ? 20 : style === 'medium' ? 12 : 8);
  } catch { /* no haptic available, silent */ }
}

/**
 * Hook : anime un nombre de 0 vers `target` sur `duration` ms.
 * Retourne la valeur courante (int).
 */
export function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0);
  const rafRef = useRef();
  const startRef = useRef();

  useEffect(() => {
    const to = Number(target) || 0;
    if (to === 0) { setVal(0); return undefined; }
    startRef.current = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(eased * to));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return val;
}

/**
 * Hook : attache une ref à un conteneur. Dès que le conteneur entre dans le
 * viewport, lui ajoute la classe `.b1-stagger` pour déclencher les
 * animations de cascade définies dans b1.css.
 */
export function useScrollReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) {
      if (el) el.classList.add('b1-stagger');
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('b1-stagger');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

export default { b1Haptic, useCountUp, useScrollReveal };
