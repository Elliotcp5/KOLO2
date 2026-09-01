"""KOLO A3 — Job nocturne : génération des opportunités.

`POST /api/jobs/generer-opportunites { code_postal? }` (déclenchement manuel).
Cron 03h00 Europe/Paris — voir `a3.scheduler`.

Pour chaque zone active de `zones_couvertes` :
  1. Interroger ADEME pour les DPE des 62 derniers jours (fenêtre depuis config)
  2. Filtrer + normaliser (voir §5 de la spec)
  3. Présélectionner les annonces candidates (vente puis location, tolérance surface)
  4. Scorer via `matching.score_annonce_vs_dpe`
  5. Décision (deja_en_vente / location_recente / opportunite / filtre)
  6. Facteurs d'honnêteté (fraîcheur, couverture, location)
  7. Écriture opportunites + rapprochements
  8. Enrichissement cadastre (bloquant, cache) + Géorisques (tâche de fond)
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

from a2.config import get_config
from a2.tz import now_utc_iso, to_paris
from a3.matching import score_annonce_vs_dpe
from a3.quartiers import label_to_quartier, point_to_quartier
from a3.sources.ademe import fetch_dpe_recents, get_schema
from a3.sources.ban import geocode
from a3.sources.cadastre import get_or_fetch_parcelle
from a3.sources.georisques import get_or_fetch_by_parcelle
from a3.text import normalize_ges_class, normalize_type_bien_dpe, normalize_voie

logger = logging.getLogger(__name__)

# Numéro de rue au début d'une adresse : « 43 », « 190B », « 2 bis », « 4-6 »
# ⚠️ [a-z]? doit être collé aux chiffres (« 190B ») et ne PAS avaler la lettre
# initiale du type de voie (« R » de « Rue Legendre »).
_NUM_PREFIX_RE = re.compile(
    r"^\s*\d+(?:[a-z](?=\s))?(?:\s+(?:bis|ter|quater))?\s*[-,]?\s+", re.I
)
# Fin d'adresse : «  75017 Paris » ou virgule + code postal
_CP_TAIL_RE = re.compile(r"\s*[,\s]\s*\d{5}\b.*$")


def _extract_voie_from_adresse(adresse: Optional[str]) -> Optional[str]:
    """Extrait la voie depuis un champ `adresse` type « 43 Rue Legendre 75017 Paris ».

    Retourne None si non extractible. Le nom retourné n'est PAS encore normalisé
    (on laisse `normalize_voie()` s'en charger, comme pour les rues d'annonces).
    """
    if not adresse:
        return None
    s = str(adresse).strip()
    # Coupe le code postal + ville en queue
    s = _CP_TAIL_RE.sub("", s)
    # Retire le numéro en tête
    s = _NUM_PREFIX_RE.sub("", s)
    s = s.strip(" ,-")
    return s or None

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_KEY = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()


def _sb_headers() -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


async def _fetch_candidates(
    client: httpx.AsyncClient, code_postal: str, transaction: str,
    type_norm: str, surface_dpe: float,
    tolerance_pct: float, tolerance_plancher: float,
) -> list[dict]:
    """Sélectionne les annonces actives dont surface ∈ [dpe-tol, dpe+tol]."""
    tol = max(tolerance_plancher, surface_dpe * tolerance_pct)
    # Supabase.listings.surface est INTEGER — on arrondit les bornes.
    smin = int(surface_dpe - tol)
    smax = int(surface_dpe + tol) + 1
    params = {
        "select": ("id,portal,title,description,price,surface,rooms,city,postal_code,"
                   "rue_extraite,etage_extrait,floor,energy_class,type_normalise,url,"
                   "thumbnail_url,last_seen_at,district,price_per_m2,latitude,longitude"),
        "postal_code": f"eq.{code_postal}",
        "transaction": f"eq.{transaction}",
        "type_normalise": f"eq.{type_norm}",
        "est_logement": "eq.true",
        "is_active": "eq.true",
        "surface": f"gte.{smin}",
        "limit": "500",
    }
    r = await client.get(
        f"{SUPABASE_URL}/rest/v1/listings",
        params=[*params.items(), ("surface", f"lte.{smax}")],
        headers=_sb_headers(), timeout=30,
    )
    if r.status_code != 200:
        logger.warning(f"a3.fetch_candidates HTTP {r.status_code}: {r.text[:200]}")
        return []
    return r.json() or []


# ---------------------------------------------------------------------------
# Prix médian local (500 m, 24 mois, même type_local) — signal `s_geo`.
# Mise en cache par (lat_100m, lng_100m, type) sur la durée d'un run pour
# éviter de rappeler Supabase à chaque couple DPE-annonce.
# ---------------------------------------------------------------------------
import math
from statistics import median as _stat_median

_EARTH_R_M = 6371000.0


def _round_100m(lat: Optional[float], lng: Optional[float]) -> Optional[tuple[float, float]]:
    """Arrondit un couple lat/lng à la centaine de mètres la plus proche.
    En latitude, 0.001° ≈ 111 m. On garde 3 décimales — suffisant pour du cache."""
    if lat is None or lng is None:
        return None
    try:
        return round(float(lat), 3), round(float(lng), 3)
    except (TypeError, ValueError):
        return None


def _bbox_500m(lat: float, lng: float, radius_m: float = 500.0) -> tuple[float, float, float, float]:
    d_lat = (radius_m / _EARTH_R_M) * (180.0 / math.pi)
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)
    d_lng = (radius_m / (_EARTH_R_M * cos_lat)) * (180.0 / math.pi)
    return lat - d_lat, lat + d_lat, lng - d_lng, lng + d_lng


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * _EARTH_R_M * math.asin(math.sqrt(a))


_TYPE_TO_TYPE_LOCAL = {"appartement": "Appartement", "maison": "Maison"}


async def _fetch_median_local_m2(
    client: httpx.AsyncClient,
    lat: float,
    lng: float,
    type_norm: str,
    cache: dict[tuple, Optional[float]],
) -> Optional[float]:
    """Médiane du prix/m² dans un rayon de 500 m sur 24 mois, même type_local.

    `cache` est un dict passé par l'appelant et rempli au fil du run pour
    ne pas rappeler Supabase à chaque couple DPE-annonce.
    """
    type_local = _TYPE_TO_TYPE_LOCAL.get(type_norm)
    if not type_local:
        return None
    key100 = _round_100m(lat, lng)
    if key100 is None:
        return None
    cache_key = (key100[0], key100[1], type_local)
    if cache_key in cache:
        return cache[cache_key]

    since_iso = (datetime.now(timezone.utc) - timedelta(days=365 * 2)).date().isoformat()
    lat_min, lat_max, lng_min, lng_max = _bbox_500m(lat, lng, 500.0)
    params = [
        ("select", "prix_m2,latitude,longitude"),
        ("type_local", f"eq.{type_local}"),
        ("date_mutation", f"gte.{since_iso}"),
        ("latitude", f"gte.{lat_min}"),
        ("latitude", f"lte.{lat_max}"),
        ("longitude", f"gte.{lng_min}"),
        ("longitude", f"lte.{lng_max}"),
        ("prix_m2", "not.is.null"),
        ("limit", "500"),
    ]
    try:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/mutations_propres",
            params=params, headers=_sb_headers(), timeout=15,
        )
    except Exception as e:
        logger.warning(f"a3.fetch_median_local_m2: supabase error {e}")
        cache[cache_key] = None
        return None
    if r.status_code != 200:
        logger.warning(f"a3.fetch_median_local_m2 HTTP {r.status_code}: {r.text[:200]}")
        cache[cache_key] = None
        return None
    values: list[float] = []
    for row in r.json() or []:
        try:
            rlat = float(row.get("latitude"))
            rlng = float(row.get("longitude"))
            if _haversine_m(lat, lng, rlat, rlng) > 500.0:
                continue
            v = float(row.get("prix_m2"))
            if v > 0:
                values.append(v)
        except (TypeError, ValueError):
            continue
    if not values:
        cache[cache_key] = None
        return None
    med = round(_stat_median(values))
    cache[cache_key] = med
    return med


async def _get_zone_scraping_state(db, cp: str, client: httpx.AsyncClient) -> dict[str, Any]:
    """Retourne les métadonnées de scraping pour un CP (fraîcheur, volume actif).

    `last_active_count` est optionnel dans A1 ; s'il manque, on interroge
    directement Supabase pour compter les annonces actives du CP.
    """
    now = datetime.now(timezone.utc)
    docs = [d async for d in db.zones_scraping.find({"postal_code": cp})]
    if not docs:
        return {"days_since_scrape": 999, "active_count": 0, "days_since_location": 999}
    latest = max(
        (d for d in docs if d.get("last_ingest_at")),
        key=lambda d: d["last_ingest_at"],
        default=None,
    )
    days = 999
    if latest and latest.get("last_ingest_at"):
        try:
            dt = datetime.fromisoformat(latest["last_ingest_at"].replace("Z", "+00:00"))
            days = (now - dt).days
        except Exception:
            pass

    # `last_active_count` optionnel — fallback via Supabase (source de vérité)
    total_active = sum(int(d.get("last_active_count", 0) or 0) for d in docs)
    if total_active <= 0 and SUPABASE_URL and SUPABASE_KEY:
        try:
            r = await client.get(
                f"{SUPABASE_URL}/rest/v1/listings",
                params={
                    "select": "id",
                    "postal_code": f"eq.{cp}",
                    "is_active": "eq.true",
                    "est_logement": "eq.true",
                    "limit": "1",
                },
                headers={
                    **_sb_headers(),
                    "Prefer": "count=exact",
                    "Range": "0-0",
                },
                timeout=10,
            )
            cr = r.headers.get("content-range", "")
            if "/" in cr:
                try:
                    total_active = int(cr.split("/")[-1])
                except (ValueError, IndexError):
                    total_active = 0
        except Exception as e:
            logger.warning(f"a3._get_zone_scraping_state: supabase fallback failed: {e}")

    return {"days_since_scrape": days, "active_count": total_active,
            "days_since_location": days}


def _facteur_fraicheur(days: int, cfg: dict) -> float:
    fr = cfg.get("fraicheur") or {}
    plein = int(fr.get("jours_plein", 3))
    degrade = int(fr.get("jours_degrade", 7))
    if days <= plein:
        return 1.0
    if days <= degrade:
        return 0.7
    return 0.0


def _facteur_couverture(active_count: int, zone_doc: Optional[dict]) -> float:
    if not zone_doc:
        return 1.0
    vol = int(zone_doc.get("volume_attendu") or 0)
    if vol <= 0:
        return 1.0
    return min(1.0, float(active_count) / float(vol))


def _facteur_location(days_since_location: int, cfg: dict) -> float:
    fr = cfg.get("fraicheur") or {}
    if days_since_location <= int(fr.get("jours_degrade", 7)):
        return 1.0
    return float(cfg.get("facteur_location_perime", 0.85))


_ETAGE_COMPLEMENT_RE = re.compile(r"\b(?:etage|étage)\s*(\d{1,2})\b|\b(rdc|rez\s*-?\s*de\s*-?\s*chauss[eé]e)\b", re.I)


def _etage_dpe_from_complement(complement: Optional[str]) -> Optional[int]:
    if not complement:
        return None
    m = _ETAGE_COMPLEMENT_RE.search(str(complement))
    if not m:
        return None
    if m.group(1):
        try:
            return int(m.group(1))
        except ValueError:
            return None
    if m.group(2):
        return 0
    return None


async def _dpe_already_processed(db, dpe_id: str, destinataire: dict) -> bool:
    """Un DPE déjà transformé en opportunité pour ce destinataire, OU dont
    l'adresse a donné lieu à un statut abandon/ignoree/deja_en_vente_signale
    → filtré."""
    if not dpe_id:
        return False
    q: dict = {"dpe_id": dpe_id}
    if destinataire.get("organisation_id"):
        q["organisation_id"] = destinataire["organisation_id"]
    elif destinataire.get("user_id"):
        q["user_id"] = destinataire["user_id"]
    doc = await db.opportunites.find_one(q)
    if doc:
        return True
    # Blacklist statut
    q2: dict = {"dpe_id": dpe_id, "statut": {"$in": ["abandon", "ignoree", "deja_en_vente_signale"]}}
    if destinataire.get("organisation_id"):
        q2["organisation_id"] = destinataire["organisation_id"]
    elif destinataire.get("user_id"):
        q2["user_id"] = destinataire["user_id"]
    return bool(await db.opportunites.find_one(q2))


async def _log_rapprochement(db, doc: dict) -> None:
    await db.rapprochements.insert_one({
        **doc,
        "date_traitement": now_utc_iso(),
    })


def _motif_opportunite(dpe: dict, active_count: int, sources: list[str]) -> str:
    try:
        date_iso = dpe.get("date_etablissement") or ""
        d = datetime.fromisoformat(date_iso[:19].replace("Z", ""))
        jours = max(0, (datetime.utcnow() - d).days)
    except Exception:
        jours = 0
    return (
        f"DPE réalisé il y a {jours} jour{'s' if jours > 1 else ''}, "
        f"aucune annonce détectée sur {len(sources)} portail{'s' if len(sources) > 1 else ''} "
        f"({active_count} annonces actives dans la zone)"
    )


async def _create_opportunite(
    db, client: httpx.AsyncClient, dpe: dict, score_confiance: float,
    active_count: int, sources: list[str], destinataire: dict,
) -> Optional[str]:
    """Crée l'opportunité + enrichit cadastre (bloquant) + Géorisques (fire&forget)."""
    lat = dpe.get("latitude")
    lng = dpe.get("longitude")
    # Géocode si manquant
    if lat is None or lng is None:
        adresse = dpe.get("adresse") or dpe.get("_raw", {}).get("adresse_ban") or ""
        geo = await geocode(client, adresse, dpe.get("code_postal"))
        if not geo:
            return None
        lat, lng = geo["lat"], geo["lng"]

    # Cadastre (bloquant, cache 6 mois)
    parcelle = await get_or_fetch_parcelle(db, client, lat, lng)
    id_parcelle = (parcelle or {}).get("id_parcelle")

    doc = {
        "organisation_id": destinataire.get("organisation_id"),
        "user_id": destinataire.get("user_id"),
        "assigne_a": None,
        "dpe_id": dpe.get("numero_dpe"),
        "code_postal": dpe.get("code_postal"),
        "adresse": dpe.get("adresse"),
        "complement_adresse": dpe.get("complement_adresse"),
        "lat": lat, "lng": lng,
        "id_parcelle": id_parcelle,
        "caracteristiques": dpe,
        "score_confiance": round(float(score_confiance), 4),
        "motif_opportunite": _motif_opportunite(dpe, active_count, sources),
        "date_creation": now_utc_iso(),
        "date_attribution": None,
        "statut": "pool",
        "date_dernier_statut": now_utc_iso(),
    }
    try:
        res = await db.opportunites.insert_one(doc)
        opp_id = str(res.inserted_id)
    except Exception as e:
        logger.info(f"a3.create_opportunite: skip (already exists?) {e}")
        return None

    # Géorisques en tâche de fond (aucun blocage)
    if id_parcelle:
        asyncio.create_task(get_or_fetch_by_parcelle(db, client, id_parcelle, lat, lng))
    return opp_id


