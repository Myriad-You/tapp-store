(function (root) {
  'use strict';
  let midnightTimer = null;

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

  async function render(container, props) {
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

    scope.dataset.size = size;
    scope.dataset.theme = theme;
    scope.dataset.mood = mood;
    scope.setAttribute('aria-label', t('widget.title'));
    scope.style.setProperty('--ddz-widget-scale', String(props && props.scale || 1));
    scope.style.setProperty('--ddz-widget-font-scale', String(props && props.fontScale || 1));
    setText(scope, '[data-user-name]', name);
    setText(scope, '[data-user-initial]', initial);
    setText(scope, '[data-record]', daily.wins + ' - ' + daily.losses);
    setText(scope, '[data-games]', daily.games);
    setText(scope, '[data-win-rate]', rate);
    setText(scope, '[data-score]', score);
    setText(scope, '[data-mood-label]', t('widget.' + mood));
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
    scheduleMidnightRefresh();
  }

  if (typeof root.Tapp !== 'undefined' && root.Tapp.widgets) root.Tapp.widgets['daily-record'] = { render: render };
  if (typeof root.Tapp !== 'undefined' && root.Tapp.lifecycle && typeof root.Tapp.lifecycle.onDestroy === 'function') {
    root.Tapp.lifecycle.onDestroy(function () {
      if (midnightTimer) clearTimeout(midnightTimer);
      midnightTimer = null;
    });
  }
})(globalThis);
