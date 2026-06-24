import React from 'react';

const PhoneFrame = ({ src, alt = 'KOLO app screenshot', testId = 'mkt-phone' }) => (
  <div className="mkt-phone" data-testid={testId}>
    <div className="mkt-phone-notch" />
    <div className="mkt-phone-screen">
      <img src={src} alt={alt} loading="lazy" />
    </div>
  </div>
);

export default PhoneFrame;
