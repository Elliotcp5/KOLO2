# KOLO - CRM Immobilier Mobile-First PWA

## Problème Original
Application CRM mobile-first PWA pour agents immobiliers avec:
- UI dark mode style iOS avec accents violets
- Localisation FR/EN automatique
- Prix régional (9.99 EUR/GBP/USD)
- Authentification email/password avec JWT + abonnement Stripe requis
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

## Fonctionnalités Implémentées ✅
- [x] Landing page avec pricing régional
- [x] Meta tags et titres optimisés pour le partage
- [x] Page FAQ avec questions déroulantes
- [x] Auth Email/Password avec JWT
- [x] Flow abonnement Stripe avec redirection serveur
- [x] Création compte post-paiement
- [x] App 3 onglets (Today, Leads, Tasks)
- [x] CRUD Prospects complet avec boutons chip stylés
- [x] Double confirmation pour statuts "Gagné"/"Perdu"
- [x] Prospects gagnés/perdus disparaissent de la liste
- [x] Gestion tâches (manuelles + auto-générées)
- [x] Couleurs des tâches:
  - Vert: terminée
  - Orange: aujourd'hui
  - Rouge: en retard
  - Blanc: future
- [x] Complétion tâches depuis Today tab (disparition immédiate)
- [x] Complétion tâches depuis Tasks tab (vert + barré)
- [x] Génération auto tâches suivi (prospects inactifs >7j)
- [x] PWA manifest + guide installation écran d'accueil
- [x] Notifications push avec permission utilisateur
- [x] Toggle notifications dans Settings > À propos
- [x] Scheduler automatisé (intégré backend, 8h UTC)
- [x] Localisation FR/EN complète
- [x] Protection double facturation (vérifie email avant paiement)

## Endpoints Clés
- `POST /api/auth/login` - Connexion email/password
- `POST /api/auth/create-account` - Création compte post-paiement
- `GET /api/payments/checkout-redirect` - Redirection Stripe (avec vérif double facturation)
- `GET /api/tasks/today` - Tâches du jour + en retard
- `POST /api/tasks/{id}/complete` - Marquer tâche terminée
- `GET /api/prospects` - Liste prospects actifs (exclut closed/lost)
- `PUT /api/prospects/{id}` - Mise à jour statut prospect

## Schéma DB (MongoDB)
- **users**: user_id, email, password_hash, subscription_status
- **prospects**: prospect_id, user_id, full_name, status, last_activity_date
- **tasks**: task_id, prospect_id, due_date, completed, completed_at, auto_generated
- **push_subscriptions**: user_id, subscription (endpoint, keys)
- **payment_success**: email, session_id, created_at

## Tests
- Backend: 22/22 tests passés (pytest)
- Frontend: Tous les flows critiques vérifiés
- Fichier: /app/backend/tests/test_kolo_crm.py

## Credentials de Test
- Email: pressardelliot@gmail.com
- Password: Test123

## État Actuel
**Toutes les fonctionnalités P0 et P1 sont implémentées et testées**

## Backlog P2
- [ ] Supprimer la création automatique du compte hardcodé au démarrage
- [ ] Refactoriser server.py en modules (routers/, models/, services/)
- [ ] Option activer/désactiver notifications dans Settings
- [ ] Liens Stripe portal dans Settings pour gestion facturation

## Date Dernière Mise à Jour
16 février 2026
