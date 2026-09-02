"""Conformité Apple — vérifie qu'aucune information de tarification agence,
d'URL Stripe ou de terminologie « offre équipe » ne fuit dans le bundle iOS.

Une seule violation → build refusé par Apple. Ce test tourne dans la CI et
doit rester vert jusqu'à la soumission App Store.
"""
from __future__ import annotations
import re
from pathlib import Path

# Le bundle iOS est /app/frontend/src/b1/ (coquille B1 + i18n).
# La landing web /pages/ et l'ancien code /v2/ ne sont pas embarqués dans l'IPA
# et sont hors périmètre du test de conformité Apple.
FRONTEND_ROOT = Path("/app/frontend/src/b1")

# Chaînes strictement interdites, insensibles à la casse pour les mots
FORBIDDEN_LITERALS = [
    # URLs Stripe
    "checkout.stripe.com",
    "buy.stripe.com",
    "stripe.com",
    # Le mot Stripe lui-même (nom du prestataire)
    "stripe",
    # Terminologie « offre équipe » — 4 langues
    "offre agence",
    "agency plan",
    "agenturangebot",
    "offerta agenzia",
    "par conseiller",
    "per advisor",
    "pro berater",
    "per consulente",
]

# Motifs prix agence : montant suivi d'un € ou dans un contexte prix
# On cherche 199/349/599 collé à € ou € à distance courte, sans faux positifs
# (ex. l'année 2019 ne doit pas être capturée).
PRICE_PATTERNS = [
    re.compile(r"199\s*€"),
    re.compile(r"349\s*€"),
    re.compile(r"599\s*€"),
    re.compile(r"€\s*199\b"),
    re.compile(r"€\s*349\b"),
    re.compile(r"€\s*599\b"),
    # « à partir de 199 » / « from 349 » / « ab 599 » / « da 199 »
    re.compile(r"(?:à partir de|from|ab|da)\s+(?:199|349|599)\b", re.IGNORECASE),
]


def _iter_files():
    exts = (".js", ".jsx", ".ts", ".tsx", ".json", ".css", ".html")
    for f in FRONTEND_ROOT.rglob("*"):
        if not f.is_file():
            continue
        if any(p == "node_modules" for p in f.parts):
            continue
        if f.suffix in exts:
            yield f


def test_no_stripe_or_agency_price_in_frontend():
    """Aucun mot Stripe, URL Stripe, mention prix agence ou terminologie
    « offre équipe » ne doit apparaître dans le bundle front."""
    violations: list[str] = []
    for f in _iter_files():
        text = f.read_text(encoding="utf-8", errors="ignore")
        lower = text.lower()
        for literal in FORBIDDEN_LITERALS:
            if literal.lower() in lower:
                # exclut les commentaires de test-notre-propre-fichier si un jour
                # on veut whitelist des chaînes de test (aucun cas actuel)
                violations.append(f"{f.relative_to(FRONTEND_ROOT)} → contient « {literal} »")
        for pat in PRICE_PATTERNS:
            for m in pat.finditer(text):
                # contexte de 40 caractères pour message d'erreur exploitable
                s = max(0, m.start() - 30)
                e = min(len(text), m.end() + 30)
                snippet = text[s:e].replace("\n", " ")
                violations.append(
                    f"{f.relative_to(FRONTEND_ROOT)} → prix agence détecté : « …{snippet}… »"
                )
    assert not violations, (
        "VIOLATION APPLE COMPLIANCE — motifs interdits dans /app/frontend/src :\n"
        + "\n".join(f"  - {v}" for v in violations[:20])
    )


def test_no_agency_creation_flow_in_frontend():
    """Aucun écran iOS ne doit permettre à un compte vierge de créer une
    agence. Toute la création d'organisation passe par le back-office
    administrateur (BLOC D · Partie 2), après vente et paiement.

    On interdit :
      - fetch/POST sur `/api/d1/organisations` avec ou sans slash final,
      - toute chaîne « créer/créez une agence » (FR/EN/IT/DE).
    """
    import re as _re

    forbidden_texts = [
        "créer une agence", "créer mon agence", "création d'agence",
        "creer une agence",  # sans accent
        "create an agency", "create my agency",
        "creare un'agenzia", "crea la mia agenzia",
        "agentur erstellen", "meine agentur erstellen",
    ]
    # Pattern : POST sur /api/d1/organisations (racine, PAS /me qui est PATCH-only)
    endpoint_post = _re.compile(
        r"""POST[^\n]{0,200}["'`]/api/d1/organisations(?!/me)["'`]""",
        _re.IGNORECASE,
    )
    endpoint_method_post = _re.compile(
        r"""["'`]/api/d1/organisations(?!/me)["'`][^\n]{0,200}method\s*:\s*["']POST["']""",
        _re.IGNORECASE,
    )

    violations: list[str] = []
    for f in _iter_files():
        text = f.read_text(encoding="utf-8", errors="ignore")
        lower = text.lower()
        for t in forbidden_texts:
            if t in lower:
                violations.append(f"{f.relative_to(FRONTEND_ROOT)} → contient « {t} »")
        if endpoint_post.search(text) or endpoint_method_post.search(text):
            violations.append(
                f"{f.relative_to(FRONTEND_ROOT)} → POST /api/d1/organisations détecté"
            )
    assert not violations, (
        "VIOLATION CONFORMITÉ APPLE — création d'agence détectée dans le bundle iOS :\n"
        + "\n".join(f"  - {v}" for v in violations[:20])
    )
