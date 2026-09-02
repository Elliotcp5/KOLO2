"""C2 — Pré-remplissage d'un dossier à partir d'une estimation.

Prend en entrée :
  - le doc `estimation` (résultat du moteur C1 + bien + comparables figés)
  - le doc `user` (avec `infos_pro` complété)
  - `config_matching` (pour `marge_negociation`, `validite_mois`…)

Retourne un dict `{section_id: {field_id: value}}` conforme au schéma
canonique `schema_avis_de_valeur.json`. Les champs non calculables
(demandeur, date de visite, atouts…) restent absents — le rédacteur les
saisit ensuite via PATCH.
"""
from __future__ import annotations

import secrets
from datetime import date, datetime, timezone
from typing import Any


# Coefficients par défaut pour les annexes pondérées (repris tel quel du
# schéma canonique). Utilisés si `infos_pro.pond_*` n'est pas renseigné.
COEFS_ANNEXES_DEFAUT: dict[str, float] = {
    "balcon": 0.25,
    "terrasse": 0.35,
    "loggia": 0.4,
    "jardin privatif": 0.1,
    "cave": 0.15,
    "grenier": 0.15,
    "combles": 0.2,
    "garage": 0.4,
    "box": 0.4,
    "place de parking": 0.3,
    "dépendance": 0.3,
}


def generate_ref() -> str:
    """Référence dossier : `AV-YYYY-XXXXXX` (année + 6 hex majuscules)."""
    year = datetime.now(timezone.utc).year
    return f"AV-{year}-{secrets.token_hex(3).upper()}"


def _type_bien_from_estimation(estim: dict[str, Any]) -> str:
    """Estimation stocke `type_bien` en `Appartement`/`Maison` (majuscule).
    Le schéma dossier attend `appartement`/`maison` (minuscule)."""
    tb = (estim.get("type_bien") or "").strip().lower()
    if tb in ("appartement", "maison", "immeuble", "terrain", "local", "parking"):
        return tb
    return "appartement"


def _regime_par_defaut(type_bien: str) -> str:
    if type_bien == "appartement":
        return "copropriété"
    if type_bien in ("maison", "terrain"):
        return "monopropriété"
    return "monopropriété"


def _comparables_from_estimation(estim: dict[str, Any]) -> list[dict[str, Any]]:
    """Reformate les comparables figés en lignes de tableau du dossier.

    Chaque comparable C1 contient : id, adresse, date, prix, surface,
    type, dpe, distance_m, corrections détaillées. On garde l'essentiel
    et on marque `nature = "vente actée"` (DVF = mutations passées).
    """
    rows: list[dict[str, Any]] = []
    for c in estim.get("comparables_figes") or []:
        distance_m = c.get("distance_m")
        prix = c.get("prix")
        surface = c.get("surface")
        prix_m2 = None
        if isinstance(prix, (int, float)) and isinstance(surface, (int, float)) and surface > 0:
            prix_m2 = round(float(prix) / float(surface))
        rows.append({
            "nature": "vente actée",
            "adresse": c.get("adresse") or c.get("rue") or "",
            "distance": f"{int(distance_m)} m" if isinstance(distance_m, (int, float)) else "",
            "type": c.get("type") or c.get("type_local") or "",
            "surface": surface,
            "pieces": c.get("nb_pieces") or c.get("pieces"),
            "etage": c.get("etage"),
            "dpe": c.get("classe_dpe") or c.get("dpe"),
            "prix": prix,
            "date": c.get("date") or c.get("date_mutation"),
            "prix_m2": prix_m2,
            "ajustement": c.get("total_correction_pct"),
            "justification": c.get("motif_correction") or "",
            "prix_m2_corrige": c.get("prix_m2_corrige"),
        })
    return rows


def _fiabilite_to_confiance(fiab: str | None) -> str:
    return {"elevee": "élevé", "moyenne": "moyen", "faible": "faible"}.get(fiab or "", "moyen")


