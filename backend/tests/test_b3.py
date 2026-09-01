"""Tests pytest — Session B3 (Performances, Funnel, Emails, APNs, Notifications)."""
from __future__ import annotations

import os
from datetime import datetime, timezone

import pytest
from motor.motor_asyncio import AsyncIOMotorClient


def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.mark.asyncio
async def test_config_b3_streak_et_notif_defaults():
    from a2.config import ensure_config_seeded, get_config
    db = _db()
    await ensure_config_seeded(db)
    cfg = await get_config(db)
    s = cfg.get("streak") or {}
    n = cfg.get("notif") or {}
    assert s.get("objectif") == 7
    assert s.get("seuil_notif") == 3
    assert n.get("plafond_journalier") == 5
    assert n.get("horaires_rappels") == [9, 11, 14, 17]
    assert n.get("heure_streak") == 20


@pytest.mark.asyncio
async def test_period_range_mois_bornes_paris():
    from b3.routes import _period_range
    start, end = _period_range("mois")
    assert start.month != end.month or start.year != end.year
    assert (end - start).days >= 28


@pytest.mark.asyncio
async def test_period_range_trimestre():
    from b3.routes import _period_range
    start, end = _period_range("trimestre")
    diff = (end - start).days
    assert 88 <= diff <= 93


@pytest.mark.asyncio
async def test_period_range_annee():
    from b3.routes import _period_range
    from a2.tz import PARIS
    start, end = _period_range("annee")
    # Bornes stockées en UTC — reconvertir en Paris pour vérifier le 1er janvier
    start_paris = start.astimezone(PARIS)
    assert end.year == start.year + 1 or end.astimezone(PARIS).year == start_paris.year + 1
    assert start_paris.month == 1 and start_paris.day == 1


@pytest.mark.asyncio
async def test_render_notif_pluralisation_fr():
    from b3.services import render_notif
    s1 = render_notif("fr", "notif.rappel.matin", {"n": 1})
    s5 = render_notif("fr", "notif.rappel.matin", {"n": 5})
    assert "1 opportunité" in s1
    assert "5 opportunités" in s5
    assert s1 != s5


@pytest.mark.asyncio
async def test_render_notif_zone_ouverte():
    from b3.services import render_notif
    s = render_notif("fr", "notif.zone_ouverte", {"cp": "13008"})
    assert "13008" in s
    assert "KOLO" in s


@pytest.mark.asyncio
async def test_render_notif_relance_decouverte_reprend_texte_paywall():
    """Contrat imposé : la relance Découverte cite 'toutes les opportunités de vos zones, chaque jour'."""
    from b3.services import render_notif
    s = render_notif("fr", "notif.decouverte.relance", {})
    assert "toutes les opportunités de vos zones, chaque jour" in s
    # jamais de volume chiffré
    assert "N opportunités" not in s
    assert not any(ch.isdigit() for ch in s)


@pytest.mark.asyncio
async def test_apns_not_ready_ne_crash_pas():
    from b3.services import send_push_to_user
    db = _db()
    # user fictif sans device_tokens → 0 envoi
    n = await send_push_to_user(db, "test-b3-noone", "notif.zone_ouverte", {"cp": "13008"})
    assert n == 0


@pytest.mark.asyncio
async def test_performances_query_exclut_statuts_veille():
    """Les statuts de veille et deja_en_vente_signale ne sont jamais comptés."""
    from b3.routes import _STATUTS_EXCLUS, _STATUTS_POSITIFS, _STATUTS_DEMARCHES
    assert "deja_en_vente_signale" in _STATUTS_EXCLUS
    # Les compteurs positifs ne contiennent que demarche + mandat_signe
    assert _STATUTS_POSITIFS == {"demarche", "mandat_signe"}
    assert _STATUTS_DEMARCHES == {"demarche", "mandat_signe"}
    # veille_* n'est nulle part
    for x in ("veille_a_surveiller", "veille_ignoree", "veille_demarchee"):
        assert x not in _STATUTS_POSITIFS
        assert x not in _STATUTS_DEMARCHES
