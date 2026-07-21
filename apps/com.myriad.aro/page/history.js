// ==================== Chat History Browser + Archive Export/Import ====================
// Per-conversation history panel (search / filter / load older).
// Profile sub-page `backup`: export all chats + import archives (local Tapp.storage).

var ARO_ARCHIVE_FORMAT = 'myriad.aro.chat-archive';
var ARO_ARCHIVE_VERSION = 1;
var ARO_IMPORTED_ARCHIVES_KEY = 'aro.importedArchives.v1';
var HISTORY_PAGE_LIMIT = 100;
var HISTORY_MAX_EXPORT_PAGES = 40; // 40 * 100 = 4000 msgs/conversation safety cap

function ensureHistoryState() {
  if (!state.history) {
    state.history = {
      open: false,
      kind: null,
      id: null,
      messages: [],
      query: '',
      filter: 'all',
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: null,
      mainLoadingOlder: false,
    };
  }
  return state.history;
}

function unwrapMessagesResponse(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.messages)) return res.messages;
  if (res.data) {
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data.messages)) return res.data.messages;
  }
  return [];
}

/** Normalize message_type for filters (text | image | file | share | system). */
function classifyHistoryMessage(msg) {
  if (!msg) return 'text';
  if (msg.is_pinned) { /* pin is orthogonal */ }
  var payload = (typeof msg.payload === 'object' && msg.payload) ? msg.payload : {};
  var mt = msg.message_type || 'text';
  if (mt === 'text' || !mt) {
    var knownShare = { tapp: 1, brew: 1, library: 1, report: 1, image: 1, file: 1, 'file-meta': 1 };
    if (payload.content_type && knownShare[payload.content_type]) mt = payload.content_type;
    else if (payload.tapp_id) mt = 'tapp';
    else if (payload.brew_id || payload.brew_link) mt = 'brew';
    else if (payload.report_id) mt = 'report';
    else if (payload.platform_id && (payload.item_id || payload.title)) mt = 'library';
    else if (payload.data && payload.mime_type && String(payload.mime_type).indexOf('image/') === 0) mt = 'image';
    else if (payload.transfer_id && payload.filename) mt = 'file-meta';
    else if (payload.data && payload.filename) mt = 'file';
  }
  if (isE2eKeyExchangeMessage(msg, mt, payload)) return 'system';
  if (mt === 'image') return 'image';
  if (mt === 'file' || mt === 'file-meta') return 'file';
  if (mt === 'tapp' || mt === 'brew' || mt === 'library' || mt === 'report') return 'share';
  if (mt === 'system') return 'system';
  return 'text';
}

function historyMessageSearchParts(msg) {
  var payload = (typeof msg.payload === 'object' && msg.payload) ? msg.payload : {};
  var text = '';
  try {
    text = (typeof getPayloadText === 'function' ? getPayloadText(msg.payload) : '') || '';
  } catch (e) { text = ''; }
  var sender = (msg.sender_actor || '').split('/').pop() || '';
  var displayName = historySenderLabel(msg);
  return [
    text,
    displayName,
    sender,
    msg.sender_actor,
    msg.message_type,
    classifyHistoryMessage(msg),
    payload.title,
    payload.filename,
    payload.tapp_id,
    payload.brew_link,
    payload.name,
    msg.message_id,
  ];
}

function historySenderLabel(msg) {
  if (!msg) return '?';
  var sender = (msg.sender_actor || '').split('/').pop() || '?';
  if (typeof isLocalActor === 'function' && isLocalActor(msg.sender_actor)) {
    return lang.me || lang.local || 'Me';
  }
  if (state.activeKind === 'channel' && state.channelDetail) {
    return state.channelDetail.remote_actor_name || sender;
  }
  if (state.activeKind === 'room' && typeof findMemberByActor === 'function') {
    var m = findMemberByActor(msg.sender_actor);
    if (m && m.display_name) return m.display_name;
  }
  return sender;
}

function historyPreviewText(msg) {
  if (typeof messagePreview === 'function') {
    try { return messagePreview(msg); } catch (e) { /* fall through */ }
  }
  var payload = (typeof msg.payload === 'object' && msg.payload) ? msg.payload : {};
  var kind = classifyHistoryMessage(msg);
  if (kind === 'image') return lang.previewImage || 'Image';
  if (kind === 'file') return lang.previewFile || 'File';
  if (kind === 'share') {
    return payload.title || payload.name || payload.tapp_id || payload.brew_link || (lang.attach || 'Share');
  }
  var t = typeof getPayloadText === 'function' ? getPayloadText(msg.payload) : '';
  if (!t && payload.title) t = String(payload.title);
  if (!t && payload.filename) t = String(payload.filename);
  if (!t) t = lang.newMessage || 'Message';
  return t.length > 120 ? t.slice(0, 119) + '…' : t;
}

function filterHistoryMessages(messages, query, filter) {
  var q = normalizeSearchQuery(query);
  var f = filter || 'all';
  return (messages || []).filter(function (msg) {
    if (f === 'pinned' && !msg.is_pinned) return false;
    if (f !== 'all' && f !== 'pinned') {
      if (classifyHistoryMessage(msg) !== f) return false;
    }
    if (!q) return true;
    return matchesSearch(q, historyMessageSearchParts(msg));
  });
}

function mergeMessageListsAsc(existing, incoming) {
  var map = {};
  var out = [];
  function push(msg) {
    if (!msg || !msg.message_id) return;
    if (map[msg.message_id]) {
      // Prefer newer object fields
      for (var i = 0; i < out.length; i++) {
        if (out[i].message_id === msg.message_id) {
          out[i] = Object.assign({}, out[i], msg);
          break;
        }
      }
      return;
    }
    map[msg.message_id] = true;
    out.push(msg);
  }
  (existing || []).forEach(push);
  (incoming || []).forEach(push);
  out.sort(function (a, b) {
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });
  return out;
}

async function fetchMessagesPage(kind, id, before, limit) {
  limit = limit || HISTORY_PAGE_LIMIT;
  var res = null;
  if (kind === 'channel') {
    res = await Tapp.federation.getMessages(id, before || undefined, limit);
  } else {
    res = await Tapp.federation.getRoomMessages(id, before || undefined, limit);
  }
  return unwrapMessagesResponse(res);
}

/** Fetch up to maxPages older pages for one conversation (ASC list). */
async function fetchAllMessagesForConversation(kind, id, opts) {
  opts = opts || {};
  var maxPages = opts.maxPages || HISTORY_MAX_EXPORT_PAGES;
  var limit = opts.limit || HISTORY_PAGE_LIMIT;
  var onProgress = opts.onProgress;
  var all = [];
  var before = undefined;
  var page = 0;
  while (page < maxPages) {
    var batch = await fetchMessagesPage(kind, id, before, limit);
    page += 1;
    if (!batch.length) break;
    // API returns ASC; with `before`, still ASC older page
    all = mergeMessageListsAsc(batch, all);
    if (typeof onProgress === 'function') onProgress(all.length, kind, id);
    if (batch.length < limit) break;
    before = batch[0].message_id; // oldest in this page
    if (!before) break;
  }
  return all;
}

// ---------- Per-conversation history panel ----------

function historyConversationTitle() {
  if (state.activeKind === 'channel' && state.channelDetail) {
    return state.channelDetail.remote_actor_name
      || (state.channelDetail.remote_actor_url || '').split('/').pop()
      || lang.dm
      || 'Chat';
  }
  if (state.activeKind === 'room' && state.roomDetail) {
    return state.roomDetail.name || lang.members || 'Room';
  }
  return lang.historyTitle || 'Chat history';
}

function openChatHistory() {
  ensureHistoryState();
  if (!state.activeKind || !state.activeId) return;
  var h = state.history;
  h.open = true;
  h.kind = state.activeKind;
  h.id = state.activeId;
  h.query = h.query || '';
  h.filter = h.filter || 'all';
  h.error = null;
  // Seed from live window
  h.messages = mergeMessageListsAsc([], state.messages || []);
  h.hasMore = (state.messages || []).length >= 150; // likely more if near page size
  h.loading = false;
  h.loadingMore = false;

  var overlay = $('chat-history-overlay');
  if (!overlay) return;
  overlay.hidden = false;
  overlay.style.display = 'flex';
  overlay.style.pointerEvents = 'auto';
  overlay.classList.remove('aro-leaving', 'aro-history-enter');
  // Restart enter animation
  try { void overlay.offsetWidth; } catch (eAnim) { /* ignore */ }
  if (typeof prefersReducedMotion === 'function' && prefersReducedMotion()) {
    /* no enter class */
  } else {
    overlay.classList.add('aro-history-enter');
    var clearEnter = function () {
      overlay.classList.remove('aro-history-enter');
      overlay.removeEventListener('animationend', clearEnter);
    };
    overlay.addEventListener('animationend', clearEnter);
    setTimeout(clearEnter, 360);
  }

  applyHistoryLabels();
  var search = $('history-search');
  if (search) search.value = h.query || '';
  syncHistoryFilterChips();
  renderHistoryList();
  updateHistoryFooter();

  // If live window is short, still try one older page in background when empty/filter
  if (h.messages.length === 0) {
    loadMoreHistoryMessages();
  }

  if (search) {
    try { search.focus(); } catch (e) { /* ignore */ }
  }
}

function sealHistoryOverlay(overlay) {
  if (!overlay) return;
  overlay.classList.remove('aro-history-enter', 'aro-leaving');
  overlay.style.display = 'none';
  overlay.hidden = true;
  overlay.style.pointerEvents = 'none';
}

