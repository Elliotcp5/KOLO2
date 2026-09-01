"""Tests A2 — config_matching + POST /api/events end-to-end.

Ces tests tapent le vrai backend qui tourne sur localhost:8001, avec la
DB de dev. Ils vérifient la présence des seuils et le stockage d'un event.
"""
from __future__ import annotations

import os
import time
import uuid
from pathlib import Path

import httpx
import pytest

from dotenv import load_dotenv
load_dotenv(Path("/app/backend/.env"))

BASE = "http://localhost:8001"
ADMIN = (os.environ.get("ADMIN_SECRET") or "").strip()


def _hh_admin() -> dict:
    return {"X-Admin-Secret": ADMIN}


class TestConfigMatchingLive:
    def test_get_config_returns_all_keys(self):
        r = httpx.get(f"{BASE}/api/admin/config-matching", headers=_hh_admin(), timeout=10)
        assert r.status_code == 200
        cfg = r.json()["config"]
        # Toutes les clés exigées par la fiche
        for k in [
            "fenetre_dpe_jours", "tolerance_surface_pct", "tolerance_surface_plancher_m2",
            "poids", "seuil_correspondance", "seuil_correspondance_location",
            "seuil_publication", "score_ban_minimum", "fraicheur",
            "facteur_location_perime", "plafond_cumul_cartes", "marge_negociation",
            "duree_validite_dossier_mois", "quotas",
        ]:
            assert k in cfg, f"missing key: {k}"
        # Poids exacts
        assert cfg["poids"] == {
            "rue": 0.35, "surface": 0.30, "classe_energie": 0.20,
            "type_bien": 0.10, "etage": 0.05,
        }
        # Somme des poids = 1.0
        assert abs(sum(cfg["poids"].values()) - 1.0) < 1e-6
        # Multiplicateur géo présent
        assert "multiplicateur_geo" in cfg
        assert cfg["multiplicateur_geo"]["mult_ecart_prix_25_40"] == 0.7

    def test_patch_partial_preserves_other_keys(self):
        # PATCH juste `poids.rue` — les autres poids doivent survivre
        r = httpx.patch(
            f"{BASE}/api/admin/config-matching",
            headers=_hh_admin(),
            json={"updates": {"poids": {"rue": 0.40}}},
            timeout=10,
        )
        assert r.status_code == 200
        cfg = r.json()["config"]
        assert cfg["poids"]["rue"] == 0.40
        assert cfg["poids"]["surface"] == 0.30  # préservé
        assert cfg["poids"]["classe_energie"] == 0.20
        # Restaure valeur initiale pour ne pas contaminer les autres tests
        httpx.patch(
            f"{BASE}/api/admin/config-matching",
            headers=_hh_admin(),
            json={"updates": {"poids": {"rue": 0.35}}},
            timeout=10,
        )

    def test_get_without_admin_forbidden(self):
        r = httpx.get(f"{BASE}/api/admin/config-matching", timeout=10)
        assert r.status_code == 403


class TestEventsLive:
    def test_post_event_creates_document(self):
        unique_nom = f"test_event_{uuid.uuid4().hex[:8]}"
        r = httpx.post(
            f"{BASE}/api/events",
            json={"nom": unique_nom, "parametres": {"plan": "pro", "n": 42}},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["event"]["nom"] == unique_nom
        assert body["event"]["parametres"] == {"plan": "pro", "n": 42}
        assert "date" in body["event"]

    def test_post_event_empty_nom_rejected(self):
        r = httpx.post(f"{BASE}/api/events", json={"nom": "  "}, timeout=10)
        assert r.status_code == 400
