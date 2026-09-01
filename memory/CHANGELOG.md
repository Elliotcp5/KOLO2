# KOLO - Changelog

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

