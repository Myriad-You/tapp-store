var share = require('./scope.js');

// ==================== Room UI (invite / avatar / edit) ====================
// Extracted from api.js. Depends on helpers, state, federation SDK.
// Load before api.js (call-time deps on openConversation ok).

// ==================== Invite Popover ====================
// Create popover dynamically on document.body to escape all overflow clipping
var _invitePopover = null;
function ensureInvitePopover() {
  if (_invitePopover) return _invitePopover;
  var div = document.createElement('div');
  div.id = 'invite-popover';
  div.className = 'invite-popover';
  div.style.display = 'none';
  div.style.pointerEvents = 'none';
  var contactSearchPh = lang.searchContacts || lang.pickerSearchPlaceholder || 'Search…';
  div.innerHTML = '<div class="invite-pop-section">'
    + '<div class="invite-pop-label" id="invite-pop-contacts-label">' + esc(lang.inviteFromContacts) + '</div>'
    + '<div class="aro-search-bar aro-search-bar-compact" style="padding:0 0 6px;border:none">'
    + '<input id="invite-contact-search" class="aro-search-input" type="search" autocomplete="off" enterkeyhint="search" placeholder="' + esc(contactSearchPh) + '" aria-label="' + esc(contactSearchPh) + '" />'
    + '</div>'
    + '<div id="invite-pop-list" class="invite-pop-list"></div>'
    + '<div id="invite-pop-empty" class="invite-pop-empty" style="display:none">' + esc(lang.noContacts) + '</div>'
    + '</div>'
    + '<div class="invite-pop-divider"></div>'
    + '<div class="invite-pop-section">'
    + '<div class="invite-pop-label" id="invite-pop-manual-label">' + esc(lang.inviteManual) + '</div>'
    + '<div class="invite-pop-manual">'
    + '<input id="invite-input" class="invite-input" type="text" placeholder="' + esc(lang.invitePlaceholder) + '" />'
    + '<button id="invite-btn" class="invite-pop-send">'
    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>'
    + '</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(div);
  // Wire events on the popover elements
  var inviteBtn = div.querySelector('#invite-btn');
  if (inviteBtn) inviteBtn.addEventListener('click', function () { doInviteMember(); });
  var inviteInput = div.querySelector('#invite-input');
  if (inviteInput) inviteInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doInviteMember(); }
  });
  var contactSearch = div.querySelector('#invite-contact-search');
  if (contactSearch) {
    contactSearch.addEventListener('input', function () {
      if (!state.search) state.search = {};
      state.search.invite = contactSearch.value || '';
      renderInvitePopoverContacts();
    });
  }
  _invitePopover = div;
  return div;
}

function toggleInvitePopover(e) {
  e && e.stopPropagation();
  var pop = ensureInvitePopover();
  var toggle = $('invite-toggle');
  if (!toggle) return;
  var isOpen = pop.style.display !== 'none';
  if (isOpen) {
    closeInvitePopover();
  } else {
    var rect = toggle.getBoundingClientRect();
    pop.style.top = (rect.bottom + 6) + 'px';
    pop.style.left = Math.max(4, rect.right - 240) + 'px';
    pop.classList.remove('aro-leaving');
    pop.hidden = false;
    try { pop.removeAttribute('hidden'); } catch (eH) { /* ignore */ }
    pop.style.pointerEvents = 'auto';
    pop.style.display = 'block';
    aroPlayEnter(pop, 'aro-menu-enter');
    renderInvitePopoverContacts();
    var invInput = pop.querySelector('#invite-input');
    if (invInput) {
      try { invInput.focus(); } catch (e2) { /* ignore */ }
    }
  }
}
function closeInvitePopover() {
  if (!_invitePopover) return;
  // Always seal PE + display none (even if already half-closed).
  try { _invitePopover.style.pointerEvents = 'none'; } catch (ePe) { /* ignore */ }
  if (_invitePopover.style.display === 'none') {
    try { _invitePopover.style.display = 'none'; } catch (eD) { /* ignore */ }
    return;
  }
  aroDismiss(_invitePopover, { ms: 120 });
}
function _invitePopoverOutsideClick(e) {
  if (!_invitePopover || _invitePopover.style.display === 'none') return;
  var wrap = $('invite-wrap');
  if ((wrap && wrap.contains(e.target)) || _invitePopover.contains(e.target)) return;
  closeInvitePopover();
}
/** Call from bindEvents after page bag is live (ARO-14). */
function registerInvitePopoverOutsideGuard() {
  pageListen(document, 'click', _invitePopoverOutsideClick);
}

