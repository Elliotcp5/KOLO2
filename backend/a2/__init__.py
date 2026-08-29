"""
KOLO — Package Session A2 (modèle de données)
=============================================

Contenu :
  - `tz.py`         Utilitaire fuseau Europe/Paris (fenêtres glissantes de quotas).
  - `config.py`     Accessor du document unique `config_matching` (aucun seuil en dur).
  - `quotas.py`     Fonctions `verifier_quota` / `incrementer_quota`.
  - `indexes.py`    Ensure indexes pour toutes les collections A2.
  - `routes.py`     Endpoints /api/events + /api/admin/config-matching + admin migration.
  - `migration_users.py`  Script CLI pour migrer les users existants (idempotent).

Aucune valeur métier (seuils, poids, plafonds) n'est codée en dur dans ces modules.
Elles vivent dans `config_matching` et se modifient depuis le back-office via
`PATCH /api/admin/config-matching`.
"""
