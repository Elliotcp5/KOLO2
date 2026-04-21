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
- **Backend**: 100% (all tests passed)
- **Frontend**: 100% (all UI tests passed)
- **Test User**: test@test.com / testtest (PRO+ plan, active)

---

## What's Been Implemented (March 26, 2026)

### Session 1 (Previous)
- Complete i18n system (FR, EN, DE, IT)
- Dark mode fixes
- Mobile header layout fixes
- Capacitor/Codemagic CI/CD configuration

### Session 2
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

### Session 3 (Current - March 26, 2026)
- **Bug Fixes:**
  - SMS modal lisible en mode clair (variables CSS ajoutées à themes.css)
  - Profile affiche PRO+ au lieu de FREE
  - Token localStorage corrigé (kolo_token vs session_token)
  - Z-index AddProspectSheet corrigé (151 > BottomNav 100)

- **UI/UX Improvements:**
  - Landing page PRO+: langage clair pour agents immo ("Hot leads auto-identified", "Commission tracking")
  - FREE renommé en STARTER partout (backend + frontend + i18n)
  - BudgetSlider adaptatif selon type de projet:
    - Acheteur: Range 0-800k€
    - Vendeur: Prix unique 0-2M€ (label: "Prix de vente souhaité TTC")
    - Locataire: Range 0-5000€/mois
  - Saisie manuelle du budget (pour budgets > slider max)
  - AI suggestions: dropdown avec boutons Add individuels

- **Stripe Integration:**
  - Tous les utilisateurs créés dans Stripe (même Starter)
  - Metadata enrichi (source: "kolo_registration", initial_plan, trial_status)
  - Webhooks configurés pour subscription lifecycle

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



---

## Capacitor Configuration (iOS & Android)

### Status: READY FOR BUILD ✅

**Package Identifier:** `com.kolo.app`

**iOS Configuration:**
- Location: `/app/frontend/ios/App/`
- Bundle ID: `com.kolo.app`
- Display Name: `KOLO`
- Minimum iOS: 13.0

**Android Configuration:**
- Location: `/app/frontend/android/`
- Package: `com.kolo.app`
- Min SDK: 22
- Target SDK: 34

**Codemagic CI/CD:**
- Config: `/app/frontend/codemagic.yaml`
- Triggers: push/PR to `main` or `release/*`
- Outputs: IPA (iOS), AAB + APK (Android)
- Auto-publish: TestFlight (iOS), Internal Track (Android)

**Build Scripts:**
```bash
yarn build:ios      # Build for iOS
yarn build:android  # Build for Android
yarn build:mobile   # Build for both
yarn cap:sync       # Sync web build to native
```

---

## Stripe Integration

### Status: CONFIGURED ✅

**Products in Stripe:**
- KOLO Pro (monthly/annual)
- KOLO Pro+ (monthly/annual)

**Webhook Endpoint:** `/api/webhook/stripe`
**Webhook Secret:** stocké dans `backend/.env` (variable `STRIPE_WEBHOOK_SECRET`, jamais committée)

**Events Handled:**
- `checkout.session.completed`
- `customer.subscription.created/updated/deleted`
- `invoice.payment_succeeded/failed`

**Customer Creation:**
- All users (including Starter/trial) are created in Stripe
- Metadata includes: source, initial_plan, trial_status

---

## Email Automation (Resend)

### Status: CONFIGURED ✅

**Endpoints:**
- Welcome email: Triggered on `/api/auth/register`
- Password reset: Triggered on `/api/auth/forgot-password`
- Trial reminders: `/api/cron/trial-emails` (J+7, J+12, J+14)
- Weekly reports: `/api/cron/weekly-reports` (PRO+ only)

---

## Refactoring Status

### Backend (P2)
- **server.py**: ~4000 lignes (refactoring préparé mais non migré)
- Nouveaux routers créés dans `/app/backend/routes/`:
  - `plans.py` - Gestion des plans et features
  - `ai.py` - Génération SMS et suggestions IA
  - `interactions.py` - Historique des interactions
  - `dashboard.py` - ROI et statistiques
  - `cron.py` - Jobs planifiés (emails, reports)

