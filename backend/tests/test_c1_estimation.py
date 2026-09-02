"""Tests C1 — moteur d'estimation déterministe.

Tests unitaires sur les briques :
  - `_correction_taille_pct`
  - `_calculer_surface_ponderee` (plafond annexes)
  - `_ajustements_specifiques` (étage 3+ sans ascenseur → −10 %)
  - `_ajustement_energie` (référence = classe médiane comparables)
  - `_garde_fou_plafond` (±25 %)
  - `is_dvf_exclu` (Alsace-Moselle + Mayotte)

Pas de test d'intégration avec Supabase ici (cf. test_a1_normalization pour
la couche DVF). L'endpoint est testé via curl end-to-end en manuel.
"""
from __future__ import annotations

import pytest

from c1.engine import (
    is_dvf_exclu,
    _correction_taille_pct,
    _calculer_surface_ponderee,
    _ajustements_specifiques,
    _ajustement_energie,
    _garde_fou_plafond,
)


# ---------------------------------------------------------------------------
# is_dvf_exclu
# ---------------------------------------------------------------------------
class TestDvfExclu:
    def test_paris_couvert(self):
        assert is_dvf_exclu("75001") is False

    def test_alsace_moselle_67(self):
        assert is_dvf_exclu("67000") is True

    def test_alsace_moselle_68(self):
        assert is_dvf_exclu("68000") is True

    def test_moselle_57(self):
        assert is_dvf_exclu("57000") is True

    def test_mayotte(self):
        assert is_dvf_exclu("97600") is True

    def test_cp_vide(self):
        assert is_dvf_exclu("") is False
        assert is_dvf_exclu(None) is False


# ---------------------------------------------------------------------------
# Correction de taille
# ---------------------------------------------------------------------------
class TestCorrectionTaille:
    def test_meme_surface_pas_de_correction(self):
        # écart < 15 %
        assert _correction_taille_pct(surface_comparable=52, surface_cible=50) == 0.0
        assert _correction_taille_pct(surface_comparable=48, surface_cible=50) == 0.0

    def test_petit_vend_plus_cher(self):
        # comparable plus GRAND (100 vs 50, écart +100 %) → prix /m² comparable
        # est plus BAS que la cible → correction POSITIVE.
        pct = _correction_taille_pct(surface_comparable=100, surface_cible=50)
        assert pct > 0
        # plafonné à +8 %
        assert pct <= 0.08

    def test_grand_vend_moins_cher(self):
        # comparable plus PETIT (25 vs 50) → prix /m² haut → correction NEGATIVE.
        pct = _correction_taille_pct(surface_comparable=25, surface_cible=50)
        assert pct < 0
        assert pct >= -0.08

    def test_surface_zero_safe(self):
        assert _correction_taille_pct(0, 50) == 0.0
        assert _correction_taille_pct(50, 0) == 0.0


# ---------------------------------------------------------------------------
# Surface pondérée + plafond annexes
# ---------------------------------------------------------------------------
INFOS_PRO_DEFAUT = {
    "pond_terrasse": 0.35, "pond_balcon_loggia": 0.25, "pond_combles": 0.30,
    "pond_cave_cellier": 0.12, "pond_garage": 0.40,
    "pond_place_parking": 0.30, "pond_jardin": 0.10,
}


class TestSurfacePonderee:
    def test_sans_annexes(self):
        total, _ = _calculer_surface_ponderee(
            surface_habitable=50,
            inputs={"exterieur": "aucun", "stationnement": "aucun"},
            infos_pro=INFOS_PRO_DEFAUT,
        )
        assert total == 50.0

    def test_balcon_moderé(self):
        total, _ = _calculer_surface_ponderee(
            surface_habitable=50,
            inputs={"exterieur": "balcon", "exterieur_surface_m2": 4,
                    "stationnement": "aucun"},
            infos_pro=INFOS_PRO_DEFAUT,
        )
        # 50 + 4 * 0.25 = 51
        assert total == 51.0

    def test_plafond_25pct(self):
        # Balcon de 40 m² sur studio 20 m² → 40 * 0.25 = 10, cap à 25 % de 20 = 5.
        total, detail = _calculer_surface_ponderee(
            surface_habitable=20,
            inputs={"exterieur": "balcon", "exterieur_surface_m2": 40,
                    "stationnement": "aucun"},
            infos_pro=INFOS_PRO_DEFAUT,
        )
        # 20 + 5 = 25 (plafond)
        assert total == 25.0

    def test_jardin_maison_nul(self):
        """Sur une maison, jardin en surface = 0 (déjà dans la valeur du terrain)."""
        total, _ = _calculer_surface_ponderee(
            surface_habitable=100,
            inputs={"exterieur": "jardin", "exterieur_surface_m2": 400,
                    "type_bien": "Maison", "stationnement": "aucun"},
            infos_pro=INFOS_PRO_DEFAUT,
        )
        assert total == 100.0

    def test_jardin_appartement_appliqué(self):
        total, _ = _calculer_surface_ponderee(
            surface_habitable=100,
            inputs={"exterieur": "jardin", "exterieur_surface_m2": 30,
                    "type_bien": "Appartement", "stationnement": "aucun"},
            infos_pro=INFOS_PRO_DEFAUT,
        )
        # 100 + 30 * 0.10 = 103
        assert total == 103.0


