"""Tests A3 — normalisation, extraction, matching."""
from __future__ import annotations

import pytest

from a3.matching import score_annonce_vs_dpe
from a3.extract_rue import extract_etage, extract_rue_and_etage
from a3.text import normalize_ges_class, normalize_type_bien_dpe, normalize_voie


class TestNormalizeVoie:
    @pytest.mark.parametrize("raw,expected", [
        ("Rue de Rome", "rome"),
        ("Boulevard Malesherbes", "malesherbes"),
        ("Avenue de la République", "republique"),
        ("Rue Saint-Ferdinand", "saint ferdinand"),
        ("rue de Chazelles", "chazelles"),
        ("RUE PONCELET", "poncelet"),
        ("Impasse des Peupliers", "peupliers"),
        (None, None),
        ("", None),
        ("La", None),
    ])
    def test_normalize(self, raw, expected):
        assert normalize_voie(raw) == expected


class TestGesClass:
    def test_ns_treated_as_null(self):
        assert normalize_ges_class("NS") is None
        assert normalize_ges_class("N/A") is None

    def test_letters(self):
        for l in "ABCDEFG":
            assert normalize_ges_class(l) == l
            assert normalize_ges_class(l.lower()) == l


class TestTypeBienDpe:
    @pytest.mark.parametrize("raw,expected", [
        ("Appartement", "appartement"),
        ("appartement 3 pièces", "appartement"),
        ("Maison", "maison"),
        ("Immeuble", "immeuble"),
        ("Villa", "maison"),
        (None, "autre"),
        ("", "autre"),
    ])
    def test_type(self, raw, expected):
        assert normalize_type_bien_dpe(raw) == expected


class TestExtractEtage:
    @pytest.mark.parametrize("text,expected", [
        ("Appartement au 2e étage", 2),
        ("Au rez-de-chaussée", 0),
        ("RDC avec terrasse", 0),
        ("étage n°5, ascenseur", 5),
        ("Appartement 4ème niveau", 4),
        ("Situé au 12eme etage", 12),
        ("Bel appartement lumineux", None),
    ])
    def test_etage(self, text, expected):
        assert extract_etage(text) == expected

    def test_dernier_etage_returns_none(self):
        # "dernier étage" est ambigu, on retourne None
        assert extract_etage("Au dernier étage") is None


class TestExtractRue:
    def _voies(self):
        # Ex : voies normalisées du 75017
        return [
            "poncelet", "biot", "saint ferdinand", "chazelles",
            "dautancourt", "malesherbes", "rome", "levis",
        ]

    def test_exactement_une_voie(self):
        rue, _ = extract_rue_and_etage(
            "Bel appartement", "Situé rue Poncelet, à 700m des Champs",
            voies_norm=self._voies(),
        )
        assert rue == "poncelet"

    def test_plusieurs_voies_null(self):
        # Plusieurs voies citées → ambigu → NULL
        rue, _ = extract_rue_and_etage(
            "Appartement de charme",
            "Entre la rue Poncelet et la rue Levis, à deux pas de la Rue Chazelles",
            voies_norm=self._voies(),
        )
        assert rue is None

    def test_aucune_voie_null(self):
        rue, _ = extract_rue_and_etage(
            "Bel appartement", "Superbe vue dégagée",
            voies_norm=self._voies(),
        )
        assert rue is None

    def test_avec_etage(self):
        rue, etage = extract_rue_and_etage(
            "T3 rue Biot", "Au 3ème étage, ascenseur",
            voies_norm=self._voies(),
        )
        assert rue == "biot"
        assert etage == 3

    def test_floor_prime_sur_extraction(self):
        rue, etage = extract_rue_and_etage(
            "T3 rue Biot", "Au 3ème étage, ascenseur",
            voies_norm=self._voies(), listing_floor=5,
        )
        assert etage == 5

    def test_case_insensitive_and_accents(self):
        rue, _ = extract_rue_and_etage(
            None, "RUE DE CHAZELLES/PARC MONCEAU",
            voies_norm=self._voies(),
        )
        assert rue == "chazelles"


class TestMatchingScores:
    def _cfg(self):
        return {"rue": 0.35, "surface": 0.30, "classe_energie": 0.20,
                "type_bien": 0.10, "etage": 0.05}

    def _dpe(self, **kw):
        d = {
            "nom_voie": "rome", "surface_habitable": 60.0,
            "classe_dpe": "D", "type_batiment_norm": "appartement", "etage_dpe": 3,
        }
        d.update(kw)
        return d

    def _ann(self, **kw):
        a = {
            "rue_extraite": "rome", "surface": 61.5, "energy_class": "D",
            "type_normalise": "appartement", "etage_extrait": 3, "floor": None,
        }
        a.update(kw)
        return a

    def test_score_parfait(self):
        r = score_annonce_vs_dpe(
            self._ann(surface=60.0),  # identique DPE
            self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["score"] > 0.99
        assert r["breakdown"]["rue"] == 1.0

    def test_rue_differente_ecarte_par_court_circuit(self):
        # rue connue des 2 côtés et différente + surface légèrement OFF (s_surface<0.9)
        r = score_annonce_vs_dpe(
            self._ann(rue_extraite="biot", surface=58),  # ecart=2, tol=max(4,4.8)=4.8, s=0.58
            self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["court_circuit"] is True
        assert r["score"] == 0.0

    def test_rue_null_donne_0_5(self):
        r = score_annonce_vs_dpe(
            self._ann(rue_extraite=None), self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["breakdown"]["rue"] == 0.5

    def test_classe_ns_traitee_comme_null(self):
        r = score_annonce_vs_dpe(
            self._ann(energy_class="NS"), self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["breakdown"]["classe_energie"] == 0.5

    def test_classe_ecart_1_lettre_0_6(self):
        r = score_annonce_vs_dpe(
            self._ann(energy_class="E"), self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["breakdown"]["classe_energie"] == 0.6

    def test_surface_hors_tolerance(self):
        r = score_annonce_vs_dpe(
            self._ann(surface=80),  # ecart=20, tol=max(4, 4.8)=4.8 → 0
            self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["breakdown"]["surface"] == 0.0

    def test_etage_manquant_donne_0_5(self):
        r = score_annonce_vs_dpe(
            self._ann(etage_extrait=None, floor=None),
            self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["breakdown"]["etage"] == 0.5

    def test_court_circuit_bloque_si_surface_09(self):
        # rues différentes MAIS surface score >= 0.9 → PAS de court-circuit
        # ecart=0.5, tol=4.8 → s=1-0.5/4.8=0.895 (<0.9)
        # Testons vraiment surface identique
        r = score_annonce_vs_dpe(
            self._ann(rue_extraite="biot", surface=60),  # ecart=0, s_surface=1.0
            self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["court_circuit"] is False
        assert r["breakdown"]["rue"] == 0.0
        assert r["breakdown"]["surface"] == 1.0
