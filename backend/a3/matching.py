"""KOLO A3 — Score de correspondance annonce ↔ DPE.

6 sous-scores entre 0 et 1, pondérés par `config_matching.poids`.
Aucun poids en dur — tous lus depuis la config.

Court-circuits (l'annonce est écartée sans calcul de score global) :
  - `s_geo == 0` (quartiers non-limitrophes OU écart prix m² > 40%)
  - `s_rue == 0` ET `s_surface < 0.9` (rues connues des 2 côtés et différentes)

`motif_court_circuit` retourné pour journalisation : `quartier_non_limitrophe`,
`prix_m2_incoherent`, ou `rue_differente`.
"""
from __future__ import annotations

from typing import Any, Optional

from a3.quartiers import adjacency_score
from a3.text import normalize_ges_class, normalize_voie


# ---------------------------------------------------------------------------
# Sous-scores unitaires
# ---------------------------------------------------------------------------
def _s_rue(rue_annonce: Optional[str], rue_dpe: Optional[str],
           defaut_null: float = 0.5) -> float:
    """rue_extraite null d'un côté → `defaut_null` ; matche → 1.0 ; sinon 0.0."""
    a = normalize_voie(rue_annonce)
    d = normalize_voie(rue_dpe)
    if not a or not d:
        return float(defaut_null)
    return 1.0 if a == d else 0.0


def _s_surface(surface_annonce: Optional[float], surface_dpe: float,
               tolerance_pct: float, tolerance_plancher_m2: float) -> float:
    """max(0, 1 - ecart/tolerance) où tolerance = max(plancher, surface_dpe * pct)."""
    if surface_annonce is None or surface_dpe is None or surface_dpe <= 0:
        return 0.0
    try:
        ecart = abs(float(surface_annonce) - float(surface_dpe))
    except (TypeError, ValueError):
        return 0.0
    tolerance = max(float(tolerance_plancher_m2), float(surface_dpe) * float(tolerance_pct))
    if tolerance <= 0:
        return 0.0
    return max(0.0, 1.0 - ecart / tolerance)


def _s_classe_energie(classe_annonce: Optional[str], classe_dpe: Optional[str]) -> float:
    a = normalize_ges_class(classe_annonce)
    d = normalize_ges_class(classe_dpe)
    if not a or not d:
        return 0.5
    if a == d:
        return 1.0
    if abs(ord(a) - ord(d)) == 1:
        return 0.6
    return 0.0


def _s_type_bien(type_annonce: Optional[str], type_dpe: Optional[str]) -> float:
    if not type_annonce or not type_dpe:
        return 0.0
    return 1.0 if type_annonce.strip().lower() == type_dpe.strip().lower() else 0.0


def _s_etage(etage_annonce: Optional[int], etage_dpe: Optional[int]) -> float:
    """0.5 si info manquante d'un côté, 1.0 identique, 0.0 sinon."""
    if etage_annonce is None or etage_dpe is None:
        return 0.5
    try:
        return 1.0 if int(etage_annonce) == int(etage_dpe) else 0.0
    except (TypeError, ValueError):
        return 0.5


def compute_s_geo(
    quartier_dpe: Optional[str],
    quartier_annonce: Optional[str],
    prix_annonce_m2: Optional[float],
    prix_median_local_m2: Optional[float],
) -> tuple[float, Optional[str]]:
    """Sous-score géographique combiné (adjacence quartier + cohérence prix m²).

    Retourne `(s_geo, motif_court_circuit_ou_None)`.

    Adjacence :
      - même quartier admin → 1.0
      - quartiers limitrophes → 0.6
      - quartiers non-limitrophes → 0.0 (court-circuit: `quartier_non_limitrophe`)
      - un des deux absent → 0.5 (jamais de court-circuit)

    Prix m² local (500 m, 24 mois, même type) :
      - écart ≤ 25 %                 → pas de pénalité
      - 25 % < écart ≤ 40 %          → s_geo plafonné à 0.5
      - écart > 40 %                 → s_geo forcé à 0.0 (court-circuit: `prix_m2_incoherent`)
      - médiane locale ou prix annonce manquants → pas de pénalité prix
    """
    s = adjacency_score(quartier_dpe, quartier_annonce)
    # Court-circuit sur quartier non-limitrophe (seul un vrai 0.0 non-absent le déclenche)
    if s == 0.0:
        return 0.0, "quartier_non_limitrophe"

    # Signal prix — sans effet si l'un des deux est absent/nul
    try:
        p_ann = float(prix_annonce_m2) if prix_annonce_m2 not in (None, "", 0) else None
    except (TypeError, ValueError):
        p_ann = None
    try:
        p_med = float(prix_median_local_m2) if prix_median_local_m2 not in (None, "", 0) else None
    except (TypeError, ValueError):
        p_med = None

    if p_ann is None or p_med is None or p_med <= 0:
        return s, None

    ecart = abs(p_ann - p_med) / p_med
    if ecart > 0.40:
        return 0.0, "prix_m2_incoherent"
    if ecart > 0.25:
        return min(s, 0.5), None
    return s, None


