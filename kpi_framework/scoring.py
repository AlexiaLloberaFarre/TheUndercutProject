"""Turns metric values into a scorecard: status against target, trend against
the previous period, and the programme phase that decides whether a target
should be judged at all yet."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from .catalogue import Catalogue

# Status ids. The UI labels these with the flag vernacular the pit wall already
# uses (green / yellow / red), plus two states that mean "don't judge this yet".
ON_TARGET = "on-target"
WATCH = "watch"
OFF_TARGET = "off-target"
BASELINE = "baseline"     # measured, but targets not agreed yet (days 0–60)
PENDING = "pending"       # KPI's phase hasn't started
NO_DATA = "no-data"

# Recommendation 1 of the framework: present a measurement plan first, targets
# only from day 60. Until then everything reads as a baseline, not a score.
TARGET_JUDGEMENT_DAY = 60
FLAT_BAND = 0.02  # relative change below this reads as flat, not a trend


@dataclass
class Programme:
    """Where the engineer is in the 30/60/90 rollout."""
    start_date: date | None = None
    as_of: date | None = None
    targets_agreed: bool = False
    overrides: dict[str, dict[str, Any]] = field(default_factory=dict)

    @property
    def day(self) -> int | None:
        if self.start_date is None:
            return None
        return ((self.as_of or date.today()) - self.start_date).days

    def phase_id(self, cat: Catalogue) -> str | None:
        day = self.day
        if day is None:
            return None
        for phase in cat.phases:
            end = phase["end_day"]
            if day >= phase["start_day"] and (end is None or day < end):
                return phase["id"]
        return cat.phases[-1]["id"]


def resolve(kpi: dict[str, Any], programme: Programme) -> dict[str, Any]:
    """A KPI with the user's own target/amber/headline choices applied."""
    merged = dict(kpi)
    merged.update(programme.overrides.get(kpi["id"], {}))
    return merged


def _phase_started(kpi: dict[str, Any], cat: Catalogue, programme: Programme) -> bool:
    day = programme.day
    if day is None:
        return True
    return day >= cat.phase(kpi["phase"])["start_day"]


def status_for(value: float | None, direction: str, target: float, amber: float) -> str:
    if value is None:
        return NO_DATA
    if direction == "up":
        if value >= target:
            return ON_TARGET
        return WATCH if value >= amber else OFF_TARGET
    if value <= target:
        return ON_TARGET
    return WATCH if value <= amber else OFF_TARGET


def kpi_status(kpi: dict[str, Any], value: float | None, cat: Catalogue, programme: Programme) -> str:
    """Judgement is gated: a KPI whose phase hasn't started is pending, and
    nothing is scored against an illustrative target before day 60."""
    if not _phase_started(kpi, cat, programme):
        return PENDING
    if value is None:
        return NO_DATA
    resolved = resolve(kpi, programme)
    agreed = bool(resolved.get("target_agreed", programme.targets_agreed))
    day = programme.day
    if not agreed and day is not None and day < TARGET_JUDGEMENT_DAY:
        return BASELINE
    return status_for(value, resolved["direction"], float(resolved["target"]), float(resolved["amber"]))


def trend_for(current: float | None, previous: float | None, direction: str) -> dict[str, Any]:
    """Direction-aware: falling fault-resolution time is an improvement."""
    if current is None or previous is None:
        return {"delta": None, "pct": None, "verdict": "new"}
    delta = current - previous
    pct = (delta / abs(previous) * 100.0) if previous else None
    if pct is not None and abs(pct) < FLAT_BAND * 100:
        verdict = "flat"
    elif delta == 0:
        verdict = "flat"
    else:
        improving = delta > 0 if direction == "up" else delta < 0
        verdict = "improving" if improving else "worsening"
    return {"delta": delta, "pct": pct, "verdict": verdict}


def build_series(kpi: dict[str, Any], tables: dict[str, dict[str, dict[str, float | None]]],
                 cat: Catalogue, programme: Programme) -> dict[str, Any]:
    """Full history for one KPI: every period, its value, and its status."""
    resolved = resolve(kpi, programme)
    period = resolved.get("period", "month")
    table = tables.get(period, {})
    points = []
    for period_key, metrics in table.items():
        value = metrics.get(resolved["metric"])
        points.append({
            "period": period_key,
            "value": value,
            "status": kpi_status(kpi, value, cat, programme),
        })
    observed = [p for p in points if p["value"] is not None]
    latest = observed[-1] if observed else None
    previous = observed[-2] if len(observed) > 1 else None

    companions = []
    for companion in resolved.get("companions", []):
        c_direction = companion.get("direction")
        c_points = [
            {"period": key, "value": metrics.get(companion["metric"])}
            for key, metrics in table.items()
        ]
        c_observed = [p for p in c_points if p["value"] is not None]
        c_latest = c_observed[-1]["value"] if c_observed else None
        c_status = None
        if c_direction and "target" in companion and c_latest is not None:
            gate = kpi_status(kpi, c_latest, cat, programme)
            c_status = gate if gate in (PENDING, BASELINE) else status_for(
                c_latest, c_direction, float(companion["target"]), float(companion["amber"]))
        companions.append({
            **companion,
            "latest": c_latest,
            "status": c_status,
            "points": c_points,
        })

    return {
        "id": kpi["id"],
        "period": period,
        "points": points,
        "latest": latest["value"] if latest else None,
        "latest_period": latest["period"] if latest else None,
        "previous": previous["value"] if previous else None,
        "status": kpi_status(kpi, latest["value"] if latest else None, cat, programme),
        "trend": trend_for(latest["value"] if latest else None,
                           previous["value"] if previous else None,
                           resolved["direction"]),
        "target": resolved["target"],
        "amber": resolved["amber"],
        "target_agreed": bool(resolved.get("target_agreed", programme.targets_agreed)),
        "headline": bool(resolved.get("headline", kpi.get("headline"))),
        "companions": companions,
    }


def scorecard(cat: Catalogue, tables: dict[str, dict[str, dict[str, float | None]]],
              programme: Programme) -> dict[str, Any]:
    series = {kpi["id"]: build_series(kpi, tables, cat, programme) for kpi in cat.kpis}
    counts: dict[str, int] = {}
    for s in series.values():
        counts[s["status"]] = counts.get(s["status"], 0) + 1
    headline_ids = [k["id"] for k in cat.kpis if series[k["id"]]["headline"]]
    measurable = [s for s in series.values() if s["latest"] is not None]
    return {
        "series": series,
        "counts": counts,
        "headline_ids": headline_ids,
        "coverage_pct": len(measurable) / len(cat.kpis) * 100 if cat.kpis else 0.0,
        "programme_day": programme.day,
        "phase": programme.phase_id(cat),
    }
