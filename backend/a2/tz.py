"""
KOLO — Utilitaire fuseau horaire Europe/Paris (Session A2)
==========================================================

Toutes les bascules de quotas et notifications KOLO se font en heure de Paris,
y compris pour un utilisateur déclaré à Dubaï ou Sydney. Les dates sont stockées
en UTC (ISO-8601), mais les fenêtres glissantes (jour / semaine / mois) sont
calculées en heure locale française.

Ce module est LA seule source pour :
  - récupérer "maintenant" en heure de Paris
  - calculer la clé de période (« 2026-08-26 », « 2026-W35 », « 2026-08 »)
  - obtenir les bornes UTC d'une période donnée
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal, Optional
from zoneinfo import ZoneInfo

PARIS = ZoneInfo("Europe/Paris")
UTC = timezone.utc

PeriodKind = Literal["quotidien", "hebdo", "mensuel"]


def now_paris() -> datetime:
    """`datetime.now()` en heure de Paris (tz-aware)."""
    return datetime.now(PARIS)


def to_paris(dt: datetime) -> datetime:
    """Convertit un datetime aware (ou naïf assumé UTC) en heure de Paris."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(PARIS)


def period_key(kind: PeriodKind, at: Optional[datetime] = None) -> str:
    """Clé de période telle qu'utilisée dans la collection `quotas`.

    - `quotidien` → "2026-08-26"
    - `hebdo`     → "2026-W35"     (ISO week, lundi début)
    - `mensuel`   → "2026-08"
    """
    d = to_paris(at) if at else now_paris()
    if kind == "quotidien":
        return d.strftime("%Y-%m-%d")
    if kind == "hebdo":
        iso_year, iso_week, _ = d.isocalendar()
        return f"{iso_year:04d}-W{iso_week:02d}"
    if kind == "mensuel":
        return d.strftime("%Y-%m")
    raise ValueError(f"Unknown period kind: {kind}")


def period_bounds_utc(kind: PeriodKind, at: Optional[datetime] = None) -> tuple[datetime, datetime]:
    """Bornes UTC [start, end) de la période contenant `at` (défaut = maintenant).

    Le jour bascule à 00:00 Paris. La semaine bascule le lundi 00:00 Paris.
    Le mois bascule le 1er 00:00 Paris.
    """
    d = to_paris(at) if at else now_paris()
    if kind == "quotidien":
        start_local = d.replace(hour=0, minute=0, second=0, microsecond=0)
        end_local = start_local + timedelta(days=1)
    elif kind == "hebdo":
        start_local = (d - timedelta(days=d.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        end_local = start_local + timedelta(days=7)
    elif kind == "mensuel":
        start_local = d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if start_local.month == 12:
            end_local = start_local.replace(year=start_local.year + 1, month=1)
        else:
            end_local = start_local.replace(month=start_local.month + 1)
    else:
        raise ValueError(f"Unknown period kind: {kind}")
    return start_local.astimezone(UTC), end_local.astimezone(UTC)


def now_utc_iso() -> str:
    """ISO-8601 UTC — format canonique de stockage KOLO."""
    return datetime.now(UTC).isoformat()
