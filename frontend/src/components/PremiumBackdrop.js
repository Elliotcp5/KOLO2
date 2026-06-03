import React, { useEffect, useRef } from 'react';

/**
 * PremiumBackdrop — fond animé "startup premium" pour la Landing KOLO.
 *
 * Inspiration : Linear, Vercel, Stripe, Arc Browser.
 * - Mesh gradient lent dérive 28s (déjà sur .landing-page::before)
 * - 4 orbs blur en mouvement organique (lentes, opacité faible)
 * - Grille subtile de points (CSS)
 * - Spotlight qui suit la souris (CSS variable updated via JS)
 *
 * Coût : ~3 ko + animations GPU-only (transform, opacity). Respect prefers-reduced-motion.
 */
const PremiumBackdrop = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(max-width: 768px)').matches) return; // skip on mobile pour perf

    const el = containerRef.current;
    if (!el) return;

    let rafId = null;
    let targetX = 50, targetY = 30;
    let currentX = 50, currentY = 30;

    const onMove = (e) => {
      targetX = (e.clientX / window.innerWidth) * 100;
      targetY = (e.clientY / window.innerHeight) * 100;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;
      el.style.setProperty('--spot-x', `${currentX}%`);
      el.style.setProperty('--spot-y', `${currentY}%`);
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="kolo-premium-bg" ref={containerRef} aria-hidden="true">
      {/* Subtle dot grid */}
      <div className="kolo-bg-grid" />
      {/* Floating orbs */}
      <div className="kolo-orb kolo-orb-1" />
      <div className="kolo-orb kolo-orb-2" />
      <div className="kolo-orb kolo-orb-3" />
      <div className="kolo-orb kolo-orb-4" />
      {/* Cursor spotlight */}
      <div className="kolo-spotlight" />
    </div>
  );
};

export default PremiumBackdrop;
