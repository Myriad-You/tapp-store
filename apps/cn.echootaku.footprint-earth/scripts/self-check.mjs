import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'manifest.json','catalog.json','README.md','main.js','page.html','page.css','preview.html','preview.css',
  'page/entry.js','page/runtime.js','page/view.js','widget/entry.js','widget.css',
  'templates/widget-2x2.html','templates/widget-4x2.html','templates/widget-4x4.html',
  'i18n/zh-CN.json','i18n/en-US.json','i18n/ja-JP.json','assets/world-110m.json','assets/admin1-50m.json'
];
await Promise.all(required.map(file => access(resolve(root, file))));

const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
const catalog = JSON.parse(await readFile(resolve(root, 'catalog.json'), 'utf8'));
assert.equal(manifest.id, 'cn.echootaku.footprint-earth');
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.core.entry, 'main.js');
assert.equal(manifest.page.entry, 'page/entry.js');
assert.equal(manifest.widgets[0].id, 'footprint-globe');
assert.deepEqual(manifest.widgets[0].sizes, ['2x2','4x2','4x4']);
assert.equal(catalog.securityReview, true);
for (const permission of ['storage:read','storage:write','ui:confirm','widget:register','federation:read','federation:room','federation:message']) assert.ok(manifest.permissions.includes(permission));
assert.equal(manifest.permissions.some(permission => permission.startsWith('network:')), false);

const [main, runtime, view, widget, page, styles] = await Promise.all(['main.js','page/runtime.js','page/view.js','widget/entry.js','page.html','page.css'].map(file => readFile(resolve(root, file), 'utf8')));
const code = [main,runtime,view,widget].join('\n');
assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket\s*\(/);
assert.match(code, /footprint-earth\.v1/);
assert.match(runtime, /getRoomMessages/);
assert.match(runtime, /history_incomplete/);
assert.match(runtime, /roomOwnerActor/);
assert.match(view, /runtime\.report/);
assert.match(page, /data-room-feed/);
assert.match(runtime, /shared\.set/);
assert.doesNotMatch(widget, /federation|Room|shared\.set|storage\.set|data:image/i);
assert.match(widget, /assets\.getArrayBuffer/);
assert.match(widget, /GlobeController/);
assert.doesNotMatch(page, /<dialog\b/i);
assert.match(styles, /safe-area-inset/);
assert.match(styles, /prefers-reduced-motion/);

const world = JSON.parse(await readFile(resolve(root, 'assets/world-110m.json'), 'utf8'));
const admin1 = JSON.parse(await readFile(resolve(root, 'assets/admin1-50m.json'), 'utf8'));
assert.equal(world.source.revision, 'ca96624a56bd078437bca8184e78163e5039ad19');
assert.equal(admin1.source.revision, world.source.revision);
assert.equal(world.source.publicDomain, true);
assert.equal(admin1.source.publicDomain, true);
assert.equal(world.countries.length, 174);
assert.equal(admin1.regions.length, 291);
assert.equal(world.countries.some(country => country.code === 'TW'), false);
assert.equal(world.countries.find(country => country.code === 'CN').polygons.some(polygon => polygon.some(ring => ring.some(point => point[0] >= 120 && point[0] <= 122 && point[1] >= 21 && point[1] <= 26))), true);
for (const country of world.countries) {
  assert.match(country.code, /^[A-Z]{2}$/);
  assert.deepEqual(Object.keys(country).sort(), ['code','names','point','polygons']);
}
for (const region of admin1.regions) {
  assert.equal(/^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(region.code) || region.code === '710000', true);
  assert.equal(region.code === '710000' ? region.countryCode === 'CN' : region.code.startsWith(`${region.countryCode}-`), true);
  assert.deepEqual(Object.keys(region).sort(), ['code','countryCode','names','point','polygons']);
}
assert.deepEqual(admin1.regions.find(region => region.code === '710000')?.names, { en: 'Taiwan Province, China', zh: '台湾省', ja: '台湾省' });
const serializedAssets = JSON.stringify({ world, admin1 });
for (const forbiddenKey of ['latitude','longitude','POP_EST','woe_id','actor','messageId','createdAt']) assert.equal(serializedAssets.includes(`"${forbiddenKey}"`), false);

const locales = await Promise.all(['zh-CN','en-US','ja-JP'].map(locale => readFile(resolve(root, `i18n/${locale}.json`), 'utf8').then(JSON.parse)));
const referenceKeys = Object.keys(locales[0]).sort();
for (const locale of locales.slice(1)) assert.deepEqual(Object.keys(locale).sort(), referenceKeys);
for (const file of required) assert.ok((await stat(resolve(root, file))).size < 1024 * 1024, `${file} exceeds the per-file review limit`);

console.log(`footprint-earth self-check passed (${world.countries.length} countries, ${admin1.regions.length} regions, ${referenceKeys.length} i18n keys)`);
