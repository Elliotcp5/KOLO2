// Legacy subscribe page — kept as a permanent redirect to the new /pricing
// page, which is the unified subscription experience for both web (Stripe)
// and iOS native (StoreKit). The old page only showed PRO monthly with a
// broken legacy /api/payments/checkout-redirect endpoint.
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const SubscribePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Preserve any error / source query params so the new page can react to them.
    const qs = searchParams.toString();
    const target = qs ? `/pricing?${qs}` : '/pricing';
    navigate(target, { replace: true });
  }, [navigate, searchParams]);

  return null;
};

export default SubscribePage;
