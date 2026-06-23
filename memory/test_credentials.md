# KOLO — Test Credentials

## Super Admin (V1 prod)
- Email: elliot.cohenpressard@trykolo.io
- Password: Psychologue75007%!
- Notes: hardcoded fallback super admin, plan PRO+ lifetime.

## V2 Email-Code Auth (preview/dev)
- Tout email fonctionne — endpoint `/api/v2/auth/send-email-code` retourne `dev_code` en dev preview pour test instantané.
- Endpoint preview: https://responsive-kolo.preview.emergentagent.com
- Pour user déjà onboardé pour tester la home directement: `test.premium.ui@kolo.io`
- Pour tester un nouveau onboarding (étape 5 chips): utiliser un email frais (ex. `onb.<uuid>@kolo.io`)

## V2 Referral (test seed)
- Code: TESTABCD → parrain "Marie" (`user_id=u_testref01`)
- Page publique: https://responsive-kolo.preview.emergentagent.com/r/TESTABCD
