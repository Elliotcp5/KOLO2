# KOLO - Product Requirements Document

## Original Problem Statement
Application SaaS B2B « Marque Blanche » pour les commerciaux indépendants (immobilier en priorité). 
KOLO transforme le suivi commercial avec : multi-tenant org/super-admin, communication "native first" (Twilio/WhatsApp + Whisper), synchronisation calendars (Google/Apple/Outlook), IA Suggestions, Score Ring, Stripe billing, design premium startup glassmorphism, et ultra-responsive mobile/desktop.

## User Personas
1. **Agent commercial indépendant** (immobilier) — usage quotidien sur mobile : appels, suivi prospects, dictée, IA pour relancer.
2. **Super Admin KOLO (Elliot)** — gère les marques blanches B2B + supervise les utilisateurs / abonnements / leads B2B.
3. **Org Admin (réseau B2B partenaire)** — gère ses agents via une instance KOLO white-label.

## Core Stack
- React frontend (`/app/frontend`, react-router 7)
- FastAPI backend (`/app/backend/server.py` monolithe ~7.4k lignes)
- MongoDB (motor async)
- Stripe (billing individuel + crypto + B2B per-seat), Resend (emails), Twilio + WhatsApp (calls), Emergent Universal LLM Key (Whisper STT + GPT-4.1-mini), Google Calendar OAuth, Microsoft Outlook OAuth, Emergent-managed Google Auth.

## Implemented (état Feb 2026)
### Sprint Apify Pige FONCTIONNELLE + Apple Sign-In V2 + Contact + Mentions légales + IAP Terms (iter 55 — Feb 2026)
🎯 **Toutes les demandes traitées** :
- ✅ **APIFY PIGE IMMO FR 100% FONCTIONNELLE** — actor `dltik/pige-immo-fr-scraper` (LeBonCoin + PAP + dedup + DPE + GPS) wired via `/api/v2/prospecting/listings`. Architecture async robuste : 1er call → kick off Apify run + retourne `source:scraping_in_progress` + sauvegarde `run_id/dataset_id` dans `v2_listings_pending`. 2ème call (1-3 min plus tard) → récupère le dataset, cache 6h, retourne vraies annonces avec source `Pige Immo (LBC+PAP)`. **Testé en production** : 20 vraies annonces remontées avec prix/surface/ville/source_site.
- ✅ **Apple Sign-In V2** — endpoint `POST /api/v2/auth/apple/exchange` vérifie l'identity_token JWT RS256 contre les JWKs Apple, crée/login user dans `db.users` avec champ `apple_id`, retourne session_token. Frontend bouton "Continuer avec Apple" (data-testid `auth-apple`) sur `/app-v2/login` + `/app-v2/signup` utilise `@capacitor-community/apple-sign-in` (natif iOS) + fallback web. Aud accepte `APPLE_CLIENT_ID_IOS` + `APPLE_CLIENT_ID_WEB`. Apple §4.8 ✅.
- ✅ **Bouton Contact / Assistance** dans drawer V2 (data-testid `drawer-contact`) — mailto:contact@trykolo.io avec subject + body pré-rempli (user_id, version app).
- ✅ **Mentions légales FR** (`/legal`, `/mentions-legales`) — nouvelle page LegalPage : KOLO.IO LTD, numéro 17140900, Companies House lien, Infomaniak Network SA hébergement (ISO 27001/9001/14001/50001, RGPD + LPD Suisse), Resend pour emails transactionnels, no resale.
- ✅ **Conditions d'achat in-app** (`/iap-terms`, `/conditions-achat`) — nouvelle page IapTermsPage couvrant : produits (24,99€/mois), renouvellement auto Apple/Google, annulation, remboursements (via Apple/Google uniquement), période d'essai, modifications tarifaires.
- ✅ **TermsPage enrichi** avec KOLO.IO LTD numéro 17140900 + lien Companies House + mention Infomaniak.
- ✅ **Drawer V2** : nouvelle section "Informations légales" avec 4 liens (Privacy, Terms, Legal, IAP Terms) qui s'ouvrent dans un nouvel onglet.
- ✅ **Auto-emails audités** : pas de mention 29.99€ obsolète dans email_service.py. Templates password reset multilingues OK. Welcome email price-agnostic.

### Sprint Logo iOS/Android + Info.plist + Version bump V2.0 — App Store ready (iter 54 — Feb 2026)
🎯 **Préparation finale pour push GitHub → CodeMagic → TestFlight → App Store update** :
- ✅ **Nouveau logo K** (fourni user, 6250×6250 RGBA, K blanc + cadre noir + thin gradient bleu→violet) traité via PIL : recadré square centré, RGB sur fond noir (pas de transparence pour Apple), généré en 1024/512/192/180 px.
- ✅ **iOS AppIcon-512@2x.png** (1024×1024) remplacé dans `/app/frontend/ios/App/App/Assets.xcassets/AppIcon.appiconset/` → l'icône sera bien la nouvelle dans le build TestFlight.
- ✅ **Android mipmaps** (mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192) — ic_launcher, ic_launcher_round, ic_launcher_foreground tous remplacés.
- ✅ **iOS Info.plist enrichi** : `NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`, `NSContactsUsageDescription`, `NSLocationWhenInUseUsageDescription` — bloquants Apple App Review levés.
- ✅ **Version bump 2.0 (build 3)** : `MARKETING_VERSION` 1.0→2.0 et `CURRENT_PROJECT_VERSION` 2→3 dans `App.xcodeproj/project.pbxproj`. Android `versionName "2.0" versionCode 3` dans `build.gradle`.
- ✅ **In-app logos** : kolo-mark-v4.png remplacé partout (header V2Layout, splash V2Loading, manifest.json, apple-touch-icon, page auth) — utilise désormais le nouveau K avec cadre.
- 📝 **codemagic.yaml** déjà configuré pour : yarn build React → npx cap sync ios → pod install → auto-increment build number depuis App Store/TestFlight → signing automatique → IPA → upload App Store Connect. Trigger sur push to `main`.

