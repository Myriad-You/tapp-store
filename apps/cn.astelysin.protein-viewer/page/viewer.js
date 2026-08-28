// Main page logic: THREE scene, orbit camera, render loop, UI wiring, and the
// online RCSB fetch flow. Runs in the page sandbox (host injects THREE).
'use strict';

var parser = require('./parser.js');
var structureLoader = require('./structure-loader.js');
var bondsMod = require('./bonds.js');
var build = require('./build.js');
var colors = require('./colors.js');
var THREE = globalThis.THREE;

var I18N_FALLBACK = {
  'zh-CN': {
    appName: '蛋白质结构查看器', tagline: '在线浏览 PDB 分子结构', pdbIdLabel: 'PDB ID', searchLabel: '按名称搜索',
    searchPlaceholder: '按名称搜索结构', searchBtn: '搜索', pdbIdPlaceholder: '输入 PDB ID，如 1A3N', loadBtn: '加载结构', connected: '已连接',
    recent: '最近', history: '历史记录', historyExpand: '展开历史记录', historyCollapse: '收起历史记录', clearHistory: '清空', historyEmpty: '加载过的结构会显示在这里', emptyHint: '输入 PDB ID，或从名称搜索开始',
    chains: '条链', residues: '个残基', residuePosition: '残基位置', tools: '工具', structure: '结构', measure: '测量', structureSearch: '结构内搜索',
    components: '组成成分', export: '导出', chain: '链', allChains: '全部', representation: '表示方式', colorBy: '颜色方式', camera: '视角',
    viewControls: '视图控制', controls: '控制', collapse: '收起', expand: '展开', fitView: '适应画布', zoomIn: '放大', zoomOut: '缩小',
    measureHint: '点击两个原子测量距离', clearMeasure: '清除测量', atomSearchPlaceholder: '链、残基或原子', exportImage: '导出 SVG 截图', downloadCif: '下载 mmCIF', copyPdbId: '复制 PDB ID',
    modeWireframe: '线框', colorElement: '按元素着色', colorChain: '按链着色',
    autorotate: '自动旋转', resetView: '重置视角', fullscreen: '全屏',
    loadFailed: '加载失败', searchFailed: '搜索失败',
    noResults: '未找到匹配结构', selectHint: '选择要查看的结构', atomCount: '原子', caOnly: 'α碳骨架',
    truncated: '数据可能被截断', onlineTitle: '在线结构', apiMissing: '宿主未注入 THREE，请检查 runtimeModules 声明', simplifiedFallback: '完整结构不可用，正在加载 α 碳骨架', structureUnavailable: '结构为空或不可用',
    startLoading: '正在加载…'
  },
  'en-US': {
    appName: 'Protein Structure Viewer', tagline: 'Browse PDB structures', pdbIdLabel: 'PDB ID', searchLabel: 'Search by name',
    searchPlaceholder: 'Search structures by name', searchBtn: 'Search', pdbIdPlaceholder: 'Enter a PDB ID, e.g. 1A3N', loadBtn: 'Load structure', connected: 'Connected',
    recent: 'Recent', history: 'History', historyExpand: 'Expand history', historyCollapse: 'Collapse history', clearHistory: 'Clear', historyEmpty: 'Loaded structures appear here', emptyHint: 'Enter a PDB ID or search by name',
    chains: 'chains', residues: 'residues', residuePosition: 'Residue position', tools: 'Tools', structure: 'Structure', measure: 'Measure', structureSearch: 'Search structure',
    components: 'Components', export: 'Export', chain: 'Chain', allChains: 'All', representation: 'Representation', colorBy: 'Color by', camera: 'Camera',
    viewControls: 'View controls', controls: 'Controls', collapse: 'Collapse', expand: 'Expand', fitView: 'Fit view', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
    measureHint: 'Click two atoms to measure distance', clearMeasure: 'Clear measurement', atomSearchPlaceholder: 'Chain, residue or atom', exportImage: 'Export SVG screenshot', downloadCif: 'Download mmCIF', copyPdbId: 'Copy PDB ID',
    modeWireframe: 'Wireframe', colorElement: 'By element', colorChain: 'By chain',
    autorotate: 'Rotate', resetView: 'Reset view', fullscreen: 'Fullscreen',
    loadFailed: 'Load failed', searchFailed: 'Search failed',
    noResults: 'No matching structures', selectHint: 'Pick a structure', atomCount: 'atoms', caOnly: 'α-carbon backbone',
    truncated: 'Response may be truncated', onlineTitle: 'Online structure', apiMissing: 'THREE not injected; check runtimeModules', simplifiedFallback: 'Full structure unavailable; loading α-carbon backbone', structureUnavailable: 'Structure is empty or unavailable',
    startLoading: 'Loading…'
  },
  'ja-JP': {
    appName: 'タンパク質構造ビューア', tagline: 'PDB 構造を閲覧', pdbIdLabel: 'PDB ID', searchLabel: '名前で検索',
    searchPlaceholder: '構造名で検索', searchBtn: '検索', pdbIdPlaceholder: 'PDB IDを入力（例: 1A3N）', loadBtn: '構造を読み込む', connected: '接続済み',
    recent: '最近', history: '履歴', historyExpand: '履歴を開く', historyCollapse: '履歴を閉じる', clearHistory: 'クリア', historyEmpty: '読み込んだ構造がここに表示されます', emptyHint: 'PDB IDを入力するか名前で検索してください',
    chains: '鎖', residues: '残基', residuePosition: '残基位置', tools: 'ツール', structure: '構造', measure: '測定', structureSearch: '構造内検索',
    components: '構成要素', export: 'エクスポート', chain: '鎖', allChains: 'すべて', representation: '表示形式', colorBy: '色分け', camera: '視点',
    viewControls: 'ビュー操作', controls: '操作', collapse: '閉じる', expand: '開く', fitView: '画面に合わせる', zoomIn: '拡大', zoomOut: '縮小',
    measureHint: '2つの原子をクリックして距離を測定', clearMeasure: '測定をクリア', atomSearchPlaceholder: '鎖、残基、原子', exportImage: 'SVG画像を書き出す', downloadCif: 'mmCIFをダウンロード', copyPdbId: 'PDB IDをコピー',
    modeWireframe: 'ワイヤー', colorElement: '元素別', colorChain: '鎖別',
    autorotate: '自動回転', resetView: '視点リセット', fullscreen: '全画面',
    loadFailed: '読み込み失敗', searchFailed: '検索失敗',
    noResults: '一致する構造がありません', selectHint: '表示する構造を選択', atomCount: '原子', caOnly: 'α炭素骨格',
    truncated: 'データが途切れている可能性があります', onlineTitle: 'オンライン構造', apiMissing: 'THREE がありません（runtimeModules を確認）', simplifiedFallback: '完全な構造を取得できないため、α炭素骨格を読み込みます', structureUnavailable: '構造が空または利用できません',
    startLoading: '読み込み中…'
  }
};

