// AI Chat Tapp v1.0.0

// ========================================
// 国际化
// ========================================

var i18n = {
  'zh-CN': {
    widgetTitle: '对话',
    placeholder: '输入...',
    send: '发送',
    title: '对话',
    welcome: '有什么可以帮你？',
    welcomeSubtitle: '选择话题开始',
    clearChat: '清空',
    newChat: '新对话',
    thinking: '思考中...',
    error: '出错了',
    errorNetwork: '网络错误',
    errorFormat: 'AI响应格式错误',
    messagesCount: '条消息',
    welcome4x2Title: '开始对话',
    welcome4x2Subtitle: '输入消息',
    welcomeExamples: [
      { icon: '👋', text: '你好', label: '你好' },
      { icon: '😄', text: '讲个笑话', label: '笑话' },
      { icon: '✍️', text: '写首诗', label: '写诗' }
    ],
    examples: [
      { icon: '💡', title: '解释概念', topic: '请解释一下这个概念' },
      { icon: '✍️', title: '写诗', topic: '写一首诗' },
      { icon: '💻', title: '编程', topic: '教我学编程' },
      { icon: '🎬', title: '电影', topic: '推荐一部电影' }
    ],
  },
  'en-US': {
    widgetTitle: 'Chat',
    placeholder: 'Type...',
    send: 'Send',
    title: 'Chat',
    welcome: 'How can I help?',
    welcomeSubtitle: 'Pick a topic',
    clearChat: 'Clear',
    newChat: 'New',
    thinking: 'Thinking...',
    error: 'Error',
    errorNetwork: 'Network error',
    errorFormat: 'AI response format error',
    messagesCount: 'messages',
    welcome4x2Title: 'Start Chat',
    welcome4x2Subtitle: 'Type a message',
    welcomeExamples: [
      { icon: '👋', text: 'Hello', label: 'Hello' },
      { icon: '😄', text: 'Tell a joke', label: 'Joke' },
      { icon: '✍️', text: 'Write a poem', label: 'Poem' }
    ],
    examples: [
      { icon: '💡', title: 'Explain', topic: 'Please explain this concept' },
      { icon: '✍️', title: 'Poem', topic: 'Write a poem' },
      { icon: '💻', title: 'Code', topic: 'Teach me programming' },
      { icon: '🎬', title: 'Movie', topic: 'Recommend a movie' }
    ],
  },
  'ja-JP': {
    widgetTitle: 'チャット',
    placeholder: '入力...',
    send: '送信',
    title: 'チャット',
    welcome: '何かお手伝いしますか？',
    welcomeSubtitle: 'トピックを選択',
    clearChat: 'クリア',
    newChat: '新規',
    thinking: '考え中...',
    error: 'エラー',
    errorNetwork: 'ネットワークエラー',
    errorFormat: 'AI応答フォーマットエラー',
    messagesCount: '件のメッセージ',
    welcome4x2Title: 'チャット開始',
    welcome4x2Subtitle: 'メッセージを入力',
    welcomeExamples: [
      { icon: '👋', text: 'こんにちは', label: '挨拶' },
      { icon: '😄', text: '面白い話して', label: 'ジョーク' },
      { icon: '✍️', text: '詩を書いて', label: '詩' }
    ],
    examples: [
      { icon: '💡', title: '説明', topic: 'この概念を説明してください' },
      { icon: '✍️', title: '詩', topic: '詩を書いて' },
      { icon: '💻', title: 'コード', topic: 'プログラミングを教えて' },
      { icon: '🎬', title: '映画', topic: '映画をおすすめして' }
    ],
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

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMessage(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// 打字效果
function typeWriter(element, text, speed, onComplete) {
  var formatted = formatMessage(text);
  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = formatted;
  var plainText = tempDiv.textContent || tempDiv.innerText;
  
  var i = 0;
  var cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  cursor.textContent = '▋';
  
  element.innerHTML = '';
  element.appendChild(cursor);
  
  function type() {
    if (i < plainText.length) {
      cursor.remove();
      element.innerHTML = formatMessage(text.substring(0, i + 1));
      element.appendChild(cursor);
      i++;
      setTimeout(type, speed);
    } else {
      cursor.remove();
      element.innerHTML = formatted;
      if (onComplete) onComplete();
    }
  }
  type();
}

// 快速打字（小组件用）
function typeWriterFast(element, text, onComplete) {
  var displayText = text.length > 80 ? text.substring(0, 80) + '...' : text;
  typeWriter(element, displayText, 15, onComplete);
}

// ========================================
// Widget 状态
// ========================================

var widgetState = {
  messages: [],
  sending: false,
};

// ========================================
// 4x2 Widget - 和 4x4 一样动态添加消息
// ========================================

function init4x2Widget() {
  var input = document.getElementById('widget-input');
  var sendBtn = document.getElementById('widget-send');
  var messagesArea = document.getElementById('widget-messages');
  var welcomeEl = document.getElementById('widget-welcome');
  var welcomeTitle = document.getElementById('welcome-title-mini');
  var welcomeSubtitle = document.getElementById('welcome-subtitle-mini');

  if (!input || !sendBtn || !messagesArea) return;

  // 设置多语言文本
  if (input) input.placeholder = t('placeholder');
  if (sendBtn) sendBtn.title = t('send');
  if (welcomeTitle) welcomeTitle.textContent = t('welcome4x2Title');
  if (welcomeSubtitle) welcomeSubtitle.textContent = t('welcome4x2Subtitle');

  // SVG 图标
  var userSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
  var aiSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM7.5 13a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg>';

  function createBubble(role, content, isTyping, useTypingEffect) {
    var row = document.createElement('div');
    row.className = 'msg-row ' + (role === 'user' ? 'msg-row-user' : 'msg-row-ai');

    var avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.innerHTML = role === 'user' ? userSvg : aiSvg;
    if (role === 'user') {
      avatar.classList.add('msg-avatar-user');
    } else {
      avatar.classList.add('msg-avatar-ai');
      if (isTyping || useTypingEffect) avatar.classList.add('avatar-thinking');
    }

    var bubble = document.createElement('div');
    bubble.className = 'bubble ' + (role === 'user' ? 'bubble-user' : 'bubble-ai');

    if (isTyping) {
      bubble.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
    } else if (role === 'user') {
      bubble.textContent = content;
    } else if (useTypingEffect) {
      setTimeout(function() {
        typeWriter(bubble, content, 15, function() {
          avatar.classList.remove('avatar-thinking');
        });
      }, 100);
    } else {
      bubble.innerHTML = formatMessage(content);
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    return row;
  }

  function addMessage(role, content, useTypingEffect) {
    if (welcomeEl) welcomeEl.style.display = 'none';
    var bubble = createBubble(role, content, false, useTypingEffect);
    messagesArea.appendChild(bubble);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    return bubble;
  }

  function addTypingIndicator() {
    var indicator = createBubble('assistant', '', true);
    indicator.id = 'typing-indicator-4x2';
    messagesArea.appendChild(indicator);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  function doSend() {
    var text = input.value.trim();
    if (!text || widgetState.sending) return;

    widgetState.sending = true;
    sendBtn.disabled = true;
    input.value = '';

    if (sendBtn) sendBtn.classList.add('send-flying');
    setTimeout(function() { if (sendBtn) sendBtn.classList.remove('send-flying'); }, 300);

    widgetState.messages.push({ role: 'user', content: text });
    addMessage('user', text);
    setTimeout(addTypingIndicator, 150);

    Tapp.ai.chat([{ role: 'user', content: text }], {}, { maxTokens: 300 })
      .then(function(resp) {
        var ind = document.getElementById('typing-indicator-4x2');
        if (ind) ind.remove();

        var content = resp?.message?.content || resp?.content;
        if (content) {
          widgetState.messages.push({ role: 'assistant', content: content });
          addMessage('assistant', content, true);
        } else {
          throw new Error(t('error'));
        }
      })
      .catch(function(err) {
        var ind = document.getElementById('typing-indicator-4x2');
        if (ind) ind.remove();
        var errorBubble = addMessage('assistant', '❌ ' + (err.message || t('errorNetwork')), false);
        errorBubble.querySelector('.bubble-ai')?.classList.add('shake-error');
      })
      .finally(function() {
        widgetState.sending = false;
        sendBtn.disabled = false;
      });
  }

  sendBtn.addEventListener('click', doSend);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); doSend(); }
  });
}

// ========================================
// 4x4 Widget
// ========================================

function init4x4Widget() {
  var input = document.getElementById('widget-input');
  var sendBtn = document.getElementById('widget-send');
  var clearBtn = document.getElementById('widget-clear');
  var messagesArea = document.getElementById('widget-messages');
  var welcomeEl = document.getElementById('widget-welcome');
  var titleEl = document.getElementById('widget-title');
  var welcomeTitle = document.getElementById('welcome-title');
  var welcomeSubtitle = document.getElementById('welcome-subtitle');
  var welcomeBtnsContainer = document.getElementById('welcome-btns');

  if (!input || !sendBtn || !messagesArea) return;

  // 设置多语言文本
  if (titleEl) titleEl.textContent = t('widgetTitle');
  if (input) input.placeholder = t('placeholder');
  if (sendBtn) sendBtn.title = t('send');
  if (clearBtn) clearBtn.title = t('clearChat');
  if (welcomeTitle) welcomeTitle.textContent = t('welcome');
  if (welcomeSubtitle) welcomeSubtitle.textContent = t('welcomeSubtitle');

  // 动态生成欢迎按钮
  var examples = t('welcomeExamples');
  if (welcomeBtnsContainer && examples && examples.length) {
    welcomeBtnsContainer.innerHTML = '';
    examples.forEach(function(ex) {
      var btn = document.createElement('button');
      btn.className = 'welcome-btn';
      btn.setAttribute('data-example', ex.text);
      btn.textContent = ex.icon + ' ' + ex.label;
      welcomeBtnsContainer.appendChild(btn);
    });
  }

  // SVG 图标
  var userSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
  var aiSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM7.5 13a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg>';

  function createBubble(role, content, isTyping, useTypingEffect) {
    var row = document.createElement('div');
    row.className = 'msg-row ' + (role === 'user' ? 'msg-row-user' : 'msg-row-ai');

    var avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.innerHTML = role === 'user' ? userSvg : aiSvg;
    if (role !== 'user') {
      avatar.classList.add('msg-avatar-ai');
      if (isTyping || useTypingEffect) avatar.classList.add('avatar-thinking');
    } else {
      avatar.classList.add('msg-avatar-user');
    }

    var bubble = document.createElement('div');
    bubble.className = 'bubble ' + (role === 'user' ? 'bubble-user' : 'bubble-ai');

    if (isTyping) {
      bubble.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
    } else if (role === 'user') {
      bubble.textContent = content;
    } else if (useTypingEffect) {
      setTimeout(function() {
        typeWriter(bubble, content, 20, function() {
          avatar.classList.remove('avatar-thinking');
        });
      }, 100);
    } else {
      bubble.innerHTML = formatMessage(content);
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    return row;
  }

  function addMessage(role, content, useTypingEffect) {
    if (welcomeEl) welcomeEl.style.display = 'none';
    var bubble = createBubble(role, content, false, useTypingEffect);
    messagesArea.appendChild(bubble);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    return bubble;
  }

  function addTypingIndicator() {
    var indicator = createBubble('assistant', '', true);
    indicator.id = 'typing-indicator';
    messagesArea.appendChild(indicator);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  function doSend(prefillText) {
    var text = prefillText || input.value.trim();
    if (!text || widgetState.sending) return;

    widgetState.sending = true;
    sendBtn.disabled = true;
    input.value = '';

    if (sendBtn) sendBtn.classList.add('send-flying');
    setTimeout(function() { if (sendBtn) sendBtn.classList.remove('send-flying'); }, 300);

    widgetState.messages.push({ role: 'user', content: text });
    addMessage('user', text);
    setTimeout(addTypingIndicator, 150);

    var chatMsgs = widgetState.messages.map(function(m) {
      return { role: m.role, content: m.content };
    });

    Tapp.ai.chat(chatMsgs, {}, { maxTokens: 500 })
      .then(function(resp) {
        var ind = document.getElementById('typing-indicator');
        if (ind) ind.remove();

        var content = resp?.message?.content || resp?.content;
        if (content) {
          widgetState.messages.push({ role: 'assistant', content: content });
          addMessage('assistant', content, true);
        } else {
          throw new Error(t('error'));
        }
      })
      .catch(function(err) {
        var ind = document.getElementById('typing-indicator');
        if (ind) ind.remove();
        var errorBubble = addMessage('assistant', '❌ ' + (err.message || t('errorNetwork')), false);
        errorBubble.querySelector('.bubble-ai')?.classList.add('shake-error');
      })
      .finally(function() {
        widgetState.sending = false;
        sendBtn.disabled = false;
      });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      widgetState.messages = [];
      messagesArea.innerHTML = '';
      if (welcomeEl) {
        messagesArea.appendChild(welcomeEl);
        welcomeEl.style.display = 'flex';
      }
    });
  }

  // 绑定欢迎按钮事件 (使用 welcome-btn 类)
  var welcomeBtns = document.querySelectorAll('.welcome-btn');
  welcomeBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var example = btn.getAttribute('data-example');
      if (example) {
        input.value = example;
        doSend(example);
      }
    });
  });

  sendBtn.addEventListener('click', function() { doSend(); });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); doSend(); }
  });
}

