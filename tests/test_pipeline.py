"""End-to-end: CSV in, dashboard out."""

from __future__ import annotations

import contextlib
import csv
import io
import json
import unittest
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory

from kpi_framework.build import build_html
from kpi_framework.catalogue import load_catalogue
from kpi_framework.cli import main
from kpi_framework.ingest import IngestError, read_csv, read_dataset_dir
from kpi_framework.payload import build_payload, dumps, flat_scorecard
from kpi_framework.scoring import Programme

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "data" / "sample"
CAT = load_catalogue()
PROGRAMME = Programme(start_date=date(2026, 1, 6), as_of=date(2026, 8, 24), targets_agreed=True)


class IngestTest(unittest.TestCase):
    def test_typed_columns_come_back_typed(self) -> None:
        rows = read_csv(SAMPLE / "sessions.csv")
        row = rows[0]
        self.assertIsInstance(row["date"], date)
        self.assertIsInstance(row["scheduled_minutes"], float)
        self.assertIsInstance(row["debrief_due"], bool)
        self.assertIsInstance(row["session_id"], str)

    def test_a_bad_cell_names_the_file_and_row(self) -> None:
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "sessions.csv"
            path.write_text("date,scheduled_minutes\n2026-01-06,not-a-number\n")
            with self.assertRaises(IngestError) as caught:
                read_csv(path)
            self.assertIn("sessions.csv:2", str(caught.exception))
            self.assertIn("scheduled_minutes", str(caught.exception))

    def test_a_missing_dataset_is_empty_not_fatal(self) -> None:
        """The framework is meant to be adopted one KPI at a time."""
        with TemporaryDirectory() as tmp:
            data = read_dataset_dir(tmp)
            self.assertEqual(set(data), set(read_dataset_dir(SAMPLE)))
            self.assertTrue(all(rows == [] for rows in data.values()))


class PayloadTest(unittest.TestCase):
    def test_payload_is_json_serialisable_with_iso_dates(self) -> None:
        payload = json.loads(dumps(build_payload(CAT, read_dataset_dir(SAMPLE), PROGRAMME)))
        self.assertEqual(payload["datasets"]["sessions"][0]["date"], "2026-01-07")
        self.assertEqual(payload["programme"]["start_date"], "2026-01-06")
        self.assertEqual(len(payload["kpis"]), 22)

    def test_flat_scorecard_has_one_row_per_kpi(self) -> None:
        rows = flat_scorecard(CAT, read_dataset_dir(SAMPLE), PROGRAMME)
        self.assertEqual(len(rows), 22)
        self.assertEqual({r["id"] for r in rows}, {k["id"] for k in CAT.kpis})
        self.assertTrue(all(r["status"] for r in rows))


class BuildTest(unittest.TestCase):
    def test_build_inlines_everything_and_leaves_no_placeholder(self) -> None:
        html = build_html(dumps(build_payload(CAT, read_dataset_dir(SAMPLE), PROGRAMME)))
        for placeholder in ("<!--STYLES-->", "<!--ENGINE-->", "<!--APP-->", "/*__PAYLOAD__*/"):
            self.assertNotIn(placeholder, html)
        self.assertIn("window.PAYLOAD", html)
        self.assertIn("const KPI", html)

    def test_no_external_requests_beyond_the_font_stylesheet(self) -> None:
        html = build_html(dumps(build_payload(CAT, {}, PROGRAMME)))
        remote = [line for line in html.splitlines() if "http://" in line or "https://" in line]
        self.assertTrue(all("fonts.googleapis.com" in line for line in remote), remote)

    def test_data_cannot_close_the_script_element_early(self) -> None:
        payload = {"datasets": {"sessions": [{"session_id": "</script><script>alert(1)</script>"}]}}
        html = build_html(json.dumps(payload))
        self.assertNotIn("</script><script>alert", html)
        self.assertIn("<\\/script>", html)

    def test_a_missing_placeholder_fails_loudly(self) -> None:
        with TemporaryDirectory() as tmp:
            (Path(tmp) / "index.html").write_text("<title>x</title>")
            for name in ("styles.css", "engine.js", "app.js"):
                (Path(tmp) / name).write_text("")
            with self.assertRaises(ValueError):
                build_html("{}", tmp)


class CliTest(unittest.TestCase):
    """The CLI prints its scorecard to stdout; tests only care about the exit code."""

    @staticmethod
    def run_cli(argv: list[str]) -> int:
        with contextlib.redirect_stdout(io.StringIO()):
            return main(argv)

    def test_validate_passes(self) -> None:
        self.assertEqual(self.run_cli(["validate"]), 0)

    def test_compute_runs_over_the_sample(self) -> None:
        self.assertEqual(self.run_cli(["compute", "--data", str(SAMPLE), "--start", "2026-01-06",
                               "--as-of", "2026-08-24", "--targets-agreed"]), 0)

    def test_export_writes_a_csv_with_a_row_per_kpi(self) -> None:
        with TemporaryDirectory() as tmp:
            out = Path(tmp) / "scorecard.csv"
            self.assertEqual(self.run_cli(["export", "--data", str(SAMPLE), "--format", "csv", "--out", str(out)]), 0)
            rows = list(csv.DictReader(io.StringIO(out.read_text())))
            self.assertEqual(len(rows), 22)
            self.assertIn("status", rows[0])

    def test_build_writes_a_self_contained_page(self) -> None:
        with TemporaryDirectory() as tmp:
            out = Path(tmp) / "dashboard.html"
            self.assertEqual(self.run_cli(["build", "--data", str(SAMPLE), "--out", str(out)]), 0)
            html = out.read_text()
            self.assertGreater(len(html), 100_000)
            self.assertIn("Simulator KPI Tracker", html)

    def test_build_with_no_data_still_produces_a_usable_page(self) -> None:
        """Day one: the framework exists, the records do not."""
        with TemporaryDirectory() as tmp:
            out = Path(tmp) / "empty.html"
            self.assertEqual(self.run_cli(["build", "--data", tmp, "--out", str(out)]), 0)
            self.assertIn("window.PAYLOAD", out.read_text())


if __name__ == "__main__":
    unittest.main()
