// =============================================================
// KOLO v2 — API helper. Uses the same session token stored in
// localStorage as the rest of the app, with a clean wrapper.
// =============================================================
const API = process.env.REACT_APP_BACKEND_URL || 'https://responsive-kolo.preview.emergentagent.com';

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
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
};

export const v2api = {
  setSession: (token) => localStorage.setItem('kolo_v2_session', token),
  clearSession: () => localStorage.removeItem('kolo_v2_session'),
  hasSession: () => !!getToken(),

  me: () => fetch(`${API}/api/v2/me`, { headers: headers() }).then(handle),

  // Auth
  sendEmailCode: (email) =>
    fetch(`${API}/api/v2/auth/send-email-code`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ email }),
    }).then(handle),
  verifyEmailCode: (payload) =>
    fetch(`${API}/api/v2/auth/verify-email-code`, {
      method: 'POST', headers: headers(), body: JSON.stringify(payload),
    }).then(handle),

  // Onboarding
  saveOnboarding: (payload) =>
    fetch(`${API}/api/v2/onboarding`, {
      method: 'POST', headers: headers(), body: JSON.stringify(payload),
    }).then(handle),
  getOnboarding: () =>
    fetch(`${API}/api/v2/onboarding`, { headers: headers() }).then(handle),

  // Dashboard
  dashboard: () => fetch(`${API}/api/v2/dashboard`, { headers: headers() }).then(handle),

  // Reminders
  listReminders: (date) =>
    fetch(`${API}/api/v2/reminders${date ? `?date=${date}` : ''}`, { headers: headers() }).then(handle),
  createReminder: (data) =>
    fetch(`${API}/api/v2/reminders`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  deleteReminder: (id) =>
    fetch(`${API}/api/v2/reminders/${id}`, { method: 'DELETE', headers: headers() }).then(handle),

  // Notes
  listNotes: (status) =>
    fetch(`${API}/api/v2/notes${status ? `?status=${status}` : ''}`, { headers: headers() }).then(handle),
  createNote: (data) =>
    fetch(`${API}/api/v2/notes`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  updateNote: (id, data) =>
    fetch(`${API}/api/v2/notes/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(data) }).then(handle),
  deleteNote: (id) =>
    fetch(`${API}/api/v2/notes/${id}`, { method: 'DELETE', headers: headers() }).then(handle),

  // Cases (dossiers)
  listCases: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${API}/api/v2/cases${q ? `?${q}` : ''}`, { headers: headers() }).then(handle);
  },
  getCase: (id) =>
    fetch(`${API}/api/v2/cases/${id}`, { headers: headers() }).then(handle),
  createCase: (data) =>
    fetch(`${API}/api/v2/cases`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),

  // Contacts
  listContacts: (search) =>
    fetch(`${API}/api/v2/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`, { headers: headers() }).then(handle),
  getContact: (id) =>
    fetch(`${API}/api/v2/contacts/${id}`, { headers: headers() }).then(handle),
  createContact: (data) =>
    fetch(`${API}/api/v2/contacts`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),

  // AI
  aiChat: (data) =>
    fetch(`${API}/api/v2/ai/chat`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  dailyTip: () =>
    fetch(`${API}/api/v2/ai/daily-tip`, { headers: headers() }).then(handle),
  listConversations: () =>
    fetch(`${API}/api/v2/ai/conversations`, { headers: headers() }).then(handle),
  getConversation: (id) =>
    fetch(`${API}/api/v2/ai/conversations/${id}`, { headers: headers() }).then(handle),

  // Public (no auth required)
  referralInfo: (code) =>
    fetch(`${API}/api/v2/referral/info/${encodeURIComponent(code)}`).then(handle),

  // Notifications
  testPush: () =>
    fetch(`${API}/api/v2/notifications/test-push`, { method: 'POST', headers: headers() }).then(handle),

  // Referral
  myReferral: () => fetch(`${API}/api/v2/referral/me`, { headers: headers() }).then(handle),

  // Prospecting
  dpe: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${API}/api/v2/prospecting/dpe${q ? `?${q}` : ''}`, { headers: headers() }).then(handle);
  },
  listings: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${API}/api/v2/prospecting/listings${q ? `?${q}` : ''}`, { headers: headers() }).then(handle);
  },
};

export default v2api;
