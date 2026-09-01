const test = require('node:test');
const assert = require('node:assert/strict');

const { renderMarkdown } = require('../page/renderer.js');
const { parseMarkdown } = require('../page/markdown.js');

class FakeNode {
  constructor(tag, text = '') {
    this.tagName = tag;
    this.textContent = text;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.className = '';
  }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, handler) { this.listeners[name] = handler; }
}

class FakeDocument {
  createElement(tag) { return new FakeNode(tag.toLowerCase()); }
  createTextNode(value) { return new FakeNode('#text', String(value)); }
}

function walk(node, out = []) {
  out.push(node);
  for (const child of node.children || []) walk(child, out);
  return out;
}

test('renderer never creates raw HTML, iframe, object or anchor nodes', () => {
  const document = new FakeDocument();
  const container = new FakeNode('main');
  renderMarkdown(document, container, parseMarkdown('<iframe src="x"></iframe>\n\n[Docs](https://example.com)'));
  const tags = walk(container).map((node) => node.tagName);
  assert.equal(tags.includes('iframe'), false);
  assert.equal(tags.includes('object'), false);
  assert.equal(tags.includes('a'), false);
  assert.match(walk(container).map((node) => node.textContent).join(' '), /<iframe/);
});
test('copy-only external links expose a button and inert URL text', () => {
  const document = new FakeDocument();
  const container = new FakeNode('main');
  renderMarkdown(document, container, parseMarkdown('[Docs](https://example.com/docs)'));
  const nodes = walk(container);
  const button = nodes.find((node) => node.tagName === 'button');
  assert.equal(button.dataset.copyUrl, 'https://example.com/docs');
  assert.equal(nodes.some((node) => node.tagName === 'a'), false);
});

test('video rendering uses controls and metadata preload without autoplay', () => {
  const document = new FakeDocument();
  const container = new FakeNode('main');
  renderMarkdown(document, container, parseMarkdown('![Tour](https://cdn.example/tour.mp4)'));
  const video = walk(container).find((node) => node.tagName === 'video');
  assert.equal(video.attributes.controls, '');
  assert.equal(video.attributes.preload, 'metadata');
  assert.equal(Object.hasOwn(video.attributes, 'autoplay'), false);
});

test('media error swaps the remote element for a readable placeholder and copy action', () => {
  const document = new FakeDocument();
  const container = new FakeNode('main');
  renderMarkdown(document, container, parseMarkdown('![Map](https://cdn.example/map.png)'));
  const image = walk(container).find((node) => node.tagName === 'img');
  image.listeners.error();
  const nodes = walk(container);
  assert.equal(nodes.some((node) => node.tagName === 'img'), false);
  assert.match(nodes.map((node) => node.textContent).join(' '), /Map/);
  assert.equal(nodes.find((node) => node.tagName === 'button').dataset.copyUrl, 'https://cdn.example/map.png');
});
