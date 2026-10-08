import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

await import('../main.js');

function fakeCanvas() {
  const listeners = new Map();
  const context = new Proxy({}, { get(target, key) { if (key === 'canvas') return canvas; return target[key] || (() => {}); }, set(target, key, value) { target[key] = value; return true; } });
  const canvas = {
    width: 320, height: 180, clientWidth: 320, clientHeight: 180, style: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 180 }),
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); },
    setPointerCapture() {}, releasePointerCapture() {}
  };
  return { canvas, listeners };
}

function fakeContainer(fixture) {
  const textNodes = new Map();
  const scope = {
    querySelector(selector) {
      if (selector === '[data-globe]') return fixture.canvas;
      if (!textNodes.has(selector)) textNodes.set(selector, { textContent: '' });
      return textNodes.get(selector);
    },
    dataset: {}, style: { setProperty() {} }, setAttribute(name, value) { this[name] = value; }
  };
  return { scope, container: { querySelector(selector) { return selector === '[data-widget-root]' ? scope : null; } } };
}

test('widget source is shared-read-only and contains no room, network, or snapshot path', async () => {
  const source = await readFile(new URL('../widget/entry.js', import.meta.url), 'utf8');
  assert.match(source, /shared\.get/);
  assert.match(source, /assets\.getArrayBuffer/);
  assert.doesNotMatch(source, /federation|Room|fetch\s*\(|XMLHttpRequest|WebSocket|data:image/i);
  assert.doesNotMatch(source, /shared\.set|storage\.set/);
  assert.doesNotMatch(source, /shared\.onChanged/);
  assert.doesNotMatch(source, /widget\.invalidate/);
});

test('repeated render replaces only its own globe while lifecycle controls every instance', async () => {
  const firstFixture = fakeCanvas();
  const secondFixture = fakeCanvas();
  const firstHost = fakeContainer(firstFixture);
  const secondHost = fakeContainer(secondFixture);
  const calls = [];
  const lifecycle = {};
  globalThis.Tapp = {
    widgets: {},
    shared: {
      async get(key) { calls.push(`get:${key}`); return key.includes('owner') ? { v: 1, countries: [], regions: [] } : null; },
    },
    assets: { async getArrayBuffer(name) { calls.push(`asset:${name}`); return new TextEncoder().encode(JSON.stringify({ v: 1, countries: [], regions: [] })).buffer; } },
    lifecycle: {
      onPause(handler) { lifecycle.pause = handler; },
      onResume(handler) { lifecycle.resume = handler; },
      onDestroy(handler) { lifecycle.destroy = handler; }
    },
    i18n: { t(key) { return key; } }
  };
  await import(`../widget/entry.js?test=${Date.now()}`);
  await globalThis.Tapp.widgets['footprint-globe'].render(firstHost.container, { theme: 'light', size: '4x2' });
  const first = globalThis.FootprintEarthWidget.getController(firstHost.container);
  await globalThis.Tapp.widgets['footprint-globe'].render(secondHost.container, { theme: 'dark', size: '4x2' });
  const second = globalThis.FootprintEarthWidget.getController(secondHost.container);
  assert.notEqual(first, second);
  assert.equal(first.isDestroyed(), false);
  await globalThis.Tapp.widgets['footprint-globe'].render(firstHost.container, { theme: 'dark', size: '4x2' });
  const replacement = globalThis.FootprintEarthWidget.getController(firstHost.container);
  assert.notEqual(first, replacement);
  assert.equal(first.isDestroyed(), true);
  assert.equal(second.isDestroyed(), false);
  assert.equal(firstHost.scope.dataset.theme, 'dark');
  assert.equal(firstHost.scope['aria-label'], 'widget.aria');
  lifecycle.pause();
  assert.equal(replacement.isPaused(), true);
  assert.equal(second.isPaused(), true);
  lifecycle.resume();
  assert.equal(replacement.isPaused(), false);
  assert.equal(second.isPaused(), false);
  lifecycle.destroy();
  assert.equal(replacement.isDestroyed(), true);
  assert.equal(second.isDestroyed(), true);
  assert.equal(globalThis.FootprintEarthWidget.getController(firstHost.container), null);
  assert.ok(calls.some(call => call.startsWith('get:')));
  assert.ok(calls.includes('asset:assets/world-110m.json'));
  assert.ok(calls.includes('asset:assets/admin1-50m.json'));
});
