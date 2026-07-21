// ==================== Room files (group attachment library) ====================
// Phase 1: prefer GET rooms/{id}/files (server index over messages + transfers).
// Fallback: client aggregate of state.messages + listRoomTransfers.
// Bytes live on the sender instance (transfer disk or message payload.data).

var ROOM_FILES_PAGE_LIMIT = 50;

function ensureRoomFilesState() {
  if (!state.roomFiles) {
    state.roomFiles = {
      open: false,
      roomId: null,
      items: [],
      query: '',
      filter: 'all',
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: null,
      oldestMessageId: null,
      source: 'client', // 'server' | 'client'
      searchTimer: null,
    };
  }
  return state.roomFiles;
}

// roomFilesHeaderButtonHtml / wireRoomFilesHeaderButton live in chat.js (global).

function applyRoomFilesLabels() {
  var el;
  el = $('room-files-title');
  if (el) el.textContent = lang.roomFilesTitle || 'Group files';
  el = $('room-files-close');
  if (el) el.setAttribute('aria-label', lang.close || lang.dismiss || 'Close');
  applySearchInputLabel('room-files-search', lang.roomFilesSearch || lang.pickerSearchPlaceholder || 'Search…');
  el = $('room-files-load-more');
  if (el) el.textContent = lang.roomFilesLoadMore || lang.historyLoadMore || 'Load more';
  el = $('room-files-hint');
  if (el) el.textContent = lang.roomFilesHint || '';
  var map = {
    all: lang.roomFilesFilterAll || lang.historyFilterAll || 'All',
    image: lang.roomFilesFilterImage || lang.historyFilterImage || 'Images',
    file: lang.roomFilesFilterFile || lang.historyFilterFile || 'Files',
  };
  document.querySelectorAll('[data-room-files-filter]').forEach(function (btn) {
    var k = btn.getAttribute('data-room-files-filter');
    if (map[k]) btn.textContent = map[k];
  });
}

