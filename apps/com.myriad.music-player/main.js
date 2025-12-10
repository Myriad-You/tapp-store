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

// ========================================
// 页面状态
// ========================================

var pageState = {
  status: null,
  playlist: [],
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
};

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

// 渲染歌词
function renderLyrics(lyrics, currentIndex) {
  var container = document.getElementById('lyrics-container');
  if (!container) return;

  if (!lyrics || lyrics.length === 0) {
    container.innerHTML = '<div class="lyrics-empty">' + t('noLyrics') + '</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < lyrics.length; i++) {
    var line = lyrics[i];
    var activeClass = i === currentIndex ? 'active' : '';
    var passedClass = currentIndex >= 0 && i < currentIndex ? 'passed' : '';
    html += '<div class="lyric-line ' + activeClass + ' ' + passedClass + '" data-index="' + i + '">' + 
            escapeHtml(line.text || '') + '</div>';
  }
  container.innerHTML = html;

  // 自动滚动到当前歌词
  if (pageState.settings.autoScroll && currentIndex >= 0) {
    var activeLine = container.querySelector('.lyric-line.active');
    if (activeLine) {
      var containerHeight = container.clientHeight;
      var lineTop = activeLine.offsetTop;
      var lineHeight = activeLine.clientHeight;
      var scrollTop = lineTop - (containerHeight / 2) + (lineHeight / 2);
      container.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'smooth'
      });
    }
  }
}

