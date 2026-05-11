# KOLO – Product Requirements (PRD)

## Vision
SaaS pour agents immobiliers avec CRM + IA. Disponible en web (Stripe) et iOS natif (Apple StoreKit 2). Multilingue (fr/en/de/it).

## Architecture
- Frontend: React + Capacitor (iOS native)
- Backend: FastAPI monolithique (`/app/backend/server.py`) + MongoDB
- Paiements: Stripe (web) + Apple StoreKit 2 (iOS)
- Production: https://trykolo.io

## Récent (Mai 2026)
- ✅ App publiée sur l'App Store iOS (ID `6761818371`)
- ✅ Bug critique Stripe SDK 14.x corrigé:
  - `sub.items` (collision avec `dict.items()` Python) → `sub["items"]` (6 endroits)
  - `sub.current_period_end` (champ déplacé vers items.data[0] en API v2025+) → helper `_stripe_sub_current_period_end()` (5 endroits)
  - Conséquence: webhook + `sync_subscription_from_stripe` réparés → utilisateurs payants débloqués au prochain login
- ✅ Endpoint debug `GET /api/debug/sync-status?email=...&admin_key=...` ajouté (à supprimer après stabilisation)
- ✅ Self-heal Stripe ajouté dans `/api/auth/login` et `/api/auth/me` (throttle 30s)
- ✅ Bouton "Télécharger sur l'App Store" ajouté sur landing page (`LandingPageNew.js`):
  - Localisé fr/en/de/it (storefront + badge officiel Apple + caption)
  - Caché sur l'app iOS native (`Capacitor.isNativePlatform()`)
  - Présent dans hero + final CTA

## Backlog (P2 post-stabilisation)
- Modulariser `server.py` (~5000 lignes) en routers FastAPI
- Décomposer `AppShell.js` (~7000 lignes)
- Refactor des dépendances `useEffect`/`useCallback`
- Supprimer endpoint `/api/debug/sync-status` une fois prod stable
- Considérer un bouton "Forcer la synchronisation Stripe" côté user pour réduire le support

## Comptes test
- `test@test.com` / `testtest` (standard)
- `test@apple.com` (compte Stripe utilisé pour valider le fix de sync)
