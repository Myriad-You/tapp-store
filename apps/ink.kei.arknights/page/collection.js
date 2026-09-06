// ========================================
// Collection Page（干员资产 / 皮肤资产）
// ========================================

(function () {
  var core = require('../core.js');
  var PLAYER_DATA_KEY = 'arknights.player';

  var PROFESSIONS = ['pioneer', 'warrior', 'tank', 'sniper', 'caster', 'medic', 'support', 'special'];
  var RARITY_OPTIONS = [
    { key: '6', labelKey: 'collection.rarity6', min: 5 },
    { key: '5', labelKey: 'collection.rarity5', min: 4 },
    { key: '4', labelKey: 'collection.rarity4', min: 3 },
    { key: '1-3', labelKey: 'collection.rarity13', min: 0 }
  ];
  var SORT_OPTIONS = [
    { key: 'level', labelKey: 'collection.sortLevel' },
    { key: 'skill', labelKey: 'collection.sortSkill' },
    { key: 'gain', labelKey: 'collection.sortGain' },
    { key: 'name', labelKey: 'collection.sortName' }
  ];

  function rarityCategory(rarity) {
    if (rarity >= 5) return '6';
    if (rarity >= 4) return '5';
    if (rarity >= 3) return '4';
    return '1-3';
  }

  function specSum(c) {
    var s = 0;
    if (c && Array.isArray(c.skills)) {
      for (var i = 0; i < c.skills.length; i++) s += c.skills[i].specializeLevel || 0;
    }
    return s;
  }

  function render(container) {
    var section = container.querySelector('[data-view="collection"]');
    if (!section) return;
    section.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.setAttribute('class', 'ark-page-inner');
    section.appendChild(wrap);

    var topBar = document.createElement('div');
    topBar.setAttribute('style', 'display:flex;align-items:center;gap:12px;margin-bottom:16px;');

    var back = document.createElement('button');
    back.type = 'button';
    back.textContent = core.t('common.back');
    back.setAttribute('data-nav', 'home');
    back.setAttribute('class', 'ak-button ak-button--ghost');
    back.setAttribute('style', 'padding:6px 14px;font-size:13px;cursor:pointer;');

    var title = document.createElement('h1');
    title.setAttribute('class', 'ark-page-title');
    title.setAttribute('style', 'font-size:18px;font-weight:600;margin:0;color:var(--ark-text);');
    title.textContent = core.t('collection.title');

    topBar.appendChild(back);
    topBar.appendChild(title);
    wrap.appendChild(topBar);

    var assets = window.__arkAssets;
    if (!assets) return;

    Tapp.shared.get(PLAYER_DATA_KEY).then(function (stored) {
      var player = stored && stored.data && stored.data.player ? stored.data.player : {};
      return assets.loadAssets().then(function () {
        assets.setCharInfoMap(player.charInfoMap);
        renderContent(wrap, player, assets);
      });
    }).catch(function () {
      renderContent(wrap, {}, assets);
    });
  }

  function renderContent(wrap, player, assets) {
    var charInfoMap = (player && player.charInfoMap) || {};
    var skinInfoMap = (player && player.skinInfoMap) || {};
    var chars = (player && Array.isArray(player.chars)) ? player.chars.slice() : [];

    var filterState = { professions: [], rarities: [], sortBy: 'rarity' };
    var filterTool = null;

    var tabBar = document.createElement('div');
    tabBar.setAttribute('style', 'position:relative;display:flex;justify-content:center;gap:64px;margin-bottom:20px;');

    var tabChar = makeTabText(core.t('collection.tabOperators'));
    var tabSkin = makeTabText(core.t('collection.tabSkins'));
    tabBar.appendChild(tabChar);
    tabBar.appendChild(tabSkin);

    var indicator = document.createElement('div');
    indicator.setAttribute('style', 'position:absolute;bottom:-8px;left:0;width:0;transition:left 0.25s ease;pointer-events:none;');
    var arrow = document.createElement('div');
    arrow.setAttribute('style', 'width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:5px solid var(--ark-text);margin:0 auto;');
    var line = document.createElement('div');
    line.setAttribute('style', 'height:2px;background:var(--ark-text);');
    indicator.appendChild(arrow);
    indicator.appendChild(line);
    tabBar.appendChild(indicator);
    wrap.appendChild(tabBar);

    var charPanel = renderCharPanel(chars, charInfoMap, assets, filterState);
    var skinPanel = renderSkinPanel(skinInfoMap);
    wrap.appendChild(charPanel);
    wrap.appendChild(skinPanel);
    skinPanel.style.display = 'none';

    function positionIndicator(target) {
      indicator.style.left = target.offsetLeft + 'px';
      indicator.style.width = target.offsetWidth + 'px';
    }

    function setActiveTab(active) {
      if (active === 'char') {
        charPanel.style.display = 'block';
        skinPanel.style.display = 'none';
        tabChar.style.color = 'var(--ark-text)';
        tabSkin.style.color = 'var(--ark-text-dim)';
        if (filterTool) filterTool.style.display = 'block';
        positionIndicator(tabChar);
      } else {
        charPanel.style.display = 'none';
        skinPanel.style.display = 'block';
        tabSkin.style.color = 'var(--ark-text)';
        tabChar.style.color = 'var(--ark-text-dim)';
        if (filterTool) filterTool.style.display = 'none';
        positionIndicator(tabSkin);
      }
    }

    tabChar.addEventListener('click', function () { setActiveTab('char'); });
    tabSkin.addEventListener('click', function () { setActiveTab('skin'); });
    setActiveTab('char');

    filterTool = buildFilterTool(assets, filterState, function () {
      var newPanel = renderCharPanel(chars, charInfoMap, assets, filterState);
      charPanel.replaceWith(newPanel);
      charPanel = newPanel;
      if (skinPanel.style.display !== 'none') newPanel.style.display = 'none';
    });
    wrap.insertBefore(filterTool, charPanel);
  }

  function makeTabText(label) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.setAttribute(
      'style',
      'cursor:pointer;color:var(--ark-text);font-family:var(--ak-font-mono);font-size:13px;font-weight:800;' +
        'letter-spacing:0.08em;text-transform:uppercase;user-select:none;background:transparent;border:none;padding:0;'
    );
    return btn;
  }

  function buildFilterTool(assets, filterState, onChange) {
    var container = document.createElement('div');
    container.setAttribute('style', 'position:relative;margin-bottom:12px;z-index:50;');

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'ark-filter-panel');
    toggle.setAttribute(
      'style',
      'cursor:pointer;color:var(--ark-text);font-family:var(--ak-font-mono);font-size:13px;letter-spacing:0.08em;' +
        'text-transform:uppercase;padding:6px 0;user-select:none;text-align:center;background:transparent;border:none;'
    );
    toggle.textContent = core.t('collection.filter') + ' ▾';
    container.appendChild(toggle);

    var panel = document.createElement('div');
    panel.setAttribute('id', 'ark-filter-panel');
    panel.setAttribute('class', 'ak-cut-tr ak-surface');
    panel.setAttribute(
      'style',
      'position:absolute;top:100%;left:0;width:100%;background:var(--ak-surface-panel);border:1px solid var(--ark-border-weak);' +
        'padding:14px;box-sizing:border-box;opacity:0;transform:translateY(-8px);visibility:hidden;' +
        'transition:opacity 0.22s ease, transform 0.22s ease, visibility 0.22s;'
    );

    function sectionTitle(text) {
      var t = document.createElement('div');
      t.setAttribute('class', 'ak-label-mono');
      t.setAttribute('style', 'font-size:11px;color:var(--ak-text-secondary);margin-bottom:8px;text-align:center;');
      t.textContent = text;
      return t;
    }

    function setChipOn(chip, on) {
      chip.style.opacity = on ? '1' : '0.55';
      chip.style.borderColor = on ? 'var(--ak-signal-accent)' : 'var(--ark-border)';
      chip.style.boxShadow = on ? 'inset 0 -2px 0 var(--ak-signal-accent)' : 'none';
    }

    panel.appendChild(sectionTitle(core.t('collection.profession')));
    var profRow = document.createElement('div');
    profRow.setAttribute('style', 'display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;justify-content:center;');
    for (var p = 0; p < PROFESSIONS.length; p++) {
      (function (key) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', core.t('collection.professions.' + key));
        btn.setAttribute('style', 'width:44px;height:44px;cursor:pointer;padding:4px;box-sizing:border-box;background:transparent;border:none;opacity:0.4;');
        var icon = document.createElement('img');
        icon.src = assets.professionUrl(key);
        icon.alt = '';
        icon.setAttribute('style', 'width:100%;height:100%;object-fit:contain;display:block;');
        btn.appendChild(icon);
        btn.addEventListener('click', function () {
          var i = filterState.professions.indexOf(key);
          var on = i === -1;
          if (on) filterState.professions.push(key); else filterState.professions.splice(i, 1);
          btn.style.opacity = on ? '1' : '0.4';
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
          onChange();
        });
        profRow.appendChild(btn);
      })(PROFESSIONS[p]);
    }
    panel.appendChild(profRow);

    panel.appendChild(sectionTitle(core.t('collection.rarity')));
    var rarityRow = document.createElement('div');
    rarityRow.setAttribute('style', 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;justify-content:center;');
    for (var r = 0; r < RARITY_OPTIONS.length; r++) {
      (function (opt) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.textContent = core.t(opt.labelKey);
        chip.setAttribute(
          'style',
          'display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:5px 14px;font-size:11px;' +
            'font-family:var(--ak-font-mono);letter-spacing:0.08em;text-transform:uppercase;color:var(--ark-text);cursor:pointer;' +
            'border:1px solid var(--ark-border);background:transparent;user-select:none;opacity:0.55;'
        );
        chip.addEventListener('click', function () {
          var i = filterState.rarities.indexOf(opt.key);
          var on = i === -1;
          if (on) filterState.rarities.push(opt.key); else filterState.rarities.splice(i, 1);
          setChipOn(chip, on);
          onChange();
        });
        rarityRow.appendChild(chip);
      })(RARITY_OPTIONS[r]);
    }
    panel.appendChild(rarityRow);

    panel.appendChild(sectionTitle(core.t('collection.sort')));
    var sortRow = document.createElement('div');
    sortRow.setAttribute('style', 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;');
    var sortChips = [];
    for (var s = 0; s < SORT_OPTIONS.length; s++) {
      (function (opt) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.textContent = core.t(opt.labelKey);
        chip.setAttribute(
          'style',
          'display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:5px 14px;font-size:11px;' +
            'font-family:var(--ak-font-mono);letter-spacing:0.08em;text-transform:uppercase;color:var(--ark-text);cursor:pointer;' +
            'border:1px solid var(--ark-border);background:transparent;user-select:none;opacity:0.55;'
        );
        chip.addEventListener('click', function () {
          filterState.sortBy = (filterState.sortBy === opt.key) ? 'rarity' : opt.key;
          refreshSort();
          onChange();
        });
        sortRow.appendChild(chip);
        sortChips.push(chip);
      })(SORT_OPTIONS[s]);
    }
    function refreshSort() {
      for (var c = 0; c < sortChips.length; c++) {
        setChipOn(sortChips[c], SORT_OPTIONS[c].key === filterState.sortBy);
      }
    }
    panel.appendChild(sortRow);

    container.appendChild(panel);

    var isOpen = false;
    toggle.addEventListener('click', function () {
      isOpen = !isOpen;
      if (isOpen) {
        panel.style.opacity = '1';
        panel.style.transform = 'translateY(0)';
        panel.style.visibility = 'visible';
      } else {
        panel.style.opacity = '0';
        panel.style.transform = 'translateY(-8px)';
        panel.style.visibility = 'hidden';
      }
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.textContent = isOpen ? (core.t('collection.filter') + ' ▴') : (core.t('collection.filter') + ' ▾');
    });

    return container;
  }

  function renderCharPanel(chars, charInfoMap, assets, filterState) {
    var panel = document.createElement('div');

    var list = chars.slice();

    if (filterState) {
      if (filterState.professions.length) {
        list = list.filter(function (c) {
          var info = charInfoMap[c.charId];
          return info && filterState.professions.indexOf(String(info.profession).toLowerCase()) !== -1;
        });
      }
      if (filterState.rarities.length) {
        list = list.filter(function (c) {
          var info = charInfoMap[c.charId];
          var r = info ? (info.rarity || 0) : 0;
          return filterState.rarities.indexOf(rarityCategory(r)) !== -1;
        });
      }
    }

    sortChars(list, charInfoMap, filterState ? filterState.sortBy : 'rarity');

    if (!list.length) {
      panel.setAttribute('style', 'font-size:12px;color:var(--ark-text-dim);');
      panel.textContent = core.t('collection.empty');
      return panel;
    }

    var grid = document.createElement('div');
    grid.setAttribute('style', 'display:grid;grid-template-columns:repeat(auto-fill, var(--char-card-w));gap:14px;justify-content:center;');
    panel.appendChild(grid);

    var cards = [];
    for (var j = 0; j < list.length; j++) {
      var info = charInfoMap[list[j].charId];
      var card = assets.buildCharCard(list[j], info);
      grid.appendChild(card);
      cards.push(card);
    }

    requestAnimationFrame(function () {
      for (var k = 0; k < cards.length; k++) cards[k].style.opacity = '1';
    });

    return panel;
  }

  function sortChars(list, charInfoMap, sortBy) {
    if (sortBy === 'skill') {
      list.sort(function (a, b) { return specSum(b) - specSum(a); });
    } else if (sortBy === 'gain') {
      list.sort(function (a, b) { return (b.gainTime || 0) - (a.gainTime || 0); });
    } else if (sortBy === 'name') {
      list.sort(function (a, b) {
        var na = (charInfoMap[a.charId] && charInfoMap[a.charId].name) || a.charId;
        var nb = (charInfoMap[b.charId] && charInfoMap[b.charId].name) || b.charId;
        return na.localeCompare(nb);
      });
    } else if (sortBy === 'level') {
      list.sort(function (a, b) { return (b.level || 0) - (a.level || 0); });
    } else {
      list.sort(function (a, b) {
        var ra = (charInfoMap[a.charId] && charInfoMap[a.charId].rarity) || 0;
        var rb = (charInfoMap[b.charId] && charInfoMap[b.charId].rarity) || 0;
        if (ra !== rb) return rb - ra;
        if ((b.evolvePhase || 0) !== (a.evolvePhase || 0)) return (b.evolvePhase || 0) - (a.evolvePhase || 0);
        return (b.level || 0) - (a.level || 0);
      });
    }
  }

  function renderSkinPanel(skinInfoMap) {
    var panel = document.createElement('div');
    panel.setAttribute(
      'style',
      'padding:32px;text-align:center;font-size:13px;color:var(--ark-text-dim);' +
        'border:1px dashed var(--ark-border-weak);border-radius:var(--ak-radius-subtle);'
    );
    panel.textContent = core.t('collection.skinTodoPrefix') + Object.keys(skinInfoMap || {}).length + core.t('collection.skinTodoSuffix');
    return panel;
  }

  Tapp.pages['collection'] = {
    render: render
  };
})();
