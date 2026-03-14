# KOLO - Product Requirements Document

## Overview
KOLO is a mobile-first CRM application designed for independent real estate agents. It uses AI to help agents track prospects, schedule follow-ups, and close more deals.

## Core Features
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

## Version History

### v2.0.0 (March 14, 2026) - UI/UX Redesign Complete
**Fixed Issues:**
- Dark mode visibility - all text and icons now visible
- Settings page icons - proper theme-aware colors
- Edit prospect modal - displays all fields correctly
- Source dropdown in add prospect - fully functional
- Temperature button in prospect detail - visible with proper styling
- Theme toggle - sun/moon switch implementation
- Version number updated to 2.0.0
- Logout button visibility
- Profile settings icons

**Design System:**
- Fonts: League Spartan (headings), DM Sans (body)
- Colors: Blue (#004AAD), Purple (#CB6CE6), gradient
- Border radius: 8px, 12px, 16px, 999px (pills)
- Shadows: Light mode only

### v1.x (Previous Versions)
- Initial implementation of all core features
- AI integration for task suggestions and message generation
- Stripe subscription and trial period
- Push notifications
- Onboarding tutorial

## Pages & Components

### Landing Page (`LandingPageNew.js`)
- Header with KOLO logo, language selector (FR/EN), Login, Try for free
- Hero section with headline and phone mockups
- Features section
- Pricing section
- FAQ section

### Login/Register Pages
- KOLO text logo with accent dot
- Gradient CTA buttons
- Form validation

### Dashboard (`AppShell.js`)
- Today tab with tasks
- All my tasks view (limited to 10 completed)
- AI suggestions card
- Task completion with swipe gesture

### Prospects (`AppShell.js`)
- List view with status badges
- Detail view with temperature, edit, AI message
- Add prospect modal with source dropdown
- Edit prospect modal

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

## Testing
- Test user: test@test.com / testtest
- All UI flows verified in light and dark mode
- Source dropdown verified working
- Edit modal verified showing all fields

## Remaining Tasks (Backlog)
1. **P1**: Verify onboarding/tutorial flow end-to-end
2. **P1**: Verify AI features quality and speed
3. **P1**: Full security hardening (rate limiting, input validation)
4. **P2**: Refactor AppShell.js into smaller components
5. **P2**: Refactor server.py into separate routers
6. **P2**: Verify VAPID keys in production
