// AI Chat Tapp v1.0 - Core
// AI 聊天助手 - 核心代码
// Widget 使用纯内联样式 + CSS 变量实现自适应
// 注意：沙箱中只有 tapp-* 前缀的工具类，没有 Tailwind！

console.log('[AI Chat] Core 加载中...');

// ========== i18n 翻译表 ==========
var i18n = {
  'zh-CN': {
    title: 'AI 聊天助手',
    subtitle: '由 AI 驱动的智能对话',
    widgetTitle: 'AI 助手',
    placeholder: '输入你的问题...',
    placeholderFull: '输入你的问题...（按 Enter 发送）',
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
    placeholderFull: 'Ask a question... (Press Enter to send)',
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
    placeholderFull: '質問を入力...（Enterで送信）',
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
// Widget 使用纯内联样式，不依赖任何外部 CSS 类
// 支持 4x2 和 4x4 尺寸

console.log('[AI Chat] Widget 加载中...');

Tapp.widgets['ai-chat'] = {
  render: async function(container, props) {
    console.log('[AI Chat Widget] render 被调用, props:', props);
    
    // 获取属性
    var isDark = props.theme === 'dark';
    var themeColor = props.primaryColor || '#8b5cf6';
    var size = props.size || '4x2';
    var isCompact = size === '4x2';
    
    // 设置当前语言
    currentLocale = normalizeLocale(props.locale);

    // 加载历史消息
    var messages = [];
    try {
      messages = await Tapp.storage.get('widgetMessages') || [];
    } catch (e) {
      console.error('[AI Chat Widget] 加载消息失败:', e);
    }
    var isGenerating = false;

    // 获取用户设置
    var maxTokens = 500;
    try {
      maxTokens = await Tapp.settings.get('maxTokens') || 500;
    } catch (e) {}

    // 颜色定义
    var textColor = isDark ? '#f3f4f6' : '#1f2937';
    var subtextColor = isDark ? '#9ca3af' : '#6b7280';
    var borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
    var inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
    var cardBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)';
    var glassBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)';

    // 清空容器并设置基础样式
    container.innerHTML = '';
    container.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden;';

    // ========== 创建主容器（Glass 风格）==========
    var mainWrapper = document.createElement('div');
    mainWrapper.style.cssText = 
      'position:relative;width:100%;height:100%;' +
      'border-radius:calc(16px * var(--tapp-scale, 1));overflow:hidden;' +
      'background:' + glassBg + ';' +
      'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' +
      'border:1px solid ' + borderColor + ';';

    // 渐变装饰层
    var gradientLayer = document.createElement('div');
    gradientLayer.style.cssText = 
      'position:absolute;inset:0;pointer-events:none;' +
      'background:linear-gradient(135deg,' + themeColor + '08,transparent 60%);';
    mainWrapper.appendChild(gradientLayer);

    // 根据尺寸渲染不同布局
    if (isCompact) {
      // ========== 4x2 紧凑布局 ==========
      renderCompactLayout(mainWrapper, themeColor, textColor, subtextColor, borderColor, inputBg, isDark, messages);
    } else {
      // ========== 4x4 完整布局 ==========
      renderFullLayout(mainWrapper, themeColor, textColor, subtextColor, borderColor, inputBg, cardBg, isDark, messages);
    }

    // 编辑模式指示器
    if (props.isEditMode) {
      var editIndicator = document.createElement('div');
      editIndicator.style.cssText = 
        'position:absolute;inset:0;border:2px dashed rgba(59,130,246,0.5);' +
        'border-radius:calc(16px * var(--tapp-scale, 1));pointer-events:none;z-index:100;';
      mainWrapper.appendChild(editIndicator);
    }

    container.appendChild(mainWrapper);

    // ========== 4x2 紧凑布局渲染 ==========
    function renderCompactLayout(wrapper, themeColor, textColor, subtextColor, borderColor, inputBg, isDark, messages) {
      var content = document.createElement('div');
      content.style.cssText = 
        'position:relative;z-index:10;height:100%;' +
        'display:flex;align-items:center;gap:calc(12px * var(--tapp-scale, 1));' +
        'padding:calc(12px * var(--tapp-scale, 1)) calc(16px * var(--tapp-scale, 1));';

      // 左侧图标
      var iconWrapper = document.createElement('div');
      iconWrapper.style.cssText = 
        'flex-shrink:0;width:calc(40px * var(--tapp-scale, 1));height:calc(40px * var(--tapp-scale, 1));' +
        'border-radius:calc(12px * var(--tapp-scale, 1));' +
        'display:flex;align-items:center;justify-content:center;' +
        'font-size:calc(20px * var(--tapp-scale, 1));' +
        'background:linear-gradient(135deg,' + themeColor + '30,' + themeColor + '10);';
      iconWrapper.textContent = '🤖';
      content.appendChild(iconWrapper);

      // 中间输入区
      var inputWrapper = document.createElement('div');
      inputWrapper.style.cssText = 'flex:1;min-width:0;';

      var input = document.createElement('input');
      input.type = 'text';
      input.placeholder = t('placeholder');
      input.style.cssText = 
        'width:100%;padding:calc(10px * var(--tapp-scale, 1)) calc(14px * var(--tapp-scale, 1));' +
        'border-radius:calc(10px * var(--tapp-scale, 1));' +
        'font-size:calc(14px * var(--tapp-font-scale, 1));' +
        'background:' + inputBg + ';border:1px solid ' + borderColor + ';' +
        'color:' + textColor + ';outline:none;' +
        'transition:border-color 0.2s,box-shadow 0.2s;';
      
      input.onfocus = function() {
        input.style.borderColor = themeColor;
        input.style.boxShadow = '0 0 0 3px ' + themeColor + '20';
      };
      input.onblur = function() {
        input.style.borderColor = borderColor;
        input.style.boxShadow = 'none';
      };
      inputWrapper.appendChild(input);
      content.appendChild(inputWrapper);

      // 发送按钮
      var sendBtn = document.createElement('button');
      sendBtn.style.cssText = 
        'flex-shrink:0;width:calc(40px * var(--tapp-scale, 1));height:calc(40px * var(--tapp-scale, 1));' +
        'border-radius:calc(10px * var(--tapp-scale, 1));border:none;cursor:pointer;' +
        'display:flex;align-items:center;justify-content:center;' +
        'background:' + themeColor + ';transition:opacity 0.2s;';
      sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
      
      sendBtn.onmouseenter = function() { sendBtn.style.opacity = '0.85'; };
      sendBtn.onmouseleave = function() { sendBtn.style.opacity = '1'; };
      content.appendChild(sendBtn);

      wrapper.appendChild(content);

      // 事件绑定
      async function sendMessage() {
        var text = input.value.trim();
        if (!text || isGenerating) return;

        isGenerating = true;
        sendBtn.style.opacity = '0.5';
        input.value = '';

        messages.push({ role: 'user', content: text, timestamp: Date.now() });

        try {
          var response = await Tapp.ai.generate({ prompt: text, maxTokens: maxTokens });
          var result = (response && response.success) ? (response.result || t('errorNoResponse')) : t('errorNoResponse');
          messages.push({ role: 'assistant', content: result, timestamp: Date.now() });
          if (messages.length > 20) messages = messages.slice(-20);
          await Tapp.storage.set('widgetMessages', messages);
        } catch (error) {
          console.error('[AI Chat Widget] Error:', error);
          messages.push({ role: 'assistant', content: t('errorGenerate') + (error.message || 'Unknown'), timestamp: Date.now() });
        }

        isGenerating = false;
        sendBtn.style.opacity = '1';
      }

      sendBtn.onclick = sendMessage;
      input.onkeydown = function(e) {
        if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
      };
    }

    // ========== 4x4 完整布局渲染 ==========
    function renderFullLayout(wrapper, themeColor, textColor, subtextColor, borderColor, inputBg, cardBg, isDark, messages) {
      var content = document.createElement('div');
      content.style.cssText = 
        'position:relative;z-index:10;height:100%;display:flex;flex-direction:column;';

      // === 头部 ===
      var header = document.createElement('div');
      header.style.cssText = 
        'display:flex;align-items:center;gap:calc(10px * var(--tapp-scale, 1));' +
        'padding:calc(12px * var(--tapp-scale, 1)) calc(14px * var(--tapp-scale, 1));' +
        'border-bottom:1px solid ' + borderColor + ';';

      var headerIcon = document.createElement('div');
      headerIcon.style.cssText = 
        'width:calc(32px * var(--tapp-scale, 1));height:calc(32px * var(--tapp-scale, 1));' +
        'border-radius:calc(8px * var(--tapp-scale, 1));' +
        'display:flex;align-items:center;justify-content:center;' +
        'font-size:calc(16px * var(--tapp-scale, 1));' +
        'background:linear-gradient(135deg,' + themeColor + '30,' + themeColor + '10);';
      headerIcon.textContent = '🤖';
      header.appendChild(headerIcon);

      var headerTitle = document.createElement('span');
      headerTitle.style.cssText = 
        'flex:1;font-weight:600;font-size:calc(14px * var(--tapp-font-scale, 1));color:' + textColor + ';';
      Tapp.dom.setText(headerTitle, t('widgetTitle'));
      header.appendChild(headerTitle);

      var statusDot = document.createElement('div');
      statusDot.style.cssText = 
        'width:calc(6px * var(--tapp-scale, 1));height:calc(6px * var(--tapp-scale, 1));' +
        'border-radius:50%;background:#22c55e;';
      header.appendChild(statusDot);

      var clearBtn = document.createElement('button');
      clearBtn.style.cssText = 
        'width:calc(28px * var(--tapp-scale, 1));height:calc(28px * var(--tapp-scale, 1));' +
        'border-radius:calc(6px * var(--tapp-scale, 1));border:none;background:transparent;' +
        'cursor:pointer;opacity:0.5;transition:opacity 0.2s;' +
        'display:flex;align-items:center;justify-content:center;font-size:calc(12px * var(--tapp-scale, 1));';
      clearBtn.textContent = '🗑️';
      clearBtn.title = t('clearChat');
      clearBtn.onmouseenter = function() { clearBtn.style.opacity = '1'; };
      clearBtn.onmouseleave = function() { clearBtn.style.opacity = '0.5'; };
      header.appendChild(clearBtn);

      content.appendChild(header);

      // === 消息区域 ===
      var messagesArea = document.createElement('div');
      messagesArea.style.cssText = 
        'flex:1;overflow-y:auto;padding:calc(12px * var(--tapp-scale, 1));' +
        'display:flex;flex-direction:column;gap:calc(10px * var(--tapp-scale, 1));';
      content.appendChild(messagesArea);

      // === 输入区域 ===
      var inputArea = document.createElement('div');
      inputArea.style.cssText = 
        'padding:calc(10px * var(--tapp-scale, 1)) calc(12px * var(--tapp-scale, 1));' +
        'border-top:1px solid ' + borderColor + ';';

      var inputRow = document.createElement('div');
      inputRow.style.cssText = 'display:flex;gap:calc(8px * var(--tapp-scale, 1));align-items:center;';

      var input = document.createElement('input');
      input.type = 'text';
      input.placeholder = t('placeholder');
      input.style.cssText = 
        'flex:1;padding:calc(10px * var(--tapp-scale, 1)) calc(14px * var(--tapp-scale, 1));' +
        'border-radius:calc(12px * var(--tapp-scale, 1));' +
        'font-size:calc(13px * var(--tapp-font-scale, 1));' +
        'background:' + inputBg + ';border:1px solid ' + borderColor + ';' +
        'color:' + textColor + ';outline:none;' +
        'transition:border-color 0.2s,box-shadow 0.2s;';

      input.onfocus = function() {
        input.style.borderColor = themeColor;
        input.style.boxShadow = '0 0 0 3px ' + themeColor + '20';
      };
      input.onblur = function() {
        input.style.borderColor = borderColor;
        input.style.boxShadow = 'none';
      };
      inputRow.appendChild(input);

      var sendBtn = document.createElement('button');
      sendBtn.style.cssText = 
        'flex-shrink:0;width:calc(36px * var(--tapp-scale, 1));height:calc(36px * var(--tapp-scale, 1));' +
        'border-radius:calc(10px * var(--tapp-scale, 1));border:none;cursor:pointer;' +
        'display:flex;align-items:center;justify-content:center;' +
        'background:' + themeColor + ';transition:opacity 0.2s;';
      sendBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

      sendBtn.onmouseenter = function() { sendBtn.style.opacity = '0.85'; };
      sendBtn.onmouseleave = function() { sendBtn.style.opacity = '1'; };
      inputRow.appendChild(sendBtn);

      inputArea.appendChild(inputRow);
      content.appendChild(inputArea);
      wrapper.appendChild(content);

      // 渲染消息列表
      function renderMessages() {
        messagesArea.innerHTML = '';

        if (messages.length === 0) {
          // 空状态 - 欢迎界面
          var emptyState = document.createElement('div');
          emptyState.style.cssText = 
            'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
            'text-align:center;padding:calc(16px * var(--tapp-scale, 1));';

          var emptyIcon = document.createElement('div');
          emptyIcon.style.cssText = 'font-size:calc(32px * var(--tapp-scale, 1));margin-bottom:calc(8px * var(--tapp-scale, 1));opacity:0.5;';
          emptyIcon.textContent = '💬';
          emptyState.appendChild(emptyIcon);

          var emptyText = document.createElement('div');
          emptyText.style.cssText = 'font-size:calc(12px * var(--tapp-font-scale, 1));color:' + subtextColor + ';';
          Tapp.dom.setText(emptyText, t('startChat'));
          emptyState.appendChild(emptyText);

          // 提示词按钮
          var hintsRow = document.createElement('div');
          hintsRow.style.cssText = 
            'display:flex;flex-wrap:wrap;justify-content:center;gap:calc(6px * var(--tapp-scale, 1));' +
            'margin-top:calc(12px * var(--tapp-scale, 1));';

          var hints = t('hints');
          hints.forEach(function(hint) {
            var hintBtn = document.createElement('button');
            hintBtn.style.cssText = 
              'padding:calc(4px * var(--tapp-scale, 1)) calc(10px * var(--tapp-scale, 1));' +
              'border-radius:calc(6px * var(--tapp-scale, 1));' +
              'font-size:calc(11px * var(--tapp-font-scale, 1));' +
              'background:' + cardBg + ';border:1px solid ' + borderColor + ';' +
              'color:' + subtextColor + ';cursor:pointer;transition:all 0.2s;';
            Tapp.dom.setText(hintBtn, hint);

            hintBtn.onmouseenter = function() {
              hintBtn.style.borderColor = themeColor;
              hintBtn.style.color = themeColor;
            };
            hintBtn.onmouseleave = function() {
              hintBtn.style.borderColor = borderColor;
              hintBtn.style.color = subtextColor;
            };
            hintBtn.onclick = function() {
              input.value = hint + '：';
              input.focus();
            };
            hintsRow.appendChild(hintBtn);
          });
          emptyState.appendChild(hintsRow);
          messagesArea.appendChild(emptyState);
          return;
        }

        // 渲染消息（最多显示最近6条）
        var displayMessages = messages.slice(-6);
        displayMessages.forEach(function(msg) {
          var msgRow = document.createElement('div');
          msgRow.style.cssText = 
            'display:flex;gap:calc(8px * var(--tapp-scale, 1));' +
            (msg.role === 'user' ? 'flex-direction:row-reverse;' : '');

          var bubble = document.createElement('div');
          bubble.style.cssText = 
            'max-width:75%;padding:calc(8px * var(--tapp-scale, 1)) calc(12px * var(--tapp-scale, 1));' +
            'font-size:calc(12px * var(--tapp-font-scale, 1));line-height:1.5;word-break:break-word;' +
            (msg.role === 'user'
              ? 'background:' + themeColor + ';color:white;border-radius:calc(12px * var(--tapp-scale, 1)) calc(12px * var(--tapp-scale, 1)) calc(4px * var(--tapp-scale, 1)) calc(12px * var(--tapp-scale, 1));'
              : 'background:' + cardBg + ';color:' + textColor + ';border-radius:calc(12px * var(--tapp-scale, 1)) calc(12px * var(--tapp-scale, 1)) calc(12px * var(--tapp-scale, 1)) calc(4px * var(--tapp-scale, 1));backdrop-filter:blur(4px);');

          // 截断过长内容
          var displayContent = msg.content;
          if (displayContent.length > 120) displayContent = displayContent.substring(0, 120) + '...';
          Tapp.dom.setText(bubble, displayContent);

          msgRow.appendChild(bubble);
          messagesArea.appendChild(msgRow);
        });

        // 滚动到底部
        setTimeout(function() { messagesArea.scrollTop = messagesArea.scrollHeight; }, 10);
      }

      // 发送消息
      async function sendMessage() {
        var text = input.value.trim();
        if (!text || isGenerating) return;

        isGenerating = true;
        sendBtn.style.opacity = '0.5';
        input.value = '';

        messages.push({ role: 'user', content: text, timestamp: Date.now() });
        renderMessages();

        try {
          var response = await Tapp.ai.generate({ prompt: text, maxTokens: maxTokens });
          var result = (response && response.success) ? (response.result || t('errorNoResponse')) : t('errorNoResponse');
          messages.push({ role: 'assistant', content: result, timestamp: Date.now() });
          if (messages.length > 20) messages = messages.slice(-20);
          await Tapp.storage.set('widgetMessages', messages);
        } catch (error) {
          console.error('[AI Chat Widget] Error:', error);
          messages.push({ role: 'assistant', content: t('errorGenerate') + (error.message || 'Unknown'), timestamp: Date.now() });
        }

        renderMessages();
        isGenerating = false;
        sendBtn.style.opacity = '1';
      }

      // 清空对话
      async function clearChat() {
        if (messages.length === 0) return;
        messages = [];
        await Tapp.storage.set('widgetMessages', []);
        renderMessages();
      }

      // 绑定事件
      sendBtn.onclick = sendMessage;
      input.onkeydown = function(e) {
        if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
      };
      clearBtn.onclick = clearChat;

      // 初始渲染
      renderMessages();
    }

    console.log('[AI Chat Widget] 渲染完成, 尺寸:', size);
  }
};

