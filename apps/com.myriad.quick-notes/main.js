// Quick Notes Tapp v1.0.0
// 便携便签 - 完全重构版（便利贴风格）

// ========================================
// 国际化
// ========================================

var i18n = {
  'zh-CN': {
    title: '便签',
    placeholder: '记录一个想法...',
    searchPlaceholder: '搜索笔记...',
    add: '添加',
    delete: '删除',
    clearAll: '清空全部',
    clearConfirm: '确定要清空所有笔记吗？',
    notesCount: '条笔记',
    emptyTitle: '暂无笔记',
    emptySubtitle: '开始记录你的想法吧！',
    justNow: '刚刚',
    minutesAgo: '分钟前',
    hoursAgo: '小时前',
    daysAgo: '天前',
    noteAdded: '笔记已添加',
    noteDeleted: '笔记已删除',
    allCleared: '已清空所有笔记'
  },
  'en-US': {
    title: 'Notes',
    placeholder: 'Write a note...',
    searchPlaceholder: 'Search notes...',
    add: 'Add',
    delete: 'Delete',
    clearAll: 'Clear All',
    clearConfirm: 'Are you sure you want to clear all notes?',
    notesCount: 'notes',
    emptyTitle: 'No notes yet',
    emptySubtitle: 'Start writing your thoughts!',
    justNow: 'just now',
    minutesAgo: 'm ago',
    hoursAgo: 'h ago',
    daysAgo: 'd ago',
    noteAdded: 'Note added',
    noteDeleted: 'Note deleted',
    allCleared: 'All notes cleared'
  },
  'ja-JP': {
    title: 'メモ',
    placeholder: 'メモを書く...',
    searchPlaceholder: 'メモを検索...',
    add: '追加',
    delete: '削除',
    clearAll: '全削除',
    clearConfirm: 'すべてのメモを削除しますか？',
    notesCount: '件のメモ',
    emptyTitle: 'メモがありません',
    emptySubtitle: '思いを書き始めましょう！',
    justNow: 'たった今',
    minutesAgo: '分前',
    hoursAgo: '時間前',
    daysAgo: '日前',
    noteAdded: 'メモを追加しました',
    noteDeleted: 'メモを削除しました',
    allCleared: 'すべてのメモを削除しました'
  }
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

function formatTime(timestamp) {
  var date = new Date(timestamp);
  var now = new Date();
  var diff = now - date;
  
  if (diff < 60000) return t('justNow');
  if (diff < 3600000) return Math.floor(diff / 60000) + ' ' + t('minutesAgo');
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' ' + t('hoursAgo');
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' ' + t('daysAgo');
  
  return date.toLocaleDateString(currentLocale);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ========================================
// Widget 状态
// ========================================

var widgetState = {
  notes: [],
  settings: { maxNotes: 100, showTimestamp: true }
};

// ========================================
// Widget 初始化 - 通用
// ========================================

async function initWidget() {
  var props = window._TAPP_WIDGET_PROPS || {};
  var size = props.size || '2x2';
  currentLocale = normalizeLocale(props.locale);
  
  // 加载数据
  try {
    widgetState.notes = await Tapp.storage.get('notes') || [];
    var savedSettings = await Tapp.settings.getAll();
    if (savedSettings) {
      Object.assign(widgetState.settings, savedSettings);
    }
  } catch (e) {
    console.error('[Notes] 加载数据失败:', e);
  }
  
  // 设置 UI 文本
  var titleEl = document.getElementById('widget-title');
  var inputEl = document.getElementById('widget-input');
  var countEl = document.getElementById('widget-count');
  
  if (titleEl) titleEl.textContent = t('title');
  if (inputEl) inputEl.placeholder = t('placeholder');
  if (countEl) countEl.textContent = widgetState.notes.length;
  
  // 渲染笔记列表
  renderWidgetNotes(size);
  
  // 绑定事件
  var addBtn = document.getElementById('widget-add');
  var input = document.getElementById('widget-input');
  
  if (addBtn && input) {
    addBtn.addEventListener('click', function() {
      addWidgetNote(input, size);
    });
    
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addWidgetNote(input, size);
      }
    });
  }
}

