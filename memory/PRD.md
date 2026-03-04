# KOLO - CRM Immobilier Mobile-First PWA

## Problème Original
Application CRM mobile-first PWA pour agents immobiliers avec:
- UI dark mode style iOS avec accents gradient rose-violet
- Localisation FR/EN automatique
- Prix régional (9.99 EUR/GBP/USD)
- Authentification email/password avec Bearer Token
- Essai gratuit 7 jours SANS carte bancaire
- Gestion prospects et tâches avec suivi automatique
- Notifications push pour rappels quotidiens
- **Assistant IA** : scoring, génération de messages, suggestions
- **SMS bidirectionnels** : envoi + réception des réponses

## Architecture
```
/app/
├── backend/          # FastAPI + MongoDB
│   ├── server.py     # API principale
│   └── .env          # Config (Stripe, VAPID, Brevo, Resend)
└── frontend/         # React PWA
    ├── src/pages/    # Landing, Login, Register, AppShell, FAQ
    ├── src/i18n/     # Traductions FR/EN
    └── public/       # manifest.json, sw.js
```

## Fonctionnalités Complètes

### ✅ Authentification & Inscription
- Nom complet obligatoire (expéditeur SMS)
- Numéro avec sélecteur de pays (🇫🇷🇺🇸🇬🇧🇩🇪...)
- Modification nom/téléphone dans paramètres
- Mot de passe oublié via Resend

### ✅ Prospects & IA
- CRUD complet
- Scoring automatique IA (🟢🟠🔴)
- Modification manuelle du score
- Historique SMS par prospect

### ✅ SMS Bidirectionnels
- Génération de messages IA personnalisés
- Envoi SMS via Brevo (nom agent = expéditeur)
- **Réception des réponses** via webhook Brevo
- Conversation style iMessage/WhatsApp

### ✅ Landing & FAQ Actualisées
- 3 cards : Tâches du Jour, Rappels Intelligents, **Assistant IA**
- FAQ avec 5 questions sur l'IA et les SMS

## Webhook Brevo SMS

### Configuration
Pour recevoir les réponses SMS dans KOLO :
1. Connectez-vous à app.brevo.com
2. Allez dans Settings > Webhooks
3. Créez un webhook :
   - **URL** : `{votre-url}/api/webhooks/brevo-sms`
   - **Events** : reply
   - **Type** : Transactional SMS
4. Activez le webhook

### Endpoint
- `POST /api/webhooks/brevo-sms` - Reçoit les réponses (pas d'auth)
- `GET /api/webhooks/brevo-sms/setup-info` - Infos de configuration

## Schéma SMS History
```json
{
  "sms_history": [
    {
      "id": "sms_xxx",
      "sent_at": "...",
      "message": "Bonjour !",
      "sender_name": "Marie Dupont",
      "type": "sent"  // ou absent = sent
    },
    {
      "id": "sms_reply_xxx",
      "received_at": "...",
      "message": "Oui, je suis intéressé",
      "type": "received"
    }
  ]
}
```

## État Actuel (4 mars 2026)

### Complété :
1. ✅ Webhook Brevo pour réception des réponses SMS
2. ✅ Interface conversation SMS (style iMessage)
3. ✅ Landing page : 3 cards actualisées
4. ✅ FAQ : 5 questions sur l'IA et les SMS
5. ✅ Sélecteur de pays pour le téléphone

### Tests effectués :
- ✅ Webhook reçoit et stocke les réponses
- ✅ Conversation SMS affiche envoyés/reçus
- ✅ Landing et FAQ mises à jour visuellement

## Backlog

### P1 - Prioritaire
- [ ] Configurer le webhook dans Brevo (côté client)
- [ ] Déploiement en production

### P2 - À faire
- [ ] Refactoring server.py en modules
- [ ] Notifications push en production

### P3 - Backlog
- [ ] Export CSV prospects
- [ ] Statistiques de conversion

## Date Mise à Jour
4 mars 2026
