# KOLO - Applications iOS & Android

## Prérequis

### Pour iOS (Mac uniquement)
- macOS avec Xcode 14+
- CocoaPods (`sudo gem install cocoapods`)
- Un compte Apple Developer (99€/an pour publier sur l'App Store)

### Pour Android
- Android Studio
- JDK 17+
- Un compte Google Play Developer (25$ une seule fois)

---

## 1. Cloner le projet

```bash
git clone https://github.com/elliotcp5/KOLO-WEB-APP.git
cd KOLO-WEB-APP/frontend
```

---

## 2. Installer les dépendances

```bash
yarn install
```

---

## 3. Configurer les variables d'environnement

Créez un fichier `.env` dans le dossier `frontend` :

```env
REACT_APP_BACKEND_URL=https://votre-api-production.com
```

---

## 4. Build de la web app

```bash
yarn build
```

---

## 5. Synchroniser avec Capacitor

```bash
npx cap sync
```

---

## 6. Ouvrir dans l'IDE natif

### iOS (Xcode)
```bash
npx cap open ios
```

Dans Xcode :
1. Sélectionnez votre équipe de développement (Signing & Capabilities)
2. Connectez votre iPhone ou utilisez le simulateur
3. Cliquez sur ▶️ (Run)

### Android (Android Studio)
```bash
npx cap open android
```

Dans Android Studio :
1. Attendez que Gradle sync
2. Connectez votre téléphone Android ou utilisez l'émulateur
3. Cliquez sur ▶️ (Run)

---

## 7. Icônes et Splash Screen

### Générer les icônes automatiquement

1. Placez votre icône (1024x1024 PNG) dans `resources/icon.png`
2. Placez votre splash screen (2732x2732 PNG) dans `resources/splash.png`
3. Exécutez :

```bash
npm install -g cordova-res
cordova-res ios --skip-config --copy
cordova-res android --skip-config --copy
```

---

## 8. Publier sur les stores

### App Store (iOS)
1. Dans Xcode : Product > Archive
2. Distribuez via App Store Connect
3. Remplissez les métadonnées et soumettez pour review

### Google Play (Android)
1. Dans Android Studio : Build > Generate Signed Bundle/APK
2. Créez un AAB (Android App Bundle)
3. Uploadez sur la Google Play Console

---

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `yarn build` | Build la web app |
| `npx cap sync` | Synchronise le build avec les projets natifs |
| `npx cap open ios` | Ouvre Xcode |
| `npx cap open android` | Ouvre Android Studio |
| `npx cap run ios` | Lance sur iOS (simulateur/device) |
| `npx cap run android` | Lance sur Android (émulateur/device) |

---

## Structure du projet Capacitor

```
frontend/
├── ios/                    # Projet Xcode
│   └── App/
│       └── App/
│           ├── Info.plist  # Config iOS
│           └── Assets.xcassets/  # Icônes iOS
├── android/                # Projet Android Studio
│   └── app/
│       └── src/main/
│           ├── AndroidManifest.xml
│           └── res/        # Icônes Android
├── capacitor.config.ts     # Config Capacitor
└── build/                  # Web app compilée
```

---

## Support

Pour toute question : contactez le développeur via l'app KOLO.