// 渲染播放列表
function renderPlaylist(playlist, currentTrack, searchQuery) {
  var container = document.getElementById('playlist-container');
  if (!container) return;

  var filteredList = playlist;
  if (searchQuery) {
    var query = searchQuery.toLowerCase();
    filteredList = playlist.filter(function(song) {
      return (song.name && song.name.toLowerCase().includes(query)) ||
             (song.artist && song.artist.toLowerCase().includes(query));
    });
  }

  if (filteredList.length === 0) {
    container.innerHTML = '<div class="playlist-empty">' + 
      (searchQuery ? '未找到匹配歌曲' : t('noPlaylist')) + '</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < filteredList.length; i++) {
    var song = filteredList[i];
    var isActive = currentTrack && song.id === currentTrack.id;
    var vipBadge = '';
    if (song.isVip) {
      vipBadge = '<span class="vip-badge">' + t('vip') + '</span>';
    } else if (song.vipType === 'trial') {
      vipBadge = '<span class="vip-badge trial">' + t('trial') + '</span>';
    }
    
    html += '<div class="playlist-item ' + (isActive ? 'active' : '') + '" data-id="' + song.id + '" data-index="' + song.originalIndex + '">' +
            '<div class="playlist-item-index">' + (song.originalIndex + 1) + '</div>' +
            '<div class="playlist-item-info">' +
              '<div class="playlist-item-name">' + escapeHtml(song.name) + vipBadge + '</div>' +
              '<div class="playlist-item-artist">' + escapeHtml(song.artist) + '</div>' +
            '</div>' +
            (isActive ? '<div class="playlist-item-playing">♪</div>' : '') +
            '</div>';
  }
  container.innerHTML = html;

  // 绑定点击事件
  var items = container.querySelectorAll('.playlist-item');
  items.forEach(function(item) {
    item.addEventListener('click', function() {
      var id = item.getAttribute('data-id');
      var index = parseInt(item.getAttribute('data-index'), 10);
      Tapp.media.playTrack(id, index);
    });
  });

  // 滚动到当前播放
  if (!searchQuery && currentTrack) {
    var activeItem = container.querySelector('.playlist-item.active');
    if (activeItem) {
      setTimeout(function() {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }
}

// 更新播放器UI
function updatePlayerUI(status) {
  if (!status) return;

  var track = status.currentTrack;
  
  // 封面
  var coverEl = document.getElementById('album-cover');
  var coverPlaceholder = document.getElementById('cover-placeholder');
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
  var nameEl = document.getElementById('song-name');
  var artistEl = document.getElementById('song-artist');
  if (nameEl) nameEl.textContent = track ? track.name : t('noPlaying');
  if (artistEl) artistEl.textContent = track ? track.artist : '';

  // VIP 标签
  var vipEl = document.getElementById('vip-badge');
  if (vipEl) {
    if (track && track.isVip) {
      vipEl.textContent = t('vip');
      vipEl.className = 'vip-badge';
      vipEl.style.display = 'inline-block';
    } else if (track && track.vipType === 'trial') {
      vipEl.textContent = t('trial');
      vipEl.className = 'vip-badge trial';
      vipEl.style.display = 'inline-block';
    } else {
      vipEl.style.display = 'none';
    }
  }

  // 播放/暂停按钮
  var playBtn = document.getElementById('play-btn');
  if (playBtn) {
    playBtn.innerHTML = status.isPlaying
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    playBtn.title = status.isPlaying ? t('pause') : t('play');
  }

  // 进度条
  var progressBar = document.getElementById('progress-bar');
  var currentTimeEl = document.getElementById('current-time');
  var totalTimeEl = document.getElementById('total-time');
  var duration = track ? (track.duration || 0) : 0;
  
  if (progressBar) {
    progressBar.max = duration;
    progressBar.value = status.position || 0;
  }
  if (currentTimeEl) currentTimeEl.textContent = formatTime(status.position);
  if (totalTimeEl) totalTimeEl.textContent = formatTime(duration);

  // 音量
  var volumeBar = document.getElementById('volume-bar');
  var volumeIcon = document.getElementById('volume-icon');
  if (volumeBar) volumeBar.value = status.volume || 0;
  if (volumeIcon) {
    volumeIcon.innerHTML = status.muted || status.volume === 0
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
  }

  // 播放模式
  var modeBtn = document.getElementById('mode-btn');
  if (modeBtn) {
    modeBtn.innerHTML = getModeIcon(status.mode);
    modeBtn.title = getModeTooltip(status.mode);
  }

  // 频谱动画 - 播放状态指示
  var spectrumEl = document.getElementById('spectrum-bars');
  if (spectrumEl) {
    if (status.isPlaying && pageState.settings.showSpectrum) {
      spectrumEl.classList.add('playing');
    } else {
      spectrumEl.classList.remove('playing');
    }
  }
}

// 更新歌词索引
function updateLyricIndex(position, lyrics) {
  if (!lyrics || lyrics.length === 0) return -1;
  
  var index = -1;
  for (var i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= position) {
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
    // 规范化音量: API 返回 0-100，我们需要 0-1
    if (typeof status.volume === 'number' && status.volume > 1) {
      status.volume = status.volume / 100;
    }
    
    pageState.status = status;
    updatePlayerUI(status);

    // 获取歌词（如果有）
    if (status.currentTrack && status.currentTrack.lyrics) {
      renderLyrics(status.currentTrack.lyrics, -1);
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
    
    // 更新歌曲数量
    var countEl = document.getElementById('playlist-count');
    if (countEl) countEl.textContent = pageState.playlist.length + ' ' + t('songs');
  } catch (e) {
    console.error('Failed to get playlist:', e);
  }

  // 监听状态变化
  pageState.unsubscribe = Tapp.media.onStateChange(function(state) {
    // 规范化状态
    if (state.currentTrack) {
      state.currentTrack.name = state.currentTrack.title || state.currentTrack.name;
    }
    if (state.progress) {
      state.position = state.progress.current || 0;
    }
    if (typeof state.volume === 'number' && state.volume > 1) {
      state.volume = state.volume / 100;
    }
    
    pageState.status = state;
    updatePlayerUI(state);

    // 更新歌词
    if (state.currentTrack && state.currentTrack.lyrics) {
      var newIndex = updateLyricIndex(state.position, state.currentTrack.lyrics);
      if (newIndex !== pageState.currentLyricIndex) {
        pageState.currentLyricIndex = newIndex;
        renderLyrics(state.currentTrack.lyrics, newIndex);
      }
    }

    // 更新播放列表高亮
    var items = document.querySelectorAll('.playlist-item');
    items.forEach(function(item) {
      var id = item.getAttribute('data-id');
      if (state.currentTrack && id === state.currentTrack.id) {
        item.classList.add('active');
        if (!item.querySelector('.playlist-item-playing')) {
          var playingEl = document.createElement('div');
          playingEl.className = 'playlist-item-playing';
          playingEl.textContent = '♪';
          item.appendChild(playingEl);
        }
      } else {
        item.classList.remove('active');
        var existingPlaying = item.querySelector('.playlist-item-playing');
        if (existingPlaying) existingPlaying.remove();
      }
    });
  });

  // 绑定控制按钮
  bindControls();
}

// 绑定控制按钮事件
function bindControls() {
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

  // 进度条
  var progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.addEventListener('input', function(e) {
      Tapp.media.seek(parseFloat(e.target.value));
    });
  }

  // 音量
  var volumeBar = document.getElementById('volume-bar');
  if (volumeBar) {
    volumeBar.addEventListener('input', function(e) {
      // 后端期望 0-100，HTML slider 是 0-1，需要转换
      var volumeValue = parseFloat(e.target.value) * 100;
      Tapp.media.setVolume(volumeValue);
    });
  }

  // 静音切换
  var volumeIcon = document.getElementById('volume-icon');
  if (volumeIcon) {
    volumeIcon.addEventListener('click', function() {
      if (pageState.status && pageState.status.muted) {
        Tapp.media.unmute();
      } else {
        Tapp.media.mute();
      }
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
}

// ========================================
// 生命周期入口
// ========================================

(function() {
  var mode = window._TAPP_MODE;

  if (mode === 'page') {
    Tapp.lifecycle.onReady(async function() {
      try {
        var results = await Promise.all([
          Tapp.ui.getLocale(),
          Tapp.ui.getTheme(),
          Tapp.ui.getPrimaryColor()
        ]);

        currentLocale = normalizeLocale(results[0]);
        
        // 应用主题色
        var primaryColor = results[2];
        if (primaryColor) {
          document.documentElement.style.setProperty('--primary-color', primaryColor);
        }

        await initPage();

        // 监听语言变化
        Tapp.ui.onLocaleChange(function(locale) {
          currentLocale = normalizeLocale(locale);
          initPage();
        });

        // 监听主题色变化
        Tapp.ui.onPrimaryColorChange(function(color) {
          document.documentElement.style.setProperty('--primary-color', color);
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
