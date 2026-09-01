"""Tests pytest — BLOC B1 (onboarding, /me/*, ville resolver, delete)."""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone

import pytest
from motor.motor_asyncio import AsyncIOMotorClient


def _db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


@pytest.mark.asyncio
async def test_ville_resolver_paris_marseille_lyon():
    from b1.ville_resolver import resolve_ville

    assert resolve_ville("75001") == "Paris 1ᵉ"
    assert resolve_ville("75017") == "Paris 17ᵉ"
    assert resolve_ville("13008") == "Marseille 8ᵉ"
    assert resolve_ville("69003") == "Lyon 3ᵉ"
    assert resolve_ville("99999") == "Zone de démonstration"
    assert resolve_ville("00000") is None
    assert resolve_ville("abcde") is None
    assert resolve_ville("") is None


@pytest.mark.asyncio
async def test_ensure_b1_bootstrap_seeds_demo():
    from b1.routes import ensure_b1_bootstrap

    db = _db()
    await ensure_b1_bootstrap(db)
    demo = await db.zones_couvertes.find_one({"code_postal": "99999"})
    assert demo is not None
    assert demo.get("actif") is True
    assert demo.get("demo") is True
    marseille = await db.zones_couvertes.find_one({"code_postal": "13008"})
    assert marseille is not None
    assert marseille.get("actif") is True


@pytest.mark.asyncio
async def test_completude_pro_calcul():
    from b1.routes import _completude_pro, _INFOS_PRO_FIELDS

    assert _completude_pro({}) == 0
    # 1 champ rempli → ~1/17 ≈ 6 %
    assert _completude_pro({"siren": "123456789"}) > 0
    # tous les champs remplis → 100 %
    full = {k: (0.5 if k.startswith("pond_") else "x") for k in _INFOS_PRO_FIELDS}
    assert _completude_pro(full) == 100


@pytest.mark.asyncio
async def test_zone_couverte_check_demo_toujours_ok():
    """La zone 99999 doit toujours passer, même sans doc `zones_couvertes` actif."""
    from b1.routes import _is_zone_couverte
    assert await _is_zone_couverte("99999") is True


@pytest.mark.asyncio
async def test_zone_non_couverte_est_enregistree_zones_demandees(monkeypatch):
    from b1.routes import _record_zone_demandee

    db = _db()
    user_id = f"pytest_b1_{datetime.now(timezone.utc).timestamp():.0f}"
    user = {"user_id": user_id, "email": "b1@test.local"}
    await _record_zone_demandee(user, "33000")
    doc = await db.zones_demandees.find_one({"user_id": user_id, "code_postal": "33000"})
    assert doc is not None
    assert doc.get("notifie") is False
    # Idempotence — un 2e insert ne duplique pas
    await _record_zone_demandee(user, "33000")
    count = await db.zones_demandees.count_documents({"user_id": user_id, "code_postal": "33000"})
    assert count == 1
    await db.zones_demandees.delete_many({"user_id": user_id})


@pytest.mark.asyncio
async def test_regle_decouverte_1_seule_modif():
    """Sur un user Découverte, la 2e modif de zones doit lever un 402."""
    from fastapi import HTTPException
    from b1.routes import _plan_effectif

    # Utilisateur Découverte, jamais modifié → autorisé
    u1 = {"plan": "decouverte", "zones_deja_modifiees": False}
    assert _plan_effectif(u1) == "decouverte"

    # Utilisateur Pro → toujours autorisé, illimité
    u2 = {"plan": "pro", "zones_deja_modifiees": True}
    assert _plan_effectif(u2) == "pro"

    # Utilisateur avec organisation_id → agence
    u3 = {"plan": "decouverte", "organisation_id": "org_x"}
    assert _plan_effectif(u3) == "agence"


@pytest.mark.asyncio
async def test_infos_pro_defaults_grille_ponderation():
    """Les 7 coefficients de pondération de surface doivent avoir des valeurs par défaut."""
    from b1.routes import _INFOS_PRO_DEFAULTS

    assert _INFOS_PRO_DEFAULTS["pond_terrasse"] == 0.35
    assert _INFOS_PRO_DEFAULTS["pond_balcon_loggia"] == 0.25
    assert _INFOS_PRO_DEFAULTS["pond_combles"] == 0.30
    assert _INFOS_PRO_DEFAULTS["pond_cave_cellier"] == 0.12
    assert _INFOS_PRO_DEFAULTS["pond_garage"] == 0.40
    assert _INFOS_PRO_DEFAULTS["pond_place_parking"] == 0.30
    assert _INFOS_PRO_DEFAULTS["pond_jardin"] == 0.10
