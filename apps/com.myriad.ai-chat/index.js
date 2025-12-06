// AI Chat Tapp v1.0 - Core
// AI 聊天助手 - 核心代码
// 使用 Tailwind + Glass 风格 + i18n 国际化
// Widget 支持 4x2 和 4x4 尺寸

console.log('[AI Chat] Core 加载中...');

// ========== i18n 翻译表 ==========
var i18n = {
  'zh-CN': {
    title: 'AI 聊天助手',
    subtitle: '由 AI 驱动的智能对话',
    widgetTitle: 'AI 助手',
    placeholder: '输入你的问题...',
    placeholderFull: '输入你的问题...（按 Enter 发送，Shift+Enter 换行）',
    send: '发送',
    sending: '生成中...',
    clearChat: '清空对话',
    clearSuccess: '对话已清空',
    clearMessage: '开始新的对话吧',
    startChat: '开始对话吧',
    welcome: '你好！我是 AI 助手',
    welcomeSubtitle: '有什么可以帮助你的吗？',
    errorGenerate: '抱歉，生成回复时遇到了问题：',
    errorNoResponse: '抱歉，我暂时无法回答这个问题。',
    examples: ['解释一下人工智能', '帮我写一首诗', '如何学习编程', '推荐一部电影'],
    hints: ['写代码', '翻译', '解释概念', '头脑风暴'],
  },
  'en-US': {
    title: 'AI Chat Assistant',
    subtitle: 'AI-powered intelligent conversation',
    widgetTitle: 'AI Assistant',
    placeholder: 'Ask a question...',
    placeholderFull: 'Ask a question... (Press Enter to send, Shift+Enter for new line)',
    send: 'Send',
    sending: 'Generating...',
    clearChat: 'Clear Chat',
    clearSuccess: 'Chat Cleared',
    clearMessage: 'Start a new conversation',
    startChat: 'Start chatting',
    welcome: 'Hello! I\'m your AI Assistant',
    welcomeSubtitle: 'How can I help you today?',
    errorGenerate: 'Sorry, there was an error generating a response: ',
    errorNoResponse: 'Sorry, I cannot answer this question at the moment.',
    examples: ['Explain artificial intelligence', 'Write me a poem', 'How to learn programming', 'Recommend a movie'],
    hints: ['Code', 'Translate', 'Explain', 'Brainstorm'],
  },
  'ja-JP': {
    title: 'AI チャットアシスタント',
    subtitle: 'AI駆動のインテリジェント会話',
    widgetTitle: 'AI アシスタント',
    placeholder: '質問を入力...',
    placeholderFull: '質問を入力...（Enterで送信、Shift+Enterで改行）',
    send: '送信',
    sending: '生成中...',
    clearChat: 'クリア',
    clearSuccess: 'チャットをクリア',
    clearMessage: '新しい会話を始めましょう',
    startChat: '会話を始めましょう',
    welcome: 'こんにちは！AI アシスタントです',
    welcomeSubtitle: '何かお手伝いできますか？',
    errorGenerate: '申し訳ありません。応答の生成中にエラーが発生しました：',
    errorNoResponse: '申し訳ありません。この質問には現在お答えできません。',
    examples: ['人工知能について説明して', '詩を書いて', 'プログラミングの学び方', '映画のおすすめ'],
    hints: ['コード', '翻訳', '説明', 'アイデア'],
  },
};

// 当前语言（默认中文）
var currentLocale = 'zh-CN';

// 规范化语言代码
function normalizeLocale(locale) {
  if (!locale) return 'zh-CN';
  var l = locale.toLowerCase();
  if (l.startsWith('zh')) return 'zh-CN';
  if (l.startsWith('en')) return 'en-US';
  if (l.startsWith('ja')) return 'ja-JP';
  return 'zh-CN';
}

// 获取翻译文本
function t(key) {
  var keys = key.split('.');
  var value = i18n[currentLocale] || i18n['zh-CN'];
  for (var i = 0; i < keys.length; i++) {
    value = value[keys[i]];
    if (value === undefined) return key;
  }
  return value;
}

