"""KOLO — BLOC B1 : résolution ville depuis code postal.

Le référentiel INSEE complet n'est pas disponible localement. On tape la table
`code_postal → libellé` dérivée de `LABEL_TO_QUARTIER` (déjà utilisée par A3
pour Paris / Lyon / Marseille) et on complète par une table courte des chefs-
lieux de département français les plus fréquents (top ~200 CP). Suffisant pour
la démo B1 ; on affinera en B3 (fichier INSEE téléchargeable).

Fournit aussi une whitelist des zones couvertes DÉMO — 99999 — reservée aux
reviewers Apple.
"""
from __future__ import annotations

# -----------------------------------------------------------------------------
# Table CP → ville (chefs-lieux + top villes FR + arrondissements PLM)
# Format volontairement plat pour resterlisible et modifiable à la main.
# -----------------------------------------------------------------------------
CP_TO_VILLE: dict[str, str] = {
    # === Zone de démonstration Apple Review ===
    "99999": "Zone de démonstration",

    # === Paris (75) ===
    **{f"750{i:02d}": f"Paris {i}ᵉ" for i in range(1, 21)},

    # === Marseille (13) ===
    **{f"130{i:02d}": f"Marseille {i}ᵉ" for i in range(1, 17)},

    # === Lyon (69) ===
    **{f"690{i:02d}": f"Lyon {i}ᵉ" for i in range(1, 10)},

    # === Top villes France (chefs-lieux et grandes agglos) ===
    "31000": "Toulouse", "31100": "Toulouse", "31200": "Toulouse",
    "31300": "Toulouse", "31400": "Toulouse", "31500": "Toulouse",
    "06000": "Nice", "06100": "Nice", "06200": "Nice", "06300": "Nice",
    "44000": "Nantes", "44100": "Nantes", "44200": "Nantes", "44300": "Nantes",
    "34000": "Montpellier", "34070": "Montpellier", "34080": "Montpellier",
    "34090": "Montpellier",
    "67000": "Strasbourg", "67100": "Strasbourg", "67200": "Strasbourg",
    "33000": "Bordeaux", "33100": "Bordeaux", "33200": "Bordeaux",
    "33300": "Bordeaux", "33800": "Bordeaux",
    "59000": "Lille", "59800": "Lille", "59777": "Lille",
    "35000": "Rennes", "35200": "Rennes", "35700": "Rennes",
    "51100": "Reims", "51430": "Bezannes", "51000": "Châlons-en-Champagne",
    "42000": "Saint-Étienne", "42100": "Saint-Étienne",
    "76600": "Le Havre", "76610": "Le Havre", "76620": "Le Havre",
    "83000": "Toulon", "83100": "Toulon", "83200": "Toulon",
    "38000": "Grenoble", "38100": "Grenoble", "38700": "La Tronche",
    "21000": "Dijon", "21100": "Dijon",
    "49000": "Angers", "49100": "Angers",
    "69100": "Villeurbanne",
    "72000": "Le Mans", "72100": "Le Mans",
    "13090": "Aix-en-Provence", "13100": "Aix-en-Provence",
    "13290": "Aix-en-Provence",
    "29200": "Brest", "29800": "Brest",
    "30000": "Nîmes", "30900": "Nîmes",
    "87000": "Limoges", "87100": "Limoges",
    "63000": "Clermont-Ferrand", "63100": "Clermont-Ferrand",
    "37000": "Tours", "37100": "Tours", "37200": "Tours",
    "80000": "Amiens", "80080": "Amiens", "80090": "Amiens",
    "57000": "Metz", "57050": "Metz", "57070": "Metz",
    "66000": "Perpignan", "66100": "Perpignan",
    "92100": "Boulogne-Billancourt",

    # Autres CP fréquents Île-de-France
    "92200": "Neuilly-sur-Seine", "92300": "Levallois-Perret",
    "92500": "Rueil-Malmaison", "92600": "Asnières-sur-Seine",
    "93100": "Montreuil", "93200": "Saint-Denis", "94200": "Ivry-sur-Seine",
    "94300": "Vincennes", "95100": "Argenteuil",
    "78000": "Versailles", "78100": "Saint-Germain-en-Laye",
    "77300": "Fontainebleau", "77100": "Meaux",
    "91000": "Évry-Courcouronnes", "91300": "Massy",

    # Communes touristiques classiques
    "06400": "Cannes", "06600": "Antibes", "06160": "Antibes",
    "06230": "Villefranche-sur-Mer",
    "83700": "Saint-Raphaël", "83990": "Saint-Tropez",
    "64000": "Pau", "64100": "Bayonne", "64200": "Biarritz", "64500": "Saint-Jean-de-Luz",
    "17000": "La Rochelle", "17300": "Rochefort",
    "62200": "Boulogne-sur-Mer", "62520": "Le Touquet-Paris-Plage",
    "14000": "Caen", "14800": "Deauville",
    "50000": "Saint-Lô", "50100": "Cherbourg-en-Cotentin",
    "20000": "Ajaccio", "20200": "Bastia",
}


def resolve_ville(code_postal: str) -> str | None:
    """Renvoie le libellé de la ville pour un CP, ou None si inconnu."""
    if not code_postal:
        return None
    cp = str(code_postal).strip()
    if not cp.isdigit() or len(cp) != 5:
        return None
    return CP_TO_VILLE.get(cp)


# -----------------------------------------------------------------------------
# Zones toujours couvertes pour la démo Apple Review + zones réelles Bloc A
# -----------------------------------------------------------------------------
# `13008`, `69003`, `75017` sont les CP réels alimentés par le pipeline Apify.
# `99999` est la zone de démonstration Apple — toujours couverte + 3 cartes
# fictives injectées côté frontend (via `demoOpportunites.js`) pour garantir le
# swipe fonctionnel côté reviewer.
BOOTSTRAP_ZONES_COUVERTES: list[str] = [
    "99999",  # DÉMO Apple Review — jamais désactivable
    "13008",  # Marseille 8ᵉ
    "69003",  # Lyon 3ᵉ
    "75017",  # Paris 17ᵉ
]

DEMO_CODE_POSTAL: str = "99999"
