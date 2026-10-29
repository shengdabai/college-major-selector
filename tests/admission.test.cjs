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
    localStorage: { getItem: () => null },
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
  a.context.fixture = data;
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
