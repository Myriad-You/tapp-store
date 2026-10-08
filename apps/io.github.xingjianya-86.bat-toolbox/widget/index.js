/**
 * 银河球棒侠 · Widget 层（starrail + endgame）
 */

const core = require("../core.js");
const ui = core.ui;

const MODES = ["moc", "fiction", "apocalyptic"];

function buildFallback(container, widgetId, size) {
  const root = ui.el("div", "gtw " + (widgetId === "endgame" ? "gtw-endgame" : "gtw-starrail") + " gtw-size-" + size);
  root.setAttribute("data-widget-root", "true");
  if (widgetId === "endgame") {
    const rows = ui.el("div", "gtw-endgame-rows");
    MODES.forEach(function (mode) {
      const row = ui.el("div", "gtw-endgame-row");
      const label = ui.el("span", "gtw-endgame-name", "");
      label.setAttribute("data-gt-w-2x2-label-" + mode, "");
      const value = ui.el("strong", "", "--");
      value.setAttribute("data-gt-w-2x2-" + mode, "");
      row.appendChild(label);
      row.appendChild(value);
      rows.appendChild(row);
    });
    root.appendChild(rows);
  } else {
    const wrap = ui.el("div", "gt-avatar-wrap");
    const img = document.createElement("img");
    img.className = "gt-avatar";
    img.alt = "";
    img.hidden = true;
    img.setAttribute("data-gt-w-avatar", "");
    const fallback = ui.el("span", "gt-avatar-fallback", "★");
    fallback.setAttribute("data-gt-w-avatar-fallback", "");
    wrap.appendChild(img);
    wrap.appendChild(fallback);
    root.appendChild(wrap);
    const stats = ui.el("div", "gtw-stats");
    const pill = ui.el("span", "gt-pill gt-pill-stamina");
    const icon = ui.el("span", "", "⚡");
    icon.setAttribute("aria-hidden", "true");
    const value = ui.el("strong", "", "--");
    value.setAttribute("data-gt-w-stamina", "");
    pill.appendChild(icon);
    pill.appendChild(value);
    stats.appendChild(pill);
    root.appendChild(stats);
  }
  const empty = ui.el("p", "gt-empty", "");
  empty.setAttribute("data-gt-w-empty", "");
  empty.hidden = true;
  root.appendChild(empty);
  container.appendChild(root);
  return root;
}

function setupRoot(container, props, widgetId) {
  const size = props && props.size ? String(props.size) : "2x2";
  const root = container.querySelector("[data-widget-root]") || buildFallback(container, widgetId, size);
  const scale = (props && props.scale) || 1;
  root.style.setProperty("--gtw-scale", String(scale));
  root.classList.toggle("gtw-edit", Boolean(props && props.isEditMode));
  core.noteWidgetProps(widgetId, props);
  return root;
}

