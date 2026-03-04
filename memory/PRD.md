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
- **Envoi SMS via Brevo depuis le nom de l'agent**

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
- [x] **Nom complet obligatoire** (utilisé comme expéditeur SMS)
- [x] **Numéro de téléphone avec sélecteur de pays** (international)
- [x] Modification nom et téléphone dans les paramètres
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
- [x] **Historique SMS discret** (badge cliquable)

### Tâches
- [x] Gestion tâches (manuelles + auto-générées)
- [x] Suggestions de tâches IA (Claude)
- [x] Création tâches avec date/heure
- [x] Vue "Aujourd'hui" et "Toutes les tâches"
- [x] Complétion avec feedback visuel

### Communication SMS
- [x] **Génération de messages IA** personnalisés
- [x] **Envoi SMS via Brevo**
- [x] **Nom de l'agent comme expéditeur** (ex: "Marie" pas "KOLO")
- [x] **Historique SMS par prospect** (modal élégant)
- [x] Copier/Régénérer le message

### Interface
- [x] PWA manifest + guide installation
- [x] Notifications push
- [x] Localisation FR/EN
- [x] Dark mode iOS-style
- [x] **Interface minimaliste et ergonomique**

## Fonctionnement des SMS

### Comment ça marche :
1. **L'agent s'inscrit** avec son nom complet et son numéro de téléphone
2. **L'IA génère un message** personnalisé pour un prospect
3. **Le SMS est envoyé via Brevo** avec le **nom de l'agent comme expéditeur**
4. **Le prospect voit** : Expéditeur "Marie" (ou le prénom de l'agent)
5. **Le prospect peut répondre** en envoyant un SMS au numéro de l'agent

### Note technique :
- Brevo utilise le nom de l'agent (max 11 caractères) comme "sender"
- Les réponses arrivent directement sur le téléphone de l'agent
- L'historique est enregistré dans la base de données

## Endpoints Clés

### Authentification
- `POST /api/auth/register` - Inscription avec nom + téléphone + indicatif pays
- `POST /api/auth/login` - Connexion
- `GET /api/auth/profile` - Profil avec nom et téléphone
- `POST /api/auth/update-phone` - Mise à jour téléphone
- `POST /api/auth/update-name` - Mise à jour nom

### Prospects
- `POST /api/prospects/{id}/generate-message` - Génération message IA
- `POST /api/prospects/{id}/send-sms` - Envoi SMS (nom agent = expéditeur)

## Schéma DB (MongoDB)

### users
```json
{
  "user_id": "user_xxx",
  "email": "...",
  "name": "Marie Dupont",        // Nom complet (expéditeur SMS)
  "phone": "+33612345678",       // Format international
  "subscription_status": "trialing|active|expired|canceled"
}
```

### prospects.sms_history
```json
{
  "id": "sms_xxx",
  "sent_at": "...",
  "message": "...",
  "sender_name": "Marie Dupont",   // Nom de l'agent
  "sender_phone": "+33612345678",  // Téléphone de l'agent
  "recipient_phone": "+33699999999",
  "status": "sent"
}
```

## État Actuel (4 mars 2026)

### Complété dans cette session :
1. ✅ **Nom complet obligatoire** à l'inscription (expéditeur SMS)
2. ✅ **Sélecteur de pays** avec drapeaux (🇫🇷 🇺🇸 🇬🇧 etc.)
3. ✅ **SMS envoyés au nom de l'agent** (pas "KOLO")
4. ✅ **Historique SMS discret** (badge + modal élégant)
5. ✅ **Interface minimaliste** et ergonomique
6. ✅ **Modification nom/téléphone** dans les paramètres

### Fonctionnement confirmé :
- ✅ Inscription avec nom + téléphone + pays → OK
- ✅ Profil affiche nom et téléphone → OK
- ✅ SMS envoyé avec nom agent comme expéditeur → OK
- ✅ Historique SMS visible dans fiche prospect → OK

## Backlog

### P1 - Prioritaire
- [ ] Déploiement final en production

### P2 - À faire
- [ ] Refactoriser server.py en modules
- [ ] Vérifier les notifications push en production

### P3 - Backlog
- [ ] Export des prospects en CSV
- [ ] Statistiques de conversion

## Date Dernière Mise à Jour
4 mars 2026
