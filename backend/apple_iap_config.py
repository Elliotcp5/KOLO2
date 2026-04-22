# Apple IAP configuration — fallback used when the platform env vars cannot be
# set (e.g. on Emergent Deploy when the Custom keys UI is not available).
#
# SECURITY NOTE
# -------------
# The Apple App-Specific Shared Secret is the password used to call Apple's
# verifyReceipt endpoint. Its blast radius is intentionally narrow:
#   - It can ONLY be used to validate receipts belonging to bundle `io.kolo.app`
#   - It cannot charge customers, refund payments, or read customer data
#   - It can be rotated in 5s from App Store Connect → My Apps → KOLO →
#     In-App Purchases → Manage → App-Specific Shared Secret
#
# If you prefer proper env-var management later, set `APPLE_IAP_SHARED_SECRET`
# on the hosting platform — it takes precedence over this fallback.
#
# DO NOT put any higher-privilege secret here (Stripe, Resend, Brevo, etc.).

APPLE_IAP_SHARED_SECRET_FALLBACK = "c6a3d0674dc4424b8eb250437884b43c"
APPLE_BUNDLE_ID_FALLBACK = "io.kolo.app"