Tapp.widgets["starrail"] = {
  render: async function (container, props) {
    const root = setupRoot(container, props, "starrail");
    const size = props && props.size ? String(props.size) : "2x2";
    const cache = await ui.ensureData();
    const role = ui.pickRole(cache);
    const note = ui.pickNote(cache);

    ui.setImage(
      root.querySelector("[data-gt-w-avatar]"),
      root.querySelector("[data-gt-w-avatar-fallback]"),
      core.headIcon(cache),
      "★",
      "",
    );

    ui.setText(root.querySelector("[data-gt-w-name]"), role ? role.nickname : "");
    ui.setText(root.querySelector("[data-gt-w-level]"), role ? "Lv." + (role.level || 0) : "");
    /* 4x4 空间紧，胶囊只显示当前值（4x2 保留 x/y） */
    const compactPills = size === "4x4";
    ui.setText(
      root.querySelector("[data-gt-w-stamina]"),
      note ? (compactPills ? String(note.current_stamina) : note.current_stamina + "/" + note.max_stamina) : "--",
    );
    ui.setText(
      root.querySelector("[data-gt-w-train]"),
      note ? (compactPills ? String(note.current_train_score) : note.current_train_score + "/" + note.max_train_score) : "--",
    );
    ui.setText(
      root.querySelector("[data-gt-w-expedition]"),
      note ? (compactPills ? String(note.accepted_epedition_num) : note.accepted_epedition_num + "/" + note.total_expedition_num) : "--",
    );
    ui.setText(
      root.querySelector("[data-gt-w-stamina-time]"),
      note ? ui.t("app.stamina.recover", { time: core.formatDuration(note.stamina_recover_time) }) : "",
    );
    ui.setText(
      root.querySelector("[data-gt-w-reserve]"),
      note ? ui.t("app.reserve.text", { value: note.current_reserve_stamina }) : "",
    );
    const stats = cache && cache.playerIndex && cache.playerIndex.stats ? cache.playerIndex.stats : null;
    ui.setText(
      root.querySelector("[data-gt-w-stats]"),
      stats ? ui.t("app.stats.text", {
        days: stats.active_days,
        achievements: stats.achievement_num,
        chars: stats.avatar_num,
        chests: stats.chest_num,
        abyss: stats.abyss_process || "-",
      }) : "",
    );

    const charsEl = root.querySelector("[data-gt-w-chars]");
    if (charsEl) {
      charsEl.replaceChildren();
      const avatars = ui.pickIndexAvatars(cache);
      const charLimit = size === "4x4" ? 12 : 8;
      const labeled = size === "4x4";
      ui.sortAvatars(avatars, charLimit).forEach(function (avatar) {
        const tile = ui.charTile(avatar, {
          className: labeled ? "gtw-char gtw-char--labeled" : "gtw-char",
          imgClass: "gt-char-img",
          fallbackClass: "gt-char-fallback",
        });
        if (labeled) tile.appendChild(ui.el("span", "gtw-char-name", avatar.name || ""));
        if (avatar.name) {
          tile.classList.add("is-clickable");
          tile.addEventListener("click", function () {
            core.openCharacter(avatar.name);
          });
        }
        charsEl.appendChild(tile);
      });
    }

    ui.renderEmpty(root, cache);
  },
};

function latestNodeTime(floor) {
  let latest = "";
  ui.endgameNodes(floor).forEach(function (node) {
    const text = core.formatChallengeTime(node && node.challenge_time);
    if (text && text > latest) latest = text;
  });
  return latest;
}

function appendTeamAvatars(container, avatars, limit) {
  (avatars || []).slice(0, limit).forEach(function (member) {
    const wrap = ui.el("span", "gtw-team-member");
    const img = document.createElement("img");
    img.className = "gtw-team-avatar";
    img.alt = "";
    img.decoding = "async";
    const name = member && member.name ? member.name : "";
    const fallback = ui.el("span", "gtw-team-avatar-fallback", name.charAt(0) || "?");
    wrap.appendChild(img);
    wrap.appendChild(fallback);
    ui.setImage(img, fallback, (member && (member.icon || member.image)) || "", name.charAt(0) || "?", "");
    container.appendChild(wrap);
  });
}

/* 42px 圆角方块头像（与每日面板角色格同款，带首字兜底） */
function appendRecordAvatars(container, avatars, limit) {
  (avatars || []).slice(0, limit).forEach(function (member) {
    const tile = ui.charTile(member, {
      className: "gtw-record-avatar",
      imgClass: "gt-char-img",
      fallbackClass: "gt-char-fallback",
    });
    container.appendChild(tile);
  });
}

function nodeLabel(index, count) {
  if (count >= 3) {
    return [ui.t("widget.endgame.nodeUp"), ui.t("widget.endgame.nodeMid"), ui.t("widget.endgame.nodeDown")][index] || String(index + 1);
  }
  return index === 0 ? ui.t("widget.endgame.nodeUp") : ui.t("widget.endgame.nodeDown");
}

