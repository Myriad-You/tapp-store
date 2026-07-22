// ==================== API ====================
async function loadConversations() {
  var gen = (state.convLoadGen = (state.convLoadGen || 0) + 1);
  try {
    var results = await Promise.allSettled([
      Tapp.federation.getChannels(),
      Tapp.federation.getRooms(),
    ]);
    // Stale reload finished after a newer one — do not flash older list data.
    if (gen !== state.convLoadGen) return;
    var errors = [];
    if (results[0].status === 'fulfilled' && results[0].value) {
      state.channels = results[0].value.channels || [];
    } else if (results[0].status === 'rejected') {
      console.error('[Aro] getChannels failed:', results[0].reason);
      errors.push(String(results[0].reason));
    }
    if (results[1].status === 'fulfilled' && results[1].value) {
      state.rooms = results[1].value.rooms || [];
    } else if (results[1].status === 'rejected') {
      console.error('[Aro] getRooms failed:', results[1].reason);
      errors.push(String(results[1].reason));
    }
    renderConvList();
    if (errors.length > 0 && state.channels.length === 0 && state.rooms.length === 0) {
      var list = $('conv-list');
      if (list) {
        list.innerHTML = '<div class="conv-empty conv-empty-fill" style="color:#b91c1c;font-size:12px;line-height:1.5;max-width:220px;text-align:center">'
          + '<div style="font-weight:600;margin-bottom:4px">' + esc(lang.loadFail || 'Load failed') + '</div>'
          + '<div style="opacity:.85;white-space:pre-wrap">' + esc(errors.join('\n')) + '</div></div>';
      }
    }
    // Soft dead-letter check (host notification center is primary)
    if (typeof refreshDeliveryHealth === 'function') {
      refreshDeliveryHealth().catch(function () {});
    }
  } catch (e) {
    if (gen !== state.convLoadGen) return;
    console.error('[Aro] loadConversations error:', e);
  }
}

/**
 * True if this openGeneration is still the latest conversation open.
 * Used after every await so rapid A→B switches cannot flashback A.
 */
function isOpenGenCurrent(gen) {
  return gen != null && gen === state.openGen;
}

/** True if UI is still showing this conversation (kind+id) for gen. */
function isConversationCurrent(kind, id, gen) {
  if (gen != null && gen !== state.openGen) return false;
  return state.activeKind === kind && state.activeId === id;
}

async function openConversation(kind, id) {
  if (!kind || !id) return;
  // Invalidate any in-flight open/poll/realtime apply for the previous target.
  var gen = (state.openGen = (state.openGen || 0) + 1);

  // Stop poll immediately so a prior interval cannot write into the new shell.
  stopPolling();

  // ---- Synchronous shell update FIRST (must not await before this) ----
  // Clicks on 最近/list must paint active chat immediately; network teardown
  // (unsubscribeRealtime) and message loads happen after first paint.
  // Drop click-shields / sheets that would sit above the list or chat.
  if (typeof dismissTransientUi === 'function') {
    dismissTransientUi({ keepChat: true });
  }
  if (typeof resetHistoryOnConversationChange === 'function') resetHistoryOnConversationChange();
  if (typeof resetRoomFilesOnConversationChange === 'function') resetRoomFilesOnConversationChange();

  state.activeKind = kind;
  state.activeId = id;
  state.messages = [];
  state.messagesFp = '';
  state.skipMsgAppear = true;
  state.members = [];
  state.channelDetail = null;
  state.roomDetail = null;
  state.chatLoadError = null;
  // Drop previous composer lock immediately; re-lock channels until detail proves writable.
  if (typeof clearPendingAttach === 'function') clearPendingAttach();
  if (typeof clearQuote === 'function') clearQuote();
  if (typeof closeAttachMenu === 'function') closeAttachMenu();
  if (typeof updateSendState === 'function') updateSendState();

  var emptyEl = $('empty-state');
  if (emptyEl) emptyEl.style.display = 'none';
  var chatEl = $('chat-container');
  if (chatEl) {
    chatEl.style.display = '';
    // Only animate enter when this open is still current (avoids double-play on rapid switch)
    if (isOpenGenCurrent(gen) && typeof aroPlayEnter === 'function') {
      aroPlayEnter(chatEl, 'aro-panel-enter');
    }
  }
  var sideEl = $('sidebar');
  if (sideEl) sideEl.classList.add('sidebar-hidden-mobile');

  renderMessages();
  renderChatHeader();
  // Refresh active highlight without waiting for network
  renderConvList();

  // ---- Async work after first paint (stale-guarded with openGen) ----
  // Never block UI open on realtime unsubscribe.
  await unsubscribeRealtime();
  if (!isOpenGenCurrent(gen)) return;

  try {
    if (kind === 'channel') {
      var results = await Promise.all([
        Tapp.federation.getChannel(id),
        Tapp.federation.getMessages(id, undefined, 200),
      ]);
      if (!isConversationCurrent(kind, id, gen)) return;
      if (results[0]) {
        state.channelDetail = results[0];
        // Derive local actor URL: find a message sender that is NOT the remote actor
        if (!state.localActorUrl && results[0].remote_actor_url) {
          var msgs = (results[1] && results[1].messages) || [];
          for (var mi = 0; mi < msgs.length; mi++) {
            var senderActor = msgs[mi].sender_actor;
            if (senderActor && !sameActorUrl(senderActor, results[0].remote_actor_url)) {
              state.localActorUrl = normalizeFederationUrl(senderActor) || senderActor;
              break;
            }
          }
        }
      }
      if (results[1]) {
        state.messages = results[1].messages || [];
        state.messagesFp = messagesFingerprint(state.messages);
      }
    } else {
      // Pending invites cannot load messages (403) — use allSettled so detail/members still open
      var roomParts = await Promise.allSettled([
        Tapp.federation.getRoom(id),
        Tapp.federation.getRoomMembers(id),
        Tapp.federation.getRoomMessages(id, undefined, 200),
      ]);
      if (!isConversationCurrent(kind, id, gen)) return;
      if (roomParts[0].status === 'fulfilled' && roomParts[0].value) {
        state.roomDetail = roomParts[0].value;
      } else if (roomParts[0].status === 'rejected') {
        throw roomParts[0].reason;
      }
      if (roomParts[1].status === 'fulfilled' && roomParts[1].value) {
        state.members = unwrapRoomMembers(roomParts[1].value);
        // Extract local actor URL from members list
        if (!state.localActorUrl) {
          for (var i = 0; i < state.members.length; i++) {
            var memberActor = normalizeFederationUrl(state.members[i].actor_url);
            if (state.members[i].is_local && memberActor) { state.localActorUrl = memberActor; break; }
          }
        }
      }
      if (roomParts[2].status === 'fulfilled' && roomParts[2].value) {
        state.messages = roomParts[2].value.messages || [];
        state.messagesFp = messagesFingerprint(state.messages);
      } else {
        // pending membership: empty transcript is expected
        state.messages = [];
        state.messagesFp = '';
      }
    }
  } catch (e) {
    if (!isConversationCurrent(kind, id, gen)) return;
    console.error('[Aro] openConversation failed:', e);
    state.chatLoadError = (e && (e.message || e.error || String(e))) || (lang.loadFail || 'Load failed');
    notifyError(lang.loadFail || lang.sendFail || 'Load failed', e);
  }

  if (!isConversationCurrent(kind, id, gen)) return;

  renderChatHeader();
  renderMessages();
  renderMembers();
  renderConvList();
  updateSendState();
  startPolling();
  subscribeRealtime();
  // Best-effort E2E key publish after open (non-blocking); ignore if user already left
  if (typeof maybePublishE2eKeys === 'function') {
    maybePublishE2eKeys().then(function () {
      if (!isConversationCurrent(kind, id, gen)) return;
      if (typeof maybeAnnounceE2eEstablished === 'function') maybeAnnounceE2eEstablished();
    }).catch(function () {});
  } else if (typeof maybeAnnounceE2eEstablished === 'function') {
    maybeAnnounceE2eEstablished();
  }
  var focusInput = $('msg-input');
  if (focusInput && !focusInput.disabled) {
    try { focusInput.focus(); } catch (e) { /* ignore */ }
  }
}

