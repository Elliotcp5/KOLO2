# KOLO - Changelog

## Revue visuelle pré-BLOC C — 1 sept. 2026

- 10 captures d'écran de l'app dans son état BLOC B (fin de session précédente) partagées avec l'utilisateur pour validation avant lancement du BLOC C (Estimation + Dossier PDF + Dictée).
- Écrans couverts : Onboarding steps 1/2/3, Opportunités (carte rose démo), Performances (état vierge "Vos premiers chiffres"), Profil menu (plan Pro), Profil pro (formulaire), Veille Suivis (état vide), Zones prospection, Paywall Veille (ambre), et écran facturation "Tu es Pro".
- Aucune modification de code. Login effectué via compte Apple Review (`applereview@trykolo.io`, code `424242`).


## Version 2.10.0 - 1er Juillet 2026

### Refonte Site Marketing (www.trykolo.io) — Palette monochrome stricte

#### Design system
- Palette 100% Noir / Blanc / Gris (aucune autre couleur autorisée)
  - Ink: #000 / #0A0A0A / #1A1A1A / #3A3A3A
  - Muted: #6E6E73 / #86868B
  - Lines: #E5E5E7 / #F0F0F2
  - BG soft: #F5F5F7
- Purge complète des anciennes couleurs (corail #FF5A36, vert #1E7A3C, ivoire crème, gradients pêche/bleu)
- Inspiration Qonto / Revolut / Vercel / Linear (éditorial, whitespace, hiérarchie type)

#### Composants refaits
- `marketing.css` : réécrit intégralement (962 lignes, tokens CSS scopés à `.mkt-root`)
- `PhoneFrame.js` : mockup iPhone 15 Pro CSS-only photoréaliste (Dynamic Island, bezel titane, boutons latéraux, glare, animation flottement)
- `HomePage.js` : checks & floating cards monochromes, pricing 24,90€/mois tout-inclus intact
- `HowKoloPage.js` : tags Before (barré gris) / After (noir plein blanc) monochromes
- Ombres portées : gris pur uniquement (plus de radial gradients roses/bleus/jaunes)
- Sections alternées : fond blanc / fond gris clair `#F5F5F7`
- Photo fondateur : filtre `grayscale(60%) contrast(1.02)` pour cohérence de marque

#### Validation
- Testing agent (iteration_60) : 100% de conformité monochrome sur les 5 routes marketing (/, /comment-kolo, /a-propos, /ressources, /legal)
- Zéro couleur non-monochrome détectée (color/bg/border/fill/stroke + gradient stops)
- Responsive desktop 1440px et mobile 390px validés


## Version 2.0.0 - 11 Mars 2026

### Nouvelles fonctionnalites

#### Mode Clair / Sombre
- Ajout d'un systeme de theme complet (light/dark)
- Mode clair comme experience par defaut pour les nouveaux utilisateurs
- Variables CSS globales via `.theme-light` et `.theme-dark`
- Toggle "Apparence" dans Mon Profil (icones soleil/lune)
- Preference sauvegardee en base (champ `theme_preference`)
- Changement instantane sans rechargement

#### Statuts Prospect Pipeline
- 5 statuts: nouveau, contacte, qualifie, offre, signe
- Badge statut sur chaque card prospect
- Couleur verte pour le statut "signe" (reuse du swipe-to-done)

#### Didacticiel de Bienvenue (Onboarding)
- 5 ecrans sequentiels avec progress bar
- Ecran 1: Bienvenue
- Ecran 2: Import contacts (si API disponible)
- Ecran 3: Creation de tache
- Ecran 4: Choix du theme (obligatoire)
- Ecran 5: Confirmation avec confetti
- Bouton "Passer" sur chaque ecran (sauf theme)
- Actions reelles sauvegardees en base

#### Streak de Suivi
- Compteur de jours consecutifs avec au moins 1 tache completee
- Affichage "Serie en cours: X jours" ou "X semaines de suivi parfait"
- Visible uniquement si streak >= 2 jours

#### Message Contextuel Dynamique
- Message personnalise selon l'heure et les taches
- Avant 12h: "Belle journee devant vous."
- Apres 15h avec retards: "[N] prospects n'attendent que vous."
- Toutes taches completees: "Journee parfaite."

#### Ameliorations UX
- Animation IA: "Analyse du projet de [prenom]..." lors de la generation
- Lien "En retard — Relancer maintenant" sur les taches en retard
- Bouton "Resilier l'abonnement" avec modale de confirmation
- Formulaire prospect ameliore avec helper text

#### Landing Page Refonte
- 7 sections: Hero, Probleme, Comment ca marche, Temoignages, Pricing, FAQ, CTA final
- Headline percutant: "Vos prospects vous oublient parce que vous les oubliez."
- FAQ integree en accordion

### Modifications Backend

#### Nouveaux champs User
- `theme_preference`: 'light' | 'dark' (default: 'light')
- `didacticiel_completed`: boolean (default: false)
- `tooltips_seen`: List[str]
- `streak_current`: int
- `streak_last_activity_date`: datetime

#### Nouveaux champs Prospect
- `status`: 'nouveau' | 'contacte' | 'qualifie' | 'offre' | 'signe'
- `source`: 'seloger' | 'leboncoin' | 'reseau' | 'recommandation' | 'autre' | 'manual' | 'import'

#### Nouveaux Endpoints
- `PUT /api/auth/preferences` - Mise a jour preferences (theme, didacticiel, tooltips)
- `GET /api/auth/streak` - Recuperer le streak actuel
- `POST /api/prospects/batch` - Import multiple de prospects

### Notes Techniques
- PWA React (pas React Native pour l'instant)
- Import contacts disponible sur Android Chrome uniquement (limitation iOS Safari)
- Confetti via canvas-confetti

## Version 1.x - Avant le 11 Mars 2026
- Voir PRD.md pour l'historique complet

---

## 29 Août 2026 — BLOC A / Session A1 : Ingestion des annonces

### Ajouts
- **`backend/normalization.py`** : module partagé de normalisation.
  - `normalize_property_type()` → appartement | maison | studio | loft | terrain | parking | local_commercial | bureau | immeuble | autre
  - `is_logement()` → True uniquement pour appartement/maison/studio/loft
  - `normalize_transaction()` → vente | location (via hint + fallback prix > 40k = vente)
  - `deduce_postal_code()` → auto-détecte le code postal pour Paris (75001-75020), Lyon (69001-69009), Marseille (13001-13016) quand la ville contient l'arrondissement
  - `apply_normalization()` → applique tout en un appel, muté in-place
- **`backend/migrations/A1_listings_extensions.sql`** : migration idempotente Supabase (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS) + 4 indexes filtrés sur `is_active = TRUE`. À APPLIQUER MANUELLEMENT après backup `CREATE TABLE listings_backup_a1 AS SELECT * FROM listings;`
- **`backend/migrations/README.md`** : procédure complète (sauvegarde, application, backfill, rollback)
- **`backend/scripts/zones_scraping.py`** : helpers Mongo pour la collection `zones_scraping`. Un document par (source, code postal) : `last_ingest_at`, `last_mode`, `last_run_ids`, `last_items_seen`, `total_ingests`
- **`backend/scripts/webhooks_apify.py`** : handler du webhook A1
- **`backend/scripts/backfill_normalization.py`** : rattrapage one-shot des listings existants après migration
- **`backend/tests/test_a1_normalization.py`** : 68 tests pytest (property_type, is_logement, transaction, postal_code, apply_normalization)

### Nouveaux endpoints
- `POST /api/webhooks/apify` — auth `X-Apify-Secret`. Body `{ mode: "complet" | "incremental", run_ids?: [...], stale_hours?: 48 }`. Le mode `complet` désactive les annonces non revues sur les codes postaux du run ; `incremental` fait uniquement de l'upsert.
- `GET /api/webhooks/apify/zones` — auth `X-Apify-Secret` OU `X-Admin-Secret`. Liste des zones scrapées (dashboard admin).

### Modifications
- **`backend/scripts/ingest_apify.py`** : appelle `apply_normalization()` sur chaque item avant upsert. Nouvelle signature `_ingest_one_run(allow_deactivate=True)`. Compteurs `inserted`/`updated` désormais proratés sur `rows_sent_to_supabase` (plus de surestimation en cas d'échec Supabase).
- **`backend/v2_router.py`** : `_upsert_supabase_listings()` (utilisé par le cron legacy) passe désormais par `apply_normalization()`. **Le cron legacy et le webhook produisent maintenant des lignes identiquement normalisées** — aucun risque de lignes incomplètes pour le futur moteur d'opportunités.
- **`backend/.env`** : ajout de `APIFY_WEBHOOK_SECRET` (secret aléatoire 48 bytes).

### Corrections annexes
- **`backend/routes/plans.py`** : lint F821 corrigés (`get_current_user` et `db` non définis dans 2 endpoints morts). Import lazy remplacé par des imports scope-local.

### Testé
- `pytest tests/test_a1_normalization.py` → 68/68 passed
- `POST /api/webhooks/apify` : auth (401), validation body (400), succès (200), items_fetched, sources détectées, zones_scraping alimenté (60 zones × sources après un run test)
- `GET /api/webhooks/apify/zones` : 200 avec liste triée par `last_ingest_at DESC`

### Reste à faire côté utilisateur
1. Backup `listings` : `CREATE TABLE listings_backup_a1 AS SELECT * FROM listings;`
2. Appliquer `backend/migrations/A1_listings_extensions.sql` dans le SQL Editor Supabase
3. Lancer `python -m scripts.backfill_normalization --dry-run` puis sans `--dry-run`
4. Configurer Apify pour appeler `POST /api/webhooks/apify` en fin de run (headers : `X-Apify-Secret: <APIFY_WEBHOOK_SECRET>`, body `{"mode": "complet", "run_ids": ["{{runId}}"]}`)

---

## 29 Août 2026 — BLOC A / Session A2 : modèle de données

### Backup
- `backend/backups/users_pre_a2_20260829_132439.json` — 186 users (structure legacy complète)

### Migration users (idempotente, relançable sans effet de bord)
- **186 users migrés**, 0 role invalide restant
- Champs posés : `role`, `role_v1_legacy` (préservé), `organisation_id`, `siege_statut`, `zones_perso`, `zones_deja_modifiees`, `plan` (déduit), `plan_depuis`, `onboarding_infos_ok`, `tour_guide_vu`, `grille_ponderation`, `infos_pro`, `prenom`, `nom`, `statut_declare`, `a2_migrated_at`
- Répartition post-migration : role=independant×186, plan=pro×18 + decouverte×168
- Idempotence vérifiée : 2e run → patched=0, already_ok=186

### Nouvelles collections MongoDB (14, toutes avec indexes)
- `organisations` — siren, directeur_user_id, statut
- `invitations` — email+orga, code unique, statut, date_expiration
- `opportunites` — **index unique partiel `(organisation_id, dpe_id)`** implémentant la règle « 2 conseillers d'une même agence ne reçoivent jamais la même opportunité »
- `zones_couvertes` — code_postal unique, actif (zones commerciales servies)
- `zones_demandees` — unique (user_id, code_postal), notifie
- `quotas` — unique (user_id, type, periode)
- `rapprochements` — dpe_id, code_postal, date_traitement, decision
- `enrichissements` — id_parcelle unique (cache 6 mois BAN/Cadastre/Georisques)
- `estimations`, `conversations`, `signalements` — schémas seuls (remplis en sessions ultérieures)
- `device_tokens` — unique (user_id, token)
- `events` — user_id, nom, date (traçage produit)
- `config_matching` — document unique `_id="singleton"` (aucun seuil en dur dans le code)

### Nouveaux modules `backend/a2/`
- `tz.py` — fuseau Europe/Paris (bascule à minuit Paris pour tous les fuseaux)
- `config.py` — accessor `config_matching` avec cache mémoire 30s
- `quotas.py` — **`verifier_quota()`** + **`incrementer_quota()`** (fonctions uniques que toutes les features doivent appeler)
- `indexes.py` — `ensure_a2_indexes()` idempotent au startup
- `migration_users.py` — script CLI idempotent
- `routes.py` — endpoints publics + admin

### Nouveaux endpoints
- `POST /api/events` — traçage produit (auth soft — user_id posé si loggué)
- `GET /api/admin/config-matching` — lecture (auth admin)
- `PATCH /api/admin/config-matching` — patch profond (préserve les sous-clés non touchées)
- `POST /api/admin/a2/migrate-users?dry_run=true` — relance la migration
- `POST /api/admin/a2/ensure-indexes` — force le passage indexes + seed config
- `GET /api/admin/a2/status` — diagnostic (counts + users_valid_role)

### Réponse `/api/v2/auth/verify-email-code` étendue
Retourne désormais `role`, `organisation_id`, `organisation_nom`, `plan`, `onboarding_infos_ok`, `tour_guide_vu`, `zones` — le front peut aiguiller à chaque lancement sans cache local. Auto-migration paresseuse si le user rate le script (filet de sécurité).

### Tests pytest (24 nouveaux, tous verts sur 8 runs consécutifs)
- `test_a2_tz.py` — 9 tests, dont bascule 00h Paris pour un user à Dubaï
- `test_a2_quotas.py` — 6 tests, dont **« Découverte refuse 2e estimation, Pro l'autorise »**
- `test_a2_opportunites_unicite.py` — 4 tests, dont **« 2 conseillers d'une agence ne reçoivent jamais la même opportunité »** avec `pymongo.DuplicateKeyError`
- `test_a2_config_events.py` — 5 tests live sur le backend en cours

### Critères de recette validés (9/9)
1. Aucun user sans role : 0/186 invalides
2. Migration idempotente (2e run patched=0)
3. Backup collection users pré-migration présent
4. Login retourne role/organisation_id/plan
5. Découverte refuse 2e estimation, Pro l'autorise (pytest)
6. Bascule 00h Paris pour user à Dubaï (pytest)
7. POST /api/events écrit un event
8. GET/PATCH /api/admin/config-matching + aucun seuil en dur hors `a2/`
9. 14 collections + indexes tous présents

### Reste à faire côté produit
- Rien pour A2. Les collections `estimations`/`conversations`/`signalements` seront remplies quand leurs features seront construites.

---

## 1er septembre 2026 — BLOC B / Session B1 : Onboarding + Paywall + Tour + Profil

### Backend `backend/b1/`
- `ville_resolver.py` : table CP → ville (Paris/Lyon/Marseille arrondissements + ~200 CP FR) + whitelist démo `99999` + zones bootstrap `13008/69003/75017/99999`.
- `routes.py` : 10 endpoints, tous préfixés `/api` :
  - `GET /api/b1/ville/{cp}` — résolveur public
  - `POST /api/onboarding/profil` — prénom + nom + statut (agent/directeur)
  - `POST /api/onboarding/zones` — 1-2 CP, contrôle vs `zones_couvertes`, insert `zones_demandees` pour tout CP rouge
  - `POST /api/onboarding/plan` — `decouverte` (bascule immédiate) ou `pro` (intention, activée par le verify Apple IAP)
  - `POST /api/onboarding/termine` — set `onboarding_infos_ok=true` + `bonus_bienvenue_a_crediter=true`
  - `GET /api/me/quotas` — via `a2.quotas.verifier_quota` (jamais dupliqué)
  - `GET /api/me/profil` — user + `infos_pro` + `infos_pro_completude`
  - `PATCH /api/me/profil` — payload `{perso, infos_pro}` (bloc distinct pour préparer l'export PDF du bloc C)
  - `PATCH /api/me/zones` — 1 modif à vie pour Découverte (402 si épuisé), illimité pour Pro
  - `DELETE /api/me` — Apple 5.1.1(v) — variantes indépendant / conseiller (notifie directeur) / directeur (conserve l'orga)
- Bootstrap au startup : insert idempotent des 4 zones (`99999` marquée `demo:true`).
- **Zone de démonstration `99999`** : toujours couverte, jamais désactivable. Le vrai CP à communiquer à Apple dans les notes de revue reste `13008`.
- **Grille de pondération surfaces annexes** — valeurs par défaut : Terrasse 0,35 · Balcon et loggia 0,25 · Combles aménageables 0,30 · Cave et cellier 0,12 · Garage 0,40 · Place de parking 0,30 · Jardin 0,10.

### Frontend `frontend/src/b1/`
- `b1i18n.js` — 4 langues **FR / EN / IT / DE**, vouvoiement partout, **zéro texte hardcodé** (110+ clés).
- `b1.css` — CSS scopé `.b1-root` : accent `#EC8690`, fond `#F0EEF8`, cartes blanches 24px, boutons pill, ombres douces, animation swipe hand, animation slide entre étapes.
- `B1Icons.jsx` — 4 icônes SVG custom pour la bottom nav (main-swipe / calc / doc / robot) + Stats + User.
- `demoOpportunites.js` — 4 cartes fictives pour la zone `99999` (garantit un swipe fonctionnel côté reviewer).
- `B1Onboarding.jsx` — 7 écrans séquentiels : Identité, Statut, Zones (résolution ville en live), Traitement, Résultat, Plan, Bienvenue.
- `B1Shell.jsx` — bottom nav pilule à bord rose, GuidedTour 6 bulles (bulle 1 avec animation main swipe + définition d'une opportunité + sens des balayages), page Opportunités (avec DEMO_OPPORTUNITES), 3 placeholders (Estimation/Rapport/Assistant), Profil complet (perso, pro avec 17 champs + complétude, zones avec règle 1 modif Découverte, suppression 2-tap variante indep/conseiller/directeur + lien réglages iOS abonnement).
- Routes ajoutées à `App.js` : `/onboarding-b1`, `/app-b1`, `/app-b1/estimation`, `/app-b1/rapport`, `/app-b1/assistant`, `/app-b1/profil` + 5 sous-pages profil. Body BG synchronisé à `#F0EEF8` sur toutes les routes B1.

### Conformité Apple validée
- Écran 6 : pas de lien de paiement externe, pas de tarif Agence, `Restaurer mes achats` + `Conditions générales` + `Politique de confidentialité` en bas.
- Suppression de compte in-app 2-tap (5.1.1(v)), avec mention « L'abonnement Pro n'est pas résilié automatiquement » + bouton `Gérer mon abonnement` vers les réglages iOS.
- Assistant repassé au vouvoiement (« comment puis-je vous aider »).

### Textes-clés imposés respectés partout
- Paywall Pro : « Toutes les opportunités de vos zones, chaque jour ». Aucun volume chiffré d'opportunités nulle part.
- Zone non couverte : « Vos zones ne sont pas encore couvertes par KOLO. Nous reviendrons vers vous dès que nous les ouvrons. » avec pour seule action « Modifier ».
- Absence d'annonce : « Aucune annonce détectée » (jamais « ce bien n'est pas sur le marché »).
- Découverte : 1 opportunité/semaine · 1 estimation/semaine · 1 dossier/mois · pas d'assistant KOLO.

### Tests
- `pytest tests/test_b1_onboarding.py` → 7/7 passed (ville resolver, bootstrap zones, complétude pro, whitelist démo, idempotence `zones_demandees`, règles plan, coefficients par défaut).
- Régression Bloc A : `pytest tests/test_a1_normalization.py tests/test_a2_*.py` → **97/97 passed**. Aucune régression.
- Smoke test frontend (Playwright, mobile 390×844) : 7 écrans onboarding + shell + tour bulle 1 + profil + infos pro : tous validés visuellement.

### Fichiers créés
- Backend : `b1/__init__.py`, `b1/ville_resolver.py`, `b1/routes.py`, `tests/test_b1_onboarding.py`
- Frontend : `b1/b1i18n.js`, `b1/b1.css`, `b1/b1api.js`, `b1/B1Icons.jsx`, `b1/demoOpportunites.js`, `b1/B1Onboarding.jsx`, `b1/B1Shell.jsx`
- Docs : `memory/B1_COPY_FR.md` (copie FR figée), `design_guidelines.json`


## 1er septembre 2026 — BLOC B / Cartes « Biens en vente à surveiller »

### Backend
- `a2/config.py` — nouveau bloc `veille` : `min_days_on_market=90`, `dom_cap_days=180`, `price_drop_weight=2`, `seuil_quota_du_jour=3`, `max_par_jour=5`. `ensure_config_seeded` complète non destructivement les configs existantes.
- `a3/job_generer_opportunites.py` — extension **sans job séparé** : à chaque `deja_en_vente`, `_maybe_insert_veille_card()` évalue signaux (`days_on_market > 90` OU `price_drop_count ≥ 1`) et insère dans `veille_cards`. Idempotent sur `(dpe_id, listing_id)`. Score = `min(dom, 180) / 30 + price_drop_count * 2`. `_fetch_candidates` élargi à `first_seen_at`, `posted_at`, `days_on_market`, `price_drop_count`, `price_drop_pct`, `previous_price`.
- `b1/routes.py` — 3 endpoints :
  - `GET /api/me/veille` — Pro uniquement (402 Découverte), n'affiche rien si `quota_du_jour ≥ 3`, capé à 5, exclut cartes déjà actionnées, tri `score_veille` DESC.
  - `PATCH /api/me/veille/{listing_id}/statut` — statuts propres : `veille_a_surveiller` / `veille_ignoree` / `veille_demarchee`, **jamais dans les compteurs de la page Statistiques**.
  - `GET /api/me/veille/suivis` — liste des biens marqués à suivre.

### Frontend
- `b1i18nVeille.js` — namespace `veille.*` FR/EN/IT/DE (30+ clés).
- `b1Veille.css` — ambre franc `#F59E0B`, fond gris neutre `#F1F5F9`. **Rose banni** sur toute carte veille.
- `B1Veille.jsx` — 4 composants : `VeilleCard`, `VeilleIntercalaire`, `VeillePileDuJourPage`, `VeillePaywall`, `MesVeilleSuivisPage`.
- `B1Shell.jsx` — intercalaire ambre à la fin de la pile opportunités (Pro uniquement, quota du jour < seuil). Nouvelle entrée profil « Biens en vente à surveiller ».
- Routes : `/app-b1/veille`, `/app-b1/veille/paywall`, `/app-b1/veille/suivis`.

### Textes-clés imposés (dans `b1i18nVeille.js`)
- Bandeau : « Bien en vente à surveiller »
- Fait ancienneté : « Annoncé depuis {n} jours »
- Baisse simple : « Prix baissé une fois, −{pct} % » (jamais « 1 fois »)
- Baisse multiple : « Prix baissé {n} fois, −{pct} % »
- Boutons : « Passer » / « Marquer à suivre »
- Source : « Source : annonce en ligne » (jamais nommer le portail)
- Intercalaire : « Vous avez vu toutes vos opportunités de mandats du jour. »

### Ce qui est banni (commentaire en tête de `B1Veille.jsx`)
- Jamais « mandat à récupérer », « à démarcher », « opportunité », « mandat exclusif/simple » en surimpression
- Jamais de barre de progression sur la pile veille
- Jamais d'insertion dans la pile opportunités
- Rose `#EC8690` **interdit** sur toute carte veille

### Tests
- 7 tests pytest `test_b1_veille.py` : config defaults, signal min, DOM cap 180, baisse seule suffit, idempotence, plan Pro requis.
- Régression : **111/111 tests** verts.
- Smoke visuel : paywall FR + carte veille rendue « 12 rue Ampère », « Annoncé depuis 143 jours » + « Prix baissé 2 fois, −8 % », chip ambre overlay, aucun rose.

### Fichiers
- Backend : `tests/test_b1_veille.py` + patchs `a2/config.py`, `a3/job_generer_opportunites.py`, `b1/routes.py`
- Frontend : `b1/b1i18nVeille.js`, `b1/b1Veille.css`, `b1/B1Veille.jsx` + patchs `b1/B1Shell.jsx`, `App.js`
- Docs : `memory/B1_VEILLE_COPY_FR.md`, ajout PRD




## 1er septembre 2026 — BLOC B / Session B3 : Performances, Notifications, Réseau dégradé, Traçage

### Backend `backend/b3/`
- `routes.py` — 5 endpoints, tous préfixés `/api` :
  - `GET /api/me/performances?periode=mois|trimestre|annee` — 3 jauges + entonnoir + courbe cumulée. Basé sur `date_dernier_statut`, **jamais** sur date de création. Statuts positifs = `demarche` + `mandat_signe`. Statuts strictement exclus des 3 compteurs : `veille_a_surveiller`, `veille_ignoree`, `veille_demarchee`, `deja_en_vente_signale`.
  - `GET /api/admin/funnel?debut=&fin=` — 5 étapes en absolu + % étape précédente : Comptes créés → Paywall affiché → Plan choisi (détail Pro/Découverte) → Premier swipe J+1 → Quota atteint (détail upgrade Pro). Admin uniquement.
  - `POST /api/me/notifications/permission` — mémorise la décision (autorise / plus_tard / refuse) pour ne pas re-proposer.
  - `POST /api/me/device-token` — enregistre un token APNs (multi-appareils par utilisateur).
  - `POST /api/admin/zones/{cp}/ouvrir` — bascule `zones_couvertes.actif=true` + envoi email + push aux utilisateurs de `zones_demandees` + set `notifie=true`.
- `services.py` — envois email (Resend) + push APNs (JWT ES256 sans SDK, HTTP/2). Si `.p8` absent, journalisation en `push_logs` sans crash. `render_notif()` avec pluralisation `_one`/`_other` serveur.
- `a2/config.py` — ajout blocs `streak` (`objectif=7`, `seuil_notif=3`) et `notif` (`plafond_journalier=5`, `horaires_rappels=[9,11,14,17]`, `heure_streak=20`, `heure_decouverte_relance=18`). Aucun seuil en dur dans le code.
- Variables `.env` prévues (à fournir quand `.p8` disponible) : `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_ENV`, `RESEND_FROM_TRANSACTIONAL`.

### Frontend `frontend/src/b1/`
- `b1i18nB3.js` — namespace `perf.*`, `notif.*`, `email.*`, `net.*`, `funnel.*` FR/EN/IT/DE, ~100 clés dont **8 textes de notifications strictement différents**.
- `b1i18n.js` — helper `b1tPlural(baseKey, count, params)` avec CLDR-lite `_one`/`_other`/`_zero`. Aucune concaténation.
- `b3tracking.js` — helper `track(nom, params)` + `EVENTS` (18 événements). File offline persistée, replay au retour du réseau.
- `b3offline.js` — file locale d'actions génériques + brouillons de formulaires (`saveDraft` / `loadDraft` / `clearDraft`) + `onNetworkChange`. Réutilisable pour swipes et pour le dossier d'estimation à venir.
- `B3Perf.jsx` — `PerformancesPage` (3 jauges SVG entonnoir, courbe aire, sélecteur période), `NetworkBanner` (bandeau flottant hors ligne + retour vert 2s), `NotifPermissionScreen` (après tour guidé).
- `b3.css` — styles Performances + bandeau réseau, tokens `--b1-danger` `--b1-success` ajoutés à `b1.css`.
- Instrumentation traçage : `onboarding_debut`, `zones_validees` + `zone_non_couverte` (par CP rouge), `paywall_affiche`, `plan_choisi`, `tour_guide_termine` / `tour_guide_passe`, `premier_swipe` (une seule fois par compte), `swipe` (chaque interaction).

### Textes-clés imposés
- 4 rappels quotidiens à **4 textes distincts** (matin, milieu de matinée, début aprem, fin de journée).
- Streak à 20h : texte différent au dernier jour (« Un swipe aujourd'hui et votre opportunité bonus est débloquée. »).
- Relance Découverte : « Vous avez utilisé votre opportunité de la semaine. Le plan Pro vous donne toutes les opportunités de vos zones, chaque jour. » — reprend la formulation du paywall Pro, aucun volume chiffré.
- Ouverture zone : « Bonne nouvelle. Le {cp} est maintenant couvert par KOLO. »
- Écran permission : titre « Soyez prévenu des nouvelles opportunités ».

### Corrections de dette couleur (audit B3)
- Ajout tokens `--b1-danger: #DC2626`, `--b1-danger-pressed: #B91C1C`, `--b1-danger-tint`, `--b1-success: #16A34A`, `--b1-success-tint` dans `b1.css`.
- Suppression de **toutes les occurrences hex en dur** dans les composants React B1/B3.
- Icônes `lucide-react` : `color` prop retiré, héritage par `currentColor` via span parent avec `color: var(...)` (méthode propre, jamais `getComputedStyle`).
- Tokens danger/succès disponibles dans le sous-arbre veille (héritage `.b1-root`) — seul le rose y reste interdit.

### Tests
- 9 tests pytest `test_b3.py` : config B3 defaults, bornes mensuel/trimestre/année (avec conversion Paris), pluralisation FR (`1 opportunité` ≠ `5 opportunités`), rendu zone ouverte, relance Découverte reprend le texte paywall sans volume chiffré, APNs non configuré ne crashe pas, filtre exclusions veille + `deja_en_vente_signale`.
- Régression : **120/120 tests** verts (9 B3 + 7 veille + 7 onboarding + 5 config + 24 quotas + 68 A1). Aucune régression.
- Smoke visuel : écran permission notifications rendu, page Performances rendue avec 6/6/2 (démarchées 100 % / mandats 33 %), courbe cumul mois-en-cours, 2 statuts `abandon` bien exclus.

### Ce qui n'est PAS livré (session dédiée à prévoir)
- Envoi APNs réel : nécessite `.p8` + Key ID + Team ID + Bundle ID côté Apple Developer. Code prêt, journalise pour l'instant en `push_logs`.
- Scheduler des rappels : le squelette est en place (config + endpoints + services). Le tick minute côté serveur reste à câbler quand les envois seront testables.
- Import Push Notifications Capacitor dans le natif iOS (build Codemagic à ré-exécuter avec le plugin ajouté).

### Fichiers créés
- Backend : `b3/__init__.py`, `b3/routes.py`, `b3/services.py`, `tests/test_b3.py` + patchs `a2/config.py`, `server.py`
- Frontend : `b1/b1i18nB3.js`, `b1/b3tracking.js`, `b1/b3offline.js`, `b1/B3Perf.jsx`, `b1/b3.css` + patchs `b1/b1i18n.js`, `b1/B1Onboarding.jsx`, `b1/B1Shell.jsx`, `App.js`, `b1/b1.css`


## 1er septembre 2026 — Session IAP réel + App Store Server Notifications V2

### Backend
- **`b3/apple_webhook.py`** — nouveau `POST /api/webhooks/apple`. Vérifie la signature JWS ES256 via la clé publique embarquée dans `x5c`, décode `signedTransactionInfo` et `signedRenewalInfo`, applique les transitions :
  - `SUBSCRIBED` / `DID_RENEW` → `plan=pro`, `subscription_ends_at` mis à jour.
  - `DID_CHANGE_RENEWAL_STATUS` + `AUTO_RENEW_DISABLED` → `subscription_will_cancel_at_period_end=true`, accès conservé.
  - `EXPIRED` → `plan=decouverte` **+** `zones_deja_modifiees=false`.
  - `DID_FAIL_TO_RENEW` → `grace_period_active=true`, accès conservé.
  - `REFUND` / `REVOKE` → `plan=decouverte` immédiat + `zones_deja_modifiees=false`.
- **Verrouillage `plan_source`** — un compte en `plan_source != "apple_iap"` n'est jamais rétrogradé par le webhook. Journalisation dans `apple_webhook_logs`.
- **Migration exécutée** : 19 comptes Pro → `plan_source="manuel"` (protégés, dont Elliot), 179 autres → `apple_iap`.
- **`/api/iap/verify-apple-receipt`** pose maintenant `plan_source="apple_iap"`. Sandbox fallback 21007 déjà en place, vérifié.
- **`POST /api/admin/push/test`** — envoie une notif de test à un compte cible.

### Frontend
- **`B1Onboarding.jsx` — écran 6 branché sur `cordova-plugin-purchase` v13**. Trois issues gérées : validé → verify → écran 7, annulé → aucun message, erreur → « Connexion perdue » + Réessayer.
- **« Restaurer mes achats »** fonctionnel — récupère le receipt applicatif et le rejoue contre `verify-apple-receipt`. Fonctionne pour les Pro V2 existants.

### APNs
- Clé `.p8` stockée dans `backend/.env` (APNS_KEY_P8).
- `APNS_KEY_ID=LDQ2K5YLVZ`, `APNS_BUNDLE_ID=io.kolo.app`, `APNS_ENV=production`.
- **En attente** : `APNS_TEAM_ID` (10 caractères visibles en haut à droite du portail Apple Developer). Sans lui, la signature JWT ne peut pas être produite.

### Tests
- 4 nouveaux tests IAP webhook + 13 tests IAP+B3 tous verts.

### URL webhook à configurer dans App Store Connect
- Preview : `https://responsive-kolo.preview.emergentagent.com/api/webhooks/apple`
- Production : URL de prod à configurer une fois déployée.
