# KOLO - CRM Immobilier

## Problem Statement
Application de gestion de prospects immobiliers avec suivi automatisé, suggestions IA et communication SMS/Email.

## Implementation Status - ALL PHASES COMPLETE ✅

### Phases 1-6 - COMPLETE (March 11, 2026)
- ✅ Phase 1: Theme System Light/Dark
- ✅ Phase 2: Prospect Statuses (5 statuts colorés)
- ✅ Phase 3: UX Improvements
- ✅ Phase 4: Welcome Tutorial (5 étapes)
- ✅ Phase 5: Native Contact Import
- ✅ Phase 6: Landing Page redesignée

### UI/UX Corrections - COMPLETE (March 14, 2026)
- ✅ Formulaire Nouveau prospect: Labels fixes au-dessus des inputs
- ✅ Mon Profil: Doublon "Résilier" supprimé dans Billing
- ✅ Points verts: Tooltip température ajouté
- ✅ Landing: Témoignages supprimés
- ✅ Landing: Alternance fonds dark/white

### Security Hardening - COMPLETE (March 11, 2026)
- ✅ Rate limiting (slowapi): 10/min auth, 30/min AI, 100/min general
- ✅ Input validation & sanitization
- ✅ XSS prevention

### MAJOR UI REDESIGN - COMPLETE (March 14, 2026)
Based on provided HTML files:

**New Design System Implemented:**
- ✅ Google Fonts: League Spartan (headings), DM Sans (body)
- ✅ New color palette: #004AAD (blue), #CB6CE6 (purple)
- ✅ Gradient: linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)
- ✅ Light mode: #FFFFFF bg, #F7F6FB surface, #0E0B1E ink
- ✅ Dark mode: #0F0D1A bg, #181526 surface, #F0EEF8 ink

**Landing Page Redesigned:**
- ✅ Hero with phone mockups (3 screens)
- ✅ Social proof marquee strip
- ✅ Problem section with 3 cards
- ✅ Features with mockups (AI relances, swipe)
- ✅ Pricing card with gradient border
- ✅ FAQ accordion
- ✅ Final CTA with gradient background
- ✅ Reveal animations on scroll

**Dashboard Redesigned:**
- ✅ New color system applied
- ✅ Tabs with gradient active state
- ✅ Stats row cards
- ✅ AI Assistant card with gradient background
- ✅ Task cards with colored left border
- ✅ Bottom nav with centered + button
- ✅ Settings page clean

## Architecture

### Frontend
- React 18
- Google Fonts: League Spartan, DM Sans
- Custom CSS variables design system
- Lucide React icons
- Shadcn/UI components
- canvas-confetti

### Backend
- FastAPI (Python)
- MongoDB
- JWT sessions
- slowapi rate limiting
- Emergent LLM integration (GPT-4.1-nano)

### Key Files
- `/app/frontend/src/pages/AppShell.js` - Main app (~5000 lines)
- `/app/frontend/src/pages/LandingPageNew.js` - New landing page
- `/app/frontend/src/styles/themes.css` - Design system CSS
- `/app/frontend/src/styles/landing.css` - Landing specific CSS
- `/app/backend/server.py` - API backend

## Database Schema

### users
- user_id, email, password_hash
- theme_preference: 'light' | 'dark'
- didacticiel_completed, streak_current
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

### Auth (rate limited: 10/min)
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- PUT /api/auth/preferences
- GET /api/auth/streak

### Prospects (rate limited: 100/min)
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

### AI (rate limited: 30/min)
- POST /api/ai/suggestions
- POST /api/prospects/:id/generate-message

## Backlog

### P1 - High Priority
- Refactoring AppShell.js (modularisation en composants)
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

## Design System Reference

### Colors
```css
/* Light Mode */
--bg: #FFFFFF
--bg-alt: #F7F6FB
--ink: #0E0B1E
--ink-mid: #4A4560
--ink-soft: #8A849E
--blue: #004AAD
--purple: #CB6CE6

/* Dark Mode */
--bg: #0F0D1A
--bg-alt: #181526
--ink: #F0EEF8
--ink-mid: #B8B2D0
--ink-soft: #6B6585
```

### Typography
- Headings: League Spartan 700-800
- Body: DM Sans 400-500

### Border Radius
- Cards: 16px
- Buttons: 12px (or 999px for pills)
- Inputs: 10px
- Badges: 6px
