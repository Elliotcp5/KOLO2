"""KOLO — Session B3 : Performances, Notifications planifiées, Emails, Funnel admin.

Ce module ne réécrit rien de A/B1/B2. Il consomme :
- `opportunites.statut` / `date_dernier_statut` pour les 3 jauges Performances
- `veille_actions` pour les statuts de veille (exclus des compteurs)
- `events` pour l'entonnoir de conversion
- `zones_demandees` + `zones_couvertes` pour l'ouverture de zone
- `device_tokens` pour les envois push (couverture multi-appareils)

Le scheduler des notifications est un tick minute qui interroge la config à chaque
tour. Aucun seuil en dur : tout vit dans `config_matching.notif` et `.streak`.
"""
from __future__ import annotations