# ---------------------------------------------------------------------------
# Score global
# ---------------------------------------------------------------------------
def score_annonce_vs_dpe(
    annonce: dict[str, Any],
    dpe: dict[str, Any],
    poids: dict[str, float],
    tolerance_surface_pct: float,
    tolerance_surface_plancher_m2: float,
    s_rue_defaut_null: float = 0.5,
    *,
    quartier_dpe: Optional[str] = None,
    quartier_annonce: Optional[str] = None,
    prix_median_local_m2: Optional[float] = None,
) -> dict[str, Any]:
    """Score pondéré + breakdown des 6 sous-scores + `motif_court_circuit`.

    Ordre :
      1) `s_geo` calculé en 1er (peut court-circuiter tout le reste)
      2) `s_rue` + `s_surface` (court-circuit rue différente + surface < 0.9)
      3) `s_classe`, `s_type`, `s_etage`
      4) somme pondérée

    `motif_court_circuit` prend l'une des valeurs :
      `quartier_non_limitrophe`, `prix_m2_incoherent`, `rue_differente`, ou None.
    """
    # 1. s_geo en premier — peut couper court
    s_geo, motif_geo = compute_s_geo(
        quartier_dpe,
        quartier_annonce,
        annonce.get("price_per_m2"),
        prix_median_local_m2,
    )
    if s_geo == 0.0:
        return {
            "score": 0.0,
            "breakdown": {
                "rue": 0.0, "geographie": 0.0, "surface": 0.0,
                "classe_energie": 0.0, "type_bien": 0.0, "etage": 0.0,
            },
            "court_circuit": True,
            "motif_court_circuit": motif_geo,
        }

    # 2. rue + surface (court-circuit rue vs surface faible)
    s_rue = _s_rue(annonce.get("rue_extraite"), dpe.get("nom_voie"), s_rue_defaut_null)
    s_surface = _s_surface(
        annonce.get("surface"),
        dpe.get("surface_habitable"),
        tolerance_surface_pct,
        tolerance_surface_plancher_m2,
    )
    if s_rue == 0.0 and s_surface < 0.9:
        return {
            "score": 0.0,
            "breakdown": {
                "rue": s_rue, "geographie": s_geo, "surface": s_surface,
                "classe_energie": 0.0, "type_bien": 0.0, "etage": 0.0,
            },
            "court_circuit": True,
            "motif_court_circuit": "rue_differente",
        }

    # 3. sous-scores restants
    s_classe = _s_classe_energie(annonce.get("energy_class"), dpe.get("classe_dpe"))
    s_type = _s_type_bien(annonce.get("type_normalise"), dpe.get("type_batiment_norm"))
    etage_annonce = annonce.get("etage_extrait")
    if etage_annonce is None:
        etage_annonce = annonce.get("floor")
    s_etage = _s_etage(etage_annonce, dpe.get("etage_dpe"))

    # 4. somme pondérée
    score = (
        float(poids.get("rue", 0.0)) * s_rue
        + float(poids.get("geographie", 0.0)) * s_geo
        + float(poids.get("surface", 0.0)) * s_surface
        + float(poids.get("classe_energie", 0.0)) * s_classe
        + float(poids.get("type_bien", 0.0)) * s_type
        + float(poids.get("etage", 0.0)) * s_etage
    )
    return {
        "score": round(score, 4),
        "breakdown": {
            "rue": s_rue, "geographie": s_geo, "surface": s_surface,
            "classe_energie": s_classe, "type_bien": s_type, "etage": s_etage,
        },
        "court_circuit": False,
        "motif_court_circuit": None,
    }
