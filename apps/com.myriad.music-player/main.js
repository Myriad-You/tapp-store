// Music Player Tapp v1.0.0

// ========================================
// 国际化
// ========================================

var i18n = {
  'zh-CN': {
    title: '音乐播放器',
    noPlaying: '暂无播放',
    noPlaylist: '播放列表为空',
    play: '播放',
    pause: '暂停',
    next: '下一首',
    volume: '音量',
    shuffle: '随机播放',
    repeat: '列表循环',
    repeatOne: '单曲循环',
    normal: '顺序播放',
    playlist: '播放列表',
    lyrics: '歌词',
    noLyrics: '暂无歌词',
    translate: '翻译',
    searchPlaceholder: '搜索歌曲...',
    vip: 'VIP',
    trial: '试听',
    playlistIdPlaceholder: '网易云歌单 ID 或链接',
    externalPlaylist: '外部歌单',
    importBtn: '导入',
    backToSearch: '返回搜索',
    playVip: '播放VIP',
    loadPlaylist: '加载歌单',
    loadingPlaylist: '正在加载...',
    playlistLoaded: '歌单加载成功',
    playlistLoadFailed: '加载失败，请检查ID',
    playlistIdRequired: '请输入歌单ID',
  },
  'en-US': {
    title: 'Music Player',
    noPlaying: 'Not Playing',
    noPlaylist: 'Playlist Empty',
    play: 'Play',
    pause: 'Pause',
    next: 'Next',
    volume: 'Volume',
    shuffle: 'Shuffle',
    repeat: 'Repeat All',
    repeatOne: 'Repeat One',
    normal: 'Normal',
    playlist: 'Playlist',
    lyrics: 'Lyrics',
    noLyrics: 'No Lyrics',
    translate: 'Translate',
    searchPlaceholder: 'Search songs...',
    vip: 'VIP',
    trial: 'Trial',
    playlistIdPlaceholder: 'Netease playlist ID or link',
    externalPlaylist: 'External',
    importBtn: 'Import',
    backToSearch: 'Back',
    playVip: 'Play VIP',
    loadPlaylist: 'Load Playlist',
    loadingPlaylist: 'Loading...',
    playlistLoaded: 'Playlist loaded',
    playlistLoadFailed: 'Failed, check ID',
    playlistIdRequired: 'Enter playlist ID',
  },
  'ja-JP': {
    title: '音楽プレーヤー',
    noPlaying: '再生なし',
    noPlaylist: 'プレイリスト空',
    play: '再生',
    pause: '一時停止',
    next: '次へ',
    volume: '音量',
    shuffle: 'シャッフル',
    repeat: 'リピート',
    repeatOne: '1曲リピート',
    normal: '通常',
    playlist: 'プレイリスト',
    lyrics: '歌詞',
    noLyrics: '歌詞なし',
    translate: '翻訳',
    searchPlaceholder: '曲を検索...',
    vip: 'VIP',
    trial: '試聴',
    playlistIdPlaceholder: 'Netease歌単IDまたはリンク',
    externalPlaylist: '外部歌単',
    importBtn: '読込',
    backToSearch: '検索に戻る',
    playVip: 'VIP再生',
    loadPlaylist: '歌単を読込',
    loadingPlaylist: '読み込み中...',
    playlistLoaded: '歌単読み込み完了',
    playlistLoadFailed: '失敗、IDを確認',
    playlistIdRequired: '歌単IDを入力',
  },
};

var currentLocale = 'zh-CN';
var currentTheme = 'light'; // 当前主题
var currentDict = i18n['zh-CN']; // 缓存当前语言字典

function normalizeLocale(locale) {
  if (!locale) return 'zh-CN';
  var l = locale.toLowerCase();
  if (l.startsWith('zh')) return 'zh-CN';
  if (l.startsWith('ja')) return 'ja-JP';
  return 'en-US';
}

function setLocale(locale) {
  currentLocale = locale;
  currentDict = i18n[locale] || i18n['zh-CN'];
}

function t(key) {
  return currentDict[key] || key;
}

// ========================================
// 主题适配
// ========================================

// 预定义主题配置，避免重复创建数组
var THEME_DARK = [
  ['--glass-bg', 'rgba(28, 28, 30, 0.85)'],
  ['--glass-border', 'rgba(255, 255, 255, 0.08)'],
  ['--glass-shadow', '0 8px 32px rgba(0, 0, 0, 0.4)'],
  ['--text-primary', '#f5f5f7'],
  ['--text-secondary', 'rgba(235, 235, 245, 0.6)'],
  ['--text-tertiary', 'rgba(235, 235, 245, 0.3)'],
  ['--lyric-trans-color', 'rgba(255, 255, 255, 0.44)'],
  ['--lyric-trans-active-color', 'rgba(255, 255, 255, 0.62)']
];
var THEME_LIGHT = [
  ['--glass-bg', 'rgba(255, 255, 255, 0.72)'],
  ['--glass-border', 'rgba(255, 255, 255, 0.18)'],
  ['--glass-shadow', '0 8px 32px rgba(0, 0, 0, 0.12)'],
  ['--text-primary', '#1d1d1f'],
  ['--text-secondary', 'rgba(60, 60, 67, 0.6)'],
  ['--text-tertiary', 'rgba(60, 60, 67, 0.3)'],
  ['--lyric-trans-color', 'rgba(0, 0, 0, 0.42)'],
  ['--lyric-trans-active-color', 'rgba(0, 0, 0, 0.58)']
];
var BG_DARK_GRADIENT = 'linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.5) 40%, rgba(0, 0, 0, 0.7) 100%)';
var BG_LIGHT_GRADIENT = 'linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.6) 40%, rgba(255, 255, 255, 0.8) 100%)';
var BG_DARK_FILTER = 'blur(60px) saturate(1.2) brightness(0.4)';
var BG_LIGHT_FILTER = 'blur(60px) saturate(1.8) brightness(0.9)';

// 缓存背景元素引用
var cachedBgOverlay = null;
var cachedBgArtwork = null;

function applyTheme(theme) {
  currentTheme = theme || 'light';
  var isDark = currentTheme === 'dark';
  var root = document.documentElement;
  
  // 切换 dark 类
  root.classList.toggle('dark', isDark);
  
  // 批量更新 CSS 变量
  var updates = isDark ? THEME_DARK : THEME_LIGHT;
  for (var i = 0; i < updates.length; i++) {
    root.style.setProperty(updates[i][0], updates[i][1]);
  }
  
  // 更新背景遮罩（使用缓存引用）
  if (!cachedBgOverlay) cachedBgOverlay = document.querySelector('.bg-overlay');
  if (cachedBgOverlay) {
    cachedBgOverlay.style.background = isDark ? BG_DARK_GRADIENT : BG_LIGHT_GRADIENT;
  }
  
  // 更新背景模糊效果（使用缓存引用）
  if (!cachedBgArtwork) cachedBgArtwork = document.querySelector('.bg-artwork');
  if (cachedBgArtwork) {
    cachedBgArtwork.style.filter = isDark ? BG_DARK_FILTER : BG_LIGHT_FILTER;
  }

  applyLyricReadableColors();
}

// ========================================
// 工具函数
// ========================================

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  var mins = (seconds / 60) | 0; // 位运算取整比Math.floor快
  var secs = (seconds % 60) | 0;
  return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

function debounce(fn, delay) {
  var timer = null;
  return function() {
    var context = this;
    var args = arguments;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function() {
      fn.apply(context, args);
    }, delay);
  };
}

// ========================================
// 统一动画调度器
// ========================================

// 初始化动画配置
async function initAnimationConfig() {
  try {
    var results = await Promise.all([
      Tapp.animation.shouldAnimate(),
      Tapp.animation.getConfig()
    ]);
    
    pageState.animConfig.shouldAnimate = results[0];
    
    var config = results[1];
    if (config) {
      pageState.animConfig.level = config.level || 'standard';
      pageState.animConfig.loop = config.loop !== false;
      pageState.animConfig.durationScale = config.durationScale || 1;
    }
    
    // 监听动画级别变化
    Tapp.animation.onLevelChange(function(level) {
      pageState.animConfig.level = level;
      pageState.animConfig.shouldAnimate = level !== 'none';
      
      // 根据新级别调整动画
      if (level === 'none') {
        stopBackgroundAnimation();
      } else if (pageState.status && pageState.status.isPlaying) {
        startBackgroundAnimation();
      }
    });
  } catch (e) {
    // 使用默认配置
    console.warn('Failed to load animation config:', e);
  }
}

// 检查是否应该执行动画
function shouldAnimate() {
  return pageState.animConfig.shouldAnimate && pageState.animConfig.level !== 'none';
}

// ========================================
// 页面状态
// ========================================

var pageState = {
  status: null,
  playlist: [],
  lyrics: [],
  currentLyricIndex: -1,
  // 逐字歌词（yrc）：与 lyrics 行一一对应，含每行 words
  verbatimLyrics: [],
  lyricsSongId: null,      // 已加载逐字歌词对应的歌曲 id
  // 歌词翻译（随 getLyrics 各行 translation 字段带回；Phase 1 仅网易中文源）
  hasTranslation: false,   // 当前歌曲是否有翻译数据
  transLang: '',           // 翻译语言（'zh' | ''）
  transOn: false,          // 翻译显示开关（持久化于 Tapp.storage）
  lyricWordFrame: null,    // 逐字高亮 rAF 句柄
  lastKaraokeLine: -1,     // 上一次做逐字填充的行索引
  eqFrame: null,           // 列表均衡器频谱 rAF 句柄
  autoScrollEnabled: true, // 自动滚动开关（点击歌词跳转时临时禁用）
  unsubscribe: null,
  unsubscribeProgress: null,
  // 背景动画状态（纯环境漂移，与节拍无关）
  bgAnimationFrame: null,
  bgPhase: 0,
  // 统一动画调度器配置
  animConfig: {
    level: 'standard',        // 'none' | 'light' | 'standard'
    loop: true,
    durationScale: 1,
    shouldAnimate: true,
  },
};

// DOM 元素缓存
var domCache = {};

function $(id) {
  if (!domCache[id]) {
    domCache[id] = document.getElementById(id);
  }
  return domCache[id];
}

// ========================================
// 页面模式
// ========================================

// 获取播放模式图标
// 后端模式值: 'sequence' | 'loop' | 'shuffle' | 'single'
function getModeIcon(mode) {
  switch (mode) {
    case 'shuffle':
      return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>';
    case 'single':
      return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/><text x="12" y="14.5" font-size="7" text-anchor="middle" font-weight="bold">1</text></svg>';
    case 'loop':
      return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>';
    default: // sequence (顺序播放)
      return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z"/></svg>';
  }
}

// 获取播放模式提示文字
// 后端模式值: 'sequence' | 'loop' | 'shuffle' | 'single'
function getModeTooltip(mode) {
  switch (mode) {
    case 'shuffle': return t('shuffle');
    case 'single': return t('repeatOne');
    case 'loop': return t('repeat');
    default: return t('normal'); // sequence
  }
}

// ========================================
// 歌词逐行波浪引擎（Apple Music 式）
// 与普通「整体滚动」的本质区别：不滚动容器——每行绝对定位，
// 各自用独立弹簧移动到目标位，焦点行以下按行距错峰启动，
// 形成 Apple Music 标志性的波浪跟随；激活行放大用 scale 弹簧（零重排）。
// ========================================

var lyricFx = {
  inner: null,        // .lyrics-inner
  items: [],          // { type:'line'|'dots', idx, el, y, h, pos, v, scale, scaleV, targetScale, delayUntil, start, end }
  total: 0,
  viewH: 0,
  measured: false,
  targetS: 0,         // 虚拟滚动位置
  minS: 0,
  maxS: 0,
  raf: null,
  lastT: 0,
  focusK: -1,
  momentumV: 0,       // 触摸惯性速度 px/s
  touchY: null,
  touchT: 0,
  touchV: 0,
  manualBound: false,
};
var lyricResumeTimer = null;

var LYRIC_FOCAL = 0.45;          // 焦点位：容器高度上部 45%（略高于居中）
var LYRIC_SCALE_INACTIVE = 0.62; // 非激活行缩放（40px × 0.62 ≈ 25px 视觉，激活 40px，对比 1.6×）
var LYRIC_WAVE_DELAY = 42;       // 波浪每行错峰 ms
var LYRIC_WAVE_SPAN = 7;         // 波浪最多错峰的行数

function stopLyricWave() {
  if (lyricFx.raf) {
    cancelAnimationFrame(lyricFx.raf);
    lyricFx.raf = null;
  }
  lyricFx.momentumV = 0;
}

// 测量行高并建立静态布局（行高与激活态无关——scale 不改布局，只需测一次）
function measureLyricLayout() {
  var container = $('lyrics-container');
  if (!container || !lyricFx.inner || lyricFx.items.length === 0) return false;
  var h = container.clientHeight;
  if (h === 0) return false; // 面板隐藏，待可见后重测
  var y = 0;
  for (var k = 0; k < lyricFx.items.length; k++) {
    var it = lyricFx.items[k];
    it.h = it.el.offsetHeight || 0;
    it.y = y;
    y += it.h;
  }
  lyricFx.total = y;
  lyricFx.viewH = h;
  var first = lyricFx.items[0];
  var last = lyricFx.items[lyricFx.items.length - 1];
  lyricFx.minS = first.y - h * LYRIC_FOCAL + first.h / 2;
  lyricFx.maxS = last.y - h * LYRIC_FOCAL + last.h / 2;
  lyricFx.measured = true;
  return true;
}

function clampLyricS(s) {
  return Math.max(lyricFx.minS, Math.min(lyricFx.maxS, s));
}

function findLyricItemK(lineIdx) {
  for (var k = 0; k < lyricFx.items.length; k++) {
    if (lyricFx.items[k].type === 'line' && lyricFx.items[k].idx === lineIdx) return k;
  }
  return -1;
}

// 全部立即就位（初次渲染 / 无动画模式）
function snapLyricItems() {
  for (var k = 0; k < lyricFx.items.length; k++) {
    var it = lyricFx.items[k];
    it.pos = it.y - lyricFx.targetS;
    it.v = 0;
    it.scale = it.targetScale;
    it.scaleV = 0;
    it._wy = Math.round(it.pos * 100);
    it._ws = Math.round(it.scale * 10000);
    it.el.style.transform = 'translate3d(0,' + it.pos.toFixed(2) + 'px,0) scale(' + it.scale.toFixed(4) + ')';
  }
}

// 聚焦某个 item：设定虚拟滚动目标 + 波浪错峰 + scale 目标（以 active 类为准）
// 注意：即使目标位置未变（如预聚焦后句子才激活），scale 目标也必须刷新——
// 否则「先聚焦、后激活」的句子会卡在非激活缩放（歌曲第一句/间奏后第一句）。
function focusLyricItemK(k, instant) {
  if (k < 0 || k >= lyricFx.items.length) return;
  if (!lyricFx.measured && !measureLyricLayout()) return;
  var it = lyricFx.items[k];
  var desiredS = it.y - lyricFx.viewH * LYRIC_FOCAL + it.h / 2;
  // 已聚焦且位置未变：只跳过波浪错峰重置，scale 目标仍要刷新
  var samePos = !instant && lyricFx.focusK === k && Math.abs(desiredS - lyricFx.targetS) < 1;

  var now = performance.now();
  var scaleChanged = false;
  for (var j = 0; j < lyricFx.items.length; j++) {
    var o = lyricFx.items[j];
    if (!samePos) {
      var d = j - k;
      // 焦点行及以上立即启动；下方按行距错峰 → 波浪向下铺开
      o.delayUntil = d > 0 ? now + Math.min(d, LYRIC_WAVE_SPAN) * LYRIC_WAVE_DELAY : now;
    }
    var ts = (o.type === 'line' && o.el.classList.contains('active'))
      ? 1
      : (o.type === 'dots' ? 0.9 : LYRIC_SCALE_INACTIVE);
    if (ts !== o.targetScale) {
      o.targetScale = ts;
      scaleChanged = true;
    }
  }
  lyricFx.targetS = desiredS;
  lyricFx.focusK = k;

  if (instant || !shouldAnimate()) {
    stopLyricWave();
    snapLyricItems();
    return;
  }
  if (!samePos || scaleChanged) startLyricWave();
}

function focusLyricLine(lineIdx, instant) {
  var k = findLyricItemK(lineIdx);
  if (k >= 0) focusLyricItemK(k, instant);
}

// 布局自愈：容器高度和上次测量不一致（入场时机早于布局稳定/iframe 尺寸变化/
// 横竖屏）就重测并回焦——与 tab 切换路径同逻辑。measured 一旦锁定不会自动
// 失效，没有这层守卫，入场早测的错误布局会一直持续
// allowUnmeasured=true 时对「从未测量成功」（如面板此前隐藏）也重测——tab 切换路径用
function relayoutLyricsIfNeeded(allowUnmeasured) {
  if (lyricFx.items.length === 0) return;
  if (!lyricFx.measured && !allowUnmeasured) return;
  var c = $('lyrics-container');
  if (!c) return;
  var h = c.clientHeight;
  if (h > 0 && (!lyricFx.measured || Math.abs(h - lyricFx.viewH) > 4)) {
    lyricFx.measured = false;
    if (measureLyricLayout()) {
      lyricFx.focusK = -1;
      var idx = pageState.currentLyricIndex >= 0 ? pageState.currentLyricIndex : 0;
      focusLyricLine(idx, true);
    }
  }
}

// ========================================
// 歌词翻译（Apple Music 式副行）
// ========================================

// 翻译对当前用户可用：有翻译数据 且 翻译语言与界面语言一致
// （Phase 1 只有网易中文翻译源，故仅中文界面显示开关）
function transUsable() {
  return pageState.hasTranslation &&
         pageState.transLang === 'zh' &&
         currentLocale === 'zh-CN';
}

// 同步翻译容器类 + 开关按钮（可见性/高亮/无障碍文案）
function syncLyricTransUI() {
  var usable = transUsable();
  var showing = usable && pageState.transOn;
  var container = $('lyrics-container');
  if (container) container.classList.toggle('show-trans', showing);
  var btn = $('lyric-trans-btn');
  if (btn) {
    btn.hidden = !usable;
    btn.classList.toggle('active', showing);
    btn.title = t('translate');
    btn.setAttribute('aria-label', t('translate'));
    btn.setAttribute('aria-pressed', showing ? 'true' : 'false');
  }
}

// 切换翻译显隐：行高改变 → 重测量布局，波浪引擎把所有行弹到新位置。
// 与歌词加载后的路径共用 measure/focus，无独立动画逻辑
function setLyricTransOn(on) {
  pageState.transOn = !!on;
  syncLyricTransUI();
  if (lyricFx.items.length === 0) return;
  lyricFx.measured = false;
  if (!measureLyricLayout()) return;
  lyricFx.targetS = clampLyricS(lyricFx.targetS);
  // 保持当前焦点项在焦点位（新行高下重新计算目标滚动量）
  if (pageState.autoScrollEnabled && lyricFx.focusK >= 0) {
    focusLyricItemK(lyricFx.focusK);
  }
  // 焦点目标可能未变但其他行的 y 全变了：无条件启动波浪把行送到新位
  if (shouldAnimate()) startLyricWave();
  else snapLyricItems();
}

function startLyricWave() {
  if (lyricFx.raf) return;
  lyricFx.lastT = performance.now();
  lyricFx.raf = requestAnimationFrame(lyricWaveTick);
}