# ---------------------------------------------------------------------------
# Ajustements spécifiques
# ---------------------------------------------------------------------------
class TestAjustementsSpecifiques:
    def test_3plus_sans_ascenseur_declenche_plancher(self):
        aj = _ajustements_specifiques(
            {"etage": "3plus", "ascenseur": False},
            INFOS_PRO_DEFAUT, {},
        )
        codes = [a["code"] for a in aj]
        assert "etage_eleve_sans_ascenseur" in codes
        val = next(a["valeur"] for a in aj if a["code"] == "etage_eleve_sans_ascenseur")
        assert val == -0.10

    def test_3plus_avec_ascenseur_ne_declenche_rien(self):
        aj = _ajustements_specifiques(
            {"etage": "3plus", "ascenseur": True},
            INFOS_PRO_DEFAUT, {},
        )
        codes = [a["code"] for a in aj]
        assert "etage_eleve_sans_ascenseur" not in codes

    def test_etat_rafraichir(self):
        aj = _ajustements_specifiques({"etat": "a_rafraichir"}, INFOS_PRO_DEFAUT, {})
        assert any(a["code"] == "etat_rafraichir" and a["valeur"] == -0.08 for a in aj)

    def test_travaux_chiffres_en_euros(self):
        aj = _ajustements_specifiques({"montant_travaux_eur": 15000}, INFOS_PRO_DEFAUT, {})
        travaux = next(a for a in aj if a["code"] == "travaux_chiffres")
        assert travaux["unite"] == "eur"
        assert travaux["valeur"] == -15000.0


# ---------------------------------------------------------------------------
# Ajustement énergie
# ---------------------------------------------------------------------------
GRILLE_ENERGIE_TEST = {
    "ile_de_france": {
        "appartement": {"A": 4, "B": 3, "C": 1, "D": 0, "E": -2, "F": -4, "G": -6},
        "maison":      {"A": 8, "B": 6, "C": 2, "D": 0, "E": -4, "F": -8, "G": -12},
    },
    "autre": {
        "appartement": {"A": 6, "B": 4, "C": 2, "D": 0, "E": -4, "F": -8, "G": -12},
        "maison":      {"A": 10, "B": 7, "C": 3, "D": 0, "E": -6, "F": -12, "G": -18},
    },
}


class TestAjustementEnergie:
    def test_f_paris_apport_moins_4(self):
        aj = _ajustement_energie(
            inputs={"classe_dpe": "F", "type_bien": "Appartement", "code_postal": "75004"},
            comparables=[],
            decote_grille=GRILLE_ENERGIE_TEST,
        )
        assert aj is not None
        # F=-4, réf D=0 → -0.04
        assert aj["valeur"] == pytest.approx(-0.04, abs=1e-4)

    def test_reference_est_classe_mediane(self):
        # Bien F, comparables tous en E → référence E, décote de F par rapport à E
        comps = [{"classe_dpe": "E"}] * 5
        aj = _ajustement_energie(
            inputs={"classe_dpe": "F", "type_bien": "Appartement", "code_postal": "75004"},
            comparables=comps,
            decote_grille=GRILLE_ENERGIE_TEST,
        )
        # F=-4, ref=E=-2 → -0.02
        assert aj["valeur"] == pytest.approx(-0.02, abs=1e-4)

    def test_classe_dpe_absente_pas_dajustement(self):
        aj = _ajustement_energie(
            inputs={"type_bien": "Appartement", "code_postal": "75004"},
            comparables=[],
            decote_grille=GRILLE_ENERGIE_TEST,
        )
        assert aj is None

    def test_maison_hors_paris_g_lourde_decote(self):
        aj = _ajustement_energie(
            inputs={"classe_dpe": "G", "type_bien": "Maison", "code_postal": "13001"},
            comparables=[],
            decote_grille=GRILLE_ENERGIE_TEST,
        )
        # region=autre, maison, G=-18, ref D=0 → -0.18
        assert aj["valeur"] == pytest.approx(-0.18, abs=1e-4)


# ---------------------------------------------------------------------------
# Garde-fou ±25 %
# ---------------------------------------------------------------------------
class TestGardeFou:
    def test_dans_borne(self):
        val, atteint = _garde_fou_plafond(-0.15)
        assert val == -0.15
        assert atteint is False

    def test_depassement_haut(self):
        val, atteint = _garde_fou_plafond(0.40)
        assert val == 0.25
        assert atteint is True

    def test_depassement_bas(self):
        val, atteint = _garde_fou_plafond(-0.40)
        assert val == -0.25
        assert atteint is True

    def test_borne_exacte(self):
        val, atteint = _garde_fou_plafond(0.25)
        assert val == 0.25
        assert atteint is False
        val, atteint = _garde_fou_plafond(-0.25)
        assert val == -0.25
        assert atteint is False