### Sprint Refonte Monochrome Premium V4 + Nouveau logo + Capacitor iOS light (iter 53 — Feb 2026)
🎯 **Réponse à "fait pas premium, retour visuel basique, logo cheap, surveillance micro cheap, menu basique, header horrible"** — refonte 100% selon les directives :
- ✅ **Background gradient gris monochrome** (`#F0F0F2 → #DCDCDF → #C2C2C8`, fixed) matchant la tonalité du nouveau logo K. Plus aucune trace de violet/rose.
- ✅ **Palette restreinte à 4 couleurs** : noir #0B0B0F, gris #6B7280, blanc #FFFFFF, + thin gradient border (noir→gris→gris clair) UNIQUEMENT sur Ask KOLO et Daily Advice.
- ✅ **Nouveau logo K** (image fournie user, K noir dans rectangle blanc sur fond gradient noir→gris) installé dans `/app/frontend/public/kolo-mark-v4.png` + utilisé partout (header, splash V2Loading, manifest.json, apple-touch-icon, logo512, page auth).
- ✅ **Daily Advice = GROS HERO CARD** (radius 24px, padding 22-24px, min-height 96px, font-family display League Spartan 22px title) collapsible — eyebrow "CONSEIL DU JOUR" + titre extrait du tip + teaser 1 ligne + chevron rond animé qui devient noir quand ouvert.
- ✅ **Ask KOLO = compact side pill** (border-radius 999px, padding 10×14px, align-self flex-start, ne prend PAS toute la largeur, accessible mais pas central). Plus de Sparkles "étoile cheap" — remplacée par MessageCircle simple.
- ✅ **Micro central simplifié** : 60px noir #0B0B0F, border blanc 3px, plus de pulse ring "surveillance cheap", plus de halo gradient. Label "CRÉER UNE NOTE" 9.5px letter-spacing 0.10em.
- ✅ **Bottom nav GHOST FLOATING PILL** : pill border-radius 28px flottant 14px du bord, backdrop-blur 28px saturate 200%, border blanc translucide, shadow multi-couches premium. Plus de barre basique.
- ✅ **Header transparent** : plus de bande blanche horrible. Burger button glassmorphism + petit logo K mark au centre 28×28.
- ✅ **Capacitor config light theme** : `backgroundColor` partout `#E8E8EC`, `StatusBar.style='dark'` (icônes noires sur fond clair).
- ✅ **Manifest.json refait** : `start_url=/app-v2`, `background_color=#E8E8EC`, `theme_color=#0B0B0F`, icons → `kolo-mark-v4.png`, nom "KOLO - Copilote IA immobilier".
- ✅ **i18n 7 langues 100% validé** : FR/EN/IT/DE/ES/PT/PL — Créer une note / New note / Crea una nota / Notiz erstellen / Crear nota / Criar nota / Nowa notatka.
- 📝 **Audit App Store** : `/app/APP_STORE_READINESS.md` mis à jour avec le process Apple Developer + TestFlight (à faire user-side, Emergent ne gère pas l'upload App Store automatiquement).

### Sprint UX Premium V2 + Conseil collapsible + AI CTA central + i18n + Haptic + App Store audit (iter 52 — Feb 2026)
🎯 **Réponse au feedback "fait basique, manque de vie, conseil illisible, pas de chat IA central"** :
- ✅ **Bug double KOLO** retiré sur page login/signup (V2Logo unique).
- ✅ **Quota Prospection → 1 / SEMAINE** (lundi→dimanche UTC) au lieu de 1/jour. Collection `v2_prospecting_log` stocke désormais `week_start` ISO. Endpoint `/api/v2/quota` retourne `prospecting_used_this_week`, `prospecting_limit_per_week`, `prospecting_window`. Drawer affiche "X sur 1 restante cette semaine".
- ✅ **IA Adaptive par profil onboarding** : `_build_role_specific_persona` injecte des persona_lines dans le system prompt Claude Sonnet 4.5. 4 rôles (Directeur/Mandataire/Agent indé/Agent), 4 buckets CA (-30k pédagogie / 30-60k structuration / 60-100k stratégie / 100k+ expert), 4 activités (luxe/neuf/commercial/location). Catch-all "Persona adaptatif" pour rôles non matchés.
- ✅ **Alerte admin BDD + email Resend** sur création compte Directeur/Réseau/Dirigeant : collection `v2_admin_alerts` + email à `ADMIN_ALERT_EMAIL` (défaut elliot.cohenpressard@trykolo.io) avec nom/email/tel/CA/secteurs/taille équipe.
- ✅ **Conseil du jour COLLAPSIBLE** : bouton premium (data-testid `home-daily-advice`) avec chevron animé (rotate 180° on open). État fermé compact, état ouvert révèle le contenu IA dans une card gradient subtil + bouton "Continuer la conversation" (`home-tip-continue`) qui ouvre le modal AI Chat avec le conseil pré-rempli + suggestions chips cliquables.
- ✅ **AI Chat CTA central "Demande à KOLO"** (data-testid `home-ai-cta`) : carte avec gradient border violet→pink + spark icon + bouton send rond. Titre "Demande à KOLO", sub-text "Estimation, coaching, relance, conseil…". Clic → modal AIChat full-screen "Parler à KOLO". C'est désormais le **centre de l'app**.
- ✅ **Bouton micro central + label "Créer une note"** (multilingue 7 locales via `v2i18n.js`) : `home-mic-fab` 64px noir avec halo gradient violet→pink + anneau pulse animé + label uppercase petite typo en-dessous (`home-mic-fab-label`). **Visible uniquement sur /app-v2 (Accueil)** — pas sur Dossiers/Contacts/Agenda.
- ✅ **Haptic feedback** : `@capacitor/haptics@5` installé. Au tap du micro → `Haptics.impact(Medium)` sur natif iOS/Android, fallback `navigator.vibrate(12)` sur web. Try/catch silencieux.
- ✅ **V2 force FR par défaut** : `useEffect` dans V2Layout qui pose `kolo_locale_manual=true` + locale `fr` au premier mount d'un user V2 (évite l'auto-overwrite navigator.language du LocaleContext marketing).
- ✅ **Refonte premium suivant `design_guidelines.json`** : palette violet #8B5CF6 → pink #EC4899, glassmorphism bottom nav, gradient subtil sur Conseil ouvert, élévations multi-couches, transitions cubic-bezier signature, anneau pulse mic.
- ✅ **App Store readiness audit** complet documenté dans `/app/APP_STORE_READINESS.md` (iOS Info.plist mic, Sign in with Apple obligatoire, Google Play Service Account, splash light V2, manifest.json fix, store screenshots 7 locales, webhooks IAP).

