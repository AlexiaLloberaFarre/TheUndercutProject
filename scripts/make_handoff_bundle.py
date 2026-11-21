#!/usr/bin/env python3
"""Assembles a self-sufficient folder of the KPI tracker for someone to keep
locally — dashboard, scorecard, framework reference, sample data and the tools
to regenerate all of it.

    python scripts/make_handoff_bundle.py "build/Team Manager"

Everything in the folder works offline except the live-board shortcut.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from kpi_framework.catalogue import load_catalogue  # noqa: E402

LIVE_BOARD = "https://claude.ai/artifact/5RgGZFr3TZVjxgKHJCzbC5"
PROGRAMME_START = "2026-01-06"


def run(*args: str) -> None:
    subprocess.run(args, check=True, cwd=ROOT, stdout=subprocess.DEVNULL)


def kpi_reference(cat) -> str:
    """The full 22-KPI appendix, readable without opening the dashboard."""
    acc = {a["id"]: a for a in cat.accountabilities}
    lines = [
        "# The 22-KPI framework — full reference",
        "",
        f"Simulator Control Systems Engineer · {cat.meta['group']}  ",
        f"Generated {date.today().isoformat()} from `Framework/kpi_catalogue.json`.",
        "",
        "> **Every target below is illustrative.** They are adapted from reliability",
        "> engineering (MTBF/MTTR/availability), DORA release metrics, software-quality",
        "> defect KPIs, HIL test automation and model-coverage practice, because no public",
        "> F1-specific benchmark exists. None is confirmed practice at any team. Baseline",
        "> them against real systems before treating any of them as a target.",
        "",
        "## The eight accountabilities",
        "",
    ]
    for a in cat.accountabilities:
        covering = [k["id"] for k in cat.kpis if a["id"] in k["accountabilities"]]
        lines.append(f"- **{a['id']} — {a['short']}.** {a['text']}  ")
        lines.append(f"  Covered by: {', '.join(covering)}")
    lines += ["", "## The rollout", ""]
    for p in cat.phases:
        lines.append(f"**{p['id']} · {p['name']} ({p['window']})** — {p['intent']}  ")
        lines.append(f"Deliverable: *{p['deliverable']}*")
        lines.append("")

    for category in cat.categories:
        lines += [f"## {category['id']} · {category['name']}", "", f"*{category['intent']}*", ""]
        for k in cat.by_category(category["id"]):
            headline = " · **headline**" if k.get("headline") else ""
            direction = "at least" if k["direction"] == "up" else "at most"
            unit = "" if k["unit"] in ("", "%") else f" {k['unit']}"
            suffix = "%" if k["unit"] == "%" else unit
            lines += [
                f"### {k['id']} — {k['name']}{headline}",
                "",
                f"**What** · {k['what']}",
                "",
                f"**Why** · {k['why']}",
                "",
                f"**How measured** · {k['method']}",
                "",
                f"**Formula** · `{k['formula']}`",
                "",
                f"**Proposed target** · {direction} {k['target']:g}{suffix} "
                f"(watch threshold {k['amber']:g}{suffix}) — illustrative",
                "",
                f"**Cadence** · {k['cadence']}",
                "",
                f"**Tooling** · {', '.join(k['tools'])}",
                "",
                f"**Accountabilities** · "
                + ", ".join(f"{a} {acc[a]['short']}" for a in k["accountabilities"]),
                "",
                f"**Source data** · `Sample data/{k['dataset']}.csv`  ·  "
                f"**Live from** · {next(p['window'] for p in cat.phases if p['id'] == k['phase'])}",
                "",
            ]
            if k.get("note"):
                lines += [f"> {k['note']}", ""]
            if k.get("companions"):
                lines.append("Read alongside: "
                             + ", ".join(c["name"] for c in k["companions"]) + ".")
                lines.append("")
    return "\n".join(lines)


def start_here(cat) -> str:
    headline = [k for k in cat.kpis if k.get("headline")]
    return f"""# Simulator KPI tracker — start here

A 7-category, 22-KPI performance framework for a Simulator Control Systems Engineer
role, as a working tool rather than a document. Updated {date.today().isoformat()}.

## What to open

| File | What it is |
|---|---|
| **Simulator KPI dashboard.html** | The tracker. Double-click it — any browser, no install, works offline. Log records, edit targets, work the rollout checklist, print the proposal. |
| **Proposal.pdf** | The draft to put in front of a Head of CSG — the proposal on page 1, the rollout and the asks on page 2. Generated from the dashboard's Proposal tab, so it reflects whatever targets and headline set the dashboard currently holds. |
| **Scorecard.csv** | One row per KPI — value, target, status, trend — for pasting into a review pack. |
| **Live board.url** | The shared online version. Records logged there are visible to everyone you share it with and update live. Needs you to be signed in. |

## What is in the subfolders

