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
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('kolo_token');
    if (!token) {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('kolo_token');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (e) {
      localStorage.removeItem('kolo_token');
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

  const logout = async () => {
    const token = localStorage.getItem('kolo_token');
    try {
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
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
    hasActiveSubscription: user?.subscription_status === 'active' || user?.subscription_status === 'trialing',
    login,
    logout,
    checkAuth,
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
  const { login } = useAuth();
  const navigate = useNavigate();
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
          const userData = await login(sessionId);
          
          // Check subscription status
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

export default AuthContext;
