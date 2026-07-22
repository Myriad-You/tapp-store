// ==================== Render: Conversation List ====================
function buildConversationItems() {
  var items = [];
  state.channels.forEach(function (ch) {
    items.push({
      kind: 'channel', id: ch.channel_id,
      name: ch.remote_actor_name || (ch.remote_actor_url || '').split('/').pop() || '?',
      avatar: ch.remote_actor_avatar || '',
      preview: lang.dm,
      unread: ch.unread_count || 0,
      status: ch.status,
      initiatedBy: ch.initiated_by,
      sortTime: ch.last_activity_at || ch.created_at || '',
      actorUrl: ch.remote_actor_url || '',
    });
  });
  state.rooms.forEach(function (rm) {
    var mstatus = rm.my_membership_status || rm.membership_status || 'active';
    items.push({
      kind: 'room', id: rm.room_id,
      name: rm.name || '?',
      avatar: rm.avatar_url || '',
      preview: mstatus === 'pending'
        ? (lang.pending || 'Pending')
        : ((rm.member_count || 0) + ' ' + lang.members),
      unread: rm.unread_count || 0,
      status: mstatus === 'pending' ? 'pending' : undefined,
      initiatedBy: mstatus === 'pending' ? 'remote' : undefined,
      sortTime: rm.last_message_at || rm.created_at || '',
      actorUrl: '',
    });
  });
  items.sort(function (a, b) { return (b.sortTime || '').localeCompare(a.sortTime || ''); });
  return items;
}

function filterConversationItems(items, query) {
  var q = normalizeSearchQuery(query);
  if (!q) return items;
  return items.filter(function (item) {
    return matchesSearch(q, [item.name, item.preview, item.actorUrl, item.kind === 'channel' ? lang.dm : lang.members]);
  });
}

/**
 * Apply messenger list filter: recent | dm | room only.
 * Closed conversations are always excluded from the main list
 * (no UI to browse closed; composer lock for closed detail can remain).
 * recent = open DMs + rooms, sorted by existing last-activity order.
 */
function filterConversationByTab(items) {
  var tab = state.convTab || 'recent';
  return items.filter(function (item) {
    if (item.status === 'closed') return false;
    if (tab === 'dm') return item.kind === 'channel';
    if (tab === 'room') return item.kind === 'room';
    // recent (default): non-closed DMs + rooms
    return item.kind === 'channel' || item.kind === 'room';
  });
}

function syncConvTabsUi() {
  var tab = state.convTab || 'recent';
  document.querySelectorAll('.conv-tab').forEach(function (btn) {
    var on = btn.getAttribute('data-conv-tab') === tab;
    btn.classList.toggle('conv-tab-active', on);
    if (btn.setAttribute) btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function setConvTab(tab) {
  if (tab !== 'recent' && tab !== 'dm' && tab !== 'room') tab = 'recent';
  state.convTab = tab;
  syncConvTabsUi();
  renderConvList();
}

/**
 * Stable click handler for #conv-list (event delegation).
 * Per-item listeners are dropped whenever renderConvList replaces innerHTML
 * (poll / open / realtime), which made rapid list clicks appear dead.
 */
function bindConvListClicks() {
  var list = $('conv-list');
  if (!list || list.dataset.convClickBound === '1') return;
  list.dataset.convClickBound = '1';
  list.addEventListener('click', function (e) {
    var item = e.target && e.target.closest ? e.target.closest('.conv-item') : null;
    if (!item || !list.contains(item)) return;
    var kind = item.getAttribute('data-kind') || item.dataset.kind;
    var id = item.getAttribute('data-id') || item.dataset.id;
    if (!kind || !id) return;
    e.preventDefault();
    if (typeof openConversation === 'function') openConversation(kind, id);
  });
}

function renderConvList() {
  var list = $('conv-list');
  if (!list) return;

  bindConvListClicks();
  syncConvTabsUi();

  var allItems = buildConversationItems();
  var tabItems = filterConversationByTab(allItems);
  var q = (state.search && state.search.conv) || '';
  var items = filterConversationItems(tabItems, q);

  if (tabItems.length === 0 && !q) {
    var emptyTitle = lang.noConv || lang.title || 'Messenger';
    var emptyHint = lang.noConvHint || lang.selectHint || 'Start a chat with +';
    if ((state.convTab || 'recent') === 'room') {
      emptyTitle = lang.convTabRoomEmpty || lang.rooms || lang.convTabRoom || 'Groups';
      emptyHint = lang.convTabRoomEmptyHint || lang.noRoomsHint || lang.noConvHint || emptyHint;
    } else if ((state.convTab || 'recent') === 'dm') {
      emptyTitle = lang.convTabDmEmpty || lang.dm || lang.convTabDm || 'DMs';
      emptyHint = lang.convTabDmEmptyHint || lang.noConvHint || emptyHint;
    } else {
      emptyTitle = lang.convTabRecentEmpty || lang.noConv || emptyTitle;
      emptyHint = lang.convTabRecentEmptyHint || lang.noConvHint || emptyHint;
    }
    list.innerHTML = '<div class="conv-empty conv-empty-fill"><span style="display:flex;flex-direction:column;gap:6px;align-items:center;max-width:200px">'
      + '<span style="font-weight:600;font-size:13px;color:var(--text-primary,#333)">' + esc(emptyTitle) + '</span>'
      + '<span style="font-size:12px;line-height:1.45;opacity:.8">' + esc(emptyHint) + '</span></span></div>';
    return;
  }

  if (items.length === 0) {
    list.innerHTML = searchNoResultsHtml();
    return;
  }

  var html = '';
  items.forEach(function (item) {
    var isActive = item.id === state.activeId;
    var avatarClass = item.kind === 'channel' ? 'avatar-channel' : 'avatar-room';
    var rel = item.sortTime ? relTimeStr(item.sortTime) : '';
    // type=button avoids accidental form submit if host wraps page content
    html += '<button type="button" class="conv-item' + (isActive ? ' conv-active' : '') + (item.unread > 0 ? ' conv-unread' : '') + '" data-kind="' + item.kind + '" data-id="' + esc(item.id) + '">'
      + '<span class="conv-accent" aria-hidden="true"></span>'
      + '<div class="conv-avatar ' + avatarClass + '">' + avatarContentHtml(item.avatar || '', item.name) + '</div>'
      + '<div class="conv-info">'
      + '<div class="conv-top">'
      + '<span class="conv-name">' + esc(item.name) + '</span>'
      + (rel ? '<span class="conv-time">' + esc(rel) + '</span>' : '')
      + '</div>'
      + '<div class="conv-bottom">'
      + '<span class="conv-preview">' + esc(item.preview) + '</span>';
    if (item.unread > 0) {
      html += '<span class="conv-badge">' + (item.unread > 9 ? '9+' : item.unread) + '</span>';
    }
    if (item.status === 'pending' && item.initiatedBy === 'remote') {
      html += '<span class="conv-pending">' + esc(lang.pending) + '</span>';
    }
    html += '</div></div></button>';
  });
  list.innerHTML = html;
}

// ==================== Render: Pinned Bar ====================
state.pinnedBarDismissed = false;

function renderPinnedBar() {
  var bar = $('pinned-bar');
  if (!bar) return;
  if (state.pinnedBarDismissed) { bar.style.display = 'none'; return; }
  var pinned = [];
  for (var i = 0; i < state.messages.length; i++) {
    if (state.messages[i].is_pinned) pinned.push(state.messages[i]);
  }
  if (pinned.length === 0) { bar.style.display = 'none'; return; }
  var last = pinned[pinned.length - 1];
  var text = getPayloadText(last.payload) || '';
  if (!text && last.payload) {
    text = last.payload.title || last.payload.filename || '';
  }
  bar.style.display = '';
  bar.innerHTML = '<span class="pinned-bar-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 11V4a1 1 0 011-1h4a1 1 0 011 1v7"/><path d="M5 17h14"/><path d="M7 11l-2 6h14l-2-6"/></svg></span>'
    + '<div class="pinned-bar-body">'
    + '<span class="pinned-bar-label">' + esc(lang.pinnedMsg) + (pinned.length > 1 ? ' (' + pinned.length + ')' : '') + '</span>'
    + '<span class="pinned-bar-text">' + esc(text) + '</span>'
    + '</div>'
    + '<button type="button" class="pinned-bar-close" id="pinned-bar-close" title="' + esc(lang.dismiss || 'Dismiss') + '" aria-label="' + esc(lang.dismiss || 'Dismiss') + '">&times;</button>';
  var closeBtn = $('pinned-bar-close');
  if (closeBtn) closeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    state.pinnedBarDismissed = true;
    bar.style.display = 'none';
  });
  bar.onclick = function () {
    var msgEl = document.querySelector('[data-msg-id="' + last.message_id + '"]');
    if (msgEl) msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
}

// ==================== Message Context Menu ====================
var _msgMenu = null;
var _longPressTimer = null;
var _msgMenuIgnoreUntil = 0;

function closeMsgMenu() {
  if (!_msgMenu) return;
  var menu = _msgMenu;
  _msgMenu = null;
  aroDismiss(menu, { remove: true, ms: 120 });
}

function onMsgMenuOutside(e) {
  if (!_msgMenu) return;
  if (Date.now() < _msgMenuIgnoreUntil) return;
  // Keep open when interacting with the menu itself
  if (_msgMenu.contains(e.target)) return;
  // Opening control (⋯) handles its own toggle
  if (e.target && e.target.closest && e.target.closest('.msg-more-btn')) return;
  closeMsgMenu();
}

// Single document listeners (not re-bound per render)
document.addEventListener('click', onMsgMenuOutside);
document.addEventListener('contextmenu', onMsgMenuOutside);

function showMsgMenu(msgEl, x, y) {
  closeMsgMenu();
  var msgId = msgEl.dataset.msgId;
  if (!msgId) return;
  var msg = null;
  for (var i = 0; i < state.messages.length; i++) {
    if (state.messages[i].message_id === msgId) { msg = state.messages[i]; break; }
  }
  if (!msg) return;

  var isPinned = !!msg.is_pinned;
  var canPin = state.activeKind === 'room' && typeof Tapp.federation.pinRoomMessage === 'function';
  var pinSvg = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 11V4a1 1 0 011-1h4a1 1 0 011 1v7"/><path d="M5 17h14"/><path d="M7 11l-2 6h14l-2-6"/></svg>';
  var quoteSvg = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></svg>';
  var forwardSvg = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/><path d="M14 9l3 3-3 3"/><path d="M17 12H9"/></svg>';
  var copySvg = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';

  var menu = document.createElement('div');
  menu.className = 'msg-ctx-menu';
  menu.setAttribute('role', 'menu');
  var html = '';
  // Pin only for rooms — channel pin has no federation API
  if (canPin) {
    html += '<button type="button" class="msg-ctx-item" data-action="pin" role="menuitem">' + pinSvg + '<span>' + (isPinned ? esc(lang.msgUnpin) : esc(lang.msgPin)) + '</span></button>';
  }
  html += '<button type="button" class="msg-ctx-item" data-action="quote" role="menuitem">' + quoteSvg + '<span>' + esc(lang.msgQuote) + '</span></button>'
    + '<button type="button" class="msg-ctx-item" data-action="forward" role="menuitem">' + forwardSvg + '<span>' + esc(lang.msgForward) + '</span></button>'
    + '<button type="button" class="msg-ctx-item" data-action="copy" role="menuitem">' + copySvg + '<span>' + esc(lang.msgCopy || lang.copy || 'Copy') + '</span></button>';
  menu.innerHTML = html;

  document.body.appendChild(menu);
  var mw = menu.offsetWidth, mh = menu.offsetHeight;
  var ww = window.innerWidth, wh = window.innerHeight;
  var left = x + mw > ww ? ww - mw - 8 : x;
  var top = y + mh > wh ? wh - mh - 8 : y;
  if (left < 8) left = 8;
  if (top < 8) top = 8;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  _msgMenu = menu;
  // Ignore the opening gesture / synthetic click so long-press doesn't instantly dismiss
  _msgMenuIgnoreUntil = Date.now() + 400;

  menu.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var action = btn.dataset.action;
    closeMsgMenu();
    if (action === 'pin') doTogglePin(msg);
    else if (action === 'quote') doQuote(msg);
    else if (action === 'forward') doForward(msg);
    else if (action === 'copy') doCopyMsg(msg);
  });
}

