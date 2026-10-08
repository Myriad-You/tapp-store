import assert from 'node:assert/strict';
import test from 'node:test';

const Core = await import('../main.js').then(() => globalThis.FootprintEarthCore);

function fakeCanvas() {
  const listeners = new Map();
  const arcs = [];
  const context = new Proxy({
    canvas: null,
    arc(...args) { arcs.push(args); }
  }, {
    get(target, property) {
      if (property in target) return target[property];
      if (property === 'measureText') return () => ({ width: 20 });
      return () => {};
    },
    set(target, property, value) { target[property] = value; return true; }
  });
  const canvas = {
    width: 320,
    height: 240,
    clientWidth: 320,
    clientHeight: 240,
    style: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 240 }),
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
    setPointerCapture() {},
    releasePointerCapture() {}
  };
  context.canvas = canvas;
  return { canvas, context, listeners, arcs };
}

test('dragging changes globe rotation and clicking returns only standard codes', () => {
  const fixture = fakeCanvas();
  let selection = null;
  const globe = new Core.GlobeController(fixture.canvas, {
    dataset: {
      countries: [{ code: 'AA', names: { en: 'Aland' }, point: [0, 0], polygons: [[[[ -20, -20 ], [20, -20], [20, 20], [-20, 20], [-20, -20]]]] }],
      regions: []
    },
    onSelect(value) { selection = value; },
    autoRotate: false
  });
  const before = globe.getView();
  fixture.listeners.get('pointerdown')({ pointerId: 1, clientX: 160, clientY: 120, preventDefault() {} });
  fixture.listeners.get('pointermove')({ pointerId: 1, clientX: 200, clientY: 100, preventDefault() {} });
  fixture.listeners.get('pointerup')({ pointerId: 1, clientX: 200, clientY: 100, preventDefault() {} });
  assert.notEqual(globe.getView().centerLon, before.centerLon);

  globe.setView({ centerLon: 0, centerLat: 0, zoom: 1 });
  fixture.listeners.get('pointerdown')({ pointerId: 2, clientX: 160, clientY: 120, preventDefault() {} });
  fixture.listeners.get('pointerup')({ pointerId: 2, clientX: 160, clientY: 120, preventDefault() {} });
  assert.deepEqual(selection, { countryCode: 'AA' });
  assert.deepEqual(Object.keys(selection), ['countryCode']);
  globe.destroy();
});

test('region targeting falls back to a new country outside the current country', () => {
  const fixture = fakeCanvas();
  let selection = null;
  const globe = new Core.GlobeController(fixture.canvas, {
    dataset: {
      countries: [
        { code: 'AA', polygons: [[[[ -20, -20 ], [20, -20], [20, 20], [-20, 20], [-20, -20]]]] },
        { code: 'BB', polygons: [[[[ 30, -15 ], [50, -15], [50, 15], [30, 15], [30, -15]]]] }
      ],
      regions: [
        { code: 'AA-1', countryCode: 'AA', polygons: [[[[ -20, -20 ], [0, -20], [0, 20], [-20, 20], [-20, -20]]]] }
      ]
    },
    view: { centerLon: 0, centerLat: 0, zoom: 1 },
    onSelect(value) { selection = value; },
    autoRotate: false
  });
  globe.setHitTarget('region', 'AA');
  const target = Core.projectPoint(40, 0, { centerLon: 0, centerLat: 0, centerX: 160, centerY: 120, radius: 103.2, zoom: 1 });
  fixture.listeners.get('pointerdown')({ pointerId: 3, clientX: target.x, clientY: target.y, preventDefault() {} });
  fixture.listeners.get('pointerup')({ pointerId: 3, clientX: target.x, clientY: target.y, preventDefault() {} });
  assert.deepEqual(selection, { countryCode: 'BB' });
  globe.destroy();
});

test('pause, resume and destroy control animation and listeners idempotently', () => {
  const fixture = fakeCanvas();
  const scheduled = [];
  const cancelled = [];
  const globe = new Core.GlobeController(fixture.canvas, {
    dataset: { countries: [], regions: [] },
    autoRotate: true,
    requestFrame(callback) { scheduled.push(callback); return scheduled.length; },
    cancelFrame(id) { cancelled.push(id); }
  });
  assert.equal(globe.isPaused(), false);
  assert.ok(scheduled.length >= 1);
  globe.pause();
  assert.equal(globe.isPaused(), true);
  assert.ok(cancelled.length >= 1);
  globe.resume();
  assert.equal(globe.isPaused(), false);
  globe.destroy();
  globe.destroy();
  assert.equal(fixture.listeners.size, 0);
  assert.equal(globe.isDestroyed(), true);
});

