"""Builds the JSON blob the browser app runs on: the framework definition plus
the raw records, so the dashboard can recompute everything client-side after an
edit — no server, no round trip."""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

from .catalogue import Catalogue
from .metrics import compute_all
from .scoring import Programme, scorecard


def _jsonable(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat(timespec="minutes")
    if isinstance(value, date):
        return value.isoformat()
    return value


def serialise_datasets(data: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    return {name: [{k: _jsonable(v) for k, v in row.items()} for row in rows]
            for name, rows in data.items()}


def build_payload(cat: Catalogue, data: dict[str, list[dict[str, Any]]],
                  programme: Programme, *, seeded_from: str = "") -> dict[str, Any]:
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "seeded_from": seeded_from,
        "meta": cat.meta,
        "categories": cat.categories,
        "accountabilities": cat.accountabilities,
        "phases": cat.phases,
        "kpis": cat.kpis,
        "datasets": serialise_datasets(data),
        "programme": {
            "start_date": programme.start_date.isoformat() if programme.start_date else None,
            "as_of": programme.as_of.isoformat() if programme.as_of else None,
            "targets_agreed": programme.targets_agreed,
            "overrides": programme.overrides,
        },
    }


def flat_scorecard(cat: Catalogue, data: dict[str, list[dict[str, Any]]],
                   programme: Programme) -> list[dict[str, Any]]:
    """One row per KPI — the shape you paste into a review pack."""
    card = scorecard(cat, compute_all(data), programme)
    rows = []
    for kpi in cat.kpis:
        s = card["series"][kpi["id"]]
        rows.append({
            "id": kpi["id"],
            "kpi": kpi["name"],
            "category": next(c["name"] for c in cat.categories if c["id"] == kpi["category"]),
            "accountabilities": " ".join(kpi["accountabilities"]),
            "headline": s["headline"],
            "period": s["latest_period"] or "",
            "value": s["latest"],
            "unit": kpi["unit"],
            "target": s["target"],
            "amber": s["amber"],
            "target_agreed": s["target_agreed"],
            "status": s["status"],
            "trend": s["trend"]["verdict"],
            "cadence": kpi["cadence"],
            "measured_by": kpi["method"],
        })
    return rows


def dumps(payload: dict[str, Any]) -> str:
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
