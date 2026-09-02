"""Régression iteration_65 — fixes D1 :
- GET /api/d1/invitations : masque 'annulee' et 'acceptee'
- DELETE invitation puis GET : l'invitation annulée ne réapparaît pas
- DELETE /api/d1/equipe/{user_id} : plancher sieges_utilises >= 0
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
API = f"{_base.rstrip('/')}/api"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest.fixture(scope="module")
def mdb():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


def _new_session_user(email: str | None = None):
    email = email or f"test_d165_{uuid.uuid4().hex[:10]}@test.io"
    r = requests.post(f"{API}/v2/auth/send-email-code", json={"email": email}, timeout=30)
    assert r.status_code == 200, r.text[:300]
    code = r.json().get("dev_code")
    assert code
    r2 = requests.post(f"{API}/v2/auth/verify-email-code",
                       json={"email": email, "code": code}, timeout=30)
    assert r2.status_code == 200, r2.text[:300]
    body = r2.json()
    token = body.get("session_token") or body.get("token") or body.get("access_token")
    user_id = body.get("user_id") or (body.get("user") or {}).get("user_id")
    assert token and user_id, body
    return email, user_id, token


@pytest.fixture(scope="module")
def directeur(mdb):
    email, user_id, token = _new_session_user()
    orga_id = ObjectId()
    mdb.organisations.insert_one({
        "_id": orga_id, "nom": "TEST_Agence D1 REG65", "zones": ["75001"],
        "sieges_total": 5, "sieges_utilises": 1, "mode_repartition": "manuel",
    })
    mdb.users.update_one({"user_id": user_id}, {"$set": {
        "role": "directeur", "organisation_id": orga_id, "siege_statut": "actif",
        "plan": "agence", "prenom": "Dir", "nom": "Reg65"}})
    ctx = {"email": email, "user_id": user_id, "orga_id": orga_id,
           "headers": {"Authorization": f"Bearer {token}"}}
    yield ctx
    mdb.users.delete_many({"organisation_id": orga_id})
    mdb.users.delete_one({"user_id": user_id})
    mdb.organisations.delete_one({"_id": orga_id})
    mdb.invitations.delete_many({"organisation_id": orga_id})


def _insert_invit(mdb, orga_id, statut):
    email = f"test_i65_{uuid.uuid4().hex[:8]}@test.io"
    now = datetime.now(timezone.utc)
    _id = mdb.invitations.insert_one({
        "organisation_id": orga_id, "email": email, "statut": statut,
        "date_envoi": now.isoformat(),
        "date_expiration": (now + timedelta(days=14)).isoformat(),
    }).inserted_id
    return email, str(_id)


class TestInvitationsFiltre:
    def test_liste_masque_annulee_et_acceptee(self, directeur, mdb):
        e_env, id_env = _insert_invit(mdb, directeur["orga_id"], "envoyee")
        e_exp, id_exp = _insert_invit(mdb, directeur["orga_id"], "expiree")
        e_ann, id_ann = _insert_invit(mdb, directeur["orga_id"], "annulee")
        e_acc, id_acc = _insert_invit(mdb, directeur["orga_id"], "acceptee")

        r = requests.get(f"{API}/d1/invitations", headers=directeur["headers"], timeout=30)
        assert r.status_code == 200, r.text[:300]
        ids = {i["id"] for i in r.json()["invitations"]}
        statuts = {i["statut"] for i in r.json()["invitations"]}
        assert id_env in ids and id_exp in ids
        assert id_ann not in ids, "invitation 'annulee' toujours renvoyée"
        assert id_acc not in ids, "invitation 'acceptee' toujours renvoyée"
        assert statuts <= {"envoyee", "expiree"}, statuts
        mdb.invitations.delete_many({"email": {"$in": [e_env, e_exp, e_ann, e_acc]}})

    def test_delete_puis_get_ne_reapparait_pas(self, directeur, mdb):
        email = f"test_i65_{uuid.uuid4().hex[:8]}@test.io"
        r = requests.post(f"{API}/d1/invitations", json={"email": email},
                          headers=directeur["headers"], timeout=30)
        assert r.status_code == 200, r.text[:300]
        inv_id = r.json()["invitation"]["id"]

        r_list = requests.get(f"{API}/d1/invitations", headers=directeur["headers"], timeout=30)
        assert inv_id in {i["id"] for i in r_list.json()["invitations"]}

        r_del = requests.delete(f"{API}/d1/invitations/{inv_id}",
                                headers=directeur["headers"], timeout=30)
        assert r_del.status_code == 200, r_del.text[:300]

        r2 = requests.get(f"{API}/d1/invitations", headers=directeur["headers"], timeout=30)
        assert r2.status_code == 200
        assert inv_id not in {i["id"] for i in r2.json()["invitations"]}, \
            "l'invitation annulée réapparaît dans la liste"
        assert mdb.invitations.find_one({"_id": ObjectId(inv_id)})["statut"] == "annulee"
        mdb.invitations.delete_many({"email": email})


class TestSiegesPlancher:
    def test_retrait_ne_descend_pas_sous_zero(self, directeur, mdb):
        # Conseiller actif dans l'orga, mais compteur de sièges désynchronisé à 0
        c_email, c_user_id, _ = _new_session_user()
        mdb.users.update_one({"user_id": c_user_id}, {"$set": {
            "role": "conseiller", "organisation_id": directeur["orga_id"],
            "siege_statut": "actif", "plan": "agence"}})
        mdb.organisations.update_one({"_id": directeur["orga_id"]},
                                     {"$set": {"sieges_utilises": 0}})

        r = requests.delete(f"{API}/d1/equipe/{c_user_id}",
                            headers=directeur["headers"], timeout=30)
        assert r.status_code == 200, r.text[:300]
        used = mdb.organisations.find_one({"_id": directeur["orga_id"]})["sieges_utilises"]
        assert used >= 0, f"sieges_utilises négatif: {used}"
        assert used == 0
        u = mdb.users.find_one({"user_id": c_user_id})
        assert u["organisation_id"] is None
        assert u["role"] == "independant"
        assert u["plan"] == "decouverte"
        mdb.users.delete_one({"user_id": c_user_id})
        mdb.organisations.update_one({"_id": directeur["orga_id"]},
                                     {"$set": {"sieges_utilises": 1}})

    def test_retrait_normal_decremente(self, directeur, mdb):
        c_email, c_user_id, _ = _new_session_user()
        mdb.users.update_one({"user_id": c_user_id}, {"$set": {
            "role": "conseiller", "organisation_id": directeur["orga_id"],
            "siege_statut": "actif", "plan": "agence"}})
        mdb.organisations.update_one({"_id": directeur["orga_id"]},
                                     {"$set": {"sieges_utilises": 2}})
        r = requests.delete(f"{API}/d1/equipe/{c_user_id}",
                            headers=directeur["headers"], timeout=30)
        assert r.status_code == 200, r.text[:300]
        used = mdb.organisations.find_one({"_id": directeur["orga_id"]})["sieges_utilises"]
        assert used == 1, used
        mdb.users.delete_one({"user_id": c_user_id})
        mdb.organisations.update_one({"_id": directeur["orga_id"]},
                                     {"$set": {"sieges_utilises": 1}})
