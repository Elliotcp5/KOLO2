import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_URL } from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('kolo_token');
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  };

  // Check auth on mount
  useEffect(() => {
    // CRITICAL: If returning from OAuth callback (#session_id=...), skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (typeof window !== 'undefined' && window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('kolo_token');
    // If we have a Bearer token, skip cookie credentials to avoid CORS issues
    // with allow_origins=* (the browser rejects credentials with wildcard).
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        credentials: token ? 'omit' : 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        if (token) localStorage.removeItem('kolo_token');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (e) {
      if (token) localStorage.removeItem('kolo_token');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = (userData) => {
    // Store token in localStorage if provided
    if (userData.token) {
      localStorage.setItem('kolo_token', userData.token);
    }
    // Direct login with user data from API response
    setUser(userData);
    setIsAuthenticated(true);
    return userData;
  };

  // Exchange an Emergent OAuth session_id for a server session + user data.
  // Called from <AuthCallback /> after Google redirects to `/#session_id=...`.
  const processOAuthSession = async (sessionId) => {
    const response = await fetch(`${API_URL}/api/auth/session`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId })
    });
    if (!response.ok) {
      throw new Error('OAuth session exchange failed');
    }
    const userData = await response.json();
    setUser(userData);
    setIsAuthenticated(true);
    // Immediately fetch the full /auth/me payload so we have plan/super admin info
    try {
      const meResp = await fetch(`${API_URL}/api/auth/me`, { credentials: 'include' });
      if (meResp.ok) {
        const fullUser = await meResp.json();
        setUser(fullUser);
      }
    } catch (_) {}
    return userData;
  };

  const logout = async () => {
    const token = localStorage.getItem('kolo_token');
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
    } catch (e) {
      // Silent fail
    } finally {
      localStorage.removeItem('kolo_token');
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const createAccountAfterPayment = async (paymentToken, email = null) => {
    const response = await fetch(`${API_URL}/api/auth/create-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_token: paymentToken, email })
    });

    if (response.ok) {
      const userData = await response.json();
      if (userData.token) {
        localStorage.setItem('kolo_token', userData.token);
      }
      setUser(userData);
      setIsAuthenticated(true);
      return userData;
    } else {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Account creation failed');
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    isSuperAdmin: user?.is_super_admin === true,
    hasActiveSubscription: user?.subscription_status === 'active' || user?.subscription_status === 'trialing',
    login,
    logout,
    checkAuth,
    processOAuthSession,
    createAccountAfterPayment,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Auth Callback Component - handles OAuth redirect
export const AuthCallback = () => {
  const { processOAuthSession } = useAuth();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      const hash = location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (sessionIdMatch) {
        const sessionId = sessionIdMatch[1];
        
        try {
          const userData = await processOAuthSession(sessionId);
          
          // Super admin → go straight to admin dashboard
          if (userData.is_super_admin) {
            window.location.href = '/kolo-admin';
            return;
          }

          // Otherwise check subscription status
          if (userData.subscription_status === 'active' || userData.subscription_status === 'trialing') {
            window.location.href = '/app';
          } else {
            window.location.href = '/subscribe';
          }
        } catch (e) {
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    };

    processSession();
  }, []);

  return (
    <div className="mobile-frame">
      <div className="page-container no-nav" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
      </div>
    </div>
  );
};

// Protected Route wrapper
export const ProtectedRoute = ({ children }) => {
  const { user, loading, isAuthenticated, hasActiveSubscription, checkAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [syncing, setSyncing] = useState(false);
  const [syncTried, setSyncTried] = useState(false);
  const [recoveredFromStripe, setRecoveredFromStripe] = useState(false);

  // Detect Stripe success redirect — give the webhook a few seconds to
  // propagate before considering the user as "free".
  const isPostPaymentRedirect = (() => {
    try {
      const params = new URLSearchParams(location.search);
      return (
        params.get('upgrade') === 'success' ||
        params.get('trial_started') === 'true'
      );
    } catch (_) {
      return false;
    }
  })();

  // Defensive sync against Stripe BEFORE redirecting to /subscribe. This is
  // the last line of defense for users whose local subscription status is
  // stale (webhook missed, page reloaded too quickly, etc.).
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (hasActiveSubscription) return; // all good
    if (isPostPaymentRedirect) return; // grace window

    // No active subscription locally → try recovering from Stripe ONCE.
    if (syncTried) {
      // Already tried, not recovered → safe to redirect now
      navigate('/subscribe', { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        const token = localStorage.getItem('kolo_token');
        if (token) {
          const res = await fetch(
            (process.env.REACT_APP_BACKEND_URL || '') + '/api/plans/sync',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          if (res.ok) {
            const data = await res.json();
            if (
              data?.subscription_status === 'active' ||
              data?.subscription_status === 'trialing' ||
              (data?.synced && data?.plan && data.plan !== 'free')
            ) {
              if (!cancelled) {
                // Refresh the auth context so hasActiveSubscription becomes true
                try { await checkAuth(); } catch (_) {}
                setRecoveredFromStripe(true);
              }
            }
          }
        }
      } catch (_) {}
      if (!cancelled) {
        setSyncing(false);
        setSyncTried(true);
      }
    })();
    return () => { cancelled = true; };
  }, [
    loading,
    isAuthenticated,
    hasActiveSubscription,
    isPostPaymentRedirect,
    syncTried,
    navigate,
    checkAuth,
  ]);

  if (loading || syncing) {
    return (
      <div className="mobile-frame">
        <div className="page-container no-nav" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (!hasActiveSubscription && !isPostPaymentRedirect && !recoveredFromStripe) {
    return null;
  }

  return children;
};

// Super Admin Route wrapper — only KOLO super admins can access /kolo-admin.
// Falls back to a server check via /api/admin/check to avoid leaking the
// frontend allowlist.
export const SuperAdminRoute = ({ children }) => {
  const navigate = useNavigate();
  const { loading, isAuthenticated, user } = useAuth();
  const [verifying, setVerifying] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    // Quick local check first (avoids a roundtrip when /auth/me already told us)
    if (user?.is_super_admin === true) {
      setAllowed(true);
      setVerifying(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('kolo_token');
        const resp = await fetch(`${API_URL}/api/admin/check`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (resp.ok) {
          const data = await resp.json();
          if (!cancelled) {
            if (data.is_super_admin) {
              setAllowed(true);
            } else {
              navigate('/app', { replace: true });
            }
          }
        } else if (!cancelled) {
          navigate('/login', { replace: true });
        }
      } catch (_) {
        if (!cancelled) navigate('/login', { replace: true });
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, isAuthenticated, user, navigate]);

  if (loading || verifying) {
    return (
      <div className="mobile-frame">
        <div className="page-container no-nav" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }
  if (!allowed) return null;
  return children;
};

export default AuthContext;
