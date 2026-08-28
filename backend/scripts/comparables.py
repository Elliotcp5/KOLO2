"""
KOLO — /api/comparables endpoint helper
=========================================

Reads the Supabase view `mutations_propres` (curated DVF data — the raw
`mutations` table has duplicates and outliers) and returns comparables
around a lat/lng point for an iOS estimation flow.

Called by the endpoint mounted in server.py.
"""
from __future__ import annotations

import logging
import math
import os
from datetime import datetime, timezone, timedelta
from statistics import median, quantiles
from typing import Optional

import httpx

logger = logging.getLogger("comparables")

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_KEY = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()

EARTH_R_M = 6371000.0  # WGS-84 mean radius in metres

# Cheap fallbacks tried in order when < 5 comparables are found.
_RADIUS_FALLBACKS = [1000, 2000, 3000]

# ---------------------------------------------------------------------------
# Reliability thresholds — PROVISIONAL, to be recalibrated on real data.
# The scoring uses the *coefficient of dispersion* (Q3 - Q1) / median, which
# is robust to a single outlier (unlike max/min ratio).
#   coef  < FIAB_HIGH_MAX      → "élevée"
#   FIAB_HIGH_MAX  ≤ coef < FIAB_MED_MAX → "moyenne"
#   coef  ≥ FIAB_MED_MAX       → "faible"
# Tweak here — nowhere else.
# ---------------------------------------------------------------------------
FIAB_HIGH_MAX = 0.25
FIAB_MED_MAX = 0.40

FIAB_LOW_MESSAGE = (
    "Les biens vendus dans ce secteur sont très hétérogènes — "
    "l'étage, la vue et l'état pèsent lourd ici."
)


