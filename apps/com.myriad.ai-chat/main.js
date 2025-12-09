// AI Chat Tapp v5.2 - 规范版
// 壁纸色 · 极简 UI · 打字效果
// 2025-12-09

console.log('[AI Chat] v5.2 规范版初始化...');

// ========================================
// 国际化
// ========================================

var i18n = {
  'zh-CN': {
    widgetTitle: '对话',
    placeholder: '输入...',
    placeholderPage: '输入...',
    send: '发送',
    startChat: '开始',
    title: '对话',
    subtitle: '智能助手',
    welcome: '开始对话',
    welcomeSubtitle: '选择话题或直接输入',
    clearChat: '新对话',
    thinking: '思考中...',
    error: '出错了',
    errorNetwork: '网络错误',
    online: '在线',
    examples: [
      { icon: '💡', title: '解释概念', desc: '' },
      { icon: '✍️', title: '写一首诗', desc: '' },
      { icon: '💻', title: '学编程', desc: '' },
      { icon: '🎬', title: '推荐电影', desc: '' }
    ],
    quickExamples: ['你好', '笑话', '天气'],
  },
  'en-US': {
    widgetTitle: 'Chat',
    placeholder: 'Type...',
    placeholderPage: 'Type...',
    send: 'Send',
    startChat: 'Start',
    title: 'Chat',
    subtitle: 'Assistant',
    welcome: 'Start chatting',
    welcomeSubtitle: 'Pick a topic or ask',
    clearChat: 'New',
    thinking: 'Thinking...',
    error: 'Error',
    errorNetwork: 'Network error',
    online: 'Online',
    examples: [
      { icon: '💡', title: 'Explain', desc: '' },
      { icon: '✍️', title: 'Write poem', desc: '' },
      { icon: '💻', title: 'Learn code', desc: '' },
      { icon: '🎬', title: 'Movies', desc: '' }
    ],
    quickExamples: ['Hello', 'Joke', 'Weather'],
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

// 快速打字效果（用于小组件）
function typeWriterFast(element, text, onComplete) {
  var displayText = text.length > 80 ? text.substring(0, 80) + '...' : text;
  typeWriter(element, displayText, 15, onComplete);
}

// 涟漪效果
function createRipple(event, element) {
  var rect = element.getBoundingClientRect();
  var ripple = document.createElement('span');
  var size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';
  ripple.className = 'ripple';
  element.appendChild(ripple);
  setTimeout(function() { ripple.remove(); }, 600);
}

// 震动反馈（如果支持）
function hapticFeedback() {
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
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
  var titleEl = document.getElementById('widget-title');
  var statusEl = document.getElementById('widget-status');
  var avatarEl = document.getElementById('ai-avatar');
  var sendStatus = document.getElementById('send-status');

  if (!input || !sendBtn) {
    console.error('[AI Chat] 4x2 Widget 元素未找到');
    return;
  }

  // 设置文本
  if (titleEl) titleEl.textContent = t('widgetTitle');
  if (statusEl) statusEl.textContent = t('online');
  if (input) input.placeholder = t('placeholder');

  // 显示用户消息（带动画）
  function showUserMsg(text) {
    if (welcomeEl) welcomeEl.style.display = 'none';
    if (userMsgContent) userMsgContent.textContent = text;
    if (userMsgBar) {
      userMsgBar.style.opacity = '1';
      userMsgBar.style.transform = 'translateX(0)';
      userMsgBar.classList.add('msg-user-enter');
    }
  }

  // 显示 AI 回复（带打字效果）
  function showAiReply(text) {
    if (aiReplyContent) {
      aiReplyContent.classList.remove('animate-error-shake');
    }
    if (aiReplyBar) {
      aiReplyBar.style.opacity = '1';
      aiReplyBar.style.transform = 'translateX(0)';
      aiReplyBar.classList.add('msg-ai-enter');
    }
    // 打字效果
    if (aiReplyContent) {
      typeWriterFast(aiReplyContent, text, function() {
        if (avatarEl) avatarEl.classList.remove('avatar-thinking');
      });
    }
  }

  // 显示思考状态
  function showThinking() {
    if (aiReplyContent) {
      aiReplyContent.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
    }
    if (aiReplyBar) {
      aiReplyBar.style.opacity = '1';
      aiReplyBar.style.transform = 'translateX(0)';
    }
    // 头像思考动画
    if (avatarEl) avatarEl.classList.add('avatar-thinking');
  }

  // 显示错误
  function showError(msg) {
    if (aiReplyContent) {
      aiReplyContent.innerHTML = '<span class="text-red-500">❌ ' + escapeHtml(msg) + '</span>';
      aiReplyContent.classList.add('animate-error-shake');
    }
    if (avatarEl) avatarEl.classList.remove('avatar-thinking');
  }

  // 发送动画
  function animateSend() {
    if (sendIcon) {
      sendIcon.classList.add('send-icon-fly');
      setTimeout(function() {
        sendIcon.classList.remove('send-icon-fly');
      }, 300);
    }
  }

  // 发送消息
  function doSend(e) {
    if (e) createRipple(e, sendBtn);
    hapticFeedback();
    
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
    if (e.key === 'Enter') { 
      e.preventDefault(); 
      doSend(e); 
    }
  };

  console.log('[AI Chat] 4x2 Widget 初始化完成');
}

// ========================================
// 4x4 Widget
// ========================================

function init4x4Widget() {
  var input = document.getElementById('widget-input');
  var sendBtn = document.getElementById('widget-send');
  var sendIcon = document.getElementById('send-icon');
  var clearBtn = document.getElementById('widget-clear');
  var messagesArea = document.getElementById('widget-messages');
  var welcomeEl = document.getElementById('widget-welcome');
  var titleEl = document.getElementById('widget-title');
  var statusEl = document.getElementById('widget-status');
  var avatarEl = document.getElementById('ai-avatar');
  var quickExamples = document.querySelectorAll('.quick-example');

  if (!input || !sendBtn || !messagesArea) {
    console.error('[AI Chat] 4x4 Widget 元素未找到');
    return;
  }

  // 设置文本
  if (titleEl) titleEl.textContent = t('widgetTitle');
  if (statusEl) statusEl.textContent = '🟢 ' + t('online');
  if (input) input.placeholder = t('placeholder');
  if (clearBtn) clearBtn.textContent = '🔄 ' + t('clearChat');

  // 创建消息气泡
  function createBubble(role, content, isTyping, useTypingEffect) {
    var row = document.createElement('div');
    row.className = 'flex items-start gap-2 ' + (role === 'user' ? 'flex-row-reverse msg-user-enter' : 'msg-ai-enter');

    var avatar = document.createElement('div');
    avatar.className = 'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-md';
    
    if (role === 'user') {
      avatar.className += ' gradient-animated text-white';
      avatar.textContent = '👤';
    } else {
      avatar.className += ' bg-white/80 dark:bg-neutral-800';
      avatar.textContent = '🤖';
      if (isTyping) avatar.classList.add('avatar-thinking');
    }

    var bubble = document.createElement('div');
    bubble.className = 'px-3 py-2 max-w-[75%] break-words text-sm ' + (role === 'user' ? 'bubble-user' : 'bubble-ai');
    
    if (isTyping) {
      bubble.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
    } else if (role === 'user') {
      bubble.textContent = content;
    } else if (useTypingEffect) {
      // 延迟启动打字效果
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

  // 添加消息
  function addMessage(role, content, useTypingEffect) {
    if (welcomeEl) welcomeEl.style.display = 'none';
    var bubble = createBubble(role, content, false, useTypingEffect);
    messagesArea.appendChild(bubble);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    return bubble;
  }

  // 添加思考指示器
  function addTypingIndicator() {
    var indicator = createBubble('assistant', '', true);
    indicator.id = 'typing-indicator';
    messagesArea.appendChild(indicator);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  // 发送消息
  function doSend(e, prefillText) {
    if (e) createRipple(e, sendBtn);
    hapticFeedback();
    
    var text = prefillText || input.value.trim();
    if (!text || widgetState.sending) return;

    widgetState.sending = true;
    sendBtn.disabled = true;
    input.value = '';

    // 发送动画
    if (sendIcon) {
      sendIcon.classList.add('send-icon-fly');
      setTimeout(function() { sendIcon.classList.remove('send-icon-fly'); }, 300);
    }

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
          addMessage('assistant', content, true); // 使用打字效果
        } else {
          throw new Error(t('error'));
        }
      })
      .catch(function(err) {
        console.error('[AI Chat] 4x4 Widget error:', err);
        var ind = document.getElementById('typing-indicator');
        if (ind) ind.remove();
        var errorBubble = addMessage('assistant', '❌ ' + (err.message || t('errorNetwork')), false);
        errorBubble.querySelector('.bubble-ai')?.classList.add('animate-error-shake');
      })
      .finally(function() {
        widgetState.sending = false;
        sendBtn.disabled = false;
      });
  }

  // 清空对话
  if (clearBtn) {
    clearBtn.onclick = function(e) {
      createRipple(e, clearBtn);
      widgetState.messages = [];
      messagesArea.innerHTML = '';
      if (welcomeEl) {
        messagesArea.appendChild(welcomeEl);
        welcomeEl.style.display = 'flex';
        welcomeEl.classList.add('float-up-enter');
      }
    };
  }

  // 快捷示例
  quickExamples.forEach(function(btn) {
    btn.onclick = function(e) {
      var example = btn.getAttribute('data-example');
      if (example) {
        input.value = example;
        doSend(e, example);
      }
    };
  });

  sendBtn.onclick = doSend;
  input.onkeydown = function(e) {
    if (e.key === 'Enter') { 
      e.preventDefault(); 
      doSend(e); 
    }
  };

  console.log('[AI Chat] 4x4 Widget 初始化完成');
}

// Widget 初始化入口
function initWidget() {
  var props = window._TAPP_WIDGET_PROPS || {};
  var size = props.size || '4x2';
  currentLocale = normalizeLocale(props.locale);

  console.log('[AI Chat] 初始化 Widget，尺寸:', size, '语言:', currentLocale);

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

function createPageBubble(role, content, isTyping, useTypingEffect) {
  var row = document.createElement('div');
  row.className = 'flex items-start gap-4 ' + (role === 'user' ? 'flex-row-reverse msg-user-enter' : 'msg-ai-enter');

  var avatar = document.createElement('div');
  avatar.className = 'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg';

  if (role === 'user') {
    avatar.className += ' gradient-animated text-white';
    avatar.textContent = '👤';
  } else {
    avatar.className += ' bg-white dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50';
    avatar.textContent = '🤖';
    if (isTyping || useTypingEffect) avatar.classList.add('avatar-thinking');
  }

  var bubble = document.createElement('div');
  bubble.className = 'px-5 py-4 max-w-[75%] break-words ' + (role === 'user' ? 'bubble-user' : 'bubble-ai');

  if (isTyping) {
    bubble.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
  } else if (role === 'user') {
    bubble.textContent = content;
  } else if (useTypingEffect) {
    // 打字效果
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

  // 清除现有消息
  var children = Array.from(area.children);
  children.forEach(function(child) {
    if (child.id !== 'page-welcome') child.remove();
  });

  if (pageState.messages.length === 0) {
    if (welcome) {
      welcome.style.display = 'flex';
      welcome.classList.add('float-up-enter');
    }
  } else {
    if (welcome) welcome.style.display = 'none';
    pageState.messages.forEach(function(msg, i) {
      var bubble = createPageBubble(msg.role, msg.content);
      bubble.style.animationDelay = (i * 50) + 'ms';
      area.appendChild(bubble);
    });
    setTimeout(function() { area.scrollTop = area.scrollHeight; }, 100);
  }
}

async function sendPageMessage(prefillText) {
  var input = document.getElementById('page-input');
  var sendBtn = document.getElementById('page-send');
  var sendIcon = document.getElementById('page-send-icon');
  var area = document.getElementById('page-messages');
  var welcome = document.getElementById('page-welcome');
  var charCount = document.getElementById('char-count');

  if (!input || !sendBtn || !area) return;

  var text = prefillText || input.value.trim();
  if (!text || pageState.isLoading) return;

  // 发送动画
  hapticFeedback();
  if (sendIcon) {
    sendIcon.classList.add('send-icon-fly');
    setTimeout(function() { sendIcon.classList.remove('send-icon-fly'); }, 300);
  }

  pageState.messages.push({ role: 'user', content: text });
  input.value = '';
  input.style.height = 'auto';
  if (charCount) charCount.textContent = '0 / 2000';
  
  if (welcome) welcome.style.display = 'none';
  area.appendChild(createPageBubble('user', text));
  area.scrollTop = area.scrollHeight;

  pageState.isLoading = true;
  sendBtn.disabled = true;

  // 添加思考指示器
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
      area.appendChild(createPageBubble('assistant', content, false, true)); // 使用打字效果
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
    var errorBubble = createPageBubble('assistant', '❌ ' + errorMsg, false, false);
    errorBubble.querySelector('.bubble-ai')?.classList.add('animate-error-shake');
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
  var exampleCards = document.querySelectorAll('.example-card');

  // 输入框
  if (input) {
    input.placeholder = t('placeholderPage');
    input.oninput = function() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 200) + 'px';
      if (charCount) {
        charCount.textContent = input.value.length + ' / 2000';
      }
    };
    input.onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendPageMessage();
      }
    };
  }

  // 发送按钮
  if (sendBtn) {
    sendBtn.onclick = function(e) {
      createRipple(e, sendBtn);
      sendPageMessage();
    };
    var sendLabel = sendBtn.querySelector('.send-label');
    if (sendLabel) sendLabel.textContent = t('send');
  }

  // 清空按钮
  if (clearBtn) {
    clearBtn.onclick = function(e) {
      createRipple(e, clearBtn);
      pageState.messages = [];
      saveHistory();
      renderPageMessages();
    };
  }

  // 示例卡片
  var examples = t('examples');
  exampleCards.forEach(function(card, i) {
    if (examples[i]) {
      card.onclick = function(e) {
        createRipple(e, card);
        if (input) input.value = examples[i].title;
        sendPageMessage(examples[i].title);
      };
    }
  });

  // 设置标题
  var titleEl = document.getElementById('page-title');
  var subtitleEl = document.getElementById('page-subtitle');
  var welcomeTitle = document.getElementById('welcome-title');
  var welcomeSub = document.getElementById('welcome-subtitle');

  if (titleEl) titleEl.textContent = t('title');
  if (subtitleEl) subtitleEl.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ' + t('subtitle');
  if (welcomeTitle) welcomeTitle.textContent = t('welcome');
  if (welcomeSub) welcomeSub.textContent = t('welcomeSubtitle');

  renderPageMessages();
  console.log('[AI Chat] Page 初始化完成');
}

// ========================================
// 生命周期入口
// ========================================

(function() {
  var mode = window._TAPP_MODE;
  var hasHtml = window._TAPP_HAS_HTML;

  console.log('[AI Chat] 运行模式:', mode, '有 HTML 模板:', hasHtml);

  if (mode === 'widget') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWidget);
    } else {
      setTimeout(initWidget, 0);
    }
  } else if (mode === 'page' || hasHtml) {
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

console.log('[AI Chat] v5.2 已加载');
