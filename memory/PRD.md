# KOLO – Product Requirements (PRD)

## Vision
SaaS pour agents immobiliers avec CRM + IA. Web (Stripe) + iOS natif (Apple StoreKit 2). Multilingue (fr/en/de/it). Pivot B2B en cours (offre marque blanche pour réseaux d'agences).

## Architecture
- Frontend: React + Capacitor (iOS native)
- Backend: FastAPI monolithique (`/app/backend/server.py`) + MongoDB
- Paiements: Stripe (web) + Apple StoreKit 2 (iOS)
- Production: https://trykolo.io
- Preview: https://responsive-kolo.preview.emergentagent.com

## Auth providers (Phase 1 — Juin 2026)
- Email + mot de passe (existant)
- Google Sign-In via Emergent OAuth (NEW) — bouton sur /login et /register
- Apple Sign-In Web : placeholder (bouton désactivé "Bientôt disponible") — placeholders d'env en place dans `backend/.env` (`APPLE_SIGNIN_CLIENT_ID`, `_TEAM_ID`, `_KEY_ID`, `_PRIVATE_KEY`, `_ENABLED=false`)

## Super Admin (Phase 1 — Juin 2026)
- Allowlist hardcoded dans `server.py → KOLO_SUPER_ADMIN_EMAILS` (actuellement `elliot.cohenpressard@trykolo.io`)
- Route React `/kolo-admin` protégée par `<SuperAdminRoute>`
- Endpoints API session-authentifiés:
  - `GET /api/admin/check` → `{is_super_admin, authenticated, email}`
  - `GET /api/admin/stats` → KPIs (users, leads, prospects, signups 7j)
  - `GET /api/admin/leads?status=...` → liste des demandes B2B
  - `PATCH /api/admin/leads/{lead_id}` → update status / notes admin
  - `GET /api/admin/users?q=&status=` → liste paginée des comptes
- UI : sidebar gauche style Linear (Vue d'ensemble / Leads B2B / Utilisateurs), tableau utilisateurs avec recherche, détail lead avec changement de statut.
- AuthCallback redirige automatiquement les super admins vers `/kolo-admin` après connexion Google.

## Mai 2026 (rappel)
- ✅ App publiée sur l'App Store iOS (ID `6761818371`)
- ✅ Bug critique Stripe SDK 14.x corrigé (sub.items → sub["items"], helper period_end)
- ✅ Self-heal Stripe ajouté dans `/api/auth/login` et `/api/auth/me`
- ✅ Bouton "Télécharger sur l'App Store" sur landing page (fr/en/de/it)

## Juin 2026 (en cours / fait)
- ✅ Refonte Landing minimaliste type Leedflow
- ✅ Page `/business` (B2B) + collection `enterprise_leads`
- ✅ Détection géo + auto-locale (Cloudflare + ipapi.co fallback)
- ✅ **Phase 1 cahier des charges B2B** (testée 100% — backend 18/18, frontend 9/9) :
  - Espace Super Admin KOLO (`/kolo-admin`)
  - Google Sign-In (Emergent Auth) sur Login + Register
  - Apple Sign-In Web (placeholder désactivé)
  - Refacto `config/api.js` : preview utilise `REACT_APP_BACKEND_URL`, iOS native garde `trykolo.io`
- 🟠 Phase 2 (À venir) : Marque blanche multi-tenant (modèles `organizations`, rôles `org_admin`/`org_agent`, scoping data, theming logo+couleur 20% modulable, dashboard manager avec KPIs et Dataroom).
- 🟡 Phase 3 (À venir) : Intégrations complexes — sync agendas Google/Outlook/Apple, appels Twilio + transcription Whisper, WhatsApp Business bidirectionnel (clés API à fournir par utilisateur, placeholders en attendant).
- 🟢 Phase 4 (À venir) : Animation fond premium sur Landing + refacto `server.py` modulaire.

## Backlog technique
- Modulariser `server.py` (5400+ lignes) en routers FastAPI dédiés (admin, payments, IAP, auth, geo).
- Décomposer `AppShell.js`.
- Fix warning console mineur sur table Users du Admin Dashboard.
- Supprimer endpoint `/api/debug/sync-status` (post-stabilisation Stripe).
- LoginPage et RegisterPage : remplacer hardcoded `https://trykolo.io` par `API_URL` pour que email/password fonctionne aussi en preview.

## Comptes test
Voir `/app/memory/test_credentials.md`.

## Documents associés
- `/app/auth_testing.md` — Playbook tests auth Google/Email + super admin
- `/app/memory/test_credentials.md` — Credentials
- `/app/memory/CHANGELOG.md` — Historique daté
- `/app/test_reports/iteration_26.json` — Rapport Phase 1
