// Quick Notes Tapp v3.0 - Core
// 便携便签 - 核心代码

console.log('[Notes] Core 加载中...');

// ========== 工具函数 ==========
function formatTime(timestamp) {
  var date = new Date(timestamp);
  var now = new Date();
  var diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
  
  return date.toLocaleDateString();
}

function getThemeColors(isDark) {
  return {
    bg: isDark ? '#1a1a2e' : '#f8fafc',
    card: isDark ? '#262640' : '#ffffff',
    cardHover: isDark ? '#2d2d4a' : '#f1f5f9',
    border: isDark ? '#3d3d5c' : '#e2e8f0',
    text: isDark ? '#e2e8f0' : '#1e293b',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    accent: '#6366f1',
    accentHover: '#4f46e5',
    danger: '#ef4444',
  };
}

console.log('[Notes] Core 已加载');

// ========== Widget Code ==========
// Quick Notes Tapp v3.0 - Widget
// 便携便签 - 小组件代码

console.log('[Notes] Widget 加载中...');

Tapp.widgets['notes'] = {
  render: async function(container, props) {
    var isDark = props.theme === 'dark';
    var colors = getThemeColors(isDark);
    var size = props.size.split('x').map(Number);
    var isLarge = size[0] >= 4 || size[1] >= 4;
    
    var notes = await Tapp.storage.get('notes') || [];
    var showTimestamp = await Tapp.settings.get('showTimestamp') !== false;
    
    container.style.cssText = 
      'height: 100%;' +
      'display: flex;' +
      'flex-direction: column;' +
      'background: ' + colors.card + ';' +
      'border-radius: 16px;' +
      'box-sizing: border-box;' +
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      'overflow: hidden;';
    container.innerHTML = '';
    
    // 头部
    var header = document.createElement('div');
    header.style.cssText = 
      'padding: 14px 16px;' +
      'border-bottom: 1px solid ' + colors.border + ';' +
      'display: flex;' +
      'align-items: center;' +
      'gap: 10px;';
    
    var icon = document.createElement('span');
    icon.textContent = '📝';
    icon.style.cssText = 'font-size: 20px;';
    
    var title = document.createElement('span');
    title.textContent = '便签';
    title.style.cssText = 'font-size: 15px; font-weight: 600; color: ' + colors.text + '; flex: 1;';
    
    var countBadge = document.createElement('span');
    countBadge.style.cssText = 
      'font-size: 12px;' +
      'padding: 3px 10px;' +
      'background: ' + colors.accent + '20;' +
      'color: ' + colors.accent + ';' +
      'border-radius: 12px;' +
      'font-weight: 500;';
    countBadge.textContent = notes.length;
    
    header.appendChild(icon);
    header.appendChild(title);
    header.appendChild(countBadge);
    container.appendChild(header);
    
    // 输入区
    var inputArea = document.createElement('div');
    inputArea.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid ' + colors.border + ';';
    
    var inputWrapper = document.createElement('div');
    inputWrapper.style.cssText = 'display: flex; gap: 8px;';
    
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '记录一个想法...';
    input.style.cssText = 
      'flex: 1;' +
      'padding: 10px 14px;' +
      'border: 1px solid ' + colors.border + ';' +
      'border-radius: 10px;' +
      'background: ' + colors.bg + ';' +
      'color: ' + colors.text + ';' +
      'font-size: 14px;' +
      'outline: none;' +
      'transition: border-color 0.2s;';
    input.onfocus = function() { input.style.borderColor = colors.accent; };
    input.onblur = function() { input.style.borderColor = colors.border; };
    
    var addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.style.cssText = 
      'width: 40px;' +
      'height: 40px;' +
      'border: none;' +
      'border-radius: 10px;' +
      'background: ' + colors.accent + ';' +
      'color: #fff;' +
      'font-size: 20px;' +
      'cursor: pointer;' +
      'transition: background 0.2s, transform 0.1s;';
    addBtn.onmouseenter = function() { addBtn.style.background = colors.accentHover; };
    addBtn.onmouseleave = function() { addBtn.style.background = colors.accent; };
    
    inputWrapper.appendChild(input);
    inputWrapper.appendChild(addBtn);
    inputArea.appendChild(inputWrapper);
    container.appendChild(inputArea);
    
    // 笔记列表
    var notesList = document.createElement('div');
    notesList.style.cssText = 'flex: 1; overflow-y: auto; padding: 8px 0;';
    
    function renderNotes() {
      notesList.innerHTML = '';
      
      if (notes.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 
          'padding: 40px 20px;' +
          'text-align: center;' +
          'color: ' + colors.textSecondary + ';' +
          'font-size: 14px;';
        empty.innerHTML = '📝<br><br>暂无笔记';
        notesList.appendChild(empty);
        return;
      }
      
      var displayCount = isLarge ? notes.length : Math.min(notes.length, 5);
      
      for (var i = 0; i < displayCount; i++) {
        (function(note) {
          var noteEl = document.createElement('div');
          noteEl.style.cssText = 
            'padding: 12px 16px;' +
            'display: flex;' +
            'align-items: flex-start;' +
            'gap: 10px;' +
            'transition: background 0.2s;' +
            'cursor: default;';
          
          var content = document.createElement('div');
          content.style.cssText = 'flex: 1; min-width: 0;';
          
          var text = document.createElement('div');
          text.style.cssText = 
            'font-size: 14px;' +
            'color: ' + colors.text + ';' +
            'word-break: break-word;' +
            'line-height: 1.5;';
          Tapp.dom.setText(text, note.text);
          content.appendChild(text);
          
          if (showTimestamp) {
            var time = document.createElement('div');
            time.style.cssText = 
              'font-size: 12px;' +
              'color: ' + colors.textSecondary + ';' +
              'margin-top: 4px;';
            time.textContent = formatTime(note.createdAt);
            content.appendChild(time);
          }
          
          var deleteBtn = document.createElement('button');
          deleteBtn.innerHTML = '×';
          deleteBtn.style.cssText = 
            'width: 24px; height: 24px;' +
            'border: none; border-radius: 6px;' +
            'background: transparent;' +
            'color: ' + colors.textSecondary + ';' +
            'font-size: 18px;' +
            'cursor: pointer;' +
            'opacity: 0;' +
            'transition: all 0.2s;';
          
          noteEl.onmouseenter = function() { 
            deleteBtn.style.opacity = '1'; 
            noteEl.style.background = colors.cardHover;
          };
          noteEl.onmouseleave = function() { 
            deleteBtn.style.opacity = '0'; 
            noteEl.style.background = 'transparent';
          };
          deleteBtn.onmouseenter = function() { 
            deleteBtn.style.color = colors.danger;
            deleteBtn.style.background = colors.danger + '20';
          };
          deleteBtn.onmouseleave = function() { 
            deleteBtn.style.color = colors.textSecondary;
            deleteBtn.style.background = 'transparent';
          };
          deleteBtn.onclick = async function() {
            notes = notes.filter(function(n) { return n.id !== note.id; });
            await Tapp.storage.set('notes', notes);
            renderNotes();
            countBadge.textContent = notes.length;
          };
          
          noteEl.appendChild(content);
          noteEl.appendChild(deleteBtn);
          notesList.appendChild(noteEl);
        })(notes[i]);
      }
      
      if (!isLarge && notes.length > 5) {
        var more = document.createElement('div');
        more.style.cssText = 
          'padding: 10px 16px;' +
          'text-align: center;' +
          'font-size: 13px;' +
          'color: ' + colors.textSecondary + ';';
        more.textContent = '还有 ' + (notes.length - 5) + ' 条...';
        notesList.appendChild(more);
      }
    }
    
    async function addNote() {
      var text = input.value.trim();
      if (!text) return;
      
      var maxNotes = await Tapp.settings.get('maxNotes') || 100;
      notes.unshift({
        id: Date.now(),
        text: text,
        createdAt: Date.now(),
      });
      
      if (notes.length > maxNotes) {
        notes = notes.slice(0, maxNotes);
      }
      
      await Tapp.storage.set('notes', notes);
      input.value = '';
      renderNotes();
      countBadge.textContent = notes.length;
    }
    
    addBtn.onclick = addNote;
    input.onkeydown = function(e) { if (e.key === 'Enter') addNote(); };
    
    container.appendChild(notesList);
    renderNotes();
    
    console.log('[Notes] Widget 已渲染');
  }
};

