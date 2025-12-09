// AI Chat Tapp v6.0 - 重构版
// 语义化 CSS · 优雅动效 · 精简代码
// 2025-12-09

// ========================================
// 国际化
// ========================================

var i18n = {
  'zh-CN': {
    widgetTitle: '对话',
    placeholder: '输入...',
    send: '发送',
    title: '对话',
    welcome: '开始对话',
    welcomeSubtitle: '选择话题或直接输入',
    clearChat: '新对话',
    thinking: '思考中...',
    error: '出错了',
    errorNetwork: '网络错误',
    examples: [
      { icon: '💡', title: '解释概念' },
      { icon: '✍️', title: '写一首诗' },
      { icon: '💻', title: '学编程' },
      { icon: '🎬', title: '推荐电影' }
    ],
  },
  'en-US': {
    widgetTitle: 'Chat',
    placeholder: 'Type...',
    send: 'Send',
    title: 'Chat',
    welcome: 'Start chatting',
    welcomeSubtitle: 'Pick a topic or ask',
    clearChat: 'New',
    thinking: 'Thinking...',
    error: 'Error',
    errorNetwork: 'Network error',
    examples: [
      { icon: '💡', title: 'Explain' },
      { icon: '✍️', title: 'Write poem' },
      { icon: '💻', title: 'Learn code' },
      { icon: '🎬', title: 'Movies' }
    ],
  },
};

var currentLocale = 'zh-CN';

