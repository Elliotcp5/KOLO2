"""KOLO — Session A3 : moteur d'opportunités.

Sous-modules :
  - `text`               Normalisation (accents, articles, types de voie)
  - `sources.ban`        Géocodage + liste des voies (api-adresse.data.gouv.fr)
  - `sources.ademe`      DPE logements existants (data.ademe.fr)
  - `sources.cadastre`   API Carto IGN (identifiant parcelle 14 caractères)
  - `sources.georisques` État des risques (attention : lon,lat)
  - `extract_rue`        Extraction rue + étage depuis title/description
  - `matching`           Score de correspondance (5 sous-scores, poids depuis config_matching)
  - `job_extract_rues`   Job batch d'extraction
  - `job_generer_opportunites`  Job nocturne — création des opportunités
  - `scheduler`          Cron 03h00 Europe/Paris
  - `routes`             Endpoints /api/jobs/* + /api/admin/rapprochements

Aucun seuil, aucun poids codé en dur — tout vit dans `config_matching` (A2).
Aucun écran, aucun composant React — c'est du backend pur.
"""
