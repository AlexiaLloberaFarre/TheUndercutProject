/* Interactive KPI tracker. Records, targets and the rollout checklist live in
   store.js — the shared live board when the page runs as an Artifact, this
   browser's localStorage otherwise. Every number on screen is recomputed from
   the raw records by engine.js, so a change anywhere updates the scorecard
   immediately, including one made by somebody else. */
(() => {
  'use strict';

  const P = window.PAYLOAD;

  /* ---- state ------------------------------------------------------------ */
  /* Ephemeral view state lives here; everything persisted is read through
     Store, so a snapshot from another viewer needs no plumbing of its own. */
  const state = { view: 'overview', selected: null, tables: null, card: null };
  Object.defineProperties(state, {
    datasets: { get: () => Store.datasets },
    programme: { get: () => Store.programme },
    checklist: { get: () => Store.checklist },
    filter: { get: () => Store.ui.filter },
    logDataset: { get: () => Store.ui.logDataset },
    theme: { get: () => Store.ui.theme },
  });

  /* ---- helpers ---------------------------------------------------------- */
  const esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const kpiById = (id) => P.kpis.find((k) => k.id === id);
  const categoryById = (id) => P.categories.find((c) => c.id === id);
  const accById = (id) => P.accountabilities.find((a) => a.id === id);

  const STATUS_LABEL = {
    'on-target': 'On target', watch: 'Watch', 'off-target': 'Off target',
    baseline: 'Baselining', pending: 'Not yet active', 'no-data': 'No data',
  };
  const STATUS_GLYPH = {
    'on-target': '●', watch: '▲', 'off-target': '■', baseline: '◇', pending: '○', 'no-data': '·',
  };
  const TREND_GLYPH = { improving: '▲', worsening: '▼', flat: '–', new: '·' };
  const TREND_LABEL = { improving: 'improving', worsening: 'worsening', flat: 'flat', new: 'first reading' };
  const STATUS_ORDER = ['off-target', 'watch', 'on-target', 'baseline', 'pending', 'no-data'];

  function fmt(value, decimals) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals || 0,
    });
  }
  const unitSuffix = (unit) => (unit === '%' || unit === '' ? unit : ` ${unit}`);

  function statusChip(status, extra = '') {
    return `<span class="chip s-${status} ${extra}"><span class="glyph" aria-hidden="true">${STATUS_GLYPH[status]}</span>${esc(STATUS_LABEL[status])}</span>`;
  }
  function trendTag(trend, decimals, unit, compact) {
    const showDelta = trend.delta !== null && trend.verdict !== 'flat' && trend.verdict !== 'new';
    const delta = showDelta
      ? `${trend.delta > 0 ? '+' : ''}${fmt(trend.delta, Math.max(1, decimals || 0))}${unitSuffix(unit)}` : '';
    const label = compact ? delta || TREND_LABEL[trend.verdict] : `${TREND_LABEL[trend.verdict]}${delta ? ` ${delta}` : ''}`;
    return `<span class="trend ${trend.verdict}" title="${esc(TREND_LABEL[trend.verdict])} vs previous period"><span aria-hidden="true">${TREND_GLYPH[trend.verdict]}</span>${esc(label)}</span>`;
  }

  function recompute() {
    state.tables = KPI.computeAll(state.datasets);
    state.card = KPI.scorecard(P.kpis, state.tables, P.phases, state.programme);
  }

  function toast(message) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  /* ---- charts ----------------------------------------------------------- */
  /* One series, drawn as a 2px line against a dashed target reference. Target
     is a reference line, not a second series — never a second y-axis. */
  function sparkline(points, kpi, series) {
    const observed = points.filter((p) => p.value !== null);
    if (observed.length < 2) return '<div class="muted" style="font-size:11px">not enough periods yet</div>';
    const W = 200; const H = 34; const pad = 3;
    const values = observed.map((p) => p.value).concat([Number(series.target)]);
    const min = Math.min(...values); const max = Math.max(...values);
    const span = (max - min) || 1;
    const x = (i) => pad + (i * (W - pad * 2)) / (observed.length - 1);
    const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2);
    const path = observed.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
    const last = observed[observed.length - 1];
    const tips = observed.map((p, i) => `<rect x="${(x(i) - 5).toFixed(1)}" y="0" width="10" height="${H}" fill="transparent"><title>${esc(p.period)}: ${fmt(p.value, kpi.decimals)}${unitSuffix(kpi.unit)}</title></rect>`).join('');
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(kpi.name)} trend across ${observed.length} periods">
      <line x1="0" y1="${y(series.target).toFixed(1)}" x2="${W}" y2="${y(series.target).toFixed(1)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>
      <path d="${path}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${x(observed.length - 1).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="3" fill="var(--series-1)" stroke="var(--surface)" stroke-width="2"/>
      ${tips}</svg>`;
  }

  /* Round tick values, clamped to the drawn range — never 90.1 / 94.5 / 99.0. */
  function niceTicks(min, max, count) {
    const raw = (max - min) / Math.max(1, count - 1);
    const mag = 10 ** Math.floor(Math.log10(Math.abs(raw) || 1));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10;
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
    return ticks.length >= 2 ? ticks : [min, max];
  }

  function trendChart(points, kpi, series) {
    const observed = points.filter((p) => p.value !== null);
    if (!observed.length) return '<p class="muted">No readings yet for this KPI.</p>';
    const W = 680; const H = 240;
    const m = { top: 14, right: 54, bottom: 26, left: 46 };
    const values = observed.map((p) => p.value).concat([Number(series.target), Number(series.amber)]);
    let min = Math.min(...values); let max = Math.max(...values);
    const pad = (max - min) * 0.14 || Math.abs(max * 0.1) || 1;
    min -= pad; max += pad;
    if (kpi.unit === '%' ) { max = Math.min(max, 101); }
    if (min > 0 && min < (max - min) * 0.35) min = 0;
    const span = (max - min) || 1;
    const x = (i) => m.left + (observed.length === 1 ? (W - m.left - m.right) / 2
      : (i * (W - m.left - m.right)) / (observed.length - 1));
    const y = (v) => m.top + (H - m.top - m.bottom) * (1 - (v - min) / span);

    const ticks = niceTicks(min, max, 3).map((v) =>
      `<g><line x1="${m.left}" y1="${y(v).toFixed(1)}" x2="${W - m.right}" y2="${y(v).toFixed(1)}" stroke="var(--grid)" stroke-width="1" vector-effect="non-scaling-stroke"/>
       <text x="${m.left - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="10" font-family="var(--font-mono)" fill="var(--muted)">${fmt(v, kpi.decimals)}</text></g>`).join('');

    const band = `<rect x="${m.left}" y="${Math.min(y(Number(series.target)), y(Number(series.amber))).toFixed(1)}" width="${W - m.left - m.right}" height="${Math.abs(y(Number(series.amber)) - y(Number(series.target))).toFixed(1)}" fill="var(--warn)" opacity="0.07"/>`;
    const targetLine = `<line x1="${m.left}" y1="${y(Number(series.target)).toFixed(1)}" x2="${W - m.right}" y2="${y(Number(series.target)).toFixed(1)}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>
      <text x="${W - m.right + 6}" y="${(y(Number(series.target)) + 4).toFixed(1)}" font-size="10" font-family="var(--font-mono)" fill="var(--muted)">target</text>`;

    const line = observed.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
    const dots = observed.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="4" fill="var(--series-1)" stroke="var(--surface)" stroke-width="2"/>`).join('');
    const step = Math.ceil(observed.length / 8);
    const labels = observed.map((p, i) => (i % step === 0 || i === observed.length - 1)
      ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--muted)">${esc(p.period)}</text>` : '').join('');
    const last = observed[observed.length - 1];
    const lastLabel = `<text x="${(x(observed.length - 1) + 9).toFixed(1)}" y="${(y(last.value) - 8).toFixed(1)}" font-size="12" font-weight="600" font-family="var(--font-mono)" fill="var(--ink)">${fmt(last.value, kpi.decimals)}</text>`;
    const hover = observed.map((p, i) => `<rect class="hit" data-i="${i}" x="${(x(i) - (W - m.left - m.right) / (observed.length * 2) - 2).toFixed(1)}" y="${m.top}" width="${Math.max(12, (W - m.left - m.right) / observed.length).toFixed(1)}" height="${H - m.top - m.bottom}" fill="transparent"/>`).join('');

    const meta = esc(JSON.stringify({
      points: observed.map((p) => ({ period: p.period, value: p.value, status: p.status })),
      decimals: kpi.decimals, unit: kpi.unit, W, H, m,
    }));
    return `<div class="chart" data-chart="trend" data-meta="${meta}">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(kpi.name)} by ${esc(series.period)}">
        ${ticks}${band}${targetLine}
        <line class="cross" x1="0" y1="${m.top}" x2="0" y2="${H - m.bottom}" stroke="var(--axis)" stroke-width="1" opacity="0" vector-effect="non-scaling-stroke"/>
        <path d="${line}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        ${dots}${lastLabel}${labels}${hover}
      </svg>
      <div class="tip"></div>
      <div class="legend" style="margin-top:8px">
        <span class="key"><i style="background:var(--series-1)"></i>Measured (${esc(series.period === 'quarter' ? 'quarterly' : 'monthly')})</span>
        <span class="key"><i class="dash"></i>Target ${fmt(series.target, kpi.decimals)}${unitSuffix(kpi.unit)}</span>
        <span class="key"><i style="background:var(--warn);opacity:.35"></i>Watch band to ${fmt(series.amber, kpi.decimals)}${unitSuffix(kpi.unit)}</span>
      </div>
    </div>`;
  }

  function wireCharts(root) {
    $$('.chart[data-chart="trend"]', root).forEach((chart) => {
      const meta = JSON.parse(chart.dataset.meta);
      const svg = $('svg', chart);
      const tip = $('.tip', chart);
      const cross = $('.cross', chart);
      const show = (i, clientX) => {
        const p = meta.points[i];
        if (!p) return;
        const rect = chart.getBoundingClientRect();
        tip.innerHTML = `<div class="k">${esc(p.period)}</div><div class="v">${fmt(p.value, meta.decimals)}${unitSuffix(meta.unit)}</div><div style="margin-top:4px">${statusChip(p.status)}</div>`;
        tip.style.left = `${Math.min(Math.max(clientX - rect.left, 70), rect.width - 70)}px`;
        tip.style.top = `${rect.height * 0.55}px`;
        tip.classList.add('on');
        const xFrac = meta.m.left + (meta.points.length === 1 ? 0 : (i * (meta.W - meta.m.left - meta.m.right)) / (meta.points.length - 1));
        cross.setAttribute('x1', xFrac); cross.setAttribute('x2', xFrac);
        cross.setAttribute('opacity', '1');
      };
      svg.addEventListener('mousemove', (e) => {
        const hit = e.target.closest('.hit');
        if (hit) show(Number(hit.dataset.i), e.clientX);
      });
      svg.addEventListener('mouseleave', () => { tip.classList.remove('on'); cross.setAttribute('opacity', '0'); });
    });
  }

  /* ---- views ------------------------------------------------------------ */
  function programmeStrip() {
    const day = state.card.programme_day;
    const current = state.card.phase;
    return `<div class="programme">${P.phases.map((phase) => {
      const done = day !== null && phase.end_day !== null && day >= phase.end_day;
      const isCurrent = phase.id === current;
      let progress = 0;
      if (isCurrent && day !== null && phase.end_day !== null) {
        progress = Math.min(100, ((day - phase.start_day) / (phase.end_day - phase.start_day)) * 100);
      } else if (isCurrent) progress = 100;
      return `<div class="phase ${done ? 'done' : ''} ${isCurrent ? 'current' : ''}">
        <div class="id">${esc(phase.id)}${done ? ' ✓' : ''}</div>
        <div class="name">${esc(phase.name)}</div>
        <div class="window">${esc(phase.window)}</div>
        ${isCurrent ? `<div class="bar" style="width:${progress.toFixed(0)}%"></div>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  function tile(kpi) {
    const s = state.card.series[kpi.id];
    const value = s.latest === null ? '—' : fmt(s.latest, kpi.decimals);
    return `<button class="tile s-${s.status}" data-open="${esc(kpi.id)}">
      <div class="eyebrow">${esc(kpi.id)} · ${esc(categoryById(kpi.category).name)}</div>
      <div class="name">${esc(kpi.name)}</div>
      <div class="value"><span class="v">${value}</span><span class="u">${esc(kpi.unit)}</span></div>
      <div class="meta">${statusChip(s.status)}${trendTag(s.trend, kpi.decimals, kpi.unit, true)}</div>
      ${sparkline(s.points, kpi, s)}
      <div class="meta"><span class="num">${esc(s.latest_period || '—')}</span><span>target ${fmt(s.target, kpi.decimals)}${unitSuffix(kpi.unit)}${s.target_agreed ? '' : ' (illustrative)'}</span></div>
    </button>`;
  }

  function viewOverview() {
    const headline = P.kpis.filter((k) => state.card.series[k.id].headline);
    const attention = P.kpis
      .map((k) => ({ kpi: k, s: state.card.series[k.id] }))
      .filter((r) => r.s.status === 'off-target' || r.s.status === 'watch')
      .sort((a, b) => STATUS_ORDER.indexOf(a.s.status) - STATUS_ORDER.indexOf(b.s.status));
    const counts = state.card.counts;
    const total = P.kpis.length;

    const rollup = STATUS_ORDER.filter((s) => counts[s]).map((s) =>
      `<span class="key" style="display:inline-flex;align-items:center;gap:6px">${statusChip(s)}<span class="num">${counts[s]}</span></span>`).join('');

    const matrix = P.categories.map((c) => {
      const dots = P.kpis.filter((k) => k.category === c.id).map((k) => {
        const s = state.card.series[k.id];
        return `<button class="dot s-${s.status}" data-open="${esc(k.id)}" title="${esc(k.name)} — ${esc(STATUS_LABEL[s.status])}">${esc(k.id.split('.')[1])}</button>`;
      }).join('');
      return `<div class="cat">${esc(c.id)} · ${esc(c.name)}</div><div class="dots">${dots}</div>`;
    }).join('');

    const empty = Store.recordCount === 0 ? `
      <div class="panel" style="margin-bottom:22px">
        <div class="panel-body" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:240px">
            <h2 style="font-size:15px;margin-bottom:4px">Nothing logged yet</h2>
            <p class="muted" style="margin:0;font-size:13px">
              The framework is here; the readings are not. Log a session, import a CSV of existing
              records, or start with the measurement plan and add data as the phases open up.</p>
          </div>
          <button class="btn btn-primary" data-view-jump="log">Log the first record</button>
          <button class="btn" data-view-jump="rollout">See the rollout plan</button>
        </div>
      </div>` : '';

    return `
      ${empty}
      <div class="section">
        <span class="eyebrow">Rollout position</span>
        ${programmeStrip()}
        <p class="muted" style="margin:9px 0 0;font-size:12.5px">
          ${state.card.programme_day === null
            ? 'Set a programme start date in the header to activate the 30/60/90 staging.'
            : `Day ${state.card.programme_day} · ${esc(P.phases.find((p) => p.id === state.card.phase).intent)}`}
        </p>
      </div>

      <div class="section">
        <span class="eyebrow">Headline scorecard — ${headline.length} of ${total} KPIs</span>
        <div class="tiles">${headline.map(tile).join('') || '<p class="muted">No headline KPIs selected. Star some in the Scorecard tab.</p>'}</div>
      </div>

      <div class="split">
        <div class="panel">
          <div class="panel-head"><h2>Needs attention</h2><span class="hint">${attention.length} of ${total} KPIs off target or on watch</span></div>
          <div class="panel-body" style="padding:0">
            ${attention.length ? `<div class="table-scroll"><table><thead><tr><th>KPI</th><th class="n">Latest</th><th class="n">Target</th><th>Status</th><th>Trend</th></tr></thead><tbody>
              ${attention.map(({ kpi, s }) => `<tr class="clickable" data-open="${esc(kpi.id)}">
                <td><strong>${esc(kpi.name)}</strong><br><span class="muted" style="font-size:11.5px">${esc(kpi.id)} · ${esc(categoryById(kpi.category).name)}</span></td>
                <td class="n">${fmt(s.latest, kpi.decimals)}${unitSuffix(kpi.unit)}</td>
                <td class="n">${fmt(s.target, kpi.decimals)}${unitSuffix(kpi.unit)}</td>
                <td>${statusChip(s.status)}</td>
                <td>${trendTag(s.trend, kpi.decimals, kpi.unit)}</td></tr>`).join('')}
            </tbody></table></div>` : '<div class="panel-body"><p class="muted">Nothing off target. Either the rig is behaving, or the targets need to be harder.</p></div>'}
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>All 22 by category</h2></div>
          <div class="panel-body">
            <div class="legend" style="margin-bottom:12px">${rollup}</div>
            <div class="matrix">${matrix}</div>
            <p class="muted" style="font-size:12px;margin:14px 0 0">${fmt(state.card.coverage_pct, 0)}% of KPIs currently have data. A KPI you cannot measure cleanly by day 60 should be redesigned or dropped.</p>
          </div>
        </div>
      </div>`;
  }

  function viewScorecard() {
    const q = state.filter.q.toLowerCase();
    const shown = P.kpis.filter((k) => {
      if (state.filter.category !== 'all' && k.category !== state.filter.category) return false;
      if (state.filter.headlineOnly && !state.card.series[k.id].headline) return false;
      if (q && !(`${k.id} ${k.name} ${k.what} ${k.method}`.toLowerCase().includes(q))) return false;
      return true;
    });

    const groups = P.categories.map((c) => {
      const rows = shown.filter((k) => k.category === c.id);
      if (!rows.length) return '';
      return `<tr><th colspan="7" style="background:var(--surface-2);position:static;color:var(--ink);font-family:var(--font-display);font-size:11px">
          ${esc(c.id)} · ${esc(c.name)} <span class="muted" style="text-transform:none;letter-spacing:0;font-family:var(--font-body)">— ${esc(c.intent)}</span></th></tr>
        ${rows.map((k) => {
          const s = state.card.series[k.id];
          return `<tr class="clickable" data-open="${esc(k.id)}">
            <td><button class="btn btn-ghost" data-star="${esc(k.id)}" title="${s.headline ? 'Remove from headline set' : 'Add to headline set'}" style="padding:2px 4px;color:${s.headline ? 'var(--accent)' : 'var(--muted)'}">${s.headline ? '★' : '☆'}</button></td>
            <td><strong>${esc(k.name)}</strong><br><span class="muted" style="font-size:11.5px">${esc(k.id)} · ${k.accountabilities.map(esc).join(' ')} · ${esc(k.cadence)}</span></td>
            <td class="n">${fmt(s.latest, k.decimals)}${unitSuffix(k.unit)}<br><span class="muted" style="font-size:11px">${esc(s.latest_period || '')}</span></td>
            <td class="n">${fmt(s.target, k.decimals)}${s.target_agreed ? '' : '<br><span class="muted" style="font-size:10px">illustrative</span>'}</td>
            <td>${statusChip(s.status)}</td>
            <td>${trendTag(s.trend, k.decimals, k.unit)}</td>
            <td class="muted" style="font-size:11.5px;max-width:220px">${esc(k.method)}</td></tr>`;
        }).join('')}`;
    }).join('');

    return `<div class="panel">
      <div class="panel-head">
        <h2>Full scorecard</h2>
        <div class="toolbar" style="margin-left:auto">
          <input type="text" id="f-q" placeholder="search KPIs…" value="${esc(state.filter.q)}" style="width:170px">
          <select id="f-cat"><option value="all">All categories</option>${P.categories.map((c) => `<option value="${esc(c.id)}" ${state.filter.category === c.id ? 'selected' : ''}>${esc(c.id)} · ${esc(c.name)}</option>`).join('')}</select>
          <label class="control" style="gap:5px"><input type="checkbox" id="f-head" ${state.filter.headlineOnly ? 'checked' : ''}> <span>Headline only</span></label>
        </div>
      </div>
      <div class="table-scroll"><table>
        <thead><tr><th style="width:34px"></th><th>KPI</th><th class="n">Latest</th><th class="n">Target</th><th>Status</th><th>Trend</th><th>How it is measured</th></tr></thead>
        <tbody>${groups || '<tr><td colspan="7" class="muted" style="padding:20px">Nothing matches that filter.</td></tr>'}</tbody>
      </table></div>
      <div class="panel-body" style="border-top:1px solid var(--line)">
        <p class="muted" style="margin:0;font-size:12px">★ marks the headline set — start with 6–8, not 22. ${esc(P.meta.disclaimer)}</p>
      </div>
    </div>`;
  }

  function viewLog() {
    const name = state.logDataset;
    const spec = DATASET_FIELDS[name];
    const rows = state.datasets[name] || [];
    const feeds = P.kpis.filter((k) => k.dataset === name);
    const recent = [...rows].slice(-10).reverse();
    const columns = spec.fields.map((f) => f.name);

    const live = Store.mode === 'live';
    const budget = live
      ? `${Store.recordCount.toLocaleString()} of ${Store.docBudget.toLocaleString()} records on the board`
      : `${Store.recordCount.toLocaleString()} records in this browser`;

    return `<div class="split-even">
      <div class="panel">
        <div class="panel-head"><h2>Log a record</h2><span class="hint">${rows.length} rows in ${esc(name)} · ${esc(budget)}</span></div>
        <div class="panel-body">
          <div class="field" style="margin-bottom:14px">
            <label for="ds">Dataset</label>
            <select id="ds">${KPI.DATASETS.map((d) => `<option value="${esc(d)}" ${d === name ? 'selected' : ''}>${esc(DATASET_FIELDS[d].label)}</option>`).join('')}</select>
            <span class="help">${esc(spec.help)}</span>
          </div>
          <div class="legend" style="margin-bottom:14px">${feeds.map((k) => `<span class="chip plain">${esc(k.id)} ${esc(k.name)}</span>`).join('') || '<span class="muted" style="font-size:12px">Feeds companion metrics only.</span>'}</div>
          <form id="entry" class="form-grid">
            ${spec.fields.map((f) => {
              const label = `<label for="in-${esc(f.name)}">${esc(f.name.replace(/_/g, ' '))}</label>`;
              if (f.type === 'select') {
                return `<div class="field">${label}<select id="in-${esc(f.name)}" name="${esc(f.name)}">${f.options.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`;
              }
              if (f.type === 'bool') {
                return `<div class="field">${label}<select id="in-${esc(f.name)}" name="${esc(f.name)}"><option value="true" ${f.default ? 'selected' : ''}>true</option><option value="false" ${f.default ? '' : 'selected'}>false</option></select></div>`;
              }
              const type = f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : (f.type === 'datetime' ? 'datetime-local' : 'text'));
              const extra = f.step ? ` step="${f.step}"` : (f.type === 'number' ? ' step="any"' : '');
              return `<div class="field">${label}<input id="in-${esc(f.name)}" name="${esc(f.name)}" type="${type}"${extra} value="${esc(f.default === undefined ? '' : f.default)}" placeholder="${esc(f.placeholder || '')}">${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`;
            }).join('')}
          </form>
          <div class="toolbar" style="margin-top:14px">
            <button class="btn btn-primary" id="add-row">Add record</button>
            <button class="btn" id="import-btn">Import CSV…</button>
            <input type="file" id="import-file" accept=".csv,text/csv" class="sr">
            <button class="btn" id="export-btn">Show as CSV</button>
            ${live ? `<button class="btn btn-ghost" id="clear-dataset" style="margin-left:auto">Clear ${esc(name)}</button>`
                   : '<button class="btn btn-ghost" id="reset-seed" style="margin-left:auto">Reset all data to seed</button>'}
          </div>
          <div id="csv-out"></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Recent records</h2><span class="hint">newest first</span></div>
        <div class="table-scroll"><table>
          <thead><tr><th style="width:32px"></th>${columns.map((c) => `<th${['date'].includes(c) ? '' : ' class="n"'}>${esc(c.replace(/_/g, ' '))}</th>`).join('')}</tr></thead>
          <tbody>${recent.length ? recent.map((row) => {
            const index = rows.indexOf(row);
            return `<tr><td><button class="btn btn-ghost" data-del="${index}" title="Delete this record">✕</button></td>${columns.map((c) => {
              const v = row[c];
              const isNum = typeof v === 'number';
              return `<td${isNum ? ' class="n"' : ''}>${esc(v === null || v === undefined ? '' : (isNum ? fmt(v, Number.isInteger(v) ? 0 : 2) : v))}</td>`;
            }).join('')}</tr>`;
          }).join('') : `<tr><td colspan="${columns.length + 1}" class="muted" style="padding:18px">No records yet.</td></tr>`}</tbody>
        </table></div>
      </div>
    </div>`;
  }

  function viewRollout() {
    return `<div class="cards">
      ${P.phases.map((phase) => {
        const done = state.checklist[phase.id] || [];
        const complete = phase.checklist.filter((_, i) => done[i]).length;
        const activating = P.kpis.filter((k) => k.phase === phase.id);
        const isCurrent = phase.id === state.card.phase;
        return `<div class="panel" ${isCurrent ? 'style="border-color:var(--accent)"' : ''}>
          <div class="panel-head">
            <h2>${esc(phase.id)} · ${esc(phase.name)}</h2>
            <span class="hint">${esc(phase.window)} · ${complete}/${phase.checklist.length}</span>
          </div>
          <div class="panel-body">
            <p style="margin-top:0">${esc(phase.intent)}</p>
            <div class="note" style="margin-bottom:12px"><strong>Deliverable:</strong> ${esc(phase.deliverable)}</div>
            ${phase.checklist.map((item, i) => `<label class="check ${done[i] ? 'done' : ''}">
              <input type="checkbox" data-check="${esc(phase.id)}" data-i="${i}" ${done[i] ? 'checked' : ''}>
              <span>${esc(item)}</span></label>`).join('')}
            ${activating.length ? `<div style="margin-top:14px"><span class="eyebrow">KPIs that go live here</span>
              <div class="legend" style="margin-top:6px">${activating.map((k) => `<button class="chip plain" data-open="${esc(k.id)}" style="cursor:pointer">${esc(k.id)} ${esc(k.name)}</button>`).join('')}</div></div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function viewProposal() {
    const headline = P.kpis.filter((k) => state.card.series[k.id].headline);
    const rows = headline.map((k) => {
      const s = state.card.series[k.id];
      return `<tr><td>${esc(categoryById(k.category).name)}</td><td><strong>${esc(k.name)}</strong></td>
        <td>${esc(k.method)}</td><td class="n">${fmt(s.target, k.decimals)}${unitSuffix(k.unit)}</td><td>${esc(k.cadence)}</td></tr>`;
    }).join('');
    const accCoverage = P.accountabilities.map((a) => {
      const ks = P.kpis.filter((k) => k.accountabilities.includes(a.id));
      return `<li><strong>${esc(a.id)}</strong> ${esc(a.short)} — ${ks.map((k) => esc(k.id)).join(', ')}</li>`;
    }).join('');

    return `<div class="toolbar no-print" style="margin-bottom:14px">
        <button class="btn" id="print-proposal">Print / save as PDF</button>
        <span class="muted" style="font-size:12px">Edits to targets and the headline set flow straight into this page.</span>
      </div>
      <div class="paper">
        <span class="eyebrow">Proposal · draft for alignment</span>
        <h2>How we could track my contribution in this role</h2>
        <p class="muted" style="font-size:13px">${esc(P.meta.role)} · ${esc(P.meta.group)}</p>
        <div class="rule"></div>

        <h3>Purpose</h3>
        <p>To align early on how we track my contribution and how it evolves in this role. This is a first draft for you to shape — not a fixed set of targets, and not something I would want tied to pay or used to apportion blame.</p>

        <h3>Alignment</h3>
        <p>Seven measurement categories cover all eight key accountabilities of the role, and chain to the group's goal: a reliable, high-correlation simulator that wins development time.</p>
        <ul style="columns:2;font-size:12.5px">${accCoverage}</ul>

        <h3>The headline scorecard (${headline.length} of ${P.kpis.length})</h3>
        <div class="table-scroll"><table>
          <thead><tr><th>Category</th><th>KPI</th><th>How measured</th><th class="n">Proposed target</th><th>Cadence</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">No headline KPIs selected yet.</td></tr>'}</tbody>
        </table></div>
        <p style="font-size:12.5px;margin-top:8px" class="muted">Every target above is illustrative — adapted from reliability engineering, DORA release metrics and software-quality practice — until baselined against our systems. The remaining ${P.kpis.length - headline.length} KPIs sit in an appendix and stay dormant until collection is painless.</p>

        <h3>Rollout</h3>
        <ol>${P.phases.map((p) => `<li><strong>${esc(p.window)} — ${esc(p.name)}.</strong> ${esc(p.intent)} <em>${esc(p.deliverable)}</em></li>`).join('')}</ol>

        <h3>What I would need from you</h3>
        <ul>
          <li>Which existing CSG KPI structures and systems I should plug into rather than duplicate.</li>
          <li>Which of these targets to set, soften or drop — and which KPIs are not worth the collection cost.</li>
          <li>Who should sit in the stakeholder-survey groups, and whether quarterly is the right cadence.</li>
        </ul>

        <div class="rule"></div>
        <p class="muted" style="font-size:12px">Thresholds that would change this plan: any KPI that cannot be measured cleanly within 60 days gets redesigned or dropped; a survey group returning fewer than three raters is merged to preserve anonymity; if availability baselines below ~90% the reliability KPIs take priority over the development ones until the rig is stable.</p>
      </div>`;
  }

  /* ---- KPI drawer -------------------------------------------------------- */
  function openKpi(id) {
    state.selected = id;
    renderDrawer();
  }
  function closeKpi() {
    state.selected = null;
    $('#drawer-root').innerHTML = '';
  }

  function renderDrawer() {
    const root = $('#drawer-root');
    if (!state.selected) { root.innerHTML = ''; return; }
    const kpi = kpiById(state.selected);
    const s = state.card.series[kpi.id];
    const category = categoryById(kpi.category);
    const table = state.tables[s.period];

    const periodRows = s.points.filter((p) => p.value !== null).slice().reverse().map((p) =>
      `<tr><td class="num">${esc(p.period)}</td><td class="n">${fmt(p.value, kpi.decimals)}${unitSuffix(kpi.unit)}</td><td>${statusChip(p.status)}</td></tr>`).join('');

    const companions = s.companions.length ? `<table style="margin-top:6px"><thead><tr><th>Companion metric</th><th class="n">Latest</th><th class="n">Target</th><th>Status</th></tr></thead><tbody>
      ${s.companions.map((c) => `<tr><td>${esc(c.name)}</td><td class="n">${fmt(c.latest, c.decimals === undefined ? 1 : c.decimals)}${unitSuffix(c.unit || '')}</td>
        <td class="n">${c.target === undefined ? '—' : fmt(c.target, c.decimals === undefined ? 1 : c.decimals)}</td>
        <td>${c.status ? statusChip(c.status) : '<span class="muted">context only</span>'}</td></tr>`).join('')}</tbody></table>` : '';

    root.innerHTML = `<div class="scrim" data-close="1"></div>
      <aside class="drawer" role="dialog" aria-label="${esc(kpi.name)}">
        <div class="drawer-head">
          <div style="flex:1">
            <div class="eyebrow">${esc(kpi.id)} · ${esc(category.id)} ${esc(category.name)}</div>
            <h3>${esc(kpi.name)}</h3>
            <div class="legend" style="margin-top:7px">
              ${statusChip(s.status)}${trendTag(s.trend, kpi.decimals, kpi.unit)}
              ${kpi.accountabilities.map((a) => `<span class="chip plain" title="${esc(accById(a).text)}">${esc(a)} ${esc(accById(a).short)}</span>`).join('')}
            </div>
          </div>
          <button class="btn" data-close="1" aria-label="Close">✕</button>
        </div>
        <div class="drawer-body">
          <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px">
            <span class="num" style="font-size:38px;font-weight:600;letter-spacing:-.02em">${fmt(s.latest, kpi.decimals)}</span>
            <span class="muted">${esc(kpi.unit)}</span>
            <span class="muted" style="margin-left:auto;font-size:12px">${esc(s.latest_period || 'no reading')} · ${s.period === 'quarter' ? 'quarterly' : 'monthly'}</span>
          </div>
          ${trendChart(s.points, kpi, s)}

          <div class="panel" style="margin:18px 0;box-shadow:none">
            <div class="panel-head"><h2>Target</h2><span class="hint">${s.target_agreed ? 'agreed with manager' : 'illustrative — not yet agreed'}</span></div>
            <div class="panel-body">
              <div class="form-grid">
                <div class="field"><label for="t-target">Target (${esc(kpi.direction === 'up' ? 'at least' : 'at most')})</label>
                  <input id="t-target" type="number" step="any" value="${esc(s.target)}"></div>
                <div class="field"><label for="t-amber">Watch threshold</label>
                  <input id="t-amber" type="number" step="any" value="${esc(s.amber)}"></div>
                <div class="field"><label for="t-agreed">Status</label>
                  <select id="t-agreed"><option value="0" ${s.target_agreed ? '' : 'selected'}>Illustrative</option><option value="1" ${s.target_agreed ? 'selected' : ''}>Agreed</option></select></div>
                <div class="field"><label for="t-head">Headline set</label>
                  <select id="t-head"><option value="1" ${s.headline ? 'selected' : ''}>Headline KPI</option><option value="0" ${s.headline ? '' : 'selected'}>Appendix</option></select></div>
              </div>
              <div class="toolbar" style="margin-top:12px">
                <button class="btn btn-primary" id="t-save">Save</button>
                <button class="btn btn-ghost" id="t-reset">Reset to framework default</button>
              </div>
            </div>
          </div>

          <dl class="defn">
            <dt>What</dt><dd>${esc(kpi.what)}</dd>
            <dt>Why</dt><dd>${esc(kpi.why)}</dd>
            <dt>Method</dt><dd>${esc(kpi.method)}</dd>
            <dt>Formula</dt><dd><div class="formula">${esc(kpi.formula)}</div></dd>
            <dt>Cadence</dt><dd>${esc(kpi.cadence)}</dd>
            <dt>Tooling</dt><dd>${kpi.tools.map((t) => `<span class="chip plain">${esc(t)}</span>`).join(' ')}</dd>
            <dt>Source data</dt><dd><button class="btn" data-goto-log="${esc(kpi.dataset)}">${esc(kpi.dataset)}.csv — log a record</button></dd>
            <dt>Live from</dt><dd>${esc(P.phases.find((p) => p.id === kpi.phase).window)} (${esc(kpi.phase)})</dd>
          </dl>
          ${kpi.note ? `<div class="note" style="margin-top:14px">${esc(kpi.note)}</div>` : ''}
          ${companions ? `<h4 style="margin:20px 0 0;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">Read alongside</h4>${companions}` : ''}
          <h4 style="margin:20px 0 0;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">Every reading</h4>
          <table style="margin-top:6px"><thead><tr><th>Period</th><th class="n">Value</th><th>Status</th></tr></thead>
            <tbody>${periodRows || '<tr><td colspan="3" class="muted">No readings yet.</td></tr>'}</tbody></table>
        </div>
      </aside>`;
    wireCharts(root);
  }

  /* ---- dataset field specs ---------------------------------------------- */
  const today = () => new Date().toISOString().slice(0, 10);
  const DATASET_FIELDS = {
    sessions: { label: 'DIL sessions', help: 'One row per booked simulator session — the backbone of the reliability KPIs.',
      fields: [
        { name: 'date', type: 'date', default: today() }, { name: 'session_id', type: 'text', placeholder: 'DIL-20260824-1' },
        { name: 'scheduled_minutes', type: 'number', default: 480 }, { name: 'productive_minutes', type: 'number' },
        { name: 'disruption_cause', type: 'select', options: ['none', 'control_system', 'motion_platform', 'vehicle_model', 'it', 'other'], help: 'Only control_system counts against this role.' },
        { name: 'control_faults', type: 'number', default: 0 }, { name: 'fault_restore_minutes', type: 'number', default: 0 },
        { name: 'debrief_due', type: 'bool', default: true }, { name: 'debrief_on_time', type: 'bool', default: true },
        { name: 'debrief_usefulness', type: 'number', step: '0.1', help: 'rating out of 5' }] },
    releases: { label: 'SECU releases', help: 'One row per release package prepared for an event.',
      fields: [
        { name: 'release_id', type: 'text', placeholder: 'SECU-2026.024' }, { name: 'event_at', type: 'datetime' },
        { name: 'spec_frozen_at', type: 'datetime' }, { name: 'validated_at', type: 'datetime' },
        { name: 'session_day_intervention', type: 'bool', default: false }, { name: 'rollback', type: 'bool', default: false },
        { name: 'defects_pre_release', type: 'number', default: 0 }, { name: 'escaped_sev1', type: 'number', default: 0 },
        { name: 'escaped_sev2', type: 'number', default: 0 }, { name: 'escaped_sev3', type: 'number', default: 0 },
        { name: 'hil_cases_run', type: 'number' }, { name: 'hil_cases_passed', type: 'number' },
        { name: 'functions_total', type: 'number' }, { name: 'functions_automated', type: 'number' }] },
    faults: { label: 'Control faults', help: 'One row per fault raised, in session or on the bench.',
      fields: [
        { name: 'fault_id', type: 'text', placeholder: 'F-0101' }, { name: 'session_id', type: 'text' },
        { name: 'raised_at', type: 'datetime' }, { name: 'resolved_at', type: 'datetime' },
        { name: 'in_session', type: 'bool', default: true }, { name: 'fault_class', type: 'text', placeholder: 'CAN timeout' },
        { name: 'root_cause_closed_at', type: 'datetime' }, { name: 'sla_days', type: 'number', default: 5 },
        { name: 'recurrence_of', type: 'text', help: 'fault id this repeats, if any' }] },
    config: { label: 'DIL-vs-car config audit', help: 'A snapshot of the configuration diff — the newest row in a period wins.',
      fields: [
        { name: 'date', type: 'date', default: today() }, { name: 'tracked_items', type: 'number' }, { name: 'matched_items', type: 'number' },
        { name: 'documented_diffs', type: 'number' }, { name: 'undocumented_diffs', type: 'number' },
        { name: 'car_release_date', type: 'date' }, { name: 'dil_baseline_date', type: 'date' }] },
    coverage: { label: 'Model coverage', help: 'One row per model per Simulink Coverage report.',
      fields: [
        { name: 'date', type: 'date', default: today() }, { name: 'model', type: 'text', placeholder: 'brake-by-wire' },
        { name: 'decision_pct', type: 'number' }, { name: 'condition_pct', type: 'number' },
        { name: 'mcdc_pct', type: 'number' }, { name: 'signal_range_pct', type: 'number' }] },
    documentation: { label: 'Documentation audit', help: 'A snapshot of the difference catalogue and SOP register.',
      fields: [
        { name: 'date', type: 'date', default: today() }, { name: 'differences_identified', type: 'number' },
        { name: 'differences_documented', type: 'number' }, { name: 'pages_total', type: 'number' },
        { name: 'pages_fresh', type: 'number' }, { name: 'procedures_identified', type: 'number' },
        { name: 'sops_signed_off', type: 'number' }] },
    survey: { label: 'Stakeholder survey', help: 'One row per rater group per round. Groups under three raters are excluded from the published figure.',
      fields: [
        { name: 'date', type: 'date', default: today() }, { name: 'rater_group', type: 'text', placeholder: 'Race engineers' },
        { name: 'respondents', type: 'number' }, { name: 'clarity', type: 'number', step: '0.01' },
        { name: 'responsiveness', type: 'number', step: '0.01' }, { name: 'fidelity_confidence', type: 'number', step: '0.01' },
        { name: 'overall', type: 'number', step: '0.01' }] },
    correlation: { label: 'Sim-vs-track correlation', help: 'Objective channel deltas from ATLAS, to sit beside the subjective survey.',
      fields: [
        { name: 'date', type: 'date', default: today() }, { name: 'channel', type: 'text', placeholder: 'brake pressure' },
        { name: 'sim_vs_track_delta_pct', type: 'number', step: '0.01' }] },
    development: { label: 'Development & CSG tasks', help: 'One row per quarter per tool or workstream.',
      fields: [
        { name: 'date', type: 'date', default: today() }, { name: 'tool', type: 'text', placeholder: 'HIL regression harness' },
        { name: 'items_committed', type: 'number' }, { name: 'items_delivered', type: 'number' },
        { name: 'setup_minutes_before', type: 'number' }, { name: 'setup_minutes_after', type: 'number' },
        { name: 'config_errors_before', type: 'number' }, { name: 'config_errors_after', type: 'number' },
        { name: 'cross_tasks', type: 'number' }] },
  };

  /* ---- CSV --------------------------------------------------------------- */
  function toCsv(rows) {
    if (!rows.length) return '';
    const columns = [...rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => { if (!k.startsWith('__')) set.add(k); });
      return set;
    }, new Set())];
    const cell = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n');
  }

  function parseCsv(text) {
    const rows = []; let row = []; let field = ''; let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch !== '\r') field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const header = rows[0].map((h) => h.trim());
    return rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''))
      .map((r) => KPI.coerceRow(Object.fromEntries(header.map((h, i) => [h, r[i] === undefined ? '' : r[i]]))));
  }

  /* ---- render ------------------------------------------------------------ */
  const VIEWS = {
    overview: { label: 'Overview', render: viewOverview },
    scorecard: { label: 'Scorecard', render: viewScorecard },
    log: { label: 'Log data', render: viewLog },
    rollout: { label: 'Rollout', render: viewRollout },
    proposal: { label: 'Proposal', render: viewProposal },
  };

  function render() {
    recompute();
    const day = state.card.programme_day;
    $('#head-meta').innerHTML = `${day === null ? 'No start date set' : `Day ${day}`} · ${state.card.phase || '—'} · <span class="num">${fmt(state.card.coverage_pct, 0)}%</span> measurable`;
    $$('nav.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === state.view)));
    renderStatus();
    renderBanners();
    const main = $('#main');
    main.innerHTML = VIEWS[state.view].render();
    wireCharts(main);
    if (state.selected) renderDrawer();
  }

  /* The live pill is the page's honesty about where these numbers came from. */
  function renderStatus() {
    const live = Store.mode === 'live';
    const synced = Store.syncedAt
      ? Store.syncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
    $('#data-note').textContent = live
      ? 'Records are whatever this board has been given; any sample rows are fictional.'
      : 'All records shipped with this page are fictional sample data.';
    $('#live-pill').innerHTML = `<span class="pill ${live ? 'live' : 'local'}" title="${
      esc(live
        ? 'Records are shared with everyone who can open this board, and update as they change.'
        : 'This copy stores records in this browser only — nobody else sees them.')}">
        <span class="dot" aria-hidden="true"></span>${live ? 'Live board' : 'Local copy'}${
      live && synced ? ` <span class="num">${esc(synced)}</span>` : ''}${
      live && !Store.writable ? ' · read-only' : ''}</span>`;
  }

  function renderBanners() {
    const parts = [];
    if (Store.error) {
      parts.push(`<div class="banner bad"><span>${esc(Store.error)}</span>
        <button class="btn btn-ghost" id="dismiss-error">Dismiss</button></div>`);
    }
    if (P.mode === 'live' && Store.mode !== 'live') {
      parts.push(`<div class="banner note"><span><strong>Not connected to the board.</strong>
        This is the live build — its records live in the shared store, which is only reachable
        when the page is opened from its claude.ai link. Nothing you log here will be kept.</span></div>`);
    }
    if (Store.mode === 'live' && Store.seeded) {
      parts.push(`<div class="banner note"><span><strong>Sample records loaded.</strong>
        This board is pre-filled with ${Store.recordCount.toLocaleString()} fictional records so the
        scorecard has something to show. Clear them before logging real sessions.</span>
        <button class="btn" id="clear-seed">Clear sample records</button></div>`);
    }
    $('#banner-root').innerHTML = parts.join('');
  }

  /* ---- events ------------------------------------------------------------ */
  function applyTheme() {
    if (state.theme) document.documentElement.setAttribute('data-theme', state.theme);
    else document.documentElement.removeAttribute('data-theme');
    $('#theme-btn').textContent = state.theme === 'dark' ? 'Light' : (state.theme === 'light' ? 'Dark' : 'Theme');
  }

  function readForm() {
    const spec = DATASET_FIELDS[state.logDataset];
    const row = {};
    for (const f of spec.fields) {
      const el = $(`#in-${CSS.escape(f.name)}`);
      if (!el) continue;
      row[f.name] = el.value;
    }
    return KPI.coerceRow(row);
  }

  document.addEventListener('click', (e) => {
    // The star sits inside a row that also opens the drawer, so it is matched first.
    const star = e.target.closest('[data-star]');
    if (star) {
      const id = star.dataset.star;
      Store.setOverride(id, { headline: !state.card.series[id].headline });
      return;
    }

    if (e.target.closest('[data-close]')) { closeKpi(); return; }
    const open = e.target.closest('[data-open]');
    if (open) { openKpi(open.dataset.open); return; }

    const goto = e.target.closest('[data-goto-log]');
    if (goto) {
      Store.setUi({ logDataset: goto.dataset.gotoLog });
      state.view = 'log'; closeKpi(); render();
      return;
    }

    const del = e.target.closest('[data-del]');
    if (del) {
      Store.deleteRecord(state.logDataset, Number(del.dataset.del));
      toast('Record deleted');
      return;
    }

    const jump = e.target.closest('[data-view-jump]');
    if (jump) { state.view = jump.dataset.viewJump; render(); return; }

    const tab = e.target.closest('nav.tabs button');
    if (tab) { state.view = tab.dataset.view; render(); return; }

    switch (e.target.id) {
      case 'theme-btn': {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
          || (!state.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
        Store.setUi({ theme: isDark ? 'light' : 'dark' });
        applyTheme();
        break;
      }
      case 'dismiss-error': Store.dismissError(); break;
      case 'clear-seed':
        if (window.confirm('Delete every sample record from the shared board? This cannot be undone.')) {
          toast('Clearing sample records…');
          Store.clearAllRecords().then(() => toast('Board cleared — log your first real session'));
        }
        break;
      case 'clear-dataset':
        if (window.confirm(`Delete every record in ${state.logDataset}? This cannot be undone.`)) {
          Store.clearDataset(state.logDataset).then(() => toast(`Cleared ${state.logDataset}`));
        }
        break;
      case 'add-row': {
        const row = readForm();
        if (!KPI.rowDate(row)) { toast('That record needs a date before it can be counted'); break; }
        Store.addRecord(state.logDataset, row);
        toast(`Added to ${state.logDataset}`);
        break;
      }
      case 'import-btn': $('#import-file').click(); break;
      case 'export-btn': {
        const csv = toCsv(state.datasets[state.logDataset]);
        $('#csv-out').innerHTML = `<div class="field" style="margin-top:14px">
          <label>${esc(state.logDataset)}.csv — select all and copy</label>
          <textarea rows="8" readonly style="width:100%;font-family:var(--font-mono);font-size:11px">${esc(csv)}</textarea>
          <span class="help">Copy from here — or run <span class="num">python -m kpi_framework export</span> for the full scorecard.</span></div>`;
        const ta = $('#csv-out textarea'); ta.focus(); ta.select();
        break;
      }
      case 'reset-seed':
        if (window.confirm(Store.mode === 'live'
          ? 'Delete every record on the shared board? This cannot be undone.'
          : 'Discard every logged record and restore the seeded sample data?')) {
          Store.resetToSeed(P).then(() => toast(Store.mode === 'live' ? 'Board cleared' : 'Reset to seeded data'));
        }
        break;
      case 't-save':
        Store.setOverride(state.selected, {
          target: Number($('#t-target').value),
          amber: Number($('#t-amber').value),
          target_agreed: $('#t-agreed').value === '1',
          headline: $('#t-head').value === '1',
        });
        toast('Target updated');
        break;
      case 't-reset':
        Store.clearOverride(state.selected);
        toast('Reset to framework default');
        break;
      case 'print-proposal': window.print(); break;
      default: break;
    }
  });

  document.addEventListener('change', (e) => {
    const check = e.target.closest('[data-check]');
    if (check) {
      Store.setCheck(check.dataset.check, Number(check.dataset.i), check.checked);
      return;
    }
    switch (e.target.id) {
      case 'start-date':
        Store.setProgramme({ start_date: e.target.value || null }); break;
      case 'as-of':
        Store.setProgramme({ as_of: e.target.value || null }); break;
      case 'ds':
        Store.setUi({ logDataset: e.target.value }); render(); break;
      case 'f-cat':
        Store.setFilter({ category: e.target.value }); render(); break;
      case 'f-head':
        Store.setFilter({ headlineOnly: e.target.checked }); render(); break;
      case 'import-file': {
        const file = e.target.files[0];
        if (!file) break;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const rows = parseCsv(String(reader.result));
            Store.addRecords(state.logDataset, rows);
            toast(`Imported ${rows.length} rows into ${state.logDataset}`);
          } catch (err) { toast('Could not read that CSV'); }
        };
        reader.readAsText(file);
        e.target.value = '';
        break;
      }
      default: break;
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'f-q') {
      Store.setFilter({ q: e.target.value });
      const main = $('#main');
      main.innerHTML = viewScorecard();
      $('#f-q').focus();
      $('#f-q').setSelectionRange(e.target.value.length, e.target.value.length);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.selected) closeKpi();
  });

  /* ---- boot -------------------------------------------------------------- */
  let booted = false;
  function onStoreChange() {
    // Dates are the one control the page does not own while it is focused:
    // re-stamping them mid-edit would fight the viewer's typing.
    const active = document.activeElement;
    for (const id of ['start-date', 'as-of']) {
      const el = $(`#${id}`);
      const value = (id === 'start-date' ? Store.programme.start_date : Store.programme.as_of) || '';
      if (el && el !== active && el.value !== value) el.value = value;
    }
    render();
    booted = true;
  }

  applyTheme();
  $('#tabs').innerHTML = Object.entries(VIEWS).map(([key, v]) =>
    `<button data-view="${key}" role="tab" aria-selected="${key === state.view}">${esc(v.label)}</button>`).join('');
  Store.boot(P, onStoreChange);
  $('#start-date').value = Store.programme.start_date || '';
  $('#as-of').value = Store.programme.as_of || '';
  if (!booted) render();
})();
