"""
KOLO — Shared normalization helpers
====================================

Fonctions partagées utilisées à la fois par :
  - le webhook `POST /api/webhooks/apify` (Session A1)
  - le cron legacy `scripts/scrape_listings_cron.py`
  - `scripts/ingest_apify.py`

L'objectif est de garantir qu'AUCUNE ligne n'entre dans `listings` sans
`transaction`, `type_normalise` et `est_logement` remplis. Le moteur
d'opportunités (Session A3) s'appuiera sur ces trois colonnes.
"""
from __future__ import annotations

import re
from typing import Optional


# ==========================================================================
# 1. Type normalisé
# ==========================================================================
#
# Sortie possible :
#   appartement | maison | studio | loft | terrain | parking |
#   local_commercial | immeuble | bureau | autre
#
# `est_logement` = True SEULEMENT pour appartement, maison, studio, loft.
# ==========================================================================
_TYPE_MAP: dict[str, str] = {
    # Appartement
    "appartement": "appartement",
    "appart": "appartement",
    "appt": "appartement",
    "apt": "appartement",
    "flat": "appartement",
    "duplex": "appartement",
    "triplex": "appartement",
    "t1": "appartement", "t2": "appartement", "t3": "appartement",
    "t4": "appartement", "t5": "appartement", "t6": "appartement",
    "f1": "appartement", "f2": "appartement", "f3": "appartement",
    "f4": "appartement", "f5": "appartement", "f6": "appartement",
    "2pieces": "appartement", "3pieces": "appartement",
    "4pieces": "appartement", "5pieces": "appartement",
    # Studio
    "studio": "studio",
    "studette": "studio",
    "chambre": "studio",
    # Loft
    "loft": "loft",
    "atelier": "loft",
    # Maison
    "maison": "maison",
    "villa": "maison",
    "pavillon": "maison",
    "propriete": "maison",
    "propriété": "maison",
    "chalet": "maison",
    "longere": "maison",
    "longère": "maison",
    "fermette": "maison",
    "ferme": "maison",
    "mas": "maison",
    "bastide": "maison",
    "hoteldeparticulier": "maison",
    "hotelparticulier": "maison",
    "manoir": "maison",
    "chateau": "maison",
    "château": "maison",
    # Terrain
    "terrain": "terrain",
    "terrainaconstruire": "terrain",
    "terrainconstructible": "terrain",
    # Parking
    "parking": "parking",
    "garage": "parking",
    "box": "parking",
    "boxparking": "parking",
    "emplacement": "parking",
    "stationnement": "parking",
    # Local commercial
    "local": "local_commercial",
    "localcommercial": "local_commercial",
    "commerce": "local_commercial",
    "fonds": "local_commercial",
    "fondsdecommerce": "local_commercial",
    "boutique": "local_commercial",
    "restaurant": "local_commercial",
    "hotel": "local_commercial",
    "hôtel": "local_commercial",
    # Bureaux
    "bureau": "bureau",
    "bureaux": "bureau",
    "coworking": "bureau",
    # Immeuble
    "immeuble": "immeuble",
    "immeublederapport": "immeuble",
    "residence": "immeuble",
    "résidence": "immeuble",
}

_LOGEMENT_TYPES = {"appartement", "maison", "studio", "loft"}


def _slug(v: Optional[str]) -> str:
    if not v:
        return ""
    s = str(v).lower().strip()
    # Retire accents
    s = (
        s.replace("à", "a").replace("â", "a").replace("ä", "a")
        .replace("é", "e").replace("è", "e").replace("ê", "e").replace("ë", "e")
        .replace("î", "i").replace("ï", "i")
        .replace("ô", "o").replace("ö", "o")
        .replace("ù", "u").replace("û", "u").replace("ü", "u")
        .replace("ç", "c")
    )
    # Supprime tout sauf lettres/chiffres
    return re.sub(r"[^a-z0-9]", "", s)


def normalize_property_type(raw: Optional[str]) -> str:
    """Retourne un type normalisé parmi la liste ci-dessus.

    Cherche d'abord un match exact (slug), puis un préfixe. Fallback → 'autre'.
    """
    slug = _slug(raw)
    if not slug:
        return "autre"
    if slug in _TYPE_MAP:
        return _TYPE_MAP[slug]
    # Match par préfixe : "appartement3pieces" → "appartement"
    for key, val in _TYPE_MAP.items():
        if slug.startswith(key) and len(key) >= 4:
            return val
    return "autre"


def is_logement(type_normalise: Optional[str]) -> bool:
    """True si le type normalisé est un logement (appt / maison / studio / loft)."""
    return (type_normalise or "").lower() in _LOGEMENT_TYPES


