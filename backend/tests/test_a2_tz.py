"""Tests A2 — utilitaire fuseau Europe/Paris (bascule à minuit Paris pour tous)."""
from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from a2.tz import PARIS, period_bounds_utc, period_key, to_paris


class TestPeriodKeyEuropeParis:
    """La clé de période dépend de l'heure locale Paris, pas de l'UTC."""

    def test_quotidien_bascule_00h_paris(self):
        # 22 août 2026 à 22h00 UTC = 23 août 00h00 Paris (heure d'été UTC+2)
        just_after_paris_midnight = datetime(2026, 8, 22, 22, 0, tzinfo=timezone.utc)
        assert period_key("quotidien", just_after_paris_midnight) == "2026-08-23"

        # 22 août 21h59 UTC = 22 août 23h59 Paris — on est encore le 22
        just_before = datetime(2026, 8, 22, 21, 59, tzinfo=timezone.utc)
        assert period_key("quotidien", just_before) == "2026-08-22"

    def test_hebdo_bascule_lundi_00h_paris(self):
        # Dimanche 23 août 2026 21h59 UTC = 23h59 Paris → semaine W34
        sunday_late = datetime(2026, 8, 23, 21, 59, tzinfo=timezone.utc)
        # Lundi 24 août 22h01 UTC = 00h01 Paris mardi... non :
        # Lundi 24 août 22h00 UTC = 25 août 00h00 Paris (encore heure d'été)
        # Passons plutôt : dimanche 23 août 22h00 UTC = lundi 24 août 00h00 Paris
        monday_paris_midnight = datetime(2026, 8, 23, 22, 0, tzinfo=timezone.utc)
        wk_sunday = period_key("hebdo", sunday_late)
        wk_monday = period_key("hebdo", monday_paris_midnight)
        assert wk_sunday != wk_monday
        assert wk_monday == "2026-W35"  # lundi 24 août 2026 = ISO week 35

    def test_mensuel_bascule_1er_00h_paris(self):
        # 31 août 21h59 UTC = 23h59 Paris → août
        end_of_aug = datetime(2026, 8, 31, 21, 59, tzinfo=timezone.utc)
        # 31 août 22h00 UTC = 1er sept 00h00 Paris → septembre
        start_of_sep = datetime(2026, 8, 31, 22, 0, tzinfo=timezone.utc)
        assert period_key("mensuel", end_of_aug) == "2026-08"
        assert period_key("mensuel", start_of_sep) == "2026-09"


class TestUserDubai:
    """Un utilisateur à Dubaï voit son quota basculer à minuit Paris, pas Dubaï."""

    def test_dubai_user_bascule_paris(self):
        # 22 août 22h00 UTC :
        #   - Paris (UTC+2 en août) : 23 août 00h00 → jour = "2026-08-23"
        #   - Dubaï (UTC+4)         : 23 août 02h00 → mais on veut la clé PARIS
        moment = datetime(2026, 8, 22, 22, 0, tzinfo=timezone.utc)
        assert period_key("quotidien", moment) == "2026-08-23"


class TestPeriodBounds:
    def test_daily_bounds(self):
        # 15 mars 2026 12h00 UTC = 13h00 Paris (heure d'hiver → été le 29 mars)
        at = datetime(2026, 3, 15, 12, 0, tzinfo=timezone.utc)
        start, end = period_bounds_utc("quotidien", at)
        # start = 15 mars 00h00 Paris = 14 mars 23h00 UTC
        assert start == datetime(2026, 3, 14, 23, 0, tzinfo=timezone.utc)
        assert end == datetime(2026, 3, 15, 23, 0, tzinfo=timezone.utc)

    def test_weekly_bounds_monday_start(self):
        # 26 août 2026 = mercredi. Semaine commence lundi 24 août 00h00 Paris
        at = datetime(2026, 8, 26, 12, 0, tzinfo=timezone.utc)
        start, end = period_bounds_utc("hebdo", at)
        assert start.astimezone(PARIS).weekday() == 0
        assert start.astimezone(PARIS).hour == 0
        assert (end - start).days == 7

    def test_monthly_bounds(self):
        at = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)
        start, end = period_bounds_utc("mensuel", at)
        assert start.astimezone(PARIS).day == 1
        assert start.astimezone(PARIS).month == 8
        assert end.astimezone(PARIS).day == 1
        assert end.astimezone(PARIS).month == 9

    def test_december_wraps_to_january(self):
        at = datetime(2026, 12, 15, 12, 0, tzinfo=timezone.utc)
        start, end = period_bounds_utc("mensuel", at)
        assert end.astimezone(PARIS).year == 2027
        assert end.astimezone(PARIS).month == 1


class TestToParis:
    def test_naive_is_treated_as_utc(self):
        naive = datetime(2026, 8, 15, 10, 0)
        p = to_paris(naive)
        assert p.tzinfo == PARIS
        # 10h00 UTC + 2h (été) = 12h00 Paris
        assert p.hour == 12