function renderInvitePopoverContacts() {
  var listEl = $('invite-pop-list');
  var emptyEl = $('invite-pop-empty');
  if (!listEl || !emptyEl) return;

  // Get actor URLs of current room members for filtering (normalized)
  var memberActors = {};
  state.members.forEach(function (m) {
    if (!m.actor_url) return;
    memberActors[m.actor_url] = true;
    var normalized = normalizeFederationUrl(m.actor_url);
    if (normalized) memberActors[normalized] = true;
  });

  // Build contacts from existing channels (chat partners)
  var contacts = [];
  state.channels.forEach(function (ch) {
    if (!ch.remote_actor_url || ch.status === 'closed') return;
    var remoteNorm = normalizeFederationUrl(ch.remote_actor_url) || ch.remote_actor_url;
    var alreadyMember = !!(memberActors[ch.remote_actor_url] || memberActors[remoteNorm]);
    contacts.push({
      name: ch.remote_actor_name || (ch.remote_actor_url || '').split('/').pop() || '?',
      avatar: ch.remote_actor_avatar || '',
      actorUrl: ch.remote_actor_url,
      alreadyMember: alreadyMember,
    });
  });

  if (contacts.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = '';
    emptyEl.textContent = lang.noContacts;
    return;
  }

  var inviteQ = normalizeSearchQuery((state.search && state.search.invite) || '');
  if (inviteQ) {
    contacts = contacts.filter(function (c) {
      return matchesSearch(inviteQ, [c.name, c.actorUrl]);
    });
  }

  if (contacts.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = '';
    emptyEl.textContent = lang.searchNoResults || lang.noContacts;
    return;
  }

  emptyEl.style.display = 'none';
  var html = '';
  contacts.forEach(function (c) {
    var initial = (c.name[0] || '?').toUpperCase();
    var shortUrl = (c.actorUrl || '').replace(/^https?:\/\//, '').split('/').slice(0, 2).join('/');
    html += '<button class="invite-pop-contact' + (c.alreadyMember ? ' invite-pop-contact-disabled' : '') + '"'
      + ' data-actor="' + esc(c.actorUrl) + '"' + (c.alreadyMember ? ' disabled' : '') + '>'
      + '<div class="invite-pop-contact-avatar">'
      + avatarContentHtml(c.avatar || '', c.name || initial)
      + '</div>'
      + '<div class="invite-pop-contact-info">'
      + '<div class="invite-pop-contact-name">' + esc(c.name) + '</div>'
      + '<div class="invite-pop-contact-url">' + esc(shortUrl) + '</div>'
      + '</div>'
      + (c.alreadyMember ? '<span class="invite-pop-contact-added">' + esc(lang.invited || lang.members) + '</span>' : '')
      + '</button>';
  });
  listEl.innerHTML = html;

  // Wire contact click handlers
  listEl.querySelectorAll('.invite-pop-contact:not([disabled])').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var actor = btn.getAttribute('data-actor');
      if (actor) doInviteMember(actor);
    });
  });
}

// ==================== Room avatar (create / edit) ====================
// Backend accepts data:image/* (≤ ~600KB) or https URL on create/updateRoom.
var ROOM_AVATAR_DATA_MAX = 520000;
var _editRoomAvatar = { dirty: false, dataUrl: '' };
var _createRoomAvatar = { dirty: false, dataUrl: '' };

