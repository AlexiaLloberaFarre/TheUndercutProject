#!/usr/bin/env python3
"""Regenerates data/sample/*.csv — a fictional but internally consistent eight
months of records, so the dashboard can be explored before any real data exists.

Deterministic: same seed in, same CSVs out. Nothing here is real Alpine data.
"""

from __future__ import annotations

import csv
import random
from datetime import date, datetime, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "sample"
START = date(2026, 1, 6)
MONTHS = 8
RNG = random.Random(20260106)

FAULT_CLASSES = ["CAN timeout", "Calibration mismatch", "Logging config", "Sensor scaling",
                 "Model interface", "Power-up sequence"]
DISRUPTIONS = ["motion_platform", "vehicle_model", "it", "other"]


def month_dates(index: int) -> list[date]:
    """Roughly three sessions a week, Monday/Wednesday/Thursday."""
    first = date(2026, 1 + index, 1)
    days = []
    cursor = first
    while cursor.month == first.month:
        if cursor.weekday() in (0, 2, 3) and cursor >= START:
            days.append(cursor)
        cursor += timedelta(days=1)
    return days


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def write(name: str, rows: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / f"{name}.csv").open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"{name}.csv: {len(rows)} rows")


sessions: list[dict] = []
faults: list[dict] = []
fault_seq = 0
resolved_classes: list[str] = []

for m in range(MONTHS):
    t = m / (MONTHS - 1)
    target_availability = lerp(0.905, 0.982, t)      # rig bedding in
    fault_rate = lerp(1.15, 0.35, t)                 # control faults per session
    restore_median = lerp(34.0, 11.0, t)             # minutes to restore
    for i, day in enumerate(month_dates(m)):
        session_id = f"DIL-{day:%Y%m%d}-{i + 1}"
        scheduled = RNG.choice([420, 480, 480, 540])
        n_faults = max(0, int(round(RNG.gauss(fault_rate, 0.6))))
        restore_total = 0
        cause = "none"
        for _ in range(n_faults):
            fault_seq += 1
            restore = max(3, int(RNG.gauss(restore_median, restore_median * 0.35)))
            restore_total += restore
            raised = datetime.combine(day, datetime.min.time()) + timedelta(
                hours=9, minutes=RNG.randint(0, 300))
            fault_class = RNG.choice(FAULT_CLASSES)
            # Root cause closed a few days later; SLA discipline improves over time.
            sla_days = 5
            closure_days = RNG.choice([1, 2, 3, 4, 5]) if RNG.random() < lerp(0.62, 0.94, t) \
                else RNG.choice([7, 9, 12])
            recurrence = ""
            if resolved_classes and RNG.random() < lerp(0.14, 0.03, t):
                recurrence = f"F-{RNG.randint(1, max(1, fault_seq - 1)):04d}"
            faults.append({
                "fault_id": f"F-{fault_seq:04d}",
                "session_id": session_id,
                "raised_at": raised.isoformat(timespec="minutes"),
                "resolved_at": (raised + timedelta(minutes=restore)).isoformat(timespec="minutes"),
                "in_session": "true",
                "fault_class": fault_class,
                "root_cause_closed_at": (raised + timedelta(days=closure_days)).isoformat(timespec="minutes"),
                "sla_days": sla_days,
                "recurrence_of": recurrence,
            })
            resolved_classes.append(fault_class)
        if n_faults and restore_total > 0:
            cause = "control_system"
        elif RNG.random() < 0.18:
            cause = RNG.choice(DISRUPTIONS)
        lost = restore_total
        if cause in DISRUPTIONS:
            lost += RNG.randint(20, 90)
        # Nudge toward the month's availability arc without ever exceeding scheduled.
        drift = scheduled * (1 - target_availability) - lost
        lost = max(0, min(scheduled, int(lost + drift * 0.55)))
        on_time = RNG.random() < lerp(0.86, 0.99, t)
        sessions.append({
            "date": day.isoformat(),
            "session_id": session_id,
            "scheduled_minutes": scheduled,
            "productive_minutes": scheduled - lost,
            "disruption_cause": cause,
            "control_faults": n_faults,
            "fault_restore_minutes": restore_total,
            "debrief_due": "true",
            "debrief_on_time": "true" if on_time else "false",
            "debrief_usefulness": round(lerp(3.4, 4.5, t) + RNG.uniform(-0.4, 0.4), 1),
        })

write("sessions", sessions)
write("faults", faults)

