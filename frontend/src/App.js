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

// Marketing v3 — Refonte intégrale du site vitrine www.trykolo.io
import MarketingHomePage from "./pages/marketing/HomePage";
import MarketingHowKoloPage from "./pages/marketing/HowKoloPage";
import MarketingResourcesPage from "./pages/marketing/ResourcesPage";
import MarketingAboutPage from "./pages/marketing/AboutPage";
import MarketingLegalPage from "./pages/marketing/LegalPage";

// KOLO private analytics dashboard (/dashboard on trykolo.io)
import DashboardLogin from "./pages/dashboard/DashboardLogin";
import Dashboard from "./pages/dashboard/Dashboard";
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
import V2SubscriptionPage from "./v2/pages/V2SubscriptionPage";

// KOLO BLOC B1 — Onboarding + Paywall + Guided Tour + Profile
import B1Onboarding from "./b1/B1Onboarding";
import {
  OpportunitesPage as B1OpportunitesPage,
  AssistantPage as B1AssistantPageOld,
  ProfilPage as B1ProfilPage,
  ProfilPersoPage as B1ProfilPersoPage,
  ProfilProPage as B1ProfilProPage,
  ProfilZonesPage as B1ProfilZonesPage,
  ProfilDeletePage as B1ProfilDeletePage,
  ProfilPaiementPage as B1ProfilPaiementPage,
} from "./b1/B1Shell";
import { DossierListPage as C2DossierList, DossierEditorPage as C2DossierEditor } from "./b1/B1Dossier";
import { AssistantPage as B1AssistantPage } from "./b1/B1Assistant";
import {
  EstimationHomePage as C1EstimationHome,
  EstimationFlowPage as C1EstimationFlow,
  EstimationAdressePage as C1EstimationAdresse,
  MesEstimationsPage as C1MesEstimations,
  EstimationDetailPage as C1EstimationDetail,
} from "./b1/B1Estimation";
import {
  VeillePileDuJourPage as B1VeillePileDuJourPage,
  MesVeilleSuivisPage as B1MesVeilleSuivisPage,
  VeillePaywall as B1VeillePaywall,
} from "./b1/B1Veille";
import { PerformancesPage as B3PerformancesPage, NotifPermissionScreen as B3NotifPerm } from "./b1/B3Perf";
import {
  DirecteurRepartitionPage as D1DirecteurRepartitionPage,
  DirecteurEquipePage as D1DirecteurEquipePage,
  DirecteurAgencePage as D1DirecteurAgencePage,
} from "./b1/B1Directeur";
import B1RepriseZones from "./b1/B1RepriseZones";

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
// RootRedirect — aiguille / vers /app-b1 ou /app-v2 selon app_version stockée.
// Utilisé en natif (Capacitor) où / est la racine du build.
const RootRedirect = () => {
  let appVersion = 'v2';
  let zonesConfirmees = true;
  try {
    appVersion = localStorage.getItem('kolo_app_version') || 'v2';
    zonesConfirmees = localStorage.getItem('kolo_zones_confirmees') === '1';
  } catch (_) { /* localStorage absent */ }
  if (appVersion === 'b1') {
    if (!zonesConfirmees) return <Navigate to="/app-b1/reprise" replace />;
    return <Navigate to="/app-b1" replace />;
  }
  return <Navigate to="/app-v2" replace />;
};

