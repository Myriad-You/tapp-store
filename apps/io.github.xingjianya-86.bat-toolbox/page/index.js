/**
 * 银河球棒侠 · 页面层
 */

const core = require("../core.js");
const qrcode = require("./qrcode.js");
const ui = core.ui;

const t = ui.t;
const el = ui.el;
const setText = ui.setText;
const setImage = ui.setImage;
const sortAvatars = ui.sortAvatars;
const pickRole = ui.pickRole;
const pickIndex = ui.pickIndex;
const pickNote = ui.pickNote;
const pickBbsUser = ui.pickBbsUser;
const pickMoc = ui.pickMoc;
const pickFiction = ui.pickFiction;
const pickApocalyptic = ui.pickApocalyptic;
const charTile = ui.charTile;

const ENDGAME_TABS = ["moc", "fiction", "apocalyptic"];

const state = {
  role: "guest",
  settings: { uid: "", server: "prod_gf_cn" },
  auth: null,
  cache: null,
  schedule: "1",
  tab: "moc",
  qrRunning: false,
  busy: false,
};

const refs = {};
let toastTimer = 0;

function collectRefs() {
  const map = {
    app: "[data-gt-app]",
    roleBadge: "[data-gt-role-badge]",
    title: "[data-gt-title]",
    subtitle: "[data-gt-subtitle]",
    meta: "[data-gt-meta]",
    gameAvatar: "[data-gt-game-avatar]",
    avatarFallback: "[data-gt-avatar-fallback]",
    bbsAvatar: "[data-gt-bbs-avatar]",
    refresh: "[data-gt-refresh]",
    bind: "[data-gt-bind]",
    alert: "[data-gt-alert]",
    stamina: "[data-gt-stamina]",
    staminaMax: "[data-gt-stamina-max]",
    staminaBar: "[data-gt-stamina-bar]",
    staminaTime: "[data-gt-stamina-time]",
    reserve: "[data-gt-reserve]",
    reserveFoot: "[data-gt-reserve-foot]",
    train: "[data-gt-train]",
    trainFoot: "[data-gt-train-foot]",
    expedition: "[data-gt-expedition]",
    expeditionFoot: "[data-gt-expedition-foot]",
    cocoon: "[data-gt-cocoon]",
    cocoonFoot: "[data-gt-cocoon-foot]",
    rogue: "[data-gt-rogue]",
    rogueFoot: "[data-gt-rogue-foot]",
    stats: "[data-gt-stats]",
    chars: "[data-gt-chars]",
    charCount: "[data-gt-char-count]",
    tabMoc: "[data-gt-tab-moc]",
    tabFiction: "[data-gt-tab-fiction]",
    tabApocalyptic: "[data-gt-tab-apocalyptic]",
    panelMoc: "[data-gt-panel='moc']",
    panelFiction: "[data-gt-panel='fiction']",
    panelApocalyptic: "[data-gt-panel='apocalyptic']",
    scheduleCurrent: "[data-gt-schedule-current]",
    schedulePrevious: "[data-gt-schedule-previous]",
    moc: "[data-gt-moc]",
    fiction: "[data-gt-fiction]",
    apocalyptic: "[data-gt-apocalyptic]",
    admin: "[data-gt-admin]",
    adminNote: "[data-gt-admin-note]",
    configUid: "[data-gt-config-uid]",
    configServer: "[data-gt-config-server]",
    configDevice: "[data-gt-config-device]",
    saveSettings: "[data-gt-save-settings]",
    devicePreview: "[data-gt-device-preview]",
    cookie: "[data-gt-cookie]",
    saveCookie: "[data-gt-save-cookie]",
    clearAuth: "[data-gt-clear-auth]",
    footer: "[data-gt-footer]",
    qrDialog: "[data-gt-qr-dialog]",
    qrTitle: "[data-gt-qr-title]",
    qrCanvas: "[data-gt-qr-canvas]",
    qrState: "[data-gt-qr-state]",
    qrTip: "[data-gt-qr-tip]",
    qrCancel: "[data-gt-qr-cancel]",
    toast: "[data-gt-toast]",
    debug: "[data-gt-debug]",
    debugRole: "[data-gt-debug-role]",
    debugInfo: "[data-gt-debug-info]",
    debugRun: "[data-gt-debug-run]",
    debugSync: "[data-gt-debug-sync]",
    debugImage: "[data-gt-debug-image]",
    debugCopy: "[data-gt-debug-copy]",
    debugClear: "[data-gt-debug-clear]",
    debugOutput: "[data-gt-debug-output]",
  };
  Object.keys(map).forEach(function (key) {
    refs[key] = document.querySelector(map[key]);
  });
}

