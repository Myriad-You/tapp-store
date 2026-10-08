// ========================================
// Player List Page / 玩家列表（ak-ui system）
// 管理员：读私有列表，可切换公开 / 设置默认
// 非管理员：只读公开列表
// ========================================

(function () {
  var core = require('../core.js');

  function navigate(name) {
    if (typeof window.__arkNavigate === 'function') window.__arkNavigate(name);
  }

  function render(container) {
    var section = container.querySelector('[data-view="playerList"]');
    if (!section) return;
    section.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.setAttribute('class', 'ark-page-inner');
    section.appendChild(wrap);

    var navRow = document.createElement('div');
    navRow.setAttribute('class', 'ark-page-nav');
    navRow.setAttribute('style', 'display:flex;align-items:center;gap:12px;margin-bottom:16px;');

    var back = document.createElement('button');
    back.type = 'button';
    back.setAttribute('class', 'ak-button ak-button--ghost');
    back.setAttribute('data-nav', 'home');
    back.setAttribute('style', 'padding:6px 12px;font-size:12px;cursor:pointer;');
    back.textContent = core.t('common.back');
    navRow.appendChild(back);

    var title = document.createElement('h1');
    title.setAttribute('class', 'ark-page-title');
    title.setAttribute('style', 'font-size:20px;font-weight:600;margin:0;color:var(--ark-text);');
    title.textContent = core.t('playerList.title');
    navRow.appendChild(title);

    wrap.appendChild(navRow);

    var listBox = document.createElement('div');
    listBox.setAttribute('class', 'ark-player-list');
    wrap.appendChild(listBox);

    load(wrap, listBox);
  }

  async function load(wrap, listBox) {
    listBox.innerHTML = '';
    var loading = document.createElement('div');
    loading.setAttribute('class', 'ark-spinner-box');
    loading.innerHTML = '<div class="ak-loading"></div>';
    listBox.appendChild(loading);

    var admin = false;
    try { admin = !!(await Tapp.user.isAdmin()); } catch (e) {}

    var map = await core.getPlayerMap();
    var uids = map ? Object.keys(map) : [];

    listBox.innerHTML = '';

    if (!uids.length) {
      var empty = document.createElement('div');
      empty.setAttribute('class', 'ark-player-list-empty');
      empty.textContent = core.t('playerList.empty');
      listBox.appendChild(empty);
    } else {
      // 默认置顶，其余按 lastUpdate 倒序
      uids.sort(function (a, b) {
        var ea = map[a] || {}, eb = map[b] || {};
        if (!!ea.isDefault !== !!eb.isDefault) return ea.isDefault ? -1 : 1;
        return (eb.lastUpdate || 0) - (ea.lastUpdate || 0);
      });

      for (var i = 0; i < uids.length; i++) {
        listBox.appendChild(buildRow(wrap, listBox, map[uids[i]], admin));
      }
    }

    if (admin) listBox.appendChild(buildAddCard());
  }

  function buildAddCard() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('class', 'ak-cut-tr ak-surface ark-player-card ark-player-add');
    btn.setAttribute('data-nav', 'addPlayer');
    btn.setAttribute('aria-label', core.t('playerList.add'));
    btn.setAttribute('title', core.t('playerList.add'));

    var plus = document.createElement('span');
    plus.setAttribute('class', 'ark-player-add__plus');
    plus.setAttribute('aria-hidden', 'true');
    plus.textContent = '+';
    btn.appendChild(plus);

    return btn;
  }

  function buildRow(wrap, listBox, entry, admin) {
    var card = document.createElement('div');
    card.setAttribute('class', 'ak-cut-tr ak-surface ark-player-card');

    var main = document.createElement('div');
    main.setAttribute('class', 'ark-player-card__main');

    var name = document.createElement('div');
    name.setAttribute('class', 'ark-player-card__name');
    name.textContent = entry.name || core.t('common.unknown');
    main.appendChild(name);

    var meta = document.createElement('div');
    meta.setAttribute('class', 'ak-label-mono ark-player-card__meta');
    var parts = [];
    if (entry.platform) parts.push(entry.platform);
    if (entry.uid) parts.push('UID:' + entry.uid);
    if (entry.lastUpdate) parts.push(core.t('playerList.updated') + ' ' + formatDateTime(entry.lastUpdate));
    meta.textContent = parts.join('  ·  ');
    main.appendChild(meta);

    card.appendChild(main);

    var controls = document.createElement('div');
    controls.setAttribute('class', 'ark-player-card__controls');
    controls.appendChild(buildViewButton(entry));
    controls.appendChild(buildSwitch(entry, admin, wrap, listBox));
    controls.appendChild(buildRadio(entry, admin, wrap, listBox));
    if (admin) controls.appendChild(buildDeleteButton(entry, wrap, listBox));
    card.appendChild(controls);

    return card;
  }

  function buildViewButton(entry) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('class', 'ak-button ak-button--ghost ark-player-card__view');
    btn.setAttribute('style', 'padding:6px 12px;font-size:12px;cursor:pointer;');
    btn.textContent = core.t('playerList.view');
    btn.addEventListener('click', async function () {
      btn.disabled = true;
      await core.setLastViewedUid(entry.uid);
      navigate('home');
    });
    return btn;
  }

  function buildSwitch(entry, admin, wrap, listBox) {
    var label = document.createElement('label');
    label.setAttribute('class', 'ark-switch');
    if (!admin) label.setAttribute('data-disabled', '1');

    var input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.setAttribute('class', 'ark-switch__input');
    input.checked = !!entry.isPublic;
    input.disabled = !admin;
    input.setAttribute('aria-label', core.t('playerList.showPublic'));
    input.addEventListener('change', async function () {
      input.disabled = true;
      try {
        await core.setPlayerPublic(entry.uid, input.checked);
        await load(wrap, listBox);
      } catch (e) {
        input.checked = !input.checked;
        input.disabled = false;
      }
    });

    var track = document.createElement('span');
    track.setAttribute('class', 'ark-switch__track');
    track.setAttribute('aria-hidden', 'true');
    var thumb = document.createElement('span');
    thumb.setAttribute('class', 'ark-switch__thumb');
    track.appendChild(thumb);

    var text = document.createElement('span');
    text.setAttribute('class', 'ark-switch__label');
    text.textContent = core.t('playerList.showPublic');

    label.appendChild(input);
    label.appendChild(track);
    label.appendChild(text);
    return label;
  }

  function buildRadio(entry, admin, wrap, listBox) {
    var label = document.createElement('label');
    label.setAttribute('class', 'ark-radio');
    if (!admin) label.setAttribute('data-disabled', '1');

    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'arkDefaultPlayer';
    input.setAttribute('class', 'ark-radio__input');
    input.checked = !!entry.isDefault;
    input.disabled = !admin;
    input.setAttribute('aria-label', core.t('playerList.default'));
    input.addEventListener('change', async function () {
      if (!input.checked) return;
      try {
        await core.setDefaultPlayer(entry.uid);
        await load(wrap, listBox);
      } catch (e) {}
    });

    var dot = document.createElement('span');
    dot.setAttribute('class', 'ark-radio__dot');
    dot.setAttribute('aria-hidden', 'true');

    var text = document.createElement('span');
    text.setAttribute('class', 'ark-radio__label');
    text.textContent = core.t('playerList.default');

    label.appendChild(input);
    label.appendChild(dot);
    label.appendChild(text);
    return label;
  }

  function buildDeleteButton(entry, wrap, listBox) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('class', 'ak-button ak-button--ghost ark-player-card__delete');
    btn.setAttribute('style', 'padding:6px 12px;font-size:12px;cursor:pointer;color:var(--ak-signal-danger);');
    btn.textContent = core.t('playerList.delete');
    btn.addEventListener('click', async function () {
      var ok = false;
      try {
        ok = !!(await window.__arkDialog.confirm(core.t('playerList.deleteConfirm'), {
          title: core.t('playerList.deleteTitle'),
          confirmText: core.t('common.confirm'),
          danger: true
        }));
      } catch (e) {
        ok = false;
      }
      if (!ok) return;
      btn.disabled = true;
      try {
        await core.deletePlayer(entry.uid);
        await load(wrap, listBox);
      } catch (e) {
        btn.disabled = false;
      }
    });
    return btn;
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

  Tapp.pages['playerList'] = {
    render: render
  };
})();
