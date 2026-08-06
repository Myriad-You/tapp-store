(function (root) {
  'use strict';
  let midnightTimer = null;
  let renderGeneration = 0;
  const resultAssetUrls = new Map();
  const RESULT_ASSETS = {
    win: 'assets/widget/landlord-win.png',
    loss: 'assets/widget/farmer-loss.png'
  };

  function t(key, params) {
    try { return Tapp.i18n.t(key, params || {}); } catch (_) { return key; }
  }

  function dateKey(value) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function number(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function todayStats(value) {
    const daily = value && value.daily && typeof value.daily === 'object' ? value.daily : {};
    if (daily.date !== dateKey()) return { wins: 0, losses: 0, games: 0, score: 0, lastResult: '' };
    return {
      wins: number(daily.wins), losses: number(daily.losses), games: number(daily.games), score: number(daily.score),
      lastResult: daily.lastResult === 'win' || daily.lastResult === 'loss' ? daily.lastResult : ''
    };
  }

  function safeAvatarUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const url = value.trim();
    if (/^data:image\//i.test(url) || /^blob:/i.test(url) || url.startsWith('/')) return url;
    try {
      const parsed = new URL(url, root.location.href);
      return parsed.origin === root.location.origin && parsed.origin !== 'null' ? parsed.href : '';
    } catch (_) { return ''; }
  }

  function setText(scope, selector, value) {
    const node = scope.querySelector(selector);
    if (node) node.textContent = String(value);
  }

  function scheduleMidnightRefresh() {
    if (midnightTimer) clearTimeout(midnightTimer);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    midnightTimer = setTimeout(function () {
      midnightTimer = null;
      try { if (Tapp.widget && typeof Tapp.widget.invalidate === 'function') Tapp.widget.invalidate(); } catch (_) { /* host refresh is best effort */ }
    }, Math.max(1000, next.getTime() - now.getTime()));
  }

  async function resultAssetUrl(mood) {
    const path = RESULT_ASSETS[mood];
    if (!path || !Tapp.assets || typeof Tapp.assets.getUrl !== 'function') return '';
    if (resultAssetUrls.has(path)) return resultAssetUrls.get(path);
    const asset = await Tapp.assets.getUrl(path);
    const url = asset && typeof asset.url === 'string' ? asset.url : '';
    if (url) resultAssetUrls.set(path, url);
    return url;
  }

  async function render(container, props) {
    const generation = ++renderGeneration;
    const results = await Promise.all([
      Tapp.storage.get('stats:v2').catch(function () { return null; }),
      Tapp.context && typeof Tapp.context.getUser === 'function' ? Tapp.context.getUser().catch(function () { return null; }) : Promise.resolve(null)
    ]);
    const daily = todayStats(results[0]);
    const user = results[1] || {};
    const scope = container.querySelector('[data-widget-root]') || container;
    const mood = daily.games ? daily.lastResult : 'empty';
    const size = props && props.size ? props.size : '2x2';
    const theme = props && props.theme ? props.theme : 'light';
    const name = typeof user.username === 'string' && user.username.trim() ? user.username.trim() : t('player.human');
    const initial = Array.from(name)[0] || t('player.initialHuman');
    const rate = daily.games ? Math.round(daily.wins / daily.games * 100) + '%' : '—';
    const score = (daily.score > 0 ? '+' : '') + daily.score;
    const artUrl = size === '1x1' ? '' : await resultAssetUrl(mood).catch(function () { return ''; });
    if (generation !== renderGeneration) return;

    scope.dataset.size = size;
    scope.dataset.theme = theme;
    scope.dataset.mood = mood;
    scope.setAttribute('aria-label', t('widget.summary', {
      name: name,
      wins: daily.wins,
      losses: daily.losses,
      games: daily.games,
      rate: rate,
      score: score,
      mood: t('widget.' + mood)
    }));
    scope.style.setProperty('--ddz-widget-scale', String(props && props.scale || 1));
    scope.style.setProperty('--ddz-widget-font-scale', String(props && props.fontScale || 1));
    setText(scope, '[data-user-name]', name);
    setText(scope, '[data-user-initial]', initial);
    setText(scope, '[data-record]', daily.wins + ' - ' + daily.losses);
    setText(scope, '[data-games]', t('widget.gamesValue', { count: daily.games }));
    setText(scope, '[data-win-rate]', rate);
    setText(scope, '[data-score]', t('widget.scoreValue', { score: score }));
    setText(scope, '[data-mood-label]', t('widget.' + mood + 'Short'));
    scope.querySelectorAll('[data-i18n]').forEach(function (node) { node.textContent = t(node.dataset.i18n); });

    const image = scope.querySelector('[data-user-avatar]');
    const avatarUrl = safeAvatarUrl(user.avatar);
    if (image) {
      image.hidden = !avatarUrl;
      image.removeAttribute('src');
      if (avatarUrl) {
        image.addEventListener('error', function () { image.hidden = true; image.removeAttribute('src'); }, { once: true });
        image.src = avatarUrl;
      }
    }

    const resultImage = scope.querySelector('[data-result-art]');
    if (resultImage) {
      resultImage.hidden = true;
      resultImage.removeAttribute('src');
      if (artUrl) {
        resultImage.addEventListener('error', function () { resultImage.hidden = true; resultImage.removeAttribute('src'); }, { once: true });
        resultImage.src = artUrl;
        resultImage.hidden = false;
      }
    }
    scheduleMidnightRefresh();
  }

  if (typeof root.Tapp !== 'undefined' && root.Tapp.widgets) root.Tapp.widgets['daily-record'] = { render: render };
  if (typeof root.Tapp !== 'undefined' && root.Tapp.lifecycle && typeof root.Tapp.lifecycle.onDestroy === 'function') {
    root.Tapp.lifecycle.onDestroy(function () {
      renderGeneration += 1;
      if (midnightTimer) clearTimeout(midnightTimer);
      midnightTimer = null;
      if (root.Tapp.assets && typeof root.Tapp.assets.revokeAll === 'function') root.Tapp.assets.revokeAll();
      resultAssetUrls.clear();
    });
  }
})(globalThis);