function closeChatHistory() {
  ensureHistoryState();
  state.history.open = false;
  var overlay = $('chat-history-overlay');
  if (!overlay) return;
  // Always seal pointer-events so a stuck flex overlay cannot block the list
  if (overlay.style.display === 'none' || overlay.hidden) {
    sealHistoryOverlay(overlay);
    return;
  }
  overlay.classList.remove('aro-history-enter');
  // Block hits immediately while exit animation runs
  overlay.style.pointerEvents = 'none';
  if (typeof aroDismiss === 'function') {
    aroDismiss(overlay, {
      ms: 160,
      onDone: function () {
        sealHistoryOverlay(overlay);
      },
    });
  } else {
    sealHistoryOverlay(overlay);
  }
}

function isChatHistoryOpen() {
  var overlay = $('chat-history-overlay');
  return !!(overlay && overlay.style.display !== 'none' && !overlay.hidden);
}

function applyHistoryLabels() {
  var el;
  el = $('history-title');
  if (el) el.textContent = lang.historyTitle || 'Chat history';
  el = $('history-subtitle');
  if (el) el.textContent = historyConversationTitle();
  el = $('history-close');
  if (el) el.setAttribute('aria-label', lang.close || lang.dismiss || 'Close');
  applySearchInputLabel('history-search', lang.historySearchPlaceholder || lang.searchPlaceholder || 'Search…');
  el = $('history-load-more');
  if (el) el.textContent = lang.historyLoadMore || 'Load older messages';

  var filterLabels = {
    all: lang.historyFilterAll || 'All',
    text: lang.historyFilterText || 'Text',
    image: lang.historyFilterImage || 'Images',
    file: lang.historyFilterFile || 'Files',
    share: lang.historyFilterShare || 'Shares',
    pinned: lang.historyFilterPinned || 'Pinned',
  };
  document.querySelectorAll('[data-history-filter]').forEach(function (btn) {
    var key = btn.getAttribute('data-history-filter');
    if (filterLabels[key]) btn.textContent = filterLabels[key];
  });
}

function syncHistoryFilterChips() {
  var h = ensureHistoryState();
  document.querySelectorAll('[data-history-filter]').forEach(function (btn) {
    var active = btn.getAttribute('data-history-filter') === h.filter;
    btn.classList.toggle('history-filter-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function historyEmptyHtml(title, body) {
  var icon = '<div class="aro-empty-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>';
  return '<div class="history-empty">'
    + icon
    + (title ? '<div class="history-empty-title">' + esc(title) + '</div>' : '')
    + '<div>' + esc(body || '') + '</div>'
    + '</div>';
}

function historyPinSvg() {
  return '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 11V4a1 1 0 011-1h4a1 1 0 011 1v7"/><path d="M5 17h14"/><path d="M7 11l-2 6h14l-2-6"/></svg>';
}

function historyAvatarForMsg(msg, displayName, local) {
  var avatarUrl = '';
  if (!local) {
    if (state.activeKind === 'channel' && state.channelDetail) {
      avatarUrl = state.channelDetail.remote_actor_avatar || '';
    } else if (state.activeKind === 'room' && typeof findMemberByActor === 'function') {
      var m = findMemberByActor(msg.sender_actor);
      if (m) avatarUrl = m.avatar_url || '';
    }
  }
  var cls = 'history-item-avatar' + (local ? ' history-item-avatar-local' : '');
  if (typeof avatarContentHtml === 'function') {
    return '<div class="' + cls + '">' + avatarContentHtml(avatarUrl, displayName || '?') + '</div>';
  }
  return '<div class="' + cls + '">' + esc((displayName || '?').charAt(0).toUpperCase()) + '</div>';
}

function updateHistoryFooter() {
  var h = ensureHistoryState();
  var meta = $('history-meta');
  var loadBtn = $('history-load-more');
  var filtered = filterHistoryMessages(h.messages, h.query, h.filter);
  if (meta) {
    meta.classList.toggle('history-meta-error', !!h.error && !h.loadingMore);
    if (h.loadingMore) {
      meta.textContent = lang.historyLoading || lang.pickerLoading || 'Loading…';
    } else if (h.error) {
      meta.textContent = h.error;
    } else {
      var q = normalizeSearchQuery(h.query);
      var total = (h.messages || []).length;
      if (q || (h.filter && h.filter !== 'all')) {
        meta.textContent = (lang.historyMatchCount || '{n} / {total}')
          .replace('{n}', String(filtered.length))
          .replace('{total}', String(total));
      } else {
        meta.textContent = (lang.historyCount || '{n} messages').replace('{n}', String(total));
      }
    }
  }
  if (loadBtn) {
    loadBtn.hidden = !h.hasMore;
    loadBtn.disabled = !!h.loadingMore;
    loadBtn.textContent = h.loadingMore
      ? (lang.historyLoading || 'Loading…')
      : (lang.historyLoadMore || 'Load older messages');
  }
}

function renderHistoryList() {
  var list = $('history-list');
  if (!list) return;
  var h = ensureHistoryState();
  var filtered = filterHistoryMessages(h.messages, h.query, h.filter);
  // Newest first for browsing
  var view = filtered.slice().reverse();

  if (h.loading && !h.messages.length) {
    list.innerHTML = historyEmptyHtml(lang.historyLoading || lang.pickerLoading || 'Loading…', '');
    return;
  }
  if (!h.messages.length) {
    list.innerHTML = historyEmptyHtml(
      lang.historyEmpty || 'No messages yet',
      lang.emptyChatHint || ''
    );
    return;
  }
  if (!view.length) {
    list.innerHTML = historyEmptyHtml(
      lang.searchNoResults || 'No matches',
      lang.historySearchPlaceholder || ''
    );
    return;
  }

  var html = '';
  var lastDay = '';
  view.forEach(function (msg) {
    var day = '';
    try {
      var d = new Date(msg.created_at);
      if (!isNaN(d)) day = d.toDateString();
    } catch (e) { day = ''; }
    if (day && day !== lastDay) {
      lastDay = day;
      html += '<div class="history-day"><span>' + esc(typeof dayLabel === 'function' ? dayLabel(msg.created_at) : day) + '</span></div>';
    }
    var kind = classifyHistoryMessage(msg);
    var local = typeof isLocalActor === 'function' && isLocalActor(msg.sender_actor);
    var time = typeof timeStr === 'function' ? timeStr(msg.created_at) : '';
    var name = historySenderLabel(msg);
    var kindClass = kind !== 'text' ? (' history-item-kind-' + kind) : '';
    html += '<button type="button" class="history-item' + (local ? ' history-item-local' : '') + '" data-msg-id="' + esc(msg.message_id || '') + '">'
      + historyAvatarForMsg(msg, name, local)
      + '<div class="history-item-body">'
      + '<div class="history-item-top">'
      + '<span class="history-item-name">' + esc(name) + '</span>'
      + (msg.is_pinned ? '<span class="history-item-pin" title="' + esc(lang.msgPin || 'Pinned') + '">' + historyPinSvg() + '</span>' : '')
      + (kind !== 'text' ? '<span class="history-item-kind' + kindClass + '">' + esc(historyKindLabel(kind)) + '</span>' : '')
      + (time ? '<span class="history-item-time">' + esc(time) + '</span>' : '')
      + '</div>'
      + '<div class="history-item-text">' + esc(historyPreviewText(msg)) + '</div>'
      + '</div>'
      + '</button>';
  });
  list.innerHTML = html;
  list.querySelectorAll('.history-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      jumpToHistoryMessage(btn.getAttribute('data-msg-id'));
    });
  });
  updateHistoryFooter();
}

function historyKindLabel(kind) {
  if (kind === 'image') return lang.historyFilterImage || 'Image';
  if (kind === 'file') return lang.historyFilterFile || 'File';
  if (kind === 'share') return lang.historyFilterShare || 'Share';
  if (kind === 'system') return lang.previewSystem || 'System';
  return lang.historyFilterText || 'Text';
}

async function loadMoreHistoryMessages() {
  var h = ensureHistoryState();
  if (!h.open || !h.kind || !h.id || h.loadingMore) return;
  if (!h.hasMore && h.messages.length) return;
  h.loadingMore = true;
  h.error = null;
  updateHistoryFooter();
  try {
    var before = h.messages.length ? h.messages[0].message_id : undefined;
    var batch = await fetchMessagesPage(h.kind, h.id, before, HISTORY_PAGE_LIMIT);
    if (!batch.length) {
      h.hasMore = false;
    } else {
      var prevLen = h.messages.length;
      h.messages = mergeMessageListsAsc(h.messages, batch);
      h.hasMore = batch.length >= HISTORY_PAGE_LIMIT && h.messages.length > prevLen;
    }
  } catch (e) {
    h.error = (typeof getErrorMessage === 'function' ? getErrorMessage(e) : '') || lang.historyLoadFail || lang.loadFail || 'Load failed';
    console.error('[Aro] loadMoreHistoryMessages', e);
  } finally {
    h.loadingMore = false;
    renderHistoryList();
  }
}

