# KOLO – Product Requirements (PRD)

## Vision
SaaS pour agents immobiliers + CRM IA. Web (Stripe) + iOS natif (Apple StoreKit 2). Multilingue (fr/en/de/it). Pivot B2B / marque blanche pour réseaux d'agences.

## Architecture
- Frontend: React + Capacitor (iOS native)
- Backend: FastAPI monolithique (`/app/backend/server.py`) + MongoDB
- Paiements: Stripe (web) + Apple StoreKit 2 (iOS)
- Production: https://trykolo.io · Preview: https://responsive-kolo.preview.emergentagent.com

## Auth providers
- Email + password (existant)
- Google Sign-In (Emergent OAuth) — sur `/login` et `/register`
- Apple Sign-In Web — bouton placeholder "Bientôt disponible"

## Espaces / Routes
- `/` — Landing avec animation premium (mesh gradient 28s)
- `/business` — Lead capture B2B
- `/login`, `/register` — Auth (Google + Email + Apple soon)
- `/app/**` — App standard (CRM agent)
- `/kolo-admin` — **Super Admin KOLO** (allowlist email → KPIs globaux, leads B2B, gestion users)
- `/org` — **Espace Organisation** (marque blanche multi-tenant, vue d'ensemble / équipe / KPIs / dataroom)
- `/org/join/:token` — Acceptation d'invitation
- `/integrations` — Branchement Twilio, WhatsApp, Google Calendar, Whisper (Outlook + Apple Calendar "soon")

## Phase 1 — Super Admin + Multi-Auth (DONE — Juin 2026, 100% tested)
- Allowlist `KOLO_SUPER_ADMIN_EMAILS` hard-coded server.py
- 5 endpoints `/api/admin/check|stats|leads|users` + champ `is_super_admin` dans /auth/me
- Apple Sign-In placeholders dans backend/.env

## Phase 2 — Marque Blanche multi-tenant (DONE — Juin 2026, 100% tested backend 24/24)
- Collection `organizations` : {org_id, name, slug, primary_color, logo_url, owner_user_id, plan}
- Users ont `org_id` + `org_role` ("org_admin" ou "org_agent")
- Endpoints `/api/orgs/*`:
  - POST /orgs (create + creator devient org_admin)
  - GET /orgs/me, PATCH /orgs/{id}, GET /orgs/{id}/members
  - POST /orgs/{id}/invite, POST /orgs/accept-invite/{token}, DELETE /orgs/{id}/members/{user_id}
  - GET /orgs/{id}/kpis (par agent), POST /orgs/{id}/prospects/reassign
  - POST/GET/DELETE /orgs/{id}/dataroom (URL-based)
- Super Admin bypass : `is_super_admin_email()` court-circuite la check org_member
- Frontend `/org` : sidebar Linear-like (5 onglets), modal création, edit theming live, table membres, table KPIs avec breakdown agent

## Phase 3 — Intégrations (DONE — Juin 2026, 100% tested code + 400 graceful path)
- **Twilio Voice** — click-to-call + recording webhook → stocké dans `call_logs`
- **OpenAI Whisper** (Emergent LLM key) — transcrit l'mp3 de Twilio (français + autres)
- **WhatsApp Business** — send + receive (webhook handshake + signature Meta `X-Hub-Signature-256` vérifiée si `WHATSAPP_APP_SECRET` configuré)
- **Google Calendar** — OAuth2 complet (auth-url → callback → refresh tokens stockés en DB), list + create events
- **Outlook + Apple Calendar** — placeholders UI "Bientôt disponible"
- `GET /api/integrations/status` — retourne {configured, missing} par service → l'UI sait quoi afficher
- Tous les endpoints renvoient 400 explicite si la clé manque (jamais 500)

## Phase 4 — Polish (DONE)
- ✅ Animation premium subtile sur Landing : 3 radial-gradients mauve/rose/bleu, blur 40px, animation 28s `kolo-mesh-drift`, respect `prefers-reduced-motion`
- 🟢 Refacto `server.py` (~6200 lignes) — reporté (P2 backlog, risque de régression élevé)

## Mai 2026 (rappel — DONE)
- App iOS App Store (`6761818371`), Stripe SDK 14.x fix, App Store badge sur Landing fr/en/de/it.

## P2 Backlog technique
- Modulariser `server.py` en routers (auth, orgs, integrations, payments, admin)
- Optimiser `/api/orgs/{id}/kpis` (actuellement N+1 queries → $facet aggregation)
- Implémenter Outlook (MS Graph) + Apple Calendar (CalDAV)
- Notification email/Resend après invite acceptée
- Fix wrapping `<tr>` dans tables admin (hydration warning cosmétique)
- LoginPage/RegisterPage : passer de `https://trykolo.io` hardcodé à `API_URL` (preview ne marche qu'avec Google login)
- Email à l'invité quand invite générée (actuellement on génère seulement un lien)

## Comptes test
Voir `/app/memory/test_credentials.md`.

## Documents associés
- `/app/auth_testing.md` — Playbook tests auth + seed mongosh
- `/app/memory/CHANGELOG.md` — Historique daté
- `/app/test_reports/iteration_26.json` — Phase 1 (18/18 + 9/9)
- `/app/test_reports/iteration_27.json` — Phase 2+3+4 (24/24 + 85%)