### Frontend (P2)
- **AppShell.js**: ~6000 lignes (structure documentée)
- Composants identifiés à extraire:
  - TodayTab (~1700 lignes)
  - ProspectsTab (~1700 lignes)
  - SettingsTab (~1160 lignes)
  - TasksTab (~700 lignes)
  - QuickAddProspectModal (~310 lignes)
  - BottomNav (~330 lignes)

---

## Recent Updates (March 31, 2026)

### Landing Page Enhancements ✅
1. **Legal Notice Button Improved**:
   - Replaced discrete underlined link with a styled button
   - Semi-transparent background with hover animation
   - More visible and accessible in the footer

2. **Premium Animations Added**:
   - **Hero Section**: Staggered fade-up entrance animations for title, subtitle, form, and micro-text
   - **Phone Mockups**: Subtle floating animation (continuous, gentle movement)
   - **Problem Cards**: Scale reveal animation with staggered delays
   - **Pricing Cards**: Scale reveal animation with staggered delays
   - **Buttons**: Micro-interactions with hover effects and shimmer on CTA
   - **Navigation Links**: Underline animation on hover
   - **Smooth Scroll Reveals**: Improved intersection observer with better timing

3. **Custom Prospect Selector Verified**:
   - Bottom sheet style picker working correctly
   - Replaces native HTML `<select>` for iOS Capacitor compatibility
   - Displays prospect name and phone number
   - Includes "No prospect" option

---

## Recent Updates (April 3, 2026)

### P0: Email Localization - COMPLETED ✅
1. **4-Language Email Templates**:
   - All transactional emails now support `fr`, `en`, `de`, `it` locales
   - `EMAIL_CONTENT` dictionary added to `/app/backend/email_service.py`
   - Localized templates:
     - Welcome email (trial and free)
     - Trial reminder emails (J+7, J+12)
     - Trial expired email
     - Password reset email
     - Subscription confirmation email
   - Proper fallback to English for unknown locales
   - All `server.py` email calls now pass user's `locale` parameter

### P0: Stripe Payment & Plan Update Fixes - COMPLETED ✅
1. **Subscription Sync After Payment**:
   - Added `email` and `locale` to Stripe checkout session metadata
   - Created `/api/plans/sync` endpoint for manual subscription sync
   - AppShell.js detects `?upgrade=success` and syncs subscription
   - Welcome toast "Bienvenue sur KOLO Pro+ ! 🎉" appears after payment

2. **Trial Logic Fixed**:
   - Added `trial_used` field to `/api/plans/current`
   - PricingPage shows "Essai gratuit 14 jours" only if `!trialUsed`
   - If trial already used, button shows "Choisir Pro/Pro+"

3. **Plan Display Fixed**:
   - Improved `get_user_effective_plan()` with fallback logic
   - Settings page shows correct plan (PRO+) with "Active" badge
   - PricingPage shows "Votre plan actuel" for current plan

### FAB "+" Import Contacts Choice - COMPLETED ✅
1. **AddProspectSheet Enhanced** (`/app/frontend/src/components/AddProspectSheet.js`):
   - **Step 0 (NEW)**: Choice screen with two options:
     - "Import from contacts" (`data-testid="import-contacts-btn"`)
     - "Manual entry" (`data-testid="manual-entry-btn"`)
   - **Step 1**: Contact form (Full name, Phone, Email)
   - **Step 2**: Project form (Type, Budget, Delay, Notes)
   
2. **Native Contacts Integration**:
   - Uses `@capacitor-community/contacts` for native device contact access
   - On web, "Import from contacts" falls back to manual entry
   - Pre-fills form fields with imported contact data

