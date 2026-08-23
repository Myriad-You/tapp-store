var share = require('./scope.js');

// ==================== API ====================
/** Optimistically zero a room's unread badge (server marks last_read_at on getRoomMessages). */
function clearRoomUnreadLocal(roomId) {
  if (!roomId || !state.rooms || !state.rooms.length) return;
  for (var i = 0; i < state.rooms.length; i++) {
    if (state.rooms[i].room_id === roomId) {
      state.rooms[i].unread_count = 0;
      break;
    }
  }
}

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
    // Paint list on next frame so openConversation shell can paint first under load bursts
    if (typeof aroScheduleFrame === 'function') {
      aroScheduleFrame('convList', function () {
        if (typeof renderConvList === 'function') renderConvList();
      });
    } else if (typeof renderConvList === 'function') {
      renderConvList();
    }
    if (errors.length > 0 && state.channels.length === 0 && state.rooms.length === 0) {
      var list = $('conv-list');
      if (list) {
        state._convListFp = '';
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

  // Already on this conversation and fully open — no reload thrash.
  var chatElEarly = $('chat-container');
  var chatVisible = !!(chatElEarly && chatElEarly.style.display !== 'none' && !chatElEarly.hidden);
  if (
    state.activeKind === kind
    && state.activeId === id
    && chatVisible
    && !state.chatOpening
    && !state.chatLoadError
  ) {
    // Mobile: ensure list stays hidden behind the open thread.
    var sideStay = $('sidebar');
    if (sideStay) sideStay.classList.add('sidebar-hidden-mobile');
    return;
  }

  // A→B while chat already open: skip slide-in; only empty→thread animates.
  var switchWithinChat = !!(
    chatVisible
    && state.activeId
    && (state.activeKind !== kind || state.activeId !== id)
  );

  // Invalidate any in-flight open/poll/realtime apply for the previous target.
  var gen = (state.openGen = (state.openGen || 0) + 1);

  // Stop poll immediately so a prior interval cannot write into the new shell.
  stopPolling();
  // Cancel any previous room's roster confirm burst / pending list refresh.
  if (typeof clearRosterConfirmTimers === 'function') clearRosterConfirmTimers();
  state.rosterConfirmToken = (state.rosterConfirmToken || 0) + 1;
  state.rosterBoostUntil = 0;
  if (state.loadConvDebounceTimer) {
    try { clearTimeout(state.loadConvDebounceTimer); } catch (eLc) { /* ignore */ }
    state.loadConvDebounceTimer = null;
  }

  // ---- Synchronous shell update FIRST (must not await before this) ----
  // Clicks on 最近/list must paint active chat immediately; network teardown
  // (unsubscribeRealtime) and message loads happen after first paint.
  // Drop click-shields / sheets that would sit above the list or chat.
  if (typeof dismissTransientUi === 'function') {
    dismissTransientUi({ keepChat: true });
  }
  if (typeof resetHistoryOnConversationChange === 'function') resetHistoryOnConversationChange();
  if (typeof resetRoomFilesOnConversationChange === 'function') resetRoomFilesOnConversationChange();
  if (typeof resetStickersOnConversationChange === 'function') resetStickersOnConversationChange();

  state.activeKind = kind;
  state.activeId = id;
  state.messages = [];
  state.messagesFp = '';
  state.messagesSrcFp = '';
  state.skipMsgAppear = true;
  state.members = [];
  state.channelDetail = null;
  state.roomDetail = null;
  state.chatLoadError = null;
  state.chatOpening = true;
  // Fresh window — unknown whether older pages exist until first page size is known
  if (typeof ensureHistoryState === 'function') {
    try { ensureHistoryState().hasMoreMain = null; } catch (eHm) { /* ignore */ }
  }
  // Drop previous composer lock immediately; re-lock channels until detail proves writable.
  if (typeof clearPendingAttach === 'function') clearPendingAttach();
  if (typeof clearQuote === 'function') clearQuote();
  if (typeof closeAttachMenu === 'function') closeAttachMenu();
  if (typeof closeMentionPicker === 'function') closeMentionPicker();
  if (typeof updateSendState === 'function') updateSendState();

  // Optimistic header from list so A→B does not flash a blank name.
  try {
    var listItems = typeof buildConversationItems === 'function' ? buildConversationItems() : [];
    for (var li = 0; li < listItems.length; li++) {
      if (listItems[li].kind === kind && listItems[li].id === id) {
        var hint = listItems[li];
        if (kind === 'channel') {
          state.channelDetail = state.channelDetail || {};
          state.channelDetail.remote_actor_name = hint.name;
          state.channelDetail.remote_actor_avatar = hint.avatar || '';
          state.channelDetail.remote_actor_url = hint.actorUrl || state.channelDetail.remote_actor_url;
          // Only apply known statuses from the list (pending). Never invent 'active'.
          if (hint.status) state.channelDetail.status = hint.status;
        } else if (kind === 'room') {
          state.roomDetail = state.roomDetail || {};
          state.roomDetail.name = hint.name;
          state.roomDetail.avatar_url = hint.avatar || '';
          state.roomDetail.room_id = id;
          // List marks pending invites as status:'pending' — keep composer locked.
          if (hint.status === 'pending') {
            state.roomDetail.my_membership_status = 'pending';
          }
          // Do not default membership to active here; real getRoom fills it.
        }
        break;
      }
    }
  } catch (eHint) { /* ignore */ }

  var emptyEl = $('empty-state');
  if (emptyEl) {
    emptyEl.style.display = 'none';
    emptyEl.classList.remove('aro-panel-enter');
  }
  var chatEl = $('chat-container');
  if (chatEl) {
    chatEl.style.display = '';
    // Only animate empty→thread (or first open). A→B must not re-slide every click.
    if (
      !switchWithinChat
      && isOpenGenCurrent(gen)
      && typeof aroPlayEnter === 'function'
    ) {
      aroPlayEnter(chatEl, 'aro-panel-enter');
    } else {
      chatEl.classList.remove('aro-panel-enter');
    }
  }
  var sideEl = $('sidebar');
  if (sideEl) sideEl.classList.add('sidebar-hidden-mobile');

  // Highlight list first (instant feedback), then mid-pane content.
  renderConvList();
  renderChatHeader();
  renderMessages();

  // ---- Async work after first paint (stale-guarded with openGen) ----
  // Never block UI open on realtime unsubscribe.
  await unsubscribeRealtime();
  if (!isOpenGenCurrent(gen)) return;

  try {
    if (kind === 'channel') {
      var results = await Promise.all([
        Tapp.federation.getChannel(id),
        Tapp.federation.getMessages(id, undefined, MSG_WINDOW_LIMIT),
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
        if (typeof ensureHistoryState === 'function') {
          ensureHistoryState().hasMoreMain =
            state.messages.length >= (MSG_WINDOW_LIMIT || 50);
        }
      }
    } else {
      // Pending invites cannot load messages (403) — use allSettled so detail/members still open
      var roomParts = await Promise.allSettled([
        Tapp.federation.getRoom(id),
        Tapp.federation.getRoomMembers(id),
        Tapp.federation.getRoomMessages(id, undefined, MSG_WINDOW_LIMIT),
      ]);
      if (!isConversationCurrent(kind, id, gen)) return;
      if (roomParts[0].status === 'fulfilled' && roomParts[0].value) {
        state.roomDetail = roomParts[0].value;
      } else if (roomParts[0].status === 'rejected') {
        throw roomParts[0].reason;
      }
      if (roomParts[1].status === 'fulfilled' && roomParts[1].value) {
        // Claim rosterFetchSeq so a concurrent poll cannot stomp this open snapshot.
        var openSeq = (state.rosterFetchSeq = (state.rosterFetchSeq || 0) + 1);
        if (openSeq === state.rosterFetchSeq) {
          state.members = unwrapRoomMembers(roomParts[1].value);
          if (typeof activeMemberCountFromList === 'function' && typeof applyRoomMemberCount === 'function') {
            applyRoomMemberCount(id, activeMemberCountFromList(state.members));
          }
        }
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
        if (typeof ensureHistoryState === 'function') {
          ensureHistoryState().hasMoreMain =
            state.messages.length >= (MSG_WINDOW_LIMIT || 50);
        }
        // getRoomMessages marks last_read_at server-side; clear badge immediately.
        clearRoomUnreadLocal(id);
      } else {
        // pending membership: empty transcript is expected
        state.messages = [];
        state.messagesFp = '';
        state.messagesSrcFp = '';
        if (typeof ensureHistoryState === 'function') ensureHistoryState().hasMoreMain = false;
      }
    }
  } catch (e) {
    if (!isConversationCurrent(kind, id, gen)) return;
    console.error('[Aro] openConversation failed:', e);
    state.chatLoadError = (e && (e.message || e.error || String(e))) || (lang.loadFail || 'Load failed');
    notifyError(lang.loadFail || lang.sendFail || 'Load failed', e);
  }

  if (!isConversationCurrent(kind, id, gen)) return;

  state.chatOpening = false;
  renderChatHeader();
  // Opening a thread lands on the newest message. Say so rather than leaning on
  // isMessagesNearBottom() reading the short "opening…" placeholder as "at the
  // bottom" — that inference breaks the moment the placeholder grows.
  renderMessages({ stickBottom: true });
  renderMembers();
  renderConvList();
  updateSendState();
  startPolling();
  subscribeRealtime();
  // Room open: actively re-confirm roster (home/fan-out lag after someone just joined).
  if (kind === 'room') {
    confirmRoomMembers(id, gen, {
      delays: [400, 1200, 3000],
      boostMs: 12000,
      refreshList: true,
    });
    // Debounced list refresh for unread/member_count (confirm may also schedule).
    scheduleLoadConversations(500);
  }
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
// E2E UI → page/e2eUi.js

async function doTransferOwnership() {
  if (!state.activeId || state.activeKind !== 'room') return;
  if (typeof Tapp.federation.transferRoomOwnership !== 'function') {
    try {
      Tapp.ui.showNotification({ title: lang.transferOwnerUnsupported || 'Not available', type: 'error' });
    } catch (e0) { /* ignore */ }
    return;
  }
  // Active non-owner non-observer members only (pending invites cannot receive ownership).
  var candidates = (state.members || []).filter(function (m) {
    if (!m || !m.actor_url) return false;
    var st = m.membership_status || m.status || 'active';
    if (st && st !== 'active') return false;
    if (m.role === 'owner' || m.role === 'observer') return false;
    // Exclude self (current owner)
    if (typeof isLocalActor === 'function' && isLocalActor(m.actor_url)) return false;
    return true;
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
  // Sandbox iframe blocks window.prompt — use in-app picker.
  var pickOpts = candidates.map(function (m) {
    var name = m.display_name || (m.actor_url || '').split('/').pop() || m.actor_url;
    var sub = m.role && m.role !== 'member' ? String(m.role) : '';
    return { id: m.actor_url, label: name, sub: sub };
  });
  var pickTitle = lang.transferOwnerPrompt || 'Transfer ownership to:';
  var pickedId = typeof aroPickOption === 'function'
    ? await aroPickOption(pickTitle, pickOpts)
    : null;
  if (!pickedId) return;
  var target = null;
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i].actor_url === pickedId
      || (typeof sameActorUrl === 'function' && sameActorUrl(candidates[i].actor_url, pickedId))) {
      target = candidates[i];
      break;
    }
  }
  if (!target) {
    try {
      Tapp.ui.showNotification({ title: lang.transferOwnerInvalid || 'Invalid choice', type: 'error' });
    } catch (e2) { /* ignore */ }
    return;
  }
  var label = target.display_name || target.actor_url;
  if (!(await aroConfirm((lang.transferOwnerConfirm || 'Transfer ownership to {name}?').replace('{name}', label), true))) {
    return;
  }
  try {
    await Tapp.federation.transferRoomOwnership(state.activeId, target.actor_url);
    // Ownership change reshuffles roles — confirm roster via seq-guarded path.
    confirmRoomMembers(state.activeId, state.openGen, {
      delays: [0, 400, 1200, 3000],
      boostMs: 12000,
      refreshList: true,
    });
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
  // Backend only accepts active|accepted; pending/closed / pending room invites must not clear the input
  if (typeof isChannelComposerLocked === 'function' && isChannelComposerLocked()) return;
  if (typeof isRoomComposerLocked === 'function' && isRoomComposerLocked()) return;

  // ARO-03: freeze destination + draft for entire async send chain
  var ctx = {
    kind: state.activeKind,
    id: state.activeId,
    generation: state.openGen,
    text: text,
    attach: attach,
    quoteMsg: state.quoteMsg
      ? {
          message_id: state.quoteMsg.message_id,
          sender: state.quoteMsg.sender,
          text: state.quoteMsg.text,
        }
      : null,
  };

  input.value = '';
  autoResizeInput(input);
  state.sending = true;
  updateSendState();
  closeAttachMenu();
  if (typeof closeStickerPanel === 'function') closeStickerPanel();
  if (typeof closeMentionPicker === 'function') closeMentionPicker();
  closeMsgMenu();

  var sendReq = null;
  try {
    var msgPayload;
    var msgType;

    var replyTo = ctx.quoteMsg ? ctx.quoteMsg.message_id : null;

    if (ctx.attach && (ctx.attach.type === 'image' || ctx.attach.type === 'file')) {
      var useChunked = ctx.attach.size > INLINE_ATTACH_MAX;
      if (useChunked) {
        if (ctx.kind !== 'channel' && ctx.kind !== 'room') {
          throw new Error(lang.fileTooLarge || 'File too large');
        }
        // Only clear UI draft after we know we're committing this transfer
        clearPendingAttach();
        if (state.quoteMsg) clearQuote();
        await sendChunkedFileTransfer(ctx.attach, ctx.text, replyTo, ctx);
        // poll only if still on same conversation
        if (state.activeKind === ctx.kind && state.activeId === ctx.id) {
          await pollMessages(true);
        }
        return;
      }

      // Small files: inline base64 under backend payload budget
      var dataUrl = ctx.attach.data;
      if (!dataUrl && ctx.attach.file) {
        dataUrl = await readFileAsDataURL(ctx.attach.file);
      }
      if (!dataUrl) throw new Error('Failed to read file');
      // Destination must not change mid-flight
      if (state.openGen !== ctx.generation
        && !(state.activeKind === ctx.kind && state.activeId === ctx.id)) {
        throw new Error(lang.sendCancelled || 'Conversation changed; send cancelled');
      }
      msgType = ctx.attach.type === 'image' ? 'image' : 'file';
      msgPayload = {
        data: dataUrl,
        filename: ctx.attach.name,
        mime_type: ctx.attach.mime,
        size: ctx.attach.size,
        text: ctx.text || '',
      };
      clearPendingAttach();
    } else if (ctx.attach) {
      // Federation content: tapp, brew, library, report — rich snapshot, never id-only.
      var attach = ctx.attach;
      msgType = attach.type;
      msgPayload = {
        title: (attach.name || '').trim() || (lang.shareUntitled || 'Untitled'),
        description: attach.desc || '',
        content_type: attach.type,
        // Prefer sanitized SVG only when local; receivers re-sanitize (ARO-01)
        icon: attach.icon || '',
        text: ctx.text || '',
      };
      if (attach.tappId) msgPayload.tapp_id = attach.tappId;
      if (attach.tappVersion) msgPayload.tapp_version = attach.tappVersion;
      if (attach.tappIcon) msgPayload.tapp_icon = attach.tappIcon;
      if (attach.name && attach.type === 'tapp') msgPayload.tapp_name = attach.name;
      // Only emit validated catalog refs (ARO-05)
      if (attach.storeSource && isValidStoreSourceRef(attach.storeSource)) {
        msgPayload.store_source = attach.storeSource.trim();
      }
      // Direct package remains optional but receivers must not auto-install as store fallback
      if (attach.installPackage) msgPayload.install_package = attach.installPackage;
      if (attach.installPackageOmitted) msgPayload.install_package_omitted = attach.installPackageOmitted;
      // The host rejects an oversized message payload outright (live cap, 2 MiB
      // on the saver profile), and multi-recipient E2E wrap makes the envelope
      // bigger still. Prefer store_source; drop the package when it will not fit.
      try {
        var est = JSON.stringify(msgPayload).length;
        if (est > MSG_PAYLOAD_SOFT_MAX && msgPayload.install_package) {
          delete msgPayload.install_package;
          msgPayload.install_package_omitted = 'payload_too_large';
        }
      } catch (eSz) { /* ignore size probe */ }
      if (attach.brewId) msgPayload.brew_id = attach.brewId;
      if (attach.brewLink) msgPayload.brew_link = attach.brewLink;
      if (attach.sourceIcon) msgPayload.source_icon = attach.sourceIcon;
      if (attach.sourceName) msgPayload.source_name = attach.sourceName;
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
        if (attach.playtimeMin != null) msgPayload.playtime_min = attach.playtimeMin;
        if (attach.rating != null) msgPayload.rating = attach.rating;
        if (attach.progressCur != null) msgPayload.progress_cur = attach.progressCur;
        if (attach.progressTotal != null) msgPayload.progress_total = attach.progressTotal;
        if (attach.artist) msgPayload.artist = attach.artist;
        if (attach.album) msgPayload.album = attach.album;
        if (attach.externalUrl) {
          var ext = typeof safeExternalHref === 'function' ? safeExternalHref(attach.externalUrl) : '';
          if (ext) msgPayload.external_url = ext;
        }
      } else {
        if (attach.platformId) msgPayload.platform_id = attach.platformId;
        if (attach.itemId) msgPayload.item_id = attach.itemId;
        if (attach.image) msgPayload.image = attach.image;
      }
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
      msgPayload = { text: ctx.text };
    }

    if (ctx.quoteMsg) {
      msgPayload.quote_sender = ctx.quoteMsg.sender;
      msgPayload.quote_text = ctx.quoteMsg.text;
      msgPayload.quote_id = ctx.quoteMsg.message_id;
      clearQuote();
    }

    // Attach structured @mentions (picker + free-typed @Name against roster)
    if (ctx.text && typeof extractMentionsFromText === 'function'
      && typeof getMentionCandidates === 'function') {
      var mentionList = extractMentionsFromText(ctx.text, getMentionCandidates());
      // Also resolve against full room roster (incl. self) so "@me" style works
      if (ctx.kind === 'room' && state.members && state.members.length) {
        var rosterCands = [];
        state.members.forEach(function (m) {
          var st = m.membership_status || m.status || 'active';
          if (st !== 'active') return;
          var nm = (m.display_name || m.username || (m.actor_url || '').split('/').pop() || '').trim();
          if (!nm) return;
          rosterCands.push({
            actor_url: m.actor_url || '',
            name: nm,
            username: (m.username || '').trim(),
          });
        });
        var fromRoster = extractMentionsFromText(ctx.text, rosterCands);
        // Merge unique by actor_url
        var seenA = {};
        mentionList.forEach(function (m) {
          var k = m.actor_url || m.name;
          if (k) seenA[k] = true;
        });
        fromRoster.forEach(function (m) {
          var k = m.actor_url || m.name;
          if (k && !seenA[k]) {
            seenA[k] = true;
            mentionList.push(m);
          }
        });
      }
      if (mentionList.length > 0) {
        msgPayload.mentions = mentionList;
      }
    }

    sendReq = { payload: msgPayload, message_type: msgType };
    if (replyTo) sendReq.reply_to = replyTo;
    // Prefer E2E only when session looks established. ARO-02: never auto-downgrade to plaintext
    // on client after encrypt=true fails — but skip encrypt for large rich shares (tapp package /
    // library snapshots) so multi-recipient room wrap does not explode past payload limits.
    // Room multi-recipient E2E wraps each recipient; packages explode past the payload cap.
    var forcePlain = !!(ctx.kind === 'room' && msgPayload && msgPayload.install_package);
    if (!forcePlain && state.e2ePreferEncrypt !== false && isE2eReadyForActive()) {
      sendReq.encrypt = true;
    }

    // Optimistic bubble for text + light inline image/file (skip chunked / huge / packages)
    var optId = null;
    var dataLen = (msgPayload && msgPayload.data) ? String(msgPayload.data).length : 0;
    var lightMedia = (msgType === 'image' || msgType === 'file') && dataLen > 0 && dataLen <= 350000;
    var canOptimistic = !forcePlain
      && !(msgPayload && msgPayload.install_package)
      && !(msgPayload && msgPayload.transfer_id)
      && (msgType === 'text' || lightMedia);
    if (canOptimistic && typeof pushOptimisticMessage === 'function'
      && state.activeKind === ctx.kind && state.activeId === ctx.id) {
      var optPayload = msgPayload;
      try { optPayload = JSON.parse(JSON.stringify(msgPayload)); } catch (eCp) { optPayload = msgPayload; }
      optId = pushOptimisticMessage(msgType, optPayload, {
        replyTo: replyTo,
        encrypt: !!sendReq.encrypt,
      });
      ctx.optId = optId;
    }

    var sendRes;
    if (ctx.kind === 'channel') {
      sendRes = await Tapp.federation.sendMessage(ctx.id, sendReq);
    } else {
      sendRes = await Tapp.federation.sendRoomMessage(ctx.id, sendReq);
    }
    if (typeof noteDeliveryEnqueue === 'function') noteDeliveryEnqueue(sendRes);
    if (state.activeKind === ctx.kind && state.activeId === ctx.id) {
      // Tie the bubble to the id the server just minted, so the confirmed copy
      // retires it on arrival even when the payload comes back encrypted and
      // there is no text left to compare. Then settle whatever already landed
      // (the room WS echo fires before this call returns) before the poll.
      var serverMsgId = sendRes && (sendRes.message_id || (sendRes.data && sendRes.data.message_id));
      if (optId && serverMsgId && typeof noteOptimisticServerId === 'function') {
        noteOptimisticServerId(optId, serverMsgId);
        if (typeof pruneOptimisticMessages === 'function'
          && pruneOptimisticMessages({})
          && typeof scheduleRenderMessages === 'function') {
          scheduleRenderMessages({ stickBottom: true, forceFull: true });
        }
      }
      await pollMessages(true);
      // Ensure optimistic row is gone even if server id differs before prune matched.
      // pollMessages already prunes and repaints in the common case — only repaint
      // when this call actually removed a row, or a plain image send would run two
      // more full innerHTML rebuilds back to back and re-decode the whole transcript.
      if (optId && typeof pruneOptimisticMessages === 'function') {
        if (pruneOptimisticMessages({ id: optId })
          && typeof scheduleRenderMessages === 'function') {
          scheduleRenderMessages({ stickBottom: true, forceFull: true });
        }
      }
    }
  } catch (e) {
    // Remove failed optimistic bubble
    if (ctx.optId && typeof pruneOptimisticMessages === 'function') {
      pruneOptimisticMessages({ id: ctx.optId });
      if (typeof renderMessages === 'function') renderMessages({ forceFull: true, stickBottom: true });
    }
    // Restore draft fully on failure (text; attachment already cleared only after successful read)
    if (ctx.text) input.value = ctx.text;
    if (ctx.attach && !state.pendingAttach) {
      try { state.pendingAttach = ctx.attach; if (typeof renderAttachPreview === 'function') renderAttachPreview(); } catch (eRest) { /* ignore */ }
    }
    if (ctx.quoteMsg && !state.quoteMsg) {
      try { state.quoteMsg = ctx.quoteMsg; if (typeof renderQuoteBar === 'function') renderQuoteBar(); } catch (eQ) { /* ignore */ }
    }
    var errMsg = (e && e.message) ? String(e.message) : '';
    if (sendReq && sendReq.encrypt) {
      notifyError(lang.e2eSendFail || lang.sendFail || 'Encrypted send failed (no plaintext fallback)', e);
    } else {
      notifyError(lang.sendFail, e);
    }
  } finally {
    state.sending = false;
    updateSendState();
    input.focus();
  }
}

/**
 * Surface outbound enqueue warnings (remote may not receive even though send returned 200).
 * Soft notice: one peer flaking should not look like the whole send failed.
 */
function noteDeliveryEnqueue(sendRes) {
  if (!sendRes) return;
  var d = sendRes.delivery || (sendRes.data && sendRes.data.delivery) || null;
  if (!d || !d.warning) return;
  var partial = d.queued > 0 && d.remote_targets > d.queued;
  var none = d.queued === 0 && d.remote_targets > 0;
  var title = partial
    ? (lang.deliveryPartialTitle || 'Some peers may be delayed')
    : (lang.deliveryWarnTitle || 'Delivery notice');
  var msg = d.warning;
  if (none) {
    msg = lang.deliveryNotQueued
      || 'Saved here, but could not queue for remote peers yet';
  } else if (partial) {
    msg = (lang.deliveryPartialBody
      || 'Queued for {q}/{t} remote targets — others will retry in the background')
      .replace('{q}', String(d.queued))
      .replace('{t}', String(d.remote_targets));
  } else if (lang.deliveryWarnBody) {
    msg = lang.deliveryWarnBody;
  }
  showDeliverySoftBanner(title, msg, partial || none ? 'warn' : 'info');
  console.warn('[Aro] delivery enqueue warning', d);
}

/** Soft in-app banner (not a blocking error toast) for federation delivery issues. */
function showDeliverySoftBanner(title, message, kind) {
  kind = kind || 'info';
  var host = document.querySelector('#chat-container') || document.body;
  if (!host) {
    try {
      Tapp.ui.showNotification({ title: title, message: message, type: kind === 'warn' ? 'info' : 'info' });
    } catch (e0) { /* ignore */ }
    return;
  }
  var el = $('aro-delivery-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aro-delivery-banner';
    el.className = 'aro-delivery-banner';
    el.setAttribute('role', 'status');
    host.appendChild(el);
  }
  el.className = 'aro-delivery-banner is-' + kind;
  el.innerHTML =
    '<div class="aro-delivery-banner-text">'
    + '<strong>' + esc(title || '') + '</strong>'
    + (message ? '<span>' + esc(message) + '</span>' : '')
    + '</div>'
    + '<button type="button" class="aro-delivery-banner-action" id="aro-delivery-banner-open">'
    + esc(lang.deliveryOpenSettings || lang.settingsDelivery || 'Delivery')
    + '</button>'
    + '<button type="button" class="aro-delivery-banner-dismiss" id="aro-delivery-banner-dismiss" aria-label="'
    + esc(lang.dismiss || lang.close || 'Dismiss') + '">×</button>';
  el.hidden = false;
  el.style.display = 'flex';
  var openBtn = $('aro-delivery-banner-open');
  if (openBtn) {
    openBtn.onclick = function () {
      try {
        if (typeof switchView === 'function') switchView('feed');
        if (typeof switchFeedSubTab === 'function') switchFeedSubTab('settings');
        setTimeout(function () {
          var card = $('settings-delivery-card');
          if (card && card.scrollIntoView) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 200);
      } catch (e1) { /* ignore */ }
    };
  }
  var dismissBtn = $('aro-delivery-banner-dismiss');
  if (dismissBtn) {
    dismissBtn.onclick = function () {
      el.hidden = true;
      el.style.display = 'none';
    };
  }
  // Auto-hide soft notices
  clearTimeout(showDeliverySoftBanner._t);
  showDeliverySoftBanner._t = setTimeout(function () {
    if (el) {
      el.hidden = true;
      el.style.display = 'none';
    }
  }, 12000);
}

/** Soft check for dead letters — quiet chip, not a scary error toast. */
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
      showDeliverySoftBanner(
        lang.deliveryDeadTitleSoft || lang.deliveryDeadTitle || 'Some messages need retry',
        (lang.deliveryDeadBodySoft
          || '{n} outbound federation deliveries failed — open Delivery to retry')
          .replace('{n}', String(dead)),
        'warn'
      );
    }
    if (dead === 0) {
      refreshDeliveryHealth._warned = false;
      refreshDeliveryHealth._retryOffered = false;
    }
  } catch (e) {
    /* stats API optional */
  }
}

