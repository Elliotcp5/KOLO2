# BLOC B1 — Copie FR figée (validée le 1er septembre 2026)

> Règles absolues :
> - Vouvoiement partout (interface, tour, paywall, assistant).
> - Jamais de volume chiffré d'opportunités.
> - « Aucune annonce détectée » — jamais « ce bien n'est pas sur le marché ».
> - Aucun champ texte libre obligatoire ; clavier uniquement pour un nom propre ou un montant.
> - Parcours d'onboarding < 60 secondes (critère de recette).

## Onboarding — 7 écrans

### Écran 1 · Identité
- Titre : Bienvenue sur KOLO
- Sous-titre : Moins d'une minute pour commencer.
- Prénom : Prénom
- Nom : Nom
- Bouton : Continuer
- Progress : Étape 1 sur 7

### Écran 2 · Statut
- Titre : Vous êtes ?
- Sous-titre : Cela nous aide à adapter KOLO à votre quotidien.
- Card Agent : Agent immobilier — Vous prospectez et signez des mandats.
- Card Directeur : Directeur d'agence — Vous pilotez une équipe de conseillers.
- Bouton : Continuer
- Progress : Étape 2 sur 7

### Écran 3 · Zones
- Titre : Vos zones de prospection
- Sous-titre : Un ou deux codes postaux, ceux que vous travaillez au quotidien.
- Placeholder : Code postal
- Ligne ville (sous le CP) : ex. « 13008 · Marseille 8ᵉ »
- CP inconnu : Code postal introuvable
- Bouton : + Ajouter une zone
- Compteur : 1 zone sur 2 · 2 zones sur 2
- Bouton : Continuer
- Progress : Étape 3 sur 7

### Écran 4 · Traitement
- Titre : Nous vérifions vos zones…
- Sous-titre : Quelques secondes.

### Écran 5 · Résultat zone
Cas couvert :
- Titre : Vos zones sont couvertes.
- Sous-titre : Vous recevrez chaque jour les nouvelles opportunités.
- Bouton : Continuer

Cas non couvert :
- Titre : Vos zones ne sont pas encore couvertes par KOLO.
- Sous-titre : Nous reviendrons vers vous dès que nous les ouvrons.
- Ligne info : Zone enregistrée : 33000 · Bordeaux
- Bouton unique : Modifier

### Écran 6 · Plan (Pro mis en avant, Découverte lien secondaire)
- Titre : Choisissez votre plan
- Sous-titre : Vous pourrez changer à tout moment.

Card Pro (mise en avant, bouton principal) :
- Nom : Pro
- Prix : 24,99 € par mois
- Ligne 1 (imposée) : Toutes les opportunités de vos zones, chaque jour
- Ligne 2 : Estimations et dossiers illimités
- Ligne 3 : Assistant KOLO
- Bouton principal : Commencer avec Pro
- Petit texte : Facturé par Apple. Résiliable à tout moment.

Lien secondaire (bouton texte lisible, pas gris minuscule) : Continuer en Découverte

Card Découverte (visible en secondaire) :
- Nom : Découverte — 0 €
- Ligne 1 : Une opportunité de mandat par semaine
- Ligne 2 : Une estimation par semaine
- Ligne 3 : Un dossier d'estimation par mois
- Ligne 4 : Pas d'assistant KOLO

Sous le bloc (obligatoire Apple) :
- Lien : Conditions générales
- Lien : Politique de confidentialité
- Lien : Restaurer mes achats

Progress : Étape 6 sur 7

### Écran 7 · Bienvenue final
- Titre : Vous êtes prêt.
- Sous-titre : Nous vous avons préparé vos premières opportunités, plus une offerte pour votre inscription.
- Bouton : Voir mes opportunités
- Progress : Étape 7 sur 7

## Tour guidé — 6 bulles

1. Opportunités (avec animation du geste) : Chaque jour, vos opportunités de mandats. Une opportunité, c'est un DPE réalisé sur un bien pour lequel aucune annonce n'a été détectée. Balayez à gauche pour ignorer, à droite pour traiter.
2. Estimation : Estimez un bien en quelques secondes, à partir des données de marché de votre secteur.
3. Rapport : Générez un dossier professionnel prêt à envoyer à votre client.
4. Assistant : Une question sur un dossier, une commune, un statut ? L'assistant vous répond.
5. Performances (icône) : Suivez vos opportunités, vos démarches et vos mandats signés.
6. Profil (icône) : Vos informations, vos zones, votre plan. Tout est modifiable à tout moment.

