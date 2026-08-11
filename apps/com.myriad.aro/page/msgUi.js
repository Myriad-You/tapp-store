// ==================== Message UI (render builders + delegates) ====================
// Extracted from chat.js. Depends on helpers, state, attachments (download/openImage via call-time).
// Load order: helpers → attachments → msgUi → chat.

function resolveMessageType(msg, payload) {
  var msgType = (msg && msg.message_type) || 'text';
  payload = payload || ((msg && typeof msg.payload === 'object' && msg.payload) ? msg.payload : {});
  if (msgType === 'text' || !msgType) {
    var knownShareTypes = { tapp: 1, brew: 1, library: 1, report: 1, image: 1, file: 1, 'file-meta': 1 };
    if (payload.content_type && typeof payload.content_type === 'string' && knownShareTypes[payload.content_type]) {
      msgType = payload.content_type;
    } else if (payload.tapp_id) {
      msgType = 'tapp';
    } else if (payload.brew_id || payload.brew_link) {
      msgType = 'brew';
    } else if (payload.report_id) {
      msgType = 'report';
    } else if (payload.platform_id && (payload.item_id || payload.title)) {
      msgType = 'library';
    } else if (payload.data && payload.mime_type && String(payload.mime_type).indexOf('image/') === 0) {
      msgType = 'image';
    } else if (payload.transfer_id && payload.filename) {
      msgType = 'file-meta';
    } else if (payload.data && payload.filename) {
      msgType = 'file';
    }
  }
  return msgType || 'text';
}

/** Message body / caption HTML with @mention highlighting. */
function msgTextHtml(text, payload) {
  if (text == null || text === '') return '';
  if (typeof formatMessageTextHtml === 'function') return formatMessageTextHtml(text, payload);
  return esc(text);
}

/**
 * One-shot event delegation for #messages interactions.
 * Avoids rebinding O(n) listeners on every full re-render (hot path).
 */
