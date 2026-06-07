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
- FastAPI backend (`/app/backend/server.py` monolithe ~7.4k lignes)
- MongoDB (motor async)
- Stripe (billing individuel + crypto + B2B per-seat), Resend (emails), Twilio + WhatsApp (calls), Emergent Universal LLM Key (Whisper STT + GPT-4.1-mini), Google Calendar OAuth, Microsoft Outlook OAuth, Emergent-managed Google Auth.

## Implemented (état Feb 2026)
### Sync Calendrier Bidirectionnelle + Notifications Push (iter 39 — Feb 2026)
**Effet "wahou"** : KOLO détecte les changements faits côté Google/Outlook sur les events qu'il a créés, met à jour les tâches automatiquement et notifie l'utilisateur.

- **Backend `_pull_calendar_changes(user_id)`** : pour chaque tâche avec `calendar_events.google` ou `.outlook`, récupère l'event distant et compare la date/existence.
  - Event déplacé sur Google/Outlook → met à jour `task.due_date` + crée notif `task_moved`.
  - Event supprimé → marque tâche `completed=true` + notif `task_deleted_external`.
- **Endpoint `POST /api/integrations/calendar-pull`** (throttled 30s/user).
- **Endpoints notifications** : `GET /api/notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`.
- **Frontend `NotificationBell`** : bell icon dans header avec badge unread count, dropdown élégant (icônes coloriées par type), toast push si nouvelle notif, polling pull+fetch toutes les 90s.

### Refonte UX Tâches Mobile + Connexions Perso (iter 38 — Feb 2026)
**Confirmation critique** : Calendrier & WhatsApp sont des **intégrations PERSO par agent**, jamais par réseau. Chaque agent connecte SON compte Google/Outlook/WhatsApp.

- **Boutons d'action tâche refondus** (mobile-first) :
  - 1 seul bouton primaire contextuel selon `task_type` : Call (`tel:`), SMS (`sms:`), Email (`mailto:`), Visite (Google Maps)
  - 1 bouton WhatsApp (rond vert) — ouvre une **action sheet bottom** : "Générer avec IA" (gradient) + "Écrire à la main" + Cancel
  - Suppression : Calendar, Mail standalone, Sparkles standalone
- **Sync calendrier auto invisible** : déjà câblé backend (`_sync_task_to_calendar`) sur create/update/done
- **Onboarding `PermissionsStep` refondu** : 3 cards explicites — Google Calendar / Outlook Calendar / "Je ne souhaite pas connecter"
- **Section "Mes connexions" dans Profile** (`MyConnectionsCard`) : 3 rangs avec Connect/Disconnect Google + Outlook + WhatsApp (modal numéro)
- **Hero brandé gradient** quand `userOrg` (aligne rendu réel sur mockup iPhone marketing)
- Nouvel endpoint backend `GET /api/integrations/my-status` (état per-user)
- **Facture B2B** : déjà sans Stripe (Virement + PDF uniquement)

### Mode "Dieu" Super Admin (iter 36 — Feb 2026)
- Le Super Admin (`elliot.cohenpressard@trykolo.io`) n'est **rattaché à aucune organisation** en base (`users.org_id = null`).
- Accès à n'importe quel espace réseau via `/org?org_id=XXX` (god mode).
- `_require_org_member` bypasse les checks 403 pour les super admins (`is_super_admin_email`).
- `/api/orgs/me?org_id=X` retourne l'org demandée avec `role="super_admin"` et `is_god_mode=true`.
- UI : Bouton **« Voir l'espace »** (badge violet) sur chaque carte de `WhiteLabelList`.
- UI : Banner **« MODE SUPER ADMIN · PILOTAGE »** dans la sidebar quand god mode actif.
- UI : Sidebar footer affiche **« Retour Admin »** (redirige vers `/kolo-admin`) au lieu de « Retour à l'app ».

### Auth & Comptes
- Email/password + Google direct OAuth (no intermediary), Reset Password flow.
- Super Admin hardcoded fallback (`elliot.cohenpressard@trykolo.io` / `Psychologue75007%!`) avec `lifetime_access=true` + plan `pro_plus`.
- Apple Sign-In : placeholders (`APPLE_SIGNIN_ENABLED=false`).

### Pipeline Prospect
- Statuts : **nouveau → contacté → qualifié → offre → offre_acceptée → signé → perdu**.
- `Marquer comme vendu` : modale demande **commission initiale (prévue)** + **commission finale (perçue)**.

### Communication
- ProspectCommsPanel : Call/WhatsApp/Calendar boutons + historique unifié, transcription Whisper.
- **Today task list** : 4 boutons quick-action (Call, WhatsApp, Email, Calendar) toujours visibles inline.

### Calendrier
- Google Calendar + Microsoft Outlook auth-url, événements, sync bidirectionnelle Tâches ↔ Calendar.