Bouton bulle : Suivant · Terminer (dernière).
Lien discret : Passer le tour.

## Profil

### Bloc plan
- Titre : Votre plan actuel
- Badge Pro : Pro
- Badge Découverte : Découverte
- Ligne date : Prochain renouvellement le 12 mars 2026
- Bouton (si Découverte) : Passer Pro

### Menu
- Informations personnelles
- Informations professionnelles
- Zones de prospection
- Plan et mode de paiement
- Revoir le tour guidé
- Contacter le support KOLO
- Supprimer mon compte
- Se déconnecter

### Informations personnelles (toutes facultatives)
Prénom, Nom, Téléphone, Email, Adresse, Code postal, Ville.

### Informations professionnelles (bloc `infos_pro`, facultatif, complétude tracée)
- Statut juridique (auto-entrepreneur / EURL / SARL / SAS / salarié / autre)
- SIREN
- Nom de l'agence ou du réseau
- Carte T (numéro)
- CCI de délivrance
- RCP (assureur)
- RCP (numéro de police)
- Garantie financière
- Taux d'honoraires (%)
- Honoraires à la charge de (vendeur / acquéreur / partagés)

Grille de pondération des surfaces annexes (coefficients, valeurs par défaut) :
- Terrasse : 0,35
- Balcon et loggia : 0,25
- Combles aménageables : 0,30
- Cave et cellier : 0,12
- Garage : 0,40
- Place de parking : 0,30
- Jardin : 0,10

Indicateur en haut de bloc : « Complet à 60 % » avec barre rose.

### Zones de prospection
- Titre bloc : Vos zones actuelles
- Ligne couverte : 13008 · Marseille 8ᵉ · Couverte
- Ligne demandée : 33000 · Bordeaux · En attente d'ouverture
- Bouton : Modifier mes zones

Modale modif — cas Découverte (première fois) :
- Titre : Modifier vos zones
- Texte : En Découverte, vous pouvez modifier vos zones une seule fois. Passez Pro pour les changer à volonté.
- Bouton 1 : Modifier maintenant
- Bouton 2 : Passer Pro

Modale modif — Découverte utilisée :
- Texte : Vous avez déjà utilisé votre modification. Passez Pro pour continuer à ajuster vos zones.
- Bouton unique : Passer Pro

### Suppression de compte — 3 variantes selon le rôle

Commun à toutes les variantes :
- Confirmation à deux taps (jamais de champ texte libre).
- Mention en bas : « Votre abonnement Pro n'est pas résilié automatiquement. Vous pouvez le faire depuis les réglages de votre iPhone. »
- Bouton associé : Gérer mon abonnement (ouvre les réglages iOS abonnement).

Indépendant :
- Titre : Supprimer mon compte
- Texte : Cette action supprime définitivement votre compte KOLO et toutes vos données. Elle est irréversible.
- Bouton rouge tap 1 : Supprimer mon compte
- Bouton rouge tap 2 : Confirmer la suppression
- Bouton neutre : Annuler

Conseiller rattaché à une agence :
- Titre : Quitter l'agence et supprimer mon compte
- Texte : Votre directeur en sera informé. Cette action supprime définitivement votre compte KOLO et toutes vos données. Elle est irréversible.
- Bouton rouge tap 1 : Quitter et supprimer
- Bouton rouge tap 2 : Confirmer la suppression
- Bouton neutre : Annuler

Directeur :
- Titre : Supprimer mon compte
- Texte : Votre agence et les comptes de vos conseillers ne seront pas supprimés. Contactez KOLO pour résilier l'abonnement d'équipe. Cette action supprime définitivement votre compte personnel.
- Bouton rouge tap 1 : Supprimer mon compte
- Bouton rouge tap 2 : Confirmer la suppression
- Bouton neutre : Annuler

## Textes système transverses
- Aucune annonce détectée.
- Toutes les opportunités de vos zones, chaque jour.
- Restaurer mes achats
- Connexion perdue. Réessayez dans un instant.
- Un instant…

## Notes techniques
- Zone de démonstration Apple Review : code postal `99999` — libellé « 99999 · Zone de démonstration ». Toujours couverte, 3 cartes fictives marquées Démo.
- Code postal réel à indiquer dans les notes de revue Apple : `13008`.
- Assistant V2 existant : « Bonjour Sarah, comment puis-je vous aider aujourd'hui ? » (vouvoiement).
