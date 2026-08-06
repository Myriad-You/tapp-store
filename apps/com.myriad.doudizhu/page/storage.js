(function (root) {
  'use strict';
  const DDZ = root.DDZ = root.DDZ || {};
  const keys = { settings: 'settings:v2', stats: 'stats:v2', game: 'saved-game:v2' };
  const defaults = {
    settings: {
      difficulty: 'normal', turnSeconds: 20, sound: true, music: false, volume: 0.65,
      animation: 'full', doubleClickPlay: true, sortMode: 'rank',
      gameSpeed: 'normal', cardSize: 'medium'
    },
    stats: { wins: 0, losses: 0, games: 0, score: 0 }
  };

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
    const personal = await get(keys.settings, {});
    let installationDefaults = {};
    try {
      if (typeof Tapp !== 'undefined' && Tapp.settings) {
        installationDefaults = await Tapp.settings.getAll() || {};
      }
    } catch (_) { /* Manifest defaults remain available when the host is unavailable. */ }
    return normalizeSettings(Object.assign({}, installationDefaults, personal));
  }

  async function saveSetting(key, value) {
    const current = await get(keys.settings, {});
    await set(keys.settings, Object.assign({}, current, { [key]: value }));
  }

  DDZ.storage = {
    defaults: defaults,
    loadSettings: loadSettings,
    saveSetting: saveSetting,
    loadStats: function () { return get(keys.stats, defaults.stats); },
    saveStats: function (value) { return set(keys.stats, value); },
    loadGame: function () { return get(keys.game, null); },
    saveGame: function (value) { return set(keys.game, value); },
    clearGame: function () { return remove(keys.game); },
    clearStats: async function () { await remove(keys.stats); return Object.assign({}, defaults.stats); }
  };
})(globalThis);
