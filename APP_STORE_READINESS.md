# KOLO App Store Readiness Audit
*Last updated: Feb 2026 — iteration 52*

## ✅ Already in place
- **Account deletion** : endpoint `/api/v2/settings/delete` + UI in drawer (`drawer-delete`)
- **Apple IAP backend** : `/api/iap/verify-apple-receipt` operational with bundle id `io.kolo.app`
- **Google Play Billing backend** : `/api/iap/verify-google-purchase` scaffold ready, needs Service Account JSON
- **Privacy policy** : `https://trykolo.io/privacy` (translated 7 locales)
- **Terms of service** : `https://trykolo.io/terms`
- **Onboarding consent** : accepted_terms checkbox (data-testid `onb-accept-terms`)
- **Resend email** : transactional emails compliant with unsubscribe footer
- **Capacitor base config** : `/app/frontend/capacitor.config.ts` with `appId=io.kolo.app`, push notifs, splash, status bar, keyboard
- **Service worker** : `/app/frontend/public/sw.js` for web push
- **VAPID keys** : already generated, push notification pipeline live
- **Icons** : 192, 512, 180 (apple-touch-icon) present in `/app/frontend/public/`

## ⚠️ TODO before App Store submission

### iOS-specific
1. **Capacitor config theme** : currently `backgroundColor: '#0F0F0F'` (dark) — V2 is light. Switch to `#FBFBFC` if V2 becomes primary. Update `StatusBar.style` to `'dark'`.
2. **Splash screen** : design + generate light-theme variant for V2 (1290×2796 iOS, 1080×2400 Android). Update via `npx @capacitor/assets generate`.
3. **Microphone usage description** in `ios/App/App/Info.plist` :
   ```xml
   <key>NSMicrophoneUsageDescription</key>
   <string>KOLO utilise le microphone pour enregistrer tes notes vocales de terrain.</string>
   ```
4. **Push notification entitlement** : enable `aps-environment=production` in App.entitlements after first push prod test.
5. **App icon 1024×1024 (square, no transparency)** for App Store Connect submission.
6. **App Tracking Transparency** : if you ever integrate analytics/ads SDK, add `NSUserTrackingUsageDescription`. For now KOLO doesn't track → declare "Data Not Collected" or "Data Not Linked".
7. **In-App Purchase products** must be created in App Store Connect :
   - `kolo_pro_monthly` (24,99 €/mois)
   - `kolo_pro_annual` (TBD — propose ~249 €/an)
   - + ID Pro Plus si différents tiers prévus
8. **Sign in with Apple** REQUIRED if you offer third-party login (Google) — Apple guideline 4.8. Currently mocked. Implement via `@capacitor-community/apple-sign-in` OR backend `/auth/apple` endpoint.

### Android-specific
1. **Google Play Service Account JSON** : create in Play Console → API access, grant `androidpublisher` scope, paste content into env `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
2. **Play products** : create matching SKUs `kolo_pro_monthly`, `kolo_pro_annual`.
3. **Splash + adaptive icon** generated via `@capacitor/assets`.
4. **Data Safety form** in Play Console : declare contacts, mic, notifications.

### Web / PWA
1. `/app/frontend/public/manifest.json` :
   - Update `start_url` from `/app` to `/app-v2` if V2 becomes primary
   - Update `background_color` from `#0B0B0F` to `#FBFBFC` (V2 light theme)
   - Update `theme_color` from `#7C3AED` to `#8B5CF6` (current brand)

### Content moderation / store fiche
1. **App name** : "KOLO — Copilote immo IA" (no emoji per Apple guideline 2.3.7)
2. **Subtitle** : "Pige, dossiers, agenda vocal" (max 30 chars)
3. **Keywords** : agent immobilier, mandat, prospection, DPE, IA, copilote, immobilier, agence
4. **Screenshots** : 6.7" iPhone, 6.5" iPhone, 12.9" iPad, Android phone & tablet — required in all 7 store locales (FR, EN, IT, DE, ES, PT, PL).
5. **Promo video** (optional but boosts conversion) : 30s vertical, hero shot of Conseil du jour + AI Chat + mic.

### Backend production hardening
1. **Rate limiting** on `/api/v2/auth/send-email-code` (anti-spam Resend) — apply slowapi 5/min/IP.
2. **Idempotency** on `/api/iap/verify-apple-receipt` and `/verify-google-purchase` for replay safety.
3. **Webhooks** for Apple App Store Server Notifications v2 + Google Play Real-Time Developer Notifications — to handle renewals/cancels server-side. Endpoints to create : `/api/iap/apple/webhook`, `/api/iap/google/rtdn`.

### Legal
1. **Mentions légales / Imprint** : add a "Mentions" page accessible from drawer for EU compliance (DSA).
2. **Cookie banner** : already on the marketing site, no cookies in the app itself.
3. **GDPR data export** : implement `/api/v2/data-export` returning a ZIP of all the user's data (contacts/cases/notes/reminders). Apple/Google require this for some markets.

## Recommended pre-submission timeline
- **Week 1** : Capacitor config (light theme), Info.plist permissions, icons/splash, manifest.json fix.
- **Week 2** : Sign in with Apple, store screenshots in 7 locales, IAP SKUs created.
- **Week 3** : webhook IAP server-side, GDPR export, beta TestFlight + internal track Play Store.
- **Week 4** : production submit.
