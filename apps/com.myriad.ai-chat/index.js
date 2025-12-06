// ========== CORE 代码（共享工具函数）==========
// Core 部分在 Widget 和 Page 模式下都会加载

// 主题颜色配置
function getThemeColors(isDark, primaryColor) {
  // 如果没有提供主色调，使用默认值
  var accent = primaryColor || '#8b5cf6';

  // 生成 hover 色（稍微变暗）
  var accentHover = primaryColor ? adjustColorBrightness(primaryColor, -10) : '#7c3aed';

  return {
    bg: isDark ? '#0f172a' : '#f8fafc',
    card: isDark ? '#1e293b' : '#ffffff',
    cardHover: isDark ? '#334155' : '#f1f5f9',
    border: isDark ? '#334155' : '#e2e8f0',
    text: isDark ? '#f1f5f9' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    accent: accent,
    accentHover: accentHover,
    userBg: accent,
    aiBg: isDark ? '#1e293b' : '#f1f5f9',
  };
}

// 调整颜色亮度的辅助函数
function adjustColorBrightness(hex, percent) {
  // 移除 # 号
  hex = hex.replace('#', '');

  // 转换为 RGB
  var r = parseInt(hex.substring(0, 2), 16);
  var g = parseInt(hex.substring(2, 4), 16);
  var b = parseInt(hex.substring(4, 6), 16);

  // 调整亮度
  r = Math.max(0, Math.min(255, r + (r * percent / 100)));
  g = Math.max(0, Math.min(255, g + (g * percent / 100)));
  b = Math.max(0, Math.min(255, b + (b * percent / 100)));

  // 转换回十六进制
  var rr = Math.round(r).toString(16).padStart(2, '0');
  var gg = Math.round(g).toString(16).padStart(2, '0');
  var bb = Math.round(b).toString(16).padStart(2, '0');

  return '#' + rr + gg + bb;
}

