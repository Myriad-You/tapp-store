// ========================================
// Home Page
// ========================================

(function () {
  var core = require('../core.js');
  var PLAYER_DATA_KEY = 'arknights.player';
  var state = {
    credToken: '',
    binds: []
  };

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
    loading.innerHTML = '<div class="ak-loading" style="--ak-loading-color:var(--ak-text-primary);"></div>';
    homeSection.appendChild(loading);

    var navRow = document.createElement('div');
    navRow.setAttribute('class', 'ark-page-nav');
    navRow.setAttribute('style', 'display:flex;align-items:center;justify-content:space-between;');

    var title = document.createElement('h1');
    title.setAttribute('class', 'ark-page-title');
    title.setAttribute('style', 'font-size:20px;font-weight:600;margin:0;color:var(--ark-text);');
    title.textContent = core.t('title');
    navRow.appendChild(title);

    var refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.setAttribute('class', 'ak-button ak-button--fab ak-fx--skew-left');
    refreshBtn.setAttribute('data-refresh-btn', '1');
    refreshBtn.setAttribute('aria-label', core.t('home.refresh'));
    refreshBtn.setAttribute('title', core.t('home.refresh'));
    refreshBtn.innerHTML =
      '<svg class="ak-fx--skew-right" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<polyline points="23 4 23 10 17 10"></polyline>' +
        '<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>' +
      '</svg>';
    refreshBtn.addEventListener('click', function () {
      showPage(wrap, 'step1');
    });
    if (window.__arkIsAdmin) {
      navRow.appendChild(refreshBtn);
    }

    wrap.appendChild(navRow);

    buildStep1(wrap);
    buildStep2(wrap);
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
    var stored = null;
    try {
      stored = await Tapp.shared.get(PLAYER_DATA_KEY);
    } catch (e) {}

    updateRefreshTime(wrap, stored);

    if (stored && stored.data && stored.data.player) {
      showPage(wrap, 'display');
      renderDisplay(wrap, stored.data);
    } else {
      showPage(wrap, 'step1');
    }

    var loading = wrap.parentNode.querySelector('.ark-page-loading');
    if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
  }

  function showPage(wrap, name) {
    var pages = {
      step1: wrap.querySelector('[data-page="step1"]'),
      step2: wrap.querySelector('[data-page="step2"]'),
      display: wrap.querySelector('[data-page="display"]')
    };
    for (var key in pages) {
      if (pages[key]) pages[key].style.display = key === name ? (key === 'display' ? 'flex' : 'block') : 'none';
    }
    var refreshBtn = wrap.querySelector('[data-refresh-btn]');
    if (refreshBtn) refreshBtn.style.display = name === 'display' ? '' : 'none';
  }

  function makeCancelBtn(wrap) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = core.t('common.cancel');
    btn.setAttribute('class', 'ak-button ak-button--ghost');
    btn.setAttribute('style', 'padding:8px 18px;font-size:13px;cursor:pointer;');
    btn.addEventListener('click', function () {
      cancelRefresh(wrap);
    });
    return btn;
  }

  async function cancelRefresh(wrap) {
    var stored = null;
    try {
      stored = await Tapp.shared.get(PLAYER_DATA_KEY);
    } catch (e) {}
    if (stored && stored.data && stored.data.player) {
      renderDisplay(wrap, stored.data);
      showPage(wrap, 'display');
    }
  }

  function formatTs(ts) {
    var d = new Date(Number(ts));
    if (isNaN(d.getTime())) return '';
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var h = String(d.getHours()).padStart(2, '0');
    var mi = String(d.getMinutes()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day + ' ' + h + ':' + mi;
  }

  function updateRefreshTime(wrap, stored) {
    var el = wrap.querySelector('[data-refresh-time]');
    if (!el) return;
    var t = stored && stored.ts ? formatTs(stored.ts) : '';
    el.textContent = t ? core.t('home.refreshTime') + ' ' + t : '';
  }

  // ==================== Step 1 · Token ====================

  function buildStep1(wrap) {
    var step = document.createElement('div');
    step.setAttribute('data-page', 'step1');
    step.setAttribute('class', 'ak-cut-tr ak-surface');
    step.setAttribute(
      'style',
      'margin-top:20px;padding:16px;border:1px solid var(--ark-border-strong);border-radius:0;display:none;'
    );

    var label = document.createElement('div');
    label.setAttribute('style', 'font-size:14px;font-weight:600;margin-bottom:8px;color:var(--ark-text);');
    label.textContent = core.t('home.step1.title');
    step.appendChild(label);

    var guide = document.createElement('div');
    guide.setAttribute('style', 'font-size:12px;line-height:1.7;color:var(--ark-text-dim);margin-bottom:12px;');
    guide.appendChild(document.createTextNode(core.t('home.step1.guidePrefix')));

    var sklandLink = document.createElement('a');
    sklandLink.setAttribute('href', '#');
    sklandLink.setAttribute(
      'style',
      'color:var(--ak-color-blue);cursor:pointer;text-decoration:underline;'
    );
    sklandLink.textContent = core.t('home.step1.guideLink');
    sklandLink.addEventListener('click', function (e) {
      e.preventDefault();
      try {
        Tapp.ui.openUrl('skland');
      } catch (err) {}
    });
    guide.appendChild(sklandLink);

    guide.appendChild(document.createTextNode(core.t('home.step1.guideSuffix')));
    step.appendChild(guide);

    var code = document.createElement('div');
    code.setAttribute('title', core.t('home.step1.copyHint'));
    code.setAttribute(
      'style',
      'font-family:var(--ak-font-mono);font-size:11px;background:var(--ark-fill);padding:8px 10px;border-radius:var(--ak-radius-subtle);' +
        'word-break:break-all;margin-bottom:12px;color:var(--ark-text);cursor:pointer;' +
        'transition:background 0.2s ease;user-select:none;'
    );
    var CODE_CMD =
      "copy(localStorage.getItem('SK_OAUTH_CRED_KEY')+','+localStorage.getItem('SK_TOKEN_CACHE_KEY'))";
    code.textContent = CODE_CMD;

    function legacyCopy(text) {
      var ok = false;
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('style', 'position:fixed;left:-9999px;top:0;opacity:0;');
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        ta.remove();
      } catch (e) {}
      return ok;
    }

    var copyTimer = null;
    code.addEventListener('click', function () {
      var showCopied = function () {
        if (copyTimer) clearTimeout(copyTimer);
        code.textContent = core.t('home.step1.copied');
        code.style.background = 'rgba(63, 185, 80, 0.25)';
        copyTimer = setTimeout(function () {
          code.textContent = CODE_CMD;
          code.style.background = 'var(--ark-fill)';
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(CODE_CMD).then(showCopied, function () {
          if (legacyCopy(CODE_CMD)) showCopied();
        });
      } else if (legacyCopy(CODE_CMD)) {
        showCopied();
      }
    });

    step.appendChild(code);

    var input = document.createElement('input');
    input.type = 'password';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute(
      'style',
      'width:100%;box-sizing:border-box;padding:8px 10px;font-size:13px;border:1px solid var(--ark-border);' +
        'border-radius:var(--ak-radius-subtle);background:transparent;color:var(--ark-text);'
    );
    input.placeholder = 'cred,token';
    step.appendChild(input);

    var navRow = document.createElement('div');
    navRow.setAttribute('style', 'display:flex;justify-content:space-between;gap:8px;margin-top:12px;');

    navRow.appendChild(makeCancelBtn(wrap));

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.textContent = core.t('common.next');
    nextBtn.setAttribute('class', 'ak-button ak-button--info');
    nextBtn.setAttribute('style', 'padding:8px 18px;font-size:13px;cursor:pointer;');
    navRow.appendChild(nextBtn);
    step.appendChild(navRow);

    loadSavedToken(input);

    nextBtn.addEventListener('click', function () {
      var credToken = input.value.trim();
      if (credToken.indexOf(',') === -1) {
        showError(step, core.t('home.step1.errorFormat'));
        return;
      }
      clearError(step);
      state.credToken = credToken;
      try { Tapp.storage.set('sklandToken', credToken); } catch (e) {}
      runBinding(wrap, step, nextBtn);
    });

    wrap.appendChild(step);
  }

  // ==================== Step 2 · 选择账号 ====================

  function buildStep2(wrap) {
    var step = document.createElement('div');
    step.setAttribute('data-page', 'step2');
    step.setAttribute('class', 'ak-cut-tr ak-surface');
    step.setAttribute(
      'style',
      'margin-top:20px;padding:16px;border:1px solid var(--ark-border-strong);border-radius:0;display:none;'
    );

    var label = document.createElement('div');
    label.setAttribute('style', 'font-size:14px;font-weight:600;margin-bottom:8px;color:var(--ark-text);');
    label.textContent = core.t('home.step2.title');
    step.appendChild(label);

    var listBox = document.createElement('div');
    listBox.setAttribute('data-account-list', '1');
    step.appendChild(listBox);

    var navRow = document.createElement('div');
    navRow.setAttribute('style', 'display:flex;justify-content:space-between;gap:8px;margin-top:12px;');

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.textContent = core.t('common.prev');
    prevBtn.setAttribute('class', 'ak-button ak-button--ghost');
    prevBtn.setAttribute('style', 'padding:8px 18px;font-size:13px;cursor:pointer;');
    prevBtn.addEventListener('click', function () {
      showPage(wrap, 'step1');
    });
    navRow.appendChild(prevBtn);

    navRow.appendChild(makeCancelBtn(wrap));

    step.appendChild(navRow);
    wrap.appendChild(step);
  }

  function renderAccountList(wrap, step) {
    var listBox = step.querySelector('[data-account-list]');
    if (!listBox) return;
    listBox.innerHTML = '';

    if (!state.binds.length) {
      listBox.textContent = core.t('home.step2.empty');
      return;
    }

    for (var i = 0; i < state.binds.length; i++) {
      (function (b) {
        var btn = document.createElement('button');
        btn.type = 'button';
        var name = b.nickName || core.t('common.unknown');
        var channel = b.channelName || '';
        btn.textContent = name + '（' + channel + '） UID:' + b.uid;
        btn.setAttribute('class', 'ak-button ak-button--ghost');
        btn.setAttribute(
          'style',
          'display:block;width:100%;text-align:left;margin-top:6px;padding:10px 12px;font-size:13px;cursor:pointer;'
        );
        btn.addEventListener('click', function () {
          if (btn.disabled) return;
          selectAccount(wrap, b, btn);
        });
        listBox.appendChild(btn);
      })(state.binds[i]);
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

  async function renderDisplay(wrap, data) {
    var page = wrap.querySelector('[data-page="display"]');
    var content = page.querySelector('[data-display-content]');
    if (!content) return;
    content.innerHTML = '';

    var player = data.player || {};
    var status = player.status;

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
    name.textContent = status && status.name ? status.name : (data.nickName || '');
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

    var assist = player.assistChars;
    var assets = window.__arkAssets;

    if (!assets) return;

    var infoCard = assets.buildPlayerInfoCard(player);
    var gameDataCard = assets.buildGameDataCard(player);

    var layout = document.createElement('div');
    layout.setAttribute('class', 'ark-display-layout');

    var leftCol = document.createElement('div');
    leftCol.setAttribute('class', 'ark-display-left');
    leftCol.appendChild(infoCard);

    var rightCol = document.createElement('div');
    rightCol.setAttribute('class', 'ark-display-right');
    rightCol.appendChild(gameDataCard);

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
      assets.setCharInfoMap(player.charInfoMap);
      assistPlaceholder.replaceWith(assets.buildAssistUnit(assist));
      myCharsPlaceholder.replaceWith(assets.buildMyChars(player.chars, player.charInfoMap));
    }).catch(function () {
      var fail = document.createElement('div');
      fail.setAttribute('style', 'font-size:11px;color:var(--ark-text-dim);padding:16px;text-align:center;');
      fail.textContent = core.t('home.loadFail');
      assistPlaceholder.replaceWith(fail);
      myCharsPlaceholder.replaceWith(fail.cloneNode(true));
    });
  }

  // ==================== 共用 ====================

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

  async function loadSavedToken(input) {
    try {
      var saved = await Tapp.storage.get('sklandToken');
      if (saved && typeof saved === 'string') input.value = saved;
    } catch (e) {}
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

  function clearError(step) {
    var old = step.querySelector('[data-step-error]');
    if (old) old.remove();
  }

  function setButtonLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      if (btn._loading) return;
      btn._loading = true;
      btn._origText = btn.textContent;
      btn.disabled = true;
      var sp = document.createElement('span');
      sp.setAttribute('class', 'ak-loading');
      sp.setAttribute(
        'style',
        'display:inline-block;vertical-align:middle;--ak-loading-size:14px;--ak-loading-border:3px;--ak-loading-color:currentColor;'
      );
      btn.textContent = '';
      btn.appendChild(sp);
    } else {
      btn._loading = false;
      btn.disabled = false;
      btn.textContent = btn._origText || '';
    }
  }

  async function runBinding(wrap, step, btn) {
    var skland = window.__arkSkland;
    if (!skland) {
      showError(step, core.t('home.errorModule'));
      return;
    }

    setButtonLoading(btn, true);
    try {
      var bindingRes = await skland.getPlayerBinding(state.credToken);
      var list = bindingRes && bindingRes.data && bindingRes.data.list;

      var ak = null;
      if (Array.isArray(list)) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].appCode === 'arknights') { ak = list[i]; break; }
        }
      }

      var binds = ak && Array.isArray(ak.bindingList) ? ak.bindingList : [];
      if (!binds.length) {
        showError(step, core.t('home.errorNoBinding'));
        return;
      }

      state.binds = binds;
      if (binds.length === 1) {
        await selectAccount(wrap, binds[0]);
        return;
      }

      var step2 = wrap.querySelector('[data-page="step2"]');
      renderAccountList(wrap, step2);
      showPage(wrap, 'step2');
    } catch (e) {
      showError(step, String((e && e.message) || e));
    } finally {
      setButtonLoading(btn, false);
    }
  }

  async function selectAccount(wrap, binding, btn) {
    var credToken = state.credToken;
    if (!credToken) {
      try { credToken = (await Tapp.storage.get('sklandToken')) || ''; } catch (e) {}
    }

    var skland = window.__arkSkland;
    if (!skland) return;

    var listBox = wrap.querySelector('[data-account-list]');
    var siblings = [];
    if (listBox && btn) {
      siblings = listBox.querySelectorAll('button');
    }

    setButtonLoading(btn, true);
    for (var i = 0; i < siblings.length; i++) {
      if (siblings[i] !== btn) {
        siblings[i].disabled = true;
        siblings[i].style.opacity = '0.6';
      }
    }

    try {
      var info = await skland.getPlayerInfo(binding.uid, credToken);
      var data = info && info.data ? info.data : null;
      await Tapp.shared.set(PLAYER_DATA_KEY, {
        ts: Date.now(),
        data: {
          uid: binding.uid,
          nickName: binding.nickName || '',
          channelName: binding.channelName || '',
          player: data
        }
      });
      updateRefreshTime(wrap, { ts: Date.now() });
      showPage(wrap, 'display');
      renderDisplay(wrap, {
        uid: binding.uid,
        nickName: binding.nickName || '',
        player: data
      });
    } catch (e) {
      showError(wrap.querySelector('[data-page="step2"]'), String((e && e.message) || e));
    } finally {
      setButtonLoading(btn, false);
      for (var j = 0; j < siblings.length; j++) {
        if (siblings[j] !== btn) {
          siblings[j].disabled = false;
          siblings[j].style.opacity = '';
        }
      }
    }
  }

  Tapp.pages['home'] = {
    render: render
  };
})();
