"""Tests C2 — Dossier PDF (Avis de valeur), Session 1.

Couvre :
  - `build_prefill` : structure, mapping type_bien, rehydratation depuis
    l'estimation, comparables, non-fuite de champs vides.
  - `DossierSections` : validation stricte des 22 ids de section.
  - Routes CRUD `/api/dossiers` : création, listing, détail, patch,
    isolation multi-user, non-régression avec l'estimation source.

Les tests d'intégration créent des docs Mongo réels + une session, puis
appellent l'API HTTP locale (backend en supervisor déjà lancé).
"""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from c2.prefill import build_prefill, generate_ref
from c2.schemas import SECTION_IDS, DossierSections


API = "http://localhost:8001"


def _db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


# ---------------------------------------------------------------------------
# Unit — DossierSections (Pydantic)
# ---------------------------------------------------------------------------
class TestDossierSections:
    def test_22_sections_exactement(self):
        assert len(SECTION_IDS) == 22

    def test_default_empty(self):
        s = DossierSections()
        d = s.model_dump()
        for sid in SECTION_IDS:
            assert sid in d
            assert d[sid] == {}

    def test_extra_section_rejected(self):
        with pytest.raises(Exception):
            DossierSections(inconnue={"foo": "bar"})


# ---------------------------------------------------------------------------
# Unit — generate_ref
# ---------------------------------------------------------------------------
class TestGenerateRef:
    def test_format(self):
        ref = generate_ref()
        assert ref.startswith("AV-")
        year, code = ref.split("-")[1], ref.split("-")[2]
        assert len(year) == 4 and year.isdigit()
        assert len(code) == 6 and all(c in "0123456789ABCDEF" for c in code)

    def test_unicity(self):
        assert generate_ref() != generate_ref()


# ---------------------------------------------------------------------------
# Unit — build_prefill (pure)
# ---------------------------------------------------------------------------
FAKE_ESTIM = {
    "estimation_id": "est_test_c2",
    "user_id": "u_c2_owner",
    "adresse": "12 rue de Test",
    "code_postal": "75017",
    "ville": "Paris 17ᵉ",
    "type_bien": "Appartement",
    "surface_habitable": 50.0,
    "classe_dpe": "F",
    "annee_construction": 1965,
    "inputs": {"etage": "3plus", "ascenseur": False, "etat": "a_rafraichir"},
    "resultat": {
        "valeur_venale": 480_000,
        "prix_commercialisation": 500_000,
        "fourchette_basse": 460_000,
        "fourchette_haute": 500_000,
        "prix_m2_retenu": 9_600,
        "surface_ponderee_m2": 50.0,
        "fiabilite": "elevee",
        "nb_comparables": 8,
        "radius_used_m": 500,
        "fenetre_mois": 24,
        "mediane_locale_prix_m2": 9_500,
        "net_vendeur": 470_000,
    },
    "comparables_figes": [
        {
            "adresse": "5 rue Voisine",
            "distance_m": 120,
            "prix": 460_000,
            "surface": 48,
            "type": "Appartement",
            "classe_dpe": "E",
            "nb_pieces": 2,
            "etage": 3,
            "date": "2025-06-01",
            "prix_m2_corrige": 9_400,
            "total_correction_pct": -0.02,
        },
    ],
}

FAKE_USER = {
    "user_id": "u_c2_owner",
    "prenom": "Camille",
    "nom": "Test",
    "email": "camille@example.test",
    "phone": "+33612345678",
    "infos_pro": {
        "agence": "Agence Test",
        "statut_juridique": "SAS",
        "siren": "123456789",
        "carte_t": "CPI-75-2024-000001",
        "cci": "Paris",
        "rcp_assureur": "MMA",
        "rcp_police": "POL-42",
        "garantie": "Galian 120 000 €",
        "honoraires_charge": "vendeur",
    },
}

FAKE_CONFIG = {"marge_negociation": 0.04, "dossier_validite_mois": 6}


