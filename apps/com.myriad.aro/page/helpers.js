// ==================== Helpers ====================

/**
 * Escape a value for interpolation into HTML — text **or** attribute context.
 *
 * The previous implementation round-tripped through `textContent`/`innerHTML`,
 * which only escapes `&`, `<` and `>`: serializing a text node never escapes
 * quotes. `esc()` is interpolated into ~176 double-quoted attributes across the
 * page modules (`data-actor="…"`, `title="…"`, `alt="…"`, `aria-label="…"`),
 * several of which carry peer-controlled data — a room member's `actor_url`, a
 * message `payload.filename`/`quote_id`. A `"` in any of those closed the
 * attribute early and let a remote inject arbitrary markup into the Aro page.
 *
 * Entity-encoding quotes fixes every call site at once and keeps text contexts
 * identical (browsers render `&quot;`/`&#39;` as `"`/`'`). It also drops a DOM
 * allocation from a hot render path.
 */
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Shareable public room id: `rm_…@home[:port]` when home_server is known.
 * Bare `rm_…` still works for same-instance joins.
 */
function shareableRoomId(room) {
  if (!room) return '';
  var id = room.room_id || room.id || '';
  if (!id) return '';
  var home = (room.home_server || '').trim();
  if (!home) return id;
  // Avoid double @ if already shareable
  if (String(id).indexOf('@') >= 0) return id;
  return id + '@' + home;
}

/** Parse join input: bare id, shareable id@home, or public URL. */
function parseJoinRoomInput(raw) {
  var s = String(raw || '').trim();
  if (!s) return { roomId: '', homeServer: '' };
  if (s.indexOf('myriad:room:') === 0) s = s.slice('myriad:room:'.length).trim();
  var pubIdx = s.lastIndexOf('/public/rooms/');
  if (pubIdx >= 0) {
    var tail = s.slice(pubIdx + '/public/rooms/'.length);
    var id = tail.split(/[?#/]/)[0] || '';
    var home = '';
    try {
      var u = new URL(s);
      home = u.host || '';
    } catch (e) { /* ignore */ }
    return { roomId: id, homeServer: home };
  }
  var at = s.lastIndexOf('@');
  if (at > 0) {
    var left = s.slice(0, at).trim();
    var right = s.slice(at + 1).trim();
    if (left.indexOf('rm_') === 0 && right && right.indexOf('/') < 0) {
      return { roomId: left, homeServer: right };
    }
  }
  return { roomId: s, homeServer: '' };
}

/**
 * ARO-14: track subscriptions for lifecycle teardown.
 * Usage: bag.listen(el, 'click', fn); bag.add(unsubFn); bag.disposeAll()
 */
function createDisposableBag() {
  var items = [];
  return {
    add: function (disposeFn) {
      if (typeof disposeFn === 'function') items.push(disposeFn);
      return disposeFn;
    },
    listen: function (target, type, handler, options) {
      if (!target || typeof target.addEventListener !== 'function') return;
      target.addEventListener(type, handler, options);
      items.push(function () {
        try { target.removeEventListener(type, handler, options); } catch (e) { /* ignore */ }
      });
    },
    disposeAll: function () {
      var list = items.slice();
      items.length = 0;
      for (var i = list.length - 1; i >= 0; i--) {
        try { list[i](); } catch (e) { /* ignore */ }
      }
    },
    size: function () { return items.length; },
  };
}

/** Page-session disposable bag (recreated each init). */
var pageDisposables = null;
function getPageDisposables() {
  if (!pageDisposables) pageDisposables = createDisposableBag();
  return pageDisposables;
}
function disposePageSession() {
  if (pageDisposables) {
    pageDisposables.disposeAll();
    pageDisposables = null;
  }
}
/** Prefer this for long-lived DOM listeners so destroy can tear them down (ARO-14). */
function pageListen(target, type, handler, options) {
  if (!target || typeof target.addEventListener !== 'function') return;
  if (typeof getPageDisposables === 'function') {
    getPageDisposables().listen(target, type, handler, options);
  } else {
    target.addEventListener(type, handler, options);
  }
}

/** SVG elements allowed when rendering untrusted remote icon markup (ARO-01). */
var SAFE_SVG_TAGS = {
  svg: 1, g: 1, path: 1, circle: 1, rect: 1, ellipse: 1, line: 1, polyline: 1,
  polygon: 1, defs: 1, clippath: 1, lineargradient: 1, radialgradient: 1, stop: 1,
  title: 1, desc: 1, use: 1,
};

/**
 * Strip executable / remote content from untrusted SVG/HTML icon strings.
 * Returns sanitized SVG markup or '' (caller should use a local glyph fallback).
 */
function sanitizeRemoteSvg(raw, maxLen) {
  if (raw == null) return '';
  var s = String(raw).trim();
  if (!s) return '';
  var limit = maxLen || 8192;
  if (s.length > limit) return '';
  // Reject obvious non-SVG payloads
  if (s.indexOf('<') === -1) return '';
  if (/<\s*script|<\s*foreignObject|<\s*iframe|<\s*object|<\s*embed|javascript:|data:text\/html/i.test(s)) {
    return '';
  }
  try {
    var parser = new DOMParser();
    var wrapped = /<\s*svg[\s>]/i.test(s) ? s : ('<svg xmlns="http://www.w3.org/2000/svg">' + s + '</svg>');
    var doc = parser.parseFromString(wrapped, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return '';
    var root = doc.documentElement;
    if (!root || String(root.nodeName).toLowerCase() !== 'svg') return '';

    function scrub(node) {
      if (!node || node.nodeType !== 1) return;
      var tag = String(node.nodeName).toLowerCase().replace(/^.*:/, '');
      if (!SAFE_SVG_TAGS[tag]) {
        if (node.parentNode) node.parentNode.removeChild(node);
        return;
      }
      // Drop event handlers and remote/href abuse
      var attrs = Array.prototype.slice.call(node.attributes || []);
      for (var i = 0; i < attrs.length; i++) {
        var a = attrs[i];
        var name = a.name;
        var nLower = name.toLowerCase();
        var val = a.value || '';
        if (nLower.indexOf('on') === 0) {
          node.removeAttribute(name);
          continue;
        }
        if (nLower === 'style' || nLower === 'class') {
          // style can embed url()/expression — drop entirely from untrusted SVG
          node.removeAttribute(name);
          continue;
        }
        if (nLower === 'href' || nLower === 'xlink:href' || nLower === 'src') {
          var v = String(val).trim();
          var vl = v.toLowerCase();
          // allow only fragment refs on <use>
          if (tag === 'use' && v.charAt(0) === '#') continue;
          if (vl.indexOf('javascript:') === 0 || vl.indexOf('data:') === 0 || vl.indexOf('http:') === 0 || vl.indexOf('https:') === 0) {
            node.removeAttribute(name);
          } else if (v.charAt(0) !== '#') {
            node.removeAttribute(name);
          }
          continue;
        }
      }
      var kids = Array.prototype.slice.call(node.childNodes || []);
      for (var k = 0; k < kids.length; k++) {
        if (kids[k].nodeType === 1) scrub(kids[k]);
        else if (kids[k].nodeType === 8) {
          // strip comments
          if (kids[k].parentNode) kids[k].parentNode.removeChild(kids[k]);
        }
      }
    }
    scrub(root);
    // Cap complexity
    if (root.querySelectorAll('*').length > 80) return '';
    // Force safe xmlns
    if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    root.removeAttribute('onload');
    root.removeAttribute('onclick');
    var out = new XMLSerializer().serializeToString(root);
    if (out.length > limit) return '';
    return out;
  } catch (e) {
    return '';
  }
}

/**
 * Safe href for external links (ARO-10). Only http(s), no credentials / javascript.
 */
function safeExternalHref(url) {
  if (!url) return '';
  var v = String(url).trim();
  if (!v || v.length > 2048) return '';
  var lower = v.toLowerCase();
  if (lower.indexOf('javascript:') === 0 || lower.indexOf('vbscript:') === 0 || lower.indexOf('data:') === 0) {
    return '';
  }
  try {
    var u = new URL(v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    if (u.username || u.password) return '';
    return u.href;
  } catch (e) {
    return '';
  }
}

/**
 * Store catalog ref for SDK install (ARO-05).
 * Accepts: numeric source id, or https URL (catalog / index.json).
 * Rejects: empty, mode placeholders, non-https schemes.
 */
function isValidStoreSourceRef(ref) {
  if (!ref || typeof ref !== 'string') return false;
  var s = ref.trim();
  if (!s || s.length > 2048) return false;
  var lower = s.toLowerCase();
  if (lower === 'store' || lower === 'direct') return false;
  if (/^\d{1,12}$/.test(s)) return true;
  try {
    var u = new URL(s);
    if (u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Stable key for Tapp accept/reject state (ARO-08) — never array index.
 * @param {object} msg message row
 * @param {object} payload
 */
function tappAcceptStorageKey(msg, payload) {
  var tappId = (payload && (payload.tapp_id || payload.tappId)) || '';
  if (!tappId) return '';
  var mid = (msg && (msg.message_id || msg.id)) || '';
  var sender = (msg && (msg.sender_actor || msg.sender || msg.from)) || '';
  var ver = (payload && (payload.tapp_version || payload.tappVersion)) || '';
  var conv = (state.activeKind || '') + ':' + (state.activeId || '');
  return ['tapp_accept', conv, mid || 'noid', sender || 'nosender', tappId, ver || 'v'].join('_');
}

/**
 * Rebuild a controlled Blob URL from an untrusted data: payload (ARO-09).
 * Returns { url, filename, revoke } or null.
 */
/**
 * Allow common binary / document / config mimes for inline download.
 * Config shares often arrive as application/json, text/yaml, text/x-*, etc.
 */
function isAllowedInlineDownloadMime(mime, filename) {
  var m = String(mime || '').toLowerCase().split(';')[0].trim();
  if (!m || m === 'application/octet-stream' || m === 'binary/octet-stream') return true;
  if (/^(image\/(png|jpe?g|gif|webp|avif|svg\+xml)|application\/(pdf|zip|gzip|x-gzip|x-tar|json|xml|toml|x-yaml|yaml|javascript|typescript)|text\/(plain|csv|markdown|md|html|css|javascript|xml|yaml|x-yaml|x-sh|x-shellscript)|audio\/|video\/)/i.test(m)) {
    return true;
  }
  // Extension fallback when mime is wrong/missing (compose/env/conf configs)
  var name = String(filename || '').toLowerCase();
  if (/\.(json|ya?ml|toml|env|conf|config|ini|cfg|txt|md|markdown|xml|html?|css|js|ts|tsx|jsx|rs|go|py|sh|bash|zsh|sql|csv|log|lock|sum|mod|dockerfile)$/i.test(name)) {
    return true;
  }
  if (/(^|\/)(docker-compose|compose)\.(ya?ml|json)$/i.test(name) || /(^|\/)\.env(\.|$)/i.test(name)) {
    return true;
  }
  return false;
}

function safeInlineDownload(payload) {
  if (!payload || !payload.data || typeof payload.data !== 'string') return null;
  var data = payload.data.trim();
  if (data.length > 8 * 1024 * 1024) return null; // ~6MiB raw after base64 overhead guard
  var mime = '';
  var b64 = '';
  var m = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(data);
  if (!m) return null;
  mime = (m[1] || 'application/octet-stream').toLowerCase();
  var isB64 = !!m[2];
  b64 = m[3] || '';
  var filenameHint = payload.filename || payload.name || 'file';
  if (!isAllowedInlineDownloadMime(mime, filenameHint)) return null;
  if (!isB64) return null;
  try {
    var bin = atob(b64);
    if (bin.length > 6 * 1024 * 1024) return null;
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // Prefer a concrete mime for Blob so browsers save with a usable type
    var blobMime = mime && mime !== 'application/octet-stream' ? mime : 'application/octet-stream';
    var blob = new Blob([bytes], { type: blobMime });
    var url = URL.createObjectURL(blob);
    // basename only; strip path segments and ".." so downloads never suggest traversal
    var name = String(filenameHint).split(/[/\\]/).pop() || 'file';
    name = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\.\./g, '_').replace(/^\.+/, '');
    name = name.replace(/^[\s._]+|[\s._]+$/g, '').slice(0, 180);
    if (!name || name === '.' || name === '..' || /^_+$/.test(name)) name = 'file';
    return {
      url: url,
      filename: name,
      revoke: function () { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } },
    };
  } catch (e) {
    return null;
  }
}

/** Normalize a search query for case-insensitive substring match. */
function normalizeSearchQuery(q) {
  return String(q == null ? '' : q).trim().toLowerCase();
}

/**
 * True if query is empty or any of the text parts contains the query.
 * @param {string} q already-normalized (lowercased) query, or raw (will normalize)
 * @param {Array<string|null|undefined>} parts
 */
function matchesSearch(q, parts) {
  var query = normalizeSearchQuery(q);
  if (!query) return true;
  if (!parts || !parts.length) return false;
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p == null || p === '') continue;
    if (String(p).toLowerCase().indexOf(query) !== -1) return true;
  }
  return false;
}

/** Empty-state markup when a filter has no hits (source list may still be non-empty). */
function searchNoResultsHtml() {
  return '<div class="conv-empty conv-empty-fill aro-search-empty"><span>'
    + esc(lang.searchNoResults || lang.pickerEmpty || 'No results')
    + '</span></div>';
}

/**
 * Debounce a function. Leading=false trailing=true by default.
 * @param {function} fn
 * @param {number} ms
 * @returns {function & { cancel: function }}
 */
function aroDebounce(fn, ms) {
  var t = null;
  var wrapped = function () {
    var ctx = this;
    var args = arguments;
    if (t) clearTimeout(t);
    t = setTimeout(function () {
      t = null;
      fn.apply(ctx, args);
    }, ms == null ? 120 : ms);
  };
  wrapped.cancel = function () {
    if (t) { clearTimeout(t); t = null; }
  };
  return wrapped;
}

/**
 * Coalesce multiple soft UI paints into one animation frame.
 * @param {string} key unique slot
 * @param {function} fn
 */
var _aroRafSlots = {};
function aroScheduleFrame(key, fn) {
  if (!key || typeof fn !== 'function') return;
  _aroRafSlots[key] = fn;
  if (_aroRafSlots._scheduled) return;
  _aroRafSlots._scheduled = true;
  var raf = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : function (cb) { return setTimeout(cb, 16); };
  raf(function () {
    _aroRafSlots._scheduled = false;
    var pending = _aroRafSlots;
    _aroRafSlots = { _scheduled: false };
    Object.keys(pending).forEach(function (k) {
      if (k === '_scheduled') return;
      try { pending[k](); } catch (e) { console.error('[Aro] scheduleFrame', k, e); }
    });
  });
}

/**
 * Bind a list-search input once. Updates state.search[key] and calls onChange.
 * onChange is debounced so typing does not thrash large list renders.
 * @param {string} inputId
 * @param {string} stateKey key under state.search
 * @param {function} onChange
 * @param {{ debounceMs?: number }} [opts]
 */
function bindListSearch(inputId, stateKey, onChange, opts) {
  var input = $(inputId);
  if (!input || input.dataset.searchBound === '1') return;
  input.dataset.searchBound = '1';
  opts = opts || {};
  var debounceMs = opts.debounceMs != null ? opts.debounceMs : 100;
  if (state.search && state.search[stateKey]) {
    input.value = state.search[stateKey];
  }
  var run = typeof onChange === 'function'
    ? aroDebounce(function () {
        if (typeof onChange === 'function') onChange();
      }, debounceMs)
    : null;
  input.addEventListener('input', function () {
    if (!state.search) state.search = {};
    state.search[stateKey] = input.value || '';
    // Invalidate paint fingerprints so the next paint isn't skipped
    if (stateKey === 'feed') state._feedRenderFp = '';
    if (stateKey === 'conv') state._convListFp = '';
    if (stateKey === 'member') state._membersListFp = '';
    if (run) run();
  });
  // Escape clears immediately (snappy)
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && input.value) {
      e.preventDefault();
      input.value = '';
      if (!state.search) state.search = {};
      state.search[stateKey] = '';
      if (stateKey === 'feed') state._feedRenderFp = '';
      if (stateKey === 'conv') state._convListFp = '';
      if (stateKey === 'member') state._membersListFp = '';
      if (run) { run.cancel(); onChange(); }
    }
  });
}

