// ==================== Render: Members ====================
// Full function lives here (must not be split across history/files modules).
function renderMembers() {
  var panel = $('member-panel');
  if (!panel) return;

  if (state.activeKind !== 'room' || !state.roomDetail) {
    // Always clear mobile full-screen sheet — stuck member-open-mobile blocks the list.
    panel.classList.remove('member-open-mobile', 'member-expanded-tablet');
    panel.style.display = 'none';
    panel.style.pointerEvents = '';
    return;
  }
  // Desktop: show side panel. Mobile: keep hidden until user opens (member-open-mobile).
  var isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  if (isMobile) {
    // Do not force-show; only ensure pointer-events when intentionally open.
    if (!panel.classList.contains('member-open-mobile')) {
      panel.style.display = '';
      // media query keeps it display:none until .member-open-mobile
    }
  } else {
    panel.style.display = '';
    panel.style.pointerEvents = '';
  }
  $('member-title').textContent = lang.members + ' (' + state.members.length + ')';

  var myRole = state.roomDetail.my_role || '';
  var myPending = (state.roomDetail.my_membership_status || state.roomDetail.membership_status || 'active') === 'pending';
  var canKick = !myPending && (myRole === 'owner' || myRole === 'admin');
  var memberQ = (state.search && state.search.member) || '';
  var memberQuery = normalizeSearchQuery(memberQ);
  var filteredMembers = !memberQuery ? state.members : state.members.filter(function (m) {
    var name = m.display_name || (m.actor_url || '').split('/').pop() || '';
    return matchesSearch(memberQuery, [name, m.actor_url, m.role, m.username, m.membership_status]);
  });

  var html = '';
  if (state.members.length > 0 && filteredMembers.length === 0) {
    html = searchNoResultsHtml();
  } else {
    filteredMembers.forEach(function (m) {
      var name = m.display_name || (m.actor_url || '').split('/').pop() || '?';
      // 普通成员不显示角色，减少列表噪音；仅标出群主/管理员
      var roleText = (m.role && m.role !== 'member') ? roleLabel(m.role) : '';
      var mStatus = m.membership_status || 'active';
      if (mStatus === 'pending') {
        roleText = roleText
          ? (roleText + ' · ' + (lang.pending || 'Pending'))
          : (lang.pending || 'Pending');
      }
      html += '<div class="member-item' + (mStatus === 'pending' ? ' member-pending' : '') + '">'
        + '<div class="member-avatar">' + avatarContentHtml(m.avatar_url || '', name) + '</div>'
        + '<div class="member-info">'
        + '<div class="member-name">' + esc(name) + '</div>'
        + (roleText ? '<div class="member-role">' + esc(roleText) + '</div>' : '')
        + '</div>';
      if (m.is_local) {
        html += '<span class="member-local">' + esc(lang.local) + '</span>';
      } else if (canKick && m.role !== 'owner') {
        html += '<button type="button" class="member-kick" data-actor="' + esc(m.actor_url || '') + '" title="' + esc(lang.kick) + '" aria-label="' + esc(lang.kick) + '">'
          + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>'
          + '</button>';
      }
      html += '</div>';
    });
  }
  $('member-list').innerHTML = html;

  // Wire kick buttons
  if (canKick) {
    var kicks = document.querySelectorAll('.member-kick');
    kicks.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var actor = btn.getAttribute('data-actor');
        if (actor) doKickMember(actor);
      });
    });
  }

  // Show invite icon for active room members only
  var inviteWrap = $('invite-wrap');
  if (inviteWrap) {
    inviteWrap.style.display = (!myPending && state.roomDetail && myRole) ? '' : 'none';
  }
}

// ==================== Manage Dropdown ====================
function toggleManageDropdown(e) {
  e && e.stopPropagation();
  var dd = $('manage-dropdown');
  if (!dd) return;
  dd.classList.toggle('open');
}
function closeManageDropdown() {
  var dd = $('manage-dropdown');
  if (dd) dd.classList.remove('open');
}
document.addEventListener('click', function (e) {
  var dd = $('manage-dropdown');
  if (!dd || !dd.classList.contains('open')) return;
  var wrap = dd.parentElement;
  if (wrap && !wrap.contains(e.target)) closeManageDropdown();
});