var AA_ONE = {
  ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLN: 'Q', GLU: 'E', GLY: 'G',
  HIS: 'H', ILE: 'I', LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P', SER: 'S',
  THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V', SEC: 'U', PYL: 'O'
};

var locale = 'zh-CN';
function normalizeLocale(value) {
  var v = String(value || '').toLowerCase();
  if (v.indexOf('ja') === 0) return 'ja-JP';
  if (v.indexOf('en') === 0) return 'en-US';
  return 'zh-CN';
}
function i18n(key) {
  try {
    if (typeof Tapp !== 'undefined' && Tapp.i18n && typeof Tapp.i18n.t === 'function') {
      var translated = Tapp.i18n.t(key);
      if (translated && translated !== key) return String(translated);
    }
  } catch (_) {}
  var table = I18N_FALLBACK[locale] || I18N_FALLBACK['zh-CN'];
  return table[key] || I18N_FALLBACK['zh-CN'][key] || key;
}

function $id(id) { return document.getElementById(id); }

var state = {
  renderer: null, scene: null, camera: null, raf: 0, paused: false, destroyed: false,
  target: null, theta: 0.6, phi: 1.1, radius: 6,
  autoRotate: false, model: null, pickMesh: null, structure: null, rawCif: '',
  colorMode: 'element', chainOrder: [], visibleChains: {}, renderAtoms: [],
  measureAtoms: [], selectionMarker: null, pointerId: null, lastX: 0, lastY: 0, downX: 0, downY: 0, dragMode: null,
  resizeObserver: null, busy: false, renderReady: false, bootstrapped: false, bootstrapWaits: 0,
  historyKey: 'protein-viewer.history.v1', historyMemory: [], historyCollapsed: true,
  historyCollapsedKey: 'protein-viewer.history-collapsed.v1'
};

function setStatus(text) { var el = $id('view-status'); if (el) el.textContent = text; }
function showSpinner(on) { var el = $id('view-spinner'); if (el) el.hidden = !on; }

function withTimeout(promise, milliseconds) {
  var timer;
  var timeout = new Promise(function (_, reject) {
    timer = setTimeout(function () { reject(new Error('API_TIMEOUT')); }, milliseconds);
  });
  return Promise.race([promise, timeout]).finally(function () { clearTimeout(timer); });
}

function loadErrorDetail(error) {
  var code = error && error.message;
  if (code === 'API_TIMEOUT') return i18n('requestTimeout') === 'requestTimeout' ? '请求超时' : i18n('requestTimeout');
  if (code === 'API_NOT_TEXT') return i18n('responseFormatError') === 'responseFormatError' ? '响应格式不支持' : i18n('responseFormatError');
  if (code === 'MMCIF_NO_ATOMS') return i18n('structureUnavailable') === 'structureUnavailable' ? '结构为空或不可用' : i18n('structureUnavailable');
  return code && code !== 'api missing' ? String(code).slice(0, 120) : '';
}

function readHistory() {
  try {
    var value = JSON.parse(localStorage.getItem(state.historyKey) || '[]');
    return Array.isArray(value) ? value.filter(function (item) { return item && item.id; }).slice(0, 12) : [];
  } catch (_) { return state.historyMemory.slice(0, 12); }
}

function writeHistory(items) {
  state.historyMemory = items.slice(0, 12);
  try { localStorage.setItem(state.historyKey, JSON.stringify(state.historyMemory)); } catch (_) {}
}

function readHistoryCollapsed() {
  try { return localStorage.getItem(state.historyCollapsedKey) !== 'expanded'; } catch (_) { return true; }
}

function updateHistoryToggle() {
  var toggle = $id('view-toggle-history');
  if (!toggle) return;
  var key = state.historyCollapsed ? 'historyExpand' : 'historyCollapse';
  var label = i18n(key);
  toggle.setAttribute('aria-expanded', String(!state.historyCollapsed));
  toggle.setAttribute('aria-label', label);
  toggle.setAttribute('title', label);
  toggle.textContent = state.historyCollapsed ? '›' : '‹';
}

function setHistoryCollapsed(collapsed, persist) {
  state.historyCollapsed = !!collapsed;
  var workspace = document.querySelector('.workspace');
  var content = $id('view-history-content');
  if (workspace) workspace.classList.toggle('history-collapsed', state.historyCollapsed);
  if (content) content.hidden = state.historyCollapsed;
  updateHistoryToggle();
  if (persist) {
    try { localStorage.setItem(state.historyCollapsedKey, state.historyCollapsed ? 'collapsed' : 'expanded'); } catch (_) {}
  }
}