// 时间格式化工具
function formatTime(date) {
  return new Date(date).toLocaleTimeString(currentLocale, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 主题颜色工具
function getThemeColors(isDark) {
  return {
    bg: isDark ? '#1a1a2e' : '#f8fafc',
    card: isDark ? '#262640' : '#ffffff',
    cardHover: isDark ? '#2d2d4a' : '#f1f5f9',
    border: isDark ? '#3d3d5c' : '#e2e8f0',
    text: isDark ? '#e2e8f0' : '#1e293b',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    accent: '#8b5cf6',
    accentHover: '#7c3aed',
  };
}

console.log('[AI Chat] Core 已加载');


// ========== WIDGET 代码（小组件渲染）==========
// Widget 模式只加载 core + widget，不执行 onReady
// 支持 4x2 和 4x4 尺寸，使用 Tailwind + Glass 风格

console.log('[AI Chat] Widget 加载中...');

Tapp.widgets['ai-chat'] = {
  render: async function(container, props) {
    var scale = props.scale || 1;
    var fontScale = props.fontScale || 1;
    var isDark = props.theme === 'dark';
    var themeColor = props.primaryColor || '#8b5cf6';
    var size = props.size || '4x4';
    var isCompact = size === '4x2'; // 4x2 紧凑模式
    
    // 设置当前语言
    currentLocale = normalizeLocale(props.locale);

    // 加载历史消息
    var messages = await Tapp.storage.get('widgetMessages') || [];
    var isGenerating = false;

    // 获取用户设置
    var maxTokens = await Tapp.settings.get('maxTokens') || 500;

    // 文字颜色
    var textColor = isDark ? '#f3f4f6' : '#1f2937';
    var subtextColor = isDark ? '#9ca3af' : '#6b7280';
    var borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

    // ========== 构建 HTML（使用 Tailwind 类） ==========
    var editModeOverlay = props.isEditMode 
      ? '<div class="absolute inset-0 border-2 border-dashed border-blue-400 rounded-xl pointer-events-none z-20"></div>'
      : '';

    // 渐变光晕背景
    var glowStyle = 'background: radial-gradient(circle, ' + themeColor + '15, transparent 70%);';
    
    // 根据尺寸决定布局
    if (isCompact) {
      // ========== 4x2 紧凑布局 ==========
      container.innerHTML = 
        '<div class="relative h-full w-full rounded-xl overflow-hidden glass">' +
          // 渐变装饰层
          '<div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent"></div>' +
          // 右上角光晕
          '<div class="absolute -right-1/4 -top-1/4 w-1/2 h-1/2 rounded-full blur-3xl pointer-events-none" style="' + glowStyle + '"></div>' +
          // 主内容区
          '<div class="relative z-10 h-full flex flex-col">' +
            // 头部 + 输入区合并
            '<div class="flex items-center gap-2 p-3" style="padding:' + (12 * scale) + 'px;">' +
              '<span style="font-size:' + (18 * scale) + 'px;">🤖</span>' +
              '<input type="text" id="ai-chat-input" placeholder="' + t('placeholder') + '" ' +
                'class="flex-1 px-3 py-2 rounded-lg border outline-none transition-colors" ' +
                'style="font-size:' + (13 * fontScale) + 'px;' +
                  'background:' + (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)') + ';' +
                  'border-color:' + borderColor + ';' +
                  'color:' + textColor + ';" />' +
              '<button id="ai-chat-send" class="flex items-center justify-center rounded-lg transition-opacity" ' +
                'style="width:' + (36 * scale) + 'px;height:' + (36 * scale) + 'px;background:' + themeColor + ';">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">' +
                  '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>' +
                '</svg>' +
              '</button>' +
            '</div>' +
            // 消息预览区
            '<div id="ai-chat-messages" class="flex-1 overflow-hidden px-3 pb-3" style="padding-left:' + (12 * scale) + 'px;padding-right:' + (12 * scale) + 'px;padding-bottom:' + (12 * scale) + 'px;">' +
            '</div>' +
          '</div>' +
          editModeOverlay +
        '</div>';
    } else {
      // ========== 4x4 完整布局 ==========
      container.innerHTML = 
        '<div class="relative h-full w-full rounded-xl overflow-hidden glass">' +
          // 渐变装饰层
          '<div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent"></div>' +
          // 右上角光晕
          '<div class="absolute -right-1/4 -top-1/4 w-1/2 h-1/2 rounded-full blur-3xl pointer-events-none" style="' + glowStyle + '"></div>' +
          // 主内容区
          '<div class="relative z-10 h-full flex flex-col">' +
            // 头部
            '<div class="flex items-center gap-2 border-b" style="padding:' + (14 * scale) + 'px ' + (16 * scale) + 'px;border-color:' + borderColor + ';">' +
              '<span style="font-size:' + (20 * scale) + 'px;">🤖</span>' +
              '<span class="flex-1 font-semibold" style="font-size:' + (15 * fontScale) + 'px;color:' + textColor + ';">' + t('widgetTitle') + '</span>' +
              '<div class="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></div>' +
              '<button id="ai-chat-clear" class="flex items-center justify-center rounded-lg transition-all opacity-60 hover:opacity-100" ' +
                'style="width:' + (28 * scale) + 'px;height:' + (28 * scale) + 'px;" title="' + t('clearChat') + '">' +
                '<span style="font-size:' + (14 * scale) + 'px;">🗑️</span>' +
              '</button>' +
            '</div>' +
            // 消息区域
            '<div id="ai-chat-messages" class="flex-1 overflow-y-auto flex flex-col gap-3" style="padding:' + (12 * scale) + 'px;">' +
            '</div>' +
            // 输入区域
            '<div class="border-t" style="padding:' + (12 * scale) + 'px ' + (14 * scale) + 'px;border-color:' + borderColor + ';">' +
              '<div class="flex gap-2 items-center">' +
                '<input type="text" id="ai-chat-input" placeholder="' + t('placeholder') + '" ' +
                  'class="flex-1 px-3 py-2.5 rounded-xl border outline-none transition-colors" ' +
                  'style="font-size:' + (13 * fontScale) + 'px;' +
                    'background:' + (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)') + ';' +
                    'backdrop-filter:blur(4px);' +
                    'border-color:' + (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)') + ';' +
                    'color:' + textColor + ';" />' +
                '<button id="ai-chat-send" class="flex items-center justify-center rounded-xl transition-opacity hover:opacity-90" ' +
                  'style="width:' + (38 * scale) + 'px;height:' + (38 * scale) + 'px;background:' + themeColor + ';flex-shrink:0;">' +
                  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">' +
                    '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>' +
                  '</svg>' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          editModeOverlay +
        '</div>';
    }

    // ========== 获取 DOM 元素 ==========
    var messagesArea = container.querySelector('#ai-chat-messages');
    var chatInput = container.querySelector('#ai-chat-input');
    var sendBtn = container.querySelector('#ai-chat-send');
    var clearBtn = container.querySelector('#ai-chat-clear');

    // ========== 输入框焦点样式 ==========
    if (chatInput) {
      chatInput.addEventListener('focus', function() {
        chatInput.style.borderColor = themeColor;
      });
      chatInput.addEventListener('blur', function() {
        chatInput.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
      });
    }

    // ========== 渲染消息列表 ==========
    function renderMessages() {
      if (!messagesArea) return;
      messagesArea.innerHTML = '';

      if (messages.length === 0) {
        // 空状态
        if (isCompact) {
          // 4x2 紧凑模式 - 简单提示
          var emptyEl = document.createElement('div');
          emptyEl.className = 'flex items-center justify-center h-full';
          emptyEl.innerHTML = 
            '<span style="font-size:' + (12 * fontScale) + 'px;color:' + subtextColor + ';">' + t('startChat') + '</span>';
          messagesArea.appendChild(emptyEl);
        } else {
          // 4x4 完整模式 - 欢迎界面 + 提示按钮
          var emptyState = document.createElement('div');
          emptyState.className = 'flex-1 flex flex-col items-center justify-center text-center';
          emptyState.style.padding = (16 * scale) + 'px';

          var emptyIcon = document.createElement('div');
          emptyIcon.style.cssText = 'font-size:' + (40 * scale) + 'px;margin-bottom:' + (12 * scale) + 'px;opacity:0.5;';
          emptyIcon.textContent = '💬';

          var emptyText = document.createElement('div');
          emptyText.style.cssText = 'font-size:' + (13 * fontScale) + 'px;color:' + subtextColor + ';margin-bottom:' + (16 * scale) + 'px;';
          Tapp.dom.setText(emptyText, t('startChat'));

          // 提示词按钮
          var hintsContainer = document.createElement('div');
          hintsContainer.className = 'flex flex-wrap justify-center gap-2';

          var hints = t('hints');
          hints.forEach(function(hint) {
            var hintBtn = document.createElement('button');
            hintBtn.className = 'px-3 py-1.5 rounded-lg border transition-all';
            hintBtn.style.cssText = 
              'font-size:' + (11 * fontScale) + 'px;' +
              'border-color:' + (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)') + ';' +
              'background:' + (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.5)') + ';' +
              'color:' + (isDark ? '#d1d5db' : '#374151') + ';';
            Tapp.dom.setText(hintBtn, hint);

            hintBtn.addEventListener('mouseenter', function() {
              hintBtn.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)';
              hintBtn.style.borderColor = themeColor;
              hintBtn.style.color = themeColor;
            });
            hintBtn.addEventListener('mouseleave', function() {
              hintBtn.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.5)';
              hintBtn.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
              hintBtn.style.color = isDark ? '#d1d5db' : '#374151';
            });
            hintBtn.addEventListener('click', function() {
              if (chatInput) {
                chatInput.value = hint + '：';
                chatInput.focus();
              }
            });

            hintsContainer.appendChild(hintBtn);
          });

          emptyState.appendChild(emptyIcon);
          emptyState.appendChild(emptyText);
          emptyState.appendChild(hintsContainer);
          messagesArea.appendChild(emptyState);
        }
        return;
      }

      // 显示消息
      var displayCount = isCompact ? Math.min(messages.length, 2) : Math.min(messages.length, 10);
      var displayMessages = messages.slice(-displayCount);

      displayMessages.forEach(function(msg) {
        var msgContainer = document.createElement('div');
        msgContainer.className = 'flex gap-2 items-start' + (msg.role === 'user' ? ' flex-row-reverse' : '');
        msgContainer.style.gap = (isCompact ? 6 : 10) * scale + 'px';

        // 头像（4x4 显示，4x2 隐藏）
        if (!isCompact) {
          var avatar = document.createElement('div');
          avatar.className = 'flex items-center justify-center flex-shrink-0 rounded-lg';
          avatar.style.cssText = 
            'width:' + (28 * scale) + 'px;' +
            'height:' + (28 * scale) + 'px;' +
            'font-size:' + (14 * scale) + 'px;' +
            'background:' + (msg.role === 'user' ? themeColor : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')) + ';';
          avatar.textContent = msg.role === 'user' ? '👤' : '🤖';
          msgContainer.appendChild(avatar);
        }

        // 消息气泡
        var bubble = document.createElement('div');
        var content = msg.content;
        var maxLen = isCompact ? 80 : 200;
        if (content.length > maxLen) {
          content = content.substring(0, maxLen) + '...';
        }
        
        var bubbleRadius = isCompact ? 10 : 14;
        var bubbleRadiusSmall = isCompact ? 3 : 4;
        bubble.className = 'max-w-[80%]';
        bubble.style.cssText = 
          'padding:' + ((isCompact ? 8 : 10) * scale) + 'px ' + ((isCompact ? 10 : 14) * scale) + 'px;' +
          'border-radius:' + (bubbleRadius * scale) + 'px;' +
          (msg.role === 'user' 
            ? 'border-bottom-right-radius:' + (bubbleRadiusSmall * scale) + 'px;background:' + themeColor + ';color:white;'
            : 'border-bottom-left-radius:' + (bubbleRadiusSmall * scale) + 'px;' +
              'background:' + (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)') + ';' +
              'backdrop-filter:blur(4px);color:' + textColor + ';') +
          'font-size:' + ((isCompact ? 12 : 13) * fontScale) + 'px;' +
          'line-height:1.5;' +
          'word-break:break-word;';
        Tapp.dom.setText(bubble, content);

        msgContainer.appendChild(bubble);
        messagesArea.appendChild(msgContainer);
      });

      // 滚动到底部
      setTimeout(function() {
        if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
      }, 10);
    }

    // ========== 发送消息 ==========
    async function sendMessage(text) {
      if (!text || isGenerating) return;
      text = text.trim();
      if (!text) return;

      isGenerating = true;
      if (sendBtn) sendBtn.disabled = true;
      if (chatInput) chatInput.value = '';

      // 添加用户消息
      messages.push({
        role: 'user',
        content: text,
        timestamp: Date.now()
      });
      renderMessages();

      try {
        var response = await Tapp.ai.generate({
          prompt: text,
          maxTokens: maxTokens
        });

        var content = '';
        if (response && response.success) {
          content = response.result || '';
        }

        if (content) {
          messages.push({
            role: 'assistant',
            content: content,
            timestamp: Date.now()
          });
        } else {
          messages.push({
            role: 'assistant',
            content: t('errorNoResponse'),
            timestamp: Date.now()
          });
        }

        // 限制历史数量
        var maxHistory = await Tapp.settings.get('maxHistory') || 100;
        if (messages.length > maxHistory) {
          messages = messages.slice(-maxHistory);
        }
        await Tapp.storage.set('widgetMessages', messages);

      } catch (error) {
        console.error('[AI Chat Widget] Error:', error);
        messages.push({
          role: 'assistant',
          content: t('errorGenerate') + (error && error.message ? error.message : 'Unknown error'),
          timestamp: Date.now()
        });
      }

      renderMessages();
      isGenerating = false;
      if (sendBtn) sendBtn.disabled = false;
    }

    // ========== 清空对话 ==========
    async function clearChat() {
      if (messages.length === 0) return;
      messages = [];
      await Tapp.storage.set('widgetMessages', []);
      renderMessages();
    }

    // ========== 绑定事件 ==========
    if (sendBtn) {
      sendBtn.addEventListener('click', function() {
        if (chatInput) sendMessage(chatInput.value);
      });
    }
    if (chatInput) {
      chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(chatInput.value);
        }
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', clearChat);
    }

    // 初始渲染
    renderMessages();

    console.log('[AI Chat] Widget 已渲染, 尺寸:', size);
  }
};

