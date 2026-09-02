# KOLO - Changelog

## Post-fix DB Supabase — import_dvf_mutations patché + remesures — 2 sept. 2026

### 1. `est_mono_lot` renseigné à l'import DVF
- **`scripts/import_dvf_mutations.py`** patché : dans `map_to_rows`, décompte des `id_mutation` dans le lot post-filtre puis `est_mono_lot = (count == 1)`.
- Calcul client-side, pas de RPC Supabase à créer.
- `delete_year_scope` vide l'intégralité du périmètre (année × dept) avant insert et un `id_mutation` DVF est unique à un couple (année, dept) → le comptage dans le DataFrame donne le même résultat que `COUNT(*) OVER (PARTITION BY id_mutation)` côté SQL.
- Cas d'`id_mutation` NULL → `est_mono_lot = FALSE` (exclu de la vue, par sécurité).
- Test unitaire manuel : mutation mono-lot → TRUE, mutation à 2 bâtis (appart + maison) → 2 lignes FALSE, ligne sans id_mutation → FALSE, ligne surface ≤ 9 → filtrée.
- Documentation à jour dans le docstring du script.

### 2. Colonnes réhabilitées — pas de casse
Aucun consommateur du code ne lit les colonnes que l'ancienne vue renvoyait à NULL (`id`, `code_departement`, `id_parcelle`, `surface_terrain`, `inserted_at`). Vérifié par grep sur `/app/backend/scripts/comparables.py` et `/app/backend/a3/`. Les 3 lieux qui interrogent `mutations_propres` (`comparables.py` × 2, `job_generer_opportunites.py` × 1) filtrent sur bbox / postal_code / type_local et lisent uniquement les colonnes maintenant réellement exposées.

### 3. Remesures perf — le fix DB seul divise la latence par 10 sur Marseille

**Estimations `POST /api/estimations` (3 runs consécutifs)**

| Ville | Avant (client-side seul) | Après fix DB | Facteur |
| --- | ---: | ---: | ---: |
| Paris 75004 | 1,5–2,2 s | **2,1 s → 0,8 s → 0,6 s** | ~3× à chaud |
| Lyon 69003 | ~5 s | **1,5 s → 0,6 s → 1,0 s** | ~5× |
| Marseille 13001 | 7,4 s | **0,85 s → 0,48 s → 0,60 s** | **~10×** |

Toutes les villes passent maintenant sous la cible de 2 s dès le premier appel.

**Job de génération d'opportunités — `_fetch_median_local_m2`**

Chaque DPE traité par le job nocturne appelle cette fonction pour le sous-score prix /m² (rayon 500 m, 24 mois). Cache in-run par tuile de 100 m.

| Ville | Fresh (network) | Cached (in-run) |
| --- | ---: | ---: |
| Paris cold | 1 542 ms | 0 ms |
| Paris tuile voisine | 273 ms | — |
| Lyon cold | 368 ms | 0 ms |
| Lyon tuile voisine | 283 ms | — |
| Marseille cold | 531 ms | 0 ms |
| Marseille tuile voisine | 489 ms | — |

Avant fix DB, la même requête sur Marseille prenait plusieurs secondes (le bbox 500 m était le bottleneck identifié). Sur un run nocturne à 10 000 DPE, avec ~5 % de miss cache : passage de plusieurs heures cumulées à quelques dizaines de minutes.

### Conséquences
- L'objectif « estimation < 2 s » est **atteint sur les 4 zones testées**, y compris là où c'était impossible avant le fix DB (Marseille).
- Le job nocturne pourra traiter plus de DPE par heure, ce qui débloque à terme l'extension à d'autres départements (06, 33, 44, 31…).
- Aucun code retiré : les optimisations client-side précédentes (parallélisation postal_median, max_pages 3) restent utiles — elles cachent la latence réseau incompressible entre l'appli et Supabase.


## Backfill etage_dpe + analyse d'impact — 2 sept. 2026

