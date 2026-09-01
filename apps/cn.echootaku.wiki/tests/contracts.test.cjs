const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');

test('page styling uses the current host theme and safe-area contract', () => {
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');
  for (const variable of [
    '--tapp-safe-inset-top',
    '--tapp-safe-inset-right',
    '--tapp-safe-inset-bottom',
    '--tapp-safe-inset-left',
    '--bg-primary',
    '--text-primary',
    '--text-secondary',
  ]) {
    assert.match(css, new RegExp(variable));
  }
  assert.doesNotMatch(css, /--tapp-safe-area-inset-/);
  assert.doesNotMatch(css, /--tapp-(?:bg|text|danger|primary-contrast)/);
  assert.match(css, /\.dark\s*\{/);
});

test('manifest stays on the current Layer Manifest shape', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.name, 'Wiki');
  assert.equal(manifest.version, '0.1.5');
  assert.equal(manifest.core.entry, 'core.js');
  assert.equal(manifest.page.template, 'page.html');
  assert.equal(manifest.page.styles, 'page.css');
  assert.equal(Object.hasOwn(manifest, 'main'), false);
  assert.equal(Object.hasOwn(manifest, 'hasPage'), false);
});

test('all interface locales expose the same keys and cover literal UI references', () => {
  const locales = ['zh', 'en', 'ja'].map((name) => JSON.parse(
    fs.readFileSync(path.join(appRoot, 'i18n', `${name}.json`), 'utf8')
  ));
  const expected = Object.keys(locales[0]).sort();
  for (const locale of locales.slice(1)) assert.deepEqual(Object.keys(locale).sort(), expected);

  const sources = [
    fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8'),
    fs.readFileSync(path.join(appRoot, 'page', 'index.js'), 'utf8'),
  ].join('\n');
  const required = new Set();
  for (const match of sources.matchAll(/data-i18n(?:-placeholder|-aria)?="([^"]+)"/g)) required.add(match[1]);
  for (const match of sources.matchAll(/\bt\('([^']+)'\)/g)) required.add(match[1]);
  for (const key of required) {
    for (const locale of locales) assert.equal(Object.hasOwn(locale, key), true, `missing i18n key: ${key}`);
  }
});

test('page localization uses only the public Tapp i18n contract', () => {
  const source = fs.readFileSync(path.join(appRoot, 'page', 'index.js'), 'utf8');
  assert.match(source, /Tapp\.i18n\.t/);
  assert.match(source, /Tapp\.i18n\.getLocale/);
  assert.doesNotMatch(source, /_TAPP_I18N/);
});

test('shared management writes are serialized through one page queue', () => {
  const source = fs.readFileSync(path.join(appRoot, 'page', 'index.js'), 'utf8');
  assert.match(source, /function runManagementOperation/);
  assert.match(source, /runManagementOperation\(publishEditor\)/);
  assert.match(source, /runManagementOperation\(deleteEditorArticle\)/);
  assert.match(source, /runManagementOperation\(cleanupOrphans\)/);
  assert.match(source, /runManagementOperation\(function \(\) \{ return importJsonFile\(file\); \}\)/);
});
