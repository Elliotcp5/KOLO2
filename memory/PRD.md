# KOLO - CRM Immobilier Mobile-First PWA

## Probleme Original
Application CRM mobile-first PWA pour agents immobiliers avec:
- UI dark mode / light mode avec accents violet #7C3AED
- Localisation FR/EN automatique
- Prix regional (9.99 EUR/GBP/USD)
- Authentification email/password avec Bearer Token
- Essai gratuit 7 jours SANS carte bancaire
- Gestion prospects et taches avec suivi automatique
- **Assistant IA** : scoring, generation de messages, suggestions
- **SMS bidirectionnels** : envoi + reception des reponses

## Architecture v2.0
```
/app/
├── backend/
│   ├── server.py          # API FastAPI (~2500 lignes)
│   └── .env               # Config
└── frontend/
    ├── src/
    │   ├── context/
    │   │   ├── ThemeContext.js    # NEW - Gestion theme light/dark
    │   │   ├── AuthContext.js
    │   │   └── LocaleContext.js
    │   ├── components/
    │   │   ├── OnboardingFlow.js  # NEW - Didacticiel 5 ecrans
    │   │   └── ...
    │   ├── pages/
    │   │   ├── AppShell.js        # Composant principal
    │   │   ├── LandingPageNew.js  # NEW - Landing refonte
    │   │   └── ...
    │   └── styles/
    │       └── themes.css         # NEW - Variables CSS themes
    └── package.json
```

## Fonctionnalites v2.0 (11 Mars 2026)

### Mode Clair / Sombre
- Light mode par defaut pour nouveaux utilisateurs
- Variables CSS: --bg, --surface, --text, --accent, etc.
- Toggle dans Mon Profil avec icones Sun/Moon
- Sauvegarde en base via `theme_preference`

### Statuts Prospect Pipeline
- `nouveau` → `contacte` → `qualifie` → `offre` → `signe`
- Badge sur chaque card prospect
- Badge vert pour "signe"

### Onboarding Didacticiel
- 5 ecrans avec progress bar
- Import contacts (Android only)
- Choix theme obligatoire
- Confetti a la fin

### Streak de Suivi
- Compteur jours consecutifs
- Affiche si >= 2 jours
- "X semaines de suivi parfait" si >= 7 jours

### Ameliorations UX
- Message contextuel dynamique (matin/retards/complet)
- Animation "Analyse du projet de [prenom]..."
- Lien "En retard — Relancer maintenant"
- Bouton resilisation avec modale

### Landing Page Refonte
- Headline: "Vos prospects vous oublient..."
- 7 sections: Hero, Probleme, How, Temoignages, Pricing, FAQ, CTA
- FAQ en accordion

## Integrations
- **Stripe** : Paiements
- **OpenAI GPT-4.1-nano** : Generation SMS rapide
- **Anthropic Claude** : Suggestions IA
- **Resend** : Emails
- **Brevo** : SMS
- **GA4** : Analytics

## Backlog

### Complete v2.0
- [x] Mode clair/sombre avec toggle
- [x] Statuts prospects (nouveau→signe)
- [x] Onboarding 5 ecrans
- [x] Streak de suivi
- [x] Message contextuel
- [x] Landing page refonte
- [x] Animation generation IA
- [x] Bouton resilisation

### Reste a faire
- [ ] Tooltips premiers pas (apres onboarding)
- [ ] Import contacts natif (necessite React Native pour iOS)
- [ ] Formulaire prospect ameliore (source, helper text)
- [ ] Tests complets
- [ ] Deploiement production

### Future (P2-P3)
- [ ] Refactoring server.py
- [ ] Refactoring AppShell.js
- [ ] Export CSV
- [ ] Statistiques conversion

## Date Mise a Jour
11 mars 2026
