# KOLO - Product Requirements Document

## Original Problem Statement
KOLO is a CRM application for real estate agents designed to help manage prospects, tasks, and follow-ups. The user requested a major implementation of the subscription plan system (STARTER/PRO/PRO+) with all premium features (P0-P3) from the specification document kolo-spec-v3.docx.

## User Personas
- **Real Estate Agents**: Primary users who need to manage their prospects, schedule follow-ups, and track commissions.
- **Property Sales Teams**: Teams needing collaborative tools for prospect management.

---

## Core Requirements

### Subscription Plan System (P0) - IMPLEMENTED ✅
1. **Plan Tiers**: STARTER / PRO / PRO+
   - STARTER: 30 prospects limit, 1 AI suggestion/day
   - PRO: Unlimited prospects, unlimited AI, SMS 1-click, interaction history
   - PRO+: All PRO features + Heat score, ROI dashboard, weekly reports

2. **14-Day Trial System**: Users can start a trial for PRO or PRO+ without credit card
3. **Multi-Currency Pricing**: EUR, USD, GBP with automatic detection
4. **Billing Periods**: Monthly and Annual (2 months free on annual)

### Pricing Page (P0) - IMPLEMENTED ✅
- Interactive pricing page at `/pricing`
- Currency toggle (EUR/USD/GBP)
- Billing period toggle (Monthly/Annual with savings badge)
- 3 plan cards (Starter, PRO with "Popular" badge, PRO+)
- Dynamic CTAs based on current plan

### Premium Features (P1-P3) - IMPLEMENTED ✅

#### P1 - Core UX
- **SMS One-Click with AI**: Generate contextual SMS messages using AI and deep-link to native SMS app
- **Budget Slider**: Double-handle slider for prospect budget range (PRO feature)
- **Contextual Notes**: AI-generated header notes based on project type

#### P2 - Retention PRO
- **Interaction History**: Timeline of all interactions (SMS, calls, visits, notes) per prospect
- **Contextualized AI Suggestions**: Suggestions based on prospect context

#### P3 - PRO+ Differentiation
- **Heat Score**: Algorithm calculating prospect "temperature" (0-100) based on activity
- **ROI Dashboard**: Monthly revenue tracking and ROI multiplier display
- **Weekly Email Report**: Automated stats email (revenue, sales, tasks, hot prospects)
- **Mark as Sold**: Track commissions when prospects convert

### Automated Email Sequences (P0) - IMPLEMENTED ✅
- **Welcome Email**: Sent on registration
- **Password Reset Email**: Sent on forgot password request  
- **Trial Reminders**: J+7, J+12, J+14 automated reminder emails via Resend API
- Cron endpoint: `/api/cron/trial-emails` for lifecycle emails

---

## Technical Implementation

### Backend Endpoints Added
```
POST /api/plans/start-trial     - Start 14-day trial (PRO/PRO+)
GET  /api/plans/current         - Get current plan with features & limits
GET  /api/plans/pricing         - Get pricing for all plans (with currency)
GET  /api/plans/check-feature/{feature} - Check feature access
POST /api/plans/upgrade         - Create Stripe checkout session
POST /api/plans/set-currency    - Set user currency preference

POST /api/interactions          - Create interaction record (PRO)
GET  /api/interactions/{prospect_id} - Get interaction timeline (PRO)

POST /api/prospects/{id}/calculate-heat - Calculate heat score (PRO+)
POST /api/prospects/{id}/mark-sold      - Mark prospect as sold (PRO+)

GET  /api/dashboard/roi         - Get ROI dashboard data (PRO+)
POST /api/reports/weekly        - Send weekly report email (PRO+)

POST /api/ai/generate-sms       - Generate AI SMS message (PRO)
```