class TestBuildPrefill:
    def test_toutes_les_sections_presentes(self):
        p = build_prefill(estim=FAKE_ESTIM, user=FAKE_USER, config=FAKE_CONFIG)
        for sid in SECTION_IDS:
            assert sid in p, f"section manquante: {sid}"

    def test_dossier_ref_et_dates(self):
        p = build_prefill(estim=FAKE_ESTIM, user=FAKE_USER, config=FAKE_CONFIG)
        d = p["dossier"]
        assert d["ref"].startswith("AV-")
        assert d["validite_mois"] == 6
        # date au format ISO
        datetime.fromisoformat(d["date_edition"])

    def test_redacteur_hydrate_depuis_infos_pro(self):
        p = build_prefill(estim=FAKE_ESTIM, user=FAKE_USER, config=FAKE_CONFIG)
        r = p["redacteur"]
        assert r["agent_nom"] == "Camille Test"
        assert r["agent_email"] == "camille@example.test"
        assert r["agence_nom"] == "Agence Test"
        assert r["carte_pro"] == "CPI-75-2024-000001"
        assert r["rcp_assureur"] == "MMA"

    def test_identification_type_bien_lowercase(self):
        p = build_prefill(estim=FAKE_ESTIM, user=FAKE_USER, config=FAKE_CONFIG)
        assert p["identification"]["type_bien"] == "appartement"
        assert p["identification"]["adresse"] == "12 rue de Test"
        assert p["identification"]["code_postal"] == "75017"
        assert p["identification"]["regime"] == "copropriété"

    def test_conclusion_reprend_chiffres_moteur(self):
        p = build_prefill(estim=FAKE_ESTIM, user=FAKE_USER, config=FAKE_CONFIG)
        c = p["conclusion"]
        assert c["valeur_venale"] == 480_000
        assert c["prix_presentation"] == 500_000
        assert c["prix_m2_retenu"] == 9_600
        assert c["marge_negociation"] == 0.04
        assert c["indice_confiance"] == "élevé"

    def test_comparables_formates(self):
        p = build_prefill(estim=FAKE_ESTIM, user=FAKE_USER, config=FAKE_CONFIG)
        rows = p["comparables"]["comparables"]
        assert len(rows) == 1
        r0 = rows[0]
        assert r0["nature"] == "vente actée"
        assert r0["distance"] == "120 m"
        assert r0["prix_m2"] == round(460_000 / 48)

    def test_energie_passoire_calculee(self):
        p = build_prefill(estim=FAKE_ESTIM, user=FAKE_USER, config=FAKE_CONFIG)
        assert p["energie"]["dpe_classe"] == "F"
        assert p["energie"]["passoire"] is True

    def test_maison_regime_monopropriete(self):
        estim = {**FAKE_ESTIM, "type_bien": "Maison"}
        p = build_prefill(estim=estim, user=FAKE_USER, config=FAKE_CONFIG)
        assert p["identification"]["type_bien"] == "maison"
        assert p["identification"]["regime"] == "monopropriété"

    def test_pas_de_champs_null_dans_redacteur(self):
        """`_redacteur_` filtre les champs vides pour ne pas polluer le PDF."""
        u = {"user_id": "x", "email": "a@b.c", "infos_pro": {"agence": "A"}}
        p = build_prefill(estim=FAKE_ESTIM, user=u, config=FAKE_CONFIG)
        for k, v in p["redacteur"].items():
            assert v not in (None, "")

    def test_creation_payload_pris_en_compte(self):
        p = build_prefill(
            estim=FAKE_ESTIM,
            user=FAKE_USER,
            config=FAKE_CONFIG,
            creation_payload={
                "demandeur_nom": "M. Martin",
                "objet": "succession",
                "date_visite": "2026-02-14",
                "bien_visite": True,
            },
        )
        assert p["mission"]["demandeur_nom"] == "M. Martin"
        assert p["mission"]["objet"] == "succession"
        assert p["mission"]["perimetre"] == "après visite physique"
        assert p["dossier"]["date_visite"] == "2026-02-14"
        assert p["dossier"]["bien_visite"] is True


# ---------------------------------------------------------------------------
# Integration — HTTP CRUD via backend supervisé
# ---------------------------------------------------------------------------
async def _seed_user_and_session(db, user_id: str) -> str:
    """Crée un user + une session en base, retourne le Bearer token."""
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            **{**FAKE_USER, "user_id": user_id},
        }},
        upsert=True,
    )
    token = "test_" + secrets.token_urlsafe(16)
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
    })
    return token


async def _seed_estimation(db, user_id: str) -> str:
    est_id = f"est_c2_{secrets.token_hex(4)}"
    doc = {
        **FAKE_ESTIM,
        "estimation_id": est_id,
        "user_id": user_id,
        "statut": "active",
        "date_creation": datetime.now(timezone.utc).isoformat(),
    }
    await db.estimations.insert_one(doc)
    return est_id


