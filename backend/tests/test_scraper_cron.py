"""Regression tests for the Apify → Supabase scraper (`scripts.scrape_listings_cron`).

These are pure-unit tests — they do NOT hit Apify or Supabase — so they can
run in CI without any live credentials.
"""
from __future__ import annotations

import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from scripts.scrape_listings_cron import (  # noqa: E402
    STATIC_TOP_ZIPS,
    _batch,
    _dedupe_by_url,
    MAX_ZIPS_PER_BATCH,
)


def test_static_zips_are_all_valid_five_digit_fr_codes():
    for z in STATIC_TOP_ZIPS:
        assert isinstance(z, str)
        assert len(z) == 5
        assert z.isdigit()


def test_batch_splits_correctly():
    result = list(_batch(list("abcdefghij"), 3))
    assert result == [["a", "b", "c"], ["d", "e", "f"], ["g", "h", "i"], ["j"]]


def test_batch_never_exceeds_size_cap():
    # 57 static zips at cap 20 → 3 batches (20, 20, 17)
    batches = list(_batch(STATIC_TOP_ZIPS, MAX_ZIPS_PER_BATCH))
    assert all(len(b) <= MAX_ZIPS_PER_BATCH for b in batches)
    assert sum(len(b) for b in batches) == len(STATIC_TOP_ZIPS)


def test_dedupe_by_url_keeps_first_occurrence_only():
    rows = [
        {"url": "https://leboncoin.fr/a/1"},
        {"url": "https://leboncoin.fr/a/1"},   # dup
        {"url": "https://pap.fr/b/2"},
        {"url": ""},                            # empty → dropped
        {"url": None},                          # None → dropped
        {"url": "ftp://not-http.com"},          # non-http → dropped
        {"url": "https://seloger.fr/c/3"},
    ]
    out = _dedupe_by_url(rows)
    urls = [r["url"] for r in out]
    assert urls == [
        "https://leboncoin.fr/a/1",
        "https://pap.fr/b/2",
        "https://seloger.fr/c/3",
    ]


def test_dedupe_falls_back_to_link_field():
    # The Apify actor sometimes surfaces the URL under `link` instead of `url`.
    # _dedupe_by_url treats both as equivalent for uniqueness/validity checks.
    rows = [
        {"link": "https://leboncoin.fr/x/1"},
        {"url": "https://pap.fr/y/2"},
        {"link": "https://leboncoin.fr/x/1"},   # dup via link
    ]
    out = _dedupe_by_url(rows)
    assert len(out) == 2