function renderWidgetNotes(size) {
  var listEl = document.getElementById('notes-list');
  var countEl = document.getElementById('widget-count');
  
  if (!listEl) return;
  
  listEl.innerHTML = '';
  
  if (countEl) countEl.textContent = widgetState.notes.length;
  
  if (widgetState.notes.length === 0) {
    listEl.innerHTML = '<div class="notes-empty"><span class="empty-icon">📝</span><span class="empty-text">' + escapeHtml(t('emptyTitle')) + '</span></div>';
    return;
  }
  
  // 根据尺寸决定显示数量
  var maxDisplay = size === '4x4' ? 8 : (size === '4x2' ? 4 : 3);
  var displayNotes = widgetState.notes.slice(0, maxDisplay);
  
  displayNotes.forEach(function(note) {
    var item = document.createElement('div');
    item.className = 'note-item';
    
    var content = document.createElement('div');
    content.className = 'note-content';
    
    var text = document.createElement('div');
    text.className = 'note-text';
    text.textContent = note.text;
    content.appendChild(text);
    
    if (widgetState.settings.showTimestamp) {
      var time = document.createElement('div');
      time.className = 'note-time';
      time.textContent = formatTime(note.createdAt);
      content.appendChild(time);
    }
    
    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'note-delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = t('delete');
    deleteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteWidgetNote(note.id, size);
    });
    
    item.appendChild(content);
    item.appendChild(deleteBtn);
    listEl.appendChild(item);
  });
  
  // 显示更多提示
  if (widgetState.notes.length > maxDisplay) {
    var more = document.createElement('div');
    more.className = 'note-item';
    more.style.cssText = 'justify-content: center; color: var(--notes-text-muted); font-size: 11px; padding: 6px;';
    more.textContent = '+' + (widgetState.notes.length - maxDisplay) + ' ' + t('notesCount');
    listEl.appendChild(more);
  }
}

async function addWidgetNote(input, size) {
  var text = input.value.trim();
  if (!text) return;
  
  var addBtn = document.getElementById('widget-add');
  if (addBtn) {
    addBtn.classList.add('add-bounce');
    setTimeout(function() { addBtn.classList.remove('add-bounce'); }, 350);
  }
  
  widgetState.notes.unshift({
    id: Date.now(),
    text: text,
    createdAt: Date.now()
  });
  
  // 限制最大数量
  if (widgetState.notes.length > widgetState.settings.maxNotes) {
    widgetState.notes = widgetState.notes.slice(0, widgetState.settings.maxNotes);
  }
  
  input.value = '';
  
  try {
    await Tapp.storage.set('notes', widgetState.notes);
  } catch (e) {
    console.error('[Notes] 保存失败:', e);
  }
  
  renderWidgetNotes(size);
}

async function deleteWidgetNote(noteId, size) {
  widgetState.notes = widgetState.notes.filter(function(n) { return n.id !== noteId; });
  
  try {
    await Tapp.storage.set('notes', widgetState.notes);
  } catch (e) {
    console.error('[Notes] 保存失败:', e);
  }
  
  renderWidgetNotes(size);
}

// ========================================
// Page 状态
// ========================================

var pageState = {
  notes: [],
  filteredNotes: [],
  searchQuery: '',
  settings: { maxNotes: 100, showTimestamp: true, saveHistory: true }
};

// ========================================
// Page 初始化
// ========================================

async function loadPageData() {
  try {
    var savedSettings = await Tapp.settings.getAll();
    if (savedSettings) {
      Object.assign(pageState.settings, savedSettings);
    }
    
    if (pageState.settings.saveHistory) {
      var notes = await Tapp.storage.get('notes');
      if (notes && Array.isArray(notes)) {
        pageState.notes = notes;
        pageState.filteredNotes = notes;
      }
    }
  } catch (e) {
    console.error('[Notes] 加载数据失败:', e);
  }
}

