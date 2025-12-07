// AI Chat Tapp v2.0 - 混合渲染模式
// 使用 HTML 模板 + CSS 类 + 最小 JS 交互

console.log('[AI Chat] v2.0 初始化...');

// ========== 国际化 ==========
var i18n = {
  'zh-CN': {
    widgetTitle: 'AI 助手',
    placeholder: '输入消息...',
    send: '发送',
    startChat: '开始对话',
    title: 'AI 聊天',
    subtitle: '智能对话助手',
    welcome: '你好！我是 AI 助手',
    welcomeSubtitle: '有什么可以帮助你的吗？',
    clearChat: '清空',
    sending: '思考中...',
    error: '出错了',
    errorNetwork: '网络错误，请重试',
    retry: '重试',
    copy: '复制',
    copied: '已复制',
    examples: ['解释人工智能', '写一首诗', '如何学编程', '推荐电影'],
    you: '你',
    ai: 'AI',
    newChat: '新对话',
    typing: '正在输入...',
  },
  'en-US': {
    widgetTitle: 'AI Assistant',
    placeholder: 'Type a message...',
    send: 'Send',
    startChat: 'Start chatting',
    title: 'AI Chat',
    subtitle: 'Smart conversation assistant',
    welcome: "Hello! I'm AI Assistant",
    welcomeSubtitle: 'How can I help you?',
    clearChat: 'Clear',
    sending: 'Thinking...',
    error: 'Error',
    errorNetwork: 'Network error, please retry',
    retry: 'Retry',
    copy: 'Copy',
    copied: 'Copied',
    examples: ['Explain AI', 'Write a poem', 'Learn coding', 'Movie tips'],
    you: 'You',
    ai: 'AI',
    newChat: 'New Chat',
    typing: 'Typing...',
  },
};

var currentLocale = 'zh-CN';
function normalizeLocale(locale) {
  if (!locale) return 'zh-CN';
  var l = locale.toLowerCase();
  if (l.startsWith('zh')) return 'zh-CN';
  return 'en-US';
}
function t(key) {
  return (i18n[currentLocale] || i18n['zh-CN'])[key] || key;
}

// ========== 工具函数 ==========
function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatMessage(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="tapp-code">$1</code>')
    .replace(/\n/g, '<br>');
}

// 打字机效果
function typeWriter(element, text, speed, scrollContainer, onComplete) {
  var i = 0;
  element.innerHTML = '';
  var cursor = document.createElement('span');
  cursor.className = 'tapp-cursor';
  cursor.textContent = '▌';
  element.appendChild(cursor);
  
  function type() {
    if (i < text.length) {
      cursor.remove();
      element.textContent = text.substring(0, i + 1);
      element.appendChild(cursor);
      i++;
      if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
      setTimeout(type, speed);
    } else {
      cursor.remove();
      if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
      if (onComplete) onComplete();
    }
  }
  type();
}

// ========== Widget 状态 ==========
var widgetState = {
  messages: [],
  sending: false
};

