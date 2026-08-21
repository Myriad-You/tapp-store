var share = require('./scope.js');

// ==================== Rings list + detail ====================
// Extracted from views.js. Load before views.js.

// ==================== Rings View ====================
async function loadRings() {
  try {
    var res = await Tapp.federation.getRings();
    state.rings = (res && res.rings) || [];
    state.activeRingId = null;
    renderRingsSidebar();
    hideRingDetail();
  } catch (e) { console.error('[Aro] loadRings error:', e); }
}

function renderRingsSidebar() {
  var list = $('ring-list');
  if (!list) return;
  if (state.rings.length === 0) {
    list.innerHTML = '<div class="conv-empty conv-empty-fill"><span id="ring-empty-text">'
      + esc(lang.emptyRings || 'No rings yet')
      + '<br><span style="font-size:11px;opacity:.75">' + esc(lang.createRingTitle || '') + '</span></span></div>';
    return;
  }
  var q = normalizeSearchQuery((state.search && state.search.ring) || '');
  var rings = !q ? state.rings : state.rings.filter(function (ring) {
    return matchesSearch(q, [
      ring.ring_name,
      ring.ring_id,
      ring.ring_type,
      ringTypeLabel(ring.ring_type),
    ]);
  });
  if (rings.length === 0) {
    list.innerHTML = searchNoResultsHtml();
    return;
  }
  var typeIcons = { 'brew-recommend': SVG_ICONS.coffee, 'tapp-store': SVG_ICONS.puzzle, 'library-exchange': SVG_ICONS.library, 'instance-directory': SVG_ICONS.globe };
  var html = '';
  rings.forEach(function (ring) {
    var icon = typeIcons[ring.ring_type] || SVG_ICONS.ring;
    var name = ring.ring_name || ring.ring_id;
    var peerText = (ring.peer_count || 0) + ' ' + lang.peers;
    var activeClass = state.activeRingId === ring.ring_id ? ' conv-active' : '';
    html += '<button class="conv-item' + activeClass + '" data-ring-id="' + esc(ring.ring_id) + '">'
      + '<span class="conv-accent" aria-hidden="true"></span>'
      + '<div class="conv-avatar avatar-room" style="border-radius:12px;font-size:16px">' + icon + '</div>'
      + '<div class="conv-info">'
      + '<div class="conv-top"><span class="conv-name">' + esc(name) + '</span></div>'
      + '<div class="conv-bottom"><span class="conv-preview">' + esc(ringTypeLabel(ring.ring_type)) + ' · ' + esc(peerText) + '</span></div>'
      + '</div>'
      + '</button>';
  });
  list.innerHTML = html;
  list.querySelectorAll('.conv-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openRingDetail(btn.dataset.ringId);
    });
  });
}

function updateRingCreateCategoryVisibility() {
  var type = (typeof getAroSelectValue === 'function'
    ? getAroSelectValue('ring-type-select')
    : (($('ring-type-select') || {}).value)) || 'brew-recommend';
  var wrap = $('ring-brew-category-wrap');
  if (!wrap) return;
  if (type === 'brew-recommend') {
    wrap.style.display = 'flex';
    loadBrewCategoriesForRingCreate();
  } else {
    wrap.style.display = 'none';
  }
}

function loadBrewCategoriesForRingCreate() {
  var select = $('ring-brew-category-select');
  var freeText = $('ring-brew-category-input');
  if (!select) return;
  if (typeof initAroSelect === 'function') initAroSelect(select);
  // Keep the "all" option; rebuild the rest via custom select API
  var allLabel = (lang.ringBrewCategoryAll || 'All my categories');
  var baseOpts = [{ value: '', label: allLabel, id: 'ring-brew-category-all' }];
  if (typeof setAroSelectOptions === 'function') {
    setAroSelectOptions(select, baseOpts, '');
  }
  if (freeText) {
    freeText.value = '';
    freeText.style.display = 'none';
  }
  if (typeof Tapp === 'undefined' || !Tapp.brewList || typeof Tapp.brewList.categories !== 'function') {
    // Fallback: free-text only
    if (freeText) freeText.style.display = '';
    select.style.display = 'none';
    return;
  }
  select.style.display = '';
  Tapp.brewList.categories().then(function (cats) {
    var list = Array.isArray(cats) ? cats : (cats && cats.categories) || [];
    var opts = [{ value: '', label: allLabel, id: 'ring-brew-category-all' }];
    list.forEach(function (c) {
      var name = (c && (c.name || c)) || '';
      if (!name) return;
      opts.push({ value: name, label: name });
    });
    if (typeof setAroSelectOptions === 'function') {
      setAroSelectOptions(select, opts, '');
    }
    // If no categories from API, allow free-text
    if (list.length === 0 && freeText) {
      freeText.style.display = '';
    }
  }).catch(function () {
    if (freeText) freeText.style.display = '';
    select.style.display = 'none';
  });
}