### Script `scripts/backfill_etage_dpe.py`
- Passe la regex corrigée (`Etage : X` désormais reconnu) sur `caracteristiques.complement_adresse` de toutes les opportunités où `caracteristiques.etage_dpe` est absent.
- Bulk update par lots de 500. Idempotent (le second passage ne modifie rien).
- Mode `--dry-run` pour rapport sans écriture.

### Résultats (exécution 2 sept. 2026)
- **60 opportunités** ont un `complement_adresse` non vide
- **`etage_dpe` rempli AVANT** : 31 / 60 = **51,7 %**
- **`etage_dpe` rempli APRÈS** : 34 / 60 = **56,7 %**
- **3 opportunités mises à jour** (étages : 1×3, 2×5)
- Le taux de complétion final (56,7 %) reflète que ~43 % des DPE ADEME n'ont AUCUN étage dans leur `complement_adresse` — la regex n'y peut rien.

### Impact sur les rapprochements — UPPER BOUND
- **87 373 rapprochements** au total en base.
- **1 572 rapprochements** ont `breakdown.etage=0.5` (= info manquante d'au moins un côté), soit 1,8 %.
- Zone de bascule autour des seuils décision (score peut varier de ±0,025 avec un poids 0,05 sur ce sous-score) :
  - **Vente flip_up (opportunité → deja_en_vente_signale)** : **189** rapprochements dans `[0,725 ; 0,75)` — bien candidats à la déclassification si score gagne 0,025.
  - **Vente flip_down (deja_en_vente → opportunité)** : **5** rapprochements dans `[0,75 ; 0,775)` — annonces rapprochées qui auraient rebasculé en opportunité si score perdait 0,025.
  - **Location flip_up / flip_down** : 0 / 0 (aucun score location dans la zone de bascule 0,80 ± 0,025).
  - **Stables** (hors zone) : 1 378.
- **194 décisions maximum** auraient changé si le moteur était rejoué avec le champ corrigé.
- **Chiffre le plus important** : jusqu'à **189 opportunités écartées à tort** faute de ce signal (annonces rapprochées avec `has_floor` renseigné, DPE dont l'étage n'a pas pu être vérifié → sous-score 0,5 → score global juste sous 0,75 → décision « ne pas signaler comme déjà en vente », mais le vrai signal aurait probablement confirmé la vente).

### Caveat honnête
C'est un UPPER BOUND. Les 1 572 rapprochements ne sont pas tous des cas où le DPE avait un `complement_adresse` avec étage parsable — beaucoup sont des cas où l'annonce n'avait tout simplement pas de champ étage. Sans re-fetch ADEME sur les DPE historiques (dont le `complement_adresse` n'a pas été stocké dans `rapprochements`), impossible de distinguer. Le vrai chiffre est **quelque part entre 0 et 194**. Pour l'obtenir de façon exacte, il faudrait rejouer le moteur sur ces 1 572 rapprochements avec un DPE ré-ingéré.

### Conséquence pour la suite
- Le sous-score `etage` continuera à ne discriminer que sur les rapprochements où l'annonce a un étage ET le DPE a un `complement_adresse` avec le mot « Etage ». Le poids 0,05 reste modeste.
- Recommandation à trancher : envisager un job de re-scoring des rapprochements récents (< 30 jours) pour capturer les 189 opportunités potentiellement mal classées — hors périmètre BLOC C1 mais candidat au backlog.


## Partie 1 — 2e passe (ADEME DPE + diagnostic perf) — 2 sept. 2026

### 1. ADEME DPE dans « Estimer depuis une adresse »
- **Nouveau helper backend `_fetch_dpe_at_address()`** dans `c1/routes.py` :
  - Requête ADEME par **`identifiant_ban`** (fiable 100 % quand BAN score ≥ 0,8).
  - Fallback en full-text ADEME (`code_postal:"…" AND adresse:(3 premiers mots)`).
  - Timeout 5 s, non bloquant en cas d'échec.