### P1: Skip Trial Link - COMPLETED ✅ (April 3, 2026)
1. **Landing Page - "Or subscribe directly →"**:
   - Added discreet link below the hero micro-points (✓ 14-day trial, ✓ No credit card, ✓ Cancel anytime)
   - Clicking redirects to `/pricing` page
   - Styled: gray text, underlined, small font, 0.7 opacity (hover: 1.0)
   - Localized for all 4 languages (fr, en, de, it)
   - CSS class `.hero-skip-trial` in `landing.css`

2. **Pricing Page - "or pay now"**:
   - Added discreet link below CTA buttons for PRO and PRO+ plans
   - Only visible when `showSkipTrial = true`:
     - User is on free plan
     - User is not currently in a trial
     - User has never used their free trial
   - Clicking triggers `handlePayNow()` which goes directly to Stripe checkout (skipping trial)
   - Styled: 12px gray text, underlined, subtle opacity

### Testing Status
- **Backend**: 100% (all tests passed)
- **Frontend**: 100% (all UI tests passed)
- **Test Report**: `/app/test_reports/iteration_24.json`
- **Visual Verification**: Landing page and Pricing page skip-trial links validated on desktop and mobile (April 3, 2026)

---

## Session Update - April 3, 2026 (Fork #2)

### Completed Tasks

#### 1. Fixed Registration Flow with PRO/PRO+ Plan Selection ✅
- **Problem**: When user clicked "Try PRO+" from landing page, account was created with PRO trial instead of PRO+
- **Solution**:
  - Added `plan` optional field to `RegisterRequest` in `server.py`
  - Backend `/api/auth/register` now accepts and uses the plan parameter
  - Default remains PRO if no plan specified
  - Updated `LandingPageNew.js` to pass plan via `navigate('/register', { state: { plan: 'pro_plus' } })`
  - Updated `RegisterPage.js` to:
    - Read plan from `location.state?.plan`
    - Display dynamic badge ("✨ 14-day PRO+ free trial" or "✨ 14-day PRO free trial")
    - Pass plan to backend registration
    - Show localized welcome toast
- **Files Modified**: `server.py`, `RegisterPage.js`, `LandingPageNew.js`
- **Tested**: API verified - `effective_plan: pro_plus` for PRO+ registration ✅

#### 2. Fixed "Create Task" Button Hidden Behind Bottom Nav ✅
- **Problem**: When adding a task manually, the "Create task" button was partially hidden behind the bottom navigation menu
- **Solution**: Increased `paddingBottom` from `calc(20px + env(safe-area-inset-bottom))` to `calc(100px + env(safe-area-inset-bottom))` in the Add Task Modal
- **File Modified**: `AppShell.js` (line ~1641)
- **Tested**: Button now fully visible on mobile ✅

#### 3. Clear PRO/PRO+ Feature Badges ✅
- **Problem**: It wasn't clear enough when a feature was reserved for PRO or PRO+ users
- **Solution**:
  - Created new `ProBadge` component (`/app/frontend/src/components/ProBadge.js`)
  - Badge displays "PRO" or "PRO+" with lock icon, gradient background, and consistent styling
  - Updated `HeatScoreBadge.js` to use the new ProBadge component
  - Updated `ROIDashboard.js` to use the new ProBadge component
  - Added i18n keys `proFeature` and `proPlusFeature` to all 4 languages
- **Files Modified**: `ProBadge.js` (new), `HeatScoreBadge.js`, `ROIDashboard.js`, `translations.js`

### Files Created This Session
- `/app/frontend/src/components/ProBadge.js` - Reusable PRO/PRO+ badge component

### Next Action Items
1. **User Testing**: Verify registration flow with PRO/PRO+ from landing page
2. **Visual Review**: Confirm PRO badges are clear on locked features
3. **App Store Submission**: Application is ready for submission

### Future Tasks (Postponed - App Store Launch Imminent)
- P2: Modularize `server.py` into FastAPI routers
- P2: Break down `AppShell.js` into smaller components
- P2: Refactor React Hooks dependency arrays


---