async def _fetch_zone_district_stats(
    client: httpx.AsyncClient, cp: str,
) -> dict:
    """Récupère les listings actifs de la zone et calcule :
      - `district_fill_rate` : ratio annonces avec district non-vide.
      - `quartier_repartition` : compteur par slug de quartier admin, avec
        une clé spéciale `_inconnu` pour les libellés non mappés et
        `_absent` pour les districts vides.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {}
    try:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/listings",
            params={
                "select": "district",
                "postal_code": f"eq.{cp}",
                "is_active": "eq.true",
                "est_logement": "eq.true",
                "limit": "5000",
            },
            headers=_sb_headers(), timeout=20,
        )
    except Exception as e:
        logger.warning(f"a3._fetch_zone_district_stats: {e}")
        return {}
    if r.status_code != 200:
        return {}
    rows = r.json() or []
    total = len(rows)
    if total == 0:
        return {"district_fill_rate": 0.0, "active_listings": 0, "quartier_repartition": {}}
    filled = 0
    rep: dict[str, int] = {}
    for row in rows:
        d = (row.get("district") or "").strip()
        if not d:
            rep["_absent"] = rep.get("_absent", 0) + 1
            continue
        filled += 1
        slug, unknown = label_to_quartier(d)
        if slug:
            rep[slug] = rep.get(slug, 0) + 1
        elif unknown:
            rep["_inconnu"] = rep.get("_inconnu", 0) + 1
    return {
        "active_listings": total,
        "district_fill_rate": round(filled / total, 4),
        "quartier_repartition": rep,
    }


async def _process_zone(
    db, client: httpx.AsyncClient, cp: str, cfg: dict, destinataire: dict,
) -> dict:
    """Traite une zone. Retourne un rapport."""
    zone_doc = await db.zones_couvertes.find_one({"code_postal": cp})
    zone_state = await _get_zone_scraping_state(db, cp, client)

    f_fraicheur = _facteur_fraicheur(zone_state["days_since_scrape"], cfg)
    if f_fraicheur == 0.0:
        return {"cp": cp, "skipped": "fraicheur_trop_ancienne", "days": zone_state["days_since_scrape"]}
    f_couverture = _facteur_couverture(zone_state["active_count"], zone_doc)
    f_location = _facteur_location(zone_state["days_since_location"], cfg)

    fenetre = int(cfg.get("fenetre_dpe_jours", 62))
    date_min = (datetime.utcnow() - timedelta(days=fenetre)).strftime("%Y-%m-%d")
    dpes = await fetch_dpe_recents(client, cp, date_min)
    if not dpes:
        return {"cp": cp, "dpes": 0, "note": "no_dpe_from_ademe"}

    # Résout le schéma une fois pour extraire les champs canoniques déjà mappés
    tolerance_pct = float(cfg.get("tolerance_surface_pct", 0.08))
    tolerance_plancher = float(cfg.get("tolerance_surface_plancher_m2", 4))
    seuil_v = float(cfg.get("seuil_correspondance", 0.75))
    seuil_l = float(cfg.get("seuil_correspondance_location", 0.80))
    seuil_pub = float(cfg.get("seuil_publication", 0.70))
    s_rue_null = float(cfg.get("s_rue_defaut_null", 0.5))
    poids = cfg.get("poids") or {}

    stats = {
        "cp": cp, "dpes": len(dpes),
        "filtre": 0, "deja_en_vente": 0, "location_recente": 0, "opportunite": 0,
        "created": 0, "motifs": {},
        "score_confiance_sum": 0.0,
        "rue_dpe_via_nom_voie": 0,
        "rue_dpe_via_adresse": 0,
        "rue_dpe_null": 0,
        "court_circuits": {
            "rue_differente": 0, "quartier_non_limitrophe": 0, "prix_m2_incoherent": 0,
        },
        "libelles_district_inconnus": [],
    }

    seen_addresses: dict[str, dict] = {}  # dedup DPE
    _libelles_inconnus_set: set[str] = set()
    _median_cache: dict[tuple, Optional[float]] = {}

    for dpe_raw in dpes:
        dpe = dict(dpe_raw)
        # Normalisations
        type_norm = normalize_type_bien_dpe(dpe.get("type_batiment"))
        dpe["type_batiment_norm"] = type_norm
        dpe["classe_dpe"] = normalize_ges_class(dpe.get("classe_dpe"))
        # `nom_voie` prioritaire ; fallback depuis `adresse` si vide
        voie_raw = dpe.get("nom_voie") or ""
        if voie_raw and normalize_voie(voie_raw):
            dpe["nom_voie"] = normalize_voie(voie_raw)
            stats["rue_dpe_via_nom_voie"] += 1
        else:
            fallback = _extract_voie_from_adresse(dpe.get("adresse"))
            dpe["nom_voie"] = normalize_voie(fallback) if fallback else None
            if dpe["nom_voie"]:
                stats["rue_dpe_via_adresse"] += 1
            else:
                stats["rue_dpe_null"] += 1
        dpe["etage_dpe"] = _etage_dpe_from_complement(dpe.get("complement_adresse"))
        surface_dpe = dpe.get("surface_habitable")
        try:
            surface_dpe = float(surface_dpe) if surface_dpe not in (None, "") else None
        except (TypeError, ValueError):
            surface_dpe = None
        dpe["surface_habitable"] = surface_dpe

        motif_filtre: Optional[str] = None
        if type_norm == "immeuble":
            motif_filtre = "type_immeuble"
        elif not surface_dpe or surface_dpe < 8:
            motif_filtre = "surface_invalide"
        elif not dpe.get("code_postal"):
            motif_filtre = "cp_manquant"
        elif type_norm == "autre":
            motif_filtre = "type_non_logement"

        # Dédup DPE : même adresse + même surface → keep most recent
        if not motif_filtre:
            adr_key = f"{(dpe.get('adresse') or '').strip().lower()}|{surface_dpe}"
            if adr_key in seen_addresses:
                # DPEs already sorted desc by date via ADEME query → celui-ci est plus ancien
                motif_filtre = "doublon_dpe_plus_recent_existe"
            else:
                seen_addresses[adr_key] = dpe

        # Vérifie déjà traité
        if not motif_filtre and dpe.get("numero_dpe"):
            if await _dpe_already_processed(db, dpe["numero_dpe"], destinataire):
                motif_filtre = "dpe_deja_traite_ou_ecarte"

        if motif_filtre:
            stats["filtre"] += 1
            stats["motifs"][motif_filtre] = stats["motifs"].get(motif_filtre, 0) + 1
            await _log_rapprochement(db, {
                "dpe_id": dpe.get("numero_dpe"), "code_postal": cp,
                "decision": "filtre", "motif_filtre": motif_filtre,
                "rue_dpe": dpe.get("nom_voie"),
            })
            continue

        # Présélection annonces vente & location
        cand_v = await _fetch_candidates(
            client, cp, "vente", type_norm, surface_dpe,
            tolerance_pct, tolerance_plancher,
        )
        cand_l = await _fetch_candidates(
            client, cp, "location", type_norm, surface_dpe,
            tolerance_pct, tolerance_plancher,
        )

        # --- s_geo : quartier admin du DPE (via lat/lng BAN, une fois) -----
        dpe_lat, dpe_lng = dpe.get("latitude"), dpe.get("longitude")
        quartier_dpe = point_to_quartier(dpe_lat, dpe_lng)

        async def _score_and_track(ann: dict) -> dict:
            """Résout quartier annonce + prix médian local, puis score.
            Journalise motif_court_circuit dans rapprochements pour les cas
            qui écartent l'annonce des candidates.
            """
            q_ann, is_unknown = label_to_quartier(ann.get("district"))
            if is_unknown:
                lbl = (ann.get("district") or "").strip()
                if lbl and lbl not in _libelles_inconnus_set:
                    _libelles_inconnus_set.add(lbl)
                    stats["libelles_district_inconnus"].append(lbl)
            # Prix médian local autour du DPE (cache par 100m + type)
            median_m2: Optional[float] = None
            if dpe_lat is not None and dpe_lng is not None:
                try:
                    median_m2 = await _fetch_median_local_m2(
                        client, float(dpe_lat), float(dpe_lng), type_norm, _median_cache,
                    )
                except (TypeError, ValueError):
                    median_m2 = None
            res = score_annonce_vs_dpe(
                ann, dpe, poids, tolerance_pct, tolerance_plancher,
                s_rue_defaut_null=s_rue_null,
                quartier_dpe=quartier_dpe,
                quartier_annonce=q_ann,
                prix_median_local_m2=median_m2,
            )
            motif_cc = res.get("motif_court_circuit")
            if motif_cc in stats["court_circuits"]:
                stats["court_circuits"][motif_cc] += 1
                # Journal léger — permet à l'audit de retrouver l'annonce écartée
                await _log_rapprochement(db, {
                    "dpe_id": dpe.get("numero_dpe"), "code_postal": cp,
                    "adresse_dpe": dpe.get("adresse"),
                    "decision": "candidate_ecartee",
                    "motif_court_circuit": motif_cc,
                    "listing_id_ecarte": str(ann.get("id")) if ann.get("id") is not None else None,
                    "rue_dpe": dpe.get("nom_voie"),
                    "rue_annonce": ann.get("rue_extraite"),
                    "quartier_dpe": quartier_dpe,
                    "quartier_annonce": q_ann,
                    "price_per_m2_annonce": ann.get("price_per_m2"),
                    "prix_median_local_m2": median_m2,
                })
            return res

        best_v_score = 0.0
        best_v_annonce: Optional[dict] = None
        best_v_breakdown: Optional[dict] = None
        for ann in cand_v:
            r = await _score_and_track(ann)
            if r["score"] > best_v_score:
                best_v_score = r["score"]
                best_v_annonce = ann
                best_v_breakdown = r["breakdown"]

        best_l_score = 0.0
        for ann in cand_l:
            r = await _score_and_track(ann)
            if r["score"] > best_l_score:
                best_l_score = r["score"]

        if best_v_score >= seuil_v:
            stats["deja_en_vente"] += 1
            await _log_rapprochement(db, {
                "dpe_id": dpe.get("numero_dpe"), "code_postal": cp,
                "adresse_dpe": dpe.get("adresse"),
                "surface_dpe": dpe.get("surface_habitable"),
                "classe_dpe": dpe.get("classe_dpe"),
                "decision": "deja_en_vente",
                "nb_candidates_vente": len(cand_v), "nb_candidates_location": len(cand_l),
                "meilleur_score_vente": best_v_score, "meilleur_score_location": best_l_score,
                "listing_id_retenu": str((best_v_annonce or {}).get("id")) if best_v_annonce else None,
                "rue_dpe": dpe.get("nom_voie"),
                "rue_annonce_retenue": (best_v_annonce or {}).get("rue_extraite"),
                "breakdown": best_v_breakdown,
                "score_confiance": None,
            })
            continue

        if best_l_score >= seuil_l:
            stats["location_recente"] += 1
            await _log_rapprochement(db, {
                "dpe_id": dpe.get("numero_dpe"), "code_postal": cp,
                "decision": "location_recente",
                "nb_candidates_vente": len(cand_v), "nb_candidates_location": len(cand_l),
                "meilleur_score_vente": best_v_score, "meilleur_score_location": best_l_score,
                "rue_dpe": dpe.get("nom_voie"),
                "score_confiance": None,
            })
            continue

        # Opportunité candidate
        score_confiance = (1.0 - best_v_score) * f_couverture * f_fraicheur * f_location
        if score_confiance < seuil_pub:
            stats["filtre"] += 1
            motif = "score_confiance_sous_seuil"
            stats["motifs"][motif] = stats["motifs"].get(motif, 0) + 1
            await _log_rapprochement(db, {
                "dpe_id": dpe.get("numero_dpe"), "code_postal": cp,
                "adresse_dpe": dpe.get("adresse"),
                "surface_dpe": dpe.get("surface_habitable"),
                "classe_dpe": dpe.get("classe_dpe"),
                "decision": "filtre", "motif_filtre": motif,
                "nb_candidates_vente": len(cand_v), "nb_candidates_location": len(cand_l),
                "meilleur_score_vente": best_v_score, "meilleur_score_location": best_l_score,
                "listing_id_retenu": str((best_v_annonce or {}).get("id")) if best_v_annonce else None,
                "rue_dpe": dpe.get("nom_voie"),
                "rue_annonce_retenue": (best_v_annonce or {}).get("rue_extraite"),
                "breakdown": best_v_breakdown,
                "score_confiance": round(score_confiance, 4),
            })
            continue

        # Création
        sources = sorted({(c.get("portal") or "").lower() for c in (cand_v + cand_l) if c.get("portal")})
        opp_id = await _create_opportunite(
            db, client, dpe, score_confiance,
            active_count=zone_state["active_count"], sources=sources,
            destinataire=destinataire,
        )
        stats["opportunite"] += 1
        if opp_id:
            stats["created"] += 1
            stats["score_confiance_sum"] += score_confiance
        await _log_rapprochement(db, {
            "dpe_id": dpe.get("numero_dpe"), "code_postal": cp,
            "decision": "opportunite",
            "nb_candidates_vente": len(cand_v), "nb_candidates_location": len(cand_l),
            "meilleur_score_vente": best_v_score, "meilleur_score_location": best_l_score,
            "rue_dpe": dpe.get("nom_voie"),
            "score_confiance": round(score_confiance, 4),
        })

    if stats["opportunite"] > 0:
        stats["score_confiance_moyen"] = round(stats["score_confiance_sum"] / stats["opportunite"], 4)
    stats.pop("score_confiance_sum", None)
    stats["facteurs"] = {
        "fraicheur": f_fraicheur, "couverture": f_couverture, "location": f_location,
    }
    # Stats zone : taux de remplissage district + répartition quartier admin
    try:
        zone_stats = await _fetch_zone_district_stats(client, cp)
        stats.update(zone_stats)
    except Exception as e:
        logger.warning(f"a3._fetch_zone_district_stats failed for {cp}: {e}")
    return stats


async def run_generer_opportunites(
    db, code_postal: Optional[str] = None,
    destinataire: Optional[dict] = None,
) -> dict:
    """Point d'entrée du job. Retourne rapport par CP."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {"error": "supabase_env_missing"}
    if destinataire is None:
        # Pool global — pas de destinataire → visible par tous
        destinataire = {"organisation_id": None, "user_id": None}

    cfg = await get_config(db)
    async with httpx.AsyncClient() as client:
        await get_schema(client)  # warm ademe schema
        if code_postal:
            cps = [code_postal]
        else:
            cps = [z["code_postal"] async for z in db.zones_couvertes.find(
                {"actif": True}, {"code_postal": 1}
            )]
        cps = [c for c in cps if c]

        by_cp: list[dict] = []
        for cp in cps:
            report = await _process_zone(db, client, cp, cfg, destinataire)
            by_cp.append(report)
    return {
        "cps_processed": len(by_cp),
        "run_at": now_utc_iso(),
        "run_at_paris": to_paris(datetime.now(timezone.utc)).isoformat(),
        "by_cp": by_cp,
    }
