// =============================================================
// KOLO — Capacitor Custom Plugin (Objective-C bridging)
// Same file to add : ios/App/App/KoloIAPPlugin.m
// Registers the Swift plugin with Capacitor so JS can call it.
// =============================================================

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(KoloIAPPlugin, "KoloIAP",
    CAP_PLUGIN_METHOD(presentCodeRedemptionSheet, CAPPluginReturnPromise);
)