// message fingerprint/merge/optimistic → page/msgSync.js

function clearRosterConfirmTimers() {
  var timers = state.rosterConfirmTimers || [];
  for (var i = 0; i < timers.length; i++) {
    try { clearTimeout(timers[i]); } catch (eClr) { /* ignore */ }
  }
  state.rosterConfirmTimers = [];
}

/**
 * Debounced conversation list refresh — confirm bursts must not spam GET /rooms.
 * @param {number} [ms] debounce window (default 400ms)
 */
function scheduleLoadConversations(ms) {
  if (typeof loadConversations !== 'function') return;
  var wait = ms != null ? ms : 400;
  if (state.loadConvDebounceTimer) {
    try { clearTimeout(state.loadConvDebounceTimer); } catch (eD) { /* ignore */ }
  }
  state.loadConvDebounceTimer = setTimeout(function () {
    state.loadConvDebounceTimer = null;
    loadConversations().catch(function () {});
  }, wait);
}

/**
 * Temporarily poll rooms faster so membership converges without waiting 15s.
 * @param {number} [ms] boost window length (default 20s)
 */
function boostRoomPoll(ms) {
  var windowMs = ms != null ? ms : 20000;
  state.rosterBoostUntil = Date.now() + windowMs;
  // Restart poll loop with a short interval while boosted.
  if (state.activeKind === 'room' && state.activeId) {
    startPolling();
  }
}