function bindMsgContextMenu(container) {
  // Bind once — renderMessages replaces innerHTML but reuses #messages
  if (!container || container.dataset.msgMenuBound === '1') return;
  container.dataset.msgMenuBound = '1';

  container.addEventListener('contextmenu', function (e) {
    var row = e.target.closest('.msg-row');
    if (!row) return;
    e.preventDefault();
    showMsgMenu(row, e.clientX, e.clientY);
  });
  container.addEventListener('touchstart', function (e) {
    var row = e.target.closest('.msg-row');
    if (!row) return;
    if (e.target.closest('a, button, img')) return;
    var touch = e.touches[0];
    if (!touch) return;
    var startX = touch.clientX;
    var startY = touch.clientY;
    _longPressTimer = setTimeout(function () {
      _longPressTimer = null;
      showMsgMenu(row, startX, startY);
    }, 500);
  }, { passive: true });
  container.addEventListener('touchend', function () {
    if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
  });
  container.addEventListener('touchmove', function () {
    if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
  });
  container.addEventListener('click', function (e) {
    var more = e.target.closest('.msg-more-btn');
    if (!more || !container.contains(more)) return;
    e.preventDefault();
    e.stopPropagation();
    var row = more.closest('.msg-row');
    if (!row) return;
    // Toggle if already open for this message
    if (_msgMenu && row.dataset.msgId && _msgMenu.dataset.forMsg === row.dataset.msgId) {
      closeMsgMenu();
      return;
    }
    var rect = more.getBoundingClientRect();
    showMsgMenu(row, rect.left, rect.bottom + 4);
    if (_msgMenu) _msgMenu.dataset.forMsg = row.dataset.msgId || '';
  });
}

async function doTogglePin(msg) {
  if (state.activeKind !== 'room' || !state.activeId) return;
  if (typeof Tapp.federation.pinRoomMessage !== 'function') return;
  var newPinned = !msg.is_pinned;
  try {
    await Tapp.federation.pinRoomMessage(state.activeId, msg.message_id, newPinned);
    msg.is_pinned = newPinned;
    state.messagesFp = messagesFingerprint(state.messages);
    state.pinnedBarDismissed = false;
    renderMessages();
  } catch (e) {
    try { Tapp.ui.showNotification({ title: lang.pinFail || 'Pin failed', type: 'error' }); } catch (e2) { /* ignore */ }
  }
}

function doQuote(msg) {
  // Pending/closed/rejected channel: cannot reply
  if (typeof isChannelComposerLocked === 'function' ? isChannelComposerLocked() : (
    state.activeKind === 'channel' && state.channelDetail && state.channelDetail.status === 'closed'
  )) {
    try {
      Tapp.ui.showNotification({
        title: (typeof channelComposerLockReason === 'function' && channelComposerLockReason())
          || lang.composerClosed || lang.channelNotAccepted || lang.closed,
        type: 'error'
      });
    } catch (e) { /* ignore */ }
    return;
  }
  var sender = typeof quoteSenderLabel === 'function'
    ? quoteSenderLabel(msg)
    : ((msg.sender_actor || '').split('/').pop() || '?');
  var text = typeof quotePreviewText === 'function'
    ? quotePreviewText(msg)
    : (getPayloadText(msg.payload) || (msg.payload && (msg.payload.title || msg.payload.filename)) || '');
  state.quoteMsg = {
    message_id: msg.message_id,
    sender: sender,
    text: text || (lang.newMessage || 'Message'),
  };
  renderQuotePreview();
  var input = $('msg-input');
  if (input && !input.disabled) input.focus();
}

function messageCopyText(msg) {
  if (!msg) return '';
  var payload = (typeof msg.payload === 'object' && msg.payload) ? msg.payload : {};
  var text = getPayloadText(msg.payload) || '';
  if (text) return text;
  if (payload.title) return String(payload.title);
  if (payload.filename) return String(payload.filename);
  if (payload.tapp_id) return String(payload.tapp_id);
  if (payload.brew_link) return String(payload.brew_link);
  return '';
}

async function doCopyMsg(msg) {
  var text = messageCopyText(msg);
  if (!text) {
    try { Tapp.ui.showNotification({ title: lang.copyFail, type: 'error' }); } catch (e) { /* ignore */ }
    return;
  }
  if (typeof copyTextToClipboard === 'function') {
    await copyTextToClipboard(text);
    return;
  }
  // Fallback if helper not yet available
  var ok = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch (e2) { ok = false; }
  if (!ok && typeof fallbackCopyText === 'function') ok = fallbackCopyText(text);
  try {
    Tapp.ui.showNotification({ title: ok ? lang.copied : lang.copyFail, type: ok ? 'success' : 'error' });
  } catch (e3) { /* ignore */ }
}

function clearQuote() {
  state.quoteMsg = null;
  renderQuotePreview();
}

function renderQuotePreview() {
  var wrap = $('quote-preview');
  if (!wrap) return;
  if (!state.quoteMsg) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  wrap.style.display = 'flex';
  wrap.innerHTML =
    '<div class="quote-preview-bar"></div>'
    + '<div class="quote-preview-body">'
    + '<div class="quote-preview-sender">' + esc((lang.quoteLabel || 'Replying to') + ' ' + state.quoteMsg.sender) + '</div>'
    + '<div class="quote-preview-text">' + esc(state.quoteMsg.text) + '</div>'
    + '</div>'
    + '<button type="button" class="quote-preview-close" id="quote-close" title="' + esc(lang.dismiss || lang.close || 'Close') + '" aria-label="' + esc(lang.dismiss || lang.close || 'Close') + '">&times;</button>';
  var closeBtn = $('quote-close');
  if (closeBtn) closeBtn.addEventListener('click', clearQuote);
  // Restart enter motion when quote target changes
  aroPlayEnter(wrap, 'aro-attach-enter');
}

/**
 * Build a self-contained payload for forwarding.
 * - Copies content; strips reply/quote context (forward is a new message).
 * - file-meta with only transfer_id is NOT portable across conversations
 *   (transfer ACL is bound to original channel/room). Reject unless inline data exists.
 */
function buildForwardPayload(msg) {
  var src = (typeof msg.payload === 'object' && msg.payload) ? msg.payload : {};
  var payload = {};
  try {
    payload = JSON.parse(JSON.stringify(src));
  } catch (e) {
    payload = Object.assign({}, src);
  }
  // Drop quote/reply snapshot from original (forward is not a reply)
  delete payload.quote_sender;
  delete payload.quote_text;
  delete payload.quote_id;

  var msgType = msg.message_type || 'text';
  if (msgType === 'text' || !msgType) {
    if (payload.transfer_id && payload.filename) msgType = 'file-meta';
    else if (payload.data && payload.mime_type && String(payload.mime_type).indexOf('image/') === 0) msgType = 'image';
    else if (payload.data && payload.filename) msgType = 'file';
  }

  // transfer_id alone: target conversation cannot download (wrong channel/room ACL)
  if ((msgType === 'file-meta' || payload.transfer_id) && !payload.data) {
    return {
      ok: false,
      error: lang.forwardTransferOnly
        || lang.forwardFileMetaFail
        || 'Large files cannot be forwarded yet — open the file and re-send it',
    };
  }

  // Cap accidental giant payloads (safety)
  if (payload.data && typeof payload.data === 'string' && payload.data.length > 6 * 1024 * 1024) {
    return {
      ok: false,
      error: lang.forwardTooLarge || lang.mediaTooLarge || 'Attachment too large to forward',
    };
  }

  return { ok: true, payload: payload, message_type: msgType };
}

