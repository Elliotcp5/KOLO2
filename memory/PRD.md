# KOLO - Product Requirements Document

## Original Problem Statement
Application SaaS B2B « Marque Blanche » pour les commerciaux indépendants (immobilier en priorité). 
KOLO transforme le suivi commercial avec : multi-tenant org/super-admin, communication "native first" (Twilio/WhatsApp + Whisper), synchronisation calendars (Google/Apple/Outlook), IA Suggestions, Score Ring, Stripe billing, design premium startup glassmorphism, et ultra-responsive mobile/desktop.

## User Personas
1. **Agent commercial indépendant** (immobilier) — usage quotidien sur mobile : appels, suivi prospects, dictée, IA pour relancer.
2. **Super Admin KOLO (Elliot)** — gère les marques blanches B2B + supervise les utilisateurs / abonnements / leads B2B.
3. **Org Admin (réseau B2B partenaire)** — gère ses agents via une instance KOLO white-label.

## Core Stack
- React frontend (`/app/frontend`, react-router 7)
- FastAPI backend (`/app/backend/server.py` monolithe ~7.3k lignes + `/app/backend/routes/*.py`)
- MongoDB (motor async)
- Stripe (billing + crypto), Resend (emails), Twilio + WhatsApp (calls), Emergent Universal LLM Key (Whisper STT + GPT-4.1-mini), Google Calendar OAuth, Microsoft Outlook OAuth, Emergent-managed Google Auth.

## Implemented (état Feb 2026)
### Auth & Comptes
- Email/password + Google direct OAuth (no intermediary), Reset Password flow.
- Super Admin hardcoded fallback (`elliot.cohenpressard@trykolo.io` / `Psychologue75007%!`) avec `lifetime_access=true` + plan `pro_plus`.
- Apple Sign-In : placeholders (`APPLE_SIGNIN_ENABLED=false`).

### Pipeline Prospect
- Statuts : **nouveau → contacté → qualifié → offre → offre_acceptée → signé → perdu** (incl. nouveau statut `offre_acceptee` ajouté en iter 31).
- `Marquer comme vendu` : modale demande **commission initiale (prévue)** + **commission finale (perçue)**, sauvegarde les deux + commission_amount pour rétrocompat.

### Communication
- ProspectCommsPanel : Call/WhatsApp/Calendar boutons + historique unifié, transcription Whisper.
- **Today task list** : 4 boutons quick-action (Call, WhatsApp, Email, Calendar) toujours visibles inline sur les tâches liées à un prospect (P1 résolu en iter 30).

### Calendrier
- Google Calendar + Microsoft Outlook auth-url, événements, sync bidirectionnelle Tâches ↔ Calendar via `_sync_task_to_calendar` (best-effort silencieux).

### White-Label AI Wizard
- POST `/api/admin/whitelabel/scan` (LLM scrape stripe.com/iadfrance.fr → extraction logo, couleurs, sector, tagline, pitch).
- POST `/api/admin/whitelabel/create` (instance org + invite link).
- GET `/api/admin/whitelabel/list`.
- Admin Dashboard avec onglet « Marque blanche » + bouton « Retour à l'app » (`admin-back-btn`).

### Rapports automatiques
- Helper `_send_weekly_report_for_user(user_id)` (refactor iter 31, F821 fixé).
- Endpoint POST `/api/reports/weekly` + scheduler background (Monday 8h UTC) qui envoie aux users PRO+/super_admin/lifetime.
- Email HTML pointe vers `${FRONTEND_URL}/app` = `https://trykolo.io/app` (fix iter 31, plus de `kolo.app/app`).

### Onboarding
- 6 étapes (Welcome → How → **Permissions** → Import → Theme → Ready).
- Step 3 Permissions premium : 3 cartes (Mic/Calendar/Notif) avec demandes natives propres + `Shield`/privacy notice.

### IA
- ProspectScoreRing + IA Suggested Task (modale glassmorphism).
- VoiceDictateButton (Whisper) intégré dans toutes les textareas (notes, WA, agenda desc).

### i18n
- FR/EN/DE/IT pour OnboardingFlow, SocialAuthButtons, ProspectCommsPanel, MarkAsSoldButton.
- Bug iter 29 (dividerLabel hardcoded FR) corrigé.

## Backlog (prioritized)
### P1
- Apple Sign-In réel (clé dev disponible `460ed08b...`).
- Refactor monolithe `server.py` → `routes/*.py` (admin, whitelabel, reports, integrations).
- Passe i18n exhaustive (autres textes FR hardcodés).

### P2
- Rate limiting Resend pour scheduler hebdo lors de scaling > 100 users PRO+.
- Enum strict pour `UpdateProspectRequest.status` (Literal pour forward safety).
- Source unique pour `PROSPECT_STATUSES` (actuellement dupliqué dans `AppShell.js`).

## Testing checkpoints
- iter 28: i18n + integrations
- iter 29: divider bug + locale persistence
- iter 30: whitelabel + scheduler + super-admin pro+ + permissions step
- iter 31: weekly URL + dual commission + offre_acceptee + scheduler refactor

## Critical info
- **Réponse FR exclusive** dans toutes les interactions agent.
- **REACT_APP_BACKEND_URL** (preview) = `https://responsive-kolo.preview.emergentagent.com`
- **FRONTEND_URL** (prod) = `https://trykolo.io`
- Le scheduler tourne dans un thread async daemon initialisé au startup FastAPI.