function lyricWaveTick(now) {
  try {
    lyricWaveTickBody(now);
  } catch (e) {
    logTickError('lyricWaveTick', e);
    lyricFx.raf = null; // 波浪状态已不可信，停下等下一次 focus 重启
  }
}

function lyricWaveTickBody(now) {
  var dt = Math.min(0.032, (now - lyricFx.lastT) / 1000);
  lyricFx.lastT = now;

  // 触摸惯性衰减
  var moving = false;
  if (lyricFx.momentumV !== 0) {
    lyricFx.targetS = clampLyricS(lyricFx.targetS + lyricFx.momentumV * dt);
    lyricFx.momentumV *= Math.exp(-2.6 * dt);
    if (Math.abs(lyricFx.momentumV) < 15) lyricFx.momentumV = 0;
    else moving = true;
  }

  var K = 150;
  var Cc = 2 * Math.sqrt(K) * 0.92;   // 位置弹簧：轻微欠阻尼 → 细微过冲
  var KS = 240;
  var CS = 2 * Math.sqrt(KS);         // 缩放弹簧：临界阻尼

  for (var k = 0; k < lyricFx.items.length; k++) {
    var it = lyricFx.items[k];
    var ty = it.y - lyricFx.targetS;
    if (now >= it.delayUntil) {
      var a = K * (ty - it.pos) - Cc * it.v;
      it.v += a * dt;
      it.pos += it.v * dt;
      if (Math.abs(ty - it.pos) < 0.4 && Math.abs(it.v) < 3) {
        it.pos = ty;
        it.v = 0;
      } else {
        moving = true;
      }
    } else {
      moving = true;
    }

    var as = KS * (it.targetScale - it.scale) - CS * it.scaleV;
    it.scaleV += as * dt;
    it.scale += it.scaleV * dt;
    if (Math.abs(it.targetScale - it.scale) < 0.002 && Math.abs(it.scaleV) < 0.02) {
      it.scale = it.targetScale;
      it.scaleV = 0;
    } else {
      moving = true;
    }

    // 写入量化去重：已就位且值未变的行跳过 transform 写入
    var py = Math.round(it.pos * 100);
    var ps = Math.round(it.scale * 10000);
    if (py !== it._wy || ps !== it._ws) {
      it._wy = py;
      it._ws = ps;
      it.el.style.transform = 'translate3d(0,' + it.pos.toFixed(2) + 'px,0) scale(' + it.scale.toFixed(4) + ')';
    }
  }

  lyricFx.raf = moving ? requestAnimationFrame(lyricWaveTick) : null;
}

// 手动滚动时全行无错峰快速跟手
function retargetLyricItemsNow() {
  var now = performance.now();
  for (var j = 0; j < lyricFx.items.length; j++) {
    lyricFx.items[j].delayUntil = now;
  }
}

// 用户手动滚动：暂停自动跟随，3 秒后波浪弹回当前行
function userLyricScrollBegin() {
  pageState.autoScrollEnabled = false;
  if (lyricResumeTimer) clearTimeout(lyricResumeTimer);
  lyricResumeTimer = setTimeout(function() {
    lyricResumeTimer = null;
    pageState.autoScrollEnabled = true;
    lyricFx.focusK = -1; // 强制重新聚焦
    if (pageState.currentLyricIndex >= 0) focusLyricLine(pageState.currentLyricIndex);
  }, 3000);
}

function bindLyricManualScroll(container) {
  if (lyricFx.manualBound) return;
  lyricFx.manualBound = true;

  container.addEventListener('wheel', function(e) {
    if (!lyricFx.measured) return;
    e.preventDefault();
    userLyricScrollBegin();
    lyricFx.momentumV = 0;
    lyricFx.targetS = clampLyricS(lyricFx.targetS + e.deltaY);
    retargetLyricItemsNow();
    startLyricWave();
  }, { passive: false });

  container.addEventListener('touchstart', function(e) {
    if (!e.touches || e.touches.length === 0) return;
    lyricFx.touchY = e.touches[0].clientY;
    lyricFx.touchT = performance.now();
    lyricFx.touchV = 0;
    lyricFx.momentumV = 0;
  }, { passive: true });

  container.addEventListener('touchmove', function(e) {
    if (lyricFx.touchY === null || !lyricFx.measured) return;
    var yNow = e.touches[0].clientY;
    var dy = lyricFx.touchY - yNow;
    lyricFx.touchY = yNow;
    var tNow = performance.now();
    var dtm = Math.max(1, tNow - lyricFx.touchT);
    lyricFx.touchT = tNow;
    lyricFx.touchV = (dy / dtm) * 1000;
    userLyricScrollBegin();
    lyricFx.targetS = clampLyricS(lyricFx.targetS + dy);
    retargetLyricItemsNow();
    startLyricWave();
  }, { passive: true });

  container.addEventListener('touchend', function() {
    if (lyricFx.touchY === null) return;
    lyricFx.touchY = null;
    // 甩动惯性
    if (Math.abs(lyricFx.touchV) > 60 && shouldAnimate()) {
      lyricFx.momentumV = lyricFx.touchV;
      lyricFx.touchV = 0;
      startLyricWave();
    }
  }, { passive: true });

  // 尺寸变化时重测布局并复位焦点
  var resizeTimer = null;
  window.addEventListener('resize', function() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      lyricFx.measured = false;
      if (measureLyricLayout()) {
        lyricFx.focusK = -1;
        if (pageState.currentLyricIndex >= 0) {
          focusLyricLine(pageState.currentLyricIndex, true);
        }
      }
    }, 200);
  });
}

// 间奏开始：取消上一句的聚焦（Apple 行为——间奏期间没有「当前句」，
// 上一句降级为已唱过的暗态，高亮与放大都撤掉）
function demoteActiveLyricLineForInterlude() {
  var container = $('lyrics-container');
  if (!container) return;
  var activeLine = container.querySelector('.lyric-line.active');
  if (!activeLine) return;
  var idx = parseInt(activeLine.getAttribute('data-index'), 10);
  activeLine.className = 'lyric-line passed near-1';
  var k = findLyricItemK(idx);
  if (k >= 0) {
    lyricFx.items[k].targetScale = LYRIC_SCALE_INACTIVE;
    if (shouldAnimate()) startLyricWave(); else snapLyricItems();
  }
}

// 间奏呼吸点更新（由 eqTick 15fps 驱动）：进度点亮 + 焦点跟随
function updateInterludeDots() {
  if (!lyricFx.measured) return;
  var dots = lyricFx.dotsItems;
  if (!dots || dots.length === 0) return; // 无间奏的歌零开销
  var posSec = getLyricPosition();
  for (var d0 = 0; d0 < dots.length; d0++) {
    var it = dots[d0];
    // 防御：循环体内的 renderLyrics/demote 可能重建歌词结构，条目失效则跳过
    if (!it || !it.el || !it.el.isConnected) {
      logTickError('dotsItem', new Error('stale dots item ' + d0 + '/' + dots.length));
      continue;
    }
    var k = it._k;
    var inGap = posSec >= it.start && posSec < it.end - 0.4;
    if (inGap !== it.el.classList.contains('active')) {
      it.el.classList.toggle('active', inGap);
      if (inGap) {
        demoteActiveLyricLineForInterlude();
      } else if (posSec >= it.end - 0.45) {
        // 正向结束：预聚焦下一句（不激活），位置跨过后自然点亮，
        // 绝不恢复上一句——避免「闪回前一句再跳到当前句」
        if (pageState.autoScrollEnabled && pageState.lyrics.length > 0) {
          for (var n = 0; n < pageState.lyrics.length; n++) {
            if (pageState.lyrics[n].time >= it.end - 0.05) {
              focusLyricLine(n);
              break;
            }
          }
        }
      } else if (pageState.currentLyricIndex >= 0 && pageState.lyrics.length > 0) {
        // 倒退出间奏（seek 回上一句）：恢复行状态
        renderLyrics(pageState.lyrics, pageState.currentLyricIndex);
      }
    }
    if (inGap) {
      // 三个点按间奏进度依次点亮
      // ⚠️ var 是函数作用域：此处若命名为 dots 会遮蔽外层间奏项数组
      //（曾在进入间奏瞬间把外层循环变量覆盖为 DOM 集合而抛异常，杀死整个 eqTick）
      var p = (posSec - it.start) / Math.max(0.1, it.end - it.start);
      var dotEls = it.el.children;
      for (var d = 0; d < dotEls.length; d++) {
        var on = p >= (d + 0.6) / 3.6;
        if (on !== dotEls[d].classList.contains('on')) dotEls[d].classList.toggle('on', on);
      }
      // Apple 行为：间奏期间焦点移到呼吸点
      if (pageState.autoScrollEnabled && lyricFx.focusK !== k) focusLyricItemK(k);
    }
  }
}

// 渲染歌词 - Apple Music 式：DOM/类名在此维护，位置与缩放由波浪引擎接管
function renderLyrics(lyrics, currentIndex) {
  var container = $('lyrics-container');
  if (!container) return;

  if (!lyrics || lyrics.length === 0) {
    lyricFx.items = [];
    lyricFx.inner = null;
    lyricFx.measured = false;
    lyricFx.focusK = -1;
    stopLyricWave();
    container.innerHTML = '<div class="lyrics-empty">' + t('noLyrics') + '</div>';
    return;
  }

  // 逐字模式：verbatim 与 lyrics 行数一致时启用卡拉OK字级填充
  var isKaraoke = pageState.verbatimLyrics.length > 0 &&
                  pageState.verbatimLyrics.length === lyrics.length;
  container.classList.toggle('karaoke', isKaraoke);

  // 检查是否需要重新渲染整个列表
  var existingLines = container.querySelectorAll('.lyric-line');
  var needsFullRender = existingLines.length !== lyrics.length || !lyricFx.inner;
  // 关键：逐行<->逐字切换时行数可能相同，必须按 word span 是否存在强制重建
  var hasWordSpans = container.querySelector('.lyric-word') !== null;
  if (isKaraoke !== hasWordSpans) needsFullRender = true;
  // 同理：翻译到达/消失时行数也可能相同（状态兜底行 → getLyrics 带翻译行），
  // 按 trans span 是否存在与数据比对，不一致强制重建
  if (!needsFullRender) {
    var wantTrans = false;
    for (var wt = 0; wt < lyrics.length; wt++) {
      if (lyrics[wt].translation) { wantTrans = true; break; }
    }
    var hasTransSpans = container.querySelector('.lyric-trans') !== null;
    if (wantTrans !== hasTransSpans) needsFullRender = true;
  }

  if (needsFullRender) {
    buildLyricDom(container, lyrics, currentIndex, isKaraoke);
  } else {
    // 增量更新类名（模糊/透明度的错峰 cascade 由 CSS transition-delay 完成，
    // 位置/缩放的波浪由引擎完成，不再需要 entering/leaving 类）
    var updateRange = Math.min(6, lyrics.length);
    var startIdx = Math.max(0, currentIndex - updateRange);
    var endIdx = Math.min(lyrics.length, currentIndex + updateRange + 1);

    // 清扫一切范围外的残留 active——不能靠 prevIndex 记账：调用方（verbatim
    // 分支/歌词点击）在调用前已改写 currentLyricIndex，prevIndex 读到的是新值。
    // 大跨度 seek（跳行 >6）时旧激活行不在更新窗口内，残留的 .active 会让
    // updateWordHighlight 按 DOM 序命中旧行 → 真正的当前行永远不填色，
    // 且自愈因「存在激活行」不触发（EXEC_FLIP_FUSIONSPHERE 实测）
    var staleActives = container.querySelectorAll('.lyric-line.active');
    for (var si = 0; si < staleActives.length; si++) {
      var sEl = staleActives[si];
      var sIdx = parseInt(sEl.getAttribute('data-index'), 10);
      if (sIdx !== currentIndex && (sIdx < startIdx || sIdx >= endIdx)) {
        sEl.className = getLyricLineClasses(sIdx, currentIndex);
      }
    }

    for (var i = startIdx; i < endIdx; i++) {
      var el = existingLines[i];
      if (!el) continue;
      var newClassName = getLyricLineClasses(i, currentIndex);
      if (el.className !== newClassName) {
        el.className = newClassName;
      }
    }
  }

  // 焦点跟随：波浪滚动到当前行
  if (pageState.autoScrollEnabled && currentIndex >= 0) {
    focusLyricLine(currentIndex);
  }
}

// 构建歌词 DOM：行 + 间奏呼吸点，全部绝对定位（位置由引擎写 transform）
function buildLyricDom(container, lyrics, currentIndex, isKaraoke) {
  var inner = document.createElement('div');
  inner.className = 'lyrics-inner';
  var items = [];
  // 行数不一致说明 verbatim 与当前行集不对应（如自载酷狗行被外部行集替换），
  // 其时长对不上行时间轴——只有对应时才用它精确判定间奏空窗
  var verbatim = (pageState.verbatimLyrics.length === lyrics.length)
    ? pageState.verbatimLyrics : [];

  function pushDots(start, end) {
    var dotsEl = document.createElement('div');
    dotsEl.className = 'lyric-interlude';
    dotsEl.innerHTML = '<span></span><span></span><span></span>';
    inner.appendChild(dotsEl);
    items.push({
      type: 'dots', idx: -1, el: dotsEl, start: start, end: end,
      y: 0, h: 0, pos: 0, v: 0, scale: 0.9, scaleV: 0, targetScale: 0.9, delayUntil: 0,
    });
  }

  // 前奏：第一句前空窗 > 4s → 呼吸点
  if (lyrics[0].time > 4) pushDots(0.2, lyrics[0].time);

  for (var i = 0; i < lyrics.length; i++) {
    var el = document.createElement('div');
    el.className = getLyricLineClasses(i, currentIndex);
    el.setAttribute('data-index', i);
    el.setAttribute('data-time', lyrics[i].time || 0);
    if (isKaraoke) {
      fillVerbatimLine(el, i);
    } else {
      fillPlainLine(el, lyrics[i].text || '');
    }
    // 翻译副行：常驻 DOM，显隐由容器 show-trans 类控制（开关切换只改类+重测量）
    if (lyrics[i].translation) {
      var trEl = document.createElement('span');
      trEl.className = 'lyric-trans';
      trEl.textContent = lyrics[i].translation;
      el.appendChild(trEl);
    }
    inner.appendChild(el);
    items.push({
      type: 'line', idx: i, el: el, start: 0, end: 0,
      y: 0, h: 0, pos: 0, v: 0,
      scale: i === currentIndex ? 1 : LYRIC_SCALE_INACTIVE, scaleV: 0,
      targetScale: i === currentIndex ? 1 : LYRIC_SCALE_INACTIVE, delayUntil: 0,
    });

    // 间奏：本行唱完到下一行开始空窗 > 6s → 呼吸点（有逐字时长则精确）
    var next = lyrics[i + 1];
    if (next) {
      var lineEnd = (verbatim[i] && verbatim[i].duration)
        ? verbatim[i].time + verbatim[i].duration
        : lyrics[i].time + 3;
      if (next.time - lineEnd > 6) pushDots(lineEnd, next.time);
    }
  }

  container.innerHTML = '';
  container.appendChild(inner);
  container.scrollTop = 0; // 清除旧原生滚动残留偏移（overflow:hidden 仍会保留 scrollTop）
  lyricFx.inner = inner;
  lyricFx.items = items;
  // 间奏点子集缓存（含 items 索引）：15fps 热路径无需全量扫描
  lyricFx.dotsItems = [];
  for (var di = 0; di < items.length; di++) {
    if (items[di].type === 'dots') {
      items[di]._k = di;
      lyricFx.dotsItems.push(items[di]);
    }
  }
  lyricFx.measured = false;
  lyricFx.focusK = -1;
  pageState.lastKaraokeLine = -1;
  stopLyricWave();

  bindLyricClickEvents(container);
  bindLyricManualScroll(container);

  // 初次渲染：直接就位（不做波浪），之后的切行才有波浪
  if (measureLyricLayout()) {
    var k = findLyricItemK(currentIndex >= 0 ? currentIndex : 0);
    if (k < 0) k = 0;
    focusLyricItemK(k, true);
  }
}

// 获取歌词行的类名 - 优化版：使用字符串拼接替代数组
function getLyricLineClasses(index, currentIndex) {
  var cls = 'lyric-line';
  var distance = currentIndex >= 0 ? Math.abs(index - currentIndex) : 999;
  
  if (index === currentIndex) {
    cls += ' active';
  } else if (currentIndex >= 0 && index < currentIndex) {
    cls += ' passed';
  }
  
  // 距离渐变效果
  if (distance === 1) cls += ' near-1';
  else if (distance === 2) cls += ' near-2';
  else if (distance === 3) cls += ' near-3';
  
  return cls;
}

// 绑定歌词点击事件 - 事件委托
function bindLyricClickEvents(container) {
  // 移除旧的监听器（如果有）
  container.removeEventListener('click', handleLyricClick);
  // 添加新的监听器
  container.addEventListener('click', handleLyricClick);
}

// 处理歌词点击 - 优化版
function handleLyricClick(e) {
  var target = e.target.closest('.lyric-line');

  if (target) {
    var time = parseFloat(target.getAttribute('data-time'));
    if (!isNaN(time) && time >= 0) {
      // 跳转到对应时间
      Tapp.media.seek(time);
      // Apple Music 行为：点按的行成为当前行后立即弹簧吸附到焦点位
      // （清掉滚轮打断的暂停状态，让 seek 后的渲染立刻跟随）
      if (lyricResumeTimer) {
        clearTimeout(lyricResumeTimer);
        lyricResumeTimer = null;
      }
      pageState.autoScrollEnabled = true;
      // 本地先行：立即切时钟并重渲染高亮，不等状态事件回包。
      // 消除竞态窗口（旧时钟/间奏降级与 seek 交错会吞掉 active 类）
      setLyricClock(time + 0.01, lyricClock.playing);
      if (pageState.lyrics.length > 0) {
        var idx = updateLyricIndex(time + 0.01, pageState.lyrics);
        pageState.currentLyricIndex = idx;
        renderLyrics(pageState.lyrics, idx);
      }
    }
  }
}

// ========================================
// 逐字歌词（卡拉OK）
// ========================================

// 用 word span 填充一行（DOM 方式，避免注入）
// 计算完整括号组的锚点映射：anchors[i] = i（普通词）或锚点词索引（括号词）。
// 完整的（…）/(…) 组不作为独立标亮实体——跟随组前最近的普通词一起标亮；
// 行首的括号组锚定到组后第一个词；不完整括号（没配对）不处理。
function computeParenAnchors(words) {
  var n = words.length;
  var anchors = new Array(n);
  var i;
  for (i = 0; i < n; i++) anchors[i] = i;

  // 扫描配对完整的括号组（词粒度：组含开括号词到闭括号词）
  var groups = [];
  var depth = 0;
  var groupStart = -1;
  for (i = 0; i < n; i++) {
    var t = words[i].text || '';
    for (var c = 0; c < t.length; c++) {
      var ch = t.charAt(c);
      if (ch === '（' || ch === '(') {
        if (depth === 0) groupStart = i;
        depth++;
      } else if (ch === '）' || ch === ')') {
        if (depth > 0) {
          depth--;
          if (depth === 0 && groupStart >= 0) {
            groups.push([groupStart, i]);
            groupStart = -1;
          }
        }
      }
    }
  }

  var resolved = [];
  for (var g = 0; g < groups.length; g++) {
    var s = groups[g][0];
    var e = groups[g][1];
    // 锚点 = 组前最近的非括号词
    var a = s - 1;
    while (a >= 0 && anchors[a] !== a) a--;
    if (a < 0) a = e + 1 < n ? e + 1 : -1; // 行首组 → 锚定组后第一个词
    if (a >= 0) {
      for (i = s; i <= e; i++) anchors[i] = a;
      resolved.push({ start: s, end: e, anchor: a });
    }
  }
  return { anchors: anchors, groups: resolved };
}

