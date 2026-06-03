# KOLO - Test Credentials

## Application principale
- **Email**: test@test.com
- **Password**: testtest

## Super Admin KOLO (accès `/kolo-admin` + bypass org membership)
- **Email**: elliot.cohenpressard@trykolo.io
- **Mot de passe**: `Psychologue75007%!`
- **Provider**: email/password (le compte n'est pas Google)
- **Méthodes de connexion** : Email/password sur `/login` OU Google Sign-In (si tu actives le même email avec Google plus tard)
- **Allowlist super admin**: hard-coded dans `server.py` (`KOLO_SUPER_ADMIN_EMAILS`)
- **Plan**: pro_plus (active subscription)

## Apple Sign-In (Web)
- Statut: **placeholders** dans `backend/.env` (bouton désactivé "Bientôt disponible")
- Variables: `APPLE_SIGNIN_CLIENT_ID`, `APPLE_SIGNIN_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_PRIVATE_KEY`, `APPLE_SIGNIN_ENABLED=false`

## Phase 3 — Intégrations (placeholders dans backend/.env)
- **Twilio Voice**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- **WhatsApp Business**: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN=kolo_wa_verify_2026` (déjà fixée), `WHATSAPP_APP_SECRET` (sécurité signature webhook)
- **Google Calendar**: ✅ ACTIVÉ — `GOOGLE_CAL_CLIENT_ID` et `GOOGLE_CAL_CLIENT_SECRET` configurés. Redirect URI : `https://trykolo.io/api/integrations/google-calendar/callback` (à ajouter dans Google Cloud Console)
- **Outlook (Microsoft Graph)**: ✅ ACTIVÉ — `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT=common`. Redirect URI : `https://trykolo.io/api/integrations/outlook-calendar/callback` (à ajouter dans Azure App Registration)
- **OpenAI Whisper**: `EMERGENT_LLM_KEY=sk-emergent-27dA4CbFe23205352D` (Emergent Universal Key — DÉJÀ ACTIVÉE)
- **Apple Calendar**: bouton "Bientôt disponible" (CalDAV à implémenter)

## ⚠️ Production — variables à ajouter
**Pour que la connexion super admin fonctionne en production** :
- Ajouter dans les env vars de production : `SUPER_ADMIN_SEED_PASSWORD=Psychologue75007%!`
- Au prochain redémarrage du backend, le seed idempotent (re)crée/réinitialise le compte `elliot.cohenpressard@trykolo.io` avec ce mot de passe et le flag `is_super_admin: true`, plan `pro_plus`.
- Le seed s'exécute à chaque startup → sécurise l'accès même après reset DB.

**Pour activer Google Calendar et Outlook en prod** : ajouter aussi
- `GOOGLE_CAL_CLIENT_ID`, `GOOGLE_CAL_CLIENT_SECRET`
- `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT=common`
- `FRONTEND_URL=https://trykolo.io`

## Environnement
- Backend (preview Emergent): https://responsive-kolo.preview.emergentagent.com
- Backend (production): https://trykolo.io
- Bundle iOS: io.kolo.app
- App Store Apple ID: 6761818371

## Tests automatiques (seed pour pytest)
Voir `/app/auth_testing.md` pour le script mongosh complet.
