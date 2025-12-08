// AI Chat Tapp v3.0 - 完全重构版本
// 符合最新 Tapp 开发标准（2025-12-08）

console.log('[AI Chat] v3.0 初始化...');

// ========================================
// CORE_CODE - 核心工具函数（Widget + Page 共用）
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
// WIDGET_CODE - 小组件渲染代码
// ========================================

// Widget 状态（独立于 Page）
var widgetState = {
  messages: [],
  sending: false,
};

// 渲染光晕背景
function renderGlow(color, position, size) {
  var sizes = { sm: '6rem', md: '8rem', lg: '12rem' };
  var positions = {
    right: 'right: -2rem; top: -2rem;',
    left: 'left: -1.5rem; bottom: -1.5rem;',
  };

  return `<div style="
    position: absolute;
    ${positions[position] || positions.right}
    width: ${sizes[size] || sizes.md};
    height: ${sizes[size] || sizes.md};
    border-radius: 9999px;
    background: ${color};
    filter: blur(64px);
    opacity: 0.1;
    pointer-events: none;
  "></div>`;
}

// 4x2 Widget - 紧凑对话模式
function render4x2Widget(container, props) {
  var scale = props.scale || 1;
  var fontScale = props.fontScale || 1;
  var themeColor = props.primaryColor || '#8b5cf6';

  container.innerHTML = `
    <div class="relative h-full w-full rounded-xl overflow-hidden glass">
      ${renderGlow(themeColor, 'right', 'md')}

      <!-- 渐变装饰层 -->
      <div class="absolute inset-0 bg-gradient-to-br from-neutral-50/50 to-transparent dark:from-white/[0.02] dark:to-transparent"></div>

      <!-- 内容层 -->
      <div class="relative h-full flex flex-col" style="padding: ${12 * scale}px;">
        <!-- 顶部标题 -->
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-bold"
              style="font-size: ${12 * fontScale}px;">
            ${t('widgetTitle')}
          </h3>
          <span class="text-lg" style="font-size: ${18 * scale}px;">🤖</span>
        </div>

        <!-- 用户消息栏（动态显示） -->
        <div id="user-msg-bar" class="mb-2 opacity-0 transition-all duration-300 transform translate-y-[-8px]"
             style="max-height: ${32 * scale}px; font-size: ${12 * fontScale}px;">
          <div class="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-right truncate"
               style="padding: ${6 * scale}px ${12 * scale}px;">
          </div>
        </div>

        <!-- AI回复栏（动态显示） -->
        <div id="ai-reply-bar" class="flex-1 flex items-center mb-2 opacity-0 transition-all duration-300 transform translate-y-2">
          <div class="w-full px-3 py-2 rounded-lg bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm"
               style="padding: ${8 * scale}px ${12 * scale}px; font-size: ${13 * fontScale}px; min-height: ${40 * scale}px;">
            <span class="text-neutral-600 dark:text-neutral-400"></span>
          </div>
        </div>

        <!-- 底部输入栏 -->
        <div class="flex items-center gap-2" style="gap: ${8 * scale}px;">
          <input type="text"
                 id="widget-input-4x2"
                 placeholder="${t('placeholder')}"
                 autocomplete="off"
                 class="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700
                        text-neutral-800 dark:text-neutral-100 placeholder-neutral-400
                        focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                 style="padding: ${8 * scale}px ${12 * scale}px; font-size: ${14 * fontScale}px;">
          <button id="widget-send-4x2"
                  class="flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-700
                         text-white transition-transform hover:scale-110 active:scale-95"
                  style="width: ${40 * scale}px; height: ${40 * scale}px;">
            <svg width="${16 * scale}" height="${16 * scale}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      </div>

      ${props.isEditMode ? `<div class="absolute inset-0 border-2 border-dashed border-blue-400 rounded-xl pointer-events-none"></div>` : ''}
    </div>
  `;

  // 绑定事件
  var input = container.querySelector('#widget-input-4x2');
  var sendBtn = container.querySelector('#widget-send-4x2');
  var userMsgBar = container.querySelector('#user-msg-bar');
  var aiReplyBar = container.querySelector('#ai-reply-bar');

  if (!input || !sendBtn) return;

  function showUserMsg(text) {
    var msgEl = userMsgBar.querySelector('div');
    if (msgEl) {
      msgEl.textContent = text;
      userMsgBar.classList.remove('opacity-0', 'translate-y-[-8px]');
      userMsgBar.classList.add('opacity-100', 'translate-y-0');
    }
  }

  function showAiReply(text) {
    var msgEl = aiReplyBar.querySelector('span');
    if (msgEl) {
      var display = text.length > 100 ? text.substring(0, 100) + '...' : text;
      msgEl.textContent = display;
      aiReplyBar.classList.remove('opacity-0', 'translate-y-2');
      aiReplyBar.classList.add('opacity-100', 'translate-y-0');
    }
  }

  function showTyping() {
    aiReplyBar.querySelector('span').innerHTML = '<span class="animate-pulse">💭 ' + t('sending') + '</span>';
    aiReplyBar.classList.remove('opacity-0', 'translate-y-2');
    aiReplyBar.classList.add('opacity-100', 'translate-y-0');
  }

  function showError(msg) {
    aiReplyBar.querySelector('span').innerHTML = '<span class="text-red-500">❌ ' + msg + '</span>';
    aiReplyBar.classList.remove('opacity-0', 'translate-y-2');
    aiReplyBar.classList.add('opacity-100', 'translate-y-0');
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
}

// 4x4 Widget - 完整对话模式
function render4x4Widget(container, props) {
  var scale = props.scale || 1;
  var fontScale = props.fontScale || 1;
  var themeColor = props.primaryColor || '#8b5cf6';

  container.innerHTML = `
    <div class="relative h-full w-full rounded-xl overflow-hidden glass flex flex-col">
      ${renderGlow(themeColor, 'right', 'lg')}

      <!-- 渐变装饰层 -->
      <div class="absolute inset-0 bg-gradient-to-br from-neutral-50/50 to-transparent dark:from-white/[0.02] dark:to-transparent"></div>

      <!-- 内容层 -->
      <div class="relative h-full flex flex-col" style="padding: ${12 * scale}px;">
        <!-- 顶部栏 -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2" style="gap: ${8 * scale}px;">
            <span class="text-2xl" style="font-size: ${24 * scale}px;">🤖</span>
            <h3 class="text-sm font-bold text-neutral-700 dark:text-neutral-200"
                style="font-size: ${14 * fontScale}px;">
              ${t('widgetTitle')}
            </h3>
          </div>
          <button id="widget-clear-4x4"
                  class="px-2 py-1 text-xs rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200
                         dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 transition-colors"
                  style="padding: ${4 * scale}px ${8 * scale}px; font-size: ${11 * fontScale}px;">
            ${t('clearChat')}
          </button>
        </div>

        <!-- 消息区域 -->
        <div id="widget-messages-4x4" class="flex-1 overflow-y-auto overflow-x-hidden mb-3 space-y-2"
             style="margin-bottom: ${12 * scale}px;">
          <!-- 欢迎消息 -->
          <div id="widget-welcome-4x4" class="flex flex-col items-center justify-center h-full text-center">
            <span class="text-3xl mb-3" style="font-size: ${32 * scale}px; margin-bottom: ${12 * scale}px;">💬</span>
            <p class="text-neutral-500 dark:text-neutral-400"
               style="font-size: ${13 * fontScale}px;">
              ${t('startChat')}
            </p>
          </div>
        </div>

        <!-- 底部输入栏 -->
        <div class="flex items-center gap-2" style="gap: ${8 * scale}px;">
          <input type="text"
                 id="widget-input-4x4"
                 placeholder="${t('placeholder')}"
                 autocomplete="off"
                 class="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700
                        text-neutral-800 dark:text-neutral-100 placeholder-neutral-400
                        focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                 style="padding: ${8 * scale}px ${12 * scale}px; font-size: ${14 * fontScale}px;">
          <button id="widget-send-4x4"
                  class="flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-700
                         text-white transition-transform hover:scale-110 active:scale-95"
                  style="width: ${40 * scale}px; height: ${40 * scale}px;">
            <svg width="${16 * scale}" height="${16 * scale}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      </div>

      ${props.isEditMode ? `<div class="absolute inset-0 border-2 border-dashed border-blue-400 rounded-xl pointer-events-none"></div>` : ''}
    </div>
  `;

  // 绑定事件
  var input = container.querySelector('#widget-input-4x4');
  var sendBtn = container.querySelector('#widget-send-4x4');
  var clearBtn = container.querySelector('#widget-clear-4x4');
  var messagesArea = container.querySelector('#widget-messages-4x4');
  var welcomeEl = container.querySelector('#widget-welcome-4x4');

  if (!input || !sendBtn || !messagesArea) return;

  function createBubble(role, content) {
    var bubble = document.createElement('div');
    bubble.className = 'flex items-start gap-2 animate-fade-in';
    if (role === 'user') bubble.classList.add('flex-row-reverse');

    var avatar = document.createElement('div');
    avatar.className = 'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs';
    avatar.style.width = (24 * scale) + 'px';
    avatar.style.height = (24 * scale) + 'px';
    avatar.style.fontSize = (12 * scale) + 'px';

    if (role === 'user') {
      avatar.className += ' bg-indigo-500 text-white';
      avatar.textContent = '👤';
    } else {
      avatar.className += ' bg-neutral-200 dark:bg-neutral-700';
      avatar.textContent = '🤖';
    }

    var message = document.createElement('div');
    message.className = 'px-3 py-2 rounded-lg max-w-[75%] break-words';
    message.style.padding = (8 * scale) + 'px ' + (12 * scale) + 'px';
    message.style.fontSize = (13 * fontScale) + 'px';

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
    indicator.innerHTML = `
      <div class="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs"
           style="width: ${24 * scale}px; height: ${24 * scale}px; font-size: ${12 * scale}px;">🤖</div>
      <div class="px-3 py-2 rounded-lg bg-white/60 dark:bg-white/[0.03]"
           style="padding: ${8 * scale}px ${12 * scale}px;">
        <div class="flex gap-1">
          <span class="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style="animation-delay: 0ms"></span>
          <span class="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style="animation-delay: 150ms"></span>
          <span class="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style="animation-delay: 300ms"></span>
        </div>
      </div>
    `;
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

        var msg = resp?.message || resp;
        if (msg?.content) {
          widgetState.messages.push({ role: 'assistant', content: msg.content });
          addMessage('assistant', msg.content);
        } else {
          throw new Error(resp?.error || t('error'));
        }
      })
      .catch(function(err) {
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
}

// Widget 主渲染函数
Tapp.widgets['ai-chat'] = {
  render: function(container, props) {
    currentLocale = normalizeLocale(props.locale);

    var size = props.size || '4x2';
    if (size === '4x2') {
      render4x2Widget(container, props);
    } else if (size === '4x4') {
      render4x4Widget(container, props);
    } else {
      // 其他尺寸默认使用 4x2
      render4x2Widget(container, props);
    }

    console.log('[AI Chat] Widget 渲染完成，尺寸:', size);
  },
};

// ========================================
// PAGE_CODE - 完整页面代码
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
  loading.innerHTML = `
    <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">🤖</div>
    <div class="px-4 py-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
      <div class="flex gap-1.5">
        <span class="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style="animation-delay: 0ms"></span>
        <span class="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style="animation-delay: 150ms"></span>
        <span class="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style="animation-delay: 300ms"></span>
      </div>
    </div>
  `;
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

console.log('[AI Chat] v3.0 已加载');