test('keyboard arrows rotate and plus/minus zoom without pointer input', () => {
  const fixture = fakeCanvas();
  const globe = new Core.GlobeController(fixture.canvas, { dataset: { countries: [], regions: [] }, autoRotate: false });
  const initial = globe.getView();
  fixture.listeners.get('keydown')({ key: 'ArrowRight', preventDefault() {} });
  assert.notEqual(globe.getView().centerLon, initial.centerLon);
  const rotated = globe.getView();
  fixture.listeners.get('keydown')({ key: '+', preventDefault() {} });
  assert.ok(globe.getView().zoom > rotated.zoom);
  fixture.listeners.get('keydown')({ key: '-', preventDefault() {} });
  assert.ok(globe.getView().zoom <= rotated.zoom * 1.01);
  globe.destroy();
});

test('zoom scales the globe boundary together with projected map content', () => {
  const fixture = fakeCanvas();
  const globe = new Core.GlobeController(fixture.canvas, {
    dataset: { countries: [], regions: [] },
    autoRotate: false
  });
  fixture.arcs.length = 0;
  globe.setView({ zoom: 2 });
  const boundaryRadii = fixture.arcs.map(args => args[2]);
  assert.deepEqual(boundaryRadii, [206.4, 206.4]);
  globe.destroy();
});

test('partially visible land closes along the spherical horizon', () => {
  const fixture = fakeCanvas();
  Core.renderGlobe(fixture.context, {
    width: 320,
    height: 240,
    view: { centerLon: 0, centerLat: 0, zoom: 1 },
    dataset: {
      countries: [{
        code: 'EDGE',
        polygons: [[[[ -100, -20 ], [ -80, -20 ], [ 80, -20 ], [ 100, 20 ], [ -100, -20 ]]]]
      }]
    }
  });
  assert.equal(fixture.arcs.length, 3);
  assert.equal(fixture.arcs[1][2], 103.2);
});

test('auto-rotation pauses while dragging and resumes after release', () => {
  const fixture = fakeCanvas();
  const scheduled = [];
  const globe = new Core.GlobeController(fixture.canvas, {
    dataset: { countries: [], regions: [] },
    autoRotate: true,
    requestFrame(callback) { scheduled.push(callback); return scheduled.length; }
  });
  scheduled.shift()(1000);
  scheduled.shift()(1040);
  const beforeDrag = globe.getView().centerLon;
  fixture.listeners.get('pointerdown')({ pointerId: 9, clientX: 160, clientY: 120, preventDefault() {} });
  scheduled.shift()(1080);
  assert.equal(globe.getView().centerLon, beforeDrag);
  fixture.listeners.get('pointerup')({ pointerId: 9, clientX: 160, clientY: 120, preventDefault() {} });
  scheduled.shift()(1120);
  assert.ok(globe.getView().centerLon > beforeDrag);
  globe.destroy();
});

test('owner footprints are code-only, bounded and status constrained', () => {
  const mapIndex = Core.createMapIndex({
    countries: [{ code: 'AA', point: [1, 2] }],
    regions: [{ code: 'AA-1', countryCode: 'AA', point: [2, 3] }]
  });
  const checked = Core.validateOwnerFootprints({
    v: 1,
    countries: [{ code: 'AA', status: 'resident' }],
    regions: [{ code: 'AA-1', countryCode: 'AA', status: 'travel' }]
  }, mapIndex);
  assert.equal(checked.ok, true);
  assert.doesNotMatch(JSON.stringify(checked.value), /actor|createdAt|lat|lon|city/i);
  assert.equal(Core.validateOwnerFootprints({ v: 1, countries: [{ code: 'AA', status: 'visitor' }], regions: [] }, mapIndex).ok, false);
  assert.equal(Core.validateOwnerFootprints({ v: 1, countries: [], regions: [{ code: 'AA-1', countryCode: 'BB', status: 'travel' }] }, mapIndex).ok, false);
});

test('owner reader migrates legacy TW country footprints to Taiwan province under China', () => {
  const mapIndex = Core.createMapIndex({
    countries: [{ code: 'CN', point: [104, 35] }],
    regions: [{ code: '710000', countryCode: 'CN', point: [121, 24] }]
  });
  const checked = Core.validateOwnerFootprints({
    v: 1,
    countries: [{ code: 'TW', status: 'resident' }],
    regions: []
  }, mapIndex);

  assert.equal(checked.ok, true);
  assert.deepEqual(checked.value, {
    v: 1,
    countries: [],
    regions: [{ code: '710000', countryCode: 'CN', status: 'resident' }]
  });
  assert.equal(Core.validateOwnerFootprints({
    v: 1,
    countries: [{ code: 'TW', status: 'resident', city: 'forged' }],
    regions: []
  }, mapIndex).ok, false);
});