function bindMessagesDelegates(container) {
  if (!container || container.dataset.msgDelegatesBound === '1') return;
  container.dataset.msgDelegatesBound = '1';

  container.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    // Retry empty/error
    if (t.closest('#messages-retry-btn')) {
      e.preventDefault();
      if (state.activeKind && state.activeId) openConversation(state.activeKind, state.activeId);
      return;
    }

    // Soft window: expand full in-memory history (or load older)
    var expandHist = t.closest('[data-msg-expand-history], #msg-expand-history');
    if (expandHist && container.contains(expandHist)) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof loadOlderMessagesIntoChat === 'function') {
        loadOlderMessagesIntoChat({ silent: true }).then(function () {
          if (typeof renderMessages === 'function') {
            renderMessages({ forceFull: true, forceFullHistory: true, stickBottom: false });
          }
        });
      } else if (typeof renderMessages === 'function') {
        renderMessages({ forceFull: true, forceFullHistory: true, stickBottom: false });
      }
      return;
    }

    // Tapp accept / reject
    var acceptBtn = t.closest('.msg-share-btn-accept');
    if (acceptBtn && container.contains(acceptBtn)) {
      e.preventDefault();
      e.stopPropagation();
      var cardA = acceptBtn.closest('.msg-share-card');
      var tappIdA = cardA ? cardA.dataset.tappId : '';
      if (!tappIdA) return;
      var stKeyA = (acceptBtn.dataset.acceptKey || (cardA && cardA.dataset.acceptKey) || '').trim();
      if (!stKeyA) {
        var msgIdxA = parseInt(acceptBtn.dataset.acceptIdx, 10);
        var mA = state.messages && state.messages[msgIdxA];
        stKeyA = typeof tappAcceptStorageKey === 'function' && mA
          ? tappAcceptStorageKey(mA, mA.payload || {})
          : ('tapp_accept_' + tappIdA + '_' + (mA && mA.message_id ? mA.message_id : msgIdxA));
      }
      if (!state.tappAcceptMap) state.tappAcceptMap = {};
      state.tappAcceptMap[stKeyA] = 'accepted';
      try { Tapp.storage.set(stKeyA, 'accepted').catch(function () {}); } catch (eStA) { /* ignore */ }
      openTappDetail(tappIdA, cardA);
      renderMessages({ forceFull: true });
      return;
    }
    var rejectBtn = t.closest('.msg-share-btn-reject');
    if (rejectBtn && container.contains(rejectBtn)) {
      e.preventDefault();
      e.stopPropagation();
      var cardR = rejectBtn.closest('.msg-share-card');
      var tappIdR = cardR ? cardR.dataset.tappId : '';
      if (!tappIdR) return;
      var stKeyR = (rejectBtn.dataset.acceptKey || (cardR && cardR.dataset.acceptKey) || '').trim();
      if (!stKeyR) {
        var msgIdxR = parseInt(rejectBtn.dataset.rejectIdx, 10);
        var mR = state.messages && state.messages[msgIdxR];
        stKeyR = typeof tappAcceptStorageKey === 'function' && mR
          ? tappAcceptStorageKey(mR, mR.payload || {})
          : ('tapp_accept_' + tappIdR + '_' + (mR && mR.message_id ? mR.message_id : msgIdxR));
      }
      if (!state.tappAcceptMap) state.tappAcceptMap = {};
      state.tappAcceptMap[stKeyR] = 'rejected';
      try { Tapp.storage.set(stKeyR, 'rejected').catch(function () {}); } catch (eStR) { /* ignore */ }
      renderMessages({ forceFull: true });
      return;
    }

    // File download card
    var fileCard = t.closest('.msg-file-card');
    if (fileCard && container.contains(fileCard) && !fileCard.disabled) {
      e.preventDefault();
      e.stopPropagation();
      var fIdx = parseInt(fileCard.dataset.fileIdx, 10);
      var fMsg = state.messages[fIdx];
      if (fMsg && fMsg.payload) downloadMessageFile(fMsg.payload, fileCard);
      return;
    }

    // Quote → jump
    var qEl = t.closest('.msg-quote-block[data-quote-id]');
    if (qEl && container.contains(qEl)) {
      e.preventDefault();
      e.stopPropagation();
      var qid = qEl.getAttribute('data-quote-id');
      if (!qid) return;
      if (typeof jumpToHistoryMessage === 'function') {
        jumpToHistoryMessage(qid);
      } else {
        var target = container.querySelector('[data-msg-id="' + String(qid).replace(/"/g, '') + '"]');
        if (target) {
          try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (eJ) { /* ignore */ }
          target.classList.add('msg-highlight');
          setTimeout(function () {
            try { target.classList.remove('msg-highlight'); } catch (eK) { /* ignore */ }
          }, 2200);
        }
      }
      return;
    }

    // Image / sticker viewer
    var mediaEl = t.closest('.msg-media[data-media-idx], .msg-sticker[data-media-idx]');
    if (mediaEl && container.contains(mediaEl)) {
      e.preventDefault();
      e.stopPropagation();
      var mMedia = state.messages[parseInt(mediaEl.dataset.mediaIdx, 10)];
      if (!mMedia || !mMedia.payload || !mMedia.payload.data) return;
      openImageViewer(mMedia.payload.data, mMedia.payload.filename || '');
      return;
    }

    // Share / media cards (library play, brew open, tapp/report detail)
    var shareCard = t.closest('.msg-share-card[data-type], .msg-media-card[data-type]');
    if (shareCard && container.contains(shareCard)) {
      if (t.closest('.msg-share-actions')) return;
      e.preventDefault();
      e.stopPropagation();
      var type = shareCard.dataset.type;
      var payload = typeof shareCardPayload === 'function' ? shareCardPayload(shareCard) : {};
      if (!payload.platform_id && shareCard.dataset.platformId) payload.platform_id = shareCard.dataset.platformId;
      if (!payload.item_id && shareCard.dataset.itemId) payload.item_id = shareCard.dataset.itemId;
      if (!payload.item_type && shareCard.dataset.itemType) payload.item_type = shareCard.dataset.itemType;
      if (!payload.external_url && shareCard.dataset.externalUrl) payload.external_url = shareCard.dataset.externalUrl;
      if (!payload.image && shareCard.dataset.image) payload.image = shareCard.dataset.image;
      if (!payload.artist && shareCard.dataset.artist) payload.artist = shareCard.dataset.artist;
      if (!payload.album && shareCard.dataset.album) payload.album = shareCard.dataset.album;
      if (!payload.brew_link && shareCard.dataset.brewLink) payload.brew_link = shareCard.dataset.brewLink;
      if (!payload.title) {
        var tEl = shareCard.querySelector('.msg-share-title, .msg-media-title');
        if (tEl) payload.title = tEl.textContent || '';
      }

      if (type === 'tapp' && shareCard.dataset.tappId) {
        var stKey = (shareCard.dataset.acceptKey || '').trim();
        if (!stKey) {
          stKey = 'tapp_accept_' + shareCard.dataset.tappId + '_' + (shareCard.dataset.msgIdx || '');
        }
        var status = state.tappAcceptMap && state.tappAcceptMap[stKey];
        var isLocal = shareCard.closest('.msg-local');
        if (isLocal || status === 'accepted') {
          openTappDetail(shareCard.dataset.tappId, shareCard);
        }
        return;
      }

      if (type === 'report') {
        var rid = shareCard.dataset.reportId || payload.report_id;
        if (rid) openReportDetail(rid, shareCard);
        return;
      }

      if (typeof activateShareCard === 'function') {
        activateShareCard(type, payload, shareCard).then(function (result) {
          if (result === 'played' || result === 'opened') return;
          try {
            Tapp.ui.showNotification({
              title: lang.shareNoAction || lang.openOriginal || lang.loadFail || 'Unavailable',
              message: type === 'library'
                ? (lang.shareNoLink || 'No playable media or link for this share')
                : (lang.shareNoLink || 'No link for this share'),
              type: 'info',
            });
          } catch (eN) { /* ignore */ }
        }).catch(function () {
          try {
            Tapp.ui.showNotification({
              title: lang.mediaPlayFail || lang.loadFail || 'Failed',
              type: 'error',
            });
          } catch (e2) { /* ignore */ }
        });
      }
    }
  });

  // Keyboard open for media figures
  container.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var mediaEl = e.target && e.target.closest && e.target.closest('.msg-media[data-media-idx], .msg-sticker[data-media-idx]');
    if (!mediaEl || !container.contains(mediaEl)) return;
    e.preventDefault();
    var mMedia = state.messages[parseInt(mediaEl.dataset.mediaIdx, 10)];
    if (!mMedia || !mMedia.payload || !mMedia.payload.data) return;
    openImageViewer(mMedia.payload.data, mMedia.payload.filename || '');
  });

  // Favicon / cover load errors (error bubbles)
  container.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    if (img.classList.contains('msg-share-favicon') && img.dataset.fallback) {
      var tile = img.parentNode;
      if (!tile) return;
      var glyphs = { tapp: SVG_ICONS.tapp, brew: SVG_ICONS.brew, library: SVG_ICONS.library, report: SVG_ICONS.report };
      tile.removeAttribute('data-mark');
      var markedCard = tile.closest('.msg-share-card');
      if (markedCard) markedCard.removeAttribute('data-mark');
      tile.innerHTML = glyphs[img.dataset.fallback] || SVG_ICONS.file;
      return;
    }
    if (img.classList.contains('msg-media-cover-img')) {
      var cover = img.closest('.msg-media-cover');
      if (cover) cover.setAttribute('data-broken', '1');
    }
  }, true);

  // Cover orientation after load (load does not bubble — capture phase on container works for target)
  container.addEventListener('load', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.classList.contains('msg-media-cover-img')) return;
    var card = img.closest('.msg-media-card');
    if (!card || card.dataset.orient === 'square' || !img.naturalWidth || !img.naturalHeight) return;
    card.dataset.orient = (img.naturalWidth / img.naturalHeight >= 1.15) ? 'landscape' : 'portrait';
  }, true);
}


