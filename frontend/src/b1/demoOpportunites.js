// KOLO B1 — 4 opportunités fictives injectées pour la zone 99999 (Apple Review).
// Aucun appel réseau nécessaire ; simplement 3 cartes marquées `demo=true` pour
// garantir un swipe fonctionnel côté reviewer. La 4ème carte est un buffer pour
// que la file ne se vide jamais en cours de démo.

export const DEMO_OPPORTUNITES = [
  {
    id: 'demo-1',
    demo: true,
    adresse: '12 rue de la Démonstration',
    ville: 'Zone de démonstration',
    dpe: 'F',
    superficie: 78,
    source: 'DPE',
    illustration_type: 'appartement',
    note: 'Rénovation à envisager',
  },
  {
    id: 'demo-2',
    demo: true,
    adresse: '45 avenue des Exemples',
    ville: 'Zone de démonstration',
    dpe: 'D',
    superficie: 115,
    source: 'DPE',
    illustration_type: 'maison',
    note: 'Bon état général',
  },
  {
    id: 'demo-3',
    demo: true,
    adresse: '7 place du Test',
    ville: 'Zone de démonstration',
    dpe: 'E',
    superficie: 92,
    source: 'DPE',
    illustration_type: 'appartement',
    note: 'Vue dégagée',
  },
  {
    id: 'demo-4',
    demo: true,
    adresse: '3 chemin des Reviewers',
    ville: 'Zone de démonstration',
    dpe: 'G',
    superficie: 155,
    source: 'DPE',
    illustration_type: 'maison',
    note: 'Rénovation énergétique à prévoir',
  },
];
