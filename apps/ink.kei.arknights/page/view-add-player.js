// ========================================
// Add Player Page / 添加玩家（登录 + 选择账号）
// 从主页抽取的 step1 / step2 流程，独立成页
// ========================================

(function () {
  var core = require('../core.js');
  var state = {
    token: '',
    binds: []
  };

  function navigate(name) {
    if (typeof window.__arkNavigate === 'function') window.__arkNavigate(name);
  }

  function render(container) {
    var section = container.querySelector('[data-view="addPlayer"]');
    if (!section) return;
    section.innerHTML = '';
    state.token = '';
    state.binds = [];

    var wrap = document.createElement('div');
    wrap.setAttribute('class', 'ark-page-inner');
    section.appendChild(wrap);

    var navRow = document.createElement('div');
    navRow.setAttribute('class', 'ark-page-nav');
    navRow.setAttribute('style', 'display:flex;align-items:center;gap:12px;margin-bottom:16px;');

    var back = document.createElement('button');
    back.type = 'button';
    back.setAttribute('class', 'ak-button ak-button--ghost');
    back.setAttribute('data-nav', 'playerList');
    back.setAttribute('style', 'padding:6px 12px;font-size:12px;cursor:pointer;');
    back.textContent = core.t('common.back');
    navRow.appendChild(back);

    var title = document.createElement('h1');
    title.setAttribute('class', 'ark-page-title');
    title.setAttribute('style', 'font-size:20px;font-weight:600;margin:0;color:var(--ark-text);');
    title.textContent = core.t('addPlayer.title');
    navRow.appendChild(title);

    wrap.appendChild(navRow);

    buildStep1(wrap);
    buildStep2(wrap);
    buildNotice(wrap);

    // 弹簧：把页脚推到底部；页脚作为视图直接子级，不受表单列宽度限制
    var spacer = document.createElement('div');
    spacer.setAttribute('class', 'ark-add-spacer');
    section.appendChild(spacer);

    buildFooter(section);
  }

  // 登录凭证安全告警（位于步骤卡片下方、页脚上方）
  function buildNotice(wrap) {
    var stack = document.createElement('div');
    stack.setAttribute('class', 'ak-notice-stack');
    stack.setAttribute('style', 'margin-top:16px;');

    var notice = document.createElement('aside');
    notice.setAttribute('class', 'ak-notice ak-notice--warning');
    notice.setAttribute('role', 'status');

    var code = document.createElement('span');
    code.setAttribute('class', 'ak-notice__code');
    code.textContent = core.t('addPlayer.notice.code');

    var body = document.createElement('div');
    body.setAttribute('class', 'ak-notice__body');

    var title = document.createElement('strong');
    title.setAttribute('class', 'ak-notice__title');
    title.textContent = core.t('addPlayer.notice.title');

    var message = document.createElement('p');
    message.setAttribute('class', 'ak-notice__message');
    message.textContent = core.t('addPlayer.notice.message');

    body.appendChild(title);
    body.appendChild(message);
    notice.appendChild(code);
    notice.appendChild(body);
    stack.appendChild(notice);
    wrap.appendChild(stack);
  }

  // 页脚：名称版本 + 版权说明（直接挂在视图上，不受表单列宽度限制）
  function buildFooter(parent) {
    var footer = document.createElement('footer');
    footer.setAttribute('class', 'ark-app-footer');

    var verLine = document.createElement('div');
    var copyLine = document.createElement('div');
    copyLine.textContent = core.t('footer.copyright');
    footer.appendChild(verLine);
    footer.appendChild(copyLine);
    parent.appendChild(footer);

    try {
      var info = Tapp.lifecycle.getInfo();
      verLine.textContent = core.t('title') + ' · v' + (info && info.version ? info.version : '');
    } catch (e) {}
  }

  function showPage(wrap, name) {
    var pages = {
      step1: wrap.querySelector('[data-page="step1"]'),
      step2: wrap.querySelector('[data-page="step2"]')
    };
    for (var key in pages) {
      if (pages[key]) pages[key].style.display = key === name ? 'block' : 'none';
    }
  }

  // ==================== Step 1 · 登录 ====================

  function buildStep1(wrap) {
    var step = document.createElement('div');
    step.setAttribute('data-page', 'step1');
    step.setAttribute('class', 'ak-cut-tr ak-surface');
    step.setAttribute(
      'style',
      'margin-top:20px;padding:16px;border:1px solid var(--ark-border-strong);border-radius:0;display:block;'
    );

    var label = document.createElement('div');
    label.setAttribute('style', 'font-size:14px;font-weight:600;margin-bottom:8px;color:var(--ark-text);');
    label.textContent = core.t('addPlayer.step1.title');
    step.appendChild(label);

    var inputStyle =
      'width:100%;box-sizing:border-box;padding:8px 10px;font-size:13px;border:1px solid var(--ark-border);' +
      'border-radius:var(--ak-radius-subtle);background:transparent;color:var(--ark-text);margin-bottom:8px;';

    var phoneInput = document.createElement('input');
    phoneInput.type = 'tel';
    phoneInput.setAttribute('autocomplete', 'tel');
    phoneInput.setAttribute('style', inputStyle);
    phoneInput.placeholder = core.t('addPlayer.step1.phone');
    step.appendChild(phoneInput);

    var passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.setAttribute('autocomplete', 'current-password');
    passwordInput.setAttribute('style', inputStyle);
    passwordInput.placeholder = core.t('addPlayer.step1.password');
    step.appendChild(passwordInput);

    var navRow = document.createElement('div');
    navRow.setAttribute('style', 'display:flex;justify-content:space-between;gap:8px;margin-top:12px;');

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = core.t('common.cancel');
    cancelBtn.setAttribute('class', 'ak-button ak-button--ghost');
    cancelBtn.setAttribute('data-nav', 'playerList');
    cancelBtn.setAttribute('style', 'padding:8px 18px;font-size:13px;cursor:pointer;');
    navRow.appendChild(cancelBtn);

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.textContent = core.t('addPlayer.step1.login');
    nextBtn.setAttribute('class', 'ak-button ak-button--info');
    nextBtn.setAttribute('style', 'padding:8px 18px;font-size:13px;cursor:pointer;');
    navRow.appendChild(nextBtn);
    step.appendChild(navRow);

    nextBtn.addEventListener('click', async function () {
      var phone = phoneInput.value.trim();
      var password = passwordInput.value;
      if (!phone || !password) {
        showError(step, core.t('addPlayer.step1.errorEmpty'));
        return;
      }
      clearError(step);
      setButtonLoading(nextBtn, true);
      try {
        var token = await core.skland.loginByPassword(phone, password);
        state.token = token;
        try { await Tapp.storage.set('hgToken', token); } catch (e) {}
        await runBinding(wrap, step, nextBtn);
      } catch (e) {
        showError(step, String(e));
      } finally {
        setButtonLoading(nextBtn, false);
      }
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
    label.textContent = core.t('addPlayer.step2.title');
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

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = core.t('common.cancel');
    cancelBtn.setAttribute('class', 'ak-button ak-button--ghost');
    cancelBtn.setAttribute('data-nav', 'playerList');
    cancelBtn.setAttribute('style', 'padding:8px 18px;font-size:13px;cursor:pointer;');
    navRow.appendChild(cancelBtn);

    step.appendChild(navRow);
    wrap.appendChild(step);
  }

  function renderAccountList(wrap, step) {
    var listBox = step.querySelector('[data-account-list]');
    if (!listBox) return;
    listBox.innerHTML = '';

    if (!state.binds.length) {
      listBox.textContent = core.t('addPlayer.step2.empty');
      return;
    }

    for (var i = 0; i < state.binds.length; i++) {
      (
      /**
       * @param {{ nickName?: string, channelName?: string, uid?: string }} b
       */
      function (b) {
        var btn = document.createElement('button');
        btn.type = 'button';
        var name = b.nickName || core.t('common.unknown');
        var channel = b.channelName || '';
        btn.textContent = name + '(' + channel + ') UID:' + b.uid;
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

  // ==================== 流程 ====================

  async function getStoredToken() {
    var token = state.token;
    if (!token) {
      try { token = String((await Tapp.storage.get('hgToken')) || ''); } catch (e) {}
    }
    return token || '';
  }

  async function resolveBinds(hgToken) {
    var bindingRes = await core.skland.getPlayerBinding(hgToken);
    var list = bindingRes && bindingRes.data && bindingRes.data.list;
    var ak = null;
    if (Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].appCode === 'arknights') { ak = list[i]; break; }
      }
    }
    var binds = ak && Array.isArray(ak.bindingList) ? ak.bindingList : [];
    if (!binds.length) throw new Error(core.t('addPlayer.errorNoBinding'));
    return binds;
  }

  async function runBinding(wrap, step, btn) {
    if (!core.skland) {
      showError(step, core.t('addPlayer.errorModule'));
      return;
    }

    setButtonLoading(btn, true);
    try {
      var binds = await resolveBinds(state.token);
      state.binds = binds;
      if (binds.length === 1) {
        await selectAccount(wrap, binds[0]);
        return;
      }
      renderAccountList(wrap, wrap.querySelector('[data-page="step2"]'));
      showPage(wrap, 'step2');
    } catch (e) {
      showError(step, String(e));
    } finally {
      setButtonLoading(btn, false);
    }
  }

  async function fetchPlayerData(binding, token) {
    var skland = core.skland;
    if (!skland) throw new Error(core.t('addPlayer.errorModule'));
    var info = await skland.getPlayerInfo(binding.uid, token);
    return {
      ts: Date.now(),
      data: {
        uid: binding.uid,
        nickName: binding.nickName || '',
        channelName: binding.channelName || '',
        player: (info && info.data) || null
      }
    };
  }

  async function selectAccount(wrap, binding, btn) {
    var token = await getStoredToken();

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
      var record = await fetchPlayerData(binding, token);
      await core.savePlayer({
        uid: binding.uid,
        platform: binding.channelName || '',
        name: binding.nickName || '',
        playerdata: record
      }, token, false);
      navigate('home');
    } catch (e) {
      showError(wrap.querySelector('[data-page="step2"]'), String(e));
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

  // ==================== 共用 ====================

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

  Tapp.pages['addPlayer'] = {
    render: render
  };
})();
