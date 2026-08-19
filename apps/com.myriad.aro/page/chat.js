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
  if (state.convTab === tab) {
    syncConvTabsUi();
    return;
  }
  state.convTab = tab;
  syncConvTabsUi();
  renderConvList();
  // Keep list scrolled to top when changing filter — avoids “stuck mid-list” empty feeling.
  var list = $('conv-list');
  if (list) {
    try { list.scrollTop = 0; } catch (eScr) { /* ignore */ }
  }
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
    // Empty-state CTA (rebuilt on each empty paint — delegated)
    var cta = e.target && e.target.closest ? e.target.closest('#conv-empty-cta, .conv-empty-cta') : null;
    if (cta && list.contains(cta)) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof showCreateDialog === 'function') showCreateDialog();
      else {
        var createBtn = $('create-btn');
        if (createBtn) createBtn.click();
      }
      return;
    }
    var item = e.target && e.target.closest ? e.target.closest('.conv-item') : null;
    if (!item || !list.contains(item)) return;
    var kind = item.getAttribute('data-kind') || item.dataset.kind;
    var id = item.getAttribute('data-id') || item.dataset.id;
    if (!kind || !id) return;
    e.preventDefault();
    if (typeof openConversation === 'function') openConversation(kind, id);
  });
}

/**
 * Skip full list rewrite when tab/search/selection/items are unchanged.
 *
 * Covers every field the row paints, not just id/unread/order: the subtitle
 * carries a group's member count, and sampling a window of the list left counts
 * outside it frozen until something else forced a rebuild.
 */
function convListFingerprint(items, tab, q, activeId) {
  var n = (items && items.length) || 0;
  var unreadSum = 0;
  var sig = '';
  for (var i = 0; i < n; i++) {
    var it = items[i];
    unreadSum += (it.unread || 0);
    sig += (it.kind || '')[0] + ':' + (it.id || '')
      + ':' + (it.unread || 0)
      + ':' + (it.sortTime || '')
      + ':' + (it.name || '')
      + ':' + (it.preview || '')
      + ':' + (it.avatar || '')
      + ':' + (it.status || '')
      + ';';
  }
  return [tab || '', q || '', activeId || '', n, unreadSum, sig].join('|');
}

/**
 * Rewrite the relative timestamps already on screen ("now", "7m", "2h").
 *
 * Those labels are rendered once and then frozen: the list only repaints when
 * the data behind it changes, and time passing is not such a change. A chat
 * that arrived a moment ago therefore sat at its send-time label until the next
 * message. Patch the text in place rather than invalidating the fingerprint —
 * a tick then costs nothing beyond the labels that actually moved.
 */
function refreshConvListTimes() {
  var list = $('conv-list');
  if (!list) return;
  var rows = list.querySelectorAll('.conv-item[data-time]');
  for (var i = 0; i < rows.length; i++) {
    var iso = rows[i].getAttribute('data-time');
    if (!iso) continue;
    var timeEl = rows[i].querySelector('.conv-time');
    if (!timeEl) continue;
    var next = relTimeStr(iso);
    if (next && timeEl.textContent !== next) timeEl.textContent = next;
  }
}

var CONV_TIME_TICK_MS = 30000;
var _convTimeTimer = null;

/** Keep sidebar timestamps honest while the page stays open (ARO-14 tracked). */
function startConvTimeTicker() {
  if (_convTimeTimer) return;
  _convTimeTimer = setInterval(function () {
    if (typeof document !== 'undefined' && document.hidden) return;
    refreshConvListTimes();
  }, CONV_TIME_TICK_MS);
  // Returning from a backgrounded tab: catch up before the next tick lands.
  pageListen(document, 'visibilitychange', function () {
    if (!document.hidden) refreshConvListTimes();
  });
  if (typeof getPageDisposables === 'function') {
    getPageDisposables().add(function () {
      if (_convTimeTimer) { clearInterval(_convTimeTimer); _convTimeTimer = null; }
    });
  }
}

