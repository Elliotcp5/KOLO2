import React, { useRef } from 'react';

/**
 * KOLO — Real iPhone 15 Pro frame (dark titanium bezel).
 * Designed to blend seamlessly with the dark marketing theme.
 *  - Titanium gradient bezel with rim highlight
 *  - Real Dynamic Island (iOS 17+ pill)
 *  - Side buttons (mute, volume up/down, power)
 *  - Screen with subtle glass glare
 *  - Magnetic pointer-following 3D tilt on desktop
 */
const PhoneFrame = ({
  src,
  alt = 'KOLO app screenshot',
  testId = 'mkt-phone',
  className = '',
}) => {
  const ref = useRef(null);

  const handleMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width - 0.5;
    const cy = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1500px) rotateY(${-8 + cx * 6}deg) rotateX(${4 + cy * -4}deg)`;
  };
  const handleMouseLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = '';
  };

  return (
    <div
      ref={ref}
      className={`mkt-phone ${className}`}
      data-testid={testId}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Titanium side buttons */}
      <span className="mkt-phone-btn mkt-phone-btn-mute" aria-hidden />
      <span className="mkt-phone-btn mkt-phone-btn-volup" aria-hidden />
      <span className="mkt-phone-btn mkt-phone-btn-voldown" aria-hidden />
      <span className="mkt-phone-btn mkt-phone-btn-power" aria-hidden />

      <div className="mkt-phone-screen">
        <img src={src} alt={alt} loading="lazy" draggable="false" />
        <span className="mkt-phone-glare" aria-hidden />
      </div>

      {/* Dynamic Island */}
      <div className="mkt-phone-island" aria-hidden>
        <span className="mkt-phone-island-camera" />
      </div>
    </div>
  );
};

export default PhoneFrame;
