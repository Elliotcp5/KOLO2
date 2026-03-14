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

### Bottom Navigation (Final Design)
- **Active Tab**: Icon in rounded square (40x40) with gradient border, colored icon, colored text
- **Inactive Tab**: Icon in rounded square with gray border, gray icon, gray text
- **Central FAB**: 60x60 circular gradient button with shadow
- **Profile Pill**: Dynamic initials (EP = Elliot Pressard, MC = Marie Courtin)

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

## Refactored Architecture

### New File Structure
```
/app/frontend/src/
├── components/
│   ├── dashboard/
│   │   ├── StatsCards.js       # Stats display component
│   │   └── SegmentTabs.js      # Today/All Tasks tabs
│   ├── navigation/
│   │   ├── BottomNav.js        # Bottom navigation bar
│   │   └── ProfileButton.js    # Profile button with initials
│   └── index.js                # Component exports
├── hooks/
│   └── useThemeColors.js       # Theme color hook
├── utils/
│   └── helpers.js              # Utility functions
└── pages/
    └── AppShell.js             # Main app container (refactored)
```

### Extracted Components
- **BottomNav**: Bottom navigation with gradient icons
- **ProfileButton**: Profile pill with dynamic initials
- **StatsCards**: Task/prospect stats display
- **SegmentTabs**: Today/All Tasks segment control

### Utility Functions
- `getInitials(fullName)`: Extract user initials
- `formatPhoneNumber(phone)`: Format phone for display
- `truncateText(text, maxLength)`: Truncate with ellipsis
- `getStatusColor(status)`: Get prospect status color
- `getScoreColor(score)`: Get temperature color

## Version History

### v2.0.0 (March 14, 2026) - UI/UX Redesign + Refactoring ✅

**UI Fixes:**
- ✅ Dark mode - all elements visible
- ✅ Bottom navigation - exact match to design mockups
- ✅ Profile initials - dynamic based on user name
- ✅ Theme toggle - sun/moon switch
- ✅ AI Suggestions card - enhanced violet gradient (dark & light modes)

**Landing Page:**
- ✅ "Essayer gratuitement" button
- ✅ Single checkmark per benefit
- ✅ "1 mois gratuit"

**Auth Pages:**
- ✅ Login: "Content de vous revoir !"
- ✅ Register: "1 mois gratuit"

**Refactoring:**
- ✅ Extracted reusable components
- ✅ Created hooks directory
- ✅ Created utils directory
- ✅ Improved code organization

**Security:**
- ✅ Rate limiting on all public endpoints
- ✅ Input sanitization
- ✅ XSS prevention

### v2.0.1 (March 14, 2026) - AI Card Enhancement & Fork Verification ✅

**AI Card Improvements:**
- ✅ Darkened AI Suggestions card background in both themes
- ✅ Dark mode: rgba(139, 92, 246, 0.25) -> rgba(236, 72, 153, 0.2) gradient
- ✅ Light mode: rgba(124, 58, 237, 0.15) -> rgba(236, 72, 153, 0.12) gradient
- ✅ Enhanced border visibility with stronger alpha values

**Fork Verification (All Passed):**
- ✅ Onboarding flow triggers for new users (5 steps)
- ✅ AI Suggestions API returns personalized suggestions
- ✅ AI Generate Message API creates context-aware SMS
- ✅ Theme toggle works in Settings
- ✅ Bottom navigation functional
- ✅ All core APIs operational

### v2.0.2 (March 14, 2026) - Dark Mode UI Fixes ✅

**Bouton "Générer une relance IA":**
- ✅ Nouveau gradient violet identique à l'icône AI: #E82EA4 → #8A2BE2 (sombre) / #7C3AED → #EC4899 (clair)
- ✅ Visible et lisible dans les deux modes

**Modal création prospect:**
- ✅ Dropdown "Source" supprimé complètement
- ✅ Labels lisibles en mode sombre (utilise c('muted'))
- ✅ Champs de saisie avec fond sombre et texte clair

**Textes mode sombre:**
- ✅ Tâches expandées: titre, contact, téléphone, email tous lisibles
- ✅ Utilisation de c('text'), c('muted'), c('surface') au lieu de var()

**En-tête Prospects:**
- ✅ Bouton "Ajouter prospect" supprimé
- ✅ Seule la loupe de recherche reste

### v2.0.3 (March 14, 2026) - Final UI Polish ✅

**Gradients uniformisés (bleu-violet #004AAD → #CB6CE6):**
- ✅ Icône étoile AI dans suggestions IA
- ✅ Bouton "+ Add" dans suggestions IA
- ✅ Bouton "Générer une relance IA" dans tâches overdue
- ✅ Carte AI suggestions (fond avec gradient subtil)

**Boutons et modals:**
- ✅ Bouton "Create task" visible quand désactivé (fond gris, texte clair)
- ✅ Modal notifications push entièrement lisible en mode sombre
- ✅ Modal création prospect avec labels visibles

**Page Prospects:**
- ✅ Noms et contacts lisibles via classes CSS .name et .contact
- ✅ CSS utilise var(--ink) = blanc en dark mode

## Testing Status
- **Build**: ✅ Passing
- **Test User**: test@test.com / testtest
- **Last Test Report**: /app/test_reports/iteration_18.json (100% pass rate)

### v2.1.0 (March 14, 2026) - Final Polish ✅

**Landing Page:**
- ✅ Header avec plus d'espace sur mobile (padding 120px)
- ✅ Texte "D'une main" au lieu de "En une main"
- ✅ Texte "Glissez vers la droite" au lieu de "Swipe droite"
- ✅ Toast "email en route" supprimé (était faux)
- ✅ Vitesse défilement avis accélérée (25s au lieu de 40s)

**Onboarding Premium (refonte complète):**
- ✅ 5 étapes dynamiques avec animations
- ✅ Step 1: Welcome avec logo KOLO gradient
- ✅ Step 2: How it works (3 features avec icônes gradient)
- ✅ Step 3: Import contacts avec bouton gradient
- ✅ Step 4: Choix thème (clair/sombre)
- ✅ Step 5: Ready avec tips et confetti
- ✅ Tous les boutons Continue avec gradient bleu-violet

**App - Paramètres:**
- ✅ Modification nom fonctionne (API /api/auth/update-name)
- ✅ Modification téléphone fonctionne (API /api/auth/update-phone)
- ✅ Section "Permissions" avec "Accès aux contacts"
- ✅ Section "Support" avec "Nous contacter" (mailto:contact@trykolo.io)
- ✅ Modal résiliation lisible en mode sombre

**App - Dashboard:**
- ✅ Bouton "Toutes mes tâches" (symétrique avec "Aujourd'hui")
- ✅ Nombre de tâches "À faire" >= 0
- ✅ Import contacts dans modal ajout prospect

## Remaining Tasks (Backlog)
1. **P2**: Continue refactoring AppShell.js (still ~5600 lines)
2. **P2**: Refactor server.py into separate routers
3. **P2**: Add more languages (ES, IT, DE)
4. **P3**: Verify VAPID keys in production