## Changelog - Feb 2026 (iOS Capacitor fixes session)

### iOS / Capacitor hardening (P0) - IMPLEMENTED ✅
Résolution des 5 blocages TestFlight avant soumission App Store :

1. **Safe area / barres noires** :
   - `capacitor.config.ts` + `ios/App/App/capacitor.config.json` : `contentInset: 'never'`, `StatusBar.overlaysWebView: false`, `StatusBar.style: 'light'`, `backgroundColor: '#0F0F0F'`, ajout `scrollEnabled: false`.
   - `App.css` : ajout variables `--safe-area-left/right`, `overscroll-behavior-y: none`, background sur `html`.

2. **Import Contacts** :
   - Ajout `NSContactsUsageDescription` dans `Info.plist` (en + NSCameraUsageDescription / NSPhotoLibraryUsageDescription pour éviter le rejet ATT App Review).
   - Plugin `@capacitor-community/contacts` déjà dans le Podfile ✅.

3. **Push Notifications** :
   - Création `ios/App/App/App.entitlements` avec `aps-environment = development`.
   - Ajout de `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` dans Debug+Release du `project.pbxproj`.
   - `AppDelegate.swift` : ajout des hooks `didRegisterForRemoteNotificationsWithDeviceToken` et `didFailToRegisterForRemoteNotificationsWithError` (notifications `capacitorDidRegisterForRemoteNotifications`).
   - `Info.plist` : `UIBackgroundModes` avec `remote-notification`.

4. **Paiements Stripe (Browser)** :
   - Installation `@capacitor/browser@5.2.1` (**manquait** dans package.json).
   - Ajout `pod 'CapacitorBrowser'` dans Podfile.
   - Création `src/utils/externalUrl.js` → `openExternalUrl()` qui utilise `Browser.open` en natif (fullscreen) et `window.location.href` / `window.open` en web.
   - Migration `PricingPage.js` (2 appels checkout), `SubscribePage.js` (checkout-redirect), `AppShell.js` (portail facturation `/api/billing/portal`).

5. **Lag / UX natif** :
   - Ajout `overrideUserAgent` (user-agent KOLO custom).
   - `scrollEnabled: false` sur iOS config (désactive le scroll natif dupliqué WKWebView).
   - CSS `overscroll-behavior-y: none` global pour bloquer le rebond iOS.

### Codemagic - IMPLEMENTED ✅
- **FIX CRITIQUE** : le `codemagic.yaml` précédent faisait `rm -rf ios && npx cap add ios`, ce qui **écrasait entièlement la config iOS custom** à chaque build.
- Nouveau `codemagic.yaml` : préserve `ios/` (committé au repo), fait `cd frontend && yarn install && yarn build && npx cap sync ios && pod install --repo-update && xcodebuild archive`.
- `submit_to_testflight: true` activé.

## Next Action Items (P0 immédiat)
- Push du repo vers GitHub et déclencher un build Codemagic → vérifier que `pod install` réussit sur `CapacitorBrowser`.
- Vérifier dans Xcode que la capability "Push Notifications" est bien activée (le fichier entitlements est référencé, Xcode doit la détecter automatiquement).
- Tester sur device : checkout Stripe (Safari in-app), contacts, push, safe area.

## Roadmap P2 (post-soumission App Store)
- Modulariser `backend/server.py`.
- Décomposer `frontend/src/pages/AppShell.js` (>6600 lignes).
- Nettoyer warnings `react-hooks/exhaustive-deps` (InteractionTimeline, AuthContext).

## Changelog - Deep Links natifs Stripe (Feb 2026)

### Deep Links Capacitor (P0) - IMPLEMENTED ✅
Retour auto dans l'app depuis Safari in-app après checkout Stripe :

1. **Consolidation codemagic.yaml** :
   - Doublon `/app/frontend/codemagic.yaml` (bundle_id `com.kolo.app`, obsolète) **supprimé**.
   - `/app/codemagic.yaml` à la racine = version unique, fusionnée : signing complet App Store Connect + Android, bundle_id correct `io.kolo.app`, non-destructif (pas de `rm -rf ios`), `submit_to_testflight: true`.

