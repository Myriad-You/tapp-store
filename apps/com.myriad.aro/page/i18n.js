var share = require('./scope.js');

// i18n — loads from sandbox-injected window._TAPP_I18N
var LANG = window._TAPP_I18N || {};
var lang = LANG.zh || {};
var currentLocale = 'zh';

function setLocale(locale) {
  currentLocale = locale || 'zh';
  var key = currentLocale.startsWith('zh') ? 'zh' : currentLocale.startsWith('ja') ? 'ja' : 'en';
  lang = LANG[key] || LANG.en || {};
}

// ==================== Shared scope ====================
// Republish the names this file's siblings read. See page/scope.js.
share.value({
  setLocale: setLocale,
});
share.live({
  currentLocale: [function () { return currentLocale; }, function (v) { currentLocale = v; }],
  lang: [function () { return lang; }, function (v) { lang = v; }],
});
