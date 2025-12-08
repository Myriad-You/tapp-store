// AI Chat Tapp v3.0 - 完全重构版本
// 符合最新 Tapp 开发标准（2025-12-08）
// 使用混合渲染模式：HTML 模板 + JS 事件绑定

console.log('[AI Chat] v3.0 初始化...');

// ========================================
// 核心工具函数（Widget + Page 共用）
// ========================================

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
    examples: ['解释人工智能', '写一首诗', '如何学编程', '推荐电影'],
    you: '你',
    ai: 'AI',
    newChat: '新对话',
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
    examples: ['Explain AI', 'Write a poem', 'Learn coding', 'Movie tips'],
    you: 'You',
    ai: 'AI',
    newChat: 'New Chat',
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
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-sm font-mono">$1</code>')
    .replace(/\n/g, '<br>');
}

// ========================================
// Widget 模式代码（混合渲染）
// ========================================

var widgetState = {
  messages: [],
  sending: false,
};

// 检测当前 Widget 尺寸
function detectWidgetSize() {
  var props = window._TAPP_WIDGET_PROPS || {};
  return props.size || '4x2';
}

// 4x2 Widget 事件绑定
function init4x2Widget() {
  var input = document.getElementById('widget-input');
  var sendBtn = document.getElementById('widget-send');
  var userMsgBar = document.getElementById('user-msg-bar');
  var userMsgContent = document.getElementById('user-msg-content');
  var aiReplyBar = document.getElementById('ai-reply-bar');
  var aiReplyContent = document.getElementById('ai-reply-content');
  var titleEl = document.getElementById('widget-title');
  var glowEl = document.getElementById('widget-glow');

  if (!input || !sendBtn) {
    console.error('[AI Chat] 4x2 Widget 元素未找到');
    return;
  }

  // 设置主题色光晕
  var props = window._TAPP_WIDGET_PROPS || {};
  if (glowEl && props.primaryColor) {
    glowEl.style.backgroundColor = props.primaryColor;
  }

  // 设置标题
  if (titleEl) titleEl.textContent = t('widgetTitle');
  if (input) input.placeholder = t('placeholder');

  function showUserMsg(text) {
    if (userMsgContent) userMsgContent.textContent = text;
    if (userMsgBar) {
      userMsgBar.classList.remove('opacity-0', '-translate-y-2');
      userMsgBar.classList.add('opacity-100', 'translate-y-0');
    }
  }

  function showAiReply(text) {
    var display = text.length > 100 ? text.substring(0, 100) + '...' : text;
    if (aiReplyContent) aiReplyContent.textContent = display;
    if (aiReplyBar) {
      aiReplyBar.classList.remove('opacity-0', 'translate-y-2');
      aiReplyBar.classList.add('opacity-100', 'translate-y-0');
    }
  }

  function showTyping() {
    if (aiReplyContent) {
      aiReplyContent.innerHTML = '<span class="animate-pulse">💭 ' + t('sending') + '</span>';
    }
    if (aiReplyBar) {
      aiReplyBar.classList.remove('opacity-0', 'translate-y-2');
      aiReplyBar.classList.add('opacity-100', 'translate-y-0');
    }
  }

  function showError(msg) {
    if (aiReplyContent) {
      aiReplyContent.innerHTML = '<span class="text-red-500">❌ ' + msg + '</span>';
    }
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
        if (resp && resp.message && resp.message.content) {
          showAiReply(resp.message.content);
        } else if (resp && resp.content) {
          showAiReply(resp.content);
        } else {
          throw new Error(t('error'));
        }
      })
      .catch(function(err) {
        console.error('[AI Chat] Widget error:', err);
        showError(err.message || t('errorNetwork'));
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

  console.log('[AI Chat] 4x2 Widget 初始化完成');
}

// 4x4 Widget 事件绑定
function init4x4Widget() {
  var input = document.getElementById('widget-input');
  var sendBtn = document.getElementById('widget-send');
  var clearBtn = document.getElementById('widget-clear');
  var messagesArea = document.getElementById('widget-messages');
  var welcomeEl = document.getElementById('widget-welcome');
  var welcomeText = document.getElementById('welcome-text');
  var titleEl = document.getElementById('widget-title');
  var glowEl = document.getElementById('widget-glow');

  if (!input || !sendBtn || !messagesArea) {
    console.error('[AI Chat] 4x4 Widget 元素未找到');
    return;
  }

  // 设置主题色光晕
  var props = window._TAPP_WIDGET_PROPS || {};
  if (glowEl && props.primaryColor) {
    glowEl.style.backgroundColor = props.primaryColor;
  }

  // 设置文本
  if (titleEl) titleEl.textContent = t('widgetTitle');
  if (input) input.placeholder = t('placeholder');
  if (clearBtn) clearBtn.textContent = t('clearChat');
  if (welcomeText) welcomeText.textContent = t('startChat');

  function createBubble(role, content) {
    var bubble = document.createElement('div');
    bubble.className = 'flex items-start gap-2 animate-fade-in';
    if (role === 'user') bubble.classList.add('flex-row-reverse');

    var avatar = document.createElement('div');
    avatar.className = 'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs';

    if (role === 'user') {
      avatar.className += ' bg-indigo-500 text-white';
      avatar.textContent = '👤';
    } else {
      avatar.className += ' bg-neutral-200 dark:bg-neutral-700';
      avatar.textContent = '🤖';
    }

    var message = document.createElement('div');
    message.className = 'px-3 py-2 rounded-lg max-w-[75%] break-words text-sm';

    if (role === 'user') {
      message.className += ' bg-indigo-500 text-white';
      message.textContent = content;
    } else {
      message.className += ' bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm text-neutral-700 dark:text-neutral-200';
      message.innerHTML = formatMessage(content);
    }

    bubble.appendChild(avatar);
    bubble.appendChild(message);
    return bubble;
  }

  function createTypingIndicator() {
    var indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'flex items-start gap-2';
    indicator.innerHTML = 
      '<div class="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs">🤖</div>' +
      '<div class="px-3 py-2 rounded-lg bg-white/60 dark:bg-white/[0.03]">' +
        '<div class="loading-dots"><span></span><span></span><span></span></div>' +
      '</div>';
    return indicator;
  }

  function addMessage(role, content) {
    if (welcomeEl) welcomeEl.style.display = 'none';
    var bubble = createBubble(role, content);
    messagesArea.appendChild(bubble);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  function doSend() {
    var text = input.value.trim();
    if (!text || widgetState.sending) return;

    widgetState.sending = true;
    sendBtn.disabled = true;
    input.value = '';

    widgetState.messages.push({ role: 'user', content: text });
    addMessage('user', text);

    var typing = createTypingIndicator();
    messagesArea.appendChild(typing);
    messagesArea.scrollTop = messagesArea.scrollHeight;

    var chatMsgs = widgetState.messages.map(function(m) {
      return { role: m.role, content: m.content };
    });

    Tapp.ai.chat(chatMsgs, {}, { maxTokens: 500 })
      .then(function(resp) {
        var ind = document.getElementById('typing-indicator');
        if (ind) ind.remove();

        var content = null;
        if (resp && resp.message && resp.message.content) {
          content = resp.message.content;
        } else if (resp && resp.content) {
          content = resp.content;
        }

        if (content) {
          widgetState.messages.push({ role: 'assistant', content: content });
          addMessage('assistant', content);
        } else {
          throw new Error(t('error'));
        }
      })
      .catch(function(err) {
        console.error('[AI Chat] 4x4 Widget error:', err);
        var ind = document.getElementById('typing-indicator');
        if (ind) ind.remove();
        addMessage('assistant', '❌ ' + (err.message || t('errorNetwork')));
      })
      .finally(function() {
        widgetState.sending = false;
        sendBtn.disabled = false;
      });
  }

  if (clearBtn) {
    clearBtn.onclick = function() {
      widgetState.messages = [];
      messagesArea.innerHTML = '';
      if (welcomeEl) {
        messagesArea.appendChild(welcomeEl);
        welcomeEl.style.display = 'flex';
      }
    };
  }

  sendBtn.onclick = doSend;
  input.onkeydown = function(e) {
    if (e.key === 'Enter') { e.preventDefault(); doSend(); }
  };

  console.log('[AI Chat] 4x4 Widget 初始化完成');
}

// Widget 初始化入口
function initWidget() {
  var size = detectWidgetSize();
  console.log('[AI Chat] 初始化 Widget，尺寸:', size);

  // 获取语言设置
  var props = window._TAPP_WIDGET_PROPS || {};
  currentLocale = normalizeLocale(props.locale);

  if (size === '4x4') {
    init4x4Widget();
  } else {
    init4x2Widget();
  }
}

// ========================================
// Page 模式代码
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
  row.className = 'flex items-start gap-3 animate-fade-in';
  if (role === 'user') row.className += ' flex-row-reverse';

  var avatar = document.createElement('div');
  avatar.className = 'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center';
  avatar.textContent = role === 'user' ? '👤' : '🤖';

  if (role === 'user') {
    avatar.className += ' bg-indigo-600 text-white';
  } else {
    avatar.className += ' bg-neutral-100 dark:bg-neutral-800';
  }

  var bubble = document.createElement('div');
  bubble.className = 'px-4 py-3 rounded-xl max-w-[75%] break-words';

  if (role === 'user') {
    bubble.className += ' bg-indigo-600 text-white';
    bubble.textContent = content;
  } else {
    bubble.className += ' bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700';
    bubble.innerHTML = formatMessage(content);
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  return row;
}

function renderPageMessages() {
  var area = document.getElementById('page-messages');
  var welcome = document.getElementById('page-welcome');
  if (!area) return;

  // 清除现有消息（保留欢迎界面）
  var children = Array.from(area.children);
  children.forEach(function(child) {
    if (child.id !== 'page-welcome') {
      child.remove();
    }
  });

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
  input.style.height = 'auto';
  if (welcome) welcome.style.display = 'none';
  area.appendChild(createPageBubble('user', text));
  area.scrollTop = area.scrollHeight;

  pageState.isLoading = true;
  sendBtn.disabled = true;

  // 显示加载
  var loading = document.createElement('div');
  loading.id = 'page-loading';
  loading.className = 'flex items-start gap-3';
  loading.innerHTML = 
    '<div class="flex-shrink-0 w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">🤖</div>' +
    '<div class="px-4 py-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">' +
      '<div class="loading-dots"><span></span><span></span><span></span></div>' +
    '</div>';
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

    var content = null;
    if (resp && resp.message && resp.message.content) {
      content = resp.message.content;
    } else if (resp && resp.content) {
      content = resp.content;
    }

    if (content) {
      pageState.messages.push({ role: 'assistant', content: content });
      saveHistory();
      area.appendChild(createPageBubble('assistant', content));
      area.scrollTop = area.scrollHeight;
    } else {
      throw new Error('AI 响应格式错误');
    }
  } catch (err) {
    console.error('[AI Chat] Page error:', err);
    var loadEl = document.getElementById('page-loading');
    if (loadEl) loadEl.remove();

    var errorMsg = err.message || t('errorNetwork');
    pageState.messages.push({ role: 'assistant', content: '❌ ' + errorMsg });
    area.appendChild(createPageBubble('assistant', '❌ ' + errorMsg));

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
      var span = btn.querySelector('span');
      if (span) span.textContent = examples[i];
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

// ========================================
// 生命周期入口
// ========================================

// 检测运行模式并初始化
(function() {
  var mode = window._TAPP_MODE;
  var hasHtml = window._TAPP_HAS_HTML;

  console.log('[AI Chat] 运行模式:', mode, '有 HTML 模板:', hasHtml);

  if (mode === 'widget') {
    // Widget 模式：等待 DOM 加载完成后初始化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWidget);
    } else {
      // DOM 已加载，延迟一帧确保元素渲染
      setTimeout(initWidget, 0);
    }
  } else if (mode === 'page' || hasHtml) {
    // Page 模式：使用 Tapp.lifecycle.onReady
    Tapp.lifecycle.onReady(async function() {
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
      await saveHistory();
    });
  }
})();

console.log('[AI Chat] v3.0 已加载');