async function jumpToHistoryMessage(msgId) {
  if (!msgId) return;
  closeChatHistory();
  // Ensure message is in the live window (load older pages if needed)
  var found = false;
  for (var i = 0; i < (state.messages || []).length; i++) {
    if (state.messages[i].message_id === msgId) { found = true; break; }
  }
  if (!found && state.activeKind && state.activeId) {
    var pages = 0;
    while (pages < HISTORY_MAX_EXPORT_PAGES && !found) {
      pages += 1;
      var older = await loadOlderMessagesIntoChat({ silent: true });
      if (!older || !older.loaded) break;
      for (var j = 0; j < state.messages.length; j++) {
        if (state.messages[j].message_id === msgId) { found = true; break; }
      }
      if (!older.hasMore) break;
    }
    if (found && typeof renderMessages === 'function') renderMessages();
  }
  var el = document.querySelector('[data-msg-id="' + msgId.replace(/"/g, '') + '"]');
  if (el) {
    try {
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    } catch (e2) {
      try { el.scrollIntoView(); } catch (e3) {}
    }
    el.classList.add('msg-highlight');
    setTimeout(function () {
      try { el.classList.remove('msg-highlight'); } catch (e4) {}
    }, 2200);
  } else {
    try {
      Tapp.ui.showNotification({
        title: lang.historyJumpMiss || lang.searchNoResults || 'Message not in view',
        type: 'error',
      });
    } catch (e5) {}
  }
}

/** Load one older page into the main chat window. Returns {loaded, hasMore}. */
async function loadOlderMessagesIntoChat(opts) {
  opts = opts || {};
  var h = ensureHistoryState();
  if (!state.activeKind || !state.activeId || h.mainLoadingOlder) {
    return { loaded: 0, hasMore: false };
  }
  if (!(state.messages || []).length) return { loaded: 0, hasMore: false };
  h.mainLoadingOlder = true;
  var container = $('messages');
  var prevHeight = container ? container.scrollHeight : 0;
  var prevTop = container ? container.scrollTop : 0;
  try {
    var before = state.messages[0].message_id;
    var batch = await fetchMessagesPage(state.activeKind, state.activeId, before, HISTORY_PAGE_LIMIT);
    if (!batch.length) return { loaded: 0, hasMore: false };
    var prevLen = state.messages.length;
    state.messages = mergeMessageListsAsc(state.messages, batch);
    var loaded = state.messages.length - prevLen;
    if (loaded > 0) {
      state.messagesFp = typeof messagesFingerprint === 'function'
        ? messagesFingerprint(state.messages)
        : state.messagesFp;
      state.skipMsgAppear = true;
      if (typeof renderMessages === 'function') renderMessages();
      if (container) {
        var newHeight = container.scrollHeight;
        container.scrollTop = prevTop + (newHeight - prevHeight);
      }
    }
    return { loaded: loaded, hasMore: batch.length >= HISTORY_PAGE_LIMIT };
  } catch (e) {
    if (!opts.silent) console.error('[Aro] loadOlderMessagesIntoChat', e);
    return { loaded: 0, hasMore: false };
  } finally {
    h.mainLoadingOlder = false;
  }
}

function bindMessagesScrollLoadOlder() {
  var container = $('messages');
  if (!container || container.dataset.historyScrollBound === '1') return;
  container.dataset.historyScrollBound = '1';
  container.addEventListener('scroll', function () {
    if (container.scrollTop > 48) return;
    if (!state.activeId || !state.messages || !state.messages.length) return;
    var h = ensureHistoryState();
    if (h.mainLoadingOlder) return;
    loadOlderMessagesIntoChat({ silent: true });
  });
}

function bindChatHistoryUi() {
  if (bindChatHistoryUi._bound) return;
  bindChatHistoryUi._bound = true;

  var closeBtn = $('history-close');
  if (closeBtn) closeBtn.addEventListener('click', closeChatHistory);

  var overlay = $('chat-history-overlay');
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeChatHistory();
    });
  }

  var search = $('history-search');
  if (search) {
    search.addEventListener('input', function () {
      ensureHistoryState().query = search.value || '';
      renderHistoryList();
    });
  }

  document.querySelectorAll('[data-history-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ensureHistoryState().filter = btn.getAttribute('data-history-filter') || 'all';
      syncHistoryFilterChips();
      renderHistoryList();
    });
  });

  var loadMore = $('history-load-more');
  if (loadMore) loadMore.addEventListener('click', function () { loadMoreHistoryMessages(); });

  bindMessagesScrollLoadOlder();
}

// ---------- Export / Import (profile backup sub-page) ----------

function sanitizePayloadForExport(payload, opts) {
  opts = opts || {};
  if (payload == null || typeof payload !== 'object') return payload;
  try {
    var copy = JSON.parse(JSON.stringify(payload));
  } catch (e) {
    return payload;
  }
  // Strip huge data-URLs unless full media requested
  if (!opts.includeMedia) {
    if (copy.data && typeof copy.data === 'string' && copy.data.length > 2048) {
      copy.data_omitted = true;
      copy.data_bytes_estimate = copy.data.length;
      delete copy.data;
    }
  }
  return copy;
}

function serializeMessageForExport(msg, opts) {
  return {
    message_id: msg.message_id || '',
    sender_actor: msg.sender_actor || '',
    message_type: msg.message_type || 'text',
    payload: sanitizePayloadForExport(msg.payload, opts),
    reply_to: msg.reply_to || null,
    is_encrypted: !!msg.is_encrypted,
    is_pinned: !!msg.is_pinned,
    created_at: msg.created_at || '',
  };
}

function buildArchiveEnvelope(conversations, opts) {
  opts = opts || {};
  var identity = state.identity || {};
  return {
    format: ARO_ARCHIVE_FORMAT,
    version: ARO_ARCHIVE_VERSION,
    exported_at: new Date().toISOString(),
    include_media: !!opts.includeMedia,
    identity: {
      actor_url: getIdentityActorUrl ? getIdentityActorUrl() : (identity.actor_url || state.localActorUrl || ''),
      handle: typeof getIdentityHandle === 'function' ? getIdentityHandle() : (identity.handle || ''),
      display_name: identity.display_name || identity.username || '',
    },
    conversations: conversations || [],
  };
}

function downloadJsonFile(filename, obj) {
  var json = JSON.stringify(obj, null, 2);
  var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    try { a.remove(); } catch (e) {}
    try { URL.revokeObjectURL(url); } catch (e2) {}
  }, 500);
}

function archiveFilename(prefix) {
  var d = new Date();
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var stamp = d.getFullYear()
    + p2(d.getMonth() + 1)
    + p2(d.getDate())
    + '-'
    + p2(d.getHours())
    + p2(d.getMinutes());
  return (prefix || 'aro-chat') + '-' + stamp + '.json';
}

async function exportActiveConversationArchive(opts) {
  opts = opts || {};
  if (!state.activeKind || !state.activeId) {
    try { Tapp.ui.showNotification({ title: lang.backupNeedConversation || lang.noConv || 'Open a chat first', type: 'error' }); } catch (e0) {}
    return;
  }
  try {
    Tapp.ui.showNotification({ title: lang.backupExporting || 'Exporting…', type: 'info' });
  } catch (e1) {}
  try {
    var msgs = await fetchAllMessagesForConversation(state.activeKind, state.activeId, {
      includeMedia: opts.includeMedia,
    });
    // Prefer fullest of live window + fetched
    msgs = mergeMessageListsAsc(state.messages || [], msgs);
    var conv = {
      kind: state.activeKind,
      id: state.activeId,
      name: historyConversationTitle(),
      remote_actor_url: state.channelDetail && state.channelDetail.remote_actor_url || '',
      member_count: state.roomDetail && state.roomDetail.member_count || undefined,
      message_count: msgs.length,
      messages: msgs.map(function (m) { return serializeMessageForExport(m, opts); }),
    };
    var archive = buildArchiveEnvelope([conv], opts);
    downloadJsonFile(archiveFilename('aro-chat-' + (state.activeKind === 'room' ? 'room' : 'dm')), archive);
    try {
      Tapp.ui.showNotification({
        title: lang.backupExportOk || 'Export ready',
        message: (lang.backupExportCount || '{n} messages').replace('{n}', String(msgs.length)),
        type: 'success',
      });
    } catch (e2) {}
  } catch (e) {
    notifyError(lang.backupExportFail || lang.loadFail || 'Export failed', e);
  }
}