/**
 * E2E readiness for active conversation.
 * @returns {{ status: 'none'|'waiting'|'established', label: string, peerCount?: number }}
 */
function getE2eStatusForActive() {
  try {
    if (state.activeKind === 'channel' && state.channelDetail) {
      var props = state.channelDetail.properties || {};
      var e2e = props.e2e || props.E2E || null;
      if (!e2e) return { status: 'none', label: '' };
      var hasLocal = !!(e2e.local_public_key);
      var hasRemote = !!(e2e.remote_public_key);
      var established = e2e.established === true || e2e.established === 'true' || (hasLocal && hasRemote);
      if (established && hasLocal && hasRemote) {
        return {
          status: 'established',
          label: lang.e2eEstablished || 'End-to-end encryption active',
        };
      }
      if (hasLocal && !hasRemote) {
        return {
          status: 'waiting',
          label: lang.e2eLocalOnly || lang.e2eWaitingPeer || 'Waiting for peer encryption key',
        };
      }
      if (!hasLocal && hasRemote) {
        return {
          status: 'waiting',
          label: lang.e2eWaitingPeer || 'Waiting for peer encryption key',
        };
      }
      return { status: 'none', label: '' };
    }
    if (state.activeKind === 'room') {
      // Room multi-recipient: only encrypt when we already published and at least
      // one peer key is known (best-effort from detail if present).
      var rd = state.roomDetail || {};
      var shared = rd.shared_data_config || rd.sharedDataConfig || {};
      var re2e = (shared.e2e || {});
      var keys = re2e.published_keys || re2e.publishedKeys || {};
      var n = 0;
      if (keys && typeof keys === 'object') {
        for (var k in keys) {
          if (Object.prototype.hasOwnProperty.call(keys, k) && keys[k]) n++;
        }
      }
      if (n >= 2) {
        return {
          status: 'established',
          label: lang.e2eEstablished || 'End-to-end encryption active',
          peerCount: n,
        };
      }
      if (n === 1) {
        return {
          status: 'waiting',
          label: lang.e2eLocalOnly || lang.e2eWaitingPeer || 'Waiting for peer encryption key',
          peerCount: n,
        };
      }
      return { status: 'none', label: '', peerCount: 0 };
    }
  } catch (e0) { /* ignore */ }
  return { status: 'none', label: '' };
}

/**
 * Whether active channel/room can encrypt (both sides have keys / room has peers).
 * Used so we do not force encrypt=true into a half-open session.
 */
function isE2eReadyForActive() {
  return getE2eStatusForActive().status === 'established';
}

var E2E_LOCK_SVG = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>';

/** Header meta badge HTML for current E2E status (empty when none). */
function e2eStatusBadgeHtml() {
  var st = getE2eStatusForActive();
  if (st.status === 'established') {
    return '<span class="meta-badge badge-e2e-on" title="' + esc(st.label) + '">'
      + E2E_LOCK_SVG + esc(st.label) + '</span>';
  }
  if (st.status === 'waiting') {
    return '<span class="meta-badge badge-e2e-wait" title="' + esc(st.label) + '">'
      + E2E_LOCK_SVG + esc(st.label) + '</span>';
  }
  return '';
}

/** Banner under chat header when encryption is live. */
function renderE2eReadyBanner() {
  var el = $('e2e-ready-banner');
  if (!el) return;
  var st = getE2eStatusForActive();
  if (st.status === 'established') {
    var text = lang.e2eEstablishedBanner || st.label
      || 'Messages in this chat are end-to-end encrypted';
    el.innerHTML = E2E_LOCK_SVG + '<span>' + esc(text) + '</span>';
    el.hidden = false;
    el.setAttribute('aria-label', text);
  } else {
    el.innerHTML = '';
    el.hidden = true;
  }
}

/**
 * After key publish / open: if session just became established, toast once per conversation.
 */
function maybeAnnounceE2eEstablished() {
  var st = getE2eStatusForActive();
  if (st.status !== 'established') return;
  if (!state._e2eAnnounced) state._e2eAnnounced = {};
  var key = (state.activeKind || '') + ':' + (state.activeId || '');
  if (state._e2eAnnounced[key]) return;
  state._e2eAnnounced[key] = true;
  try {
    Tapp.ui.showNotification({
      title: lang.e2eEstablished || 'End-to-end encryption active',
      message: lang.e2eEstablishedBanner || '',
      type: 'success',
    });
  } catch (e0) { /* ignore */ }
}

/** Auto-publish E2E keys when opening an active channel/room (if API present). */
async function maybePublishE2eKeys() {
  if (typeof Tapp === 'undefined' || !Tapp.federation) return;
  var s = state.aroSettings || (typeof loadAroSettings === 'function' ? loadAroSettings() : null);
  if (s && s.autoE2eOnOpen === false) return;
  // Dedupe per open: opening chat used to mint a NEW keypair every time, which
  // broke decrypt and left a trail of outbound KeyExchange JSON in the transcript.
  if (!state._e2ePublishOnce) state._e2ePublishOnce = {};
  var onceKey = (state.activeKind || '') + ':' + (state.activeId || '');
  if (state._e2ePublishOnce[onceKey]) return;

  if (state.activeKind === 'channel' && state.activeId
    && typeof Tapp.federation.initiateChannelE2e === 'function') {
    var st = state.channelDetail && state.channelDetail.status;
    if (st === 'active' || st === 'accepted') {
      // Already have local key → backend will reuse; skip noisy re-publish if established
      var chE2e = state.channelDetail && state.channelDetail.properties
        && state.channelDetail.properties.e2e;
      if (chE2e && chE2e.local_public_key && chE2e.remote_public_key) {
        state._e2ePublishOnce[onceKey] = true;
        return;
      }
      try {
        await Tapp.federation.initiateChannelE2e(state.activeId);
        state._e2ePublishOnce[onceKey] = true;
        // Refresh channel detail so e2e.established / keys appear in header
        if (typeof Tapp.federation.getChannel === 'function') {
          try {
            var chFresh = await Tapp.federation.getChannel(state.activeId);
            if (chFresh) state.channelDetail = chFresh.data || chFresh;
          } catch (eRef) { /* ignore */ }
        }
        if (typeof renderChatHeader === 'function') renderChatHeader();
        if (typeof maybeAnnounceE2eEstablished === 'function') maybeAnnounceE2eEstablished();
      } catch (e) {
        console.debug('[Aro] channel E2E exchange skipped', e);
      }
    }
  } else if (state.activeKind === 'room' && state.activeId
    && typeof Tapp.federation.initiateRoomE2e === 'function') {
    try {
      await Tapp.federation.initiateRoomE2e(state.activeId);
      state._e2ePublishOnce[onceKey] = true;
      if (typeof Tapp.federation.getRoom === 'function') {
        try {
          var rmFresh = await Tapp.federation.getRoom(state.activeId);
          if (rmFresh) state.roomDetail = rmFresh.data || rmFresh;
        } catch (eRef2) { /* ignore */ }
      }
      if (typeof renderChatHeader === 'function') renderChatHeader();
      if (typeof maybeAnnounceE2eEstablished === 'function') maybeAnnounceE2eEstablished();
    } catch (e) {
      console.debug('[Aro] room E2E publish skipped', e);
    }
  }
}