function renderHistory() {
  var list = $id('view-history-list');
  var empty = $id('view-history-empty');
  if (!list || !empty) return;
  var items = readHistory();
  list.replaceChildren();
  empty.hidden = items.length > 0;
  items.forEach(function (item) {
    var row = document.createElement('div');
    row.className = 'history-item' + (state.structure && state.structure.id === item.id ? ' active' : '');
    row.dataset.pdbId = item.id;
    var button = document.createElement('button');
    button.type = 'button'; button.className = 'history-open';
    button.innerHTML = '<strong></strong><span></span><time></time>';
    button.querySelector('strong').textContent = item.id;
    button.querySelector('span').textContent = item.title || i18n('onlineTitle');
    button.querySelector('time').textContent = item.loadedAt ? new Date(item.loadedAt).toLocaleString(locale) : '';
    button.addEventListener('click', function () { loadPdbId(item.id); });
    var remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'history-delete'; remove.setAttribute('aria-label', i18n('removeHistory') || '删除'); remove.textContent = '×';
    remove.addEventListener('click', function () {
      var next = readHistory().filter(function (entry) { return entry.id !== item.id; });
      writeHistory(next); renderHistory();
    });
    row.appendChild(button); row.appendChild(remove); list.appendChild(row);
  });
}

function addHistory(structure) {
  if (!structure || !structure.id) return;
  var items = readHistory().filter(function (item) { return item.id !== structure.id; });
  items.unshift({ id: structure.id, title: structure.title || '', atomCount: structure.atoms.length, loadedAt: new Date().toISOString() });
  writeHistory(items); renderHistory();
}

var toastTimer = null;
function toast(message, kind) {
  var el = $id('view-toast');
  if (!el) return;
  el.textContent = message;
  el.className = 'toast show ' + (kind || 'info');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.className = 'toast'; }, 3600);
  if (typeof Tapp !== 'undefined' && Tapp.ui && typeof Tapp.ui.showNotification === 'function') {
    Tapp.ui.showNotification({ title: i18n('appName'), message: message, type: kind || 'info', duration: 3200 }).catch(function () {});
  }
}

function applyLocale() {
  try {
    if (typeof Tapp !== 'undefined' && Tapp.i18n && typeof Tapp.i18n.getLocale === 'function') locale = normalizeLocale(Tapp.i18n.getLocale());
    else if (typeof Tapp !== 'undefined' && Tapp.ui && typeof Tapp.ui.getLocale === 'function') locale = normalizeLocale(Tapp.ui.getLocale());
  } catch (_) {}
  document.documentElement.lang = locale;
  document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = i18n(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.setAttribute('placeholder', i18n(el.dataset.i18nPlaceholder)); });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) { el.setAttribute('aria-label', i18n(el.dataset.i18nAriaLabel)); });
  updateHistoryToggle();
}

function applyTheme(theme) {
  var dark = theme === 'dark' || theme === 'Dark' || (theme && theme.dark === true);
  if (theme === null || theme === undefined) {
    try { if (window.matchMedia) dark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (_) {}
  }
  document.documentElement.classList.toggle('dark', !!dark);
}

function formatNumber(value) { return Number(value || 0).toLocaleString(locale); }

function getStructureStats(atoms) {
  var chains = [], chainSeen = {}, residues = {}, components = {};
  for (var i = 0; i < atoms.length; i++) {
    var atom = atoms[i];
    if (!chainSeen[atom.chain]) { chainSeen[atom.chain] = true; chains.push(atom.chain); }
    residues[atom.chain + ':' + atom.resi + ':' + atom.resn] = true;
    components[atom.resn] = (components[atom.resn] || 0) + 1;
  }
  return { chains: chains, residueCount: Object.keys(residues).length, components: components };
}

function renderStructureInfo() {
  var structure = state.structure;
  var empty = $id('view-empty-state');
  if (empty) empty.hidden = !!structure;
  if (!structure) return;
  var stats = getStructureStats(structure.atoms);
  var id = $id('view-structure-id');
  var title = $id('view-structure-title');
  var chainCount = $id('view-chain-count');
  var residueCount = $id('view-residue-count');
  var atomCount = $id('view-atom-count');
  if (id) id.textContent = structure.id || '—';
  if (title) title.textContent = structure.title || i18n('onlineTitle');
  if (chainCount) chainCount.textContent = stats.chains.length;
  if (residueCount) residueCount.textContent = formatNumber(stats.residueCount);
  if (atomCount) atomCount.textContent = formatNumber(structure.atoms.length);
  renderSequenceRuler(structure.atoms);
  renderChainControls(stats.chains);
  renderComponents(stats.components);
  renderHistory();
}

function renderSequenceRuler(atoms) {
  var ruler = $id('view-sequence-ruler');
  if (!ruler) return;
  ruler.replaceChildren();
  var residues = [];
  var seen = {};
  for (var i = 0; i < atoms.length; i++) {
    var atom = atoms[i];
    if (atom.kind === 'ligand' || atom.atom !== 'CA') continue;
    var key = String(atom.chain) + ':' + String(atom.resi) + ':' + String(atom.resn);
    if (seen[key]) continue;
    seen[key] = true;
    residues.push(atom);
  }
  residues.sort(function (a, b) {
    if (String(a.chain) !== String(b.chain)) return String(a.chain).localeCompare(String(b.chain));
    return (a.resi || 0) - (b.resi || 0);
  });
  if (!residues.length) {
    var empty = document.createElement('span'); empty.className = 'sequence-empty'; empty.textContent = '—'; ruler.appendChild(empty); return;
  }
  residues.forEach(function (atom, index) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'sequence-residue';
    if (index === 0 || residues[index - 1].chain !== atom.chain) button.classList.add('chain-start');
    button.title = String(atom.chain) + ' · ' + String(atom.resn) + ' ' + String(atom.resi);
    button.setAttribute('aria-label', button.title);
    var number = document.createElement('span');
    number.className = 'sequence-index';
    number.textContent = index === 0 || residues[index - 1].chain !== atom.chain || atom.resi % 10 === 0 ? String(atom.resi) : '';
    var letter = document.createElement('span');
    letter.className = 'sequence-letter';
    letter.textContent = AA_ONE[String(atom.resn || '').toUpperCase()] || '·';
    button.appendChild(number);
    button.appendChild(letter);
    button.addEventListener('click', function () { focusResidue(atom); });
    ruler.appendChild(button);
  });
}

