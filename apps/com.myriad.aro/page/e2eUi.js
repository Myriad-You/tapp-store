var share = require('./scope.js');

// ==================== E2E status / key exchange UI ====================
// Extracted from api.js. Depends on helpers (isE2e*), federation SDK, state.
// Load before api.js (call-time deps on poll/render ok).

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
      // Room multi-recipient: encrypt only when ≥2 public keys are published
      // (self + at least one peer). Keys come from getRoom.shared_data_config.
      var rd = state.roomDetail || {};
      var shared = rd.shared_data_config || rd.sharedDataConfig || {};
      var re2e = (shared.e2e || {});
      var keys = re2e.published_keys || re2e.publishedKeys || {};
      var n = 0;
      var hasLocalKey = false;
      if (keys && typeof keys === 'object') {
        for (var k in keys) {
          if (Object.prototype.hasOwnProperty.call(keys, k) && keys[k]) {
            n++;
            if (state.localActorUrl && typeof sameActorUrl === 'function'
              ? sameActorUrl(k, state.localActorUrl)
              : (state.localActorUrl && k === state.localActorUrl)) {
              hasLocalKey = true;
            }
            if (k === '__local__') hasLocalKey = true;
          }
        }
      }
      // Established: ≥2 published keys, and (if we know local actor) our key is among them.
      // Solo room stays waiting until a peer publishes.
      if (n >= 2 && (hasLocalKey || !state.localActorUrl)) {
        return {
          status: 'established',
          label: lang.e2eEstablished || 'End-to-end encryption active',
          peerCount: n,
        };
      }
      if (n >= 1) {
        return {
          status: 'waiting',
          label: hasLocalKey
            ? (lang.e2eLocalOnly || lang.e2eWaitingPeer || 'Waiting for peer encryption key')
            : (lang.e2eWaitingPeer || 'Waiting for peer encryption key'),
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
    // Optimistic patch if getRoom still omits shared_data_config (older hosts).
    // Prefer getRoom's published_keys when present; only seed self-key when map empty.
    if (state.roomDetail && res && (res.public_key || (res.data && res.data.public_key))) {
      var pk = res.public_key || res.data.public_key;
      var sdc = state.roomDetail.shared_data_config || {};
      var e2eObj = sdc.e2e || {};
      var pkeys = e2eObj.published_keys || e2eObj.publishedKeys || {};
      var keyCount = 0;
      if (pkeys && typeof pkeys === 'object') {
        for (var pkK in pkeys) {
          if (Object.prototype.hasOwnProperty.call(pkeys, pkK) && pkeys[pkK]) keyCount++;
        }
      }
      if (keyCount === 0 && pk) {
        // Use a stable placeholder only when we have no actor URL yet — never
        // invent a second key entry that could false-trigger "established".
        var selfKey = state.localActorUrl || '__local__';
        pkeys[selfKey] = pk;
      }
      e2eObj.published_keys = pkeys;
      sdc.e2e = e2eObj;
      state.roomDetail.shared_data_config = sdc;
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


// ==================== Shared scope ====================
// Republish the names this file's siblings read. See page/scope.js.
share.value({
  doRoomE2eExchange: doRoomE2eExchange,
  e2eStatusBadgeHtml: e2eStatusBadgeHtml,
  getE2eStatusForActive: getE2eStatusForActive,
  isE2eReadyForActive: isE2eReadyForActive,
  maybeAnnounceE2eEstablished: maybeAnnounceE2eEstablished,
  maybePublishE2eKeys: maybePublishE2eKeys,
  renderE2eReadyBanner: renderE2eReadyBanner,
});