async function saveNotes() {
  if (!pageState.settings.saveHistory) return;
  try {
    await Tapp.storage.set('notes', pageState.notes);
  } catch (e) {
    console.error('[Notes] 保存失败:', e);
  }
}

function updateStatusPill() {
  var titleEl = document.getElementById('status-title');
  var subtitleEl = document.getElementById('status-subtitle');
  
  if (!titleEl || !subtitleEl) return;
  
  titleEl.textContent = t('title');
  
  var count = pageState.notes.length;
  if (count === 0) {
    subtitleEl.textContent = t('emptyTitle');
  } else if (pageState.searchQuery) {
    subtitleEl.textContent = pageState.filteredNotes.length + ' / ' + count + ' ' + t('notesCount');
  } else {
    subtitleEl.textContent = count + ' ' + t('notesCount');
  }
}

function renderPageNotes() {
  var area = document.getElementById('notes-area');
  if (!area) return;
  
  area.innerHTML = '';
  updateStatusPill();
  
  var notesToRender = pageState.searchQuery ? pageState.filteredNotes : pageState.notes;
  
  // 空状态：不渲染占位元素，仅在胶囊显示提示
  if (notesToRender.length === 0) {
    area.classList.add('empty');
    return;
  }
  
  area.classList.remove('empty');
  
  // 创建便利贴网格容器
  var grid = document.createElement('div');
  grid.className = 'notes-grid';
  
  notesToRender.forEach(function(note, index) {
    var sticky = document.createElement('div');
    // 分配颜色：基于note.id循环6种颜色
    var colorIndex = note.id % 6;
    sticky.className = 'sticky-note color-' + colorIndex;
    
    var content = document.createElement('div');
    content.className = 'sticky-content';
    
    var text = document.createElement('div');
    text.className = 'sticky-text';
    text.textContent = note.text;
    content.appendChild(text);
    
    var footer = document.createElement('div');
    footer.className = 'sticky-footer';
    
    if (pageState.settings.showTimestamp) {
      var time = document.createElement('span');
      time.className = 'sticky-time';
      time.textContent = formatTime(note.createdAt);
      footer.appendChild(time);
    }
    
    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'sticky-delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = t('delete');
    deleteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      deletePageNote(note.id);
    });
    footer.appendChild(deleteBtn);
    
    content.appendChild(footer);
    sticky.appendChild(content);
    
    // 添加动画延迟
    sticky.style.animationDelay = (index * 0.05) + 's';
    
    grid.appendChild(sticky);
  });
  
  area.appendChild(grid);
}

async function addPageNote() {
  var input = document.getElementById('page-input');
  var sendBtn = document.getElementById('page-send');
  var charCount = document.getElementById('char-count');
  
  if (!input) return;
  
  var text = input.value.trim();
  if (!text) return;
  
  if (sendBtn) {
    sendBtn.classList.add('send-flying');
    setTimeout(function() { sendBtn.classList.remove('send-flying'); }, 300);
  }
  
  pageState.notes.unshift({
    id: Date.now(),
    text: text,
    createdAt: Date.now()
  });
  
  // 限制最大数量
  if (pageState.notes.length > pageState.settings.maxNotes) {
    pageState.notes = pageState.notes.slice(0, pageState.settings.maxNotes);
  }
  
  input.value = '';
  input.style.height = 'auto';
  if (charCount) charCount.textContent = '0 / 500';
  
  await saveNotes();
  
  // 如果有搜索，更新过滤结果
  if (pageState.searchQuery) {
    filterNotes(pageState.searchQuery);
  } else {
    pageState.filteredNotes = pageState.notes;
  }
  
  renderPageNotes();
  
  try {
    await Tapp.ui.showNotification({
      title: t('noteAdded'),
      message: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
      type: 'success'
    });
  } catch (e) {}
}

async function deletePageNote(noteId) {
  pageState.notes = pageState.notes.filter(function(n) { return n.id !== noteId; });
  
  await saveNotes();
  
  if (pageState.searchQuery) {
    filterNotes(pageState.searchQuery);
  } else {
    pageState.filteredNotes = pageState.notes;
  }
  
  renderPageNotes();
}