function doForward(msg) {
  var built = buildForwardPayload(msg);
  if (!built.ok) {
    try {
      Tapp.ui.showNotification({
        title: lang.msgForward || 'Forward',
        message: built.error,
        type: 'error',
      });
    } catch (eBlock) { /* ignore */ }
    return;
  }

  var items = [];
  state.channels.forEach(function (ch) {
    // Skip non-writable DMs (pending/closed/rejected) as forward targets
    if (ch.status && ch.status !== 'active' && ch.status !== 'accepted') return;
    items.push({
      kind: 'channel',
      id: ch.channel_id,
      name: ch.remote_actor_name || (ch.remote_actor_url || '').split('/').pop() || '?',
      avatar: ch.remote_actor_avatar || '',
    });
  });
  state.rooms.forEach(function (rm) {
    var mst = rm.my_membership_status || rm.membership_status || 'active';
    if (mst === 'pending') return; // cannot forward into pending invite rooms
    items.push({
      kind: 'room',
      id: rm.room_id,
      name: rm.name || '?',
      avatar: rm.avatar_url || '',
    });
  });
  items = items.filter(function (it) { return it.id !== state.activeId; });
  if (items.length === 0) {
    try {
      Tapp.ui.showNotification({ title: lang.forwardEmpty || lang.noConv || 'No conversations', type: 'error' });
    } catch (e0) { /* ignore */ }
    return;
  }

  var overlay = document.createElement('div');
  overlay.className = 'forward-overlay';
  overlay.dataset.aroDismissable = '1';
  // Closed CSS default is display:none + PE none — open after append.
  overlay.style.display = 'none';
  overlay.style.pointerEvents = 'none';
  var searchPh = lang.searchForward || lang.searchConversations || lang.pickerSearchPlaceholder || 'Search…';
  overlay.innerHTML =
    '<div class="forward-sheet" role="dialog" aria-label="' + esc(lang.forwardTo) + '">'
    + '<div class="forward-header">'
    + '<div class="forward-title">' + esc(lang.forwardTo) + '</div>'
    + '<button type="button" class="forward-close" aria-label="' + esc(lang.dismiss || lang.close || 'Close') + '">&times;</button>'
    + '</div>'
    + '<div class="forward-search">'
    + '<input type="search" class="aro-search-input" autocomplete="off" enterkeyhint="search" placeholder="' + esc(searchPh) + '" aria-label="' + esc(searchPh) + '" />'
    + '</div>'
    + '<div class="forward-list"></div>'
    + '</div>';
  var listEl = overlay.querySelector('.forward-list');
  var searchInput = overlay.querySelector('.forward-search input');
  var dismissForward = function () { aroDismiss(overlay, { remove: true, ms: 160 }); };

  function renderForwardItems(filterQ) {
    var q = normalizeSearchQuery(filterQ);
    var filtered = !q ? items : items.filter(function (it) {
      return matchesSearch(q, [it.name, it.kind]);
    });
    listEl.innerHTML = '';
    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="aro-search-empty" style="text-align:center;padding:16px">'
        + esc(lang.searchNoResults || lang.pickerEmpty || 'No matches') + '</div>';
      return;
    }
    filtered.forEach(function (it) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'forward-item';
      btn.innerHTML = '<div class="forward-item-avatar">' + avatarContentHtml(it.avatar || '', it.name) + '</div><span>' + esc(it.name) + '</span>';
      btn.addEventListener('click', async function () {
        if (btn.disabled) return;
        btn.disabled = true;
        dismissForward();
        try {
          var sendReq = { payload: built.payload, message_type: built.message_type };
          var fwdRes;
          if (it.kind === 'channel') {
            fwdRes = await Tapp.federation.sendMessage(it.id, sendReq);
          } else {
            fwdRes = await Tapp.federation.sendRoomMessage(it.id, sendReq);
          }
          if (typeof noteDeliveryEnqueue === 'function') noteDeliveryEnqueue(fwdRes);
          try { Tapp.ui.showNotification({ title: lang.forwardSuccess, type: 'success' }); } catch (e2) {}
          // If user is already in the target conversation, refresh
          if (state.activeKind === it.kind && state.activeId === it.id && typeof pollMessages === 'function') {
            try { await pollMessages(true); } catch (e3) { /* ignore */ }
          }
        } catch (e) {
          notifyError(lang.sendFail, e);
        }
      });
      listEl.appendChild(btn);
    });
  }

  renderForwardItems('');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      renderForwardItems(searchInput.value);
    });
  }
  overlay.querySelector('.forward-close').addEventListener('click', dismissForward);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) dismissForward();
  });
  document.body.appendChild(overlay);
  if (typeof showAroOverlay === 'function') showAroOverlay(overlay);
  else {
    overlay.style.pointerEvents = 'auto';
    overlay.style.display = 'flex';
  }
  if (searchInput) {
    try { searchInput.focus(); } catch (eFocus) { /* ignore */ }
  }
}

