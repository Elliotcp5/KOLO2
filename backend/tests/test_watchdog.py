"""Tests watchdog — validation d'auto-réparation et d'alerte staleness.

Ces tests appellent directement les helpers du module `a3.watchdog` avec
un stub DB minimal (dict-based) et un stub Resend qui compte les envois.
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, "/app/backend")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _iso_hours_ago(h: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=h)).isoformat()


def test_check_daily_job_freshness_detects_stale():
    from a3.watchdog import _check_daily_job_freshness

    db = MagicMock()
    # scraper_quotidien : dernier done il y a 48h → stale
    # generer_opportunites_quotidien : dernier done il y a 2h → OK
    async def find_one(query, sort=None):
        job = query.get("job")
        if job == "scraper_quotidien":
            return {"start": _iso_hours_ago(48), "status": "done"}
        if job == "generer_opportunites_quotidien":
            return {"start": _iso_hours_ago(2), "status": "done"}
        return None
    db.jobs_runs.find_one = AsyncMock(side_effect=find_one)

    stale = asyncio.run(_check_daily_job_freshness(db))
    stale_jobs = [s["job"] for s in stale]
    assert "scraper_quotidien" in stale_jobs, f"stale should contain scraper: {stale}"
    assert "generer_opportunites_quotidien" not in stale_jobs, f"gen should be fresh: {stale}"
    print("PASS test_check_daily_job_freshness_detects_stale")


def test_alert_email_dedup():
    from a3.watchdog import _send_alert_email

    db = MagicMock()
    # Simule qu'une alerte identique a été envoyée il y a 1h → dedup doit skip
    db.scheduler_alerts.find_one = AsyncMock(return_value={"code": "test_code", "sent_at": _iso_hours_ago(1)})
    db.scheduler_alerts.insert_one = AsyncMock()

    os.environ["RESEND_API_KEY"] = "dummy"
    os.environ["SCHEDULER_ALERT_EMAIL"] = "test@example.com"
    with patch("resend.Emails.send") as send:
        ok = asyncio.run(_send_alert_email(db, "subject", "body", "test_code"))
    assert ok is False, "dedup doit empêcher l'envoi"
    send.assert_not_called()
    print("PASS test_alert_email_dedup")


def test_alert_email_sends_when_not_dedup():
    from a3.watchdog import _send_alert_email

    db = MagicMock()
    db.scheduler_alerts.find_one = AsyncMock(return_value=None)  # jamais envoyé
    db.scheduler_alerts.insert_one = AsyncMock()

    os.environ["RESEND_API_KEY"] = "dummy_key"
    os.environ["SCHEDULER_ALERT_EMAIL"] = "test@example.com"
    with patch("resend.Emails.send") as send:
        send.return_value = {"id": "email_id_123"}
        ok = asyncio.run(_send_alert_email(db, "subj", "body", "code_new"))
    assert ok is True, "should send when not dedup"
    send.assert_called_once()
    db.scheduler_alerts.insert_one.assert_called_once()
    print("PASS test_alert_email_sends_when_not_dedup")


if __name__ == "__main__":
    test_check_daily_job_freshness_detects_stale()
    test_alert_email_dedup()
    test_alert_email_sends_when_not_dedup()
    print("ALL PASS")
