// ==================== Attachment Menu ====================
var _attachMenu = null;
// Overall attach cap (large channel files use chunked transfer under federation:files).
var MAX_ATTACH_SIZE = 100 * 1024 * 1024; // 100MB
// Inline base64 only under this raw size so JSON payload stays under backend budget.
var INLINE_ATTACH_MAX = 2 * 1024 * 1024; // 2 MiB raw
// Must match backend federation file_transfer DEFAULT_CHUNK_SIZE (1 MiB).
var TRANSFER_CHUNK_SIZE = 1024 * 1024;

function toggleAttachMenu() {
  if (_attachMenu) { closeAttachMenu(); return; }
  var wrap = $('input-bar');
  if (!wrap) return;
  // Not writable / no active conversation: attach disabled
  var btn = $('attach-btn');
  if (btn && btn.disabled) return;
  var locked = (typeof isChannelComposerLocked === 'function' && isChannelComposerLocked())
    || (typeof isRoomComposerLocked === 'function' && isRoomComposerLocked())
    || !!(state.activeKind === 'channel' && state.channelDetail && state.channelDetail.status === 'closed');
  if (!state.activeId || locked || state.sending) return;
  try { if (typeof closeStickerPanel === 'function') closeStickerPanel(); } catch (eSt) { /* ignore */ }
  try { if (typeof closeMentionPicker === 'function') closeMentionPicker(); } catch (eMen) { /* ignore */ }
  wrap.style.position = 'relative';
  if (btn) btn.classList.add('attach-btn-active');

  var menu = document.createElement('div');
  menu.className = 'attach-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML =
    '<button type="button" class="attach-menu-item" data-attach="sticker" role="menuitem"><div class="attach-menu-icon attach-icon-sticker"><svg viewBox="0 0 24 24" width="20" height="20" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="10" r="1.1" fill="currentColor"/><circle cx="15" cy="10" r="1.1" fill="currentColor"/><path d="M8.4 13.6c.95 1.4 2.2 2.15 3.6 2.15s2.65-.75 3.6-2.15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></div>' + esc(lang.stickerBtn || lang.stickers || 'Stickers') + '</button>'
    + '<button type="button" class="attach-menu-item" data-attach="image" role="menuitem"><div class="attach-menu-icon attach-icon-image"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>' + esc(lang.attachImage) + '</button>'
    + '<button type="button" class="attach-menu-item" data-attach="file" role="menuitem"><div class="attach-menu-icon attach-icon-file"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg></div>' + esc(lang.attachFile) + '</button>'
    + '<button type="button" class="attach-menu-item" data-attach="tapp" role="menuitem"><div class="attach-menu-icon attach-icon-tapp"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></div>' + esc(lang.attachTapp) + '</button>'
    + '<button type="button" class="attach-menu-item" data-attach="brew" role="menuitem"><div class="attach-menu-icon attach-icon-brew"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/></svg></div>' + esc(lang.attachBrew) + '</button>'
    + '<button type="button" class="attach-menu-item" data-attach="library" role="menuitem"><div class="attach-menu-icon attach-icon-library"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg></div>' + esc(lang.attachLibrary) + '</button>'
    + '<button type="button" class="attach-menu-item" data-attach="report" role="menuitem"><div class="attach-menu-icon attach-icon-report"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg></div>' + esc(lang.attachReport) + '</button>';

  menu.addEventListener('click', function (e) {
    var item = e.target.closest('[data-attach]');
    if (!item) return;
    var type = item.dataset.attach;
    closeAttachMenu();
    if (type === 'sticker') {
      if (typeof openStickerPanel === 'function') openStickerPanel();
      return;
    }
    if (type === 'image') { var inp = $('attach-image-input'); if (inp) inp.click(); }
    else if (type === 'file') { var inp2 = $('attach-file-input'); if (inp2) inp2.click(); }
    else pickFedContent(type);
  });

  wrap.appendChild(menu);
  _attachMenu = menu;
  aroPlayEnter(menu, 'aro-menu-enter');

  // Close on outside click
  setTimeout(function () {
    pageListen(document, 'click', _attachOutsideClick);
  }, 0);
}

function _attachOutsideClick(e) {
  if (_attachMenu && !_attachMenu.contains(e.target) && e.target.id !== 'attach-btn' && !e.target.closest('#attach-btn')) {
    closeAttachMenu();
  }
}

function closeAttachMenu() {
  if (!_attachMenu) {
    var btnIdle = $('attach-btn');
    if (btnIdle) btnIdle.classList.remove('attach-btn-active');
    document.removeEventListener('click', _attachOutsideClick);
    return;
  }
  var menu = _attachMenu;
  _attachMenu = null;
  var btn = $('attach-btn');
  if (btn) btn.classList.remove('attach-btn-active');
  document.removeEventListener('click', _attachOutsideClick);
  // PE none first (aroDismiss also does this); leftover .aro-leaving must not eat clicks.
  try { menu.style.pointerEvents = 'none'; } catch (ePe) { /* ignore */ }
  aroDismiss(menu, { remove: true, ms: 120 });
}

function handleFileSelect(file, forceType) {
  if (!file) return;
  if (file.size > MAX_ATTACH_SIZE) {
    try { Tapp.ui.showNotification({ title: lang.fileTooLarge, type: 'error' }); } catch (e) { /* ignore */ }
    return;
  }
  var type = forceType || (file.type && file.type.indexOf('image/') === 0 ? 'image' : 'file');
  // Keep the File for chunked upload; dataURL preview only for images.
  if (type === 'image') {
    var reader = new FileReader();
    reader.onload = function () {
      setPendingAttach({ type: type, file: file, data: reader.result, name: file.name, size: file.size, mime: file.type || 'image/*' });
    };
    reader.onerror = function () {
      setPendingAttach({ type: type, file: file, name: file.name, size: file.size, mime: file.type || 'image/*' });
    };
    reader.readAsDataURL(file);
  } else {
    setPendingAttach({ type: type, file: file, name: file.name, size: file.size, mime: file.type || 'application/octet-stream' });
  }
}

function readFileAsDataURL(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = function () { reject(reader.error || new Error('read failed')); };
    reader.readAsDataURL(file);
  });
}

function arrayBufferToBase64(buffer) {
  var bytes = new Uint8Array(buffer);
  var binary = '';
  var step = 0x8000;
  for (var i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

/**
 * Chunked transfer for files above INLINE_ATTACH_MAX.
 * Supports both channel (DM) and room (group) via initiateTransfer / initiateRoomTransfer.
 */
/**
 * @param {object} [sendCtx] optional frozen { kind, id, quoteMsg } from doSend (ARO-03)
 */
async function sendChunkedFileTransfer(attach, text, replyTo, sendCtx) {
  var file = attach.file;
  if (!file) throw new Error('Missing file data');

  var destKind = (sendCtx && sendCtx.kind) || state.activeKind;
  var destId = (sendCtx && sendCtx.id) || state.activeId;
  var isRoom = destKind === 'room';
  var isChannel = destKind === 'channel';
  if (!isRoom && !isChannel) {
    throw new Error(lang.fileTooLarge || 'File too large');
  }
  if (!destId) throw new Error(lang.sendFail || 'No conversation');

  if (isChannel) {
    var chStatus = state.channelDetail && state.channelDetail.status;
    if (chStatus && chStatus !== 'active' && chStatus !== 'accepted') {
      throw new Error(lang.channelNotAccepted || 'Channel must be accepted first');
    }
    if (typeof Tapp.federation.initiateTransfer !== 'function') {
      throw new Error(lang.fileTooLarge || 'File too large');
    }
  } else if (typeof Tapp.federation.initiateRoomTransfer !== 'function') {
    throw new Error(lang.fileTooLargeRoom || lang.fileTooLarge || 'File too large for group');
  }
  if (typeof Tapp.federation.uploadChunk !== 'function') {
    throw new Error(lang.fileTooLarge || 'File too large');
  }

  try {
    Tapp.ui.showNotification({ title: lang.transferStarting || 'Uploading…', type: 'info' });
  } catch (e0) { /* ignore */ }

  var meta = {
    filename: attach.name,
    file_size: attach.size,
    mime_type: attach.mime || 'application/octet-stream',
  };
  // Always target frozen destId — never re-read state.activeId mid-upload
  var transfer = isRoom
    ? await Tapp.federation.initiateRoomTransfer(destId, meta)
    : await Tapp.federation.initiateTransfer(destId, meta);
  var transferId = transfer && transfer.transfer_id;
  if (!transferId) throw new Error('No transfer_id returned');

  // ARO-04 partial: stream chunks via file.slice instead of holding whole file twice
  var totalSize = file.size || attach.size || 0;
  var totalChunks = Math.max(1, Math.ceil(totalSize / TRANSFER_CHUNK_SIZE));
  var lastPct = -1;

  for (var i = 0; i < totalChunks; i++) {
    var start = i * TRANSFER_CHUNK_SIZE;
    var end = Math.min(start + TRANSFER_CHUNK_SIZE, totalSize);
    var sliceBuf = await file.slice(start, end).arrayBuffer();
    var slice = new Uint8Array(sliceBuf);
    var chunkData = arrayBufferToBase64(slice);
    await Tapp.federation.uploadChunk(transferId, {
      chunk_index: i,
      chunk_data: chunkData,
      chunk_size: slice.length,
    });
    var pct = Math.round(((i + 1) / totalChunks) * 100);
    if (pct >= lastPct + 20 || pct === 100) {
      lastPct = pct;
      try {
        var prog = (lang.transferProgress || 'Uploading… {pct}%').replace('{pct}', String(pct));
        Tapp.ui.showNotification({ title: prog, type: 'info' });
      } catch (e1) { /* ignore */ }
    }
  }

  var msgPayload = {
    filename: attach.name,
    size: attach.size,
    mime_type: attach.mime || 'application/octet-stream',
    transfer_id: transferId,
    text: text || '',
  };
  var quote = (sendCtx && sendCtx.quoteMsg) || state.quoteMsg;
  if (quote) {
    msgPayload.quote_sender = quote.sender;
    msgPayload.quote_text = quote.text;
    msgPayload.quote_id = quote.message_id;
  }
  var sendReq = { payload: msgPayload, message_type: 'file-meta' };
  if (replyTo) sendReq.reply_to = replyTo;
  if (isRoom) {
    await Tapp.federation.sendRoomMessage(destId, sendReq);
  } else {
    await Tapp.federation.sendMessage(destId, sendReq);
  }

  try {
    Tapp.ui.showNotification({ title: lang.transferComplete || 'File sent', type: 'success' });
  } catch (e2) { /* ignore */ }
}

/**
 * Handle WS transfer_progress / transfer_completed / transfer_cancelled for
 * inbound federated file transfers (and outbound multi-tab).
 */
function handleTransferWsEvent(data) {
  if (!data || !data.type) return;
  if (!state.transferUi) state.transferUi = {};
  var tid = data.transfer_id || data.transferId || '';
  if (tid) {
    state.transferUi[tid] = {
      status: data.status || data.type,
      progress: data.progress != null ? Number(data.progress) : (state.transferUi[tid] && state.transferUi[tid].progress) || 0,
      chunks_completed: data.chunks_completed,
      chunks_total: data.chunks_total,
      updatedAt: Date.now(),
    };
  }
  try {
    if (data.type === 'transfer_progress') {
      var pct = Math.round(Number(data.progress) || 0);
      // Throttle toasts: 25% steps only
      var key = tid + ':' + Math.floor(pct / 25);
      if (!state.transferUi._lastToastKey || state.transferUi._lastToastKey !== key) {
        if (pct > 0 && pct < 100) {
          state.transferUi._lastToastKey = key;
          var prog = (lang.transferProgress || 'Receiving… {pct}%').replace('{pct}', String(pct));
          Tapp.ui.showNotification({ title: prog, type: 'info' });
        }
      }
    } else if (data.type === 'transfer_completed') {
      Tapp.ui.showNotification({
        title: lang.transferReceived || lang.transferComplete || 'File ready',
        type: 'success',
      });
      // Reload messages so file-meta / ready status updates
      if (typeof pollMessages === 'function') pollMessages(true);
    } else if (data.type === 'transfer_cancelled') {
      Tapp.ui.showNotification({
        title: lang.transferCancelled || 'Transfer cancelled',
        type: 'info',
      });
    }
  } catch (e) { /* ignore toast errors */ }
}

function pickFedContent(type) {
  var icons = { tapp: SVG_ICONS.tapp, brew: SVG_ICONS.brew, library: SVG_ICONS.library, report: SVG_ICONS.report };
  var titles = { tapp: lang.selectTapp, brew: lang.selectBrew, library: lang.selectLibrary, report: lang.selectReport };

  if (type === 'tapp') { openTappPicker(icons, titles); return; }
  if (type === 'brew') { openBrewPicker(icons, titles); return; }
  if (type === 'library') { openLibraryPicker(icons, titles); return; }
  if (type === 'report') { openReportPicker(icons, titles); return; }
}

/* ----- Shared overlay helpers ----- */
function createPickerOverlay(type, icons, titles) {
  var overlay = document.createElement('div');
  overlay.className = 'picker-overlay';
  // Closed CSS default is display:none + PE none — open triad after append.
  overlay.style.display = 'none';
  overlay.style.pointerEvents = 'none';
  var visual = sheetVisual({ type: type, rawSvg: icons[type], fallback: SVG_ICONS.file });
  applySheetAccent(overlay, visual.accent);
  overlay.innerHTML =
    '<div class="picker-sheet" role="dialog" aria-modal="true" aria-label="' + esc(titles[type]) + '">'
    + '<div class="picker-header">'
    + '<div class="picker-header-icon">' + visual.icon + '</div>'
    + '<div class="picker-header-text">'
    + '<div class="picker-header-title">' + esc(titles[type]) + '</div>'
    + '<div class="picker-header-sub">' + esc(lang.pickerPickOne || '') + '</div>'
    + '</div>'
    + '<button type="button" class="picker-close-btn" aria-label="' + esc(lang.dismiss || lang.close || 'Close') + '">&times;</button>'
    + '</div>'
    + '<div class="picker-search"><input placeholder="' + esc(lang.pickerSearchPlaceholder) + '" aria-label="' + esc(lang.pickerSearchPlaceholder) + '" /></div>'
    + '<div class="picker-body"></div>'
    + '<div class="picker-footer">'
    + '<button type="button" class="picker-footer-btn picker-btn-cancel">' + esc(lang.pickerCancel) + '</button>'
    + '<button type="button" class="picker-footer-btn picker-btn-confirm" disabled>' + esc(lang.pickerConfirm) + '</button>'
    + '</div>'
    + '</div>';
  var dismissPicker = function () { dismissPickerOverlay(overlay); };
  overlay.querySelector('.picker-close-btn').addEventListener('click', dismissPicker);
  overlay.querySelector('.picker-btn-cancel').addEventListener('click', dismissPicker);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) dismissPicker(); });
  overlay.dataset.aroDismissable = '1';
  document.body.appendChild(overlay);
  if (typeof showAroOverlay === 'function') showAroOverlay(overlay);
  else {
    overlay.style.pointerEvents = 'auto';
    overlay.style.display = 'flex';
  }
  return overlay;
}

