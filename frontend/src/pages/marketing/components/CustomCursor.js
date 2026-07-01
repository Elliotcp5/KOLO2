import React, { useEffect, useRef, useState } from 'react';

/**
 * Minimalist custom cursor (Linear/Rauno signature).
 *  - Small disc that follows the pointer smoothly
 *  - Grows and turns into a ring when hovering an interactive element
 *  - Hidden on touch devices
 */
const CustomCursor = () => {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [isPointer, setIsPointer] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Disable on coarse pointer devices (touch)
    const mq = window.matchMedia('(pointer: fine)');
    setEnabled(mq.matches);
    const onChange = (e) => setEnabled(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let mouseX = 0, mouseY = 0;
    let ringX = 0, ringY = 0;
    let raf;

    const handleMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
      }
      // Detect interactive elements
      const target = e.target;
      if (target && target.closest) {
        const interactive = target.closest(
          'a, button, [role="button"], .mkt-pillar, .mkt-res-card, .mkt-res-filter, .mkt-lang-item, .mkt-phone'
        );
        setIsPointer(!!interactive);
      }
    };
    const animate = () => {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ringX}px, ${ringY}px)`;
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    window.addEventListener('mousemove', handleMove);
    document.body.classList.add('mkt-custom-cursor-on');
    return () => {
      window.removeEventListener('mousemove', handleMove);
      document.body.classList.remove('mkt-custom-cursor-on');
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <>
      <div
        ref={ringRef}
        className={`mkt-cursor-ring ${isPointer ? 'is-pointer' : ''}`}
        aria-hidden
      />
      <div ref={dotRef} className="mkt-cursor-dot" aria-hidden />
    </>
  );
};

export default CustomCursor;
