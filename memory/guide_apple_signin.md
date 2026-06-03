# 🍎 Guide — Activer Sign in with Apple (Web) pour KOLO

Tu as un compte **Apple Developer Program** payant (~99 $/an). Voici les étapes exactes (compte ~10 min).

## Étape 1 — Créer un App ID
1. Va sur https://developer.apple.com/account/resources/identifiers/list
2. Clique **+** (en haut)
3. Sélectionne **App IDs** → Continue → **App** → Continue
4. **Description** : `KOLO Real Estate`
5. **Bundle ID** : Explicit → `io.kolo.app` *(c'est l'ID iOS — si déjà créé, saute cette étape)*
6. Dans la liste **Capabilities**, coche **Sign In with Apple** ✅
7. Continue → Register

## Étape 2 — Créer un Services ID (= ton "Client ID" Web)
C'est ÇA qui identifie ton bouton Apple sur le web (différent de l'app iOS).

1. Toujours sur https://developer.apple.com/account/resources/identifiers/list
2. Clique **+** → **Services IDs** → Continue
3. **Description** : `KOLO Web Sign-In`
4. **Identifier** : `io.kolo.signin` *(c'est ce qui sera ton `APPLE_SIGNIN_CLIENT_ID`)*
5. Continue → Register
6. **Clique sur le Service ID que tu viens de créer** dans la liste
7. Coche **Sign in with Apple** → clique **Configure** à droite
8. **Primary App ID** : sélectionne `io.kolo.app`
9. **Domains and Subdomains** : `trykolo.io`
10. **Return URLs** : `https://trykolo.io/api/auth/apple/callback`
11. Save → Continue → Save

## Étape 3 — Créer une Sign In Key (clé privée)
1. Va sur https://developer.apple.com/account/resources/authkeys/list
2. Clique **+**
3. **Key Name** : `KOLO Sign In Web Key`
4. Coche **Sign in with Apple** ✅
5. À droite de la case, clique **Configure** → Primary App ID `io.kolo.app` → Save
6. Continue → Register
7. **⚠️ TÉLÉCHARGE LE FICHIER `.p8` MAINTENANT** (impossible de re-télécharger après)
8. Note le **Key ID** affiché (10 caractères, ex: `ABCD123EFG`)

## Étape 4 — Récupère ton Team ID
1. https://developer.apple.com/account → en haut à droite, sous ton nom → **Membership details**
2. **Team ID** : ex `XYZ123ABCD` (10 caractères)

## ✅ Envoie-moi ces 4 valeurs
Une fois tout fait, donne-moi en une seule fois :
```
APPLE_SIGNIN_CLIENT_ID = io.kolo.signin        (le Services ID)
APPLE_SIGNIN_TEAM_ID = XXXXXXXXXX              (Team ID, 10 chars)
APPLE_SIGNIN_KEY_ID = XXXXXXXXXX               (Key ID, 10 chars)
APPLE_SIGNIN_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
...
-----END PRIVATE KEY-----
```
(Le `.p8` est un fichier texte, ouvre-le avec TextEdit et copie tout son contenu.)

Je m'occupe du reste : exchange Apple → backend KOLO → session → redirection.