// Widget 初始化入口
function initWidget() {
  var props = window._TAPP_WIDGET_PROPS || {};
  var size = props.size || '4x2';
  currentLocale = normalizeLocale(props.locale);

  if (size === '4x4') {
    init4x4Widget();
  } else {
    init4x2Widget();
  }
}

// ========================================
// Page 模式
// ========================================

var pageState = {
  messages: [],
  isLoading: false,
  settings: { saveHistory: true, maxHistory: 50, systemPrompt: '' }
};

async function loadPageData() {
  try {
    var saved = await Tapp.settings.getAll();
    if (saved) Object.assign(pageState.settings, saved);

    if (pageState.settings.saveHistory) {
      var history = await Tapp.storage.get('chat_history');
      if (history && Array.isArray(history)) {
        pageState.messages = history.slice(-pageState.settings.maxHistory);
      }
    }
  } catch (e) {}
}

async function saveHistory() {
  if (!pageState.settings.saveHistory) return;
  try {
    await Tapp.storage.set('chat_history', pageState.messages.slice(-pageState.settings.maxHistory));
  } catch (e) {}
}

// 更新状态胶囊显示
function updateStatusPill(state, data) {
  var pill = document.getElementById('status-pill');
  var titleEl = document.getElementById('status-title');
  var subtitleEl = document.getElementById('status-subtitle');
  var quickTopics = document.getElementById('quick-topics');
  
  if (!pill || !titleEl || !subtitleEl) return;
  
  switch (state) {
    case 'welcome':
      pill.classList.remove('thinking');
      titleEl.textContent = t('welcome');
      subtitleEl.textContent = t('welcomeSubtitle');
      if (quickTopics) quickTopics.classList.remove('hidden');
      break;
    case 'thinking':
      pill.classList.add('thinking');
      titleEl.textContent = t('thinking');
      subtitleEl.textContent = data?.userMsg ? '"' + data.userMsg.substring(0, 20) + (data.userMsg.length > 20 ? '...' : '') + '"' : '';
      if (quickTopics) quickTopics.classList.add('hidden');
      break;
    case 'chatting':
      pill.classList.remove('thinking');
      var msgCount = pageState.messages.length;
      titleEl.textContent = t('title');
      subtitleEl.textContent = msgCount + ' ' + t('messagesCount');
      if (quickTopics) quickTopics.classList.add('hidden');
      break;
    case 'error':
      pill.classList.remove('thinking');
      titleEl.textContent = t('error');
      subtitleEl.textContent = data?.message || t('errorNetwork');
      break;
  }
}

