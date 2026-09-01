# BLOC B / Veille — Copie FR figée (validée le 1er septembre 2026)

> Règles absolues :
> - Vouvoiement partout.
> - **Aucune formulation incitative.** Faits chiffrés uniquement.
> - Rose `#EC8690` **interdit** sur toute carte de veille. Ambre `#F59E0B` réservé.
> - « Aucune annonce détectée » **n'apparaît jamais** sur ces cartes.
> - Score de tri : `min(days_on_market, veille.dom_cap_days) / 30 + price_drop_count * veille.price_drop_weight` — constantes dans `config_matching.veille`.

## Bandeau et libellés carte
- **Bandeau haut (chip ambre en overlay coin haut-gauche sur la photo)** : Bien en vente à surveiller
- **Ligne adresse** : `{adresse}`
- **Ligne complément ADEME** (gris, sous adresse) : `Étage {n}` · `{surface} m²` · `{rooms} pièces`
- **Fait 1 (ancienneté)** : `Annoncé depuis {n} jours`
- **Fait 2 — 1 seule baisse** : `Prix baissé une fois, −{pct} %`
- **Fait 2 — 2+ baisses** : `Prix baissé {n} fois, −{pct} %`
- **Ligne caractéristiques** : `{prix} € · {prix_m2} €/m² · {surface} m² · DPE {classe}`
- **Bouton texte ambre** : Voir l'annonce
- **Chip source bas de carte** : Source : annonce en ligne
- **Fond image absente** : `#F1F5F9` (gris clair) + illustration bien en gris (jamais rose).

## Séparateur intercalaire (entre opportunités et pile de veille)
- **Titre** : Vous avez vu toutes vos opportunités de mandats du jour.
- **Sous-titre** : Voici les biens en vente qui peinent à trouver preneur dans vos zones.
- **CTA** : Voir les biens à surveiller
- **Lien secondaire** : Revenir demain

## Boutons d'action sur carte veille (couleurs neutres, pas de rose)
- **Bouton négatif (gris clair, croix)** : Passer
- **Bouton positif (ambre plein, œil)** : Marquer à suivre

## Section « Biens en vente à surveiller » (dans Mes opportunités)
- **Titre section** : Biens en vente à surveiller
- **Sous-titre** : Biens en vente que vous avez choisi de suivre.
- **Ligne carte** : adresse, `Annoncé depuis {n} jours`, `Prix baissé {n} fois, −{pct} %`, date marquée.
- **Actions par ligne** : Voir l'annonce · Retirer de ma veille

## États vides
- **Section vide** : Vous ne suivez aucun bien pour le moment.
- **Aucun bien à surveiller le jour J** *(uniquement si l'utilisateur a atteint la fin de la pile d'opportunités et que quota_du_jour < 3)* : Aucun bien à surveiller aujourd'hui dans vos zones.

## Paywall deeplink Découverte
- **Titre** : Fonctionnalité Pro
- **Sous-titre** : La veille des biens en vente est incluse dans le plan Pro.
- **Bouton principal** : Passer Pro
- **Lien secondaire** : Retour aux opportunités

## Ce qui n'apparaît jamais (bannis dans le code — commentaire à copier tel quel)
- Jamais « mandat à récupérer »
- Jamais « le vendeur est prêt à changer d'agence »
- Jamais « opportunité »
- Jamais « à démarcher »
- Jamais « mandat exclusif » / « mandat simple » en surimpression
- Jamais de barre de progression sur la pile de veille
- Jamais d'insertion dans la pile d'opportunités de mandat
- Rose `#EC8690` **interdit** sur toute carte veille
