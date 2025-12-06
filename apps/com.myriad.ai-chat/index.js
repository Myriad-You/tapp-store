// AI Chat Tapp v1.0
// AI 聊天助手
// Widget 使用同步 DOM 渲染，确保立即显示

console.log('[AI Chat] 加载中...');

// ========== i18n ==========
var i18n = {
  'zh-CN': {
    widgetTitle: 'AI 助手',
    placeholder: '输入你的问题...',
    send: '发送',
    startChat: '开始对话吧',
    hints: ['写代码', '翻译', '解释概念', '问答'],
    title: 'AI 聊天助手',
    subtitle: '由 AI 驱动的智能对话',
    welcome: '你好！我是 AI 助手',
    welcomeSubtitle: '有什么可以帮助你的吗？',
    clearChat: '清空对话',
    clearSuccess: '对话已清空',
    clearMessage: '开始新的对话吧',
    sending: '生成中...',
    errorGenerate: '生成回复时出错：',
    errorNoResponse: '抱歉，暂时无法回答。',
    examples: ['解释人工智能', '写一首诗', '如何学编程', '推荐电影'],
  },
  'en-US': {
    widgetTitle: 'AI Assistant',
    placeholder: 'Ask a question...',
    send: 'Send',
    startChat: 'Start chatting',
    hints: ['Code', 'Translate', 'Explain', 'Q&A'],
    title: 'AI Chat',
    subtitle: 'AI-powered conversation',
    welcome: 'Hello! I\'m AI Assistant',
    welcomeSubtitle: 'How can I help you?',
    clearChat: 'Clear',
    clearSuccess: 'Cleared',
    clearMessage: 'Start a new conversation',
    sending: 'Generating...',
    errorGenerate: 'Error: ',
    errorNoResponse: 'Sorry, cannot answer now.',
    examples: ['Explain AI', 'Write a poem', 'Learn coding', 'Movie tips'],
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

console.log('[AI Chat] Core 已加载');


// ========== WIDGET ==========
console.log('[AI Chat] 注册 Widget...');

Tapp.widgets['ai-chat'] = {
  // 同步渲染，不使用 async
  render: function(container, props) {
    console.log('[AI Chat Widget] render 调用, props:', JSON.stringify(props));
    
    try {
      // 获取属性
      var isDark = props.theme === 'dark';
      var themeColor = props.primaryColor || '#8b5cf6';
      var size = props.size || '4x2';
      var isCompact = size === '4x2';
      
      currentLocale = normalizeLocale(props.locale);

      // 颜色
      var textColor = isDark ? '#f3f4f6' : '#1f2937';
      var subtextColor = isDark ? '#9ca3af' : '#6b7280';
      var borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
      var inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
      var cardBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)';
      var glassBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)';

      // 清空容器
      container.innerHTML = '';
      container.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden;';

      // 主容器
      var main = document.createElement('div');
      main.style.cssText = 
        'position:relative;width:100%;height:100%;' +
        'border-radius:calc(16px * var(--tapp-scale, 1));overflow:hidden;' +
        'background:' + glassBg + ';' +
        'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' +
        'border:1px solid ' + borderColor + ';';

      // 渐变装饰
      var gradient = document.createElement('div');
      gradient.style.cssText = 
        'position:absolute;inset:0;pointer-events:none;' +
        'background:linear-gradient(135deg,' + themeColor + '10,transparent 60%);';
      main.appendChild(gradient);

      // 内容区
      var content = document.createElement('div');
      content.style.cssText = 
        'position:relative;z-index:10;height:100%;' +
        'display:flex;flex-direction:column;';

      if (isCompact) {
        // ===== 4x2 紧凑布局 =====
        content.style.cssText = 
          'position:relative;z-index:10;height:100%;' +
          'display:flex;align-items:center;gap:calc(12px * var(--tapp-scale, 1));' +
          'padding:calc(12px * var(--tapp-scale, 1)) calc(16px * var(--tapp-scale, 1));';

        // 图标
        var icon = document.createElement('div');
        icon.style.cssText = 
          'flex-shrink:0;width:calc(40px * var(--tapp-scale, 1));height:calc(40px * var(--tapp-scale, 1));' +
          'border-radius:calc(12px * var(--tapp-scale, 1));' +
          'display:flex;align-items:center;justify-content:center;' +
          'font-size:calc(20px * var(--tapp-scale, 1));' +
          'background:linear-gradient(135deg,' + themeColor + '30,' + themeColor + '10);';
        icon.textContent = '🤖';
        content.appendChild(icon);

        // 输入框
        var inputWrap = document.createElement('div');
        inputWrap.style.cssText = 'flex:1;min-width:0;';

        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = t('placeholder');
        input.style.cssText = 
          'width:100%;padding:calc(10px * var(--tapp-scale, 1)) calc(14px * var(--tapp-scale, 1));' +
          'border-radius:calc(10px * var(--tapp-scale, 1));' +
          'font-size:calc(14px * var(--tapp-font-scale, 1));' +
          'background:' + inputBg + ';border:1px solid ' + borderColor + ';' +
          'color:' + textColor + ';outline:none;transition:all 0.2s;';
        
        input.onfocus = function() {
          input.style.borderColor = themeColor;
          input.style.boxShadow = '0 0 0 3px ' + themeColor + '20';
        };
        input.onblur = function() {
          input.style.borderColor = borderColor;
          input.style.boxShadow = 'none';
        };
        inputWrap.appendChild(input);
        content.appendChild(inputWrap);

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

        // 绑定事件
        var sending = false;
        function doSend() {
          var text = input.value.trim();
          if (!text || sending) return;
          sending = true;
          sendBtn.style.opacity = '0.5';
          input.value = '';

          Tapp.ai.generate({ prompt: text, maxTokens: 500 })
            .then(function(resp) {
              console.log('[AI Chat] Response:', resp);
            })
            .catch(function(err) {
              console.error('[AI Chat] Error:', err);
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
        // ===== 4x4 完整布局 =====
        
        // 头部
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
        headerTitle.textContent = t('widgetTitle');
        header.appendChild(headerTitle);

        var statusDot = document.createElement('div');
        statusDot.style.cssText = 
          'width:calc(6px * var(--tapp-scale, 1));height:calc(6px * var(--tapp-scale, 1));' +
          'border-radius:50%;background:#22c55e;';
        header.appendChild(statusDot);
        content.appendChild(header);

        // 消息区域
        var msgArea = document.createElement('div');
        msgArea.style.cssText = 
          'flex:1;overflow-y:auto;padding:calc(12px * var(--tapp-scale, 1));' +
          'display:flex;flex-direction:column;gap:calc(10px * var(--tapp-scale, 1));';
        
        // 空状态
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
        emptyText.textContent = t('startChat');
        emptyState.appendChild(emptyText);

        // 提示词
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
          hintBtn.textContent = hint;
          hintBtn.onmouseenter = function() {
            hintBtn.style.borderColor = themeColor;
            hintBtn.style.color = themeColor;
          };
          hintBtn.onmouseleave = function() {
            hintBtn.style.borderColor = borderColor;
            hintBtn.style.color = subtextColor;
          };
          hintsRow.appendChild(hintBtn);
        });
        emptyState.appendChild(hintsRow);
        msgArea.appendChild(emptyState);
        content.appendChild(msgArea);

        // 输入区域
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
          'color:' + textColor + ';outline:none;transition:all 0.2s;';

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

        // 绑定事件
        var sending = false;
        function doSend() {
          var text = input.value.trim();
          if (!text || sending) return;
          sending = true;
          sendBtn.style.opacity = '0.5';
          input.value = '';

          Tapp.ai.generate({ prompt: text, maxTokens: 500 })
            .then(function(resp) {
              console.log('[AI Chat] Response:', resp);
            })
            .catch(function(err) {
              console.error('[AI Chat] Error:', err);
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
      }

      main.appendChild(content);

      // 编辑模式
      if (props.isEditMode) {
        var editIndicator = document.createElement('div');
        editIndicator.style.cssText = 
          'position:absolute;inset:0;border:2px dashed rgba(59,130,246,0.5);' +
          'border-radius:calc(16px * var(--tapp-scale, 1));pointer-events:none;z-index:100;';
        main.appendChild(editIndicator);
      }

      container.appendChild(main);
      console.log('[AI Chat Widget] 渲染完成, 尺寸:', size);

    } catch (err) {
      console.error('[AI Chat Widget] 渲染错误:', err);
      container.innerHTML = '<div style="color:red;padding:16px;">Widget Error: ' + err.message + '</div>';
    }
  }
};

console.log('[AI Chat] Widget 已注册');


// ========== PAGE ==========
var chatHistory = [];
var isGenerating = false;
var currentTheme = 'dark';
var currentLang = 'zh-CN';
var currentPrimaryColor = '#8b5cf6';

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

  if (bgLayer) {
    bgLayer.style.background = isDark ? '#0a0a0a' : '#f8fafc';

    var glow1 = document.createElement('div');
    glow1.style.cssText = 
      'position:absolute;right:-10%;top:-10%;width:50%;height:50%;border-radius:50%;' +
      'background:radial-gradient(circle,' + themeColor + '20,transparent 70%);' +
      'filter:blur(60px);pointer-events:none;';
    bgLayer.appendChild(glow1);
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
  headerTitle.textContent = t('title');
  headerText.appendChild(headerTitle);

  var headerSubtitle = document.createElement('p');
  headerSubtitle.style.cssText = 'margin:2px 0 0 0;font-size:calc(12px * var(--tapp-font-scale,1));color:' + subtextColor + ';';
  headerSubtitle.textContent = t('subtitle');
  headerText.appendChild(headerSubtitle);

  header.appendChild(headerText);
  mainContainer.appendChild(header);

  // 消息区域
  var messagesArea = document.createElement('div');
  messagesArea.style.cssText = 'flex:1;overflow-y:auto;padding:calc(24px * var(--tapp-scale,1));';

  // 欢迎界面
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
  welcomeTitle.textContent = t('welcome');
  welcomeContainer.appendChild(welcomeTitle);

  var welcomeSubtitle = document.createElement('div');
  welcomeSubtitle.style.cssText = 'font-size:calc(14px * var(--tapp-font-scale,1));color:' + subtextColor + ';margin-bottom:calc(32px * var(--tapp-scale,1));';
  welcomeSubtitle.textContent = t('welcomeSubtitle');
  welcomeContainer.appendChild(welcomeSubtitle);

  messagesArea.appendChild(welcomeContainer);
  mainContainer.appendChild(messagesArea);

  // 输入区域
  var inputArea = document.createElement('div');
  inputArea.style.cssText = 
    'padding:calc(16px * var(--tapp-scale,1)) calc(24px * var(--tapp-scale,1));' +
    'background:' + cardBg + ';backdrop-filter:blur(12px);' +
    'border-top:1px solid ' + borderColor + ';';

  var inputWrapper = document.createElement('div');
  inputWrapper.style.cssText = 'display:flex;gap:calc(12px * var(--tapp-scale,1));max-width:960px;margin:0 auto;';

  var chatInput = document.createElement('input');
  chatInput.type = 'text';
  chatInput.placeholder = t('placeholder');
  chatInput.style.cssText = 
    'flex:1;padding:calc(12px * var(--tapp-scale,1)) calc(16px * var(--tapp-scale,1));' +
    'font-size:calc(14px * var(--tapp-font-scale,1));' +
    'border:2px solid ' + borderColor + ';border-radius:calc(16px * var(--tapp-scale,1));' +
    'background:' + inputBg + ';' +
    'color:' + textColor + ';outline:none;transition:border-color 0.2s;';
  chatInput.onfocus = function() { chatInput.style.borderColor = themeColor; };
  chatInput.onblur = function() { chatInput.style.borderColor = borderColor; };
  inputWrapper.appendChild(chatInput);

  var sendBtn = document.createElement('button');
  sendBtn.style.cssText = 
    'padding:calc(12px * var(--tapp-scale,1)) calc(28px * var(--tapp-scale,1));' +
    'font-size:calc(14px * var(--tapp-font-scale,1));font-weight:500;' +
    'border:none;border-radius:calc(16px * var(--tapp-scale,1));' +
    'background:' + themeColor + ';color:white;cursor:pointer;transition:opacity 0.2s;';
  sendBtn.textContent = t('send');
  sendBtn.onmouseenter = function() { sendBtn.style.opacity = '0.9'; };
  sendBtn.onmouseleave = function() { sendBtn.style.opacity = '1'; };
  inputWrapper.appendChild(sendBtn);

  inputArea.appendChild(inputWrapper);
  mainContainer.appendChild(inputArea);
  contentLayer.appendChild(mainContainer);

  console.log('[AI Chat] Page 已渲染');
}

// 生命周期
Tapp.lifecycle.onReady(function() {
  console.log('[AI Chat] onReady 调用');
  
  Promise.all([
    Tapp.ui.getLocale(),
    Tapp.ui.getTheme(),
    Tapp.ui.getPrimaryColor()
  ]).then(function(results) {
    currentLang = results[0];
    currentTheme = results[1];
    currentPrimaryColor = results[2];
    renderPage(currentLang, currentTheme === 'dark', currentPrimaryColor);
  }).catch(function(err) {
    console.error('[AI Chat] 初始化失败:', err);
    renderPage('zh-CN', true, '#8b5cf6');
  });
});

Tapp.lifecycle.onDestroy(function() {
  console.log('[AI Chat] onDestroy 调用');
});

console.log('[AI Chat] Tapp 已加载');
