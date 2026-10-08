(function (root, factory) {
  var api = factory(root, root.FootprintEarthCore);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FootprintEarthRuntimeModule = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root, Core) {
  "use strict";

  function NullView() {}
  ["booting", "ready", "render", "status", "error", "history", "members", "toast", "selection", "moderation"].forEach(function (name) {
    NullView.prototype[name] = function () {};
  });

  function unwrapList(value, keys) {
    if (Array.isArray(value)) return value;
    for (var index = 0; index < keys.length; index += 1) if (value && Array.isArray(value[keys[index]])) return value[keys[index]];
    return [];
  }

  function roleMode(role) {
    role = String(role || "guest").toLowerCase();
    if (["owner", "admin", "administrator"].indexOf(role) >= 0) return "admin";
    if (["guest", "anonymous", "visitor"].indexOf(role) >= 0) return "guest";
    return "member";
  }

  function roomOwnerActor(room) {
    if (!room || typeof room !== "object") return "";
    return Core.normalizeActor(room.owner_actor || room.ownerActor || room.owner || room.creator_actor || room.creatorActor || "");
  }

  function memberActor(member) {
    return Core.normalizeActor(member && (member.actor || member.actor_url || member.actorUrl || member.actor_id || member.actorId || member.id || member));
  }

  function makeDefaultOwner() { return { v: 1, countries: [], regions: [] }; }

  function Runtime(options) {
    options = options || {};
    this.tapp = options.tapp || root.Tapp;
    this.view = options.view || new NullView();
    this.mode = "guest";
    this.role = "guest";
    this.actor = "";
    this.roomOwnerActor = "";
    this.isRoomMember = false;
    this.config = null;
    this.owner = makeDefaultOwner();
    this.publicProjection = null;
    this.world = { v: 1, countries: [], regions: [] };
    this.admin1 = { v: 1, countries: [], regions: [] };
    this.dataset = { v: 1, countries: [], regions: [] };
    this.mapIndex = Core.createMapIndex(this.dataset);
    this.events = [];
    this.replay = { submissions: [], audit: [], reports: [], moderators: [], blockedActors: [], stats: {} };
    this.members = [];
    this.historyComplete = false;
    this.unsubscribeMessage = null;
    this.unsubscribeRoomUpdate = null;
    this.unsubscribeShared = null;
    this.subscribedRoomId = "";
    this.destroyed = false;
  }

  Runtime.prototype.hasPermission = function (permission) {
    return Boolean(this.tapp && Array.isArray(this.tapp.permissions) && this.tapp.permissions.indexOf(permission) >= 0);
  };

  Runtime.prototype.safeSharedGet = async function (key) {
    try { return await this.tapp.shared.get(key); }
    catch (_error) { return null; }
  };

  Runtime.prototype.loadMap = async function () {
    var values = await Promise.all([
      this.tapp.assets.getArrayBuffer("assets/world-110m.json"),
      this.tapp.assets.getArrayBuffer("assets/admin1-50m.json")
    ]);
    this.world = Core.loadMapAsset(values[0]);
    this.admin1 = Core.loadMapAsset(values[1]);
    this.dataset = Core.mergeMapAssets(this.world, this.admin1);
    this.mapIndex = Core.createMapIndex(this.dataset);
  };

  Runtime.prototype.loadPublicState = async function () {
    var values = await Promise.all([
      this.safeSharedGet(Core.SHARED_KEYS.config),
      this.safeSharedGet(Core.SHARED_KEYS.owner),
      this.safeSharedGet(Core.SHARED_KEYS.publicProjection)
    ]);
    this.config = values[0] && typeof values[0] === "object" ? values[0] : null;
    var checkedOwner = Core.validateOwnerFootprints(values[1] || makeDefaultOwner(), this.mapIndex);
    this.owner = checkedOwner.ok ? checkedOwner.value : makeDefaultOwner();
    var checkedProjection = Core.validatePublicProjection(values[2], this.mapIndex, this.config && this.config.campaignId);
    this.publicProjection = checkedProjection.ok ? checkedProjection.value : null;
  };

  Runtime.prototype.start = async function () {
    this.view.booting();
    await this.loadMap();
    await this.loadPublicState();
    try { this.role = String(await this.tapp.user.getRole() || "guest").toLowerCase(); } catch (_error) { this.role = "guest"; }
    this.mode = roleMode(this.role);
    if (this.mode === "guest") {
      this.historyComplete = false;
      this.view.render(this.snapshot());
      this.watchShared();
      this.view.ready(this.snapshot());
      return this.snapshot();
    }
    try {
      var identity = await this.tapp.federation.getIdentity();
      this.actor = Core.normalizeActor(identity);
    } catch (_error) { this.actor = ""; }
    if (this.config && this.config.roomId) await this.connectRoom();
    else this.historyComplete = false;
    this.watchShared();
    this.view.render(this.snapshot());
    this.view.ready(this.snapshot());
    return this.snapshot();
  };

  Runtime.prototype.connectRoom = async function () {
    if (!this.hasPermission("federation:read")) { this.historyComplete = false; return; }
    try {
      var room = await this.tapp.federation.getRoom(this.config.roomId);
      this.roomOwnerActor = roomOwnerActor(room);
      var membersLoaded = false;
      try {
        var memberResult = await this.tapp.federation.getRoomMembers(this.config.roomId);
        this.members = unwrapList(memberResult, ["members", "items"]);
        membersLoaded = true;
      } catch (_error) { this.members = []; }
      this.isRoomMember = Boolean(this.actor && (this.actor === this.roomOwnerActor || membersLoaded && this.members.some(function (member) { return memberActor(member) === this.actor; }, this)));
      if (this.subscribedRoomId && (this.subscribedRoomId !== this.config.roomId || !this.isRoomMember) && typeof this.tapp.federation.unsubscribeRoom === "function") {
        try { await this.tapp.federation.unsubscribeRoom(this.subscribedRoomId); } catch (_error) {}
        this.subscribedRoomId = "";
      }
      if (!this.isRoomMember) {
        this.events = [];
        this.historyComplete = false;
        this.applyReplay();
        return;
      }
      this.watchRoom();
      if (this.subscribedRoomId !== this.config.roomId && typeof this.tapp.federation.subscribeRoom === "function") {
        await this.tapp.federation.subscribeRoom(this.config.roomId);
        this.subscribedRoomId = this.config.roomId;
      }
      await this.loadHistory();
    } catch (error) {
      this.isRoomMember = false;
      this.historyComplete = false;
      this.view.error(error);
    }
  };

  Runtime.prototype.loadHistory = async function () {
    var before;
    var seen = new Set();
    var messages = [];
    var reachedEnd = false;
    this.events = [];
    this.historyComplete = false;
    try {
      for (var page = 0; page < Core.LIMITS.maxHistoryPages; page += 1) {
        var response = await this.tapp.federation.getRoomMessages(this.config.roomId, before, Core.LIMITS.historyPageSize);
        var batch = unwrapList(response, ["messages", "items"]);
        if (!batch.length) { reachedEnd = true; break; }
        batch.forEach(function (message) {
          var decoded = Core.decodeEnvelope(message);
          var id = decoded && decoded.messageId;
          if (!id || seen.has(id)) return;
          seen.add(id);
          messages.push(message);
        });
        if (batch.length < Core.LIMITS.historyPageSize) { reachedEnd = true; break; }
        var first = batch[0] || {};
        var nextBefore = response && (response.next_cursor || response.nextCursor || response.before) || first.message_id || first.messageId || first.id;
        if (!nextBefore || nextBefore === before) break;
        before = nextBefore;
      }
      var live = this.events.slice();
      live.forEach(function (message) {
        var decoded = Core.decodeEnvelope(message); var id = decoded && decoded.messageId;
        if (id && !seen.has(id)) { seen.add(id); messages.push(message); }
      });
      this.events = messages;
      this.historyComplete = reachedEnd && seen.size < Core.LIMITS.maxHistoryMessages;
    } catch (error) {
      this.events = messages.concat(this.events);
      this.historyComplete = false;
      this.view.error(error);
    }
    this.applyReplay();
    this.view.history({ complete: this.historyComplete, events: this.events.length, stats: this.replay.stats });
  };

  Runtime.prototype.applyReplay = function () {
    this.replay = Core.replayEvents(this.events, {
      campaignId: this.config && this.config.campaignId,
      ownerActor: this.roomOwnerActor,
      mapIndex: this.mapIndex,
      maxPerActor: this.config && this.config.limits && this.config.limits.perActor,
      cooldownMs: Number(this.config && this.config.limits && this.config.limits.cooldownSeconds || 60) * 1000,
      historyTruncated: !this.historyComplete
    });
    this.view.render(this.snapshot());
  };

  Runtime.prototype.canModerate = function () {
    return Boolean(this.actor && (this.actor === this.roomOwnerActor || (this.replay.moderators || []).indexOf(this.actor) >= 0));
  };

  Runtime.prototype.snapshot = function () {
    return {
      mode: this.mode,
      role: this.role,
      actor: this.actor,
      roomOwnerActor: this.roomOwnerActor,
      isRoomMember: this.isRoomMember,
      canModerate: this.canModerate(),
      historyComplete: this.historyComplete,
      config: this.config,
      owner: this.owner,
      publicProjection: this.publicProjection,
      dataset: this.dataset,
      mapIndex: this.mapIndex,
      replay: this.replay,
      members: this.members.slice(),
      markers: this.buildMarkers()
    };
  };

  Runtime.prototype.buildMarkers = function () {
    var self = this;
    var markers = [];
    (this.owner.countries || []).concat(this.owner.regions || []).forEach(function (item) {
      var point = Core.representativePoint(self.mapIndex, item.code);
      if (point) markers.push({ code: item.code, countryCode: item.countryCode || item.code, kind: item.status, point: point });
    });
    var projection = this.publicProjection;
    if (!projection || this.config && projection.campaignId !== this.config.campaignId) return markers;
    (projection.countries || []).concat(projection.regions || []).forEach(function (item) {
      var point = Core.representativePoint(self.mapIndex, item.code);
      if (point) markers.push({ code: item.code, countryCode: item.countryCode || item.code, kind: "visitor", countBucket: item.countBucket, point: point });
    });
    return markers;
  };

  Runtime.prototype.saveOwner = async function (nextValue) {
    if (this.mode !== "admin" || !this.hasPermission("storage:write")) throw new Error("shared_write_forbidden");
    var checked = Core.validateOwnerFootprints(nextValue, this.mapIndex);
    if (!checked.ok) throw new Error(checked.errors.join(","));
    await this.tapp.shared.set(Core.SHARED_KEYS.owner, checked.value);
    this.owner = checked.value;
    this.view.render(this.snapshot());
    return checked.value;
  };

  Runtime.prototype.publishProjection = async function () {
    if (this.mode !== "admin" || !this.hasPermission("storage:write")) throw new Error("shared_write_forbidden");
    if (!this.historyComplete) throw new Error("history_incomplete");
    if (!this.config || !this.config.campaignId) throw new Error("campaign_missing");
    var projection = Core.buildPublicProjection(this.replay, {
      campaignId: this.config.campaignId,
      minK: this.config.privacy && this.config.privacy.minK,
      publishedDate: new Date().toISOString().slice(0, 10)
    });
    if (Core.byteLength(projection) > 1024 * 1024) throw new Error("projection_too_large");
    await this.tapp.shared.set(Core.SHARED_KEYS.publicProjection, projection);
    this.publicProjection = projection;
    this.view.render(this.snapshot());
    return projection;
  };

  Runtime.prototype.send = function (payload) {
    if (!this.config || !this.isRoomMember || !this.hasPermission("federation:message")) return Promise.reject(new Error("room_write_forbidden"));
    return this.tapp.federation.sendRoomMessage(this.config.roomId, { message_type: Core.LIMITS.messageType, payload: payload });
  };

  Runtime.prototype.submit = function (countryCode, regionCode) {
    var payload = Core.makeEvent(Core.KINDS.submission, this.config && this.config.campaignId, {
      countryCode: countryCode,
      status: "visitor"
    });
    if (regionCode) payload.regionCode = regionCode;
    var checked = Core.validateSubmission(payload, this.mapIndex, this.config && this.config.campaignId);
    if (!checked.ok) return Promise.reject(new Error(checked.errors.join(",")));
    return this.send(checked.value);
  };

  Runtime.prototype.sendGovernance = function (kind, fields) {
    var moderatorChange = kind === Core.KINDS.moderatorGrant || kind === Core.KINDS.moderatorRevoke;
    if (moderatorChange && this.actor !== this.roomOwnerActor) return Promise.reject(new Error("room_owner_required"));
    if (!moderatorChange && !this.canModerate()) return Promise.reject(new Error("governance_forbidden"));
    return this.send(Core.makeEvent(kind, this.config && this.config.campaignId, fields || {}));
  };

  Runtime.prototype.report = function (targetMessageId, reason) {
    return this.send(Core.makeEvent(Core.KINDS.report, this.config && this.config.campaignId, { targetMessageId: String(targetMessageId || ""), reason: reason || "other" }));
  };

  Runtime.prototype.removeMember = async function (actor) {
    if (!this.canModerate() || !this.hasPermission("federation:room") || !this.tapp.federation.removeMember) throw new Error("member_remove_forbidden");
    return this.tapp.federation.removeMember(this.config.roomId, { actor: Core.normalizeActor(actor) });
  };

  Runtime.prototype.joinCampaign = async function () {
    if (this.mode === "guest" || !this.config || !this.config.roomId || !this.hasPermission("federation:room") || !this.tapp.federation.joinRoom) throw new Error("room_join_forbidden");
    await this.tapp.federation.joinRoom(this.config.roomId);
    await this.connectRoom();
    this.view.render(this.snapshot());
    this.view.ready(this.snapshot());
    if (!this.isRoomMember) throw new Error("room_join_unconfirmed");
    return this.snapshot();
  };

  Runtime.prototype.refresh = async function () {
    if (this.mode === "guest") { await this.loadPublicState(); this.view.render(this.snapshot()); return; }
    if (this.config && this.config.roomId) await this.connectRoom();
    this.view.render(this.snapshot());
  };

  Runtime.prototype.createCampaign = async function () {
    if (this.mode !== "admin" || !this.hasPermission("federation:room") || !this.hasPermission("storage:write")) throw new Error("campaign_create_forbidden");
    var room = await this.tapp.federation.createRoom({
      name: "足迹地球 · " + new Date().toLocaleDateString(),
      description: "cn.echootaku.footprint-earth code-only footprint event log",
      is_public: true,
      invite_policy: "open"
    });
    var roomId = String(room && (room.id || room.room_id || room.roomId) || "");
    if (!roomId) throw new Error("room_id_missing");
    var campaignId = Core.makeNonce("campaign");
    var config = {
      v: 1,
      campaignId: campaignId,
      roomId: roomId,
      mapDataVersion: "natural-earth-ca96624a56bd078437bca8184e78163e5039ad19",
      privacy: { minK: 3, countBuckets: [3, 5, 10, 25, 50] },
      limits: { perActor: 8, cooldownSeconds: 60, replayMessages: 2000 },
      createdDate: new Date().toISOString().slice(0, 10)
    };
    await this.tapp.shared.set(Core.SHARED_KEYS.config, config);
    await this.tapp.shared.set(Core.SHARED_KEYS.publicProjection, null);
    this.config = config;
    this.publicProjection = null;
    await this.connectRoom();
    return config;
  };

  Runtime.prototype.watchRoom = function () {
    var self = this;
    if (typeof this.unsubscribeMessage === "function") this.unsubscribeMessage();
    if (typeof this.unsubscribeRoomUpdate === "function") this.unsubscribeRoomUpdate();
    if (this.tapp.federation && typeof this.tapp.federation.onMessage === "function") {
      this.unsubscribeMessage = this.tapp.federation.onMessage(function (message) {
        var decoded = Core.decodeEnvelope(message);
        if (!decoded || self.config && decoded.roomId && decoded.roomId !== self.config.roomId) return;
        if (self.events.some(function (existing) { var prior = Core.decodeEnvelope(existing); return prior && prior.messageId === decoded.messageId; })) return;
        self.events.push(message);
        self.applyReplay();
      });
    }
    if (this.tapp.federation && typeof this.tapp.federation.onRoomUpdate === "function") {
      this.unsubscribeRoomUpdate = this.tapp.federation.onRoomUpdate(function (event) {
        var roomId = event && (event.roomId || event.room_id);
        if (!roomId || !self.config || roomId === self.config.roomId) self.view.status(event);
      });
    }
  };

  Runtime.prototype.watchShared = function () {
    var self = this;
    if (typeof this.unsubscribeShared === "function") this.unsubscribeShared();
    if (this.tapp.shared && typeof this.tapp.shared.onChanged === "function") {
      this.unsubscribeShared = this.tapp.shared.onChanged(function (event) {
        if (!event || !event.key || [Core.SHARED_KEYS.owner, Core.SHARED_KEYS.publicProjection, Core.SHARED_KEYS.config].indexOf(event.key) >= 0) {
          self.loadPublicState().then(function () { if (!self.destroyed) self.view.render(self.snapshot()); }).catch(function (error) { if (!self.destroyed) self.view.error(error); });
        }
      });
    }
  };

  Runtime.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;
    [this.unsubscribeMessage, this.unsubscribeRoomUpdate, this.unsubscribeShared].forEach(function (unsubscribe) { if (typeof unsubscribe === "function") unsubscribe(); });
    this.unsubscribeMessage = this.unsubscribeRoomUpdate = this.unsubscribeShared = null;
    if (this.subscribedRoomId && this.tapp.federation && typeof this.tapp.federation.unsubscribeRoom === "function") {
      try { Promise.resolve(this.tapp.federation.unsubscribeRoom(this.subscribedRoomId)).catch(function () {}); } catch (_error) {}
    }
    this.subscribedRoomId = "";
  };

  return Object.freeze({ Runtime: Runtime, NullView: NullView, roleMode: roleMode, roomOwnerActor: roomOwnerActor });
});