function bindStaticText() {
  setText(refs.title, t("app.title"));
  setText(refs.subtitle, t("app.subtitle"));
  setText(refs.refresh, t("app.refresh"));
  setText(refs.bind, t("app.bind"));
  setText(refs.tabMoc, t("app.tab.moc"));
  setText(refs.tabFiction, t("app.tab.fiction"));
  setText(refs.tabApocalyptic, t("app.tab.apocalyptic"));
  setText(refs.scheduleCurrent, t("app.endgame.current"));
  setText(refs.schedulePrevious, t("app.endgame.previous"));
  setText(document.querySelector("[data-gt-label-stamina]"), t("app.label.stamina"));
  setText(document.querySelector("[data-gt-label-reserve]"), t("app.label.reserve"));
  setText(document.querySelector("[data-gt-label-train]"), t("app.label.train"));
  setText(document.querySelector("[data-gt-label-expedition]"), t("app.label.expedition"));
  setText(document.querySelector("[data-gt-label-cocoon]"), t("app.label.cocoon"));
  setText(document.querySelector("[data-gt-label-rogue]"), t("app.label.rogue"));
  setText(document.querySelector("[data-gt-label-stats]"), t("app.label.stats"));
  setText(document.querySelector("[data-gt-label-chars]"), t("app.label.chars"));
  setText(document.querySelector("[data-gt-label-endgame]"), t("app.label.endgame"));
  setText(document.querySelector("[data-gt-label-admin]"), t("app.label.admin"));
  setText(document.querySelector("[data-gt-label-uid]"), t("app.admin.uid"));
  setText(document.querySelector("[data-gt-label-server]"), t("app.admin.server"));
  setText(document.querySelector("[data-gt-label-device]"), t("app.admin.device"));
  setText(document.querySelector("[data-gt-label-cookie]"), t("app.admin.cookie"));
  setText(refs.saveSettings, t("app.admin.saveSettings"));
  setText(refs.saveCookie, t("app.admin.saveCookie"));
  setText(refs.clearAuth, t("app.admin.clearAuth"));
  setText(refs.adminNote, t("app.admin.note"));
  setText(refs.qrTitle, t("app.qr.title"));
  setText(refs.qrTip, t("app.qr.tip"));
  setText(refs.qrCancel, t("app.cancel"));
  setText(document.querySelector("[data-gt-label-debug]"), t("app.label.debug"));
  setText(refs.debugRun, t("app.debug.run"));
  setText(refs.debugSync, t("app.debug.sync"));
  setText(refs.debugImage, t("app.debug.image"));
  setText(refs.debugCopy, t("app.debug.copy"));
  setText(refs.debugClear, t("app.debug.clear"));
  if (refs.debugOutput && !refs.debugOutput.value) {
    refs.debugOutput.value = t("app.debug.ready");
  }
}

function roleLabel() {
  if (state.role === "admin") return t("app.role.admin");
  if (state.role === "user") return t("app.role.member");
  return t("app.role.guest");
}

function toast(text) {
  if (!refs.toast) return;
  if (refs.qrDialog && refs.qrDialog.open && refs.toast.parentElement !== refs.qrDialog) {
    refs.qrDialog.appendChild(refs.toast);
  } else if (!refs.qrDialog || !refs.qrDialog.open) {
    if (refs.toast.parentElement !== document.body) document.body.appendChild(refs.toast);
  }
  refs.toast.textContent = text;
  refs.toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    if (refs.toast) refs.toast.hidden = true;
  }, 2400);
}

function avatarImg(url, className, fallbackText, color) {
  return ui.avatarNode(url, {
    wrapClass: "gt-team-member",
    imgClass: className || "gt-team-avatar",
    fallbackClass: "gt-team-avatar-fallback",
    fallbackText: fallbackText,
    color: color,
  });
}

/* ---------- 渲染 ---------- */

