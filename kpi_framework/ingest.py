"""CSV in, typed records out. Stdlib only, so this runs anywhere — a laptop, a
build agent, or a Databricks notebook — without an install step."""

from __future__ import annotations

import csv
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable

DATASETS = ("sessions", "releases", "faults", "config", "coverage",
            "documentation", "survey", "correlation", "development")

# Columns parsed as numbers, datetimes and booleans. Anything unlisted stays a
# string, so extra site-specific columns pass through untouched.
NUMERIC = {
    "scheduled_minutes", "productive_minutes", "control_faults", "fault_restore_minutes",
    "debrief_usefulness", "defects_pre_release", "escaped_sev1", "escaped_sev2",
    "escaped_sev3", "hil_cases_run", "hil_cases_passed", "functions_total",
    "functions_automated", "sla_days", "tracked_items", "matched_items",
    "documented_diffs", "undocumented_diffs", "decision_pct", "condition_pct",
    "mcdc_pct", "signal_range_pct", "differences_identified", "differences_documented",
    "pages_total", "pages_fresh", "procedures_identified", "sops_signed_off",
    "respondents", "clarity", "responsiveness", "fidelity_confidence", "overall",
    "sim_vs_track_delta_pct", "items_committed", "items_delivered",
    "setup_minutes_before", "setup_minutes_after", "config_errors_before",
    "config_errors_after", "cross_tasks",
}
DATETIMES = {"raised_at", "resolved_at", "root_cause_closed_at", "spec_frozen_at",
             "validated_at", "event_at"}
DATES = {"date", "car_release_date", "dil_baseline_date"}
BOOLEANS = {"session_day_intervention", "rollback", "in_session", "debrief_due",
            "debrief_on_time"}

TRUE = {"1", "true", "yes", "y", "t"}
FALSE = {"0", "false", "no", "n", "f", ""}


class IngestError(ValueError):
    """Raised with the file and row number, so a bad cell is findable."""


def _parse_cell(column: str, raw: str, where: str) -> Any:
    value = (raw or "").strip()
    try:
        if column in NUMERIC:
            return float(value) if value else None
        if column in BOOLEANS:
            low = value.lower()
            if low in TRUE:
                return True
            if low in FALSE:
                return False
            raise ValueError(f"{value!r} is not a boolean")
        if column in DATETIMES:
            return datetime.fromisoformat(value) if value else None
        if column in DATES:
            return date.fromisoformat(value) if value else None
    except ValueError as exc:
        raise IngestError(f"{where}: column '{column}' — {exc}") from exc
    return value


def read_csv(path: Path | str) -> list[dict[str, Any]]:
    path = Path(path)
    rows: list[dict[str, Any]] = []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        for line_no, raw_row in enumerate(csv.DictReader(fh), start=2):
            where = f"{path.name}:{line_no}"
            rows.append({col: _parse_cell(col, val, where) for col, val in raw_row.items() if col})
    return rows


def read_dataset_dir(directory: Path | str) -> dict[str, list[dict[str, Any]]]:
    """Read every known dataset present in a directory. Missing files are simply
    empty datasets — the framework is designed to be adopted a KPI at a time."""
    directory = Path(directory)
    data: dict[str, list[dict[str, Any]]] = {}
    for name in DATASETS:
        path = directory / f"{name}.csv"
        data[name] = read_csv(path) if path.exists() else []
    return data


def row_date(row: dict[str, Any]) -> date | None:
    """The date a record belongs to, whichever column carries it."""
    for column in ("date", "event_at", "raised_at"):
        value = row.get(column)
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
    return None


def period_key(when: date, period: str) -> str:
    if period == "quarter":
        return f"{when.year}-Q{(when.month - 1) // 3 + 1}"
    return f"{when.year}-{when.month:02d}"


def group_by_period(rows: Iterable[dict[str, Any]], period: str) -> dict[str, list[dict[str, Any]]]:
    buckets: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        when = row_date(row)
        if when is None:
            continue
        buckets.setdefault(period_key(when, period), []).append(row)
    return dict(sorted(buckets.items()))