### Sprint Quotas Free + Drawer counter + Google Play Billing (iter 51 — Feb 2026)
🎯 **Réponse à la directive user "compteur 'X sur 10 restants' dans le drawer + 1 recherche prospection free + IAP Apple+Google"** :
- ✅ **Free quotas backend** : `FREE_CONTACTS_LIMIT=10` + `FREE_PROSPECTING_PER_DAY=1`. POST /api/v2/contacts retourne 402 au-delà de 10. /prospecting/dpe + /prospecting/listings consomment un quota partagé (1 par jour), retournent 402 ensuite. Pro = illimité partout (`_is_pro_user` retourne True pour subscription_status in {active, trialing}).
- ✅ **Endpoint `GET /api/v2/quota`** + enrichissement `/dashboard` avec `prospecting_used_today, prospecting_limit_per_day, prospecting_left_today, free_contacts_limit`. Collection `v2_prospecting_log` track les recherches par jour.
- ✅ **Drawer sidebar compteurs prominents** (V2Layout) : pour users free, blocs "📇 CONTACTS — X sur 10 restants" + "🔍 PROSPECTION — Y sur 1 restante aujourd'hui" avec barres de progression dégradé violet→rose. Pour users Pro : bloc "📇 Contacts : illimité / 🔍 Prospection : illimitée".
- ✅ **Banner d'upsell** sur /app-v2/prospecting : gradient jaune→rose avec message backend + CTA "Passer Pro · 24,99€/mois" qui navigue vers /app-v2/settings/subscription.
- ✅ **Google Play Billing endpoint** : `POST /api/iap/verify-google-purchase` scaffolding production-ready. Service Account OAuth2 (PyJWT RS256), call androidpublisher.googleapis.com/v3/applications/{package}/purchases/subscriptions/{productId}/tokens/{token}. Mapping `kolo_pro_monthly|annual` → plan PRO. Update db.users avec plan, subscription_ends_at, platform='android'. **Requires** `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` env (json complet ou chemin .json) + `GOOGLE_PLAY_PACKAGE_NAME` (default io.kolo.app).
- 📝 **Test report** : iter_51.json — 12/12 pytest backend + 100% frontend. Aucun bug.

