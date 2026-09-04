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
    """Retourne un rapport avec taux de remplissage.

    **Distinction fine** — un listing peut :
      - déjà avoir `rue_extraite` posé (aucun patch nécessaire) → `rue_deja_ok`
      - être neuf et matcher → `rue_written`
      - être neuf et ne pas matcher (BAN vide, titre pauvre) → `rue_absente`

    Un job qui trouve 900 rues déjà présentes sur 1000 scannés est un succès,
    pas un échec silencieux. Le statut warning ne se déclenche que si le taux
    total (déjà présentes + nouvellement écrites) est vraiment faible.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {"error": "supabase_env_missing"}

    stats: dict = {
        "cps": {},
        "totals": {
            "scanned": 0,
            "rue_written": 0,      # nouvelle valeur patchée dans Supabase
            "rue_deja_ok": 0,      # rue_extraite déjà correcte, pas de patch
            "rue_absente": 0,      # extract_rue_and_etage a renvoyé None
            "etage_written": 0,
        },
    }
    by_source_total: dict[str, dict[str, int]] = {}

    async with httpx.AsyncClient() as client:
        cps = [code_postal] if code_postal else await _distinct_postal_codes(client)

        for cp in cps:
            voies = await voies_by_postcode(client, cp, db=db)
            logger.info(f"a3.extraire-rues[{cp}] voies BAN chargées: {len(voies)}")

            scanned = 0
            rue_ok = 0            # patched now
            rue_deja = 0          # already had value
            rue_none = 0          # extraction failed
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
                    by_source.setdefault(src, {"scanned": 0, "rue": 0,
                                               "rue_deja": 0, "etage": 0})
                    by_source[src]["scanned"] += 1

                    rue, etage = extract_rue_and_etage(
                        row.get("title"), row.get("description"),
                        voies_norm=voies,
                        listing_floor=row.get("floor"),
                    )
                    already = row.get("rue_extraite")
                    if rue is None:
                        # Aucune rue trouvée pour ce listing
                        if not already:
                            rue_none += 1
                    elif rue == already:
                        # Déjà écrit à cette valeur — compte comme couvert
                        rue_deja += 1
                        by_source[src]["rue_deja"] += 1
                    else:
                        # Nouvelle valeur → patch
                        patch = {"rue_extraite": rue}
                        if etage is not None and etage != row.get("etage_extrait"):
                            patch["etage_extrait"] = int(etage)
                        ok = await _patch_listing(client, row["id"], patch)
                        if ok:
                            rue_ok += 1
                            by_source[src]["rue"] += 1
                            if "etage_extrait" in patch:
                                etage_ok += 1
                                by_source[src]["etage"] += 1
                        continue  # patch déjà géré ci-dessus
                    # Etage seul (rue déjà là ou None)
                    if etage is not None and etage != row.get("etage_extrait"):
                        ok = await _patch_listing(
                            client, row["id"], {"etage_extrait": int(etage)}
                        )
                        if ok:
                            etage_ok += 1
                            by_source[src]["etage"] += 1
                offset += len(batch)
                if len(batch) < 500:
                    break

            couvert = rue_ok + rue_deja
            stats["cps"][cp] = {
                "scanned": scanned,
                "rue_ecrites": rue_ok,
                "rue_deja_ok": rue_deja,
                "rue_absente": rue_none,
                "couverture_rue": couvert,
                "couverture_pct": round(couvert / scanned * 100, 1) if scanned else 0.0,
                "etage_ecrites": etage_ok,
                "voies_ban_count": len(voies),
                "by_source": by_source,
            }
            stats["totals"]["scanned"] += scanned
            stats["totals"]["rue_written"] += rue_ok
            stats["totals"]["rue_deja_ok"] += rue_deja
            stats["totals"]["rue_absente"] += rue_none
            stats["totals"]["etage_written"] += etage_ok
            # Global by_source
            for src, d in by_source.items():
                if src not in by_source_total:
                    by_source_total[src] = {"scanned": 0, "rue": 0,
                                            "rue_deja": 0, "etage": 0}
                by_source_total[src]["scanned"] += d["scanned"]
                by_source_total[src]["rue"] += d["rue"]
                by_source_total[src]["rue_deja"] += d["rue_deja"]
                by_source_total[src]["etage"] += d["etage"]

    stats["by_source"] = by_source_total
    scanned = stats["totals"]["scanned"]
    written = stats["totals"]["rue_written"]
    deja = stats["totals"]["rue_deja_ok"]
    couvert = written + deja
    if scanned:
        stats["totals"]["couverture_pct"] = round(couvert / scanned * 100, 1)
        # Rétrocompatibilité — rue_pct = ratio de rues extraites (déjà + nouv.)
        stats["totals"]["rue_pct"] = stats["totals"]["couverture_pct"]

    # Statut final — seuls les cas RÉELLEMENT anormaux remontent en warning :
    #   - 0 scanné : le job n'a rien lu (Supabase down ou tous CPs vides)
    #   - scanned>0 ET couverture (nouvelle + déjà) < 10% : régression réelle
    if scanned == 0:
        stats["status"] = "warning"
        stats["warning"] = "scanned=0 — aucun listing actif lu, vérifier Supabase"
    elif couvert / scanned < 0.10:
        stats["status"] = "warning"
        stats["warning"] = (
            f"couverture={stats['totals']['couverture_pct']}% < 10% — "
            f"scanned={scanned}, rue_written={written}, rue_deja_ok={deja}, "
            f"rue_absente={stats['totals']['rue_absente']}. "
            "Vérifier voies BAN chargées et `title/description` non vides."
        )
    else:
        stats["status"] = "ok"
    return stats
