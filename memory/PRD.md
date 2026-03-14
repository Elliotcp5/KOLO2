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

### Bottom Navigation
- **Today Tab Active**: Gradient text + icon with gradient border
- **Central FAB**: Gradient rounded button with glow shadow
- **Prospects Tab Inactive**: Gray icon and text
- **Profile Pill**: Dynamic initials from user's full name (EP = Elliot Pressard, MC = Marie Courtin)

### Typography
- Heading Font: League Spartan
- Body Font: DM Sans
- H1: 32px, 800 weight
- H2: 22px, 700 weight
- Body: 15px, 400 weight
- Caption: 13px, 500 weight

## Security Hardening ✅

### Rate Limiting (via slowapi)
- **Auth endpoints**: 10 requests/minute/IP
- **Prospects endpoints**: 100 requests/minute/IP
- **AI generation endpoints**: 30 requests/minute/IP

### Input Validation
- Email format validation (regex)
- Phone format validation (international format support)
- Password strength: 6-128 characters
- Input sanitization: HTML escape, length limits
- XSS prevention

## Version History

### v2.0.0 (March 14, 2026) - UI/UX Redesign + Security ✅

**UI Fixes:**
- ✅ Dark mode - all text and icons visible
- ✅ Bottom navigation - gradient active states, glow FAB
- ✅ Profile initials - dynamic based on user name
- ✅ Settings page icons - theme-aware colors
- ✅ Theme toggle - sun/moon switch
- ✅ Version 2.0.0

**Landing Page:**
- ✅ "Essayer gratuitement" button
- ✅ Single checkmark per benefit
- ✅ Header spacing improved
- ✅ "1 mois gratuit"

**Auth Pages:**
- ✅ Login: "Content de vous revoir !"
- ✅ Register: "1 mois gratuit"
- ✅ KOLO text logo with colored dot

**Security:**
- ✅ Rate limiting on all public endpoints
- ✅ Input sanitization
- ✅ Email/phone validation
- ✅ XSS prevention

## Pages & Components

### Dashboard (`AppShell.js`)
- KOLO logo + Profile pill with dynamic initials
- Stats cards (Done, Prospects, To do)
- AI suggestions card
- Task list with swipe-to-complete
- Bottom navigation with gradient active states

### Settings (`AppShell.js - SettingsTab`)
- Profile section (Name, Phone)
- Billing section
- Notifications toggle
- Theme toggle (sun/moon)
- Version 2.0.0
- Logout button

## API Endpoints (with rate limits)
- `/api/auth/login` - 10/min
- `/api/auth/register` - 10/min
- `/api/prospects` - 100/min
- `/api/prospects/{id}/generate-message` - 30/min

## Testing Status
- **Test Report**: `/app/test_reports/iteration_14.json`
- **Success Rate**: 100%
- **Test User**: test@test.com / testtest

## Remaining Tasks (Backlog)
1. **P2**: Refactor AppShell.js (~5400 lines → smaller components)
2. **P2**: Refactor server.py into separate routers
3. **P2**: Add more languages (ES, IT, DE)
4. **P3**: Verify VAPID keys in production
