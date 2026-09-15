"""Command line for the KPI framework.

    python -m kpi_framework validate
    python -m kpi_framework compute --data data/sample
    python -m kpi_framework build   --data data/sample --out dist/dashboard.html
    python -m kpi_framework export  --data data/sample --format csv
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from datetime import date
from pathlib import Path

from .build import build_html
from .catalogue import load_catalogue, validate
from .ingest import read_dataset_dir
from .metrics import compute_all
from .payload import build_payload, dumps, flat_scorecard
from .scoring import Programme, scorecard

STATUS_MARK = {"on-target": "GREEN", "watch": "YELLOW", "off-target": "RED",
               "baseline": "base", "pending": "—", "no-data": "n/a"}
TREND_MARK = {"improving": "better", "worsening": "worse", "flat": "flat", "new": "new"}


def _programme(args: argparse.Namespace) -> Programme:
    overrides = {}
    if getattr(args, "overrides", None):
        overrides = json.loads(Path(args.overrides).read_text())
    return Programme(
        start_date=date.fromisoformat(args.start) if args.start else None,
        as_of=date.fromisoformat(args.as_of) if args.as_of else None,
        targets_agreed=bool(getattr(args, "targets_agreed", False)),
        overrides=overrides,
    )


def _fmt(value: float | None, decimals: int) -> str:
    return "—" if value is None else f"{value:,.{decimals}f}"


def cmd_validate(args: argparse.Namespace) -> int:
    cat = load_catalogue()
    problems = validate(cat)
    for p in problems:
        print(f"  ✗ {p}", file=sys.stderr)
    if problems:
        print(f"{len(problems)} problem(s) in the catalogue", file=sys.stderr)
        return 1
    print(f"catalogue OK — {len(cat.kpis)} KPIs across {len(cat.categories)} categories, "
          f"{len(cat.headline())} headline, all {len(cat.accountabilities)} accountabilities covered")
    return 0


def cmd_compute(args: argparse.Namespace) -> int:
    cat = load_catalogue()
    data = read_dataset_dir(args.data)
    programme = _programme(args)
    card = scorecard(cat, compute_all(data), programme)

    day = card["programme_day"]
    print(f"Programme day {day if day is not None else '—'}  ·  phase {card['phase'] or '—'}  ·  "
          f"{card['coverage_pct']:.0f}% of KPIs have data")
    print()
    width = max(len(k["name"]) for k in cat.kpis)
    for category in cat.categories:
        print(f"{category['id']}  {category['name']}")
        for kpi in cat.by_category(category["id"]):
            s = card["series"][kpi["id"]]
            flag = "*" if s["headline"] else " "
            print(f"  {flag} {kpi['id']:<5} {kpi['name']:<{width}}  "
                  f"{_fmt(s['latest'], kpi['decimals']):>9} {kpi['unit']:<9} "
                  f"target {_fmt(s['target'], kpi['decimals']):>7}  "
                  f"{STATUS_MARK.get(s['status'], s['status']):<6} "
                  f"{TREND_MARK.get(s['trend']['verdict'], ''):<6} {s['latest_period'] or ''}")
        print()
    counts = card["counts"]
    print("  ".join(f"{STATUS_MARK.get(k, k)}={v}" for k, v in sorted(counts.items())))
    print("\n* = headline KPI. Targets are illustrative until agreed with the Head of CSG.")
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    cat = load_catalogue()
    data = read_dataset_dir(args.data)
    programme = _programme(args)
    rows = flat_scorecard(cat, data, programme)
    if args.format == "json":
        out = json.dumps({"scorecard": rows}, indent=2)
    else:
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
        out = buf.getvalue()
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(out)
        print(f"wrote {args.out}")
    else:
        print(out)
    return 0


def cmd_build(args: argparse.Namespace) -> int:
    cat = load_catalogue()
    problems = validate(cat)
    if problems:
        print("refusing to build — catalogue has problems; run `validate`", file=sys.stderr)
        return 1
    data = read_dataset_dir(args.data) if args.data else {}
    programme = _programme(args)
    payload = build_payload(cat, data, programme, seeded_from=str(args.data or "empty"), mode=args.mode)
    html = build_html(dumps(payload), title=args.title)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    seeded = 0 if args.mode == "live" else sum(len(rows) for rows in data.values())
    detail = "reads its records from the shared store" if args.mode == "live" else f"{seeded} seeded records"
    print(f"wrote {out}  ({len(html) / 1024:.0f} KB, {detail})")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="kpi_framework", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    def add_common(p: argparse.ArgumentParser, *, needs_data: bool = True) -> None:
        if needs_data:
            p.add_argument("--data", default="data/sample", help="directory of dataset CSVs")
        p.add_argument("--start", help="programme start date, ISO (e.g. 2026-01-06)")
        p.add_argument("--as-of", dest="as_of", help="evaluate as at this date, ISO")
        p.add_argument("--targets-agreed", action="store_true",
                       help="score against targets even before day 60")
        p.add_argument("--overrides", help="JSON file of per-KPI target overrides")

    p_validate = sub.add_parser("validate", help="structural check of the KPI catalogue")
    p_validate.set_defaults(func=cmd_validate)

    p_compute = sub.add_parser("compute", help="print the scorecard as a table")
    add_common(p_compute)
    p_compute.set_defaults(func=cmd_compute)

    p_export = sub.add_parser("export", help="write the scorecard as csv or json")
    add_common(p_export)
    p_export.add_argument("--format", choices=("csv", "json"), default="csv")
    p_export.add_argument("--out", help="output path (default: stdout)")
    p_export.set_defaults(func=cmd_export)

    p_build = sub.add_parser("build", help="build the self-contained dashboard")
    add_common(p_build)
    p_build.add_argument("--out", default="dist/dashboard.html")
    p_build.add_argument("--mode", choices=("local", "live"), default="local",
                         help="'live' builds for the shared Artifact store: no records baked in")
    p_build.add_argument("--title", help="override the page title (it names the published artifact)")
    p_build.set_defaults(func=cmd_build)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
