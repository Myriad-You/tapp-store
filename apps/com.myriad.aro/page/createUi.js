var share = require('./scope.js');

// ==================== Create channel/room dialog ====================
// Extracted from api.js. Load before api.js.

// ==================== Create Dialog ====================
function showCreateDialog() {
  bindRoomAvatarUi();
  _createRoomAvatar = { dirty: false, dataUrl: '' };
  paintRoomAvatarPreview($('create-room-avatar-preview'), '', '');
  var descCreate = $('create-room-desc');
  if (descCreate) descCreate.value = '';
  var overlay = $('create-dialog');
  if (overlay) {
    showAroOverlay(overlay);
  }
  switchCreateTab('channel');
}

function hideCreateDialog() {
  var overlay = $('create-dialog');
  var clearInputs = function () {
    var channelInput = $('create-channel-input');
    var roomInput = $('create-room-input');
    var roomDesc = $('create-room-desc');
    if (channelInput) channelInput.value = '';
    if (roomInput) roomInput.value = '';
    if (roomDesc) roomDesc.value = '';
    _createRoomAvatar = { dirty: false, dataUrl: '' };
    paintRoomAvatarPreview($('create-room-avatar-preview'), '', '');
  };
  if (!overlay || overlay.style.display === 'none' || overlay.hidden) {
    if (overlay) {
      try {
        overlay.style.display = 'none';
        overlay.style.pointerEvents = 'none';
        overlay.hidden = true;
      } catch (eSeal) { /* ignore */ }
    }
    clearInputs();
    return;
  }
  overlay.style.pointerEvents = 'none';
  aroDismiss(overlay, {
    ms: 170,
    onDone: function () {
      try {
        overlay.hidden = true;
        overlay.style.pointerEvents = 'none';
      } catch (eH) { /* ignore */ }
      clearInputs();
    },
  });
}

function switchCreateTab(tab) {
  var channelTab = $('create-tab-channel');
  var roomTab = $('create-tab-room');
  var channelForm = $('create-form-channel');
  var roomForm = $('create-form-room');
  if (!channelTab) return;
  if (tab === 'channel') {
    channelTab.classList.add('create-tab-active');
    roomTab.classList.remove('create-tab-active');
    channelForm.style.display = '';
    roomForm.style.display = 'none';
  } else {
    roomTab.classList.add('create-tab-active');
    channelTab.classList.remove('create-tab-active');
    roomForm.style.display = '';
    channelForm.style.display = 'none';
  }
}

function flashCreateInput(input) {
  if (!input) return;
  input.classList.add('create-input-invalid');
  try { input.focus(); } catch (e) { /* ignore */ }
  setTimeout(function () { input.classList.remove('create-input-invalid'); }, 900);
}

async function doCreateChannel() {
  var input = $('create-channel-input');
  if (!input) return;
  var remoteActor = input.value.trim();
  if (!remoteActor) {
    flashCreateInput(input);
    try { Tapp.ui.showNotification({ title: lang.channelPlaceholder || lang.createFail, type: 'error' }); } catch (e0) {}
    return;
  }
  var btn = $('create-channel-btn');
  if (typeof setActionBusy === 'function') setActionBusy(btn, true, lang.creating || '…');
  else if (btn) { btn.disabled = true; btn.textContent = lang.creating; }
  try {
    var result = await Tapp.federation.createChannel({ remote_actor: remoteActor });
    hideCreateDialog();
    await loadConversations();
    if (result && result.channel_id) {
      openConversation('channel', result.channel_id);
    }
  } catch (e) {
    console.error('[Aro] createChannel error:', e);
    notifyError(lang.createFail, e);
  } finally {
    if (typeof setActionBusy === 'function') setActionBusy(btn, false);
    else if (btn) { btn.disabled = false; btn.textContent = lang.createChannel; }
  }
}

