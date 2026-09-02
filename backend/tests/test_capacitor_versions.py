"""KOLO — Garde-fou : cohérence des versions Capacitor.

Chaque fois qu'un plugin @capacitor/* dérive vers une majeure différente
du @capacitor/core, `pod install` explose côté iOS avec un message obscur
« higher minimum deployment target ». Ce test échoue avant le build pour
éviter cet aller-retour Codemagic.

Règles vérifiées :
  1. Tous les plugins `@capacitor/*` (hors `@capacitor-community/*` qui ont
     leur propre schéma de version) doivent avoir la même majeure que
     `@capacitor/core`.
  2. Le Podfile `platform :ios, 'X.Y'` doit être compatible avec cette
     majeure (Capacitor 5 → iOS 13+, Capacitor 7 → iOS 14+).
"""
from __future__ import annotations

import json
import re
from pathlib import Path


PACKAGE_JSON = Path("/app/frontend/package.json")
PODFILE = Path("/app/frontend/ios/App/Podfile")


def _major_from_spec(spec: str) -> int:
    """Extrait la majeure d'une spec semver ('^5.0.10', '5', '~5.1.2' → 5)."""
    m = re.search(r"(\d+)", spec)
    return int(m.group(1)) if m else -1


def test_capacitor_plugins_share_same_major():
    pkg = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    capacitor_pkgs = {k: v for k, v in deps.items() if k.startswith("@capacitor/")}
    assert "@capacitor/core" in capacitor_pkgs, "@capacitor/core absent"
    core_major = _major_from_spec(capacitor_pkgs["@capacitor/core"])
    assert core_major > 0, f"Majeure @capacitor/core illisible : {capacitor_pkgs['@capacitor/core']}"

    mismatches = []
    for name, spec in capacitor_pkgs.items():
        maj = _major_from_spec(spec)
        if maj != core_major:
            mismatches.append(f"  - {name}@{spec} (majeure {maj}) ≠ @capacitor/core@{core_major}")
    assert not mismatches, (
        "Incohérence des versions Capacitor : `pod install` va exploser sur Codemagic.\n"
        f"Attendu : tous les @capacitor/* en majeure {core_major}.\n"
        + "\n".join(mismatches)
    )


def test_podfile_ios_platform_compatible_with_capacitor_major():
    pkg = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    core_spec = pkg.get("dependencies", {}).get("@capacitor/core", "")
    core_major = _major_from_spec(core_spec)
    # Contrat minimum documenté par Capacitor
    min_ios = {5: 13, 6: 13, 7: 14, 8: 15, 9: 15}.get(core_major, 13)
    podfile = PODFILE.read_text(encoding="utf-8")
    m = re.search(r"platform\s*:ios,\s*'(\d+)(?:\.\d+)?'", podfile)
    assert m, "Impossible de lire `platform :ios, 'X'` dans le Podfile"
    ios_maj = int(m.group(1))
    assert ios_maj >= min_ios, (
        f"Podfile déclare iOS {ios_maj}.0 mais Capacitor {core_major} exige iOS {min_ios}+"
    )