// 括号内容宽度单位：CJK/全角记 2、半角记 1（6 个汉字 ≈ 12 个半角字符）
function parenContentUnits(s) {
  var t = (s || '').replace(/[（）()\s]/g, '');
  var u = 0;
  for (var i = 0; i < t.length; i++) u += t.charCodeAt(i) > 0xFF ? 2 : 1;
  return u;
}
// 子行最小内容阈值：低于此宽度不值得独立成行，回退为行内跟随
var SUBLINE_MIN_UNITS = 12;

// 行尾括号组：）之后没有正文（仅空白）且内容足够长，返回该组 {start,end}，否则 null
function findEndParenGroup(v) {
  if (!v || !v._groups || !v.words) return null;
  var found = null;
  for (var g = 0; g < v._groups.length; g++) {
    var G = v._groups[g];
    if (G.start <= 0) continue; // 整行都是括号 → 不特殊处理
    var trailingEmpty = true;
    for (var q = G.end + 1; q < v.words.length; q++) {
      if (((v.words[q].text || '').replace(/\s/g, '')) !== '') {
        trailingEmpty = false;
        break;
      }
    }
    if (!trailingEmpty) continue;
    // 内容太短（< 6 全角 / 12 半角）→ 不视为子行，维持行内跟随
    var gtxt = '';
    for (var w2 = G.start; w2 <= G.end; w2++) gtxt += v.words[w2].text || '';
    if (parenContentUnits(gtxt) < SUBLINE_MIN_UNITS) continue;
    found = G;
  }
  return found;
}

function fillVerbatimLine(el, index) {
  var v = pageState.verbatimLyrics[index];
  el.textContent = '';
  if (!v || !v.words || v.words.length === 0) {
    el.textContent = (pageState.lyrics[index] && pageState.lyrics[index].text) || '';
    return;
  }
  // 括号组锚点（每行只算一次，缓存在 verbatim 行对象上）
  if (!v._anchors) {
    var parsed = computeParenAnchors(v.words);
    v._anchors = parsed.anchors;
    v._groups = parsed.groups;
  }
  // 行尾括号组：单独分一小行（子行）同步显示，首尾括号字符不显示
  var endGrp = findEndParenGroup(v);
  var endStart = endGrp ? endGrp.start : -1;
  var frag = document.createDocumentFragment();
  var target = frag;
  var spanCount = 0;
  for (var k = 0; k < v.words.length; k++) {
    if (k === endStart) {
      var sub = document.createElement('span');
      sub.className = 'lyric-subline';
      frag.appendChild(sub);
      target = sub;
    }
    var cls = v._anchors[k] !== k ? 'lyric-word paren' : 'lyric-word';
    var txt = v.words[k].text;
    // 子行剥掉开/闭括号字符（组首词去第一个开括号，组尾词去最后一个闭括号）
    if (endGrp) {
      if (k === endGrp.start) txt = txt.replace(/[（(]/, '');
      if (k === endGrp.end) {
        var ci = Math.max(txt.lastIndexOf('）'), txt.lastIndexOf(')'));
        if (ci >= 0) txt = txt.slice(0, ci) + txt.slice(ci + 1);
      }
    }
    // 多字符 token（英文单词/多字组）拆成逐字符 span：
    // 每个字母成为独立的填充与上浮单元 → 上浮行波按字母依次升起。
    // 外包 nowrap 容器避免单词中间被换行拆断。
    if (txt && txt.length > 1) {
      var wrap = document.createElement('span');
      wrap.className = 'lyric-wordwrap';
      for (var c2 = 0; c2 < txt.length; c2++) {
        var chSpan = document.createElement('span');
        chSpan.className = cls;
        chSpan.setAttribute('data-w', k);
        chSpan.textContent = txt.charAt(c2);
        wrap.appendChild(chSpan);
        spanCount++;
      }
      target.appendChild(wrap);
    } else {
      var span = document.createElement('span');
      span.className = cls;
      span.setAttribute('data-w', k);
      span.textContent = txt;
      target.appendChild(span);
      spanCount++;
    }
  }
  v._spanCount = spanCount;
  el.appendChild(frag);
}

// 逐行模式：把完整括号段包成缩小的 span（DOM 方式，避免注入）
function fillPlainLine(el, text) {
  el.textContent = '';
  var re = /（[^（）]*）|\([^()]*\)/g;
  var last = 0;
  var m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
    var sp = document.createElement('span');
    // 行尾括号段（其后仅空白）且内容够长 → 独立子行显示，且不显示首尾括号字符
    var after = text.slice(m.index + m[0].length);
    var isTail = after.replace(/\s/g, '') === '' &&
                 parenContentUnits(m[0]) >= SUBLINE_MIN_UNITS;
    sp.className = isTail ? 'lyric-paren lyric-subline' : 'lyric-paren';
    sp.textContent = isTail
      ? m[0].replace(/^[（(]/, '').replace(/[）)]$/, '')
      : m[0];
    el.appendChild(sp);
    last = m.index + m[0].length;
  }
  if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
}

// 插值时钟：状态事件低频，用 base+时间戳插值出平滑播放位置
var lyricClock = { base: 0, at: 0, playing: false, drift: 0 };
function nowMs() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now() : Date.now();
}
// 平滑时钟：状态事件的 position 与本地插值总有小偏差，若每次硬重置，
// 填充边缘会每秒微跳/回退。小偏差记为 drift 由读取端逐帧吸收（保持连续单调），
// 只有大跳变（seek / 暂停恢复）才硬重置。
function setLyricClock(position, playing) {
  var now = nowMs();
  var p = position || 0;
  if (lyricClock.playing && playing) {
    var interp = lyricClock.base + (now - lyricClock.at) / 1000;
    var diff = p - interp;
    if (Math.abs(diff) < 0.35) {
      lyricClock.base = interp;
      lyricClock.at = now;
      lyricClock.drift = diff;
      return;
    }
  }
  lyricClock.base = p;
  lyricClock.at = now;
  lyricClock.playing = !!playing;
  lyricClock.drift = 0;
}
function getLyricPosition() {
  if (!lyricClock.playing) return lyricClock.base;
  // 每帧吸收 6% 残余偏差（60fps 下约 0.25s 半衰期），肉眼不可见
  if (lyricClock.drift) {
    var eat = lyricClock.drift * 0.06;
    lyricClock.drift -= eat;
    lyricClock.base += eat;
    if (Math.abs(lyricClock.drift) < 0.001) lyricClock.drift = 0;
  }
  return lyricClock.base + (nowMs() - lyricClock.at) / 1000;
}

// CSS 式 cubic-bezier(x1,y1,x2,y2) 求值器（牛顿迭代解 t），用于 JS 驱动的每帧动画
function cubicBezier(x1, y1, x2, y2) {
  function A(a, b) { return 1 - 3 * b + 3 * a; }
  function B(a, b) { return 3 * b - 6 * a; }
  function C(a) { return 3 * a; }
  function calcX(t) { return ((A(x1, x2) * t + B(x1, x2)) * t + C(x1)) * t; }
  function calcY(t) { return ((A(y1, y2) * t + B(y1, y2)) * t + C(y1)) * t; }
  function slopeX(t) { return 3 * A(x1, x2) * t * t + 2 * B(x1, x2) * t + C(x1); }
  return function (x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var t = x;
    for (var i = 0; i < 5; i++) {
      var s = slopeX(t);
      if (s < 1e-6) break;
      t -= (calcX(t) - x) / s;
    }
    return calcY(t);
  };
}

// 逐字上浮曲线：弹簧式缓出（轻微过冲 ~10% 后落定，Apple 式 pop）
var wordLiftEase = cubicBezier(0.34, 1.56, 0.64, 1);
// 逐字上浮距离（px）
var WORD_LIFT_PX = 1.4;
// 上浮行波宽度（px）：边缘行进这么多像素完成一个字的升起，与词宽无关。
// 取 ~2 个全角字宽：相邻字同时处于过渡带，波形连绵而非逐个弹起
var LIFT_WAVE_PX = 88;
// 瞬态膨胀幅度：唱到时轻微鼓起（峰值在波中心），唱完回落到 1（抬升则保持）。
// 注意别调大：回落时字形顶部会下降（≈幅度×字高），过大会产生下坠感
var LIFT_SWELL = 0.018;

// ========================================
// 连续边缘卡拉OK引擎
// 整行视作一条「时间 → 展开像素坐标」的连续时间轴：
//   - 每个词在句中的像素区间（累计宽度，换行不影响）× 时间区间构成分段线性映射
//   - 括号组与锚点词合并为同一时间段（一条边缘顺序扫过锚点词+组）
//   - 渲染边缘用一阶迟滞（τ≈90ms）追踪目标 → 速度连续，
//     词间微停顿被吸收，高亮永不生硬停顿（顿挫感消除）
// ========================================

var karaokeGeo = {
  idx: -1,      // 已建几何的行索引
  width: 0,     // 建几何时的行宽（变化则重建）
  lineEl: null, // 激活行元素缓存（避免每帧 querySelector）
  spans: null,  // span 数组快照（避免每帧访问 live collection）
  cumX: null,   // 每 span 的展开 x 起点
  widths: null, // 每 span 像素宽
  segs: null,   // 主链时间段: { ts, te, xs, xe }
  mainTotal: 0, // 主链（正文）总宽
  endStart: -1, // 行尾括号组起始 span 索引（-1 = 无）
  groupBase: 0, // 行尾组在展开坐标系中的起点
  groupTotal: 0,// 行尾组总宽
  edgeX: -20,   // 平滑后的渲染边缘
  lastT: 0,
  // 写入去重缓存（量化值，NaN = 未写过）
  lastFp: null,
  lastLy: null,
  lastSw: null,
};

function buildKaraokeGeo(v, words) {
  // words = 渲染 span 集合（多字符 token 已拆为逐字符 span），
  // 通过 data-w 映射回 v.words 的时间轴索引
  var cumX = [];
  var widths = [];
  var wordOf = [];
  var total = 0;
  var i;
  for (i = 0; i < words.length; i++) {
    cumX.push(total);
    var wpx = words[i].offsetWidth || 0;
    widths.push(wpx);
    var dw = parseInt(words[i].getAttribute('data-w'), 10);
    wordOf.push(isNaN(dw) ? 0 : dw);
    total += wpx;
  }

  // 行尾括号组：不并入主链，与正文整体同步点亮（渲染为独立子行）
  var endGrp = findEndParenGroup(v);
  var endStartWord = endGrp ? endGrp.start : -1;
  // 词索引 → span 边界
  var endStart = -1;
  if (endStartWord >= 0) {
    for (i = 0; i < words.length; i++) {
      if (wordOf[i] >= endStartWord) {
        endStart = i;
        break;
      }
    }
  }
  var mainCount = endStart >= 0 ? endStart : words.length;

  // 按时间归属合并主链连续 span（同词的字母 + 锚点词与其中段括号组 共享时间窗）
  var anchors = v._anchors;
  var segs = [];
  i = 0;
  while (i < mainCount) {
    var owner = anchors ? anchors[wordOf[i]] : wordOf[i];
    var j = i;
    while (j + 1 < mainCount &&
           (anchors ? anchors[wordOf[j + 1]] : wordOf[j + 1]) === owner) j++;
    var ow = v.words[owner];
    segs.push({
      ts: ow.time,
      te: ow.time + Math.max(0.08, ow.duration || 0),
      xs: cumX[i],
      xe: cumX[j] + widths[j],
    });
    i = j + 1;
  }

  karaokeGeo.cumX = cumX;
  karaokeGeo.widths = widths;
  karaokeGeo.segs = segs;
  karaokeGeo.endStart = endStart;
  if (endStart >= 0) {
    karaokeGeo.mainTotal = cumX[endStart];
    karaokeGeo.groupBase = cumX[endStart];
    karaokeGeo.groupTotal = total - cumX[endStart];
  } else {
    karaokeGeo.mainTotal = total;
    karaokeGeo.groupBase = 0;
    karaokeGeo.groupTotal = 0;
  }
}

// 时间 → 目标边缘位置（分段线性；段间间隙停在上一段末端，由迟滞平滑衔接）
function karaokeEdgeTarget(t) {
  var segs = karaokeGeo.segs;
  if (!segs || segs.length === 0) return -20;
  if (t < segs[0].ts) return -20;
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i];
    if (t < s.ts) return segs[i - 1].xe;
    if (t < s.te) {
      var p = (t - s.ts) / (s.te - s.ts);
      return s.xs + p * (s.xe - s.xs);
    }
  }
  return karaokeGeo.mainTotal + 20;
}

// 更新激活行的字级填充（仅操作当前 active 行，开销极小）
function updateWordHighlight(position) {
  if (pageState.verbatimLyrics.length === 0) return;
  var container = $('lyrics-container');
  if (!container) return;

  // 激活行缓存：仍连接且仍 active 就跳过 querySelector（60fps 热路径，避免每帧扫行列表）
  var activeLine = karaokeGeo.lineEl;
  if (!activeLine || !activeLine.isConnected || !activeLine.classList.contains('active')) {
    activeLine = container.querySelector('.lyric-line.active');
    var newIdx = activeLine ? parseInt(activeLine.getAttribute('data-index'), 10) : -1;

    // 激活行切换：清理上一激活行的内联样式，令其回落到 CSS(.passed=全填充)
    if (pageState.lastKaraokeLine !== newIdx && pageState.lastKaraokeLine >= 0) {
      var prev = container.querySelector('.lyric-line[data-index="' + pageState.lastKaraokeLine + '"]');
      if (prev) {
        var pw = prev.getElementsByClassName('lyric-word');
        for (var j = 0; j < pw.length; j++) {
          pw[j].style.removeProperty('--fp');
          pw[j].style.removeProperty('transform');
          pw[j].classList.remove('singing');
        }
      }
    }
    pageState.lastKaraokeLine = newIdx;
    karaokeGeo.lineEl = activeLine;
    karaokeGeo.idx = -1; // 行（或其 DOM 实例）变化：几何与写入缓存重建
    if (!activeLine || newIdx < 0) return;
  }

  var idx = pageState.lastKaraokeLine;
  var v = pageState.verbatimLyrics[idx];
  if (!v || !v.words) return;

  // 几何缓存：行/DOM 变化或行宽变化（resize/换字号）时重建
  var lw = activeLine.offsetWidth || 0;
  if (lw < 10) return; // 面板隐藏（移动端常态）：跳过，避免每帧用 0 宽空转重建
  if (karaokeGeo.idx !== idx || karaokeGeo.width !== lw) {
    var words = activeLine.getElementsByClassName('lyric-word');
    // span 数与构建时记录的一致才渲染（多字符 token 已拆为逐字符 span）
    if (!v._spanCount || words.length !== v._spanCount) return;
    buildKaraokeGeo(v, words);
    // span 快照为数组（避免每帧访问 live collection）+ 写入去重缓存（NaN = 未写过）
    var n = words.length;
    karaokeGeo.spans = new Array(n);
    karaokeGeo.lastFp = new Array(n);
    karaokeGeo.lastLy = new Array(n);
    karaokeGeo.lastSw = new Array(n);
    for (var s0 = 0; s0 < n; s0++) {
      karaokeGeo.spans[s0] = words[s0];
      karaokeGeo.lastFp[s0] = NaN;
      karaokeGeo.lastLy[s0] = NaN;
      karaokeGeo.lastSw[s0] = NaN;
    }
    karaokeGeo.idx = idx;
    karaokeGeo.width = lw;
    karaokeGeo.edgeX = karaokeEdgeTarget(position); // 初始直接就位，不做开场横扫
    karaokeGeo.lastT = nowMs();
  }
  if (!karaokeGeo.spans) return;

  // 一阶迟滞追踪目标边缘：速度连续，微停顿被吸收；seek 级大跳直接吸附
  var nowT = nowMs();
  var dt = Math.min(0.1, (nowT - karaokeGeo.lastT) / 1000);
  karaokeGeo.lastT = nowT;
  var target = karaokeEdgeTarget(position);
  if (Math.abs(target - karaokeGeo.edgeX) > 240) {
    karaokeGeo.edgeX = target;
  } else {
    karaokeGeo.edgeX += (target - karaokeGeo.edgeX) * (1 - Math.exp(-dt / 0.09));
  }
  var X = karaokeGeo.edgeX;

  // 行尾括号组：填充比例与正文边缘同步（正文唱到几成，尾组亮到几成）
  var endStart = karaokeGeo.endStart;
  var Xg = 0;
  if (endStart >= 0) {
    var f = (X + 20) / (karaokeGeo.mainTotal + 40);
    f = f < 0 ? 0 : (f > 1 ? 1 : f);
    Xg = f * (karaokeGeo.groupTotal + 24) - 12;
  }

  // 逐词渲染：--fp = 边缘在词内的局部坐标（±12px 恒定羽化）
  // 上浮 = 以词中心为基准的固定宽度行波（LIFT_WAVE_PX），随边缘一起平移。
  // 性能：写入量化去重——稳态 span（已唱完/未唱到）每帧零 DOM 操作，
  // 只有羽化区/上浮波内的少数 span 真正写样式（量化精度低于亚像素，视觉无差）
  var allowLift = shouldAnimate();
  var spans = karaokeGeo.spans;
  var lastFp = karaokeGeo.lastFp;
  var lastLy = karaokeGeo.lastLy;
  var lastSw = karaokeGeo.lastSw;
  for (var i = 0; i < spans.length; i++) {
    var el = spans[i];
    var wpx = karaokeGeo.widths[i];
    var local = (endStart >= 0 && i >= endStart)
      ? Xg - (karaokeGeo.cumX[i] - karaokeGeo.groupBase)
      : X - karaokeGeo.cumX[i];

    // 填充与光晕（--fp 量化到 0.1px；哨兵 ±1e9 = 整字实色/未唱色）
    var fp;
    if (local >= wpx + 12) fp = 1e9;
    else if (local > -12) fp = Math.round(local * 10) / 10;
    else fp = -1e9;
    if (fp !== lastFp[i]) {
      lastFp[i] = fp;
      el.style.setProperty('--fp', fp === 1e9 ? '9999px' : (fp === -1e9 ? '-9999px' : fp + 'px'));
      var singNow = fp !== 1e9 && fp !== -1e9;
      if (singNow !== el.classList.contains('singing')) el.classList.toggle('singing', singNow);
    }

    // 上浮行波 + 瞬态膨胀（translateY 量化 0.01px、scale 量化 1e-4）
    if (allowLift) {
      var lp = (local - wpx / 2 + LIFT_WAVE_PX / 2) / LIFT_WAVE_PX;
      lp = lp < 0 ? 0 : (lp > 1 ? 1 : lp);
      var ly;
      var sw;
      if (lp > 0.001) {
        ly = Math.round(-WORD_LIFT_PX * wordLiftEase(lp) * 100);
        sw = lp < 0.999
          ? Math.round((1 + LIFT_SWELL * Math.sin(Math.PI * lp)) * 10000)
          : 10000;
      } else {
        ly = 0;
        sw = 10000;
      }
      if (ly !== lastLy[i] || sw !== lastSw[i]) {
        lastLy[i] = ly;
        lastSw[i] = sw;
        if (ly === 0 && sw === 10000) {
          el.style.removeProperty('transform');
        } else {
          var tf = 'translateY(' + (ly / 100).toFixed(2) + 'px)';
          if (sw !== 10000) tf += ' scale(' + (sw / 10000).toFixed(4) + ')';
          el.style.transform = tf;
        }
      }
    }
  }
}