- **`POST /api/estimations/geocoder`** renvoie maintenant `{ ok, resultat, dpe, dpe_manquant }`. Le DPE contient `type_bien`, `surface_habitable`, `annee_construction`, `classe_dpe`, `classe_ges`, `etage_dpe` (extrait via regex A3), `nb_niveaux`, `hauteur_sous_plafond`, et le DPE canonique complet dans `caracteristiques`.
- **Regex `_ETAGE_COMPLEMENT_RE` corrigée** dans `a3/job_generer_opportunites.py` pour tolérer `Etage : 6` (avant, `\s*` bloquait sur les `:`). Fix rétroactif applicable à toute l'ingestion DPE — extrait bien l'étage sur les DPE au format ADEME courant.
- **Frontend `EstimationAdressePage`** : quand `dpe` est présent, affiche un cartouche « Diagnostic trouvé, informations pré-remplies : Type · Surface · DPE » et supprime la saisie type/surface. Le bouton ESTIMER va directement au flow avec `caracteristiques` complet, ce qui déclenche `prefillFromBien()` en aval — au final zéro question redondante.
- **Test manuel** : `5 rue de Rivoli 75004` renvoie DPE 5,3 m² · classe G · Étage 6 · type Appartement. Le flow saute type/surface. En combinaison avec `prefillFromBien`, seule la question « état général » reste à poser.
- **Adresse sans DPE ADEME** : le front affiche le message figé « Aucun diagnostic trouvé à cette adresse. » et demande type + surface.

### 2. Diagnostic performance — pas d'index posé au jugé
- Documenté dans **`/app/memory/DIAGNOSTIC_MARSEILLE_500M.md`** :
  - SQL exact envoyé à Supabase (bbox 500 m Marseille avec valeurs numériques).
  - Trois blocs `EXPLAIN (ANALYZE, BUFFERS)` à lancer dans SQL Editor Supabase (Marseille 500 m + Marseille 3000 m + Paris 500 m comparaison).
  - Requêtes `pg_indexes` + `pg_stat_user_tables` + `pg_get_viewdef` — précision que `mutations_propres` est une vue, les index vont sur `mutations`.
  - Note explicite : GIST demande **PostGIS**, non activé. Une simple B-tree composite `(type_local, date_mutation, latitude, longitude)` suffit probablement.
  - Hypothèses classiques à confirmer par les plans : (a) `last_analyze` ancien → `ANALYZE`, (b) index manquant sur `(latitude, longitude)`, (c) planificateur qui préfère seq scan sur petit range.
- **PostgREST bloque `EXPLAIN` via API** (HTTP 406). Le user lancera dans SQL Editor.

### Tests
- **120 tests passent** (27 C1 + 24 B1 + 26 B3 + 33 A3 + 10 IAP). Regex étage `_etage_dpe_from_complement` retestée indirectement par les tests A3 (test_a3_verite_terrain, test_a3_matching).


## Partie 1 — Correctifs post-recette (shouldAskQuestion + perf) — 2 sept. 2026

### 1. `shouldAskQuestion()` branché sur les données réelles
- **Nouveau helper `prefillFromBien(bien)`** dans `B1Estimation.jsx` : extrait ce qui est déjà connu depuis
  - le DPE (`caracteristiques.etage_dpe`, `nb_niveaux`, `type_batiment`)
  - l'annonce rapprochée (`listing.has_elevator`, `has_balcony`, `has_terrace`, `has_garden`, `has_parking`, `floor`).
- **Règles appliquées** :
  - **Type de bien** : toujours pré-rempli depuis le DPE, jamais demandé.
  - **Étage** : `etage_dpe` (extrait via `_etage_dpe_from_complement` en A3) ou `listing.floor`. Mappé sur `rdc/1/2/3/3plus`.
  - **Ascenseur** : `listing.has_elevator` si annonce, sinon question. Sur maison → skip.
  - **Extérieur** : cascade `has_garden > has_terrace > has_balcony` depuis l'annonce.
  - **Stationnement** : `has_parking` depuis l'annonce (conservateur : « garage » si vrai, « aucun » si faux).
  - **État général** : rien ne le donne jamais → toujours posé (seule question qui reste garantie).
