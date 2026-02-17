import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      // Silent fail - just reset auth state
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = (userData) => {
    // Direct login with user data from API response
    setUser(userData);
    setIsAuthenticated(true);
    return userData;
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      // Silent fail
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const createAccountAfterPayment = async (paymentToken, email = null) => {
    const response = await fetch(`${API_URL}/api/auth/create-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ payment_token: paymentToken, email })
    });

    if (response.ok) {
      const userData = await response.json();
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
            navigate('/app', { replace: true });
          } else {
            navigate('/subscribe', { replace: true });
          }
        } catch (error) {
          console.error('Auth callback error:', error);
          navigate('/login', { replace: true });
        }
      } else {
        navigate('/login', { replace: true });
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
  const { user, loading, isAuthenticated, hasActiveSubscription } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        navigate('/login', { replace: true });
      } else if (!hasActiveSubscription) {
        navigate('/subscribe', { replace: true });
      }
    }
  }, [loading, isAuthenticated, hasActiveSubscription, navigate]);

  if (loading) {
    return (
      <div className="mobile-frame">
        <div className="page-container no-nav" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !hasActiveSubscription) {
    return null;
  }

  return children;
};

export default AuthContext;
