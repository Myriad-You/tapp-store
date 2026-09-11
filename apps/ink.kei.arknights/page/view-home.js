// ========================================
// Home Page
// ========================================

(function () {
  var core = require('../core.js');
  var state = {
    currentUid: ''
  };

  function navigate(name) {
    if (typeof window.__arkNavigate === 'function') window.__arkNavigate(name);
  }

  function render(container) {
    var homeSection = container.querySelector('[data-view="home"]');
    if (!homeSection) return;
    homeSection.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.setAttribute('class', 'ark-page-inner');
    homeSection.appendChild(wrap);

    var loading = document.createElement('div');
    loading.setAttribute('class', 'ark-page-loading');
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-label', core.t('home.loading'));

    var loader = document.createElement('div');
    loader.setAttribute('class', 'ark-page-loader');

    var spinner = document.createElement('div');
    spinner.setAttribute('class', 'ak-loading');
    spinner.setAttribute('style', '--ak-loading-size:28px;--ak-loading-border:4px;');

    var loaderLabel = document.createElement('div');
    loaderLabel.setAttribute('class', 'ark-page-loader__label');
    loaderLabel.textContent = core.t('home.loading');

    var loaderBar = document.createElement('div');
    loaderBar.setAttribute('class', 'ark-page-loader__bar');

    loader.appendChild(spinner);
    loader.appendChild(loaderLabel);
    loader.appendChild(loaderBar);
    loading.appendChild(loader);
    homeSection.appendChild(loading);

    var navRow = document.createElement('div');
    navRow.setAttribute('class', 'ark-page-nav');
    navRow.setAttribute('style', 'display:flex;align-items:center;justify-content:space-between;gap:8px;');

    var title = document.createElement('h1');
    title.setAttribute('class', 'ark-page-title');
    title.setAttribute('style', 'font-size:20px;font-weight:600;margin:0;color:var(--ark-text);');
    title.textContent = core.t('title');
    navRow.appendChild(title);

    var btnGroup = document.createElement('div');
    btnGroup.setAttribute('style', 'display:flex;align-items:center;gap:8px;');

    var refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.setAttribute('class', 'ak-button ak-button--fab ak-fx--skew-left ark-refresh-btn');
    refreshBtn.setAttribute('data-refresh-btn', '1');
    refreshBtn.setAttribute('aria-label', core.t('home.refresh'));
    refreshBtn.setAttribute('title', core.t('home.refresh'));
    refreshBtn.innerHTML =
      '<svg class="ak-fx--skew-right" data-refresh-icon aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<polyline points="23 4 23 10 17 10"></polyline>' +
        '<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>' +
      '</svg>';
    refreshBtn.addEventListener('click', function () {
      refreshCurrent(wrap, refreshBtn);
    });
    if (window.__arkIsAdmin) {
      btnGroup.appendChild(refreshBtn);
    }

    var listBtn = document.createElement('button');
    listBtn.type = 'button';
    listBtn.setAttribute('class', 'ak-button ak-button--fab ak-fx--skew-left');
    listBtn.setAttribute('data-nav', 'playerList');
    listBtn.setAttribute('aria-label', core.t('home.playerList'));
    listBtn.setAttribute('title', core.t('home.playerList'));
    listBtn.innerHTML =
      '<svg class="ak-fx--skew-right" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<line x1="8" y1="6" x2="21" y2="6"></line>' +
        '<line x1="8" y1="12" x2="21" y2="12"></line>' +
        '<line x1="8" y1="18" x2="21" y2="18"></line>' +
        '<line x1="3" y1="6" x2="3.01" y2="6"></line>' +
        '<line x1="3" y1="12" x2="3.01" y2="12"></line>' +
        '<line x1="3" y1="18" x2="3.01" y2="18"></line>' +
      '</svg>';
    btnGroup.appendChild(listBtn);

    navRow.appendChild(btnGroup);
    wrap.appendChild(navRow);

    buildDisplay(wrap);

    // 页脚：debug 按钮（仅管理员，位于版权文字上方）+ 名称版本 + 版权说明
    var footer = document.createElement('footer');
    footer.setAttribute('class', 'ark-app-footer');

    if (window.__arkIsAdmin) {
      var debugLink = document.createElement('button');
      debugLink.type = 'button';
      debugLink.textContent = 'Debug';
      debugLink.setAttribute('data-nav', 'debug');
      debugLink.setAttribute(
        'style',
        'padding:2px 8px;font-size:10px;color:var(--ark-text-dim);background:transparent;' +
          'border:none;cursor:pointer;'
      );
      footer.appendChild(debugLink);
    }

    var verLine = document.createElement('div');
    var copyLine = document.createElement('div');
    copyLine.textContent = core.t('footer.copyright');
    footer.appendChild(verLine);
    footer.appendChild(copyLine);
    wrap.appendChild(footer);

    try {
      var info = Tapp.lifecycle.getInfo();
      verLine.textContent = core.t('title') + ' · v' + (info && info.version ? info.version : '');
    } catch (e) {}

    initView(wrap);
  }

  async function initView(wrap) {
    var loading = wrap.parentNode.querySelector('.ark-page-loading');
    try {
      // isAdmin 已在 index.js onReady 取得，直接用缓存值，省一次权限查询
      var admin = !!window.__arkIsAdmin;
      // lastViewed 与玩家列表并行读取
      var lastP = core.getLastViewedUid();
      var map = await core.getPlayerMap();
      if (!map || !Object.keys(map).length) {
        if (admin) navigate('addPlayer');
        else showNoData(wrap);
      } else {
        var lastUid = await lastP;
        var entry = core.pickPlayerEntry(map, lastUid);
        await showPlayer(wrap, entry);
      }
    } finally {
      if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
    }
  }

  function showPage(wrap, name) {
    var pages = {
      display: wrap.querySelector('[data-page="display"]')
    };
    for (var key in pages) {
      if (pages[key]) pages[key].style.display = key === name ? 'flex' : 'none';
    }
    var refreshBtn = wrap.querySelector('[data-refresh-btn]');
    if (refreshBtn) refreshBtn.style.display = name === 'display' ? '' : 'none';
  }

  function formatDateTime(ts) {
    var d = new Date(Number(ts));
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + hh + ':' + mm;
  }

  function updateRefreshTime(wrap, entry) {
    var el = wrap.querySelector('[data-refresh-time]');
    if (!el) return;
    var ts = entry && entry.lastUpdate ? entry.lastUpdate : core.getDataUpdateTs(entry && entry.uid);
    el.textContent = ts ? core.t('home.refreshTime') + ' ' + formatDateTime(ts) : '';
  }

  // 展示指定玩家：写入当前展示缓存 + 记录 lastViewed
  async function showPlayer(wrap, entry) {
    if (!entry) {
      navigate('addPlayer');
      return;
    }
    state.currentUid = entry.uid;
    core.setActivePlayer(entry.uid, entry.playerdata || null);
    await core.setLastViewedUid(entry.uid);
    updateRefreshTime(wrap, entry);
    showPage(wrap, 'display');
    renderDisplay(wrap, entry.uid);
  }

  // 非管理员：无公开数据时居中提示
  function showNoData(wrap) {
    var page = wrap.querySelector('[data-page="display"]');
    var content = page.querySelector('[data-display-content]');
    if (content) {
      content.innerHTML = '';
      var box = document.createElement('div');
      box.setAttribute('class', 'ark-no-data');
      box.textContent = core.t('home.noPlayerData');
      content.appendChild(box);
    }
    var rt = wrap.querySelector('[data-refresh-time]');
    if (rt) rt.textContent = '';
    showPage(wrap, 'display');
  }

  async function getStoredToken() {
    var token = '';
    try { token = String((await Tapp.storage.get('hgToken')) || ''); } catch (e) {}
    return token || '';
  }

  // 刷新中状态：按钮图标旋转 + 展示区顶部扫描条
  function setRefreshing(wrap, btn, on) {
    var page = wrap.querySelector('[data-page="display"]');
    if (page) page.classList.toggle('ark-refreshing', !!on);
    if (!btn) return;
    btn.disabled = !!on;
    if (on) btn.setAttribute('aria-busy', 'true');
    else btn.removeAttribute('aria-busy');
  }

  // 刷新当前浏览玩家；仅 token 失效才回登录页
  async function refreshCurrent(wrap, btn) {
    var uid = state.currentUid;
    if (!uid) { initView(wrap); return; }

    var hgToken = await getStoredToken();
    if (!hgToken) { navigate('addPlayer'); return; }

    setRefreshing(wrap, btn, true);
    try {
      // 名称 / 区服沿用当前展示缓存，省一次玩家列表读取
      var prev = core.getPlayerData(uid) || {};
      var prevData = prev.data || {};
      var info = await core.skland.getPlayerInfo(uid, hgToken);
      var record = {
        ts: Date.now(),
        data: {
          uid: uid,
          nickName: prevData.nickName || '',
          channelName: prevData.channelName || '',
          player: (info && info.data) || null
        }
      };
      var entry = await core.updatePlayerData(uid, record);
      await showPlayer(wrap, entry || { uid: uid, playerdata: record, lastUpdate: record.ts });
    } catch (e) {
      if (e && e.authError) {
        navigate('addPlayer');
      } else {
        showError(wrap.querySelector('[data-page="display"]'), String((e && e.message) || e));
      }
    } finally {
      setRefreshing(wrap, btn, false);
    }
  }

  // ==================== Display · 展示页 ====================

  function buildDisplay(wrap) {
    var page = document.createElement('div');
    page.setAttribute('data-page', 'display');
    page.setAttribute('style', 'margin-top:20px;display:flex;flex-direction:column;');

    var divider = document.createElement('div');
    divider.setAttribute('class', 'ak-divider');
    var dividerText = document.createElement('span');
    dividerText.setAttribute('data-refresh-time', '1');
    divider.appendChild(dividerText);
    page.appendChild(divider);

    var content = document.createElement('div');
    content.setAttribute('data-display-content', '1');
    content.setAttribute('style', 'flex:1;');
    page.appendChild(content);

    wrap.appendChild(page);
  }

  async function renderDisplay(wrap, uid) {
    // console.debug("rending Display part")
    var page = wrap.querySelector('[data-page="display"]');
    var content = page.querySelector('[data-display-content]');
    if (!content) return;
    content.innerHTML = '';

    var status = core.getPlayerStatus(uid);

    var nameRow = document.createElement('div');
    nameRow.setAttribute('class', 'ark-player-header');
    nameRow.setAttribute('style', 'display:flex;align-items:flex-start;gap:16px;margin-bottom:16px;');

    if (status && status.avatar && core.isHttpsUrl(status.avatar.url)) {
      var avatarBox = document.createElement('div');
      avatarBox.setAttribute('style', 'position:relative;width:var(--player-avatar);height:var(--player-avatar);flex-shrink:0;');

      var avatarImg = document.createElement('img');
      avatarImg.referrerPolicy = 'no-referrer';
      avatarImg.setAttribute(
        'style',
        'width:var(--player-avatar);height:var(--player-avatar);border:2px solid #fff;box-sizing:border-box;background:#000;' +
          'display:block;opacity:0;transition:opacity 0.25s ease;'
      );
      avatarImg.onload = function () {
        avatarImg.style.opacity = '1';
        var s = avatarBox.querySelector('.ak-loading');
        if (s && s.parentNode) s.parentNode.remove();
      };
      avatarImg.onerror = function () {
        var s = avatarBox.querySelector('.ak-loading');
        if (s && s.parentNode) s.parentNode.remove();
      };
      avatarBox.appendChild(avatarImg);
      avatarBox.appendChild(makeSpinner(16));

      if (status.level !== undefined) {
        var lvCircle = document.createElement('div');
        lvCircle.setAttribute(
          'style',
          'position:absolute;top:0;right:0;width:calc(var(--player-avatar) * 0.4375);height:calc(var(--player-avatar) * 0.4375);' +
            'border:2px solid var(--ak-color-yellow);border-radius:50%;transform:translate(50%,-50%);' +
            'background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;' +
            'font-size:calc(var(--player-avatar) * 0.1875);font-weight:600;color:#fff;'
        );
        lvCircle.textContent = String(status.level);
        avatarBox.appendChild(lvCircle);
      }

      nameRow.appendChild(avatarBox);
      avatarImg.src = status.avatar.url;
    }

    var nameBox = document.createElement('div');
    nameBox.setAttribute('style', 'display:flex;flex-direction:column;gap:4px;');

    var name = document.createElement('div');
    name.setAttribute('style', 'font-size:16px;font-weight:600;color:var(--ark-text);');
    name.textContent = status && status.name;
    nameBox.appendChild(name);

    if (status && status.registerTs) {
      var enrollRow = document.createElement('div');
      enrollRow.setAttribute('style', 'display:flex;align-items:center;gap:0;');

      var enrollLabel = document.createElement('span');
      enrollLabel.setAttribute('style', 'font-size:12px;font-weight:700;color:var(--ak-color-black);background:var(--ak-color-blue);padding:0 4px;');
      enrollLabel.textContent = core.t('home.enroll');

      var enrollDate = document.createElement('span');
      enrollDate.setAttribute(
        'style',
        'font-size:12px;font-weight:700;color:var(--ak-color-black);background:var(--ak-color-white);padding:0 4px;'
      );
      enrollDate.textContent = formatRegisterTs(status.registerTs);

      enrollRow.appendChild(enrollLabel);
      enrollRow.appendChild(enrollDate);
      nameBox.appendChild(enrollRow);
    }

    nameRow.appendChild(nameBox);
    content.appendChild(nameRow);

    var assists = core.getPlayerAssistChars(uid);
    var assets = window.__arkAssets;

    if (!assets) {
      content.appendChild(buildLoadFail(new Error('assets module not loaded')));
      return;
    }

    var layout = document.createElement('div');
    layout.setAttribute('class', 'ark-display-layout');

    var gameDataCard = assets.buildGameDataCard(uid);

    var rightCol = document.createElement('div');
    rightCol.setAttribute('class', 'ark-display-right');
    rightCol.appendChild(gameDataCard);

    var leftCol = document.createElement('div');
    leftCol.setAttribute('class', 'ark-display-left');

    // 有图像的资源使用placeHolder占位
    var infoPlaceholder = makeSpinnerBox();
    leftCol.appendChild(infoPlaceholder);

    var assistPlaceholder = makeSpinnerBox();
    leftCol.appendChild(assistPlaceholder);

    var myCharsPlaceholder = makeSpinnerBox();
    leftCol.appendChild(myCharsPlaceholder);

    var spacer = assets.buildSpacer();
    leftCol.appendChild(spacer);

    // 双列模式下，条纹空白卡片高度低于 14px 时隐藏，避免底部出现细线；
    // 单列模式由 styles.css 的 .ark-home-spacer 媒体查询直接 display:none
    function syncSpacer() {
      spacer.style.opacity = spacer.offsetHeight < 14 ? '0' : '';
    }

    if (typeof ResizeObserver !== 'undefined') {
      var spacerObserver = new ResizeObserver(syncSpacer);
      spacerObserver.observe(spacer);
    } else {
      syncSpacer();
    }

    layout.appendChild(leftCol);
    layout.appendChild(rightCol);
    content.appendChild(layout);

    assets.loadAssets().then(function () {
    // assets.setCharInfoMap(player.charInfoMap);
    infoPlaceholder.replaceWith(assets.buildPlayerInfoCard(uid));
    assistPlaceholder.replaceWith(assets.buildAssistUnit(assists, uid));
    myCharsPlaceholder.replaceWith(assets.buildMyChars(core.getPlayerChars(uid), core.getCharInfoMap(uid), uid));
    }).catch(function (error) {
      console.error('加载资源失败:', error);

      var fail = buildLoadFail(error);

      if (infoPlaceholder.parentNode) infoPlaceholder.remove();
      assistPlaceholder.replaceWith(fail);
      myCharsPlaceholder.replaceWith(fail.cloneNode(true));
    });
  }

  // ==================== 共用 ====================

  // 资源加载失败提示（含 retry）
  function buildLoadFail(error) {
    var fail = document.createElement('div');
    fail.setAttribute('style', 'font-size:11px;color:var(--ark-text-dim);padding:16px;text-align:center;');

    var errorMsg = (error && error.message) || core.t('home.loadFail');
    fail.textContent = core.t('home.loadFail') + ' (' + errorMsg + ')';

    var retryBtn = document.createElement('button');
    retryBtn.textContent = 'retry';
    retryBtn.setAttribute('style', 'margin-top:8px;padding:4px 12px;cursor:pointer;');
    retryBtn.onclick = function () {
      location.reload();
    };
    fail.appendChild(retryBtn);

    return fail;
  }

  function makeSpinner(size) {
    var holder = document.createElement('div');
    holder.setAttribute(
      'style',
      'position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;'
    );
    var spinner = document.createElement('div');
    spinner.setAttribute('class', 'ak-loading');
    if (size) {
      spinner.setAttribute('style', '--ak-loading-size:' + size + 'px;--ak-loading-border:3px;');
    }
    holder.appendChild(spinner);
    return holder;
  }

  function makeSpinnerBox() {
    var holder = document.createElement('div');
    holder.setAttribute('class', 'ark-spinner-box');
    var spinner = document.createElement('div');
    spinner.setAttribute('class', 'ak-loading');
    holder.appendChild(spinner);
    return holder;
  }

  function formatRegisterTs(ts) {
    var d = new Date(Number(ts) * 1000);
    if (isNaN(d.getTime())) return String(ts);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function showError(step, msg) {
    var old = step.querySelector('[data-step-error]');
    if (old) old.remove();
    var err = document.createElement('div');
    err.setAttribute('data-step-error', '1');
    err.setAttribute('style', 'margin-top:8px;font-size:12px;color:var(--ak-signal-danger);');
    err.textContent = msg;
    step.appendChild(err);
  }

  Tapp.pages['home'] = {
    render: render
  };
})();