function renderProfile() {
  setText(refs.roleBadge, roleLabel());
  if (refs.roleBadge) refs.roleBadge.dataset.role = state.role;
  const role = pickRole(state.cache);
  const bbsUser = pickBbsUser(state.cache);

  setImage(refs.gameAvatar, refs.avatarFallback, core.headIcon(state.cache), "★", "");
  if (refs.avatarFallback) refs.avatarFallback.style.background = "";
  setImage(refs.bbsAvatar, null, bbsUser && bbsUser.avatar_url ? bbsUser.avatar_url : "", "", "");

  if (role) {
    setText(refs.subtitle, (role.nickname || "") + " · Lv." + (role.level || 0));
  } else if (state.auth && state.auth.uid) {
    setText(refs.subtitle, t("app.profile.bound", { uid: state.auth.uid }));
  } else {
    setText(refs.subtitle, t("app.subtitle"));
  }

  const parts = [];
  const effectiveUid = state.settings.uid || (state.cache && state.cache.uid ? String(state.cache.uid) : "");
  const effectiveServer = state.settings.server || (state.cache && state.cache.server ? String(state.cache.server) : "prod_gf_cn");
  if (effectiveUid) parts.push("UID " + effectiveUid);
  parts.push(serverLabel(effectiveServer));
  if (state.cache && state.cache.at) {
    parts.push(t("app.updatedAt", { time: new Date(state.cache.at).toLocaleString() }));
  }
  setText(refs.meta, parts.join(" · "));
}

function serverLabel(server) {
  return t(core.serverLabelKey(server));
}

function renderCards() {
  const note = pickNote(state.cache);
  if (note) {
    setText(refs.stamina, note.current_stamina);
    setText(refs.staminaMax, "/ " + note.max_stamina);
    const percent = note.max_stamina ? Math.min(100, Math.round((note.current_stamina / note.max_stamina) * 100)) : 0;
    if (refs.staminaBar) refs.staminaBar.style.width = percent + "%";
    setText(refs.staminaTime, t("app.stamina.recover", { time: core.formatDuration(note.stamina_recover_time) }));
    setText(refs.reserve, note.current_reserve_stamina);
    setText(refs.reserveFoot, note.is_reserve_stamina_full ? t("app.reserve.full") : t("app.reserve.saving"));
    setText(refs.train, note.current_train_score + " / " + note.max_train_score);
    setText(refs.trainFoot, note.current_train_score >= note.max_train_score ? t("app.train.done") : t("app.train.todo"));
    setText(refs.expedition, note.accepted_epedition_num + " / " + note.total_expedition_num);
    setText(refs.expeditionFoot, expeditionText(note));
    setText(refs.cocoon, note.weekly_cocoon_cnt + " / " + note.weekly_cocoon_limit);
    setText(refs.cocoonFoot, t("app.cocoon.foot"));
    setText(refs.rogue, (note.period_score != null ? note.period_score : note.current_rogue_score || 0) + " / " + (note.period_max_score != null ? note.period_max_score : note.max_rogue_score || 0));
    setText(refs.rogueFoot, t("app.rogue.foot", {
      score: note.rogue_tourn_weekly_cur || 0,
      max: note.rogue_tourn_weekly_max || 0,
    }));
  } else {
    setText(refs.stamina, "--");
    setText(refs.staminaMax, "");
    setText(refs.staminaTime, "");
    setText(refs.reserve, "--");
    setText(refs.reserveFoot, "");
    setText(refs.train, "--");
    setText(refs.trainFoot, "");
    setText(refs.expedition, "--");
    setText(refs.expeditionFoot, "");
    setText(refs.cocoon, "--");
    setText(refs.cocoonFoot, "");
    setText(refs.rogue, "--");
    setText(refs.rogueFoot, "");
  }

  const index = pickIndex(state.cache);
  const stats = index && index.stats ? index.stats : null;
  if (stats) {
    setText(refs.stats, t("app.stats.text", {
      days: stats.active_days,
      achievements: stats.achievement_num,
      chars: stats.avatar_num,
      chests: stats.chest_num,
      abyss: stats.abyss_process || "-",
    }));
  } else {
    setText(refs.stats, t("app.alert.noData"));
  }
}

function expeditionText(note) {
  const list = Array.isArray(note.expeditions) ? note.expeditions : [];
  if (!list.length) return "";
  const ongoing = list.filter(function (item) {
    return item && item.status === "Ongoing";
  }).length;
  if (!ongoing) return t("app.expedition.done");
  return t("app.expedition.ongoing", { count: ongoing });
}

