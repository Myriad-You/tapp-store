require('../main.js');
require('./editor.js');
require('./runtime.js');

(function () {
  'use strict';
  var runtime = new globalThis.SignatureBoardRuntime();
  runtime.start();
  if (globalThis.Tapp && Tapp.lifecycle) {
    Tapp.lifecycle.onDestroy(function () {
      [runtime.unsubscribeMessage, runtime.unsubscribeRoom, runtime.unsubscribeShared].forEach(function (unsubscribe) {
        if (typeof unsubscribe === 'function') unsubscribe();
      });
      if (runtime.editor && runtime.editor.resizeObserver) runtime.editor.resizeObserver.disconnect();
    });
  }
})();