// ==================== Render: Chat Header ====================
function renderChatHeader() {
  var nameEl = $('chat-name');
  var metaEl = $('chat-meta');
  var actionsEl = $('chat-actions');
  var avatarEl = $('chat-hdr-avatar');
  if (!nameEl) return;

  if (state.activeKind === 'channel' && state.channelDetail) {
    var ch = state.channelDetail;
    var chName = ch.remote_actor_name || (ch.remote_actor_url || '').split('/').pop() || '?';
    nameEl.textContent = chName;
    if (avatarEl) {
      avatarEl.innerHTML = avatarContentHtml(ch.remote_actor_avatar || '', chName);
    }
    metaEl.innerHTML = '<span class="meta-badge badge-channel">' + esc(lang.dm) + '</span>'
      + (ch.status === 'pending' ? '<span class="meta-badge badge-pending">' + esc(lang.pending) + '</span>' : '')
      + e2eStatusBadgeHtml();
    // Always show history (chat.js defines the helper — never nest it inside another fn).
    var actionsHtml = (typeof historyHeaderButtonHtml === 'function')
      ? historyHeaderButtonHtml()
      : '';
    if (ch.status === 'pending' && ch.initiated_by === 'remote') {
      actionsHtml += '<button class="action-btn action-accept" id="action-accept">' + esc(lang.accept) + '</button>';
      actionsHtml += '<button class="action-btn action-reject" id="action-reject-channel">' + esc(lang.reject || 'Decline') + '</button>';
    }
    if (ch.status !== 'closed') {
      actionsHtml += '<div class="manage-wrap"><button type="button" class="aro-icon-btn manage-btn" id="manage-toggle" title="' + esc(lang.manage) + '" aria-label="' + esc(lang.manage) + '">⋯</button>'
        + '<div class="manage-dropdown" id="manage-dropdown" role="menu">'
        + '<button type="button" class="manage-item manage-item-danger" id="action-close" role="menuitem">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>'
        + esc(lang.close) + '</button></div></div>';
    } else {
      actionsHtml += '<span class="meta-badge badge-closed">' + esc(lang.closed) + '</span>';
      // Closed DMs: allow local delete when API is present
      if (typeof Tapp !== 'undefined' && Tapp.federation && typeof Tapp.federation.deleteChannel === 'function') {
        actionsHtml += '<div class="manage-wrap"><button type="button" class="aro-icon-btn manage-btn" id="manage-toggle" title="' + esc(lang.manage) + '" aria-label="' + esc(lang.manage) + '">⋯</button>'
          + '<div class="manage-dropdown" id="manage-dropdown" role="menu">'
          + '<button type="button" class="manage-item manage-item-danger" id="action-delete-channel" role="menuitem">'
          + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>'
          + esc(lang.deleteChannel || lang.remove || 'Delete') + '</button></div></div>';
      }
    }
    actionsEl.innerHTML = actionsHtml;
  } else if (state.activeKind === 'room' && state.roomDetail) {
    var rm = state.roomDetail;
    var roomPending = (rm.my_membership_status || rm.membership_status || 'active') === 'pending';
    // Public rooms or open invite_policy can be joined without a prior invite.
    var canSelfJoin = !roomPending
      && !rm.my_role
      && (rm.is_public || rm.invite_policy === 'open')
      && typeof Tapp !== 'undefined'
      && Tapp.federation
      && typeof Tapp.federation.joinRoom === 'function';
    nameEl.textContent = rm.name || '?';
    if (avatarEl) {
      avatarEl.innerHTML = avatarContentHtml(rm.avatar_url || '', rm.name || '?');
    }
    var metaHtml = '<span class="meta-badge badge-room">' + (rm.member_count || 0) + ' ' + esc(lang.members) + '</span>'
      + (rm.is_public ? '<span class="meta-badge badge-public">' + esc(lang.publicGroup || 'Public') + '</span>' : '')
      + (roomPending ? '<span class="meta-badge badge-pending">' + esc(lang.pending || 'Pending') + '</span>' : '')
      + (canSelfJoin ? '<span class="meta-badge badge-pending">' + esc(lang.openJoin || 'Open') + '</span>' : '')
      + (!roomPending && rm.my_role && rm.my_role !== 'member' ? '<span class="meta-badge badge-role">' + esc(roleLabel(rm.my_role)) + '</span>' : '')
      + e2eStatusBadgeHtml();
    if (rm.is_public && rm.room_id) {
      metaHtml += '<button type="button" class="chat-room-id-btn" id="chat-room-id-btn" title="'
        + esc(lang.copyRoomId || lang.copy || 'Copy') + '">'
        + esc((lang.roomId || 'ID') + ': ' + rm.room_id) + '</button>';
    }
    metaEl.innerHTML = metaHtml;
    var menuItems = '';
    if (!roomPending && (rm.my_role === 'owner' || rm.my_role === 'admin')) {
      menuItems += '<button type="button" class="manage-item" id="action-edit-room" role="menuitem">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
        + esc(lang.editRoom) + '</button>';
    }
    if (!roomPending && rm.my_role !== 'owner') {
      menuItems += '<button type="button" class="manage-item manage-item-danger" id="action-leave" role="menuitem">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>'
        + esc(lang.leave) + '</button>';
    }
    if (!roomPending && rm.my_role === 'owner') {
      menuItems += '<button type="button" class="manage-item" id="action-transfer-owner" role="menuitem">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M21 3l-7 7"/><path d="M3 3l7 7"/><path d="M12 14v7"/><path d="M9 18l3 3 3-3"/></svg>'
        + esc(lang.transferOwner || 'Transfer ownership') + '</button>';
      menuItems += '<button type="button" class="manage-item manage-item-danger" id="action-dissolve" role="menuitem">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6"/></svg>'
        + esc(lang.dissolve) + '</button>';
    }
    // E2E: share keys so group messages can be encrypted end-to-end
    if (!roomPending && typeof Tapp !== 'undefined' && Tapp.federation && typeof Tapp.federation.initiateRoomE2e === 'function') {
      var e2eMenuLabel = lang.e2ePublish || 'Enable end-to-end encryption';
      var e2eMenuTitle = lang.e2ePublishDesc
        || 'Share your encryption key with this group so only members can read messages.';
      menuItems += '<button type="button" class="manage-item" id="action-room-e2e" role="menuitem" title="'
        + esc(e2eMenuTitle) + '">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>'
        + esc(e2eMenuLabel) + '</button>';
    }
    // History + group files always when room is open (not invite/join-only chrome).
    var historyBtn = typeof historyHeaderButtonHtml === 'function' ? historyHeaderButtonHtml() : '';
    var filesBtn = typeof roomFilesHeaderButtonHtml === 'function' ? roomFilesHeaderButtonHtml() : '';
    var memberToggleHtml = '<button type="button" class="aro-icon-btn member-toggle-btn" id="member-toggle-btn" title="' + esc(lang.members) + '" aria-label="' + esc(lang.members) + '">'
      + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>'
      + '</button>';
    var roomChrome = historyBtn + filesBtn + memberToggleHtml;
    if (roomPending) {
      actionsEl.innerHTML = '<button class="action-btn action-accept" id="action-accept-room">' + esc(lang.accept) + '</button>'
        + '<button class="action-btn action-reject" id="action-reject-room">' + esc(lang.reject || lang.leave || 'Reject') + '</button>';
    } else if (canSelfJoin) {
      actionsEl.innerHTML = '<button class="action-btn action-accept" id="action-join-room">' + esc(lang.joinRoom || lang.accept || 'Join') + '</button>';
    } else if (menuItems) {
      actionsEl.innerHTML = roomChrome + '<div class="manage-wrap"><button type="button" class="aro-icon-btn manage-btn" id="manage-toggle" title="' + esc(lang.manage) + '" aria-label="' + esc(lang.manage) + '">⋯</button>'
        + '<div class="manage-dropdown" id="manage-dropdown" role="menu">' + menuItems + '</div></div>';
    } else {
      actionsEl.innerHTML = roomChrome;
    }
  }

  var acceptBtn = $('action-accept');
  if (acceptBtn) acceptBtn.addEventListener('click', doAcceptChannel);
  var rejectChBtn = $('action-reject-channel');
  if (rejectChBtn) rejectChBtn.addEventListener('click', function () {
    if (typeof doRejectChannel === 'function') doRejectChannel();
  });
  var acceptRoomBtn = $('action-accept-room');
  if (acceptRoomBtn) acceptRoomBtn.addEventListener('click', function () {
    if (typeof doAcceptRoomInvite === 'function') doAcceptRoomInvite();
  });
  var rejectRoomBtn = $('action-reject-room');
  if (rejectRoomBtn) rejectRoomBtn.addEventListener('click', function () {
    if (typeof doRejectRoomInvite === 'function') doRejectRoomInvite();
  });
  var joinRoomBtn = $('action-join-room');
  if (joinRoomBtn) joinRoomBtn.addEventListener('click', function () {
    if (typeof doJoinOpenRoom === 'function') doJoinOpenRoom();
  });
  var closeBtn = $('action-close');
  if (closeBtn) closeBtn.addEventListener('click', function () { closeManageDropdown(); doCloseChannel(); });
  var delChBtn = $('action-delete-channel');
  if (delChBtn) delChBtn.addEventListener('click', function () {
    closeManageDropdown();
    if (typeof doDeleteChannel === 'function') doDeleteChannel();
  });
  var leaveBtn = $('action-leave');
  if (leaveBtn) leaveBtn.addEventListener('click', function () { closeManageDropdown(); doLeaveRoom(); });
  var editRoomBtn = $('action-edit-room');
  if (editRoomBtn) editRoomBtn.addEventListener('click', function () { closeManageDropdown(); showEditRoomDialog(); });
  var dissolveBtn = $('action-dissolve');
  if (dissolveBtn) dissolveBtn.addEventListener('click', function () { closeManageDropdown(); doDissolveRoom(); });
  var transferBtn = $('action-transfer-owner');
  if (transferBtn) transferBtn.addEventListener('click', function () { closeManageDropdown(); doTransferOwnership(); });
  var roomE2eBtn = $('action-room-e2e');
  if (roomE2eBtn) roomE2eBtn.addEventListener('click', function () { closeManageDropdown(); doRoomE2eExchange(); });
  var toggleBtn = $('manage-toggle');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleManageDropdown);
  var memberToggle = $('member-toggle-btn');
  if (memberToggle) memberToggle.addEventListener('click', toggleMemberPanel);
  if (typeof wireHistoryHeaderButton === 'function') wireHistoryHeaderButton();
  if (typeof wireRoomFilesHeaderButton === 'function') wireRoomFilesHeaderButton();
  if (typeof renderE2eReadyBanner === 'function') renderE2eReadyBanner();
  var roomIdBtn = $('chat-room-id-btn');
  if (roomIdBtn && state.roomDetail && state.roomDetail.room_id) {
    roomIdBtn.addEventListener('click', function () {
      var id = state.roomDetail.room_id;
      if (typeof copyTextToClipboard === 'function') {
        copyTextToClipboard(id, { okTitle: lang.copied || 'Copied' });
      } else if (typeof fallbackCopyText === 'function') {
        fallbackCopyText(id);
      }
    });
  }

  if (typeof updateSendState === 'function') updateSendState();
}

// ==================== Member Panel Toggle ====================
state.memberPanelOpen = true; // default open on desktop

function isTablet() { var w = window.innerWidth; return w >= 769 && w <= 1024; }

function toggleMemberPanel() {
  var panel = $('member-panel');
  if (!panel) return;
  var isMobile = window.innerWidth <= 768;
  if (isMobile) {
    panel.classList.toggle('member-open-mobile');
  } else if (isTablet()) {
    panel.classList.toggle('member-expanded-tablet');
    state.memberPanelOpen = panel.classList.contains('member-expanded-tablet');
  } else {
    panel.classList.toggle('member-collapsed');
    state.memberPanelOpen = !panel.classList.contains('member-collapsed');
  }
}

function closeMemberPanel() {
  var panel = $('member-panel');
  if (!panel) return;
  panel.classList.remove('member-open-mobile');
  panel.classList.remove('member-expanded-tablet');
  if (window.innerWidth > 768 && !isTablet()) {
    panel.classList.add('member-collapsed');
  }
  // Mobile full-screen sheet: force hide so it cannot block sidebar/list
  if (window.innerWidth <= 768) {
    panel.style.display = '';
  }
  state.memberPanelOpen = false;
}