### Frontend Components Added
```
/src/context/PlanContext.js        - Plan management context
/src/pages/PricingPage.js          - Interactive pricing page
/src/components/PaywallBottomSheet.js  - Feature paywalls
/src/components/BudgetSlider.js    - Double-handle budget slider
/src/components/AddProspectSheet.js - 2-step prospect creation
/src/components/SMSOneClickButton.js - AI SMS generation
/src/components/HeatScoreBadge.js  - Heat score display
/src/components/ROIDashboard.js    - ROI dashboard component
/src/components/InteractionTimeline.js - Interaction history
/src/components/MarkAsSoldButton.js - Mark as sold modal
```

### Database Schema Updates
- **users**: Added `plan`, `trial_plan`, `trial_start_date`, `currency`, `billing_period`, `daily_suggestions_used`, `daily_suggestions_reset_date`, `monthly_revenue`, `monthly_revenue_month`
- **prospects**: Added `project_type`, `budget_min`, `budget_max`, `budget_undefined`, `delay`, `heat_score`, `commission_amount`, `closed_date`, `last_contact_date`, `external_activity_signal`
- **interactions**: New collection for tracking prospect interactions

---

## Testing Status
- **Backend**: 78% (25/32 tests passed)
- **Frontend**: 100% (all UI tests passed)
- **Test User**: test@test.com / testtest (active, free plan)

---

## What's Been Implemented (March 26, 2026)

### Session 1 (Previous)
- Complete i18n system (FR, EN, DE, IT)
- Dark mode fixes
- Mobile header layout fixes
- Capacitor/Codemagic CI/CD configuration

### Session 2 (Current)
- Complete subscription plan system (P0)
- Pricing page with currency/billing toggles (P0)
- 14-day trial system (P0)
- SMS One-Click with AI (P1)
- Budget slider component (P1)
- 2-step prospect creation flow (P1)
- Interaction history (P2)
- Heat score calculation (P2/P3)
- ROI dashboard (P3)
- Weekly email reports (P3)
- Mark as sold with commission (P3)

---

## Backlog / Future Tasks

### P0 (High Priority)
- ~~Implement subscription plan system~~ ✅
- ~~Pricing page with multi-currency~~ ✅
- ~~14-day trial system~~ ✅

### P1 (Medium Priority)
- ~~SMS One-Click with AI~~ ✅
- ~~Budget slider~~ ✅
- Stripe webhook integration for subscription events
- Trial expiration email sequence (J+7, J+12, J+14)

### P2 (Lower Priority)
- ~~Interaction history~~ ✅
- ~~Heat score~~ ✅
- GA4 analytics events integration
- Demo prospect if 0 prospects after onboarding

### P3 (Nice to Have)
- ~~ROI Dashboard~~ ✅
- ~~Weekly report~~ ✅
- ~~Mark as sold~~ ✅
- Behavioral alerts for PRO+
- Ultra-contextual AI suggestions

### Technical Debt
- Refactor /app/backend/server.py into modular routers (~4000 lignes)
- Refactor /app/frontend/src/pages/AppShell.js (~6000 lignes)
- Add comprehensive test coverage for new endpoints
- Implement proper Stripe webhook handler

---

## Bugs Corrigés (26 Mars 2026)

### P0 Bugs - TOUS CORRIGÉS ✅
1. **SMS illisible** - Modal SMS avait fond transparent et texte noir
   - Fix: z-index 151, styles dark mode avec #1a1a24
2. **AddProspectSheet chevauchement** - Le sheet passait derrière la bottom nav
   - Fix: z-index passé de z-50 à 151
3. **PRO+ features bloquées** - Compte PRO+ ne débloquait pas le slider Budget
   - Fix: Token localStorage corrigé de `session_token` à `kolo_token`

---

## 3rd Party Integrations
- **Stripe**: Payments & subscription management
- **Emergent LLM Key**: AI features (Claude/GPT)
- **Resend**: Transactional & lifecycle emails (Welcome, Reset, Trial reminders)
- **Brevo**: SMS notifications
- **Codemagic**: CI/CD pour builds iOS et Android

---

## UI/UX Constraints
- **CRITICAL**: Do NOT change general UI aspect or menus (per user request)
- Use existing design system (gradients, spacing, typography)
- Maintain dark/light mode compatibility with `c()` helper
- All text must use `t()` translation helper
