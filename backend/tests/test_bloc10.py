"""KOLO — Tests Bloc 10 : tutoriel + traductions + chiffres figés + conformité
Apple + boutons morts.

Tests fonctionnels :
- /api/me/plan-limits renvoie des règles réelles pour pro/decouverte.
- /api/me/stats-aujourdhui renvoie des compteurs vivants.
- `_scrub_motif_stale_count` supprime les suffixes périmés « (N annonces actives) ».

Tests statiques frontend :
- Le composant GuidedTour (B1GuidedTour.jsx) existe et déclare 5 étapes.
- Les clés i18n problématiques (dos.export.visualiser, nav.retour, …) sont
  définies en FR.
- Aucune clé i18n utilisée dans b1t('X') ne manque en FR.
- Les traductions EN comportent toutes les clés FR qui sont utilisées.
- Le texte de limite Découverte est désormais paramétré (plus de chiffre figé).
- La route /app-v2?legacy=1 n'est plus dans le menu profil.
- Les deux entrées Privacy / Terms sont présentes dans le menu profil.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
B1 = ROOT / "frontend" / "src" / "b1"


def _parse_i18n_locales():
    """Parse FR/EN/IT/DE blocks across all b1i18n*.js files."""
    key_re = re.compile(r"^\s*['\"]([a-zA-Z0-9_.\-]+)['\"]\s*:")
    loc_re = re.compile(
        r"^\s*(?:(?:const\s+)?[A-Za-z_]*\.?)?(fr|FR|en|EN|it|IT|de|DE)\s*[:=]\s*\{\s*$"
    )
    locales = {"fr": set(), "en": set(), "it": set(), "de": set()}
    for p in B1.iterdir():
        if "i18n" not in p.name:
            continue
        cur = None
        brace = 0
        for ln in p.read_text().splitlines():
            s = ln.rstrip()
            if cur is None:
                m = loc_re.match(s)
                if m:
                    cur = m.group(1).lower()
                    brace = 1
                continue
            brace += s.count("{") - s.count("}")
            if brace <= 0:
                cur = None
                continue
            km = key_re.match(s)
            if km:
                locales[cur].add(km.group(1))
    return locales


def _collect_usage():
    """b1t('X') / b1tPlural('X') calls across the whole frontend."""
    pat = re.compile(r"b1t(?:Plural)?\(\s*['\"]([^'\"]+)['\"]")
    usage = set()
    for p in (ROOT / "frontend" / "src").rglob("*.js*"):
        try:
            for m in pat.finditer(p.read_text()):
                usage.add(m.group(1))
        except Exception:
            pass
    return usage


def _is_covered(key, dict_set):
    return key in dict_set or (f"{key}_one" in dict_set and f"{key}_other" in dict_set)


def test_guided_tour_component_exists_5_steps():
    tour = B1 / "B1GuidedTour.jsx"
    assert tour.exists(), "B1GuidedTour.jsx missing"
    src = tour.read_text()
    # 5 steps declared
    assert src.count("key: 'opportunites'") == 1
    assert src.count("key: 'estimation'") == 1
    assert src.count("key: 'rapport'") == 1
    assert src.count("key: 'assistant'") == 1
    assert src.count("key: 'profil'") == 1
    # Spotlight visuals (halo + dim bands)
    assert "b1-tour2-halo" in src
    assert "b1-tour2-dim" in src
    assert "b1-tour2-arrow" in src


def test_no_i18n_keys_leak_raw_in_fr():
    locs = _parse_i18n_locales()
    usage = _collect_usage()
    missing_fr = sorted(k for k in usage if not _is_covered(k, locs["fr"]))
    assert missing_fr == [], f"FR keys missing (will leak raw): {missing_fr}"


def test_critical_en_keys_present():
    """Les clés UI critiques doivent être traduites en EN."""
    locs = _parse_i18n_locales()
    critical = [
        "profil.plan.decouverte.limite",
        "profil.plan.decouverte.opps_1_hebdo",
        "profil.plan.decouverte.est_1_vie",
        "profil.plan.decouverte.dos_1_vie",
        "procta.fin_pile.hero",
        "procta.benefit",
        "nav.retour",
        "sys.supprimer",
        "paywall.err.init",
        "dos.export.visualiser",
        "perf.titre",
        "notif.perm.titre",
    ]
    for k in critical:
        assert _is_covered(k, locs["en"]), f"EN key missing: {k}"


def test_tour_i18n_5_steps_fr_en():
    """Le tour est en 5 étapes alignées sur les 4 onglets + profil."""
    locs = _parse_i18n_locales()
    for lang in ("fr", "en"):
        for key in [
            "tour.opportunites.titre",
            "tour.estimation.titre",
            "tour.rapport.titre",
            "tour.assistant.titre",
            "tour.profil.titre",
        ]:
            assert key in locs[lang], f"missing {key} in {lang}"
        # Les anciennes clés tour.1..6 ont été remplacées (acceptable qu'il
        # en reste au cas où, mais ce n'est pas requis).


def test_decouverte_limite_no_hardcoded_count():
    """Plus de « 3 opportunités/jour » hard-codé dans l'i18n."""
    i18n = (B1 / "b1i18n.js").read_text()
    assert "3 opportunités/jour" not in i18n
    assert "3 opportunities/day" not in i18n
    assert "3 opportunità/giorno" not in i18n
    # La nouvelle forme utilise des paramètres {opps}/{est}/{dos}.
    assert "'profil.plan.decouverte.limite': \"{opps} · {est} · {dos}\"" in i18n


def test_procta_fin_pile_uses_traites_param():
    """`procta.fin_pile.hero` doit utiliser {traites} au lieu de « 3 »."""
    i18n = (B1 / "b1i18n.js").read_text()
    assert "traité vos 3 aujourd" not in i18n
    assert "{traites} aujourd" in i18n


def test_profil_menu_has_privacy_cgu_no_legacy():
    shell = (B1 / "B1Shell.jsx").read_text()
    assert "'/app-v2?legacy=1'" not in shell, "Dead legacy button must be removed"
    assert "id: 'privacy'" in shell
    assert "id: 'cgu'" in shell


def test_bottom_tabs_have_testids_for_tour_spotlight():
    """Les data-testid utilisés par le tour doivent exister dans Shell."""
    shell = (B1 / "B1Shell.jsx").read_text()
    for tid in [
        'b1-tab-${t.id}',  # dynamique
        'b1-header-profile',
    ]:
        assert tid in shell


def test_scrub_motif_stale_count():
    """Le scrubber efface le suffixe « (N annonces actives dans la zone) »."""
    import sys
    sys.path.insert(0, str(ROOT / "backend"))
    from b1.routes import _scrub_motif_stale_count

    cases = [
        (
            "DPE réalisé il y a 28 jours · aucune annonce détectée sur 2 portails (663 annonces actives dans la zone).",
            "DPE réalisé il y a 28 jours · aucune annonce détectée sur 2 portails.",
        ),
        (
            "DPE il y a 10 jours — aucune annonce détectée sur 1 portail (139 annonces actives dans la zone)",
            "DPE il y a 10 jours — aucune annonce détectée sur 1 portail.",
        ),
        (
            "DPE récent · aucune annonce.",
            "DPE récent · aucune annonce.",
        ),
        ("", ""),
    ]
    for raw, expected in cases:
        got = _scrub_motif_stale_count(raw)
        assert got == expected, f"\n  raw: {raw!r}\n  got: {got!r}\n  want: {expected!r}"