// ==================== Render: Messages ====================
function renderMessages(opts) {
  opts = opts || {};
  var container = $('messages');
  if (!container) return;
  state.pinnedBarDismissed = false;

  // Pending channel/room invite or open-join: centered CTA card instead of transcript/header buttons.
  if (typeof renderPendingInviteBanner === 'function' && renderPendingInviteBanner()) {
    return;
  }

  if (state.messages.length === 0) {
    if (state.chatLoadError) {
      container.innerHTML = '<div class="messages-empty messages-empty-error">'
        + '<div class="messages-empty-icon" style="color:#b91c1c">' + SVG_ICONS.file + '</div>'
        + '<p style="font-weight:600;color:#b91c1c">' + esc(lang.loadFail || 'Load failed') + '</p>'
        + '<p style="font-size:12px;opacity:.8;max-width:240px;line-height:1.45">' + esc(String(state.chatLoadError)) + '</p>'
        + '<button type="button" class="messages-retry-btn" id="messages-retry-btn">' + esc(lang.feedRetry || 'Try again') + '</button>'
        + '</div>';
      var retryBtn = $('messages-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', function () {
          if (state.activeKind && state.activeId) openConversation(state.activeKind, state.activeId);
        });
      }
    } else {
      var hint = state.activeKind === 'channel' ? lang.emptyChatHint : lang.emptyRoomHint;
      container.innerHTML = '<div class="messages-empty"><div class="messages-empty-icon">'
        + (state.activeKind === 'channel' ? SVG_ICONS.channel : SVG_ICONS.room)
        + '</div><p>' + esc(hint) + '</p></div>';
    }
    var pb = $('pinned-bar'); if (pb) pb.style.display = 'none';
    state.skipMsgAppear = false;
    return;
  }
  // Successful non-empty load clears sticky error
  state.chatLoadError = null;

  var animateNew = !!opts.animateNew && !state.skipMsgAppear && !prefersReducedMotion();
  var newCount = Math.max(0, opts.newCount || 0);
  var appearFrom = animateNew ? Math.max(0, state.messages.length - newCount) : state.messages.length;
  state.skipMsgAppear = false;

  var html = '';
  var lastDayKey = '';
  state.messages.forEach(function (msg, idx) {
    var local = isLocalActor(msg.sender_actor);
    var sender = (msg.sender_actor || '').split('/').pop() || '?';
    var payload = (typeof msg.payload === 'object' && msg.payload) ? msg.payload : {};
    var msgType = msg.message_type || 'text';
    // Auto-detect content type from payload when message_type is generic
    if (msgType === 'text' || !msgType) {
      var knownShareTypes = { tapp: 1, brew: 1, library: 1, report: 1, image: 1, file: 1, 'file-meta': 1 };
      if (payload.content_type && typeof payload.content_type === 'string' && knownShareTypes[payload.content_type]) {
        msgType = payload.content_type;
      } else if (payload.tapp_id) {
        msgType = 'tapp';
      } else if (payload.brew_id || payload.brew_link) {
        msgType = 'brew';
      } else if (payload.report_id) {
        msgType = 'report';
      } else if (payload.platform_id && (payload.item_id || payload.title)) {
        msgType = 'library';
      } else if (payload.data && payload.mime_type && payload.mime_type.indexOf('image/') === 0) {
        msgType = 'image';
      } else if (payload.transfer_id && payload.filename) {
        msgType = 'file-meta';
      } else if (payload.data && payload.filename) {
        msgType = 'file';
      }
    }
    // E2E key exchange is protocol traffic stored as history — show as system
    // separator, never as a bubble of raw {algorithm, publicKey, direction}.
    if (isE2eKeyExchangeMessage(msg, msgType, payload)) {
      var kxLabel = e2eKeyExchangeLabel(msg, payload);
      html += '<div class="msg-day-sep msg-e2e-sep" data-msg-id="' + esc(msg.message_id || '') + '">'
        + '<span class="msg-day-label">' + esc(kxLabel) + '</span></div>';
      return;
    }
    var text = getPayloadText(msg.payload);
    var pinned = msg.is_pinned ? '<span class="msg-pin"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 11V4a1 1 0 011-1h4a1 1 0 011 1v7"/><path d="M5 17h14"/><path d="M7 11l-2 6h14l-2-6"/></svg></span>' : '';

    // Resolve avatar and display name for remote messages
    var avatarUrl = '';
    var displayName = sender;
    if (!local) {
      if (state.activeKind === 'channel' && state.channelDetail) {
        avatarUrl = state.channelDetail.remote_actor_avatar || '';
        displayName = state.channelDetail.remote_actor_name || sender;
      } else if (state.activeKind === 'room') {
        var member = findMemberByActor(msg.sender_actor);
        if (member) {
          displayName = member.display_name || sender;
          avatarUrl = member.avatar_url || '';
        }
      }
    }

    // Day separators
    var dayKey = '';
    try {
      var md = new Date(msg.created_at);
      if (!isNaN(md)) dayKey = md.getFullYear() + '-' + md.getMonth() + '-' + md.getDate();
    } catch (e) { dayKey = ''; }
    if (dayKey && dayKey !== lastDayKey) {
      lastDayKey = dayKey;
      html += '<div class="msg-day-sep"><span class="msg-day-label">' + esc(dayLabel(msg.created_at)) + '</span></div>';
    }

    // Compact: same sender within ~5 minutes
    var prevMsg = idx > 0 ? state.messages[idx - 1] : null;
    var sameSender = prevMsg && sameActorUrl(prevMsg.sender_actor, msg.sender_actor);
    var compact = false;
    if (sameSender && prevMsg && prevMsg.created_at && msg.created_at) {
      try {
        var dt = Math.abs(new Date(msg.created_at) - new Date(prevMsg.created_at));
        compact = dt < 5 * 60 * 1000;
      } catch (e2) { compact = false; }
    }

    html += '<div class="msg-row ' + (local ? 'msg-local' : 'msg-remote') + (compact ? ' msg-compact' : '')
      + (idx >= appearFrom ? ' msg-appear' : '')
      + '" data-msg-id="' + esc(msg.message_id || '') + '">';
    if (!local) {
      if (compact) {
        html += '<div class="msg-avatar-spacer"></div>';
      } else {
        html += '<div class="msg-avatar">' + avatarContentHtml(avatarUrl, displayName) + '</div>';
      }
    }
    // Rich media / share cards carry their own surface — the card *is* the bubble
    // whenever there is no caption or quote to host alongside it.
    var isMediaMsg = (msgType === 'image' && payload.data)
      || msgType === 'file' || msgType === 'file-meta'
      || msgType === 'tapp' || msgType === 'brew' || msgType === 'library' || msgType === 'report';
    var bareMedia = isMediaMsg && !payload.text && !payload.quote_sender && !payload.quote_text;

    html += '<div class="msg-bubble ' + (local ? 'bubble-local' : 'bubble-remote')
      + (bareMedia ? ' bubble-media' : '') + '">';
    html += '<button type="button" class="msg-more-btn" title="' + esc(lang.msgActions || 'Message actions') + '" aria-label="' + esc(lang.msgActions || 'Message actions') + '">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>'
      + '</button>';
    if (!local && !compact) {
      html += '<div class="msg-sender">' + esc(displayName) + '</div>';
    }

    // Render quoted message if present (snapshot travels in payload for both parties)
    if (payload.quote_sender || payload.quote_text || payload.quote_id) {
      var qId = payload.quote_id || msg.reply_to || '';
      html += '<button type="button" class="msg-quote-block"'
        + (qId ? ' data-quote-id="' + esc(qId) + '"' : '')
        + ' title="' + esc(lang.roomFilesJump || lang.historyJump || 'Show in chat') + '">'
        + '<div class="msg-quote-bar"></div>'
        + '<div class="msg-quote-content">'
        + '<div class="msg-quote-sender">' + esc(payload.quote_sender || '') + '</div>'
        + '<div class="msg-quote-text">' + esc(payload.quote_text || '') + '</div>'
        + '</div></button>';
    }

    // Render content based on message type
    if (msgType === 'image' && payload.data) {
      html += '<figure class="msg-media" data-media-idx="' + idx + '" tabindex="0" role="button"'
        + ' aria-label="' + esc(payload.filename || lang.attachImage || 'Image') + '">'
        + '<img class="msg-image" src="' + esc(payload.data) + '" alt="' + esc(payload.filename || '') + '" loading="lazy" />'
        + '<span class="msg-media-veil"></span>'
        + '<span class="msg-media-zoom">' + SVG_ICONS.expand + '</span>'
        + '</figure>';
      if (payload.text) html += '<div class="msg-text msg-caption">' + esc(payload.text) + '</div>';
    } else if (msgType === 'file' || msgType === 'file-meta') {
      var fileMeta = fileCardMeta(payload.filename, payload.mime_type);
      var hasInline = !!(payload.data);
      var hasTransfer = !!(payload.transfer_id);
      var canDownload = hasInline || hasTransfer;
      var metaBits = [];
      if (payload.size) metaBits.push(formatFileSize(payload.size));
      if (fileMeta.ext) metaBits.push(fileMeta.ext);
      if (hasTransfer && !hasInline) metaBits.push(lang.attachFile || 'file');
      var sizeLabel = metaBits.join(' · ');
      var fileTitle = canDownload
        ? (lang.downloadFile || payload.filename || 'File')
        : (payload.filename || lang.previewFile || 'File');
      // Inline base64 OR completed chunked transfer (transfer_id) → downloadable
      html += '<button type="button" class="msg-file-card' + (canDownload ? '' : ' msg-file-card-disabled') + '"'
        + ' data-kind="' + esc(fileMeta.kind) + '" data-file-idx="' + idx + '"'
        + (hasInline ? ' data-has-inline="1"' : '')
        + (hasTransfer ? ' data-transfer-id="' + esc(payload.transfer_id) + '"' : '')
        + (canDownload ? '' : ' disabled')
        + ' title="' + esc(fileTitle) + '">'
        + '<span class="msg-file-icon">' + fileMeta.glyph
        + (fileMeta.ext ? '<em class="msg-file-ext">' + esc(fileMeta.ext) + '</em>' : '') + '</span>'
        + '<span class="msg-file-info">'
        + '<span class="msg-file-name">' + esc(payload.filename || 'file') + '</span>'
        + '<span class="msg-file-size">' + esc(sizeLabel) + '</span>'
        + '</span>'
        + '<span class="msg-file-action">' + (canDownload ? SVG_ICONS.download : SVG_ICONS.cloud) + '</span>'
        + '</button>';
      if (payload.text) html += '<div class="msg-text msg-caption">' + esc(payload.text) + '</div>';
    } else if (msgType === 'tapp' || msgType === 'brew' || msgType === 'library' || msgType === 'report') {
      // A library share that carries cover art renders as an image-forward media
      // card (poster + sender attribution); everything else stays the compact row.
      var mediaView = (msgType === 'library') ? libraryMediaView(payload) : null;
      if (mediaView && safeIconUrl(mediaView.image)) {
        html += libraryMediaCardHtml(idx, payload, mediaView);
        if (payload.text) html += '<div class="msg-text msg-caption">' + esc(payload.text) + '</div>';
      } else {
      var shareIcons = { tapp: SVG_ICONS.tapp, brew: SVG_ICONS.brew, library: SVG_ICONS.library, report: SVG_ICONS.report };
      var shareCardId = 'share-card-' + idx;
      // Unified share fields so cards never render blank (type label + title + optional desc/cover).
      var shareView = resolveShareCardView(msgType, payload);
      var shareTitle = shareView.title;
      var shareDesc = shareView.description;
      var shareCover = shareView.image;
      // The icon carries the type, so it must be the real source mark where one
      // exists: cover art > the tapp's own icon > the source site / platform
      // logo > the generic type glyph (older messages carry no logo fields).
      var shareSlug = '';
      if (msgType === 'report') shareSlug = payload.platform || payload.platform_id || '';
      else if (msgType === 'library') shareSlug = payload.platform_id || '';
      else if (msgType === 'brew') shareSlug = payload.source_name || '';
      var shareLogo = platformLogoSvg(shareSlug);
      var shareFavicon = msgType === 'brew' ? safeIconUrl(payload.source_icon) : '';
      var iconContent = '';
      // '' | 'brand' (known platform → brand palette) | 'img' (favicon supplies
      // its own colors, so the card stays neutral)
      var iconMark = '';
      if (shareCover) {
        iconContent = '<img src="' + esc(shareCover) + '" alt="" />';
      } else if (msgType === 'tapp' && payload.tapp_icon) {
        iconContent = payload.tapp_icon; // raw SVG string
      } else if (shareFavicon) {
        // data-fallback: swapped in on load error (dead favicon / hotlink block)
        iconContent = '<img class="msg-share-favicon" src="' + esc(shareFavicon) + '" alt="" data-fallback="' + esc(msgType) + '" />';
        iconMark = 'img';
      } else if (shareLogo) {
        iconContent = shareLogo;
        iconMark = 'brand';
      } else {
        iconContent = payload.icon || shareIcons[msgType] || SVG_ICONS.file;
      }
      // Brand accent drives --acc (tile, wash, hover border) for known platforms.
      // Emitted as -l/-d pairs so the stylesheet — not inline style — picks the
      // theme variant; an inline --acc would outrank the .dark rule.
      var shareAccent = iconMark === 'brand' ? platformAccent(shareSlug) : null;
      var shareAccentStyle = shareAccent
        ? ';--acc-l:' + shareAccent.l + ';--acc-d:' + shareAccent.d
        : '';
      // Determine tapp share acceptance status from storage
      var tappAcceptStatus = '';
      if (msgType === 'tapp' && payload.tapp_id) {
        var stKey = 'tapp_accept_' + payload.tapp_id + '_' + idx;
        tappAcceptStatus = (state.tappAcceptMap && state.tappAcceptMap[stKey]) || '';
      }
      // Undecided incoming tapp share → decision card (no drill-in affordance yet)
      var shareNeedsDecision = (msgType === 'tapp' && !local && !tappAcceptStatus);
      html += '<div class="msg-share-card" id="' + shareCardId + '"'
        + ' style="cursor:pointer' + shareAccentStyle + '" data-type="' + esc(msgType) + '"'
        + (payload.tapp_id ? ' data-tapp-id="' + esc(payload.tapp_id) + '"' : '')
        + (payload.tapp_version ? ' data-tapp-version="' + esc(payload.tapp_version) + '"' : '')
        + (payload.tapp_name ? ' data-tapp-name="' + esc(payload.tapp_name) + '"' : '')
        + ((payload.store_source || payload.storeSource) ? ' data-store-source="' + esc(payload.store_source || payload.storeSource) + '"' : '')
        + (payload.brew_id ? ' data-brew-id="' + esc(String(payload.brew_id)) + '"' : '')
        + (payload.brew_link ? ' data-brew-link="' + esc(payload.brew_link) + '"' : '')
        + (payload.platform_id ? ' data-platform-id="' + esc(payload.platform_id) + '"' : '')
        + (payload.item_id ? ' data-item-id="' + esc(String(payload.item_id)) + '"' : '')
        + (shareCover ? ' data-image="' + esc(shareCover) + '"' : '')
        + (payload.report_id ? ' data-report-id="' + esc(payload.report_id) + '"' : '')
        + (payload.summary ? ' data-report-summary="' + esc(payload.summary) + '"' : '')
        + (payload.platform ? ' data-report-platform="' + esc(payload.platform) + '"' : '')
        + (payload.content_preview ? ' data-report-content-preview="' + esc(payload.content_preview) + '"' : '')
        + ' data-msg-idx="' + idx + '"'
        + (shareNeedsDecision ? ' data-pending="1"' : '')
        + (iconMark ? ' data-mark="' + iconMark + '"' : '')
        + '>'
        + '<span class="msg-share-wash" aria-hidden="true"></span>'
        + '<div class="msg-share-main">'
        + '<div class="msg-share-icon"' + (shareCover ? ' data-cover="1"' : '') + (iconMark ? ' data-mark="' + iconMark + '"' : '') + '>' + iconContent + '</div>'
        + '<div class="msg-share-body">'
        + '<div class="msg-share-title">' + esc(shareTitle) + '</div>'
        + (shareDesc ? '<div class="msg-share-desc">' + esc(shareDesc) + '</div>' : '');
      // Version badge + status pill for tapp
      if (msgType === 'tapp') {
        html += '<div class="msg-share-meta">';
        if (payload.tapp_version) html += '<span class="msg-share-ver">v' + esc(payload.tapp_version) + '</span>';
        if (local) {
          // Sender: show pending status
          html += '<span class="msg-share-status msg-share-status-pending">' + esc(lang.tappSharePending) + '</span>';
        } else if (tappAcceptStatus === 'accepted') {
          html += '<span class="msg-share-status msg-share-status-accepted">' + esc(lang.tappShareAccepted) + '</span>';
        } else if (tappAcceptStatus === 'rejected') {
          html += '<span class="msg-share-status msg-share-status-rejected">' + esc(lang.tappShareRejected) + '</span>';
        }
        html += '</div>';
      }
      html += '</div>'
        + (shareNeedsDecision ? '' : '<span class="msg-share-go" aria-hidden="true">' + SVG_ICONS.chevronRight + '</span>')
        + '</div>';
      // Receiver: accept/reject span the card footer, below the main row
      if (shareNeedsDecision) {
        html += '<div class="msg-share-actions">'
          + '<button type="button" class="msg-share-btn-reject" data-reject-idx="' + idx + '">' + esc(lang.rejectTapp) + '</button>'
          + '<button type="button" class="msg-share-btn-accept" data-accept-idx="' + idx + '">' + esc(lang.acceptTapp) + '</button>'
          + '</div>';
      }
      html += '</div>';
      if (payload.text) html += '<div class="msg-text msg-caption">' + esc(payload.text) + '</div>';
      }
    } else {
      html += '<div class="msg-text">' + esc(text) + '</div>';
    }

    html += '<div class="msg-footer">' + pinned + '<span class="msg-time" title="' + esc(fullTimeStr(msg.created_at)) + '">' + timeStr(msg.created_at) + '</span></div>'
      + '</div></div>';
  });
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;

  // ⋯ / long-press / contextmenu bound once via bindMsgContextMenu

  // Bind tapp accept/reject buttons
  container.querySelectorAll('.msg-share-btn-accept').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var msgIdx = btn.dataset.acceptIdx;
      var card = btn.closest('.msg-share-card');
      var tappId = card ? card.dataset.tappId : '';
      if (!tappId) return;
      var stKey = 'tapp_accept_' + tappId + '_' + msgIdx;
      if (!state.tappAcceptMap) state.tappAcceptMap = {};
      state.tappAcceptMap[stKey] = 'accepted';
      Tapp.storage.set(stKey, 'accepted').catch(function () {});
      // Open install detail immediately
      openTappDetail(tappId, card);
      renderMessages();
    });
  });
  container.querySelectorAll('.msg-share-btn-reject').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var msgIdx = btn.dataset.rejectIdx;
      var card = btn.closest('.msg-share-card');
      var tappId = card ? card.dataset.tappId : '';
      if (!tappId) return;
      var stKey = 'tapp_accept_' + tappId + '_' + msgIdx;
      if (!state.tappAcceptMap) state.tappAcceptMap = {};
      state.tappAcceptMap[stKey] = 'rejected';
      Tapp.storage.set(stKey, 'rejected').catch(function () {});
      renderMessages();
    });
  });
  // File card → inline data URL or chunked transfer_id download
  container.querySelectorAll('.msg-file-card').forEach(function (card) {
    if (card.disabled) return;
    card.addEventListener('click', function (e) {
      e.stopPropagation();
      var idx = parseInt(card.dataset.fileIdx, 10);
      var m = state.messages[idx];
      if (!m || !m.payload) return;
      downloadMessageFile(m.payload, card);
    });
  });

  // Quote snapshot → jump to original message (same conversation, both parties)
  container.querySelectorAll('.msg-quote-block[data-quote-id]').forEach(function (qEl) {
    qEl.addEventListener('click', function (e) {
      e.stopPropagation();
      var qid = qEl.getAttribute('data-quote-id');
      if (!qid) return;
      if (typeof jumpToHistoryMessage === 'function') {
        jumpToHistoryMessage(qid);
      } else {
        var target = container.querySelector('[data-msg-id="' + qid.replace(/"/g, '') + '"]');
        if (target) {
          try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (eJ) {}
          target.classList.add('msg-highlight');
          setTimeout(function () {
            try { target.classList.remove('msg-highlight'); } catch (eK) {}
          }, 2200);
        }
      }
    });
  });

  // Dead favicon → fall back to the generic type glyph rather than a broken tile
  container.querySelectorAll('.msg-share-favicon[data-fallback]').forEach(function (img) {
    img.addEventListener('error', function () {
      var tile = img.parentNode;
      if (!tile) return;
      var glyphs = { tapp: SVG_ICONS.tapp, brew: SVG_ICONS.brew, library: SVG_ICONS.library, report: SVG_ICONS.report };
      // Clear the mark on both tile and card: with no source mark left, the
      // message type is the only identity again, so the type wash comes back.
      tile.removeAttribute('data-mark');
      var markedCard = tile.closest('.msg-share-card');
      if (markedCard) markedCard.removeAttribute('data-mark');
      tile.innerHTML = glyphs[img.dataset.fallback] || SVG_ICONS.file;
    });
  });

  // Image bubbles → full-screen viewer
  container.querySelectorAll('.msg-media[data-media-idx]').forEach(function (fig) {
    var open = function (e) {
      e.stopPropagation();
      var m = state.messages[parseInt(fig.dataset.mediaIdx, 10)];
      if (!m || !m.payload || !m.payload.data) return;
      openImageViewer(m.payload.data, m.payload.filename || '');
    };
    fig.addEventListener('click', open);
    fig.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
    });
  });

  // Media cards: tag real cover orientation once loaded so CSS can adapt the
  // layout (games ship landscape banners, anime/music portrait posters), and
  // fall back to the platform glyph if the cover fails to load.
  container.querySelectorAll('.msg-media-card .msg-media-cover-img').forEach(function (img) {
    var apply = function () {
      var card = img.closest('.msg-media-card');
      // Music stays square regardless of the source image's real aspect.
      if (!card || card.dataset.orient === 'square' || !img.naturalWidth || !img.naturalHeight) return;
      card.dataset.orient = (img.naturalWidth / img.naturalHeight >= 1.15) ? 'landscape' : 'portrait';
    };
    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener('load', apply);
    img.addEventListener('error', function () {
      var cover = img.closest('.msg-media-cover');
      if (cover) cover.setAttribute('data-broken', '1');
    });
  });

  // Bind share card click handlers — open detail views
  container.querySelectorAll('.msg-share-card[data-type], .msg-media-card[data-type]').forEach(function (card) {
    card.addEventListener('click', function (e) {
      // Don't open detail if clicking on action buttons
      if (e.target.closest('.msg-share-actions')) return;
      var type = card.dataset.type;
      if (type === 'tapp' && card.dataset.tappId) {
        // Only open detail if accepted or if sender
        var msgIdx = card.dataset.msgIdx;
        var stKey = 'tapp_accept_' + card.dataset.tappId + '_' + msgIdx;
        var status = state.tappAcceptMap && state.tappAcceptMap[stKey];
        var isLocal = card.closest('.msg-local');
        if (isLocal || status === 'accepted') {
          openTappDetail(card.dataset.tappId, card);
        }
      } else if (type === 'brew' && card.dataset.brewId) {
        openBrewDetail(parseInt(card.dataset.brewId, 10), card.dataset.brewLink, card);
      } else if (type === 'library') {
        openLibraryDetail(card);
      } else if (type === 'report' && card.dataset.reportId) {
        // Report detail polish is owned by report workers; keep basic open path
        openReportDetail(card.dataset.reportId, card);
      }
    });
  });
  renderPinnedBar();
  bindMsgContextMenu(container);
}

