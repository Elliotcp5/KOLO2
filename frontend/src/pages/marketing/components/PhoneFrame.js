import React from 'react';

/**
 * Photorealistic iPhone 15 Pro-style frame:
 *  - Titanium bezel with subtle gradient + rim highlight
 *  - Real Dynamic Island (not a fake notch bar)
 *  - Side buttons (volume up/down + action + power)
 *  - Inner screen with soft reflection overlay
 *  - `fit` prop: 'cover' (default, full-bleed screenshot) | 'contain' (letterboxed)
 *  - `scale` prop: zoom in/out the screenshot within the screen (default 1.0)
 */
const PhoneFrame = ({ src, alt = 'KOLO app screenshot', testId = 'mkt-phone', fit = 'contain', scale = 1 }) => (
  <div className="mkt-phone" data-testid={testId}>
    {/* Titanium side buttons */}
    <span className="mkt-phone-btn mkt-phone-btn-mute" aria-hidden />
    <span className="mkt-phone-btn mkt-phone-btn-volup" aria-hidden />
    <span className="mkt-phone-btn mkt-phone-btn-voldown" aria-hidden />
    <span className="mkt-phone-btn mkt-phone-btn-power" aria-hidden />

    <div className="mkt-phone-screen">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{ objectFit: fit, transform: `scale(${scale})`, transformOrigin: 'center top' }}
      />
      {/* Screen reflection — very subtle, top-left glare */}
      <span className="mkt-phone-glare" aria-hidden />
    </div>

    {/* iPhone 15+ Dynamic Island (real pill shape, not a rectangular notch) */}
    <div className="mkt-phone-island" aria-hidden>
      <span className="mkt-phone-island-camera" />
    </div>
  </div>
);

export default PhoneFrame;
