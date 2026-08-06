(function (root) {
  'use strict';
  const DDZ = root.DDZ = root.DDZ || {};

  function t(key, params) {
    try {
      if (typeof Tapp !== 'undefined' && Tapp.i18n && typeof Tapp.i18n.t === 'function') return Tapp.i18n.t(key, params || {});
    } catch (_) { /* Host translations are optional in the local test harness. */ }
    return key;
  }

  function playerName(player) { return t('player.' + player.id); }
  function patternName(pattern) { return pattern ? t('pattern.' + pattern.type) : ''; }
  function message(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const params = Object.assign({}, value.params || {});
    if (params.name) params.name = t('player.' + params.name);
    if (params.action) params.action = t(params.action);
    if (params.pattern) params.pattern = t('pattern.' + params.pattern);
    return t(value.key, params);
  }

  function applyStatic(rootNode) {
    const scope = rootNode || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (node) { node.textContent = t(node.dataset.i18n); });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach(function (node) { node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel)); });
  }

  DDZ.t = t;
  DDZ.playerName = playerName;
  DDZ.patternName = patternName;
  DDZ.message = message;
  DDZ.applyStaticI18n = applyStatic;
})(globalThis);
