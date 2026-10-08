import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDatasets } from '../scripts/build-map-data.mjs';

const square = [[0, 0], [0.04, 0], [10, 0], [10, 10], [0, 10], [0, 0]];

test('map builder keeps only standard country and admin1 codes with reduced fields', () => {
  const countries = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { ISO_A2: 'AA', NAME_EN: 'Aland', NAME_ZH: '阿兰', NAME_JA: 'アランド', LABEL_X: 4.94, LABEL_Y: 5.06, POP_EST: 999 },
        geometry: { type: 'Polygon', coordinates: [square] }
      },
      {
        type: 'Feature',
        properties: { ISO_A2: '-99', NAME_EN: 'No code', LABEL_X: 0, LABEL_Y: 0 },
        geometry: { type: 'Polygon', coordinates: [square] }
      }
    ]
  };
  const regions = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { iso_3166_2: 'AA-1', iso_a2: 'AA', name_en: 'North', name_zh: '北部', name_ja: '北', longitude: 5.04, latitude: 5.06, woe_id: 42 },
        geometry: { type: 'Polygon', coordinates: [square] }
      },
      {
        type: 'Feature',
        properties: { iso_3166_2: '-99', iso_a2: 'AA', name_en: 'No code', longitude: 1, latitude: 1 },
        geometry: { type: 'Polygon', coordinates: [square] }
      }
    ]
  };
  const result = buildDatasets(countries, regions, { revision: 'abc123', countryHash: 'hash-a', regionHash: 'hash-b' });
  assert.equal(result.world.countries.length, 1);
  assert.equal(result.admin1.regions.length, 1);
  assert.deepEqual(result.world.countries[0].point, [4.9, 5.1]);
  assert.deepEqual(result.admin1.regions[0].point, [5, 5.1]);
  assert.deepEqual(Object.keys(result.world.countries[0]).sort(), ['code', 'names', 'point', 'polygons']);
  assert.deepEqual(Object.keys(result.admin1.regions[0]).sort(), ['code', 'countryCode', 'names', 'point', 'polygons']);
  assert.equal(JSON.stringify(result).includes('POP_EST'), false);
  assert.equal(JSON.stringify(result).includes('woe_id'), false);
});

test('map builder normalizes Polygon and MultiPolygon to closed quantized rings', () => {
  const source = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { ISO_A2: 'AA', NAME_EN: 'Aland', LABEL_X: 5, LABEL_Y: 5 },
      geometry: { type: 'MultiPolygon', coordinates: [[square], [[[20, 20], [21, 20], [21, 21], [20, 21], [20, 20]]]] }
    }]
  };
  const result = buildDatasets(source, { type: 'FeatureCollection', features: [] }, { revision: 'abc' });
  const polygons = result.world.countries[0].polygons;
  assert.equal(polygons.length, 2);
  for (const polygon of polygons) {
    for (const ring of polygon) {
      assert.deepEqual(ring[0], ring.at(-1));
      assert.ok(ring.length >= 4);
    }
  }
  assert.deepEqual(result.world.source, {
    dataset: 'Natural Earth',
    revision: 'abc',
    scale: '1:110m',
    publicDomain: true
  });
});

test('map builder nests Taiwan under China as province code 710000', () => {
  const source = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { ISO_A2: 'CN', NAME_EN: "People's Republic of China", NAME_ZH: '中华人民共和国', NAME_JA: '中華人民共和国', LABEL_X: 104, LABEL_Y: 35 },
        geometry: { type: 'Polygon', coordinates: [square] }
      },
      {
        type: 'Feature',
        properties: { ISO_A2: 'TW', NAME_EN: 'Taiwan', NAME_ZH: '台湾', NAME_JA: '台湾', LABEL_X: 121, LABEL_Y: 24 },
        geometry: { type: 'Polygon', coordinates: [[...square].map(([x, y]) => [x + 120, y + 20])] }
      }
    ]
  };

  const result = buildDatasets(source, { type: 'FeatureCollection', features: [] }, { revision: 'abc' });

  assert.deepEqual(result.world.countries.map(country => country.code), ['CN']);
  assert.equal(result.world.countries[0].polygons.length, 2);
  assert.deepEqual(result.admin1.regions[0], {
    code: '710000',
    countryCode: 'CN',
    names: { en: 'Taiwan Province, China', zh: '台湾省', ja: '台湾省' },
    point: [121, 24],
    polygons: result.admin1.regions[0].polygons
  });
  assert.equal(result.admin1.regions[0].polygons.length, 1);
});