// 循环异常记录（每类只记一次，避免刷屏；同时保证循环不死）
var tickErrLogged = {};
function logTickError(key, e) {
  if (tickErrLogged[key]) return;
  tickErrLogged[key] = true;
  try { console.error('[music-player] ' + key + ' error:', e); } catch (e2) {}
}

// 逐字高亮 rAF 循环（仅逐字模式 + 播放中运行）
// 防崩溃壳：任何一帧异常只丢弃该帧并记录，循环继续——
// 否则一次瞬时异常会让循环静默死亡且句柄残留，ensure 守卫永远无法重启（填色永久失效）
function lyricWordTick() {
  if (pageState.verbatimLyrics.length === 0 || !lyricClock.playing) {
    pageState.lyricWordFrame = null;
    return;
  }
  try {
    updateWordHighlight(getLyricPosition());
  } catch (e) {
    logTickError('lyricWordTick', e);
  }
  pageState.lyricWordFrame = requestAnimationFrame(lyricWordTick);
}
function ensureLyricWordLoop() {
  if (pageState.verbatimLyrics.length > 0 && lyricClock.playing && !pageState.lyricWordFrame) {
    pageState.lyricWordFrame = requestAnimationFrame(lyricWordTick);
  }
}

// 为指定曲目加载逐字歌词（切歌时调用）
function loadLyricsForTrack(track) {
  if (!track || !track.id) return;
  if (pageState.lyricsSongId === track.id) return; // 已加载
  // 防御旧版 SDK（前端 bundle 未更新时 getLyrics 不存在）：优雅回退逐行
  if (!Tapp.media || typeof Tapp.media.getLyrics !== 'function') {
    console.warn('[music-player] Tapp.media.getLyrics 不可用（前端 SDK 需重新构建/刷新），回退逐行歌词');
    return;
  }
  pageState.lyricsSongId = track.id;
  Tapp.media.getLyrics({ songId: track.id, source: track.source }).then(function(res) {
    try { console.debug('[music-player] getLyrics', track.id, 'verbatim=', res && res.verbatim ? res.verbatim.length : 0, 'lines=', res && res.lines ? res.lines.length : 0); } catch (e) {}
    if (!res) {
      // 无效回包：撤销标记，下一次状态事件自动重试（否则该曲逐字永久失效）
      if (pageState.lyricsSongId === track.id) pageState.lyricsSongId = null;
      return;
    }
    if (pageState.lyricsSongId !== track.id) return; // 期间已切歌，丢弃

    var verbatim = (res.verbatim && res.verbatim.length) ? res.verbatim : [];
    if (verbatim.length > 0) {
      pageState.verbatimLyrics = verbatim;
      pageState.lyrics = verbatim.map(function(v) {
        return { time: v.time, text: v.text, translation: v.translation };
      });
    } else {
      pageState.verbatimLyrics = [];
      if (res.lines && res.lines.length) pageState.lyrics = res.lines;
    }

    // 翻译可用性（各行 translation 已由桥接层按时间对齐嵌入）
    pageState.hasTranslation = !!res.hasTranslation;
    pageState.transLang = res.translationLang || '';
    syncLyricTransUI();

    var st = pageState.status || {};
    var pos = st.position || (st.progress ? st.progress.current : 0) || 0;
    var idx = updateLyricIndex(pos, pageState.lyrics);
    pageState.currentLyricIndex = idx;
    pageState.lastKaraokeLine = -1;
    renderLyrics(pageState.lyrics, idx);
    if (pageState.verbatimLyrics.length > 0) {
      setLyricClock(pos, st.isPlaying);
      updateWordHighlight(pos);
      ensureLyricWordLoop();
    }
  }).catch(function() {
    // 逐字失败：保持逐行兜底，并撤销标记允许重试
    pageState.verbatimLyrics = [];
    pageState.hasTranslation = false;
    syncLyricTransUI();
    if (pageState.lyricsSongId === track.id) pageState.lyricsSongId = null;
  });
}

// ========================================
// 虚拟滚动播放列表
// ========================================

var virtualList = {
  container: null,
  scrollContainer: null,
  innerWrapper: null,
  contentWrapper: null,
  itemHeight: 56, // 每项高度（初始估算，首帧后按真实高度校正）
  measured: false, // 是否已按真实 DOM 高度校正 itemHeight
  bufferSize: 18, // 上下预载缓冲区（加大，滚动更顺、无空白）
  visibleStart: 0,
  visibleEnd: 0,
  data: [],
  currentTrackId: null,
  searchQuery: '',
  scrollHandler: null,
  pendingScrollToCurrent: false, // 面板首次可见时滚动到当前歌曲
  // DOM缓存池
  itemPool: [],
  activeItems: new Map(), // index -> DOM element
  lastTotalHeight: 0,
  isRendering: false
};

// 初始化虚拟列表
function initVirtualList() {
  virtualList.scrollContainer = document.querySelector('.playlist-scroll');
  virtualList.container = $('playlist-container');
  
  if (!virtualList.scrollContainer || !virtualList.container) return;
  
  // 创建固定的容器结构（只创建一次）
  if (!virtualList.innerWrapper) {
    // 先清空容器（移除 playlist-empty 等旧内容）
    virtualList.container.innerHTML = '';
    
    virtualList.innerWrapper = document.createElement('div');
    virtualList.innerWrapper.style.cssText = 'position:relative;width:100%;';
    
    virtualList.contentWrapper = document.createElement('div');
    virtualList.contentWrapper.style.cssText = 'position:absolute;left:0;right:0;';
    
    virtualList.innerWrapper.appendChild(virtualList.contentWrapper);
    virtualList.container.appendChild(virtualList.innerWrapper);

    // 点击/触摸委托绑定在常驻容器上（幂等）
    bindPlaylistActivation();
  }
  
  // 移除旧的滚动监听
  if (virtualList.scrollHandler) {
    virtualList.scrollContainer.removeEventListener('scroll', virtualList.scrollHandler);
  }
  
  // 添加滚动监听（使用节流）
  var lastScrollTime = 0;
  virtualList.scrollHandler = function() {
    var now = Date.now();
    if (now - lastScrollTime < 16) return; // ~60fps
    lastScrollTime = now;
    
    if (!virtualList.isRendering) {
      requestAnimationFrame(renderVisibleItems);
    }
  };
  
  virtualList.scrollContainer.addEventListener('scroll', virtualList.scrollHandler, { passive: true });
}

// 列表项骨架（封面+覆盖层 / 信息 / 时长）
var PLAYLIST_ITEM_HTML =
  '<div class="playlist-item-cover-wrap">' +
    '<img class="playlist-item-cover" loading="lazy" alt="">' +
    '<div class="playlist-item-cover-overlay">' +
      '<svg class="play-ico" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
      '<div class="eq"><span></span><span></span><span></span></div>' +
    '</div>' +
  '</div>' +
  '<div class="playlist-item-info">' +
    '<div class="playlist-item-name-row">' +
      '<div class="playlist-item-name"></div>' +
      '<span class="playlist-item-vip" style="display:none"></span>' +
    '</div>' +
    '<div class="playlist-item-artist"></div>' +
  '</div>' +
  '<div class="playlist-item-duration"></div>';

// 填充列表项内容（供虚拟列表与整表渲染共用）
function fillPlaylistItem(el, song) {
  var cover = el.querySelector('.playlist-item-cover');
  if (cover) {
    if (song.cover) {
      cover.src = song.cover;
      cover.style.display = 'block';
    } else {
      cover.removeAttribute('src');
      cover.style.display = 'none';
    }
  }
  var nameEl = el.querySelector('.playlist-item-name');
  if (nameEl) { nameEl.textContent = song.name || ''; nameEl.title = song.name || ''; }
  var artistEl = el.querySelector('.playlist-item-artist');
  if (artistEl) { artistEl.textContent = song.artist || ''; artistEl.title = song.artist || ''; }
  var durEl = el.querySelector('.playlist-item-duration');
  if (durEl) durEl.textContent = song.duration ? formatTime(song.duration) : '';
  var vipEl = el.querySelector('.playlist-item-vip');
  if (vipEl) {
    if (song.isVip) {
      vipEl.textContent = t('vip');
      vipEl.className = 'playlist-item-vip vip';
      vipEl.style.display = '';
    } else if (song.isTrial) {
      vipEl.textContent = t('trial');
      vipEl.className = 'playlist-item-vip trial';
      vipEl.style.display = '';
    } else {
      vipEl.style.display = 'none';
    }
  }
}

// 从对象池获取或创建DOM元素
function getPooledItem() {
  if (virtualList.itemPool.length > 0) {
    return virtualList.itemPool.pop();
  }

  var el = document.createElement('div');
  el.className = 'playlist-item';
  el.innerHTML = PLAYLIST_ITEM_HTML;
  return el;
}

// 更新DOM元素内容
function updateItemContent(el, song, isActive) {
  // 只在内容变化时更新
  if (el.getAttribute('data-id') !== song.id) {
    el.setAttribute('data-id', song.id);
    el.setAttribute('data-index', song.originalIndex);
    fillPlaylistItem(el, song);
  }

  // 更新激活状态
  el.classList.toggle('active', !!isActive);
}

// 渲染可见项
function renderVisibleItems() {
  virtualList.isRendering = true;
  
  if (!virtualList.contentWrapper || !virtualList.scrollContainer) {
    virtualList.isRendering = false;
    return;
  }
  if (virtualList.data.length === 0) {
    virtualList.isRendering = false;
    return;
  }
  
  var scrollTop = virtualList.scrollContainer.scrollTop;
  var containerHeight = virtualList.scrollContainer.clientHeight;
  // 面板隐藏时 clientHeight 为 0，用较大回退值避免只渲染极少数项
  if (!containerHeight) containerHeight = 800;
  var itemHeight = virtualList.itemHeight;
  var bufferSize = virtualList.bufferSize;
  var dataLen = virtualList.data.length;

  var startIndex = Math.max(0, (scrollTop / itemHeight | 0) - bufferSize);
  var endIndex = Math.min(dataLen, ((scrollTop + containerHeight) / itemHeight | 0) + bufferSize + 1);
  
  // 如果范围没变，只检查激活状态
  if (startIndex === virtualList.visibleStart && endIndex === virtualList.visibleEnd) {
    // 快速更新激活状态
    virtualList.activeItems.forEach(function(el, idx) {
      var song = virtualList.data[idx];
      if (song) {
        var isActive = virtualList.currentTrackId && song.id === virtualList.currentTrackId;
        if (isActive !== el.classList.contains('active')) {
          el.classList.toggle('active', isActive);
        }
      }
    });
    virtualList.isRendering = false;
    return;
  }
  
  var prevStart = virtualList.visibleStart;
  var prevEnd = virtualList.visibleEnd;
  virtualList.visibleStart = startIndex;
  virtualList.visibleEnd = endIndex;
  
  // 更新容器高度
  var totalHeight = dataLen * itemHeight;
  if (totalHeight !== virtualList.lastTotalHeight) {
    virtualList.innerWrapper.style.height = totalHeight + 'px';
    virtualList.lastTotalHeight = totalHeight;
  }
  
  // 更新内容偏移
  virtualList.contentWrapper.style.top = (startIndex * itemHeight) + 'px';
  
  // 回收不再可见的元素
  virtualList.activeItems.forEach(function(el, idx) {
    if (idx < startIndex || idx >= endIndex) {
      virtualList.itemPool.push(el);
      virtualList.activeItems.delete(idx);
      if (el.parentNode) el.parentNode.removeChild(el);
    }
  });
  
  // 渲染可见元素
  var fragment = null;
  var needsAppend = false;
  
  for (var i = startIndex; i < endIndex; i++) {
    var song = virtualList.data[i];
    var isActive = virtualList.currentTrackId && song.id === virtualList.currentTrackId;
    
    var el = virtualList.activeItems.get(i);
    if (!el) {
      el = getPooledItem();
      virtualList.activeItems.set(i, el);
      
      if (!fragment) fragment = document.createDocumentFragment();
      fragment.appendChild(el);
      needsAppend = true;
    }
    
    updateItemContent(el, song, isActive);
  }
  
  if (needsAppend && fragment) {
    virtualList.contentWrapper.appendChild(fragment);
  }

  // 首帧渲染后按真实 DOM 高度校正 itemHeight（估算值 56 与实际行高常有偏差，
  // 偏差会导致总高算短、末尾歌曲滚不到，即“默认没显示全歌曲”）
  if (!virtualList.measured && virtualList.activeItems.size > 0) {
    var probe = virtualList.activeItems.values().next().value;
    if (probe && probe.offsetHeight > 0) {
      virtualList.measured = true;
      var realHeight = probe.offsetHeight;
      if (Math.abs(realHeight - virtualList.itemHeight) >= 1) {
        virtualList.itemHeight = realHeight;
        virtualList.lastTotalHeight = 0; // 强制更新总高
        virtualList.visibleStart = -1;   // 强制用正确高度重算
        virtualList.visibleEnd = -1;
        virtualList.isRendering = false;
        renderVisibleItems();
        return;
      }
    }
  }

  // 面板首次可见时，滚动到当前播放歌曲附近
  if (virtualList.pendingScrollToCurrent && virtualList.currentTrackId &&
      virtualList.scrollContainer.clientHeight > 0) {
    var curIdx = -1;
    for (var k = 0; k < dataLen; k++) {
      if (virtualList.data[k].id === virtualList.currentTrackId) { curIdx = k; break; }
    }
    if (curIdx >= 0) {
      virtualList.pendingScrollToCurrent = false;
      var target = Math.max(0, curIdx * virtualList.itemHeight -
        virtualList.scrollContainer.clientHeight / 2 + virtualList.itemHeight / 2);
      if (Math.abs(virtualList.scrollContainer.scrollTop - target) > 1) {
        virtualList.scrollContainer.scrollTop = target;
        virtualList.visibleStart = -1; // 新位置需重渲，避免空白
        virtualList.visibleEnd = -1;
        virtualList.isRendering = false;
        renderVisibleItems();
        return;
      }
    }
  }

  virtualList.isRendering = false;
}

// 重算虚拟列表可见项（修正真实高度与范围），不改动滚动位置 —— 用于 resize
function refreshPlaylistView() {
  if (!virtualList.contentWrapper || virtualList.data.length === 0) return;
  virtualList.measured = false;  // 允许重新测量真实高度
  virtualList.visibleStart = -1; // 强制重算可见范围
  virtualList.visibleEnd = -1;
  renderVisibleItems();
}

// 播放列表点击/触摸委托 —— 绑定一次到常驻容器
// 用 touchend + click 双通道，兼容 webview 里 click 事件不稳定的情况（切歌失效根因）
var playlistActivationBound = false;
function bindPlaylistActivation() {
  var container = $('playlist-container');
  if (!container || playlistActivationBound) return;
  playlistActivationBound = true;

  function activate(target) {
    var item = target && target.closest ? target.closest('.playlist-item') : null;
    if (!item) return;
    var index = parseInt(item.getAttribute('data-index'), 10);
    if (!isNaN(index)) Tapp.media.jumpToIndex(index);
  }

  var startX = 0, startY = 0, moved = false;
  container.addEventListener('touchstart', function(e) {
    var tt = e.touches[0];
    startX = tt.clientX; startY = tt.clientY; moved = false;
  }, { passive: true });
  container.addEventListener('touchmove', function(e) {
    var tt = e.touches[0];
    if (Math.abs(tt.clientX - startX) > 10 || Math.abs(tt.clientY - startY) > 10) moved = true;
  }, { passive: true });
  container.addEventListener('touchend', function(e) {
    if (moved) return;
    var tt = e.changedTouches[0];
    var el = tt ? document.elementFromPoint(tt.clientX, tt.clientY) : null;
    if (el) { e.preventDefault(); activate(el); } // preventDefault 抑制随后合成的 click，避免双触发
  }, { passive: false });
  container.addEventListener('click', function(e) {
    activate(e.target);
  });
}

// 打开播放列表面板：此刻才有真实高度，填满可见项并滚到当前歌曲
function revealPlaylist() {
  if (virtualList.contentWrapper && virtualList.data.length > 0) {
    // 一次全量重渲：重测高度 + 滚到当前歌曲（由 renderVisibleItems 内统一处理）
    virtualList.measured = false;
    virtualList.pendingScrollToCurrent = true;
    virtualList.visibleStart = -1;
    virtualList.visibleEnd = -1;
    renderVisibleItems();
  } else {
    // 整表模式：滚动当前歌曲到中间
    var scroller = document.querySelector('.playlist-scroll');
    var active = scroller && scroller.querySelector('.playlist-item.active');
    if (active) active.scrollIntoView({ block: 'center' });
  }
}

// 缓存的搜索结果
var playlistCache = {
  lastQuery: null,
  lastResult: null,
  lastPlaylistLen: 0
};

// 渲染播放列表（使用虚拟滚动）
function renderPlaylist(playlist, currentTrack, searchQuery) {
  var container = $('playlist-container');
  if (!container) return;

  var filteredList;
  var query = searchQuery ? searchQuery.toLowerCase() : '';
  
  // 使用缓存避免重复过滤
  if (query === playlistCache.lastQuery && playlist.length === playlistCache.lastPlaylistLen) {
    filteredList = playlistCache.lastResult;
  } else {
    if (query) {
      filteredList = [];
      for (var i = 0; i < playlist.length; i++) {
        var song = playlist[i];
        var name = song.name ? song.name.toLowerCase() : '';
        var artist = song.artist ? song.artist.toLowerCase() : '';
        if (name.indexOf(query) !== -1 || artist.indexOf(query) !== -1) {
          filteredList.push(song);
        }
      }
    } else {
      filteredList = playlist;
    }
    playlistCache.lastQuery = query;
    playlistCache.lastResult = filteredList;
    playlistCache.lastPlaylistLen = playlist.length;
  }

  if (filteredList.length === 0) {
    // 清理虚拟列表状态
    virtualList.data = [];
    virtualList.activeItems.forEach(function(el) {
      virtualList.itemPool.push(el);
    });
    virtualList.activeItems.clear();
    // 重置容器引用，下次渲染时会重新创建
    virtualList.innerWrapper = null;
    virtualList.contentWrapper = null;
    virtualList.visibleStart = -1;
    virtualList.visibleEnd = -1;
    virtualList.lastTotalHeight = 0;
    
    container.innerHTML = '<div class="playlist-empty">' + 
      (searchQuery ? '未找到匹配歌曲' : t('noPlaylist')) + '</div>';
    return;
  }
  
  // 更新 Tab badge
  var badge = $('playlist-badge');
  if (badge) {
    var newLen = String(playlist.length);
    if (badge.textContent !== newLen) badge.textContent = newLen;
  }
  
  var newTrackId = currentTrack ? currentTrack.id : null;

  // 中小列表直接整表渲染（图片懒加载，性能足够，且保证全部歌曲可见）；
  // 仅超大列表才用虚拟滚动
  if (filteredList.length <= 200) {
    renderPlaylistSimple(filteredList, currentTrack);
  } else {
    // 检查是否只是currentTrack变化
    var onlyTrackChanged = virtualList.data === filteredList &&
                           virtualList.currentTrackId !== newTrackId;

    // 初始化虚拟列表
    initVirtualList();
    virtualList.currentTrackId = newTrackId;

    if (!onlyTrackChanged || virtualList.data !== filteredList) {
      virtualList.data = filteredList;
      virtualList.searchQuery = searchQuery;
      virtualList.visibleStart = -1; // 强制重新渲染
      virtualList.visibleEnd = -1;
      // 数据变化：面板下次可见时滚动到当前歌曲
      if (!searchQuery) virtualList.pendingScrollToCurrent = true;
    }
    
    renderVisibleItems();
    
    // 滚动到当前播放
    if (!searchQuery && currentTrack && !onlyTrackChanged) {
      var activeIndex = -1;
      for (var j = 0; j < filteredList.length; j++) {
        if (filteredList[j].id === currentTrack.id) {
          activeIndex = j;
          break;
        }
      }
      if (activeIndex >= 0) {
        setTimeout(function() {
          var scrollTop = activeIndex * virtualList.itemHeight - virtualList.scrollContainer.clientHeight / 2 + virtualList.itemHeight / 2;
          // 根据动画配置决定滚动行为
          if (shouldAnimate()) {
            virtualList.scrollContainer.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
          } else {
            virtualList.scrollContainer.scrollTop = Math.max(0, scrollTop);
          }
        }, shouldAnimate() ? 100 : 0);
      }
    }
  }
}

