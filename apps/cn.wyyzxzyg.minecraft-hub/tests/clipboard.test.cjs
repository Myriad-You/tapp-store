const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function makeDocument(copySucceeds) {
  const body = { children: [], appendChild(node) { this.children.push(node); node.remove = () => { this.children = this.children.filter((item) => item !== node); }; } };
  return {
    body,
    createElement(tag) { return { tag, children: [], style: {}, appendChild(node) { this.children.push(node); }, focus() {}, select() {}, setAttribute() {} }; },
    getElementById(id) { return body.children.find((item) => item.id === id) || null; },
    execCommand(command) { assert.equal(command, 'copy'); return copySucceeds; },
  };
}

test('copy handles a denied clipboard without an unhandled rejection', async () => {
  const document = makeDocument(false);
  const sandbox = { document, navigator: { clipboard: { writeText() { throw Error('blocked'); } } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../core.js'), 'utf8'), sandbox);
  assert.equal(await sandbox.MinecraftHub.copyText('069a79f4-44e9-4726-a5be-fca90e38aaf5'), false);
  const overlay = document.getElementById('mc-manual-copy');
  assert.ok(overlay);
  assert.equal(overlay.children[0].children[1].value, '069a79f4-44e9-4726-a5be-fca90e38aaf5');
});

test('successful copy does not show the manual fallback', async () => {
  const document = makeDocument(true);
  const sandbox = { document };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../core.js'), 'utf8'), sandbox);
  assert.equal(await sandbox.MinecraftHub.copyText('example'), true);
  assert.equal(document.getElementById('mc-manual-copy'), null);
});