/** Apply i18n placeholder + aria to a search input. */
function applySearchInputLabel(inputId, placeholder) {
  var el = $(inputId);
  if (!el) return;
  var ph = placeholder || lang.pickerSearchPlaceholder || lang.searchPlaceholder || 'Search…';
  el.placeholder = ph;
  el.setAttribute('aria-label', ph);
}

/** True when the user prefers reduced motion (a11y). */
function prefersReducedMotion() {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { return false; }
}

/**
 * Play a one-shot enter animation class (restarts if already present).
 * Class is removed after animationend (or immediately under reduced motion).
 */
function aroPlayEnter(el, className) {
  if (!el || !className) return;
  el.classList.remove(className);
  if (prefersReducedMotion()) return;
  // Double-rAF restarts CSS animation without forced layout (offsetWidth reflow).
  var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : function (cb) { return setTimeout(cb, 16); };
  raf(function () {
    raf(function () {
      if (!el.isConnected) return;
      el.classList.add(className);
      var done = function () {
        el.classList.remove(className);
        el.removeEventListener('animationend', done);
      };
      el.addEventListener('animationend', done);
      // Match --aro-dur-view (~180ms) with small buffer; avoid 400ms lag on rapid switches.
      setTimeout(done, 280);
    });
  });
}

/**
 * Show a create-overlay (or any fixed modal overlay) after dismiss/forceHide.
 * Restores the full open triad: clear hidden, pointer-events auto, display flex.
 * Required because .create-overlay[hidden]{display:none!important} beats style.display=flex alone.
 * @param {HTMLElement|null|undefined} el
 */
function showAroOverlay(el) {
  if (!el) return;
  el.classList.remove('aro-leaving');
  el.hidden = false;
  try { el.removeAttribute('hidden'); } catch (e) { /* ignore */ }
  el.style.pointerEvents = 'auto';
  el.style.display = 'flex';
}

/**
 * Immediately stop an overlay/menu from receiving clicks (safe even mid-animation).
 * Use when a stuck layer would dead-lock the messenger UI.
 */
function forceHideInteractive(el) {
  if (!el) return;
  try {
    el.classList.remove('aro-leaving', 'aro-history-enter', 'aro-view-enter', 'aro-panel-enter', 'aro-menu-enter', 'open', 'is-open');
    el.style.pointerEvents = 'none';
    el.style.display = 'none';
    if (el.hasAttribute && (el.hasAttribute('hidden') || el.getAttribute('aria-modal') === 'true' || el.classList.contains('history-overlay') || el.classList.contains('create-overlay') || el.classList.contains('confirm-overlay') || el.classList.contains('picker-overlay') || el.classList.contains('forward-overlay') || el.classList.contains('img-viewer') || el.classList.contains('sticker-target-overlay'))) {
      el.hidden = true;
    }
  } catch (eForce) { /* ignore */ }
}

/**
 * Seal closed fixed/absolute overlays so a partial dismiss never leaves a click shield
 * over the feed or messenger. Safe on boot and after view switches.
 * Does not kill an open confirm dialog (would hang await confirm()).
 * @param {{ keepChat?: boolean, keepConfirm?: boolean }} [opts]
 */
function sealAroInteractionSurfaces(opts) {
  opts = opts || {};
  try {
    if (typeof dismissTransientUi === 'function') {
      dismissTransientUi({ keepChat: !!opts.keepChat });
    }
  } catch (eDismiss) { /* ignore */ }

  // PE-seal any overlay that is not visibly open (covers partial state: display:none but PE auto)
  try {
    var sel = '.create-overlay, .history-overlay, .picker-overlay, .forward-overlay, .img-viewer, .sticker-target-overlay';
    if (!opts.keepConfirm) sel += ', .confirm-overlay';
    document.querySelectorAll(sel).forEach(function (el) {
      if (!el || !el.isConnected) return;
      var styleDisp = '';
      try { styleDisp = String(el.style && el.style.display || ''); } catch (eD) { /* ignore */ }
      var computedDisp = '';
      try {
        computedDisp = window.getComputedStyle ? String(getComputedStyle(el).display || '') : '';
      } catch (eC) { /* ignore */ }
      var isHidden = !!el.hidden
        || styleDisp === 'none'
        || computedDisp === 'none'
        || el.classList.contains('aro-leaving');
      if (isHidden) {
        try {
          el.style.pointerEvents = 'none';
          if (styleDisp !== 'none') el.style.display = 'none';
        } catch (eSeal) { /* ignore */ }
      }
    });
  } catch (e1) { /* ignore */ }

  // Ensure feed scrollport can receive pan/click after seal
  try {
    var feedView = typeof $ === 'function' ? $('view-feed') : document.getElementById('view-feed');
    if (feedView && feedView.classList.contains('aro-view-active')) {
      feedView.style.pointerEvents = '';
      if (feedView.style.display === 'none') feedView.style.display = '';
    }
    var feedMain = document.querySelector('#view-feed.aro-view-active .feed-main, .aro-view-active .feed-main');
    if (feedMain) {
      feedMain.style.pointerEvents = 'auto';
      try { feedMain.style.touchAction = 'pan-y'; } catch (eTa) { /* ignore */ }
    }
    var content = typeof $ === 'function' ? $('feed-content') : document.getElementById('feed-content');
    if (content) content.style.pointerEvents = 'auto';
  } catch (e2) { /* ignore */ }
}

/**
 * Hide or remove an element after a short exit animation (class `aro-leaving`).
 * Always disables pointer-events immediately so dismiss never leaves a click shield.
 * @param {HTMLElement} el
 * @param {{ remove?: boolean, ms?: number, onDone?: function }} opts
 */
function aroDismiss(el, opts) {
  opts = opts || {};
  if (!el) { if (opts.onDone) opts.onDone(); return; }
  var finished = false;
  // Critical: block hits the moment dismiss starts (aro-leaving CSS may lag / fail).
  try { el.style.pointerEvents = 'none'; } catch (ePe) { /* ignore */ }
  var finish = function () {
    if (finished) return;
    finished = true;
    el.classList.remove('aro-leaving');
    el.removeEventListener('animationend', onAnimEnd);
    if (opts.remove) {
      try { el.remove(); } catch (e) { /* ignore */ }
    } else {
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
      try {
        if (el.hasAttribute && el.hasAttribute('hidden')) el.hidden = true;
      } catch (eH) { /* ignore */ }
    }
    if (opts.onDone) opts.onDone();
  };
  var onAnimEnd = function (e) {
    // Ignore bubbled end events from child sheet/dialog animations.
    if (e && e.target && e.target !== el) return;
    finish();
  };
  if (prefersReducedMotion() || el.style.display === 'none' || el.hidden) {
    finish();
    return;
  }
  el.classList.add('aro-leaving');
  el.addEventListener('animationend', onAnimEnd);
  setTimeout(finish, opts.ms || 180);
}

/**
 * Close menus/overlays that commonly leave a full-screen click shield.
 * Safe to call from openConversation / switchView / back.
 * @param {{ keepChat?: boolean }} [opts]
 */
function dismissTransientUi(opts) {
  opts = opts || {};
  try { if (typeof closeMsgMenu === 'function') closeMsgMenu(); } catch (e0) { /* ignore */ }
  try { if (typeof closeAttachMenu === 'function') closeAttachMenu(); } catch (e1) { /* ignore */ }
  try { if (typeof closeStickerPanel === 'function') closeStickerPanel(); } catch (e1s) { /* ignore */ }
  try { if (typeof closeMentionPicker === 'function') closeMentionPicker(); } catch (e1m) { /* ignore */ }
  try { if (typeof closeStickerCtxMenu === 'function') closeStickerCtxMenu(); } catch (e1c) { /* ignore */ }
  try { if (typeof closeInvitePopover === 'function') closeInvitePopover(); } catch (e2) { /* ignore */ }
  try { if (typeof closeManageDropdown === 'function') closeManageDropdown(); } catch (e3) { /* ignore */ }
  try {
    document.querySelectorAll('.aro-select.is-open').forEach(function (root) {
      if (root._aroSelect && typeof root._aroSelect.close === 'function') root._aroSelect.close();
    });
  } catch (e4) { /* ignore */ }
  // Force-hide fixed/absolute overlays that may still paint over the app
  try {
    ['create-dialog', 'edit-room-dialog', 'ring-create-dialog', 'feed-follow-dialog',
      'feed-compose-dialog', 'quote-repost-dialog', 'quote-view-dialog', 'feed-share-dialog',
      'chat-history-overlay', 'room-files-overlay'
    ].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      if (el.style.display === 'none' || el.hidden) {
        // Still seal PE in case of partial state
        try { el.style.pointerEvents = 'none'; } catch (eSeal) { /* ignore */ }
        return;
      }
      // History/files: prefer their close helpers so state stays consistent
      if (id === 'chat-history-overlay' && typeof closeChatHistory === 'function') {
        closeChatHistory();
        return;
      }
      if (id === 'room-files-overlay' && typeof closeRoomFiles === 'function') {
        closeRoomFiles();
        return;
      }
      if (id === 'create-dialog' && typeof hideCreateDialog === 'function') {
        hideCreateDialog();
        return;
      }
      if (id === 'edit-room-dialog' && typeof hideEditRoomDialog === 'function') {
        hideEditRoomDialog();
        return;
      }
      forceHideInteractive(el);
    });
  } catch (e5) { /* ignore */ }
  // Dynamically created portals (do NOT kill .confirm-overlay — mid-confirm would hang).
  try {
    document.querySelectorAll('.forward-overlay, .picker-overlay, .img-viewer, .sticker-target-overlay, .sticker-ctx-menu').forEach(function (el) {
      forceHideInteractive(el);
      try { el.remove(); } catch (eR) { /* ignore */ }
    });
  } catch (e6) { /* ignore */ }
  // Closed static overlays: always PE-none even when already display:none (partial state).
  try {
    document.querySelectorAll('.create-overlay, .history-overlay').forEach(function (el) {
      if (!el) return;
      var closed = !!el.hidden || el.style.display === 'none'
        || (window.getComputedStyle && getComputedStyle(el).display === 'none');
      if (closed) {
        try { el.style.pointerEvents = 'none'; } catch (ePeC) { /* ignore */ }
      }
    });
  } catch (e6b) { /* ignore */ }
  // Mobile member sheet must not stick over the conv list after switch
  try {
    var panel = $('member-panel');
    if (panel) {
      panel.classList.remove('member-open-mobile');
      if (!opts.keepChat) {
        panel.classList.remove('member-expanded-tablet');
        try { panel.style.pointerEvents = 'none'; } catch (ePeM) { /* ignore */ }
      }
    }
  } catch (e7) { /* ignore */ }
}

