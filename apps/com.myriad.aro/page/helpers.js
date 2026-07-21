// ==================== Helpers ====================
function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

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
 * Bind a list-search input once. Updates state.search[key] and calls onChange.
 * @param {string} inputId
 * @param {string} stateKey key under state.search
 * @param {function} onChange
 */
function bindListSearch(inputId, stateKey, onChange) {
  var input = $(inputId);
  if (!input || input.dataset.searchBound === '1') return;
  input.dataset.searchBound = '1';
  if (state.search && state.search[stateKey]) {
    input.value = state.search[stateKey];
  }
  input.addEventListener('input', function () {
    if (!state.search) state.search = {};
    state.search[stateKey] = input.value || '';
    if (typeof onChange === 'function') onChange();
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
  try { void el.offsetWidth; } catch (e) { /* ignore */ }
  el.classList.add(className);
  var done = function () {
    el.classList.remove(className);
    el.removeEventListener('animationend', done);
  };
  el.addEventListener('animationend', done);
  setTimeout(done, 400);
}

/**
 * Hide or remove an element after a short exit animation (class `aro-leaving`).
 * @param {HTMLElement} el
 * @param {{ remove?: boolean, ms?: number, onDone?: function }} opts
 */
function aroDismiss(el, opts) {
  opts = opts || {};
  if (!el) { if (opts.onDone) opts.onDone(); return; }
  var finished = false;
  var finish = function () {
    if (finished) return;
    finished = true;
    el.classList.remove('aro-leaving');
    el.removeEventListener('animationend', onAnimEnd);
    if (opts.remove) {
      try { el.remove(); } catch (e) { /* ignore */ }
    } else {
      el.style.display = 'none';
    }
    if (opts.onDone) opts.onDone();
  };
  var onAnimEnd = function (e) {
    // Ignore bubbled end events from child sheet/dialog animations.
    if (e && e.target && e.target !== el) return;
    finish();
  };
  if (prefersReducedMotion() || el.style.display === 'none') {
    finish();
    return;
  }
  el.classList.add('aro-leaving');
  el.addEventListener('animationend', onAnimEnd);
  setTimeout(finish, opts.ms || 180);
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
    || state.roomDetail.membership_status
    || 'active';
  return st === 'pending';
}

function isRoomComposerLocked() {
  return isRoomInvitePending();
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
    input.disabled = locked || !state.activeId;
    input.setAttribute('aria-disabled', input.disabled ? 'true' : 'false');
    if (locked) input.placeholder = lockMsg || lang.typing || '';
    else if (lang.typing) input.placeholder = lang.typing;
  }
  if (attach) {
    attach.disabled = blocked;
    attach.setAttribute('aria-disabled', blocked ? 'true' : 'false');
    attach.title = locked ? (lockMsg || lang.attach || '') : (lang.attach || '');
  }

  if (!btn) return;
  var hasContent = !!((input && !input.disabled && input.value.trim()) || (!locked && state.pendingAttach));
  var ready = !blocked && hasContent;
  btn.disabled = !ready;
  btn.classList.toggle('send-ready', ready);
  btn.setAttribute('aria-label', lang.send || 'Send');
  btn.title = locked ? (lockMsg || lang.send || '') : (lang.send || 'Send');
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
 */
function getPayloadText(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') {
    try { return String(payload); } catch (e0) { return ''; }
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

/** "Open original" affordance; only https links are offered (sandbox blocks the rest). */
function brewLinkHtml(url) {
  var href = String(url || '').trim();
  if (href.toLowerCase().indexOf('https://') !== 0) return '';
  return '<a class="sheet-link" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">'
    + esc(lang.openOriginal || 'Open original')
    + '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
    + '</a>';
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
    icon = '<img src="' + esc(opts.cover) + '" alt="" />';
  } else if (opts.rawSvg) {
    icon = opts.rawSvg;
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
 */
function safeIconUrl(url) {
  if (!url) return '';
  var v = String(url).trim();
  var lower = v.toLowerCase();
  if (lower.indexOf('https://') === 0 || lower.indexOf('data:image/') === 0) return v;
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
function resolveShareCardView(msgType, payload) {
  payload = payload || {};
  var untitled = lang.shareUntitled || 'Untitled';
  var title = '';
  var description = '';
  var image = String(payload.image || payload.cover || '').trim();

  if (msgType === 'report') {
    title = String(payload.summary || payload.title || '').trim();
    description = String(payload.description || '').trim();
    if (!description) {
      if (payload.platform && payload.content_preview && payload.content_preview !== payload.summary) {
        description = payload.platform + ' · ' + payload.content_preview;
      } else {
        description = String(payload.content_preview || payload.platform || '').trim();
        if (description === title) description = String(payload.platform || '').trim();
      }
    } else if (payload.summary && description === title) {
      description = String(payload.platform || '').trim();
    }
  } else if (msgType === 'library') {
    title = String(payload.title || payload.summary || payload.name || '').trim();
    description = String(payload.description || '').trim();
    if (!description) {
      var libParts = [];
      if (payload.platform_id) libParts.push(String(payload.platform_id));
      var itemKind = payload.item_type || (payload.content_type && payload.content_type !== 'library' ? payload.content_type : '');
      if (itemKind) libParts.push(String(itemKind));
      description = libParts.join(' · ');
    }
    if (!image) image = String(payload.thumbnail || '').trim();
  } else if (msgType === 'tapp') {
    title = String(payload.title || payload.tapp_name || payload.name || '').trim();
    description = String(payload.description || payload.tapp_id || '').trim();
    if (description === title) description = String(payload.tapp_id || '').trim();
  } else if (msgType === 'brew') {
    title = String(payload.title || payload.name || '').trim();
    description = String(payload.description || '').trim();
  } else {
    title = String(payload.title || payload.summary || payload.name || '').trim();
    description = String(payload.description || '').trim();
  }

  if (!title) {
    // Last-resort fallbacks — never blank
    if (msgType === 'tapp' && payload.tapp_id) title = String(payload.tapp_id);
    else if (msgType === 'library' && payload.item_id) title = String(payload.item_id);
    else if (msgType === 'report' && payload.report_id) title = String(payload.report_id);
    else if (msgType === 'brew' && payload.brew_id) title = 'Brew #' + payload.brew_id;
    else title = shareTypeLabel(msgType) || untitled;
  }
  if (description === title) description = '';
  return { title: title, description: description, image: image };
}

/* ---------------------------------------------------------------------------
 * Media (library) share cards — image-forward layout with sender attribution.
 * A game/anime/music share carries its own cover art, so it renders as a poster
 * card rather than the compact icon+title row. Playtime / watch progress / the
 * sender's rating travel as flat snapshot fields so recipients render without a
 * re-fetch (mirrors frontend LibraryGrid + libraryWatchProgress conventions).
 * ------------------------------------------------------------------------- */

/** Parse a non-negative integer, tolerating strings; null when not usable. */
function mediaInt(value) {
  if (value == null || value === '') return null;
  var n = typeof value === 'number' ? value : Number(value);
  if (!isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/** Parse "5/12", "5/?", "5" style progress → {cur,total|null} | null. */
function parseProgressStr(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    var only = mediaInt(raw);
    return only == null ? null : { cur: only, total: null };
  }
  if (typeof raw !== 'string') return null;
  var s = raw.trim();
  if (!s) return null;
  var m = s.match(/^(\d+)\s*\/\s*(\d+|\?)$/);
  if (m) {
    var total = m[2] === '?' ? null : Number(m[2]);
    return { cur: Number(m[1]), total: (total && total > 0) ? total : null };
  }
  var n = s.match(/^(\d+)$/);
  if (n) return { cur: Number(n[1]), total: null };
  return null;
}

/** anime / video / tv_series are episode-tracked; book is chapter-tracked. */
function isAnimeLikeType(itemType) {
  return itemType === 'anime' || itemType === 'tv_series' || itemType === 'video';
}

/** Episode/chapter total from Bangumi/MAL-shaped metadata. */
function mediaEpisodeTotal(meta) {
  if (!meta || typeof meta !== 'object') return null;
  var subject = (meta.subject && typeof meta.subject === 'object') ? meta.subject : {};
  var node = (meta.node && typeof meta.node === 'object') ? meta.node : {};
  return mediaInt(subject.eps) != null ? mediaInt(subject.eps)
    : (mediaInt(node.num_episodes) != null ? mediaInt(node.num_episodes)
      : mediaInt(meta.num_episodes));
}

/**
 * Extract structured sender stats from a live library item at share time.
 * @returns {{playtimeMin:(number|null), rating:(number|null),
 *            progressCur:(number|null), progressTotal:(number|null)}}
 */
function extractLibraryStats(itemType, meta) {
  var out = { playtimeMin: null, rating: null, progressCur: null, progressTotal: null };
  if (!meta || typeof meta !== 'object') meta = {};
  var ls = (meta.list_status && typeof meta.list_status === 'object') ? meta.list_status : {};

  // Playtime (games): Steam stores minutes in playtime_forever.
  var pt = mediaInt(meta.playtime_forever);
  if (pt == null) pt = mediaInt(meta.playtime);
  if (pt != null && pt > 0) out.playtimeMin = pt;

  // Rating: Bangumi `rate` / MAL `list_status.score` (0 == unrated).
  var rate = meta.rate != null ? Number(meta.rate) : Number(ls.score);
  if (isFinite(rate) && rate > 0) out.rating = Math.round(rate * 10) / 10;

  // Watch/read progress (anime-like → episodes, book → chapters).
  var parts = parseProgressStr(meta.progress);
  if (isAnimeLikeType(itemType)) {
    if (!parts) {
      var watched = mediaInt(meta.ep_status);
      if (watched == null) watched = mediaInt(ls.num_episodes_watched);
      if (watched == null) watched = mediaInt(meta.num_episodes_watched);
      if (watched != null) parts = { cur: watched, total: mediaEpisodeTotal(meta) };
    } else if (parts.total == null) {
      var total = mediaEpisodeTotal(meta);
      if (total != null) parts.total = total;
    }
  } else if (itemType === 'book') {
    var ch = mediaInt(meta.ep_status);
    if (ch == null) ch = mediaInt(ls.num_chapters_read);
    if (ch == null) ch = mediaInt(meta.num_chapters_read);
    if (ch != null) parts = { cur: ch, total: null };
    else if (parts && parts.total == null) parts = { cur: parts.cur, total: null };
  } else {
    parts = null; // games/music carry no episode progress
  }
  // Suppress a meaningless 0 with no total (wishlist / untouched).
  if (parts && !(parts.cur === 0 && parts.total == null)) {
    out.progressCur = parts.cur;
    out.progressTotal = parts.total;
  }
  return out;
}

/**
 * Artist + album for a music item, from Netease-shaped (`ar`/`al`) or flat
 * (`artist`/`album`) metadata. Empty strings when unknown.
 */
function extractMusicMeta(meta) {
  var out = { artist: '', album: '' };
  if (!meta || typeof meta !== 'object') return out;
  var ar = meta.ar || meta.artists || meta.artist;
  if (Array.isArray(ar)) {
    out.artist = ar.map(function (a) { return (a && (a.name || (typeof a === 'string' ? a : ''))) || ''; })
      .filter(Boolean).join(', ');
  } else if (typeof ar === 'string') {
    out.artist = ar.trim();
  }
  if (meta.al && typeof meta.al === 'object') out.album = String(meta.al.name || '').trim();
  else if (typeof meta.album === 'string') out.album = meta.album.trim();
  return out;
}

/** Localized playtime label: hours once past an hour, minutes below. */
function formatPlaytime(min) {
  var n = Number(min);
  if (!isFinite(n) || n <= 0) return '';
  if (n < 60) return (lang.mediaMinutes || '{v}m').replace('{v}', String(Math.round(n)));
  return (lang.mediaHours || '{v}h').replace('{v}', String(Math.round(n / 60)));
}

/** Localized watch/read progress label from stored cur/total. */
function formatWatchProgress(cur, total, itemType) {
  var c = mediaInt(cur);
  if (c == null) return '';
  var t = mediaInt(total);
  var isBook = itemType === 'book';
  if (t != null && t > 0) {
    return (isBook ? (lang.mediaCh || '{c}/{t}') : (lang.mediaEp || '{c}/{t}'))
      .replace('{c}', String(c)).replace('{t}', String(t));
  }
  return (isBook ? (lang.mediaChOnly || '{c}') : (lang.mediaEpOnly || '{c}'))
    .replace('{c}', String(c));
}

/**
 * Render model for a library media card, read from a message payload's flat
 * snapshot fields. `stat` is the sender-attributed line (playtime OR progress).
 */
function libraryMediaView(payload) {
  payload = payload || {};
  var base = resolveShareCardView('library', payload);
  var itemType = String(payload.item_type || payload.content_type || '').trim();
  if (itemType === 'library') itemType = '';
  var ratingText = '';
  var rating = Number(payload.rating);
  if (isFinite(rating) && rating > 0) ratingText = String(Math.round(rating * 10) / 10);

  var stat = null;
  var ptText = formatPlaytime(payload.playtime_min);
  if (ptText) {
    stat = { icon: SVG_ICONS.gamepad, text: ptText };
  } else {
    var progText = formatWatchProgress(payload.progress_cur, payload.progress_total, itemType);
    if (progText) stat = { icon: SVG_ICONS.playCircle, text: progText };
  }
  return {
    image: base.image,
    title: base.title,
    description: base.description,
    itemType: itemType,
    platform: String(payload.platform_id || '').trim(),
    ratingText: ratingText,
    artist: String(payload.artist || '').trim(),
    album: String(payload.album || '').trim(),
    stat: stat,
  };
}

/** Best-guess cover orientation before the image loads (games ship banners). */
function mediaCoverOrient(itemType) {
  return itemType === 'game' ? 'landscape' : 'portrait';
}

/** Localized content-kind label ("Game" / "番剧" / …); '' when unknown. */
function mediaKindLabel(itemType) {
  var t = String(itemType || '').trim();
  if (!t) return '';
  var k = lang['mediaKind_' + t];
  if (k) return k;
  var fallback = {
    game: 'Game', anime: 'Anime', music: 'Music',
    tv_series: 'TV', book: 'Book', video: 'Video',
  };
  return fallback[t] || (t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' '));
}

/**
 * 应用内确认对话框（沙箱 iframe 中原生 confirm() 会被浏览器拦截并静默返回 false）。
 * 返回 Promise<boolean>。
 */
function aroConfirm(message, danger) {
  return new Promise(function (resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
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
    overlay.querySelector('.confirm-btn-ok').focus();
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
  el = $('create-btn'); if (el) { el.setAttribute('title', lang.create); el.setAttribute('aria-label', lang.create); }
  el = $('conv-tab-recent'); if (el) el.textContent = lang.convTabRecent || 'Recent';
  el = $('conv-tab-dm'); if (el) el.textContent = lang.convTabDm || lang.dm || 'DMs';
  el = $('conv-tab-room'); if (el) el.textContent = lang.convTabRoom || lang.rooms || 'Groups';
  el = $('conv-closed-toggle');
  if (el) {
    var closedLabel = lang.convTabClosed || lang.closed || 'Closed';
    el.textContent = closedLabel;
    el.setAttribute('title', closedLabel);
    el.setAttribute('aria-label', closedLabel);
  }
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
  el = $('ring-brew-category-label'); if (el) el.textContent = lang.ringBrewCategoryLabel || 'Brew category (optional)';
  el = $('ring-brew-category-all'); if (el) el.textContent = lang.ringBrewCategoryAll || 'All my categories';
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
  el = $('edit-room-public-label'); if (el) el.textContent = lang.makePublic;
  el = $('edit-room-id-label'); if (el) el.textContent = lang.roomId || 'Room ID';
  el = $('edit-room-id-copy'); if (el) el.textContent = lang.copy || 'Copy';
  el = $('edit-room-save'); if (el) el.textContent = lang.save;
}