function renderChars() {
  if (!refs.chars) return;
  refs.chars.replaceChildren();
  const avatars = ui.pickIndexAvatars(state.cache);
  setText(refs.charCount, avatars.length ? t("app.chars.count", { count: avatars.length }) : "");
  sortAvatars(avatars, 16).forEach(function (avatar) {
    const card = charTile(avatar, {
      withLabels: true,
      meta: t("app.charMeta", { level: avatar.level || 0, rank: avatar.rank || 0 }),
    });
    if (avatar.name) {
      card.classList.add("is-clickable");
      card.addEventListener("click", function () {
        core.openCharacter(avatar.name);
      });
    }
    refs.chars.appendChild(card);
  });
  if (!avatars.length) {
    refs.chars.appendChild(el("p", "gt-empty", t("app.alert.noData")));
  }
}

function nodeTeamLabel(index, count) {
  if (count >= 3) return [t("app.endgame.nodeUp"), t("app.endgame.nodeMid"), t("app.endgame.nodeDown")][index] || String(index + 1);
  return index === 0 ? t("app.endgame.nodeUp") : t("app.endgame.nodeDown");
}

function renderEndgameInfo(container, info, mode) {
  if (!container) return;
  container.replaceChildren();
  const floors = info && Array.isArray(info.all_floor_detail) ? info.all_floor_detail.slice() : [];
  const stars = info ? Number(info.star_num) || 0 : 0;
  if (!info || (!floors.length && !stars)) {
    container.appendChild(el("p", "gt-empty", t("app.endgame.empty")));
    return;
  }

  const meta = info.groups && info.groups.length ? info.groups[0] : null;
  const metaName = meta ? meta.name || meta.name_mi18n || "" : "";
  const summary = el("div", "gt-summary");
  const parts = [t("app.endgame.summary", {
    stars: stars,
    floor: info.max_floor || "-",
    battles: info.battle_num || 0,
  })];
  if (metaName) parts.push(metaName);
  summary.appendChild(el("span", "", parts.join(" · ")));
  container.appendChild(summary);

  const lastFloor = ui.endgameLastFloor(info);
  const shown = lastFloor ? [lastFloor] : [];
  shown.forEach(function (floor) {
    if (!floor) return;
    const floorStars = Number(floor.star_num) || 0;
    const extraStars = ui.floorExtraStars(floor);
    const floorName = ui.floorDisplayName(floor.name) || "-";
    const box = el("div", "gt-floor");
    const head = el("button", "gt-floor-head");
    head.type = "button";
    head.appendChild(el("span", "", /^\d+$/.test(floorName) ? t("app.endgame.floor", { name: floorName }) : floorName));
    head.appendChild(el("span", "gt-floor-stars",
      "★".repeat(Math.min(3, floorStars)) + "☆".repeat(Math.max(0, 3 - floorStars)) + (extraStars > 0 ? " +" + extraStars : "")));
    box.appendChild(head);
    const body = el("div", "gt-floor-body");
    const nodes = ui.endgameNodes(floor);
    nodes.forEach(function (node, nodeIndex) {
      const chamber = el("div", "gt-chamber");
      let title = t("app.endgame.round", { round: floor.round_num || 1 }) + " · " + nodeTeamLabel(nodeIndex, nodes.length);
      if (node.score != null && node.score !== "") {
        title += " · " + t("app.endgame.score", { score: node.score });
      }
      chamber.appendChild(el("div", "gt-chamber-head", title));
      const team = el("div", "gt-team");
      (node.avatars || []).forEach(function (member) {
        team.appendChild(avatarImg(member.icon || member.image, "gt-team-avatar", String(member.level || ""), ""));
      });
      chamber.appendChild(team);
      const time = core.formatChallengeTime(node.challenge_time);
      if (time) chamber.appendChild(el("div", "gt-round-meta", t("app.endgame.time", { time: time })));
      body.appendChild(chamber);
    });
    box.appendChild(body);
    body.hidden = false;
    head.addEventListener("click", function () {
      body.hidden = !body.hidden;
    });
    container.appendChild(box);
  });
}

