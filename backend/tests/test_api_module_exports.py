"""Garde-fou : chaque fonction appelée sur `veilleApi.*` et `b1api.*` doit
exister dans l'export correspondant. Évite la régression type « setStatut
is not a function » qui est remontée jusqu'à l'iPhone de l'utilisateur.
"""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend" / "src"


def _collect_calls(prefix: str) -> set[str]:
    pat = re.compile(rf"\b{prefix}\.(\w+)\b")
    calls = set()
    for p in SRC.rglob("*.js*"):
        try:
            for m in pat.finditer(p.read_text()):
                calls.add(m.group(1))
        except Exception:
            pass
    return calls


def _collect_b1api_exports() -> set[str]:
    src = (SRC / "b1" / "b1api.js").read_text()
    return set(re.findall(r"^export const (\w+)\s*=", src, re.M))


def _collect_veille_exports() -> set[str]:
    src = (SRC / "b1" / "B1Veille.jsx").read_text()
    # Match any `KEY: ` or `KEY :` inside the veilleApi = { ... } block.
    m = re.search(r"export const veilleApi = \{(.*?)\};", src, re.S)
    assert m, "veilleApi export block not found"
    body = m.group(1)
    return set(re.findall(r"^\s*(\w+)\s*:", body, re.M))


def test_veille_api_all_calls_match_exports():
    exports = _collect_veille_exports()
    calls = _collect_calls("veilleApi")
    missing = sorted(calls - exports)
    assert missing == [], f"veilleApi.* appelé mais non exporté : {missing}"


def test_b1api_all_calls_match_exports():
    exports = _collect_b1api_exports()
    calls = _collect_calls("b1api")
    # Ignorer les méthodes communes sur les retours de req (promises, etc.).
    noise = {"ok", "success", "items", "then", "catch", "default"}
    missing = sorted(c for c in (calls - exports) if c not in noise)
    assert missing == [], f"b1api.* appelé mais non exporté : {missing}"
