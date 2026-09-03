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


### BLOC D · Pipeline Codemagic + estampille build (Sep 3, 2026) 🔥 LATEST
- **3 bugs pipeline TestFlight identifiés et corrigés en même temps** :
  1. **`CI=false yarn build`** rendait les warnings ESLint silencieux → un vieux bundle avec imports/vars morts passait sans alerte. Passage à `CI=true yarn build` (warnings = fatal).
  2. **`CURRENT_PROJECT_VERSION = 79` hardcodé** dans `frontend/ios/App/App.xcodeproj/project.pbxproj` (Debug + Release). Info.plist utilise `$(CURRENT_PROJECT_VERSION)` → xcodebuild lisait la valeur du pbxproj, IGNORAIT `PlistBuddy` sur Info.plist. C'est ce qui a causé la régression TestFlight **78 → 69**. Correction : `sed -i -E "s/CURRENT_PROJECT_VERSION = [0-9]+;/CURRENT_PROJECT_VERSION = ${BUILD_NUMBER};/g"` sur pbxproj (les 2 configs), avec un `grep` de vérification post-patch qui échoue le build si une valeur ≠ BUILD_NUMBER reste.
  3. **Numéro de build calculé APRÈS `yarn build`** → l'estampille inlinée dans le JS bundle ne correspondait pas au build TestFlight. Restructuration de l'ordre : `install` → `compute BUILD_NUMBER` (query App Store Connect) → `CI=true yarn build` (avec `REACT_APP_BUILD_ID=${BUILD_NUMBER}-${SHORT_SHA}-${UTC}` injecté) → `npx cap sync ios` → `sanity md5(build/index.html) == md5(public/index.html)` → `sed pbxproj` → `pod install` → `signing` → `xcodebuild`.
- **Estampille visible dans l'app** : nouveau composant `/app/frontend/src/b1/B1BuildStamp.jsx` qui affiche `build <BUILD_NUMBER>-<sha7>-<UTC>` en bas de :
  - L'écran de connexion (V2AuthPage) — position `absolute; bottom: 16px`
  - La page profil (ProfilPage dans B1Shell) — sous le bouton "Se déconnecter"
  - Testé en preview (`build dev-40407053`) : lisible, discret, `data-testid="kolo-build-stamp"`.
- **Sanity check anti-stale** : le script Codemagic compare `md5(frontend/build/index.html)` à `md5(frontend/ios/App/App/public/index.html)` après `cap sync`. Si différent → `exit 1`. Empêche définitivement le "vieux bundle web embarqué".
- **`public/` déjà gitignoré** (`frontend/ios/.gitignore:3`) — vérifié par `test_capacitor_public_gitignored`.
- **7 tests de régression** dans `/app/backend/tests/test_codemagic_pipeline.py` : `CI=true`, ordre strict des étapes, sed sur pbxproj (pas PlistBuddy sur Info.plist), BUILD_NUMBER calculé AVANT yarn build, public/ gitignoré, composant stamp existe, stamp monté sur login + profil. **37/37 tests critiques verts**.

### BLOC D · Migration prod idempotente `POST /api/d1/admin/migrer-prod` (Sep 3, 2026)
- **Problème** : `DuplicateKeyError E11000` sur `enrichissements.id_parcelle_1 dup key: id_parcelle: null` en prod → 3e fix appliqué en preview mais jamais rejoué en prod (weasyprint, html5lib, index cadastre). Symptôme : la génération d'opportunités échoue dès qu'un DPE n'a pas de parcelle cadastrale résolue.
- **Racine** : `a2/indexes.py` créait l'index `id_parcelle` en `unique=True` sec — un seul doc `id_parcelle=null` autorisé. En preview, le fix `partialFilterExpression: {id_parcelle: {$type: "string"}}` avait été appliqué à la main mais **JAMAIS committé** dans le code, donc chaque startup FastAPI en prod le recréait cassé.
- **Fix racine** : `a2/indexes.py` recréé avec `partialFilterExpression={"id_parcelle": {"$type": "string"}}, name="id_parcelle_unique_partial"`. Verrouillé par `test_a2_indexes_source_uses_partial_filter`.
- **Endpoint unique idempotent** : `POST /api/d1/admin/migrer-prod` (auth `X-Admin-Secret`) qui :
  1. **Diagnostique 37 index attendus** sur 15 collections (`enrichissements`, `opportunites`, `zones_couvertes`, `zones_demandees`, `invitations`, `organisations`, `quotas`, `rapprochements`, `estimations`, `conversations`, `signalements`, `device_tokens`, `events`, `zones_scraping`, `jobs_runs`), compare `partialFilterExpression`, `unique`, `sparse`. Détecte : `missing`, `options_mismatch`, `cannot_read_indexes`.
  2. **Applique les fixes** : drop l'ancien index (par nom) si options divergent, recrée avec la spec propre. Chaque étape rapporte `{status, dropped?, created?, error?}`.
  3. **Re-vérifie après** : 2e passe de diagnose pour prouver que tout est OK.
  4. **Seeds** : `config_matching` (singleton A2), `zones_couvertes` (75017/13008/69003/99999-demo — sans écraser `actif` si déjà positionné).
  5. **Migration users A2** : réutilise `_build_patch` du script CLI pour poser `role`/`plan`/`zones_perso`/`plan_depuis`/`a2_migrated_at` sur les comptes legacy. N'écrase JAMAIS un doc déjà migré.
  6. **Diagnostic dépendances** : vérifie `weasyprint==69.0`, `html5lib`, `pydyf`, `pyphen`, `fonttools`, `apscheduler`, `pytz`. Rapporte `loaded`/`version`/`warning`.
- **Idempotent strict** : 2e exécution → `fixes_needed_before: 0`, `applied: 0`, `still_broken_after: 0`. Vérifié par `test_migrer_prod_is_idempotent`.
- **Test réel** : simulation avec 186 docs `id_parcelle=null` → l'endpoint crée l'index unique-partiel SANS erreur, tous les docs null coexistent. La génération d'opportunités reprend.
- **Tests de régression** : `/app/backend/tests/test_d1_migrer_prod.py` (5 tests) : endpoint monté, spec index correcte, source code correct, idempotence stricte, re-diagnostic reconnaît un index correct comme OK. **29/29 tests critiques verts**.

### BLOC D · Partie 1 — Hotfix scheduler (Sep 3, 2026)
- **Fix P0 #1** : `POST /api/d1/admin/generer-opportunites` (async avec `job_id` pour éviter les timeouts proxy) avait été **décapité** — le décorateur `@router.post` et la signature `async def admin_generer_opportunites(request)` avaient disparu, laissant le corps du runner en code mort à l'intérieur de `admin_force_zones_suggestions`. L'endpoint est restauré. Sans lui, seul `POST /api/jobs/generer-opportunites` (a3, synchrone) restait exposé et time-out en proxy sur les zones réelles.
- **Fix P0 #2** : le scheduler a3 (03h00 Paris) ne persistait aucune trace dans `jobs_runs`. Conséquence : `/api/d1/admin/etat-jobs` retournait `last_run: null` en permanence pour `generer_opportunites_quotidien` et `extraire_rues_quotidien`, même après une exécution réussie. Ajout de `_log_run(db, ..., "done"|"failed")` dans `_run_cycle` (a3/scheduler.py) pour chaque phase (extraction + génération).
- **Fix P0 #3** : `AsyncIOScheduler(timezone="Europe/Paris")` avec chaîne pure tombait en UTC (bug silencieux) — les jobs cron programmés à 06h00 tournaient à 08h00 Paris en été. Fix : passage à `pytz.timezone("Europe/Paris")` + `CronTrigger(..., timezone=TZ)` sur chaque trigger. Vérifié : `next_run: 2026-09-04T06:00:00+02:00` (CEST correct).
- **Ajouts** : `extraire_rues_quotidien` est maintenant exposé dans `/api/d1/admin/etat-jobs` ET déclenchable via `/api/d1/admin/run-job` (wrapper avec log jobs_runs).
- **Test de régression** : nouveau fichier `/app/backend/tests/test_d1_scheduler_endpoints.py` (6 assertions) qui verrouille les 3 fixes et empêche toute régression future. **24/24 tests critiques verts** (D1 + migration + Apple compliance + i18n + scheduler).

