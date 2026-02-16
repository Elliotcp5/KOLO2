# KOLO - CRM Immobilier Mobile-First PWA

## Problème Original
Application CRM mobile-first PWA pour agents immobiliers avec:
- UI dark mode style iOS avec accents violets
- Localisation FR/EN automatique
- Prix régional (9.99 EUR/GBP/USD)
- Authentification via Google + abonnement Stripe requis
- Gestion prospects et tâches avec suivi automatique
- Notifications push pour rappels quotidiens

## Architecture
```
/app/
├── backend/          # FastAPI + MongoDB
│   ├── server.py     # API principale + scheduler intégré
│   ├── notification_scheduler.py  # Logique notifications
│   └── .env          # Config (Stripe, VAPID keys)
└── frontend/         # React PWA
    ├── src/pages/    # Landing, Login, Subscribe, AppShell
    ├── src/components/  # PWAGuide, NotificationPrompt
    └── public/       # manifest.json, sw.js
```

## Fonctionnalités Implémentées
- [x] Landing page avec pricing régional
- [x] Auth Google (Emergent) + flow abonnement Stripe
- [x] Création compte post-paiement
- [x] App 3 onglets (Today, Prospects, Settings)
- [x] CRUD Prospects
- [x] Gestion tâches (manuelles + auto-générées)
- [x] Complétion tâches retire de la liste Today
- [x] Génération auto tâches suivi (prospects inactifs >7j)
- [x] PWA manifest + guide installation écran d'accueil
- [x] Notifications push avec permission utilisateur
- [x] Scheduler automatisé (intégré backend, 8h UTC)
- [x] Localisation FR/EN complète

## Endpoints Clés
- `POST /api/payments/create-checkout` - Création session Stripe
- `POST /api/auth/create-account` - Création compte post-paiement
- `GET /api/tasks/today` - Tâches du jour
- `POST /api/tasks/{id}/complete` - Marquer tâche terminée
- `POST /api/notifications/subscribe` - Enregistrer push subscription
- `POST /api/notifications/trigger` - Déclencher notifications manuellement

## Schéma DB (MongoDB)
- **users**: user_id, email, subscription_status, stripe_customer_id
- **prospects**: prospect_id, user_id, full_name, status, last_activity_date
- **tasks**: task_id, prospect_id, due_date, completed, auto_generated
- **push_subscriptions**: user_id, subscription (endpoint, keys)

## État Actuel
**Prêt pour déploiement**

## Issues Connues
- Erreur Stripe 520 intermittente (environnement preview, à surveiller en prod)

## Backlog
- [ ] Option activer/désactiver notifications dans Settings
- [ ] Gestion facturation dans Settings (liens Stripe portal)