function compressRoomAvatarDataUrl(dataUrl) {
  return new Promise(function (resolve, reject) {
    if (!dataUrl || typeof dataUrl !== 'string') {
      reject(new Error('invalid image'));
      return;
    }
    if (dataUrl.length <= ROOM_AVATAR_DATA_MAX && /^data:image\//i.test(dataUrl)) {
      resolve(dataUrl);
      return;
    }
    var img = new Image();
    img.onload = function () {
      try {
        var maxSide = 512;
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
        var qualities = [0.88, 0.75, 0.62, 0.5, 0.38, 0.28];
        for (var i = 0; i < qualities.length; i++) {
          out = canvas.toDataURL('image/jpeg', qualities[i]);
          if (out.length <= ROOM_AVATAR_DATA_MAX) break;
        }
        var side = maxSide;
        while (out.length > ROOM_AVATAR_DATA_MAX && side > 96) {
          side = Math.floor(side * 0.75);
          scale = Math.min(1, side / Math.max(w, h));
          cw = Math.max(1, Math.round(w * scale));
          ch = Math.max(1, Math.round(h * scale));
          canvas.width = cw;
          canvas.height = ch;
          ctx.drawImage(img, 0, 0, cw, ch);
          out = canvas.toDataURL('image/jpeg', 0.55);
        }
        if (out.length > ROOM_AVATAR_DATA_MAX) {
          reject(new Error(lang.roomAvatarTooLarge || lang.stickerTooLarge || 'Image too large'));
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

function paintRoomAvatarPreview(previewEl, url, name) {
  if (!previewEl) return;
  var safe = '';
  if (url) {
    if (typeof safeMessageImageUrl === 'function') safe = safeMessageImageUrl(url);
    else if (typeof safeIconUrl === 'function') safe = safeIconUrl(url);
    if (!safe && String(url).indexOf('data:image/') === 0 && url.length < ROOM_AVATAR_DATA_MAX + 20000) {
      safe = url;
    }
    if (!safe && /^https?:\/\//i.test(String(url))) safe = String(url);
  }
  if (safe) {
    previewEl.innerHTML = '<img src="' + esc(safe) + '" alt="" />';
    previewEl.classList.add('has-image');
  } else {
    var initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
    previewEl.textContent = initial;
    previewEl.classList.remove('has-image');
  }
}

async function handleRoomAvatarFile(file, which) {
  if (!file || !file.type || file.type.indexOf('image/') !== 0) {
    if (typeof notifyError === 'function') {
      notifyError(lang.roomAvatarNeedImage || lang.stickerNeedImage || 'Please choose an image');
    }
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    if (typeof notifyError === 'function') {
      notifyError(lang.roomAvatarTooLarge || 'Image too large');
    }
    return;
  }
  try {
    var dataUrl = typeof readFileAsDataURL === 'function'
      ? await readFileAsDataURL(file)
      : await new Promise(function (resolve, reject) {
          var r = new FileReader();
          r.onload = function () { resolve(r.result); };
          r.onerror = function () { reject(r.error); };
          r.readAsDataURL(file);
        });
    dataUrl = await compressRoomAvatarDataUrl(dataUrl);
    if (which === 'create') {
      _createRoomAvatar = { dirty: true, dataUrl: dataUrl };
      paintRoomAvatarPreview($('create-room-avatar-preview'), dataUrl, ($('create-room-input') || {}).value);
    } else {
      _editRoomAvatar = { dirty: true, dataUrl: dataUrl };
      paintRoomAvatarPreview(
        $('edit-room-avatar-preview'),
        dataUrl,
        ($('edit-room-name') || {}).value || (state.roomDetail && state.roomDetail.name)
      );
    }
  } catch (e) {
    if (typeof notifyError === 'function') {
      notifyError(lang.roomAvatarFail || lang.sendFail || 'Avatar failed', e);
    }
  }
}

function bindRoomAvatarUi() {
  if (bindRoomAvatarUi._bound) return;
  bindRoomAvatarUi._bound = true;
  var editBtn = $('edit-room-avatar-btn');
  var editInp = $('edit-room-avatar-input');
  if (editBtn && editInp) {
    editBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      editInp.value = '';
      editInp.click();
    });
    editInp.addEventListener('change', function () {
      if (this.files && this.files[0]) handleRoomAvatarFile(this.files[0], 'edit');
    });
  }
  var createBtn = $('create-room-avatar-btn');
  var createInp = $('create-room-avatar-input');
  if (createBtn && createInp) {
    createBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      createInp.value = '';
      createInp.click();
    });
    createInp.addEventListener('change', function () {
      if (this.files && this.files[0]) handleRoomAvatarFile(this.files[0], 'create');
    });
  }
}

// ==================== Edit Room ====================
function showEditRoomDialog() {
  if (!state.roomDetail) return;
  var overlay = $('edit-room-dialog');
  if (!overlay) return;
  bindRoomAvatarUi();
  _editRoomAvatar = { dirty: false, dataUrl: '' };
  $('edit-room-name').value = state.roomDetail.name || '';
  $('edit-room-desc').value = state.roomDetail.description || '';
  var policySel = $('edit-room-invite-policy');
  if (policySel) {
    var pol = state.roomDetail.invite_policy || 'member-invite';
    if (['admin-only', 'member-invite', 'open'].indexOf(pol) < 0) pol = 'member-invite';
    policySel.value = pol;
  }
  paintRoomAvatarPreview(
    $('edit-room-avatar-preview'),
    state.roomDetail.avatar_url || '',
    state.roomDetail.name || ''
  );
  var pubCb = $('edit-room-public');
  var pubHint = $('edit-room-public-hint');
  var idBox = $('edit-room-id-box');
  var idVal = $('edit-room-id-value');
  var alreadyPublic = !!state.roomDetail.is_public;
  if (pubCb) {
    pubCb.checked = alreadyPublic;
    pubCb.disabled = alreadyPublic; // one-way: cannot uncheck once public
    pubCb.setAttribute('aria-disabled', alreadyPublic ? 'true' : 'false');
  }
  if (pubHint) {
    pubHint.style.display = '';
    pubHint.textContent = alreadyPublic
      ? (lang.makePublicLocked || 'Public rooms cannot be made private again.')
      : (lang.makePublicHint || 'Public groups show a shareable room id. This cannot be undone.');
  }
  if (idBox && idVal) {
    if (alreadyPublic && state.roomDetail.room_id) {
      idBox.style.display = '';
      idVal.textContent = typeof shareableRoomId === 'function'
        ? shareableRoomId(state.roomDetail)
        : state.roomDetail.room_id;
    } else {
      idBox.style.display = 'none';
      idVal.textContent = '';
    }
  }
  showAroOverlay(overlay);
}

function hideEditRoomDialog() {
  var overlay = $('edit-room-dialog');
  if (!overlay || overlay.style.display === 'none') return;
  overlay.style.pointerEvents = 'none';
  aroDismiss(overlay, {
    ms: 170,
    onDone: function () {
      try {
        overlay.hidden = true;
        overlay.style.pointerEvents = 'none';
      } catch (e) { /* ignore */ }
    },
  });
}

async function doSaveRoom() {
  if (!state.activeId || !state.roomDetail) return;
  var nameVal = ($('edit-room-name').value || '').trim();
  var descVal = ($('edit-room-desc').value || '').trim();
  if (!nameVal) return;
  var pubCb = $('edit-room-public');
  var wantPublic = !!(pubCb && pubCb.checked);
  var alreadyPublic = !!state.roomDetail.is_public;
  var policySel = $('edit-room-invite-policy');
  var invitePolicy = policySel ? (policySel.value || '').trim() : '';
  var btn = $('edit-room-save');
  btn && (btn.disabled = true, btn.textContent = lang.saving);
  try {
    var payload = { name: nameVal, description: descVal };
    // Only send is_public when turning private→public (never send false once public).
    if (!alreadyPublic && wantPublic) {
      payload.is_public = true;
    }
    if (invitePolicy && ['admin-only', 'member-invite', 'open'].indexOf(invitePolicy) >= 0) {
      payload.invite_policy = invitePolicy;
    }
    if (_editRoomAvatar.dirty && _editRoomAvatar.dataUrl) {
      payload.avatar_url = _editRoomAvatar.dataUrl;
    }
    var updated = await Tapp.federation.updateRoom(state.activeId, payload);
    var detail = updated && (updated.data || updated);
    if (detail && (detail.room_id || detail.name || detail.avatar_url !== undefined)) {
      state.roomDetail = detail;
    } else {
      state.roomDetail.name = nameVal;
      state.roomDetail.description = descVal;
      if (!alreadyPublic && wantPublic) state.roomDetail.is_public = true;
      if (invitePolicy) state.roomDetail.invite_policy = invitePolicy;
      if (_editRoomAvatar.dirty && _editRoomAvatar.dataUrl) {
        state.roomDetail.avatar_url = _editRoomAvatar.dataUrl;
      }
    }
    // Sync to room list
    for (var i = 0; i < state.rooms.length; i++) {
      if (state.rooms[i].room_id === state.activeId) {
        state.rooms[i].name = state.roomDetail.name || nameVal;
        state.rooms[i].description = state.roomDetail.description != null
          ? state.roomDetail.description
          : descVal;
        if (state.roomDetail.avatar_url !== undefined) {
          state.rooms[i].avatar_url = state.roomDetail.avatar_url;
        }
        if (!alreadyPublic && wantPublic) state.rooms[i].is_public = true;
        if (state.roomDetail.is_public != null) state.rooms[i].is_public = !!state.roomDetail.is_public;
        break;
      }
    }
    _editRoomAvatar = { dirty: false, dataUrl: '' };
    hideEditRoomDialog();
    renderChatHeader();
    renderConvList();
    if (!alreadyPublic && wantPublic) {
      try {
        var shareIdAfter = typeof shareableRoomId === 'function'
          ? shareableRoomId(state.roomDetail)
          : state.activeId;
        Tapp.ui.showNotification({
          title: lang.publicGroup || 'Public',
          message: (lang.roomId || 'Room ID') + ': ' + shareIdAfter,
          type: 'success',
        });
      } catch (eN) { /* ignore */ }
    }
  } catch (e) {
    notifyError(lang.saveFail, e);
  } finally {
    btn && (btn.disabled = false, btn.textContent = lang.save);
  }
}


// ==================== Shared scope ====================
// Republish the names this file's siblings read. See page/scope.js.
share.value({
  bindRoomAvatarUi: bindRoomAvatarUi,
  closeInvitePopover: closeInvitePopover,
  doSaveRoom: doSaveRoom,
  hideEditRoomDialog: hideEditRoomDialog,
  paintRoomAvatarPreview: paintRoomAvatarPreview,
  registerInvitePopoverOutsideGuard: registerInvitePopoverOutsideGuard,
  renderInvitePopoverContacts: renderInvitePopoverContacts,
  showEditRoomDialog: showEditRoomDialog,
  toggleInvitePopover: toggleInvitePopover,
});
share.live({
  _createRoomAvatar: [function () { return _createRoomAvatar; }, function (v) { _createRoomAvatar = v; }],
  _invitePopover: [function () { return _invitePopover; }, function (v) { _invitePopover = v; }],
});
