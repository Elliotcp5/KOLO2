import React from 'react';

/**
 * PhoneFrame — displays the pre-rendered iPhone mockup PNG (with transparent bg).
 * The image is a full-quality photorealistic mockup provided by the brand,
 * so no CSS bezel is needed. Just render the image cleanly with a warm drop-shadow.
 */
const PhoneFrame = ({
  src = '/marketing/assets/mockup_hero.png',
  alt = 'KOLO app on iPhone',
  testId = 'mkt-phone',
  className = '',
}) => (
  <div className={`mkt-phone-wrap ${className}`} data-testid={testId}>
    <img src={src} alt={alt} loading="lazy" draggable="false" />
  </div>
);

export default PhoneFrame;
