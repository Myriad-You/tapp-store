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
    '@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }',
    '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }',
    '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }',
    '@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }',
    '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
    '@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }',
    '@keyframes typingDot { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-4px); } }',
    '@keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }',
    '@keyframes slideInRight { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }',
    '@keyframes slideInLeft { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }',
    '@keyframes glowPulse { 0%, 100% { box-shadow: 0 0 0 0 var(--glow-color, rgba(139, 92, 246, 0.4)); } 50% { box-shadow: 0 0 20px 4px var(--glow-color, rgba(139, 92, 246, 0.2)); } }',
  ].join('\n');
  document.head.appendChild(style);
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

      // ========== 主容器 ==========
      var main = document.createElement('div');
      main.style.cssText = [
        'position:absolute;inset:0;border-radius:' + (16 * scale) + 'px;overflow:hidden',
        'background:' + (isDark ? 'linear-gradient(145deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))' : 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,250,252,0.95))'),
        'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)',
        'border:1px solid ' + (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
        'box-shadow:' + (isDark ? '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)'),
        'animation:scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
      ].join(';');

      // 装饰渐变
      var gradient = document.createElement('div');
      gradient.style.cssText = [
        'position:absolute;inset:0;pointer-events:none;opacity:0.6',
        'background:radial-gradient(ellipse at top right, ' + colors.primary + '15 0%, transparent 50%), radial-gradient(ellipse at bottom left, ' + colors.primary + '08 0%, transparent 40%)'
      ].join(';');
      main.appendChild(gradient);

      // 顶部光效线
      var glowLine = document.createElement('div');
      glowLine.style.cssText = [
        'position:absolute;top:0;left:10%;right:10%;height:1px',
        'background:linear-gradient(90deg, transparent, ' + colors.primary + '60, transparent)',
        'opacity:0.8'
      ].join(';');
      main.appendChild(glowLine);

      var content = document.createElement('div');
      content.style.cssText = 'position:relative;z-index:10;height:100%;display:flex;flex-direction:column;';

      if (isCompact) {
        // ========== 4x2 紧凑布局 ==========
        content.style.cssText = 'position:relative;z-index:10;height:100%;display:flex;align-items:center;gap:' + (12 * scale) + 'px;padding:' + (14 * scale) + 'px ' + (16 * scale) + 'px;';

        // AI 图标（带呼吸动画）
        var iconWrap = document.createElement('div');
        iconWrap.style.cssText = [
          'flex-shrink:0;width:' + (44 * scale) + 'px;height:' + (44 * scale) + 'px',
          'border-radius:' + (14 * scale) + 'px;display:flex;align-items:center;justify-content:center',
          'background:linear-gradient(135deg, ' + colors.primary + ', ' + colors.primary + 'cc)',
          'box-shadow:0 4px 16px ' + colors.primary + '40',
          'animation:glowPulse 3s ease-in-out infinite',
          '--glow-color:' + colors.primary + '40'
        ].join(';');
        iconWrap.innerHTML = '<svg width="' + (22 * scale) + '" height="' + (22 * scale) + '" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="8" rx="2"/><path d="M12 16v4h4"/><circle cx="12" cy="12" r="2"/></svg>';
        content.appendChild(iconWrap);

        // 输入区域容器
        var inputContainer = document.createElement('div');
        inputContainer.style.cssText = 'flex:1;min-width:0;position:relative;';

        // 输入框
        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = t('placeholder');
        input.style.cssText = [
          'width:100%;padding:' + (12 * scale) + 'px ' + (16 * scale) + 'px',
          'border-radius:' + (12 * scale) + 'px;font-size:' + (14 * fontScale) + 'px',
          'background:' + (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'),
          'border:1.5px solid ' + (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
          'color:' + colors.text + ';outline:none',
          'transition:all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          'font-family:inherit'
        ].join(';');
        
        input.onfocus = function() {
          input.style.borderColor = colors.primary;
          input.style.boxShadow = '0 0 0 4px ' + colors.primary + '20, 0 2px 8px ' + colors.primary + '15';
          input.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
        };
        input.onblur = function() {
          input.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
          input.style.boxShadow = 'none';
          input.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';
        };
        inputContainer.appendChild(input);

        // 回复显示区（初始隐藏）
        var replyArea = document.createElement('div');
        replyArea.style.cssText = [
          'display:none;padding:' + (10 * scale) + 'px ' + (14 * scale) + 'px',
          'background:' + (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'),
          'border-radius:' + (10 * scale) + 'px;font-size:' + (13 * fontScale) + 'px',
          'color:' + colors.text + ';line-height:1.5;max-height:100%;overflow:hidden',
          'animation:fadeIn 0.3s ease-out'
        ].join(';');
        inputContainer.appendChild(replyArea);
        content.appendChild(inputContainer);

        // 发送按钮
        var sendBtn = document.createElement('button');
        sendBtn.style.cssText = [
          'flex-shrink:0;width:' + (44 * scale) + 'px;height:' + (44 * scale) + 'px',
          'border-radius:' + (12 * scale) + 'px;border:none;cursor:pointer',
          'background:linear-gradient(135deg, ' + colors.primary + ', ' + colors.primary + 'dd)',
          'display:flex;align-items:center;justify-content:center',
          'transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          'box-shadow:0 4px 12px ' + colors.primary + '30'
        ].join(';');
        sendBtn.innerHTML = '<svg width="' + (18 * scale) + '" height="' + (18 * scale) + '" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
        
        sendBtn.onmouseenter = function() {
          if (!sending) {
            sendBtn.style.transform = 'scale(1.05)';
            sendBtn.style.boxShadow = '0 6px 20px ' + colors.primary + '50';
          }
        };
        sendBtn.onmouseleave = function() {
          sendBtn.style.transform = 'scale(1)';
          sendBtn.style.boxShadow = '0 4px 12px ' + colors.primary + '30';
        };
        content.appendChild(sendBtn);

        // 状态逻辑
        var sending = false;
        
        function showLoading() {
          input.style.display = 'none';
          replyArea.style.display = 'block';
          replyArea.innerHTML = '<div style="display:flex;align-items:center;gap:' + (6 * scale) + 'px;color:' + colors.subtext + '"><div style="display:flex;gap:3px;"><span style="width:6px;height:6px;border-radius:50%;background:' + colors.primary + ';animation:typingDot 1.4s infinite;animation-delay:0s"></span><span style="width:6px;height:6px;border-radius:50%;background:' + colors.primary + ';animation:typingDot 1.4s infinite;animation-delay:0.2s"></span><span style="width:6px;height:6px;border-radius:50%;background:' + colors.primary + ';animation:typingDot 1.4s infinite;animation-delay:0.4s"></span></div><span>' + t('sending') + '</span></div>';
        }

        function showReply(text) {
          var displayText = text.length > 80 ? text.substring(0, 80) + '...' : text;
          replyArea.innerHTML = '';
          replyArea.style.animation = 'fadeIn 0.3s ease-out';
          replyArea.textContent = displayText;
          setTimeout(function() { resetInput(); }, 5000);
        }

        function showError(msg) {
          replyArea.innerHTML = '<span style="color:#ef4444">❌ ' + msg + '</span>';
          setTimeout(function() { resetInput(); }, 3000);
        }

        function resetInput() {
          replyArea.style.display = 'none';
          input.style.display = 'block';
          input.style.animation = 'fadeIn 0.2s ease-out';
          input.focus();
        }

        function doSend() {
          var text = input.value.trim();
          if (!text || sending) return;
          
          sending = true;
          sendBtn.style.opacity = '0.6';
          sendBtn.style.pointerEvents = 'none';
          input.value = '';
          showLoading();

          Tapp.ai.chat([{ role: 'user', content: text }], {}, { maxTokens: 500 })
            .then(function(resp) {
              var aiMessage = resp?.message || resp;
              var replyContent = aiMessage?.content;
              if (replyContent) {
                showReply(replyContent);
              } else {
                throw new Error(resp?.error || 'No content');
              }
            })
            .catch(function(err) {
              showError(err.message || t('error'));
            })
            .finally(function() {
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
        // ========== 4x4 完整布局 ==========
        
        // 头部
        var header = document.createElement('div');
        header.style.cssText = [
          'display:flex;align-items:center;gap:' + (10 * scale) + 'px',
          'padding:' + (14 * scale) + 'px ' + (16 * scale) + 'px',
          'border-bottom:1px solid ' + (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')
        ].join(';');

        // 头部图标
        var headerIcon = document.createElement('div');
        headerIcon.style.cssText = [
          'width:' + (34 * scale) + 'px;height:' + (34 * scale) + 'px',
          'border-radius:' + (10 * scale) + 'px;display:flex;align-items:center;justify-content:center',
          'background:linear-gradient(135deg, ' + colors.primary + '25, ' + colors.primary + '10)'
        ].join(';');
        headerIcon.innerHTML = '<svg width="' + (18 * scale) + '" height="' + (18 * scale) + '" viewBox="0 0 24 24" fill="none" stroke="' + colors.primary + '" stroke-width="2"><path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="8" rx="2"/><path d="M12 16v4h4"/></svg>';
        header.appendChild(headerIcon);

        var headerTitle = document.createElement('span');
        headerTitle.style.cssText = 'flex:1;font-size:' + (15 * fontScale) + 'px;font-weight:600;color:' + colors.text;
        headerTitle.textContent = t('widgetTitle');
        header.appendChild(headerTitle);

        // 状态指示器
        var statusIndicator = document.createElement('div');
        statusIndicator.style.cssText = [
          'display:flex;align-items:center;gap:' + (6 * scale) + 'px',
          'padding:' + (4 * scale) + 'px ' + (10 * scale) + 'px',
          'background:' + (isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)'),
          'border-radius:' + (20 * scale) + 'px;font-size:' + (11 * fontScale) + 'px;color:#22c55e'
        ].join(';');
        statusIndicator.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;animation:pulse 2s infinite"></span><span>Online</span>';
        header.appendChild(statusIndicator);
        content.appendChild(header);

        // 消息区域
        var msgArea = document.createElement('div');
        msgArea.style.cssText = [
          'flex:1;overflow-y:auto;overflow-x:hidden;padding:' + (12 * scale) + 'px',
          'display:flex;flex-direction:column;gap:' + (10 * scale) + 'px',
          'scroll-behavior:smooth'
        ].join(';');

        // 空状态
        var emptyState = document.createElement('div');
        emptyState.style.cssText = [
          'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center',
          'padding:' + (12 * scale) + 'px;animation:fadeIn 0.5s ease-out'
        ].join(';');

        var emptyIcon = document.createElement('div');
        emptyIcon.style.cssText = [
          'width:' + (48 * scale) + 'px;height:' + (48 * scale) + 'px;margin-bottom:' + (10 * scale) + 'px',
          'border-radius:' + (14 * scale) + 'px;display:flex;align-items:center;justify-content:center',
          'background:linear-gradient(135deg, ' + colors.primary + '20, ' + colors.primary + '08)'
        ].join(';');
        emptyIcon.innerHTML = '<svg width="' + (24 * scale) + '" height="' + (24 * scale) + '" viewBox="0 0 24 24" fill="none" stroke="' + colors.primary + '" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>';
        emptyState.appendChild(emptyIcon);

        var emptyText = document.createElement('div');
        emptyText.style.cssText = 'font-size:' + (12 * fontScale) + 'px;color:' + colors.subtext + ';margin-bottom:' + (12 * scale) + 'px;';
        emptyText.textContent = t('startChat');
        emptyState.appendChild(emptyText);

        // 快捷提示
        var hintsWrap = document.createElement('div');
        hintsWrap.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:' + (6 * scale) + 'px;';
        t('hints').forEach(function(hint, i) {
          var hintBtn = document.createElement('button');
          hintBtn.style.cssText = [
            'padding:' + (6 * scale) + 'px ' + (12 * scale) + 'px',
            'border-radius:' + (8 * scale) + 'px;border:none;cursor:pointer',
            'font-size:' + (11 * fontScale) + 'px;font-family:inherit',
            'background:' + (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
            'color:' + colors.subtext,
            'transition:all 0.2s;animation:fadeInUp 0.3s ease-out both',
            'animation-delay:' + (i * 0.05) + 's'
          ].join(';');
          hintBtn.textContent = hint;
          hintBtn.onmouseenter = function() {
            hintBtn.style.background = colors.primary + '20';
            hintBtn.style.color = colors.primary;
            hintBtn.style.transform = 'translateY(-2px)';
          };
          hintBtn.onmouseleave = function() {
            hintBtn.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
            hintBtn.style.color = colors.subtext;
            hintBtn.style.transform = 'translateY(0)';
          };
          hintBtn.onclick = function() {
            inputEl.value = hint;
            inputEl.focus();
          };
          hintsWrap.appendChild(hintBtn);
        });
        emptyState.appendChild(hintsWrap);
        msgArea.appendChild(emptyState);
        content.appendChild(msgArea);

        // 输入区域
        var inputArea = document.createElement('div');
        inputArea.style.cssText = [
          'padding:' + (12 * scale) + 'px',
          'border-top:1px solid ' + (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
          'background:' + (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)')
        ].join(';');

        var inputRow = document.createElement('div');
        inputRow.style.cssText = 'display:flex;align-items:center;gap:' + (10 * scale) + 'px;';

        var inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.placeholder = t('placeholder');
        inputEl.style.cssText = [
          'flex:1;padding:' + (11 * scale) + 'px ' + (14 * scale) + 'px',
          'border-radius:' + (12 * scale) + 'px;font-size:' + (13 * fontScale) + 'px',
          'background:' + (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'),
          'border:1.5px solid ' + (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
          'color:' + colors.text + ';outline:none;font-family:inherit',
          'transition:all 0.2s'
        ].join(';');
        inputEl.onfocus = function() {
          inputEl.style.borderColor = colors.primary;
          inputEl.style.boxShadow = '0 0 0 3px ' + colors.primary + '15';
        };
        inputEl.onblur = function() {
          inputEl.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
          inputEl.style.boxShadow = 'none';
        };
        inputRow.appendChild(inputEl);

        var sendBtn = document.createElement('button');
        sendBtn.style.cssText = [
          'width:' + (38 * scale) + 'px;height:' + (38 * scale) + 'px',
          'border-radius:' + (10 * scale) + 'px;border:none;cursor:pointer',
          'background:linear-gradient(135deg, ' + colors.primary + ', ' + colors.primary + 'dd)',
          'display:flex;align-items:center;justify-content:center',
          'transition:all 0.2s;box-shadow:0 3px 10px ' + colors.primary + '25'
        ].join(';');
        sendBtn.innerHTML = '<svg width="' + (16 * scale) + '" height="' + (16 * scale) + '" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
        sendBtn.onmouseenter = function() { if (!isWidgetSending) sendBtn.style.transform = 'scale(1.08)'; };
        sendBtn.onmouseleave = function() { sendBtn.style.transform = 'scale(1)'; };
        inputRow.appendChild(sendBtn);
        inputArea.appendChild(inputRow);
        content.appendChild(inputArea);

        // 消息逻辑
        var widgetMessages = [];
        var isWidgetSending = false;

        function createBubble(msg, animated) {
          var isUser = msg.role === 'user';
          var wrapper = document.createElement('div');
          wrapper.style.cssText = [
            'display:flex;gap:' + (8 * scale) + 'px;align-items:flex-end',
            'flex-direction:' + (isUser ? 'row-reverse' : 'row'),
            animated ? 'animation:' + (isUser ? 'slideInRight' : 'slideInLeft') + ' 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : ''
          ].join(';');

          var bubble = document.createElement('div');
          bubble.style.cssText = [
            'max-width:85%;padding:' + (10 * scale) + 'px ' + (14 * scale) + 'px',
            'border-radius:' + (14 * scale) + 'px ' + (14 * scale) + 'px ' + (isUser ? '4px' : (14 * scale) + 'px') + ' ' + (isUser ? (14 * scale) + 'px' : '4px'),
            'font-size:' + (12 * fontScale) + 'px;line-height:1.5;word-break:break-word',
            'background:' + (isUser ? 'linear-gradient(135deg, ' + colors.primary + ', ' + colors.primary + 'dd)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)')),
            'color:' + (isUser ? 'white' : colors.text),
            isUser ? 'box-shadow:0 2px 8px ' + colors.primary + '30' : ''
          ].join(';');
          bubble.innerHTML = formatMessage(escapeHtml(msg.content));
          wrapper.appendChild(bubble);
          return wrapper;
        }

        function createTypingIndicator() {
          var wrapper = document.createElement('div');
          wrapper.id = 'typing-indicator';
          wrapper.style.cssText = 'display:flex;gap:' + (8 * scale) + 'px;align-items:flex-end;animation:fadeIn 0.2s ease-out';
          var bubble = document.createElement('div');
          bubble.style.cssText = [
            'padding:' + (12 * scale) + 'px ' + (16 * scale) + 'px',
            'border-radius:' + (14 * scale) + 'px ' + (14 * scale) + 'px ' + (14 * scale) + 'px 4px',
            'background:' + (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'),
            'display:flex;gap:4px;align-items:center'
          ].join(';');
          bubble.innerHTML = [
            '<span style="width:7px;height:7px;border-radius:50%;background:' + colors.primary + ';animation:typingDot 1.4s infinite"></span>',
            '<span style="width:7px;height:7px;border-radius:50%;background:' + colors.primary + ';animation:typingDot 1.4s infinite;animation-delay:0.2s"></span>',
            '<span style="width:7px;height:7px;border-radius:50%;background:' + colors.primary + ';animation:typingDot 1.4s infinite;animation-delay:0.4s"></span>'
          ].join('');
          wrapper.appendChild(bubble);
          return wrapper;
        }

        function renderMessages() {
          msgArea.innerHTML = '';
          if (widgetMessages.length === 0) {
            msgArea.appendChild(emptyState);
            return;
          }
          widgetMessages.slice(-6).forEach(function(msg, i) {
            msgArea.appendChild(createBubble(msg, i === widgetMessages.length - 1));
          });
          msgArea.scrollTop = msgArea.scrollHeight;
        }

        function doWidgetSend() {
          var text = inputEl.value.trim();
          if (!text || isWidgetSending) return;
          
          isWidgetSending = true;
          sendBtn.style.opacity = '0.6';
          inputEl.value = '';
          
          widgetMessages.push({ role: 'user', content: text });
          renderMessages();
          
          msgArea.appendChild(createTypingIndicator());
          msgArea.scrollTop = msgArea.scrollHeight;

          var chatMsgs = widgetMessages.map(function(m) { return { role: m.role, content: m.content }; });

          Tapp.ai.chat(chatMsgs, {}, { maxTokens: 500 })
            .then(function(resp) {
              var indicator = document.getElementById('typing-indicator');
              if (indicator) indicator.remove();
              var aiMsg = resp?.message || resp;
              if (aiMsg?.content) {
                widgetMessages.push({ role: 'assistant', content: aiMsg.content });
                renderMessages();
              } else {
                throw new Error(resp?.error || 'No content');
              }
            })
            .catch(function(err) {
              var indicator = document.getElementById('typing-indicator');
              if (indicator) indicator.remove();
              widgetMessages.push({ role: 'assistant', content: '❌ ' + (err.message || t('error')) });
              renderMessages();
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

      // 编辑模式
      if (props.isEditMode) {
        var editOverlay = document.createElement('div');
        editOverlay.style.cssText = [
          'position:absolute;inset:0;border:2px dashed ' + colors.primary,
          'border-radius:' + (16 * scale) + 'px;pointer-events:none;z-index:100',
          'background:' + colors.primary + '08'
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
