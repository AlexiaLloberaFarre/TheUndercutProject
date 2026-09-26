# TheUndercutProject

Pulls Formula E race-engineering notes out of OneNote into Markdown, so several
seasons of notebooks become something you can grep, query and compare instead of
click through.

## Quick start

```bash
pip install -r requirements.txt
export ONENOTE_CLIENT_ID='<your Azure app registration client id>'

python tools/onenote_export.py --inventory   # count pages, download nothing
python tools/onenote_export.py               # full export
```

First run prints a device code to paste into a browser; after that the cached
refresh token makes it non-interactive.

Setup details, including the Azure app registration, are in
[docs/EXTRACTION.md](docs/EXTRACTION.md).

## How it works

`tools/onenote_export.py` walks the OneNote tree over Microsoft Graph —
notebooks, then section groups recursively, then sections, then pages — and
writes one Markdown file per page with YAML front matter carrying the notebook
path, timestamps, and the season/round/venue parsed out of the section name.

Three details that make the output usable rather than merely present:

- **Reading order is reconstructed.** OneNote's API returns one absolutely
  positioned block per text box in arbitrary order. Blocks are sorted by canvas
  coordinates so a page reads top to bottom instead of interleaving separate
  notes.
- **Binaries are fetched, not linked.** Image URLs in the API's HTML need an
  auth header, so they are downloaded into `assets/` and the references
  rewritten to relative paths.
- **Exports are incremental.** `notes/.manifest.json` tracks each page's last
  modified time, so `--since-last-run` picks up only what changed.

## Tests

The parsing and conversion logic is covered without needing credentials:

```bash
pip install -r requirements-dev.txt
python -m pytest tests/ -q
```

## Repository map

| Path                  | Contents                                          |
| --------------------- | ------------------------------------------------- |
| `tools/`              | The exporter: Graph client, converter, name parser |
| `tests/`              | Offline tests for the parser and converter         |
| `notes/`              | Generated Markdown, mirroring the OneNote hierarchy |
| `docs/EXTRACTION.md`  | Setup, running, and known limits                  |
| `docs/SCHEMA.md`      | Front matter schema, naming convention, layout    |
| `CLAUDE.md`           | Project context and domain glossary               |

## Limits worth knowing up front

Handwritten ink is not transcribed — the OneNote API returns it only as a
rendered image. Affected pages are flagged `has_ink: true` so they can be found
and handled separately (`grep -rl 'has_ink: true' notes/`).

The Claude Microsoft 365 connector cannot substitute for the app registration:
it lacks the `Notes.Read` scope and is refused when reading `.one` files
directly. [docs/EXTRACTION.md](docs/EXTRACTION.md) records what was tried.
