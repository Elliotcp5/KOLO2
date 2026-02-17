import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { LocaleProvider } from "./context/LocaleContext";
import { AuthProvider, AuthCallback, ProtectedRoute } from "./context/AuthContext";

// Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SubscribePage from "./pages/SubscribePage";
import CreateAccountPage from "./pages/CreateAccountPage";
import AppShell from "./pages/AppShell";
import NewProspectPage from "./pages/NewProspectPage";
import FAQPage from "./pages/FAQPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

// Router component that checks for session_id in URL
const AppRouter = () => {
  const location = useLocation();

  // Check URL fragment for session_id (from OAuth redirect)
  // This must happen synchronously during render to prevent race conditions
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/subscribe" element={<SubscribePage />} />
      <Route path="/create-account" element={<CreateAccountPage />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

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
  return (
    <div className="App">
      <LocaleProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRouter />
            <Toaster 
              position="top-center" 
              toastOptions={{
                style: {
                  background: '#14141A',
                  color: '#F5F5F7',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                },
              }}
            />
          </AuthProvider>
        </BrowserRouter>
      </LocaleProvider>
    </div>
  );
}

export default App;
