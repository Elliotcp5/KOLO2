# KOLO – Product Requirements (PRD)

## Vision
SaaS pour agents immobiliers + CRM IA. Web (Stripe) + iOS natif (Apple StoreKit 2). Multilingue. Pivot B2B / marque blanche. **Modèle "native first" : chaque agent utilise son propre numéro et son propre WhatsApp.**

## Architecture
- Frontend: React + Capacitor (iOS native)
- Backend: FastAPI monolithique (`/app/backend/server.py`) + MongoDB
- Paiements: Stripe (web) + Apple StoreKit 2 (iOS)
- Production: https://trykolo.io · Preview: https://responsive-kolo.preview.emergentagent.com

## Auth providers
- Email + password
- Google Sign-In (Emergent OAuth) ✅
- Apple Sign-In Web : bouton placeholder (reporté à la demande de l'utilisateur)

## Espaces / Routes
- `/` Landing animée · `/business` lead B2B · `/login` `/register`
- `/app/**` CRM agent · **fiche prospect : Appeler + WhatsApp + Historique + Voir l'appel**
- `/kolo-admin` Super Admin KOLO
- `/org` Espace Organisation (marque blanche) · `/org/join/:token` accept invite
- `/integrations` Branchements (Google Calendar + Whisper + Outlook/Apple à venir)

## Phase 1 — Super Admin + Multi-Auth (DONE — 18/18 + 9/9)
## Phase 2 — Marque Blanche multi-tenant (DONE — 24/24)
## Phase 3 — Intégrations "native first" (DONE)

### ⭐ Modèle de communications (Juin 2026)
**Sur chaque fiche prospect** :
- Bouton **"Appeler"** → ouvre le dialer natif avec ton numéro (le prospect voit TON n°)
- Modal post-appel : durée + résultat (terminé/sans réponse/voicemail/occupé) + notes + **upload optionnel d'un enregistrement audio** → transcription Whisper auto attachée au call_log
- Bouton **"WhatsApp"** → modal pour rédiger + deep link `wa.me/XXX?text=...` qui ouvre WhatsApp avec ton compte
- **Section "Historique"** sur la fiche : appels + messages WhatsApp chronologiques, badge "1 appel · 1 message"
- Clic sur un appel → **modal "Détail de l'appel"** : date/durée/résultat/notes/audio player/**transcription Whisper**

### Endpoints backend
- `POST /api/integrations/calls/log` — log durée + notes
- `POST /api/integrations/whatsapp/log` — log WA envoyé
- `POST /api/integrations/transcribe-upload` — upload audio (mp3/m4a/wav, max 25 Mo) → Whisper
- `GET /api/integrations/prospect/{id}/history` — appels + WA fusionnés chronologiquement
- `GET /api/integrations/calls/{id}` — détail d'un appel
- Google Calendar OAuth complet (en attente du `GOOGLE_CAL_CLIENT_ID/SECRET`)
- Twilio Voice/WhatsApp avancé (code conservé, optionnel)

## Phase 4 — Polish (DONE)
- Animation mesh gradient sur Landing
- Composant `ProspectCommsPanel` minimaliste intégré à la fiche prospect

## Clés et credentials
- **Twilio** : SID + API Key SID + Secret dans `.env` (gardé pour le mode "avancé" optionnel)
- **Emergent LLM Key** : active (Whisper, Claude, OpenAI, Gemini)
- **Google Maps API Key** : `AIzaSyA_G8BvG2fEmnz6XSW8s44dcFIErsI1IBg` (réservée pour Places autocomplete sur les adresses prospect, plus tard)
- **Google Calendar OAuth** : à fournir (guide dans `/app/memory/guide_google_calendar.md`)
- **Apple Sign-In** : reporté

## P2 Backlog technique
- Google Maps Places autocomplete sur la fiche prospect (adresses normalisées)
- Sync Outlook (MS Graph) + Apple Calendar (CalDAV)
- Notification email/Resend après invite org acceptée
- Modulariser `server.py` (6700 lignes maintenant) en routers
- Optimiser `/api/orgs/{id}/kpis` (N+1 → aggregation $facet)

## Comptes test
Voir `/app/memory/test_credentials.md`

## Documents
- `/app/memory/guide_apple_signin.md` — Guide Apple Sign-In Web
- `/app/memory/guide_google_calendar.md` — Guide Google Calendar API
- `/app/auth_testing.md` — Playbook tests auth
- `/app/test_reports/iteration_26.json` & `iteration_27.json`
