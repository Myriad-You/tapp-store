(function (root) {
  'use strict';
  const DDZ = root.DDZ = root.DDZ || {};
  const keys = { settings: 'settings:v2', stats: 'stats:v2', game: 'saved-game:v2' };
  let settingsWriteQueue = Promise.resolve();
  const defaults = {
    settings: {
      difficulty: 'normal', turnSeconds: 20, sound: true, music: false, volume: 0.65,
      animation: 'full', doubleClickPlay: true, sortMode: 'rank',
      gameSpeed: 'normal', cardSize: 'medium', theme: 'classic'
    },
    stats: {
      wins: 0, losses: 0, games: 0, score: 0,
      daily: { date: '', wins: 0, losses: 0, games: 0, score: 0, lastResult: '' }
    }
  };

  function dateKey(value) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function normalizeStats(value) {
    const source = value && typeof value === 'object' ? value : {};
    const dailySource = source.daily && typeof source.daily === 'object' ? source.daily : {};
    return {
      wins: finiteNumber(source.wins),
      losses: finiteNumber(source.losses),
      games: finiteNumber(source.games),
      score: finiteNumber(source.score),
      daily: {
        date: typeof dailySource.date === 'string' ? dailySource.date : '',
        wins: finiteNumber(dailySource.wins),
        losses: finiteNumber(dailySource.losses),
        games: finiteNumber(dailySource.games),
        score: finiteNumber(dailySource.score),
        lastResult: dailySource.lastResult === 'win' || dailySource.lastResult === 'loss' ? dailySource.lastResult : ''
      }
    };
  }

  function applySettlement(value, settlement, now) {
    const next = normalizeStats(value);
    const today = dateKey(now);
    if (next.daily.date !== today) {
      next.daily = { date: today, wins: 0, losses: 0, games: 0, score: 0, lastResult: '' };
    }
    const won = Boolean(settlement && settlement.won);
    const score = finiteNumber(settlement && settlement.score);
    next.games += 1;
    next.score += score;
    next.daily.games += 1;
    next.daily.score += score;
    next.daily.lastResult = won ? 'win' : 'loss';
    if (won) {
      next.wins += 1;
      next.daily.wins += 1;
    } else {
      next.losses += 1;
      next.daily.losses += 1;
    }
    return next;
  }

  function normalizeSettings(value) {
    const next = Object.assign({}, defaults.settings, value || {});
    next.turnSeconds = [0, 10, 15, 20, 30].includes(Number(next.turnSeconds)) ? Number(next.turnSeconds) : 20;
    next.volume = Math.max(0, Math.min(1, Number(next.volume)));
    if (!Number.isFinite(next.volume)) next.volume = defaults.settings.volume;
    ['sound', 'music', 'doubleClickPlay'].forEach(function (key) {
      if (next[key] === 'true') next[key] = true;
      if (next[key] === 'false') next[key] = false;
      next[key] = Boolean(next[key]);
    });
    if (!['easy', 'normal', 'hard'].includes(next.difficulty)) next.difficulty = 'normal';
    if (!['full', 'reduced', 'off'].includes(next.animation)) next.animation = 'full';
    if (!['rank', 'suit'].includes(next.sortMode)) next.sortMode = 'rank';
    if (!['slow', 'normal', 'fast'].includes(next.gameSpeed)) next.gameSpeed = 'normal';
    if (!['small', 'medium', 'large'].includes(next.cardSize)) next.cardSize = 'medium';
    if (!['classic', 'iroha'].includes(next.theme)) next.theme = 'classic';
    return next;
  }

  async function get(key, fallback) {
    try {
      if (typeof Tapp === 'undefined' || !Tapp.storage) return fallback;
      const value = await Tapp.storage.get(key);
      return value && typeof value === 'object' ? Object.assign({}, fallback || {}, value) : fallback;
    } catch (_) { return fallback; }
  }

  async function set(key, value) {
    try {
      if (typeof Tapp !== 'undefined' && Tapp.storage) await Tapp.storage.set(key, value);
    } catch (_) { /* Storage failure must never stop a match. */ }
  }

  async function remove(key) {
    try {
      if (typeof Tapp !== 'undefined' && Tapp.storage) await Tapp.storage.remove(key);
    } catch (_) { /* best effort */ }
  }

  async function loadSettings() {
    return normalizeSettings(await get(keys.settings, {}));
  }

  function saveSetting(key, value) {
    settingsWriteQueue = settingsWriteQueue.then(async function () {
      const current = await get(keys.settings, {});
      await set(keys.settings, Object.assign({}, current, { [key]: value }));
    });
    return settingsWriteQueue;
  }

  DDZ.storage = {
    defaults: defaults,
    loadSettings: loadSettings,
    saveSetting: saveSetting,
    loadStats: async function () { return normalizeStats(await get(keys.stats, defaults.stats)); },
    saveStats: function (value) { return set(keys.stats, value); },
    loadGame: function () { return get(keys.game, null); },
    saveGame: function (value) { return set(keys.game, value); },
    clearGame: function () { return remove(keys.game); },
    clearStats: async function () { await remove(keys.stats); return normalizeStats(defaults.stats); },
    normalizeStats: normalizeStats,
    applySettlement: applySettlement,
    dateKey: dateKey
  };
})(globalThis);