async def _cleanup(db, user_id: str) -> None:
    await db.dossiers.delete_many({"user_id": user_id})
    await db.estimations.delete_many({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.users.delete_one({"user_id": user_id})


@pytest.mark.asyncio
async def test_route_create_get_list_patch_end_to_end():
    db = _db()
    user_id = f"u_c2_e2e_{secrets.token_hex(3)}"
    try:
        token = await _seed_user_and_session(db, user_id)
        est_id = await _seed_estimation(db, user_id)
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(base_url=API, timeout=15) as client:
            # POST — création
            r = await client.post(
                "/api/dossiers",
                json={
                    "estimation_id": est_id,
                    "niveau": 1,
                    "demandeur_nom": "Mme Martin",
                    "objet": "mise en vente",
                    "date_visite": "2026-02-15",
                    "bien_visite": True,
                },
                headers=headers,
            )
            assert r.status_code == 200, r.text
            dossier = r.json()["dossier"]
            dossier_id = dossier["dossier_id"]
            assert dossier["niveau"] == 1
            assert dossier["statut"] == "brouillon"
            assert dossier["estimation_id"] == est_id
            # Pré-remplissage OK
            assert dossier["sections"]["identification"]["type_bien"] == "appartement"
            assert dossier["sections"]["conclusion"]["valeur_venale"] == 480_000
            assert dossier["sections"]["mission"]["demandeur_nom"] == "Mme Martin"

            # GET list — apparaît
            r = await client.get("/api/dossiers", headers=headers)
            assert r.status_code == 200
            lst = r.json()["dossiers"]
            assert any(d["dossier_id"] == dossier_id for d in lst)

            # GET detail
            r = await client.get(f"/api/dossiers/{dossier_id}", headers=headers)
            assert r.status_code == 200
            assert r.json()["dossier"]["dossier_id"] == dossier_id

            # PATCH — bascule niveau + statut + section
            r = await client.patch(
                f"/api/dossiers/{dossier_id}",
                json={
                    "niveau": 2,
                    "statut": "complet",
                    "sections": {
                        "swot": {
                            "atouts": ["Lumineux", "Traversant", "Métro à 3 min"],
                            "faiblesses": ["Chauffage vieillissant", "5ᵉ sans ascenseur"],
                        },
                    },
                },
                headers=headers,
            )
            assert r.status_code == 200, r.text
            after = r.json()["dossier"]
            assert after["niveau"] == 2
            assert after["statut"] == "complet"
            assert after["sections"]["swot"]["atouts"][0] == "Lumineux"
            # Les autres sections sont préservées
            assert after["sections"]["conclusion"]["valeur_venale"] == 480_000

            # PATCH — patch vide → 400
            r = await client.patch(
                f"/api/dossiers/{dossier_id}", json={}, headers=headers,
            )
            assert r.status_code == 400

            # PATCH — section inconnue silencieusement ignorée (whitelist)
            r = await client.patch(
                f"/api/dossiers/{dossier_id}",
                json={"sections": {"section_qui_nexiste_pas": {"x": 1}}},
                headers=headers,
            )
            assert r.status_code == 200
    finally:
        await _cleanup(db, user_id)


@pytest.mark.asyncio
async def test_create_dossier_401_sans_auth():
    async with httpx.AsyncClient(base_url=API, timeout=10) as client:
        r = await client.post("/api/dossiers", json={"estimation_id": "x"})
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_create_dossier_404_estimation_inconnue():
    db = _db()
    user_id = f"u_c2_404_{secrets.token_hex(3)}"
    try:
        token = await _seed_user_and_session(db, user_id)
        async with httpx.AsyncClient(base_url=API, timeout=10) as client:
            r = await client.post(
                "/api/dossiers",
                json={"estimation_id": "n_existe_pas"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert r.status_code == 404
    finally:
        await _cleanup(db, user_id)


@pytest.mark.asyncio
async def test_isolation_multi_user():
    db = _db()
    u_a = f"u_c2_iso_a_{secrets.token_hex(3)}"
    u_b = f"u_c2_iso_b_{secrets.token_hex(3)}"
    try:
        tok_a = await _seed_user_and_session(db, u_a)
        tok_b = await _seed_user_and_session(db, u_b)
        est_a = await _seed_estimation(db, u_a)
        h_a = {"Authorization": f"Bearer {tok_a}"}
        h_b = {"Authorization": f"Bearer {tok_b}"}
        async with httpx.AsyncClient(base_url=API, timeout=15) as client:
            r = await client.post(
                "/api/dossiers", json={"estimation_id": est_a}, headers=h_a,
            )
            assert r.status_code == 200
            dossier_id = r.json()["dossier"]["dossier_id"]

            # B ne voit pas le dossier de A
            r = await client.get(f"/api/dossiers/{dossier_id}", headers=h_b)
            assert r.status_code == 404
            r = await client.get("/api/dossiers", headers=h_b)
            assert all(d["dossier_id"] != dossier_id for d in r.json()["dossiers"])
            # B ne peut pas patcher
            r = await client.patch(
                f"/api/dossiers/{dossier_id}",
                json={"statut": "archive"},
                headers=h_b,
            )
            assert r.status_code == 404
    finally:
        await _cleanup(db, u_a)
        await _cleanup(db, u_b)
