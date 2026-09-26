"""Section-name parsing, against names taken from the live notebooks."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from taxonomy import parse_section_name, slugify  # noqa: E402


def test_race_section():
    meta = parse_section_name("24W11_S10R04_SAO")
    assert (meta.year, meta.week, meta.season) == (2024, 11, 10)
    assert meta.rounds == [4]
    assert meta.session_kind == "race"
    assert meta.venue == "SAO"


def test_doubleheader_collects_both_rounds():
    meta = parse_section_name("23W28_R13_R14_RME")
    assert meta.rounds == [13, 14]
    assert meta.session_kind == "race"
    assert meta.venue == "RME"


def test_track_test_and_combined_test_kinds():
    assert parse_section_name("23W21_T13_CAL").session_kind == "track_test"
    assert parse_section_name("23W43_CT18_VLC").session_kind == "combined_test"


def test_season_prefix_form():
    meta = parse_section_name("S09_23W24_CRITT")
    assert (meta.season, meta.year, meta.week) == (9, 2023, 24)
    assert meta.rounds == []
    assert meta.venue == "CRITT"


def test_underscore_is_not_a_word_boundary():
    """Regression: \\b never fires between '11' and '_', so tokens must be split."""
    meta = parse_section_name("24W15_S10R06_MIS")
    assert meta.year == 2024 and meta.week == 15, "year/week must parse despite underscores"


def test_free_text_section_yields_no_race_metadata():
    meta = parse_section_name("MFE Systems checklist")
    assert (meta.year, meta.week, meta.season, meta.venue) == (None, None, None, None)
    assert meta.rounds == []


def test_slug_preserves_underscored_identifiers():
    # These codes are used verbatim by the team; keep them greppable.
    assert slugify("23W28_R13_R14_RME") == "23w28_r13_r14_rme"


def test_slug_separates_words_across_slashes():
    assert slugify("Día 1 — Ensayos/Libres") == "día-1-ensayos-libres"


def test_slug_never_empty():
    assert slugify("!!!") == "untitled"
