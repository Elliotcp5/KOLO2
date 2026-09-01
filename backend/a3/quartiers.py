"""KOLO A3 — Quartiers administratifs de Paris.

Fournit :
  - `point_to_quartier(lat, lng)` : détermine le quartier admin d'un point
    (ray-casting sur le geojson officiel Ville de Paris — 80 quartiers).
  - `label_to_quartier(district)`  : mappe un libellé commercial de portail
    (« Ternes-Maillot », « Prony / Parc Monceau »…) vers un slug de quartier
    admin. Retourne `(None, is_unknown=True)` pour tout libellé non reconnu,
    et journalise le libellé pour audit ultérieur.
  - `adjacency_score(slug_a, slug_b)` : 1.0 même quartier, 0.6 limitrophes,
    0.0 non-limitrophes, 0.5 si l'un des deux est absent (None).

L'adjacence est calculée automatiquement au 1er appel : deux quartiers sont
adjacents s'ils partagent au moins 2 sommets exacts sur leurs polygones.
Vérifié sur le 17e — Ternes/Plaine/Batignolles/Épinettes — ne détecte que
les vraies adjacences (cas A15 : Épinettes vs Plaine de Monceaux = 0).
"""
from __future__ import annotations

import json
import logging
import os
import re
import unicodedata
from threading import Lock
from typing import Optional

logger = logging.getLogger(__name__)

_DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "quartiers_paris.geojson")

_LOAD_LOCK = Lock()
_FEATURES: Optional[list[dict]] = None       # [{slug, l_qu, c_ar, bbox, coords}]
_ADJACENCY: Optional[dict[str, set[str]]] = None
_UNKNOWN_LABELS_SEEN: set[str] = set()


