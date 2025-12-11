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
  },
};

var currentLocale = 'zh-CN';

function normalizeLocale(locale) {
  if (!locale) return 'zh-CN';
  var l = locale.toLowerCase();
  if (l.startsWith('zh')) return 'zh-CN';
  if (l.startsWith('ja')) return 'ja-JP';
  return 'en-US';
}

function t(key) {
  return (i18n[currentLocale] || i18n['zh-CN'])[key] || key;
}

// ========================================
// 工具函数
// ========================================

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  var mins = Math.floor(seconds / 60);
  var secs = Math.floor(seconds % 60);
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
  settings: {
    showLyrics: true,
    autoScroll: true,
    showSpectrum: true,
  },
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
  if (pageState.settings.autoScroll && currentIndex >= 0) {
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

// 获取歌词行的类名
function getLyricLineClasses(index, currentIndex) {
  var classes = ['lyric-line'];
  var distance = currentIndex >= 0 ? Math.abs(index - currentIndex) : 999;
  
  if (index === currentIndex) {
    classes.push('active');
  } else if (currentIndex >= 0 && index < currentIndex) {
    classes.push('passed');
  }
  
  // 距离渐变效果
  if (distance === 1) classes.push('near-1');
  else if (distance === 2) classes.push('near-2');
  else if (distance === 3) classes.push('near-3');
  
  return classes.join(' ');
}

// 绑定歌词点击事件 - 事件委托
function bindLyricClickEvents(container) {
  // 移除旧的监听器（如果有）
  container.removeEventListener('click', handleLyricClick);
  // 添加新的监听器
  container.addEventListener('click', handleLyricClick);
}

// 处理歌词点击
function handleLyricClick(e) {
  var target = e.target;
  // 找到最近的 .lyric-line 元素
  while (target && !target.classList.contains('lyric-line')) {
    if (target === e.currentTarget) return;
    target = target.parentElement;
  }
  
  if (target && target.classList.contains('lyric-line')) {
    var time = parseFloat(target.getAttribute('data-time'));
    if (!isNaN(time) && time >= 0) {
      // 跳转到对应时间
      Tapp.media.seek(time);
      // 临时禁用自动滚动，避免跳转后立即被滚动覆盖
      pageState.settings.autoScroll = false;
      setTimeout(function() {
        pageState.settings.autoScroll = true;
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

// 更新播放器UI
function updatePlayerUI(status) {
  if (!status) return;

  var track = status.currentTrack;
  
  // 动态背景 - 使用封面作为模糊背景
  var bgArtwork = $('bg-artwork');
  if (bgArtwork && track && track.cover) {
    bgArtwork.style.backgroundImage = 'url(' + track.cover + ')';
  }
  
  // 同步音乐播放器的完整动态颜色
  var root = document.documentElement;
  if (status.primaryColor) {
    var primary = status.primaryColor;
    root.style.setProperty('--music-primary', primary);
    root.style.setProperty('--accent-color', primary);
    root.style.setProperty('--accent-light', primary + '26');
    root.style.setProperty('--accent-glow', primary + '66');
  }
  if (status.secondaryColor) {
    root.style.setProperty('--music-secondary', status.secondaryColor);
  }
  if (status.accentColor) {
    root.style.setProperty('--music-accent', status.accentColor);
  }
  if (status.lightColor) {
    root.style.setProperty('--music-light', status.lightColor);
  }
  if (status.darkColor) {
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

  // 播放/暂停按钮
  var playBtn = $('play-btn');
  if (playBtn) {
    var iconPlay = playBtn.querySelector('.icon-play');
    var iconPause = playBtn.querySelector('.icon-pause');
    if (iconPlay && iconPause) {
      iconPlay.style.display = status.isPlaying ? 'none' : 'block';
      iconPause.style.display = status.isPlaying ? 'block' : 'none';
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

  // 进度条
  var progressBar = $('progress-bar');
  var progressFill = $('progress-fill');
  var currentTimeEl = $('current-time');
  var remainingTimeEl = $('remaining-time');
  var duration = track ? (track.duration || 0) : 0;
  var position = status.position || (status.progress ? status.progress.current : 0) || 0;
  
  if (progressBar) {
    progressBar.max = duration || 100;
    progressBar.value = position;
  }
  if (progressFill) {
    var percent = duration > 0 ? (position / duration) * 100 : 0;
    progressFill.style.width = percent + '%';
  }
  if (currentTimeEl) currentTimeEl.textContent = formatTime(position);
  // 显示剩余时长（负数形式）
  if (remainingTimeEl) {
    var remaining = Math.max(0, duration - position);
    remainingTimeEl.textContent = '-' + formatTime(remaining);
  }

  // 音量
  var volumeBar = $('volume-bar');
  var volumeFill = $('volume-fill');
  var volumeValue = status.volume || 0;
  var normalizedVolume = volumeValue > 1 ? volumeValue / 100 : volumeValue;
  if (volumeBar) volumeBar.value = normalizedVolume;
  if (volumeFill) volumeFill.style.width = (normalizedVolume * 100) + '%';

  // 播放模式
  var modeBtn = $('mode-btn');
  if (modeBtn) {
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

// 初始化页面
async function initPage() {
  // 获取设置
  try {
    var saved = await Tapp.settings.getAll();
    if (saved) Object.assign(pageState.settings, saved);
  } catch (e) {}

  // 设置标题
  var titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = t('title');

  // 获取初始状态
  try {
    var statusResult = await Tapp.media.getStatus();
    // API 返回 { isPlaying, currentTrack: { id, title, artist, cover, duration }, progress, volume, muted, mode }
    var status = statusResult || {};
    
    // 规范化字段名: API 返回 title，我们需要 name
    if (status.currentTrack) {
      status.currentTrack.name = status.currentTrack.title || status.currentTrack.name;
    }
    // 规范化进度: API 返回 progress.current，我们需要 position
    if (status.progress) {
      status.position = status.progress.current || 0;
    }
    // 注意：不在这里规范化 volume，让 updatePlayerUI 统一处理
    
    pageState.status = status;
    updatePlayerUI(status);

    // 获取歌词（歌词在 status.lyrics 中）
    if (status.lyrics && status.lyrics.length > 0) {
      pageState.lyrics = status.lyrics;
      pageState.currentLyricIndex = status.currentLyricIndex || -1;
      renderLyrics(status.lyrics, status.currentLyricIndex || -1);
    }
  } catch (e) {
    console.error('Failed to get media status:', e);
  }

  // 获取播放列表
  try {
    var playlistResult = await Tapp.media.getPlaylist();
    // API 返回 { tracks: [...], currentIndex, total }
    var tracks = [];
    if (playlistResult && Array.isArray(playlistResult.tracks)) {
      tracks = playlistResult.tracks;
    } else if (Array.isArray(playlistResult)) {
      tracks = playlistResult;
    }
    
    pageState.playlist = tracks.map(function(song, idx) {
      // 规范化字段名
      return {
        id: song.id || String(idx),
        name: song.title || song.name || 'Unknown',
        artist: song.artist || 'Unknown',
        cover: song.cover || '',
        duration: song.duration || 0,
        isVip: song.isVip || false,
        vipType: song.vipType || null,
        originalIndex: song.index !== undefined ? song.index : idx,
        isCurrent: song.isCurrent || false
      };
    });
    
    renderPlaylist(pageState.playlist, pageState.status?.currentTrack, '');
    
    // 更新 Tab badge 数量
    var badge = document.getElementById('playlist-badge');
    if (badge) badge.textContent = pageState.playlist.length;
  } catch (e) {
    console.error('Failed to get playlist:', e);
  }

  // 监听状态变化
  pageState.unsubscribe = Tapp.media.onStateChange(function(state) {
    // 规范化状态
    if (state.currentTrack) {
      state.currentTrack.name = state.currentTrack.title || state.currentTrack.name;
    }
    // 处理进度信息
    if (state.progress) {
      state.position = state.progress.current || 0;
    } else if (typeof state.position === 'number') {
      // 已经有 position 字段
    }
    // 注意：不在这里规范化 volume，让 updatePlayerUI 统一处理
    
    pageState.status = state;
    updatePlayerUI(state);

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

    // 更新播放列表高亮 - 使用缓存的元素引用
    if (state.currentTrack) {
      var currentId = state.currentTrack.id;
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
  // 检测是否移动端
  var isMobile = function() {
    return window.innerWidth <= 768;
  };
  
  // Tab 切换
  var tabBtns = document.querySelectorAll('.tab-btn');
  var playerRight = document.getElementById('player-right');
  var mobileCloseBtn = document.getElementById('mobile-close-btn');
  var mobilePanelTitle = document.getElementById('mobile-panel-title');
  
  // 面板标题映射
  var panelTitles = {
    'lyrics': '歌词',
    'playlist': '播放列表'
  };
  
  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var tab = btn.getAttribute('data-tab');
      var wasActive = btn.classList.contains('active');
      
      // 更新 tab 按钮状态
      tabBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      
      // 切换面板
      var panels = document.querySelectorAll('.panel');
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
    });
  });
  
  // 移动端关闭按钮
  if (mobileCloseBtn && playerRight) {
    mobileCloseBtn.addEventListener('click', function() {
      playerRight.classList.remove('mobile-visible');
      // 取消所有tab按钮的active状态
      tabBtns.forEach(function(b) { b.classList.remove('active'); });
    });
  }
  
  // 窗口大小变化时重置状态
  window.addEventListener('resize', function() {
    if (!isMobile() && playerRight) {
      playerRight.classList.remove('mobile-visible');
      // 桌面端恢复默认active状态
      var lyricsTab = document.getElementById('tab-lyrics');
      if (lyricsTab && !document.querySelector('.tab-btn.active')) {
        lyricsTab.classList.add('active');
      }
    }
  });
  
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

  // 进度条 - 同步 fill
  var progressBar = document.getElementById('progress-bar');
  var progressFill = document.getElementById('progress-fill');
  if (progressBar) {
    progressBar.addEventListener('input', function(e) {
      var value = parseFloat(e.target.value);
      var max = parseFloat(e.target.max) || 100;
      if (progressFill) {
        progressFill.style.width = (value / max * 100) + '%';
      }
      Tapp.media.seek(value);
    });
  }

  // 音量滑块 - 同步 fill
  var volumeBar = document.getElementById('volume-bar');
  var volumeFill = document.getElementById('volume-fill');
  if (volumeBar) {
    volumeBar.addEventListener('input', function(e) {
      var value = parseFloat(e.target.value);
      if (volumeFill) {
        volumeFill.style.width = (value * 100) + '%';
      }
      // 后端期望 0-100，HTML slider 是 0-1，需要转换
      Tapp.media.setVolume(value * 100);
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
}

// ========================================
// 动态背景动画
// ========================================

// 节奏检测参数
var BG_ENERGY_HISTORY_SIZE = 8;
var BG_BEAT_THRESHOLD = 1.3;
var BG_BEAT_COOLDOWN = 150;

// 启动背景动画
function startBackgroundAnimation() {
  // 检查动画级别
  if (!shouldAnimate()) {
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
        
        // 维护能量历史
        pageState.energyHistory.push(currentEnergy);
        if (pageState.energyHistory.length > BG_ENERGY_HISTORY_SIZE) {
          pageState.energyHistory.shift();
        }
        
        // 计算平均能量
        var sum = 0;
        for (var i = 0; i < pageState.energyHistory.length; i++) {
          sum += pageState.energyHistory[i];
        }
        var avgEnergy = sum / pageState.energyHistory.length;
        
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

// 应用背景变换
function applyBackgroundTransform(beatIntensity, energy, phase) {
  var bgArtwork = $('bg-artwork');
  if (!bgArtwork) return;
  
  // 基础参数
  var baseScale = 1.1;
  var baseRotate = 0;
  
  // 根据节拍强度计算缩放 (1.1 ~ 1.25)
  var scale = baseScale + beatIntensity * 0.15;
  
  // 根据相位计算缓慢位移 (柔和的漂浮效果)
  var translateX = Math.sin(phase) * 15 + beatIntensity * Math.sin(phase * 3) * 10;
  var translateY = Math.cos(phase * 0.7) * 15 + beatIntensity * Math.cos(phase * 2.5) * 10;
  
  // 根据能量和相位计算微小旋转 (-3deg ~ 3deg)
  var rotate = Math.sin(phase * 0.5) * 2 + beatIntensity * Math.sin(phase * 2) * 1;
  
  // 应用变换
  bgArtwork.style.transform = 'scale(' + scale.toFixed(3) + ') ' +
                              'translate(' + translateX.toFixed(1) + 'px, ' + translateY.toFixed(1) + 'px) ' +
                              'rotate(' + rotate.toFixed(2) + 'deg)';
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

        currentLocale = normalizeLocale(results[0]);
        
        // 注意：音乐播放器 Tapp 使用封面颜色，不使用系统主题色
        // 封面颜色会在 initPage() 中从音乐状态同步
        
        await initPage();

        // 监听语言变化
        Tapp.ui.onLocaleChange(function(locale) {
          currentLocale = normalizeLocale(locale);
          initPage();
        });

        // 不监听系统主题色变化，音乐播放器使用封面颜色
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
