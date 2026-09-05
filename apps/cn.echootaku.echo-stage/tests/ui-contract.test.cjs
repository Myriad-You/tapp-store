'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appRoot = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');

// Extracting a complete declaration avoids coupling a contract to the order of
// unrelated helpers in a production module.
function functionSource(source, name) {
  const match = new RegExp(`\\b(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `缺少 ${name}()`);
  const bodyStart = source.indexOf('{', match.index);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = bodyStart; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { index = source.indexOf('\n', index + 2); if (index < 0) break; continue; }
    if (char === '/' && next === '*') { index = source.indexOf('*/', index + 2); if (index < 0) break; index++; continue; }
    if (char === '\"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    if (char === '}' && --depth === 0) return source.slice(match.index, index + 1);
  }
  throw new Error(`${name}() 缺少完整函数体`);
}

function mediaBlock(source, query) {
  const start = source.indexOf(query);
  assert.ok(start >= 0, `缺少 ${query} 媒体查询`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}' && --depth === 0) return source.slice(bodyStart + 1, index);
  }
  throw new Error(`${query} 媒体查询未闭合`);
}

function fakeNode() {
  const classes = new Set();
  return {
    dataset: {},
    attributes: {},
    classList: {
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name]; },
    removeAttribute(name) { delete this.attributes[name]; }
  };
}

test('读取宿主主题的应用声明 ui:theme 权限', () => {
  assert.ok(manifest.permissions.includes('ui:theme'));
});

test('工作区消费宿主主题 token，播放器保留独立舞台 token', () => {
  assert.match(css, /:root\s*\{[\s\S]*?color-scheme:\s*light;/);
  assert.match(css, /--echo-accent:\s*var\(--tapp-primary,/);
  assert.match(css, /--echo-workspace-bg:\s*var\(--bg-primary,/);
  assert.match(css, /--echo-workspace-text:\s*var\(--text-primary,/);
  assert.match(css, /\.dark\s*\{[\s\S]*?color-scheme:\s*dark;/);
  assert.match(css, /--echo-stage-panel:/);
  assert.match(css, /--echo-stage-text:/);
  assert.match(css, /\.library-view[\s\S]*?(?:background|background-color):\s*var\(--echo-workspace-bg\)/);
  assert.match(css, /\.editor-view[\s\S]*?(?:color|background|background-color):\s*var\(--echo-workspace-(?:text|bg|surface)\)/);
  assert.match(css, /\.overlay-card[\s\S]*?background:\s*var\(--echo-workspace-/);
  assert.match(css, /#(?:library-status|editor-feedback)\[data-tone[\s\S]*?--echo-status-/);
});

test('主题初始化与宿主切换都会更新根节点深色状态', async () => {
  const nodes = { 'echo-background': fakeNode() };
  let onThemeChange;
  const root = fakeNode();
  const context = {
    Tapp: {
      ui: {
        getTheme: async () => 'dark',
        onThemeChange: (listener) => { onThemeChange = listener; return () => {}; }
      },
      animation: { shouldAnimate: async () => false }
    },
    document: { documentElement: root },
    state: { cleanups: [] },
    el: (id) => nodes[id]
  };
  vm.runInNewContext(functionSource(player, 'applyHostPreferences'), context, { filename: 'theme-preferences.js' });
  await context.applyHostPreferences();
  assert.equal(root.classList.contains('dark'), true, '初始深色主题必须应用到根节点');
  assert.equal(nodes['echo-background'].dataset.motion, 'off', '宿主关闭动画时波纹必须静止');
  assert.equal(typeof onThemeChange, 'function', '必须订阅后续主题切换');
  onThemeChange('light');
  assert.equal(root.classList.contains('dark'), false, '切回浅色时必须移除深色状态');
  onThemeChange(true);
  assert.equal(root.classList.contains('dark'), true, '宿主布尔深色值也必须生效');
});

test('启动器先呈现用户入口再呈现学习示例', () => {
  const actions = html.indexOf('id="library-primary-actions"');
  const learning = html.indexOf('id="library-learning"');
  assert.ok(actions >= 0, '缺少启动器主操作区');
  assert.ok(learning >= 0, '缺少学习与示例区');
  assert.ok(actions < learning, '示例区不应早于主操作区');
});

test('Echo Loading 不挂载位图并以轻量波纹、原生进度与双文案呈现', () => {
  const ripple = 'assets/ui/echo-ripples.png';
  assert.ok(manifest.assets.includes(ripple), '首页装饰仍需声明波纹素材');
  assert.ok(fs.existsSync(path.join(appRoot, ripple)), '首页声明的波纹素材必须存在');
  assert.doesNotMatch(html, /echo-loader-image|data-asset="assets\/ui\/echo-ripples\.png"[^>]*id="echo-loader-image"/);
  assert.match(html, /class="loading-echo"[^>]*aria-hidden="true"/);
  assert.equal((html.match(/class="loading-echo-ring"/g) || []).length, 3, 'Loading 应使用三层纯 CSS 回声环');
  assert.match(html, /id="loading-layer"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(html, /id="loading-title"/);
  assert.match(html, /id="loading-message"/);
  assert.match(html, /class="loading-progress"[^>]*aria-labelledby="loading-title"[^>]*aria-describedby="loading-message"/);
  assert.match(css, /@keyframes\s+echo-wave/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.loading-echo-ring\s*\{[^}]*animation:\s*none/);
  assert.match(css, /#echo-background\[data-motion="off"\]\s+~\s+\.echo-app\s+\.loading-echo-ring\s*\{[^}]*animation:\s*none/);
});

test('宿主扩大态在百分比高度链内重排启动器内容密度', () => {
  const scroll = css.match(/\.library-scroll\s*\{([^}]*)\}/);
  assert.ok(scroll, '缺少剧目库唯一滚动容器');
  assert.match(scroll[1], /height:\s*100%/);
  assert.match(scroll[1], /overflow:\s*auto/);
  assert.match(scroll[1], /display:\s*grid/);
  assert.match(scroll[1], /grid-template-rows:\s*auto\s+minmax\(min-content,\s*1fr\)\s+auto/);
  const launcher = css.match(/\.launcher-layout\s*\{([^}]*)\}/);
  assert.ok(launcher, '缺少启动器主体布局');
  assert.match(launcher[1], /width:\s*100%/);
  assert.match(launcher[1], /align-self:\s*center/);
  const expanded = mediaBlock(css, '@media (min-width: 1440px) and (min-height: 760px)');
  assert.match(expanded, /\.launcher-layout\s*\{[^}]*max-width:\s*96rem/);
  const low = mediaBlock(css, '@media (max-height: 640px)');
  assert.match(low, /\.launcher-layout\s*\{[^}]*align-self:\s*start/);
  assert.doesNotMatch(css, /100dvh/, '单屏 Tapp 不得用动态视口高度猜测宿主可见区域');
});

test('宿主关闭动画时停止所有场景淡入与示例封面缩放', () => {
  assert.match(css, /#echo-background\[data-motion="off"\]\s+\.scene-image,\s*#echo-background\[data-motion="off"\]\s+\.library-backdrop,\s*#echo-background\[data-motion="off"\]\s+\.scene-vignette\s*\{[^}]*transition:\s*none/);
  assert.match(css, /#echo-background\[data-motion="off"\]\s+~\s+\.echo-app\s+\.sample-card:hover\s+\.sample-cover\s+img\s*\{[^}]*transform:\s*none/);
});

test('Overlay 关闭按钮使用工作区 token，不继承舞台表面', () => {
  const match = css.match(/\.overlay-card\s+\.icon-button\s*\{([^}]*)\}/);
  assert.ok(match, 'Overlay 关闭按钮需要独立的主题表面规则');
  assert.match(match[1], /background:\s*var\(--echo-workspace-raised\)/);
  assert.match(match[1], /color:\s*var\(--echo-workspace-text\)/);
  assert.match(match[1], /border-color:\s*var\(--echo-workspace-border\)/);
  assert.doesNotMatch(match[1], /--echo-stage-/);
});

test('Overlay 同时提供模态语义、背景隔离、Escape 关闭与焦点恢复', () => {
  assert.match(html, /class="overlay-card"[^>]*role="dialog"[^>]*aria-modal="true"/);
  const open = functionSource(player, 'openOverlay');
  const close = functionSource(player, 'closeOverlay');
  assert.match(open, /state\.overlayReturnFocus\s*=\s*document\.activeElement/);
  assert.match(open, /background\.inert\s*=\s*true/);
  assert.match(open, /background\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(close, /el\('library-view'\)\.inert\s*=\s*false/);
  assert.match(close, /el\('editor-view'\)\.inert\s*=\s*false/);
  assert.match(close, /el\('player-view'\)\.inert\s*=\s*false/);
  assert.match(close, /state\.overlayReturnFocus\.focus\(\)/);
  assert.match(player, /event\.key === 'Escape' && !el\('overlay'\)\.hidden[\s\S]{0,100}?closeOverlay\(\)/);
});

test('窄屏编辑器在 760px 门槛下只显示当前 pane', () => {
  assert.match(html, /class="editor-tabs"[^>]*role="tablist"/);
  assert.equal((html.match(/role="tab"/g) || []).length, 3);
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 3);
  for (const pane of ['story', 'script', 'scene']) {
    assert.match(html, new RegExp(`id="editor-tab-${pane}"[^>]*aria-controls="editor-pane-${pane}"`));
    assert.match(html, new RegExp(`id="editor-pane-${pane}"[^>]*aria-labelledby="editor-tab-${pane}"`));
  }
  const narrow = mediaBlock(css, '@media (max-width: 760px)');
  assert.match(narrow, /\.editor-tabs\s*\{[^}]*display:\s*(?:flex|grid)/);
  assert.match(narrow, /\.editor-pane\[hidden\]\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(narrow, /\.editor-toolbar-actions\s*\{[^}]*position:\s*absolute/);
});

test('扩大态编辑器主操作区在宿主内容上方居中', () => {
  const toolbar = css.match(/\.editor-toolbar\s*\{([^}]*)\}/);
  const actions = css.match(/\.editor-toolbar-actions\s*\{([^}]*)\}/);
  assert.ok(toolbar, '缺少编辑器工具栏');
  assert.ok(actions, '缺少编辑器主操作区');
  assert.match(toolbar[1], /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/);
  assert.match(actions[1], /grid-column:\s*2/);
  assert.match(actions[1], /justify-self:\s*center/);
});

test('编辑器主体弹性填满宿主剩余高度且低高度模式不制造尾部空行', () => {
  const view = css.match(/\.editor-view\s*\{([^}]*)\}/);
  const shell = css.match(/\.editor-shell\s*\{([^}]*)\}/);
  assert.ok(view, '缺少编辑器根布局');
  assert.ok(shell, '缺少编辑器主体布局');
  assert.match(view[1], /display:\s*flex/);
  assert.match(view[1], /flex-direction:\s*column/);
  assert.doesNotMatch(view[1], /grid-template-rows/);
  assert.match(shell[1], /flex:\s*1(?:\s+1\s+0%)?/);
  assert.match(shell[1], /min-height:\s*0/);
  const low = mediaBlock(css, '@media (max-height: 640px)');
  assert.doesNotMatch(low, /\.editor-shell\s*\{[^}]*height:\s*auto/, '低高度模式不得解除剩余高度约束');
});

test('编辑器把宿主控件留在首行两侧并将本地上下文放到第二行', () => {
  const toolbar = css.match(/\.editor-toolbar\s*\{([^}]*)\}/);
  const back = css.match(/\.editor-toolbar\s+#editor-back\s*\{([^}]*)\}/);
  const heading = css.match(/\.editor-heading\s*\{([^}]*)\}/);
  const actions = css.match(/\.editor-toolbar-actions\s*\{([^}]*)\}/);
  assert.ok(toolbar && back && heading && actions, '编辑器工具栏区域不完整');
  assert.match(toolbar[1], /grid-template-rows:\s*minmax\([^)]*\)\s+minmax\([^)]*\)/);
  assert.match(actions[1], /grid-row:\s*1/);
  assert.match(actions[1], /grid-column:\s*2/);
  assert.match(back[1], /grid-row:\s*2/);
  assert.match(heading[1], /grid-row:\s*2/);
});

test('编辑器反馈横向占满空间、进度初始隐藏并支持三语关闭', () => {
  assert.match(html, /id="editor-feedback-progress"[^>]*hidden/);
  assert.match(html, /id="editor-feedback-close"[^>]*data-i18n-aria="editor\.dismissFeedback"/);
  const feedbackRule = css.match(/\.editor-feedback\s*\{([^}]*)\}/);
  const copyRule = css.match(/\.editor-feedback-copy\s*\{([^}]*)\}/);
  assert.ok(feedbackRule && copyRule, '反馈条与内容布局规则必须存在');
  assert.match(feedbackRule[1], /display:\s*flex/);
  assert.doesNotMatch(feedbackRule[1], /grid-template-columns/, '反馈条不得为隐藏进度保留窄列');
  assert.match(copyRule[1], /flex:\s*1/);
  assert.match(copyRule[1], /min-width:\s*0/);
  const expected = {
    'zh-CN': { noticeInfo: '提示', noticeSuccess: '已完成', noticeWarning: '需要确认', noticeError: '出现问题', dismissFeedback: '关闭提示' },
    'en-US': { noticeInfo: 'Notice', noticeSuccess: 'Completed', noticeWarning: 'Check this', noticeError: 'Something went wrong', dismissFeedback: 'Dismiss notice' },
    'ja-JP': { noticeInfo: 'お知らせ', noticeSuccess: '完了しました', noticeWarning: '確認してください', noticeError: '問題が発生しました', dismissFeedback: '通知を閉じる' }
  };
  for (const [locale, values] of Object.entries(expected)) {
    const messages = JSON.parse(fs.readFileSync(path.join(appRoot, 'i18n', `${locale}.json`), 'utf8'));
    for (const [name, value] of Object.entries(values)) assert.equal(messages[`editor.${name}`], value, `${locale} 缺少 editor.${name}`);
  }
});

test('素材 ID pattern 可被浏览器 Unicode Sets v 模式编译', () => {
  const match = html.match(/id="scene-id"[^>]*pattern="([^"]+)"/);
  assert.ok(match, '缺少素材 ID pattern');
  const rule = new RegExp(`^(?:${match[1]})$`, 'v');
  assert.equal(rule.test('scene_1-night.v2'), true);
  assert.equal(rule.test('scene/1'), false);
  assert.equal(rule.test('scene 1'), false);
});
