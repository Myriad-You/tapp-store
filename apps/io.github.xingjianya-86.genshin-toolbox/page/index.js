/**
 * 原神工具箱 · 页面层
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
const pickNote = ui.pickNote;
const pickBbsUser = ui.pickBbsUser;
const pickAbyss = ui.pickAbyss;
const pickPoetryItem = ui.pickPoetryItem;
const charTile = ui.charTile;

const state = {
  role: "guest",
  settings: { uid: "", server: "cn_gf01" },
  auth: null,
  cache: null,
  schedule: "1",
  tab: "spiral",
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
    resin: "[data-gt-resin]",
    resinMax: "[data-gt-resin-max]",
    resinBar: "[data-gt-resin-bar]",
    resinTime: "[data-gt-resin-time]",
    task: "[data-gt-task]",
    taskExtra: "[data-gt-task-extra]",
    coin: "[data-gt-coin]",
    coinTime: "[data-gt-coin-time]",
    stats: "[data-gt-stats]",
    chars: "[data-gt-chars]",
    charCount: "[data-gt-char-count]",
    tabSpiral: "[data-gt-tab-spiral]",
    tabPoetry: "[data-gt-tab-poetry]",
    panelSpiral: "[data-gt-panel='spiral']",
    panelPoetry: "[data-gt-panel='poetry']",
    scheduleCurrent: "[data-gt-schedule-current]",
    schedulePrevious: "[data-gt-schedule-previous]",
    abyss: "[data-gt-abyss]",
    poetry: "[data-gt-poetry]",
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
  setText(refs.tabSpiral, t("app.tab.spiral"));
  setText(refs.tabPoetry, t("app.tab.poetry"));
  setText(refs.scheduleCurrent, t("app.abyss.current"));
  setText(refs.schedulePrevious, t("app.abyss.previous"));
  setText(document.querySelector("[data-gt-label-resin]"), t("app.label.resin"));
  setText(document.querySelector("[data-gt-label-task]"), t("app.label.task"));
  setText(document.querySelector("[data-gt-label-coin]"), t("app.label.coin"));
  setText(document.querySelector("[data-gt-label-stats]"), t("app.label.stats"));
  setText(document.querySelector("[data-gt-label-chars]"), t("app.label.chars"));
  setText(document.querySelector("[data-gt-label-abyss]"), t("app.label.abyss"));
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

  const gameAvatarUrl = core.roleAvatar(role);
  setImage(refs.gameAvatar, refs.avatarFallback, gameAvatarUrl, "★", "");
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
  const effectiveServer = state.settings.server || (state.cache && state.cache.server ? String(state.cache.server) : "cn_gf01");
  if (effectiveUid) parts.push("UID " + effectiveUid);
  parts.push(serverLabel(effectiveServer));
  if (state.cache && state.cache.at) {
    parts.push(t("app.updatedAt", { time: new Date(state.cache.at).toLocaleString() }));
  }
  setText(refs.meta, parts.join(" · "));
}

function serverLabel(server) {
  if (server === "cn_qd01") return t("app.server.b");
  if (server === "os") return t("app.server.os");
  return t("app.server.cn");
}

function renderCards() {
  const note = pickNote(state.cache);
  if (note) {
    setText(refs.resin, note.current_resin);
    setText(refs.resinMax, "/ " + note.max_resin);
    const percent = note.max_resin ? Math.min(100, Math.round((note.current_resin / note.max_resin) * 100)) : 0;
    if (refs.resinBar) refs.resinBar.style.width = percent + "%";
    setText(refs.resinTime, t("app.resin.recover", { time: core.formatDuration(note.resin_recovery_time) }));
    setText(refs.task, note.finished_task_num + " / " + note.total_task_num);
    setText(refs.taskExtra, note.is_extra_task_reward_received ? t("app.task.extraDone") : t("app.task.extraTodo"));
    setText(refs.coin, note.current_home_coin + " / " + note.max_home_coin);
    setText(refs.coinTime, t("app.coin.recover", { time: core.formatDuration(note.home_coin_recovery_time) }));
  } else {
    setText(refs.resin, "--");
    setText(refs.resinMax, "");
    setText(refs.task, "--");
    setText(refs.taskExtra, "");
    setText(refs.coin, "--");
    setText(refs.coinTime, "");
  }

  const index = state.cache && state.cache.playerIndex ? state.cache.playerIndex : null;
  const stats = index && index.stats ? index.stats : null;
  if (stats) {
    setText(refs.stats, t("app.stats.text", {
      days: stats.active_day_number,
      achievements: stats.achievement_number,
      chars: stats.avatar_number,
      abyss: stats.spiral_abyss || "-",
    }));
  } else {
    setText(refs.stats, t("app.alert.noData"));
  }
}

function renderChars() {
  if (!refs.chars) return;
  refs.chars.replaceChildren();
  const index = state.cache && state.cache.playerIndex ? state.cache.playerIndex : null;
  const avatars = index && Array.isArray(index.avatars) ? index.avatars : [];
  setText(refs.charCount, avatars.length ? t("app.chars.count", { count: avatars.length }) : "");
  sortAvatars(avatars, 12).forEach(function (avatar) {
    const card = charTile(avatar, {
      withLabels: true,
      meta: "Lv." + (avatar.level || 0) + " · " + t("app.fetter", { n: avatar.fetter || 0 }),
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

function rankCard(label, rank) {
  const card = el("div", "gt-rank");
  const first = Array.isArray(rank) && rank.length ? rank[0] : null;
  if (first) {
    card.appendChild(avatarImg(first.avatar_icon, "gt-team-avatar", "", ""));
  }
  const body = el("div", "gt-rank-body");
  body.appendChild(el("strong", "", first ? String(first.value) : "-"));
  body.appendChild(el("span", "", label));
  card.appendChild(body);
  return card;
}

function renderAbyss() {
  if (!refs.abyss) return;
  refs.abyss.replaceChildren();
  const abyss = pickAbyss(state.cache, state.schedule);
  if (!abyss || typeof abyss.total_star !== "number") {
    refs.abyss.appendChild(el("p", "gt-empty", t("app.abyss.empty")));
    return;
  }

  const summary = el("div", "gt-summary");
  summary.appendChild(el("span", "", t("app.abyss.summary", {
    stars: abyss.total_star,
    floor: abyss.max_floor || "-",
    battles: abyss.total_battle_times || 0,
    wins: abyss.total_win_times || 0,
  })));
  refs.abyss.appendChild(summary);

  const floors = Array.isArray(abyss.floors) ? abyss.floors.slice() : [];
  floors.sort(function (a, b) {
    return (b.index || 0) - (a.index || 0);
  });
  let expanded = false;
  floors.forEach(function (floor) {
    if (!floor || !floor.is_unlock) return;
    const box = el("div", "gt-floor");
    const head = el("button", "gt-floor-head");
    head.type = "button";
    head.appendChild(el("span", "", t("app.abyss.floor", { index: floor.index })));
    head.appendChild(el("span", "gt-floor-stars", "★".repeat(floor.star || 0) + "☆".repeat(Math.max(0, (floor.max_star || 3) - (floor.star || 0)))));
    box.appendChild(head);
    const body = el("div", "gt-floor-body");
    (floor.levels || []).forEach(function (level) {
      const chamber = el("div", "gt-chamber");
      chamber.appendChild(el("div", "gt-chamber-head", t("app.abyss.chamber", { index: level.index }) + " · ★" + (level.star || 0) + "/" + (level.max_star || 3)));
      (level.battles || []).forEach(function (battle, battleIndex) {
        const team = el("div", "gt-team");
        team.appendChild(el("span", "gt-chamber-head", battleIndex === 0 ? t("app.abyss.halfFirst") : t("app.abyss.halfSecond")));
        (battle.avatars || []).forEach(function (member) {
          team.appendChild(avatarImg(member.icon, "gt-team-avatar", String(member.level || ""), ""));
        });
        chamber.appendChild(team);
      });
      body.appendChild(chamber);
    });
    box.appendChild(body);
    head.addEventListener("click", function () {
      body.hidden = !body.hidden;
    });
    if (!expanded) {
      body.hidden = false;
      expanded = true;
    } else {
      body.hidden = true;
    }
    refs.abyss.appendChild(box);
  });

  const ranks = el("div", "gt-ranks");
  ranks.appendChild(rankCard(t("app.abyss.rank.damage"), abyss.damage_rank));
  ranks.appendChild(rankCard(t("app.abyss.rank.defeat"), abyss.defeat_rank));
  ranks.appendChild(rankCard(t("app.abyss.rank.takeDamage"), abyss.take_damage_rank));
  ranks.appendChild(rankCard(t("app.abyss.rank.normalSkill"), abyss.normal_skill_rank));
  ranks.appendChild(rankCard(t("app.abyss.rank.energySkill"), abyss.energy_skill_rank));
  ranks.appendChild(rankCard(t("app.abyss.rank.reveal"), abyss.reveal_rank));
  refs.abyss.appendChild(ranks);
}

function renderPoetry() {
  if (!refs.poetry) return;
  refs.poetry.replaceChildren();
  const item = pickPoetryItem(state.cache);
  if (!item || !item.has_data || !item.stat) {
    refs.poetry.appendChild(el("p", "gt-empty", t("app.poetry.empty")));
    return;
  }
  const stat = item.stat;
  const summary = el("div", "gt-summary");
  summary.appendChild(el("span", "", t("app.poetry.summary", {
    difficulty: stat.difficulty_id,
    rounds: stat.max_round_id,
    medals: stat.medal_num,
    coins: stat.coin_num,
    rent: stat.rent_cnt,
  })));
  refs.poetry.appendChild(summary);

  const rounds = item.detail && Array.isArray(item.detail.rounds_data) ? item.detail.rounds_data : [];
  rounds.forEach(function (round) {
    const row = el("div", "gt-round");
    const info = el("div", "gt-round-body");
    info.appendChild(el("div", "gt-round-title", t("app.poetry.round", { round: round.round_id })));
    const meta = [];
    const roundDate = core.formatMonthDay(round.finish_date_time || round.finish_time);
    if (roundDate) meta.push(t("app.poetry.date", { time: roundDate }));
    if (Array.isArray(round.avatars) && round.avatars.length) meta.push(t("app.poetry.used", { count: round.avatars.length }));
    info.appendChild(el("div", "gt-round-meta", meta.join(" · ")));
    row.appendChild(info);
    const teams = el("div", "gt-team");
    (round.avatars || []).slice(0, 6).forEach(function (avatar) {
      teams.appendChild(avatarImg(avatar.image, "gt-team-avatar", (avatar.name || "?").charAt(0), core.elementColor(avatar.element)));
    });
    row.appendChild(teams);
    row.appendChild(el("span", "gt-medal", round.is_get_medal ? "🏅" : "—"));
    refs.poetry.appendChild(row);
  });
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
    if (refs.configServer && document.activeElement !== refs.configServer) refs.configServer.value = state.settings.server || "cn_gf01";
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
  const isSpiral = state.tab === "spiral";
  if (refs.tabSpiral) {
    refs.tabSpiral.classList.toggle("is-active", isSpiral);
    refs.tabSpiral.setAttribute("aria-selected", isSpiral ? "true" : "false");
  }
  if (refs.tabPoetry) {
    refs.tabPoetry.classList.toggle("is-active", !isSpiral);
    refs.tabPoetry.setAttribute("aria-selected", !isSpiral ? "true" : "false");
  }
  if (refs.panelSpiral) refs.panelSpiral.hidden = !isSpiral;
  if (refs.panelPoetry) refs.panelPoetry.hidden = isSpiral;
  if (refs.scheduleCurrent) refs.scheduleCurrent.classList.toggle("is-active", state.schedule === "1");
  if (refs.schedulePrevious) refs.schedulePrevious.classList.toggle("is-active", state.schedule === "2");
}

function renderAll() {
  renderProfile();
  renderCards();
  renderChars();
  renderTabs();
  renderAbyss();
  renderPoetry();
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
    const sections = ["dailyNote", "playerIndex", "bbsUser", "abyssCurrent", "abyssPrevious", "poetry"].filter(function (key) {
      return state.cache[key] !== undefined;
    });
    lines.push(
      "cache: at=" + (state.cache.at ? new Date(state.cache.at).toISOString() : "-") +
      " abyssAt=" + (state.cache.abyssAt ? new Date(state.cache.abyssAt).toISOString() : "-") +
      " sections=" + JSON.stringify(sections)
    );
    lines.push("errors: " + JSON.stringify(state.cache.errors || {}));
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
  const server = refs.configServer ? refs.configServer.value : "cn_gf01";
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
  if (refs.tabSpiral) refs.tabSpiral.addEventListener("click", function () {
    state.tab = "spiral";
    renderTabs();
  });
  if (refs.tabPoetry) refs.tabPoetry.addEventListener("click", function () {
    state.tab = "poetry";
    renderTabs();
  });
  if (refs.scheduleCurrent) refs.scheduleCurrent.addEventListener("click", function () {
    state.schedule = "1";
    renderTabs();
    renderAbyss();
  });
  if (refs.schedulePrevious) refs.schedulePrevious.addEventListener("click", function () {
    state.schedule = "2";
    renderTabs();
    renderAbyss();
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
