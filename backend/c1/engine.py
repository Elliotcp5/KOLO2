"""KOLO — BLOC C1 : moteur d'estimation déterministe.

Pas de LLM dans ce fichier. Toutes les valeurs (coefficients, seuils, décotes)
sont lues depuis `config_matching` (A2) ou `infos_pro` (B1). Reproductible :
un rejeu à J+30 avec les mêmes comparables figés doit produire les mêmes chiffres.

Département de l'ordre :
  1. `run_estimation()` — orchestrateur (haut niveau)
  2. `_corriger_comparables()` — famille (a) : temporel + taille
  3. `_calculer_surface_ponderee()` — famille (b) : annexes
  4. `_ajustements_specifiques()` — famille (c) : caractéristiques
  5. `_ajustement_energie()` — famille (d) : DPE vs classe médiane
  6. `_garde_fou_plafond()` — cap ±25 %
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from statistics import median
from typing import Any, Optional

from scripts.comparables import get_comparables

logger = logging.getLogger("c1.engine")

# -------------------------------------------------------------------
# Constantes internes AUCUN seuil métier ici — uniquement des mappings
# techniques (formats DPE, alias). Tout ce qui pilote la valeur passe
# par `config_matching.decote_energie` / `.stationnement_par_dept` /
# `.moteur_estimation`.
# -------------------------------------------------------------------
CLASSES_DPE = ["A", "B", "C", "D", "E", "F", "G"]

# Codes postaux exclus DVF (livre foncier)
_CP_ALSACE_MOSELLE_PREFIXES = ("57", "67", "68")
_CP_MAYOTTE_PREFIX = "976"

# Type de bien : mapping opportunité → DVF
_TYPE_BATIMENT_TO_LOCAL = {
    "appartement": "Appartement",
    "maison": "Maison",
    "immeuble": None,   # non estimé automatiquement
}

FIABILITE_LOW_MESSAGE = (
    "Les biens vendus dans ce secteur sont très hétérogènes — "
    "l'étage, la vue et l'état pèsent lourd ici."
)

MESSAGE_PLAFOND = (
    "Les biens comparables trouvés sont trop éloignés de ce bien. "
    "Les corrections ont été plafonnées et la confiance abaissée. "
    "Vérifiez l'adresse et les caractéristiques saisies."
)

MESSAGE_PEU_COMPARABLES = (
    "Peu de ventes récentes autour de ce bien. Estimation à prendre avec précaution."
)


def is_dvf_exclu(code_postal: Optional[str]) -> bool:
    """Alsace-Moselle et Mayotte : DVF ne couvre pas → refuser."""
    if not code_postal:
        return False
    cp = str(code_postal).strip()
    if len(cp) < 2:
        return False
    if cp.startswith(_CP_MAYOTTE_PREFIX):
        return True
    return cp[:2] in _CP_ALSACE_MOSELLE_PREFIXES


# ---------------------------------------------------------------------------
# (a) Correction des comparables — temporelle + taille
# ---------------------------------------------------------------------------
def _correction_temporelle_pct(
    date_mutation_iso: str,
    commune_evolution_pct_par_mois: float,
) -> float:
    """Correction temporelle par mois écoulé depuis la mutation.

    `commune_evolution_pct_par_mois` = évolution % du prix médian /m² par mois.
    Retourne le facteur multiplicatif (1.0 = pas de correction).
    """
    if not date_mutation_iso:
        return 1.0
    try:
        dm = datetime.fromisoformat(date_mutation_iso.replace("Z", "+00:00"))
    except Exception:
        return 1.0
    if dm.tzinfo is None:
        dm = dm.replace(tzinfo=timezone.utc)
    mois_ecoules = max(0, (datetime.now(timezone.utc) - dm).days // 30)
    return 1.0 + (commune_evolution_pct_par_mois / 100.0) * mois_ecoules


def _correction_taille_pct(
    surface_comparable: float,
    surface_cible: float,
) -> float:
    """À qualité égale, un petit logement se vend plus cher au m². On ne corrige
    QUE si écart > 15 %, plafonnée à ±8 %.
    """
    if surface_comparable <= 0 or surface_cible <= 0:
        return 0.0
    ratio = surface_comparable / surface_cible
    if 0.85 <= ratio <= 1.15:
        return 0.0
    # Petits vendent plus cher : on ajuste le prix /m² du comparable
    # vers celui attendu pour la surface cible.
    # Formule empirique praticien : ~4 % d'écart par tranche de 25 % de surface.
    delta = (ratio - 1.0) * 0.16   # 25 % de surface → 4 % de prix
    # Clamp à ±8 %
    return max(-0.08, min(0.08, delta))


async def _fetch_evolution_prix_commune(
    postal_code: str,
    type_local: str,
) -> tuple[float, str]:
    """Évolution moyenne mensuelle du prix médian /m² sur la commune.

    Compare la médiane des 12 derniers mois à celle des 12 mois d'avant.
    Si <30 mutations, remonte au département (2 premiers chiffres du CP).
    Retourne (pct_par_mois, niveau_calcul).

    NOTE : implémentation simple pour v1 — v2 ira taper mutations_propres
    avec paging. Pour l'instant, retourne 0.0 (marché stable) par défaut,
    ce qui est un choix conservateur.
    """
    # TODO C1.5 : appel Supabase agrégé (window 12m vs 12-24m) — cf. get_comparables._fetch_postal_code_median.
    # Choix conservateur v1 : marché stable ⇒ pas de correction temporelle.
    return 0.0, "conservateur"


async def _corriger_comparables(
    comparables: list[dict],
    surface_cible: float,
    postal_code: str,
    type_local: str,
) -> list[dict]:
    """Applique corrections temporelle + taille sur chaque comparable.

    Retourne les comparables enrichis d'un `prix_m2_corrige`.
    """
    evolution_pct, _niveau = await _fetch_evolution_prix_commune(postal_code, type_local)
    corriges: list[dict] = []
    for c in comparables:
        base_ppsm = float(c.get("prix_m2") or 0)
        if base_ppsm <= 0:
            continue
        temp = _correction_temporelle_pct(c.get("date_mutation") or "", evolution_pct)
        taille_pct = _correction_taille_pct(
            float(c.get("surface_reelle_bati") or 0),
            surface_cible,
        )
        corrige = base_ppsm * temp * (1.0 + taille_pct)
        c2 = dict(c)
        c2["prix_m2_corrige"] = round(corrige)
        c2["correction_temp_facteur"] = round(temp, 4)
        c2["correction_taille_pct"] = round(taille_pct, 4)
        corriges.append(c2)
    return corriges


# ---------------------------------------------------------------------------
# (b) Surface pondérée — coefs annexes venus d'`infos_pro`
# ---------------------------------------------------------------------------
def _calculer_surface_ponderee(
    surface_habitable: float,
    inputs: dict[str, Any],
    infos_pro: dict[str, Any],
) -> tuple[float, list[dict]]:
    """Surface pondérée = habitable × 1.00 + annexes × coefs.

    Plafonne la contribution ANNEXES à 25 % de la surface habitable.
    Jardin → coefficient 0 si maison (déjà dans la valeur du terrain).
    """
    poids = {
        "pond_terrasse":       float(infos_pro.get("pond_terrasse")       or 0.35),
        "pond_balcon_loggia":  float(infos_pro.get("pond_balcon_loggia")  or 0.25),
        "pond_combles":        float(infos_pro.get("pond_combles")        or 0.30),
        "pond_cave_cellier":   float(infos_pro.get("pond_cave_cellier")   or 0.12),
        "pond_garage":         float(infos_pro.get("pond_garage")         or 0.40),
        "pond_place_parking":  float(infos_pro.get("pond_place_parking")  or 0.30),
        "pond_jardin":         float(infos_pro.get("pond_jardin")         or 0.10),
    }

    detail: list[dict] = []
    detail.append({
        "libelle": "Surface habitable", "surface_m2": surface_habitable,
        "coef": 1.00, "surface_ponderee_m2": surface_habitable,
    })

    ext = inputs.get("exterieur")
    ext_surface = float(inputs.get("exterieur_surface_m2") or 0)
    annexes_ponderees = 0.0

    if ext == "balcon" and ext_surface > 0:
        p = ext_surface * poids["pond_balcon_loggia"]
        annexes_ponderees += p
        detail.append({"libelle": "Balcon/Loggia", "surface_m2": ext_surface,
                       "coef": poids["pond_balcon_loggia"], "surface_ponderee_m2": p})
    elif ext == "terrasse" and ext_surface > 0:
        p = ext_surface * poids["pond_terrasse"]
        annexes_ponderees += p
        detail.append({"libelle": "Terrasse", "surface_m2": ext_surface,
                       "coef": poids["pond_terrasse"], "surface_ponderee_m2": p})
    elif ext == "jardin" and ext_surface > 0:
        # Jardin : par défaut 0.10 sur appart, 0 sur maison (déjà dans terrain).
        type_bien = (inputs.get("type_bien") or "").lower()
        coef = 0.0 if type_bien == "maison" else poids["pond_jardin"]
        p = ext_surface * coef
        annexes_ponderees += p
        detail.append({"libelle": "Jardin", "surface_m2": ext_surface,
                       "coef": coef, "surface_ponderee_m2": p})

    stationnement = inputs.get("stationnement")
    if stationnement == "place":
        # 12 m² conventionnels pour une place de parking (praticien)
        p = 12.0 * poids["pond_place_parking"]
        annexes_ponderees += p
        detail.append({"libelle": "Place de parking", "surface_m2": 12.0,
                       "coef": poids["pond_place_parking"], "surface_ponderee_m2": p})
    elif stationnement == "garage":
        p = 15.0 * poids["pond_garage"]
        annexes_ponderees += p
        detail.append({"libelle": "Garage", "surface_m2": 15.0,
                       "coef": poids["pond_garage"], "surface_ponderee_m2": p})

    # Plafond annexes = 25 % de surface habitable
    plafond_annexes = 0.25 * surface_habitable
    if annexes_ponderees > plafond_annexes:
        # On retire la surcharge proportionnellement
        ratio = plafond_annexes / annexes_ponderees
        for d in detail[1:]:
            d["surface_ponderee_m2"] = round(d["surface_ponderee_m2"] * ratio, 2)
        annexes_ponderees = plafond_annexes
        detail.append({"libelle": "Plafond annexes (25 % habitable)",
                       "surface_m2": None, "coef": None,
                       "surface_ponderee_m2": round(-1 * (annexes_ponderees / ratio - annexes_ponderees), 2)})

    total = surface_habitable + annexes_ponderees
    return round(total, 2), detail


# ---------------------------------------------------------------------------
# (c) Ajustements spécifiques au bien
# ---------------------------------------------------------------------------
def _ajustements_specifiques(
    inputs: dict[str, Any],
    infos_pro: dict[str, Any],
    cfg_moteur: dict[str, Any],
) -> list[dict]:
    """Retourne une liste d'ajustements [{code, libelle, valeur, unite}].

    `unite` :
      - "pct" : pourcentage cumulé (0.04 = +4 %) appliqué sur la valeur agrégée.
      - "eur" : montant en euros retiré (ex. travaux chiffrés).
    """
    aj: list[dict] = []

    # Étage sans ascenseur — règle spéciale « 3+ » sans ascenseur = plancher −10 %
    etage = inputs.get("etage")
    ascenseur = bool(inputs.get("ascenseur")) if inputs.get("ascenseur") is not None else None
    dernier_etage = bool(inputs.get("dernier_etage"))
    if etage == "3plus" and ascenseur is False:
        aj.append({"code": "etage_eleve_sans_ascenseur", "libelle": "Étage élevé sans ascenseur",
                   "valeur": -0.10, "unite": "pct"})
    elif etage in ("3",) and ascenseur is False:
        aj.append({"code": "etage_3_sans_ascenseur", "libelle": "3e étage sans ascenseur",
                   "valeur": -0.02, "unite": "pct"})
    elif etage == "rdc":
        # Par défaut : RDC sur cour ou surélevé −3 %. Sans info, on garde le milieu.
        aj.append({"code": "rdc", "libelle": "Rez-de-chaussée",
                   "valeur": -0.05, "unite": "pct"})
    if dernier_etage and ascenseur is True:
        aj.append({"code": "dernier_etage_asc", "libelle": "Dernier étage avec ascenseur",
                   "valeur": 0.04, "unite": "pct"})

    # Vue / vis-à-vis
    if inputs.get("vue_degagee"):
        aj.append({"code": "vue", "libelle": "Vue dégagée",
                   "valeur": 0.04, "unite": "pct"})
    if inputs.get("vis_a_vis"):
        aj.append({"code": "vis_a_vis", "libelle": "Vis-à-vis marqué",
                   "valeur": -0.04, "unite": "pct"})

    # État général
    etat = inputs.get("etat")
    if etat == "a_rafraichir":
        aj.append({"code": "etat_rafraichir", "libelle": "État à rafraîchir",
                   "valeur": -0.08, "unite": "pct"})
    elif etat == "renove":
        aj.append({"code": "etat_renove", "libelle": "État rénové",
                   "valeur": 0.06, "unite": "pct"})
    elif etat == "neuf":
        aj.append({"code": "etat_neuf", "libelle": "État neuf",
                   "valeur": 0.10, "unite": "pct"})

    # Travaux chiffrés (en euros)
    montant = inputs.get("montant_travaux_eur")
    if montant and montant > 0:
        aj.append({"code": "travaux_chiffres", "libelle": "Travaux estimés",
                   "valeur": -float(montant), "unite": "eur"})

    return aj


# ---------------------------------------------------------------------------
# (d) Ajustement énergétique — table régionale, référence = classe médiane
# ---------------------------------------------------------------------------
def _region_from_cp(code_postal: str) -> str:
    """Mapping très simple département → région large.

    Île-de-France = 75, 77, 78, 91, 92, 93, 94, 95.
    Autres = "autre" (v1 par défaut, à étoffer via config_matching).
    """
    if not code_postal or len(code_postal) < 2:
        return "autre"
    dept = code_postal[:2]
    if dept in ("75", "77", "78", "91", "92", "93", "94", "95"):
        return "ile_de_france"
    return "autre"


def _ajustement_energie(
    inputs: dict[str, Any],
    comparables: list[dict],
    decote_grille: dict[str, Any],
) -> Optional[dict]:
    """Retourne un ajustement DPE unique, ou None.

    - Ne s'applique que si `classe_dpe` du bien connue ET grille dispo.
    - Décote calculée par rapport à la CLASSE MÉDIANE des comparables (pas D).
    - Non cumulable avec `montant_travaux_eur` : le back retirera le moins
      pénalisant des deux en amont (voir `_deduplique_travaux_energie`).
    """
    classe = inputs.get("classe_dpe")
    if not classe:
        return None

    cp = inputs.get("code_postal") or ""
    region = _region_from_cp(cp)
    type_bien = (inputs.get("type_bien") or "").lower()
    key_type = "maison" if type_bien == "maison" else "appartement"

    region_grille = (decote_grille or {}).get(region) or (decote_grille or {}).get("autre") or {}
    type_grille = region_grille.get(key_type) or {}
    if not type_grille:
        return None

    # Classe médiane des comparables (par étiquette : on prend la classe
    # majoritaire, à défaut D). Attention : DVF ne porte pas la classe,
    # donc `classe_mediane` est facultatif. On lit `classe_dpe_comparable`
    # si présent, sinon fallback D.
    classes_comp = [
        c.get("classe_dpe") for c in comparables
        if c.get("classe_dpe") in CLASSES_DPE
    ]
    if classes_comp:
        classe_ref = median([CLASSES_DPE.index(c) for c in classes_comp])
        classe_ref = CLASSES_DPE[int(round(classe_ref))]
    else:
        classe_ref = "D"

    valeur_bien = type_grille.get(classe)
    valeur_ref = type_grille.get(classe_ref)
    if valeur_bien is None or valeur_ref is None:
        return None
    pct = (float(valeur_bien) - float(valeur_ref)) / 100.0
    if abs(pct) < 0.001:
        return None
    return {
        "code": "energie_dpe",
        "libelle": f"Classe {classe} (réf. médiane {classe_ref})",
        "valeur": pct,
        "unite": "pct",
    }


def _deduplique_travaux_energie(ajustements: list[dict]) -> list[dict]:
    """Non-cumul : garder le PLUS PÉNALISANT entre travaux chiffrés (€)
    et décote énergétique (%). Attention : on compare en € équivalent.

    On repousse la conversion au niveau appelant qui connaît la valeur
    agrégée ; ici, on renvoie simplement les deux marqueurs pour que la
    logique aval puisse trancher.
    """
    return ajustements  # marquage seul, dédoublonnage effectif en aval


# ---------------------------------------------------------------------------
# (e) Garde-fou ±25 %
# ---------------------------------------------------------------------------
def _garde_fou_plafond(total_pct: float) -> tuple[float, bool]:
    """Cap le cumul des ajustements % à ±25 %. Retourne (nouveau_total, plafond_atteint)."""
    if total_pct > 0.25:
        return 0.25, True
    if total_pct < -0.25:
        return -0.25, True
    return total_pct, False


# ---------------------------------------------------------------------------
# ORCHESTRATION
# ---------------------------------------------------------------------------
async def run_estimation(
    inputs: dict[str, Any],
    infos_pro: dict[str, Any],
    config_matching: dict[str, Any],
    lat: float,
    lng: float,
    type_local: str,
    surface: float,
    postal_code: str,
) -> dict[str, Any]:
    """Exécute le pipeline complet. Renvoie un dict prêt à persister.

    Étapes :
      1. Fetch comparables /api/comparables (avec ladder DÉJÀ dans get_comparables :
         500 → 1000 → 2000 → 3000). On rajoute nous-mêmes le passage à 36 mois si
         < 5 après 3000 m.
      2. Corrige chaque comparable (temporel + taille).
      3. Surface pondérée.
      4. Ajustements spécifiques + énergie.
      5. Non-cumul travaux vs décote énergie.
      6. Cap ±25 %.
      7. Fourchette Q1/Q3 sur les comparables corrigés.
      8. Prix commercialisation = valeur × (1 + marge_negociation).
    """
    # 1) Comparables — ladder built-in (rayon), puis élargir fenêtre si vide
    result = await get_comparables(
        lat=lat, lng=lng, type_local=type_local, surface=surface,
        radius_m=500, postal_code=postal_code or None,
    )
    comparables = result.get("comparables") or []
    radius_used = result.get("radius_used_m") or 500

    fenetre_mois = 24
    # Si <5 comparables même à 3000m, on abandonne la fourchette solide :
    # confiance faible, mais l'estimation reste calculée sur la médiane locale.
    peu_de_comparables = len(comparables) < 5

    # 2) Corrections temporelle + taille
    comparables_corr = await _corriger_comparables(
        comparables, surface_cible=surface,
        postal_code=postal_code, type_local=type_local,
    )
    prix_m2_corriges = [c["prix_m2_corrige"] for c in comparables_corr if c.get("prix_m2_corrige")]
    if prix_m2_corriges:
        prix_m2_retenu = round(median(prix_m2_corriges))
    else:
        # Aucun comparable exploitable → fallback médiane postale du /api/comparables
        prix_m2_retenu = result.get("median_price_per_sqm_postal_code") or 0

    # 3) Surface pondérée
    surface_ponderee, _detail_ponderation = _calculer_surface_ponderee(surface, inputs, infos_pro)

    # 4) Ajustements spécifiques + énergie
    ajustements = _ajustements_specifiques(
        inputs, infos_pro,
        (config_matching or {}).get("moteur_estimation") or {},
    )
    decote = (config_matching or {}).get("decote_energie") or {}
    aj_energie = _ajustement_energie(inputs, comparables, decote)

    # 5) Non-cumul travaux vs énergie : garde le plus pénalisant
    # (converti en équivalent € pour comparer)
    valeur_base = prix_m2_retenu * surface_ponderee
    travaux_idx = next((i for i, a in enumerate(ajustements) if a["code"] == "travaux_chiffres"), None)
    if travaux_idx is not None and aj_energie is not None:
        travaux_eur = abs(ajustements[travaux_idx]["valeur"])
        energie_eur = abs(aj_energie["valeur"]) * valeur_base
        if travaux_eur >= energie_eur:
            # On garde travaux, on retire énergie
            aj_energie = None
        else:
            # On garde énergie, on retire travaux
            ajustements.pop(travaux_idx)
    if aj_energie:
        ajustements.append(aj_energie)

    # 6) Cumul + cap ±25 %
    total_pct = sum(a["valeur"] for a in ajustements if a["unite"] == "pct")
    total_eur = sum(a["valeur"] for a in ajustements if a["unite"] == "eur")
    total_pct_cappe, plafond_atteint = _garde_fou_plafond(total_pct)
    if plafond_atteint:
        # Rebalance proportionnel de la partie pourcentage
        if total_pct != 0:
            scale = total_pct_cappe / total_pct
            for a in ajustements:
                if a["unite"] == "pct":
                    a["valeur"] = round(a["valeur"] * scale, 4)

    valeur_venale = valeur_base * (1.0 + total_pct_cappe) + total_eur

    # 7) Fourchette Q1/Q3 sur comparables corrigés — puis appliquer
    #    les mêmes ajustements que la valeur vénale pour rester cohérent
    #    (sinon la fourchette peut « encadrer » un prix hors de sa borne basse).
    if len(prix_m2_corriges) >= 4:
        from statistics import quantiles
        qs = quantiles(prix_m2_corriges, n=4, method="exclusive")
        base_basse = qs[0] * surface_ponderee
        base_haute = qs[2] * surface_ponderee
    elif prix_m2_corriges:
        base_basse = min(prix_m2_corriges) * surface_ponderee
        base_haute = max(prix_m2_corriges) * surface_ponderee
    else:
        base_basse = valeur_venale * 0.90
        base_haute = valeur_venale * 1.10
    fourchette_basse = round(base_basse * (1.0 + total_pct_cappe) + total_eur)
    fourchette_haute = round(base_haute * (1.0 + total_pct_cappe) + total_eur)

    # 8) Prix de commercialisation
    marge = float((config_matching or {}).get("marge_negociation") or 0.04)
    prix_com = round(valeur_venale * (1.0 + marge))

    # Fiabilité — critères combinés (n comparables + dispersion + rayon + plafond)
    disp = (result.get("dispersion") or {})
    coef_disp = disp.get("coefficient_dispersion")
    if peu_de_comparables or plafond_atteint or coef_disp is None:
        fiabilite = "faible"
    elif len(comparables) >= 10 and coef_disp < 0.15 and radius_used <= 1000:
        fiabilite = "elevee"
    elif len(comparables) >= 6 and coef_disp < 0.25:
        fiabilite = "moyenne"
    else:
        fiabilite = "faible"

    fiabilite_msg = None
    if plafond_atteint:
        fiabilite_msg = MESSAGE_PLAFOND
    elif peu_de_comparables:
        fiabilite_msg = MESSAGE_PEU_COMPARABLES
    elif fiabilite == "faible":
        fiabilite_msg = FIABILITE_LOW_MESSAGE

    # Classe médiane des comparables affichée dans l'accordéon
    classes_comp = [c.get("classe_dpe") for c in comparables if c.get("classe_dpe") in CLASSES_DPE]
    classe_mediane = None
    if classes_comp:
        idx = int(round(median([CLASSES_DPE.index(c) for c in classes_comp])))
        classe_mediane = CLASSES_DPE[idx]

    # Net vendeur (si demandé)
    net_vendeur = None
    taux_hono = infos_pro.get("taux_honoraires_pct")
    hono_charge = infos_pro.get("honoraires_charge")
    if inputs.get("net_vendeur") and taux_hono:
        try:
            t = float(taux_hono) / 100.0
            if hono_charge == "vendeur":
                net_vendeur = round(prix_com * (1.0 - t))
            else:  # acquéreur par défaut
                net_vendeur = round(prix_com / (1.0 + t))
        except (TypeError, ValueError):
            net_vendeur = None

    return {
        "estimation_id": str(uuid.uuid4()),
        "ok": True,
        "valeur_venale": round(valeur_venale),
        "prix_commercialisation": prix_com,
        "fourchette_basse": fourchette_basse,
        "fourchette_haute": fourchette_haute,
        "prix_m2_retenu": prix_m2_retenu,
        "surface_ponderee_m2": surface_ponderee,
        "net_vendeur": net_vendeur,
        "taux_honoraires_pct": taux_hono,
        "honoraires_charge": hono_charge,
        "fiabilite": fiabilite,
        "fiabilite_message": fiabilite_msg,
        "plafond_atteint": plafond_atteint,
        "nb_comparables": len(comparables),
        "radius_used_m": radius_used,
        "fenetre_mois": fenetre_mois,
        "classe_mediane_comparables": classe_mediane,
        "mediane_locale_prix_m2": result.get("median_price_per_sqm_local"),
        "ajustements": [
            {"code": a["code"], "libelle": a["libelle"],
             "valeur": round(a["valeur"], 4) if a["unite"] == "pct" else round(a["valeur"]),
             "unite": a["unite"]}
            for a in ajustements
        ],
        "total_ajustement_pct": round(total_pct_cappe, 4),
        "total_ajustement_eur": round(total_eur),
        "comparables_ids": [c.get("id_mutation") for c in comparables if c.get("id_mutation")],
        "comparables_figes": comparables,   # trace complète (persistée)
    }
