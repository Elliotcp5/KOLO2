"""Tests HTTP end-to-end — BLOC D1 (agences, invitations, répartition, équipe).

Contrairement à test_d1.py (qui teste les helpers en direct), ce fichier
attaque les vrais endpoints via l'URL publique (REACT_APP_BACKEND_URL) avec
une session réelle (auth v2 email-code) et un seed Mongo pour le rôle
directeur.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from bson import ObjectId
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL manquant")
BASE_URL = _base.rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------
@pytest.fixture(scope="module")
def mdb():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


def _new_session_user(email: str | None = None) -> tuple[str, str, str]:
    """Crée un compte via v2 email-code. Retourne (email, user_id, token)."""
    email = email or f"test_d1_{uuid.uuid4().hex[:10]}@test.io"
    r = requests.post(f"{API}/v2/auth/send-email-code", json={"email": email}, timeout=30)
    assert r.status_code == 200, f"send-email-code: {r.status_code} {r.text[:300]}"
    code = r.json().get("dev_code")
    assert code, f"dev_code absent: {r.json()}"
    r2 = requests.post(
        f"{API}/v2/auth/verify-email-code", json={"email": email, "code": code}, timeout=30
    )
    assert r2.status_code == 200, f"verify-email-code: {r2.status_code} {r2.text[:300]}"
    body = r2.json()
    token = body.get("session_token") or body.get("token") or body.get("access_token")
    user_id = body.get("user_id") or (body.get("user") or {}).get("user_id")
    assert token, f"token absent: {body}"
    assert user_id, f"user_id absent: {body}"
    return email, user_id, token


@pytest.fixture(scope="module")
def plain_user():
    """Compte vierge (independant) — utilisé pour vérifier les 403."""
    return _new_session_user()


@pytest.fixture(scope="module")
def directeur(mdb):
    """Compte promu directeur + organisation seed."""
    email, user_id, token = _new_session_user()
    orga_id = ObjectId()
    mdb.organisations.insert_one({
        "_id": orga_id,
        "nom": "TEST_Agence D1 HTTP",
        "adresse": "1 rue du Test",
        "telephone": "+33100000000",
        "zones": ["75001"],
        "sieges_total": 3,
        "sieges_utilises": 1,
        "mode_repartition": "manuel",
        "directeur_prospecte": False,
    })
    mdb.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": "directeur", "organisation_id": orga_id,
                  "siege_statut": "actif", "plan": "agence", "prenom": "Dir",
                  "nom": "Test"}},
    )
    ctx = {"email": email, "user_id": user_id, "token": token, "orga_id": orga_id,
           "headers": {"Authorization": f"Bearer {token}"}}
    yield ctx
    # cleanup
    mdb.users.delete_many({"organisation_id": orga_id})
    mdb.users.delete_one({"user_id": user_id})
    mdb.organisations.delete_one({"_id": orga_id})
    mdb.invitations.delete_many({"organisation_id": orga_id})
    mdb.opportunites.delete_many({"organisation_id": orga_id})


# --------------------------------------------------------------------------
# Conformité Apple — aucun POST /api/d1/organisations
# --------------------------------------------------------------------------
class TestAppleConformite:
    def test_post_organisations_not_allowed(self, directeur):
        r = requests.post(f"{API}/d1/organisations", json={"nom": "X"},
                          headers=directeur["headers"], timeout=30)
        assert r.status_code in (404, 405), f"POST /api/d1/organisations → {r.status_code} {r.text[:200]}"

    def test_post_organisations_slash_not_allowed(self, directeur):
        r = requests.post(f"{API}/d1/organisations/", json={"nom": "X"},
                          headers=directeur["headers"], timeout=30)
        assert r.status_code in (404, 405, 307)


# --------------------------------------------------------------------------
# Invitation check public
# --------------------------------------------------------------------------
class TestInvitationCheckPublic:
    def test_check_unknown_email_public(self):
        r = requests.get(f"{API}/d1/invitations/check",
                         params={"email": f"nobody_{uuid.uuid4().hex[:8]}@test.io"}, timeout=30)
        assert r.status_code == 200, r.text[:200]
        assert r.json() == {"invited": False}

    def test_check_invited_email_public(self, directeur, mdb):
        email = f"test_check_{uuid.uuid4().hex[:8]}@test.io"
        mdb.invitations.insert_one({
            "organisation_id": directeur["orga_id"], "email": email, "statut": "envoyee",
            "date_envoi": datetime.now(timezone.utc).isoformat(),
            "date_expiration": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
        })
        r = requests.get(f"{API}/d1/invitations/check", params={"email": email}, timeout=30)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert data["invited"] is True
        assert data["agence"] == "TEST_Agence D1 HTTP"
        assert data.get("expire_le")
        mdb.invitations.delete_many({"email": email})


# --------------------------------------------------------------------------
# RBAC — 403 pour un compte non directeur
# --------------------------------------------------------------------------
class TestRBAC:
    ENDPOINTS = [
        ("GET", "/d1/organisations/me", None),
        ("PATCH", "/d1/organisations/me", {"nom": "Hack"}),
        ("GET", "/d1/invitations", None),
        ("POST", "/d1/invitations", {"email": "x@test.io"}),
        ("GET", "/d1/equipe", None),
        ("POST", "/d1/opportunites/auto-reste", None),
    ]

    @pytest.mark.parametrize("method,path,body", ENDPOINTS)
    def test_non_directeur_403(self, plain_user, method, path, body):
        _, _, token = plain_user
        r = requests.request(method, f"{API}{path}", json=body,
                             headers={"Authorization": f"Bearer {token}"}, timeout=30)
        assert r.status_code == 403, f"{method} {path} → {r.status_code} {r.text[:200]}"

    @pytest.mark.parametrize("method,path,body", ENDPOINTS)
    def test_anonyme_401(self, method, path, body):
        r = requests.request(method, f"{API}{path}", json=body, timeout=30)
        assert r.status_code == 401, f"{method} {path} anon → {r.status_code} {r.text[:200]}"


# --------------------------------------------------------------------------
# Organisation GET/PATCH
# --------------------------------------------------------------------------
class TestOrganisationMe:
    def test_get_me(self, directeur):
        r = requests.get(f"{API}/d1/organisations/me", headers=directeur["headers"], timeout=30)
        assert r.status_code == 200, r.text[:300]
        o = r.json()["organisation"]
        assert o["nom"] == "TEST_Agence D1 HTTP"
        assert o["sieges_total"] == 3
        assert o["id"] == str(directeur["orga_id"])
        assert "_id" not in o
        # aucun montant exposé
        assert not any(k in o for k in ("montant", "prix", "amount", "price"))

    def test_patch_and_persist(self, directeur):
        r = requests.patch(f"{API}/d1/organisations/me",
                           json={"nom": "TEST_Agence D1 HTTP", "mode_repartition": "mixte",
                                 "zones": ["75001", "75002"], "directeur_prospecte": True},
                           headers=directeur["headers"], timeout=30)
        assert r.status_code == 200, r.text[:300]
        o = r.json()["organisation"]
        assert o["mode_repartition"] == "mixte"
        assert o["zones"] == ["75001", "75002"]
        assert o["directeur_prospecte"] is True
        # GET pour vérifier la persistance
        r2 = requests.get(f"{API}/d1/organisations/me", headers=directeur["headers"], timeout=30)
        o2 = r2.json()["organisation"]
        assert o2["mode_repartition"] == "mixte"
        assert o2["zones"] == ["75001", "75002"]
        # remise à l'état initial
        requests.patch(f"{API}/d1/organisations/me",
                       json={"mode_repartition": "manuel", "zones": ["75001"],
                             "directeur_prospecte": False},
                       headers=directeur["headers"], timeout=30)

    def test_patch_empty_400(self, directeur):
        r = requests.patch(f"{API}/d1/organisations/me", json={},
                           headers=directeur["headers"], timeout=30)
        assert r.status_code == 400, r.text[:200]

    def test_patch_mode_invalide_422(self, directeur):
        r = requests.patch(f"{API}/d1/organisations/me", json={"mode_repartition": "nimportequoi"},
                           headers=directeur["headers"], timeout=30)
        assert r.status_code == 422, r.text[:200]

    def test_patch_zone_invalide_422(self, directeur):
        r = requests.patch(f"{API}/d1/organisations/me", json={"zones": ["7500"]},
                           headers=directeur["headers"], timeout=30)
        assert r.status_code == 422, r.text[:200]


# --------------------------------------------------------------------------
# Invitations CRUD + plafond + doublons
# --------------------------------------------------------------------------
class TestInvitations:
    def test_create_list_relancer_annuler(self, directeur, mdb):
        email = f"test_inv_{uuid.uuid4().hex[:8]}@test.io"
        r = requests.post(f"{API}/d1/invitations", json={"email": email.upper()},
                          headers=directeur["headers"], timeout=30)
        assert r.status_code == 200, r.text[:300]
        inv = r.json()["invitation"]
        assert inv["email"] == email  # normalisé lower
        assert inv["statut"] == "envoyee"
        inv_id = inv["id"]

        # liste
        r2 = requests.get(f"{API}/d1/invitations", headers=directeur["headers"], timeout=30)
        assert r2.status_code == 200
        assert any(i["id"] == inv_id for i in r2.json()["invitations"])

        # doublon → 409 deja_invite
        r3 = requests.post(f"{API}/d1/invitations", json={"email": email},
                           headers=directeur["headers"], timeout=30)
        assert r3.status_code == 409, r3.text[:200]
        assert r3.json().get("detail") == "deja_invite"

        # relancer
        r4 = requests.post(f"{API}/d1/invitations/{inv_id}/relancer",
                           headers=directeur["headers"], timeout=30)
        assert r4.status_code == 200, r4.text[:300]
        assert r4.json()["invitation"]["statut"] == "envoyee"

        # annuler
        r5 = requests.delete(f"{API}/d1/invitations/{inv_id}",
                             headers=directeur["headers"], timeout=30)
        assert r5.status_code == 200, r5.text[:200]
        assert mdb.invitations.find_one({"_id": ObjectId(inv_id)})["statut"] == "annulee"
        mdb.invitations.delete_many({"email": email})

    def test_email_invalide_422(self, directeur):
        r = requests.post(f"{API}/d1/invitations", json={"email": "pas-un-email"},
                          headers=directeur["headers"], timeout=30)
        assert r.status_code == 422, r.text[:200]

    def test_plafond_sieges_402(self, directeur, mdb):
        """sieges_total=3, sieges_utilises=1 → 2 invitations OK, la 3e refusée."""
        mdb.invitations.delete_many({"organisation_id": directeur["orga_id"]})
        emails = [f"test_pl{i}_{uuid.uuid4().hex[:6]}@test.io" for i in range(3)]
        codes = []
        for e in emails:
            r = requests.post(f"{API}/d1/invitations", json={"email": e},
                              headers=directeur["headers"], timeout=30)
            codes.append(r.status_code)
        assert codes[:2] == [200, 200], f"invitations initiales: {codes}"
        assert codes[2] == 402, f"plafond non appliqué: {codes}"
        mdb.invitations.delete_many({"organisation_id": directeur["orga_id"]})

    def test_deja_membre_409(self, directeur, mdb):
        member_email = f"test_mbr_{uuid.uuid4().hex[:8]}@test.io"
        mdb.users.insert_one({
            "user_id": f"u_test_{uuid.uuid4().hex[:8]}", "email": member_email,
            "role": "conseiller", "organisation_id": directeur["orga_id"],
            "siege_statut": "actif",
        })
        r = requests.post(f"{API}/d1/invitations", json={"email": member_email},
                          headers=directeur["headers"], timeout=30)
        assert r.status_code == 409, r.text[:200]
        assert r.json().get("detail") == "deja_membre"
        mdb.users.delete_many({"email": member_email})

    def test_invitation_autre_orga_404(self, directeur, mdb):
        other = ObjectId()
        ins = mdb.invitations.insert_one({
            "organisation_id": other, "email": "test_other@test.io", "statut": "envoyee",
            "date_envoi": datetime.now(timezone.utc).isoformat(),
            "date_expiration": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        })
        r = requests.delete(f"{API}/d1/invitations/{ins.inserted_id}",
                            headers=directeur["headers"], timeout=30)
        assert r.status_code == 404, r.text[:200]
        mdb.invitations.delete_one({"_id": ins.inserted_id})


# --------------------------------------------------------------------------
# Attribution / retrait / auto-reste
# --------------------------------------------------------------------------
def _seed_conseiller(mdb, orga_id, suffix=""):
    uid = f"u_test_c{suffix}_{uuid.uuid4().hex[:8]}"
    mdb.users.insert_one({
        "user_id": uid, "email": f"{uid}@test.io", "role": "conseiller",
        "organisation_id": orga_id, "siege_statut": "actif", "plan": "agence",
        "prenom": f"C{suffix}", "nom": "Test", "zones_deja_modifiees": True,
    })
    return uid


def _seed_opp(mdb, orga_id, statut="proposee", assigne_a=None):
    oid = ObjectId()
    doc = {"_id": oid, "organisation_id": orga_id, "statut": statut,
           "dpe_id": f"dpe_test_{oid}"}
    if assigne_a:
        doc["assigne_a"] = assigne_a
        doc["date_attribution"] = datetime.now(timezone.utc).isoformat()
    mdb.opportunites.insert_one(doc)
    return oid


class TestAttribution:
    def test_attribuer_unitaire(self, directeur, mdb):
        uid = _seed_conseiller(mdb, directeur["orga_id"], "a")
        oid = _seed_opp(mdb, directeur["orga_id"])
        r = requests.post(f"{API}/d1/opportunites/{oid}/attribuer", json={"user_id": uid},
                          headers=directeur["headers"], timeout=30)
        assert r.status_code == 200, r.text[:300]
        opp = mdb.opportunites.find_one({"_id": oid})
        assert opp["assigne_a"] == uid
        assert opp.get("date_attribution")
        mdb.users.delete_one({"user_id": uid})
        mdb.opportunites.delete_one({"_id": oid})

    def test_attribuer_membre_hors_orga_400(self, directeur, mdb):
        oid = _seed_opp(mdb, directeur["orga_id"])
        r = requests.post(f"{API}/d1/opportunites/{oid}/attribuer",
                          json={"user_id": "u_inexistant_zzz"},
                          headers=directeur["headers"], timeout=30)
        assert r.status_code == 400, r.text[:200]
        mdb.opportunites.delete_one({"_id": oid})

    def test_attribuer_opp_autre_orga_404(self, directeur, mdb):
        uid = _seed_conseiller(mdb, directeur["orga_id"], "b")
        oid = _seed_opp(mdb, ObjectId())
        r = requests.post(f"{API}/d1/opportunites/{oid}/attribuer", json={"user_id": uid},
                          headers=directeur["headers"], timeout=30)
        assert r.status_code == 404, r.text[:200]
        mdb.users.delete_one({"user_id": uid})
        mdb.opportunites.delete_one({"_id": oid})

    def test_attribuer_lot_ignore_hors_orga(self, directeur, mdb):
        uid = _seed_conseiller(mdb, directeur["orga_id"], "c")
        ok_ids = [_seed_opp(mdb, directeur["orga_id"]) for _ in range(2)]
        foreign = _seed_opp(mdb, ObjectId())
        r = requests.post(f"{API}/d1/opportunites/attribuer-lot",
                          json={"opportunite_ids": [str(i) for i in ok_ids] +
                                [str(foreign), "not-an-objectid"],
                                "user_id": uid},
                          headers=directeur["headers"], timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["attribuees"] == 2, data
        assert data["ignorees"] == 2, data
        for i in ok_ids:
            assert mdb.opportunites.find_one({"_id": i})["assigne_a"] == uid
        assert mdb.opportunites.find_one({"_id": foreign}).get("assigne_a") is None
        mdb.users.delete_one({"user_id": uid})
        mdb.opportunites.delete_many({"_id": {"$in": ok_ids + [foreign]}})

    def test_auto_reste_round_robin(self, directeur, mdb):
        u1 = _seed_conseiller(mdb, directeur["orga_id"], "r1")
        u2 = _seed_conseiller(mdb, directeur["orga_id"], "r2")
        oids = [_seed_opp(mdb, directeur["orga_id"]) for _ in range(5)]
        r = requests.post(f"{API}/d1/opportunites/auto-reste",
                          headers=directeur["headers"], timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["attribuees"] >= 5, data
        counts = {u1: 0, u2: 0}
        for i in oids:
            a = mdb.opportunites.find_one({"_id": i}).get("assigne_a")
            assert a in counts, f"opp non attribuée ou hors équipe: {a}"
            counts[a] += 1
        assert abs(counts[u1] - counts[u2]) <= 1, counts
        mdb.users.delete_many({"user_id": {"$in": [u1, u2]}})
        mdb.opportunites.delete_many({"_id": {"$in": oids}})

    @pytest.mark.parametrize("statut", ["a_demarcher", "demarchee", "mandat_signe", "abandon"])
    def test_retirer_refuse_409(self, directeur, mdb, statut):
        uid = _seed_conseiller(mdb, directeur["orga_id"], "x")
        oid = _seed_opp(mdb, directeur["orga_id"], statut=statut, assigne_a=uid)
        r = requests.post(f"{API}/d1/opportunites/{oid}/retirer",
                          headers=directeur["headers"], timeout=30)
        assert r.status_code == 409, f"{statut} → {r.status_code} {r.text[:200]}"
        assert r.json().get("detail") == "retrait_refuse"
        assert mdb.opportunites.find_one({"_id": oid})["assigne_a"] == uid
        mdb.users.delete_one({"user_id": uid})
        mdb.opportunites.delete_one({"_id": oid})

    def test_retirer_ok_si_proposee(self, directeur, mdb):
        uid = _seed_conseiller(mdb, directeur["orga_id"], "y")
        oid = _seed_opp(mdb, directeur["orga_id"], statut="proposee", assigne_a=uid)
        r = requests.post(f"{API}/d1/opportunites/{oid}/retirer",
                          headers=directeur["headers"], timeout=30)
        assert r.status_code == 200, r.text[:300]
        opp = mdb.opportunites.find_one({"_id": oid})
        assert opp.get("assigne_a") is None
        assert opp.get("date_attribution") is None
        mdb.users.delete_one({"user_id": uid})
        mdb.opportunites.delete_one({"_id": oid})


# --------------------------------------------------------------------------
# Équipe : liste + métriques + retrait conseiller (6 règles) via HTTP réel
# --------------------------------------------------------------------------
class TestEquipe:
    def test_liste_equipe(self, directeur, mdb):
        uid = _seed_conseiller(mdb, directeur["orga_id"], "e")
        oid = _seed_opp(mdb, directeur["orga_id"], statut="mandat_signe", assigne_a=uid)
        r = requests.get(f"{API}/d1/equipe", params={"periode": "mois"},
                         headers=directeur["headers"], timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["periode"] == "mois"
        ligne = next((l for l in data["equipe"] if l["user_id"] == uid), None)
        assert ligne is not None, data["equipe"]
        assert ligne["attribuees"] == 1
        assert ligne["mandats"] == 1
        assert ligne["taux_traitement_pct"] == 100
        assert "alerte_48h" in ligne
        assert isinstance(data["alerte_48h_total"], int)
        mdb.users.delete_one({"user_id": uid})
        mdb.opportunites.delete_one({"_id": oid})

    def test_equipe_periode_semaine(self, directeur):
        r = requests.get(f"{API}/d1/equipe", params={"periode": "semaine"},
                         headers=directeur["headers"], timeout=30)
        assert r.status_code == 200
        assert r.json()["periode"] == "semaine"

    def test_retirer_conseiller_6_regles(self, directeur, mdb):
        orga_id = directeur["orga_id"]
        before = mdb.organisations.find_one({"_id": orga_id})["sieges_utilises"]
        uid = _seed_conseiller(mdb, orga_id, "rm")
        mdb.organisations.update_one({"_id": orga_id}, {"$inc": {"sieges_utilises": 1}})
        oid_pool = _seed_opp(mdb, orga_id, statut="proposee", assigne_a=uid)
        oid_work = _seed_opp(mdb, orga_id, statut="a_demarcher", assigne_a=uid)

        r = requests.delete(f"{API}/d1/equipe/{uid}", headers=directeur["headers"], timeout=30)
        assert r.status_code == 200, r.text[:300]

        # 1) opp proposee retourne au pool
        pool = mdb.opportunites.find_one({"_id": oid_pool})
        assert pool.get("assigne_a") is None
        assert pool.get("date_attribution") is None
        # 2) opp travaillée reste
        work = mdb.opportunites.find_one({"_id": oid_work})
        assert work.get("assigne_a") == uid
        assert work.get("statut") == "a_demarcher"
        # 3-5) user rétrogradé, compte conservé
        u = mdb.users.find_one({"user_id": uid})
        assert u is not None, "le compte ne doit pas être supprimé"
        assert u["role"] == "independant"
        assert u["organisation_id"] is None
        assert u["siege_statut"] == "desactive"
        assert u["plan"] == "decouverte"
        assert u["zones_deja_modifiees"] is False
        # 6) sièges décrémenté
        after = mdb.organisations.find_one({"_id": orga_id})["sieges_utilises"]
        assert after == before, f"sieges_utilises attendu {before}, obtenu {after}"

        mdb.users.delete_one({"user_id": uid})
        mdb.opportunites.delete_many({"_id": {"$in": [oid_pool, oid_work]}})

    def test_retirer_self_400(self, directeur):
        r = requests.delete(f"{API}/d1/equipe/{directeur['user_id']}",
                            headers=directeur["headers"], timeout=30)
        assert r.status_code == 400, r.text[:200]

    def test_retirer_membre_autre_orga_404(self, directeur, mdb):
        uid = _seed_conseiller(mdb, ObjectId(), "z")
        r = requests.delete(f"{API}/d1/equipe/{uid}", headers=directeur["headers"], timeout=30)
        assert r.status_code == 404, r.text[:200]
        mdb.users.delete_one({"user_id": uid})


# --------------------------------------------------------------------------
# Signup + auto-rattachement conseiller
# --------------------------------------------------------------------------
class TestSignupAttach:
    def test_register_email_invite_devient_conseiller(self, directeur, mdb):
        """POST /api/auth/register avec un email invité → conseiller rattaché."""
        email = f"test_reg_{uuid.uuid4().hex[:8]}@test.io"
        mdb.invitations.insert_one({
            "organisation_id": directeur["orga_id"], "email": email, "statut": "envoyee",
            "date_envoi": datetime.now(timezone.utc).isoformat(),
            "date_expiration": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
        })
        before = mdb.organisations.find_one({"_id": directeur["orga_id"]})["sieges_utilises"]
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Test1234!", "full_name": "Test Conseiller",
            "phone": "0612345678", "country_code": "FR",
        }, timeout=30)
        assert r.status_code == 200, f"register: {r.status_code} {r.text[:300]}"
        u = mdb.users.find_one({"email": email})
        assert u is not None
        assert u["role"] == "conseiller"
        assert u["organisation_id"] == directeur["orga_id"]
        assert u["plan"] == "agence"
        assert u["siege_statut"] == "actif"
        assert mdb.invitations.find_one({"email": email})["statut"] == "acceptee"
        after = mdb.organisations.find_one({"_id": directeur["orga_id"]})["sieges_utilises"]
        assert after == before + 1
        mdb.users.delete_many({"email": email})
        mdb.invitations.delete_many({"email": email})
        mdb.organisations.update_one({"_id": directeur["orga_id"]},
                                     {"$set": {"sieges_utilises": before}})

    def test_email_code_signup_invite_devient_conseiller(self, directeur, mdb):
        """Chemin réel de l'app iOS (v2 email-code) : un email invité doit
        également être rattaché comme conseiller."""
        email = f"test_ec_{uuid.uuid4().hex[:8]}@test.io"
        mdb.invitations.insert_one({
            "organisation_id": directeur["orga_id"], "email": email, "statut": "envoyee",
            "date_envoi": datetime.now(timezone.utc).isoformat(),
            "date_expiration": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
        })
        _new_session_user(email)
        u = mdb.users.find_one({"email": email})
        assert u is not None
        try:
            assert u.get("role") == "conseiller", (
                f"role={u.get('role')} — le hook attach_conseiller_if_invited n'est pas "
                "branché sur /api/v2/auth/verify-email-code (chemin de signup de l'app)"
            )
            assert u.get("organisation_id") == directeur["orga_id"]
            assert u.get("plan") == "agence"
        finally:
            mdb.users.delete_many({"email": email})
            mdb.invitations.delete_many({"email": email})
            mdb.v2_email_codes.delete_many({"email": email})


# --------------------------------------------------------------------------
# Onboarding — pas d'élévation de rôle
# --------------------------------------------------------------------------
class TestOnboardingRole:
    def test_statut_declare_directeur_ne_donne_pas_le_role(self, mdb):
        email, user_id, token = _new_session_user()
        r = requests.post(f"{API}/onboarding/profil", json={
            "statut_declare": "directeur", "prenom": "Jean", "nom": "Dupont",
            "zones": ["75001"], "langue": "fr",
        }, headers={"Authorization": f"Bearer {token}"}, timeout=30)
        assert r.status_code in (200, 422), r.text[:300]
        if r.status_code == 200:
            u = mdb.users.find_one({"user_id": user_id})
            assert u.get("role") == "independant", f"role élevé à {u.get('role')}"
            assert not u.get("organisation_id")
            # et l'API directeur reste interdite
            r2 = requests.get(f"{API}/d1/organisations/me",
                              headers={"Authorization": f"Bearer {token}"}, timeout=30)
            assert r2.status_code == 403
        mdb.users.delete_many({"email": email})
