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

## État Actuel (10 mars 2026)

### Complété :
1. ✅ Webhook Brevo pour réception des réponses SMS
2. ✅ Interface conversation SMS (style iMessage)
3. ✅ Landing page : 3 cards actualisées
4. ✅ FAQ : 5 questions sur l'IA et les SMS
5. ✅ Sélecteur de pays pour le téléphone
6. ✅ **Bug langue corrigé** : Le choix FR/EN sur la landing persiste dans toute l'app
7. ✅ **Label "Expéditeur SMS" supprimé** dans les paramètres profil
8. ✅ **Messages d'erreur SMS améliorés** : guide l'utilisateur vers les paramètres
9. ✅ **UI MINIMALISTE** : Interface complètement refactorisée
   - Variables CSS simplifiées (moins de gradients)
   - Boutons avec coins moins arrondis, couleurs unies
   - Cartes plus compactes et légères
   - Inputs plus fins et subtils
   - Modals redesignés

### ✅ Refonte UX majeure (10 mars 2026) - Navigation et design :
1. ✅ **Navigation symétrique** : Today | **[FAB +]** | Prospects
   - FAB parfaitement centré avec gradient rose/violet
   - Accès direct à Today et Prospects en 1 clic
2. ✅ **Nouvelle couleur d'accent** : Gradient rose/magenta (#D946EF → #EC4899) 
   - Remplace le violet pur
   - Cohérent avec le bouton FAB
3. ✅ **Modal d'ajout rapide** : Bottom sheet épuré (nom + téléphone)
4. ✅ **Swipe fluide** : Seuil à 50px, animation verte propre
5. ✅ **Couleurs de tâches** : Plus de superposition, fond de swipe vert uniforme
6. ✅ **IA optimisée** : Prompt réduit, ~3-4s de réponse

### ✅ Icônes et boutons contextuels par type de tâche :
- **Call** : Icône téléphone + bouton d'appel rapide
- **SMS** : Icône message + bouton IA sparkle
- **Email** : Icône email + bouton mail
- **Visit/Administrative** : Icône seule, PAS de bouton d'action

### ✅ Gestion des Tâches Complétées (10 mars 2026) :
1. ✅ **Tâches complétées en vert dans "All Tasks"** :
   - Bordure verte à gauche (3px solid)
   - Checkmark vert à côté du titre
   - Titre barré en vert
   - Badge "(Done)" / "(Fait)" en vert
   - Opacité réduite (0.7)
   - Limité aux 10 dernières tâches complétées
2. ✅ **Tâches complétées PAS dans "Today"** :
   - Les tâches swipées comme "done" disparaissent de la vue Today
   - Elles apparaissent uniquement dans la vue All Tasks
3. ✅ **Swipe désactivé pour tâches complétées** :
   - Pas de background de swipe pour les tâches terminées
   - Boutons d'action masqués
4. ✅ **Bug P0 investigué** : Les tâches en retard s'affichent bien dans Today

### Tests effectués :
- ✅ Webhook reçoit et stocke les réponses
- ✅ Conversation SMS affiche envoyés/reçus
- ✅ Landing et FAQ mises à jour visuellement
- ✅ Changement de langue FR/EN sur landing + persistence après navigation
- ✅ Endpoint SMS retourne erreurs claires en français
- ✅ UI minimaliste validée visuellement
- ✅ **8 fonctionnalités UX testées (100% pass rate)** - iteration_9.json
- ✅ **8 fonctionnalités tâches complétées testées (100% pass rate)** - iteration_10.json
- ✅ **Traductions FR/EN complètes** sur toutes les pages (Landing, Login, Register, Subscribe, App)
- ✅ **Message d'erreur clair** quand un email existe déjà : "Un compte existe déjà avec cet email. Connectez-vous plutôt !"

## Note importante sur l'envoi SMS
Pour que l'envoi SMS fonctionne, l'utilisateur DOIT avoir configuré :
- Son **nom** dans Paramètres > Profil 
- Son **téléphone** dans Paramètres > Profil

Sans ces informations, l'API retourne une erreur claire guidant vers les paramètres.

## Backlog

### P1 - Prioritaire
- [x] Simplification UI (rendu moins "lourd") - **FAIT**
- [x] Refonte UX majeure (7 points utilisateur) - **FAIT (9 mars 2026)**
- [x] Gestion des tâches complétées (vert dans All Tasks) - **FAIT (10 mars 2026)**
- [ ] Configurer le webhook dans Brevo (côté client)
- [ ] Déploiement en production

### P2 - À faire
- [ ] Refactoring server.py en modules (backend monolithique ~3200 lignes)
  - Models extraits dans /app/backend/models/ (démarré)
  - Routes à extraire: auth, payments, tasks, prospects, webhooks
- [ ] Notifications push en production
- [ ] Captures d'écran du flow "essai expiré"

### P3 - Backlog
- [ ] Export CSV prospects
- [ ] Statistiques de conversion
- [ ] Refactoring de AppShell.js (composant long ~4200 lignes)

## Date Mise à Jour
10 mars 2026
