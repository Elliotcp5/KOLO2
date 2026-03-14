# KOLO - Product Requirements Document

## Overview
KOLO is a mobile-first CRM application designed for independent real estate agents. It uses AI to help agents track prospects, schedule follow-ups, and close more deals.

## Version 2.0.0 - Released March 14, 2026

### Core Features
1. **Today Dashboard** - Daily task list with AI suggestions
2. **Prospects Management** - Full CRUD for prospect contacts
3. **AI-Powered Follow-ups** - Automated task generation and message writing
4. **Dark/Light Mode** - Full theme support with sun/moon toggle
5. **Push Notifications** - Reminders for scheduled tasks
6. **Onboarding Tutorial** - Step-by-step introduction for new users

## Tech Stack
- **Frontend**: React.js with CSS custom properties for theming
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI**: Anthropic Claude (via Emergent LLM Key)
- **Payments**: Stripe
- **Email**: Resend
- **SMS**: Brevo
- **Analytics**: Google Analytics 4

## UI/UX Design System (v2.0.0)

### Colors
- **Light Mode**:
  - Background: #FFFFFF
  - Surface: #F8F9FA
  - Text: #0E0B1E
  - Muted: #6B7280
  - Accent Gradient: linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)

- **Dark Mode**:
  - Background: #1A1A24
  - Surface: #2A2A3B
  - Card: #2E2E42
  - Text: #FFFFFF
  - Muted: #A0A4AE
  - Accent: #E82EA4

### Typography
- Heading Font: League Spartan
- Body Font: DM Sans
- H1: 32px, 800 weight
- H2: 22px, 700 weight
- Body: 15px, 400 weight
- Caption: 13px, 500 weight

### Components
- Border Radius: 8px (small), 12px (medium), 14px (card), 999px (pill)
- Buttons: Gradient primary, outline secondary
- Cards: 1px border, subtle shadow in light mode only

## Version History

### v2.0.0 (March 14, 2026) - UI/UX Redesign Complete ✅
**TESTED AND VERIFIED**

**UI Fixes:**
- ✅ Dark mode - all text and icons visible
- ✅ Settings page icons - proper theme-aware colors
- ✅ Edit prospect modal - displays all fields correctly
- ✅ Source dropdown - fully functional
- ✅ Temperature button - visible with proper styling
- ✅ Theme toggle - sun/moon switch implementation
- ✅ Version number - updated to 2.0.0
- ✅ Logout button - visible with icon and text
- ✅ Profile settings - all icons visible

**Landing Page:**
- ✅ "Essayer gratuitement" button (correct French)
- ✅ Single checkmark per benefit line
- ✅ Header spacing improved
- ✅ "1 mois gratuit" (not 7 days)

**Auth Pages:**
- ✅ Login: "Content de vous revoir !" (French greeting)
- ✅ Register: "1 mois gratuit · Sans carte bancaire"
- ✅ KOLO text logo with colored dot
- ✅ Gradient buttons visible

**Dashboard:**
- ✅ Profile pill with initials "EP"
- ✅ Pill-shaped segment buttons
- ✅ Stats cards with gradient text
- ✅ AI Assistant card properly styled
- ✅ Action buttons visible (call, email, SMS)

## Pages & Components

### Landing Page (`LandingPageNew.js`)
- Header: KOLO logo, language selector (FR/EN), Connexion, Essayer gratuitement
- Hero section with headline and phone mockups
- Features section
- Pricing section
- FAQ section

### Login/Register Pages
- KOLO text logo with accent dot
- Gradient CTA buttons
- Form validation
- French translations

### Dashboard (`AppShell.js`)
- Today tab with tasks
- All tasks view (limited to 10 completed)
- AI suggestions card
- Task completion with swipe gesture

### Prospects (`AppShell.js`)
- List view with status badges
- Detail view with temperature, edit, AI message
- Add prospect modal with source dropdown
- Edit prospect modal with all fields

### Settings (`AppShell.js - SettingsTab`)
- Profile section (Name, Phone)
- Billing section (Payment, Address, Email)
- About section (Notifications, Password, Version 2.0.0)
- Appearance section (Theme toggle sun/moon)
- Logout button

## API Endpoints
- `/api/auth/login` - User authentication
- `/api/auth/register` - User registration
- `/api/auth/me` - Get user profile
- `/api/prospects` - CRUD for prospects
- `/api/tasks` - CRUD for tasks
- `/api/tasks/today` - Get today's tasks
- `/api/prospects/{id}/generate-message-ia` - AI message generation

## Testing Status
- **Test Report**: `/app/test_reports/iteration_14.json`
- **Success Rate**: 100% (Backend + Frontend)
- **Test User**: test@test.com / testtest
- **New Account Tested**: test_user_32270@test.com

## Remaining Tasks (Backlog)
1. **P1**: Security hardening (rate limiting, input validation)
2. **P2**: Refactor AppShell.js into smaller components
3. **P2**: Refactor server.py into separate routers
4. **P2**: Verify VAPID keys in production
5. **P2**: Add more languages (ES, IT, DE)