function focusResidue(residue) {
  if (!residue || !state.structure) return;
  if (state.visibleChains[residue.chain] === false) {
    state.visibleChains[residue.chain] = true;
    renderChainControls(state.chainOrder);
    buildModel();
  }
  state.target.set(residue.x, residue.y, residue.z);
  state.radius = Math.max(state.radius * 0.68, 3);
  updateCamera();
  showAtom(residue);
}

function renderChainControls(chains) {
  var select = $id('view-chain-select');
  var list = $id('view-chain-list');
  if (!select || !list) return;
  select.replaceChildren();
  var all = document.createElement('option'); all.value = 'all'; all.textContent = i18n('allChains'); select.appendChild(all);
  chains.forEach(function (chain) { var option = document.createElement('option'); option.value = chain; option.textContent = chain; select.appendChild(option); });
  list.replaceChildren();
  chains.forEach(function (chain) {
    var label = document.createElement('label'); label.className = 'chain-option';
    var input = document.createElement('input'); input.type = 'checkbox'; input.value = chain; input.checked = state.visibleChains[chain] !== false;
    var text = document.createElement('span'); text.textContent = chain;
    input.addEventListener('change', function () { state.visibleChains[chain] = input.checked; syncChainSelect(); buildModel(); });
    label.appendChild(input); label.appendChild(text); list.appendChild(label);
  });
}

function syncChainSelect() {
  var select = $id('view-chain-select');
  if (!select) return;
  var visible = state.chainOrder.filter(function (chain) { return state.visibleChains[chain] !== false; });
  select.value = visible.length === state.chainOrder.length ? 'all' : (visible.length === 1 ? visible[0] : 'all');
}

function renderComponents(components) {
  var container = $id('view-component-list');
  if (!container) return;
  container.replaceChildren();
  Object.keys(components).sort().slice(0, 24).forEach(function (name) {
    var chip = document.createElement('span'); chip.className = 'component-chip'; chip.textContent = name + ' · ' + components[name]; container.appendChild(chip);
  });
}

function updateSelectionCard(atom) {
  var card = $id('view-selection-card');
  if (!card) return;
  if (!atom) { card.hidden = true; card.replaceChildren(); return; }
  card.hidden = false;
  card.replaceChildren();
  var strong = document.createElement('strong'); strong.textContent = atom.atom + ' · ' + atom.resn + ' ' + atom.resi;
  var details = document.createElement('span'); details.textContent = i18n('chain') + ' ' + atom.chain + ' · ' + atom.el + ' · ' + atom.x.toFixed(2) + ', ' + atom.y.toFixed(2) + ', ' + atom.z.toFixed(2) + ' Å';
  card.appendChild(strong); card.appendChild(details);
}

function chainColorFor(structure, atom, index) {
  if (state.colorMode === 'chain') {
    var chainIndex = state.chainOrder.indexOf(atom.chain);
    return colors.chainColors(Math.max(state.chainOrder.length, 1))[Math.max(chainIndex, 0)];
  }
  return colors.colorForElement(atom.el);
}

function makePickMesh(atoms) {
  if (!THREE.InstancedMesh || !THREE.SphereGeometry || !THREE.MeshBasicMaterial || !THREE.Matrix4 || !atoms.length) return null;
  var mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.58, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, colorWrite: false, depthWrite: false }),
    atoms.length
  );
  var matrix = new THREE.Matrix4();
  for (var i = 0; i < atoms.length; i++) {
    matrix.makeTranslation(atoms[i].x, atoms[i].y, atoms[i].z);
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.userData.pickTarget = true;
  return mesh;
}

function buildModel() {
  var structure = state.structure;
  if (!structure || !state.scene) return;
  if (state.pickMesh) {
    build.disposeObject(state.pickMesh);
    state.scene.remove(state.pickMesh);
    state.pickMesh = null;
  }
  if (state.model) {
    build.disposeObject(state.model);
    state.scene.remove(state.model);
    state.model = null;
  }
  if (!structure.atoms.length) return;
  state.renderAtoms = structure.atoms.filter(function (atom) { return state.visibleChains[atom.chain] !== false; });
  if (!state.renderAtoms.length) return;
  state.chainOrder = [];
  var seen = {};
  for (var i = 0; i < structure.atoms.length; i++) {
    if (!seen[structure.atoms[i].chain]) { seen[structure.atoms[i].chain] = true; state.chainOrder.push(structure.atoms[i].chain); }
  }
  var atoms = state.renderAtoms;
  var colorFor = function (atom, index) { return chainColorFor(structure, atom, index); };
  var bonds = bondsMod.buildBonds(atoms);
  var model = build.makeWireframe(atoms, bonds, colorFor);
  state.model = model;
  state.scene.add(model);
  state.pickMesh = makePickMesh(atoms);
  if (state.pickMesh) state.scene.add(state.pickMesh);
  frameCamera();
}

