(function (root) {
  'use strict';
  const DDZ = root.DDZ = root.DDZ || {};
  let state = null;
  let settings = null;
  let stats = null;
  let savedGame = null;
  let remaining = null;
  let countdownTimer = null;
  let phaseTimer = null;
  let aiTimer = null;
  let toastTimer = null;
  let thinking = false;
  let actionLocked = false;
  let pausedBeforeModal = false;
  let settledRound = null;
  let themeOff = null;
  let localeOff = null;

  function clearTimers() {
    if (countdownTimer) clearInterval(countdownTimer);
    if (phaseTimer) clearTimeout(phaseTimer);
    if (aiTimer) clearTimeout(aiTimer);
    countdownTimer = phaseTimer = aiTimer = null;
  }

  function toast(message) {
    const node = document.getElementById('toast');
    node.textContent = message; node.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 2200);
  }

  function model() { return { state: state, settings: settings, stats: stats, savedGame: savedGame, remaining: remaining, thinking: thinking }; }

  function render() {
    document.getElementById('ddz-app').dataset.phase = state.phase;
    if (state.phase === 'menu') DDZ.render.menu(model()); else DDZ.render.game(model());
  }

  function saveState() {
    if (['dealing', 'bidding', 'playing'].includes(state.phase)) {
      savedGame = Object.assign({}, state, { paused: true, busy: false, selectedIds: [], hintIndex: -1 });
      DDZ.storage.saveGame(savedGame);
    } else if (state.phase === 'finished') {
      savedGame = null; DDZ.storage.clearGame();
    }
  }

  function schedule() {
    clearTimers();
    thinking = false;
    if (state.paused || state.phase === 'menu' || state.phase === 'finished') { render(); return; }
    const serial = state.actionSerial;
    if (state.phase === 'dealing') {
      remaining = null;
      DDZ.audio.play('deal', settings);
      const delay = settings.animation === 'off' ? 120 : settings.gameSpeed === 'fast' ? 420 : settings.gameSpeed === 'slow' ? 1100 : 760;
      phaseTimer = setTimeout(function () {
        if (state.actionSerial === serial && state.phase === 'dealing') update(DDZ.engine.beginBidding(state));
      }, delay);
      render(); return;
    }

    const seconds = state.phase === 'bidding' ? 10 : settings.turnSeconds;
    remaining = seconds === 0 ? null : seconds;
    if (seconds > 0) {
      const deadline = Date.now() + seconds * 1000;
      countdownTimer = setInterval(function () {
        if (state.actionSerial !== serial || state.paused) return;
        const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        if (next !== remaining) {
          remaining = next;
          if (next > 0 && next <= 3) DDZ.audio.play('tick', settings);
          render();
        }
        if (next === 0) {
          clearInterval(countdownTimer); countdownTimer = null;
          if (state.actionSerial === serial) update(DDZ.engine.timeout(state, { sortMode: settings.sortMode }));
        }
      }, 160);
    }

    if (state.currentPlayer !== 0) {
      thinking = true;
      aiTimer = setTimeout(function () {
        if (state.actionSerial !== serial || state.paused || state.currentPlayer === 0) return;
        let next;
        if (state.phase === 'bidding') {
          next = DDZ.engine.bid(state, state.currentPlayer, DDZ.ai.chooseBid(state, state.currentPlayer, settings.difficulty), { sortMode: settings.sortMode });
        } else {
          const play = DDZ.ai.choosePlay(state, state.currentPlayer, settings.difficulty);
          next = play ? DDZ.engine.play(state, state.currentPlayer, play) : DDZ.engine.pass(state, state.currentPlayer);
        }
        update(next);
      }, DDZ.ai.delay(settings.gameSpeed));
    }
    render();
  }

  async function settleOnce() {
    if (state.phase !== 'finished' || !state.settlement || settledRound === state.round) return;
    settledRound = state.round;
    stats = {
      wins: stats.wins + (state.settlement.humanWon ? 1 : 0),
      losses: stats.losses + (state.settlement.humanWon ? 0 : 1),
      games: stats.games + 1,
      score: stats.score + state.settlement.scoreDelta
    };
    await DDZ.storage.saveStats(stats);
    DDZ.audio.play(state.settlement.humanWon ? 'win' : 'lose', settings);
    render();
    DDZ.render.showSettlement(state, stats);
  }

  function announceTransition(previous, next) {
    if (next.history.length > previous.history.length) {
      const record = next.history[next.history.length - 1];
      if (record.pass) { DDZ.audio.play('pass', settings); }
      else if (record.pattern) {
        DDZ.audio.play(record.pattern.type === 'rocket' ? 'rocket' : record.pattern.type === 'bomb' ? 'bomb' : 'play', settings);
      }
    }
  }

  function update(next, options) {
    if (!next || next === state) { render(); return; }
    const previous = state;
    state = next;
    announceTransition(previous, next);
    saveState();
    schedule();
    if (!options || !options.skipSettlement) settleOnce();
  }

  function commit(operation) {
    if (actionLocked) return;
    actionLocked = true;
    const next = operation(state);
    update(next);
    setTimeout(function () { actionLocked = false; }, 130);
  }

  function startNewGame() {
    DDZ.audio.unlock(); DDZ.render.closeModal(); DDZ.storage.clearGame(); savedGame = null;
    settledRound = null;
    state = DDZ.engine.startGame({ round: (state.round || 0) + 1, sortMode: settings.sortMode });
    saveState(); schedule();
  }

  function goHome() {
    DDZ.render.closeModal();
    if (['dealing', 'bidding', 'playing'].includes(state.phase)) saveState();
    clearTimers(); thinking = false; remaining = null;
    state = DDZ.engine.menuState(); render();
  }

  function pause(value) {
    if (!['dealing', 'bidding', 'playing'].includes(state.phase)) return;
    state = Object.assign({}, state, { paused: value === undefined ? !state.paused : value });
    saveState(); schedule();
    if (state.paused) DDZ.audio.suspend(); else DDZ.audio.setMusic(settings.music, settings.volume);
  }

  function openPanel(type) {
    pausedBeforeModal = state.paused;
    if (state.phase !== 'menu' && !state.paused) pause(true);
    if (type === 'rules') DDZ.render.showRules();
    if (type === 'history') DDZ.render.showHistory(stats);
  }

  function closePanel() {
    DDZ.render.closeModal();
    if (state.phase !== 'menu' && state.phase !== 'finished' && !pausedBeforeModal) pause(false);
  }

  function setDifficulty(value) {
    if (!['easy', 'normal', 'hard'].includes(value)) return;
    settings = Object.assign({}, settings, { difficulty: value });
    DDZ.storage.saveSetting('difficulty', value);
    render();
  }

  async function refreshSettings() {
    const previousSort = settings && settings.sortMode;
    settings = await DDZ.storage.loadSettings();
    if (state && previousSort && previousSort !== settings.sortMode) state = DDZ.engine.sortHuman(state, settings.sortMode);
    if (state) DDZ.audio.setMusic(settings.music && state.phase !== 'menu' && !state.paused, settings.volume);
    if (state) render();
  }

  function action(name, target) {
    DDZ.audio.unlock();
    if (name !== 'play' && name !== 'hint') DDZ.audio.play('click', settings);
    if (name === 'new-game') startNewGame();
    else if (name === 'resume' && savedGame) { state = Object.assign({}, savedGame, { paused: false, busy: false }); schedule(); }
    else if (name === 'home') goHome();
    else if (name === 'rules' || name === 'history') openPanel(name);
    else if (name === 'close-modal') closePanel();
    else if (name === 'pause') pause();
    else if (name === 'resume-game') pause(false);
    else if (name === 'bid-yes') commit(function (current) { return DDZ.engine.bid(current, 0, true, { sortMode: settings.sortMode }); });
    else if (name === 'bid-no') commit(function (current) { return DDZ.engine.bid(current, 0, false, { sortMode: settings.sortMode }); });
    else if (name === 'play') commit(function (current) { return DDZ.engine.play(current, 0, DDZ.engine.selectedCards(current)); });
    else if (name === 'pass') commit(function (current) { return DDZ.engine.pass(current, 0); });
    else if (name === 'hint') update(DDZ.engine.hint(state), { skipSettlement: true });
    else if (name === 'clear') update(Object.assign({}, state, { selectedIds: [], hintIndex: -1 }), { skipSettlement: true });
    else if (name === 'clear-stats') {
      DDZ.storage.clearStats().then(function (value) { stats = value; toast(DDZ.t('toast.statsCleared')); render(); });
    }
  }

  function onClick(event) {
    const difficulty = event.target.closest('[data-difficulty]');
    if (difficulty) { setDifficulty(difficulty.dataset.difficulty); return; }
    const card = event.target.closest('[data-card-id]');
    if (card) {
      DDZ.audio.play('select', settings);
      update(DDZ.engine.toggleCard(state, card.dataset.cardId), { skipSettlement: true });
      return;
    }
    const button = event.target.closest('[data-action]');
    if (button && !button.disabled) action(button.dataset.action, button);
  }

  function onDoubleClick(event) {
    const cardNode = event.target.closest('[data-card-id]');
    if (!cardNode || !settings.doubleClickPlay || state.currentPlayer !== 0) return;
    const card = state.players[0].hand.find(function (item) { return item.id === cardNode.dataset.cardId; });
    if (card) commit(function (current) { return DDZ.engine.play(current, 0, [card]); });
  }

  async function init() {
    [settings, stats, savedGame] = await Promise.all([
      DDZ.storage.loadSettings(), DDZ.storage.loadStats(), DDZ.storage.loadGame()
    ]);
    savedGame = DDZ.engine.normalizeSavedState(savedGame);
    state = DDZ.engine.menuState();
    DDZ.applyStaticI18n(document);
    try {
      if (typeof Tapp !== 'undefined' && Tapp.ui) {
        if (typeof Tapp.ui.getTheme === 'function') applyTheme(await Tapp.ui.getTheme());
        if (typeof Tapp.ui.onThemeChange === 'function') themeOff = Tapp.ui.onThemeChange(applyTheme);
        if (typeof Tapp.ui.onLocaleChange === 'function') localeOff = Tapp.ui.onLocaleChange(function () { DDZ.applyStaticI18n(document); render(); });
      }
    } catch (_) { applyTheme(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
    document.addEventListener('click', onClick);
    document.addEventListener('dblclick', onDoubleClick);
    render();
  }

  function destroy() {
    clearTimers();
    if (toastTimer) clearTimeout(toastTimer);
    DDZ.audio.destroy();
    if (typeof themeOff === 'function') themeOff();
    if (typeof localeOff === 'function') localeOff();
  }

  function applyTheme(theme) {
    const dark = theme === true || String(theme).toLowerCase() === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
  }

  if (typeof Tapp !== 'undefined' && Tapp.lifecycle) {
    Tapp.lifecycle.onReady(init);
    Tapp.lifecycle.onPause(function () { if (state && state.phase !== 'menu') pause(true); });
    Tapp.lifecycle.onResume(refreshSettings);
    Tapp.lifecycle.onDestroy(destroy);
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
    root.addEventListener('beforeunload', destroy);
  }
})(globalThis);
