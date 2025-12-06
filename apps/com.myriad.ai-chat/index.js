// AI Chat Tapp v1.0 - Core
// AI 聊天助手 - 核心代码
// Widget 使用 Tailwind 类 + CSS 变量实现自适应

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

console.log('[AI Chat] Core 已加载');


// ========== WIDGET 代码（小组件渲染）==========
// Widget 使用 Tailwind 类 + Glass 风格
// 支持 4x2 和 4x4 尺寸
// scale/fontScale 从 CSS 变量或 window._TAPP_DIMENSIONS 获取

console.log('[AI Chat] Widget 加载中...');

Tapp.widgets['ai-chat'] = {
  render: async function(container, props) {
    // 获取 scale/fontScale - 从 props、CSS 变量或 _TAPP_DIMENSIONS
    var dims = window._TAPP_DIMENSIONS || {};
    var scale = props.scale || dims.scale || 1;
    var fontScale = props.fontScale || dims.fontScale || 1;
    var isDark = props.theme === 'dark';
    var themeColor = props.primaryColor || '#8b5cf6';
    var size = props.size || '4x2';
    var isCompact = size === '4x2'; // 4x2 紧凑模式
    
    // 设置当前语言
    currentLocale = normalizeLocale(props.locale);

    // 加载历史消息
    var messages = await Tapp.storage.get('widgetMessages') || [];
    var isGenerating = false;

    // 获取用户设置
    var maxTokens = await Tapp.settings.get('maxTokens') || 500;

    // 颜色定义
    var textColor = isDark ? '#f3f4f6' : '#1f2937';
    var subtextColor = isDark ? '#9ca3af' : '#6b7280';
    var borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
    var inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)';
    var cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)';

    // 清空容器
    container.innerHTML = '';
    container.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden;';

    // ========== 使用 Tailwind 类构建 HTML ==========
    var editModeOverlay = props.isEditMode 
      ? '<div class="absolute inset-0 border-2 border-dashed border-blue-400 rounded-xl pointer-events-none z-20"></div>'
      : '';

    // 根据尺寸选择不同布局
    if (isCompact) {
      // ========== 4x2 紧凑布局 ==========
      container.innerHTML = 
        '<div class="relative h-full w-full rounded-xl overflow-hidden glass">' +
          // 渐变装饰层
          '<div class="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent"></div>' +
          // 主内容区
          '<div class="relative z-10 h-full flex flex-col">' +
            // 头部 + 输入区
            '<div class="flex items-center gap-2 h-full px-3" id="widget-main">' +
              // 左侧图标
              '<div class="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl" ' +
                'style="background:linear-gradient(135deg,' + themeColor + '20,' + themeColor + '10);">🤖</div>' +
              // 中间输入区
              '<div class="flex-1 flex flex-col justify-center min-w-0">' +
                '<input type="text" id="ai-chat-input" ' +
                  'class="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all" ' +
                  'placeholder="' + t('placeholder') + '" ' +
                  'style="background:' + inputBg + ';border:1px solid ' + borderColor + ';color:' + textColor + ';" />' +
              '</div>' +
              // 发送按钮
              '<button id="ai-chat-send" class="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-opacity hover:opacity-80" ' +
                'style="background:' + themeColor + ';">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">' +
                  '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>' +
                '</svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
          // 消息预览区（底部）
          '<div id="ai-chat-messages" class="absolute bottom-0 left-0 right-0 px-3 pb-2 pointer-events-none" style="max-height:40%;overflow:hidden;"></div>' +
          editModeOverlay +
        '</div>';
    } else {
      // ========== 4x4 完整布局 ==========
      container.innerHTML = 
        '<div class="relative h-full w-full rounded-xl overflow-hidden glass">' +
          // 渐变装饰层
          '<div class="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent"></div>' +
          // 右上角光晕
          '<div class="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl pointer-events-none" ' +
            'style="background:radial-gradient(circle,' + themeColor + '15,transparent 70%);"></div>' +
          // 主内容区
          '<div class="relative z-10 h-full flex flex-col">' +
            // 头部
            '<div class="flex items-center gap-2.5 px-4 py-3" style="border-bottom:1px solid ' + borderColor + ';">' +
              '<div class="w-8 h-8 rounded-lg flex items-center justify-center text-base" ' +
                'style="background:linear-gradient(135deg,' + themeColor + '30,' + themeColor + '10);">🤖</div>' +
              '<span class="flex-1 font-semibold text-sm" style="color:' + textColor + ';">' + t('widgetTitle') + '</span>' +
              '<div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>' +
              '<button id="ai-chat-clear" class="w-7 h-7 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity" ' +
                'title="' + t('clearChat') + '" style="font-size:12px;">🗑️</button>' +
            '</div>' +
            // 消息区域
            '<div id="ai-chat-messages" class="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5"></div>' +
            // 输入区域
            '<div class="px-3 pb-3 pt-2" style="border-top:1px solid ' + borderColor + ';">' +
              '<div class="flex gap-2 items-center">' +
                '<input type="text" id="ai-chat-input" ' +
                  'class="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none transition-all" ' +
                  'placeholder="' + t('placeholder') + '" ' +
                  'style="background:' + inputBg + ';border:1px solid ' + borderColor + ';color:' + textColor + ';" />' +
                '<button id="ai-chat-send" class="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-opacity hover:opacity-80" ' +
                  'style="background:' + themeColor + ';">' +
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
        chatInput.style.boxShadow = '0 0 0 2px ' + themeColor + '20';
      });
      chatInput.addEventListener('blur', function() {
        chatInput.style.borderColor = borderColor;
        chatInput.style.boxShadow = 'none';
      });
    }

    // ========== 渲染消息列表 ==========
    function renderMessages() {
      if (!messagesArea) return;
      messagesArea.innerHTML = '';

      if (messages.length === 0) {
        if (isCompact) {
          // 4x2 不显示空状态
          return;
        }
        // 4x4 显示欢迎界面
        var emptyState = document.createElement('div');
        emptyState.className = 'flex-1 flex flex-col items-center justify-center text-center px-4';
        emptyState.innerHTML = 
          '<div class="text-3xl mb-2 opacity-50">💬</div>' +
          '<div class="text-xs mb-3" style="color:' + subtextColor + ';">' + t('startChat') + '</div>' +
          '<div class="flex flex-wrap justify-center gap-1.5" id="hints-container"></div>';
        messagesArea.appendChild(emptyState);

        // 添加提示词按钮
        var hintsContainer = emptyState.querySelector('#hints-container');
        var hints = t('hints');
        hints.forEach(function(hint) {
          var hintBtn = document.createElement('button');
          hintBtn.className = 'px-2.5 py-1 rounded-md text-xs transition-all';
          hintBtn.style.cssText = 
            'background:' + cardBg + ';' +
            'border:1px solid ' + borderColor + ';' +
            'color:' + subtextColor + ';';
          Tapp.dom.setText(hintBtn, hint);
          
          hintBtn.addEventListener('mouseenter', function() {
            hintBtn.style.borderColor = themeColor;
            hintBtn.style.color = themeColor;
          });
          hintBtn.addEventListener('mouseleave', function() {
            hintBtn.style.borderColor = borderColor;
            hintBtn.style.color = subtextColor;
          });
          hintBtn.addEventListener('click', function() {
            if (chatInput) {
              chatInput.value = hint + '：';
              chatInput.focus();
            }
          });
          hintsContainer.appendChild(hintBtn);
        });
        return;
      }

      // 显示消息
      var displayCount = isCompact ? Math.min(messages.length, 1) : Math.min(messages.length, 8);
      var displayMessages = messages.slice(-displayCount);

      displayMessages.forEach(function(msg) {
        var msgEl = document.createElement('div');
        msgEl.className = 'flex gap-2 items-start' + (msg.role === 'user' ? ' flex-row-reverse' : '');

        // 消息气泡
        var bubble = document.createElement('div');
        var content = msg.content;
        var maxLen = isCompact ? 60 : 150;
        if (content.length > maxLen) {
          content = content.substring(0, maxLen) + '...';
        }
        
        if (msg.role === 'user') {
          bubble.className = 'max-w-[75%] px-3 py-2 rounded-xl rounded-br-sm text-xs';
          bubble.style.cssText = 'background:' + themeColor + ';color:white;';
        } else {
          bubble.className = 'max-w-[75%] px-3 py-2 rounded-xl rounded-bl-sm text-xs';
          bubble.style.cssText = 'background:' + cardBg + ';color:' + textColor + ';backdrop-filter:blur(4px);';
        }
        Tapp.dom.setText(bubble, content);

        msgEl.appendChild(bubble);
        messagesArea.appendChild(msgEl);
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
      if (sendBtn) sendBtn.style.opacity = '0.5';
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
      if (sendBtn) sendBtn.style.opacity = '1';
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
// 使用内联样式 + CSS 变量

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
  // 更新当前语言
  currentLocale = normalizeLocale(locale);
  
  var isDark = isDarkTheme !== false;
  var themeColor = primaryColor || '#8b5cf6';

  // 获取框架提供的分层容器
  var bgLayer = document.getElementById('tapp-background');
  var contentLayer = document.getElementById('tapp-content');
  
  // 清空容器
  if (bgLayer) bgLayer.innerHTML = '';
  if (contentLayer) contentLayer.innerHTML = '';

  // 颜色定义
  var textColor = isDark ? '#f3f4f6' : '#1f2937';
  var subtextColor = isDark ? '#9ca3af' : '#6b7280';
  var borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  var inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)';
  var cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)';

  // ========== 背景层 ==========
  if (bgLayer) {
    bgLayer.style.background = isDark ? '#0a0a0a' : '#f8fafc';

    // 光晕效果
    var glow1 = document.createElement('div');
    glow1.style.cssText = 
      'position:absolute;right:-10%;top:-10%;width:50%;height:50%;border-radius:50%;' +
      'background:radial-gradient(circle,' + themeColor + '20,transparent 70%);' +
      'filter:blur(60px);pointer-events:none;';

    var glow2 = document.createElement('div');
    glow2.style.cssText = 
      'position:absolute;left:-10%;bottom:-10%;width:40%;height:40%;border-radius:50%;' +
      'background:radial-gradient(circle,' + themeColor + '15,transparent 70%);' +
      'filter:blur(60px);pointer-events:none;';

    bgLayer.appendChild(glow1);
    bgLayer.appendChild(glow2);
  }

  // ========== 内容层 ==========
  if (!contentLayer) return;

  contentLayer.style.fontFamily = 'system-ui,-apple-system,sans-serif';
  contentLayer.style.color = textColor;

  // 主容器
  var mainContainer = document.createElement('div');
  mainContainer.style.cssText = 'height:100%;display:flex;flex-direction:column;max-width:1280px;margin:0 auto;';

  // === 头部 ===
  var header = document.createElement('div');
  header.style.cssText = 
    'display:flex;align-items:center;gap:calc(12px * var(--tapp-scale,1));' +
    'padding:calc(16px * var(--tapp-scale,1)) calc(24px * var(--tapp-scale,1));' +
    'background:' + cardBg + ';backdrop-filter:blur(12px);' +
    'border-bottom:1px solid ' + borderColor + ';';

  var headerIcon = document.createElement('div');
  headerIcon.style.cssText = 
    'width:calc(40px * var(--tapp-scale,1));height:calc(40px * var(--tapp-scale,1));' +
    'border-radius:calc(12px * var(--tapp-scale,1));display:flex;align-items:center;justify-content:center;' +
    'font-size:calc(20px * var(--tapp-scale,1));' +
    'background:linear-gradient(135deg,#6366f1 0%,' + themeColor + ' 100%);';
  headerIcon.textContent = '🤖';

  var headerText = document.createElement('div');
  headerText.style.cssText = 'flex:1;';

  var headerTitle = document.createElement('h1');
  headerTitle.style.cssText = 
    'margin:0;font-size:calc(18px * var(--tapp-font-scale,1));font-weight:600;color:' + textColor + ';';
  Tapp.dom.setText(headerTitle, t('title'));

  var headerSubtitle = document.createElement('p');
  headerSubtitle.className = 'tapp-hide-compact';
  headerSubtitle.style.cssText = 
    'margin:2px 0 0 0;font-size:calc(12px * var(--tapp-font-scale,1));color:' + subtextColor + ';';
  Tapp.dom.setText(headerSubtitle, t('subtitle'));

  headerText.appendChild(headerTitle);
  headerText.appendChild(headerSubtitle);

  var clearBtnPage = document.createElement('button');
  clearBtnPage.style.cssText = 
    'padding:calc(8px * var(--tapp-scale,1)) calc(16px * var(--tapp-scale,1));' +
    'font-size:calc(14px * var(--tapp-font-scale,1));' +
    'border:1px solid ' + borderColor + ';border-radius:calc(8px * var(--tapp-scale,1));' +
    'background:transparent;color:' + subtextColor + ';cursor:pointer;transition:all 0.2s;';
  Tapp.dom.setText(clearBtnPage, t('clearChat'));

  clearBtnPage.onmouseenter = function() {
    clearBtnPage.style.borderColor = themeColor;
    clearBtnPage.style.color = themeColor;
  };
  clearBtnPage.onmouseleave = function() {
    clearBtnPage.style.borderColor = borderColor;
    clearBtnPage.style.color = subtextColor;
  };

  header.appendChild(headerIcon);
  header.appendChild(headerText);
  header.appendChild(clearBtnPage);

  // === 消息区域 ===
  var messagesArea = document.createElement('div');
  messagesArea.style.cssText = 'flex:1;overflow-y:auto;padding:calc(24px * var(--tapp-scale,1));';

  // === 输入区域 ===
  var inputArea = document.createElement('div');
  inputArea.style.cssText = 
    'padding:calc(16px * var(--tapp-scale,1)) calc(24px * var(--tapp-scale,1));' +
    'background:' + cardBg + ';backdrop-filter:blur(12px);' +
    'border-top:1px solid ' + borderColor + ';';

  var inputWrapper = document.createElement('div');
  inputWrapper.style.cssText = 'display:flex;gap:calc(12px * var(--tapp-scale,1));max-width:960px;margin:0 auto;';

  var chatInput = document.createElement('textarea');
  chatInput.placeholder = t('placeholderFull');
  chatInput.rows = 1;
  chatInput.style.cssText = 
    'flex:1;padding:calc(12px * var(--tapp-scale,1)) calc(16px * var(--tapp-scale,1));' +
    'font-size:calc(14px * var(--tapp-font-scale,1));line-height:1.5;' +
    'border:2px solid ' + borderColor + ';border-radius:calc(16px * var(--tapp-scale,1));' +
    'background:' + inputBg + ';backdrop-filter:blur(4px);' +
    'color:' + textColor + ';resize:none;outline:none;' +
    'min-height:calc(52px * var(--tapp-scale,1));max-height:150px;' +
    'font-family:inherit;transition:border-color 0.2s;';

  chatInput.onfocus = function() { chatInput.style.borderColor = themeColor; };
  chatInput.onblur = function() { chatInput.style.borderColor = borderColor; };

  var sendBtn = document.createElement('button');
  sendBtn.style.cssText = 
    'padding:calc(12px * var(--tapp-scale,1)) calc(28px * var(--tapp-scale,1));' +
    'font-size:calc(14px * var(--tapp-font-scale,1));font-weight:500;' +
    'border:none;border-radius:calc(16px * var(--tapp-scale,1));' +
    'background:' + themeColor + ';color:white;cursor:pointer;' +
    'align-self:flex-end;transition:opacity 0.2s;';
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
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'text-align:center;padding:calc(64px * var(--tapp-scale,1)) calc(24px * var(--tapp-scale,1));';

      var emojiIcon = document.createElement('div');
      emojiIcon.style.cssText = 'font-size:calc(64px * var(--tapp-scale,1));margin-bottom:calc(24px * var(--tapp-scale,1));';
      emojiIcon.textContent = '🤖';

      var welcomeTitle = document.createElement('div');
      welcomeTitle.style.cssText = 
        'font-size:calc(20px * var(--tapp-font-scale,1));font-weight:600;color:' + textColor + ';' +
        'margin-bottom:calc(8px * var(--tapp-scale,1));';
      Tapp.dom.setText(welcomeTitle, t('welcome'));

      var welcomeSubtitle = document.createElement('div');
      welcomeSubtitle.style.cssText = 
        'font-size:calc(14px * var(--tapp-font-scale,1));color:' + subtextColor + ';' +
        'margin-bottom:calc(32px * var(--tapp-scale,1));';
      Tapp.dom.setText(welcomeSubtitle, t('welcomeSubtitle'));

      var examplesContainer = document.createElement('div');
      examplesContainer.style.cssText = 
        'display:flex;flex-wrap:wrap;justify-content:center;gap:calc(12px * var(--tapp-scale,1));max-width:560px;';

      var examples = t('examples');
      examples.forEach(function(q) {
        var exampleBtn = document.createElement('button');
        exampleBtn.style.cssText = 
          'padding:calc(8px * var(--tapp-scale,1)) calc(16px * var(--tapp-scale,1));' +
          'font-size:calc(14px * var(--tapp-font-scale,1));' +
          'border:1px solid ' + borderColor + ';border-radius:calc(16px * var(--tapp-scale,1));' +
          'background:' + cardBg + ';backdrop-filter:blur(4px);' +
          'color:' + subtextColor + ';cursor:pointer;transition:all 0.2s;';
        Tapp.dom.setText(exampleBtn, q);

        exampleBtn.onmouseenter = function() {
          exampleBtn.style.borderColor = themeColor;
          exampleBtn.style.color = themeColor;
        };
        exampleBtn.onmouseleave = function() {
          exampleBtn.style.borderColor = borderColor;
          exampleBtn.style.color = subtextColor;
        };
        exampleBtn.onclick = function() { sendMessage(q); };

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
        'display:flex;gap:calc(12px * var(--tapp-scale,1));margin-bottom:calc(20px * var(--tapp-scale,1));' +
        (msg.role === 'user' ? 'flex-direction:row-reverse;' : '');

      var avatar = document.createElement('div');
      avatar.style.cssText = 
        'width:calc(36px * var(--tapp-scale,1));height:calc(36px * var(--tapp-scale,1));' +
        'border-radius:calc(8px * var(--tapp-scale,1));display:flex;align-items:center;justify-content:center;' +
        'flex-shrink:0;font-size:calc(18px * var(--tapp-scale,1));' +
        'background:' + (msg.role === 'user' ? themeColor : cardBg) + ';';
      avatar.textContent = msg.role === 'user' ? '👤' : '🤖';

      var contentArea = document.createElement('div');
      contentArea.style.cssText = 'display:flex;flex-direction:column;max-width:70%;';

      var bubble = document.createElement('div');
      bubble.style.cssText = 
        'padding:calc(12px * var(--tapp-scale,1)) calc(16px * var(--tapp-scale,1));' +
        'border-radius:calc(16px * var(--tapp-scale,1));' +
        (msg.role === 'user' 
          ? 'border-bottom-right-radius:calc(4px * var(--tapp-scale,1));background:' + themeColor + ';color:white;'
          : 'border-bottom-left-radius:calc(4px * var(--tapp-scale,1));background:' + cardBg + ';backdrop-filter:blur(4px);color:' + textColor + ';') +
        'font-size:calc(14px * var(--tapp-font-scale,1));line-height:1.6;white-space:pre-wrap;word-break:break-word;';
      Tapp.dom.setText(bubble, msg.content);

      var timestamp = document.createElement('div');
      timestamp.style.cssText = 
        'font-size:calc(10px * var(--tapp-font-scale,1));color:' + subtextColor + ';' +
        'margin-top:calc(6px * var(--tapp-scale,1));' +
        (msg.role === 'user' ? 'text-align:right;' : '');
      Tapp.dom.setText(timestamp, formatTime(msg.timestamp));

      contentArea.appendChild(bubble);
      contentArea.appendChild(timestamp);

      msgContainer.appendChild(avatar);
      msgContainer.appendChild(contentArea);
      messagesArea.appendChild(msgContainer);
    });

    setTimeout(function() { messagesArea.scrollTop = messagesArea.scrollHeight; }, 10);
  }

  // 发送消息
  async function sendMessage(text) {
    if (!text || isGenerating) return;
    text = text.trim();
    if (!text) return;

    isGenerating = true;
    sendBtn.disabled = true;
    Tapp.dom.setText(sendBtn, t('sending'));

    chatHistory.push({ role: 'user', content: text, timestamp: Date.now() });
    renderMessages();
    chatInput.value = '';

    try {
      var userMaxTokens = await Tapp.settings.get('maxTokens') || 500;
      var response = await Tapp.ai.generate({ prompt: text, maxTokens: userMaxTokens });

      var content = (response && response.success) ? (response.result || '') : '';
      if (!content) content = t('errorNoResponse');

      chatHistory.push({ role: 'assistant', content: content, timestamp: Date.now() });
    } catch (error) {
      console.error('[AI Chat] 生成失败:', error);
      chatHistory.push({
        role: 'assistant',
        content: t('errorGenerate') + (error && error.message ? error.message : 'Unknown error'),
        timestamp: Date.now()
      });
    }

    // 保存历史
    try {
      var saveHistory = await Tapp.settings.get('saveHistory');
      if (saveHistory !== false) {
        var maxHistory = await Tapp.settings.get('maxHistory') || 100;
        if (chatHistory.length > maxHistory) chatHistory = chatHistory.slice(-maxHistory);
        await Tapp.storage.set('chatHistory', chatHistory);
      }
    } catch (e) { console.error('[AI Chat] 保存历史失败:', e); }

    renderMessages();
    isGenerating = false;
    sendBtn.disabled = false;
    Tapp.dom.setText(sendBtn, t('send'));
  }

  // 清空对话
  async function clearChat() {
    if (chatHistory.length === 0) return;
    chatHistory = [];
    await Tapp.storage.set('chatHistory', []);
    renderMessages();
    await Tapp.ui.showNotification({ title: t('clearSuccess'), message: t('clearMessage'), type: 'info' });
  }

  // 绑定事件
  sendBtn.onclick = function() { sendMessage(chatInput.value); };
  chatInput.onkeydown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput.value); }
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

  renderMessages();
  console.log('[AI Chat] Page 已渲染');
}

// ===== 生命周期（仅 Page 模式执行）=====
Tapp.lifecycle.onReady(async function() {
  console.log('[AI Chat] 页面模式已就绪');

  try {
    currentLang = await Tapp.ui.getLocale();
    currentTheme = await Tapp.ui.getTheme();
    currentPrimaryColor = await Tapp.ui.getPrimaryColor();

    var saveHistory = await Tapp.settings.get('saveHistory');
    if (saveHistory !== false) {
      chatHistory = await Tapp.storage.get('chatHistory') || [];
    }
    
    renderPage(currentLang, currentTheme === 'dark', currentPrimaryColor);
    
    Tapp.ui.onLocaleChange(function(newLocale) { currentLang = newLocale; rerender(); });
    Tapp.ui.onThemeChange(function(newTheme) { currentTheme = newTheme; rerender(); });
    Tapp.ui.onPrimaryColorChange(function(newColor) { currentPrimaryColor = newColor; rerender(); });
    
  } catch (error) {
    console.error('[AI Chat] 初始化失败:', error);
  }
});

Tapp.lifecycle.onDestroy(async function() {
  console.log('[AI Chat] 正在销毁...');
});

console.log('[AI Chat] Tapp 已加载');
