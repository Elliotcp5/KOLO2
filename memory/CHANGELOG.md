# KOLO - Changelog

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
