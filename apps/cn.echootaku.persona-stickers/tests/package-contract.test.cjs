const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');

test('declares real layer entries without retired manifest fields', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, '0.3.3');
  assert.match(manifest.description, /Agent.*单张.*表情图片/);
  assert.deepEqual(manifest.permissions, ['ai:image']);
  assert.deepEqual(manifest.ai, {
    protocolVersion: 2,
    operations: ['image'],
    modelTier: 'standard',
    contextSources: [],
    outputFormats: ['image'],
  });
  assert.equal(manifest.core.entry, 'core.js');
  assert.equal(manifest.page.entry, 'page/index.js');
  assert.equal(fs.existsSync(path.join(appRoot, manifest.core.entry)), true);
  assert.equal(fs.existsSync(path.join(appRoot, manifest.page.entry)), true);
  for (const retired of ['main', 'hasPage', 'cssMode', 'pageStyles', 'pageTemplate', 'pageModules']) {
    assert.equal(Object.hasOwn(manifest, retired), false, retired);
  }
});

test('ships three cue modes, one shared priority prompt, one image input, and an accessible result viewer', () => {
  const html = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const zh = JSON.parse(fs.readFileSync(path.join(appRoot, 'i18n', 'zh-CN.json'), 'utf8'));
  const preview = fs.readFileSync(path.join(appRoot, 'preview.html'), 'utf8');
  const modes = [...html.matchAll(/<input[^>]+name="expression-mode"[^>]+value="(emoji|kaomoji|image)"[^>]*>/g)]
    .map((match) => match[1])
    .sort();
  const fileInput = html.match(/<input[^>]+data-file-input[^>]*>/);
  const personaStatus = html.match(/<[^>]+data-persona-status[^>]*>/);
  const personaDetail = html.match(/<[^>]+data-persona-detail[^>]*>/);

  assert.deepEqual(modes, ['emoji', 'image', 'kaomoji']);
  assert.ok(fileInput, 'expression image input is required');
  assert.ok(personaStatus, 'persona status node is required');
  assert.ok(personaDetail, 'persona detail node is required');
  assert.doesNotMatch(personaStatus[0], /data-i18n=/);
  assert.doesNotMatch(personaDetail[0], /data-i18n=/);
  assert.doesNotMatch(fileInput[0], /\bmultiple\b/);
  assert.match(html, /<textarea[^>]+data-user-prompt[^>]+maxlength="800"[^>]*>/);
  assert.match(html, /data-result-viewer[^>]+role="dialog"[^>]+aria-modal="true"/);
  assert.match(html, /data-page-content/);
  assert.match(html, /data-action="open-preview"/);
  assert.match(html, /data-action="download-png"/);
  assert.equal((html.match(/data-download-status/g) || []).length, 2);
  assert.doesNotMatch(html, /data-action="download-svg"/);
  assert.match(html, /制作属于你 Agent 的表情包~/);
  assert.equal(zh.app.subtitle, '制作属于你 Agent 的表情包~');
  assert.match(preview, /制作属于你 Agent 的表情包~/);
  assert.doesNotMatch(html, /recipe-panel|recipe\.title|一张图，两种职责/);
  assert.doesNotMatch(html, /透明背景/);
  assert.doesNotMatch(html, /grid-count|use-result|retry-single/);
});

test('keeps the modal above app chrome and uses neutral dark surfaces without a transparency pattern', () => {
  const css = fs.readFileSync(path.join(appRoot, 'page.css'), 'utf8');

  assert.match(css, /\.result-viewer\s*\{[^}]*z-index:\s*(?:[5-9]\d|[1-9]\d{2,})\b/s);
  assert.doesNotMatch(css, /#(?:151a2a|111625|222941|090c15|101527|0a0d18)\b/i);
  const viewerStage = css.match(/\.result-viewer-stage\s*\{([^}]*)\}/s);
  assert.ok(viewerStage, 'result viewer stage styles are required');
  assert.doesNotMatch(viewerStage[1], /background-image\s*:/);
});

test('uses only the governed file bridge for export and keeps other risky data APIs out', () => {
  const sources = fs.readdirSync(path.join(appRoot, 'page'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => fs.readFileSync(path.join(appRoot, 'page', name), 'utf8'))
    .join('\n');
  assert.equal(/Tapp\.storage|Tapp\.federation|\bfetch\s*\(|createObjectURL|\.download\s*=(?!=)/.test(sources), false);
  assert.match(sources, /tapp\.file\.download/);
});

test('catalog and snapshot describe the single-sticker Agent workflow', () => {
  const catalog = fs.readFileSync(path.join(appRoot, 'catalog.json'), 'utf8');
  const preview = fs.readFileSync(path.join(appRoot, 'preview.html'), 'utf8');

  assert.match(catalog, /Agent/);
  assert.match(catalog, /单张/);
  assert.doesNotMatch(catalog, /宫格|grid|最多 4 张|up to four/);
  assert.match(preview, /Emoji/);
  assert.match(preview, /颜文字/);
  assert.match(preview, /图片表情/);
  assert.match(preview, /高优先级/);
  assert.match(preview, /查看大图/);
  assert.match(preview, /下载 PNG/);
  assert.match(catalog, /高优先级/);
  assert.match(catalog, /下载.*PNG/);
  assert.doesNotMatch(catalog, /透明背景|transparent background|透過背景/i);
  assert.doesNotMatch(preview, /preview-recipe|透明背景|transparent background|透過背景/i);
  assert.doesNotMatch(preview, /宫格|preview-sheet/);
});

test('ships matching zh-CN en-US and ja-JP translation key sets', () => {
  function keys(value, prefix = '') {
    return Object.entries(value).flatMap(([key, child]) => {
      const next = prefix ? `${prefix}.${key}` : key;
      return child && typeof child === 'object' && !Array.isArray(child) ? keys(child, next) : [next];
    }).sort();
  }
  const locales = ['zh-CN', 'en-US', 'ja-JP'].map((locale) =>
    JSON.parse(fs.readFileSync(path.join(appRoot, 'i18n', `${locale}.json`), 'utf8')),
  );
  assert.deepEqual(keys(locales[1]), keys(locales[0]));
  assert.deepEqual(keys(locales[2]), keys(locales[0]));

  for (const locale of locales) {
    assert.equal(typeof locale.mode.image, 'string');
    assert.equal(typeof locale.persona.requiredTitle, 'string');
    assert.equal(typeof locale.output.title, 'string');
    assert.equal(typeof locale.prompt.title, 'string');
    assert.equal(typeof locale.prompt.priority, 'string');
    assert.equal(typeof locale.action.preview, 'string');
    assert.equal(typeof locale.action.downloadPng, 'string');
    assert.equal(typeof locale.result.downloadBoundary, 'string');
    assert.equal(typeof locale.errors.persona, 'string');
    assert.equal(typeof locale.errors.expressionImage, 'string');
    assert.equal(locale.field?.grid, undefined);
    assert.equal(locale.recipe, undefined);
  }
});