// 时间格式化工具
function formatTime(date) {
  return new Date(date).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 创建加载动画 SVG
function getLoadingIcon() {
  return '<div style="width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div>';
}

// 创建发送图标 SVG
function getSendIcon() {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
}

// 添加旋转动画样式（如果还没有添加）
(function addSpinAnimation() {
  if (!document.getElementById('tapp-spin-animation')) {
    var style = document.createElement('style');
    style.id = 'tapp-spin-animation';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
})();


// ========== WIDGET 代码（小组件渲染）==========
// Widget 模式只加载 core + widget，不执行 onReady

Tapp.widgets['ai-chat'] = {
  render: async function(container, props) {
    var isDark = props.theme === 'dark';
    var size = props.size.split('x').map(Number);
    var isCompact = size[0] <= 2 && size[1] <= 2;

    // 获取全局主色调
    var primaryColor = await Tapp.ui.getPrimaryColor();
    var colors = getThemeColors(isDark, primaryColor);

    // 加载历史消息
    var messages = await Tapp.storage.get('widgetMessages') || [];
    var isGenerating = false;

    // 获取用户设置
    var maxTokens = await Tapp.settings.get('maxTokens') || 500;

    // 容器样式
    container.style.cssText =
      'height: 100%;' +
      'display: flex;' +
      'flex-direction: column;' +
      'background: ' + colors.card + ';' +
      'border-radius: 16px;' +
      'box-sizing: border-box;' +
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      'overflow: hidden;';
    container.innerHTML = '';

    // ===== 头部 =====
    var header = document.createElement('div');
    header.style.cssText =
      'padding: ' + (isCompact ? '10px 12px' : '12px 16px') + ';' +
      'border-bottom: 1px solid ' + colors.border + ';' +
      'display: flex;' +
      'align-items: center;' +
      'gap: 8px;' +
      'flex-shrink: 0;';

    var icon = document.createElement('span');
    icon.textContent = '🤖';
    icon.style.cssText = 'font-size: ' + (isCompact ? '16px' : '18px') + ';';

    var title = document.createElement('span');
    Tapp.dom.setText(title, 'AI 助手');
    title.style.cssText =
      'font-size: ' + (isCompact ? '13px' : '14px') + ';' +
      'font-weight: 600;' +
      'color: ' + colors.text + ';' +
      'flex: 1;';

    var statusDot = document.createElement('span');
    statusDot.style.cssText =
      'width: 6px;' +
      'height: 6px;' +
      'border-radius: 50%;' +
      'background: #22c55e;' +
      'flex-shrink: 0;';

    var clearBtn = document.createElement('button');
    clearBtn.innerHTML = '🗑️';
    clearBtn.title = '清空对话';
    clearBtn.style.cssText =
      'width: 24px;' +
      'height: 24px;' +
      'border: none;' +
      'border-radius: 6px;' +
      'background: transparent;' +
      'color: ' + colors.textSecondary + ';' +
      'font-size: 12px;' +
      'cursor: pointer;' +
      'opacity: 0.6;' +
      'transition: all 0.2s;' +
      'display: flex;' +
      'align-items: center;' +
      'justify-content: center;';
    clearBtn.onmouseenter = function() {
      clearBtn.style.opacity = '1';
      clearBtn.style.background = colors.border;
    };
    clearBtn.onmouseleave = function() {
      clearBtn.style.opacity = '0.6';
      clearBtn.style.background = 'transparent';
    };

    header.appendChild(icon);
    header.appendChild(title);
    header.appendChild(statusDot);
    header.appendChild(clearBtn);
    container.appendChild(header);

    // ===== 消息区域 =====
    var messagesArea = document.createElement('div');
    messagesArea.style.cssText =
      'flex: 1;' +
      'overflow-y: auto;' +
      'padding: ' + (isCompact ? '8px' : '12px') + ';' +
      'display: flex;' +
      'flex-direction: column;' +
      'gap: ' + (isCompact ? '8px' : '10px') + ';';

    // 渲染消息列表
    function renderMessages() {
      messagesArea.innerHTML = '';

      if (messages.length === 0) {
        // 空状态
        var empty = Tapp.dom.createElement('div', {
          className: 'empty-state'
        });
        empty.style.cssText =
          'flex: 1;' +
          'display: flex;' +
          'flex-direction: column;' +
          'align-items: center;' +
          'justify-content: center;' +
          'color: ' + colors.textSecondary + ';' +
          'text-align: center;' +
          'padding: 12px;';

        var emptyIcon = Tapp.dom.createElement('div', {
          text: '💬'
        });
        emptyIcon.style.cssText =
          'font-size: ' + (isCompact ? '28px' : '36px') + ';' +
          'margin-bottom: 8px;' +
          'opacity: 0.5;';

        var emptyText = Tapp.dom.createElement('div', {
          text: '开始对话吧'
        });
        emptyText.style.cssText = 'font-size: ' + (isCompact ? '12px' : '13px') + ';';

        empty.appendChild(emptyIcon);
        empty.appendChild(emptyText);

        // 快捷提示（非紧凑模式）
        if (!isCompact) {
          var hints = ['写代码', '翻译', '解释概念', '头脑风暴'];
          var hintsDiv = document.createElement('div');
          hintsDiv.style.cssText =
            'display: flex;' +
            'flex-wrap: wrap;' +
            'justify-content: center;' +
            'gap: 6px;' +
            'margin-top: 12px;';

          hints.forEach(function(hint) {
            var chip = document.createElement('button');
            Tapp.dom.setText(chip, hint);
            chip.style.cssText =
              'padding: 4px 10px;' +
              'border: 1px solid ' + colors.border + ';' +
              'border-radius: 12px;' +
              'background: transparent;' +
              'color: ' + colors.textSecondary + ';' +
              'font-size: 11px;' +
              'cursor: pointer;' +
              'transition: all 0.2s;';
            chip.onmouseenter = function() {
              chip.style.borderColor = colors.accent;
              chip.style.color = colors.accent;
            };
            chip.onmouseleave = function() {
              chip.style.borderColor = colors.border;
              chip.style.color = colors.textSecondary;
            };
            chip.onclick = function() {
              input.value = hint + '：';
              input.focus();
            };
            hintsDiv.appendChild(chip);
          });
          empty.appendChild(hintsDiv);
        }

        messagesArea.appendChild(empty);
        return;
      }

      // 显示最近的消息
      var displayMessages = messages.slice(isCompact ? -4 : -10);

      displayMessages.forEach(function(msg) {
        var msgEl = document.createElement('div');
        msgEl.style.cssText =
          'display: flex;' +
          'gap: 8px;' +
          'align-items: flex-start;' +
          (msg.role === 'user' ? 'flex-direction: row-reverse;' : '');

        var avatar = document.createElement('div');
        avatar.textContent = msg.role === 'user' ? '👤' : '🤖';
        avatar.style.cssText =
          'width: ' + (isCompact ? '22px' : '26px') + ';' +
          'height: ' + (isCompact ? '22px' : '26px') + ';' +
          'border-radius: 6px;' +
          'display: flex;' +
          'align-items: center;' +
          'justify-content: center;' +
          'font-size: ' + (isCompact ? '11px' : '13px') + ';' +
          'flex-shrink: 0;' +
          'background: ' + (msg.role === 'user' ? colors.userBg : colors.aiBg) + ';';

        var bubble = document.createElement('div');
        bubble.style.cssText =
          'max-width: 85%;' +
          'padding: ' + (isCompact ? '8px 10px' : '10px 14px') + ';' +
          'border-radius: 12px;' +
          'font-size: ' + (isCompact ? '12px' : '13px') + ';' +
          'line-height: 1.5;' +
          'word-break: break-word;' +
          'white-space: pre-wrap;' +
          (msg.role === 'user'
            ? 'background: ' + colors.userBg + '; color: #fff; border-bottom-right-radius: 4px;'
            : 'background: ' + colors.aiBg + '; color: ' + colors.text + '; border-bottom-left-radius: 4px;');

        // 截断长消息
        var content = msg.content;
        var maxLen = isCompact ? 100 : 300;
        if (content.length > maxLen) {
          content = content.substring(0, maxLen) + '...';
        }
        Tapp.dom.setText(bubble, content);

        msgEl.appendChild(avatar);
        msgEl.appendChild(bubble);
        messagesArea.appendChild(msgEl);
      });

      // 滚动到底部
      setTimeout(function() {
        messagesArea.scrollTop = messagesArea.scrollHeight;
      }, 10);
    }

    container.appendChild(messagesArea);

    // ===== 输入区域 =====
    var inputArea = document.createElement('div');
    inputArea.style.cssText =
      'padding: ' + (isCompact ? '8px' : '10px 12px') + ';' +
      'border-top: 1px solid ' + colors.border + ';' +
      'flex-shrink: 0;';

    var inputWrapper = document.createElement('div');
    inputWrapper.style.cssText = 'display: flex; gap: 6px; align-items: center;';

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = isCompact ? '提问...' : '输入问题...';
    input.style.cssText =
      'flex: 1;' +
      'padding: ' + (isCompact ? '8px 10px' : '10px 14px') + ';' +
      'border: 1px solid ' + colors.border + ';' +
      'border-radius: ' + (isCompact ? '8px' : '10px') + ';' +
      'background: ' + colors.bg + ';' +
      'color: ' + colors.text + ';' +
      'font-size: ' + (isCompact ? '12px' : '13px') + ';' +
      'outline: none;' +
      'transition: border-color 0.2s;';
    input.onfocus = function() { input.style.borderColor = colors.accent; };
    input.onblur = function() { input.style.borderColor = colors.border; };

    var sendBtn = document.createElement('button');
    sendBtn.innerHTML = getSendIcon();
    sendBtn.style.cssText =
      'width: ' + (isCompact ? '32px' : '36px') + ';' +
      'height: ' + (isCompact ? '32px' : '36px') + ';' +
      'border: none;' +
      'border-radius: ' + (isCompact ? '8px' : '10px') + ';' +
      'background: ' + colors.accent + ';' +
      'color: #fff;' +
      'cursor: pointer;' +
      'display: flex;' +
      'align-items: center;' +
      'justify-content: center;' +
      'transition: all 0.2s;' +
      'flex-shrink: 0;';
    sendBtn.onmouseenter = function() {
      if (!isGenerating) sendBtn.style.background = colors.accentHover;
    };
    sendBtn.onmouseleave = function() {
      if (!isGenerating) sendBtn.style.background = colors.accent;
    };

    // 发送消息
    async function sendMessage(text) {
      if (!text || isGenerating) return;
      text = text.trim();
      if (!text) return;

      isGenerating = true;
      sendBtn.disabled = true;
      sendBtn.style.opacity = '0.6';
      sendBtn.innerHTML = getLoadingIcon();
      statusDot.style.background = '#f59e0b';
      input.value = '';

      // 添加用户消息
      messages.push({
        role: 'user',
        content: text,
        timestamp: Date.now()
      });
      renderMessages();

      try {
        // 使用新的 AI API
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
            content: '抱歉，我暂时无法回答这个问题。',
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
          content: '出错了: ' + (error && error.message ? error.message : '请求失败'),
          timestamp: Date.now()
        });
      }

      renderMessages();

      isGenerating = false;
      sendBtn.disabled = false;
      sendBtn.style.opacity = '1';
      sendBtn.innerHTML = getSendIcon();
      statusDot.style.background = '#22c55e';
    }

    sendBtn.onclick = function() { sendMessage(input.value); };
    input.onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input.value);
      }
    };

    // 清空对话
    clearBtn.onclick = async function() {
      if (messages.length === 0) return;
      messages = [];
      await Tapp.storage.set('widgetMessages', []);
      renderMessages();
    };

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(sendBtn);
    inputArea.appendChild(inputWrapper);
    container.appendChild(inputArea);

    // 初始渲染
    renderMessages();
  }
};