releases: list[dict] = []
rel_seq = 0
for m in range(MONTHS):
    t = m / (MONTHS - 1)
    for _ in range(RNG.choice([2, 3, 3])):
        rel_seq += 1
        event_day = date(2026, 1 + m, RNG.randint(6, 27))
        event_at = datetime.combine(event_day, datetime.min.time()) + timedelta(hours=8)
        buffer_hours = lerp(9, 42, t) + RNG.uniform(-6, 10)
        lead_hours = lerp(140, 58, t) + RNG.uniform(-18, 18)
        validated = event_at - timedelta(hours=max(1.0, buffer_hours))
        intervention = RNG.random() < lerp(0.22, 0.04, t)
        pre = max(1, int(RNG.gauss(lerp(6, 13, t), 2)))
        sev1 = 1 if RNG.random() < lerp(0.14, 0.01, t) else 0
        sev2 = 1 if RNG.random() < lerp(0.34, 0.08, t) else 0
        sev3 = int(RNG.random() < lerp(0.55, 0.22, t))
        functions_total = 84
        releases.append({
            "release_id": f"SECU-2026.{rel_seq:03d}",
            "event_at": event_at.isoformat(timespec="minutes"),
            "spec_frozen_at": (validated - timedelta(hours=max(4.0, lead_hours))).isoformat(timespec="minutes"),
            "validated_at": validated.isoformat(timespec="minutes"),
            "session_day_intervention": "true" if intervention else "false",
            "rollback": "true" if (intervention and RNG.random() < 0.3) else "false",
            "defects_pre_release": pre,
            "escaped_sev1": sev1,
            "escaped_sev2": sev2,
            "escaped_sev3": sev3,
            "hil_cases_run": int(lerp(40, 128, t)),
            "hil_cases_passed": int(lerp(40, 128, t)) - (1 if RNG.random() < 0.25 else 0),
            "functions_total": functions_total,
            "functions_automated": int(functions_total * lerp(0.31, 0.74, t)),
        })
write("releases", releases)

config = []
for m in range(MONTHS):
    t = m / (MONTHS - 1)
    tracked = 412
    undocumented = max(0, int(lerp(31, 2, t) + RNG.uniform(-2, 2)))
    documented = int(lerp(18, 46, t))
    car_release = date(2026, 1 + m, RNG.randint(2, 10))
    config.append({
        "date": date(2026, 1 + m, 28).isoformat(),
        "tracked_items": tracked,
        "matched_items": tracked - undocumented - documented,
        "documented_diffs": documented,
        "undocumented_diffs": undocumented,
        "car_release_date": car_release.isoformat(),
        "dil_baseline_date": (car_release + timedelta(days=int(lerp(26, 8, t)))).isoformat(),
    })
write("config", config)

coverage = []
for q, month in enumerate((3, 6, 8)):
    t = q / 2
    for model in ("brake-by-wire", "differential", "power-steering"):
        base = lerp(64, 92, t) + RNG.uniform(-4, 4)
        coverage.append({
            "date": date(2026, month, 25).isoformat(),
            "model": model,
            "decision_pct": round(min(99, base + 4), 1),
            "condition_pct": round(min(99, base + 2), 1),
            "mcdc_pct": round(max(40, base - 7), 1),
            "signal_range_pct": round(min(100, base + 6), 1),
        })
write("coverage", coverage)

documentation = []
for m in range(MONTHS):
    t = m / (MONTHS - 1)
    identified = int(lerp(48, 64, t))
    documentation.append({
        "date": date(2026, 1 + m, 28).isoformat(),
        "differences_identified": identified,
        "differences_documented": int(identified * lerp(0.33, 0.94, t)),
        "pages_total": int(lerp(22, 58, t)),
        "pages_fresh": int(lerp(22, 58, t) * lerp(0.72, 0.91, t)),
        "procedures_identified": 17,
        "sops_signed_off": int(lerp(3, 16, t)),
    })
write("documentation", documentation)

survey = []
groups = [("Drivers", 4), ("Race engineers", 6), ("Vehicle performance", 5), ("Simulator section lead", 2)]
for q, month in enumerate((3, 6, 8)):
    t = q / 2
    for group, respondents in groups:
        base = lerp(3.4, 4.35, t) + RNG.uniform(-0.2, 0.2)
        survey.append({
            "date": date(2026, month, 26).isoformat(),
            "rater_group": group,
            "respondents": respondents,
            "clarity": round(min(5, base + 0.15), 2),
            "responsiveness": round(min(5, base + 0.25), 2),
            "fidelity_confidence": round(min(5, base - 0.1), 2),
            "overall": round(min(5, base), 2),
        })
write("survey", survey)

correlation = []
for q, month in enumerate((3, 6, 8)):
    t = q / 2
    for channel in ("brake pressure", "steering torque", "diff lock", "throttle map"):
        correlation.append({
            "date": date(2026, month, 26).isoformat(),
            "channel": channel,
            "sim_vs_track_delta_pct": round(lerp(5.4, 1.9, t) + RNG.uniform(-0.5, 0.5), 2),
        })
write("correlation", correlation)

development = []
for q, month in enumerate((3, 6, 8)):
    t = q / 2
    development.append({
        "date": date(2026, month, 30 if month != 8 else 24).isoformat(),
        "tool": ["HIL regression harness", "Config diff tool", "Session log automation"][q],
        "items_committed": 3,
        "items_delivered": [2, 3, 2][q],
        "setup_minutes_before": [45, 45, 38][q],
        "setup_minutes_after": [45, 34, 22][q],
        "config_errors_before": [12, 12, 7][q],
        "config_errors_after": [12, 7, 3][q],
        "cross_tasks": [1, 3, 4][q],
    })
write("development", development)
