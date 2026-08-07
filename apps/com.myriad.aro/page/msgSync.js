// ==================== Message sync (fingerprint / merge / optimistic) ====================
// Extracted from api.js. Depends on: helpers (isE2e*), state, chat (render/schedule).
// Load after helpers + msgUi/chat symbols used only at call time.

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
  // Include a slice of last payload so ciphertext→plaintext decrypt refreshes UI
  // even when message_id/count stay the same (WS envelope vs GET decrypt race).
  var lastBody = '';
  try {
    var lp = last.payload;
    if (typeof lp === 'string') lastBody = lp.slice(0, 48);
    else if (lp && typeof lp === 'object') {
      lastBody = (lp.text || lp.ciphertext || lp.title || lp.filename || JSON.stringify(lp)).toString().slice(0, 48);
    }
  } catch (eFp) { /* ignore */ }
  return msgs.length + '|' + (last.message_id || '') + '|' + (last.created_at || '') + '|' + pins + '|' + ids.join(',') + '|' + lastBody;
}

/**
 * Prefer decrypted/plain payloads over WS ciphertext envelopes.
 * Host WS often echoes storage form {algorithm,ciphertext,...} while GET history
 * returns decrypted JSON — a late WS event must not clobber good plaintext.
 * Also: poll must not replace a good plain bubble with a failed-decrypt ciphertext.
 */
function preferDisplayPayload(existingMsg, incomingMsg) {
  var out = Object.assign({}, existingMsg || {}, incomingMsg || {});
  var oldP = existingMsg && existingMsg.payload;
  var newP = incomingMsg && incomingMsg.payload;
  var oldEnc = typeof isE2eCiphertextEnvelope === 'function' && isE2eCiphertextEnvelope(oldP);
  var newEnc = typeof isE2eCiphertextEnvelope === 'function' && isE2eCiphertextEnvelope(newP);
  if (newEnc && oldP && !oldEnc) {
    out.payload = oldP;
    // Keep display flags consistent with retained plaintext
    if (existingMsg && existingMsg.is_encrypted === false) out.is_encrypted = false;
  } else if (oldEnc && newP && !newEnc) {
    out.payload = newP;
    out.is_encrypted = false;
  } else if (!newEnc && newP) {
    // Incoming is plain — clear stale encrypted flag from storage shape
    if (out.is_encrypted && !isE2eCiphertextEnvelope(out.payload)) {
      out.is_encrypted = false;
    }
  }
  return out;
}

/**
 * Live-window page size (open + poll). Older history is loaded via before= pages.
 * Kept modest so open/poll stay snappy; load-older preserves prior messages.
 */
var MSG_WINDOW_LIMIT = 50;

/** Merge server/WS lists without letting ciphertext stomp known-good plaintext.
 *  Also preserves older pages (loaded via before=) and optimistic local bubbles
 *  that are not present in the latest tail window.
 */
