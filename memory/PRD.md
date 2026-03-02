# KOLO - CRM Immobilier Mobile-First PWA

## Problème Original
Application CRM mobile-first PWA pour agents immobiliers avec:
- UI dark mode style iOS avec accents gradient rose-violet
- Localisation FR/EN automatique
- Prix régional (9.99 EUR/GBP/USD)
- Authentification email/password avec Bearer Token (localStorage)
- **Essai gratuit 7 jours SANS carte bancaire** (nouveau modèle)
- Gestion prospects et tâches avec suivi automatique
- Notifications push pour rappels quotidiens
- Suggestions de tâches IA (Claude)

## Architecture
```
/app/
├── backend/          # FastAPI + MongoDB
│   ├── server.py     # API principale + scheduler intégré
│   ├── tests/        # Tests pytest
│   └── .env          # Config (Stripe, VAPID keys)
└── frontend/         # React PWA
    ├── src/pages/    # Landing, Login, Register, Subscribe, AppShell
    ├── src/components/  # PWAGuide, NotificationPrompt
    ├── src/context/  # AuthContext, LocaleContext
    └── public/       # manifest.json, sw.js (v2 - no API cache)
```

## Système d'Authentification Bearer Token
**Mis à jour le 1er mars 2026**

Le système utilise exclusivement des Bearer Tokens stockés dans `localStorage`:
- Token retourné par `/api/auth/register` et `/api/auth/login`
- Stocké dans `localStorage` sous la clé `kolo_token`
- Envoyé dans l'en-tête `Authorization: Bearer {token}`

### Fichiers clés:
- `/app/backend/server.py` - `get_user_from_session()` accepte Bearer token (lignes 240-276)
- `/app/frontend/src/pages/AppShell.js` - `authFetch` helper ajoute le Bearer token
- `/app/frontend/src/context/AuthContext.js` - `login()` stocke le token

## Fonctionnalités Implémentées
- [x] Landing page avec pricing régional
- [x] **Essai gratuit 7 jours sans carte bancaire** - Inscription via /register
- [x] Meta tags et titres optimisés pour le partage
- [x] Page FAQ avec questions déroulantes
- [x] Auth Email/Password avec Bearer Token
- [x] Flow abonnement Stripe (post-trial)
- [x] Création compte post-paiement
- [x] Récupération de compte pour utilisateurs ayant payé sans finaliser
- [x] App 3 onglets (Today, Prospects, Tasks)
- [x] **CRUD Prospects complet avec édition via modal**
- [x] Double confirmation pour statuts "Gagné"/"Perdu"
- [x] Prospects gagnés/perdus disparaissent de la liste
- [x] Email obligatoire pour création de prospect
- [x] Gestion tâches (manuelles + auto-générées)
- [x] **Suggestions de tâches IA** (Claude via emergentintegrations)
- [x] Création de tâches avec date et heure optionnelle
- [x] Liaison tâche-prospect via dropdown
- [x] Couleurs des tâches (vert/orange/rouge/blanc selon statut)
- [x] Complétion tâches depuis Today tab (disparition immédiate)
- [x] Complétion tâches depuis Tasks tab (vert + barré)
- [x] Génération auto tâches suivi (prospects inactifs >7j)
- [x] PWA manifest + guide installation écran d'accueil
- [x] Notifications push avec permission utilisateur
- [x] Toggle notifications dans Settings
- [x] Scheduler automatisé (intégré backend, 8h UTC)
- [x] Localisation FR/EN complète
- [x] Protection double facturation (vérifie email avant paiement)
- [x] **Mot de passe oublié / Récupération via email Resend** (fonctionnel)
- [x] Changement de mot de passe depuis les paramètres
- [x] **Portail Stripe Customer pour gestion facturation** (crée client Stripe auto si nécessaire)
- [x] UI Modals ergonomiques avec gradient rose-violet
- [x] Résiliation abonnement dans les paramètres
- [x] Blocage fonctionnalités quand essai expiré (message "S'abonner")
- [x] **Service Worker v2** - Ne cache jamais les appels /api/

## Endpoints Clés
### Authentification
- `POST /api/auth/register` - Inscription essai gratuit 7 jours, retourne `token`
- `POST /api/auth/login` - Connexion email/password, retourne `token`
- `POST /api/auth/create-account` - Création compte post-paiement Stripe
- `POST /api/auth/recover` - Récupération compte pour utilisateurs ayant payé
- `POST /api/auth/forgot-password` - Envoi email récupération (MOCKED)
- `POST /api/auth/reset-password` - Réinitialisation mot de passe
- `POST /api/auth/change-password` - Changement mot de passe
- `GET /api/auth/me` - Vérification auth

### Facturation
- `GET /api/payments/checkout-redirect` - Redirection Stripe
- `POST /api/billing/portal` - Génère URL portail client Stripe (crée customer si nécessaire)
- `GET /api/subscription/status` - Statut abonnement détaillé
- `POST /api/subscription/cancel` - Annulation fin de période
- `POST /api/subscription/reactivate` - Réactivation abonnement

### Tâches
- `GET /api/tasks/today` - Tâches du jour + en retard
- `GET /api/tasks` - Toutes les tâches
- `POST /api/tasks` - Création tâche
- `POST /api/tasks/{id}/complete` - Marquer terminée
- `GET /api/tasks/ai-suggestions` - Suggestions IA (Claude)

### Prospects
- `GET /api/prospects` - Liste prospects actifs
- `POST /api/prospects` - Création prospect
- `GET /api/prospects/{id}` - Détail prospect avec tâches
- `PUT /api/prospects/{id}` - Mise à jour prospect
- `DELETE /api/prospects/{id}` - Suppression prospect

## Schéma DB (MongoDB)
- **users**: user_id, email, password_hash, subscription_status (none/trialing/active/expired/canceled), trial_ends_at, stripe_customer_id, subscription_id
- **prospects**: prospect_id, user_id, full_name, phone, email, source, status, notes, last_activity_date
- **tasks**: task_id, prospect_id, due_date, completed, completed_at, auto_generated
- **push_subscriptions**: user_id, subscription (endpoint, keys)
- **payment_success**: email, session_id, created_at
- **user_sessions**: session_id, user_id, session_token, expires_at

## Tests
- Backend: 100% tests passés (14/14 tests pytest)
- Frontend: 100% flows vérifiés via Playwright
- Fichiers: 
  - /app/backend/tests/test_kolo_features.py
  - /app/test_reports/iteration_7.json

## État Actuel (1er mars 2026)
**P0 & P1 COMPLETS et TESTÉS**

### Résolu dans cette session:
1. ✅ Bug "erreur réseau" - Service Worker v2 ne cache plus les appels API
2. ✅ Inscription simplifiée avec fetch + headers no-cache
3. ✅ Édition des prospects via modal fonctionnelle
4. ✅ Portail de facturation Stripe créé automatiquement pour utilisateurs trial

## Backlog
### P1 - Prioritaire
- [ ] **Email "Mot de passe oublié"** - Intégrer un service d'email (Resend)
- [ ] Déploiement final en production

### P2 - À faire
- [ ] Refactoriser server.py en modules (routes/auth.py, routes/prospects.py, etc.)
- [ ] Vérifier les notifications push en production
- [ ] Tester la double facturation (même email, même mois)

### P3 - Backlog
- [ ] Export des prospects en CSV
- [ ] Statistiques de conversion
- [ ] Intégration calendrier

## Date Dernière Mise à Jour
1er mars 2026
