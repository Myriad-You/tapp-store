'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appRoot = path.resolve(__dirname, '..');

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

test('内置游戏声明的入口与素材都存在', () => {
  for (const directory of ['demo', 'starlight']) {
    const demoRoot = path.join(appRoot, 'assets', directory);
    const game = JSON.parse(fs.readFileSync(path.join(demoRoot, 'game.json'), 'utf8'));
    assert.equal(game.format, 'echo-stage/v1');
    for (const entry of Object.values(game.entries)) assert.ok(fs.existsSync(path.join(demoRoot, entry)), `${directory}: ${entry}`);
    for (const asset of Object.values(game.assets)) assert.ok(fs.existsSync(path.join(demoRoot, asset)), `${directory}: ${asset}`);
  }
});

test('Manifest 使用当前 Layer 格式并声明完整 Page 闭包', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  const retiredFields = ['main', 'hasPage', 'cssMode', 'styles', 'widgetStyles', 'pageStyles', 'pageTemplate', 'pageModules'];
  for (const field of retiredFields) assert.equal(manifest[field], undefined, `不得继续声明退役字段 ${field}`);
  assert.deepEqual(manifest.core, { entry: 'main.js' });
  assert.deepEqual(manifest.page, {
    entry: 'page/index.js',
    template: 'page.html',
    styles: 'page.css'
  });
  assert.ok(fs.existsSync(path.join(appRoot, manifest.core.entry)), manifest.core.entry);
  for (const resource of Object.values(manifest.page)) {
    assert.ok(fs.existsSync(path.join(appRoot, resource)), resource);
  }
  for (const asset of manifest.assets) {
    assert.ok(!asset.includes('..'));
    assert.ok(fs.existsSync(path.join(appRoot, asset)), asset);
  }
  const loaded = [];
  const entry = fs.readFileSync(path.join(appRoot, manifest.page.entry), 'utf8');
  vm.runInNewContext(entry, { require: (specifier) => loaded.push(specifier) }, { filename: manifest.page.entry });
  assert.deepEqual(Array.from(loaded), ['./demo-archive.js', './engine.js', './editor.js', './player.js']);
});

test('波纹资产只在启动器出现后异步装载，不进入 Loading 关键路径', async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  const ripple = 'assets/ui/echo-ripples.png';
  assert.ok(manifest.assets.includes(ripple), '波纹素材必须进入包声明');
  assert.ok(fs.existsSync(path.join(appRoot, ripple)), '波纹素材必须存在于应用目录');
  assert.doesNotMatch(html, /echo-loader-image/);
  assert.match(html, /class="library-ripple-image"[^>]*data-asset="assets\/ui\/echo-ripples\.png"/);
  const loader = functionSource(player, 'loadLibraryAssets');
  const decoration = functionSource(player, 'loadLibraryDecoration');
  assert.doesNotMatch(loader, /echo-ripples\.png|library-ripple-image/, 'Loading 关键路径不得等待装饰波纹');
  assert.match(loader, /\.src\s*=\s*await\s+builtinUrl\(asset\.path\)/);
  assert.match(decoration, /el\('library-ripple-image'\)/);
  assert.match(decoration, /builtinUrl\('assets\/ui\/echo-ripples\.png'\)/);
  assert.doesNotMatch(decoration, /\.decode\(/, '装饰波纹不应阻塞启动器等待图片解码');
  const bindings = Array.from(loader.matchAll(/\{\s*id:\s*'([^']+)',\s*path:\s*'([^']+)'\s*\}/g));
  const nodes = Object.fromEntries(bindings.map((binding) => [binding[1], { src: '', async decode() {} }]));
  nodes['library-ripple-image'] = { src: '' };
  const calls = [];
  const context = {
    state: { builtinUrls: new Map() },
    Tapp: { assets: { getUrl: async (asset) => { calls.push(asset); return `tapp://${asset}`; } } },
    BUILTIN_DEMOS: { shore: { root: 'assets/demo', cover: 'cover.png' }, starlight: { root: 'assets/starlight', cover: 'cover.png' } },
    el: (id) => nodes[id],
    setStatus() {}
  };
  vm.runInNewContext(`${functionSource(player, 'builtinUrl')}\n${loader}\n${decoration}`, context, { filename: 'ripple-asset-loader.js' });
  await context.loadLibraryAssets();
  assert.equal(calls.filter((asset) => asset === ripple).length, 0, 'Loading 结束前不应解析装饰波纹');
  await context.loadLibraryDecoration();
  assert.equal(calls.filter((asset) => asset === ripple).length, 1, '同一资源只应由宿主解析一次');
  assert.equal(nodes['library-ripple-image'].src, `tapp://${ripple}`);
});