function timeStr(iso) { try { return new Date(iso).toLocaleTimeString(currentLocale, { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
function fullTimeStr(iso) { try { return new Date(iso).toLocaleString(currentLocale); } catch (e) { return ''; } }
/** Relative short time for conv list (e.g. 5m, 2h, 3d). */
function relTimeStr(iso) {
  if (!iso) return '';
  try {
    if (typeof timeAgo === 'function') return timeAgo(iso);
  } catch (e) { /* fall through */ }
  try {
    var d = new Date(iso);
    var sec = Math.floor((Date.now() - d) / 1000);
    if (sec < 60) return sec + 's';
    var min = Math.floor(sec / 60);
    if (min < 60) return min + 'm';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h';
    var day = Math.floor(hr / 24);
    if (day < 30) return day + 'd';
    return d.toLocaleDateString(currentLocale, { month: 'short', day: 'numeric' });
  } catch (e2) { return ''; }
}

/** 消息日期分隔线标签：今天/昨天/日期 */
function dayLabel(iso) {
  var d = new Date(iso);
  if (isNaN(d)) return '';
  var now = new Date();
  var startOfDay = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()); };
  var diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return lang.dateToday || 'Today';
  if (diffDays === 1) return lang.dateYesterday || 'Yesterday';
  var opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  try { return d.toLocaleDateString(currentLocale, opts); } catch (e) { return d.toLocaleDateString(); }
}

/**
 * Backend send_message / file transfer only allow active|accepted.
 * Pending/closed/rejected (and missing detail while a channel is open) must lock the composer.
 */
function isChannelStatusWritable(status) {
  return status === 'active' || status === 'accepted';
}

function isChannelComposerLocked() {
  if (state.activeKind !== 'channel') return false;
  // Open channel without detail (loading / mid-open): do not pretend writable.
  if (!state.channelDetail) return !!state.activeId;
  return !isChannelStatusWritable(state.channelDetail.status);
}

function isRoomInvitePending() {
  if (state.activeKind !== 'room' || !state.roomDetail) return false;
  var st = state.roomDetail.my_membership_status
    || state.roomDetail.membership_status;
  // Only explicit pending shows invite/join CTAs — never invent pending from missing status.
  return st === 'pending';
}

function isRoomComposerLocked() {
  if (state.activeKind !== 'room') return false;
  // Align with channel: open room without known active membership stays locked.
  if (!state.roomDetail) return !!state.activeId;
  var st = state.roomDetail.my_membership_status
    || state.roomDetail.membership_status;
  if (st == null || st === '') {
    // Optimistic list header may omit membership — keep locked until getRoom returns.
    return true;
  }
  return st === 'pending';
}

function channelComposerLockReason() {
  if (!isChannelComposerLocked()) return '';
  var detail = state.channelDetail;
  var s = detail && detail.status;
  if (s === 'closed') {
    return lang.closedComposer || lang.composerClosed || lang.closed || '';
  }
  if (s === 'pending') {
    // Remote-initiated: need Accept. Local-initiated: wait for peer.
    if (detail && detail.initiated_by === 'remote') {
      return lang.channelNotAccepted || lang.pending || '';
    }
    return lang.pendingConfirm || lang.pending || lang.channelNotAccepted || '';
  }
  if (s === 'rejected') {
    return lang.channelNotAccepted || lang.closedComposer || lang.closed || '';
  }
  if (!detail) {
    return lang.loadFail || lang.channelNotAccepted || '';
  }
  return lang.channelNotAccepted || lang.closedComposer || lang.composerClosed || '';
}

function roomComposerLockReason() {
  if (!isRoomComposerLocked()) return '';
  return lang.roomInvitePending || lang.channelNotAccepted || lang.pending || 'Accept the invite to chat';
}

/**
 * Button busy affordance (join / accept / create). Stores original label once.
 * @param {HTMLElement|null} btn
 * @param {boolean} busy
 * @param {string} [busyLabel]
 */
function setActionBusy(btn, busy, busyLabel) {
  if (!btn) return;
  if (busy) {
    if (!btn.dataset.aroLabel) btn.dataset.aroLabel = btn.textContent || '';
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.classList.add('is-busy');
    if (busyLabel) btn.textContent = busyLabel;
  } else {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.classList.remove('is-busy');
    if (btn.dataset.aroLabel != null) {
      btn.textContent = btn.dataset.aroLabel;
      delete btn.dataset.aroLabel;
    }
  }
}

/** Lightweight skeleton for mid-pane while openConversation loads. */
function chatOpeningHtml() {
  var label = lang.openingChat || lang.feedLoading || 'Loading…';
  return '<div class="messages-empty messages-opening" role="status" aria-live="polite" aria-busy="true">'
    + '<div class="chat-open-skeleton" aria-hidden="true">'
    + '<div class="chat-skel-row chat-skel-remote"><span class="chat-skel-bubble"></span></div>'
    + '<div class="chat-skel-row chat-skel-local"><span class="chat-skel-bubble chat-skel-short"></span></div>'
    + '<div class="chat-skel-row chat-skel-remote"><span class="chat-skel-bubble chat-skel-mid"></span></div>'
    + '</div>'
    + '<p class="messages-opening-label">' + esc(label) + '</p>'
    + '</div>';
}

/** 发送按钮/composer 状态：不可写会话、发送中、无内容时不可发送 */
function updateSendState() {
  var btn = $('send-btn');
  var input = $('msg-input');
  var attach = $('attach-btn');
  var locked = isChannelComposerLocked() || isRoomComposerLocked();
  var blocked = !state.activeId || locked || !!state.sending;
  var lockMsg = locked
    ? (isRoomComposerLocked() ? roomComposerLockReason() : channelComposerLockReason())
    : '';
  var floatWrap = document.querySelector('#chat-container .input-float-wrap');
  if (floatWrap) {
    floatWrap.classList.toggle('composer-locked', locked);
    floatWrap.setAttribute('aria-disabled', locked ? 'true' : 'false');
  }

  if (input) {
    input.disabled = locked || !state.activeId || !!state.sending;
    input.setAttribute('aria-disabled', input.disabled ? 'true' : 'false');
    if (locked) input.placeholder = lockMsg || lang.typing || '';
    else if (state.sending) input.placeholder = lang.attachSending || lang.sending || lang.typing || '';
    else if (lang.typing) input.placeholder = lang.typing;
  }
  if (attach) {
    attach.disabled = blocked;
    attach.setAttribute('aria-disabled', blocked ? 'true' : 'false');
    attach.title = locked ? (lockMsg || lang.attach || '') : (lang.attach || '');
  }
  var stickerBtn = $('sticker-btn');
  if (stickerBtn) {
    stickerBtn.disabled = blocked;
    stickerBtn.setAttribute('aria-disabled', blocked ? 'true' : 'false');
    // Keep hits working when enabled (composer float uses pointer-events tricks)
    stickerBtn.style.pointerEvents = blocked ? 'none' : 'auto';
    stickerBtn.title = locked
      ? (lockMsg || lang.stickerBtn || lang.stickers || '')
      : (lang.stickerBtn || lang.stickers || '');
    if (blocked && typeof closeStickerPanel === 'function') {
      try { closeStickerPanel(); } catch (eSt) { /* ignore */ }
    }
  }
  if (blocked && typeof closeMentionPicker === 'function') {
    try { closeMentionPicker(); } catch (eMen) { /* ignore */ }
  }

  if (!btn) return;
  var hasContent = !!((input && input.value.trim()) || (!locked && state.pendingAttach));
  // While sending, keep button disabled but show ready styling + spinner class.
  var ready = !locked && !!state.activeId && hasContent && !state.sending;
  btn.disabled = !ready || !!state.sending || locked || !state.activeId;
  if (state.sending) {
    btn.disabled = true;
    btn.classList.add('send-sending');
    btn.classList.add('send-ready');
    btn.setAttribute('aria-busy', 'true');
    btn.setAttribute('aria-label', lang.attachSending || lang.sending || 'Sending…');
    btn.title = lang.attachSending || lang.sending || 'Sending…';
  } else {
    btn.classList.remove('send-sending');
    btn.removeAttribute('aria-busy');
    btn.classList.toggle('send-ready', ready);
    btn.setAttribute('aria-label', lang.send || 'Send');
    btn.title = locked ? (lockMsg || lang.send || '') : (lang.send || 'Send');
  }
}
function autoResizeInput(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
/**
 * Federation E2E key-exchange system events (myriad:KeyExchange).
 * Backend stores { algorithm, publicKey, direction? } as channel/room history —
 * must never fall through to JSON.stringify or users see crypto material in chat.
 */
function isE2eKeyExchangeMessage(msg, msgType, payload) {
  var mt = msgType || (msg && msg.message_type) || '';
  if (mt === 'myriad:KeyExchange' || mt === 'KeyExchange') return true;
  var p = payload;
  if (p == null && msg && typeof msg.payload === 'object') p = msg.payload;
  if (!p || typeof p !== 'object') return false;
  // Envelope shape from channel/room key-exchange handlers
  if (p.publicKey && (p.algorithm === 'x25519-aes256gcm' || p.algorithm)) return true;
  if (p.public_key && p.algorithm) return true;
  return false;
}

/**
 * True if payload is an E2E ciphertext envelope (not yet decrypted for display).
 * Shape: { algorithm, ciphertext, ephemeral_key? } — must never JSON.stringify into bubbles.
 */
function isE2eCiphertextEnvelope(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (isE2eKeyExchangeMessage(null, '', payload)) return false;
  var ct = payload.ciphertext || payload.cipher_text;
  if (!ct || typeof ct !== 'string') return false;
  // Pairwise: algorithm + ephemeral_key + nonce
  // Multi-recipient rooms: algorithm + nonce + key_wraps[]
  if (payload.algorithm || payload.ephemeral_key || payload.ephemeralKey || payload.nonce) {
    return true;
  }
  if (Array.isArray(payload.key_wraps) && payload.key_wraps.length) return true;
  if (Array.isArray(payload.keyWraps) && payload.keyWraps.length) return true;
  // bare ciphertext + high entropy base64
  return ct.length > 16 && !payload.text && !payload.title && !payload.data;
}

/**
 * Grace period before a ciphertext bubble stops claiming it is still decrypting.
 *
 * Decryption happens on our own backend as it serves the message, so a payload
 * that is still an envelope after the open + refresh burst is not slow — it is
 * one we hold no usable key for (peer rotated, or the key-exchange write was
 * lost). Saying "decrypting…" forever is a lie the reader cannot act on.
 */
var E2E_DECRYPT_GRACE_MS = 20000;

/** Label for a ciphertext bubble we are never going to open, else '' . */
function e2eUndecryptableLabel(msg, payload) {
  if (!msg || typeof isE2eCiphertextEnvelope !== 'function') return '';
  if (!isE2eCiphertextEnvelope(payload != null ? payload : msg.payload)) return '';
  var age = 0;
  try {
    var t = new Date(msg.created_at).getTime();
    if (isNaN(t)) return '';
    age = Date.now() - t;
  } catch (eAge) {
    return '';
  }
  if (age < E2E_DECRYPT_GRACE_MS) return '';
  return lang.e2eUndecryptable
    || lang.e2eEncryptedMessage
    || 'Encrypted message';
}

function e2eEncryptedPlaceholder(opts) {
  opts = opts || {};
  if (opts.pending) {
    return lang.e2eDecrypting
      || lang.e2eEncryptedPending
      || 'Encrypted message — decrypting…';
  }
  return lang.e2eEncryptedMessage
    || lang.e2eEstablished
    || 'Encrypted message';
}

function e2eKeyExchangeLabel(msg, payload) {
  var p = payload || (msg && typeof msg.payload === 'object' ? msg.payload : {}) || {};
  var dir = String(p.direction || '').toLowerCase();
  var outbound = dir === 'outbound' || (msg && isLocalActor(msg.sender_actor));
  // If session is already fully up, prefer the strong “established” wording
  // so history lines don’t look like incomplete half-handshakes.
  try {
    if (typeof getE2eStatusForActive === 'function'
      && getE2eStatusForActive().status === 'established') {
      return lang.e2eEstablished || 'End-to-end encryption active';
    }
  } catch (e0) { /* ignore */ }
  if (outbound) {
    return lang.e2eLocalOnly
      || lang.e2ePublished
      || lang.e2ePublish
      || 'Encryption key published';
  }
  return lang.e2eKeyReceived
    || lang.e2ePublished
    || 'Encryption key received';
}

/**
 * Human-readable text from a message payload.
 * Never stringifies media blobs (data / transfer_id) — that used to dump base64 into quotes.
 * Never stringifies E2E key-exchange payloads (algorithm + publicKey).
 * Never stringifies ciphertext envelopes (algorithm + ciphertext + ephemeral_key).
 */
function getPayloadText(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') {
    // Defensive: backend/WS sometimes leaves a JSON string of the envelope
    var st = payload.trim();
    if (st.charAt(0) === '{' && st.indexOf('ciphertext') !== -1 && st.indexOf('algorithm') !== -1) {
      return e2eEncryptedPlaceholder();
    }
    return payload;
  }
  if (typeof payload !== 'object') {
    try { return String(payload); } catch (e0) { return ''; }
  }
  // Ciphertext envelope first — do not prefer accidental nested fields
  if (isE2eCiphertextEnvelope(payload)) {
    return e2eEncryptedPlaceholder({ pending: true });
  }
  if (payload.text != null && payload.text !== '') return String(payload.text);
  if (typeof payload.content === 'string' && payload.content) return payload.content;
  if (payload.summary != null && payload.summary !== '') return String(payload.summary);
  if (payload.title != null && payload.title !== '') return String(payload.title);
  if (payload.filename != null && payload.filename !== '') return String(payload.filename);
  if (payload.name != null && payload.name !== '') return String(payload.name);
  // Media / opaque objects: no dump
  if (payload.data != null || payload.transfer_id) return '';
  // E2E key material must not appear as chat text
  if (isE2eKeyExchangeMessage(null, '', payload)) return '';
  try {
    var s = JSON.stringify(payload);
    if (!s || s === '{}' || s === 'null') return '';
    // Defensive: still suppress crypto-looking envelopes without message_type
    if (s.indexOf('publicKey') !== -1 && s.indexOf('x25519') !== -1) return '';
    if (s.indexOf('ciphertext') !== -1 && s.indexOf('algorithm') !== -1) {
      return e2eEncryptedPlaceholder();
    }
    if (s.indexOf('ephemeral_key') !== -1 || s.indexOf('ephemeralKey') !== -1) {
      return e2eEncryptedPlaceholder();
    }
    return s.length > 160 ? s.slice(0, 159) + '…' : s;
  } catch (e) {
    return '';
  }
}

/** Short label for quote/reply preview (filename / type / text). */
function quotePreviewText(msg) {
  if (!msg) return '';
  var payload = (typeof msg.payload === 'object' && msg.payload) ? msg.payload : {};
  var mt = msg.message_type || '';
  if (isE2eKeyExchangeMessage(msg, mt, payload)) {
    return e2eKeyExchangeLabel(msg, payload);
  }
  var text = getPayloadText(payload);
  if (text) return text.length > 140 ? text.slice(0, 139) + '…' : text;
  if (mt === 'image' || (payload.mime_type && String(payload.mime_type).indexOf('image/') === 0)) {
    return payload.filename || lang.previewImage || 'Image';
  }
  if (mt === 'file' || mt === 'file-meta' || payload.filename || payload.transfer_id) {
    return payload.filename || lang.previewFile || 'File';
  }
  if (mt === 'tapp' || mt === 'brew' || mt === 'library' || mt === 'report') {
    return payload.title || payload.summary || payload.name || lang.previewShare || 'Share';
  }
  return lang.newMessage || 'Message';
}

/** Display name for the author of a quoted message (both parties). */
function quoteSenderLabel(msg) {
  if (!msg) return '?';
  var actor = msg.sender_actor || '';
  if (typeof isLocalActor === 'function' && isLocalActor(actor)) {
    return lang.me || lang.local || 'Me';
  }
  if (state.activeKind === 'channel' && state.channelDetail) {
    // Peer in DM
    if (state.channelDetail.remote_actor_url && actor
      && String(state.channelDetail.remote_actor_url) === String(actor)) {
      return state.channelDetail.remote_actor_name
        || actor.split('/').pop()
        || '?';
    }
    if (state.channelDetail.remote_actor_name && !isLocalActor(actor)) {
      return state.channelDetail.remote_actor_name;
    }
  }
  if (typeof findMemberByActor === 'function') {
    var m = findMemberByActor(actor);
    if (m && m.display_name) return m.display_name;
  }
  return actor.split('/').pop() || '?';
}

/** 会话列表/通知用的短预览 */
function messagePreview(msg) {
  if (!msg) return lang.newMessage || '新消息';
  var mt = msg.message_type || 'text';
  var payload = (typeof msg.payload === 'object' && msg.payload) ? msg.payload : {};
  if (isE2eKeyExchangeMessage(msg, mt, payload)) {
    return e2eKeyExchangeLabel(msg, payload);
  }
  if (mt === 'image') return lang.previewImage || '📷 图片';
  if (mt === 'file' || mt === 'file-meta') return lang.previewFile || '📎 文件';
  if (mt === 'system') return lang.previewSystem || '系统消息';
  var text = getPayloadText(msg.payload);
  if (!text) return lang.newMessage || '新消息';
  return text.length > 80 ? text.slice(0, 79) + '…' : text;
}

/**
 * 应用内新消息 Toast。
 * 条件：设置开启，且（页面在后台 或 当前未打开该会话）。
 * 全局通知中心由后端 SSE 负责，这里只补 Aro 打开时的即时反馈。
 */
function maybeNotifyIncomingMessage(scope, scopeId, msg) {
  if (!state.notifyOnMessage || !msg) return;
  var isActive =
    state.activeKind === scope &&
    state.activeId === scopeId &&
    typeof document !== 'undefined' &&
    !document.hidden;
  if (isActive) return;

  var title = lang.newMessage || '新消息';
  if (scope === 'channel') {
    for (var i = 0; i < state.channels.length; i++) {
      if (state.channels[i].channel_id === scopeId) {
        title = state.channels[i].remote_actor_name ||
          (state.channels[i].remote_actor_url || '').split('/').pop() ||
          title;
        break;
      }
    }
  } else if (scope === 'room') {
    for (var j = 0; j < state.rooms.length; j++) {
      if (state.rooms[j].room_id === scopeId) {
        title = state.rooms[j].name || title;
        break;
      }
    }
  }
  var preview = messagePreview(msg);
  try {
    Tapp.ui.showNotification({ title: title, message: preview, type: 'info' });
  } catch (e) { /* ignore */ }
}
/**
 * Recover the live message payload behind a share card via its data-msg-idx.
 * Detail sheets prefer this over DOM text: it keeps the full snapshot the
 * sender attached (cover, favicon, install package) rather than the truncated
 * strings the card displays.
 */
function shareCardPayload(card) {
  if (!card || !card.dataset || card.dataset.msgIdx == null || !state.messages) return {};
  var idx = parseInt(card.dataset.msgIdx, 10);
  if (isNaN(idx) || !state.messages[idx]) return {};
  var payload = state.messages[idx].payload;
  return (payload && typeof payload === 'object') ? payload : {};
}

/** Meta chip row for detail sheets; skips empty parts and renders nothing if all are empty. */
function sheetMetaHtml(parts) {
  var chips = (parts || []).filter(function (p) { return p != null && String(p).trim() !== ''; });
  if (!chips.length) return '';
  return '<div class="sheet-meta">'
    + chips.map(function (c) { return '<span class="sheet-meta-chip">' + esc(String(c)) + '</span>'; }).join('')
    + '</div>';
}

/**
 * Build a public web URL for a library item (github / steam / bangumi / …).
 * Prefer an explicit external_url from the share snapshot.
 */
function libraryExternalUrl(payload) {
  payload = payload || {};
  var explicit = safeExternalHref(payload.external_url || payload.url || payload.link || '');
  if (explicit) return explicit;
  var platform = platformKey(payload.platform_id || payload.platform || '');
  var itemId = String(payload.item_id || payload.id || '').trim();
  var itemType = String(payload.item_type || payload.content_type || '').trim().toLowerCase();
  if (itemType === 'library') itemType = '';
  if (!itemId && !platform) return '';

  if (platform === 'github') {
    // full_name "owner/repo" or bare username
    if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(itemId)) {
      return 'https://github.com/' + itemId;
    }
    if (/^[A-Za-z0-9_.-]+$/.test(itemId)) return 'https://github.com/' + itemId;
  }
  if (platform === 'netease') {
    if (/^\d+$/.test(itemId)) {
      if (itemType === 'music' || !itemType) return 'https://music.163.com/#/song?id=' + itemId;
      if (itemType === 'playlist' || itemType === 'album') {
        return 'https://music.163.com/#/' + itemType + '?id=' + itemId;
      }
      return 'https://music.163.com/#/song?id=' + itemId;
    }
  }
  if (platform === 'steam' && /^\d+$/.test(itemId)) {
    return 'https://store.steampowered.com/app/' + itemId;
  }
  if (platform === 'bangumi' && /^\d+$/.test(itemId)) {
    return 'https://bgm.tv/subject/' + itemId;
  }
  if (platform === 'mal' && /^\d+$/.test(itemId)) {
    var malKind = (itemType === 'anime' || itemType === 'manga') ? itemType : 'anime';
    return 'https://myanimelist.net/' + malKind + '/' + itemId;
  }
  if (platform === 'bilibili') {
    if (/^BV[0-9A-Za-z]+$/i.test(itemId)) return 'https://www.bilibili.com/video/' + itemId;
    if (/^av\d+$/i.test(itemId)) return 'https://www.bilibili.com/video/' + itemId;
    if (/^\d+$/.test(itemId)) return 'https://www.bilibili.com/video/av' + itemId;
  }
  if (platform === 'psn' && itemId) {
    return 'https://store.playstation.com/search/' + encodeURIComponent(itemId);
  }
  if (platform === 'xbox' && itemId) {
    return 'https://www.xbox.com/games/store/search?q=' + encodeURIComponent(itemId);
  }
  return '';
}

/** True when this library share should try host music playback (NetEase track). */
function isPlayableLibraryShare(payload) {
  payload = payload || {};
  var platform = platformKey(payload.platform_id || payload.platform || '');
  var itemType = String(payload.item_type || payload.content_type || '').trim().toLowerCase();
  if (itemType === 'library') itemType = '';
  var itemId = String(payload.item_id || '').trim();
  if (platform === 'netease' && /^\d+$/.test(itemId)) {
    return !itemType || itemType === 'music' || itemType === 'song';
  }
  return false;
}

/**
 * Trigger host music player for a playable library share.
 * @returns {Promise<boolean>} true if a play attempt was made successfully
 */
async function playLibraryShare(payload) {
  payload = payload || {};
  if (!isPlayableLibraryShare(payload)) return false;
  var itemId = String(payload.item_id || '').trim();
  if (!itemId) return false;
  if (typeof Tapp === 'undefined' || !Tapp.media || typeof Tapp.media.playTrack !== 'function') {
    return false;
  }
  var song = {
    id: itemId,
    trackId: itemId,
    name: payload.title || payload.name || ('#' + itemId),
    title: payload.title || payload.name || ('#' + itemId),
    artist: payload.artist || '',
    album: payload.album || '',
    cover: payload.image || '',
    image: payload.image || '',
    source: 'netease',
    url: '/api/proxy/music/netease/audio/' + encodeURIComponent(itemId),
    duration: 0,
  };
  try {
    var res = await Tapp.media.playTrack(song);
    if (res && res.success === false) return false;
    try {
      Tapp.ui.showNotification({
        title: lang.nowPlaying || lang.mediaPlay || 'Playing',
        message: song.name,
        type: 'success',
      });
    } catch (eN) { /* ignore */ }
    return true;
  } catch (e) {
    console.warn('[Aro] playLibraryShare failed', e);
    return false;
  }
}

/**
 * Open an external https URL from the sandbox via a temporary <a> click
 * (window.open is disabled in the Tapp sandbox).
 */
function openSafeExternalUrl(url) {
  var href = safeExternalHref(url);
  if (!href) return false;
  try {
    var a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch (e) {
    console.warn('[Aro] openSafeExternalUrl failed', e);
    return false;
  }
}

/**
 * Primary card action for a federation share:
 * - library netease music → play
 * - library / brew with URL → open link
 * - returns 'played' | 'opened' | 'none'
 */
async function activateShareCard(type, payload, card) {
  payload = payload || {};
  type = type || '';
  if (type === 'library') {
    if (isPlayableLibraryShare(payload)) {
      var played = await playLibraryShare(payload);
      if (played) return 'played';
      // Fall through to open song page if play failed
    }
    var libUrl = libraryExternalUrl(payload);
    if (libUrl && openSafeExternalUrl(libUrl)) return 'opened';
    return 'none';
  }
  if (type === 'brew') {
    var brewUrl = safeExternalHref(payload.brew_link || (card && card.dataset && card.dataset.brewLink) || '');
    if (brewUrl && openSafeExternalUrl(brewUrl)) return 'opened';
    return 'none';
  }
  if (type === 'report') {
    // No stable public URL for another user's report — detail sheet only.
    return 'none';
  }
  return 'none';
}

/** Per-type sheet accents, matching the share-card palette. */
var SHARE_TYPE_ACCENTS = {
  brew: '34,197,94',
  library: '168,85,247',
  report: '239,68,68',
};

/**
 * Resolve a bottom sheet's header icon and brand accent using the same rules as
 * the share cards: cover art > raw svg > favicon > platform logo > type glyph.
 *
 * @returns {{icon:string, mark:string, accent:object|null}}
 *   `mark` goes on the icon element so a favicon keeps a neutral tile;
 *   `accent` is applied to the overlay by applySheetAccent().
 */
function sheetVisual(opts) {
  opts = opts || {};
  var favicon = safeIconUrl(opts.favicon);
  var logo = platformLogoSvg(opts.slug);
  var icon = '';
  var mark = '';
  var accent = null;

  if (opts.cover) {
    var coverUrl = safeIconUrl(opts.cover);
    icon = coverUrl ? ('<img src="' + esc(coverUrl) + '" alt="" />') : (opts.fallback || SVG_ICONS.file);
  } else if (opts.rawSvg) {
    var cleanSvg = sanitizeRemoteSvg(opts.rawSvg);
    icon = cleanSvg || opts.fallback || SVG_ICONS.file;
  } else if (favicon) {
    icon = '<img src="' + esc(favicon) + '" alt="" />';
    mark = 'img';
  } else if (logo) {
    icon = logo;
    mark = 'brand';
  } else {
    icon = opts.fallback || SVG_ICONS.file;
  }

  if (mark === 'brand') {
    var brand = platformAccent(opts.slug);
    if (brand) accent = { brand: true, l: brand.l, d: brand.d };
  }
  if (!accent && opts.type && SHARE_TYPE_ACCENTS[opts.type]) {
    accent = { brand: false, flat: SHARE_TYPE_ACCENTS[opts.type] };
  }
  return { icon: icon, mark: mark, accent: accent };
}

/**
 * Terminal/among-flight states for a .sheet-btn, as classes rather than inline
 * colors so the palette stays in one place.
 * @param {'busy'|'ok'|'err'|'idle'} stateName
 */
function setSheetBtnState(btn, stateName) {
  if (!btn) return;
  btn.classList.remove('sheet-btn-ok', 'sheet-btn-err', 'is-busy');
  if (stateName === 'busy') btn.classList.add('is-busy');
  else if (stateName === 'ok') btn.classList.add('sheet-btn-ok');
  else if (stateName === 'err') btn.classList.add('sheet-btn-err');
}

/**
 * Inline attributes for an icon element built as an HTML string (picker rows).
 * Emits the -l/-d accent pair so the element's own brand color wins per row,
 * and marks favicons so a dead one can be swapped for a glyph.
 */
function sheetVisualAttrs(v, fallbackType) {
  if (!v || !v.mark) return '';
  var attrs = ' data-mark="' + esc(v.mark) + '"';
  if (v.mark === 'img' && fallbackType) attrs += ' data-fallback="' + esc(fallbackType) + '"';
  if (v.mark === 'brand' && v.accent && v.accent.brand) {
    attrs += ' style="--acc-l:' + v.accent.l + ';--acc-d:' + v.accent.d + '"';
  }
  return attrs;
}

/**
 * Swap dead favicons inside a container for the generic type glyph.
 * Applies to picker rows; the message-card path has its own binding because it
 * must also clear the accent on the surrounding card.
 */
function bindFaviconFallbacks(container) {
  if (!container) return;
  container.querySelectorAll('[data-mark="img"][data-fallback] img').forEach(function (img) {
    img.addEventListener('error', function () {
      var tile = img.closest('[data-fallback]');
      if (!tile) return;
      var glyphs = { tapp: SVG_ICONS.tapp, brew: SVG_ICONS.brew, library: SVG_ICONS.library, report: SVG_ICONS.report };
      tile.removeAttribute('data-mark');
      tile.innerHTML = glyphs[tile.dataset.fallback] || SVG_ICONS.file;
    });
  });
}

/** Apply a sheetVisual() accent to an overlay element. */
function applySheetAccent(el, accent) {
  if (!el || !accent) return;
  if (accent.brand) {
    // -l/-d pair, never --acc directly: an inline --acc would outrank the
    // `.dark .picker-overlay[data-mark="brand"]` rule and freeze the theme.
    el.dataset.mark = 'brand';
    el.style.setProperty('--acc-l', accent.l);
    el.style.setProperty('--acc-d', accent.d);
  } else if (accent.flat) {
    el.style.setProperty('--acc', accent.flat);
  }
}

/**
 * Keep only image URLs the sandbox CSP will actually load (img-src data: blob: https:).
 * Anything else would render as a broken tile, so callers fall back to a glyph.
 * Rejects oversized data URLs and non-image schemes (ARO-10).
 */
function safeIconUrl(url) {
  if (!url) return '';
  var v = String(url).trim();
  if (!v || v.length > 512 * 1024) return '';
  var lower = v.toLowerCase();
  if (lower.indexOf('javascript:') === 0 || lower.indexOf('vbscript:') === 0) return '';
  if (lower.indexOf('https://') === 0) {
    try {
      var u = new URL(v);
      if (u.protocol !== 'https:' || u.username || u.password) return '';
      return u.href;
    } catch (e) {
      return '';
    }
  }
  if (lower.indexOf('data:image/') === 0) {
    // only simple raster / svg+xml data images; no html
    if (!/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,/i.test(v)) return '';
    if (v.length > 256 * 1024) return '';
    return v;
  }
  return '';
}

/**
 * Chat/image-bubble media src (NOT for tiny share icons).
 *
 * Aro 1.0.10 re-routed image bubbles through safeIconUrl, whose 256 KiB
 * data: cap is meant for favicons/covers. Inline chat images may be up to
 * INLINE_ATTACH_MAX (2 MiB raw ≈ ~2.8 MiB base64 data URL), so wallhaven-
 * sized photos were rejected and rendered as bare filenames.
 *
 * Still blocks javascript:/vbscript: and non-image schemes. Size aligns with
 * forward payload cap (6 MiB string) and host-relative federation media paths.
 */
// ~2 MiB raw * 4/3 base64 + header, with headroom under the 6 MiB forward cap
var SAFE_MESSAGE_IMAGE_DATA_MAX = 6 * 1024 * 1024;

function safeMessageImageUrl(url) {
  if (!url) return '';
  var v = String(url).trim();
  if (!v) return '';
  var lower = v.toLowerCase();
  if (lower.indexOf('javascript:') === 0 || lower.indexOf('vbscript:') === 0) return '';
  if (lower.indexOf('https://') === 0) {
    try {
      var u = new URL(v);
      if (u.protocol !== 'https:' || u.username || u.password) return '';
      return u.href;
    } catch (e) {
      return '';
    }
  }
  // Host-same-origin federation media: /media/federation/{userId}/{file}
  if (v.charAt(0) === '/' && v.indexOf('//') !== 0) {
    if (v.indexOf('..') >= 0) return '';
    if (/^\/media\/federation\/\d+\/[A-Za-z0-9._-]+$/.test(v)) return v;
    return '';
  }
  if (lower.indexOf('data:image/') === 0) {
    if (!/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,/i.test(v)) return '';
    if (v.length > SAFE_MESSAGE_IMAGE_DATA_MAX) return '';
    return v;
  }
  return '';
}

/* ----- File bubble typing: accent slug + glyph + short extension label ----- */
var FILE_KIND_RULES = [
  { kind: 'image', re: /^(png|jpe?g|gif|webp|avif|bmp|svg|heic|heif|ico)$/ },
  { kind: 'video', re: /^(mp4|mov|mkv|webm|avi|m4v|flv)$/ },
  { kind: 'audio', re: /^(mp3|wav|flac|aac|m4a|ogg|opus|aiff?)$/ },
  { kind: 'archive', re: /^(zip|rar|7z|tar|gz|tgz|bz2|xz|zst)$/ },
  { kind: 'doc', re: /^(pdf|docx?|pages|rtf|odt|epub|mobi)$/ },
  { kind: 'sheet', re: /^(xlsx?|csv|tsv|numbers|ods)$/ },
  { kind: 'code', re: /^(js|mjs|cjs|ts|tsx|jsx|rs|go|py|rb|java|kt|swift|c|cc|cpp|h|hpp|sh|zsh|json|ya?ml|toml|html?|css|scss|sql)$/ },
  { kind: 'text', re: /^(txt|md|markdown|log)$/ },
];

var FILE_KIND_GLYPHS = {
  image: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-4.5-4.5L6 21"/></svg>',
  video: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="4"/><path d="M10 9l5 3-5 3z"/></svg>',
  audio: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
  archive: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l1.5-3h15L21 7v12a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M3 7h18M12 11v5M10 13h4"/></svg>',
  doc: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  sheet: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
  code: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 8L4 12l4.5 4M15.5 8l4.5 4-4.5 4M13.5 5l-3 14"/></svg>',
  text: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6M9 9h2"/></svg>',
  file: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/></svg>',
};

/** Map a filename/mime to { kind, ext, glyph } used by the file bubble. */
function fileCardMeta(filename, mime) {
  var name = String(filename || '');
  var dot = name.lastIndexOf('.');
  var ext = dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
  var kind = '';
  for (var i = 0; i < FILE_KIND_RULES.length && ext; i++) {
    if (FILE_KIND_RULES[i].re.test(ext)) { kind = FILE_KIND_RULES[i].kind; break; }
  }
  if (!kind && mime) {
    var m = String(mime);
    if (m.indexOf('image/') === 0) kind = 'image';
    else if (m.indexOf('video/') === 0) kind = 'video';
    else if (m.indexOf('audio/') === 0) kind = 'audio';
    else if (m.indexOf('text/') === 0) kind = 'text';
  }
  if (!kind) kind = 'file';
  return {
    kind: kind,
    ext: ext ? ext.toUpperCase().slice(0, 4) : '',
    glyph: FILE_KIND_GLYPHS[kind] || FILE_KIND_GLYPHS.file,
  };
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function getErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error.message) return String(error.message);
  if (error.error) return String(error.error);
  try { return JSON.stringify(error); } catch (e) { return ''; }
}

function errorSuffix(error) {
  var message = getErrorMessage(error);
  return message ? ': ' + message : '';
}

function notifyError(title, error) {
  var message = getErrorMessage(error);
  try {
    Tapp.ui.showNotification({ title: title, message: message || undefined, type: 'error' });
  } catch (e) {}
}

function requireAdminAction() {
  if (state.isAdmin) return true;
  notifyError(lang.adminRequired);
  return false;
}

/** 本地化环网类型标签；未知类型原样返回 */
function ringTypeLabel(type) {
  var map = {
    'brew-recommend': lang.ringTypeBrewRecommend,
    'tapp-store': lang.ringTypeTappStore,
    'library-exchange': lang.ringTypeLibraryExchange,
    'instance-directory': lang.ringTypeInstanceDirectory,
  };
  return map[type] || type || '';
}

// ==================== Custom select (aro-select) ====================
// Lightweight listbox replacing native <select> for dark/iframe-friendly UI.
// Reuses manage-dropdown / manage-item visual language.

/**
 * Resolve a root element for aro-select by id or node.
 * @param {string|HTMLElement} rootOrId
 * @returns {HTMLElement|null}
 */
function resolveAroSelectRoot(rootOrId) {
  if (!rootOrId) return null;
  if (typeof rootOrId === 'string') return $(rootOrId);
  return rootOrId.nodeType ? rootOrId : null;
}

/**
 * Read value from custom select or native control.
 * @param {string|HTMLElement} rootOrId
 * @returns {string}
 */
function getAroSelectValue(rootOrId) {
  var root = resolveAroSelectRoot(rootOrId);
  if (!root) return '';
  if (root._aroSelect && typeof root._aroSelect.getValue === 'function') {
    return root._aroSelect.getValue();
  }
  if (typeof root.value === 'string') return root.value;
  return root.getAttribute('data-value') || '';
}

/**
 * Set value on custom select (or native). silent skips change event.
 * @param {string|HTMLElement} rootOrId
 * @param {string} value
 * @param {boolean} [silent]
 */
function setAroSelectValue(rootOrId, value, silent) {
  var root = resolveAroSelectRoot(rootOrId);
  if (!root) return;
  if (root._aroSelect && typeof root._aroSelect.setValue === 'function') {
    root._aroSelect.setValue(value, !!silent);
    return;
  }
  root.value = value == null ? '' : String(value);
}

/**
 * Replace options: [{ value, label, id? }]. Keeps selection when possible.
 * @param {string|HTMLElement} rootOrId
 * @param {Array<{value:string,label:string,id?:string}>} options
 * @param {string} [selectedValue]
 */
function setAroSelectOptions(rootOrId, options, selectedValue) {
  var root = resolveAroSelectRoot(rootOrId);
  if (!root) return;
  if (!root._aroSelect) initAroSelect(root);
  if (root._aroSelect && typeof root._aroSelect.setOptions === 'function') {
    root._aroSelect.setOptions(options || [], selectedValue);
  }
}

/** Refresh trigger label after i18n updates option textContent. */
function refreshAroSelectLabel(rootOrId) {
  var root = resolveAroSelectRoot(rootOrId);
  if (root && root._aroSelect && typeof root._aroSelect.refreshLabel === 'function') {
    root._aroSelect.refreshLabel();
  }
}

/**
 * Initialize a custom select root. Safe to call multiple times.
 * Defines root.value get/set and dispatches bubbling 'change' events.
 * @param {string|HTMLElement} rootOrId
 * @param {{ onChange?: function(string):void }} [opts]
 * @returns {{ getValue:function, setValue:function, setOptions:function, open:function, close:function, refreshLabel:function }|null}
 */
function initAroSelect(rootOrId, opts) {
  var root = resolveAroSelectRoot(rootOrId);
  if (!root) return null;
  if (root._aroSelect) {
    if (opts && typeof opts.onChange === 'function') root._aroSelect._onChange = opts.onChange;
    return root._aroSelect;
  }

  var trigger = root.querySelector('.aro-select-trigger');
  var labelEl = root.querySelector('[data-aro-select-label]') || root.querySelector('.aro-select-value');
  var menu = root.querySelector('.aro-select-menu');
  if (!trigger || !menu) return null;

  var open = false;
  var onChangeCb = opts && typeof opts.onChange === 'function' ? opts.onChange : null;

  function optionNodes() {
    return Array.prototype.slice.call(menu.querySelectorAll('.aro-select-option[data-value], .aro-select-option[data-value=""]'));
  }

  function getValue() {
    var v = root.getAttribute('data-value');
    return v == null ? '' : v;
  }

  function findOption(value) {
    var optsList = optionNodes();
    var want = value == null ? '' : String(value);
    for (var i = 0; i < optsList.length; i++) {
      if ((optsList[i].getAttribute('data-value') || '') === want) return optsList[i];
    }
    return null;
  }

  function syncSelectedUi() {
    var cur = getValue();
    var optsList = optionNodes();
    var matched = null;
    for (var i = 0; i < optsList.length; i++) {
      var ov = optsList[i].getAttribute('data-value') || '';
      var sel = ov === cur;
      optsList[i].classList.toggle('is-selected', sel);
      optsList[i].setAttribute('aria-selected', sel ? 'true' : 'false');
      if (sel) matched = optsList[i];
    }
    if (labelEl) {
      labelEl.textContent = matched
        ? (matched.textContent || '').trim()
        : (optsList[0] ? (optsList[0].textContent || '').trim() : '');
    }
  }

  function setValue(value, silent) {
    var next = value == null ? '' : String(value);
    var prev = getValue();
    root.setAttribute('data-value', next);
    syncSelectedUi();
    if (!silent && next !== prev) {
      try {
        root.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (eEvt) {
        var ev = document.createEvent('Event');
        ev.initEvent('change', true, true);
        root.dispatchEvent(ev);
      }
      if (onChangeCb) onChangeCb(next);
    }
  }

  function setOptions(options, selectedValue) {
    var keep = selectedValue != null ? String(selectedValue) : getValue();
    menu.innerHTML = '';
    (options || []).forEach(function (opt) {
      if (!opt) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'aro-select-option manage-item';
      btn.setAttribute('role', 'option');
      btn.setAttribute('data-value', opt.value == null ? '' : String(opt.value));
      if (opt.id) btn.id = opt.id;
      btn.textContent = opt.label == null ? String(opt.value || '') : String(opt.label);
      menu.appendChild(btn);
    });
    var has = findOption(keep);
    if (!has) {
      var first = optionNodes()[0];
      keep = first ? (first.getAttribute('data-value') || '') : '';
    }
    root.setAttribute('data-value', keep);
    syncSelectedUi();
  }

  function closeMenu() {
    if (!open) return;
    open = false;
    root.classList.remove('is-open');
    menu.classList.remove('open');
    menu.hidden = true;
    root.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    if (open || root.getAttribute('aria-disabled') === 'true') return;
    // Close other aro-selects
    document.querySelectorAll('.aro-select.is-open').forEach(function (el) {
      if (el !== root && el._aroSelect) el._aroSelect.close();
    });
    open = true;
    root.classList.add('is-open');
    menu.hidden = false;
    menu.classList.add('open');
    root.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-expanded', 'true');
    var cur = findOption(getValue());
    if (cur && typeof cur.focus === 'function') {
      try { cur.focus(); } catch (eF) { /* ignore */ }
    }
  }

  function toggleMenu() {
    if (open) closeMenu();
    else openMenu();
  }

  function onDocPointer(e) {
    // Never capture/swallow when closed — leftover open=true must not block messenger.
    if (!open) return;
    if (root.contains(e.target)) return;
    closeMenu();
  }

  function onKeyDown(e) {
    var key = e.key;
    if (key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        trigger.focus();
      }
      return;
    }
    if (key === 'Enter' || key === ' ') {
      if (e.target === trigger || e.target === root) {
        e.preventDefault();
        toggleMenu();
      }
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault();
      var optsList = optionNodes();
      if (!optsList.length) return;
      if (!open) {
        openMenu();
        return;
      }
      var active = document.activeElement;
      var idx = optsList.indexOf(active);
      if (idx < 0) {
        var sel = findOption(getValue());
        idx = sel ? optsList.indexOf(sel) : 0;
      }
      var nextIdx = key === 'ArrowDown'
        ? Math.min(optsList.length - 1, (idx < 0 ? 0 : idx + 1))
        : Math.max(0, (idx < 0 ? 0 : idx - 1));
      if (idx < 0) nextIdx = key === 'ArrowDown' ? 0 : optsList.length - 1;
      else if (key === 'ArrowDown') nextIdx = (idx + 1) % optsList.length;
      else nextIdx = (idx - 1 + optsList.length) % optsList.length;
      optsList[nextIdx].focus();
    }
  }

  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  if (!trigger.getAttribute('type')) trigger.type = 'button';
  root.setAttribute('aria-haspopup', 'listbox');
  root.setAttribute('aria-expanded', 'false');
  if (!root.getAttribute('role')) root.setAttribute('role', 'combobox');
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  menu.classList.remove('open');

  // Seed data-value from attribute or first option
  if (!root.hasAttribute('data-value')) {
    var firstOpt = optionNodes()[0];
    root.setAttribute('data-value', firstOpt ? (firstOpt.getAttribute('data-value') || '') : '');
  }
  syncSelectedUi();

  trigger.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });
  menu.addEventListener('click', function (e) {
    var opt = e.target && e.target.closest ? e.target.closest('.aro-select-option') : null;
    if (!opt || !menu.contains(opt)) return;
    e.preventDefault();
    e.stopPropagation();
    setValue(opt.getAttribute('data-value') || '', false);
    closeMenu();
    trigger.focus();
  });
  root.addEventListener('keydown', onKeyDown);
  // Bubble phase only — capture:true previously risked ordering races with list/tab clicks.
  pageListen(document, 'click', onDocPointer, false);
  pageListen(document, 'keydown', function (e) {
    if (e.key === 'Escape' && open) {
      closeMenu();
    }
  });

  var api = {
    getValue: getValue,
    setValue: setValue,
    setOptions: setOptions,
    open: openMenu,
    close: closeMenu,
    refreshLabel: syncSelectedUi,
  };
  Object.defineProperty(api, '_onChange', {
    get: function () { return onChangeCb; },
    set: function (fn) { onChangeCb = typeof fn === 'function' ? fn : null; },
    configurable: true,
  });

  try {
    Object.defineProperty(root, 'value', {
      get: function () { return getValue(); },
      set: function (v) { setValue(v, true); },
      configurable: true,
    });
  } catch (eProp) { /* ignore */ }

  root._aroSelect = api;
  root.classList.add('aro-select-ready');
  return api;
}

