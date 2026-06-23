import React, { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { LocaleProvider } from "./context/LocaleContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AuthProvider, AuthCallback, ProtectedRoute, SuperAdminRoute } from "./context/AuthContext";
import { PlanProvider } from "./context/PlanContext";
import { OrgProvider } from "./context/OrgContext";
import { trackPageView } from "./utils/analytics";
import { useCapacitorDeepLinks } from "./hooks/useCapacitorDeepLinks";
import { useSEO } from "./hooks/useSEO";
import { useIOSKeyboardScroll } from "./hooks/useIOSKeyboardScroll";

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
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import LegalPage from "./pages/LegalPage";
import IapTermsPage from "./pages/IapTermsPage";
import BusinessPage from "./pages/BusinessPage";
import AdminDashboard from "./pages/AdminDashboard";
import OrgSpace from "./pages/OrgSpace";
import IntegrationsPage from "./pages/IntegrationsPage";
import JoinOrgPage from "./pages/JoinOrgPage";
import GoogleAuthCallback from "./pages/GoogleAuthCallback";
import BlogIndex from "./pages/BlogIndex";
import BlogPost from "./pages/BlogPost";

// KOLO v2 — Webapp refonte intégrale
import V2HomePage from "./v2/pages/V2HomePage";
import { V2CasesPage, V2ContactsPage, V2AgendaPage } from "./v2/pages/V2OtherPages";
import V2AuthPage from "./v2/pages/V2AuthPage";
import V2OnboardingPage from "./v2/pages/V2OnboardingPage";
import { V2ProspectingPage, V2GuidePage, V2SettingsPage, V2ReferralPage } from "./v2/pages/V2Extras";
import V2ReferralLandingPage from "./v2/pages/V2ReferralLandingPage";
import V2NotificationsPage from "./v2/pages/V2NotificationsPage";

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

  // Gère le clavier iOS : scrolle l'input focusé au-dessus du clavier
  useIOSKeyboardScroll();

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
      <Route path="/reset-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/google" element={<GoogleAuthCallback />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/terms-of-use" element={<TermsPage />} />
      <Route path="/legal" element={<LegalPage />} />
      <Route path="/mentions-legales" element={<LegalPage />} />
      <Route path="/iap-terms" element={<IapTermsPage />} />
      <Route path="/conditions-achat" element={<IapTermsPage />} />
      <Route path="/eula" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/privacy-policy" element={<PrivacyPage />} />
      <Route path="/business" element={<BusinessPage />} />
      <Route path="/entreprise" element={<BusinessPage />} />
      <Route path="/blog" element={<BlogIndex />} />
      <Route path="/blog/:slug" element={<BlogPost />} />

      {/* ============================================================== */}
      {/* KOLO v2 — Webapp refonte intégrale (iOS-first, 4 onglets)      */}
      {/* ============================================================== */}
      <Route path="/app-v2" element={<V2HomePage />} />
      <Route path="/app-v2/dossiers" element={<V2CasesPage />} />
      <Route path="/app-v2/contacts" element={<V2ContactsPage />} />
      <Route path="/app-v2/agenda" element={<V2AgendaPage />} />
      <Route path="/app-v2/login" element={<V2AuthPage mode="login" />} />
      <Route path="/app-v2/signup" element={<V2AuthPage mode="signup" />} />
      <Route path="/app-v2/onboarding" element={<V2OnboardingPage />} />
      <Route path="/app-v2/prospecting" element={<V2ProspectingPage />} />
      <Route path="/app-v2/referral" element={<V2ReferralPage />} />
      <Route path="/app-v2/guide" element={<V2GuidePage />} />
      <Route path="/app-v2/settings" element={<V2SettingsPage />} />
      <Route path="/app-v2/settings/subscription" element={<V2SettingsPage />} />
      <Route path="/app-v2/settings/delete" element={<V2SettingsPage />} />
      <Route path="/app-v2/conversations" element={<V2HomePage />} />
      <Route path="/app-v2/notifications" element={<V2NotificationsPage />} />
      {/* Public referral landing — /r/:code */}
      <Route path="/r/:code" element={<V2ReferralLandingPage />} />

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

      {/* KOLO Super Admin space — email allowlist */}
      <Route
        path="/kolo-admin"
        element={
          <SuperAdminRoute>
            <AdminDashboard />
          </SuperAdminRoute>
        }
      />

      {/* Org Space (multi-tenant marque blanche) */}
      <Route
        path="/org"
        element={
          <ProtectedRoute>
            <OrgSpace />
          </ProtectedRoute>
        }
      />
      <Route path="/org/join/:token" element={<JoinOrgPage />} />
      <Route path="/join-org/:token" element={<JoinOrgPage />} />

      {/* Integrations (Twilio, WhatsApp, Calendars) */}
      <Route
        path="/integrations"
        element={
          <ProtectedRoute>
            <IntegrationsPage />
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
                <OrgProvider>
                  <AnalyticsTracker />
                  <AppRouter />
                  <ThemedToaster />
                </OrgProvider>
              </AuthProvider>
            </BrowserRouter>
          </PlanProvider>
        </LocaleProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
