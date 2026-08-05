var DAYS_STORAGE_KEY = 'days.events.v1';
var DAYS_CATEGORIES_STORAGE_KEY = 'days.categories.v1';
var DAYS_THEME_STORAGE_KEY = 'days.theme.v1';
var DAYS_COLORS = ['#D97757', '#C6924B', '#66917A', '#6687A8', '#8D78A8', '#B56F83'];
var DAYS_CATEGORY_IDS = { life: true, birthday: true, anniversary: true, study: true, travel: true, other: true };
var DAYS_I18N = {
  'zh-CN': {
    appName: '朝夕', subtitle: '把期待写进日历，也把走过的日子留在身边。', newEvent: '新建日子',
    nextMeeting: '下一次相见', emptyHero: '记录一个值得期待的日子', startToday: '从今天开始', dayUnit: '天',
    filterAria: '筛选日子', search: '搜索名称或备注', statusFilter: '状态筛选', all: '全部', upcoming: '即将到来', pinnedFilter: '已置顶', past: '已过单次',
    momentsTitle: '我的日子', dayCount: '{count} 个日子', emptyTitle: '还没有符合条件的日子', emptyBody: '创建一个纪念日、生日、考试或任何值得期待的时刻。', createFirst: '创建第一个日子',
    editorNew: '新建日子', editorEdit: '编辑日子', closeEditor: '关闭编辑器', name: '名称', namePlaceholder: '例如：去看海的日子', date: '日期', quickDate: '快捷选择日期', today: '今天', in7Days: '7 天后', in30Days: '30 天后', inOneYear: '一年后',
    category: '分类', chooseCategory: '选择分类', custom: '自定义', categoryPlaceholder: '输入新分类', newCategoryName: '新分类名称', add: '添加', note: '备注', notePlaceholder: '写下一点期待，或关于这一天的故事',
    annual: '每年重复', annualHint: '适合生日与纪念日', pinEvent: '置顶日子', pinHint: '优先展示在首页与 Widget', color: '标记颜色', delete: '删除', cancel: '取消', save: '保存日子', saving: '保存中…',
    pinned: '置顶', soon: '临近', yearly: '每年', once: '单次', remembered: '这一天值得被记住。', editAria: '编辑 {title}',
    categoryAdded: '分类“{label}”已添加', saved: '日子已保存', updated: '日子已更新', deleted: '日子已删除', saveFailed: '保存失败，请稍后重试', categoryFailed: '分类添加失败，请稍后重试', editorFailed: '编辑器打开失败，请重新加载页面', deleteConfirm: '确定删除“{title}”吗？',
    countToday: '今', isToday: '就是今天', remaining: '还有 {count} 天', elapsed: '已经 {count} 天', annualSuffix: ' · 每年', addImportant: '添加一个重要日子', anticipated: '值得期待的日子', widgetEmpty: '在朝夕中创建第一个重要日子', everyDayEchoes: '每一天都有回声',
    themeStudio: '主题工作室', themeSubtitle: '让主界面与小组件拥有同一套气质。', closeTheme: '关闭主题工作室', themePreset: '主题预设', presetSunset: '朝霞', presetViolet: '暮紫', presetOcean: '远海', presetForest: '森语', presetMono: '留白', accentColor: '强调色', glassStrength: 'Glass 强度', cornerStyle: '圆角风格', cornerSoft: '柔和', cornerRound: '圆润', cornerCompact: '利落', glassScope: 'Glass 应用范围', glassPage: '主界面画布', glassHero: '焦点倒数卡', glassToolbar: '搜索与筛选', glassCards: '日子卡片', glassEditor: '编辑器与主题面板', glassWidgets: '主页小组件', themeCode: '分享主题码', themeCodeHint: '主题码只包含外观设置，不包含你的日子。', copyCode: '复制主题码', importCode: '导入主题码', importPlaceholder: '粘贴 CX1- 开头的主题码', applyCode: '应用主题码', resetTheme: '恢复默认', themeSaved: '主题已保存', themeCopied: '主题码已复制', themeSelected: '已选中主题码，请手动复制', themeImported: '主题码已应用', themeInvalid: '主题码无效或版本不受支持', themeReset: '已恢复默认主题',
    categoryLife: '生活', categoryBirthday: '生日', categoryAnniversary: '纪念', categoryStudy: '学习', categoryTravel: '旅行', categoryOther: '其他'
  },
  'en-US': {
    appName: 'Days', subtitle: 'Keep future moments close, and remember the days already lived.', newEvent: 'New day',
    nextMeeting: 'NEXT MOMENT', emptyHero: 'Record a day worth looking forward to', startToday: 'Start today', dayUnit: 'days',
    filterAria: 'Filter days', search: 'Search names or notes', statusFilter: 'Status filters', all: 'All', upcoming: 'Upcoming', pinnedFilter: 'Pinned', past: 'Past one-time',
    momentsTitle: 'My days', dayCount: '{count} days', emptyTitle: 'No matching days yet', emptyBody: 'Create an anniversary, birthday, exam, or any moment worth anticipating.', createFirst: 'Create your first day',
    editorNew: 'New day', editorEdit: 'Edit day', closeEditor: 'Close editor', name: 'Name', namePlaceholder: 'For example: A day by the sea', date: 'Date', quickDate: 'Quick date choices', today: 'Today', in7Days: 'In 7 days', in30Days: 'In 30 days', inOneYear: 'In one year',
    category: 'Category', chooseCategory: 'Choose a category', custom: 'Custom', categoryPlaceholder: 'New category', newCategoryName: 'New category name', add: 'Add', note: 'Note', notePlaceholder: 'Write down what makes this day meaningful',
    annual: 'Repeat yearly', annualHint: 'Great for birthdays and anniversaries', pinEvent: 'Pin day', pinHint: 'Show first on the page and Widget', color: 'Marker color', delete: 'Delete', cancel: 'Cancel', save: 'Save day', saving: 'Saving…',
    pinned: 'Pinned', soon: 'Soon', yearly: 'Yearly', once: 'Once', remembered: 'A day worth remembering.', editAria: 'Edit {title}',
    categoryAdded: 'Category “{label}” added', saved: 'Day saved', updated: 'Day updated', deleted: 'Day deleted', saveFailed: 'Could not save. Please try again.', categoryFailed: 'Could not add the category. Please try again.', editorFailed: 'Could not open the editor. Please reload.', deleteConfirm: 'Delete “{title}”?',
    countToday: 'Now', isToday: 'Today', remaining: '{count} days left', elapsed: '{count} days ago', annualSuffix: ' · Yearly', addImportant: 'Add an important day', anticipated: 'Days to look forward to', widgetEmpty: 'Create your first important day in Days', everyDayEchoes: 'Every day leaves an echo',
    themeStudio: 'Theme studio', themeSubtitle: 'Give the page and widgets one shared visual language.', closeTheme: 'Close theme studio', themePreset: 'Theme preset', presetSunset: 'Sunrise', presetViolet: 'Twilight', presetOcean: 'Ocean', presetForest: 'Forest', presetMono: 'Paper', accentColor: 'Accent color', glassStrength: 'Glass strength', cornerStyle: 'Corner style', cornerSoft: 'Soft', cornerRound: 'Round', cornerCompact: 'Crisp', glassScope: 'Glass surfaces', glassPage: 'Page canvas', glassHero: 'Countdown hero', glassToolbar: 'Search and filters', glassCards: 'Day cards', glassEditor: 'Editor and theme panel', glassWidgets: 'Home widgets', themeCode: 'Share theme code', themeCodeHint: 'Theme codes contain appearance only—never your dates.', copyCode: 'Copy theme code', importCode: 'Import theme code', importPlaceholder: 'Paste a theme code beginning with CX1-', applyCode: 'Apply theme code', resetTheme: 'Reset theme', themeSaved: 'Theme saved', themeCopied: 'Theme code copied', themeSelected: 'Theme code selected; copy it manually', themeImported: 'Theme code applied', themeInvalid: 'Invalid or unsupported theme code', themeReset: 'Default theme restored',
    categoryLife: 'Life', categoryBirthday: 'Birthday', categoryAnniversary: 'Anniversary', categoryStudy: 'Study', categoryTravel: 'Travel', categoryOther: 'Other'
  },
  'ja-JP': {
    appName: '日々', subtitle: '楽しみな日も、過ぎた大切な日も、いつでもそばに。', newEvent: '日を追加',
    nextMeeting: '次の大切な日', emptyHero: '楽しみにしたい日を記録しましょう', startToday: '今日から始める', dayUnit: '日',
    filterAria: '日の絞り込み', search: '名前やメモを検索', statusFilter: '状態フィルター', all: 'すべて', upcoming: 'これから', pinnedFilter: '固定済み', past: '過ぎた一回限り',
    momentsTitle: '私の日々', dayCount: '{count} 件', emptyTitle: '条件に合う日がありません', emptyBody: '記念日、誕生日、試験など、楽しみにしたい日を作成しましょう。', createFirst: '最初の日を作成',
    editorNew: '日を追加', editorEdit: '日を編集', closeEditor: '編集画面を閉じる', name: '名前', namePlaceholder: '例：海を見に行く日', date: '日付', quickDate: '日付のクイック選択', today: '今日', in7Days: '7日後', in30Days: '30日後', inOneYear: '1年後',
    category: 'カテゴリー', chooseCategory: 'カテゴリーを選択', custom: 'カスタム', categoryPlaceholder: '新しいカテゴリー', newCategoryName: '新しいカテゴリー名', add: '追加', note: 'メモ', notePlaceholder: 'この日への思いや楽しみを書きましょう',
    annual: '毎年繰り返す', annualHint: '誕生日や記念日に最適', pinEvent: '固定する', pinHint: 'ページとWidgetで優先表示', color: 'マーカー色', delete: '削除', cancel: 'キャンセル', save: '保存', saving: '保存中…',
    pinned: '固定', soon: 'もうすぐ', yearly: '毎年', once: '一回', remembered: '忘れたくない大切な日。', editAria: '{title}を編集',
    categoryAdded: 'カテゴリー「{label}」を追加しました', saved: '保存しました', updated: '更新しました', deleted: '削除しました', saveFailed: '保存できませんでした。もう一度お試しください。', categoryFailed: 'カテゴリーを追加できませんでした。', editorFailed: '編集画面を開けませんでした。再読み込みしてください。', deleteConfirm: '「{title}」を削除しますか？',
    countToday: '今', isToday: '今日です', remaining: 'あと {count} 日', elapsed: '{count} 日前', annualSuffix: ' · 毎年', addImportant: '大切な日を追加', anticipated: '楽しみにしている日', widgetEmpty: '日々で最初の大切な日を作成', everyDayEchoes: '一日一日に余韻がある',
    themeStudio: 'テーマスタジオ', themeSubtitle: 'ページとWidgetの雰囲気を一つに整えます。', closeTheme: 'テーマスタジオを閉じる', themePreset: 'テーマプリセット', presetSunset: '朝焼け', presetViolet: '夕紫', presetOcean: '遠い海', presetForest: '森の声', presetMono: '余白', accentColor: 'アクセント色', glassStrength: 'Glass の強さ', cornerStyle: '角のスタイル', cornerSoft: 'やわらか', cornerRound: '丸み', cornerCompact: 'シャープ', glassScope: 'Glass の適用範囲', glassPage: 'ページ全体', glassHero: 'カウントダウンカード', glassToolbar: '検索とフィルター', glassCards: '日カード', glassEditor: '編集・テーマパネル', glassWidgets: 'ホームWidget', themeCode: 'テーマコードを共有', themeCodeHint: 'テーマコードに日付データは含まれません。', copyCode: 'コードをコピー', importCode: 'テーマコードを読み込む', importPlaceholder: 'CX1- から始まるコードを貼り付け', applyCode: 'テーマを適用', resetTheme: '初期設定に戻す', themeSaved: 'テーマを保存しました', themeCopied: 'テーマコードをコピーしました', themeSelected: 'コードを選択しました。手動でコピーしてください', themeImported: 'テーマコードを適用しました', themeInvalid: 'テーマコードが無効か未対応です', themeReset: '初期テーマに戻しました',
    categoryLife: '生活', categoryBirthday: '誕生日', categoryAnniversary: '記念日', categoryStudy: '勉強', categoryTravel: '旅行', categoryOther: 'その他'
  }
};
var daysCurrentLocale = 'zh-CN';
function daysNormalizeLocale(locale) { var value = String(locale || '').toLowerCase(); if (value.indexOf('ja') === 0) return 'ja-JP'; if (value.indexOf('en') === 0) return 'en-US'; return 'zh-CN'; }
function daysT(key, values) { var text = (DAYS_I18N[daysCurrentLocale] || DAYS_I18N['zh-CN'])[key] || DAYS_I18N['zh-CN'][key] || key; return String(text).replace(/\{(\w+)\}/g, function (_, name) { return values && values[name] != null ? String(values[name]) : ''; }); }
function daysCategoryKey(id) { return 'category' + String(id || 'other').charAt(0).toUpperCase() + String(id || 'other').slice(1); }
function daysDefaultCategories() { return Object.keys(DAYS_CATEGORY_IDS).map(function (id) { return { id: id, label: daysT(daysCategoryKey(id)), custom: false }; }); }
var DAYS_THEME_PRESETS = {
  sunset: { accent: '#D97757' }, violet: { accent: '#7C68B5' }, ocean: { accent: '#3C87A8' }, forest: { accent: '#54836A' }, mono: { accent: '#6F6A65' }
};
var DAYS_DEFAULT_THEME = {
  version: 1, preset: 'sunset', accent: '#D97757', glassStrength: 72, corner: 'round',
  glass: { page: true, hero: true, toolbar: true, cards: true, editor: true, widgets: true }
};
function daysCloneTheme(theme) { return JSON.parse(JSON.stringify(theme)); }
function daysValidColor(value, fallback) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toUpperCase() : fallback; }
function daysClamp(value, min, max, fallback) { var number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }
function daysNormalizeTheme(value) {
  var source = value && typeof value === 'object' ? value : {}; var glass = source.glass && typeof source.glass === 'object' ? source.glass : {};
  var preset = DAYS_THEME_PRESETS[source.preset] ? source.preset : DAYS_DEFAULT_THEME.preset; var defaultAccent = DAYS_THEME_PRESETS[preset].accent;
  return {
    version: 1, preset: preset, accent: daysValidColor(source.accent, defaultAccent), glassStrength: Math.round(daysClamp(source.glassStrength, 0, 100, DAYS_DEFAULT_THEME.glassStrength)),
    corner: ['soft', 'round', 'compact'].indexOf(source.corner) >= 0 ? source.corner : DAYS_DEFAULT_THEME.corner,
    glass: {
      page: glass.page !== false, hero: glass.hero !== false, toolbar: glass.toolbar !== false, cards: glass.cards !== false,
      editor: glass.editor !== false, widgets: glass.widgets !== false
    }
  };
}
function daysHexRgb(hex) { var value = daysValidColor(hex, '#D97757').slice(1); return parseInt(value.slice(0, 2), 16) + ', ' + parseInt(value.slice(2, 4), 16) + ', ' + parseInt(value.slice(4, 6), 16); }
function daysThemeCode(theme) {
  var json = JSON.stringify(daysNormalizeTheme(theme)); var bytes = unescape(encodeURIComponent(json));
  return 'CX1-' + btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function daysThemeFromCode(code) {
  var raw = String(code || '').trim(); if (raw.indexOf('CX1-') !== 0) throw new Error('invalid theme code');
  var encoded = raw.slice(4).replace(/-/g, '+').replace(/_/g, '/'); while (encoded.length % 4) encoded += '=';
  var parsed = JSON.parse(decodeURIComponent(escape(atob(encoded)))); if (!parsed || parsed.version !== 1) throw new Error('unsupported theme code');
  return daysNormalizeTheme(parsed);
}
async function daysLoadTheme() { try { return daysNormalizeTheme(await Tapp.storage.get(DAYS_THEME_STORAGE_KEY)); } catch (_) { return daysCloneTheme(DAYS_DEFAULT_THEME); } }
async function daysSaveTheme(theme) { var normalized = daysNormalizeTheme(theme); await Tapp.storage.set(DAYS_THEME_STORAGE_KEY, normalized); return normalized; }
function daysApplyThemeConfig(root, theme) {
  if (!root) return; var normalized = daysNormalizeTheme(theme); var radius = normalized.corner === 'soft' ? 14 : normalized.corner === 'compact' ? 10 : 20;
  root.dataset.themePreset = normalized.preset; root.dataset.corner = normalized.corner; root.style.setProperty('--days-accent', normalized.accent); root.style.setProperty('--days-accent-rgb', daysHexRgb(normalized.accent));
  root.style.setProperty('--days-glass-alpha', String(.16 + normalized.glassStrength * .0056)); root.style.setProperty('--days-glass-blur', (8 + normalized.glassStrength * .2).toFixed(0) + 'px'); root.style.setProperty('--days-radius', radius + 'px');
  root.classList.toggle('page-glass-disabled', !normalized.glass.page);
  root.querySelectorAll('[data-glass-key]').forEach(function (element) { var key = element.dataset.glassKey; element.classList.toggle('glass-disabled', !normalized.glass[key]); });
}

function daysPad(value) { return String(value).padStart(2, '0'); }
function daysTodayKey() {
  var now = new Date();
  return now.getFullYear() + '-' + daysPad(now.getMonth() + 1) + '-' + daysPad(now.getDate());
}
function daysDateKeyFromOffset(offset) {
  var date = new Date();
  date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + Number(offset || 0));
  return date.getFullYear() + '-' + daysPad(date.getMonth() + 1) + '-' + daysPad(date.getDate());
}
function daysParseDate(value) {
  var parts = String(value || '').split('-').map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
}
function daysUtcDay(date) { return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000; }
function daysOccurrence(event, now) {
  var source = daysParseDate(event.date);
  if (!source) return null;
  if (!event.annual) return source;
  var candidate = new Date(now.getFullYear(), source.getMonth(), source.getDate(), 12, 0, 0, 0);
  if (candidate.getMonth() !== source.getMonth()) candidate = new Date(now.getFullYear(), source.getMonth() + 1, 0, 12, 0, 0, 0);
  if (daysUtcDay(candidate) < daysUtcDay(now)) {
    candidate = new Date(now.getFullYear() + 1, source.getMonth(), source.getDate(), 12, 0, 0, 0);
    if (candidate.getMonth() !== source.getMonth()) candidate = new Date(now.getFullYear() + 1, source.getMonth() + 1, 0, 12, 0, 0, 0);
  }
  return candidate;
}
function daysDifference(event, now) {
  var target = daysOccurrence(event, now || new Date());
  if (!target) return 0;
  return Math.round(daysUtcDay(target) - daysUtcDay(now || new Date()));
}
function daysNormalizeCategories(value) {
  if (!Array.isArray(value)) return [];
  var seen = {};
  return value.map(function (item) {
    var label = String(item && item.label || '').trim().slice(0, 12); var id = String(item && item.id || '').trim().slice(0, 48);
    if (!label || !id || DAYS_CATEGORY_IDS[id] || seen[id]) return null;
    seen[id] = true; return { id: id, label: label, custom: true };
  }).filter(Boolean);
}
function daysCategoryLabel(category, fallback) { return DAYS_CATEGORY_IDS[category] ? daysT(daysCategoryKey(category)) : String(fallback || '').trim().slice(0, 12) || daysT('categoryOther'); }
function daysNormalizeEvents(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(function (item) { return item && typeof item.title === 'string' && daysParseDate(item.date); }).map(function (item, index) {
    var customLabel = String(item.categoryLabel || '').trim().slice(0, 12); var rawCategory = String(item.category || 'other').slice(0, 48);
    return {
      id: String(item.id || ('legacy-' + index)), title: item.title.trim().slice(0, 80), date: item.date,
      category: (DAYS_CATEGORY_IDS[rawCategory] || customLabel) ? rawCategory : 'other', categoryLabel: DAYS_CATEGORY_IDS[rawCategory] ? '' : customLabel,
      note: String(item.note || '').slice(0, 240),
      annual: Boolean(item.annual), color: /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : DAYS_COLORS[index % DAYS_COLORS.length],
      pinned: Boolean(item.pinned),
      createdAt: Number(item.createdAt) || Date.now()
    };
  });
}
function daysNormalizeStore(eventsValue, categoriesValue) {
  var events = daysNormalizeEvents(Array.isArray(eventsValue) ? eventsValue : eventsValue && eventsValue.events);
  var categories = daysNormalizeCategories(categoriesValue).concat(daysNormalizeCategories(eventsValue && eventsValue.categories));
  categories = daysNormalizeCategories(categories);
  events.forEach(function (event) { if (!event.categoryLabel || categories.some(function (item) { return item.id === event.category; })) return; categories.push({ id: event.category, label: event.categoryLabel, custom: true }); });
  return { events: events, categories: categories };
}
function daysSortEvents(events) {
  var now = new Date();
  return events.slice().sort(function (a, b) {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    var ad = daysDifference(a, now); var bd = daysDifference(b, now);
    var ar = ad >= 0 ? 0 : 1; var br = bd >= 0 ? 0 : 1;
    if (ar !== br) return ar - br;
    return ar === 0 ? ad - bd : bd - ad;
  });
}
async function daysLoadStore() {
  try {
    var values = await Promise.all([Tapp.storage.get(DAYS_STORAGE_KEY), Tapp.storage.get(DAYS_CATEGORIES_STORAGE_KEY)]);
    return daysNormalizeStore(values[0], values[1]);
  }
  catch (error) { console.error('[Days] load failed', error); return { events: [], categories: [] }; }
}
async function daysLoadEvents() { return (await daysLoadStore()).events; }
async function daysSaveEvents(events) { await Tapp.storage.set(DAYS_STORAGE_KEY, daysNormalizeEvents(events)); }
async function daysSaveCategories(categories) { await Tapp.storage.set(DAYS_CATEGORIES_STORAGE_KEY, daysNormalizeCategories(categories)); }
function daysFormatDate(date, annual) {
  var options = annual ? { month: 'long', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric' };
  try { return new Intl.DateTimeFormat(daysCurrentLocale, options).format(date); } catch (_) { return date.toLocaleDateString(); }
}
function daysCountCopy(diff) {
  if (diff === 0) return { count: daysT('countToday'), unit: daysT('dayUnit'), phrase: daysT('isToday') };
  if (diff > 0) return { count: String(diff), unit: daysT('dayUnit'), phrase: daysT('remaining', { count: diff }) };
  return { count: String(Math.abs(diff)), unit: daysT('dayUnit'), phrase: daysT('elapsed', { count: Math.abs(diff) }) };
}
function daysNotify(message, type) {
  if (Tapp.ui && typeof Tapp.ui.showNotification === 'function') {
    return Tapp.ui.showNotification({ title: daysT('appName'), message: message, type: type || 'success', duration: 2600 });
  }
  return Promise.resolve();
}
var daysThemeOff = null;
function daysApplyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  if (document.body) document.body.classList.toggle('dark', theme === 'dark');
}
async function daysInitTheme(fallbackTheme) {
  try { daysApplyTheme(await Tapp.ui.getTheme()); } catch (_) { if (fallbackTheme) daysApplyTheme(fallbackTheme); }
  if (daysThemeOff) daysThemeOff(); daysThemeOff = null;
  if (Tapp.ui && typeof Tapp.ui.onThemeChange === 'function') {
    var off = Tapp.ui.onThemeChange(daysApplyTheme); if (typeof off === 'function') daysThemeOff = off;
  }
}
function daysSetText(root, selector, value) { var element = root.querySelector(selector); if (element) element.textContent = value; }
function daysApplyStaticLocale(root) {
  if (!root) return;
  document.documentElement.lang = daysCurrentLocale;
  root.querySelectorAll('[data-i18n]').forEach(function (element) { element.textContent = daysT(element.dataset.i18n); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(function (element) { element.setAttribute('placeholder', daysT(element.dataset.i18nPlaceholder)); });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(function (element) { element.setAttribute('aria-label', daysT(element.dataset.i18nAriaLabel)); });
}
var daysLocaleOff = null;
async function daysInitLocale(fallbackLocale, onChange) {
  var locale = fallbackLocale;
  try { if (Tapp.ui && typeof Tapp.ui.getLocale === 'function') locale = await Tapp.ui.getLocale(); } catch (_) {}
  daysCurrentLocale = daysNormalizeLocale(locale);
  if (daysLocaleOff) daysLocaleOff(); daysLocaleOff = null;
  if (Tapp.ui && typeof Tapp.ui.onLocaleChange === 'function') {
    var off = Tapp.ui.onLocaleChange(function (nextLocale) { daysCurrentLocale = daysNormalizeLocale(nextLocale); if (typeof onChange === 'function') onChange(); });
    if (typeof off === 'function') daysLocaleOff = off;
  }
}

// ========== Widget Code ==========
var daysWidgetOff = null;
var daysWidgetDestroyBound = false;
var daysWidgetMidnightTimer = null;
function daysScheduleWidgetMidnight(root, props) {
  if (daysWidgetMidnightTimer) clearTimeout(daysWidgetMidnightTimer);
  var now = new Date(); var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
  daysWidgetMidnightTimer = setTimeout(function () {
    Promise.all([daysLoadEvents(), daysLoadTheme()]).then(function (values) { daysRenderWidget(root, values[0], props || {}, values[1]); daysScheduleWidgetMidnight(root, props); }).catch(console.error);
  }, Math.max(1000, next.getTime() - now.getTime()));
}
function daysWidgetConfig(props) {
  var source = props && (props.config || props.settings) ? (props.config || props.settings) : {};
  return {
    themeSource: source.themeSource === 'instance' ? 'instance' : 'shared', themePreset: DAYS_THEME_PRESETS[source.themePreset] ? source.themePreset : 'sunset',
    glassMode: ['all', 'shell', 'items', 'none'].indexOf(source.glassMode) >= 0 ? source.glassMode : 'all', density: source.density === 'compact' ? 'compact' : 'comfortable',
    showBrand: source.showBrand !== false, showDate: source.showDate !== false, showCategory: source.showCategory !== false, showFooter: source.showFooter !== false,
    highlightPinned: source.highlightPinned !== false, maxItems: Math.round(daysClamp(source.maxItems, 1, 6, 4))
  };
}
function daysApplyWidgetTheme(root, sharedTheme, config, props) {
  var theme = daysNormalizeTheme(sharedTheme); var preset = config.themeSource === 'instance' ? config.themePreset : theme.preset;
  var accent = config.themeSource === 'instance' ? DAYS_THEME_PRESETS[preset].accent : theme.accent; if (props && props.primaryColor && config.themeSource === 'shared') accent = props.primaryColor;
  var glassMode = theme.glass.widgets ? config.glassMode : 'none'; root.dataset.themePreset = preset; root.dataset.glassMode = glassMode; root.dataset.density = config.density;
  root.style.setProperty('--days-accent', accent); root.style.setProperty('--days-accent-rgb', daysHexRgb(accent)); root.style.setProperty('--days-glass-alpha', String(.16 + theme.glassStrength * .0056)); root.style.setProperty('--days-glass-blur', (8 + theme.glassStrength * .2).toFixed(0) + 'px');
  root.classList.toggle('glass-disabled', glassMode === 'none' || glassMode === 'items'); root.classList.toggle('widget-items-glass', glassMode === 'all' || glassMode === 'items');
  [['[data-widget-brand]', config.showBrand], ['[data-widget-date]', config.showDate], ['[data-widget-category]', config.showCategory], ['[data-widget-footer]', config.showFooter]].forEach(function (entry) { root.querySelectorAll(entry[0]).forEach(function (element) { element.hidden = !entry[1]; }); });
}
function daysRenderWidget(root, events, props, sharedTheme) {
  var sorted = daysSortEvents(events); var now = new Date(); var config = daysWidgetConfig(props);
  daysApplyStaticLocale(root);
  daysApplyWidgetTheme(root, sharedTheme, config, props);
  daysSetText(root, '[data-widget-date]', new Intl.DateTimeFormat(daysCurrentLocale, { month: 'short', day: 'numeric' }).format(now));
  var primary = sorted[0];
  if (primary) {
    var target = daysOccurrence(primary, now); var diff = daysDifference(primary, now); var copy = daysCountCopy(diff);
    daysSetText(root, '[data-widget-category]', daysCategoryLabel(primary.category, primary.categoryLabel));
    daysSetText(root, '[data-widget-title]', primary.title);
    daysSetText(root, '[data-widget-count]', copy.count);
    daysSetText(root, '[data-widget-unit]', copy.unit);
    daysSetText(root, '[data-widget-full-date]', daysFormatDate(target, primary.annual));
    var dot = root.querySelector('[data-widget-dot]'); if (dot) dot.style.background = primary.color;
  }
  var list = root.querySelector('[data-widget-list]'); var empty = root.querySelector('[data-widget-empty]');
  if (list) {
    list.textContent = '';
    sorted.slice(0, config.maxItems).forEach(function (event) {
      var item = document.createElement('article'); item.className = 'widget-list-item' + (event.pinned && config.highlightPinned ? ' is-pinned' : '');
      var mark = document.createElement('i'); mark.style.background = event.color;
      var copy = document.createElement('div'); var title = document.createElement('strong'); title.textContent = event.title;
      var meta = document.createElement('span'); meta.textContent = daysFormatDate(daysOccurrence(event, now), event.annual);
      var count = document.createElement('b'); count.textContent = daysCountCopy(daysDifference(event, now)).phrase;
      copy.appendChild(title); copy.appendChild(meta); item.appendChild(mark); item.appendChild(copy); item.appendChild(count); list.appendChild(item);
    });
    if (empty) empty.hidden = sorted.length > 0;
  }
  daysSetText(root, '[data-widget-total]', daysT('dayCount', { count: sorted.length }));
}
if (typeof Tapp !== 'undefined' && Tapp.widgets) {
  Tapp.widgets['days-countdown'] = {
    render: async function (container, props) {
      var root = container.querySelector('[data-widget-root]') || container;
      await daysInitTheme(props && props.theme);
      await daysInitLocale(props && props.locale, function () { Promise.all([daysLoadEvents(), daysLoadTheme()]).then(function (values) { daysRenderWidget(root, values[0], props || {}, values[1]); }); });
      var initial = await Promise.all([daysLoadEvents(), daysLoadTheme()]); daysRenderWidget(root, initial[0], props || {}, initial[1]);
      daysScheduleWidgetMidnight(root, props);
      if (daysWidgetOff) daysWidgetOff();
      if (Tapp.storage && typeof Tapp.storage.onChanged === 'function') {
        daysWidgetOff = Tapp.storage.onChanged(function (event) {
          if (!event || !event.key || event.key === DAYS_STORAGE_KEY || event.key === DAYS_THEME_STORAGE_KEY) Promise.all([daysLoadEvents(), daysLoadTheme()]).then(function (values) { daysRenderWidget(root, values[0], props || {}, values[1]); });
        });
      }
      if (!daysWidgetDestroyBound) {
        daysWidgetDestroyBound = true;
        Tapp.lifecycle.onDestroy(function () { if (daysWidgetOff) daysWidgetOff(); if (daysThemeOff) daysThemeOff(); if (daysLocaleOff) daysLocaleOff(); if (daysWidgetMidnightTimer) clearTimeout(daysWidgetMidnightTimer); daysWidgetOff = null; daysThemeOff = null; daysLocaleOff = null; daysWidgetMidnightTimer = null; });
      }
    }
  };
}

// ========== Page Code ==========
var daysPageState = { events: [], categories: [], theme: daysCloneTheme(DAYS_DEFAULT_THEME), filter: 'all', query: '', editingId: null, off: null, editorToken: 0, saving: false, editorReturnFocus: null, themeReturnFocus: null };
function daysElement(tag, className, text) { var el = document.createElement(tag); if (className) el.className = className; if (text != null) el.textContent = text; return el; }
function daysAllCategories() { return daysDefaultCategories().concat(daysPageState.categories); }
function daysFindCategory(id) { return daysAllCategories().find(function (item) { return item.id === id; }) || daysDefaultCategories()[0]; }
function daysRenderThemeStudio(root) {
  var panel = root.querySelector('[data-theme-panel]'); if (!panel) return; var theme = daysNormalizeTheme(daysPageState.theme);
  var preset = panel.querySelector('[name="themePreset"]'); var accent = panel.querySelector('[name="themeAccent"]'); var strength = panel.querySelector('[name="glassStrength"]'); var corner = panel.querySelector('[name="themeCorner"]');
  if (preset) preset.value = theme.preset; if (accent) accent.value = theme.accent; if (strength) strength.value = String(theme.glassStrength); if (corner) corner.value = theme.corner;
  panel.querySelectorAll('[data-glass-toggle]').forEach(function (input) { input.checked = Boolean(theme.glass[input.dataset.glassToggle]); });
  daysSetText(panel, '[data-glass-strength-value]', theme.glassStrength + '%'); var code = panel.querySelector('[data-theme-code]'); if (code) code.value = daysThemeCode(theme);
  daysApplyThemeConfig(root, theme);
}
function daysThemeFromStudio(root) {
  var panel = root.querySelector('[data-theme-panel]'); if (!panel) return daysCloneTheme(DAYS_DEFAULT_THEME); var glass = {};
  panel.querySelectorAll('[data-glass-toggle]').forEach(function (input) { glass[input.dataset.glassToggle] = input.checked; });
  return daysNormalizeTheme({ version: 1, preset: panel.querySelector('[name="themePreset"]').value, accent: panel.querySelector('[name="themeAccent"]').value, glassStrength: panel.querySelector('[name="glassStrength"]').value, corner: panel.querySelector('[name="themeCorner"]').value, glass: glass });
}
async function daysUpdateThemeFromStudio(root, changedField) {
  var panel = root.querySelector('[data-theme-panel]'); if (!panel) return;
  if (changedField && changedField.name === 'themePreset' && DAYS_THEME_PRESETS[changedField.value]) panel.querySelector('[name="themeAccent"]').value = DAYS_THEME_PRESETS[changedField.value].accent;
  daysPageState.theme = daysThemeFromStudio(root); daysRenderThemeStudio(root); daysPageState.theme = await daysSaveTheme(daysPageState.theme);
}
function daysOpenThemeStudio(root) {
  var panel = root.querySelector('[data-theme-panel]'); if (!panel) return; daysPageState.themeReturnFocus = document.activeElement; panel.hidden = false; panel.setAttribute('aria-hidden', 'false'); daysRenderThemeStudio(root);
  requestAnimationFrame(function () { requestAnimationFrame(function () { panel.classList.add('is-open'); var first = panel.querySelector('select, input, button'); if (first) { try { first.focus({ preventScroll: true }); } catch (_) { first.focus(); } } }); });
}
function daysCloseThemeStudio(root) {
  var panel = root.querySelector('[data-theme-panel]'); if (!panel || panel.hidden) return; var returnFocus = daysPageState.themeReturnFocus; daysPageState.themeReturnFocus = null; panel.classList.remove('is-open'); panel.setAttribute('aria-hidden', 'true');
  setTimeout(function () { if (!panel.classList.contains('is-open')) { panel.hidden = true; if (returnFocus && returnFocus.isConnected) { try { returnFocus.focus({ preventScroll: true }); } catch (_) { returnFocus.focus(); } } } }, 260);
}
async function daysCopyThemeCode(root) {
  var code = root.querySelector('[data-theme-code]'); if (!code) return; code.focus(); code.select(); var copied = false;
  try { copied = Boolean(document.execCommand && document.execCommand('copy')); } catch (_) {}
  await daysNotify(daysT(copied ? 'themeCopied' : 'themeSelected'), copied ? 'success' : 'info');
}
async function daysImportThemeCode(root) {
  var input = root.querySelector('[data-theme-import]'); if (!input) return;
  try { daysPageState.theme = await daysSaveTheme(daysThemeFromCode(input.value)); input.value = ''; daysRenderThemeStudio(root); daysRenderPage(root); await daysNotify(daysT('themeImported')); }
  catch (_) { await daysNotify(daysT('themeInvalid'), 'error'); input.focus(); }
}
async function daysResetTheme(root) { daysPageState.theme = await daysSaveTheme(daysCloneTheme(DAYS_DEFAULT_THEME)); daysRenderThemeStudio(root); daysRenderPage(root); await daysNotify(daysT('themeReset'), 'info'); }
function daysSetCategoryPopover(root, open) {
  var popover = root.querySelector('[data-category-popover]'); var trigger = root.querySelector('[data-action="toggle-category"]');
  if (!popover || !trigger) return;
  popover.hidden = !open; trigger.setAttribute('aria-expanded', open ? 'true' : 'false'); trigger.classList.toggle('is-open', open);
  if (open) { var input = popover.querySelector('[data-category-input]'); if (input) setTimeout(function () { input.focus(); }, 40); }
}
function daysRenderCategoryPicker(root, selectedId) {
  var form = root.querySelector('[data-event-form]'); if (!form) return;
  var field = form.querySelector('[name="category"]'); var value = root.querySelector('[data-category-value]'); var options = root.querySelector('[data-category-options]');
  if (!field || !value || !options) return;
  var selected = daysFindCategory(selectedId || field.value); field.value = selected.id; value.textContent = selected.label; options.textContent = '';
  daysAllCategories().forEach(function (category) {
    var button = daysElement('button', 'category-option', category.label); button.type = 'button'; button.dataset.action = 'select-category'; button.dataset.categoryId = category.id;
    button.setAttribute('role', 'option'); button.setAttribute('aria-selected', category.id === selected.id ? 'true' : 'false');
    if (category.custom) { var badge = daysElement('small', '', daysT('custom')); button.appendChild(badge); }
    options.appendChild(button);
  });
}
async function daysAddCategory(root) {
  var input = root.querySelector('[data-category-input]'); if (!input) return;
  var label = input.value.trim().slice(0, 12); if (!label) { input.focus(); return; }
  var existing = daysAllCategories().find(function (item) { return item.label.toLowerCase() === label.toLowerCase(); });
  if (existing) { daysRenderCategoryPicker(root, existing.id); input.value = ''; daysSetCategoryPopover(root, false); return; }
  var category = { id: 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), label: label, custom: true };
  daysPageState.categories = daysPageState.categories.concat(category); await daysSaveCategories(daysPageState.categories);
  input.value = ''; daysRenderCategoryPicker(root, category.id); daysSetCategoryPopover(root, false); await daysNotify(daysT('categoryAdded', { label: label }));
}
function daysFilteredEvents() {
  var query = daysPageState.query.trim().toLowerCase(); var now = new Date();
  return daysSortEvents(daysPageState.events).filter(function (event) {
    var diff = daysDifference(event, now);
    if (daysPageState.filter === 'upcoming' && diff < 0) return false;
    if (daysPageState.filter === 'past' && (event.annual || diff >= 0)) return false;
    if (daysPageState.filter === 'pinned' && !event.pinned) return false;
    return !query || event.title.toLowerCase().includes(query) || event.note.toLowerCase().includes(query);
  });
}
function daysRenderHero(root) {
  var event = daysSortEvents(daysPageState.events)[0];
  if (!event) {
    daysSetText(root, '[data-hero-category]', daysT('nextMeeting')); daysSetText(root, '[data-hero-title]', daysT('emptyHero'));
    daysSetText(root, '[data-hero-date]', daysT('startToday')); daysSetText(root, '[data-hero-count]', '0'); daysSetText(root, '[data-hero-unit]', daysT('dayUnit')); return;
  }
  var target = daysOccurrence(event, new Date()); var copy = daysCountCopy(daysDifference(event, new Date()));
  daysSetText(root, '[data-hero-category]', daysCategoryLabel(event.category, event.categoryLabel)); daysSetText(root, '[data-hero-title]', event.title);
  daysSetText(root, '[data-hero-date]', daysFormatDate(target, event.annual) + (event.annual ? daysT('annualSuffix') : ''));
  daysSetText(root, '[data-hero-count]', copy.count); daysSetText(root, '[data-hero-unit]', copy.unit);
  var hero = root.querySelector('[data-hero]'); if (hero) hero.style.setProperty('--event-color', event.color);
}
function daysRenderPage(root) {
  daysApplyStaticLocale(root); daysApplyThemeConfig(root, daysPageState.theme); daysRenderHero(root); var events = daysFilteredEvents(); var list = root.querySelector('[data-event-list]'); var empty = root.querySelector('[data-empty]');
  list.textContent = ''; daysSetText(root, '[data-event-total]', daysT('dayCount', { count: events.length })); empty.hidden = events.length > 0;
  events.forEach(function (event) {
    var diff = daysDifference(event, new Date()); var target = daysOccurrence(event, new Date()); var copy = daysCountCopy(diff);
    var card = daysElement('article', 'event-card glass' + (event.pinned ? ' is-pinned' : '')); card.style.setProperty('--event-color', event.color); card.tabIndex = 0; card.setAttribute('role', 'button'); card.setAttribute('aria-label', daysT('editAria', { title: event.title })); card.dataset.eventId = event.id; card.dataset.glassKey = 'cards'; card.classList.toggle('glass-disabled', !daysPageState.theme.glass.cards);
    var top = daysElement('div', 'event-card-top'); var category = daysElement('span', 'event-category', daysCategoryLabel(event.category, event.categoryLabel));
    var badges = daysElement('span', 'event-badges');
    if (event.pinned) badges.appendChild(daysElement('span', 'event-pin', daysT('pinned')));
    if (diff >= 0 && diff <= 7) badges.appendChild(daysElement('span', 'event-soon', diff === 0 ? daysT('today') : daysT('soon')));
    badges.appendChild(daysElement('span', 'event-repeat', event.annual ? daysT('yearly') : daysT('once'))); top.appendChild(category); top.appendChild(badges);
    var title = daysElement('h3', '', event.title); var note = daysElement('p', 'event-note', event.note || daysT('remembered'));
    var bottom = daysElement('div', 'event-card-bottom'); var date = daysElement('span', 'event-date', daysFormatDate(target, event.annual));
    var counter = daysElement('strong', 'event-count', copy.phrase); bottom.appendChild(date); bottom.appendChild(counter);
    card.appendChild(top); card.appendChild(title); card.appendChild(note); card.appendChild(bottom); list.appendChild(card);
  });
}
function daysOpenEditor(root, event) {
  var panel = root.querySelector('[data-editor]'); var form = root.querySelector('[data-event-form]');
  if (!panel || !form) throw new Error('[Days] editor template is incomplete');
  var idField = form.querySelector('[name="id"]'); var titleField = form.querySelector('[name="title"]'); var dateField = form.querySelector('[name="date"]');
  var categoryField = form.querySelector('[name="category"]'); var noteField = form.querySelector('[name="note"]'); var annualField = form.querySelector('[name="annual"]'); var pinnedField = form.querySelector('[name="pinned"]'); var colorField = form.querySelector('[name="color"]');
  if (!idField || !titleField || !dateField || !categoryField || !noteField || !annualField || !pinnedField || !colorField) throw new Error('[Days] editor fields are incomplete');
  daysPageState.editorReturnFocus = document.activeElement && typeof document.activeElement.focus === 'function' ? document.activeElement : null;
  var token = ++daysPageState.editorToken; panel.hidden = false; panel.setAttribute('aria-hidden', 'false'); panel.classList.remove('is-open'); form.reset();
  daysPageState.editingId = event ? event.id : null; idField.value = event ? event.id : '';
  titleField.value = event ? event.title : ''; dateField.value = event ? event.date : daysTodayKey();
  categoryField.value = event ? event.category : 'life'; noteField.value = event ? event.note : '';
  annualField.checked = event ? event.annual : false; pinnedField.checked = event ? event.pinned : false; colorField.value = event ? event.color : DAYS_COLORS[daysPageState.events.length % DAYS_COLORS.length];
  daysRenderCategoryPicker(root, categoryField.value); daysSetCategoryPopover(root, false);
  daysSetText(root, '[data-editor-title]', event ? daysT('editorEdit') : daysT('editorNew')); var deleteButton = root.querySelector('[data-action="delete-event"]'); if (deleteButton) deleteButton.hidden = !event;
  requestAnimationFrame(function () { requestAnimationFrame(function () {
    if (daysPageState.editorToken !== token || panel.hidden) return; panel.classList.add('is-open');
    try { titleField.focus({ preventScroll: true }); } catch (_) { titleField.focus(); }
  }); });
}
function daysCloseEditor(root) {
  var panel = root.querySelector('[data-editor]'); if (!panel || panel.hidden) return;
  var returnFocus = daysPageState.editorReturnFocus; daysPageState.editorReturnFocus = null; ++daysPageState.editorToken; panel.classList.remove('is-open'); panel.setAttribute('aria-hidden', 'true'); daysPageState.editingId = null; daysSetCategoryPopover(root, false);
  setTimeout(function () { if (!panel.classList.contains('is-open')) { panel.hidden = true; if (returnFocus && returnFocus.isConnected) { try { returnFocus.focus({ preventScroll: true }); } catch (_) { returnFocus.focus(); } } } }, 300);
}
function daysSetQuickDate(root, offset) {
  var field = root.querySelector('[data-event-form] [name="date"]'); if (!field) return;
  field.value = daysDateKeyFromOffset(offset); field.dispatchEvent(new Event('change', { bubbles: true }));
}
async function daysSubmitEvent(root, form) {
  var idField = form.querySelector('[name="id"]'); var titleField = form.querySelector('[name="title"]'); var dateField = form.querySelector('[name="date"]'); var categoryField = form.querySelector('[name="category"]');
  var noteField = form.querySelector('[name="note"]'); var annualField = form.querySelector('[name="annual"]'); var pinnedField = form.querySelector('[name="pinned"]'); var colorField = form.querySelector('[name="color"]');
  if (!idField || !titleField || !dateField || !categoryField || !noteField || !annualField || !pinnedField || !colorField) throw new Error('[Days] editor fields are incomplete');
  if (typeof form.reportValidity === 'function' && !form.reportValidity()) return false;
  var id = String(idField.value || ''); var existing = daysPageState.events.find(function (event) { return event.id === id; }); var selectedCategory = daysFindCategory(categoryField.value);
  var next = { id: id || ('day-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)), title: String(titleField.value || '').trim(), date: String(dateField.value || ''), category: selectedCategory.id, categoryLabel: selectedCategory.custom ? selectedCategory.label : '', note: String(noteField.value || '').trim(), annual: annualField.checked, pinned: pinnedField.checked, color: String(colorField.value || '#D97757'), createdAt: existing ? existing.createdAt : Date.now() };
  if (!next.title || !daysParseDate(next.date)) return false;
  daysPageState.events = existing ? daysPageState.events.map(function (event) { return event.id === id ? next : event; }) : daysPageState.events.concat(next);
  await daysSaveEvents(daysPageState.events); daysCloseEditor(root); daysRenderPage(root); await daysNotify(daysT(existing ? 'updated' : 'saved')); return true;
}
async function daysHandleSave(root) {
  if (daysPageState.saving) return;
  var form = root.querySelector('[data-event-form]'); var button = root.querySelector('[data-action="save-event"]'); if (!form) throw new Error('[Days] editor form is missing');
  daysPageState.saving = true; if (button) { button.disabled = true; button.textContent = daysT('saving'); }
  try { await daysSubmitEvent(root, form); }
  catch (error) { console.error('[Days] save failed', error); await daysNotify(daysT('saveFailed'), 'error'); }
  finally { daysPageState.saving = false; if (button) { button.disabled = false; button.textContent = daysT('save'); } }
}
async function daysDeleteEvent(root) {
  var event = daysPageState.events.find(function (item) { return item.id === daysPageState.editingId; }); if (!event) return;
  var confirmed = await Tapp.ui.confirm(daysT('deleteConfirm', { title: event.title })); if (!confirmed) return;
  daysPageState.events = daysPageState.events.filter(function (item) { return item.id !== event.id; });
  await daysSaveEvents(daysPageState.events); daysCloseEditor(root); daysRenderPage(root); await daysNotify(daysT('deleted'), 'info');
}
async function daysMountPage(root) {
  if (root.dataset.ready === 'true' || root.dataset.ready === 'mounting') return; root.dataset.ready = 'mounting'; await daysInitTheme(); await daysInitLocale(null, function () { daysRenderPage(root); if (!root.querySelector('[data-editor]').hidden) { var editing = daysPageState.events.find(function (item) { return item.id === daysPageState.editingId; }); daysSetText(root, '[data-editor-title]', editing ? daysT('editorEdit') : daysT('editorNew')); daysRenderCategoryPicker(root, root.querySelector('[name="category"]').value); } if (!root.querySelector('[data-theme-panel]').hidden) daysRenderThemeStudio(root); }); var initial = await Promise.all([daysLoadStore(), daysLoadTheme()]); daysPageState.events = initial[0].events; daysPageState.categories = initial[0].categories; daysPageState.theme = initial[1]; daysRenderPage(root);
  root.addEventListener('click', function (event) {
    var action = event.target.closest('[data-action]');
    if (action) {
      var name = action.dataset.action;
      if (name === 'new-event') { daysCloseThemeStudio(root); try { daysOpenEditor(root, null); } catch (error) { console.error(error); daysNotify(daysT('editorFailed'), 'error'); } }
      if (name === 'open-theme') { daysCloseEditor(root); daysOpenThemeStudio(root); }
      if (name === 'close-theme') daysCloseThemeStudio(root);
      if (name === 'copy-theme-code') daysCopyThemeCode(root).catch(console.error);
      if (name === 'import-theme-code') daysImportThemeCode(root).catch(console.error);
      if (name === 'reset-theme') daysResetTheme(root).catch(console.error);
      if (name === 'close-editor') daysCloseEditor(root);
      if (name === 'delete-event') daysDeleteEvent(root).catch(console.error);
      if (name === 'save-event') daysHandleSave(root).catch(console.error);
      if (name === 'toggle-category') { var popover = root.querySelector('[data-category-popover]'); daysSetCategoryPopover(root, Boolean(popover && popover.hidden)); }
      if (name === 'select-category') { daysRenderCategoryPicker(root, action.dataset.categoryId); daysSetCategoryPopover(root, false); }
      if (name === 'add-category') daysAddCategory(root).catch(function (error) { console.error(error); daysNotify(daysT('categoryFailed'), 'error'); });
      if (name === 'set-date') daysSetQuickDate(root, action.dataset.offset);
      return;
    }
    if (!event.target.closest('[data-category-picker]')) daysSetCategoryPopover(root, false);
    var filter = event.target.closest('[data-filter]'); if (filter) { daysPageState.filter = filter.dataset.filter; root.querySelectorAll('[data-filter]').forEach(function (button) { button.classList.toggle('is-active', button === filter); }); daysRenderPage(root); return; }
    var card = event.target.closest('[data-event-id]');
    if (card) { try { daysOpenEditor(root, daysPageState.events.find(function (item) { return item.id === card.dataset.eventId; })); } catch (error) { console.error(error); daysNotify(daysT('editorFailed'), 'error'); } }
  });
  root.addEventListener('keydown', function (event) {
    var card = event.target.closest('[data-event-id]'); if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); card.click(); return; }
    if (event.key === 'Enter' && event.target.matches('[data-category-input]')) { event.preventDefault(); daysAddCategory(root).catch(console.error); return; }
    if (event.key === 'Enter' && event.target.closest('[data-event-form]') && !event.target.matches('textarea, button')) { event.preventDefault(); daysHandleSave(root).catch(console.error); return; }
    if (event.key === 'Escape') { var popover = root.querySelector('[data-category-popover]'); var themePanel = root.querySelector('[data-theme-panel]'); if (popover && !popover.hidden) daysSetCategoryPopover(root, false); else if (themePanel && !themePanel.hidden) daysCloseThemeStudio(root); else daysCloseEditor(root); }
  });
  root.querySelector('[data-search]').addEventListener('input', function (event) { daysPageState.query = event.target.value; daysRenderPage(root); });
  root.querySelector('[data-event-form]').addEventListener('submit', function (event) { event.preventDefault(); event.stopPropagation(); daysHandleSave(root).catch(console.error); }, true);
  root.querySelector('[data-theme-panel]').addEventListener('input', function (event) { if (event.target.matches('[name="glassStrength"]')) daysUpdateThemeFromStudio(root, event.target).catch(console.error); });
  root.querySelector('[data-theme-panel]').addEventListener('change', function (event) { if (event.target.matches('select, input')) daysUpdateThemeFromStudio(root, event.target).catch(console.error); });
  if (Tapp.storage && typeof Tapp.storage.onChanged === 'function') {
    daysPageState.off = Tapp.storage.onChanged(function (event) {
      if (!event || !event.key || event.key === DAYS_STORAGE_KEY || event.key === DAYS_CATEGORIES_STORAGE_KEY) daysLoadStore().then(function (nextStore) { daysPageState.events = nextStore.events; daysPageState.categories = nextStore.categories; daysRenderPage(root); });
      if (!event || !event.key || event.key === DAYS_THEME_STORAGE_KEY) daysLoadTheme().then(function (theme) { daysPageState.theme = theme; daysRenderPage(root); if (!root.querySelector('[data-theme-panel]').hidden) daysRenderThemeStudio(root); });
    });
  }
  root.dataset.ready = 'true';
  Tapp.lifecycle.onDestroy(function () { if (daysPageState.off) daysPageState.off(); if (daysThemeOff) daysThemeOff(); if (daysLocaleOff) daysLocaleOff(); daysThemeOff = null; daysLocaleOff = null; });
}
if (typeof Tapp !== 'undefined' && Tapp.lifecycle) {
  Tapp.lifecycle.onReady(function () { var root = document.querySelector('[data-days-page]'); if (root) daysMountPage(root).catch(console.error); });
}
