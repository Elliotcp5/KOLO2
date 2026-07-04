// =============================================================
// KOLO — Capacitor Custom Plugin (Swift)
// Presents the native Apple redemption sheet for App Store promo codes.
//
// Usage from JS:
//   const { Capacitor } = await import('@capacitor/core');
//   await Capacitor.Plugins.KoloIAP.presentCodeRedemptionSheet();
//
// This plugin uses:
//   • iOS 16+  → StoreKit 2  AppStore.presentOfferCodeRedeemSheet(in:)
//     (the modern, NON-deprecated API — required to avoid iOS 18 warnings
//     and to actually work reliably on newer devices)
//   • iOS 14–15 → legacy SKPaymentQueue.presentCodeRedemptionSheet()
//
// The plugin ALWAYS resolves, never rejects for user-cancel or non-fatal
// UI errors, so the JS side can decide whether to fall back to the App
// Store URL scheme.
// =============================================================

import Foundation
import Capacitor
import StoreKit
import UIKit

@objc(KoloIAPPlugin)
public class KoloIAPPlugin: CAPPlugin {

    /// Present the App Store code redemption sheet.
    /// Resolves `{ presented: true, api: "storekit2" | "legacy" }` on success.
    /// Rejects only on hard misconfig (missing window scene, iOS < 14).
    @objc func presentCodeRedemptionSheet(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // -------- iOS 16+ : StoreKit 2 (non-deprecated) --------
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
                        // presentOfferCodeRedeemSheet can throw if the sheet
                        // can't be shown (e.g. simulator, no store account).
                        call.reject("storekit2_error: \(error.localizedDescription)")
                    }
                }
                return
            }

            // -------- iOS 14–15 : Legacy StoreKit 1 --------
            if #available(iOS 14.0, *) {
                SKPaymentQueue.default().presentCodeRedemptionSheet()
                call.resolve(["presented": true, "api": "legacy"])
                return
            }

            call.reject("ios_14_required")
        }
    }

    /// Find the currently-active foreground window scene (needed by
    /// StoreKit 2's presentOfferCodeRedeemSheet).
    private func activeWindowScene() -> UIWindowScene? {
        for scene in UIApplication.shared.connectedScenes {
            if let ws = scene as? UIWindowScene, ws.activationState == .foregroundActive {
                return ws
            }
        }
        // Fallback: any window scene (may still work).
        return UIApplication.shared.connectedScenes.first as? UIWindowScene
    }
}
