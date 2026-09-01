"""KOLO A3 — ADEME `dpe03existant` (data.ademe.fr).

CRITIQUE : les noms de champs varient d'une version du jeu de données à l'autre.
`get_schema()` interroge le schéma live et cache le mapping — TOUTES les
requêtes passent par `SchemaResolver.field(name)` pour ne jamais écrire un nom
en dur.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

BASE = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant"
# L'alias `dpe03existant` déclenche un WAF nginx sur les requêtes `qs=...`.
# On résout donc l'ID interne du dataset au premier fetch et on l'utilise
# ensuite comme URL de base des `lines`.

# User-Agent explicite : sans lui, data.ademe.fr renvoie 403 sur certains endpoints.
_HTTP_HEADERS = {
    "User-Agent": "KOLO/1.0 (+https://trykolo.io; contact=elliot.cohenpressard@trykolo.io)",
    "Accept": "application/json",
}

# Noms canoniques KOLO → aliases probables ADEME
_CANONICAL_ALIASES: dict[str, list[str]] = {
    "numero_dpe":                ["numero_dpe", "n_dpe"],
    "date_etablissement":        ["date_etablissement_dpe", "date_realisation"],
    "date_reception":            ["date_reception_dpe"],
    "code_postal":               ["code_postal_ban", "code_postal_brut", "code_postal"],
    "adresse":                   ["adresse_ban", "adresse_brut", "adresse"],
    "ban_id":                    ["identifiant_ban", "ban_id"],
    "rnb_id":                    ["identifiant_rnb", "rnb_id"],
    "nom_voie":                  ["nom_voie_ban", "nom_voie_brut", "nom_voie"],
    "complement_adresse":        ["complement_adresse_logement", "complement_adresse_batiment", "complement_adresse"],
    "type_batiment":             ["type_batiment"],
    "surface_habitable":         ["surface_habitable_logement", "surface_habitable"],
    "nb_niveaux":                ["nombre_niveau_logement", "nombre_niveaux"],
    "hauteur_sous_plafond":      ["hauteur_sous_plafond"],
    "annee_construction":        ["annee_construction"],
    "periode_construction":      ["periode_construction"],
    "classe_dpe":                ["etiquette_dpe", "classe_dpe"],
    "classe_ges":                ["etiquette_ges", "classe_ges"],
    "conso":                     ["conso_5_usages_ep_par_m2", "conso_5_usages_par_m2_ep"],
    "emissions":                 ["emission_ges_5_usages_par_m2", "emission_ges_5_usages"],
    "cout_annuel":               ["cout_total_5_usages"],
    "type_chauffage":            ["type_generateur_principal_chauffage", "type_energie_chauffage"],
    "energie_chauffage":         ["type_energie_principale_chauffage", "type_energie_n_1"],
    "type_ecs":                  ["type_generateur_principal_ecs"],
    "ventilation":               ["type_ventilation"],
    "vitrage":                   ["type_vitrage"],
    "zone_climatique":           ["zone_climatique"],
    "latitude":                  ["_geopoint_lat", "coordonnee_cartographique_y_ban"],
    "longitude":                 ["_geopoint_lon", "coordonnee_cartographique_x_ban"],
}


class SchemaResolver:
    """Résout les noms de champs canoniques KOLO → noms réels ADEME."""

    def __init__(self):
        self._mapping: dict[str, str] = {}
        self._fetched_at: Optional[datetime] = None
        self._available: set[str] = set()
        self._lines_base: str = f"{BASE}/lines"

    async def fetch(self, client: httpx.AsyncClient) -> None:
        r = await client.get(BASE, headers=_HTTP_HEADERS, timeout=15)
        r.raise_for_status()
        j = r.json() or {}
        # Résout l'URL du dataset interne (WAF-safe pour `qs=...`)
        dataset_id = j.get("id")
        if dataset_id and dataset_id != "dpe03existant":
            self._lines_base = f"https://data.ademe.fr/data-fair/api/v1/datasets/{dataset_id}/lines"
        schema = j.get("schema") or []
        self._available = {c.get("key") for c in schema if c.get("key")}
        self._mapping = {}
        for canonical, aliases in _CANONICAL_ALIASES.items():
            for a in aliases:
                if a in self._available:
                    self._mapping[canonical] = a
                    break
        self._fetched_at = datetime.now(timezone.utc)
        logger.info(
            f"ademe.SchemaResolver: {len(self._mapping)}/{len(_CANONICAL_ALIASES)} "
            f"fields resolved, dataset has {len(self._available)} keys, "
            f"lines_base={self._lines_base}"
        )

    def lines_url(self) -> str:
        return self._lines_base

    def field(self, canonical: str) -> Optional[str]:
        return self._mapping.get(canonical)

    def has(self, canonical: str) -> bool:
        return canonical in self._mapping

    def is_ready(self) -> bool:
        return bool(self._mapping)

    def to_dict(self) -> dict[str, str]:
        return dict(self._mapping)


_SCHEMA_SINGLETON = SchemaResolver()


async def get_schema(client: httpx.AsyncClient) -> SchemaResolver:
    if not _SCHEMA_SINGLETON.is_ready() or (
        _SCHEMA_SINGLETON._fetched_at
        and (datetime.now(timezone.utc) - _SCHEMA_SINGLETON._fetched_at) > timedelta(hours=24)
    ):
        await _SCHEMA_SINGLETON.fetch(client)
    return _SCHEMA_SINGLETON


def _canonical_from_row(row: dict, schema: SchemaResolver) -> dict:
    """Convertit une ligne ADEME brute en dict canonique KOLO."""
    out: dict = {}
    for canonical in _CANONICAL_ALIASES:
        real = schema.field(canonical)
        if real and real in row:
            out[canonical] = row[real]
    # Toujours conserver tout le row brut pour audit
    out["_raw"] = row
    return out


async def fetch_dpe_recents(
    client: httpx.AsyncClient,
    code_postal: str,
    date_min_iso: str,
    max_pages: int = 5,
    page_size: int = 1000,
) -> list[dict]:
    """Récupère les DPE d'un CP dont date_etablissement >= date_min_iso."""
    schema = await get_schema(client)
    cp_field = schema.field("code_postal")
    date_field = schema.field("date_etablissement")
    if not cp_field or not date_field:
        logger.error("ademe.fetch_dpe_recents: fields missing in schema")
        return []

    select_fields = [schema.field(c) for c in _CANONICAL_ALIASES if schema.field(c)]
    results: list[dict] = []
    for page in range(max_pages):
        params = {
            "size": str(page_size),
            "select": ",".join(select_fields),
            "qs": f'{cp_field}:"{code_postal}" AND {date_field}:[{date_min_iso} TO *]',
            "sort": f"-{date_field}",
            "page": str(page + 1),
        }
        try:
            r = await client.get(schema.lines_url(), params=params, headers=_HTTP_HEADERS, timeout=30)
            if r.status_code != 200:
                logger.warning(f"ademe.fetch_dpe_recents HTTP {r.status_code}: {r.text[:200]}")
                break
            body = r.json() or {}
            rows = body.get("results") or []
            for row in rows:
                results.append(_canonical_from_row(row, schema))
            if len(rows) < page_size:
                break
        except Exception as e:
            logger.warning(f"ademe.fetch_dpe_recents error: {e}")
            break
        await asyncio.sleep(0.1)
    return results