# ==========================================================================
# 2. Transaction (location vs vente)
# ==========================================================================
_VENTE_HINTS = ("vente", "sale", "sell", "achat", "buy", "acquisition", "for_sale", "forsale")
_LOCATION_HINTS = ("location", "rent", "rental", "louer", "for_rent", "forrent", "à_louer", "alouer")


def normalize_transaction(raw: Optional[str], price: Optional[float] = None) -> str:
    """Retourne 'vente' ou 'location'.

    Heuristique :
      1. Si le champ `raw` contient un indice clair, on l'utilise.
      2. Sinon, fallback sur le prix : > 40 000 € → vente, sinon location.
      3. Fallback ultime → 'vente' (l'écrasante majorité de nos ingestions).
    """
    slug = _slug(raw)
    if slug:
        if any(h.replace("_", "") in slug for h in _VENTE_HINTS):
            return "vente"
        if any(h.replace("_", "") in slug for h in _LOCATION_HINTS):
            return "location"
    # Fallback via prix (seuil conservateur pour éviter les faux positifs)
    try:
        p = float(price) if price is not None else None
    except (TypeError, ValueError):
        p = None
    if p is not None:
        return "vente" if p >= 40_000 else "location"
    return "vente"


# ==========================================================================
# 3. Postal code auto-déduit depuis la ville
#     - Paris    → 75001 … 75020
#     - Lyon     → 69001 … 69009
#     - Marseille → 13001 … 13016
# ==========================================================================
_ARR_CITY_RE = re.compile(
    r"""
    ^\s*
    (?P<city>paris|lyon|marseille|marseilles)
    \s*
    (?:-\s*|\s+)?
    (?P<arr>\d{1,3})
    (?:\s*(?:e|er|eme|ème|ᵉ|ième|st|nd|rd|th))?
    (?:\s*(?:arrondissement|arr|arr\.))?
    \s*$
    """,
    re.IGNORECASE | re.VERBOSE,
)

_CITY_BASE = {
    "paris": (75, 20),
    "lyon": (69, 9),
    "marseille": (13, 16),
    "marseilles": (13, 16),
}


def deduce_postal_code(city: Optional[str], existing_postal_code: Optional[str] = None) -> Optional[str]:
    """Si `existing_postal_code` est déjà valide (5 chiffres), on le retourne tel quel.
    Sinon on tente d'extraire un arrondissement du champ `city` pour Paris/Lyon/Marseille.
    """
    # Si on a déjà un code postal 5 chiffres valide, on ne touche à rien.
    if existing_postal_code:
        s = re.sub(r"\D", "", str(existing_postal_code))
        if len(s) == 5:
            return s

    if not city:
        return existing_postal_code or None

    m = _ARR_CITY_RE.match(str(city).strip())
    if not m:
        # Cas simple : "Paris" seul → pas d'info d'arrondissement, on ne peut rien déduire.
        return existing_postal_code or None
    key = m.group("city").lower()
    try:
        arr = int(m.group("arr"))
    except (TypeError, ValueError):
        return existing_postal_code or None

    if key not in _CITY_BASE:
        return existing_postal_code or None
    base, max_arr = _CITY_BASE[key]
    if arr < 1 or arr > max_arr:
        return existing_postal_code or None
    return f"{base}{arr:03d}"


# ==========================================================================
# 4. Application unique de la normalisation sur un listing (dict Supabase)
# ==========================================================================
def apply_normalization(listing: dict) -> dict:
    """Enrichit un dict `listing` avec les 3 nouvelles colonnes A1 :
       - `transaction`      ('vente' | 'location')
       - `type_normalise`   (voir _TYPE_MAP)
       - `est_logement`     (bool)

    Corrige aussi `postal_code` si l'annonce est à Paris/Lyon/Marseille et
    que la ville contient l'arrondissement mais que `postal_code` est vide.

    Retourne le même dict (muté) pour permettre l'usage inline.
    """
    raw_type = (
        listing.get("property_type")
        or listing.get("type")
        or listing.get("type_bien")
        or listing.get("bien")
        or (listing.get("raw_data") or {}).get("propertyType")
        or (listing.get("raw_data") or {}).get("type")
    )
    raw_tx = (
        listing.get("transaction")
        or listing.get("transaction_type")
        or listing.get("dealType")
        or listing.get("kind_transaction")
        or (listing.get("raw_data") or {}).get("transaction")
        or (listing.get("raw_data") or {}).get("dealType")
    )

    type_norm = normalize_property_type(raw_type)
    listing["type_normalise"] = type_norm
    listing["est_logement"] = is_logement(type_norm)
    listing["transaction"] = normalize_transaction(raw_tx, listing.get("price"))

    # Auto-postal code pour Paris/Lyon/Marseille
    deduced = deduce_postal_code(listing.get("city"), listing.get("postal_code"))
    if deduced and deduced != listing.get("postal_code"):
        listing["postal_code"] = deduced

    return listing