function renderConvList() {
  var list = $('conv-list');
  if (!list) return;

  bindConvListClicks();
  startConvTimeTicker();
  syncConvTabsUi();

  var allItems = buildConversationItems();
  var tabItems = filterConversationByTab(allItems);
  var q = (state.search && state.search.conv) || '';
  var items = filterConversationItems(tabItems, q);
  var tab = state.convTab || 'recent';

  if (tabItems.length === 0 && !q) {
    state._convListFp = '';
    var emptyTitle = lang.noConv || lang.title || 'Messenger';
    var emptyHint = lang.noConvHint || lang.selectHint || 'Start a chat with +';
    if (tab === 'room') {
      emptyTitle = lang.convTabRoomEmpty || lang.rooms || lang.convTabRoom || 'Groups';
      emptyHint = lang.convTabRoomEmptyHint || lang.noRoomsHint || lang.noConvHint || emptyHint;
    } else if (tab === 'dm') {
      emptyTitle = lang.convTabDmEmpty || lang.dm || lang.convTabDm || 'DMs';
      emptyHint = lang.convTabDmEmptyHint || lang.noConvHint || emptyHint;
    } else {
      emptyTitle = lang.convTabRecentEmpty || lang.noConv || emptyTitle;
      emptyHint = lang.convTabRecentEmptyHint || lang.noConvHint || emptyHint;
    }
    var ctaLabel = lang.startChat || lang.create || '+';
    list.innerHTML = '<div class="conv-empty conv-empty-fill">'
      + '<div class="conv-empty-inner">'
      + '<span class="conv-empty-title">' + esc(emptyTitle) + '</span>'
      + '<span class="conv-empty-hint">' + esc(emptyHint) + '</span>'
      + '<button type="button" class="conv-empty-cta" id="conv-empty-cta">' + esc(ctaLabel) + '</button>'
      + '</div></div>';
    return;
  }

  if (items.length === 0) {
    state._convListFp = '';
    list.innerHTML = searchNoResultsHtml();
    return;
  }

  var fp = convListFingerprint(items, tab, q, state.activeId);
  if (fp && fp === state._convListFp && list.querySelector('.conv-item')) {
    // Still sync active highlight without full rebuild when only selection changed
    // (fingerprint includes activeId — so this is true skip)
    return;
  }
  state._convListFp = fp;

  var html = '';
  items.forEach(function (item) {
    var isActive = item.id === state.activeId;
    var avatarClass = item.kind === 'channel' ? 'avatar-channel' : 'avatar-room';
    var rel = item.sortTime ? relTimeStr(item.sortTime) : '';
    // type=button avoids accidental form submit if host wraps page content
    html += '<button type="button" class="conv-item' + (isActive ? ' conv-active' : '') + (item.unread > 0 ? ' conv-unread' : '') + '" data-kind="' + item.kind + '" data-id="' + esc(item.id) + '"'
      + (item.sortTime ? ' data-time="' + esc(item.sortTime) + '"' : '') + '>'
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

// Single document listeners — registered from bindEvents after page bag exists
function registerMsgMenuOutsideGuards() {
  pageListen(document, 'click', onMsgMenuOutside);
  pageListen(document, 'contextmenu', onMsgMenuOutside);
}

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
  var stickerSvg = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01"/><path d="M8.2 14.2c1.1 1.3 2.5 2 3.8 2s2.7-.7 3.8-2"/></svg>';

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
  // Add image → sticker pack (inline data images)
  var canSticker = typeof addStickerFromMessage === 'function'
    && typeof getMessageImageDataUrl === 'function'
    && !!getMessageImageDataUrl(msg);
  if (canSticker) {
    html += '<button type="button" class="msg-ctx-item" data-action="sticker" role="menuitem">'
      + stickerSvg + '<span>' + esc(lang.stickerAddFromImage || lang.stickerAdd || 'Add as sticker') + '</span></button>';
  }
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
    else if (action === 'sticker' && typeof addStickerFromMessage === 'function') {
      addStickerFromMessage(msg, { target: 'ask' });
    }
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
    // Allow long-press on images (add sticker); still skip links/buttons.
    if (e.target.closest('a, button') && !e.target.closest('.msg-media, .msg-image')) return;
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

/** Coalesce rapid poll/WS renders into one paint frame. */
var _renderMsgRaf = 0;
var _renderMsgPendingOpts = null;

/**
 * Schedule renderMessages on the next animation frame (merge opts).
 * Use for poll/WS bursts. Prefer direct renderMessages for open/error paths.
 */
function scheduleRenderMessages(opts) {
  var incoming = opts || {};
  if (!_renderMsgPendingOpts) {
    _renderMsgPendingOpts = {
      animateNew: !!incoming.animateNew,
      newCount: Math.max(0, incoming.newCount || 0),
      stickBottom: !!incoming.stickBottom,
      forceFull: !!incoming.forceFull,
      forceFullHistory: !!incoming.forceFullHistory,
    };
  } else {
    var cur = _renderMsgPendingOpts;
    cur.animateNew = !!(cur.animateNew || incoming.animateNew);
    cur.newCount = Math.max(cur.newCount || 0, incoming.newCount || 0);
    cur.stickBottom = !!(cur.stickBottom || incoming.stickBottom);
    cur.forceFull = !!(cur.forceFull || incoming.forceFull);
    cur.forceFullHistory = !!(cur.forceFullHistory || incoming.forceFullHistory);
  }
  if (_renderMsgRaf) return;
  var raf = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : function (cb) { return setTimeout(cb, 16); };
  _renderMsgRaf = raf(function () {
    _renderMsgRaf = 0;
    var o = _renderMsgPendingOpts;
    _renderMsgPendingOpts = null;
    renderMessages(o || {});
  });
}

/** True when the user is near the bottom of the transcript (auto-scroll safe). */
function isMessagesNearBottom(el, px) {
  if (!el) return true;
  var threshold = px == null ? 96 : px;
  try {
    return (el.scrollHeight - el.scrollTop - el.clientHeight) <= threshold;
  } catch (e) {
    return true;
  }
}

// resolveMessageType / msgTextHtml / bindMessagesDelegates / buildMessageEntryHtml / libraryMediaCardHtml → msgUi.js

/** Soft cap for full-window HTML rebuild when user is on the live tail (history still in state). */
var MSG_RENDER_MAX = 180;

function renderMessages(opts) {
  opts = opts || {};
  var container = $('messages');
  if (!container) return;
  // Ensure delegated handlers exist before any empty/full path returns.
  bindMessagesDelegates(container);
  bindMsgContextMenu(container);
  state.pinnedBarDismissed = false;

  // Pending channel/room invite or open-join: centered CTA card instead of transcript/header buttons.
  if (typeof renderPendingInviteBanner === 'function' && renderPendingInviteBanner()) {
    state.chatOpening = false;
    return;
  }

  if (state.chatOpening && state.messages.length === 0 && !state.chatLoadError) {
    container.innerHTML = typeof chatOpeningHtml === 'function'
      ? chatOpeningHtml()
      : '<div class="messages-empty" role="status">' + esc(lang.feedLoading || 'Loading…') + '</div>';
    var pbLoad = $('pinned-bar'); if (pbLoad) pbLoad.style.display = 'none';
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
  // stickBottom: own send / open — always follow tail. Otherwise only if user is near bottom.
  var wasNearBottom = !!opts.stickBottom || isMessagesNearBottom(container);
  var prevScrollTop = container.scrollTop;
  var prevScrollHeight = container.scrollHeight;
  // Anchor on the topmost visible row. Restoring a raw scrollTop after a full
  // innerHTML rebuild lands at the top: images/media have no intrinsic height
  // until they decode, so scrollHeight momentarily collapses and the browser
  // clamps scrollTop to that smaller box. The row anchor survives the collapse
  // because it is re-measured after the media settles.
  var anchor = captureScrollAnchor(container);
  state.skipMsgAppear = false;

  // Soft window: when on the live tail with a huge buffer, only paint the last N rows.
  // Full history remains in state.messages for load-older / jump-to.
  var hState = typeof ensureHistoryState === 'function' ? ensureHistoryState() : null;
  var loadingOlder = !!(hState && hState.mainLoadingOlder);
  var renderStart = 0;
  if (
    !opts.forceFullHistory
    && !loadingOlder
    && state.messages.length > MSG_RENDER_MAX
    && (wasNearBottom || opts.stickBottom || opts.animateNew)
  ) {
    renderStart = state.messages.length - MSG_RENDER_MAX;
  }
  // After user explicitly loaded older pages, prefer full paint unless hard-cap
  if (opts.forceFull || (hState && hState.hasMoreMain === false && !wasNearBottom && !opts.stickBottom)) {
    // reading mid-history: paint everything we have (load-older path uses forceFull)
    if (opts.forceFull && !opts.stickBottom) renderStart = 0;
  }

  // ---- Fast path: append-only when DOM tail still matches previous last message ----
  if (
    !opts.forceFull
    && animateNew
    && newCount > 0
    && newCount <= 8
    && state.messages.length > newCount
    && renderStart === 0 // only when not soft-windowing (or window still covers tail)
  ) {
    var prevLen = state.messages.length - newCount;
    var anchorMsg = state.messages[prevLen - 1];
    var lastRow = null;
    var rows = container.querySelectorAll('.msg-row[data-msg-id]');
    if (rows && rows.length) lastRow = rows[rows.length - 1];
    if (
      anchorMsg
      && anchorMsg.message_id
      && lastRow
      && lastRow.getAttribute('data-msg-id') === anchorMsg.message_id
      && !container.querySelector('.messages-empty, .messages-opening')
    ) {
      var appendHtml = '';
      var dayCtx = { lastDayKey: '' };
      // Seed day key from last existing separator / message
      try {
        if (anchorMsg.created_at) {
          var ad = new Date(anchorMsg.created_at);
          if (!isNaN(ad)) dayCtx.lastDayKey = ad.getFullYear() + '-' + ad.getMonth() + '-' + ad.getDate();
        }
      } catch (eDay) { /* ignore */ }
      for (var ai = prevLen; ai < state.messages.length; ai++) {
        appendHtml += buildMessageEntryHtml(state.messages[ai], ai, {
          appearFrom: appearFrom,
          dayCtx: dayCtx,
        });
      }
      if (appendHtml) {
        container.insertAdjacentHTML('beforeend', appendHtml);
        if (typeof syncRunTailAvatar === 'function') syncRunTailAvatar(container, prevLen - 1);
        hydrateMessageMedia(container);
        if (wasNearBottom) {
          settleScrollPosition(container, function () {
            container.scrollTop = container.scrollHeight;
          });
        }
        renderPinnedBar();
        return;
      }
    }
  }

  // When soft-windowing, append path may still work if last DOM row is in window
  if (
    !opts.forceFull
    && animateNew
    && newCount > 0
    && newCount <= 8
    && renderStart > 0
  ) {
    var prevLenW = state.messages.length - newCount;
    var anchorMsgW = state.messages[prevLenW - 1];
    var lastRowW = null;
    var rowsW = container.querySelectorAll('.msg-row[data-msg-id]');
    if (rowsW && rowsW.length) lastRowW = rowsW[rowsW.length - 1];
    if (
      anchorMsgW && anchorMsgW.message_id && lastRowW
      && lastRowW.getAttribute('data-msg-id') === anchorMsgW.message_id
    ) {
      var appendHtmlW = '';
      var dayCtxW = { lastDayKey: '' };
      try {
        if (anchorMsgW.created_at) {
          var adW = new Date(anchorMsgW.created_at);
          if (!isNaN(adW)) dayCtxW.lastDayKey = adW.getFullYear() + '-' + adW.getMonth() + '-' + adW.getDate();
        }
      } catch (eDayW) { /* ignore */ }
      for (var aj = prevLenW; aj < state.messages.length; aj++) {
        appendHtmlW += buildMessageEntryHtml(state.messages[aj], aj, {
          appearFrom: appearFrom,
          dayCtx: dayCtxW,
        });
      }
      if (appendHtmlW) {
        container.insertAdjacentHTML('beforeend', appendHtmlW);
        if (typeof syncRunTailAvatar === 'function') syncRunTailAvatar(container, prevLenW - 1);
        hydrateMessageMedia(container);
        if (wasNearBottom) {
          settleScrollPosition(container, function () {
            container.scrollTop = container.scrollHeight;
          });
        }
        renderPinnedBar();
        return;
      }
    }
  }

  var html = '';
  if (renderStart > 0) {
    html += '<div class="msg-history-hint" role="status">'
      + '<button type="button" class="msg-history-hint-btn" id="msg-expand-history" data-msg-expand-history="1">'
      + esc((lang.msgEarlier || lang.historyLoadMore || 'Earlier messages')
        + ' · ' + renderStart)
      + '</button></div>';
  }
  var dayCtxFull = { lastDayKey: '' };
  for (var ri = renderStart; ri < state.messages.length; ri++) {
    html += buildMessageEntryHtml(state.messages[ri], ri, {
      appearFrom: appearFrom,
      dayCtx: dayCtxFull,
    });
  }
  container.innerHTML = html;

  hydrateMessageMedia(container);

  // Re-apply after media decodes: the first pass runs against a collapsed box.
  settleScrollPosition(container, function () {
    if (wasNearBottom) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    if (restoreScrollAnchor(container, anchor)) return;
    // Preserve reading position when history above grew / pin refresh mid-scroll
    var delta = container.scrollHeight - prevScrollHeight;
    if (delta > 0) container.scrollTop = prevScrollTop + delta;
    else container.scrollTop = prevScrollTop;
  });

  renderPinnedBar();
}

/**
 * Flag transcript media frames once their image has a natural size.
 *
 * Image and sticker bubbles size to their content, and an <img> contributes
 * 0×0 until it decodes — so a freshly written bubble takes up no room, then
 * snaps to full height and pushes everything under it. CSS holds a placeholder
 * tile while the frame lacks `data-loaded`; flipping it here hands the box back
 * to the natural size exactly when that size becomes known. Link-preview covers
 * ride along for their landscape/portrait orientation.
 *
 * Call after every insertion. Listeners are attached once per <img>, so a
 * repeat call on rows that are already in the DOM is free.
 */
function hydrateMessageMedia(container) {
  if (!container) return;
  var settle = function (img) {
    if (!img.naturalWidth || !img.naturalHeight) return;
    var frame = img.closest('.msg-media, .msg-sticker');
    if (frame) {
      frame.dataset.loaded = '1';
      // Cache the measurement so the next rebuild of this row reserves the box
      // in its markup and never collapses in the first place.
      var row = img.closest('.msg-row[data-msg-id]');
      if (row && typeof noteMessageMediaSize === 'function') {
        noteMessageMediaSize(row.getAttribute('data-msg-id'), img.naturalWidth, img.naturalHeight);
      }
    }
    var card = img.closest('.msg-media-card');
    if (card && card.dataset.orient !== 'square') {
      card.dataset.orient = (img.naturalWidth / img.naturalHeight >= 1.15) ? 'landscape' : 'portrait';
    }
  };
  var imgs = container.querySelectorAll('.msg-image, .msg-sticker-img, .msg-media-cover-img');
  for (var i = 0; i < imgs.length; i++) {
    var img = imgs[i];
    // The load event can fire before insertAdjacentHTML/innerHTML returns.
    if (img.complete) {
      settle(img);
      continue;
    }
    if (img.dataset.aroMediaBound) continue;
    img.dataset.aroMediaBound = '1';
    (function (target) {
      var done = function () {
        target.removeEventListener('load', done);
        target.removeEventListener('error', done);
        settle(target);
      };
      target.addEventListener('load', done);
      target.addEventListener('error', done);
    })(img);
  }
}

/**
 * Remember which row is at the top of the viewport, and how far above it sits.
 * Used to restore reading position across a full innerHTML rebuild.
 */
function captureScrollAnchor(container) {
  try {
    if (!container || container.scrollTop <= 0) return null;
    var cTop = container.getBoundingClientRect().top;
    var rows = container.querySelectorAll('.msg-row[data-msg-id]');
    for (var i = 0; i < rows.length; i++) {
      var top = rows[i].getBoundingClientRect().top - cTop;
      // First row whose bottom edge is still on screen.
      if (top + rows[i].offsetHeight > 0) {
        var id = rows[i].getAttribute('data-msg-id');
        if (!id) return null;
        return { id: id, offset: top };
      }
    }
  } catch (eAnc) { /* ignore */ }
  return null;
}

/** Put `anchor`'s row back under the same viewport offset. True when applied. */
function restoreScrollAnchor(container, anchor) {
  if (!container || !anchor || !anchor.id) return false;
  try {
    var row = container.querySelector('.msg-row[data-msg-id="' + cssEscapeAttr(anchor.id) + '"]');
    if (!row) return false;
    var top = row.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTop = container.scrollTop + (top - anchor.offset);
    return true;
  } catch (eRes) {
    return false;
  }
}

/** Escape a value for use inside a CSS attribute selector. */
function cssEscapeAttr(value) {
  return String(value).replace(/["\\]/g, '\\$&');
}

/**
 * Run `apply` now, next frame, and again as transcript media finishes loading.
 *
 * A single post-render write is not enough: <img>/media inside the freshly
 * written HTML report zero height until decode, so the container is short and
 * any scrollTop we set gets clamped. Re-running as each image lands keeps the
 * view where the reader left it instead of snapping to the top.
 */
var _scrollSettleToken = 0;
var _scrollSettleRelease = null;
/** Input that means the reader took the viewport over. */
var SCROLL_SETTLE_TAKEOVER = ['wheel', 'touchstart', 'touchmove', 'pointerdown'];

function settleScrollPosition(container, apply) {
  var token = ++_scrollSettleToken;
  // Only one settle window at a time; the newest render owns the viewport.
  if (_scrollSettleRelease) _scrollSettleRelease();

  // Watch for real input rather than diffing scrollTop between runs. A decoding
  // image resizes the content and browser scroll anchoring answers by writing
  // scrollTop itself — indistinguishable from a reader scroll by value alone,
  // and reading it as one abandoned the correction with the view half-placed.
  var takenOver = false;
  var markTakeover = function () { takenOver = true; };
  SCROLL_SETTLE_TAKEOVER.forEach(function (name) {
    container.addEventListener(name, markTakeover, { passive: true });
  });
  document.addEventListener('keydown', markTakeover, true);
  var released = false;
  var release = function () {
    if (released) return;
    released = true;
    if (_scrollSettleRelease === release) _scrollSettleRelease = null;
    SCROLL_SETTLE_TAKEOVER.forEach(function (name) {
      container.removeEventListener(name, markTakeover);
    });
    document.removeEventListener('keydown', markTakeover, true);
  };
  _scrollSettleRelease = release;

  var run = function () {
    if (token !== _scrollSettleToken || !container.isConnected || takenOver) {
      release();
      return false;
    }
    try { apply(); } catch (eApply) { /* ignore */ }
    return true;
  };
  if (!run()) return;

  var settling = 0;
  var raf = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : function (cb) { return setTimeout(cb, 16); };
  // `settling` is final by the time this frame runs — the loop below is still
  // part of the current task.
  raf(function () {
    run();
    if (settling <= 0) release();
  });

  var pending = container.querySelectorAll('img');
  var deadline = Date.now() + 4000;
  for (var i = 0; i < pending.length; i++) {
    var img = pending[i];
    if (img.complete) continue;
    settling++;
    var onSettled = (function (target) {
      return function handler() {
        target.removeEventListener('load', handler);
        target.removeEventListener('error', handler);
        settling--;
        if (Date.now() > deadline) { release(); return; }
        run();
        if (settling <= 0) release();
      };
    })(img);
    img.addEventListener('load', onSettled);
    img.addEventListener('error', onSettled);
  }
  // Backstop for images that never resolve — the takeover listeners must not
  // outlive the window they guard.
  setTimeout(release, 4200);
}


// libraryMediaCardHtml → msgUi.js

function openImageViewer(src, name) {
  if (!src) return;
  var overlay = document.createElement('div');
  overlay.className = 'img-viewer';
  overlay.dataset.aroDismissable = '1';
  // Closed CSS default is display:none + PE none — open triad after append.
  overlay.style.display = 'none';
  overlay.style.pointerEvents = 'none';
  var canAddSticker = typeof addImageDataAsSticker === 'function'
    && String(src).indexOf('data:image/') === 0;
  var stickerBtnHtml = canAddSticker
    ? ('<button type="button" class="img-viewer-btn" data-act="sticker" title="'
      + esc(lang.stickerAddFromImage || lang.stickerAdd || 'Add as sticker')
      + '" aria-label="' + esc(lang.stickerAddFromImage || lang.stickerAdd || 'Add as sticker') + '">'
      + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01"/><path d="M8.2 14.2c1.1 1.3 2.5 2 3.8 2s2.7-.7 3.8-2"/></svg>'
      + '</button>')
    : '';
  overlay.innerHTML = '<div class="img-viewer-bar">'
    + '<span class="img-viewer-name"></span>'
    + stickerBtnHtml
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
    if (act && act.dataset.act === 'sticker' && typeof addImageDataAsSticker === 'function') {
      e.stopPropagation();
      addImageDataAsSticker(src, {
        target: 'ask',
        name: name || 'sticker',
      });
      return;
    }
    if (act && act.dataset.act === 'close') { close(); return; }
    if (!e.target.closest('.img-viewer-img') && !e.target.closest('.img-viewer-btn')) close();
  });
  pageListen(document, 'keydown', onKey);

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

  // Path A: inline data URL / base64 — rebuild controlled Blob (ARO-09)
  if (payload.data) {
    try {
      var safe = typeof safeInlineDownload === 'function' ? safeInlineDownload(payload) : null;
      if (!safe) {
        try { Tapp.ui.showNotification({ title: lang.downloadFail || lang.loadFail, type: 'error' }); } catch (eBad) { /* ignore */ }
        return;
      }
      var a = document.createElement('a');
      a.href = safe.url;
      a.download = safe.filename || 'file';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { safe.revoke(); }, 2000);
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
  pageListen(document, 'keydown', onKey);

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
    // ARO-01: sanitize before sheetVisual
    rawSvg: sanitizeRemoteSvg((shareCardPayload(card).tapp_icon) || '') || '',
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

// isValidStoreSourceRef lives in helpers.js (HTTPS / numeric id only)

function renderTappDetailView(body, tappId, name, desc, remoteVer, installed, localVer, needsUpdate, installPackage, installOmitted, storeSource) {
  var statusText = installed ? (needsUpdate ? lang.tappUpdateAvail : lang.tappInstalled) : lang.tappNotInstalled;
  var statusClass = installed ? (needsUpdate ? 'sheet-status-warn' : 'sheet-status-ok') : 'sheet-status-off';
  var hasDirectPkg = !!(installPackage && installPackage.manifest
    && installPackage.modules && Object.keys(installPackage.modules).length);
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
          modules: installPackage.modules,
          coreStyles: installPackage.coreStyles,
          pageStyles: installPackage.pageStyles,
          widgetStyles: installPackage.widgetStyles,
          pageTemplate: installPackage.pageTemplate,
          widgetTemplates: installPackage.widgetTemplates,
          widgetCss: installPackage.widgetCss,
          pageCss: installPackage.pageCss,
          i18n: installPackage.i18n,
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

      // ARO-05: never auto-fall back from store install to direct package.
      // Direct package is only used when no valid store_source was present (explicit path above).
      Tapp.tappList.install(installReq).then(function () {
        actionBtn.textContent = lang.installSuccess;
        setSheetBtnState(actionBtn, 'ok');
        actionBtn.removeEventListener('click', handleInstallClick);
      }).catch(function (err) {
        var msg = (err && err.message) ? String(err.message) : (lang.installFailed || 'Install failed');
        if (hasStoreSource && hasDirectPkg && installReq.source === 'store') {
          msg = (lang.tappStoreInstallFailedNoAutoDirect
            || 'Store install failed. Direct package was not installed automatically for safety. Re-share or install from a trusted catalog.')
            + (msg ? (' (' + msg + ')') : '');
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

// openBrewDetail / openLibraryDetail removed: card tap plays or opens the link directly.

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