/** Init ring-create selects if present in DOM. */
function initRingCreateSelects() {
  initAroSelect('ring-type-select');
  initAroSelect('ring-brew-category-select');
}

/** 本地化成员角色标签 */
function roleLabel(role) {
  var map = { owner: lang.roleOwner, admin: lang.roleAdmin, member: lang.roleMember };
  return map[role] || role || '';
}

/** 本地化分享卡片类型标签 */
function shareTypeLabel(type) {
  var map = { tapp: lang.attachTapp, brew: lang.attachBrew, library: lang.attachLibrary, report: lang.attachReport };
  return map[type] || type || '';
}

/**
 * Unify share payload → bubble card fields for tapp/brew/library/report.
 * Always returns a non-empty title so cards never render blank.
 */
// share/library presentation → page/shareUi.js

function aroConfirm(message, danger) {
  return new Promise(function (resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    // Closed CSS default is display:none + PE none — open triad required.
    overlay.style.display = 'none';
    overlay.style.pointerEvents = 'none';
    overlay.innerHTML = '<div class="confirm-dialog">'
      + '<div class="confirm-message">' + esc(message) + '</div>'
      + '<div class="confirm-actions">'
      + '<button class="confirm-btn confirm-btn-cancel">' + esc(lang.confirmCancel || 'Cancel') + '</button>'
      + '<button class="confirm-btn confirm-btn-ok' + (danger ? ' confirm-btn-danger' : '') + '">' + esc(lang.confirmOk || 'OK') + '</button>'
      + '</div></div>';
    var settled = false;
    var done = function (result) {
      if (settled) return;
      settled = true;
      aroDismiss(overlay, {
        remove: true,
        ms: 150,
        onDone: function () { resolve(result); },
      });
    };
    overlay.querySelector('.confirm-btn-cancel').addEventListener('click', function () { done(false); });
    overlay.querySelector('.confirm-btn-ok').addEventListener('click', function () { done(true); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) done(false); });
    document.body.appendChild(overlay);
    if (typeof showAroOverlay === 'function') showAroOverlay(overlay);
    else {
      overlay.style.pointerEvents = 'auto';
      overlay.style.display = 'flex';
    }
    overlay.querySelector('.confirm-btn-ok').focus();
  });
}

