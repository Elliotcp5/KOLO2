// =============================================================
// KOLO — Capacitor Custom Plugin (Swift)
// Presents the native Apple redemption sheet for App Store promo codes.
// Usage from JS:
//   import { KoloIAP } from '@capacitor/core';   // registered via CAP_PLUGIN
//   await KoloIAP.presentCodeRedemptionSheet();
//
// INSTALLATION (à faire dans Xcode chez toi une seule fois):
// 1. Ouvre `ios/App/App.xcworkspace` avec Xcode
// 2. File → New → File… → Swift File → nommer "KoloIAPPlugin.swift"
// 3. Copie-colle le contenu ci-dessous
// 4. Xcode va te proposer "Create Bridging Header" → clique NON (le module Capacitor est déjà là)
// 5. Fais Product → Clean Build Folder puis Build
// 6. Dans capacitor.config.ts, rien à ajouter (c'est un plugin local)
// 7. Sur le device, teste : ouvre l'app → Profil → "J'ai un code promo"
//
// Nb : `presentCodeRedemptionSheet()` fonctionne sur iOS 14+ ONLY,
// et uniquement sur un vrai device (pas dans le Simulateur).
// =============================================================

import Foundation
import Capacitor
import StoreKit

@objc(KoloIAPPlugin)
public class KoloIAPPlugin: CAPPlugin {

    @objc func presentCodeRedemptionSheet(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if #available(iOS 14.0, *) {
                SKPaymentQueue.default().presentCodeRedemptionSheet()
                call.resolve(["presented": true])
            } else {
                call.reject("iOS 14+ required for code redemption sheet")
            }
        }
    }
}
