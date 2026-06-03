// API URL configuration
// - iOS native (Capacitor): production URL (trykolo.io) because
//   `window.location.origin === "capacitor://localhost"` would break all API calls.
// - Web (browser): use REACT_APP_BACKEND_URL from .env so each environment
//   (preview, production) talks to its own backend without CORS issues.
import { Capacitor } from '@capacitor/core';

const PRODUCTION_API = 'https://trykolo.io';

const resolveApiUrl = () => {
  try {
    if (Capacitor.isNativePlatform()) return PRODUCTION_API;
  } catch (_) { /* noop */ }
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/$/, '');
  return PRODUCTION_API;
};

export const API_URL = resolveApiUrl();
