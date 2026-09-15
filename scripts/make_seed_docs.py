#!/usr/bin/env python3
"""Explodes a dataset directory into one JSON file per record, ready to load into
a published board's store with the ArtifactData tool (`action: "batch"`, entries
of {op: "set", collection, doc_id, file_path}).

    python scripts/make_seed_docs.py data/sample .seed

Collections are the dataset names; settings/meta and settings/programme are
written alongside so the board opens with the sample banner and a start date.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from kpi_framework.ingest import read_dataset_dir          # noqa: E402
from kpi_framework.payload import serialise_datasets       # noqa: E402

# Short, stable per-dataset id prefixes keep the batch entries readable.
PREFIX = {"sessions": "s", "faults": "f", "releases": "l", "config": "c", "coverage": "v",
          "documentation": "d", "survey": "u", "correlation": "r", "development": "e"}


def main(source: str = "data/sample", out: str = ".seed", start_date: str = "2026-01-06") -> int:
    out_dir = Path(out)
    shutil.rmtree(out_dir, ignore_errors=True)
    data = serialise_datasets(read_dataset_dir(source))

    total = 0
    for name, rows in data.items():
        if not rows:
            continue
        (out_dir / name).mkdir(parents=True, exist_ok=True)
        for i, row in enumerate(rows, 1):
            doc_id = f"{PREFIX.get(name, name[0])}{i:04d}"
            (out_dir / name / f"{doc_id}.json").write_text(json.dumps(row))
            print(f'{{"op": "set", "collection": "{name}", "doc_id": "{doc_id}", '
                  f'"file_path": "{out_dir / name / (doc_id + ".json")}"}},')
        total += len(rows)

    (out_dir / "settings").mkdir(parents=True, exist_ok=True)
    (out_dir / "settings" / "meta.json").write_text(json.dumps(
        {"seeded": True, "note": "Fictional sample records loaded at publish time."}))
    (out_dir / "settings" / "programme.json").write_text(json.dumps(
        {"start_date": start_date, "as_of": None, "targets_agreed": False, "overrides": {}}))

    print(f"\n{total} record documents + 2 settings documents in {out_dir}", file=sys.stderr)
    print("Batch them 50 at a time — the store holds 5,000 documents.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(*sys.argv[1:]))
