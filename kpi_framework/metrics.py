"""The formulas. One function per dataset, each returning a flat {metric: value}
map for one period. Every formula here is mirrored in web/engine.js and the two
are held together by tests/test_parity.py."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Callable, Sequence

from .ingest import group_by_period, row_date

Rows = Sequence[dict[str, Any]]
Number = float | None


# --- small numeric helpers (None means "no data", never zero) ----------------

def _values(rows: Rows, column: str) -> list[float]:
    return [r[column] for r in rows if isinstance(r.get(column), (int, float))]


def _sum(rows: Rows, column: str) -> Number:
    vals = _values(rows, column)
    return float(sum(vals)) if vals else None


def _mean(vals: Sequence[float]) -> Number:
    return sum(vals) / len(vals) if vals else None


def _median(vals: Sequence[float]) -> Number:
    if not vals:
        return None
    ordered = sorted(vals)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[mid])
    return (ordered[mid - 1] + ordered[mid]) / 2


def _percentile(vals: Sequence[float], pct: float) -> Number:
    """Linear-interpolation percentile — matches the JS engine exactly."""
    if not vals:
        return None
    ordered = sorted(vals)
    if len(ordered) == 1:
        return float(ordered[0])
    pos = (len(ordered) - 1) * pct
    low = int(pos)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (pos - low)


def _ratio(numerator: Number, denominator: Number, scale: float = 100.0) -> Number:
    if numerator is None or not denominator:
        return None
    return numerator / denominator * scale


def _count(rows: Rows, predicate: Callable[[dict[str, Any]], bool]) -> float:
    return float(sum(1 for r in rows if predicate(r)))


def _latest(rows: Rows) -> dict[str, Any] | None:
    """Snapshot metrics (a catalogue's completeness, a config diff) describe a
    state, not a flow — so the newest record in the period wins."""
    dated = [(row_date(r), r) for r in rows]
    dated = [(d, r) for d, r in dated if d is not None]
    if not dated:
        return None
    return max(dated, key=lambda pair: pair[0])[1]


def _hours_between(start: Any, end: Any) -> Number:
    if not isinstance(start, datetime) or not isinstance(end, datetime):
        return None
    return (end - start).total_seconds() / 3600.0


def _days_between(start: Any, end: Any) -> Number:
    if isinstance(start, datetime):
        start = start.date()
    if isinstance(end, datetime):
        end = end.date()
    if not isinstance(start, date) or not isinstance(end, date):
        return None
    return float((end - start).days)


def _spans(rows: Rows, start_col: str, end_col: str, fn: Callable[[Any, Any], Number]) -> list[float]:
    out: list[float] = []
    for r in rows:
        span = fn(r.get(start_col), r.get(end_col))
        if span is not None:
            out.append(span)
    return out


# --- dataset formulas --------------------------------------------------------

def _lost_minutes(row: dict[str, Any]) -> float:
    scheduled, productive = row.get("scheduled_minutes"), row.get("productive_minutes")
    if not isinstance(scheduled, (int, float)) or not isinstance(productive, (int, float)):
        return 0.0
    return float(scheduled - productive)


def sessions_metrics(rows: Rows) -> dict[str, Number]:
    scheduled = _sum(rows, "scheduled_minutes")
    productive = _sum(rows, "productive_minutes")
    faults = _sum(rows, "control_faults")
    restore = _sum(rows, "fault_restore_minutes")
    session_count = float(len(rows))
    # Only a session that actually lost time counts as a loss — a fault that was
    # caught and cleared inside the plan is not a lost session.
    control_loss = _count(rows, lambda r: r.get("disruption_cause") == "control_system"
                          and _lost_minutes(r) > 0)
    debrief_due = _count(rows, lambda r: r.get("debrief_due") is True)
    debrief_on_time = _count(rows, lambda r: r.get("debrief_due") is True and r.get("debrief_on_time") is True)
    return {
        "session_count": session_count or None,
        "scheduled_minutes": scheduled,
        "productive_minutes": productive,
        "lost_minutes": None if scheduled is None or productive is None else scheduled - productive,
        "availability_pct": _ratio(productive, scheduled),
        "control_loss_count": control_loss,
        "control_loss_pct": _ratio(control_loss, session_count),
        # MTBF counts productive time only: a rig that was down is not accruing
        # time between failures.
        "mtbf_hours": None if productive is None or not faults else (productive / 60.0) / faults,
        "mttr_minutes": None if restore is None or not faults else restore / faults,
        "debrief_on_time_pct": _ratio(debrief_on_time, debrief_due or None),
        "debrief_usefulness_mean": _mean(_values(rows, "debrief_usefulness")),
    }


def releases_metrics(rows: Rows) -> dict[str, Number]:
    count = float(len(rows))
    clean = _count(rows, lambda r: not r.get("session_day_intervention") and not r.get("rollback"))
    pre = _sum(rows, "defects_pre_release") or 0.0
    sev1 = _sum(rows, "escaped_sev1") or 0.0
    sev2 = _sum(rows, "escaped_sev2") or 0.0
    sev3 = _sum(rows, "escaped_sev3") or 0.0
    escaped = sev1 + sev2 + sev3
    lead_times = _spans(rows, "spec_frozen_at", "validated_at", _hours_between)
    buffers = _spans(rows, "validated_at", "event_at", _hours_between)
    latest = _latest(rows) or {}
    functions_total = latest.get("functions_total")
    functions_automated = latest.get("functions_automated")
    return {
        "release_count": count or None,
        "release_ftpr_pct": _ratio(clean, count or None),
        "defect_detection_efficiency_pct": _ratio(pre, (pre + escaped) or None) if count else None,
        "sev1_escapes": sev1 if count else None,
        "escaped_defects": escaped if count else None,
        "escaped_per_release": (escaped / count) if count else None,
        "release_lead_time_hours_median": _median(lead_times),
        "release_buffer_hours_median": _median(buffers),
        "release_buffer_compliance_pct": _ratio(
            float(sum(1 for b in buffers if b >= 24.0)), float(len(buffers)) or None),
        "hil_pass_rate_pct": _ratio(_sum(rows, "hil_cases_passed"), _sum(rows, "hil_cases_run")),
        "hil_automation_coverage_pct": _ratio(
            functions_automated if isinstance(functions_automated, (int, float)) else None,
            functions_total if isinstance(functions_total, (int, float)) else None),
    }


def faults_metrics(rows: Rows) -> dict[str, Number]:
    in_session = [r for r in rows if r.get("in_session") is True]
    resolution = _spans(in_session, "raised_at", "resolved_at",
                        lambda a, b: None if (h := _hours_between(a, b)) is None else h * 60.0)
    resolved = [r for r in rows if isinstance(r.get("resolved_at"), datetime)]
    root_cause_days = _spans(rows, "raised_at", "root_cause_closed_at", _days_between)
    within_sla = _count(rows, lambda r: (
        (days := _days_between(r.get("raised_at"), r.get("root_cause_closed_at"))) is not None
        and days <= (r.get("sla_days") if isinstance(r.get("sla_days"), (int, float)) else 5)))
    recurrences = _count(rows, lambda r: bool(str(r.get("recurrence_of") or "").strip()))
    return {
        "fault_count": float(len(rows)) or None,
        "fault_resolution_minutes_median": _median(resolution),
        "fault_resolution_minutes_p90": _percentile(resolution, 0.9),
        "root_cause_days_median": _median(root_cause_days),
        "root_cause_closure_pct": _ratio(within_sla, float(len(resolved)) or None),
        "fault_recurrence_pct": _ratio(recurrences, float(len(resolved)) or None),
    }


def config_metrics(rows: Rows) -> dict[str, Number]:
    latest = _latest(rows)
    currency = _spans(rows, "car_release_date", "dil_baseline_date", _days_between)
    out: dict[str, Number] = {
        "config_alignment_pct": None,
        "undocumented_diff_count": None,
        "baseline_currency_days_median": _median(currency),
    }
    if latest:
        tracked = latest.get("tracked_items")
        matched = latest.get("matched_items") or 0.0
        documented = latest.get("documented_diffs") or 0.0
        if isinstance(tracked, (int, float)) and tracked:
            out["config_alignment_pct"] = (matched + documented) / tracked * 100.0
        undocumented = latest.get("undocumented_diffs")
        out["undocumented_diff_count"] = float(undocumented) if isinstance(undocumented, (int, float)) else None
    return out


def coverage_metrics(rows: Rows) -> dict[str, Number]:
    """Latest report per model, then averaged — so re-running one model's
    coverage twice in a period doesn't weight it double."""
    latest_by_model: dict[str, dict[str, Any]] = {}
    for row in rows:
        model = str(row.get("model") or "")
        when = row_date(row)
        prev = latest_by_model.get(model)
        if when is None:
            continue
        if prev is None or (row_date(prev) or when) <= when:
            latest_by_model[model] = row
    reports = list(latest_by_model.values())
    per_model = []
    for r in reports:
        parts = [r.get(c) for c in ("decision_pct", "condition_pct", "mcdc_pct", "signal_range_pct")]
        parts = [p for p in parts if isinstance(p, (int, float))]
        if parts:
            per_model.append(sum(parts) / len(parts))
    return {
        "model_coverage_pct": _mean(per_model),
        "mcdc_pct": _mean(_values(reports, "mcdc_pct")),
        "models_reported": float(len(reports)) or None,
    }


def documentation_metrics(rows: Rows) -> dict[str, Number]:
    latest = _latest(rows)
    if not latest:
        return {"catalogue_completeness_pct": None, "catalogue_gap": None,
                "doc_freshness_pct": None, "sop_coverage_pct": None}
    identified = latest.get("differences_identified")
    documented = latest.get("differences_documented")
    gap = None
    if isinstance(identified, (int, float)) and isinstance(documented, (int, float)):
        gap = max(0.0, identified - documented)
    return {
        "catalogue_completeness_pct": _ratio(documented if isinstance(documented, (int, float)) else None,
                                             identified if isinstance(identified, (int, float)) else None),
        "catalogue_gap": gap,
        "doc_freshness_pct": _ratio(latest.get("pages_fresh"), latest.get("pages_total")),
        "sop_coverage_pct": _ratio(latest.get("sops_signed_off"), latest.get("procedures_identified")),
    }


ANONYMITY_FLOOR = 3


def survey_metrics(rows: Rows) -> dict[str, Number]:
    """Mean of group means, so a large group can't drown out a small one — and
    any group under the anonymity floor is excluded from the published figure."""
    groups: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        groups.setdefault(str(row.get("rater_group") or "unspecified"), []).append(row)

    eligible_overall: list[float] = []
    eligible_fidelity: list[float] = []
    below_floor = 0.0
    respondents_total = 0.0
    for group_rows in groups.values():
        respondents = sum(r.get("respondents") or 0 for r in group_rows)
        respondents_total += respondents
        if respondents < ANONYMITY_FLOOR:
            below_floor += 1
            continue
        overall = _mean(_values(group_rows, "overall"))
        fidelity = _mean(_values(group_rows, "fidelity_confidence"))
        if overall is not None:
            eligible_overall.append(overall)
        if fidelity is not None:
            eligible_fidelity.append(fidelity)
    return {
        "stakeholder_satisfaction_mean": _mean(eligible_overall),
        "fidelity_confidence_mean": _mean(eligible_fidelity),
        "survey_respondents": respondents_total or None,
        "survey_groups_below_floor": below_floor if groups else None,
        "survey_clarity_mean": _mean(_values(rows, "clarity")),
        "survey_responsiveness_mean": _mean(_values(rows, "responsiveness")),
    }


def correlation_metrics(rows: Rows) -> dict[str, Number]:
    return {"correlation_delta_mean": _mean(_values(rows, "sim_vs_track_delta_pct"))}


def development_metrics(rows: Rows) -> dict[str, Number]:
    committed = _sum(rows, "items_committed")
    delivered = _sum(rows, "items_delivered")
    before = _sum(rows, "setup_minutes_before")
    after = _sum(rows, "setup_minutes_after")
    errors_before = _sum(rows, "config_errors_before")
    errors_after = _sum(rows, "config_errors_after")
    saved = None if before is None or after is None else before - after
    return {
        "development_delivery_pct": _ratio(delivered, committed),
        "items_delivered": delivered,
        "items_committed": committed,
        "setup_time_reduction_pct": _ratio(saved, before),
        "minutes_saved_per_session": saved,
        "config_error_reduction_pct": _ratio(
            None if errors_before is None or errors_after is None else errors_before - errors_after,
            errors_before),
        "cross_task_count": _sum(rows, "cross_tasks"),
    }


DATASET_FORMULAS: dict[str, Callable[[Rows], dict[str, Number]]] = {
    "sessions": sessions_metrics,
    "releases": releases_metrics,
    "faults": faults_metrics,
    "config": config_metrics,
    "coverage": coverage_metrics,
    "documentation": documentation_metrics,
    "survey": survey_metrics,
    "correlation": correlation_metrics,
    "development": development_metrics,
}


def compute_period_metrics(data: dict[str, Rows], period: str) -> dict[str, dict[str, Number]]:
    """{period key: {metric: value}} — every dataset merged into one namespace so
    a KPI can pair a companion metric from a different source."""
    table: dict[str, dict[str, Number]] = {}
    for dataset, formula in DATASET_FORMULAS.items():
        for key, rows in group_by_period(data.get(dataset, []), period).items():
            table.setdefault(key, {}).update(formula(rows))
    return dict(sorted(table.items()))


def compute_all(data: dict[str, Rows]) -> dict[str, dict[str, dict[str, Number]]]:
    return {p: compute_period_metrics(data, p) for p in ("month", "quarter")}