function showPickerLoading(body) {
  body.innerHTML = '<div class="picker-loading"><div class="picker-loading-spinner"></div>' + esc(lang.pickerLoading) + '</div>';
}
function showPickerEmpty(body) {
  body.innerHTML = '<div class="picker-empty">' + esc(lang.pickerEmpty) + '</div>';
}

/** getItems: array or () => array (avoids stale empty-list closures after async load). */
function bindPickerSearch(overlay, getItems, renderFn, filterFn) {
  var searchInput = overlay.querySelector('.picker-search input');
  if (!searchInput) return;
  var runFilter = typeof aroDebounce === 'function'
    ? aroDebounce(function () {
        var allItems = typeof getItems === 'function' ? getItems() : getItems;
        if (!allItems) allItems = [];
        var q = (searchInput.value || '').trim().toLowerCase();
        if (!q) { renderFn(allItems); return; }
        renderFn(allItems.filter(function (item) { return filterFn(item, q); }));
      }, 100)
    : null;
  searchInput.addEventListener('input', function () {
    if (runFilter) {
      runFilter();
      return;
    }
    var allItems = typeof getItems === 'function' ? getItems() : getItems;
    if (!allItems) allItems = [];
    var q = this.value.trim().toLowerCase();
    if (!q) { renderFn(allItems); return; }
    renderFn(allItems.filter(function (item) { return filterFn(item, q); }));
  });
}

function dismissPickerOverlay(overlay) {
  if (!overlay) return;
  // Seal PE immediately so a half-closed sheet never blocks the chat shell.
  try { overlay.style.pointerEvents = 'none'; } catch (ePe) { /* ignore */ }
  aroDismiss(overlay, { remove: true, ms: 170 });
}

function bindPickerItems(body, items, confirmBtn, onSelect) {
  bindFaviconFallbacks(body);
  body.querySelectorAll('.picker-item').forEach(function (el) {
    el.addEventListener('click', function () {
      body.querySelectorAll('.picker-item').forEach(function (e) { e.classList.remove('selected'); });
      el.classList.add('selected');
      onSelect(items[parseInt(el.dataset.idx)]);
      confirmBtn.disabled = false;
    });
  });
}

/* ----- Tapp picker (real list from SDK) ----- */
function openTappPicker(icons, titles) {
  var type = 'tapp';
  var overlay = createPickerOverlay(type, icons, titles);
  var body = overlay.querySelector('.picker-body');
  var confirmBtn = overlay.querySelector('.picker-btn-confirm');
  var selectedTapp = null;
  var allTapps = [];

  showPickerLoading(body);

  Tapp.tappList.list().then(function (tapps) {
    allTapps = tapps || [];
    renderTappItems(allTapps);
  }).catch(function () { showPickerEmpty(body); });

  function renderTappItems(items) {
    if (!items.length) { showPickerEmpty(body); return; }
    body.innerHTML = items.map(function (t, i) {
      var meta = t.version || '';
      if (t.status) meta += (meta ? ' · ' : '') + t.status;
      var tv = sheetVisual({ rawSvg: t.iconSvg || '', favicon: t.icon || '', fallback: SVG_ICONS.tapp });
      return '<button type="button" class="picker-item" data-idx="' + i + '">'
        + '<div class="picker-item-icon"' + sheetVisualAttrs(tv, 'tapp') + '>' + tv.icon + '</div>'
        + '<div class="picker-item-body"><div class="picker-item-name">' + esc(t.name) + '</div>'
        + '<div class="picker-item-meta">' + esc(t.id + (meta ? ' · ' + meta : '')) + '</div>'
        + (t.description ? '<div class="picker-item-meta">' + esc(t.description) + '</div>' : '')
        + '</div><div class="picker-item-check">✓</div></button>';
    }).join('');
    bindPickerItems(body, items, confirmBtn, function (t) { selectedTapp = t; });
  }

  bindPickerSearch(overlay, function () { return allTapps; }, renderTappItems, function (t, q) {
    return (t.name || '').toLowerCase().indexOf(q) !== -1
      || (t.id || '').toLowerCase().indexOf(q) !== -1
      || (t.description || '').toLowerCase().indexOf(q) !== -1;
  });

  confirmBtn.addEventListener('click', function () {
    if (!selectedTapp) return;
    confirmBtn.disabled = true;
    var pending = {
      type: type,
      name: selectedTapp.name,
      desc: selectedTapp.description || selectedTapp.id,
      icon: icons[type],
      label: lang.attachTapp || 'Tapp',
      tappId: selectedTapp.id,
      tappVersion: selectedTapp.version || '',
      tappIcon: selectedTapp.iconSvg || selectedTapp.icon || ''
    };
    // P0: resolve portable store catalog URL so peer installFromStore works.
    // (InstallFromStoreRequest.source is catalog URL/id — NEVER the mode "store".)
    // Optional: direct package for offline/custom as secondary path.
    var finish = function () {
      setPendingAttach(pending);
      dismissPickerOverlay(overlay);
    };
    var resolveStore = (typeof Tapp.tappList !== 'undefined' && typeof Tapp.tappList.resolveStoreSource === 'function')
      ? Tapp.tappList.resolveStoreSource(selectedTapp.id).then(function (res) {
          if (res && res.storeSource) {
            pending.storeSource = res.storeSource;
            pending.storeSourceMatched = !!res.matchedApp;
          }
        }).catch(function (e) {
          console.warn('[Aro] resolveStoreSource failed', e);
        })
      : Promise.resolve();
    // Package snapshot for reliability (storeSource remains P0). Cap under
    // channel/room 32 MiB payload + bridge envelope (bridge / backend).
    // Keep package modest: room multi-recipient E2E + JSON envelope easily exceeds 32 MiB.
    // Store catalog URL is the primary install path; package is best-effort offline fallback.
    var TAPP_SHARE_PACKAGE_MAX = 8 * 1024 * 1024;
    var resolvePkg = (typeof Tapp.tappList !== 'undefined' && typeof Tapp.tappList.getInstallPackage === 'function')
      ? Tapp.tappList.getInstallPackage(selectedTapp.id, { maxBytes: TAPP_SHARE_PACKAGE_MAX })
          .then(function (pkgRes) {
            if (pkgRes && pkgRes.package) {
              pending.installPackage = pkgRes.package;
            } else if (pkgRes && pkgRes.reason) {
              pending.installPackageOmitted = pkgRes.reason;
            }
          })
          .catch(function (e) {
            console.warn('[Aro] getInstallPackage failed; store-only share', e);
            pending.installPackageOmitted = 'fetch_failed';
          })
      : Promise.resolve();
    Promise.all([resolveStore, resolvePkg]).then(finish).catch(finish);
  });
}

/* ----- Brew picker (real list from SDK) ----- */
function openBrewPicker(icons, titles) {
  var type = 'brew';
  var overlay = createPickerOverlay(type, icons, titles);
  var body = overlay.querySelector('.picker-body');
  var confirmBtn = overlay.querySelector('.picker-btn-confirm');
  var selectedBrew = null;
  var allBrews = [];

  showPickerLoading(body);

  Tapp.brewList.list({ limit: 50 }).then(function (res) {
    allBrews = (res && res.items) || [];
    renderBrewItems(allBrews);
  }).catch(function () { showPickerEmpty(body); });

  function renderBrewItems(items) {
    if (!items.length) { showPickerEmpty(body); return; }
    body.innerHTML = items.map(function (b, i) {
      var meta = b.source_name || '';
      if (b.author) meta += (meta ? ' · ' : '') + b.author;
      if (b.published_at) meta += (meta ? ' · ' : '') + new Date(b.published_at).toLocaleDateString();
      var bv = sheetVisual({ favicon: b.source_icon || '', slug: b.source_name || '', fallback: SVG_ICONS.brew });
      return '<button type="button" class="picker-item" data-idx="' + i + '">'
        + '<div class="picker-item-icon"' + sheetVisualAttrs(bv, 'brew') + '>' + bv.icon + '</div>'
        + '<div class="picker-item-body"><div class="picker-item-name">' + esc(b.title) + '</div>'
        + (meta ? '<div class="picker-item-meta">' + esc(meta) + '</div>' : '')
        + (b.summary ? '<div class="picker-item-meta">' + esc(b.summary) + '</div>' : '')
        + '</div><div class="picker-item-check">✓</div></button>';
    }).join('');
    bindPickerItems(body, items, confirmBtn, function (b) { selectedBrew = b; });
  }

  bindPickerSearch(overlay, function () { return allBrews; }, renderBrewItems, function (b, q) {
    return (b.title || '').toLowerCase().indexOf(q) !== -1
      || (b.author || '').toLowerCase().indexOf(q) !== -1
      || (b.source_name || '').toLowerCase().indexOf(q) !== -1
      || (b.summary || '').toLowerCase().indexOf(q) !== -1;
  });

  confirmBtn.addEventListener('click', function () {
    if (!selectedBrew) return;
    var desc = selectedBrew.source_name || '';
    if (selectedBrew.author) desc += (desc ? ' · ' : '') + selectedBrew.author;
    // Source mark travels with the message so the receiver renders the site's
    // own icon without re-fetching a brew they may not have.
    setPendingAttach({
      type: type,
      name: selectedBrew.title,
      desc: desc,
      icon: icons[type],
      label: lang.attachBrew || 'Brew',
      brewId: selectedBrew.id,
      brewLink: selectedBrew.link,
      sourceIcon: selectedBrew.source_icon || '',
      sourceName: selectedBrew.source_name || '',
    });
    dismissPickerOverlay(overlay);
  });
}

