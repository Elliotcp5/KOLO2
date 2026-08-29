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
        # Cas Apify réels — l'acteur pige-immo-fr-scraper émet buy/rent
        assert normalize_transaction("buy") == "vente"
        assert normalize_transaction("BUY") == "vente"
        assert normalize_transaction("Buy") == "vente"

    def test_from_hint_location(self):
        assert normalize_transaction("location") == "location"
        assert normalize_transaction("rent") == "location"
        assert normalize_transaction("à louer") == "location"
        # Cas Apify réels
        assert normalize_transaction("RENT") == "location"
        assert normalize_transaction("Rent") == "location"
        assert normalize_transaction("rental") == "location"

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


class TestEnrichFromApifyRow:
    """A1 bis — mapping des ~30 colonnes complémentaires."""

    def _base_row(self):
        return {
            "id": "abc",
            "propertyType": "Appartement",
            "description": "Rue de Rome, 4ème étage",
            "latitude": None,
            "longitude": None,
            "floor": 4,
            "bedrooms": 2,
            "hasElevator": True,
            "hasBalcony": True,
            "hasTerrace": False,
            "hasGarden": False,
            "hasParking": False,
            "isNewBuild": False,
            "ghgClass": "B",
            "photos": ["a.jpg", "b.jpg", "c.jpg"],
            "status": "active",
            "postedAt": "2026-01-15T10:00:00Z",
            "scrapedAt": "2026-02-28T09:00:00Z",
            "daysOnMarket": 44,
            "previousPrice": 985000,
            "priceChanged": True,
            "priceDropCount": 1,
            "priceDropPct": 3.55,
            "resolvedAddress": "Rue de Rome, 75008 Paris",
            "resolvedStreet": "Rue de Rome",
            "addressConfidence": 0.3,
            "listingKey": "abc-key",
            "district": "17e",
        }

    def _base_listing(self):
        return {"price": 950000, "surface": 78, "postal_code": "75017"}

    def test_description_and_property_type(self):
        from normalization import enrich_from_apify_row
        listing = self._base_listing()
        enrich_from_apify_row(listing, self._base_row())
        assert listing["description"].startswith("Rue de Rome")
        assert listing["property_type"] == "Appartement"

    def test_geo_left_null_when_missing(self):
        from normalization import enrich_from_apify_row
        listing = self._base_listing()
        enrich_from_apify_row(listing, self._base_row())
        # Latitude/longitude vides côté Apify → NULL (remplis par BAN en A3)
        assert listing["latitude"] is None
        assert listing["longitude"] is None

    def test_geo_picked_up_when_present(self):
        from normalization import enrich_from_apify_row
        row = self._base_row()
        row["latitude"] = 48.8566
        row["longitude"] = 2.3522
        listing = self._base_listing()
        enrich_from_apify_row(listing, row)
        assert abs(listing["latitude"] - 48.8566) < 1e-6
        assert abs(listing["longitude"] - 2.3522) < 1e-6

    def test_resolved_address_mapped_without_trust(self):
        """Mappé mais confidence 0.3 = à ignorer côté A3."""
        from normalization import enrich_from_apify_row
        listing = self._base_listing()
        enrich_from_apify_row(listing, self._base_row())
        assert listing["resolved_address"] == "Rue de Rome, 75008 Paris"
        assert listing["resolved_street"] == "Rue de Rome"
        assert abs(listing["address_confidence"] - 0.3) < 1e-6

    def test_booleans_nullable(self):
        from normalization import enrich_from_apify_row
        listing = self._base_listing()
        # row sans has_* → tous NULL (pas False !)
        enrich_from_apify_row(listing, {"id": "x"})
        assert listing["has_elevator"] is None
        assert listing["has_balcony"] is None
        assert listing["has_terrace"] is None
        assert listing["has_garden"] is None
        assert listing["has_parking"] is None
        assert listing["is_new_build"] is None

    def test_booleans_present(self):
        from normalization import enrich_from_apify_row
        listing = self._base_listing()
        enrich_from_apify_row(listing, self._base_row())
        assert listing["has_elevator"] is True
        assert listing["has_balcony"] is True
        assert listing["has_terrace"] is False
        assert listing["has_garden"] is False
        assert listing["has_parking"] is False
        assert listing["is_new_build"] is False

    def test_price_per_m2_auto_calc(self):
        from normalization import enrich_from_apify_row
        listing = self._base_listing()
        enrich_from_apify_row(listing, self._base_row())
        # 950000 / 78 = 12179.49
        assert abs(listing["price_per_m2"] - 12179.49) < 0.01

    def test_price_per_m2_from_apify_wins(self):
        from normalization import enrich_from_apify_row
        row = self._base_row()
        row["pricePerSquareMeter"] = 15000
        listing = self._base_listing()
        enrich_from_apify_row(listing, row)
        assert listing["price_per_m2"] == 15000

    def test_price_per_m2_none_when_no_surface(self):
        from normalization import enrich_from_apify_row
        listing = {"price": 500000, "surface": None, "postal_code": "75017"}
        enrich_from_apify_row(listing, {"id": "x"})
        assert listing["price_per_m2"] is None

    def test_price_history(self):
        from normalization import enrich_from_apify_row
        listing = self._base_listing()
        enrich_from_apify_row(listing, self._base_row())
        assert listing["previous_price"] == 985000
        assert listing["price_changed"] is True
        assert listing["price_drop_count"] == 1
        assert abs(listing["price_drop_pct"] - 3.55) < 1e-6

    def test_timing(self):
        from normalization import enrich_from_apify_row
        listing = self._base_listing()
        enrich_from_apify_row(listing, self._base_row())
        assert listing["posted_at"] == "2026-01-15T10:00:00Z"
        assert listing["scraped_at"] == "2026-02-28T09:00:00Z"
        assert listing["days_on_market"] == 44
        assert listing["status"] == "active"

    def test_department_auto_from_postal_code(self):
        from normalization import enrich_from_apify_row
        listing = {"price": 100, "surface": 20, "postal_code": "75017"}
        enrich_from_apify_row(listing, {"id": "x"})
        assert listing["department"] == "75"

    def test_department_dom_tom(self):
        from normalization import enrich_from_apify_row
        listing = {"price": 100, "surface": 20, "postal_code": "97110"}
        enrich_from_apify_row(listing, {"id": "x"})
        assert listing["department"] == "971"

    def test_department_from_apify_wins(self):
        from normalization import enrich_from_apify_row
        listing = {"price": 100, "surface": 20, "postal_code": "75017"}
        enrich_from_apify_row(listing, {"department": "92"})
        assert listing["department"] == "92"

    def test_photo_count_from_photos_array(self):
        from normalization import enrich_from_apify_row
        listing = self._base_listing()
        enrich_from_apify_row(listing, self._base_row())
        assert listing["photo_count"] == 3

    def test_ghg_class_normalized(self):
        from normalization import enrich_from_apify_row
        listing = self._base_listing()
        enrich_from_apify_row(listing, {"ghgClass": "b"})
        assert listing["ghg_class"] == "B"
        enrich_from_apify_row(listing, {"ghgClass": "invalid"})
        assert listing["ghg_class"] is None

    def test_status_normalized(self):
        from normalization import enrich_from_apify_row
        listing = self._base_listing()
        for raw, expected in [
            ("published", "active"),
            ("live", "active"),
            ("sold", "sold"),
            ("vendu", "sold"),
            ("withdrawn", "withdrawn"),
            ("retiré", "withdrawn"),
            ("compromis", "pending"),
        ]:
            enrich_from_apify_row(listing, {"status": raw})
            assert listing["status"] == expected, f"{raw} → {listing['status']}"

    def test_rue_extraite_and_etage_extrait_not_set(self):
        """Ces 2 colonnes sont extraites par A3, jamais par le mapping Apify."""
        from normalization import enrich_from_apify_row
        listing = self._base_listing()
        enrich_from_apify_row(listing, self._base_row())
        assert "rue_extraite" not in listing
        assert "etage_extrait" not in listing