// ========== PAGE 代码（页面渲染 + 生命周期）==========
// Page 模式加载 core + page，执行完整生命周期

// 页面状态
var chatHistory = [];
var isGenerating = false;

// 定义页面渲染函数
Tapp.pages['ai-chat'] = {
  render: async function(container) {
    var isDark = document.documentElement.classList.contains('dark');

    // 获取全局主色调
    var primaryColor = await Tapp.ui.getPrimaryColor();
    var colors = getThemeColors(isDark, primaryColor);

    // 加载历史
    var saveHistory = await Tapp.settings.get('saveHistory');
    if (saveHistory !== false) {
      chatHistory = await Tapp.storage.get('chatHistory') || [];
    }

    // 获取设置
    var maxTokens = await Tapp.settings.get('maxTokens') || 500;

    // 容器样式
    container.style.cssText =
      'height: 100%;' +
      'display: flex;' +
      'flex-direction: column;' +
      'background: ' + colors.bg + ';' +
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
    container.innerHTML = '';

    // ===== 头部 =====
    var header = document.createElement('div');
    header.style.cssText =
      'padding: 16px 24px;' +
      'background: ' + colors.card + ';' +
      'border-bottom: 1px solid ' + colors.border + ';' +
      'display: flex;' +
      'align-items: center;' +
      'gap: 12px;';

    var icon = document.createElement('div');
    icon.textContent = '🤖';
    // 使用主色调创建渐变效果
    var gradientStart = colors.accent;
    var gradientEnd = adjustColorBrightness(colors.accent, -15);
    icon.style.cssText =
      'width: 40px;' +
      'height: 40px;' +
      'border-radius: 12px;' +
      'background: linear-gradient(135deg, ' + gradientStart + ', ' + gradientEnd + ');' +
      'display: flex;' +
      'align-items: center;' +
      'justify-content: center;' +
      'font-size: 20px;';

    var titleArea = document.createElement('div');
    titleArea.style.cssText = 'flex: 1;';

    var title = Tapp.dom.createElement('h1', {
      text: 'AI 聊天助手'
    });
    title.style.cssText =
      'font-size: 18px;' +
      'font-weight: 600;' +
      'margin: 0;' +
      'color: ' + colors.text + ';';

    var subtitle = Tapp.dom.createElement('p', {
      text: '由 AI 驱动的智能对话'
    });
    subtitle.style.cssText =
      'font-size: 13px;' +
      'margin: 2px 0 0;' +
      'color: ' + colors.textSecondary + ';';

    var clearBtn = Tapp.dom.createElement('button', {
      text: '清空对话'
    });
    clearBtn.style.cssText =
      'padding: 8px 16px;' +
      'border: 1px solid ' + colors.border + ';' +
      'border-radius: 8px;' +
      'background: transparent;' +
      'color: ' + colors.textSecondary + ';' +
      'font-size: 14px;' +
      'cursor: pointer;' +
      'transition: all 0.2s;';
    clearBtn.onmouseenter = function() {
      clearBtn.style.borderColor = colors.accent;
      clearBtn.style.color = colors.accent;
    };
    clearBtn.onmouseleave = function() {
      clearBtn.style.borderColor = colors.border;
      clearBtn.style.color = colors.textSecondary;
    };

    titleArea.appendChild(title);
    titleArea.appendChild(subtitle);
    header.appendChild(icon);
    header.appendChild(titleArea);
    header.appendChild(clearBtn);
    container.appendChild(header);

    // ===== 消息区域 =====
    var messagesArea = document.createElement('div');
    messagesArea.style.cssText =
      'flex: 1;' +
      'overflow-y: auto;' +
      'padding: 20px 24px;';

    // 渲染消息列表
    function renderMessages() {
      messagesArea.innerHTML = '';

      if (chatHistory.length === 0) {
        // 欢迎界面
        var welcome = document.createElement('div');
        welcome.style.cssText =
          'text-align: center;' +
          'padding: 60px 20px;' +
          'color: ' + colors.textSecondary + ';';

        var welcomeIcon = Tapp.dom.createElement('div', {
          text: '🤖'
        });
        welcomeIcon.style.cssText =
          'font-size: 64px;' +
          'margin-bottom: 20px;';

        var welcomeTitle = Tapp.dom.createElement('div', {
          text: '你好！我是 AI 助手'
        });
        welcomeTitle.style.cssText =
          'font-size: 20px;' +
          'font-weight: 600;' +
          'margin-bottom: 8px;' +
          'color: ' + colors.text + ';';

        var welcomeDesc = Tapp.dom.createElement('div', {
          text: '有什么可以帮助你的吗？'
        });
        welcomeDesc.style.cssText = 'font-size: 15px;';

        welcome.appendChild(welcomeIcon);
        welcome.appendChild(welcomeTitle);
        welcome.appendChild(welcomeDesc);

        // 示例问题
        var examples = document.createElement('div');
        examples.style.cssText =
          'margin-top: 32px;' +
          'display: flex;' +
          'flex-wrap: wrap;' +
          'justify-content: center;' +
          'gap: 12px;';

        ['解释一下人工智能', '帮我写一首诗', '如何学习编程', '推荐一部电影'].forEach(function(q) {
          var exBtn = Tapp.dom.createElement('button', {
            text: q
          });
          exBtn.style.cssText =
            'padding: 10px 18px;' +
            'border: 1px solid ' + colors.border + ';' +
            'border-radius: 20px;' +
            'background: ' + colors.card + ';' +
            'color: ' + colors.text + ';' +
            'font-size: 14px;' +
            'cursor: pointer;' +
            'transition: all 0.2s;';
          exBtn.onmouseenter = function() {
            exBtn.style.borderColor = colors.accent;
            exBtn.style.background = colors.accent + '10';
          };
          exBtn.onmouseleave = function() {
            exBtn.style.borderColor = colors.border;
            exBtn.style.background = colors.card;
          };
          exBtn.onclick = function() { sendMessage(q); };
          examples.appendChild(exBtn);
        });

        welcome.appendChild(examples);
        messagesArea.appendChild(welcome);
        return;
      }

      // 渲染消息
      chatHistory.forEach(function(msg) {
        var msgEl = document.createElement('div');
        msgEl.style.cssText =
          'display: flex;' +
          'gap: 12px;' +
          'margin-bottom: 20px;' +
          (msg.role === 'user' ? 'flex-direction: row-reverse;' : '');

        var avatar = document.createElement('div');
        avatar.textContent = msg.role === 'user' ? '👤' : '🤖';
        avatar.style.cssText =
          'width: 36px;' +
          'height: 36px;' +
          'border-radius: 10px;' +
          'display: flex;' +
          'align-items: center;' +
          'justify-content: center;' +
          'font-size: 18px;' +
          'flex-shrink: 0;' +
          'background: ' + (msg.role === 'user' ? colors.userBg : colors.aiBg) + ';';

        var bubble = document.createElement('div');
        bubble.style.cssText =
          'max-width: 70%;' +
          'padding: 14px 18px;' +
          'border-radius: 16px;' +
          'font-size: 15px;' +
          'line-height: 1.6;' +
          'word-break: break-word;' +
          (msg.role === 'user'
            ? 'background: ' + colors.userBg + '; color: #fff; border-bottom-right-radius: 4px;'
            : 'background: ' + colors.aiBg + '; color: ' + colors.text + '; border-bottom-left-radius: 4px;');

        var content = Tapp.dom.createElement('div', {
          text: msg.content
        });
        bubble.appendChild(content);

        var time = Tapp.dom.createElement('div', {
          text: formatTime(msg.timestamp)
        });
        time.style.cssText =
          'font-size: 11px;' +
          'margin-top: 6px;' +
          'opacity: 0.7;';
        bubble.appendChild(time);

        msgEl.appendChild(avatar);
        msgEl.appendChild(bubble);
        messagesArea.appendChild(msgEl);
      });

      messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    container.appendChild(messagesArea);

    // ===== 输入区域 =====
    var inputArea = document.createElement('div');
    inputArea.style.cssText =
      'padding: 16px 24px;' +
      'background: ' + colors.card + ';' +
      'border-top: 1px solid ' + colors.border + ';';

    var inputWrapper = document.createElement('div');
    inputWrapper.style.cssText =
      'display: flex;' +
      'gap: 12px;' +
      'max-width: 800px;' +
      'margin: 0 auto;';

    var input = document.createElement('textarea');
    input.placeholder = '输入你的问题...（按 Enter 发送，Shift+Enter 换行）';
    input.style.cssText =
      'flex: 1;' +
      'padding: 14px 18px;' +
      'border: 2px solid ' + colors.border + ';' +
      'border-radius: 14px;' +
      'background: ' + colors.bg + ';' +
      'color: ' + colors.text + ';' +
      'font-size: 15px;' +
      'line-height: 1.5;' +
      'resize: none;' +
      'outline: none;' +
      'font-family: inherit;' +
      'min-height: 52px;' +
      'max-height: 150px;';
    input.onfocus = function() { input.style.borderColor = colors.accent; };
    input.onblur = function() { input.style.borderColor = colors.border; };

    var sendBtn = Tapp.dom.createElement('button', {
      text: '发送'
    });
    sendBtn.style.cssText =
      'padding: 14px 28px;' +
      'border: none;' +
      'border-radius: 14px;' +
      'background: ' + colors.accent + ';' +
      'color: #fff;' +
      'font-size: 15px;' +
      'font-weight: 500;' +
      'cursor: pointer;' +
      'transition: background 0.2s;' +
      'align-self: flex-end;';
    sendBtn.onmouseenter = function() {
      if (!isGenerating) sendBtn.style.background = colors.accentHover;
    };
    sendBtn.onmouseleave = function() {
      if (!isGenerating) sendBtn.style.background = colors.accent;
    };

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(sendBtn);
    inputArea.appendChild(inputWrapper);
    container.appendChild(inputArea);

    // 发送消息
    async function sendMessage(text) {
      if (!text || isGenerating) return;
      text = text.trim();
      if (!text) return;

      isGenerating = true;
      sendBtn.disabled = true;
      Tapp.dom.setText(sendBtn, '生成中...');

      chatHistory.push({
        role: 'user',
        content: text,
        timestamp: Date.now(),
      });

      var saveHistory = await Tapp.settings.get('saveHistory');
      if (saveHistory !== false) {
        await Tapp.storage.set('chatHistory', chatHistory);
      }

      renderMessages();
      input.value = '';

      try {
        // 使用新的 AI API
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

      if (saveHistory !== false) {
        var maxHistory = await Tapp.settings.get('maxHistory') || 100;
        if (chatHistory.length > maxHistory) {
          chatHistory = chatHistory.slice(-maxHistory);
        }
        await Tapp.storage.set('chatHistory', chatHistory);
      }

      renderMessages();

      isGenerating = false;
      sendBtn.disabled = false;
      Tapp.dom.setText(sendBtn, '发送');
    }

    sendBtn.onclick = function() { sendMessage(input.value); };
    input.onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input.value);
      }
    };

    // 清空对话
    clearBtn.onclick = async function() {
      if (chatHistory.length === 0) return;
      chatHistory = [];
      await Tapp.storage.set('chatHistory', []);
      renderMessages();
      await Tapp.ui.showNotification({
        title: '对话已清空',
        message: '开始新的对话吧',
        type: 'info',
      });
    };

    // 初始渲染
    renderMessages();
  }
};

