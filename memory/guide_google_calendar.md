# 🗓️ Guide — Activer Google Calendar API pour KOLO

⚠️ **Important** : Google Calendar API est SÉPARÉE du Sign-In Google que tu utilises déjà (via Emergent). Tu dois créer un projet Google Cloud dédié.

Temps total : ~5 min.

## Étape 1 — Créer un projet Google Cloud
1. Va sur https://console.cloud.google.com
2. En haut, clique sur le sélecteur de projet → **NEW PROJECT**
3. **Project name** : `KOLO`
4. **Location** : laisse par défaut
5. **CREATE** → attends que le projet soit créé puis sélectionne-le

## Étape 2 — Activer l'API Google Calendar
1. Dans la barre de recherche en haut, tape `Calendar API`
2. Clique sur **Google Calendar API**
3. Clique **ENABLE** (bleu)

## Étape 3 — Configurer l'écran de consentement OAuth
1. Menu hamburger ☰ → **APIs & Services** → **OAuth consent screen**
2. **User Type** : `External` → Create
3. Remplis :
   - **App name** : `KOLO`
   - **User support email** : ton email
   - **App logo** : (optionnel)
   - **Application home page** : `https://trykolo.io`
   - **Authorized domains** : ajoute `trykolo.io`
   - **Developer contact** : ton email
   - Save and Continue
4. **Scopes** : clique **ADD OR REMOVE SCOPES** → coche :
   - `.../auth/calendar` (Voir, modifier, partager, supprimer des agendas)
   - `.../auth/userinfo.email`
   - `openid`
   - Save → Save and Continue
5. **Test users** : ajoute ton email (et ceux de tes premiers users de test) → Save and Continue
6. Back to Dashboard

## Étape 4 — Créer les credentials OAuth Web
1. Menu ☰ → **APIs & Services** → **Credentials**
2. **+ CREATE CREDENTIALS** → **OAuth client ID**
3. **Application type** : `Web application`
4. **Name** : `KOLO Web Backend`
5. **Authorized redirect URIs** : ajoute LES DEUX urls suivantes (une par environnement) :
   ```
   https://trykolo.io/api/integrations/google-calendar/callback
   https://responsive-kolo.preview.emergentagent.com/api/integrations/google-calendar/callback
   ```
6. **CREATE**
7. Une popup affiche :
   - **Client ID** : `XXXX.apps.googleusercontent.com`
   - **Client secret** : `GOCSPX-XXXX`

## ✅ Envoie-moi ces 2 valeurs
```
GOOGLE_CAL_CLIENT_ID = XXXX.apps.googleusercontent.com
GOOGLE_CAL_CLIENT_SECRET = GOCSPX-XXXX
```

Je les colle dans `/app/backend/.env`, je redémarre le backend, et le bouton "Connecter Google Calendar" passe automatiquement en vert dans `/integrations`.

## ⚡ Pendant la phase de test
Tant que ton OAuth Consent Screen est en mode **Testing** (pas Published), seuls les emails dans la liste "Test users" peuvent s'y connecter. Pour ouvrir à tous, clique **PUBLISH APP** quand tu seras prêt (peut demander une vérification Google ~ 1 semaine si le scope `calendar` est inclus, mais ce n'est PAS obligatoire pour tester).
