"""Seed un directeur + orga + conseillers + opportunités et imprime le token."""
import json
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

import requests
from bson import ObjectId
from dotenv import dotenv_values
from pymongo import MongoClient

env = dotenv_values("/app/backend/.env")
fenv = dotenv_values("/app/frontend/.env")
API = fenv["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
db = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]

email = f"test_ui_dir_{uuid.uuid4().hex[:8]}@test.io"
r = requests.post(f"{API}/v2/auth/send-email-code", json={"email": email}, timeout=30)
code = r.json()["dev_code"]
r2 = requests.post(f"{API}/v2/auth/verify-email-code", json={"email": email, "code": code}, timeout=30)
body = r2.json()
token, user_id = body["session_token"], body["user_id"]

orga_id = ObjectId()
db.organisations.insert_one({
    "_id": orga_id, "nom": "TEST_Agence UI", "adresse": "10 rue Test",
    "telephone": "+33100000000", "zones": ["75001", "75002"],
    "sieges_total": 5, "sieges_utilises": 3, "mode_repartition": "manuel",
    "directeur_prospecte": False,
})
db.users.update_one({"user_id": user_id}, {"$set": {
    "role": "directeur", "organisation_id": orga_id, "siege_statut": "actif",
    "plan": "agence", "prenom": "Dir", "nom": "UI", "onboarding_infos_ok": True,
    "tour_guide_vu": True, "zones_perso": ["75001"],
}})

conseillers = []
for i in range(2):
    uid = f"u_test_uic{i}_{uuid.uuid4().hex[:6]}"
    db.users.insert_one({
        "user_id": uid, "email": f"{uid}@test.io", "role": "conseiller",
        "organisation_id": orga_id, "siege_statut": "actif", "plan": "agence",
        "prenom": f"Conseiller{i}", "nom": "Test",
    })
    conseillers.append(uid)

opp_ids = []
now = datetime.now(timezone.utc)
for i in range(4):
    oid = ObjectId()
    doc = {"_id": oid, "organisation_id": orga_id, "statut": "proposee",
           "dpe_id": f"dpe_ui_{oid}", "adresse": f"{i+1} rue de l'Opportunite",
           "code_postal": "75001", "ville": "Paris", "score": 80 - i,
           "created_at": now.isoformat()}
    if i == 3:
        doc["assigne_a"] = conseillers[0]
        doc["date_attribution"] = (now - timedelta(hours=72)).isoformat()
    db.opportunites.insert_one(doc)
    opp_ids.append(str(oid))

print(json.dumps({"email": email, "token": token, "user_id": user_id,
                  "orga_id": str(orga_id), "conseillers": conseillers,
                  "opps": opp_ids}))