async function doCreateRing() {
  if (!requireAdminAction()) return;
  var input = $('ring-name-input');
  var btn = $('create-ring-btn');
  if (!input) return;
  var name = input.value.trim();
  if (!name) return;
  var type = (typeof getAroSelectValue === 'function'
    ? getAroSelectValue('ring-type-select')
    : (($('ring-type-select') || {}).value)) || 'brew-recommend';
  var req = { name: name, ring_type: type };
  if (type === 'brew-recommend') {
    var catSelect = $('ring-brew-category-select');
    var catInput = $('ring-brew-category-input');
    var cat = '';
    if (catSelect && catSelect.style.display !== 'none') {
      cat = ((typeof getAroSelectValue === 'function'
        ? getAroSelectValue(catSelect)
        : catSelect.value) || '').trim();
    }
    if (!cat && catInput && catInput.style.display !== 'none') {
      cat = (catInput.value || '').trim();
    }
    if (cat) req.category = cat;
  }
  if (btn) { btn.disabled = true; btn.textContent = lang.creating; }
  try {
    await Tapp.federation.createRing(req);
    input.value = '';
    var catSel = $('ring-brew-category-select');
    if (catSel && typeof setAroSelectValue === 'function') setAroSelectValue(catSel, '', true);
    else if (catSel) catSel.value = '';
    var catIn = $('ring-brew-category-input');
    if (catIn) catIn.value = '';
    var d = $('ring-create-dialog');
    if (d) aroDismiss(d, { ms: 170 });
    loadRings();
  } catch (e) {
    notifyError(lang.createRingFail, e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = lang.createRingBtn; }
  }
}

async function doLeaveRing(ringId) {
  if (!requireAdminAction()) return;
  try {
    await Tapp.federation.leaveRing(ringId);
    hideRingDetail();
    loadRings();
  } catch (e) {
    notifyError(lang.leaveRingFail, e);
  }
}

/** Copy the active ring's id for sharing with another instance. */
async function copyRingId() {
  var ring = state.ringDetail;
  var ringId = (ring && ring.ring_id) || state.activeRingId || '';
  if (!ringId) {
    try { Tapp.ui.showNotification({ title: lang.copyFail, type: 'error' }); } catch (e0) {}
    return;
  }
  var ok = await copyTextToClipboard(ringId, { silent: true });
  try {
    Tapp.ui.showNotification({
      title: ok ? (lang.ringIdCopied || lang.copied) : lang.copyFail,
      message: ok ? ringId : undefined,
      type: ok ? 'success' : 'error',
    });
  } catch (e1) {}
}

// ==================== Ring Detail (inline panel) ====================
function openRingDetail(ringId) {
  state.activeRingId = ringId;
  state.ringDetail = null;
  state.ringPeers = [];
  // Update sidebar active
  var list = $('ring-list');
  if (list) list.querySelectorAll('.conv-item').forEach(function (btn) {
    btn.classList.toggle('conv-active', btn.dataset.ringId === ringId);
  });
  // Show detail panel
  $('ring-empty-state').style.display = 'none';
  var detail = $('ring-detail');
  if (detail) {
    detail.style.display = '';
    aroPlayEnter(detail, 'aro-panel-enter');
  }
  // Optimistic ring_id fill (full detail arrives from loadRingDetail)
  var idLabelEl = $('ring-id-label');
  if (idLabelEl) idLabelEl.textContent = lang.ringId || 'Ring ID';
  var idValueEl = $('ring-id-value');
  if (idValueEl) {
    idValueEl.textContent = ringId || '';
    idValueEl.setAttribute('title', ringId || '');
  }
  var idCopyBtn = $('ring-id-copy');
  if (idCopyBtn) {
    idCopyBtn.disabled = !ringId;
    idCopyBtn.setAttribute('title', lang.copy || 'Copy');
  }
  // Mobile
  $('ring-sidebar').classList.add('sidebar-hidden-mobile');
  var main = detail ? detail.closest('.panel-main') : null;
  if (main) {
    main.classList.add('panel-main-show-mobile');
    aroPlayEnter(main, 'aro-panel-enter');
  }
  loadRingDetail(ringId);
}