console.log('[AI Chat] Widget 已加载');


// ========== PAGE 代码（页面渲染 + 生命周期）==========
// Page 模式加载 core + page，执行完整生命周期
// 使用控制面板语言 + 自适应尺寸 + 语言切换监听

console.log('[AI Chat] Page 加载中...');

// 页面状态
var chatHistory = [];
var isGenerating = false;
var currentTheme = 'dark';
var currentLang = 'zh-CN';
var currentPrimaryColor = '#8b5cf6';

// 重新渲染页面的辅助函数
function rerender() {
  renderPage(currentLang, currentTheme === 'dark', currentPrimaryColor);
}

// 页面渲染函数
function renderPage(locale, isDarkTheme, primaryColor) {
  // 更新当前语言（规范化处理）
  currentLocale = normalizeLocale(locale);
  
  var isDark = isDarkTheme !== false;
  var themeColor = primaryColor || '#8b5cf6';

  // 获取框架提供的分层容器
  var bgLayer = document.getElementById('tapp-background');
  var contentLayer = document.getElementById('tapp-content');
  
  // 清空容器
  if (bgLayer) bgLayer.innerHTML = '';
  if (contentLayer) contentLayer.innerHTML = '';

  // 获取设置
  var maxTokens = 500;

  // ========== 背景层 ==========
  if (bgLayer) {
    bgLayer.style.background = isDark ? '#0a0a0a' : '#f8fafc';

    // 右上角渐变光晕
    var glow1 = document.createElement('div');
    glow1.style.cssText = 
      'position: absolute;' +
      'right: -10%;' +
      'top: -10%;' +
      'width: 50%;' +
      'height: 50%;' +
      'border-radius: 50%;' +
      'background: radial-gradient(circle, ' + themeColor + '20, transparent 70%);' +
      'filter: blur(60px);' +
      'pointer-events: none;';

    // 左下角渐变光晕
    var glow2 = document.createElement('div');
    glow2.style.cssText = 
      'position: absolute;' +
      'left: -10%;' +
      'bottom: -10%;' +
      'width: 40%;' +
      'height: 40%;' +
      'border-radius: 50%;' +
      'background: radial-gradient(circle, ' + themeColor + '15, transparent 70%);' +
      'filter: blur(60px);' +
      'pointer-events: none;';

    bgLayer.appendChild(glow1);
    bgLayer.appendChild(glow2);
  }

  // ========== 内容层 ==========
  if (!contentLayer) return;

  contentLayer.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  contentLayer.style.color = isDark ? '#f9fafb' : '#1f2937';

  // 主容器
  var mainContainer = document.createElement('div');
  mainContainer.style.cssText = 
    'height: 100%;' +
    'display: flex;' +
    'flex-direction: column;' +
    'max-width: 1280px;' +
    'margin: 0 auto;';

  // === 头部 ===
  var header = document.createElement('div');
  header.style.cssText = 
    'display: flex;' +
    'align-items: center;' +
    'gap: calc(12px * var(--tapp-scale, 1));' +
    'padding: calc(16px * var(--tapp-scale, 1)) calc(24px * var(--tapp-scale, 1));' +
    'background: ' + (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)') + ';' +
    'backdrop-filter: blur(12px);' +
    '-webkit-backdrop-filter: blur(12px);' +
    'border-bottom: 1px solid ' + (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') + ';';

  // 头部图标
  var headerIcon = document.createElement('div');
  headerIcon.style.cssText = 
    'width: calc(40px * var(--tapp-scale, 1));' +
    'height: calc(40px * var(--tapp-scale, 1));' +
    'border-radius: calc(12px * var(--tapp-scale, 1));' +
    'display: flex;' +
    'align-items: center;' +
    'justify-content: center;' +
    'font-size: calc(20px * var(--tapp-scale, 1));' +
    'background: linear-gradient(135deg, #6366f1 0%, ' + themeColor + ' 100%);';
  headerIcon.textContent = '🤖';

  // 头部文字区域
  var headerText = document.createElement('div');
  headerText.style.cssText = 'flex: 1;';

  var headerTitle = document.createElement('h1');
  headerTitle.style.cssText = 
    'margin: 0;' +
    'font-size: calc(18px * var(--tapp-font-scale, 1));' +
    'font-weight: 600;' +
    'color: ' + (isDark ? '#f3f4f6' : '#1f2937') + ';';
  Tapp.dom.setText(headerTitle, t('title'));

  var headerSubtitle = document.createElement('p');
  headerSubtitle.className = 'tapp-hide-compact';
  headerSubtitle.style.cssText = 
    'margin: 2px 0 0 0;' +
    'font-size: calc(12px * var(--tapp-font-scale, 1));' +
    'color: ' + (isDark ? '#9ca3af' : '#6b7280') + ';';
  Tapp.dom.setText(headerSubtitle, t('subtitle'));

  headerText.appendChild(headerTitle);
  headerText.appendChild(headerSubtitle);

  // 清空按钮
  var clearBtnPage = document.createElement('button');
  clearBtnPage.style.cssText = 
    'padding: calc(8px * var(--tapp-scale, 1)) calc(16px * var(--tapp-scale, 1));' +
    'font-size: calc(14px * var(--tapp-font-scale, 1));' +
    'border: 1px solid ' + (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)') + ';' +
    'border-radius: calc(8px * var(--tapp-scale, 1));' +
    'background: transparent;' +
    'color: ' + (isDark ? '#9ca3af' : '#6b7280') + ';' +
    'cursor: pointer;' +
    'transition: all 0.2s ease;';
  Tapp.dom.setText(clearBtnPage, t('clearChat'));

  clearBtnPage.onmouseenter = function() {
    clearBtnPage.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    clearBtnPage.style.color = themeColor;
    clearBtnPage.style.borderColor = themeColor;
  };
  clearBtnPage.onmouseleave = function() {
    clearBtnPage.style.background = 'transparent';
    clearBtnPage.style.color = isDark ? '#9ca3af' : '#6b7280';
    clearBtnPage.style.borderColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
  };

  header.appendChild(headerIcon);
  header.appendChild(headerText);
  header.appendChild(clearBtnPage);

  // === 消息区域 ===
  var messagesArea = document.createElement('div');
  messagesArea.style.cssText = 
    'flex: 1;' +
    'overflow-y: auto;' +
    'padding: calc(24px * var(--tapp-scale, 1));';

  // === 输入区域 ===
  var inputArea = document.createElement('div');
  inputArea.style.cssText = 
    'padding: calc(16px * var(--tapp-scale, 1)) calc(24px * var(--tapp-scale, 1));' +
    'background: ' + (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)') + ';' +
    'backdrop-filter: blur(12px);' +
    '-webkit-backdrop-filter: blur(12px);' +
    'border-top: 1px solid ' + (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') + ';';

  var inputWrapper = document.createElement('div');
  inputWrapper.style.cssText = 
    'display: flex;' +
    'gap: calc(12px * var(--tapp-scale, 1));' +
    'max-width: 960px;' +
    'margin: 0 auto;';

  // 输入框
  var chatInput = document.createElement('textarea');
  chatInput.placeholder = t('placeholderFull');
  chatInput.rows = 1;
  chatInput.style.cssText = 
    'flex: 1;' +
    'padding: calc(12px * var(--tapp-scale, 1)) calc(16px * var(--tapp-scale, 1));' +
    'font-size: calc(14px * var(--tapp-font-scale, 1));' +
    'line-height: 1.5;' +
    'border: 2px solid ' + (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)') + ';' +
    'border-radius: calc(16px * var(--tapp-scale, 1));' +
    'background: ' + (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)') + ';' +
    'backdrop-filter: blur(4px);' +
    '-webkit-backdrop-filter: blur(4px);' +
    'color: ' + (isDark ? '#f3f4f6' : '#1f2937') + ';' +
    'resize: none;' +
    'outline: none;' +
    'min-height: calc(52px * var(--tapp-scale, 1));' +
    'max-height: 150px;' +
    'font-family: system-ui, -apple-system, sans-serif;' +
    'transition: border-color 0.2s ease;';

  chatInput.onfocus = function() {
    chatInput.style.borderColor = themeColor;
  };
  chatInput.onblur = function() {
    chatInput.style.borderColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
  };

  // 发送按钮
  var sendBtn = document.createElement('button');
  sendBtn.style.cssText = 
    'padding: calc(12px * var(--tapp-scale, 1)) calc(28px * var(--tapp-scale, 1));' +
    'font-size: calc(14px * var(--tapp-font-scale, 1));' +
    'font-weight: 500;' +
    'border: none;' +
    'border-radius: calc(16px * var(--tapp-scale, 1));' +
    'background: ' + themeColor + ';' +
    'color: white;' +
    'cursor: pointer;' +
    'align-self: flex-end;' +
    'transition: opacity 0.2s ease;';
  Tapp.dom.setText(sendBtn, t('send'));

  sendBtn.onmouseenter = function() { sendBtn.style.opacity = '0.9'; };
  sendBtn.onmouseleave = function() { sendBtn.style.opacity = '1'; };

  inputWrapper.appendChild(chatInput);
  inputWrapper.appendChild(sendBtn);
  inputArea.appendChild(inputWrapper);

  // 渲染消息列表
  function renderMessages() {
    messagesArea.innerHTML = '';

    if (chatHistory.length === 0) {
      // 欢迎界面
      var welcomeContainer = document.createElement('div');
      welcomeContainer.style.cssText = 
        'display: flex;' +
        'flex-direction: column;' +
        'align-items: center;' +
        'justify-content: center;' +
        'text-align: center;' +
        'padding: calc(64px * var(--tapp-scale, 1)) calc(24px * var(--tapp-scale, 1));';

      var emojiIcon = document.createElement('div');
      emojiIcon.style.cssText = 'font-size: calc(64px * var(--tapp-scale, 1)); margin-bottom: calc(24px * var(--tapp-scale, 1));';
      emojiIcon.textContent = '🤖';

      var welcomeTitle = document.createElement('div');
      welcomeTitle.style.cssText = 
        'font-size: calc(20px * var(--tapp-font-scale, 1));' +
        'font-weight: 600;' +
        'color: ' + (isDark ? '#f3f4f6' : '#1f2937') + ';' +
        'margin-bottom: calc(8px * var(--tapp-scale, 1));';
      Tapp.dom.setText(welcomeTitle, t('welcome'));

      var welcomeSubtitle = document.createElement('div');
      welcomeSubtitle.style.cssText = 
        'font-size: calc(14px * var(--tapp-font-scale, 1));' +
        'color: ' + (isDark ? '#9ca3af' : '#6b7280') + ';' +
        'margin-bottom: calc(32px * var(--tapp-scale, 1));';
      Tapp.dom.setText(welcomeSubtitle, t('welcomeSubtitle'));

      var examplesContainer = document.createElement('div');
      examplesContainer.style.cssText = 
        'display: flex;' +
        'flex-wrap: wrap;' +
        'justify-content: center;' +
        'gap: calc(12px * var(--tapp-scale, 1));' +
        'max-width: 560px;';

      var examples = t('examples');
      examples.forEach(function(q) {
        var exampleBtn = document.createElement('button');
        exampleBtn.style.cssText = 
          'padding: calc(8px * var(--tapp-scale, 1)) calc(16px * var(--tapp-scale, 1));' +
          'font-size: calc(14px * var(--tapp-font-scale, 1));' +
          'border: 1px solid ' + (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)') + ';' +
          'border-radius: calc(16px * var(--tapp-scale, 1));' +
          'background: ' + (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)') + ';' +
          'backdrop-filter: blur(4px);' +
          '-webkit-backdrop-filter: blur(4px);' +
          'color: ' + (isDark ? '#d1d5db' : '#374151') + ';' +
          'cursor: pointer;' +
          'transition: all 0.2s ease;';
        Tapp.dom.setText(exampleBtn, q);

        exampleBtn.onmouseenter = function() {
          exampleBtn.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)';
          exampleBtn.style.borderColor = themeColor;
          exampleBtn.style.color = themeColor;
        };
        exampleBtn.onmouseleave = function() {
          exampleBtn.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)';
          exampleBtn.style.borderColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
          exampleBtn.style.color = isDark ? '#d1d5db' : '#374151';
        };

        exampleBtn.onclick = function() {
          sendMessage(q);
        };

        examplesContainer.appendChild(exampleBtn);
      });

      welcomeContainer.appendChild(emojiIcon);
      welcomeContainer.appendChild(welcomeTitle);
      welcomeContainer.appendChild(welcomeSubtitle);
      welcomeContainer.appendChild(examplesContainer);
      messagesArea.appendChild(welcomeContainer);
      return;
    }

    // 渲染历史消息
    chatHistory.forEach(function(msg) {
      var msgContainer = document.createElement('div');
      msgContainer.style.cssText = 
        'display: flex;' +
        'gap: calc(12px * var(--tapp-scale, 1));' +
        'margin-bottom: calc(20px * var(--tapp-scale, 1));' +
        (msg.role === 'user' ? 'flex-direction: row-reverse;' : '');

      // 头像
      var avatar = document.createElement('div');
      avatar.style.cssText = 
        'width: calc(36px * var(--tapp-scale, 1));' +
        'height: calc(36px * var(--tapp-scale, 1));' +
        'border-radius: calc(8px * var(--tapp-scale, 1));' +
        'display: flex;' +
        'align-items: center;' +
        'justify-content: center;' +
        'flex-shrink: 0;' +
        'font-size: calc(18px * var(--tapp-scale, 1));' +
        'background: ' + (msg.role === 'user' ? themeColor : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')) + ';';
      avatar.textContent = msg.role === 'user' ? '👤' : '🤖';

      // 消息内容区域
      var contentArea = document.createElement('div');
      contentArea.style.cssText = 
        'display: flex;' +
        'flex-direction: column;' +
        'max-width: 70%;';

      // 消息气泡
      var bubble = document.createElement('div');
      bubble.style.cssText = 
        'padding: calc(12px * var(--tapp-scale, 1)) calc(16px * var(--tapp-scale, 1));' +
        'border-radius: calc(16px * var(--tapp-scale, 1));' +
        (msg.role === 'user' ? 'border-bottom-right-radius: calc(4px * var(--tapp-scale, 1));' : 'border-bottom-left-radius: calc(4px * var(--tapp-scale, 1));') +
        'background: ' + (msg.role === 'user' ? themeColor : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)')) + ';' +
        (msg.role !== 'user' ? 'backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);' : '') +
        'color: ' + (msg.role === 'user' ? 'white' : (isDark ? '#f3f4f6' : '#1f2937')) + ';' +
        'font-size: calc(14px * var(--tapp-font-scale, 1));' +
        'line-height: 1.6;' +
        'white-space: pre-wrap;' +
        'word-break: break-word;';
      Tapp.dom.setText(bubble, msg.content);

      // 时间戳
      var timestamp = document.createElement('div');
      timestamp.style.cssText = 
        'font-size: calc(10px * var(--tapp-font-scale, 1));' +
        'color: ' + (isDark ? '#9ca3af' : '#6b7280') + ';' +
        'margin-top: calc(6px * var(--tapp-scale, 1));' +
        (msg.role === 'user' ? 'text-align: right;' : '');
      Tapp.dom.setText(timestamp, formatTime(msg.timestamp));

      contentArea.appendChild(bubble);
      contentArea.appendChild(timestamp);

      msgContainer.appendChild(avatar);
      msgContainer.appendChild(contentArea);
      messagesArea.appendChild(msgContainer);
    });

    // 滚动到底部
    setTimeout(function() {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }, 10);
  }

  // 发送消息
  async function sendMessage(text) {
    if (!text || isGenerating) return;
    text = text.trim();
    if (!text) return;

    isGenerating = true;

    if (sendBtn) {
      sendBtn.disabled = true;
      Tapp.dom.setText(sendBtn, t('sending'));
    }

    chatHistory.push({
      role: 'user',
      content: text,
      timestamp: Date.now(),
    });

    renderMessages();
    if (chatInput) chatInput.value = '';

    try {
      // 获取设置
      var userMaxTokens = await Tapp.settings.get('maxTokens');
      maxTokens = userMaxTokens || 500;

      var response = await Tapp.ai.generate({
        prompt: text,
        maxTokens: maxTokens
      });

      var content = '';
      if (response && response.success) {
        content = response.result || '';
      }

      if (!content) {
        content = t('errorNoResponse');
      }

      chatHistory.push({
        role: 'assistant',
        content: content,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[AI Chat] 生成失败:', error);
      var errorMsg = error && error.message ? error.message : 'Unknown error';
      chatHistory.push({
        role: 'assistant',
        content: t('errorGenerate') + errorMsg,
        timestamp: Date.now(),
      });
    }

    // 保存历史
    try {
      var saveHistory = await Tapp.settings.get('saveHistory');
      if (saveHistory !== false) {
        var maxHistory = await Tapp.settings.get('maxHistory') || 100;
        if (chatHistory.length > maxHistory) {
          chatHistory = chatHistory.slice(-maxHistory);
        }
        await Tapp.storage.set('chatHistory', chatHistory);
      }
    } catch (e) {
      console.error('[AI Chat] 保存历史失败:', e);
    }

    renderMessages();

    isGenerating = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      Tapp.dom.setText(sendBtn, t('send'));
    }
  }

  // 清空对话
  async function clearChat() {
    if (chatHistory.length === 0) return;
    chatHistory = [];
    await Tapp.storage.set('chatHistory', []);
    renderMessages();
    await Tapp.ui.showNotification({
      title: t('clearSuccess'),
      message: t('clearMessage'),
      type: 'info',
    });
  }

  // 绑定事件
  sendBtn.onclick = function() {
    sendMessage(chatInput.value);
  };

  chatInput.onkeydown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(chatInput.value);
    }
  };

  chatInput.oninput = function() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
  };

  clearBtnPage.onclick = clearChat;

  // 组装容器
  mainContainer.appendChild(header);
  mainContainer.appendChild(messagesArea);
  mainContainer.appendChild(inputArea);
  contentLayer.appendChild(mainContainer);

  // 初始渲染消息
  renderMessages();

  console.log('[AI Chat] Page 已渲染');
}

