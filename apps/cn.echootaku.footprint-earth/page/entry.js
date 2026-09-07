require("../main.js");
require("./runtime.js");
require("./view.js");

(function (root) {
  "use strict";
  var view = null;
  var runtime = null;
  var started = false;
  var destroyed = false;

  function start() {
    if (started || destroyed) return;
    started = true;
    view = new root.FootprintEarthDomView();
    runtime = new root.FootprintEarthRuntimeModule.Runtime({ tapp: root.Tapp, view: view });
    view.bindRuntime(runtime);
    runtime.start().catch(function (error) { view.error(error); });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (runtime) runtime.destroy();
    if (view) view.destroy();
    runtime = null;
    view = null;
  }

  var lifecycle = root.Tapp && root.Tapp.lifecycle;
  if (lifecycle) {
    if (lifecycle.onReady) lifecycle.onReady(start);
    else start();
    if (lifecycle.onPause) lifecycle.onPause(function () { if (view) view.pause(); });
    if (lifecycle.onResume) lifecycle.onResume(function () { if (view) view.resume(); });
    if (lifecycle.onDestroy) lifecycle.onDestroy(destroy);
  } else {
    start();
  }
})(globalThis);