/**
 * 应用内单选列表（沙箱 iframe 中 window.prompt 同样不可用）。
 * @param {string} title
 * @param {{ id: string, label: string, sub?: string }[]} options
 * @returns {Promise<string|null>} selected option id, or null if cancelled
 */
function aroPickOption(title, options) {
  return new Promise(function (resolve) {
    var list = Array.isArray(options) ? options : [];
    if (!list.length) {
      resolve(null);
      return;
    }
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.style.display = 'none';
    overlay.style.pointerEvents = 'none';
    var itemsHtml = list.map(function (opt, i) {
      return '<button type="button" class="aro-pick-item" data-pick-id="'
        + esc(opt.id) + '" data-pick-idx="' + i + '">'
        + '<span class="aro-pick-label">' + esc(opt.label || opt.id) + '</span>'
        + (opt.sub ? '<span class="aro-pick-sub">' + esc(opt.sub) + '</span>' : '')
        + '</button>';
    }).join('');
    overlay.innerHTML = '<div class="confirm-dialog aro-pick-dialog">'
      + '<div class="confirm-message">' + esc(title || '') + '</div>'
      + '<div class="aro-pick-list" role="listbox">' + itemsHtml + '</div>'
      + '<div class="confirm-actions">'
      + '<button type="button" class="confirm-btn confirm-btn-cancel">'
      + esc(lang.confirmCancel || 'Cancel') + '</button>'
      + '</div></div>';
    var settled = false;
    var done = function (result) {
      if (settled) return;
      settled = true;
      aroDismiss(overlay, {
        remove: true,
        ms: 150,
        onDone: function () { resolve(result); },
      });
    };
    overlay.querySelector('.confirm-btn-cancel').addEventListener('click', function () {
      done(null);
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) done(null);
    });
    Array.prototype.forEach.call(overlay.querySelectorAll('.aro-pick-item'), function (btn) {
      btn.addEventListener('click', function () {
        done(btn.getAttribute('data-pick-id') || null);
      });
    });
    document.body.appendChild(overlay);
    if (typeof showAroOverlay === 'function') showAroOverlay(overlay);
    else {
      overlay.style.pointerEvents = 'auto';
      overlay.style.display = 'flex';
    }
    var first = overlay.querySelector('.aro-pick-item');
    if (first) try { first.focus(); } catch (eF) { /* ignore */ }
  });
}

