// KOLO — B3 : helper de traçage (POST /api/events).
// 18 événements front + params typés. Silencieux si non authentifié.

const API = process.env.REACT_APP_BACKEND_URL;

function _token() {
  try { return localStorage.getItem('kolo_v2_session') || localStorage.getItem('kolo_token') || ''; } catch { return ''; }
}

const _pending = [];
let _flushing = false;

async function _post(nom, params) {
  const t = _token();
  try {
    await fetch(`${API}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ nom, params, date: new Date().toISOString() }),
      keepalive: true,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Émet un événement. Best-effort, retry offline via _pending.
 */
export async function track(nom, params = {}) {
  if (!navigator.onLine) {
    _pending.push({ nom, params, at: Date.now() });
    _persistPending();
    return;
  }
  const ok = await _post(nom, params);
  if (!ok) {
    _pending.push({ nom, params, at: Date.now() });
    _persistPending();
  }
}

function _persistPending() {
  try { localStorage.setItem('kolo_events_pending', JSON.stringify(_pending)); } catch {}
}
function _loadPending() {
  try {
    const raw = localStorage.getItem('kolo_events_pending');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) _pending.push(...arr);
    }
  } catch {}
}
_loadPending();

export async function flushPending() {
  if (_flushing) return;
  _flushing = true;
  while (_pending.length) {
    const e = _pending[0];
    const ok = await _post(e.nom, e.params);
    if (!ok) break;
    _pending.shift();
    _persistPending();
  }
  _flushing = false;
}

window.addEventListener('online', flushPending);
if (navigator.onLine) setTimeout(flushPending, 2000);

/**
 * Liste canonique des 18 événements (référence, à ne pas modifier sans notice).
 */
export const EVENTS = Object.freeze({
  ONBOARDING_DEBUT: 'onboarding_debut',
  ZONES_VALIDEES: 'zones_validees',
  ZONE_NON_COUVERTE: 'zone_non_couverte',
  PAYWALL_AFFICHE: 'paywall_affiche',
  PLAN_CHOISI: 'plan_choisi',
  TOUR_GUIDE_TERMINE: 'tour_guide_termine',
  TOUR_GUIDE_PASSE: 'tour_guide_passe',
  PREMIER_SWIPE: 'premier_swipe',
  SWIPE: 'swipe',
  STATUT_CHANGE: 'statut_change',
  SIGNALEMENT_DEJA_EN_VENTE: 'signalement_deja_en_vente',
  ESTIMATION_LANCEE: 'estimation_lancee',
  ESTIMATION_AFFICHEE: 'estimation_affichee',
  DOSSIER_CREE: 'dossier_cree',
  PDF_GENERE: 'pdf_genere',
  PDF_ENVOYE: 'pdf_envoye',
  QUOTA_ATTEINT: 'quota_atteint',
  UPGRADE_DEPUIS_QUOTA: 'upgrade_depuis_quota',
});

export default { track, flushPending, EVENTS };
