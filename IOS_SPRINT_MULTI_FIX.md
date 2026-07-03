# KOLO — Sprint iOS multi-fix (3 juillet 2026)

## Ce qui a été fait automatiquement (déjà en preview + code prêt à builder)

### Sprint 1 — Quick wins UI
- ✅ Tag `askKOLO` → traduit dans les 5 langues : `Demander à KOLO`, `Ask KOLO`, `KOLO fragen`, `Chiedi a KOLO`, `Preguntar a KOLO`
- ✅ 17 clés du menu latéral traduites en FR / EN / DE / IT / ES (`drawer.features`, `drawer.prospecting`, `drawer.referral`, `drawer.account`, `drawer.legal`, etc.) et branchées dans `V2Layout.js`
- ✅ Onboarding slide 2 (Privacy first) refait : label consent dans une card avec checkbox propre, checkbox 20px, styles CSS dédiés (`.v2-onb-consent`)
- ✅ Transitions entre pages : `translate3d` réduit de 60px → 24px, durée passée à 320ms, `contain: layout style paint`, `scroll-behavior: smooth`. Fluidité améliorée.

### Sprint 2 — Saisie vocale
- ✅ `useSpeech` hook réécrit dans `V2Modals.js` :
  - `rec.lang` désormais dynamique via `localStorage.v2_lang` (FR/EN/DE/IT → `fr-FR`, `en-US`, `de-DE`, `it-IT`)
  - `continuous: true` + `interimResults: true` + auto-restart sur `onend` (fix du bug iOS "démarre et s'arrête tout seul" causé par la fin auto sur silence)
  - Buffer `finalBufferRef` pour éviter la perte de texte
  - Message d'erreur clair si micro refusé ("Micro non autorisé. Activez le micro dans les Réglages iOS.")

### Sprint 3 — Prospection Annonces
- ✅ Script de seed Supabase créé : `/app/supabase_seed_listings.sql`
  - Génère ~525 annonces réalistes réparties sur 35 villes/CP français
  - Prix/surfaces réalistes 2024-2025 par ville
  - Titres, DPE, ratio pro/private, dates first_seen_at étalées sur 120 jours
  - À coller dans **Supabase SQL Editor** après `supabase_setup.sql`, puis Run.
  - Résultat immédiat : la Pige "Annonces" affiche instantanément des résultats au lieu de "chargement infini".

### Sprint 4 — Algo d'estimation immo
- ✅ `estimate_property` dans `v2_router.py` réécrit :
  - **Pondération par similarité** (surface ±60%, écart de pièces)
  - **Revalorisation temporelle** : `+2.5%/an` sur les transactions DVF anciennes
  - **Fallback CP voisins** : si <12 échantillons sur le CP, on interroge les CP à ±1 et ±2 du dernier chiffre
  - **Trim 10-90 percentile** conservé + **médiane pondérée** (cumulative weights)
  - **Ajustements hédoniques** DPE / année / surface (studios prime +6%, grands biens -4%)
  - **Confiance** basée sur la somme des poids (effective sample size)
  - Retourne `revalued_ppm` et `weight` dans les comparables

### Sprint 5 — Codes promo App Store (natif Swift)
- ✅ Plugin Capacitor prêt à installer : `/app/ios_native/KoloIAPPlugin.swift` + `.m`
- ✅ Bouton "J&apos;ai un code App Store" ajouté dans `V2SubscriptionPage.js` — appelle `Capacitor.Plugins.KoloIAP.presentCodeRedemptionSheet()`

## ⚠️ Ce que tu dois faire manuellement (impossible depuis Emergent)

### Étape 1 — Copier le seed dans Supabase (30 sec)
Ouvre https://supabase.com/dashboard → ton projet → **SQL Editor** → **New query** → copie-colle le contenu de `/app/supabase_seed_listings.sql` → **Run**. Ça remplit la table `listings` avec ~525 annonces et débloque immédiatement la Pige.

### Étape 2 — Installer le plugin Swift dans ton projet iOS (5 min, une seule fois)
1. Sur ton Mac, ouvre le workspace Capacitor : `ios/App/App.xcworkspace`
2. Dans Xcode, clic droit sur le dossier `App` (celui qui contient `AppDelegate.swift`) → **New File** → **Swift File** → nomme-le `KoloIAPPlugin.swift`
3. Colle le contenu de `/app/ios_native/KoloIAPPlugin.swift`
4. Xcode va peut-être proposer "Create Bridging Header" → **clique NON** (Capacitor s'en charge)
5. Refais **New File** → **Objective-C File** → `KoloIAPPlugin.m`
6. Colle le contenu de `/app/ios_native/KoloIAPPlugin.m`
7. **Product → Clean Build Folder** puis **Product → Build**
8. Le plugin est enregistré. Depuis JS : `Capacitor.Plugins.KoloIAP.presentCodeRedemptionSheet()` ouvre la fenêtre Apple native.

⚠️ **`presentCodeRedemptionSheet()` ne fonctionne PAS dans le Simulateur** — teste sur un vrai iPhone.

### Étape 3 — Rebuild + push TestFlight
Après les 2 étapes ci-dessus + un `npx cap sync ios`, incrémente le build number dans Xcode, archive et push sur App Store Connect / TestFlight.

## Fichiers modifiés/créés

- `/app/frontend/src/v2/V2Modals.js` — hook `useSpeech` corrigé
- `/app/frontend/src/v2/v2i18n.js` — 5 × 17 clés `drawer.*` + `askKOLO` traduit
- `/app/frontend/src/v2/V2Layout.js` — drawer branché sur v2t()
- `/app/frontend/src/v2/pages/V2OnboardingPage.js` — slide 2 refait
- `/app/frontend/src/v2/pages/V2SubscriptionPage.js` — bouton "J'ai un code App Store"
- `/app/frontend/src/styles/v2.css` — transitions plus fluides + styles onboarding consent
- `/app/backend/v2_router.py` — `/estimate` amélioré
- `/app/supabase_seed_listings.sql` — seed Supabase 525 annonces
- `/app/ios_native/KoloIAPPlugin.swift` — plugin natif (à copier dans Xcode)
- `/app/ios_native/KoloIAPPlugin.m` — bridging Obj-C (à copier dans Xcode)
