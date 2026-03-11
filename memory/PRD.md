# KOLO - CRM Immobilier

## Problem Statement
Application de gestion de prospects immobiliers avec suivi automatisé, suggestions IA et communication SMS/Email.

## User Personas
- Agents immobiliers indépendants
- Petites agences immobilières
- Professionnels de l'immobilier souhaitant automatiser leur suivi client

## Core Requirements

### Authentication
- Email/password login
- Session management
- User preferences (theme, locale)

### Prospect Management
- CRUD prospects
- 5 statuts : nouveau, contacté, qualifié, offre, signé
- Température (froid, tiède, chaud)
- Import contacts natif
- Notes et historique

### Task Management
- Création/completion de tâches
- Tâches en retard avec relance rapide
- Suggestions IA automatiques
- Streak de jours consécutifs

### Communication
- Génération de messages IA (SMS/Email)
- Templates personnalisés
- Historique des interactions

## Implementation Status

### Phase 1 - Theme System ✅ COMPLETE (March 11, 2026)
- Light mode par défaut pour nouveaux utilisateurs
- Toggle Light/Dark dans My Profile
- CSS variables pour les deux thèmes
- Persistance en backend

### Phase 2 - Prospect Statuses ✅ COMPLETE (March 11, 2026)
- 5 statuts : nouveau, contacté, qualifié, offre, signé
- Badges colorés sur les cartes
- Sélecteur pipeline sur page détail
- Mapping des anciens statuts

### Phase 3 - UX Improvements ✅ COMPLETE (March 11, 2026)
- Message contextuel dynamique sur Today
- Streak counter (>=2 jours)
- Lien "En retard — Relancer maintenant"
- Animation IA "Analyse du projet de [prénom]..."
- Formulaire prospect amélioré avec Source
- Bouton résiliation d'abonnement

### Phase 4 - Welcome Tutorial ✅ COMPLETE (March 11, 2026)
- 5 étapes : Bienvenue, Import, Tâche, Thème, Complétion
- Confetti à la fin
- Non-bloquant avec bouton Skip
- Actions réelles sauvegardées en DB

### Phase 5 - Native Contact Import ✅ COMPLETE (March 11, 2026)
- Contact Picker API
- Fallback pour navigateurs non supportés
- Import batch via /api/prospects/batch

### Phase 6 - Landing Page ✅ COMPLETE (March 11, 2026)
- Design dark premium
- Sections : Hero, How it works, Testimonials, Pricing, FAQ
- CTA "Try for free"

## Architecture

### Frontend
- React 18 avec hooks
- Tailwind CSS + CSS variables pour thèmes
- Lucide React icons
- Shadcn/UI components
- canvas-confetti pour animations

### Backend
- FastAPI (Python)
- MongoDB pour persistence
- JWT sessions
- Emergent LLM integration (GPT-4.1-nano)

### Key Files
- `/app/frontend/src/pages/AppShell.js` - Composant principal (~5000 lignes)
- `/app/frontend/src/styles/themes.css` - Variables CSS thèmes
- `/app/frontend/src/components/OnboardingFlow.js` - Tutoriel
- `/app/frontend/src/pages/LandingPageNew.js` - Landing Page
- `/app/backend/server.py` - API backend

## Database Schema

### users
- user_id, email, password_hash
- theme_preference: 'light' | 'dark'
- didacticiel_completed: boolean
- streak_current: number
- subscription_status: 'none' | 'trialing' | 'active' | 'canceled'

### prospects
- prospect_id, user_id
- full_name, phone, email
- status: 'nouveau' | 'contacte' | 'qualifie' | 'offre' | 'signe'
- source: string
- score: 'froid' | 'tiède' | 'chaud'
- notes: string

### tasks
- task_id, user_id, prospect_id
- title, task_type
- due_date, completed
- completed_at

## API Endpoints

### Auth
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- PUT /api/auth/preferences
- GET /api/auth/streak

### Prospects
- GET /api/prospects
- POST /api/prospects
- GET /api/prospects/:id
- PATCH /api/prospects/:id
- DELETE /api/prospects/:id
- POST /api/prospects/batch

### Tasks
- GET /api/tasks
- POST /api/tasks
- PUT /api/tasks/:id/complete
- DELETE /api/tasks/:id

### AI
- POST /api/ai/suggestions
- POST /api/prospects/:id/generate-sms

## Backlog

### P1 - High Priority
- Refactoring AppShell.js (modularisation)
- Refactoring server.py (séparation en routers)
- Tests automatisés

### P2 - Medium Priority
- Notifications push (VAPID keys)
- Analytics dashboard
- Export prospects CSV

### P3 - Low Priority
- Multi-langue complète
- Intégration calendrier
- Templates email personnalisables

## Integrations
- Stripe (paiements)
- Brevo (SMS)
- Resend (emails)
- OpenAI GPT-4.1-nano via Emergent (génération IA)
- Google Analytics 4

## Test Credentials
- test@test.com / testtest
- pressardelliot@gmail.com / Test123
