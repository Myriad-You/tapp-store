(function (root) {
  "use strict";

  var Core = root.SignatureBoardCore;

  function query(selector) { return document.querySelector(selector); }
  function queryAll(selector) { return Array.from(document.querySelectorAll(selector)); }
  function openDialog(dialog) {
    queryAll(".app-dialog").forEach(function (item) { item.hidden = item !== dialog; });
    dialog.hidden = false;
    var focusTarget = dialog.querySelector("button, input, select");
    if (focusTarget) focusTarget.focus();
  }
  function closeDialog(dialog) { if (dialog) dialog.hidden = true; }
  function canvasDimensions(config) {
    if (config && config.canvas && Number(config.canvas.width) > 0 && Number(config.canvas.height) > 0) {
      return { width: Number(config.canvas.width), height: Number(config.canvas.height) };
    }
    return { width: Core.LIMITS.legacyCanvasSize, height: Core.LIMITS.legacyCanvasSize };
  }
  function archiveSnapshotKey(boardId) { return Core.SHARED_KEYS.archiveSnapshotPrefix + String(boardId || ""); }
  function unwrapList(value, keys) {
    if (Array.isArray(value)) return value;
    for (var index = 0; index < keys.length; index += 1) if (value && Array.isArray(value[keys[index]])) return value[keys[index]];
    return [];
  }
  function setText(selector, value) {
    var element = query(selector);
    if (element) element.textContent = value == null ? "—" : String(value);
  }
  function formatDate(value) {
    if (!value) return "—";
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }
  function memberActor(member) {
    if (!member) return "";
    return Core.normalizeActor(member.actor || member.actor_url || member.actorUrl || member.actor_id || member.actorId || member.id || member);
  }
  function formatBytes(value) {
    var bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KiB";
    return (bytes / 1024 / 1024).toFixed(2) + " MiB";
  }

  function Runtime() {
    this.tapp = root.Tapp;
    this.app = query(".signature-app");
    this.editor = new root.SignatureBoardEditor({
      canvas: query("[data-board-canvas]"),
      minimap: query("[data-minimap]"),
      onChange: this.updateDraft.bind(this),
      onViewChange: this.updateZoom.bind(this),
      onSelect: this.openDrawing.bind(this)
    });
    this.identity = {};
    this.actor = "";
    this.role = "guest";
    this.isAdmin = false;
    this.isMember = false;
    this.config = null;
    this.blocklist = [];
    this.events = [];
    this.replay = { drawings: [], audit: [], reports: [], stats: {} };
    this.members = [];
    this.roomDetail = null;
    this.sharedUsage = null;
    this.lastSnapshot = null;
    this.adminFilter = "pending";
    this.adminSearch = "";
    this.selected = null;
    this.lastSubmitAt = 0;
    this.unsubscribeMessage = null;
    this.unsubscribeRoom = null;
    this.unsubscribeShared = null;
    this.bindUi();
  }

  Runtime.prototype.hasPermission = function (permission) {
    return Boolean(this.tapp && Array.isArray(this.tapp.permissions) && this.tapp.permissions.includes(permission));
  };

  Runtime.prototype.bindUi = function () {
    var self = this;
    queryAll("[data-tool]").forEach(function (button) {
      button.addEventListener("click", function () {
        queryAll("[data-tool]").forEach(function (item) { item.classList.toggle("is-active", item === button); });
        self.editor.setTool(button.dataset.tool);
        self.app.dataset.tool = button.dataset.tool;
      });
    });
    query("[data-color]").addEventListener("input", function (event) { self.editor.setColor(event.target.value); });
    query("[data-width]").addEventListener("input", function (event) { self.editor.setWidth(event.target.value); query("[data-width-label]").textContent = event.target.value; });
    query("[data-signature]").addEventListener("input", function () { self.updateDraft(self.editor.getDraftStats()); });
    query("[data-action='undo']").addEventListener("click", function () { self.editor.undo(); });
    query("[data-action='redo']").addEventListener("click", function () { self.editor.redo(); });
    query("[data-action='fit-view']").addEventListener("click", function () { self.editor.fitView(); });
    query("[data-action='find-blank']").addEventListener("click", function () { self.editor.findBlank(); });
    query("[data-action='zoom-in']").addEventListener("click", function () { self.editor.zoomAt(1.25); });
    query("[data-action='zoom-out']").addEventListener("click", function () { self.editor.zoomAt(.8); });
    query("[data-action='submit']").addEventListener("click", function () { self.submitDrawing(); });
    query("[data-action='open-history']").addEventListener("click", function () { self.renderArchives(); openDialog(query("[data-history-dialog]")); });
    query("[data-history-range]").addEventListener("input", function (event) {
      var fraction = Number(event.target.value) / 100;
      self.editor.setHistoryFraction(fraction);
      query("[data-history-copy]").textContent = fraction >= 1 ? "当前显示全部公开作品。" : "当前显示约 " + Math.ceil(self.replay.drawings.length * fraction) + " 幅较早作品。";
    });
    query("[data-action='close-activity']").addEventListener("click", function () { query("[data-activity-panel]").hidden = true; });
    query("[data-action='open-admin']").addEventListener("click", function () {
      openDialog(query("[data-admin-dialog]"));
      self.refreshAdminData(false);
    });
    query("[data-action='report-selected']").addEventListener("click", function () { self.reportSelected(); });
    query("[data-action='hide-selected']").addEventListener("click", function () { self.moderate(self.selected && self.selected.id, true, "manual_review"); closeDialog(query("[data-report-dialog]")); });
    queryAll("[data-action='publish-snapshot']").forEach(function (button) { button.addEventListener("click", function () { self.publishSnapshot(); }); });
    queryAll("[data-action='archive-board']").forEach(function (button) { button.addEventListener("click", function () { self.archiveBoard(); }); });
    queryAll("[data-admin-tab]").forEach(function (button) {
      button.addEventListener("click", function () { self.selectAdminTab(button.dataset.adminTab); });
    });
    var adminFilter = query("[data-admin-filter]");
    if (adminFilter) adminFilter.addEventListener("change", function (event) { self.adminFilter = event.target.value || "pending"; self.renderAdminModeration(); });
    var adminSearch = query("[data-admin-search]");
    if (adminSearch) adminSearch.addEventListener("input", function (event) { self.adminSearch = event.target.value || ""; self.renderAdminModeration(); });
    var adminRefresh = query("[data-action='admin-refresh']");
    if (adminRefresh) adminRefresh.addEventListener("click", function () { self.refreshAdminData(true); });
    var memberRefresh = query("[data-action='refresh-members']");
    if (memberRefresh) memberRefresh.addEventListener("click", function () { self.loadMembers(true); });
    var historyRefresh = query("[data-action='reload-history']");
    if (historyRefresh) historyRefresh.addEventListener("click", function () { self.reloadHistoryFromAdmin(); });
    query("[data-access-action]").addEventListener("click", function () { self.createBoard(false); });
    queryAll("[data-close-dialog]").forEach(function (button) { button.addEventListener("click", function () { closeDialog(button.closest(".app-dialog")); }); });
    queryAll(".app-dialog").forEach(function (dialog) { dialog.addEventListener("click", function (event) { if (event.target === dialog) closeDialog(dialog); }); });
    window.addEventListener("keydown", function (event) { if (event.key === "Escape") queryAll(".app-dialog:not([hidden])").forEach(closeDialog); });
    window.addEventListener("offline", function () { query("[data-offline]").hidden = false; self.setStatus("连接中断", "error"); });
    window.addEventListener("online", function () { query("[data-offline]").hidden = true; self.setStatus("已连接", "online"); });
  };

  Runtime.prototype.start = async function () {
    if (!this.tapp) {
      this.showAccess("需要 Myriad", "此页面必须在 Myriad Tapp 宿主中运行。静态界面请打开 preview.html。", "");
      this.setStatus("仅静态页面", "error");
      return;
    }
    try {
      await this.loadIdentity();
      this.revealAdminUi();
      await this.loadSharedState();
      if (!this.config || !this.config.roomId) {
        if (this.isAdmin && this.hasPermission("federation:room") && this.hasPermission("storage:write")) {
          this.showAccess("创建第一块共享画板", "系统会新建一个专用公开 Room。普通成员仍需通过 Myriad 原生界面加入，应用不会授予他们 Room 管理权限。", "创建共享画板");
        } else {
          this.showAccess("画板尚未开放", "管理员还没有创建共享 Room，请稍后再来。", "");
        }
        this.setStatus("等待管理员", "error");
        return;
      }
      if (!this.actor) {
        await this.loadGuestSnapshot();
        query("[data-access-card]").hidden = true;
        this.editor.fitView();
        this.toast("当前是访客只读快照。登录并加入共享 Room 后可以绘制。", false);
        this.setStatus("只读快照", "online");
        return;
      }
      await this.connectRoom();
      this.watchChanges();
    } catch (error) {
      console.error("[signature-board] startup failed", error);
      this.showAccess("暂时无法打开画板", this.messageForError(error), "");
      this.setStatus("连接失败", "error");
    }
  };

  Runtime.prototype.loadIdentity = async function () {
    try { this.role = String(await this.tapp.user.getRole() || "guest").toLowerCase(); } catch (_error) { this.role = "guest"; }
    try { this.identity = await this.tapp.federation.getIdentity() || {}; } catch (_error) { this.identity = {}; }
    this.actor = Core.normalizeActor(this.identity);
    this.isAdmin = ["owner", "admin", "administrator"].indexOf(this.role) >= 0;
    query("[data-signature]").value = this.actor ? Core.nicknameFromIdentity(this.identity) : "";
  };

  Runtime.prototype.loadSharedState = async function () {
    this.config = await this.safeSharedGet(Core.SHARED_KEYS.active);
    this.blocklist = await this.safeSharedGet(Core.SHARED_KEYS.blocklist) || [];
    if (!Array.isArray(this.blocklist)) this.blocklist = [];
    if (this.config) this.applyCanvasDimensions();
  };

  Runtime.prototype.applyCanvasDimensions = function () {
    var dimensions = canvasDimensions(this.config);
    this.editor.setCanvasSize(dimensions.width, dimensions.height);
    query("[data-canvas-size]").textContent = dimensions.width + " × " + dimensions.height;
  };

  Runtime.prototype.safeSharedGet = async function (key) {
    if (!this.hasPermission("storage:read")) return null;
    try { return await this.tapp.shared.get(key); } catch (error) { console.warn("[signature-board] shared read failed", key, error); return null; }
  };

  Runtime.prototype.loadGuestSnapshot = async function () {
    var snapshot = await this.safeSharedGet(Core.SHARED_KEYS.guestSnapshot);
    if (snapshot && snapshot.boardId === this.config.boardId && snapshot.dataUrl && !this.editor.setSnapshot(snapshot.dataUrl)) {
      this.toast("访客快照格式不受支持，已清空。", true);
    }
  };

  Runtime.prototype.connectRoom = async function () {
    if (!this.hasPermission("federation:read") || !this.hasPermission("federation:message")) throw new Error("当前安装没有获得读取和发送 Room 消息的权限。");
    var room;
    try { room = await this.tapp.federation.getRoom(this.config.roomId); } catch (error) {
      this.showJoinInstructions();
      this.setStatus("尚未加入", "error");
      return;
    }
    this.roomDetail = room || null;
    var owner = room && (room.owner_actor || room.ownerActor || room.owner);
    if (owner && !this.config.ownerActor) this.config.ownerActor = Core.normalizeActor(owner);
    this.isMember = await this.checkMembership();
    if (!this.isMember) {
      this.showJoinInstructions();
      this.setStatus("尚未加入", "error");
      return;
    }
    query("[data-access-card]").hidden = true;
    this.editor.setEnabled(!this.blocklist.map(Core.normalizeActor).includes(this.actor));
    await this.loadHistory();
    await this.tapp.federation.subscribeRoom(this.config.roomId);
    this.setStatus("共享中", "online");
    this.app.dataset.appState = "ready";
    if (!this.editor.drawings.length) this.editor.findBlank();
  };

  Runtime.prototype.checkMembership = async function () {
    try {
      var result = await this.tapp.federation.getRoomMembers(this.config.roomId);
      var members = unwrapList(result, ["members", "items"]);
      this.members = members;
      if (!members.length) return this.isAdmin;
      return members.some(function (member) { return Core.sameActor(memberActor(member), this.actor); }, this);
    } catch (_error) {
      return false;
    }
  };

  Runtime.prototype.loadHistory = async function () {
    var before;
    var pages = 0;
    var seen = new Set();
    this.events = [];
    while (pages < 20) {
      var result = await this.tapp.federation.getRoomMessages(this.config.roomId, before, 100);
      var messages = unwrapList(result, ["messages", "items"]);
      if (!messages.length) break;
      var added = 0;
      messages.forEach(function (raw) {
        var decoded = Core.decodeFederationEnvelope(raw);
        var key = decoded && (decoded.messageId || decoded.payload.nonce);
        if (decoded && !seen.has(key)) { seen.add(key); this.events.push(decoded); added += 1; }
      }, this);
      pages += 1;
      var last = messages[messages.length - 1] || {};
      var next = result && (result.next_cursor || result.nextCursor || result.before) || last.message_id || last.messageId || last.id;
      if (messages.length < 100 || !next || next === before || !added) break;
      before = next;
    }
    this.applyReplay();
  };

  Runtime.prototype.watchChanges = function () {
    var self = this;
    [this.unsubscribeMessage, this.unsubscribeRoom, this.unsubscribeShared].forEach(function (unsubscribe) {
      if (typeof unsubscribe === "function") unsubscribe();
    });
    if (this.tapp.federation.onMessage) this.unsubscribeMessage = this.tapp.federation.onMessage(function (raw) {
      var decoded = Core.decodeFederationEnvelope(raw);
      if (!decoded || decoded.roomId && decoded.roomId !== self.config.roomId) return;
      if (self.events.some(function (event) { return (event.messageId && event.messageId === decoded.messageId) || event.payload.nonce === decoded.payload.nonce; })) return;
      self.events.push(decoded);
      self.applyReplay();
    });
    if (this.tapp.federation.onRoomUpdate) this.unsubscribeRoom = this.tapp.federation.onRoomUpdate(function (event) {
      if (event && (event.roomId === self.config.roomId || event.room_id === self.config.roomId) && event.type === "disconnected") {
        query("[data-offline]").hidden = false;
        self.setStatus("Room 已断开", "error");
      }
    });
    if (this.tapp.shared.onChanged) this.unsubscribeShared = this.tapp.shared.onChanged(async function (event) {
      if (!event || event.key === Core.SHARED_KEYS.blocklist) {
        self.blocklist = await self.safeSharedGet(Core.SHARED_KEYS.blocklist) || [];
        self.applyReplay();
      }
    });
  };

  Runtime.prototype.applyReplay = function () {
    var dimensions = canvasDimensions(this.config);
    this.replay = Core.replayEvents(this.events, { boardId: this.config.boardId, ownerActor: this.config.ownerActor, blockedActors: this.blocklist, canvasWidth: dimensions.width, canvasHeight: dimensions.height });
    this.editor.setDrawings(this.replay.drawings);
    var usage = Core.occupancy(this.replay.drawings, dimensions);
    query("[data-occupancy]").textContent = Math.round(usage.ratio * 100) + "%";
    query("[data-occupancy]").parentElement.classList.toggle("is-warning", usage.warning);
    query("[data-drawing-count]").textContent = this.replay.drawings.length + " 幅作品";
    this.renderActivity();
    if (this.isAdmin) this.renderAdmin();
  };

  Runtime.prototype.submitDrawing = async function () {
    if (!this.isMember || !this.editor.enabled) return;
    var now = Date.now();
    if (now - this.lastSubmitAt < Core.LIMITS.cooldownMs) {
      this.toast("请等待 " + Math.ceil((Core.LIMITS.cooldownMs - (now - this.lastSubmitAt)) / 1000) + " 秒后再次提交。", true);
      return;
    }
    var payload = {
      v: Core.LIMITS.protocolVersion,
      kind: Core.KINDS.drawing,
      boardId: this.config.boardId,
      drawingId: Core.makeNonce("drawing"),
      nonce: Core.makeNonce("submit"),
      signature: query("[data-signature]").value,
      createdAt: new Date().toISOString(),
      canvasWidth: canvasDimensions(this.config).width,
      canvasHeight: canvasDimensions(this.config).height,
      strokes: this.editor.getDraft()
    };
    var dimensions = canvasDimensions(this.config);
    var checked = Core.validateDrawing(payload, { canvasWidth: dimensions.width, canvasHeight: dimensions.height });
    if (!checked.ok) {
      this.toast(this.describeValidation(checked.errors), true);
      return;
    }
    var button = query("[data-action='submit']");
    button.disabled = true;
    try {
      await this.send(checked.payload);
      this.lastSubmitAt = Date.now();
      this.events.push({ payload: checked.payload, sender: this.actor, roomId: this.config.roomId, createdAt: checked.payload.createdAt });
      this.editor.clearDraft();
      this.applyReplay();
      this.toast("作品已提交。它现在是公开历史的一部分。", false);
    } catch (error) {
      this.toast("提交失败，草稿仍保留在当前页面：" + this.messageForError(error), true);
    } finally {
      this.updateDraft(this.editor.getDraftStats());
    }
  };

  Runtime.prototype.reportSelected = async function () {
    if (!this.selected || !this.isMember) return;
    try {
      var payload = Core.makeEvent(Core.KINDS.report, this.config.boardId, { targetId: this.selected.id, reason: query("[data-report-reason]").value });
      await this.send(payload);
      this.events.push({ payload: payload, sender: this.actor, roomId: this.config.roomId, createdAt: payload.createdAt });
      this.applyReplay();
      closeDialog(query("[data-report-dialog]"));
      this.toast("举报已作为公开审核事件提交。", false);
    } catch (error) { this.toast(this.messageForError(error), true); }
  };

  Runtime.prototype.moderate = async function (targetId, hidden, reason) {
    if (!this.isAdmin || !targetId) return;
    try {
      var payload = Core.makeEvent(hidden ? Core.KINDS.hide : Core.KINDS.restore, this.config.boardId, { targetId: targetId, reason: reason || "manual_review" });
      await this.send(payload);
      this.events.push({ payload: payload, sender: this.actor, roomId: this.config.roomId, createdAt: payload.createdAt });
      this.applyReplay();
      this.toast(hidden ? "作品已隐藏。" : "作品已恢复。", false);
    } catch (error) { this.toast(this.messageForError(error), true); }
  };

  Runtime.prototype.blockActor = async function (actor) {
    if (!this.isAdmin || !actor || !this.hasPermission("storage:write")) return;
    var normalized = Core.normalizeActor(actor);
    var previous = this.blocklist.slice();
    if (!this.blocklist.map(Core.normalizeActor).includes(normalized)) this.blocklist.push(normalized);
    try {
      await this.tapp.shared.set(Core.SHARED_KEYS.blocklist, this.blocklist);
    } catch (error) {
      this.blocklist = previous;
      this.toast("写入应用封禁列表失败：" + this.messageForError(error), true);
      return;
    }
    this.applyReplay();
    var removalError = null;
    if (this.hasPermission("federation:room") && this.tapp.federation.removeMember) {
      try { await this.tapp.federation.removeMember(this.config.roomId, { actor: normalized }); }
      catch (error) { removalError = error; }
    }
    await this.loadMembers(false);
    if (removalError) this.toast("应用封禁已生效，但移出 Room 失败：" + this.messageForError(removalError), true);
    else this.toast("已加入应用封禁列表并请求移出 Room。公开 Room 的重新加入行为仍需宿主验证。", false);
  };

  Runtime.prototype.publishSnapshot = async function () {
    if (!this.isAdmin || !this.hasPermission("storage:write")) return false;
    try {
      var dimensions = canvasDimensions(this.config);
      var usage = Core.occupancy(this.replay.drawings, dimensions);
      var snapshot = { v: 1, boardId: this.config.boardId, roomId: this.config.roomId, createdAt: new Date().toISOString(), canvas: dimensions, drawingCount: this.replay.drawings.length, occupancyRatio: usage.ratio, dataUrl: this.editor.createSnapshot() };
      if (Core.byteLength(snapshot) > 1024 * 1024) throw new Error("压缩快照超过共享存储单键 1 MiB 限制。");
      await this.tapp.shared.set(Core.SHARED_KEYS.guestSnapshot, snapshot);
      await this.send(Core.makeEvent(Core.KINDS.snapshot, this.config.boardId, { snapshotAt: snapshot.createdAt }));
      this.lastSnapshot = snapshot;
      this.renderAdmin();
      this.toast("访客快照已发布。", false);
      return snapshot;
    } catch (error) { this.toast(this.messageForError(error), true); return false; }
  };

  Runtime.prototype.archiveBoard = async function () {
    if (!this.isAdmin || !this.hasPermission("federation:room") || !this.hasPermission("storage:write")) return;
    var confirmed = await this.tapp.ui.confirm("归档当前画板并创建一个新的公开 Room？旧作品会保留在原 Room 中。");
    if (!confirmed) return;
    try {
      var snapshot = await this.publishSnapshot();
      if (!snapshot) return;
      var snapshotKey = archiveSnapshotKey(this.config.boardId);
      await this.tapp.shared.set(snapshotKey, snapshot);
      await this.send(Core.makeEvent(Core.KINDS.archive, this.config.boardId, { reason: "manual_archive" }));
      await this.createBoard({
        boardId: this.config.boardId,
        roomId: this.config.roomId,
        archivedAt: new Date().toISOString(),
        snapshotKey: snapshotKey,
        canvas: canvasDimensions(this.config)
      });
    } catch (error) { this.toast(this.messageForError(error), true); }
  };

  Runtime.prototype.createBoard = async function (archiveRecord) {
    if (!this.isAdmin || !this.hasPermission("federation:room") || !this.hasPermission("storage:write")) return;
    var action = query("[data-access-action]");
    action.disabled = true;
    try {
      var room = await this.tapp.federation.createRoom({
        name: "共享签名板 · " + new Date().toLocaleDateString(),
        description: "cn.astelysin.signature-board 专用公开绘画事件流",
        is_public: true,
        invite_policy: "open",
        governance_type: "owner"
      });
      var roomId = room.room_id || room.roomId || room.id;
      if (!roomId) throw new Error("Myriad 未返回 Room ID。");
      var archiveCandidates = archiveRecord && this.config ? (this.config.archives || []).concat([archiveRecord]) : [];
      var droppedArchives = archiveCandidates.slice(0, Math.max(0, archiveCandidates.length - 6));
      var archives = archiveCandidates.slice(-6);
      for (var archiveIndex = 0; archiveIndex < droppedArchives.length; archiveIndex += 1) {
        if (droppedArchives[archiveIndex].snapshotKey) await this.tapp.shared.remove(droppedArchives[archiveIndex].snapshotKey);
      }
      this.config = {
        v: 2,
        boardId: Core.makeNonce("board"),
        roomId: roomId,
        homeServer: room.home_server || room.homeServer || "",
        ownerActor: this.actor,
        createdAt: new Date().toISOString(),
        canvas: { width: Core.LIMITS.canvasWidth, height: Core.LIMITS.canvasHeight },
        archives: archives
      };
      await this.tapp.shared.set(Core.SHARED_KEYS.active, this.config);
      this.roomDetail = room;
      this.members = [];
      this.lastSnapshot = null;
      this.applyCanvasDimensions();
      this.events = [];
      this.editor.clearDraft();
      this.editor.setSnapshot("");
      await this.connectRoom();
      this.watchChanges();
      this.toast("新的共享画板已创建。", false);
    } catch (error) {
      this.toast(this.messageForError(error), true);
      this.showAccess("创建失败", this.messageForError(error), "重试创建");
    } finally { action.disabled = false; }
  };

  Runtime.prototype.send = function (payload) {
    return this.tapp.federation.sendRoomMessage(this.config.roomId, { message_type: Core.LIMITS.messageType, payload: payload });
  };

  Runtime.prototype.openDrawing = function (drawing) {
    this.selected = drawing;
    query("[data-selected-signature]").textContent = drawing.signature;
    query("[data-selected-time]").textContent = drawing.createdAt ? new Date(drawing.createdAt).toLocaleString() : "时间未知";
    openDialog(query("[data-report-dialog]"));
  };

  Runtime.prototype.renderActivity = function () {
    var list = query("[data-activity-list]");
    list.textContent = "";
    var recent = this.replay.drawings.slice(-8).reverse();
    if (!recent.length) { list.innerHTML = '<li class="empty-row">这里还没有签名，来当第一个吧。</li>'; return; }
    var self = this;
    recent.forEach(function (drawing) {
      var item = document.createElement("li");
      var avatar = document.createElement("span"); avatar.className = "activity-avatar"; avatar.textContent = drawing.signature.slice(0, 1).toUpperCase();
      var copy = document.createElement("span"); copy.className = "activity-copy";
      var name = document.createElement("strong"); name.textContent = drawing.signature;
      var time = document.createElement("span"); time.textContent = drawing.createdAt ? new Date(drawing.createdAt).toLocaleString() : "刚刚";
      copy.append(name, time); item.append(avatar, copy);
      item.addEventListener("click", function () { self.editor.focusDrawing(drawing); });
      list.appendChild(item);
    });
  };

  Runtime.prototype.renderArchives = function () {
    var list = query("[data-archive-list]");
    var archives = this.config && Array.isArray(this.config.archives) ? this.config.archives.slice().reverse() : [];
    query("[data-archive-count]").textContent = archives.length + " 块";
    query("[data-archive-preview]").hidden = true;
    list.textContent = "";
    if (!archives.length) { list.innerHTML = '<p class="empty-row">还没有已归档画布。</p>'; return; }
    var self = this;
    archives.forEach(function (archive, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "archive-item";
      var title = document.createElement("strong");
      title.textContent = "画布 " + (archives.length - index);
      var details = document.createElement("span");
      var dimensions = archive.canvas || { width: Core.LIMITS.legacyCanvasSize, height: Core.LIMITS.legacyCanvasSize };
      details.textContent = new Date(archive.archivedAt).toLocaleString() + " · " + dimensions.width + "×" + dimensions.height;
      var room = document.createElement("span");
      room.textContent = archive.roomId || "Room 未记录";
      button.append(title, details, room);
      button.addEventListener("click", function () { self.showArchive(archive); });
      list.appendChild(button);
    });
  };

  Runtime.prototype.showArchive = async function (archive) {
    if (!archive.snapshotKey) { this.toast("这个旧归档只保留了 Room 记录，没有可预览快照。", true); return; }
    try {
      var snapshot = await this.safeSharedGet(archive.snapshotKey);
      if (!snapshot || !snapshot.dataUrl) throw new Error("归档快照不存在或已被移除。");
      var safeUrl = root.SignatureBoardEditor.safeImage(snapshot.dataUrl);
      var image = query("[data-archive-image]");
      image.removeAttribute("src");
      query("[data-archive-preview]").hidden = true;
      if (!safeUrl) throw new Error("归档快照格式不受支持，已清空。");
      image.src = safeUrl;
      query("[data-archive-caption]").textContent = new Date(archive.archivedAt).toLocaleString() + " · " + (archive.roomId || "Room 未记录");
      query("[data-archive-preview]").hidden = false;
    } catch (error) { this.toast(this.messageForError(error), true); }
  };

  Runtime.prototype.selectAdminTab = function (name) {
    queryAll("[data-admin-tab]").forEach(function (button) { button.classList.toggle("is-active", button.dataset.adminTab === name); });
    queryAll("[data-admin-panel]").forEach(function (panel) {
      var active = panel.dataset.adminPanel === name;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  };

  Runtime.prototype.refreshAdminData = async function (notify) {
    if (!this.isAdmin || !this.config) return;
    var tasks = [this.loadMembers(false)];
    if (this.hasPermission("federation:read")) {
      tasks.push(this.tapp.federation.getRoom(this.config.roomId).then(function (room) { this.roomDetail = room || null; }.bind(this)).catch(function () {}));
    }
    tasks.push(this.safeSharedGet(Core.SHARED_KEYS.guestSnapshot).then(function (snapshot) { this.lastSnapshot = snapshot || null; }.bind(this)));
    if (this.hasPermission("storage:read") && this.tapp.shared && typeof this.tapp.shared.usage === "function") {
      try {
        tasks.push(Promise.resolve(this.tapp.shared.usage()).then(function (usage) { this.sharedUsage = usage; }.bind(this)).catch(function () { this.sharedUsage = null; }.bind(this)));
      } catch (_error) { this.sharedUsage = null; }
    }
    await Promise.all(tasks);
    this.renderAdmin();
    if (notify) this.toast("后台数据已刷新。", false);
  };

  Runtime.prototype.loadMembers = async function (notify) {
    if (!this.config || !this.hasPermission("federation:read")) return;
    try {
      var result = await this.tapp.federation.getRoomMembers(this.config.roomId);
      this.members = unwrapList(result, ["members", "items"]);
      this.renderAdmin();
      if (notify) this.toast("Room 成员已刷新。", false);
    } catch (error) {
      if (notify) this.toast("读取成员失败：" + this.messageForError(error), true);
    }
  };

  Runtime.prototype.reloadHistoryFromAdmin = async function () {
    if (!this.config || !this.isMember) return;
    try {
      await this.loadHistory();
      this.toast("Room 历史已重新读取。", false);
    } catch (error) { this.toast("重新读取失败：" + this.messageForError(error), true); }
  };

  Runtime.prototype.unblockActor = async function (actor) {
    if (!this.isAdmin || !this.hasPermission("storage:write")) return;
    var normalized = Core.normalizeActor(actor);
    var previous = this.blocklist.slice();
    this.blocklist = this.blocklist.filter(function (item) { return !Core.sameActor(item, normalized); });
    try {
      await this.tapp.shared.set(Core.SHARED_KEYS.blocklist, this.blocklist);
      this.applyReplay();
      this.toast("已解除应用封禁；该成员不会被自动重新加入 Room。", false);
    } catch (error) {
      this.blocklist = previous;
      this.toast(this.messageForError(error), true);
    }
  };

  Runtime.prototype.resolveReport = async function (reportId) {
    if (!this.isAdmin || !reportId) return;
    try {
      var payload = Core.makeEvent(Core.KINDS.resolveReport, this.config.boardId, { reportId: reportId, resolution: "reviewed" });
      await this.send(payload);
      this.events.push({ payload: payload, sender: this.actor, roomId: this.config.roomId, createdAt: payload.createdAt });
      this.applyReplay();
      this.toast("举报已标记为处理完成。", false);
    } catch (error) { this.toast(this.messageForError(error), true); }
  };

  Runtime.prototype.renderAdmin = function () {
    if (!this.isAdmin || !query("[data-admin-dialog]") || !this.config) return;
    var stats = this.replay.stats || {};
    var dimensions = canvasDimensions(this.config);
    var usage = Core.occupancy(this.replay.drawings || [], dimensions);
    var archives = Array.isArray(this.config.archives) ? this.config.archives : [];
    var pending = (this.replay.reports || []).filter(function (report) { return !report.resolved; }).length;
    var metrics = {
      drawings: (this.replay.drawings || []).length,
      reports: pending,
      members: this.members.length,
      occupancy: Math.round(usage.ratio * 100) + "%",
      hidden: Number(stats.hiddenDrawings || 0),
      blocked: this.blocklist.length
    };
    Object.keys(metrics).forEach(function (key) { setText("[data-admin-metric='" + key + "']", metrics[key]); });
    setText("[data-admin-pending-badge]", pending);
    setText("[data-admin-member-badge]", this.members.length);
    setText("[data-admin-archive-badge]", archives.length);
    setText("[data-admin-board-label]", "活动画板 · " + this.config.boardId);
    setText("[data-admin-detail='board']", this.config.boardId);
    setText("[data-admin-detail='room']", this.config.roomId);
    setText("[data-admin-detail='snapshot']", this.lastSnapshot && this.lastSnapshot.boardId === this.config.boardId ? formatDate(this.lastSnapshot.createdAt) : "尚未发布");
    setText("[data-admin-detail='storage']", this.formatSharedUsage());
    setText("[data-admin-detail='board-id']", this.config.boardId);
    setText("[data-admin-detail='created']", formatDate(this.config.createdAt));
    setText("[data-admin-detail='occupancy']", Math.round(usage.ratio * 100) + "%（" + usage.used + "/" + usage.total + " 格）");
    setText("[data-admin-canvas-size]", dimensions.width + " × " + dimensions.height);
    setText("[data-system-detail='role']", this.role);
    setText("[data-system-detail='actor']", this.actor || "未登录");
    setText("[data-system-detail='owner']", this.config.ownerActor || memberActor(this.roomDetail && (this.roomDetail.owner || this.roomDetail.owner_actor)) || "未提供");
    setText("[data-system-detail='events']", Number(stats.totalEvents == null ? this.events.length : stats.totalEvents));
    setText("[data-system-detail='accepted']", Number(stats.acceptedEvents || 0));
    setText("[data-system-detail='ignored']", Number(stats.ignoredEvents || 0));
    setText("[data-system-detail='connection']", this.isMember ? "已加入并订阅 Room" : "未连接 Room");
    var health = query("[data-admin-health]");
    if (health) {
      health.classList.toggle("is-online", this.isMember);
      health.classList.toggle("is-error", !this.isMember);
      var healthLabel = health.querySelector("span");
      if (healthLabel) healthLabel.textContent = this.isMember ? "运行正常" : "连接受限";
    }
    this.renderAdminPermissions();
    this.renderAdminModeration();
    this.renderAdminMembers();
    this.renderAdminArchives();
  };

  Runtime.prototype.formatSharedUsage = function () {
    var usage = this.sharedUsage;
    if (usage == null) return "接口未提供";
    if (typeof usage === "number") return formatBytes(usage);
    if (typeof usage !== "object") return String(usage);
    var used = usage.usedBytes != null ? usage.usedBytes : (usage.used_bytes != null ? usage.used_bytes : (usage.used != null ? usage.used : usage.bytes));
    var limit = usage.limitBytes != null ? usage.limitBytes : (usage.limit_bytes != null ? usage.limit_bytes : (usage.limit != null ? usage.limit : usage.quota));
    if (used != null && limit != null) return formatBytes(used) + " / " + formatBytes(limit);
    if (used != null) return formatBytes(used);
    var keys = Object.keys(usage);
    return keys.length ? keys.slice(0, 3).map(function (key) { return key + ": " + String(usage[key]); }).join(" · ") : "未返回用量";
  };

  Runtime.prototype.renderAdminPermissions = function () {
    var box = query("[data-admin-permissions]");
    if (!box) return;
    box.textContent = "";
    var permissions = this.tapp && Array.isArray(this.tapp.permissions) ? this.tapp.permissions : [];
    if (!permissions.length) { box.innerHTML = '<p class="empty-row">宿主未返回权限列表。</p>'; return; }
    permissions.forEach(function (permission) {
      var badge = document.createElement("span");
      badge.className = "admin-badge";
      badge.textContent = permission;
      box.appendChild(badge);
    });
  };

  Runtime.prototype.renderAdminModeration = function () {
    var list = query("[data-admin-moderation-list]");
    if (!list) return;
    var self = this;
    var term = this.adminSearch.trim().toLowerCase();
    var rows;
    if (this.adminFilter === "pending" || this.adminFilter === "reported") {
      rows = (this.replay.reports || []).filter(function (report) { return self.adminFilter === "reported" || !report.resolved; }).map(function (report) {
        return { type: "report", report: report, drawing: self.replay.audit.find(function (drawing) { return drawing.id === report.targetId; }) || null };
      });
    } else {
      rows = (this.replay.audit || []).filter(function (drawing) { return self.adminFilter !== "hidden" || drawing.hidden; }).map(function (drawing) { return { type: "drawing", drawing: drawing }; });
    }
    if (term) rows = rows.filter(function (row) {
      var drawing = row.drawing || {};
      var report = row.report || {};
      return [drawing.signature, drawing.author, drawing.id, report.id, report.reason, report.reporter].join(" ").toLowerCase().includes(term);
    });
    list.textContent = "";
    if (!rows.length) { list.innerHTML = '<p class="empty-row">没有符合当前条件的记录。</p>'; return; }
    rows.slice().reverse().forEach(function (row) {
      var drawing = row.drawing;
      var report = row.report;
      var item = document.createElement("article"); item.className = "admin-row";
      var main = document.createElement("div"); main.className = "admin-row-main";
      var title = document.createElement("strong"); title.textContent = drawing ? drawing.signature : "作品不存在";
      var meta = document.createElement("span"); meta.className = "admin-row-meta";
      meta.textContent = drawing ? ((drawing.author || "未知 actor") + " · " + drawing.id) : ((report && report.targetId) || "未知作品");
      var badges = document.createElement("div");
      if (report) badges.appendChild(self.makeAdminBadge(report.resolved ? "举报已处理" : "待审举报", report.resolved ? "" : "is-warning"));
      if (report) badges.appendChild(self.makeAdminBadge(report.reason || "未注明原因", ""));
      if (drawing && drawing.hidden) badges.appendChild(self.makeAdminBadge("已隐藏", "is-danger"));
      if (drawing && drawing.blocked) badges.appendChild(self.makeAdminBadge("actor 已封禁", "is-danger"));
      main.append(title, meta, badges);
      var actions = document.createElement("div"); actions.className = "admin-row-actions";
      if (drawing) {
        actions.appendChild(self.makeAdminAction("定位", "ghost-button", function () {
          closeDialog(query("[data-admin-dialog]"));
          self.editor.focusDrawing(drawing);
        }));
        actions.appendChild(self.makeAdminAction(drawing.hidden ? "恢复" : "隐藏", drawing.hidden ? "ghost-button" : "danger-button", function () { self.moderate(drawing.id, !drawing.hidden, report ? "reported_" + report.reason : "manual_review"); }));
      }
      if (report && !report.resolved) actions.appendChild(self.makeAdminAction("标记已处理", "ghost-button", function () { self.resolveReport(report.id); }));
      item.append(main, actions); list.appendChild(item);
    });
  };

  Runtime.prototype.makeAdminBadge = function (label, className) {
    var badge = document.createElement("span");
    badge.className = "admin-badge" + (className ? " " + className : "");
    badge.textContent = label;
    return badge;
  };

  Runtime.prototype.makeAdminAction = function (label, className, handler) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = className || "ghost-button";
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  };

  Runtime.prototype.renderAdminMembers = function () {
    var list = query("[data-admin-member-list]");
    if (!list) return;
    var self = this;
    list.textContent = "";
    if (!this.members.length) { list.innerHTML = '<p class="empty-row">Room 未返回成员，或成员列表为空。</p>'; return; }
    this.members.forEach(function (member) {
      var actor = memberActor(member);
      var blocked = self.blocklist.some(function (item) { return Core.sameActor(item, actor); });
      var protectedMember = Core.sameActor(actor, self.actor) || Core.sameActor(actor, self.config.ownerActor);
      var item = document.createElement("article"); item.className = "admin-row";
      var main = document.createElement("div"); main.className = "admin-row-main";
      var title = document.createElement("strong"); title.textContent = member.display_name || member.displayName || member.name || actor || "未知成员";
      var meta = document.createElement("span"); meta.className = "admin-row-meta"; meta.textContent = actor || "宿主未返回 actor";
      var badges = document.createElement("div");
      badges.appendChild(self.makeAdminBadge(member.role || member.membership || member.status || "member", ""));
      if (blocked) badges.appendChild(self.makeAdminBadge("应用封禁", "is-danger"));
      if (protectedMember) badges.appendChild(self.makeAdminBadge("受保护", ""));
      main.append(title, meta, badges);
      var actions = document.createElement("div"); actions.className = "admin-row-actions";
      if (actor && !protectedMember) {
        actions.appendChild(self.makeAdminAction(blocked ? "解除封禁" : "封禁并移出", blocked ? "ghost-button" : "danger-button", function () { if (blocked) self.unblockActor(actor); else self.blockActor(actor); }));
      }
      item.append(main, actions); list.appendChild(item);
    });
  };

  Runtime.prototype.renderAdminArchives = function () {
    var list = query("[data-admin-archive-list]");
    if (!list) return;
    var self = this;
    var archives = this.config && Array.isArray(this.config.archives) ? this.config.archives.slice().reverse() : [];
    list.textContent = "";
    if (!archives.length) { list.innerHTML = '<p class="empty-row">暂无归档。</p>'; return; }
    archives.forEach(function (archive, index) {
      var button = document.createElement("button"); button.type = "button"; button.className = "archive-item";
      var title = document.createElement("strong"); title.textContent = "归档画板 " + (archives.length - index);
      var dimensions = archive.canvas || { width: Core.LIMITS.legacyCanvasSize, height: Core.LIMITS.legacyCanvasSize };
      var detail = document.createElement("span"); detail.textContent = formatDate(archive.archivedAt) + " · " + dimensions.width + "×" + dimensions.height;
      var room = document.createElement("span"); room.textContent = archive.roomId || "Room 未记录";
      button.append(title, detail, room);
      button.addEventListener("click", function () {
        closeDialog(query("[data-admin-dialog]"));
        self.renderArchives();
        openDialog(query("[data-history-dialog]"));
        self.showArchive(archive);
      });
      list.appendChild(button);
    });
  };

  Runtime.prototype.revealAdminUi = function () {
    queryAll(".admin-only").forEach(function (element) { element.hidden = !this.isAdmin; }, this);
  };

  Runtime.prototype.showJoinInstructions = function () {
    var shareId = this.config.roomId + (this.config.homeServer ? "@" + this.config.homeServer : "");
    this.showAccess("先加入共享 Room", "为避免给普通成员 Room 管理权限，请复制下面的 ID，在 Myriad 原生 Room 界面手动加入，然后重新打开此应用。", "");
    var code = query("[data-room-id]"); code.textContent = shareId; code.hidden = false;
  };

  Runtime.prototype.showAccess = function (title, copy, actionLabel) {
    var card = query("[data-access-card]");
    card.hidden = false;
    query("[data-access-title]").textContent = title;
    query("[data-access-copy]").textContent = copy;
    query("[data-room-id]").hidden = true;
    var button = query("[data-access-action]");
    button.hidden = !actionLabel;
    button.textContent = actionLabel || "";
  };

  Runtime.prototype.updateDraft = function (stats) {
    query("[data-draft-stat]").textContent = stats.strokes + " 笔 · " + stats.points + " 点";
    var signature = Core.sanitizeSignature(query("[data-signature]").value);
    var validBounds = !stats.bounds || stats.bounds.width <= Core.LIMITS.maxBounds && stats.bounds.height <= Core.LIMITS.maxBounds;
    var button = query("[data-action='submit']");
    button.disabled = !this.isMember || !this.editor.enabled || !stats.strokes || !signature || stats.points > Core.LIMITS.maxPoints || !validBounds;
    query("[data-submit-hint]").textContent = !validBounds ? "作品范围超过 1024×1024" : stats.points > Core.LIMITS.maxPoints ? "点数超过 2000" : "提交后不可修改或删除";
  };

  Runtime.prototype.updateZoom = function (view) { query("[data-zoom]").textContent = Math.round(view.scale * 100) + "%"; };

  Runtime.prototype.setStatus = function (label, state) {
    var pill = query("[data-status-pill]");
    pill.classList.toggle("is-online", state === "online");
    pill.classList.toggle("is-error", state === "error");
    pill.querySelector("span").textContent = label;
  };

  Runtime.prototype.describeValidation = function (errors) {
    var messages = { signature_missing: "请填写展示署名。", strokes_missing: "请先画点什么。", points_exceeded: "点数超过 2000，请撤销部分笔画。", bounds_exceeded: "作品范围超过 1024×1024，请缩小绘制区域。", canvas_exceeded: "作品超出了当前画布范围。", bytes_exceeded: "作品数据超过 256 KiB，请减少笔画。", stroke_invalid: "草稿中存在无效笔画。" };
    return errors.map(function (error) { return messages[error] || "作品未通过校验（" + error + "）。"; }).join(" ");
  };

  Runtime.prototype.messageForError = function (error) {
    return error && (error.message || error.error || error.detail) ? String(error.message || error.error || error.detail) : "未知错误";
  };

  Runtime.prototype.toast = function (message, isError) {
    var toast = document.createElement("div");
    toast.className = "toast" + (isError ? " is-error" : "");
    toast.textContent = message;
    query("[data-toast-region]").appendChild(toast);
    setTimeout(function () { toast.remove(); }, 4600);
  };

  root.SignatureBoardRuntime = Runtime;
})(globalThis);
