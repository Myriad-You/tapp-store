'use strict';

async function copyText(value, environment) {
  environment = environment || {};
  var navigatorObject = environment.navigator;
  var documentObject = environment.document;
  var text = String(value == null ? '' : value);

  try {
    if (navigatorObject && navigatorObject.clipboard && typeof navigatorObject.clipboard.writeText === 'function') {
      await navigatorObject.clipboard.writeText(text);
      return true;
    }
  } catch (_error) {}

  if (!documentObject || !documentObject.body || typeof documentObject.createElement !== 'function') return false;
  var previousFocus = documentObject.activeElement;
  var area = documentObject.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('tabindex', '-1');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  area.style.opacity = '0';
  documentObject.body.appendChild(area);
  try {
    area.focus();
    area.select();
    if (typeof area.setSelectionRange === 'function') area.setSelectionRange(0, text.length);
    return typeof documentObject.execCommand === 'function' && documentObject.execCommand('copy') === true;
  } catch (_error) {
    return false;
  } finally {
    if (area.parentNode) area.parentNode.removeChild(area);
    try {
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    } catch (_error) {}
  }
}

module.exports = { copyText };
