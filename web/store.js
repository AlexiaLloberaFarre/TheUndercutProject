/* Where the records live.

   Two backends behind one API:
   - live  — the artifact's `db` capability. Records are shared documents; every
             viewer sees every write as it happens, and it survives reloads,
             republishes and devices.
   - local — localStorage, for the same page opened as a file or anywhere the
             capability is not granted. Same UI, one browser's worth of data.

   The page always renders from the local mirror; live mode replaces that mirror
   whenever a snapshot arrives. Per-viewer preferences (theme, filters) stay in
   localStorage in both modes — they are nobody else's business. */
const Store = (() => {
  'use strict';

  const DATA_KEY = 'sim-kpi-tracker-v1';
  const UI_KEY = 'sim-kpi-tracker-ui-v1';
  const CONFIG_PATH = { programme: 'config/programme', checklist: 'config/checklist', meta: 'config/meta' };
  const DOC_BUDGET = 5000;          // the store's hard cap on documents
  const DELETE_BATCH = 8;           // paced so a bulk clear doesn't trip the rate limit

  let db = null;
  let notify = () => {};
  const unsubscribes = [];
  const writeChains = new Map();    // one write at a time per document path

  const api = {
    mode: 'local',                  // 'local' | 'live'
    writable: true,
    syncedAt: null,
    error: null,
    seeded: false,
    recordCount: 0,
    datasets: {},
    programme: { start_date: null, as_of: null, targets_agreed: false, overrides: {} },
    checklist: {},
    ui: { theme: null, filter: { category: 'all', headlineOnly: false, q: '' }, logDataset: 'sessions' },
  };

  /* ---- helpers ---------------------------------------------------------- */
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function readLocal(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;   // private window, blocked storage — carry on from the seed
    }
  }

  function writeLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) { /* over quota or blocked — the session still works */ }
  }

  const saveUi = () => writeLocal(UI_KEY, api.ui);

  function saveLocalData() {
    if (api.mode !== 'local') return;
    writeLocal(DATA_KEY, {
      datasets: api.datasets, programme: api.programme, checklist: api.checklist,
    });
  }

  function countRecords() {
    api.recordCount = Object.values(api.datasets).reduce((n, rows) => n + rows.length, 0);
  }

  function changed() {
    countRecords();
    notify();
  }

  /* Human sentences for the codes that can reach a viewer. The store's own
     message is appended only when it says something the code does not. */
  function describe(err) {
    const code = err && err.code;
    switch (code) {
      case 'quota_exceeded':
        return 'The shared store is full. Clear or archive older records before adding more.';
      case 'resource_exhausted':
        return 'Too many changes at once. Wait a moment and try again.';
      case 'invalid_argument':
        return 'That change was refused — targets and programme dates can only be edited by someone with edit access.';
      case 'revoked':
      case 'not_granted':
      case 'capability_disabled':
      case 'capability_removed':
        return 'This view can no longer write to the shared board.';
      case 'unavailable':
        return 'The shared board is unreachable. Retrying.';
      default:
        return (err && err.message) || 'That change could not be saved.';
    }
  }

  /* Serialize writes per document, and retry a transient failure once. */
  function queue(path, run) {
    const previous = writeChains.get(path) || Promise.resolve();
    const next = previous.then(run).catch(async (err) => {
      if (err && err.code === 'unavailable') {
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
        return run();
      }
      throw err;
    });
    writeChains.set(path, next.catch(() => {}));
    return next;
  }

  async function guard(path, run) {
    try {
      await queue(path, run);
      api.error = null;
      api.syncedAt = new Date();
    } catch (err) {
      api.error = describe(err);
      if (err && (err.code === 'revoked' || err.code === 'not_granted')) api.writable = false;
    }
    changed();
  }

  /* ---- live backend ------------------------------------------------------ */
  function rowsFromSnapshot(snap) {
    return snap.docs.map((doc) => {
      const row = KPI.coerceRow(doc.data() || {});
      row.__id = doc.id;
      return row;
    }).sort((a, b) => {
      const da = KPI.rowDate(a);
      const db_ = KPI.rowDate(b);
      if (!da || !db_) return 0;
      return da - db_;
    });
  }

  function subscribeAll(datasets) {
    for (const name of datasets) {
      unsubscribes.push(db.collection(name).onSnapshot(
        (snap) => {
          api.datasets[name] = rowsFromSnapshot(snap);
          if (!snap.metadata.fromCache) api.syncedAt = new Date();
          changed();
        },
        (err) => { api.error = describe(err); changed(); },
      ));
    }

    unsubscribes.push(db.doc(CONFIG_PATH.programme).onSnapshot((snap) => {
      const body = snap.exists ? snap.data() : null;
      if (body) {
        api.programme = {
          start_date: body.start_date || null,
          as_of: body.as_of || null,
          targets_agreed: !!body.targets_agreed,
          overrides: body.overrides || {},
        };
      }
      changed();
    }, (err) => { api.error = describe(err); changed(); }));

    unsubscribes.push(db.doc(CONFIG_PATH.checklist).onSnapshot((snap) => {
      api.checklist = (snap.exists && snap.data().phases) || {};
      changed();
    }, (err) => { api.error = describe(err); changed(); }));

    unsubscribes.push(db.doc(CONFIG_PATH.meta).onSnapshot((snap) => {
      api.seeded = !!(snap.exists && snap.data().seeded);
      changed();
    }, () => {}));
  }

  /* ---- boot -------------------------------------------------------------- */
  async function connect(payload) {
    if (typeof window === 'undefined' || !window.claude || typeof window.claude.use !== 'function') return;
    let capability = null;
    try {
      capability = await window.claude.use('db');
    } catch (err) {
      capability = null;
    }
    if (!capability) return;      // not served, not granted, or failed to load

    db = capability;
    api.mode = 'live';
    api.error = null;
    // Local records were this browser's own copy; the shared board is the truth.
    for (const name of KPI.DATASETS) api.datasets[name] = [];
    subscribeAll(KPI.DATASETS);
    changed();
  }

  /* ---- public API -------------------------------------------------------- */
  api.boot = function boot(payload, onChange) {
    notify = onChange || notify;

    const ui = readLocal(UI_KEY);
    if (ui) {
      api.ui.theme = ui.theme || null;
      Object.assign(api.ui.filter, ui.filter || {});
      if (ui.logDataset) api.ui.logDataset = ui.logDataset;
    }

    for (const name of KPI.DATASETS) {
      api.datasets[name] = (payload.datasets[name] || []).map(KPI.coerceRow);
    }
    Object.assign(api.programme, payload.programme || {});
    api.programme.overrides = clone(payload.programme && payload.programme.overrides ? payload.programme.overrides : {});

    const saved = readLocal(DATA_KEY);
    if (saved) {
      if (saved.datasets) {
        for (const name of KPI.DATASETS) {
          if (saved.datasets[name]) api.datasets[name] = saved.datasets[name].map(KPI.coerceRow);
        }
      }
      if (saved.programme) Object.assign(api.programme, saved.programme);
      if (saved.checklist) api.checklist = saved.checklist;
    }

    countRecords();
    // Render first, then light up the live board when the viewer answers.
    connect(payload);
    return api;
  };

  api.seedSnapshot = () => ({
    datasets: api.datasets, programme: api.programme, checklist: api.checklist,
  });

  api.addRecords = async function addRecords(dataset, rows) {
    if (!rows.length) return;
    if (api.mode === 'live') {
      if (api.recordCount + rows.length > DOC_BUDGET) {
        api.error = `That would exceed the ${DOC_BUDGET.toLocaleString()}-record limit of the shared store.`;
        changed();
        return;
      }
      await guard(`${dataset}/+add`, async () => {
        for (const row of rows) {
          const body = Object.assign({}, row);
          delete body.__id;
          await db.collection(dataset).add(body);
        }
      });
      return;
    }
    api.datasets[dataset] = api.datasets[dataset].concat(rows);
    saveLocalData();
    changed();
  };

  api.addRecord = (dataset, row) => api.addRecords(dataset, [row]);

  api.deleteRecord = async function deleteRecord(dataset, index) {
    const row = api.datasets[dataset][index];
    if (!row) return;
    if (api.mode === 'live') {
      if (!row.__id) return;
      await guard(`${dataset}/${row.__id}`, () => db.doc(`${dataset}/${row.__id}`).delete());
      return;
    }
    api.datasets[dataset].splice(index, 1);
    saveLocalData();
    changed();
  };

  /* Paced so a bulk clear stays under the per-viewer call rate. */
  api.clearDataset = async function clearDataset(dataset, onProgress) {
    if (api.mode !== 'live') {
      api.datasets[dataset] = [];
      saveLocalData();
      changed();
      return;
    }
    const rows = api.datasets[dataset].filter((r) => r.__id);
    for (let i = 0; i < rows.length; i += DELETE_BATCH) {
      const slice = rows.slice(i, i + DELETE_BATCH);
      try {
        await Promise.all(slice.map((r) => db.doc(`${dataset}/${r.__id}`).delete()));
      } catch (err) {
        api.error = describe(err);
        changed();
        return;
      }
      if (onProgress) onProgress(Math.min(i + DELETE_BATCH, rows.length), rows.length);
      await new Promise((r) => setTimeout(r, 60));
    }
    api.syncedAt = new Date();
    changed();
  };

  api.clearAllRecords = async function clearAllRecords(onProgress) {
    let done = 0;
    const total = api.recordCount;
    for (const name of KPI.DATASETS) {
      await api.clearDataset(name, (n) => { if (onProgress) onProgress(done + n, total); });
      done += (api.datasets[name] || []).length;
    }
    if (api.mode === 'live') await api.setSeeded(false);
  };

  api.setSeeded = (value) =>
    guard(CONFIG_PATH.meta, () => db.doc(CONFIG_PATH.meta).set({ seeded: !!value }));

  api.resetToSeed = function resetToSeed(payload) {
    if (api.mode === 'live') return api.clearAllRecords();
    for (const name of KPI.DATASETS) {
      api.datasets[name] = (payload.datasets[name] || []).map(KPI.coerceRow);
    }
    saveLocalData();
    changed();
    return Promise.resolve();
  };

  function persistProgramme() {
    if (api.mode === 'live') {
      return guard(CONFIG_PATH.programme, () => db.doc(CONFIG_PATH.programme).set({
        start_date: api.programme.start_date,
        as_of: api.programme.as_of,
        targets_agreed: !!api.programme.targets_agreed,
        overrides: api.programme.overrides,
      }));
    }
    saveLocalData();
    changed();
    return Promise.resolve();
  }

  api.setProgramme = function setProgramme(patch) {
    Object.assign(api.programme, patch);
    return persistProgramme();
  };

  api.setOverride = function setOverride(kpiId, patch) {
    api.programme.overrides = Object.assign({}, api.programme.overrides, {
      [kpiId]: Object.assign({}, api.programme.overrides[kpiId], patch),
    });
    return persistProgramme();
  };

  api.clearOverride = function clearOverride(kpiId) {
    const next = Object.assign({}, api.programme.overrides);
    delete next[kpiId];
    api.programme.overrides = next;
    return persistProgramme();
  };

  api.setCheck = function setCheck(phaseId, index, value) {
    const list = (api.checklist[phaseId] || []).slice();
    list[index] = value;
    api.checklist = Object.assign({}, api.checklist, { [phaseId]: list });
    if (api.mode === 'live') {
      return guard(CONFIG_PATH.checklist, () => db.doc(CONFIG_PATH.checklist).set({ phases: api.checklist }));
    }
    saveLocalData();
    changed();
    return Promise.resolve();
  };

  api.setUi = function setUi(patch) {
    Object.assign(api.ui, patch);
    saveUi();
  };

  api.setFilter = function setFilter(patch) {
    Object.assign(api.ui.filter, patch);
    saveUi();
  };

  api.dismissError = function dismissError() {
    api.error = null;
    changed();
  };

  api.docBudget = DOC_BUDGET;
  return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Store;
