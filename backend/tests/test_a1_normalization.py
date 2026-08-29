"""Tests unitaires pour la normalisation A1 (BLOC A / Session A1).

Garantit que toute ligne écrite dans `listings` porte les 3 colonnes
`transaction`, `type_normalise`, `est_logement`, et corrige le `postal_code`
sur Paris / Lyon / Marseille lorsque la ville contient l'arrondissement.

Lancement :
    cd /app/backend && python -m pytest tests/test_a1_normalization.py -v
"""
from __future__ import annotations

import pytest

from normalization import (
    apply_normalization,
    deduce_postal_code,
    is_logement,
    normalize_property_type,
    normalize_transaction,
)


class TestNormalizePropertyType:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("Appartement", "appartement"),
            ("appartement 3 pièces", "appartement"),
            ("T3", "appartement"),
            ("F4", "appartement"),
            ("Duplex", "appartement"),
            ("Studio", "studio"),
            ("Studette", "studio"),
            ("Loft", "loft"),
            ("Atelier", "loft"),
            ("Maison", "maison"),
            ("Villa", "maison"),
            ("château", "maison"),
            ("Longère", "maison"),
            ("Terrain à construire", "terrain"),
            ("terrain constructible", "terrain"),
            ("Parking", "parking"),
            ("Box", "parking"),
            ("Garage", "parking"),
            ("Local commercial", "local_commercial"),
            ("Fonds de commerce", "local_commercial"),
            ("Boutique", "local_commercial"),
            ("Bureau", "bureau"),
            ("Bureaux", "bureau"),
            ("Immeuble de rapport", "immeuble"),
            ("résidence", "immeuble"),
            (None, "autre"),
            ("", "autre"),
            ("foobar", "autre"),
        ],
    )
    def test_normalize(self, raw, expected):
        assert normalize_property_type(raw) == expected


class TestIsLogement:
    @pytest.mark.parametrize(
        "type_norm,expected",
        [
            ("appartement", True),
            ("studio", True),
            ("maison", True),
            ("loft", True),
            ("terrain", False),
            ("parking", False),
            ("local_commercial", False),
            ("immeuble", False),
            ("bureau", False),
            ("autre", False),
            (None, False),
            ("", False),
        ],
    )
    def test_is_logement(self, type_norm, expected):
        assert is_logement(type_norm) is expected


class TestNormalizeTransaction:
    def test_from_hint_vente(self):
        assert normalize_transaction("vente") == "vente"
        assert normalize_transaction("for_sale") == "vente"
        assert normalize_transaction("Sale") == "vente"

    def test_from_hint_location(self):
        assert normalize_transaction("location") == "location"
        assert normalize_transaction("rent") == "location"
        assert normalize_transaction("à louer") == "location"

    def test_fallback_price(self):
        assert normalize_transaction(None, price=350000) == "vente"
        assert normalize_transaction(None, price=1200) == "location"
        assert normalize_transaction(None, price=40000) == "vente"  # seuil
        assert normalize_transaction(None, price=39999) == "location"

    def test_no_hint_no_price(self):
        assert normalize_transaction(None) == "vente"
        assert normalize_transaction("") == "vente"


class TestDeducePostalCode:
    @pytest.mark.parametrize(
        "city,expected",
        [
            ("Paris 1er", "75001"),
            ("Paris 11e", "75011"),
            ("Paris 20e", "75020"),
            ("paris 11", "75011"),
            ("PARIS 20ème", "75020"),
            ("Paris - 5e arrondissement", "75005"),
            ("Lyon 3ème", "69003"),
            ("lyon 9", "69009"),
            ("Marseille 15e", "13015"),
            ("Marseille 16", "13016"),
            ("MARSEILLE 1er", "13001"),
        ],
    )
    def test_deduce(self, city, expected):
        assert deduce_postal_code(city) == expected

    def test_existing_postal_code_wins(self):
        assert deduce_postal_code("Paris 11e", "75001") == "75001"

    def test_city_alone_returns_none(self):
        assert deduce_postal_code("Paris") is None
        assert deduce_postal_code("Lyon") is None

    def test_out_of_range(self):
        assert deduce_postal_code("Paris 25e") is None
        assert deduce_postal_code("Lyon 12e") is None
        assert deduce_postal_code("Marseille 17e") is None

    def test_none_or_empty(self):
        assert deduce_postal_code(None) is None
        assert deduce_postal_code("") is None

    def test_non_special_city_preserves_existing(self):
        assert deduce_postal_code("Nice", "06000") == "06000"


class TestApplyNormalization:
    def test_appartement_paris(self):
        listing = {
            "property_type": "T3",
            "city": "Paris 11e",
            "price": 450000,
            "raw_data": {},
        }
        apply_normalization(listing)
        assert listing["type_normalise"] == "appartement"
        assert listing["est_logement"] is True
        assert listing["transaction"] == "vente"
        assert listing["postal_code"] == "75011"

    def test_studio_location(self):
        listing = {
            "property_type": "Studio",
            "city": "Paris 3e",
            "price": 850,
        }
        apply_normalization(listing)
        assert listing["type_normalise"] == "studio"
        assert listing["est_logement"] is True
        assert listing["transaction"] == "location"
        assert listing["postal_code"] == "75003"

    def test_type_from_raw_data(self):
        listing = {"raw_data": {"propertyType": "Villa"}, "city": "Nice", "price": 800000}
        apply_normalization(listing)
        assert listing["type_normalise"] == "maison"
        assert listing["est_logement"] is True
        assert listing["transaction"] == "vente"

    def test_parking_non_logement(self):
        listing = {"property_type": "Box", "price": 25000, "city": "Paris 15e"}
        apply_normalization(listing)
        assert listing["type_normalise"] == "parking"
        assert listing["est_logement"] is False
        # 25 000 < 40 000 → location par défaut, sauf hint contraire
        assert listing["transaction"] == "location"
        assert listing["postal_code"] == "75015"

    def test_transaction_hint_wins_over_price(self):
        listing = {
            "property_type": "Appartement",
            "transaction": "location",
            "price": 500000,  # prix élevé mais hint = location
        }
        apply_normalization(listing)
        assert listing["transaction"] == "location"

    def test_no_type_fallback_autre(self):
        listing = {"price": 300000}
        apply_normalization(listing)
        assert listing["type_normalise"] == "autre"
        assert listing["est_logement"] is False
        assert listing["transaction"] == "vente"

    def test_existing_postal_code_untouched(self):
        listing = {"property_type": "T2", "postal_code": "75012", "city": "Paris 11e"}
        apply_normalization(listing)
        assert listing["postal_code"] == "75012"

    def test_return_value_is_same_dict(self):
        listing = {"property_type": "Studio"}
        assert apply_normalization(listing) is listing