function mergeMessageLists(prev, next) {
  prev = Array.isArray(prev) ? prev : [];
  next = Array.isArray(next) ? next : [];
  if (!next.length) return prev.slice(); // empty poll must not wipe history
  if (!prev.length) return next.slice();

  // Null-prototype maps: message_id comes off the wire (a peer sets
  // `object.messageId` verbatim). With a plain object a message id of
  // `constructor` / `toString` reads back a truthy inherited value, so the
  // prior copy gets treated as "already in next" and silently dropped.
  var byId = Object.create(null);
  for (var i = 0; i < prev.length; i++) {
    var p = prev[i];
    if (p && p.message_id) byId[p.message_id] = p;
  }
  var nextIds = Object.create(null);
  for (var j0 = 0; j0 < next.length; j0++) {
    if (next[j0] && next[j0].message_id) nextIds[next[j0].message_id] = true;
  }

  // Tail window bounds — keep history below and WS-ahead rows above the poll page.
  var oldestNext = next[0];
  var newestNext = next[next.length - 1];
  var oldestTs = oldestNext && oldestNext.created_at ? String(oldestNext.created_at) : '';
  var newestTs = newestNext && newestNext.created_at ? String(newestNext.created_at) : '';

  var out = [];
  // 1) Keep prior messages not in next: older history, optimistic, or newer-than-poll (WS race)
  for (var pi = 0; pi < prev.length; pi++) {
    var pm = prev[pi];
    if (!pm || !pm.message_id) continue;
    if (nextIds[pm.message_id]) continue;
    if (pm._optimistic) {
      out.push(pm);
      continue;
    }
    var pts = pm.created_at ? String(pm.created_at) : '';
    if (oldestTs && pts && pts < oldestTs) {
      out.push(pm);
      continue;
    }
    if (newestTs && pts && pts > newestTs) {
      out.push(pm);
      continue;
    }
    // Same-window id missing from poll: keep if still looking "pending" (no created_at)
    if (!pts) out.push(pm);
  }
  // 2) Append/update tail from server window
  for (var j = 0; j < next.length; j++) {
    var n = next[j];
    if (!n) continue;
    var old = n.message_id ? byId[n.message_id] : null;
    out.push(old ? preferDisplayPayload(old, n) : n);
  }
  // Stable ASC by created_at then message_id
  out.sort(function (a, b) {
    var ca = String((a && a.created_at) || '');
    var cb = String((b && b.created_at) || '');
    if (ca !== cb) return ca < cb ? -1 : 1;
    return String((a && a.message_id) || '').localeCompare(String((b && b.message_id) || ''));
  });
  return out;
}

/** Drop optimistic bubbles once real server copies (or send failure) settle. */
function pruneOptimisticMessages(opts) {
  opts = opts || {};
  if (!state.messages || !state.messages.length) return false;
  var before = state.messages.length;
  if (opts.all) {
    state.messages = state.messages.filter(function (m) { return !m || !m._optimistic; });
  } else if (opts.id) {
    state.messages = state.messages.filter(function (m) {
      return !m || m.message_id !== opts.id;
    });
  } else {
    // Match optimistic text OR light media filename+size against confirmed local messages
    var localKeys = Object.create(null);
    state.messages.forEach(function (m) {
      if (!m || m._optimistic) return;
      if (typeof isLocalActor === 'function' && !isLocalActor(m.sender_actor)) return;
      var t = typeof getPayloadText === 'function' ? getPayloadText(m.payload) : '';
      if (t) localKeys['t:' + t] = true;
      var p = m.payload && typeof m.payload === 'object' ? m.payload : {};
      if (p.filename) localKeys['f:' + p.filename + ':' + (p.size || '')] = true;
      if (p.data && typeof p.data === 'string' && p.data.length < 80) {
        localKeys['d:' + p.data.slice(0, 48)] = true;
      }
    });
    state.messages = state.messages.filter(function (m) {
      if (!m || !m._optimistic) return true;
      var t = typeof getPayloadText === 'function' ? getPayloadText(m.payload) : '';
      if (t && localKeys['t:' + t]) return false;
      var p = m.payload && typeof m.payload === 'object' ? m.payload : {};
      if (p.filename && localKeys['f:' + p.filename + ':' + (p.size || '')]) return false;
      // Stale optimistic > 60s
      try {
        if (m.created_at && (Date.now() - new Date(m.created_at).getTime()) > 60000) return false;
      } catch (eAge) { /* keep */ }
      return true;
    });
  }
  if (state.messages.length !== before) {
    state.messagesFp = messagesFingerprint(state.messages);
    return true;
  }
  return false;
}

function pushOptimisticMessage(msgType, payload, opts) {
  opts = opts || {};
  var id = 'opt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  var msg = {
    message_id: id,
    sender_actor: state.localActorUrl || '',
    message_type: msgType || 'text',
    payload: payload || {},
    reply_to: opts.replyTo || null,
    is_encrypted: !!opts.encrypt,
    is_pinned: false,
    created_at: new Date().toISOString(),
    _optimistic: true,
  };
  if (!state.messages) state.messages = [];
  state.messages.push(msg);
  state.messagesFp = messagesFingerprint(state.messages);
  if (typeof renderMessages === 'function') {
    renderMessages({ animateNew: true, newCount: 1, stickBottom: true });
  }
  return id;
}

