"""KOLO A3 — Score de correspondance annonce ↔ DPE.

5 sous-scores pondérés (rue, surface, classe, type, étage) + un
**multiplicateur géographique** appliqué EN DEHORS de la somme pondérée.

    score = somme_pondérée × multiplicateur_geo

Rationale : la concordance de quartier ne prouve rien (toutes les annonces
d'un CP sont dans les 4 quartiers admin de l'arrondissement, donc la prime
serait quasi systématique). Seule la DIVERGENCE réfute. Le multiplicateur
n'ajoute donc jamais rien : il neutralise (0.0 → court-circuit) ou pénalise
partiellement (0.7 sur écart prix 25-40 %). Sinon 1.0 (neutre).

Multiplicateur géo :
  - quartiers non limitrophes         → 0.0  (court-circuit `quartier_non_limitrophe`)
  - écart prix m² > 40 %              → 0.0  (court-circuit `prix_m2_incoherent`)
  - écart prix m² entre 25 et 40 %    → `mult_ecart_prix_25_40` (défaut 0.7)
  - reste (même/limitrophe/absent)    → 1.0

Autre court-circuit inchangé : `s_rue == 0` ET `s_surface < 0.9`
(motif `rue_differente`).
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


# ---------------------------------------------------------------------------
# Multiplicateur géographique (adjacence quartier + écart prix m²)
# ---------------------------------------------------------------------------
def compute_multiplicateur_geo(
    quartier_dpe: Optional[str],
    quartier_annonce: Optional[str],
    prix_annonce_m2: Optional[float],
    prix_median_local_m2: Optional[float],
    mult_ecart_prix_25_40: float = 0.7,
    seuil_prix_penalite: float = 0.25,
    seuil_prix_court_circuit: float = 0.40,
) -> tuple[float, Optional[str]]:
    """Retourne `(multiplicateur, motif_court_circuit_ou_None)`.

    Le multiplicateur ne bonifie jamais : il vaut 1.0 par défaut et diminue
    (0.7 sur écart prix 25-40 %) ou s'annule (0.0 court-circuit) sur signal
    négatif clair.
    """
    # Adjacence quartier — seul un 0.0 franc (non-limitrophe) court-circuite.
    # 1.0/0.6/0.5 ne discriminent rien : le multiplicateur reste à 1.0 pour eux.
    s_adj = adjacency_score(quartier_dpe, quartier_annonce)
    if s_adj == 0.0:
        return 0.0, "quartier_non_limitrophe"

    # Signal prix m² local
    try:
        p_ann = float(prix_annonce_m2) if prix_annonce_m2 not in (None, "", 0) else None
    except (TypeError, ValueError):
        p_ann = None
    try:
        p_med = float(prix_median_local_m2) if prix_median_local_m2 not in (None, "", 0) else None
    except (TypeError, ValueError):
        p_med = None

    if p_ann is None or p_med is None or p_med <= 0:
        return 1.0, None

    ecart = abs(p_ann - p_med) / p_med
    if ecart > float(seuil_prix_court_circuit):
        return 0.0, "prix_m2_incoherent"
    if ecart > float(seuil_prix_penalite):
        return float(mult_ecart_prix_25_40), None
    return 1.0, None


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
    mult_ecart_prix_25_40: float = 0.7,
    seuil_prix_penalite: float = 0.25,
    seuil_prix_court_circuit: float = 0.40,
) -> dict[str, Any]:
    """Retourne `{score, breakdown, court_circuit, motif_court_circuit, multiplicateur_geo}`.

    Ordre :
      1) multiplicateur géo — si 0.0 → court-circuit avant tout autre calcul.
      2) s_rue + s_surface — si `s_rue == 0` ET `s_surface < 0.9` → court-circuit.
      3) sous-scores restants → somme pondérée × multiplicateur.
    """
    # 1. Multiplicateur géo en premier — peut couper court
    mult, motif_geo = compute_multiplicateur_geo(
        quartier_dpe, quartier_annonce,
        annonce.get("price_per_m2"), prix_median_local_m2,
        mult_ecart_prix_25_40=mult_ecart_prix_25_40,
        seuil_prix_penalite=seuil_prix_penalite,
        seuil_prix_court_circuit=seuil_prix_court_circuit,
    )
    if mult == 0.0:
        return {
            "score": 0.0,
            "breakdown": {
                "rue": 0.0, "surface": 0.0,
                "classe_energie": 0.0, "type_bien": 0.0, "etage": 0.0,
            },
            "multiplicateur_geo": 0.0,
            "court_circuit": True,
            "motif_court_circuit": motif_geo,
        }

    # 2. rue + surface (court-circuit rue différente + surface faible)
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
                "rue": s_rue, "surface": s_surface,
                "classe_energie": 0.0, "type_bien": 0.0, "etage": 0.0,
            },
            "multiplicateur_geo": mult,
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

    somme = (
        float(poids.get("rue", 0.0)) * s_rue
        + float(poids.get("surface", 0.0)) * s_surface
        + float(poids.get("classe_energie", 0.0)) * s_classe
        + float(poids.get("type_bien", 0.0)) * s_type
        + float(poids.get("etage", 0.0)) * s_etage
    )
    score = somme * mult
    return {
        "score": round(score, 4),
        "breakdown": {
            "rue": s_rue, "surface": s_surface,
            "classe_energie": s_classe, "type_bien": s_type, "etage": s_etage,
        },
        "multiplicateur_geo": mult,
        "court_circuit": False,
        "motif_court_circuit": None,
    }