/**
 * Natural size of transcript images, by message id.
 *
 * A full innerHTML rebuild discards every decoded <img>, and a fresh one has no
 * intrinsic size until it decodes again — image bubbles collapse to nothing, the
 * scrollport shrinks, and whatever scrollTop we restore is clamped to that short
 * box. Replaying a size we already measured lets the browser reserve the real
 * box up front, which is what makes a rebuild layout-stable.
 *
 * Null-prototype: keys are peer-controlled message ids, so a literal
 * `constructor` would otherwise read back a truthy inherited value.
 */
var _msgMediaSizes = Object.create(null);
var MSG_MEDIA_SIZE_MAX = 400;

/** Remember a decoded image's natural size for the next rebuild of its row. */
function noteMessageMediaSize(messageId, w, h) {
  if (!messageId || !w || !h) return;
  if (_msgMediaSizes[messageId]) return;
  var keys = Object.keys(_msgMediaSizes);
  if (keys.length >= MSG_MEDIA_SIZE_MAX) {
    // Oldest-inserted first — enumeration order for string keys is insertion order.
    for (var i = 0; i < 80 && i < keys.length; i++) delete _msgMediaSizes[keys[i]];
  }
  _msgMediaSizes[messageId] = { w: w, h: h };
}

/** `width`/`height` attributes for a row's image, once a decode has told us. */
function messageMediaSizeAttrs(messageId) {
  var size = messageId ? _msgMediaSizes[messageId] : null;
  return size ? (' width="' + size.w + '" height="' + size.h + '"') : '';
}

/** Calendar-day key used for day separators and run grouping. */
function msgDayKey(iso) {
  try {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  } catch (e) {
    return '';
  }
}

/** Gap after which consecutive messages stop reading as one burst. */
var MSG_RUN_GAP_MS = 5 * 60 * 1000;

/**
 * Would `msg` render as a continuation of `prevMsg`'s bubble run?
 *
 * Same author, within the burst window, and on the same side of a day
 * separator — a separator visually breaks the run even when the two messages
 * are minutes apart across midnight.
 */
function isSameSenderRun(prevMsg, msg) {
  if (!prevMsg || !msg) return false;
  if (!sameActorUrl(prevMsg.sender_actor, msg.sender_actor)) return false;
  if (!prevMsg.created_at || !msg.created_at) return false;
  if (msgDayKey(prevMsg.created_at) !== msgDayKey(msg.created_at)) return false;
  try {
    return Math.abs(new Date(msg.created_at) - new Date(prevMsg.created_at)) < MSG_RUN_GAP_MS;
  } catch (e) {
    return false;
  }
}

/**
 * Neighbouring message that actually paints a bubble.
 *
 * Key-exchange rows render as system separators, so they must not be read as
 * "someone else spoke" when deciding where a run starts and ends.
 */