async function exportAllConversationsArchive(opts) {
  opts = opts || {};
  if (state.isGuest) {
    try { Tapp.ui.showNotification({ title: lang.adminRequired || 'Sign in required', type: 'error' }); } catch (e0) {}
    return;
  }
  var statusEl = $('backup-status');
  var setStatus = function (t, kind) {
    if (!statusEl) return;
    statusEl.textContent = t || '';
    statusEl.classList.remove('backup-status-ok', 'backup-status-error');
    if (kind === 'ok') statusEl.classList.add('backup-status-ok');
    if (kind === 'error') statusEl.classList.add('backup-status-error');
  };

  try {
    setStatus(lang.backupExporting || 'Exporting…');
    // Refresh conversation list
    if (typeof loadConversations === 'function') {
      try { await loadConversations(); } catch (eLc) {}
    }
    var conversations = [];
    var channels = state.channels || [];
    var rooms = state.rooms || [];
    var totalTargets = channels.length + rooms.length;
    var done = 0;

    async function one(kind, id, name, extra) {
      done += 1;
      setStatus((lang.backupExportProgress || 'Exporting {done}/{total}…')
        .replace('{done}', String(done))
        .replace('{total}', String(totalTargets))
        + (name ? ' · ' + name : ''));
      var msgs = [];
      try {
        msgs = await fetchAllMessagesForConversation(kind, id, opts);
      } catch (eFetch) {
        console.warn('[Aro] export skip', kind, id, eFetch);
      }
      // If this is the active chat, merge live window
      if (state.activeKind === kind && state.activeId === id) {
        msgs = mergeMessageListsAsc(state.messages || [], msgs);
      }
      conversations.push(Object.assign({
        kind: kind,
        id: id,
        name: name || id,
        message_count: msgs.length,
        messages: msgs.map(function (m) { return serializeMessageForExport(m, opts); }),
      }, extra || {}));
    }

    for (var i = 0; i < channels.length; i++) {
      var ch = channels[i];
      await one(
        'channel',
        ch.channel_id,
        ch.remote_actor_name || (ch.remote_actor_url || '').split('/').pop() || ch.channel_id,
        { remote_actor_url: ch.remote_actor_url || '', status: ch.status || '' }
      );
    }
    for (var j = 0; j < rooms.length; j++) {
      var rm = rooms[j];
      await one(
        'room',
        rm.room_id,
        rm.name || rm.room_id,
        { member_count: rm.member_count || 0 }
      );
    }

    var archive = buildArchiveEnvelope(conversations, opts);
    archive.summary = {
      channels: channels.length,
      rooms: rooms.length,
      messages: conversations.reduce(function (n, c) { return n + (c.message_count || 0); }, 0),
    };
    downloadJsonFile(archiveFilename('aro-chat-all'), archive);
    setStatus(
      (lang.backupExportOk || 'Export ready') + ' · '
        + (lang.backupExportCount || '{n} messages').replace('{n}', String(archive.summary.messages)),
      'ok'
    );
    try {
      Tapp.ui.showNotification({
        title: lang.backupExportOk || 'Export ready',
        message: (lang.backupExportCount || '{n} messages').replace('{n}', String(archive.summary.messages)),
        type: 'success',
      });
    } catch (e2) {}
  } catch (e) {
    setStatus(lang.backupExportFail || lang.loadFail || 'Export failed', 'error');
    notifyError(lang.backupExportFail || lang.loadFail || 'Export failed', e);
  }
}

function parseChatArchive(raw) {
  var data = raw;
  if (typeof raw === 'string') {
    data = JSON.parse(raw);
  }
  if (!data || typeof data !== 'object') throw new Error('Invalid archive');
  // Accept envelope or bare conversation list
  if (data.format && data.format !== ARO_ARCHIVE_FORMAT) {
    // still allow if conversations array present
    if (!Array.isArray(data.conversations)) {
      throw new Error(lang.backupImportFormat || 'Unknown archive format');
    }
  }
  if (!Array.isArray(data.conversations)) {
    if (Array.isArray(data.messages) && data.id) {
      data = {
        format: ARO_ARCHIVE_FORMAT,
        version: ARO_ARCHIVE_VERSION,
        exported_at: data.exported_at || new Date().toISOString(),
        conversations: [data],
      };
    } else {
      throw new Error(lang.backupImportFormat || 'Unknown archive format');
    }
  }
  return data;
}

async function loadImportedArchives() {
  try {
    if (!Tapp.storage || typeof Tapp.storage.get !== 'function') return [];
    var list = await Tapp.storage.get(ARO_IMPORTED_ARCHIVES_KEY);
    if (!list) return [];
    if (typeof list === 'string') {
      try { list = JSON.parse(list); } catch (e) { return []; }
    }
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn('[Aro] loadImportedArchives', e);
    return [];
  }
}

async function saveImportedArchives(list) {
  if (!Tapp.storage || typeof Tapp.storage.set !== 'function') {
    throw new Error('storage unavailable');
  }
  // Cap stored archives to last 10 to protect storage quota
  var trimmed = (list || []).slice(0, 10);
  await Tapp.storage.set(ARO_IMPORTED_ARCHIVES_KEY, trimmed);
  return trimmed;
}

async function importChatArchiveFromFile(file) {
  if (!file) return;
  var statusEl = $('backup-status');
  var setStatus = function (t, kind) {
    if (!statusEl) return;
    statusEl.textContent = t || '';
    statusEl.classList.remove('backup-status-ok', 'backup-status-error');
    if (kind === 'ok') statusEl.classList.add('backup-status-ok');
    if (kind === 'error') statusEl.classList.add('backup-status-error');
  };
  setStatus(lang.backupImporting || 'Importing…');
  try {
    var text = await new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(reader.error || new Error('read failed')); };
      reader.readAsText(file);
    });
    var archive = parseChatArchive(text);
    var msgCount = 0;
    (archive.conversations || []).forEach(function (c) {
      msgCount += (c.messages && c.messages.length) || c.message_count || 0;
    });
    var entry = {
      id: 'imp-' + Date.now().toString(36),
      imported_at: new Date().toISOString(),
      source_name: file.name || 'archive.json',
      exported_at: archive.exported_at || '',
      identity: archive.identity || null,
      summary: archive.summary || {
        channels: (archive.conversations || []).filter(function (c) { return c.kind === 'channel'; }).length,
        rooms: (archive.conversations || []).filter(function (c) { return c.kind === 'room'; }).length,
        messages: msgCount,
      },
      // Store full archive for offline browse
      archive: archive,
    };
    var list = await loadImportedArchives();
    list.unshift(entry);
    await saveImportedArchives(list);
    setStatus(
      (lang.backupImportOk || 'Import saved') + ' · '
        + (lang.backupExportCount || '{n} messages').replace('{n}', String(msgCount)),
      'ok'
    );
    try {
      Tapp.ui.showNotification({
        title: lang.backupImportOk || 'Import saved',
        message: (lang.backupImportHint || 'Browse under Imported archives'),
        type: 'success',
      });
    } catch (e2) {}
    refreshSettingsOrBackupPage();
  } catch (e) {
    setStatus(lang.backupImportFail || 'Import failed', 'error');
    notifyError(lang.backupImportFail || 'Import failed', e);
  }
}

async function deleteImportedArchive(id) {
  var list = await loadImportedArchives();
  list = list.filter(function (a) { return a.id !== id; });
  await saveImportedArchives(list);
  if (state.history && state.history.browseArchiveId === id) {
    state.history.browseArchiveId = null;
    state.history.browseConversationId = null;
  }
  refreshSettingsOrBackupPage();
}

function openImportedArchiveBrowser(entryId, conversationKey) {
  ensureHistoryState();
  state.history.browseArchiveId = entryId;
  state.history.browseConversationId = conversationKey || null;
  state.history.browseQuery = state.history.browseQuery || '';
  refreshSettingsOrBackupPage();
}

function backupConversationKey(conv, idx) {
  return (conv.kind || 'x') + ':' + (conv.id || idx);
}

// ---------- Aro client settings (localStorage key: aro.settings) ----------
// Schema:
// {
//   defaultVisibility: 'public' | 'unlisted' | 'followers',
//     // sent to createNote/publish; backend resolve_audience special-cases
//     // "public" and "followers" (other values e.g. unlisted → empty audience)
//   showRepostsInHome: boolean,   // local filter on home timeline
//   autoE2eOnOpen: boolean,       // maybePublishE2eKeys on open chat
//   whoCanMessage: 'everyone' | 'followers' | 'nobody'  // local-only (no backend)
// }
var ARO_SETTINGS_KEY = 'aro.settings';
var ARO_VISIBILITY_VALUES = { public: 1, unlisted: 1, followers: 1 };
var ARO_WHO_VALUES = { everyone: 1, followers: 1, nobody: 1 };

function defaultAroSettings() {
  return {
    defaultVisibility: 'public',
    showRepostsInHome: true,
    autoE2eOnOpen: true,
    whoCanMessage: 'everyone',
  };
}

function normalizeAroSettings(raw) {
  var d = defaultAroSettings();
  if (!raw || typeof raw !== 'object') return d;
  var vis = String(raw.defaultVisibility || d.defaultVisibility);
  if (!ARO_VISIBILITY_VALUES[vis]) vis = d.defaultVisibility;
  var who = String(raw.whoCanMessage || d.whoCanMessage);
  if (!ARO_WHO_VALUES[who]) who = d.whoCanMessage;
  return {
    defaultVisibility: vis,
    showRepostsInHome: raw.showRepostsInHome !== false,
    autoE2eOnOpen: raw.autoE2eOnOpen !== false,
    whoCanMessage: who,
  };
}

function loadAroSettings() {
  var next = defaultAroSettings();
  try {
    if (typeof localStorage !== 'undefined') {
      var raw = localStorage.getItem(ARO_SETTINGS_KEY);
      if (raw) next = normalizeAroSettings(JSON.parse(raw));
    }
  } catch (e0) { /* ignore */ }
  state.aroSettings = next;
  state.e2ePreferEncrypt = next.autoE2eOnOpen !== false;
  return next;
}

function saveAroSettings(partial) {
  var cur = normalizeAroSettings(state.aroSettings || loadAroSettings());
  var merged = normalizeAroSettings(Object.assign({}, cur, partial || {}));
  state.aroSettings = merged;
  state.e2ePreferEncrypt = merged.autoE2eOnOpen !== false;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ARO_SETTINGS_KEY, JSON.stringify(merged));
    }
  } catch (e1) { /* ignore */ }
  try {
    if (Tapp.storage && typeof Tapp.storage.set === 'function') {
      Tapp.storage.set(ARO_SETTINGS_KEY, merged).catch(function () {});
    }
  } catch (e2) { /* ignore */ }
  return merged;
}

function getDefaultPostVisibility() {
  var s = state.aroSettings || loadAroSettings();
  var v = (s && s.defaultVisibility) || 'public';
  return ARO_VISIBILITY_VALUES[v] ? v : 'public';
}

function refreshSettingsOrBackupPage() {
  if (state.feedSubTab === 'settings' && typeof renderSettingsPage === 'function') {
    return renderSettingsPage();
  }
  if (typeof renderBackupPage === 'function') {
    return renderBackupPage();
  }
}

