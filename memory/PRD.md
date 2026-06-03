# KOLO – Product Requirements (PRD)

## Vision
SaaS pour agents immobiliers + CRM IA. Web (Stripe) + iOS natif (Apple StoreKit 2). Multilingue. Pivot B2B / marque blanche pour réseaux d'agences. **Modèle "native first" : chaque agent utilise son propre téléphone et son propre WhatsApp — KOLO ne s'interpose jamais.**

## Architecture
- Frontend: React + Capacitor (iOS native)
- Backend: FastAPI monolithique (`/app/backend/server.py`) + MongoDB
- Paiements: Stripe (web) + Apple StoreKit 2 (iOS)
- Production: https://trykolo.io · Preview: https://responsive-kolo.preview.emergentagent.com

## Auth providers
- Email + password
- Google Sign-In (Emergent OAuth) — sur `/login` et `/register`
- Apple Sign-In Web — bouton placeholder "Bientôt disponible" (guide dans `/app/memory/guide_apple_signin.md`)

## Espaces / Routes
- `/` — Landing avec animation premium (mesh gradient subtil 28s)
- `/business` — Lead capture B2B
- `/login`, `/register` — Auth multi-providers
- `/app/**` — CRM agent standard
- `/kolo-admin` — **Super Admin KOLO** (allowlist email)
- `/org` — **Espace Organisation** (marque blanche multi-tenant)
- `/org/join/:token` — Acceptation d'invitation
- `/integrations` — Branchements natifs + Whisper + Google Calendar

## Phase 1 — Super Admin + Multi-Auth (DONE — Juin 2026, tested 18/18 backend + 9/9 frontend)

## Phase 2 — Marque Blanche multi-tenant (DONE — Juin 2026, tested 24/24 backend)
- Collection `organizations` + rôles `org_admin`/`org_agent` + scoping data
- 11 endpoints `/api/orgs/*` + super admin bypass
- Page `/org` : sidebar, modal création, theming, équipe (invite/remove), KPIs par agent, Dataroom

## Phase 3 — Intégrations "native first" (DONE — Juin 2026) ⭐ MODIFIÉ
**Modèle : l'agent utilise son propre téléphone. KOLO log juste l'activité.**
- ✅ **Appels natifs** — `tel:+33XXX` deep link → ouvre le dialer iPhone/Android/Mac. Endpoint `POST /api/integrations/calls/log` pour enregistrer durée + notes après l'appel.
- ✅ **WhatsApp natif** — `https://wa.me/XXX?text=...` deep link → ouvre WhatsApp avec le numéro de l'agent. Endpoint `POST /api/integrations/whatsapp/log`.
- ✅ **Transcription Whisper** — `POST /api/integrations/transcribe-upload` (multipart/form-data) → upload mp3/m4a/wav (max 25 Mo) → transcript FR via Emergent LLM Key.
- ✅ **Google Calendar** — OAuth2 complet (auth-url → callback → refresh tokens), list + create events. Requiert `GOOGLE_CAL_CLIENT_ID/SECRET` (guide dans `/app/memory/guide_google_calendar.md`).
- 🟡 **Outlook + Apple Calendar** — placeholders UI "Bientôt disponible"
- 🟡 **Twilio Voice/WhatsApp avancé** (recording auto + webhook) — code conservé pour les users qui voudraient activer ces modes optionnels via `TWILIO_FROM_NUMBER` / `TWILIO_WHATSAPP_FROM`

## Phase 4 — Polish (DONE)
- ✅ Animation mesh gradient premium sur Landing
- 🟢 Refacto `server.py` — reporté (P2 backlog)

## Twilio (configuré, mode "avancé optionnel")
Le compte Twilio d'Elliot est connecté dans `backend/.env` :
- `TWILIO_ACCOUNT_SID=ACe53a773c2ac5c2a7dcf500207efd7eec`
- `TWILIO_API_KEY_SID=SK26774d0724c35a58d2b1be92b567521a`
- `TWILIO_API_KEY_SECRET=XFxH2t2lYFq6Tni9JxWb3lwZWiwxWT6z`

**Non utilisé en mode natif** mais disponible si on veut un jour activer le recording auto (chaque agent devrait alors vérifier son numéro via Verified Caller ID).

## P2 Backlog technique
- Bouton "Appeler" + "WhatsApp" directement sur la fiche prospect (dans `/app`)
- Sync Outlook (MS Graph) + Apple Calendar (CalDAV)
- Notification email/Resend après invite org acceptée
- Refacto `server.py` en routers modulaires
- Fix wrapping `<tr>` cosmétique dans tables admin
- LoginPage/RegisterPage : remplacer `https://trykolo.io` hardcodé par `API_URL`

## Comptes test
Voir `/app/memory/test_credentials.md`

## Documents
- `/app/memory/guide_apple_signin.md` — Guide pas-à-pas Apple Sign-In Web
- `/app/memory/guide_google_calendar.md` — Guide pas-à-pas Google Calendar API
- `/app/auth_testing.md` — Playbook tests auth
- `/app/test_reports/iteration_26.json` & `iteration_27.json`