function adjacentBubbleMessage(idx, step) {
  var list = state.messages || [];
  for (var i = idx + step; i >= 0 && i < list.length; i += step) {
    var m = list[i];
    if (!m) continue;
    var p = (typeof m.payload === 'object' && m.payload) ? m.payload : {};
    if (isE2eKeyExchangeMessage(m, resolveMessageType(m, p), p)) continue;
    return m;
  }
  return null;
}

/**
 * Hand the avatar down to the new end of a burst after an append-only paint.
 *
 * The fast path writes only the rows it adds, so the bubble that *was* the last
 * of a run still carries the face. Swap it for a spacer once an appended
 * message extends that same run.
 *
 * @param {HTMLElement} container #messages
 * @param {number} tailIdx index of the row that was last before the append
 */
function syncRunTailAvatar(container, tailIdx) {
  if (!container || tailIdx < 0) return;
  var tailMsg = state.messages && state.messages[tailIdx];
  if (!tailMsg || !tailMsg.message_id) return;
  if (typeof isLocalActor === 'function' && isLocalActor(tailMsg.sender_actor)) return;
  if (!isSameSenderRun(tailMsg, adjacentBubbleMessage(tailIdx, 1))) return;
  var row = container.querySelector('.msg-row[data-msg-id="' + cssEscapeAttr(tailMsg.message_id) + '"]');
  if (!row) return;
  var avatar = row.querySelector(':scope > .msg-avatar');
  if (!avatar) return;
  var spacer = document.createElement('div');
  spacer.className = 'msg-avatar-spacer';
  row.replaceChild(spacer, avatar);
}

/**
 * Build HTML for one message entry (optional day separator + row).
 * @param {object} msg
 * @param {number} idx
 * @param {{ appearFrom: number, dayCtx: { lastDayKey: string } }} opts
 */
