import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
};

export const OrgProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
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
  const fetchPublicBranding = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const slugFromUrl = params.get('org');
    const host = window.location.hostname;
    // Subdomain detection: subdomain.trykolo.io or subdomain.kolo.com etc.
    // Skip 'www', 'app', 'api', preview hosts
    const parts = host.split('.');
    const skipSubs = new Set(['www', 'app', 'api', 'localhost']);
    const isPreview = host.includes('preview.emergentagent.com') || host.includes('localhost');
    let slugFromSub = null;
    if (!isPreview && parts.length >= 3 && !skipSubs.has(parts[0])) {
      slugFromSub = parts[0];
    }
    const slug = slugFromUrl || slugFromSub;
    if (!slug) return;
    try {
      const r = await fetch(`${API_URL}/api/orgs/public/${slug}`);
      if (r.ok) {
        const d = await r.json();
        if (d?.org) {
          setPublicBranding(d.org);
          applyBranding(d.org);
        }
      }
    } catch (_e) { /* ignore */ }
  }, []);

  // First boot: try public branding (no auth needed)
  useEffect(() => { fetchPublicBranding(); }, [fetchPublicBranding]);

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