- **Initialisation `answers` avec les valeurs pré-remplies** — l'utilisateur peut corriger, jamais un formulaire vide.
- **`activeQs` recalculé** via `shouldAskQuestion(q, bien, prefilled)`.
- **Tracking `nb_questions_posees`** ajouté à l'event `estimation_lancee` (payload : `{ opp_id, nb_questions_posees, source }`). Journalise directement le budget « 5 taps max ».
- **Test manuel** : bien avec `etage_dpe: 2` + listing `has_elevator: true, has_balcony: true, has_parking: false` → **1 seule question posée** (état général), écran « Question 1 sur 1 » avec bouton ESTIMER directement disponible.
- Swipe-droite dans `B1Shell.jsx` passe désormais `caracteristiques` complet et `listing` (si présent) dans le state React Router.

### 2. Parallélisation Supabase — sans Redis
- **`get_comparables()` accepte maintenant un `postal_code` optionnel** (`scripts/comparables.py`). Quand fourni, la médiane postale se lance en `asyncio.create_task()` en parallèle du bbox ladder, et est awaitée à la fin.
- **`_fetch_postal_code_median.max_pages`** réduit de 10 → 3 (3000 mutations max = médiane robuste, cap la latence sur CP denses).
- **Le c1 engine passe le `postal_code`** connu depuis le bien (opportunité ou géocodeur BAN) — donc la parallélisation est toujours active en pratique.

### Perf mesurée après optimisation
| Ville | Cible | Avant | Après | Statut |
| --- | --- | --- | --- | --- |
| Paris 75004 | < 2 s | 2,1–3,0 s | **1,5–2,2 s** | ✅ Sous cible |
| Lyon 69003 | < 2 s | ~5 s | **~5 s** | ❌ |
| Marseille 13001 | < 2 s | 7,7 s | **7,4 s** | ❌ |

### Cause identifiée sur Lyon/Marseille (isolée par bench direct Supabase)
- Le bbox 500 m à Marseille prend **7,1 s** côté Supabase pour retourner 156 lignes — indépendant du client, reproductible sur 5 requêtes successives (7,0 / 7,2 / 7,0 / 7,3 / 7,2 s).
- À l'inverse, les bboxes 1000/2000/3000 m à Marseille prennent < 1,2 s chacune.
- Cause probable : plan d'exécution PostgreSQL défavorable sur la combinaison (`type_local` + `date_mutation` + petit bbox `latitude`/`longitude`). La vue `mutations_propres` manque probablement d'un index composite pour cette clé.
- **Correction hors code** : ajouter un index GIST sur `(latitude, longitude)` ou un composite `(type_local, date_mutation, latitude, longitude)` côté Supabase. C'est une intervention infra, pas frontend/backend.

### Tests
- 27 tests C1 + 23 tests B1/B3 = **50/50 passent**. Aucune régression sur les critères de recette Partie 1.



### Backend `/app/backend/c1/`
- **`c1/engine.py`** — moteur 100 % déterministe (aucun LLM). Pipeline `run_estimation()` :
  1. Comparables via `get_comparables()` existant (ladder 500→1000→2000→3000 m).
  2. Corrections comparables : temporelle (marché stable = 0 % en v1, TODO Supabase agrégé) + taille (±8 %, écart >15 %).
  3. Surface pondérée depuis `infos_pro` du user + plafond annexes 25 % de habitable + jardin nul sur maison.
  4. Ajustements spécifiques : étage 3+ sans ascenseur = plancher −10 %, RDC, dernier étage asc., vue/vis-à-vis, état (4 niveaux), travaux € (non-cumul avec énergie).
  5. Décote énergie : table `config_matching.decote_energie` (région × type × classe) — référence = classe médiane des comparables (pas D absolue). Valeurs provisoires (source + date_maj marqués).
  6. Non-cumul travaux vs énergie : garde le plus pénalisant.
  7. Garde-fou ±25 % → si atteint, bascule confiance en faible.
  8. Fourchette Q1/Q3 sur comparables corrigés + ajustements appliqués.
  9. Prix commercialisation = valeur × (1 + `config_matching.marge_negociation`).
  10. Net vendeur optionnel (formule dépend de `honoraires_charge`).
