const test = require('node:test');
const assert = require('node:assert/strict');

const modalAccessibility = require('../page/modal-accessibility.js');

function fakeElement() {
  const attributes = new Map();
  return {
    inert: false,
    setAttribute(name, value) { attributes.set(name, String(value)); },
    removeAttribute(name) { attributes.delete(name); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
  };
}

test('opening a modal removes background content from pointer, focus and accessibility navigation', () => {
  const background = fakeElement();

  modalAccessibility.hideBackground(background);

  assert.equal(background.inert, true);
  assert.equal(background.getAttribute('aria-hidden'), 'true');
});

test('closing a modal restores background content to pointer, focus and accessibility navigation', () => {
  const background = fakeElement();
  modalAccessibility.hideBackground(background);

  modalAccessibility.showBackground(background);

  assert.equal(background.inert, false);
  assert.equal(background.getAttribute('aria-hidden'), null);
});
