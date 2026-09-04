"""KOLO A3 — Job d'extraction rue+étage depuis les annonces Supabase.

`POST /api/jobs/extraire-rues { code_postal? }`

1. Pour chaque CP concerné, on récupère la liste des voies via BAN (cache Mongo)
2. On lit les listings actives du CP depuis Supabase
3. On applique `extract_rue_and_etage` sur title+description
4. On PATCH `rue_extraite` et `etage_extrait` dans Supabase (uniquement si != null
   ET != valeur existante — évite les updates inutiles)
5. On journalise le taux de remplissage par source
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

from a3.extract_rue import extract_rue_and_etage
from a3.sources.ban import voies_by_postcode

logger = logging.getLogger(__name__)

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_KEY = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()


def _sb_headers(prefer: str = "") -> dict:
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


async def _fetch_active_listings_for_cp(
    client: httpx.AsyncClient, code_postal: str, offset: int = 0, limit: int = 500
) -> list[dict]:
    params = {
        "select": "id,portal,title,description,floor,rue_extraite,etage_extrait,type_normalise",
        "postal_code": f"eq.{code_postal}",
        "is_active": "eq.true",
        "order": "id.asc",
        "limit": str(limit),
        "offset": str(offset),
    }
    r = await client.get(
        f"{SUPABASE_URL}/rest/v1/listings", params=params,
        headers=_sb_headers(), timeout=30,
    )
    r.raise_for_status()
    return r.json() or []


async def _distinct_postal_codes(client: httpx.AsyncClient) -> list[str]:
    """Liste des CP présents dans listings actives."""
    r = await client.get(
        f"{SUPABASE_URL}/rest/v1/listings",
        params={"select": "postal_code", "is_active": "eq.true", "postal_code": "not.is.null"},
        headers=_sb_headers(), timeout=30,
    )
    r.raise_for_status()
    return sorted({row["postal_code"] for row in (r.json() or []) if row.get("postal_code")})


async def _patch_listing(client: httpx.AsyncClient, listing_id: int, patch: dict) -> bool:
    r = await client.patch(
        f"{SUPABASE_URL}/rest/v1/listings",
        params={"id": f"eq.{listing_id}"},
        headers=_sb_headers(prefer="return=minimal"),
        json=patch,
        timeout=15,
    )
    return r.status_code in (200, 204)


async def run_extraire_rues(db, code_postal: Optional[str] = None) -> dict:
    """Retourne un rapport avec taux de remplissage."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {"error": "supabase_env_missing"}

    stats: dict = {"cps": {}, "totals": {"scanned": 0, "rue_written": 0, "etage_written": 0}}
    by_source_total: dict[str, dict[str, int]] = {}

    async with httpx.AsyncClient() as client:
        cps = [code_postal] if code_postal else await _distinct_postal_codes(client)

        for cp in cps:
            voies = await voies_by_postcode(client, cp, db=db)
            logger.info(f"a3.extraire-rues[{cp}] voies BAN chargées: {len(voies)}")

            scanned = 0
            rue_ok = 0
            etage_ok = 0
            by_source: dict[str, dict[str, int]] = {}
            offset = 0
            while True:
                batch = await _fetch_active_listings_for_cp(client, cp, offset=offset, limit=500)
                if not batch:
                    break
                for row in batch:
                    scanned += 1
                    src = (row.get("portal") or "unknown").lower()
                    by_source.setdefault(src, {"scanned": 0, "rue": 0, "etage": 0})
                    by_source[src]["scanned"] += 1

                    rue, etage = extract_rue_and_etage(
                        row.get("title"), row.get("description"),
                        voies_norm=voies,
                        listing_floor=row.get("floor"),
                    )
                    patch = {}
                    if rue and rue != row.get("rue_extraite"):
                        patch["rue_extraite"] = rue
                    if etage is not None and etage != row.get("etage_extrait"):
                        patch["etage_extrait"] = int(etage)
                    if patch:
                        ok = await _patch_listing(client, row["id"], patch)
                        if ok:
                            if "rue_extraite" in patch:
                                rue_ok += 1
                                by_source[src]["rue"] += 1
                            if "etage_extrait" in patch:
                                etage_ok += 1
                                by_source[src]["etage"] += 1
                offset += len(batch)
                if len(batch) < 500:
                    break

            stats["cps"][cp] = {
                "scanned": scanned,
                "rue_ecrites": rue_ok,
                "etage_ecrites": etage_ok,
                "rue_pct": round(rue_ok / scanned * 100, 1) if scanned else 0.0,
                "voies_ban_count": len(voies),
                "by_source": by_source,
            }
            stats["totals"]["scanned"] += scanned
            stats["totals"]["rue_written"] += rue_ok
            stats["totals"]["etage_written"] += etage_ok
            # Global by_source
            for src, d in by_source.items():
                if src not in by_source_total:
                    by_source_total[src] = {"scanned": 0, "rue": 0, "etage": 0}
                by_source_total[src]["scanned"] += d["scanned"]
                by_source_total[src]["rue"] += d["rue"]
                by_source_total[src]["etage"] += d["etage"]

    stats["by_source"] = by_source_total
    if stats["totals"]["scanned"]:
        stats["totals"]["rue_pct"] = round(
            stats["totals"]["rue_written"] / stats["totals"]["scanned"] * 100, 1
        )
    # Statut final — un job qui scanne des lignes sans rien écrire ne peut PAS
    # se déclarer `done` : c'est le signe d'une régression silencieuse (BAN
    # non chargé, extraction cassée, `nom_voie_ban` toujours vide côté source).
    scanned = stats["totals"]["scanned"]
    rue_ok = stats["totals"]["rue_written"]
    if scanned > 0 and rue_ok == 0:
        stats["status"] = "warning"
        stats["warning"] = (
            f"scanned={scanned} listings mais rue_written=0 — "
            "vérifier voies BAN chargées, `title/description` non vides, "
            "et fallback `nom_voie_ban` côté ingestion"
        )
    elif scanned > 0 and rue_ok / scanned < 0.10:
        # < 10% de taux d'extraction : sans doute une régression partielle
        stats["status"] = "warning"
        stats["warning"] = (
            f"taux rue_pct={stats['totals']['rue_pct']}% < 10% — "
            "extraction peu fiable"
        )
    else:
        stats["status"] = "ok"
    return stats