2. **Plugin `@capacitor/app@5.0.8`** installé (listener `appUrlOpen`).
   - Ajouté à Podfile : `pod 'CapacitorApp'`.

3. **URL Scheme iOS** dans `Info.plist` :
   ```
   CFBundleURLTypes = [{ CFBundleURLSchemes = ["io.kolo.app", "kolo"] }]
   ```

4. **Hook React `useCapacitorDeepLinks`** (`/app/frontend/src/hooks/useCapacitorDeepLinks.js`) :
   - Écoute `App.addListener('appUrlOpen', ...)`.
   - Parse les URLs `io.kolo.app://checkout-success`, `checkout-cancelled`, `checkout-error?reason=...`, `create-account?session_id=...`.
   - Ferme automatiquement le Safari in-app (`Browser.close()`) et redirige dans l'app avec toast de confirmation.
   - Activé dans `App.js` à l'intérieur de `AppRouter`.

5. **Backend** (`/api/plans/upgrade` + `/api/payments/checkout-redirect`) :
   - Nouveau champ `native: bool` / query `native=1`.
   - Si natif : `success_url = "io.kolo.app://checkout-success?plan=..."`, `cancel_url = "io.kolo.app://checkout-cancelled"`, erreurs → `checkout-error?reason=...`.
   - Si web : URLs classiques `/app?upgrade=success` (inchangé).

6. **Frontend** :
   - `PlanContext.upgradePlan()` envoie `native: Capacitor.isNativePlatform()` dans le body.
   - `SubscribePage.handlePayment()` ajoute `&native=1` à l'URL quand natif.

Flow natif : clic "Upgrade" → Browser.open() fullscreen sur checkout.stripe.com → paiement → Stripe redirige vers `io.kolo.app://checkout-success` → iOS relance l'app → hook ferme Safari in-app + toast "Paiement réussi 🎉" + navigate `/app?upgrade=success`.

## Changelog - Onboarding Premium post-paiement (Feb 2026)

### WelcomePROOnboarding (P1) - IMPLEMENTED ✅
Onboarding fullscreen 4-slides déclenché automatiquement après paiement Stripe réussi.

1. **Composant** `/app/frontend/src/components/WelcomePROOnboarding.js` :
   - 2 sets de 4 slides : PRO (purple→pink gradient) / PRO+ (orange→red→pink gradient)
   - Localisé FR / EN / DE / IT
   - Icônes lucide-react : Crown, Infinity, MessageSquare, Flame, TrendingUp, Sparkles
   - Confetti à l'ouverture (`canvas-confetti`)
   - Progress dots animés (largeur du dot actif = 24px)
   - CTA "Next" devient "Commencer maintenant" au dernier slide
   - Bouton X pour fermer (safe-area respectée)
   - Animation icon entrance `cubic-bezier` scale + rotate

2. **Déclenchement automatique** dans `AppShell.js` :
   - `/app?upgrade=success&plan=pro` (ou pro_plus) → sync + ouverture
   - Fallback robuste : si sync backend échoue, utilise le `plan` de l'URL
   - Fonctionne identiquement en web (redirect Stripe) et natif (deep link `io.kolo.app://checkout-success?plan=...`)

3. **Contenu PRO** :
   - Bienvenue PRO → Prospects/IA illimités → SMS 1-click → Historique complet

4. **Contenu PRO+** :
   - Bienvenue PRO+ → Heat Score IA → ROI Dashboard → Rapports hebdo

