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


# ==========================================================================
# 5. Enrichissement A1 bis — mapping des ~30 nouvelles colonnes
# ==========================================================================
# Utilisé par :
#   - `scripts/ingest_apify.py::_map_item_to_listing`  (webhook)
#   - `v2_router.py::_upsert_supabase_listings`         (cron legacy)
#
# Chaque colonne cible essaie plusieurs alias Apify (le format varie selon
# l'acteur et le portail). Les valeurs manquantes restent NULL.
#
# NON mappés (calculés par la Session A3, laissés à NULL) :
#   - rue_extraite, etage_extrait
# ==========================================================================
def _first(*vals):
    """Retourne la première valeur non-None et non-vide."""
    for v in vals:
        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        return v
    return None


def _as_int(v):
    if v is None or v is False:
        return None
    if v is True:
        return 1
    try:
        iv = int(float(str(v).replace(",", ".").replace(" ", "").replace(" ", "")))
        return iv
    except (TypeError, ValueError):
        return None


def _as_pos_int(v):
    """Comme _as_int mais retourne None si <= 0 (utile pour surface, prix)."""
    iv = _as_int(v)
    return iv if iv is not None and iv > 0 else None


def _as_float(v):
    if v is None or v is False:
        return None
    if v is True:
        return 1.0
    try:
        return float(str(v).replace(",", ".").replace(" ", "").replace(" ", ""))
    except (TypeError, ValueError):
        return None


def _as_bool(v):
    """None → None (nullable). Sinon coerce robuste."""
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str):
        s = v.strip().lower()
        if s in ("true", "yes", "y", "oui", "1"):
            return True
        if s in ("false", "no", "n", "non", "0", ""):
            return False
    return None


def _as_iso_datetime(v):
    """ISO string tel quel (Supabase TIMESTAMPTZ accepte ISO8601 nativement)."""
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        return s or None
    # Cas objet datetime
    try:
        return v.isoformat()
    except Exception:
        return None


def _ghg_class(v):
    """Retourne A..G (uppercase) ou None."""
    if v is None:
        return None
    s = str(v).strip().upper()
    if len(s) >= 1 and s[0] in "ABCDEFG":
        return s[0]
    return None


def _status(v):
    """Normalise le statut (active | pending | sold | withdrawn) ou None."""
    if v is None:
        return None
    s = str(v).strip().lower()
    if s in ("active", "online", "published", "live"):
        return "active"
    if s in ("pending", "under_offer", "compromis", "sous_compromis"):
        return "pending"
    if s in ("sold", "vendu", "closed"):
        return "sold"
    if s in ("withdrawn", "retiré", "retire", "removed", "expired"):
        return "withdrawn"
    return s or None