function renderBackupCardsHtml(imported) {
  imported = imported || [];
  var html = '';
  html += '<div class="backup-card">';
  html += '<div class="backup-card-head">'
    + '<div class="backup-card-icon backup-card-icon-export">' + (SVG_ICONS.download || '') + '</div>'
    + '<div><div class="backup-card-title">' + esc(lang.backupExportTitle || 'Export chat history') + '</div>'
    + '<p class="backup-card-desc">' + esc(lang.backupExportDesc || 'Download a JSON backup of your direct messages and group chats from this device.') + '</p></div>'
    + '</div>';
  html += '<div class="backup-actions">';
  html += '<button type="button" class="backup-btn backup-btn-primary" id="backup-export-all">'
    + (SVG_ICONS.download || '') + '<span>' + esc(lang.backupExportAll || 'Export all chats') + '</span></button>';
  html += '<button type="button" class="backup-btn" id="backup-export-active">'
    + (SVG_ICONS.download || '') + '<span>' + esc(lang.backupExportActive || 'Export open chat') + '</span></button>';
  html += '</div>';
  html += '<label class="backup-check"><input type="checkbox" id="backup-include-media" /> '
    + '<span>' + esc(lang.backupIncludeMedia || 'Include image data (larger file)') + '</span></label>';
  html += '<div id="backup-status" class="backup-status" aria-live="polite"></div>';
  html += '</div>';

  html += '<div class="backup-card">';
  html += '<div class="backup-card-head">'
    + '<div class="backup-card-icon backup-card-icon-import">' + (SVG_ICONS.cloud || '') + '</div>'
    + '<div><div class="backup-card-title">' + esc(lang.backupImportTitle || 'Import archive') + '</div>'
    + '<p class="backup-card-desc">' + esc(lang.backupImportDesc || 'Import a previously exported JSON file to browse offline. Import does not re-send messages to the server.') + '</p></div>'
    + '</div>';
  html += '<div class="backup-actions">';
  html += '<button type="button" class="backup-btn backup-btn-primary" id="backup-import-btn">'
    + (SVG_ICONS.cloud || '') + '<span>' + esc(lang.backupImportBtn || 'Choose JSON file') + '</span></button>';
  html += '<input type="file" id="backup-import-input" accept="application/json,.json" style="display:none" />';
  html += '</div>';
  html += '</div>';

  html += '<div class="backup-card">';
  html += '<div class="backup-card-head">'
    + '<div class="backup-card-icon backup-card-icon-archive">' + (SVG_ICONS.page || '') + '</div>'
    + '<div><div class="backup-card-title">' + esc(lang.backupImportedTitle || 'Imported archives') + '</div>'
    + '<p class="backup-card-desc">' + esc(imported.length
      ? (lang.backupImportHint || '')
      : (lang.backupImportedEmpty || 'No imports yet.')) + '</p></div>'
    + '</div>';
  if (!imported.length) {
    html += '<div class="backup-empty">'
      + '<div class="aro-empty-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg></div>'
      + '<div>' + esc(lang.backupImportedEmpty || 'No imports yet.') + '</div>'
      + '</div>';
  } else {
    html += '<div class="backup-archive-list">';
    imported.forEach(function (a) {
      var sum = a.summary || {};
      var meta = [];
      if (sum.messages != null) meta.push((lang.backupExportCount || '{n} messages').replace('{n}', String(sum.messages)));
      if (a.imported_at) {
        try { meta.push(new Date(a.imported_at).toLocaleString(currentLocale)); } catch (e) { meta.push(a.imported_at); }
      }
      html += '<div class="backup-archive-item" data-archive-id="' + esc(a.id) + '">'
        + '<div class="backup-archive-icon backup-archive-icon-file">' + (SVG_ICONS.page || '') + '</div>'
        + '<div class="backup-archive-info">'
        + '<div class="backup-archive-name">' + esc(a.source_name || a.id) + '</div>'
        + '<div class="backup-archive-meta">' + esc(meta.join(' · ')) + '</div>'
        + '</div>'
        + '<div class="backup-archive-actions">'
        + '<button type="button" class="backup-btn backup-btn-sm" data-open-archive="' + esc(a.id) + '">' + esc(lang.backupBrowse || 'Browse') + '</button>'
        + '<button type="button" class="backup-btn backup-btn-sm backup-btn-danger" data-del-archive="' + esc(a.id) + '" title="' + esc(lang.remove || 'Remove') + '">' + esc(lang.remove || 'Remove') + '</button>'
        + '</div>'
        + '</div>';
    });
    html += '</div>';
  }
  html += '</div>';

  html += '<div class="backup-card backup-card-muted">';
  html += '<p class="backup-card-desc">' + esc(lang.backupPrivacyNote || 'Exports stay on your device. Large image payloads are omitted unless you enable “Include image data”.') + '</p>';
  html += '</div>';
  return html;
}

async function renderBackupPage(opts) {
  opts = opts || {};
  var embedded = !!opts.embedded;
  var content = $('feed-content');
  var empty = $('feed-empty');
  if (!content && !embedded) return;
  if (empty) empty.style.display = 'none';
  var main = content && content.closest('.feed-main');
  if (main) main.classList.remove('feed-empty-visible');

  var searchBar = document.querySelector('.feed-search-bar');
  if (searchBar) searchBar.style.display = 'none';

  if (state.isGuest) {
    var guestBody = '<div class="backup-card"><div class="backup-empty">'
      + '<div class="aro-empty-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg></div>'
      + '<div class="history-empty-title">' + esc(lang.backupTitle || 'Chat backup') + '</div>'
      + '<div>' + esc(lang.backupGuest || 'Sign in to export or import chat history.') + '</div>'
      + '</div></div>';
    if (embedded) return guestBody;
    content.innerHTML = '<div class="backup-page">' + backupHeroHtml() + guestBody + '</div>';
    return;
  }

  var h = ensureHistoryState();
  var imported = await loadImportedArchives();

  // Deep browse: archive → conversation messages
  if (h.browseArchiveId) {
    var entry = null;
    for (var i = 0; i < imported.length; i++) {
      if (imported[i].id === h.browseArchiveId) { entry = imported[i]; break; }
    }
    if (!entry) {
      h.browseArchiveId = null;
    } else if (h.browseConversationId) {
      if (content) {
        content.innerHTML = renderImportedConversationView(entry, h.browseConversationId);
        bindBackupPageEvents(content);
      }
      return;
    } else {
      if (content) {
        content.innerHTML = renderImportedArchiveView(entry);
        bindBackupPageEvents(content);
      }
      return;
    }
  }

  var cards = renderBackupCardsHtml(imported);
  if (embedded) return cards;

  content.innerHTML = '<div class="backup-page">' + backupHeroHtml() + cards + '</div>';
  bindBackupPageEvents(content);
}