var _decryptRefreshTimers = [];
var _decryptRefreshAttempts = 0;
function scheduleDecryptRefresh() {
  // Burst retries: keys may land a moment after the first ciphertext WS event.
  if (_decryptRefreshAttempts > 6) return;
  _decryptRefreshAttempts += 1;
  var delays = [100, 400, 1000, 2200];
  delays.forEach(function (ms) {
    var t = setTimeout(function () {
      if (typeof pollMessages === 'function') {
        pollMessages(true).catch(function () {});
      }
      // Reset attempt budget once we have no ciphertext left
      if (typeof state !== 'undefined' && Array.isArray(state.messages)) {
        var still = false;
        for (var i = 0; i < state.messages.length; i++) {
          if (typeof isE2eCiphertextEnvelope === 'function'
            && isE2eCiphertextEnvelope(state.messages[i].payload)) {
            still = true;
            break;
          }
        }
        if (!still) _decryptRefreshAttempts = 0;
      }
    }, ms);
    _decryptRefreshTimers.push(t);
  });
  // Cap timer list
  if (_decryptRefreshTimers.length > 16) {
    _decryptRefreshTimers.splice(0, _decryptRefreshTimers.length - 16).forEach(function (id) {
      try { clearTimeout(id); } catch (e) { /* ignore */ }
    });
  }
}

/** Would these two copies of a row paint the same bubble? */
function sameRenderedMessage(a, b) {
  if (!a || !b) return false;
  if ((a.message_type || '') !== (b.message_type || '')) return false;
  if (!!a.is_pinned !== !!b.is_pinned) return false;
  if ((a.reply_to || '') !== (b.reply_to || '')) return false;
  if (!!a.is_encrypted !== !!b.is_encrypted) return false;
  if ((a.sender_actor || '') !== (b.sender_actor || '')) return false;
  try {
    return JSON.stringify(a.payload) === JSON.stringify(b.payload);
  } catch (e) {
    return false;
  }
}

function mergeIncomingMessage(msg) {
  if (!msg || !msg.message_id) return false;
  // Realtime can race a conversation switch; never mutate without an active chat.
  if (!state.activeId || !state.activeKind) return false;
  var needsDecryptRefresh = typeof isE2eCiphertextEnvelope === 'function'
    && isE2eCiphertextEnvelope(msg.payload);
  for (var i = 0; i < state.messages.length; i++) {
    if (state.messages[i].message_id === msg.message_id) {
      var prevRow = state.messages[i];
      var merged = preferDisplayPayload(prevRow, msg);
      // If we still only have ciphertext, keep UI placeholder until poll decrypts
      if (typeof isE2eCiphertextEnvelope === 'function'
        && isE2eCiphertextEnvelope(merged.payload)) {
        needsDecryptRefresh = true;
      }
      state.messages[i] = merged;
      state.messagesFp = messagesFingerprint(state.messages);
      // The WS echo of a row we already display verbatim is the common case
      // (notably right after our own send). Repainting it rebuilds the whole
      // transcript's innerHTML and re-decodes every image for no visible change.
      if (!sameRenderedMessage(prevRow, merged)) {
        if (typeof scheduleRenderMessages === 'function') scheduleRenderMessages({ forceFull: true });
        else renderMessages({ forceFull: true });
      }
      if (needsDecryptRefresh) scheduleDecryptRefresh();
      return true;
    }
  }
  state.messages.push(msg);
  state.messagesFp = messagesFingerprint(state.messages);
  if (typeof scheduleRenderMessages === 'function') {
    scheduleRenderMessages({ animateNew: true, newCount: 1 });
  } else {
    renderMessages({ animateNew: true, newCount: 1 });
  }
  if (needsDecryptRefresh) scheduleDecryptRefresh();
  return true;
}