/* ----- Library picker (platform data) ----- */
/**
 * Resolve stable platform slug for getData / cache paths.
 * listEnabled maps id/key → slug; keep defensive fallbacks for older hosts.
 */
function platformSlug(p) {
  if (!p) return '';
  if (p.key) return String(p.key);
  if (p.slug) return String(p.slug);
  // Skip pure numeric PKs — getData needs the stable slug (steam), not "3".
  // Prefer [0-9] over digit-class escapes: this block is embedded in a template string.
  if (p.id != null && p.id !== '' && !/^[0-9]+$/.test(String(p.id))) return String(p.id);
  return p.id != null ? String(p.id) : '';
}

/** Build a chat-safe library item snapshot (never id-only / blank title). */
function buildLibraryShareSnapshot(item, platformId) {
  var title = '';
  var contentType = '';
  var image = '';
  var itemId = '';
  var description = '';
  var meta = item && item.metadata && typeof item.metadata === 'object' ? item.metadata : null;
  if (item) {
    title = String(item.title || item.name || item.username || '').trim();
    contentType = String(item.type || item.content_type || item.subject_type || '').trim().toLowerCase();
    if (contentType === 'bangumi') contentType = 'anime';
    if (contentType === 'games') contentType = 'game';
    image = String(item.image || item.cover || item.display_image || item.thumbnail || '').trim();
    if (!image && meta) {
      image = String(meta.image || meta.cover || meta.display_image || '').trim();
    }
    if (!image && (platformId === 'steam' || item.platform === 'steam')) {
      var appid = (item.appid != null ? item.appid : (meta && meta.appid)) || item.id;
      if (appid != null && String(appid).match(/^\d+$/)) {
        image = 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + appid + '/header.jpg';
      }
    }
    if (image.indexOf('http://') === 0) image = 'https://' + image.slice(7);
    itemId = item.id != null && item.id !== ''
      ? String(item.id)
      : (item.subject_id != null ? String(item.subject_id)
        : (item.title_id != null ? String(item.title_id)
          : (item.appid != null ? String(item.appid)
            : (meta && meta.appid != null ? String(meta.appid)
              : (meta && meta.bvid ? String(meta.bvid)
                : (meta && meta.season_id != null ? String(meta.season_id) : ''))))));
    description = String(item.description || item.summary || '').trim();
  }
  if (!title) title = itemId || (lang.shareUntitled || 'Untitled');
  var platform = platformId ? String(platformId) : '';
  var descParts = [];
  if (platform) descParts.push(platform);
  if (contentType) descParts.push(contentType);
  if (meta) {
    if (meta.playtime != null && meta.playtime !== '') descParts.push(String(meta.playtime) + ' min');
    else if (item && item.playtime != null) descParts.push(String(item.playtime) + ' min');
    if (meta.rate != null) descParts.push('★ ' + meta.rate);
    else if (meta.score != null) descParts.push('★ ' + meta.score);
  } else if (item) {
    if (item.score !== undefined && item.score !== null) descParts.push('★ ' + item.score);
    if (item.rate !== undefined && item.rate !== null) descParts.push('★ ' + item.rate);
    if (item.year) descParts.push(String(item.year));
  }
  if (!description) description = descParts.join(' · ');
  else if (descParts.length) description = descParts.join(' · ') + (description ? ' · ' + description : '');
  // Structured sender stats travel alongside the text snapshot so the recipient
  // renders the media card (playtime / watch progress / rating) without refetch.
  var statSource = {};
  if (item) { for (var ik in item) if (Object.prototype.hasOwnProperty.call(item, ik)) statSource[ik] = item[ik]; }
  if (meta) { for (var mk in meta) if (Object.prototype.hasOwnProperty.call(meta, mk)) statSource[mk] = meta[mk]; }
  var stats = extractLibraryStats(contentType || (item && item.type) || '', statSource);
  var music = extractMusicMeta(statSource);
  // Prefer platform HTML urls when the item already carries one.
  var externalUrl = '';
  if (meta) {
    externalUrl = String(meta.html_url || meta.url || meta.link || meta.external_url || '').trim();
  }
  if (!externalUrl && item) {
    externalUrl = String(item.html_url || item.url || item.link || item.external_url || '').trim();
  }
  // GitHub full_name often lives on the item itself
  if (!itemId && meta && meta.full_name) itemId = String(meta.full_name);
  if (!itemId && item && item.full_name) itemId = String(item.full_name);
  var snap = {
    title: title,
    description: description,
    platform_id: platform,
    item_id: itemId,
    image: image,
    content_type: contentType || 'library',
    playtime_min: stats.playtimeMin,
    rating: stats.rating,
    progress_cur: stats.progressCur,
    progress_total: stats.progressTotal,
    artist: music.artist,
    album: music.album,
    external_url: externalUrl || '',
  };
  if (!snap.external_url) {
    snap.external_url = libraryExternalUrl(snap) || '';
  }
  return snap;
}

function openLibraryPicker(icons, titles) {
  var type = 'library';
  var overlay = createPickerOverlay(type, icons, titles);
  var sheet = overlay.querySelector('.picker-sheet');
  var body = overlay.querySelector('.picker-body');
  var confirmBtn = overlay.querySelector('.picker-btn-confirm');
  var selectedItem = null;

  showPickerLoading(body);

  // Insert platform tabs before search
  var searchDiv = overlay.querySelector('.picker-search');
  var tabsDiv = document.createElement('div');
  tabsDiv.className = 'picker-tabs';
  sheet.insertBefore(tabsDiv, searchDiv);

  var allItems = [];
  var activePlatform = null;

  Tapp.platform.listEnabled().then(function (platforms) {
    if (!platforms || !platforms.length) {
      body.innerHTML = '<div class="picker-empty">' + esc(lang.libraryPickerEmpty || lang.pickerEmpty) + '</div>';
      return;
    }
    tabsDiv.innerHTML = platforms.map(function (p) {
      var slug = platformSlug(p);
      return '<button class="picker-tab" data-pid="' + esc(slug) + '">' + (p.icon && p.icon.length <= 4 ? '<span style="margin-right:3px">' + esc(p.icon) + '</span>' : '') + esc(p.name || slug) + '</button>';
    }).join('');
    selectPlatform(platformSlug(platforms[0]));
    tabsDiv.addEventListener('click', function (e) {
      var tab = e.target.closest('.picker-tab');
      if (!tab) return;
      selectPlatform(tab.dataset.pid);
    });
  }).catch(function () {
    body.innerHTML = '<div class="picker-empty">' + esc(lang.libraryPickerLoadFail || lang.loadFail || lang.pickerEmpty) + '</div>';
  });

  function selectPlatform(pid) {
    activePlatform = pid;
    allItems = [];
    selectedItem = null;
    confirmBtn.disabled = true;
    tabsDiv.querySelectorAll('.picker-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.pid === pid);
    });
    showPickerLoading(body);
    // getData expects stable slug (steam), not numeric PK
    Tapp.platform.getData(pid, { limit: 50 }).then(function (res) {
      // Host may return { items }, { data: { items } }, or a bare array.
      var root = res && res.data && typeof res.data === 'object' ? res.data : res;
      var list = [];
      if (Array.isArray(root)) list = root;
      else if (root && Array.isArray(root.items)) list = root.items;
      else if (res && Array.isArray(res.items)) list = res.items;
      allItems = list;
      renderLibraryItems(allItems);
    }).catch(function (err) {
      console.error('[Aro] library getData failed', pid, err);
      body.innerHTML = '<div class="picker-empty">' + esc(lang.libraryPickerLoadFail || lang.loadFail || lang.pickerEmpty) + '</div>';
    });
  }

  function libraryItemCover(item) {
    if (!item) return '';
    var m = item.metadata || {};
    var cover = item.image || item.cover || item.display_image || item.thumbnail
      || m.image || m.cover || '';
    // Legacy steam filters only kept playtime — rebuild CDN art from appid.
    if (!cover && (item.platform === 'steam' || activePlatform === 'steam')) {
      var appid = item.appid || m.appid || item.id;
      if (appid != null && String(appid).match(/^\d+$/)) {
        cover = 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + appid + '/header.jpg';
      }
    }
    if (cover && String(cover).indexOf('http://') === 0) {
      cover = 'https://' + String(cover).slice(7);
    }
    return cover;
  }

  function libraryItemMeta(item) {
    var meta = item.platform || activePlatform || '';
    var itemType = item.type || item.content_type || '';
    if (itemType && itemType !== 'library' && itemType !== 'item') {
      meta += (meta ? ' · ' : '') + itemType;
    }
    var m = item.metadata || {};
    if (item.score !== undefined && item.score !== null) meta += (meta ? ' · ' : '') + '★ ' + item.score;
    else if (m.rate != null) meta += (meta ? ' · ' : '') + '★ ' + m.rate;
    else if (m.score != null) meta += (meta ? ' · ' : '') + '★ ' + m.score;
    if (item.year) meta += (meta ? ' · ' : '') + item.year;
    else {
      var pt = m.playtime != null && m.playtime !== '' ? m.playtime : item.playtime;
      if (pt != null && pt !== '') {
        var mins = Number(pt);
        if (isFinite(mins) && mins > 0) {
          meta += (meta ? ' · ' : '') + (mins >= 60
            ? (Math.round(mins / 60) + 'h')
            : (Math.round(mins) + 'm'));
        } else {
          meta += (meta ? ' · ' : '') + String(pt);
        }
      }
    }
    if (m.progress) meta += (meta ? ' · ' : '') + String(m.progress);
    return meta;
  }

  function renderLibraryItems(items) {
    if (!items.length) {
      body.innerHTML = '<div class="picker-empty">' + esc(lang.libraryPickerEmpty || lang.pickerEmpty) + '</div>';
      return;
    }
    body.innerHTML = items.map(function (item, i) {
      var name = item.title || item.name || item.username || item.id || ('Item ' + (i + 1));
      var meta = libraryItemMeta(item);
      var cover = libraryItemCover(item);
      var lv = sheetVisual({ cover: safeIconUrl(cover), slug: item.platform || activePlatform || '', fallback: SVG_ICONS.library });
      return '<button type="button" class="picker-item" data-idx="' + i + '">'
        + '<div class="picker-item-icon"' + sheetVisualAttrs(lv, 'library') + '>' + lv.icon + '</div>'
        + '<div class="picker-item-body"><div class="picker-item-name">' + esc(name) + '</div>'
        + (meta ? '<div class="picker-item-meta">' + esc(meta) + '</div>' : '')
        + '</div><div class="picker-item-check">✓</div></button>';
    }).join('');
    bindPickerItems(body, items, confirmBtn, function (item) { selectedItem = item; });
  }

  bindPickerSearch(overlay, function () { return allItems; }, renderLibraryItems, function (item, q) {
    var hay = ((item.title || item.name || item.username || item.id || '') + ' ' + (item.type || item.content_type || '') + ' ' + (item.description || '')).toLowerCase();
    return hay.indexOf(q) !== -1;
  });

  confirmBtn.addEventListener('click', function () {
    if (!selectedItem) return;
    var snap = buildLibraryShareSnapshot(selectedItem, activePlatform);
    // Snapshot fields travel with the message so recipients render without re-fetch.
    setPendingAttach({
      type: type,
      name: snap.title,
      desc: snap.description,
      icon: icons[type],
      label: lang.attachLibrary,
      platformId: snap.platform_id,
      itemId: snap.item_id,
      image: snap.image,
      contentType: snap.content_type,
      summary: snap.title,
      playtimeMin: snap.playtime_min,
      rating: snap.rating,
      progressCur: snap.progress_cur,
      progressTotal: snap.progress_total,
      artist: snap.artist,
      album: snap.album,
      externalUrl: snap.external_url,
    });
    dismissPickerOverlay(overlay);
  });
}

