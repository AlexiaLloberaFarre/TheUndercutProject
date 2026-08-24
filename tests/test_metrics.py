"""Hand-computed fixtures for the formulas. Values here are worked out by hand in
the docstrings so a failure says which formula drifted, not just that a number moved."""

from __future__ import annotations

import unittest
from datetime import date, datetime

from kpi_framework import metrics
from kpi_framework.ingest import group_by_period, period_key


def dt(day: int, hour: int = 9, minute: int = 0) -> datetime:
    return datetime(2026, 3, day, hour, minute)


class SessionMetricsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.rows = [
            {"date": date(2026, 3, 2), "scheduled_minutes": 480.0, "productive_minutes": 480.0,
             "disruption_cause": "none", "control_faults": 0.0, "fault_restore_minutes": 0.0,
             "debrief_due": True, "debrief_on_time": True, "debrief_usefulness": 4.0},
            {"date": date(2026, 3, 4), "scheduled_minutes": 480.0, "productive_minutes": 420.0,
             "disruption_cause": "control_system", "control_faults": 2.0, "fault_restore_minutes": 60.0,
             "debrief_due": True, "debrief_on_time": False, "debrief_usefulness": 3.0},
            {"date": date(2026, 3, 6), "scheduled_minutes": 240.0, "productive_minutes": 180.0,
             "disruption_cause": "it", "control_faults": 0.0, "fault_restore_minutes": 0.0,
             "debrief_due": False, "debrief_on_time": False},
        ]

    def test_availability_is_productive_over_scheduled(self) -> None:
        """1080 productive / 1200 scheduled = 90%."""
        self.assertAlmostEqual(metrics.sessions_metrics(self.rows)["availability_pct"], 90.0)

    def test_only_control_caused_losses_count(self) -> None:
        """The IT outage lost an hour too, but it is not this role's KPI."""
        m = metrics.sessions_metrics(self.rows)
        self.assertEqual(m["control_loss_count"], 1.0)
        self.assertAlmostEqual(m["control_loss_pct"], 100 / 3)

    def test_a_fault_that_costs_no_time_is_not_a_lost_session(self) -> None:
        rows = [{"date": date(2026, 3, 2), "scheduled_minutes": 480.0, "productive_minutes": 480.0,
                 "disruption_cause": "control_system", "control_faults": 1.0, "fault_restore_minutes": 0.0}]
        self.assertEqual(metrics.sessions_metrics(rows)["control_loss_count"], 0.0)

    def test_mtbf_counts_productive_hours_only(self) -> None:
        """1080 productive minutes = 18h over 2 faults = 9h MTBF; 60 min / 2 = 30 min MTTR."""
        m = metrics.sessions_metrics(self.rows)
        self.assertAlmostEqual(m["mtbf_hours"], 9.0)
        self.assertAlmostEqual(m["mttr_minutes"], 30.0)

    def test_mtbf_is_none_rather_than_infinite_when_no_faults(self) -> None:
        rows = [dict(self.rows[0])]
        self.assertIsNone(metrics.sessions_metrics(rows)["mtbf_hours"])

    def test_debrief_rate_ignores_sessions_with_no_debrief_due(self) -> None:
        self.assertAlmostEqual(metrics.sessions_metrics(self.rows)["debrief_on_time_pct"], 50.0)


class ReleaseMetricsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.rows = [
            {"event_at": dt(10, 8), "spec_frozen_at": dt(5, 8), "validated_at": dt(8, 8),
             "session_day_intervention": False, "rollback": False, "defects_pre_release": 9.0,
             "escaped_sev1": 0.0, "escaped_sev2": 1.0, "escaped_sev3": 0.0,
             "hil_cases_run": 100.0, "hil_cases_passed": 100.0,
             "functions_total": 80.0, "functions_automated": 40.0},
            {"event_at": dt(20, 8), "spec_frozen_at": dt(18, 8), "validated_at": dt(20, 2),
             "session_day_intervention": True, "rollback": False, "defects_pre_release": 6.0,
             "escaped_sev1": 1.0, "escaped_sev2": 0.0, "escaped_sev3": 0.0,
             "hil_cases_run": 100.0, "hil_cases_passed": 98.0,
             "functions_total": 80.0, "functions_automated": 60.0},
        ]

    def test_first_time_pass_rate(self) -> None:
        """One of two releases needed a session-day intervention."""
        self.assertAlmostEqual(metrics.releases_metrics(self.rows)["release_ftpr_pct"], 50.0)

    def test_detection_efficiency_and_severity_split(self) -> None:
        """15 caught pre-release, 2 escaped → 15/17."""
        m = metrics.releases_metrics(self.rows)
        self.assertAlmostEqual(m["defect_detection_efficiency_pct"], 15 / 17 * 100)
        self.assertEqual(m["sev1_escapes"], 1.0)
        self.assertAlmostEqual(m["escaped_per_release"], 1.0)

    def test_buffer_compliance_counts_only_a_full_working_day(self) -> None:
        """48h buffer passes, 6h does not."""
        m = metrics.releases_metrics(self.rows)
        self.assertAlmostEqual(m["release_buffer_compliance_pct"], 50.0)
        self.assertAlmostEqual(m["release_buffer_hours_median"], 27.0)

    def test_coverage_is_a_snapshot_not_a_sum(self) -> None:
        """Two releases over the same 80 functions must not read as 160."""
        self.assertAlmostEqual(metrics.releases_metrics(self.rows)["hil_automation_coverage_pct"], 75.0)

    def test_pass_rate_pools_cases(self) -> None:
        self.assertAlmostEqual(metrics.releases_metrics(self.rows)["hil_pass_rate_pct"], 99.0)


class FaultMetricsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.rows = [
            {"raised_at": dt(2, 9), "resolved_at": dt(2, 9, 10), "in_session": True,
             "root_cause_closed_at": dt(5), "sla_days": 5.0, "recurrence_of": ""},
            {"raised_at": dt(3, 9), "resolved_at": dt(3, 9, 30), "in_session": True,
             "root_cause_closed_at": dt(12), "sla_days": 5.0, "recurrence_of": ""},
            {"raised_at": dt(4, 9), "resolved_at": dt(4, 11), "in_session": True,
             "root_cause_closed_at": dt(6), "sla_days": 5.0, "recurrence_of": "F-0001"},
            {"raised_at": dt(5, 9), "resolved_at": None, "in_session": False,
             "root_cause_closed_at": None, "sla_days": 5.0, "recurrence_of": ""},
        ]

    def test_median_and_tail_of_in_session_resolution(self) -> None:
        """In-session resolutions: 10, 30, 120 minutes."""
        m = metrics.faults_metrics(self.rows)
        self.assertAlmostEqual(m["fault_resolution_minutes_median"], 30.0)
        self.assertAlmostEqual(m["fault_resolution_minutes_p90"], 102.0)

    def test_root_cause_closure_measured_against_resolved_faults(self) -> None:
        """Two of three resolved faults were root-caused inside the 5-day SLA."""
        self.assertAlmostEqual(metrics.faults_metrics(self.rows)["root_cause_closure_pct"], 2 / 3 * 100)

    def test_recurrence_rate(self) -> None:
        self.assertAlmostEqual(metrics.faults_metrics(self.rows)["fault_recurrence_pct"], 1 / 3 * 100)