/**
 * Image-forward media card for a library share that carries cover art.
 * The cover leads (with the platform's logo as a corner mark); beside/under it
 * sit just the title and one compact meta row — kind, rating, and the sender's
 * playtime / watch progress. No source text, no separators. Orientation: games
 * banner, music square, everything else portrait (corrected once loaded).
 */
function libraryMediaCardHtml(idx, payload, view) {
  var slug = view.platform || '';
  var logo = platformLogoSvg(slug);
  var accent = logo ? platformAccent(slug) : null;
  var accentStyle = accent ? ';--acc-l:' + accent.l + ';--acc-d:' + accent.d : '';
  var orient = view.itemType === 'music' ? 'square' : mediaCoverOrient(view.itemType);

  // One meta row, gap-spaced (icons delimit — no dots/dividers). Music leads
  // with the artist (and album when it differs from the title); other media
  // show kind · rating · the sender's playtime/watch progress.
  var meta = '';
  if (view.itemType === 'music' && (view.artist || view.album)) {
    if (view.artist) meta += '<span class="msg-media-kind">' + esc(view.artist) + '</span>';
    if (view.album && view.album !== view.title) meta += '<span class="msg-media-sub">' + esc(view.album) + '</span>';
  } else {
    var kindLabel = mediaKindLabel(view.itemType);
    if (kindLabel) meta += '<span class="msg-media-kind">' + esc(kindLabel) + '</span>';
    if (view.ratingText) meta += '<span class="msg-media-rate">' + SVG_ICONS.star + esc(view.ratingText) + '</span>';
    if (view.stat) meta += '<span class="msg-media-stat">' + view.stat.icon + esc(view.stat.text) + '</span>';
  }

  var cover = '<div class="msg-media-cover">'
    + '<img class="msg-media-cover-img" src="' + esc(view.image) + '" alt="" loading="lazy" />'
    + '<span class="msg-media-cover-fallback" aria-hidden="true">' + (logo || SVG_ICONS.library) + '</span>'
    + (logo ? '<span class="msg-media-logo" data-mark="brand" aria-hidden="true">' + logo + '</span>' : '')
    + '</div>';

  return '<div class="msg-media-card" data-type="library" data-orient="' + orient + '"'
    + ' data-msg-idx="' + idx + '"'
    + (payload.platform_id ? ' data-platform-id="' + esc(payload.platform_id) + '"' : '')
    + (payload.item_id ? ' data-item-id="' + esc(String(payload.item_id)) + '"' : '')
    + (view.image ? ' data-image="' + esc(view.image) + '"' : '')
    + (accent ? ' data-mark="brand"' : '')
    + ' style="cursor:pointer' + accentStyle + '">'
    + cover
    + '<div class="msg-media-info">'
    + '<div class="msg-media-title">' + esc(view.title) + '</div>'
    + (meta ? '<div class="msg-media-meta">' + meta + '</div>' : '')
    + '</div>'
    + '<span class="msg-media-go" aria-hidden="true">' + SVG_ICONS.chevronRight + '</span>'
    + '</div>';
}

