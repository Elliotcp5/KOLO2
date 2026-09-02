# KOLO — Test Credentials

## Super Admin (V1 prod)
- Email: elliot.cohenpressard@trykolo.io
- Password: Psychologue75007%!

## V2 Owner Account (Pro à vie)
- Email: **pressardelliot@gmail.com**
- Auth: email-code (dev_code retourné en preview, ou code envoyé par email en prod)
- `pro_lifetime: True` → toutes fonctionnalités illimitées, jamais facturé

## Apple Review Test Account (Pro à vie + code statique)
- Email: **applereview@trykolo.io**
- Code de connexion statique : **`424242`** (UNIQUEMENT pour cet email — bypass dédié Apple)
- `pro_lifetime: True` → Apple peut tester toutes les features Pro sans avoir à recevoir un email
- **À indiquer dans App Review Information sur App Store Connect** :
  - Sign-in: Yes
  - Demo Account: `applereview@trykolo.io`
  - Demo Password / Code: `424242`
  - Notes: "Email-code authentication. Enter applereview@trykolo.io as email, click 'Recevoir un code par email', then enter the static code 424242 (this static code is only valid for this specific reviewer account). This account has Pro lifetime access to test all paid features without making real purchases."

## V2 Referral Test (seed)
- Code: TESTABCD → parrain "Marie" (`user_id=u_testref01`)
- Page publique: https://responsive-kolo.preview.emergentagent.com/r/TESTABCD

## V2 Email-Code Auth (dev)
- Tout email fonctionne — endpoint `/api/v2/auth/send-email-code` retourne `dev_code` en dev preview pour test instantané.
- Preview URL: https://responsive-kolo.preview.emergentagent.com

## IAP (App Store Connect)
- Product ID actif: **`PRO_Plus`** (display name "KOLO PRO" à 24,99€/mois)

## D1 · Bascule V2 → B1 (Sep 2, 2026)
- **Elliot basculé sur B1** : `app_version=b1`, `zones_perso=[13008]`, `zones_confirmees=false` (verra l'écran de reprise à la 1ère ouverture), `zones_suggestions=[13008, 75017]`, `tour_guide_vu=false`, `role=independant`, `plan=pro_plus`.
- **5 opportunités 13008 en statut `proposee` attribuées à Elliot** — swipe direct après validation de la reprise.
- **Endpoint admin de bascule** (X-Admin-Secret requis) :
  - `POST /api/d1/admin/bascule-b1` body `{"email": "..."}` ou `{"user_ids": ["..."]}` — bascule 1 ou N users vers B1
  - `POST /api/d1/admin/bascule-v2` — retour arrière (l'app_version repasse à v2, tout le reste préservé)
- **Endpoints reprise (user auth)** :
  - `GET /api/d1/onboarding-b1/suggestions` — retourne `zones_suggestions` (jamais liste vide, fallback `["75017"]`)
  - `POST /api/d1/onboarding-b1/confirmer-zones` body `{"codes_postaux": [...]}` — pose `zones_perso` + `zones_confirmees=true`
- **Aiguillage login** : `V2AuthPage.js::verify()` lit `app_version` de la réponse d'auth et redirige : `b1+zones_confirmees=false → /app-b1/reprise`, `b1 → /app-b1`, sinon `/app-v2`.
- **Aiguillage racine natif** : `RootRedirect` (Capacitor) lit `localStorage.kolo_app_version` et route en conséquence.

- Backend mappe `PRO_Plus → plan='pro'`
- Frontend `iapStore.PRODUCT_IDS.*` tous → `'PRO_Plus'` (single source)


## Promo codes pré-créés (collection v2_promo_codes)
- **WELCOME30** : multi-usage, +30 jours Pro (1 fois par user max)
- **VIP-ONCE** : single-use, +90 jours Pro
- Création admin via `POST /api/v2/promo/admin/create` (réservé à elliot.cohenpressard@trykolo.io ou pressardelliot@gmail.com selon ADMIN_ALERT_EMAIL)

## Referral mechanics (validé end-to-end)
1. Parrain reçoit son `code` via `/api/v2/referral/me`
2. Invité s'inscrit + appelle `/api/v2/referral/attribute` avec le code
3. Invité passe Pro (via IAP Apple OU manuel via `/api/v2/referral/convert/{user_id}`)
4. **Parrain reçoit automatiquement +30 jours de Pro bonus** (champ `pro_bonus_until` étendu)
5. `dashboard.has_pro = True` pour le parrain pendant 30j (cumulable si plusieurs filleuls)

## Admin Dashboard V3 (privé, /dashboard)
- URL: https://responsive-kolo.preview.emergentagent.com/dashboard
- Email: elliot.cohenpressard@trykolo.io
- Password: **Psychologue94340!**

## Secrets serveur
- **ADMIN_SECRET** (bypass admin, header `X-Admin-Secret`) : voir `backend/.env` (rotationné 1 Sept 2026 en début de Session A3 — l'ancien avait été partagé en clair)
- **APIFY_WEBHOOK_SECRET** (header `X-Apify-Secret` pour `POST /api/webhooks/apify`) : voir `backend/.env` (rotationné 1 Sept 2026)