// ========== 4x2 Widget 逻辑 ==========
function init4x2Widget() {
  var userBar = document.getElementById('user-bar');
  var aiBar = document.getElementById('ai-bar');
  var input = document.getElementById('chat-input');
  var sendBtn = document.getElementById('send-btn');
  
  if (!input || !sendBtn) return;
  
  // 输入框焦点效果
  input.onfocus = function() { input.classList.add('focused'); };
  input.onblur = function() { input.classList.remove('focused'); };

  function showUserMsg(text) {
    userBar.textContent = text;
    userBar.classList.add('visible');
  }

  function showTyping() {
    aiBar.classList.add('visible');
    aiBar.innerHTML = '<div class="tapp-typing"><span class="tapp-typing-dot"></span><span class="tapp-typing-dot"></span><span class="tapp-typing-dot"></span></div>';
  }

  function showAiReply(text) {
    var display = text.length > 80 ? text.substring(0, 80) + '...' : text;
    aiBar.innerHTML = '';
    typeWriter(aiBar, display, 20);
  }

  function showError(msg) {
    aiBar.classList.add('error');
    aiBar.textContent = '❌ ' + msg;
  }

  function doSend() {
    var text = input.value.trim();
    if (!text || widgetState.sending) return;
    
    widgetState.sending = true;
    sendBtn.disabled = true;
    input.value = '';
    
    showUserMsg(text);
    setTimeout(showTyping, 200);

    Tapp.ai.chat([{ role: 'user', content: text }], {}, { maxTokens: 300 })
      .then(function(resp) {
        var msg = resp?.message || resp;
        if (msg?.content) {
          showAiReply(msg.content);
        } else {
          throw new Error(resp?.error || t('error'));
        }
      })
      .catch(function(err) {
        showError(err.message || t('error'));
      })
      .finally(function() {
        widgetState.sending = false;
        sendBtn.disabled = false;
      });
  }

  sendBtn.onclick = doSend;
  input.onkeydown = function(e) {
    if (e.key === 'Enter') { e.preventDefault(); doSend(); }
  };
}

// ========== 4x4 Widget 逻辑 ==========
function init4x4Widget() {
  var msgArea = document.getElementById('msg-area');
  var welcomeEl = document.getElementById('welcome-msg');
  var input = document.getElementById('chat-input');
  var sendBtn = document.getElementById('send-btn');
  var clearBtn = document.getElementById('clear-btn');
  
  if (!input || !sendBtn || !msgArea) return;
  
  // 输入框焦点效果
  input.onfocus = function() { input.classList.add('focused'); };
  input.onblur = function() { input.classList.remove('focused'); };

  function createBubble(role, content, useTypeEffect) {
    var row = document.createElement('div');
    row.className = 'tapp-bubble-row' + (role === 'user' ? ' tapp-bubble-row-user tapp-slide-in-right' : ' tapp-slide-in-left');
    
    var bubble = document.createElement('div');
    bubble.className = 'tapp-bubble ' + (role === 'user' ? 'tapp-bubble-user' : 'tapp-bubble-ai');
    
    if (useTypeEffect && role !== 'user') {
      typeWriter(bubble, content, 18, msgArea);
    } else {
      bubble.innerHTML = formatMessage(content);
    }
    
    row.appendChild(bubble);
    return row;
  }

  function createTypingIndicator() {
    var row = document.createElement('div');
    row.id = 'typing-indicator';
    row.className = 'tapp-bubble-row tapp-fade-in';
    row.innerHTML = '<div class="tapp-typing"><span class="tapp-typing-dot"></span><span class="tapp-typing-dot"></span><span class="tapp-typing-dot"></span></div>';
    return row;
  }

  function addMessage(role, content, useTypeEffect) {
    if (welcomeEl) welcomeEl.style.display = 'none';
    var bubble = createBubble(role, content, useTypeEffect);
    msgArea.appendChild(bubble);
    msgArea.scrollTop = msgArea.scrollHeight;
  }

  function doSend() {
    var text = input.value.trim();
    if (!text || widgetState.sending) return;
    
    widgetState.sending = true;
    sendBtn.disabled = true;
    input.value = '';
    
    widgetState.messages.push({ role: 'user', content: text });
    addMessage('user', text, false);
    
    var typing = createTypingIndicator();
    msgArea.appendChild(typing);
    msgArea.scrollTop = msgArea.scrollHeight;

    var chatMsgs = widgetState.messages.map(function(m) {
      return { role: m.role, content: m.content };
    });

    Tapp.ai.chat(chatMsgs, {}, { maxTokens: 500 })
      .then(function(resp) {
        var ind = document.getElementById('typing-indicator');
        if (ind) ind.remove();
        
        var msg = resp?.message || resp;
        if (msg?.content) {
          widgetState.messages.push({ role: 'assistant', content: msg.content });
          addMessage('assistant', msg.content, true);
        } else {
          throw new Error(resp?.error || t('error'));
        }
      })
      .catch(function(err) {
        var ind = document.getElementById('typing-indicator');
        if (ind) ind.remove();
        addMessage('assistant', '❌ ' + (err.message || t('error')), false);
      })
      .finally(function() {
        widgetState.sending = false;
        sendBtn.disabled = false;
      });
  }

  if (clearBtn) {
    clearBtn.onclick = function() {
      widgetState.messages = [];
      msgArea.innerHTML = '';
      if (welcomeEl) {
        welcomeEl.style.display = 'block';
        msgArea.appendChild(welcomeEl);
      }
    };
  }

  sendBtn.onclick = doSend;
  input.onkeydown = function(e) {
    if (e.key === 'Enter') { e.preventDefault(); doSend(); }
  };
}