async function doCreateRoom() {
  var input = $('create-room-input');
  if (!input) return;
  var name = input.value.trim();
  if (!name) {
    flashCreateInput(input);
    try { Tapp.ui.showNotification({ title: lang.roomPlaceholder || lang.createFail, type: 'error' }); } catch (e0) {}
    return;
  }
  var descInp = $('create-room-desc');
  var desc = descInp ? (descInp.value || '').trim() : '';
  var pubCb = $('create-room-public');
  var isPublic = !!(pubCb && pubCb.checked);
  var btn = $('create-room-btn');
  if (typeof setActionBusy === 'function') setActionBusy(btn, true, lang.creating || '…');
  else if (btn) { btn.disabled = true; btn.textContent = lang.creating; }
  try {
    var createReq = {
      name: name,
      is_public: isPublic,
      // Public rooms are joinable by id even if invite_policy stays default.
      invite_policy: isPublic ? 'open' : undefined,
    };
    if (desc) createReq.description = desc;
    if (_createRoomAvatar.dirty && _createRoomAvatar.dataUrl) {
      createReq.avatar_url = _createRoomAvatar.dataUrl;
    }
    var result = await Tapp.federation.createRoom(createReq);
    if (result && result.data) result = result.data;
    hideCreateDialog();
    if (pubCb) pubCb.checked = false;
    if (descInp) descInp.value = '';
    _createRoomAvatar = { dirty: false, dataUrl: '' };
    paintRoomAvatarPreview($('create-room-avatar-preview'), '', '');
    await loadConversations();
    if (result && result.room_id) {
      openConversation('room', result.room_id);
      if (isPublic) {
        try {
          var createdShare = typeof shareableRoomId === 'function'
            ? shareableRoomId(result)
            : result.room_id;
          Tapp.ui.showNotification({
            title: lang.publicGroup || 'Public',
            message: (lang.roomId || 'Room ID') + ': ' + createdShare,
            type: 'success',
          });
        } catch (eN) { /* ignore */ }
      }
    }
  } catch (e) {
    console.error('[Aro] createRoom error:', e);
    notifyError(lang.createFail, e);
  } finally {
    if (typeof setActionBusy === 'function') setActionBusy(btn, false);
    else if (btn) { btn.disabled = false; btn.textContent = lang.createRoom; }
  }
}

/** Join a public (or open) room by room id (bare or shareable `rm_…@home`). */
async function doJoinRoomById() {
  var input = $('join-room-id-input');
  if (!input) return;
  var parsed = typeof parseJoinRoomInput === 'function'
    ? parseJoinRoomInput(input.value)
    : { roomId: (input.value || '').trim(), homeServer: '' };
  var roomId = parsed.roomId;
  if (!roomId) {
    flashCreateInput(input);
    try {
      Tapp.ui.showNotification({
        title: lang.joinRoomIdMissing || lang.joinRoomFail || 'Enter room id',
        type: 'error',
      });
    } catch (e0) {}
    return;
  }
  if (!Tapp.federation || typeof Tapp.federation.joinRoom !== 'function') {
    notifyError(lang.joinRoomFail || 'Join not available');
    return;
  }
  var btn = $('join-room-id-btn');
  if (typeof setActionBusy === 'function') {
    setActionBusy(btn, true, lang.joining || lang.creating || '…');
  } else if (btn) {
    btn.disabled = true;
    btn.textContent = lang.joining || lang.creating || '…';
  }
  try {
    var joinArg = parsed.homeServer
      ? { home_server: parsed.homeServer }
      : undefined;
    // Pass shareable form in path so backend can parse home even if body is ignored.
    var joinRef = parsed.homeServer ? (roomId + '@' + parsed.homeServer) : roomId;
    await Tapp.federation.joinRoom(joinRef, joinArg);
    hideCreateDialog();
    input.value = '';
    await loadConversations();
    await openConversation('room', roomId);
    // openConversation already schedules a confirm burst; boost again for post-join.
    confirmRoomMembers(roomId, state.openGen, {
      delays: [0, 300, 900, 2000, 4500],
      boostMs: 20000,
      refreshList: true,
    });
    try {
      Tapp.ui.showNotification({
        title: lang.joinRoomOk || 'Joined',
        type: 'success',
      });
    } catch (eN) { /* ignore */ }
  } catch (e) {
    notifyError(lang.joinRoomFail || 'Join failed', e);
  } finally {
    if (typeof setActionBusy === 'function') setActionBusy(btn, false);
    else if (btn) { btn.disabled = false; btn.textContent = lang.joinRoom || 'Join'; }
  }
}


// ==================== Shared scope ====================
// Republish the names this file's siblings read. See page/scope.js.
share.value({
  doCreateChannel: doCreateChannel,
  doCreateRoom: doCreateRoom,
  doJoinRoomById: doJoinRoomById,
  hideCreateDialog: hideCreateDialog,
  showCreateDialog: showCreateDialog,
  switchCreateTab: switchCreateTab,
});