function renderModePanel(root, mode, info, size) {
  const starsEl = root.querySelector("[data-gt-w-" + mode + "-stars]");
  const floorEl = root.querySelector("[data-gt-w-" + mode + "-floor]");
  const subEl = root.querySelector("[data-gt-w-" + mode + "-sub]");
  const floorsEl = root.querySelector("[data-gt-w-floors-" + mode + "]");

  ui.setText(starsEl, info && info.star_num != null ? String(info.star_num) : "--");
  ui.setText(floorEl, info && info.max_floor ? (size === "2x2" ? String(info.max_floor) : " · " + info.max_floor) : "");
  if (subEl) subEl.hidden = true;

  if (!floorsEl) return;
  floorsEl.replaceChildren();
  const lastFloor = ui.endgameLastFloor(info);
  const floors = lastFloor ? [lastFloor] : [];
  floors.forEach(function (floor) {
    if (!floor) return;
    const row = ui.el("div", "gtw-floor-row");
    const head = ui.el("div", "gtw-floor-head");
    head.appendChild(ui.el("span", "gtw-floor-name", ui.floorDisplayName(floor.name) || "-"));
    const extraStars = ui.floorExtraStars(floor);
    head.appendChild(ui.el("span", "gtw-floor-stars", "★" + (floor.star_num || 0) + (extraStars > 0 ? "+" + extraStars : "")));
    if (size !== "4x4") {
      const time = latestNodeTime(floor);
      if (time) head.appendChild(ui.el("span", "gtw-floor-time", ui.t("widget.endgame.clearTime", { time: time })));
    }
    row.appendChild(head);
    if (size === "4x4") {
      /* 每节点一行：[其十二 / 星启·上半] [42px 队伍头像] [月日] */
      const isStar = String(floor.name || "").indexOf("星启") >= 0;
      const floorLabel = ui.floorCompactName(floor.name).replace(/·星启$/, "");
      const starPrefix = isStar ? ui.t("widget.endgame.starward") + "·" : "";
      const nodes = ui.endgameNodes(floor);
      nodes.forEach(function (node, nodeIndex) {
        const record = ui.el("div", "gtw-record-row");
        const label = ui.el("div", "gtw-record-label");
        label.appendChild(ui.el("span", "gtw-record-floor", floorLabel));
        label.appendChild(ui.el("span", "gtw-record-half", starPrefix + nodeLabel(nodeIndex, nodes.length)));
        record.appendChild(label);
        const team = ui.el("div", "gtw-record-team");
        appendRecordAvatars(team, node.avatars, 4);
        record.appendChild(team);
        record.appendChild(ui.el("span", "gtw-record-date", core.formatMonthDay(node && node.challenge_time)));
        row.appendChild(record);
      });
    }
    floorsEl.appendChild(row);
  });
}

Tapp.widgets["endgame"] = {
  render: async function (container, props) {
    const root = setupRoot(container, props, "endgame");
    const size = props && props.size ? String(props.size) : "2x2";
    const cache = await ui.ensureData();

    ui.setText(root.querySelector("[data-gt-w-tab-moc]"), ui.t("widget.endgame.moc"));
    ui.setText(root.querySelector("[data-gt-w-tab-fiction]"), ui.t("widget.endgame.fiction"));
    ui.setText(root.querySelector("[data-gt-w-tab-apocalyptic]"), ui.t("widget.endgame.apocalyptic"));
    ui.setText(root.querySelector("[data-gt-w-2x2-label-moc]"), ui.t("widget.endgame.moc"));
    ui.setText(root.querySelector("[data-gt-w-2x2-label-fiction]"), ui.t("widget.endgame.fiction"));
    ui.setText(root.querySelector("[data-gt-w-2x2-label-apocalyptic]"), ui.t("widget.endgame.apocalyptic"));

    const tabs = root.querySelectorAll("[data-gt-w-tab]");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        const name = tab.getAttribute("data-gt-w-tab");
        tabs.forEach(function (item) {
          item.classList.toggle("is-active", item === tab);
        });
        root.querySelectorAll("[data-gt-w-panel]").forEach(function (panel) {
          panel.hidden = panel.getAttribute("data-gt-w-panel") !== name;
        });
      });
    });

    const moc = ui.pickMoc(cache, "1");
    const fiction = ui.pickFiction(cache);
    const apocalyptic = ui.pickApocalyptic(cache);

    ui.setText(root.querySelector("[data-gt-w-2x2-moc]"), moc && moc.star_num != null ? "★" + moc.star_num : "--");
    ui.setText(root.querySelector("[data-gt-w-2x2-fiction]"), fiction && fiction.star_num != null ? "★" + fiction.star_num : "--");
    ui.setText(root.querySelector("[data-gt-w-2x2-apocalyptic]"), apocalyptic && apocalyptic.star_num != null ? "★" + apocalyptic.star_num : "--");

    renderModePanel(root, "moc", moc, size);
    renderModePanel(root, "fiction", fiction, size);
    renderModePanel(root, "apocalyptic", apocalyptic, size);

    ui.renderEmpty(root, cache, Boolean(moc || fiction || apocalyptic));
  },
};