# ---------------------------------------------------------------------------
# Table de correspondance : libellés commerciaux (portails) → slug quartier
# admin. Volontairement en dur, incrémentable au fil des libellés observés.
# Toute clé absente est journalisée par `label_to_quartier` et compte comme
# "district absent" côté matching (score 0.5, pas de court-circuit).
# ---------------------------------------------------------------------------
LABEL_TO_QUARTIER: dict[str, str] = {
    # ---- 17e arrondissement ---------------------------------------------
    # Ternes
    "ternes": "ternes",
    "ternes-maillot": "ternes",
    "ternes maillot": "ternes",
    "ternes - maillot": "ternes",
    "champerret-berthier": "ternes",
    "champerret berthier": "ternes",
    "champerret - berthier": "ternes",
    "champerret": "ternes",
    "porte maillot": "ternes",
    # Plaine de Monceaux
    "plaine de monceaux": "plaine-de-monceaux",
    "plaine-de-monceaux": "plaine-de-monceaux",
    "pereire-malesherbes": "plaine-de-monceaux",
    "pereire malesherbes": "plaine-de-monceaux",
    "pereire": "plaine-de-monceaux",
    "courcelles-wagram": "plaine-de-monceaux",
    "courcelles wagram": "plaine-de-monceaux",
    "courcelles - wagram": "plaine-de-monceaux",
    "courcelles": "plaine-de-monceaux",
    "wagram": "plaine-de-monceaux",
    "prony / parc monceau": "plaine-de-monceaux",
    "prony/parc monceau": "plaine-de-monceaux",
    "prony parc monceau": "plaine-de-monceaux",
    "prony": "plaine-de-monceaux",
    "parc monceau": "plaine-de-monceaux",
    "monceau": "plaine-de-monceaux",
    "malesherbes": "plaine-de-monceaux",
    # Batignolles
    "batignolles": "batignolles",
    "batignolles-cardinet": "batignolles",
    "batignolles cardinet": "batignolles",
    "batignolles - cardinet": "batignolles",
    "cardinet": "batignolles",
    "clichy batignolles": "batignolles",
    "clichy-batignolles": "batignolles",
    "legendre - levis": "batignolles",
    "legendre levis": "batignolles",
    "legendre-levis": "batignolles",
    "porte de clichy": "batignolles",
    # Épinettes
    "epinettes": "epinettes",
    "épinettes": "epinettes",
    "guy moquet": "epinettes",
    "guy môquet": "epinettes",
    "guy-moquet": "epinettes",
    "guy-môquet": "epinettes",
    "la fourche - guy moquet": "epinettes",
    "la fourche guy moquet": "epinettes",
    "epinettes - bessieres": "epinettes",
    "epinettes bessieres": "epinettes",
    "porte de saint-ouen": "epinettes",
    "porte de saint ouen": "epinettes",
    # ---- LYON (arrondissements) — pas de point-in-polygon, seul le libellé
    # sert de discriminant. Les DPE hors Paris tombent en `s_geo=0.5`
    # (neutre), le multiplicateur reste à 1.0.
    "lyon 1er": "lyon-1",
    "lyon 1": "lyon-1",
    "1er arrondissement lyon": "lyon-1",
    "lyon 2eme": "lyon-2",
    "lyon 2e": "lyon-2",
    "lyon 2": "lyon-2",
    "lyon 3eme": "lyon-3",
    "lyon 3e": "lyon-3",
    "lyon 3": "lyon-3",
    "lyon 4eme": "lyon-4",
    "lyon 4e": "lyon-4",
    "lyon 4": "lyon-4",
    "croix-rousse": "lyon-4",
    "croix rousse": "lyon-4",
    "lyon 5eme": "lyon-5",
    "lyon 5e": "lyon-5",
    "lyon 5": "lyon-5",
    "vieux lyon": "lyon-5",
    "lyon 6eme": "lyon-6",
    "lyon 6e": "lyon-6",
    "lyon 6": "lyon-6",
    "brotteaux": "lyon-6",
    "foch": "lyon-6",
    "tete d or": "lyon-6",
    "tete-d-or": "lyon-6",
    "lyon 7eme": "lyon-7",
    "lyon 7e": "lyon-7",
    "lyon 7": "lyon-7",
    "guillotiere": "lyon-7",
    "la guillotiere": "lyon-7",
    "la-guillotiere": "lyon-7",
    "la guillotiere nord": "lyon-3",
    "la-guillotiere-nord": "lyon-3",
    "guillotiere nord": "lyon-3",
    "part-dieu": "lyon-3",
    "part dieu": "lyon-3",
    "jean mace": "lyon-7",
    "lyon 8eme": "lyon-8",
    "lyon 8e": "lyon-8",
    "lyon 8": "lyon-8",
    "montplaisir": "lyon-8",
    "monplaisir": "lyon-8",
    "monchat": "lyon-8",
    "lyon 9eme": "lyon-9",
    "lyon 9e": "lyon-9",
    "lyon 9": "lyon-9",
    "vaise": "lyon-9",
    # ---- MARSEILLE (arrondissements 1-16) ----
    "marseille 1er": "marseille-1",
    "marseille 1": "marseille-1",
    "marseille 2eme": "marseille-2",
    "marseille 2": "marseille-2",
    "marseille 3eme": "marseille-3",
    "marseille 3": "marseille-3",
    "marseille 4eme": "marseille-4",
    "marseille 4": "marseille-4",
    "marseille 5eme": "marseille-5",
    "marseille 5": "marseille-5",
    "marseille 6eme": "marseille-6",
    "marseille 6": "marseille-6",
    "marseille 7eme": "marseille-7",
    "marseille 7": "marseille-7",
    "marseille 8eme": "marseille-8",
    "marseille 8": "marseille-8",
    "prado": "marseille-8",
    "perier": "marseille-8",
    "bagatelle": "marseille-8",
    "bonneveine": "marseille-8",
    "sainte-anne": "marseille-8",
    "sainte anne": "marseille-8",
    "carre d or": "marseille-8",
    "carre d'or": "marseille-8",
    "marseille 9eme": "marseille-9",
    "marseille 9": "marseille-9",
    "marseille 10eme": "marseille-10",
    "marseille 10": "marseille-10",
    "marseille 11eme": "marseille-11",
    "marseille 11": "marseille-11",
    "marseille 12eme": "marseille-12",
    "marseille 12": "marseille-12",
    "marseille 13eme": "marseille-13",
    "marseille 13": "marseille-13",
    "marseille 14eme": "marseille-14",
    "marseille 14": "marseille-14",
    "marseille 15eme": "marseille-15",
    "marseille 15": "marseille-15",
    "marseille 16eme": "marseille-16",
    "marseille 16": "marseille-16",
}


