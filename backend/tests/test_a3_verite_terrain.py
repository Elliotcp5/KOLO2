"""KOLO A3 — Vérité terrain sur 6 rapprochements audités manuellement.

Ce fichier est L'ARBITRE de tous les réglages futurs du moteur.

Chaque cas est identifié par (rue, surface, classe DPE). Le test :
  1) Récupère le DPE via ADEME (adresse contient la rue, code_postal 75017,
     surface_habitable = valeur audit ± 0.1)
  2) Récupère les annonces candidates actives (mêmes filtres que le job :
     vente, appartement, surface DPE ± tolérance)
  3) Calcule le point-quartier du DPE et rejoue `score_annonce_vs_dpe` sur
     chaque annonce avec la config `config_matching` en base
  4) Applique la décision : `deja_en_vente` si best_score ≥ seuil_correspondance,
     sinon `opportunite`.
  5) Vérifie la décision attendue.

Sur échec : le test imprime les scores détaillés (sous-scores + multiplicateur
géo) pour permettre à l'humain d'ajuster.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from statistics import median
from typing import Optional

import httpx
import pytest
from dotenv import load_dotenv

load_dotenv(Path("/app/backend/.env"))

from a2.config import get_config
from a3.matching import score_annonce_vs_dpe
from a3.quartiers import label_to_quartier, point_to_quartier
from a3.sources.ademe import fetch_dpe_recents
from a3.text import normalize_ges_class, normalize_type_bien_dpe, normalize_voie
from a3.job_generer_opportunites import (
    _extract_voie_from_adresse,
    _fetch_candidates,
    _fetch_median_local_m2,
)

from motor.motor_asyncio import AsyncIOMotorClient

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_KEY = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()
MONGO_URL = (os.environ.get("MONGO_URL") or "").strip()
DB_NAME = (os.environ.get("DB_NAME") or "").strip()


# -----------------------------------------------------------------------------
# Fixtures de vérité terrain — auditées manuellement par l'utilisateur.
#
# BLOQUANTS  : certitudes fortes. Si le moteur se trompe, le test échoue.
# INDICATIFS : jugements de plausibilité. Score attendu logué mais pas
#              d'échec — on suit la dérive sans figer ce dont on n'est pas sûr.
# -----------------------------------------------------------------------------
BLOQUANTS_VRAI = [
    # 5 Rue des Renaudes : l'annonce cite la rue → certitude « déjà en vente ».
    {"rue": "renaudes", "surface": 145.3, "classe": "E", "cp": "75017",
     "decision_attendue": "deja_en_vente"},
]
BLOQUANTS_FAUX = [
    # 44 Rue de la Jonquière : prix au m² impossible pour cette rue.
    {"rue": "jonquiere", "surface": 135.9, "classe": "B", "cp": "75017",
     "decision_attendue": "opportunite"},
]

INDICATIFS = [
    {"rue": "gounod", "surface": 175.1, "classe": "E", "cp": "75017",
     "decision_attendue": "deja_en_vente"},
    {"rue": "wagram", "surface": 140.5, "classe": "E", "cp": "75017",
     "decision_attendue": "deja_en_vente"},
    {"rue": "pierre demours", "surface": 130.7, "classe": "D", "cp": "75017",
     "decision_attendue": "deja_en_vente"},
    {"rue": "edouard detaille", "surface": 197.6, "classe": None, "cp": "75017",
     "decision_attendue": "opportunite"},
]


# -----------------------------------------------------------------------------
def _match_dpe(dpes: list[dict], rue: str, surface_target: float,
               classe_target: Optional[str]) -> Optional[dict]:
    """Cherche le DPE dont l'adresse contient `rue`, surface ≈ `surface_target`
    (± 1 m² tolérance) et éventuellement classe correspondante."""
    rue_norm = normalize_voie(rue) or ""
    best = None
    for d in dpes:
        adresse = (d.get("adresse") or "").lower()
        voie_norm = normalize_voie(d.get("nom_voie") or "")
        fallback = _extract_voie_from_adresse(d.get("adresse"))
        voie_fallback = normalize_voie(fallback) if fallback else None
        rue_ok = rue_norm and (rue_norm in adresse or voie_norm == rue_norm or voie_fallback == rue_norm)
        if not rue_ok:
            continue
        try:
            s = float(d.get("surface_habitable"))
        except (TypeError, ValueError):
            continue
        if abs(s - surface_target) > 1.5:
            continue
        if classe_target:
            cl = normalize_ges_class(d.get("classe_dpe"))
            if cl != classe_target.upper():
                continue
        # Meilleur: le plus récent
        if best is None or (d.get("date_etablissement") or "") > (best.get("date_etablissement") or ""):
            best = d
    return best


async def _run_case(case: dict) -> dict:
    """Retourne un dict complet : DPE trouvé, best_annonce, breakdown, décision."""
    async with httpx.AsyncClient() as client:
        # 1) Fetch DPE recents 75017 sur la fenêtre config (62j par défaut)
        from datetime import datetime, timedelta
        client_mongo = AsyncIOMotorClient(MONGO_URL)
        db = client_mongo[DB_NAME]
        cfg = await get_config(db)
        fenetre = int(cfg.get("fenetre_dpe_jours", 62))
        date_min = (datetime.utcnow() - timedelta(days=fenetre)).strftime("%Y-%m-%d")
        dpes = await fetch_dpe_recents(client, case["cp"], date_min)

        # Normalise
        for d in dpes:
            voie_raw = d.get("nom_voie") or ""
            if voie_raw and normalize_voie(voie_raw):
                d["nom_voie"] = normalize_voie(voie_raw)
            else:
                fallback = _extract_voie_from_adresse(d.get("adresse"))
                d["nom_voie"] = normalize_voie(fallback) if fallback else None
            d["classe_dpe"] = normalize_ges_class(d.get("classe_dpe"))
            d["type_batiment_norm"] = normalize_type_bien_dpe(d.get("type_batiment"))
            try:
                d["surface_habitable"] = float(d.get("surface_habitable")) if d.get("surface_habitable") not in (None, "") else None
            except (TypeError, ValueError):
                d["surface_habitable"] = None

        dpe = _match_dpe(dpes, case["rue"], case["surface"], case.get("classe"))
        if not dpe:
            return {"case": case, "error": "dpe_not_found", "dpes_scanned": len(dpes)}

        surface_dpe = float(dpe["surface_habitable"])
        # 2) Fetch candidates vente
        tolerance_pct = float(cfg.get("tolerance_surface_pct", 0.08))
        tolerance_plancher = float(cfg.get("tolerance_surface_plancher_m2", 4))
        candidates = await _fetch_candidates(
            client, case["cp"], "vente", dpe["type_batiment_norm"],
            surface_dpe, tolerance_pct, tolerance_plancher,
        )

        # 3) Prepare quartier DPE + prix médian
        q_dpe = point_to_quartier(dpe.get("latitude"), dpe.get("longitude"))
        median_cache: dict = {}
        median_m2 = None
        if dpe.get("latitude") is not None and dpe.get("longitude") is not None:
            median_m2 = await _fetch_median_local_m2(
                client, float(dpe["latitude"]), float(dpe["longitude"]),
                dpe["type_batiment_norm"], median_cache,
            )

        poids = cfg.get("poids") or {}
        mg = cfg.get("multiplicateur_geo") or {}
        mult_25_40 = float(mg.get("mult_ecart_prix_25_40", 0.7))
        seuil_prix_pen = float(mg.get("seuil_prix_penalite", 0.25))
        seuil_prix_cc = float(mg.get("seuil_prix_court_circuit", 0.40))
        s_rue_null = float(cfg.get("s_rue_defaut_null", 0.5))
        seuil_v = float(cfg.get("seuil_correspondance", 0.75))

        best_score = 0.0
        best_ann: Optional[dict] = None
        best_res: Optional[dict] = None
        for ann in candidates:
            q_ann, _ = label_to_quartier(ann.get("district"))
            res = score_annonce_vs_dpe(
                ann, dpe, poids, tolerance_pct, tolerance_plancher,
                s_rue_defaut_null=s_rue_null,
                quartier_dpe=q_dpe, quartier_annonce=q_ann,
                prix_median_local_m2=median_m2,
                mult_ecart_prix_25_40=mult_25_40,
                seuil_prix_penalite=seuil_prix_pen,
                seuil_prix_court_circuit=seuil_prix_cc,
            )
            if res["score"] > best_score:
                best_score = res["score"]
                best_ann = ann
                best_res = res

        decision = "deja_en_vente" if best_score >= seuil_v else "opportunite"
        client_mongo.close()
        return {
            "case": case,
            "dpe": {
                "numero_dpe": dpe.get("numero_dpe"),
                "adresse": dpe.get("adresse"),
                "surface": surface_dpe,
                "classe": dpe.get("classe_dpe"),
                "rue_normalisee": dpe.get("nom_voie"),
                "latitude": dpe.get("latitude"),
                "longitude": dpe.get("longitude"),
                "quartier_dpe": q_dpe,
            },
            "nb_candidates": len(candidates),
            "median_m2_local": median_m2,
            "best_score": round(best_score, 4),
            "best_annonce": {
                "id": (best_ann or {}).get("id"),
                "url": (best_ann or {}).get("url"),
                "surface": (best_ann or {}).get("surface"),
                "district": (best_ann or {}).get("district"),
                "price_per_m2": (best_ann or {}).get("price_per_m2"),
                "rue_extraite": (best_ann or {}).get("rue_extraite"),
            } if best_ann else None,
            "breakdown": (best_res or {}).get("breakdown"),
            "multiplicateur_geo": (best_res or {}).get("multiplicateur_geo"),
            "court_circuit": (best_res or {}).get("court_circuit"),
            "motif_court_circuit": (best_res or {}).get("motif_court_circuit"),
            "seuil_correspondance": seuil_v,
            "decision": decision,
        }


# -----------------------------------------------------------------------------
# Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
@pytest.mark.parametrize("case", BLOQUANTS_VRAI,
                         ids=[c["rue"] for c in BLOQUANTS_VRAI])
async def test_bloquant_vrai_doit_etre_ecarte(case):
    """BLOQUANT : le moteur DOIT décider `deja_en_vente` — l'annonce cite la rue."""
    result = await _run_case(case)
    assert "error" not in result, f"DPE introuvable pour {case}: {result}"
    assert result["decision"] == "deja_en_vente", _fmt_failure("BLOQUANT VRAI", result)