/**
 * Pull latest room roster (and optionally room detail). Used after membership
 * WS events and during poll so a missed RoomJoin still converges without
 * reopening the chat.
 *
 * @param {string} roomId
 * @param {number} [gen] openGen snapshot
 * @param {{ fetchDetail?: boolean, forceRender?: boolean, optimisticActor?: string, optimisticRole?: string }} [opts]
 * @returns {Promise<boolean>} true when roster content changed
 */
async function refreshRoomMembers(roomId, gen, opts) {
  opts = opts || {};
  if (!roomId || !Tapp.federation || typeof Tapp.federation.getRoomMembers !== 'function') {
    return false;
  }
  var useGen = gen != null ? gen : state.openGen;
  // Drop stale responses when confirm-burst / poll overlap.
  var fetchSeq = (state.rosterFetchSeq = (state.rosterFetchSeq || 0) + 1);

  // Optimistic insert so UI reacts before getRoomMembers round-trip.
  // Only paint if we still own the latest seq (a newer refresh may have started).
  if (opts.optimisticActor && typeof findMemberByActor === 'function') {
    if (!findMemberByActor(opts.optimisticActor) && fetchSeq === state.rosterFetchSeq) {
      state.members = (state.members || []).concat([{
        actor_url: opts.optimisticActor,
        role: opts.optimisticRole || 'member',
        membership_status: 'active',
        is_local: false,
        display_name: null,
        avatar_url: null,
      }]);
      if (typeof applyRoomMemberCount === 'function' && typeof activeMemberCountFromList === 'function') {
        applyRoomMemberCount(roomId, activeMemberCountFromList(state.members));
      }
      if (typeof renderMembers === 'function') renderMembers();
      if (typeof renderChatHeader === 'function') renderChatHeader();
      if (typeof renderConvList === 'function') renderConvList();
    }
  }

  try {
    var res = await Tapp.federation.getRoomMembers(roomId);
    // Stale network: a newer refreshRoomMembers already owns apply rights.
    if (fetchSeq !== state.rosterFetchSeq) return false;
    if (!isConversationCurrent('room', roomId, useGen)) return false;
    var next = unwrapRoomMembers(res);
    var prevFp = typeof membersFingerprint === 'function'
      ? membersFingerprint(state.members)
      : '';
    var nextFp = typeof membersFingerprint === 'function'
      ? membersFingerprint(next)
      : String(next.length);
    var changed = nextFp !== prevFp;
    state.members = next;
    var activeCount = typeof activeMemberCountFromList === 'function'
      ? activeMemberCountFromList(next)
      : next.length;
    if (typeof applyRoomMemberCount === 'function') {
      applyRoomMemberCount(roomId, activeCount);
    }

    if (opts.fetchDetail && typeof Tapp.federation.getRoom === 'function') {
      try {
        var detail = await Tapp.federation.getRoom(roomId);
        if (fetchSeq !== state.rosterFetchSeq) return changed;
        if (!isConversationCurrent('room', roomId, useGen)) return false;
        if (detail) {
          state.roomDetail = detail;
          // Prefer roster-derived active count when we have members loaded.
          if (next.length > 0 && typeof applyRoomMemberCount === 'function') {
            state.roomDetail.member_count = activeCount;
            applyRoomMemberCount(roomId, activeCount);
          } else if (detail.member_count != null && typeof applyRoomMemberCount === 'function') {
            applyRoomMemberCount(roomId, detail.member_count);
          }
        }
      } catch (eDetail) { /* ignore detail refresh */ }
    }

    if (fetchSeq !== state.rosterFetchSeq) return changed;
    if (changed || opts.forceRender) {
      if (typeof renderMembers === 'function') renderMembers();
      if (typeof renderChatHeader === 'function') renderChatHeader();
      if (typeof renderConvList === 'function') renderConvList();
    }
    return changed;
  } catch (e) {
    return false;
  }
}

