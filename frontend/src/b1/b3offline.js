// KOLO — B3 : file locale d'actions + brouillons de formulaires.
// Un swipe fait hors ligne est stocké ici, resynchronisé au retour du réseau.
// Un formulaire en cours d'édition est sauvegardé à chaque modification.

const QUEUE_KEY = 'kolo_offline_queue';
const DRAFT_PREFIX = 'kolo_draft_';

function _readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function _writeQueue(arr) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(arr)); } catch {}
}

/**
 * Ajoute une action à la file locale (dans l'ordre).
 * `action` : { method, path, body, kind, at }
 */
export function enqueueAction(action) {
  const q = _readQueue();
  q.push({ ...action, at: action.at || Date.now(), id: Math.random().toString(36).slice(2) });
  _writeQueue(q);
  return q.length;
}

export function pendingCount() {
  return _readQueue().length;
}

let _flushing = false;
export async function flushQueue({ apiBase, token } = {}) {
  if (_flushing) return { synced: 0 };
  _flushing = true;
  const api = apiBase || process.env.REACT_APP_BACKEND_URL;
  const t = token || (() => { try { return localStorage.getItem('kolo_v2_session') || ''; } catch { return ''; } })();
  let synced = 0;
  let q = _readQueue();
  while (q.length) {
    const a = q[0];
    try {
      const r = await fetch(`${api}${a.path}`, {
        method: a.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
        body: a.body ? JSON.stringify(a.body) : undefined,
      });
      if (r.status >= 500) break;   // erreur serveur → on ré-essaie plus tard
      // 4xx : on considère l'action comme non retry-able (idempotence côté serveur)
      q.shift();
      _writeQueue(q);
      synced += 1;
      q = _readQueue();
    } catch {
      break;
    }
  }
  _flushing = false;
  return { synced };
}

window.addEventListener('online', () => { flushQueue().catch(() => {}); });

// --------- Brouillons de formulaires ---------
export function saveDraft(name, values) {
  try { localStorage.setItem(DRAFT_PREFIX + name, JSON.stringify({ v: values, at: Date.now() })); } catch {}
}
export function loadDraft(name) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + name);
    if (!raw) return null;
    const p = JSON.parse(raw);
    // Draft expire après 30 jours
    if (Date.now() - (p.at || 0) > 30 * 24 * 3600 * 1000) return null;
    return p.v;
  } catch { return null; }
}
export function clearDraft(name) {
  try { localStorage.removeItem(DRAFT_PREFIX + name); } catch {}
}

// --------- État connexion ---------
const _listeners = new Set();
export function onNetworkChange(cb) { _listeners.add(cb); return () => _listeners.delete(cb); }
window.addEventListener('online', () => _listeners.forEach((cb) => cb(true)));
window.addEventListener('offline', () => _listeners.forEach((cb) => cb(false)));

export default { enqueueAction, pendingCount, flushQueue, saveDraft, loadDraft, clearDraft, onNetworkChange };