async function doRoomE2eExchange() {
  if (!state.activeId || state.activeKind !== 'room') return;
  if (typeof Tapp.federation.initiateRoomE2e !== 'function') return;
  try {
    var res = await Tapp.federation.initiateRoomE2e(state.activeId);
    var n = (res && (res.published_key_count != null ? res.published_key_count : res.data && res.data.published_key_count)) || '';
    if (typeof Tapp.federation.getRoom === 'function') {
      try {
        var rm2 = await Tapp.federation.getRoom(state.activeId);
        if (rm2) state.roomDetail = rm2.data || rm2;
      } catch (eR) { /* ignore */ }
    }
    if (typeof renderChatHeader === 'function') renderChatHeader();
    var est = getE2eStatusForActive();
    try {
      if (est.status === 'established') {
        Tapp.ui.showNotification({
          title: lang.e2eEstablished || 'End-to-end encryption active',
          message: lang.e2eEstablishedBanner || '',
          type: 'success',
        });
        if (typeof maybeAnnounceE2eEstablished === 'function') maybeAnnounceE2eEstablished();
      } else {
        Tapp.ui.showNotification({
          title: lang.e2ePublished || 'Encryption key shared with this chat',
          message: est.label
            || lang.e2ePublishDesc
            || (n ? String(n) : undefined),
          type: 'success',
        });
      }
    } catch (e0) { /* ignore */ }
  } catch (e) {
    notifyError(lang.e2eFail || lang.sendFail || 'E2E failed', e);
  }
}

async function doTransferOwnership() {
  if (!state.activeId || state.activeKind !== 'room') return;
  if (typeof Tapp.federation.transferRoomOwnership !== 'function') {
    try {
      Tapp.ui.showNotification({ title: lang.transferOwnerUnsupported || 'Not available', type: 'error' });
    } catch (e0) { /* ignore */ }
    return;
  }
  var candidates = (state.members || []).filter(function (m) {
    return m.role !== 'owner' && m.role !== 'observer' && !(typeof isLocalActor === 'function' && isLocalActor(m.actor_url));
  });
  // Include local non-self members too
  candidates = (state.members || []).filter(function (m) {
    return m.role !== 'owner' && m.role !== 'observer';
  });
  if (!candidates.length) {
    try {
      Tapp.ui.showNotification({
        title: lang.transferOwnerEmpty || 'No member to transfer to',
        type: 'error',
      });
    } catch (e1) { /* ignore */ }
    return;
  }
  var lines = candidates.map(function (m, i) {
    var name = m.display_name || (m.actor_url || '').split('/').pop() || m.actor_url;
    return (i + 1) + '. ' + name;
  }).join('\n');
  var pick = window.prompt(
    (lang.transferOwnerPrompt || 'Transfer ownership to member number:') + '\n' + lines,
    '1'
  );
  if (!pick) return;
  var idx = parseInt(pick, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= candidates.length) {
    try {
      Tapp.ui.showNotification({ title: lang.transferOwnerInvalid || 'Invalid choice', type: 'error' });
    } catch (e2) { /* ignore */ }
    return;
  }
  var target = candidates[idx];
  var label = target.display_name || target.actor_url;
  if (!(await aroConfirm((lang.transferOwnerConfirm || 'Transfer ownership to {name}?').replace('{name}', label), true))) {
    return;
  }
  try {
    await Tapp.federation.transferRoomOwnership(state.activeId, target.actor_url);
    var detail = await Tapp.federation.getRoom(state.activeId);
    if (detail) state.roomDetail = detail;
    var membersRes = await Tapp.federation.getRoomMembers(state.activeId);
    state.members = unwrapRoomMembers(membersRes);
    renderMembers();
    renderChatHeader();
    try {
      Tapp.ui.showNotification({
        title: lang.transferOwnerOk || 'Ownership transferred',
        type: 'success',
      });
    } catch (e3) { /* ignore */ }
  } catch (e) {
    notifyError(lang.transferOwnerFail || lang.sendFail || 'Transfer failed', e);
  }
}

