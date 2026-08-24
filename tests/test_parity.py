"""The JS engine and the Python engine must agree to the last decimal.

If this test fails, one of web/engine.js or kpi_framework/metrics.py was changed
without the other — the dashboard would then show different numbers from the
pipeline that feeds the review pack.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import unittest
from datetime import date
from pathlib import Path

from kpi_framework.catalogue import load_catalogue
from kpi_framework.ingest import read_dataset_dir
from kpi_framework.metrics import compute_all
from kpi_framework.payload import build_payload, dumps
from kpi_framework.scoring import Programme, scorecard

ROOT = Path(__file__).resolve().parent.parent
TOLERANCE = 1e-9


def _close(a, b) -> bool:
    if a is None or b is None:
        return a is None and b is None
    if isinstance(a, bool) or isinstance(b, bool):
        return bool(a) == bool(b)
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) <= TOLERANCE * max(1.0, abs(a), abs(b))
    return a == b


@unittest.skipIf(shutil.which("node") is None, "node not available")
class ParityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.cat = load_catalogue()
        cls.data = read_dataset_dir(ROOT / "data" / "sample")
        cls.programme = Programme(start_date=date(2026, 1, 6), as_of=date(2026, 8, 24),
                                  targets_agreed=True)
        payload = build_payload(cls.cat, cls.data, cls.programme)
        cls.payload_path = ROOT / "dist" / "_parity_payload.json"
        cls.payload_path.parent.mkdir(exist_ok=True)
        cls.payload_path.write_text(dumps(payload))
        out = subprocess.run(["node", str(ROOT / "tests" / "parity_runner.js"), str(cls.payload_path)],
                             capture_output=True, text=True, check=True)
        cls.js = json.loads(out.stdout)
        cls.py_tables = compute_all(cls.data)
        cls.py_card = scorecard(cls.cat, cls.py_tables, cls.programme)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.payload_path.unlink(missing_ok=True)

    def test_period_keys_match(self) -> None:
        for period in ("month", "quarter"):
            self.assertEqual(sorted(self.py_tables[period]), sorted(self.js["tables"][period]),
                             f"{period} period keys differ")

    def test_every_metric_value_matches(self) -> None:
        compared = 0
        for period in ("month", "quarter"):
            for key, py_metrics in self.py_tables[period].items():
                js_metrics = self.js["tables"][period][key]
                self.assertEqual(sorted(py_metrics), sorted(js_metrics),
                                 f"{period} {key}: metric names differ")
                for metric, py_value in py_metrics.items():
                    compared += 1
                    self.assertTrue(_close(py_value, js_metrics[metric]),
                                    f"{period} {key} {metric}: python={py_value} js={js_metrics[metric]}")
        self.assertGreater(compared, 200, "suspiciously few metrics compared")

    def test_scorecard_matches(self) -> None:
        for kpi_id, py_series in self.py_card["series"].items():
            js_series = self.js["scorecard"]["series"][kpi_id]
            for field in ("latest", "previous", "target", "amber"):
                self.assertTrue(_close(py_series[field], js_series[field]),
                                f"{kpi_id}.{field}: python={py_series[field]} js={js_series[field]}")
            self.assertEqual(py_series["status"], js_series["status"], f"{kpi_id}.status")
            self.assertEqual(py_series["latest_period"], js_series["latest_period"], f"{kpi_id}.latest_period")
            self.assertEqual(py_series["trend"]["verdict"], js_series["trend"]["verdict"], f"{kpi_id}.trend")
            self.assertEqual(py_series["headline"], js_series["headline"], f"{kpi_id}.headline")
            self.assertEqual(len(py_series["companions"]), len(js_series["companions"]), f"{kpi_id}.companions")
            for py_c, js_c in zip(py_series["companions"], js_series["companions"]):
                self.assertTrue(_close(py_c["latest"], js_c["latest"]), f"{kpi_id} companion {py_c['metric']}")
                self.assertEqual(py_c["status"], js_c["status"], f"{kpi_id} companion {py_c['metric']} status")

    def test_programme_context_matches(self) -> None:
        self.assertEqual(self.py_card["programme_day"], self.js["scorecard"]["programme_day"])
        self.assertEqual(self.py_card["phase"], self.js["scorecard"]["phase"])
        self.assertEqual(self.py_card["counts"], self.js["scorecard"]["counts"])


if __name__ == "__main__":
    unittest.main()
