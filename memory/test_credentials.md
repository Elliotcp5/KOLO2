# KOLO - Test Credentials

## Application principale
- **Email**: test@test.com
- **Password**: testtest

## Super Admin KOLO (accès `/kolo-admin`)
- **Email**: elliot.cohenpressard@trykolo.io
- **Méthode privilégiée**: Continuer avec Google (bouton dans /login)
- **Mot de passe de secours (si Google indispo)**: `Psychologue75007%!`
- **Allowlist**: hard-coded dans `server.py` (`KOLO_SUPER_ADMIN_EMAILS`)

## Apple Sign-In (Web)
- Statut: **placeholders** dans `backend/.env` (bouton désactivé "Bientôt disponible")
- Variables: `APPLE_SIGNIN_CLIENT_ID`, `APPLE_SIGNIN_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_PRIVATE_KEY`, `APPLE_SIGNIN_ENABLED=false`

## Environnement
- Backend (preview Emergent): https://responsive-kolo.preview.emergentagent.com
- Backend (production): https://trykolo.io
- Bundle iOS: io.kolo.app
- App Store Apple ID: 6761818371
