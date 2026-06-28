// =============================================================
// KOLO v2 — API helper. Uses the same session token stored in
// localStorage as the rest of the app, with a clean wrapper.
// =============================================================
// Robust backend URL resolution:
//   1. Use REACT_APP_BACKEND_URL baked at build time (CRA).
//   2. Defensive defaults if the env is wrong/missing:
//      - trykolo.io (the Emergent prod deployment that serves both the
//        marketing site at `/` and the API at `/api/*`)
//      - the current preview URL (last-chance fallback)
//
// At runtime, on first launch, we ping a small chain of candidates
// and PIN the first one that answers `/api/` with HTTP 200. The
// result is persisted in localStorage so the next app start is instant.
// This guarantees that even if a preview URL becomes stale or the
// build-time env was wrong, the app finds its backend.
const STATIC_FALLBACKS = [
  'https://trykolo.io',
  'https://responsive-kolo.preview.emergentagent.com',
];

const cleanUrl = (u) => (u || '').trim().replace(/\/+$/, '');
const RAW_API = cleanUrl(process.env.REACT_APP_BACKEND_URL);
const BUILD_API = RAW_API || 'https://trykolo.io';

// Ordered list of URLs we'll probe at boot, deduped.
const CANDIDATES = [...new Set([BUILD_API, ...STATIC_FALLBACKS])];

let API = (() => {
  try {
    const pinned = cleanUrl(localStorage.getItem('kolo_v2_api_base'));
    if (pinned) return pinned;
  } catch (_) { /* no localStorage available */ }
  return BUILD_API;
})();

try { if (typeof window !== 'undefined') window.__KOLO_API_BASE__ = API; } catch (_) { /* noop */ }

// Probe candidates in the background; keep the first one that responds.
// Tries /api/ (root) — server.py mounts api_router with GET / returning
// {"message": "KOLO API v1.0.0"} so a 200 here guarantees the backend
// is reachable and serves the /api prefix.
const probe = async (base) => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    const r = await fetch(`${base}/api/`, { method: 'GET', signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch (_) { return false; }
};

const discoverApi = async () => {
  // If the currently-pinned API works, do nothing.
  if (await probe(API)) {
    try { localStorage.setItem('kolo_v2_api_base', API); } catch (_) { /* noop */ }
    return API;
  }
  // Otherwise walk the candidate list.
  for (const c of CANDIDATES) {
    if (c === API) continue;
    if (await probe(c)) {
      API = c;
      try { localStorage.setItem('kolo_v2_api_base', API); } catch (_) { /* noop */ }
      try { if (typeof window !== 'undefined') window.__KOLO_API_BASE__ = API; } catch (_) { /* noop */ }
      console.warn('[KOLO] Switched API base to', API);
      return API;
    }
  }
  // Nothing worked — keep the current value and let the next call fail visibly.
  return API;
};
// Fire once at module load. No `await` — non-blocking.
if (typeof window !== 'undefined') {
  setTimeout(() => { discoverApi().catch(() => {}); }, 50);
}

const getToken = () =>
  localStorage.getItem('kolo_v2_session') ||
  localStorage.getItem('session_token') ||
  '';

const headers = () => {
  const t = getToken();
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
};

const handle = async (res) => {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { detail = (await res.json()).detail || detail; } catch (_) { /* noop */ }
    throw new Error(detail);
  }
  return res.json();
};

// Resilient request: if the current API base returns 404 / 5xx / network
// error, re-run discovery and retry ONCE against the newly-pinned base.
// This neutralises stale preview URLs baked into older builds.
const req = async (path, init = {}) => {
  const tryOnce = async (base) => {
    const r = await fetch(`${base}${path}`, { headers: headers(), ...init });
    return r;
  };
  let r;
  try {
    r = await tryOnce(API);
  } catch (netErr) {
    // Network failure → discover and retry
    await discoverApi();
    r = await tryOnce(API);
  }
  // 404/502/503/504 on a known route ⇒ pinned base is wrong, retry
  if ([404, 502, 503, 504].includes(r.status)) {
    const previous = API;
    await discoverApi();
    if (API !== previous) {
      r = await tryOnce(API);
    }
  }
  return handle(r);
};

export const v2api = {
  setSession: (token) => localStorage.setItem('kolo_v2_session', token),
  clearSession: () => localStorage.removeItem('kolo_v2_session'),
  hasSession: () => !!getToken(),

  me: () => req('/api/v2/me'),

  // Auth
  sendEmailCode: (email) => req('/api/v2/auth/send-email-code', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyEmailCode: (payload) => req('/api/v2/auth/verify-email-code', { method: 'POST', body: JSON.stringify(payload) }),

  // Onboarding
  saveOnboarding: (payload) => req('/api/v2/onboarding', { method: 'POST', body: JSON.stringify(payload) }),
  getOnboarding: () => req('/api/v2/onboarding'),

  // Dashboard
  dashboard: () => req('/api/v2/dashboard'),

  // Reminders
  listReminders: (date) => req(`/api/v2/reminders${date ? `?date=${date}` : ''}`),
  createReminder: (data) => req('/api/v2/reminders', { method: 'POST', body: JSON.stringify(data) }),
  deleteReminder: (id) => req(`/api/v2/reminders/${id}`, { method: 'DELETE' }),

  // Notes
  listNotes: (status) => req(`/api/v2/notes${status ? `?status=${status}` : ''}`),
  createNote: (data) => req('/api/v2/notes', { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (id, data) => req(`/api/v2/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteNote: (id) => req(`/api/v2/notes/${id}`, { method: 'DELETE' }),

  // Cases (dossiers)
  listCases: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req(`/api/v2/cases${q ? `?${q}` : ''}`);
  },
  getCase: (id) => req(`/api/v2/cases/${id}`),
  createCase: (data) => req('/api/v2/cases', { method: 'POST', body: JSON.stringify(data) }),

  // Contacts
  listContacts: (search) =>
    req(`/api/v2/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getContact: (id) => req(`/api/v2/contacts/${id}`),
  createContact: (data) => req('/api/v2/contacts', { method: 'POST', body: JSON.stringify(data) }),

  // AI
  aiChat: (data) => req('/api/v2/ai/chat', { method: 'POST', body: JSON.stringify(data) }),
  dailyTip: () => req('/api/v2/ai/daily-tip'),
  listConversations: () => req('/api/v2/ai/conversations'),
  getConversation: (id) => req(`/api/v2/ai/conversations/${id}`),

  // Public (no auth required)
  referralInfo: (code) => req(`/api/v2/referral/info/${encodeURIComponent(code)}`),

  // Notifications
  testPush: () => req('/api/v2/notifications/test-push', { method: 'POST' }),

  // Referral
  myReferral: () => req('/api/v2/referral/me'),

  // Prospecting
  dpe: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req(`/api/v2/prospecting/dpe${q ? `?${q}` : ''}`);
  },
  listings: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req(`/api/v2/prospecting/listings${q ? `?${q}` : ''}`);
  },
};

// Helper used by other modules that still need to compose a URL by hand
// (e.g. Apple Sign-In, Google Sign-In, Stripe). They MUST go through this
// to benefit from runtime discovery.
export const getApiBase = () => API;
export const apiRequest = req;

export default v2api;