async function renderSettingsPage() {
  var content = $('feed-content');
  var empty = $('feed-empty');
  if (!content) return;
  if (empty) empty.style.display = 'none';
  var main = content.closest('.feed-main');
  if (main) main.classList.remove('feed-empty-visible');
  var searchBar = document.querySelector('.feed-search-bar');
  if (searchBar) searchBar.style.display = 'none';

  var s = state.aroSettings || loadAroSettings();

  // Archive browser takes over the whole settings content area
  if (!state.isGuest) {
    var h = ensureHistoryState();
    if (h.browseArchiveId) {
      await renderBackupPage({ embedded: false });
      return;
    }
  }

  if (state.isGuest) {
    content.innerHTML = '<div class="settings-page">'
      + settingsHeroHtml()
      + '<div class="backup-card"><div class="backup-empty">'
      + '<div class="aro-empty-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/></svg></div>'
      + '<div class="history-empty-title">' + esc(lang.settingsTitle || 'Settings') + '</div>'
      + '<div>' + esc(lang.settingsGuest || 'Sign in to change settings.') + '</div>'
      + '</div></div></div>';
    return;
  }

  var vis = s.defaultVisibility || 'public';
  var who = s.whoCanMessage || 'everyone';
  var html = '<div class="settings-page">';
  html += settingsHeroHtml();

  // Posting defaults
  html += '<div class="backup-card">';
  html += '<div class="backup-card-head"><div><div class="backup-card-title">'
    + esc(lang.settingsPostingDefaults || 'Posting defaults') + '</div>'
    + '<p class="backup-card-desc">' + esc(lang.settingsDefaultVisibilityHint || 'Used when you publish a new post or reply.') + '</p></div></div>';
  html += '<div class="settings-radio-group" role="radiogroup" aria-label="' + esc(lang.settingsDefaultVisibility || 'Default post visibility') + '">';
  var visOpts = [
    { id: 'public', title: lang.settingsVisPublic || 'Public', desc: lang.settingsVisPublicDesc || '' },
    { id: 'unlisted', title: lang.settingsVisUnlisted || 'Unlisted', desc: lang.settingsVisUnlistedDesc || '' },
    { id: 'followers', title: lang.settingsVisFollowers || 'Followers only', desc: lang.settingsVisFollowersDesc || '' },
  ];
  visOpts.forEach(function (opt) {
    var sel = vis === opt.id;
    html += '<label class="settings-radio' + (sel ? ' is-selected' : '') + '">'
      + '<input type="radio" name="aro-default-visibility" value="' + esc(opt.id) + '"' + (sel ? ' checked' : '') + ' />'
      + '<span class="settings-radio-body"><span class="settings-radio-title">' + esc(opt.title) + '</span>'
      + (opt.desc ? '<div class="settings-radio-desc">' + esc(opt.desc) + '</div>' : '')
      + '</span></label>';
  });
  html += '</div></div>';

  // Feed preferences
  html += '<div class="backup-card">';
  html += '<div class="backup-card-title" style="margin-bottom:4px">' + esc(lang.settingsFeedPrefs || 'Feed preferences') + '</div>';
  html += settingsToggleRowHtml(
    'settings-show-reposts',
    lang.settingsShowReposts || 'Show reposts in home',
    lang.settingsShowRepostsHint || '',
    s.showRepostsInHome !== false
  );
  html += settingsToggleRowHtml(
    'settings-auto-e2e',
    lang.settingsAutoE2e || 'Auto-enable E2E when opening chat',
    lang.settingsAutoE2eHint || '',
    s.autoE2eOnOpen !== false
  );
  html += '</div>';

  // Privacy
  html += '<div class="backup-card">';
  html += '<div class="backup-card-head"><div><div class="backup-card-title">'
    + esc(lang.settingsPrivacy || 'Privacy') + '</div></div></div>';
  html += '<p class="settings-note">' + esc(lang.settingsWhoCanMessageHint || 'Server-side messaging limits are not available yet. Preference is stored on this device only.') + '</p>';
  html += '<div class="settings-radio-group" style="margin-top:10px" role="radiogroup" aria-label="' + esc(lang.settingsWhoCanMessage || 'Who can message you') + '">';
  var whoOpts = [
    { id: 'everyone', title: lang.settingsWhoEveryone || 'Everyone' },
    { id: 'followers', title: lang.settingsWhoFollowers || 'Followers' },
    { id: 'nobody', title: lang.settingsWhoNobody || 'Nobody' },
  ];
  whoOpts.forEach(function (opt) {
    var sel = who === opt.id;
    html += '<label class="settings-radio' + (sel ? ' is-selected' : '') + '">'
      + '<input type="radio" name="aro-who-can-message" value="' + esc(opt.id) + '"' + (sel ? ' checked' : '') + ' />'
      + '<span class="settings-radio-body"><span class="settings-radio-title">' + esc(opt.title) + '</span></span></label>';
  });
  html += '</div></div>';

  // Federation signing keys (explicit rotate via host bridge)
  html += '<div class="backup-card" id="settings-keys-card">';
  html += '<div class="backup-card-head"><div><div class="backup-card-title">'
    + esc(lang.settingsKeys || 'Federation signing keys') + '</div>'
    + '<p class="backup-card-desc">' + esc(lang.settingsKeysHint || '') + '</p></div></div>';
  html += '<p class="settings-note" id="settings-keys-status">'
    + esc(lang.settingsKeysStatusIdle || 'Keys are created automatically. Rotate only if a private key may be compromised.')
    + '</p>';
  html += '<div class="backup-actions" style="margin-top:10px">';
  html += '<button type="button" class="backup-btn backup-btn-danger" id="settings-keys-rotate">'
    + esc(lang.settingsKeysRotate || 'Rotate keys…') + '</button>';
  html += '</div></div>';

  // Outbound delivery status
  html += '<div class="backup-card" id="settings-delivery-card">';
  html += '<div class="backup-card-head"><div><div class="backup-card-title">'
    + esc(lang.settingsDelivery || 'Outbound delivery') + '</div>'
    + '<p class="backup-card-desc">' + esc(lang.settingsDeliveryHint || '') + '</p></div></div>';
  html += '<div id="settings-delivery-body" class="settings-delivery-body">'
    + '<div class="settings-note">' + esc(lang.feedLoading || 'Loading…') + '</div></div>';
  html += '<div class="backup-actions" style="margin-top:10px">';
  html += '<button type="button" class="backup-btn" id="settings-delivery-refresh">'
    + esc(lang.settingsDeliveryRefresh || 'Refresh') + '</button>';
  html += '<button type="button" class="backup-btn backup-btn-danger" id="settings-delivery-cancel-all">'
    + esc(lang.settingsDeliveryCancelAll || 'Cancel all') + '</button>';
  html += '<button type="button" class="backup-btn backup-btn-primary" id="settings-delivery-retry-all">'
    + esc(lang.settingsDeliveryRetryAll || 'Retry all failed') + '</button>';
  html += '</div></div>';

  // Data & backup
  html += '<div class="settings-section-title">' + esc(lang.settingsDataBackup || 'Data & backup') + '</div>';
  html += '<div class="settings-backup-block">';
  var backupCards = await renderBackupPage({ embedded: true });
  if (typeof backupCards === 'string') html += backupCards;
  html += '</div>';

  html += '</div>';
  content.innerHTML = html;
  bindSettingsPageEvents(content);
  bindBackupPageEvents(content);
  loadSettingsDeliveryPanel();
}

function deliveryStatusLabel(status) {
  var s = String(status || '').toLowerCase();
  if (s === 'pending') return lang.settingsDeliveryPending || 'Pending';
  if (s === 'delivering') return lang.settingsDeliveryDelivering || 'Sending';
  if (s === 'delivered') return lang.settingsDeliveryDelivered || 'Delivered';
  if (s === 'dead') return lang.settingsDeliveryDead || 'Failed';
  return status || '';
}

function renderSettingsDeliveryHtml(stats, items) {
  stats = stats || {};
  items = items || [];
  var h = '';
  h += '<div class="settings-delivery-stats">';
  h += '<span class="settings-delivery-chip is-active"><strong>' + esc(String(stats.pending || 0)) + '</strong> '
    + esc(lang.settingsDeliveryPending || 'Pending') + '</span>';
  h += '<span class="settings-delivery-chip is-active"><strong>' + esc(String(stats.delivering || 0)) + '</strong> '
    + esc(lang.settingsDeliveryDelivering || 'Sending') + '</span>';
  h += '<span class="settings-delivery-chip"><strong>' + esc(String(stats.delivered || 0)) + '</strong> '
    + esc(lang.settingsDeliveryDelivered || 'Delivered') + '</span>';
  h += '<span class="settings-delivery-chip is-dead"><strong>' + esc(String(stats.dead || 0)) + '</strong> '
    + esc(lang.settingsDeliveryDead || 'Failed') + '</span>';
  h += '</div>';
  if (!items.length) {
    h += '<div class="settings-note">' + esc(lang.settingsDeliveryEmpty || 'No recent delivery tasks') + '</div>';
    return h;
  }
  h += '<div class="settings-delivery-list">';
  items.forEach(function (it) {
    var st = String(it.status || '').toLowerCase();
    // Cancel any non-delivered item (pending/delivering/dead). Delivered cannot be cancelled.
    var canCancel = st !== 'delivered' && !!it.id;
    var canRetry = st === 'dead';
    h += '<div class="settings-delivery-item" data-delivery-id="' + esc(String(it.id || '')) + '">';
    h += '<div class="settings-delivery-item-top">';
    h += '<div class="settings-delivery-item-meta">';
    h += '<strong>' + esc(it.activity_type || 'Activity') + '</strong>';
    if (it.target_domain) h += ' · ' + esc(it.target_domain);
    h += '<br/>' + esc(lang.settingsDelivery || 'Delivery') + ' #' + esc(String(it.id || ''));
    if (it.attempts != null) {
      h += ' · ' + esc(String(it.attempts)) + '/' + esc(String(it.max_attempts || '?'));
    }
    h += '</div>';
    h += '<span class="settings-delivery-badge ' + esc(st) + '">' + esc(deliveryStatusLabel(st)) + '</span>';
    h += '</div>';
    if (it.error_message) {
      h += '<div class="settings-delivery-item-err">' + esc(String(it.error_message).slice(0, 200)) + '</div>';
    }
    if (canCancel || canRetry) {
      h += '<div class="settings-delivery-item-actions">';
      if (canRetry) {
        h += '<button type="button" class="backup-btn backup-btn-sm" data-delivery-retry="' + esc(String(it.id)) + '">'
          + esc(lang.settingsDeliveryRetry || 'Retry') + '</button>';
      }
      if (canCancel) {
        h += '<button type="button" class="backup-btn backup-btn-sm backup-btn-danger" data-delivery-cancel="' + esc(String(it.id)) + '">'
          + esc(lang.settingsDeliveryCancel || 'Cancel') + '</button>';
      }
      h += '</div>';
    }
    h += '</div>';
  });
  h += '</div>';
  return h;
}

async function loadSettingsDeliveryPanel() {
  var body = $('settings-delivery-body');
  if (!body) return;
  if (!Tapp.federation || typeof Tapp.federation.getDeliveryStats !== 'function') {
    body.innerHTML = '<div class="settings-note">' + esc(lang.settingsDeliveryLoadFail || 'Unavailable') + '</div>';
    return;
  }
  body.innerHTML = '<div class="settings-note">' + esc(lang.feedLoading || 'Loading…') + '</div>';
  try {
    var statsRes = await Tapp.federation.getDeliveryStats();
    var listRes = typeof Tapp.federation.listDelivery === 'function'
      ? await Tapp.federation.listDelivery(40)
      : { items: [] };
    var stats = (statsRes && statsRes.data) || statsRes || {};
    var list = (listRes && listRes.data) || listRes || {};
    var items = list.items || list.deliveries || [];
    body.innerHTML = renderSettingsDeliveryHtml(stats, items);
  } catch (e) {
    console.error('[Aro] delivery panel', e);
    body.innerHTML = '<div class="settings-note settings-status-error">'
      + esc(lang.settingsDeliveryLoadFail || "Couldn't load delivery status") + '</div>';
  }
}

