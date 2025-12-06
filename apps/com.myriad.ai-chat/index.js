// ========== CORE 代码（共享工具函数）==========
// Core 部分在 Widget 和 Page 模式下都会加载

console.log('[AI Chat] Core 加载中...');

// 时间格式化工具
function formatTime(date) {
  return new Date(date).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 获取主色调
async function getPrimaryColor() {
  try {
    return await Tapp.ui.getPrimaryColor();
  } catch (e) {
    return '#8b5cf6'; // 默认紫色
  }
}

console.log('[AI Chat] Core 已加载');


// ========== WIDGET 代码（小组件渲染）==========
// Widget 模式只加载 core + widget，不执行 onReady

console.log('[AI Chat] Widget 加载中...');

Tapp.widgets['ai-chat'] = {
  render: async function(container, props) {
    const scale = props.scale || 1;
    const fontScale = props.fontScale || 1;
    const size = props.size.split('x').map(Number);
    const isCompact = size[0] <= 2 && size[1] <= 2;

    // 加载历史消息
    let messages = await Tapp.storage.get('widgetMessages') || [];
    let isGenerating = false;

    // 获取用户设置
    const maxTokens = await Tapp.settings.get('maxTokens') || 500;

    // 渲染消息列表
    function renderMessages() {
      const messagesArea = container.querySelector('.messages-area');
      if (!messagesArea) return;

      if (messages.length === 0) {
        // 空状态
        const hints = isCompact ? [] : ['写代码', '翻译', '解释概念'];
        messagesArea.innerHTML = `
          <div class="flex-1 flex flex-col items-center justify-center text-center p-3">
            <div class="text-4xl mb-2 opacity-50" style="font-size: ${isCompact ? 28 : 36}px;">💬</div>
            <div class="text-xs text-gray-600 dark:text-gray-400" style="font-size: ${12 * fontScale}px;">开始对话吧</div>
            ${hints.length > 0 ? `
              <div class="mt-3 flex flex-wrap justify-center gap-1.5" style="gap: ${6 * scale}px; margin-top: ${12 * scale}px;">
                ${hints.map(hint => `
                  <button class="hint-chip px-2 py-1 text-[10px] border border-gray-300 dark:border-gray-600 rounded-lg
                                 bg-white/40 dark:bg-white/[0.02] hover:bg-white/60 dark:hover:bg-white/[0.04]
                                 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400
                                 hover:border-indigo-400 transition-colors cursor-pointer"
                       style="font-size: ${11 * fontScale}px; padding: ${4 * scale}px ${10 * scale}px;"
                       data-hint="${Tapp.dom.escapeHtml(hint)}">
                    ${Tapp.dom.escapeHtml(hint)}
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;

        // 绑定提示词点击事件
        container.querySelectorAll('.hint-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            const input = container.querySelector('.chat-input');
            if (input) {
              input.value = chip.dataset.hint + '：';
              input.focus();
            }
          });
        });
        return;
      }

      // 显示最近的消息
      const displayMessages = messages.slice(isCompact ? -4 : -10);
      messagesArea.innerHTML = displayMessages.map(msg => {
        let content = msg.content;
        const maxLen = isCompact ? 100 : 300;
        if (content.length > maxLen) {
          content = content.substring(0, maxLen) + '...';
        }

        return `
          <div class="flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}"
               style="gap: ${8 * scale}px; align-items: flex-start;">
            <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-xs
                        ${msg.role === 'user' ? 'bg-indigo-500/90' : 'bg-white/20 dark:bg-white/[0.05]'}"
                 style="width: ${isCompact ? 22 : 26}px; height: ${isCompact ? 22 : 26}px; font-size: ${isCompact ? 11 : 13}px;">
              ${msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div class="max-w-[85%] px-3 py-2 rounded-xl ${msg.role === 'user'
              ? 'bg-indigo-500/90 text-white rounded-br-sm'
              : 'bg-white/40 dark:bg-white/[0.03] text-gray-800 dark:text-gray-200 rounded-bl-sm'}
                        backdrop-blur-sm"
                 style="padding: ${isCompact ? 8 : 10}px ${isCompact ? 10 : 14}px;
                        font-size: ${isCompact ? 12 : 13}px;
                        line-height: 1.5;">
              ${Tapp.dom.escapeHtml(content)}
            </div>
          </div>
        `;
      }).join('');

      // 滚动到底部
      setTimeout(() => {
        messagesArea.scrollTop = messagesArea.scrollHeight;
      }, 10);
    }

    // 发送消息
    async function sendMessage(text) {
      if (!text || isGenerating) return;
      text = text.trim();
      if (!text) return;

      isGenerating = true;
      const sendBtn = container.querySelector('.send-btn');
      const statusDot = container.querySelector('.status-dot');
      const input = container.querySelector('.chat-input');

      if (sendBtn) sendBtn.disabled = true;
      if (statusDot) statusDot.style.background = '#f59e0b';
      if (input) input.value = '';

      // 添加用户消息
      messages.push({
        role: 'user',
        content: text,
        timestamp: Date.now()
      });
      renderMessages();

      try {
        const response = await Tapp.ai.generate({
          prompt: text,
          maxTokens: maxTokens
        });

        let content = '';
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
            content: '抱歉，我暂时无法回答这个问题。',
            timestamp: Date.now()
          });
        }

        // 限制历史数量
        const maxHistory = await Tapp.settings.get('maxHistory') || 100;
        if (messages.length > maxHistory) {
          messages = messages.slice(-maxHistory);
        }
        await Tapp.storage.set('widgetMessages', messages);

      } catch (error) {
        console.error('[AI Chat Widget] Error:', error);
        messages.push({
          role: 'assistant',
          content: '出错了: ' + (error && error.message ? error.message : '请求失败'),
          timestamp: Date.now()
        });
      }

      renderMessages();

      isGenerating = false;
      if (sendBtn) {
        sendBtn.disabled = false;
      }
      if (statusDot) statusDot.style.background = '#22c55e';
    }

    // 清空对话
    async function clearChat() {
      if (messages.length === 0) return;
      messages = [];
      await Tapp.storage.set('widgetMessages', []);
      renderMessages();
    }

    // 渲染容器
    container.innerHTML = `
      <div class="relative h-full w-full rounded-xl overflow-hidden glass">
        <!-- 背景装饰层 -->
        <div class="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent"></div>

        <!-- 主内容区 -->
        <div class="relative z-10 h-full flex flex-col" style="padding: 0;">

          <!-- 头部 -->
          <div class="flex items-center gap-2 border-b border-gray-200/50 dark:border-gray-700/50"
               style="padding: ${isCompact ? 10 : 12}px ${isCompact ? 12 : 16}px; gap: ${8 * scale}px;">
            <span style="font-size: ${isCompact ? 16 : 18}px;">🤖</span>
            <span class="flex-1 font-semibold text-gray-800 dark:text-gray-200"
                  style="font-size: ${isCompact ? 13 : 14}px;">AI 助手</span>
            <div class="status-dot w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></div>
            <button class="clear-btn w-6 h-6 flex items-center justify-center rounded-md
                           bg-transparent hover:bg-gray-200/50 dark:hover:bg-white/[0.05]
                           text-gray-500 dark:text-gray-400 transition-colors opacity-60 hover:opacity-100"
                    title="清空对话">
              🗑️
            </button>
          </div>

          <!-- 消息区域 -->
          <div class="messages-area flex-1 overflow-y-auto flex flex-col gap-2.5 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
               style="padding: ${isCompact ? 8 : 12}px; gap: ${isCompact ? 8 : 10}px;">
            <!-- 消息将在这里渲染 -->
          </div>

          <!-- 输入区域 -->
          <div class="border-t border-gray-200/50 dark:border-gray-700/50"
               style="padding: ${isCompact ? 8 : 10}px ${isCompact ? 8 : 12}px;">
            <div class="flex gap-1.5 items-center" style="gap: ${6 * scale}px;">
              <input type="text"
                     class="chat-input flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                            bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm
                            text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400
                            focus:border-indigo-500 focus:outline-none transition-colors"
                     placeholder="${isCompact ? '提问...' : '输入问题...'}"
                     style="padding: ${isCompact ? 8 : 10}px ${isCompact ? 10 : 14}px;
                            font-size: ${(isCompact ? 12 : 13) * fontScale}px;">
              <button class="send-btn w-8 h-8 flex items-center justify-center rounded-lg
                             bg-indigo-500 hover:bg-indigo-600 text-white
                             transition-colors disabled:opacity-60 flex-shrink-0"
                      style="width: ${isCompact ? 32 : 36}px; height: ${isCompact ? 32 : 36}px;"
                      title="发送">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
              </button>
            </div>
          </div>

        </div>

        <!-- 编辑模式边框 -->
        ${props.isEditMode ? `
          <div class="absolute inset-0 border-2 border-dashed border-violet-400 rounded-xl pointer-events-none"></div>
        ` : ''}
      </div>
    `;

    // 绑定事件
    const input = container.querySelector('.chat-input');
    const sendBtn = container.querySelector('.send-btn');
    const clearBtn = container.querySelector('.clear-btn');

    if (sendBtn) {
      sendBtn.addEventListener('click', () => sendMessage(input.value));
    }

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(input.value);
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', clearChat);
    }

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
    'background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);';
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
  Tapp.dom.setText(headerTitle, 'AI 聊天助手');

  var headerSubtitle = document.createElement('p');
  headerSubtitle.className = 'tapp-hide-compact';
  headerSubtitle.style.cssText = 
    'margin: 2px 0 0 0;' +
    'font-size: calc(12px * var(--tapp-font-scale, 1));' +
    'color: ' + (isDark ? '#9ca3af' : '#6b7280') + ';';
  Tapp.dom.setText(headerSubtitle, '由 AI 驱动的智能对话');

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
  Tapp.dom.setText(clearBtnPage, '清空对话');

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
  chatInput.placeholder = '输入你的问题...（按 Enter 发送，Shift+Enter 换行）';
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
  Tapp.dom.setText(sendBtn, '发送');

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
      Tapp.dom.setText(welcomeTitle, '你好！我是 AI 助手');

      var welcomeSubtitle = document.createElement('div');
      welcomeSubtitle.style.cssText = 
        'font-size: calc(14px * var(--tapp-font-scale, 1));' +
        'color: ' + (isDark ? '#9ca3af' : '#6b7280') + ';' +
        'margin-bottom: calc(32px * var(--tapp-scale, 1));';
      Tapp.dom.setText(welcomeSubtitle, '有什么可以帮助你的吗？');

      var examplesContainer = document.createElement('div');
      examplesContainer.style.cssText = 
        'display: flex;' +
        'flex-wrap: wrap;' +
        'justify-content: center;' +
        'gap: calc(12px * var(--tapp-scale, 1));' +
        'max-width: 560px;';

      var examples = ['解释一下人工智能', '帮我写一首诗', '如何学习编程', '推荐一部电影'];
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
        'background: ' + (msg.role === 'user' ? 'rgba(99,102,241,0.9)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')) + ';';
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
        'background: ' + (msg.role === 'user' ? 'rgba(99,102,241,0.9)' : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)')) + ';' +
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
      Tapp.dom.setText(sendBtn, '生成中...');
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
        content = '抱歉，我暂时无法回答这个问题。';
      }

      chatHistory.push({
        role: 'assistant',
        content: content,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[AI Chat] 生成失败:', error);
      var errorMsg = error && error.message ? error.message : '未知错误';
      chatHistory.push({
        role: 'assistant',
        content: '抱歉，生成回复时遇到了问题：' + errorMsg,
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
      Tapp.dom.setText(sendBtn, '发送');
    }
  }

  // 清空对话
  async function clearChat() {
    if (chatHistory.length === 0) return;
    chatHistory = [];
    await Tapp.storage.set('chatHistory', []);
    renderMessages();
    await Tapp.ui.showNotification({
      title: '对话已清空',
      message: '开始新的对话吧',
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
