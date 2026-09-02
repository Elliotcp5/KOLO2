"""KOLO — Migration V2 → B1 (bascule d'app_version).

Utilisé par les endpoints admin de bascule et par l'écran de reprise
« Confirmez vos zones » côté B1.

Règle métier :
  - `app_version` ∈ {"v2", "b1"} — front aiguille dessus après login
  - À la bascule vers b1 : `zones_confirmees=false` + `tour_guide_vu=false`
  - `zones_suggestions` est calculé une fois (persisté) : CP les plus fréquents
    dans les prospects, dossiers, contacts V2 du user, puis profil, puis []
"""
from __future__ import annotations

from collections import Counter
from typing import Any, Optional

from a2.tz import now_utc_iso


_CP_RE = None
def _looks_like_cp(v: Any) -> Optional[str]:
    global _CP_RE
    import re
    if _CP_RE is None:
        _CP_RE = re.compile(r"\b(\d{5})\b")
    if v is None:
        return None
    s = str(v)
    m = _CP_RE.search(s)
    if not m:
        return None
    cp = m.group(1)
    # Exclure codes clairement non-postaux (00xxx)
    if cp.startswith("00"):
        return None
    return cp


async def compute_suggested_zones(db, user_id: str, max_zones: int = 2) -> list[str]:
    """Ordre de priorité :
    1) CP les plus fréquents dans les dossiers/estimations du user
    2) CP des prospects V2 du user
    3) CP des contacts V2 du user
    4) CP du profil (`code_postal_perso`, `zones_perso` déjà posé)
    Retourne 1-2 CP max (jamais liste vide : fallback `["75017"]`).
    """
    counter: Counter[str] = Counter()

    # 1) Dossiers/estimations
    async for d in db.dossiers.find({"user_id": user_id}, {"bien": 1, "adresse": 1}):
        for f in (d.get("bien") or {}, d):
            for k in ("code_postal", "cp", "adresse", "adresse_bien"):
                cp = _looks_like_cp((f or {}).get(k))
                if cp:
                    counter[cp] += 1
    async for e in db.estimations.find({"user_id": user_id}, {"bien": 1, "adresse": 1, "code_postal": 1}):
        cp = _looks_like_cp(e.get("code_postal")) or _looks_like_cp((e.get("bien") or {}).get("code_postal")) or _looks_like_cp(e.get("adresse"))
        if cp:
            counter[cp] += 1

    # 2) Prospects V2
    async for p in db.prospects.find({"user_id": user_id}, {"code_postal": 1, "adresse": 1}):
        cp = _looks_like_cp(p.get("code_postal")) or _looks_like_cp(p.get("adresse"))
        if cp:
            counter[cp] += 1

    # 3) Contacts V2
    async for c in db.v2_contacts.find({"user_id": user_id}, {"code_postal": 1, "adresse": 1}):
        cp = _looks_like_cp(c.get("code_postal")) or _looks_like_cp(c.get("adresse"))
        if cp:
            counter[cp] += 1

    top = [cp for cp, _n in counter.most_common(max_zones)]
    if top:
        return top

    # 4) Profil
    user = await db.users.find_one({"user_id": user_id}, {"code_postal_perso": 1, "zones_perso": 1})
    if user:
        if user.get("zones_perso"):
            zp = [z for z in user["zones_perso"] if _looks_like_cp(z)]
            if zp:
                return zp[:max_zones]
        cp = _looks_like_cp(user.get("code_postal_perso"))
        if cp:
            return [cp]

    # Fallback zone démo Apple + Paris 17e
    return ["75017"]


async def bascule_to_b1(db, user_id: str) -> dict:
    """Idempotent : bascule un user en B1.
    Pose `app_version=b1`, `zones_confirmees=false`, `tour_guide_vu=false`,
    et calcule/persiste `zones_suggestions`. Ne touche pas au plan.
    """
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        return {"ok": False, "error": "user_not_found"}

    suggestions = await compute_suggested_zones(db, user_id)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "app_version": "b1",
            "zones_confirmees": False,
            "tour_guide_vu": False,
            "zones_suggestions": suggestions,
            "app_version_migrated_at": now_utc_iso(),
            "updated_at": now_utc_iso(),
        }},
    )
    return {"ok": True, "user_id": user_id, "app_version": "b1", "zones_suggestions": suggestions}


async def bascule_to_v2(db, user_id: str) -> dict:
    """Retour arrière : replace le user en V2.
    Conserve les données B1 (dossiers, estimations, etc.) — juste l'aiguillage.
    """
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        return {"ok": False, "error": "user_not_found"}
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "app_version": "v2",
            "updated_at": now_utc_iso(),
        }},
    )
    return {"ok": True, "user_id": user_id, "app_version": "v2"}
