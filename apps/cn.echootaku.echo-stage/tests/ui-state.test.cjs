'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appRoot = path.resolve(__dirname, '..');
const player = fs.readFileSync(path.join(appRoot, 'page', 'player.js'), 'utf8');
const editor = fs.readFileSync(path.join(appRoot, 'page', 'editor.js'), 'utf8');

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

function fakeNode() {
  const classes = new Set();
  return {
    hidden: false,
    disabled: false,
    textContent: '',
    dataset: {},
    style: {},
    attributes: {},
    listeners: new Map(),
    tabIndex: 0,
    classList: {
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name]; },
    removeAttribute(name) { delete this.attributes[name]; },
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    focus() { this.focused = true; },
    dispatch(type, event = {}) {
      const listener = this.listeners.get(type);
      assert.equal(typeof listener, 'function', `缺少 ${type} 事件处理器`);
      listener.call(this, { currentTarget: this, target: this, preventDefault() {}, ...event });
    }
  };
}

test('页面状态使用语义 tone，Loading 同步双文案与 busy 状态', () => {
  const nodes = {
    'library-status': fakeNode(),
    'loading-title': fakeNode(),
    'loading-message': fakeNode(),
    'loading-layer': fakeNode(),
    'echo-app': fakeNode()
  };
  const context = { el: (id) => nodes[id], tr: (_key, fallback) => fallback };
  vm.runInNewContext([
    functionSource(player, 'setStatus'),
    functionSource(player, 'showLoading'),
    functionSource(player, 'hideLoading')
  ].join('\n'), context, { filename: 'player-ui-state.js' });

  context.setStatus('加载失败', 'error');
  assert.equal(nodes['library-status'].textContent, '加载失败');
  assert.equal(nodes['library-status'].dataset.tone, 'error');
  assert.equal(Object.hasOwn(nodes['library-status'].style || {}, 'color'), false);

  context.showLoading('读取剧本', '正在准备首个场景');
  assert.equal(nodes['loading-layer'].hidden, false);
  assert.equal(nodes['echo-app'].attributes['aria-busy'], 'true');
  assert.equal(nodes['loading-title'].textContent, '读取剧本');
  assert.equal(nodes['loading-message'].textContent, '正在准备首个场景');
  context.hideLoading();
  assert.equal(nodes['loading-layer'].hidden, true);
  assert.equal(nodes['echo-app'].attributes['aria-busy'], undefined);
});