function settingsHeroHtml() {
  return '<div class="settings-hero">'
    + '<div class="settings-hero-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg></div>'
    + '<div class="settings-hero-text">'
    + '<h2 class="settings-hero-title">' + esc(lang.settingsTitle || 'Settings') + '</h2>'
    + '<p class="settings-hero-desc">' + esc(lang.settingsHint || lang.feedHintSettings || 'Posting defaults, privacy, and chat backup') + '</p>'
    + '</div></div>';
}

function settingsToggleRowHtml(id, label, hint, on) {
  return '<div class="settings-row">'
    + '<div class="settings-row-text">'
    + '<div class="settings-row-label">' + esc(label) + '</div>'
    + (hint ? '<p class="settings-row-hint">' + esc(hint) + '</p>' : '')
    + '</div>'
    + '<button type="button" class="settings-toggle" id="' + id + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + esc(label) + '">'
    + '<span class="settings-toggle-knob" aria-hidden="true"></span></button>'
    + '</div>';
}

function bindSettingsPageEvents(root) {
  root = root || document;
  root.querySelectorAll('input[name="aro-default-visibility"]').forEach(function (input) {
    input.addEventListener('change', function () {
      if (!input.checked) return;
      saveAroSettings({ defaultVisibility: input.value });
      root.querySelectorAll('input[name="aro-default-visibility"]').forEach(function (inp) {
        var lab = inp.closest('.settings-radio');
        if (lab) lab.classList.toggle('is-selected', !!inp.checked);
      });
    });
  });
  root.querySelectorAll('input[name="aro-who-can-message"]').forEach(function (input) {
    input.addEventListener('change', function () {
      if (!input.checked) return;
      saveAroSettings({ whoCanMessage: input.value });
      root.querySelectorAll('input[name="aro-who-can-message"]').forEach(function (inp) {
        var lab = inp.closest('.settings-radio');
        if (lab) lab.classList.toggle('is-selected', !!inp.checked);
      });
    });
  });
  var repostBtn = root.querySelector('#settings-show-reposts');
  if (repostBtn) {
    repostBtn.addEventListener('click', function () {
      var next = repostBtn.getAttribute('aria-checked') !== 'true';
      repostBtn.setAttribute('aria-checked', next ? 'true' : 'false');
      saveAroSettings({ showRepostsInHome: next });
    });
  }
  var e2eBtn = root.querySelector('#settings-auto-e2e');
  if (e2eBtn) {
    e2eBtn.addEventListener('click', function () {
      var next = e2eBtn.getAttribute('aria-checked') !== 'true';
      e2eBtn.setAttribute('aria-checked', next ? 'true' : 'false');
      saveAroSettings({ autoE2eOnOpen: next });
    });
  }
  var rotateKeysBtn = root.querySelector('#settings-keys-rotate');
  if (rotateKeysBtn) {
    rotateKeysBtn.addEventListener('click', async function () {
      if (!Tapp.federation || typeof Tapp.federation.rotateKeys !== 'function') {
        notifyError(
          lang.settingsKeysRotateFail || "Couldn't rotate keys",
          new Error('API unavailable — host needs federation.rotateKeys')
        );
        return;
      }
      try {
        if (typeof aroConfirm === 'function') {
          var okRotate = await aroConfirm(
            lang.settingsKeysRotateConfirm
              || 'Rotate your federation signing key? Peers must re-fetch your actor. Old signatures stay valid for past posts; new outbound mail uses the new key.',
            true
          );
          if (!okRotate) return;
        }
        rotateKeysBtn.disabled = true;
        var statusEl = root.querySelector('#settings-keys-status');
        if (statusEl) {
          statusEl.textContent = lang.settingsKeysRotating || 'Rotating keys…';
          statusEl.classList.remove('settings-status-error');
        }
        var rotRes = await Tapp.federation.rotateKeys(true);
        var rotData = (rotRes && rotRes.data) || rotRes || {};
        var kid = rotData.key_id || rotData.keyId || '';
        var queued = rotData.update_queued != null
          ? rotData.update_queued
          : (rotData.updateQueued != null ? rotData.updateQueued : 0);
        var okMsg = (lang.settingsKeysRotateOk || 'Keys rotated. Update fan-out queued: {n}')
          .replace('{n}', String(queued));
        if (kid) okMsg += ' · keyId ' + String(kid).slice(0, 64);
        if (statusEl) {
          statusEl.textContent = okMsg;
          statusEl.classList.remove('settings-status-error');
        }
        try {
          Tapp.ui.showNotification({
            title: lang.settingsKeysRotateOkTitle || 'Keys rotated',
            message: okMsg,
            type: 'success'
          });
        } catch (e0) {}
        // Refresh identity surface so handle/actor stay in sync after Update(Person).
        if (typeof loadFederationIdentity === 'function') {
          try { await loadFederationIdentity(); } catch (e1) {}
        }
      } catch (e) {
        console.error('[Aro] rotateKeys', e);
        var statusErr = root.querySelector('#settings-keys-status');
        if (statusErr) {
          statusErr.textContent = lang.settingsKeysRotateFail || "Couldn't rotate keys";
          statusErr.classList.add('settings-status-error');
        }
        notifyError(lang.settingsKeysRotateFail || "Couldn't rotate keys", e);
      } finally {
        rotateKeysBtn.disabled = false;
      }
    });
  }
  var refreshDel = root.querySelector('#settings-delivery-refresh');
  if (refreshDel) {
    refreshDel.addEventListener('click', function () { loadSettingsDeliveryPanel(); });
  }
  var cancelAll = root.querySelector('#settings-delivery-cancel-all');
  if (cancelAll) {
    cancelAll.addEventListener('click', async function () {
      if (!Tapp.federation || typeof Tapp.federation.cancelAllPendingDelivery !== 'function') {
        notifyError(lang.settingsDeliveryCancelFail || 'Cancel failed', new Error('API unavailable — rebuild host'));
        return;
      }
      try {
        if (typeof aroConfirm === 'function') {
          var ok = await aroConfirm(
            lang.settingsDeliveryCancelAllConfirm || 'Cancel all pending and in-progress deliveries?',
            true
          );
          if (!ok) return;
        }
        var res = await Tapp.federation.cancelAllPendingDelivery(100);
        var cancelled = 0;
        if (res) {
          cancelled = res.cancelled != null
            ? res.cancelled
            : (res.data && res.data.cancelled != null ? res.data.cancelled : 0);
        }
        try {
          Tapp.ui.showNotification({
            title: (lang.settingsDeliveryCancelAllOk || 'Cancelled {n} deliveries')
              .replace('{n}', String(cancelled)),
            type: 'success'
          });
        } catch (e0) {}
        loadSettingsDeliveryPanel();
      } catch (e) {
        console.error('[Aro] cancelAllPendingDelivery', e);
        notifyError(lang.settingsDeliveryCancelFail || 'Cancel failed', e);
      }
    });
  }
  var retryAll = root.querySelector('#settings-delivery-retry-all');
  if (retryAll) {
    retryAll.addEventListener('click', async function () {
      if (!Tapp.federation || typeof Tapp.federation.retryAllDeadDelivery !== 'function') {
        notifyError(lang.settingsDeliveryRetryFail || 'Retry failed', new Error('API unavailable'));
        return;
      }
      try {
        if (typeof aroConfirm === 'function') {
          var okRetry = await aroConfirm(
            lang.settingsDeliveryRetryAllConfirm || lang.deliveryRetryConfirm || 'Retry all failed federation deliveries?',
            false
          );
          if (!okRetry) return;
        }
        var retryRes = await Tapp.federation.retryAllDeadDelivery(50);
        var retried = 0;
        if (retryRes) {
          retried = retryRes.retried != null
            ? retryRes.retried
            : (retryRes.data && retryRes.data.retried != null ? retryRes.data.retried : 0);
        }
        try {
          Tapp.ui.showNotification({
            title: lang.deliveryRetryOk || 'Retry queued',
            message: (lang.deliveryRetryBody || '{n} messages re-queued').replace('{n}', String(retried)),
            type: 'success'
          });
        } catch (e0) {}
        loadSettingsDeliveryPanel();
      } catch (e) {
        notifyError(lang.settingsDeliveryRetryFail || 'Retry failed', e);
      }
    });
  }
  root.querySelectorAll('[data-delivery-retry]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var id = parseInt(btn.getAttribute('data-delivery-retry') || '0', 10);
      if (!id || typeof Tapp.federation.retryDelivery !== 'function') return;
      try {
        await Tapp.federation.retryDelivery(id);
        loadSettingsDeliveryPanel();
      } catch (e) {
        notifyError(lang.settingsDeliveryRetryFail || 'Retry failed', e);
      }
    });
  });
  // Event delegation for dynamic cancel/retry after refresh
  var delBody = root.querySelector('#settings-delivery-body');
  if (delBody && !delBody._aroDeliveryBound) {
    delBody._aroDeliveryBound = true;
    delBody.addEventListener('click', async function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var retryBtn = t.closest('[data-delivery-retry]');
      var cancelBtn = t.closest('[data-delivery-cancel]');
      if (retryBtn) {
        var rid = Number.parseInt(String(retryBtn.getAttribute('data-delivery-retry') || '0'), 10);
        if (!Number.isFinite(rid) || rid <= 0 || !Tapp.federation || typeof Tapp.federation.retryDelivery !== 'function') return;
        try {
          await Tapp.federation.retryDelivery(rid);
          loadSettingsDeliveryPanel();
        } catch (err) {
          notifyError(lang.settingsDeliveryRetryFail || 'Retry failed', err);
        }
        return;
      }
      if (cancelBtn) {
        var cidRaw = cancelBtn.getAttribute('data-delivery-cancel') || '0';
        var cid = Number.parseInt(String(cidRaw), 10);
        if (!Number.isFinite(cid) || cid <= 0) {
          notifyError(lang.settingsDeliveryCancelFail || 'Cancel failed', new Error('Invalid id'));
          return;
        }
        if (!Tapp.federation || typeof Tapp.federation.cancelDelivery !== 'function') {
          notifyError(lang.settingsDeliveryCancelFail || 'Cancel failed', new Error('API unavailable'));
          return;
        }
        try {
          await Tapp.federation.cancelDelivery(cid);
          try {
            Tapp.ui.showNotification({
              title: lang.settingsDeliveryCancelOk || 'Delivery cancelled',
              type: 'success'
            });
          } catch (e1) {}
          loadSettingsDeliveryPanel();
        } catch (err2) {
          console.error('[Aro] cancelDelivery', err2);
          notifyError(lang.settingsDeliveryCancelFail || 'Cancel failed', err2);
        }
      }
    });
  }
}

