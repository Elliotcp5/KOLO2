"""Tests A2 — quotas Découverte / Pro / Agence sur DB Mongo temporaire.

Utilise une DB `kolo_test_a2` isolée (dropée entre tests). Le test le plus
important : Découverte refuse la 2e estimation dans la semaine, Pro l'autorise
(critère de recette explicite de la fiche A2).
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import pytest
import pytest_asyncio

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from a2.config import DEFAULT_CONFIG, ensure_config_seeded, _bust_cache  # noqa: E402
from a2.indexes import ensure_a2_indexes  # noqa: E402
from a2.quotas import verifier_quota, incrementer_quota  # noqa: E402
from tests._mongo_shared import new_client, reset_test_db, close, _ensure_a2_indexes_with_retry  # noqa: E402


TEST_DB_NAME = "kolo_test_a2_quotas"


@pytest_asyncio.fixture
async def db():
    client = new_client()
    db = await reset_test_db(client, TEST_DB_NAME)
    await _ensure_a2_indexes_with_retry(db)
    await ensure_config_seeded(db)
    _bust_cache()
    yield db
    await close(client)


@pytest.mark.asyncio
class TestDecouverteEstimationHebdo:
    """Critère de recette : Découverte refuse la 2e estimation dans la semaine."""

    async def test_decouverte_1st_estimation_autorisee(self, db):
        user = {"user_id": "u_decouverte", "plan": "decouverte", "organisation_id": None}
        ok, ctx = await verifier_quota(db, user, "estimation")
        assert ok is True
        assert ctx["plan"] == "decouverte"
        assert ctx["kind"] == "hebdo"
        assert ctx["limite"] == 1
        assert ctx["compteur"] == 0

    async def test_decouverte_2nd_estimation_refusee(self, db):
        user = {"user_id": "u_decouverte", "plan": "decouverte", "organisation_id": None}
        # 1re estimation : autorisée + incrément
        ok, _ = await verifier_quota(db, user, "estimation")
        assert ok
        await incrementer_quota(db, user, "estimation")
        # 2e : refusée dans la même semaine
        ok, ctx = await verifier_quota(db, user, "estimation")
        assert ok is False
        assert ctx["compteur"] == 1
        assert ctx["limite"] == 1

    async def test_pro_estimations_illimitees(self, db):
        user = {"user_id": "u_pro", "plan": "pro", "organisation_id": None}
        for _ in range(10):
            ok, ctx = await verifier_quota(db, user, "estimation")
            assert ok is True, ctx
            await incrementer_quota(db, user, "estimation")
        # Vérifie que la limite reste "illimite"
        _, ctx = await verifier_quota(db, user, "estimation")
        assert ctx["limite"] == "illimite"


@pytest.mark.asyncio
class TestQuotaOpportuniteQuotidien:
    async def test_pro_max_5_par_jour(self, db):
        user = {"user_id": "u_pro", "plan": "pro", "organisation_id": None}
        for i in range(5):
            ok, _ = await verifier_quota(db, user, "opportunite")
            assert ok, f"iter {i}"
            await incrementer_quota(db, user, "opportunite")
        ok, ctx = await verifier_quota(db, user, "opportunite")
        assert ok is False
        assert ctx["compteur"] == 5
        assert ctx["limite"] == 5

    async def test_agence_conseiller_max_5_par_jour(self, db):
        """Un conseiller (organisation_id != null) partage la même limite que Pro."""
        from bson import ObjectId
        user = {"user_id": "u_conseiller", "plan": "decouverte",
                "organisation_id": ObjectId()}
        # Il est en 'agence' via son organisation_id, même si son plan legacy est decouverte
        for _ in range(5):
            ok, _ = await verifier_quota(db, user, "opportunite")
            assert ok
            await incrementer_quota(db, user, "opportunite")
        ok, ctx = await verifier_quota(db, user, "opportunite")
        assert ok is False
        assert ctx["plan"] == "agence"


@pytest.mark.asyncio
class TestQuotaIsole:
    """Deux users différents ont des compteurs isolés."""

    async def test_two_users_independent(self, db):
        u1 = {"user_id": "u1", "plan": "decouverte"}
        u2 = {"user_id": "u2", "plan": "decouverte"}
        await incrementer_quota(db, u1, "estimation")
        _, ctx1 = await verifier_quota(db, u1, "estimation")
        _, ctx2 = await verifier_quota(db, u2, "estimation")
        assert ctx1["compteur"] == 1
        assert ctx2["compteur"] == 0