async function doSend() {
  var input = $('msg-input');
  if (!input) return;

  var text = input.value.trim();
  var attach = state.pendingAttach;

  // Need either text or attachment
  if ((!text && !attach) || !state.activeId || state.sending) return;
  // Backend only accepts active|accepted; pending/closed must not clear the input
  if (typeof isChannelComposerLocked === 'function' ? isChannelComposerLocked() : (
    state.activeKind === 'channel' && state.channelDetail && state.channelDetail.status === 'closed'
  )) return;

  input.value = '';
  autoResizeInput(input);
  state.sending = true;
  updateSendState();
  closeAttachMenu();
  closeMsgMenu();

  try {
    var msgPayload;
    var msgType;

    // Attach quote info if replying to a message
    var replyTo = null;
    if (state.quoteMsg) {
      replyTo = state.quoteMsg.message_id;
    }

    if (attach && (attach.type === 'image' || attach.type === 'file')) {
      var useChunked = attach.size > INLINE_ATTACH_MAX;
      if (useChunked) {
        if (state.activeKind !== 'channel' && state.activeKind !== 'room') {
          throw new Error(lang.fileTooLarge || 'File too large');
        }
        clearPendingAttach();
        await sendChunkedFileTransfer(attach, text, replyTo);
        if (state.quoteMsg) clearQuote();
        await pollMessages(true);
        return;
      }

      // Small files: inline base64 under backend payload budget
      var dataUrl = attach.data;
      if (!dataUrl && attach.file) {
        dataUrl = await readFileAsDataURL(attach.file);
      }
      if (!dataUrl) throw new Error('Failed to read file');
      msgType = attach.type === 'image' ? 'image' : 'file';
      msgPayload = { data: dataUrl, filename: attach.name, mime_type: attach.mime, size: attach.size, text: text || '' };
      clearPendingAttach();
    } else if (attach) {
      // Federation content: tapp, brew, library, report — rich snapshot, never id-only.
      msgType = attach.type;
      msgPayload = {
        title: (attach.name || '').trim() || (lang.shareUntitled || 'Untitled'),
        description: attach.desc || '',
        content_type: attach.type,
        icon: attach.icon || '',
        text: text || '',
      };
      // Include resource IDs so the receiver can fetch detail
      if (attach.tappId) msgPayload.tapp_id = attach.tappId;
      if (attach.tappVersion) msgPayload.tapp_version = attach.tappVersion;
      if (attach.tappIcon) msgPayload.tapp_icon = attach.tappIcon;
      if (attach.name && attach.type === 'tapp') msgPayload.tapp_name = attach.name;
      // P0 store install: portable catalog URL (never local DB id / mode "store")
      if (attach.storeSource) msgPayload.store_source = attach.storeSource;
      // Direct-install package fallback for offline/custom (optional)
      if (attach.installPackage) msgPayload.install_package = attach.installPackage;
      if (attach.installPackageOmitted) msgPayload.install_package_omitted = attach.installPackageOmitted;
      if (attach.brewId) msgPayload.brew_id = attach.brewId;
      if (attach.brewLink) msgPayload.brew_link = attach.brewLink;
      // Source mark for the share card icon (favicon URL / brand slug).
      if (attach.sourceIcon) msgPayload.source_icon = attach.sourceIcon;
      if (attach.sourceName) msgPayload.source_name = attach.sourceName;
      // Library share: title, description, platform_id, item_id, image, content_type (like report snapshot).
      // content_type stays "library" (message kind); item kind goes in item_type / description.
      if (attach.type === 'library') {
        var libTitle = (attach.name || attach.summary || '').trim() || (lang.shareUntitled || 'Untitled');
        var libDesc = (attach.desc || '').trim();
        var libPlatform = (attach.platformId || '').trim();
        var libItemId = attach.itemId != null && attach.itemId !== '' ? String(attach.itemId) : '';
        var libImage = (attach.image || '').trim();
        var libItemType = (attach.contentType || '').trim();
        if (libItemType === 'library') libItemType = '';
        msgPayload.title = libTitle;
        msgPayload.description = libDesc || (libPlatform ? libPlatform + (libItemType ? ' · ' + libItemType : '') : '');
        msgPayload.platform_id = libPlatform;
        msgPayload.item_id = libItemId;
        msgPayload.image = libImage;
        msgPayload.content_type = 'library';
        if (libItemType) msgPayload.item_type = libItemType;
        msgPayload.summary = libTitle;
        // Structured sender stats for the media card (omit empties so old
        // recipients ignore them and the card falls back cleanly).
        if (attach.playtimeMin != null) msgPayload.playtime_min = attach.playtimeMin;
        if (attach.rating != null) msgPayload.rating = attach.rating;
        if (attach.progressCur != null) msgPayload.progress_cur = attach.progressCur;
        if (attach.progressTotal != null) msgPayload.progress_total = attach.progressTotal;
        if (attach.artist) msgPayload.artist = attach.artist;
        if (attach.album) msgPayload.album = attach.album;
      } else {
        if (attach.platformId) msgPayload.platform_id = attach.platformId;
        if (attach.itemId) msgPayload.item_id = attach.itemId;
        if (attach.image) msgPayload.image = attach.image;
      }
      // Report share: always wire snapshot fields (never id-only).
      // Coordinated field names (Aro + federation Article): report_id, summary, platform, content_preview.
      // Mirrored by wireReportSharePayload / REPORT_SHARE_SNAPSHOT_FIELDS in reportShareSnapshot.ts.
      if (attach.type === 'report') {
        var reportSummary = (attach.summary || attach.name || '').trim() || 'Report';
        var reportPlatform = (attach.platform || '').trim();
        var reportPreview = (attach.contentPreview || attach.desc || '').trim();
        msgPayload.report_id = attach.reportId != null && attach.reportId !== '' ? String(attach.reportId) : '';
        msgPayload.summary = reportSummary;
        msgPayload.platform = reportPlatform;
        msgPayload.content_preview = reportPreview;
        if (!msgPayload.title) msgPayload.title = reportSummary;
        if (!msgPayload.description) {
          msgPayload.description = reportPreview
            ? (reportPlatform ? reportPlatform + ' · ' + reportPreview : reportPreview)
            : reportPlatform;
        }
      } else if (attach.reportId) {
        msgPayload.report_id = attach.reportId;
      }
      clearPendingAttach();
    } else {
      msgType = 'text';
      msgPayload = { text: text };
    }

    if (state.quoteMsg) {
      msgPayload.quote_sender = state.quoteMsg.sender;
      msgPayload.quote_text = state.quoteMsg.text;
      msgPayload.quote_id = state.quoteMsg.message_id;
      clearQuote();
    }

    var sendReq = { payload: msgPayload, message_type: msgType };
    if (replyTo) sendReq.reply_to = replyTo;
    // Prefer E2E only when session looks established. Backend also soft-falls
    // back to plaintext if keys are incomplete (hard 400 used to fail every send).
    if (state.e2ePreferEncrypt !== false && isE2eReadyForActive()) {
      sendReq.encrypt = true;
    }
    var sendRes;
    if (state.activeKind === 'channel') {
      try {
        sendRes = await Tapp.federation.sendMessage(state.activeId, sendReq);
      } catch (eEnc) {
        // Fallback plaintext if peer has no E2E session yet / encrypt rejected
        if (sendReq.encrypt) {
          delete sendReq.encrypt;
          sendRes = await Tapp.federation.sendMessage(state.activeId, sendReq);
        } else throw eEnc;
      }
    } else {
      try {
        sendRes = await Tapp.federation.sendRoomMessage(state.activeId, sendReq);
      } catch (eEnc2) {
        if (sendReq.encrypt) {
          delete sendReq.encrypt;
          sendRes = await Tapp.federation.sendRoomMessage(state.activeId, sendReq);
        } else throw eEnc2;
      }
    }
    if (typeof noteDeliveryEnqueue === 'function') noteDeliveryEnqueue(sendRes);
    await pollMessages(true);
  } catch (e) {
    if (text) input.value = text;
    notifyError(lang.sendFail, e);
  } finally {
    state.sending = false;
    updateSendState();
    input.focus();
  }
}

/**
 * Surface outbound enqueue warnings (remote may not receive even though send returned 200).
 * Full dead-letter failures also land in the host notification center via the delivery worker.
 */
function noteDeliveryEnqueue(sendRes) {
  if (!sendRes) return;
  var d = sendRes.delivery || (sendRes.data && sendRes.data.delivery) || null;
  if (!d || !d.warning) return;
  var title = lang.deliveryWarnTitle || 'Delivery notice';
  var msg = lang.deliveryWarnBody || d.warning;
  if (d.queued === 0 && d.remote_targets > 0) {
    msg = lang.deliveryNotQueued
      || 'Message saved locally but could not be queued for remote peers';
  }
  try {
    Tapp.ui.showNotification({ title: title, message: msg, type: 'error' });
  } catch (e) { /* ignore */ }
  console.warn('[Aro] delivery enqueue warning', d);
}

/** Soft check for dead letters (host notifications are primary; this is in-app). */
async function refreshDeliveryHealth() {
  if (typeof Tapp === 'undefined' || !Tapp.federation) return;
  if (typeof Tapp.federation.getDeliveryStats !== 'function') return;
  try {
    var stats = await Tapp.federation.getDeliveryStats();
    var root = stats && stats.data ? stats.data : stats;
    if (!root) return;
    var dead = root.dead || root.failed || 0;
    if (dead > 0 && !refreshDeliveryHealth._warned) {
      refreshDeliveryHealth._warned = true;
      try {
        Tapp.ui.showNotification({
          title: lang.deliveryDeadTitle || 'Federation delivery failed',
          message: (lang.deliveryDeadBody || '{n} outbound messages could not be delivered')
            .replace('{n}', String(dead)),
          type: 'error',
        });
      } catch (e2) { /* ignore */ }
      // Offer re-queue of dead letters (one-shot; cooldown 2 min)
      if (
        typeof Tapp.federation.retryAllDeadDelivery === 'function'
        && !refreshDeliveryHealth._retryOffered
        && typeof aroConfirm === 'function'
      ) {
        refreshDeliveryHealth._retryOffered = true;
        try {
          var ok = await aroConfirm(
            (lang.deliveryRetryConfirm || 'Retry {n} failed deliveries?').replace('{n}', String(dead)),
            false
          );
          if (ok) {
            var retryRes = await Tapp.federation.retryAllDeadDelivery(Math.min(dead, 50));
            var retried = 0;
            if (retryRes) {
              retried = retryRes.retried != null
                ? retryRes.retried
                : (retryRes.data && retryRes.data.retried) || 0;
            }
            try {
              Tapp.ui.showNotification({
                title: lang.deliveryRetryOk || 'Retry queued',
                message: (lang.deliveryRetryBody || '{n} messages re-queued').replace('{n}', String(retried)),
                type: 'success',
              });
            } catch (e3) { /* ignore */ }
            refreshDeliveryHealth._warned = false;
          }
        } catch (e4) { /* ignore */ }
        setTimeout(function () { refreshDeliveryHealth._retryOffered = false; }, 120000);
      }
    }
    if (dead === 0) {
      refreshDeliveryHealth._warned = false;
      refreshDeliveryHealth._retryOffered = false;
    }
  } catch (e) {
    /* stats API optional */
  }
}

/** Fingerprint message list so pin/content changes refresh even when count stays the same. */
function messagesFingerprint(msgs) {
  if (!msgs || !msgs.length) return '0';
  var last = msgs[msgs.length - 1] || {};
  var pins = 0;
  var ids = [];
  for (var i = 0; i < msgs.length; i++) {
    if (msgs[i].is_pinned) pins++;
    if (i === 0 || i === msgs.length - 1 || msgs[i].is_pinned) {
      ids.push((msgs[i].message_id || '') + (msgs[i].is_pinned ? '*' : ''));
    }
  }
  return msgs.length + '|' + (last.message_id || '') + '|' + (last.created_at || '') + '|' + pins + '|' + ids.join(',');
}