def build_prefill(
    *,
    estim: dict[str, Any],
    user: dict[str, Any],
    config: dict[str, Any] | None = None,
    creation_payload: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    """Construit le dict `{section: {field: value}}` pour un nouveau dossier.

    Toutes les valeurs viennent de l'estimation, du profil pro de l'utilisateur
    ou de la config globale. Rien n'est inventé.
    """
    config = config or {}
    creation_payload = creation_payload or {}
    infos_pro: dict[str, Any] = user.get("infos_pro") or {}
    resultat: dict[str, Any] = estim.get("resultat") or {}
    inputs: dict[str, Any] = estim.get("inputs") or {}

    type_bien = _type_bien_from_estimation(estim)
    today_iso = date.today().isoformat()
    validite_mois = int(config.get("dossier_validite_mois") or 6)

    # ---- Section `dossier` ---------------------------------------------------
    dossier = {
        "ref": generate_ref(),
        "date_edition": today_iso,
        "validite_mois": validite_mois,
        "bien_visite": creation_payload.get("bien_visite"),
        "date_visite": creation_payload.get("date_visite"),
        "adresse_masquee": False,
    }

    # ---- Section `redacteur` — 100 % depuis `infos_pro` ---------------------
    redacteur = {
        "agent_nom": (
            f"{user.get('prenom') or ''} {user.get('nom') or ''}".strip()
            or user.get("name")
            or ""
        ),
        "agent_qualite": infos_pro.get("qualite") or infos_pro.get("statut_juridique") or "",
        "agent_tel": user.get("phone") or user.get("telephone") or infos_pro.get("telephone") or "",
        "agent_email": user.get("email") or "",
        "agence_nom": infos_pro.get("agence") or infos_pro.get("nom_agence") or "",
        "agence_forme": infos_pro.get("statut_juridique") or "",
        "agence_siren": infos_pro.get("siren") or "",
        "agence_adresse": user.get("adresse") or infos_pro.get("adresse") or "",
        "carte_pro": infos_pro.get("carte_t") or "",
        "carte_pro_cci": infos_pro.get("cci") or "",
        "rcp_assureur": infos_pro.get("rcp_assureur") or "",
        "rcp_police": infos_pro.get("rcp_police") or "",
        "garantie_financiere": infos_pro.get("garantie") or "",
    }

    # ---- Section `mission` — au choix du rédacteur, valeurs par défaut -----
    mission = {
        "demandeur_nom": creation_payload.get("demandeur_nom"),
        "demandeur_qualite": creation_payload.get("demandeur_qualite"),
        "objet": creation_payload.get("objet") or "mise en vente",
        "perimetre": (
            "après visite physique"
            if creation_payload.get("bien_visite")
            else "sur pièces"
        ),
    }

    # ---- Section `identification` — depuis l'estimation ---------------------
    identification = {
        "type_bien": type_bien,
        "adresse": estim.get("adresse"),
        "code_postal": estim.get("code_postal"),
        "commune": estim.get("ville"),
        "annee_construction": estim.get("annee_construction"),
        "regime": _regime_par_defaut(type_bien),
        "occupation": "libre",
    }

    # ---- Section `surfaces` -------------------------------------------------
    surface_habitable = estim.get("surface_habitable")
    surface_ponderee = resultat.get("surface_ponderee_m2")
    surfaces = {
        "surface_habitable": surface_habitable,
        "surface_ponderee_totale": surface_ponderee,
        "origine_surface": "déclaratif propriétaire",
    }

    # ---- Section `composition` --------------------------------------------
    composition: dict[str, Any] = {}
    etage_input = inputs.get("etage")
    if isinstance(etage_input, str):
        composition["etage"] = {"rdc": 0, "1": 1, "2": 2, "3": 3, "3plus": 4}.get(etage_input)
    if inputs.get("ascenseur") is not None:
        composition["ascenseur"] = bool(inputs.get("ascenseur"))

    # ---- Section `energie` — DPE pré-rempli par C1 -------------------------
    classe_dpe = estim.get("classe_dpe")
    energie: dict[str, Any] = {}
    if classe_dpe:
        energie["dpe_classe"] = classe_dpe
        energie["passoire"] = classe_dpe in ("F", "G")

    # ---- Section `marche` — chiffres du moteur -----------------------------
    marche = {
        "prix_m2_segment": resultat.get("mediane_locale_prix_m2"),
        "stock_concurrent": resultat.get("nb_comparables"),
    }

    # ---- Section `methode` -------------------------------------------------
    methode = {
        "methodes_retenues": ["comparaison"],
        "justification_methode": (
            "Méthode par comparaison directe avec les mutations récentes "
            f"({resultat.get('nb_comparables') or 0} biens comparables retenus dans un "
            f"rayon de {resultat.get('radius_used_m') or 0} m sur "
            f"{resultat.get('fenetre_mois') or 0} mois)."
        ),
    }

    # ---- Section `comparables` ---------------------------------------------
    comparables = {
        "comparables": _comparables_from_estimation(estim),
        "prix_m2_moyen_corrige": resultat.get("prix_m2_retenu"),
    }

    # ---- Section `conclusion` — chiffres clés du moteur --------------------
    marge_neg = config.get("marge_negociation")
    conclusion = {
        "valeur_venale": resultat.get("valeur_venale"),
        "valeur_basse": resultat.get("fourchette_basse"),
        "valeur_haute": resultat.get("fourchette_haute"),
        "prix_m2_retenu": resultat.get("prix_m2_retenu"),
        "prix_presentation": resultat.get("prix_commercialisation"),
        "marge_negociation": marge_neg,
        "indice_confiance": _fiabilite_to_confiance(resultat.get("fiabilite")),
    }

    # ---- Section `net_vendeur` — depuis estimation + profil pro ------------
    net_vendeur = {
        "prix_affiche": resultat.get("prix_commercialisation"),
        "honoraires_charge": (infos_pro.get("honoraires_charge") or "vendeur"),
    }
    if resultat.get("net_vendeur") is not None:
        net_vendeur["net_vendeur"] = resultat.get("net_vendeur")

    # ---- Section `strategie` -----------------------------------------------
    strategie = {
        "positionnement": resultat.get("prix_commercialisation"),
    }

    # ---- Section `mentions` — clés locked, dérivées uniquement ------------
    # Les textes verbatim vivent dans `template_avis_de_valeur.html` (bloc
    # `class="legal"`), avec leurs variables Jinja2 (`{{date_edition}}`,
    # `{{validite_mois}}`, `{{origine_surface}}`, `{{demandeur_nom}}`,
    # `{{mention_gratuite}}`, `{{agence_nom}}`, `{{duree_conservation}}`,
    # `{{agent_email}}`). On pré-remplit les variables ; les paragraphes
    # eux-mêmes seront rendus par WeasyPrint (Session 2).
    mentions = {
        "mention_gratuite": (
            "Cet avis vous a été remis à titre gracieux, dans le cadre d'une "
            "démarche commerciale préalable à la signature d'un mandat de vente."
        ),
        "duree_conservation": "trois ans à compter du dernier contact",
    }

    # ---- Section `signature` -----------------------------------------------
    signature = {
        "lieu": estim.get("ville") or "",
        "date_signature": today_iso,
    }

    prefill: dict[str, dict[str, Any]] = {
        "dossier": {k: v for k, v in dossier.items() if v is not None},
        "redacteur": {k: v for k, v in redacteur.items() if v not in (None, "")},
        "mission": {k: v for k, v in mission.items() if v is not None},
        "identification": {k: v for k, v in identification.items() if v is not None},
        "surfaces": {k: v for k, v in surfaces.items() if v is not None},
        "composition": composition,
        "technique": {},
        "energie": energie,
        "copropriete": {},
        "charges_fiscalite": {},
        "environnement": {},
        "marche": {k: v for k, v in marche.items() if v is not None},
        "methode": methode,
        "comparables": comparables,
        "ajustements": {},
        "swot": {},
        "conclusion": {k: v for k, v in conclusion.items() if v is not None},
        "net_vendeur": {k: v for k, v in net_vendeur.items() if v is not None},
        "strategie": {k: v for k, v in strategie.items() if v is not None},
        "mentions": mentions,
        "annexes": {},
        "signature": signature,
    }
    return prefill
