(function (root) {
  'use strict';
  const DDZ = root.DDZ = root.DDZ || {};
  const urls = new Map();
  let generation = 0;
  let activeTheme = 'classic';
  const ranks = ['a', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'small-joker', 'big-joker'];
  const paths = Object.fromEntries(ranks.map(function (rank) {
    return [rank, 'assets/theme/iroha/' + rank + '.webp'];
  }));
  paths.back = 'assets/theme/iroha/card-back.webp';

  function normalizeRank(rank) {
    return String(rank || '').toLowerCase();
  }

  function cssUrl(value) {
    return 'url("' + String(value).replace(/["\\\n\r]/g, '') + '")';
  }

  async function loadAsset(key, path, expectedGeneration) {
    if (typeof Tapp === 'undefined' || !Tapp.assets || typeof Tapp.assets.getUrl !== 'function') return '';
    const asset = await Tapp.assets.getUrl(path);
    const url = asset && typeof asset.url === 'string' ? asset.url : '';
    if (!url) return '';
    if (expectedGeneration !== generation) {
      if (typeof Tapp.assets.revoke === 'function') {
        try { Tapp.assets.revoke(url); } catch (_) { /* sandbox also revokes on destroy */ }
      }
      return '';
    }
    urls.set(key, url);
    document.documentElement.style.setProperty('--ddz-theme-' + key, cssUrl(url));
    return url;
  }

  function releaseUrls() {
    if (typeof Tapp !== 'undefined' && Tapp.assets && typeof Tapp.assets.revoke === 'function') {
      urls.forEach(function (url) {
        try { Tapp.assets.revoke(url); } catch (_) { /* sandbox also revokes on destroy */ }
      });
    }
    urls.clear();
    Object.keys(paths).forEach(function (key) {
      document.documentElement.style.removeProperty('--ddz-theme-' + key);
    });
  }

  async function set(theme) {
    const nextTheme = theme === 'iroha' ? 'iroha' : 'classic';
    const expectedGeneration = ++generation;
    releaseUrls();
    activeTheme = nextTheme;
    document.documentElement.classList.toggle('iroha-theme', nextTheme === 'iroha');
    if (nextTheme !== 'iroha') return;
    const entries = Object.entries(paths);
    await Promise.all(entries.map(function (entry) {
      return loadAsset(entry[0], entry[1], expectedGeneration).catch(function () { return ''; });
    }));
  }

  function destroy() {
    generation += 1;
    releaseUrls();
    activeTheme = 'classic';
    document.documentElement.classList.remove('iroha-theme');
  }

  DDZ.theme = {
    set: set,
    destroy: destroy,
    current: function () { return activeTheme; },
    artUrl: function (rank) { return urls.get(normalizeRank(rank)) || ''; },
    backUrl: function () { return urls.get('back') || ''; }
  };
})(globalThis);
