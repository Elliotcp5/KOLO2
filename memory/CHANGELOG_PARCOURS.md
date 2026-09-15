# Parcours utilisateur — fork 12 fév 2026 (session 2)

## Parcours 1 — Directeur reçoit et affecte ✓ (parcouru bout en bout)
- **Fix majeur** : sélection zones directeur — auparavant `Zones couvertes` en lecture seule. Ajout d'un vrai éditeur (chips supprimables + input CP + validation 5 chiffres + i18n FR/EN) dans `B1Directeur.jsx::DirecteurAgencePage`. Backend `PATCH /api/d1/organisations/me` acceptait déjà `zones` — c'était juste absent côté UI.
- Le directeur voit ses opps (3 opps assignées via promouvoir-directeur → `assigne_a`).
- Swipe droite → **sheet d'affectation** s'ouvre (`SheetAffectation`) avec « Garder pour moi » + liste conseillers.
- `POST /api/d1/opportunites/{opp_id}/swipe-directeur` avec `user_id` du conseiller : opp passe en `statut:a_demarcher`, `affectation_notif_flag:true`, `affectee_par:<directeur_uid>`.
- **Fix backend** : `GET /api/opportunites/du-jour` filtrait uniquement `statut:proposee` — le conseiller ne voyait pas les opps affectées en `a_demarcher`. Ajout d'un `$or` pour inclure aussi `{statut:a_demarcher, affectation_notif_flag:true}`.
- Frontend déjà OK : bandeau « Nouvelle opportunité affectée » + swipe désactivé quand flag présent.

## Parcours 2 — Conseiller invité rejoint l'agence ✓ (parcouru bout en bout)
- **Bug racine trouvé** : `verify-email-code` appelait `attach_conseiller_if_invited` UNIQUEMENT sur les nouveaux comptes. Un user existant qui se reconnectait après avoir été invité restait « standard sans rattachement ».
- Fix `/api/v2/auth/verify-email-code` : appel de `attach_conseiller_if_invited` AUSSI dans la branche `existing`, avec re-fetch du doc pour que la réponse renvoie `role:conseiller`, `plan:agence`, `organisation_nom`.
- Vérifié bout en bout : conseiller créé via signup email-code → réponse `role:"conseiller"`, `organisation_id:"6aa9508c5e7253966f8ab3d4"`, `organisation_nom:"Agence Parcours1 KOLO"`, `plan:"agence"` ✓.
- Frontend déjà OK : swipe désactivé pour opps affectées, bandeau visible.

## Parcours 3 — Gratuit va jusqu'au paiement ✓ (5 murs traités, 1 estimation à vie appliquée)
- **Règle « 1 estimation offerte à vie »** — auparavant `hebdo, limite 1` (rechargeable chaque semaine). Nouveau `kind: "lifetime"` ajouté dans `a2/tz.py` (clé constante `"lifetime"`) + config Découverte `estimation` et `dossier` passés en `{"kind":"lifetime","limite":1}`.
- **Fix compteur non incrémenté** : `verifier_quota` vérifiait sans jamais appeler `incrementer_quota` derrière → un Découverte pouvait lancer autant d'estimations qu'il voulait. Ajout de `incrementer_quota(db, user, "estimation")` après insert dans `c1/routes.py::create_estimation`.
- Test end-to-end : 1ère estimation HTTP 200, 2ème HTTP 402 avec `kind:lifetime, periode:lifetime`. Frontend intercepte déjà 402 → `/app-b1/paywall`.
- **5 murs** :
  - Fin de pile : CTA Pro contextuel avec chiffre réel de la zone ✓ (ajouté aussi sur variante `zone_vide`)
  - Veille concurrentielle : `VeillePaywall` existant → `/app-b1/paywall` ✓
  - Estimation : 402 quota_estimation_epuise → paywall ✓
  - Dossier PDF : CTA sur `ExportScreen` ✓ (visible dès qu'on atteint l'écran d'export)
  - Assistant : `as-upgrade` → `/app-b1/paywall` ✓ (fix appliqué au tour précédent)

## Parcours 4, 5, 6 — Pas fait
Stoppé à la fin d'un parcours entier comme demandé. Reste à traiter :
- **P4** : clavier Capacitor sur formulaire d'invitation directeur (pattern déjà appliqué à Assistant)
- **P5** : audit i18n FR/EN, correction `OPP.MES_MANDATS.DETAIL.STATUT`
- **P6** : écran chargement PDF animé + suppression bouton Générer en doublon
