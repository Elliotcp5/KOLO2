"""Tests pytest — Veille cards (BLOC B)."""
from __future__ import annotations

import os
from datetime import datetime, timezone

import pytest
from motor.motor_asyncio import AsyncIOMotorClient


def _db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


@pytest.mark.asyncio
async def test_config_veille_defaults():
    """Les constantes de config veille doivent être en base après boot."""
    from a2.config import ensure_config_seeded, get_config
    db = _db()
    await ensure_config_seeded(db)
    cfg = await get_config(db)
    v = cfg.get("veille") or {}
    assert v.get("min_days_on_market") == 90
    assert v.get("dom_cap_days") == 180
    assert v.get("price_drop_weight") == 2
    assert v.get("seuil_quota_du_jour") == 3
    assert v.get("max_par_jour") == 5


@pytest.mark.asyncio
async def test_maybe_insert_veille_card_no_signal():
    """Un bien sans DOM > 90 ET sans baisse doit être ignoré."""
    from a3.job_generer_opportunites import _maybe_insert_veille_card, _VeilleSkip
    from a2.config import get_config
    db = _db()
    cfg = await get_config(db)
    dpe = {"numero_dpe": "TEST-DPE-NO-SIGNAL"}
    annonce = {"id": 1, "days_on_market": 30, "price_drop_count": 0}
    with pytest.raises(_VeilleSkip):
        await _maybe_insert_veille_card(db, cp="99999", dpe=dpe, annonce=annonce, cfg=cfg)


@pytest.mark.asyncio
async def test_maybe_insert_veille_card_signal_dom():
    """Un bien avec DOM > 90 doit créer une carte, score = min(dom, cap)/30."""
    from a3.job_generer_opportunites import _maybe_insert_veille_card
    from a2.config import get_config
    db = _db()
    cfg = await get_config(db)
    dpe = {"numero_dpe": "TEST-DPE-DOM-ONLY", "adresse": "12 rue Test"}
    annonce = {"id": 42, "days_on_market": 150, "price_drop_count": 0, "price": 400000, "url": "http://x"}
    await _maybe_insert_veille_card(db, cp="99999", dpe=dpe, annonce=annonce, cfg=cfg)
    doc = await db.veille_cards.find_one({"dpe_id": "TEST-DPE-DOM-ONLY"})
    assert doc is not None
    # score = 150/30 + 0*2 = 5.0
    assert doc["score_veille"] == 5.0
    assert doc["days_on_market"] == 150
    assert doc["price_drop_count"] == 0
    await db.veille_cards.delete_many({"dpe_id": "TEST-DPE-DOM-ONLY"})


@pytest.mark.asyncio
async def test_maybe_insert_veille_card_dom_cap():
    """DOM > 180 est plafonné à 180 dans le score."""
    from a3.job_generer_opportunites import _maybe_insert_veille_card
    from a2.config import get_config
    db = _db()
    cfg = await get_config(db)
    dpe = {"numero_dpe": "TEST-DPE-DOM-CAP"}
    # 400 jours d'ancienneté + 2 baisses
    annonce = {"id": 43, "days_on_market": 400, "price_drop_count": 2}
    await _maybe_insert_veille_card(db, cp="99999", dpe=dpe, annonce=annonce, cfg=cfg)
    doc = await db.veille_cards.find_one({"dpe_id": "TEST-DPE-DOM-CAP"})
    assert doc is not None
    # score = min(400,180)/30 + 2*2 = 6 + 4 = 10.0
    assert doc["score_veille"] == 10.0
    await db.veille_cards.delete_many({"dpe_id": "TEST-DPE-DOM-CAP"})


@pytest.mark.asyncio
async def test_maybe_insert_veille_card_price_drop_only():
    """Une baisse suffit pour créer la carte, même DOM court."""
    from a3.job_generer_opportunites import _maybe_insert_veille_card
    from a2.config import get_config
    db = _db()
    cfg = await get_config(db)
    dpe = {"numero_dpe": "TEST-DPE-DROP-ONLY"}
    annonce = {"id": 44, "days_on_market": 30, "price_drop_count": 1, "price_drop_pct": -8.0}
    await _maybe_insert_veille_card(db, cp="99999", dpe=dpe, annonce=annonce, cfg=cfg)
    doc = await db.veille_cards.find_one({"dpe_id": "TEST-DPE-DROP-ONLY"})
    assert doc is not None
    # score = 30/30 + 1*2 = 3.0
    assert doc["score_veille"] == 3.0
    assert doc["price_drop_count"] == 1
    await db.veille_cards.delete_many({"dpe_id": "TEST-DPE-DROP-ONLY"})


@pytest.mark.asyncio
async def test_maybe_insert_veille_card_idempotent():
    """Un même (dpe_id, listing_id) ne crée qu'une carte."""
    from a3.job_generer_opportunites import _maybe_insert_veille_card
    from a2.config import get_config
    db = _db()
    cfg = await get_config(db)
    dpe = {"numero_dpe": "TEST-DPE-IDEMP"}
    annonce = {"id": 99, "days_on_market": 120, "price_drop_count": 1}
    for _ in range(3):
        await _maybe_insert_veille_card(db, cp="99999", dpe=dpe, annonce=annonce, cfg=cfg)
    count = await db.veille_cards.count_documents({"dpe_id": "TEST-DPE-IDEMP"})
    assert count == 1
    await db.veille_cards.delete_many({"dpe_id": "TEST-DPE-IDEMP"})


@pytest.mark.asyncio
async def test_veille_pro_only_via_plan_effectif():
    """Un utilisateur en Découverte doit recevoir 402 sur /api/me/veille."""
    from b1.routes import _plan_effectif
    assert _plan_effectif({"plan": "decouverte"}) == "decouverte"
    assert _plan_effectif({"plan": "pro"}) == "pro"
    assert _plan_effectif({"organisation_id": "org_x", "plan": "decouverte"}) == "agence"