- **`c1/routes.py`** — endpoints :
  - `POST /api/estimations` — lance le moteur (quota via `verifier_quota`, 402 si épuisé).
  - `GET /api/estimations` — liste (auth + `X-Robots-Tag: noindex`).
  - `GET /api/estimations/{id}` — détail (auth + noindex).
  - `POST /api/estimations/geocoder` — BAN + rejet score <0,8 + blocage DVF exclu.
- **`c1/schemas.py`** — Pydantic `EstimationInput` + `EstimationOutput`.
- **Blocage territoires DVF exclus** : Alsace-Moselle (57/67/68) + Mayotte (976).
- **`a2/config.py`** : ajout `decote_energie` (IdF + autre) et `stationnement_par_dept` (défauts + 75/92/13/69) avec `source` et `date_maj` traçables.
- **Persistance** : collection `estimations` (déjà indexée) — comparables figés dans le doc pour rejeu identique après refresh DVF.

### Frontend `/app/frontend/src/b1/`
- **`B1Estimation.jsx`** — 5 pages : `EstimationHomePage`, `EstimationAdressePage`, `EstimationFlowPage` (state machine 5 questions), `EstimationResultPage` (3 chiffres + confiance + accordéon audit), `MesEstimationsPage`, `EstimationDetailPage`.
- **`b1i18nEstimation.js`** — copie complète FR / EN / IT / DE (60+ clés, aucune string en dur).
- **Copie FR figée avec Elliot** (6 corrections intégrées : « Estimation basse / Prix recommandé / Estimation haute », loader sans promesse temporelle, message plafond ±25 % neutre, accordéon = détail chaque ajustement, vocab aligné « Place de parking » / « Garage », règle « 3+ sans ascenseur = plancher −10 % »).
- **Swipe-droite sur opportunité** → ouvre `/app-b1/estimation/flow` avec bien pré-rempli (fallback vers `/estimation/adresse` si opportunité démo sans lat/lng).
- **Draft offline** via `saveDraft/loadDraft/clearDraft` (b3offline).
- **Tracking B3** : `estimation_lancee` + `estimation_affichee` (avec `duree_ms`).
- **`X-Robots-Tag: noindex, nofollow`** côté API + `<meta name="robots">` côté front sur toutes les pages d'estimation.

### Tests `/app/backend/tests/test_c1_estimation.py`
- 27 tests unitaires couvrant : `is_dvf_exclu`, `_correction_taille_pct`, `_calculer_surface_ponderee` (dont plafond 25 %, jardin nul sur maison), `_ajustements_specifiques` (dont règle 3+ sans ascenseur), `_ajustement_energie` (référence médiane comparables), `_garde_fou_plafond`.
- **55 tests total passent** (27 C1 + 28 B1/B3/IAP).

### Perf mesurée
- Estimation dense (Paris 4e, 20 comparables) : **2,1–3,0 s** end-to-end (au-dessus de la cible < 2 s).
- Cause : deux appels Supabase séquentiels (`get_comparables` + `_fetch_postal_code_median`).
- TODO C1.5 : paralléliser + cache Redis 24 h sur médiane postale.

### Ce qui n'est PAS fait dans cette session (à faire en Partie 2 / prochaine session)
- **Partie 2 (Dossier + PDF WeasyPrint)** : reportée intégralement pour ne pas bâcler (consigne explicite du user « deux parties solides plutôt que trois bâclées »).
- **Partie 3 (Dictée)** : reportée (session courte séparée prévue).
- Correction temporelle réelle (v1 = marché stable, calcul à brancher sur mutations_propres).
- Skip auto de questions déjà répondues par le DPE (extension point `shouldAskQuestion()` prêt).


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