// 简单渲染（小列表）
function renderPlaylistSimple(filteredList, currentTrack) {
  var container = $('playlist-container');
  if (!container) return;
  
  // 重置虚拟列表容器引用（因为下面会用 innerHTML 清空）
  virtualList.innerWrapper = null;
  virtualList.contentWrapper = null;
  virtualList.activeItems.clear();
  virtualList.visibleStart = -1;
  virtualList.visibleEnd = -1;
  
  var currentTrackId = currentTrack ? currentTrack.id : null;
  var fragment = document.createDocumentFragment();
  
  for (var i = 0; i < filteredList.length; i++) {
    var song = filteredList[i];
    var isActive = currentTrackId && song.id === currentTrackId;

    var el = document.createElement('div');
    el.className = isActive ? 'playlist-item active' : 'playlist-item';
    el.setAttribute('data-id', song.id);
    el.setAttribute('data-index', song.originalIndex);
    el.innerHTML = PLAYLIST_ITEM_HTML;
    fillPlaylistItem(el, song);
    fragment.appendChild(el);
  }
  
  container.innerHTML = '';
  container.appendChild(fragment);

  // 点击/触摸委托绑定在常驻容器上（幂等）
  bindPlaylistActivation();

  // 滚动到当前播放
  if (currentTrack) {
    var activeItem = container.querySelector('.playlist-item.active');
    if (activeItem) {
      requestAnimationFrame(function() {
        if (shouldAnimate()) {
          activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          activeItem.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      });
    }
  }
}

// 颜色更新缓存 - 避免重复设置相同颜色
var lastColors = {
  primary: null,
  secondary: null,
  accent: null,
  light: null,
  dark: null
};

// 播放模式缓存 - 避免重复设置 innerHTML
var lastMode = null;
var lastCoverUrl = null;

function getTrackCoverUrl(track) {
  if (!track) return '';
  return track.cover ||
         track.coverUrl ||
         track.cover_url ||
         track.artwork ||
         track.artworkUrl ||
         track.albumArt ||
         track.image ||
         track.imageUrl ||
         track.picUrl ||
         '';
}

function toCssImageUrl(url) {
  return 'url("' + String(url).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")';
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHexColor(value) {
  if (!value) return null;
  var hex = String(value).trim();
  if (hex.charAt(0) !== '#') return null;
  hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex.charAt(0) + hex.charAt(0) +
      hex.charAt(1) + hex.charAt(1) +
      hex.charAt(2) + hex.charAt(2);
  }
  if (hex.length === 8) {
    hex = hex.slice(0, 6);
  }
  if (hex.length !== 6 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  return '#' + hex.toLowerCase();
}

function hexToRgb(value) {
  var hex = normalizeHexColor(value);
  if (!hex) return null;
  var n = parseInt(hex.slice(1), 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255
  };
}

function rgbToHex(rgb) {
  function part(value) {
    var hex = clampNumber(Math.round(value), 0, 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }
  return '#' + part(rgb.r) + part(rgb.g) + part(rgb.b);
}

function rgbToHsl(rgb) {
  var r = rgb.r / 255;
  var g = rgb.g / 255;
  var b = rgb.b / 255;
  var max = Math.max(r, g, b);
  var min = Math.min(r, g, b);
  var h = 0;
  var s = 0;
  var l = (max + min) / 2;

  if (max !== min) {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h, s: s, l: l };
}

function hslToRgb(hsl) {
  var h = hsl.h;
  var s = hsl.s;
  var l = hsl.l;
  var r;
  var g;
  var b;

  if (s === 0) {
    r = g = b = l;
  } else {
    function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }

    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: r * 255,
    g: g * 255,
    b: b * 255
  };
}

function relativeLuminance(rgb) {
  function channel(value) {
    var c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return channel(rgb.r) * 0.2126 + channel(rgb.g) * 0.7152 + channel(rgb.b) * 0.0722;
}

function contrastRatio(foreground, background) {
  var a = relativeLuminance(foreground);
  var b = relativeLuminance(background);
  var lighter = Math.max(a, b);
  var darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function getLyricBackdropRgb(isDark) {
  return isDark ? { r: 12, g: 12, b: 14 } : { r: 246, g: 246, b: 248 };
}

function toColorCandidates(value) {
  return Array.isArray(value) ? value : [value];
}

function pickReadableLyricCandidate(candidates, isDark, minContrast) {
  var bg = getLyricBackdropRgb(isDark);
  var values = toColorCandidates(candidates);
  for (var i = 0; i < values.length; i++) {
    var hex = normalizeHexColor(values[i]);
    var rgb = hexToRgb(hex);
    if (rgb && contrastRatio(rgb, bg) >= minContrast) {
      return hex;
    }
  }
  return null;
}

function firstUsableLyricColor(candidates, fallbackColor) {
  var values = toColorCandidates(candidates);
  for (var i = 0; i < values.length; i++) {
    var rgb = hexToRgb(values[i]);
    if (rgb) return rgb;
  }
  return hexToRgb(fallbackColor) || hexToRgb('#fc3c44');
}

function deriveReadableLyricColor(rawColor, fallbackColor, isDark, lightness, minContrast) {
  var readable = pickReadableLyricCandidate(rawColor, isDark, minContrast);
  if (readable) return readable;

  var bg = getLyricBackdropRgb(isDark);
  var rgb = firstUsableLyricColor(rawColor, fallbackColor);
  var hsl = rgbToHsl(rgb);
  var l = hsl.l + (lightness - hsl.l) * 0.72;
  var s = clampNumber(hsl.s, isDark ? 0.34 : 0.3, isDark ? 0.86 : 0.78);
  var step = isDark ? 0.02 : -0.02;
  var limit = isDark ? 0.94 : 0.16;
  var candidate;
  var guard = 0;

  do {
    candidate = hslToRgb({ h: hsl.h, s: s, l: l });
    if (contrastRatio(candidate, bg) >= minContrast) break;
    l += step;
    guard += 1;
  } while (guard < 24 && (isDark ? l <= limit : l >= limit));

  return rgbToHex(candidate);
}

function rgbaFromHex(value, alpha) {
  var rgb = hexToRgb(value) || hexToRgb('#fc3c44');
  return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + alpha + ')';
}

function applyLyricReadableColors() {
  var isDark = currentTheme === 'dark';
  var root = document.documentElement;
  var primaryRaw = lastColors.primary || '#fc3c44';
  var secondaryRaw = lastColors.secondary || lastColors.accent || primaryRaw;
  var themeAltRaw = isDark ? lastColors.light : lastColors.dark;
  var primaryCandidates = [primaryRaw, themeAltRaw, secondaryRaw, lastColors.accent];
  var secondaryCandidates = [secondaryRaw, lastColors.accent, themeAltRaw, primaryRaw];
  var passedCandidates = [primaryRaw, themeAltRaw, secondaryRaw];
  var primary = deriveReadableLyricColor(primaryCandidates, '#fc3c44', isDark, isDark ? 0.78 : 0.34, 3.7);
  var secondary = deriveReadableLyricColor(secondaryCandidates, primaryRaw, isDark, isDark ? 0.70 : 0.42, 3.4);
  var passed = deriveReadableLyricColor(passedCandidates, primary, isDark, isDark ? 0.68 : 0.38, 3.0);

  root.style.setProperty('--lyric-active-primary', primary);
  root.style.setProperty('--lyric-active-secondary', secondary);
  root.style.setProperty('--lyric-passed', passed);
  root.style.setProperty('--lyric-unfilled', isDark ? 'rgba(245, 245, 247, 0.34)' : 'rgba(29, 29, 31, 0.34)');
  root.style.setProperty('--lyric-glow', rgbaFromHex(primary, isDark ? 0.34 : 0.18));
}

// 是否偏好减少动画（无障碍）
var prefersReducedMotion = !!(window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// 长标题跑马灯：文本溢出容器时来回滚动，否则保持单行省略号
// outer 为裁剪窗口，其中包含一个 .marquee-inner 内层
function setScrollingText(outer, text) {
  if (!outer) return;
  text = text || '';
  var inner = outer.querySelector('.marquee-inner');
  if (!inner) {
    inner = document.createElement('span');
    inner.className = 'marquee-inner';
    outer.textContent = '';
    outer.appendChild(inner);
  }
  // 文本未变化则跳过，避免每次轮询触发重排
  if (outer.__mqText === text) return;
  outer.__mqText = text;
  inner.textContent = text;
  outer.title = text; // 悬浮显示完整标题
  outer.classList.remove('is-marquee');
  outer.style.removeProperty('--marquee-shift');
  outer.style.removeProperty('--marquee-duration');
  if (prefersReducedMotion) return;
  // 待布局完成后测量溢出量
  requestAnimationFrame(function() {
    if (outer.__mqText !== text) return; // 期间又切歌了
    var overflow = inner.scrollWidth - outer.clientWidth;
    if (overflow > 4) {
      var shift = overflow + 16; // 尾部留白，确保最后一个字完整露出
      var duration = Math.min(24, Math.max(6, shift / 40)); // 约 40px/s 匀速
      outer.style.setProperty('--marquee-shift', '-' + shift + 'px');
      outer.style.setProperty('--marquee-duration', duration.toFixed(1) + 's');
      outer.classList.add('is-marquee');
    }
  });
}

// 容器尺寸变化后重新测量（清除缓存后重跑）
function remeasureScrollingText(outer) {
  if (!outer || outer.__mqText == null) return;
  var text = outer.__mqText;
  outer.__mqText = null;
  setScrollingText(outer, text);
}

// 高频 DOM 元素缓存 - 进度相关（每秒更新60次）
var progressElements = {
  bar: null,
  fill: null,
  current: null,
  remaining: null,
  initialized: false
};

// 初始化进度元素缓存
function initProgressElements() {
  if (progressElements.initialized) return;
  progressElements.bar = $('progress-bar');
  progressElements.fill = $('progress-fill');
  progressElements.current = $('current-time');
  progressElements.remaining = $('remaining-time');
  progressElements.initialized = true;
}

// 轻量级进度更新 - 只更新进度条和时间显示（使用缓存的 DOM 引用）
function updateProgressOnly(status) {
  if (!status) return;
  
  // 确保 DOM 引用已缓存
  initProgressElements();
  
  var track = status.currentTrack;
  var duration = track ? (track.duration || 0) : 0;
  var position = status.position || (status.progress ? status.progress.current : 0) || 0;
  
  if (progressElements.bar) {
    progressElements.bar.value = position;
  }
  if (progressElements.fill) {
    var percent = duration > 0 ? (position / duration) * 100 : 0;
    progressElements.fill.style.width = percent + '%';
  }
  if (progressElements.current) progressElements.current.textContent = formatTime(position);
  if (progressElements.remaining) {
    var remaining = Math.max(0, duration - position);
    progressElements.remaining.textContent = '-' + formatTime(remaining);
  }
}

// 更新播放器UI
function updatePlayerUI(status) {
  if (!status) return;

  var track = status.currentTrack;
  var coverUrl = getTrackCoverUrl(track);
  
  // 动态背景 - 使用封面作为模糊背景
  var bgArtwork = $('bg-artwork');
  if (bgArtwork && coverUrl !== lastCoverUrl) {
    bgArtwork.style.backgroundImage = coverUrl ? toCssImageUrl(coverUrl) : 'none';
    lastCoverUrl = coverUrl;
  }
  
  // 同步音乐播放器的完整动态颜色 - 只在颜色变化时更新
  var root = document.documentElement;
  var didUpdateColors = false;
  if (status.primaryColor && status.primaryColor !== lastColors.primary) {
    var primary = status.primaryColor;
    lastColors.primary = primary;
    root.style.setProperty('--music-primary', primary);
    root.style.setProperty('--accent-color', primary);
    root.style.setProperty('--accent-light', primary + '26');
    root.style.setProperty('--accent-glow', primary + '66');
    didUpdateColors = true;
  }
  if (status.secondaryColor && status.secondaryColor !== lastColors.secondary) {
    lastColors.secondary = status.secondaryColor;
    root.style.setProperty('--music-secondary', status.secondaryColor);
    didUpdateColors = true;
  }
  if (status.accentColor && status.accentColor !== lastColors.accent) {
    lastColors.accent = status.accentColor;
    root.style.setProperty('--music-accent', status.accentColor);
    didUpdateColors = true;
  }
  if (status.lightColor && status.lightColor !== lastColors.light) {
    lastColors.light = status.lightColor;
    root.style.setProperty('--music-light', status.lightColor);
    didUpdateColors = true;
  }
  if (status.darkColor && status.darkColor !== lastColors.dark) {
    lastColors.dark = status.darkColor;
    root.style.setProperty('--music-dark', status.darkColor);
    didUpdateColors = true;
  }
  if (didUpdateColors) {
    applyLyricReadableColors();
  }
  
  // 封面
  var coverEl = $('album-cover');
  var coverPlaceholder = $('cover-placeholder');
  if (coverEl && coverPlaceholder) {
    if (coverUrl) {
      coverEl.src = coverUrl;
      coverEl.style.display = 'block';
      coverPlaceholder.style.display = 'none';
      coverEl.onerror = function() {
        coverEl.style.display = 'none';
        coverPlaceholder.style.display = 'flex';
      };
    } else {
      coverEl.style.display = 'none';
      coverPlaceholder.style.display = 'flex';
    }
  }

  // 歌曲信息
  var nameEl = $('song-name');
  var artistEl = $('song-artist');
  setScrollingText(nameEl, track ? track.name : t('noPlaying'));
  setScrollingText(artistEl, track ? (track.artist || '-') : '-');

  // 切歌入场动效：封面 pop-in + 标题/歌手错峰滑入（首帧跳过）
  var fxTrackId = track ? track.id : null;
  if (fxTrackId !== lastFxTrackId) {
    if (lastFxTrackId !== undefined && fxTrackId && shouldAnimate()) {
      retriggerClass(document.querySelector('.track-title-row'), 'track-change');
      retriggerClass(artistEl, 'track-change');
      retriggerClass($('artwork-wrapper'), 'art-change');
    }
    lastFxTrackId = fxTrackId;
  }

  // VIP 标签
  var vipEl = $('vip-badge');
  if (vipEl) {
    if (track && track.isVip) {
      vipEl.textContent = t('vip');
      vipEl.className = 'badge-vip';
      vipEl.style.display = 'inline-block';
    } else if (track && track.isTrial) {
      vipEl.textContent = t('trial');
      vipEl.className = 'badge-vip trial';
      vipEl.style.display = 'inline-block';
    } else {
      vipEl.style.display = 'none';
    }
  }

  // 播放/暂停按钮 - 使用缓存的图标元素
  var playBtn = $('play-btn');
  if (playBtn) {
    if (!playBtnIcons.cached) {
      playBtnIcons.play = playBtn.querySelector('.icon-play');
      playBtnIcons.pause = playBtn.querySelector('.icon-pause');
      playBtnIcons.cached = true;
    }
    if (playBtnIcons.play && playBtnIcons.pause) {
      // 播放/暂停切换时图标 pop（首帧跳过）
      var playingNow = !!status.isPlaying;
      if (lastFxPlaying !== null && lastFxPlaying !== playingNow && shouldAnimate()) {
        retriggerClass(playBtn, 'state-pop');
      }
      lastFxPlaying = playingNow;
      playBtnIcons.play.style.display = status.isPlaying ? 'none' : 'block';
      playBtnIcons.pause.style.display = status.isPlaying ? 'block' : 'none';
    }
    playBtn.setAttribute('aria-label', status.isPlaying ? t('pause') : t('play'));
  }

  // 封面播放/暂停状态效果
  var artworkWrapper = $('artwork-wrapper');
  if (artworkWrapper) {
    if (status.isPlaying) {
      artworkWrapper.classList.remove('paused');
    } else {
      artworkWrapper.classList.add('paused');
    }
  }

  // 暂停时列表当前项的均衡器静止
  document.documentElement.classList.toggle('player-paused', !status.isPlaying);

  // 进度条 - 使用缓存的 DOM 引用
  initProgressElements();
  var duration = track ? (track.duration || 0) : 0;
  var position = status.position || (status.progress ? status.progress.current : 0) || 0;
  
  if (progressElements.bar) {
    progressElements.bar.max = duration || 100;
    progressElements.bar.value = position;
  }
  if (progressElements.fill) {
    var percent = duration > 0 ? (position / duration) * 100 : 0;
    progressElements.fill.style.width = percent + '%';
  }
  if (progressElements.current) progressElements.current.textContent = formatTime(position);
  // 显示剩余时长（负数形式）
  if (progressElements.remaining) {
    var remaining = Math.max(0, duration - position);
    progressElements.remaining.textContent = '-' + formatTime(remaining);
  }

  // 音量
  var volumeBar = $('volume-bar');
  var volumeFill = $('volume-fill');
  var volumeValue = status.volume || 0;
  var normalizedVolume = volumeValue > 1 ? volumeValue / 100 : volumeValue;
  if (volumeBar) volumeBar.value = normalizedVolume;
  if (volumeFill) volumeFill.style.width = (normalizedVolume * 100) + '%';

  // 播放模式 - 只在模式变化时更新
  var modeBtn = $('mode-btn');
  if (modeBtn && status.mode !== lastMode) {
    lastMode = status.mode;
    modeBtn.innerHTML = getModeIcon(status.mode);
    modeBtn.setAttribute('aria-label', getModeTooltip(status.mode));
    if (status.mode && status.mode !== 'sequence') {
      modeBtn.classList.add('active');
    } else {
      modeBtn.classList.remove('active');
    }
  }
  
  // 根据播放状态控制背景动画
  if (status.isPlaying) {
    startBackgroundAnimation();
  }
  // 注意：暂停时动画会自动缓慢停止，不需要立即停止
}

// 歌词提前量（秒）- 补偿各种延迟
var LYRIC_ADVANCE_TIME = 0.15;

// 更新歌词索引 - 带提前量补偿
function updateLyricIndex(position, lyrics) {
  if (!lyrics || lyrics.length === 0) return -1;
  
  // 增加提前量补偿延迟
  var adjustedPosition = position + LYRIC_ADVANCE_TIME;
  
  var index = -1;
  for (var i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= adjustedPosition) {
      index = i;
    } else {
      break;
    }
  }
  return index;
}

// 播放按钮图标缓存
var playBtnIcons = { play: null, pause: null, cached: false };

// 上次状态快照 - 用于检测变化
var lastStateSnapshot = {
  trackId: null,
  coverUrl: null,
  isPlaying: null,
  position: -1,
  volume: -1,
  mode: null
};

// 检查状态是否有关键变化
// 规范化媒体状态：API 返回 title/progress.current，页面统一用 name/position
function normalizeMediaState(s) {
  if (s.currentTrack) {
    s.currentTrack.name = s.currentTrack.title || s.currentTrack.name;
  }
  if (s.progress) {
    s.position = s.progress.current || 0;
  }
}

function hasSignificantChange(state) {
  var trackId = state.currentTrack ? state.currentTrack.id : null;
  var coverUrl = getTrackCoverUrl(state.currentTrack);
  var position = state.position || (state.progress ? state.progress.current : 0) || 0;
  
  // 歌曲切换、封面到达、播放状态变化、模式变化是关键变化
  if (trackId !== lastStateSnapshot.trackId ||
      coverUrl !== lastStateSnapshot.coverUrl ||
      state.isPlaying !== lastStateSnapshot.isPlaying ||
      state.mode !== lastStateSnapshot.mode) {
    return true;
  }
  
  // 进度变化超过0.5秒才算关键变化（避免高频更新）
  if (Math.abs(position - lastStateSnapshot.position) > 0.5) {
    return true;
  }
  
  // 音量变化
  var volume = state.volume || 0;
  if (Math.abs(volume - lastStateSnapshot.volume) > 1) {
    return true;
  }
  
  return false;
}

// 更新状态快照
function updateStateSnapshot(state) {
  lastStateSnapshot.trackId = state.currentTrack ? state.currentTrack.id : null;
  lastStateSnapshot.coverUrl = getTrackCoverUrl(state.currentTrack);
  lastStateSnapshot.isPlaying = state.isPlaying;
  lastStateSnapshot.position = state.position || (state.progress ? state.progress.current : 0) || 0;
  lastStateSnapshot.volume = state.volume || 0;
  lastStateSnapshot.mode = state.mode;
}

// 初始化页面
async function initPage() {
  // 设置标题
  var titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = t('title');

  // 翻译 UI 随 locale 刷新（按钮文案/可用性；locale 切走时收起副行并重测布局）
  setLyricTransOn(pageState.transOn);

  // 并行获取所有初始数据（减少初始化时间）
  var results = await Promise.allSettled([
    Tapp.media.getStatus(),
    Tapp.media.getPlaylist()
  ]);
  
  // 处理媒体状态
  if (results[0].status === 'fulfilled') {
    var status = results[0].value || {};
    normalizeMediaState(status);
    pageState.status = status;
    updatePlayerUI(status);

    // 获取歌词（逐行兜底先渲染，逐字异步加载后覆盖）。
    // 本曲歌词已自载（lyricsSongId 匹配）则绝不覆盖：initPage 会因 locale 事件
    // 等重跑，此时用 status 的网易逐行去踩自载的酷狗 verbatim 派生行，
    // 两个行集错位 → 呼吸点乱插/高亮失效（且 loadLyricsForTrack 因去重不自愈）
    if (status.lyrics && status.lyrics.length > 0 &&
        !(status.currentTrack && status.currentTrack.id === pageState.lyricsSongId)) {
      // 注意不能用 `|| -1`：索引 0（第一句）是合法值会被吞掉
      var initIdx = typeof status.currentLyricIndex === 'number' ? status.currentLyricIndex : -1;
      pageState.lyrics = status.lyrics;
      pageState.currentLyricIndex = initIdx;
      renderLyrics(status.lyrics, initIdx);
    }
    // 加载逐字歌词（卡拉OK）+ 节拍网格（精确跟拍）
    if (status.currentTrack) {
      loadLyricsForTrack(status.currentTrack);
      loadBeatGridForTrack(status.currentTrack);
    }
    // 若已在播放，启动列表均衡器频谱循环
    ensureEqLoop();
  }

  // 处理播放列表
  if (results[1].status === 'fulfilled') {
    var playlistResult = results[1].value;
    var tracks = [];
    if (playlistResult && Array.isArray(playlistResult.tracks)) {
      tracks = playlistResult.tracks;
    } else if (Array.isArray(playlistResult)) {
      tracks = playlistResult;
    }
    
    // 预分配数组避免多次push
    pageState.playlist = new Array(tracks.length);
    for (var i = 0; i < tracks.length; i++) {
      var song = tracks[i];
      // 规范化字段名 - 直接赋值而非创建新对象
      pageState.playlist[i] = {
        id: song.id || String(i),
        name: song.title || song.name || 'Unknown',
        artist: song.artist || 'Unknown',
        cover: song.cover || '',
        duration: song.duration || 0,
        isVip: song.isVip || false,
        isTrial: song.isTrial || false,
        originalIndex: song.index !== undefined ? song.index : i,
        isCurrent: song.isCurrent || false
      };
    }
    
    renderPlaylist(pageState.playlist, pageState.status?.currentTrack, '');
    
    // 更新 Tab badge 数量
    var badge = document.getElementById('playlist-badge');
    if (badge) badge.textContent = pageState.playlist.length;
  }

  // 监听状态变化
  // initPage 重跑时先取消旧订阅，避免状态回调双跑
  if (pageState.unsubscribe) {
    pageState.unsubscribe();
    pageState.unsubscribe = null;
  }
  if (pageState.unsubscribeProgress) {
    pageState.unsubscribeProgress();
    pageState.unsubscribeProgress = null;
  }
  pageState.unsubscribe = Tapp.media.onStateChange(function(state) {
    // 防崩溃壳：回调异常若不捕获，本次事件的 ensureEqLoop/ensureLyricWordLoop
    // 重启链会中断；异常只跳过该事件并记录
    try {
      handleStateChange(state);
    } catch (e) {
      logTickError('stateChange', e);
    }
  });
  pageState.unsubscribeProgress = Tapp.media.onProgress(function(progress) {
    if (!pageState.status) return;
    try {
      handleStateChange(Object.assign({}, pageState.status, {
        position: progress.current,
        progress: progress
      }));
    } catch (e) {
      logTickError('progressChange', e);
    }
  });

  function handleStateChange(state) {
    // 检查是否有关键变化
    var significantChange = hasSignificantChange(state);

    normalizeMediaState(state);
    pageState.status = state;
    
    // 只在关键变化时更新完整UI
    if (significantChange) {
      updateStateSnapshot(state);
      updatePlayerUI(state);
      relayoutLyricsIfNeeded();
    } else {
      // 非关键变化只更新进度相关
      updateProgressOnly(state);
    }

    // 位置 + 插值时钟（供逐字高亮平滑推进）
    var position = state.position || (state.progress ? state.progress.current : 0) || 0;
    setLyricClock(position, state.isPlaying);

    // 列表均衡器频谱循环（播放中启动，自动随暂停停止）
    ensureEqLoop();

    // 切歌：加载新曲的逐字歌词 + 节拍网格（内部均按 id 去重）
    if (state.currentTrack && state.currentTrack.id !== pageState.lyricsSongId) {
      pageState.verbatimLyrics = [];
      loadLyricsForTrack(state.currentTrack);
    }
    if (state.currentTrack) loadBeatGridForTrack(state.currentTrack);

    if (pageState.verbatimLyrics.length > 0) {
      // 逐字模式：行渲染沿用 pageState.lyrics，仅在行切换时重渲染，字级填充走 rAF
      var vIdx = updateLyricIndex(position, pageState.lyrics);
      if (vIdx !== pageState.currentLyricIndex) {
        pageState.currentLyricIndex = vIdx;
        renderLyrics(pageState.lyrics, vIdx);
      }
      updateWordHighlight(getLyricPosition());
      ensureLyricWordLoop();
    } else {
      // 逐行模式（兜底）- 歌词数据在 state.lyrics 中
      var lyrics = state.lyrics || [];
      var currentLyricIdx = updateLyricIndex(position, lyrics);

      if (lyrics.length > 0) {
        // 如果歌词变化了，重新渲染
        if (!pageState.lyrics || pageState.lyrics.length !== lyrics.length ||
            (pageState.lyrics[0] && lyrics[0] && pageState.lyrics[0].text !== lyrics[0].text)) {
          pageState.lyrics = lyrics;
          renderLyrics(lyrics, currentLyricIdx);
        } else if (currentLyricIdx !== pageState.currentLyricIndex) {
          // 只更新当前歌词高亮
          pageState.currentLyricIndex = currentLyricIdx;
          renderLyrics(lyrics, currentLyricIdx);
        }
      } else if (pageState.lyrics && pageState.lyrics.length > 0 &&
                 !(state.currentTrack && state.currentTrack.id === pageState.lyricsSongId)) {
        // 歌词清空了。但本曲歌词若是 tapp 自己加载的（lyricsSongId 匹配）则不清：
        // 状态事件缺 lyrics 字段（部分派发）不代表歌词消失，自载数据是权威
        pageState.lyrics = [];
        pageState.currentLyricIndex = -1;
        renderLyrics([], -1);
      }
    }

    // 更新播放列表高亮 - 使用虚拟列表的索引
    if (state.currentTrack) {
      var currentId = state.currentTrack.id;
      // 如果使用虚拟列表，直接更新其跟踪的ID（阈值与渲染路径保持一致）
      if (virtualList.data.length > 200 && virtualList.contentWrapper) {
        if (virtualList.currentTrackId !== currentId) {
          virtualList.currentTrackId = currentId;
          // 只更新可见项的active状态
          virtualList.activeItems.forEach(function(el, idx) {
            var song = virtualList.data[idx];
            if (song) {
              el.classList.toggle('active', song.id === currentId);
            }
          });
        }
      } else {
        // 小列表使用DOM查询
        var container = $('playlist-container');
        if (container) {
          var prevActive = container.querySelector('.playlist-item.active');
          if (prevActive && prevActive.getAttribute('data-id') !== currentId) {
            prevActive.classList.remove('active');
          }
          var newActive = container.querySelector('.playlist-item[data-id="' + currentId + '"]');
          if (newActive && !newActive.classList.contains('active')) {
            newActive.classList.add('active');
          }
        }
      }
    }
  }

  // 绑定控制按钮（内部幂等）
  var firstBind = !controlsBound;
  bindControls();

  // 页面可见性优化 - 不可见时暂停非关键动画（只绑一次）
  if (firstBind) document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // 页面不可见，暂停背景动画
      stopBackgroundAnimation();
    } else {
      // 页面恢复可见
      if (pageState.status && pageState.status.isPlaying && shouldAnimate()) {
        startBackgroundAnimation();
      }
    }
  }, { passive: true });
}

// 绑定控制按钮事件
// 幂等守卫：initPage 会在 locale 变化等时机重跑，bindControls 若重复执行，
// 每个按钮的 handler 会被绑定多次 → 单击触发两遍 →
// 移动端 tab 表现为「打开面板又立刻关闭」（看起来点了没反应）
var controlsBound = false;
function bindControls() {
  if (controlsBound) return;
  controlsBound = true;
  // 使用全局统一的移动端检测函数
  var isMobile = checkIsMobile;
  
  // 缓存所有需要的DOM元素
  var tabBtns = document.querySelectorAll('.tab-btn');
  var playerRight = document.getElementById('player-right');
  var mobileCloseBtn = document.getElementById('mobile-close-btn');
  var mobilePanelTitle = document.getElementById('mobile-panel-title');
  var panels = document.querySelectorAll('.panel');
  
  // 面板标题映射
  var panelTitles = {
    'lyrics': '歌词',
    'playlist': '播放列表'
  };
  
  // 移动端面板两段式关闭：先播下滑动画，结束后再 display:none。
  // 关闭中途重新打开时取消关闭，避免面板闪没。
  var panelCloseTimer = null;
  function cancelPanelClose() {
    if (panelCloseTimer) {
      clearTimeout(panelCloseTimer);
      panelCloseTimer = null;
    }
    if (playerRight) playerRight.classList.remove('mobile-closing');
  }
  function closeMobilePanel() {
    if (!playerRight || !playerRight.classList.contains('mobile-visible')) return;
    if (panelCloseTimer) return; // 已在关闭中
    if (!shouldAnimate()) {
      playerRight.classList.remove('mobile-visible');
      return;
    }
    playerRight.classList.add('mobile-closing');
    panelCloseTimer = setTimeout(function() {
      panelCloseTimer = null;
      playerRight.classList.remove('mobile-visible');
      playerRight.classList.remove('mobile-closing');
    }, 280);
  }

  // 统一的 Tab 按钮点击处理函数
  function handleTabClick(btn) {
    var tab = btn.getAttribute('data-tab');
    var wasActive = btn.classList.contains('active');
    var panelWasVisible = playerRight && playerRight.classList.contains('mobile-visible');
    
    // 更新 tab 按钮状态
    tabBtns.forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    
    // 切换面板 - 使用缓存的panels
    panels.forEach(function(p) { p.classList.remove('active'); });
    var targetPanel = document.getElementById('panel-' + tab);
    if (targetPanel) targetPanel.classList.add('active');

    // 切到播放列表：面板此刻才有真实高度，填满可见项并滚到当前歌曲
    if (tab === 'playlist') {
      requestAnimationFrame(revealPlaylist);
    }

    // 切到歌词：面板此刻才有真实高度，重测波浪引擎布局并就位到当前行。
    // 不只看 measured 标记——面板高度变过（移动端首开/横竖屏/关开）就必须重测
    if (tab === 'lyrics') {
      requestAnimationFrame(function() {
        relayoutLyricsIfNeeded(true);
      });
    }
    
    // 移动端：显示面板或切换
    if (isMobile() && playerRight) {
      if (wasActive && panelWasVisible) {
        // 再次点击同一个按钮，关闭面板（带下滑动画）
        closeMobilePanel();
        btn.classList.remove('active');
      } else {
        // 显示面板（若正在关闭动画中则取消关闭）
        cancelPanelClose();
        playerRight.classList.add('mobile-visible');
        // 更新面板标题
        if (mobilePanelTitle) {
          mobilePanelTitle.textContent = panelTitles[tab] || tab;
        }
      }
    }
  }

  // 关闭面板处理函数
  function handleClosePanel() {
    closeMobilePanel();
    // 取消所有tab按钮的active状态
    tabBtns.forEach(function(b) { b.classList.remove('active'); });
  }
  
  // 为按钮添加通用的点击绑定（兼容移动端和桌面端）
  function addClickHandler(element, handler) {
    if (!element) return;
    
    var startX = 0;
    var startY = 0;
    var moved = false;
    
    // touchstart 记录起始位置
    element.addEventListener('touchstart', function(e) {
      var touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      moved = false;
    }, { passive: true });
    
    // touchmove 检测是否移动（防止滑动时误触发）
    element.addEventListener('touchmove', function(e) {
      var touch = e.touches[0];
      var dx = Math.abs(touch.clientX - startX);
      var dy = Math.abs(touch.clientY - startY);
      if (dx > 10 || dy > 10) {
        moved = true;
      }
    }, { passive: true });
    
    // touchend 触发点击（移动端主要事件）
    element.addEventListener('touchend', function(e) {
      if (!moved) {
        e.preventDefault();
        handler();
      }
    }, { passive: false });
    
    // click 事件作为桌面端和备用
    element.addEventListener('click', function(e) {
      // 移动端已由 touchend 处理，这里主要是桌面端
      e.preventDefault();
      handler();
    });
  }
  
  // 绑定 Tab 按钮
  tabBtns.forEach(function(btn) {
    addClickHandler(btn, function() {
      handleTabClick(btn);
    });
  });
  
  // 移动端关闭按钮
  if (mobileCloseBtn) {
    addClickHandler(mobileCloseBtn, handleClosePanel);
  }

  // 歌词翻译开关（按钮仅在当前歌曲有用户语言翻译时可见）
  var transBtn = document.getElementById('lyric-trans-btn');
  if (transBtn) {
    addClickHandler(transBtn, function() {
      setLyricTransOn(!pageState.transOn);
      if (Tapp.storage && Tapp.storage.set) {
        Tapp.storage.set('lyricTransOn', pageState.transOn).catch(function() {});
      }
    });
  }
  
  // 窗口大小变化时重置状态 - 使用节流（统一处理所有 resize 逻辑）
  var resizeTimeout = null;
  window.addEventListener('resize', function() {
    if (resizeTimeout) return;
    resizeTimeout = setTimeout(function() {
      resizeTimeout = null;
      // 容器宽度变化后重新测量长标题跑马灯
      remeasureScrollingText($('song-name'));
      remeasureScrollingText($('song-artist'));
      // 视口高度变化后重新填充虚拟列表可见项
      refreshPlaylistView();
      // 歌词波浪引擎布局随尺寸重测（否则旧布局被 measured 锁死）
      relayoutLyricsIfNeeded();
      // 全局移动端缓存会在 checkIsMobile 调用时自动更新
      if (!isMobile() && playerRight) {
        playerRight.classList.remove('mobile-visible');
        // 桌面端恢复默认active状态
        var lyricsTab = document.getElementById('tab-lyrics');
        if (lyricsTab && !document.querySelector('.tab-btn.active')) {
          lyricsTab.classList.add('active');
        }
      }
    }, 100);
  }, { passive: true });
  
  // 播放/暂停
  var playBtn = document.getElementById('play-btn');
  if (playBtn) {
    playBtn.addEventListener('click', async function() {
      if (pageState.status && pageState.status.isPlaying) {
        await Tapp.media.pause();
      } else {
        await Tapp.media.play();
      }
    });
  }

  // 上一首
  var prevBtn = document.getElementById('prev-btn');
  if (prevBtn) {
    prevBtn.addEventListener('click', function() {
      Tapp.media.prev();
    });
  }

  // 下一首
  var nextBtn = document.getElementById('next-btn');
  if (nextBtn) {
    nextBtn.addEventListener('click', function() {
      Tapp.media.next();
    });
  }

  // 进度条 - 同步 fill，使用节流减少API调用
  var progressBar = document.getElementById('progress-bar');
  var progressFill = document.getElementById('progress-fill');
  if (progressBar) {
    // 节流seek调用 - 每100ms最多调用一次
    var lastSeekTime = 0;
    var pendingSeekValue = null;
    var seekTimeout = null;
    
    var flushSeek = function() {
      if (pendingSeekValue !== null) {
        Tapp.media.seek(pendingSeekValue);
        pendingSeekValue = null;
      }
      seekTimeout = null;
    };
    
    progressBar.addEventListener('input', function(e) {
      var value = parseFloat(e.target.value);
      var max = parseFloat(e.target.max) || 100;
      if (progressFill) {
        progressFill.style.width = (value / max * 100) + '%';
      }
      
      // 节流seek调用
      var now = Date.now();
      if (now - lastSeekTime >= 100) {
        lastSeekTime = now;
        Tapp.media.seek(value);
        pendingSeekValue = null;
      } else {
        // 延迟执行，确保最终值被发送
        pendingSeekValue = value;
        if (!seekTimeout) {
          seekTimeout = setTimeout(flushSeek, 100);
        }
      }
    });
    
    // 拖动结束时确保发送最终值
    progressBar.addEventListener('change', function(e) {
      var value = parseFloat(e.target.value);
      if (seekTimeout) {
        clearTimeout(seekTimeout);
        seekTimeout = null;
      }
      Tapp.media.seek(value);
      pendingSeekValue = null;
    });
  }

  // 音量滑块 - 同步 fill，使用节流减少API调用
  var volumeBar = document.getElementById('volume-bar');
  var volumeFill = document.getElementById('volume-fill');
  if (volumeBar) {
    // 节流volume调用 - 每50ms最多调用一次
    var lastVolumeTime = 0;
    var pendingVolume = null;
    var volumeTimeout = null;
    
    var flushVolume = function() {
      if (pendingVolume !== null) {
        Tapp.media.setVolume(pendingVolume * 100);
        pendingVolume = null;
      }
      volumeTimeout = null;
    };
    
    volumeBar.addEventListener('input', function(e) {
      var value = parseFloat(e.target.value);
      if (volumeFill) {
        volumeFill.style.width = (value * 100) + '%';
      }
      
      // 节流volume调用
      var now = Date.now();
      if (now - lastVolumeTime >= 50) {
        lastVolumeTime = now;
        Tapp.media.setVolume(value * 100);
        pendingVolume = null;
      } else {
        pendingVolume = value;
        if (!volumeTimeout) {
          volumeTimeout = setTimeout(flushVolume, 50);
        }
      }
    });
    
    // 拖动结束时确保发送最终值
    volumeBar.addEventListener('change', function(e) {
      var value = parseFloat(e.target.value);
      if (volumeTimeout) {
        clearTimeout(volumeTimeout);
        volumeTimeout = null;
      }
      Tapp.media.setVolume(value * 100);
      pendingVolume = null;
    });
  }

  // 播放模式
  var modeBtn = document.getElementById('mode-btn');
  if (modeBtn) {
    modeBtn.addEventListener('click', function() {
      // 后端期望的模式值: 'sequence' | 'loop' | 'shuffle' | 'single'
      var currentMode = pageState.status ? pageState.status.mode : 'sequence';
      var modes = ['sequence', 'loop', 'shuffle', 'single'];
      var nextIndex = (modes.indexOf(currentMode) + 1) % modes.length;
      Tapp.media.setMode(modes[nextIndex]);
    });
  }

  // 跳过 VIP 歌曲开关（联动系统播放器）
  var skipVipBtn = document.getElementById('skip-vip-btn');
  if (skipVipBtn) {
    var skipVipState = true; // 系统默认跳过 VIP（内部仍用 skip 语义）
    var skipVipLabel = skipVipBtn.querySelector('.ph-btn-label');
    function updateSkipVipBtn() {
      // 显示为「播放VIP」：高亮=允许播放 VIP（即不跳过）
      skipVipBtn.classList.toggle('active', !skipVipState);
      if (skipVipLabel) skipVipLabel.textContent = t('playVip');
      skipVipBtn.title = t('playVip');
      skipVipBtn.setAttribute('aria-label', t('playVip'));
    }
    // 读取系统当前开关状态
    if (Tapp.media.getSkipVip) {
      Tapp.media.getSkipVip().then(function(res) {
        if (res && typeof res.skipVip === 'boolean') skipVipState = res.skipVip;
        updateSkipVipBtn();
      }).catch(function() { updateSkipVipBtn(); });
    } else {
      updateSkipVipBtn();
    }
    addClickHandler(skipVipBtn, function() {
      skipVipState = !skipVipState;
      updateSkipVipBtn();
      if (Tapp.media.setSkipVip) Tapp.media.setSkipVip(skipVipState);
    });
  }

  // 搜索
  var searchInput = document.getElementById('playlist-search');
  if (searchInput) {
    searchInput.placeholder = t('searchPlaceholder');
    var debouncedSearch = debounce(function(query) {
      renderPlaylist(pageState.playlist, pageState.status?.currentTrack, query);
    }, 300);

    searchInput.addEventListener('input', function(e) {
      debouncedSearch(e.target.value);
    });
  }

  // 清除搜索
  var clearSearchBtn = document.getElementById('clear-search');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', function() {
      var searchInput = document.getElementById('playlist-search');
      if (searchInput) {
        searchInput.value = '';
        renderPlaylist(pageState.playlist, pageState.status?.currentTrack, '');
      }
    });
  }

  // 列表点击/触摸委托（幂等）
  bindPlaylistActivation();

  // 头部模式切换：搜索 ⇄ 外部歌单
  var playlistHeader = document.getElementById('playlist-header');
  var toggleImportBtn = document.getElementById('toggle-import-btn');
  var importBackBtn = document.getElementById('import-back-btn');
  function setHeaderMode(mode) {
    if (!playlistHeader) return;
    playlistHeader.setAttribute('data-mode', mode);
    if (mode === 'import') {
      var idInput = document.getElementById('playlist-id-input');
      if (idInput) setTimeout(function() { idInput.focus(); }, 0);
    } else {
      var hint = document.getElementById('playlist-id-hint');
      if (hint) { hint.textContent = ''; hint.className = 'playlist-id-hint'; }
      var s = document.getElementById('playlist-search');
      if (s) setTimeout(function() { s.focus(); }, 0);
    }
  }
  if (toggleImportBtn) addClickHandler(toggleImportBtn, function() { setHeaderMode('import'); });
  if (importBackBtn) addClickHandler(importBackBtn, function() { setHeaderMode('search'); });

  // i18n：按钮文字标签 + 无障碍标题
  function setLabel(sel, text) {
    var el = document.querySelector(sel);
    if (el) el.textContent = text;
  }
  setLabel('#toggle-import-btn .ph-btn-label', t('externalPlaylist'));
  setLabel('#load-playlist-btn .ph-btn-label', t('importBtn'));
  if (toggleImportBtn) {
    toggleImportBtn.title = t('externalPlaylist');
    toggleImportBtn.setAttribute('aria-label', t('externalPlaylist'));
  }
  if (importBackBtn) {
    importBackBtn.title = t('backToSearch');
    importBackBtn.setAttribute('aria-label', t('backToSearch'));
  }
  var loadBtnEl = document.getElementById('load-playlist-btn');
  if (loadBtnEl) {
    loadBtnEl.title = t('loadPlaylist');
    loadBtnEl.setAttribute('aria-label', t('loadPlaylist'));
  }

  // 加载网易云歌单
  var playlistIdInput = document.getElementById('playlist-id-input');
  var loadPlaylistBtn = document.getElementById('load-playlist-btn');
  var playlistIdHint = document.getElementById('playlist-id-hint');

  if (playlistIdInput) {
    playlistIdInput.placeholder = t('playlistIdPlaceholder');
  }
  
  if (loadPlaylistBtn && playlistIdInput) {
    var isLoadingPlaylist = false;
    
    // 显示提示信息
    function showHint(text, type) {
      if (playlistIdHint) {
        playlistIdHint.textContent = text;
        playlistIdHint.className = 'playlist-id-hint' + (type ? ' ' + type : '');
      }
    }
    
    // 设置加载状态
    function setLoadingState(loading) {
      isLoadingPlaylist = loading;
      var loadIcon = loadPlaylistBtn.querySelector('.load-icon');
      var loadingIcon = loadPlaylistBtn.querySelector('.loading-icon');
      if (loadIcon) loadIcon.style.display = loading ? 'none' : 'block';
      if (loadingIcon) loadingIcon.style.display = loading ? 'block' : 'none';
      loadPlaylistBtn.disabled = loading;
      playlistIdInput.disabled = loading;
    }
    
    // 提取歌单ID（支持完整URL或纯ID）
    function extractPlaylistId(input) {
      if (!input) return '';
      input = input.trim();
      
      // 如果是纯数字，直接返回
      if (/^\d+$/.test(input)) {
        return input;
      }
      
      // 尝试从URL中提取ID
      // 支持格式：
      // https://music.163.com/#/playlist?id=123456
      // https://music.163.com/playlist?id=123456
      // music.163.com/playlist/123456
      var match = input.match(/(?:playlist[?/](?:id=)?|id=)(\d+)/i);
      if (match) {
        return match[1];
      }
      
      return input;
    }
    
    // 加载歌单
    async function loadPlaylist() {
      var rawInput = playlistIdInput.value;
      var playlistId = extractPlaylistId(rawInput);
      
      if (!playlistId) {
        showHint(t('playlistIdRequired'), 'error');
        return;
      }
      
      if (isLoadingPlaylist) return;
      
      setLoadingState(true);
      showHint(t('loadingPlaylist'), '');
      
      try {
        // SDK 成功时返回 data 对象 { playlistId, source, loading }
        // 如果失败会抛出异常
        var result = await Tapp.media.loadNeteasePlaylist(playlistId);
        
        // 只要没抛异常就是成功了
        showHint(t('playlistLoaded'), 'success');
        // 清空输入框
        playlistIdInput.value = '';
        
        // 等待一段时间让后端加载完成，然后刷新播放列表
        setTimeout(async function() {
          try {
            var playlistResult = await Tapp.media.getPlaylist();
            var tracks = [];
            if (playlistResult && Array.isArray(playlistResult.tracks)) {
              tracks = playlistResult.tracks;
            } else if (Array.isArray(playlistResult)) {
              tracks = playlistResult;
            }
            
            // 更新播放列表
            pageState.playlist = new Array(tracks.length);
            for (var i = 0; i < tracks.length; i++) {
              var song = tracks[i];
              pageState.playlist[i] = {
                id: song.id || String(i),
                name: song.title || song.name || 'Unknown',
                artist: song.artist || 'Unknown',
                cover: song.cover || '',
                duration: song.duration || 0,
                isVip: song.isVip || false,
                isTrial: song.isTrial || false,
                originalIndex: song.index !== undefined ? song.index : i,
                isCurrent: song.isCurrent || false
              };
            }
            
            renderPlaylist(pageState.playlist, pageState.status?.currentTrack, '');
            
            // 更新 Tab badge 数量
            var badge = document.getElementById('playlist-badge');
            if (badge) badge.textContent = pageState.playlist.length;
          } catch (e) {
            console.error('Failed to refresh playlist:', e);
          }
        }, 500);
        
        // 3秒后清除提示
        setTimeout(function() {
          showHint('', '');
        }, 3000);
      } catch (err) {
        console.error('Failed to load playlist:', err);
        showHint(t('playlistLoadFailed'), 'error');
      } finally {
        setLoadingState(false);
      }
    }
    
    // 点击按钮加载
    loadPlaylistBtn.addEventListener('click', loadPlaylist);
    
    // 回车键加载
    playlistIdInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        loadPlaylist();
      }
    });
  }
}

