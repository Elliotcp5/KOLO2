"""KOLO A3 — Normalisation textuelle (rues, classes énergie, types de bien)."""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

# Types de voie retirés avant comparaison
_VOIE_TYPES = (
    "rue", "avenue", "boulevard", "bd", "place", "quai", "impasse",
    "allee", "allée", "square", "villa", "chemin", "cours", "route",
    "passage", "sentier", "voie", "faubourg", "esplanade", "parvis",
    "rond-point", "cite", "cité", "traverse", "promenade", "port",
)

# Articles / mots outils retirés
_STOP_WORDS = ("le", "la", "les", "l", "de", "du", "des", "d", "et", "au", "aux")


def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", s)
        if not unicodedata.combining(c)
    )


def normalize_voie(s: Optional[str]) -> Optional[str]:
    """« Rue de Rome » → « rome ». « Boulevard Malesherbes » → « malesherbes ».
    Minuscules, sans accents, sans type de voie, sans article.
    Retourne None si vide après normalisation.
    """
    if not s:
        return None
    txt = strip_accents(str(s)).lower()
    # Remplace ponctuation par espace
    txt = re.sub(r"[^\w\s\-]", " ", txt)
    tokens = [t for t in re.split(r"[\s\-']", txt) if t]
    # Retire le type de voie si en tête
    while tokens and tokens[0] in _VOIE_TYPES:
        tokens.pop(0)
    # Retire les articles/mots outils en tête
    while tokens and tokens[0] in _STOP_WORDS:
        tokens.pop(0)
    # Retire aussi les articles internes courts (« de », « du », « des »)
    tokens = [t for t in tokens if t not in _STOP_WORDS]
    if not tokens:
        return None
    return " ".join(tokens).strip()


def normalize_ges_class(v: Optional[str]) -> Optional[str]:
    """Retourne A..G ou None. 'NS' → None (non soumis)."""
    if not v:
        return None
    s = str(v).strip().upper()
    if s in ("NS", "N/A", "NA", "", "-"):
        return None
    if s and s[0] in "ABCDEFG":
        return s[0]
    return None


def normalize_type_bien_dpe(v: Optional[str]) -> str:
    """Normalise le `type_batiment` ADEME vers appartement/maison/immeuble/autre."""
    if not v:
        return "autre"
    s = strip_accents(str(v)).lower().strip()
    if "appart" in s:
        return "appartement"
    if "maison" in s or "villa" in s or "pavillon" in s:
        return "maison"
    if "immeuble" in s:
        return "immeuble"
    return "autre"