function hideRingDetail() {
  state.activeRingId = null;
  state.ringDetail = null;
  state.ringPeers = [];
  var detail = $('ring-detail');
  if (detail) {
    detail.style.display = 'none';
    detail.classList.remove('aro-panel-enter');
  }
  var empty = $('ring-empty-state');
  if (empty) {
    empty.style.display = '';
    aroPlayEnter(empty, 'aro-panel-enter');
  }
  var sidebar = $('ring-sidebar');
  if (sidebar) {
    sidebar.classList.remove('sidebar-hidden-mobile');
    aroPlayEnter(sidebar, 'aro-panel-enter');
  }
  var main = detail ? detail.closest('.panel-main') : null;
  if (main) main.classList.remove('panel-main-show-mobile');
}

async function loadRingDetail(ringId) {
  try {
    var results = await Promise.all([
      Tapp.federation.getRing(ringId),
      Tapp.federation.getRingPeers(ringId)
    ]);
    if (state.activeRingId !== ringId) return; // user closed
    state.ringDetail = results[0];
    state.ringPeers = (results[1] && results[1].peers) || [];
    renderRingDetail();
  } catch (e) {
    console.error('[Aro] loadRingDetail error:', e);
  }
}

function renderRingDetail() {
  var ring = state.ringDetail;
  if (!ring) return;
  var typeIcons = { 'brew-recommend': SVG_ICONS.coffee, 'tapp-store': SVG_ICONS.puzzle, 'library-exchange': SVG_ICONS.library, 'instance-directory': SVG_ICONS.globe };
  var iconEl = $('ring-detail-icon');
  if (iconEl) iconEl.innerHTML = typeIcons[ring.ring_type] || SVG_ICONS.ring;
  var nameEl = $('ring-detail-name');
  // Prefer display name; ring_id is always shown separately in the id bar
  if (nameEl) nameEl.textContent = ring.ring_name || ring.ring_id;
  var metaEl = $('ring-detail-meta');
  if (metaEl) {
    var parts = [];
    parts.push('<span class="meta-badge">' + esc(ringTypeLabel(ring.ring_type)) + '</span>');
    parts.push('<span class="meta-badge">' + esc(state.ringPeers.length + ' ' + lang.peers) + '</span>');
    var ringCat = ring.gossip_config && (ring.gossip_config.category || ring.gossip_config.brew_category);
    if (ringCat) {
      parts.push('<span class="meta-badge">' + esc(String(ringCat)) + '</span>');
    }
    if (ring.last_sync_at) {
      try { parts.push('<span class="meta-badge">' + esc(timeAgo(ring.last_sync_at)) + '</span>'); } catch (e) {}
    }
    metaEl.innerHTML = parts.join('');
  }

  // Always show ring_id (separate from title) for cross-instance sharing
  var ringId = ring.ring_id || state.activeRingId || '';
  var idLabelEl = $('ring-id-label');
  if (idLabelEl) idLabelEl.textContent = lang.ringId || 'Ring ID';
  var idValueEl = $('ring-id-value');
  if (idValueEl) {
    idValueEl.textContent = ringId;
    idValueEl.setAttribute('title', ringId);
  }
  var idCopyBtn = $('ring-id-copy');
  if (idCopyBtn) {
    idCopyBtn.disabled = !ringId;
    idCopyBtn.setAttribute('title', lang.copy || 'Copy');
    idCopyBtn.setAttribute('aria-label', (lang.copy || 'Copy') + ' ' + (lang.ringId || 'Ring ID'));
  }

  // Sync / leave labels
  var syncLabel = $('ring-sync-label');
  if (syncLabel) syncLabel.textContent = lang.syncBtn;
  var leaveLabel = $('ring-leave-label');
  if (leaveLabel) leaveLabel.textContent = lang.leaveBtn;

  // Peer input
  var peerInput = $('ring-peer-input');
  if (peerInput) peerInput.placeholder = lang.addPeerPlaceholder;
  var addPeerBtn = $('ring-add-peer-btn');
  if (addPeerBtn) addPeerBtn.textContent = lang.addPeerBtn;
  applyAdminControls();

  // Render peers as member-item style
  var peersList = $('ring-peers-list');
  var peersEmpty = $('ring-peers-empty');
  if (!peersList) return;

  if (state.ringPeers.length === 0) {
    peersList.innerHTML = '';
    if (peersEmpty) { peersEmpty.style.display = ''; peersEmpty.querySelector('span').textContent = lang.emptyPeers; }
    return;
  }
  if (peersEmpty) peersEmpty.style.display = 'none';

  var html = '';
  state.ringPeers.forEach(function (peer) {
    var url = peer.actor_url || peer.peer_url || peer.url || peer;
    var urlStr = typeof url === 'string' ? url : JSON.stringify(url);
    var initial = SVG_ICONS.globe;
    html += '<div class="member-item">'
      + '<div class="member-avatar" style="border-radius:6px;font-size:12px">' + initial + '</div>'
      + '<div class="member-info">'
      + '<div class="member-name">' + esc(urlStr) + '</div>'
      + '</div>'
      + (state.isAdmin ? '<button class="member-kick ring-peer-remove-btn" data-peer-url="' + esc(typeof url === 'string' ? url : '') + '" title="Remove">'
      + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>'
      + '</button>' : '')
      + '</div>';
  });
  peersList.innerHTML = html;
  applyAdminControls();

  peersList.querySelectorAll('.ring-peer-remove-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      doRemovePeer(btn.dataset.peerUrl);
    });
  });
}

