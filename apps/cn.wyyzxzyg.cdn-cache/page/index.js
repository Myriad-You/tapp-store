/**
 * CDN 缓存刷新 · Page 入口
 *
 * 只做三件事：取得共享层引擎、挂载管理员界面、订阅生命周期。所有业务逻辑都在
 * core.js（headless 与 Page 共用）与 page/ui.js（纯界面）里。
 *
 * 共享层由宿主在 Page 模式最先执行，因此 `window.CdnCacheCore` 一定已就绪；
 * require 只是让打包器把 core.js 计入 Page 层的依赖图。
 */

'use strict';

require('../core.js');
var uiFactory = require('./ui.js');

var core = window.CdnCacheCore;
var ui = uiFactory.createUi(core);

if (window._TAPP_MODE === 'page' || window._TAPP_HAS_HTML) {
  Tapp.lifecycle.onReady(function () {
    return ui.mount();
  });
}