function mergeIncomingMessage(msg) {
  if (!msg || !msg.message_id) return false;
  // Realtime can race a conversation switch; never mutate without an active chat.
  if (!state.activeId || !state.activeKind) return false;
  for (var i = 0; i < state.messages.length; i++) {
    if (state.messages[i].message_id === msg.message_id) {
      state.messages[i] = Object.assign({}, state.messages[i], msg);
      state.messagesFp = messagesFingerprint(state.messages);
      renderMessages();
      return true;
    }
  }
  state.messages.push(msg);
  state.messagesFp = messagesFingerprint(state.messages);
  renderMessages({ animateNew: true, newCount: 1 });
  return true;
}

async function pollMessages(force) {
  if (!state.activeId || !state.activeKind) return;
  // Snapshot target so a mid-flight conversation switch cannot apply wrong msgs.
  var kind = state.activeKind;
  var id = state.activeId;
  var gen = state.openGen;
  try {
    var res;
    if (kind === 'channel') {
      res = await Tapp.federation.getMessages(id, undefined, 200);
    } else {
      res = await Tapp.federation.getRoomMessages(id, undefined, 200);
    }
    if (!isConversationCurrent(kind, id, gen)) return;
    if (res) {
      var msgs = res.messages || [];
      var fp = messagesFingerprint(msgs);
      var hadError = !!state.chatLoadError;
      state.chatLoadError = null;
      if (force || fp !== state.messagesFp || hadError) {
        var prevLen = state.messages.length;
        var prevLast = prevLen ? (state.messages[prevLen - 1].message_id || '') : '';
        state.messages = msgs;
        state.messagesFp = fp;
        var grew = msgs.length > prevLen;
        var tailChanged = msgs.length && (msgs[msgs.length - 1].message_id || '') !== prevLast;
        if (grew && tailChanged && !state.skipMsgAppear && !hadError) {
          renderMessages({ animateNew: true, newCount: Math.min(msgs.length - prevLen, 3) });
        } else {
          renderMessages();
        }
      }
    }
  } catch (e) { /* ignore */ }
}

function startPolling() {
  stopPolling();
  state.pollTimer = setInterval(function () { pollMessages(false); }, state.pollInterval);
}

function stopPolling() {
  if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
}

async function subscribeRealtime() {
  if (!state.activeId || !state.activeKind || !Tapp.federation) return;
  var kind = state.activeKind;
  var id = state.activeId;
  var gen = state.openGen;
  // Already subscribed to this conversation
  if (state.subscribedKind === kind && state.subscribedId === id) return;
  await unsubscribeRealtime();
  if (!isConversationCurrent(kind, id, gen)) return;
  try {
    if (kind === 'channel' && typeof Tapp.federation.subscribeChannel === 'function') {
      await Tapp.federation.subscribeChannel(id);
      if (!isConversationCurrent(kind, id, gen)) {
        // User already left — best-effort drop this sub
        try {
          if (typeof Tapp.federation.unsubscribeChannel === 'function') {
            await Tapp.federation.unsubscribeChannel(id);
          }
        } catch (eUn) { /* ignore */ }
        return;
      }
      state.subscribedKind = 'channel';
      state.subscribedId = id;
    } else if (kind === 'room' && typeof Tapp.federation.subscribeRoom === 'function') {
      await Tapp.federation.subscribeRoom(id);
      if (!isConversationCurrent(kind, id, gen)) {
        try {
          if (typeof Tapp.federation.unsubscribeRoom === 'function') {
            await Tapp.federation.unsubscribeRoom(id);
          }
        } catch (eUn2) { /* ignore */ }
        return;
      }
      state.subscribedKind = 'room';
      state.subscribedId = id;
    }
  } catch (e) {
    console.warn('[Aro] realtime subscribe failed, falling back to poll:', e);
  }
}

async function unsubscribeRealtime() {
  if (!state.subscribedKind || !state.subscribedId || !Tapp.federation) {
    state.subscribedKind = null;
    state.subscribedId = null;
    return;
  }
  try {
    if (state.subscribedKind === 'channel' && typeof Tapp.federation.unsubscribeChannel === 'function') {
      await Tapp.federation.unsubscribeChannel(state.subscribedId);
    } else if (state.subscribedKind === 'room' && typeof Tapp.federation.unsubscribeRoom === 'function') {
      await Tapp.federation.unsubscribeRoom(state.subscribedId);
    }
  } catch (e) { /* ignore */ }
  state.subscribedKind = null;
  state.subscribedId = null;
}

function handleRealtimeMessage(ev) {
  if (!ev) return;
  var data = ev.data || {};
  var scope = ev.scope;
  var scopeId = scope === 'channel' ? ev.channelId : scope === 'room' ? ev.roomId : null;
  // Snapshot active target — ignore if user already switched mid-handler chain.
  var activeKind = state.activeKind;
  var activeId = state.activeId;
  var openGen = state.openGen;
  var inScope = false;
  if (scope === 'channel' && activeKind === 'channel' && ev.channelId === activeId) {
    inScope = true;
  } else if (scope === 'room' && activeKind === 'room' && ev.roomId === activeId) {
    inScope = true;
  }

  // 非当前会话：Toast + 刷新列表（后端通知中心另有 SSE）
  if (!inScope) {
    if (data.type === 'message' && data.message && scopeId) {
      maybeNotifyIncomingMessage(scope, scopeId, data.message);
      loadConversations().catch(function () {});
    }
    return;
  }

  if (data.type === 'message' && data.message) {
    if (!isConversationCurrent(activeKind, activeId, openGen)) return;
    mergeIncomingMessage(data.message);
    // 当前会话但页面在后台时仍提示
    maybeNotifyIncomingMessage(scope, scopeId, data.message);
    return;
  }
  if (data.type === 'room_message_pinned' && data.message_id) {
    if (!isConversationCurrent(activeKind, activeId, openGen)) return;
    for (var i = 0; i < state.messages.length; i++) {
      if (state.messages[i].message_id === data.message_id) {
        state.messages[i].is_pinned = !!data.is_pinned;
        state.messagesFp = messagesFingerprint(state.messages);
        renderMessages();
        return;
      }
    }
    pollMessages(true);
    return;
  }
  // Federated file transfer live progress (incoming chunks / cancel / complete)
  if (
    data.type === 'transfer_progress'
    || data.type === 'transfer_completed'
    || data.type === 'transfer_cancelled'
  ) {
    if (typeof handleTransferWsEvent === 'function') {
      handleTransferWsEvent(data);
    } else {
      // lightweight toast fallback
      try {
        if (data.type === 'transfer_progress' && data.progress != null) {
          var pct = Math.round(Number(data.progress) || 0);
          if (pct > 0 && pct < 100 && pct % 25 === 0) {
            var prog = (lang.transferProgress || 'Receiving… {pct}%').replace('{pct}', String(pct));
            Tapp.ui.showNotification({ title: prog, type: 'info' });
          }
        } else if (data.type === 'transfer_completed') {
          Tapp.ui.showNotification({
            title: lang.transferReceived || lang.transferComplete || 'File ready',
            type: 'success',
          });
        } else if (data.type === 'transfer_cancelled') {
          Tapp.ui.showNotification({
            title: lang.transferCancelled || 'Transfer cancelled',
            type: 'info',
          });
        }
      } catch (eProg) { /* ignore */ }
    }
    // Refresh group files panel if open
    if (typeof isRoomFilesOpen === 'function' && isRoomFilesOpen() && typeof loadRoomFiles === 'function') {
      loadRoomFiles({ append: false }).catch(function () {});
    }
    return;
  }
  // Membership / room lifecycle (local WS + federated RoomJoin/Leave/Pin paths)
  if (
    data.event === 'member_invited'
    || data.event === 'member_left'
    || data.event === 'member_joined'
    || data.event === 'member_removed'
    || data.event === 'member_kicked'
    || data.type === 'room_deleted'
  ) {
    if (state.activeKind !== 'room' || !state.activeId) {
      if (typeof loadConversations === 'function') loadConversations().catch(function () {});
      return;
    }
    // Room dissolved remotely → leave UI like local dissolve
    if (data.type === 'room_deleted') {
      exitActiveConversationUi(lang.dissolve || lang.dissolveFail || 'Room deleted', true);
      return;
    }
    // Kicked / forced leave of self
    if (
      (data.event === 'member_removed' || data.event === 'member_left' || data.event === 'member_kicked')
      && data.actor
      && typeof isLocalActor === 'function'
      && isLocalActor(data.actor)
    ) {
      exitActiveConversationUi(lang.kicked || lang.leave || 'You left the group', true);
      return;
    }
    var roomIdForMembers = state.activeId;
    var genForMembers = state.openGen;
    Tapp.federation.getRoomMembers(roomIdForMembers).then(function (res) {
      if (!isConversationCurrent('room', roomIdForMembers, genForMembers)) return;
      state.members = unwrapRoomMembers(res);
      renderMembers();
      renderChatHeader();
    }).catch(function () {});
    if (typeof loadConversations === 'function') {
      loadConversations().catch(function () {});
    }
    return;
  }
  // Unknown event — force a full refresh (pollMessages itself is gen-guarded)
  if (isConversationCurrent(activeKind, activeId, openGen)) pollMessages(true);
}

