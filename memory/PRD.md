# KOLO PRD (Product Requirements Document)

## Project Overview
**Name:** KOLO  
**Domain:** https://trykolo.io  
**Type:** Mobile-first PWA CRM for real estate agents  
**Date Created:** February 16, 2026
**Last Updated:** February 16, 2026

## Original Problem Statement
Build a mobile-first Web App (PWA) named KOLO - an iOS-style dark-mode fintech/CRM app with purple accent for independent real estate agents. Features include subscription-gated access, regional pricing, and prospect management.

## User Personas
1. **Independent Real Estate Agent (France)** - Primary user who needs to track prospects and follow-ups
2. **International Agent** - Users from UK, US, and other countries with localized pricing

## Core Requirements (Static)
- Mobile-first PWA design (390×844px viewport)
- Dark mode iOS-style UI with purple accent (#7C3AED)
- Multi-language support (FR/EN auto-detect)
- Regional pricing (EUR 9.99, GBP 9.99, USD 9.99)
- Stripe subscription payments with Card and Apple Pay
- Google OAuth via Emergent Auth
- Prospect CRM with CRUD operations

## What's Been Implemented ✅
**Date: February 16, 2026**

### Backend (FastAPI + MongoDB)
- ✅ User authentication with Emergent Google OAuth
- ✅ Session management with 7-day expiry
- ✅ Stripe checkout integration with regional pricing (EUR/GBP/USD)
- ✅ Payment status polling and success tokens
- ✅ Prospect CRUD APIs (create, read, update, delete)
- ✅ Geo-detection endpoint for regional pricing
- ✅ Subscription status gating

### Frontend (React + Tailwind)
- ✅ Landing page with KOLO logo, hero, expandable features, regional pricing
- ✅ Login page with Google OAuth ("C'est bon de vous revoir !")
- ✅ Subscribe page with Card + Apple Pay options
- ✅ Create Account page (gated after payment)
- ✅ App shell with bottom navigation (3 tabs)
- ✅ Today tab (follow-up tasks - French date format)
- ✅ Prospects tab with list and "Ajouter un Prospect"
- ✅ Settings tab with billing options (all in French)
- ✅ New Prospect form with localized source/status options
- ✅ Full French localization (FR) and English (EN)
- ✅ URL locale override (?locale=fr-FR&country=FR)

### French Translations Fixed
- ✅ "C'est bon de vous revoir !" for welcome back
- ✅ "Rappels basés sur vos tâches et votre activité réelle." for smart reminders
- ✅ Regional pricing 9,99 € for France/EU

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Authentication flow
- [x] Payment flow with Apple Pay
- [x] Basic prospect management
- [x] French localization

### P1 (Important)
- [ ] Follow-up task scheduling
- [ ] Push notifications for reminders
- [ ] Prospect detail view/edit
- [ ] PWA manifest and service worker

### P2 (Nice to Have)
- [ ] Activity timeline per prospect
- [ ] Email/WhatsApp integration
- [ ] Dashboard analytics
- [ ] Export prospects to CSV

## Next Tasks
1. Add PWA manifest.json for app installation on home screen
2. Implement follow-up task scheduling with date picker
3. Add prospect detail view with edit capability
4. Integrate push notifications for task reminders
5. Add activity logging per prospect

## Technical Architecture
```
Frontend (React 19)
├── Pages: Landing, Login, Subscribe, CreateAccount, App Shell, NewProspect
├── Context: AuthContext, LocaleContext (FR/EN + EUR/GBP/USD)
├── Styling: Tailwind CSS + Custom CSS variables
└── Components: Shadcn/UI base

Backend (FastAPI)
├── Auth: Emergent Google OAuth
├── Payments: Stripe Checkout (Card + Apple Pay)
├── Database: MongoDB (Motor async)
└── Collections: users, user_sessions, prospects, payment_transactions, payment_success

Environment
├── Frontend: REACT_APP_BACKEND_URL
└── Backend: MONGO_URL, DB_NAME, STRIPE_API_KEY
```