// ========== Widget 初始化函数 ==========
function initWidget() {
  var props = window._TAPP_WIDGET_PROPS || {};
  currentLocale = normalizeLocale(props.locale);
  
  // 设置 placeholder 文本（JS 覆盖 HTML 默认值以支持多语言）
  var input = document.getElementById('chat-input');
  if (input) input.placeholder = t('placeholder');
  
  // 设置标题文本
  var title = document.getElementById('widget-title');
  if (title) title.textContent = t('widgetTitle');
  
  // 设置欢迎文本
  var welcome = document.getElementById('welcome-msg');
  if (welcome) welcome.textContent = t('startChat');
  
  // 根据尺寸初始化
  var size = props.size || '4x2';
  if (size === '4x2') {
    init4x2Widget();
  } else {
    init4x4Widget();
  }
  
  console.log('[AI Chat] Widget 初始化完成，尺寸:', size);
}

// ========== Widget 入口 ==========
// 通过生命周期钩子初始化，确保 SDK 和 DOM 都已就绪
Tapp.lifecycle.onReady(function() {
  if (window._TAPP_MODE !== 'widget') return;
  initWidget();
});


// ========== PAGE 逻辑 ==========
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
  } catch (e) {
    console.error('[AI Chat] 加载数据失败:', e);
  }
}

async function saveHistory() {
  if (!pageState.settings.saveHistory) return;
  try {
    await Tapp.storage.set('chat_history', pageState.messages.slice(-pageState.settings.maxHistory));
  } catch (e) {}
}

function createPageBubble(role, content) {
  var row = document.createElement('div');
  row.className = 'tapp-bubble-row-page' + (role === 'user' ? ' user' : '');
  
  var avatar = document.createElement('div');
  avatar.className = 'tapp-avatar';
  avatar.textContent = role === 'user' ? '👤' : '🤖';
  row.appendChild(avatar);
  
  var bubble = document.createElement('div');
  bubble.className = 'tapp-bubble-page' + (role === 'user' ? ' user' : '');
  bubble.innerHTML = formatMessage(content);
  row.appendChild(bubble);
  
  return row;
}

function renderPageMessages() {
  var area = document.getElementById('page-messages');
  var welcome = document.getElementById('page-welcome');
  if (!area) return;
  
  area.innerHTML = '';
  
  if (pageState.messages.length === 0) {
    if (welcome) welcome.style.display = 'flex';
  } else {
    if (welcome) welcome.style.display = 'none';
    pageState.messages.forEach(function(msg) {
      area.appendChild(createPageBubble(msg.role, msg.content));
    });
    setTimeout(function() { area.scrollTop = area.scrollHeight; }, 50);
  }
}

