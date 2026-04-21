# KOLO — Deployment Guide

## 🏗️ Architecture

- **Frontend (app iOS/Android + web)** : React + Capacitor
  - Build : Codemagic (iOS .ipa + Android .aab)
  - Distribution : TestFlight → App Store / Google Play Console
  - Web version : à déployer sur `https://trykolo.io`

- **Backend (API)** : FastAPI + MongoDB
  - Doit être accessible publiquement sur `https://trykolo.io/api/*`
  - **DOIT** avoir les variables d'environnement listées dans `backend/.env.example`

---

## 🔐 Secrets & Variables d'environnement

### 🚫 Règle d'or
- **JAMAIS** de secret dans le code committé
- `backend/.env` et `frontend/.env` sont dans `.gitignore`
- Utiliser `backend/.env.example` comme template (sans valeurs réelles)

### 📋 Liste des variables à configurer en PRODUCTION

Sur la plateforme qui héberge ton backend (Emergent Deploy / Railway / Fly.io / VPS / etc.), ajoute ces variables :

| Variable | Source | Requis pour |
|---|---|---|
| `MONGO_URL` | MongoDB Atlas / ton serveur | Database |
| `DB_NAME` | "kolo_production" | Database |
| `STRIPE_API_KEY` | https://dashboard.stripe.com/apikeys | Paiements |
| `STRIPE_WEBHOOK_SECRET` | https://dashboard.stripe.com/webhooks | Webhooks Stripe |
| `EMERGENT_LLM_KEY` | Emergent Profile → Universal Key | Features IA |
| `RESEND_API_KEY` | https://resend.com/api-keys | Emails transactionnels |
| `BREVO_API_KEY` | https://app.brevo.com/settings/keys/api | Backup emails |
| `SENDER_EMAIL` | `contact@trykolo.io` | From address |
| `VAPID_*` | Fichiers `.pem` locaux | Push web |
| `CRON_SECRET` | Généré aléatoirement | Protège endpoints cron |
| `ADMIN_SECRET` | Généré aléatoirement | Protège endpoints admin |
| `CORS_ORIGINS` | `https://trykolo.io` (prod strict) | Sécurité CORS |

### 🎯 Frontend (build Codemagic)

Le seul "secret" côté frontend est `REACT_APP_BACKEND_URL`. Déjà dans `frontend/.env` (ignoré par git).

Pour le build Codemagic de prod :
1. Codemagic → ton app → **Settings** → **Environment variables**
2. Groupe `app_credentials` (déjà référencé dans `codemagic.yaml`)
3. Ajoute :
   - `REACT_APP_BACKEND_URL` = `https://trykolo.io`
   - `CM_KEYSTORE`, `CM_KEYSTORE_PASSWORD`, `CM_KEY_PASSWORD`, `CM_KEY_ALIAS` (pour Android)

---

## 🚀 Checklist avant soumission App Store

- [ ] Backend de prod déployé et joignable sur `https://trykolo.io/api/`
- [ ] Toutes les variables d'environnement prod configurées
- [ ] Webhook Stripe créé et pointant vers `https://trykolo.io/api/webhook/stripe`
- [ ] Test manuel : paiement complet en mode live (petite somme)
- [ ] TestFlight : installer l'app et faire un parcours complet (signup → checkout → onboarding PRO)
- [ ] Privacy Policy & Terms publiées sur `https://trykolo.io/privacy` et `/terms`
- [ ] Screenshots localisés EN/ES/DE/FR (6.5" iPhone minimum)
- [ ] Textes ASO copiés depuis `memory/ASO_SEO_PACK.md`

---

## 🔄 En cas de fuite de secret (rotation d'urgence)

1. **Révoquer la clé** immédiatement sur la plateforme concernée (Stripe/Brevo/Resend)
2. **Générer une nouvelle clé**
3. **Mettre à jour `backend/.env`** en local (pour les tests)
4. **Mettre à jour les env vars** de ta plateforme d'hébergement prod
5. Si la clé était dans un commit git : GitHub "Allow secret" temporairement, puis considérer la clé comme morte (elle l'est déjà)
6. Redémarrer le backend de prod
