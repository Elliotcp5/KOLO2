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
        # Score parfait = somme pondérée à 1.0 × multiplicateur 1.0
        r = score_annonce_vs_dpe(
            self._ann(surface=60.0), self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["score"] > 0.99
        assert r["breakdown"]["rue"] == 1.0
        assert r["multiplicateur_geo"] == 1.0

    def test_rue_differente_ecarte_par_court_circuit(self):
        r = score_annonce_vs_dpe(
            self._ann(rue_extraite="biot", surface=58),
            self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["court_circuit"] is True
        assert r["motif_court_circuit"] == "rue_differente"
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
            self._ann(surface=80), self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["breakdown"]["surface"] == 0.0

    def test_etage_manquant_donne_0_5(self):
        r = score_annonce_vs_dpe(
            self._ann(etage_extrait=None, floor=None),
            self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["breakdown"]["etage"] == 0.5

    def test_court_circuit_bloque_si_surface_09(self):
        r = score_annonce_vs_dpe(
            self._ann(rue_extraite="biot", surface=60),
            self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["court_circuit"] is False
        assert r["breakdown"]["rue"] == 0.0
        assert r["breakdown"]["surface"] == 1.0

    def test_s_rue_defaut_null_parametrable(self):
        base = self._ann(rue_extraite=None)
        r = score_annonce_vs_dpe(base, self._dpe(), self._cfg(), 0.08, 4)
        assert r["breakdown"]["rue"] == 0.5
        r = score_annonce_vs_dpe(base, self._dpe(), self._cfg(), 0.08, 4,
                                 s_rue_defaut_null=0.30)
        assert r["breakdown"]["rue"] == 0.30
        r = score_annonce_vs_dpe(base, self._dpe(), self._cfg(), 0.08, 4,
                                 s_rue_defaut_null=0.0)
        assert r["breakdown"]["rue"] == 0.0

    def test_s_rue_defaut_null_naffect_pas_match_exact(self):
        r = score_annonce_vs_dpe(
            self._ann(surface=60), self._dpe(), self._cfg(), 0.08, 4,
            s_rue_defaut_null=0.0,
        )
        assert r["breakdown"]["rue"] == 1.0


class TestMultiplicateurGeo:
    """Le multiplicateur géographique ne bonifie jamais, seule la divergence
    réfute. Il vaut 1.0 par défaut, 0.7 sur écart prix 25-40 %, 0.0 (court-
    circuit) sur quartier non-limitrophe ou écart prix > 40 %.
    """

    def _cfg(self):
        return {"rue": 0.35, "surface": 0.30, "classe_energie": 0.20,
                "type_bien": 0.10, "etage": 0.05}

    def _dpe(self, **kw):
        d = {"nom_voie": "jonquiere", "surface_habitable": 60.0,
             "classe_dpe": "D", "type_batiment_norm": "appartement", "etage_dpe": 3}
        d.update(kw)
        return d

    def _ann(self, **kw):
        a = {"rue_extraite": "jonquiere", "surface": 60.0, "energy_class": "D",
             "type_normalise": "appartement", "etage_extrait": 3, "floor": None,
             "price_per_m2": 11000}
        a.update(kw)
        return a

    def test_meme_quartier_multiplicateur_1(self):
        r = score_annonce_vs_dpe(
            self._ann(), self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="epinettes",
            prix_median_local_m2=11000,
        )
        assert r["multiplicateur_geo"] == 1.0
        assert r["court_circuit"] is False

    def test_limitrophe_multiplicateur_1(self):
        # Adjacence 0.6 (limitrophe) ne discrimine pas → multiplicateur reste 1.0
        r = score_annonce_vs_dpe(
            self._ann(), self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="batignolles",
            prix_median_local_m2=11000,
        )
        assert r["multiplicateur_geo"] == 1.0

    def test_non_limitrophe_court_circuit(self):
        """Cas A15 : DPE Épinettes vs annonce Plaine-de-Monceaux → écarté."""
        r = score_annonce_vs_dpe(
            self._ann(price_per_m2=21500),
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="plaine-de-monceaux",
            prix_median_local_m2=11000,
        )
        assert r["court_circuit"] is True
        assert r["motif_court_circuit"] == "quartier_non_limitrophe"
        assert r["score"] == 0.0
        assert r["multiplicateur_geo"] == 0.0

    def test_district_absent_multiplicateur_1(self):
        r = score_annonce_vs_dpe(
            self._ann(), self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce=None,
            prix_median_local_m2=11000,
        )
        assert r["multiplicateur_geo"] == 1.0
        assert r["court_circuit"] is False

    def test_prix_ecart_20pct_multiplicateur_1(self):
        r = score_annonce_vs_dpe(
            self._ann(price_per_m2=12000),
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="epinettes",
            prix_median_local_m2=10000,
        )
        assert r["multiplicateur_geo"] == 1.0

    def test_prix_ecart_32pct_multiplicateur_0_7(self):
        r = score_annonce_vs_dpe(
            self._ann(price_per_m2=13200),  # 32% écart
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="epinettes",
            prix_median_local_m2=10000,
        )
        assert r["multiplicateur_geo"] == 0.7
        assert r["court_circuit"] is False

    def test_prix_ecart_50pct_court_circuit(self):
        r = score_annonce_vs_dpe(
            self._ann(price_per_m2=15000),  # 50% écart
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="epinettes",
            prix_median_local_m2=10000,
        )
        assert r["court_circuit"] is True
        assert r["motif_court_circuit"] == "prix_m2_incoherent"
        assert r["score"] == 0.0
        assert r["multiplicateur_geo"] == 0.0

    def test_prix_median_absent_multiplicateur_1(self):
        r = score_annonce_vs_dpe(
            self._ann(price_per_m2=25000),
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="epinettes",
            prix_median_local_m2=None,
        )
        assert r["multiplicateur_geo"] == 1.0

    def test_multiplicateur_penalise_score_de_30pct(self):
        """Score parfait * mult 0.7 = 0.7."""
        r = score_annonce_vs_dpe(
            self._ann(surface=60, price_per_m2=13200),
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="epinettes",
            prix_median_local_m2=10000,
        )
        # Somme pondérée = 1.0 (tout correspond parfaitement), mult = 0.7
        assert abs(r["score"] - 0.70) < 0.01
        assert r["multiplicateur_geo"] == 0.7

    def test_mult_ecart_prix_configurable(self):
        r = score_annonce_vs_dpe(
            self._ann(surface=60, price_per_m2=13200),
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="epinettes",
            prix_median_local_m2=10000,
            mult_ecart_prix_25_40=0.5,  # override
        )
        assert r["multiplicateur_geo"] == 0.5
        assert abs(r["score"] - 0.50) < 0.01


class TestQuartiersModule:
    def test_slug_normalization(self):
        from a3.quartiers import label_to_quartier
        assert label_to_quartier("Ternes-Maillot")[0] == "ternes"
        assert label_to_quartier("champerret berthier")[0] == "ternes"
        assert label_to_quartier("Batignolles-Cardinet")[0] == "batignolles"
        assert label_to_quartier("Guy Môquet")[0] == "epinettes"
        assert label_to_quartier("Prony / Parc Monceau")[0] == "plaine-de-monceaux"
        assert label_to_quartier("Pereire-Malesherbes")[0] == "plaine-de-monceaux"

    def test_district_vide(self):
        from a3.quartiers import label_to_quartier
        assert label_to_quartier(None) == (None, False)
        assert label_to_quartier("") == (None, False)
        assert label_to_quartier("   ") == (None, False)

    def test_libelle_inconnu_flag(self):
        from a3.quartiers import label_to_quartier
        slug, unk = label_to_quartier("Bagdad-sur-Seine")
        assert slug is None
        assert unk is True

    def test_prefixes_portails_absorbes(self):
        """Doit absorber les préfixes portails « Paris 17e Arrondissement - »."""
        from a3.quartiers import label_to_quartier
        assert label_to_quartier("Paris 17e Arrondissement - Pereire")[0] == "plaine-de-monceaux"
        assert label_to_quartier("Paris 75017 Guy Moquet")[0] == "epinettes"
        assert label_to_quartier("Paris 17e Arrondissement - Ternes - Maillot")[0] == "ternes"

    def test_adjacency_17e(self):
        from a3.quartiers import adjacency_score
        assert adjacency_score("epinettes", "epinettes") == 1.0
        assert adjacency_score("epinettes", "batignolles") == 0.6
        assert adjacency_score("epinettes", "plaine-de-monceaux") == 0.0
        assert adjacency_score("ternes", "plaine-de-monceaux") == 0.6
        assert adjacency_score("ternes", "batignolles") == 0.0
        assert adjacency_score("ternes", "epinettes") == 0.0
        assert adjacency_score(None, "ternes") == 0.5
        assert adjacency_score("ternes", None) == 0.5

    def test_point_in_polygon_17e(self):
        from a3.quartiers import point_to_quartier
        assert point_to_quartier(48.8951, 2.3247) == "epinettes"
        assert point_to_quartier(0.0, 0.0) is None
        assert point_to_quartier(None, None) is None
