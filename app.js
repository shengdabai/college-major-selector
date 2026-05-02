// 智慧大学 — 多模式筛选（通用版）
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const state = {
  unis: [],
  majors: [],          // 学科门类（嵌套）
  flatMajors: [],
  index: { opens:{}, advantages:{} },
  byCode: {},          // major_code -> major
  byUid: {},           // uni_id -> uni
  // 模式 A
  A: {
    province: '',
    city: '',
    levels: new Set(),
    types: new Set(),
    keyword: '',
    sort: 'level',
    page: 1,
  },
  // 模式 B
  B: {
    cat: '',
    sub: '',
    major: '',     // major_code
    keyword: '',
    province: '',
    level: '',
    onlyAdv: false,
    page: 1,
  },
  // 对比
  compare: new Set(JSON.parse(localStorage.getItem('compare') || '[]')),
  // 模式 C：青海历年（仅物理类/理科）
  qh: { 2022:null, 2023:null, 2024:null, 2025:null, 2026:null },
  C: {
    sub: 'score',           // score / trend / plans
    // 分数推荐
    inputScore: '',
    inputRank: '',
    refYear: 2025,
    onlyBk: true,
    rec: null,              // 计算结果
    // 院校趋势
    selectedSchool: '',
    // 招生计划浏览
    planYear: 2025,
    keyword: '',
    batches: new Set(),
    reqs: new Set(),
    types: new Set(),
    province: '',          // 学校所在省（plans 自身无字段，从 schoolScores 反查 join）
    city: '',              // 学校所在城市
    mCats: new Set(),      // 专业类
    feeMin: '', feeMax: '',
    group: 'flat',
    sort: 'school',
    page: 1,
  },
};

const MAX_COMPARE = 4;

// ---------- 阳光高考官方链接 ----------
function chsiSchoolUrl(name) {
  // 阳光高考·院校搜索（按校名关键词）
  return `https://gaokao.chsi.com.cn/sch/search--ss-on,option-qg,searchType-1,start-0.dhtml?xxname=${encodeURIComponent(name)}`;
}
function chsiMajorUrl(name) {
  // 阳光高考·专业知识库（按专业名）
  return `https://gaokao.chsi.com.cn/zyk/zybk/specialityesByCategory.action?ss=${encodeURIComponent(name)}`;
}

const PAGE_SIZE = 20;
const LEVEL_ORDER = ['985','211','双一流','本科职业','普通本科','专科','其他'];
const LEVEL_RANK = Object.fromEntries(LEVEL_ORDER.map((v,i)=>[v,i]));
const TYPE_ORDER = ['综合','理工','师范','财经','医药','政法','农林','语言','艺术','体育','民族','军事','航空航天','海事航运','石油矿业','电力能源','邮电通信','其他'];

// ---------- 加载 ----------
async function loadAll() {
  const [u, m, mf, idx] = await Promise.all([
    fetch('data/universities.json').then(r=>r.json()),
    fetch('data/majors.json').then(r=>r.json()),
    fetch('data/majors_flat.json').then(r=>r.json()),
    fetch('data/major_index.json').then(r=>r.json()),
  ]);
  state.unis = u;
  state.majors = m;
  state.flatMajors = mf;
  state.index = idx;
  state.byCode = Object.fromEntries(mf.map(x => [x.code, x]));
  state.byUid = Object.fromEntries(u.map(x => [x.id, x]));

  $('#stat-uni').textContent = `${u.length.toLocaleString()} 所高校`;
  $('#stat-major').textContent = `${mf.length} 个本科专业`;
  $('#stat-province').textContent = `${new Set(u.map(x=>x.province)).size} 个省份`;

  $('#loading').classList.add('hidden');
  $('#tab-A').classList.remove('hidden');

  initTabs();
  initModeA();
  initModeB();
  initModeC();
  initModeD();
  renderA();
  renderCompareBar();
  initStickyBrand();
}

// 顶部 sticky brand：滚出 hero 后才显示，让 sticky 条更紧凑
function initStickyBrand() {
  const sentinel = document.getElementById('hero-sentinel');
  const brand = document.getElementById('sticky-brand');
  if (!sentinel || !brand) return;
  // 观察 hero 是否离开视口顶部
  const io = new IntersectionObserver(([entry]) => {
    brand.style.opacity = entry.isIntersecting ? '0' : '1';
  }, { threshold: 0, rootMargin: '0px' });
  // 用 hero 整体作 target — 找到 hero（header 内最后一个 grid）
  const hero = document.querySelector('header .grid');
  if (hero) io.observe(hero);
}

// ---------- 通用 ----------
function levelPill(level) {
  // 新设计：极简标签，不堆颜色
  if (level === '985') return `<span class="pill pill-985">985</span>`;
  if (level === '211') return `<span class="pill pill-211">211</span>`;
  if (level === '双一流') return `<span class="pill pill-双一流">双一流</span>`;
  if (level === '本科职业') return `<span class="pill pill-line">本科职业</span>`;
  if (level === '普通本科') return `<span class="pill pill-line">普通本科</span>`;
  if (level === '专科') return `<span class="pill pill-line">专科</span>`;
  return `<span class="pill pill-line">${level}</span>`;
}
function tagsHtml(u) {
  // 等级（多标签并存：985/211/双一流）
  const levelTags = (u.tags || []).filter(t => LEVEL_RANK[t] !== undefined)
    .sort((a,b) => LEVEL_RANK[a] - LEVEL_RANK[b]);
  const shown = levelTags.length ? levelTags : [u.level];
  const out = shown.map(levelPill);
  if (u.owner && u.owner !== '公办') out.push(`<span class="pill pill-line">${u.owner}</span>`);
  if (u.type) out.push(`<span class="pill pill-soft">${u.type}</span>`);
  return out.join('');
}

function actionBtns(u) {
  const inCmp = state.compare.has(u.id);
  return `<div class="flex items-center gap-3 mt-3">
    <a href="${chsiSchoolUrl(u.name)}" target="_blank" rel="noopener"
       class="text-xs text-ink-2 hover:text-accent border-b border-dotted border-line-2 hover:border-accent transition"
       onclick="event.stopPropagation()">阳光高考 · 院校 ↗</a>
    <button data-cmp="${u.id}" type="button"
       onclick="event.stopPropagation(); event.preventDefault(); toggleCompare('${u.id}')"
       class="text-xs ${inCmp?'text-accent border-b border-accent':'text-ink-2 hover:text-ink border-b border-dotted border-line-2 hover:border-ink'} transition">
      ${inCmp ? '已加入对比 ×' : '＋ 加入对比'}
    </button>
  </div>`;
}

// ---------- 对比 ----------
function toggleCompare(uid) {
  if (state.compare.has(uid)) {
    state.compare.delete(uid);
  } else {
    if (state.compare.size >= MAX_COMPARE) {
      alert(`最多对比 ${MAX_COMPARE} 所学校`);
      return;
    }
    state.compare.add(uid);
  }
  localStorage.setItem('compare', JSON.stringify([...state.compare]));
  renderCompareBar();
  // 更新所有可见的"加入对比"按钮态
  document.querySelectorAll(`[data-cmp="${uid}"]`).forEach(b => {
    const inCmp = state.compare.has(uid);
    b.className = `inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border transition ${inCmp?'bg-ink text-white border-ink':'bg-white text-ink-2 border-line hover:border-ink hover:text-ink'}`;
    b.textContent = inCmp ? '✓ 已加入对比' : '⊕ 加入对比';
  });
}
window.toggleCompare = toggleCompare;

function renderCompareBar() {
  let bar = document.getElementById('compare-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'compare-bar';
    bar.className = 'fixed bottom-0 left-0 right-0 z-40 bg-paper/95 backdrop-blur-xl border-t border-ink transition-transform duration-300';
    document.body.appendChild(bar);
  }
  const ids = [...state.compare];
  if (!ids.length) {
    bar.style.transform = 'translateY(100%)';
    return;
  }
  bar.style.transform = 'translateY(0)';
  const items = ids.map(id => state.byUid[id]).filter(Boolean);
  bar.innerHTML = `
    <div class="max-w-[1280px] mx-auto px-8 py-3 flex items-center gap-4">
      <div class="text-xs tracking-wide2 uppercase text-ink-3">对比 <span class="num text-ink ml-1">${items.length}/${MAX_COMPARE}</span></div>
      <div class="flex-1 flex gap-2 overflow-x-auto scroll-thin">
        ${items.map(u => `
          <div class="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-paper-100 text-sm border border-line">
            <span>${u.name}</span>
            <button onclick="toggleCompare('${u.id}')" class="text-ink-3 hover:text-accent text-base leading-none" title="移除">×</button>
          </div>
        `).join('')}
      </div>
      <button onclick="openCompareModal()" ${items.length<2?'disabled':''}
        class="${items.length<2?'btn-ghost opacity-40 cursor-not-allowed':'btn-primary'}">开始对比</button>
      <button onclick="clearCompare()" class="text-xs text-ink-3 hover:text-accent">清空</button>
    </div>`;
}

function clearCompare() {
  state.compare.clear();
  localStorage.removeItem('compare');
  renderCompareBar();
  document.querySelectorAll('[data-cmp]').forEach(b => {
    b.className = 'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border transition bg-white text-ink-2 border-line hover:border-ink hover:text-ink';
    b.textContent = '⊕ 加入对比';
  });
}
window.clearCompare = clearCompare;

