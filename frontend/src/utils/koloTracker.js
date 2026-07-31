/**
 * KOLO Tracker — sends page views and CTA clicks to our own analytics
 * backend (`/api/track/*`). Independent from Google Analytics.
 *
 * - visitor_id: persistent UUID stored in localStorage (identifies a browser
 *   forever, across sessions)
 * - session_id: UUID refreshed if > 30 min of inactivity
 *
 * Both IDs are generated client-side, so no cookie banner is needed for
 * first-party product analytics (no PII collected here).
 */

const API = process.env.REACT_APP_BACKEND_URL;
const LS_VISITOR = 'kolo_visitor_id';
const LS_SESSION = 'kolo_session_id';
const LS_LAST_ACTIVITY = 'kolo_last_activity';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

const uuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const getVisitorId = () => {
  try {
    let id = localStorage.getItem(LS_VISITOR);
    if (!id) {
      id = uuid();
      localStorage.setItem(LS_VISITOR, id);
    }
    return id;
  } catch { return ''; }
};

const getSessionId = () => {
  try {
    const now = Date.now();
    const last = parseInt(localStorage.getItem(LS_LAST_ACTIVITY) || '0', 10);
    let sid = localStorage.getItem(LS_SESSION);
    if (!sid || now - last > SESSION_TTL_MS) {
      sid = uuid();
      localStorage.setItem(LS_SESSION, sid);
    }
    localStorage.setItem(LS_LAST_ACTIVITY, String(now));
    return sid;
  } catch { return ''; }
};

const post = async (endpoint, body) => {
  if (!API) return;
  try {
    // Use sendBeacon when leaving page (fire-and-forget, survives page unload)
    const url = `${API}${endpoint}`;
    const payload = JSON.stringify(body);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return;
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    });
  } catch (_) {
    // silent — analytics never breaks UX
  }
};

export const trackPageView = (path) => {
  const body = {
    path: path || (typeof window !== 'undefined' ? window.location.pathname : '/'),
    referrer: (typeof document !== 'undefined' && document.referrer) || '',
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    screen_width: (typeof window !== 'undefined' && window.innerWidth) || 0,
    screen_height: (typeof window !== 'undefined' && window.innerHeight) || 0,
  };
  post('/api/track/pageview', body);
};

export const trackCTA = (ctaId, path) => {
  const body = {
    cta_id: ctaId || 'unknown',
    path: path || (typeof window !== 'undefined' ? window.location.pathname : '/'),
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
  };
  post('/api/track/cta-click', body);
};

export default { trackPageView, trackCTA };