function backupHeroHtml() {
  return '<div class="backup-hero">'
    + '<div class="backup-hero-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg></div>'
    + '<div class="backup-hero-text">'
    + '<h2 class="backup-hero-title">' + esc(lang.backupTitle || 'Chat backup') + '</h2>'
    + '<p class="backup-hero-desc">' + esc(lang.backupHint || lang.feedHintBackup || 'Export and import your messenger history') + '</p>'
    + '</div></div>';
}

function backupBackBtnHtml(id) {
  return '<button type="button" class="backup-btn backup-btn-ghost" id="' + id + '">'
    + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'
    + '<span>' + esc(lang.back || 'Back') + '</span></button>';
}

function renderImportedArchiveView(entry) {
  var archive = entry.archive || {};
  var convs = archive.conversations || [];
  var html = '<div class="backup-page">';
  html += '<div class="backup-toolbar">';
  html += backupBackBtnHtml('backup-back-root');
  html += '<div class="backup-toolbar-title">' + esc(entry.source_name || lang.backupImportedTitle || 'Archive') + '</div>';
  html += '</div>';
  html += '<div class="backup-card">';
  if (!convs.length) {
    html += '<div class="backup-empty">'
      + '<div class="aro-empty-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>'
      + '<div>' + esc(lang.historyEmpty || 'No messages') + '</div></div>';
  } else {
    html += '<div class="backup-archive-list">';
    convs.forEach(function (c, idx) {
      var key = backupConversationKey(c, idx);
      var count = (c.messages && c.messages.length) || c.message_count || 0;
      var isRoom = c.kind === 'room';
      var kindLabel = isRoom ? (lang.newRoom || 'Room') : (lang.dm || 'DM');
      var iconCls = isRoom ? 'backup-archive-icon-room' : 'backup-archive-icon-dm';
      var icon = isRoom ? (SVG_ICONS.room || '') : (SVG_ICONS.channel || '');
      html += '<button type="button" class="backup-archive-item backup-archive-link" data-open-conv="' + esc(key) + '">'
        + '<div class="backup-archive-icon ' + iconCls + '">' + icon + '</div>'
        + '<div class="backup-archive-info">'
        + '<div class="backup-archive-name">' + esc(c.name || c.id || key) + '</div>'
        + '<div class="backup-archive-meta">' + esc(kindLabel + ' · ' + (lang.backupExportCount || '{n} messages').replace('{n}', String(count))) + '</div>'
        + '</div>'
        + '<span class="backup-chevron">' + (SVG_ICONS.chevronRight || '›') + '</span>'
        + '</button>';
    });
    html += '</div>';
  }
  html += '</div></div>';
  return html;
}

function renderImportedConversationView(entry, convKey) {
  var archive = entry.archive || {};
  var convs = archive.conversations || [];
  var conv = null;
  for (var i = 0; i < convs.length; i++) {
    if (backupConversationKey(convs[i], i) === convKey) { conv = convs[i]; break; }
  }
  var h = ensureHistoryState();
  var q = h.browseQuery || '';
  var msgs = (conv && conv.messages) || [];
  var filtered = filterHistoryMessages(msgs, q, 'all');
  var view = filtered.slice().reverse();

  var html = '<div class="backup-page">';
  html += '<div class="backup-toolbar">';
  html += backupBackBtnHtml('backup-back-archive');
  html += '<div class="backup-toolbar-title">' + esc((conv && conv.name) || convKey) + '</div>';
  html += '</div>';
  html += '<div class="aro-search-bar history-search-bar" style="padding:0 0 10px;border:none">';
  html += '<span class="aro-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></span>';
  html += '<input id="backup-browse-search" class="aro-search-input" type="search" autocomplete="off" placeholder="' + esc(lang.historySearchPlaceholder || 'Search…') + '" value="' + esc(q) + '" />';
  html += '</div>';
  html += '<div class="backup-card backup-card-flat">';
  html += '<div class="backup-browse-meta">' + esc((lang.historyMatchCount || '{n} / {total}')
    .replace('{n}', String(filtered.length))
    .replace('{total}', String(msgs.length))) + '</div>';
  if (!view.length) {
    html += historyEmptyHtml(
      q ? (lang.searchNoResults || 'No matches') : (lang.historyEmpty || 'No messages'),
      ''
    );
  } else {
    html += '<div class="history-list backup-history-list">';
    view.forEach(function (msg) {
      var time = typeof timeStr === 'function' ? timeStr(msg.created_at) : (msg.created_at || '');
      var sender = (msg.sender_actor || '').split('/').pop() || '?';
      var kind = classifyHistoryMessage(msg);
      var kindClass = kind !== 'text' ? (' history-item-kind-' + kind) : '';
      html += '<div class="history-item history-item-static">'
        + '<div class="history-item-avatar">' + esc((sender || '?').charAt(0).toUpperCase()) + '</div>'
        + '<div class="history-item-body">'
        + '<div class="history-item-top">'
        + '<span class="history-item-name">' + esc(sender) + '</span>'
        + (kind !== 'text' ? '<span class="history-item-kind' + kindClass + '">' + esc(historyKindLabel(kind)) + '</span>' : '')
        + (time ? '<span class="history-item-time">' + esc(time) + '</span>' : '')
        + '</div>'
        + '<div class="history-item-text">' + esc(historyPreviewText(msg)) + '</div>'
        + '</div></div>';
    });
    html += '</div>';
  }
  html += '</div></div>';
  return html;
}

function bindBackupPageEvents(root) {
  root = root || document;
  var exportAll = root.querySelector('#backup-export-all') || $('backup-export-all');
  if (exportAll) {
    exportAll.addEventListener('click', function () {
      var includeMedia = !!( $('backup-include-media') && $('backup-include-media').checked );
      exportAllConversationsArchive({ includeMedia: includeMedia });
    });
  }
  var exportActive = root.querySelector('#backup-export-active') || $('backup-export-active');
  if (exportActive) {
    exportActive.addEventListener('click', function () {
      var includeMedia = !!( $('backup-include-media') && $('backup-include-media').checked );
      exportActiveConversationArchive({ includeMedia: includeMedia });
    });
  }
  var importBtn = root.querySelector('#backup-import-btn') || $('backup-import-btn');
  var importInput = root.querySelector('#backup-import-input') || $('backup-import-input');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', function () { importInput.click(); });
    importInput.addEventListener('change', function () {
      var file = importInput.files && importInput.files[0];
      importInput.value = '';
      if (file) importChatArchiveFromFile(file);
    });
  }
  root.querySelectorAll('[data-open-archive]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openImportedArchiveBrowser(btn.getAttribute('data-open-archive'));
    });
  });
  root.querySelectorAll('[data-del-archive]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var id = btn.getAttribute('data-del-archive');
      try {
        await deleteImportedArchive(id);
        try { Tapp.ui.showNotification({ title: lang.backupDeleted || lang.remove || 'Removed', type: 'success' }); } catch (e0) {}
      } catch (e) {
        notifyError(lang.backupImportFail || 'Failed', e);
      }
    });
  });
  var backRoot = root.querySelector('#backup-back-root');
  if (backRoot) {
    backRoot.addEventListener('click', function () {
      ensureHistoryState().browseArchiveId = null;
      ensureHistoryState().browseConversationId = null;
      refreshSettingsOrBackupPage();
    });
  }
  var backArch = root.querySelector('#backup-back-archive');
  if (backArch) {
    backArch.addEventListener('click', function () {
      ensureHistoryState().browseConversationId = null;
      refreshSettingsOrBackupPage();
    });
  }
  root.querySelectorAll('[data-open-conv]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openImportedArchiveBrowser(ensureHistoryState().browseArchiveId, btn.getAttribute('data-open-conv'));
    });
  });
  var browseSearch = root.querySelector('#backup-browse-search');
  if (browseSearch) {
    browseSearch.addEventListener('input', function () {
      ensureHistoryState().browseQuery = browseSearch.value || '';
      refreshSettingsOrBackupPage();
    });
  }
}

// historyHeaderButtonHtml / wireHistoryHeaderButton live in chat.js (global).

// Reset history when leaving a conversation
function resetHistoryOnConversationChange() {
  ensureHistoryState();
  if (state.history.open) closeChatHistory();
  state.history.messages = [];
  state.history.query = '';
  state.history.filter = 'all';
  state.history.hasMore = false;
  state.history.error = null;
  state.history.kind = null;
  state.history.id = null;
}