function bindRealtimeListeners() {
  if (state.realtimeBound || !Tapp.federation) return;
  state.realtimeBound = true;
  if (typeof Tapp.federation.onMessage === 'function') {
    Tapp.federation.onMessage(function (ev) { handleRealtimeMessage(ev); });
  }
  if (typeof Tapp.federation.onChannelUpdate === 'function') {
    Tapp.federation.onChannelUpdate(function (ev) {
      if (!ev || !ev.channelId) return;
      // List-level status can update even when another chat is open
      if (ev.event === 'closed' || ev.event === 'accepted') {
        for (var ci = 0; ci < state.channels.length; ci++) {
          if (state.channels[ci].channel_id === ev.channelId) {
            state.channels[ci].status = ev.event === 'closed' ? 'closed' : 'accepted';
            break;
          }
        }
      }
      if (ev.channelId !== state.activeId || state.activeKind !== 'channel') {
        if (ev.event === 'closed' || ev.event === 'accepted') renderConvList();
        return;
      }
      if (ev.event === 'closed') {
        if (state.channelDetail) state.channelDetail.status = 'closed';
        clearPendingAttach();
        if (typeof clearQuote === 'function') clearQuote();
        closeAttachMenu();
        renderChatHeader();
        renderConvList();
        updateSendState();
      } else if (ev.event === 'accepted') {
        // Remote accepted our pending open — unlock composer (backend status is accepted).
        if (state.channelDetail) state.channelDetail.status = 'accepted';
        renderChatHeader();
        renderConvList();
        updateSendState();
      } else if (ev.event === 'disconnected') {
        // WS dropped — poll will keep things eventually consistent
        pollMessages(true);
      }
    });
  }
  if (typeof Tapp.federation.onRoomUpdate === 'function') {
    Tapp.federation.onRoomUpdate(function (ev) {
      if (!ev || !ev.roomId) return;
      if (ev.event === 'deleted') {
        if (state.activeKind === 'room' && state.activeId === ev.roomId) {
          exitActiveConversationUi(lang.dissolve || 'Room deleted', true);
        } else if (typeof loadConversations === 'function') {
          loadConversations().catch(function () {});
        }
        return;
      }
      if (ev.roomId !== state.activeId || state.activeKind !== 'room') return;
      var roomId = ev.roomId;
      var gen = state.openGen;
      if (ev.event === 'disconnected') pollMessages(true);
      else if (ev.event === 'governance_changed') {
        Tapp.federation.getRoom(roomId).then(function (detail) {
          if (!detail || !isConversationCurrent('room', roomId, gen)) return;
          state.roomDetail = detail;
          // Keep conv list in sync with federated renames (not only header).
          for (var gi = 0; gi < state.rooms.length; gi++) {
            if (state.rooms[gi].room_id === roomId) {
              if (detail.name) state.rooms[gi].name = detail.name;
              if (detail.description !== undefined) state.rooms[gi].description = detail.description;
              if (detail.avatar_url !== undefined) state.rooms[gi].avatar_url = detail.avatar_url;
              break;
            }
          }
          renderChatHeader();
          renderConvList();
        }).catch(function () {});
      } else if (
        ev.event === 'member_joined'
        || ev.event === 'member_left'
        || ev.event === 'member_removed'
        || ev.event === 'member_invited'
      ) {
        Tapp.federation.getRoomMembers(roomId).then(function (res) {
          if (!isConversationCurrent('room', roomId, gen)) return;
          state.members = unwrapRoomMembers(res);
          renderMembers();
          renderChatHeader();
        }).catch(function () {});
      }
    });
  }
}

async function doCloseChannel() {
  if (!state.activeId || state.activeKind !== 'channel') return;
  if (!(await aroConfirm(lang.closeChannelConfirm, true))) return;
  try {
    await unsubscribeRealtime();
    await Tapp.federation.closeChannel(state.activeId);
    if (state.channelDetail) state.channelDetail.status = 'closed';
    for (var i = 0; i < state.channels.length; i++) {
      if (state.channels[i].channel_id === state.activeId) {
        state.channels[i].status = 'closed';
        break;
      }
    }
    clearPendingAttach();
    if (typeof clearQuote === 'function') clearQuote();
    closeAttachMenu();
    renderChatHeader();
    renderConvList();
    updateSendState();
    loadConversations();
  } catch (e) {
    notifyError(lang.closeChannelFail || lang.sendFail || 'Close failed', e);
  }
}

async function doDeleteChannel() {
  if (!state.activeId || state.activeKind !== 'channel') return;
  if (typeof Tapp.federation.deleteChannel !== 'function') return;
  if (!(await aroConfirm(lang.deleteChannelConfirm || 'Delete this closed chat permanently?', true))) return;
  var id = state.activeId;
  try {
    await unsubscribeRealtime();
    await Tapp.federation.deleteChannel(id);
    state.channels = (state.channels || []).filter(function (c) {
      return c.channel_id !== id;
    });
    if (typeof exitActiveConversationUi === 'function') {
      exitActiveConversationUi(lang.deleteChannelOk || lang.closed || 'Deleted', true);
    } else {
      state.activeId = null;
      state.activeKind = null;
      state.channelDetail = null;
      $('chat-container').style.display = 'none';
      $('empty-state').style.display = '';
    }
    renderConvList();
    loadConversations();
  } catch (e) {
    notifyError(lang.deleteChannelFail || lang.closeChannelFail || 'Delete failed', e);
  }
}

