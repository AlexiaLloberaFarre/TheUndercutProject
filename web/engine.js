/* Metric engine — the browser mirror of kpi_framework/metrics.py + scoring.py.
   Every formula here has a Python twin, and tests/test_parity.py runs both over
   the same records and fails if any value disagrees. Change one, change both. */
const KPI = (() => {
  'use strict';

  const NUMERIC = new Set(['scheduled_minutes','productive_minutes','control_faults','fault_restore_minutes',
    'debrief_usefulness','defects_pre_release','escaped_sev1','escaped_sev2','escaped_sev3','hil_cases_run',
    'hil_cases_passed','functions_total','functions_automated','sla_days','tracked_items','matched_items',
    'documented_diffs','undocumented_diffs','decision_pct','condition_pct','mcdc_pct','signal_range_pct',
    'differences_identified','differences_documented','pages_total','pages_fresh','procedures_identified',
    'sops_signed_off','respondents','clarity','responsiveness','fidelity_confidence','overall',
    'sim_vs_track_delta_pct','items_committed','items_delivered','setup_minutes_before','setup_minutes_after',
    'config_errors_before','config_errors_after','cross_tasks']);
  const DATETIMES = new Set(['raised_at','resolved_at','root_cause_closed_at','spec_frozen_at','validated_at','event_at']);
  const DATES = new Set(['date','car_release_date','dil_baseline_date']);
  const BOOLEANS = new Set(['session_day_intervention','rollback','in_session','debrief_due','debrief_on_time']);
  const TRUE = new Set(['1','true','yes','y','t']);
  const ANONYMITY_FLOOR = 3;

  /* ---- parsing (UTC only, so a viewer's timezone can never shift a period) */
  function parseDate(value) {
    if (value instanceof Date) return value;
    if (typeof value !== 'string' || !value.trim()) return null;
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
  }

  function coerceRow(row) {
    const out = {};
    for (const [col, raw] of Object.entries(row)) {
      if (!col) continue;
      const value = typeof raw === 'string' ? raw.trim() : raw;
      if (NUMERIC.has(col)) {
        out[col] = (value === '' || value === null || value === undefined) ? null : Number(value);
      } else if (BOOLEANS.has(col)) {
        out[col] = typeof value === 'boolean' ? value : TRUE.has(String(value).toLowerCase());
      } else {
        out[col] = value;
      }
    }
    return out;
  }

  function rowDate(row) {
    for (const col of ['date', 'event_at', 'raised_at']) {
      const parsed = parseDate(row[col]);
      if (parsed) return parsed;
    }
    return null;
  }

  function periodKey(date, period) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    if (period === 'quarter') return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function groupByPeriod(rows, period) {
    const buckets = new Map();
    for (const row of rows) {
      const when = rowDate(row);
      if (!when) continue;
      const key = periodKey(when, period);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(row);
    }
    return new Map([...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  }

  /* ---- numeric helpers (null means "no data", never zero) ---------------- */
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const values = (rows, col) => rows.map((r) => r[col]).filter(isNum);
  const sumOf = (rows, col) => { const v = values(rows, col); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
  const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  function median(v) {
    if (!v.length) return null;
    const s = [...v].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }
  function percentile(v, pct) {
    if (!v.length) return null;
    const s = [...v].sort((a, b) => a - b);
    if (s.length === 1) return s[0];
    const pos = (s.length - 1) * pct;
    const low = Math.floor(pos);
    const high = Math.min(low + 1, s.length - 1);
    return s[low] + (s[high] - s[low]) * (pos - low);
  }
  const ratio = (num, den, scale = 100) => (num === null || num === undefined || !den ? null : (num / den) * scale);
  const countWhere = (rows, fn) => rows.filter(fn).length;
  function latest(rows) {
    const dated = rows.map((r) => [rowDate(r), r]).filter(([d]) => d);
    if (!dated.length) return null;
    dated.sort((a, b) => a[0] - b[0]);           // stable: last of a tie wins
    return dated[dated.length - 1][1];
  }
  function hoursBetween(a, b) {
    const start = parseDate(a); const end = parseDate(b);
    if (!start || !end) return null;
    return (end - start) / 3600000;
  }
  function daysBetween(a, b) {
    const start = parseDate(a); const end = parseDate(b);
    if (!start || !end) return null;
    const d0 = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const d1 = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    return (d1 - d0) / 86400000;
  }
  const spans = (rows, a, b, fn) => rows.map((r) => fn(r[a], r[b])).filter((v) => v !== null);

  function lostMinutes(row) {
    if (!isNum(row.scheduled_minutes) || !isNum(row.productive_minutes)) return 0;
    return row.scheduled_minutes - row.productive_minutes;
  }

  /* ---- dataset formulas -------------------------------------------------- */
  function sessionsMetrics(rows) {
    const scheduled = sumOf(rows, 'scheduled_minutes');
    const productive = sumOf(rows, 'productive_minutes');
    const faults = sumOf(rows, 'control_faults');
    const restore = sumOf(rows, 'fault_restore_minutes');
    const sessionCount = rows.length;
    const controlLoss = countWhere(rows, (r) => r.disruption_cause === 'control_system' && lostMinutes(r) > 0);
    const debriefDue = countWhere(rows, (r) => r.debrief_due === true);
    const debriefOnTime = countWhere(rows, (r) => r.debrief_due === true && r.debrief_on_time === true);
    return {
      session_count: sessionCount || null,
      scheduled_minutes: scheduled,
      productive_minutes: productive,
      lost_minutes: scheduled === null || productive === null ? null : scheduled - productive,
      availability_pct: ratio(productive, scheduled),
      control_loss_count: controlLoss,
      control_loss_pct: ratio(controlLoss, sessionCount || null),
      mtbf_hours: productive === null || !faults ? null : (productive / 60) / faults,
      mttr_minutes: restore === null || !faults ? null : restore / faults,
      debrief_on_time_pct: ratio(debriefOnTime, debriefDue || null),
      debrief_usefulness_mean: mean(values(rows, 'debrief_usefulness')),
    };
  }

  function releasesMetrics(rows) {
    const count = rows.length;
    const clean = countWhere(rows, (r) => !r.session_day_intervention && !r.rollback);
    const pre = sumOf(rows, 'defects_pre_release') || 0;
    const sev1 = sumOf(rows, 'escaped_sev1') || 0;
    const sev2 = sumOf(rows, 'escaped_sev2') || 0;
    const sev3 = sumOf(rows, 'escaped_sev3') || 0;
    const escaped = sev1 + sev2 + sev3;
    const leadTimes = spans(rows, 'spec_frozen_at', 'validated_at', hoursBetween);
    const buffers = spans(rows, 'validated_at', 'event_at', hoursBetween);
    const last = latest(rows) || {};
    return {
      release_count: count || null,
      release_ftpr_pct: ratio(clean, count || null),
      defect_detection_efficiency_pct: count ? ratio(pre, (pre + escaped) || null) : null,
      sev1_escapes: count ? sev1 : null,
      escaped_defects: count ? escaped : null,
      escaped_per_release: count ? escaped / count : null,
      release_lead_time_hours_median: median(leadTimes),
      release_buffer_hours_median: median(buffers),
      release_buffer_compliance_pct: ratio(buffers.filter((b) => b >= 24).length, buffers.length || null),
      hil_pass_rate_pct: ratio(sumOf(rows, 'hil_cases_passed'), sumOf(rows, 'hil_cases_run')),
      hil_automation_coverage_pct: ratio(isNum(last.functions_automated) ? last.functions_automated : null,
                                         isNum(last.functions_total) ? last.functions_total : null),
    };
  }

  function faultsMetrics(rows) {
    const inSession = rows.filter((r) => r.in_session === true);
    const resolution = spans(inSession, 'raised_at', 'resolved_at',
      (a, b) => { const h = hoursBetween(a, b); return h === null ? null : h * 60; });
    const resolved = rows.filter((r) => parseDate(r.resolved_at));
    const rootCauseDays = spans(rows, 'raised_at', 'root_cause_closed_at', daysBetween);
    const withinSla = countWhere(rows, (r) => {
      const days = daysBetween(r.raised_at, r.root_cause_closed_at);
      return days !== null && days <= (isNum(r.sla_days) ? r.sla_days : 5);
    });
    const recurrences = countWhere(rows, (r) => String(r.recurrence_of || '').trim() !== '');
    return {
      fault_count: rows.length || null,
      fault_resolution_minutes_median: median(resolution),
      fault_resolution_minutes_p90: percentile(resolution, 0.9),
      root_cause_days_median: median(rootCauseDays),
      root_cause_closure_pct: ratio(withinSla, resolved.length || null),
      fault_recurrence_pct: ratio(recurrences, resolved.length || null),
    };
  }

  function configMetrics(rows) {
    const last = latest(rows);
    const currency = spans(rows, 'car_release_date', 'dil_baseline_date', daysBetween);
    const out = { config_alignment_pct: null, undocumented_diff_count: null,
                  baseline_currency_days_median: median(currency) };
    if (last) {
      const tracked = last.tracked_items;
      const matched = last.matched_items || 0;
      const documented = last.documented_diffs || 0;
      if (isNum(tracked) && tracked) out.config_alignment_pct = ((matched + documented) / tracked) * 100;
      out.undocumented_diff_count = isNum(last.undocumented_diffs) ? last.undocumented_diffs : null;
    }
    return out;
  }

  function coverageMetrics(rows) {
    const latestByModel = new Map();
    for (const row of rows) {
      const when = rowDate(row);
      if (!when) continue;
      const model = String(row.model || '');
      const prev = latestByModel.get(model);
      if (!prev || (rowDate(prev) || when) <= when) latestByModel.set(model, row);
    }
    const reports = [...latestByModel.values()];
    const perModel = [];
    for (const r of reports) {
      const parts = ['decision_pct', 'condition_pct', 'mcdc_pct', 'signal_range_pct']
        .map((c) => r[c]).filter(isNum);
      if (parts.length) perModel.push(parts.reduce((a, b) => a + b, 0) / parts.length);
    }
    return {
      model_coverage_pct: mean(perModel),
      mcdc_pct: mean(values(reports, 'mcdc_pct')),
      models_reported: reports.length || null,
    };
  }

  function documentationMetrics(rows) {
    const last = latest(rows);
    if (!last) return { catalogue_completeness_pct: null, catalogue_gap: null,
                        doc_freshness_pct: null, sop_coverage_pct: null };
    const identified = last.differences_identified;
    const documented = last.differences_documented;
    const gap = isNum(identified) && isNum(documented) ? Math.max(0, identified - documented) : null;
    return {
      catalogue_completeness_pct: ratio(isNum(documented) ? documented : null, isNum(identified) ? identified : null),
      catalogue_gap: gap,
      doc_freshness_pct: ratio(last.pages_fresh, last.pages_total),
      sop_coverage_pct: ratio(last.sops_signed_off, last.procedures_identified),
    };
  }

  function surveyMetrics(rows) {
    const groups = new Map();
    for (const row of rows) {
      const key = String(row.rater_group || 'unspecified');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    const eligibleOverall = []; const eligibleFidelity = [];
    let belowFloor = 0; let respondentsTotal = 0;
    for (const groupRows of groups.values()) {
      const respondents = groupRows.reduce((a, r) => a + (r.respondents || 0), 0);
      respondentsTotal += respondents;
      if (respondents < ANONYMITY_FLOOR) { belowFloor += 1; continue; }
      const overall = mean(values(groupRows, 'overall'));
      const fidelity = mean(values(groupRows, 'fidelity_confidence'));
      if (overall !== null) eligibleOverall.push(overall);
      if (fidelity !== null) eligibleFidelity.push(fidelity);
    }
    return {
      stakeholder_satisfaction_mean: mean(eligibleOverall),
      fidelity_confidence_mean: mean(eligibleFidelity),
      survey_respondents: respondentsTotal || null,
      survey_groups_below_floor: groups.size ? belowFloor : null,
      survey_clarity_mean: mean(values(rows, 'clarity')),
      survey_responsiveness_mean: mean(values(rows, 'responsiveness')),
    };
  }

  const correlationMetrics = (rows) => ({ correlation_delta_mean: mean(values(rows, 'sim_vs_track_delta_pct')) });

  function developmentMetrics(rows) {
    const committed = sumOf(rows, 'items_committed');
    const delivered = sumOf(rows, 'items_delivered');
    const before = sumOf(rows, 'setup_minutes_before');
    const after = sumOf(rows, 'setup_minutes_after');
    const errorsBefore = sumOf(rows, 'config_errors_before');
    const errorsAfter = sumOf(rows, 'config_errors_after');
    const saved = before === null || after === null ? null : before - after;
    return {
      development_delivery_pct: ratio(delivered, committed),
      items_delivered: delivered,
      items_committed: committed,
      setup_time_reduction_pct: ratio(saved, before),
      minutes_saved_per_session: saved,
      config_error_reduction_pct: ratio(
        errorsBefore === null || errorsAfter === null ? null : errorsBefore - errorsAfter, errorsBefore),
      cross_task_count: sumOf(rows, 'cross_tasks'),
    };
  }

  const DATASET_FORMULAS = {
    sessions: sessionsMetrics, releases: releasesMetrics, faults: faultsMetrics,
    config: configMetrics, coverage: coverageMetrics, documentation: documentationMetrics,
    survey: surveyMetrics, correlation: correlationMetrics, development: developmentMetrics,
  };
  const DATASETS = Object.keys(DATASET_FORMULAS);

  function computePeriodMetrics(datasets, period) {
    const table = {};
    for (const [name, formula] of Object.entries(DATASET_FORMULAS)) {
      for (const [key, rows] of groupByPeriod(datasets[name] || [], period)) {
        table[key] = Object.assign(table[key] || {}, formula(rows));
      }
    }
    return Object.fromEntries(Object.entries(table).sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  }

  const computeAll = (datasets) => ({
    month: computePeriodMetrics(datasets, 'month'),
    quarter: computePeriodMetrics(datasets, 'quarter'),
  });

  /* ---- scoring ----------------------------------------------------------- */
  const ON_TARGET = 'on-target'; const WATCH = 'watch'; const OFF_TARGET = 'off-target';
  const BASELINE = 'baseline'; const PENDING = 'pending'; const NO_DATA = 'no-data';
  const TARGET_JUDGEMENT_DAY = 60;
  const FLAT_BAND = 0.02;

  function programmeDay(programme) {
    const start = parseDate(programme.start_date);
    if (!start) return null;
    const asOf = parseDate(programme.as_of) || new Date();
    return Math.round(daysBetween(start, asOf));
  }

  function phaseId(phases, day) {
    if (day === null) return null;
    for (const phase of phases) {
      if (day >= phase.start_day && (phase.end_day === null || day < phase.end_day)) return phase.id;
    }
    return phases[phases.length - 1].id;
  }

  const resolve = (kpi, programme) => Object.assign({}, kpi, (programme.overrides || {})[kpi.id] || {});

  function statusFor(value, direction, target, amber) {
    if (value === null || value === undefined) return NO_DATA;
    if (direction === 'up') return value >= target ? ON_TARGET : (value >= amber ? WATCH : OFF_TARGET);
    return value <= target ? ON_TARGET : (value <= amber ? WATCH : OFF_TARGET);
  }

  function kpiStatus(kpi, value, phases, programme) {
    const day = programmeDay(programme);
    const phase = phases.find((p) => p.id === kpi.phase);
    if (day !== null && phase && day < phase.start_day) return PENDING;
    if (value === null || value === undefined) return NO_DATA;
    const r = resolve(kpi, programme);
    const agreed = r.target_agreed === undefined ? !!programme.targets_agreed : !!r.target_agreed;
    if (!agreed && day !== null && day < TARGET_JUDGEMENT_DAY) return BASELINE;
    return statusFor(value, r.direction, Number(r.target), Number(r.amber));
  }

  function trendFor(current, previous, direction) {
    if (current === null || previous === null || current === undefined || previous === undefined) {
      return { delta: null, pct: null, verdict: 'new' };
    }
    const delta = current - previous;
    const pct = previous ? (delta / Math.abs(previous)) * 100 : null;
    let verdict;
    if (pct !== null && Math.abs(pct) < FLAT_BAND * 100) verdict = 'flat';
    else if (delta === 0) verdict = 'flat';
    else verdict = ((direction === 'up') ? delta > 0 : delta < 0) ? 'improving' : 'worsening';
    return { delta, pct, verdict };
  }

  function buildSeries(kpi, tables, phases, programme) {
    const r = resolve(kpi, programme);
    const period = r.period || 'month';
    const table = tables[period] || {};
    const points = Object.entries(table).map(([key, metrics]) => {
      const value = metrics[r.metric] === undefined ? null : metrics[r.metric];
      return { period: key, value, status: kpiStatus(kpi, value, phases, programme) };
    });
    const observed = points.filter((p) => p.value !== null);
    const last = observed[observed.length - 1] || null;
    const prev = observed.length > 1 ? observed[observed.length - 2] : null;

    const companions = (r.companions || []).map((companion) => {
      const cPoints = Object.entries(table).map(([key, metrics]) => ({
        period: key, value: metrics[companion.metric] === undefined ? null : metrics[companion.metric],
      }));
      const cObserved = cPoints.filter((p) => p.value !== null);
      const cLatest = cObserved.length ? cObserved[cObserved.length - 1].value : null;
      let cStatus = null;
      if (companion.direction && companion.target !== undefined && cLatest !== null) {
        const gate = kpiStatus(kpi, cLatest, phases, programme);
        cStatus = (gate === PENDING || gate === BASELINE) ? gate
          : statusFor(cLatest, companion.direction, Number(companion.target), Number(companion.amber));
      }
      return Object.assign({}, companion, { latest: cLatest, status: cStatus, points: cPoints });
    });

    return {
      id: kpi.id, period, points, companions,
      latest: last ? last.value : null,
      latest_period: last ? last.period : null,
      previous: prev ? prev.value : null,
      status: kpiStatus(kpi, last ? last.value : null, phases, programme),
      trend: trendFor(last ? last.value : null, prev ? prev.value : null, r.direction),
      target: r.target, amber: r.amber,
      target_agreed: r.target_agreed === undefined ? !!programme.targets_agreed : !!r.target_agreed,
      headline: r.headline === undefined ? !!kpi.headline : !!r.headline,
    };
  }

  function scorecard(kpis, tables, phases, programme) {
    const series = {};
    for (const kpi of kpis) series[kpi.id] = buildSeries(kpi, tables, phases, programme);
    const counts = {};
    for (const s of Object.values(series)) counts[s.status] = (counts[s.status] || 0) + 1;
    const measurable = Object.values(series).filter((s) => s.latest !== null);
    const day = programmeDay(programme);
    return {
      series, counts,
      headline_ids: kpis.filter((k) => series[k.id].headline).map((k) => k.id),
      coverage_pct: kpis.length ? (measurable.length / kpis.length) * 100 : 0,
      programme_day: day,
      phase: phaseId(phases, day),
    };
  }

  return { DATASETS, NUMERIC, DATETIMES, DATES, BOOLEANS, coerceRow, parseDate, rowDate, periodKey,
           groupByPeriod, computeAll, computePeriodMetrics, statusFor, kpiStatus, trendFor,
           buildSeries, scorecard, programmeDay, phaseId, resolve, median, percentile, mean,
           STATUS: { ON_TARGET, WATCH, OFF_TARGET, BASELINE, PENDING, NO_DATA } };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = KPI;
