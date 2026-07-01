import React, { useEffect, useRef, useState } from 'react';

/**
 * AnimatedCounter — smoothly counts from 0 to target when scrolled into view.
 * Supports formats like "30 sec", "0", "1 app", "24,90 €", etc.
 * Extracts the first number, animates it, then re-composes the label.
 */
const AnimatedCounter = ({ value, duration = 1400, testId }) => {
  const [display, setDisplay] = useState(value);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current || typeof window === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            started.current = true;
            animate();
          }
        });
      },
      { threshold: 0.4 }
    );

    // Parse value for a leading number (e.g. "30 sec" → 30, "24,90 €" → 24.90)
    const raw = String(value);
    const match = raw.match(/^(\d+(?:[.,]\d+)?)/);
    if (!match) return;
    const target = parseFloat(match[1].replace(',', '.'));
    const suffix = raw.slice(match[0].length);
    const decimals = (match[1].includes(',') || match[1].includes('.')) ? 2 : 0;

    const animate = () => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        // easeOutQuint
        const eased = 1 - Math.pow(1 - t, 5);
        const current = target * eased;
        const formatted = decimals === 0
          ? Math.round(current).toString()
          : current.toFixed(decimals).replace('.', ',');
        setDisplay(formatted + suffix);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration]);

  return <span ref={ref} data-testid={testId}>{display}</span>;
};

export default AnimatedCounter;