class SnapshotMetricsTest(unittest.TestCase):
    def test_config_alignment_uses_the_newest_audit_in_the_period(self) -> None:
        rows = [
            {"date": date(2026, 3, 1), "tracked_items": 100.0, "matched_items": 60.0,
             "documented_diffs": 10.0, "undocumented_diffs": 30.0},
            {"date": date(2026, 3, 28), "tracked_items": 100.0, "matched_items": 80.0,
             "documented_diffs": 18.0, "undocumented_diffs": 2.0},
        ]
        m = metrics.config_metrics(rows)
        self.assertAlmostEqual(m["config_alignment_pct"], 98.0)
        self.assertEqual(m["undocumented_diff_count"], 2.0)

    def test_baseline_currency_is_a_median_lag(self) -> None:
        rows = [{"date": date(2026, 3, 28), "car_release_date": date(2026, 3, 1),
                 "dil_baseline_date": date(2026, 3, 11)}]
        self.assertAlmostEqual(metrics.config_metrics(rows)["baseline_currency_days_median"], 10.0)

    def test_model_coverage_takes_the_latest_report_per_model(self) -> None:
        rows = [
            {"date": date(2026, 3, 1), "model": "a", "decision_pct": 50.0, "condition_pct": 50.0,
             "mcdc_pct": 50.0, "signal_range_pct": 50.0},
            {"date": date(2026, 3, 20), "model": "a", "decision_pct": 90.0, "condition_pct": 90.0,
             "mcdc_pct": 90.0, "signal_range_pct": 90.0},
            {"date": date(2026, 3, 20), "model": "b", "decision_pct": 70.0, "condition_pct": 70.0,
             "mcdc_pct": 70.0, "signal_range_pct": 70.0},
        ]
        m = metrics.coverage_metrics(rows)
        self.assertAlmostEqual(m["model_coverage_pct"], 80.0)
        self.assertEqual(m["models_reported"], 2.0)


class SurveyMetricsTest(unittest.TestCase):
    def test_group_below_anonymity_floor_is_excluded_and_flagged(self) -> None:
        rows = [
            {"date": date(2026, 3, 26), "rater_group": "Drivers", "respondents": 4.0, "overall": 4.0,
             "fidelity_confidence": 4.0},
            {"date": date(2026, 3, 26), "rater_group": "Race engineers", "respondents": 6.0, "overall": 3.0,
             "fidelity_confidence": 3.0},
            {"date": date(2026, 3, 26), "rater_group": "Section lead", "respondents": 2.0, "overall": 5.0,
             "fidelity_confidence": 5.0},
        ]
        m = metrics.survey_metrics(rows)
        self.assertAlmostEqual(m["stakeholder_satisfaction_mean"], 3.5)
        self.assertEqual(m["survey_groups_below_floor"], 1.0)
        self.assertEqual(m["survey_respondents"], 12.0)

    def test_mean_of_group_means_not_of_respondents(self) -> None:
        """A six-person group must not outweigh a four-person one."""
        rows = [
            {"date": date(2026, 3, 26), "rater_group": "A", "respondents": 3.0, "overall": 5.0},
            {"date": date(2026, 3, 26), "rater_group": "B", "respondents": 30.0, "overall": 3.0},
        ]
        self.assertAlmostEqual(metrics.survey_metrics(rows)["stakeholder_satisfaction_mean"], 4.0)


class PeriodTest(unittest.TestCase):
    def test_quarter_and_month_keys(self) -> None:
        self.assertEqual(period_key(date(2026, 3, 31), "quarter"), "2026-Q1")
        self.assertEqual(period_key(date(2026, 4, 1), "quarter"), "2026-Q2")
        self.assertEqual(period_key(date(2026, 4, 1), "month"), "2026-04")

    def test_rows_without_a_date_are_dropped_not_guessed(self) -> None:
        rows = [{"date": None, "scheduled_minutes": 100.0}, {"date": date(2026, 4, 1)}]
        self.assertEqual(list(group_by_period(rows, "month")), ["2026-04"])

    def test_empty_dataset_yields_no_values_rather_than_zeros(self) -> None:
        m = metrics.sessions_metrics([])
        self.assertIsNone(m["availability_pct"])
        self.assertIsNone(m["session_count"])


if __name__ == "__main__":
    unittest.main()