/**
 * Actively confirm roster after join/leave: immediate pull + short burst of
 * re-fetches (federation delivery / DB lag often lands after the first GET).
 *
 * @param {string} roomId
 * @param {number} [gen]
 * @param {{
 *   optimisticActor?: string,
 *   optimisticRole?: string,
 *   expectActor?: string,
 *   expectAbsent?: string,
 *   delays?: number[],
 *   boostMs?: number,
 *   refreshList?: boolean
 * }} [opts]
 */
function confirmRoomMembers(roomId, gen, opts) {
  opts = opts || {};
  if (!roomId) return;
  var useGen = gen != null ? gen : state.openGen;
  clearRosterConfirmTimers();
  state.rosterConfirmToken = (state.rosterConfirmToken || 0) + 1;
  var token = state.rosterConfirmToken;
  boostRoomPoll(opts.boostMs != null ? opts.boostMs : 20000);

  // Burst: now, 250ms, 700ms, 1.5s, 3s, 6s — stop early when expectation met.
  // Note: optimistic insert is applied only on the first tick (index 0) so we
  // never race a second concurrent getRoomMembers against an older empty roster.
  var delays = opts.delays || [0, 250, 700, 1500, 3000, 6000];
  var confirmedStable = 0;

  function schedule(delay, index) {
    var tid = setTimeout(function () {
      if (token !== state.rosterConfirmToken) return;
      if (!isConversationCurrent('room', roomId, useGen)) return;
      refreshRoomMembers(roomId, useGen, {
        fetchDetail: index === 0 || index === delays.length - 1 || index === 2,
        forceRender: true,
        optimisticActor: index === 0 ? opts.optimisticActor : undefined,
        optimisticRole: opts.optimisticRole || 'member',
      }).then(function (changed) {
        if (token !== state.rosterConfirmToken) return;
        if (!isConversationCurrent('room', roomId, useGen)) return;

        // Optional: stop early once we see the expected actor appear/disappear twice in a row.
        var met = true;
        if (opts.expectActor && typeof findMemberByActor === 'function') {
          var m = findMemberByActor(opts.expectActor);
          met = !!(m && (m.membership_status || 'active') === 'active');
        }
        if (opts.expectAbsent && typeof findMemberByActor === 'function') {
          met = met && !findMemberByActor(opts.expectAbsent);
        }
        if (met && (opts.expectActor || opts.expectAbsent)) {
          confirmedStable += 1;
        } else if (opts.expectActor || opts.expectAbsent) {
          confirmedStable = 0;
        }

        // List refresh: first tick + last tick + early-stop only (debounced).
        if (opts.refreshList) {
          var isLast = index === delays.length - 1;
          var earlyStop = confirmedStable >= 2 && index < delays.length - 1;
          if (index === 0 || isLast || earlyStop) {
            scheduleLoadConversations(earlyStop || isLast ? 200 : 400);
          }
        }

        // Two consecutive confirms that meet expectation → cancel remaining bursts.
        if (confirmedStable >= 2 && index < delays.length - 1) {
          clearRosterConfirmTimers();
          // Bump token so any timer already past clearTimeout cannot apply.
          state.rosterConfirmToken = (state.rosterConfirmToken || 0) + 1;
          return;
        }
      }).catch(function () {});
    }, delay);
    state.rosterConfirmTimers = (state.rosterConfirmTimers || []).concat([tid]);
  }

  for (var i = 0; i < delays.length; i++) {
    schedule(delays[i], i);
  }
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
      res = await Tapp.federation.getMessages(id, undefined, MSG_WINDOW_LIMIT);
    } else {
      // Rooms: always poll messages. Roster only on force, boost window, or every 4th tick
      // (membership WS + confirm bursts cover the common path; full dual-fetch was heavy).
      state._roomMemberPollTick = (state._roomMemberPollTick || 0) + 1;
      var boostActive = !!(state.rosterBoostUntil && Date.now() < state.rosterBoostUntil);
      var shouldFetchMembers = !!force || boostActive || (state._roomMemberPollTick % 4 === 0);
      if (shouldFetchMembers) {
        var pollSeq = (state.rosterFetchSeq = (state.rosterFetchSeq || 0) + 1);
        var roomPoll = await Promise.allSettled([
          Tapp.federation.getRoomMessages(id, undefined, MSG_WINDOW_LIMIT),
          Tapp.federation.getRoomMembers(id),
        ]);
        if (!isConversationCurrent(kind, id, gen)) return;
        if (roomPoll[0].status === 'fulfilled') {
          res = roomPoll[0].value;
        }
        if (
          roomPoll[1].status === 'fulfilled'
          && roomPoll[1].value
          && pollSeq === state.rosterFetchSeq
        ) {
          var nextMembers = unwrapRoomMembers(roomPoll[1].value);
          var prevMfp = typeof membersFingerprint === 'function'
            ? membersFingerprint(state.members)
            : '';
          var nextMfp = typeof membersFingerprint === 'function'
            ? membersFingerprint(nextMembers)
            : String(nextMembers.length);
          if (force || nextMfp !== prevMfp) {
            state.members = nextMembers;
            var ac = typeof activeMemberCountFromList === 'function'
              ? activeMemberCountFromList(nextMembers)
              : nextMembers.length;
            if (typeof applyRoomMemberCount === 'function') applyRoomMemberCount(id, ac);
            if (typeof renderMembers === 'function') renderMembers();
            if (typeof renderChatHeader === 'function') renderChatHeader();
            if (typeof renderConvList === 'function') renderConvList();
          }
        }
      } else {
        res = await Tapp.federation.getRoomMessages(id, undefined, MSG_WINDOW_LIMIT);
      }
    }
    if (!isConversationCurrent(kind, id, gen)) return;
    if (res) {
      var msgs = res.messages || [];
      // Compare like with like. `msgs` is the server tail window; state.messages is
      // the merged list (older pages, optimistic rows, WS rows ahead of the poll,
      // plaintext retained over a ciphertext re-fetch). Fingerprinting one and
      // comparing it against the other never matches once those diverge, so every
      // tick fell through to a full innerHTML rebuild — the flicker, and the scroll
      // reset that rides along with it. Track the source window separately.
      var srcFp = messagesFingerprint(msgs);
      var hadError = !!state.chatLoadError;
      state.chatLoadError = null;
      if (force || srcFp !== state.messagesSrcFp || hadError) {
        state.messagesSrcFp = srcFp;
        // Snapshot before merge/prune: pruneOptimisticMessages rewrites
        // state.messagesFp itself, so reading it afterwards would compare the
        // new list against itself and skip the repaint that drops the bubble.
        var prevFp = state.messagesFp;
        var prevLen = state.messages.length;
        var prevLast = prevLen ? (state.messages[prevLen - 1].message_id || '') : '';
        // Prefer known plaintext over a poll that still only has ciphertext
        // (decrypt race on host / late key material).
        var mergedMsgs = typeof mergeMessageLists === 'function'
          ? mergeMessageLists(state.messages, msgs)
          : msgs;
        state.messages = mergedMsgs;
        // Drop optimistic rows that now have real local copies in the tail.
        if (typeof pruneOptimisticMessages === 'function') pruneOptimisticMessages({});
        // Memory cap when living on the tail (history still reachable via load-older)
        var MSG_STATE_MAX = 450;
        if (state.messages.length > MSG_STATE_MAX) {
          var nearBot = typeof isMessagesNearBottom === 'function'
            ? isMessagesNearBottom($('messages'))
            : true;
          if (nearBot || force) {
            var trimmed = state.messages.length - 350;
            if (trimmed > 0) {
              state.messages = state.messages.slice(trimmed);
              if (typeof ensureHistoryState === 'function') {
                ensureHistoryState().hasMoreMain = true;
              }
            }
          }
        }
        mergedMsgs = state.messages;
        state.messagesFp = messagesFingerprint(mergedMsgs);
        // A changed server window that merges to the same visible list (the common
        // case while a stuck ciphertext keeps re-arriving) must not repaint.
        var listUnchanged = state.messagesFp === prevFp;
        // Track whether more history likely exists above the live window
        if (typeof ensureHistoryState === 'function') {
          var hs = ensureHistoryState();
          if (hs.hasMoreMain == null || force) {
            hs.hasMoreMain = (msgs.length >= (MSG_WINDOW_LIMIT || 50));
          }
        }
        var stillCipher = false;
        for (var ci = 0; ci < mergedMsgs.length; ci++) {
          if (typeof isE2eCiphertextEnvelope === 'function'
            && isE2eCiphertextEnvelope(mergedMsgs[ci].payload)) {
            stillCipher = true;
            break;
          }
        }
        if (stillCipher) scheduleDecryptRefresh();
        else _decryptRefreshAttempts = 0;
        var grew = mergedMsgs.length > prevLen;
        var tailChanged = mergedMsgs.length
          && (mergedMsgs[mergedMsgs.length - 1].message_id || '') !== prevLast;
        var paint = typeof scheduleRenderMessages === 'function'
          ? scheduleRenderMessages
          : renderMessages;
        // force=true is open/send/decrypt — stick to bottom. Background poll preserves scroll.
        var stick = !!force;
        if (grew && tailChanged && !state.skipMsgAppear && !hadError) {
          paint({
            animateNew: true,
            newCount: Math.min(mergedMsgs.length - prevLen, 3),
            stickBottom: stick,
          });
        } else if (force || hadError || !listUnchanged) {
          paint({ forceFull: true, stickBottom: stick });
        }
      }
    }
  } catch (e) { /* ignore */ }
}

