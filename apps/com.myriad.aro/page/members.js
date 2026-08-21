var share = require('./scope.js');

// ==================== Render: Members ====================
// Full function lives here (must not be split across history/files modules).

/** One-time kick/role click delegation on #member-list. */
function bindMemberListActions() {
  var list = $('member-list');
  if (!list || list.dataset.memberActionsBound === '1') return;
  list.dataset.memberActionsBound = '1';
  list.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var kick = t.closest('.member-kick');
    if (kick && list.contains(kick)) {
      e.preventDefault();
      var actorK = kick.getAttribute('data-actor');
      if (actorK) doKickMember(actorK);
      return;
    }
    var roleBtn = t.closest('.member-role-btn');
    if (roleBtn && list.contains(roleBtn)) {
      e.preventDefault();
      var actorR = roleBtn.getAttribute('data-actor');
      var role = roleBtn.getAttribute('data-role');
      if (actorR && role) doSetMemberRole(actorR, role);
    }
  });
}

function membersListFingerprint(members, q, myRole, canKick, canSetRole) {
  var n = (members && members.length) || 0;
  var sig = '';
  for (var i = 0; i < n; i++) {
    var m = members[i];
    sig += (m.actor_url || '') + ':' + (m.role || '') + ':' + (m.membership_status || m.status || '') + ';';
  }
  return [n, q || '', myRole || '', canKick ? 1 : 0, canSetRole ? 1 : 0, sig].join('|');
}

