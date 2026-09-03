"""KOLO — Régression : pipeline Codemagic + estampille de build.

Ces tests gèlent 4 invariants :

1. `codemagic.yaml` compile en `CI=true yarn build` (les warnings deviennent
   erreurs — sans ça un vieux bundle passe silencieusement).
2. L'ordre strict est : yarn install → yarn build → cap sync ios → sanity
   md5 → patch pbxproj → CocoaPods → signing → xcodebuild.
3. Le pbxproj est modifié via `sed` sur `CURRENT_PROJECT_VERSION` (pas
   Info.plist), sinon la valeur hardcodée du pbxproj écrase l'incrémentation.
4. Le composant `B1BuildStamp` est monté sur V2AuthPage et ProfilPage.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path("/app")


def test_codemagic_uses_ci_true():
    y = (ROOT / "codemagic.yaml").read_text()
    assert "CI=true yarn build" in y, "yarn build DOIT être exécuté en CI=true"
    assert "CI=false yarn build" not in y, "CI=false rend les warnings silencieux"


def test_codemagic_strict_order():
    """Vérifie l'ordre : install → compute build → yarn build → cap sync
    → sanity → patch pbxproj → pods → signing → xcodebuild."""
    y = (ROOT / "codemagic.yaml").read_text()
    steps = [
        "Install frontend dependencies",
        "Compute App Store build number",
        "Build React app",
        "Sync Capacitor iOS",
        "cap sync a bien écrasé public",
        "Patch pbxproj",
        "CocoaPods install",
        "iOS code signing setup",
        "Build iOS IPA",
    ]
    positions = []
    for s in steps:
        idx = y.find(s)
        assert idx > 0, f"étape manquante dans codemagic.yaml : {s!r}"
        positions.append((s, idx))
    # Chaque position doit être strictement croissante
    for i in range(1, len(positions)):
        assert positions[i][1] > positions[i - 1][1], (
            f"ordre invalide : {positions[i-1][0]!r} apparaît APRÈS {positions[i][0]!r}"
        )


def test_codemagic_patches_pbxproj_not_info_plist():
    """L'incrémentation build DOIT modifier `CURRENT_PROJECT_VERSION` dans
    pbxproj (pas `CFBundleVersion` dans Info.plist qui utilise $()).
    Sans ça la valeur hardcodée du pbxproj = 79 ignore l'incrémentation
    → régression 78 → 69 constatée en TestFlight."""
    y = (ROOT / "codemagic.yaml").read_text()
    assert "CURRENT_PROJECT_VERSION" in y
    # sed sur pbxproj présent (variable PBX="App.xcodeproj/project.pbxproj")
    assert 'PBX="App.xcodeproj/project.pbxproj"' in y
    assert re.search(r'sed\s+-i[^\n]*CURRENT_PROJECT_VERSION', y), \
        "sed sur CURRENT_PROJECT_VERSION manquant"
    # PlistBuddy sur Info.plist NE DOIT PAS être utilisé pour CFBundleVersion
    assert "PlistBuddy" not in y or "CFBundleVersion" not in y, (
        "PlistBuddy sur CFBundleVersion écrase l'Info.plist mais est ignoré "
        "car Info.plist utilise $(CURRENT_PROJECT_VERSION) — inutile."
    )


def test_codemagic_computes_build_number_before_react_build():
    """L'estampille inlinée dans le JS bundle doit correspondre au
    BUILD_NUMBER final. → Il faut calculer BUILD_NUMBER AVANT `yarn build`."""
    y = (ROOT / "codemagic.yaml").read_text()
    idx_compute = y.find("Compute App Store build number")
    idx_yarn = y.find("Build React app")
    idx_stamp = y.find("REACT_APP_BUILD_ID")
    assert idx_compute < idx_yarn, "BUILD_NUMBER doit être calculé AVANT yarn build"
    assert idx_stamp > 0, "REACT_APP_BUILD_ID doit être injecté"


def test_capacitor_public_gitignored():
    """`frontend/ios/App/App/public/` DOIT être gitignoré — sinon un vieux
    bundle web committé écrase le résultat de `cap sync`."""
    gi = (ROOT / "frontend/ios/.gitignore").read_text()
    assert "App/App/public" in gi, "App/App/public doit être dans .gitignore"


def test_build_stamp_component_exists():
    p = ROOT / "frontend/src/b1/B1BuildStamp.jsx"
    assert p.exists()
    src = p.read_text()
    assert "REACT_APP_BUILD_ID" in src
    assert 'data-testid="kolo-build-stamp"' in src


def test_login_page_shows_build_stamp():
    src = (ROOT / "frontend/src/v2/pages/V2AuthPage.js").read_text()
    assert "B1BuildStamp" in src
    assert "import B1BuildStamp" in src


def test_profil_page_shows_build_stamp():
    src = (ROOT / "frontend/src/b1/B1Shell.jsx").read_text()
    assert "B1BuildStamp" in src
    # Doit apparaître à la fin de ProfilPage (après le bouton logout)
    logout_idx = src.find('data-testid="b1-profil-logout"')
    stamp_idx = src.find("<B1BuildStamp", logout_idx)
    assert stamp_idx > logout_idx, "B1BuildStamp doit être placé après le bouton logout"