function frameCamera() {
  if (!state.camera || !state.structure || !state.renderAtoms.length) return;
  var bounds = build.computeBounds(state.renderAtoms);
  state.target.copy(bounds.center);
  var r = bounds.radius;
  state.radius = Math.max(r * 2.6, 3.0);
  state.theta = 0.6; state.phi = 1.1;
  state.camera.near = Math.max(r * 0.001, 0.01);
  state.camera.far = Math.max(r * 20, 100);
  state.camera.updateProjectionMatrix();
}

function updateCamera() {
  if (!state.camera || !state.target) return;
  var sp = Math.sin(state.phi);
  state.camera.position.set(
    state.target.x + state.radius * sp * Math.sin(state.theta),
    state.target.y + state.radius * Math.cos(state.phi),
    state.target.z + state.radius * sp * Math.cos(state.theta)
  );
  state.camera.lookAt(state.target);
}

function renderFrame() {
  if (state.paused || state.destroyed || !state.renderer || !state.scene || !state.camera) return;
  if (state.autoRotate) { state.theta += 0.0025; updateCamera(); }
  state.renderer.render(state.scene, state.camera);
  state.raf = requestAnimationFrame(renderFrame);
}

function setStructure(structure, meta) {
  state.structure = structure;
  clearMeasure();
  updateSelectionCard(null);
  if (state.selectionMarker && state.scene) {
    state.scene.remove(state.selectionMarker);
    if (state.selectionMarker.geometry) state.selectionMarker.geometry.dispose();
    if (state.selectionMarker.material) state.selectionMarker.material.dispose();
    state.selectionMarker = null;
  }
  state.visibleChains = {};
  var stats = getStructureStats(structure.atoms);
  stats.chains.forEach(function (chain) { state.visibleChains[chain] = true; });
  buildModel();
  renderStructureInfo();
  var kind = structure.simplified ? ' · ' + i18n('caOnly') : '';
  var renderNote = state.renderReady ? '' : ' · ' + (i18n('rendererUnavailable') === 'rendererUnavailable' ? '3D 渲染器不可用' : i18n('rendererUnavailable'));
  setStatus(((meta && meta.source) || i18n('onlineTitle')) + ' · ' + (structure.id || '') + (structure.title ? ' — ' + structure.title : '') +
    ' · ' + formatNumber(structure.atoms.length) + ' ' + i18n('atomCount') + kind + renderNote);
  if (structure.truncated) toast(i18n('truncated'), 'warning');
}

function loadStructure(parsed, sourceLabel, rawCif) {
  var atoms = parsed.atoms;
  var simplified = parsed.simplified === true;
  if (!simplified && atoms.length > 8000) {
    atoms = parser.extractCA(atoms);
    simplified = true;
  }
  state.rawCif = rawCif || '';
  setStructure({ id: parsed.id || '', title: parsed.title || '', atoms: atoms, simplified: simplified, truncated: parsed.truncated === true }, { source: sourceLabel || '' });
  addHistory(state.structure);
}

async function loadPdbId(input) {
  var id = parser.normalizePdbId(input);
  if (!id) return toast(i18n('searchPlaceholder'), 'warning');
  if (state.busy) return;
  var loadButton = document.querySelector('#view-load-form button[type="submit"]');
  state.busy = true; showSpinner(true); setStatus(i18n('startLoading') + ' · ' + id);
  if (loadButton) { loadButton.disabled = true; loadButton.setAttribute('aria-busy', 'true'); }
  try {
    if (typeof Tapp === 'undefined' || !Tapp.api) throw new Error('api missing');
    var loaded = await structureLoader.load(id, {
      apis: {
        structure: function (params) { return Tapp.api('structure', params); },
        structureCa: function (params) { return Tapp.api('structureCa', params); }
      },
      parser: parser,
      withTimeout: withTimeout,
      onFallback: function (primaryError) {
        console.warn('[viewer] full structure unavailable; falling back to C-alpha', primaryError);
        setStatus(i18n('simplifiedFallback') + ' · ' + id);
      }
    });
    var parsed = loaded.parsed;
    try { ensureRenderer(); } catch (renderError) { console.error('[viewer] renderer init failed during load', renderError); }
    loadStructure(parsed, i18n('onlineTitle'), loaded.text);
  } catch (err) {
    console.error('[viewer] fetch failed', err);
    var detail = loadErrorDetail(err);
    setStatus(i18n('loadFailed') + ' · ' + id + (detail ? ' · ' + detail : ''));
    toast(i18n('loadFailed') + ' · ' + id + (detail ? '（' + detail + '）' : ''), 'error');
  } finally {
    state.busy = false; showSpinner(false);
    if (loadButton) { loadButton.disabled = false; loadButton.removeAttribute('aria-busy'); }
  }
}

async function runSearch() {
  var box = $id('view-search');
  var results = $id('view-search-results');
  var term = String(box && box.value || '').trim();
  if (!term) return;
  if (state.busy) return;
  state.busy = true; showSpinner(true); setStatus(i18n('startLoading') + ' · ' + term);
  try {
    var ids = parser.parseSearchResponse(await withTimeout(Tapp.api('search', { query: term }), 30000));
    if (!ids.length) { setStatus(i18n('noResults')); toast(i18n('noResults'), 'info'); results.hidden = true; return; }
    var lookup = parser.parseLookupResponse(await withTimeout(Tapp.api('titles', { entry_ids: parser.buildLookupEntryIds(ids) }), 30000));
    renderSearchResults(results, lookup);
    setStatus(i18n('searchComplete') + ' · ' + ids.length);
  } catch (err) {
    console.error('[viewer] search failed', err);
    setStatus(i18n('searchFailed'));
    toast(i18n('searchFailed'), 'error');
  } finally {
    state.busy = false; showSpinner(false);
  }
}

