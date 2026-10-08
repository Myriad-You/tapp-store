import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const appRoot = new URL('../', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', appRoot), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(new URL('catalog.json', appRoot), 'utf8'));

function flattenMessages(value, prefix = '', result = {}) {
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) flattenMessages(entry, path, result);
    else result[path] = entry;
  }
  return result;
}

test('uses the current Layer Manifest contract', () => {
  for (const key of ['main', 'hasPage', 'cssMode', 'pageStyles', 'pageTemplate', 'widgetStyles']) {
    assert.equal(Object.hasOwn(manifest, key), false, `retired manifest key: ${key}`);
  }
  assert.equal(manifest.core?.entry, 'main.js');
  assert.equal(manifest.page?.template, 'page.html');
  assert.equal(manifest.page?.styles, 'page.css');
  assert.equal(manifest.widgets?.[0]?.entry, 'widget.js');
  assert.equal(manifest.widgets?.[0]?.styles, 'widget.css');
  assert.equal(fs.existsSync(new URL(manifest.widgets[0].entry, appRoot)), true);
  assert.notEqual(manifest.widgets[0].entry, manifest.core.entry);
  const widgetSource = fs.readFileSync(new URL(manifest.widgets[0].entry, appRoot), 'utf8');
  assert.match(widgetSource, /require\(['"]\.\/main\.js['"]\)/);
  assert.match(widgetSource, /registerWidgetLayer/);
});

test('loads shared core exports and renders from the widget layer entry', async () => {
  const lifecycleHandlers = {};
  const sharedTapp = {
    widgets: {},
    lifecycle: {
      onReady(handler) { lifecycleHandlers.ready = handler; },
      onPause(handler) { lifecycleHandlers.pause = handler; },
      onResume(handler) { lifecycleHandlers.resume = handler; },
      onDestroy(handler) { lifecycleHandlers.destroy = handler; },
    },
    storage: {
      async get() { return null; },
      onChanged() { return function () {}; },
    },
    ui: { async getTheme() { return 'light'; } },
    i18n: { getLocale() { return 'en-US'; }, t(key) { return key; } },
  };
  const coreSandbox = {
    console,
    Date,
    Intl,
    JSON,
    Math,
    Number,
    Object,
    Array,
    String,
    Boolean,
    RegExp,
    Promise,
    setTimeout() { return 1; },
    clearTimeout() {},
    document: {
      documentElement: { classList: { toggle() {} }, lang: '' },
      body: { classList: { toggle() {} } },
    },
    Tapp: sharedTapp,
    module: { exports: {} },
  };
  vm.createContext(coreSandbox);
  vm.runInContext(fs.readFileSync(new URL(manifest.core.entry, appRoot), 'utf8'), coreSandbox, { filename: manifest.core.entry });
  const core = coreSandbox.module.exports;
  assert.equal(sharedTapp.widgets['days-countdown'], undefined);

  const widgetSandbox = {
    console,
    Tapp: sharedTapp,
    module: { exports: {} },
    require(specifier) {
      assert.equal(specifier, './main.js');
      return core;
    },
  };
  vm.createContext(widgetSandbox);
  vm.runInContext(fs.readFileSync(new URL(manifest.widgets[0].entry, appRoot), 'utf8'), widgetSandbox, { filename: manifest.widgets[0].entry });
  assert.equal(typeof sharedTapp.widgets['days-countdown']?.render, 'function');

  const root = {
    dataset: {},
    isConnected: true,
    style: { setProperty() {}, removeProperty() {} },
    classList: { toggle() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    setAttribute() {},
  };
  await sharedTapp.widgets['days-countdown'].render(root, { locale: 'en-US', theme: 'light' });
  assert.equal(typeof lifecycleHandlers.destroy, 'function');
});

test('declares localized store descriptions and static previews', () => {
  const expected = {
    'en-US': 'preview.en-US.html',
    'ja-JP': 'preview.ja-JP.html',
  };

  for (const [locale, filename] of Object.entries(expected)) {
    assert.equal(typeof catalog.locales?.[locale]?.long_description, 'string');
    assert.ok(catalog.locales[locale].long_description.length > 80);
    assert.equal(catalog.locales[locale].preview?.html, filename);
    const html = fs.readFileSync(new URL(filename, appRoot), 'utf8');
    assert.match(html, new RegExp(`lang="${locale}"`));
    assert.doesNotMatch(html, /<script\b|<iframe\b|\son[a-z]+\s*=/i);
  }
});

test('keeps the packaged locale key sets aligned', () => {
  const localeFiles = ['zh-CN.json', 'en-US.json', 'ja-JP.json'];
  const keySets = localeFiles.map((filename) => Object.keys(flattenMessages(
    JSON.parse(fs.readFileSync(new URL(`i18n/${filename}`, appRoot), 'utf8')),
  )).sort());

  assert.deepEqual(keySets[1], keySets[0]);
  assert.deepEqual(keySets[2], keySets[0]);
});

test('defines every locale key referenced by packaged markup and scripts', () => {
  const messages = flattenMessages(JSON.parse(
    fs.readFileSync(new URL('i18n/zh-CN.json', appRoot), 'utf8'),
  ));
  const referenced = new Set();
  const markupFiles = [
    manifest.page.template,
    ...manifest.widgets.flatMap((widget) => Object.values(widget.templates || {})),
  ];

  for (const filename of markupFiles) {
    const markup = fs.readFileSync(new URL(filename, appRoot), 'utf8');
    for (const match of markup.matchAll(/data-i18n(?:-placeholder|-aria-label)?=["']([^"']+)["']/g)) {
      referenced.add(match[1]);
    }
  }

  for (const filename of [manifest.core.entry, ...manifest.widgets.map((widget) => widget.entry)]) {
    const script = fs.readFileSync(new URL(filename, appRoot), 'utf8');
    for (const match of script.matchAll(/\bdaysT\(\s*["']([^"']+)["']/g)) referenced.add(match[1]);
  }

  const missing = [...referenced].filter((key) => !Object.hasOwn(messages, key)).sort();
  assert.deepEqual(missing, []);
});
