import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { API_URL } from '../config/api';
import { useAuth } from './AuthContext';

const OrgContext = createContext(null);

export const useOrg = () => {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
};

const KOLO_DEFAULTS = {
  name: 'KOLO',
  primary_color: '#004AAD',
  secondary_color: '#CB6CE6',
  logo_url: null,
  font_family: 'Inter',
  tagline: null,
};

// Google Fonts that need to be loaded dynamically when an org uses them
const GOOGLE_FONTS = new Set([
  'Inter', 'Poppins', 'Montserrat', 'Manrope', 'DM Sans', 'Plus Jakarta Sans',
  'Space Grotesk', 'Outfit', 'Roboto', 'Lato', 'Nunito', 'Work Sans',
  'Playfair Display', 'Lora', 'Merriweather',
]);

const loadGoogleFont = (fontFamily) => {
  if (!fontFamily || !GOOGLE_FONTS.has(fontFamily)) return;
  const id = `kolo-font-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return; // already loaded
  // Preconnect once
  if (!document.getElementById('kolo-gfonts-preconnect')) {
    const pre1 = document.createElement('link');
    pre1.id = 'kolo-gfonts-preconnect';
    pre1.rel = 'preconnect';
    pre1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(pre1);
    const pre2 = document.createElement('link');
    pre2.rel = 'preconnect';
    pre2.href = 'https://fonts.gstatic.com';
    pre2.crossOrigin = 'anonymous';
    document.head.appendChild(pre2);
  }
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
};

const applyBranding = (org) => {
  const root = document.documentElement;
  const conf = { ...KOLO_DEFAULTS, ...(org || {}) };
  root.style.setProperty('--brand-primary', conf.primary_color);
  root.style.setProperty('--brand-secondary', conf.secondary_color);
  root.style.setProperty('--brand-gradient', `linear-gradient(135deg, ${conf.primary_color}, ${conf.secondary_color})`);
  root.style.setProperty('--brand-font', conf.font_family);
  root.style.setProperty('--brand-logo-url', conf.logo_url ? `url(${conf.logo_url})` : 'none');
  // Friendly hex helper for transparent variants
  root.style.setProperty('--brand-primary-soft', conf.primary_color + '1A');
  // Override the global app fonts when an org provides a custom font; reset to defaults otherwise.
  if (org && conf.font_family && conf.font_family !== 'Inter') {
    const stack = `"${conf.font_family}", system-ui, -apple-system, sans-serif`;
    root.style.setProperty('--font-body', stack);
    root.style.setProperty('--font-heading', stack);
  } else {
    root.style.removeProperty('--font-body');
    root.style.removeProperty('--font-heading');
  }
  // Mark body so global CSS can override hardcoded KOLO purple/pink gradients
  if (org) document.body.setAttribute('data-org-branded', 'true');
  else document.body.removeAttribute('data-org-branded');

  // Inject (or refresh) a stylesheet that forces brand colors onto KOLO-hardcoded gradient/violet/pink elements
  let styleEl = document.getElementById('kolo-brand-overrides');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'kolo-brand-overrides';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = org ? `
    body[data-org-branded="true"] .org-btn-primary,
    body[data-org-branded="true"] button[style*="linear-gradient(135deg, rgb(139, 92, 246)"],
    body[data-org-branded="true"] [class*="gradient-violet"],
    body[data-org-branded="true"] [class*="kolo-gradient"] {
      background: var(--brand-gradient) !important;
    }
    body[data-org-branded="true"] [style*="background: linear-gradient(135deg, #8B5CF6"],
    body[data-org-branded="true"] [style*="background-image: linear-gradient(135deg, #8B5CF6"] {
      background: var(--brand-gradient) !important;
    }
    body[data-org-branded="true"] [style*="color: rgb(139, 92, 246)"],
    body[data-org-branded="true"] [style*="color: #8B5CF6"],
    body[data-org-branded="true"] [style*="color:#8B5CF6"] {
      color: var(--brand-primary) !important;
    }
    body[data-org-branded="true"] [style*="rgba(139, 92, 246"],
    body[data-org-branded="true"] [style*="rgba(139,92,246"] {
      /* keep transparency level but tint with brand primary */
      filter: hue-rotate(0deg);
    }
    body[data-org-branded="true"] [style*="background: #8B5CF6"] {
      background: var(--brand-primary) !important;
    }
  ` : '';
  // Dynamically load the brand's Google Font (idempotent)
  loadGoogleFont(conf.font_family);
};

export const OrgProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const location = useLocation();
  const [org, setOrg] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [publicBranding, setPublicBranding] = useState(null); // for /register?org=slug

  const fetchMyOrg = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('kolo_token');
      const r = await fetch(`${API_URL}/api/orgs/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (r.ok) {
        const d = await r.json();
        setOrg(d.org || null);
        setRole(d.role || null);
        applyBranding(d.org);
      } else {
        applyBranding(null);
      }
    } catch (_e) {
      applyBranding(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // 1. Public branding via ?org=slug URL param (used by /register, /login pre-auth)
  // 2. Or subdomain detection (custom.trykolo.io)
  // 3. If neither is present, RESET branding to KOLO defaults (avoid stale brand
  //    leaking from a previous SPA navigation).
  const syncPublicBranding = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const slugFromUrl = params.get('org');
    const host = window.location.hostname;
    const parts = host.split('.');
    const skipSubs = new Set(['www', 'app', 'api', 'localhost']);
    const isPreview = host.includes('preview.emergentagent.com') || host.includes('localhost');
    let slugFromSub = null;
    if (!isPreview && parts.length >= 3 && !skipSubs.has(parts[0])) {
      slugFromSub = parts[0];
    }
    const slug = slugFromUrl || slugFromSub;
    if (!slug) {
      // No org context in URL → clear any previously-applied white-label brand
      if (!isAuthenticated) {
        setPublicBranding(null);
        applyBranding(null);
      }
      return;
    }
    try {
      const r = await fetch(`${API_URL}/api/orgs/public/${slug}`);
      if (r.ok) {
        const d = await r.json();
        if (d?.org) {
          setPublicBranding(d.org);
          applyBranding(d.org);
        } else {
          setPublicBranding(null);
          if (!isAuthenticated) applyBranding(null);
        }
      } else {
        setPublicBranding(null);
        if (!isAuthenticated) applyBranding(null);
      }
    } catch (_e) { /* ignore */ }
  }, [isAuthenticated]);

  // Re-sync public branding on every route change (SPA navigations included)
  useEffect(() => { syncPublicBranding(); }, [syncPublicBranding, location.pathname, location.search]);

  // After auth: fetch the user's org and override branding
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      fetchMyOrg();
    } else {
      setOrg(null);
      setRole(null);
      // Keep publicBranding if any, otherwise reset
      if (!publicBranding) applyBranding(null);
    }
  }, [authLoading, isAuthenticated, fetchMyOrg, publicBranding]);

  const effectiveBranding = org || publicBranding || KOLO_DEFAULTS;
  const isBranded = !!(org || publicBranding);

  return (
    <OrgContext.Provider
      value={{
        org,
        role,
        loading,
        publicBranding,
        branding: effectiveBranding,
        isBranded,
        refresh: fetchMyOrg,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
};

export default OrgContext;
