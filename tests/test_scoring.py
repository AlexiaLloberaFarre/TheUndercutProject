"""Status gating, trend direction and the scorecard rollup."""

from __future__ import annotations

import unittest
from datetime import date

from kpi_framework.catalogue import load_catalogue
from kpi_framework.metrics import compute_all
from kpi_framework.scoring import (BASELINE, NO_DATA, OFF_TARGET, ON_TARGET, PENDING, WATCH,
                                   Programme, kpi_status, scorecard, status_for, trend_for)

CAT = load_catalogue()
AVAILABILITY = CAT.kpi("dil-availability")      # direction up, target 98, amber 95, phase P1
FAULT_TIME = CAT.kpi("fault-resolution-time")   # direction down, target 15, amber 30, phase P1


class ThresholdTest(unittest.TestCase):
    def test_up_kpi_bands(self) -> None:
        self.assertEqual(status_for(98.0, "up", 98, 95), ON_TARGET)
        self.assertEqual(status_for(96.4, "up", 98, 95), WATCH)
        self.assertEqual(status_for(94.9, "up", 98, 95), OFF_TARGET)

    def test_down_kpi_bands(self) -> None:
        self.assertEqual(status_for(15.0, "down", 15, 30), ON_TARGET)
        self.assertEqual(status_for(22.0, "down", 15, 30), WATCH)
        self.assertEqual(status_for(31.0, "down", 15, 30), OFF_TARGET)

    def test_missing_value_is_no_data_not_a_failure(self) -> None:
        self.assertEqual(status_for(None, "up", 98, 95), NO_DATA)


class GatingTest(unittest.TestCase):
    """Recommendation 1: measure first, judge later."""

    def test_kpi_is_pending_before_its_phase_starts(self) -> None:
        early = Programme(start_date=date(2026, 1, 1), as_of=date(2026, 1, 10))  # day 9, P1 starts day 30
        self.assertEqual(kpi_status(AVAILABILITY, 99.0, CAT, early), PENDING)

    def test_readings_before_day_60_read_as_baseline_not_a_score(self) -> None:
        mid = Programme(start_date=date(2026, 1, 1), as_of=date(2026, 2, 20))  # day 50
        self.assertEqual(kpi_status(AVAILABILITY, 80.0, CAT, mid), BASELINE)

    def test_after_day_60_the_target_bites(self) -> None:
        later = Programme(start_date=date(2026, 1, 1), as_of=date(2026, 3, 15))  # day 73
        self.assertEqual(kpi_status(AVAILABILITY, 80.0, CAT, later), OFF_TARGET)

    def test_agreeing_a_target_early_opts_into_scoring(self) -> None:
        mid = Programme(start_date=date(2026, 1, 1), as_of=date(2026, 2, 20),
                        overrides={"K1.1": {"target_agreed": True}})
        self.assertEqual(kpi_status(AVAILABILITY, 99.0, CAT, mid), ON_TARGET)

    def test_without_a_start_date_nothing_is_gated(self) -> None:
        self.assertEqual(kpi_status(AVAILABILITY, 99.0, CAT, Programme()), ON_TARGET)


class TrendTest(unittest.TestCase):
    def test_falling_value_improves_a_down_kpi(self) -> None:
        self.assertEqual(trend_for(12.0, 20.0, "down")["verdict"], "improving")
        self.assertEqual(trend_for(20.0, 12.0, "down")["verdict"], "worsening")

    def test_rising_value_improves_an_up_kpi(self) -> None:
        self.assertEqual(trend_for(97.0, 92.0, "up")["verdict"], "improving")

    def test_small_moves_read_as_flat(self) -> None:
        self.assertEqual(trend_for(98.0, 97.9, "up")["verdict"], "flat")

    def test_first_reading_is_not_a_trend(self) -> None:
        self.assertEqual(trend_for(98.0, None, "up")["verdict"], "new")


class ScorecardTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        from kpi_framework.ingest import read_dataset_dir
        from pathlib import Path
        data = read_dataset_dir(Path(__file__).resolve().parent.parent / "data" / "sample")
        cls.tables = compute_all(data)
        cls.card = scorecard(CAT, cls.tables,
                             Programme(start_date=date(2026, 1, 6), as_of=date(2026, 8, 24),
                                       targets_agreed=True))

    def test_every_kpi_has_a_series(self) -> None:
        self.assertEqual(set(self.card["series"]), {k["id"] for k in CAT.kpis})

    def test_sample_data_exercises_every_kpi(self) -> None:
        """If a KPI never produces a value, its formula or the sample data is wrong."""
        missing = [k for k, s in self.card["series"].items() if s["latest"] is None]
        self.assertEqual(missing, [])

    def test_counts_sum_to_the_catalogue(self) -> None:
        self.assertEqual(sum(self.card["counts"].values()), len(CAT.kpis))

    def test_headline_set_is_small_enough_to_present(self) -> None:
        self.assertLessEqual(len(self.card["headline_ids"]), 8)
        self.assertGreaterEqual(len(self.card["headline_ids"]), 6)

    def test_overrides_change_the_verdict(self) -> None:
        strict = scorecard(CAT, self.tables,
                           Programme(start_date=date(2026, 1, 6), as_of=date(2026, 8, 24),
                                     targets_agreed=True,
                                     overrides={"K2.1": {"target": 100.5, "amber": 100.2}}))
        self.assertEqual(strict["series"]["K2.1"]["status"], OFF_TARGET)

    def test_phase_resolves_from_the_programme_day(self) -> None:
        self.assertEqual(self.card["phase"], "P4")
        self.assertEqual(self.card["programme_day"], 230)


if __name__ == "__main__":
    unittest.main()