/* ----- Report picker ----- */
function openReportPicker(icons, titles) {
  var type = 'report';
  var overlay = createPickerOverlay(type, icons, titles);
  var body = overlay.querySelector('.picker-body');
  var confirmBtn = overlay.querySelector('.picker-btn-confirm');
  var selectedReport = null;
  var allReports = [];

  showPickerLoading(body);

  Tapp.report.listReports().then(function (res) {
    allReports = (res && res.reports) || [];
    renderReportItems(allReports);
  }).catch(function () { showPickerEmpty(body); });

  function renderReportItems(reports) {
    if (!reports.length) { showPickerEmpty(body); return; }
    body.innerHTML = reports.map(function (r, i) {
      var name = r.summary || r.type || ('Report ' + (i + 1));
      var meta = '';
      if (r.platform) meta += r.platform;
      if (r.type) meta += (meta ? ' · ' : '') + r.type;
      if (r.createdAt) meta += (meta ? ' · ' : '') + new Date(r.createdAt).toLocaleDateString();
      var rv = sheetVisual({ slug: r.platform || '', fallback: SVG_ICONS.report });
      return '<button type="button" class="picker-item" data-idx="' + i + '">'
        + '<div class="picker-item-icon"' + sheetVisualAttrs(rv, 'report') + '>' + rv.icon + '</div>'
        + '<div class="picker-item-body"><div class="picker-item-name">' + esc(name) + '</div>'
        + (meta ? '<div class="picker-item-meta">' + esc(meta) + '</div>' : '')
        + '</div><div class="picker-item-check">✓</div></button>';
    }).join('');
    bindPickerItems(body, reports, confirmBtn, function (r) { selectedReport = r; });
  }

  bindPickerSearch(overlay, function () { return allReports; }, renderReportItems, function (r, q) {
    return ((r.summary || '') + ' ' + (r.type || '') + ' ' + (r.platform || '')).toLowerCase().indexOf(q) !== -1;
  });

  confirmBtn.addEventListener('click', function () {
    if (!selectedReport) return;
    var snap = buildReportShareSnapshot(selectedReport);
    var name = snap.summary || selectedReport.type || 'Report';
    var desc = snap.platform || '';
    if (selectedReport.createdAt) desc += (desc ? ' · ' : '') + new Date(selectedReport.createdAt).toLocaleDateString();
    // Snapshot fields travel with the message so recipients can render without getReport (user-scoped).
    setPendingAttach({
      type: type,
      name: name,
      desc: desc,
      icon: icons[type],
      label: lang.attachReport,
      reportId: snap.report_id,
      summary: snap.summary,
      platform: snap.platform,
      contentPreview: snap.content_preview,
    });
    dismissPickerOverlay(overlay);
  });
}

/**
 * Build a chat/federation-safe report snapshot.
 * Field names: report_id, summary, platform, content_preview.
 * Mirrored by frontend/src/tapp/utils/reportShareSnapshot.ts (unit-tested).
 * Does not include full report JSON — only what chat recipients need to render.
 */
function buildReportShareSnapshot(report) {
  var reportId = report && (report.id != null ? report.id : report.report_id);
  var platform = (report && (report.platform || report.platform_id)) || '';
  var summary = '';
  if (report) {
    if (report.summary) summary = String(report.summary);
    else if (report.report_title) summary = String(report.report_title);
    else if (report.type) summary = String(report.type);
  }
  var preview = '';
  if (report) {
    if (report.content_preview) preview = String(report.content_preview);
    else if (report.summary) preview = String(report.summary);
    else preview = formatReportContentBody(report.content, '');
  }
  preview = stripHtmlPreview(preview || '').trim();
  if (preview.length > 500) preview = preview.slice(0, 500);
  if (!summary) summary = preview ? preview.slice(0, 80) : 'Report';
  return {
    report_id: reportId != null && reportId !== '' ? String(reportId) : '',
    summary: summary,
    platform: platform ? String(platform) : '',
    content_preview: preview,
  };
}

/**
 * Format structured report content into readable plain text.
 * Never produces "[object Object]" — walks known fields (summary, insights, 综合分析).
 * Mirrored by formatReportContentBody in reportShareSnapshot.ts.
 */
function formatReportContentBody(content, fallbackPreview) {
  if (content == null || content === '') return fallbackPreview || '';
  if (typeof content === 'string') {
    var s = stripHtmlPreview(content).trim();
    return s || fallbackPreview || '';
  }
  if (typeof content === 'number' || typeof content === 'boolean') return String(content);
  if (typeof content !== 'object') return fallbackPreview || '';

  var parts = [];
  if (typeof content.summary === 'string' && content.summary.trim()) {
    parts.push(content.summary.trim());
  }
  if (Array.isArray(content.insights)) {
    for (var i = 0; i < content.insights.length; i++) {
      var item = content.insights[i];
      if (item == null || item === '') continue;
      if (typeof item === 'string' || typeof item === 'number') {
        parts.push('• ' + String(item));
      }
    }
  }
  var analysis = content['综合分析'];
  if (analysis && typeof analysis === 'object') {
    if (typeof analysis['总体画像'] === 'string' && analysis['总体画像'].trim()) {
      parts.push(String(analysis['总体画像']).trim());
    } else if (analysis.content && typeof analysis.content === 'object' && typeof analysis.content['总体画像'] === 'string') {
      parts.push(String(analysis.content['总体画像']).trim());
    }
  } else if (typeof analysis === 'string' && analysis.trim()) {
    parts.push(analysis.trim());
  }
  // Use fromCharCode so this survives PAGE_MOD template-literal embedding (avoids '\n' escape issues).
  var nl = String.fromCharCode(10);
  if (parts.length) return parts.join(nl);

  // Last resort: primitive key/value lines (not JSON dump, not [object Object])
  try {
    var keys = Object.keys(content);
    for (var k = 0; k < keys.length && k < 12; k++) {
      var v = content[keys[k]];
      if (v == null) continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        var line = String(v).trim();
        if (line) parts.push(keys[k] + ': ' + line);
      }
    }
  } catch (e) { /* ignore */ }
  if (parts.length) return parts.join(nl);
  return fallbackPreview || '';
}

/**
 * Structured HTML sections for report *detail* (owner getReport path).
 * Complementary to formatReportContentBody (plain text used for share snapshots).
 * Never esc() objects — only primitives/arrays of primitives.
 */
function formatReportFieldValueHtml(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    var s = String(value).trim();
    return s ? esc(s) : '';
  }
  if (Array.isArray(value)) {
    var items = value.filter(function (v) {
      return v != null && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
    }).map(function (v) { return String(v).trim(); }).filter(Boolean);
    if (!items.length) return '';
    return '<ul>' + items.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') + '</ul>';
  }
  return '';
}

function isSkippedReportContentKey(key) {
  return /^(id|platform|type|summary|created_?at|metadata|card_visuals|cardVisuals|theme_color|visual_style|decorative_emojis|card_subtitle|key_metric|theme_icon|icon_image_url|icon_prompt|background_elements|platform_reports)$/i.test(key)
    || key === '综合分析'
    || key === 'comprehensive_analysis';
}

function formatReportContentSectionsHtml(content) {
  if (content == null || content === '') return '';
  if (typeof content === 'string' || typeof content === 'number' || typeof content === 'boolean') {
    var plain = String(content).trim();
    return plain ? '<div class="sheet-text sheet-scroll">' + esc(plain) + '</div>' : '';
  }
  if (typeof content !== 'object') return '';

  var sections = [];
  function pushSection(label, bodyHtml) {
    if (!bodyHtml) return;
    sections.push(
      '<div class="sheet-section">'
      + (label ? '<div class="sheet-label">' + esc(label) + '</div>' : '')
      + bodyHtml
      + '</div>'
    );
  }

  if (Array.isArray(content.insights) && content.insights.length) {
    pushSection(
      lang.reportInsights || 'Insights',
      formatReportFieldValueHtml(content.insights)
    );
  }

  var analysis = content['综合分析'] || content.comprehensive_analysis;
  if (analysis && typeof analysis === 'object') {
    var analysisParts = [];
    Object.keys(analysis).forEach(function (k) {
      if (isSkippedReportContentKey(k)) return;
      var fieldHtml = formatReportFieldValueHtml(analysis[k]);
      if (!fieldHtml) return;
      analysisParts.push(
        '<div class="sheet-section" style="margin-bottom:10px">'
        + '<div class="sheet-label">' + esc(k) + '</div>'
        + '<div class="sheet-text">' + fieldHtml + '</div>'
        + '</div>'
      );
    });
    if (analysisParts.length) {
      pushSection(lang.reportAnalysis || 'Analysis', analysisParts.join(''));
    }
  } else if (typeof analysis === 'string' && analysis.trim()) {
    pushSection(lang.reportAnalysis || 'Analysis', '<div class="sheet-text">' + esc(analysis.trim()) + '</div>');
  }

  Object.keys(content).forEach(function (k) {
    if (isSkippedReportContentKey(k) || k === 'insights') return;
    var fieldHtml = formatReportFieldValueHtml(content[k]);
    if (!fieldHtml) return;
    pushSection(k, '<div class="sheet-text">' + fieldHtml + '</div>');
  });

  if (!sections.length) return '';
  return '<div class="sheet-section sheet-scroll" style="gap:14px">' + sections.join('') + '</div>';
}

/** Full structured detail HTML: summary / platform / type / date + sectioned content. */
function renderReportDetailBodyHtml(detail) {
  detail = detail || {};
  var content = detail.content;
  var summary = detail.summary || '';
  var platform = detail.platform || '';
  var type = detail.type || '';
  var createdAt = detail.createdAt || detail.created_at || '';

  if (content && typeof content === 'object') {
    if (!summary && content.summary) summary = content.summary;
    if (!platform && content.platform) platform = content.platform;
    if (!createdAt && (content.createdAt || content.created_at)) {
      createdAt = content.createdAt || content.created_at;
    }
  }

  var title = summary || detail.name || type || (lang.attachReport || 'Report');
  var metaParts = [];
  if (platform) metaParts.push(platform);
  if (type) metaParts.push(type);
  if (createdAt) {
    try {
      var d = new Date(createdAt);
      if (!isNaN(d.getTime())) metaParts.push(d.toLocaleDateString(currentLocale));
    } catch (e) { /* ignore */ }
  }

  var html = '<div class="sheet-pad">';
  html += sheetMetaHtml(metaParts);
  // When summary *is* the title the sheet header already shows it; only render
  // it here when the header title came from somewhere else (name / type).
  if (summary && summary !== title) {
    html += '<div class="sheet-section">'
      + '<div class="sheet-label">' + esc(lang.reportSummary || 'Summary') + '</div>'
      + '<div class="sheet-text">' + esc(summary) + '</div>'
      + '</div>';
  }

  var contentHtml = formatReportContentSectionsHtml(content);
  if (contentHtml) {
    html += contentHtml;
  } else if (!summary) {
    // Fall back to plain-text formatter when no sectionable fields.
    // .sheet-desc is pre-wrap, so newlines survive without <br> splicing.
    var plain = formatReportContentBody(content, '');
    if (plain) html += '<div class="sheet-desc sheet-scroll">' + esc(plain) + '</div>';
  }
  html += '</div>';
  return html;
}

function setPendingAttach(attach) {
  state.pendingAttach = attach;
  renderAttachPreview();
  updateSendState();
}

function clearPendingAttach() {
  state.pendingAttach = null;
  var preview = $('attach-preview');
  if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
  // Reset file inputs
  var fi = $('attach-file-input'); if (fi) fi.value = '';
  var ii = $('attach-image-input'); if (ii) ii.value = '';
  updateSendState();
}

function renderAttachPreview() {
  var preview = $('attach-preview');
  if (!preview || !state.pendingAttach) return;
  var a = state.pendingAttach;
  var html = '';
  if (a.type === 'image' && a.data) {
    html += '<div class="attach-preview-thumb"><img src="' + esc(a.data) + '" alt="" /></div>';
  } else if (a.type === 'file') {
    html += '<div class="attach-preview-icon attach-icon-file" style="background:rgba(245,158,11,.1)">' + SVG_ICONS.file + '</div>';
  } else {
    var iconBg = { tapp: 'rgba(var(--tapp-primary-rgb,100,100,255),.1)', brew: 'rgba(34,197,94,.1)', library: 'rgba(168,85,247,.1)', report: 'rgba(239,68,68,.1)' };
    html += '<div class="attach-preview-icon" style="background:' + (iconBg[a.type] || 'rgba(128,128,128,.06)') + '">' + (a.icon || SVG_ICONS.file) + '</div>';
  }
  html += '<div class="attach-preview-info">'
    + '<div class="attach-preview-name">' + esc(a.name || '') + '</div>'
    + '<div class="attach-preview-meta">' + (a.size ? formatFileSize(a.size) : (a.label || a.type)) + '</div>'
    + '</div>'
    + '<button type="button" class="attach-preview-remove" id="attach-remove" title="' + esc(lang.remove || lang.dismiss || 'Remove') + '" aria-label="' + esc(lang.remove || lang.dismiss || 'Remove') + '">&times;</button>';
  preview.innerHTML = html;
  preview.style.display = 'flex';
  aroPlayEnter(preview, 'aro-attach-enter');
  var removeBtn = $('attach-remove');
  if (removeBtn) removeBtn.addEventListener('click', clearPendingAttach);
}

