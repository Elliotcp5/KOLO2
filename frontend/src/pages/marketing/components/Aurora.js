import React, { useEffect, useRef } from 'react';

/**
 * Aurora — animated dynamic background with 3 large blurred blobs.
 * Blobs slowly drift + subtly track cursor position for a "living" feel.
 * Fully behind content, non-interactive, GPU-cheap.
 */
const Aurora = () => {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const el = rootRef.current;
    let raf;
    let targetX = 0.5, targetY = 0.35;
    let curX = 0.5, curY = 0.35;

    const onMove = (e) => {
      targetX = e.clientX / window.innerWidth;
      targetY = e.clientY / window.innerHeight;
    };
    const tick = () => {
      curX += (targetX - curX) * 0.06;
      curY += (targetY - curY) * 0.06;
      el.style.setProperty('--aurora-x', `${curX * 100}%`);
      el.style.setProperty('--aurora-y', `${curY * 100}%`);
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    tick();
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={rootRef} className="mkt-aurora" aria-hidden />;
};

export default Aurora;
