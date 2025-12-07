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


// ========== WIDGET ==========
console.log('[AI Chat] 注册 Widget...');

Tapp.widgets['ai-chat'] = {
  render: function(container, props) {
    console.log('[AI Chat Widget] 渲染, 尺寸:', props.size);
    
    try {
      var isDark = props.theme === 'dark';
      var themeColor = props.primaryColor || '#8b5cf6';
      var size = props.size || '4x2';
      var isCompact = size === '4x2';
      var scale = props.scale || 1;
      var fontScale = props.fontScale || 1;
      
      currentLocale = normalizeLocale(props.locale);
      var colors = getThemeColors(isDark, themeColor);

      container.innerHTML = '';
      container.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden;';

      // 主容器 - 使用 Tailwind (Widget 模式可用)
      var main = document.createElement('div');
      main.className = 'relative h-full w-full rounded-xl overflow-hidden';
      main.style.cssText = 
        'background:' + colors.glassBg + ';' +
        'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' +
        'border:1px solid ' + colors.border + ';';

      // 渐变装饰
      var gradient = document.createElement('div');
      gradient.className = 'absolute inset-0 pointer-events-none';
      gradient.style.background = 'linear-gradient(135deg,' + colors.primary + '08,transparent 60%)';
      main.appendChild(gradient);

      // 内容区
      var content = document.createElement('div');
      content.className = 'relative z-10 h-full';

      if (isCompact) {
        // ===== 4x2 紧凑布局 =====
        content.className = 'relative z-10 h-full flex items-center gap-3';
        content.style.padding = (12 * scale) + 'px ' + (16 * scale) + 'px';

        // 图标
        var icon = document.createElement('div');
        icon.className = 'flex-shrink-0 flex items-center justify-center rounded-xl';
        icon.style.cssText = 
          'width:' + (40 * scale) + 'px;height:' + (40 * scale) + 'px;' +
          'font-size:' + (20 * scale) + 'px;' +
          'background:linear-gradient(135deg,' + colors.primary + '30,' + colors.primary + '10);';
        icon.textContent = '🤖';
        content.appendChild(icon);

        // 输入区
        var inputWrap = document.createElement('div');
        inputWrap.className = 'flex-1 min-w-0';

        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = t('placeholder');
        input.className = 'w-full outline-none transition-all duration-200';
        input.style.cssText = 
          'padding:' + (10 * scale) + 'px ' + (14 * scale) + 'px;' +
          'border-radius:' + (10 * scale) + 'px;' +
          'font-size:' + (14 * fontScale) + 'px;' +
          'background:' + colors.inputBg + ';' +
          'border:1px solid ' + colors.border + ';' +
          'color:' + colors.text + ';';
        
        input.onfocus = function() {
          input.style.borderColor = colors.primary;
          input.style.boxShadow = '0 0 0 3px ' + colors.primary + '20';
        };
        input.onblur = function() {
          input.style.borderColor = colors.border;
          input.style.boxShadow = 'none';
        };
        inputWrap.appendChild(input);
        content.appendChild(inputWrap);

        // 发送按钮
        var sendBtn = document.createElement('button');
        sendBtn.className = 'flex-shrink-0 flex items-center justify-center border-none cursor-pointer transition-opacity duration-200';
        sendBtn.style.cssText = 
          'width:' + (40 * scale) + 'px;height:' + (40 * scale) + 'px;' +
          'border-radius:' + (10 * scale) + 'px;' +
          'background:' + colors.primary + ';';
        sendBtn.innerHTML = '<svg width="' + (16 * scale) + '" height="' + (16 * scale) + '" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
        
        sendBtn.onmouseenter = function() { sendBtn.style.opacity = '0.85'; };
        sendBtn.onmouseleave = function() { sendBtn.style.opacity = '1'; };
        content.appendChild(sendBtn);

        // 状态元素
        var statusEl = document.createElement('div');
        statusEl.style.cssText = 'display:none;font-size:' + (12 * fontScale) + 'px;color:' + colors.subtext + ';';
        content.appendChild(statusEl);

        // 事件绑定
        var sending = false;
        
        function doSend() {
          var text = input.value.trim();
          if (!text || sending) return;
          
          sending = true;
          sendBtn.style.opacity = '0.5';
          sendBtn.style.pointerEvents = 'none';
          input.value = '';
          statusEl.textContent = t('sending');
          statusEl.style.display = 'block';
          inputWrap.style.display = 'none';

          Tapp.ai.chat(
            [{ role: 'user', content: text }],
            {},
            { maxTokens: 500 }
          ).then(function(resp) {
            console.log('[AI Chat Widget] Response:', resp);
            if (resp && resp.success && resp.result) {
              // 显示简短回复
              var reply = resp.result.content || resp.result;
              if (typeof reply === 'string' && reply.length > 50) {
                reply = reply.substring(0, 50) + '...';
              }
              statusEl.textContent = reply;
              statusEl.style.color = colors.text;
              
              // 3秒后恢复输入
              setTimeout(function() {
                statusEl.style.display = 'none';
                inputWrap.style.display = 'block';
                statusEl.style.color = colors.subtext;
              }, 3000);
            } else {
              throw new Error(resp.error || 'Unknown error');
            }
          }).catch(function(err) {
            console.error('[AI Chat Widget] Error:', err);
            statusEl.textContent = t('error') + ': ' + (err.message || err);
            statusEl.style.color = '#ef4444';
            setTimeout(function() {
              statusEl.style.display = 'none';
              inputWrap.style.display = 'block';
              statusEl.style.color = colors.subtext;
            }, 3000);
          }).finally(function() {
            sending = false;
            sendBtn.style.opacity = '1';
            sendBtn.style.pointerEvents = 'auto';
          });
        }

        sendBtn.onclick = doSend;
        input.onkeydown = function(e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            doSend();
          }
        };

      } else {
        // ===== 4x4 完整布局 =====
        content.className = 'relative z-10 h-full flex flex-col';
        
        // 头部
        var header = document.createElement('div');
        header.className = 'flex items-center gap-2';
        header.style.cssText = 
          'padding:' + (12 * scale) + 'px ' + (14 * scale) + 'px;' +
          'border-bottom:1px solid ' + colors.border + ';';

        var headerIcon = document.createElement('div');
        headerIcon.className = 'flex items-center justify-center rounded-lg';
        headerIcon.style.cssText = 
          'width:' + (32 * scale) + 'px;height:' + (32 * scale) + 'px;' +
          'font-size:' + (16 * scale) + 'px;' +
          'background:linear-gradient(135deg,' + colors.primary + '30,' + colors.primary + '10);';
        headerIcon.textContent = '🤖';
        header.appendChild(headerIcon);

        var headerTitle = document.createElement('span');
        headerTitle.className = 'flex-1 font-semibold';
        headerTitle.style.cssText = 'font-size:' + (14 * fontScale) + 'px;color:' + colors.text + ';';
        headerTitle.textContent = t('widgetTitle');
        header.appendChild(headerTitle);

        var statusDot = document.createElement('div');
        statusDot.style.cssText = 
          'width:' + (6 * scale) + 'px;height:' + (6 * scale) + 'px;' +
          'border-radius:50%;background:#22c55e;';
        header.appendChild(statusDot);
        content.appendChild(header);

        // 消息区域
        var msgArea = document.createElement('div');
        msgArea.className = 'flex-1 overflow-y-auto';
        msgArea.style.cssText = 
          'padding:' + (12 * scale) + 'px;' +
          'display:flex;flex-direction:column;gap:' + (8 * scale) + 'px;';
        
        // 初始提示
        var emptyState = document.createElement('div');
        emptyState.className = 'flex-1 flex flex-col items-center justify-center text-center';
        emptyState.style.padding = (16 * scale) + 'px';

        var emptyIcon = document.createElement('div');
        emptyIcon.style.cssText = 'font-size:' + (28 * scale) + 'px;margin-bottom:' + (6 * scale) + 'px;opacity:0.5;';
        emptyIcon.textContent = '💬';
        emptyState.appendChild(emptyIcon);

        var emptyText = document.createElement('div');
        emptyText.style.cssText = 'font-size:' + (12 * fontScale) + 'px;color:' + colors.subtext + ';';
        emptyText.textContent = t('startChat');
        emptyState.appendChild(emptyText);

        // 提示词按钮
        var hintsRow = document.createElement('div');
        hintsRow.className = 'flex flex-wrap justify-center gap-1';
        hintsRow.style.marginTop = (10 * scale) + 'px';

        var hints = t('hints');
        hints.forEach(function(hint) {
          var hintBtn = document.createElement('button');
          hintBtn.className = 'cursor-pointer transition-all duration-200 border-none';
          hintBtn.style.cssText = 
            'padding:' + (4 * scale) + 'px ' + (8 * scale) + 'px;' +
            'border-radius:' + (6 * scale) + 'px;' +
            'font-size:' + (10 * fontScale) + 'px;' +
            'background:' + colors.cardBg + ';' +
            'color:' + colors.subtext + ';';
          hintBtn.textContent = hint;
          hintBtn.onmouseenter = function() {
            hintBtn.style.color = colors.primary;
          };
          hintBtn.onmouseleave = function() {
            hintBtn.style.color = colors.subtext;
          };
          hintBtn.onclick = function() {
            inputEl.value = hint;
            inputEl.focus();
          };
          hintsRow.appendChild(hintBtn);
        });
        emptyState.appendChild(hintsRow);
        msgArea.appendChild(emptyState);
        content.appendChild(msgArea);

        // 输入区域
        var inputArea = document.createElement('div');
        inputArea.style.cssText = 
          'padding:' + (10 * scale) + 'px ' + (12 * scale) + 'px;' +
          'border-top:1px solid ' + colors.border + ';';

        var inputRow = document.createElement('div');
        inputRow.className = 'flex items-center gap-2';

        var inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.placeholder = t('placeholder');
        inputEl.className = 'flex-1 outline-none transition-all duration-200';
        inputEl.style.cssText = 
          'padding:' + (10 * scale) + 'px ' + (14 * scale) + 'px;' +
          'border-radius:' + (12 * scale) + 'px;' +
          'font-size:' + (13 * fontScale) + 'px;' +
          'background:' + colors.inputBg + ';' +
          'border:1px solid ' + colors.border + ';' +
          'color:' + colors.text + ';';

        inputEl.onfocus = function() {
          inputEl.style.borderColor = colors.primary;
          inputEl.style.boxShadow = '0 0 0 3px ' + colors.primary + '20';
        };
        inputEl.onblur = function() {
          inputEl.style.borderColor = colors.border;
          inputEl.style.boxShadow = 'none';
        };
        inputRow.appendChild(inputEl);

        var sendBtn = document.createElement('button');
        sendBtn.className = 'flex-shrink-0 flex items-center justify-center border-none cursor-pointer transition-opacity duration-200';
        sendBtn.style.cssText = 
          'width:' + (36 * scale) + 'px;height:' + (36 * scale) + 'px;' +
          'border-radius:' + (10 * scale) + 'px;' +
          'background:' + colors.primary + ';';
        sendBtn.innerHTML = '<svg width="' + (14 * scale) + '" height="' + (14 * scale) + '" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

        sendBtn.onmouseenter = function() { sendBtn.style.opacity = '0.85'; };
        sendBtn.onmouseleave = function() { sendBtn.style.opacity = '1'; };
        inputRow.appendChild(sendBtn);

        inputArea.appendChild(inputRow);
        content.appendChild(inputArea);

        // Widget 内消息历史
        var widgetMessages = [];
        var isWidgetSending = false;

        function addWidgetMessage(role, content) {
          widgetMessages.push({ role: role, content: content });
          renderWidgetMessages();
        }

        function renderWidgetMessages() {
          // 清除空状态
          if (widgetMessages.length > 0) {
            msgArea.innerHTML = '';
          }
          
          // 只显示最近 4 条消息
          var recentMsgs = widgetMessages.slice(-4);
          recentMsgs.forEach(function(msg) {
            var bubble = document.createElement('div');
            var isUser = msg.role === 'user';
            bubble.style.cssText = 
              'max-width:85%;padding:' + (8 * scale) + 'px ' + (12 * scale) + 'px;' +
              'border-radius:' + (12 * scale) + 'px;' +
              'font-size:' + (12 * fontScale) + 'px;' +
              'word-break:break-word;' +
              'align-self:' + (isUser ? 'flex-end' : 'flex-start') + ';' +
              'background:' + (isUser ? colors.primary : colors.aiBubble) + ';' +
              'color:' + (isUser ? 'white' : colors.text) + ';';
            bubble.innerHTML = formatMessage(escapeHtml(msg.content));
            msgArea.appendChild(bubble);
          });
          
          msgArea.scrollTop = msgArea.scrollHeight;
        }

        function doWidgetSend() {
          var text = inputEl.value.trim();
          if (!text || isWidgetSending) return;
          
          isWidgetSending = true;
          sendBtn.style.opacity = '0.5';
          inputEl.value = '';
          
          addWidgetMessage('user', text);

          // 添加加载状态
          var loadingBubble = document.createElement('div');
          loadingBubble.style.cssText = 
            'padding:' + (8 * scale) + 'px ' + (12 * scale) + 'px;' +
            'border-radius:' + (12 * scale) + 'px;' +
            'font-size:' + (12 * fontScale) + 'px;' +
            'background:' + colors.aiBubble + ';' +
            'color:' + colors.subtext + ';' +
            'align-self:flex-start;';
          loadingBubble.textContent = t('sending');
          msgArea.appendChild(loadingBubble);
          msgArea.scrollTop = msgArea.scrollHeight;

          // 构建消息历史
          var chatMessages = widgetMessages.map(function(m) {
            return { role: m.role, content: m.content };
          });

          Tapp.ai.chat(chatMessages, {}, { maxTokens: 500 })
            .then(function(resp) {
              msgArea.removeChild(loadingBubble);
              if (resp && resp.success && resp.result) {
                var reply = resp.result.content || resp.result;
                addWidgetMessage('assistant', reply);
              } else {
                throw new Error(resp.error || 'Unknown error');
              }
            })
            .catch(function(err) {
              msgArea.removeChild(loadingBubble);
              addWidgetMessage('assistant', '❌ ' + (err.message || t('error')));
            })
            .finally(function() {
              isWidgetSending = false;
              sendBtn.style.opacity = '1';
            });
        }

        sendBtn.onclick = doWidgetSend;
        inputEl.onkeydown = function(e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            doWidgetSend();
          }
        };
      }

      main.appendChild(content);

      // 编辑模式指示器
      if (props.isEditMode) {
        var editIndicator = document.createElement('div');
        editIndicator.className = 'absolute inset-0 border-2 border-dashed border-violet-400 rounded-xl pointer-events-none';
        editIndicator.style.zIndex = '100';
        main.appendChild(editIndicator);
      }

      container.appendChild(main);
      console.log('[AI Chat Widget] 渲染完成');

    } catch (err) {
      console.error('[AI Chat Widget] 渲染错误:', err);
      container.innerHTML = '<div style="color:red;padding:16px;font-size:12px;">Widget Error: ' + err.message + '</div>';
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

    if (response && response.success && response.result) {
      var aiReply = response.result.content || response.result;
      pageState.messages.push({ role: 'assistant', content: aiReply });
      saveHistory();
      renderMessages();
    } else {
      throw new Error(response.error || 'Unknown error');
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
