# KOLO - Test Credentials

## Application principale
- **Email**: test@test.com
- **Password**: testtest

## Super Admin KOLO (accès `/kolo-admin` + bypass org membership)
- **Email**: elliot.cohenpressard@trykolo.io
- **Méthode privilégiée**: Continuer avec Google (bouton dans /login)
- **Mot de passe de secours**: `Psychologue75007%!`
- **Allowlist**: hard-coded dans `server.py` (`KOLO_SUPER_ADMIN_EMAILS`)

## Apple Sign-In (Web)
- Statut: **placeholders** dans `backend/.env` (bouton désactivé "Bientôt disponible")
- Variables: `APPLE_SIGNIN_CLIENT_ID`, `APPLE_SIGNIN_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_PRIVATE_KEY`, `APPLE_SIGNIN_ENABLED=false`

## Phase 3 — Intégrations (placeholders dans backend/.env)
- **Twilio Voice**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- **WhatsApp Business**: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN=kolo_wa_verify_2026` (déjà fixée), `WHATSAPP_APP_SECRET` (sécurité signature webhook)
- **Google Calendar**: `GOOGLE_CAL_CLIENT_ID`, `GOOGLE_CAL_CLIENT_SECRET`
- **OpenAI Whisper**: `EMERGENT_LLM_KEY=sk-emergent-27dA4CbFe23205352D` (Emergent Universal Key — DÉJÀ ACTIVÉE)
- **Outlook + Apple Calendar**: bouton "Bientôt disponible" (pas d'env nécessaire)

## Environnement
- Backend (preview Emergent): https://responsive-kolo.preview.emergentagent.com
- Backend (production): https://trykolo.io
- Bundle iOS: io.kolo.app
- App Store Apple ID: 6761818371

## Tests automatiques (seed pour pytest)
Voir `/app/auth_testing.md` pour le script mongosh complet.
