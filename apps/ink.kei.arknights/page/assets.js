// ========================================
// Assets
// ========================================

(function () {
  var core = require('../core.js');
  var _charInfoMap = null;
  var _eliteUrls = {};
  var _professionUrls = {};
  var _potentialUrls = {};
  var _starUrls = {};
  var _rarityBgUrls = {};
  var _loadPromise = null;
  var _repoBase = 'https://raw.githubusercontent.com/leaphy-dev/ArknightsGameResource/main';

  var PROFESSIONS = ['pioneer', 'warrior', 'tank', 'sniper', 'caster', 'medic', 'support', 'special'];
  var RARITY_CLASSES = ['one-star', 'two-star', 'three-star', 'four-star', 'five-star', 'six-star'];
  var RARITY_BG_KEYS = ['2-0', 'r3', 'r4', 'r5'];

  function makeCardTitle(text) {
    var el = document.createElement('span');
    el.setAttribute('class', 'ak-card__title');
    var sq = document.createElement('span');
    sq.setAttribute('style', 'width:8px;height:8px;background:var(--ak-color-blue);flex-shrink:0;box-sizing:border-box;');
    el.appendChild(sq);
    el.appendChild(document.createTextNode(text));
    return el;
  }

  function decodeBase64(b64) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(b64, 'base64').toString('utf8').replace(/^\uFEFF/, '');
    }
    if (typeof atob === 'function') {
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
    }
    throw new Error('no base64 decoder');
  }

  function loadAssets() {
    if (_loadPromise) return _loadPromise;
    _loadPromise = (async function () {
      try {
        try {
          var cleaned = core.sanitizeRepoBase(await Tapp.settings.get('resourceBaseUrl'));
          if (cleaned) _repoBase = cleaned;
        } catch (e) {}

        var jobs = [
          Tapp.assets.getUrl('assets/rank/elite0.png'),
          Tapp.assets.getUrl('assets/rank/elite1.png'),
          Tapp.assets.getUrl('assets/rank/elite2.png')
        ];
        for (var i = 0; i < PROFESSIONS.length; i++) {
          jobs.push(Tapp.assets.getUrl('assets/profession/' + PROFESSIONS[i] + '.png'));
        }
        for (var p = 0; p < 6; p++) {
          jobs.push(Tapp.assets.getUrl('assets/potential/potential_' + p + '.png'));
        }
        for (var s = 0; s < 6; s++) {
          jobs.push(Tapp.assets.getUrl('assets/star/star_' + s + '.png'));
        }
        for (var b = 0; b < RARITY_BG_KEYS.length; b++) {
          jobs.push(Tapp.assets.getUrl('assets/star/charBg_' + RARITY_BG_KEYS[b] + '.png'));
        }

        var results = await Promise.all(jobs);
        _eliteUrls[0] = results[0].url;
        _eliteUrls[1] = results[1].url;
        _eliteUrls[2] = results[2].url;
        var idx = 3;
        for (var j = 0; j < PROFESSIONS.length; j++) {
          _professionUrls[PROFESSIONS[j]] = results[idx + j].url;
        }
        idx += PROFESSIONS.length;
        for (var k = 0; k < 6; k++) {
          _potentialUrls[k] = results[idx + k].url;
        }
        idx += 6;
        for (var r = 0; r < 6; r++) {
          _starUrls[r] = results[idx + r].url;
        }
        idx += 6;
        for (var m = 0; m < RARITY_BG_KEYS.length; m++) {
          _rarityBgUrls[RARITY_BG_KEYS[m]] = results[idx + m].url;
        }
        return true;
      } catch (e) {
        _loadPromise = null;
        console.error('[Assets] load failed:', e);
        return false;
      }
    })();
    return _loadPromise;
  }

  function avatarUrl(charId, evolvePhase) {
    // 头像（头部区域）：avatar/{charId}.png（默认/精英0-1）、avatar/{charId}_2.png（精英2）
    var suffix = (evolvePhase || 0) >= 2 ? '_2' : '';
    return _repoBase + '/avatar/' + charId + suffix + '.png';
  }

  function skillUrl(skillId) {
    return _repoBase + '/skill/skill_icon_' + skillId + '.png';
  }

  function portraitUrl(charId, evolvePhase) {
    // TODO: 根据潜能识别皮肤，以后解析skin字段
    var suffix = evolvePhase === 2 ? '_2' : '_1';
    return _repoBase + '/portrait/' + charId + suffix + '.png';
  }

  function skinUrl(skinId) {
    // 皮肤半身像：portrait/{charId}_{brandId}#{sortId}.png（无 "b" 后缀）
    // 只有带 "@"（品牌皮肤）才有对应半身像；默认皮肤（无 @）回落到 portrait
    if (!skinId || skinId.indexOf('@') === -1) return '';
    return _repoBase + '/portrait/' + skinId.replace(/@/g, '_').replace(/#/g, '%23') + '.png';
  }

  function skinAvatarUrl(skinId) {
    // 皮肤头像（头部区域）：avatar/{charId}_{brandId}#{sortId}.png
    // skinId 形如 "char_102_texas@winter#1" -> 文件名 "char_102_texas_winter#1.png"（无 "b" 后缀）
    // 只有带 "@"（品牌皮肤）才有独立头像；默认皮肤（无 @）回落到 avatarUrl
    if (!skinId || skinId.indexOf('@') === -1) return '';
    return _repoBase + '/avatar/' + skinId.replace(/@/g, '_').replace(/#/g, '%23') + '.png';
  }

  function rarityBgUrl(rarity) {
    var key;
    if (rarity >= 5) key = 'r5';
    else if (rarity >= 4) key = 'r4';
    else if (rarity >= 3) key = 'r3';
    else key = '2-0';
    return _rarityBgUrls[key] || '';
  }

  function setCharInfoMap(map) {
    _charInfoMap = map || null;
  }

  function operatorName(charId) {
    var info = _charInfoMap && _charInfoMap[charId];
    return (info && info.name) || charId;
  }

  function placeColor(rarity) {
    if (rarity >= 5) return 'var(--ak-color-advanced)';
    if (rarity >= 4) return 'var(--ak-color-yellow)';
    return 'white';
  }

  function buildOperatorAvatar(op) {
    var info = _charInfoMap && _charInfoMap[op.id];
    var rarity = info && info.rarity != null ? info.rarity : 0;

    var wrap = document.createElement('div');
    wrap.setAttribute('class', 'ak-card ak-card--place');
    wrap.setAttribute(
      'style',
      'width:var(--assist-avatar);height:var(--assist-avatar);overflow:hidden;position:relative;' +
        'box-sizing:border-box;--ak-card-place-color:' + placeColor(rarity) + ';'
    );

    var img = document.createElement('img');
    img.referrerPolicy = 'no-referrer';
    img.alt = '';
    img.setAttribute(
      'style',
      'width:var(--assist-avatar);height:var(--assist-avatar);object-fit:cover;display:block;' +
        'opacity:0;transition:opacity 0.25s ease;'
    );

    var spinner = document.createElement('div');
    spinner.setAttribute(
      'style',
      'position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;'
    );
    var spinnerEl = document.createElement('div');
    spinnerEl.setAttribute('class', 'ak-loading');
    spinnerEl.setAttribute('style', 'width:calc(var(--assist-avatar) * 0.3);height:calc(var(--assist-avatar) * 0.3);--ak-loading-border:3px;');
    spinner.appendChild(spinnerEl);

    img.onload = function () {
      img.style.opacity = '1';
      spinner.remove();
    };
    img.onerror = function () {
      spinner.remove();
    };

    wrap.appendChild(img);
    wrap.appendChild(spinner);

    var elite = op.evolvePhase || 0;
    var eliteUrl = _eliteUrls[elite];
    if (eliteUrl) {
      var eliteImg = document.createElement('img');
      eliteImg.src = eliteUrl;
      eliteImg.setAttribute(
        'style',
        'position:absolute;top:-2px;right:-2px;width:calc(var(--assist-avatar) * 0.32);' +
          'height:calc(var(--assist-avatar) * 0.32);pointer-events:none;'
      );
      wrap.appendChild(eliteImg);
    }

    var lvBlock = document.createElement('div');
    lvBlock.setAttribute(
      'style',
      'position:absolute;left:2px;top:2px;display:flex;flex-direction:column;' +
        'align-items:center;line-height:1;pointer-events:none;'
    );
    var lvLabel = document.createElement('span');
    lvLabel.setAttribute('style', 'font-family:var(--ak-font-mono);font-size:calc(var(--assist-avatar) * 0.1);color:#fff;opacity:0.85;letter-spacing:0.08em;');
    lvLabel.textContent = 'LV';
    var lvNum = document.createElement('span');
    lvNum.setAttribute(
      'style',
      'font-size:calc(var(--assist-avatar) * 0.18);font-weight:500;color:#fff;' +
        'text-shadow:0 0 2px #000,0 0 2px #000;'
    );
    lvNum.textContent = String(op.level || 0);
    lvBlock.appendChild(lvLabel);
    lvBlock.appendChild(lvNum);
    wrap.appendChild(lvBlock);

    img.src = skinAvatarUrl(op.skinId) || avatarUrl(op.id, op.evolvePhase);

    return wrap;
  }

  function buildAssistUnit(assistList) {
    var list = Array.isArray(assistList) ? assistList.slice(0, 3) : [];

    var wrap = document.createElement('div');
    wrap.setAttribute('class', 'ak-card');
    wrap.setAttribute(
      'style',
      'width:100%;box-sizing:border-box;min-width:0;'
    );

    var header = document.createElement('div');
    header.setAttribute('class', 'ak-card__header');

    var zh = makeCardTitle(core.t('assets.supportUnits'));

    var en = document.createElement('span');
    en.setAttribute('style', 'font-size:9px;letter-spacing:0.5px;color:var(--ark-text-dim);');
    en.textContent = '// SUPPORT UNITS';

    header.appendChild(zh);
    header.appendChild(en);
    wrap.appendChild(header);

    if (!list.length) {
      var empty = document.createElement('div');
      empty.setAttribute('style', 'font-size:11px;color:var(--ark-text-dim);');
      empty.textContent = core.t('assets.noSupport');
      wrap.appendChild(empty);
      return wrap;
    }

    var row = document.createElement('div');
    row.setAttribute('style', 'display:flex;gap:12px;flex-wrap:nowrap;justify-content:center;');

    for (var i = 0; i < list.length; i++) {
      var op = {
        id: list[i].charId,
        level: list[i].level,
        evolvePhase: list[i].evolvePhase,
        skillId: list[i].skillId,
        skinId: list[i].skinId
      };

      var unit = document.createElement('div');
      unit.setAttribute('style', 'display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:0;');

      var avatar = buildOperatorAvatar(op);
      unit.appendChild(avatar);

      var name = document.createElement('div');
      name.setAttribute(
        'style',
        'font-size:10px;color:var(--ark-text-muted);max-width:calc(var(--assist-avatar) + 8px);' +
          'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
      );
      name.textContent = operatorName(op.id);
      unit.appendChild(name);

      row.appendChild(unit);
    }

    wrap.appendChild(row);
    return wrap;
  }

  function buildMyChars(chars, charInfoMap) {
    var list = Array.isArray(chars) ? chars.slice() : [];
    list.sort(function (a, b) {
      var infoA = charInfoMap && charInfoMap[a.charId];
      var infoB = charInfoMap && charInfoMap[b.charId];
      var ra = infoA ? (infoA.rarity || 0) : 0;
      var rb = infoB ? (infoB.rarity || 0) : 0;
      if (ra !== rb) return rb - ra;
      if ((b.evolvePhase || 0) !== (a.evolvePhase || 0)) return (b.evolvePhase || 0) - (a.evolvePhase || 0);
      return (b.level || 0) - (a.level || 0);
    });
    list = list.slice(0, 10);

    var wrap = document.createElement('div');
    wrap.setAttribute('class', 'ak-card');
    wrap.setAttribute(
      'style',
      'max-width:100%;box-sizing:border-box;min-width:0;overflow:hidden;'
    );

    var header = document.createElement('div');
    header.setAttribute('class', 'ak-card__header');
    header.setAttribute('style', 'align-items:center;');

    var left = document.createElement('div');
    left.setAttribute('style', 'display:flex;align-items:baseline;gap:8px;');

    var zh = makeCardTitle(core.t('assets.myOperators'));

    var en = document.createElement('span');
    en.setAttribute('style', 'font-size:9px;letter-spacing:0.5px;color:var(--ark-text-dim);');
    en.textContent = '// MY OPERATORS';

    left.appendChild(zh);
    left.appendChild(en);
    header.appendChild(left);

    var arrow = document.createElement('button');
    arrow.type = 'button';
    arrow.setAttribute('data-nav', 'collection');
    arrow.textContent = '→';
    arrow.setAttribute(
      'style',
      'font-size:14px;font-weight:600;color:var(--ark-text);background:transparent;border:none;' +
        'cursor:pointer;padding:0 4px;line-height:1;'
    );
    header.appendChild(arrow);

    wrap.appendChild(header);

    if (!list.length) {
      var empty = document.createElement('div');
      empty.setAttribute('style', 'font-size:11px;color:var(--ark-text-dim);');
      empty.textContent = core.t('assets.noOperators');
      wrap.appendChild(empty);
      return wrap;
    }

    var grid = document.createElement('div');
    grid.setAttribute('class', 'ark-my-chars-scroll');
    grid.setAttribute(
      'style',
      'display:flex;gap:12px;overflow-x:auto;overflow-y:hidden;padding-bottom:6px;' +
        'max-width:100%;'
    );
    grid.addEventListener('scroll', function () {
      grid.classList.add('scrolling');
      if (grid._scrollTimer) clearTimeout(grid._scrollTimer);
      grid._scrollTimer = setTimeout(function () {
        grid.classList.remove('scrolling');
      }, 400);
    });
    grid.addEventListener('wheel', function (e) {
      if (grid.scrollWidth > grid.clientWidth) {
        grid.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });

    for (var i = 0; i < list.length; i++) {
      var info = charInfoMap && charInfoMap[list[i].charId];
      var card = buildCharCard(list[i], info);
      grid.appendChild(card);
      (function (c, delay) {
        setTimeout(function () {
          c.style.opacity = '1';
        }, delay);
      })(card, i * 60);
    }

    wrap.appendChild(grid);
    return wrap;
  }

  function buildCharCard(char, info) {
    var rarity = info && info.rarity != null ? info.rarity : 0;

    var card = document.createElement('div');
    card.className = 'operator-handbook-item-wrapper';
    card.setAttribute('style', 'opacity:0;transition:opacity 0.4s ease, transform 0.2s ease, box-shadow 0.2s ease;');

    var bgBox = document.createElement('div');
    bgBox.className = 'operator-handbook-item-component operator-handbook-item-bg';
    var bgImg = document.createElement('img');
    bgImg.alt = '';
    bgImg.referrerPolicy = 'no-referrer';
    var bgUrl = rarityBgUrl(rarity);
    if (bgUrl) {
      bgImg.src = bgUrl;
      bgBox.appendChild(bgImg);
    }
    card.appendChild(bgBox);

    var illus = document.createElement('div');
    illus.className = 'operator-handbook-item-component operator-handbook-item-illustration';

    var illusImg = document.createElement('img');
    illusImg.referrerPolicy = 'no-referrer';
    illusImg.alt = '';
    illusImg.setAttribute('style', 'opacity:0;transition:opacity 0.3s ease;');

    var spinner = document.createElement('div');
    spinner.setAttribute(
      'style',
      'position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;'
    );
    var spinnerEl = document.createElement('div');
    spinnerEl.setAttribute('class', 'ak-loading');
    spinnerEl.setAttribute('style', 'width:calc(var(--char-card-w) * 0.16);height:calc(var(--char-card-w) * 0.16);--ak-loading-border:3px;');
    spinner.appendChild(spinnerEl);

    illusImg.onload = function () {
      illusImg.style.opacity = '1';
      spinner.remove();
    };
    illusImg.onerror = function () {
      spinner.remove();
    };

    illus.appendChild(illusImg);
    illus.appendChild(spinner);
    card.appendChild(illus);

    var decorWrap = document.createElement('div');
    decorWrap.className = 'operator-handbook-item-component operator-handbook-item-decor-main-wrap ' + RARITY_CLASSES[rarity];
    var decor = document.createElement('div');
    decor.className = 'operator-handbook-item-decor-main';
    for (var pi = 1; pi <= 3; pi++) {
      var part = document.createElement('div');
      part.className = 'operator-handbook-item-decor-part operator-handbook-item-decor-part-' + pi;
      decor.appendChild(part);
    }
    decorWrap.appendChild(decor);
    card.appendChild(decorWrap);

    var topLeft = document.createElement('div');
    topLeft.className = 'operator-handbook-item-component operator-handbook-item-decor-topleft';
    card.appendChild(topLeft);

    var nameEl = document.createElement('div');
    nameEl.className = 'operator-handbook-item-component operator-handbook-item-name';
    nameEl.textContent = operatorName(char.charId);
    card.appendChild(nameEl);

    var career = document.createElement('div');
    career.className = 'operator-handbook-item-component operator-handbook-item-career';
    var profKey = info && info.profession ? info.profession.toLowerCase() : '';
    var profUrl = _professionUrls[profKey];
    if (profUrl) {
      var profImg = document.createElement('img');
      profImg.src = profUrl;
      profImg.alt = '';
      career.appendChild(profImg);
    }
    card.appendChild(career);

    var star = document.createElement('div');
    star.className = 'operator-handbook-item-component operator-handbook-item-star';
    var starUrl = _starUrls[rarity];
    if (starUrl) {
      var starImg = document.createElement('img');
      starImg.src = starUrl;
      starImg.alt = '';
      star.appendChild(starImg);
    }
    card.appendChild(star);

    var rankUrl = _eliteUrls[char.evolvePhase || 0];
    if (rankUrl) {
      var eliteBox = document.createElement('div');
      eliteBox.className = 'operator-handbook-item-component operator-handbook-item-elite';
      var rankImg = document.createElement('img');
      rankImg.src = rankUrl;
      rankImg.alt = '';
      eliteBox.appendChild(rankImg);
      card.appendChild(eliteBox);
    }

    var labelContainer = document.createElement('div');
    labelContainer.className = 'operator-handbook-item-component operator-handbook-item-label-container';

    var potentialUrl = _potentialUrls[char.potentialRank || 0];
    if (potentialUrl) {
      var potImg = document.createElement('img');
      potImg.src = potentialUrl;
      potImg.alt = '';
      potImg.setAttribute(
        'style',
        'width:calc(var(--char-card-w) * 0.21);height:calc(var(--char-card-w) * 0.21);pointer-events:none;'
      );
      labelContainer.appendChild(potImg);
    }

    if (char.defaultSkillId) {
      var skillImg = document.createElement('img');
      skillImg.referrerPolicy = 'no-referrer';
      skillImg.alt = '';
      skillImg.onerror = function () {
        skillImg.remove();
      };
      skillImg.setAttribute(
        'style',
        'width:calc(var(--char-card-w) * 0.32);height:calc(var(--char-card-w) * 0.32);pointer-events:none;object-fit:contain;' +
          'border:1px solid rgba(255,255,255,0.85);background:rgba(0,0,0,0.4);'
      );
      skillImg.src = skillUrl(char.defaultSkillId);
      labelContainer.appendChild(skillImg);
    }

    card.appendChild(labelContainer);

    if (char.level != null) {
      var lvCircle = document.createElement('div');
      lvCircle.className = 'operator-handbook-item-component operator-handbook-item-level';
      lvCircle.textContent = String(char.level);
      card.appendChild(lvCircle);
    }

    var illusSrc = skinUrl(char.skinId) || portraitUrl(char.charId, char.evolvePhase || 0);
    if (typeof IntersectionObserver !== 'undefined') {
      var io = new IntersectionObserver(function (entries) {
        for (var ei = 0; ei < entries.length; ei++) {
          if (entries[ei].isIntersecting) {
            illusImg.src = illusSrc;
            io.disconnect();
          }
        }
      }, { rootMargin: '120px' });
      io.observe(card);
    } else {
      illusImg.src = illusSrc;
    }

    return card;
  }

  function buildPlayerInfoCard(player) {
    var summary = core.getPlayerSummary({ player: player });

    var wrap = document.createElement('div');
    wrap.setAttribute(
      'style',
      'display:flex;gap:8px;width:100%;box-sizing:border-box;min-width:0;'
    );    
    wrap.setAttribute('class', 'ak-card');

    var rows = summary.items;

    for (var i = 0; i < rows.length; i++) {
      var cell = document.createElement('div');
      cell.setAttribute('style', 'flex:1;min-width:0;text-align:center;');
      var lab = document.createElement('div');
      lab.setAttribute(
        'style',
        'font-family:var(--ak-font-mono);font-size:9px;letter-spacing:0.05em;text-transform:uppercase;' +
          'color:var(--ak-text-secondary);white-space:nowrap;'
      );
      lab.textContent = core.t(rows[i][0]);
      var val = document.createElement('div');
      val.setAttribute(
        'style',
        'font-size:12px;font-weight:600;color:var(--ark-text);margin-top:2px;' +
          'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
      );
      val.textContent = rows[i][1];
      cell.appendChild(lab);
      cell.appendChild(val);
      wrap.appendChild(cell);
    }

    return wrap;
  }

  function buildGameDataCard(player) {
    var wrap = document.createElement('div');
    wrap.setAttribute('class', 'ark-game-data ak-card');
    wrap.setAttribute(
      'style',
      'width:100%;box-sizing:border-box;min-width:0;display:flex;flex-direction:column;overflow:hidden;'
    );

    var header = document.createElement('div');
    header.setAttribute('class', 'ak-card__header');
    header.setAttribute('style', 'flex-shrink:0;');

    var zh = makeCardTitle(core.t('assets.gameData'));

    var en = document.createElement('span');
    en.setAttribute('style', 'font-family:var(--ak-font-mono);font-size:9px;letter-spacing:0.08em;color:var(--ak-text-secondary);');
    en.textContent = '// GAME DATA';

    header.appendChild(zh);
    header.appendChild(en);
    wrap.appendChild(header);

    var tabs = [
      ['sidestory', core.t('assets.tabSidestory')],
      ['rogue', core.t('assets.tabRogue')],
      ['campaign', core.t('assets.tabCampaign')],
      ['tower', core.t('assets.tabTower')]
    ];

    var tabBar = document.createElement('div');
    tabBar.setAttribute('class', 'ark-game-tabbar');
    tabBar.setAttribute(
      'style',
      'display:flex;gap:8px;overflow-x:auto;padding-bottom:10px;margin-bottom:10px;flex-shrink:0;scrollbar-width:none;'
    );

    var body = document.createElement('div');
    body.setAttribute('style', 'position:relative;flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;');

    var contentBox = document.createElement('div');
    contentBox.setAttribute('data-game-content', '1');
    contentBox.setAttribute('style', 'flex:1;min-height:0;overflow-y:auto;min-width:0;');

    contentBox.addEventListener('scroll', function () {
      contentBox.classList.add('scrolling');
      if (contentBox._scrollTimer) clearTimeout(contentBox._scrollTimer);
      contentBox._scrollTimer = setTimeout(function () {
        contentBox.classList.remove('scrolling');
      }, 400);

      if (fadeTop) fadeTop.style.opacity = contentBox.scrollTop > 0 ? '1' : '0';
      if (fadeBottom) {
        var atBottom = contentBox.scrollTop + contentBox.clientHeight >= contentBox.scrollHeight - 1;
        fadeBottom.style.opacity = atBottom ? '0' : '1';
      }
    });
    contentBox.addEventListener('wheel', function (e) {
      var down = contentBox.scrollTop + contentBox.clientHeight < contentBox.scrollHeight;
      var up = contentBox.scrollTop > 0;
      if ((e.deltaY > 0 && down) || (e.deltaY < 0 && up)) {
        contentBox.scrollTop += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });

    var fadeTop = document.createElement('div');
    fadeTop.setAttribute(
      'style',
      'position:absolute;top:0;left:0;right:0;height:36px;pointer-events:none;z-index:5;' +
        'background:linear-gradient(to bottom, var(--ark-panel), transparent);transition:opacity 0.2s ease;'
    );

    var fadeBottom = document.createElement('div');
    fadeBottom.setAttribute(
      'style',
      'position:absolute;bottom:0;left:0;right:0;height:36px;pointer-events:none;z-index:5;' +
        'background:linear-gradient(to top, var(--ark-panel), transparent);transition:opacity 0.2s ease;'
    );

    body.appendChild(contentBox);
    body.appendChild(fadeTop);
    body.appendChild(fadeBottom);

    wrap.appendChild(tabBar);
    wrap.appendChild(body);

    for (var i = 0; i < tabs.length; i++) {
      (function (key, label) {
        var tab = document.createElement('button');
        tab.type = 'button';
        tab.textContent = label;
        tab.setAttribute(
          'style',
          'flex-shrink:0;padding:0 16px;height:32px;line-height:32px;font-family:var(--ak-font-mono);' +
            'font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--ark-text-muted);' +
            'background:var(--ark-fill);border:1px solid var(--ark-border-weak);border-radius:var(--ak-radius-subtle);cursor:pointer;'
        );
        tab.addEventListener('click', function () {
          contentBox.innerHTML = '';
          renderGameMode(contentBox, key, player);
        });
        tabBar.appendChild(tab);
      })(tabs[i][0], tabs[i][1]);
    }

    // 默认显示第一个
    renderGameMode(contentBox, 'sidestory', player);

    return wrap;
  }

  function renderGameMode(contentBox, key, player) {
    if (key === 'sidestory') renderActivity(contentBox, player);
    else if (key === 'rogue') renderRogue(contentBox, player);
    else if (key === 'campaign') renderCampaign(contentBox, player);
    else if (key === 'tower') renderTower(contentBox, player);
  }

  function simpleRow(parent, label, value) {
    var row = document.createElement('div');
    row.setAttribute('style', 'display:flex;justify-content:space-between;gap:8px;padding:4px 0;');
    var l = document.createElement('span');
    l.setAttribute('style', 'font-size:11px;color:var(--ark-text-dim);');
    l.textContent = label;
    var v = document.createElement('span');
    v.setAttribute('style', 'font-size:11px;color:var(--ark-text-muted);');
    v.textContent = value;
    row.appendChild(l);
    row.appendChild(v);
    parent.appendChild(row);
  }

  function createSpinnerBox() {
    var holder = document.createElement('div');
    holder.setAttribute(
      'style',
      'position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;'
    );
    var spinner = document.createElement('div');
    spinner.setAttribute('class', 'ak-loading');
    holder.appendChild(spinner);
    return holder;
  }

  function buildModeSubCard(picUrl, name, lines) {
    var box = document.createElement('div');
    box.setAttribute(
      'style',
      'position:relative;overflow:hidden;border-radius:8px;margin-bottom:8px;' +
        'width:100%;height:72px;background:#222;box-sizing:border-box;'
    );

    var bg = document.createElement('div');
    bg.setAttribute(
      'style',
      'position:absolute;left:0;top:0;width:100%;height:100%;' +
        'background-size:cover;background-position:left center;opacity:0;' +
        '-webkit-mask-image:linear-gradient(to right, #000 0%, #000 40%, rgba(0,0,0,0.5) 70%, transparent 100%);' +
        'mask-image:linear-gradient(to right, #000 0%, #000 40%, rgba(0,0,0,0.5) 70%, transparent 100%);' +
        'transition:opacity 0.25s ease;'
    );
    box.appendChild(bg);

    var spinner = createSpinnerBox();
    box.appendChild(spinner);

    var overlay = document.createElement('div');
    overlay.setAttribute(
      'style',
      'position:absolute;left:0;top:0;width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;' +
        'align-items:flex-end;padding:0 12px;text-align:right;box-sizing:border-box;'
    );

    var title = document.createElement('div');
    title.setAttribute('style', 'font-size:12px;font-weight:600;color:#fff;text-shadow:0 1px 2px #000;');
    title.textContent = name;
    overlay.appendChild(title);

    if (lines) {
      for (var i = 0; i < lines.length; i++) {
        var line = document.createElement('div');
        line.setAttribute('style', 'font-size:10px;color:#fff;text-shadow:0 1px 2px #000;margin-top:2px;');
        line.textContent = lines[i];
        overlay.appendChild(line);
      }
    }

    box.appendChild(overlay);

    if (picUrl) {
      var img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.onload = function () {
        bg.style.backgroundImage = 'url("' + picUrl + '")';
        bg.style.opacity = '1';
        spinner.remove();
      };
      img.onerror = function () {
        spinner.remove();
      };
      img.src = picUrl;
    } else {
      spinner.remove();
    }

    return box;
  }

  function renderActivity(contentBox, player) {
    var list = player && Array.isArray(player.activity) ? player.activity : [];
    if (!list.length) {
      contentBox.textContent = core.t('assets.noActivity');
      return;
    }
    var shown = 0;
    for (var i = 0; i < list.length; i++) {
      var act = list[i];
      var info = player.activityInfoMap && player.activityInfoMap[act.actId];
      var name = info && info.name ? info.name : (act.actId || core.t('assets.fallbackActivity'));
      var picUrl = info && info.picUrl;
      if (!picUrl) continue;

      var total = 0, cleared = 0;
      if (Array.isArray(act.zones)) {
        for (var z = 0; z < act.zones.length; z++) {
          total += act.zones[z].totalStage || 0;
          cleared += act.zones[z].clearedStage || 0;
        }
      }
      var lines = [total ? (cleared + '/' + total) : '--'];
      contentBox.appendChild(buildModeSubCard(picUrl, name, lines));
      shown++;
    }
    if (!shown) contentBox.textContent = core.t('assets.noActivity');
  }

  function renderRogue(contentBox, player) {
    var records = player && player.rogue && Array.isArray(player.rogue.records) ? player.rogue.records : [];
    if (!records.length) {
      contentBox.textContent = core.t('assets.noRogue');
      return;
    }
    var shown = 0;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var info = player.rogueInfoMap && player.rogueInfoMap[r.rogueId];
      var name = info && info.name ? info.name : (r.rogueId || core.t('assets.fallbackRogue'));
      var picUrl = info && info.picUrl;
      if (!picUrl) continue;
      var lines = [
        core.t('assets.clearTimes') + ' ' + (r.clearTime || 0),
        core.t('assets.level') + ' ' + (r.bpLevel || 0),
        r.medal ? (core.t('assets.medal') + ' ' + (r.medal.current || 0) + '/' + (r.medal.total || 0)) : ''
      ];
      contentBox.appendChild(buildModeSubCard(picUrl, name, lines));
      shown++;
    }
    if (!shown) contentBox.textContent = core.t('assets.noRogue');
  }

  function renderCampaign(contentBox, player) {
    var records = player && player.campaign && Array.isArray(player.campaign.records) ? player.campaign.records : [];
    if (!records.length) { contentBox.textContent = core.t('assets.noCampaign'); return; }
    var shown = 0;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var info = player.campaignInfoMap && player.campaignInfoMap[r.campaignId];
      var picUrl = info && info.picUrl;
      if (!picUrl) continue;
      var name = info && info.name ? info.name : (r.campaignId || core.t('assets.fallbackCampaign'));
      var lines = [core.t('assets.maxKills') + ' ' + (r.maxKills || 0)];
      contentBox.appendChild(buildModeSubCard(picUrl, name, lines));
      shown++;
    }
    if (!shown) contentBox.textContent = core.t('assets.noCampaign');
  }

  function renderTower(contentBox, player) {
    var records = player && player.tower && Array.isArray(player.tower.records) ? player.tower.records : [];
    if (!records.length) { contentBox.textContent = core.t('assets.noTower'); return; }
    var shown = 0;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var info = player.towerInfoMap && player.towerInfoMap[r.towerId];
      var picUrl = info && info.picUrl;
      if (!picUrl) continue;
      var name = info && info.name ? info.name : (r.towerId || (core.t('assets.fallbackTower') + (i + 1)));
      var lines = [core.t('assets.best') + ' ' + (r.best || 0)];
      contentBox.appendChild(buildModeSubCard(picUrl, name, lines));
      shown++;
    }
    if (!shown) contentBox.textContent = core.t('assets.noTower');
  }

  function buildSpacer() {
    var el = document.createElement('div');
    el.setAttribute('class', 'ark-home-spacer ak-card ak-card--stripe');
    el.setAttribute('style', 'flex:1;min-height:0;box-sizing:border-box;');
    return el;
  }

  window.__arkAssets = {
    loadAssets: loadAssets,
    setCharInfoMap: setCharInfoMap,
    buildOperatorAvatar: buildOperatorAvatar,
    buildAssistUnit: buildAssistUnit,
    buildMyChars: buildMyChars,
    buildCharCard: buildCharCard,
    buildPlayerInfoCard: buildPlayerInfoCard,
    buildGameDataCard: buildGameDataCard,
    buildSpacer: buildSpacer,
    operatorName: operatorName,
    charInfoMap: function () { return _charInfoMap; },
    professionUrl: function (key) { return _professionUrls[key] || ''; },
    skinUrl: skinUrl
  };
})();