function buildMessageEntryHtml(msg, idx, opts) {
  opts = opts || {};
  var appearFrom = opts.appearFrom != null ? opts.appearFrom : Infinity;
  var dayCtx = opts.dayCtx || { lastDayKey: '' };
  var html = '';
  var local = isLocalActor(msg.sender_actor);
  var sender = (msg.sender_actor || '').split('/').pop() || '?';
  var payload = (typeof msg.payload === 'object' && msg.payload) ? msg.payload : {};
  var msgType = resolveMessageType(msg, payload);
  // E2E key exchange is protocol traffic stored as history — show as system
  // separator, never as a bubble of raw {algorithm, publicKey, direction}.
  if (isE2eKeyExchangeMessage(msg, msgType, payload)) {
    var kxLabel = e2eKeyExchangeLabel(msg, payload);
    html += '<div class="msg-day-sep msg-e2e-sep" data-msg-id="' + esc(msg.message_id || '') + '">'
      + '<span class="msg-day-label">' + esc(kxLabel) + '</span></div>';
    return html;
  }
  var text = e2eUndecryptableLabel(msg, payload) || getPayloadText(msg.payload);
  var pinned = msg.is_pinned ? '<span class="msg-pin"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 11V4a1 1 0 011-1h4a1 1 0 011 1v7"/><path d="M5 17h14"/><path d="M7 11l-2 6h14l-2-6"/></svg></span>' : '';

  // Resolve avatar and display name for remote messages
  var avatarUrl = '';
  var displayName = sender;
  if (!local) {
    if (state.activeKind === 'channel' && state.channelDetail) {
      avatarUrl = state.channelDetail.remote_actor_avatar || '';
      displayName = state.channelDetail.remote_actor_name || sender;
    } else if (state.activeKind === 'room') {
      var member = findMemberByActor(msg.sender_actor);
      if (member) {
        displayName = member.display_name || sender;
        avatarUrl = member.avatar_url || '';
      }
    }
  }

  // Day separators
  var dayKey = msgDayKey(msg.created_at);
  if (dayKey && dayKey !== dayCtx.lastDayKey) {
    dayCtx.lastDayKey = dayKey;
    html += '<div class="msg-day-sep"><span class="msg-day-label">' + esc(dayLabel(msg.created_at)) + '</span></div>';
  }

  // Compact: continues the previous author's burst (drops the name + top gap).
  var compact = isSameSenderRun(adjacentBubbleMessage(idx, -1), msg);
  // The avatar belongs to the *last* bubble of a burst, level with where the
  // run ends — the name at the top already says who is speaking, and pinning
  // the face to the first bubble leaves it floating above the reply target.
  var runEnd = !isSameSenderRun(msg, adjacentBubbleMessage(idx, 1));

  html += '<div class="msg-row ' + (local ? 'msg-local' : 'msg-remote') + (compact ? ' msg-compact' : '')
    + (idx >= appearFrom ? ' msg-appear' : '')
    + (msg._optimistic ? ' msg-optimistic' : '')
    + '" data-msg-id="' + esc(msg.message_id || '') + '">';
  if (!local) {
    if (runEnd) {
      html += '<div class="msg-avatar">' + avatarContentHtml(avatarUrl, displayName) + '</div>';
    } else {
      html += '<div class="msg-avatar-spacer"></div>';
    }
  }
  // Rich media / share cards carry their own surface — the card *is* the bubble
  // whenever there is no caption or quote to host alongside it.
  var isMediaMsg = (msgType === 'image' && payload.data)
    || msgType === 'file' || msgType === 'file-meta'
    || msgType === 'tapp' || msgType === 'brew' || msgType === 'library' || msgType === 'report';
  var bareMedia = isMediaMsg && !payload.text && !payload.quote_sender && !payload.quote_text;

  html += '<div class="msg-bubble ' + (local ? 'bubble-local' : 'bubble-remote')
    + (bareMedia ? ' bubble-media' : '') + '">';
  html += '<button type="button" class="msg-more-btn" title="' + esc(lang.msgActions || 'Message actions') + '" aria-label="' + esc(lang.msgActions || 'Message actions') + '">'
    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>'
    + '</button>';
  if (!local && !compact) {
    html += '<div class="msg-sender">' + esc(displayName) + '</div>';
  }

  // Render quoted message if present (snapshot travels in payload for both parties)
  if (payload.quote_sender || payload.quote_text || payload.quote_id) {
    var qId = payload.quote_id || msg.reply_to || '';
    html += '<button type="button" class="msg-quote-block"'
      + (qId ? ' data-quote-id="' + esc(qId) + '"' : '')
      + ' title="' + esc(lang.roomFilesJump || lang.historyJump || 'Show in chat') + '">'
      + '<div class="msg-quote-bar"></div>'
      + '<div class="msg-quote-content">'
      + '<div class="msg-quote-sender">' + esc(payload.quote_sender || '') + '</div>'
      + '<div class="msg-quote-text">' + esc(payload.quote_text || '') + '</div>'
      + '</div></button>';
  }

  // Render content based on message type
  if (msgType === 'image' && payload.data) {
    // Use message-sized validator (not safeIconUrl's 256 KiB icon cap).
    var safeImg = typeof safeMessageImageUrl === 'function'
      ? safeMessageImageUrl(payload.data)
      : safeIconUrl(payload.data);
    var isStickerMsg = !!(payload.sticker === true || payload.sticker === 1 || payload.as_sticker);
    // Replay a size an earlier decode measured so the bubble reserves its box
    // immediately instead of collapsing until the pixels arrive again.
    var sizeAttrs = messageMediaSizeAttrs(msg.message_id);
    var sizedFlag = sizeAttrs ? ' data-sized="1"' : '';
    if (safeImg) {
      if (isStickerMsg) {
        // Compact sticker bubble (no photo chrome)
        html += '<button type="button" class="msg-sticker" data-media-idx="' + idx + '"' + sizedFlag
          + ' aria-label="' + esc(payload.filename || lang.stickerBtn || 'Sticker') + '">'
          + '<img class="msg-sticker-img" src="' + esc(safeImg) + '" alt="" loading="lazy" decoding="async" draggable="false"' + sizeAttrs + ' />'
          + '</button>';
      } else {
        html += '<figure class="msg-media" data-media-idx="' + idx + '"' + sizedFlag + ' tabindex="0" role="button"'
          + ' aria-label="' + esc(payload.filename || lang.attachImage || 'Image') + '">'
          + '<img class="msg-image" src="' + esc(safeImg) + '" alt="' + esc(payload.filename || '') + '" loading="lazy" decoding="async"' + sizeAttrs + ' />'
          + '<span class="msg-media-veil"></span>'
          + '<span class="msg-media-zoom">' + SVG_ICONS.expand + '</span>'
          + '</figure>';
      }
    } else {
      html += '<div class="msg-text">' + esc(payload.filename || lang.attachImage || 'Image') + '</div>';
    }
    if (payload.text && !isStickerMsg) {
      html += '<div class="msg-text msg-caption">'
        + (msgTextHtml(payload.text, payload))
        + '</div>';
    }
  } else if (msgType === 'file' || msgType === 'file-meta') {
    var fileMeta = fileCardMeta(payload.filename, payload.mime_type);
    var hasInline = !!(payload.data);
    var hasTransfer = !!(payload.transfer_id);
    var canDownload = hasInline || hasTransfer;
    var metaBits = [];
    if (payload.size) metaBits.push(formatFileSize(payload.size));
    if (fileMeta.ext) metaBits.push(fileMeta.ext);
    if (hasTransfer && !hasInline) metaBits.push(lang.attachFile || 'file');
    var sizeLabel = metaBits.join(' · ');
    var fileTitle = canDownload
      ? (lang.downloadFile || payload.filename || 'File')
      : (payload.filename || lang.previewFile || 'File');
    // Inline base64 OR completed chunked transfer (transfer_id) → downloadable
    html += '<button type="button" class="msg-file-card' + (canDownload ? '' : ' msg-file-card-disabled') + '"'
      + ' data-kind="' + esc(fileMeta.kind) + '" data-file-idx="' + idx + '"'
      + (hasInline ? ' data-has-inline="1"' : '')
      + (hasTransfer ? ' data-transfer-id="' + esc(payload.transfer_id) + '"' : '')
      + (canDownload ? '' : ' disabled')
      + ' title="' + esc(fileTitle) + '">'
      + '<span class="msg-file-icon">' + fileMeta.glyph
      + (fileMeta.ext ? '<em class="msg-file-ext">' + esc(fileMeta.ext) + '</em>' : '') + '</span>'
      + '<span class="msg-file-info">'
      + '<span class="msg-file-name">' + esc(payload.filename || 'file') + '</span>'
      + '<span class="msg-file-size">' + esc(sizeLabel) + '</span>'
      + '</span>'
      + '<span class="msg-file-action">' + (canDownload ? SVG_ICONS.download : SVG_ICONS.cloud) + '</span>'
      + '</button>';
    if (payload.text) {
      html += '<div class="msg-text msg-caption">'
        + (msgTextHtml(payload.text, payload))
        + '</div>';
    }
  } else if (msgType === 'tapp' || msgType === 'brew' || msgType === 'library' || msgType === 'report') {
    // A library share that carries cover art renders as an image-forward media
    // card (poster + sender attribution); everything else stays the compact row.
    var mediaView = (msgType === 'library') ? libraryMediaView(payload) : null;
    if (mediaView && safeIconUrl(mediaView.image)) {
      html += libraryMediaCardHtml(idx, payload, mediaView);
      if (payload.text) {
        html += '<div class="msg-text msg-caption">'
          + (msgTextHtml(payload.text, payload))
          + '</div>';
      }
    } else {
    var shareIcons = { tapp: SVG_ICONS.tapp, brew: SVG_ICONS.brew, library: SVG_ICONS.library, report: SVG_ICONS.report };
    var shareCardId = 'share-card-' + idx;
    // Unified share fields so cards never render blank (type label + title + optional desc/cover).
    var shareView = resolveShareCardView(msgType, payload);
    var shareTitle = shareView.title;
    var shareDesc = shareView.description;
    var shareCover = shareView.image;
    // The icon carries the type, so it must be the real source mark where one
    // exists: cover art > the tapp's own icon > the source site / platform
    // logo > the generic type glyph (older messages carry no logo fields).
    var shareSlug = '';
    if (msgType === 'report') shareSlug = payload.platform || payload.platform_id || '';
    else if (msgType === 'library') shareSlug = payload.platform_id || '';
    else if (msgType === 'brew') shareSlug = payload.source_name || '';
    var shareLogo = platformLogoSvg(shareSlug);
    var shareFavicon = msgType === 'brew' ? safeIconUrl(payload.source_icon) : '';
    var iconContent = '';
    // '' | 'brand' (known platform → brand palette) | 'img' (favicon supplies
    // its own colors, so the card stays neutral)
    var iconMark = '';
    if (shareCover && safeIconUrl(shareCover)) {
      iconContent = '<img src="' + esc(safeIconUrl(shareCover)) + '" alt="" />';
    } else if (msgType === 'tapp' && payload.tapp_icon) {
      // ARO-01: never inject untrusted SVG/HTML from federation payload
      iconContent = sanitizeRemoteSvg(payload.tapp_icon) || shareIcons.tapp || SVG_ICONS.tapp;
    } else if (shareFavicon) {
      // data-fallback: swapped in on load error (dead favicon / hotlink block)
      iconContent = '<img class="msg-share-favicon" src="' + esc(shareFavicon) + '" alt="" data-fallback="' + esc(msgType) + '" />';
      iconMark = 'img';
    } else if (shareLogo) {
      iconContent = shareLogo;
      iconMark = 'brand';
    } else {
      // payload.icon may be remote SVG/HTML — sanitize or fall back
      var rawIcon = payload.icon || '';
      iconContent = (rawIcon && sanitizeRemoteSvg(rawIcon))
        || shareIcons[msgType]
        || SVG_ICONS.file;
    }
    // Brand accent drives --acc (tile, wash, hover border) for known platforms.
    // Emitted as -l/-d pairs so the stylesheet — not inline style — picks the
    // theme variant; an inline --acc would outrank the .dark rule.
    var shareAccent = iconMark === 'brand' ? platformAccent(shareSlug) : null;
    var shareAccentStyle = shareAccent
      ? ';--acc-l:' + shareAccent.l + ';--acc-d:' + shareAccent.d
      : '';
    // Determine tapp share acceptance status from storage (stable key, not list idx)
    var tappAcceptStatus = '';
    var stKey = '';
    if (msgType === 'tapp' && payload.tapp_id) {
      stKey = typeof tappAcceptStorageKey === 'function'
        ? tappAcceptStorageKey(msg, payload)
        : ('tapp_accept_' + payload.tapp_id + '_' + (msg.message_id || idx));
      tappAcceptStatus = (state.tappAcceptMap && state.tappAcceptMap[stKey]) || '';
    }
    // Undecided incoming tapp share → decision card (no drill-in affordance yet)
    var shareNeedsDecision = (msgType === 'tapp' && !local && !tappAcceptStatus);
    html += '<div class="msg-share-card" id="' + shareCardId + '"'
      + ' style="cursor:pointer' + shareAccentStyle + '" data-type="' + esc(msgType) + '"'
      + (payload.tapp_id ? ' data-tapp-id="' + esc(payload.tapp_id) + '"' : '')
      + (payload.tapp_version ? ' data-tapp-version="' + esc(payload.tapp_version) + '"' : '')
      + (payload.tapp_name ? ' data-tapp-name="' + esc(payload.tapp_name) + '"' : '')
      + ((payload.store_source || payload.storeSource) && isValidStoreSourceRef(payload.store_source || payload.storeSource)
        ? ' data-store-source="' + esc(payload.store_source || payload.storeSource) + '"'
        : '')
      + (payload.brew_id ? ' data-brew-id="' + esc(String(payload.brew_id)) + '"' : '')
      + (payload.brew_link && safeExternalHref(payload.brew_link) ? ' data-brew-link="' + esc(safeExternalHref(payload.brew_link)) + '"' : '')
      + (payload.platform_id ? ' data-platform-id="' + esc(payload.platform_id) + '"' : '')
      + (payload.item_id ? ' data-item-id="' + esc(String(payload.item_id)) + '"' : '')
      + (payload.item_type || (payload.content_type && payload.content_type !== 'library')
        ? ' data-item-type="' + esc(String(payload.item_type || payload.content_type)) + '"'
        : '')
      + (payload.artist ? ' data-artist="' + esc(payload.artist) + '"' : '')
      + (payload.album ? ' data-album="' + esc(payload.album) + '"' : '')
      + (function () {
          var eu = typeof libraryExternalUrl === 'function' ? libraryExternalUrl(payload) : '';
          if (!eu && payload.external_url) eu = safeExternalHref(payload.external_url) || '';
          return eu ? ' data-external-url="' + esc(eu) + '"' : '';
        })()
      + (typeof isPlayableLibraryShare === 'function' && isPlayableLibraryShare(payload)
        ? ' data-playable="1"'
        : '')
      + (shareCover && safeIconUrl(shareCover) ? ' data-image="' + esc(safeIconUrl(shareCover)) + '"' : '')
      + (payload.report_id ? ' data-report-id="' + esc(payload.report_id) + '"' : '')
      + (payload.summary ? ' data-report-summary="' + esc(payload.summary) + '"' : '')
      + (payload.platform ? ' data-report-platform="' + esc(payload.platform) + '"' : '')
      + (payload.content_preview ? ' data-report-content-preview="' + esc(payload.content_preview) + '"' : '')
      + ' data-msg-idx="' + idx + '"'
      + (msg.message_id ? ' data-msg-id="' + esc(msg.message_id) + '"' : '')
      + (stKey ? ' data-accept-key="' + esc(stKey) + '"' : '')
      + (shareNeedsDecision ? ' data-pending="1"' : '')
      + (iconMark ? ' data-mark="' + iconMark + '"' : '')
      + '>'
      + '<span class="msg-share-wash" aria-hidden="true"></span>'
      + '<div class="msg-share-main">'
      + '<div class="msg-share-icon"' + (shareCover && safeIconUrl(shareCover) ? ' data-cover="1"' : '') + (iconMark ? ' data-mark="' + iconMark + '"' : '') + '>' + iconContent + '</div>'
      + '<div class="msg-share-body">'
      + '<div class="msg-share-title">' + esc(shareTitle) + '</div>'
      + (shareDesc ? '<div class="msg-share-desc">' + esc(shareDesc) + '</div>' : '');
    // Version badge + status pill for tapp
    if (msgType === 'tapp') {
      html += '<div class="msg-share-meta">';
      if (payload.tapp_version) html += '<span class="msg-share-ver">v' + esc(payload.tapp_version) + '</span>';
      if (local) {
        // Sender: show pending status
        html += '<span class="msg-share-status msg-share-status-pending">' + esc(lang.tappSharePending) + '</span>';
      } else if (tappAcceptStatus === 'accepted') {
        html += '<span class="msg-share-status msg-share-status-accepted">' + esc(lang.tappShareAccepted) + '</span>';
      } else if (tappAcceptStatus === 'rejected') {
        html += '<span class="msg-share-status msg-share-status-rejected">' + esc(lang.tappShareRejected) + '</span>';
      }
      html += '</div>';
    }
    var goPlayable = msgType === 'library' && typeof isPlayableLibraryShare === 'function' && isPlayableLibraryShare(payload);
    html += '</div>'
      + (shareNeedsDecision ? '' : '<span class="msg-share-go" aria-hidden="true">'
        + (goPlayable ? SVG_ICONS.playCircle : SVG_ICONS.chevronRight)
        + '</span>')
      + '</div>';
    // Receiver: accept/reject span the card footer, below the main row
    if (shareNeedsDecision) {
      html += '<div class="msg-share-actions">'
        + '<button type="button" class="msg-share-btn-reject" data-reject-idx="' + idx + '" data-accept-key="' + esc(stKey) + '">' + esc(lang.rejectTapp) + '</button>'
        + '<button type="button" class="msg-share-btn-accept" data-accept-idx="' + idx + '" data-accept-key="' + esc(stKey) + '">' + esc(lang.acceptTapp) + '</button>'
        + '</div>';
    }
    html += '</div>';
    if (payload.text) {
      html += '<div class="msg-text msg-caption">'
        + (msgTextHtml(payload.text, payload))
        + '</div>';
    }
    }
  } else {
    html += '<div class="msg-text">'
      + (msgTextHtml(text, payload))
      + '</div>';
  }

  html += '<div class="msg-footer">' + pinned + '<span class="msg-time" title="' + esc(fullTimeStr(msg.created_at)) + '">' + timeStr(msg.created_at) + '</span></div>'
    + '</div></div>';
  return html;

}


