# Simulator KPI Tracker

An interactive tracker and dashboard for the 7-category, 22-KPI performance framework
proposed for a **Simulator Control Systems Engineer** role in a Formula 1 Controls &
Systems Group.

It is two things in one repository:

- **A pipeline** (`kpi_framework/`, pure-stdlib Python) that turns raw session, release
  and fault records into the scorecard — runnable on a laptop, a build agent, or in a
  Databricks notebook.
- **A dashboard** (`web/`, one self-contained HTML file) that renders that scorecard,
  lets you log records, edit targets, work the 30/60/90 checklist and print the
  one-page proposal — with no server, no build step and no dependencies.

The dashboard builds in two modes from the same sources:

| | `make build` — local | `make build-live` — live board |
|---|---|---|
| Records live in | this browser's `localStorage` | the artifact's shared store |
| Seeded with | eight months of sample records | nothing; it opens on whatever the board holds |
| Other people see your edits | no | yes, as they happen |
| Works as a plain file | yes | read-only shell; it needs its claude.ai link to reach the board |
| Can be shared publicly | yes | no — a store-backed artifact is organization-internal |

Same page either way: it asks for the shared store at load, and falls back to the local
copy when the answer is no.

Both compute every number with the same formulas. `tests/test_parity.py` runs the two
engines over the same records and fails if any value disagrees.

> **Every target in this repository is illustrative.** They are adapted from adjacent,
> well-established domains — reliability engineering (MTBF/MTTR/availability), DORA
> release metrics, software-quality defect KPIs, HIL test automation and model-coverage
> practice — because no public F1-specific benchmark for simulator uptime or engineer
> performance exists. Nothing here is confirmed practice at any team. The framework is a
> draft to align on with a manager during onboarding, not a mandate, and it is designed
> to stay off compensation and out of blame.

## Quick start

```bash
make build          # → dist/dashboard.html        (open it in any browser)
make build-live     # → dist/live-dashboard.html   (publish as an Artifact with db)
make compute        # → the scorecard as a terminal table
make test           # → 74 tests, including Python↔JavaScript engine parity
```

No pip install: Python 3.10+ standard library only. Node is needed only for the parity test.

## The framework

`framework/kpi_catalogue.json` and `framework/accountabilities.json` are the single
source of truth — both the Python pipeline and the browser app read them, so they cannot
drift apart. Editing the JSON changes the tool.

| Category | KPIs | Covers |
|---|---|---|
| C1 Simulator Reliability & Availability | Availability · Control-attributable session loss · MTBF/MTTR | A1 |
| C2 SECU Release Quality & Cadence | First-time-pass · Escaped defects · Lead time & buffer · HIL regression | A2, A5 |
| C3 Fault Diagnosis & Turnaround | In-session resolution time · Root-cause closure · Recurrence | A3, A7 |
| C4 System Familiarity & Model Fidelity | DIL-vs-car alignment · Baseline currency · Model coverage | A4, A6 |
| C5 Documentation & Knowledge Bridging | Difference catalogue · Freshness · SOP coverage | A6 |
| C6 Communication & Stakeholder Satisfaction | 360-style survey · Fidelity confidence · Debrief turnaround | A3, A7 |
| C7 Technical Development & Tooling | Delivery rate · Operator-effort reduction · CSG cross-tasks | A5, A8 |

Seven of the 22 are marked **headline** — the set to launch with. The other fifteen stay
in the appendix until collection is painless.

### Staged judgement

The tool refuses to score a KPI before it makes sense to:

| Programme day | What the dashboard shows |
|---|---|
| Before a KPI's phase begins | `Not yet active` |
| Day 0–60, target not yet agreed | `Baselining` — the value, with no verdict |
| Day 60+, or once a target is marked agreed | `On target` / `Watch` / `Off target` |

Set the programme start date in the header to switch this on; leave it blank and every
KPI is scored immediately.

## The live board

`make build-live` produces the page to publish as an Artifact with the `db` capability:

```python
capabilities = {"db": {"rules": [
    {"path": "",         "read": "interact", "write": "interact"},  # anyone admitted logs records
    {"path": "settings", "read": "interact", "write": "admin"},     # only editors move targets
]}}
```

