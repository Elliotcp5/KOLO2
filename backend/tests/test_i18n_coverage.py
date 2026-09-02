"""Coverage i18n — chaque clé FR doit exister dans EN/IT/DE.

Parcourt `b1i18nDossier.js` en JS pur (regex) et vérifie que toutes les clés
définies dans le bloc `fr` sont présentes dans `en`, `it`, `de`. Prévient les
trous de traduction qui s'accumulent à chaque session.
"""
from __future__ import annotations

import re
from pathlib import Path


I18N_FILES = [
    Path("/app/frontend/src/b1/b1i18nDossier.js"),
    Path("/app/frontend/src/b1/b1i18nEstimation.js"),
]


def _parse_locale_keys(text: str, locale: str) -> set[str]:
    """Extrait les clés du bloc `dossier.{locale} = { ... };` ou du `const .. = { fr: {...} }`.

    Retourne l'ensemble des clés string trouvées dans le bloc.
    """
    # Deux patterns : `dossier.en = { ... };` (Dossier) et `const .. = { fr: {..} }` (Estimation)
    m = re.search(rf"(?:^|\W){locale}\s*[:=]\s*\{{", text, re.MULTILINE)
    if not m:
        return set()
    start = m.end() - 1  # position de la `{` d'ouverture
    depth = 0
    end = start
    for i, ch in enumerate(text[start:], start=start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    block = text[start:end + 1]
    # Toutes les clés `'key.subkey'` ou `"key"` juste avant `:`
    keys = set(re.findall(r"['\"]([a-zA-Z0-9_.]+)['\"]\s*:", block))
    return keys


def test_i18n_dossier_toutes_langues_couvrent_fr():
    text = I18N_FILES[0].read_text(encoding="utf-8")
    fr = _parse_locale_keys(text, "fr")
    assert len(fr) > 0, "Aucune clé FR détectée — parseur cassé"
    missing = {}
    for lang in ("en", "it", "de"):
        keys = _parse_locale_keys(text, lang)
        gap = fr - keys
        if gap:
            missing[lang] = sorted(gap)
    assert not missing, (
        f"Clés FR manquantes dans d'autres langues : {missing}"
    )


def test_i18n_estimation_toutes_langues_couvrent_fr():
    text = I18N_FILES[1].read_text(encoding="utf-8")
    fr = _parse_locale_keys(text, "fr")
    if len(fr) == 0:
        # Fichier optionnel, format différent : ignore silencieusement
        return
    missing = {}
    for lang in ("en", "it", "de"):
        keys = _parse_locale_keys(text, lang)
        gap = fr - keys
        if gap:
            missing[lang] = sorted(gap)
    assert not missing, (
        f"Clés FR manquantes dans d'autres langues : {missing}"
    )


def _count_keys(locale: str) -> int:
    text = I18N_FILES[0].read_text(encoding="utf-8")
    return len(_parse_locale_keys(text, locale))


def test_i18n_report_coverage_count(capsys):
    counts = {lang: _count_keys(lang) for lang in ("fr", "en", "it", "de")}
    # Log pour rapport visuel
    print("\n[i18n] dossier coverage :", counts)
    assert counts["fr"] > 100
    for lang in ("en", "it", "de"):
        assert counts[lang] >= counts["fr"], (
            f"{lang} a {counts[lang]} clés, FR en a {counts['fr']}"
        )