### Tests visuels ✅
- Screenshot Slide 1 PRO+ : "Welcome to KOLO PRO+" (Crown, YOU'RE AT THE TOP) ✅
- Screenshot Slide 3 PRO+ : "ROI Dashboard" (TrendingUp, REAL-TIME NUMBERS) ✅
- Navigation Next fonctionnelle, dots de progression OK
- Aucune régression sur la landing/login/app

## Next Action Items
1. Push KOLO2 vers GitHub → laisser tourner Codemagic → soumettre à TestFlight
2. Test TestFlight : checkout Stripe → retour deep link → onboarding premium s'affiche
3. Vérifier les 4 langues sur device en changeant la locale utilisateur avant checkout

## Roadmap (post-App Store)
- P2 : Modulariser `backend/server.py` en routers
- P2 : Décomposer `AppShell.js` (>6860 lignes) en sous-composants
- P2 : Universal Links (`apple-app-site-association`) pour éviter le prompt iOS "Ouvrir dans KOLO ?"
- P3 : Analytics sur l'onboarding (track complétion / skip rate)

## Changelog - Brand identity + SEO/ASO (Feb 2026)

### Onboarding v2 — Identité KOLO (DONE ✅)
- Suppression du logo `Crown` (user feedback)
- Slide 1 : **logo KOLO officiel** (PNG) avec halo gradient marque
- Slides 2-4 : icônes lucide dans un chip **gradient bleu KOLO (#004AAD) → magenta (#CB6CE6)**
- Badge **"PRO+"** en gradient marque (top-left) pour différencier le tier
- Text-gradient KOLO sur les subtitles
- Fond radial subtil aux couleurs marque
- CTA Next en gradient marque
- Confetti couleurs KOLO (#004AAD, #CB6CE6, #FFF)

### SEO multilingue (DONE ✅)
Fichiers touchés :
- `/app/frontend/public/index.html` — refonte complète :
  - Title + description optimisés (EN default)
  - **hreflang** pour EN/FR/ES/DE/IT + x-default
  - Canonical URL `https://trykolo.io/`
  - Open Graph complet (locale + alternate locales)
  - Twitter Card
  - **JSON-LD SoftwareApplication** (aggregateRating, 3 offers, featureList)
  - **JSON-LD Organization** (contactPoint, sameAs → App Store)
  - `apple-itunes-app` (Smart App Banner iOS → lien direct App Store)
  - `google-play-app`
- `/app/frontend/public/robots.txt` — exclusion des routes privées
- `/app/frontend/public/sitemap.xml` — multilingue avec hreflang par URL
- `/app/frontend/src/hooks/useSEO.js` (nouveau) — title/description/OG/html[lang] **dynamiques selon locale** (EN/FR/ES/DE/IT)
- Activé dans `App.js` via `useSEO()` dans AppRouter

### ASO Pack (DONE ✅)
- `/app/memory/ASO_SEO_PACK.md` : pack complet prêt à copier dans App Store Connect + Google Play Console, en **EN / ES / DE / FR** :
  - App name (30 chars) × 4 langues
  - Subtitle (30 chars) × 4
  - Promotional text (170 chars) × 4
  - Keywords (100 chars, sans espace) × 4
  - Short description Play (80 chars) × 4
  - Full description (4000 chars) × 4
  - Checklist ASO + SEO
  - Mots-clés longue traîne
  - Compétiteurs à analyser

## Next Action Items
1. **Push GitHub → build Codemagic** (rien d'autre à faire côté code)
2. App Store Connect : activer les 4 localisations EN/ES/DE/FR, copier depuis `/app/memory/ASO_SEO_PACK.md`
3. Préparer 6 screenshots localisés par langue (6.5" iPhone + iPad 12.9")
4. Soumettre à l'indexation Google Search Console (sitemap.xml)

## Roadmap (post-lancement)
- P2 : Ajout langue espagnole à l'app UI (actuellement FR/EN/DE/IT only ; ES a été ajouté SEO/ASO uniquement)
- P2 : Blog `/blog` avec articles SEO ("Best CRM for real estate 2026") en 4 langues
- P2 : App Preview videos (30s) → +30% de conversion App Store
- P2 : Universal Links (`apple-app-site-association`)
- P3 : Refactoring server.py + AppShell.js