function currentPollInterval() {
  var base = state.pollInterval || 15000;
  if (state.activeKind === 'room' && state.rosterBoostUntil && Date.now() < state.rosterBoostUntil) {
    // Aggressive confirm window after membership changes.
    return Math.min(base, 2500);
  }
  return base;
}

function startPolling() {
  // Cancel only the poll loop — do NOT cancel roster confirm bursts.
  if (state.pollTimer) {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }
  function tick() {
    state.pollTimer = null;
    pollMessages(false);
    if (!state.activeId || !state.activeKind) return;
    // Drop boost when expired so interval returns to normal.
    if (state.rosterBoostUntil && Date.now() >= state.rosterBoostUntil) {
      state.rosterBoostUntil = 0;
    }
    state.pollTimer = setTimeout(tick, currentPollInterval());
  }
  state.pollTimer = setTimeout(tick, currentPollInterval());
}

function stopPolling() {
  if (state.pollTimer) {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }
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
    } else if (
      data.event === 'member_invited'
      || data.event === 'member_left'
      || data.event === 'member_joined'
      || data.event === 'member_removed'
      || data.event === 'member_kicked'
      || data.type === 'room_deleted'
    ) {
      // Membership on another room (or after switch): refresh list counts.
      scheduleLoadConversations(300);
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
      scheduleLoadConversations(300);
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
    var joinActor = data.event === 'member_joined' ? data.actor : null;
    var leaveActor = (
      data.event === 'member_left'
      || data.event === 'member_removed'
      || data.event === 'member_kicked'
    ) ? data.actor : null;
    // Owner promoted/demoted an admin — refresh roster (and header role badge).
    if (data.event === 'member_role_changed' && data.actor && data.role) {
      (state.members || []).forEach(function (m) {
        if (m.actor_url === data.actor
          || (typeof sameActorUrl === 'function' && sameActorUrl(m.actor_url, data.actor))) {
          m.role = data.role;
        }
      });
      if (typeof isLocalActor === 'function' && isLocalActor(data.actor) && state.roomDetail) {
        state.roomDetail.my_role = data.role;
      }
      if (typeof renderMembers === 'function') renderMembers();
      if (typeof renderChatHeader === 'function') renderChatHeader();
    }
    confirmRoomMembers(roomIdForMembers, genForMembers, {
      optimisticActor: joinActor || undefined,
      optimisticRole: data.role || 'member',
      expectActor: joinActor || undefined,
      expectAbsent: leaveActor || undefined,
      refreshList: true,
    });
    // Subtle toast when someone else joins the open room (not self).
    if (
      joinActor
      && typeof isLocalActor === 'function'
      && !isLocalActor(joinActor)
    ) {
      var joinLabel = joinActor.split('/').pop() || joinActor;
      try {
        Tapp.ui.showNotification({
          title: lang.memberJoined || lang.members || 'Member joined',
          message: joinLabel,
          type: 'info',
        });
      } catch (eJoinN) { /* ignore */ }
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
      if (ev.roomId !== state.activeId || state.activeKind !== 'room') {
        // Not the open room — still refresh list so member_count badges update.
        if (
          ev.event === 'member_joined'
          || ev.event === 'member_left'
          || ev.event === 'member_removed'
          || ev.event === 'member_invited'
          || ev.event === 'member_kicked'
        ) {
          scheduleLoadConversations(300);
        }
        return;
      }
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
      } else if (ev.event === 'stickers_changed') {
        if (typeof handleStickersChangedEvent === 'function') {
          handleStickersChangedEvent(ev);
        } else if (Array.isArray(ev.stickers) && state.roomDetail) {
          var sdc = state.roomDetail.shared_data_config || {};
          sdc.stickers = ev.stickers;
          state.roomDetail.shared_data_config = sdc;
        }
      } else if (
        ev.event === 'member_joined'
        || ev.event === 'member_left'
        || ev.event === 'member_removed'
        || ev.event === 'member_invited'
        || ev.event === 'member_kicked'
      ) {
        var joined = ev.event === 'member_joined' ? ev.actor : null;
        var left = (
          ev.event === 'member_left'
          || ev.event === 'member_removed'
          || ev.event === 'member_kicked'
        ) ? ev.actor : null;
        confirmRoomMembers(roomId, gen, {
          optimisticActor: joined || undefined,
          optimisticRole: ev.role || 'member',
          expectActor: joined || undefined,
          expectAbsent: left || undefined,
          refreshList: true,
        });
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
    // Refresh members & re-render popover (burst: invitee may still be pending).
    try {
      confirmRoomMembers(state.activeId, state.openGen, {
        delays: [0, 400, 1200, 3000],
        boostMs: 12000,
        refreshList: true,
      });
      // Popover contacts re-render after first tick; burst will re-render members panel.
      setTimeout(function () {
        if (typeof renderInvitePopoverContacts === 'function') renderInvitePopoverContacts();
      }, 100);
      if (typeof renderInvitePopoverContacts === 'function') renderInvitePopoverContacts();
    } catch (e2) {}
  } catch (e) {
    notifyError(lang.inviteFail, e);
  }
}

