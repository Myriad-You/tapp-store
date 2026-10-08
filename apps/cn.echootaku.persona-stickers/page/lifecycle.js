'use strict';

function registerLifecycle(tapp, createApp) {
  var app = null;
  var mounted = false;
  var destroyed = false;

  tapp.lifecycle.onReady(async function () {
    if (destroyed || mounted) return;
    mounted = true;
    app = createApp();
    await app.mount();
  });
  tapp.lifecycle.onPause(function () {
    if (!destroyed && app && typeof app.pause === 'function') app.pause();
  });
  tapp.lifecycle.onResume(function () {
    if (!destroyed && app && typeof app.resume === 'function') app.resume();
  });
  tapp.lifecycle.onDestroy(function () {
    if (destroyed) return;
    destroyed = true;
    if (app && typeof app.destroy === 'function') app.destroy();
    app = null;
  });
}

module.exports = { registerLifecycle: registerLifecycle };