### BLOC D · Partie 1 — Rôles, invitations, écrans directeur (Sep 2, 2026)
- **10 endpoints backend** sous `backend/b1/` : `/api/b1/ville/{cp}`, 4 endpoints `/api/onboarding/*`, 5 endpoints `/api/me/*` (dont `DELETE /api/me` Apple compliant avec variantes indep/conseiller/directeur).
- **Frontend `/onboarding-b1`** — 7 écrans séquentiels bloquants (Identité → Statut → Zones → Traitement → Résultat → Plan → Bienvenue) avec progress bar, animations slide.
- **Frontend `/app-b1/*`** — shell 4 onglets (Opportunités fonctionnelle + 3 placeholders Estimation/Rapport/Assistant), bottom nav pilule à bord rose, tour guidé 6 bulles (bulle 1 avec animation main swipe + définition opportunité).
- **Frontend `/app-b1/profil/*`** — profil avec card rose « Votre plan actuel Pro/Découverte », menu 7 items (perso, pro, zones, paiement, revoir tour, support, suppression), infos_pro 17 champs (juridique + Carte T + CCI + RCP + garantie + honoraires + grille 7 coefficients) avec barre de complétude, zones avec règle 1 modif Découverte / illimité Pro, suppression 2-tap variante indep/conseiller/directeur.
- **Zone de démonstration Apple Review `99999`** — toujours couverte, 4 opportunités fictives marquées `demo:true`, résolveur `Zone de démonstration`. Le CP réel à communiquer dans les notes Apple = `13008`.
- **Conformité Apple** : pas de lien de paiement externe, pas de tarif Agence, `Restaurer mes achats` + CGU + Politique de confidentialité sur le paywall, suppression in-app 2-tap avec mention iOS abonnement, assistant passé au vouvoiement.
- **i18n complète FR/EN/IT/DE** (`b1i18n.js`) — 110+ clés, zéro texte hardcodé.
- **Design tokens** (`b1.css` scoped `.b1-root`) — accent `#EC8690`, fond `#F0EEF8`, cartes 24px, boutons pill, ombres douces, animations slide/spring.
- Tests : **7 tests pytest B1 verts**, **97 tests Bloc A verts**, aucune régression.


### BLOC D · Partie 1 — Rôles, invitations, écrans directeur (Sep 2, 2026)
- **Nouveau module `/app/backend/d1/`** : `routes.py` (10 endpoints), `invitations.py` (Resend + attach au signup), `distribution.py` (round-robin équilibré), `schemas.py`.
- **3 rôles** : `independant` (défaut), `directeur`, `conseiller`. À l'onboarding iOS, le `role` est TOUJOURS `independant` — `statut_declare` sert uniquement à la segmentation. L'élévation en `directeur` se fait exclusivement via back-office (BLOC D · Partie 2).
- **Endpoints D1 (iOS)** : `GET/PATCH /api/d1/organisations/me`, `POST/GET/DELETE /api/d1/invitations[/*]`, `GET /api/d1/invitations/check?email=…` (public), `GET /api/d1/equipe?periode=mois|semaine`, `DELETE /api/d1/equipe/{user_id}`, `POST /api/d1/opportunites/{id}/attribuer`, `POST /api/d1/opportunites/attribuer-lot`, `POST /api/d1/opportunites/auto-reste`, `POST /api/d1/opportunites/{id}/retirer`. **Aucun POST /api/d1/organisations n'est exposé** (conformité Apple).
- **Flux invitation** : email = seule clé. Le directeur invite via email ; à l'inscription (register OU verify-email-code), le hook `attach_conseiller_if_invited` pose `role=conseiller`, `organisation_id`, `plan=agence`, `siege_statut=actif`, marque l'invitation `acceptee` et incrémente `sieges_utilises`. Aucun code d'invitation à saisir, aucun deep-link.
- **Retrait d'un conseiller (6 règles atomiques)** : siège libéré (plancher 0), opps `proposee` → retour au pool (unset `assigne_a`), opps ≥ `a_demarcher` → conservées, user → `independant`/`decouverte`/`zones_deja_modifiees=false`, `siege_statut=desactive`, compte jamais supprimé.
- **Refus de retrait d'attribution** si `statut ∈ {a_demarcher, demarchee, mandat_signe, abandon}` (HTTP 409 `retrait_refuse`).
- **Frontend `/app-b1/directeur/{repartition,equipe,agence}`** — 3 écrans dans `B1Directeur.jsx` : bandeau mode (auto/mixte), tableau entonnoir (Attribuées · Ignorées · À démarcher · Démarchées · Mandats + taux de traitement + alerte 48h avec pluriel), invitations (modal + relance/annuler), infos agence + zones + sièges + mode répartition + « Je prospecte aussi ». Aucune mention de montant, aucun lien de paiement, aucun mot Stripe. Section « Plan et facturation » n'affiche QUE `Prochaine facturation le {date}` (masquée si vide).
- **Email « Invitation conseiller »** (Resend, 4 langues) : version Option A — pas d'URL, texte redirige vers l'app pour se connecter avec l'email invité.
- **i18n D1 (`b1i18nD1.js`)** — 90+ clés en parité stricte FR/EN/IT/DE (dir.*, role.*, login.invit.*, conseil.*, dir.acces_refuse.*).
- **Test Apple compliance renforcé** : 2 tests (interdit Stripe/prix + interdit `POST /api/d1/organisations` et libellés « créer une agence » en 4 langues).
- **Tests** : 75/75 pytest verts (test_d1.py 8, test_d1_http.py 45 HTTP réels, test_d1_regression_65.py 4, test_d1_frontend_static.py 6, test_apple_compliance.py 2, test_i18n_coverage.py 3, test_b1_onboarding.py 7). Auto-rattachement conseiller vérifié end-to-end sur `POST /api/auth/register` ET `POST /api/v2/auth/verify-email-code` (les 2 chemins de signup live).

---



---

## 🔭 Feature à construire — Cartes « Biens en vente à surveiller »

**Statut** : décidée, non implémentée. Copie FR à figer avant toute ligne de code.

### Constat qui la motive
Certaines zones produisent peu d'opportunités de mandat : le 75017 en donne 4 sur 1124 DPE, quand il en classe 478 en « déjà en vente ». Ce stock a une valeur : les portails masquent l'adresse exacte, KOLO l'a.

Un bien simplement mis en vente n'intéresse personne — son propriétaire vient de signer ailleurs. Ce qui intéresse un conseiller, c'est **un bien qui ne se vend pas** : le mandat va se libérer et le vendeur est réceptif.

### Sélection (données)
Parmi les DPE classés `deja_en_vente` dans `rapprochements`, retenir ceux dont l'annonce rapprochée présente **au moins un** signal de difficulté :
- `days_on_market` supérieur à **90 jours**, OU
- `price_drop_count` supérieur ou égal à **1**

**Score de tri décroissant** : `days_on_market / 30 + price_drop_count * 2`.

Exclure les biens déjà signalés ou déjà vus par cet utilisateur (mêmes règles que pour les opportunités).

### Affichage — type de carte distinct
Jamais mélangé aux opportunités de mandat. Chaque carte affiche :
- Bandeau **ambre** en haut : « Bien en vente à surveiller »
- Adresse exacte du DPE + complément ADEME
- **Deux faits qui justifient la carte**, chiffres bruts, aucune interprétation :
  - « En ligne depuis 143 jours »
  - « Prix baissé 2 fois, −8 % »
- Prix, prix au m², surface, classe DPE
- Lien vers l'annonce
- **Aucune formulation incitative.** Pas de « le vendeur est prêt à changer d'agence », pas de « mandat à récupérer ». Les faits, le conseiller juge. Un bien sous mandat exclusif ne se démarche pas sans risque juridique — ce n'est pas à l'app d'y pousser.

### Règles de fonctionnement
- **Jamais comptées dans `quota_du_jour`** ni dans la barre de progression. Elles s'ajoutent **après** la dernière opportunité de mandat, dans une seconde pile introduite par un titre séparé.
- **Affichées seulement si `quota_du_jour < 3`** — seuil dans `config_matching`.
- **Maximum 5 par jour** — également dans `config_matching`.
- **Réservées au plan Pro.** Un compte Découverte ne les voit jamais.
- Swipe identique : gauche pour ignorer, droite pour retrouver le bien dans une section dédiée de « Mes opportunités de mandats », clairement séparée des vraies opportunités.
- Statut propre : `veille_a_surveiller`, `veille_ignoree`, `veille_demarchee`. **N'entrent dans aucun des 3 compteurs de la page Statistiques.**

### Ce que ça ne doit pas devenir
Ces cartes ne remplacent jamais une opportunité de mandat et ne servent pas à masquer une zone pauvre. Si une zone ne produit que ça pendant plusieurs jours, le **message de zone calme doit quand même apparaître**, au-dessus de la pile de veille.