// → roomUi.js

// ==================== Member roles (owner) ====================
async function doSetMemberRole(actorUrl, role) {
  if (!state.activeId || state.activeKind !== 'room') return;
  if (!actorUrl || (role !== 'admin' && role !== 'member')) return;
  if (typeof Tapp.federation.setMemberRole !== 'function') {
    notifyError(lang.setRoleUnsupported || lang.adminRequired || 'Not available');
    return;
  }
  var name = (actorUrl || '').split('/').pop() || actorUrl;
  var confirmMsg = role === 'admin'
    ? (lang.promoteAdminConfirm || 'Make {name} a group admin?').replace('{name}', name)
    : (lang.demoteAdminConfirm || 'Remove admin from {name}?').replace('{name}', name);
  if (!(await aroConfirm(confirmMsg, true))) return;
  try {
    await Tapp.federation.setMemberRole(state.activeId, actorUrl, role);
    if (typeof loadRoomMembers === 'function') {
      await loadRoomMembers(state.activeId);
    } else if (typeof refreshRoomMembers === 'function') {
      await refreshRoomMembers();
    } else {
      try {
        var list = await Tapp.federation.getRoomMembers(state.activeId);
        var raw = (list && list.members) || list || [];
        state.members = Array.isArray(raw) ? raw : state.members;
      } catch (eL) { /* ignore */ }
    }
    if (typeof renderMembers === 'function') renderMembers();
    if (typeof renderChatHeader === 'function') renderChatHeader();
    try {
      Tapp.ui.showNotification({
        title: role === 'admin'
          ? (lang.promoteAdminOk || 'Admin granted')
          : (lang.demoteAdminOk || 'Admin removed'),
        type: 'success',
      });
    } catch (eN) { /* ignore */ }
  } catch (e) {
    notifyError(lang.setRoleFail || lang.sendFail || 'Failed', e);
  }
}