// ========================================
// 动态背景动画
// ========================================

// 检测是否为移动端（全局统一缓存）
var isMobileDevice = null;
var lastWindowWidth = 0;
function checkIsMobile() {
  var w = window.innerWidth;
  if (w !== lastWindowWidth) {
    lastWindowWidth = w;
    isMobileDevice = w <= 768;
  }
  return isMobileDevice;
}
// 注意: resize 事件在 bindControls 中统一处理

// 重触发 CSS 动画类：移除 → 强制回流 → 重新添加
function retriggerClass(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// 切歌/播放状态动效的上次标记（首帧不播动画）
var lastFxTrackId;
var lastFxPlaying = null;

// 列表均衡器元素缓存：仍连接且所属项仍 active 才复用，避免 15fps 反复扫播放列表 DOM
var eqElCache = { eq: null, item: null };
function getActiveEqEl() {
  var c = eqElCache;
  if (c.eq && c.eq.isConnected && c.item && c.item.classList.contains('active')) {
    return c.eq;
  }
  c.eq = document.querySelector('.playlist-item.active .playlist-item-cover-overlay .eq');
  c.item = c.eq ? c.eq.closest('.playlist-item') : null;
  return c.eq;
}

// 用真实频谱驱动「列表当前播放项」的均衡器（3 根柱：低/中高/高，居中强调）
// 加 .live 类禁用 CSS keyframe，改由 JS 设高度
function updateListEq(spectrum, eq) {
  if (!eq) return false;
  var bars = eq.getElementsByTagName('span');
  if (bars.length < 3) return false;
  if (!eq.classList.contains('live')) eq.classList.add('live');
  var v0 = spectrum[0] || 0;
  var v1 = Math.max(spectrum[1] || 0, spectrum[2] || 0);
  var v2 = spectrum[3] || 0;
  // 平方增强对比 + 25%~100% 区间
  bars[0].style.height = (25 + v0 * v0 * 75) + '%';
  bars[1].style.height = (25 + v1 * v1 * 75) + '%';
  bars[2].style.height = (25 + v2 * v2 * 75) + '%';
  return true;
}

// 独立频谱循环：驱动「列表均衡器」+「封面环境光晕」，与背景动画解耦（移动端/低动画级别也生效）
// 仅在播放中、且至少一个消费方可见时轮询频谱，避免无谓开销
// ========================================
// Aurora 频谱可视化（封面环境光）
// 三团主题色光斑（低/中/高频），攻击快（~55ms）释放慢（~350ms）的包络驱动
// 大小与亮度，叠加慢速公转漂移。数据 15fps 轮询、渲染 60fps 本地包络——
// 频谱被「感觉到」而不是被看到（Apple Music 式氛围可视化）
// ========================================
var aurora = {
  el: null,
  blobs: null,
  env: [0, 0, 0],   // 低/中/高包络值
  phase: 0,          // 公转相位
  lastT: 0,
  bands: null,       // 最新 8 频段样本（15fps 更新）
  lastOp: [NaN, NaN, NaN], // 写入去重（量化 opacity）
};

function renderAurora(ts) {
  if (!shouldAnimate()) return;
  if (!aurora.el) {
    aurora.el = $('artwork-aurora');
    if (!aurora.el) return;
    aurora.blobs = aurora.el.getElementsByClassName('aurora-blob');
  }
  if (aurora.el.offsetParent === null || !aurora.blobs || aurora.blobs.length < 3) return;

  var dt = Math.min(0.1, (ts - (aurora.lastT || ts)) / 1000);
  aurora.lastT = ts;
  // 公转速度随情绪：缓和 → 悠悠地转；激烈 → 明显加快
  aurora.phase += dt * (0.16 + rhythm.mood * 0.5);

  // 频段目标：低(0-1) / 中(3-4) / 高(5-7)
  var b = aurora.bands;
  var targets = b && b.length >= 8
    ? [
        Math.min(1, (b[0] + b[1]) * 0.7),
        Math.min(1, (b[3] + b[4]) * 0.75),
        Math.min(1, (b[5] + b[6] + b[7]) * 0.55),
      ]
    : [0, 0, 0];

  // 攻击/释放包络（经典 VU 手感：起得快、落得慢）
  // 释放随情绪：缓和 → 长余韵（光慢慢消散）；激烈 → 收得利落
  var aAtk = 1 - Math.exp(-dt / 0.055);
  var aRel = 1 - Math.exp(-dt / (0.5 - rhythm.mood * 0.28));
  for (var i = 0; i < 3; i++) {
    var e = aurora.env[i];
    var tgt = targets[i];
    aurora.env[i] = e + (tgt - e) * (tgt > e ? aAtk : aRel);
  }

  for (i = 0; i < 3; i++) {
    var el = aurora.blobs[i];
    var e2 = aurora.env[i];
    // 各光斑不同角速度/相位，避免同步感
    var ph = aurora.phase * (1 + i * 0.37) + i * 2.1;
    var ox = Math.cos(ph) * (4 + i * 2);
    var oy = Math.sin(ph * 0.8) * (3 + i * 2);
    var sc = 0.9 + e2 * 0.35;
    el.style.transform = 'translate(' + ox.toFixed(1) + '%,' + oy.toFixed(1) + '%) scale(' + sc.toFixed(3) + ')';
    // opacity 量化去重（公转 transform 每帧必写，opacity 只在包络变化时写）
    var op = Math.round((0.1 + e2 * 0.5) * 1000);
    if (op !== aurora.lastOp[i]) {
      aurora.lastOp[i] = op;
      el.style.opacity = (op / 1000).toFixed(3);
    }
  }
}

// ========================================
// 节奏事件引擎：从频谱找节奏点并可视化到背景层
//  - 重音（accent）：频谱通量（spectral flux，各频段正向突增之和）
//    突破自适应阈值（滑动均值 + 2.2σ）→ 背景径向光脉冲
//  - 转折（shift）：快/慢能量均线大幅偏离（drop/爆发）或
//    频段分布画像突变（段落切换）→ 光带斜扫过背景（稀有事件，4s 冷却）
// 检测跑在 15fps 数据块；视觉全为 CSS 合成器动画，JS 只切 class
// ========================================
var rhythm = {
  prev: null,        // 上一采样的频段
  fluxAvg: 0,        // 通量滑动均值
  fluxVar: 0,        // 通量滑动方差
  profile: null,     // 慢速频段画像（EMA ≈ 3s）
  energyFast: 0,     // 快均线（≈0.3s）
  energySlow: 0,     // 慢均线（≈3s）
  lastPulse: 0,
  lastSweep: 0,
  lastBeatT: 0,      // 常规节拍冷却
  beats: [],         // 4s 窗口内的节拍时间戳（估算节奏密度）
  density: 0,        // 节奏密度 0~1（≈2.5 拍/秒 → 1）
  mood: 0,           // 情绪值 0(缓和)~1(激烈)：绝对 MIR 特征回归的 arousal（唤醒度），
                     // 决定视觉的「性格」——涟漪快慢、Aurora 节奏
  lowRate: 0,        // 低能量率（安静帧占比 EMA）：抒情歌动态呼吸大 → 高
  warm: 0,           // 预热计数：慢均线未稳定前不做转折判定（防开场误触发）
  dropAng: 0,        // 雨滴落点相位（黄金角步进，按拍序绕屏规律行进）
  pool: null,        // 涟漪元素池
  next: 0,
};

// 发射一圈涟漪。tier 三档拉开视觉层级：
//  'beat'   常规拍：小而淡的单波（节奏的底色，刻意收敛）
//  'accent' 重音：大而亮的双波前（一眼区别于常规拍）
//  'shift'  转折：中心全屏大波 + 内部微光（稀有仪式感）
function fireRipple(strength, tier) {
  if (!rhythm.pool) {
    var els = document.getElementsByClassName('rhythm-ripple');
    if (!els || els.length === 0) return;
    rhythm.pool = els;
    rhythm.next = 0;
  }
  var el = rhythm.pool[rhythm.next % rhythm.pool.length];
  rhythm.next++;

  var isShift = tier === 'shift';
  var isAccent = tier === 'accent';
  var mood = rhythm.mood;
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var cx;
  var cy;
  var D;
  if (isShift) {
    // 转折：中心大波，覆盖全屏
    cx = vw * 0.5;
    cy = vh * 0.45;
    D = Math.sqrt(vw * vw + vh * vh) * 1.15;
  } else {
    // 雨滴落点：环带上按拍序黄金角步进（每拍绕屏幕规律行进，配合音乐有律动感），
    // 半径带少量抖动避免呆板；环带避开中央内容区
    rhythm.dropAng += 2.39996; // 黄金角 ≈137.5°
    var rr = 0.5 + Math.sin(rhythm.dropAng * 0.5) * 0.18 + Math.random() * 0.12;
    cx = vw * (0.5 + Math.cos(rhythm.dropAng) * 0.5 * rr);
    cy = vh * (0.45 + Math.sin(rhythm.dropAng) * 0.5 * rr);
    cx = Math.max(vw * 0.04, Math.min(vw * 0.96, cx));
    cy = Math.max(vh * 0.06, Math.min(vh * 0.94, cy));
    D = isAccent
      ? Math.min(vw, vh) * (0.52 + strength * 0.42)  // 重音：明显大于常规拍
      // 常规拍：大幅收敛（屏幕短边 15%~50%），强度 + 随机共同决定大小，
      // 每滴都不一样——雨点有大有小才像雨
      : Math.min(vw, vh) * (0.15 + strength * 0.26 + Math.random() * 0.09);
  }
  el.style.width = D + 'px';
  el.style.height = D + 'px';
  el.style.left = (cx - D / 2) + 'px';
  el.style.top = (cy - D / 2) + 'px';
  // 情绪塑形：缓和 → 慢而柔；激烈 → 快而脆
  var dur = isShift ? (2.6 - mood * 1.0) : (2.3 - mood * 1.3);
  el.style.setProperty('--rip-t', dur.toFixed(2) + 's');
  // 亮度分档：转折 > 重音 > 常规拍
  var base = isShift ? 0.24 : (isAccent ? 0.17 : 0.06);
  var gain = isShift ? 0.16 : (isAccent ? 0.2 : 0.08);
  var alpha = (base + strength * gain) * (0.7 + mood * 0.55);
  el.style.setProperty('--rip-a', alpha.toFixed(3));
  el.classList.remove('run');
  el.classList.toggle('big', isShift);
  el.classList.toggle('accent', isAccent);
  // 色彩轴：缓和情绪的常规拍用浅水色
  el.classList.toggle('soft', tier === 'beat' && mood < 0.45);
  void el.offsetWidth;
  el.classList.add('run');
}

// 节奏检测（15fps 数据块调用）
function rhythmTick(bands, ts) {
  if (!bands || bands.length < 8 || !shouldAnimate()) return;
  var i;
  var energy = 0;
  for (i = 0; i < 8; i++) energy += bands[i];
  energy /= 8;

  // --- 重音：频谱通量 onset 检测 ---
  var flux = 0;
  if (rhythm.prev) {
    for (i = 0; i < 8; i++) {
      var d = bands[i] - rhythm.prev[i];
      if (d > 0) flux += d;
    }
  } else {
    rhythm.prev = new Array(8);
  }
  for (i = 0; i < 8; i++) rhythm.prev[i] = bands[i];

  // 自适应阈值：滑动均值 + 方差（适应不同歌曲的响度与密度）
  var dm = flux - rhythm.fluxAvg;
  rhythm.fluxAvg += dm * 0.06;
  rhythm.fluxVar += (dm * dm - rhythm.fluxVar) * 0.06;
  var sigma = Math.sqrt(rhythm.fluxVar) || 0.001;

  // 三层节奏响应：
  //  常规节拍（低门槛）：密度采样 + 小雨滴 —— 逐拍贴合，规律感的来源
  //  重音（高门槛）：更大更亮的雨滴
  //  转折（下方）：中心大波
  var isBeat = flux > rhythm.fluxAvg + 1.1 * sigma && flux > 0.1;
  // live 重音门槛提高（2.8σ + 绝对下限 0.3）：明确的强调才算，
  // 稍微重一点的字不触发；有网格时重音完全交给离线标注
  var isAccent = flux > rhythm.fluxAvg + 2.8 * sigma && flux > 0.3;
  // 节拍网格存在时，常规拍的密度/雨滴由 gridTick 精确踩拍接管
  var gridActive = beatGrid.beats !== null;

  if (isBeat && !gridActive) {
    rhythm.beats.push(ts);
  }
  // 节奏密度：4s 窗口内的拍数（≈2.5 拍/秒 → 1）
  while (rhythm.beats.length > 0 && ts - rhythm.beats[0] > 4000) rhythm.beats.shift();
  rhythm.density += (Math.min(1, rhythm.beats.length / 10) - rhythm.density) * 0.1;

  // ---- 情绪值（arousal 回归，Tzanetakis & Cook 2002 / Yang et al. 2008）----
  // 关键：全部用绝对特征。自适应阈值派生的量（如 density）会把不同歌自动拉平，
  // 不能用于区分歌曲性格。
  // 谱质心（亮度）与高频占比：失真吉他/镲片 → 高；柔和合成器/人声 → 低
  var bsum = 0;
  var wsum = 0;
  for (i = 0; i < 8; i++) {
    bsum += bands[i];
    wsum += i * bands[i];
  }
  var centroid = bsum > 0.02 ? wsum / (7 * bsum) : 0;
  var highRatio = bsum > 0.02 ? (bands[5] + bands[6] + bands[7]) / bsum : 0;
  // 低能量率：当前帧显著低于慢均线的占比（动态呼吸 → 抒情特征，做减项）
  rhythm.lowRate += ((energy < rhythm.energySlow * 0.6 ? 1 : 0) - rhythm.lowRate) * 0.02;

  var arousal =
    Math.min(1, rhythm.fluxAvg / 0.3) * 0.35 +                            // 绝对通量均值（节奏活跃度）
    Math.min(1, Math.max(0, (centroid - 0.22) / 0.36)) * 0.25 +           // 亮度
    Math.min(1, highRatio * 2.4) * 0.2 +                                  // 高频占比
    Math.min(1, rhythm.energySlow / 0.4) * 0.2 -                          // 响度
    rhythm.lowRate * 0.15;                                                // 动态呼吸（抒情减项）
  arousal = Math.max(0, Math.min(1, arousal));
  // 对比度扩张（logistic，斜率 6）：把中间值推向两端，拉开缓和/激烈的观感距离
  var expanded = 1 / (1 + Math.exp(-6 * (arousal - 0.5)));
  rhythm.mood += (expanded - rhythm.mood) * 0.012; // ~5.5s 时间常数（歌曲段落级）

  if (isAccent && !gridActive && ts - rhythm.lastPulse > 380) {
    rhythm.lastPulse = ts;
    rhythm.lastBeatT = ts;
    fireRipple(Math.min(1, (flux - rhythm.fluxAvg) / (4 * sigma)), 'accent');
  } else if (isBeat && !gridActive && ts - rhythm.lastBeatT > 230) {
    // 常规拍（无网格时的实时兜底）：弱一档的小雨滴
    rhythm.lastBeatT = ts;
    fireRipple(Math.min(0.45, flux), 'beat');
  }

  // --- 转折：能量台阶跳变 或 频段画像突变（相对量，随歌曲响度自适应）---
  rhythm.energyFast += (energy - rhythm.energyFast) * 0.25;
  rhythm.energySlow += (energy - rhythm.energySlow) * 0.02;
  if (rhythm.warm < 999) rhythm.warm++;

  if (!rhythm.profile) rhythm.profile = bands.slice(0, 8);
  var dist = 0;
  for (i = 0; i < 8; i++) {
    var pd = bands[i] - rhythm.profile[i];
    dist += pd * pd;
    rhythm.profile[i] += pd * 0.02;
  }
  dist = Math.sqrt(dist / 8);

  // 相对量：绝对阈值对安静的歌永远够不着，必须按当前响度归一
  var level = Math.max(0.06, rhythm.energySlow);
  var jumpRel = Math.abs(rhythm.energyFast - rhythm.energySlow) / level;
  var distRel = dist / level;

  // 预热 3s（慢均线稳定）后才判定；副歌进入/drop 的典型 jumpRel ≈ 0.5~1.2
  if (rhythm.warm > 45 &&
      (jumpRel > 0.45 || distRel > 0.85) &&
      energy > 0.04 &&
      ts - rhythm.lastSweep > 4000) {
    rhythm.lastSweep = ts;
    var shiftStrength = Math.min(1, Math.max(jumpRel * 0.9, distRel * 0.6));
    try { console.debug('[music-player] shift! jumpRel=', jumpRel.toFixed(2), 'distRel=', distRel.toFixed(2)); } catch (e) {}
    fireRipple(shiftStrength, 'shift');
  }
}

// ========================================
// 节拍网格跟拍：预载全曲离线分析的精确拍点（media.getBeatGrid），
// 以音乐插值时钟为基准逐帧比对 → 视觉踩在拍点上（零检测滞后）。
// 网格存在时接管常规拍触发；重音/转折仍由实时引擎负责。
// ========================================
var beatGrid = {
  beats: null,      // 拍点时间数组（秒）
  accents: null,    // 重音拍索引查表（离线分析：全曲统计显著的强调拍）
  bpm: 0,
  idx: 0,           // 下一个待触发拍点
  songId: null,
};

function loadBeatGridForTrack(track) {
  if (!track || !track.id || beatGrid.songId === track.id) return;
  beatGrid.songId = track.id;
  beatGrid.beats = null;
  beatGrid.idx = 0;
  if (!Tapp.media || typeof Tapp.media.getBeatGrid !== 'function') return;
  Tapp.media.getBeatGrid().then(function(g) {
    if (beatGrid.songId !== track.id) return; // 期间已切歌
    if (g && g.available && g.confidence > 0.22 && g.beats && g.beats.length > 8) {
      beatGrid.beats = g.beats;
      beatGrid.bpm = g.bpm || 0;
      beatGrid.idx = 0;
      // 重音索引 → 查表对象（O(1) 命中判断）
      beatGrid.accents = null;
      if (g.accents && g.accents.length > 0) {
        var acc = {};
        for (var ai = 0; ai < g.accents.length; ai++) acc[g.accents[ai]] = 1;
        beatGrid.accents = acc;
      }
      try { console.debug('[music-player] beat grid:', g.bpm, 'BPM,', g.beats.length, 'beats,', (g.accents || []).length, 'accents, conf', g.confidence.toFixed(2)); } catch (e) {}
    }
  }).catch(function() {
    // 失败撤销标记，下一次状态事件自动重试
    if (beatGrid.songId === track.id) beatGrid.songId = null;
  });
}

// 每帧网格跟拍（由 eqTick 驱动）
function gridTick() {
  var b = beatGrid.beats;
  if (!b) return;
  var pos = getLyricPosition();
  var i = beatGrid.idx;
  // seek 倒退：指针重定位
  if (i >= b.length || (i > 0 && pos < b[i - 1] - 1)) i = 0;
  // 前进跳过已错过的拍（>80ms 视为错过，不补发）
  while (i < b.length && b[i] < pos - 0.08) i++;
  // 到拍：密度采样 + 雨滴（离线标注的重音拍 → 重音波）
  if (i < b.length && b[i] <= pos + 0.017) {
    var isAcc = !!(beatGrid.accents && beatGrid.accents[i]);
    rhythm.beats.push(nowMs());
    if (shouldAnimate()) {
      if (isAcc) {
        fireRipple(0.55 + rhythm.mood * 0.3 + Math.random() * 0.15, 'accent');
      } else {
        // 强度取当拍的真实低频能量：鼓点有轻有重，雨滴自然有大有小
        var hit = aurora.bands
          ? Math.min(1, (aurora.bands[0] + aurora.bands[1]) * 0.7)
          : 0.4;
        fireRipple(0.1 + hit * 0.6 + Math.random() * 0.12, 'beat');
      }
    }
    i++;
  }
  beatGrid.idx = i;
}

var eqLastUpdate = 0;
var EQ_INTERVAL = 66; // ~15fps 数据轮询
// 防崩溃壳：eqTick 驱动全部视觉效果（aurora/涟漪/网格踩拍/间奏点/自愈），
// 任何一帧异常若不捕获，循环静默死亡且句柄残留 → ensureEqLoop 永远无法重启 →
// 所有效果永久失效。异常只丢当帧并记录，循环必须活着。
function eqTick(ts) {
  var isPlaying = pageState.status && pageState.status.isPlaying;
  if (!isPlaying) { pageState.eqFrame = null; return; }
  try {
    eqTickBody(ts);
  } catch (e) {
    logTickError('eqTick', e);
  }
  pageState.eqFrame = requestAnimationFrame(eqTick);
}

function eqTickBody(ts) {
  if (ts - eqLastUpdate >= EQ_INTERVAL) {
    eqLastUpdate = ts;
    // 间奏呼吸点：进度点亮 + 焦点跟随（15fps 足够）
    updateInterludeDots();
    // 自愈：激活行类意外丢失（间奏降级/seek 竞态）且不在任何间奏内 → 恢复高亮。
    // 注意两点：
    //  1) gap 判定用完整区间 [start, end+0.1]——呼吸点提前 0.4s 熄灭，
    //     若用熄灭窗口判定，间奏尾段会误判「不在间奏」而把上一句重新点亮（闪回）
    //  2) 连续 3 次检查（~200ms）都缺激活行才修复，瞬态窗口不触发
    if (pageState.currentLyricIndex >= 0 && pageState.lyrics.length > 0 && lyricFx.inner) {
      // 快路径：卡拉OK缓存的激活行仍有效 → 免 querySelector
      var hasActive = !!(karaokeGeo.lineEl && karaokeGeo.lineEl.isConnected &&
                         karaokeGeo.lineEl.classList.contains('active'));
      if (!hasActive) {
        var alc = $('lyrics-container');
        hasActive = !!(alc && alc.querySelector('.lyric-line.active'));
      }
      if (!hasActive) {
        var posn = getLyricPosition();
        var inAnyGap = false;
        var dItems = lyricFx.dotsItems;
        if (dItems) {
          for (var gi = 0; gi < dItems.length; gi++) {
            if (posn >= dItems[gi].start && posn < dItems[gi].end + 0.1) {
              inAnyGap = true;
              break;
            }
          }
        }
        if (inAnyGap) {
          pageState.healStreak = 0;
        } else {
          pageState.healStreak = (pageState.healStreak || 0) + 1;
          if (pageState.healStreak >= 3) {
            pageState.healStreak = 0;
            renderLyrics(pageState.lyrics, pageState.currentLyricIndex);
          }
        }
      } else {
        pageState.healStreak = 0;
      }
    }
    // offsetParent 为 null 说明被 display:none 祖先隐藏，跳过对应消费方
    var eq = getActiveEqEl();
    var needEq = !!(eq && eq.offsetParent !== null);
    var needAurora = !!(aurora.el
      ? aurora.el.offsetParent !== null
      : $('artwork-aurora')) && shouldAnimate();
    if (needEq || needAurora) {
      Tapp.media.getSpectrum().then(function(r) {
        var s = (r && r.spectrum && r.spectrum.length >= 4) ? r.spectrum : [0, 0, 0, 0];
        if (needEq) updateListEq(s, eq);
        // Aurora 数据样本：优先原始 8 频段；旧前端无 bands 时由 4 柱数据降级映射
        if (r && r.bands && r.bands.length >= 8) {
          aurora.bands = r.bands;
        } else {
          // 降级：s 为重排 4 柱（低-高-高-低），粗略映射三段
          aurora.bands = [s[0], s[0], 0, s[2], s[2], s[1], s[3], 0];
        }
        // 节奏事件：重音/转折检测（触发即交给 CSS 合成器动画，无每帧渲染）
        rhythmTick(aurora.bands, ts);
      }).catch(function(e) {
        logTickError('spectrumPoll', e);
      });
    }
  }
  // 网格跟拍逐帧比对（60fps 精度踩拍）
  gridTick();
  // Aurora 渲染每帧运行（60fps 包络 + 公转），数据按 15fps 更新
  renderAurora(ts);
}

function ensureEqLoop() {
  if (pageState.status && pageState.status.isPlaying && !pageState.eqFrame) {
    pageState.eqFrame = requestAnimationFrame(eqTick);
  }
}

// 启动背景动画（纯环境漂移：慢速 translate/rotate，不跟随节拍）
function startBackgroundAnimation() {
  // 检查动画级别
  if (!shouldAnimate()) {
    return;
  }
  
  // 移动端禁用背景漂移（节省性能）
  if (checkIsMobile()) {
    return;
  }
  
  if (pageState.bgAnimationFrame) return;
  
  var lastUpdateTime = 0;
  // 根据动画级别调整帧率
  var UPDATE_INTERVAL = pageState.animConfig.level === 'light' ? 100 : 50; // light模式~10fps，standard~20fps
  
  function updateBackground(timestamp) {
    // 检查是否正在播放
    var isPlaying = pageState.status && pageState.status.isPlaying;
    
    if (!isPlaying) {
      // 暂停时定格在当前环境相位
      applyBackgroundTransform(pageState.bgPhase);
      pageState.bgAnimationFrame = null;
      return;
    }
    
    if (timestamp - lastUpdateTime >= UPDATE_INTERVAL) {
      lastUpdateTime = timestamp;
      pageState.bgPhase += 0.008; // 缓慢相位变化
      applyBackgroundTransform(pageState.bgPhase);
    }
    
    pageState.bgAnimationFrame = requestAnimationFrame(updateBackground);
  }
  
  pageState.bgAnimationFrame = requestAnimationFrame(updateBackground);
}

// 应用背景变换 - 使用缓存的元素引用
var cachedBgArtworkRef = null;

function applyBackgroundTransform(phase) {
  if (!cachedBgArtworkRef) cachedBgArtworkRef = $('bg-artwork');
  if (!cachedBgArtworkRef) return;
  
  // 固定轻微放大 + 缓慢位移/旋转（纯环境漂移，与节拍无关）
  var scale = 1.1;
  var sinPhase = Math.sin(phase);
  var cosPhase = Math.cos(phase * 0.7);
  var translateX = sinPhase * 15;
  var translateY = cosPhase * 15;
  var rotate = Math.sin(phase * 0.5) * 2;
  
  // 应用变换 - 使用位运算快速取整避免toFixed开销
  cachedBgArtworkRef.style.transform = 
    'scale(' + scale + ') ' +
    'translate(' + (translateX | 0) + 'px,' + (translateY | 0) + 'px) ' +
    'rotate(' + ((rotate * 100 | 0) / 100) + 'deg)';
}

// 停止背景动画
function stopBackgroundAnimation() {
  if (pageState.bgAnimationFrame) {
    cancelAnimationFrame(pageState.bgAnimationFrame);
    pageState.bgAnimationFrame = null;
  }
  // 重置背景变换
  var bgArtwork = $('bg-artwork');
  if (bgArtwork) {
    bgArtwork.style.transform = 'scale(1.1)';
  }
}

// 清理
function cleanup() {
  if (pageState.unsubscribe) {
    pageState.unsubscribe();
    pageState.unsubscribe = null;
  }
  if (pageState.unsubscribeProgress) {
    pageState.unsubscribeProgress();
    pageState.unsubscribeProgress = null;
  }
  // 清理逐字歌词 rAF
  if (pageState.lyricWordFrame) {
    cancelAnimationFrame(pageState.lyricWordFrame);
    pageState.lyricWordFrame = null;
  }
  // 清理列表均衡器 rAF
  if (pageState.eqFrame) {
    cancelAnimationFrame(pageState.eqFrame);
    pageState.eqFrame = null;
  }
  // 清理歌词波浪引擎
  stopLyricWave();
  if (lyricResumeTimer) {
    clearTimeout(lyricResumeTimer);
    lyricResumeTimer = null;
  }
  // 清理背景动画
  stopBackgroundAnimation();
}

// ========================================
// 生命周期入口
// ========================================

(function() {
  var mode = window._TAPP_MODE;

  if (mode === 'page') {
    Tapp.lifecycle.onReady(async function() {
      try {
        // 并行初始化所有配置
        var results = await Promise.all([
          Tapp.ui.getLocale(),
          Tapp.ui.getTheme(),
          initAnimationConfig() // 初始化动画调度器配置
        ]);

        setLocale(normalizeLocale(results[0]));
        
        // 应用初始主题（深色/浅色模式）
        applyTheme(results[1]);
        
        await initPage();

        // 恢复翻译开关偏好（持久化；storage 权限已在 manifest 声明）
        if (Tapp.storage && Tapp.storage.get) {
          Tapp.storage.get('lyricTransOn').then(function(v) {
            if (v === true || v === 'true') setLyricTransOn(true);
          }).catch(function() {});
        }

        // 监听语言变化
        Tapp.ui.onLocaleChange(function(locale) {
          setLocale(normalizeLocale(locale));
          initPage();
        });

        // 监听主题变化（深色/浅色模式切换）
        Tapp.ui.onThemeChange(function(theme) {
          applyTheme(theme);
        });
      } catch (err) {
        console.error('Init error:', err);
        initPage();
      }
    });

    Tapp.lifecycle.onDestroy(function() {
      cleanup();
    });
  }
})();