// ===== 生命周期（仅 Page 模式执行）=====
Tapp.lifecycle.onReady(async function() {
  console.log('[AI Chat] 页面模式已就绪');

  try {
    // 获取控制面板语言
    currentLang = await Tapp.ui.getLocale();
    
    // 获取主题（'dark' 或 'light'）
    currentTheme = await Tapp.ui.getTheme();
    
    // 获取全局主色调（壁纸色）
    currentPrimaryColor = await Tapp.ui.getPrimaryColor();

    // 加载历史
    var saveHistory = await Tapp.settings.get('saveHistory');
    if (saveHistory !== false) {
      chatHistory = await Tapp.storage.get('chatHistory') || [];
    }
    
    // 渲染页面
    renderPage(currentLang, currentTheme === 'dark', currentPrimaryColor);
    
    // 监听语言变化
    Tapp.ui.onLocaleChange(function(newLocale) {
      currentLang = newLocale;
      rerender();
    });
    
    // 监听主题变化
    Tapp.ui.onThemeChange(function(newTheme) {
      currentTheme = newTheme;
      rerender();
    });
    
    // 监听主色调变化
    Tapp.ui.onPrimaryColorChange(function(newColor) {
      currentPrimaryColor = newColor;
      rerender();
    });
    
  } catch (error) {
    console.error('[AI Chat] 初始化失败:', error);
  }
});

Tapp.lifecycle.onDestroy(async function() {
  console.log('[AI Chat] 正在销毁...');
});

console.log('[AI Chat] Tapp 已加载');