function renderSearchResults(container, items) {
  container.replaceChildren();
  if (!items.length) { container.hidden = true; return; }
  items.forEach(function (item) {
    var row = document.createElement('button');
    row.type = 'button';
    row.className = 'search-result';
    row.dataset.pdbId = item.id;
    var idEl = document.createElement('b'); idEl.textContent = item.id;
    var titleEl = document.createElement('span'); titleEl.textContent = item.title || '';
    row.appendChild(idEl); row.appendChild(titleEl);
    row.addEventListener('click', function () {
      var box = $id('view-pdbid');
      if (box) box.value = item.id;
      container.hidden = true;
      loadPdbId(item.id);
    });
    container.appendChild(row);
  });
  container.hidden = false;
}

function updateMeasureLabel() {
  var label = $id('view-measure-value');
  if (!label) return;
  if (state.measureAtoms.length === 2) {
    label.textContent = state.measureAtoms[0].distanceTo(state.measureAtoms[1]).toFixed(2) + ' Å';
  } else if (state.measureAtoms.length === 1) {
    label.textContent = '1 / 2';
  } else label.textContent = '—';
}

function clearMeasure() {
  state.measureAtoms = [];
  updateMeasureLabel();
}

function showAtom(atom) {
  if (!atom || !state.scene) return;
  updateSelectionCard(atom);
  if (state.selectionMarker) {
    state.scene.remove(state.selectionMarker);
    if (state.selectionMarker.geometry) state.selectionMarker.geometry.dispose();
    if (state.selectionMarker.material) state.selectionMarker.material.dispose();
  }
  var marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 10),
    new THREE.MeshBasicMaterial({ color: 0xd97706, transparent: true, opacity: 0.82, wireframe: true })
  );
  marker.position.set(atom.x, atom.y, atom.z);
  state.selectionMarker = marker;
  state.scene.add(marker);
}

function pickAtom(ev) {
  if (!state.structure || !state.pickMesh || !state.renderAtoms.length || !THREE.Raycaster || !THREE.Vector2) return;
  var canvas = $id('view-canvas');
  var rect = canvas.getBoundingClientRect();
  var pointer = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
  var raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, state.camera);
  var hits = raycaster.intersectObjects([state.pickMesh], false);
  if (!hits.length || hits[0].instanceId === undefined) return;
  var atom = state.renderAtoms[hits[0].instanceId];
  if (!atom) return;
  showAtom(atom);
  if (state.measureAtoms.length >= 2) state.measureAtoms = [];
  var point = new THREE.Vector3(atom.x, atom.y, atom.z);
  state.measureAtoms.push(point);
  updateMeasureLabel();
}

function renderAtomSearchResults(term) {
  var container = $id('view-atom-results');
  if (!container) return;
  container.replaceChildren();
  if (!state.structure || !term) return;
  var needle = String(term).trim().toUpperCase();
  var matches = state.structure.atoms.filter(function (atom) {
    return String(atom.chain).toUpperCase().indexOf(needle) >= 0 || String(atom.resn).toUpperCase().indexOf(needle) >= 0 ||
      String(atom.atom).toUpperCase().indexOf(needle) >= 0 || String(atom.resi).indexOf(needle) >= 0;
  }).slice(0, 20);
  matches.forEach(function (atom) {
    var button = document.createElement('button'); button.type = 'button'; button.className = 'atom-result';
    var name = document.createElement('b'); name.textContent = atom.atom + ' · ' + atom.resn + ' ' + atom.resi;
    var chain = document.createElement('span'); chain.textContent = i18n('chain') + ' ' + atom.chain;
    button.appendChild(name); button.appendChild(chain);
    button.addEventListener('click', function () {
      if (state.visibleChains[atom.chain] === false) {
        state.visibleChains[atom.chain] = true;
        renderChainControls(state.chainOrder);
        buildModel();
      }
      showAtom(atom);
    });
    container.appendChild(button);
  });
}

async function downloadText(filename, content, type) {
  if (typeof Tapp === 'undefined' || !Tapp.file || typeof Tapp.file.download !== 'function') {
    throw new Error('FILE_DOWNLOAD_UNAVAILABLE');
  }
  await Tapp.file.download(content, filename, type || 'text/plain;charset=utf-8');
}

function screenshotSvg(canvas, dataUrl) {
  var width = canvas.width || 1;
  var height = canvas.height || 1;
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
    '<image href="' + dataUrl + '" width="' + width + '" height="' + height + '" preserveAspectRatio="none"/></svg>';
}

async function exportImage() {
  if (!state.renderer || !state.structure) return toast(i18n('selectHint'), 'warning');
  try {
    var canvas = state.renderer.domElement;
    var svg = screenshotSvg(canvas, canvas.toDataURL('image/png'));
    await downloadText((state.structure.id || 'structure') + '.svg', svg, 'image/svg+xml;charset=utf-8');
  } catch (err) {
    console.error('[viewer] export failed', err);
    toast(i18n('exportFailed'), 'error');
  }
}

function copyPdbId() {
  if (!state.structure || !state.structure.id) return toast(i18n('selectHint'), 'warning');
  var id = state.structure.id;
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(id).then(function () { toast(i18n('copied'), 'info'); }).catch(function () { toast(id, 'info'); });
  else toast(id, 'info');
}

function initLights(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  var key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(3, 5, 2);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0x8899ff, 0.35);
  rim.position.set(-3, 1, -2);
  scene.add(rim);
  var hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.45);
  scene.add(hemi);
}

