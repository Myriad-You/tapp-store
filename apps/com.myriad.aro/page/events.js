    var d = $('ring-create-dialog');
    if (d) {
      d.classList.remove('aro-leaving');
      d.style.display = 'flex';
    }
    if (typeof updateRingCreateCategoryVisibility === 'function') updateRingCreateCategoryVisibility();
  });
  var ringTypeSelect = $('ring-type-select');
  if (ringTypeSelect) ringTypeSelect.addEventListener('change', function () {
    if (typeof updateRingCreateCategoryVisibility === 'function') updateRingCreateCategoryVisibility();
  });
  var ringCreateClose = $('ring-create-close');
  if (ringCreateClose) ringCreateClose.addEventListener('click', function () {
    var d = $('ring-create-dialog');
    if (d) aroDismiss(d, { ms: 170 });
  });
  var ringCreateOverlay = $('ring-create-dialog');
  if (ringCreateOverlay) ringCreateOverlay.addEventListener('click', function (e) {
    if (e.target === ringCreateOverlay) aroDismiss(ringCreateOverlay, { ms: 170 });
  });

  // Ring create submit
  var createRingBtn = $('create-ring-btn');
  if (createRingBtn) createRingBtn.addEventListener('click', doCreateRing);
  var ringNameInput = $('ring-name-input');
  if (ringNameInput) ringNameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doCreateRing(); }
  });

  // Ring detail inline panel events
  var ringBackBtn = $('ring-back-btn');
  if (ringBackBtn) ringBackBtn.addEventListener('click', hideRingDetail);
  var ringIdCopyBtn = $('ring-id-copy');
  if (ringIdCopyBtn) ringIdCopyBtn.addEventListener('click', copyRingId);
  var ringSyncBtn = $('ring-sync-btn');
  if (ringSyncBtn) ringSyncBtn.addEventListener('click', doTriggerSync);
  var ringManageBtn = $('ring-manage-btn');
  if (ringManageBtn) ringManageBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var dd = $('ring-manage-dropdown');
    if (dd) dd.classList.toggle('open');
  });
  var ringLeaveBtn2 = $('ring-leave-btn');
  if (ringLeaveBtn2) ringLeaveBtn2.addEventListener('click', async function () {
    var dd = $('ring-manage-dropdown'); if (dd) dd.classList.remove('open');
    if (state.activeRingId && (await aroConfirm(lang.leaveRingConfirm, true))) {
      doLeaveRing(state.activeRingId);
    }
  });
  // Close ring manage menu on outside click
  document.addEventListener('click', function (e) {
    var dd = $('ring-manage-dropdown');
    if (!dd || !dd.classList.contains('open')) return;
    var wrap = dd.closest('.manage-wrap') || dd.parentElement;
    if (wrap && wrap.contains(e.target)) return;
    dd.classList.remove('open');
  });
  var ringAddPeerBtn = $('ring-add-peer-btn');
  if (ringAddPeerBtn) ringAddPeerBtn.addEventListener('click', doAddPeer);
  var ringPeerInput = $('ring-peer-input');
  if (ringPeerInput) ringPeerInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doAddPeer(); }
  });

  // Feed: refresh, tabs, follow, stat clicks
  var refreshFeedBtn = $('refresh-feed-btn');
  if (refreshFeedBtn) refreshFeedBtn.addEventListener('click', function () { loadFeed(); });
  var refreshFeedMobileBtn = $('refresh-feed-mobile-btn');
  if (refreshFeedMobileBtn) refreshFeedMobileBtn.addEventListener('click', function () { loadFeed(); });
  document.querySelectorAll('.feed-nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () { switchFeedSubTab(btn.dataset.sub); });
  });
  document.querySelectorAll('.feed-mobile-tab').forEach(function (btn) {
    btn.addEventListener('click', function () { switchFeedSubTab(btn.dataset.sub); });
  });
  // Messenger sidebar: 最近 / 私信 / 群聊 + 已关闭 chip
  document.querySelectorAll('.conv-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (typeof setConvTab === 'function') setConvTab(btn.getAttribute('data-conv-tab') || 'recent');
    });
  });
  var closedToggle = $('conv-closed-toggle');
  if (closedToggle) {
    closedToggle.addEventListener('click', function () {
      if (typeof toggleShowClosed === 'function') toggleShowClosed();
    });
  }
  var feedFollowBtn = $('feed-follow-btn');
  if (feedFollowBtn) feedFollowBtn.addEventListener('click', doFollow);
  var feedFollowInput = $('feed-follow-input');
  if (feedFollowInput) feedFollowInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doFollow(); }
  });
  var feedFollowClose = $('feed-follow-dialog-close');
  if (feedFollowClose) feedFollowClose.addEventListener('click', closeFollowDialog);
  var feedFollowOverlay = $('feed-follow-dialog');
  if (feedFollowOverlay) feedFollowOverlay.addEventListener('click', function (e) {
    if (e.target === feedFollowOverlay) closeFollowDialog();
  });

  // Unified feed + menu (Post / Follow)
  function onFeedPlusClick(e) {
    e.stopPropagation();
    toggleFeedPlusMenu(e.currentTarget);
  }
  var feedPlusBtn = $('feed-plus-btn');
  if (feedPlusBtn) feedPlusBtn.addEventListener('click', onFeedPlusClick);
  var feedPlusMobileBtn = $('feed-plus-mobile-btn');
  if (feedPlusMobileBtn) feedPlusMobileBtn.addEventListener('click', onFeedPlusClick);
  document.querySelectorAll('[data-feed-plus]').forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.stopPropagation();
      handleFeedPlusAction(item.getAttribute('data-feed-plus'));
    });
  });
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && (t.closest('#feed-plus-wrap') || t.closest('#feed-plus-wrap-mobile'))) return;
    closeFeedPlusMenu();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var menuOpen = document.querySelector('.feed-plus-menu.open');
    if (menuOpen) {
      e.preventDefault();
      closeFeedPlusMenu();
      return;
    }
    var quoteDlg = $('quote-repost-dialog');
    if (quoteDlg && quoteDlg.style.display !== 'none') {
      e.preventDefault();
      if (typeof closeQuoteRepostModal === 'function') closeQuoteRepostModal();
      return;
    }
    var composeDlg = $('feed-compose-dialog');
    if (composeDlg && composeDlg.style.display !== 'none') {
      e.preventDefault();
      closeComposer();
      return;
    }
    var followDlg = $('feed-follow-dialog');
    if (followDlg && followDlg.style.display !== 'none') {
      e.preventDefault();
      closeFollowDialog();
    }
  });

  // Quote-repost composer (modal)
  var quoteCancel = $('quote-repost-cancel');
  if (quoteCancel) quoteCancel.addEventListener('click', function () {
    if (typeof closeQuoteRepostModal === 'function') closeQuoteRepostModal();
  });
  var quoteClose = $('quote-repost-close');
  if (quoteClose) quoteClose.addEventListener('click', function () {
    if (typeof closeQuoteRepostModal === 'function') closeQuoteRepostModal();
  });
  var quoteOverlay = $('quote-repost-dialog');
  if (quoteOverlay) quoteOverlay.addEventListener('click', function (e) {
    if (e.target === quoteOverlay && typeof closeQuoteRepostModal === 'function') closeQuoteRepostModal();
  });
  var quoteSubmit = $('quote-repost-submit');
  if (quoteSubmit) quoteSubmit.addEventListener('click', function () {
    if (typeof doSubmitQuoteRepost === 'function') doSubmitQuoteRepost();
  });
  var quoteTa = $('quote-repost-text');
  if (quoteTa) quoteTa.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (typeof doSubmitQuoteRepost === 'function') doSubmitQuoteRepost();
    }
  });

  // Feed freeform note composer (modal)
  var composeCancel = $('feed-compose-cancel');
  if (composeCancel) composeCancel.addEventListener('click', function () { closeComposer(); });
  var composeDialogClose = $('feed-compose-dialog-close');
  if (composeDialogClose) composeDialogClose.addEventListener('click', function () { closeComposer(); });
  var composeOverlay = $('feed-compose-dialog');
  if (composeOverlay) composeOverlay.addEventListener('click', function (e) {
    if (e.target === composeOverlay) closeComposer();
  });
  var composePublish = $('feed-compose-publish');
  if (composePublish) composePublish.addEventListener('click', publishComposeNote);
  var composeImageBtn = $('feed-compose-image-btn');
  var composeImageInput = $('feed-compose-image-input');
  if (composeImageBtn && composeImageInput) {
    composeImageBtn.addEventListener('click', function () { composeImageInput.click(); });
    composeImageInput.addEventListener('change', function () {
      addComposeFiles(composeImageInput.files, 'image');
      composeImageInput.value = '';
      // New attach clears "text-only draft" notice for this session.
      if (composeAttachments.length) {
        composeDraftTextOnly = false;
        setComposeDraftNotice(false);
      }
    });
  }
  var composeVideoBtn = $('feed-compose-video-btn');
  var composeVideoInput = $('feed-compose-video-input');
  if (composeVideoBtn && composeVideoInput) {
    composeVideoBtn.addEventListener('click', function () { composeVideoInput.click(); });
    composeVideoInput.addEventListener('change', function () {
      addComposeFiles(composeVideoInput.files, 'video');
      composeVideoInput.value = '';
      if (composeAttachments.length) {
        composeDraftTextOnly = false;
        setComposeDraftNotice(false);
      }
    });
  }
  document.querySelectorAll('[data-fed-toggle]').forEach(function (summary) {
    summary.addEventListener('click', function (e) {
      if (e.target && (e.target.closest('[data-copy-fed]') || e.target.closest('[data-fed-toggle-button]'))) return;
      toggleFeedProfileSummary(summary.closest('[data-fed-profile]'));
    });
    summary.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFeedProfileSummary(summary.closest('[data-fed-profile]'));
      }
    });
  });
  document.querySelectorAll('[data-fed-toggle-button]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleFeedProfileDetails(btn.closest('[data-fed-profile]'));
    });
  });
  document.querySelectorAll('[data-copy-fed]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      copyFederationIdentity(btn.dataset.copyFed);
    });
  });
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest('[data-fed-profile]')) return;
    closeFeedProfilePopovers();
  });
  window.addEventListener('resize', function () { closeFeedProfilePopovers(); });

  // Messenger events
  var sendBtn = $('send-btn');
  if (sendBtn) sendBtn.addEventListener('click', doSend);

  var attachBtn = $('attach-btn');
  if (attachBtn) attachBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleAttachMenu(); });

  var attachImageInput = $('attach-image-input');
  if (attachImageInput) attachImageInput.addEventListener('change', function () { if (this.files[0]) handleFileSelect(this.files[0], 'image'); });

  var attachFileInput = $('attach-file-input');
  if (attachFileInput) attachFileInput.addEventListener('change', function () { if (this.files[0]) handleFileSelect(this.files[0]); });

  var input = $('msg-input');
  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    input.addEventListener('input', function () {
      autoResizeInput(this);
      updateSendState();
    });
  }
  updateSendState();

  var backBtn = $('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      var sidebar = $('sidebar');
      var chat = $('chat-container');
      var members = $('member-panel');
      var empty = $('empty-state');
      if (sidebar) {
        sidebar.classList.remove('sidebar-hidden-mobile');
        aroPlayEnter(sidebar, 'aro-panel-enter');
      }
      if (chat) {
        chat.style.display = 'none';
        chat.classList.remove('aro-panel-enter');
      }
      if (members) {
        members.style.display = 'none';
        members.classList.remove('member-open-mobile');
        members.classList.remove('member-expanded-tablet');
      }
      if (empty) {
        empty.style.display = '';
        aroPlayEnter(empty, 'aro-panel-enter');
      }
      clearPendingAttach();
      closeAttachMenu();
      if (typeof clearQuote === 'function') clearQuote();
      closeMsgMenu();
      stopPolling();
      unsubscribeRealtime();
      state.activeKind = null;
      state.activeId = null;
      state.messages = [];
      state.messagesFp = '';
      state.skipMsgAppear = false;
      state.channelDetail = null;
      state.roomDetail = null;
      state.members = [];
      renderConvList();
      updateSendState();
    });
  }

  var memberBackBtn = $('member-back-btn');
  if (memberBackBtn) {
    memberBackBtn.addEventListener('click', function () {
      closeMemberPanel();
    });
  }

  // Create dialog events
  var createBtn = $('create-btn');
  if (createBtn) createBtn.addEventListener('click', showCreateDialog);

  var overlay = $('create-dialog');
  if (overlay) overlay.addEventListener('click', function (e) {
    if (e.target === overlay) hideCreateDialog();
  });

  var closeDialogBtn = $('create-dialog-close');
  if (closeDialogBtn) closeDialogBtn.addEventListener('click', hideCreateDialog);

  var tabChannel = $('create-tab-channel');
  if (tabChannel) tabChannel.addEventListener('click', function () { switchCreateTab('channel'); });

  var tabRoom = $('create-tab-room');
  if (tabRoom) tabRoom.addEventListener('click', function () { switchCreateTab('room'); });

  var createChannelBtn = $('create-channel-btn');
  if (createChannelBtn) createChannelBtn.addEventListener('click', doCreateChannel);

  var createRoomBtn = $('create-room-btn');
  if (createRoomBtn) createRoomBtn.addEventListener('click', doCreateRoom);
  var joinRoomIdBtn = $('join-room-id-btn');
  if (joinRoomIdBtn) joinRoomIdBtn.addEventListener('click', doJoinRoomById);

  // Enter key in create inputs
  var channelInput = $('create-channel-input');
  if (channelInput) channelInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doCreateChannel(); }
  });
  var roomInput = $('create-room-input');
  if (roomInput) roomInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doCreateRoom(); }
  });
  var joinRoomIdInput = $('join-room-id-input');
  if (joinRoomIdInput) joinRoomIdInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doJoinRoomById(); }
  });

  // Invite popover events
  var inviteToggle = $('invite-toggle');
  if (inviteToggle) inviteToggle.addEventListener('click', toggleInvitePopover);

  // List search (client-side filter)
  bindListSearch('conv-search', 'conv', function () {
    if (typeof renderConvList === 'function') renderConvList();
  });
  bindListSearch('ring-search', 'ring', function () {
    if (typeof renderRingsSidebar === 'function') renderRingsSidebar();
  });
  bindListSearch('feed-search', 'feed', function () {
    if (typeof renderFeedContent === 'function') renderFeedContent();
    if (typeof updateFeedHeader === 'function') updateFeedHeader();
  });
  bindListSearch('member-search', 'member', function () {
    if (typeof renderMembers === 'function') renderMembers();
  });

  // Chat history browser (search / filter / load older)
  if (typeof bindChatHistoryUi === 'function') bindChatHistoryUi();
  // Room files panel (group attachment library)
  if (typeof bindRoomFilesUi === 'function') bindRoomFilesUi();

  // Edit room dialog events
  var editRoomOverlay = $('edit-room-dialog');
  if (editRoomOverlay) editRoomOverlay.addEventListener('click', function (e) {
    if (e.target === editRoomOverlay) hideEditRoomDialog();
  });
  var editRoomCloseBtn = $('edit-room-close');
  if (editRoomCloseBtn) editRoomCloseBtn.addEventListener('click', hideEditRoomDialog);
  var editRoomSaveBtn = $('edit-room-save');
  if (editRoomSaveBtn) editRoomSaveBtn.addEventListener('click', doSaveRoom);
  var editRoomIdCopy = $('edit-room-id-copy');
  if (editRoomIdCopy) editRoomIdCopy.addEventListener('click', function () {
    var id = state.roomDetail && state.roomDetail.room_id;
    if (!id) return;
    if (typeof copyTextToClipboard === 'function') {
      copyTextToClipboard(id, { okTitle: lang.copied || 'Copied' });
    } else if (typeof fallbackCopyText === 'function') {
      fallbackCopyText(id);
    }
  });

  // Esc closes topmost messenger overlays/menus (menus → pickers → dialogs)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.keyCode !== 27) return;
    // Message context menu
    if (typeof closeMsgMenu === 'function' && typeof _msgMenu !== 'undefined' && _msgMenu) {
      closeMsgMenu();
      e.preventDefault();
      return;
    }
    // Attach menu
    if (typeof closeAttachMenu === 'function' && typeof _attachMenu !== 'undefined' && _attachMenu) {
      closeAttachMenu();
      e.preventDefault();
      return;
    }
    // Invite popover
    if (typeof closeInvitePopover === 'function' && typeof _invitePopover !== 'undefined' && _invitePopover && _invitePopover.style.display !== 'none') {
      closeInvitePopover();
      e.preventDefault();
      return;
    }
    // Chat history panel
    if (typeof isChatHistoryOpen === 'function' && isChatHistoryOpen()) {
      closeChatHistory();
      e.preventDefault();
      return;
    }
    // Room files panel
    if (typeof isRoomFilesOpen === 'function' && isRoomFilesOpen()) {
      closeRoomFiles();
      e.preventDefault();
      return;
    }
    // Manage dropdown
    var manageDd = $('manage-dropdown');
    if (manageDd && manageDd.classList.contains('open')) {
      closeManageDropdown();
      e.preventDefault();
      return;
    }
    // Topmost dismissable overlay (forward / picker / confirm)
    var overlays = document.querySelectorAll('.forward-overlay, .picker-overlay, .confirm-overlay');
    if (overlays.length) {
      var top = overlays[overlays.length - 1];
      if (top.classList.contains('confirm-overlay')) {
        var cancelBtn = top.querySelector('.confirm-btn-cancel');
        if (cancelBtn) cancelBtn.click();
      } else {
        aroDismiss(top, { remove: true, ms: 160 });
      }
      e.preventDefault();
      return;
    }
    // Create / edit room dialogs
    var createDlg = $('create-dialog');
    if (createDlg && createDlg.style.display !== 'none') {
      hideCreateDialog();
      e.preventDefault();
      return;
    }
    var editDlg = $('edit-room-dialog');
    if (editDlg && editDlg.style.display !== 'none') {
      hideEditRoomDialog();
      e.preventDefault();
    }
  });
}

// ==================== Init ====================
async function init() {
  try {
    var user = await Tapp.context.getUser();
    var actorUrl = user ? normalizeFederationUrl(user.actor_url) : '';
    if (actorUrl) state.localActorUrl = actorUrl;
  } catch (e) { /* ignore */ }

  try {