### Distinction visuelle — non négociable
Les deux types de cartes doivent être distinguables **au premier coup d'œil, sans lire un mot**.
- Le rose `#EC8690` est **réservé aux opportunités de mandat**. À bannir de toute carte de veille.
- Le bandeau **ambre** doit être franchement différent, pas une nuance voisine du rose (choisir `#F59E0B` ou proche, à valider avec la maquette).
- **Visuel** : opportunités = illustration de bien sur fond rose. Cartes de veille = **photo de l'annonce quand elle existe**, ou fond **neutre gris clair** à défaut.
- Un conseiller qui feuillette rapidement doit savoir sans réfléchir s'il regarde **une porte à démarcher** ou **un concurrent à surveiller**.

### À valider avant implémentation
- Copie FR complète (voir message dédié) → validation utilisateur.
- Traductions EN / IT / DE une fois FR figée.
- Ambre exact (`#F59E0B` ou autre) et maquette de la carte de veille.

---


---

## 🔮 Session de bascule V2 → B1 (à consigner, aucune implémentation immédiate)

**Contexte** — B1 vit aujourd'hui en parallèle de V2, sans couplage. Le jour de la bascule des 186 comptes existants sur la nouvelle app, une session dédiée sera lancée. Les 6 décisions ci-dessous sont **figées** et doivent être exécutées sans modification.

### Le problème exact
La migration A2 a mis `onboarding_infos_ok = true` et `tour_guide_vu = true` sur les 186 comptes existants. Le jour de la bascule, ils sauteraient donc l'onboarding et atterriraient directement sur l'onglet Opportunités — **sans `zones_perso` renseigné**, donc sans aucune carte. Écran vide, aucune explication, désinstallation.

### Décision 1 — Un écran de reprise, une seule fois
Ajouter un champ `zones_confirmees` (booléen, `false` par défaut sur les comptes migrés). À la première ouverture de la nouvelle app, si `zones_confirmees` est `false`, afficher un écran unique de reprise, **avant tout le reste** :

- **Titre** : « KOLO a changé. Confirmez vos zones de prospection. »
- **Sous-titre** : « Nous avons repris celles que vous travailliez déjà. »
- Un ou deux codes postaux **pré-remplis**, jamais un champ vide. L'utilisateur confirme d'un tap ou corrige.
- Vérification de couverture et enregistrement dans `zones_demandees` fonctionnent comme à l'écran 5 de l'onboarding.
- À la validation : `zones_confirmees = true`, et la première fournée d'opportunités est calculée pendant l'écran de traitement, exactement comme pour un nouveau compte.

### Décision 2 — Comment on pré-remplit ces zones
Par ordre de priorité, **la première source qui donne un résultat gagne** :
1. Les codes postaux les plus fréquents dans les **dossiers et biens V2** de cet utilisateur.
2. À défaut, le code postal de ses **contacts V2**.
3. À défaut, le code postal de son **profil personnel**.
4. À défaut seulement, champ vide avec le clavier ouvert.

**Journaliser la source retenue** pour chaque utilisateur — ça dira si la déduction fonctionne avant de l'exposer à tout le monde.

### Décision 3 — Le tour guidé se rejoue
Remettre `tour_guide_vu = false` sur les comptes migrés. L'app change de structure, quatre nouveaux onglets apparaissent : ces utilisateurs découvrent **une nouvelle application, pas une mise à jour cosmétique**. Le tour reste passable en un tap.

### Décision 4 — Les 18 comptes Pro restent Pro, sans rien payer
Ils ne voient **aucun paywall** et ne déclenchent **aucun appel à StoreKit**.

Ajouter un champ `plan_source` valant `apple_iap`, `stripe` ou `manuel` : certains comptes ont été passés Pro à la main et ne doivent pas être coupés par le webhook Apple, qui ne recevra jamais de notification les concernant.

Les **168 comptes Découverte** restent en Découverte. Ils ne voient le paywall que lorsqu'ils atteignent une limite, jamais de façon forcée.

### Décision 5 — Les données V2 ne sont pas migrées, elles restent consultables
Dossiers, contacts et agenda n'ont aucun équivalent dans les quatre onglets de la refonte. **Ne pas les migrer, ne pas les supprimer.**

Ajouter dans le profil une entrée « **Mes anciennes données** » qui ouvre l'app V2 en **lecture seule**. Elle reste accessible **six mois** après la bascule, puis on avise. Un bandeau non intrusif en haut : « Ancienne version de KOLO, en lecture seule. »

C'est la solution la moins chère et la moins risquée : aucune perte, aucun script de migration à écrire, aucun utilisateur en colère.

### Décision 6 — Bascule progressive, jamais sèche
Ajouter un champ `app_version` sur `users`, valant `v2` ou `b1`, avec `v2` par défaut. La réponse d'authentification le renvoie, et le front aiguille dessus.

Un écran du back-office permet de basculer **un utilisateur, ou un lot d'utilisateurs**.

**Ordre prévu** : d'abord Elliot, puis 5 utilisateurs actifs choisis à la main, puis les Pro, puis le reste. Retour arrière possible à tout moment en repassant le champ à `v2`.

---

**⚠️ Ne rien construire de tout ça maintenant.** Décisions consignées, à exécuter en session dédiée « Bascule V2 → B1 » à la fin du bloc B.

---