// ==================== Kick Member ====================
async function doKickMember(actorUrl) {
  if (!state.activeId || state.activeKind !== 'room') return;
  if (!(await aroConfirm(lang.kickConfirm, true))) return;
  try {
    await Tapp.federation.removeMember(state.activeId, actorUrl);
    // Confirm absence with a short burst (federated remove can lag).
    confirmRoomMembers(state.activeId, state.openGen, {
      expectAbsent: actorUrl,
      delays: [0, 300, 900, 2000, 4000],
      boostMs: 15000,
      refreshList: true,
    });
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
  state.messagesSrcFp = '';
  state.chatOpening = false;
  state.chatLoadError = null;
  if (typeof stopPolling === 'function') stopPolling();
  if (typeof clearRosterConfirmTimers === 'function') clearRosterConfirmTimers();
  state.rosterConfirmToken = (state.rosterConfirmToken || 0) + 1;
  state.rosterBoostUntil = 0;
  if (state.loadConvDebounceTimer) {
    try { clearTimeout(state.loadConvDebounceTimer); } catch (eLc2) { /* ignore */ }
    state.loadConvDebounceTimer = null;
  }
  if (typeof clearPendingAttach === 'function') clearPendingAttach();
  if (typeof clearQuote === 'function') clearQuote();
  if (typeof closeAttachMenu === 'function') closeAttachMenu();
  if (typeof closeMentionPicker === 'function') closeMentionPicker();
  if (typeof closeInvitePopover === 'function') closeInvitePopover();
  if (typeof resetHistoryOnConversationChange === 'function') resetHistoryOnConversationChange();
  if (typeof resetRoomFilesOnConversationChange === 'function') resetRoomFilesOnConversationChange();
  if (typeof resetStickersOnConversationChange === 'function') resetStickersOnConversationChange();
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
  var busyBtn = $('pending-accept-channel');
  if (typeof setActionBusy === 'function') {
    setActionBusy(busyBtn, true, lang.joining || lang.accept || '…');
  }
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
    if (typeof setActionBusy === 'function') setActionBusy(busyBtn, false);
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
  var busyBtn = $('pending-join-room');
  if (typeof setActionBusy === 'function') {
    setActionBusy(busyBtn, true, lang.joining || lang.creating || '…');
  }
  try {
    await Tapp.federation.joinRoom(state.activeId);
    if (state.roomDetail) {
      state.roomDetail.my_membership_status = 'active';
      state.roomDetail.my_role = state.roomDetail.my_role || 'member';
    }
    try {
      confirmRoomMembers(state.activeId, state.openGen, {
        refreshList: true,
        delays: [0, 200, 600, 1200, 2500, 5000],
      });
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
    if (typeof setActionBusy === 'function') setActionBusy(busyBtn, false);
  }
}

async function doAcceptRoomInvite() {
  if (!state.activeId || state.activeKind !== 'room') return;
  if (!Tapp.federation || typeof Tapp.federation.acceptRoomInvite !== 'function') {
    notifyError(lang.acceptFail || 'Accept not available');
    return;
  }
  var busyBtn = $('pending-accept-room');
  if (typeof setActionBusy === 'function') {
    setActionBusy(busyBtn, true, lang.joining || lang.accept || '…');
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
      confirmRoomMembers(state.activeId, state.openGen, {
        refreshList: true,
        delays: [0, 200, 600, 1200, 2500, 5000],
      });
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
    if (typeof setActionBusy === 'function') setActionBusy(busyBtn, false);
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

// → createUi.js

// ==================== View Switching ====================
function switchView(view) {
  if (state.isGuest && view !== 'feed') view = 'feed';
  var prev = state.currentView;
  if (prev === view) return;
  state.currentView = view;

  // Instant nav chrome first — user feedback before view paint.
  document.querySelectorAll('.aro-nav-item').forEach(function (btn) {
    var on = btn.dataset.view === view;
    btn.classList.toggle('aro-nav-active', on);
    if (btn.setAttribute) btn.setAttribute('aria-current', on ? 'page' : 'false');
  });

  // Leaving a view: clear overlays that can pin over the whole #tapp-content (create/compose).
  if (typeof sealAroInteractionSurfaces === 'function') {
    sealAroInteractionSurfaces({ keepChat: view === 'messages', keepConfirm: true });
  } else if (typeof dismissTransientUi === 'function') {
    dismissTransientUi({ keepChat: view === 'messages' });
  }

  var views = ['messages', 'feed', 'rings'];
  views.forEach(function (v) {
    var el = $('view-' + v);
    if (!el) return;
    if (v !== view) {
      el.classList.remove('aro-view-active', 'aro-view-enter');
      el.style.display = 'none';
      // Ensure inactive views never intercept pointer hits
      el.style.pointerEvents = 'none';
    } else {
      el.style.display = '';
      el.style.pointerEvents = '';
      el.classList.add('aro-view-active');
      // Enter animation only when actually changing views (not first paint).
      if (prev && prev !== view && typeof aroPlayEnter === 'function') {
        aroPlayEnter(el, 'aro-view-enter');
      }
    }
  });

  // Pause chat poll when not on messages; keep WS for quick resume.
  // Do not bump openGen here — active conversation should survive nav away/back.
  if (view === 'messages') {
    if (state.activeId) startPolling();
  } else {
    stopPolling();
    // Mid-open load must not keep skeleton when user left messenger.
    if (state.chatOpening) state.chatOpening = false;
  }
  // Contextual feed + is feed-only; hide and close menus when leaving feed.
  if (typeof updateFeedPlusVisibility === 'function') updateFeedPlusVisibility();
  if (view !== 'feed') {
    if (typeof closeFeedPlusMenu === 'function') closeFeedPlusMenu();
    if (typeof closeFollowDialog === 'function') closeFollowDialog();
  }
  // Load data for the view (rings always; feed only if not already loaded for sub-tab).
  if (view === 'feed') {
    var sub = state.feedSubTab || 'timeline';
    var already = state.feedLoaded && state.feedLoaded[sub];
    if (!already || (typeof loadFeed === 'function' && state.feedError)) {
      if (typeof loadFeed === 'function') loadFeed();
    }
  } else if (view === 'rings') {
    if (typeof loadRings === 'function') loadRings();
  }
}

// ==================== Shared scope ====================
// Republish the names this file's siblings read. See page/scope.js.
share.value({
  bindRealtimeListeners: bindRealtimeListeners,
  clearRosterConfirmTimers: clearRosterConfirmTimers,
  confirmRoomMembers: confirmRoomMembers,
  doAcceptChannel: doAcceptChannel,
  doAcceptRoomInvite: doAcceptRoomInvite,
  doCloseChannel: doCloseChannel,
  doDeleteChannel: doDeleteChannel,
  doDissolveRoom: doDissolveRoom,
  doInviteMember: doInviteMember,
  doJoinOpenRoom: doJoinOpenRoom,
  doKickMember: doKickMember,
  doLeaveRoom: doLeaveRoom,
  doRejectChannel: doRejectChannel,
  doRejectRoomInvite: doRejectRoomInvite,
  doSend: doSend,
  doSetMemberRole: doSetMemberRole,
  doTransferOwnership: doTransferOwnership,
  isConversationCurrent: isConversationCurrent,
  isOpenGenCurrent: isOpenGenCurrent,
  loadConversations: loadConversations,
  noteDeliveryEnqueue: noteDeliveryEnqueue,
  openConversation: openConversation,
  pollMessages: pollMessages,
  stopPolling: stopPolling,
  switchView: switchView,
  unsubscribeRealtime: unsubscribeRealtime,
});
