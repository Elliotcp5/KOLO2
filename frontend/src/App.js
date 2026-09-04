// =============================================================
// KOLO — Router principal APRÈS refonte
//
// Décisions :
//   • L'application iOS ne connaît QUE la refonte B1 (login par code
//     email + tabs Opportunités / Estimation / Rapport / Assistant / Profil).
//   • L'ancien monde (LoginPage password, RegisterPage, AppShell dashboard v1,
//     V2HomePage/V2CasesPage/etc.) N'A PAS DE ROUTE. Tout redirige vers /login.
//   • Le site vitrine www.trykolo.io reste servi par le même React (nécessaire
//     Apple Review + SEO), MAIS jamais monté en natif : Capacitor.isNativePlatform()
//     court-circuite tout et va sur RootRedirect.
//
// Bug corrigé (2026-09-03) : DEUX routes /login coexistaient (LoginPage password
// + V2AuthPage code). React Router prenait la 1re → l'utilisateur voyait le vieil
// écran malgré la refonte. Correction : LoginPage supprimé du router.
// =============================================================
import React, { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { LocaleProvider } from "./context/LocaleContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AuthProvider, AuthCallback } from "./context/AuthContext";
import { PlanProvider } from "./context/PlanContext";
import { OrgProvider } from "./context/OrgContext";
import { trackPageView } from "./utils/analytics";
import { useCapacitorDeepLinks } from "./hooks/useCapacitorDeepLinks";
import { useSEO } from "./hooks/useSEO";
import { useIOSKeyboardScroll } from "./hooks/useIOSKeyboardScroll";

// ------------------------------------------------------------
// Marketing v3 — site vitrine www.trykolo.io (web uniquement)
// ------------------------------------------------------------
import MarketingHomePage from "./pages/marketing/HomePage";
import MarketingHowKoloPage from "./pages/marketing/HowKoloPage";
import MarketingResourcesPage from "./pages/marketing/ResourcesPage";
import MarketingAboutPage from "./pages/marketing/AboutPage";
import MarketingLegalPage from "./pages/marketing/LegalPage";

// Pages légales — obligatoires pour Apple App Review
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import IapTermsPage from "./pages/IapTermsPage";

// Dashboard analytics privé (elliot uniquement, /dashboard sur trykolo.io)
import DashboardLogin from "./pages/dashboard/DashboardLogin";
import Dashboard from "./pages/dashboard/Dashboard";

// Écran de connexion UNIQUE — code email 6 chiffres. Aucun mot de passe.
import V2AuthPage from "./v2/pages/V2AuthPage";
// Referral public landing (/r/:code) — accessible sans compte
import V2ReferralLandingPage from "./v2/pages/V2ReferralLandingPage";
// Callback Google OAuth (deep link natif)
import GoogleAuthCallback from "./pages/GoogleAuthCallback";

// ------------------------------------------------------------
// KOLO BLOC B1 — LA refonte. Tout iOS pointe ici après login.
// ------------------------------------------------------------
import B1Onboarding from "./b1/B1Onboarding";
import {
  OpportunitesPage as B1OpportunitesPage,
  ProfilPage as B1ProfilPage,
  ProfilPersoPage as B1ProfilPersoPage,
  ProfilProPage as B1ProfilProPage,
  ProfilZonesPage as B1ProfilZonesPage,
  ProfilDeletePage as B1ProfilDeletePage,
  ProfilPaiementPage as B1ProfilPaiementPage,
} from "./b1/B1Shell";
import { MesMandatsPage as B1MesMandatsPage } from "./b1/B1MesMandats";
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


// ------------------------------------------------------------
// Analytics tracker
// ------------------------------------------------------------
const AnalyticsTracker = () => {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search, "KOLO");
  }, [location]);
  return null;
};


// ------------------------------------------------------------
// Toaster thémé (dark/light)
// ------------------------------------------------------------
const ThemedToaster = () => {
  const { isDark } = useTheme();
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: isDark ? "#14141A" : "#FFFFFF",
          color: isDark ? "#F5F5F7" : "#111827",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #E5E7EB",
        },
      }}
    />
  );
};