function syncRoomFilesFilterChips() {
  var rf = ensureRoomFilesState();
  document.querySelectorAll('[data-room-files-filter]').forEach(function (btn) {
    var active = btn.getAttribute('data-room-files-filter') === rf.filter;
    btn.classList.toggle('history-filter-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function isRoomFilesOpen() {
  var overlay = $('room-files-overlay');
  return !!(overlay && overlay.style.display !== 'none' && !overlay.hidden);
}

function closeRoomFiles() {
  var rf = ensureRoomFilesState();
  rf.open = false;
  if (rf.searchTimer) {
    try { clearTimeout(rf.searchTimer); } catch (e) { /* ignore */ }
    rf.searchTimer = null;
  }
  var overlay = $('room-files-overlay');
  if (!overlay || overlay.style.display === 'none') return;
  overlay.classList.remove('aro-history-enter');
  if (typeof aroDismiss === 'function') {
    aroDismiss(overlay, {
      ms: 160,
      onDone: function () { overlay.hidden = true; },
    });
  } else {
    overlay.style.display = 'none';
    overlay.hidden = true;
  }
}

function resetRoomFilesOnConversationChange() {
  var rf = ensureRoomFilesState();
  if (rf.open) closeRoomFiles();
  rf.roomId = null;
  rf.items = [];
  rf.query = '';
  rf.filter = 'all';
  rf.hasMore = false;
  rf.error = null;
  rf.oldestMessageId = null;
  rf.loading = false;
  rf.loadingMore = false;
  rf.source = 'client';
}

/** Classify message as room-files kind: image | file | null */
function roomFileKindFromMessage(msg) {
  if (!msg) return null;
  var payload = (typeof msg.payload === 'object' && msg.payload) ? msg.payload : {};
  var mt = msg.message_type || 'text';
  if (mt === 'text' || !mt) {
    if (payload.transfer_id && payload.filename) mt = 'file-meta';
    else if (payload.data && payload.mime_type && String(payload.mime_type).indexOf('image/') === 0) mt = 'image';
    else if (payload.data && payload.filename) mt = 'file';
  }
  if (mt === 'image') return 'image';
  if (mt === 'file' || mt === 'file-meta') return 'file';
  return null;
}

function roomFileSenderLabel(actorOrMsg) {
  var actor = '';
  if (typeof actorOrMsg === 'string') actor = actorOrMsg;
  else if (actorOrMsg) actor = actorOrMsg.sender_actor || '';
  if (!actor) return '—';
  if (typeof isLocalActor === 'function' && isLocalActor(actor)) {
    return lang.me || lang.local || 'Me';
  }
  if (typeof findMemberByActor === 'function') {
    var m = findMemberByActor(actor);
    if (m && m.display_name) return m.display_name;
  }
  return actor.split('/').pop() || '?';
}

/**
 * Status for list UI + download affordance.
 * transfer_id without local list entry still counts as ready (same as message card).
 */
function roomFileStatusFromParts(hasInline, transferStatus, hasTransferId) {
  if (hasInline) return 'ready';
  if (transferStatus === 'completed') return 'ready';
  if (transferStatus === 'pending' || transferStatus === 'in-progress' || transferStatus === 'transferring') {
    return 'pending';
  }
  if (transferStatus === 'failed' || transferStatus === 'cancelled') return 'missing';
  if (hasTransferId) return 'ready';
  return 'missing';
}

function roomFileStatusLabel(status) {
  if (status === 'ready') return lang.roomFilesStatusReady || 'Ready';
  if (status === 'pending') return lang.roomFilesStatusPending || 'Uploading…';
  return lang.roomFilesStatusMissing || 'Unavailable';
}

function roomFileExtBadge(filename, kind) {
  var name = String(filename || '');
  var ext = '';
  var dot = name.lastIndexOf('.');
  if (dot > 0 && dot < name.length - 1) {
    ext = name.slice(dot + 1).toUpperCase();
    if (ext.length > 5) ext = ext.slice(0, 4) + '…';
  }
  if (!ext) ext = kind === 'image' ? 'IMG' : 'FILE';
  return ext;
}

/**
 * Build list items from messages (attachments only).
 * transferMap: transfer_id -> { status, filename, file_size, mime_type }
 */
function buildRoomFileItemsFromMessages(messages, transferMap) {
  transferMap = transferMap || {};
  var items = [];
  (messages || []).forEach(function (msg) {
    var kind = roomFileKindFromMessage(msg);
    if (!kind) return;
    var payload = (typeof msg.payload === 'object' && msg.payload) ? msg.payload : {};
    var transferId = payload.transfer_id || '';
    var tr = transferId ? transferMap[transferId] : null;
    var hasInline = !!(payload.data);
    var status = roomFileStatusFromParts(hasInline, tr && tr.status, !!transferId);
    var filename = payload.filename || (tr && tr.filename) || (kind === 'image' ? 'image' : 'file');
    var size = payload.size || (tr && tr.file_size) || 0;
    var mime = payload.mime_type || (tr && tr.mime_type) || '';
    var dlPayload = payload;
    if (!hasInline && transferId && (!payload.transfer_id || !payload.filename)) {
      dlPayload = {
        transfer_id: transferId,
        filename: filename,
        size: size,
        mime_type: mime,
      };
    }
    items.push({
      key: (msg.message_id || '') + ':' + (transferId || filename),
      message_id: msg.message_id || '',
      kind: kind,
      filename: filename,
      size: size,
      mime: mime,
      sender: roomFileSenderLabel(msg),
      sender_actor: msg.sender_actor || '',
      created_at: msg.created_at || '',
      transfer_id: transferId,
      has_inline: hasInline,
      status: status,
      payload: dlPayload,
    });
  });
  return items;
}

/** Merge transfer-only rows that have no message yet (rare race). */
function mergeOrphanTransfers(items, transfers, knownIds) {
  knownIds = knownIds || {};
  (transfers || []).forEach(function (tr) {
    var id = tr.transfer_id || tr.id;
    if (!id || knownIds[id]) return;
    if (tr.status !== 'completed' && tr.status !== 'pending' && tr.status !== 'in-progress' && tr.status !== 'transferring') {
      return;
    }
    items.push({
      key: 'tr:' + id,
      message_id: '',
      kind: 'file',
      filename: tr.filename || 'file',
      size: tr.file_size || 0,
      mime: tr.mime_type || '',
      sender: '—',
      sender_actor: '',
      created_at: tr.created_at || '',
      transfer_id: id,
      has_inline: false,
      status: roomFileStatusFromParts(false, tr.status, true),
      payload: { transfer_id: id, filename: tr.filename, size: tr.file_size, mime_type: tr.mime_type },
    });
  });
  return items;
}

function sortRoomFileItemsNewestFirst(items) {
  items.sort(function (a, b) {
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
  return items;
}

function filterRoomFileItems(items, query, filter) {
  var q = normalizeSearchQuery(query);
  var f = filter || 'all';
  return (items || []).filter(function (it) {
    if (f === 'image' && it.kind !== 'image') return false;
    if (f === 'file' && it.kind !== 'file') return false;
    if (!q) return true;
    return matchesSearch(q, [it.filename, it.sender, it.mime, it.transfer_id, it.kind]);
  });
}

function unwrapTransfersResponse(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.transfers)) return res.transfers;
  if (res.data && Array.isArray(res.data.transfers)) return res.data.transfers;
  return [];
}


function unwrapRoomFilesResponse(res) {
  if (!res) return { files: [], hasMore: false, total: 0 };
  var root = res;
  if (res.data && (Array.isArray(res.data.files) || Array.isArray(res.data))) {
    root = res.data;
  }
  var files = Array.isArray(root.files) ? root.files : (Array.isArray(root) ? root : []);
  return {
    files: files,
    hasMore: !!root.has_more,
    total: typeof root.total === 'number' ? root.total : files.length,
  };
}

function mapServerRoomFileItem(raw) {
  if (!raw) return null;
  var kind = raw.kind === 'image' ? 'image' : 'file';
  var transferId = raw.transfer_id || '';
  var hasInline = !!raw.has_inline;
  var status = raw.status || roomFileStatusFromParts(hasInline, null, !!transferId);
  var filename = raw.filename || (kind === 'image' ? 'image' : 'file');
  var size = raw.size || 0;
  var mime = raw.mime_type || raw.mime || '';
  return {
    key: raw.key || ((raw.message_id || '') + ':' + (transferId || filename)),
    message_id: raw.message_id || '',
    kind: kind,
    filename: filename,
    size: size,
    mime: mime,
    sender: roomFileSenderLabel(raw.sender_actor || ''),
    sender_actor: raw.sender_actor || '',
    created_at: raw.created_at || '',
    transfer_id: transferId,
    has_inline: hasInline,
    status: status,
    payload: transferId
      ? { transfer_id: transferId, filename: filename, size: size, mime_type: mime }
      : null,
  };
}

async function fetchRoomTransfersMap(roomId) {
  var map = {};
  if (!roomId || typeof Tapp === 'undefined' || !Tapp.federation) return map;
  if (typeof Tapp.federation.listRoomTransfers !== 'function') return map;
  try {
    var res = await Tapp.federation.listRoomTransfers(roomId);
    unwrapTransfersResponse(res).forEach(function (tr) {
      var id = tr.transfer_id || tr.id;
      if (id) map[id] = tr;
    });
  } catch (e) {
    console.warn('[Aro] listRoomTransfers failed', e);
  }
  return map;
}

function rebuildRoomFilesFromStateMessages(transferMap) {
  var rf = ensureRoomFilesState();
  var items = buildRoomFileItemsFromMessages(state.messages || [], transferMap);
  var known = {};
  items.forEach(function (it) { if (it.transfer_id) known[it.transfer_id] = true; });
  var transfers = Object.keys(transferMap).map(function (k) { return transferMap[k]; });
  mergeOrphanTransfers(items, transfers, known);
  sortRoomFileItemsNewestFirst(items);
  rf.items = items;
  rf.source = 'client';
  if ((state.messages || []).length) {
    rf.oldestMessageId = state.messages[0].message_id || null;
    rf.hasMore = state.messages.length >= 100;
  } else {
    rf.oldestMessageId = null;
    rf.hasMore = false;
  }
}

function supportsListRoomFiles() {
  return typeof Tapp !== 'undefined'
    && Tapp.federation
    && typeof Tapp.federation.listRoomFiles === 'function';
}

async function fetchRoomFilesPage(roomId, opts) {
  opts = opts || {};
  var res = await Tapp.federation.listRoomFiles(roomId, {
    before: opts.before || undefined,
    limit: opts.limit || ROOM_FILES_PAGE_LIMIT,
    filter: opts.filter && opts.filter !== 'all' ? opts.filter : undefined,
    q: opts.q || undefined,
  });
  var unwrapped = unwrapRoomFilesResponse(res);
  var items = [];
  unwrapped.files.forEach(function (raw) {
    var it = mapServerRoomFileItem(raw);
    if (it) items.push(it);
  });
  return {
    items: items,
    hasMore: unwrapped.hasMore,
    total: unwrapped.total,
  };
}

async function openRoomFiles() {
  ensureRoomFilesState();
  if (state.activeKind !== 'room' || !state.activeId) {
    try {
      Tapp.ui.showNotification({
        title: lang.roomFilesOnlyRoom || lang.roomFilesTitle || 'Group files',
        type: 'error',
      });
    } catch (e0) { /* ignore */ }
    return;
  }
  if (typeof closeChatHistory === 'function' && typeof isChatHistoryOpen === 'function' && isChatHistoryOpen()) {
    closeChatHistory();
  }

  var rf = state.roomFiles;
  rf.open = true;
  rf.roomId = state.activeId;
  rf.error = null;
  rf.loading = true;
  rf.items = [];
  rf.hasMore = false;
  rf.oldestMessageId = null;

  var overlay = $('room-files-overlay');
  if (!overlay) return;
  overlay.hidden = false;
  overlay.style.pointerEvents = 'auto';
  overlay.style.display = 'flex';
  overlay.classList.remove('aro-leaving', 'aro-history-enter');
  try { void overlay.offsetWidth; } catch (eAnim) { /* ignore */ }
  if (!(typeof prefersReducedMotion === 'function' && prefersReducedMotion())) {
    overlay.classList.add('aro-history-enter');
    var clearEnter = function () {
      overlay.classList.remove('aro-history-enter');
      overlay.removeEventListener('animationend', clearEnter);
    };
    overlay.addEventListener('animationend', clearEnter);
    setTimeout(clearEnter, 360);
  }

  applyRoomFilesLabels();
  var sub = $('room-files-subtitle');
  if (sub) {
    sub.textContent = (state.roomDetail && state.roomDetail.name)
      || lang.roomFilesTitle
      || 'Group files';
  }
  var search = $('room-files-search');
  if (search) search.value = rf.query || '';
  syncRoomFilesFilterChips();
  renderRoomFilesList();

  try {
    await loadRoomFilesFirstPage();
  } catch (e) {
    rf.error = (typeof getErrorMessage === 'function' ? getErrorMessage(e) : '') || lang.roomFilesLoading || 'Load failed';
  } finally {
    rf.loading = false;
    renderRoomFilesList();
  }

  if (search) {
    try { search.focus(); } catch (eF) { /* ignore */ }
  }
}

async function loadRoomFilesFirstPage() {
  var rf = ensureRoomFilesState();
  if (!rf.roomId) return;

  if (supportsListRoomFiles()) {
    try {
      var page = await fetchRoomFilesPage(rf.roomId, {
        filter: rf.filter,
        q: normalizeSearchQuery(rf.query) || undefined,
        limit: ROOM_FILES_PAGE_LIMIT,
      });
      rf.items = page.items;
      rf.hasMore = page.hasMore;
      rf.source = 'server';
      rf.oldestMessageId = oldestMessageIdFromItems(page.items);
      return;
    } catch (e) {
      console.warn('[Aro] listRoomFiles failed, falling back to client scan', e);
    }
  }

  // Phase 0 fallback
  var transferMap = await fetchRoomTransfersMap(rf.roomId);
  rebuildRoomFilesFromStateMessages(transferMap);
}

function oldestMessageIdFromItems(items) {
  var oldest = null;
  var oldestTs = '';
  (items || []).forEach(function (it) {
    if (!it.message_id) return;
    var ts = it.created_at || '';
    if (!oldest || String(ts).localeCompare(String(oldestTs)) < 0) {
      oldest = it.message_id;
      oldestTs = ts;
    }
  });
  return oldest;
}

async function loadMoreRoomFiles() {
  var rf = ensureRoomFilesState();
  if (!rf.open || !rf.roomId || rf.loadingMore || !rf.hasMore) return;
  rf.loadingMore = true;
  rf.error = null;
  updateRoomFilesFooter();
  try {
    if (rf.source === 'server' && supportsListRoomFiles()) {
      var before = rf.oldestMessageId || undefined;
      var page = await fetchRoomFilesPage(rf.roomId, {
        before: before,
        filter: rf.filter,
        q: normalizeSearchQuery(rf.query) || undefined,
        limit: ROOM_FILES_PAGE_LIMIT,
      });
      if (!page.items.length) {
        rf.hasMore = false;
      } else {
        var seen = {};
        rf.items.forEach(function (it) { seen[it.key] = true; });
        page.items.forEach(function (it) {
          if (!seen[it.key]) rf.items.push(it);
        });
        rf.hasMore = page.hasMore;
        var nextOldest = oldestMessageIdFromItems(page.items);
        if (nextOldest) rf.oldestMessageId = nextOldest;
      }
    } else {
      // Client: page older room messages into live window
      if (typeof Tapp === 'undefined' || !Tapp.federation || typeof Tapp.federation.getRoomMessages !== 'function') {
        rf.hasMore = false;
        return;
      }
      var beforeMsg = rf.oldestMessageId || undefined;
      var res = await Tapp.federation.getRoomMessages(rf.roomId, beforeMsg, 100);
      var batch = unwrapMessagesResponse(res);
      if (!batch.length) {
        rf.hasMore = false;
      } else {
        if (state.activeKind === 'room' && state.activeId === rf.roomId) {
          var existing = {};
          (state.messages || []).forEach(function (m) {
            if (m.message_id) existing[m.message_id] = true;
          });
          var older = [];
          batch.forEach(function (m) {
            if (m.message_id && !existing[m.message_id]) older.push(m);
          });
          if (older.length && typeof mergeMessageListsAsc === 'function') {
            state.messages = mergeMessageListsAsc(state.messages || [], older);
            if (typeof messagesFingerprint === 'function') {
              state.messagesFp = messagesFingerprint(state.messages);
            }
            state.skipMsgAppear = true;
            if (typeof renderMessages === 'function') renderMessages();
          } else if (older.length) {
            state.messages = older.concat(state.messages || []);
          }
          rf.oldestMessageId = state.messages.length ? state.messages[0].message_id : rf.oldestMessageId;
        } else {
          rf.oldestMessageId = batch[0].message_id || rf.oldestMessageId;
        }
        rf.hasMore = batch.length >= 100;
        var transferMap = await fetchRoomTransfersMap(rf.roomId);
        rebuildRoomFilesFromStateMessages(transferMap);
      }
    }
  } catch (e) {
    rf.error = (typeof getErrorMessage === 'function' ? getErrorMessage(e) : '') || lang.loadFail || 'Load failed';
    console.error('[Aro] loadMoreRoomFiles', e);
  } finally {
    rf.loadingMore = false;
    renderRoomFilesList();
  }
}

async function refreshRoomFilesFromServer() {
  var rf = ensureRoomFilesState();
  if (!rf.open || !rf.roomId || rf.loading || rf.loadingMore) return;
  rf.loading = true;
  rf.error = null;
  updateRoomFilesFooter();
  try {
    await loadRoomFilesFirstPage();
  } catch (e) {
    rf.error = (typeof getErrorMessage === 'function' ? getErrorMessage(e) : '') || lang.loadFail || 'Load failed';
  } finally {
    rf.loading = false;
    renderRoomFilesList();
  }
}

function scheduleRoomFilesSearchRefresh() {
  var rf = ensureRoomFilesState();
  if (rf.searchTimer) {
    try { clearTimeout(rf.searchTimer); } catch (e) { /* ignore */ }
  }
  // Server search when using index; client filter is instant (no debounce needed for client-only)
  if (rf.source === 'server' || supportsListRoomFiles()) {
    rf.searchTimer = setTimeout(function () {
      rf.searchTimer = null;
      if (!rf.open) return;
      refreshRoomFilesFromServer();
    }, 280);
  } else {
    renderRoomFilesList();
  }
}

function updateRoomFilesFooter() {
  var rf = ensureRoomFilesState();
  var meta = $('room-files-meta');
  var loadBtn = $('room-files-load-more');
  var displayItems = rf.source === 'server'
    ? (rf.items || [])
    : filterRoomFileItems(rf.items, rf.query, rf.filter);
  if (meta) {
    meta.classList.toggle('history-meta-error', !!rf.error && !rf.loadingMore && !rf.loading);
    if (rf.loadingMore || rf.loading) {
      meta.textContent = lang.roomFilesLoading || lang.pickerLoading || 'Loading…';
    } else if (rf.error) {
      meta.textContent = rf.error;
    } else {
      var q = normalizeSearchQuery(rf.query);
      var total = (rf.items || []).length;
      if (rf.source === 'client' && (q || (rf.filter && rf.filter !== 'all'))) {
        meta.textContent = (lang.roomFilesMatchCount || lang.historyMatchCount || '{n} / {total}')
          .replace('{n}', String(displayItems.length))
          .replace('{total}', String(total));
      } else {
        meta.textContent = (lang.roomFilesCount || '{n} items').replace('{n}', String(displayItems.length));
      }
    }
  }
  if (loadBtn) {
    loadBtn.hidden = !rf.hasMore;
    loadBtn.disabled = !!rf.loadingMore || !!rf.loading;
    loadBtn.textContent = rf.loadingMore
      ? (lang.roomFilesLoading || 'Loading…')
      : (lang.roomFilesLoadMore || 'Load more');
  }
}

function roomFileCanDownload(item) {
  if (!item || item.status === 'pending' || item.status === 'missing') return false;
  if (item.transfer_id) return true;
  if (item.has_inline) {
    // Need live payload.data or will jump-to-chat instead
    if (item.payload && item.payload.data) return true;
    if (item.message_id && state.messages) {
      for (var i = 0; i < state.messages.length; i++) {
        if (state.messages[i].message_id === item.message_id
          && state.messages[i].payload
          && state.messages[i].payload.data) {
          return true;
        }
      }
    }
  }
  return false;
}

function roomFileResolvePayload(item) {
  if (!item) return null;
  if (item.message_id && state.messages) {
    for (var j = 0; j < state.messages.length; j++) {
      if (state.messages[j].message_id === item.message_id && state.messages[j].payload) {
        return state.messages[j].payload;
      }
    }
  }
  if (item.payload) return item.payload;
  if (item.transfer_id) {
    return {
      transfer_id: item.transfer_id,
      filename: item.filename,
      size: item.size,
      mime_type: item.mime,
    };
  }
  return null;
}

function renderRoomFilesList() {
  var list = $('room-files-list');
  if (!list) return;
  var rf = ensureRoomFilesState();
  var filtered = rf.source === 'server'
    ? (rf.items || [])
    : filterRoomFileItems(rf.items, rf.query, rf.filter);

  if (rf.loading && !rf.items.length) {
    list.innerHTML = '<div class="room-files-skeleton" aria-hidden="true">'
      + '<div class="room-files-skel-row"></div>'
      + '<div class="room-files-skel-row"></div>'
      + '<div class="room-files-skel-row"></div>'
      + '</div>';
    updateRoomFilesFooter();
    return;
  }
  if (!rf.items.length) {
    list.innerHTML = typeof historyEmptyHtml === 'function'
      ? historyEmptyHtml(lang.roomFilesEmpty || 'No files yet', lang.roomFilesEmptyHint || '')
      : '<div class="history-empty">' + esc(lang.roomFilesEmpty || 'No files') + '</div>';
    updateRoomFilesFooter();
    return;
  }
  if (!filtered.length) {
    list.innerHTML = typeof historyEmptyHtml === 'function'
      ? historyEmptyHtml(lang.searchNoResults || 'No matches', '')
      : '<div class="history-empty">' + esc(lang.searchNoResults || 'No matches') + '</div>';
    updateRoomFilesFooter();
    return;
  }

  var html = '';
  var lastDay = '';
  filtered.forEach(function (it) {
    var day = '';
    try {
      var d = new Date(it.created_at);
      if (!isNaN(d)) day = d.toDateString();
    } catch (e) { day = ''; }
    if (day && day !== lastDay) {
      lastDay = day;
      html += '<div class="history-day"><span>'
        + esc(typeof dayLabel === 'function' ? dayLabel(it.created_at) : day)
        + '</span></div>';
    }
    var time = typeof timeStr === 'function' ? timeStr(it.created_at) : '';
    var sizeLabel = it.size && typeof formatFileSize === 'function' ? formatFileSize(it.size) : (it.size ? String(it.size) : '');
    var statusClass = 'room-file-status room-file-status-' + (it.status || 'missing');
    var canDl = roomFileCanDownload(it);
    var canJump = !!it.message_id;
    var badge = roomFileExtBadge(it.filename, it.kind);
    var kindClass = it.kind === 'image' ? 'room-file-tile-image' : 'room-file-tile-file';
    var metaBits = [it.sender, sizeLabel].filter(Boolean).join(' · ');

    html += '<div class="history-item history-item-static room-file-item" data-file-key="' + esc(it.key) + '">'
      + '<div class="room-file-tile ' + kindClass + '" aria-hidden="true">'
      + '<span class="room-file-tile-ext">' + esc(badge) + '</span>'
      + (it.kind === 'image'
        ? '<svg class="room-file-tile-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
        : '<svg class="room-file-tile-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>')
      + '</div>'
      + '<div class="history-item-body room-file-body">'
      + '<div class="history-item-top room-file-top">'
      + '<span class="history-item-name room-file-name" title="' + esc(it.filename) + '">' + esc(it.filename) + '</span>'
      + '<span class="' + statusClass + '">' + esc(roomFileStatusLabel(it.status)) + '</span>'
      + (time ? '<span class="history-item-time">' + esc(time) + '</span>' : '')
      + '</div>'
      + (metaBits
        ? '<div class="history-item-text room-file-meta-line">' + esc(metaBits) + '</div>'
        : '')
      + '<div class="room-file-actions">'
      + (canDl
        ? '<button type="button" class="room-file-action-btn room-file-action-primary room-file-dl" data-file-key="' + esc(it.key) + '">'
          + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M5 21h14"/></svg>'
          + '<span>' + esc(lang.roomFilesDownload || lang.downloadFile || 'Download') + '</span></button>'
        : '')
      + (canJump
        ? '<button type="button" class="room-file-action-btn '
          + (canDl ? 'room-file-action-ghost' : 'room-file-action-primary')
          + ' room-file-jump" data-msg-id="' + esc(it.message_id) + '">'
          + (canDl
            ? ''
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>')
          + '<span>' + esc(canDl
            ? (lang.roomFilesJump || 'Show in chat')
            : (lang.roomFilesOpenInChat || lang.roomFilesJump || 'Open in chat'))
          + '</span></button>'
        : '')
      + '</div>'
      + '</div></div>';
  });
  list.innerHTML = html;

  list.querySelectorAll('.room-file-dl').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var key = btn.getAttribute('data-file-key');
      var item = null;
      for (var i = 0; i < rf.items.length; i++) {
        if (rf.items[i].key === key) { item = rf.items[i]; break; }
      }
      if (!item || typeof downloadMessageFile !== 'function') return;
      var payload = roomFileResolvePayload(item);
      if (!payload || (!payload.data && !payload.transfer_id)) {
        try {
          Tapp.ui.showNotification({
            title: lang.roomFilesNeedChat || lang.roomFilesJump || 'Open in chat to download',
            type: 'info',
          });
        } catch (eN) { /* ignore */ }
        if (item.message_id) {
          closeRoomFiles();
          if (typeof jumpToHistoryMessage === 'function') jumpToHistoryMessage(item.message_id);
        }
        return;
      }
      downloadMessageFile(payload, btn);
    });
  });
  list.querySelectorAll('.room-file-jump').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var msgId = btn.getAttribute('data-msg-id');
      if (!msgId) return;
      closeRoomFiles();
      if (typeof jumpToHistoryMessage === 'function') {
        jumpToHistoryMessage(msgId);
      } else {
        var el = document.querySelector('[data-msg-id="' + msgId.replace(/"/g, '') + '"]');
        if (el) {
          try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e2) {}
          el.classList.add('msg-highlight');
          setTimeout(function () { try { el.classList.remove('msg-highlight'); } catch (e3) {} }, 2200);
        }
      }
    });
  });

  updateRoomFilesFooter();
}

function bindRoomFilesUi() {
  if (bindRoomFilesUi._bound) return;
  bindRoomFilesUi._bound = true;

  var closeBtn = $('room-files-close');
  if (closeBtn) closeBtn.addEventListener('click', closeRoomFiles);

  var overlay = $('room-files-overlay');
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeRoomFiles();
    });
  }

  var search = $('room-files-search');
  if (search) {
    search.addEventListener('input', function () {
      ensureRoomFilesState().query = search.value || '';
      if (ensureRoomFilesState().source === 'server' || supportsListRoomFiles()) {
        scheduleRoomFilesSearchRefresh();
      } else {
        renderRoomFilesList();
      }
    });
  }

  document.querySelectorAll('[data-room-files-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var rf = ensureRoomFilesState();
      rf.filter = btn.getAttribute('data-room-files-filter') || 'all';
      syncRoomFilesFilterChips();
      if (rf.source === 'server' || supportsListRoomFiles()) {
        refreshRoomFilesFromServer();
      } else {
        renderRoomFilesList();
      }
    });
  });

  var loadMore = $('room-files-load-more');
  if (loadMore) loadMore.addEventListener('click', function () { loadMoreRoomFiles(); });
}
