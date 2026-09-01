"""KOLO A3 — Extraction rue + étage depuis title/description.

Règle : parmi les voies de `voies_by_postcode(cp)`, on cherche celles qui
apparaissent dans le texte concaténé (title + description). Si EXACTEMENT une
est trouvée → on l'écrit. Sinon (plusieurs, aucune) → NULL.
"""
from __future__ import annotations

import re
from typing import Optional

from a3.text import strip_accents

_ETAGE_PATTERNS = [
    (re.compile(r"\b(rez\s*-?\s*de\s*-?\s*chauss[eé]e|rdc|r\.d\.c\.?)\b", re.I), 0),
    (re.compile(r"\b(?:au\s+)?(\d{1,2})\s*(?:e|er|eme|ème|ᵉ|ième|nd|rd|th)?\s*(?:étage|etage|niveau)\b", re.I), None),
    (re.compile(r"\bétage\s*n?°?\s*(\d{1,2})\b", re.I), None),
    (re.compile(r"\bau\s+(\d{1,2})\s*(?:e|er|eme|ème|ᵉ)\b", re.I), None),
]

_DERNIER_ETAGE = re.compile(r"\b(dernier|dernière)\s+[eé]tage\b", re.I)


def extract_etage(text: str) -> Optional[int]:
    """Retourne l'étage extrait (int) ou None. 0 = RDC. 'dernier étage' → None
    car on ne sait pas combien de niveaux a l'immeuble."""
    if not text:
        return None
    t = str(text)
    for pat, fixed in _ETAGE_PATTERNS:
        m = pat.search(t)
        if m:
            if fixed is not None:
                return fixed
            try:
                val = int(m.group(1))
                if 0 <= val <= 40:
                    return val
            except (ValueError, IndexError):
                continue
    return None


def _match_voies_in_text(text_norm: str, voies_norm: list[str]) -> list[str]:
    """Retourne les voies détectées dans `text_norm` (déjà normalisé).

    On cherche chaque voie précédée/suivie d'un délimiteur pour éviter les
    faux positifs (« rome » qui matche « rome garden »).
    """
    found: set[str] = set()
    for voie in voies_norm:
        if not voie or len(voie) < 3:
            continue
        # Recherche mot-borné
        pat = re.compile(rf"(?:^|[^a-z0-9]){re.escape(voie)}(?:$|[^a-z0-9])", re.I)
        if pat.search(text_norm):
            found.add(voie)
    return sorted(found)


def _normalize_text(s: str) -> str:
    return strip_accents(str(s or "")).lower()


def extract_rue_and_etage(
    title: Optional[str],
    description: Optional[str],
    voies_norm: list[str],
    listing_floor: Optional[int] = None,
) -> tuple[Optional[str], Optional[int]]:
    """Retourne `(rue_extraite, etage_extrait)`.

    - rue : uniquement si EXACTEMENT une voie de la liste apparaît
    - étage : parsé du texte SI `listing_floor` n'est pas déjà renseigné
    """
    text = " ".join(filter(None, [title, description]))
    if not text.strip() and listing_floor is None:
        return None, None

    text_norm = _normalize_text(text)
    found = _match_voies_in_text(text_norm, voies_norm)
    rue = found[0] if len(found) == 1 else None

    if listing_floor is not None:
        etage = int(listing_floor) if isinstance(listing_floor, (int, float)) else None
    else:
        etage = extract_etage(text)

    return rue, etage
