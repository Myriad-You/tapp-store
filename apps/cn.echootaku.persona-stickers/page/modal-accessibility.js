'use strict';

function hideBackground(element) {
  if (!element) return;
  element.inert = true;
  element.setAttribute('aria-hidden', 'true');
}

function showBackground(element) {
  if (!element) return;
  element.inert = false;
  element.removeAttribute('aria-hidden');
}

module.exports = { hideBackground: hideBackground, showBackground: showBackground };