def _sb_headers() -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance between two WGS-84 points, in metres. Small enough for our
    urban-scale radii that Haversine is precise to a few cm.
    """
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_R_M * math.asin(math.sqrt(a))


def _bbox(lat: float, lng: float, radius_m: float) -> tuple[float, float, float, float]:
    """Return (min_lat, max_lat, min_lng, max_lng) — a bounding box wide
    enough to contain the disc of `radius_m` around (lat, lng). Cheap
    prefilter to keep the Supabase query small; the final filter is done
    in Python with Haversine.
    """
    d_lat = (radius_m / EARTH_R_M) * (180.0 / math.pi)
    # Guard against div-by-zero at the poles (not a real concern for France
    # but keeps the code defensive).
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)
    d_lng = (radius_m / (EARTH_R_M * cos_lat)) * (180.0 / math.pi)
    return lat - d_lat, lat + d_lat, lng - d_lng, lng + d_lng


async def _fetch_bbox(
    client: httpx.AsyncClient,
    *,
    lat_min: float, lat_max: float,
    lng_min: float, lng_max: float,
    type_local: str,
    surface_min: float, surface_max: float,
    since_iso: str,
) -> list[dict]:
    """One PostgREST call. Filters:
       lat/lng in bounding box  +  type_local  +  surface range  +  24m date
    """
    params: list[tuple[str, str]] = [
        ("select", "id_mutation,date_mutation,valeur_fonciere,surface_reelle_bati,"
                    "nombre_pieces_principales,type_local,code_postal,nom_commune,"
                    "adresse,longitude,latitude,prix_m2"),
        ("type_local", f"eq.{type_local}"),
        ("date_mutation", f"gte.{since_iso}"),
        ("surface_reelle_bati", f"gte.{surface_min}"),
        ("surface_reelle_bati", f"lte.{surface_max}"),
        ("latitude", f"gte.{lat_min}"),
        ("latitude", f"lte.{lat_max}"),
        ("longitude", f"gte.{lng_min}"),
        ("longitude", f"lte.{lng_max}"),
        ("limit", "500"),   # bbox pre-filter cap — 500 is plenty for a 3 km disc in dense cities
    ]
    r = await client.get(
        f"{SUPABASE_URL}/rest/v1/mutations_propres",
        params=params,
        headers=_sb_headers(),
        timeout=15,
    )
    if r.status_code != 200:
        logger.warning(f"Supabase mutations_propres HTTP {r.status_code}: {r.text[:200]}")
        return []
    return r.json() or []


async def _fetch_postal_code_median(
    client: httpx.AsyncClient,
    *,
    postal_code: str,
    type_local: str,
    since_iso: str,
) -> tuple[Optional[float], int]:
    """Return (median_prix_m2, count) for all sales of `type_local` in the
    given `postal_code` over the last 24 months. Pages through PostgREST
    (default 1000-row cap per page) so the median reflects EVERY sale.
    """
    if not postal_code:
        return None, 0
    values: list[float] = []
    offset = 0
    page = 1000
    max_pages = 10  # safety cap → 10k sales per postal code / type over 24 months
    for _ in range(max_pages):
        params: list[tuple[str, str]] = [
            ("select", "prix_m2"),
            ("type_local", f"eq.{type_local}"),
            ("code_postal", f"eq.{postal_code}"),
            ("date_mutation", f"gte.{since_iso}"),
            ("prix_m2", "not.is.null"),
            ("order", "id_mutation.asc"),  # stable pagination
            ("limit", str(page)),
            ("offset", str(offset)),
        ]
        try:
            r = await client.get(
                f"{SUPABASE_URL}/rest/v1/mutations_propres",
                params=params,
                headers=_sb_headers(),
                timeout=15,
            )
        except Exception as e:
            logger.warning(f"Supabase postal_code median failed: {e}")
            break
        if r.status_code != 200:
            logger.warning(f"Supabase postal_code median HTTP {r.status_code}: {r.text[:200]}")
            break
        rows = r.json() or []
        if not rows:
            break
        for x in rows:
            v = x.get("prix_m2")
            if v in (None, ""):
                continue
            try:
                values.append(float(v))
            except (TypeError, ValueError):
                pass
        if len(rows) < page:
            break
        offset += page

    if not values:
        return None, 0
    return round(median(values)), len(values)


def _price_per_sqm(row: dict) -> Optional[float]:
    """`prix_m2` is expected to come from the view, but we recompute safely
    from valeur_fonciere / surface_reelle_bati as a fallback (never trust the
    upstream to hand us a well-populated computed column).
    """
    v = row.get("prix_m2")
    if v not in (None, "", 0):
        try:
            return float(v)
        except (TypeError, ValueError):
            pass
    try:
        vf = float(row.get("valeur_fonciere") or 0)
        s = float(row.get("surface_reelle_bati") or 0)
        if vf > 0 and s > 0:
            return vf / s
    except (TypeError, ValueError):
        pass
    return None


async def get_comparables(
    lat: float,
    lng: float,
    type_local: str,
    surface: float,
    radius_m: int = 1000,
) -> dict:
    """Main entry point used by the /api/comparables endpoint."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {"error": "supabase_not_configured"}

    if type_local not in ("Appartement", "Maison"):
        return {"error": "invalid_type", "detail": "type must be 'Appartement' or 'Maison'"}
    if surface <= 0:
        return {"error": "invalid_surface"}

    surface_min = surface * 0.8
    surface_max = surface * 1.2
    since_dt = datetime.now(timezone.utc) - timedelta(days=365 * 2)
    since_iso = since_dt.date().isoformat()

    # Build the fallback ladder: start from the requested radius, then try
    # 2000 m and 3000 m if we still have fewer than 5 comparables.
    ladder: list[int] = []
    for r in [radius_m] + _RADIUS_FALLBACKS:
        if r >= (ladder[-1] if ladder else 0):
            if r not in ladder:
                ladder.append(r)

    comparables: list[dict] = []
    radius_used = ladder[0]

    async with httpx.AsyncClient() as client:
        for r_try in ladder:
            lat_min, lat_max, lng_min, lng_max = _bbox(lat, lng, r_try)
            rows = await _fetch_bbox(
                client,
                lat_min=lat_min, lat_max=lat_max,
                lng_min=lng_min, lng_max=lng_max,
                type_local=type_local,
                surface_min=surface_min,
                surface_max=surface_max,
                since_iso=since_iso,
            )

            enriched: list[dict] = []
            for row in rows:
                try:
                    rlat = float(row.get("latitude"))
                    rlng = float(row.get("longitude"))
                except (TypeError, ValueError):
                    continue
                dist = _haversine_m(lat, lng, rlat, rlng)
                if dist > r_try:
                    continue  # bbox is looser than the actual disc
                ppsm = _price_per_sqm(row)
                if ppsm is None or ppsm <= 0:
                    continue
                enriched.append({
                    "id_mutation": row.get("id_mutation"),
                    "date_mutation": row.get("date_mutation"),
                    "valeur_fonciere": row.get("valeur_fonciere"),
                    "surface_reelle_bati": row.get("surface_reelle_bati"),
                    "nombre_pieces_principales": row.get("nombre_pieces_principales"),
                    "type_local": row.get("type_local"),
                    "code_postal": row.get("code_postal"),
                    "nom_commune": row.get("nom_commune"),
                    "adresse": row.get("adresse"),
                    "latitude": rlat,
                    "longitude": rlng,
                    "prix_m2": round(ppsm),
                    "distance_m": round(dist),
                })

            enriched.sort(key=lambda x: x["distance_m"])
            comparables = enriched[:20]
            radius_used = r_try
            if len(comparables) >= 5:
                break

        # Local median (of the comparables actually returned)
        local_prices = [c["prix_m2"] for c in comparables if c.get("prix_m2")]
        local_median = round(median(local_prices)) if local_prices else None

        # Dispersion (min / Q1 / median / Q3 / max) — used by the iOS
        # estimation flow to build a HONEST range instead of a fake ±X%
        # around the median.
        # Reliability is scored on the COEFFICIENT OF DISPERSION,
        # (Q3 - Q1) / median, which is robust to a single outlier
        # (unlike max/min which flips as soon as one atypical sale
        # appears in the sample). `ratio_max_min` is kept for information.
        dispersion: Optional[dict] = None
        fourchette_basse: Optional[int] = None
        fourchette_haute: Optional[int] = None
        fiabilite: Optional[str] = None
        avertissement: Optional[str] = None
        if len(local_prices) >= 4 and local_median:
            qs = quantiles(local_prices, n=4, method="exclusive")
            q1, _q2, q3 = qs[0], qs[1], qs[2]
            mn = min(local_prices)
            mx = max(local_prices)
            ratio = round(mx / mn, 2) if mn > 0 else None
            coef = round((q3 - q1) / local_median, 2) if local_median > 0 else None

            dispersion = {
                "min": round(mn),
                "q1": round(q1),
                "mediane": local_median,
                "q3": round(q3),
                "max": round(mx),
                "ratio_max_min": ratio,
                "coefficient_dispersion": coef,
            }
            fourchette_basse = round(q1)
            fourchette_haute = round(q3)

            if coef is None:
                fiabilite = "faible"
            elif coef < FIAB_HIGH_MAX:
                fiabilite = "élevée"
            elif coef < FIAB_MED_MAX:
                fiabilite = "moyenne"
            else:
                fiabilite = "faible"
        elif local_prices:
            # Not enough comps for meaningful quartiles — expose raw
            # min/median/max only so the client can still show something,
            # but flag the estimation as low-confidence.
            mn = min(local_prices)
            mx = max(local_prices)
            dispersion = {
                "min": round(mn),
                "q1": None,
                "mediane": local_median,
                "q3": None,
                "max": round(mx),
                "ratio_max_min": round(mx / mn, 2) if mn > 0 else None,
                "coefficient_dispersion": None,
            }
            fiabilite = "faible"

        if fiabilite == "faible":
            avertissement = FIAB_LOW_MESSAGE

        # Postal-code median (all sales of same type over 24 months in that PC)
        postal_code = comparables[0]["code_postal"] if comparables else None
        pc_median, pc_count = await _fetch_postal_code_median(
            client,
            postal_code=postal_code or "",
            type_local=type_local,
            since_iso=since_iso,
        )

    return {
        "comparables": comparables,
        "count": len(comparables),
        "radius_used_m": radius_used,
        "radius_requested_m": radius_m,
        "median_price_per_sqm_local": local_median,
        "count_local": len(local_prices),
        "median_price_per_sqm_postal_code": pc_median,
        "count_postal_code": pc_count,
        "postal_code": postal_code,
        "surface_range": [round(surface_min, 1), round(surface_max, 1)],
        "since": since_iso,
        "dispersion": dispersion,
        "fourchette_basse": fourchette_basse,
        "fourchette_haute": fourchette_haute,
        "fiabilite": fiabilite,
        "avertissement": avertissement,
    }
