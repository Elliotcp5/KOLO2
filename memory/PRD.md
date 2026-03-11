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
- Generation de messages IA personnalises
- Envoi SMS via Brevo (nom agent = expediteur)
- **Reception des reponses** via webhook Brevo
- Conversation style iMessage/WhatsApp

### Taches Manuelles
- **Creation manuelle de taches** avec modal dedie
- Types : Appel, SMS, Email, Visite, Autre
- Titre obligatoire + Date obligatoire
- Heure et adresse optionnelles
- Liaison optionnelle a un prospect existant
- Swipe pour marquer comme terminee
- **Taches auto-generees (follow_up) desactivees**

### Suggestions IA
- Bloc "Suggestions IA" dans la vue Aujourd'hui
- Affiche les prospects inactifs a relancer (3+ jours)
- Bouton "+ Add" pour creer une tache de suivi

### UX Mobile Optimisee
- **App figee** : pas de zoom, pas de bounce
- Modal avec padding pour eviter la navigation du bas
- Navigation : Today | [FAB +] | Prospects

## Endpoints API Cles
- `POST /api/auth/login` - Authentification
- `POST /api/auth/register` - Inscription avec essai 7 jours
- `GET /api/prospects` - Liste prospects
- `POST /api/prospects` - Creation prospect
- `GET /api/tasks/ai-suggestions` - Suggestions IA (prospects inactifs 3+ jours)
- `POST /api/prospects/{id}/generate-message` - Generation SMS IA
- `POST /api/tasks` - Creation tache manuelle
- `GET /api/tasks` - Liste taches

## Integrations 3rd Party
- **Stripe** : Paiements & suivi client
- **Anthropic Claude** : Fonctionnalites IA (via EMERGENT_LLM_KEY)
- **Resend** : Emails transactionnels
- **Brevo** : SMS bidirectionnels
- **Google Analytics 4** : Analytics

## Etat Actuel (11 mars 2026)

### Complet et Teste (100% pass rate):
- Authentification (login/register)
- Generation SMS IA
- Suggestions IA pour prospects inactifs
- Creation taches manuelles
- Barre de recherche prospects
- Viewport mobile (pas de zoom/scroll)
- Interface dark mode iOS

### Tests Effectues:
- Backend: 15/15 tests (100%)
- Frontend: Toutes fonctionnalites verifiees
- Rapport: /app/test_reports/iteration_11.json

## Backlog

### P1 - Prioritaire
- [x] Suggestions IA pour prospects inactifs - **FAIT**
- [x] Creation taches manuelles - **FAIT**
- [x] Barre de recherche prospects - **FAIT**
- [x] Generation SMS IA - **FAIT**
- [x] Fix viewport mobile - **FAIT**
- [ ] Deploiement en production (attente utilisateur)
- [ ] Configurer webhook Brevo (cote client)

### P2 - A faire
- [ ] Refactoring server.py en modules (backend monolithique ~2450 lignes)
  - Routes a extraire: auth, payments, tasks, prospects, webhooks
- [ ] Refactoring AppShell.js (composant tres large)
- [ ] Notifications push en production
- [ ] Captures d'ecran du flow "essai expire"

### P3 - Backlog
- [ ] Export CSV prospects
- [ ] Statistiques de conversion
- [ ] Verifier VAPID Keys en production

## Credentials Test
- User: test@test.com / testtest
- User: pressardelliot@gmail.com / Test123
- User: pressardhugo@gmail.com / Test123

## Date Mise a Jour
11 mars 2026
