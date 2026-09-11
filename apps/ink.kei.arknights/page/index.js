// ========================================
// Page 入口（路由 + 生命周期 + 依赖加载）
// ========================================

var core = require('../core.js');

// 加载页面模块（IIFE 模式，执行后挂载到全局）
require('./ui-assets.js');
require('./ui-dialog.js');
require('./view-home.js');
require('./view-player-list.js');
require('./view-add-player.js');
require('./view-collection.js');
require('./view-debug.js');

(function () {
  var currentTheme = 'light';

  // ========================================
  // View Router / 视图路由
  // ========================================

  var VIEW_NAMES = ['home', 'debug', 'collection', 'playerList', 'addPlayer'];
  var DEFAULT_VIEW = 'home';

  function navigate(name) {
    if (VIEW_NAMES.indexOf(name) === -1) name = DEFAULT_VIEW;
    if ((name === 'debug' || name === 'addPlayer') && !window.__arkIsAdmin) return;

    var container = document.getElementById('tapp-content');
    if (!container) return;

    var views = container.querySelectorAll('[data-view]');
    var target = null;
    for (var i = 0; i < views.length; i++) {
      var isTarget = views[i].getAttribute('data-view') === name;
      views[i].hidden = !isTarget;
      if (isTarget) target = views[i];
    }

    // 视图切换入场动画（重复进入同一视图也重放）
    if (target) {
      target.classList.remove('ark-view-enter');
      void target.offsetWidth;
      target.classList.add('ark-view-enter');
    }

    var pages = (typeof Tapp !== 'undefined' && Tapp.pages) || {};
    var page = pages[name];
    if (page && typeof page.render === 'function') {
      page.render(container);
    }
  }

  // 供各视图程序化跳转（如主页无数据时跳转添加玩家页）
  window.__arkNavigate = navigate;

  function closestByAttr(el, selector) {
    var node = el;
    while (node && node !== document) {
      if (node.matches && node.matches(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  // ========================================
  // Lifecycle / 生命周期
  // ========================================

  Tapp.lifecycle.onReady(async function () {
    var container = document.getElementById('tapp-content');

    try {
      window.__arkIsAdmin = await Tapp.user.isAdmin();
    } catch (e) {
      window.__arkIsAdmin = false;
    }

    if (container) {
      core.applyI18n(container);
      container.addEventListener('click', function (e) {
        var trigger = e.target && (e.target.closest ? e.target.closest('[data-nav]') : closestByAttr(e.target, '[data-nav]'));
        if (trigger) {
          navigate(trigger.getAttribute('data-nav'));
        }
      });
      navigate(DEFAULT_VIEW);
    }

    try {
      var theme = await Tapp.ui.getTheme();
      currentTheme = theme === 'dark' ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', currentTheme === 'dark');
    } catch (e) {}

    try {
      Tapp.ui.onThemeChange(function (newTheme) {
        currentTheme = newTheme === 'dark' ? 'dark' : 'light';
        document.documentElement.classList.toggle('dark', currentTheme === 'dark');
      });
    } catch (e) {}

    // 加载页面遮罩（仅暗色）与装饰纹样（亮/暗平铺）资源
    try {
      var mask = await Tapp.assets.getUrl('assets/decoration/page_mask_dark.png');
      if (mask && mask.url) {
        document.documentElement.style.setProperty('--page-mask', 'url("' + mask.url + '")');
      }
    } catch (e) {}

    try {
      var decorator = await Tapp.assets.getUrl('assets/decoration/decorator_dark.png');
      if (decorator && decorator.url) {
        document.documentElement.style.setProperty('--page-decorator', 'url("' + decorator.url + '")');
      }
    } catch (e) {}

    // 后台预热 assets（不阻塞 UI），后续渲染时直接复用已加载结果
    var arkAssets = window.__arkAssets;
    if (arkAssets && typeof arkAssets.loadAssets === 'function') {
      arkAssets.loadAssets().catch(function () {});
    }
  });
})();