@pytest.mark.asyncio
@pytest.mark.parametrize("case", BLOQUANTS_FAUX,
                         ids=[c["rue"] for c in BLOQUANTS_FAUX])
async def test_bloquant_faux_doit_rester_opportunite(case):
    """BLOQUANT : le moteur NE DOIT PAS écarter — prix au m² impossible."""
    result = await _run_case(case)
    assert "error" not in result, f"DPE introuvable pour {case}: {result}"
    assert result["decision"] == "opportunite", _fmt_failure("BLOQUANT FAUX", result)


@pytest.mark.asyncio
@pytest.mark.parametrize("case", INDICATIFS,
                         ids=[c["rue"] for c in INDICATIFS])
async def test_indicatif_log_seulement(case, capsys):
    """INDICATIF : jugement de plausibilité. Log le score et la décision,
    NE FAIT JAMAIS ÉCHOUER le test. Sert à suivre la dérive sans figer.
    """
    result = await _run_case(case)
    if "error" in result:
        print(f"[INDICATIF ⚠️  ERREUR] {case['rue']}: {result}")
        return
    expected = case["decision_attendue"]
    got = result["decision"]
    marker = "✅" if got == expected else "🟡"
    b = result.get("breakdown") or {}
    ann = result.get("best_annonce") or {}
    print(
        f"\n[INDICATIF {marker}] {case['rue']} (S={case['surface']} · cl={case.get('classe')})"
        f"\n  attendu={expected}  obtenu={got}  score={result['best_score']}"
        f"  seuil={result['seuil_correspondance']}"
        f"\n  breakdown={b}  mult={result.get('multiplicateur_geo')}"
        f"  cc={result.get('motif_court_circuit')}"
        f"\n  annonce: district={ann.get('district')!r} surface={ann.get('surface')}"
        f" pxm2={ann.get('price_per_m2')} rue_ext={ann.get('rue_extraite')!r}"
    )


def _fmt_failure(label: str, result: dict) -> str:
    return (
        f"\n=== {label} : décision incorrecte ===\n"
        f"case = {result['case']}\n"
        f"DPE = {result['dpe']}\n"
        f"nb_candidates = {result['nb_candidates']}\n"
        f"median_m2_local = {result['median_m2_local']}\n"
        f"best_score = {result['best_score']} (seuil {result['seuil_correspondance']})\n"
        f"best_annonce = {result['best_annonce']}\n"
        f"breakdown = {result['breakdown']}\n"
        f"multiplicateur_geo = {result['multiplicateur_geo']}\n"
        f"court_circuit = {result['court_circuit']} ({result['motif_court_circuit']})\n"
    )