// SVG 图标
var userSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
var aiSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM7.5 13a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg>';

function createPageBubble(role, content, isTyping, useTypingEffect) {
  var row = document.createElement('div');
  row.className = 'msg-row ' + (role === 'user' ? 'msg-row-user' : 'msg-row-ai');

  var avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.innerHTML = role === 'user' ? userSvg : aiSvg;

  if (role === 'user') {
    avatar.classList.add('msg-avatar-user');
  } else {
    avatar.classList.add('msg-avatar-ai');
    if (isTyping || useTypingEffect) avatar.classList.add('avatar-thinking');
  }

  var bubble = document.createElement('div');
  bubble.className = 'bubble ' + (role === 'user' ? 'bubble-user' : 'bubble-ai');

  if (isTyping) {
    bubble.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
  } else if (role === 'user') {
    bubble.textContent = content;
  } else if (useTypingEffect) {
    setTimeout(function() {
      typeWriter(bubble, content, 12, function() {
        avatar.classList.remove('avatar-thinking');
        scrollToBottom();
      });
    }, 100);
  } else {
    bubble.innerHTML = formatMessage(content);
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  return row;
}

function scrollToBottom() {
  var area = document.getElementById('page-messages');
  if (area) {
    area.scrollTop = area.scrollHeight;
  }
}

function renderPageMessages() {
  var area = document.getElementById('page-messages');
  if (!area) return;

  area.innerHTML = '';

  if (pageState.messages.length === 0) {
    updateStatusPill('welcome');
  } else {
    updateStatusPill('chatting');
    pageState.messages.forEach(function(msg) {
      area.appendChild(createPageBubble(msg.role, msg.content));
    });
    setTimeout(scrollToBottom, 100);
  }
}

async function sendPageMessage(prefillText) {
  var input = document.getElementById('page-input');
  var sendBtn = document.getElementById('page-send');
  var area = document.getElementById('page-messages');
  var charCount = document.getElementById('char-count');

  if (!input || !sendBtn || !area) return;

  var text = prefillText || input.value.trim();
  if (!text || pageState.isLoading) return;

  if (sendBtn) sendBtn.classList.add('send-flying');
  setTimeout(function() { if (sendBtn) sendBtn.classList.remove('send-flying'); }, 300);

  pageState.messages.push({ role: 'user', content: text });
  input.value = '';
  input.style.height = 'auto';
  if (charCount) charCount.textContent = '0 / 2000';

  // 更新状态为思考中
  updateStatusPill('thinking', { userMsg: text });

  area.appendChild(createPageBubble('user', text));
  scrollToBottom();

  pageState.isLoading = true;
  sendBtn.disabled = true;

  var loading = createPageBubble('assistant', '', true);
  loading.id = 'page-loading';
  area.appendChild(loading);
  scrollToBottom();

  try {
    var msgs = pageState.messages.map(function(m) {
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
    });
    if (pageState.settings.systemPrompt) {
      msgs.unshift({ role: 'system', content: pageState.settings.systemPrompt });
    }

    var resp = await Tapp.ai.chat(msgs, {}, { maxTokens: 1500 });
    var loadEl = document.getElementById('page-loading');
    if (loadEl) loadEl.remove();

    var content = resp?.message?.content || resp?.content;
    if (content) {
      pageState.messages.push({ role: 'assistant', content: content });
      saveHistory();
      area.appendChild(createPageBubble('assistant', content, false, true));
      scrollToBottom();
      updateStatusPill('chatting');
    } else {
      throw new Error(t('errorFormat'));
    }
  } catch (err) {
    var loadEl = document.getElementById('page-loading');
    if (loadEl) loadEl.remove();

    var errorMsg = err.message || t('errorNetwork');
    pageState.messages.push({ role: 'assistant', content: '❌ ' + errorMsg });
    var errorBubble = createPageBubble('assistant', '❌ ' + errorMsg, false, false);
    errorBubble.querySelector('.bubble-ai')?.classList.add('shake-error');
    area.appendChild(errorBubble);
    
    updateStatusPill('error', { message: errorMsg });
    Tapp.ui.showNotification({ title: t('error'), message: errorMsg, type: 'error' });
  } finally {
    pageState.isLoading = false;
    sendBtn.disabled = false;
  }
}

function initPage() {
  var input = document.getElementById('page-input');
  var sendBtn = document.getElementById('page-send');
  var clearBtn = document.getElementById('page-clear');
  var charCount = document.getElementById('char-count');
  var quickTopics = document.getElementById('quick-topics');

  // 设置多语言文本
  if (input) input.placeholder = t('placeholder');
  if (sendBtn) sendBtn.title = t('send');
  if (clearBtn) clearBtn.title = t('newChat');

  // 动态生成快捷话题按钮
  var examples = t('examples');
  if (quickTopics && examples && examples.length) {
    quickTopics.innerHTML = '';
    examples.forEach(function(ex) {
      var btn = document.createElement('button');
      btn.className = 'topic-btn';
      btn.setAttribute('data-topic', ex.topic);
      btn.innerHTML = '<span class="topic-icon">' + ex.icon + '</span><span class="topic-text">' + ex.title + '</span>';
      btn.onclick = function() {
        if (input) input.value = ex.topic;
        sendPageMessage(ex.topic);
      };
      quickTopics.appendChild(btn);
    });
  }

  if (input) {
    input.oninput = function() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 160) + 'px';
      if (charCount) charCount.textContent = input.value.length + ' / 2000';
    };
    input.onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendPageMessage();
      }
    };
  }

  if (sendBtn) {
    sendBtn.onclick = function() { sendPageMessage(); };
  }

  if (clearBtn) {
    clearBtn.onclick = function() {
      pageState.messages = [];
      saveHistory();
      renderPageMessages();
    };
  }

  renderPageMessages();
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
        initPage();
      }
    });

    Tapp.lifecycle.onDestroy(async function() {
      await saveHistory();
    });
  }
})();
