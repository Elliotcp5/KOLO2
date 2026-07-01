import React from 'react';

/**
 * PhoneFrame — renders just the top half of an app screenshot in a rounded card.
 * No iPhone bezel, no Dynamic Island. Clean and modern.
 */
const PhoneFrame = ({
  src = '/marketing/assets/live_home_john.jpeg',
  alt = 'KOLO app screenshot',
  testId = 'mkt-phone',
  className = '',
}) => (
  <div className={`mkt-shot ${className}`} data-testid={testId}>
    <img src={src} alt={alt} loading="lazy" draggable="false" />
  </div>
);

export default PhoneFrame;
