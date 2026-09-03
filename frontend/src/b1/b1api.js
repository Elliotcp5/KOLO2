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

// --- C2 Dictée (audio → transcription + propositions)
export const postDictee = async (dossierId, sectionId, audioBlob, clientKey) => {
  const fd = new FormData();
  fd.append('file', audioBlob, `dictee.${(audioBlob.type || 'audio/webm').split('/')[1] || 'webm'}`);
  fd.append('client_key', clientKey);
  const token = localStorage.getItem('kolo_v2_session') || localStorage.getItem('kolo_token') || '';
  const r = await fetch(`${API}/api/dossiers/${encodeURIComponent(dossierId)}/dictee/${sectionId}`,
    { method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`HTTP ${r.status}: ${err}`);
  }
  return r.json();
};

// --- Assistant KOLO
export const getAssistantStatus = () => req('/api/assistant/status');
export const listConversations = () => req('/api/conversations');
export const getConversation = (id) => req(`/api/conversations/${encodeURIComponent(id)}`);
export const deleteConversation = (id) => req(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });

// --- D1 · Agences, invitations, écrans directeur ---------------------------
// Conformité Apple : aucun de ces endpoints n'expose de montant ni d'URL
// de paiement web. La création d'organisation n'est PAS exposée à l'iOS.
export const getMyOrganisation = () => req('/api/d1/organisations/me');
export const patchMyOrganisation = (payload) =>
  req('/api/d1/organisations/me', { method: 'PATCH', body: payload });

export const listInvitations = () => req('/api/d1/invitations');
export const createInvitation = (email) =>
  req('/api/d1/invitations', { method: 'POST', body: { email } });
export const relancerInvitation = (id) =>
  req(`/api/d1/invitations/${encodeURIComponent(id)}/relancer`, { method: 'POST' });
export const annulerInvitation = (id) =>
  req(`/api/d1/invitations/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const checkInvitation = (email) =>
  req(`/api/d1/invitations/check?email=${encodeURIComponent(email)}`, { auth: false });

export const getEquipe = (periode = 'mois') =>
  req(`/api/d1/equipe?periode=${encodeURIComponent(periode)}`);
export const retirerConseiller = (userId) =>
  req(`/api/d1/equipe/${encodeURIComponent(userId)}`, { method: 'DELETE' });

export const attribuerOpportunite = (oppId, userId) =>
  req(`/api/d1/opportunites/${encodeURIComponent(oppId)}/attribuer`,
    { method: 'POST', body: { user_id: userId } });
export const attribuerLot = (opportuniteIds, userId) =>
  req('/api/d1/opportunites/attribuer-lot',
    { method: 'POST', body: { opportunite_ids: opportuniteIds, user_id: userId } });
export const autoResteRepartir = () =>
  req('/api/d1/opportunites/auto-reste', { method: 'POST' });
export const retirerAttribution = (oppId) =>
  req(`/api/d1/opportunites/${encodeURIComponent(oppId)}/retirer`, { method: 'POST' });

export const streamChat = async ({ message, conversation_id, context, onDelta, onMeta, onError, onDone }) => {
  const token = localStorage.getItem('kolo_v2_session') || localStorage.getItem('kolo_token') || '';
  const r = await fetch(`${API}/api/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ message, conversation_id, context }),
  });
  if (r.status === 403) { onError && onError({ code: 'plan_insuffisant', status: 403 }); return; }
  if (r.status === 429) { onError && onError({ code: 'plafond_atteint', status: 429 }); return; }
  if (!r.ok) { onError && onError({ status: r.status }); return; }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
      if (!chunk.startsWith('data:')) continue;
      try {
        const data = JSON.parse(chunk.slice(5).trim());
        if (data.delta) onDelta && onDelta(data.delta);
        else if (data.conversation_id) onMeta && onMeta(data);
        else if (data.error) onError && onError(data);
        else if (data.done) onDone && onDone();
      } catch { /* ignore parse */ }
    }
  }
  onDone && onDone();
};

// --- D1 · Bascule V2→B1 + reprise ---
export const getSuggestionsZones = () => req('/api/d1/onboarding-b1/suggestions');
export const confirmerZones = (codes_postaux) =>
  req('/api/d1/onboarding-b1/confirmer-zones', { method: 'POST', body: { codes_postaux } });

// --- Opportunités du jour (swipe) ---
export const getOpportunitesDuJour = (limit = 5) =>
  req(`/api/opportunites/du-jour?limit=${limit}`);
// Swipe unifié — POST /api/opportunites/{id}/swipe {sens: "droite"|"gauche"}
export const swipeOpportunite = (id, sens) =>
  req(`/api/opportunites/${encodeURIComponent(id)}/swipe`, { method: 'POST', body: { sens } });
// Swipe droite → statut `a_demarcher` (apparaît dans « Mes opportunités de mandats »)
export const marquerADemarcher = (id) =>
  req(`/api/opportunites/${encodeURIComponent(id)}/marquer-a-demarcher`, { method: 'POST' });
// Legacy — même endpoint. À garder pour compat.
export const accepterOpportunite = marquerADemarcher;
export const rejeterOpportunite = (id) =>
  req(`/api/opportunites/${encodeURIComponent(id)}/rejeter`, { method: 'POST' });

export const b1api = {
  getVille, postProfil, postZones, postPlan, postTermine,
  getQuotas, getProfil, patchProfil, patchZones, deleteMe,
  verifyAppleReceipt,
  postEstimation, getEstimations, getEstimation, geocoderAdresse,
  postDossier, getDossiers, getDossier, patchDossier,
  startDossierPdf, getDossierPdfJob, cancelDossierPdfJob, dossierPdfUrl,
  postDictee,
  getAssistantStatus, listConversations, getConversation, deleteConversation, streamChat,
  // D1
  getMyOrganisation, patchMyOrganisation,
  listInvitations, createInvitation, relancerInvitation, annulerInvitation, checkInvitation,
  getEquipe, retirerConseiller,
  attribuerOpportunite, attribuerLot, autoResteRepartir, retirerAttribution,
  getSuggestionsZones, confirmerZones,
  // Opportunités
  getOpportunitesDuJour, swipeOpportunite, marquerADemarcher, accepterOpportunite, rejeterOpportunite,
};
export default b1api;