function renderEndgame() {
  renderEndgameInfo(refs.moc, pickMoc(state.cache, state.schedule), "moc");
  renderEndgameInfo(refs.fiction, pickFiction(state.cache), "fiction");
  renderEndgameInfo(refs.apocalyptic, pickApocalyptic(state.cache), "apocalyptic");
}

function renderAlert() {
  if (!refs.alert) return;
  let text = "";
  let kind = "warn";
  const errors = state.cache && state.cache.errors ? state.cache.errors : {};
  const errorValues = Object.keys(errors).map(function (key) {
    return errors[key];
  });
  if (state.role !== "admin") {
    if (!state.cache) {
      text = t("app.alert.noData");
      kind = "info";
    }
  } else if (!state.settings.uid) {
    text = t("app.alert.noUid");
  } else if (!state.auth || !state.auth.cookie) {
    text = t("app.alert.noAuth");
  } else if (state.cache && state.cache.riskUntil && Date.now() < state.cache.riskUntil) {
    text = t("app.alert.riskTime", { time: cooldownText(state.cache.riskUntil) });
  } else if (errorValues.some(isRiskCode)) {
    text = t("app.alert.risk");
  } else if (errorValues.indexOf(-100) >= 0 || errorValues.indexOf(-101) >= 0) {
    text = t("app.alert.cookieInvalid");
  } else if (errorValues.indexOf(10001) >= 0) {
    text = t("app.alert.ltoken");
  } else if (errorValues.indexOf("NETWORK") >= 0) {
    text = t("app.alert.network");
  }
  refs.alert.hidden = !text;
  refs.alert.dataset.state = kind;
  setText(refs.alert, text);
}

function renderAdmin() {
  if (refs.admin) refs.admin.hidden = state.role !== "admin";
  if (refs.debug) refs.debug.hidden = state.role !== "admin";
  if (refs.refresh) refs.refresh.hidden = state.role !== "admin";
  if (refs.bind) refs.bind.hidden = state.role !== "admin";
  renderDebugInfo();
  if (state.role === "admin") {
    if (refs.configUid && document.activeElement !== refs.configUid) refs.configUid.value = state.settings.uid || "";
    if (refs.configServer && document.activeElement !== refs.configServer) refs.configServer.value = state.settings.server || "prod_gf_cn";
    if (refs.configDevice && document.activeElement !== refs.configDevice) refs.configDevice.value = state.settings.deviceInfo || "";
    if (refs.devicePreview) {
      const profile = core.parseDeviceInfo(state.settings.deviceInfo || "");
      setText(refs.devicePreview, t("app.admin.devicePreview", {
        model: profile.deviceModel,
        version: profile.androidVersion,
        name: profile.deviceName,
        board: profile.deviceBoard,
        product: profile.deviceProduct,
        oaid: profile.oaid,
      }));
    }
  }
  if (refs.cookie && state.role === "admin" && document.activeElement !== refs.cookie) {
    refs.cookie.value = state.auth && state.auth.cookie ? state.auth.cookie : "";
  }
  if (refs.footer) {
    let version = "";
    try {
      const info = Tapp.lifecycle && typeof Tapp.lifecycle.getInfo === "function" ? Tapp.lifecycle.getInfo() : null;
      if (info && info.version) version = " · v" + info.version;
    } catch (err) {
      version = "";
    }
    setText(refs.footer, t("app.footer") + version);
  }
}

function renderTabs() {
  const tabRefs = { moc: refs.tabMoc, fiction: refs.tabFiction, apocalyptic: refs.tabApocalyptic };
  const panelRefs = { moc: refs.panelMoc, fiction: refs.panelFiction, apocalyptic: refs.panelApocalyptic };
  ENDGAME_TABS.forEach(function (name) {
    const tab = tabRefs[name];
    const panel = panelRefs[name];
    const active = state.tab === name;
    if (tab) {
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    }
    if (panel) panel.hidden = !active;
  });
  if (refs.scheduleCurrent) refs.scheduleCurrent.classList.toggle("is-active", state.schedule === "1");
  if (refs.schedulePrevious) refs.schedulePrevious.classList.toggle("is-active", state.schedule === "2");
}

function renderAll() {
  renderProfile();
  renderCards();
  renderChars();
  renderTabs();
  renderEndgame();
  renderAlert();
  renderAdmin();
}

/* ---------- 调试 ---------- */