Records become documents — one per row, in a collection per dataset (`sessions`,
`releases`, …) — and the page subscribes to each collection plus `settings/programme`,
`settings/checklist` and `settings/meta`. Settings deliberately do not live under
`config/`: that name is already a dataset. A session logged by anyone appears on every open
copy within moments, no reload. Targets, the headline set, the programme dates and the
rollout checklist are shared config; theme and filters stay per-viewer in
`localStorage`, because they are nobody else's business.

The store holds 5,000 documents. The Log tab shows the count against that budget, and a
`quota_exceeded` write surfaces as a plain sentence telling you to clear or archive.
Writes are serialized per document and a transient failure is retried once.

`web/store.js` is the whole of it: two backends behind one API, chosen at load by whether
`claude.use("db")` answers.

To fill a fresh board with the sample records (or any dataset directory),
`python scripts/make_seed_docs.py data/sample .seed` writes one JSON file per record and
prints the batch entries to hand to the ArtifactData tool, 50 at a time. The board then
shows a banner until the sample records are cleared.

## The dashboard

`dist/dashboard.html` is one file with no external requests (bar the Google Fonts
stylesheet, which degrades to system fonts offline). State lives in `localStorage`.

- **Overview** — rollout position, headline tiles with sparklines, what needs attention, all 22 by category.
- **Scorecard** — every KPI with value, target, status, trend and measurement method; star a KPI to move it in or out of the headline set.
- **Log data** — forms for all nine datasets, CSV import, recent-record editing. Numbers update as you type.
- **Rollout** — the five phases with working checklists.
- **Proposal** — the one-page draft for the Head of CSG, generated from your current targets and headline set. Print or save as PDF.

Click any KPI to open its detail panel: definition, formula, tooling, trend chart with
target and watch bands, companion metrics, and the full reading history.

## Recording data

Nine CSVs in one directory, all optional — a missing file is simply an empty dataset.

| File | One row per | Feeds |
|---|---|---|
| `sessions.csv` | booked DIL session | K1.1, K1.2, K1.3, K6.3 |
| `releases.csv` | SECU release package | K2.1, K2.2, K2.3, K2.4 |
| `faults.csv` | fault raised | K3.1, K3.2, K3.3 |
| `config.csv` | DIL-vs-car config audit | K4.1, K4.2 |
| `coverage.csv` | Simulink Coverage report | K4.3 |
| `documentation.csv` | documentation audit | K5.1, K5.2, K5.3 |
| `survey.csv` | rater group per round | K6.1, K6.2 |
| `correlation.csv` | channel per correlation check | K6.2 companion |
| `development.csv` | tool or workstream per quarter | K7.1, K7.2, K7.3 |

`data/sample/` holds eight months of **fictional** records so the dashboard can be
explored before real data exists. Regenerate them with `make sample`; they are
deterministic. Point `--data` at your own directory to use real ones.

Two rules worth knowing before you log anything:

- **Snapshot datasets** (`config`, `documentation`) describe a state, so the newest row
  in a period wins — they are never summed.
- **Survey groups under three raters** are excluded from the published figure and
  counted in a "below floor" companion metric, so anonymity survives a small team.

## Commands

```bash
python -m kpi_framework validate                      # structural check of the catalogue
python -m kpi_framework compute --data data/sample    # scorecard as a table
python -m kpi_framework export  --format csv --out dist/scorecard.csv
python -m kpi_framework build   --data data/sample --out dist/dashboard.html
```

Useful flags: `--start` (programme start date), `--as-of` (evaluate at a past date),
`--targets-agreed`, `--overrides overrides.json` (per-KPI target overrides, same shape
the dashboard writes).

## Layout

```
framework/     KPI catalogue + accountabilities and rollout phases (the source of truth)
kpi_framework/ ingest → metrics → scoring → payload → build, plus the CLI
web/           index.html + styles.css + engine.js + store.js + app.js, inlined at build
data/sample/   deterministic fictional records
scripts/       sample-data generator
tests/         74 tests, including cross-engine parity
```

### Changing a formula

Change it in **both** `kpi_framework/metrics.py` and `web/engine.js`, then run
`make test`. The parity test exists precisely to catch the half-done version.

## Caveats

- Targets and thresholds are illustrative; re-baseline them each quarter, and expect the
  first two quarters of a newly commissioned rig to move a lot.
- Qualitative KPIs (satisfaction, fidelity confidence) are directional signals, not
  precise measures, and should always be read alongside the hard operational ones.
- The role's accountabilities as encoded here are a condensed paraphrase; check them
  against the actual job description before sharing the proposal.