function setAdminElementVisible(selector, visible) {
  document.querySelectorAll(selector).forEach(function (el) {
    el.style.display = visible ? '' : 'none';
  });
}

function applyAdminControls() {
  var visible = !!state.isAdmin;
  setAdminElementVisible('#ring-create-open-btn', visible);
  setAdminElementVisible('#ring-sync-btn', visible);
  setAdminElementVisible('#ring-peer-bar', visible);
  setAdminElementVisible('.ring-peer-remove-btn', visible);
  var manageBtn = $('ring-manage-btn');
  var manageWrap = manageBtn ? manageBtn.closest('.manage-wrap') : null;
  if (manageWrap) manageWrap.style.display = visible ? '' : 'none';
  if (!visible) {
    var createDialog = $('ring-create-dialog');
    if (createDialog) createDialog.style.display = 'none';
    var dropdown = $('ring-manage-dropdown');
    if (dropdown) dropdown.classList.remove('open');
  }
}

function applyRoleControls() {
  var privateOnly = !state.isGuest;
  // 访客只有「动态」一个视图，整条顶部导航都没有意义，直接隐藏
  setAdminElementVisible('#aro-nav', privateOnly);
  setAdminElementVisible('#nav-messages', privateOnly);
  setAdminElementVisible('#nav-rings', privateOnly);
  setAdminElementVisible('.feed-nav-item[data-sub="following"]', privateOnly);
  setAdminElementVisible('.feed-nav-item[data-sub="followers"]', privateOnly);
  setAdminElementVisible('.feed-nav-item[data-sub="published"]', privateOnly);
  setAdminElementVisible('.feed-nav-item[data-sub="bookmarks"]', privateOnly);
  setAdminElementVisible('.feed-nav-item[data-sub="settings"]', privateOnly);
  setAdminElementVisible('.feed-mobile-tab[data-sub="following"]', privateOnly);
  setAdminElementVisible('.feed-mobile-tab[data-sub="followers"]', privateOnly);
  setAdminElementVisible('.feed-mobile-tab[data-sub="published"]', privateOnly);
  setAdminElementVisible('.feed-mobile-tab[data-sub="bookmarks"]', privateOnly);
  setAdminElementVisible('.feed-mobile-tab[data-sub="settings"]', privateOnly);
  if (state.isGuest) {
    state.feedSubTab = 'timeline';
    state.currentView = 'feed';
    if (typeof closeFollowDialog === 'function') closeFollowDialog();
    if (typeof closeFeedPlusMenu === 'function') closeFeedPlusMenu();
    if (typeof closeComposer === 'function') closeComposer();
  }
  if (typeof updateFeedPlusVisibility === 'function') {
    updateFeedPlusVisibility();
  } else if (typeof updateComposeButtonVisibility === 'function') {
    updateComposeButtonVisibility();
  }
}

/**
 * Resolve guest/user/admin without locking authenticated users as guests
 * when getRole/isAdmin are missing, throw, or host-default to 'guest'.
 *
 * Order (mirrors resolveAroUserRole util + unit tests):
 *   1. Tapp.user.getRole user/admin → use it
 *   2. getRole 'guest' is SOFT (host often does userRole||'guest') → verify below
 *   3. Tapp.user.isAdmin — true→admin, false→user (never guest)
 *   4. Tapp.context.getUser — authenticated user → user/admin
 *   5. Remain guest only when no auth user or context role is guest
 *
 * Repro (before this soft-guest fix, local preview logged-in):
 *   - Host getRole returns 'guest' because tappInstance.userRole is unset
 *   - #145 still treated that as resolved=true → Messages/Rings/create/+ all gone
 * After:
 *   - Same login + soft-guest getRole → getUser promotes to member
 *   - True guest (context role guest / no identity) still locked
 *
 * Manual test (local preview, logged-in non-admin):
 *   - Open Aro: #aro-nav shows Messages + Rings
 *   - Feed has Following / Followers / Published tabs (not timeline-only)
 *   - Messenger opens; compose + is available on timeline/following
 *   - DevTools: force getRole to 'guest' while getUser has id/username → still member
 *   - DevTools: force getRole to throw → still not guest if getUser works
 *   - Logged-out / true guest: nav hidden, timeline-only feed
 */
async function loadUserRole() {
  state.userRole = 'guest';
  state.isGuest = true;
  state.isAdmin = false;
  var resolved = false;

  function isGuestUsername(name) {
    var u = String(name || '').trim().toLowerCase();
    return !u || u.indexOf('guest:') === 0 || u === 'guest' || u === 'anonymous';
  }

  function isGuestUserId(id) {
    var s = id != null ? String(id).trim() : '';
    if (!s) return true;
    if (s === 'guest' || s === '0' || s === '-1') return true;
    // user_-123 style guest subjects (negative numeric id)
    var m = /^user_(-?\d+)$/i.exec(s);
    if (m) {
      var n = parseInt(m[1], 10);
      return !Number.isFinite(n) || n <= 0;
    }
    if (/^-\d+$/.test(s)) return true;
    return false;
  }

  function applyMember(isAdminUser) {
    state.isAdmin = !!isAdminUser;
    state.userRole = isAdminUser ? 'admin' : 'user';
    state.isGuest = false;
    resolved = true;
  }

  // 1) getRole: host may soft-default to guest when instance.userRole unset —
  //    host now re-probes context/user, so user/admin here is authoritative.
  if (Tapp.user && typeof Tapp.user.getRole === 'function') {
    try {
      var role = await Tapp.user.getRole();
      if (role != null && String(role).trim() !== '') {
        var roleNorm = String(role).trim().toLowerCase();
        if (roleNorm === 'admin' || roleNorm === 'user') {
          applyMember(roleNorm === 'admin');
        }
        // roleNorm === 'guest': soft — verify via getUser / isLoggedIn
      }
    } catch (e) { /* fall through */ }
  }

  // 2) getUser — strongest session signal (JWT cookie + grant)
  if (!resolved) {
    try {
      var user = null;
      if (Tapp.context && typeof Tapp.context.getUser === 'function') {
        user = await Tapp.context.getUser();
      }
      if (user && typeof user === 'object') {
        var rawRole = user.role != null ? String(user.role).trim().toLowerCase() : '';
        var username = user.username != null ? String(user.username).trim() : '';
        var id = user.id != null ? String(user.id).trim() : '';
        var isAdminUser = !!(user.isAdmin === true || rawRole === 'admin');
        var isExplicitGuest = rawRole === 'guest' || isGuestUsername(username) || isGuestUserId(id);
        if (isAdminUser) {
          applyMember(true);
        } else if (!isExplicitGuest && (
          rawRole === 'user'
          || user.authenticated === true
          || (!isGuestUserId(id) && username)
        )) {
          applyMember(false);
        }
      }
    } catch (e) {
      console.warn('[Aro] context.getUser failed during role resolve:', e);
    }
  }

  // 3) isLoggedIn after host re-probe (true only when role is not guest)
  if (!resolved && Tapp.user && typeof Tapp.user.isLoggedIn === 'function') {
    try {
      if (await Tapp.user.isLoggedIn()) {
        var adminFlag = false;
        try {
          if (typeof Tapp.user.isAdmin === 'function') {
            adminFlag = !!(await Tapp.user.isAdmin());
          }
        } catch (e2) { /* non-admin member */ }
        applyMember(adminFlag);
      }
    } catch (e) { /* remain guest */ }
  }

  // 4) Last resort: isAdmin true only
  if (!resolved && Tapp.user && typeof Tapp.user.isAdmin === 'function') {
    try {
      if (await Tapp.user.isAdmin()) {
        applyMember(true);
      }
    } catch (e) { /* remain guest */ }
  }

  if (resolved) {
    console.info('[Aro] role resolved', state.userRole);
  } else {
    console.warn('[Aro] remaining guest — messenger/rings locked');
  }

  applyAdminControls();
  applyRoleControls();
}