function debugInfoText() {
  const lines = [];
  lines.push("role: " + state.role);
  lines.push("settings: uid=" + (state.settings.uid || "-") + " server=" + (state.settings.server || "-"));
  if (state.auth) {
    lines.push(
      "auth: source=" + (state.auth.source || "-") +
      " uid=" + (state.auth.uid || "-") +
      " tokenTypes=" + JSON.stringify(state.auth.tokenTypes || null) +
      " cookieLen=" + String(state.auth.cookie || "").length +
      " cookieKeys=" + JSON.stringify(core.cookieKeys(state.auth.cookie)) +
      " cookie=" + core.maskCookie(state.auth.cookie)
    );
  } else {
    lines.push("auth: none");
  }
  if (state.cache) {
    const sections = ["dailyNote", "playerIndex", "roleInfo", "bbsUser", "mocCurrent", "mocPrevious", "fiction", "apocalyptic"].filter(function (key) {
      return state.cache[key] !== undefined;
    });
    lines.push(
      "cache: at=" + (state.cache.at ? new Date(state.cache.at).toISOString() : "-") +
      " endgameAt=" + (state.cache.endgameAt ? new Date(state.cache.endgameAt).toISOString() : "-") +
      " sections=" + JSON.stringify(sections)
    );
    lines.push("errors: " + JSON.stringify(state.cache.errors || {}));
    [["mocCurrent", "moc"], ["mocPrevious", "moc-prev"], ["fiction", "fiction"], ["apocalyptic", "apocalyptic"]].forEach(function (pair) {
      const info = state.cache[pair[0]];
      if (!info || typeof info !== "object") return;
      const floors = Array.isArray(info.all_floor_detail) ? info.all_floor_detail : [];
      const picked = core.ui.endgameLastFloor(info);
      lines.push(
        pair[1] + ": max_floor=" + (info.max_floor || "-") +
        " max_floor_id=" + (info.max_floor_id != null ? info.max_floor_id : "-") +
        " picked=" + (picked && picked.name ? picked.name : "-") +
        " floors=" + JSON.stringify(floors.map(function (floor) {
          if (!floor) return null;
          return {
            name: floor.name,
            maze_id: floor.maze_id,
            tierce: floor.is_tierce === true || floor.is_tierce === "true",
            star: floor.star_num,
            extra: floor.extra_star_num,
          };
        }))
      );
    });
  } else {
    lines.push("cache: none");
  }
  return lines.join("\n");
}

function renderDebugInfo() {
  if (refs.debugRole) setText(refs.debugRole, state.role);
  if (refs.debugInfo) setText(refs.debugInfo, state.role === "admin" ? debugInfoText() : "");
}

async function runDebug() {
  if (state.role !== "admin" || state.busy) return;
  state.busy = true;
  if (refs.debugRun) refs.debugRun.disabled = true;
  if (refs.debugOutput) refs.debugOutput.value = t("app.debug.running");
  try {
    const result = await core.debugRun();
    if (refs.debugOutput) refs.debugOutput.value = JSON.stringify(result, null, 2).slice(0, 20000);
    renderDebugInfo();
  } catch (err) {
    if (refs.debugOutput) refs.debugOutput.value = String((err && err.message) || err);
  } finally {
    state.busy = false;
    if (refs.debugRun) refs.debugRun.disabled = false;
  }
}

async function copyDebug() {
  const text = [debugInfoText(), refs.debugOutput ? refs.debugOutput.value : ""].join("\n\n");
  const ok = await core.copyText(text);
  toast(ok ? t("app.debug.copied") : t("app.debug.copyFail"));
}

async function runSyncNow() {
  if (state.role !== "admin") return;
  const res = await core.triggerSync();
  toast(res && res.ok ? t("app.debug.syncOk") : t("app.debug.syncFail"));
}

async function runImageTest() {
  if (state.role !== "admin") return;
  if (refs.debugOutput) refs.debugOutput.value = t("app.debug.running");
  const res = await core.testAvatar();
  if (refs.debugOutput) refs.debugOutput.value = JSON.stringify(res, null, 2);
  renderDebugInfo();
}

async function clearDebugCache() {
  if (state.role !== "admin") return;
  await core.clearCache();
  state.cache = await core.loadData();
  renderAll();
  toast(t("app.debug.cleared"));
}

