import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function textNode() {
  return { textContent: '', hidden: false, removeAttribute() {}, addEventListener() {} };
}

test('widget renders the active public snapshot without federation access', async () => {
  const nodes = new Map([
    ['[data-widget-title]', textNode()],
    ['[data-widget-status]', textNode()],
    ['[data-widget-live]', textNode()],
    ['[data-widget-empty-copy]', textNode()],
    ['[data-widget-intro]', textNode()],
    ['[data-widget-drawings-label]', textNode()],
    ['[data-widget-occupancy-label]', textNode()],
    ['[data-widget-archives-label]', textNode()],
    ['[data-widget-drawings]', textNode()],
    ['[data-widget-occupancy]', textNode()],
    ['[data-widget-archives]', textNode()],
    ['[data-widget-canvas-size]', textNode()],
    ['[data-widget-updated]', textNode()],
    ['[data-widget-image]', Object.assign(textNode(), { src: '' })],
    ['[data-widget-empty]', textNode()]
  ]);
  const scope = {
    dataset: {},
    style: { setProperty() {} },
    querySelector(selector) { return nodes.get(selector) || null; },
    setAttribute() {}
  };
  const requested = [];
  globalThis.Tapp = {
    widgets: {},
    i18n: { t(key) { return key; } },
    shared: {
      async get(key) {
        requested.push(key);
        if (key.includes('active')) return { boardId: 'board-1', canvas: { width: 4096, height: 2304 }, archives: [{}, {}] };
        return { boardId: 'board-1', dataUrl: 'data:image/jpeg;base64,AA==', drawingCount: 12, occupancyRatio: 0.25, createdAt: '2026-08-27T00:00:00Z', canvas: { width: 4096, height: 2304 } };
      },
      onChanged() { return function () {}; }
    },
    widget: { invalidate() { return Promise.resolve(); } },
    lifecycle: { onDestroy() {} }
  };

  require('../widget/entry.js');
  await globalThis.Tapp.widgets['board-preview'].render({ querySelector() { return scope; } }, { size: '4x2', theme: 'light', locale: 'zh-CN' });

  assert.equal(requested.length, 2);
  assert.equal(nodes.get('[data-widget-drawings]').textContent, '12');
  assert.equal(nodes.get('[data-widget-occupancy]').textContent, '25%');
  assert.equal(nodes.get('[data-widget-archives]').textContent, '2');
  assert.equal(nodes.get('[data-widget-image]').src, 'data:image/jpeg;base64,AA==');
  assert.equal(nodes.get('[data-widget-empty]').hidden, true);
  delete globalThis.Tapp;
});
