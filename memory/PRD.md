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

### Phases 1-6 - COMPLETE (March 11, 2026)
- ✅ Phase 1: Theme System Light/Dark
- ✅ Phase 2: Prospect Statuses (5 statuts colorés)
- ✅ Phase 3: UX Improvements (message contextuel, streak, lien relance, animation IA, formulaire amélioré, résiliation)
- ✅ Phase 4: Welcome Tutorial (5 étapes avec confetti)
- ✅ Phase 5: Native Contact Import (Contact Picker API)
- ✅ Phase 6: Landing Page redesignée

### Security Hardening - IN PROGRESS (March 11, 2026)
- ✅ Rate limiting ajouté (slowapi)
  - Auth endpoints: 10/minute
  - AI generation: 30/minute
  - General endpoints: 100/minute
- ✅ Input validation & sanitization
- ✅ XSS prevention via html.escape()

### UI/UX Corrections Requested - PENDING
1. ❌ Formulaire Nouveau prospect: Labels fixes au-dessus des inputs (STARTED)
2. ❌ Mon Profil: Supprimer doublon "Résilier l'abonnement" dans Billing (DONE)
3. ❌ Didacticiel: Fond blanc sans texture (OK - already clean)
4. ❌ Login: Logo KOLO centré et lisible (STARTED)
5. ❌ Logo sur fonds clairs: Utiliser favicon violet avec K blanc
6. ❌ Points verts: Ajouter tooltip température (DONE)
7. ❌ Landing: Supprimer témoignages
8. ❌ Landing: Alternance fonds dark/white
9. ❌ Landing: Screenshots réels dans "Comment ça marche"
10. ❌ Design System complet (spacing 8px, shadows, typography, buttons, inputs, border-radius)

### MAJOR REDESIGN REQUESTED - PENDING
User provided 3 HTML files for complete UI redesign:
1. **KOLO_Landing_v5-4.html** - New landing page design
2. **KOLO_App_Dashboard.html** - Light mode dashboard
3. **KOLO_App_Dashboard_Dark.html** - Dark mode dashboard

#### New Design System to Implement:
**Colors Light Mode:**
- --bg: #FFFFFF
- --bg-alt: #F7F6FB
- --bg-alt2: #F0EEF8
- --ink: #0E0B1E
- --ink-mid: #4A4560
- --ink-soft: #8A849E
- --grad: linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)
- --blue: #004AAD
- --purple: #CB6CE6

**Colors Dark Mode:**
- --bg: #0F0D1A
- --bg-alt: #181526
- --bg-alt2: #201D31
- --ink: #F0EEF8
- --ink-mid: #B8B2D0
- --ink-soft: #6B6585

**Typography:**
- League Spartan (titles, 700-800)
- DM Sans (body, 400-500)

**Key Components to Build:**
- StatusBar with scroll effect
- Expandable TaskCard with colored border by status
- IA suggestion card with gradient background
- Stats row
- Bottom nav with center + button
- Tabs component

## Architecture

### Frontend
- React 18 avec hooks
- Tailwind CSS + CSS variables pour thèmes
- Lucide React icons
- Shadcn/UI components
- canvas-confetti pour animations
- Google Fonts: League Spartan, DM Sans (TO ADD)

### Backend
- FastAPI (Python)
- MongoDB pour persistence
- JWT sessions
- Emergent LLM integration (GPT-4.1-nano)
- **NEW:** slowapi rate limiting

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
- subscription_status

### prospects
- prospect_id, user_id
- full_name, phone, email
- status: 'nouveau' | 'contacte' | 'qualifie' | 'offre' | 'signe'
- source, score, notes

### tasks
- task_id, user_id, prospect_id
- title, task_type, due_date
- completed, completed_at

## API Endpoints

### Auth
- POST /api/auth/register (rate limited: 10/min)
- POST /api/auth/login (rate limited: 10/min)
- GET /api/auth/me
- PUT /api/auth/preferences
- GET /api/auth/streak

### Prospects
- GET /api/prospects
- POST /api/prospects (rate limited: 100/min)
- GET /api/prospects/:id
- PATCH /api/prospects/:id
- DELETE /api/prospects/:id
- POST /api/prospects/batch

### Tasks
- GET /api/tasks
- POST /api/tasks
- PUT /api/tasks/:id/complete
- DELETE /api/tasks/:id

### AI (rate limited: 30/min)
- POST /api/ai/suggestions
- POST /api/prospects/:id/generate-message

## Backlog

### P0 - Critical (User Request)
- **MAJOR UI REDESIGN** based on provided HTML files
  - New landing page with League Spartan/DM Sans fonts
  - New dashboard with expandable task cards
  - New bottom navigation with gradient + button
  - Complete theme system with new variables

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

## Design Files Reference
- Landing: https://customer-assets.emergentagent.com/job_c1a9754f-8146-404a-90a8-92cbbb99771b/artifacts/vmgjqabc_KOLO_Landing_v5-4.html
- Dashboard Light: https://customer-assets.emergentagent.com/job_c1a9754f-8146-404a-90a8-92cbbb99771b/artifacts/esrfcfhk_KOLO_App_Dashboard.html
- Dashboard Dark: https://customer-assets.emergentagent.com/job_c1a9754f-8146-404a-90a8-92cbbb99771b/artifacts/38lzjeoy_KOLO_App_Dashboard_Dark.html