const AppRouter = () => {
  const location = useLocation();

  // V2 routes use a light premium theme — sync body bg to avoid flash-white between transitions.
  React.useEffect(() => {
    const path = location.pathname;
    const isV2 = path.startsWith('/app-v2') || path.startsWith('/r/');
    const isB1 = path.startsWith('/app-b1') || path.startsWith('/onboarding-b1');
    if (isV2) {
      document.body.style.backgroundColor = '#F7F7F9';
      document.documentElement.style.backgroundColor = '#F7F7F9';
    } else if (isB1) {
      document.body.style.backgroundColor = '#F0EEF8';
      document.documentElement.style.backgroundColor = '#F0EEF8';
    } else {
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
    }
  }, [location.pathname]);

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

  // Bandeau legacy — affiché sur /app-v2/* quand ?legacy=1 (accès depuis B1)
  const showLegacyBanner = location.pathname.startsWith('/app-v2') && location.search.includes('legacy=1');

  return (
    <>
      {showLegacyBanner && (
        <div
          data-testid="legacy-banner"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: '#F0EEF8', borderBottom: '1px solid rgba(0,0,0,0.06)',
            padding: '10px 16px', fontSize: 13, color: '#4B5563',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}
        >
          <span>Consultation de vos anciennes données. Les nouvelles fonctionnalités sont dans KOLO.</span>
          <a
            href="/app-b1"
            style={{ color: '#EC8690', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
            data-testid="legacy-banner-return"
          >
            Retour à KOLO →
          </a>
        </div>
      )}
      <Routes>
      {/* Public routes — Marketing v3 (web only, app native redirige sur /app-v2) */}
      <Route path="/" element={Capacitor.isNativePlatform() ? <RootRedirect /> : <MarketingHomePage />} />
      <Route path="/comment-kolo" element={<MarketingHowKoloPage />} />
      <Route path="/ressources" element={<MarketingResourcesPage />} />
      <Route path="/a-propos" element={<MarketingAboutPage />} />
      <Route path="/legal" element={<MarketingLegalPage />} />
      <Route path="/privacy" element={<MarketingLegalPage />} />
      <Route path="/terms" element={<MarketingLegalPage />} />
      {/* Private analytics dashboard — password-gated (elliot only) */}
      <Route path="/dashboard/login" element={<DashboardLogin />} />
      <Route path="/dashboard" element={<Dashboard />} />
      {/* Legacy landing accessible via /landing-old pour fallback temporaire */}
      <Route path="/landing-old" element={<LandingPageNew />} />
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
      <Route path="/app-v2/settings/subscription" element={<V2SubscriptionPage />} />
      <Route path="/app-v2/settings/delete" element={<V2SettingsPage />} />
      <Route path="/app-v2/conversations" element={<V2HomePage />} />
      <Route path="/app-v2/notifications" element={<V2NotificationsPage />} />
      {/* Public referral landing — /r/:code */}
      <Route path="/r/:code" element={<V2ReferralLandingPage />} />

      {/* ============================================================== */}
      {/* KOLO BLOC B1 — Onboarding + Shell (Opportunités / Estimation / */}
      {/* Rapport / Assistant) + Profil complet + Tour guidé              */}
      {/* ============================================================== */}
      <Route path="/onboarding-b1" element={<B1Onboarding />} />
      <Route path="/app-b1" element={<B1OpportunitesPage />} />
      {/* C1 — Estimation (moteur déterministe DVF) */}
      <Route path="/app-b1/estimation" element={<C1EstimationHome />} />
      <Route path="/app-b1/estimation/adresse" element={<C1EstimationAdresse />} />
      <Route path="/app-b1/estimation/flow" element={<C1EstimationFlow />} />
      <Route path="/app-b1/estimations" element={<C1MesEstimations />} />
      <Route path="/app-b1/estimations/:id" element={<C1EstimationDetail />} />
      <Route path="/app-b1/rapport" element={<C2DossierList />} />
      <Route path="/app-b1/rapport/:id" element={<C2DossierEditor />} />
      <Route path="/app-b1/assistant" element={<B1AssistantPage />} />
      <Route path="/app-b1/profil" element={<B1ProfilPage />} />
      <Route path="/app-b1/profil/perso" element={<B1ProfilPersoPage />} />
      <Route path="/app-b1/profil/pro" element={<B1ProfilProPage />} />
      <Route path="/app-b1/profil/zones" element={<B1ProfilZonesPage />} />
      <Route path="/app-b1/profil/paiement" element={<B1ProfilPaiementPage />} />
      <Route path="/app-b1/profil/supprimer" element={<B1ProfilDeletePage />} />
      {/* Veille — Pro uniquement (paywall si Découverte) */}
      <Route path="/app-b1/veille" element={<B1VeillePileDuJourPage />} />
      <Route path="/app-b1/veille/paywall" element={<B1VeillePaywall />} />
      <Route path="/app-b1/veille/suivis" element={<B1MesVeilleSuivisPage />} />
      {/* B3 — Performances + demande d'autorisation notifications */}
      <Route path="/app-b1/performances" element={<B3PerformancesPage />} />
      <Route path="/app-b1/notifications/permission" element={<B3NotifPerm />} />

      {/* D1 — Écrans du directeur (rôle 'directeur' requis côté API) */}
      <Route path="/app-b1/directeur/repartition" element={<D1DirecteurRepartitionPage />} />
      <Route path="/app-b1/directeur/equipe" element={<D1DirecteurEquipePage />} />
      <Route path="/app-b1/directeur/agence" element={<D1DirecteurAgencePage />} />

      {/* D1 — Reprise post-migration V2 → B1 */}
      <Route path="/app-b1/reprise" element={<B1RepriseZones />} />

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
    </>
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
