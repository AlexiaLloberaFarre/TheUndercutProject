/* Runs the browser engine head-to-head with the Python one.
   Usage: node tests/parity_runner.js <payload.json>  →  {tables, scorecard} on stdout */
const fs = require('fs');
const path = require('path');
const KPI = require(path.join(__dirname, '..', 'web', 'engine.js'));

const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const datasets = {};
for (const [name, rows] of Object.entries(payload.datasets)) datasets[name] = rows.map(KPI.coerceRow);
const tables = KPI.computeAll(datasets);
const card = KPI.scorecard(payload.kpis, tables, payload.phases, payload.programme);
process.stdout.write(JSON.stringify({ tables, scorecard: card }));