/* ---------- 数据 ---------- */

async function loadState() {
  state.role = await core.getRole();
  state.settings = await core.readSettings();
  state.auth = await core.getAuth();
  state.cache = await core.loadData();
}

function cooldownText(until) {
  const seconds = Math.max(0, Math.ceil((Number(until) - Date.now()) / 1000));
  return core.formatDuration(seconds);
}

function isRiskCode(code) {
  return code === 10035 || code === 5003 || code === 10041 || code === 1034 || code === 10104;
}

async function doRefresh(force) {
  if (state.busy || state.role !== "admin") return;
  state.busy = true;
  if (refs.refresh) refs.refresh.disabled = true;
  toast(t("app.toast.refreshing"));
  try {
    const res = await core.refresh(force !== false);
    state.cache = res && res.cache ? res.cache : await core.loadData();
    renderAll();
    const riskUntil = (res && res.riskUntil) || (state.cache && state.cache.riskUntil);
    if (res && res.error === "RISK_COOLDOWN") {
      toast(t("app.toast.riskCooldown", { time: cooldownText(res.riskUntil) }));
    } else if (riskUntil && Date.now() < riskUntil) {
      toast(t("app.toast.riskHit"));
    } else if (res && res.error) {
      toast(t("app.toast.refreshFail"));
    } else {
      toast(t("app.toast.refreshed"));
    }
  } catch (err) {
    toast(t("app.toast.refreshFail"));
  } finally {
    state.busy = false;
    if (refs.refresh) refs.refresh.disabled = false;
  }
}

/* ---------- 扫码登录 ---------- */

function drawQr(canvas, url) {
  if (!canvas) return;
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  const size = canvas.width;
  const cell = Math.max(2, Math.floor(size / (count + 8)));
  const offset = Math.floor((size - cell * count) / 2);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#1f2430";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(offset + col * cell, offset + row * cell, cell, cell);
      }
    }
  }
}

function setQrState(text, stateName) {
  if (!refs.qrState) return;
  setText(refs.qrState, text);
  refs.qrState.dataset.state = stateName || "";
}

async function runBind(login) {
  if (state.qrRunning || state.role !== "admin") return;
  if (!refs.qrDialog) return;
  state.qrRunning = true;
  refs.qrDialog.showModal();
  setQrState(t("app.qr.starting"), "");
  try {
    await login(function (status) {
      if (status.state === "waiting" && status.url) {
        drawQr(refs.qrCanvas, status.url);
        setQrState(t("app.qr.waiting"), "");
      } else if (status.state === "scanned") {
        setQrState(t("app.qr.scanned"), "scanned");
      }
    });
    setQrState(t("app.qr.confirmed"), "scanned");
    state.auth = await core.getAuth();
    toast(t("app.qr.confirmed"));
    setTimeout(function () {
      if (refs.qrDialog && refs.qrDialog.open) refs.qrDialog.close();
    }, 900);
    const verify = await core.verifyAuth();
    state.cache = await core.loadData();
    renderAll();
    if (verify && verify.error !== undefined) {
      if (verify.error === "RISK_COOLDOWN") {
        toast(t("app.toast.riskCooldown", { time: cooldownText(verify.riskUntil) }));
      } else if (isRiskCode(verify.error)) {
        toast(t("app.toast.riskHit"));
      } else {
        toast(t("app.qr.bindNoData"));
      }
    } else {
      toast(t("app.qr.bindOk"));
    }
  } catch (err) {
    const code = err && err.message;
    if (code !== "QR_CANCELLED") {
      let message = t("app.qr.error");
      if (code === "QR_TIMEOUT") message = t("app.qr.timeout");
      if (code === "QR_NO_LTOKEN") message = t("app.qr.noLtoken");
      if (code === "QR_CONFIRMED_INCOMPLETE") message = t("app.qr.incomplete");
      setQrState(message, "error");
    }
  } finally {
    state.qrRunning = false;
  }
}

async function startBind() {
  return runBind(core.startQrLogin);
}

