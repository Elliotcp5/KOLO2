"""Test A2 — règle métier « 2 conseillers d'une même agence ne reçoivent
jamais la même opportunité ». C'est LA règle qui fait vendre le produit à
un directeur, elle doit être couverte par un test automatisé.

Modélisation : index unique partiel `(organisation_id, dpe_id)` sur
`opportunites`, filtré par `organisation_id != null` et `dpe_id != null`.

Cas testés :
  - même organisation + même dpe_id → duplicate rejeté par Mongo
  - même dpe_id partagé entre 2 organisations → autorisé (voulu)
  - indépendants (organisation_id null) : pas de contrainte, plusieurs peuvent
    porter le même dpe_id
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
import pytest_asyncio
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from a2.indexes import ensure_a2_indexes  # noqa: E402
from tests._mongo_shared import new_client, reset_test_db, close, _ensure_a2_indexes_with_retry  # noqa: E402

TEST_DB_NAME = "kolo_test_a2_opportunites"


@pytest_asyncio.fixture
async def db():
    client = new_client()
    db = await reset_test_db(client, TEST_DB_NAME)
    await _ensure_a2_indexes_with_retry(db)
    yield db
    await close(client)


def _opportunite(orga_id, dpe_id, assigne_a):
    return {
        "organisation_id": orga_id,
        "user_id": None,
        "assigne_a": assigne_a,
        "dpe_id": dpe_id,
        "code_postal": "75017",
        "adresse": "1 rue de test",
        "statut": "pool",
    }


@pytest.mark.asyncio
class TestUniciteOpportuniteParAgence:

    async def test_meme_orga_meme_dpe_bloquee(self, db):
        """Règle FONDAMENTALE : Mongo refuse d'insérer une seconde opportunité
        avec (organisation_id, dpe_id) identique."""
        orga = ObjectId()
        dpe = "DPE_75017_ABC"
        await db.opportunites.insert_one(_opportunite(orga, dpe, ObjectId()))
        # Un DEUXIÈME conseiller de la même agence, autre user, MÊME dpe → refusé.
        with pytest.raises(DuplicateKeyError):
            await db.opportunites.insert_one(_opportunite(orga, dpe, ObjectId()))

    async def test_deux_orgas_meme_dpe_autorisees(self, db):
        """Deux agences distinctes sur le même code postal peuvent tomber sur
        le même DPE — c'est voulu, comme les leads achetés."""
        orga_a = ObjectId()
        orga_b = ObjectId()
        dpe = "DPE_75017_XYZ"
        await db.opportunites.insert_one(_opportunite(orga_a, dpe, ObjectId()))
        # Une autre agence, même DPE → OK
        await db.opportunites.insert_one(_opportunite(orga_b, dpe, ObjectId()))
        count = await db.opportunites.count_documents({"dpe_id": dpe})
        assert count == 2

    async def test_independants_pas_de_contrainte(self, db):
        """Deux indépendants (organisation_id=None) peuvent porter le même DPE."""
        dpe = "DPE_75017_QRS"
        await db.opportunites.insert_one(_opportunite(None, dpe, None))
        # Un autre indépendant, même DPE → autorisé (index partiel filtre null)
        await db.opportunites.insert_one(_opportunite(None, dpe, None))
        count = await db.opportunites.count_documents({"dpe_id": dpe})
        assert count == 2

    async def test_meme_orga_dpe_null_autorises(self, db):
        """Les opportunités virtuelles (dpe_id null) ne sont pas soumises à
        la contrainte (l'index partiel filtre aussi dpe_id != null)."""
        orga = ObjectId()
        await db.opportunites.insert_one(_opportunite(orga, None, ObjectId()))
        await db.opportunites.insert_one(_opportunite(orga, None, ObjectId()))
        count = await db.opportunites.count_documents({"organisation_id": orga})
        assert count == 2
