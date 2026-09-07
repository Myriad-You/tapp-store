import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const require = createRequire(import.meta.url);
const Core = require('../main.js');

const view = { centerLon: 0, centerLat: 0, centerX: 200, centerY: 150, radius: 100, zoom: 1 };

const dataset = {
  countries: [
    {
      code: 'AA',
      point: [0, 0],
      polygons: [[[[ -10, -10 ], [ 10, -10 ], [ 10, 10 ], [ -10, 10 ], [ -10, -10 ]]]]
    },
    {
      code: 'BB',
      point: [40, 0],
      polygons: [[[[ 30, -10 ], [ 50, -10 ], [ 50, 10 ], [ 30, 10 ], [ 30, -10 ]]]]
    }
  ],
  regions: [
    {
      code: 'AA-1',
      countryCode: 'AA',
      point: [-5, 0],
      polygons: [[[[ -10, -10 ], [ 0, -10 ], [ 0, 10 ], [ -10, 10 ], [ -10, -10 ]]]]
    }
  ]
};

test('orthographic projection and inverse round trip visible points', () => {
  for (const [lon, lat] of [[0, 0], [35, 20], [-42, -25]]) {
    const projected = Core.projectPoint(lon, lat, view);
    assert.equal(projected.visible, true);
    const restored = Core.unprojectPoint(projected.x, projected.y, view);
    assert.ok(Math.abs(restored.lon - lon) < 1e-7, `${restored.lon} != ${lon}`);
    assert.ok(Math.abs(restored.lat - lat) < 1e-7, `${restored.lat} != ${lat}`);
  }
});

test('orthographic projection marks the back hemisphere invisible', () => {
  const projected = Core.projectPoint(160, 0, view);
  assert.equal(projected.visible, false);
  assert.ok(projected.depth < 0);
});

test('inverse projection rejects points outside the globe', () => {
  assert.equal(Core.unprojectPoint(400, 150, view), null);
});

test('hit test returns only dataset-backed country and region codes', () => {
  assert.deepEqual(Core.hitTest(dataset, 5, 5, { level: 'country' }), { countryCode: 'AA' });
  assert.deepEqual(Core.hitTest(dataset, -5, 5, { level: 'region', countryCode: 'AA' }), { countryCode: 'AA', regionCode: 'AA-1' });
  assert.equal(Core.hitTest(dataset, 80, 50, { level: 'country' }), null);
  assert.equal(Core.hitTest(dataset, 40, 0, { level: 'region', countryCode: 'AA' }), null);
});

test('representative points are fixed code lookups and returned as copies', () => {
  const index = Core.createMapIndex(dataset);
  const first = Core.representativePoint(index, 'AA-1');
  const second = Core.representativePoint(index, 'AA-1');
  assert.deepEqual(first, [-5, 0]);
  assert.notEqual(first, second);
  first[0] = 999;
  assert.deepEqual(Core.representativePoint(index, 'AA-1'), [-5, 0]);
  assert.equal(Core.representativePoint(index, 'AA-CITY'), null);
});

test('screen hit test never returns coordinates to the caller', () => {
  const point = Core.projectPoint(5, 5, view);
  const result = Core.hitTestScreen(dataset, point.x, point.y, view, { level: 'country' });
  assert.deepEqual(result, { countryCode: 'AA' });
  assert.equal(Object.hasOwn(result, 'lon'), false);
  assert.equal(Object.hasOwn(result, 'lat'), false);
});

test('packaged map resolves Taiwan to China and province 710000 by hierarchy level', async () => {
  const [world, admin1] = await Promise.all([
    readFile(new URL('../assets/world-110m.json', import.meta.url)).then(Core.loadMapAsset),
    readFile(new URL('../assets/admin1-50m.json', import.meta.url)).then(Core.loadMapAsset)
  ]);
  const packaged = Core.mergeMapAssets(world, admin1);

  assert.deepEqual(Core.hitTest(packaged, 121, 24, { level: 'country' }), { countryCode: 'CN' });
  assert.deepEqual(Core.hitTest(packaged, 121, 24, { level: 'region', countryCode: 'CN' }), { countryCode: 'CN', regionCode: '710000' });
});
