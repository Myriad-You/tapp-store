(function (root) {
  'use strict';
  const DDZ = root.DDZ = root.DDZ || {};
  let state = null;
  let settings = null;
  let stats = null;
  let savedGame = null;
  let profile = null;
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
  let actionUnlockTimer = null;
  let initialized = false;
  let initGeneration = 0;
  let cardDrag = null;
  let suppressCardClickUntil = 0;

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

  function model() { return { state: state, settings: settings, stats: stats, savedGame: savedGame, remaining: remaining, thinking: thinking, profile: profile }; }

  function render() {
    document.getElementById('ddz-app').dataset.phase = state.phase;
    const background = document.getElementById('tapp-background');
    if (background) background.dataset.phase = state.phase;
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
    stats = DDZ.storage.applySettlement(stats, {
      won: state.settlement.humanWon,
      score: state.settlement.scoreDelta
    });
    await DDZ.storage.saveStats(stats);
    if (!initialized || state.phase !== 'finished' || settledRound !== state.round) return;
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
    if (options && options.preserveSchedule) render(); else schedule();
    if (!options || !options.skipSettlement) settleOnce();
  }

  function commit(operation) {
    if (actionLocked) return;
    actionLocked = true;
    const current = state;
    const next = operation(current);
    update(next, { preserveSchedule: Boolean(next && next.actionSerial === current.actionSerial) });
    if (actionUnlockTimer) clearTimeout(actionUnlockTimer);
    actionUnlockTimer = setTimeout(function () { actionLocked = false; actionUnlockTimer = null; }, 130);
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
    if (type === 'preferences') DDZ.render.showPreferences(settings);
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

  async function setTheme(value) {
    if (!['classic', 'iroha'].includes(value) || settings.theme === value) return;
    settings = Object.assign({}, settings, { theme: value });
    await DDZ.storage.saveSetting('theme', value);
    if (DDZ.theme && typeof DDZ.theme.set === 'function') await DDZ.theme.set(value);
    if (initialized && state) render();
  }

  function setPreference(key, target) {
    const allowed = {
      difficulty: ['easy', 'normal', 'hard'],
      animation: ['full', 'reduced', 'off'],
      sortMode: ['rank', 'suit'],
      gameSpeed: ['slow', 'normal', 'fast'],
      cardSize: ['small', 'medium', 'large']
    };
    if (key === 'theme') { setTheme(target.value); return; }
    let value = target.type === 'checkbox' ? target.checked : target.value;
    if (key === 'turnSeconds') {
      value = Number(value);
      if (![0, 10, 15, 20, 30].includes(value)) return;
    } else if (key === 'volume') {
      value = Math.max(0, Math.min(1, Number(value)));
      if (!Number.isFinite(value)) return;
    } else if (allowed[key] && !allowed[key].includes(value)) return;
    else if (['sound', 'music', 'doubleClickPlay'].includes(key)) value = Boolean(value);
    else if (!Object.prototype.hasOwnProperty.call(allowed, key)) return;
    const previousSort = settings.sortMode;
    settings = Object.assign({}, settings, { [key]: value });
    DDZ.storage.saveSetting(key, value);
    if (key === 'sortMode' && state && previousSort !== value) state = DDZ.engine.sortHuman(state, value);
    if (['music', 'volume'].includes(key) && state) DDZ.audio.setMusic(settings.music && state.phase !== 'menu' && !state.paused, settings.volume);
    if (state) render();
  }

  async function refreshSettings() {
    const generation = initGeneration;
    const previousSort = settings && settings.sortMode;
    const previousTheme = settings && settings.theme;
    const values = await Promise.all([DDZ.storage.loadSettings(), loadProfile()]);
    if (!initialized || generation !== initGeneration) return;
    settings = values[0];
    profile = values[1];
    DDZ.profile = profile;
    if (previousTheme !== settings.theme && DDZ.theme && typeof DDZ.theme.set === 'function') await DDZ.theme.set(settings.theme);
    if (!initialized || generation !== initGeneration) return;
    if (state && previousSort && previousSort !== settings.sortMode) state = DDZ.engine.sortHuman(state, settings.sortMode);
    if (state) DDZ.audio.setMusic(settings.music && state.phase !== 'menu' && !state.paused, settings.volume);
    if (state) render();
  }

  async function loadProfile() {
    try {
      if (typeof Tapp !== 'undefined' && Tapp.context && typeof Tapp.context.getUser === 'function') {
        const user = await Tapp.context.getUser();
        if (user && typeof user === 'object') {
          return {
            name: typeof user.username === 'string' && user.username.trim() ? user.username.trim() : '',
            avatar: typeof user.avatar_url === 'string' && user.avatar_url.trim()
              ? user.avatar_url.trim()
              : typeof user.avatar === 'string' ? user.avatar : ''
          };
        }
      }
    } catch (_) { /* Anonymous and older hosts use the local fallback identity. */ }
    return null;
  }

  function action(name, target) {
    DDZ.audio.unlock();
    if (name !== 'play' && name !== 'hint') DDZ.audio.play('click', settings);
    if (name === 'new-game') startNewGame();
    else if (name === 'resume' && savedGame) { state = Object.assign({}, savedGame, { paused: false, busy: false }); schedule(); }
    else if (name === 'home') goHome();
    else if (name === 'rules' || name === 'history' || name === 'preferences') openPanel(name);
    else if (name === 'close-modal') closePanel();
    else if (name === 'pause') pause();
    else if (name === 'resume-game') pause(false);
    else if (name === 'bid-yes') commit(function (current) { return DDZ.engine.bid(current, 0, true, { sortMode: settings.sortMode }); });
    else if (name === 'bid-no') commit(function (current) { return DDZ.engine.bid(current, 0, false, { sortMode: settings.sortMode }); });
    else if (name === 'play') commit(function (current) { return DDZ.engine.play(current, 0, DDZ.engine.selectedCards(current)); });
    else if (name === 'pass') commit(function (current) { return DDZ.engine.pass(current, 0); });
    else if (name === 'hint') {
      const next = DDZ.engine.hint(state);
      update(next, { skipSettlement: true, preserveSchedule: true });
      if (next.message && next.message.key === 'message.noPlay') {
        DDZ.audio.play('notice', settings);
        toast(DDZ.message(next.message));
      }
    }
    else if (name === 'clear') update(Object.assign({}, state, { selectedIds: [], hintIndex: -1, message: '' }), { skipSettlement: true, preserveSchedule: true });
    else if (name === 'clear-stats') {
      DDZ.storage.clearStats().then(function (value) { stats = value; toast(DDZ.t('toast.statsCleared')); render(); });
    }
  }

  function onClick(event) {
    const difficulty = event.target.closest('[data-difficulty]');
    if (difficulty) { setDifficulty(difficulty.dataset.difficulty); return; }
    const themeChoice = event.target.closest('[data-theme-choice]');
    if (themeChoice) { setTheme(themeChoice.dataset.themeChoice); return; }
    const card = event.target.closest('[data-card-id]');
    if (card) {
      if (event.detail !== 0 && Date.now() < suppressCardClickUntil) return;
      DDZ.audio.play('select', settings);
      update(DDZ.engine.toggleCard(state, card.dataset.cardId), { skipSettlement: true, preserveSchedule: true });
      return;
    }
    const button = event.target.closest('[data-action]');
    if (button && !button.disabled) action(button.dataset.action, button);
  }

  function onChange(event) {
    const control = event.target.closest('[data-setting]');
    if (control) setPreference(control.dataset.setting, control);
  }

  function onDoubleClick(event) {
    const cardNode = event.target.closest('[data-card-id]');
    if (!cardNode || !settings.doubleClickPlay || state.currentPlayer !== 0) return;
    const card = state.players[0].hand.find(function (item) { return item.id === cardNode.dataset.cardId; });
    if (card) commit(function (current) { return DDZ.engine.play(current, 0, [card]); });
  }

  function cardAtPoint(event) {
    const node = document.elementFromPoint(event.clientX, event.clientY);
    return node && node.closest ? node.closest('#human-hand [data-card-id]') : null;
  }

  function applyDragCard(card) {
    if (!cardDrag || !card || cardDrag.visited.has(card.dataset.cardId)) return;
    cardDrag.visited.add(card.dataset.cardId);
    update(DDZ.engine.setCardSelected(state, card.dataset.cardId, cardDrag.select), { skipSettlement: true, preserveSchedule: true });
  }

  function applyDragThrough(card) {
    if (!cardDrag || !card) return;
    const cards = Array.from(document.querySelectorAll('#human-hand [data-card-id]'));
    const targetIndex = cards.findIndex(function (item) { return item.dataset.cardId === card.dataset.cardId; });
    const previousIndex = cards.findIndex(function (item) { return item.dataset.cardId === cardDrag.lastCardId; });
    if (targetIndex < 0) return;
    if (previousIndex < 0) applyDragCard(cards[targetIndex]);
    else {
      const direction = targetIndex >= previousIndex ? 1 : -1;
      for (let index = previousIndex; index !== targetIndex + direction; index += direction) applyDragCard(cards[index]);
    }
    cardDrag.lastCardId = card.dataset.cardId;
  }

  function endCardDrag(event) {
    if (!cardDrag || (event && event.pointerId !== cardDrag.pointerId)) return;
    const wasActive = cardDrag.active;
    const hand = document.getElementById('human-hand');
    if (hand) {
      hand.classList.remove('drag-selecting');
      if (hand.hasPointerCapture && hand.hasPointerCapture(cardDrag.pointerId)) hand.releasePointerCapture(cardDrag.pointerId);
    }
    cardDrag = null;
    if (wasActive && event && event.type === 'pointerup') suppressCardClickUntil = Date.now() + 250;
  }

  function onPointerDown(event) {
    const card = event.target.closest('#human-hand [data-card-id]');
    if (cardDrag || !card || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0) || state.phase !== 'playing' || state.currentPlayer !== 0 || state.paused || state.busy) return;
    cardDrag = {
      pointerId: event.pointerId,
      startCard: card,
      startX: event.clientX,
      startY: event.clientY,
      select: !state.selectedIds.includes(card.dataset.cardId),
      visited: new Set(),
      lastCardId: card.dataset.cardId,
      active: false
    };
  }

  function onPointerMove(event) {
    if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
    if (!cardDrag.active) {
      const distanceX = Math.abs(event.clientX - cardDrag.startX);
      const distanceY = Math.abs(event.clientY - cardDrag.startY);
      if (Math.max(distanceX, distanceY) < 8) return;
      if (distanceY > distanceX) { suppressCardClickUntil = Date.now() + 250; endCardDrag(event); return; }
      const hand = document.getElementById('human-hand');
      cardDrag.active = true;
      hand.classList.add('drag-selecting');
      if (hand.setPointerCapture) hand.setPointerCapture(event.pointerId);
      DDZ.audio.play('select', settings);
      applyDragCard(cardDrag.startCard);
    }
    if (event.cancelable) event.preventDefault();
    applyDragThrough(cardAtPoint(event));
  }

  function onKeyDown(event) {
    if (!DDZ.render || typeof DDZ.render.handleKeyDown !== 'function') return;
    const command = DDZ.render.handleKeyDown(event);
    if (command === 'close') closePanel();
    if (command === 'resume') pause(false);
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    const generation = ++initGeneration;
    const values = await Promise.all([
      DDZ.storage.loadSettings(), DDZ.storage.loadStats(), DDZ.storage.loadGame(), loadProfile()
    ]);
    settings = values[0]; stats = values[1]; savedGame = values[2]; profile = values[3];
    if (!initialized || generation !== initGeneration) return;
    if (DDZ.theme && typeof DDZ.theme.set === 'function') await DDZ.theme.set(settings.theme);
    if (!initialized || generation !== initGeneration) return;
    DDZ.profile = profile;
    savedGame = DDZ.engine.normalizeSavedState(savedGame);
    state = DDZ.engine.menuState();
    DDZ.applyStaticI18n(document);
    try {
      if (typeof Tapp !== 'undefined' && Tapp.ui) {
        if (typeof Tapp.ui.getTheme === 'function') {
          const theme = await Tapp.ui.getTheme();
          if (!initialized || generation !== initGeneration) return;
          applyTheme(theme);
        }
        if (typeof Tapp.ui.onThemeChange === 'function') themeOff = Tapp.ui.onThemeChange(applyTheme);
        if (typeof Tapp.ui.onLocaleChange === 'function') localeOff = Tapp.ui.onLocaleChange(function () { DDZ.applyStaticI18n(document); render(); });
      }
    } catch (_) { applyTheme(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
    if (!initialized || generation !== initGeneration) return;
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('dblclick', onDoubleClick);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', endCardDrag);
    document.addEventListener('pointercancel', endCardDrag);
    document.addEventListener('keydown', onKeyDown);
    render();
  }

  function destroy() {
    if (!initialized) return;
    initialized = false;
    initGeneration += 1;
    clearTimers();
    if (toastTimer) clearTimeout(toastTimer);
    if (actionUnlockTimer) clearTimeout(actionUnlockTimer);
    toastTimer = actionUnlockTimer = null;
    actionLocked = false;
    document.removeEventListener('click', onClick);
    document.removeEventListener('change', onChange);
    document.removeEventListener('dblclick', onDoubleClick);
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', endCardDrag);
    document.removeEventListener('pointercancel', endCardDrag);
    document.removeEventListener('keydown', onKeyDown);
    endCardDrag();
    if (DDZ.render && typeof DDZ.render.reset === 'function') DDZ.render.reset();
    DDZ.audio.destroy();
    if (DDZ.theme && typeof DDZ.theme.destroy === 'function') DDZ.theme.destroy();
    if (typeof themeOff === 'function') themeOff();
    if (typeof localeOff === 'function') localeOff();
    themeOff = localeOff = null;
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
