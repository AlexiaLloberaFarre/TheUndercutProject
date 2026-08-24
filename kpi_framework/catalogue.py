"""Loads the framework definition — the single source of truth shared with the
browser app, so the dashboard and the Python pipeline can never drift apart."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

FRAMEWORK_DIR = Path(__file__).resolve().parent.parent / "framework"


@dataclass(frozen=True)
class Catalogue:
    kpis: list[dict[str, Any]]
    categories: list[dict[str, Any]]
    accountabilities: list[dict[str, Any]]
    phases: list[dict[str, Any]]
    meta: dict[str, Any]

    def kpi(self, key: str) -> dict[str, Any]:
        """Look a KPI up by id (K1.1) or slug (dil-availability)."""
        for k in self.kpis:
            if key in (k["id"], k["slug"]):
                return k
        raise KeyError(f"unknown KPI: {key}")

    def headline(self) -> list[dict[str, Any]]:
        return [k for k in self.kpis if k.get("headline")]

    def by_category(self, category_id: str) -> list[dict[str, Any]]:
        return [k for k in self.kpis if k["category"] == category_id]

    def phase(self, phase_id: str) -> dict[str, Any]:
        for p in self.phases:
            if p["id"] == phase_id:
                return p
        raise KeyError(f"unknown phase: {phase_id}")

    def metric_index(self) -> dict[str, dict[str, Any]]:
        """Every metric the framework references, primary and companion alike."""
        index: dict[str, dict[str, Any]] = {}
        for k in self.kpis:
            index[k["metric"]] = {"kpi": k["id"], "role": "primary", "unit": k["unit"]}
            for c in k.get("companions", []):
                index.setdefault(c["metric"], {"kpi": k["id"], "role": "companion", "unit": c.get("unit", "")})
        return index


def load_catalogue(framework_dir: Path | str = FRAMEWORK_DIR) -> Catalogue:
    d = Path(framework_dir)
    kpi_doc = json.loads((d / "kpi_catalogue.json").read_text())
    acc_doc = json.loads((d / "accountabilities.json").read_text())
    return Catalogue(
        kpis=kpi_doc["kpis"],
        categories=kpi_doc["categories"],
        accountabilities=acc_doc["accountabilities"],
        phases=acc_doc["phases"],
        meta={
            "version": kpi_doc["version"],
            "status": kpi_doc["status"],
            "disclaimer": kpi_doc["disclaimer"],
            "role": acc_doc["role"],
            "group": acc_doc["group"],
            "accountability_note": acc_doc["note"],
        },
    )


def validate(cat: Catalogue) -> list[str]:
    """Structural checks — run in CI so a hand-edited catalogue can't ship broken."""
    problems: list[str] = []
    cat_ids = {c["id"] for c in cat.categories}
    acc_ids = {a["id"] for a in cat.accountabilities}
    phase_ids = {p["id"] for p in cat.phases}
    seen_ids: set[str] = set()
    seen_slugs: set[str] = set()
    seen_metrics: set[str] = set()

    for k in cat.kpis:
        where = k.get("id", "<no id>")
        for field in ("id", "slug", "name", "category", "metric", "unit", "direction",
                      "target", "amber", "what", "why", "method", "formula", "cadence", "phase"):
            if field not in k:
                problems.append(f"{where}: missing field '{field}'")
        if k["id"] in seen_ids:
            problems.append(f"{where}: duplicate id")
        if k.get("slug") in seen_slugs:
            problems.append(f"{where}: duplicate slug")
        if k.get("metric") in seen_metrics:
            problems.append(f"{where}: duplicate metric '{k.get('metric')}'")
        seen_ids.add(k["id"])
        seen_slugs.add(k.get("slug", ""))
        seen_metrics.add(k.get("metric", ""))
        if k.get("category") not in cat_ids:
            problems.append(f"{where}: unknown category {k.get('category')}")
        if k.get("phase") not in phase_ids:
            problems.append(f"{where}: unknown phase {k.get('phase')}")
        for a in k.get("accountabilities", []):
            if a not in acc_ids:
                problems.append(f"{where}: unknown accountability {a}")
        if k.get("direction") not in ("up", "down"):
            problems.append(f"{where}: direction must be 'up' or 'down'")
        elif k["direction"] == "up" and k["amber"] > k["target"]:
            problems.append(f"{where}: amber must sit below target for an 'up' KPI")
        elif k["direction"] == "down" and k["amber"] < k["target"]:
            problems.append(f"{where}: amber must sit above target for a 'down' KPI")
        if k.get("period") not in ("month", "quarter"):
            problems.append(f"{where}: period must be 'month' or 'quarter'")

    covered = {a for k in cat.kpis for a in k.get("accountabilities", [])}
    for a in sorted(acc_ids - covered):
        problems.append(f"accountability {a} is not covered by any KPI")
    return problems