function openCompareModal() {
  const items = [...state.compare].map(id => state.byUid[id]).filter(Boolean);
  if (items.length < 2) return;
  const modal = document.createElement('div');
  modal.id = 'compare-modal';
  modal.className = 'fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm grid place-items-center p-4 animate-fade-in';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[92vh] overflow-hidden flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-line">
        <h2 class="font-display text-xl font-bold">院校对比 · ${items.length} 所</h2>
        <div class="flex items-center gap-2">
          <button onclick="exportCompareCSV()" class="px-3 py-1.5 text-sm bg-paper-100 hover:bg-paper-200">📥 导出 CSV</button>
          <button onclick="document.getElementById('compare-modal').remove()" class="w-9 h-9 hover:bg-paper-100 grid place-items-center text-ink-3">✕</button>
        </div>
      </div>
      <div class="overflow-auto scroll-thin flex-1">
        <table class="w-full text-sm">
          <thead class="bg-paper text-ink-3 text-xs sticky top-0">
            <tr>
              <th class="text-left px-4 py-3 font-semibold w-32">维度</th>
              ${items.map(u => `<th class="text-left px-4 py-3 font-semibold">${u.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${compareRow('等级', items, u => (u.tags||[]).filter(t => LEVEL_RANK[t]!==undefined).map(levelPill).join(' '))}
            ${compareRow('类型', items, u => u.type || '—')}
            ${compareRow('省份 / 城市', items, u => `${u.province} ${u.city || ''}`.trim())}
            ${compareRow('主管部门', items, u => u.bureau || '—')}
            ${compareRow('办学层次', items, u => u.layer || '—')}
            ${compareRow('办学性质', items, u => u.owner || '公办')}
            ${compareRow('开设专业数', items, u => `<b>${(u.majors||[]).length}</b>`)}
            ${compareRow('优势专业数', items, u => `<b class="text-gold-600">${(u.advantages||[]).length}</b>`)}
            ${compareRow('优势专业', items, u => (u.advantages||[]).map(c => state.byCode[c]?.name).filter(Boolean).map(n => `<span class="px-1.5 py-0.5 rounded bg-gold-400/15 text-gold-600 text-xs mr-1 mb-1 inline-block">${n}</span>`).join('') || '—')}
            ${compareRow('开设学科门类', items, u => {
              const cats = new Set();
              for (const c of (u.majors||[])) {
                const m = state.byCode[c]; if (m) cats.add(m.category_name);
              }
              return [...cats].map(c => `<span class="px-1.5 py-0.5 rounded bg-paper-100 text-xs mr-1 mb-1 inline-block">${c}</span>`).join('') || '—';
            })}
            ${compareRow('阳光高考', items, u => `<a href="${chsiSchoolUrl(u.name)}" target="_blank" class="text-xs text-ink-2 hover:text-accent border-b border-dotted border-line-2 hover:border-accent">查看官方信息 ↗</a>`)}
          </tbody>
        </table>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}
window.openCompareModal = openCompareModal;

function compareRow(label, items, fn) {
  return `<tr class="border-t border-line">
    <td class="px-4 py-3 font-semibold text-ink-2 bg-paper/50 align-top">${label}</td>
    ${items.map(u => `<td class="px-4 py-3 align-top">${fn(u)}</td>`).join('')}
  </tr>`;
}

// ---------- CSV 导出 ----------
function toCSV(rows) {
  const esc = v => {
    const s = (v ?? '').toString();
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map(r => r.map(esc).join(',')).join('\n');
}

function downloadCSV(filename, rows) {
  const csv = '\uFEFF' + toCSV(rows);  // UTF-8 BOM for Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportCurrentCSV() {
  // 判断当前可见 Tab
  let visible = 'A';
  if (!$('#tab-C').classList.contains('hidden')) visible = 'C';
  else if (!$('#tab-B').classList.contains('hidden')) visible = 'B';

  // 模式 C：导出青海招生计划
  if (visible === 'C') {
    const arr = filterC();
    if (!arr.length) { alert('当前筛选没有结果可导出'); return; }
    const headers = ['年份','院校','院校代码','专业','专业代码','专业类','专业备注','科目','选科要求','类型','批次','计划人数','学制','学费','外语','阳光高考链接'];
    const rows = [headers];
    for (const p of arr) {
      rows.push([state.C.year, p.school, p.sCode, p.major, p.mCode, p.mCat, p.note,
        p.subject, p.req || '不限', p.type || '普通', p.batch, p.plan, p.years,
        p.fee || '', p.lang, chsiSchoolUrl(p.school)]);
    }
    downloadCSV(`青海${state.C.year}招生计划-筛选-${new Date().toISOString().slice(0,10)}.csv`, rows);
    return;
  }

  let unis, fname;
  if (visible === 'A') {
    unis = filterUnisA();
    fname = `院校列表-${new Date().toISOString().slice(0,10)}.csv`;
  } else {
    if (!state.B.major) { alert('请先在模式二选择一个专业'); return; }
    const opens = state.index.opens[state.B.major] || [];
    const adv = new Set(state.index.advantages[state.B.major] || []);
    unis = opens.map(id => state.byUid[id]).filter(Boolean);
    if (state.B.onlyAdv) unis = unis.filter(u => adv.has(u.id));
    if (state.B.province) unis = unis.filter(u => u.province === state.B.province);
    if (state.B.level) unis = unis.filter(u => (u.tags||[]).includes(state.B.level) || u.level === state.B.level);
    const m = state.byCode[state.B.major];
    fname = `${m.name}-开设院校-${new Date().toISOString().slice(0,10)}.csv`;
  }
  if (!unis.length) { alert('当前筛选没有结果可导出'); return; }
  const major = visible === 'B' ? state.byCode[state.B.major] : null;
  const advSet = visible === 'B' ? new Set(state.index.advantages[state.B.major] || []) : null;
  const headers = ['学校名称','省份','城市','主管部门','办学层次','办学性质','院校类型','等级标签','开设专业数','优势专业数','阳光高考链接'];
  if (major) headers.splice(8, 0, `是否${major.name}优势专业`);
  const rows = [headers];
  for (const u of unis) {
    const row = [
      u.name, u.province, u.city || '', u.bureau || '', u.layer || '',
      u.owner || '公办', u.type || '',
      (u.tags||[]).filter(t => LEVEL_RANK[t]!==undefined).join('/'),
      (u.majors||[]).length, (u.advantages||[]).length,
      chsiSchoolUrl(u.name),
    ];
    if (major) row.splice(8, 0, advSet.has(u.id) ? '是' : '否');
    rows.push(row);
  }
  downloadCSV(fname, rows);
}
window.exportCurrentCSV = exportCurrentCSV;

function exportCompareCSV() {
  const items = [...state.compare].map(id => state.byUid[id]).filter(Boolean);
  if (!items.length) return;
  const headers = ['维度', ...items.map(u => u.name)];
  const rows = [headers];
  const cell = (label, fn) => rows.push([label, ...items.map(fn)]);
  cell('等级', u => (u.tags||[]).filter(t => LEVEL_RANK[t]!==undefined).join('/'));
  cell('类型', u => u.type || '');
  cell('省份', u => u.province || '');
  cell('城市', u => u.city || '');
  cell('主管部门', u => u.bureau || '');
  cell('办学层次', u => u.layer || '');
  cell('办学性质', u => u.owner || '公办');
  cell('开设专业数', u => (u.majors||[]).length);
  cell('优势专业数', u => (u.advantages||[]).length);
  cell('优势专业', u => (u.advantages||[]).map(c => state.byCode[c]?.name).filter(Boolean).join('、'));
  cell('阳光高考链接', u => chsiSchoolUrl(u.name));
  downloadCSV(`院校对比-${new Date().toISOString().slice(0,10)}.csv`, rows);
}
window.exportCompareCSV = exportCompareCSV;

// ===================== 模式 C：省份录取数据（通用版·用户自行上传） =====================
// state.qh 存储用户上传的各年份数据，key = 年份数字
// 数据格式与青海版相同：{ plans, majorScores, schoolScores, rankTable, _meta }
// 用户需通过 parse_qinghai_history.py 脚本生成对应省份的 JSON 文件后上传

function qhData(year) {
  const d = state.qh[year];
  if (!d) return { plans: [], majorScores: [], schoolScores: [], rankTable: [], _placeholder: true };
  return d;
}
function qhAvail(year) {
  const d = state.qh[year];
  return !!d && !d._placeholder && (d.plans?.length || d.majorScores?.length || d.rankTable?.length);
}

// 已加载的年份（动态，由用户上传决定）
function getLoadedYears() {
  return Object.keys(state.qh).map(Number).filter(y => qhAvail(y)).sort();
}
const QH_YEARS = [2022, 2023, 2024, 2025]; // 兼容旧引用，实际使用 getLoadedYears()

function scoreToRank(year, score) {
  const d = qhData(year);
  if (!d.rankTable?.length) return null;
  for (const row of d.rankTable) {
    if (row.score <= score) return row.cum;
  }
  return d.rankTable.at(-1).cum;
}
function rankToScore(year, rank) {
  const d = qhData(year);
  if (!d.rankTable?.length) return null;
  for (const row of d.rankTable) {
    if (row.cum >= rank) return row.score;
  }
  return d.rankTable.at(-1).score;
}
function rankToEquivalent(refRank, refYear, targetYear) {
  const refTotal = qhData(refYear).rankTable.at(-1)?.cum || 1;
  const tgtTotal = qhData(targetYear).rankTable.at(-1)?.cum || 1;
  return Math.round(refRank * tgtTotal / refTotal);
}

function initModeC() {
  renderCDataStatus();

  // 上传按钮绑定
  const uploadArea = $('#C-upload-area');
  const fileInput = $('#C-file-input');
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('border-accent'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('border-accent'));
    uploadArea.addEventListener('drop', e => {
      e.preventDefault();
      uploadArea.classList.remove('border-accent');
      handleDataFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', e => handleDataFiles(e.target.files));
  }

  $$('.C-sub-btn').forEach(btn => {
    btn.onclick = () => {
      state.C.sub = btn.dataset.sub;
      $$('.C-sub-btn').forEach(b => b.classList.toggle('tab-active', b===btn));
      $$('.C-sub-view').forEach(v => v.classList.toggle('hidden', v.id !== 'C-' + state.C.sub));
      if (state.C.sub === 'plans') initPlanFilters();
      if (state.C.sub === 'trend') initTrendSearch();
    };
  });

  initScoreView();
  initTrendSearch();
  initPlanFilters();
}

function renderCDataStatus() {
  const loaded = getLoadedYears();
  if (!loaded.length) {
    $('#C-data-status').innerHTML = `<div class="col-span-2 text-ink-3 text-xs">尚未上传数据 · 请在下方上传 JSON 文件</div>`;
    return;
  }
  const cells = loaded.map(y => {
    const d = state.qh[y];
    return `<div class="text-ink-2"><span class="num text-ink mr-1">${y}</span>${(d._meta?.plans||0).toLocaleString()} 计划 · ${(d._meta?.majorScores||0).toLocaleString()} 专业分</div>`;
  });
  $('#C-data-status').innerHTML = cells.join('');
}

// 处理用户上传的 JSON 数据文件（支持多个）
async function handleDataFiles(files) {
  const results = [];
  for (const file of files) {
    if (!file.name.endsWith('.json')) continue;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      // 从文件名推断年份，例如 qh_2024.json 或 2024.json 或任意省份_2024.json
      const yearMatch = file.name.match(/(\d{4})/);
      if (!yearMatch) { results.push(`⚠ ${file.name}：文件名中未找到年份（需含4位数字年份）`); continue; }
      const year = parseInt(yearMatch[1], 10);
      // 验证数据格式
      if (!data.plans && !data.majorScores && !data.rankTable) {
        results.push(`⚠ ${file.name}：数据格式不正确，需含 plans / majorScores / rankTable 字段`);
        continue;
      }
      state.qh[year] = data;
      // 更新默认参考年份
      const loaded = getLoadedYears();
      if (loaded.length) state.C.refYear = loaded.at(-1);
      state.C.planYear = loaded.at(-1) || year;
      results.push(`✓ ${file.name}：${year} 年数据加载成功（${(data.plans||[]).length} 条计划 · ${(data.majorScores||[]).length} 条专业分）`);
    } catch(e) {
      results.push(`✗ ${file.name}：解析失败 — ${e.message}`);
    }
  }
  // 显示结果
  const log = $('#C-upload-log');
  if (log) log.innerHTML = results.map(r => `<div class="py-1 border-b border-line last:border-0">${r}</div>`).join('');
  // 刷新 UI
  renderCDataStatus();
  initScoreView();
  initTrendSearch();
  initPlanFilters();
}

function initScoreView() {
  const loaded = getLoadedYears();
  if (!loaded.length) {
    $('#C-ref-years').innerHTML = `<span class="text-xs text-ink-3">请先上传录取数据</span>`;
    return;
  }
  if (!qhAvail(state.C.refYear)) state.C.refYear = loaded.at(-1);
  $('#C-ref-years').innerHTML = loaded.map(y =>
    `<button data-ry="${y}" class="chip ${y===state.C.refYear?'chip-on':''} num">${y}</button>`
  ).join('');
  $('#C-ref-years').onclick = e => {
    const b = e.target.closest('[data-ry]'); if (!b) return;
    const y = +b.dataset.ry;
    if (!qhAvail(y)) return;
    state.C.refYear = y;
    initScoreView();
    if (state.C.rec) computeRecommendation();
  };
  $('#C-only-bk').checked = state.C.onlyBk;
  $('#C-only-bk').onchange = e => {
    state.C.onlyBk = e.target.checked;
    if (state.C.rec) computeRecommendation();
  };
  $('#C-input-score').oninput = e => state.C.inputScore = e.target.value.trim();
  $('#C-input-rank').oninput = e => state.C.inputRank = e.target.value.trim();
  $('#C-btn-recommend').onclick = computeRecommendation;
  $('#C-input-score').onkeydown = e => { if (e.key === 'Enter') computeRecommendation(); };
  $('#C-input-rank').onkeydown = e => { if (e.key === 'Enter') computeRecommendation(); };
}

function computeRecommendation() {
  const score = parseInt(state.C.inputScore, 10);
  let rank = parseInt(state.C.inputRank, 10);
  if (!Number.isFinite(score) && !Number.isFinite(rank)) {
    alert('请输入分数或位次');
    return;
  }
  const loaded = getLoadedYears();
  if (!loaded.length) {
    alert('请先上传录取数据（JSON 文件）');
    return;
  }
  const inputYear = loaded.at(-1);
  if (!Number.isFinite(rank)) {
    rank = scoreToRank(inputYear, score);
  }
  if (!rank) {
    alert(`无法换算位次，请检查输入或确认 ${inputYear} 一分一段表已包含在上传数据中`);
    return;
  }
  const refRank = state.C.refYear === inputYear ? rank : rankToEquivalent(rank, inputYear, state.C.refYear);
  const refScore = rankToScore(state.C.refYear, refRank);

  const refData = qhData(state.C.refYear);
  let pool = refData.majorScores.filter(r => r.minRank > 0 && r.minScore > 0);
  if (state.C.onlyBk) pool = pool.filter(r => /本科批/.test(r.batch));

  const buckets = { chong: [], wen: [], bao: [] };
  for (const r of pool) {
    const ratio = r.minRank / refRank;
    if (ratio >= 0.50 && ratio < 0.85) buckets.chong.push(r);
    else if (ratio >= 0.85 && ratio < 1.15) buckets.wen.push(r);
    else if (ratio >= 1.15 && ratio < 1.80) buckets.bao.push(r);
  }
  for (const k of ['chong','wen','bao']) {
    buckets[k].sort((a,b) => Math.abs(Math.log(a.minRank/refRank)) - Math.abs(Math.log(b.minRank/refRank)));
  }

  state.C.rec = { score, rank, inputYear, refYear: state.C.refYear, refRank, refScore, buckets };
  renderRecommendation();
}

function renderRecommendation() {
  const r = state.C.rec;
  if (!r) return;
  const inputYear = r.inputYear;
  $('#C-rec-empty').classList.add('hidden');
  $('#C-rec-result').classList.remove('hidden');
  const refDataLine = qhData(r.refYear).rankTable[0]?.line || '';

  // 96 志愿建议数：冲 40 / 稳 35 / 保 25
  const recCount = { chong: 40, wen: 35, bao: 25 };

  const tierBlock = (key, label, range, desc, tierClass, items) => {
    const top = items.slice(0, 50);
    const need = recCount[key];
    return `
    <section>
      <div class="tier-rule ${tierClass} mb-4"></div>
      <div class="grid grid-cols-12 gap-4 mb-5 items-end">
        <div class="col-span-7">
          <div class="flex items-baseline gap-3">
            <h3 class="display-hero text-2xl">${label}</h3>
            <span class="num text-ink-3 text-sm">${range}</span>
          </div>
          <p class="text-xs text-ink-3 mt-1.5">${desc}</p>
        </div>
        <div class="col-span-5 text-right text-sm">
          <span class="text-ink-3 mr-2">建议填报</span>
          <span class="num-display text-3xl text-ink mr-1">${need}</span>
          <span class="text-ink-3 text-xs">个志愿 · 共匹配 <span class="num text-ink">${items.length}</span> 项</span>
        </div>
      </div>
      <div class="border border-line">
        ${top.map((it,i) => recRow(it, r, i)).join('') || `<div class="p-8 text-center text-ink-3 text-sm">该档暂无匹配项 · 试试其他参考年份</div>`}
        ${items.length > top.length ? `<div class="px-5 py-3 text-center text-xs text-ink-3 border-t border-line bg-paper">还有 <span class="num text-ink">${items.length-top.length}</span> 项未显示</div>`:''}
      </div>
    </section>`;
  };

  $('#C-rec-result').innerHTML = `
    <!-- 你的分数 hero 摘要 -->
    <div class="grid grid-cols-12 gap-6 border-y-2 border-ink py-8">
      <div class="col-span-3 border-r border-line pr-6">
        <div class="text-xs text-ink-3 tracking-wide2 uppercase mb-2">你的分数</div>
        <div class="display-num text-5xl">${r.score || '—'}</div>
        <div class="text-xs text-ink-3 mt-1">${inputYear} 年数据</div>
      </div>
      <div class="col-span-3 border-r border-line pr-6">
        <div class="text-xs text-ink-3 tracking-wide2 uppercase mb-2">${inputYear} 等效位次</div>
        <div class="display-num text-5xl">${r.rank.toLocaleString()}</div>
        <div class="text-xs text-ink-3 mt-1">由分数自动换算</div>
      </div>
      <div class="col-span-3 border-r border-line pr-6">
        <div class="text-xs text-ink-3 tracking-wide2 uppercase mb-2">${r.refYear} 等效位次</div>
        <div class="display-num text-5xl">${r.refRank.toLocaleString()}</div>
        <div class="text-xs text-ink-3 mt-1">用于匹配 ${r.refYear} 录取数据</div>
      </div>
      <div class="col-span-3 pr-6">
        <div class="text-xs text-ink-3 tracking-wide2 uppercase mb-2">${r.refYear} 等效分数</div>
        <div class="display-num text-5xl">${r.refScore || '—'}</div>
        <div class="text-xs text-ink-3 mt-1">控制线 <span class="num">${refDataLine}</span></div>
      </div>
    </div>

    ${tierBlock('chong', '冲一冲', '位次区间 ' + Math.round(r.refRank*0.50).toLocaleString() + ' – ' + Math.round(r.refRank*0.85).toLocaleString(), '录取位次比你高 15%–50% · 敢于尝试，难度较大', 'tier-push', r.buckets.chong)}
    ${tierBlock('wen', '稳一稳', '位次区间 ' + Math.round(r.refRank*0.85).toLocaleString() + ' – ' + Math.round(r.refRank*1.15).toLocaleString(), '录取位次与你相近 ±15% · 命中率高，志愿主体', 'tier-warn', r.buckets.wen)}
    ${tierBlock('bao', '保一保', '位次区间 ' + Math.round(r.refRank*1.15).toLocaleString() + ' – ' + Math.round(r.refRank*1.80).toLocaleString(), '录取位次比你低 15%–80% · 兜底防滑档', 'tier-safe', r.buckets.bao)}

    <div class="text-xs text-ink-3 leading-relaxed pt-6 border-t border-line">
      <span class="tracking-wide2 uppercase mr-2">注</span>
      推荐基于 ${r.refYear} 年真实录取数据，按位次比例匹配。每条均显示当年最低录取分与最低位次，便于横向对比。最终请以学校招生章程与省教育考试院公告为准。
    </div>
  `;
}

function recRow(it, r, idx) {
  const labels = [];
  if (it.is985) labels.push('<span class="pill pill-985">985</span>');
  else if (it.is211) labels.push('<span class="pill pill-211">211</span>');
  if (it.owner === '民办') labels.push('<span class="pill pill-line">民办</span>');
  return `
    <div class="grid grid-cols-12 gap-4 px-5 py-4 items-center ${idx>0?'border-t border-line':''} hover:bg-paper-50">
      <div class="col-span-1 num text-ink-3 text-xs">${String((idx??0)+1).padStart(2,'0')}</div>
      <div class="col-span-6 min-w-0">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <span class="display-hero text-base">${it.school}</span>
          ${labels.join('')}
          <span class="pill pill-line">${it.province}</span>
          <span class="pill pill-soft">${it.batch}</span>
        </div>
        <div class="text-sm text-ink-2">${it.major}<span class="num text-ink-4 ml-2 text-xs">${it.mCode}</span></div>
        ${it.note?`<div class="text-xs text-ink-3 mt-0.5">${it.note}</div>`:''}
      </div>
      <div class="col-span-2 text-right">
        <div class="display-num text-2xl text-ink">${it.minScore}</div>
        <div class="text-xs text-ink-3 mt-0.5">${r.refYear} 最低分</div>
      </div>
      <div class="col-span-2 text-right">
        <div class="num text-lg text-ink-2">${it.minRank.toLocaleString()}</div>
        <div class="text-xs text-ink-3 mt-0.5">最低位次</div>
      </div>
      <div class="col-span-1 text-right">
        <a href="${chsiSchoolUrl(it.school)}" target="_blank" rel="noopener" class="text-xs text-ink-2 hover:text-accent border-b border-dotted border-line-2 hover:border-accent" onclick="event.stopPropagation()">详情 ↗</a>
      </div>
    </div>`;
}

function initTrendSearch() {
  const input = $('#C-school-search');
  if (!input) return;
  const allSchools = new Set();
  for (const y of QH_YEARS) {
    for (const r of (state.qh[y]?.schoolScores || [])) allSchools.add(r.school);
  }
  const list = [...allSchools].sort((a,b)=>a.localeCompare(b,'zh-Hans-CN'));
  input.oninput = e => {
    const k = e.target.value.trim();
    const sug = $('#C-school-suggest');
    if (!k) { sug.classList.add('hidden'); return; }
    const matched = list.filter(n => n.includes(k)).slice(0, 50);
    sug.innerHTML = matched.map(n => `<div data-sn="${n}" class="px-4 py-2 hover:bg-paper-100 cursor-pointer text-sm">${n}</div>`).join('') || '<div class="px-4 py-3 text-ink-3 text-sm">未找到</div>';
    sug.classList.remove('hidden');
  };
  $('#C-school-suggest').onclick = e => {
    const it = e.target.closest('[data-sn]'); if (!it) return;
    state.C.selectedSchool = it.dataset.sn;
    input.value = it.dataset.sn;
    $('#C-school-suggest').classList.add('hidden');
    renderTrend();
  };
  input.onblur = () => setTimeout(() => $('#C-school-suggest').classList.add('hidden'), 200);
  input.onfocus = e => { if (e.target.value) e.target.dispatchEvent(new Event('input')); };
}

function renderTrend() {
  const name = state.C.selectedSchool;
  if (!name) { $('#C-trend-result').innerHTML = ''; return; }
  const byYear = {};
  for (const y of QH_YEARS) {
    const d = state.qh[y]; if (!d) continue;
    byYear[y] = {
      ss: (d.schoolScores || []).filter(r => r.school === name),
      ms: (d.majorScores || []).filter(r => r.school === name),
    };
  }

  let tags = '';
  for (const y of QH_YEARS) {
    const r = byYear[y]?.ss[0]; if (!r) continue;
    const lab = [];
    if (r.is985) lab.push('<span class="pill level-985">985</span>');
    else if (r.is211) lab.push('<span class="pill level-211">211</span>');
    lab.push(`<span class="pill tag-owner">${r.owner}</span>`);
    lab.push(`<span class="pill tag-owner">${r.province}</span>`);
    tags = lab.join(''); break;
  }

  const ssRows = [];
  for (const y of QH_YEARS) for (const r of (byYear[y]?.ss || [])) ssRows.push({ year: y, ...r });
  ssRows.sort((a,b) => b.year - a.year || a.batch.localeCompare(b.batch));

  const majorMap = new Map();
  for (const y of QH_YEARS) {
    for (const r of (byYear[y]?.ms || [])) {
      const key = `${r.major}|${r.batch}|${r.mGroup||''}`;
      if (!majorMap.has(key)) majorMap.set(key, { major: r.major, batch: r.batch, mGroup: r.mGroup, mCode: r.mCode, byYear: {} });
      majorMap.get(key).byYear[y] = r;
    }
  }
  const majorRows = [...majorMap.values()].sort((a,b) => {
    const sa = a.byYear[2025]?.minScore || a.byYear[2024]?.minScore || a.byYear[2023]?.minScore || 0;
    const sb = b.byYear[2025]?.minScore || b.byYear[2024]?.minScore || b.byYear[2023]?.minScore || 0;
    return sb - sa;
  });

  $('#C-trend-result').innerHTML = `
    <div class="card-flat border border-line p-6 mb-5">
      <div class="flex items-center gap-3 flex-wrap">
        <h2 class="font-display text-2xl font-bold">${name}</h2>
        ${tags}
        <a href="${chsiSchoolUrl(name)}" target="_blank" rel="noopener" class="ml-auto btn-primary">阳光高考·院校 ↗</a>
      </div>
      <p class="text-sm text-ink-3 mt-2">青海 · 物理类/理科 · 2022-2025 历年录取数据</p>
    </div>
    ${ssRows.length ? `
    <div class="bg-white  border border-line/60 overflow-hidden mb-5">
      <div class="px-5 py-3 border-b border-line font-semibold">📊 院校整体录取（按批次）</div>
      <div class="overflow-x-auto scroll-thin">
        <table class="w-full text-sm">
          <thead class="bg-paper text-ink-3 text-xs">
            <tr>
              <th class="text-left px-4 py-2.5">年份</th><th class="text-left px-4 py-2.5">批次</th>
              <th class="text-left px-4 py-2.5">招生类型</th>
              <th class="text-right px-4 py-2.5">最低分</th><th class="text-right px-4 py-2.5">最低位次</th>
              <th class="text-right px-4 py-2.5">线差</th><th class="text-right px-4 py-2.5">录取人数</th>
            </tr>
          </thead>
          <tbody>
            ${ssRows.map(r => `<tr class="border-t border-line hover:bg-paper/40">
              <td class="px-4 py-2.5 font-mono">${r.year}</td><td class="px-4 py-2.5">${r.batch}</td>
              <td class="px-4 py-2.5">${r.type || '普通类'}</td>
              <td class="px-4 py-2.5 text-right font-display font-bold">${r.minScore}</td>
              <td class="px-4 py-2.5 text-right">${r.minRank.toLocaleString()}</td>
              <td class="px-4 py-2.5 text-right ${r.lineDiff>0?'text-emerald-600':r.lineDiff<0?'text-rose-500':''}">${r.lineDiff>0?'+':''}${r.lineDiff}</td>
              <td class="px-4 py-2.5 text-right">${r.admitted || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`:''}
    ${majorRows.length ? `
    <div class="bg-white  border border-line/60 overflow-hidden">
      <div class="px-5 py-3 border-b border-line font-semibold">📚 各专业历年最低分（${majorRows.length} 个专业）</div>
      <div class="overflow-x-auto scroll-thin">
        <table class="w-full text-sm">
          <thead class="bg-paper text-ink-3 text-xs sticky top-0">
            <tr>
              <th class="text-left px-4 py-2.5 min-w-[180px]">专业</th>
              <th class="text-left px-4 py-2.5">批次</th>
              ${QH_YEARS.map(y => `<th class="text-right px-4 py-2.5 min-w-[120px]">${y}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${majorRows.map(m => `<tr class="border-t border-line hover:bg-paper/40">
              <td class="px-4 py-2.5"><div class="font-medium">${m.major}</div>${m.mGroup?`<div class="text-xs text-ink-3">专业组：${m.mGroup}</div>`:''}</td>
              <td class="px-4 py-2.5 text-xs">${m.batch}</td>
              ${QH_YEARS.map(y => {
                const c = m.byYear[y];
                if (!c) return '<td class="px-4 py-2.5 text-right text-ink-4">—</td>';
                return `<td class="px-4 py-2.5 text-right"><div class="font-display font-bold">${c.minScore}</div><div class="text-xs text-ink-3">位次 ${c.minRank.toLocaleString()}</div></td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : '<div class="bg-white border border-line/60 p-10 text-center text-ink-3">该校在青海无物理类/理科录取记录</div>'}
  `;
}

function initPlanFilters() {
  const loaded = getLoadedYears();
  if (!loaded.length) {
    $('#C-plan-years').innerHTML = `<span class="text-xs text-ink-3">请先上传数据</span>`;
    $('#C-list').innerHTML = renderCUploadGuide();
    $('#C-pager').innerHTML = '';
    $('#C-count').textContent = '';
    $('#C-plansum').textContent = '';
    return;
  }
  if (!qhAvail(state.C.planYear)) state.C.planYear = loaded.at(-1);
  $('#C-plan-years').innerHTML = loaded.map(y =>
    `<span class="chip ${y===state.C.planYear?'chip-on':''}" data-py="${y}">${y}</span>`
  ).join('');
  $('#C-plan-years').onclick = e => {
    const c = e.target.closest('[data-py]'); if (!c) return; popChip(c);
    const y = +c.dataset.py;
    if (!qhAvail(y)) { alert(`${y} 年数据未导入`); return; }
    state.C.planYear = y;
    state.C.batches = new Set(); state.C.reqs = new Set(); state.C.types = new Set();
    state.C.page = 1;
    initPlanFilters();
    renderPlans();
  };

  const cur = qhData(state.C.planYear);
  const plans = cur.plans || [];
  const bs = uniqueCounts(plans, p => p.batch);
  $('#C-batches').innerHTML = bs.map(([b,n]) =>
    `<span class="chip ${state.C.batches.has(b)?'chip-on':''}" data-bt="${b}">${b}<span class="chip-count ml-1">${n}</span></span>`).join('');
  $('#C-batches').onclick = e => {
    const c = e.target.closest('[data-bt]'); if (!c) return; popChip(c);
    const v = c.dataset.bt;
    state.C.batches.has(v) ? state.C.batches.delete(v) : state.C.batches.add(v);
    state.C.page = 1; syncChipsMulti('#C-batches','data-bt', state.C.batches); renderPlans();
  };
  const rs = uniqueCounts(plans, p => p.req || '不限').slice(0, 15);
  $('#C-reqs').innerHTML = rs.map(([r,n]) =>
    `<span class="chip ${state.C.reqs.has(r)?'chip-on':''}" data-rq="${r}">${r}<span class="chip-count ml-1">${n}</span></span>`).join('');
  $('#C-reqs').onclick = e => {
    const c = e.target.closest('[data-rq]'); if (!c) return; popChip(c);
    const v = c.dataset.rq;
    state.C.reqs.has(v) ? state.C.reqs.delete(v) : state.C.reqs.add(v);
    state.C.page = 1; syncChipsMulti('#C-reqs','data-rq', state.C.reqs); renderPlans();
  };
  const ts = uniqueCounts(plans, p => p.type || '普通类');
  $('#C-types').innerHTML = ts.map(([t,n]) =>
    `<span class="chip ${state.C.types.has(t)?'chip-on':''}" data-cty="${t}">${t}<span class="chip-count ml-1">${n}</span></span>`).join('');
  $('#C-types').onclick = e => {
    const c = e.target.closest('[data-cty]'); if (!c) return; popChip(c);
    const v = c.dataset.cty;
    state.C.types.has(v) ? state.C.types.delete(v) : state.C.types.add(v);
    state.C.page = 1; syncChipsMulti('#C-types','data-cty', state.C.types); renderPlans();
  };

  // ----- 学校所在省 / 城市（join from state.unis by school name） -----
  const provinceOf = name => state.unis.find(u => u.name === name);
  const provs = uniqueCounts(plans, p => provinceOf(p.school)?.province || '其他/港澳台/未匹配');
  $('#C-provinces').innerHTML = provs.map(([p,n]) =>
    `<span class="chip ${state.C.province===p?'chip-on':''}" data-cprv="${p}">${p}<span class="chip-count ml-1">${n}</span></span>`).join('');
  $('#C-provinces').onclick = e => {
    const c = e.target.closest('[data-cprv]'); if (!c) return; popChip(c);
    const v = c.dataset.cprv;
    // toggle：再次点同一个清除
    state.C.province = (state.C.province === v) ? '' : v;
    state.C.city = '';
    state.C.page = 1;
    syncChips('#C-provinces','data-cprv', state.C.province);
    renderPlanCities();
    renderPlans();
  };
  renderPlanCities();

  // ----- 专业类（按专业名反查 majors_flat 的 sub_name） -----
  const subByName = {};
  for (const fm of state.flatMajors) {
    if (!subByName[fm.name]) subByName[fm.name] = fm.sub_name;
  }
  const mc = uniqueCounts(plans, p => subByName[p.major] || '').filter(([k]) => k);
  $('#C-mcats').innerHTML = mc.slice(0, 40).map(([name,n]) =>
    `<span class="chip ${state.C.mCats.has(name)?'chip-on':''}" data-cmct="${name}">${name}<span class="chip-count ml-1">${n}</span></span>`
  ).join('');
  $('#C-mcats').onclick = e => {
    const c = e.target.closest('[data-cmct]'); if (!c) return; popChip(c);
    const v = c.dataset.cmct;
    state.C.mCats.has(v) ? state.C.mCats.delete(v) : state.C.mCats.add(v);
    state.C.page = 1;
    syncChipsMulti('#C-mcats','data-cmct', state.C.mCats);
    renderPlans();
  };

  $('#C-search').oninput = e => { state.C.keyword = e.target.value.trim(); state.C.page=1; renderPlans(); };
  $('#C-fee-min').oninput = e => { state.C.feeMin = e.target.value; state.C.page=1; renderPlans(); };
  $('#C-fee-max').oninput = e => { state.C.feeMax = e.target.value; state.C.page=1; renderPlans(); };
  $('#C-group').onchange = e => { state.C.group = e.target.value; state.C.page=1; renderPlans(); };
  $('#C-sort').onchange = e => { state.C.sort = e.target.value; state.C.page=1; renderPlans(); };
  $('#C-reset').onclick = () => {
    state.C.batches=new Set(); state.C.reqs=new Set(); state.C.types=new Set();
    state.C.province=''; state.C.city=''; state.C.mCats=new Set();
    state.C.feeMin=''; state.C.feeMax=''; state.C.keyword=''; state.C.page=1;
    $('#C-search').value=''; $('#C-fee-min').value=''; $('#C-fee-max').value='';
    initPlanFilters(); renderPlans();
  };
  renderPlans();
}

// 模式三：省份变化后渲染城市 chips
function renderPlanCities() {
  const box = $('#C-cities'); if (!box) return;
  if (!state.C.province) {
    box.innerHTML = `<span class="text-xs text-ink-3">先选省份</span>`;
    return;
  }
  // 找该省份下所有出现在本年 plans 里的城市
  const cur = qhData(state.C.planYear);
  const plans = cur.plans || [];
  const cityCounts = new Map();
  for (const p of plans) {
    const u = state.unis.find(x => x.name === p.school);
    if (!u || u.province !== state.C.province) continue;
    const c = u.city || '—';
    cityCounts.set(c, (cityCounts.get(c) || 0) + 1);
  }
  const cities = [...cityCounts.entries()].sort((a,b)=>b[1]-a[1]);
  if (!cities.length) {
    box.innerHTML = `<span class="text-xs text-ink-3">该省无匹配</span>`;
    return;
  }
  box.innerHTML = `<span class="chip ${state.C.city===''?'chip-on':''}" data-cct="">全部</span>` +
    cities.map(([c,n]) =>
      `<span class="chip ${state.C.city===c?'chip-on':''}" data-cct="${c}">${c}<span class="chip-count ml-1">${n}</span></span>`).join('');
  box.onclick = e => {
    const c = e.target.closest('[data-cct]'); if (!c) return; popChip(c);
    state.C.city = c.dataset.cct;
    state.C.page = 1;
    syncChips('#C-cities','data-cct', state.C.city);
    renderPlans();
  };
}

function uniqueCounts(arr, keyFn) {
  const m = new Map();
  for (const x of arr) { const k = keyFn(x); m.set(k, (m.get(k)||0)+1); }
  return [...m.entries()].sort((a,b) => b[1] - a[1]);
}
function feeNum(p) {
  const n = parseInt((p.fee||'').replace(/[^\d]/g,''), 10);
  return Number.isFinite(n) ? n : 0;
}

function filterPlans() {
  const cur = qhData(state.C.planYear);
  if (cur._placeholder || !cur.plans) return [];
  let arr = cur.plans;
  if (state.C.batches.size) arr = arr.filter(p => state.C.batches.has(p.batch));
  if (state.C.reqs.size) arr = arr.filter(p => state.C.reqs.has(p.req || '不限'));
  if (state.C.types.size) arr = arr.filter(p => state.C.types.has(p.type || '普通类'));
  if (state.C.province) arr = arr.filter(p => state.unis.find(u => u.name === p.school)?.province === state.C.province);
  if (state.C.city) arr = arr.filter(p => state.unis.find(u => u.name === p.school)?.city === state.C.city);
  if (state.C.mCats.size) {
    const subByName = {};
    for (const fm of state.flatMajors) if (!subByName[fm.name]) subByName[fm.name] = fm.sub_name;
    arr = arr.filter(p => state.C.mCats.has(subByName[p.major] || ''));
  }
  const fMin = state.C.feeMin === '' ? null : +state.C.feeMin;
  const fMax = state.C.feeMax === '' ? null : +state.C.feeMax;
  if (fMin !== null || fMax !== null) {
    arr = arr.filter(p => {
      const f = feeNum(p);
      if (fMin !== null && f < fMin) return false;
      if (fMax !== null && f > fMax) return false;
      return true;
    });
  }
  if (state.C.keyword) {
    const k = state.C.keyword.toLowerCase();
    arr = arr.filter(p => p.school.toLowerCase().includes(k) || p.major.toLowerCase().includes(k) || (p.note||'').toLowerCase().includes(k));
  }
  return arr;
}

function planRow(p) {
  return `
    <div class="bg-white border border-line/60 hover:border-line-2 p-4 transition">
      <div class="flex items-start gap-3 flex-wrap">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="font-display font-semibold">${p.school}</span>
            <span class="text-xs text-ink-3">${p.sCode}</span>
            <span class="pill bg-paper-100 text-ink-2">${p.batch}</span>
            ${p.type && p.type !== '普通类' ? `<span class="pill bg-purple-100 text-purple-700">${p.type}</span>`:''}
          </div>
          <div class="text-sm">
            <span class="font-medium">${p.major}</span>
            <span class="text-ink-3 text-xs ml-1">${p.mCode}</span>
            ${p.mGroup?`<span class="text-ink-3 text-xs ml-2">组${p.mGroup}</span>`:''}
          </div>
          ${p.note ? `<div class="text-xs text-ink-3 mt-1">${p.note}</div>` : ''}
          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink-3">
            <span>选科：<b class="text-ink-2">${p.req || '不限'}</b></span>
            <span>计划：<b class="text-ink-2">${p.plan} 人</b></span>
            <span>学制：<b class="text-ink-2">${p.years || '—'}</b></span>
            <span>学费：<b class="text-ink-2">${p.fee || '—'}</b></span>
          </div>
        </div>
        <a href="${chsiSchoolUrl(p.school)}" target="_blank" rel="noopener" class="text-xs text-ink-2 hover:text-accent border-b border-dotted border-line-2 hover:border-accent self-start">阳光高考 ↗</a>
      </div>
    </div>`;
}

function renderCUploadGuide() {
  return `<div class="bg-white border-2 border-dashed border-line p-12 text-center">
    <div class="text-5xl mb-3">📥</div>
    <p class="font-display text-xl font-bold mb-2">请先上传录取数据</p>
    <p class="text-sm text-ink-3 mb-6 max-w-lg mx-auto">本工具支持任意省份的录取数据。请按以下步骤准备并上传 JSON 文件：</p>
    <div class="text-left max-w-xl mx-auto space-y-3 text-sm text-ink-2 mb-6">
      <div class="flex gap-3"><span class="num-display text-accent font-bold">01</span><span>准备数据：收集你所在省份的历年<b>招生计划</b>、<b>专业录取分数</b>、<b>院校录取分数</b>、<b>一分一段表</b>（Excel 格式）</span></div>
      <div class="flex gap-3"><span class="num-display text-accent font-bold">02</span><span>运行脚本：将数据放入 <code class="bg-paper-100 px-1.5 py-0.5">scripts/</code> 目录，参照 <code class="bg-paper-100 px-1.5 py-0.5">parse_qinghai_history.py</code> 修改字段映射，运行后生成 <code class="bg-paper-100 px-1.5 py-0.5">YYYY.json</code> 文件</span></div>
      <div class="flex gap-3"><span class="num-display text-accent font-bold">03</span><span>上传数据：将生成的 JSON 文件拖入上方上传区域，或点击"选择文件"按钮，支持同时上传多个年份</span></div>
      <div class="flex gap-3"><span class="num-display text-accent font-bold">04</span><span>开始使用：上传成功后，分数推荐、院校趋势、招生计划三个子功能均自动启用</span></div>
    </div>
    <div class="text-xs text-ink-3 border-t border-line pt-4 max-w-lg mx-auto">
      JSON 文件需包含以下字段：<code class="bg-paper-100 px-1">plans</code>（招生计划数组）· <code class="bg-paper-100 px-1">majorScores</code>（专业录取分数）· <code class="bg-paper-100 px-1">schoolScores</code>（院校录取分数）· <code class="bg-paper-100 px-1">rankTable</code>（一分一段表）
    </div>
  </div>`;
}

function renderPlans() {
  const cur = qhData(state.C.planYear);
  if (cur._placeholder || !cur.plans?.length) {
    $('#C-list').innerHTML = renderCUploadGuide();
    $('#C-pager').innerHTML='';
    $('#C-count').textContent=''; $('#C-plansum').textContent='';
    return;
  }
  const arr = filterPlans();
  const cmp = {
    'school': (a,b) => a.school.localeCompare(b.school,'zh-Hans-CN') || a.major.localeCompare(b.major,'zh-Hans-CN'),
    'plan-desc': (a,b) => b.plan - a.plan,
    'plan-asc': (a,b) => a.plan - b.plan,
    'fee-desc': (a,b) => feeNum(b) - feeNum(a),
    'fee-asc': (a,b) => feeNum(a) - feeNum(b),
  }[state.C.sort];
  const sorted = [...arr].sort(cmp);
  const totalPlans = arr.reduce((s,p)=>s+p.plan, 0);
  $('#C-count').textContent = `· ${arr.length.toLocaleString()} 条`;
  $('#C-plansum').textContent = `合计 ${totalPlans.toLocaleString()} 人 · ${new Set(arr.map(p=>p.school)).size} 所院校 · ${new Set(arr.map(p=>p.major)).size} 个专业`;

  if (state.C.group === 'flat') {
    const { slice, page, pages } = paginate(sorted, state.C.page, 30);
    $('#C-list').innerHTML = slice.length ? slice.map(planRow).join('') : `<div class="bg-white border border-line/60 p-10 text-center text-ink-3">没有符合条件的招生计划</div>`;
    $('#C-pager').innerHTML = pagerHtml(page, pages);
    $$('#C-pager [data-p]').forEach(b => b.onclick = () => { state.C.page = +b.dataset.p; renderPlans(); window.scrollTo({top:0,behavior:'smooth'}); });
  } else {
    const keyFn = state.C.group === 'school' ? (p=>p.school) : (p=>p.major);
    const groups = new Map();
    for (const p of sorted) {
      const k = keyFn(p);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    }
    const list = [...groups.entries()].sort((a,b) => b[1].reduce((s,p)=>s+p.plan,0) - a[1].reduce((s,p)=>s+p.plan,0));
    const { slice, page, pages } = paginate(list, state.C.page, 15);
    $('#C-list').innerHTML = slice.map(([key, items]) => {
      const totalP = items.reduce((s,p)=>s+p.plan, 0);
      return `<details class="group bg-white border border-line/60 overflow-hidden hover:border-line-2 transition">
        <summary class="p-4 flex items-center gap-3">
          <div class="flex-1"><div class="font-display font-semibold">${key}</div><div class="text-xs text-ink-3">${items.length} 条计划 · 合计 ${totalP} 人</div></div>
          <a href="${state.C.group==='school'?chsiSchoolUrl(key):chsiMajorUrl(key)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="text-xs text-ink-2 hover:text-accent border-b border-dotted border-line-2 hover:border-accent">阳光高考 ↗</a>
          <div class="text-ink-4 group-open:rotate-180 transition"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>
        </summary>
        <div class="px-4 pb-4 pt-1 border-t border-line bg-paper/40 space-y-2">${items.map(planRow).join('')}</div>
      </details>`;
    }).join('') || `<div class="bg-white border border-line/60 p-10 text-center text-ink-3">没有符合条件的招生计划</div>`;
    $('#C-pager').innerHTML = pagerHtml(page, pages);
    $$('#C-pager [data-p]').forEach(b => b.onclick = () => { state.C.page = +b.dataset.p; renderPlans(); window.scrollTo({top:0,behavior:'smooth'}); });
  }
}

// 旧名兼容（exportCurrentCSV / 其他可能引用）
function filterC() { return filterPlans(); }
function renderC() { renderPlans(); }

function paginate(items, page, size=PAGE_SIZE) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total/size));
  page = Math.min(Math.max(1, page), pages);
  return { slice: items.slice((page-1)*size, page*size), page, pages, total };
}
function pagerHtml(page, pages, onClick) {
  if (pages <= 1) return '';
  const btn = (p, label, dis) =>
    `<button data-p="${p}" ${dis?'disabled':''} class="px-3 py-1.5 text-sm ${dis?'text-ink-4':'text-ink-2 hover:text-accent border-b border-dotted border-line-2 hover:border-accent'}">${label}</button>`;
  let html = btn(page-1,'上一页', page<=1);
  const around = [];
  for (let p=Math.max(1,page-2); p<=Math.min(pages,page+2); p++) around.push(p);
  if (around[0] > 1) html += `<span class="text-ink-3 mx-1">…</span>`;
  for (const p of around) html += `<button data-p="${p}" class="px-3 py-1.5 text-sm num ${p===page?'text-ink border-b-2 border-ink':'text-ink-3 hover:text-ink'}">${p}</button>`;
  if (around.at(-1) < pages) html += `<span class="text-ink-3 mx-1">…</span>${btn(pages, pages, false)}`;
  html += btn(page+1,'下一页', page>=pages);
  return html;
}

// ---------- Tabs ----------
function initTabs() {
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('tab-active'));
      btn.classList.add('tab-active');
      const tab = btn.dataset.tab;
      $('#tab-A').classList.toggle('hidden', tab !== 'A');
      $('#tab-B').classList.toggle('hidden', tab !== 'B');
      $('#tab-C').classList.toggle('hidden', tab !== 'C');
      $('#tab-D').classList.toggle('hidden', tab !== 'D');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// ===================== 模式 A =====================
function initModeA() {
  // 省份
  const provinces = [...new Set(state.unis.map(u => u.province).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b, 'zh-Hans-CN'));
  $('#A-provinces').innerHTML =
    `<span class="chip" data-pv="">全部</span>` +
    provinces.map(p => {
      const n = state.unis.filter(u => u.province === p).length;
      return `<span class="chip" data-pv="${p}">${p}<span class="chip-count ml-1">${n}</span></span>`;
    }).join('');
  // 等级（按 tags 包含统计：双一流 ≈ 147 所，含 985/211）
  $('#A-levels').innerHTML = LEVEL_ORDER.map(l => {
    const n = state.unis.filter(u => (u.tags||[]).includes(l) || u.level === l).length;
    if (!n) return '';
    return `<span class="chip" data-lv="${l}">${l}<span class="chip-count ml-1">${n}</span></span>`;
  }).join('');
  // 类型
  $('#A-types').innerHTML = TYPE_ORDER.map(t => {
    const n = state.unis.filter(u => u.type === t).length;
    if (!n) return '';
    return `<span class="chip" data-tp="${t}">${t}<span class="chip-count ml-1">${n}</span></span>`;
  }).join('');

  // 事件
  $('#A-provinces').addEventListener('click', e => {
    const c = e.target.closest('[data-pv]'); if (!c) return;
    popChip(c);
    state.A.province = c.dataset.pv;
    state.A.city = '';
    state.A.page = 1;
    syncChips('#A-provinces','data-pv', state.A.province);
    renderACities();
    renderA();
  });
  $('#A-cities').addEventListener('click', e => {
    const c = e.target.closest('[data-ct]'); if (!c) return;
    popChip(c);
    state.A.city = c.dataset.ct;
    state.A.page = 1;
    syncChips('#A-cities','data-ct', state.A.city);
    renderA();
  });
  $('#A-levels').addEventListener('click', e => {
    const c = e.target.closest('[data-lv]'); if (!c) return; popChip(c);
    const v = c.dataset.lv;
    state.A.levels.has(v) ? state.A.levels.delete(v) : state.A.levels.add(v);
    state.A.page = 1;
    syncChipsMulti('#A-levels','data-lv', state.A.levels);
    renderA();
  });
  $('#A-types').addEventListener('click', e => {
    const c = e.target.closest('[data-tp]'); if (!c) return; popChip(c);
    const v = c.dataset.tp;
    state.A.types.has(v) ? state.A.types.delete(v) : state.A.types.add(v);
    state.A.page = 1;
    syncChipsMulti('#A-types','data-tp', state.A.types);
    renderA();
  });
  $('#A-search').addEventListener('input', e => {
    state.A.keyword = e.target.value.trim();
    state.A.page = 1;
    renderA();
  });
  $('#A-sort').addEventListener('change', e => {
    state.A.sort = e.target.value;
    renderA();
  });
  $('#A-reset').addEventListener('click', () => {
    state.A = { province:'', city:'', levels:new Set(), types:new Set(), keyword:'', sort:'level', page:1 };
    $('#A-search').value = '';
    $('#A-sort').value = 'level';
    syncChips('#A-provinces','data-pv','');
    syncChipsMulti('#A-levels','data-lv', new Set());
    syncChipsMulti('#A-types','data-tp', new Set());
    renderACities();
    renderA();
  });

  syncChips('#A-provinces','data-pv','');
}

// chip 点击波纹动效
function popChip(el) {
  if (!el) return;
  el.classList.remove('chip-pop');
  void el.offsetWidth;  // force reflow
  el.classList.add('chip-pop');
  setTimeout(() => el.classList.remove('chip-pop'), 260);
}

function syncChips(container, attr, value) {
  $$(`${container} [${attr}]`).forEach(c => {
    c.classList.toggle('chip-on', c.getAttribute(attr) === value);
  });
}
function syncChipsMulti(container, attr, set) {
  $$(`${container} [${attr}]`).forEach(c => {
    c.classList.toggle('chip-on', set.has(c.getAttribute(attr)));
  });
}

function renderACities() {
  const box = $('#A-cities');
  if (!state.A.province) {
    box.innerHTML = `<span class="text-xs text-ink-3">先选省份</span>`;
    return;
  }
  const cities = [...new Set(state.unis
    .filter(u => u.province === state.A.province)
    .map(u => u.city).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'zh-Hans-CN'));
  box.innerHTML = `<span class="chip" data-ct="">全部</span>` +
    cities.map(c => {
      const n = state.unis.filter(u => u.province === state.A.province && u.city === c).length;
      return `<span class="chip" data-ct="${c}">${c}<span class="chip-count ml-1">${n}</span></span>`;
    }).join('');
  syncChips('#A-cities','data-ct','');
}

function filterUnisA() {
  const { province, city, levels, types, keyword } = state.A;
  let arr = state.unis;
  if (province) arr = arr.filter(u => u.province === province);
  if (city) arr = arr.filter(u => u.city === city);
  if (levels.size) arr = arr.filter(u => {
    // 包含匹配：选了"双一流"应包含 985/211（它们都被打了双一流 tag）
    for (const lv of levels) {
      if ((u.tags||[]).includes(lv) || u.level === lv) return true;
    }
    return false;
  });
  if (types.size) arr = arr.filter(u => types.has(u.type));
  if (keyword) {
    const k = keyword.toLowerCase();
    arr = arr.filter(u => u.name.toLowerCase().includes(k));
  }
  // 排序
  if (state.A.sort === 'level') {
    arr = [...arr].sort((a,b) => (LEVEL_RANK[a.level]??99) - (LEVEL_RANK[b.level]??99) || a.name.localeCompare(b.name,'zh-Hans-CN'));
  } else if (state.A.sort === 'name') {
    arr = [...arr].sort((a,b) => a.name.localeCompare(b.name,'zh-Hans-CN'));
  } else if (state.A.sort === 'province') {
    arr = [...arr].sort((a,b) => (a.province||'').localeCompare(b.province||'','zh-Hans-CN') || a.name.localeCompare(b.name,'zh-Hans-CN'));
  }
  return arr;
}

function uniCardA(u) {
  const advCodes = new Set(u.advantages || []);
  const cats = {};
  for (const code of (u.majors||[])) {
    const m = state.byCode[code]; if (!m) continue;
    const k = m.category_code + '|' + m.category_name;
    if (!cats[k]) cats[k] = [];
    cats[k].push(m);
  }
  const catKeys = Object.keys(cats).sort();
  const catSummary = catKeys.slice(0,8).map(k => {
    const [code, name] = k.split('|');
    return `<span class="text-xs text-ink-2">${name}<span class="num text-ink-3 ml-1">${cats[k].length}</span></span>`;
  }).join('<span class="text-line-2 mx-2">·</span>');

  const advList = (u.advantages||[]).slice(0,6).map(c => {
    const m = state.byCode[c]; return m ? `<span class="gold-mark text-xs">${m.name}</span>` : '';
  }).join('<span class="text-line-2 mx-1.5">·</span>');

  return `
  <details class="group border-b border-line py-6">
    <summary class="grid grid-cols-12 gap-4 items-start">
      <div class="col-span-7">
        <div class="flex items-center gap-2 flex-wrap mb-2">
          <h3 class="display-hero text-lg">${u.name}</h3>
          ${tagsHtml(u)}
        </div>
        <p class="text-xs text-ink-3">${u.province} · ${u.city || '—'} · ${u.bureau || '—'} · ${u.layer || '—'}</p>
        ${advList ? `<div class="mt-3 text-xs"><span class="text-ink-3 tracking-wide2 uppercase mr-2">优势专业</span>${advList}</div>` : ''}
        ${actionBtns(u)}
      </div>
      <div class="col-span-4 text-xs text-ink-3 leading-loose">
        <div class="tracking-wide2 uppercase mb-1.5">学科分布</div>
        <div class="text-ink-2">${catSummary}${catKeys.length>8?`<span class="text-line-2 mx-2">·</span><span class="num">+${catKeys.length-8}</span>`:''}</div>
      </div>
      <div class="col-span-1 text-right text-ink-3 group-open:rotate-180 transition">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="inline"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    </summary>
    <div class="mt-5 pt-5 border-t border-dashed border-line">
      <div class="text-xs text-ink-3 tracking-wide2 uppercase mb-3">该校开设专业 · 共 <span class="num text-ink">${(u.majors||[]).length}</span> 个</div>
      <div class="space-y-4">
        ${catKeys.map(k => {
          const [code, name] = k.split('|');
          const list = cats[k].sort((a,b)=>a.code.localeCompare(b.code));
          return `
            <div>
              <div class="text-xs font-medium text-ink mb-2">${name} <span class="num text-ink-3 ml-1">${code}</span></div>
              <div class="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                ${list.map(m => {
                  const adv = advCodes.has(m.code);
                  return `<span class="${adv?'gold-mark':'text-ink-2'}">${m.name}<span class="num text-ink-4 ml-1 text-[10px]">${m.code}</span></span>`;
                }).join('<span class="text-line-2">·</span>')}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
  </details>`;
}

function renderA() {
  const list = filterUnisA();
  const { slice, page, pages, total } = paginate(list, state.A.page);
  $('#A-count').textContent = `· ${total.toLocaleString()} 所`;
  $('#A-list').innerHTML = slice.length
    ? slice.map(uniCardA).join('')
    : `<div class="border border-dashed border-line p-12 text-center text-ink-3">没有符合条件的院校 · 试试放宽筛选</div>`;
  $('#A-pager').innerHTML = pagerHtml(page, pages);
  $$('#A-pager [data-p]').forEach(b => b.addEventListener('click', () => {
    state.A.page = +b.dataset.p;
    renderA();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}

// ===================== 模式 B =====================
function initModeB() {
  // 学科门类
  $('#B-cats').innerHTML = state.majors.map(c => {
    const n = c.subs.reduce((s, sub)=>s+sub.majors.length, 0);
    return `<span class="chip" data-cat="${c.code}">${c.name}<span class="chip-count ml-1">${n}</span></span>`;
  }).join('');
  $('#B-cats').addEventListener('click', e => {
    const c = e.target.closest('[data-cat]'); if (!c) return; popChip(c);
    state.B.cat = state.B.cat === c.dataset.cat ? '' : c.dataset.cat;
    state.B.sub = '';
    state.B.major = '';
    syncChips('#B-cats','data-cat', state.B.cat);
    renderBSubs();
    renderBMajors();
    renderBResult();
  });
  $('#B-subs').addEventListener('click', e => {
    const c = e.target.closest('[data-sub]'); if (!c) return; popChip(c);
    state.B.sub = state.B.sub === c.dataset.sub ? '' : c.dataset.sub;
    state.B.major = '';
    syncChips('#B-subs','data-sub', state.B.sub);
    renderBMajors();
    renderBResult();
  });
  $('#B-majors').addEventListener('click', e => {
    const c = e.target.closest('[data-mj]'); if (!c) return;
    state.B.major = c.dataset.mj;
    state.B.page = 1;
    renderBMajors();
    renderBResult();
  });
  $('#B-search').addEventListener('input', e => {
    state.B.keyword = e.target.value.trim();
    renderBMajors();
  });
  // 二次筛选事件由 renderBResult 动态绑定（因为它的 DOM 是 innerHTML 注入的）
  renderBMajors();
}

function renderBSubs() {
  if (!state.B.cat) {
    $('#B-subs').innerHTML = `<span class="text-xs text-ink-3">先选学科门类</span>`;
    return;
  }
  const cat = state.majors.find(c => c.code === state.B.cat);
  $('#B-subs').innerHTML = cat.subs.map(s =>
    `<span class="chip" data-sub="${s.code}">${s.name}<span class="chip-count ml-1">${s.majors.length}</span></span>`
  ).join('');
}

function renderBMajors() {
  let pool = state.flatMajors;
  if (state.B.cat) pool = pool.filter(m => m.category_code === state.B.cat);
  if (state.B.sub) pool = pool.filter(m => m.sub_code === state.B.sub);
  if (state.B.keyword) {
    const k = state.B.keyword.toLowerCase();
    pool = pool.filter(m => m.name.toLowerCase().includes(k) || m.code.toLowerCase().includes(k));
  }
  if (!pool.length) {
    $('#B-majors').innerHTML = `<div class="text-xs text-ink-3 p-2">无匹配专业</div>`;
    return;
  }
  $('#B-majors').innerHTML = pool.slice(0, 200).map(m => {
    const isSel = state.B.major === m.code;
    const opens = (state.index.opens[m.code] || []).length;
    return `<div data-mj="${m.code}" class="px-2 py-1.5 cursor-pointer text-sm flex items-center gap-2 ${isSel?'bg-ink text-paper':'hover:bg-paper-100'}">
      <div class="flex-1 min-w-0">
        <div class="truncate">${m.name}${m.is_special?'<span class="num ml-1 text-[10px] opacity-70">T</span>':''}${m.is_controlled?'<span class="num ml-1 text-[10px] opacity-70">K</span>':''}</div>
        <div class="text-[11px] ${isSel?'text-paper/70':'text-ink-3'} num">${m.code}</div>
      </div>
      <span class="text-[11px] num ${isSel?'text-paper/80':'text-ink-3'}">${opens}</span>
    </div>`;
  }).join('') + (pool.length>200?`<div class="text-xs text-ink-3 p-2 text-center">仅显示前 200 个 · 输入关键词进一步筛选</div>`:'');
}

function renderBResult() {
  if (!state.B.major) {
    $('#B-empty').classList.remove('hidden');
    $('#B-result').classList.add('hidden');
    return;
  }
  const m = state.byCode[state.B.major];
  $('#B-empty').classList.add('hidden');
  $('#B-result').classList.remove('hidden');
  const opens = (state.index.opens[m.code] || []).length;
  const advs  = (state.index.advantages[m.code] || []).length;
  const provinces = [...new Set(state.unis.map(u => u.province))].sort((a,b)=>a.localeCompare(b,'zh-Hans-CN'));
  $('#B-result').innerHTML = `
    <div class="border-b-2 border-ink pb-6 mb-6">
      <div class="text-xs text-ink-3 tracking-wide2 uppercase mb-2">${m.category_code} ${m.category_name} / ${m.sub_code} ${m.sub_name}</div>
      <h2 class="display-hero text-3xl mb-3">${m.name}${m.is_special?'<span class="pill pill-line ml-3 align-middle">T 特设</span>':''}${m.is_controlled?'<span class="pill pill-line ml-2 align-middle">K 国家控制</span>':''}</h2>
      <div class="flex items-center gap-6 text-sm flex-wrap">
        <span class="text-ink-3">专业代码 <span class="num text-ink">${m.code}</span></span>
        <span class="text-ink-3">·</span>
        <span class="text-ink-3"><span class="num-display text-ink text-base mr-1">${opens}</span>所院校开设</span>
        <span class="text-ink-3">·</span>
        <span class="text-ink-3"><span class="num-display text-gold text-base mr-1">${advs}</span>所标记为优势</span>
        ${m.note?`<span class="text-ink-3">·</span><span class="text-ink-2">${m.note}</span>`:''}
        <a href="${chsiMajorUrl(m.name)}" target="_blank" rel="noopener" class="ml-auto text-xs text-ink-2 hover:text-accent border-b border-dotted border-line-2 hover:border-accent">阳光高考 · 专业知识库 ↗</a>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6 pb-4 border-b border-line">
      <div class="text-xs text-ink-3 tracking-wide2 uppercase">二次筛选</div>
      <select id="B-filter-province" class="bg-transparent border-b border-line-2 py-1 pr-6 text-sm cursor-pointer">
        <option value="">全部省份</option>
        ${provinces.map(p => `<option value="${p}" ${state.B.province===p?'selected':''}>${p}</option>`).join('')}
      </select>
      <select id="B-filter-level" class="bg-transparent border-b border-line-2 py-1 pr-6 text-sm cursor-pointer">
        <option value="">全部等级</option>
        ${LEVEL_ORDER.map(l => `<option value="${l}" ${state.B.level===l?'selected':''}>${l}</option>`).join('')}
      </select>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" id="B-only-adv" class="accent-ink" ${state.B.onlyAdv?'checked':''}>
        <span class="text-ink-2">仅看优势专业</span>
      </label>
    </div>

    <div class="flex items-end justify-between mb-4">
      <h3 class="display-hero text-lg">开设院校 <span id="B-count" class="text-ink-3 text-sm font-normal num"></span></h3>
    </div>
    <div id="B-list" class="space-y-0"></div>
    <div id="B-pager" class="mt-10 flex items-center justify-center gap-2"></div>
  `;
  // 绑定二次筛选事件
  $('#B-filter-province').addEventListener('change', e => { state.B.province = e.target.value; state.B.page=1; renderBList(); });
  $('#B-filter-level').addEventListener('change', e => { state.B.level = e.target.value; state.B.page=1; renderBList(); });
  $('#B-only-adv').addEventListener('change', e => { state.B.onlyAdv = e.target.checked; state.B.page=1; renderBList(); });
  renderBList();
}

function renderBList() {
  if (!state.B.major) return;
  const opens = state.index.opens[state.B.major] || [];
  const adv = new Set(state.index.advantages[state.B.major] || []);
  let unis = opens.map(id => state.byUid[id]).filter(Boolean);
  if (state.B.onlyAdv) unis = unis.filter(u => adv.has(u.id));
  if (state.B.province) unis = unis.filter(u => u.province === state.B.province);
  if (state.B.level) unis = unis.filter(u =>
    (u.tags||[]).includes(state.B.level) || u.level === state.B.level
  );
  unis = unis.sort((a,b) => {
    const aAdv = adv.has(a.id) ? 0 : 1, bAdv = adv.has(b.id) ? 0 : 1;
    if (aAdv !== bAdv) return aAdv - bAdv;
    return (LEVEL_RANK[a.level]??99) - (LEVEL_RANK[b.level]??99) || a.name.localeCompare(b.name,'zh-Hans-CN');
  });
  const { slice, page, pages, total } = paginate(unis, state.B.page);
  $('#B-count').textContent = `· ${total.toLocaleString()} 所`;
  $('#B-list').innerHTML = slice.length
    ? slice.map(u => uniCardB(u, adv.has(u.id))).join('')
    : `<div class="border border-dashed border-line p-10 text-center text-ink-3">没有符合二次筛选条件的院校</div>`;
  $('#B-pager').innerHTML = pagerHtml(page, pages);
  $$('#B-pager [data-p]').forEach(b => b.addEventListener('click', () => {
    state.B.page = +b.dataset.p;
    renderBList();
  }));
}

function uniCardB(u, isAdv) {
  return `
  <div class="border-b border-line py-5 ${isAdv?'pl-4 -ml-4 border-l-2 border-l-gold':''}">
    <div class="grid grid-cols-12 gap-4 items-start">
      <div class="col-span-7">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          ${isAdv?'<span class="pill pill-gold">优势专业</span>':''}
          <h3 class="display-hero text-lg">${u.name}</h3>
          ${tagsHtml(u)}
        </div>
        <p class="text-xs text-ink-3">${u.province} · ${u.city || '—'} · ${u.bureau || '—'} · 共开设 <span class="num text-ink-2">${(u.majors||[]).length}</span> 个本科专业</p>
      </div>
      <div class="col-span-5 flex items-center gap-3 justify-end text-xs">
        <a href="${chsiSchoolUrl(u.name)}" target="_blank" rel="noopener" class="text-ink-2 hover:text-accent border-b border-dotted border-line-2 hover:border-accent">阳光高考 · 院校 ↗</a>
        <button data-cmp="${u.id}" type="button"
           onclick="event.stopPropagation(); event.preventDefault(); toggleCompare('${u.id}')"
           class="${state.compare.has(u.id)?'text-accent border-b border-accent':'text-ink-2 hover:text-ink border-b border-dotted border-line-2 hover:border-ink'}">
          ${state.compare.has(u.id) ? '已加入对比 ×' : '＋ 加入对比'}
        </button>
      </div>
    </div>
  </div>`;
}

// ===================== 模式 D：大学专业顾问 =====================
const ADVISOR_SYSTEM_PROMPT = `你是一名中国高考志愿填报、大学专业分析与升学决策专家，服务对象主要是高三学生及其家长。

你的角色不是"替用户拍板"，而是通过结构化提问、官方信息核实、课程与培养分析、风险校验、评分排序和志愿设计，帮助用户完成更清晰、更稳妥、更适合自己的专业与学校选择。

你的核心任务包括三类：

1. 专业深度分析
当用户提供"大学名称 + 专业名称"时，你要输出一份适合报考决策的专业分析报告，帮助用户判断：这个专业学什么、难不难、适合谁、值不值得报、同类院校有哪些、如何提前准备。

2. 专业真伪与前景判断
当用户询问某个"新专业、交叉专业、改名专业、热门专业、复合专业"时，你要判断它更像"真交叉"还是"新瓶装旧酒"，并指出课程、师资、对标、企业合作、就业前景中的真实支撑与风险。

3. 志愿决策与96志愿设计
当用户提供省份、选科、分数/位次、预算、偏好和约束时，你要建立用户画像，筛选专业池、学校池、城市池，对"城市+大学+专业"组合进行评分，并生成搏/冲/稳/保/垫方案，必要时输出可直接用于填报的96个志愿建议。

每次对话开场时，先提示用户：
"把学校名称、专业名称、所在省份、选科、分数/位次发我，判断会最准；如果有培养方案、核心课程、师资名单或合作项目链接，我还能进一步判断这个专业是真交叉还是新瓶装旧酒，并给你更具体的报考或志愿建议。"`;

const state_D = {
  apiKey: '',
  apiBase: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  messages: [],  // { role, content }
  loading: false,
};

function initModeD() {
  const saveBtn = $('#D-save-config');
  const clearBtn = $('#D-clear-chat');
  const sendBtn = $('#D-send-btn');
  const input = $('#D-user-input');
  if (!saveBtn) return;

  // 载入本地存储的配置
  const saved = localStorage.getItem('advisor_config');
  if (saved) {
    try {
      const c = JSON.parse(saved);
      state_D.apiKey = c.apiKey || '';
      state_D.apiBase = c.apiBase || 'https://api.openai.com/v1';
      state_D.model = c.model || 'gpt-4o';
      $('#D-api-key').value = state_D.apiKey ? '••••••••' : '';
      $('#D-api-base').value = state_D.apiBase;
      $('#D-model').value = state_D.model;
    } catch(e) {}
  }

  saveBtn.onclick = () => {
    const keyInput = $('#D-api-key').value.trim();
    // 如果用户输入的是掩码，保留旧值
    if (keyInput && keyInput !== '••••••••') state_D.apiKey = keyInput;
    state_D.apiBase = $('#D-api-base').value.trim() || 'https://api.openai.com/v1';
    state_D.model = $('#D-model').value.trim() || 'gpt-4o';
    localStorage.setItem('advisor_config', JSON.stringify({
      apiKey: state_D.apiKey,
      apiBase: state_D.apiBase,
      model: state_D.model,
    }));
    $('#D-api-key').value = state_D.apiKey ? '••••••••' : '';
    showDStatus('配置已保存', 'ok');
    // 首次保存后发送开场白
    if (!state_D.messages.length) sendAdvisorOpening();
  };

  clearBtn.onclick = () => {
    state_D.messages = [];
    $('#D-chat-messages').innerHTML = '';
    if (state_D.apiKey) sendAdvisorOpening();
  };

  sendBtn.onclick = sendUserMessage;
  input.onkeydown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendUserMessage(); }
  };

  // 如果已有 key，直接发开场白
  if (state_D.apiKey) sendAdvisorOpening();
}

function showDStatus(msg, type) {
  const el = $('#D-status');
  if (!el) return;
  el.textContent = msg;
  el.className = `text-xs mt-2 ${type === 'ok' ? 'text-safe' : type === 'err' ? 'text-accent' : 'text-ink-3'}`;
  setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3000);
}

async function sendAdvisorOpening() {
  if (!state_D.apiKey) return;
  state_D.messages = [];
  appendDMessage('assistant', '正在连接...', true);
  try {
    const reply = await callAdvisorAPI([]);
    removeLoadingBubble();
    appendDMessage('assistant', reply);
    state_D.messages.push({ role: 'assistant', content: reply });
  } catch(e) {
    removeLoadingBubble();
    appendDMessage('assistant', `⚠ 连接失败：${e.message}。请检查 API Key 和 Base URL 配置。`);
  }
}

async function sendUserMessage() {
  if (state_D.loading) return;
  const input = $('#D-user-input');
  const text = input.value.trim();
  if (!text) return;
  if (!state_D.apiKey) {
    showDStatus('请先填写 API Key 并保存配置', 'err');
    return;
  }
  input.value = '';
  input.style.height = 'auto';
  state_D.messages.push({ role: 'user', content: text });
  appendDMessage('user', text);

  state_D.loading = true;
  $('#D-send-btn').disabled = true;
  appendDMessage('assistant', '...', true);

  try {
    const reply = await callAdvisorAPI(state_D.messages.slice(0, -1).concat([{ role: 'user', content: text }]));
    removeLoadingBubble();
    appendDMessage('assistant', reply);
    state_D.messages.push({ role: 'assistant', content: reply });
  } catch(e) {
    removeLoadingBubble();
    appendDMessage('assistant', `⚠ 请求失败：${e.message}`);
    state_D.messages.pop();
  } finally {
    state_D.loading = false;
    $('#D-send-btn').disabled = false;
  }
}

async function callAdvisorAPI(messages) {
  const base = state_D.apiBase.replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state_D.apiKey}`,
    },
    body: JSON.stringify({
      model: state_D.model,
      messages: [
        { role: 'system', content: ADVISOR_SYSTEM_PROMPT },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '（无回复）';
}

function appendDMessage(role, content, isLoading = false) {
  const box = $('#D-chat-messages');
  if (!box) return;
  const id = isLoading ? 'D-loading-bubble' : '';
  const isUser = role === 'user';
  const div = document.createElement('div');
  div.className = `flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`;
  if (id) div.id = id;
  // 简单 markdown：换行、粗体、代码
  const html = isLoading
    ? `<span class="inline-flex gap-1">${[0,1,2].map(i=>`<span class="w-1.5 h-1.5 bg-ink-3 rounded-full animate-bounce" style="animation-delay:${i*0.15}s"></span>`).join('')}</span>`
    : content
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
        .replace(/`([^`]+)`/g,'<code class="bg-paper-100 px-1 rounded text-xs font-mono">$1</code>')
        .replace(/\n/g,'<br>');
  div.innerHTML = `
    <div class="max-w-[80%] px-4 py-3 text-sm leading-relaxed ${isUser
      ? 'bg-ink text-paper'
      : 'bg-white border border-line text-ink-2'}">${html}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function removeLoadingBubble() {
  document.getElementById('D-loading-bubble')?.remove();
}

// 启动
loadAll().catch(err => {
  console.error(err);
  $('#loading').innerHTML = `<div class="text-rose-600">加载失败：${err.message}<br><span class="text-xs text-ink-3">请通过本地服务器访问，不要直接 file:// 打开（fetch 会被浏览器拦截）。在项目目录运行 <code class="bg-paper-100 px-1.5 py-0.5 rounded">python3 -m http.server 8000</code> 后访问 http://localhost:8000/</span></div>`;
});
