(function (root) {
  "use strict";

  var Core = root.FootprintEarthCore;

  function query(selector) { return document.querySelector(selector); }
  function queryAll(selector) { return Array.from(document.querySelectorAll(selector)); }
  function t(key, fallback) {
    try { var value = root.Tapp.i18n.t(key); return value && value !== key ? value : fallback; }
    catch (_error) { return fallback; }
  }
  function setText(selector, value) { var node = query(selector); if (node) node.textContent = value == null ? "—" : String(value); }
  function memberActor(member) { return Core.normalizeActor(member && (member.actor || member.actor_url || member.actorUrl || member.actor_id || member.actorId || member.id || member)); }
  function localeKey() {
    var locale = "";
    try { if (root.Tapp.i18n && typeof root.Tapp.i18n.getLocale === "function") locale = root.Tapp.i18n.getLocale(); } catch (_error) {}
    if (typeof locale !== "string") locale = "";
    locale = locale || document.documentElement.lang || (typeof navigator !== "undefined" && navigator.language) || "en";
    if (/^zh/i.test(locale)) return "zh";
    if (/^ja/i.test(locale)) return "ja";
    return "en";
  }
  function featureName(feature) { return feature && feature.names && (feature.names[localeKey()] || feature.names.en) || feature && feature.code || "—"; }

  function DomView() {
    this.runtime = null;
    this.state = null;
    this.globe = null;
    this.selection = { countryCode: "", regionCode: "" };
    this.themeQuery = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
    this.theme = this.themeQuery && this.themeQuery.matches ? "dark" : "light";
    this.usesHostTheme = false;
    this.themeOff = null;
    this.resizeObserver = null;
    this.dialogReturnFocus = null;
    this.onDialogKeyDown = this.handleDialogKeyDown.bind(this);
    this.onThemeChange = this.applyTheme.bind(this);
    this.onSystemThemeChange = this.updateSystemTheme.bind(this);
    this.applyTranslations();
    this.applyTheme(this.theme);
    this.bindBaseActions();
    this.bindTheme();
  }

  DomView.prototype.bindRuntime = function (runtime) { this.runtime = runtime; };
  DomView.prototype.applyTranslations = function () {
    queryAll("[data-i18n]").forEach(function (node) {
      var key = node.dataset.i18n;
      node.textContent = t(key, node.textContent);
    });
    queryAll("[data-i18n-aria]").forEach(function (node) {
      node.setAttribute("aria-label", t(node.dataset.i18nAria, node.getAttribute("aria-label") || ""));
    });
  };
  DomView.prototype.booting = function () { this.setConnection(t("status.loading", "正在读取"), "loading"); };
  DomView.prototype.ready = function (state) {
    this.setConnection(state.mode === "guest" ? t("status.public", "公开只读") : state.isRoomMember ? t("status.connected", "已连接") : t("status.joinRequired", "需要加入 Room"), state.mode === "guest" || state.isRoomMember ? "online" : "error");
  };
  DomView.prototype.status = function (event) { if (event && event.type === "disconnected") this.setConnection(t("status.disconnected", "连接中断"), "error"); };
  DomView.prototype.error = function (error) { if (error) this.toast((error.message || String(error)), true); };
  DomView.prototype.history = function () {};
  DomView.prototype.members = function () {};
  DomView.prototype.selection = function () {};
  DomView.prototype.moderation = function () {};
  DomView.prototype.setConnection = function (label, state) {
    var node = query("[data-connection]");
    if (!node) return;
    node.classList.toggle("is-online", state === "online");
    node.classList.toggle("is-error", state === "error");
    var copy = node.querySelector("span"); if (copy) copy.textContent = label;
  };

  DomView.prototype.applyTheme = function (theme) {
    this.theme = theme === "dark" || theme === true ? "dark" : "light";
    var app = query(".footprint-app");
    if (app) app.dataset.theme = this.theme;
    if (this.globe) this.globe.setTheme(this.theme);
  };

  DomView.prototype.updateSystemTheme = function () {
    if (!this.usesHostTheme) this.applyTheme(this.themeQuery && this.themeQuery.matches ? "dark" : "light");
  };

  DomView.prototype.bindTheme = function () {
    var ui = root.Tapp && root.Tapp.ui;
    this.usesHostTheme = Boolean(ui && (typeof ui.getTheme === "function" || typeof ui.onThemeChange === "function"));
    if (this.usesHostTheme) {
      if (typeof ui.getTheme === "function") {
        try { Promise.resolve(ui.getTheme()).then(this.onThemeChange).catch(function () {}); } catch (_error) {}
      }
      if (typeof ui.onThemeChange === "function") {
        try { this.themeOff = ui.onThemeChange(this.onThemeChange); } catch (_error) {}
      }
    } else if (this.themeQuery && this.themeQuery.addEventListener) {
      this.themeQuery.addEventListener("change", this.onSystemThemeChange);
    }
  };

  DomView.prototype.bindBaseActions = function () {
    var self = this;
    function on(selector, event, handler) { var node = query(selector); if (node) node.addEventListener(event, handler); }
    on("[data-country]", "change", function (event) { self.chooseCountry(event.target.value, true); });
    on("[data-region]", "change", function (event) { self.chooseRegion(event.target.value, true); });
    on("[data-action='zoom-in']", "click", function () { self.zoom(1.16); });
    on("[data-action='zoom-out']", "click", function () { self.zoom(.86); });
    on("[data-action='reset-view']", "click", function () { if (self.globe) self.globe.setView({ centerLon: 18, centerLat: 18, zoom: 1 }); });
    on("[data-action='join-room']", "click", function () { self.joinCampaign(); });
    on("[data-action='submit']", "click", function () { self.submit(); });
    on("[data-action='save-owner']", "click", function () { self.saveOwner(); });
    on("[data-action='remove-owner']", "click", function () { self.removeOwner(); });
    on("[data-action='toggle-admin']", "click", function () { self.openAdmin(); });
    queryAll("[data-action='close-admin']").forEach(function (node) { node.addEventListener("click", function () { self.closeAdmin(); }); });
    on("[data-action='publish']", "click", function () { self.publish(); });
    on("[data-action='reload']", "click", function () { self.reload(); });
    on("[data-action='new-campaign']", "click", function () { self.newCampaign(); });
    on("[data-action='grant']", "click", function () { self.changeModerator(true); });
    on("[data-action='revoke']", "click", function () { self.changeModerator(false); });
  };

  DomView.prototype.ensureGlobe = function (state) {
    var canvas = query("[data-globe]");
    if (!canvas) return;
    if (!this.globe) {
      this.globe = new Core.GlobeController(canvas, {
        dataset: state.dataset,
        markers: state.markers,
        theme: this.theme,
        autoRotate: true,
        reducedMotion: Boolean(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches),
        onSelect: this.onGlobeSelect.bind(this)
      });
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(function () { if (this.globe) this.globe.resize(); }.bind(this));
        this.resizeObserver.observe(canvas);
      }
    } else {
      this.globe.setData(state.dataset);
      this.globe.setMarkers(state.markers);
    }
  };

  DomView.prototype.render = function (state) {
    this.state = state;
    var app = query(".footprint-app"); if (app) app.dataset.mode = state.mode;
    queryAll(".guest-only").forEach(function (node) { node.hidden = state.mode !== "guest"; });
    queryAll(".member-only").forEach(function (node) { node.hidden = state.mode === "guest" || !state.config; });
    queryAll(".admin-only").forEach(function (node) { node.hidden = state.mode !== "admin"; });
    queryAll(".governance-only").forEach(function (node) { node.hidden = state.mode !== "admin" && !state.canModerate; });
    queryAll(".room-owner-only").forEach(function (node) { node.hidden = !state.actor || state.actor !== state.roomOwnerActor; });
    var joinRoom = query("[data-action='join-room']"); if (joinRoom) joinRoom.hidden = state.isRoomMember;
    var submit = query("[data-action='submit']"); if (submit) submit.hidden = !state.isRoomMember;
    var roomFeed = query("[data-room-feed]"); if (roomFeed) roomFeed.hidden = !state.isRoomMember;
    setText("[data-role]", state.mode === "admin"
      ? t("role.admin", "管理员")
      : state.canModerate
        ? t("role.moderator", "审核员")
        : state.mode === "member"
          ? t("role.member", "成员")
          : t("role.guest", "访客"));
    this.ensureGlobe(state);
    this.populateCountries();
    this.populateRegions();
    this.renderSelection();
    this.renderPublic();
    this.renderOwner();
    this.renderFeed();
    this.renderDiagnostics();
    this.renderAdmin();
  };

  DomView.prototype.populateCountries = function () {
    var select = query("[data-country]");
    if (!select || !this.state) return;
    var current = this.selection.countryCode;
    select.textContent = "";
    var placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = t("selection.chooseCountry", "请选择国家或地区"); select.appendChild(placeholder);
    this.state.dataset.countries.slice().sort(function (left, right) { return featureName(left).localeCompare(featureName(right)); }).forEach(function (country) {
      var option = document.createElement("option"); option.value = country.code; option.textContent = featureName(country) + " · " + country.code; select.appendChild(option);
    });
    select.value = current;
  };

  DomView.prototype.populateRegions = function () {
    var select = query("[data-region]");
    if (!select || !this.state) return;
    var current = this.selection.regionCode;
    select.textContent = "";
    var matchingRegions = this.state.dataset.regions.filter(function (region) { return region.countryCode === this.selection.countryCode; }, this);
    var placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = this.selection.countryCode && !matchingRegions.length ? t("selection.regionUnavailable", "该国家仅支持国家层级") : t("selection.countryLevel", "仅国家层级"); select.appendChild(placeholder);
    matchingRegions.sort(function (left, right) { return featureName(left).localeCompare(featureName(right)); }).forEach(function (region) {
      var option = document.createElement("option"); option.value = region.code; option.textContent = featureName(region) + " · " + region.code; select.appendChild(option);
    });
    select.disabled = !this.selection.countryCode || !matchingRegions.length;
    select.value = current;
  };

  DomView.prototype.onGlobeSelect = function (selected) {
    if (selected.regionCode) this.chooseRegion(selected.regionCode, false);
    else this.chooseCountry(selected.countryCode, false);
  };
  DomView.prototype.chooseCountry = function (code, focus) {
    this.selection = { countryCode: code || "", regionCode: "" };
    var select = query("[data-country]"); if (select) select.value = this.selection.countryCode;
    this.populateRegions();
    if (this.globe) this.globe.setHitTarget(code ? "region" : "country", code || "");
    if (focus && code && this.state) { var point = Core.representativePoint(this.state.mapIndex, code); if (point) this.globe.setView({ centerLon: point[0], centerLat: point[1], zoom: 1.42 }); }
    this.renderSelection();
  };
  DomView.prototype.chooseRegion = function (code, focus) {
    this.selection.regionCode = code || "";
    var select = query("[data-region]"); if (select) select.value = this.selection.regionCode;
    if (focus && code && this.state) { var point = Core.representativePoint(this.state.mapIndex, code); if (point) this.globe.setView({ centerLon: point[0], centerLat: point[1], zoom: 1.75 }); }
    this.renderSelection();
  };
  DomView.prototype.selectedFeature = function () {
    if (!this.state) return null;
    return this.selection.regionCode ? this.state.mapIndex.regions.get(this.selection.regionCode) : this.state.mapIndex.countries.get(this.selection.countryCode);
  };
  DomView.prototype.renderSelection = function () {
    var feature = this.selectedFeature();
    setText("[data-selection-name]", feature ? featureName(feature) : t("selection.none", "拖动地球，点击选择"));
    setText("[data-selection-code]", feature ? feature.code : "ISO / GB 2260");
    var submit = query("[data-action='submit']"); if (submit) submit.disabled = !feature || !this.state || !this.state.isRoomMember;
    ["[data-action='save-owner']", "[data-action='remove-owner']"].forEach(function (selector) { var node = query(selector); if (node) node.disabled = !feature; });
    if (this.globe && this.state) this.globe.setMarkers(this.state.markers.map(function (marker) { return Object.assign({}, marker, { selected: Boolean(feature && marker.code === feature.code) }); }));
  };

  DomView.prototype.zoom = function (factor) { if (this.globe) { var view = this.globe.getView(); this.globe.setView({ zoom: view.zoom * factor }); } };
  DomView.prototype.locationLabel = function (item) { var feature = item && this.state && (this.state.mapIndex.regions.get(item.code) || this.state.mapIndex.countries.get(item.code)); return featureName(feature || item); };
  DomView.prototype.empty = function (container, message) { container.textContent = ""; var p = document.createElement("p"); p.className = "empty-state"; p.textContent = message; container.appendChild(p); };
  DomView.prototype.placeRow = function (item, detail, kind) {
    var row = document.createElement("div"); row.className = "place-row";
    var dot = document.createElement("i"); if (kind) dot.className = "legend-dot is-" + kind;
    var name = document.createElement("strong"); name.textContent = this.locationLabel(item);
    var meta = document.createElement("span"); meta.textContent = item.code + (detail ? " · " + detail : "");
    row.append(dot, name, meta); return row;
  };

  DomView.prototype.renderPublic = function () {
    var projection = this.state.publicProjection;
    var valid = projection && (!this.state.config || projection.campaignId === this.state.config.campaignId);
    setText("[data-published]", valid && projection.publishedDate || "—");
    setText("[data-contributors]", valid && projection.totalContributorsBucket || "—");
    var list = query("[data-public-list]"); if (!list) return;
    var places = valid ? (projection.countries || []).concat(projection.regions || []) : [];
    list.textContent = "";
    if (!places.length) return this.empty(list, t("public.empty", "尚未发布满足隐私阈值的聚合。"));
    places.slice(0, 10).forEach(function (item) { list.appendChild(this.placeRow(item, item.countBucket, "visitor")); }, this);
  };

  DomView.prototype.renderOwner = function () {
    var places = (this.state.owner.countries || []).concat(this.state.owner.regions || []);
    setText("[data-owner-count]", places.length);
    var list = query("[data-owner-list]"); if (!list) return;
    list.textContent = "";
    if (!places.length) return this.empty(list, t("owner.empty", "Owner 尚未公开足迹。"));
    places.slice(0, 12).forEach(function (item) { list.appendChild(this.placeRow(item, t("legend." + item.status, item.status), item.status)); }, this);
  };

  DomView.prototype.renderDiagnostics = function () {
    var stats = this.state.replay.stats || {};
    setText("[data-history]", this.state.mode === "guest" ? t("diagnostics.publicOnly", "仅公共投影") : this.state.historyComplete ? t("diagnostics.complete", "完整") : t("diagnostics.incomplete", "不完整，禁止发布"));
    setText("[data-accepted]", this.state.mode === "guest" ? "—" : Number(stats.acceptedSubmissions || 0));
    setText("[data-suppressed]", this.state.publicProjection && this.state.publicProjection.diagnostics ? Number(this.state.publicProjection.diagnostics.suppressedLocations || 0) : "—");
  };

  DomView.prototype.renderFeed = function () {
    if (this.state.mode === "guest") return;
    var self = this;
    var list = query("[data-feed-list]"); if (!list) return;
    list.textContent = "";
    var submissions = (this.state.replay.submissions || []).slice().reverse().slice(0, 12);
    if (!submissions.length) return this.empty(list, t("member.feedEmpty", "当前批次暂无可见投稿。"));
    submissions.forEach(function (item) {
      var row = document.createElement("div"); row.className = "feed-row";
      var copy = document.createElement("div"); var title = document.createElement("strong"); title.textContent = self.locationLabel({ code: item.regionCode || item.countryCode });
      var date = document.createElement("time"); date.textContent = String(item.createdAt || "").slice(0, 10); copy.append(title, date);
      var report = self.actionButton(t("member.report", "举报"), "quiet-button", function () { self.runAction(function () { return self.runtime.report(item.messageId, "other"); }, t("member.reported", "举报已发送。")); });
      row.append(copy, report); list.appendChild(row);
    });
  };

  DomView.prototype.renderAdmin = function () {
    if (this.state.mode !== "admin" && !this.state.canModerate) return;
    setText("[data-campaign]", this.state.config ? this.state.config.campaignId + " · " + this.state.config.roomId : t("admin.noCampaign", "尚未创建批次"));
    setText("[data-history-badge]", this.state.historyComplete ? t("diagnostics.complete", "完整") : t("diagnostics.incompleteShort", "不完整"));
    var publish = query("[data-action='publish']"); if (publish) publish.disabled = !this.state.historyComplete;
    var audit = query("[data-audit-list]"); if (audit) {
      audit.textContent = ""; setText("[data-audit-count]", this.state.replay.audit.length);
      if (!this.state.replay.audit.length) this.empty(audit, t("admin.auditEmpty", "当前批次暂无有效投稿。"));
      this.state.replay.audit.slice().reverse().slice(0, 100).forEach(function (item) { audit.appendChild(this.auditRow(item)); }, this);
      (this.state.replay.reports || []).filter(function (report) { return !report.resolved; }).forEach(function (report) { audit.appendChild(this.reportRow(report)); }, this);
    }
    var members = query("[data-member-list]"); if (members) {
      members.textContent = ""; setText("[data-member-count]", this.state.members.length);
      if (!this.state.members.length) this.empty(members, t("admin.membersEmpty", "成员列表为空或暂不可用。"));
      this.state.members.forEach(function (member) { members.appendChild(this.memberRow(member)); }, this);
    }
  };

  DomView.prototype.actionButton = function (label, className, action) { var button = document.createElement("button"); button.type = "button"; button.className = className; button.textContent = label; button.addEventListener("click", action); return button; };
  DomView.prototype.auditRow = function (item) {
    var self = this; var row = document.createElement("article"); row.className = "admin-row";
    var main = document.createElement("div"); main.className = "admin-row-main"; var title = document.createElement("strong"); title.textContent = this.locationLabel({ code: item.regionCode || item.countryCode });
    var meta = document.createElement("span"); meta.textContent = item.senderActor + " · " + item.messageId + (item.hidden ? " · " + t("admin.hiddenState", "已隐藏") : "") + (item.blocked ? " · " + t("admin.blockedState", "已封禁") : ""); main.append(title, meta);
    var actions = document.createElement("div"); actions.className = "admin-row-actions";
    if (this.state.canModerate) {
      actions.appendChild(this.actionButton(item.hidden ? t("admin.restore", "恢复") : t("admin.hide", "隐藏"), item.hidden ? "quiet-button" : "danger-button", function () {
        self.runAction(function () { return self.runtime.sendGovernance(item.hidden ? Core.KINDS.restore : Core.KINDS.hide, item.hidden ? { targetMessageId: item.messageId } : { targetMessageId: item.messageId, reason: "manual_review" }); });
      }));
      actions.appendChild(this.actionButton(item.blocked ? t("admin.unblock", "解封") : t("admin.block", "封禁"), "quiet-button", function () {
        self.runAction(function () { return self.runtime.sendGovernance(item.blocked ? Core.KINDS.unblock : Core.KINDS.block, { targetActor: item.senderActor }); });
      }));
    }
    row.append(main, actions); return row;
  };
  DomView.prototype.reportRow = function (report) {
    var self = this; var row = document.createElement("article"); row.className = "admin-row";
    var main = document.createElement("div"); main.className = "admin-row-main"; var title = document.createElement("strong"); title.textContent = t("admin.pendingReport", "待审举报") + " · " + report.reason; var meta = document.createElement("span"); meta.textContent = report.senderActor + " → " + report.targetMessageId; main.append(title, meta);
    var actions = document.createElement("div"); actions.className = "admin-row-actions"; if (this.state.canModerate) actions.appendChild(this.actionButton(t("admin.resolve", "标记已审"), "quiet-button", function () { self.runAction(function () { return self.runtime.sendGovernance(Core.KINDS.resolveReport, { reportMessageId: report.messageId, resolution: "reviewed" }); }); })); row.append(main, actions); return row;
  };
  DomView.prototype.memberRow = function (member) {
    var self = this; var actor = memberActor(member); var row = document.createElement("article"); row.className = "admin-row";
    var main = document.createElement("div"); main.className = "admin-row-main"; var title = document.createElement("strong"); title.textContent = member.display_name || member.displayName || member.name || t("admin.member", "成员"); var meta = document.createElement("span"); meta.textContent = actor || "—"; main.append(title, meta);
    var actions = document.createElement("div"); actions.className = "admin-row-actions";
    if (this.state.canModerate && actor && actor !== this.state.actor && actor !== this.state.roomOwnerActor) {
      var canRemove = this.runtime && this.runtime.hasPermission("federation:room");
      actions.appendChild(this.actionButton(canRemove ? t("admin.blockRemove", "封禁并移出") : t("admin.block", "封禁"), "danger-button", function () {
        self.runAction(async function () {
          await self.runtime.sendGovernance(Core.KINDS.block, { targetActor: actor });
          if (canRemove) await self.runtime.removeMember(actor);
        });
      }));
    }
    row.append(main, actions); return row;
  };

  DomView.prototype.submit = function () { var self = this; if (!this.runtime || !this.selection.countryCode) return; this.runAction(function () { return self.runtime.submit(self.selection.countryCode, self.selection.regionCode || undefined); }, t("member.sent", "投稿已发送；服务端信封确认后会进入重放。")); };
  DomView.prototype.joinCampaign = function () { var self = this; if (!this.runtime) return; this.runAction(function () { return self.runtime.joinCampaign(); }, t("member.joined", "已加入专用 Room。")); };
  DomView.prototype.ownerValueWith = function (remove) {
    var next = { v: 1, countries: this.state.owner.countries.slice(), regions: this.state.owner.regions.slice() };
    var regionCode = this.selection.regionCode; var countryCode = this.selection.countryCode; var statusNode = query("input[name='owner-status']:checked"); var status = statusNode ? statusNode.value : "travel";
    if (regionCode) { next.regions = next.regions.filter(function (item) { return item.code !== regionCode; }); if (!remove) next.regions.push({ code: regionCode, countryCode: countryCode, status: status }); }
    else { next.countries = next.countries.filter(function (item) { return item.code !== countryCode; }); if (!remove) next.countries.push({ code: countryCode, status: status }); }
    return next;
  };
  DomView.prototype.saveOwner = function () { var self = this; this.runAction(function () { return self.runtime.saveOwner(self.ownerValueWith(false)); }, t("owner.saved", "公开足迹已保存。")); };
  DomView.prototype.removeOwner = function () { var self = this; this.runAction(function () { return self.runtime.saveOwner(self.ownerValueWith(true)); }, t("owner.removed", "所选足迹已移除。")); };
  DomView.prototype.publish = function () { var self = this; this.runAction(function () { return self.runtime.publishProjection(); }, t("admin.published", "匿名聚合已发布。")); };
  DomView.prototype.reload = function () { var self = this; this.runAction(function () { return self.runtime.refresh(); }, t("admin.reloaded", "历史已重新读取。")); };
  DomView.prototype.newCampaign = async function () {
    if (!this.runtime) return;
    var confirmed = false;
    try { confirmed = await root.Tapp.ui.confirm(t("admin.confirmCampaign", "创建新的公开 Room 并切换活动批次？旧事件不会删除。")); } catch (_error) {}
    if (!confirmed) return;
    var self = this; this.runAction(function () { return self.runtime.createCampaign(); }, t("admin.campaignCreated", "新批次已创建。"));
  };
  DomView.prototype.changeModerator = function (grant) { var actor = query("[data-moderator-actor]").value; var self = this; this.runAction(function () { return self.runtime.sendGovernance(grant ? Core.KINDS.moderatorGrant : Core.KINDS.moderatorRevoke, { targetActor: actor }); }, t(grant ? "admin.granted" : "admin.revoked", grant ? "授权事件已发送。" : "撤销事件已发送。")); };
  DomView.prototype.runAction = async function (action, success) { try { await action(); if (success) this.toast(success, false); } catch (error) { this.toast(error.message || String(error), true); } };
  DomView.prototype.openAdmin = function () {
    var drawer = query("[data-admin-drawer]");
    if (!drawer || !this.state || this.state.mode !== "admin" && !this.state.canModerate) return;
    this.dialogReturnFocus = document.activeElement;
    drawer.hidden = false;
    if (document.addEventListener) document.addEventListener("keydown", this.onDialogKeyDown);
    var button = drawer.querySelector("button"); if (button) button.focus();
  };
  DomView.prototype.closeAdmin = function (restoreFocus) {
    var drawer = query("[data-admin-drawer]");
    if (drawer) drawer.hidden = true;
    if (document.removeEventListener) document.removeEventListener("keydown", this.onDialogKeyDown);
    if (restoreFocus !== false && this.dialogReturnFocus && typeof this.dialogReturnFocus.focus === "function") this.dialogReturnFocus.focus();
    this.dialogReturnFocus = null;
  };
  DomView.prototype.handleDialogKeyDown = function (event) {
    var drawer = query("[data-admin-drawer]");
    if (!drawer || drawer.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); this.closeAdmin(); return; }
    if (event.key !== "Tab" || !drawer.querySelectorAll) return;
    var focusable = Array.from(drawer.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])")).filter(function (node) { return !node.hidden && (!node.closest || !node.closest("[hidden]")); });
    if (!focusable.length) return;
    var first = focusable[0]; var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  DomView.prototype.toast = function (message, isError) { var region = query("[data-toast-region]"); if (!region) return; var node = document.createElement("div"); node.className = "toast" + (isError ? " is-error" : ""); node.textContent = message; region.appendChild(node); setTimeout(function () { node.remove(); }, 5000); };
  DomView.prototype.pause = function () { if (this.globe) this.globe.pause(); };
  DomView.prototype.resume = function () { if (this.globe) this.globe.resume(); };
  DomView.prototype.destroy = function () { this.closeAdmin(false); if (this.globe) this.globe.destroy(); this.globe = null; if (this.resizeObserver) this.resizeObserver.disconnect(); if (typeof this.themeOff === "function") { try { this.themeOff(); } catch (_error) {} } this.themeOff = null; if (this.themeQuery && this.themeQuery.removeEventListener) this.themeQuery.removeEventListener("change", this.onSystemThemeChange); };

  root.FootprintEarthDomView = DomView;
})(globalThis);