test('本地游戏包格式不允许可执行脚本素材', () => {
  const game = JSON.parse(fs.readFileSync(path.join(appRoot, 'assets', 'demo', 'game.json'), 'utf8'));
  for (const asset of Object.values(game.assets)) assert.doesNotMatch(asset, /\.(?:js|mjs|cjs|html?)$/i);
});

test('三种界面语言覆盖模板与播放器使用的全部键及入口可访问名称', () => {
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  const editor = fs.readFileSync(path.join(appRoot, 'page', 'editor.js'), 'utf8');
  const keys = new Set([
    ...Array.from(html.matchAll(/data-i18n(?:-aria|-placeholder)?=(['"])([^'"]+)\1/g), (match) => match[2]),
    ...Array.from(player.matchAll(/\btr\(\s*(['"])([^'"]+)\1/g), (match) => match[2]),
    ...Array.from(editor.matchAll(/\btr\(\s*(['"])([^'"]+)\1/g), (match) => match[2])
  ]);
  for (const id of ['open-folder', 'open-editor', 'download-demo']) {
    const openingTag = html.match(new RegExp(`<button[^>]*\\bid="${id}"[^>]*>`));
    assert.ok(openingTag, `缺少主入口 ${id}`);
    const key = openingTag[0].match(/data-i18n(?:-aria)?=(['"])([^'"]+)\1/);
    assert.ok(key, `${id} 必须由 i18n 提供可访问名称`);
    keys.add(key[2]);
  }
  assert.equal((html.match(/data-play-builtin=/g) || []).length, 2, '两个示例都应有试玩入口');
  assert.equal((html.match(/data-continue-builtin=/g) || []).length, 2, '两个示例都应有继续入口');
  assert.doesNotMatch(functionSource(player, 'mount'), /\bloadDemo\s*\(/, 'mount 不得自动加载示例');
  for (const locale of ['zh-CN', 'en-US', 'ja-JP']) {
    const messages = JSON.parse(fs.readFileSync(path.join(appRoot, 'i18n', `${locale}.json`), 'utf8'));
    for (const key of keys) assert.ok(typeof messages[key] === 'string' && messages[key].trim(), `${locale}: ${key}`);
  }
});

test('组件 display 规则不会覆盖 HTML hidden 状态', () => {
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test('Page 中的运行时素材通过 Tapp.assets 解析', () => {
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  assert.doesNotMatch(html, /\bsrc\s*=\s*(?:"|')assets\//);
  assert.doesNotMatch(css, /url\(\s*(?:"|')?assets\//);
  assert.match(player, /path:\s*'assets\/launcher\/echo-stage-library\.png'/);
  assert.match(player, /image\.src = await builtinUrl\(asset\.path\)/);
});

test('真实宿主易覆盖的核心文本拥有组件级前景色', () => {
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  for (const selector of ['.library-brand h1', '#launcher-title', '.sample-content h3', '.toolbar-button, .icon-button', '#dialogue-text']) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?color:'));
  }
});

test('启动和游戏切换都有可访问的 Loading 状态', () => {
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  assert.match(html, /id="loading-layer"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /<progress[^>]*class="loading-progress"[^>]*><\/progress>/);
  assert.match(html, /id="library-view"[^>]*hidden/);
  assert.match(player, /showLoading\(tr\('loading\.game'/);
  assert.match(player, /showLoading\(tr\('loading\.folder'/);
  assert.match(player, /image\.decode\(\)/);
});

test('扩大与恢复只使用 Myriad 宿主控件', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  assert.ok(!manifest.permissions.includes('ui:fullscreen'));
  assert.doesNotMatch(html, /toggle-fullscreen|player\.fullscreen/);
  assert.doesNotMatch(player, /Tapp\.ui\.fullscreen/);
});

test('交互层消费当前四向安全区并覆盖低高度窗口', () => {
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  for (const direction of ['top', 'right', 'bottom', 'left']) assert.match(css, new RegExp(`--tapp-safe-inset-${direction}`));
  assert.match(css, /@media\s*\(max-height:\s*640px\)/);
  assert.match(css, /\.scene-image\s*\{[\s\S]*?inset:\s*0;/);
});

test('游戏场景是独立于内容安全区的固定背景层', () => {
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  assert.match(html, /^<div id="echo-background"[^>]*>[\s\S]*?id="scene-image"[\s\S]*?<\/div>\s*<main id="echo-app"/);
  assert.doesNotMatch(html, /id="player-view"[\s\S]*?id="scene-image"/);
  assert.match(css, /#echo-background\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;/);
  assert.match(css, /\.echo-app\s*\{[^}]*z-index:\s*1;/);
});

test('Loading 隐藏后内容根仍占满宿主分配的 Page 边界', () => {
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  const rootRule = css.match(/\.echo-app\s*\{([^}]*)\}/);
  assert.ok(rootRule, '应声明 Page 内容根规则');
  assert.match(rootRule[1], /position:\s*absolute;/);
  assert.match(rootRule[1], /inset:\s*0;/);
  assert.match(rootRule[1], /margin:\s*0;/);
  assert.match(rootRule[1], /padding:\s*0;/);
  assert.match(rootRule[1], /max-width:\s*none;/);
  assert.match(rootRule[1], /border-radius:\s*0;/);
});

test('游戏态使用宿主实际高度且操作组位于顶部中央', () => {
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  assert.match(css, /html\.echo-playing \.echo-app,[\s\S]*?html\.echo-playing \.player-view\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/);
  assert.match(css, /\.toolbar-actions\s*\{[^}]*position:\s*absolute;[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\);/);
  assert.match(player, /document\.documentElement\.classList\.add\('echo-playing'\)/);
  assert.match(player, /document\.documentElement\.classList\.remove\('echo-playing'\)/);
});

test('剧目库使用独立舞台素材且不会产生文档滚动', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  assert.ok(manifest.assets.includes('assets/demo/echo-theatre-stage.png'));
  assert.ok(manifest.assets.includes('assets/starlight/echo-theatre-starlight.png'));
  assert.ok(manifest.assets.includes('assets/launcher/echo-stage-library.png'));
  assert.match(html, /id="library-backdrop"/);
  assert.match(html, /data-play-builtin="shore"[\s\S]*data-play-builtin="starlight"/);
  assert.match(css, /html, body\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/);
  assert.match(css, /\.echo-app\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/);
  assert.match(css, /\.library-view\s*\{[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/);
  assert.doesNotMatch(css, /100dvh/);
});

test('启动器默认不把任一示例项目提升为主内容', () => {
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  assert.match(html, /id="launcher-title"[^>]*data-i18n="launcher\.title"/);
  assert.match(html, /id="sample-library-title"[^>]*data-i18n="samples\.title"/);
  assert.doesNotMatch(html, /class="featured-story"|id="play-demo"|id="continue-demo"|id="repertoire-switcher"/);
  assert.doesNotMatch(player, /selectedBuiltin|selectBuiltin/);
  assert.match(player, /loadDemo\(button\.getAttribute\('data-play-builtin'\), false\)/);
  assert.match(player, /loadDemo\(button\.getAttribute\('data-continue-builtin'\), true\)/);
});

test('AI 编辑器只使用当前 Task 契约并声明匹配权限', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const editor = fs.readFileSync(path.join(appRoot, 'page', 'editor.js'), 'utf8');
  assert.deepEqual(manifest.ai.operations, ['generate', 'image']);
  assert.deepEqual(manifest.ai.outputFormats, ['text', 'image']);
  assert.ok(manifest.permissions.includes('ai:generate'));
  assert.ok(manifest.permissions.includes('ai:image'));
  assert.ok(manifest.permissions.includes('ui:notification'));
  assert.equal(manifest.page.entry, 'page/index.js');
  assert.match(html, /id="open-editor"[\s\S]*id="editor-view"[^>]*hidden/);
  assert.match(editor, /async function requestStoryDraft[\s\S]*operation:\s*'generate'[\s\S]*input:\s*\{\s*prompt:\s*instruction\s*\}[\s\S]*output:\s*\{\s*format:\s*'text'\s*\}[\s\S]*delivery:\s*delivery/);
  assert.match(editor, /request\('stream'\)[\s\S]*request\('result'\)/, '故事任务应先流式交付，并只在安全条件下切到完整结果');
  assert.match(editor, /operation:\s*'image'[\s\S]*width:\s*1344,\s*height:\s*768[\s\S]*output:\s*\{\s*format:\s*'image'\s*\}[\s\S]*delivery:\s*'result'/);
  assert.doesNotMatch(editor, /\bfetch\s*\(|Tapp\.http|provider\s*:|model\s*:/);
});

test('AI 失败同时写入页面状态并调用 Myriad 宿主错误通知', () => {
  const editor = fs.readFileSync(path.join(appRoot, 'page', 'editor.js'), 'utf8');
  assert.match(editor, /Tapp\.ui\.showNotification\(\{\s*title:\s*title,\s*message:\s*text\(message,\s*500\),\s*type:\s*'error',\s*duration:\s*7000\s*\}\)/);
  assert.match(editor, /async function reportAiError[\s\S]*?notify\(message, 'error', title\);[\s\S]*?await hostNotification\(title, message\);/);
  assert.match(editor, /catch \(error\) \{[\s\S]*?await reportAiError\(tr\('editor\.aiErrorTitle'/);
  assert.match(editor, /catch \(error\) \{ await reportAiError\(tr\('editor\.imageErrorTitle'/);
  assert.match(editor, /var code = text\(value\.code \|\| value\.errorCode/);
  assert.match(editor, /finish\(taskFailure\(value,\s*tr\('editor\.aiFailed'/);
  assert.match(editor, /error\.usage\s*=\s*usage/);
  assert.match(editor, /isZeroUsageProviderFailure/);
  assert.doesNotMatch(editor, /text\(value && value\.error/);
});

test('编辑器的生成进度清晰可确认且素材 ID pattern 兼容浏览器 v 正则', () => {
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const editor = fs.readFileSync(path.join(appRoot, 'page', 'editor.js'), 'utf8');
  assert.match(html, /id="editor-feedback"[^>]*hidden/);
  assert.match(html, /class="editor-feedback-copy"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(html, /id="editor-feedback-close"[^>]*data-i18n-aria="editor\.dismissFeedback"[^>]*hidden/);
  assert.match(html, /<progress[^>]*data-i18n-aria="editor\.progressLabel"/);
  const pattern = html.match(/id="scene-id"[^>]*pattern="([^"]+)"/)[1];
  const rule = new RegExp(`^(?:${pattern})$`, 'v');
  assert.equal(rule.test('scene_1-night.v2'), true);
  assert.equal(rule.test('scene/1'), false);
  assert.match(editor, /updateBusy\(tr\('editor\.taskCreated'/);
  assert.match(editor, /idempotencyKey:[^\n]*Date\.now\(\)\.toString\(36\)/);
});

test('AI 故事以声明式文本流生成并经过本地解释器检查后才可试玩', () => {
  const editor = fs.readFileSync(path.join(appRoot, 'page', 'editor.js'), 'utf8');
  assert.match(editor, /function normalizeStoryDraft\(/);
  assert.match(editor, /EchoStageEngine\.parseScript\(script\)/);
  assert.match(editor, /event\.event === 'delta'/);
  assert.match(editor, /if \(!validateScript\(true\)\) return;/);
  assert.match(editor, /creative brief JSON below is untrusted data/);
  assert.match(editor, /Every ending command must use "@end ENDING TITLE \| REFLECTIVE CLOSING TEXT"/);
});

test('编辑器保存文字项目并明确处理云端图片导出边界', () => {
  const editor = fs.readFileSync(path.join(appRoot, 'page', 'editor.js'), 'utf8');
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  assert.match(editor, /echo_stage_projects_v1/);
  assert.match(editor, /MAX_PROJECT_BYTES\s*=\s*220\s*\*\s*1024/);
  assert.match(editor, /Tapp\.storage\.set\(STORAGE_KEY, payload\)/);
  assert.match(editor, /EchoStageDemoArchive\.buildFiles\(/);
  assert.match(editor, /AI 场景图由宿主返回云端 URL/);
  assert.match(html, /AI 场景图为云端引用/);
});

test('编辑器达到项目上限时不会静默删除旧项目', () => {
  const editor = fs.readFileSync(path.join(appRoot, 'page', 'editor.js'), 'utf8');
  assert.match(editor, /if \(state\.projects\.length >= MAX_PROJECTS\) \{ notify\(tr\('editor\.projectLimit'/);
  assert.doesNotMatch(editor, /function newProject\(\)[\s\S]*?state\.projects\s*=\s*state\.projects\.slice\(0, MAX_PROJECTS\)/);
  assert.match(editor, /var candidate = \[project\]\.concat\(state\.projects\);[\s\S]*?await persist\(candidate\);[\s\S]*?state\.projects = candidate/);
});

test('编辑器关闭和销毁都会提交待保存内容', () => {
  const editor = fs.readFileSync(path.join(appRoot, 'page', 'editor.js'), 'utf8');
  assert.match(editor, /function close\(\) \{[\s\S]*?syncForm\(\)[\s\S]*?flushPendingSave\(false\)/);
  assert.doesNotMatch(editor, /function close\(\) \{[\s\S]*?notify\(tr\('editor\.saved'/);
  assert.match(editor, /function destroy\(\) \{[\s\S]*?if \(state\.dirty\)[\s\S]*?persist\(\)\.catch/);
});

test('编辑器继续使用宿主实际高度链和四向安全区', () => {
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  assert.match(css, /\.editor-view\s*\{[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /\.editor-view\s*\{[\s\S]*?--tapp-safe-inset-top[\s\S]*?--tapp-safe-inset-right[\s\S]*?--tapp-safe-inset-bottom[\s\S]*?--tapp-safe-inset-left/);
  assert.doesNotMatch(css, /100dvh/);
});

test('普通窗口右侧场景栏不会被 16:9 预览反向撑宽', () => {
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  assert.match(css, /\.story-form, \.script-workbench, \.scene-studio\s*\{[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/);
  assert.match(css, /\.scene-preview\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*min-height:\s*0;[^}]*aspect-ratio:\s*16\s*\/\s*9;/);
  assert.match(css, /@media\s*\(max-width:\s*1180px\)[\s\S]*?\.editor-canvas\s*\{[^}]*grid-template-columns:\s*minmax\(12rem,[^}]*minmax\(17rem,[^}]*minmax\(12rem,/);
});

test('窄屏编辑器仍可切换项目且播放器按钮保留完整标签', () => {
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  const editor = fs.readFileSync(path.join(appRoot, 'page', 'editor.js'), 'utf8');
  assert.match(html, /id="project-picker"/);
  assert.match(editor, /el\('project-picker'\)\.addEventListener\('change'/);
  assert.doesNotMatch(css, /\.toolbar-button::first-letter/);
  assert.doesNotMatch(css, /\.toolbar-button\s*\{[^}]*font-size:\s*0(?:\s*;|\s*!important)/);
});

test('弹层焦点圈定覆盖表单控件并按宿主高度约束', () => {
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  assert.match(player, /select:not\(\[disabled\]\), textarea:not\(\[disabled\]\)/);
  assert.match(css, /\.overlay-card\s*\{[\s\S]*?max-height:\s*min\(42rem, 100%\)/);
  assert.doesNotMatch(css, /86dvh/);
});

test('自动配音只通过 Myriad speech 能力并声明匹配权限', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  assert.ok(manifest.permissions.includes('speech:tts'));
  assert.match(html, /id="toggle-voice"[^>]*aria-pressed="false"/);
  assert.match(html, /id="open-cast"/);
  assert.match(html, /<audio id="voice-player"><\/audio>/);
  assert.match(player, /Tapp\.speech\.getStatus\(\)/);
  assert.match(player, /Tapp\.speech\.getVoices\(\)/);
  assert.match(player, /Tapp\.speech\.tts\(request\)/);
  assert.doesNotMatch(player, /SecretId|SecretKey|tencentcloudapi|\bfetch\s*\(/i);
});

test('角色音色映射按剧目持久化且旁白独立选角', () => {
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  assert.match(player, /VOICE_STORAGE_KEY\s*=\s*'echo_stage_voice_cast_v1'/);
  assert.match(player, /games\[state\.game\.id\]/);
  assert.match(player, /event\.type === 'narrate' \? '__narrator__'/);
  assert.match(player, /request\.voiceType = voice\.value/);
  assert.match(player, /Tapp\.storage\.set\(VOICE_STORAGE_KEY, state\.voiceSettings\)/);
});

test('TTS voice_type 只发送 i32 兼容数值，不把 premium 等分类字符串当作音色', () => {
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  assert.match(player, /Number\.isSafeInteger\(input\)/);
  assert.match(player, /var candidates = \['voice_type', 'voiceType', 'voice_id', 'voiceId'/);
  assert.match(player, /if \(nativeValue == null\) return null;/);
  assert.match(player, /if \(voice\) request\.voiceType = voice\.value;/);
  assert.doesNotMatch(player, /hasOwnProperty\.call\(value, 'voiceType'\) \? 'voiceType'/);
  assert.doesNotMatch(player, /request\[voice\.requestKey\]/);

  const start = player.indexOf('function unwrapVoices(');
  const end = player.indexOf('function normalizeVoices(', start);
  const context = {};
  vm.runInNewContext(player.slice(start, end), context, { filename: 'normalize-voice.js' });
  assert.equal(context.normalizeVoice({ voiceType: 'premium', voice_type: 101, name: '晓宁' }, 0).value, 101);
  assert.equal(context.normalizeVoice({ voiceType: 'premium', id: '102', name: '云希' }, 0).value, 102);
  assert.equal(context.normalizeVoice({ voiceType: 'premium', id: 'premium', name: '错误分类' }, 0), null);
  assert.equal(context.normalizeVoice('103', 0).value, 103);
  assert.equal(context.normalizeVoice({ id: 2147483647, name: 'i32 上界' }, 0).value, 2147483647);
  assert.equal(context.normalizeVoice({ id: 2147483648, name: '越过 i32 上界' }, 0), null);
  assert.equal(context.normalizeVoice({ id: -2147483649, name: '越过 i32 下界' }, 0), null);
});

test('Myriad 音色规范化保留模型、性别、说明与情感能力', () => {
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  const start = player.indexOf('function normalizeVoice(');
  const end = player.indexOf('function speechExplicitlyUnavailable(', start);
  const context = {};
  vm.runInNewContext(player.slice(start, end), context, { filename: 'voice-catalog.js' });

  const voice = context.normalizeVoice({
    id: 601003,
    name: '爱小荷',
    gender: '女',
    language: '中文',
    description: '阅读女声，支持故事/广播/诗歌等',
    voice_type: 'llm',
    emotion_support: true,
  });

  assert.deepEqual(JSON.parse(JSON.stringify(voice)), {
    id: '601003',
    value: 601003,
    label: '爱小荷',
    locale: '中文',
    tier: 'llm',
    gender: '女',
    description: '阅读女声，支持故事/广播/诗歌等',
    emotionSupport: true,
  });
});

test('音色目录按基础精品、大模型、超自然大模型顺序分组且不丢未知类别', () => {
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  const start = player.indexOf('function normalizeVoice(');
  const end = player.indexOf('function speechExplicitlyUnavailable(', start);
  const context = {};
  vm.runInNewContext(player.slice(start, end), context, { filename: 'voice-catalog.js' });

  assert.equal(typeof context.groupVoices, 'function');
  const groups = context.groupVoices([
    { id: '1', tier: 'ultra_natural' },
    { id: '2', tier: 'premium' },
    { id: '3', tier: 'llm' },
    { id: '4', tier: 'future_tier' },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(groups.map((group) => ({ tier: group.tier, ids: group.voices.map((voice) => voice.id) })))), [
    { tier: 'premium', ids: ['2'] },
    { tier: 'llm', ids: ['3'] },
    { tier: 'ultra_natural', ids: ['1'] },
    { tier: 'other', ids: ['4'] },
  ]);
});

test('真实 Myriad 37 音色响应完整归类且保留每个数值 ID', () => {
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  const fixture = JSON.parse(fs.readFileSync(path.join(appRoot, 'tests', 'fixtures', 'myriad-voices.json'), 'utf8'));
  const start = player.indexOf('function unwrapVoices(');
  const end = player.indexOf('function speechExplicitlyUnavailable(', start);
  const context = {};
  vm.runInNewContext(player.slice(start, end), context, { filename: 'voice-catalog.js' });

  const voices = context.normalizeVoices(fixture);
  const groups = context.groupVoices(voices);
  assert.equal(voices.length, 37);
  assert.equal(new Set(voices.map((voice) => voice.id)).size, 37);
  assert.ok(voices.every((voice) => Number.isSafeInteger(voice.value)));
  assert.deepEqual(Array.from(groups, (group) => [group.tier, group.voices.length]), [
    ['premium', 8],
    ['llm', 18],
    ['ultra_natural', 11],
  ]);
  assert.equal(voices.filter((voice) => voice.emotionSupport).length, 8);
});

test('选角目录为模型类别和音色能力生成可读文案', () => {
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  const start = player.indexOf('function normalizeVoice(');
  const end = player.indexOf('function speechExplicitlyUnavailable(', start);
  const context = { tr: (_key, fallback) => fallback };
  vm.runInNewContext(player.slice(start, end), context, { filename: 'voice-catalog.js' });
  const voice = {
    label: '爱小荷', gender: '女', locale: '中文', description: '阅读女声', emotionSupport: true,
  };

  assert.equal(context.voiceTierLabel('premium'), '基础 / 精品音色');
  assert.equal(context.voiceTierLabel('llm'), '大模型音色');
  assert.equal(context.voiceTierLabel('ultra_natural'), '超自然大模型音色');
  assert.equal(context.voiceTierLabel('future_tier'), '其他音色');
  assert.equal(context.voiceOptionText(voice), '爱小荷 · 女 · 中文');
  assert.equal(context.voiceDetailText(voice), '阅读女声 · 支持情感演绎');
});

function renderVoiceCastFixture(player) {
  class FakeNode {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.attributes = {};
      this.listeners = {};
      this.className = '';
      this.textContent = '';
      this.value = '';
      this.label = '';
      this.hidden = false;
    }
    appendChild(child) { this.children.push(child); return child; }
    append(...children) { this.children.push(...children); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener(name, listener) { this.listeners[name] = listener; }
  }
  const context = {
    tr: (_key, fallback) => fallback,
    document: { createElement: (tagName) => new FakeNode(tagName) },
  };
  const helpersStart = player.indexOf('function normalizeVoice(');
  const helpersEnd = player.indexOf('function speechExplicitlyUnavailable(', helpersStart);
  const castStart = player.indexOf('function showVoiceCast()');
  const castEnd = player.indexOf('function clearAutoplay()', castStart);
  vm.runInNewContext(player.slice(helpersStart, helpersEnd) + '\n' + player.slice(castStart, castEnd), context, { filename: 'voice-cast.js' });
  context.state = {
    voiceReady: true,
    voices: [
      context.normalizeVoice({ id: 101004, name: '智云', gender: '男', language: '中文', description: '通用男声', voice_type: 'premium', emotion_support: false }),
      context.normalizeVoice({ id: 601003, name: '爱小荷', gender: '女', language: '中文', description: '阅读女声', voice_type: 'llm', emotion_support: true }),
      context.normalizeVoice({ id: 502006, name: '智小悟', gender: '男', language: '中英文', description: '聊天男声', voice_type: 'ultra_natural', emotion_support: false }),
      context.normalizeVoice({ id: 700001, name: '未来音色', gender: '女', language: '中文', description: '未知类别仍应展示', voice_type: 'future_tier', emotion_support: false }),
    ],
  };
  const cast = { __narrator__: '601003' };
  context.voiceStatusText = () => 'ready';
  context.speakersForGame = () => ['__narrator__'];
  context.currentGameCast = () => cast;
  context.persistVoiceSettings = () => Promise.resolve();
  context.errorText = (error) => String(error);
  context.setStatus = () => {};
  context.openOverlay = (_title, render) => { context.root = new FakeNode('section'); render(context.root); };
  context.showVoiceCast();
  const nodes = [];
  (function visit(node) { nodes.push(node); node.children.forEach(visit); })(context.root);
  return { nodes, cast };
}

test('选角弹层按模型类别创建有序音色分组', () => {
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  const { nodes } = renderVoiceCastFixture(player);
  const groups = nodes.filter((node) => node.tagName === 'optgroup');
  assert.deepEqual(groups.map((group) => group.label), ['基础 / 精品音色', '大模型音色', '超自然大模型音色', '其他音色']);
  assert.deepEqual(groups.map((group) => group.children.map((option) => option.textContent)), [
    ['智云 · 男 · 中文'],
    ['爱小荷 · 女 · 中文'],
    ['智小悟 · 男 · 中英文'],
    ['未来音色 · 女 · 中文'],
  ]);
});

test('选角弹层解释宿主计费边界并显示选中音色能力', () => {
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  const { nodes } = renderVoiceCastFixture(player);
  const billing = nodes.find((node) => node.className === 'cast-billing-note');
  const select = nodes.find((node) => node.tagName === 'select');
  const detail = nodes.find((node) => node.className === 'cast-voice-detail');
  assert.equal(billing && billing.textContent, '回声剧场只选择音色；资源包与后付费扣减由 Myriad 宿主账户决定。');
  assert.equal(detail && detail.textContent, '阅读女声 · 支持情感演绎');
  assert.equal(detail && detail.attributes['aria-live'], 'polite');
  assert.ok(detail && detail.id);
  assert.equal(select && select.attributes['aria-describedby'], detail.id);
});

test('窄屏选角使用单列布局且音色说明不产生横向溢出', () => {
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  const start = css.indexOf('@media (max-width: 760px)');
  const end = css.indexOf('@media (max-height: 640px)', start);
  const mobile = css.slice(start, end);
  assert.match(mobile, /\.cast-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(mobile, /\.cast-voice-detail\s*\{[^}]*grid-column:\s*1/);
});

test('配音遵守自动播放、手动跳过、BGM 压低与生命周期清理', () => {
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  assert.match(player, /state\.voicePromise = speakEvent\(event, generation\)/);
  assert.match(player, /Promise\.resolve\(state\.voicePromise\)[\s\S]*played \? 420 : delay/);
  assert.match(player, /async function advance\(\)[\s\S]*stopVoice\(\);[\s\S]*renderEvent/);
  assert.match(player, /bgm\.volume = Math\.min\(0\.32, bgm\.volume\)/);
  assert.match(player, /function destroy\(\)[\s\S]*stopVoice\(\)/);
  assert.match(player, /Tapp\.lifecycle\.onPause\(function \(\) \{[\s\S]*?stopVoice\(\);[\s\S]*?state\.resumeBgm/);
  assert.match(player, /Tapp\.lifecycle\.onResume\(async function \(\) \{[\s\S]*?await audio\.play\(\)[\s\S]*?speakEvent\(state\.currentEvent/);
});

test('可选语音能力不阻塞启动器首屏并带有超时降级', () => {
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  const mount = player.slice(player.indexOf('async function mount()'), player.indexOf('function destroy()'));
  assert.doesNotMatch(mount, /await initializeSpeech\(\)/);
  assert.match(player, /if \(state\.voiceEnabled && !state\.voiceReady\) await initializeSpeech\(\)/);
  assert.match(player, /function speechCall\(promise\)[\s\S]*?8000/);
});

function readTarEntries(buffer) {
  const entries = new Map();
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString('ascii').replace(/\0.*$/, '');
    const sizeText = header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim();
    const size = Number.parseInt(sizeText || '0', 8);
    const expectedChecksum = Number.parseInt(header.subarray(148, 156).toString('ascii').replace(/\0.*$/, '').trim(), 8);
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    const actualChecksum = checksumHeader.reduce((sum, byte) => sum + byte, 0);
    assert.equal(actualChecksum, expectedChecksum, `${name}: TAR checksum`);
    const contentStart = offset + 512;
    entries.set(name, buffer.subarray(contentStart, contentStart + size).toString('utf8'));
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

test('下载按钮使用宿主文件 API 而非沙箱直接下载', () => {
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
  assert.match(html, /id="download-demo"[^>]*data-i18n="library\.downloadDemo"/);
  assert.doesNotMatch(html, /<a[^>]+download(?:=|\s|>)/i);
  assert.match(player, /Tapp\.file\.download\(archive, EchoStageDemoArchive\.filename, EchoStageDemoArchive\.mimeType\)/);
});

test('开发示例 TAR 可解包并包含可加载的最小游戏目录', () => {
  const source = fs.readFileSync(path.join(appRoot, 'page', 'demo-archive.js'), 'utf8');
  const context = { TextEncoder };
  vm.runInNewContext(source, context, { filename: 'demo-archive.js' });
  const archive = context.EchoStageDemoArchive.build();
  const buffer = Buffer.from(archive, 'utf8');
  assert.equal(context.EchoStageDemoArchive.filename, 'EchoStageDemo.tar');
  assert.ok(buffer.length < 10 * 1024 * 1024);
  assert.equal(new TextDecoder('utf-8', { fatal: true }).decode(buffer), archive);

  const entries = readTarEntries(buffer);
  assert.deepEqual([...entries.keys()], [
    'EchoStageDemo/README.md',
    'EchoStageDemo/game.json',
    'EchoStageDemo/scenario/main.echo'
  ]);
  const game = JSON.parse(entries.get('EchoStageDemo/game.json'));
  assert.equal(game.format, 'echo-stage/v1');
  assert.equal(game.entry, 'scenario/main.echo');
  assert.deepEqual(game.assets, {});
  assert.match(entries.get('EchoStageDemo/scenario/main.echo'), /@choice[\s\S]*@end/);
});