### Sprint Google Sign-In V2 + Push V2 + Corrections copy/tarif (iter 50 — Feb 2026)
🎯 **Réponse à la directive user "Fais P1 Google, Push hyper important, pas Stripe (paiement IAP)"** :
- ✅ **Google Sign-In V2** : le bouton "Continuer avec Google" sur /app-v2/login et /app-v2/signup déclenche désormais le vrai flow OAuth (réutilise l'infra V1 `/api/auth/google/client-id` + `/api/auth/google/exchange`). Un sessionStorage flag `kolo_oauth_target=v2` est posé avant redirect → `GoogleAuthCallback.js` détecte la cible V2, stocke le token dans `kolo_v2_session`, attribue automatiquement le referral_code en attente, vérifie l'onboarding V2 (`GET /api/v2/onboarding`) et redirige vers `/app-v2/onboarding` (nouveau) ou `/app-v2` (existant). 100% testé via testing agent.
- ✅ **Notifications Push V2** : composant inline `V2NotificationPrompt` sur la home V2 (gradient violet→rose, ne s'affiche que si permission='default' et pas dismiss) avec bouton "Activer les notifications" + dismiss persistant (`kolo_v2_push_prompt_dismissed`). Section dédiée dans `/app-v2/settings` avec bouton "Activer" + "Test notif". Endpoint `POST /api/v2/notifications/test-push` (auth) → 404 si pas de subscription, `sent:true` si OK. **Push instantané** automatique à la création d'un rappel V2 du jour (`POST /api/v2/reminders` avec `date=today` → trigger best-effort).
- ✅ **Scheduler V2-aware** : `notification_scheduler.send_daily_reminders()` agrège désormais **V1 tasks ET V2 reminders** (collection `v2_reminders`, status=pending, date=today). target_url='/app-v2' si au moins 1 reminder V2 sinon '/app'.
- ✅ **pushNotifications.js** lit le token depuis `kolo_token || kolo_v2_session || session_token` → fonctionne pour les users V1, V2 et legacy.
- ✅ **Pas de Stripe sur V2** (paiement = IAP Apple iOS + Google Play Billing Android) — décision validée par l'utilisateur. Tarif Pro affiché **24,99€/mois** partout (sidebar V2Layout, V2ReferralPage, V2 perks).
- ✅ **Copy parrainage corrigé** : "1 mois Pro offert au PARRAIN UNIQUEMENT (si le filleul passe Pro)" sur landing /r/:code + banner signup. Plus aucune mention "+1 mois pour vous deux".

### Sprint Audit V2 + Parrainage public + IA contextuelle + Pige RapidAPI (iter 49 — Feb 2026)
🎯 **Audit V2 + finalisation last working item** (réponse à "tu es sûr que tu as bien tout fait ?") :
- ✅ **Audit V2 testing agent** : 16/16 backend + ~95% frontend OK — la V2 n'est PAS une façade vide. Onboarding 9 slides complet, ADEME DPE réel, IA Claude Sonnet 4.5, CRUD complet.
- ✅ **Landing parrainage publique `/r/:code`** : page minimaliste avec prénom du parrain (gradient violet→rose), 4 perks, CTA noir "Créer mon compte avec [Prénom] comme parrain". Stocke le code en localStorage, redirige vers `/app-v2/signup?ref=CODE`.
- ✅ **Endpoint public** `GET /api/v2/referral/info/{code}` (no auth) → retourne `{code, referrer_first_name}`.
- ✅ **Attribution automatique** : `/api/v2/auth/verify-email-code` accepte `referral_code` et crée l'entrée `v2_referrals_redeemed` automatiquement (anti-self-referral inclus).
- ✅ **Banner référent dynamique** sur `/app-v2/signup?ref=CODE` : "🎁 Tu es invité par [Prénom] — rejoins KOLO gratuitement."
- ✅ **IA Copilote contextuel** : chaque message `/api/v2/ai/chat` injecte le profil agent (rôle, CRM, secteurs, prénom), les compteurs (contacts/dossiers/rappels du jour) et les 5 derniers dossiers dans le prompt → Claude répond en utilisant le contexte réel.
- ✅ **Fix bug `user.first_name`** : daily-tip + ai/chat utilisent maintenant `db.users.find_one(...)` (le modèle Pydantic User n'a pas first_name, drop par `extra="ignore"`).
- ✅ **Pige Annonces RapidAPI Selogimmo** : code backend complet (résolution code postal → city_id + listings + cache MongoDB 6h). Activé via `RAPIDAPI_KEY` + `RAPIDAPI_SELOGIMMO_HOST` en .env. Le code retourne `source: "Selogimmo"` quand actif, `"placeholder"` sinon, `"not_subscribed"` si HTTP 403. **MOCKÉ pour l'instant** car le provider Selogimmo se fait bloquer par SeLoger.com côté upstream (HTTP 501 "AxiosError 403") et le user n'a pas activement souscrit à toutes les APIs RapidAPI nécessaires.
- ✅ **Corrections copy parrainage** (selon directive user) : "+1 mois pour vous deux" → "1 mois Pro offert pour le parrain uniquement (si le filleul passe Pro)". Tarif Pro corrigé 29,99€ → **24,99€/mois** partout (V2Layout sidebar, V2Extras referral page).
- 📝 **Test seed** : code TESTABCD pour parrain Marie (`user_id=u_testref01`) — landing accessible via `/r/TESTABCD`.

### Sprint Refonte intégrale webapp v2 (iter 48 — Feb 2026)
🚀 **Refonte complète sous `/app-v2`** (iOS-first, mobile, ne casse rien) :
- **Backend** : `/app/backend/v2_router.py` monté sous `/api/v2/*`. Nouvelles collections MongoDB (v2_reminders, v2_notes, v2_contacts, v2_cases, v2_ai_messages, v2_email_codes, v2_onboarding). Endpoints : me, dashboard, reminders/notes/contacts/cases CRUD, ai/chat + daily-tip + conversations, auth email-code, onboarding, prospecting DPE & listings.
- **IA Claude Sonnet 4.5** via EMERGENT_LLM_KEY (emergentintegrations) pour conseil du jour personnalisé + chat copilote.
- **Auth email-code** (code 6 chiffres) + Resend, dev_code exposé en preview pour test.
- **Frontend** : design system `/app/frontend/src/styles/v2.css` (fond clair, gradients subtils, typo SF Pro, bottom-sheet modals iOS, safe-area insets). Nouveau logo SVG. Layout = Header burger + Sidebar drawer + Bottom nav 4 onglets.
- **4 pages principales** : Accueil (Hero + Conseil du jour IA + Rappels + Notes + Dossiers récents + FAB micro), Dossiers (filtres + search + add vendeur/acquéreur + détail), Contacts (annuaire + add + actions tel/mail), Agenda (vue semaine + timeline 7h-23h + add rappel).
- **3 pages extras** : Prospection DPE/Annonces (placeholder data réaliste), Guide KOLO (5 tips métier), Settings (profil + abonnement + suppression).
- **Onboarding 9 slides** : privacy → rôle → qualification → identité → tel → secteurs → CRM → plateformes → slides éducatives.
- **6 modals** : AddNote (vocal Web Speech API + écrit), AddReminder, AddCase, AddContact, CaseDetail (Suivi vendeur/acheteur), AIChat conversationnel.
- **Routes** : /app-v2, /app-v2/dossiers, /app-v2/contacts, /app-v2/agenda, /app-v2/login, /app-v2/signup, /app-v2/onboarding, /app-v2/prospecting, /app-v2/guide, /app-v2/settings.
- **Testing** : flow complet signup → code → onboarding → home → switch onglets validé visuellement (screenshots).
- **Placeholders/MOCKÉ** : DPE ADEME + Annonces multi-portails (données mock réalistes), Google Sign-In bouton alert (à brancher), Gmail/Outlook dans CaseDetail, mails rétention auto. Apple Sign-In supprimé.

### Sprint Pivot B2B-first + 3 langues (iter 47 — Feb 2026)
🚀 **Refonte stratégique landing : B2C → B2B-first** :
- **HERO refondu** : "Le suivi commercial intelligent pour les entreprises qui vendent." Sub-titre orienté foncières/promoteurs/réseaux d'agents. CTA principal "Réserver une démo" → `/business#contact`
- **Section Pricing 3 plans SUPPRIMÉE** : remplacée par une card premium "Démo personnalisée 30 min" + "Tarification sur devis selon volume". L'ancien pricing 9.99€/24.99€ public n'existe plus.
- **Section "Indépendant ?" minimaliste** ajoutée en bas avec CTA App Store conservé (3,99€/mois mentionné)
- **FAQ refondue en B2B inline** : 5 questions adaptées (KOLO vs CRM existant, délai déploiement 20 commerciaux, ROI première année, sécurité données RGPD, tarification entreprise). En 7 langues.
- **Final CTA B2B** : "Arrêtez de perdre des deals à cause d'un suivi commercial défaillant." → Réserver démo
- **Nav** : "Réserver une démo" + "Démo entreprise" (au lieu de "Try for free")
- **Terme "suivi commercial"** au lieu de "suivi client" sur landing (blog conserve "suivi client" pour le SEO existant)

🌍 **i18n étendue à 7 langues** :
- Ajout **Polonais (PL), Portugais (PT/BR/AO/MZ/CV), Espagnol (ES/MX/AR/CO/CL/PE/VE/EC/GT/CU/BO/DO/HN/PY/SV/NI/CR/PA/UY/PR)** dans `LocaleContext.js`
- `SUPPORTED_LOCALES = ['en', 'fr', 'de', 'it', 'es', 'pt', 'pl']`
- Détection IP automatique : Italie → IT, Pologne → PL, Brésil → PT, Mexique → ES, etc.
- ✅ **Confirmé** : un italien en Italie voit le site en italien (ipapi.co → cc=IT → locale=it)
- Tous les nouveaux textes B2B traduits manuellement en 7 langues (hero, FAQ, CTAs, micro-copy)

⏳ **À implémenter au prochain sprint** :
- Sélecteur date/heure dans le formulaire de contact (booker démo réelle)
- Backend : champ `demo_datetime` sur le lead B2B
- Super Admin : afficher la date/heure de démo prévue sur chaque lead B2B
- Traductions PL/PT/ES des autres sections de la landing (Sans/Avec, Comment ça marche, etc.) — actuellement en fallback EN pour ces langues

### Sprint Blog SEO (iter 46 — Feb 2026)
📰 **Système de blog complet pour SEO ultime** :
- **5 articles de fond** rédigés en 4 langues (FR/EN/IT/DE) — 20 articles au total, contenu à vraie valeur ajoutée (pas de pub) :
  1. Suivi client en 2026 : pourquoi 80% des ventes se jouent après le premier contact
  2. Les 7 techniques de relance prospect qui fonctionnent vraiment
  3. Pipeline commercial : les 6 KPIs indispensables pour piloter une équipe
  4. L'IA dans la prospection : guide pratique pour intégrer sans casser le process
  5. WhatsApp / SMS / Email / Appel : quel canal de relance selon le secteur
- **Routes** : `/blog` (index) + `/blog/:slug` (article)
- **Design éditorial premium** : `blog.css` — typo serif Fraunces pour les titres, Inter pour le corps, max-width 720px, large whitespace, breadcrumb, reading time, blockquote stylé
- **CTA premium en fin d'article** : card dégradée bleu/violet avec halo radial, bouton "Contacter le team KOLO" → `/business#contact`
- **SEO complet** : `useDocumentHead` hook qui injecte dynamiquement title, meta description, OG, Twitter Card, canonical, JSON-LD `BlogPosting` (article) / `Blog` (index)
- **i18n** : détection automatique langue user (FR/EN/IT/DE) sur tous les articles
- **Lien "Blog" discret** dans le footer landing (à côté de "Mentions légales") — pas dans le header par choix UX
- **sitemap.xml** étendu avec les 5 URLs articles + page index + hreflang alternates
- Fichiers : `data/blogPosts.js`, `pages/BlogIndex.js`, `pages/BlogPost.js`, `hooks/useDocumentHead.js`, `styles/blog.css`

### Sprint Favicon rond (iter 45 — Feb 2026)
🎨 **Refonte complète du favicon** : passage d'un favicon carré (qui apparaissait étiré/oval quand Google le rognait en cercle dans les SERP) à un favicon **rond natif** avec fond transparent.
- Génération PIL/Pillow : cercle de dégradé `#004AAD → #CB6CE6` (diagonal), K blanc DejaVu-Bold à 62% du diamètre, anti-aliasing par super-sampling.
- Tailles produites : 32 (favicon-v3.png), 48 (favicon-v3.ico multi-size 16/32/48), 64, 128, 180 (apple-touch-icon-v3.png), 192 (logo192.png), 512 (logo512.png).
- `index.html` mis à jour pour pointer vers les fichiers `v3`.
- Fichiers legacy (favicon.ico, favicon.png, apple-touch-icon.png) écrasés avec le nouveau design pour les caches/anciens liens.
- Master PNG 1024x1024 conservé dans `og-mark-1024.png` pour futures déclinaisons.

### Sprint Hero Rotatif tuning (iter 44 — Feb 2026)
🎯 **Hero rotatif BusinessPage** :
- Animation accélérée de **1.20x** : `t1` 1420 → 1183ms, `t2` 1670 → 1391ms, transition CSS 320 → 267ms.
- Centrage parfait du mot rotatif vérifié visuellement (foncière / agency group / property developer / property fund tous centrés sur le ghost word).
- Sous-titre : "la solution la plus complète et la plus compétitive du marché" (FR/EN/IT/DE).

### Sprint correctifs & polish (iter 43 — Feb 2026)
🔴 **Bug bloquant fixé** : "Créer une marque blanche" affichait page blanche → `useLocale is not defined` dans `WhiteLabelTab.js`. Import manquant restauré.

🎨 **Polish landing/UX** :
- **Suppression du badge "Nouveau · Espace Entreprise pour agences"** sur la landing.
- **Suppression du sélecteur de drapeau dans les headers** (landing, business, app) — design trop "cheap". Le sélecteur reste accessible **dans le footer** uniquement.
- **Détection IP auto refinée** : Suisse (CH) → utilise `navigator.language` pour détecter le canton (fr-CH → FR, de-CH → DE, it-CH → IT, default FR). FR/IT/DE/Autriche/Liechtenstein/Belgique automatiques. Reste du monde → EN.
- **Pastille "En retard"** : passe d'un overlay absolu en haut-droite (qui chevauchait les boutons) à un **bloc inline en haut-gauche** au-dessus du titre. Plus de chevauchement mobile.
- **"Résilier l'abonnement" / "Supprimer mon compte"** : rendus **gris discret** (font 12px, opacity 0.7, couleur muted) au lieu du rouge bold underline. Plus de risque de clic accidentel.

📧 **Sender email admin invites** : `contact@trykolo.io` au lieu de `onboarding@resend.dev`.

🔍 **SEO meta tags améliorés** :
- `<title>` + `<meta description>` réécrits en français accrocheur ("KOLO — Le copilote IA des agents immobiliers | Closez 2x plus").
- `<meta property="og:*>` cohérents en FR.
- Ajout `<link rel="icon" sizes="192x192">` et `<link rel="icon" sizes="512x512">` pour Google qui exige ≥96px pour l'icône à côté de l'URL dans les résultats.
- Note : "Autre page avec balise canonique correcte" = message informatif Google, pas un bug (les `?lang=xx` renvoient bien vers canonical `/`).

📱 **Onboarding : choix iPhone/Android + guide signet** :
- Nouvelle étape 6/7 dans `OnboardingFlow.js`.
- 2 cards "iPhone 🍎" / "Android 🤖" (auto-détection du UA pour pré-sélectionner).
- Guide en 3 étapes selon la plateforme (Safari → Partager → "Sur l'écran d'accueil" pour iOS ; Chrome → ⋮ → "Ajouter à l'écran d'accueil" pour Android).
- Traduit FR/EN/IT/DE.
- Bouton "Plus tard" / "C'est fait" + lien "Changer de téléphone".

### Sélecteur de langue + Détection IP (iter 42)
- Nouveau composant **`LanguageSwitcher.js`** : pill compact avec drapeau emoji (🇫🇷🇬🇧🇮🇹🇩🇪) + code langue + chevron, ouvre un dropdown élégant avec 4 langues + checkmark violet sur l'active.
- Installé dans **3 endroits** : header LandingPageNew, header BusinessPage, header AppShell (à côté de la bell).
- **Détection IP automatique** déjà en place dans `LocaleContext.js` (priorité : URL param → choix manuel localStorage → backend `/api/geo` → ipapi.co fallback → navigator.language → EN par défaut).
- Le choix utilisateur via le drapeau marque `kolo_locale_manual=true` → survit aux sessions et override la géoloc.
- Validé visuellement : visite `/?locale=de` → toute la landing en allemand (hero, eyebrow "Neu · Unternehmensbereich für Agenturen", nav "Unternehmen / Anmelden / Kostenlos testen").

### Audit i18n + Vocabulaire "Entreprise" (iter 41)
**Remplacement systématique "réseau immobilier" → "entreprise" partout** :
- `BusinessPage.js` (FR + EN) : eyebrow, hero, sec2/sec3, CTA → "entreprise" / "business"
- `OrgSpace.js` : "Nom du réseau" → "Nom de l'entreprise", "ton réseau" → "ton entreprise", Dataroom "du réseau" → "de l'entreprise"
- `JoinOrgPage.js` : "espace réseau" → "espace entreprise"
- `AppShell.js` : "Mon espace réseau" → "Mon espace entreprise" (4 langues), source de prospect "Réseau" → "Entreprise" (4 langues)
- `LandingPageNew.js` : pill "Espace Réseau" → "Espace Entreprise" (4 langues), team-callout "Vous gérez un réseau ?" → "Vous gérez une entreprise ?" (4 langues)
- `BrandPreviewCarousel.js` : tagline + "Mon réseau" → "Mon entreprise" / "Espace entreprise B2B"
- `WhiteLabelTab.js` : "URL du site du réseau" → "URL du site de l'entreprise"
- `WhiteLabelList.js` : "espace du réseau" → "espace de l'entreprise"
- `AdminDashboard.js` : "Prospects (réseau)" → "Prospects (entreprise)"

**Audit i18n exhaustive FR/EN/IT/DE** :
- `BusinessPage.js` : ajout des locales **IT** et **DE** complètes (eyebrow, hero, sec1-4, CTA, form labels, sizes, sectors, legal — 100+ strings traduits)
- `BrandPreviewCarousel.js` : composant entièrement traduit dans les 4 langues (mockup iPhone affiche maintenant la bonne langue selon le contexte utilisateur) — passe `locale` depuis WhiteLabelTab via `useLocale()`. Tous les textes : "Bonjour Thomas", "Prospects chauds", "Aujourd'hui", "Top performers", "powered by", etc. → 4 langues.

### Sprint UX + Admin Powers (iter 40)
**Demandes utilisateur traitées en bloc** :

🎨 **UX Tâches mobile (refonte épurée)**
- Pastille **"OVERDUE"** compacte (orange douce) en haut à droite de chaque carte tâche.
- Suppression du long texte "En retard — Relancer maintenant" qui chevauchait.
- **Bouton SMS supprimé** : `task_type='sms'` n'affiche plus de bouton primaire, seul WhatsApp (cohérent avec la philo : WhatsApp = SMS chez KOLO).
- Boutons d'action **épurés** : soft fills pastel (vert/bleu/orange) au lieu des pills flashy avec ombres lourdes, alignement propre, plus de chevauchement.

🛡️ **Système admin avancé**
- **Super admins** : `elliot.cohenpressard@trykolo.io` + **pressardhugo@gmail.com** (nouveau).
- **Simple admin** (nouveau rôle) : `alessio.arduca@trykolo.io` — peut UNIQUEMENT créer des marques blanches, rien d'autre.
- **Onglet "Administrateurs"** dans le panel super admin : liste avec badges colorés (Super admin violet / Admin simple bleu), boutons Promouvoir/Rétrograder/Supprimer.
- **Modal "Ajouter un admin"** : email + 2 cards (Admin simple / Super admin) + envoi de magic-link via Resend + affichage URL d'activation copiable.
- Endpoints : `GET /admin/admins`, `POST /admin/admins/invite`, `PATCH /admin/admins/{email}`, `DELETE /admin/admins/{email}`. Hydratation au boot depuis `db.admin_grants`.

💎 **Attribution de plans (set-plan)**
- Colonne **"Actions"** dans la table Users avec bouton **"Attribuer un plan"** violet.
- Modal : choix entre Free / Pro / Pro+ / Enterprise + durée en mois (1–36) + note optionnelle.
- Endpoint `POST /admin/users/{user_id}/set-plan` : pose `subscription_plan` + `subscription_expires_at` + `subscription_granted_by`.

📋 **Formulaire contact B2B enrichi**
- Nouveau champ **"Secteur d'activité"** (7 options) : Réseau immobilier, Agence, Groupement, Foncière, Promoteur, Développeur foncier, Autre.
- Backend `EnterpriseDemoRequest.business_sector` stocké dans `enterprise_leads`.
- Vocabulaire : "Nom du réseau" → **"Nom de l'entreprise"**.

✨ **Rendu marque blanche (alignement avec mockup)**
- Logo brandé dans header AppShell **passé de 32px à 46px** (plus grand, plus présent).
- Fallback automatique sur le nom de la marque (avec couleur primaire et police custom) si le logo échoue à charger.
- Hero gradient brandé déjà en place (iter 38).

### Sync Calendrier Bidirectionnelle + Notifications Push (iter 39)
**Effet "wahou"** : KOLO détecte les changements faits côté Google/Outlook sur les events qu'il a créés, met à jour les tâches automatiquement et notifie l'utilisateur.

- **Backend `_pull_calendar_changes(user_id)`** : pour chaque tâche avec `calendar_events.google` ou `.outlook`, récupère l'event distant et compare la date/existence.
  - Event déplacé sur Google/Outlook → met à jour `task.due_date` + crée notif `task_moved`.
  - Event supprimé → marque tâche `completed=true` + notif `task_deleted_external`.
- **Endpoint `POST /api/integrations/calendar-pull`** (throttled 30s/user).
- **Endpoints notifications** : `GET /api/notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`.
- **Frontend `NotificationBell`** : bell icon dans header avec badge unread count, dropdown élégant (icônes coloriées par type), toast push si nouvelle notif, polling pull+fetch toutes les 90s.

### Refonte UX Tâches Mobile + Connexions Perso (iter 38 — Feb 2026)
**Confirmation critique** : Calendrier & WhatsApp sont des **intégrations PERSO par agent**, jamais par réseau. Chaque agent connecte SON compte Google/Outlook/WhatsApp.

- **Boutons d'action tâche refondus** (mobile-first) :
  - 1 seul bouton primaire contextuel selon `task_type` : Call (`tel:`), SMS (`sms:`), Email (`mailto:`), Visite (Google Maps)
  - 1 bouton WhatsApp (rond vert) — ouvre une **action sheet bottom** : "Générer avec IA" (gradient) + "Écrire à la main" + Cancel
  - Suppression : Calendar, Mail standalone, Sparkles standalone
- **Sync calendrier auto invisible** : déjà câblé backend (`_sync_task_to_calendar`) sur create/update/done
- **Onboarding `PermissionsStep` refondu** : 3 cards explicites — Google Calendar / Outlook Calendar / "Je ne souhaite pas connecter"
- **Section "Mes connexions" dans Profile** (`MyConnectionsCard`) : 3 rangs avec Connect/Disconnect Google + Outlook + WhatsApp (modal numéro)
- **Hero brandé gradient** quand `userOrg` (aligne rendu réel sur mockup iPhone marketing)
- Nouvel endpoint backend `GET /api/integrations/my-status` (état per-user)
- **Facture B2B** : déjà sans Stripe (Virement + PDF uniquement)

### Mode "Dieu" Super Admin (iter 36 — Feb 2026)
- Le Super Admin (`elliot.cohenpressard@trykolo.io`) n'est **rattaché à aucune organisation** en base (`users.org_id = null`).
- Accès à n'importe quel espace réseau via `/org?org_id=XXX` (god mode).
- `_require_org_member` bypasse les checks 403 pour les super admins (`is_super_admin_email`).
- `/api/orgs/me?org_id=X` retourne l'org demandée avec `role="super_admin"` et `is_god_mode=true`.
- UI : Bouton **« Voir l'espace »** (badge violet) sur chaque carte de `WhiteLabelList`.
- UI : Banner **« MODE SUPER ADMIN · PILOTAGE »** dans la sidebar quand god mode actif.
- UI : Sidebar footer affiche **« Retour Admin »** (redirige vers `/kolo-admin`) au lieu de « Retour à l'app ».

### Auth & Comptes
- Email/password + Google direct OAuth (no intermediary), Reset Password flow.
- Super Admin hardcoded fallback (`elliot.cohenpressard@trykolo.io` / `Psychologue75007%!`) avec `lifetime_access=true` + plan `pro_plus`.
- Apple Sign-In : placeholders (`APPLE_SIGNIN_ENABLED=false`).

### Pipeline Prospect
- Statuts : **nouveau → contacté → qualifié → offre → offre_acceptée → signé → perdu**.
- `Marquer comme vendu` : modale demande **commission initiale (prévue)** + **commission finale (perçue)**.

### Communication
- ProspectCommsPanel : Call/WhatsApp/Calendar boutons + historique unifié, transcription Whisper.
- **Today task list** : 4 boutons quick-action (Call, WhatsApp, Email, Calendar) toujours visibles inline.

### Calendrier
- Google Calendar + Microsoft Outlook auth-url, événements, sync bidirectionnelle Tâches ↔ Calendar.

### Marque Blanche complète (iter 32 — 4 lots)
- **Lot 1 — Branding partout** : `OrgContext` charge `/api/orgs/me` au boot, injecte CSS vars (`--brand-primary/secondary/gradient/font/logo-url`) sur `<html>`. AppShell affiche le logo de l'org dans le header (`data-testid=appshell-org-logo`).
- **Lot 2 — Funnel inscription brandé** : `/register?org=slug` et `/login?org=slug` chargent `/api/orgs/public/{slug}` (no auth) et affichent logo + tagline « X powered by KOLO ». Détection automatique aussi via sous-domaine.
- **Lot 3 — Facturation B2B Stripe** : champs `seats`, `seats_used`, `monthly_price_per_seat_eur`, `billing_status` sur org. Endpoints :
  - `GET /api/orgs/{id}/billing` → seats utilisés / restants + coût mensuel
  - `POST /api/orgs/{id}/billing/checkout` → Stripe Subscription Checkout (price_data × quantity=seats)
  - `POST /api/orgs/accept-invite/{token}` enforce les sièges → 402 « Toutes les places sont occupées (X/Y) »
  - OrgSpace nouveau onglet « Facturation » (BillingTab) avec progress bar sièges + bouton « Payer avec Stripe »
- **Lot 4 — Sous-domaine custom** : champ `custom_subdomain` sur les orgs. `GET /api/orgs/by-domain` (lit le Host header) + `GET /api/orgs/public/{slug-or-subdomain}` ($or query). WhiteLabelTab capture `wl-subdomain` lors de la création.

### AI Wizard White-Label
- POST `/api/admin/whitelabel/scan` (LLM scrape → couleurs, logo, sector, tagline, pitch).
- POST `/api/admin/whitelabel/create` (instance + invite + sous-domaine + tarif).
- Aperçu inscription brandée en 1 clic depuis le wizard (`wl-preview-brand` ouvre `/register?org=slug`).

### Rapports automatiques
- Helper `_send_weekly_report_for_user(user_id)` + scheduler background (Monday 8h UTC).
- Email HTML pointe vers `${FRONTEND_URL}/app` = `https://trykolo.io/app`.

### Onboarding
- 6 étapes (Welcome → How → **Permissions** → Import → Theme → Ready).
- Step 3 Permissions premium : 3 cartes (Mic/Calendar/Notif) + Shield/privacy notice.

### IA
- ProspectScoreRing + IA Suggested Task (modale glassmorphism).
- VoiceDictateButton (Whisper) intégré dans toutes les textareas.

### i18n
- FR/EN/DE/IT pour OnboardingFlow, SocialAuthButtons, ProspectCommsPanel, MarkAsSoldButton.

## Backlog (prioritized)
### P1
- Apple Sign-In réel (clé dev disponible `460ed08b...`).
- Refactor monolithe `server.py` → `routes/whitelabel.py`, `routes/billing.py`, `routes/reports.py`.
- Passe i18n exhaustive (textes FR encore hardcodés).
- Whitelist `success_url/cancel_url` pour `OrgBillingCheckoutPayload` (sécurité Stripe redirect).
- Renommer `monthly_price_per_seat_eur` → `monthly_price_per_seat_cents` (noms cohérents avec les valeurs).

### P2
- Race condition seats_used (concurrent accept-invite) — verrou ou transaction.
- Rate-limit Resend pour le scheduler hebdo lors du scaling > 100 PRO+.
- Enum strict `Literal[...]` pour `UpdateProspectRequest.status`.
- Source unique pour `PROSPECT_STATUSES` (actuellement dupliqué dans `AppShell.js`).
- Apple Calendar (CaldAV).

## Testing checkpoints
- iter 28: i18n + integrations
- iter 29: divider bug + locale persistence
- iter 30: whitelabel + scheduler + super-admin pro+ + permissions step
- iter 31: weekly URL + dual commission + offre_acceptee + scheduler refactor
- iter 32: 4 lots marque blanche (branding partout + funnel brandé + billing B2B + sous-domaine)
- iter 36: Mode "Dieu" Super Admin (validé visuellement — bouton Voir l'espace + banner + permissions admin OK)
- iter 37: Carrousel iPhone live dans wizard marque blanche (3 mockups brandés temps réel — validé visuellement)

## Critical info
- **Réponse FR exclusive** dans toutes les interactions agent.
- **REACT_APP_BACKEND_URL** (preview) = `https://responsive-kolo.preview.emergentagent.com`
- **FRONTEND_URL** (prod) = `https://trykolo.io`
- Le scheduler tourne dans un thread async daemon initialisé au startup FastAPI.
- L'org de test `iad-demo` (custom_subdomain=`iad`) ne doit pas être supprimée — fixture de branding pour les tests UI.
er + super-admin pro+ + permissions step
- iter 31: weekly URL + dual commission + offre_acceptee + scheduler refactor
- iter 32: 4 lots marque blanche (branding partout + funnel brandé + billing B2B + sous-domaine)
- iter 36: Mode "Dieu" Super Admin (validé visuellement — bouton Voir l'espace + banner + permissions admin OK)

## Critical info
- **Réponse FR exclusive** dans toutes les interactions agent.
- **REACT_APP_BACKEND_URL** (preview) = `https://responsive-kolo.preview.emergentagent.com`
- **FRONTEND_URL** (prod) = `https://trykolo.io`
- Le scheduler tourne dans un thread async daemon initialisé au startup FastAPI.
- L'org de test `iad-demo` (custom_subdomain=`iad`) ne doit pas être supprimée — fixture de branding pour les tests UI.
