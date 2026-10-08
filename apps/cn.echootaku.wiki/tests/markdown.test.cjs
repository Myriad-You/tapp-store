const test = require('node:test');
const assert = require('node:assert/strict');

const { parseMarkdown } = require('../page/markdown.js');

function allNodes(tree) {
  const out = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    out.push(value);
    for (const child of value.children || []) visit(child);
  }
  visit(tree);
  return out;
}

test('raw HTML stays text and never becomes an executable node', () => {
  const tree = parseMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
  const nodes = allNodes(tree);
  assert.equal(nodes.some((node) => node.type === 'html'), false);
  assert.match(nodes.map((node) => node.value || '').join(' '), /<script>/);
});
test('javascript and data links are rendered as inert text', () => {
  const tree = parseMarkdown('[run](javascript:alert(1)) [payload](data:text/html,boom)');
  const nodes = allNodes(tree);
  assert.equal(nodes.some((node) => node.type === 'external-link'), false);
  assert.match(nodes.map((node) => node.value || '').join(' '), /run/);
});

test('HTTPS links become copy-only link nodes', () => {
  const tree = parseMarkdown('[Official docs](https://example.com/docs)');
  const link = allNodes(tree).find((node) => node.type === 'external-link');
  assert.deepEqual(link, {
    type: 'external-link',
    label: 'Official docs',
    url: 'https://example.com/docs',
  });
});

test('HTTPS image and video markdown become typed media nodes', () => {
  const tree = parseMarkdown('![Map](https://cdn.example/map.png)\n\n![Tour](https://cdn.example/tour.webm)');
  const media = allNodes(tree).filter((node) => node.type === 'media');
  assert.deepEqual(media.map(({ kind, alt }) => ({ kind, alt })), [
    { kind: 'image', alt: 'Map' },
    { kind: 'video', alt: 'Tour' },
  ]);
});

test('non-HTTPS media markdown remains readable fallback text', () => {
  const tree = parseMarkdown('![Unsafe](http://cdn.example/map.png)');
  const nodes = allNodes(tree);
  assert.equal(nodes.some((node) => node.type === 'media'), false);
  assert.match(nodes.map((node) => node.value || '').join(' '), /Unsafe/);
});

test('headings, lists, quotes and fenced code keep semantic structure', () => {
  const tree = parseMarkdown('# Title\n\n- One\n- Two\n\n> Note\n\n```js\nconst x = 1;\n```');
  assert.deepEqual(allNodes(tree).map((node) => node.type), [
    'document', 'heading', 'text', 'list', 'list-item', 'text', 'list-item', 'text',
    'blockquote', 'text', 'code',
  ]);
});
