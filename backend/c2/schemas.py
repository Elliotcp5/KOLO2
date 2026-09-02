"""C2 — Pydantic schemas pour /api/dossiers (Avis de valeur).

Le schéma métier canonique est décrit dans `schema_avis_de_valeur.json`
(22 sections, ~190 champs). Comme le contenu de chaque section peut varier
selon le type de bien (`appartement`/`maison`/…) et le niveau (1 = essentiel,
2 = tout le dossier), on modélise chaque section en `Dict[str, Any]` — la
validation fine des champs reste côté frontend (UI éditeur, Session 3) et
côté rendu PDF (Session 2, contrôle des variables Jinja2).

Les 22 identifiants de section sont figés ici : c'est la seule contrainte
structurelle imposée au backend.
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# Ordre et identifiants des 22 sections — MUST match `schema_avis_de_valeur.json`.
SECTION_IDS: tuple[str, ...] = (
    "dossier",
    "redacteur",
    "mission",
    "identification",
    "surfaces",
    "composition",
    "technique",
    "energie",
    "copropriete",
    "charges_fiscalite",
    "environnement",
    "marche",
    "methode",
    "comparables",
    "ajustements",
    "swot",
    "conclusion",
    "net_vendeur",
    "strategie",
    "mentions",
    "annexes",
    "signature",
)

Niveau = Literal[1, 2]
Statut = Literal["brouillon", "complet", "envoye", "archive"]


class DossierSections(BaseModel):
    """Contenu métier du dossier — un dict libre par section.

    Chaque clé correspond à un `id` de section du JSON canonique. Les
    valeurs sont des dicts `field_id -> value` (any). L'UI éditeur (Session 3)
    est responsable de la conformité fine aux types déclarés dans le schéma.
    """

    model_config = ConfigDict(extra="forbid")

    dossier: dict[str, Any] = Field(default_factory=dict)
    redacteur: dict[str, Any] = Field(default_factory=dict)
    mission: dict[str, Any] = Field(default_factory=dict)
    identification: dict[str, Any] = Field(default_factory=dict)
    surfaces: dict[str, Any] = Field(default_factory=dict)
    composition: dict[str, Any] = Field(default_factory=dict)
    technique: dict[str, Any] = Field(default_factory=dict)
    energie: dict[str, Any] = Field(default_factory=dict)
    copropriete: dict[str, Any] = Field(default_factory=dict)
    charges_fiscalite: dict[str, Any] = Field(default_factory=dict)
    environnement: dict[str, Any] = Field(default_factory=dict)
    marche: dict[str, Any] = Field(default_factory=dict)
    methode: dict[str, Any] = Field(default_factory=dict)
    comparables: dict[str, Any] = Field(default_factory=dict)
    ajustements: dict[str, Any] = Field(default_factory=dict)
    swot: dict[str, Any] = Field(default_factory=dict)
    conclusion: dict[str, Any] = Field(default_factory=dict)
    net_vendeur: dict[str, Any] = Field(default_factory=dict)
    strategie: dict[str, Any] = Field(default_factory=dict)
    mentions: dict[str, Any] = Field(default_factory=dict)
    annexes: dict[str, Any] = Field(default_factory=dict)
    signature: dict[str, Any] = Field(default_factory=dict)


class DossierCreate(BaseModel):
    """Payload de création d'un dossier.

    - `estimation_id` : obligatoire. Le backend rehydrate le bien, les
      comparables figés, le prix de commercialisation et le profil rédacteur.
    - `niveau` : 1 (L'essentiel) ou 2 (Tout le dossier). Défaut 1.
    - `demandeur_nom` / `objet` / `date_visite` : facultatifs à la création,
      complétables ensuite via PATCH.
    """

    estimation_id: str = Field(..., min_length=1)
    niveau: Niveau = 1
    demandeur_nom: Optional[str] = None
    demandeur_qualite: Optional[str] = None
    objet: Optional[str] = None
    date_visite: Optional[str] = None  # ISO date "YYYY-MM-DD"
    bien_visite: Optional[bool] = None


class DossierPatch(BaseModel):
    """Mise à jour partielle d'un dossier.

    - `niveau` : peut basculer L'essentiel <-> Tout le dossier.
    - `statut` : `brouillon` / `complet` / `envoye` / `archive`.
    - `sections` : dict partiel `section_id -> {field_id -> value}`. Chaque
      section fournie remplace l'entièreté de la section correspondante côté
      Mongo (upsert par section, pas de merge profond pour éviter les états
      hybrides difficiles à raisonner).
    """

    model_config = ConfigDict(extra="forbid")

    niveau: Optional[Niveau] = None
    statut: Optional[Statut] = None
    sections: Optional[dict[str, dict[str, Any]]] = None