// ==================== Stickers (inlined; keep before chat.js in pageModules) ====================
// Was page/stickers.js — store install only downloads download.page_modules from index;
// a separate stickers.js entry breaks install when index lags behind manifest.
// ==================== Stickers (personal + room shared pack) ====================
// Entry: #sticker-btn next to attach. Room pack uses federation.addRoomSticker /
// removeRoomSticker; personal pack is client-only (Tapp.storage / localStorage).

var STICKER_PANEL_MAX_H = 280;
var STICKER_PERSONAL_KEY = 'aro.personal_stickers';
var STICKER_PERSONAL_MAX = 48;
var EMOJI_RECENT_KEY = 'aro.emoji_recent';
var EMOJI_RECENT_MAX = 32;
/** Backend ROOM_STICKER_MAX_DATA_LEN = 120_000 */
var STICKER_DATA_MAX = 115000;
/** Backend ROOM_STICKER_MAX_COUNT = 50; owner/admin edit only */
var STICKER_ROOM_MAX = 50;
var _stickerPanelOpen = false;
var _stickerTab = 'emoji'; // 'emoji' | 'room' | 'mine'
var _emojiCat = 'smileys';
var _stickerBusy = false;
var _personalStickersCache = null;
var _stickerCtxMenu = null;
var _emojiRecentCache = null;

// Curated Unicode emoji packs (panel "表情" tab). Keep compact for page payload size.
var EMOJI_PACKS = [
  {
    id: 'smileys',
    icon: '😀',
    list: '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 👾 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾'.split(' '),
  },
  {
    id: 'gestures',
    icon: '👋',
    list: '👋 🤚 🖐 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁 👅 👄 💋 🩸'.split(' '),
  },
  {
    id: 'hearts',
    icon: '❤️',
    list: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉 ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️'.split(' '),
  },
  {
    id: 'animals',
    icon: '🐱',
    list: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🐣 🐥 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🪲 🪳 🦟 🦗 🕷 🕸 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🦧 🦣 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🦬 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐕‍🦺 🐈 🐈‍⬛ 🪶 🐓 🦃 🦤 🦚 🦜 🦢 🦩 🕊 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿 🦔'.split(' '),
  },
  {
    id: 'food',
    icon: '🍎',
    list: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🦴 🌭 🍔 🍟 🍕 🫓 🥪 🥙 🧆 🌮 🌯 🫔 🥗 🥘 🫕 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 🫖 ☕ 🍵 🧃 🥤 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🍾 🧊 🥄 🍴 🍽 🥣 🥡 🥢 🧂'.split(' '),
  },
  {
    id: 'travel',
    icon: '✈️',
    list: '🚗 🚕 🚙 🚌 🚎 🏎 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🦯 🦽 🦼 🛴 🚲 🛵 🏍 🛺 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩 💺 🛰 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥 🛳 ⛴ 🚢 ⚓ 🪝 ⛽ 🚧 🚦 🚥 🚏 🗺 🗿 🗽 🗼 🏰 🏯 🏟 🎡 🎢 🎠 ⛲ ⛱ 🏖 🏝 🏜 🌋 ⛰ 🏔 🗻 🏕 ⛺ 🏠 🏡 🏘 🏚 🏗 🏭 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛 ⛪ 🕌 🕍 🛕 🕋 ⛩ 🛤 🛣 🗾 🎑 🏞 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙 🌃 🌌 🌉 🌁'.split(' '),
  },
  {
    id: 'objects',
    icon: '💡',
    list: '⌚ 📱 📲 💻 ⌨️ 🖥 🖨 🖱 🖲 🕹 🗜 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽 🎞 📞 ☎️ 📟 📠 📺 📻 🎙 🎚 🎛 🧭 ⏱ ⏲ ⏰ 🕰 ⌛ ⏳ 📡 🔋 🔌 💡 🔦 🕯 🪔 🧯 🛢 💸 💵 💴 💶 💷 🪙 💰 💳 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒ 🛠 ⛏ 🪚 🔩 ⚙️ 🪤 🧱 🔫 💣 🧨 🪓 🔪 🗡 ⚔️ 🛡 🚬 ⚰️ 🪦 ⚱️ 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 🕳 🩹 🩺 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡 🧹 🪠 🧺 🧻 🚽 🚰 🚿 🛁 🛀 🧼 🧴 🧷 🧸 🪆 🖼 🪞 🪟 🛍 🛒 🎁 🎈 🎏 🎀 🪄 🪅 🎊 🎉 🎎 🏮 🎐 🧧 ✉️ 📩 📨 📧 💌 📥 📤 📦 🏷 🪧 📪 📫 📬 📭 📮 📯 📜 📃 📄 📑 🧾 📊 📈 📉 🗒 🗓 📆 📅 🗑 📇 🗃 🗳 🗄 📋 📁 📂 🗂 🗞 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🧷 🔗 📎 🖇 📐 📏 🧮 📌 📍 ✂️ 🖊 🖋 ✒️ 🖌 🖍 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓'.split(' '),
  },
  {
    id: 'symbols',
    icon: '✨',
    list: '❤️‍🔥 ❤️‍🩹 💯 💢 💬 👁️‍🗨️ 🗨 🗯 💭 💤 💮 ♨️ 💈 🛑 🕛 🕧 🕐 🕜 🕑 🕝 🕒 🕞 🕓 🕟 🕔 🕠 🕕 🕡 🕖 🕢 🕗 🕣 🕘 🕤 🕙 🕥 🕚 🕦 🌀 ♠️ ♥️ ♦️ ♣️ 🃏 🀄 🎴 🎭 🔇 🔈 🔉 🔊 📢 📣 📯 🔔 🔕 🎵 🎶 💹 🏧 🚮 🚰 ♿ 🚹 🚺 🚻 🚼 🚾 🛂 🛃 🛄 🛅 ⚠️ 🚸 ⛔ 🚫 🚳 🚭 🚯 🚱 🚷 📵 🔞 ☢️ ☣️ ⬆️ ↗️ ➡️ ↘️ ⬇️ ↙️ ⬅️ ↖️ ↕️ ↔️ ↩️ ↪️ ⤴️ ⤵️ 🔃 🔄 🔙 🔚 🔛 🔜 🔝 🛐 ⚛️ 🕉️ ✡️ ☸️ ☯️ ✝️ ☦️ ☪️ ☮️ 🕎 🔯 ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⛎ 🔀 🔁 🔂 ▶️ ⏩ ⏭ ⏯ ◀️ ⏪ ⏮ 🔼 ⏫ 🔽 ⏬ ⏸️ ⏹️ ⏺️ ⏏️ 🎦 🔅 🔆 📶 📳 📴 ♀️ ♂️ ⚧️ ✖️ ➕ ➖ ➗ ♾️ ‼️ ⁉️ ❓ ❔ ❕ ❗ 〰️ 💱 💲 ⚕️ ♻️ ⚜️ 🔱 📛 🔰 ⭕ ✅ ☑️ ✔️ ❌ ❎ ➰ ➿ 〽️ ✳️ ✴️ ❇️ ©️ ©️‍🔳 ©️ ®️ ™️ 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 🟫 ⬛ ⬜ ◼️ ◻️ ◾ ◽ ▪️ ▫️ 🔶 🔷 🔸 🔹 🔺 🔻 💠 🔘 🔳 🔲'.split(' '),
  },
];

function ensureStickerState() {
  if (!state.stickers) {
    state.stickers = { open: false, tab: 'emoji' };
  }
  return state.stickers;
}

function loadRecentEmojis() {
  if (_emojiRecentCache) return _emojiRecentCache;
  var list = [];
  try {
    var raw = localStorage.getItem(EMOJI_RECENT_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    }
  } catch (e0) { /* ignore */ }
  _emojiRecentCache = list.filter(function (e) {
    return typeof e === 'string' && e.length > 0 && e.length <= 8;
  }).slice(0, EMOJI_RECENT_MAX);
  return _emojiRecentCache;
}

function pushRecentEmoji(emoji) {
  if (!emoji) return;
  var list = loadRecentEmojis().filter(function (e) { return e !== emoji; });
  list.unshift(emoji);
  _emojiRecentCache = list.slice(0, EMOJI_RECENT_MAX);
  try {
    localStorage.setItem(EMOJI_RECENT_KEY, JSON.stringify(_emojiRecentCache));
  } catch (e1) { /* ignore */ }
}

function insertEmojiAtCursor(emoji) {
  var input = $('msg-input');
  if (!input || input.disabled) return;
  var start = typeof input.selectionStart === 'number' ? input.selectionStart : (input.value || '').length;
  var end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
  var val = input.value || '';
  input.value = val.slice(0, start) + emoji + val.slice(end);
  var pos = start + emoji.length;
  try {
    input.focus();
    input.setSelectionRange(pos, pos);
  } catch (eF) { /* ignore */ }
  if (typeof autoResizeInput === 'function') autoResizeInput(input);
  if (typeof updateSendState === 'function') updateSendState();
  pushRecentEmoji(emoji);
}

function isStickerPanelOpen() {
  var panel = $('sticker-panel');
  if (!panel) return false;
  if (_stickerPanelOpen) return true;
  return panel.classList.contains('is-open') && !panel.hidden;
}

function getRoomStickersList() {
  var rd = state.roomDetail || {};
  var shared = rd.shared_data_config || rd.sharedDataConfig || {};
  var list = shared.stickers;
  if (!Array.isArray(list)) return [];
  return list.filter(function (s) {
    return s && typeof s === 'object' && s.data && String(s.data).indexOf('data:image/') === 0;
  });
}

function applyRoomStickersToDetail(stickers) {
  if (!state.roomDetail) state.roomDetail = {};
  var shared = state.roomDetail.shared_data_config || state.roomDetail.sharedDataConfig || {};
  if (typeof shared !== 'object' || !shared) shared = {};
  shared.stickers = Array.isArray(stickers) ? stickers : [];
  state.roomDetail.shared_data_config = shared;
}

async function loadPersonalStickers() {
  if (_personalStickersCache) return _personalStickersCache;
  var list = [];
  try {
    if (Tapp.storage && typeof Tapp.storage.get === 'function') {
      var stored = await Tapp.storage.get(STICKER_PERSONAL_KEY);
      if (Array.isArray(stored)) list = stored;
    }
  } catch (e0) { /* ignore */ }
  if (!list.length) {
    try {
      var raw = localStorage.getItem(STICKER_PERSONAL_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed;
      }
    } catch (e1) { /* ignore */ }
  }
  _personalStickersCache = list.filter(function (s) {
    return s && s.id && s.data && String(s.data).indexOf('data:image/') === 0;
  }).slice(0, STICKER_PERSONAL_MAX);
  return _personalStickersCache;
}

async function savePersonalStickers(list) {
  _personalStickersCache = (list || []).slice(0, STICKER_PERSONAL_MAX);
  try {
    if (Tapp.storage && typeof Tapp.storage.set === 'function') {
      await Tapp.storage.set(STICKER_PERSONAL_KEY, _personalStickersCache);
    }
  } catch (e0) { /* ignore */ }
  try {
    localStorage.setItem(STICKER_PERSONAL_KEY, JSON.stringify(_personalStickersCache));
  } catch (e1) { /* ignore */ }
  return _personalStickersCache;
}

/**
 * Compress image dataURL to fit sticker budget (canvas JPEG/WebP prefer).
 * @returns {Promise<string>} data URL
 */
