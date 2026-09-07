const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const markdown = require('../page/markdown.js');
const renderer = require('../page/renderer.js');

class FakeNode {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.hidden = false;
    this.textContent = '';
    this.value = '';
  }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  querySelectorAll() { return []; }
  focus() {}
}

class FakeDocument {
  constructor() {
    this.nodes = new Map();
    this.documentElement = new FakeNode('html');
    this.listeners = {};
    this.activeElement = new FakeNode('button');
  }
  getElementById(id) {
    if (!this.nodes.has(id)) this.nodes.set(id, new FakeNode('div'));
    return this.nodes.get(id);
  }
  createElement(tag) { return new FakeNode(tag); }
  createTextNode(value) {
    const node = new FakeNode('#text');
    node.textContent = String(value);
    return node;
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
}

function walk(node, out = []) {
  out.push(node);
  for (const child of node.children || []) walk(child, out);
  return out;
}

function createPageHarness(options = {}) {
  const document = new FakeDocument();
  let ready;
  const article = {
    id: 'readme',
    slug: 'readme',
    title: 'README',
    summary: '',
    tags: [],
    parentId: null,
    order: 0,
    markdown: '恢复成功\n\n[文档](https://example.com/docs)',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
  const item = {
    id: article.id,
    title: article.title,
    parentId: null,
    order: 0,
    updatedAt: article.updatedAt,
  };

  class FakeSession {
    constructor(sessionOptions) {
      this.onChange = sessionOptions.onChange;
      this.state = {
        loading: false,
        error: null,
        canManage: Boolean(options.canManage),
        roleResolved: true,
        snapshot: {
          catalog: { items: [item] },
          articles: [article],
          issues: [],
        },
      };
    }
    async start() { this.onChange(); }
    async refresh() {
      if (options.refreshError) throw options.refreshError;
      this.onChange();
    }
    destroy() {}
  }

  const translations = {
    copyUrl: '复制地址',
    copyOriginal: '复制原始地址',
    mediaUnavailable: '媒体不可用，正文仍可阅读。',
    invalidFile: '文件无法读取或格式不受支持',
    operationFailed: '操作失败',
  };
  const Tapp = {
    shared: {},
    storage: {},
    i18n: {
      getLocale: () => 'zh-CN',
      t: (key) => translations[key] || key,
    },
    ui: {
      getLocale: async () => 'zh-CN',
      onLocaleChange: () => () => {},
      confirm: async () => true,
    },
    user: { isAdmin: async () => false },
    lifecycle: {
      onReady(handler) { ready = handler; },
      onPause() {},
      onResume() {},
      onDestroy() {},
    },
  };
  const presentation = {
    WikiSession: FakeSession,
    filterArticles: (articles) => articles,
    buildNavigation: (items) => items.map((entry) => ({ ...entry, children: [] })),
  };
  class FakeRepository {
    async getLatestNewDraft() { return null; }
    async getDraft() { return null; }
    async saveDraft() {}
    async publish(value) {
      if (options.publish) return options.publish(value);
      return { article: value };
    }
    async restoreBackup() { return { catalog: { items: [item] } }; }
  }

  const sourcePath = path.join(__dirname, '..', 'page', 'index.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const localRequire = (request) => {
    if (request === './markdown.js') return markdown;
    if (request === './renderer.js') return renderer;
    if (request === './presentation.js') return presentation;
    if (request === './repository.js') return { WikiRepository: FakeRepository };
    if (request === './draft-saver.js') {
      return {
        DraftSaver: class {
          hasPending() { return false; }
        },
      };
    }
    if (request === './clipboard.js') return { copyText: async () => true };
    if (request === './domain.js') return {
      MAX_ARTICLE_BYTES: 1024,
      parseBackup: (value) => JSON.parse(value),
    };
    throw new Error('Unexpected page dependency: ' + request);
  };

  vm.runInNewContext(source, {
    Tapp,
    document,
    require: localRequire,
    module: { exports: {} },
    exports: {},
    console,
    Intl,
    Date,
    Map,
    Set,
    Promise,
    clearTimeout,
    setTimeout,
  }, { filename: sourcePath });

  return {
    document,
    ready: () => ready(),
    openNewArticle: async () => {
      document.getElementById('wiki-app').listeners.click({
        target: {
          closest(selector) {
            return selector === '[data-action]' ? { dataset: { action: 'create-article' } } : null;
          },
        },
      });
      await Promise.resolve();
      await Promise.resolve();
    },
    publishWithShortcut: () => {
      document.listeners.keydown({
        ctrlKey: true,
        metaKey: false,
        key: 's',
        target: document.getElementById('editor-field-markdown'),
        preventDefault() {},
      });
    },
    importJson: async (content) => {
      const input = document.getElementById('json-file');
      const target = { files: [{ size: Buffer.byteLength(content), text: async () => content }], value: 'backup.json' };
      await input.listeners.change({ target });
    },
  };
}

test('reader renders a restored article body with localized safe-link controls', async () => {
  const harness = createPageHarness();

  await harness.ready();

  const nodes = walk(harness.document.getElementById('article-content'));
  assert.match(nodes.map((node) => node.textContent).join(' '), /恢复成功/);
  const copyButton = nodes.find((node) => node.tagName === 'BUTTON');
  assert.equal(copyButton.textContent, '复制地址');
});

test('backup parse failures are reported as invalid files', async () => {
  const harness = createPageHarness();
  await harness.ready();

  await harness.importJson('{not-json');

  assert.match(harness.document.getElementById('status-banner').textContent, /^文件无法读取或格式不受支持:/);
});

test('post-restore refresh failures are reported as operation failures', async () => {
  const harness = createPageHarness({ refreshError: new Error('refresh failed') });
  await harness.ready();

  await harness.importJson('{}');

  assert.match(harness.document.getElementById('status-banner').textContent, /^操作失败: refresh failed$/);
});

test('keyboard publishes wait for the active management write', async () => {
  let publishCalls = 0;
  const pendingPublish = new Promise(() => {});
  const harness = createPageHarness({
    canManage: true,
    publish: async () => {
      publishCalls += 1;
      return pendingPublish;
    },
  });
  await harness.ready();
  await harness.openNewArticle();

  harness.publishWithShortcut();
  harness.publishWithShortcut();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(publishCalls, 1);
});