### A3 Point-in-polygon Lyon + Marseille — fin bloc A (Sep 1, 2026)
- **GeoJSON quartiers Lyon** (data.grandlyon.com, 201 polygones Grand Lyon) et **Marseille** (data.gouv.fr, 111 polygones avec code d'arrondissement DEPCO) téléchargés et intégrés.
- `_load_features` : loader unifié 3 sources ; supporte MultiPolygon. Slug Paris = legacy (`ternes`), Lyon/Marseille = préfixés (`lyon-voltaire-part-dieu`, `marseille-perier`). 460 features au total.
- `_normalize_label` : strip aussi les préfixes « Lyon 3e Arrondissement - », « Marseille 8e Arrondissement - », « Lyon 69003 », « Marseille 13008 ».
- `LABEL_TO_QUARTIER` enrichi : Prado, Périer, Bonneveine, Sainte-Anne, Le Rouet, Saint-Giniez, Montredon, La Pointe Rouge, Les Goudes, Vieille-Chapelle (Marseille) ; Voltaire-Part-Dieu, Sans-Souci-Dauphiné, Villette-Paul-Bert, Grange Blanche, Ferrandière, Saxe-Gambetta, Montchat, Monplaisir, Bachut, Laennec-Mermoz, Guillotière (Lyon).
- **Court-circuit `quartier_non_limitrophe` activé partout** : 36 789 Paris · 8 288 Marseille · 13 722 Lyon (vs 0 avant fix).
- **Delta opportunités** :
  | Zone | Avant | Après | Écart |
  |------|:---:|:---:|:---:|
  | 75017 | 4 | 4 | +0 |
  | 13008 | 47 | 65 | **+18** |
  | 69003 | 28 | 35 | **+7** |
- **Marseille 8e** — 31 opportunités à score parfait (1.00) sur type maison isolée dans un secteur pavillonnaire (Roy d'Espagne, Marseilleveyre, Goudes) : le multiplicateur géo et le prix médian ne parlent pas car maisons peu comparables sur DVF. Bloc `type_immeuble` OK, mais les correspondances DPE↔annonce parfaites viennent de rues nommées explicitement dans l'annonce. À auditer manuellement.
- Libellés inconnus persistants (à mapper au prochain lot) : « Madrague de Montredon », « Roy d'Espagne », « Vielle Chapelle » (typo portail Marseille) ; « Garibaldi », « Lacassagne », « Préfecture », « Moncey » (Lyon 3e).
- Tests : 65 unitaires A3 + 6 vérité terrain (BLOQUANTS 2/2) = OK.

### A3 Webhook Apify opérationnel + comparaison 3 zones (Sep 1, 2026)
- **Bug critique corrigé** : la valeur `APIFY_WEBHOOK_SECRET` en `.env` ne correspondait pas à celle configurée côté Apify (handoff antérieur contenait une valeur obsolète). Alignée. Les 5 dispatches natifs Apify sont désormais acceptés (rejeu OK via le webhook lui-même).
- **Webhook natif Apify validé** : URL `/api/webhooks/apify?mode=complet`, header `X-Apify-Secret`. Payload natif (`resource.id`+`resource.status`) supporté ; `ABORTED` accepté (upsert sans jamais désactiver).
- **Ingestion via webhook** : run `viU72M8KCbuS9MXm0` (SUCCEEDED, 1176 items 13008/69003) → 1146 inserts + 29 updates + 89 désactivations (mode complet). Run `y3eHCY8A35snu2i4W` (ABORTED, dataset `bq7kaEpcfhDUo5xTi`, 1280 items) → 139 inserts + 1140 updates, 0 désactivation.
- **Backfill district hors Paris** : `district_resolver` généralisé (regex URL SeLoger multi-villes + regex arrondissement URL/titre + libellés Lyon/Marseille étendus). Taux post-backfill : 13008 = 100 %, 69003 = 93.4 %, 75017 = 92.1 %.
- **Comparaison zones (seuil 0.70)** :
  | Zone | DPE | Décisions | Opportunités | Score moy. | active_listings | Couverture |
  |------|:---:|:---:|:---:|:---:|:---:|:---:|
  | 75017 | 1 124 | déjà 476 · filtre 644 | **4** | 0.749 | 1 097 | 0.844 |
  | 13008 | 477 | déjà 168 · filtre 262 | **47** | 0.830 | 663 | 1.00 |
  | 69003 | 1 020 | déjà 418 · filtre 574 | **28** | 0.821 | 588 | 1.00 |
- **Limite explicite hors Paris** : le point-in-polygon des quartiers admin ne couvre QUE Paris. Les DPE de Lyon/Marseille ont `quartier_dpe = None`, donc adjacence = 0.5 (« absent »), aucun court-circuit `quartier_non_limitrophe`. Seul le signal prix opère → 3 983 court-circuits `prix_m2_incoherent` sur 69003, 3 463 sur 13008 (efficace).

### A3 Webhook Apify + LABEL Lyon/Marseille (Sep 1, 2026)
- **Webhook Apify** `POST /api/webhooks/apify` :
  - Auth : header `X-Apify-Secret` OU `X-Admin-Secret` avec `APIFY_WEBHOOK_SECRET`.
  - Supporte 3 formats : (a) natif Apify avec `resource.id`+`resource.status` ; (b) custom `{mode, run_ids}` ; (c) import dataset `{dataset_id}`.
  - `mode` (`complet` | `incremental`) : query string > header `X-Apify-Mode` > body. Défaut `incremental`.
  - Runs `ABORTED` désormais acceptés (upsert des items collectés), sans jamais déclencher de désactivation.
- **Import dataset manuel** : `ingest_dataset(dataset_id)` — récupère les items du dataset, retrouve le run parent si possible, ingère avec `clean=False` (jamais de désactivation).
- **`LABEL_TO_QUARTIER` étendu** : ajout des arrondissements Lyon 1-9 + Marseille 1-16 (+ quelques quartiers courants : Croix-Rousse, Vaise, Prado, Perier, Bagatelle, Brotteaux, etc.). Round-trip `slug ↔ libellé` validé.
- **`district_source` en base** : après application manuelle de la migration Supabase, backfill relancé sur 75017 → 1010/1097 listings ont `district_source` renseigné (texte 586 · coordonnees 248 · url 176 · null 87). Écart cible/atteint = 100 % pour les portails dotés d'un signal exploitable ; century21 (11) reste irrécupérable.

### A3 district resolver — Ingestion enrichie (Sep 1, 2026)
Les 4 portails qui ne remplissaient jamais `district` (seloger, pap, safti, century21 — 309 annonces sur 75017) sont désormais résolus à l'ingestion.
- Nouveau module `a3/district_resolver.py` avec 3 stratégies par ordre de fiabilité : `url` (slug SeLoger `/paris-17eme-75/<slug>/<id>.htm`), `texte` (regex sur titre/description contre `LABEL_TO_QUARTIER`), `coordonnees` (point-in-polygon sur lat/lng). Retourne `(district_libelle, source)`.
- `LABEL_TO_QUARTIER` étendu : ajout de `clichy batignolles` (ZAC dans le quartier Batignolles).
- Migration `A3_listings_district_source.sql` : nouvelle colonne `district_source` (à appliquer manuellement côté Supabase — accès psql direct non dispo).
- Ingestion : `normalization.py` appelle le resolver quand le portail ne fournit rien. `scripts/ingest_apify.py::_upsert_batch` robuste (strip `district_source` + retry si colonne pas encore créée).
- Backfill : `scripts/backfill_district.py --cp 75017` — 222/309 listings résolus (176 via URL SeLoger, 32 via texte PAP, 14 via coordonnées Safti). Les 87 non résolus : 44 seloger (URL sans slug), 32 pap (description sans quartier), 11 century21 (tout vide).
- **Taux `district` 75017 : 71.8 % → 92.1 %** (+20 pts).
- Run 75017 après backfill : 1124 DPE · 477 `deja_en_vente` (-22 vs run précédent, mieux discriminé) · **4 opportunités** (score confiance moyen 0.7486). Court-circuits : 36 789 quartier (+29 %), 14 951 rue, 6 145 prix.
- Jeu de test vérité terrain : **2/2 BLOQUANTS ✅** (Renaudes → deja_en_vente, Jonquière → opportunite). Sur les indicatifs, **Gounod bascule maintenant en deja_en_vente ✅** ; Wagram et Pierre Demours restent en opportunité (faux positifs assumés).

### A3 s_geo v2 — Multiplicateur géo + vérité terrain (Sep 1, 2026)
Le sous-score `geographie` en terme pondéré (v1) accordait une prime quasi systématique (toutes les annonces d'un CP sont dans les 4 quartiers admin) et faisait passer des faux positifs. Refonte :
- `geographie` devient un **multiplicateur EXTERNE** appliqué à la somme pondérée. Ne bonifie jamais (max 1.0), pénalise (0.7 sur écart prix 25-40 %) ou court-circuite (0.0 sur quartier non-limitrophe ou écart prix > 40 %). Configurable via `config_matching.multiplicateur_geo` (`mult_ecart_prix_25_40`, `seuil_prix_penalite`, `seuil_prix_court_circuit`).
- Poids restaurés : `rue 0.35 · surface 0.30 · classe 0.20 · type 0.10 · étage 0.05` (somme = 1.0).
- `seuil_correspondance` abaissé à **0.70** (contre 0.75).
- Bug pagination corrigé : `_fetch_zone_district_stats` pagine strictement (1000/page) au lieu du `limit=5000` non honoré → `active_listings` reflète le vrai count (1097 vs 1000 avant).
- Robustesse zone : `_get_zone_scraping_state` fallback Supabase pour n'importe quel CP (count exact + max(scraped_at, last_seen_at)) → job exécutable sans doc préalable dans `zones_scraping`.
- **Nouveau fichier arbitre** `tests/test_a3_verite_terrain.py` : 6 cas audités manuellement, 2 BLOQUANTS (Renaudes VRAI · Jonquière FAUX) + 4 INDICATIFS (log-only, ne cassent jamais le test). C'est le juge de tous les réglages futurs.
- Run 75017 (seuil 0.70) : 1124 DPE · 499 `deja_en_vente` · 4 opportunités (score confiance moyen 0.7486) · 621 filtrés. Court-circuits : 28 481 quartier · 15 609 rue · 7 254 prix. `active_listings` = 1 097 (avec pagination correcte).
- Run 13008 : skip légitime (dernier scrape 58 jours, seuil dégradé 7 jours).
- Run 69003 : impossible, 0 annonce en base.
- District fill rate 75017 par source : bienici 100 % · leboncoin 100 % · **seloger 0 %** · **pap 0 %** · **safti 0 %** · **century21 0 %**. Total 71,8 % — 309 annonces sans district viennent exclusivement de ces 4 portails.
- Tests A1/A2/A3 : **175 / 175 pass**.

### A3 s_geo — Sous-score géographique + circuit-breaker (Sep 1, 2026)
- Ajout du sous-score `s_geo` combinant adjacence de quartier admin Paris (GeoJSON open data, 80 quartiers, point-in-polygon + adjacence auto par sommets communs) et cohérence prix m² local (mutations_propres, 500 m, 24 mois, même type).
- Règles :
  - Adjacence : même quartier = 1.0 · limitrophes = 0.6 · non-limitrophes = 0.0 · absent = 0.5
  - Prix : écart ≤ 25 % neutre · 25-40 % plafonne à 0.5 · > 40 % force à 0.0
- **Circuit-breaker** : `s_geo == 0` → annonce écartée sans calcul de score, motif journalisé dans `rapprochements` (`quartier_non_limitrophe`, `prix_m2_incoherent`, `rue_differente`).
- Nouveaux poids par défaut : `rue=0.25, geographie=0.20, surface=0.25, classe_energie=0.15, type_bien=0.10, etage=0.05`.
- Correction critique dans `a3/sources/ademe.py` : les DPE utilisaient `coordonnee_cartographique_*_ban` (Lambert93) comme lat/lng WGS84 → tous les DPE tombaient hors polygone. Bascule sur `_geopoint` (string "lat,lng" WGS84).
- Table `LABEL_TO_QUARTIER` étendue + normalisation qui absorbe les préfixes portails (« Paris 17e Arrondissement - », « Paris 75017 »).
- Fix index `enrichissements.id_parcelle_1` (unique sans sparse) → recréé en `partialFilterExpression { $type: string }` pour supporter les DPE sans parcelle.
- Résultats run 75017 (1124 DPE) : 3 opportunités (score confiance moyen 0.844), 338 déjà en vente, 783 filtrés. Court-circuits : 28 481 `quartier_non_limitrophe`, 15 609 `rue_differente`, 7 254 `prix_m2_incoherent`. Un seul libellé district non mappé (« Grandes Carrières - Clichy »).
- Tests A1/A2/A3 : 168/168 pass.

### Marketing Site Mobile Fixes & Features Rewrite (Feb 24, 2026)
- **Hero mobile aéré** : marge lead→CTA passée à 44px (au lieu de 32), respiration correcte texte→bouton
- **Mockups mobile rapprochés** : `.mkt-mockup-stage` isolé en `@media (max-width: 767px)` (height 360px, phones 160px, glow 380px, margin-top 8px). Le bug d'override par la règle tablet `@media (max-width: 1023px)` a été corrigé en la scoping à `min-width: 768px and max-width: 1023px`
- **Section fonctionnalités refondue** — copy ultra-clair orienté agent immo :
  - "3 leviers. Zéro perte de temps." (au lieu de "Tout ce dont un agent a besoin…")
  - 01 · **Trouvez des mandats** (multi-portails + DPE émis)
  - 02 · **Signez plus de mandats** (estimation DVF + argumentaire + relances)
  - 03 · **Restez rentable** (notes vocales + agenda + dossiers)
- Testé sur mobile 390×844 et desktop 1440×900 via screenshot tool

### Marketing Site www.trykolo.io — REFONTE COMPLÈTE v3 (Feb 2026) 🔥 LATEST
Ancienne homepage "aurora animated" totalement abandonnée (jugée "template Claude AI-slop"). Refonte complète style **Qonto premium dark**.

**Nouveau design system :**
- **Fonts** : Cabinet Grotesk 800/900 (titres) + Satoshi 400/700 (body) via Fontshare CDN
- **Palette** : obsidian `#050505` base + surfaces `#0A0A0A/#121212/#1A1A1A` + accent blanc pur `#FFFFFF` sur ink `#050505`
- **Spacing** : très aéré (py-24 → py-32 entre sections)
- **Motion** : Framer Motion partout, easing `[0.22, 1, 0.36, 1]`, staggered reveals
- **Ambient** : radial gradients blancs très subtils (0.045 opacity) + noise SVG en `mix-blend-mode: overlay`

**Nouvelle homepage (`/app/frontend/src/pages/marketing/HomePage.js`) :**
1. **Hero** : eyebrow "Disponible sur l'App Store" (dot vert) + H1 massif "Le co-pilote intelligent qui booste le chiffre d'affaires des agents immo." (gradient argenté sur l'em) + lead + CTA pill blanche "Télécharge l'app" + **mockup 3D iOS** (5 iPhones réels de l'app, cascade isométrique, chacun avec son propre `motion.div` float staggered → effet vidéo qui bouge tout seul, comme demandé style Qonto)
2. **Trust marquee** : "Des agents de ces réseaux nous font déjà confiance" — Century 21, Orpi, Laforêt, IAD France, Safti, Guy Hoquet, ERA, Stéphane Plaza, L'Adresse, Nestenn, Human Immobilier, Sextant (marquee CSS 40s loop, mask-image gradient sur les bords)
3. **3 features bento** avec visuel dédié :
   - Prospection (portails cards animées Leboncoin/SeLoger/Bien'ici/PAP)
   - Assistant intelligent (chat bubbles utilisateur ↔ KOLO avec estimation DVF)
   - Organisation (agenda-day view avec dots colorés)
4. **Pricing** : 2 cards (Starter 9,99€ / Pro 24,99€ featured avec badge "RECOMMANDÉ" et boutons "Télécharge l'app")
5. **Founder** : photo Elliot (transparent PNG) sur gradient + citation courte sobre "Ex-agent immo dans deux grands réseaux, puis parcours tech..."
6. **Final CTA** : "Prêt à prospecter comme jamais ?" + CTA pill large

**Header** : sticky glass (`backdrop-filter: blur(20px)` sur rgba(5,5,5,0.72)) + nouveau logo dark KOLO (`META LOGO WEB APP.png` de l'app iOS) + language switcher discret + CTA pill blanche persistante

**Footer** : minimal, 4 colonnes, tagline "Fait par des agents immo, pour des agents immo."

**AboutPage** simplifiée avec la citation Elliot version longue + 3 valeurs (Simple, Précis, Juste). **HowKoloPage** : 4 étapes "01 → 04" avec chiffres géants en gradient argenté. **ResourcesPage** : mini-grid de 6 articles thématiques.

**Meta / SEO refaits (`/app/frontend/public/index.html`) :**
- Title : "KOLO — Le co-pilote intelligent des agents immobiliers"
- Description alignée sur le nouveau positionnement (retirées les mentions "CRM", "relances automatiques", "essai 14 jours", "promoteurs/foncières/développeurs" → recentré sur agents immo iPhone)
- `theme-color` = `#050505`
- Open Graph image = nouveau logo dark `META LOGO WEB APP.png`
- Twitter card idem
- Structured data JSON-LD : applicationSubCategory "Real Estate", image mise à jour

**Fichiers touchés :**
- `/app/frontend/src/pages/marketing/marketing.css` (rewrite complet)
- `/app/frontend/src/pages/marketing/components/MarketingLayout.js` (rewrite)
- `/app/frontend/src/pages/marketing/HomePage.js` (rewrite)
- `/app/frontend/src/pages/marketing/AboutPage.js` (rewrite)
- `/app/frontend/src/pages/marketing/HowKoloPage.js` (rewrite)
- `/app/frontend/src/pages/marketing/ResourcesPage.js` (rewrite)
- `/app/frontend/public/index.html` (meta tags v3)
- `/app/design_guidelines.json` (blueprint conservé pour référence)

**Défi technique résolu** : le CSS global de l'app iOS (`themes.css`, `App.css`) applique `background-color: var(--bg)` et gradient `#004AAD → #CB6CE6` à `h1`, `.btn-primary`, etc. avec spécificité 0-0-1. Pour éviter le fond gris/violet indésirable sur les pages marketing sans dupliquer tout le CSS, on force :
- `html, body` via `document.body.style.setProperty('background','#050505','important')` dans `MarketingLayout` (au montage uniquement, restauré au unmount → pas de fuite sur les routes app-v2)
- `.mkt-root` et titres avec sélecteurs très spécifiques + `!important`
- `.mkt-cta-pill` avec `a.mkt-cta-pill, button.mkt-cta-pill` (spécificité 0-1-1) + `!important`


### Sprint Apify → Supabase Cron Scraper (Feb 2026) 🔥 LATEST
Le scraper autonome est en place. Fini les 1-3 min d'attente Apify live à chaque recherche : le mobile lit maintenant instantanément depuis Supabase déjà pré-rempli.

**Architecture** :
- Script standalone `/app/backend/scripts/scrape_listings_cron.py`
- Sources Apify : `leboncoin + pap + seloger + bienici + logic-immo` (max coverage)
- Dedupe automatique par URL (in-batch, avant upsert)
- Batches de 20 codes postaux max par run Apify (contrainte mémoire actor)
- 30 annonces max par code postal
- Poll toutes les 5s, timeout 4 min par batch
- Upsert Supabase avec conflit sur `(portal, external_id)` → idempotent

**Cibles** (union dédupliquée) :
- Codes postaux cherchés par les users dans les 7 derniers jours (`v2_prospecting_logs`)
- Liste statique curated top-57 villes FR (Paris arrondissements + Marseille + Lyon + Toulouse + Nice + Nantes + Montpellier + Strasbourg + Bordeaux + Lille + Rennes + Reims + Saint-Étienne + Le Havre + Toulon + Grenoble + Dijon + Angers + Villeurbanne + Le Mans + Aix + Brest + Nîmes + Limoges + Clermont + Tours + Amiens + Metz + Perpignan + Boulogne-Billancourt)

**Scheduler** :
- Hook dans `notification_scheduler.py` (déjà lancé par server startup, pas de nouveau process)
- Auto-throttle à 6h via marker `v2_scraper_last_run` en Mongo
- Chaque run logué dans `v2_scraper_runs` (batches, upserted, unique, timing)

**API admin** (super-admin only) :
- `POST /api/v2/admin/scraper/run` — trigger manuel (accepte `{zips:['75001','75002']}` pour override)
- `GET /api/v2/admin/scraper/status` — dernier run + 10 derniers runs

**Fix connexe : extraction thumbnails**
- L'actor `dltik/pige-immo-fr-scraper` retourne les miniatures sous `main_photo_url` (pas `photos[0]`).
- `_upsert_supabase_listings` mis à jour pour scanner `main_photo_url` en 1er, puis `thumbnail_url`, `photos[0]`, `photo`, `image`.

**Validation end-to-end** :
- Test réel : `curl POST /api/v2/admin/scraper/run {zips:['75003']}` → 40 annonces réelles LBC/PAP/SeLoger/BienIci upsertées en 24s
- `GET /api/v2/prospecting/listings?sector=75003` renvoie instantanément 40 items avec 0 URL `kolo_seed`, 100% http(s), 50% avec thumbnail (le reste sans photo côté portail source)
- 9/9 tests pytest passent (`test_scraper_cron.py` + `test_iteration_61.py`)

**Runnable en CLI** :
```bash
# One-shot scrape
cd /app/backend && python -m scripts.scrape_listings_cron --once
# Avec ZIP override
cd /app/backend && python -m scripts.scrape_listings_cron --once --zips 75001,75002,69001
# Via le scheduler (bypass le throttle 6h)
cd /app/backend && python notification_scheduler.py --scrape
```

**Fichiers créés/modifiés** :
- `/app/backend/scripts/scrape_listings_cron.py` (nouveau)
- `/app/backend/notification_scheduler.py` (hook + CLI `--scrape`)
- `/app/backend/v2_router.py` (`_upsert_supabase_listings` thumbnail fix + 2 admin endpoints)
- `/app/backend/tests/test_scraper_cron.py` (nouveau, 5 tests unitaires)


### Sprint iOS Perf + Promo + 404 (Feb 2026) 🔥 LATEST
Trois fixes P0/P1 appliqués sur cette itération :

**1. Menu lag iOS (P0) — RÉSOLU**
- Cause racine : `.v2-app::before` = radial mesh gradient avec `filter: blur(42px) saturate(135%)` + animation qui animait `filter` + `hue-rotate` + `will-change: transform, filter`. Sur Capacitor iOS WebView, chaque remount de `V2Layout` (à chaque changement d'onglet) re-payait le composite complet à 60fps → coupures visibles.
- Fix (`/app/frontend/src/styles/v2.css`) :
  - Keyframes `meshDrift` : suppression totale de `filter` + `hue-rotate` de l'animation (transform-only, GPU-cheap).
  - Durée passée de 26s → 60s (moins de recalcul par navigation).
  - `will-change: transform` (au lieu de `transform, filter`).
  - Bloc `.capacitor-native .v2-app::before { animation: none; will-change: auto; }` → mesh figé sur natif.
  - `.capacitor-native .v2-app::after { display: none; }` → noise SVG désactivée sur natif.
  - `.capacitor-native .v2-page { animation-duration: 180ms; contain: layout paint; }` → transitions plus courtes.
  - Média `prefers-reduced-motion` respecté partout.
  - Même traitement appliqué à `.v2-onb-shell::before` et `.v2-ref-landing::before`.

**2. Codes promo App Store (P0) — RÉSOLU**
- Plugin Swift `KoloIAPPlugin.swift` (`/app/frontend/ios/App/App/` + `/app/ios_native/`) upgradé :
  - iOS 16+ : `AppStore.presentOfferCodeRedeemSheet(in: windowScene)` (StoreKit 2, non-deprecated).
  - iOS 14–15 : fallback `SKPaymentQueue.default().presentCodeRedemptionSheet()`.
- JS wrapper (`V2SubscriptionPage.js` bouton `sub-appstore-code-btn`) :
  - Si plugin dispo → appel natif.
  - Si plugin absent OU rejet natif → fallback automatique vers `https://apps.apple.com/redeem?ctx=offercodes&id=6761818371` via `@capacitor/browser` (Universal Link qui ouvre l'App Store natif sur iPhone).
  - Garantit que l'utilisateur peut TOUJOURS entrer un code promo, même si le custom plugin n'est pas dans l'IPA.

**3. URLs 404 dans la prospection (P1) — RÉSOLU**
- Cause racine : Supabase `listings` avait été seedée avec des URLs bidons (`kolo_seed_*`) → clic → 404 Leboncoin.
- Fix backend (`/app/backend/v2_router.py` `_read_supabase_listings`) — double-ceinture :
  - Filtre PostgREST côté Supabase : `url=not.ilike.*kolo_seed*`.
  - Filtre défensif côté Python : drop tout row où `url` contient `kolo_seed` OU ne commence pas par `http(s)://`.
  - Ajout du champ `thumbnail_url` en sortie (utilisé par les miniatures UI ajoutées à `V2Extras.js`).
- Mêmes garde-fous appliqués aux chemins Apify fresh-scrape + pending-run.
- Tests pytest : `/app/backend/tests/test_iteration_61.py` — 4/4 PASSED (itération 61).

**Fichiers modifiés :**
- `/app/frontend/src/styles/v2.css`
- `/app/frontend/src/v2/pages/V2SubscriptionPage.js`
- `/app/frontend/ios/App/App/KoloIAPPlugin.swift`
- `/app/ios_native/KoloIAPPlugin.swift`
- `/app/backend/v2_router.py`

**À valider par l'utilisateur sur iPhone réel :**
- Fluidité de la navigation entre onglets (attendu : plus de « cut » visible).
- Bouton « J'ai un code promo » ouvre soit la feuille native, soit l'App Store en fallback.


## Implemented (état Feb 2026) — UPDATED
### Sprint App iOS V2.4 — Custom domain + runtime URL discovery (Feb 2026) 🔥 NEW
🎯 **Fix DÉFINITIF du 404 prod (TestFlight inclus)** — Racine identifiée :
- Les URLs `*.preview.emergentagent.com` sont des environnements de **preview** qui rotent entre sessions. Une IPA buildée pointant vers une preview URL morte → 404 systématique.
- Solution architecturale en double-ceinture :
  1. **URL custom stable** : `https://api.trykolo.io` (Cloudflare Worker hébergé sur le compte CF du user, proxy → backend Emergent avec rewrite du Host header). Voir `/app/DEPLOY-API-DOMAIN.md` pour le code du Worker + setup en 5 minutes.
  2. **Runtime URL discovery côté app** (`v2api.js`) :
     - Au boot, l'app teste la liste de candidats `[REACT_APP_BACKEND_URL, api.trykolo.io, responsive-kolo.preview.emergentagent.com]`, prend la première qui répond `/api/` 200, et la pin dans localStorage.
     - Wrapper `req()` : chaque appel détecte un 404/502/503/504/network-error, relance la discovery et retry avec la nouvelle URL.
     - Defensive : si l'env build-time pointe par erreur vers `trykolo.io` (marketing), bascule auto sur `api.trykolo.io`.
- Tous les fetch directs vers `process.env.REACT_APP_BACKEND_URL` dans `V2Layout`, `V2AuthPage`, `V2SubscriptionPage`, `V2NotificationsPage` ont été migrés sur `getApiBase()` exporté par `v2api.js` (URL dynamique).
- `codemagic.yaml` et `.env.production` pointent désormais vers `https://api.trykolo.io`.
- ATS iOS : `trykolo.io` avec `NSIncludesSubdomains=true` couvre déjà `api.trykolo.io`.
- **Bump version 2.4 / build 12**.

### Sprint App iOS V2.3 — Hotfix release Pige + clavier iOS (Feb 2026)
🎯 **Trois bugs critiques résolus avant resubmit App Store** :
- ✅ **404 Login/Signup production** — déjà résolu en V2.2 par le triple-ceinture (`codemagic.yaml` injecte `REACT_APP_BACKEND_URL` au build + fallback défensif dans `v2api.js` + `.env.production` commité). Bundle JS de prod vérifié : zéro occurrence de `trykolo.io` comme API.
- ✅ **Champs texte invisibles quand clavier iOS ouvert** — racine : le CSS keyboard-handling de `App.css` ciblait `[role="dialog"]` et `.kolo-bottom-sheet`, mais les modals V2 utilisent la classe `.v2-modal`. Ajout de `.v2-modal` aux sélecteurs, plus `max-height: calc(100vh - var(--kolo-keyboard-height) - 12px)` pour que la sheet rétrécisse au-dessus du clavier. Le hook `useIOSKeyboardScroll` (déjà branché dans `App.js`) s'occupe du `scrollIntoView` au focus. Inputs passés de `font-size: 15px → 16px` pour neutraliser le zoom-on-focus iOS.
- ✅ **Pige codes postaux : sélection multiple + validation explicite** :
  - Frontend : remplacement du simple input texte par un système de **chips** (style onboarding). L'utilisateur empile autant de codes postaux / villes qu'il veut (`75001`, `75002`, `Lyon 3`). Bouton `+` pour ajouter, `×` sur chaque chip pour retirer, paste avec virgules supporté.
  - Bouton **« Rechercher »** explicite (au lieu d'auto-trigger à chaque keystroke) — règle le bug où le quota gratuit 1 search/semaine était consommé au 1er caractère tapé.
  - Backend (`/api/v2/prospecting/dpe` + `/prospecting/listings`) : accepte maintenant `sector=75001,75002,Lyon 3`, split par virgule, construit une clause `OR` couvrant `code_postal_ban` et `nom_commune_ban` (DPE/ADEME) ou routage `postalCodes[]` / `cities[]` (Apify Pige Immo).
  - Exemple corrigé : « 75001 » est bien Paris (pas Lyon).
- ✅ **Bump version 2.3 / build 11** dans `App.xcodeproj/project.pbxproj`.

### Sprint App iOS V2.2 — Hotfix release (Feb 2026)
🎯 **Bloqueurs P0 résolus avant resubmit App Store** :
- ✅ **Fix HTTP 404 Login/Signup en production** — Racine : `process.env.REACT_APP_BACKEND_URL` n'était pas injecté à build-time sur Codemagic, le bundle iOS basculait alors sur une URL incorrecte. Triple ceinture :
  - `codemagic.yaml` : ajout `vars.REACT_APP_BACKEND_URL` + export explicite dans le step `Build React app`.
  - `frontend/.env.production` : déjà commité avec la bonne URL backend.
  - `v2/v2api.js` : fallback défensif — si l'env est vide OU pointe par erreur vers `trykolo.io`, bascule automatique sur `https://responsive-kolo.preview.emergentagent.com`. Expose `window.__KOLO_API_BASE__` pour debug Safari Inspector.
  - Vérifié : build CRA inline bien `responsive-kolo.preview.emergentagent.com` (zéro occurrence trykolo.io comme API).
- ✅ **Transitions latérales fluides type Instagram** entre les 4 onglets bottom-nav (Accueil ↔ Dossiers ↔ Contacts ↔ Agenda) :
  - `V2Layout.js` calcule la direction (gauche/droite) selon l'index du tab précédent stocké en `sessionStorage` (résiste au remount de V2Layout qui se fait par page).
  - CSS pure (zéro lib) : `v2-page-enter-right` / `v2-page-enter-left` avec `translate3d(±60px,0,0)` + opacity, 280ms `cubic-bezier(0.22, 0.61, 0.36, 1)`. Pages non-onglet → fade vertical court par défaut.
  - `overflow-x: hidden` sur `.v2-app > main` pour éviter le scrollbar horizontal momentané.
- ✅ **Bump version 2.2 / build 10** dans `App.xcodeproj/project.pbxproj` (Codemagic incrémentera le build number à la volée selon TestFlight/App Store).

### Sprint App iOS V2 — Suite (iter 58-59 — Feb 2026)
🎯 **Tour de finition avant build 2.1** :
- ✅ **Bump version Apple** : `MARKETING_VERSION 2.0 → 2.1`, `CURRENT_PROJECT_VERSION 8 → 9` dans `project.pbxproj` (Apple avait fermé le train 2.0)
- ✅ **Onboarding slide 0 = sélecteur de langue** (4 pastilles 🇫🇷🇬🇧🇩🇪🇮🇹) avec persistance dans localStorage.kolo_locale + sur user doc backend. STEPS passé de 9 à 10, tous les blocs `step ===` shiftés cleanement, eyebrows "Étape X" mises à jour. Gate disabled corrigée (`step === 1` au lieu de `step === 0`).
- ✅ **Padding-top header** passé de 14px à 24px + `env(safe-area-inset-top)` pour libérer le burger menu du notch iPhone.
- ✅ **Notifications push contextuelles (5 règles)** dans `notification_scheduler.py` :
  - `end_of_day` (17h UTC) — "Comment s'est passée ta journée ?"
  - `pige_done` — déclenchée quand un scrape Apify aboutit
  - `draft_unfinished` (> 6h) — "Tu as commencé quelque chose…"
  - `inactive_1d` — "KOLO t'attend 👋"
  - `inactive_2d` — "Tes prospects n'attendent pas"
  - Idempotence par `v2_push_log` (1 push par user/kind/jour max)
- ✅ **`/me` met à jour `last_seen_at`** à chaque appel pour les nudges d'inactivité
- ✅ **`dev_code` retiré de l'UI** (encore une vérif), backend retourne `dev_code` uniquement en non-prod, ignoré par le frontend
- ✅ **Investigation 404 admin** : pas de 404 reproductible côté backend (tous endpoints v2 répondent 200 pour `pressardelliot@gmail.com`). Probablement résolu par les redéploiements successifs.
- ✅ **Testing agent iter 59 : 100% frontend (walkthrough onboarding 0→9 réussi), 100% backend final après fix du mirror language sur user doc.**

### Sprint App iOS V2 Fixes (iter 57 — Feb 2026)
🍎 **8 bugs critiques fixés sur l'app iOS V2** :
- ✅ Page login/signup : logo K centré (display:block + margin:0 auto)
- ✅ Code `(dev: XXXXXX)` retiré du UI (devCode state supprimé de V2AuthPage)
- ✅ Bandeau jaune "Données d'exemple" remplacé par spinner moderne "Analyse en cours" (avec sous-texte "Tu peux quitter cette page, on te notifie dès que c'est prêt." pour les annonces)
- ✅ Compteurs Rappels/Notes affichent fait/créé réels (X/Y) au lieu de hard-coded /3 et /5. Backend `/api/v2/dashboard` enrichi avec `reminders_completed_today`, `reminders_created_today`, `notes_processed_today`, `notes_created_today`
- ✅ Safe-area-top : header `.v2-header` a maintenant `padding-top: calc(14px + env(safe-area-inset-top))` pour pas être collé au notch
- ✅ Pige listings : backend ne renvoie PLUS d'items factices placeholder. Renvoie `items:[]` + `source:scraping_in_progress`. Polling auto toutes les 8s côté frontend.
- ✅ Code promo Apple-compliant : champ + bouton dans V2SubscriptionPage. Endpoints backend `POST /api/v2/promo/redeem`, `POST /api/v2/promo/admin/create`, `GET /api/v2/promo/admin/list`. Codes single-use ou multi-use. Stockés dans `v2_promo_codes`. Codes de test : WELCOME30 (multi, 30 jours), VIP-ONCE (single, 90 jours).
- ✅ Sélecteur de langue (FR/EN/DE/IT) dans Profil & paramètres. Met à jour `localStorage.kolo_locale` et reload.
- ✅ Testing agent iter 57 : 17/17 backend tests passing, 13/13 frontend behaviors validated. Zéro régression.

### Sprint Marketing Site Refonte (iter 56 — Feb 2026)
🌐 **Refonte intégrale du site vitrine www.trykolo.io** (4 pages, style Revolut, lumineux, premium) :
- ✅ Page d'accueil `/` (`HomePage.js`) — Hero "Le copilote des agents qui veulent vendre plus" avec mockup iPhone réel (live screenshot V2), eyebrow chip, 2 CTAs (App Store + Voir comment ça marche), floating cards animées, bandeau logos défilant infini, 3 piliers, 3 stats, 2 product showcase steps, social proof quote, final CTA.
- ✅ Page `/comment-kolo` (`HowKoloPage.js`) — 4 étapes "Avant/Après" avec tags verts/rouges, mockups iPhone live et bullets concrets.
- ✅ Page `/ressources` (`ResourcesPage.js`) — 10 micro-tutos éditoriaux (rédaction maison) répartis en 5 catégories (Pige, Pilotage, Closing, Productivité, Outils). Filtres pill cliquables. Vue article expanded avec drop-cap typographique.
- ✅ Page `/a-propos` (`AboutPage.js`) — Founder story Elliot (ex-agent immobilier → tech), photo détourée sur mesh gradient, citation italique serif, 3 valeurs (terrain, rapide, indépendant).
- ✅ Design system marketing scopé `.mkt-root` (zéro fuite vers `/app-v2`) — Cabinet Grotesk display + Instrument Serif italics + Satoshi body. Palette ivoire/encre/coral.
- ✅ Bandeau logos infini : 15 logos partenaires extraits programmatiquement depuis la planche PNG fournie (Python/PIL, alpha mask + col/row band detection), normalisés à 160px de haut, animation CSS marquee 38s seamless avec masque dégradé sur les bords.
- ✅ Header sticky avec blur, footer pro 4 colonnes, menu burger mobile, reveal-on-scroll IntersectionObserver.
- ✅ Capacitor.isNativePlatform() préserve la route `/` pour l'app iOS (redirige vers `/app-v2`). Aucune régression sur les routes V2.
- ✅ Testing agent : 100% pass, 0 console error, 0 régression sur `/app-v2`.


## Implemented (état Feb 2026)
### Sprint LIGHT premium + mesh gradient + voice dictation + brain icon (iter 54 — Feb 2026) 🪶
🎨 **Pivot UI : light theme animated mesh gradient** (suite à feedback user "full black trop dur, je préfère du clair avec un gradient subtil qui bouge") :
- ✅ **v2.css basculé en LIGHT premium** : bg #F7F7F9 + animated mesh gradient (4 radial blobs pastel rose/bleu/jaune/vert + violet center) avec `.v2-app::before { position:fixed; inset:-15%; filter:blur(42px) saturate(135%); animation:meshDrift 26s ease-in-out infinite alternate }`. Glassmorphism rgba(255,255,255,0.75-0.85) blur 12-32px sur les cartes/nav/inputs.
- ✅ **Icône Brain pour Ask KOLO** : `home-ai-cta` est désormais une seule pill noire avec un unique icône `<Brain size={14}>` (lucide-react) au lieu de MessageCircle+Send.
- ✅ **Dictée vocale ajoutée** : 
  - `AddReminderModal` : micro sur input Titre (`reminder-title-mic`) + micro sur textarea Description (`reminder-desc-mic`) avec hint "Touche le micro pour dicter".
  - `AddCaseModal` : micro sur textarea Notes du dossier (`case-notes-mic`).
  - Implémentation Web Speech API via le hook `useSpeech` (continuous, fr-FR), pulse anim rouge `.recording`.
  - Styles `.v2-input-with-mic`, `.v2-input-mic`, `.v2-textarea-with-mic`, `.v2-textarea-mic`.
- ✅ **Flash blanc 1s entre pages éliminé** : 
  - `AppRouter` useEffect sync `document.body.style.backgroundColor='#F7F7F9'` quand route commence par `/app-v2` ou `/r/`.
  - Toutes les pages V2 `return <div className='v2-app' />` au lieu de `null` quand user encore en chargement (V2HomePage, V2NotificationsPage, V2Extras, V2OtherPages).
- ✅ **Prospecting Apify répareé (502 fix)** : polling backend réduit de range(25)*2s=50s → range(6)*2s=12s. Run_id/dataset_id stockés dans `v2_listings_pending` sur tout statut non-final, permet à l'appel suivant de reprendre le run sans relancer. Quota non consommé tant que `scraping_in_progress`. ✅ Vérifié : 1er appel ~12s, 2e appel ~1-3s, tous sous le seuil Cloudflare ~50s.
- ✅ **Capacitor StatusBar 'dark'** (icônes noires) + bg #F7F7F9 pour iOS/Android cohérence light.
- ✅ Backend pytest 10/10 — Frontend 100% testing agent PASS.


🎯 **Refonte UI critique post-rejet utilisateur ("cheap/bricolé/2D gris")** :
- ✅ **v2.css 100% refondu** — Palette dark obsidian (#040405 / #121214 / #1A1A1C), background avec radial glows verts/bleus subtils + grain SVG, glassmorphism propre (backdrop-filter blur 20-32px), shadows multi-layers (inner-glow + outer drop), typo Cabinet Grotesk pour displays. Plus aucun gris plat 2D.
- ✅ **Activity Rings SVG** (Apple Health style) sur la home — composant `<ActivityRing>` avec stroke-dasharray animé (cubic-bezier 1.4s). Ring Rappels (vert #32D74B) + Ring Notes (bleu #0A84FF) remplacent les stat cards plates. Center value/total + label + status dot.
- ✅ **Bottom Nav flottant premium iOS** — pill `position:fixed bottom:16px border-radius:999px` glass (blur 32px sat 180%), 4 tabs + FAB micro central blanc/noir 58px en saillie (-22px margin-top), backdrop, multi-layer shadow.
- ✅ **Hero "Bonjour {Prénom}" interactif** — tap ouvre `ProfileSheet` bottom modal (avatar + email + plan, items Profil/Pro/Notifications/Logout). Avatar circulaire 46px avec dot vert online. Badge PASSER PRO inline si user free.
- ✅ **Onboarding Sectors étape 5 refondu** — composant `SectorPicker` : 35 villes pré-listées en chips cliquables `<button className="v2-chip">` + champ custom + bouton "+" pour ajouter codes postaux. Sectors sélectionnés affichés en haut avec X de retrait (`v2-chip-remove`). **Plus aucun textarea "séparé par virgules"**.
- ✅ **Page Notifications** créée (était 404) — `/app-v2/notifications` (V2NotificationsPage.js) avec rappels pending/done + banner pige fraîche + push prompt + nav retour. Liée à la cloche du header.
- ✅ **Logos KOLO v5** — `/kolo-mark-v5-{32,64,128,180,192,256,512}.png` (K blanc transparent, fond 0% opacité) intégrés dans manifest, apple-touch-icon, header, splash, auth, loading.
- ✅ **Drawer Guide web** — nouveau lien externe `<a href="https://www.trykolo.io/guide" target="_blank">` (`drawer-guide-online`) sous Guide KOLO interne.
- ✅ **Daily Advice collapsible** corrigée DOM-valide (div role="button" + keyboard handler) — résout warning React nested-button.
- ✅ **Capacitor StatusBar light + bg #040405** sur iOS/Android pour cohérence dark.
- ✅ Backend 100% pytest (11/11) — endpoints inchangés, logos statiques 200 OK.

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

## Roadmap BLOC A — Refonte socle de données (Fev 2026)

### Session A1 — Ingestion  ✅ (29 Août 2026)
- Extension `listings` : `transaction`, `type_normalise`, `est_logement` + 4 indexes filtrés
- Webhook `POST /api/webhooks/apify` : modes `complet` / `incremental`
- Normalisation partagée dans `backend/normalization.py` (utilisée par webhook ET cron legacy — aucune ligne non normalisée possible)
- Collection Mongo `zones_scraping` (source × code postal)
- Auto-postal code pour Paris/Lyon/Marseille via `city`
- 68 tests unitaires pytest
- **À FAIRE côté user** : backup + `A1_listings_extensions.sql` dans SQL Editor Supabase + `python -m scripts.backfill_normalization`

### Session A2 — Data Model  ✅ (29 Août 2026)
- Migration users idempotente : 186 users, 0 role invalide
- 14 nouvelles collections MongoDB avec indexes
- Règle « 1 opportunité = 1 conseiller par agence » : index unique partiel `(organisation_id, dpe_id)` + test pytest avec `DuplicateKeyError`
- Fonctions uniques `verifier_quota` / `incrementer_quota` + fuseau Europe/Paris
- `config_matching` singleton : aucun seuil en dur dans le code
- Endpoints `POST /api/events`, `GET/PATCH /api/admin/config-matching`
- Réponse auth étendue (role, organisation_id, organisation_nom, plan, onboarding_infos_ok, tour_guide_vu, zones)
- 24 tests pytest verts sur 8 runs consécutifs

### Session A3 — Opportunities Engine  ✅ (1 Sept 2026)
- Extraction rue/étage batch : 315/1225 rues écrites sur le 75017 (25.7%)
  - Taux par source cohérent avec la mesure user : bienici 36.4%, pap 34.3%, seloger/leboncoin/century21/safti 0% (description non fournie)
- Job nocturne à **03h00 Europe/Paris** (cron asyncio via zoneinfo, gère heure d'été/hiver)
- 5 sous-scores + court-circuit rue≠surface<0.9 (voir `a3/matching.py`)
- Cadastre (bloquant, cache 6 mois) + Géorisques (fire & forget, ordre lon,lat)
- Sur 75017 : 1124 DPE traités → 838 déjà en vente (74.6%), 279 filtrés, 7 opportunités quand seuil_publication baissé à 0.20
- Aucun seuil en dur — tout via `config_matching`
- Secrets rotationnés : ADMIN_SECRET + APIFY_WEBHOOK_SECRET (leakés en clair)
- Extraction rue + étage depuis les listings (regex + parsing description)
- Intégration APIs : BAN (géocodage), Cadastre, Georisques, ADEME (DPE)
- Scoring 5 axes : rue (30%), surface (25%), classe énergie (20%), type (15%), étage (10%)
- Cron quotidien 03h00 UTC — match tous les DPE actifs vs listings actives
- Endpoint `GET /api/opportunites` + persistance dans `opportunites` collection

