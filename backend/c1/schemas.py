"""C1 — Pydantic schemas pour POST /api/estimations."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class EstimationInput(BaseModel):
    """Payload d'entrée du moteur d'estimation.

    Deux modes :
      - `opportunite_id` fourni : le back rehydrate le DPE et l'adresse.
      - `adresse` + `type_bien` + `surface` fournis : mode « estimation libre ».
    """

    opportunite_id: Optional[str] = None
    adresse: Optional[str] = None
    code_postal: Optional[str] = None

    # Fallback si pas d'opportunité — obligatoires en mode libre
    lat: Optional[float] = None
    lng: Optional[float] = None
    type_bien: Optional[Literal["Appartement", "Maison"]] = None
    surface_habitable: Optional[float] = Field(default=None, ge=1, le=5000)
    classe_dpe: Optional[Literal["A", "B", "C", "D", "E", "F", "G"]] = None
    annee_construction: Optional[int] = None

    # Réponses aux 5 questions (toutes facultatives — le calcul continue avec des défauts)
    etat: Optional[Literal["a_rafraichir", "bon_etat", "renove", "neuf"]] = None
    etage: Optional[Literal["rdc", "1", "2", "3", "3plus"]] = None
    ascenseur: Optional[bool] = None
    exterieur: Optional[Literal["aucun", "balcon", "terrasse", "jardin"]] = None
    exterieur_surface_m2: Optional[float] = Field(default=None, ge=0, le=1000)
    stationnement: Optional[Literal["aucun", "place", "garage"]] = None

    # Surcharges pro (rare — les coefs viennent d'`infos_pro`)
    montant_travaux_eur: Optional[float] = Field(default=None, ge=0, le=1_000_000)
    vue_degagee: Optional[bool] = None
    vis_a_vis: Optional[bool] = None

    # Net vendeur (facultatif — utilise le profil par défaut)
    net_vendeur: Optional[bool] = None

    @field_validator("etat", "etage", "exterieur", "stationnement", "classe_dpe", "type_bien", mode="before")
    @classmethod
    def _empty_string_to_none(cls, v: Any) -> Any:
        """BLOC 2 (build 2.24) : les Literal du parcours ne doivent jamais
        rejeter `""` sur un 422 Pydantic brut.

        Un ancien brouillon offline (localStorage via b3offline.loadDraft) peut
        contenir `stationnement:""` après trois builds de régressions. Le symptôme
        signalé par le user (« erreur à l'étape 3 quel que soit le choix retenu »)
        venait de là : l'app renvoyait le draft bugué AVANT même que le user ne
        clique, et le serveur refusait avec `literal_error`. On coerce vers None,
        le calcul utilise les défauts, l'estimation va au bout.
        """
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @field_validator("code_postal")
    @classmethod
    def _cp_5_digits(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        if not s.isdigit() or len(s) != 5:
            raise ValueError("code_postal doit faire 5 chiffres")
        return s


class EstimationAjustement(BaseModel):
    """Une ligne détaillée d'ajustement affichée dans l'accordéon."""

    code: str
    libelle: str
    valeur: float           # pourcentage (0.04 = +4 %) ou montant € si eur=True
    unite: Literal["pct", "eur"] = "pct"


class EstimationOutput(BaseModel):
    """Réponse renvoyée au front + persistée dans `estimations`."""

    estimation_id: str
    ok: bool

    # Chiffres clés
    valeur_venale: int
    prix_commercialisation: int
    fourchette_basse: int
    fourchette_haute: int
    prix_m2_retenu: int
    surface_ponderee_m2: float
    net_vendeur: Optional[int] = None
    taux_honoraires_pct: Optional[float] = None
    honoraires_charge: Optional[str] = None

    # Confiance
    fiabilite: Literal["elevee", "moyenne", "faible"]
    fiabilite_message: Optional[str] = None
    plafond_atteint: bool = False

    # Détail (pour l'accordéon)
    nb_comparables: int
    radius_used_m: int
    fenetre_mois: int
    classe_mediane_comparables: Optional[str] = None
    mediane_locale_prix_m2: Optional[int] = None
    ajustements: list[EstimationAjustement]
    total_ajustement_pct: float
    total_ajustement_eur: float

    # Traçabilité (comparables figés)
    comparables_ids: list[str]
