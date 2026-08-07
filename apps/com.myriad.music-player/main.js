// Music Player Tapp v1.1.5

var MP_DEBUG = false;
function mpDebug() {
  if (!MP_DEBUG || !console || !console.debug) return;
  try { console.debug.apply(console, arguments); } catch (e) {}
}

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
    noLyricsHint: '纯音乐，或暂未获取到歌词',
    lyricsLoading: '歌词加载中…',
    translate: '翻译',
    visualFx: '动效',
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
    buffering: '缓冲中…',
    loadingTrack: '正在切歌…',
    emptyHint: '从控制面板开启音乐，或导入网易云歌单',
    jumpToCurrent: '定位当前',
    statusError: '播放异常，已尝试跳过',
    keyboardHint: '空格播放 · ←→ 切歌 · ↑↓ 音量',
    noSearchResults: '未找到匹配歌曲',
    seeking: '跳转中…',
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
    noLyricsHint: 'Instrumental, or lyrics unavailable',
    lyricsLoading: 'Loading lyrics…',
    translate: 'Translate',
    visualFx: 'Effects',
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
    buffering: 'Buffering…',
    loadingTrack: 'Switching track…',
    emptyHint: 'Enable music in the control panel, or import a playlist',
    jumpToCurrent: 'Jump to current',
    statusError: 'Playback error, skipping…',
    keyboardHint: 'Space play · ←→ tracks · ↑↓ volume',
    noSearchResults: 'No matching songs',
    seeking: 'Seeking…',
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
    noLyricsHint: 'インスト、または歌詞を取得できません',
    lyricsLoading: '歌詞を読込中…',
    translate: '翻訳',
    visualFx: '演出',
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
    buffering: 'バッファ中…',
    loadingTrack: '曲を切替中…',
    emptyHint: 'コントロールパネルで音楽を有効化、または歌単を読込',
    jumpToCurrent: '再生中へ',
    statusError: '再生エラー、スキップします',
    keyboardHint: 'Space再生 · ←→曲 · ↑↓音量',
    noSearchResults: '一致する曲がありません',
    seeking: 'シーク中…',
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
  // 刷新依赖 i18n 的静态控件文案
  Fab.setLabel($('jump-current-btn'), t('jumpToCurrent'));
  Fab.setLabel($('visual-fx-btn'), t('visualFx'));
  Fab.setLabel($('lyric-trans-btn'), t('translate'));
  var emptyHint = $('player-empty-hint');
  if (emptyHint && !emptyHint.hidden) emptyHint.textContent = t('emptyHint');
  applyStaticLabels();
}

function t(key) {
  return currentDict[key] || key;
}

// ========================================
// Fab — 通用右下角浮动图标按钮组件
// 统一：定位当前 / 动效开关 / 翻译开关 等
// ========================================
var Fab = {
  /** 开关态（.active + aria-pressed） */
  setActive: function(btn, on) {
    if (!btn) return;
    var active = !!on;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  },
  /** 显示/隐藏（hidden 属性，配合 CSS [hidden]） */
  setHidden: function(btn, hidden) {
    if (!btn) return;
    if (hidden) btn.setAttribute('hidden', '');
    else btn.removeAttribute('hidden');
  },
  /** 无障碍文案 + tooltip */
  setLabel: function(btn, label) {
    if (!btn || label == null) return;
    var s = String(label);
    btn.setAttribute('aria-label', s);
    btn.setAttribute('title', s);
  },
  /** 绑定点击（需传入与移动端兼容的 addClickHandler） */
  bind: function(btn, handler, addClickHandler) {
    if (!btn || typeof handler !== 'function') return;
    if (typeof addClickHandler === 'function') addClickHandler(btn, handler);
    else btn.addEventListener('click', function(e) {
      e.preventDefault();
      handler(e);
    });
  }
};



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
      pageState.animConfig.shouldAnimate = !isAnimMinimal(level);

      // 根据新级别调整动画（light：无背景漂移；最低档：全停）
      if (isAnimMinimal(level) || level === 'light') {
        stopBackgroundAnimation();
      } else if (pageState.status && pageState.status.isPlaying) {
        startBackgroundAnimation();
      }
      if (isAnimMinimal(level) || level === 'light') {
        clearRhythmRipples();
      }
      syncFxCompositing();
      // 帧率策略随 level 变化，立即重调度
      if (pageState.status && pageState.status.isPlaying) restartEqLoop();
    });
  } catch (e) {
    // 使用默认配置
    console.warn('Failed to load animation config:', e);
  }
}

// 宿主的档位词表是 'exlight' | 'light' | 'standard'（见 useAnimationLevel.ts），
// 其中 'exlight' 正是 prefers-reduced-motion 的落点且**不可被用户覆盖**。
// 本文件此前一律按 'none' 判断——宿主从不下发这一档，于是：
//   ① shouldAnimate() 里的 level !== 'none' 是恒真死条件；
//   ② onLevelChange 把 shouldAnimate 重算成 level !== 'none'，exlight 得到 true，
//      把初始那次正确的 false 覆盖掉；
//   ③ isAnimLight() 不认识 exlight，于是走完整 standard 路径。
// 结果就是减弱动效的用户在档位事件后拿到最重的视觉路径。'none' 保留只为向后兼容。
function isAnimMinimal(level) {
  var l = level || pageState.animConfig.level;
  return l === 'exlight' || l === 'none';
}

// 检查是否应该执行动画（系统级外层门控）
function shouldAnimate() {
  return pageState.animConfig.shouldAnimate && !isAnimMinimal();
}

// 动态视觉效果是否启用：用户开关 ∧ 系统 shouldAnimate ∧ 非移动端
// 移动端强制关闭 Aurora / 涟漪 / 背景漂移；列表 EQ / 歌词微动画不经此门控
function visualFxEnabled() {
  return pageState.visualFxOn && shouldAnimate() && !checkIsMobile();
}

// 系统动画级别为 light：降级重视觉（涟漪/背景漂移关闭，Aurora 简化）
// 列表 EQ 与 visualFx 开关语义不变
function isAnimLight() {
  // exlight 比 light 更省：即便某条 FX 路径被走到，也必须拿轻量分支
  return pageState.animConfig.level === 'light' || isAnimMinimal();
}