function normalizeFederationUrl(value) {
  if (value === null || value === undefined) return '';
  var text = String(value).trim();
  if (!text) return '';
  var lower = text.toLowerCase();
  if (
    lower === 'null' ||
    lower === 'undefined' ||
    lower.indexOf('null/') === 0 ||
    lower.indexOf('undefined/') === 0 ||
    lower.indexOf('://null') !== -1 ||
    lower.indexOf('://undefined') !== -1
  ) {
    return '';
  }
  try {
    var parsed = new URL(text);
    var protocol = parsed.protocol.toLowerCase();
    var host = (parsed.hostname || '').toLowerCase();
    if ((protocol !== 'http:' && protocol !== 'https:') || !host || host === 'null' || host === 'undefined') {
      return '';
    }
    return text;
  } catch (e) {
    return '';
  }
}

function normalizeFederationDomain(value) {
  if (value === null || value === undefined) return '';
  var text = String(value).trim();
  if (!text) return '';
  var lower = text.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return '';
  return text.replace(/^@+/, '');
}

function getIdentityActorUrl() {
  var identity = state.identity || {};
  return normalizeFederationUrl(identity.actor_url) || normalizeFederationUrl(state.localActorUrl);
}

function sanitizeFederationIdentity(identity) {
  if (!identity) return null;
  var clean = {};
  Object.keys(identity).forEach(function (key) {
    clean[key] = identity[key];
  });
  clean.actor_url = normalizeFederationUrl(clean.actor_url);
  clean.domain = normalizeFederationDomain(clean.domain);
  if (!clean.domain && clean.actor_url) {
    try { clean.domain = new URL(clean.actor_url).host; } catch (e) {}
  }
  if (!clean.handle && clean.acct) clean.handle = '@' + String(clean.acct).replace(/^@/, '');
  if (!clean.handle && clean.username && clean.domain) clean.handle = '@' + clean.username + '@' + clean.domain;
  if (!clean.acct && clean.handle) clean.acct = String(clean.handle).replace(/^@/, '');
  if (!clean.actor_url) {
    clean.inbox_url = '';
    clean.outbox_url = '';
    clean.followers_url = '';
    clean.following_url = '';
  }
  return clean;
}

function getIdentityHandle() {
  var identity = state.identity || {};
  if (identity.handle) return identity.handle;
  if (identity.acct) return '@' + identity.acct;
  var domain = normalizeFederationDomain(identity.domain);
  if (identity.username && domain) return '@' + identity.username + '@' + domain;
  return '';
}

function synthesizeFederationIdentityFromUser(user) {
  if (state.identity || !user) return;
  var rawUsername = user.username || user.display_name || user.name || '';
  rawUsername = String(rawUsername).replace(/^@/, '').split('@')[0];
  if (!rawUsername) return;

  var actorUrl = normalizeFederationUrl(user.actor_url) || getIdentityActorUrl();
  var domain = '';
  if (actorUrl) {
    try { domain = new URL(actorUrl).host; } catch (e) {}
  }
  if (!domain) domain = normalizeFederationDomain(user.domain || user.instance_domain) || 'local';

  var acct = rawUsername + '@' + domain;
  state.identity = {
    username: rawUsername,
    domain: domain,
    handle: '@' + acct,
    acct: acct,
    webfinger_resource: 'acct:' + acct,
    actor_url: actorUrl,
    inbox_url: actorUrl ? actorUrl + '/inbox' : '',
    outbox_url: actorUrl ? actorUrl + '/outbox' : '',
    followers_url: actorUrl ? actorUrl + '/followers' : '',
    following_url: actorUrl ? actorUrl + '/following' : '',
    profile_url: ''
  };
  if (actorUrl) state.localActorUrl = actorUrl;
}

function renderFederationIdentity() {
  var identity = sanitizeFederationIdentity(state.identity) || {};
  state.identity = Object.keys(identity).length > 0 ? identity : null;
  var handle = getIdentityHandle();
  var actorUrl = getIdentityActorUrl();
  var visible = !!(handle || actorUrl);

  if (actorUrl) state.localActorUrl = actorUrl;
  else if (state.localActorUrl && !normalizeFederationUrl(state.localActorUrl)) state.localActorUrl = null;

  document.querySelectorAll('[data-fed-profile]').forEach(function (card) {
    card.style.display = visible ? '' : 'none';
    card.classList.toggle('feed-identity-actor-missing', !actorUrl);
    card.querySelectorAll('[data-fed-handle-summary]').forEach(function (handleEl) {
      handleEl.textContent = handle || actorUrl;
    });
    card.querySelectorAll('[data-fed-actor]').forEach(function (actorEl) {
      actorEl.textContent = actorUrl;
      actorEl.disabled = !actorUrl;
      actorEl.style.display = actorUrl ? '' : 'none';
    });
    card.querySelectorAll('[data-fed-toggle-button]').forEach(function (toggleBtn) {
      toggleBtn.style.display = actorUrl ? '' : 'none';
    });
    if (!actorUrl) setFeedProfileExpanded(card, false);
  });

  var profileHandle = $('feed-handle');
  if (profileHandle && handle) profileHandle.textContent = handle;
}

function avatarContentHtml(url, name) {
  var initial = ((name || '?')[0] || '?').toUpperCase();
  if (url) return '<img src="' + esc(url) + '" alt="" />';
  return esc(initial);
}

/** Unwrap getRoomMembers response: { members, total } or legacy bare array. */
function unwrapRoomMembers(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.members)) return res.members;
  return [];
}

/** Active (non-pending) members — matches server member_count semantics. */
function activeMemberCountFromList(members) {
  var list = members || state.members || [];
  var n = 0;
  for (var i = 0; i < list.length; i++) {
    var st = list[i].membership_status || list[i].status || 'active';
    if (st === 'active') n++;
  }
  return n;
}

/** Cheap roster fingerprint for poll / WS refresh de-dupe. */
function membersFingerprint(members) {
  var list = members || [];
  var parts = [];
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    parts.push(
      String(m.actor_url || '')
        + '|'
        + String(m.role || '')
        + '|'
        + String(m.membership_status || m.status || 'active'),
    );
  }
  parts.sort();
  return parts.join(';') + '#' + list.length;
}

/** Keep roomDetail + conversation list member_count in sync with roster. */
function applyRoomMemberCount(roomId, count) {
  if (!roomId || count == null || count < 0) return;
  if (state.roomDetail && (state.roomDetail.room_id === roomId || state.activeId === roomId)) {
    state.roomDetail.member_count = count;
  }
  for (var i = 0; i < (state.rooms || []).length; i++) {
    if (state.rooms[i].room_id === roomId) {
      state.rooms[i].member_count = count;
      break;
    }
  }
}

function sameActorUrl(a, b) {
  var left = normalizeFederationUrl(a) || String(a || '').trim().replace(/\/+$/, '');
  var right = normalizeFederationUrl(b) || String(b || '').trim().replace(/\/+$/, '');
  if (!left || !right) return false;
  return left === right || left.replace(/\/+$/, '') === right.replace(/\/+$/, '');
}

function findMemberByActor(actorUrl) {
  if (!actorUrl) return null;
  for (var i = 0; i < state.members.length; i++) {
    var m = state.members[i];
    if (sameActorUrl(m.actor_url, actorUrl)) return m;
  }
  return null;
}

// @ Mentions → page/mentionUi.js

function renderFeedProfileUser(user) {
  if (!user) return;
  var name = user.display_name || user.username || '';
  var avatar = user.avatar_url || user.avatar || '';
  // Prefer federation identity avatar when context only has placeholder/empty
  if (!avatar && state.identity && state.identity.avatar_url) {
    avatar = state.identity.avatar_url;
  }
  if (!name && state.identity) {
    name = state.identity.display_name || state.identity.username || name;
  }
  var initial = ((name || user.username || '?')[0] || '?').toUpperCase();
  document.querySelectorAll('[data-feed-avatar]').forEach(function (avatarEl) {
    if (avatar) avatarEl.innerHTML = '<img src="' + esc(avatar) + '" alt="" />';
    else avatarEl.textContent = initial;
  });
  document.querySelectorAll('[data-feed-display-name]').forEach(function (nameEl) {
    nameEl.textContent = name;
  });
  var fallbackHandle = user.username ? '@' + user.username : '';
  if (!state.identity && fallbackHandle) {
    document.querySelectorAll('[data-fed-handle-summary]').forEach(function (handleEl) {
      handleEl.textContent = fallbackHandle;
    });
  }
}

function setFeedProfileExpanded(card, expanded) {
  if (!card) return;
  if (expanded && card.classList.contains('feed-identity-actor-missing')) return;
  card.classList.toggle('feed-profile-expanded', !!expanded);
  var summary = card.querySelector('[data-fed-toggle]');
  if (summary) summary.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  card.querySelectorAll('[data-fed-toggle-button]').forEach(function (toggleBtn) {
    toggleBtn.setAttribute('title', expanded ? (lang.collapseDetails || '收起') : (lang.expandDetails || '展开'));
  });
}

function isTabletFeedProfileCard(card) {
  return !!(card && card.closest('.feed-sidebar') && window.matchMedia && window.matchMedia('(min-width: 769px) and (max-width: 1024px)').matches);
}

function closeFeedProfilePopovers(exceptCard) {
  document.querySelectorAll('.feed-profile-popover-open').forEach(function (card) {
    if (card !== exceptCard) {
      card.classList.remove('feed-profile-popover-open');
      setFeedProfileExpanded(card, false);
    }
  });
}

function setFeedProfilePopoverOpen(card, open) {
  if (!card) return;
  if (open) {
    closeFeedProfilePopovers(card);
    card.classList.add('feed-profile-popover-open');
    setFeedProfileExpanded(card, false);
  } else {
    card.classList.remove('feed-profile-popover-open');
    setFeedProfileExpanded(card, false);
  }
}

function toggleFeedProfileDetails(card) {
  if (!card || card.classList.contains('feed-identity-actor-missing')) return;
  setFeedProfileExpanded(card, !card.classList.contains('feed-profile-expanded'));
}

function toggleFeedProfileSummary(card) {
  if (!card) return;
  if (isTabletFeedProfileCard(card)) {
    setFeedProfilePopoverOpen(card, !card.classList.contains('feed-profile-popover-open'));
    return;
  }
  toggleFeedProfileDetails(card);
}

async function loadFederationIdentity() {
  if (state.isGuest) {
    try {
      var guestUser = await Tapp.context.getUser();
      synthesizeFederationIdentityFromUser(guestUser);
    } catch (e) {}
    renderFederationIdentity();
    return;
  }
  if (!Tapp.federation || typeof Tapp.federation.getIdentity !== 'function') {
    try {
      var fallbackUser = await Tapp.context.getUser();
      synthesizeFederationIdentityFromUser(fallbackUser);
    } catch (e) {}
    renderFederationIdentity();
    return;
  }
  try {
    var identity = await Tapp.federation.getIdentity();
    if (identity) {
      state.identity = sanitizeFederationIdentity(identity);
      var actorUrl = getIdentityActorUrl();
      if (actorUrl) state.localActorUrl = actorUrl;
    }
  } catch (e) {
    console.warn('[Aro] federation identity unavailable:', e);
  }
  if (!state.identity) {
    try {
      var fallbackUser2 = await Tapp.context.getUser();
      synthesizeFederationIdentityFromUser(fallbackUser2);
    } catch (e2) {}
  }
  renderFederationIdentity();
}

function fallbackCopyText(text) {
  var area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', 'readonly');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, text.length);
  var ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  } finally {
    area.remove();
  }
  return ok;
}

/** Copy arbitrary text with sandbox-safe clipboard fallback. */
async function copyTextToClipboard(text, opts) {
  opts = opts || {};
  if (!text) {
    if (!opts.silent) {
      try { Tapp.ui.showNotification({ title: lang.copyFail, type: 'error' }); } catch (e0) {}
    }
    return false;
  }
  var ok = false;
  // Tapp 运行在 opaque-origin 的沙箱 iframe 中，异步 Clipboard API 会被
  // 浏览器以 NotAllowedError 拒绝，因此拒绝后必须回退到 execCommand。
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch (e) {
    ok = false;
  }
  if (!ok) ok = fallbackCopyText(text);
  if (!opts.silent) {
    if (ok) {
      try {
        Tapp.ui.showNotification({
          title: lang.copied,
          message: opts.showMessage === false ? undefined : text,
          type: 'success',
        });
      } catch (e2) {}
    } else {
      try { Tapp.ui.showNotification({ title: lang.copyFail, type: 'error' }); } catch (e3) {}
    }
  }
  return ok;
}

async function copyFederationIdentity(kind) {
  var text = kind === 'actor' ? getIdentityActorUrl() : getIdentityHandle();
  if (!text) return;
  await copyTextToClipboard(text);
}

function isLocalActor(actor) {
  if (!actor) return false;
  var localActor = getIdentityActorUrl();
  if (localActor && sameActorUrl(actor, localActor)) return true;
  if (state.localActorUrl && sameActorUrl(actor, state.localActorUrl)) return true;
  if (state.activeKind === 'channel' && state.channelDetail && state.channelDetail.remote_actor_url) {
    // In a 1:1 channel, anything that is not the remote peer is local
    return !sameActorUrl(actor, state.channelDetail.remote_actor_url);
  }
  if (state.activeKind === 'room' && state.members.length > 0) {
    var member = findMemberByActor(actor);
    if (member) return !!member.is_local;
  }
  return String(actor).indexOf('myriad.local') !== -1;
}