// ===== 生命周期（仅 Page 模式执行）=====
Tapp.lifecycle.onReady(async function() {
  console.log('[AI Chat] 页面模式已就绪');

  // 注册页面
  await Tapp.component.registerPage({
    id: 'ai-chat',
    path: '/tapp/ai-chat',
    title: 'AI 聊天助手',
    icon: '🤖',
    menu: true,
    order: 20,
    fullscreen: true,
  });

  console.log('[AI Chat] 页面已注册');

  // 初始化存储
  var saveHistory = await Tapp.settings.get('saveHistory');
  if (saveHistory !== false) {
    var history = await Tapp.storage.get('chatHistory');
    if (!history) {
      await Tapp.storage.set('chatHistory', []);
    }
  }

  // 渲染页面
  var container = document.getElementById('tapp-root');
  if (container) {
    container.innerHTML = '';
    await Tapp.pages['ai-chat'].render(container);
  }

  // 监听主题变化，重新渲染
  Tapp.ui.onThemeChange(async function() {
    if (container) {
      await Tapp.pages['ai-chat'].render(container);
    }
  });

  // 监听主色调变化，重新渲染
  Tapp.ui.onPrimaryColorChange(async function(newColor) {
    console.log('[AI Chat] 主色调变化:', newColor);
    if (container) {
      await Tapp.pages['ai-chat'].render(container);
    }
  });
});

Tapp.lifecycle.onDestroy(async function() {
  console.log('[AI Chat] 正在销毁...');
  try {
    await Tapp.component.unregister('page', 'ai-chat');
  } catch (e) {
    console.log('[AI Chat] 注销时出错:', e);
  }
});

console.log('[AI Chat] Tapp 已加载');
