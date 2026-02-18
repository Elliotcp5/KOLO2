# KOLO - CRM Immobilier Mobile-First PWA

## Problème Original
Application CRM mobile-first PWA pour agents immobiliers avec:
- UI dark mode style iOS avec accents violets
- Localisation FR/EN automatique
- Prix régional (9.99 EUR/GBP/USD)
- Authentification email/password avec système dual (Cookie + Bearer Token)
- Abonnement Stripe requis pour créer un compte
- Gestion prospects et tâches avec suivi automatique
- Notifications push pour rappels quotidiens

## Architecture
```
/app/
├── backend/          # FastAPI + MongoDB
│   ├── server.py     # API principale + scheduler intégré
│   ├── notification_scheduler.py  # Logique notifications
│   ├── tests/        # Tests pytest
│   └── .env          # Config (Stripe, VAPID keys)
└── frontend/         # React PWA
    ├── src/pages/    # Landing, Login, Subscribe, AppShell
    ├── src/components/  # PWAGuide, NotificationPrompt
    └── public/       # manifest.json, sw.js
```

## Système d'Authentification Dual (Cookie + Bearer Token)
**Implémenté le 17 février 2026**

Le système accepte l'authentification via:
1. **Cookie HTTP-Only** (traditionnel, via `credentials: 'include'`)
2. **Bearer Token** (stocké dans `localStorage`, envoyé dans l'en-tête `Authorization`)

### Pourquoi ce système?
- Résout les problèmes de cookies cross-domain en production
- Compatible avec tous les navigateurs et environnements
- Fallback automatique si les cookies sont bloqués

### Fichiers clés:
- `/app/backend/server.py` - `get_user_from_session()` accepte Cookie OU Bearer token (lignes 221-257)
- `/app/frontend/src/pages/AppShell.js` - `authFetch` helper ajoute le Bearer token
- `/app/frontend/src/context/AuthContext.js` - `login()` stocke le token dans localStorage

## Fonctionnalités Implémentées
- [x] Landing page avec pricing régional
- [x] Meta tags et titres optimisés pour le partage
- [x] Page FAQ avec questions déroulantes
- [x] Auth Email/Password avec JWT + système dual Cookie/Bearer Token
- [x] Flow abonnement Stripe avec redirection serveur
- [x] Création compte post-paiement
- [x] Récupération de compte pour utilisateurs ayant payé sans finaliser
- [x] App 3 onglets (Today, Prospects, Tasks)
- [x] CRUD Prospects complet avec boutons chip stylés
- [x] Double confirmation pour statuts "Gagné"/"Perdu"
- [x] Prospects gagnés/perdus disparaissent de la liste
- [x] Email obligatoire pour création de prospect
- [x] Gestion tâches (manuelles + auto-générées)
- [x] Création de tâches avec date et heure optionnelle
- [x] Liaison tâche-prospect via dropdown
- [x] Couleurs des tâches:
  - Vert: terminée
  - Orange: en retard 1-2 jours
  - Rouge: en retard > 2 jours
  - Blanc: aujourd'hui ou future
- [x] Complétion tâches depuis Today tab (disparition immédiate)
- [x] Complétion tâches depuis Tasks tab (vert + barré)
- [x] Génération auto tâches suivi (prospects inactifs >7j)
- [x] Tâches auto-générées visibles dans l'onglet "Today"
- [x] Date/heure affichées sur les cartes de tâches "Today"
- [x] PWA manifest + guide installation écran d'accueil
- [x] Notifications push avec permission utilisateur
- [x] Toggle notifications dans Settings > À propos
- [x] Scheduler automatisé (intégré backend, 8h UTC)
- [x] Localisation FR/EN complète
- [x] Protection double facturation (vérifie email avant paiement)
- [x] Mot de passe oublié / Récupération de mot de passe
- [x] Changement de mot de passe depuis les paramètres
- [x] Portail Stripe Customer pour gestion facturation
- [x] **UI Modals ergonomiques** - Icône 'X' en haut à droite + bouton 'Save' en bas

## Endpoints Clés
- `POST /api/auth/login` - Connexion email/password, retourne `token`
- `POST /api/auth/create-account` - Création compte post-paiement, retourne `token`
- `POST /api/auth/recover` - Récupération compte pour utilisateurs ayant payé, retourne `token`
- `POST /api/auth/forgot-password` - Envoi email récupération mot de passe
- `POST /api/auth/reset-password` - Réinitialisation mot de passe avec token
- `POST /api/auth/change-password` - Changement mot de passe (utilisateur connecté)
- `GET /api/auth/me` - Vérification auth (accepte Cookie OU Bearer token)
- `GET /api/payments/checkout-redirect` - Redirection Stripe
- `POST /api/billing/portal` - Génère URL portail client Stripe
- `GET /api/tasks/today` - Tâches du jour + en retard
- `GET /api/tasks` - Toutes les tâches
- `POST /api/tasks` - Création tâche (avec date/heure/prospect optionnel)
- `POST /api/tasks/{id}/complete` - Marquer tâche terminée
- `GET /api/prospects` - Liste prospects actifs (exclut closed/lost)
- `POST /api/prospects` - Création prospect (email obligatoire)
- `PUT /api/prospects/{id}` - Mise à jour statut prospect

## Schéma DB (MongoDB)
- **users**: user_id, email, password_hash, subscription_status
- **prospects**: prospect_id, user_id, full_name, status, last_activity_date
- **tasks**: task_id, prospect_id, due_date, completed, completed_at, auto_generated
- **push_subscriptions**: user_id, subscription (endpoint, keys)
- **payment_success**: email, session_id, created_at
- **user_sessions**: session_id, user_id, session_token, expires_at

## Tests
- Backend: 11/11 tests passés (pytest) - Authentification dual validée
- Frontend: Tous les flows critiques vérifiés
- Fichiers: 
  - /app/backend/tests/test_kolo_crm.py
  - /app/backend/tests/test_bearer_auth.py
  - /app/test_reports/iteration_4.json

## Credentials de Test
- Email: pressardelliot@gmail.com / Password: Test123
- Email: pressardparis@gmail.com / Password: Test123

## État Actuel
**P0: Système d'authentification dual COMPLET et TESTÉ** (17 février 2026)
- Login, logout, création de compte fonctionnent avec Bearer token
- Tous les endpoints protégés acceptent le Bearer token
- Le frontend stocke et utilise correctement le token

## Backlog
### P1 - Prioritaire
- [ ] Tester le déploiement en production pour confirmer que le problème de login est résolu
- [ ] Corriger l'erreur VAPID keys en production (notifications push)

### P2 - À faire
- [ ] Empêcher la double facturation (même email, même mois) - logique backend ajoutée, tests nécessaires
- [ ] Supprimer la création automatique des comptes hardcodés au démarrage
- [ ] Refactoriser server.py en modules (routers/, models/, services/)
- [ ] Liens Stripe portal dans Settings pour gestion facturation

## Date Dernière Mise à Jour
17 février 2026