function renderMembers() {
  var panel = $('member-panel');
  if (!panel) return;
  bindMemberListActions();

  if (state.activeKind !== 'room' || !state.roomDetail) {
    // Always clear mobile full-screen sheet — stuck member-open-mobile blocks the list.
    panel.classList.remove('member-open-mobile', 'member-expanded-tablet');
    panel.style.display = 'none';
    panel.style.pointerEvents = 'none';
    state._membersListFp = '';
    return;
  }
  // Desktop: show side panel. Mobile: keep hidden until user opens (member-open-mobile).
  var isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  if (isMobile) {
    // Do not force-show; only ensure pointer-events when intentionally open.
    if (!panel.classList.contains('member-open-mobile')) {
      panel.style.display = '';
      panel.style.pointerEvents = 'none';
      // media query keeps it display:none until .member-open-mobile
    } else {
      panel.style.pointerEvents = 'auto';
    }
  } else {
    // Desktop/tablet: never cover the sidebar list — panel is a side column only.
    panel.style.display = '';
    panel.style.pointerEvents = '';
  }
  var memberTitleCount = (typeof activeMemberCountFromList === 'function')
    ? activeMemberCountFromList(state.members)
    : state.members.length;
  // Show total roster size (incl. pending) when pending rows exist so counts match list.
  var hasPendingMember = (state.members || []).some(function (m) {
    return (m.membership_status || m.status || 'active') === 'pending';
  });
  if (hasPendingMember) memberTitleCount = state.members.length;
  var titleEl = $('member-title');
  if (titleEl) titleEl.textContent = lang.members + ' (' + memberTitleCount + ')';

  var myRole = state.roomDetail.my_role || '';
  var myPending = (state.roomDetail.my_membership_status || state.roomDetail.membership_status || 'active') === 'pending';
  var canKick = !myPending && (myRole === 'owner' || myRole === 'admin');
  var canSetRole = !myPending && myRole === 'owner'
    && typeof Tapp !== 'undefined' && Tapp.federation
    && typeof Tapp.federation.setMemberRole === 'function';
  var memberQ = (state.search && state.search.member) || '';
  var memberQuery = normalizeSearchQuery(memberQ);
  var filteredMembers = !memberQuery ? state.members : state.members.filter(function (m) {
    var name = m.display_name || (m.actor_url || '').split('/').pop() || '';
    return matchesSearch(memberQuery, [name, m.actor_url, m.role, m.username, m.membership_status]);
  });

  var fp = membersListFingerprint(filteredMembers, memberQuery, myRole, canKick, canSetRole);
  var listEl = $('member-list');
  if (fp && fp === state._membersListFp && listEl && listEl.childNodes.length > 0) {
    var inviteWrapSkip = $('invite-wrap');
    if (inviteWrapSkip) {
      inviteWrapSkip.style.display = (!myPending && state.roomDetail && myRole) ? '' : 'none';
    }
    return;
  }
  state._membersListFp = fp;

  var html = '';
  if (state.members.length > 0 && filteredMembers.length === 0) {
    html = searchNoResultsHtml();
  } else {
    filteredMembers.forEach(function (m) {
      var name = m.display_name || (m.actor_url || '').split('/').pop() || '?';
      // 普通成员不显示角色，减少列表噪音；仅标出群主/管理员
      var roleText = (m.role && m.role !== 'member') ? roleLabel(m.role) : '';
      var mStatus = m.membership_status || m.status || 'active';
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
      if (mStatus === 'active' && m.role !== 'owner') {
        html += '<div class="member-actions">';
        if (canSetRole) {
          if (m.role === 'admin') {
            html += '<button type="button" class="member-role-btn" data-actor="'
              + esc(m.actor_url || '') + '" data-role="member" title="'
              + esc(lang.demoteAdmin || 'Remove admin') + '">'
              + esc(lang.demoteAdminShort || 'Demote') + '</button>';
          } else {
            html += '<button type="button" class="member-role-btn" data-actor="'
              + esc(m.actor_url || '') + '" data-role="admin" title="'
              + esc(lang.promoteAdmin || 'Make admin') + '">'
              + esc(lang.promoteAdminShort || 'Admin') + '</button>';
          }
        }
        if (canKick) {
          html += '<button type="button" class="member-kick" data-actor="'
            + esc(m.actor_url || '') + '" title="' + esc(lang.kick) + '" aria-label="'
            + esc(lang.kick) + '">'
            + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>'
            + '</button>';
        }
        html += '</div>';
      } else if (m.is_local) {
        html += '<span class="member-local">' + esc(lang.local) + '</span>';
      }
      html += '</div>';
    });
  }
  if (listEl) listEl.innerHTML = html;

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
function _manageDropdownOutsideClick(e) {
  var dd = $('manage-dropdown');
  if (!dd || !dd.classList.contains('open')) return;
  var wrap = dd.parentElement;
  if (wrap && !wrap.contains(e.target)) closeManageDropdown();
}
/** Call from bindEvents after page bag is live (ARO-14). */
function registerManageDropdownOutsideGuard() {
  pageListen(document, 'click', _manageDropdownOutsideClick);
}

// ==================== Pending invite / open-join CTAs (mid-pane) ====================
/** Remote-initiated DM that still needs Accept/Reject. */
function isRemoteChannelInvitePending() {
  return state.activeKind === 'channel'
    && !!state.channelDetail
    && state.channelDetail.status === 'pending'
    && state.channelDetail.initiated_by === 'remote';
}

/** Public/open room the user can join without an invite. */
function canSelfJoinActiveRoom() {
  if (state.activeKind !== 'room' || !state.roomDetail) return false;
  if (typeof isRoomInvitePending === 'function' ? isRoomInvitePending() : false) return false;
  var rm = state.roomDetail;
  return !rm.my_role
    && (rm.is_public || rm.invite_policy === 'open')
    && typeof Tapp !== 'undefined'
    && Tapp.federation
    && typeof Tapp.federation.joinRoom === 'function';
}

/**
 * Describe mid-pane invite/join UI, or null when the conversation is open.
 * @returns {{kind:string,title:string,reason:string,avatarUrl:string,primaryId:string,primaryLabel:string,secondaryId:?string,secondaryLabel:?string}|null}
 */
function getPendingInviteUi() {
  if (isRemoteChannelInvitePending()) {
    var ch = state.channelDetail;
    var chName = ch.remote_actor_name || (ch.remote_actor_url || '').split('/').pop() || '?';
    return {
      kind: 'channel-invite',
      title: chName,
      reason: lang.inviteAcceptHint || lang.channelNotAccepted || lang.pending || 'Accept to start messaging',
      avatarUrl: ch.remote_actor_avatar || '',
      primaryId: 'pending-accept-channel',
      primaryLabel: lang.accept || 'Accept',
      secondaryId: 'pending-reject-channel',
      secondaryLabel: lang.reject || 'Decline',
    };
  }
  if (typeof isRoomInvitePending === 'function' && isRoomInvitePending()) {
    var rm = state.roomDetail;
    return {
      kind: 'room-invite',
      title: (rm && rm.name) || '?',
      reason: lang.roomInvitePending || lang.pending || 'Accept the invite to chat in this group',
      avatarUrl: (rm && rm.avatar_url) || '',
      primaryId: 'pending-accept-room',
      primaryLabel: lang.accept || 'Accept',
      secondaryId: 'pending-reject-room',
      secondaryLabel: lang.reject || lang.leave || 'Decline',
    };
  }
  if (canSelfJoinActiveRoom()) {
    var rmJoin = state.roomDetail;
    return {
      kind: 'room-join',
      title: (rmJoin && rmJoin.name) || '?',
      reason: lang.roomJoinHint || lang.joinRoom || 'Join this group to chat',
      avatarUrl: (rmJoin && rmJoin.avatar_url) || '',
      primaryId: 'pending-join-room',
      primaryLabel: lang.joinRoom || lang.accept || 'Join',
      secondaryId: null,
      secondaryLabel: null,
    };
  }
  return null;
}

var PENDING_INVITE_ICON_CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
var PENDING_INVITE_ICON_X = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';

/** HTML for the centered invite/join card inside #messages. */
function pendingInviteBannerHtml(ui) {
  if (!ui) return '';
  var regionLabel = ui.kind === 'room-join'
    ? (lang.joinRoom || 'Join')
    : (lang.pending || 'Pending');
  var html = '<div class="messages-empty pending-invite-pane" role="region" aria-label="'
    + esc(regionLabel) + '">'
    + '<div class="pending-invite-card">'
    + '<div class="pending-invite-avatar" aria-hidden="true">'
    + avatarContentHtml(ui.avatarUrl || '', ui.title || '?')
    + '</div>'
    + '<div class="pending-invite-title">' + esc(ui.title || '') + '</div>'
    + '<p class="pending-invite-reason">' + esc(ui.reason || '') + '</p>'
    + '<div class="pending-invite-actions">';
  html += '<button type="button" class="pending-invite-btn pending-invite-btn-primary" id="'
    + esc(ui.primaryId) + '">'
    + PENDING_INVITE_ICON_CHECK
    + '<span>' + esc(ui.primaryLabel || lang.accept || 'Accept') + '</span></button>';
  if (ui.secondaryId) {
    html += '<button type="button" class="pending-invite-btn pending-invite-btn-secondary" id="'
      + esc(ui.secondaryId) + '">'
      + PENDING_INVITE_ICON_X
      + '<span>' + esc(ui.secondaryLabel || lang.reject || 'Decline') + '</span></button>';
  }
  html += '</div></div></div>';
  return html;
}

/** Bind Accept / Reject / Join on the mid-pane card (re-bound after each render). */
function wirePendingInviteBanner() {
  var acceptCh = $('pending-accept-channel');
  if (acceptCh) acceptCh.addEventListener('click', function () {
    if (typeof doAcceptChannel === 'function') doAcceptChannel();
  });
  var rejectCh = $('pending-reject-channel');
  if (rejectCh) rejectCh.addEventListener('click', function () {
    if (typeof doRejectChannel === 'function') doRejectChannel();
  });
  var acceptRoom = $('pending-accept-room');
  if (acceptRoom) acceptRoom.addEventListener('click', function () {
    if (typeof doAcceptRoomInvite === 'function') doAcceptRoomInvite();
  });
  var rejectRoom = $('pending-reject-room');
  if (rejectRoom) rejectRoom.addEventListener('click', function () {
    if (typeof doRejectRoomInvite === 'function') doRejectRoomInvite();
  });
  var joinRoom = $('pending-join-room');
  if (joinRoom) joinRoom.addEventListener('click', function () {
    if (typeof doJoinOpenRoom === 'function') doJoinOpenRoom();
  });
}

/**
 * When the open conversation needs accept/reject/join, fill #messages with the
 * centered card. Returns true if the banner was shown (caller should skip normal messages).
 */
function renderPendingInviteBanner() {
  var ui = getPendingInviteUi();
  if (!ui) return false;
  var container = $('messages');
  if (!container) return false;
  container.innerHTML = pendingInviteBannerHtml(ui);
  wirePendingInviteBanner();
  var pb = $('pinned-bar');
  if (pb) pb.style.display = 'none';
  state.skipMsgAppear = false;
  return true;
}

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
    // History + manage stay in header; Accept/Reject live mid-pane (see renderPendingInviteBanner).
    var actionsHtml = (typeof historyHeaderButtonHtml === 'function')
      ? historyHeaderButtonHtml()
      : '';
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
    var canSelfJoin = canSelfJoinActiveRoom();
    nameEl.textContent = rm.name || '?';
    if (avatarEl) {
      avatarEl.innerHTML = avatarContentHtml(rm.avatar_url || '', rm.name || '?');
    }
    // Prefer live roster length when loaded — roomDetail.member_count lags after joins.
    var liveMemberCount = (state.members && state.members.length && typeof activeMemberCountFromList === 'function')
      ? activeMemberCountFromList(state.members)
      : (rm.member_count || 0);

    // Room header meta: default collapsed — only member count + critical status.
    // Public / role / E2E-on / room id live behind a one-tap expand.
    if (!state.chatMetaUi) state.chatMetaUi = { expanded: false, roomId: null };
    var roomKey = String(rm.room_id || rm.id || rm.name || '');
    if (state.chatMetaUi.roomId !== roomKey) {
      state.chatMetaUi.roomId = roomKey;
      state.chatMetaUi.expanded = false;
    }
    var metaExpanded = !!state.chatMetaUi.expanded;

    var primaryBits = [];
    primaryBits.push('<span class="meta-badge badge-room">' + liveMemberCount + ' ' + esc(lang.members) + '</span>');
    if (roomPending) {
      primaryBits.push('<span class="meta-badge badge-pending">' + esc(lang.pending || 'Pending') + '</span>');
    }
    // Keep "waiting for E2E" visible — actionable status; "encrypted" is secondary.
    var e2eHtml = typeof e2eStatusBadgeHtml === 'function' ? e2eStatusBadgeHtml() : '';
    var e2eIsWait = e2eHtml.indexOf('badge-e2e-wait') !== -1;
    if (e2eIsWait) primaryBits.push(e2eHtml);

    var extraBits = [];
    if (rm.is_public) {
      extraBits.push('<span class="meta-badge badge-public">' + esc(lang.publicGroup || 'Public') + '</span>');
    }
    if (canSelfJoin) {
      extraBits.push('<span class="meta-badge badge-pending">' + esc(lang.openJoin || 'Open') + '</span>');
    }
    if (!roomPending && rm.my_role && rm.my_role !== 'member') {
      extraBits.push('<span class="meta-badge badge-role">' + esc(roleLabel(rm.my_role)) + '</span>');
    }
    if (e2eHtml && !e2eIsWait) extraBits.push(e2eHtml);
    if (rm.is_public && rm.room_id) {
      var shareId = typeof shareableRoomId === 'function' ? shareableRoomId(rm) : rm.room_id;
      extraBits.push(
        '<button type="button" class="chat-room-id-btn" id="chat-room-id-btn" title="'
        + esc(lang.copyRoomId || lang.copy || 'Copy') + '">'
        + esc((lang.roomId || 'ID') + ': ' + shareId) + '</button>'
      );
    }

    var hasExtra = extraBits.length > 0;
    var moreLabel = lang.chatMetaMore || lang.more || 'More';
    var lessLabel = lang.chatMetaLess || lang.less || 'Less';
    var toggleLabel = metaExpanded ? lessLabel : moreLabel;
    var metaHtml = '<div class="chat-meta-room' + (metaExpanded ? ' is-expanded' : ' is-collapsed') + '">';
    metaHtml += '<div class="chat-meta-primary">';
    metaHtml += primaryBits.join('');
    if (hasExtra) {
      metaHtml += '<button type="button" class="chat-meta-toggle" id="chat-meta-toggle"'
        + ' aria-expanded="' + (metaExpanded ? 'true' : 'false') + '"'
        + ' title="' + esc(toggleLabel) + '" aria-label="' + esc(toggleLabel) + '">'
        + '<span class="chat-meta-toggle-label">' + esc(toggleLabel) + '</span>'
        + '<svg class="chat-meta-toggle-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
        + '</button>';
    }
    metaHtml += '</div>';
    if (hasExtra) {
      metaHtml += '<div class="chat-meta-extra" id="chat-meta-extra"'
        + (metaExpanded ? '' : ' hidden') + '>';
      metaHtml += extraBits.join('');
      metaHtml += '</div>';
    }
    metaHtml += '</div>';
    metaEl.innerHTML = metaHtml;
    var menuItems = '';
    // Fold secondary chrome (history / files) into ⋯ so the toolbar stays: members + manage.
    if (!roomPending) {
      menuItems += '<button type="button" class="manage-item" id="action-room-history" role="menuitem">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
        + esc(lang.historyTitle || 'Chat history') + '</button>';
      menuItems += '<button type="button" class="manage-item" id="action-room-files" role="menuitem">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>'
        + esc(lang.roomFilesTitle || 'Group files') + '</button>';
    }
    if (!roomPending && (rm.my_role === 'owner' || rm.my_role === 'admin')) {
      menuItems += '<button type="button" class="manage-item" id="action-edit-room" role="menuitem">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
        + esc(lang.editRoom || lang.roomSettings || 'Group settings') + '</button>';
      menuItems += '<button type="button" class="manage-item" id="action-room-stickers" role="menuitem">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/><path d="M8.4 13.6c.95 1.4 2.2 2.15 3.6 2.15s2.65-.75 3.6-2.15" stroke-linecap="round"/></svg>'
        + esc(lang.stickerTabRoom || lang.manageStickers || 'Group stickers') + '</button>';
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
    // Compact toolbar: members + ⋯ only (history/files folded into menu).
    var memberToggleHtml = '<button type="button" class="aro-icon-btn member-toggle-btn" id="member-toggle-btn" title="' + esc(lang.members) + '" aria-label="' + esc(lang.members) + '">'
      + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>'
      + '</button>';
    if (roomPending || canSelfJoin) {
      // Header stays free of accept/reject/join; mid-pane card owns those CTAs.
      actionsEl.innerHTML = '';
    } else if (menuItems) {
      actionsEl.innerHTML = memberToggleHtml + '<div class="manage-wrap"><button type="button" class="aro-icon-btn manage-btn" id="manage-toggle" title="' + esc(lang.manage) + '" aria-label="' + esc(lang.manage) + '">⋯</button>'
        + '<div class="manage-dropdown" id="manage-dropdown" role="menu">' + menuItems + '</div></div>';
    } else {
      actionsEl.innerHTML = memberToggleHtml;
    }
  }

  var closeBtn = $('action-close');
  if (closeBtn) closeBtn.addEventListener('click', function () { closeManageDropdown(); doCloseChannel(); });
  var delChBtn = $('action-delete-channel');
  if (delChBtn) delChBtn.addEventListener('click', function () {
    closeManageDropdown();
    if (typeof doDeleteChannel === 'function') doDeleteChannel();
  });
  var leaveBtn = $('action-leave');
  if (leaveBtn) leaveBtn.addEventListener('click', function () { closeManageDropdown(); doLeaveRoom(); });
  var histMenuBtn = $('action-room-history');
  if (histMenuBtn) {
    histMenuBtn.addEventListener('click', function () {
      closeManageDropdown();
      if (typeof openChatHistory === 'function') openChatHistory();
    });
  }
  var filesMenuBtn = $('action-room-files');
  if (filesMenuBtn) {
    filesMenuBtn.addEventListener('click', function () {
      closeManageDropdown();
      if (typeof openRoomFiles === 'function') openRoomFiles();
    });
  }
  var editRoomBtn = $('action-edit-room');
  if (editRoomBtn) editRoomBtn.addEventListener('click', function () { closeManageDropdown(); showEditRoomDialog(); });
  var stickersBtn = $('action-room-stickers');
  if (stickersBtn) {
    stickersBtn.addEventListener('click', function () {
      closeManageDropdown();
      // Open sticker panel on Group tab (admin edit UI).
      if (typeof openStickerPanel === 'function') {
        if (typeof setStickerTab === 'function') setStickerTab('room');
        else {
          try {
            if (typeof ensureStickerState === 'function') {
              ensureStickerState().tab = 'room';
            }
            if (typeof _stickerTab !== 'undefined') _stickerTab = 'room';
          } catch (eT) { /* ignore */ }
        }
        openStickerPanel();
        if (typeof setStickerTab === 'function') setStickerTab('room');
      } else if (typeof notifyError === 'function') {
        notifyError(lang.stickerApiMissing || 'Stickers unavailable');
      }
    });
  }
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
  var metaToggle = $('chat-meta-toggle');
  if (metaToggle) {
    metaToggle.addEventListener('click', function (e) {
      try { e.stopPropagation(); } catch (eSp) { /* ignore */ }
      if (!state.chatMetaUi) state.chatMetaUi = { expanded: false, roomId: null };
      state.chatMetaUi.expanded = !state.chatMetaUi.expanded;
      // Re-render so aria/labels and hidden attrs stay consistent.
      renderChatHeader();
    });
  }
  var roomIdBtn = $('chat-room-id-btn');
  if (roomIdBtn && state.roomDetail && state.roomDetail.room_id) {
    roomIdBtn.addEventListener('click', function () {
      var id = typeof shareableRoomId === 'function'
        ? shareableRoomId(state.roomDetail)
        : state.roomDetail.room_id;
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
    if (panel.classList.contains('member-open-mobile')) {
      panel.style.pointerEvents = 'auto';
    } else {
      panel.style.pointerEvents = 'none';
    }
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
    panel.style.pointerEvents = 'none';
  }
  state.memberPanelOpen = false;
}

// ==================== Shared scope ====================
// Republish the names this file's siblings read. See page/scope.js.
share.value({
  closeManageDropdown: closeManageDropdown,
  closeMemberPanel: closeMemberPanel,
  registerManageDropdownOutsideGuard: registerManageDropdownOutsideGuard,
  renderChatHeader: renderChatHeader,
  renderMembers: renderMembers,
  renderPendingInviteBanner: renderPendingInviteBanner,
});