async function doInviteMember(actorUrl) {
  if (!state.activeId || state.activeKind !== 'room') return;
  var actor = actorUrl;
  if (!actor) {
    var input = $('invite-input');
    actor = (input ? input.value : '').trim();
  }
  if (!actor) {
    var emptyInput = $('invite-input');
    if (emptyInput) {
      emptyInput.classList.add('create-input-invalid');
      try { emptyInput.focus(); } catch (e0) {}
      setTimeout(function () { emptyInput.classList.remove('create-input-invalid'); }, 900);
    }
    try { Tapp.ui.showNotification({ title: lang.invitePlaceholder || lang.inviteFail, type: 'error' }); } catch (e1) {}
    return;
  }
  try {
    await Tapp.federation.inviteMember(state.activeId, { actor: actor });
    if (!actorUrl) { var input2 = $('invite-input'); if (input2) input2.value = ''; }
    try { Tapp.ui.showNotification({ title: lang.inviteSuccess, type: 'success' }); } catch (e2) {}
    // Refresh members & re-render popover
    try {
      var detail = await Tapp.federation.getRoom(state.activeId);
      if (detail) state.roomDetail = detail;
      var membersRes = await Tapp.federation.getRoomMembers(state.activeId);
      state.members = unwrapRoomMembers(membersRes);
      renderMembers();
      renderInvitePopoverContacts();
    } catch (e2) {}
  } catch (e) {
    notifyError(lang.inviteFail, e);
  }
}

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
document.addEventListener('click', function (e) {
  if (!_invitePopover || _invitePopover.style.display === 'none') return;
  var wrap = $('invite-wrap');
  if ((wrap && wrap.contains(e.target)) || _invitePopover.contains(e.target)) return;
  closeInvitePopover();
});

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