console.log('[Notes] Widget 已加载');

// ========== Page Code ==========
// Quick Notes Tapp v3.0 - Page
// 便携便签 - 页面代码

console.log('[Notes] Page 加载中...');

Tapp.pages['notes'] = {
  render: async function(container) {
    var isDark = document.documentElement.classList.contains('dark');
    var colors = getThemeColors(isDark);
    
    var notes = await Tapp.storage.get('notes') || [];
    var showTimestamp = await Tapp.settings.get('showTimestamp') !== false;
    
    container.style.cssText = 
      'min-height: 100%;' +
      'background: ' + colors.bg + ';' +
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      'padding: 24px;' +
      'box-sizing: border-box;';
    container.innerHTML = '';
    
    var main = document.createElement('div');
    main.style.cssText = 'max-width: 800px; margin: 0 auto;';
    
    // 标题
    var header = document.createElement('div');
    header.style.cssText = 'margin-bottom: 24px; text-align: center;';
    
    var emoji = document.createElement('div');
    emoji.textContent = '📝';
    emoji.style.cssText = 'font-size: 48px; margin-bottom: 12px;';
    
    var title = document.createElement('h1');
    title.textContent = '便携便签';
    title.style.cssText = 'font-size: 28px; font-weight: 700; margin: 0 0 8px; color: ' + colors.text + ';';
    
    var subtitle = document.createElement('p');
    subtitle.textContent = '记录你的想法和灵感';
    subtitle.style.cssText = 'font-size: 16px; color: ' + colors.textSecondary + '; margin: 0;';
    
    header.appendChild(emoji);
    header.appendChild(title);
    header.appendChild(subtitle);
    main.appendChild(header);
    
    // 输入卡片
    var inputCard = document.createElement('div');
    inputCard.style.cssText = 
      'background: ' + colors.card + ';' +
      'border-radius: 16px;' +
      'padding: 20px;' +
      'margin-bottom: 20px;' +
      'box-shadow: 0 2px 8px rgba(0,0,0,0.05);';
    
    var textarea = document.createElement('textarea');
    textarea.placeholder = '记录一个想法...';
    textarea.style.cssText = 
      'width: 100%;' +
      'min-height: 100px;' +
      'padding: 16px;' +
      'border: 2px solid ' + colors.border + ';' +
      'border-radius: 12px;' +
      'background: ' + colors.bg + ';' +
      'color: ' + colors.text + ';' +
      'font-size: 15px;' +
      'line-height: 1.6;' +
      'resize: vertical;' +
      'outline: none;' +
      'box-sizing: border-box;' +
      'font-family: inherit;' +
      'transition: border-color 0.2s;';
    textarea.onfocus = function() { textarea.style.borderColor = colors.accent; };
    textarea.onblur = function() { textarea.style.borderColor = colors.border; };
    
    var addBtn = document.createElement('button');
    addBtn.textContent = '添加笔记';
    addBtn.style.cssText = 
      'margin-top: 12px;' +
      'padding: 12px 24px;' +
      'border: none;' +
      'border-radius: 10px;' +
      'background: ' + colors.accent + ';' +
      'color: #fff;' +
      'font-size: 15px;' +
      'font-weight: 500;' +
      'cursor: pointer;' +
      'transition: background 0.2s, transform 0.1s;';
    addBtn.onmouseenter = function() { addBtn.style.background = colors.accentHover; };
    addBtn.onmouseleave = function() { addBtn.style.background = colors.accent; };
    
    inputCard.appendChild(textarea);
    inputCard.appendChild(addBtn);
    main.appendChild(inputCard);
    
    // 统计
    var stats = document.createElement('div');
    stats.style.cssText = 
      'display: flex;' +
      'justify-content: center;' +
      'gap: 32px;' +
      'margin-bottom: 20px;' +
      'color: ' + colors.textSecondary + ';' +
      'font-size: 14px;';
    
    var countStat = document.createElement('span');
    countStat.textContent = '共 ' + notes.length + ' 条笔记';
    stats.appendChild(countStat);
    main.appendChild(stats);
    
    // 笔记列表
    var notesList = document.createElement('div');
    notesList.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
    
    function renderNotes() {
      notesList.innerHTML = '';
      countStat.textContent = '共 ' + notes.length + ' 条笔记';
      
      if (notes.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 
          'background: ' + colors.card + ';' +
          'border-radius: 16px;' +
          'padding: 60px 20px;' +
          'text-align: center;' +
          'color: ' + colors.textSecondary + ';';
        empty.innerHTML = '<div style="font-size:48px;margin-bottom:16px;">📝</div>暂无笔记，开始记录吧！';
        notesList.appendChild(empty);
        return;
      }
      
      notes.forEach(function(note) {
        var noteCard = document.createElement('div');
        noteCard.style.cssText = 
          'background: ' + colors.card + ';' +
          'border-radius: 12px;' +
          'padding: 16px 20px;' +
          'display: flex;' +
          'align-items: flex-start;' +
          'gap: 16px;' +
          'transition: transform 0.2s, box-shadow 0.2s;';
        noteCard.onmouseenter = function() {
          noteCard.style.transform = 'translateY(-2px)';
          noteCard.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        };
        noteCard.onmouseleave = function() {
          noteCard.style.transform = '';
          noteCard.style.boxShadow = '';
        };
        
        var content = document.createElement('div');
        content.style.cssText = 'flex: 1; min-width: 0;';
        
        var text = document.createElement('div');
        text.style.cssText = 
          'font-size: 15px;' +
          'color: ' + colors.text + ';' +
          'line-height: 1.6;' +
          'white-space: pre-wrap;' +
          'word-break: break-word;';
        Tapp.dom.setText(text, note.text);
        content.appendChild(text);
        
        if (showTimestamp) {
          var time = document.createElement('div');
          time.style.cssText = 'font-size: 13px; color: ' + colors.textSecondary + '; margin-top: 8px;';
          time.textContent = formatTime(note.createdAt);
          content.appendChild(time);
        }
        
        var deleteBtn = document.createElement('button');
        deleteBtn.textContent = '删除';
        deleteBtn.style.cssText = 
          'padding: 8px 16px;' +
          'border: none;' +
          'border-radius: 8px;' +
          'background: transparent;' +
          'color: ' + colors.textSecondary + ';' +
          'font-size: 14px;' +
          'cursor: pointer;' +
          'transition: all 0.2s;';
        deleteBtn.onmouseenter = function() {
          deleteBtn.style.background = colors.danger + '15';
          deleteBtn.style.color = colors.danger;
        };
        deleteBtn.onmouseleave = function() {
          deleteBtn.style.background = 'transparent';
          deleteBtn.style.color = colors.textSecondary;
        };
        deleteBtn.onclick = async function() {
          notes = notes.filter(function(n) { return n.id !== note.id; });
          await Tapp.storage.set('notes', notes);
          renderNotes();
        };
        
        noteCard.appendChild(content);
        noteCard.appendChild(deleteBtn);
        notesList.appendChild(noteCard);
      });
    }
    
    async function addNote() {
      var text = textarea.value.trim();
      if (!text) return;
      
      var maxNotes = await Tapp.settings.get('maxNotes') || 100;
      notes.unshift({
        id: Date.now(),
        text: text,
        createdAt: Date.now(),
      });
      
      if (notes.length > maxNotes) {
        notes = notes.slice(0, maxNotes);
      }
      
      await Tapp.storage.set('notes', notes);
      textarea.value = '';
      renderNotes();
      
      await Tapp.ui.showNotification({
        title: '笔记已添加',
        message: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
        type: 'success',
      });
    }
    
    addBtn.onclick = addNote;
    
    main.appendChild(notesList);
    container.appendChild(main);
    renderNotes();
    
    console.log('[Notes] Page 已渲染');
  }
};

// ========== 生命周期（仅页面模式执行） ==========
Tapp.lifecycle.onReady(async function() {
  console.log('[Notes] 页面模式已就绪');
  
  // 注册页面组件
  await Tapp.component.registerPage({
    id: 'notes',
    path: '/tapp/notes',
    title: '便携便签',
    icon: '📝',
    menu: true,
    order: 10,
    fullscreen: true,
  });
  console.log('[Notes] 页面组件已注册');
  
  // 初始化存储
  var notes = await Tapp.storage.get('notes');
  if (!notes) {
    await Tapp.storage.set('notes', []);
  }
  
  // 渲染页面
  var container = document.getElementById('tapp-root');
  if (container) {
    container.innerHTML = '';
    await Tapp.pages['notes'].render(container);
  }
});

Tapp.lifecycle.onDestroy(async function() {
  console.log('[Notes] 正在销毁...');
  try {
    await Tapp.component.unregister('page', 'notes');
  } catch (e) {
    console.log('[Notes] 注销时出错:', e);
  }
});

console.log('[Notes] Page 已加载');
