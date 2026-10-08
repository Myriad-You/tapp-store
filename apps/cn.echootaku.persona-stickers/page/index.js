'use strict';

var lifecycle = require('./lifecycle.js');
var domApp = require('./dom-app.js');

lifecycle.registerLifecycle(Tapp, function () {
  return domApp.createDomApp({ Tapp: Tapp, document: document });
});