function applyLabels() {
  var el;
  el = $('nav-messages-label'); if (el) el.textContent = lang.navMessages;
  el = $('nav-rings-label'); if (el) el.textContent = lang.navRings;
  el = $('nav-feed-label'); if (el && !el.textContent) el.textContent = lang.navFeed || lang.feedTimeline;
  // Messenger sidebar (not ring sidebar)
  el = document.querySelector('#view-messages .sidebar-title'); if (el) el.textContent = lang.title || 'Messenger';
  el = document.querySelector('#view-messages .empty-text'); if (el) el.textContent = lang.selectHint || 'Pick a conversation to start messaging';
  el = $('empty-start-btn'); if (el) el.textContent = lang.startChat || lang.create || 'New chat';
  el = $('create-btn'); if (el) { el.setAttribute('title', lang.create); el.setAttribute('aria-label', lang.create); }
  el = $('conv-tab-recent'); if (el) el.textContent = lang.convTabRecent || 'Recent';
  el = $('conv-tab-dm'); if (el) el.textContent = lang.convTabDm || lang.dm || 'DMs';
  el = $('conv-tab-room'); if (el) el.textContent = lang.convTabRoom || lang.rooms || 'Groups';
  el = $('feed-empty-title');
  if (el && typeof getFeedEmptyTitle === 'function') {
    el.style.display = 'block';
    el.hidden = false;
    if (!$('feed-empty') || !$('feed-empty').classList.contains('feed-empty-error')) {
      el.textContent = getFeedEmptyTitle(state.feedSubTab);
    }
  }
  el = $('feed-empty-text');
  if (el && typeof getFeedEmptyText === 'function') {
    el.style.display = 'block';
    el.hidden = false;
    if (!$('feed-empty') || !$('feed-empty').classList.contains('feed-empty-error')) {
      el.textContent = getFeedEmptyText(state.feedSubTab);
    }
  }
  el = $('feed-empty-retry'); if (el) el.textContent = lang.feedRetry || 'Try again';
  el = $('msg-input'); if (el) el.placeholder = lang.typing;
  el = $('attach-btn'); if (el) { el.setAttribute('title', lang.attach || lang.attachFile); el.setAttribute('aria-label', lang.attach || lang.attachFile); }
  el = $('sticker-btn'); if (el) {
    var stTitle = lang.stickerBtn || lang.stickers || 'Stickers';
    el.setAttribute('title', stTitle);
    el.setAttribute('aria-label', stTitle);
  }
  if (typeof applyStickerLabels === 'function') applyStickerLabels();
  el = $('send-btn'); if (el) { el.setAttribute('title', lang.send); el.setAttribute('aria-label', lang.send); }
  el = $('back-btn'); if (el) el.setAttribute('aria-label', lang.back || 'Back');
  el = $('member-back-btn'); if (el) el.setAttribute('aria-label', lang.back || 'Back');
  el = $('member-title'); if (el && state.activeKind !== 'room') el.textContent = lang.members;
  el = $('invite-toggle'); if (el) { el.setAttribute('title', lang.invite); el.setAttribute('aria-label', lang.invite); }
  el = $('feed-nav-timeline'); if (el) el.textContent = lang.feedTimeline;
  el = $('feed-nav-following'); if (el) el.textContent = lang.feedFollowing;
  el = $('feed-nav-followers'); if (el) el.textContent = lang.feedFollowers;
  el = $('feed-nav-published'); if (el) el.textContent = lang.feedPublished;
  el = $('feed-nav-bookmarks'); if (el) el.textContent = lang.feedBookmarks || 'Bookmarks';
  el = $('feed-nav-settings'); if (el) el.textContent = lang.feedSettings || lang.settingsTitle || 'Settings';
  el = $('feed-tab-timeline'); if (el) el.textContent = lang.feedTimeline;
  el = $('feed-tab-following'); if (el) el.textContent = lang.feedFollowing;
  el = $('feed-tab-followers'); if (el) el.textContent = lang.feedFollowers;
  el = $('feed-tab-published'); if (el) el.textContent = lang.feedPublished;
  el = $('feed-tab-bookmarks'); if (el) el.textContent = lang.feedBookmarks || 'Bookmarks';
  el = $('feed-tab-settings'); if (el) el.textContent = lang.feedSettings || lang.settingsTitle || 'Settings';
  if (typeof applyHistoryLabels === 'function') applyHistoryLabels();
  if (typeof applyRoomFilesLabels === 'function') applyRoomFilesLabels();
  el = $('feed-follow-input'); if (el) el.placeholder = lang.followPlaceholder;
  el = $('feed-follow-btn'); if (el) el.textContent = lang.followBtn;
  el = $('feed-follow-dialog-title'); if (el) el.textContent = lang.followDialogTitle || lang.followBtn || 'Follow';
  var plusLabel = lang.feedPlus || lang.create || 'Add';
  el = $('feed-plus-btn'); if (el) { el.setAttribute('title', plusLabel); el.setAttribute('aria-label', plusLabel); }
  el = $('feed-plus-mobile-btn'); if (el) { el.setAttribute('title', plusLabel); el.setAttribute('aria-label', plusLabel); }
  el = $('feed-plus-post-label'); if (el) el.textContent = lang.composePost || 'Post';
  el = $('feed-plus-follow-label'); if (el) el.textContent = lang.followBtn || 'Follow';
  el = $('feed-plus-post-label-mobile'); if (el) el.textContent = lang.composePost || 'Post';
  el = $('feed-plus-follow-label-mobile'); if (el) el.textContent = lang.followBtn || 'Follow';
  el = $('feed-plus-post'); if (el) el.setAttribute('aria-label', lang.composePost || 'Post');
  el = $('feed-plus-follow'); if (el) el.setAttribute('aria-label', lang.followBtn || 'Follow');
  el = $('feed-plus-post-mobile'); if (el) el.setAttribute('aria-label', lang.composePost || 'Post');
  el = $('feed-plus-follow-mobile'); if (el) el.setAttribute('aria-label', lang.followBtn || 'Follow');
  el = $('feed-compose-dialog-title'); if (el) el.textContent = lang.composeDialogTitle || lang.composePost || 'Post';
  el = $('feed-compose-dialog-close'); if (el) el.setAttribute('aria-label', lang.composeCancel || lang.close || 'Close');
  el = $('feed-compose-text'); if (el) el.placeholder = lang.composePlaceholder || '';
  el = $('feed-compose-image-label'); if (el) el.textContent = lang.composeAddImage || 'Image';
  el = $('feed-compose-image-btn'); if (el) el.setAttribute('title', lang.composeAddImage || 'Image');
  el = $('feed-compose-video-label'); if (el) el.textContent = lang.composeAddVideo || 'Video';
  el = $('feed-compose-video-btn'); if (el) el.setAttribute('title', lang.composeAddVideo || 'Video');
  el = $('feed-compose-cancel'); if (el) el.textContent = lang.composeCancel || 'Cancel';
  el = $('feed-compose-publish'); if (el) el.textContent = lang.composePublish || 'Publish';
  if (typeof applyQuoteRepostLabels === 'function') applyQuoteRepostLabels();
  el = $('feed-compose-draft-hint');
  if (el && !el.hidden) el.textContent = lang.composeDraftRestored || 'Draft restored';
  el = $('feed-compose-draft-notice');
  if (el && !el.hidden) el.textContent = lang.composeDraftTextOnly || '';
  el = $('refresh-feed-btn'); if (el) { el.setAttribute('title', lang.refresh); el.setAttribute('aria-label', lang.refresh); }
  el = $('refresh-feed-mobile-btn'); if (el) { el.setAttribute('title', lang.refresh); el.setAttribute('aria-label', lang.refresh); }
  applySearchInputLabel('conv-search', lang.searchConversations || lang.pickerSearchPlaceholder);
  applySearchInputLabel('ring-search', lang.searchRings || lang.pickerSearchPlaceholder);
  applySearchInputLabel('feed-search', lang.searchFeed || lang.pickerSearchPlaceholder);
  applySearchInputLabel('member-search', lang.searchMembers || lang.pickerSearchPlaceholder);
  applySearchInputLabel('invite-contact-search', lang.searchContacts || lang.pickerSearchPlaceholder);
  // Always set header title (even while loading) so HTML placeholders never stick in the wrong locale
  el = $('feed-section-title');
  if (el && typeof getFeedTitle === 'function') {
    el.textContent = getFeedTitle(state.feedSubTab);
  }
  if (typeof updateFeedPlusVisibility === 'function') updateFeedPlusVisibility();
  else if (typeof updateComposeButtonVisibility === 'function') updateComposeButtonVisibility();
  document.querySelectorAll('[data-copy-fed]').forEach(function (node) { node.setAttribute('title', lang.copy); });
  document.querySelectorAll('[data-fed-profile]').forEach(function (card) {
    setFeedProfileExpanded(card, card.classList.contains('feed-profile-expanded'));
  });
  if (typeof updateFeedHeader === 'function') updateFeedHeader();
  el = $('ring-sidebar-title'); if (el) el.textContent = lang.navRings || 'Rings';
  el = $('ring-select-hint'); if (el) el.textContent = lang.selectRing || lang.emptyRings || 'Select a ring';
  el = $('ring-create-title'); if (el) el.textContent = lang.createRingTitle;
  el = $('ring-create-open-btn'); if (el) { el.setAttribute('title', lang.create); el.setAttribute('aria-label', lang.create); }
  el = $('ring-name-input'); if (el) el.placeholder = lang.ringNamePlaceholder;
  el = $('create-ring-btn'); if (el) el.textContent = lang.createRingBtn;
  el = $('ring-peer-input'); if (el) el.placeholder = lang.addPeerPlaceholder;
  el = $('ring-add-peer-btn'); if (el) el.textContent = lang.addPeerBtn;
  el = $('ring-sync-label'); if (el) el.textContent = lang.syncBtn;
  el = $('ring-sync-btn'); if (el) el.setAttribute('title', lang.syncBtn);
  el = $('ring-leave-label'); if (el) el.textContent = lang.leaveBtn;
  el = $('ring-id-label'); if (el) el.textContent = lang.ringId || 'Ring ID';
  el = $('ring-id-copy');
  if (el) {
    el.setAttribute('title', lang.copy || 'Copy');
    el.setAttribute('aria-label', (lang.copy || 'Copy') + ' ' + (lang.ringId || 'Ring ID'));
  }
  el = $('ring-type-opt-brew'); if (el) el.textContent = lang.ringTypeBrewRecommend;
  el = $('ring-type-opt-tapp'); if (el) el.textContent = lang.ringTypeTappStore;
  el = $('ring-type-opt-library'); if (el) el.textContent = lang.ringTypeLibraryExchange;
  el = $('ring-type-opt-instance'); if (el) el.textContent = lang.ringTypeInstanceDirectory;
  if (typeof refreshAroSelectLabel === 'function') refreshAroSelectLabel('ring-type-select');
  el = $('ring-brew-category-label'); if (el) el.textContent = lang.ringBrewCategoryLabel || 'Brew category (optional)';
  el = $('ring-brew-category-all'); if (el) el.textContent = lang.ringBrewCategoryAll || 'All my categories';
  if (typeof refreshAroSelectLabel === 'function') refreshAroSelectLabel('ring-brew-category-select');
  el = $('ring-brew-category-input'); if (el) el.placeholder = lang.ringBrewCategoryPlaceholder || 'Or type a category name';
  document.querySelectorAll('[data-i18n-empty-peers]').forEach(function (node) {
    node.textContent = lang.emptyPeers;
  });
  updateSendState();
}

function applyDialogLabels() {
  var el;
  el = $('create-dialog-title'); if (el) el.textContent = lang.create;
  el = $('create-channel-input'); if (el) el.placeholder = lang.channelPlaceholder;
  el = $('create-room-input'); if (el) el.placeholder = lang.roomPlaceholder;
  el = $('create-channel-btn'); if (el) el.textContent = lang.createChannel;
  el = $('create-room-btn'); if (el) el.textContent = lang.createRoom;
  el = $('create-tab-channel'); if (el) el.textContent = lang.newChannel;
  el = $('create-tab-room'); if (el) el.textContent = lang.newRoom;
  el = $('create-room-public-label'); if (el) el.textContent = lang.createPublic || lang.makePublic;
  el = $('join-room-id-label'); if (el) el.textContent = lang.joinRoomById || lang.joinRoom;
  el = $('join-room-id-input'); if (el) el.placeholder = lang.joinRoomIdPlaceholder || 'room id';
  el = $('join-room-id-btn'); if (el) el.textContent = lang.joinRoom || 'Join';
  el = $('invite-input'); if (el) el.placeholder = lang.invitePlaceholder;
  el = $('invite-pop-contacts-label'); if (el) el.textContent = lang.inviteFromContacts;
  el = $('invite-pop-manual-label'); if (el) el.textContent = lang.inviteManual;
  el = $('edit-room-title'); if (el) el.textContent = lang.editRoom;
  el = $('edit-name-label'); if (el) el.textContent = lang.roomName;
  el = $('edit-desc-label'); if (el) el.textContent = lang.roomDesc;
  el = $('edit-invite-policy-label'); if (el) el.textContent = lang.invitePolicy || 'Invite policy';
  el = $('edit-room-public-label'); if (el) el.textContent = lang.makePublic;
  el = $('edit-room-id-label'); if (el) el.textContent = lang.roomId || 'Room ID';
  el = $('edit-room-id-copy'); if (el) el.textContent = lang.copy || 'Copy';
  el = $('edit-room-save'); if (el) el.textContent = lang.save;
  el = $('edit-room-avatar-title'); if (el) el.textContent = lang.roomAvatar || 'Group avatar';
  el = $('edit-room-avatar-hint'); if (el) el.textContent = lang.roomAvatarHint || 'Tap to change';
  el = $('edit-room-avatar-btn'); if (el) el.setAttribute('aria-label', lang.roomAvatar || 'Group avatar');
  el = $('create-room-avatar-title'); if (el) el.textContent = lang.roomAvatar || 'Group avatar';
  el = $('create-room-avatar-hint'); if (el) el.textContent = lang.roomAvatarHintCreate || lang.roomAvatarOptional || 'Optional · tap to upload';
  el = $('create-room-avatar-btn'); if (el) el.setAttribute('aria-label', lang.roomAvatar || 'Group avatar');
  el = $('create-room-desc'); if (el) el.placeholder = lang.roomDescPlaceholder || lang.roomDesc || 'Description (optional)';
  el = $('edit-room-invite-policy');
  if (el && el.options && el.options.length >= 3) {
    el.options[0].text = lang.invitePolicyAdmin || 'Admins only';
    el.options[1].text = lang.invitePolicyMember || 'Members can invite';
    el.options[2].text = lang.invitePolicyOpen || 'Open join';
  }
}
