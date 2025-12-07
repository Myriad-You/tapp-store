// AI Chat Tapp v1.0
// AI 聊天助手 - 支持多轮对话、历史保存、Widget 快捷问答

console.log('[AI Chat] 初始化...');

// ========== 国际化 ==========
var i18n = {
  'zh-CN': {
    widgetTitle: 'AI 助手',
    placeholder: '输入消息...',
    send: '发送',
    startChat: '开始对话',
    hints: ['写代码', '翻译', '解释', '问答'],
    title: 'AI 聊天',
    subtitle: '智能对话助手',
    welcome: '你好！我是 AI 助手',
    welcomeSubtitle: '有什么可以帮助你的吗？',
    clearChat: '清空',
    sending: '思考中...',
    error: '出错了',
    errorNetwork: '网络错误，请重试',
    errorQuota: '已达到使用限制',
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
    hints: ['Code', 'Translate', 'Explain', 'Q&A'],
    title: 'AI Chat',
    subtitle: 'Smart conversation assistant',
    welcome: "Hello! I'm AI Assistant",
    welcomeSubtitle: 'How can I help you?',
    clearChat: 'Clear',
    sending: 'Thinking...',
    error: 'Error',
    errorNetwork: 'Network error, please retry',
    errorQuota: 'Quota exceeded',
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
  if (l.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

function t(key) {
  var dict = i18n[currentLocale] || i18n['zh-CN'];
  return dict[key] !== undefined ? dict[key] : key;
}

// ========== 主题工具 ==========
function getThemeColors(isDark, themeColor) {
  var primary = themeColor || '#8b5cf6';
  return {
    bg: isDark ? '#0a0a0a' : '#f8fafc',
    cardBg: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
    glassBg: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)',
    inputBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
    text: isDark ? '#f3f4f6' : '#1f2937',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    primary: primary,
    userBubble: primary,
    aiBubble: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
  };
}

// ========== 消息格式化 ==========
function formatMessage(text) {
  // 简单的 Markdown 格式化
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.1);padding:2px 6px;border-radius:4px;font-family:monospace;">$1</code>')
    .replace(/\n/g, '<br>');
}

// ========== 安全渲染 ==========
function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

console.log('[AI Chat] 核心模块已加载');

// ========== 动画工具 ==========
function createKeyframes() {
  if (document.getElementById('ai-chat-keyframes')) return;
  var style = document.createElement('style');
  style.id = 'ai-chat-keyframes';
  style.textContent = [
    '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }',
    '@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }',
    '@keyframes typingDot { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-4px); } }',
    '@keyframes slideInRight { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }',
    '@keyframes slideInLeft { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }',
    '@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }',
  ].join('\n');
  document.head.appendChild(style);
}

// 打字机效果
function typeWriter(element, text, speed, callback) {
  var i = 0;
  element.textContent = '';
  var cursor = document.createElement('span');
  cursor.textContent = '▌';
  cursor.style.cssText = 'animation:blink 0.8s infinite;opacity:0.7;';
  element.appendChild(cursor);
  
  function type() {
    if (i < text.length) {
      cursor.remove();
      element.textContent = text.substring(0, i + 1);
      element.appendChild(cursor);
      i++;
      setTimeout(type, speed);
    } else {
      cursor.remove();
      if (callback) callback();
    }
  }
  type();
}

// ========== WIDGET ==========
console.log('[AI Chat] 注册 Widget...');

Tapp.widgets['ai-chat'] = {
  render: function(container, props) {
    try {
      createKeyframes();
      
      var isDark = props.theme === 'dark';
      var themeColor = props.primaryColor || '#8b5cf6';
      var size = props.size || '4x2';
      var isCompact = size === '4x2';
      var dims = window._TAPP_DIMENSIONS || {};
      var scale = dims.scale || props.scale || 1;
      var fontScale = dims.fontScale || props.fontScale || 1;
      
      currentLocale = normalizeLocale(props.locale);
      var colors = getThemeColors(isDark, themeColor);

      container.innerHTML = '';

      // ========== 主容器（微透明背景）==========
      var main = document.createElement('div');
      main.style.cssText = [
        'position:absolute;inset:0;border-radius:' + (16 * scale) + 'px;overflow:hidden',
        'background:' + (isDark ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.8)'),
        'backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)',
        'border:1px solid ' + (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
        'box-shadow:' + (isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)')
      ].join(';');

      var content = document.createElement('div');
      content.style.cssText = 'position:relative;z-index:10;height:100%;display:flex;flex-direction:column;';

      if (isCompact) {
        // ========== 4x2 纯对话框布局 ==========
        content.style.cssText = 'position:relative;z-index:10;height:100%;display:flex;flex-direction:column;';
        
        // 对话显示区（占满空间，居中显示单条消息）
        var dialogArea = document.createElement('div');
        dialogArea.style.cssText = [
          'flex:1;display:flex;align-items:center;justify-content:center',
          'padding:' + (12 * scale) + 'px ' + (16 * scale) + 'px',
          'overflow:hidden'
        ].join(';');

        // 消息气泡容器
        var msgBubble = document.createElement('div');
        msgBubble.style.cssText = [
          'width:100%;padding:' + (12 * scale) + 'px ' + (16 * scale) + 'px',
          'border-radius:' + (12 * scale) + 'px',
          'background:' + (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
          'font-size:' + (13 * fontScale) + 'px;line-height:1.5',
          'color:' + colors.subtext + ';text-align:center',
          'max-height:100%;overflow:hidden;text-overflow:ellipsis'
        ].join(';');
        msgBubble.textContent = t('placeholder');
        dialogArea.appendChild(msgBubble);
        content.appendChild(dialogArea);

        // 底部输入栏
        var inputBar = document.createElement('div');
        inputBar.style.cssText = [
          'display:flex;align-items:center;gap:' + (8 * scale) + 'px',
          'padding:' + (10 * scale) + 'px ' + (12 * scale) + 'px',
          'border-top:1px solid ' + (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
        ].join(';');

        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = t('placeholder');
        input.style.cssText = [
          'flex:1;padding:' + (10 * scale) + 'px ' + (14 * scale) + 'px',
          'border-radius:' + (10 * scale) + 'px;font-size:' + (13 * fontScale) + 'px',
          'background:' + (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'),
          'border:1px solid transparent',
          'color:' + colors.text + ';outline:none;font-family:inherit',
          'transition:all 0.2s'
        ].join(';');
        input.onfocus = function() {
          input.style.borderColor = colors.primary + '60';
          input.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
        };
        input.onblur = function() {
          input.style.borderColor = 'transparent';
          input.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';
        };
        inputBar.appendChild(input);

        var sendBtn = document.createElement('button');
        sendBtn.style.cssText = [
          'width:' + (36 * scale) + 'px;height:' + (36 * scale) + 'px',
          'border-radius:' + (10 * scale) + 'px;border:none;cursor:pointer',
          'background:' + colors.primary,
          'display:flex;align-items:center;justify-content:center',
          'transition:all 0.2s'
        ].join(';');
        sendBtn.innerHTML = '<svg width="' + (16 * scale) + '" height="' + (16 * scale) + '" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
        sendBtn.onmouseenter = function() { if (!sending) sendBtn.style.opacity = '0.85'; };
        sendBtn.onmouseleave = function() { sendBtn.style.opacity = '1'; };
        inputBar.appendChild(sendBtn);
        content.appendChild(inputBar);

        // 状态
        var sending = false;
        var lastRole = null;

        function showMessage(text, role) {
          lastRole = role;
          msgBubble.style.color = colors.text;
          msgBubble.style.textAlign = role === 'user' ? 'right' : 'left';
          msgBubble.style.background = role === 'user' 
            ? colors.primary + '15' 
            : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)');
          
          if (role === 'assistant') {
            // AI 回复使用打字效果
            var displayText = text.length > 100 ? text.substring(0, 100) + '...' : text;
            typeWriter(msgBubble, displayText, 25);
          } else {
            msgBubble.textContent = text;
          }
        }

        function showTyping() {
          msgBubble.style.color = colors.subtext;
          msgBubble.style.textAlign = 'center';
          msgBubble.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
          msgBubble.innerHTML = '<span style="display:inline-flex;gap:4px;align-items:center"><span style="width:6px;height:6px;border-radius:50%;background:' + colors.primary + ';animation:typingDot 1.4s infinite"></span><span style="width:6px;height:6px;border-radius:50%;background:' + colors.primary + ';animation:typingDot 1.4s infinite;animation-delay:0.2s"></span><span style="width:6px;height:6px;border-radius:50%;background:' + colors.primary + ';animation:typingDot 1.4s infinite;animation-delay:0.4s"></span></span>';
        }

        function showError(msg) {
          msgBubble.style.color = '#ef4444';
          msgBubble.style.textAlign = 'center';
          msgBubble.textContent = '❌ ' + msg;
        }

        function doSend() {
          var text = input.value.trim();
          if (!text || sending) return;
          
          sending = true;
          sendBtn.style.opacity = '0.5';
          input.value = '';
          showMessage(text, 'user');

          setTimeout(function() { showTyping(); }, 300);

          Tapp.ai.chat([{ role: 'user', content: text }], {}, { maxTokens: 300 })
            .then(function(resp) {
              var aiMessage = resp?.message || resp;
              if (aiMessage?.content) {
                showMessage(aiMessage.content, 'assistant');
              } else {
                throw new Error(resp?.error || t('error'));
              }
            })
            .catch(function(err) {
              showError(err.message || t('error'));
            })
            .finally(function() {
              sending = false;
              sendBtn.style.opacity = '1';
            });
        }

        sendBtn.onclick = doSend;
        input.onkeydown = function(e) {
          if (e.key === 'Enter') { e.preventDefault(); doSend(); }
        };

      } else {
        // ========== 4x4 完整布局（浮动顶栏）==========
        
        // 消息区域（全屏）
        var msgArea = document.createElement('div');
        msgArea.style.cssText = [
          'flex:1;overflow-y:auto;overflow-x:hidden',
          'padding:' + (12 * scale) + 'px',
          'padding-top:' + (44 * scale) + 'px',
          'display:flex;flex-direction:column;gap:' + (8 * scale) + 'px'
        ].join(';');

        // 浮动顶栏
        var floatHeader = document.createElement('div');
        floatHeader.style.cssText = [
          'position:absolute;top:' + (8 * scale) + 'px;left:' + (8 * scale) + 'px;right:' + (8 * scale) + 'px;z-index:20',
          'display:flex;align-items:center;gap:' + (8 * scale) + 'px',
          'padding:' + (8 * scale) + 'px ' + (12 * scale) + 'px',
          'border-radius:' + (10 * scale) + 'px',
          'background:' + (isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)'),
          'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)',
          'border:1px solid ' + (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
          'box-shadow:0 2px 12px ' + (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)')
        ].join(';');

        var headerIcon = document.createElement('div');
        headerIcon.style.cssText = [
          'width:' + (24 * scale) + 'px;height:' + (24 * scale) + 'px',
          'border-radius:' + (6 * scale) + 'px;display:flex;align-items:center;justify-content:center',
          'background:' + colors.primary
        ].join(';');
        headerIcon.innerHTML = '<svg width="' + (14 * scale) + '" height="' + (14 * scale) + '" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
        floatHeader.appendChild(headerIcon);

        var headerTitle = document.createElement('span');
        headerTitle.style.cssText = 'flex:1;font-size:' + (13 * fontScale) + 'px;font-weight:500;color:' + colors.text;
        headerTitle.textContent = t('widgetTitle');
        floatHeader.appendChild(headerTitle);

        // 清除按钮
        var clearBtn = document.createElement('button');
        clearBtn.style.cssText = [
          'width:' + (24 * scale) + 'px;height:' + (24 * scale) + 'px;border:none;cursor:pointer',
          'border-radius:' + (6 * scale) + 'px;background:transparent',
          'display:flex;align-items:center;justify-content:center',
          'transition:all 0.2s;opacity:0.6'
        ].join(';');
        clearBtn.innerHTML = '<svg width="' + (14 * scale) + '" height="' + (14 * scale) + '" viewBox="0 0 24 24" fill="none" stroke="' + colors.text + '" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>';
        clearBtn.onmouseenter = function() { clearBtn.style.opacity = '1'; clearBtn.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'; };
        clearBtn.onmouseleave = function() { clearBtn.style.opacity = '0.6'; clearBtn.style.background = 'transparent'; };
        floatHeader.appendChild(clearBtn);
        content.appendChild(floatHeader);

        // 欢迎消息
        var welcomeMsg = document.createElement('div');
        welcomeMsg.style.cssText = [
          'text-align:center;padding:' + (20 * scale) + 'px ' + (16 * scale) + 'px',
          'color:' + colors.subtext + ';font-size:' + (12 * fontScale) + 'px'
        ].join(';');
        welcomeMsg.textContent = t('startChat');
        msgArea.appendChild(welcomeMsg);
        content.appendChild(msgArea);

        // 输入区域
        var inputArea = document.createElement('div');
        inputArea.style.cssText = [
          'display:flex;align-items:center;gap:' + (8 * scale) + 'px',
          'padding:' + (10 * scale) + 'px ' + (12 * scale) + 'px',
          'border-top:1px solid ' + (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
          'background:' + (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)')
        ].join(';');

        var inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.placeholder = t('placeholder');
        inputEl.style.cssText = [
          'flex:1;padding:' + (10 * scale) + 'px ' + (14 * scale) + 'px',
          'border-radius:' + (10 * scale) + 'px;font-size:' + (13 * fontScale) + 'px',
          'background:' + (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'),
          'border:1px solid transparent',
          'color:' + colors.text + ';outline:none;font-family:inherit',
          'transition:all 0.2s'
        ].join(';');
        inputEl.onfocus = function() {
          inputEl.style.borderColor = colors.primary + '60';
        };
        inputEl.onblur = function() {
          inputEl.style.borderColor = 'transparent';
        };
        inputArea.appendChild(inputEl);

        var sendBtn = document.createElement('button');
        sendBtn.style.cssText = [
          'width:' + (36 * scale) + 'px;height:' + (36 * scale) + 'px',
          'border-radius:' + (10 * scale) + 'px;border:none;cursor:pointer',
          'background:' + colors.primary,
          'display:flex;align-items:center;justify-content:center',
          'transition:all 0.2s'
        ].join(';');
        sendBtn.innerHTML = '<svg width="' + (16 * scale) + '" height="' + (16 * scale) + '" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
        inputArea.appendChild(sendBtn);
        content.appendChild(inputArea);

        // 消息逻辑
        var widgetMessages = [];
        var isWidgetSending = false;

        function createBubble(msg, useTypeEffect) {
          var isUser = msg.role === 'user';
          var wrapper = document.createElement('div');
          wrapper.style.cssText = [
            'display:flex;flex-direction:' + (isUser ? 'row-reverse' : 'row'),
            'animation:' + (isUser ? 'slideInRight' : 'slideInLeft') + ' 0.25s ease-out'
          ].join(';');

          var bubble = document.createElement('div');
          bubble.style.cssText = [
            'max-width:80%;padding:' + (10 * scale) + 'px ' + (14 * scale) + 'px',
            'border-radius:' + (12 * scale) + 'px',
            'font-size:' + (12 * fontScale) + 'px;line-height:1.5;word-break:break-word',
            'background:' + (isUser ? colors.primary : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)')),
            'color:' + (isUser ? 'white' : colors.text)
          ].join(';');
          
          if (!isUser && useTypeEffect) {
            typeWriter(bubble, msg.content, 20);
          } else {
            bubble.innerHTML = formatMessage(escapeHtml(msg.content));
          }
          wrapper.appendChild(bubble);
          return wrapper;
        }

        function createTypingIndicator() {
          var wrapper = document.createElement('div');
          wrapper.id = 'widget-typing';
          wrapper.style.cssText = 'display:flex;animation:fadeIn 0.2s ease-out';
          var bubble = document.createElement('div');
          bubble.style.cssText = [
            'padding:' + (10 * scale) + 'px ' + (16 * scale) + 'px',
            'border-radius:' + (12 * scale) + 'px',
            'background:' + (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'),
            'display:flex;gap:4px'
          ].join(';');
          bubble.innerHTML = [
            '<span style="width:6px;height:6px;border-radius:50%;background:' + colors.primary + ';animation:typingDot 1.4s infinite"></span>',
            '<span style="width:6px;height:6px;border-radius:50%;background:' + colors.primary + ';animation:typingDot 1.4s infinite;animation-delay:0.2s"></span>',
            '<span style="width:6px;height:6px;border-radius:50%;background:' + colors.primary + ';animation:typingDot 1.4s infinite;animation-delay:0.4s"></span>'
          ].join('');
          wrapper.appendChild(bubble);
          return wrapper;
        }

        function renderMessages(lastIsTyped) {
          // 清除欢迎消息
          if (widgetMessages.length > 0) {
            welcomeMsg.style.display = 'none';
          }
          // 只添加最新消息
          var lastMsg = widgetMessages[widgetMessages.length - 1];
          if (lastMsg) {
            var bubble = createBubble(lastMsg, lastIsTyped && lastMsg.role === 'assistant');
            msgArea.appendChild(bubble);
            msgArea.scrollTop = msgArea.scrollHeight;
          }
        }

        function doWidgetSend() {
          var text = inputEl.value.trim();
          if (!text || isWidgetSending) return;
          
          isWidgetSending = true;
          sendBtn.style.opacity = '0.5';
          inputEl.value = '';
          
          widgetMessages.push({ role: 'user', content: text });
          renderMessages(false);
          
          var typing = createTypingIndicator();
          msgArea.appendChild(typing);
          msgArea.scrollTop = msgArea.scrollHeight;

          var chatMsgs = widgetMessages.map(function(m) { return { role: m.role, content: m.content }; });

          Tapp.ai.chat(chatMsgs, {}, { maxTokens: 500 })
            .then(function(resp) {
              var ind = document.getElementById('widget-typing');
              if (ind) ind.remove();
              var aiMsg = resp?.message || resp;
              if (aiMsg?.content) {
                widgetMessages.push({ role: 'assistant', content: aiMsg.content });
                renderMessages(true);
              } else {
                throw new Error(resp?.error || t('error'));
              }
            })
            .catch(function(err) {
              var ind = document.getElementById('widget-typing');
              if (ind) ind.remove();
              widgetMessages.push({ role: 'assistant', content: '❌ ' + (err.message || t('error')) });
              renderMessages(false);
            })
            .finally(function() {
              isWidgetSending = false;
              sendBtn.style.opacity = '1';
            });
        }

        clearBtn.onclick = function() {
          widgetMessages = [];
          msgArea.innerHTML = '';
          welcomeMsg.style.display = 'block';
          msgArea.appendChild(welcomeMsg);
        };

        sendBtn.onclick = doWidgetSend;
        inputEl.onkeydown = function(e) {
          if (e.key === 'Enter') { e.preventDefault(); doWidgetSend(); }
        };
      }

      main.appendChild(content);

      // 编辑模式
      if (props.isEditMode) {
        var editOverlay = document.createElement('div');
        editOverlay.style.cssText = [
          'position:absolute;inset:0;border:2px dashed ' + colors.primary,
          'border-radius:' + (16 * scale) + 'px;pointer-events:none;z-index:100'
        ].join(';');
        main.appendChild(editOverlay);
      }

      container.appendChild(main);

    } catch (err) {
      console.error('[AI Chat Widget] Error:', err);
      container.innerHTML = '<div style="color:#ef4444;padding:16px;font-size:12px;">Error: ' + err.message + '</div>';
    }
  }
};

console.log('[AI Chat] Widget 已注册');


// ========== PAGE ==========

// 页面状态
var pageState = {
  messages: [],
  isLoading: false,
  isDark: true,
  themeColor: '#8b5cf6',
  colors: null,
  settings: {
    saveHistory: true,
    maxHistory: 50,
    systemPrompt: ''
  }
};

// 加载设置和历史
async function loadPageData() {
  try {
    // 加载设置
    var savedSettings = await Tapp.settings.getAll();
    if (savedSettings) {
      Object.assign(pageState.settings, savedSettings);
    }
    
    // 加载历史记录
    if (pageState.settings.saveHistory) {
      var history = await Tapp.storage.get('chat_history');
      if (history && Array.isArray(history)) {
        pageState.messages = history.slice(-pageState.settings.maxHistory);
      }
    }
  } catch (err) {
    console.error('[AI Chat] 加载数据失败:', err);
  }
}

// 保存历史
async function saveHistory() {
  if (!pageState.settings.saveHistory) return;
  try {
    var toSave = pageState.messages.slice(-pageState.settings.maxHistory);
    await Tapp.storage.set('chat_history', toSave);
  } catch (err) {
    console.error('[AI Chat] 保存历史失败:', err);
  }
}

// 渲染页面
function renderPage() {
  var bgLayer = document.getElementById('tapp-background');
  var contentLayer = document.getElementById('tapp-content');
  
  if (!contentLayer) return;
  
  var colors = pageState.colors;

  // 背景层
  if (bgLayer) {
    bgLayer.innerHTML = '';
    bgLayer.style.background = colors.bg;

    // 装饰光晕
    var glow1 = document.createElement('div');
    glow1.style.cssText = 
      'position:absolute;right:-10%;top:-10%;width:50%;height:50%;border-radius:50%;' +
      'background:radial-gradient(circle,' + colors.primary + '15,transparent 70%);' +
      'filter:blur(60px);pointer-events:none;';
    bgLayer.appendChild(glow1);

    var glow2 = document.createElement('div');
    glow2.style.cssText = 
      'position:absolute;left:-5%;bottom:20%;width:35%;height:35%;border-radius:50%;' +
      'background:radial-gradient(circle,' + colors.primary + '10,transparent 70%);' +
      'filter:blur(40px);pointer-events:none;';
    bgLayer.appendChild(glow2);
  }

  // 内容层
  contentLayer.innerHTML = '';
  contentLayer.style.cssText = 
    'height:100%;display:flex;flex-direction:column;' +
    'font-family:system-ui,-apple-system,sans-serif;color:' + colors.text + ';';

  // 主容器
  var mainContainer = document.createElement('div');
  mainContainer.style.cssText = 
    'flex:1;display:flex;flex-direction:column;max-width:900px;width:100%;margin:0 auto;overflow:hidden;';

  // 头部
  var header = document.createElement('div');
  header.style.cssText = 
    'display:flex;align-items:center;gap:calc(12px * var(--tapp-scale,1));' +
    'padding:calc(16px * var(--tapp-scale,1)) calc(24px * var(--tapp-scale,1));' +
    'background:' + colors.cardBg + ';backdrop-filter:blur(12px);' +
    'border-radius:calc(16px * var(--tapp-scale,1));' +
    'margin-bottom:calc(16px * var(--tapp-scale,1));' +
    'border:1px solid ' + colors.border + ';';

  var headerIcon = document.createElement('div');
  headerIcon.style.cssText = 
    'width:calc(48px * var(--tapp-scale,1));height:calc(48px * var(--tapp-scale,1));' +
    'border-radius:calc(14px * var(--tapp-scale,1));display:flex;align-items:center;justify-content:center;' +
    'font-size:calc(24px * var(--tapp-scale,1));' +
    'background:linear-gradient(135deg,' + colors.primary + '30,' + colors.primary + '10);';
  headerIcon.textContent = '🤖';
  header.appendChild(headerIcon);

  var headerText = document.createElement('div');
  headerText.style.cssText = 'flex:1;';

  var headerTitle = document.createElement('h1');
  headerTitle.style.cssText = 
    'margin:0;font-size:calc(20px * var(--tapp-font-scale,1));font-weight:600;color:' + colors.text + ';';
  headerTitle.textContent = t('title');
  headerText.appendChild(headerTitle);

  var headerSubtitle = document.createElement('p');
  headerSubtitle.style.cssText = 
    'margin:4px 0 0 0;font-size:calc(13px * var(--tapp-font-scale,1));color:' + colors.subtext + ';';
  headerSubtitle.textContent = t('subtitle');
  headerText.appendChild(headerSubtitle);

  header.appendChild(headerText);

  // 清空按钮
  var clearBtn = document.createElement('button');
  clearBtn.style.cssText = 
    'padding:calc(8px * var(--tapp-scale,1)) calc(16px * var(--tapp-scale,1));' +
    'font-size:calc(13px * var(--tapp-font-scale,1));' +
    'border:1px solid ' + colors.border + ';border-radius:calc(10px * var(--tapp-scale,1));' +
    'background:transparent;color:' + colors.subtext + ';cursor:pointer;' +
    'transition:all 0.2s;';
  clearBtn.textContent = t('newChat');
  clearBtn.onmouseenter = function() {
    clearBtn.style.borderColor = colors.primary;
    clearBtn.style.color = colors.primary;
  };
  clearBtn.onmouseleave = function() {
    clearBtn.style.borderColor = colors.border;
    clearBtn.style.color = colors.subtext;
  };
  clearBtn.onclick = function() {
    pageState.messages = [];
    saveHistory();
    renderMessages();
  };
  header.appendChild(clearBtn);

  mainContainer.appendChild(header);

  // 消息区域
  var messagesArea = document.createElement('div');
  messagesArea.id = 'chat-messages';
  messagesArea.style.cssText = 
    'flex:1;overflow-y:auto;padding:0 calc(8px * var(--tapp-scale,1));' +
    'display:flex;flex-direction:column;gap:calc(16px * var(--tapp-scale,1));';
  mainContainer.appendChild(messagesArea);

  // 输入区域
  var inputArea = document.createElement('div');
  inputArea.style.cssText = 
    'padding:calc(16px * var(--tapp-scale,1)) calc(24px * var(--tapp-scale,1));' +
    'margin-top:calc(16px * var(--tapp-scale,1));' +
    'background:' + colors.cardBg + ';backdrop-filter:blur(12px);' +
    'border-radius:calc(16px * var(--tapp-scale,1));' +
    'border:1px solid ' + colors.border + ';';

  var inputWrapper = document.createElement('div');
  inputWrapper.style.cssText = 'display:flex;gap:calc(12px * var(--tapp-scale,1));align-items:flex-end;';

  var chatInput = document.createElement('textarea');
  chatInput.id = 'chat-input';
  chatInput.placeholder = t('placeholder');
  chatInput.rows = 1;
  chatInput.style.cssText = 
    'flex:1;padding:calc(14px * var(--tapp-scale,1)) calc(18px * var(--tapp-scale,1));' +
    'font-size:calc(15px * var(--tapp-font-scale,1));font-family:inherit;' +
    'border:2px solid ' + colors.border + ';border-radius:calc(14px * var(--tapp-scale,1));' +
    'background:' + colors.inputBg + ';resize:none;min-height:48px;max-height:150px;' +
    'color:' + colors.text + ';outline:none;transition:border-color 0.2s,box-shadow 0.2s;';
  
  chatInput.onfocus = function() { 
    chatInput.style.borderColor = colors.primary;
    chatInput.style.boxShadow = '0 0 0 4px ' + colors.primary + '15';
  };
  chatInput.onblur = function() { 
    chatInput.style.borderColor = colors.border;
    chatInput.style.boxShadow = 'none';
  };
  
  // 自动调整高度
  chatInput.oninput = function() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
  };
  
  inputWrapper.appendChild(chatInput);

  var sendBtn = document.createElement('button');
  sendBtn.id = 'send-btn';
  sendBtn.style.cssText = 
    'padding:calc(14px * var(--tapp-scale,1)) calc(28px * var(--tapp-scale,1));' +
    'font-size:calc(15px * var(--tapp-font-scale,1));font-weight:500;' +
    'border:none;border-radius:calc(14px * var(--tapp-scale,1));' +
    'background:' + colors.primary + ';color:white;cursor:pointer;' +
    'transition:opacity 0.2s,transform 0.2s;display:flex;align-items:center;gap:8px;';
  sendBtn.innerHTML = '<span>' + t('send') + '</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  sendBtn.onmouseenter = function() { sendBtn.style.opacity = '0.9'; };
  sendBtn.onmouseleave = function() { sendBtn.style.opacity = '1'; };
  inputWrapper.appendChild(sendBtn);

  inputArea.appendChild(inputWrapper);
  mainContainer.appendChild(inputArea);

  contentLayer.appendChild(mainContainer);

  // 渲染消息
  renderMessages();

  // 绑定发送事件
  sendBtn.onclick = sendMessage;
  chatInput.onkeydown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  console.log('[AI Chat] 页面已渲染');
}

// 渲染消息列表
function renderMessages() {
  var messagesArea = document.getElementById('chat-messages');
  if (!messagesArea) return;
  
  var colors = pageState.colors;
  messagesArea.innerHTML = '';

  if (pageState.messages.length === 0) {
    // 欢迎界面
    var welcomeContainer = document.createElement('div');
    welcomeContainer.style.cssText = 
      'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'text-align:center;padding:calc(48px * var(--tapp-scale,1));';

    var welcomeIcon = document.createElement('div');
    welcomeIcon.style.cssText = 
      'font-size:calc(56px * var(--tapp-scale,1));margin-bottom:calc(20px * var(--tapp-scale,1));';
    welcomeIcon.textContent = '🤖';
    welcomeContainer.appendChild(welcomeIcon);

    var welcomeTitle = document.createElement('div');
    welcomeTitle.style.cssText = 
      'font-size:calc(24px * var(--tapp-font-scale,1));font-weight:600;' +
      'color:' + colors.text + ';margin-bottom:calc(8px * var(--tapp-scale,1));';
    welcomeTitle.textContent = t('welcome');
    welcomeContainer.appendChild(welcomeTitle);

    var welcomeSubtitle = document.createElement('div');
    welcomeSubtitle.style.cssText = 
      'font-size:calc(15px * var(--tapp-font-scale,1));color:' + colors.subtext + ';' +
      'margin-bottom:calc(32px * var(--tapp-scale,1));';
    welcomeSubtitle.textContent = t('welcomeSubtitle');
    welcomeContainer.appendChild(welcomeSubtitle);

    // 示例问题
    var examplesGrid = document.createElement('div');
    examplesGrid.style.cssText = 
      'display:grid;grid-template-columns:repeat(2,1fr);gap:calc(12px * var(--tapp-scale,1));' +
      'max-width:500px;width:100%;';

    var examples = t('examples');
    examples.forEach(function(example) {
      var exampleBtn = document.createElement('button');
      exampleBtn.style.cssText = 
        'padding:calc(14px * var(--tapp-scale,1)) calc(18px * var(--tapp-scale,1));' +
        'font-size:calc(14px * var(--tapp-font-scale,1));text-align:left;' +
        'border:1px solid ' + colors.border + ';border-radius:calc(12px * var(--tapp-scale,1));' +
        'background:' + colors.cardBg + ';color:' + colors.text + ';cursor:pointer;' +
        'transition:all 0.2s;';
      exampleBtn.textContent = example;
      exampleBtn.onmouseenter = function() {
        exampleBtn.style.borderColor = colors.primary;
        exampleBtn.style.background = colors.primary + '10';
      };
      exampleBtn.onmouseleave = function() {
        exampleBtn.style.borderColor = colors.border;
        exampleBtn.style.background = colors.cardBg;
      };
      exampleBtn.onclick = function() {
        var input = document.getElementById('chat-input');
        if (input) {
          input.value = example;
          input.focus();
        }
      };
      examplesGrid.appendChild(exampleBtn);
    });
    welcomeContainer.appendChild(examplesGrid);

    messagesArea.appendChild(welcomeContainer);
  } else {
    // 显示消息
    pageState.messages.forEach(function(msg, index) {
      var msgEl = createMessageElement(msg, index);
      messagesArea.appendChild(msgEl);
    });
    
    // 滚动到底部
    setTimeout(function() {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }, 50);
  }
}

// 创建消息元素
function createMessageElement(msg, index) {
  var colors = pageState.colors;
  var isUser = msg.role === 'user';
  
  var wrapper = document.createElement('div');
  wrapper.style.cssText = 
    'display:flex;gap:calc(12px * var(--tapp-scale,1));' +
    'flex-direction:' + (isUser ? 'row-reverse' : 'row') + ';' +
    'align-items:flex-start;';

  // 头像
  var avatar = document.createElement('div');
  avatar.style.cssText = 
    'width:calc(36px * var(--tapp-scale,1));height:calc(36px * var(--tapp-scale,1));' +
    'border-radius:calc(10px * var(--tapp-scale,1));flex-shrink:0;' +
    'display:flex;align-items:center;justify-content:center;' +
    'font-size:calc(18px * var(--tapp-scale,1));' +
    'background:' + (isUser ? colors.primary : colors.cardBg) + ';' +
    'border:1px solid ' + colors.border + ';';
  avatar.textContent = isUser ? '👤' : '🤖';
  wrapper.appendChild(avatar);

  // 消息内容
  var bubble = document.createElement('div');
  bubble.style.cssText = 
    'max-width:75%;padding:calc(14px * var(--tapp-scale,1)) calc(18px * var(--tapp-scale,1));' +
    'border-radius:calc(16px * var(--tapp-scale,1));' +
    'font-size:calc(15px * var(--tapp-font-scale,1));line-height:1.6;' +
    'word-break:break-word;' +
    'background:' + (isUser ? colors.primary : colors.cardBg) + ';' +
    'color:' + (isUser ? 'white' : colors.text) + ';' +
    'border:1px solid ' + (isUser ? 'transparent' : colors.border) + ';';
  
  bubble.innerHTML = formatMessage(escapeHtml(msg.content));
  wrapper.appendChild(bubble);

  return wrapper;
}

// 发送消息
async function sendMessage() {
  var input = document.getElementById('chat-input');
  var sendBtn = document.getElementById('send-btn');
  if (!input || !sendBtn) return;
  
  var text = input.value.trim();
  if (!text || pageState.isLoading) return;

  // 添加用户消息
  pageState.messages.push({ role: 'user', content: text });
  input.value = '';
  input.style.height = 'auto';
  renderMessages();

  // 开始加载
  pageState.isLoading = true;
  sendBtn.style.opacity = '0.5';
  sendBtn.style.pointerEvents = 'none';

  // 显示加载指示器
  var messagesArea = document.getElementById('chat-messages');
  var loadingEl = document.createElement('div');
  loadingEl.id = 'loading-indicator';
  loadingEl.style.cssText = 
    'display:flex;gap:calc(12px * var(--tapp-scale,1));align-items:flex-start;';
  
  var loadingAvatar = document.createElement('div');
  loadingAvatar.style.cssText = 
    'width:calc(36px * var(--tapp-scale,1));height:calc(36px * var(--tapp-scale,1));' +
    'border-radius:calc(10px * var(--tapp-scale,1));flex-shrink:0;' +
    'display:flex;align-items:center;justify-content:center;' +
    'font-size:calc(18px * var(--tapp-scale,1));' +
    'background:' + pageState.colors.cardBg + ';' +
    'border:1px solid ' + pageState.colors.border + ';';
  loadingAvatar.textContent = '🤖';
  loadingEl.appendChild(loadingAvatar);

  var loadingBubble = document.createElement('div');
  loadingBubble.style.cssText = 
    'padding:calc(14px * var(--tapp-scale,1)) calc(18px * var(--tapp-scale,1));' +
    'border-radius:calc(16px * var(--tapp-scale,1));' +
    'font-size:calc(15px * var(--tapp-font-scale,1));' +
    'background:' + pageState.colors.cardBg + ';' +
    'color:' + pageState.colors.subtext + ';' +
    'border:1px solid ' + pageState.colors.border + ';';
  loadingBubble.innerHTML = '<span class="loading-dots">' + t('sending') + '</span>';
  loadingEl.appendChild(loadingBubble);
  
  messagesArea.appendChild(loadingEl);
  messagesArea.scrollTop = messagesArea.scrollHeight;

  try {
    // 构建消息历史
    var chatMessages = pageState.messages.map(function(m) {
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
    });

    // 添加系统提示词
    if (pageState.settings.systemPrompt) {
      chatMessages.unshift({ role: 'system', content: pageState.settings.systemPrompt });
    }

    var response = await Tapp.ai.chat(chatMessages, {}, { maxTokens: 1500 });
    
    // 移除加载指示器
    var loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.remove();

    console.log('[AI Chat Page] Raw Response:', JSON.stringify(response, null, 2));
    // 兼容两种响应格式
    var aiMessage = response?.message || response;
    var content = aiMessage?.content;
    if (content) {
      pageState.messages.push({ role: 'assistant', content: content });
      saveHistory();
      renderMessages();
    } else {
      throw new Error(response?.error || 'No content in response');
    }
  } catch (err) {
    console.error('[AI Chat] 发送失败:', err);
    
    // 移除加载指示器
    var loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.remove();

    // 显示错误消息
    pageState.messages.push({ 
      role: 'assistant', 
      content: '❌ ' + t('error') + ': ' + (err.message || t('errorNetwork'))
    });
    renderMessages();

    Tapp.ui.showNotification({
      title: t('error'),
      message: err.message || t('errorNetwork'),
      type: 'error'
    });
  } finally {
    pageState.isLoading = false;
    sendBtn.style.opacity = '1';
    sendBtn.style.pointerEvents = 'auto';
  }
}

// 生命周期
Tapp.lifecycle.onReady(async function() {
  console.log('[AI Chat] onReady');
  
  try {
    // 获取主题信息
    var results = await Promise.all([
      Tapp.ui.getLocale(),
      Tapp.ui.getTheme(),
      Tapp.ui.getPrimaryColor()
    ]);
    
    currentLocale = normalizeLocale(results[0]);
    pageState.isDark = results[1] === 'dark';
    pageState.themeColor = results[2] || '#8b5cf6';
    pageState.colors = getThemeColors(pageState.isDark, pageState.themeColor);
    
    // 加载数据
    await loadPageData();
    
    // 渲染页面
    renderPage();

    // 监听主题变化
    Tapp.ui.onThemeChange(function(theme) {
      pageState.isDark = theme === 'dark';
      pageState.colors = getThemeColors(pageState.isDark, pageState.themeColor);
      renderPage();
    });

    Tapp.ui.onPrimaryColorChange(function(color) {
      pageState.themeColor = color;
      pageState.colors = getThemeColors(pageState.isDark, pageState.themeColor);
      renderPage();
    });

    Tapp.ui.onLocaleChange(function(locale) {
      currentLocale = normalizeLocale(locale);
      renderPage();
    });

  } catch (err) {
    console.error('[AI Chat] 初始化失败:', err);
    pageState.colors = getThemeColors(true, '#8b5cf6');
    renderPage();
  }
});

Tapp.lifecycle.onDestroy(async function() {
  console.log('[AI Chat] onDestroy');
  await saveHistory();
});

console.log('[AI Chat] Tapp 已加载');
