const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Execute the shipped script without a browser or network. Startup fetches stay
// pending; individual tests invoke the real functions with synthetic records.
const source = readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function app(options = {}) {
  const elements = new Map();
  const selectors = [];
  const element = selector => {
    selectors.push(selector);
    if (!elements.has(selector)) {
      const classes = new Set(['hidden']);
      elements.set(selector, {
        innerHTML: '', value: '', textContent: '', checked: false,
        classList: {
          add: c => classes.add(c), remove: c => classes.delete(c),
          contains: c => classes.has(c),
          toggle(c, on) { if (on ?? !classes.has(c)) classes.add(c); else classes.delete(c); },
        },
        scrollIntoView() {}, addEventListener() {},
      });
    }
    return elements.get(selector);
  };
  const alerts = [];
  const context = vm.createContext({
    window: {}, console: { ...console, error() {} }, URLSearchParams, location: { search: '' },
    localStorage: options.storage || { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout() {},
    fetch: options.fetch || (() => new Promise(() => {})),
    alert: text => alerts.push(text),
    document: { querySelector: element, querySelectorAll: () => [],
      getElementById: id => element('#' + id) },
  });
  vm.runInContext(source, context);
  return { context, element, selectors, alerts, run: code => vm.runInContext(code, context) };
}
const table = [{ score: 600, cum: 1000 }, { score: 500, cum: 4000 }];
const scores = [{ school: '合成大学', major: '合成专业', batch: '本科批', minScore: 580, minRank: 1000 }];
function setData(a, year, data) {
  a.context.fixture = { _meta: { province: '合成省', subject: '物理类' }, ...data };
  a.run(`state.yearData[${year}] = normalizeUpload(fixture, ${year}).norm`);
}

test('unordered rank table produces correct score and rank lookups', () => {
  const a = app();
  setData(a, 2025, { rankTable: [...table].reverse() });
  assert.equal(a.run('scoreToRank(2025, 600)'), 1000);
  assert.equal(a.run('rankToScore(2025, 1000)'), 600);
});

for (const row of [{ score: null, cum: 100 }, { score: 600 },
  { score: 600, cum: -1 }, { score: 600, cum: 'Infinity' },
  { score: {}, cum: 100 }, { score: 600, cum: 1.5 }]) {
  test(`invalid rank-table row is rejected: ${JSON.stringify(row)}`, () => {
    const a = app();
    a.context.fixture = { rankTable: [row] };
    assert.equal(a.run('normalizeUpload(fixture, 2025).ok'), false);
  });
}

test('rank-table cumulative counts must not decrease as scores decrease', () => {
  const a = app();
  a.context.fixture = { rankTable: [{ score: 600, cum: 2000 }, { score: 500, cum: 1000 }] };
  assert.equal(a.run('normalizeUpload(fixture, 2025).ok'), false);
});

test('duplicate score rows are rejected instead of making lookups ambiguous', () => {
  const a = app();
  a.context.fixture = { rankTable: [{ score: 600, cum: 1000 }, { score: 600, cum: 2000 }] };
  assert.equal(a.run('normalizeUpload(fixture, 2025).ok'), false);
});

test('school-score-only files are accepted and listed as loaded years', () => {
  const a = app();
  a.context.fixture = { schoolScores: scores };
  assert.equal(a.run('normalizeUpload(fixture, 2025).ok'), true);
  setData(a, 2025, a.context.fixture);
  assert.equal(a.run('yearAvail(2025) ? true : false'), true);
});

test('cross-year conversion requires both rank tables', () => {
  const a = app();
  setData(a, 2025, { rankTable: table });
  setData(a, 2024, { majorScores: scores });
  assert.equal(a.run('rankToEquivalent(1000, 2025, 2024)'), null);
  assert.equal(a.run('rankToEquivalent(1000, 2024, 2025)'), null);
});

test('cross-year conversion scales by actual cumulative totals', () => {
  const a = app();
  setData(a, 2025, { rankTable: table });
  setData(a, 2024, { rankTable: table.map(r => ({ ...r, cum: r.cum * 2 })) });
  assert.equal(a.run('rankToEquivalent(1000, 2025, 2024)'), 2000);
});

test('recommendation stops if the reference year has no rank table', () => {
  const a = app();
  setData(a, 2025, { rankTable: table });
  setData(a, 2024, { majorScores: scores });
  a.run("state.C.refYear = 2024; state.C.inputRank = '1000'; computeRecommendation()");
  assert.equal(a.run('state.C.rec'), null);
  assert.match(a.alerts.join(), /一分一段表/);
});

for (const rank of ['-1', '0', '1000abc', '1.5']) {
  test(`recommendation rejects invalid rank ${rank}`, () => {
    const a = app();
    setData(a, 2025, { majorScores: scores, rankTable: table });
    a.context.input = rank;
    a.run('state.C.inputRank = input; computeRecommendation()');
    assert.equal(a.run('state.C.rec'), null);
    assert.ok(a.alerts.length);
  });
}

test('a direct rank still works without a table when using the same year', () => {
  const a = app();
  setData(a, 2025, { majorScores: scores });
  a.run("state.C.inputRank = '1000'; computeRecommendation()");
  assert.equal(a.run('state.C.rec.buckets.wen.length'), 1);
  assert.equal(a.alerts.length, 0);
});

test('successful replacement invalidates the old recommendation and trend', async () => {
  const a = app();
  a.run('state.C.rec = { stale: true }; state.C.selectedSchool = "旧合成大学"');
  a.element('#C-rec-result').classList.remove('hidden');
  a.element('#C-trend-result').innerHTML = 'old trend';
  a.context.files = [{ name: 'synthetic-2025.json', text: async () => JSON.stringify({ majorScores: scores }) }];
  await a.run('handleDataFiles(files)');
  assert.equal(a.run('state.C.rec'), null);
  assert.equal(a.element('#C-rec-result').classList.contains('hidden'), true);
  assert.equal(a.element('#C-trend-result').innerHTML, '');
  assert.equal(a.run('state.C.selectedSchool'), '');
});

test('failed upload preserves the existing data and recommendation', async () => {
  const a = app();
  setData(a, 2025, { majorScores: scores });
  a.run('state.C.rec = { preserved: true }');
  a.context.files = [{ name: 'synthetic-2025.json', text: async () => '{' }];
  await a.run('handleDataFiles(files)');
  assert.equal(a.run('state.C.rec.preserved'), true);
  assert.equal(a.run('yearOf(2025).majorScores.length'), 1);
});

test('demo resets a previously entered rank before calculating the sample score', async () => {
  const a = app();
  a.context.fetch = async () => ({ ok: true, json: async () => ({ rankTable: table, majorScores: scores }) });
  a.run("state.C.inputRank = '99999'");
  a.element('#C-input-rank').value = '99999';
  await a.run('loadDemoData()');
  assert.equal(a.run('state.C.rec.rank'), 1000);
  assert.equal(a.element('#C-input-rank').value, '');
});

test('bundled synthetic demo passes validation and renders recommendations', async () => {
  const a = app();
  const demo = JSON.parse(readFileSync(path.join(__dirname, '..', 'data', 'demo-admission-2025.json'), 'utf8'));
  a.context.fetch = async () => ({ ok: true, json: async () => demo });
  await a.run('loadDemoData()');
  assert.equal(a.alerts.length, 0);
  assert.equal(a.run('yearOf(2025).majorScores.length'), demo.majorScores.length);
  assert.ok(a.run('state.C.rec.rank > 0'));
  assert.ok(a.element('#C-rec-result').innerHTML.includes('600'));
});

test('uploaded strings are escaped in rendered plan rows', () => {
  const a = app();
  a.context.fixture = { plans: [{ school: '<img src=x onerror=alert(1)>', major: '"test"' }] };
  const html = a.run('planRow(normalizeUpload(fixture, 2025).norm.plans[0])');
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
});

test('URL tab allowlist ignores malicious parameters', async () => {
  const a = app();
  a.context.location.search = '?tab=' + encodeURIComponent('<img src=x onerror=alert(1)>');
  a.context.fetch = async () => ({ json: async () => [] });
  a.run('initTabs = initModeA = initModeB = initModeC = initModeD = renderA = renderCompareBar = initStickyBrand = () => {}');
  await a.run('loadAll()');
  assert.equal(a.alerts.length, 0);
  assert.equal(a.selectors.some(s => s.includes('<img')), false);
});

test('valid URL tabs still activate the requested tab', async () => {
  const a = app();
  a.context.location.search = '?tab=C';
  let clicked = false;
  a.element('[data-tab="C"]').click = () => { clicked = true; };
  a.context.fetch = async () => ({ json: async () => [] });
  a.run('initTabs = initModeA = initModeB = initModeC = initModeD = renderA = renderCompareBar = initStickyBrand = () => {}');
  await a.run('loadAll()');
  assert.equal(clicked, true);
});

test('startup fetch failure escapes its error message', async () => {
  const a = app({ fetch: async () => { throw new Error('<img src=x onerror=alert(1)>'); } });
  await new Promise(resolve => setImmediate(resolve));
  const html = a.element('#loading').innerHTML;
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
});

test('normalization derives counts from records and accepts numeric strings', () => {
  const a = app();
  a.context.fixture = { _meta: { plans: 999, majorScores: 999 },
    majorScores: scores, rankTable: [{ score: '600', cum: '1000' }] };
  assert.equal(a.run('normalizeUpload(fixture, 2025).norm._meta.majorScores'), 1);
  assert.equal(a.run('normalizeUpload(fixture, 2025).norm._meta.plans'), 0);
  assert.equal(a.run('normalizeUpload(fixture, 2025).norm.rankTable[0].cum'), 1000);
});

for (const value of ['=1+1', '+1+1', '-1+1', '@SUM(A1)', '\t=1+1', '\r=1+1', '  =1+1']) {
  test(`CSV export treats formula-like uploaded text as text: ${JSON.stringify(value)}`, () => {
    const a = app();
    a.context.cell = value;
    const csv = a.run('toCSV([[cell]])');
    assert.ok(csv.startsWith("'") || csv.startsWith('"\''));
  });
}

test('CSV export quotes carriage returns and preserves numeric values', () => {
  const a = app();
  a.context.cells = ['合成\r大学', 'a,"b"', -5, 0, null];
  assert.equal(a.run('toCSV([cells])'), '"合成\r大学","a,""b""",-5,0,');
});


const blockedStorage = {
  getItem() { throw new Error('storage disabled'); },
  setItem() { throw new Error('storage disabled'); },
  removeItem() { throw new Error('storage disabled'); },
};

test('comparison remains usable when storage writes and removals fail', () => {
  const a = app({ storage: blockedStorage });
  a.run('renderCompareBar = () => {}; toggleCompare("synthetic");');
  assert.equal(a.run('state.compare.has("synthetic")'), true);
  a.run('clearCompare()');
  assert.equal(a.run('state.compare.size'), 0);
});

test('advisor initialization survives denied storage reads', () => {
  const a = app({ storage: blockedStorage });
  assert.doesNotThrow(() => a.run('initModeD()'));
  assert.equal(typeof a.element('#D-send-btn').onclick, 'function');
});

test('advisor retains session configuration when persistence fails', () => {
  const a = app({ storage: blockedStorage });
  a.run('initModeD(); sendAdvisorOpening = () => {}');
  a.element('#D-api-key').value = 'synthetic-key';
  a.element('#D-api-base').value = 'https://example.invalid/v1';
  a.element('#D-model').value = 'synthetic-model';
  assert.doesNotThrow(() => a.element('#D-save-config').onclick());
  assert.equal(a.run('state_D.apiKey'), 'synthetic-key');
  assert.match(a.element('#D-status').textContent, /本次|会话/);
});

function upload(a, year, data) {
  a.context.files = [{ name: `synthetic-${year}.json`, text: async () => JSON.stringify(data) }];
  return a.run('handleDataFiles(files)');
}
const cohort = { province: '合成省', subject: '物理类' };
const admission = (meta = cohort) => ({ _meta: meta, majorScores: scores, rankTable: table });

for (const meta of [{ province: '其他合成省', subject: '物理类' },
  { province: '合成省', subject: '历史类' }, {}, { province: '合成省' }]) {
  test(`incompatible or unknown upload cohort is rejected: ${JSON.stringify(meta)}`, async () => {
    const a = app();
    await upload(a, 2025, admission());
    a.run('state.C.rec = { preserved: true }');
    await upload(a, 2024, admission(meta));
    assert.equal(a.run('yearAvail(2024)'), false);
    assert.equal(a.run('state.C.rec.preserved'), true);
    assert.match(a.element('#C-upload-log').innerHTML, /省份|科类/);
  });
}

test('single-year missing metadata remains usable; mixed-year addition is rejected', async () => {
  const a = app();
  await upload(a, 2025, admission({}));
  a.run('state.C.inputRank = "1000"; computeRecommendation()');
  assert.equal(a.run('state.C.rec.rank'), 1000);
  await upload(a, 2024, admission());
  assert.equal(a.run('yearAvail(2024)'), false);
});

test('matching cohorts load across years and same-year replacement can change scope', async () => {
  const a = app();
  await upload(a, 2025, admission());
  await upload(a, 2024, admission({ province: ' 合成省 ', subject: ' 物理类 ' }));
  assert.equal(a.run('getLoadedYears().length'), 2);
  const b = app();
  await upload(b, 2025, admission());
  await upload(b, 2025, admission({ province: '其他合成省', subject: '历史类' }));
  assert.equal(b.run('yearOf(2025)._meta.subject'), '历史类');
});

test('metadata year must match the filename year', async () => {
  const a = app();
  await upload(a, 2025, admission({ ...cohort, year: 2024 }));
  assert.equal(a.run('yearAvail(2025)'), false);
  assert.match(a.element('#C-upload-log').innerHTML, /年份/);
});

for (const meta of [{ province: '合成省', subject: '历史类' }, {}]) {
  test(`cross-year conversion independently rejects a different or unknown cohort ${JSON.stringify(meta)}`, () => {
    const a = app();
    setData(a, 2025, admission());
    setData(a, 2024, admission(meta));
    assert.equal(a.run('rankToEquivalent(1000, 2025, 2024)'), null);
  });
}

test('demo is isolated from later uploaded years and preserves them for the next upload', async () => {
  const a = app();
  await upload(a, 2026, admission());
  a.context.fetch = async () => ({ ok: true, json: async () => admission({ ...cohort, demo: true }) });
  await a.run('loadDemoData()');
  assert.equal(a.run('getLoadedYears().join()'), '2025');
  assert.equal(a.run('state.C.rec.inputYear'), 2025);
  await a.run('loadDemoData()');
  await upload(a, 2024, admission());
  assert.equal(a.run('getLoadedYears().join()'), '2024,2026');
  assert.equal(a.run('state.C.inputScore'), '');
  assert.equal(a.element('#C-input-score').value, '');
  assert.equal(a.run('yearOf(2026)._meta.demo'), undefined);
});

test('failed upload during demo preserves both demo and saved uploaded data', async () => {
  const a = app();
  await upload(a, 2026, admission());
  a.context.fetch = async () => ({ ok: true, json: async () => admission({ ...cohort, demo: true }) });
  await a.run('loadDemoData()');
  await upload(a, 2024, admission({}));
  assert.equal(a.run('getLoadedYears().join()'), '2025');
  assert.equal(a.run('state.C.rec.inputYear'), 2025);
  await upload(a, 2024, admission());
  assert.equal(a.run('getLoadedYears().join()'), '2024,2026');
});

test('clear data also clears the saved upload session behind the demo', async () => {
  const a = app();
  await upload(a, 2026, admission());
  a.context.fetch = async () => ({ ok: true, json: async () => admission() });
  await a.run('loadDemoData();');
  a.run('clearYearData()');
  await upload(a, 2024, admission());
  assert.equal(a.run('getLoadedYears().join()'), '2024');
});

test('invalid recalculation hides the previous recommendation', () => {
  const a = app();
  setData(a, 2025, admission());
  a.run('state.C.inputRank = "1000"; computeRecommendation()');
  a.run('state.C.inputRank = "-1"; computeRecommendation()');
  assert.equal(a.run('state.C.rec'), null);
  assert.equal(a.element('#C-rec-result').classList.contains('hidden'), true);
});

test('editing score inputs invalidates the previous result before recalculation', () => {
  const a = app();
  setData(a, 2025, admission());
  a.run('initScoreView(); state.C.inputRank = "1000"; computeRecommendation()');
  a.element('#C-input-score').oninput({ target: { value: '610' } });
  assert.equal(a.run('state.C.rec'), null);
  assert.equal(a.element('#C-rec-result').classList.contains('hidden'), true);
});

test('returning from demo restores uploaded years and clears demo inputs/results', async () => {
  const a = app();
  await upload(a, 2026, admission());
  a.context.fetch = async () => ({ ok: true, json: async () => admission() });
  await a.run('loadDemoData()');
  a.run('restoreUploadedData()');
  assert.equal(a.run('getLoadedYears().join()'), '2026');
  assert.equal(a.run('state.C.rec'), null);
  assert.equal(a.element('#C-input-score').value, '');
  assert.equal(a.element('#C-restore-upload').classList.contains('hidden'), true);
});

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

test('late demo response cannot resurrect cleared data', async () => {
  const a = app();
  const response = deferred();
  a.context.fetch = () => response.promise;
  const loading = a.run('loadDemoData()');
  a.run('clearYearData()');
  response.resolve({ ok: true, json: async () => admission() });
  await loading;
  assert.equal(a.run('getLoadedYears().length'), 0);
  assert.equal(a.run('state.C.rec'), null);
});

test('late upload cannot resurrect cleared data', async () => {
  const a = app();
  const contents = deferred();
  a.context.files = [{ name: 'synthetic-2025.json', text: () => contents.promise }];
  const loading = a.run('handleDataFiles(files)');
  a.run('clearYearData()');
  contents.resolve(JSON.stringify(admission()));
  await loading;
  assert.equal(a.run('getLoadedYears().length'), 0);
  assert.match(a.element('#C-upload-log').innerHTML, /已清除/);
});

test('late demo response cannot replace a newer successful upload', async () => {
  const a = app();
  const response = deferred();
  a.context.fetch = () => response.promise;
  const loading = a.run('loadDemoData()');
  await upload(a, 2026, admission());
  response.resolve({ ok: true, json: async () => admission() });
  await loading;
  assert.equal(a.run('getLoadedYears().join()'), '2026');
});

for (const field of ['province', 'subject']) {
  test(`cohort metadata rejects a non-string ${field}`, () => {
    const a = app();
    a.context.fixture = admission({ ...cohort, [field]: { invalid: true } });
    assert.equal(a.run('normalizeUpload(fixture, 2025).ok'), false);
  });
}

test('rank lookups reject values beyond the uploaded table coverage', () => {
  const a = app();
  setData(a, 2025, admission());
  assert.equal(a.run('scoreToRank(2025, 499)'), null);
  assert.equal(a.run('rankToScore(2025, 4001)'), null);
  assert.equal(a.run('scoreToRank(2025, 500)'), 4000);
  assert.equal(a.run('rankToScore(2025, 4000)'), 500);
});

test('out-of-range input rank does not generate recommendations', () => {
  const a = app();
  setData(a, 2025, admission());
  a.run('state.C.inputRank = "4001"; computeRecommendation()');
  assert.equal(a.run('state.C.rec'), null);
  assert.match(a.alerts.join(), /范围/);
});