def _slugify(name: str) -> str:
    """« Plaine de Monceaux » -> « plaine-de-monceaux »."""
    if not name:
        return ""
    s = unicodedata.normalize("NFKD", str(name))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def _normalize_label(label: str) -> str:
    """Normalisation pour lookup :
      - lowercase + accents supprimés
      - retire les préfixes bruit portails : « paris 17e arrondissement - »,
        « paris 75017 », « paris 17e - », « 17e arrondissement - » …
      - retire un suffixe pareil (rare mais safe)
      - compacte les espaces
    """
    if not label:
        return ""
    s = unicodedata.normalize("NFKD", str(label))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().strip()
    s = re.sub(r"\s+", " ", s)
    # Retire les préfixes « paris [7501x|17e|17eme|17e arrondissement] [- ]* »
    # itérativement pour absorber les combinaisons.
    for _ in range(3):
        new = re.sub(
            r"^(?:paris\s+)?(?:\d{5}\s+)?(?:\d{1,2}(?:e|eme|er|ere)?\s+arrondissement)?\s*[-–—]?\s*",
            "",
            s,
        )
        if new == s:
            break
        s = new.strip()
    # Retire un « paris » ou un CP orphelin restant en tête
    s = re.sub(r"^(?:paris\s+)?(?:\d{5}\s+)?", "", s).strip()
    return s


_SLUG_TO_LIBELLE_CACHE: Optional[dict[str, str]] = None

# Libellés canoniques hors-Paris (pas dans le GeoJSON quartiers admin).
# `slug_to_libelle` retourne ces libellés pour permettre le round-trip
# `label_to_quartier(libelle) → slug` après backfill.
_SLUG_TO_LIBELLE_HORS_PARIS: dict[str, str] = {
    f"lyon-{i}": f"Lyon {i}{'er' if i == 1 else 'e'}" for i in range(1, 10)
}
_SLUG_TO_LIBELLE_HORS_PARIS.update({
    f"marseille-{i}": f"Marseille {i}{'er' if i == 1 else 'e'}"
    for i in range(1, 17)
})


def slug_to_libelle(slug: Optional[str]) -> Optional[str]:
    """Retourne le libellé officiel Ville de Paris pour un slug de quartier
    (`epinettes` → « Epinettes », `plaine-de-monceaux` → « Plaine de Monceaux »).
    Utile côté ingestion pour écrire un `district` humain lisible et
    directement re-mappable par `label_to_quartier`.
    """
    global _SLUG_TO_LIBELLE_CACHE
    if _SLUG_TO_LIBELLE_CACHE is None:
        feats = _load_features()
        _SLUG_TO_LIBELLE_CACHE = {f["slug"]: (f.get("l_qu") or f["slug"]) for f in feats}
        # Merge hors-Paris (Lyon, Marseille)
        for k, v in _SLUG_TO_LIBELLE_HORS_PARIS.items():
            _SLUG_TO_LIBELLE_CACHE.setdefault(k, v)
    if not slug:
        return None
    return _SLUG_TO_LIBELLE_CACHE.get(slug)


