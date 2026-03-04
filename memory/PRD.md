# KOLO - CRM Immobilier Mobile-First PWA

## Problème Original
Application CRM mobile-first PWA pour agents immobiliers avec:
- UI dark mode style iOS avec accents gradient rose-violet
- Localisation FR/EN automatique
- Prix régional (9.99 EUR/GBP/USD)
- Authentification email/password avec Bearer Token (localStorage)
- **Essai gratuit 7 jours SANS carte bancaire**
- Gestion prospects et tâches avec suivi automatique
- Notifications push pour rappels quotidiens
- Suggestions de tâches IA (Claude)
- **Scoring visuel des prospects** (🔴 froid / 🟠 tiède / 🟢 chaud)
- **Rédaction IA des messages de relance**
- **Envoi SMS via Brevo depuis le numéro de l'agent**

## Architecture
```
/app/
├── backend/          # FastAPI + MongoDB
│   ├── server.py     # API principale + scheduler intégré
│   ├── tests/        # Tests pytest
│   └── .env          # Config (Stripe, VAPID keys, Brevo, Resend)
└── frontend/         # React PWA
    ├── src/pages/    # Landing, Login, Register, Subscribe, AppShell
    ├── src/components/  # PWAGuide, NotificationPrompt
    ├── src/context/  # AuthContext, LocaleContext
    └── public/       # manifest.json, sw.js
```

## Fonctionnalités Implémentées

### Authentification & Utilisateurs
- [x] Inscription essai gratuit 7 jours sans carte bancaire
- [x] **Numéro de téléphone obligatoire à l'inscription**
- [x] Modification du numéro dans les paramètres
- [x] Auth Email/Password avec Bearer Token
- [x] Mot de passe oublié via Resend
- [x] Changement de mot de passe

### Facturation (Stripe)
- [x] Flow abonnement Stripe (post-trial)
- [x] Création client Stripe automatique à l'inscription
- [x] Portail de facturation Stripe
- [x] Résiliation abonnement

### Prospects
- [x] CRUD Prospects complet
- [x] **Scoring automatique IA** (chaud/tiède/froid)
- [x] Modification manuelle du score
- [x] Points colorés (🟢🟠🔴) sur la liste
- [x] Historique SMS par prospect

### Tâches
- [x] Gestion tâches (manuelles + auto-générées)
- [x] Suggestions de tâches IA (Claude)
- [x] Création tâches avec date/heure
- [x] Vue "Aujourd'hui" et "Toutes les tâches"
- [x] Complétion avec feedback visuel

### Communication
- [x] **Génération de messages IA** personnalisés
- [x] **Envoi SMS via Brevo**
- [x] **SMS envoyés depuis le numéro de l'agent**
- [x] Copier le message généré
- [x] Régénérer le message

### Interface
- [x] PWA manifest + guide installation
- [x] Notifications push
- [x] Localisation FR/EN
- [x] Dark mode iOS-style

## Endpoints Clés

### Authentification
- `POST /api/auth/register` - Inscription avec téléphone obligatoire
- `POST /api/auth/login` - Connexion
- `GET /api/auth/profile` - Profil utilisateur avec téléphone
- `POST /api/auth/update-phone` - Mise à jour téléphone
- `POST /api/auth/change-password` - Changement mot de passe
- `POST /api/auth/forgot-password` - Email récupération
- `POST /api/auth/reset-password` - Réinitialisation

### Prospects
- `GET /api/prospects` - Liste prospects actifs
- `POST /api/prospects` - Création prospect
- `PUT /api/prospects/{id}` - Mise à jour
- `POST /api/prospects/{id}/score` - Recalcul/forcer score
- `POST /api/prospects/{id}/generate-message` - Génération message IA
- `POST /api/prospects/{id}/send-sms` - Envoi SMS (depuis numéro agent)

### Tâches
- `GET /api/tasks/today` - Tâches du jour + en retard
- `GET /api/tasks` - Toutes les tâches
- `POST /api/tasks` - Création tâche
- `POST /api/tasks/{id}/complete` - Marquer terminée
- `GET /api/tasks/ai-suggestions` - Suggestions IA

## Schéma DB (MongoDB)

### users
```json
{
  "user_id": "user_xxx",
  "email": "...",
  "phone": "+33612345678",  // NOUVEAU - Format international
  "password_hash": "...",
  "subscription_status": "trialing|active|expired|canceled",
  "trial_ends_at": "...",
  "stripe_customer_id": "cus_xxx"
}
```

### prospects
```json
{
  "prospect_id": "prospect_xxx",
  "user_id": "user_xxx",
  "full_name": "...",
  "phone": "...",
  "email": "...",
  "score": "chaud|tiede|froid",
  "score_calculated_at": "...",
  "score_manual_override": false,
  "sms_history": [
    {
      "id": "sms_xxx",
      "sent_at": "...",
      "message": "...",
      "sender_phone": "+33612345678",  // Numéro de l'agent
      "recipient_phone": "+33699999999",
      "status": "sent"
    }
  ]
}
```

## Tests
- Backend: 14/14 tests passés (pytest)
- Frontend: Tous les flows vérifiés via Playwright
- Fichiers: `/app/backend/tests/test_phone_registration.py`

## État Actuel (4 mars 2026)

### Complété dans cette session:
1. ✅ **Numéro de téléphone obligatoire** à l'inscription
2. ✅ **Format international automatique** (+33...)
3. ✅ **SMS envoyés depuis le numéro de l'agent**
4. ✅ **Modification du téléphone** dans les paramètres
5. ✅ **Bug "Aujourd'hui"** - Tâche mise à jour pour l'utilisateur

### Note importante sur SMS Brevo:
- L'envoi SMS utilise maintenant le numéro de l'agent comme expéditeur
- Cela permet aux prospects de répondre directement à l'agent
- Nécessite des crédits SMS sur https://app.brevo.com/billing/addon/customize/sms
- Si le numéro n'est pas validé dans Brevo, une erreur explicative s'affiche

## Backlog

### P1 - Prioritaire
- [ ] Validation du numéro expéditeur dans Brevo (configuration côté Brevo)
- [ ] Déploiement final en production

### P2 - À faire
- [ ] Refactoriser server.py en modules (routes/auth.py, routes/prospects.py, etc.)
- [ ] Vérifier les notifications push en production

### P3 - Backlog
- [ ] Export des prospects en CSV
- [ ] Statistiques de conversion
- [ ] Intégration calendrier

## Date Dernière Mise à Jour
4 mars 2026