/** Full-screen image viewer for image bubbles. */
function openImageViewer(src, name) {
  if (!src) return;
  var overlay = document.createElement('div');
  overlay.className = 'img-viewer';
  overlay.dataset.aroDismissable = '1';
  // Closed CSS default is display:none + PE none — open triad after append.
  overlay.style.display = 'none';
  overlay.style.pointerEvents = 'none';
  overlay.innerHTML = '<div class="img-viewer-bar">'
    + '<span class="img-viewer-name"></span>'
    + '<button type="button" class="img-viewer-btn" data-act="save" title="' + esc(lang.downloadFile || 'Download') + '" aria-label="' + esc(lang.downloadFile || 'Download') + '">' + SVG_ICONS.download + '</button>'
    + '<button type="button" class="img-viewer-btn" data-act="close" title="' + esc(lang.dismiss || 'Close') + '" aria-label="' + esc(lang.dismiss || 'Close') + '">' + SVG_ICONS.close + '</button>'
    + '</div>'
    + '<div class="img-viewer-stage"><img class="img-viewer-img" alt="" /></div>';
  // Assign untrusted values as properties, never through innerHTML.
  overlay.querySelector('.img-viewer-name').textContent = name || '';
  var img = overlay.querySelector('.img-viewer-img');
  img.src = src;
  img.alt = name || '';

  var close = function () {
    document.removeEventListener('keydown', onKey);
    aroDismiss(overlay, { remove: true, ms: 170 });
  };
  var onKey = function (e) { if (e.key === 'Escape') close(); };

  overlay.addEventListener('click', function (e) {
    var act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'save') {
      downloadMessageFile({ data: src, filename: name || 'image' });
      return;
    }
    if (act && act.dataset.act === 'close') { close(); return; }
    if (!e.target.closest('.img-viewer-img')) close();
  });
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  if (typeof showAroOverlay === 'function') showAroOverlay(overlay);
  else {
    overlay.style.pointerEvents = 'auto';
    overlay.style.display = 'flex';
  }
  aroPlayEnter(overlay, 'aro-viewer-enter');
}

/**
 * Poll getTransfer until completed (or failed) so file-meta cards don't 409
 * when meta arrives before federated chunks finish writing.
 * @returns {'ready'|'failed'|'timeout'}
 */
async function waitForTransferReady(transferId, maxMs) {
  maxMs = typeof maxMs === 'number' ? maxMs : 45000;
  if (!transferId || typeof Tapp === 'undefined' || !Tapp.federation) return 'timeout';
  if (typeof Tapp.federation.getTransfer !== 'function') return 'ready';
  var start = Date.now();
  var delay = 400;
  while (Date.now() - start < maxMs) {
    try {
      var meta = await Tapp.federation.getTransfer(transferId);
      var st = meta && meta.status;
      if (st === 'completed') return 'ready';
      if (st === 'failed' || st === 'cancelled') return 'failed';
    } catch (e) {
      // 404 while inbound chunks still arriving — keep waiting
    }
    await new Promise(function (r) { setTimeout(r, delay); });
    delay = Math.min(delay + 200, 2000);
  }
  return 'timeout';
}

/**
 * Download a message attachment.
 * - Small files: payload.data is a data: URL → <a download>
 * - Large channel files: payload.transfer_id → host federation.downloadTransfer
 */
async function downloadMessageFile(payload, triggerEl) {
  if (!payload) {
    try { Tapp.ui.showNotification({ title: lang.downloadFail || lang.loadFail, type: 'error' }); } catch (e) { /* ignore */ }
    return;
  }

  // Path A: inline data URL / base64
  if (payload.data) {
    try {
      var a = document.createElement('a');
      a.href = payload.data;
      a.download = payload.filename || 'file';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e2) {
      try { Tapp.ui.showNotification({ title: lang.downloadFail || lang.loadFail, type: 'error' }); } catch (e3) { /* ignore */ }
    }
    return;
  }

  // Path B: chunked transfer (file-meta)
  var transferId = payload.transfer_id;
  if (!transferId) {
    try { Tapp.ui.showNotification({ title: lang.downloadFail || lang.loadFail, type: 'error' }); } catch (e4) { /* ignore */ }
    return;
  }

  if (typeof Tapp === 'undefined' || !Tapp.federation || typeof Tapp.federation.downloadTransfer !== 'function') {
    try {
      Tapp.ui.showNotification({
        title: lang.downloadFail || lang.loadFail,
        message: lang.transferDownloadUnsupported || 'Transfer download unavailable',
        type: 'error',
      });
    } catch (e5) { /* ignore */ }
    return;
  }

  var busy = false;
  if (triggerEl) {
    busy = !!triggerEl.dataset.dlBusy;
    if (busy) return;
    triggerEl.dataset.dlBusy = '1';
    triggerEl.classList.add('msg-file-card-loading');
  }
  try {
    try {
      Tapp.ui.showNotification({
        title: lang.transferPreparing || lang.transferDownloading || lang.transferStarting || 'Preparing…',
        type: 'info',
      });
    } catch (e6) { /* ignore */ }

    var ready = await waitForTransferReady(transferId, 45000);
    if (ready === 'failed') {
      try {
        Tapp.ui.showNotification({
          title: lang.transferDownloadFail || lang.downloadFail || lang.loadFail,
          message: lang.transferFailed || undefined,
          type: 'error',
        });
      } catch (eFail) { /* ignore */ }
      return;
    }
    if (ready === 'timeout') {
      try {
        Tapp.ui.showNotification({
          title: lang.transferDownloading || 'Downloading…',
          message: lang.transferStillArriving || undefined,
          type: 'info',
        });
      } catch (eTo) { /* ignore */ }
    } else {
      try {
        Tapp.ui.showNotification({
          title: lang.transferDownloading || lang.transferStarting || 'Downloading…',
          type: 'info',
        });
      } catch (eDl) { /* ignore */ }
    }

    var result = await Tapp.federation.downloadTransfer(transferId);
    var savedName = (result && result.filename) || payload.filename || 'file';
    try {
      Tapp.ui.showNotification({
        title: lang.transferDownloadOk || lang.downloadFile || 'Downloaded',
        message: savedName,
        type: 'success',
      });
    } catch (e7) { /* ignore */ }
  } catch (err) {
    var msg = (err && (err.message || err.error)) || String(err || '');
    if (/not ready|not completed|409|Transfer is not ready/i.test(msg) && transferId) {
      try {
        var again = await waitForTransferReady(transferId, 20000);
        if (again === 'ready') {
          var result2 = await Tapp.federation.downloadTransfer(transferId);
          var saved2 = (result2 && result2.filename) || payload.filename || 'file';
          try {
            Tapp.ui.showNotification({
              title: lang.transferDownloadOk || lang.downloadFile || 'Downloaded',
              message: saved2,
              type: 'success',
            });
          } catch (eOk2) { /* ignore */ }
          return;
        }
      } catch (eRetry) {
        msg = (eRetry && (eRetry.message || eRetry.error)) || msg;
      }
    }
    try {
      Tapp.ui.showNotification({
        title: lang.transferDownloadFail || lang.downloadFail || lang.loadFail,
        message: msg || undefined,
        type: 'error',
      });
    } catch (e8) { /* ignore */ }
  } finally {
    if (triggerEl) {
      delete triggerEl.dataset.dlBusy;
      triggerEl.classList.remove('msg-file-card-loading');
    }
  }
}