async function doAddPeer() {
  if (!requireAdminAction()) return;
  var input = $('ring-peer-input');
  var btn = $('ring-add-peer-btn');
  if (!input || !state.activeRingId) return;
  var peerUrl = input.value.trim();
  if (!peerUrl) return;
  if (btn) btn.disabled = true;
  try {
    await Tapp.federation.addPeer(state.activeRingId, { peer: peerUrl });
    input.value = '';
    loadRingDetail(state.activeRingId);
  } catch (e) {
    notifyError(lang.addPeerFail, e);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function doRemovePeer(peerUrl) {
  if (!requireAdminAction()) return;
  if (!state.activeRingId || !peerUrl) return;
  try {
    await Tapp.federation.removePeer(state.activeRingId, peerUrl);
    loadRingDetail(state.activeRingId);
  } catch (e) {
    notifyError(lang.removePeerFail, e);
  }
}

async function doTriggerSync() {
  if (!requireAdminAction()) return;
  if (!state.activeRingId) return;
  var btn = $('ring-sync-btn');
  var statusEl = $('ring-sync-status');
  if (btn) btn.disabled = true;
  if (statusEl) { statusEl.style.display = ''; statusEl.className = 'ring-sync-bar'; statusEl.textContent = lang.syncing; }
  try {
    await Tapp.federation.triggerSync(state.activeRingId);
    if (statusEl) { statusEl.className = 'ring-sync-bar ring-sync-ok'; statusEl.textContent = lang.syncSuccess; }
    // Refresh detail after sync
    loadRingDetail(state.activeRingId);
  } catch (e) {
    if (statusEl) { statusEl.className = 'ring-sync-bar ring-sync-err'; statusEl.textContent = lang.syncFail + errorSuffix(e); }
  } finally {
    if (btn) btn.disabled = false;
    // Auto-hide status after 3s
    setTimeout(function () {
      if (statusEl) statusEl.style.display = 'none';
    }, 3000);
  }
}


// ==================== Shared scope ====================
// Republish the names this file's siblings read. See page/scope.js.
share.value({
  copyRingId: copyRingId,
  doAddPeer: doAddPeer,
  doCreateRing: doCreateRing,
  doLeaveRing: doLeaveRing,
  doTriggerSync: doTriggerSync,
  hideRingDetail: hideRingDetail,
  loadRings: loadRings,
  renderRingDetail: renderRingDetail,
  renderRingsSidebar: renderRingsSidebar,
  updateRingCreateCategoryVisibility: updateRingCreateCategoryVisibility,
});
