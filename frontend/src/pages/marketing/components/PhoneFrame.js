import React, { useRef } from 'react';

/**
 * Abstract Frame — replaces the literal iPhone bezel with a sleek premium
 * container (Linear/Framer/Vercel style):
 *  - rounded 42px, 1px inner ring
 *  - light soft shadow with a very faint purple/blue rim glow
 *  - 3D tilt on desktop hover (already handled by CSS transform)
 *  - image uses `object-fit: cover` starting at top — no white letterboxing,
 *    no visible seams. The image simply fills the frame beautifully.
 */
const PhoneFrame = ({
  src,
  alt = 'KOLO app screenshot',
  testId = 'mkt-phone',
  className = '',
}) => {
  const ref = useRef(null);

  // Optional magnetic hover — smooth pointer-based tilt refinement
  const handleMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 6;   // -3..3 deg
    const y = ((e.clientY - rect.top)  / rect.height - 0.5) * -4; // -2..2 deg
    el.style.transform = `perspective(1400px) rotateY(${x}deg) rotateX(${y}deg)`;
  };
  const handleMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = '';
  };

  return (
    <div
      ref={ref}
      className={`mkt-abstract-phone ${className}`}
      data-testid={testId}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <img src={src} alt={alt} loading="lazy" draggable="false" />
    </div>
  );
};

export default PhoneFrame;