async function sendPageMessage() {
  var input = document.getElementById('page-input');
  var sendBtn = document.getElementById('page-send');
  var area = document.getElementById('page-messages');
  var welcome = document.getElementById('page-welcome');
  
  if (!input || !sendBtn || !area) return;
  
  var text = input.value.trim();
  if (!text || pageState.isLoading) return;
  
  pageState.messages.push({ role: 'user', content: text });
  input.value = '';
  if (welcome) welcome.style.display = 'none';
  area.appendChild(createPageBubble('user', text));
  area.scrollTop = area.scrollHeight;
  
  pageState.isLoading = true;
  sendBtn.disabled = true;
  
  // 显示加载
  var loading = document.createElement('div');
  loading.id = 'page-loading';
  loading.className = 'tapp-bubble-row-page';
  loading.innerHTML = '<div class="tapp-avatar">🤖</div><div class="tapp-bubble-page"><div class="tapp-typing"><span class="tapp-typing-dot"></span><span class="tapp-typing-dot"></span><span class="tapp-typing-dot"></span></div></div>';
  area.appendChild(loading);
  area.scrollTop = area.scrollHeight;
  
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
    
    var aiMsg = resp?.message || resp;
    if (aiMsg?.content) {
      pageState.messages.push({ role: 'assistant', content: aiMsg.content });
      saveHistory();
      area.appendChild(createPageBubble('assistant', aiMsg.content));
      area.scrollTop = area.scrollHeight;
    } else {
      throw new Error(resp?.error || 'No content');
    }
  } catch (err) {
    var loadEl = document.getElementById('page-loading');
    if (loadEl) loadEl.remove();
    
    pageState.messages.push({ role: 'assistant', content: '❌ ' + (err.message || t('errorNetwork')) });
    area.appendChild(createPageBubble('assistant', '❌ ' + err.message));
    
    Tapp.ui.showNotification({ title: t('error'), message: err.message, type: 'error' });
  } finally {
    pageState.isLoading = false;
    sendBtn.disabled = false;
  }
}

function initPage() {
  var input = document.getElementById('page-input');
  var sendBtn = document.getElementById('page-send');
  var clearBtn = document.getElementById('page-clear');
  var exampleBtns = document.querySelectorAll('.example-btn');
  
  if (input) {
    input.placeholder = t('placeholder');
    input.oninput = function() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 150) + 'px';
    };
    input.onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendPageMessage();
      }
    };
  }
  
  if (sendBtn) {
    sendBtn.onclick = sendPageMessage;
    var sendLabel = sendBtn.querySelector('.send-label');
    if (sendLabel) sendLabel.textContent = t('send');
  }
  
  if (clearBtn) {
    clearBtn.textContent = t('newChat');
    clearBtn.onclick = function() {
      pageState.messages = [];
      saveHistory();
      renderPageMessages();
    };
  }
  
  // 设置示例按钮
  var examples = t('examples');
  exampleBtns.forEach(function(btn, i) {
    if (examples[i]) {
      btn.textContent = examples[i];
      btn.onclick = function() {
        if (input) { input.value = examples[i]; input.focus(); }
      };
    }
  });
  
  // 设置标题
  var titleEl = document.getElementById('page-title');
  var subtitleEl = document.getElementById('page-subtitle');
  var welcomeTitle = document.getElementById('welcome-title');
  var welcomeSub = document.getElementById('welcome-subtitle');
  
  if (titleEl) titleEl.textContent = t('title');
  if (subtitleEl) subtitleEl.textContent = t('subtitle');
  if (welcomeTitle) welcomeTitle.textContent = t('welcome');
  if (welcomeSub) welcomeSub.textContent = t('welcomeSubtitle');
  
  renderPageMessages();
  console.log('[AI Chat] Page 初始化完成');
}

// Page 生命周期
Tapp.lifecycle.onReady(async function() {
  if (window._TAPP_MODE !== 'page') return;
  
  console.log('[AI Chat] Page onReady');
  
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
    console.error('[AI Chat] Page 初始化失败:', err);
    initPage();
  }
});

Tapp.lifecycle.onDestroy(async function() {
  if (window._TAPP_MODE === 'page') {
    await saveHistory();
  }
});

console.log('[AI Chat] v2.0 已加载');