function normalizeLocale(locale) {
  if (!locale) return 'zh-CN';
  return locale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
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
// 4x2 Widget
// ========================================

function init4x2Widget() {
  var input = document.getElementById('widget-input');
  var sendBtn = document.getElementById('widget-send');
  var sendIcon = document.getElementById('send-icon');
  var userMsgBar = document.getElementById('user-msg-bar');
  var userMsgContent = document.getElementById('user-msg-content');
  var aiReplyBar = document.getElementById('ai-reply-bar');
  var aiReplyContent = document.getElementById('ai-reply-content');
  var welcomeEl = document.getElementById('widget-welcome');
  var avatarEl = document.getElementById('ai-avatar');

  if (!input || !sendBtn) return;

  if (input) input.placeholder = t('placeholder');

  function showUserMsg(text) {
    if (welcomeEl) welcomeEl.style.display = 'none';
    if (userMsgContent) userMsgContent.textContent = text;
    if (userMsgBar) userMsgBar.classList.add('show');
  }

  function showAiReply(text) {
    if (aiReplyBar) aiReplyBar.classList.add('show');
    if (aiReplyContent) {
      typeWriterFast(aiReplyContent, text, function() {
        if (avatarEl) avatarEl.classList.remove('avatar-thinking');
      });
    }
  }

  function showThinking() {
    if (aiReplyContent) {
      aiReplyContent.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
    }
    if (aiReplyBar) aiReplyBar.classList.add('show');
    if (avatarEl) avatarEl.classList.add('avatar-thinking');
  }

  function showError(msg) {
    if (aiReplyContent) {
      aiReplyContent.innerHTML = '<span style="color:var(--ai-error)">❌ ' + escapeHtml(msg) + '</span>';
      aiReplyContent.parentElement.classList.add('shake-error');
      setTimeout(function() { aiReplyContent.parentElement.classList.remove('shake-error'); }, 400);
    }
    if (avatarEl) avatarEl.classList.remove('avatar-thinking');
  }

  function animateSend() {
    if (sendBtn) sendBtn.classList.add('send-flying');
    setTimeout(function() { if (sendBtn) sendBtn.classList.remove('send-flying'); }, 300);
  }

  function doSend() {
    var text = input.value.trim();
    if (!text || widgetState.sending) return;

    widgetState.sending = true;
    sendBtn.disabled = true;
    input.value = '';

    animateSend();
    showUserMsg(text);
    setTimeout(showThinking, 200);

    Tapp.ai.chat([{ role: 'user', content: text }], {}, { maxTokens: 300 })
      .then(function(resp) {
        var content = resp?.message?.content || resp?.content;
        if (content) {
          showAiReply(content);
        } else {
          throw new Error(t('error'));
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
  var quickBtns = document.querySelectorAll('.quick-btn');

  if (!input || !sendBtn || !messagesArea) return;

  if (titleEl) titleEl.textContent = t('widgetTitle');
  if (input) input.placeholder = t('placeholder');

  function createBubble(role, content, isTyping, useTypingEffect) {
    var row = document.createElement('div');
    row.className = 'msg-row ' + (role === 'user' ? 'msg-row-user' : 'msg-row-ai');

    var avatar = document.createElement('div');
    avatar.className = 'msg-avatar gradient-bg';
    avatar.textContent = role === 'user' ? '👤' : '🤖';
    if (role !== 'user') {
      avatar.classList.remove('gradient-bg');
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
    clearBtn.onclick = function() {
      widgetState.messages = [];
      messagesArea.innerHTML = '';
      if (welcomeEl) {
        messagesArea.appendChild(welcomeEl);
        welcomeEl.style.display = 'flex';
      }
    };
  }

  quickBtns.forEach(function(btn) {
    btn.onclick = function() {
      var example = btn.getAttribute('data-example');
      if (example) {
        input.value = example;
        doSend(example);
      }
    };
  });

  sendBtn.onclick = function() { doSend(); };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') { e.preventDefault(); doSend(); }
  };
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

function createPageBubble(role, content, isTyping, useTypingEffect) {
  var row = document.createElement('div');
  row.className = 'msg-row ' + (role === 'user' ? 'msg-row-user' : 'msg-row-ai');

  var avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'user' ? '👤' : '🤖';

  if (role === 'user') {
    avatar.classList.add('gradient-bg', 'msg-avatar-user');
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
      });
    }, 100);
  } else {
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

  var children = Array.from(area.children);
  children.forEach(function(child) {
    if (child.id !== 'page-welcome') child.remove();
  });

  if (pageState.messages.length === 0) {
    if (welcome) welcome.style.display = 'flex';
  } else {
    if (welcome) welcome.style.display = 'none';
    pageState.messages.forEach(function(msg) {
      area.appendChild(createPageBubble(msg.role, msg.content));
    });
    setTimeout(function() { area.scrollTop = area.scrollHeight; }, 100);
  }
}

async function sendPageMessage(prefillText) {
  var input = document.getElementById('page-input');
  var sendBtn = document.getElementById('page-send');
  var area = document.getElementById('page-messages');
  var welcome = document.getElementById('page-welcome');
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

  if (welcome) welcome.style.display = 'none';
  area.appendChild(createPageBubble('user', text));
  area.scrollTop = area.scrollHeight;

  pageState.isLoading = true;
  sendBtn.disabled = true;

  var loading = createPageBubble('assistant', '', true);
  loading.id = 'page-loading';
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

    var content = resp?.message?.content || resp?.content;
    if (content) {
      pageState.messages.push({ role: 'assistant', content: content });
      saveHistory();
      area.appendChild(createPageBubble('assistant', content, false, true));
      area.scrollTop = area.scrollHeight;
    } else {
      throw new Error('AI 响应格式错误');
    }
  } catch (err) {
    var loadEl = document.getElementById('page-loading');
    if (loadEl) loadEl.remove();

    var errorMsg = err.message || t('errorNetwork');
    pageState.messages.push({ role: 'assistant', content: '❌ ' + errorMsg });
    var errorBubble = createPageBubble('assistant', '❌ ' + errorMsg, false, false);
    errorBubble.querySelector('.bubble-ai')?.classList.add('shake-error');
    area.appendChild(errorBubble);

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
  var exampleBtns = document.querySelectorAll('.example-btn');

  if (input) {
    input.placeholder = t('placeholder');
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

  var examples = t('examples');
  exampleBtns.forEach(function(btn, i) {
    if (examples[i]) {
      var iconEl = btn.querySelector('.example-icon');
      var textEl = btn.querySelector('.example-text');
      if (iconEl) iconEl.textContent = examples[i].icon;
      if (textEl) textEl.textContent = examples[i].title;
      btn.onclick = function() {
        if (input) input.value = examples[i].title;
        sendPageMessage(examples[i].title);
      };
    }
  });

  var titleEl = document.getElementById('page-title');
  var welcomeTitle = document.getElementById('welcome-title');
  var welcomeSub = document.getElementById('welcome-subtitle');

  if (titleEl) titleEl.textContent = t('title');
  if (welcomeTitle) welcomeTitle.textContent = t('welcome');
  if (welcomeSub) welcomeSub.textContent = t('welcomeSubtitle');

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