function compressStickerDataUrl(dataUrl) {
  return new Promise(function (resolve, reject) {
    if (!dataUrl || typeof dataUrl !== 'string') {
      reject(new Error('invalid image'));
      return;
    }
    if (dataUrl.length <= STICKER_DATA_MAX && /^data:image\/(png|jpe?g|gif|webp)/i.test(dataUrl)) {
      resolve(dataUrl);
      return;
    }
    var img = new Image();
    img.onload = function () {
      try {
        var maxSide = 320;
        var w = img.naturalWidth || img.width || 1;
        var h = img.naturalHeight || img.height || 1;
        var scale = Math.min(1, maxSide / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas'));
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        var out = '';
        var qualities = [0.82, 0.7, 0.55, 0.4, 0.28];
        for (var i = 0; i < qualities.length; i++) {
          out = canvas.toDataURL('image/jpeg', qualities[i]);
          if (out.length <= STICKER_DATA_MAX) break;
        }
        // Shrink further if still oversized
        var side = maxSide;
        while (out.length > STICKER_DATA_MAX && side > 96) {
          side = Math.floor(side * 0.75);
          scale = Math.min(1, side / Math.max(w, h));
          cw = Math.max(1, Math.round(w * scale));
          ch = Math.max(1, Math.round(h * scale));
          canvas.width = cw;
          canvas.height = ch;
          ctx.drawImage(img, 0, 0, cw, ch);
          out = canvas.toDataURL('image/jpeg', 0.55);
        }
        if (out.length > STICKER_DATA_MAX) {
          reject(new Error(lang.stickerTooLarge || 'Image too large for sticker'));
          return;
        }
        resolve(out);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = function () { reject(new Error('image load failed')); };
    img.src = dataUrl;
  });
}

/** Group sticker pack: only room owner/admin may add or remove. */
function canEditRoomStickerPack() {
  var myRole = (state.roomDetail && state.roomDetail.my_role) || '';
  if (myRole === 'owner' || myRole === 'admin') return true;
  // Fallback: match room owner_actor when my_role is missing/stale
  var me = state.localActorUrl
    || (typeof getIdentityActorUrl === 'function' ? getIdentityActorUrl() : '');
  var owner = state.roomDetail && state.roomDetail.owner_actor;
  if (!me || !owner) return false;
  return typeof sameActorUrl === 'function'
    ? sameActorUrl(owner, me)
    : String(owner) === String(me);
}

function canManageRoomSticker(sticker) {
  // Pack is owner/admin-managed; individual publisher can no longer remove.
  return canEditRoomStickerPack();
}

function closeStickerCtxMenu() {
  if (_stickerCtxMenu) {
    try { _stickerCtxMenu.remove(); } catch (e) { /* ignore */ }
    _stickerCtxMenu = null;
  }
  document.removeEventListener('click', _stickerCtxOutside, true);
}

function _stickerCtxOutside(e) {
  if (_stickerCtxMenu && !_stickerCtxMenu.contains(e.target)) closeStickerCtxMenu();
}

function openStickerCtxMenu(x, y, sticker, pack) {
  closeStickerCtxMenu();
  var menu = document.createElement('div');
  menu.className = 'sticker-ctx-menu';
  menu.setAttribute('role', 'menu');
  var items = [];
  items.push(
    '<button type="button" class="sticker-ctx-item" data-act="send" role="menuitem">'
    + esc(lang.stickerSend || 'Send') + '</button>'
  );
  if (pack === 'mine' || canManageRoomSticker(sticker)) {
    items.push(
      '<button type="button" class="sticker-ctx-item sticker-ctx-danger" data-act="remove" role="menuitem">'
      + esc(lang.stickerRemove || 'Remove') + '</button>'
    );
  }
  if (pack === 'mine' && state.activeKind === 'room' && canEditRoomStickerPack()) {
    var roomLocked = typeof isRoomComposerLocked === 'function' && isRoomComposerLocked();
    if (!roomLocked) {
      items.push(
        '<button type="button" class="sticker-ctx-item" data-act="share-room" role="menuitem">'
        + esc(lang.stickerShareToRoom || 'Share to group pack') + '</button>'
      );
    }
  }
  menu.innerHTML = items.join('');
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - 160)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - 120)) + 'px';
  menu.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    closeStickerCtxMenu();
    if (act === 'send') sendStickerNow(sticker);
    else if (act === 'remove') removeStickerItem(sticker, pack);
    else if (act === 'share-room') sharePersonalToRoom(sticker);
  });
  document.body.appendChild(menu);
  _stickerCtxMenu = menu;
  setTimeout(function () {
    document.addEventListener('click', _stickerCtxOutside, true);
  }, 0);
}

function toggleStickerPanel(ev) {
  if (ev) {
    try { ev.preventDefault(); ev.stopPropagation(); } catch (e0) { /* ignore */ }
  }
  if (isStickerPanelOpen()) {
    closeStickerPanel();
    return;
  }
  openStickerPanel();
}

function openStickerPanel() {
  if (!state.activeId || state.sending) return;
  if (typeof isChannelComposerLocked === 'function' && isChannelComposerLocked()) return;
  if (typeof isRoomComposerLocked === 'function' && isRoomComposerLocked()) return;
  try { if (typeof closeAttachMenu === 'function') closeAttachMenu(); } catch (e0) { /* ignore */ }
  try { if (typeof closeMentionPicker === 'function') closeMentionPicker(); } catch (eMen) { /* ignore */ }
  closeStickerCtxMenu();

  var panel = $('sticker-panel');
  if (!panel) return;
  var st = ensureStickerState();
  st.open = true;
  // Default to emoji; remember last sticker pack tab if user was there
  if (st.tab === 'room' || st.tab === 'mine' || st.tab === 'emoji') {
    _stickerTab = st.tab;
  } else {
    _stickerTab = 'emoji';
  }
  // Room pack only makes sense in rooms
  if (_stickerTab === 'room' && state.activeKind !== 'room') {
    _stickerTab = 'emoji';
  }
  st.tab = _stickerTab;
  _stickerPanelOpen = true;
  // Refresh room stickers from host when opening room pack
  if (_stickerTab === 'room' && state.activeKind === 'room' && state.activeId
    && typeof Tapp !== 'undefined' && Tapp.federation && typeof Tapp.federation.getRoom === 'function') {
    Tapp.federation.getRoom(state.activeId).then(function (detail) {
      var d = detail && (detail.data || detail);
      if (!d || state.activeId !== (d.room_id || state.activeId)) return;
      if (d.shared_data_config || d.avatar_url || d.name) {
        state.roomDetail = Object.assign({}, state.roomDetail || {}, d);
      }
      if (_stickerPanelOpen && _stickerTab === 'room') renderStickerPanel();
    }).catch(function () { /* ignore */ });
  }

  // Class-driven open (avoid fighting [hidden]{display:none!important})
  try { panel.removeAttribute('hidden'); } catch (eH) { /* ignore */ }
  panel.hidden = false;
  panel.classList.remove('aro-leaving');
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  panel.style.display = 'flex';
  panel.style.pointerEvents = 'auto';
  var btn = $('sticker-btn');
  if (btn) {
    btn.classList.add('sticker-btn-active');
    btn.setAttribute('aria-expanded', 'true');
  }
  // Lift composer chrome so panel sits above message scroll hits
  var floatWrap = document.querySelector('#chat-container .input-float-wrap');
  if (floatWrap) floatWrap.classList.add('sticker-open');
  applyStickerLabels();
  renderStickerPanel();
  if (typeof aroPlayEnter === 'function') {
    try { panel.classList.remove('aro-sticker-enter'); } catch (eA) { /* ignore */ }
    aroPlayEnter(panel, 'aro-sticker-enter');
  }
}

function closeStickerPanel() {
  _stickerPanelOpen = false;
  var st = ensureStickerState();
  st.open = false;
  closeStickerCtxMenu();
  var panel = $('sticker-panel');
  var btn = $('sticker-btn');
  if (btn) {
    btn.classList.remove('sticker-btn-active');
    btn.setAttribute('aria-expanded', 'false');
  }
  var floatWrap = document.querySelector('#chat-container .input-float-wrap');
  if (floatWrap) floatWrap.classList.remove('sticker-open');
  if (!panel) return;

  var seal = function () {
    panel.classList.remove('is-open', 'aro-sticker-enter', 'aro-leaving');
    panel.hidden = true;
    try { panel.setAttribute('hidden', ''); } catch (eH) { /* ignore */ }
    panel.setAttribute('aria-hidden', 'true');
    panel.style.display = 'none';
    panel.style.pointerEvents = 'none';
  };

  if (!panel.classList.contains('is-open') && (panel.style.display === 'none' || panel.hidden)) {
    seal();
    return;
  }
  panel.style.pointerEvents = 'none';
  if (typeof aroDismiss === 'function' && panel.style.display !== 'none' && !panel.hidden) {
    aroDismiss(panel, {
      ms: 150,
      onDone: seal,
    });
  } else {
    seal();
  }
}

function resetStickersOnConversationChange() {
  closeStickerPanel();
  var st = ensureStickerState();
  st.tab = 'emoji';
  _stickerTab = 'emoji';
}

function applyStickerLabels() {
  var btn = $('sticker-btn');
  if (btn) {
    var title = lang.stickerBtn || lang.emojiBtn || 'Emoji';
    btn.setAttribute('title', title);
    btn.setAttribute('aria-label', title);
  }
  var tabEmoji = $('sticker-tab-emoji');
  if (tabEmoji) tabEmoji.textContent = lang.stickerTabEmoji || lang.emoji || 'Emoji';
  var tabRoom = $('sticker-tab-room');
  if (tabRoom) tabRoom.textContent = lang.stickerTabRoom || 'Group';
  var tabMine = $('sticker-tab-mine');
  if (tabMine) tabMine.textContent = lang.stickerTabMine || 'Mine';
  var addBtn = $('sticker-add-btn');
  if (addBtn) {
    addBtn.setAttribute('aria-label', lang.stickerAdd || 'Add sticker');
    addBtn.setAttribute('title', lang.stickerAdd || 'Add');
  }
  var addLabel = document.querySelector('#sticker-add-btn .sticker-add-label');
  if (addLabel) addLabel.textContent = lang.stickerAdd || 'Add';
}

function setStickerTab(tab) {
  if (tab !== 'emoji' && tab !== 'room' && tab !== 'mine') return;
  if (tab === 'room' && state.activeKind !== 'room') return;
  _stickerTab = tab;
  ensureStickerState().tab = tab;
  renderStickerPanel();
}

function setEmojiCat(catId) {
  if (!catId) return;
  _emojiCat = catId;
  renderStickerPanel();
}

function getEmojiListForCat(catId) {
  if (catId === 'recent') return loadRecentEmojis();
  for (var i = 0; i < EMOJI_PACKS.length; i++) {
    if (EMOJI_PACKS[i].id === catId) return EMOJI_PACKS[i].list || [];
  }
  return EMOJI_PACKS[0] ? EMOJI_PACKS[0].list : [];
}