/* ----- Shared detail overlay for received content ----- */
/**
 * Bottom sheet shell for share detail views.
 * @param {string} title
 * @param {{type?:string, subtitle?:string, slug?:string, favicon?:string,
 *          cover?:string, rawSvg?:string, fallback?:string}} opts
 *   Icon + accent resolve exactly like the share card that opened the sheet.
 */
function createDetailOverlay(title, opts) {
  opts = opts || {};
  var overlay = document.createElement('div');
  overlay.className = 'picker-overlay';
  overlay.dataset.aroDismissable = '1';
  // Closed CSS default is display:none + PE none — open triad after append.
  overlay.style.display = 'none';
  overlay.style.pointerEvents = 'none';
  var visual = sheetVisual(opts);
  applySheetAccent(overlay, visual.accent);
  overlay.innerHTML =
    '<div class="picker-sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">'
    + '<div class="picker-header">'
    + '<div class="picker-header-icon"' + (visual.mark ? ' data-mark="' + esc(visual.mark) + '"' : '') + '>' + visual.icon + '</div>'
    + '<div class="picker-header-text">'
    + '<div class="picker-header-title">' + esc(title) + '</div>'
    + '<div class="picker-header-sub">' + esc(opts.subtitle || '') + '</div>'
    + '</div>'
    + '<button type="button" class="picker-close-btn" aria-label="' + esc(lang.dismiss || lang.close || 'Close') + '">&times;</button>'
    + '</div>'
    + '<div class="picker-body"></div>'
    + '</div>';

  var close = function () {
    document.removeEventListener('keydown', onKey);
    aroDismiss(overlay, { remove: true, ms: 170 });
  };
  var onKey = function (e) { if (e.key === 'Escape') close(); };
  overlay.querySelector('.picker-close-btn').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  // Match createPickerOverlay: CSS defaults to closed; must open explicitly.
  if (typeof showAroOverlay === 'function') showAroOverlay(overlay);
  else {
    overlay.hidden = false;
    overlay.style.pointerEvents = 'auto';
    overlay.style.display = 'flex';
  }
  return overlay;
}

function openTappDetail(tappId, card) {
  // Extract sender-provided info from the share card / data attributes
  var remoteName = (card.querySelector('.msg-share-title') || {}).textContent || card.dataset.tappName || tappId;
  var remoteDesc = (card.querySelector('.msg-share-desc') || {}).textContent || '';
  var remoteVersion = card.dataset.tappVersion || '';
  // P0: catalog URL for store install (portable across instances).
  var storeSource = (card && card.dataset.storeSource) || '';
  // Peer install package lives on the message payload (not data-attrs — too large).
  var installPackage = null;
  var installOmitted = '';
  if (card && card.dataset.msgIdx != null && state.messages) {
    var m = state.messages[parseInt(card.dataset.msgIdx, 10)];
    if (m && m.payload) {
      installPackage = m.payload.install_package || m.payload.installPackage || null;
      installOmitted = m.payload.install_package_omitted || m.payload.installPackageOmitted || '';
      if (!storeSource) {
        storeSource = m.payload.store_source || m.payload.storeSource || '';
      }
    }
  }

  var overlay = createDetailOverlay(remoteName, {
    type: 'tapp',
    subtitle: tappId,
    rawSvg: shareCardPayload(card).tapp_icon || '',
    fallback: SVG_ICONS.tapp,
  });
  var body = overlay.querySelector('.picker-body');
  showPickerLoading(body);

  // Check local installation
  Tapp.tappList.get(tappId).then(function (local) {
    var installed = local && local.status && local.status !== 'uninstalled';
    var localVer = installed ? (local.version || '') : '';
    var needsUpdate = installed && remoteVersion && localVer && localVer !== remoteVersion;
    renderTappDetailView(body, tappId, remoteName, remoteDesc, remoteVersion, installed, localVer, needsUpdate, installPackage, installOmitted, storeSource);
  }).catch(function () {
    // Can't determine local status — assume not installed
    renderTappDetailView(body, tappId, remoteName, remoteDesc, remoteVersion, false, '', false, installPackage, installOmitted, storeSource);
  });
}

function isValidStoreSourceRef(ref) {
  if (!ref || typeof ref !== 'string') return false;
  var s = ref.trim().toLowerCase();
  if (!s || s === 'store' || s === 'direct') return false;
  return true;
}

function renderTappDetailView(body, tappId, name, desc, remoteVer, installed, localVer, needsUpdate, installPackage, installOmitted, storeSource) {
  var statusText = installed ? (needsUpdate ? lang.tappUpdateAvail : lang.tappInstalled) : lang.tappNotInstalled;
  var statusClass = installed ? (needsUpdate ? 'sheet-status-warn' : 'sheet-status-ok') : 'sheet-status-off';
  var hasDirectPkg = !!(installPackage && installPackage.manifest && installPackage.code);
  var hasStoreSource = isValidStoreSourceRef(storeSource);

  var html = '<div class="sheet-pad">';
  if (desc) html += '<div class="sheet-desc">' + esc(desc) + '</div>';

  // Install state panel: status line + version rows + provenance note
  html += '<div class="sheet-panel">'
    + '<div class="sheet-status ' + statusClass + '"><span class="sheet-status-dot" aria-hidden="true"></span>' + esc(statusText) + '</div>';
  if (remoteVer || localVer) {
    html += '<dl style="margin:0;display:flex;flex-direction:column;gap:6px">';
    if (remoteVer) {
      html += '<div class="sheet-row"><dt>' + esc(lang.remoteVer) + '</dt><dd>v' + esc(remoteVer) + '</dd></div>';
    }
    if (localVer) {
      html += '<div class="sheet-row"><dt>' + esc(lang.localVer) + '</dt><dd>v' + esc(localVer) + '</dd></div>';
    }
    html += '</dl>';
  }
  if (!installed && hasStoreSource) {
    html += '<div class="sheet-note">' + esc(lang.tappStoreInstall || 'Will install from store catalog') + '</div>';
  } else if (!installed && hasDirectPkg) {
    html += '<div class="sheet-note">' + esc(lang.tappDirectInstall || 'Install package included in share') + '</div>';
  } else if (!installed && installOmitted) {
    html += '<div class="sheet-note sheet-note-warn">' + esc(installOmitted) + '</div>';
  }
  html += '</div>';

  // Action
  if (!installed) {
    html += '<button type="button" class="sheet-btn tapp-action-btn" data-action="install">' + esc(lang.installBtn) + '</button>'
      + '<div class="sheet-error tapp-install-error" style="display:none"></div>';
  } else if (needsUpdate) {
    html += '<button type="button" class="sheet-btn sheet-btn-warn tapp-action-btn" data-action="update">' + esc(lang.updatingBtn) + '</button>'
      + '<div class="sheet-error tapp-install-error" style="display:none"></div>';
  } else {
    html += '<div class="sheet-hint">' + esc(lang.alreadyLatest) + '</div>';
  }

  html += '</div>';
  body.innerHTML = html;

  // Bind install/update — P0 store path with real storeSource; direct package as fallback.
  var actionBtn = body.querySelector('.tapp-action-btn');
  var errEl = body.querySelector('.tapp-install-error');
  if (actionBtn) {
    actionBtn.addEventListener('click', function handleInstallClick() {
      if (actionBtn.disabled) return;
      actionBtn.disabled = true;
      actionBtn.textContent = lang.installingBtn;
      setSheetBtnState(actionBtn, 'busy');
      if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

      var installReq = null;
      // Store apps between instances: installFromStore with catalog URL.
      if (hasStoreSource) {
        installReq = {
          source: 'store',
          storeSource: storeSource.trim(),
          tappId: tappId
        };
      } else if (hasDirectPkg) {
        installReq = {
          source: 'direct',
          manifest: installPackage.manifest,
          code: installPackage.code,
          styles: installPackage.styles,
          pageTemplate: installPackage.pageTemplate,
          widgetTemplates: installPackage.widgetTemplates,
          widgetCss: installPackage.widgetCss,
          pageCss: installPackage.pageCss,
          i18n: installPackage.i18n,
          pageModules: installPackage.pageModules,
          assets: installPackage.assets,
          permissions: installPackage.permissions
        };
      }

      if (!installReq) {
        actionBtn.textContent = lang.installFailed;
        setSheetBtnState(actionBtn, 'err');
        actionBtn.disabled = false;
        if (errEl) {
          errEl.style.display = 'block';
          errEl.textContent = lang.tappInstallNoStoreSource ||
            'Share is missing store catalog URL. Ask the sender to re-share the Tapp from a current Aro build.';
        }
        return;
      }

      Tapp.tappList.install(installReq).then(function () {
        actionBtn.textContent = lang.installSuccess;
        setSheetBtnState(actionBtn, 'ok');
        actionBtn.removeEventListener('click', handleInstallClick);
      }).catch(function (err) {
        var msg = (err && err.message) ? String(err.message) : (lang.installFailed || 'Install failed');
        // If store path failed and we have a direct package, offer one automatic retry.
        if (hasStoreSource && hasDirectPkg && installReq.source === 'store') {
          var directReq = {
            source: 'direct',
            manifest: installPackage.manifest,
            code: installPackage.code,
            styles: installPackage.styles,
            pageTemplate: installPackage.pageTemplate,
            widgetTemplates: installPackage.widgetTemplates,
            widgetCss: installPackage.widgetCss,
            pageCss: installPackage.pageCss,
            i18n: installPackage.i18n,
            pageModules: installPackage.pageModules,
            assets: installPackage.assets,
            permissions: installPackage.permissions
          };
          return Tapp.tappList.install(directReq).then(function () {
            actionBtn.textContent = lang.installSuccess;
            setSheetBtnState(actionBtn, 'ok');
            actionBtn.removeEventListener('click', handleInstallClick);
          }).catch(function (err2) {
            var msg2 = (err2 && err2.message) ? String(err2.message) : msg;
            actionBtn.textContent = lang.installFailed;
            setSheetBtnState(actionBtn, 'err');
            actionBtn.disabled = false;
            if (errEl) { errEl.style.display = 'block'; errEl.textContent = msg2; }
          });
        }
        actionBtn.textContent = lang.installFailed;
        setSheetBtnState(actionBtn, 'err');
        actionBtn.disabled = false;
        if (errEl) {
          errEl.style.display = 'block';
          errEl.textContent = msg;
        }
      });
    });
  }
}

