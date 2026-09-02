// KOLO — BLOC B1 API client (reuses V2 session token).
// All requests hit REACT_APP_BACKEND_URL + `/api/...`.

const API = process.env.REACT_APP_BACKEND_URL;
export { API };

const readToken = () => {
  try {
    return (
      localStorage.getItem('kolo_v2_session') ||
      localStorage.getItem('kolo_token') ||
      localStorage.getItem('session_token') ||
      ''
    );
  } catch {
    return '';
  }
};

async function req(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const opts = { method, headers: { ...headers } };
  if (body != null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  if (auth) {
    const t = readToken();
    if (t) opts.headers['Authorization'] = `Bearer ${t}`;
  }
  const url = `${API}${path}`;
  const r = await fetch(url, opts);
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!r.ok) {
    const err = new Error(data?.detail?.code || data?.detail || `HTTP ${r.status}`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

// --- Public
export const getVille = (cp) => req(`/api/b1/ville/${encodeURIComponent(cp)}`, { auth: false });

// --- Onboarding
export const postProfil = (prenom, nom, statut_declare) =>
  req('/api/onboarding/profil', { method: 'POST', body: { prenom, nom, statut_declare } });

export const postZones = (codes_postaux) =>
  req('/api/onboarding/zones', { method: 'POST', body: { codes_postaux } });

export const postPlan = (plan) =>
  req('/api/onboarding/plan', { method: 'POST', body: { plan } });

export const postTermine = () =>
  req('/api/onboarding/termine', { method: 'POST' });

// --- /me
export const getQuotas = () => req('/api/me/quotas');
export const getProfil = () => req('/api/me/profil');
export const patchProfil = (payload) => req('/api/me/profil', { method: 'PATCH', body: payload });
export const patchZones = (codes_postaux) =>
  req('/api/me/zones', { method: 'PATCH', body: { codes_postaux } });
export const deleteMe = () => req('/api/me', { method: 'DELETE' });

// --- Apple IAP (existing endpoint /api/iap/verify-apple-receipt)
export const verifyAppleReceipt = (receipt, product_id) =>
  req('/api/iap/verify-apple-receipt', { method: 'POST', body: { receipt, product_id } });

// --- C1 Estimations (moteur déterministe DVF)
export const postEstimation = (payload) =>
  req('/api/estimations', { method: 'POST', body: payload });
export const getEstimations = () => req('/api/estimations');
export const getEstimation = (id) =>
  req(`/api/estimations/${encodeURIComponent(id)}`);
export const geocoderAdresse = (adresse, code_postal) =>
  req('/api/estimations/geocoder', { method: 'POST', body: { adresse, code_postal } });

// --- C2 Dossiers (Avis de valeur)
export const postDossier = (payload) =>
  req('/api/dossiers', { method: 'POST', body: payload });
export const getDossiers = () => req('/api/dossiers');
export const getDossier = (id) =>
  req(`/api/dossiers/${encodeURIComponent(id)}`);
export const patchDossier = (id, payload) =>
  req(`/api/dossiers/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
export const startDossierPdf = (id) =>
  req(`/api/dossiers/${encodeURIComponent(id)}/generer-pdf`, { method: 'POST' });
export const getDossierPdfJob = (dossierId, jobId) =>
  req(`/api/dossiers/${encodeURIComponent(dossierId)}/generer-pdf/${encodeURIComponent(jobId)}`);
export const cancelDossierPdfJob = (dossierId, jobId) =>
  req(`/api/dossiers/${encodeURIComponent(dossierId)}/generer-pdf/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
// URL directe (téléchargement natif ou fetch blob)
export const dossierPdfUrl = (id) =>
  `${API}/api/dossiers/${encodeURIComponent(id)}/pdf`;

export const b1api = {
  getVille, postProfil, postZones, postPlan, postTermine,
  getQuotas, getProfil, patchProfil, patchZones, deleteMe,
  verifyAppleReceipt,
  postEstimation, getEstimations, getEstimation, geocoderAdresse,
  postDossier, getDossiers, getDossier, patchDossier,
  startDossierPdf, getDossierPdfJob, cancelDossierPdfJob, dossierPdfUrl,
};
export default b1api;