def _load_features() -> list[dict]:
    """Charge le geojson une seule fois. Retourne une liste allégée avec bbox."""
    global _FEATURES
    if _FEATURES is not None:
        return _FEATURES
    with _LOAD_LOCK:
        if _FEATURES is not None:
            return _FEATURES
        with open(_DATA_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        feats: list[dict] = []
        for f in data.get("features", []):
            props = f.get("properties") or {}
            geom = f.get("geometry") or {}
            if geom.get("type") != "Polygon":
                continue
            ring = geom["coordinates"][0]  # anneau extérieur, [lng, lat]
            xs = [c[0] for c in ring]
            ys = [c[1] for c in ring]
            feats.append({
                "slug": _slugify(props.get("l_qu") or ""),
                "l_qu": props.get("l_qu"),
                "c_ar": props.get("c_ar"),
                "ring": ring,
                "bbox": (min(xs), min(ys), max(xs), max(ys)),
            })
        _FEATURES = feats
        return _FEATURES


def _point_in_ring(lng: float, lat: float, ring: list[list[float]]) -> bool:
    """Ray casting classique. `ring` est une liste de [lng, lat]."""
    inside = False
    n = len(ring)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / (yj - yi + 1e-15) + xi
        ):
            inside = not inside
        j = i
    return inside


def point_to_quartier(lat: Optional[float], lng: Optional[float]) -> Optional[str]:
    """Retourne le slug du quartier admin contenant (lat, lng). None si hors Paris."""
    if lat is None or lng is None:
        return None
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return None
    for feat in _load_features():
        min_x, min_y, max_x, max_y = feat["bbox"]
        if lng < min_x or lng > max_x or lat < min_y or lat > max_y:
            continue
        if _point_in_ring(lng, lat, feat["ring"]):
            return feat["slug"]
    return None


def label_to_quartier(district: Optional[str]) -> tuple[Optional[str], bool]:
    """Mappe un libellé commercial vers un slug de quartier admin.

    Retourne `(slug, is_unknown)`.
      - `slug` = None si non reconnu (ou district vide).
      - `is_unknown` = True si le libellé est non-vide mais inconnu (à
        journaliser). False si le district est vide (absence légitime).
    """
    if not district:
        return None, False
    key = _normalize_label(district)
    if not key:
        return None, False
    slug = LABEL_TO_QUARTIER.get(key)
    if slug:
        return slug, False
    # Libellé non reconnu → log une fois par run
    if key not in _UNKNOWN_LABELS_SEEN:
        _UNKNOWN_LABELS_SEEN.add(key)
        logger.warning(f"quartiers.label_to_quartier: libellé inconnu {key!r}")
    return None, True


def _compute_adjacency() -> dict[str, set[str]]:
    """Deux quartiers sont adjacents s'ils partagent ≥ 2 sommets exacts.

    Vérifié sur le 17e : détecte Ternes↔Plaine, Plaine↔Batignolles,
    Batignolles↔Épinettes, et rejette bien Épinettes↔Plaine (cas A15).
    """
    global _ADJACENCY
    if _ADJACENCY is not None:
        return _ADJACENCY
    feats = _load_features()
    # Un set de sommets arrondis par quartier
    slugs: list[str] = []
    sets: list[set[tuple[float, float]]] = []
    for f in feats:
        slugs.append(f["slug"])
        sets.append({(round(c[0], 6), round(c[1], 6)) for c in f["ring"]})
    adj: dict[str, set[str]] = {s: set() for s in slugs}
    for i in range(len(slugs)):
        for j in range(i + 1, len(slugs)):
            if len(sets[i] & sets[j]) >= 2:
                adj[slugs[i]].add(slugs[j])
                adj[slugs[j]].add(slugs[i])
    _ADJACENCY = adj
    return _ADJACENCY


def adjacency_score(slug_a: Optional[str], slug_b: Optional[str]) -> float:
    """1.0 même quartier ; 0.6 limitrophes ; 0.0 non-limitrophes ; 0.5 si absent."""
    if not slug_a or not slug_b:
        return 0.5
    if slug_a == slug_b:
        return 1.0
    adj = _compute_adjacency()
    if slug_b in adj.get(slug_a, set()):
        return 0.6
    return 0.0
