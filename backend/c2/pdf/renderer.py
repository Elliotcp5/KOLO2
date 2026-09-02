"""C2 PDF — renderer WeasyPrint + contexte Jinja2.

Rend un dossier (doc Mongo `dossiers`) en PDF A4 portrait, charte fournie,
en moins de 10 s, moins de 10 Mo, sans requête réseau (polices locales,
photos redimensionnées puis mises en cache disque).
"""
from __future__ import annotations

import logging
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

from .images import optimize_image, optimize_many

logger = logging.getLogger("c2.pdf.renderer")

HERE = Path(__file__).resolve().parent
BACKEND_ROOT = HERE.parent.parent
FONTS_CSS_PATH = BACKEND_ROOT / "c1" / "pdf_fonts.css"
STYLE_CSS_PATH = HERE / "style.css"


# ---------------------------------------------------------------------------
# Utilitaires de formatage
# ---------------------------------------------------------------------------
_MOIS_FR = [
    "", "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

TYPE_BIEN_LABEL = {
    "appartement": "Appartement",
    "maison": "Maison",
    "immeuble": "Immeuble",
    "terrain": "Terrain",
    "local": "Local commercial",
    "parking": "Parking",
}


def _fmt_eur(v: Any) -> str | None:
    if v is None or v == "":
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    # 480000 → « 480 000 € »
    return f"{int(round(n)):,}".replace(",", "\u202f") + "\u00a0€"


def _fmt_pct(v: Any) -> str | None:
    if v is None:
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    return f"{n * 100:+.1f}\u00a0%".replace(".", ",")


def _fmt_date_fr(v: Any) -> str | None:
    if not v:
        return None
    s = str(v)
    # Try YYYY-MM-DD
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return f"{d} {_MOIS_FR[mo]} {y}"
        except IndexError:
            return None
    return s


def _adresse_ligne1(adr: str | None) -> str | None:
    if not adr:
        return None
    # Coupe à la virgule si le user a mis « rue X, Ville »
    return adr.split(",")[0].strip()


def _short_name(name: str | None) -> str:
    """Raccourcit un nom d'agence pour le running header (max 32 chars)."""
    if not name:
        return "KOLO"
    n = name.strip()
    return n if len(n) <= 32 else (n[:30] + "…")


# ---------------------------------------------------------------------------
# Table des matières — ordre déterministe des sections rendues
# ---------------------------------------------------------------------------
TOC_ENTRIES = [
    (1, "L'essentiel", "sec-essentiel"),
    (2, "Atouts et points de vigilance", "sec-swot"),
    (3, "Identification du bien", "sec-identification"),
    (4, "Surfaces", "sec-surfaces"),
    (5, "Performance énergétique", "sec-energie"),
    (6, "Marché local", "sec-marche"),
    (7, "Références comparables", "sec-comparables"),
    (8, "Conclusion de valeur", "sec-conclusion"),
    (9, "Conditions et limites de cet avis", "sec-mentions"),
]


# ---------------------------------------------------------------------------
# Construction du contexte à partir du doc Mongo `dossiers`
# ---------------------------------------------------------------------------
def build_context(dossier_doc: dict[str, Any]) -> dict[str, Any]:
    sections: dict[str, Any] = dossier_doc.get("sections") or {}

    dossier = sections.get("dossier", {})
    redacteur = sections.get("redacteur", {})
    mission = sections.get("mission", {})
    identification = sections.get("identification", {})
    surfaces = sections.get("surfaces", {})
    composition = sections.get("composition", {})
    energie = sections.get("energie", {})
    marche = sections.get("marche", {})
    methode = sections.get("methode", {})
    comparables_sec = sections.get("comparables", {})
    ajustements = sections.get("ajustements", {})
    swot = sections.get("swot", {})
    conclusion = sections.get("conclusion", {})
    net_vendeur = sections.get("net_vendeur", {})
    mentions = sections.get("mentions", {})
    signature = sections.get("signature", {})

    # ---- photos : compression silencieuse ----
    photo_cover = optimize_image(dossier.get("photo_couverture"))

    # ---- adresse / commune ----
    adresse_ligne1 = _adresse_ligne1(identification.get("adresse"))

    # ---- comparables : formatage FR + labels tags ----
    rows_in: list[dict[str, Any]] = comparables_sec.get("comparables") or []
    rows_out: list[dict[str, Any]] = []
    for c in rows_in:
        row = dict(c)
        row["prix_fr"] = _fmt_eur(c.get("prix"))
        row["prix_m2_fr"] = _fmt_eur(c.get("prix_m2"))
        row["prix_m2_corrige_fr"] = _fmt_eur(c.get("prix_m2_corrige"))
        row["ajustement_fr"] = _fmt_pct(c.get("ajustement"))
        row["date"] = _fmt_date_fr(c.get("date")) or c.get("date")
        rows_out.append(row)

    # ---- annexes pondérées ----
    annexes_ponderees = surfaces.get("annexes") or []
    for a in annexes_ponderees:
        if "surface_ponderee" not in a and a.get("surface") is not None and a.get("coef") is not None:
            try:
                a["surface_ponderee"] = round(float(a["surface"]) * float(a["coef"]), 2)
            except Exception:
                pass

    # ---- position du pin sur l'échelle de valeur ----
    v_low = conclusion.get("valeur_basse")
    v_high = conclusion.get("valeur_haute")
    v_ret = conclusion.get("valeur_venale")
    position_valeur_pct: float = 50.0
    if isinstance(v_low, (int, float)) and isinstance(v_high, (int, float)) and v_high > v_low and isinstance(v_ret, (int, float)):
        raw = (v_ret - v_low) / (v_high - v_low) * 100
        position_valeur_pct = max(2.0, min(98.0, raw))

    ctx: dict[str, Any] = {
        # metadata
        "fonts_css_path": str(FONTS_CSS_PATH),
        "style_css_path": str(STYLE_CSS_PATH),
        "toc": [
            {"num": num, "label": lbl, "id": _id}
            for num, lbl, _id in TOC_ENTRIES
        ],
        # dossier
        "dossier": dossier,
        "validite_mois": dossier.get("validite_mois") or 6,
        "date_edition_fr": _fmt_date_fr(dossier.get("date_edition")) or _fmt_date_fr(date.today().isoformat()),
        "date_visite_fr": _fmt_date_fr(dossier.get("date_visite")),
        "photo_couverture": photo_cover,
        # rédacteur / agence
        "agent_nom": redacteur.get("agent_nom"),
        "agent_qualite": redacteur.get("agent_qualite"),
        "agent_tel": redacteur.get("agent_tel"),
        "agent_email": redacteur.get("agent_email"),
        "agence_nom": redacteur.get("agence_nom"),
        "agence_nom_short": _short_name(redacteur.get("agence_nom") or "KOLO"),
        "agence_forme": redacteur.get("agence_forme"),
        "agence_siren": redacteur.get("agence_siren"),
        "agence_adresse": redacteur.get("agence_adresse"),
        "carte_pro": redacteur.get("carte_pro"),
        "carte_pro_cci": redacteur.get("carte_pro_cci"),
        "rcp_assureur": redacteur.get("rcp_assureur"),
        "rcp_police": redacteur.get("rcp_police"),
        # mission
        "demandeur_nom": mission.get("demandeur_nom"),
        "objet": mission.get("objet"),
        # identification
        "type_bien": identification.get("type_bien"),
        "type_bien_label": TYPE_BIEN_LABEL.get(
            (identification.get("type_bien") or "").lower(), identification.get("type_bien")
        ),
        "adresse_ligne1": adresse_ligne1,
        "code_postal": identification.get("code_postal"),
        "commune": identification.get("commune"),
        "annee_construction": identification.get("annee_construction"),
        "regime": identification.get("regime"),
        "occupation": identification.get("occupation"),
        "cadastre_section": identification.get("cadastre_section"),
        "cadastre_numero": identification.get("cadastre_numero"),
        "nature_propriete": identification.get("nature_propriete"),
        "surface_terrain": identification.get("surface_terrain"),
        # composition
        "etage": composition.get("etage"),
        "ascenseur": composition.get("ascenseur"),
        "nb_etages_immeuble": composition.get("nb_etages_immeuble"),
        "nb_pieces": composition.get("nb_pieces"),
        "exposition_principale": composition.get("exposition_principale"),
        "vue": composition.get("vue"),
        # surfaces
        "surface_habitable": surfaces.get("surface_habitable"),
        "surface_carrez": surfaces.get("surface_carrez"),
        "surface_ponderee_totale": surfaces.get("surface_ponderee_totale"),
        "origine_surface": surfaces.get("origine_surface"),
        "annexes_ponderees": annexes_ponderees,
        # énergie
        "dpe_classe": energie.get("dpe_classe"),
        "dpe_conso": energie.get("dpe_conso"),
        "dpe_emissions": energie.get("dpe_emissions"),
        "ges_classe": energie.get("ges_classe"),
        "dpe_date_fr": _fmt_date_fr(energie.get("dpe_date")),
        "dpe_validite_fr": _fmt_date_fr(energie.get("dpe_validite")),
        "passoire": energie.get("passoire") is True,
        "interdiction_location": energie.get("interdiction_location"),
        # marché
        "prix_m2_commune_fr": _fmt_eur(marche.get("prix_m2_commune")),
        "prix_m2_quartier_fr": _fmt_eur(marche.get("prix_m2_quartier")),
        "prix_m2_segment_fr": _fmt_eur(marche.get("prix_m2_segment")),
        "delai_vente_moyen": marche.get("delai_vente_moyen"),
        "stock_concurrent": marche.get("stock_concurrent"),
        "evolution_12m": _fmt_pct(marche.get("evolution_12m")),
        "volume_transactions": marche.get("volume_transactions"),
        "ecart_affiche_acte": _fmt_pct(marche.get("ecart_affiche_acte")),
        "quartier": marche.get("quartier"),
        # méthode + comparables
        "methodes_retenues": methode.get("methodes_retenues") or ["comparaison"],
        "justification_methode": methode.get("justification_methode"),
        "comparables": rows_out,
        "prix_m2_moyen_corrige_fr": _fmt_eur(comparables_sec.get("prix_m2_moyen_corrige")),
        # SWOT
        "atouts": swot.get("atouts") or [],
        "faiblesses": swot.get("faiblesses") or [],
        # conclusion
        "valeur_venale_fr": _fmt_eur(conclusion.get("valeur_venale")),
        "valeur_basse_fr": _fmt_eur(conclusion.get("valeur_basse")),
        "valeur_haute_fr": _fmt_eur(conclusion.get("valeur_haute")),
        "prix_m2_retenu_fr": _fmt_eur(conclusion.get("prix_m2_retenu")),
        "prix_presentation_fr": _fmt_eur(conclusion.get("prix_presentation")),
        "marge_negociation_fr": _fmt_pct(conclusion.get("marge_negociation")),
        "net_vendeur_fr": _fmt_eur(net_vendeur.get("net_vendeur")),
        "indice_confiance": conclusion.get("indice_confiance"),
        "position_valeur_pct": position_valeur_pct,
        # ajustement manuel : premier motif rencontré dans la grille, s'il existe
        "adjust_motif": (
            ajustements.get("motif")
            or (ajustements.get("grille") or [{}])[0].get("motif")
            if isinstance(ajustements.get("grille"), list) and ajustements.get("grille")
            else ajustements.get("motif")
        ),
        # mentions
        "mention_gratuite": mentions.get("mention_gratuite")
            or "Cet avis vous a été remis à titre gracieux, dans le cadre d'une démarche commerciale préalable à la signature d'un mandat de vente.",
        "duree_conservation": mentions.get("duree_conservation") or "trois ans à compter du dernier contact",
        # signature
        "lieu": signature.get("lieu"),
        "date_signature_fr": _fmt_date_fr(signature.get("date_signature")),
        "signature_image": optimize_image(signature.get("signature_image")),
    }
    return ctx


# ---------------------------------------------------------------------------
# Nom de fichier
# ---------------------------------------------------------------------------
def _slugify(text: str) -> str:
    text = (text or "").strip()
    text = re.sub(r"[àáâãäå]", "a", text.lower())
    text = re.sub(r"[èéêë]", "e", text)
    text = re.sub(r"[ìíîï]", "i", text)
    text = re.sub(r"[òóôõö]", "o", text)
    text = re.sub(r"[ùúûü]", "u", text)
    text = re.sub(r"[ç]", "c", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    # Filet de sécurité : le nom de fichier ne doit jamais contenir « expertise »,
    # même si l'adresse elle-même en contient (règle de non-auto-qualification
    # documentaire).
    text = re.sub(r"expertises?", "", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-") or "sans-adresse"


def build_filename(dossier_doc: dict[str, Any]) -> str:
    sections = dossier_doc.get("sections") or {}
    adr = (sections.get("identification") or {}).get("adresse") or ""
    slug = _slugify(_adresse_ligne1(adr) or "")
    stamp = datetime.now().strftime("%Y%m%d")
    return f"Avis-de-valeur_{slug}_{stamp}.pdf"


# ---------------------------------------------------------------------------
# Rendu HTML → PDF
# ---------------------------------------------------------------------------
_env = Environment(
    loader=FileSystemLoader(str(HERE)),
    autoescape=True,
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_html(dossier_doc: dict[str, Any]) -> str:
    ctx = build_context(dossier_doc)
    tmpl = _env.get_template("template.html.j2")
    return tmpl.render(**ctx)


def render_pdf(dossier_doc: dict[str, Any], out_path: Path) -> Path:
    """Rend le PDF et l'écrit sur disque. Retourne le chemin."""
    html_str = render_html(dossier_doc)
    HTML(string=html_str, base_url=str(HERE)).write_pdf(str(out_path))
    return out_path