function libraryMediaCardHtml(idx, payload, view) {
  var slug = view.platform || '';
  var logo = platformLogoSvg(slug);
  var accent = logo ? platformAccent(slug) : null;
  var accentStyle = accent ? ';--acc-l:' + accent.l + ';--acc-d:' + accent.d : '';
  var orient = view.itemType === 'music' ? 'square' : mediaCoverOrient(view.itemType);

  // One meta row, gap-spaced (icons delimit — no dots/dividers). Music leads
  // with the artist (and album when it differs from the title); other media
  // show kind · rating · the sender's playtime/watch progress.
  var meta = '';
  if (view.itemType === 'music' && (view.artist || view.album)) {
    if (view.artist) meta += '<span class="msg-media-kind">' + esc(view.artist) + '</span>';
    if (view.album && view.album !== view.title) meta += '<span class="msg-media-sub">' + esc(view.album) + '</span>';
  } else {
    var kindLabel = mediaKindLabel(view.itemType);
    if (kindLabel) meta += '<span class="msg-media-kind">' + esc(kindLabel) + '</span>';
    if (view.ratingText) meta += '<span class="msg-media-rate">' + SVG_ICONS.star + esc(view.ratingText) + '</span>';
    if (view.stat) meta += '<span class="msg-media-stat">' + view.stat.icon + esc(view.stat.text) + '</span>';
  }

  var cover = '<div class="msg-media-cover">'
    + '<img class="msg-media-cover-img" src="' + esc(view.image) + '" alt="" loading="lazy" decoding="async" />'
    + '<span class="msg-media-cover-fallback" aria-hidden="true">' + (logo || SVG_ICONS.library) + '</span>'
    + (logo ? '<span class="msg-media-logo" data-mark="brand" aria-hidden="true">' + logo + '</span>' : '')
    + '</div>';

  var playable = typeof isPlayableLibraryShare === 'function' && isPlayableLibraryShare(payload);
  var extUrl = typeof libraryExternalUrl === 'function' ? libraryExternalUrl(payload) : '';
  return '<div class="msg-media-card" data-type="library" data-orient="' + orient + '"'
    + ' data-msg-idx="' + idx + '"'
    + (payload.platform_id ? ' data-platform-id="' + esc(payload.platform_id) + '"' : '')
    + (payload.item_id ? ' data-item-id="' + esc(String(payload.item_id)) + '"' : '')
    + (payload.item_type || payload.content_type
      ? ' data-item-type="' + esc(String(payload.item_type || payload.content_type)) + '"'
      : '')
    + (payload.artist ? ' data-artist="' + esc(payload.artist) + '"' : '')
    + (payload.album ? ' data-album="' + esc(payload.album) + '"' : '')
    + (extUrl ? ' data-external-url="' + esc(extUrl) + '"' : '')
    + (playable ? ' data-playable="1"' : '')
    + (view.image ? ' data-image="' + esc(view.image) + '"' : '')
    + (accent ? ' data-mark="brand"' : '')
    + ' style="cursor:pointer' + accentStyle + '"'
    + ' title="' + esc(playable
      ? (lang.mediaPlayHint || lang.nowPlaying || 'Play')
      : (lang.openOriginal || 'Open')) + '">'
    + cover
    + '<div class="msg-media-info">'
    + '<div class="msg-media-title">' + esc(view.title) + '</div>'
    + (meta ? '<div class="msg-media-meta">' + meta + '</div>' : '')
    + '</div>'
    + '<span class="msg-media-go" aria-hidden="true">'
    + (playable ? SVG_ICONS.playCircle : SVG_ICONS.chevronRight)
    + '</span>'
    + '</div>';
}

/** Full-screen image viewer for image bubbles. */

