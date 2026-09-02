"""Vérifications frontend D1 : parité i18n FR/EN/IT/DE + conformité Apple
sur le bundle /app/frontend/src/b1/ (chaînes interdites, POST organisations).
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

B1 = Path("/app/frontend/src/b1")
I18N_D1 = B1 / "b1i18nD1.js"


def _load_i18n() -> dict:
    """Extrait l'objet i18n via node (le fichier est un module ESM)."""
    script = (
        "import('file://%s').then(m=>{const o=m.default||m.D1_I18N||m.I18N_D1||"
        "Object.values(m)[0];process.stdout.write(JSON.stringify(o));});" % I18N_D1
    )
    out = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        capture_output=True, text=True, timeout=60,
    )
    assert out.returncode == 0, f"node a échoué: {out.stderr[:500]}"
    return json.loads(out.stdout)


def test_i18n_d1_file_exists():
    assert I18N_D1.is_file(), "b1i18nD1.js manquant"


def test_i18n_d1_parite_fr_en_it_de():
    data = _load_i18n()
    for lang in ("fr", "en", "it", "de"):
        assert lang in data, f"langue {lang} absente ({list(data)})"
    fr_keys = set(data["fr"].keys())
    assert len(fr_keys) > 10, f"trop peu de clés FR: {len(fr_keys)}"
    missing = {
        lang: sorted(fr_keys - set(data[lang].keys()))
        for lang in ("en", "it", "de")
        if fr_keys - set(data[lang].keys())
    }
    assert not missing, f"clés manquantes: {missing}"
    # Aucune valeur vide
    empties = [
        f"{lang}.{k}" for lang in ("fr", "en", "it", "de")
        for k, v in data[lang].items() if isinstance(v, str) and not v.strip()
    ]
    assert not empties, f"valeurs vides: {empties[:10]}"


def test_pas_de_post_organisations_dans_b1api():
    src = (B1 / "b1api.js").read_text(encoding="utf-8")
    for m in re.finditer(r"/api/d1/organisations(?!/me)", src):
        raise AssertionError(f"référence /api/d1/organisations (racine) à l'offset {m.start()}")


def test_pas_de_stripe_ni_prix_agence_dans_b1():
    forbidden = ["stripe", "checkout.stripe.com", "buy.stripe.com", "199€", "349€", "599€"]
    violations = []
    for f in B1.rglob("*"):
        if not f.is_file() or f.suffix not in (".js", ".jsx", ".css", ".json", ".html"):
            continue
        low = f.read_text(encoding="utf-8", errors="ignore").lower()
        for t in forbidden:
            if t in low:
                violations.append(f"{f.name} → {t}")
    assert not violations, violations


def test_pas_de_creation_agence_dans_b1():
    forbidden = [
        "créer une agence", "creer une agence", "créer mon agence",
        "create an agency", "create my agency",
        "creare un'agenzia", "agentur erstellen",
    ]
    violations = []
    for f in B1.rglob("*"):
        if not f.is_file() or f.suffix not in (".js", ".jsx", ".css", ".json", ".html"):
            continue
        low = f.read_text(encoding="utf-8", errors="ignore").lower()
        for t in forbidden:
            if t in low:
                violations.append(f"{f.name} → {t}")
    assert not violations, violations


def test_routes_directeur_declarees():
    """Les 3 routes directeur doivent être câblées dans le shell B1."""
    srcs = "\n".join(
        p.read_text(encoding="utf-8", errors="ignore")
        for p in Path("/app/frontend/src").rglob("*.js*") if p.is_file()
    )
    for r in ("directeur/repartition", "directeur/equipe", "directeur/agence"):
        assert r in srcs, f"route {r} non déclarée dans le front"
