"""Parsers for the section-naming convention used in the Formula E notebooks.

Observed section names follow a loose pattern, e.g.

    24W11_S10R04_SAO        year 24, week 11, season 10, round 04, Sao Paulo
    23W28_R13_R14_RME       year 23, week 28, rounds 13 and 14, Rome
    23W21_T13_CAL           year 23, week 21, track test 13, Calafat
    23W43_CT18_VLC          year 23, week 43, CT 18, Valencia
    S09_23W24_CRITT         season 09, year 23, week 24, CRITT (dyno)

The parser is deliberately forgiving: anything it cannot read is left as None
rather than raising, so a malformed section name never aborts an export.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

# Names are underscore-delimited, so we match whole tokens rather than using \b
# (underscore is a word character, so \b never fires between '11' and '_').
# 24W11 — two-digit year, 'W', ISO week.
_YEARWEEK = re.compile(r"^(\d{2})W(\d{1,2})$", re.IGNORECASE)
# S10R04 — season and round in one token.
_SEASON_ROUND = re.compile(r"^S(\d{2})R(\d{1,2})$", re.IGNORECASE)
# S09 — bare season token.
_SEASON = re.compile(r"^S(\d{2})$", re.IGNORECASE)
# R13 / T13 / CT18 — standalone round, track test, combined test.
_SESSION = re.compile(r"^(CT|R|T)(\d{1,2})$", re.IGNORECASE)
# A purely alphabetic 3+ token is the venue or facility (SAO, RME, CRITT).
_VENUE = re.compile(r"^([A-Z]{3,})$")

SESSION_KINDS = {"R": "race", "T": "track_test", "CT": "combined_test"}


@dataclass
class SectionMeta:
    """What we could read out of a section name."""

    raw: str
    year: int | None = None
    week: int | None = None
    season: int | None = None
    rounds: list[int] = field(default_factory=list)
    session_kind: str | None = None
    venue: str | None = None

    def as_dict(self) -> dict:
        return asdict(self)

    @property
    def sort_key(self) -> tuple:
        """Chronological-ish ordering, unparsed names last."""
        return (
            self.year if self.year is not None else 99,
            self.week if self.week is not None else 99,
            self.raw,
        )


def parse_section_name(name: str) -> SectionMeta:
    """Read what we can out of an underscore-delimited section name.

    Unrecognised tokens are ignored, and a name that matches nothing (a
    free-text section like 'MFE Systems checklist') comes back all-None.
    """
    meta = SectionMeta(raw=name)

    for token in name.split("_"):
        token = token.strip()
        if not token:
            continue

        if match := _YEARWEEK.match(token):
            meta.year = 2000 + int(match.group(1))
            meta.week = int(match.group(2))
            continue

        # S10R04 is more specific than a bare S10, so test it first.
        if match := _SEASON_ROUND.match(token):
            meta.season = int(match.group(1))
            meta.rounds.append(int(match.group(2)))
            meta.session_kind = "race"
            continue

        if match := _SEASON.match(token):
            meta.season = int(match.group(1))
            continue

        if match := _SESSION.match(token):
            kind = match.group(1).upper()
            meta.rounds.append(int(match.group(2)))
            # A doubleheader is 'R13_R14': keep the first kind we saw.
            meta.session_kind = meta.session_kind or SESSION_KINDS[kind]
            continue

        if match := _VENUE.match(token):
            # Later alphabetic tokens win; the venue is conventionally last.
            meta.venue = match.group(1)

    meta.rounds = sorted(set(meta.rounds))
    return meta


def slugify(text: str, *, max_length: int = 80) -> str:
    """Filesystem-safe, stable slug. Stable matters: it keeps git diffs small.

    Underscores are preserved deliberately. Section names like
    '23W28_R13_R14_RME' are identifiers the team uses verbatim, so the directory
    stays greppable against them (case-insensitively) rather than becoming
    '23w28-r13-r14-rme'.
    """
    # Turn path-ish separators into spaces first, so 'Ensayos/Libres' does not
    # collapse into one word.
    cleaned = re.sub(r"[/\\|:–—]+", " ", text)
    cleaned = re.sub(r"[^\w\s-]", "", cleaned, flags=re.UNICODE).strip()
    cleaned = re.sub(r"\s+", "-", cleaned)
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-_")
    return (cleaned[:max_length].rstrip("-_") or "untitled").lower()