function onPointerDown(ev) {
  var canvas = $id('view-canvas');
  if (canvas.setPointerCapture) { try { canvas.setPointerCapture(ev.pointerId); } catch (_) {} }
  state.pointerId = ev.pointerId;
  state.lastX = ev.clientX; state.lastY = ev.clientY;
  state.downX = ev.clientX; state.downY = ev.clientY;
  state.dragMode = ev.button === 2 ? 'pan' : 'rotate';
}

function onPointerMove(ev) {
  if (ev.pointerId !== state.pointerId) return;
  var dx = ev.clientX - state.lastX;
  var dy = ev.clientY - state.lastY;
  state.lastX = ev.clientX; state.lastY = ev.clientY;
  if (state.dragMode === 'rotate') {
    state.theta -= dx * 0.006;
    state.phi = Math.max(0.15, Math.min(Math.PI - 0.15, state.phi - dy * 0.006));
    updateCamera();
  } else if (state.dragMode === 'pan') {
    panCamera(dx, dy);
  }
}

function panCamera(dx, dy) {
  var scale = state.radius * 0.0016;
  var right = new THREE.Vector3();
  var up = new THREE.Vector3();
  state.camera.getWorldDirection(right);
  right.cross(state.camera.up).normalize();
  up.copy(state.camera.up);
  state.target.addScaledVector(right, -dx * scale);
  state.target.addScaledVector(up, dy * scale);
  updateCamera();
}

function onPointerUp(ev) {
  if (ev.pointerId === state.pointerId) {
    if (state.dragMode === 'rotate' && Math.hypot(ev.clientX - state.downX, ev.clientY - state.downY) < 5) pickAtom(ev);
    state.pointerId = null; state.dragMode = null;
  }
}

function onWheel(ev) {
  ev.preventDefault();
  zoomBy(Math.exp(ev.deltaY * 0.0011));
}

function onDoubleClick() {
  state.theta = 0.6; state.phi = 1.1; updateCamera();
}

function zoomBy(factor) {
  state.radius = Math.max(1.0, Math.min(state.radius * factor, 400));
  updateCamera();
}

function initCamera() {
  state.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
  updateCamera();
}

function initRenderer() {
  var canvas = $id('view-canvas');
  if (!canvas) throw new Error('canvas missing');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  state.renderer = renderer;
  state.scene = new THREE.Scene();
  initLights(state.scene);
  initCamera();
  resizeRenderer();
  if (typeof ResizeObserver === 'function') {
    state.resizeObserver = new ResizeObserver(function () { resizeRenderer(); });
    state.resizeObserver.observe(canvas.parentElement || canvas);
  } else {
    window.addEventListener('resize', resizeRenderer);
  }
}

function ensureRenderer() {
  if (state.renderReady && state.renderer) return true;
  if (!THREE && typeof globalThis !== 'undefined') THREE = globalThis.THREE;
  if (!THREE) return false;
  if (!state.target) state.target = new THREE.Vector3();
  initRenderer();
  state.renderReady = true;
  state.paused = false;
  renderFrame();
  return true;
}

function resizeRenderer() {
  var canvas = $id('view-canvas');
  if (!canvas || !state.renderer) return;
  var w = canvas.clientWidth || canvas.parentElement.clientWidth || 800;
  var h = canvas.clientHeight || canvas.parentElement.clientHeight || 600;
  state.renderer.setSize(w, h, false);
  state.camera.aspect = w / Math.max(h, 1);
  state.camera.updateProjectionMatrix();
}

function bindEvents() {
  var canvas = $id('view-canvas');
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDoubleClick);

  var loadForm = $id('view-load-form');
  var loadButton = $id('view-load-btn');
  var startLoad = function (ev) { ev.preventDefault(); loadPdbId($id('view-pdbid').value); };
  loadForm.addEventListener('submit', startLoad);
  if (loadButton) loadButton.addEventListener('click', startLoad);
  $id('view-search-btn').addEventListener('click', runSearch);
  $id('view-search').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); runSearch(); }
  });

  document.querySelectorAll('[name="color"]').forEach(function (input) {
    input.addEventListener('change', function () {
      if (input.checked) { state.colorMode = input.value; buildModel(); }
    });
  });
  $id('view-rotate').addEventListener('click', function () {
    state.autoRotate = !state.autoRotate;
    var btn = $id('view-rotate');
    btn.classList.toggle('active', state.autoRotate);
    btn.setAttribute('aria-pressed', String(state.autoRotate));
  });
  $id('view-reset').addEventListener('click', function () {
    if (state.structure) frameCamera();
    updateCamera();
  });
  $id('view-fullscreen').addEventListener('click', function () {
    if (typeof Tapp !== 'undefined' && Tapp.ui && typeof Tapp.ui.requestFullscreen === 'function') Tapp.ui.requestFullscreen();
  });
  $id('view-fullscreen-top').addEventListener('click', function () {
    if (typeof Tapp !== 'undefined' && Tapp.ui && typeof Tapp.ui.requestFullscreen === 'function') Tapp.ui.requestFullscreen();
  });
  $id('view-reset-quick').addEventListener('click', function () { if (state.structure) frameCamera(); updateCamera(); });
  $id('view-fit').addEventListener('click', function () { if (state.structure) frameCamera(); updateCamera(); });
  $id('view-zoom-in').addEventListener('click', function () { zoomBy(0.82); });
  $id('view-zoom-out').addEventListener('click', function () { zoomBy(1.22); });
  $id('view-toggle-history').addEventListener('click', function () { setHistoryCollapsed(!state.historyCollapsed, true); });
  $id('view-clear-history').addEventListener('click', function () { writeHistory([]); renderHistory(); });
  $id('view-clear-measure').addEventListener('click', clearMeasure);
  $id('view-export-image').addEventListener('click', exportImage);
  $id('view-export-cif').addEventListener('click', function () {
    if (!state.rawCif || !state.structure) return toast(i18n('selectHint'), 'warning');
    downloadText((state.structure.id || 'structure') + '.cif', state.rawCif, 'chemical/x-mmcif;charset=utf-8').catch(function (err) {
      console.error('[viewer] mmCIF export failed', err);
      toast(i18n('exportFailed'), 'error');
    });
  });
  $id('view-copy-id').addEventListener('click', copyPdbId);
  $id('view-atom-search').addEventListener('input', function (ev) { renderAtomSearchResults(ev.target.value); });
  $id('view-chain-select').addEventListener('change', function (ev) {
    if (!state.structure) return;
    var value = ev.target.value;
    state.chainOrder.forEach(function (chain) { state.visibleChains[chain] = value === 'all' || chain === value; });
    renderChainControls(state.chainOrder); buildModel();
  });
  $id('view-toggle-controls').addEventListener('click', function (ev) {
    var dock = document.querySelector('.dock-content');
    var expanded = ev.currentTarget.getAttribute('aria-expanded') === 'true';
    ev.currentTarget.setAttribute('aria-expanded', String(!expanded));
    ev.currentTarget.textContent = i18n(expanded ? 'expand' : 'collapse');
    if (dock) dock.hidden = expanded;
  });

  document.querySelectorAll('[data-action="search"]').forEach(function (el) {
    el.addEventListener('click', function () {
      var results = $id('view-search-results');
      if (results && !results.hidden) results.hidden = true;
    });
  });
}

