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
