(function (root) {
  'use strict';
  const DDZ = root.DDZ = root.DDZ || {};
  const $ = function (id) { return document.getElementById(id); };
  let modalReturnFocus = null;
  let pauseReturnFocus = null;
  let lastTimerAnnouncement = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  function cardMarkup(card, options) {
    const opts = options || {};
    if (opts.back) {
      const backUrl = DDZ.theme && DDZ.theme.backUrl ? DDZ.theme.backUrl() : '';
      return '<i role="img" class="card back' + (opts.mini ? ' mini' : '') + '" aria-label="' + escapeHtml(DDZ.t('card.back')) + '">'
        + (backUrl ? '<img class="card-back-art" src="' + escapeHtml(backUrl) + '" alt="">' : '') + '</i>';
    }
    const red = card.suit === 'heart' || card.suit === 'diamond' || card.rank === 'big-joker';
    const joker = card.suit === 'joker';
    const suit = joker ? '★' : DDZ.cards.symbols[card.suit];
    const label = joker ? DDZ.cards.rankLabel(card.rank) : DDZ.t('card.named', { suit: DDZ.t('suit.' + card.suit), rank: DDZ.cards.rankLabel(card.rank) });
    const artUrl = DDZ.theme && DDZ.theme.artUrl ? DDZ.theme.artUrl(card.rank) : '';
    return '<i role="img" class="card' + (red ? ' red' : '') + (joker ? ' joker' : '') + (opts.mini ? ' mini' : '')
      + '" data-rank="' + escapeHtml(DDZ.cards.rankLabel(card.rank)) + '" data-suit="' + suit + '" aria-label="'
      + escapeHtml(label) + '">' + (artUrl ? '<img class="card-rank-art" src="' + escapeHtml(artUrl) + '" alt="">' : '') + '</i>';
  }

  function cardLabel(card) {
    return card.suit === 'joker'
      ? DDZ.cards.rankLabel(card.rank)
      : DDZ.t('card.named', { suit: DDZ.t('suit.' + card.suit), rank: DDZ.cards.rankLabel(card.rank) });
  }

  function roleLabel(role) { return DDZ.t('role.' + (role === 'landlord' ? 'landlord' : role === 'farmer' ? 'farmer' : 'unknown')); }

  function safeAvatarUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const url = value.trim();
    if (/^data:image\//i.test(url) || /^blob:/i.test(url) || url.startsWith('/')) return url;
    try {
      const parsed = new URL(url, root.location.href);
      return parsed.origin === root.location.origin && parsed.origin !== 'null' ? parsed.href : '';
    } catch (_) { return ''; }
  }

  function seatMarkup(player, index, active, thinking) {
    const name = DDZ.playerName(player);
    const initial = player.human && DDZ.profile && DDZ.profile.name ? Array.from(name)[0] : player.human ? DDZ.t('player.initialHuman') : name.slice(0, 1);
    const avatarUrl = player.human && DDZ.profile ? safeAvatarUrl(DDZ.profile.avatar) : '';
    const avatar = '<div class="avatar' + (player.human ? ' human' : '') + '"><span>' + escapeHtml(initial) + '</span>'
      + (avatarUrl ? '<img src="' + escapeHtml(avatarUrl) + '" alt="">' : '') + '</div>';
    const backs = player.human ? '' : '<div class="card-backs">' + Array.from({ length: Math.min(6, player.hand.length) }, function () { return cardMarkup(null, { back: true, mini: true }); }).join('') + '</div>';
    return avatar
      + '<strong>' + escapeHtml(name) + (player.role === 'landlord' ? ' ♛' : '') + '</strong>'
      + '<small>' + escapeHtml(DDZ.t('seat.summary', { role: roleLabel(player.role), count: player.hand.length })) + '</small>'
      + (player.lastAction ? '<span class="last-action">' + escapeHtml(DDZ.message(player.lastAction)) + '</span>' : '') + backs
      + (active && thinking ? '<span class="thinking" aria-label="' + escapeHtml(DDZ.t('status.thinking')) + '"><i></i><i></i><i></i></span>' : '');
  }

  function renderMenu(model) {
    $('menu-screen').hidden = false; $('game-screen').hidden = true;
    $('menu-wins').textContent = model.stats.wins;
    $('menu-score').textContent = model.stats.score;
    $('menu-rate').textContent = model.stats.games ? Math.round(model.stats.wins / model.stats.games * 100) + '%' : '—';
    document.querySelectorAll('[data-difficulty]').forEach(function (button) {
      button.classList.toggle('active', button.dataset.difficulty === model.settings.difficulty);
    });
    document.querySelectorAll('[data-theme-choice]').forEach(function (button) {
      const active = button.dataset.themeChoice === model.settings.theme;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const resume = document.querySelector('[data-action="resume"]');
    resume.hidden = !model.savedGame;
  }

  function renderBottom(state) {
    const reveal = state.landlordIndex !== null;
    $('bottom-cards').querySelector('.mini-hand').innerHTML = state.bottom.map(function (card) {
      return cardMarkup(card, { mini: true, back: !reveal });
    }).join('');
  }

  function renderHand(state) {
    const selected = new Set(state.selectedIds);
    $('human-hand').innerHTML = state.players[0].hand.map(function (card, index) {
      return '<button type="button" class="card-slot' + (selected.has(card.id) ? ' selected' : '') + '" style="--card-order:' + index
        + '" data-card-id="' + escapeHtml(card.id) + '" aria-pressed="' + selected.has(card.id) + '" aria-label="'
        + escapeHtml(DDZ.t('card.select', { card: cardLabel(card) })) + '">' + cardMarkup(card) + '</button>';
    }).join('');
  }

  function renderTablePlay(state) {
    const record = state.leadPlay;
    if (!record) { $('table-play').innerHTML = ''; return; }
    $('table-play').innerHTML = '<span class="pattern-label">' + escapeHtml(DDZ.patternName(record.pattern)) + ' · ' + escapeHtml(DDZ.playerName(state.players[record.playerIndex]))
      + '</span><div class="played-cards">' + record.cards.map(function (card) { return cardMarkup(card, { mini: true }); }).join('') + '</div>';
  }

  function renderActions(state) {
    const humanTurn = state.currentPlayer === 0 && !state.paused && !state.busy;
    if (state.phase === 'bidding') {
      const candidate = state.landlordCandidate !== null;
      $('action-bar').innerHTML = humanTurn
        ? '<button type="button" data-action="bid-no">' + DDZ.t(candidate ? 'action.noRob' : 'action.noCall') + '</button><button type="button" class="primary" data-action="bid-yes">' + DDZ.t(candidate ? 'action.rob' : 'action.call') + '</button>'
        : '<span class="thinking" aria-label="' + escapeHtml(DDZ.t('status.aiThinking')) + '"><i></i><i></i><i></i></span>';
      return;
    }
    if (state.phase !== 'playing') { $('action-bar').innerHTML = ''; return; }
    const hasSelection = state.selectedIds.length > 0;
    const noPlayFeedback = state.message && state.message.key === 'message.noPlay';
    $('action-bar').innerHTML = '<button type="button" class="' + (noPlayFeedback ? 'hint-attention' : '') + '" data-action="hint"' + (!humanTurn ? ' disabled' : '') + '>' + DDZ.t('action.hint') + '</button>'
      + '<button type="button" class="primary play-action" data-action="play"' + (!humanTurn || !hasSelection ? ' disabled' : '') + '>' + DDZ.t('action.play') + '</button>'
      + '<button type="button" data-action="pass"' + (!humanTurn || !state.leadPlay ? ' disabled' : '') + '>' + DDZ.t('action.pass') + '</button>'
      + '<button type="button" data-action="clear"' + (!state.selectedIds.length ? ' disabled' : '') + '>' + DDZ.t('action.clear') + '</button>';
  }

  function renderGame(model) {
    const state = model.state;
    $('menu-screen').hidden = true; $('game-screen').hidden = false;
    $('base-score').textContent = state.baseScore;
    $('multiplier').textContent = '×' + state.multiplier;
    $('bomb-count').textContent = state.bombCount;
    ['right', 'left', 'human'].forEach(function (location) {
      const playerIndex = location === 'right' ? 2 : location === 'left' ? 1 : 0;
      const node = $('player-' + location);
      node.classList.toggle('active', state.currentPlayer === playerIndex && ['bidding', 'playing'].includes(state.phase));
      node.innerHTML = seatMarkup(state.players[playerIndex], playerIndex, state.currentPlayer === playerIndex, model.thinking && state.currentPlayer === playerIndex);
      const avatarImage = node.querySelector('.avatar img');
      if (avatarImage) avatarImage.addEventListener('error', function () { avatarImage.remove(); }, { once: true });
    });
    renderBottom(state); renderHand(state); renderTablePlay(state); renderActions(state);
    const current = state.players[state.currentPlayer];
    const currentName = DDZ.playerName(current);
    const phaseText = state.phase === 'dealing' ? DDZ.t('phase.dealing') : state.phase === 'bidding' ? DDZ.t('phase.bidding') : state.phase === 'playing' ? DDZ.t('phase.turn', { name: currentName }) : DDZ.t('phase.finished');
    $('turn-banner').querySelector('strong').textContent = phaseText;
    let turnDetail = '';
    if (state.phase === 'dealing') turnDetail = DDZ.t('detail.preparing');
    else if (state.phase === 'bidding') turnDetail = state.currentPlayer === 0 ? DDZ.t(state.landlordCandidate === null ? 'detail.chooseCall' : 'detail.chooseRob') : DDZ.t('detail.thinking', { name: currentName });
    else if (state.phase === 'playing' && state.currentPlayer !== 0) turnDetail = DDZ.t('detail.thinking', { name: currentName });
    else if (state.phase === 'playing' && state.message) turnDetail = DDZ.message(state.message);
    else if (state.phase === 'playing') turnDetail = DDZ.t(state.leadPlay ? 'detail.chooseCards' : 'detail.lead');
    const turnBanner = $('turn-banner');
    turnBanner.querySelector('span').textContent = turnDetail;
    turnBanner.classList.toggle('attention', Boolean(state.message && ['message.noPlay', 'message.invalidPattern', 'message.cannotBeat', 'message.mustLead'].includes(state.message.key)));
    const countdown = $('countdown');
    countdown.textContent = model.remaining === null ? '∞' : model.remaining;
    countdown.classList.toggle('warning', model.remaining !== null && model.remaining <= 5);
    const announcement = $('countdown-announcement');
    if (model.remaining === null || model.remaining > 5) {
      if (lastTimerAnnouncement !== null) announcement.textContent = '';
      lastTimerAnnouncement = null;
    }
    if ([5, 3, 1].includes(model.remaining) && model.remaining !== lastTimerAnnouncement) {
      announcement.textContent = DDZ.t('timer.remaining', { count: model.remaining });
      lastTimerAnnouncement = model.remaining;
    }
    document.body.classList.toggle('reduced-motion', model.settings.animation === 'reduced');
    document.body.classList.toggle('no-motion', model.settings.animation === 'off');
    const sizeOffset = model.settings.cardSize === 'small' ? '-10px' : model.settings.cardSize === 'large' ? '10px' : '0px';
    const stepOffset = model.settings.cardSize === 'small' ? '-5px' : model.settings.cardSize === 'large' ? '5px' : '0px';
    document.documentElement.style.setProperty('--card-size-offset', sizeOffset);
    document.documentElement.style.setProperty('--card-step-offset', stepOffset);
    renderPause(state);
  }

  function renderPause(state) {
    let layer = document.querySelector('.pause-layer');
    if (!state.paused) {
      if (layer) layer.remove();
      document.querySelectorAll('.felt-table > [data-pause-inert]').forEach(function (node) { node.inert = false; node.removeAttribute('data-pause-inert'); });
      if (pauseReturnFocus && typeof pauseReturnFocus.focus === 'function') pauseReturnFocus.focus();
      pauseReturnFocus = null;
      return;
    }
    if (!layer) {
      pauseReturnFocus = document.activeElement;
      layer = document.createElement('div'); layer.className = 'pause-layer';
      layer.innerHTML = '<div role="dialog" aria-modal="true" aria-labelledby="pause-title"><h2 id="pause-title">' + DDZ.t('pause.title') + '</h2><p>' + DDZ.t('pause.description') + '</p><button type="button" data-action="resume-game">' + DDZ.t('action.resumeGame') + '</button></div>';
      const table = document.querySelector('.felt-table');
      Array.from(table.children).forEach(function (node) { node.inert = true; node.setAttribute('data-pause-inert', ''); });
      table.appendChild(layer);
      layer.querySelector('button').focus();
    }
  }

  function rulesModal() {
    const items = ['flow', 'sequences', 'attachments', 'comparison', 'multiplier', 'privacy'];
    return '<section class="modal wide" role="dialog" aria-modal="true" aria-labelledby="rules-title"><header class="modal-head"><h2 id="rules-title">' + DDZ.t('rules.title') + '</h2><button type="button" data-action="close-modal" aria-label="' + DDZ.t('action.close') + '">×</button></header><div class="modal-body"><div class="rule-list">'
      + items.map(function (item) { return '<article><h3>' + DDZ.t('rules.' + item + '.title') + '</h3><p>' + DDZ.t('rules.' + item + '.body') + '</p></article>'; }).join('')
      + '</div></div></section>';
  }

  function historyModal(stats) {
    const rate = stats.games ? Math.round(stats.wins / stats.games * 100) + '%' : '—';
    return '<section class="modal" role="dialog" aria-modal="true" aria-labelledby="history-title"><header class="modal-head"><h2 id="history-title">' + DDZ.t('history.title') + '</h2><button type="button" data-action="close-modal" aria-label="' + DDZ.t('action.close') + '">×</button></header><div class="modal-body settlement-grid">'
      + '<div><strong>' + stats.games + '</strong><small>' + DDZ.t('stats.games') + '</small></div><div><strong>' + stats.wins + '</strong><small>' + DDZ.t('stats.wins') + '</small></div><div><strong>' + stats.losses + '</strong><small>' + DDZ.t('stats.losses') + '</small></div><div><strong>' + rate + '</strong><small>' + DDZ.t('stats.winRate') + '</small></div><div><strong>' + stats.score + '</strong><small>' + DDZ.t('stats.totalScore') + '</small></div></div></section>';
  }

  function optionMarkup(value, labelKey, current) {
    return '<option value="' + escapeHtml(value) + '"' + (String(current) === String(value) ? ' selected' : '') + '>' + escapeHtml(DDZ.t(labelKey)) + '</option>';
  }

  function settingRow(labelKey, descriptionKey, control) {
    return '<label class="setting"><span><strong>' + escapeHtml(DDZ.t(labelKey)) + '</strong><small>' + escapeHtml(DDZ.t(descriptionKey)) + '</small></span>' + control + '</label>';
  }

  function preferencesModal(settings) {
    const theme = '<select data-setting="theme">' + optionMarkup('classic', 'theme.classic', settings.theme) + optionMarkup('iroha', 'theme.iroha', settings.theme) + '</select>';
    const difficulty = '<select data-setting="difficulty">' + optionMarkup('easy', 'difficulty.easy', settings.difficulty) + optionMarkup('normal', 'difficulty.normal', settings.difficulty) + optionMarkup('hard', 'difficulty.hard', settings.difficulty) + '</select>';
    const turnSeconds = '<select data-setting="turnSeconds">' + [10, 15, 20, 30, 0].map(function (value) { return optionMarkup(String(value), value === 0 ? 'setting.unlimited' : 'setting.seconds' + value, settings.turnSeconds); }).join('') + '</select>';
    const animation = '<select data-setting="animation">' + optionMarkup('full', 'setting.animationFull', settings.animation) + optionMarkup('reduced', 'setting.animationReduced', settings.animation) + optionMarkup('off', 'setting.animationOff', settings.animation) + '</select>';
    const sortMode = '<select data-setting="sortMode">' + optionMarkup('rank', 'setting.sortRank', settings.sortMode) + optionMarkup('suit', 'setting.sortSuit', settings.sortMode) + '</select>';
    const gameSpeed = '<select data-setting="gameSpeed">' + optionMarkup('slow', 'setting.speedSlow', settings.gameSpeed) + optionMarkup('normal', 'setting.speedNormal', settings.gameSpeed) + optionMarkup('fast', 'setting.speedFast', settings.gameSpeed) + '</select>';
    const cardSize = '<select data-setting="cardSize">' + optionMarkup('small', 'setting.sizeSmall', settings.cardSize) + optionMarkup('medium', 'setting.sizeMedium', settings.cardSize) + optionMarkup('large', 'setting.sizeLarge', settings.cardSize) + '</select>';
    const toggle = function (key, checked, labelKey) { return '<input type="checkbox" data-setting="' + key + '"' + (checked ? ' checked' : '') + ' aria-label="' + escapeHtml(DDZ.t(labelKey)) + '">'; };
    const volume = '<input type="range" data-setting="volume" min="0" max="1" step="0.05" value="' + escapeHtml(settings.volume) + '" aria-label="' + escapeHtml(DDZ.t('setting.volume')) + '">';
    return '<section class="modal preferences-modal" role="dialog" aria-modal="true" aria-labelledby="preferences-title"><header class="modal-head"><h2 id="preferences-title">' + DDZ.t('preferences.title') + '</h2><button type="button" data-action="close-modal" aria-label="' + DDZ.t('action.close') + '">×</button></header><div class="modal-body"><p class="preferences-note">' + escapeHtml(DDZ.t('preferences.personalNote')) + '</p><div class="setting-grid">'
      + settingRow('theme.label', 'setting.themeDescription', theme)
      + settingRow('setting.difficulty', 'setting.difficultyDescription', difficulty)
      + settingRow('setting.turnSeconds', 'setting.turnSecondsDescription', turnSeconds)
      + settingRow('setting.sound', 'setting.soundDescription', toggle('sound', settings.sound, 'setting.sound'))
      + settingRow('setting.music', 'setting.musicDescription', toggle('music', settings.music, 'setting.music'))
      + settingRow('setting.volume', 'setting.volumeDescription', volume)
      + settingRow('setting.animation', 'setting.animationDescription', animation)
      + settingRow('setting.doubleClick', 'setting.doubleClickDescription', toggle('doubleClickPlay', settings.doubleClickPlay, 'setting.doubleClick'))
      + settingRow('setting.sortMode', 'setting.sortModeDescription', sortMode)
      + settingRow('setting.gameSpeed', 'setting.gameSpeedDescription', gameSpeed)
      + settingRow('setting.cardSize', 'setting.cardSizeDescription', cardSize)
      + '</div></div></section>';
  }

  function settlementModal(state, stats) {
    const result = state.settlement;
    return '<section class="modal" role="dialog" aria-modal="true" aria-labelledby="settlement-title"><header class="modal-head"><h2 id="settlement-title">' + DDZ.t('settlement.title') + '</h2></header><div class="modal-body settlement"><div class="result-mark' + (result.humanWon ? '' : ' lose') + '">' + DDZ.t(result.humanWon ? 'settlement.winMark' : 'settlement.loseMark') + '</div><h2>' + DDZ.t(result.humanWon ? 'settlement.winTitle' : 'settlement.loseTitle') + '</h2><p>' + (result.spring ? DDZ.t('settlement.spring') : result.antiSpring ? DDZ.t('settlement.antiSpring') : DDZ.t('settlement.team', { role: roleLabel(state.players[0].role) })) + '</p><div class="settlement-grid">'
      + '<div><strong>' + result.baseScore + '</strong><small>' + DDZ.t('hud.base') + '</small></div><div><strong>×' + result.bidMultiplier + '</strong><small>' + DDZ.t('settlement.bidMultiplier') + '</small></div><div><strong>' + result.bombCount + '</strong><small>' + DDZ.t('settlement.bombs') + '</small></div><div><strong>×' + result.finalMultiplier + '</strong><small>' + DDZ.t('settlement.finalMultiplier') + '</small></div><div><strong>' + (result.scoreDelta > 0 ? '+' : '') + result.scoreDelta + '</strong><small>' + DDZ.t('settlement.scoreDelta') + '</small></div><div><strong>' + stats.wins + '/' + stats.games + '</strong><small>' + DDZ.t('settlement.totalWins') + '</small></div></div><div class="modal-actions"><button class="secondary" data-action="home">' + DDZ.t('action.backHome') + '</button><button class="primary" data-action="new-game">' + DDZ.t('action.playAgain') + '</button></div></div></section>';
  }

  function visibleScreen() { return $('game-screen').hidden ? $('menu-screen') : $('game-screen'); }
  function openModal(html) {
    modalReturnFocus = document.activeElement;
    const screen = visibleScreen();
    screen.inert = true;
    screen.setAttribute('aria-hidden', 'true');
    $('modal-root').innerHTML = html;
    $('modal-root').hidden = false;
    const focusable = $('modal-root').querySelector('button');
    if (focusable) focusable.focus();
  }
  function closeModal() {
    $('modal-root').hidden = true;
    $('modal-root').innerHTML = '';
    ['menu-screen', 'game-screen'].forEach(function (id) { const screen = $(id); screen.inert = false; screen.removeAttribute('aria-hidden'); });
    if (modalReturnFocus && typeof modalReturnFocus.focus === 'function') modalReturnFocus.focus();
    modalReturnFocus = null;
  }
  function trapFocus(event, dialog) {
    if (event.key !== 'Tab') return;
    const nodes = Array.from(dialog.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
    if (!nodes.length) { event.preventDefault(); dialog.focus(); return; }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function handleKeyDown(event) {
    const modal = !$('modal-root').hidden && $('modal-root').querySelector('[role="dialog"]');
    const pauseDialog = document.querySelector('.pause-layer [role="dialog"]');
    const dialog = modal || pauseDialog;
    if (!dialog) return '';
    if (event.key === 'Escape') {
      if (pauseDialog) { event.preventDefault(); return 'resume'; }
      if (modal && modal.querySelector('[data-action="close-modal"]')) { event.preventDefault(); return 'close'; }
    }
    trapFocus(event, dialog);
    return '';
  }
  function reset() {
    const modalRoot = $('modal-root');
    if (modalRoot) { modalRoot.hidden = true; modalRoot.innerHTML = ''; }
    ['menu-screen', 'game-screen'].forEach(function (id) {
      const screen = $(id);
      if (screen) { screen.inert = false; screen.removeAttribute('aria-hidden'); }
    });
    document.querySelectorAll('.felt-table > [data-pause-inert]').forEach(function (node) { node.inert = false; node.removeAttribute('data-pause-inert'); });
    const pauseLayer = document.querySelector('.pause-layer');
    if (pauseLayer) pauseLayer.remove();
    modalReturnFocus = pauseReturnFocus = null;
    lastTimerAnnouncement = null;
  }
  DDZ.render = {
    menu: renderMenu, game: renderGame, cardMarkup: cardMarkup, openModal: openModal, closeModal: closeModal,
    handleKeyDown: handleKeyDown, reset: reset,
    showRules: function () { openModal(rulesModal()); },
    showHistory: function (stats) { openModal(historyModal(stats)); },
    showPreferences: function (settings) { openModal(preferencesModal(settings)); },
    showSettlement: function (state, stats) { openModal(settlementModal(state, stats)); }
  };
})(globalThis);
