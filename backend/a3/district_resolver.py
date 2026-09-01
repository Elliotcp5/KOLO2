"""KOLO A3 — District resolver pour listings.

Certaines sources (seloger, pap, safti, century21) ne remplissent JAMAIS
le champ `district` de l'annonce. On extrait alors le quartier admin
depuis d'autres signaux, par ordre de fiabilité :

  1. `url`         : slug URL SeLoger de type
     `/paris-17eme-75/champerret-berthier/272095323.htm` → « champerret-berthier »
  2. `texte`       : titre + description, recherche des libellés connus de
     `LABEL_TO_QUARTIER` (mot entier)
  3. `coordonnees` : point-in-polygone sur `latitude`/`longitude` — fiable
     dès que l'annonce est géocodée
  4. `portail`     : le portail lui-même a rempli `district`

Retourne `(district_libelle, source)` où `district_libelle` est le libellé
officiel Ville de Paris (« Ternes », « Plaine de Monceaux », « Batignolles »,
« Epinettes ») pour que `label_to_quartier` en aval fasse le match direct.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

from a3.quartiers import (
    LABEL_TO_QUARTIER,
    label_to_quartier,
    point_to_quartier,
    slug_to_libelle,
)

# Regex : slug quartier détaillé (SeLoger) — accepte n'importe quelle ville.
# Ex : `/paris-17eme-75/champerret-berthier/272095323.htm`
#       `/marseille-8eme-13/sainte-anne/274020383.htm`
#       `/lyon-3eme-69/la-guillotiere-nord/267620559.htm`
_URL_SLUG_QUARTIER_RE = re.compile(
    r"/([a-z\-]+)-\d+(?:er|eme|nd)?-\d{2,3}/([a-z0-9\-]+)/\d+\.\w+",
    re.IGNORECASE,
)

# Regex : arrondissement dans l'URL (fallback quand pas de slug quartier).
# Ex : `paris-17eme-75`, `marseille-8e-13008`, `lyon-3eme-69`, `lyon-69`.
_URL_ARRONDISSEMENT_RE = re.compile(
    r"\b(paris|lyon|marseille)-(\d+)(?:er|eme|nd|e)?(?:-\d{2,5})?\b",
    re.IGNORECASE,
)

# Regex : arrondissement dans le titre / description.
# Ex : « Marseille 8E », « Lyon 3e », « Paris 17e ».
_TEXT_ARRONDISSEMENT_RE = re.compile(
    r"\b(paris|lyon|marseille)\s+(\d+)(?:e|er|eme|nd)?\b",
    re.IGNORECASE,
)


def _strip_accents(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c))


# Table pré-calculée : libellé de LABEL_TO_QUARTIER (sans accents, lowercase)
# → (slug_admin, longueur). Trié par longueur décroissante pour matcher
# « champerret-berthier » avant « champerret » sur le texte.
def _build_text_index() -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for label, slug in LABEL_TO_QUARTIER.items():
        norm = _strip_accents(label).lower().strip()
        if not norm:
            continue
        out.append((norm, slug))
    # Doublons/formes courtes doublonnées gérées par set de textes.
    seen: set[str] = set()
    dedup: list[tuple[str, str]] = []
    for norm, slug in out:
        if norm in seen:
            continue
        seen.add(norm)
        dedup.append((norm, slug))
    # Longs libellés d'abord (matching gourmand)
    dedup.sort(key=lambda x: -len(x[0]))
    return dedup


_TEXT_INDEX: Optional[list[tuple[str, str]]] = None


def _get_text_index() -> list[tuple[str, str]]:
    global _TEXT_INDEX
    if _TEXT_INDEX is None:
        _TEXT_INDEX = _build_text_index()
    return _TEXT_INDEX


def _resolve_via_url(url: Optional[str]) -> Optional[str]:
    """Extrait un slug quartier ou d'arrondissement depuis l'URL.

    Priorité :
      1) slug de quartier fin (SeLoger « /marseille-8eme-13/perier/… »)
      2) slug d'arrondissement (« marseille-8e-13008 », « lyon-3eme-69 »,
         « paris-17eme-75 ») — fallback quand pas de slug quartier
    """
    if not url:
        return None
    # 1) Slug quartier fin
    m = _URL_SLUG_QUARTIER_RE.search(url)
    if m:
        slug_url = m.group(2).lower()
        admin_slug, _unknown = label_to_quartier(slug_url.replace("-", " "))
        if admin_slug:
            return admin_slug
    # 2) Arrondissement
    m = _URL_ARRONDISSEMENT_RE.search(url)
    if m:
        city = m.group(1).lower()
        num = m.group(2)
        admin_slug, _unknown = label_to_quartier(f"{city} {num}")
        if admin_slug:
            return admin_slug
    return None


def _resolve_via_texte(title: Optional[str], description: Optional[str]) -> Optional[str]:
    """Cherche un libellé connu (mot entier) dans title + description.

    Priorité aux plus longs libellés (« champerret-berthier » avant
    « champerret »). Fallback : regex arrondissement direct (« Marseille 8E »,
    « Lyon 3e », « Paris 17e ») quand rien de plus fin ne matche.
    """
    if not title and not description:
        return None
    txt = f"{title or ''}\n{description or ''}"
    hay = _strip_accents(txt).lower()
    hay_flat = re.sub(r"[\s\-/]+", " ", hay)
    # 1) Libellés fins connus (Ternes-Maillot, Perier, Bonneveine…)
    for norm, slug in _get_text_index():
        needle = re.sub(r"[\s\-/]+", " ", norm).strip()
        if not needle or len(needle) < 5:
            continue
        if re.search(rf"\b{re.escape(needle)}\b", hay_flat):
            return slug
    # 2) Fallback arrondissement (Marseille 8, Lyon 3, Paris 17)
    m = _TEXT_ARRONDISSEMENT_RE.search(txt)
    if m:
        city = m.group(1).lower()
        num = m.group(2)
        slug, _unknown = label_to_quartier(f"{city} {num}")
        if slug:
            return slug
    return None


def _resolve_via_coordonnees(
    latitude: Optional[float], longitude: Optional[float]
) -> Optional[str]:
    if latitude is None or longitude is None:
        return None
    return point_to_quartier(latitude, longitude)


def resolve_district(
    *,
    portal: Optional[str] = None,
    district_from_portal: Optional[str] = None,
    url: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> tuple[Optional[str], Optional[str]]:
    """Résout `(district_libelle, district_source)`.

    Priorité : `portail` > `url` > `texte` > `coordonnees`.
    Retourne `(None, None)` si aucune piste ne donne un quartier admin connu.

    - `district_libelle` : libellé officiel (« Ternes », « Plaine de Monceaux »…)
    - `district_source`  : `portail` | `url` | `texte` | `coordonnees`
    """
    # 1. Le portail a déjà rempli district → on garde tel quel, source = portail.
    if district_from_portal and str(district_from_portal).strip():
        return str(district_from_portal).strip(), "portail"

    # 2. URL slug
    slug = _resolve_via_url(url)
    if slug:
        return slug_to_libelle(slug) or slug, "url"

    # 3. Texte
    slug = _resolve_via_texte(title, description)
    if slug:
        return slug_to_libelle(slug) or slug, "texte"

    # 4. Coordonnées
    slug = _resolve_via_coordonnees(latitude, longitude)
    if slug:
        return slug_to_libelle(slug) or slug, "coordonnees"

    return None, None