async function clearAllNotes() {
  try {
    var confirmed = await Tapp.ui.confirm(t('clearConfirm'));
    if (!confirmed) return;
    
    pageState.notes = [];
    pageState.filteredNotes = [];
    pageState.searchQuery = '';
    
    var searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    
    await saveNotes();
    renderPageNotes();
    
    await Tapp.ui.showNotification({
      title: t('allCleared'),
      type: 'success'
    });
  } catch (e) {
    console.error('[Notes] 清空失败:', e);
  }
}

function filterNotes(query) {
  pageState.searchQuery = query;
  
  if (!query) {
    pageState.filteredNotes = pageState.notes;
  } else {
    var lowerQuery = query.toLowerCase();
    pageState.filteredNotes = pageState.notes.filter(function(note) {
      return note.text.toLowerCase().includes(lowerQuery);
    });
  }
}

function initPage() {
  var input = document.getElementById('page-input');
  var sendBtn = document.getElementById('page-send');
  var clearBtn = document.getElementById('page-clear');
  var charCount = document.getElementById('char-count');
  var searchInput = document.getElementById('search-input');
  var searchToggle = document.getElementById('search-toggle');
  var statusPill = document.getElementById('status-pill');
  
  // 设置多语言文本
  if (input) input.placeholder = t('placeholder');
  if (sendBtn) sendBtn.title = t('add');
  if (clearBtn) clearBtn.title = t('clearAll');
  if (searchInput) searchInput.placeholder = t('searchPlaceholder');
  
  // 搜索切换按钮
  if (searchToggle && statusPill && searchInput) {
    searchToggle.onclick = function() {
      var isSearching = statusPill.classList.toggle('searching');
      searchToggle.classList.toggle('active', isSearching);
      
      if (isSearching) {
        setTimeout(function() {
          searchInput.focus();
        }, 150);
      } else {
        // 关闭搜索时清空并重新渲染
        searchInput.value = '';
        filterNotes('');
        renderPageNotes();
      }
    };
    
    // ESC键关闭搜索
    searchInput.onkeydown = function(e) {
      if (e.key === 'Escape') {
        statusPill.classList.remove('searching');
        searchToggle.classList.remove('active');
        searchInput.value = '';
        filterNotes('');
        renderPageNotes();
      }
    };
  }
  
  // 输入框事件
  if (input) {
    input.oninput = function() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      if (charCount) charCount.textContent = input.value.length + ' / 500';
    };
    
    input.onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addPageNote();
      }
    };
  }
  
  // 发送按钮
  if (sendBtn) {
    sendBtn.onclick = addPageNote;
  }
  
  // 清空按钮
  if (clearBtn) {
    clearBtn.onclick = clearAllNotes;
  }
  
  // 搜索输入
  if (searchInput) {
    var searchTimeout;
    searchInput.oninput = function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function() {
        filterNotes(searchInput.value.trim());
        renderPageNotes();
      }, 200);
    };
  }
  
  renderPageNotes();
}

// ========================================
// 生命周期入口
// ========================================

(function() {
  var mode = window._TAPP_MODE;
  var hasHtml = window._TAPP_HAS_HTML;
  
  if (mode === 'widget') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWidget);
    } else {
      setTimeout(initWidget, 0);
    }
  } else if (mode === 'page' || hasHtml) {
    Tapp.lifecycle.onReady(async function() {
      try {
        var results = await Promise.all([
          Tapp.ui.getLocale(),
          Tapp.ui.getTheme(),
          Tapp.ui.getPrimaryColor()
        ]);
        
        currentLocale = normalizeLocale(results[0]);
        await loadPageData();
        initPage();
        
        Tapp.ui.onLocaleChange(function(locale) {
          currentLocale = normalizeLocale(locale);
          initPage();
        });
      } catch (err) {
        console.error('[Notes] 初始化失败:', err);
        initPage();
      }
    });
    
    Tapp.lifecycle.onDestroy(async function() {
      await saveNotes();
    });
  }
})();
