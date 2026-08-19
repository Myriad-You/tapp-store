/**
 * Aro core / headless entry (`manifest.core.entry`).
 *
 * Full messenger UI lives exclusively in the declared Page layer (`page/*`).
 * This file intentionally stays thin for backgroundRequirements: notification —
 * poll federated channels/rooms and raise host notifications when the page
 * is not open. Do not paste page UI helpers back into this file (ARO-13).
 */
(function () {
  'use strict';

  var pollTimer = null;
  var pollIntervalMs = 15000;
  var notifyOnMessage = true;
  var lastSeen = {
    /** @type {Record<string, string>} channel_id -> last message_id */
    // Null-prototype: keys are peer-controlled message/conversation ids, so a
    // literal `constructor` / `toString` would otherwise read back a truthy
    // inherited value and suppress a real notification.
    channels: Object.create(null),
    /** @type {Record<string, string>} room_id -> last message_id */
    rooms: Object.create(null),
  };
  var primed = false;
  /** Local actor URL, so we do not notify the user about their own messages. */
  var localActorUrl = '';
  /** Guards against overlapping ticks when a poll outlives the interval. */
  var ticking = false;

  /** Compare actor URLs ignoring trailing slash / host case (mirrors backend). */
  function sameActor(a, b) {
    if (!a || !b) return false;
    var norm = function (u) {
      return String(u).trim().replace(/\/+$/, '').toLowerCase();
    };
    return norm(a) === norm(b);
  }

  /** True when a polled message was sent by this user (any device). */
  function isOwnMessage(msg) {
    return !!(msg && localActorUrl && sameActor(msg.sender_actor, localActorUrl));
  }

  function stopBackgroundPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function previewText(msg) {
    if (!msg) return 'New message';
    var mt = msg.message_type || 'text';
    var p = msg.payload && typeof msg.payload === 'object' ? msg.payload : {};
    if (mt === 'image') return 'Image';
    if (mt === 'file' || mt === 'file-meta') return p.filename || 'File';
    if (mt === 'tapp') return p.tapp_name || p.title || 'Tapp share';
    if (mt === 'brew') return p.title || 'Brew';
    if (mt === 'library') return p.title || 'Library';
    if (mt === 'report') return p.summary || p.title || 'Report';
    var t = p.text || p.body || '';
    t = String(t);
    return t.length > 80 ? t.slice(0, 79) + '…' : t || 'New message';
  }

  function notify(title, message) {
    if (!notifyOnMessage) return;
    try {
      Tapp.ui.showNotification({
        title: title || 'Aro',
        message: message || '',
        type: 'info',
      });
    } catch (e) { /* ignore */ }
  }

  async function loadSettings() {
    try {
      var settings = await Tapp.settings.getAll();
      if (settings && settings.pollInterval) {
        pollIntervalMs = Math.max(5, Math.min(120, Number(settings.pollInterval) || 15)) * 1000;
      }
      if (settings && typeof settings.notifyOnMessage !== 'undefined') {
        notifyOnMessage = !!settings.notifyOnMessage;
      }
    } catch (e) { /* ignore */ }
  }

  /** Resolve this instance's actor URL once so self-sent messages stay silent. */
  async function loadIdentity() {
    try {
      if (!Tapp.federation || typeof Tapp.federation.getIdentity !== 'function') return;
      var identity = await Tapp.federation.getIdentity();
      localActorUrl = (identity && identity.actor_url) || '';
    } catch (e) { /* notifications still work, just without self-filtering */ }
  }

  async function scanChannels() {
    if (!Tapp.federation || typeof Tapp.federation.getChannels !== 'function') return;
    var list = await Tapp.federation.getChannels();
    var channels = (list && (list.channels || list.items || list)) || [];
    if (!Array.isArray(channels)) return;
    for (var i = 0; i < channels.length; i++) {
      var ch = channels[i];
      var id = ch.channel_id || ch.id;
      if (!id) continue;
      if (typeof Tapp.federation.getMessages !== 'function') continue;
      try {
        var res = await Tapp.federation.getMessages(id, undefined, 5);
        var msgs = (res && res.messages) || [];
        if (!msgs.length) continue;
        var last = msgs[msgs.length - 1];
        var mid = last.message_id || last.id || '';
        var prev = lastSeen.channels[id];
        if (primed && prev && mid && mid !== prev && !isOwnMessage(last)) {
          var title = ch.remote_actor_name
            || (ch.remote_actor_url || '').split('/').pop()
            || 'Direct message';
          notify(title, previewText(last));
        }
        if (mid) lastSeen.channels[id] = mid;
      } catch (eCh) { /* ignore per-channel */ }
    }
  }

  async function scanRooms() {
    if (!Tapp.federation || typeof Tapp.federation.getRooms !== 'function') return;
    var list = await Tapp.federation.getRooms();
    var rooms = (list && (list.rooms || list.items || list)) || [];
    if (!Array.isArray(rooms)) return;
    for (var i = 0; i < rooms.length; i++) {
      var rm = rooms[i];
      var id = rm.room_id || rm.id;
      if (!id) continue;
      if (typeof Tapp.federation.getRoomMessages !== 'function') continue;
      try {
        var res = await Tapp.federation.getRoomMessages(id, undefined, 5);
        var msgs = (res && res.messages) || [];
        if (!msgs.length) continue;
        var last = msgs[msgs.length - 1];
        var mid = last.message_id || last.id || '';
        var prev = lastSeen.rooms[id];
        if (primed && prev && mid && mid !== prev && !isOwnMessage(last)) {
          notify(rm.name || 'Group', previewText(last));
        }
        if (mid) lastSeen.rooms[id] = mid;
      } catch (eRm) { /* ignore */ }
    }
  }

  async function tick() {
    // setInterval does not await an async callback: a poll slower than the
    // interval used to stack up, multiplying requests and racing lastSeen.
    if (ticking) return;
    ticking = true;
    try {
      await scanChannels();
      await scanRooms();
      primed = true;
    } catch (e) {
      console.warn('[Aro background] poll failed', e);
    } finally {
      ticking = false;
    }
  }

  function startBackgroundPoll() {
    stopBackgroundPoll();
    tick();
    pollTimer = setInterval(tick, pollIntervalMs);
  }

  /**
   * Background scanning only makes sense for a signed-in user: channels and
   * rooms are per-user, so an anonymous visitor can only ever get 401s —
   * once every pollInterval, on every page, forever.
   *
   * Unknown/unsupported SDK → keep polling (fail-open), so this can never
   * silence notifications for a real user on an older host.
   */
  async function shouldPoll() {
    if (!Tapp.user || typeof Tapp.user.isLoggedIn !== 'function') return true;
    try {
      return !!(await Tapp.user.isLoggedIn());
    } catch (e) {
      return true;
    }
  }

  // Page mode uses its declared entry — do not boot UI from core.
  // Headless / background: poll only.
  Tapp.lifecycle.onReady(async function () {
    var mode = window._TAPP_MODE || '';
    var hasHtml = !!window._TAPP_HAS_HTML;
    if (mode === 'page' || hasHtml) {
      // Page sandbox loads the Page entry; core stays idle for UI.
      return;
    }
    // Signed-out check first: loadIdentity() calls getIdentity(), which is
    // exactly the per-user 401 an anonymous visitor must not be issued.
    if (!(await shouldPoll())) return;
    Promise.all([loadSettings(), loadIdentity()]).then(function () {
      startBackgroundPoll();
    });
  });

  Tapp.lifecycle.onDestroy(function () {
    stopBackgroundPoll();
  });
})();
