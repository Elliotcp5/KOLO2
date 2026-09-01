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
        return {"rue": 0.25, "geographie": 0.20, "surface": 0.25,
                "classe_energie": 0.15, "type_bien": 0.10, "etage": 0.05}

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
        # Score parfait = tous les sous-scores à 1.0, y compris s_geo
        r = score_annonce_vs_dpe(
            self._ann(surface=60.0),  # identique DPE
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="rome", quartier_annonce="rome",
            prix_median_local_m2=None,
        )
        assert r["score"] > 0.99
        assert r["breakdown"]["rue"] == 1.0
        assert r["breakdown"]["geographie"] == 1.0

    def test_rue_differente_ecarte_par_court_circuit(self):
        # rue connue des 2 côtés et différente + surface légèrement OFF (s_surface<0.9)
        r = score_annonce_vs_dpe(
            self._ann(rue_extraite="biot", surface=58),  # ecart=2, tol=max(4,4.8)=4.8, s=0.58
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
        r = score_annonce_vs_dpe(
            self._ann(rue_extraite="biot", surface=60),  # ecart=0, s_surface=1.0
            self._dpe(), self._cfg(), 0.08, 4,
        )
        assert r["court_circuit"] is False
        assert r["breakdown"]["rue"] == 0.0
        assert r["breakdown"]["surface"] == 1.0

    def test_s_rue_defaut_null_parametrable(self):
        """`s_rue_defaut_null` doit être appliqué quand la rue est null d'un côté."""
        base = self._ann(rue_extraite=None)
        # Défaut 0.5
        r = score_annonce_vs_dpe(base, self._dpe(), self._cfg(), 0.08, 4)
        assert r["breakdown"]["rue"] == 0.5
        # Paramétré à 0.30
        r = score_annonce_vs_dpe(base, self._dpe(), self._cfg(), 0.08, 4,
                                 s_rue_defaut_null=0.30)
        assert r["breakdown"]["rue"] == 0.30
        # Paramétré à 0 (aucun crédit)
        r = score_annonce_vs_dpe(base, self._dpe(), self._cfg(), 0.08, 4,
                                 s_rue_defaut_null=0.0)
        assert r["breakdown"]["rue"] == 0.0

    def test_s_rue_defaut_null_naffect_pas_match_exact(self):
        """Quand les deux rues existent et matchent, `s_rue_defaut_null` est ignoré."""
        r = score_annonce_vs_dpe(
            self._ann(surface=60), self._dpe(), self._cfg(), 0.08, 4,
            s_rue_defaut_null=0.0,
        )
        assert r["breakdown"]["rue"] == 1.0


class TestSGeo:
    """Sous-score géographique : adjacence quartier admin + cohérence prix m²."""

    def _cfg(self):
        return {"rue": 0.25, "geographie": 0.20, "surface": 0.25,
                "classe_energie": 0.15, "type_bien": 0.10, "etage": 0.05}

    def _dpe(self, **kw):
        d = {"nom_voie": "jonquiere", "surface_habitable": 60.0,
             "classe_dpe": "D", "type_batiment_norm": "appartement", "etage_dpe": 3}
        d.update(kw)
        return d

    def _ann(self, **kw):
        a = {"rue_extraite": "jonquiere", "surface": 60.0, "energy_class": "D",
             "type_normalise": "appartement", "etage_extrait": 3, "floor": None,
             "price_per_m2": 11000, "district": "Épinettes"}
        a.update(kw)
        return a

    def test_quartiers_identiques_donnent_1(self):
        r = score_annonce_vs_dpe(
            self._ann(), self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="epinettes",
            prix_median_local_m2=11000,
        )
        assert r["breakdown"]["geographie"] == 1.0
        assert r["court_circuit"] is False

    def test_quartiers_limitrophes_donnent_0_6(self):
        r = score_annonce_vs_dpe(
            self._ann(), self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="batignolles",
            prix_median_local_m2=11000,
        )
        assert r["breakdown"]["geographie"] == 0.6
        assert r["court_circuit"] is False

    def test_quartiers_non_limitrophes_court_circuit(self):
        """Cas A15 réel : DPE Épinettes vs annonce Plaine-de-Monceaux."""
        r = score_annonce_vs_dpe(
            self._ann(price_per_m2=21500, district="Prony / Parc Monceau"),
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="plaine-de-monceaux",
            prix_median_local_m2=11000,
        )
        assert r["court_circuit"] is True
        assert r["motif_court_circuit"] == "quartier_non_limitrophe"
        assert r["score"] == 0.0
        assert r["breakdown"]["geographie"] == 0.0

    def test_district_absent_donne_0_5_sans_court_circuit(self):
        r = score_annonce_vs_dpe(
            self._ann(district=None),
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce=None,
            prix_median_local_m2=11000,
        )
        assert r["breakdown"]["geographie"] == 0.5
        assert r["court_circuit"] is False

    def test_prix_ecart_20pct_pas_de_penalite(self):
        # Même quartier, écart 20% → s_geo reste 1.0
        r = score_annonce_vs_dpe(
            self._ann(price_per_m2=12000),  # 12000 vs 10000 → 20%
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="epinettes",
            prix_median_local_m2=10000,
        )
        assert r["breakdown"]["geographie"] == 1.0

    def test_prix_ecart_32pct_plafonne_a_0_5(self):
        r = score_annonce_vs_dpe(
            self._ann(price_per_m2=13200),  # 13200 vs 10000 → 32%
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="epinettes",
            prix_median_local_m2=10000,
        )
        assert r["breakdown"]["geographie"] == 0.5
        assert r["court_circuit"] is False

    def test_prix_ecart_50pct_court_circuit(self):
        r = score_annonce_vs_dpe(
            self._ann(price_per_m2=15000),  # 15000 vs 10000 → 50%
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="epinettes",
            prix_median_local_m2=10000,
        )
        assert r["court_circuit"] is True
        assert r["motif_court_circuit"] == "prix_m2_incoherent"
        assert r["score"] == 0.0
        assert r["breakdown"]["geographie"] == 0.0

    def test_prix_median_absent_pas_de_penalite(self):
        r = score_annonce_vs_dpe(
            self._ann(price_per_m2=25000),  # aberrant
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce="epinettes",
            prix_median_local_m2=None,
        )
        assert r["breakdown"]["geographie"] == 1.0
        assert r["court_circuit"] is False

    def test_libelle_inconnu_traite_comme_absent(self):
        """label_to_quartier renvoie (None, True) → quartier_annonce=None → s_geo=0.5."""
        from a3.quartiers import label_to_quartier
        slug, unknown = label_to_quartier("Xanadu Village")
        assert slug is None
        assert unknown is True
        # Côté matching, appelé avec quartier_annonce=None → traité comme absent
        r = score_annonce_vs_dpe(
            self._ann(district="Xanadu Village"),
            self._dpe(), self._cfg(), 0.08, 4,
            quartier_dpe="epinettes", quartier_annonce=None,
            prix_median_local_m2=11000,
        )
        assert r["breakdown"]["geographie"] == 0.5

    def test_cas_reel_A15_jonquiere_vs_prony(self):
        """Reproduit exactement le cas A15 de l'audit utilisateur."""
        from a3.quartiers import point_to_quartier, label_to_quartier
        # 44 Rue de la Jonquière → doit tomber dans Épinettes
        q_dpe = point_to_quartier(48.8951, 2.3247)
        assert q_dpe == "epinettes"
        # Annonce district « Prony / Parc Monceau » → Plaine-de-Monceaux
        q_ann, _ = label_to_quartier("Prony / Parc Monceau")
        assert q_ann == "plaine-de-monceaux"
        r = score_annonce_vs_dpe(
            {"rue_extraite": None, "surface": 60, "energy_class": "D",
             "type_normalise": "appartement", "price_per_m2": 21500,
             "district": "Prony / Parc Monceau"},
            {"nom_voie": "jonquiere", "surface_habitable": 60.0, "classe_dpe": "D",
             "type_batiment_norm": "appartement"},
            self._cfg(), 0.08, 4,
            quartier_dpe=q_dpe, quartier_annonce=q_ann,
            prix_median_local_m2=11000,  # marché autour du DPE
        )
        assert r["court_circuit"] is True
        assert r["motif_court_circuit"] == "quartier_non_limitrophe"


class TestQuartiersModule:
    def test_slug_normalization(self):
        from a3.quartiers import label_to_quartier
        # Différentes casses / accents / séparateurs
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
        # Point ~44 Rue de la Jonquière (Épinettes)
        assert point_to_quartier(48.8951, 2.3247) == "epinettes"
        # Point ~ Place Charles de Gaulle (hors 17e) — bord Ternes
        # Sanity : hors Paris → None
        assert point_to_quartier(0.0, 0.0) is None
        assert point_to_quartier(None, None) is None