async function saveConfig() {
  if (state.role !== "admin") return;
  const uid = refs.configUid ? refs.configUid.value.trim() : "";
  const server = refs.configServer ? refs.configServer.value : "prod_gf_cn";
  const deviceInfo = refs.configDevice ? refs.configDevice.value.trim() : "";
  if (uid && !/^\d{6,12}$/.test(uid)) {
    toast(t("app.admin.settingsInvalid"));
    return;
  }
  if (deviceInfo) {
    try {
      const parsed = JSON.parse(deviceInfo);
      if (!parsed || typeof parsed !== "object") throw new Error("bad");
    } catch (err) {
      toast(t("app.admin.settingsInvalid"));
      return;
    }
  }
  try {
    await core.saveSettings({ uid: uid, server: server, deviceInfo: deviceInfo });
    state.settings = await core.readSettings();
    renderProfile();
    renderAdmin();
    toast(t("app.admin.settingsSaved"));
  } catch (err) {
    toast(t("app.admin.settingsInvalid"));
  }
}

async function saveCookie() {
  if (state.role !== "admin" || !refs.cookie) return;
  const value = refs.cookie.value.trim();
  if (!value) {
    toast(t("app.admin.cookieEmpty"));
    return;
  }
  try {
    state.auth = await core.setAuth({
      cookie: value,
      uid: state.auth && state.auth.uid ? state.auth.uid : "",
      mid: state.auth && state.auth.mid ? state.auth.mid : "",
      source: "manual",
      updatedAt: Date.now(),
    });
    toast(t("app.admin.cookieSaved"));
    await doRefresh(true);
  } catch (err) {
    toast(t("app.admin.cookieFail"));
  }
}

async function clearAuth() {
  if (state.role !== "admin") return;
  const confirmed = await ui.confirm(t("app.admin.clearConfirm"));
  if (!confirmed) return;
  await core.clearAuth();
  state.auth = null;
  renderAdmin();
  toast(t("app.admin.authCleared"));
}

/* ---------- 事件 ---------- */

function bindEvents() {
  if (refs.refresh) refs.refresh.addEventListener("click", function () {
    doRefresh(true);
  });
  if (refs.bind) refs.bind.addEventListener("click", startBind);
  if (refs.saveSettings) refs.saveSettings.addEventListener("click", saveConfig);
  if (refs.saveCookie) refs.saveCookie.addEventListener("click", saveCookie);
  if (refs.clearAuth) refs.clearAuth.addEventListener("click", clearAuth);
  if (refs.debugRun) refs.debugRun.addEventListener("click", runDebug);
  if (refs.debugSync) refs.debugSync.addEventListener("click", runSyncNow);
  if (refs.debugImage) refs.debugImage.addEventListener("click", runImageTest);
  if (refs.debugCopy) refs.debugCopy.addEventListener("click", copyDebug);
  if (refs.debugClear) refs.debugClear.addEventListener("click", clearDebugCache);
  const tabRefs = { moc: refs.tabMoc, fiction: refs.tabFiction, apocalyptic: refs.tabApocalyptic };
  ENDGAME_TABS.forEach(function (name) {
    const tab = tabRefs[name];
    if (tab) {
      tab.addEventListener("click", function () {
        state.tab = name;
        renderTabs();
      });
    }
  });
  if (refs.scheduleCurrent) refs.scheduleCurrent.addEventListener("click", function () {
    state.schedule = "1";
    renderTabs();
    renderEndgame();
  });
  if (refs.schedulePrevious) refs.schedulePrevious.addEventListener("click", function () {
    state.schedule = "2";
    renderTabs();
    renderEndgame();
  });
  if (refs.qrDialog) {
    refs.qrDialog.addEventListener("close", function () {
      if (state.qrRunning) core.cancelQrLogin();
      state.qrRunning = false;
    });
    refs.qrDialog.addEventListener("click", function (event) {
      const action = event.target.closest("[data-action]");
      if (!action) return;
      if (action.dataset.action === "close-qr") {
        core.cancelQrLogin();
        refs.qrDialog.close();
      }
    });
  }
  try {
    Tapp.shared.onChanged(function () {
      core.loadData().then(function (cache) {
        if (cache && (!state.cache || (cache.at || 0) >= (state.cache.at || 0))) {
          state.cache = cache;
          renderAll();
        }
      });
    });
  } catch (err) {
    /* ignore */
  }
}

Tapp.lifecycle.onReady(async function () {
  collectRefs();
  bindStaticText();
  bindEvents();
  await loadState();
  renderAll();
  if (state.role === "admin" && core.isCacheStale(state.cache)) {
    doRefresh(false);
  }
});