function openBrewDetail(brewId, brewLink, card) {
  var titleEl = card && card.querySelector('.msg-share-title');
  var brewSnap = shareCardPayload(card);
  var overlay = createDetailOverlay((titleEl && titleEl.textContent) || lang.attachBrew || 'Brew', {
    type: 'brew',
    subtitle: brewSnap.source_name || '',
    favicon: brewSnap.source_icon || '',
    slug: brewSnap.source_name || '',
    fallback: SVG_ICONS.brew,
  });
  var body = overlay.querySelector('.picker-body');
  showPickerLoading(body);
  if (!brewId || typeof Tapp.brewList === 'undefined' || typeof Tapp.brewList.get !== 'function') {
    // Fall back to card payload / link only
    var descEl = card && card.querySelector('.msg-share-desc');
    body.innerHTML =
      '<div class="sheet-pad">'
      + (descEl && descEl.textContent ? '<div class="sheet-desc">' + esc(descEl.textContent) + '</div>' : '')
      + brewLinkHtml(brewLink)
      + '</div>';
    return;
  }
  Tapp.brewList.get(brewId).then(function (detail) {
    if (!detail) { body.innerHTML = '<div class="picker-empty">' + esc(lang.pickerEmpty) + '</div>'; return; }
    var brewChips = [];
    if (detail.source_name) brewChips.push(detail.source_name);
    if (detail.author) brewChips.push(detail.author);
    if (detail.published_at) {
      try { brewChips.push(new Date(detail.published_at).toLocaleDateString(currentLocale)); } catch (e) { /* ignore */ }
    }
    body.innerHTML =
      '<div class="sheet-pad">'
      + (safeIconUrl(detail.image) ? '<img class="sheet-cover" src="' + esc(detail.image) + '" alt="" />' : '')
      + sheetMetaHtml(brewChips)
      + (detail.summary ? '<div class="sheet-desc">' + esc(detail.summary) + '</div>' : '')
      + brewLinkHtml(brewLink)
      + '</div>';
  }).catch(function () {
    body.innerHTML = '<div class="picker-empty">' + esc(lang.pickerEmpty) + '</div>';
  });
}

function openLibraryDetail(card) {
  // Prefer live message payload snapshot, then data-* attrs, then DOM text.
  var payloadSnap = shareCardPayload(card);
  var titleEl = card && card.querySelector('.msg-share-title');
  var descEl = card && card.querySelector('.msg-share-desc');
  var view = resolveShareCardView('library', payloadSnap);
  var title = view.title || (titleEl && titleEl.textContent) || lang.attachLibrary || 'Library';
  var desc = view.description || (descEl && descEl.textContent) || '';
  var platformId = payloadSnap.platform_id || (card && card.dataset.platformId) || '';
  var itemId = payloadSnap.item_id != null ? String(payloadSnap.item_id) : ((card && card.dataset.itemId) || '');
  var image = view.image || (card && card.dataset.image) || '';
  var contentType = payloadSnap.item_type || (payloadSnap.content_type && payloadSnap.content_type !== 'library' ? payloadSnap.content_type : '') || '';
  var overlay = createDetailOverlay(title, {
    type: 'library',
    subtitle: platformId,
    slug: platformId,
    fallback: SVG_ICONS.library,
  });
  var body = overlay.querySelector('.picker-body');
  body.innerHTML =
    '<div class="sheet-pad">'
    + (safeIconUrl(image) ? '<img class="sheet-cover" src="' + esc(image) + '" alt="" />' : '')
    + sheetMetaHtml([platformId, contentType, itemId])
    + (desc ? '<div class="sheet-desc">' + esc(desc) + '</div>' : '')
    + '</div>';
}

function openReportDetail(reportId, card) {
  // Prefer live message payload (#120 snapshot fields), then data-* attrs, then DOM text.
  // getReport is user-scoped — recipients rely on the snapshot only.
  var payloadSnap = shareCardPayload(card);
  var titleNode = card && card.querySelector ? card.querySelector('.msg-share-title') : null;
  var descNode = card && card.querySelector ? card.querySelector('.msg-share-desc') : null;
  var snapSummary = payloadSnap.summary
    || (card && card.dataset && card.dataset.reportSummary)
    || (titleNode && titleNode.textContent)
    || 'Report';
  var snapPlatform = payloadSnap.platform
    || (card && card.dataset && card.dataset.reportPlatform)
    || '';
  var snapPreview = payloadSnap.content_preview
    || (card && card.dataset && card.dataset.reportContentPreview)
    || '';
  if (!snapPreview && descNode && descNode.textContent) snapPreview = descNode.textContent;
  var snapType = payloadSnap.type || payloadSnap.content_type || '';

  var overlay = createDetailOverlay(snapSummary || 'Report', {
    type: 'report',
    subtitle: snapPlatform,
    slug: snapPlatform,
    fallback: SVG_ICONS.report,
  });
  var body = overlay.querySelector('.picker-body');

  function renderReportSnapshot(summary, platform, contentText, createdAt, typeLabel) {
    var dateLabel = '';
    if (createdAt) {
      try { dateLabel = new Date(createdAt).toLocaleDateString(currentLocale); } catch (e) { /* ignore */ }
    }
    // Plain-text snapshot path (share payload / recipients) — never esc(object)
    var bodyText = formatReportContentBody(contentText, snapPreview || '');
    bodyText = stripHtmlPreview(bodyText || '').trim();
    body.innerHTML =
      '<div class="sheet-pad">'
      + sheetMetaHtml([platform, typeLabel, dateLabel])
      + (bodyText ? '<div class="sheet-desc sheet-scroll">' + esc(bodyText) + '</div>' : '')
      + '</div>';
  }

  // Always show message snapshot first so recipients never hit empty/loading forever.
  if (snapSummary || snapPreview || snapPlatform) {
    renderReportSnapshot(snapSummary, snapPlatform, snapPreview, null, snapType || null);
  } else {
    showPickerLoading(body);
  }

  // Owner path: enrich with sectioned HTML from catalog (complementary to #120 plain snapshot).
  if (!reportId) return;
  if (!Tapp.report || typeof Tapp.report.getReport !== 'function') return;
  Tapp.report.getReport(reportId).then(function (detail) {
    if (!detail) {
      if (!snapSummary && !snapPreview && !snapPlatform) {
        body.innerHTML = '<div class="picker-empty">' + esc(lang.reportUnavailable || lang.pickerEmpty) + '</div>';
      }
      return;
    }
    if (!detail.summary && snapSummary) detail.summary = snapSummary;
    if (!detail.platform && snapPlatform) detail.platform = snapPlatform;
    body.innerHTML = renderReportDetailBodyHtml(detail);
  }).catch(function () {
    // Recipients: keep snapshot already rendered. Only show empty if we had nothing.
    if (!snapSummary && !snapPreview && !snapPlatform) {
      body.innerHTML = '<div class="picker-empty">' + esc(lang.reportUnavailable || lang.pickerEmpty) + '</div>';
    }
  });
}

// Header chrome buttons (must stay in chat.js so they are global — not nested inside
// another function if module order shifts). Used by renderChatHeader in members.js.
function historyHeaderButtonHtml() {
  var title = lang.historyTitle || 'Chat history';
  // Same chrome classes as member-toggle / manage (unified header toolbar)
  return '<button type="button" class="aro-icon-btn chat-hdr-icon-btn" id="history-open-btn" title="' + esc(title) + '" aria-label="' + esc(title) + '">'
    + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
    + '</button>';
}

function roomFilesHeaderButtonHtml() {
  var title = lang.roomFilesTitle || 'Group files';
  return '<button type="button" class="aro-icon-btn chat-hdr-icon-btn" id="room-files-open-btn" title="' + esc(title) + '" aria-label="' + esc(title) + '">'
    + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>'
    + '</button>';
}

function wireHistoryHeaderButton() {
  var btn = $('history-open-btn');
  if (!btn) return;
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (typeof openChatHistory === 'function') openChatHistory();
  });
}

function wireRoomFilesHeaderButton() {
  var btn = $('room-files-open-btn');
  if (!btn) return;
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (typeof openRoomFiles === 'function') openRoomFiles();
  });
}
