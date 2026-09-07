const test = require('node:test');
const assert = require('node:assert/strict');

const { copyText } = require('../page/clipboard.js');

test('copy falls back to a temporary readonly textarea when the async clipboard is denied', async () => {
  const previous = { focusCalls: 0, focus() { this.focusCalls += 1; } };
  const body = {
    children: [],
    appendChild(node) { this.children.push(node); node.parentNode = this; },
    removeChild(node) { this.children = this.children.filter((item) => item !== node); },
  };
  const area = {
    style: {},
    setAttribute(name, value) { this[name] = value; },
    focus() { this.focused = true; },
    select() { this.selected = true; },
    setSelectionRange(start, end) { this.selection = [start, end]; },
  };
  const document = {
    activeElement: previous,
    body,
    createElement(tag) { assert.equal(tag, 'textarea'); return area; },
    execCommand(command) { assert.equal(command, 'copy'); return true; },
  };
  const navigator = { clipboard: { writeText: async () => { throw new Error('denied'); } } };

  assert.equal(await copyText('https://example.com', { document, navigator }), true);
  assert.equal(area.value, 'https://example.com');
  assert.equal(area.readonly, '');
  assert.equal(area.selected, true);
  assert.deepEqual(body.children, []);
  assert.equal(previous.focusCalls, 1);
});
