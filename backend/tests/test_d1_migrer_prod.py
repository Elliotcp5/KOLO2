"""KOLO — Régression : POST /api/d1/admin/migrer-prod.

Ce fichier gèle 3 invariants critiques :
1. L'endpoint existe (auth via X-Admin-Secret).
2. L'index `enrichissements.id_parcelle` doit être créé avec
   `partialFilterExpression: {"id_parcelle": {"$type": "string"}}` — sinon
   `E11000 duplicate key error id_parcelle:null` casse la génération en prod.
3. `migrer_prod()` doit être strictement idempotent — deux exécutions
   consécutives ne doivent produire aucun changement à la 2e passe.
"""
from __future__ import annotations

import os
import pytest
from dotenv import load_dotenv

load_dotenv()

from d1.migration_prod import (
    EXPECTED_INDEXES, _diagnose_indexes, migrer_prod,
)
from d1.routes import router


def test_migrer_prod_endpoint_mounted():
    paths = {r.path for r in router.routes if "POST" in (getattr(r, "methods", set()) or set())}
    assert "/api/d1/admin/migrer-prod" in paths, "endpoint POST /api/d1/admin/migrer-prod manquant"


def test_enrichissements_id_parcelle_index_spec_is_partial():
    """L'entrée EXPECTED_INDEXES pour `enrichissements.id_parcelle` DOIT être
    unique + partialFilterExpression `{$type: "string"}` — c'est la seule
    forme qui accepte plusieurs docs avec `id_parcelle=null`."""
    found = None
    for coll, name, keys, opts in EXPECTED_INDEXES:
        if coll == "enrichissements" and keys == [("id_parcelle", 1)]:
            found = (name, opts)
            break
    assert found is not None, "index id_parcelle manquant dans EXPECTED_INDEXES"
    _, opts = found
    assert opts.get("unique") is True
    pfe = opts.get("partialFilterExpression")
    assert pfe == {"id_parcelle": {"$type": "string"}}, \
        f"partialFilterExpression incorrect : {pfe}"


def test_a2_indexes_source_uses_partial_filter():
    """Le code source `a2/indexes.py` DOIT créer l'index enrichissements
    avec `partialFilterExpression`. Sans ça, un simple restart de FastAPI
    recréera l'index cassé au startup."""
    src = open("/app/backend/a2/indexes.py").read()
    # Doit contenir la spec correcte
    assert '"id_parcelle"' in src
    assert 'partialFilterExpression={"id_parcelle": {"$type": "string"}}' in src
    # NE DOIT PAS contenir la spec cassée
    assert 'create_index("id_parcelle", unique=True),' not in src, \
        "ligne cassée `create_index('id_parcelle', unique=True)` toujours présente"


@pytest.mark.asyncio
async def test_migrer_prod_is_idempotent():
    """Exécute migrer_prod deux fois de suite. La 2e passe doit :
    - `fixes_needed_before` == 0 (aucun index cassé)
    - `applied` == 0 (rien à appliquer)
    - `users.patched` peut varier (super admin refresh à chaque appel).
    """
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        pytest.skip("MONGO_URL / DB_NAME non configurés")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # 1ère passe — met la base au propre
    r1 = await migrer_prod(db)
    # 2e passe — doit être no-op côté indexes/seeds
    r2 = await migrer_prod(db)
    assert len(r2["indexes"]["fixes_needed_before"]) == 0, \
        f"non idempotent — 2e passe trouve encore : {r2['indexes']['fixes_needed_before']}"
    assert len([a for a in r2["indexes"]["applied"] if a.get("status") == "ok"]) == 0
    assert len(r2["indexes"]["still_broken_after"]) == 0
    assert r2["seeds"]["zones_couvertes"]["created"] == 0
    client.close()


@pytest.mark.asyncio
async def test_diagnose_recognizes_correct_index_as_ok():
    """Un index déjà correctement créé (avec partial + unique) NE DOIT PAS
    être signalé comme `missing` ni `options_mismatch`."""
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        pytest.skip("MONGO_URL / DB_NAME non configurés")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    # Applique une fois pour avoir l'état propre
    await migrer_prod(db)
    fixes, ok = await _diagnose_indexes(db)
    ok_pairs = {(o["collection"], o["index"]) for o in ok}
    assert ("enrichissements", "id_parcelle_unique_partial") in ok_pairs
    assert ("opportunites", "uniq_orga_dpe") in ok_pairs
    assert not any(f["collection"] == "enrichissements"
                   and f["keys"] == [("id_parcelle", 1)]
                   for f in fixes), \
        "l'index correct est faussement signalé comme cassé"
    client.close()