def enrich_from_apify_row(listing: dict, row: dict) -> dict:
    """Ajoute les colonnes A1 bis au dict `listing`.

    À appeler APRÈS avoir rempli les champs de base (price, surface, city, …)
    et de préférence APRÈS `apply_normalization()` (pour disposer de
    `transaction` / `type_normalise` / `est_logement` corrects).

    Champs mappés (voir A1_bis_listings_columns.sql) :
      description, property_type, latitude, longitude, floor, bedrooms,
      has_elevator, has_balcony, has_terrace, has_garden, has_parking,
      is_new_build, land_surface, ghg_class, price_per_m2, previous_price,
      price_changed, price_drop_count, price_drop_pct, days_on_market,
      days_since_last_change, posted_at, scraped_at, status, district,
      department, photo_count, listing_key, resolved_address,
      resolved_street, address_confidence

    Non mappés (extraction A3) : rue_extraite, etage_extrait.
    """
    row = row or {}

    # --- Contenu brut ---
    listing["description"] = _first(row.get("description"), row.get("desc"), row.get("descriptionText"))
    listing["property_type"] = _first(
        row.get("propertyType"), row.get("property_type"),
        row.get("type"), row.get("type_bien"), row.get("bien"),
    )

    # --- Géocodage (rempli en A3 via BAN si absent) ---
    listing["latitude"] = _as_float(_first(
        row.get("latitude"), row.get("lat"),
        (row.get("location") or {}).get("lat") if isinstance(row.get("location"), dict) else None,
        (row.get("coordinates") or {}).get("lat") if isinstance(row.get("coordinates"), dict) else None,
    ))
    listing["longitude"] = _as_float(_first(
        row.get("longitude"), row.get("lng"), row.get("lon"),
        (row.get("location") or {}).get("lng") if isinstance(row.get("location"), dict) else None,
        (row.get("coordinates") or {}).get("lng") if isinstance(row.get("coordinates"), dict) else None,
    ))

    # --- Adresse résolue (probabiliste — à ne PAS utiliser pour A3) ---
    listing["resolved_address"] = _first(
        row.get("resolvedAddress"), row.get("resolved_address"), row.get("address"),
    )
    listing["resolved_street"] = _first(
        row.get("resolvedStreet"), row.get("resolved_street"), row.get("street"),
    )
    listing["address_confidence"] = _as_float(_first(
        row.get("addressConfidence"), row.get("address_confidence"), row.get("confidence"),
    ))

    # --- Caractéristiques logement ---
    listing["floor"] = _as_int(_first(row.get("floor"), row.get("etage"), row.get("floorNumber")))
    listing["bedrooms"] = _as_int(_first(row.get("bedrooms"), row.get("nbBedrooms"), row.get("chambres")))
    listing["has_elevator"] = _as_bool(_first(row.get("hasElevator"), row.get("elevator"), row.get("ascenseur")))
    listing["has_balcony"] = _as_bool(_first(row.get("hasBalcony"), row.get("balcony"), row.get("balcon")))
    listing["has_terrace"] = _as_bool(_first(row.get("hasTerrace"), row.get("terrace"), row.get("terrasse")))
    listing["has_garden"] = _as_bool(_first(row.get("hasGarden"), row.get("garden"), row.get("jardin")))
    listing["has_parking"] = _as_bool(_first(row.get("hasParking"), row.get("parking")))
    listing["is_new_build"] = _as_bool(_first(
        row.get("isNewBuild"), row.get("newBuild"), row.get("neuf"), row.get("is_new"),
    ))
    listing["land_surface"] = _as_pos_int(_first(
        row.get("landSurface"), row.get("land_surface"),
        row.get("terrainSurface"), row.get("surfaceTerrain"),
    ))

    # --- Énergie complémentaire (energy_class déjà rempli plus haut) ---
    listing["ghg_class"] = _ghg_class(_first(
        row.get("ghgClass"), row.get("ghg_class"), row.get("ghg"),
        row.get("ges"), row.get("gesClass"),
    ))

    # --- Prix historique + m² ---
    ppm2 = _as_float(_first(
        row.get("pricePerSquareMeter"), row.get("pricePerM2"),
        row.get("price_per_m2"), row.get("prix_m2"),
    ))
    if ppm2 is None:
        p = listing.get("price")
        s = listing.get("surface")
        if p and s and s > 0:
            ppm2 = round(float(p) / float(s), 2)
    listing["price_per_m2"] = ppm2

    listing["previous_price"] = _as_pos_int(_first(
        row.get("previousPrice"), row.get("previous_price"), row.get("oldPrice"),
    ))
    listing["price_changed"] = _as_bool(_first(row.get("priceChanged"), row.get("price_changed")))
    listing["price_drop_count"] = _as_int(_first(
        row.get("priceDropCount"), row.get("price_drop_count"),
    ))
    listing["price_drop_pct"] = _as_float(_first(
        row.get("priceDropPct"), row.get("price_drop_pct"),
        row.get("priceDropPercent"), row.get("priceChangePct"),
    ))

    # --- Timing & état ---
    listing["days_on_market"] = _as_int(_first(
        row.get("daysOnMarket"), row.get("days_on_market"), row.get("dom"),
    ))
    listing["days_since_last_change"] = _as_int(_first(
        row.get("daysSinceLastChange"), row.get("days_since_last_change"),
    ))
    listing["posted_at"] = _as_iso_datetime(_first(
        row.get("postedAt"), row.get("posted_at"),
        row.get("publishedAt"), row.get("published_at"),
        row.get("date"), row.get("firstSeenAt"),
    ))
    listing["scraped_at"] = _as_iso_datetime(_first(
        row.get("scrapedAt"), row.get("scraped_at"), row.get("crawledAt"),
    ))
    listing["status"] = _status(_first(row.get("status"), row.get("state")))

    # --- Découpage administratif ---
    listing["district"] = _first(
        row.get("district"), row.get("neighborhood"), row.get("quartier"),
        row.get("arrondissement"),
    )
    pc = listing.get("postal_code")
    dept_auto = None
    if pc and len(str(pc)) >= 2:
        s = str(pc)
        dept_auto = s[:3] if s.startswith("97") else s[:2]
    listing["department"] = _first(
        row.get("department"), row.get("departement"), row.get("dept"),
        dept_auto,
    )

    # --- Meta ---
    listing["photo_count"] = _as_int(_first(
        row.get("photoCount"), row.get("photo_count"), row.get("nb_photos"),
        (len(row.get("photos")) if isinstance(row.get("photos"), list) else None),
    ))
    listing["listing_key"] = _first(
        row.get("listingKey"), row.get("listing_key"), row.get("uniqueKey"),
    )

    # rue_extraite / etage_extrait : NON mappés (extraction A3).

    return listing