async function renderStickerPanel() {
  var panel = $('sticker-panel');
  if (!panel || !_stickerPanelOpen) return;

  // Always show all tabs; hide room pack only when not in a room
  var tabRoom = $('sticker-tab-room');
  if (tabRoom) tabRoom.style.display = state.activeKind === 'room' ? '' : 'none';
  document.querySelectorAll('[data-sticker-tab]').forEach(function (el) {
    var t = el.getAttribute('data-sticker-tab');
    var active = t === _stickerTab;
    el.classList.toggle('sticker-tab-active', active);
    el.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  var emojiCats = $('emoji-cats');
  var emojiGrid = $('emoji-grid');
  var stickerGrid = $('sticker-grid');
  var empty = $('sticker-empty');
  var addBtn = $('sticker-add-btn');
  var meta = $('sticker-meta');
  var isEmoji = _stickerTab === 'emoji';

  if (emojiCats) emojiCats.style.display = isEmoji ? 'flex' : 'none';
  if (emojiGrid) emojiGrid.style.display = isEmoji ? 'grid' : 'none';
  if (stickerGrid) stickerGrid.style.display = isEmoji ? 'none' : 'grid';
  // Group pack: only owner/admin see Add; personal pack: always.
  var canEditRoom = canEditRoomStickerPack();
  if (addBtn) {
    if (isEmoji) {
      addBtn.style.display = 'none';
    } else if (_stickerTab === 'room') {
      addBtn.style.display = canEditRoom ? 'inline-flex' : 'none';
    } else {
      addBtn.style.display = 'inline-flex';
    }
  }

  if (isEmoji) {
    if (empty) empty.style.display = 'none';
    // Category chips
    if (emojiCats) {
      var catsHtml = '';
      var recent = loadRecentEmojis();
      catsHtml += '<button type="button" class="emoji-cat-btn' + (_emojiCat === 'recent' ? ' is-active' : '') + '"'
        + ' data-emoji-cat="recent" title="' + esc(lang.emojiRecent || 'Recent') + '" aria-label="' + esc(lang.emojiRecent || 'Recent') + '">🕒</button>';
      EMOJI_PACKS.forEach(function (pack) {
        catsHtml += '<button type="button" class="emoji-cat-btn' + (_emojiCat === pack.id ? ' is-active' : '') + '"'
          + ' data-emoji-cat="' + esc(pack.id) + '" title="' + esc(pack.id) + '" aria-label="' + esc(pack.id) + '">'
          + esc(pack.icon) + '</button>';
      });
      emojiCats.innerHTML = catsHtml;
    }
    var emojis = getEmojiListForCat(_emojiCat);
    if (_emojiCat === 'recent' && (!emojis || !emojis.length)) {
      // Fall back to smileys when no recent use yet
      emojis = getEmojiListForCat('smileys');
    }
    if (emojiGrid) {
      var eHtml = '';
      (emojis || []).forEach(function (em) {
        if (!em) return;
        eHtml += '<button type="button" class="emoji-cell" data-emoji="' + esc(em) + '"'
          + ' aria-label="' + esc(em) + '">' + esc(em) + '</button>';
      });
      emojiGrid.innerHTML = eHtml;
    }
    if (meta) meta.textContent = '';
    return;
  }

  // Image sticker packs (room / mine)
  if (!stickerGrid) return;
  var list = [];
  if (_stickerTab === 'room' && state.activeKind === 'room') {
    list = getRoomStickersList();
  } else {
    list = await loadPersonalStickers();
  }

  if (!list.length) {
    stickerGrid.innerHTML = '';
    if (empty) {
      empty.style.display = 'flex';
      empty.dataset.role = 'empty';
      var emptyTitle = _stickerTab === 'room'
        ? (lang.stickerRoomEmptyTitle || lang.stickerTabRoom || 'Group stickers')
        : (lang.stickerMineEmptyTitle || lang.stickerTabMine || 'My stickers');
      var emptyBody = _stickerTab === 'room'
        ? (canEditRoom
          ? (lang.stickerRoomEmpty || 'No group stickers yet. Tap Add to upload for the room.')
          : (lang.stickerRoomEmptyMember || 'No group stickers yet. Only the owner or admins can add stickers.'))
        : (lang.stickerMineEmpty || 'No personal stickers yet. Tap Add to save on this device.');
      empty.innerHTML =
        '<div class="sticker-empty-icon" aria-hidden="true">'
        + '<svg viewBox="0 0 48 48" width="40" height="40" fill="none">'
        + '<circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="1.6" opacity=".35"/>'
        + '<circle cx="18" cy="20" r="2" fill="currentColor" opacity=".45"/>'
        + '<circle cx="30" cy="20" r="2" fill="currentColor" opacity=".45"/>'
        + '<path d="M16.5 28c2 3 4.6 4.5 7.5 4.5S29.5 31 31.5 28" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>'
        + '</svg></div>'
        + '<div class="sticker-empty-title">' + esc(emptyTitle) + '</div>'
        + '<div class="sticker-empty-text">' + esc(emptyBody) + '</div>';
    }
  } else {
    if (empty) empty.style.display = 'none';
    var pack = _stickerTab;
    var html = '';
    list.forEach(function (s, idx) {
      var src = typeof safeMessageImageUrl === 'function'
        ? safeMessageImageUrl(s.data)
        : (typeof safeIconUrl === 'function' ? safeIconUrl(s.data) : '');
      if (!src) {
        if (String(s.data).indexOf('data:image/') === 0 && s.data.length < STICKER_DATA_MAX + 5000) {
          src = s.data;
        }
      }
      if (!src) return;
      var name = s.name || '';
      html += '<button type="button" class="sticker-cell" data-sticker-idx="' + idx + '"'
        + ' data-sticker-id="' + esc(s.id || '') + '"'
        + ' title="' + esc(name || lang.stickerSend || 'Send') + '"'
        + ' aria-label="' + esc(name || lang.stickerSend || 'Send sticker') + '">'
        + '<img src="' + esc(src) + '" alt="" loading="lazy" draggable="false" />'
        + '</button>';
    });
    stickerGrid.innerHTML = html;
    stickerGrid._stickerList = list;
    stickerGrid._stickerPack = pack;
  }

  if (meta) {
    if (_stickerTab === 'room') {
      meta.textContent = (lang.stickerRoomMeta || '{n}/{max}')
        .replace('{n}', String(list.length))
        .replace('{max}', String(STICKER_ROOM_MAX));
    } else {
      meta.textContent = (lang.stickerMineMeta || '{n}')
        .replace('{n}', String(list.length));
    }
  }

  if (addBtn) {
    var roomFull = _stickerTab === 'room' && list.length >= STICKER_ROOM_MAX;
    addBtn.disabled = !!_stickerBusy || roomFull;
    addBtn.title = roomFull
      ? (lang.stickerRoomFull || 'Group pack is full')
      : (lang.stickerAdd || 'Add');
  }
}

/**
 * Immediately send sticker as an image message (does not use pending attach).
 */
async function sendStickerNow(sticker) {
  if (!sticker || !sticker.data || !state.activeId || state.sending || _stickerBusy) return;
  if (typeof isChannelComposerLocked === 'function' && isChannelComposerLocked()) return;
  if (typeof isRoomComposerLocked === 'function' && isRoomComposerLocked()) return;

  var ctx = {
    kind: state.activeKind,
    id: state.activeId,
    generation: state.openGen,
  };
  state.sending = true;
  _stickerBusy = true;
  if (typeof updateSendState === 'function') updateSendState();

  try {
    var dataUrl = sticker.data;
    if (dataUrl.length > INLINE_ATTACH_MAX) {
      // Stickers should already be small; re-compress if needed
      dataUrl = await compressStickerDataUrl(dataUrl);
    }
    var mime = 'image/png';
    var m = /^data:(image\/[a-z0-9.+-]+);/i.exec(dataUrl);
    if (m) mime = m[1];
    var filename = (sticker.name || 'sticker').replace(/[^\w.\-()+\u4e00-\u9fff]+/g, '_').slice(0, 80) + '.png';
    if (mime.indexOf('jpeg') >= 0 || mime.indexOf('jpg') >= 0) filename = filename.replace(/\.png$/i, '.jpg');
    else if (mime.indexOf('webp') >= 0) filename = filename.replace(/\.png$/i, '.webp');
    else if (mime.indexOf('gif') >= 0) filename = filename.replace(/\.png$/i, '.gif');

    var msgPayload = {
      data: dataUrl,
      filename: filename,
      mime_type: mime,
      size: Math.floor(dataUrl.length * 0.75),
      text: '',
      sticker: true,
    };
    var sendReq = { payload: msgPayload, message_type: 'image' };
    if (state.e2ePreferEncrypt !== false && typeof isE2eReadyForActive === 'function' && isE2eReadyForActive()) {
      sendReq.encrypt = true;
    }
    var sendRes;
    if (ctx.kind === 'channel') {
      sendRes = await Tapp.federation.sendMessage(ctx.id, sendReq);
    } else {
      sendRes = await Tapp.federation.sendRoomMessage(ctx.id, sendReq);
    }
    if (typeof noteDeliveryEnqueue === 'function') noteDeliveryEnqueue(sendRes);
    // Keep panel open for rapid-fire stickers
    if (state.activeKind === ctx.kind && state.activeId === ctx.id) {
      if (typeof pollMessages === 'function') await pollMessages(true);
    }
  } catch (e) {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerSendFail || lang.sendFail || 'Send failed', e);
    }
  } finally {
    state.sending = false;
    _stickerBusy = false;
    if (typeof updateSendState === 'function') updateSendState();
  }
}

async function removeStickerItem(sticker, pack) {
  if (!sticker || !sticker.id) return;
  if (pack === 'mine') {
    var list = await loadPersonalStickers();
    list = list.filter(function (s) { return s.id !== sticker.id; });
    await savePersonalStickers(list);
    renderStickerPanel();
    return;
  }
  if (state.activeKind !== 'room' || !state.activeId) return;
  if (typeof Tapp.federation.removeRoomSticker !== 'function') {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerApiMissing || 'Sticker API unavailable (update Myriad host)');
    }
    return;
  }
  if (!(await (typeof aroConfirm === 'function'
    ? aroConfirm(lang.stickerRemoveConfirm || 'Remove this sticker from the group pack?', true)
    : Promise.resolve(confirm(lang.stickerRemoveConfirm || 'Remove?'))))) {
    return;
  }
  _stickerBusy = true;
  try {
    var res = await Tapp.federation.removeRoomSticker(state.activeId, sticker.id);
    var stickers = (res && res.stickers) || (res && res.data && res.data.stickers) || null;
    if (Array.isArray(stickers)) applyRoomStickersToDetail(stickers);
    else {
      // optimistic
      applyRoomStickersToDetail(getRoomStickersList().filter(function (s) { return s.id !== sticker.id; }));
    }
    renderStickerPanel();
  } catch (e) {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerRemoveFail || lang.sendFail || 'Remove failed', e);
    }
  } finally {
    _stickerBusy = false;
  }
}

async function sharePersonalToRoom(sticker) {
  if (!sticker || !sticker.data || state.activeKind !== 'room' || !state.activeId) return;
  if (!canEditRoomStickerPack()) {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerRoomAdminOnly || 'Only the room owner or admins can edit the group sticker pack');
    }
    return;
  }
  if (typeof Tapp.federation.addRoomSticker !== 'function') {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerApiMissing || 'Sticker API unavailable (update Myriad host)');
    }
    return;
  }
  if (getRoomStickersList().length >= STICKER_ROOM_MAX) {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerRoomFull || 'Group pack is full');
    }
    return;
  }
  _stickerBusy = true;
  try {
    var data = await compressStickerDataUrl(sticker.data);
    var res = await Tapp.federation.addRoomSticker(state.activeId, {
      data: data,
      name: sticker.name || undefined,
    });
    var stickers = (res && res.stickers) || (res && res.data && res.data.stickers);
    if (Array.isArray(stickers)) applyRoomStickersToDetail(stickers);
    try {
      Tapp.ui.showNotification({
        title: lang.stickerShared || 'Added to group pack',
        type: 'success',
      });
    } catch (eN) { /* ignore */ }
    _stickerTab = 'room';
    ensureStickerState().tab = 'room';
    renderStickerPanel();
  } catch (e) {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerAddFail || lang.sendFail || 'Add failed', e);
    }
  } finally {
    _stickerBusy = false;
  }
}

function pickStickerImage() {
  if (_stickerBusy) return;
  if (_stickerTab === 'room' && !canEditRoomStickerPack()) {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerRoomAdminOnly || 'Only the room owner or admins can edit the group sticker pack');
    }
    return;
  }
  if (_stickerTab === 'room' && getRoomStickersList().length >= STICKER_ROOM_MAX) {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerRoomFull || 'Group pack is full');
    }
    return;
  }
  var inp = $('sticker-file-input');
  if (inp) {
    inp.value = '';
    inp.click();
  }
}

/**
 * Resolve a sticker destination when user adds from an image.
 * @param {'mine'|'room'|'ask'|'auto'|undefined} target
 * @returns {Promise<'mine'|'room'|null>}
 */
async function resolveStickerAddTarget(target) {
  if (target === 'mine') return 'mine';
  if (target === 'room') {
    return canEditRoomStickerPack() ? 'room' : 'mine';
  }
  // auto: follow open sticker tab, else room if admin in group, else mine
  if (target === 'auto' || !target) {
    if (_stickerPanelOpen && _stickerTab === 'room' && state.activeKind === 'room' && canEditRoomStickerPack()) {
      return 'room';
    }
    if (_stickerPanelOpen && _stickerTab === 'mine') return 'mine';
    if (state.activeKind === 'room' && canEditRoomStickerPack()) {
      return pickStickerAddTargetInteractive();
    }
    return 'mine';
  }
  if (target === 'ask') {
    if (state.activeKind !== 'room' || !canEditRoomStickerPack()) return 'mine';
    return pickStickerAddTargetInteractive();
  }
  return 'mine';
}

