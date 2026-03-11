# KOLO - CRM Immobilier Mobile-First PWA

## Probleme Original
Application CRM mobile-first PWA pour agents immobiliers avec:
- UI dark mode style iOS avec accents gradient rose-violet
- Localisation FR/EN automatique
- Prix regional (9.99 EUR/GBP/USD)
- Authentification email/password avec Bearer Token
- Essai gratuit 7 jours SANS carte bancaire
- Gestion prospects et taches avec suivi automatique
- Notifications push pour rappels quotidiens
- **Assistant IA** : scoring, generation de messages, suggestions
- **SMS bidirectionnels** : envoi + reception des reponses

## Architecture
```
/app/
├── backend/          # FastAPI + MongoDB
│   ├── server.py     # API principale (~2450 lignes)
│   └── .env          # Config (Stripe, VAPID, Brevo, Resend, EMERGENT_LLM_KEY)
└── frontend/         # React PWA
    ├── src/pages/    # Landing, Login, Register, AppShell, FAQ
    ├── src/i18n/     # Traductions FR/EN
    └── public/       # manifest.json, sw.js
```

## Fonctionnalites Completes

### Authentification & Inscription
- Nom complet obligatoire (expediteur SMS)
- Numero avec selecteur de pays
- Modification nom/telephone dans parametres
- Mot de passe oublie via Resend

### Prospects & IA
- CRUD complet
- Scoring automatique IA
- Modification manuelle du score
- Historique SMS par prospect
- **Barre de recherche** pour filtrer les prospects

### SMS Bidirectionnels
- Generation de messages IA personnalises (GPT-4.1-nano - rapide ~2s)
- Envoi SMS via Brevo (nom agent = expediteur)
- **Reception des reponses** via webhook Brevo
- Conversation style iMessage/WhatsApp

### Taches Manuelles
- **Creation manuelle de taches** avec modal dedie
- Types : Appel, SMS, Email, Visite, Autre
- Titre obligatoire + Date obligatoire
- Heure et adresse optionnelles
- Liaison optionnelle a un prospect existant
- Swipe pour marquer comme terminee (seuil 100px pour eviter accidents)
- **Taches auto-generees (follow_up) desactivees**

### Suggestions IA - TOUJOURS VISIBLE
- Bloc "Assistant IA" TOUJOURS visible dans la vue Aujourd'hui
- Si suggestions: affiche prospects inactifs a relancer (3+ jours)
- Si pas de suggestions: affiche "A jour" avec badge vert
- Bouton "+ Ajouter" pour creer une tache de suivi

### UX Mobile Optimisee
- **App figee** : pas de zoom, pas de bounce
- Modal avec padding pour eviter la navigation du bas
- Navigation : Today | [FAB +] | Prospects
- Swipe moins sensible (100px au lieu de 50px)

## Endpoints API Cles
- `POST /api/auth/login` - Authentification
- `POST /api/auth/register` - Inscription avec essai 7 jours
- `GET /api/prospects` - Liste prospects
- `POST /api/prospects` - Creation prospect
- `GET /api/tasks/ai-suggestions` - Suggestions IA (prospects inactifs 3+ jours)
- `POST /api/prospects/{id}/generate-message` - Generation SMS IA (GPT-4.1-nano)
- `POST /api/tasks` - Creation tache manuelle
- `GET /api/tasks` - Liste taches

## Integrations 3rd Party
- **Stripe** : Paiements & suivi client
- **OpenAI GPT-4.1-nano** : Generation SMS rapide (~2s)
- **Anthropic Claude** : Suggestions IA
- **Resend** : Emails transactionnels
- **Brevo** : SMS bidirectionnels
- **Google Analytics 4** : Analytics

## Corrections 11 mars 2026
- SMS IA: Modele change pour GPT-4.1-nano (2s vs 5s avec Sonnet)
- Swipe: Seuil augmente de 50px a 100px (moins d'accidents)
- Bloc IA: TOUJOURS visible, affiche "A jour" si pas de suggestions

## Backlog

### P1 - Prioritaire
- [x] Suggestions IA pour prospects inactifs - **FAIT**
- [x] Creation taches manuelles - **FAIT**
- [x] Barre de recherche prospects - **FAIT**
- [x] Generation SMS IA rapide - **FAIT (GPT-4.1-nano)**
- [x] Bloc IA toujours visible - **FAIT**
- [x] Swipe moins sensible - **FAIT (100px)**
- [ ] Deploiement en production (attente utilisateur)

### P2 - A faire
- [ ] Refactoring server.py en modules
- [ ] Refactoring AppShell.js
- [ ] Notifications push en production

### P3 - Backlog
- [ ] Export CSV prospects
- [ ] Statistiques de conversion

## Date Mise a Jour
11 mars 2026
