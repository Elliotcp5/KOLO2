"""KOLO A3 — Score de correspondance annonce ↔ DPE.

5 sous-scores entre 0 et 1, pondérés par `config_matching.poids`.
Aucun poids en dur — tous lus depuis la config.

Court-circuit : s_rue=0 ET s_surface<0.9 → l'annonce est écartée.
"""
from __future__ import annotations

from typing import Any, Optional

from a3.text import normalize_ges_class, normalize_voie


def _s_rue(rue_annonce: Optional[str], rue_dpe: Optional[str]) -> float:
    """rue_extraite null → 0.5 (absence d'info)
    rue == voie du DPE → 1.0
    rue != voie du DPE → 0.0"""
    a = normalize_voie(rue_annonce)
    d = normalize_voie(rue_dpe)
    if not a or not d:
        return 0.5
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


def score_annonce_vs_dpe(
    annonce: dict[str, Any],
    dpe: dict[str, Any],
    poids: dict[str, float],
    tolerance_surface_pct: float,
    tolerance_surface_plancher_m2: float,
) -> dict[str, Any]:
    """Retourne `{score, breakdown, court_circuit}` — breakdown = dict des 5 sous-scores.

    `annonce` attendues clés : `rue_extraite`, `surface`, `energy_class`,
    `type_normalise`, `floor` OU `etage_extrait`.
    `dpe` attendues clés canoniques (voir a3.sources.ademe) : `nom_voie`,
    `surface_habitable`, `classe_dpe`, `type_batiment` (déjà normalisé), etage_dpe.
    """
    s_rue = _s_rue(annonce.get("rue_extraite"), dpe.get("nom_voie"))
    s_surface = _s_surface(
        annonce.get("surface"),
        dpe.get("surface_habitable"),
        tolerance_surface_pct,
        tolerance_surface_plancher_m2,
    )

    # Court-circuit : rues connues et différentes + surface < 0.9 → écarté
    if s_rue == 0.0 and s_surface < 0.9:
        return {
            "score": 0.0,
            "breakdown": {
                "rue": s_rue, "surface": s_surface,
                "classe_energie": 0.0, "type_bien": 0.0, "etage": 0.0,
            },
            "court_circuit": True,
        }

    s_classe = _s_classe_energie(annonce.get("energy_class"), dpe.get("classe_dpe"))
    s_type = _s_type_bien(annonce.get("type_normalise"), dpe.get("type_batiment_norm"))
    etage_annonce = annonce.get("etage_extrait")
    if etage_annonce is None:
        etage_annonce = annonce.get("floor")
    s_etage = _s_etage(etage_annonce, dpe.get("etage_dpe"))

    score = (
        float(poids.get("rue", 0.0)) * s_rue
        + float(poids.get("surface", 0.0)) * s_surface
        + float(poids.get("classe_energie", 0.0)) * s_classe
        + float(poids.get("type_bien", 0.0)) * s_type
        + float(poids.get("etage", 0.0)) * s_etage
    )
    return {
        "score": round(score, 4),
        "breakdown": {
            "rue": s_rue, "surface": s_surface,
            "classe_energie": s_classe, "type_bien": s_type, "etage": s_etage,
        },
        "court_circuit": False,
    }