// 播放中 + FX 有效启用时挂 will-change 合成层；暂停/关 FX/移动端时卸下
function syncFxCompositing() {
  var on = !!(visualFxEnabled() &&
    pageState.status && pageState.status.isPlaying);
  document.documentElement.classList.toggle('fx-compositing', on);
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
  lyricsSongId: null,      // 已成功加载并展示的歌词所属歌曲 id
  lyricsLoadingTrackId: null, // 正在请求歌词的曲目（防 progress 热路径重复 load）
  lyricsRequestGen: 0,     // 歌词请求代数：快速切歌时丢弃过期 getLyrics 回包
  lyricsLoadState: 'idle', // idle | loading | ready | empty — 驱动无歌词布局
  // 宿主切歌世代：与 status.generation / track.id 对齐，丢弃过期 UI 补丁
  boundTrackId: null,
  boundGeneration: 0,
  preferredTab: 'none',  // 默认面板（storage 持久化）
  statusBanner: '',        // 顶部轻量状态条文案
  statusBannerTimer: null,
  // 歌词翻译（随 getLyrics 各行 translation 字段带回；Phase 1 仅网易中文源）
  hasTranslation: false,   // 当前歌曲是否有翻译数据
  transLang: '',           // 翻译语言（'zh' | ''）
  transOn: false,          // 翻译显示开关（持久化于 Tapp.storage）
  visualFxOn: true,        // 动态视觉效果开关（持久化于 Tapp.storage，默认开；移动端运行时强制 off）
  lyricWordFrame: null,    // 逐字高亮 rAF 句柄
  lastKaraokeLine: -1,     // 上一次做逐字填充的行索引
  eqFrame: null,           // 视觉/EQ 循环 rAF 句柄
  eqTimer: null,           // 低帧率维护/轮询 setTimeout 句柄（与 eqFrame 互斥）
  autoScrollEnabled: true, // 自动滚动开关（点击歌词跳转时临时禁用）
  unsubscribe: null,
  unsubscribeProgress: null,
  // 背景漂移状态（由 eqTick 低帧率驱动，无独立 rAF）
  bgDriftOn: false,        // 是否应在 eqTick 中推进背景相位
  bgPhase: 0,
  // 统一动画调度器配置
  animConfig: {
    level: 'standard',        // 宿主词表：'exlight' | 'light' | 'standard'
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
// MediaBridge：曲目归属 / 状态条 / 空态（1.0.3）
// ========================================

/** 当前事件是否仍属于「绑定中的曲 + 世代」 */
function isStatusCurrent(status) {
  if (!status) return false;
  var track = status.currentTrack;
  var tid = track ? String(track.id) : null;
  // 无曲：仅当本端也无绑定时视为 current（空态刷新）
  if (!tid) return pageState.boundTrackId == null;
  if (pageState.boundTrackId != null && String(pageState.boundTrackId) !== tid) {
    return false;
  }
  var gen = typeof status.generation === 'number' ? status.generation : null;
  if (gen != null && pageState.boundGeneration > 0 && gen < pageState.boundGeneration) {
    return false;
  }
  return true;
}

/**
 * 切歌时绑定新曲 + 世代。
 *
 * boundGeneration 只允许存**宿主给的**世代号，绝不本地自增：
 * isStatusCurrent 是拿事件里的 status.generation 跟它比大小，本地计数器与
 * 宿主计数器是两套编号，混用会直接判错。宿主的 generation 从 0 起步且只有
 * 选歌才 ++，本地若先自增到 1，之后每个带 generation:0 的事件都会被判为过期，
 * updatePlayerUI / updateProgressOnly 永久跳过（封面标题进度全冻结）。
 * 宿主不下发世代时，串曲由 boundTrackId 比较兜住，无需世代。
 */
function bindTrackFromStatus(status) {
  var track = status && status.currentTrack;
  var tid = track ? String(track.id) : null;
  var gen = (status && typeof status.generation === 'number') ? status.generation : 0;
  pageState.boundTrackId = tid;
  if (gen > 0) {
    pageState.boundGeneration = gen;
  }
}

function showStatusBanner(msg, ms) {
  pageState.statusBanner = msg || '';
  var el = $('status-banner');
  if (!el) return;
  if (!msg) {
    el.textContent = '';
    el.hidden = true;
    el.classList.remove('visible');
    return;
  }
  el.textContent = msg;
  el.hidden = false;
  el.classList.add('visible');
  if (pageState.statusBannerTimer) {
    clearTimeout(pageState.statusBannerTimer);
    pageState.statusBannerTimer = null;
  }
  var hold = typeof ms === 'number' ? ms : 2200;
  if (hold > 0) {
    pageState.statusBannerTimer = setTimeout(function() {
      pageState.statusBannerTimer = null;
      if (pageState.statusBanner === msg) showStatusBanner('');
    }, hold);
  }
}

function updateEmptyAndLoadingUI(status) {
  var root = document.documentElement;
  var hasTrack = !!(status && status.currentTrack);
  var loading = !!(status && (status.isLoading || status.isAudioLoading));
  root.classList.toggle('mp-has-track', hasTrack);
  root.classList.toggle('mp-empty', !hasTrack);
  root.classList.toggle('mp-has-error', !!(status && status.lastError));

  var emptyEl = $('player-empty-hint');
  if (emptyEl) {
    emptyEl.hidden = hasTrack;
    if (!hasTrack) emptyEl.textContent = t('emptyHint');
  }

  // 封面不再盖加载层；状态条仅用于错误（避免切歌时横幅刷屏）
  if (status && status.lastError) {
    showStatusBanner(t('statusError'), 3200);
  } else if (
    pageState.statusBanner === t('loadingTrack') ||
    pageState.statusBanner === t('buffering') ||
    pageState.statusBanner === t('statusError')
  ) {
    // 错误消失 / 切到新曲后收起（lastError 清空时）
    if (!(status && status.lastError)) showStatusBanner('');
  }
}

/** 仅首屏无任何主题时使用；切歌中绝不刷回默认，避免闪色 */
var NEUTRAL_THEME = {
  primary: '#8e8e93',
  secondary: '#aeaeb2',
  accent: '#636366',
  light: '#d1d1d6',
  dark: '#3a3a3c'
};

function isFallbackThemeColor(c) {
  if (!c) return true;
  var s = String(c).toLowerCase();
  return s === '#ef4444' || s === '#fc3c44' || s === '#8e8e93';
}

/**
 * 应用主题色。
 * - 宿主 hasThemePalette===false / 默认红 / 空色：若已有 lastColors 则跳过
 * - 仅真实取色结果才覆盖
 */
function applyThemeColors(status, forceNeutral) {
  var root = document.documentElement;
  var incoming = status && status.primaryColor;
  var hostSaysReal = status && status.hasThemePalette === true;
  var hostSaysPlaceholder = status && status.hasThemePalette === false;
  var isFallback = forceNeutral || hostSaysPlaceholder ||
    (!hostSaysReal && (
      isFallbackThemeColor(incoming) ||
      (status && status.secondaryColor && isFallbackThemeColor(status.secondaryColor) &&
       status.secondaryColor === status.primaryColor)
    ));

  // 已有主题且新状态不是可靠新色 → 保持上一首，杜绝闪默认色
  if (isFallback && lastColors.primary) {
    return;
  }

  var primary = (!isFallback && incoming) ? incoming : (lastColors.primary || NEUTRAL_THEME.primary);
  if (isFallback && !lastColors.primary) {
    primary = NEUTRAL_THEME.primary;
  }
  var secondary = (!isFallback && status && status.secondaryColor)
    ? status.secondaryColor
    : (lastColors.secondary || primary);
  var accent = (!isFallback && status && status.accentColor)
    ? status.accentColor
    : (lastColors.accent || secondary);
  var light = (!isFallback && status && status.lightColor)
    ? status.lightColor
    : (lastColors.light || NEUTRAL_THEME.light);
  var dark = (!isFallback && status && status.darkColor)
    ? status.darkColor
    : (lastColors.dark || NEUTRAL_THEME.dark);

  var did = false;
  // 只写 --music-*，--accent-* 由 CSS 从 var(--music-primary) 派生，便于整轨插值
  if (primary !== lastColors.primary) {
    lastColors.primary = primary;
    root.style.setProperty('--music-primary', primary);
    did = true;
  }
  if (secondary !== lastColors.secondary) {
    lastColors.secondary = secondary;
    root.style.setProperty('--music-secondary', secondary);
    did = true;
  }
  if (accent !== lastColors.accent) {
    lastColors.accent = accent;
    root.style.setProperty('--music-accent', accent);
    did = true;
  }
  if (light !== lastColors.light) {
    lastColors.light = light;
    root.style.setProperty('--music-light', light);
    did = true;
  }
  if (dark !== lastColors.dark) {
    lastColors.dark = dark;
    root.style.setProperty('--music-dark', dark);
    did = true;
  }
  if (did) applyLyricReadableColors();
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
  viewW: 0,           // 容器宽度：0 宽时 offsetHeight 会按换行炸高，必须一并校验
  measured: false,
  measuredWithTrans: false, // 本次测量时 show-trans 是否开启（行高与翻译显隐绑定）
  everMeasured: false, // 本次 DOM 重建后是否成功测过一次（未测过 = 全行叠在 top:0，先藏）
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
  layoutGen: 0,       // 布局代数：重建/作废时递增，丢弃过期 deferred remeasure
  songId: null,       // 当前 lyricFx 对应的歌词歌曲 id
  remeasureRaf: null, // 双 rAF 延迟重测句柄
  remeasureTimer: null, // 侧栏展开过渡结束后的兜底重测
  ro: null,           // 容器 ResizeObserver（cleanup 时断开）
  roTimer: null,      // RO 防抖句柄
  settleUntil: 0,     // 侧栏列宽过渡结束前挂起测量（时间戳，ms）
};
var lyricResumeTimer = null;

var LYRIC_FOCAL = 0.45;          // 焦点位：容器高度上部 45%（略高于居中）
var LYRIC_SCALE_INACTIVE = 0.62; // 非激活行缩放（40px × 0.62 ≈ 25px 视觉，激活 40px，对比 1.6×）
var LYRIC_WAVE_DELAY = 42;       // 波浪每行错峰 ms
var LYRIC_WAVE_SPAN = 7;         // 波浪最多错峰的行数
// 顺序推进（含跳过一两句短行）走波浪；超过这个跨度算 seek，瞬移到位
var LYRIC_SEEK_JUMP_LINES = 3;

// 焦点跨度是否属于「seek 级跳转」：首次定位、大跨度都算
//
// ⚠️ prevIdx === -1 不能一律当 seek。前奏与间奏期间 currentLyricIndex 就是 -1，
// 顺序播进第一句正是 -1 → 0——判成 seek 会让**首句**独独瞬移、其余行照常波浪
// （1.1.37 起的老账：首句动画丢失）。此时该看的是「焦点要挪多远」而不是行号差：
// 前奏刚过时焦点就停在第一句或它上面那组呼吸点，距离 0~1 行，是彻头彻尾的顺序推进；
// 而从第 30 句 seek 回开头，焦点要跨半张歌单，仍旧该瞬移。
// 呼吸点也占一个 items 槽位，故这一支按 items 下标算距离（阈值同样只用来区分
// 「相邻」与「远」，混入呼吸点不影响判定）。
function isLyricSeekJump(prevIdx, nextIdx) {
  if (typeof prevIdx !== 'number' || nextIdx < 0) return true;
  if (prevIdx < 0) {
    if (lyricFx.focusK < 0) return true; // 从未定过焦 = 真·首次定位
    var k = findLyricItemK(nextIdx);
    if (k < 0) return true;
    return Math.abs(k - lyricFx.focusK) > LYRIC_SEEK_JUMP_LINES;
  }
  return Math.abs(nextIdx - prevIdx) > LYRIC_SEEK_JUMP_LINES;
}

function stopLyricWave() {
  if (lyricFx.raf) {
    cancelAnimationFrame(lyricFx.raf);
    lyricFx.raf = null;
  }
  lyricFx.momentumV = 0;
}

// 作废测量缓存（切歌/重建/翻译开关）
function resetLyricFxLayoutCache(opts) {
  opts = opts || {};
  lyricFx.measured = false;
  lyricFx.measuredWithTrans = false;
  lyricFx.focusK = -1;
  lyricFx.momentumV = 0;
  if (opts.clearScroll !== false) {
    lyricFx.targetS = 0;
    lyricFx.minS = 0;
    lyricFx.maxS = 0;
    lyricFx.total = 0;
    lyricFx.viewH = 0;
    lyricFx.viewW = 0;
  }
  if (opts.bumpGen !== false) lyricFx.layoutGen++;
  if (lyricFx.remeasureRaf) {
    cancelAnimationFrame(lyricFx.remeasureRaf);
    lyricFx.remeasureRaf = null;
  }
  if (lyricFx.remeasureTimer) {
    clearTimeout(lyricFx.remeasureTimer);
    lyricFx.remeasureTimer = null;
  }
}

// 面板不可见时 w/h 为 0；列宽过渡中会扫过一串中间宽度。
// 下限只挡住折叠态，中间宽度由 lyricMeasureSuspended() 挡。
var LYRIC_MIN_VIEW_W = 80;
var LYRIC_MIN_VIEW_H = 40;

var LYRIC_PREMEASURE_MAX_MS = 1200; // 远长于列宽过渡（约 0.46s）+ settle
var lyricPremeasureTimer = null;

/**
 * 首测落地前把歌词整体藏起来。
 * 歌词行是 position:absolute; top:0，纵向位置全靠引擎写 transform，而 y 要等
 * measureLyricLayout 量完行高才有——测出来之前每一行的 y/pos 都是 0，**整首叠成一行**。
 * 侧栏展开时这段尤其长：suspendLyricMeasure 把整个列宽过渡期间的测量全挡掉，
 * 于是「首次打开歌词」必然先糊一坨再散开。
 * 只由 buildLyricDom 在**当帧测不出布局时**挂上（测得出就根本不用藏，见那里的注释）。
 */
function setLyricPremeasure(on) {
  var c = $('lyrics-container');
  if (c) c.classList.toggle('lyrics-premeasure', !!on);
  if (lyricPremeasureTimer) {
    clearTimeout(lyricPremeasureTimer);
    lyricPremeasureTimer = null;
  }
  if (!on) return;
  // 安全阀：测量若因任何原因迟迟不落地（.content-area 上挂了别的动画让
  // sideLayoutAnimating 一直为真、容器尺寸卡在阈值下……），宁可露出叠在一起的
  // 歌词，也不能让整块歌词永久隐身——那是比「糊一坨」更难查的坏法。
  // ⚠️ 计时不能从建 DOM 起算：歌词往往在面板还关着时就建好了，那样这一枪
  // 早在用户点开之前就放空了。面板没展开就不算「卡住」，继续等
  lyricPremeasureTimer = setTimeout(function tick() {
    lyricPremeasureTimer = null;
    var el = $('lyrics-container');
    if (el && (el.clientWidth < LYRIC_MIN_VIEW_W || el.clientHeight < LYRIC_MIN_VIEW_H)) {
      lyricPremeasureTimer = setTimeout(tick, LYRIC_PREMEASURE_MAX_MS);
      return;
    }
    setLyricPremeasure(false);
  }, LYRIC_PREMEASURE_MAX_MS);
}

/**
 * 测行高并建立 y 布局。
 * force=true 仅供「过渡真的结束了」的权威重测使用；其余调用在列宽过渡期间一律拒测，
 * 否则会拿中间宽度算出偏高的行（0.46s 过渡里肉眼可见地错一下）。
 */
function measureLyricLayout(force) {
  var container = $('lyrics-container');
  if (!container || !lyricFx.inner || lyricFx.items.length === 0) return false;
  if (!force && lyricMeasureSuspended()) return false;
  var h = container.clientHeight;
  var w = container.clientWidth;
  if (h < LYRIC_MIN_VIEW_H || w < LYRIC_MIN_VIEW_W) return false;

  void container.offsetHeight;
  var showingTrans = container.classList.contains('show-trans');
  var y = 0;
  var anyH = false;
  for (var k = 0; k < lyricFx.items.length; k++) {
    var it = lyricFx.items[k];
    it.h = it.el.offsetHeight || 0;
    if (it.h > 0) anyH = true;
    it.y = y;
    y += it.h;
  }
  if (!anyH) {
    lyricFx.measured = false;
    return false;
  }

  lyricFx.total = y;
  lyricFx.viewH = h;
  lyricFx.viewW = w;
  // 首测落地：解除「重建后先藏起来」，此后 resize / 翻译开关的重测都不再遮
  if (!lyricFx.everMeasured) {
    lyricFx.everMeasured = true;
    setLyricPremeasure(false);
  }
  var first = lyricFx.items[0];
  var last = lyricFx.items[lyricFx.items.length - 1];
  var minS = first.y - h * LYRIC_FOCAL + first.h / 2;
  var maxS = last.y - h * LYRIC_FOCAL + last.h / 2;
  if (minS > maxS) {
    var mid = (minS + maxS) / 2;
    minS = maxS = mid;
  }
  lyricFx.minS = minS;
  lyricFx.maxS = maxS;
  lyricFx.measured = true;
  lyricFx.measuredWithTrans = showingTrans;
  return true;
}

/** 尺寸 / show-trans 变了就重测；否则直接 true */
function ensureLyricLayoutReady() {
  if (lyricFx.items.length === 0 || !lyricFx.inner) return false;
  var container = $('lyrics-container');
  if (!container) return false;
  var h = container.clientHeight;
  var w = container.clientWidth;
  if (h < LYRIC_MIN_VIEW_H || w < LYRIC_MIN_VIEW_W) return false;
  var showingTrans = container.classList.contains('show-trans');
  if (lyricFx.measured &&
      lyricFx.measuredWithTrans === showingTrans &&
      Math.abs(h - lyricFx.viewH) <= 4 &&
      Math.abs(w - lyricFx.viewW) <= 4) {
    return true;
  }
  // 列宽过渡中：沿用上一次布局，且**不能**清 measured——清了之后本次测量必然被拒，
  // focusLyricItemK 会因 ensureLyricLayoutReady() 为 false 而整条罢工（歌词卡住不动）
  if (lyricMeasureSuspended()) return lyricFx.measured;
  lyricFx.measured = false;
  return measureLyricLayout();
}

/** 测完后回焦（或保持手动滚动位置）。force 由过渡结束的权威重测传入 */
function applyLyricLayoutRemeasure(gen, songId, force) {
  if (gen !== lyricFx.layoutGen) return false;
  if (songId != null && String(pageState.lyricsSongId) !== String(songId)) return false;
  if (lyricFx.items.length === 0) return false;
  lyricFx.measured = false;
  if (!measureLyricLayout(force)) return false;
  lyricFx.focusK = -1;
  if (pageState.autoScrollEnabled) {
    var idx = pageState.currentLyricIndex >= 0 ? pageState.currentLyricIndex : 0;
    focusLyricLine(idx, true);
  } else {
    lyricFx.targetS = clampLyricS(lyricFx.targetS);
    snapLyricItems();
  }
  return true;
}

/**
 * 布局未稳时延迟重测。
 * afterMs：侧栏 grid / sheet 过渡结束后再测一次（可选）。
 */
function scheduleLyricLayoutRemeasure(afterMs) {
  if (lyricFx.items.length === 0) return;
  var gen = lyricFx.layoutGen;
  var songId = pageState.lyricsSongId;
  if (lyricFx.remeasureRaf) {
    cancelAnimationFrame(lyricFx.remeasureRaf);
    lyricFx.remeasureRaf = null;
  }
  lyricFx.remeasureRaf = requestAnimationFrame(function() {
    lyricFx.remeasureRaf = requestAnimationFrame(function() {
      lyricFx.remeasureRaf = null;
      applyLyricLayoutRemeasure(gen, songId);
    });
  });
  if (afterMs != null && afterMs > 0) {
    if (lyricFx.remeasureTimer) {
      clearTimeout(lyricFx.remeasureTimer);
      lyricFx.remeasureTimer = null;
    }
    lyricFx.remeasureTimer = setTimeout(function() {
      lyricFx.remeasureTimer = null;
      // 兜底权威重测：过渡若已结束就强制测一次（transitionend 丢失时的保险）
      lyricFx.settleUntil = 0;
      applyLyricLayoutRemeasure(gen, songId, !sideLayoutAnimating());
    }, afterMs);
  }
}

function clampLyricS(s) {
  if (lyricFx.minS > lyricFx.maxS) return (lyricFx.minS + lyricFx.maxS) / 2;
  return Math.max(lyricFx.minS, Math.min(lyricFx.maxS, s));
}

function findLyricItemK(lineIdx) {
  for (var k = 0; k < lyricFx.items.length; k++) {
    if (lyricFx.items[k].type === 'line' && lyricFx.items[k].idx === lineIdx) return k;
  }
  return -1;
}

// 视口外剔除带（上下各留一屏）。viewH 未测出时返回 null = 不剔除。
function lyricCullBand() {
  var vh = lyricFx.viewH || 0;
  if (vh < LYRIC_MIN_VIEW_H) return null;
  // 可视区其实只有 0..vh，上下各留 0.4 屏缓冲即可（一帧最多挪几十 px，绰绰有余）。
  // 原来上下各留满满一屏 = 3 屏高的带，845px 视口下同时有 44 行在画、每行还各带
  // 一层 blur；收到 1.8 屏后降到 ~25 行，GPU 侧的模糊面直接少掉四成。
  return { top: -vh * 0.4, bottom: vh * 1.4 };
}

/**
 * 屏外行退出绘制。
 * 每行都带 blur(5px) + will-change，长歌单就是上百个各自要做模糊的合成层，
 * 滚动时逐帧全量重绘——这是滚动卡顿的主要来源。visibility:hidden 仍保留布局盒
 * （measureLyricLayout 读 offsetHeight 不受影响），但不再绘制/合成。
 */
function setLyricItemVisible(it, visible) {
  if (it._vis === visible) return;
  it._vis = visible;
  it.el.style.visibility = visible ? '' : 'hidden';
  // will-change 只挂在可视带内的行上。CSS 里写在 .lyric-line 基础样式里，
  // 意味着 200 行歌单会常驻 200 个合成层（每层还各自带 blur），
  // 光是层树维护就够拖垮滚动——屏外行退回 auto，让浏览器把层收掉。
  it.el.style.willChange = visible ? 'transform' : 'auto';
}

function snapLyricItems() {
  var band = lyricCullBand();
  for (var k = 0; k < lyricFx.items.length; k++) {
    var it = lyricFx.items[k];
    it.pos = it.y - lyricFx.targetS;
    it.v = 0;
    it.scale = it.targetScale;
    it.scaleV = 0;
    var vis = !band || (it.pos > band.top && it.pos < band.bottom);
    setLyricItemVisible(it, vis);
    if (!vis) {
      // 与波浪同一套不变量：屏外行不写 DOM，写入缓存作废，进带那帧再补
      it._wy = NaN;
      it._ws = NaN;
      continue;
    }
    it._wy = Math.round(it.pos * 100);
    it._ws = Math.round(it.scale * 10000);
    it.el.style.transform =
      'translate3d(0,' + it.pos.toFixed(2) + 'px,0) scale(' + it.scale.toFixed(4) + ')';
  }
}

function focusLyricItemK(k, instant) {
  if (k < 0 || k >= lyricFx.items.length) return;
  if (!ensureLyricLayoutReady()) return;
  var it = lyricFx.items[k];
  var desiredS = it.y - lyricFx.viewH * LYRIC_FOCAL + it.h / 2;
  var samePos = !instant && lyricFx.focusK === k && Math.abs(desiredS - lyricFx.targetS) < 1;

  var now = performance.now();
  var scaleChanged = false;
  for (var j = 0; j < lyricFx.items.length; j++) {
    var o = lyricFx.items[j];
    if (!samePos) {
      var d = j - k;
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

/** 容器尺寸或 show-trans 变化时重测并回焦 */
function relayoutLyricsIfNeeded(allowUnmeasured, force) {
  if (lyricFx.items.length === 0) return;
  if (!lyricFx.measured && !allowUnmeasured && !force) return;
  var c = $('lyrics-container');
  if (!c) return;
  var h = c.clientHeight;
  var w = c.clientWidth;
  if (h < LYRIC_MIN_VIEW_H || w < LYRIC_MIN_VIEW_W) return;
  var showingTrans = c.classList.contains('show-trans');
  var need = force || !lyricFx.measured ||
    Math.abs(h - lyricFx.viewH) > 4 ||
    Math.abs(w - lyricFx.viewW) > 4 ||
    lyricFx.measuredWithTrans !== showingTrans;
  if (!need) return;
  lyricFx.measured = false;
  if (measureLyricLayout()) {
    lyricFx.focusK = -1;
    var idx = pageState.currentLyricIndex >= 0 ? pageState.currentLyricIndex : 0;
    focusLyricLine(idx, true);
  }
}

// 桌面列宽过渡 0.46s（page.css .content-area），留一点余量再做权威重测
var SIDE_LAYOUT_TRANSITION_MS = 520;

function getSideLayoutSettleMs() {
  // 移动端是 Sheet 入场约 0.36s；桌面是 grid 列宽过渡
  try {
    if (typeof checkIsMobile === 'function' && checkIsMobile()) return 380;
  } catch (e) { /* ignore */ }
  return SIDE_LAYOUT_TRANSITION_MS;
}

/**
 * 过渡期间挂起歌词测量。
 * 列宽过渡中容器会扫过一串中间宽度（起点甚至只有几 px），此时测出的行高属于
 * 别的宽度——最窄那几帧还会让 pre-wrap 歌词炸高并锁死滚动（1.1.34–1.1.36 的老账）。
 * 挂起窗口内只沿用上一次布局，过渡结束后做一次权威重测。
 */
function suspendLyricMeasure(ms) {
  var until = nowMs() + (ms || getSideLayoutSettleMs());
  if (until > lyricFx.settleUntil) lyricFx.settleUntil = until;
}

/** .content-area 的列宽过渡是否仍在跑（比纯计时更准，慢机器上也不会提前放行） */
function sideLayoutAnimating() {
  var ca = document.querySelector('.content-area');
  if (!ca || typeof ca.getAnimations !== 'function') return false;
  try {
    var list = ca.getAnimations();
    for (var i = 0; i < list.length; i++) {
      if (list[i].playState === 'running') return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

function lyricMeasureSuspended() {
  return nowMs() < lyricFx.settleUntil || sideLayoutAnimating();
}

/** 列宽过渡结束即做一次权威重测（不必等 settle 定时器） */
function bindSideLayoutTransitionEnd() {
  var ca = document.querySelector('.content-area');
  if (!ca || ca._mpTransBound) return;
  ca._mpTransBound = true;
  ca.addEventListener('transitionend', function(e) {
    if (e.target !== ca) return;
    if (e.propertyName !== 'grid-template-columns' && e.propertyName !== 'column-gap') return;
    lyricFx.settleUntil = 0; // 过渡真结束，立刻放行测量
    if (lyricFx.items.length === 0) return;
    applyLyricLayoutRemeasure(lyricFx.layoutGen, pageState.lyricsSongId, true);
  });
}

/**
 * 打开歌词面板后测量。
 * 立刻刷盘测一次；双 rAF + 短 settle 再测；ResizeObserver 处理后续尺寸变化。
 */
function forceLyricsPanelRelayout(/* soft */) {
  if (lyricFx.items.length === 0) return;
  // 打开/关闭侧栏必然触发列宽过渡：整段过渡期间不接受中间宽度的测量结果
  suspendLyricMeasure();
  // 强制样式刷盘：class 刚挂上时读到的可能仍是旧几何
  var pr = $('player-right');
  var c = $('lyrics-container');
  if (pr) void pr.offsetWidth;
  if (c) void c.offsetWidth;
  relayoutLyricsIfNeeded(true, true);
  // 内部：双 rAF 立刻 + afterMs 兜底（不要连调两次，会互相 cancel）
  scheduleLyricLayoutRemeasure(getSideLayoutSettleMs());
}

function bindLyricContainerResizeObserver() {
  var container = $('lyrics-container');
  if (!container || typeof ResizeObserver === 'undefined') return;
  if (container._lyricRoBound) return;
  container._lyricRoBound = true;
  var ro = new ResizeObserver(function() {
    if (lyricFx.items.length === 0) return;
    // 列宽过渡中的中间宽度一律不测：把重测推到过渡结束之后
    var delay = lyricMeasureSuspended()
      ? Math.max(50, lyricFx.settleUntil - nowMs() + 30)
      : 50;
    if (lyricFx.roTimer) clearTimeout(lyricFx.roTimer);
    lyricFx.roTimer = setTimeout(function() {
      lyricFx.roTimer = null;
      if (lyricFx.items.length === 0) return;
      relayoutLyricsIfNeeded(true, true);
    }, delay);
  });
  ro.observe(container);
  // 存句柄供 cleanup 断开（原来是闭包局部变量，销毁后仍在观察）
  lyricFx.ro = ro;
  bindSideLayoutTransitionEnd();
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
// 返回 { showing, changed }：changed 表示 show-trans 类是否翻转（调用方需重测布局）
function syncLyricTransUI() {
  var usable = transUsable();
  var showing = usable && pageState.transOn;
  var container = $('lyrics-container');
  var changed = false;
  if (container) {
    var was = container.classList.contains('show-trans');
    container.classList.toggle('show-trans', showing);
    changed = was !== showing;
  }
  var btn = $('lyric-trans-btn');
  Fab.setHidden(btn, !usable);
  Fab.setActive(btn, showing);
  Fab.setLabel(btn, t('translate'));
  // 类翻转立刻作废测量：否则后续 focus 会用旧行高
  if (changed) {
    lyricFx.measured = false;
    lyricFx.measuredWithTrans = false;
  }
  return { showing: showing, changed: changed };
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

// ========================================
// 动态视觉效果开关（Aurora / 涟漪 / 背景漂移）
// 列表 EQ 与歌词/UI 微动画不经此开关
// ========================================

function syncVisualFxUI() {
  var btn = $('visual-fx-btn');
  // 按钮态反映用户偏好（桌面可点）；移动端由 .fab-btn--desktop-only 隐藏
  Fab.setActive(btn, pageState.visualFxOn);
  Fab.setLabel(btn, t('visualFx'));
  // 移动端始终挂 visual-fx-off；桌面按用户偏好
  var effectiveOn = pageState.visualFxOn && !checkIsMobile();
  document.documentElement.classList.toggle('visual-fx-off', !effectiveOn);
}

// 清除进行中的节奏涟漪动画
function clearRhythmRipples() {
  var els = document.getElementsByClassName('rhythm-ripple');
  for (var i = 0; i < els.length; i++) {
    els[i].classList.remove('run', 'big', 'accent', 'soft');
  }
}

// 收敛 Aurora 包络与内联样式（关闭时冻结/熄灭）
function dimAurora() {
  aurora.env = [0, 0, 0];
  aurora.lastOp = [NaN, NaN, NaN];
  if (!aurora.el) {
    aurora.el = $('artwork-aurora');
    if (aurora.el) aurora.blobs = aurora.el.getElementsByClassName('aurora-blob');
  }
  if (aurora.blobs) {
    for (var i = 0; i < aurora.blobs.length; i++) {
      aurora.blobs[i].style.opacity = '0';
    }
  }
}

function setVisualFxOn(on) {
  var next = !!on;
  var prev = pageState.visualFxOn;
  pageState.visualFxOn = next;
  syncVisualFxUI();
  if (prev === next) return;
  // 移动端仅更新偏好与 UI 类；运行时 FX 始终关
  if (checkIsMobile() || !next) {
    stopBackgroundAnimation();
    clearRhythmRipples();
    dimAurora();
  } else if (pageState.status && pageState.status.isPlaying && shouldAnimate()) {
    // 桌面打开：重同步拍点 + 重启背景漂移
    resyncBeatGridIdx();
    startBackgroundAnimation();
  }
  syncFxCompositing();
  // 调度模式随 FX 切换（60fps ↔ 低帧率维护），立即取消旧句柄并重入
  if (pageState.status && pageState.status.isPlaying) restartEqLoop();
}

// 视口跨移动/桌面边界时：移动强制收敛 FX；桌面按偏好恢复
var lastVisualFxMobile = null;
function applyVisualFxViewportPolicy() {
  var mobile = checkIsMobile();
  if (lastVisualFxMobile === mobile) {
    syncVisualFxUI();
    return;
  }
  lastVisualFxMobile = mobile;
  syncVisualFxUI();
  if (mobile) {
    stopBackgroundAnimation();
    clearRhythmRipples();
    dimAurora();
    syncFxCompositing();
    if (pageState.status && pageState.status.isPlaying) restartEqLoop();
    return;
  }
  // 切回桌面：按用户偏好恢复
  if (pageState.visualFxOn && pageState.status && pageState.status.isPlaying && shouldAnimate()) {
    resyncBeatGridIdx();
    startBackgroundAnimation();
  }
  syncFxCompositing();
  if (pageState.status && pageState.status.isPlaying) restartEqLoop();
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

  // 视口外剔除：目标位与当前位都在可视区外一屏以上的行直接吸附——
  // 弹簧过程本来就看不见，省掉长歌单每帧几百次 transform 写入
  // （这正是当初把切行改成瞬移的性能顾虑，剔除后波浪可以放心开回来）
  var band = lyricCullBand();
  var cullAbove = band ? band.top : -Infinity;
  var cullBelow = band ? band.bottom : Infinity;

  for (var k = 0; k < lyricFx.items.length; k++) {
    var it = lyricFx.items[k];
    var ty = it.y - lyricFx.targetS;
    var culled = (ty < cullAbove && it.pos < cullAbove) || (ty > cullBelow && it.pos > cullBelow);
    // 屏外行退出绘制：省掉每帧上百个 blur 合成层（滚动卡顿主因）
    setLyricItemVisible(it, !culled);
    if (culled) {
      // 远处行：吸附即可，不参与 moving 判定
      it.pos = ty;
      it.v = 0;
      it.scale = it.targetScale;
      it.scaleV = 0;
      // ⚠️ 关键：屏外行绝不写 DOM。它们是 visibility:hidden，transform 无人可见，
      // 而 targetS 每帧都在动 → 下面的量化去重对它们永远不成立，等于每帧给
      // 上百个不可见的合成层各写一次 transform（实测 200 行歌单里可见 25 行、
      // 却每帧写 174 次），这正是滚动卡顿的真正来源。
      // 作废写入缓存，重新进入可视带的那一帧自然会补写一次正确值。
      it._wy = NaN;
      it._ws = NaN;
      continue;
    } else if (now >= it.delayUntil) {
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

// 手动滚动后恢复自动跟焦的等待（原 3s 过长，回焦体感慢）
var LYRIC_RESUME_MS = 1100;

// 手动滚动期间取消景深模糊，停手这么久之后再淡回。
// 刻意长于 LYRIC_RESUME_MS：让回焦波浪先跑完，模糊才慢慢糊回来——
// 若与回焦同时发生，滚轮每停顿一下就会「糊一下又清一下」，非常闪
var LYRIC_DEBLUR_MS = 2600;
var lyricDeblurTimer = null;

/** 手动滚动：立刻去模糊；每次滚动都把「淡回」计时器往后推 */
function noteLyricScrollDeblur() {
  var c = $('lyrics-container');
  if (c) c.classList.add('scroll-clear');
  if (lyricDeblurTimer) clearTimeout(lyricDeblurTimer);
  lyricDeblurTimer = setTimeout(function() {
    lyricDeblurTimer = null;
    var el = $('lyrics-container');
    if (el) el.classList.remove('scroll-clear');
  }, LYRIC_DEBLUR_MS);
}

/** 立即恢复景深（点歌词跳转等「用户已明确表态」的场景，无需再等空闲） */
function clearLyricScrollDeblur() {
  if (lyricDeblurTimer) {
    clearTimeout(lyricDeblurTimer);
    lyricDeblurTimer = null;
  }
  var c = $('lyrics-container');
  if (c) c.classList.remove('scroll-clear');
}

// 用户手动滚动：暂停自动跟随，稍后**始终以波浪**回焦当前行。
// 不再按距离切瞬移：线性弹簧的收敛时间与幅度无关（5000px 与 300px 同样约 1s，
// 只是中途更快），所以"远了就糊"的顾虑不成立；而按屏高设阈值在移动端/长歌单里
// 会让常规的翻两屏也落进瞬移分支，观感就是回焦直接闪现。
function userLyricScrollBegin() {
  pageState.autoScrollEnabled = false;
  noteLyricScrollDeblur();
  if (lyricResumeTimer) clearTimeout(lyricResumeTimer);
  lyricResumeTimer = setTimeout(function() {
    lyricResumeTimer = null;
    pageState.autoScrollEnabled = true;
    lyricFx.focusK = -1;   // 强制重新聚焦
    // 掐掉残余甩动惯性：否则它会一路把 targetS 拽偏，回焦追不回来
    // （原先走 instant 时由 stopLyricWave 顺手清零，改波浪后必须显式清）
    lyricFx.momentumV = 0;
    if (pageState.currentLyricIndex >= 0) {
      focusLyricLine(pageState.currentLyricIndex, false);
    }
  }, LYRIC_RESUME_MS);
}

function snapFocusCurrentLyricIfPossible() {
  if (lyricFx.items.length === 0 || !lyricFx.inner) return false;
  if (!ensureLyricLayoutReady()) return false;
  var idx = pageState.currentLyricIndex >= 0 ? pageState.currentLyricIndex : 0;
  focusLyricLine(idx, true);
  return true;
}

function bindLyricManualScroll(container) {
  if (lyricFx.manualBound) return;
  lyricFx.manualBound = true;

  function tryReady() {
    if (ensureLyricLayoutReady()) return true;
    // 交互时再硬试一次（面板刚打开）
    lyricFx.measured = false;
    if (measureLyricLayout()) {
      if (pageState.currentLyricIndex >= 0) focusLyricLine(pageState.currentLyricIndex, true);
      else snapLyricItems();
      return true;
    }
    scheduleLyricLayoutRemeasure(0);
    return false;
  }

  container.addEventListener('wheel', function(e) {
    e.preventDefault();
    if (!tryReady()) return;
    userLyricScrollBegin();
    lyricFx.momentumV = 0;
    var dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= (lyricFx.viewH || 400);
    lyricFx.targetS = clampLyricS(lyricFx.targetS + dy);
    retargetLyricItemsNow();
    startLyricWave();
  }, { passive: false });

  container.addEventListener('touchstart', function(e) {
    if (!e.touches || e.touches.length === 0) return;
    tryReady();
    lyricFx.touchY = e.touches[0].clientY;
    lyricFx.touchT = performance.now();
    lyricFx.touchV = 0;
    lyricFx.momentumV = 0;
  }, { passive: true });

  // non-passive：移动端必须 preventDefault，否则页面/Sheet 抢走滑动
  container.addEventListener('touchmove', function(e) {
    if (lyricFx.touchY === null) return;
    e.preventDefault();
    if (!tryReady()) return;
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
  }, { passive: false });

  container.addEventListener('touchend', function() {
    if (lyricFx.touchY === null) return;
    lyricFx.touchY = null;
    if (Math.abs(lyricFx.touchV) > 60 && shouldAnimate()) {
      lyricFx.momentumV = lyricFx.touchV;
      lyricFx.touchV = 0;
      startLyricWave();
    }
  }, { passive: true });

  container.addEventListener('touchcancel', function() {
    lyricFx.touchY = null;
    lyricFx.touchV = 0;
  }, { passive: true });

  var resizeTimer = null;
  window.addEventListener('resize', function() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      relayoutLyricsIfNeeded(true, true);
    }, 200);
  });
}

// 间奏空窗判定：歌词至少保持 MIN_LINE_HOLD 秒可见，避免脏 yrc 的过短
// duration 把本句提前踢入「停顿点」；空窗仍须 > INTERLUDE_MIN_GAP 才插呼吸点
var MIN_LINE_HOLD = 2.2;
var INTERLUDE_MIN_GAP = 6;
// 前奏呼吸点的起点：不从 0 起，留一点让点「已经在那儿」而不是和播放同时出现
var LYRIC_PRELUDE_START = 0.2;
// 行时长比最后一个字更晚时，通常表示尾音延长；但部分脏 KRC
// 会把整曲时长误填进单行 duration。无下一句/整曲边界时才用此兜底上限。
var MAX_VERBATIM_TAIL = 12;

// ——— 不规范歌词（纯逐行、无 duration、脏 KRC）的间奏判定 ———
// 这类歌词只有每句的起始时间，**没有任何「唱完」信息**。旧实现假定一句只唱 3 秒
// （time + min(3, …)），于是句间隔一超过约 10s 就插呼吸点：慢歌一句唱七八秒很常见，
// 结果是还在唱就进间奏、且几乎每句都插一次。
// 拿不到真实行末时不猜具体时刻，只做两条保守约束：
//   1) 假定一句最多唱 UNTIMED_ASSUMED_SING 秒（呼吸点不早于此刻出现）
//   2) 扣掉这段假定演唱后，剩余空窗仍须大于 UNTIMED_MIN_GAP 才算真间奏
// 即：句间隔需 > 16s 才插点（旧口径约 10s），且最早也要唱满 7s 才进。
var UNTIMED_ASSUMED_SING = 7;
var UNTIMED_MIN_GAP = 9;

/** 无可信行末时的间奏起点；空窗不够大则返回 null（宁可不插） */
function untimedInterludeEnd(lineStart, nextStart) {
  var assumedEnd = lineStart + UNTIMED_ASSUMED_SING;
  if (nextStart - assumedEnd > UNTIMED_MIN_GAP) return assumedEnd;
  return null;
}

// 间奏收尾动效提前量（秒）：三点「鼓一下再被重力吸走」的总时长。
// 需与 page.css 的 dotOutro（620ms）+ 第三点错峰（110ms）对齐——
// 从 end-0.4 往前推这么多起跑，最后一颗塌陷完成正好赶上下一句接管焦点。
var LYRIC_DOTS_OUTRO = 0.75;

// 将逐字 end 与行级 duration 分别校验后合并。
// 不让一个离谱的行 duration 拖住歌词，也不让过早结束的最后一字吞掉尾音。
function getVerbatimTimelineEnd(v, lineStart, nextStart) {
  if (!v) return NaN;

  var wordEnd = NaN;
  if (v.words && v.words.length > 0) {
    var maxEnd = -Infinity;
    for (var w = 0; w < v.words.length; w++) {
      var word = v.words[w];
      if (!word) continue;
      var ws = (typeof word.start === 'number' && isFinite(word.start))
        ? word.start
        : (typeof word.time === 'number' && isFinite(word.time) ? word.time : NaN);
      if (!isFinite(ws)) continue;
      var wd = (typeof word.duration === 'number' && isFinite(word.duration) && word.duration > 0)
        ? word.duration
        : 0;
      var we = ws + wd;
      if (we > maxEnd) maxEnd = we;
    }
    if (isFinite(maxEnd) && maxEnd > -Infinity) wordEnd = maxEnd;
  }

  var headerEnd = NaN;
  if (typeof v.duration === 'number' && isFinite(v.duration) && v.duration > 0) {
    var vTime = (typeof v.time === 'number' && isFinite(v.time)) ? v.time : lineStart;
    headerEnd = vTime + v.duration;
  }

  function isPlausible(end) {
    if (!isFinite(end) || end < lineStart - 0.5) return false;
    return !isFinite(nextStart) || end <= nextStart + 1;
  }

  if (!isPlausible(wordEnd)) wordEnd = NaN;
  if (!isPlausible(headerEnd)) headerEnd = NaN;
  if (!isFinite(nextStart) && isFinite(headerEnd) && isFinite(wordEnd) &&
      headerEnd - wordEnd > MAX_VERBATIM_TAIL) {
    headerEnd = NaN;
  }

  if (isFinite(wordEnd) && isFinite(headerEnd)) return Math.max(wordEnd, headerEnd);
  if (isFinite(wordEnd)) return wordEnd;
  if (isFinite(headerEnd)) return headerEnd;
  return NaN;
}

// 用于间奏 gap 插入：估算本句「唱完」时刻。卡拉 OK 尾音也共用同一校验结果。
// 合并可信的字级 end / 行级 duration，无有效时长时才相对 nextStart 兜底。
// nextStartOverride：末句没有下一句，尾奏判定拿曲末当右边界
function computeLineEnd(i, lyrics, verbatim, nextStartOverride) {
  var line = lyrics[i];
  var next = lyrics[i + 1];
  var hasOverride = typeof nextStartOverride === 'number' && isFinite(nextStartOverride);
  if (!line || (!next && !hasOverride)) return null;

  var lineStart = (typeof line.time === 'number' && isFinite(line.time))
    ? line.time
    : 0;
  var nextStart = hasOverride
    ? nextStartOverride
    : ((typeof next.time === 'number' && isFinite(next.time)) ? next.time : NaN);
  if (!isFinite(nextStart)) return null;

  // 两句间隔本身短于 min-hold：永不插入间奏
  if (nextStart - lineStart < MIN_LINE_HOLD) return null;

  var v = verbatim && verbatim[i];
  var rawEnd = getVerbatimTimelineEnd(v, lineStart, nextStart);

  // 无逐字 / 无可信 duration / end 离谱（ms 误当 s、越过 next 过多）：
  // 一律按「不知道这句唱到哪」处理，走保守口径而不是编一个行末出来
  if (!isFinite(rawEnd) || rawEnd <= 0 ||
      rawEnd > nextStart + 1 || rawEnd < lineStart - 0.5) {
    return untimedInterludeEnd(lineStart, nextStart);
  }

  // 有可信行末：维持原口径（逐字/KRC 歌曲的间奏判定不受影响）
  // 强制至少 hold 满 MIN_LINE_HOLD（next 允许时），再钳到 nextStart
  var effectiveEnd = Math.max(rawEnd, lineStart + MIN_LINE_HOLD);
  effectiveEnd = Math.min(effectiveEnd, nextStart);

  if (nextStart - effectiveEnd > INTERLUDE_MIN_GAP) return effectiveEnd;
  return null;
}

// 间奏开始：取消上一句的聚焦（Apple 行为——间奏期间没有「当前句」，
// 上一句降级为已唱过的暗态，高亮与放大都撤掉）
function demoteActiveLyricLineForInterlude() {
  var container = $('lyrics-container');
  if (!container) return;
  var activeLine = container.querySelector('.lyric-line.active');
  if (!activeLine) return;
  var idx = parseInt(activeLine.getAttribute('data-index'), 10);
  // 兜底：本句显示未满 MIN_LINE_HOLD 时不降级（防脏 timeline 过早进间奏）
  if (idx >= 0 && pageState.lyrics[idx] &&
      typeof pageState.lyrics[idx].time === 'number') {
    if (getLyricPosition() - pageState.lyrics[idx].time < MIN_LINE_HOLD) return;
  }
  activeLine.className = 'lyric-line passed near-1';
  var k = findLyricItemK(idx);
  if (k >= 0) {
    lyricFx.items[k].targetScale = LYRIC_SCALE_INACTIVE;
    if (shouldAnimate()) startLyricWave(); else snapLyricItems();
  }
}

/** 间奏三点的四态。只由播放位置决定，所以 seek 回退能自然退回前一态 */
var DOTS_STAGE_IDLE = 0;   // 未到：隐身占位
var DOTS_STAGE_ON = 1;     // 间奏中
var DOTS_STAGE_OUT = 2;    // 收尾中（鼓起→被重力吸走）
var DOTS_STAGE_SPENT = 3;  // 已收尾：永久退出，不回常驻态

function interludeStage(it, posSec, animate) {
  if (posSec < it.start) return DOTS_STAGE_IDLE;
  // end-0.4 之后一律 spent 且不设上界：旧实现只把收尾态留到 end+2.5，
  // 过了这个窗口三点会弹回常驻暗态——看着就是「消失完又冒出来」
  if (posSec >= it.end - 0.4) return DOTS_STAGE_SPENT;
  if (animate && posSec >= it.end - 0.4 - LYRIC_DOTS_OUTRO) return DOTS_STAGE_OUT;
  return DOTS_STAGE_ON;
}

/** 把三点当前呼吸相位的实测 scale 交给 dotOutro 的 0%，让收尾从原地起跑 */
function captureDotScales(el) {
  var ds = el.children;
  for (var i = 0; i < ds.length; i++) {
    var s = 1;
    try {
      var tr = getComputedStyle(ds[i]).transform;
      var m = tr && tr !== 'none' ? tr.match(/matrix\(\s*([-\d.eE]+)/) : null;
      if (m) s = parseFloat(m[1]);
    } catch (e) {}
    if (!isFinite(s) || s <= 0) s = 1;
    ds[i].style.setProperty('--dot-s0', s.toFixed(3));
  }
}

function clearDotsLit(el) {
  var ds = el.children;
  for (var i = 0; i < ds.length; i++) ds[i].classList.remove('on');
}

// 间奏呼吸点更新（由 eqTick 15fps 驱动）：进度点亮 + 焦点跟随
function updateInterludeDots() {
  if (!lyricFx.measured) return;
  var dots = lyricFx.dotsItems;
  if (!dots || dots.length === 0) return; // 无间奏的歌零开销
  var posSec = getLyricPosition();
  var animate = shouldAnimate();
  for (var d0 = 0; d0 < dots.length; d0++) {
    var it = dots[d0];
    // 防御：循环体内的 renderLyrics/demote 可能重建歌词结构，条目失效则跳过
    if (!it || !it.el || !it.el.isConnected) {
      logTickError('dotsItem', new Error('stale dots item ' + d0 + '/' + dots.length));
      continue;
    }
    var k = it._k;
    var stage = interludeStage(it, posSec, animate);
    var inGap = stage === DOTS_STAGE_ON || stage === DOTS_STAGE_OUT;
    var cl = it.el.classList;

    // 收尾动效：间奏末尾三点先鼓一下，再被「重力」吸走塌陷消失
    var wantFin = stage === DOTS_STAGE_OUT;
    if (wantFin !== cl.contains('finishing')) {
      // 起跑前先抓住当前呼吸相位，dotOutro 才能从原地鼓起而不是先缩回 1
      if (wantFin) captureDotScales(it.el);
      cl.toggle('finishing', wantFin);
    }

    // 永久退出：塌陷跑完就定格，之后无论播多久都不再现身（seek 回退才复活）
    var wantSpent = stage === DOTS_STAGE_SPENT;
    if (wantSpent !== cl.contains('spent')) {
      cl.toggle('spent', wantSpent);
      if (wantSpent) clearDotsLit(it.el);
    }

    if (inGap !== cl.contains('active')) {
      cl.toggle('active', inGap);
      if (!inGap) clearDotsLit(it.el);
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


/** 当前侧栏焦点：none | lyrics | playlist（移动端未打开面板 = none） */
function getSidePanelFocus() {
  var pr = $('player-right');
  var mobile = typeof checkIsMobile === 'function' ? checkIsMobile() : false;
  if (mobile && pr && !pr.classList.contains('mobile-visible')) {
    return 'none';
  }
  var pl = $('panel-playlist');
  if (pl && pl.classList.contains('active')) return 'playlist';
  var ly = $('panel-lyrics');
  if (ly && ly.classList.contains('active')) return 'lyrics';
  return 'none';
}

/**
 * 无歌词布局策略（顺序：先按有词 → 确认后再无词）：
 * - loading / ready：乐观有词布局（双栏、侧栏可开）
 * - empty（已确认无词或实质行 <5）：封面优先；歌词 Tab 开着也收侧栏
 * - 列表 Tab：始终双栏
 */
function syncNoLyricsLayout() {
  var root = document.documentElement;
  var state = pageState.lyricsLoadState || 'idle';
  // 仅「确认 empty」才无词；loading 先当有词，避免一进来就进无词模式
  var confirmedEmpty = state === 'empty';
  var assumeHasLyrics = state === 'ready' || state === 'loading';
  var focus = getSidePanelFocus();

  // 歌词开着且已确认无词：布局当 none；loading/ready 保持 lyrics 双栏
  var layoutFocus = focus;
  if (confirmedEmpty && focus === 'lyrics') {
    layoutFocus = 'none';
  }

  root.classList.remove('mp-lyrics-loading'); // 废弃加载动画类
  // 列宽/hero 会因这些类变化而进入 0.46s 过渡：期间挂起歌词测量
  var layoutSig = layoutFocus + '|' + (confirmedEmpty ? 1 : 0) + '|' + (assumeHasLyrics ? 1 : 0);
  var layoutChanged = layoutSig !== syncNoLyricsLayout._sig;
  if (layoutChanged) {
    syncNoLyricsLayout._sig = layoutSig;
    suspendLyricMeasure();
  }
  root.classList.toggle('mp-no-lyrics', confirmedEmpty);
  root.classList.toggle('mp-has-lyrics', assumeHasLyrics);
  root.classList.toggle('mp-side-playlist', layoutFocus === 'playlist');
  root.classList.toggle('mp-side-lyrics', layoutFocus === 'lyrics');
  root.classList.toggle('mp-side-none', layoutFocus === 'none');

  // 确认无词 + 未在列表 → 封面优先 hero
  var layoutHero = confirmedEmpty && focus !== 'playlist';
  root.classList.toggle('mp-no-lyrics-layout', layoutHero);

  // 歌词 Tab：loading/ready 展开侧栏；仅 empty 收起
  var playerRight = $('player-right');
  if (playerRight && focus === 'lyrics') {
    var mobile = typeof checkIsMobile === 'function' && checkIsMobile();
    if (confirmedEmpty) {
      playerRight.classList.remove('side-open');
      if (mobile) {
        playerRight.classList.remove('mobile-visible');
        playerRight.classList.remove('mobile-closing');
      }
    } else if (assumeHasLyrics) {
      playerRight.classList.add('side-open');
      if (mobile) {
        playerRight.classList.add('mobile-visible');
        playerRight.classList.remove('mobile-closing');
      }
    }
  }

  // 列宽过渡结束后再重测跑马灯，避免开侧栏过程中反复改 --marquee 造成标题跳一下。
  // 仅在布局签名真的变了时才排这次重测：稳态播放中 syncNoLyricsLayout 同样会被
  // 反复调用，无条件重排会周期性打断正在滚动的标题。
  if (layoutChanged) {
    if (syncNoLyricsLayout._marqueeTimer) {
      clearTimeout(syncNoLyricsLayout._marqueeTimer);
    }
    syncNoLyricsLayout._marqueeTimer = setTimeout(function() {
      syncNoLyricsLayout._marqueeTimer = null;
      if (typeof remeasureScrollingText === 'function') {
        remeasureScrollingText($('song-name'));
        remeasureScrollingText($('song-artist'));
      }
    }, getSideLayoutSettleMs());
  }
}

/** 同步无歌词 / 有歌词 / 加载中状态，并刷新布局 */
function setLyricsUiMode(state) {
  // state: 'idle' | 'loading' | 'ready' | 'empty'
  pageState.lyricsLoadState = state || 'idle';
  syncNoLyricsLayout();
}

/** 当前曲时长（秒）：track.duration 优先，其次 progress.duration / audio */
function getCurrentTrackDurationSec() {
  var st = pageState.status || {};
  var track = st.currentTrack || {};
  var d = Number(track.duration);
  if (isFinite(d) && d > 0) return d;
  if (st.progress && isFinite(Number(st.progress.duration)) && Number(st.progress.duration) > 0) {
    return Number(st.progress.duration);
  }
  return 0;
}

// 有效实质行少于此数 → 视作无歌词（封面优先 / empty）
var MIN_USABLE_LYRIC_LINES = 5;

/**
 * 是否按「有歌词」处理（够 MIN 条即 true，短路扫描）。
 * - 实质行 ≥ 5 → true
 * - 少于 5 行 / 无词 / 仅占位 → false
 */
function areLyricsUsable(lyrics) {
  if (!lyrics || lyrics.length === 0) return false;
  var n = 0;
  for (var i = 0; i < lyrics.length; i++) {
    var ln = lyrics[i] || {};
    var t = Number(ln.time);
    if (ln.time != null && ln.time !== '' && (!isFinite(t) || t < 0)) continue;
    var text = String(ln.text || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (/^(纯音乐|instrumental|暂无歌词|无歌词|lyrics?\s*not\s*found)$/i.test(text)) continue;
    n++;
    if (n >= MIN_USABLE_LYRIC_LINES) return true;
  }
  return false;
}

/**
 * 当前是否应应用「无词布局」判定：
 * 列表 Tab 不抢布局；其余在确认无词时才进无歌词模式。
 */
function shouldApplyNoLyricsMode() {
  var focus = typeof getSidePanelFocus === 'function' ? getSidePanelFocus() : 'none';
  return focus !== 'playlist';
}

/** 本曲已确认 empty（getLyrics 终态）— 禁止 progress/宿主短词再打回 loading */
function isConfirmedEmptyForCurrentTrack() {
  if (pageState.lyricsLoadState !== 'empty') return false;
  if (pageState.lyricsSongId == null) return false;
  var cur = pageState.status && pageState.status.currentTrack
    ? pageState.status.currentTrack.id
    : null;
  if (cur == null) return false;
  return String(pageState.lyricsSongId) === String(cur);
}

/**
 * 应用「确认后的」有词/无词结果。
 * confirmed=true：已拿到最终结果，不足 5 行才进 empty。
 * confirmed=false：仍在加载 → loading（乐观有词布局），绝不先 empty。
 * 例外：本曲已确认 empty 时，未确认的推送不得再升 loading。
 */
function applyLyricsVerdict(lyrics, opts) {
  opts = opts || {};
  var confirmed = opts.confirmed !== false;
  var fromTabOpen = !!opts.fromTabOpen;

  if (!confirmed) {
    // 已确认无词：粘住 empty，避免宿主/进度事件闪回歌词模式
    if (isConfirmedEmptyForCurrentTrack()) {
      setLyricsUiMode('empty');
      return;
    }
    // 加载中：先按有词
    if (pageState.lyricsLoadState !== 'loading' && pageState.lyricsLoadState !== 'ready') {
      setLyricsUiMode('loading');
    } else {
      syncNoLyricsLayout();
    }
    return;
  }

  var usable = areLyricsUsable(lyrics);

  if (!usable) {
    // 确认无词 / 过短 → 才进无歌词模式
    setLyricsUiMode('empty');
    var container = $('lyrics-container');
    if (container) {
      lyricFx.items = [];
      lyricFx.inner = null;
      lyricFx.dotsItems = [];
      resetLyricFxLayoutCache();
      stopLyricWave();
      clearLyricsContainer(container);
      container.classList.remove('karaoke');
    }
    return;
  }

  // 确认有词
  var lyricsTabOn = false;
  try {
    var lyBtn = document.querySelector('.tab-btn[data-tab="lyrics"]');
    lyricsTabOn = !!(lyBtn && lyBtn.classList.contains('active'));
  } catch (e) { lyricsTabOn = false; }

  if (pageState.lyricsLoadState === 'ready' && lyricFx.inner && lyricFx.items.length > 0) {
    setLyricsUiMode('ready');
    if (lyricsTabOn) {
      var pr = $('player-right');
      if (pr) {
        pr.classList.add('side-open');
        if (typeof checkIsMobile === 'function' && checkIsMobile()) {
          pr.classList.add('mobile-visible');
          pr.classList.remove('mobile-closing');
        }
      }
    }
    syncNoLyricsLayout();
    if (fromTabOpen) forceLyricsPanelRelayout(true);
    else snapFocusCurrentLyricIfPossible();
    return;
  }

  var st = pageState.status || {};
  var pos = st.position || (st.progress ? st.progress.current : 0) || 0;
  var idx = updateLyricIndex(pos, lyrics || pageState.lyrics || []);
  pageState.currentLyricIndex = idx;
  // render 内会 set ready（数据已确认 usable）；无词→有词时已硬重测
  renderLyrics(lyrics || pageState.lyrics, idx, { confirmed: true });

  if (lyricsTabOn && pageState.lyricsLoadState === 'ready') {
    var pr2 = $('player-right');
    if (pr2) {
      pr2.classList.add('side-open');
      if (typeof checkIsMobile === 'function' && checkIsMobile()) {
        pr2.classList.add('mobile-visible');
        pr2.classList.remove('mobile-closing');
      }
    }
    syncNoLyricsLayout();
    // 侧栏刚展开：硬重测，避免仍挤在顶部
    if (!lyricFx.measured) forceLyricsPanelRelayout(false);
    else forceLyricsPanelRelayout(true);
  }
}

/**
 * 按当前歌词刷新（确认后才 empty；加载中保持 loading 乐观有词）。
 */
function revalidateLyricsContentMode(opts) {
  opts = opts || {};
  var fromTabOpen = !!opts.fromTabOpen;

  // 本曲已确认无词：保持 empty，不再乐观开侧栏 / 升 loading
  if (isConfirmedEmptyForCurrentTrack()) {
    applyLyricsVerdict(pageState.lyrics, { confirmed: true, fromTabOpen: fromTabOpen });
    return;
  }

  // 仍在等 getLyrics：不降级 empty
  var pending = pageState.lyricsLoadState === 'loading' ||
    (pageState.lyricsSongId == null && pageState.lyricsRequestGen > 0 &&
      pageState.status && pageState.status.currentTrack);

  if (!shouldApplyNoLyricsMode()) {
    if (pending) {
      if (pageState.lyricsLoadState !== 'loading') setLyricsUiMode('loading');
      return;
    }
    applyLyricsVerdict(pageState.lyrics, { confirmed: true, fromTabOpen: fromTabOpen });
    return;
  }

  if (pending && !areLyricsUsable(pageState.lyrics)) {
    // 先有词布局，等结果
    applyLyricsVerdict(pageState.lyrics, { confirmed: false, fromTabOpen: fromTabOpen });
    if (fromTabOpen) {
      // 乐观开侧栏
      var pr = $('player-right');
      if (pr) {
        pr.classList.add('side-open');
        if (typeof checkIsMobile === 'function' && checkIsMobile()) {
          pr.classList.add('mobile-visible');
          pr.classList.remove('mobile-closing');
        }
      }
      syncNoLyricsLayout();
    }
    return;
  }

  applyLyricsVerdict(pageState.lyrics, {
    confirmed: true,
    fromTabOpen: fromTabOpen
  });
}

// 无词态不再在歌词面板里放占位：布局改成封面优先的 hero（html.mp-no-lyrics-layout），
// 面板本身会收起。占位 DOM 曾被 `.lyrics-empty { display:none !important }` 永久隐藏，
// 却仍在每次空态渲染时连内联 SVG 一起重建——直接清空即可。
function clearLyricsContainer(container) {
  container.textContent = '';
}

// 渲染歌词 - Apple Music 式：DOM/类名在此维护，位置与缩放由波浪引擎接管
// opts.confirmed：false=仍在加载（乐观有词，不进 empty）；true/默认=最终结果可判 empty
function renderLyrics(lyrics, currentIndex, opts) {
  var container = $('lyrics-container');
  if (!container) return;
  opts = opts || {};
  var confirmed = opts.confirmed !== false;
  // 加载中且尚未确认：保留 loading 布局，不先跳无词模式
  if (pageState.lyricsLoadState === 'loading' && opts.confirmed !== true) {
    confirmed = false;
  }

  // 无词或实质行 < 5
  if (!lyrics || lyrics.length === 0 || !areLyricsUsable(lyrics)) {
    lyricFx.items = [];
    lyricFx.inner = null;
    lyricFx.dotsItems = [];
    if (!lyrics || lyrics.length === 0) {
      lyricFx.songId = null;
    }
    resetLyricFxLayoutCache();
    stopLyricWave();
    if (confirmed) {
      // 确认后才 empty
      setLyricsUiMode('empty');
    } else if (isConfirmedEmptyForCurrentTrack()) {
      // 本曲已 empty：宿主 status/progress 又推短词时绝不能退回 loading
      // （否则：歌词模式 → 无词模式 → 又莫名回到歌词模式）
      setLyricsUiMode('empty');
    } else {
      // 尚未终判：先按有词（loading）
      if (pageState.lyricsLoadState !== 'loading') setLyricsUiMode('loading');
    }
    clearLyricsContainer(container);
    container.classList.remove('karaoke');
    return;
  }

  // 本曲已确认 empty：只有 confirmed 的终态有词才能升级 ready（getLyrics 正式结果）
  // 防止宿主临时下发「看起来够长」的脏数据把 empty 打回歌词模式
  if (!confirmed && isConfirmedEmptyForCurrentTrack()) {
    return;
  }

  // 无词/空壳 → 有词：侧栏从 0 宽展开，必须整表重建 + 延后硬重测，否则行高全 0 挤在顶部
  var comingFromEmpty = pageState.lyricsLoadState === 'empty' ||
    !lyricFx.inner ||
    !container.querySelector('.lyrics-inner');

  setLyricsUiMode('ready');
  // 立刻刷开侧栏几何，避免本帧仍按 0 宽测
  if (comingFromEmpty) {
    var prFlush = $('player-right');
    var caFlush = document.querySelector('.content-area');
    if (prFlush) void prFlush.offsetWidth;
    if (caFlush) void caFlush.offsetWidth;
    void container.offsetWidth;
  }

  // 逐字模式：verbatim 与 lyrics 行数一致时启用卡拉OK字级填充
  var isKaraoke = pageState.verbatimLyrics.length > 0 &&
                  pageState.verbatimLyrics.length === lyrics.length;
  container.classList.toggle('karaoke', isKaraoke);

  // 检查是否需要重新渲染整个列表
  var existingLines = container.querySelectorAll('.lyric-line');
  var needsFullRender = existingLines.length !== lyrics.length || !lyricFx.inner || comingFromEmpty;
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

  // 无词→有词 / 首测失败：硬重测（立刻 + settle），避免挤在顶部
  if (comingFromEmpty || !lyricFx.measured) {
    forceLyricsPanelRelayout(false);
  } else if (pageState.autoScrollEnabled && currentIndex >= 0) {
    // focusInstant：progress 切行走瞬移，省波浪主线程（颜色/封面更跟手）
    focusLyricLine(currentIndex, !!opts.focusInstant);
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

  // 前奏：与句间空窗同一把尺子（INTERLUDE_MIN_GAP）。
  // 原来写死 > 4s，比句间的 6s 松，同一首歌里两套标准——间隔 5s 的开头会插点，
  // 而歌中同样 5s 的空窗不插
  if (lyrics[0].time - LYRIC_PRELUDE_START > INTERLUDE_MIN_GAP) {
    pushDots(LYRIC_PRELUDE_START, lyrics[0].time);
  }

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

    // 间奏：本行有效唱完到下一行开始空窗足够大 → 呼吸点
    // computeLineEnd 处理脏 yrc（过短 duration / 字级 end）与 min-hold
    var next = lyrics[i + 1];
    if (next) {
      var lineEnd = computeLineEnd(i, lyrics, verbatim);
      if (lineEnd != null) pushDots(lineEnd, next.time);
    }
  }

  // 尾奏：末句唱完到曲末空窗足够大 → 呼吸点。不插的话长尾奏里末句会一直亮着，
  // 而 Apple 是收掉的。曲长此刻未知（宿主还没报 duration）就跳过，下次重建再补
  var songEnd = getCurrentTrackDurationSec();
  if (songEnd > 0) {
    var tailEnd = computeLineEnd(lyrics.length - 1, lyrics, verbatim, songEnd);
    if (tailEnd != null) pushDots(tailEnd, songEnd);
  }

  // 重建前作废旧布局缓存（含 targetS / 过期 deferred remeasure），避免快切沿用上首歌 y/h
  stopLyricWave();
  resetLyricFxLayoutCache();

  container.innerHTML = '';
  container.appendChild(inner);
  container.scrollTop = 0; // 清除旧原生滚动残留偏移（overflow:hidden 仍会保留 scrollTop）
  lyricFx.inner = inner;
  lyricFx.items = items;
  lyricFx.songId = pageState.lyricsSongId;
  // 间奏点子集缓存（含 items 索引）：15fps 热路径无需全量扫描
  lyricFx.dotsItems = [];
  for (var di = 0; di < items.length; di++) {
    if (items[di].type === 'dots') {
      items[di]._k = di;
      lyricFx.dotsItems.push(items[di]);
    }
  }
  pageState.lastKaraokeLine = -1;

  bindLyricClickEvents(container);
  bindLyricManualScroll(container);

  // 立刻测；侧栏未展开则等 settle / ResizeObserver
  lyricFx.everMeasured = false;
  if (measureLyricLayout()) {
    var k = findLyricItemK(currentIndex >= 0 ? currentIndex : 0);
    if (k < 0) k = 0;
    focusLyricItemK(k, true);
  } else {
    // 这一帧测不了（侧栏未展开 / 列宽过渡中）：新 DOM 的 y 全是 0，九行叠在 top:0。
    // 先藏起来，等后续重测量出布局再淡入。
    // ⚠️ 只在测失败时才挂：面板已展开时（翻译开关等重建）上面一次就成功了，
    // 提前挂再摘会因为 measureLyricLayout 内部强制回流而真的提交一次 opacity:0，
    // 白白闪一下淡入
    setLyricPremeasure(true);
  }
  scheduleLyricLayoutRemeasure(getSideLayoutSettleMs());
  bindLyricContainerResizeObserver();
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
      // 跳转到对应时间（先记跳转意图：宿主落位前的陈旧 progress 不得打断波浪）
      noteSeekIntent(time);
      Tapp.media.seek(time);
      // Apple Music 行为：点按的行成为当前行后立即弹簧吸附到焦点位
      // （清掉滚轮打断的暂停状态，让 seek 后的渲染立刻跟随）
      if (lyricResumeTimer) {
        clearTimeout(lyricResumeTimer);
        lyricResumeTimer = null;
      }
      pageState.autoScrollEnabled = true;
      // 点行即已选定目标，不必再等空闲：景深立刻跟着回焦一起回来
      clearLyricScrollDeblur();
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
      // 脏歌词的词可能没有 text；直接赋 undefined 会把 "undefined" 写进歌词
      span.textContent = txt == null ? '' : txt;
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
// 跳转意图：宿主 seek 落位有延迟，期间 progress 还在推**旧位置**。
// 若直接拿这些陈旧 position 推歌词，会先把刚起步的波浪打回上一句，
// 再在落位那帧硬跳到目标句——观感上就是「点歌词完全没有动画」。
// 记下意图位置，在宿主追上（或超时）之前用它推进歌词。
var SEEK_INTENT_TIMEOUT_MS = 1500; // 兜底：宿主始终没追上就放弃意图
var SEEK_INTENT_TOLERANCE = 1.2;   // 秒：宿主位置进到这个范围内即视为已落位
var seekIntent = null;             // { time, at }

function noteSeekIntent(time) {
  if (typeof time !== 'number' || !isFinite(time)) return;
  seekIntent = { time: time, at: nowMs() };
}

/**
 * UI 该用的位置：跳转未落位时用意图值，其余原样返回。
 * 歌词与进度条共用——否则拖动进度条时宿主回推的旧 position 会把滑块
 * 从手指下拽回去（回弹），时间显示也会来回跳。
 */
function resolveSeekPosition(position) {
  if (!seekIntent) return position;
  if (nowMs() - seekIntent.at > SEEK_INTENT_TIMEOUT_MS ||
      Math.abs(position - seekIntent.time) <= SEEK_INTENT_TOLERANCE) {
    seekIntent = null;
    return position;
  }
  return seekIntent.time;
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

function buildKaraokeGeo(v, words, lineIndex) {
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

  // 某些 KRC 的最后一字时长会比行 duration 早结束（尾音被截断）。
  // 延长最后一段到已校验的行结束，使填色与间奏切换使用同一时刻。
  if (segs.length > 0) {
    var line = pageState.lyrics[lineIndex];
    var nextLine = pageState.lyrics[lineIndex + 1];
    var lineStart = (line && typeof line.time === 'number' && isFinite(line.time))
      ? line.time
      : ((typeof v.time === 'number' && isFinite(v.time)) ? v.time : segs[0].ts);
    var nextStart = (nextLine && typeof nextLine.time === 'number' && isFinite(nextLine.time))
      ? nextLine.time
      : NaN;
    // 最后一句没有 nextStart，用整曲时长拦住「把 total 误当行 duration」的 KRC。
    if (!isFinite(nextStart) && pageState.status && pageState.status.currentTrack) {
      var trackDuration = Number(pageState.status.currentTrack.duration);
      if (isFinite(trackDuration) && trackDuration > 10000) trackDuration /= 1000;
      if (isFinite(trackDuration) && trackDuration > lineStart) nextStart = trackDuration;
    }
    var timelineEnd = getVerbatimTimelineEnd(v, lineStart, nextStart);
    var lastSeg = segs[segs.length - 1];
    if (isFinite(timelineEnd) && timelineEnd > lastSeg.te) {
      lastSeg.te = timelineEnd;
    }
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
    buildKaraokeGeo(v, words, idx);
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

/** 是否需要为该曲拉歌词（已在飞 / 已确认则 false） */
function needsLyricsLoad(track) {
  if (!track || !track.id) return false;
  var id = String(track.id);
  if (pageState.lyricsLoadingTrackId != null &&
      String(pageState.lyricsLoadingTrackId) === id) {
    return false; // 请求进行中
  }
  if (pageState.lyricsSongId != null && String(pageState.lyricsSongId) === id) {
    if (pageState.lyricsLoadState === 'ready' || pageState.lyricsLoadState === 'empty') {
      return false;
    }
  }
  return true;
}

// 为指定曲目加载逐字歌词（切歌时调用）
// 顺序：先 loading（乐观有词布局）→ getLyrics 确认 → ready 或 empty
function loadLyricsForTrack(track) {
  if (!track || !track.id) return;
  var trackIdStr = String(track.id);
  // 已在飞：progress 热路径禁止重入（否则反复 abort getLyrics + 卡主线程）
  if (pageState.lyricsLoadingTrackId != null &&
      String(pageState.lyricsLoadingTrackId) === trackIdStr) {
    return;
  }
  // 已成功加载本曲且已确认：只刷新（勿在 progress 上 force relayout）
  // 必须 String 比较：宿主 id 偶发 number/string 混用会导致「必定加载两次」
  if (pageState.lyricsSongId != null && String(pageState.lyricsSongId) === trackIdStr &&
      pageState.lyricsLoadState === 'ready' &&
      pageState.lyrics && pageState.lyrics.length > 0) {
    return;
  }
  // 已确认本曲 empty 且 id 匹配：不重复打
  if (pageState.lyricsSongId != null && String(pageState.lyricsSongId) === trackIdStr &&
      pageState.lyricsLoadState === 'empty') {
    return;
  }
  // 防御旧版 SDK（前端 bundle 未更新时 getLyrics 不存在）：优雅回退逐行
  if (!Tapp.media || typeof Tapp.media.getLyrics !== 'function') {
    console.warn('[music-player] Tapp.media.getLyrics 不可用（前端 SDK 需重新构建/刷新），回退逐行歌词');
    return;
  }

  // 用代数丢弃过期请求；不要在请求发出前就把 lyricsSongId 标成新曲——
  // 否则 handleStateChange 会误以为「本曲歌词已就绪」而不清空上一首的展示。
  var requestGen = ++pageState.lyricsRequestGen;
  var trackId = track.id;
  pageState.lyricsLoadingTrackId = trackId;
  // 记录本请求目标，供 trackChanged 判断「同曲已在飞」避免 gen++ 作废首包

  // 宿主 status 已带本曲逐行时保留展示，后台升级逐字
  var hasProvisional = !!(
    pageState.lyrics &&
    pageState.lyrics.length > 0 &&
    pageState.status &&
    pageState.status.currentTrack &&
    String(pageState.status.currentTrack.id) === String(trackId)
  );

  // ★ 先按有词：loading，绝不先 empty
  pageState.lyricsSongId = null;
  setLyricsUiMode('loading');
  if (!hasProvisional) {
    pageState.lyrics = [];
    pageState.verbatimLyrics = [];
    renderLyrics([], -1, { confirmed: false });
  } else {
    // 占位先画（即使 <5 行也不 empty，等 getLyrics 确认）
    pageState.verbatimLyrics = [];
    var st0 = pageState.status || {};
    var pos0 = st0.position || (st0.progress ? st0.progress.current : 0) || 0;
    var idx0 = updateLyricIndex(pos0, pageState.lyrics);
    if (areLyricsUsable(pageState.lyrics)) {
      renderLyrics(pageState.lyrics, idx0, { confirmed: false });
    } else {
      renderLyrics(pageState.lyrics, idx0, { confirmed: false });
    }
  }

  Tapp.media.getLyrics({ songId: track.id, source: track.source }).then(function(res) {
    try { mpDebug('[music-player] getLyrics', track.id, 'verbatim=', res && res.verbatim ? res.verbatim.length : 0, 'lines=', res && res.lines ? res.lines.length : 0); } catch (e) {}
    // 过期请求 / 当前曲已不是目标曲：丢弃
    if (requestGen !== pageState.lyricsRequestGen) return;
    if (String(pageState.lyricsLoadingTrackId) === String(trackId)) {
      pageState.lyricsLoadingTrackId = null;
    }
    var currentId = pageState.status && pageState.status.currentTrack
      ? pageState.status.currentTrack.id
      : null;
    if (currentId != null && String(currentId) !== String(trackId)) return;

    if (!res) {
      // 确认失败：无有效回包 → empty
      pageState.lyricsSongId = trackId;
      if (!pageState.lyrics || pageState.lyrics.length === 0) {
        renderLyrics([], -1, { confirmed: true });
      } else {
        applyLyricsVerdict(pageState.lyrics, { confirmed: true });
      }
      return;
    }

    var verbatim = (res.verbatim && res.verbatim.length) ? res.verbatim : [];
    if (verbatim.length > 0) {
      pageState.verbatimLyrics = verbatim;
      pageState.lyrics = verbatim.map(function(v) {
        return { time: v.time, text: v.text, translation: v.translation };
      });
    } else {
      pageState.verbatimLyrics = [];
      if (res.lines && res.lines.length) pageState.lyrics = res.lines;
      else if (!hasProvisional) pageState.lyrics = [];
    }

    // 成功应用后再标记归属
    pageState.lyricsSongId = trackId;

    pageState.hasTranslation = !!res.hasTranslation;
    pageState.transLang = res.translationLang || '';
    var transUi = syncLyricTransUI();

    var st = pageState.status || {};
    var pos = st.position || (st.progress ? st.progress.current : 0) || 0;
    var idx = updateLyricIndex(pos, pageState.lyrics);
    pageState.currentLyricIndex = idx;
    pageState.lastKaraokeLine = -1;
    // ★ 确认后：≥5 ready，否则 empty
    renderLyrics(pageState.lyrics, idx, { confirmed: true });
    if (pageState.lyricsLoadState === 'ready' && (transUi.showing || transUi.changed)) {
      scheduleLyricLayoutRemeasure();
    }
    if (pageState.lyricsLoadState === 'ready' && pageState.verbatimLyrics.length > 0) {
      setLyricClock(pos, st.isPlaying);
      updateWordHighlight(pos);
      ensureLyricWordLoop();
    }
  }).catch(function() {
    if (requestGen !== pageState.lyricsRequestGen) return;
    if (String(pageState.lyricsLoadingTrackId) === String(trackId)) {
      pageState.lyricsLoadingTrackId = null;
    }
    pageState.verbatimLyrics = [];
    pageState.hasTranslation = false;
    syncLyricTransUI();
    pageState.lyricsSongId = trackId;
    // 确认：有占位则按行数判；无则 empty
    // 不能用 `|| -1`：索引 0（第一句）是合法值会被吞掉，失败回退时首句高亮丢失
    var failIdx = typeof pageState.currentLyricIndex === 'number'
      ? pageState.currentLyricIndex : -1;
    renderLyrics(pageState.lyrics || [], failIdx, { confirmed: true });
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
  bufferSize: 8, // 预载行数；过大时上滚回收/创建 DOM 卡顿
  visibleStart: 0,
  visibleEnd: 0,
  data: [],
  currentTrackId: null,
  searchQuery: '',
  scrollHandler: null,
  pendingScrollToCurrent: false, // 面板首次可见/列表切换时滚动到当前歌曲
  // 用户正在手势滚动：禁止 auto-center 抢 scrollTop（移动端回弹根因之一）
  userScrolling: false,
  userScrollTimer: null,
  // 程序化改 scrollTop 时置位，避免 scroll 事件被误判为用户手势
  programmaticScroll: false,
  // DOM缓存池
  itemPool: [],
  activeItems: new Map(), // index -> DOM element
  lastTotalHeight: 0,
  isRendering: false,
  needsRender: false // 滚动帧合并：上一帧未画完时排队下一帧
};

// 标记用户在播放列表内滚动；结束后短延迟才允许自动居中
function markPlaylistUserScroll() {
  virtualList.userScrolling = true;
  if (virtualList.userScrollTimer) clearTimeout(virtualList.userScrollTimer);
  virtualList.userScrollTimer = setTimeout(function() {
    virtualList.userScrollTimer = null;
    virtualList.userScrolling = false;
  }, 180);
}

// 程序化滚动：短暂屏蔽「用户滚动」判定
function withProgrammaticPlaylistScroll(fn) {
  virtualList.programmaticScroll = true;
  try {
    fn();
  } finally {
    // scroll 事件多在同步路径触发；下一帧再清，覆盖 smooth scroll 起始事件
    requestAnimationFrame(function() {
      virtualList.programmaticScroll = false;
    });
  }
}

// 仅在合理时机把当前曲滚到视口中部；用户手势中绝不改 scrollTop
function scrollPlaylistToCurrent(opts) {
  opts = opts || {};
  if (virtualList.userScrolling && !opts.force) return;
  var scroller = virtualList.scrollContainer || document.querySelector('.playlist-scroll');
  if (!scroller) return;
  var trackId = virtualList.currentTrackId ||
    (pageState.status && pageState.status.currentTrack && pageState.status.currentTrack.id);
  if (!trackId) return;

  // 虚拟列表：按 itemHeight 算目标
  if (virtualList.contentWrapper && virtualList.data.length > 0) {
    var curIdx = -1;
    for (var k = 0; k < virtualList.data.length; k++) {
      if (virtualList.data[k].id === trackId) { curIdx = k; break; }
    }
    if (curIdx < 0 || scroller.clientHeight <= 0) return;
    var target = Math.max(0, curIdx * virtualList.itemHeight -
      scroller.clientHeight / 2 + virtualList.itemHeight / 2);
    if (Math.abs(scroller.scrollTop - target) <= 1) return;
    withProgrammaticPlaylistScroll(function() {
      if (opts.smooth && shouldAnimate() && typeof scroller.scrollTo === 'function') {
        scroller.scrollTo({ top: target, behavior: 'smooth' });
      } else {
        scroller.scrollTop = target;
      }
    });
    return;
  }

  // 整表模式
  var active = scroller.querySelector('.playlist-item.active');
  if (!active) {
    active = scroller.querySelector('.playlist-item[data-id="' + trackId + '"]');
  }
  if (!active) return;
  withProgrammaticPlaylistScroll(function() {
    if (opts.smooth && shouldAnimate()) {
      active.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      active.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  });
}

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
    // 相对定位容器：子项 absolute + top，滚动不再改 wrapper.top
    virtualList.contentWrapper.style.cssText = 'position:relative;width:100%;height:100%;';
    
    virtualList.innerWrapper.appendChild(virtualList.contentWrapper);
    virtualList.container.appendChild(virtualList.innerWrapper);

    // 点击/触摸委托绑定在常驻容器上（幂等）
    bindPlaylistActivation();
  }
  
  // 移除旧的滚动监听
  if (virtualList.scrollHandler) {
    virtualList.scrollContainer.removeEventListener('scroll', virtualList.scrollHandler);
  }
  
  // 滚动：rAF 合并，避免上滚时堆积同步布局
  virtualList.scrollHandler = function() {
    if (!virtualList.programmaticScroll) {
      markPlaylistUserScroll();
    }
    if (virtualList.isRendering) {
      virtualList.needsRender = true;
      return;
    }
    virtualList.isRendering = true;
    requestAnimationFrame(function() {
      virtualList.isRendering = false;
      renderVisibleItems();
      if (virtualList.needsRender) {
        virtualList.needsRender = false;
        virtualList.isRendering = true;
        requestAnimationFrame(function() {
          virtualList.isRendering = false;
          renderVisibleItems();
        });
      }
    });
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
      try {
        cover.decoding = 'async';
        cover.referrerPolicy = 'no-referrer';
        // 列表滚动：一律 lazy，避免上滚创建节点时抢带宽/解码
        cover.loading = 'lazy';
        cover.fetchPriority = 'low';
      } catch (_e) { /* ignore */ }
      if (cover.getAttribute('data-src') !== song.cover) {
        cover.setAttribute('data-src', song.cover);
        cover.src = song.cover;
      }
      cover.style.display = 'block';
    } else {
      cover.removeAttribute('src');
      cover.removeAttribute('data-src');
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
  // 绝对定位：滚动只改 top，避免 contentWrapper 整体平移带来的上滚重排卡顿
  el.style.cssText = 'position:absolute;left:0;right:0;box-sizing:border-box;';
  el.innerHTML = PLAYLIST_ITEM_HTML;
  return el;
}

// 更新DOM元素内容
function updateItemContent(el, song, isActive, index) {
  var topPx = (index * virtualList.itemHeight) + 'px';
  if (el.style.top !== topPx) el.style.top = topPx;

  // 只在内容变化时更新（滚动热路径避免重复填封面）
  if (el.getAttribute('data-id') !== String(song.id)) {
    el.setAttribute('data-id', song.id);
    el.setAttribute('data-index', song.originalIndex);
    fillPlaylistItem(el, song);
  }

  var wantActive = !!isActive;
  if (el.classList.contains('active') !== wantActive) {
    el.classList.toggle('active', wantActive);
  }
}

// 渲染可见项
function renderVisibleItems() {
  if (!virtualList.contentWrapper || !virtualList.scrollContainer) {
    return;
  }
  if (virtualList.data.length === 0) {
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
    virtualList.activeItems.forEach(function(el, idx) {
      var song = virtualList.data[idx];
      if (song) {
        var isActive = !!(virtualList.currentTrackId && song.id === virtualList.currentTrackId);
        if (el.classList.contains('active') !== isActive) {
          el.classList.toggle('active', isActive);
        }
      }
    });
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
  
  // 回收不再可见的元素（批量 detach）
  var detachFrag = null;
  virtualList.activeItems.forEach(function(el, idx) {
    if (idx < startIndex || idx >= endIndex) {
      virtualList.itemPool.push(el);
      virtualList.activeItems.delete(idx);
      if (el.parentNode) {
        if (!detachFrag) detachFrag = document.createDocumentFragment();
        detachFrag.appendChild(el); // 移出文档，减少多次 reflow
      }
    }
  });
  
  // 渲染可见元素
  var fragment = null;
  var needsAppend = false;
  
  for (var i = startIndex; i < endIndex; i++) {
    var song = virtualList.data[i];
    if (!song) continue;
    var isActive = virtualList.currentTrackId && song.id === virtualList.currentTrackId;
    
    var el = virtualList.activeItems.get(i);
    if (!el) {
      el = getPooledItem();
      virtualList.activeItems.set(i, el);
      
      if (!fragment) fragment = document.createDocumentFragment();
      fragment.appendChild(el);
      needsAppend = true;
    }
    
    updateItemContent(el, song, isActive, i);
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
        renderVisibleItems();
        return;
      }
    }
  }

  // 面板首次可见 / 列表数据切换：滚到当前曲（用户手势中跳过，防回弹）
  if (virtualList.pendingScrollToCurrent && virtualList.currentTrackId &&
      virtualList.scrollContainer.clientHeight > 0) {
    if (virtualList.userScrolling) {
      // 用户正在滚：丢弃本次自动居中，不要与手势抢 scrollTop
      virtualList.pendingScrollToCurrent = false;
    } else {
      var curIdx = -1;
      for (var k = 0; k < dataLen; k++) {
        if (virtualList.data[k].id === virtualList.currentTrackId) { curIdx = k; break; }
      }
      if (curIdx >= 0) {
        virtualList.pendingScrollToCurrent = false;
        var target = Math.max(0, curIdx * virtualList.itemHeight -
          virtualList.scrollContainer.clientHeight / 2 + virtualList.itemHeight / 2);
        if (Math.abs(virtualList.scrollContainer.scrollTop - target) > 1) {
          withProgrammaticPlaylistScroll(function() {
            virtualList.scrollContainer.scrollTop = target;
          });
          virtualList.visibleStart = -1; // 新位置需重渲，避免空白
          virtualList.visibleEnd = -1;
          renderVisibleItems();
          return;
        }
      } else {
        virtualList.pendingScrollToCurrent = false;
      }
    }
  }
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
// 滚动与点击分离：移动超过阈值不触发选歌；绝不 preventDefault touchmove（否则无法滚）
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
  // 阈值略大：拇指滚动时微小抖动不应被当成点击
  var MOVE_THRESHOLD = 12;
  container.addEventListener('touchstart', function(e) {
    var tt = e.touches[0];
    startX = tt.clientX; startY = tt.clientY; moved = false;
  }, { passive: true });
  container.addEventListener('touchmove', function(e) {
    var tt = e.touches[0];
    if (Math.abs(tt.clientX - startX) > MOVE_THRESHOLD ||
        Math.abs(tt.clientY - startY) > MOVE_THRESHOLD) {
      moved = true;
      markPlaylistUserScroll();
    }
    // 注意：不 preventDefault，保持原生 overflow 滚动
  }, { passive: true });
  container.addEventListener('touchend', function(e) {
    if (moved) return;
    var tt = e.changedTouches[0];
    var el = tt ? document.elementFromPoint(tt.clientX, tt.clientY) : null;
    if (el) {
      // 仅在确认是点击时 suppress 合成 click，避免双触发；滚动路径绝不拦截
      e.preventDefault();
      activate(el);
    }
  }, { passive: false });
  container.addEventListener('click', function(e) {
    // 桌面端主路径；移动端 touchend 已 preventDefault 抑制合成 click
    if (moved) return;
    activate(e.target);
  });
}

// 打开播放列表面板：此刻才有真实高度，填满可见项并滚到当前歌曲
function revealPlaylist() {
  // 用户刚打开面板：允许强制居中（force 覆盖 userScrolling）
  virtualList.userScrolling = false;
  if (virtualList.userScrollTimer) {
    clearTimeout(virtualList.userScrollTimer);
    virtualList.userScrollTimer = null;
  }
  if (virtualList.contentWrapper && virtualList.data.length > 0) {
    // 一次全量重渲：重测高度 + 滚到当前歌曲（由 renderVisibleItems 内统一处理）
    virtualList.measured = false;
    virtualList.pendingScrollToCurrent = true;
    virtualList.visibleStart = -1;
    virtualList.visibleEnd = -1;
    renderVisibleItems();
  } else {
    scrollPlaylistToCurrent({ force: true });
  }
}

// 缓存的搜索结果
var playlistCache = {
  lastQuery: null,
  lastResult: null,
  lastPlaylistLen: 0,
  lastPlaylistSig: null // 首尾曲 id：换成等长的另一张歌单时也能失效
};

// 列表身份签名：长度相同但内容不同（导入等长外部歌单）时也要重新过滤
function playlistSignature(list) {
  if (!list || list.length === 0) return '';
  var first = list[0] && list[0].id;
  var last = list[list.length - 1] && list[list.length - 1].id;
  return String(first) + '|' + String(last);
}

// 渲染播放列表（使用虚拟滚动）
function renderPlaylist(playlist, currentTrack, searchQuery) {
  var container = $('playlist-container');
  if (!container) return;

  var filteredList;
  var query = searchQuery ? searchQuery.toLowerCase() : '';
  
  // 使用缓存避免重复过滤
  var sig = playlistSignature(playlist);
  if (query === playlistCache.lastQuery &&
      playlist.length === playlistCache.lastPlaylistLen &&
      sig === playlistCache.lastPlaylistSig) {
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
    playlistCache.lastPlaylistSig = sig;
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
      (searchQuery ? t('noSearchResults') : t('noPlaylist')) +
      (!searchQuery ? '<div class="playlist-empty-hint">' + t('emptyHint') + '</div>' : '') +
      '</div>';
    return;
  }
  
  // 更新 Tab badge
  var badge = $('playlist-badge');
  if (badge) {
    var newLen = String(playlist.length);
    if (badge.textContent !== newLen) badge.textContent = newLen;
  }
  
  var newTrackId = currentTrack ? currentTrack.id : null;
  // shouldScrollToCurrent：仅列表数据/搜索变化时居中；纯切曲只更新 active，不抢滚动
  var shouldScrollToCurrent = false;

  // 中小列表直接整表渲染（图片懒加载，性能足够，且保证全部歌曲可见）；
  // 仅超大列表才用虚拟滚动
  if (filteredList.length <= 200) {
    shouldScrollToCurrent = !searchQuery;
    renderPlaylistSimple(filteredList, currentTrack, shouldScrollToCurrent);
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
      // 数据变化：滚到当前歌曲（用户手势中由 renderVisibleItems 丢弃）
      if (!searchQuery) {
        virtualList.pendingScrollToCurrent = true;
        shouldScrollToCurrent = true;
      }
    }
    
    renderVisibleItems();
    
    // 列表数据刚变：一次居中即可（pendingScroll 已在 render 内处理；
    // 此处不再 setTimeout 二次 scrollTop，避免与用户手势/首次居中打架回弹）
    if (shouldScrollToCurrent && currentTrack && !virtualList.userScrolling) {
      // renderVisibleItems 可能因 clientHeight=0 未完成居中，下一帧再试一次
      requestAnimationFrame(function() {
        if (virtualList.pendingScrollToCurrent) {
          renderVisibleItems();
        }
      });
    }
  }
}

// 简单渲染（小列表）
// scrollToCurrent：是否滚到当前曲。搜索/用户滚动中应传 false，避免列表一滚就弹回
function renderPlaylistSimple(filteredList, currentTrack, scrollToCurrent) {
  var container = $('playlist-container');
  if (!container) return;
  
  // 重置虚拟列表容器引用（因为下面会用 innerHTML 清空）
  virtualList.innerWrapper = null;
  virtualList.contentWrapper = null;
  virtualList.activeItems.clear();
  virtualList.visibleStart = -1;
  virtualList.visibleEnd = -1;
  virtualList.currentTrackId = currentTrack ? currentTrack.id : null;
  
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
  
  // 保留滚动位置：整表重建时浏览器会把 scrollTop 清零，先记下再恢复
  var prevScrollTop = container.scrollTop;
  container.innerHTML = '';
  container.appendChild(fragment);

  // 点击/触摸委托绑定在常驻容器上（幂等）
  bindPlaylistActivation();

  if (scrollToCurrent && currentTrack && !virtualList.userScrolling) {
    requestAnimationFrame(function() {
      if (virtualList.userScrolling) return;
      scrollPlaylistToCurrent({ smooth: true });
    });
  } else if (!scrollToCurrent && prevScrollTop > 0) {
    // 重建后恢复用户滚动位置，避免「一滚就回弹/跳顶」
    withProgrammaticPlaylistScroll(function() {
      container.scrollTop = prevScrollTop;
    });
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

/** 预解码邻曲封面（利用浏览器 HTTP 缓存，切歌时主封面 img 更快出图） */
var coverPrefetchCache = Object.create(null);
function prefetchNeighborCovers(currentTrackId) {
  var list = pageState.playlist;
  if (!list || !list.length || currentTrackId == null) return;
  var idx = -1;
  for (var i = 0; i < list.length; i++) {
    if (list[i] && String(list[i].id) === String(currentTrackId)) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return;
  var offsets = [-1, 1, 2];
  for (var j = 0; j < offsets.length; j++) {
    var s = list[idx + offsets[j]];
    if (!s) continue;
    var url = getTrackCoverUrl(s);
    if (!url || coverPrefetchCache[url]) continue;
    coverPrefetchCache[url] = true;
    try {
      var img = new Image();
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.src = url;
    } catch (_e) { /* ignore */ }
  }
  // 限制缓存键数量，避免无限增长
  var keys = Object.keys(coverPrefetchCache);
  if (keys.length > 80) {
    for (var k = 0; k < keys.length - 40; k++) {
      delete coverPrefetchCache[keys[k]];
    }
  }
}

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
  var primary = deriveReadableLyricColor(primaryCandidates, '#fc3c44', isDark, isDark ? 0.78 : 0.34, 3.7);
  var secondary = deriveReadableLyricColor(secondaryCandidates, primaryRaw, isDark, isDark ? 0.70 : 0.42, 3.4);

  root.style.setProperty('--lyric-active-primary', primary);
  root.style.setProperty('--lyric-active-secondary', secondary);
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

// 容器尺寸变化后重新测量。
//
// ⚠️ 绝不能走 setScrollingText 的重建路径（清 __mqText 再重设）：那条路会先
// remove('is-marquee') + 清掉 --marquee-shift，正在滚动的标题 transform 当场
// 弹回 translateX(0)，随后 rAF 重新加类、动画从 0% 重播——就是「标题滚到头忽然
// 闪回开头」。而稳态播放里 syncNoLyricsLayout 本来就会周期性触发重测，
// 于是这一下闪回会反复出现。
// 这里只在测量结果真的变了时才动 DOM；宽度没变就完全不碰，动画保持连续。
function remeasureScrollingText(outer) {
  if (!outer || outer.__mqText == null) return;
  if (prefersReducedMotion) return;
  var inner = outer.querySelector('.marquee-inner');
  if (!inner) return;

  var overflow = inner.scrollWidth - outer.clientWidth;
  if (overflow <= 4) {
    // 变得放得下了（如侧栏收起）：退回省略号
    if (outer.classList.contains('is-marquee')) {
      outer.classList.remove('is-marquee');
      outer.style.removeProperty('--marquee-shift');
      outer.style.removeProperty('--marquee-duration');
    }
    return;
  }

  var shift = overflow + 16; // 与 setScrollingText 保持同一套算法
  var nextShift = '-' + shift + 'px';
  // 同一宽度重复测量：什么都不做，让动画接着跑
  if (outer.classList.contains('is-marquee') &&
      outer.style.getPropertyValue('--marquee-shift') === nextShift) {
    return;
  }
  outer.style.setProperty('--marquee-shift', nextShift);
  outer.style.setProperty('--marquee-duration',
    Math.min(24, Math.max(6, shift / 40)).toFixed(1) + 's');
  outer.classList.add('is-marquee');
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
  if (!isStatusCurrent(status)) return;

  // 确保 DOM 引用已缓存
  initProgressElements();
  
  var track = status.currentTrack;
  var duration = track ? (track.duration || 0) : 0;
  // 跳转未落位时用意图位置，避免宿主旧 position 把滑块从手指下拽回去
  var position = resolveSeekPosition(
    status.position || (status.progress ? status.progress.current : 0) || 0
  );

  if (progressElements.bar) {
    progressElements.bar.value = position;
    try {
      var durA = track ? (track.duration || 0) : 0;
      progressElements.bar.setAttribute('aria-valuenow', String(Math.floor(position)));
      progressElements.bar.setAttribute('aria-valuemin', '0');
      if (durA > 0) progressElements.bar.setAttribute('aria-valuemax', String(Math.floor(durA)));
    } catch (_e) {}
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
  // 过期世代 / 串曲：丢弃（进度类走 updateProgressOnly 另有校验）
  if (!isStatusCurrent(status)) return;

  var track = status.currentTrack;
  var coverUrl = getTrackCoverUrl(track);

  updateEmptyAndLoadingUI(status);

  // 动态背景 - 使用封面作为模糊背景
  var bgArtwork = $('bg-artwork');
  if (bgArtwork && coverUrl !== lastCoverUrl) {
    bgArtwork.style.backgroundImage = coverUrl ? toCssImageUrl(coverUrl) : 'none';
    lastCoverUrl = coverUrl;
  }

  // 主题色：无真实取色时保留上一首（不 force 中性/默认红）
  applyThemeColors(status, !track);

  // 封面 crossfade + track 归属（快速切歌丢弃过期 onload）
  var coverEl = $('album-cover');
  var coverPlaceholder = $('cover-placeholder');
  var coverTrackKey = track ? String(track.id) : '';
  if (coverEl && coverPlaceholder) {
    if (coverUrl) {
      coverEl.setAttribute('data-track-id', coverTrackKey);
      if (coverEl.getAttribute('data-src') !== coverUrl) {
        coverEl.setAttribute('data-src', coverUrl);
        try {
          // sync 解码：缓存命中立刻上屏；async 会拖慢「封面同步」体感
          coverEl.decoding = 'sync';
          coverEl.fetchPriority = 'high';
          coverEl.loading = 'eager';
          coverEl.referrerPolicy = 'no-referrer';
        } catch (_e) { /* ignore */ }
        coverEl.onload = function() {
          if (coverEl.getAttribute('data-track-id') !== coverTrackKey) return;
          coverEl.classList.remove('cover-fading');
          coverEl.style.display = 'block';
          if (coverPlaceholder) coverPlaceholder.style.display = 'none';
        };
        coverEl.src = coverUrl;
        // 缓存命中：同步 complete，跳过淡出，封面即时切换
        if (coverEl.complete && coverEl.naturalWidth > 0) {
          coverEl.classList.remove('cover-fading');
          coverEl.style.display = 'block';
          if (coverPlaceholder) coverPlaceholder.style.display = 'none';
        } else {
          coverEl.classList.add('cover-fading');
        }
      } else {
        coverEl.style.display = 'block';
        coverPlaceholder.style.display = 'none';
      }
      coverEl.onerror = function() {
        if (coverEl.getAttribute('data-track-id') !== coverTrackKey) return;
        coverEl.classList.remove('cover-fading');
        coverEl.style.display = 'none';
        coverPlaceholder.style.display = 'flex';
      };
    } else {
      coverEl.removeAttribute('data-track-id');
      coverEl.removeAttribute('data-src');
      coverEl.removeAttribute('src');
      coverEl.classList.remove('cover-fading');
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
  var position = resolveSeekPosition(
    status.position || (status.progress ? status.progress.current : 0) || 0
  );

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
  
  // 根据播放状态控制背景漂移意图（实际推进在 eqTick）
  if (status.isPlaying) {
    startBackgroundAnimation();
  } else {
    // 暂停：冻结当前相位（不复位 transform）；卸 will-change
    pageState.bgDriftOn = false;
  }
  syncFxCompositing();
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
  mode: null,
  // 异步取色完成后必须触发 UI 刷新；旧版忽略 primaryColor 会导致颜色长期滞后
  primaryColor: null,
  secondaryColor: null,
  accentColor: null,
  generation: null,
  isLoading: null,
  lastError: null
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

/**
 * 是否需要全量 UI 刷新。
 * 注意：position / volume 不算 significant——否则 progress 每 0.5s 全量 updatePlayerUI，
 * 拖慢主题色/封面/歌词主线程。
 */
function hasSignificantChange(state) {
  var trackId = state.currentTrack ? String(state.currentTrack.id) : null;
  var prevId = lastStateSnapshot.trackId != null ? String(lastStateSnapshot.trackId) : null;
  var coverUrl = getTrackCoverUrl(state.currentTrack);
  var gen = typeof state.generation === 'number' ? state.generation : null;
  var loading = !!(state.isLoading || state.isAudioLoading);

  return trackId !== prevId ||
      coverUrl !== lastStateSnapshot.coverUrl ||
      state.isPlaying !== lastStateSnapshot.isPlaying ||
      state.mode !== lastStateSnapshot.mode ||
      (state.primaryColor || null) !== lastStateSnapshot.primaryColor ||
      (state.secondaryColor || null) !== lastStateSnapshot.secondaryColor ||
      (state.accentColor || null) !== lastStateSnapshot.accentColor ||
      gen !== lastStateSnapshot.generation ||
      loading !== lastStateSnapshot.isLoading ||
      (state.lastError || null) !== lastStateSnapshot.lastError;
}

/** 仅主题色变化（同曲同封面）→ 只写 CSS 变量，跳过封面/跑马灯/整页 UI */
function isThemeColorOnlyChange(state) {
  var trackId = state.currentTrack ? String(state.currentTrack.id) : null;
  var prevId = lastStateSnapshot.trackId != null ? String(lastStateSnapshot.trackId) : null;
  if (trackId !== prevId) return false;
  if (getTrackCoverUrl(state.currentTrack) !== lastStateSnapshot.coverUrl) return false;
  var pc = state.primaryColor || null;
  var sc = state.secondaryColor || null;
  var ac = state.accentColor || null;
  return pc !== lastStateSnapshot.primaryColor ||
    sc !== lastStateSnapshot.secondaryColor ||
    ac !== lastStateSnapshot.accentColor;
}

// 更新状态快照
function updateStateSnapshot(state) {
  lastStateSnapshot.trackId = state.currentTrack ? state.currentTrack.id : null;
  lastStateSnapshot.coverUrl = getTrackCoverUrl(state.currentTrack);
  lastStateSnapshot.isPlaying = state.isPlaying;
  lastStateSnapshot.position = state.position || (state.progress ? state.progress.current : 0) || 0;
  lastStateSnapshot.volume = state.volume || 0;
  lastStateSnapshot.mode = state.mode;
  lastStateSnapshot.primaryColor = state.primaryColor || null;
  lastStateSnapshot.secondaryColor = state.secondaryColor || null;
  lastStateSnapshot.accentColor = state.accentColor || null;
  lastStateSnapshot.generation =
    typeof state.generation === 'number' ? state.generation : null;
  lastStateSnapshot.isLoading = !!(state.isLoading || state.isAudioLoading);
  lastStateSnapshot.lastError = state.lastError || null;
}

// 初始化页面
async function initPage() {
  // 尽早同步移动/平板 class，避免首帧走错布局（Sheet vs 桌面侧栏）
  try { checkIsMobile(); } catch (e) { /* ignore */ }
  // 页面标题由宿主窗口栏显示，本页没有 #page-title 元素（原来那两行是空跑）

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
    bindTrackFromStatus(status);
    updatePlayerUI(status);
    // 必须先写入 snapshot：否则订阅后首帧 state 会把 null→id 当成切歌，
    // gen++ 作废 init 已发出的 getLyrics，表现为「每首歌必加载两次」
    updateStateSnapshot(status);

    // 获取歌词（逐行兜底先渲染，逐字异步加载后覆盖）。
    // 本曲歌词已自载（lyricsSongId 匹配）则绝不覆盖：initPage 会因 locale 事件
    // 等重跑，此时用 status 的网易逐行去踩自载的酷狗 verbatim 派生行，
    // 两个行集错位 → 呼吸点乱插/高亮失效（且 loadLyricsForTrack 因去重不自愈）
    if (status.lyrics && status.lyrics.length > 0 &&
        !(status.currentTrack &&
          pageState.lyricsSongId != null &&
          String(status.currentTrack.id) === String(pageState.lyricsSongId))) {
      // 注意不能用 `|| -1`：索引 0（第一句）是合法值会被吞掉
      var initIdx = typeof status.currentLyricIndex === 'number' ? status.currentLyricIndex : -1;
      pageState.lyrics = status.lyrics;
      pageState.currentLyricIndex = initIdx;
      // 宿主兜底词未确认：勿 confirmed 默认 true（短词会先 empty 再被 load 打回）
      renderLyrics(status.lyrics, initIdx, { confirmed: false });
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
    normalizeMediaState(state);

    var prevTrackId = lastStateSnapshot.trackId;
    var nextTrackId = state.currentTrack ? state.currentTrack.id : null;
    var trackChanged = String(prevTrackId || '') !== String(nextTrackId || '');
    var significantChange = trackChanged || hasSignificantChange(state);
    var colorOnly = !trackChanged && significantChange && isThemeColorOnlyChange(state);

    // 切歌：作废旧请求；先 loading（乐观有词），确认后再 empty/ready
    if (trackChanged) {
      significantChange = true;
      colorOnly = false;
      // 跳转意图只属于上一首：不清的话（点歌词/拖进度后立刻切歌）新曲会拿
      // 旧曲的目标时间当作播放位置，歌词时钟直接落在几十秒处，约 1.5s 才回正
      seekIntent = null;
      bindTrackFromStatus(state);
      // 同曲已在飞（常见：init 已 load，首帧 state 仍报 trackChanged）→ 绝不能 gen++ 作废
      var alreadyLoadingSame = nextTrackId != null &&
        pageState.lyricsLoadingTrackId != null &&
        String(pageState.lyricsLoadingTrackId) === String(nextTrackId);
      var alreadyReadySame = nextTrackId != null &&
        pageState.lyricsSongId != null &&
        String(pageState.lyricsSongId) === String(nextTrackId) &&
        (pageState.lyricsLoadState === 'ready' || pageState.lyricsLoadState === 'empty');
      if (!alreadyLoadingSame && !alreadyReadySame) {
        pageState.lyricsRequestGen++;
        pageState.lyricsLoadingTrackId = null; // 允许为新曲发起请求
        pageState.verbatimLyrics = [];
        pageState.lastKaraokeLine = -1;
        pageState.hasTranslation = false;
        // ★ 先有词布局，不先 empty
        setLyricsUiMode('loading');
        // 预解码邻曲封面，连点切歌时 img 已在浏览器缓存
        prefetchNeighborCovers(nextTrackId);
        // 仅当已展示歌词不属于新曲时清空（自载成功且 id 匹配则保留）
        if (pageState.lyricsSongId == null ||
            String(pageState.lyricsSongId) !== String(nextTrackId || '')) {
          pageState.lyricsSongId = null;
          // 先关掉 show-trans 再渲染：避免沿用上一首「翻译开」时测得的行高
          syncLyricTransUI();
          // 宿主若已带来新曲歌词则用它，否则清空等待 getLyrics
          if (state.lyrics && state.lyrics.length > 0) {
            pageState.lyrics = state.lyrics;
            pageState.currentLyricIndex =
              typeof state.currentLyricIndex === 'number' ? state.currentLyricIndex : -1;
          } else {
            pageState.lyrics = [];
            pageState.currentLyricIndex = -1;
          }
          renderLyrics(pageState.lyrics, pageState.currentLyricIndex, { confirmed: false });
        }
      }
    }

    // 世代前进但 id 相同（极端重入）时也刷新绑定
    if (!trackChanged && typeof state.generation === 'number' &&
        state.generation > pageState.boundGeneration) {
      pageState.boundGeneration = state.generation;
    }
    if (!pageState.boundTrackId && state.currentTrack) {
      bindTrackFromStatus(state);
    }

    pageState.status = state;

    // UI：色-only 快路径 / 关键变化全量 / 其余仅进度（progress 不再全量刷）
    if (colorOnly) {
      updateStateSnapshot(state);
      applyThemeColors(state, !state.currentTrack);
    } else if (significantChange) {
      updateStateSnapshot(state);
      updatePlayerUI(state);
      // 切歌后布局：仅 track 变时 relayout，避免主题色事件误触歌词重排
      if (trackChanged) relayoutLyricsIfNeeded();
    } else if (isStatusCurrent(state)) {
      updateProgressOnly(state);
      lastStateSnapshot.position =
        state.position || (state.progress ? state.progress.current : 0) || 0;
      lastStateSnapshot.volume = state.volume || 0;
    }

    // 位置 + 插值时钟（供逐字高亮平滑推进）
    var position = resolveSeekPosition(
      state.position || (state.progress ? state.progress.current : 0) || 0
    );
    setLyricClock(position, state.isPlaying);

    // EQ 循环：内部幂等，极廉价
    ensureEqLoop();

    // 切歌 / 非色-only 关键变化才拉歌词与 beat（progress / 纯取色不上）
    if (state.currentTrack && (trackChanged || (significantChange && !colorOnly))) {
      if (needsLyricsLoad(state.currentTrack)) {
        loadLyricsForTrack(state.currentTrack);
      }
      if (trackChanged) loadBeatGridForTrack(state.currentTrack);
    }

    // 有词/无词 verdict：仅切歌
    if (trackChanged) {
      if (pageState.lyricsLoadState === 'loading') {
        if (areLyricsUsable(pageState.lyrics)) {
          applyLyricsVerdict(pageState.lyrics, { confirmed: true });
        }
      } else if (pageState.lyricsLoadState === 'ready' || pageState.lyricsLoadState === 'empty') {
        var usableNow = areLyricsUsable(pageState.lyrics);
        var isReady = pageState.lyricsLoadState === 'ready';
        if (usableNow !== isReady) {
          revalidateLyricsContentMode();
        }
      }
    }

    // 歌词内容必须与当前曲一致才推进高亮；否则只等加载完成
    var lyricsBelongToCurrent = !!(
      state.currentTrack &&
      pageState.lyricsSongId != null &&
      String(pageState.lyricsSongId) === String(state.currentTrack.id) &&
      pageState.lyricsLoadState === 'ready'
    );
    // 本曲已确认无词：progress/status 不得再拿宿主短词重渲（会 empty→loading 闪回）
    var emptyStick = !trackChanged && isConfirmedEmptyForCurrentTrack();

    if (emptyStick) {
      // 粘住 empty 布局；顺带用终态数据覆盖宿主可能写入的脏短词
      // （不 render，避免无意义 DOM 抖动）
    } else if (lyricsBelongToCurrent && pageState.verbatimLyrics.length > 0) {
      // 逐字模式：行渲染沿用 pageState.lyrics，仅在行切换时重渲染，字级填充走 rAF
      var vPrev = pageState.currentLyricIndex;
      var vIdx = updateLyricIndex(position, pageState.lyrics);
      if (vIdx !== vPrev) {
        pageState.currentLyricIndex = vIdx;
        // 切行：增量类名 + 波浪跟焦。顺序推进必须走弹簧（这就是波浪引擎的主战场），
        // 只有 seek 级大跨度才瞬移——长距离弹簧既没观感又扫全表
        renderLyrics(pageState.lyrics, vIdx, {
          confirmed: true,
          focusInstant: isLyricSeekJump(vPrev, vIdx)
        });
      }
      updateWordHighlight(getLyricPosition());
      ensureLyricWordLoop();
    } else if (lyricsBelongToCurrent || (state.lyrics && state.lyrics.length > 0)) {
      // 逐行模式（兜底）- 优先自载歌词，否则用 state.lyrics
      var lyrics = lyricsBelongToCurrent
        ? pageState.lyrics
        : (state.lyrics || []);
      var currentLyricIdx = updateLyricIndex(position, lyrics);

      if (lyrics.length > 0) {
        // 如果歌词变化了，重新渲染
        if (!pageState.lyrics || pageState.lyrics.length !== lyrics.length ||
            (pageState.lyrics[0] && lyrics[0] && pageState.lyrics[0].text !== lyrics[0].text)) {
          pageState.lyrics = lyrics;
          if (!lyricsBelongToCurrent && state.currentTrack) {
            // 宿主下发的逐行：未确认前不算最终归属；仅展示
            // （getLyrics 成功后再写 lyricsSongId）
          }
          // 宿主推送：若已确认本曲有词则 confirmed；否则乐观展示
          var hostConfirmed = pageState.lyricsLoadState === 'ready' && lyricsBelongToCurrent;
          renderLyrics(lyrics, currentLyricIdx, { confirmed: hostConfirmed });
        } else if (currentLyricIdx !== pageState.currentLyricIndex) {
          var linePrev = pageState.currentLyricIndex;
          pageState.currentLyricIndex = currentLyricIdx;
          renderLyrics(lyrics, currentLyricIdx, {
            confirmed: pageState.lyricsLoadState === 'ready',
            focusInstant: isLyricSeekJump(linePrev, currentLyricIdx)
          });
        }
      }
    } else if (pageState.lyrics && pageState.lyrics.length > 0 && !lyricsBelongToCurrent) {
      // 无归属歌词且宿主也未下发：保持切歌时已清空的状态，避免旧词残留
      if (trackChanged) {
        // 已在上面清空
      } else if (!(state.currentTrack && state.currentTrack.id === pageState.lyricsSongId)) {
        pageState.lyrics = [];
        pageState.currentLyricIndex = -1;
        // 未确认前保持 loading，不 empty；已 empty 则不动
        if (pageState.lyricsLoadState !== 'loading' && pageState.lyricsLoadState !== 'empty') {
          renderLyrics([], -1, { confirmed: false });
        }
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

  // 默认侧栏都不选 → 封面优先
  syncNoLyricsLayout();

  // 页面可见性优化 - 不可见时暂停非关键动画（只绑一次）
  if (firstBind) document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // 页面不可见：停背景漂移意图 + 卸合成层提示
      stopBackgroundAnimation();
      document.documentElement.classList.remove('fx-compositing');
    } else {
      // 页面恢复可见
      if (pageState.status && pageState.status.isPlaying && shouldAnimate()) {
        startBackgroundAnimation();
        ensureEqLoop();
      }
      syncFxCompositing();
    }
  }, { passive: true });
}

/**
 * 静态控件的 i18n 文案（按钮标签 / 无障碍名 / 输入框占位符）。
 *
 * ⚠️ 这些**不能**放在 bindControls 里：那个函数有 `if (controlsBound) return` 的
 * 幂等守卫（防重复绑事件），只会执行一次。而 locale 变化走的是
 * onLocaleChange → setLocale + initPage，initPage 里的 bindControls 会直接返回，
 * 于是这批文案永远停在首次加载时的语言。由 setLocale 每次调用。
 */
function applyStaticLabels() {
  function setText(sel, text) {
    var el = document.querySelector(sel);
    if (el) el.textContent = text;
  }
  function setNames(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    el.title = text;
    el.setAttribute('aria-label', text);
  }
  setText('#toggle-import-btn .ph-btn-label', t('externalPlaylist'));
  setText('#load-playlist-btn .ph-btn-label', t('importBtn'));
  setNames('toggle-import-btn', t('externalPlaylist'));
  setNames('import-back-btn', t('backToSearch'));
  setNames('load-playlist-btn', t('loadPlaylist'));
  var search = document.getElementById('playlist-search');
  if (search) search.placeholder = t('searchPlaceholder');
  var pid = document.getElementById('playlist-id-input');
  if (pid) pid.placeholder = t('playlistIdPlaceholder');
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
  
  // 面板标题：必须在点击时取，不能在绑定时固化——
  // bindControls 只跑一次，写死中文会让 en-US / ja-JP 一直显示中文标题
  function panelTitleFor(tab) {
    if (tab === 'lyrics') return t('lyrics');
    if (tab === 'playlist') return t('playlist');
    return tab;
  }
  
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

  /** 关闭侧栏：歌词/列表都不选（封面+标题默认态） */
  function clearSidePanel() {
    tabBtns.forEach(function(b) {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    panels.forEach(function(p) { p.classList.remove('active'); });
    if (playerRight) {
      if (isMobile()) closeMobilePanel();
      playerRight.classList.remove('side-open');
    }
    pageState.preferredTab = 'none';
    if (Tapp.storage && Tapp.storage.set) {
      Tapp.storage.set('preferredTab', 'none').catch(function() {});
    }
    syncNoLyricsLayout();
  }

  // 统一 Tab：歌词 / 列表 / 都不选（再点当前 Tab 关闭）
  function handleTabClick(btn) {
    var tab = btn.getAttribute('data-tab');
    var wasActive = btn.classList.contains('active');
    var panelWasVisible = playerRight && (
      playerRight.classList.contains('mobile-visible') ||
      playerRight.classList.contains('side-open') ||
      !isMobile()
    );

    // 再点已选中的 Tab → 关闭，回到「都不选」
    if (wasActive) {
      if (isMobile() && playerRight && playerRight.classList.contains('mobile-visible')) {
        closeMobilePanel();
      }
      clearSidePanel();
      return;
    }

    // 选中新 Tab
    tabBtns.forEach(function(b) {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');

    panels.forEach(function(p) { p.classList.remove('active'); });
    var targetPanel = document.getElementById('panel-' + tab);
    if (targetPanel) targetPanel.classList.add('active');

    if (tab === 'lyrics' || tab === 'playlist') {
      pageState.preferredTab = tab;
      if (Tapp.storage && Tapp.storage.set) {
        Tapp.storage.set('preferredTab', tab).catch(function() {});
      }
    }

    // 歌词 Tab：先按有词开侧栏；仅「本曲已确认 empty」才不开
    var curId = pageState.status && pageState.status.currentTrack
      ? pageState.status.currentTrack.id : null;
    var confirmedEmpty = pageState.lyricsLoadState === 'empty' &&
      pageState.lyricsSongId != null && curId != null &&
      String(pageState.lyricsSongId) === String(curId);

    if (playerRight) {
      if (tab === 'lyrics' && confirmedEmpty) {
        playerRight.classList.remove('side-open');
      } else {
        playerRight.classList.add('side-open');
      }
    }

    if (isMobile() && playerRight) {
      if (tab === 'lyrics' && confirmedEmpty) {
        cancelPanelClose();
        playerRight.classList.remove('mobile-visible');
        playerRight.classList.remove('mobile-closing');
      } else {
        cancelPanelClose();
        playerRight.classList.add('mobile-visible');
        if (mobilePanelTitle) {
          mobilePanelTitle.textContent = panelTitleFor(tab);
        }
      }
    }

    // 打开歌词：先乐观有词；有最终结果再判 empty
    if (tab === 'lyrics') {
      if (!confirmedEmpty && pageState.lyricsLoadState !== 'ready') {
        setLyricsUiMode('loading');
      }
      revalidateLyricsContentMode({ fromTabOpen: true });
      // 打开后测一次 + settle 再测（forceLyricsPanelRelayout 内部处理）
      forceLyricsPanelRelayout();
    } else {
      syncNoLyricsLayout();
    }

    if (tab === 'playlist') {
      requestAnimationFrame(revealPlaylist);
    }
  }

  // 关闭面板处理函数
  function handleClosePanel() {
    clearSidePanel();
  }
  
  // 为按钮添加通用的点击绑定（兼容移动端和桌面端）
  // 关键：touchend 后浏览器会再合成 click → handler 跑两次。
  // 歌词 Tab 表现为「打开又立刻关闭」，Sheet 根本来不及滚。
  function addClickHandler(element, handler) {
    if (!element) return;

    var startX = 0;
    var startY = 0;
    var moved = false;
    var lastTouchEndAt = 0;

    element.addEventListener('touchstart', function(e) {
      var touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      moved = false;
    }, { passive: true });

    element.addEventListener('touchmove', function(e) {
      var touch = e.touches[0];
      var dx = Math.abs(touch.clientX - startX);
      var dy = Math.abs(touch.clientY - startY);
      if (dx > 10 || dy > 10) moved = true;
    }, { passive: true });

    element.addEventListener('touchend', function(e) {
      if (moved) return;
      e.preventDefault();
      lastTouchEndAt = Date.now();
      handler();
    }, { passive: false });

    element.addEventListener('click', function(e) {
      e.preventDefault();
      // 吞掉 touchend 后的幽灵 click（约 300ms 内）
      if (Date.now() - lastTouchEndAt < 500) return;
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

  // Fab：翻译开关
  Fab.bind($('lyric-trans-btn'), function() {
    setLyricTransOn(!pageState.transOn);
    if (Tapp.storage && Tapp.storage.set) {
      Tapp.storage.set('lyricTransOn', pageState.transOn).catch(function() {});
    }
  }, addClickHandler);

  // Fab：动效开关（桌面；移动端按钮隐藏且 visualFxEnabled 强制 off）
  Fab.bind($('visual-fx-btn'), function() {
    if (checkIsMobile()) return;
    setVisualFxOn(!pageState.visualFxOn);
    if (Tapp.storage && Tapp.storage.set) {
      Tapp.storage.set('visualFxOn', pageState.visualFxOn).catch(function() {});
    }
  }, addClickHandler);

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
      // 移动↔桌面：强制/恢复背景特效策略
      applyVisualFxViewportPolicy();
      // 全局移动端缓存会在 checkIsMobile 调用时自动更新
      if (!isMobile() && playerRight) {
        playerRight.classList.remove('mobile-visible');
        // 桌面：不强制恢复歌词 tab，保持「都不选」或当前选择
        syncNoLyricsLayout();
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

  // Fab：定位当前曲（列表）
  //
  // ⚠️ handleTabClick 是**切换**语义：Tab 已选中时再调一次会走 wasActive 分支
  // → clearSidePanel()，把整个侧栏关掉。这个 Fab 自 1.0.9 起就长在列表面板内部
  // （右下角浮动按钮），只有面板打开时才点得到，也就是 tab-playlist 必然带
  // .active —— 于是每次点击都必然命中关闭分支：列表被关掉，定位从未发生。
  // 原写法是 1.0.3 按钮还在面板外时留下的，位置一变语义就反了。
  Fab.bind($('jump-current-btn'), function() {
    var plTab = document.getElementById('tab-playlist');
    var alreadyOpen = !!(plTab && plTab.classList.contains('active'));
    // 只在列表没打开时才去开它；已经打开就别碰 Tab
    if (plTab && !alreadyOpen) handleTabClick(plTab);
    requestAnimationFrame(function() {
      // force：这个按钮就是用户明确要求定位，不该被 userScrolling 判定吞掉
      virtualList.userScrolling = false;
      if (alreadyOpen) {
        scrollPlaylistToCurrent({ force: true, smooth: true });
      } else {
        virtualList.pendingScrollToCurrent = true;
        if (typeof revealPlaylist === 'function') revealPlaylist();
        else if (typeof refreshPlaylistView === 'function') refreshPlaylistView();
      }
    });
  }, addClickHandler);

  // 键盘快捷键（输入框内不抢）
  document.addEventListener('keydown', function(e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) {
      return;
    }
    var key = e.key;
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      if (pageState.status && pageState.status.isPlaying) Tapp.media.pause();
      else Tapp.media.play();
    } else if (key === 'ArrowRight') {
      e.preventDefault();
      Tapp.media.next();
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      Tapp.media.prev();
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      var volUp = ((pageState.status && pageState.status.volume) || 70) + 5;
      if (volUp > 100) volUp = 100;
      // 宿主接受 0-100 或 0-1；与滑条一致传 0-100
      Tapp.media.setVolume(volUp);
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      var volDn = ((pageState.status && pageState.status.volume) || 70) - 5;
      if (volDn < 0) volDn = 0;
      Tapp.media.setVolume(volDn);
    } else if (key === 'l' || key === 'L') {
      var lt = document.getElementById('tab-lyrics');
      if (lt) handleTabClick(lt);
    } else if (key === 'p' || key === 'P') {
      var pt = document.getElementById('tab-playlist');
      if (pt) handleTabClick(pt);
    } else if (key === '[' || key === 'PageDown') {
      e.preventDefault();
      var pos = (pageState.status && (pageState.status.position || 0)) || 0;
      noteSeekIntent(Math.max(0, pos - 5));
      Tapp.media.seek(Math.max(0, pos - 5));
    } else if (key === ']' || key === 'PageUp') {
      e.preventDefault();
      var pos2 = (pageState.status && (pageState.status.position || 0)) || 0;
      var dur = 0;
      if (pageState.status && pageState.status.currentTrack) {
        dur = pageState.status.currentTrack.duration || 0;
      }
      var nextPos = pos2 + 5;
      if (dur > 0 && nextPos > dur) nextPos = dur;
      noteSeekIntent(nextPos);
      Tapp.media.seek(nextPos);
    }
  });

  // 移动端：歌词/列表面板左右滑切换
  if (playerRight) {
    var swipeX0 = 0, swipeY0 = 0, swipeArmed = false;
    playerRight.addEventListener('touchstart', function(e) {
      if (!e.touches || !e.touches[0]) return;
      swipeX0 = e.touches[0].clientX;
      swipeY0 = e.touches[0].clientY;
      swipeArmed = true;
    }, { passive: true });
    playerRight.addEventListener('touchend', function(e) {
      if (!swipeArmed || !e.changedTouches || !e.changedTouches[0]) return;
      swipeArmed = false;
      var dx = e.changedTouches[0].clientX - swipeX0;
      var dy = e.changedTouches[0].clientY - swipeY0;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      var cur = document.querySelector('.tab-btn.active');
      var curTab = cur ? cur.getAttribute('data-tab') : 'lyrics';
      if (dx < 0 && curTab === 'lyrics') {
        var toPl = document.getElementById('tab-playlist');
        if (toPl) handleTabClick(toPl);
      } else if (dx > 0 && curTab === 'playlist') {
        var toLy = document.getElementById('tab-lyrics');
        if (toLy) handleTabClick(toLy);
      }
    }, { passive: true });
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
        noteSeekIntent(pendingSeekValue);
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
        noteSeekIntent(value);
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
      noteSeekIntent(value);
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

  // 搜索（占位符文案由 setLocale → applyStaticLabels 统一维护）
  var searchInput = document.getElementById('playlist-search');
  if (searchInput) {
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

  // 加载网易云歌单
  var playlistIdInput = document.getElementById('playlist-id-input');
  var loadPlaylistBtn = document.getElementById('load-playlist-btn');
  var playlistIdHint = document.getElementById('playlist-id-hint');


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
// 窄视口 + 粗指针 才算「移动」：纯桌面窗口缩窄仍可开动效；
// Windows 触控本宽屏（>768）不当移动，避免误关 Aurora/涟漪。
var isMobileDevice = null;
var lastWindowWidth = 0;
var lastCoarsePtr = null;
function checkIsMobile() {
  var w = window.innerWidth;
  var coarse = false;
  try {
    coarse = !!(window.matchMedia &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  } catch (e) { /* ignore */ }
  if (w !== lastWindowWidth || coarse !== lastCoarsePtr) {
    lastWindowWidth = w;
    lastCoarsePtr = coarse;
    // 触控手机：窄；或明确粗指针且 ≤900（竖屏平板）
    isMobileDevice = w <= 768 || (coarse && w <= 900);
    // 与 CSS 同步：html.mp-is-mobile 覆盖 769–900 触控平板（纯 media 768 对不齐）
    try {
      document.documentElement.classList.toggle('mp-is-mobile', !!isMobileDevice);
    } catch (e2) { /* ignore */ }
  }
  return isMobileDevice;
}

/** 元素是否有可绘制布局（避免 offsetParent 在 transform/fixed 祖先下误判 null） */
function isLaidOut(el) {
  if (!el) return false;
  try {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  } catch (e) {
    return false;
  }
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

// 列表 EQ 高度写回去重：量化到整数 % 后仅在变化时写 style
var listEqLastEl = null;
var listEqLastQ = [-1, -1, -1];

// 用真实频谱驱动「列表当前播放项」的均衡器（3 根柱：低/中高/高，居中强调）
// 加 .live 类禁用 CSS keyframe，改由 JS 设高度
function updateListEq(spectrum, eq) {
  if (!eq) return false;
  var bars = eq.getElementsByTagName('span');
  if (bars.length < 3) return false;
  if (!eq.classList.contains('live')) eq.classList.add('live');
  if (eq !== listEqLastEl) {
    listEqLastEl = eq;
    listEqLastQ[0] = listEqLastQ[1] = listEqLastQ[2] = -1;
  }
  var v0 = spectrum[0] || 0;
  var v1 = Math.max(spectrum[1] || 0, spectrum[2] || 0);
  var v2 = spectrum[3] || 0;
  // 平方增强对比 + 25%~100% 区间，量化到整数 % 去重
  var h0 = (25 + v0 * v0 * 75 + 0.5) | 0;
  var h1 = (25 + v1 * v1 * 75 + 0.5) | 0;
  var h2 = (25 + v2 * v2 * 75 + 0.5) | 0;
  if (h0 !== listEqLastQ[0]) { listEqLastQ[0] = h0; bars[0].style.height = h0 + '%'; }
  if (h1 !== listEqLastQ[1]) { listEqLastQ[1] = h1; bars[1].style.height = h1 + '%'; }
  if (h2 !== listEqLastQ[2]) { listEqLastQ[2] = h2; bars[2].style.height = h2 + '%'; }
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
  // 调用方应已在 eqTickBody 用 visualFxEnabled 门控；此处双保险 + 隐藏检测
  if (!visualFxEnabled()) return;
  if (!aurora.el) {
    aurora.el = $('artwork-aurora');
    if (!aurora.el) return;
    aurora.blobs = aurora.el.getElementsByClassName('aurora-blob');
  }
  // 不用 offsetParent：Windows Chromium 在 transform 祖先下常为 null，导致 Aurora 永不绘制
  if (!isLaidOut(aurora.el) || !aurora.blobs || aurora.blobs.length < 3) return;
  if (document.documentElement.classList.contains('visual-fx-off')) return;

  var dt = Math.min(0.1, (ts - (aurora.lastT || ts)) / 1000);
  aurora.lastT = ts;
  var light = isAnimLight();
  // light：更慢公转，降低每帧感知成本
  var orbit = light ? 0.08 : (0.16 + rhythm.mood * 0.5);
  aurora.phase += dt * orbit;

  // 频段目标：低(0-1) / 中(3-4) / 高(5-7)
  // 频谱全 0（CORS / AudioContext 未接）时用相位呼吸底光，避免桌面「完全没动效」
  var b = aurora.bands;
  var hasAudio = false;
  if (b && b.length >= 8) {
    for (var hi = 0; hi < 8; hi++) {
      if (b[hi] > 0.02) { hasAudio = true; break; }
    }
  }
  var breath = 0.22 + 0.12 * Math.sin((ts || 0) * 0.0018);
  var targets = hasAudio
    ? [
        Math.min(1, (b[0] + b[1]) * 0.7),
        Math.min(1, (b[3] + b[4]) * 0.75),
        Math.min(1, (b[5] + b[6] + b[7]) * 0.55),
      ]
    : [breath, breath * 0.85, breath * 0.65];

  // 攻击/释放包络（经典 VU 手感：起得快、落得慢）
  // 释放随情绪：缓和 → 长余韵（光慢慢消散）；激烈 → 收得利落
  var aAtk = 1 - Math.exp(-dt / (light ? 0.09 : 0.055));
  var aRel = 1 - Math.exp(-dt / (light ? 0.55 : (0.5 - rhythm.mood * 0.28)));
  for (var i = 0; i < 3; i++) {
    var e = aurora.env[i];
    var tgt = targets[i];
    aurora.env[i] = e + (tgt - e) * (tgt > e ? aAtk : aRel);
  }

  // light：振幅缩小，写 transform 时量化更粗以减少合成层更新
  var amp = light ? 0.55 : 1;
  var scBase = light ? 0.95 : 0.9;
  var scGain = light ? 0.18 : 0.35;
  for (i = 0; i < 3; i++) {
    var el = aurora.blobs[i];
    var e2 = aurora.env[i];
    // 各光斑不同角速度/相位，避免同步感
    var ph = aurora.phase * (1 + i * 0.37) + i * 2.1;
    var ox = Math.cos(ph) * (4 + i * 2) * amp;
    var oy = Math.sin(ph * 0.8) * (3 + i * 2) * amp;
    var sc = scBase + e2 * scGain;
    if (light) {
      // 粗量化 transform 字符串，减少无感变化时的 style 写入
      el.style.transform = 'translate(' + (ox | 0) + '%,' + (oy | 0) + '%) scale(' +
        ((sc * 100 + 0.5) | 0) / 100 + ')';
    } else {
      el.style.transform = 'translate(' + ox.toFixed(1) + '%,' + oy.toFixed(1) + '%) scale(' + sc.toFixed(3) + ')';
    }
    // opacity 量化去重（公转 transform 每帧必写，opacity 只在包络变化时写）
    var op = Math.round((0.1 + e2 * (light ? 0.35 : 0.5)) * 1000);
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
  if (!visualFxEnabled()) return;
  // light 级别：跳过涟漪（高成本 class/回流），保留列表 EQ 与轻量 Aurora
  if (isAnimLight()) return;
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
  if (!bands || bands.length < 8 || !visualFxEnabled()) return;
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
    try { mpDebug('[music-player] shift! jumpRel=', jumpRel.toFixed(2), 'distRel=', distRel.toFixed(2)); } catch (e) {}
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
      try { mpDebug('[music-player] beat grid:', g.bpm, 'BPM,', g.beats.length, 'beats,', (g.accents || []).length, 'accents, conf', g.confidence.toFixed(2)); } catch (e) {}
    }
  }).catch(function() {
    // 失败撤销标记，下一次状态事件自动重试
    if (beatGrid.songId === track.id) beatGrid.songId = null;
  });
}

// 每帧网格跟拍（仅 FX 开时由 eqTick 调用；关 FX 时用 resyncBeatGridIdx 在重开时对齐）
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
    // 调用方已保证 visualFxEnabled；light 时 fireRipple 内部短路
    if (isAcc) {
      fireRipple(0.55 + rhythm.mood * 0.3 + Math.random() * 0.15, 'accent');
    } else {
      // 强度取当拍的真实低频能量：鼓点有轻有重，雨滴自然有大有小
      var hit = aurora.bands
        ? Math.min(1, (aurora.bands[0] + aurora.bands[1]) * 0.7)
        : 0.4;
      fireRipple(0.1 + hit * 0.6 + Math.random() * 0.12, 'beat');
    }
    i++;
  }
  beatGrid.idx = i;
}

// FX 重开 / seek 后对齐拍点索引，避免关 FX 期间未扫描导致连发补拍
function resyncBeatGridIdx() {
  var b = beatGrid.beats;
  if (!b || b.length === 0) return;
  var pos = getLyricPosition();
  var i = 0;
  while (i < b.length && b[i] < pos - 0.08) i++;
  beatGrid.idx = i;
}

// ---- eqTick 调度与频谱轮询 ----
// 帧率策略（播放中）：
//  - FX standard：rAF ~60fps（Aurora 包络 + grid 踩拍 + 背景漂移低频分支）
//  - FX light：~20fps（轻量 Aurora，无涟漪/无 bg drift）
//  - 仅列表 EQ：~15fps（频谱 + 间奏/自愈）
//  - 零消费方：~8fps 维护（间奏点 + lyric heal），绝不空转 60fps
var eqLastUpdate = 0;
var eqBgLastUpdate = 0;
var EQ_INTERVAL = 66;       // ~15fps 频谱/间奏数据块
var EQ_MAINT_MS = 125;      // ~8fps 零消费方维护
var EQ_LIGHT_MS = 50;       // ~20fps light 级 Aurora
var EQ_BG_MS = 50;          // 背景漂移 ~20fps（仅 standard + 非移动端）
// getSpectrum 单飞：上一次 bridge Promise 未 settle 时跳过本拍，不排队
var spectrumInFlight = false;
// 循环在飞（含 body 执行中 / timer 等待），防止 progress 回调 ensureEqLoop 双开
var eqLoopActive = false;

// 防崩溃壳：eqTick 驱动全部视觉效果（aurora/涟漪/网格踩拍/间奏点/自愈），
// 任何一帧异常若不捕获，循环静默死亡且句柄残留 → ensureEqLoop 永远无法重启 →
// 所有效果永久失效。异常只丢当帧并记录，循环必须活着。
function eqTick(ts) {
  // 本帧 rAF 已消费；eqLoopActive 保持 true 直至停播或 cancel，挡住 ensureEqLoop 竞态
  pageState.eqFrame = null;
  var isPlaying = pageState.status && pageState.status.isPlaying;
  if (!isPlaying) {
    cancelEqSchedule();
    syncFxCompositing();
    return;
  }
  try {
    eqTickBody(ts);
  } catch (e) {
    logTickError('eqTick', e);
  }
  scheduleEqNext();
}

// 取消 rAF / setTimeout 双通道调度
function cancelEqSchedule() {
  if (pageState.eqFrame != null) {
    cancelAnimationFrame(pageState.eqFrame);
    pageState.eqFrame = null;
  }
  if (pageState.eqTimer != null) {
    clearTimeout(pageState.eqTimer);
    pageState.eqTimer = null;
  }
  eqLoopActive = false;
}

// 按当前消费方选择下一帧调度方式
function scheduleEqNext() {
  if (!(pageState.status && pageState.status.isPlaying)) {
    eqLoopActive = false;
    return;
  }
  // 已有挂起的帧/定时器则不重复排（restartEqLoop 会先 cancel）
  if (pageState.eqFrame != null || pageState.eqTimer != null) return;

  eqLoopActive = true;
  var needFx = visualFxEnabled();
  // 用户正在手动滚歌词时把满帧 FX 降档：Aurora / 涟漪 / 背景漂移此刻不是用户
  // 在看的东西，却和歌词滚动抢同一块 GPU（两个各自满 60fps 的 rAF 循环）。
  // 停手后 lyricResumeTimer 到期自动恢复满帧。
  var throttleForScroll = lyricResumeTimer != null;
  if (needFx && !isAnimLight() && !throttleForScroll) {
    // standard FX：真 60fps rAF
    pageState.eqFrame = requestAnimationFrame(eqTick);
    return;
  }
  // light FX / 滚动降档 / 仅 EQ / 零消费：timer 节流，避免空 60fps
  var delay;
  if (needFx && (isAnimLight() || throttleForScroll)) {
    delay = EQ_LIGHT_MS;
  } else {
    var eq = getActiveEqEl();
    var needEq = !!(eq && isLaidOut(eq));
    delay = needEq ? EQ_INTERVAL : EQ_MAINT_MS;
  }
  pageState.eqTimer = setTimeout(function() {
    pageState.eqTimer = null;
    pageState.eqFrame = requestAnimationFrame(eqTick);
  }, delay);
}

function eqTickBody(ts) {
  // 尽早解析 FX 门控，避免关 FX 时仍跑 grid/aurora/涟漪路径
  var needFx = visualFxEnabled();
  var light = needFx && isAnimLight();

  // 数据块：频谱 / 间奏 / 自愈（~15fps；维护模式由外层 timer 控制调用频率）
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
    // 无布局（display:none 等）跳过列表 EQ；不用 offsetParent（Windows 易误判）
    // needEq 与动效开关无关（列表 EQ 始终可驱动）；Aurora/节奏频谱仅在 FX 开时需要
    var eq = getActiveEqEl();
    var needEq = !!(eq && isLaidOut(eq));
    // 单飞：上一次 getSpectrum 未 settle 则跳过本拍（不排队堆积）
    if ((needEq || needFx) && !spectrumInFlight) {
      spectrumInFlight = true;
      var pollNeedEq = needEq;
      var pollNeedFx = needFx;
      var pollEq = eq;
      var pollTs = ts;
      Tapp.media.getSpectrum().then(function(r) {
        spectrumInFlight = false;
        var s = (r && r.spectrum && r.spectrum.length >= 4) ? r.spectrum : [0, 0, 0, 0];
        if (pollNeedEq) updateListEq(s, pollEq);
        // FX 可能在 Promise 飞行期间被关掉
        if (pollNeedFx && visualFxEnabled()) {
          // Aurora 数据样本：优先原始 8 频段；旧前端无 bands 时由 4 柱数据降级映射
          if (r && r.bands && r.bands.length >= 8) {
            aurora.bands = r.bands;
          } else {
            // 降级：s 为重排 4 柱（低-高-高-低），粗略映射三段
            aurora.bands = [s[0], s[0], 0, s[2], s[2], s[1], s[3], 0];
          }
          // light：无涟漪/grid，mood 不驱动 Aurora → 跳过节奏引擎
          if (!isAnimLight()) {
            rhythmTick(aurora.bands, pollTs);
          }
        }
      }).catch(function(e) {
        spectrumInFlight = false;
        logTickError('spectrumPoll', e);
      });
    }
  }

  // ---- 仅 FX 开：网格踩拍 / Aurora / 背景漂移 ----
  if (!needFx) return;

  // light：无涟漪网格触发（fireRipple 也会短路）；跳过 grid 扫描以省 pos 计算
  if (!light) {
    gridTick();
  }

  // Aurora：standard 每帧；light 随 ~20fps 调度
  renderAurora(ts);

  // 背景漂移：并入 eqTick 低频分支（无独立 rAF）；mobile / light / 开关关闭时不跑
  if (pageState.bgDriftOn && !light && !checkIsMobile()) {
    if (ts - eqBgLastUpdate >= EQ_BG_MS) {
      eqBgLastUpdate = ts;
      pageState.bgPhase += 0.008;
      applyBackgroundTransform(pageState.bgPhase);
    }
  }
}

function ensureEqLoop() {
  if (!(pageState.status && pageState.status.isPlaying)) return;
  if (eqLoopActive || pageState.eqFrame != null || pageState.eqTimer != null) return;
  eqLoopActive = true;
  pageState.eqFrame = requestAnimationFrame(eqTick);
}

// 强制取消并重入（FX 开关 / anim level 变化时切换帧率策略）
function restartEqLoop() {
  cancelEqSchedule();
  ensureEqLoop();
}

// 启动背景漂移意图（实际相位推进在 eqTick 低频分支）
function startBackgroundAnimation() {
  // 用户动效开关 ∧ 系统动画 ∧ 非 light ∧ 非移动端
  if (!visualFxEnabled() || isAnimLight() || checkIsMobile()) {
    pageState.bgDriftOn = false;
    return;
  }
  pageState.bgDriftOn = true;
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

// 停止背景漂移意图并复位变换
function stopBackgroundAnimation() {
  pageState.bgDriftOn = false;
  // 重置背景变换
  var bgArtwork = $('bg-artwork');
  if (bgArtwork) {
    bgArtwork.style.transform = 'scale(1.1)';
  }
}

// 清理
function cleanup() {
  if (pageState.statusBannerTimer) {
    clearTimeout(pageState.statusBannerTimer);
    pageState.statusBannerTimer = null;
  }
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
  // 清理视觉/EQ 循环（rAF + 低帧率 timer）
  cancelEqSchedule();
  spectrumInFlight = false;
  // 清理歌词波浪引擎
  stopLyricWave();
  if (lyricResumeTimer) {
    clearTimeout(lyricResumeTimer);
    lyricResumeTimer = null;
  }
  if (lyricDeblurTimer) {
    clearTimeout(lyricDeblurTimer);
    lyricDeblurTimer = null;
  }
  if (lyricPremeasureTimer) {
    clearTimeout(lyricPremeasureTimer);
    lyricPremeasureTimer = null;
  }
  // 歌词布局的延迟重测 / 容器观察者（原先只活在闭包里，销毁后仍会触发）
  if (lyricFx.remeasureRaf) {
    cancelAnimationFrame(lyricFx.remeasureRaf);
    lyricFx.remeasureRaf = null;
  }
  if (lyricFx.remeasureTimer) {
    clearTimeout(lyricFx.remeasureTimer);
    lyricFx.remeasureTimer = null;
  }
  if (lyricFx.roTimer) {
    clearTimeout(lyricFx.roTimer);
    lyricFx.roTimer = null;
  }
  if (lyricFx.ro) {
    try { lyricFx.ro.disconnect(); } catch (e) { /* ignore */ }
    lyricFx.ro = null;
  }
  var lc = $('lyrics-container');
  if (lc) lc._lyricRoBound = false; // 允许重新挂载时再绑
  // 跑马灯重测 / 播放列表手势判定的挂起定时器
  if (syncNoLyricsLayout._marqueeTimer) {
    clearTimeout(syncNoLyricsLayout._marqueeTimer);
    syncNoLyricsLayout._marqueeTimer = null;
  }
  if (virtualList.userScrollTimer) {
    clearTimeout(virtualList.userScrollTimer);
    virtualList.userScrollTimer = null;
    virtualList.userScrolling = false;
  }
  seekIntent = null;
  // 清理背景漂移意图
  stopBackgroundAnimation();
  document.documentElement.classList.remove('fx-compositing');
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

        // 同步动效按钮文案/高亮；移动端再强制 visual-fx-off
        syncVisualFxUI();
        applyVisualFxViewportPolicy();

        // 恢复翻译 / 动效开关偏好（持久化；storage 权限已在 manifest 声明）
        // 桌面可读 storage；移动端偏好仍保存，但运行时 FX 强制关
        if (Tapp.storage && Tapp.storage.get) {
          Tapp.storage.get('lyricTransOn').then(function(v) {
            if (v === true || v === 'true') setLyricTransOn(true);
          }).catch(function() {});
          Tapp.storage.get('visualFxOn').then(function(v) {
            // 默认 true；仅显式 false 时关闭（移动端仍只更新偏好，不启 FX）
            if (v === false || v === 'false') setVisualFxOn(false);
            else applyVisualFxViewportPolicy();
          }).catch(function() {});
          Tapp.storage.get('preferredTab').then(function(v) {
            // 仅记忆偏好，默认不自动打开侧栏（保持「都不选」封面态）
            if (v === 'playlist' || v === 'lyrics' || v === 'none') {
              pageState.preferredTab = v;
            }
          }).catch(function() {});
        }

        // 监听语言变化
        Tapp.ui.onLocaleChange(function(locale) {
          setLocale(normalizeLocale(locale));
          initPage();
          syncVisualFxUI();
          syncLyricTransUI();
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
