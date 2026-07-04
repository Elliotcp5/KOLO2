// =============================================================
// KOLO — Capacitor Custom Plugin (Swift)
// Mirror of /app/frontend/ios/App/App/KoloIAPPlugin.swift — kept in
// /app/ios_native/ so the CI/CD build script picks it up.
// See that file for docs.
// =============================================================

import Foundation
import Capacitor
import StoreKit
import UIKit

@objc(KoloIAPPlugin)
public class KoloIAPPlugin: CAPPlugin {

    @objc func presentCodeRedemptionSheet(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if #available(iOS 16.0, *) {
                guard let windowScene = self.activeWindowScene() else {
                    call.reject("no_window_scene")
                    return
                }
                Task { @MainActor in
                    do {
                        try await AppStore.presentOfferCodeRedeemSheet(in: windowScene)
                        call.resolve(["presented": true, "api": "storekit2"])
                    } catch {
                        call.reject("storekit2_error: \(error.localizedDescription)")
                    }
                }
                return
            }
            if #available(iOS 14.0, *) {
                SKPaymentQueue.default().presentCodeRedemptionSheet()
                call.resolve(["presented": true, "api": "legacy"])
                return
            }
            call.reject("ios_14_required")
        }
    }

    private func activeWindowScene() -> UIWindowScene? {
        for scene in UIApplication.shared.connectedScenes {
            if let ws = scene as? UIWindowScene, ws.activationState == .foregroundActive {
                return ws
            }
        }
        return UIApplication.shared.connectedScenes.first as? UIWindowScene
    }
}
