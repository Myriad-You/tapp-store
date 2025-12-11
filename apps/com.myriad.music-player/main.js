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
    previous: '上一首',
    next: '下一首',
    volume: '音量',
    mute: '静音',
    unmute: '取消静音',
    shuffle: '随机播放',
    repeat: '列表循环',
    repeatOne: '单曲循环',
    normal: '顺序播放',
    playlist: '播放列表',
    lyrics: '歌词',
    noLyrics: '暂无歌词',
    lyricsLoading: '歌词加载中...',
    searchPlaceholder: '搜索歌曲...',
    songs: '首歌曲',
    currentlyPlaying: '正在播放',
    vip: 'VIP',
    trial: '试听',
    playlistIdPlaceholder: '网易云歌单ID',
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
    previous: 'Previous',
    next: 'Next',
    volume: 'Volume',
    mute: 'Mute',
    unmute: 'Unmute',
    shuffle: 'Shuffle',
    repeat: 'Repeat All',
    repeatOne: 'Repeat One',
    normal: 'Normal',
    playlist: 'Playlist',
    lyrics: 'Lyrics',
    noLyrics: 'No Lyrics',
    lyricsLoading: 'Loading lyrics...',
    searchPlaceholder: 'Search songs...',
    songs: 'songs',
    currentlyPlaying: 'Now Playing',
    vip: 'VIP',
    trial: 'Trial',
    playlistIdPlaceholder: 'Netease Playlist ID',
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
    previous: '前へ',
    next: '次へ',
    volume: '音量',
    mute: 'ミュート',
    unmute: 'ミュート解除',
    shuffle: 'シャッフル',
    repeat: 'リピート',
    repeatOne: '1曲リピート',
    normal: '通常',
    playlist: 'プレイリスト',
    lyrics: '歌詞',
    noLyrics: '歌詞なし',
    lyricsLoading: '歌詞読み込み中...',
    searchPlaceholder: '曲を検索...',
    songs: '曲',
    currentlyPlaying: '再生中',
    vip: 'VIP',
    trial: '試聴',
    playlistIdPlaceholder: 'Netease歌単ID',
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
  ['--text-tertiary', 'rgba(235, 235, 245, 0.3)']
];
var THEME_LIGHT = [
  ['--glass-bg', 'rgba(255, 255, 255, 0.72)'],
  ['--glass-border', 'rgba(255, 255, 255, 0.18)'],
  ['--glass-shadow', '0 8px 32px rgba(0, 0, 0, 0.12)'],
  ['--text-primary', '#1d1d1f'],
  ['--text-secondary', 'rgba(60, 60, 67, 0.6)'],
  ['--text-tertiary', 'rgba(60, 60, 67, 0.3)']
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

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

function throttle(fn, limit) {
  var lastCall = 0;
  return function() {
    var now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn.apply(this, arguments);
    }
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

// 获取调度延迟
async function getScheduledDelay(index, baseDelay) {
  if (!pageState.animConfig.shouldAnimate) {
    return 0;
  }
  try {
    return await Tapp.animation.getStaggerDelay(index, baseDelay || 50);
  } catch (e) {
    // 回退到本地计算
    var delay = baseDelay || 50;
    if (pageState.animConfig.level === 'light') delay *= 0.5;
    return index * delay * pageState.animConfig.durationScale;
  }
}

// 获取缩放后的动画时长
function getScaledDuration(baseDuration) {
  if (!pageState.animConfig.shouldAnimate) {
    return 0;
  }
  return baseDuration * pageState.animConfig.durationScale;
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
  searchQuery: '',
  isSearching: false,
  autoScrollEnabled: true, // 自动滚动开关（点击歌词跳转时临时禁用）
  unsubscribe: null,
  animationFrame: null,
  // 背景动画状态
  bgAnimationFrame: null,
  energyHistory: [],
  lastBeatTime: 0,
  beatIntensity: 0,
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

function clearDomCache() {
  domCache = {};
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

// 渲染歌词 - 高性能版本
function renderLyrics(lyrics, currentIndex) {
  var container = $('lyrics-container');
  if (!container) return;

  if (!lyrics || lyrics.length === 0) {
    container.innerHTML = '<div class="lyrics-empty">' + t('noLyrics') + '</div>';
    return;
  }

  var prevIndex = pageState.currentLyricIndex;
  var isIndexChange = prevIndex !== currentIndex && prevIndex >= 0 && currentIndex >= 0;

  // 检查是否需要重新渲染整个列表
  var existingLines = container.querySelectorAll('.lyric-line');
  var needsFullRender = existingLines.length !== lyrics.length;

  if (needsFullRender) {
    // 使用 DocumentFragment 批量渲染，减少重排
    var fragment = document.createDocumentFragment();
    
    for (var i = 0; i < lyrics.length; i++) {
      var line = lyrics[i];
      var el = document.createElement('div');
      el.className = getLyricLineClasses(i, currentIndex);
      el.setAttribute('data-index', i);
      el.setAttribute('data-time', line.time || 0);
      el.textContent = line.text || '';
      fragment.appendChild(el);
    }
    
    container.innerHTML = '';
    container.appendChild(fragment);
    
    // 绑定点击事件 - 使用事件委托
    bindLyricClickEvents(container);
  } else {
    // 增量更新 - 只更新变化的元素
    var updateRange = Math.min(5, lyrics.length); // 只更新当前索引附近的元素
    var startIdx = Math.max(0, currentIndex - updateRange);
    var endIdx = Math.min(lyrics.length, currentIndex + updateRange + 1);
    
    // 如果之前的索引不在范围内，也需要更新
    if (prevIndex >= 0 && (prevIndex < startIdx || prevIndex >= endIdx)) {
      var prevEl = existingLines[prevIndex];
      if (prevEl) {
        prevEl.className = getLyricLineClasses(prevIndex, currentIndex);
      }
    }
    
    for (var i = startIdx; i < endIdx; i++) {
      var el = existingLines[i];
      if (!el) continue;
      
      var newClassName = getLyricLineClasses(i, currentIndex);
      
      // 只在类名实际变化时更新
      if (el.className !== newClassName) {
        // 处理进入/离开动画（根据调度器配置）
        if (isIndexChange && shouldAnimate()) {
          // 使用缩放后的动画时长
          var enterDuration = getScaledDuration(600);
          var leaveDuration = getScaledDuration(500);
          
          if (i === currentIndex && i !== prevIndex) {
            el.classList.add('entering');
            if (enterDuration > 0) {
              setTimeout(function() { el.classList.remove('entering'); }, enterDuration);
            } else {
              el.classList.remove('entering');
            }
          } else if (i === prevIndex) {
            el.classList.add('leaving');
            if (leaveDuration > 0) {
              setTimeout(function() { el.classList.remove('leaving'); }, leaveDuration);
            } else {
              el.classList.remove('leaving');
            }
          }
        }
        
        el.className = newClassName;
      }
    }
  }

  // 使用 requestAnimationFrame 优化滚动
  if (pageState.autoScrollEnabled && currentIndex >= 0) {
    requestAnimationFrame(function() {
      var activeLine = container.querySelector('.lyric-line.active');
      if (activeLine) {
        var containerHeight = container.clientHeight;
        var lineTop = activeLine.offsetTop;
        var lineHeight = activeLine.clientHeight;
        var scrollTop = lineTop - (containerHeight / 2) + (lineHeight / 2);
        
        // 根据动画配置决定滚动行为
        if (shouldAnimate()) {
          container.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: 'smooth'
          });
        } else {
          // 无动画模式：直接跳转
          container.scrollTop = Math.max(0, scrollTop);
        }
      }
    });
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
      // 临时禁用自动滚动，避免跳转后立即被滚动覆盖
      pageState.autoScrollEnabled = false;
      setTimeout(function() {
        pageState.autoScrollEnabled = true;
      }, 1000);
    }
  }
}

// ========================================
// 虚拟滚动播放列表
// ========================================

var virtualList = {
  container: null,
  scrollContainer: null,
  innerWrapper: null,
  contentWrapper: null,
  itemHeight: 56, // 每项高度
  bufferSize: 5,  // 上下缓冲区大小
  visibleStart: 0,
  visibleEnd: 0,
  data: [],
  currentTrackId: null,
  searchQuery: '',
  scrollHandler: null,
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
    
    // 绑定点击事件（事件委托，只绑定一次）
    virtualList.container.onclick = function(e) {
      var item = e.target.closest('.playlist-item');
      if (item) {
        var index = parseInt(item.getAttribute('data-index'), 10);
        Tapp.media.jumpToIndex(index);
      }
    };
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

// 从对象池获取或创建DOM元素
function getPooledItem() {
  if (virtualList.itemPool.length > 0) {
    return virtualList.itemPool.pop();
  }
  
  var el = document.createElement('div');
  el.className = 'playlist-item';
  el.innerHTML = '<div class="playlist-item-cover"></div>' +
                 '<div class="playlist-item-info">' +
                   '<div class="playlist-item-name"></div>' +
                   '<div class="playlist-item-artist"></div>' +
                 '</div>';
  return el;
}

// 更新DOM元素内容
function updateItemContent(el, song, isActive) {
  var cover = el.firstChild;
  var info = el.lastChild;
  var nameEl = info.firstChild;
  var artistEl = info.lastChild;
  
  // 只在内容变化时更新
  if (el.getAttribute('data-id') !== song.id) {
    el.setAttribute('data-id', song.id);
    el.setAttribute('data-index', song.originalIndex);
    
    // 更新封面
    if (song.cover) {
      if (cover.tagName !== 'IMG') {
        var img = document.createElement('img');
        img.className = 'playlist-item-cover';
        img.loading = 'lazy';
        img.alt = '';
        el.replaceChild(img, cover);
        cover = img;
      }
      if (cover.src !== song.cover) {
        cover.src = song.cover;
      }
    } else {
      if (cover.tagName === 'IMG') {
        var div = document.createElement('div');
        div.className = 'playlist-item-cover';
        el.replaceChild(div, cover);
      }
    }
    
    nameEl.textContent = song.name || '';
    artistEl.textContent = song.artist || '';
  }
  
  // 更新激活状态
  if (isActive && !el.classList.contains('active')) {
    el.classList.add('active');
  } else if (!isActive && el.classList.contains('active')) {
    el.classList.remove('active');
  }
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
  
  virtualList.isRendering = false;
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

  // 小列表直接渲染，大列表使用虚拟滚动
  if (filteredList.length <= 50) {
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
    
    if (song.cover) {
      var img = document.createElement('img');
      img.className = 'playlist-item-cover';
      img.src = song.cover;
      img.loading = 'lazy';
      img.alt = '';
      el.appendChild(img);
    } else {
      var coverDiv = document.createElement('div');
      coverDiv.className = 'playlist-item-cover';
      el.appendChild(coverDiv);
    }
    
    var info = document.createElement('div');
    info.className = 'playlist-item-info';
    
    var nameEl = document.createElement('div');
    nameEl.className = 'playlist-item-name';
    nameEl.textContent = song.name || '';
    info.appendChild(nameEl);
    
    var artistEl = document.createElement('div');
    artistEl.className = 'playlist-item-artist';
    artistEl.textContent = song.artist || '';
    info.appendChild(artistEl);
    
    el.appendChild(info);
    fragment.appendChild(el);
  }
  
  container.innerHTML = '';
  container.appendChild(fragment);

  // 使用事件委托（只绑定一次）
  container.onclick = function(e) {
    var item = e.target.closest('.playlist-item');
    if (item) {
      var index = parseInt(item.getAttribute('data-index'), 10);
      Tapp.media.jumpToIndex(index);
    }
  };

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
  
  // 动态背景 - 使用封面作为模糊背景
  var bgArtwork = $('bg-artwork');
  if (bgArtwork && track && track.cover) {
    bgArtwork.style.backgroundImage = 'url(' + track.cover + ')';
  }
  
  // 同步音乐播放器的完整动态颜色 - 只在颜色变化时更新
  var root = document.documentElement;
  if (status.primaryColor && status.primaryColor !== lastColors.primary) {
    var primary = status.primaryColor;
    lastColors.primary = primary;
    root.style.setProperty('--music-primary', primary);
    root.style.setProperty('--accent-color', primary);
    root.style.setProperty('--accent-light', primary + '26');
    root.style.setProperty('--accent-glow', primary + '66');
  }
  if (status.secondaryColor && status.secondaryColor !== lastColors.secondary) {
    lastColors.secondary = status.secondaryColor;
    root.style.setProperty('--music-secondary', status.secondaryColor);
  }
  if (status.accentColor && status.accentColor !== lastColors.accent) {
    lastColors.accent = status.accentColor;
    root.style.setProperty('--music-accent', status.accentColor);
  }
  if (status.lightColor && status.lightColor !== lastColors.light) {
    lastColors.light = status.lightColor;
    root.style.setProperty('--music-light', status.lightColor);
  }
  if (status.darkColor && status.darkColor !== lastColors.dark) {
    lastColors.dark = status.darkColor;
    root.style.setProperty('--music-dark', status.darkColor);
  }
  
  // 封面
  var coverEl = $('album-cover');
  var coverPlaceholder = $('cover-placeholder');
  if (coverEl && coverPlaceholder) {
    if (track && track.cover) {
      coverEl.src = track.cover;
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
  if (nameEl) nameEl.textContent = track ? track.name : t('noPlaying');
  if (artistEl) artistEl.textContent = track ? track.artist : '-';

  // VIP 标签
  var vipEl = $('vip-badge');
  if (vipEl) {
    if (track && track.isVip) {
      vipEl.textContent = t('vip');
      vipEl.className = 'badge-vip';
      vipEl.style.display = 'inline-block';
    } else if (track && track.vipType === 'trial') {
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
  isPlaying: null,
  position: -1,
  volume: -1,
  mode: null
};

// 检查状态是否有关键变化
function hasSignificantChange(state) {
  var trackId = state.currentTrack ? state.currentTrack.id : null;
  var position = state.position || (state.progress ? state.progress.current : 0) || 0;
  
  // 歌曲切换、播放状态变化、模式变化是关键变化
  if (trackId !== lastStateSnapshot.trackId ||
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

  // 并行获取所有初始数据（减少初始化时间）
  var results = await Promise.allSettled([
    Tapp.media.getStatus(),
    Tapp.media.getPlaylist()
  ]);
  
  // 处理媒体状态
  if (results[0].status === 'fulfilled') {
    var status = results[0].value || {};
    
    // 规范化字段名: API 返回 title，我们需要 name
    if (status.currentTrack) {
      status.currentTrack.name = status.currentTrack.title || status.currentTrack.name;
    }
    // 规范化进度: API 返回 progress.current，我们需要 position
    if (status.progress) {
      status.position = status.progress.current || 0;
    }
    
    pageState.status = status;
    updatePlayerUI(status);

    // 获取歌词（歌词在 status.lyrics 中）
    if (status.lyrics && status.lyrics.length > 0) {
      pageState.lyrics = status.lyrics;
      pageState.currentLyricIndex = status.currentLyricIndex || -1;
      renderLyrics(status.lyrics, status.currentLyricIndex || -1);
    }
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
        vipType: song.vipType || null,
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
  pageState.unsubscribe = Tapp.media.onStateChange(function(state) {
    // 检查是否有关键变化
    var significantChange = hasSignificantChange(state);
    
    // 规范化状态
    if (state.currentTrack) {
      state.currentTrack.name = state.currentTrack.title || state.currentTrack.name;
    }
    // 处理进度信息
    if (state.progress) {
      state.position = state.progress.current || 0;
    }
    
    pageState.status = state;
    
    // 只在关键变化时更新完整UI
    if (significantChange) {
      updateStateSnapshot(state);
      updatePlayerUI(state);
    } else {
      // 非关键变化只更新进度相关
      updateProgressOnly(state);
    }

    // 更新歌词 - 歌词数据在 state.lyrics 中
    var lyrics = state.lyrics || [];
    // 使用本地计算的歌词索引（带提前量补偿），而不是服务端的索引
    var position = state.position || (state.progress ? state.progress.current : 0) || 0;
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
    } else if (pageState.lyrics && pageState.lyrics.length > 0) {
      // 歌词清空了
      pageState.lyrics = [];
      pageState.currentLyricIndex = -1;
      renderLyrics([], -1);
    }

    // 更新播放列表高亮 - 使用虚拟列表的索引
    if (state.currentTrack) {
      var currentId = state.currentTrack.id;
      // 如果使用虚拟列表，直接更新其跟踪的ID
      if (virtualList.data.length > 50 && virtualList.contentWrapper) {
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
  });

  // 绑定控制按钮
  bindControls();
  
  // 页面可见性优化 - 不可见时暂停非关键动画
  document.addEventListener('visibilitychange', function() {
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
function bindControls() {
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
  
  // 🎯 WebKit 兼容性：统一的 Tab 按钮点击处理函数
  function handleTabClick(btn, e) {
    // 阻止事件冒泡和默认行为
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    var tab = btn.getAttribute('data-tab');
    var wasActive = btn.classList.contains('active');
    
    // 更新 tab 按钮状态
    tabBtns.forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    
    // 切换面板 - 使用缓存的panels
    panels.forEach(function(p) { p.classList.remove('active'); });
    var targetPanel = document.getElementById('panel-' + tab);
    if (targetPanel) targetPanel.classList.add('active');
    
    // 移动端：显示面板或切换
    if (isMobile() && playerRight) {
      if (wasActive && playerRight.classList.contains('mobile-visible')) {
        // 再次点击同一个按钮，关闭面板
        playerRight.classList.remove('mobile-visible');
        btn.classList.remove('active');
      } else {
        // 显示面板
        playerRight.classList.add('mobile-visible');
        // 更新面板标题
        if (mobilePanelTitle) {
          mobilePanelTitle.textContent = panelTitles[tab] || tab;
        }
      }
    }
  }
  
  tabBtns.forEach(function(btn) {
    // 🎯 WebKit 兼容性：同时绑定 click 和 touchend 事件
    // 使用标志位防止重复触发
    var touchHandled = false;
    
    btn.addEventListener('touchend', function(e) {
      touchHandled = true;
      handleTabClick(btn, e);
      // 重置标志位
      setTimeout(function() { touchHandled = false; }, 300);
    }, { passive: false });
    
    btn.addEventListener('click', function(e) {
      // 如果已经由 touchend 处理，跳过
      if (touchHandled) {
        touchHandled = false;
        return;
      }
      handleTabClick(btn, e);
    });
  });
  
  // 移动端关闭按钮
  if (mobileCloseBtn && playerRight) {
    // 🎯 WebKit 兼容性：关闭按钮点击处理
    function handleCloseClick(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      playerRight.classList.remove('mobile-visible');
      // 取消所有tab按钮的active状态
      tabBtns.forEach(function(b) { b.classList.remove('active'); });
    }
    
    var closeTouchHandled = false;
    
    mobileCloseBtn.addEventListener('touchend', function(e) {
      closeTouchHandled = true;
      handleCloseClick(e);
      setTimeout(function() { closeTouchHandled = false; }, 300);
    }, { passive: false });
    
    mobileCloseBtn.addEventListener('click', function(e) {
      if (closeTouchHandled) {
        closeTouchHandled = false;
        return;
      }
      handleCloseClick(e);
    });
  }
  
  // 窗口大小变化时重置状态 - 使用节流（统一处理所有 resize 逻辑）
  var resizeTimeout = null;
  window.addEventListener('resize', function() {
    if (resizeTimeout) return;
    resizeTimeout = setTimeout(function() {
      resizeTimeout = null;
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

  // 搜索
  var searchInput = document.getElementById('playlist-search');
  if (searchInput) {
    searchInput.placeholder = t('searchPlaceholder');
    var debouncedSearch = debounce(function(query) {
      pageState.searchQuery = query;
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
        pageState.searchQuery = '';
        renderPlaylist(pageState.playlist, pageState.status?.currentTrack, '');
      }
    });
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
                vipType: song.vipType || null,
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

// 节奏检测参数
var BG_ENERGY_HISTORY_SIZE = 8;
var BG_BEAT_THRESHOLD = 1.3;
var BG_BEAT_COOLDOWN = 150;

// 能量历史环形缓冲区 - 避免数组shift操作
var energyBuffer = {
  data: new Array(BG_ENERGY_HISTORY_SIZE).fill(0),
  index: 0,
  sum: 0,
  count: 0
};

function addEnergyValue(value) {
  // 从总和中减去旧值
  energyBuffer.sum -= energyBuffer.data[energyBuffer.index];
  // 添加新值
  energyBuffer.data[energyBuffer.index] = value;
  energyBuffer.sum += value;
  // 移动索引
  energyBuffer.index = (energyBuffer.index + 1) % BG_ENERGY_HISTORY_SIZE;
  if (energyBuffer.count < BG_ENERGY_HISTORY_SIZE) {
    energyBuffer.count++;
  }
}

function getAverageEnergy() {
  return energyBuffer.count > 0 ? energyBuffer.sum / energyBuffer.count : 0;
}

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

// 启动背景动画
function startBackgroundAnimation() {
  // 检查动画级别
  if (!shouldAnimate()) {
    return;
  }
  
  // 移动端禁用背景旋律动画（节省性能）
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
      // 暂停时缓慢重置动画
      pageState.beatIntensity *= 0.95;
      if (pageState.beatIntensity < 0.01) {
        pageState.beatIntensity = 0;
        applyBackgroundTransform(0, 0, pageState.bgPhase);
        pageState.bgAnimationFrame = null;
        return;
      }
      applyBackgroundTransform(pageState.beatIntensity, 0, pageState.bgPhase);
      pageState.bgAnimationFrame = requestAnimationFrame(updateBackground);
      return;
    }
    
    if (timestamp - lastUpdateTime >= UPDATE_INTERVAL) {
      lastUpdateTime = timestamp;
      pageState.bgPhase += 0.008; // 缓慢相位变化
      
      // 请求频谱数据
      Tapp.media.getSpectrum().then(function(spectrum) {
        if (!spectrum || spectrum.length < 4) {
          spectrum = [0, 0, 0, 0];
        }
        
        // 计算当前能量
        var currentEnergy = (spectrum[0] + spectrum[1] + spectrum[2] + spectrum[3]) * 0.25;
        
        // 使用环形缓冲区维护能量历史
        addEnergyValue(currentEnergy);
        var avgEnergy = getAverageEnergy();
        
        // 节拍检测
        var isBeat = currentEnergy > avgEnergy * BG_BEAT_THRESHOLD && 
                     currentEnergy > 0.15 && 
                     (timestamp - pageState.lastBeatTime) > BG_BEAT_COOLDOWN;
        
        if (isBeat) {
          pageState.lastBeatTime = timestamp;
          pageState.beatIntensity = Math.min(1, pageState.beatIntensity + 0.4);
        } else {
          pageState.beatIntensity *= 0.92;
        }
        
        // 应用背景变换
        applyBackgroundTransform(pageState.beatIntensity, currentEnergy, pageState.bgPhase);
      }).catch(function() {
        // 如果获取频谱失败，使用默认动画
        pageState.bgPhase += 0.005;
        applyBackgroundTransform(0.1, 0.1, pageState.bgPhase);
      });
    }
    
    pageState.bgAnimationFrame = requestAnimationFrame(updateBackground);
  }
  
  pageState.bgAnimationFrame = requestAnimationFrame(updateBackground);
}

// 应用背景变换 - 使用缓存的元素引用
var cachedBgArtworkRef = null;

function applyBackgroundTransform(beatIntensity, energy, phase) {
  if (!cachedBgArtworkRef) cachedBgArtworkRef = $('bg-artwork');
  if (!cachedBgArtworkRef) return;
  
  // 根据节拍强度计算缩放 (1.1 ~ 1.25)
  var scale = 1.1 + beatIntensity * 0.15;
  
  // 根据相位计算缓慢位移 (柔和的漂浮效果)
  // 预计算sin/cos值减少重复调用
  var sinPhase = Math.sin(phase);
  var cosPhase = Math.cos(phase * 0.7);
  var translateX = sinPhase * 15 + beatIntensity * Math.sin(phase * 3) * 10;
  var translateY = cosPhase * 15 + beatIntensity * Math.cos(phase * 2.5) * 10;
  
  // 根据能量和相位计算微小旋转 (-3deg ~ 3deg)
  var rotate = Math.sin(phase * 0.5) * 2 + beatIntensity * Math.sin(phase * 2);
  
  // 应用变换 - 使用位运算快速取整避免toFixed开销
  cachedBgArtworkRef.style.transform = 
    'scale(' + ((scale * 1000 | 0) / 1000) + ') ' +
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
  if (pageState.animationFrame) {
    cancelAnimationFrame(pageState.animationFrame);
    pageState.animationFrame = null;
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