/** Small chooser: mine vs group pack. Returns null if cancelled. */
function pickStickerAddTargetInteractive() {
  return new Promise(function (resolve) {
    var canRoom = canEditRoomStickerPack() && state.activeKind === 'room';
    if (!canRoom) {
      resolve('mine');
      return;
    }
    var overlay = document.createElement('div');
    overlay.className = 'sticker-target-overlay';
    overlay.dataset.aroDismissable = '1';
    overlay.innerHTML =
      '<div class="sticker-target-sheet" role="dialog" aria-modal="true" aria-label="'
      + esc(lang.stickerAddWhere || 'Add sticker to') + '">'
      + '<div class="sticker-target-title">' + esc(lang.stickerAddWhere || 'Add sticker to') + '</div>'
      + '<button type="button" class="sticker-target-item" data-target="room">'
      + esc(lang.stickerTabRoom || 'Group pack') + '</button>'
      + '<button type="button" class="sticker-target-item" data-target="mine">'
      + esc(lang.stickerTabMine || 'Mine') + '</button>'
      + '<button type="button" class="sticker-target-cancel">' + esc(lang.pickerCancel || lang.cancel || 'Cancel') + '</button>'
      + '</div>';
    var done = function (val) {
      try { overlay.style.pointerEvents = 'none'; } catch (ePe) { /* ignore */ }
      if (typeof aroDismiss === 'function') {
        aroDismiss(overlay, { remove: true, ms: 140 });
      } else {
        try { overlay.remove(); } catch (eR) { /* ignore */ }
      }
      resolve(val);
    };
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) { done(null); return; }
      var btn = e.target.closest('[data-target]');
      if (btn) {
        done(btn.getAttribute('data-target') === 'room' ? 'room' : 'mine');
        return;
      }
      if (e.target.closest('.sticker-target-cancel')) done(null);
    });
    document.body.appendChild(overlay);
    if (typeof showAroOverlay === 'function') showAroOverlay(overlay);
    else {
      overlay.style.display = 'flex';
      overlay.style.pointerEvents = 'auto';
    }
  });
}

/**
 * Add any image (data URL, message bubble, viewer) into mine / room sticker pack.
 * @param {string} dataUrl
 * @param {{ target?: 'mine'|'room'|'ask'|'auto', name?: string, alsoMine?: boolean }} [opts]
 * @returns {Promise<boolean>}
 */
async function addImageDataAsSticker(dataUrl, opts) {
  opts = opts || {};
  if (!dataUrl || typeof dataUrl !== 'string') {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerNeedImage || 'Please choose an image');
    }
    return false;
  }
  if (_stickerBusy) return false;

  var dest = await resolveStickerAddTarget(opts.target);
  if (!dest) return false;

  if (dest === 'room') {
    if (state.activeKind !== 'room' || !state.activeId) {
      if (typeof notifyError === 'function') {
        notifyError(lang.stickerNeedRoom || 'Open a group chat to add group stickers');
      }
      return false;
    }
    if (!canEditRoomStickerPack()) {
      if (typeof notifyError === 'function') {
        notifyError(lang.stickerRoomAdminOnly || 'Only the room owner or admins can edit the group sticker pack');
      }
      return false;
    }
    if (getRoomStickersList().length >= STICKER_ROOM_MAX) {
      if (typeof notifyError === 'function') {
        notifyError(lang.stickerRoomFull || 'Group pack is full');
      }
      return false;
    }
    if (typeof Tapp.federation.addRoomSticker !== 'function') {
      if (typeof notifyError === 'function') {
        notifyError(lang.stickerApiMissing || 'Sticker API unavailable (update Myriad host)');
      }
      return false;
    }
  }

  _stickerBusy = true;
  if (typeof updateSendState === 'function') updateSendState();
  try {
    var compressed = await compressStickerDataUrl(dataUrl);
    var baseName = (opts.name || 'sticker').replace(/\.[^.]+$/, '').slice(0, 40);

    if (dest === 'room') {
      var res = await Tapp.federation.addRoomSticker(state.activeId, {
        data: compressed,
        name: baseName || undefined,
      });
      var stickers = (res && res.stickers) || (res && res.data && res.data.stickers);
      if (Array.isArray(stickers)) applyRoomStickersToDetail(stickers);
      // Keep a personal copy unless caller disables
      if (opts.alsoMine !== false) {
        try {
          var mine = await loadPersonalStickers();
          mine.unshift({
            id: 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            data: compressed,
            name: baseName || '',
            created_at: new Date().toISOString(),
          });
          await savePersonalStickers(mine);
        } catch (eP) { /* ignore */ }
      }
      try {
        Tapp.ui.showNotification({
          title: lang.stickerShared || 'Added to group pack',
          type: 'success',
        });
      } catch (eN) { /* ignore */ }
      if (_stickerPanelOpen) {
        _stickerTab = 'room';
        ensureStickerState().tab = 'room';
        renderStickerPanel();
      }
    } else {
      var list = await loadPersonalStickers();
      if (list.length >= STICKER_PERSONAL_MAX) {
        list = list.slice(0, STICKER_PERSONAL_MAX - 1);
      }
      list.unshift({
        id: 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        data: compressed,
        name: baseName || '',
        created_at: new Date().toISOString(),
      });
      await savePersonalStickers(list);
      try {
        Tapp.ui.showNotification({
          title: lang.stickerAdded || 'Sticker saved',
          type: 'success',
        });
      } catch (eN2) { /* ignore */ }
      if (_stickerPanelOpen) {
        _stickerTab = 'mine';
        ensureStickerState().tab = 'mine';
        renderStickerPanel();
      }
    }
    return true;
  } catch (e) {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerAddFail || lang.sendFail || 'Add failed', e);
    }
    return false;
  } finally {
    _stickerBusy = false;
    if (typeof updateSendState === 'function') updateSendState();
  }
}

/**
 * Extract image data URL from a chat message (inline image only).
 * @returns {string}
 */
function getMessageImageDataUrl(msg) {
  if (!msg) return '';
  var payload = msg.payload;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch (e) { payload = null; }
  }
  if (!payload || typeof payload !== 'object') return '';
  var data = payload.data || '';
  if (!data || typeof data !== 'string') return '';
  if (String(data).indexOf('data:image/') !== 0) return '';
  return data;
}

/**
 * Add sticker from a chat message image (context menu / viewer).
 * @param {object} msg
 * @param {{ target?: 'mine'|'room'|'ask'|'auto' }} [opts]
 */
async function addStickerFromMessage(msg, opts) {
  opts = opts || {};
  var dataUrl = getMessageImageDataUrl(msg);
  if (!dataUrl) {
    // Try visible DOM img as last resort (already sanitized when rendered)
    try {
      var mid = msg && msg.message_id;
      if (mid) {
        var row = document.querySelector('.msg-row[data-msg-id="' + mid.replace(/"/g, '') + '"] img.msg-image');
        if (row && row.src && String(row.src).indexOf('data:image/') === 0) {
          dataUrl = row.src;
        }
      }
    } catch (eDom) { /* ignore */ }
  }
  if (!dataUrl) {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerImageUnavailable || 'This image cannot be added as a sticker (no inline data)');
    }
    return false;
  }
  var name = '';
  try {
    var p = msg.payload;
    if (typeof p === 'string') p = JSON.parse(p);
    name = (p && (p.filename || p.name)) || '';
  } catch (eN) { /* ignore */ }
  return addImageDataAsSticker(dataUrl, {
    target: opts.target || 'ask',
    name: name,
  });
}

async function handleStickerFileSelected(file) {
  if (!file || !file.type || file.type.indexOf('image/') !== 0) {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerNeedImage || 'Please choose an image');
    }
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerTooLarge || 'Image too large');
    }
    return;
  }
  try {
    var dataUrl = await readFileAsDataURL(file);
    var baseName = (file.name || 'sticker').replace(/\.[^.]+$/, '').slice(0, 40);
    // File picker from panel: follow current tab (auto)
    await addImageDataAsSticker(dataUrl, {
      target: 'auto',
      name: baseName,
    });
  } catch (e) {
    if (typeof notifyError === 'function') {
      notifyError(lang.stickerAddFail || lang.sendFail || 'Add failed', e);
    }
  }
}

/** Apply remote stickers_changed WS event into roomDetail + refresh panel if open */
function handleStickersChangedEvent(ev) {
  if (!ev || !ev.roomId) return;
  if (state.activeKind === 'room' && state.activeId === ev.roomId) {
    if (Array.isArray(ev.stickers)) {
      applyRoomStickersToDetail(ev.stickers);
    }
    if (_stickerPanelOpen) renderStickerPanel();
  }
}

function bindStickerUi() {
  // Idempotent: re-entry must not stack listeners.
  if (bindStickerUi._bound) return;
  bindStickerUi._bound = true;

  // Delegate from chat shell so hits always reach the button (composer PE + re-renders).
  var chat = $('chat-container') || document;
  var onComposerClick = function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#sticker-btn') || (t.closest('.sticker-btn') && !t.closest('#sticker-panel'))) {
      e.preventDefault();
      e.stopPropagation();
      toggleStickerPanel(e);
      return;
    }
    if (t.closest('#sticker-add-btn') || t.closest('.sticker-add-btn')) {
      e.preventDefault();
      e.stopPropagation();
      pickStickerImage();
      return;
    }
    var tab = t.closest('[data-sticker-tab]');
    if (tab) {
      e.preventDefault();
      e.stopPropagation();
      setStickerTab(tab.getAttribute('data-sticker-tab'));
      return;
    }
    var catBtn = t.closest('[data-emoji-cat]');
    if (catBtn) {
      e.preventDefault();
      e.stopPropagation();
      setEmojiCat(catBtn.getAttribute('data-emoji-cat'));
      return;
    }
    var emojiCell = t.closest('.emoji-cell[data-emoji]');
    if (emojiCell) {
      e.preventDefault();
      e.stopPropagation();
      insertEmojiAtCursor(emojiCell.getAttribute('data-emoji') || emojiCell.textContent || '');
    }
  };
  if (typeof pageListen === 'function') {
    pageListen(chat, 'click', onComposerClick);
  } else {
    chat.addEventListener('click', onComposerClick);
  }

  var fileInp = $('sticker-file-input');
  if (fileInp && !fileInp.dataset.stickerBound) {
    fileInp.dataset.stickerBound = '1';
    fileInp.addEventListener('change', function () {
      if (this.files && this.files[0]) handleStickerFileSelected(this.files[0]);
    });
  }

  var grid = $('sticker-grid');
  if (grid && !grid.dataset.stickerBound) {
    grid.dataset.stickerBound = '1';
    grid.addEventListener('click', function (e) {
      var cell = e.target.closest('.sticker-cell');
      if (!cell || !grid._stickerList) return;
      var idx = parseInt(cell.getAttribute('data-sticker-idx'), 10);
      if (isNaN(idx) || idx < 0 || idx >= grid._stickerList.length) return;
      sendStickerNow(grid._stickerList[idx]);
    });
    grid.addEventListener('contextmenu', function (e) {
      var cell = e.target.closest('.sticker-cell');
      if (!cell || !grid._stickerList) return;
      e.preventDefault();
      var idx = parseInt(cell.getAttribute('data-sticker-idx'), 10);
      if (isNaN(idx) || idx < 0 || idx >= grid._stickerList.length) return;
      openStickerCtxMenu(e.clientX, e.clientY, grid._stickerList[idx], grid._stickerPack || _stickerTab);
    });
    var lpTimer = null;
    var lpCell = null;
    grid.addEventListener('touchstart', function (e) {
      var cell = e.target.closest('.sticker-cell');
      if (!cell) return;
      lpCell = cell;
      var touch = e.touches && e.touches[0];
      lpTimer = setTimeout(function () {
        if (!lpCell || !grid._stickerList) return;
        var idx = parseInt(lpCell.getAttribute('data-sticker-idx'), 10);
        if (isNaN(idx) || idx < 0 || idx >= grid._stickerList.length) return;
        var x = touch ? touch.clientX : 0;
        var y = touch ? touch.clientY : 0;
        openStickerCtxMenu(x, y, grid._stickerList[idx], grid._stickerPack || _stickerTab);
      }, 480);
    }, { passive: true });
    grid.addEventListener('touchend', function () {
      if (lpTimer) clearTimeout(lpTimer);
      lpTimer = null;
      lpCell = null;
    });
    grid.addEventListener('touchmove', function () {
      if (lpTimer) clearTimeout(lpTimer);
      lpTimer = null;
    }, { passive: true });
  }
}

