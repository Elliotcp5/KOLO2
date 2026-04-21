import React, { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { LocaleProvider } from "./context/LocaleContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AuthProvider, AuthCallback, ProtectedRoute } from "./context/AuthContext";
import { PlanProvider } from "./context/PlanContext";
import { trackPageView } from "./utils/analytics";
import { useCapacitorDeepLinks } from "./hooks/useCapacitorDeepLinks";
import { useSEO } from "./hooks/useSEO";

// Pages
import LandingPageNew from "./pages/LandingPageNew";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SubscribePage from "./pages/SubscribePage";
import CreateAccountPage from "./pages/CreateAccountPage";
import AppShell from "./pages/AppShell";
import NewProspectPage from "./pages/NewProspectPage";
import FAQPage from "./pages/FAQPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import PricingPage from "./pages/PricingPage";

// Analytics - track page views on route change
const AnalyticsTracker = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Track page view on route change
    const pageTitles = {
      '/': 'Landing Page',
      '/login': 'Login',
      '/register': 'Register',
      '/subscribe': 'Subscribe',
      '/create-account': 'Create Account',
      '/faq': 'FAQ',
      '/forgot-password': 'Forgot Password',
      '/app': 'Dashboard',
      '/app/prospects': 'Prospects',
      '/app/settings': 'Settings',
      '/app/prospects/new': 'New Prospect'
    };
    
    const title = pageTitles[location.pathname] || 'KOLO';
    trackPageView(location.pathname + location.search, title);
  }, [location]);
  
  return null;
};

// Theme-aware Toaster
const ThemedToaster = () => {
  const { isDark } = useTheme();
  
  return (
    <Toaster 
      position="top-center" 
      toastOptions={{
        style: {
          background: isDark ? '#14141A' : '#FFFFFF',
          color: isDark ? '#F5F5F7' : '#111827',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E5E7EB',
        },
      }}
    />
  );
};

// Router component that checks for session_id in URL
const AppRouter = () => {
  const location = useLocation();

  // SEO multilingue dynamique (title, description, OG, html[lang])
  useSEO();

  // Listener deep links natifs (iOS/Android) — retour Safari in-app Stripe
  useCapacitorDeepLinks();

  // Check URL fragment for session_id (from OAuth redirect)
  // This must happen synchronously during render to prevent race conditions
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPageNew />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/subscribe" element={<SubscribePage />} />
      <Route path="/create-account" element={<CreateAccountPage />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/pricing" element={<PricingPage />} />

      {/* Protected routes */}
      <Route 
        path="/app" 
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/app/prospects" 
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/app/settings" 
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/app/prospects/new" 
        element={
          <ProtectedRoute>
            <NewProspectPage />
          </ProtectedRoute>
        } 
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  // Cache le splash screen Capacitor dès que React est monté (évite l'écran blanc)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(() => {});
    }
  }, []);

  return (
    <div className="App">
      <ThemeProvider>
        <LocaleProvider>
          <PlanProvider>
            <BrowserRouter>
              <AuthProvider>
                <AnalyticsTracker />
                <AppRouter />
                <ThemedToaster />
              </AuthProvider>
            </BrowserRouter>
          </PlanProvider>
        </LocaleProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