function initTheme() {
  if (typeof Tapp === 'undefined' || !Tapp.ui) return;
  try { applyTheme(Tapp.ui.getTheme()); } catch (_) {}
  if (typeof Tapp.ui.onThemeChange === 'function') {
    Tapp.ui.onThemeChange(function (theme) { applyTheme(theme); });
  }
}

function initLocale() {
  applyLocale();
  if (typeof Tapp !== 'undefined' && Tapp.ui && typeof Tapp.ui.onLocaleChange === 'function') {
    Tapp.ui.onLocaleChange(function () { applyLocale(); });
  }
}

function bootstrap() {
  if (state.bootstrapped) return;
  if (!$id('view-canvas') || !$id('view-load-form')) {
    if (state.bootstrapWaits++ < 60) setTimeout(bootstrap, 0);
    else setStatus('页面组件尚未就绪');
    return;
  }
  state.bootstrapped = true;
  try {
    initTheme();
    initLocale();
    bindEvents();
    setHistoryCollapsed(readHistoryCollapsed(), false);
    renderHistory();
    setStatus((i18n('runtimeReady') === 'runtimeReady' ? '页面已就绪' : i18n('runtimeReady')) + ' · ' + i18n('selectHint'));
  } catch (err) {
    console.error('[viewer] UI bootstrap failed', err);
    setStatus(i18n('loadFailed'));
    toast(i18n('loadFailed'), 'error');
    return;
  }
  if (!THREE && typeof globalThis !== 'undefined') THREE = globalThis.THREE;
  if (!THREE) {
    toast(i18n('apiMissing'), 'error');
    setStatus(i18n('apiMissing'));
    console.error('[viewer] global THREE missing; declare runtimeModules: ["three"]');
    return;
  }
  try {
    state.target = new THREE.Vector3();
    initRenderer();
    state.renderReady = true;
    state.paused = false;
    renderFrame();
    if (typeof Tapp !== 'undefined' && Tapp.lifecycle && typeof Tapp.lifecycle.onPause === 'function') Tapp.lifecycle.onPause(function () { state.paused = true; cancelAnimationFrame(state.raf); });
    if (typeof Tapp !== 'undefined' && Tapp.lifecycle && typeof Tapp.lifecycle.onResume === 'function') Tapp.lifecycle.onResume(function () {
      state.paused = false;
      if (state.renderer) { resizeRenderer(); updateCamera(); renderFrame(); }
    });
    if (typeof Tapp !== 'undefined' && Tapp.lifecycle && typeof Tapp.lifecycle.onDestroy === 'function') Tapp.lifecycle.onDestroy(function () {
      state.destroyed = true;
      state.paused = true;
      cancelAnimationFrame(state.raf);
      if (state.resizeObserver) state.resizeObserver.disconnect();
      else window.removeEventListener('resize', resizeRenderer);
      if (state.selectionMarker) {
        if (state.selectionMarker.geometry) state.selectionMarker.geometry.dispose();
        if (state.selectionMarker.material) state.selectionMarker.material.dispose();
      }
      if (state.pickMesh) { build.disposeObject(state.pickMesh); state.scene.remove(state.pickMesh); }
      if (state.model) { build.disposeObject(state.model); state.scene.remove(state.model); }
      if (state.renderer) { state.renderer.dispose(); }
      if (typeof Tapp !== 'undefined' && Tapp.assets && typeof Tapp.assets.revokeAll === 'function') Tapp.assets.revokeAll();
    });
  } catch (err) {
    console.error('[viewer] bootstrap failed', err);
    state.renderReady = false;
    setStatus(i18n('rendererUnavailable') === 'rendererUnavailable' ? '3D 渲染器初始化失败' : i18n('rendererUnavailable'));
    toast(i18n('rendererUnavailable') === 'rendererUnavailable' ? '3D 渲染器初始化失败' : i18n('rendererUnavailable'), 'error');
  }
}

function startViewer() {
  if (typeof Tapp !== 'undefined' && Tapp.lifecycle && typeof Tapp.lifecycle.onReady === 'function') {
    Tapp.lifecycle.onReady(bootstrap);
  } else if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
}

startViewer();