// ------------------------------------------------------------
// RootRedirect — page d'entrée de l'app native.
//   • Pas de session token → /login (écran code email)
//   • Session valide → /app-b1 (ou /app-b1/reprise si zones à confirmer)
//   • 401 → /login
// La décision vient TOUJOURS du serveur, JAMAIS d'un localStorage caché.
// ------------------------------------------------------------
const RootRedirect = () => {
  const [target, setTarget] = React.useState(null);
  React.useEffect(() => {
    let token = null;
    try { token = localStorage.getItem("kolo_v2_session"); } catch (_) {}
    if (!token) { setTarget("/login"); return; }
    const backend = process.env.REACT_APP_BACKEND_URL || "";
    fetch(`${backend}/api/v2/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => (r.status === 401 ? null : r.json()))
      .then((user) => {
        if (!user) { setTarget("/login"); return; }
        setTarget(user.zones_confirmees ? "/app-b1" : "/app-b1/reprise");
      })
      .catch(() => setTarget("/login"));
  }, []);
  if (!target) return null;
  return <Navigate to={target} replace />;
};


// ------------------------------------------------------------
// AppRouter — thème body + SEO + deep links + routes
// ------------------------------------------------------------
const AppRouter = () => {
  const location = useLocation();

  // Sync body background pour éviter le flash blanc entre pages B1
  React.useEffect(() => {
    const path = location.pathname;
    const isB1 = path.startsWith("/app-b1") || path.startsWith("/onboarding-b1")
      || path === "/login" || path === "/signup";
    document.body.style.backgroundColor = isB1 ? "#F0EEF8" : "";
    document.documentElement.style.backgroundColor = isB1 ? "#F0EEF8" : "";
  }, [location.pathname]);

  useSEO();
  useCapacitorDeepLinks();
  useIOSKeyboardScroll();

  // OAuth callback fragment (session_id=...) — retour deep link natif
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* ============================================================== */}
      {/* SITE VITRINE — trykolo.io. Native app ne voit JAMAIS ça.       */}
      {/* ============================================================== */}
      <Route path="/" element={Capacitor.isNativePlatform() ? <RootRedirect /> : <MarketingHomePage />} />
      <Route path="/comment-kolo" element={<MarketingHowKoloPage />} />
      <Route path="/ressources" element={<MarketingResourcesPage />} />
      <Route path="/a-propos" element={<MarketingAboutPage />} />
      <Route path="/legal" element={<MarketingLegalPage />} />

      {/* Pages légales — Apple Review l'exige */}
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/eula" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/privacy-policy" element={<PrivacyPage />} />
      <Route path="/iap-terms" element={<IapTermsPage />} />
      <Route path="/conditions-achat" element={<IapTermsPage />} />
      <Route path="/mentions-legales" element={<MarketingLegalPage />} />

      {/* Dashboard analytics super-admin (mot de passe elliot only) */}
      <Route path="/dashboard/login" element={<DashboardLogin />} />
      <Route path="/dashboard" element={<Dashboard />} />

      {/* Referral public landing */}
      <Route path="/r/:code" element={<V2ReferralLandingPage />} />

      {/* ============================================================== */}
      {/* CONNEXION — écran UNIQUE. Login par code email 6 chiffres.     */}
      {/* Aucun mot de passe. Aucun autre écran.                          */}
      {/* ============================================================== */}
      <Route path="/login" element={<V2AuthPage mode="login" />} />
      <Route path="/signup" element={<V2AuthPage mode="signup" />} />
      <Route path="/auth/google" element={<GoogleAuthCallback />} />

      {/* ============================================================== */}
      {/* KOLO BLOC B1 — LA refonte. Toutes les routes app iOS.          */}
      {/* ============================================================== */}
      <Route path="/onboarding-b1" element={<B1Onboarding />} />
      <Route path="/app-b1" element={<B1OpportunitesPage />} />
      <Route path="/app-b1/mes-mandats" element={<B1MesMandatsPage />} />
      {/* Reprise post-migration zones */}
      <Route path="/app-b1/reprise" element={<B1RepriseZones />} />

      {/* C1 — Estimation */}
      <Route path="/app-b1/estimation" element={<C1EstimationHome />} />
      <Route path="/app-b1/estimation/adresse" element={<C1EstimationAdresse />} />
      <Route path="/app-b1/estimation/flow" element={<C1EstimationFlow />} />
      <Route path="/app-b1/estimations" element={<C1MesEstimations />} />
      <Route path="/app-b1/estimations/:id" element={<C1EstimationDetail />} />

      {/* C2 — Rapport / Dossier */}
      <Route path="/app-b1/rapport" element={<C2DossierList />} />
      <Route path="/app-b1/rapport/:id" element={<C2DossierEditor />} />

      {/* Assistant IA */}
      <Route path="/app-b1/assistant" element={<B1AssistantPage />} />

      {/* Profil */}
      <Route path="/app-b1/profil" element={<B1ProfilPage />} />
      <Route path="/app-b1/profil/perso" element={<B1ProfilPersoPage />} />
      <Route path="/app-b1/profil/pro" element={<B1ProfilProPage />} />
      <Route path="/app-b1/profil/zones" element={<B1ProfilZonesPage />} />
      <Route path="/app-b1/profil/paiement" element={<B1ProfilPaiementPage />} />
      <Route path="/app-b1/profil/supprimer" element={<B1ProfilDeletePage />} />

      {/* Veille — Pro uniquement */}
      <Route path="/app-b1/veille" element={<B1VeillePileDuJourPage />} />
      <Route path="/app-b1/veille/paywall" element={<B1VeillePaywall />} />
      <Route path="/app-b1/veille/suivis" element={<B1MesVeilleSuivisPage />} />

      {/* B3 — Performances + demande permission notifications */}
      <Route path="/app-b1/performances" element={<B3PerformancesPage />} />
      <Route path="/app-b1/notifications/permission" element={<B3NotifPerm />} />

      {/* D1 — Écrans directeur */}
      <Route path="/app-b1/directeur/repartition" element={<D1DirecteurRepartitionPage />} />
      <Route path="/app-b1/directeur/equipe" element={<D1DirecteurEquipePage />} />
      <Route path="/app-b1/directeur/agence" element={<D1DirecteurAgencePage />} />

      {/* ============================================================== */}
      {/* PIÈGES À VIEILLES URLs — tout ce qui existait avant redirige   */}
      {/* vers /login. Empêche définitivement l'ancien monde de refaire   */}
      {/* surface via un lien caché ou un bookmark.                       */}
      {/* ============================================================== */}
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
      <Route path="/reset-password" element={<Navigate to="/login" replace />} />
      <Route path="/create-account" element={<Navigate to="/login" replace />} />
      <Route path="/subscribe" element={<Navigate to="/login" replace />} />
      <Route path="/app" element={<Navigate to="/app-b1" replace />} />
      <Route path="/app/prospects" element={<Navigate to="/app-b1" replace />} />
      <Route path="/app/prospects/new" element={<Navigate to="/app-b1" replace />} />
      <Route path="/app/settings" element={<Navigate to="/app-b1/profil" replace />} />
      <Route path="/app-v2" element={<Navigate to="/app-b1" replace />} />
      <Route path="/app-v2/*" element={<Navigate to="/app-b1" replace />} />
      <Route path="/kolo-admin" element={<Navigate to="/" replace />} />
      <Route path="/org" element={<Navigate to="/" replace />} />
      <Route path="/org/*" element={<Navigate to="/" replace />} />
      <Route path="/join-org/*" element={<Navigate to="/" replace />} />
      <Route path="/integrations" element={<Navigate to="/app-b1/profil" replace />} />
      <Route path="/faq" element={<MarketingResourcesPage />} />
      <Route path="/pricing" element={<MarketingHomePage />} />
      <Route path="/business" element={<MarketingHomePage />} />
      <Route path="/entreprise" element={<MarketingHomePage />} />

      {/* Catch-all : native → RootRedirect (login ou app-b1) ; web → home */}
      <Route
        path="*"
        element={Capacitor.isNativePlatform() ? <RootRedirect /> : <Navigate to="/" replace />}
      />
    </Routes>
  );
};


function App() {
  // Cache le splash Capacitor dès que React est monté
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