### Marque Blanche complète (iter 32 — 4 lots)
- **Lot 1 — Branding partout** : `OrgContext` charge `/api/orgs/me` au boot, injecte CSS vars (`--brand-primary/secondary/gradient/font/logo-url`) sur `<html>`. AppShell affiche le logo de l'org dans le header (`data-testid=appshell-org-logo`).
- **Lot 2 — Funnel inscription brandé** : `/register?org=slug` et `/login?org=slug` chargent `/api/orgs/public/{slug}` (no auth) et affichent logo + tagline « X powered by KOLO ». Détection automatique aussi via sous-domaine.
- **Lot 3 — Facturation B2B Stripe** : champs `seats`, `seats_used`, `monthly_price_per_seat_eur`, `billing_status` sur org. Endpoints :
  - `GET /api/orgs/{id}/billing` → seats utilisés / restants + coût mensuel
  - `POST /api/orgs/{id}/billing/checkout` → Stripe Subscription Checkout (price_data × quantity=seats)
  - `POST /api/orgs/accept-invite/{token}` enforce les sièges → 402 « Toutes les places sont occupées (X/Y) »
  - OrgSpace nouveau onglet « Facturation » (BillingTab) avec progress bar sièges + bouton « Payer avec Stripe »
- **Lot 4 — Sous-domaine custom** : champ `custom_subdomain` sur les orgs. `GET /api/orgs/by-domain` (lit le Host header) + `GET /api/orgs/public/{slug-or-subdomain}` ($or query). WhiteLabelTab capture `wl-subdomain` lors de la création.

### AI Wizard White-Label
- POST `/api/admin/whitelabel/scan` (LLM scrape → couleurs, logo, sector, tagline, pitch).
- POST `/api/admin/whitelabel/create` (instance + invite + sous-domaine + tarif).
- Aperçu inscription brandée en 1 clic depuis le wizard (`wl-preview-brand` ouvre `/register?org=slug`).

### Rapports automatiques
- Helper `_send_weekly_report_for_user(user_id)` + scheduler background (Monday 8h UTC).
- Email HTML pointe vers `${FRONTEND_URL}/app` = `https://trykolo.io/app`.

### Onboarding
- 6 étapes (Welcome → How → **Permissions** → Import → Theme → Ready).
- Step 3 Permissions premium : 3 cartes (Mic/Calendar/Notif) + Shield/privacy notice.

### IA
- ProspectScoreRing + IA Suggested Task (modale glassmorphism).
- VoiceDictateButton (Whisper) intégré dans toutes les textareas.

### i18n
- FR/EN/DE/IT pour OnboardingFlow, SocialAuthButtons, ProspectCommsPanel, MarkAsSoldButton.

## Backlog (prioritized)
### P1
- Apple Sign-In réel (clé dev disponible `460ed08b...`).
- Refactor monolithe `server.py` → `routes/whitelabel.py`, `routes/billing.py`, `routes/reports.py`.
- Passe i18n exhaustive (textes FR encore hardcodés).
- Whitelist `success_url/cancel_url` pour `OrgBillingCheckoutPayload` (sécurité Stripe redirect).
- Renommer `monthly_price_per_seat_eur` → `monthly_price_per_seat_cents` (noms cohérents avec les valeurs).

### P2
- Race condition seats_used (concurrent accept-invite) — verrou ou transaction.
- Rate-limit Resend pour le scheduler hebdo lors du scaling > 100 PRO+.
- Enum strict `Literal[...]` pour `UpdateProspectRequest.status`.
- Source unique pour `PROSPECT_STATUSES` (actuellement dupliqué dans `AppShell.js`).
- Apple Calendar (CaldAV).

## Testing checkpoints
- iter 28: i18n + integrations
- iter 29: divider bug + locale persistence
- iter 30: whitelabel + scheduler + super-admin pro+ + permissions step
- iter 31: weekly URL + dual commission + offre_acceptee + scheduler refactor
- iter 32: 4 lots marque blanche (branding partout + funnel brandé + billing B2B + sous-domaine)
- iter 36: Mode "Dieu" Super Admin (validé visuellement — bouton Voir l'espace + banner + permissions admin OK)
- iter 37: Carrousel iPhone live dans wizard marque blanche (3 mockups brandés temps réel — validé visuellement)

## Critical info
- **Réponse FR exclusive** dans toutes les interactions agent.
- **REACT_APP_BACKEND_URL** (preview) = `https://responsive-kolo.preview.emergentagent.com`
- **FRONTEND_URL** (prod) = `https://trykolo.io`
- Le scheduler tourne dans un thread async daemon initialisé au startup FastAPI.
- L'org de test `iad-demo` (custom_subdomain=`iad`) ne doit pas être supprimée — fixture de branding pour les tests UI.
er + super-admin pro+ + permissions step
- iter 31: weekly URL + dual commission + offre_acceptee + scheduler refactor
- iter 32: 4 lots marque blanche (branding partout + funnel brandé + billing B2B + sous-domaine)
- iter 36: Mode "Dieu" Super Admin (validé visuellement — bouton Voir l'espace + banner + permissions admin OK)

## Critical info
- **Réponse FR exclusive** dans toutes les interactions agent.
- **REACT_APP_BACKEND_URL** (preview) = `https://responsive-kolo.preview.emergentagent.com`
- **FRONTEND_URL** (prod) = `https://trykolo.io`
- Le scheduler tourne dans un thread async daemon initialisé au startup FastAPI.
- L'org de test `iad-demo` (custom_subdomain=`iad`) ne doit pas être supprimée — fixture de branding pour les tests UI.
