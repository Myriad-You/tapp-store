import assert from 'node:assert/strict';
import test from 'node:test';

await import('../main.js');

function fakeCanvas() {
  const listeners = new Map();
  const context = new Proxy({ canvas: null }, {
    get(target, property) {
      if (property in target) return target[property];
      return () => {};
    },
    set(target, property, value) { target[property] = value; return true; }
  });
  const canvas = {
    width: 320,
    height: 240,
    clientWidth: 320,
    clientHeight: 240,
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 240 }),
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
    setPointerCapture() {},
    releasePointerCapture() {}
  };
  context.canvas = canvas;
  return canvas;
}

test('page starts slow globe auto-rotation when reduced motion is not requested', async () => {
  const canvas = fakeCanvas();
  const scheduled = [];
  const previous = {
    document: globalThis.document,
    matchMedia: globalThis.matchMedia,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    Tapp: globalThis.Tapp
  };
  globalThis.document = {
    documentElement: { lang: 'zh-CN' },
    querySelector(selector) { return selector === '[data-globe]' ? canvas : null; },
    querySelectorAll() { return []; }
  };
  globalThis.matchMedia = query => ({
    matches: query.includes('prefers-reduced-motion') ? false : false,
    addEventListener() {},
    removeEventListener() {}
  });
  globalThis.requestAnimationFrame = callback => { scheduled.push(callback); return scheduled.length; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.Tapp = { i18n: { t: key => key, getLocale: () => 'zh-CN' } };
  try {
    await import('../page/view.js');
    const view = new globalThis.FootprintEarthDomView();
    view.ensureGlobe({ dataset: { countries: [], regions: [] }, markers: [] });
    assert.ok(scheduled.length > 0);
    const start = view.globe.getView().centerLon;
    scheduled.shift()(1000);
    scheduled.shift()(1040);
    assert.ok(view.globe.getView().centerLon > start);
    view.destroy();
  } finally {
    globalThis.document = previous.document;
    globalThis.matchMedia = previous.matchMedia;
    globalThis.requestAnimationFrame = previous.requestAnimationFrame;
    globalThis.cancelAnimationFrame = previous.cancelAnimationFrame;
    globalThis.Tapp = previous.Tapp;
  }
});

test('page follows Myriad host theme and forwards changes to the globe', async () => {
  const canvas = fakeCanvas();
  const app = { dataset: {} };
  let themeListener = null;
  let unsubscribed = false;
  const previous = {
    document: globalThis.document,
    matchMedia: globalThis.matchMedia,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    Tapp: globalThis.Tapp
  };
  globalThis.document = {
    documentElement: { lang: 'zh-CN' },
    querySelector(selector) {
      if (selector === '.footprint-app') return app;
      if (selector === '[data-globe]') return canvas;
      return null;
    },
    querySelectorAll() { return []; }
  };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.Tapp = {
    i18n: { t: key => key, getLocale: () => 'zh-CN' },
    ui: {
      getTheme: async () => 'dark',
      onThemeChange(listener) {
        themeListener = listener;
        return () => { unsubscribed = true; };
      }
    }
  };
  try {
    const view = new globalThis.FootprintEarthDomView();
    view.ensureGlobe({ dataset: { countries: [], regions: [] }, markers: [] });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(app.dataset.theme, 'dark');
    assert.equal(view.globe.theme, 'dark');
    themeListener('light');
    assert.equal(app.dataset.theme, 'light');
    assert.equal(view.globe.theme, 'light');
    view.destroy();
    assert.equal(unsubscribed, true);
  } finally {
    globalThis.document = previous.document;
    globalThis.matchMedia = previous.matchMedia;
    globalThis.requestAnimationFrame = previous.requestAnimationFrame;
    globalThis.cancelAnimationFrame = previous.cancelAnimationFrame;
    globalThis.Tapp = previous.Tapp;
  }
});
