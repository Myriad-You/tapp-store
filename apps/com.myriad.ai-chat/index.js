// AI Chat Tapp v1.0 - Core
// AI 聊天助手 - 核心代码
// 使用全局主题变量 + 自适应尺寸 + i18n 国际化 + Glass 风格

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
    hints: ['Write code', 'Translate', 'Explain', 'Brainstorm'],
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
// Widget 模式只加载 core + widget，不执行 onReady
// 只支持 4x4 尺寸，Glass 风格

console.log('[AI Chat] Widget 加载中...');

Tapp.widgets['ai-chat'] = {
  render: async function(container, props) {
    var scale = props.scale || 1;
    var fontScale = props.fontScale || 1;
    var isDark = props.theme === 'dark';
    var themeColor = props.primaryColor || '#8b5cf6';
    
    // 设置当前语言
    currentLocale = normalizeLocale(props.locale);

    // 加载历史消息
    var messages = await Tapp.storage.get('widgetMessages') || [];
    var isGenerating = false;

    // 获取用户设置
    var maxTokens = await Tapp.settings.get('maxTokens') || 500;

    // 清空容器
    container.innerHTML = '';
    container.style.cssText = 
      'height: 100%;' +
      'width: 100%;' +
      'position: relative;' +
      'overflow: hidden;' +
      'border-radius: 16px;';

    // ========== 背景装饰层 ==========
    var bgLayer = document.createElement('div');
    bgLayer.style.cssText = 
      'position: absolute;' +
      'inset: 0;' +
      'background: ' + (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)') + ';' +
      'backdrop-filter: blur(12px);' +
      '-webkit-backdrop-filter: blur(12px);' +
      'border: 1px solid ' + (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') + ';' +
      'border-radius: 16px;';
    container.appendChild(bgLayer);

    // 右上角光晕
    var glow = document.createElement('div');
    glow.style.cssText = 
      'position: absolute;' +
      'right: -20%;' +
      'top: -20%;' +
      'width: 60%;' +
      'height: 60%;' +
      'border-radius: 50%;' +
      'background: radial-gradient(circle, ' + themeColor + '15, transparent 70%);' +
      'filter: blur(30px);' +
      'pointer-events: none;';
    container.appendChild(glow);

    // ========== 主内容区 ==========
    var mainContent = document.createElement('div');
    mainContent.style.cssText = 
      'position: relative;' +
      'z-index: 1;' +
      'height: 100%;' +
      'display: flex;' +
      'flex-direction: column;';
    container.appendChild(mainContent);

    // === 头部 ===
    var header = document.createElement('div');
    header.style.cssText = 
      'display: flex;' +
      'align-items: center;' +
      'gap: ' + (10 * scale) + 'px;' +
      'padding: ' + (14 * scale) + 'px ' + (16 * scale) + 'px;' +
      'border-bottom: 1px solid ' + (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') + ';';

    var headerIcon = document.createElement('span');
    headerIcon.style.cssText = 'font-size: ' + (20 * scale) + 'px;';
    headerIcon.textContent = '🤖';

    var headerTitle = document.createElement('span');
    headerTitle.style.cssText = 
      'flex: 1;' +
      'font-size: ' + (15 * fontScale) + 'px;' +
      'font-weight: 600;' +
      'color: ' + (isDark ? '#f3f4f6' : '#1f2937') + ';';
    Tapp.dom.setText(headerTitle, t('widgetTitle'));

    var statusDot = document.createElement('div');
    statusDot.className = 'status-dot';
    statusDot.style.cssText = 
      'width: 6px;' +
      'height: 6px;' +
      'border-radius: 50%;' +
      'background: #22c55e;' +
      'flex-shrink: 0;';

    var clearBtn = document.createElement('button');
    clearBtn.style.cssText = 
      'width: ' + (28 * scale) + 'px;' +
      'height: ' + (28 * scale) + 'px;' +
      'display: flex;' +
      'align-items: center;' +
      'justify-content: center;' +
      'border-radius: ' + (8 * scale) + 'px;' +
      'border: none;' +
      'background: transparent;' +
      'color: ' + (isDark ? '#9ca3af' : '#6b7280') + ';' +
      'cursor: pointer;' +
      'opacity: 0.6;' +
      'transition: all 0.2s ease;' +
      'font-size: ' + (14 * scale) + 'px;';
    clearBtn.textContent = '🗑️';
    clearBtn.title = t('clearChat');
    clearBtn.onmouseenter = function() { clearBtn.style.opacity = '1'; clearBtn.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; };
    clearBtn.onmouseleave = function() { clearBtn.style.opacity = '0.6'; clearBtn.style.background = 'transparent'; };

    header.appendChild(headerIcon);
    header.appendChild(headerTitle);
    header.appendChild(statusDot);
    header.appendChild(clearBtn);
    mainContent.appendChild(header);

    // === 消息区域 ===
    var messagesArea = document.createElement('div');
    messagesArea.style.cssText = 
      'flex: 1;' +
      'overflow-y: auto;' +
      'padding: ' + (12 * scale) + 'px;' +
      'display: flex;' +
      'flex-direction: column;' +
      'gap: ' + (12 * scale) + 'px;';
    mainContent.appendChild(messagesArea);

    // === 输入区域 ===
    var inputArea = document.createElement('div');
    inputArea.style.cssText = 
      'padding: ' + (12 * scale) + 'px ' + (14 * scale) + 'px;' +
      'border-top: 1px solid ' + (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') + ';';

    var inputWrapper = document.createElement('div');
    inputWrapper.style.cssText = 
      'display: flex;' +
      'gap: ' + (8 * scale) + 'px;' +
      'align-items: center;';

    var chatInput = document.createElement('input');
    chatInput.type = 'text';
    chatInput.placeholder = t('placeholder');
    chatInput.style.cssText = 
      'flex: 1;' +
      'padding: ' + (10 * scale) + 'px ' + (14 * scale) + 'px;' +
      'border: 1px solid ' + (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)') + ';' +
      'border-radius: ' + (12 * scale) + 'px;' +
      'background: ' + (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)') + ';' +
      'backdrop-filter: blur(4px);' +
      '-webkit-backdrop-filter: blur(4px);' +
      'color: ' + (isDark ? '#f3f4f6' : '#1f2937') + ';' +
      'font-size: ' + (13 * fontScale) + 'px;' +
      'outline: none;' +
      'transition: border-color 0.2s ease;';
    chatInput.onfocus = function() { chatInput.style.borderColor = themeColor; };
    chatInput.onblur = function() { chatInput.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'; };

    var sendBtn = document.createElement('button');
    sendBtn.style.cssText = 
      'width: ' + (38 * scale) + 'px;' +
      'height: ' + (38 * scale) + 'px;' +
      'display: flex;' +
      'align-items: center;' +
      'justify-content: center;' +
      'border-radius: ' + (12 * scale) + 'px;' +
      'border: none;' +
      'background: ' + themeColor + ';' +
      'color: white;' +
      'cursor: pointer;' +
      'flex-shrink: 0;' +
      'transition: opacity 0.2s ease;';
    sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
    sendBtn.onmouseenter = function() { sendBtn.style.opacity = '0.9'; };
    sendBtn.onmouseleave = function() { sendBtn.style.opacity = '1'; };

    inputWrapper.appendChild(chatInput);
    inputWrapper.appendChild(sendBtn);
    inputArea.appendChild(inputWrapper);
    mainContent.appendChild(inputArea);

    // 编辑模式边框
    if (props.isEditMode) {
      var editBorder = document.createElement('div');
      editBorder.style.cssText = 
        'position: absolute;' +
        'inset: 0;' +
        'border: 2px dashed ' + themeColor + ';' +
        'border-radius: 16px;' +
        'pointer-events: none;' +
        'z-index: 10;';
      container.appendChild(editBorder);
    }

    // ========== 渲染消息列表 ==========
    function renderMessages() {
      messagesArea.innerHTML = '';

      if (messages.length === 0) {
        // 空状态 - 欢迎界面
        var emptyState = document.createElement('div');
        emptyState.style.cssText = 
          'flex: 1;' +
          'display: flex;' +
          'flex-direction: column;' +
          'align-items: center;' +
          'justify-content: center;' +
          'text-align: center;' +
          'padding: ' + (16 * scale) + 'px;';

        var emptyIcon = document.createElement('div');
        emptyIcon.style.cssText = 
          'font-size: ' + (40 * scale) + 'px;' +
          'margin-bottom: ' + (12 * scale) + 'px;' +
          'opacity: 0.5;';
        emptyIcon.textContent = '💬';

        var emptyText = document.createElement('div');
        emptyText.style.cssText = 
          'font-size: ' + (13 * fontScale) + 'px;' +
          'color: ' + (isDark ? '#9ca3af' : '#6b7280') + ';' +
          'margin-bottom: ' + (16 * scale) + 'px;';
        Tapp.dom.setText(emptyText, t('startChat'));

        // 提示词按钮
        var hintsContainer = document.createElement('div');
        hintsContainer.style.cssText = 
          'display: flex;' +
          'flex-wrap: wrap;' +
          'justify-content: center;' +
          'gap: ' + (8 * scale) + 'px;';

        var hints = t('hints');
        hints.forEach(function(hint) {
          var hintBtn = document.createElement('button');
          hintBtn.style.cssText = 
            'padding: ' + (6 * scale) + 'px ' + (12 * scale) + 'px;' +
            'font-size: ' + (11 * fontScale) + 'px;' +
            'border: 1px solid ' + (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)') + ';' +
            'border-radius: ' + (8 * scale) + 'px;' +
            'background: ' + (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.5)') + ';' +
            'color: ' + (isDark ? '#d1d5db' : '#374151') + ';' +
            'cursor: pointer;' +
            'transition: all 0.2s ease;';
          Tapp.dom.setText(hintBtn, hint);

          hintBtn.onmouseenter = function() {
            hintBtn.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)';
            hintBtn.style.borderColor = themeColor;
            hintBtn.style.color = themeColor;
          };
          hintBtn.onmouseleave = function() {
            hintBtn.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.5)';
            hintBtn.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
            hintBtn.style.color = isDark ? '#d1d5db' : '#374151';
          };
          hintBtn.onclick = function() {
            chatInput.value = hint + '：';
            chatInput.focus();
          };

          hintsContainer.appendChild(hintBtn);
        });

        emptyState.appendChild(emptyIcon);
        emptyState.appendChild(emptyText);
        emptyState.appendChild(hintsContainer);
        messagesArea.appendChild(emptyState);
        return;
      }

      // 显示最近的消息（最多 10 条）
      var displayMessages = messages.slice(-10);
      displayMessages.forEach(function(msg) {
        var msgContainer = document.createElement('div');
        msgContainer.style.cssText = 
          'display: flex;' +
          'gap: ' + (10 * scale) + 'px;' +
          'align-items: flex-start;' +
          (msg.role === 'user' ? 'flex-direction: row-reverse;' : '');

        // 头像
        var avatar = document.createElement('div');
        avatar.style.cssText = 
          'width: ' + (28 * scale) + 'px;' +
          'height: ' + (28 * scale) + 'px;' +
          'border-radius: ' + (8 * scale) + 'px;' +
          'display: flex;' +
          'align-items: center;' +
          'justify-content: center;' +
          'flex-shrink: 0;' +
          'font-size: ' + (14 * scale) + 'px;' +
          'background: ' + (msg.role === 'user' ? themeColor : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')) + ';';
        avatar.textContent = msg.role === 'user' ? '👤' : '🤖';

        // 消息气泡
        var bubble = document.createElement('div');
        var content = msg.content;
        if (content.length > 200) {
          content = content.substring(0, 200) + '...';
        }
        bubble.style.cssText = 
          'max-width: 80%;' +
          'padding: ' + (10 * scale) + 'px ' + (14 * scale) + 'px;' +
          'border-radius: ' + (14 * scale) + 'px;' +
          (msg.role === 'user' 
            ? 'border-bottom-right-radius: ' + (4 * scale) + 'px; background: ' + themeColor + '; color: white;'
            : 'border-bottom-left-radius: ' + (4 * scale) + 'px; background: ' + (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)') + '; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); color: ' + (isDark ? '#f3f4f6' : '#1f2937') + ';') +
          'font-size: ' + (13 * fontScale) + 'px;' +
          'line-height: 1.5;' +
          'word-break: break-word;';
        Tapp.dom.setText(bubble, content);

        msgContainer.appendChild(avatar);
        msgContainer.appendChild(bubble);
        messagesArea.appendChild(msgContainer);
      });

      // 滚动到底部
      setTimeout(function() {
        messagesArea.scrollTop = messagesArea.scrollHeight;
      }, 10);
    }

    // ========== 发送消息 ==========
    async function sendMessage(text) {
      if (!text || isGenerating) return;
      text = text.trim();
      if (!text) return;

      isGenerating = true;
      sendBtn.disabled = true;
      statusDot.style.background = '#f59e0b';
      chatInput.value = '';

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
      sendBtn.disabled = false;
      statusDot.style.background = '#22c55e';
    }

    // ========== 清空对话 ==========
    async function clearChat() {
      if (messages.length === 0) return;
      messages = [];
      await Tapp.storage.set('widgetMessages', []);
      renderMessages();
    }

    // ========== 绑定事件 ==========
    sendBtn.onclick = function() { sendMessage(chatInput.value); };
    chatInput.onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(chatInput.value);
      }
    };
    clearBtn.onclick = clearChat;

    // 初始渲染
    renderMessages();

    console.log('[AI Chat] Widget 已渲染');
  }
};

console.log('[AI Chat] Widget 已加载');


// ========== PAGE 代码（页面渲染 + 生命周期）==========
// Page 模式加载 core + page，执行完整生命周期
// 使用控制面板语言 + 自适应尺寸 + 语言切换监听
// 
// 框架自动提供两层容器：
// - #tapp-background: 背景层，填满全屏
// - #tapp-content: 内容层，自动应用安全区域 padding

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

  // 获取框架提供的分层容器（框架自动创建）
  var bgLayer = document.getElementById('tapp-background');
  var contentLayer = document.getElementById('tapp-content');
  
  // 清空容器
  if (bgLayer) bgLayer.innerHTML = '';
  if (contentLayer) contentLayer.innerHTML = '';

  // 获取设置
  var maxTokens = 500;

  // ========== 背景层：装饰效果（填满全屏） ==========
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

  // ========== 内容层：主要内容（自动避开安全区域） ==========
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
    
    // 渲染页面（框架自动提供 #tapp-background 和 #tapp-content）
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
    
    // 监听主色调变化（壁纸色）
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
  // 清理资源（如果有需要）
});

console.log('[AI Chat] Tapp 已加载');