console.log('[AI Chat] Widget 已注册');


// ========== PAGE 代码（页面渲染 + 生命周期）==========
// Page 模式使用内联样式 + CSS 变量

console.log('[AI Chat] Page 加载中...');

var chatHistory = [];
var isGenerating = false;
var currentTheme = 'dark';
var currentLang = 'zh-CN';
var currentPrimaryColor = '#8b5cf6';

function rerender() {
  renderPage(currentLang, currentTheme === 'dark', currentPrimaryColor);
}

function renderPage(locale, isDarkTheme, primaryColor) {
  currentLocale = normalizeLocale(locale);
  
  var isDark = isDarkTheme !== false;
  var themeColor = primaryColor || '#8b5cf6';

  var bgLayer = document.getElementById('tapp-background');
  var contentLayer = document.getElementById('tapp-content');
  
  if (bgLayer) bgLayer.innerHTML = '';
  if (contentLayer) contentLayer.innerHTML = '';

  var textColor = isDark ? '#f3f4f6' : '#1f2937';
  var subtextColor = isDark ? '#9ca3af' : '#6b7280';
  var borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  var inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)';
  var cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)';

  // 背景层
  if (bgLayer) {
    bgLayer.style.background = isDark ? '#0a0a0a' : '#f8fafc';

    var glow1 = document.createElement('div');
    glow1.style.cssText = 
      'position:absolute;right:-10%;top:-10%;width:50%;height:50%;border-radius:50%;' +
      'background:radial-gradient(circle,' + themeColor + '20,transparent 70%);' +
      'filter:blur(60px);pointer-events:none;';
    bgLayer.appendChild(glow1);

    var glow2 = document.createElement('div');
    glow2.style.cssText = 
      'position:absolute;left:-10%;bottom:-10%;width:40%;height:40%;border-radius:50%;' +
      'background:radial-gradient(circle,' + themeColor + '15,transparent 70%);' +
      'filter:blur(60px);pointer-events:none;';
    bgLayer.appendChild(glow2);
  }

  if (!contentLayer) return;

  contentLayer.style.fontFamily = 'system-ui,-apple-system,sans-serif';
  contentLayer.style.color = textColor;

  var mainContainer = document.createElement('div');
  mainContainer.style.cssText = 'height:100%;display:flex;flex-direction:column;max-width:1280px;margin:0 auto;';

  // 头部
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
  header.appendChild(headerIcon);

  var headerText = document.createElement('div');
  headerText.style.cssText = 'flex:1;';

  var headerTitle = document.createElement('h1');
  headerTitle.style.cssText = 'margin:0;font-size:calc(18px * var(--tapp-font-scale,1));font-weight:600;color:' + textColor + ';';
  Tapp.dom.setText(headerTitle, t('title'));
  headerText.appendChild(headerTitle);

  var headerSubtitle = document.createElement('p');
  headerSubtitle.style.cssText = 'margin:2px 0 0 0;font-size:calc(12px * var(--tapp-font-scale,1));color:' + subtextColor + ';';
  Tapp.dom.setText(headerSubtitle, t('subtitle'));
  headerText.appendChild(headerSubtitle);

  header.appendChild(headerText);

  var clearBtnPage = document.createElement('button');
  clearBtnPage.style.cssText = 
    'padding:calc(8px * var(--tapp-scale,1)) calc(16px * var(--tapp-scale,1));' +
    'font-size:calc(14px * var(--tapp-font-scale,1));' +
    'border:1px solid ' + borderColor + ';border-radius:calc(8px * var(--tapp-scale,1));' +
    'background:transparent;color:' + subtextColor + ';cursor:pointer;transition:all 0.2s;';
  Tapp.dom.setText(clearBtnPage, t('clearChat'));
  clearBtnPage.onmouseenter = function() { clearBtnPage.style.borderColor = themeColor; clearBtnPage.style.color = themeColor; };
  clearBtnPage.onmouseleave = function() { clearBtnPage.style.borderColor = borderColor; clearBtnPage.style.color = subtextColor; };
  header.appendChild(clearBtnPage);

  mainContainer.appendChild(header);

  // 消息区域
  var messagesArea = document.createElement('div');
  messagesArea.style.cssText = 'flex:1;overflow-y:auto;padding:calc(24px * var(--tapp-scale,1));';
  mainContainer.appendChild(messagesArea);

  // 输入区域
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
    'min-height:calc(52px * var(--tapp-scale,1));max-height:150px;font-family:inherit;transition:border-color 0.2s;';
  chatInput.onfocus = function() { chatInput.style.borderColor = themeColor; };
  chatInput.onblur = function() { chatInput.style.borderColor = borderColor; };
  inputWrapper.appendChild(chatInput);

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
  inputWrapper.appendChild(sendBtn);

  inputArea.appendChild(inputWrapper);
  mainContainer.appendChild(inputArea);
  contentLayer.appendChild(mainContainer);

  // 渲染消息
  function renderMessages() {
    messagesArea.innerHTML = '';

    if (chatHistory.length === 0) {
      var welcomeContainer = document.createElement('div');
      welcomeContainer.style.cssText = 
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'text-align:center;padding:calc(64px * var(--tapp-scale,1)) calc(24px * var(--tapp-scale,1));';

      var emojiIcon = document.createElement('div');
      emojiIcon.style.cssText = 'font-size:calc(64px * var(--tapp-scale,1));margin-bottom:calc(24px * var(--tapp-scale,1));';
      emojiIcon.textContent = '🤖';
      welcomeContainer.appendChild(emojiIcon);

      var welcomeTitle = document.createElement('div');
      welcomeTitle.style.cssText = 'font-size:calc(20px * var(--tapp-font-scale,1));font-weight:600;color:' + textColor + ';margin-bottom:calc(8px * var(--tapp-scale,1));';
      Tapp.dom.setText(welcomeTitle, t('welcome'));
      welcomeContainer.appendChild(welcomeTitle);

      var welcomeSubtitle = document.createElement('div');
      welcomeSubtitle.style.cssText = 'font-size:calc(14px * var(--tapp-font-scale,1));color:' + subtextColor + ';margin-bottom:calc(32px * var(--tapp-scale,1));';
      Tapp.dom.setText(welcomeSubtitle, t('welcomeSubtitle'));
      welcomeContainer.appendChild(welcomeSubtitle);

      var examplesContainer = document.createElement('div');
      examplesContainer.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:calc(12px * var(--tapp-scale,1));max-width:560px;';

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
        exampleBtn.onmouseenter = function() { exampleBtn.style.borderColor = themeColor; exampleBtn.style.color = themeColor; };
        exampleBtn.onmouseleave = function() { exampleBtn.style.borderColor = borderColor; exampleBtn.style.color = subtextColor; };
        exampleBtn.onclick = function() { sendMessage(q); };
        examplesContainer.appendChild(exampleBtn);
      });

      welcomeContainer.appendChild(examplesContainer);
      messagesArea.appendChild(welcomeContainer);
      return;
    }

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
      msgContainer.appendChild(avatar);

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
      contentArea.appendChild(bubble);

      var timestamp = document.createElement('div');
      timestamp.style.cssText = 
        'font-size:calc(10px * var(--tapp-font-scale,1));color:' + subtextColor + ';' +
        'margin-top:calc(6px * var(--tapp-scale,1));' + (msg.role === 'user' ? 'text-align:right;' : '');
      Tapp.dom.setText(timestamp, formatTime(msg.timestamp));
      contentArea.appendChild(timestamp);

      msgContainer.appendChild(contentArea);
      messagesArea.appendChild(msgContainer);
    });

    setTimeout(function() { messagesArea.scrollTop = messagesArea.scrollHeight; }, 10);
  }

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
      chatHistory.push({ role: 'assistant', content: t('errorGenerate') + (error.message || 'Unknown'), timestamp: Date.now() });
    }

    try {
      var saveHistory = await Tapp.settings.get('saveHistory');
      if (saveHistory !== false) {
        var maxHistory = await Tapp.settings.get('maxHistory') || 100;
        if (chatHistory.length > maxHistory) chatHistory = chatHistory.slice(-maxHistory);
        await Tapp.storage.set('chatHistory', chatHistory);
      }
    } catch (e) {}

    renderMessages();
    isGenerating = false;
    sendBtn.disabled = false;
    Tapp.dom.setText(sendBtn, t('send'));
  }

  async function clearChat() {
    if (chatHistory.length === 0) return;
    chatHistory = [];
    await Tapp.storage.set('chatHistory', []);
    renderMessages();
    await Tapp.ui.showNotification({ title: t('clearSuccess'), message: t('clearMessage'), type: 'info' });
  }

  sendBtn.onclick = function() { sendMessage(chatInput.value); };
  chatInput.onkeydown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput.value); }
  };
  chatInput.oninput = function() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
  };
  clearBtnPage.onclick = clearChat;

  renderMessages();
  console.log('[AI Chat] Page 已渲染');
}

// 生命周期
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