// ==================== Edit Room ====================
function showEditRoomDialog() {
  if (!state.roomDetail) return;
  var overlay = $('edit-room-dialog');
  if (!overlay) return;
  $('edit-room-name').value = state.roomDetail.name || '';
  $('edit-room-desc').value = state.roomDetail.description || '';
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
      idVal.textContent = state.roomDetail.room_id;
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
  var btn = $('edit-room-save');
  btn && (btn.disabled = true, btn.textContent = lang.saving);
  try {
    var payload = { name: nameVal, description: descVal };
    // Only send is_public when turning private→public (never send false once public).
    if (!alreadyPublic && wantPublic) {
      payload.is_public = true;
    }
    var updated = await Tapp.federation.updateRoom(state.activeId, payload);
    if (updated) state.roomDetail = updated;
    else {
      state.roomDetail.name = nameVal;
      state.roomDetail.description = descVal;
      if (!alreadyPublic && wantPublic) state.roomDetail.is_public = true;
    }
    // Sync to room list
    for (var i = 0; i < state.rooms.length; i++) {
      if (state.rooms[i].room_id === state.activeId) {
        state.rooms[i].name = nameVal;
        state.rooms[i].description = descVal;
        if (!alreadyPublic && wantPublic) state.rooms[i].is_public = true;
        break;
      }
    }
    hideEditRoomDialog();
    renderChatHeader();
    renderConvList();
    if (!alreadyPublic && wantPublic) {
      try {
        Tapp.ui.showNotification({
          title: lang.publicGroup || 'Public',
          message: (lang.roomId || 'Room ID') + ': ' + state.activeId,
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

// ==================== Kick Member ====================
async function doKickMember(actorUrl) {
  if (!state.activeId || state.activeKind !== 'room') return;
  if (!(await aroConfirm(lang.kickConfirm, true))) return;
  try {
    await Tapp.federation.removeMember(state.activeId, actorUrl);
    // Refresh members
    var detail = await Tapp.federation.getRoom(state.activeId);
    if (detail) state.roomDetail = detail;
    var membersRes = await Tapp.federation.getRoomMembers(state.activeId);
    state.members = unwrapRoomMembers(membersRes);
    renderMembers();
    renderChatHeader();
  } catch (e) {
    notifyError(lang.kickFail, e);
  }
}

// ==================== Dissolve Room ====================
/**
 * Leave the open chat UI (dissolve / kicked / remote room_deleted).
 * @param {string} [toastTitle]
 * @param {boolean} [asError]
 */
function exitActiveConversationUi(toastTitle, asError) {
  // Invalidate in-flight open/poll so they cannot resurrect this chat UI.
  state.openGen = (state.openGen || 0) + 1;
  try {
    if (typeof unsubscribeRealtime === 'function') unsubscribeRealtime();
  } catch (e0) { /* ignore */ }
  state.activeKind = null;
  state.activeId = null;
  state.channelDetail = null;
  state.roomDetail = null;
  state.members = [];
  state.messages = [];
  state.messagesFp = '';
  if (typeof stopPolling === 'function') stopPolling();
  if (typeof clearPendingAttach === 'function') clearPendingAttach();
  if (typeof clearQuote === 'function') clearQuote();
  if (typeof closeAttachMenu === 'function') closeAttachMenu();
  if (typeof closeInvitePopover === 'function') closeInvitePopover();
  if (typeof resetHistoryOnConversationChange === 'function') resetHistoryOnConversationChange();
  if (typeof resetRoomFilesOnConversationChange === 'function') resetRoomFilesOnConversationChange();
  var chat = $('chat-container');
  if (chat) chat.style.display = 'none';
  var panel = $('member-panel');
  if (panel) {
    panel.style.display = 'none';
    panel.classList.remove('member-open-mobile');
  }
  var emptyAfter = $('empty-state');
  if (emptyAfter) {
    emptyAfter.style.display = '';
    if (typeof aroPlayEnter === 'function') aroPlayEnter(emptyAfter, 'aro-panel-enter');
  }
  var sideAfter = $('sidebar');
  if (sideAfter) {
    sideAfter.classList.remove('sidebar-hidden-mobile');
    if (typeof aroPlayEnter === 'function') aroPlayEnter(sideAfter, 'aro-panel-enter');
  }
  if (typeof updateSendState === 'function') updateSendState();
  if (typeof loadConversations === 'function') loadConversations();
  if (toastTitle) {
    try {
      Tapp.ui.showNotification({
        title: toastTitle,
        type: asError ? 'error' : 'info',
      });
    } catch (e1) {
      if (asError && typeof notifyError === 'function') notifyError(toastTitle);
    }
  }
}

async function doDissolveRoom() {
  if (!state.activeId || state.activeKind !== 'room') return;
  if (!(await aroConfirm(lang.dissolveConfirm, true))) return;
  try {
    await unsubscribeRealtime();
    await Tapp.federation.deleteRoom(state.activeId);
    exitActiveConversationUi(null, false);
  } catch (e) {
    notifyError(lang.dissolveFail, e);
  }
}

async function doAcceptChannel() {
  if (!state.activeId || state.activeKind !== 'channel') return;
  try {
    await Tapp.federation.acceptChannel(state.activeId);
    // Backend sets status to 'accepted' (writable); 'active' after first message.
    if (state.channelDetail) state.channelDetail.status = 'accepted';
    for (var i = 0; i < state.channels.length; i++) {
      if (state.channels[i].channel_id === state.activeId) {
        state.channels[i].status = 'accepted'; break;
      }
    }
    renderChatHeader();
    if (typeof renderMessages === 'function') renderMessages();
    renderConvList();
    // Unlock attach/send after accept (pending was composer-locked).
    updateSendState();
    if (typeof maybePublishE2eKeys === 'function') {
      maybePublishE2eKeys().catch(function () {});
    }
  } catch (e) {
    notifyError(lang.acceptFail, e);
  }
}

/** Decline a remote-initiated pending channel (close without chatting). */
async function doRejectChannel() {
  if (!state.activeId || state.activeKind !== 'channel') return;
  if (!(await aroConfirm(lang.channelRejectConfirm || lang.closeChannelConfirm || 'Decline this request?', true))) return;
  try {
    await unsubscribeRealtime();
    await Tapp.federation.closeChannel(state.activeId);
    exitActiveConversationUi(lang.channelRejected || lang.closed || null, false);
  } catch (e) {
    notifyError(lang.closeChannelFail || lang.acceptFail || 'Reject failed', e);
  }
}

/** Self-join an open-policy room (no invite required). */
async function doJoinOpenRoom() {
  if (!state.activeId || state.activeKind !== 'room') return;
  if (!Tapp.federation || typeof Tapp.federation.joinRoom !== 'function') {
    notifyError(lang.joinRoomFail || lang.acceptFail || 'Join not available');
    return;
  }
  try {
    await Tapp.federation.joinRoom(state.activeId);
    if (state.roomDetail) {
      state.roomDetail.my_membership_status = 'active';
      state.roomDetail.my_role = state.roomDetail.my_role || 'member';
    }
    try {
      var detail = await Tapp.federation.getRoom(state.activeId);
      if (detail) state.roomDetail = detail;
      var membersRes = await Tapp.federation.getRoomMembers(state.activeId);
      state.members = unwrapRoomMembers(membersRes);
    } catch (e2) { /* ignore */ }
    renderChatHeader();
    if (typeof renderMessages === 'function') renderMessages();
    renderMembers();
    renderConvList();
    updateSendState();
    if (typeof maybePublishE2eKeys === 'function') {
      maybePublishE2eKeys().catch(function () {});
    }
    try {
      Tapp.ui.showNotification({
        title: lang.joinRoomOk || lang.roomInviteAccepted || 'Joined',
        type: 'success',
      });
    } catch (e3) { /* ignore */ }
  } catch (e) {
    notifyError(lang.joinRoomFail || lang.acceptFail || 'Join failed', e);
  }
}

async function doAcceptRoomInvite() {
  if (!state.activeId || state.activeKind !== 'room') return;
  if (!Tapp.federation || typeof Tapp.federation.acceptRoomInvite !== 'function') {
    notifyError(lang.acceptFail || 'Accept not available');
    return;
  }
  try {
    await Tapp.federation.acceptRoomInvite(state.activeId);
    if (state.roomDetail) state.roomDetail.my_membership_status = 'active';
    for (var i = 0; i < state.rooms.length; i++) {
      if (state.rooms[i].room_id === state.activeId) {
        state.rooms[i].my_membership_status = 'active';
        break;
      }
    }
    try {
      var detail = await Tapp.federation.getRoom(state.activeId);
      if (detail) state.roomDetail = detail;
      var membersRes = await Tapp.federation.getRoomMembers(state.activeId);
      state.members = unwrapRoomMembers(membersRes);
    } catch (e2) { /* ignore refresh errors */ }
    renderChatHeader();
    if (typeof renderMessages === 'function') renderMessages();
    renderMembers();
    renderConvList();
    updateSendState();
    if (typeof maybePublishE2eKeys === 'function') {
      maybePublishE2eKeys().catch(function () {});
    }
    try {
      Tapp.ui.showNotification({ title: lang.roomInviteAccepted || lang.accept || 'Joined', type: 'success' });
    } catch (e3) { /* ignore */ }
  } catch (e) {
    notifyError(lang.acceptFail, e);
  }
}

async function doRejectRoomInvite() {
  if (!state.activeId || state.activeKind !== 'room') return;
  if (!(await aroConfirm(lang.roomInviteRejectConfirm || lang.leaveConfirm || 'Decline this invite?', true))) return;
  try {
    if (Tapp.federation && typeof Tapp.federation.rejectRoomInvite === 'function') {
      await Tapp.federation.rejectRoomInvite(state.activeId);
    } else {
      await Tapp.federation.leaveRoom(state.activeId);
    }
    await unsubscribeRealtime();
    exitActiveConversationUi(lang.roomInviteRejected || null, false);
  } catch (e) {
    notifyError(lang.acceptFail || lang.leaveFail || 'Reject failed', e);
  }
}

async function doLeaveRoom() {
  if (!state.activeId || state.activeKind !== 'room') return;
  if (!(await aroConfirm(lang.leaveConfirm || lang.leaveRingConfirm || 'Leave this group?', true))) return;
  try {
    await unsubscribeRealtime();
    await Tapp.federation.leaveRoom(state.activeId);
    exitActiveConversationUi(null, false);
  } catch (e) {
    notifyError(lang.leaveFail || lang.sendFail || 'Leave failed', e);
  }
}

// ==================== Create Dialog ====================
function showCreateDialog() {
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
    if (channelInput) channelInput.value = '';
    if (roomInput) roomInput.value = '';
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
  if (btn) { btn.disabled = true; btn.textContent = lang.creating; }
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
    if (btn) { btn.disabled = false; btn.textContent = lang.createChannel; }
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
  var pubCb = $('create-room-public');
  var isPublic = !!(pubCb && pubCb.checked);
  var btn = $('create-room-btn');
  if (btn) { btn.disabled = true; btn.textContent = lang.creating; }
  try {
    var result = await Tapp.federation.createRoom({
      name: name,
      is_public: isPublic,
      // Public rooms are joinable by id even if invite_policy stays default.
      invite_policy: isPublic ? 'open' : undefined,
    });
    hideCreateDialog();
    if (pubCb) pubCb.checked = false;
    await loadConversations();
    if (result && result.room_id) {
      openConversation('room', result.room_id);
      if (isPublic) {
        try {
          Tapp.ui.showNotification({
            title: lang.publicGroup || 'Public',
            message: (lang.roomId || 'Room ID') + ': ' + result.room_id,
            type: 'success',
          });
        } catch (eN) { /* ignore */ }
      }
    }
  } catch (e) {
    console.error('[Aro] createRoom error:', e);
    notifyError(lang.createFail, e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = lang.createRoom; }
  }
}

/** Join a public (or open) room by room id. */
async function doJoinRoomById() {
  var input = $('join-room-id-input');
  if (!input) return;
  var roomId = (input.value || '').trim();
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
  if (btn) { btn.disabled = true; btn.textContent = lang.joining || lang.creating || '…'; }
  try {
    await Tapp.federation.joinRoom(roomId);
    hideCreateDialog();
    input.value = '';
    await loadConversations();
    openConversation('room', roomId);
    try {
      Tapp.ui.showNotification({
        title: lang.joinRoomOk || 'Joined',
        type: 'success',
      });
    } catch (eN) { /* ignore */ }
  } catch (e) {
    notifyError(lang.joinRoomFail || 'Join failed', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = lang.joinRoom || 'Join'; }
  }
}

// ==================== View Switching ====================
function switchView(view) {
  if (state.isGuest && view !== 'feed') view = 'feed';
  var prev = state.currentView;
  if (prev === view) return;
  state.currentView = view;
  // Leaving a view: clear overlays that can pin over the whole #tapp-content (create/compose).
  if (typeof dismissTransientUi === 'function') {
    dismissTransientUi({ keepChat: view === 'messages' });
  }
  var views = ['messages', 'feed', 'rings'];
  views.forEach(function (v) {
    var el = $('view-' + v);
    if (el) {
      el.classList.toggle('aro-view-active', v === view);
      if (v !== view) {
        el.style.display = 'none';
        el.classList.remove('aro-view-enter');
        // Ensure inactive views never intercept pointer hits
        el.style.pointerEvents = 'none';
      } else {
        el.style.display = '';
        el.style.pointerEvents = '';
        el.classList.add('aro-view-active');
        if (prev && prev !== view) aroPlayEnter(el, 'aro-view-enter');
      }
    }
  });
  // Update nav buttons
  document.querySelectorAll('.aro-nav-item').forEach(function (btn) {
    btn.classList.toggle('aro-nav-active', btn.dataset.view === view);
  });
  // Pause chat poll when not on messages; keep WS for quick resume.
  // Do not bump openGen here — active conversation should survive nav away/back.
  if (view === 'messages') {
    if (state.activeId) startPolling();
  } else {
    stopPolling();
  }
  // Contextual feed + is feed-only; hide and close menus when leaving feed.
  if (typeof updateFeedPlusVisibility === 'function') updateFeedPlusVisibility();
  if (view !== 'feed') {
    if (typeof closeFeedPlusMenu === 'function') closeFeedPlusMenu();
    if (typeof closeFollowDialog === 'function') closeFollowDialog();
  }
  // Load data for the view
  if (view === 'feed') loadFeed();
  else if (view === 'rings') loadRings();
}