test('所有 UI 状态模块均禁止写入内联颜色', () => {
  for (const [name, source] of [['player.js', player], ['editor.js', editor]]) {
    assert.doesNotMatch(source, /\.style\.(?:color|backgroundColor|borderColor)\s*=/, `${name} 不得写入内联颜色`);
    assert.doesNotMatch(source, /\.style\.setProperty\(\s*['"](?:color|background-color|border-color)['"]/, `${name} 不得通过 setProperty 写入颜色`);
  }
});

test('故事任务把 delta 持续送入中间草稿区并在 result 时完成', async () => {
  const deltas = [];
  let unsubscribed = false;
  const context = {
    setTimeout,
    clearTimeout,
    Tapp: {
      ai: { tasks: {
        get: async () => { throw new Error('已由 result 事件完成，不应轮询'); },
        subscribe: async (_taskId, listener) => {
          listener({ event: 'delta', data: { text: '@label start\n' } });
          listener({ event: 'delta', data: { text: '@narrate 回声抵达。\n' } });
          listener({ event: 'result', data: { result: { format: 'text', value: '@label start\n@narrate 回声抵达。\n@end 余响 | 完成。\n' } } });
          return () => { unsubscribed = true; };
        }
      } }
    },
    tr: (_key, fallback) => fallback
  };
  vm.runInNewContext([
    functionSource(editor, 'text'),
    functionSource(editor, 'extractTaskId'),
    functionSource(editor, 'extractResult'),
    functionSource(editor, 'taskStatus'),
    functionSource(editor, 'waitForTask')
  ].join('\n'), context, { filename: 'editor-ai-stream.js' });

  const result = await context.waitForTask({ taskId: 'task-1' }, null, (delta) => deltas.push(delta));
  await Promise.resolve();
  assert.deepEqual(deltas, ['@label start\n', '@narrate 回声抵达。\n']);
  assert.equal(result.value, '@label start\n@narrate 回声抵达。\n@end 余响 | 完成。\n');
  assert.equal(unsubscribed, true, '同步完成的流式任务也必须释放订阅');
});

test('失败任务保留供应商代码、任务 ID 与真实用量，供安全降级判断', () => {
  const context = { tr: (_key, fallback) => fallback };
  vm.runInNewContext([
    functionSource(editor, 'text'),
    functionSource(editor, 'errorMessage'),
    functionSource(editor, 'extractTaskId'),
    functionSource(editor, 'taskStatus'),
    functionSource(editor, 'taskFailure'),
    functionSource(editor, 'isZeroUsageProviderFailure')
  ].join('\n'), context, { filename: 'editor-ai-task-failure.js' });

  const error = context.taskFailure({
    taskId: 'ait-zero-usage',
    status: 'failed',
    error: { code: 'AI_PROVIDER_ERROR', message: 'AI provider failed to complete the task' },
    usage: { calls: { used: 0 }, tokens: { used: 0 } }
  }, 'AI 任务失败');
  assert.equal(error.code, 'AI_PROVIDER_ERROR');
  assert.equal(error.taskId, 'ait-zero-usage');
  assert.equal(error.status, 'failed');
  assert.equal(error.usage.calls.used, 0);
  assert.equal(context.isZeroUsageProviderFailure(error), true);

  const unknownUsage = context.taskFailure({ status: 'failed', error: { code: 'AI_PROVIDER_ERROR', message: 'failed' } }, 'AI 任务失败');
  assert.equal(context.isZeroUsageProviderFailure(unknownUsage), false, '用量未知时不得自动重试并可能重复计费');
});

test('流式供应商在零用量且没有增量时仅降级一次完整结果交付', async () => {
  const calls = [];
  const notices = [];
  const providerError = Object.assign(new Error('provider failed'), {
    code: 'AI_PROVIDER_ERROR',
    usage: { calls: { used: 0 }, tokens: { used: 0 } }
  });
  const context = {
    Date,
    Math,
    Tapp: { ai: { tasks: { create: async (request) => { calls.push(request); return { taskId: `task-${calls.length}`, delivery: request.delivery }; } } } },
    fingerprint: () => 'brief-hash',
    waitForTask: async (initial) => {
      if (initial.delivery === 'stream') throw providerError;
      return { format: 'text', value: '@label start\n@background scene_1\n@end 余响 | 完成。\n' };
    },
    updateBusy: (message) => notices.push(message),
    isZeroUsageProviderFailure: (error) => error === providerError,
    tr: (_key, fallback) => fallback
  };
  vm.runInNewContext(functionSource(editor, 'requestStoryDraft'), context, { filename: 'editor-ai-compatible-fallback.js' });

  const project = { id: 'story-1', premise: '海边告别', tone: 'poetic', length: 'short' };
  const result = await context.requestStoryDraft(project, 'instruction', () => {});
  assert.equal(result.format, 'text');
  assert.deepEqual(calls.map((call) => call.delivery), ['stream', 'result']);
  assert.equal(calls.every((call) => call.operation === 'generate'), true);
  assert.equal(calls.every((call) => call.input.prompt === 'instruction'), true);
  assert.notEqual(calls[0].idempotencyKey, calls[1].idempotencyKey);
  assert.equal(notices.length, 1);
  assert.match(notices[0], /兼容|完整结果/);
});

test('流式任务已经返回增量后不自动改走完整结果以免重复调用', async () => {
  const calls = [];
  const providerError = Object.assign(new Error('provider failed'), {
    code: 'AI_PROVIDER_ERROR',
    usage: { calls: { used: 0 }, tokens: { used: 0 } }
  });
  const context = {
    Date,
    Math,
    Tapp: { ai: { tasks: { create: async (request) => { calls.push(request); return { taskId: 'task-stream', delivery: request.delivery }; } } } },
    fingerprint: () => 'brief-hash',
    waitForTask: async (_initial, _progress, onDelta) => { onDelta('@label start\n'); throw providerError; },
    updateBusy: () => {},
    isZeroUsageProviderFailure: () => true,
    tr: (_key, fallback) => fallback
  };
  vm.runInNewContext(functionSource(editor, 'requestStoryDraft'), context, { filename: 'editor-ai-no-duplicate.js' });

  await assert.rejects(() => context.requestStoryDraft({ id: 'story-1', premise: '告别', tone: 'poetic', length: 'short' }, 'instruction', () => {}), /provider failed/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].delivery, 'stream');
});

test('流式故事草稿去除代码围栏并提取标题与场景提示词', () => {
  const parsed = [];
  const context = {
    EchoStageEngine: { parseScript(script) { parsed.push(script); return { commands: [
      { type: 'label', name: 'start' }, { type: 'background', value: 'scene_1' }, { type: 'end', title: '余响' }
    ], labels: { start: 0 } }; } },
    tr: (_key, fallback) => fallback
  };
  vm.runInNewContext([
    functionSource(editor, 'text'),
    functionSource(editor, 'storyTextResult'),
    functionSource(editor, 'normalizeStoryDraft')
  ].join('\n'), context, { filename: 'editor-story-draft.js' });

  const draft = context.normalizeStoryDraft({ format: 'text', value: '```echo\n# @title 雨停之后\n# @scene scene_1 | 清晨海边车站，留出对话区域\n@label start\n@background scene_1\n@narrate 潮声渐远。\n@end 余响 | 我们记得。\n```' }, '未命名剧目', '海边告别');
  assert.equal(draft.title, '雨停之后');
  assert.equal(draft.script.startsWith('# @title'), true);
  assert.equal(draft.script.includes('```'), false);
  assert.equal(draft.assets.length, 1);
  assert.equal(draft.assets[0].id, 'scene_1');
  assert.equal(draft.assets[0].prompt, '清晨海边车站，留出对话区域');
  assert.equal(parsed.length, 1, '最终草稿必须由本地解释器校验');
});

test('AI 故事为缺少标题的 @end 补齐本地化标题', () => {
  const parsed = [];
  const context = {
    EchoStageEngine: { parseScript(script) { parsed.push(script); return { commands: [
      { type: 'label', name: 'start' }, { type: 'background', value: 'scene_1' }, { type: 'end', title: '余响' }
    ], labels: { start: 0 } }; } },
    tr: (key, fallback) => key === 'editor.generatedEndTitle' ? '余响' : fallback
  };
  vm.runInNewContext([
    functionSource(editor, 'text'),
    functionSource(editor, 'storyTextResult'),
    functionSource(editor, 'normalizeStoryDraft')
  ].join('\n'), context, { filename: 'editor-story-end-repair.js' });

  const draft = context.normalizeStoryDraft(
    '# @title 海岸回声\n# @scene scene_1 | 海边车站\n@label start\n@background scene_1\n@narrate 潮声抵达。\n@end | 我们仍然向前。\n',
    '未命名剧目',
    '海边告别'
  );
  assert.match(draft.script, /^@end 余响 \| 我们仍然向前。$/m);
  assert.equal(parsed[0], draft.script, '补齐标题后才交给严格解释器校验');
});

test('表单内容未变化时不更新时间戳也不触发保存', () => {
  const updatedAt = '2026-08-21T00:00:00.000Z';
  const project = { id: 'story-1', title: '原题', premise: '原想法', tone: 'poetic', length: 'short', script: '@label start\n@end 余响 | 完成。\n', updatedAt };
  const nodes = {
    'project-title': { value: project.title }, 'project-premise': { value: project.premise },
    'project-tone': { value: project.tone }, 'project-length': { value: project.length },
    'script-editor': { value: project.script }
  };
  const context = {
    state: { projects: [project], activeId: project.id },
    el: (id) => nodes[id],
    tr: (_key, fallback) => fallback
  };
  vm.runInNewContext([
    functionSource(editor, 'text'),
    functionSource(editor, 'activeProject'),
    functionSource(editor, 'syncForm')
  ].join('\n'), context, { filename: 'editor-sync-form.js' });

  assert.equal(context.syncForm(), false);
  assert.equal(project.updatedAt, updatedAt);
  nodes['project-title'].value = '新题';
  assert.equal(context.syncForm(), true);
  assert.equal(project.title, '新题');
  assert.notEqual(project.updatedAt, updatedAt);
});

test('只有真实 dirty 写入才允许显示保存成功，关闭静默冲刷不制造提示', async () => {
  let writes = 0;
  const notices = [];
  const context = {
    state: { dirty: false, saveTimer: 0 },
    clearTimeout,
    persist: async () => { writes += 1; },
    notify: (message, tone) => notices.push({ message, tone }),
    tr: (_key, fallback) => fallback
  };
  vm.runInNewContext(functionSource(editor, 'flushPendingSave'), context, { filename: 'editor-save-feedback.js' });

  assert.equal(await context.flushPendingSave(true), false);
  assert.equal(writes, 0);
  assert.deepEqual(notices, []);

  context.state.dirty = true;
  assert.equal(await context.flushPendingSave(false), true);
  assert.equal(writes, 1);
  assert.deepEqual(notices, [], '关闭时的真实写入应保持静默');

  context.state.dirty = true;
  assert.equal(await context.flushPendingSave(true), true);
  assert.equal(writes, 2);
  assert.deepEqual(notices, [{ message: '已保存', tone: 'success' }]);
});

test('生图供应商响应解码失败会给出 Myriad 适配层诊断而非误报参数错误', () => {
  const context = { tr: (_key, fallback) => fallback };
  vm.runInNewContext(functionSource(editor, 'diagnoseAiError'), context, { filename: 'editor-ai-diagnosis.js' });
  const message = context.diagnoseAiError('AI_PROVIDER_ERROR：error decoding response body for url (https://api.openai.com/v1/images/generations)', 'image');
  assert.match(message, /AI_PROVIDER_ERROR/);
  assert.match(message, /Myriad/);
  assert.match(message, /供应商响应/);
  assert.doesNotMatch(message, /宽高|尺寸参数/);
});

test('生图任务接受宿主同源根路径并归一化为 HTTPS 引用', () => {
  const context = { tr: (_key, fallback) => fallback, URL };
  vm.runInNewContext(functionSource(editor, 'imageResult'), context, { filename: 'editor-image-result.js' });

  const result = context.imageResult({
    format: 'image',
    value: {
      height: 768,
      url: '/api/brew/image-cache/85/85d39f6047538b460859d7d88354e938982ea0b74e0c93619d503c8f6d81137b.png',
      width: 1344
    }
  }, 'https://echootaku.cn/tapp/run/cn.echootaku.echo-stage');

  assert.equal(result.url, 'https://echootaku.cn/api/brew/image-cache/85/85d39f6047538b460859d7d88354e938982ea0b74e0c93619d503c8f6d81137b.png');
  assert.equal(result.width, 1344);
  assert.equal(result.height, 768);
});

test('生图任务拒绝非 HTTPS 与协议相对 URL', () => {
  const context = { tr: (_key, fallback) => fallback, URL };
  vm.runInNewContext(functionSource(editor, 'imageResult'), context, { filename: 'editor-image-result-safety.js' });
  const payload = (url) => ({ format: 'image', value: { url, width: 1344, height: 768 } });
  const baseUrl = 'https://echootaku.cn/tapp/run/cn.echootaku.echo-stage';

  assert.throws(() => context.imageResult(payload('http://cdn.example/scene.png'), baseUrl), /安全 URL/);
  assert.throws(() => context.imageResult(payload('javascript:alert(1)'), baseUrl), /安全 URL/);
  assert.throws(() => context.imageResult(payload('//evil.example/scene.png'), baseUrl), /安全 URL/);
});

test('编辑器以唯一反馈区呈现处理中、成功、警告和错误，并在结束后恢复控件', () => {
  assert.doesNotMatch(editor, /editor-progress|editor-status/, '不得继续维护重叠的旧反馈节点');
  const nodes = {
    'editor-feedback': fakeNode(),
    'editor-feedback-progress': fakeNode(),
    'editor-feedback-title': fakeNode(),
    'editor-feedback-message': fakeNode(),
    'editor-feedback-close': fakeNode(),
    'editor-view': fakeNode()
  };
  for (const id of ['ai-write', 'ai-image', 'editor-play', 'editor-export', 'editor-new']) nodes[id] = fakeNode();
  const context = { state: { busy: false }, el: (id) => nodes[id], tr: (_key, fallback) => fallback };
  vm.runInNewContext([
    functionSource(editor, 'dismissFeedback'),
    functionSource(editor, 'notify'),
    functionSource(editor, 'setBusy'),
    functionSource(editor, 'updateBusy')
  ].join('\n'), context, { filename: 'editor-feedback.js' });

  context.setBusy(true, '正在等待结果', 'Myriad AI 正在创作');
  assert.equal(nodes['editor-feedback'].hidden, false);
  assert.equal(nodes['editor-feedback'].dataset.tone, 'info');
  assert.equal(nodes['editor-feedback-progress'].hidden, false);
  assert.equal(nodes['editor-feedback-title'].textContent, 'Myriad AI 正在创作');
  assert.equal(nodes['editor-feedback-message'].textContent, '正在等待结果');
  assert.equal(nodes['editor-feedback-close'].hidden, true, '处理中不得让用户误以为任务已取消');
  assert.equal(nodes['ai-write'].disabled, true);
  context.updateBusy('任务已创建');
  assert.equal(nodes['editor-feedback-message'].textContent, '任务已创建');
  context.notify('初稿已生成', 'success');
  assert.equal(nodes['editor-feedback'].dataset.tone, 'success');
  assert.equal(nodes['editor-feedback-title'].textContent, '已完成');
  context.notify('请先补全故事想法', 'warning');
  assert.equal(nodes['editor-feedback'].dataset.tone, 'warning');
  assert.equal(nodes['editor-feedback-title'].textContent, '需要确认');
  context.notify('任务失败', 'error');
  assert.equal(nodes['editor-feedback'].dataset.tone, 'error');
  assert.equal(nodes['editor-feedback-title'].textContent, '出现问题');
  context.setBusy(false);
  assert.equal(nodes['editor-feedback-progress'].hidden, true);
  assert.equal(nodes['editor-feedback-close'].hidden, false, '任务结束后提示应可关闭');
  assert.equal(nodes['ai-write'].disabled, false);
  assert.notEqual(nodes['editor-view'].attributes['aria-busy'], 'true');

  nodes['editor-feedback-progress'].hidden = false;
  context.notify('请补充素材描述', 'warning');
  assert.equal(nodes['editor-feedback-progress'].hidden, true, '非忙碌 warning 不应遗留进度条');
  context.notify('导出失败', 'error', '导出剧本失败');
  assert.equal(nodes['editor-feedback-title'].textContent, '导出剧本失败', '调用方可传递具体错误标题');
  context.dismissFeedback();
  assert.equal(nodes['editor-feedback'].hidden, true, '非忙碌提示应支持手动关闭');
});

test('窄屏 pane 支持点击与 Arrow、Home、End 键盘切换并同步 ARIA', () => {
  const nodes = { 'editor-tabs': fakeNode() };
  for (const pane of ['story', 'script', 'scene']) {
    nodes[`editor-tab-${pane}`] = fakeNode();
    nodes[`editor-pane-${pane}`] = fakeNode();
  }
  for (const id of ['project-title', 'project-premise', 'project-tone', 'project-length', 'script-editor', 'scene-id', 'project-list', 'project-picker', 'asset-list', 'image-prompt', 'ai-write', 'ai-image', 'editor-new', 'editor-play', 'editor-export', 'editor-feedback', 'editor-feedback-close']) nodes[id] = fakeNode();
  const context = {
    AbortController,
    el: (id) => nodes[id],
    state: { activePane: 'story', compactEditor: true }
  };
  vm.runInNewContext([
    functionSource(editor, 'dismissFeedback'),
    functionSource(editor, 'setEditorPane'),
    functionSource(editor, 'bind')
  ].join('\n'), context, { filename: 'editor-tabs.js' });

  context.setEditorPane('story');
  assert.equal(nodes['editor-tab-story'].attributes['aria-selected'], 'true');
  assert.equal(nodes['editor-tab-story'].tabIndex, 0);
  assert.equal(nodes['editor-pane-story'].hidden, false);
  assert.equal(nodes['editor-pane-script'].hidden, true);

  context.bind();
  nodes['editor-feedback'].hidden = false;
  nodes['editor-feedback-close'].dispatch('click');
  assert.equal(nodes['editor-feedback'].hidden, true, '关闭按钮必须真正收起反馈条');
  nodes['editor-tab-script'].dispatch('click');
  assert.equal(context.state.activePane, 'script');
  assert.equal(nodes['editor-tab-script'].attributes['aria-selected'], 'true');
  assert.equal(nodes['editor-pane-script'].hidden, false);

  nodes['editor-tab-script'].dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(context.state.activePane, 'scene');
  assert.equal(nodes['editor-tab-scene'].focused, true);
  nodes['editor-tab-scene'].dispatch('keydown', { key: 'Home' });
  assert.equal(context.state.activePane, 'story');
  assert.equal(nodes['editor-tab-story'].focused, true);
  nodes['editor-tab-story'].dispatch('keydown', { key: 'End' });
  assert.equal(context.state.activePane, 'scene');
  assert.equal(nodes['editor-tab-scene'].focused, true);
  assert.equal(nodes['editor-pane-story'].hidden, true);
  assert.equal(nodes['editor-pane-scene'].hidden, false);
});

test('宽屏 pane 同时可见，媒体查询变更随 AbortController 清理', () => {
  const nodes = { 'editor-tabs': fakeNode() };
  for (const pane of ['story', 'script', 'scene']) {
    nodes[`editor-tab-${pane}`] = fakeNode();
    nodes[`editor-pane-${pane}`] = fakeNode();
  }
  for (const id of ['project-title', 'project-premise', 'project-tone', 'project-length', 'script-editor', 'scene-id', 'project-list', 'project-picker', 'asset-list', 'image-prompt', 'ai-write', 'ai-image', 'editor-new', 'editor-play', 'editor-export', 'editor-feedback-close']) nodes[id] = fakeNode();
  const subscriptions = [];
  const compactQuery = {
    matches: false,
    addEventListener(type, listener, options) {
      const subscription = { type, listener, options };
      subscriptions.push(subscription);
      options.signal.addEventListener('abort', () => subscriptions.splice(subscriptions.indexOf(subscription), 1), { once: true });
    }
  };
  const context = {
    AbortController,
    el: (id) => nodes[id],
    matchMedia: (query) => { assert.equal(query, '(max-width: 760px)'); return compactQuery; },
    state: { activePane: 'story', compactEditor: false }
  };
  vm.runInNewContext([
    functionSource(editor, 'dismissFeedback'),
    functionSource(editor, 'setEditorPane'),
    functionSource(editor, 'bind')
  ].join('\n'), context, { filename: 'editor-responsive-state.js' });

  context.setEditorPane('script');
  for (const pane of ['story', 'script', 'scene']) assert.equal(nodes[`editor-pane-${pane}`].hidden, false, `宽屏应显示 ${pane}`);
  context.bind();
  assert.equal(subscriptions.length, 1);
  assert.equal(subscriptions[0].type, 'change');
  assert.equal(subscriptions[0].options.signal, context.state.abort.signal);
  subscriptions[0].listener({ matches: true });
  assert.equal(context.state.compactEditor, true);
  assert.equal(nodes['editor-pane-story'].hidden, true);
  assert.equal(nodes['editor-pane-script'].hidden, false);
  context.state.abort.abort();
  assert.equal(subscriptions.length, 0, '销毁时必须移除 matchMedia 监听');
});