- **Framework/** — the KPI catalogue as JSON (the single source of truth both the
  dashboard and the pipeline read) plus `KPI reference.md`, the full 22-KPI appendix
  in readable form.
- **Sample data/** — nine CSVs holding eight months of **fictional** records, so the
  dashboard has something to show. Replace them with real ones when you have them.
- **Tools/** — the Python pipeline that turns records into the scorecard, plus how to
  regenerate everything. Only needed if you want to rebuild from new data.

## The two things to know before showing anyone

1. **Every target is illustrative.** They are adapted from reliability engineering,
   DORA release metrics and software-quality practice, because no public F1-specific
   benchmark exists. None is confirmed practice at any team. They are a starting point
   to agree with a manager, not a standard to be held to.
2. **All the records shipped here are fictional.** They exist to make the dashboard
   demonstrable. Nothing in this folder is real team data.

## The headline set

The framework proposes launching with {len(headline)} of the 22, not all of them:

{chr(10).join(f"- **{k['id']} {k['name']}** — {k['cadence'].lower()}" for k in headline)}

The remaining {len(cat.kpis) - len(headline)} stay in the appendix until collection is painless.

## Staged judgement

Set a programme start date in the dashboard header and it stops scoring KPIs before it
makes sense to: *not yet active* before a KPI's phase begins, *baselining* before day 60
with an unagreed target, and only then on-target / watch / off-target. That mirrors the
framework's own advice — measure first, judge later.
"""


def how_to_regenerate() -> str:
    return f"""# Regenerating everything

Python 3.10+ standard library only — no install step.

```bash
python -m kpi_framework build   --data "../Sample data" --start {PROGRAMME_START} --out dashboard.html
python -m kpi_framework export  --data "../Sample data" --format csv --out scorecard.csv
python -m kpi_framework compute --data "../Sample data"      # the scorecard as a table
python -m kpi_framework validate                             # check the catalogue
```

Run them from inside this `Tools/` folder.

## Using your own records

Point `--data` at a directory of your own CSVs with the same column names as
`Sample data/`. Every file is optional — a missing one is simply an empty dataset,
which is how the framework is meant to be adopted: one KPI at a time.

Two rules worth knowing:

- **Snapshot datasets** (`config`, `documentation`) describe a state, so the newest row
  in a period wins. They are never summed.
- **Survey groups under three raters** are excluded from the published figure and
  counted separately, so anonymity survives a small team.

## Changing a KPI

Edit `../Framework/kpi_catalogue.json` — both the dashboard and the pipeline read it,
so they cannot drift apart. Run `python -m kpi_framework validate` afterwards, then
rebuild.

Changing a *formula* means editing both `kpi_framework/metrics.py` and
`web/engine.js` in the source repository; a test there fails if only one is changed.

## The source repository

Full source, tests and history: the `claude/simulator-kpi-framework-rbif84` branch of
TheUndercutProject. This folder is a snapshot of its build output.
"""


def main(out: str = "build/Team Manager") -> int:
    cat = load_catalogue()
    dest = ROOT / out
    shutil.rmtree(dest, ignore_errors=True)
    (dest / "Framework").mkdir(parents=True)
    (dest / "Sample data").mkdir()
    (dest / "Tools").mkdir()

    run(sys.executable, "-m", "kpi_framework", "build",
        "--data", "data/sample", "--start", PROGRAMME_START, "--out", "dist/dashboard.html")
    run(sys.executable, "-m", "kpi_framework", "export",
        "--data", "data/sample", "--start", PROGRAMME_START, "--targets-agreed",
        "--format", "csv", "--out", "dist/scorecard.csv")

    shutil.copy(ROOT / "dist" / "dashboard.html", dest / "Simulator KPI dashboard.html")
    shutil.copy(ROOT / "dist" / "scorecard.csv", dest / "Scorecard.csv")
    (dest / "Live board.url").write_bytes(
        f"[InternetShortcut]\r\nURL={LIVE_BOARD}\r\n".encode())

    (dest / "START HERE.md").write_text(start_here(cat), encoding="utf-8")
    (dest / "Framework" / "KPI reference.md").write_text(kpi_reference(cat), encoding="utf-8")
    for name in ("kpi_catalogue.json", "accountabilities.json"):
        shutil.copy(ROOT / "framework" / name, dest / "Framework" / name)
    for csv_path in sorted((ROOT / "data" / "sample").glob("*.csv")):
        shutil.copy(csv_path, dest / "Sample data" / csv_path.name)

    shutil.copytree(ROOT / "kpi_framework", dest / "Tools" / "kpi_framework",
                    ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copytree(ROOT / "framework", dest / "Tools" / "framework")
    shutil.copytree(ROOT / "web", dest / "Tools" / "web")
    (dest / "Tools" / "scripts").mkdir()
    for script in ("make_sample_data.py", "make_seed_docs.py"):
        shutil.copy(ROOT / "scripts" / script, dest / "Tools" / "scripts" / script)
    (dest / "Tools" / "How to regenerate.md").write_text(how_to_regenerate(), encoding="utf-8")

    files = sorted(p for p in dest.rglob("*") if p.is_file())
    print(f"{dest}: {len(files)} files, {sum(p.stat().st_size for p in files) / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(*sys.argv[1:]))
