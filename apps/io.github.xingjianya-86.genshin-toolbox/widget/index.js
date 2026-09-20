/**
 * 原神工具箱 · Widget 层（genshin + abyss）
 */

const core = require("../core.js");
const ui = core.ui;

function buildFallback(container, widgetId, size) {
  const root = ui.el("div", "gtw " + (widgetId === "abyss" ? "gtw-abyss" : "gtw-genshin") + " gtw-size-" + size);
  root.setAttribute("data-widget-root", "true");
  if (widgetId === "abyss") {
    const big = ui.el("p", "gtw-abyss-big");
    const strong = ui.el("strong", "", "--");
    strong.setAttribute("data-gt-w-spiral-stars", "");
    big.appendChild(strong);
    root.appendChild(big);
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
    const pill = ui.el("span", "gt-pill gt-pill-resin");
    const icon = ui.el("span", "", "🌙");
    icon.setAttribute("aria-hidden", "true");
    const value = ui.el("strong", "", "--");
    value.setAttribute("data-gt-w-resin", "");
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

Tapp.widgets["genshin"] = {
  render: async function (container, props) {
    const root = setupRoot(container, props, "genshin");
    const size = props && props.size ? String(props.size) : "2x2";
    const cache = await ui.ensureData();
    const role = ui.pickRole(cache);
    const note = ui.pickNote(cache);
    const bbsUser = ui.pickBbsUser(cache);

    ui.setImage(
      root.querySelector("[data-gt-w-avatar]"),
      root.querySelector("[data-gt-w-avatar-fallback]"),
      core.roleAvatar(role),
      "★",
      "",
    );
    ui.setImage(root.querySelector("[data-gt-w-bbs]"), null, bbsUser && bbsUser.avatar_url ? bbsUser.avatar_url : "", "", "");

    ui.setText(root.querySelector("[data-gt-w-name]"), role ? role.nickname : "");
    ui.setText(root.querySelector("[data-gt-w-level]"), role ? "Lv." + (role.level || 0) : "");
    ui.setText(root.querySelector("[data-gt-w-resin]"), note ? String(note.current_resin) : "--");
    ui.setText(root.querySelector("[data-gt-w-task]"), note ? note.finished_task_num + "/" + note.total_task_num : "--");
    ui.setText(root.querySelector("[data-gt-w-coin]"), note ? String(note.current_home_coin) : "--");
    ui.setText(
      root.querySelector("[data-gt-w-resin-time]"),
      note ? ui.t("app.resin.recover", { time: core.formatDuration(note.resin_recovery_time) }) : "",
    );
    ui.setText(
      root.querySelector("[data-gt-w-coin-time]"),
      note ? ui.t("app.coin.recover", { time: core.formatDuration(note.home_coin_recovery_time) }) : "",
    );
    const stats = cache && cache.playerIndex && cache.playerIndex.stats ? cache.playerIndex.stats : null;
    ui.setText(
      root.querySelector("[data-gt-w-stats]"),
      stats ? ui.t("app.stats.text", {
        days: stats.active_day_number,
        achievements: stats.achievement_number,
        chars: stats.avatar_number,
        abyss: stats.spiral_abyss || "-",
      }) : "",
    );

    const charsEl = root.querySelector("[data-gt-w-chars]");
    if (charsEl) {
      charsEl.replaceChildren();
      const index = cache && cache.playerIndex ? cache.playerIndex : null;
      const charLimit = size === "4x4" ? 12 : size === "4x2" ? 8 : 4;
      const labeled = size === "4x4";
      ui.sortAvatars(index && index.avatars, charLimit).forEach(function (avatar) {
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

function floorClearTime(floor) {
  let latest = 0;
  (floor && Array.isArray(floor.levels) ? floor.levels : []).forEach(function (level) {
    (level && Array.isArray(level.battles) ? level.battles : []).forEach(function (battle) {
      const ts = Number(battle && battle.timestamp);
      if (ts > latest) latest = ts;
    });
  });
  return latest;
}

function appendTeamAvatars(container, avatars, limit) {
  (avatars || []).slice(0, limit).forEach(function (member) {
    const img = document.createElement("img");
    img.className = "gtw-team-avatar";
    img.alt = "";
    img.src = core.resolveAsset((member && (member.icon || member.image)) || "");
    container.appendChild(img);
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

Tapp.widgets["abyss"] = {
  render: async function (container, props) {
    const root = setupRoot(container, props, "abyss");
    const size = props && props.size ? String(props.size) : "2x2";
    const cache = await ui.ensureData();

    ui.setText(root.querySelector("[data-gt-w-spiral-title]"), ui.t("widget.abyss.spiral"));
    ui.setText(root.querySelector("[data-gt-w-poetry-title]"), ui.t("widget.abyss.poetry"));
    ui.setText(root.querySelector("[data-gt-w-tab-spiral]"), ui.t("widget.abyss.spiral"));
    ui.setText(root.querySelector("[data-gt-w-tab-poetry]"), ui.t("widget.abyss.poetry"));
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

    const current = cache && cache.abyssCurrent ? cache.abyssCurrent : null;
    const previous = cache && cache.abyssPrevious ? cache.abyssPrevious : null;
    ui.setText(root.querySelector("[data-gt-w-spiral-stars]"), current && typeof current.total_star === "number" ? String(current.total_star) : "--");
    ui.setText(
      root.querySelector("[data-gt-w-spiral-floor]"),
      current && current.max_floor
        ? (size === "2x2" ? String(current.max_floor) : " · " + current.max_floor)
        : (size === "2x2" ? "--" : ""),
    );
    ui.setText(root.querySelector("[data-gt-w-floor-label]"), current ? ui.t("widget.abyss.maxFloor") : "");
    ui.setText(
      root.querySelector("[data-gt-w-spiral-prev]"),
      previous && typeof previous.total_star === "number"
        ? ui.t("widget.abyss.previous", { stars: previous.total_star, floor: previous.max_floor || "-" })
        : "",
    );

  const floorsEl = root.querySelector("[data-gt-w-floors]");
  if (floorsEl) {
    floorsEl.replaceChildren();
    const floors = current && Array.isArray(current.floors) ? current.floors.slice() : [];
    floors.sort(function (a, b) {
      return (a.index || 0) - (b.index || 0);
    });
    const unlocked = floors.filter(function (floor) {
      return floor && floor.is_unlock;
    });
    if (size === "4x4") {
      /* 只显示最高已解锁层：每半一行 [12-1 / 上] [队伍头像] [月日] */
      const last = unlocked.length ? unlocked[unlocked.length - 1] : null;
      if (last) {
        (last.levels || []).forEach(function (level) {
          if (!level) return;
          (level.battles || []).forEach(function (battle, battleIndex) {
            const row = ui.el("div", "gtw-record-row");
            const label = ui.el("div", "gtw-record-label");
            label.appendChild(ui.el("span", "gtw-record-floor", String(last.index) + "-" + String(level.index)));
            label.appendChild(ui.el("span", "gtw-record-half", battleIndex === 0 ? ui.t("widget.abyss.up") : ui.t("widget.abyss.down")));
            label.appendChild(ui.el("span", "gtw-record-stars", "★" + (level.star || 0) + "/" + (level.max_star || 3)));
            row.appendChild(label);
            const team = ui.el("div", "gtw-record-team");
            appendRecordAvatars(team, battle.avatars, 4);
            row.appendChild(team);
            row.appendChild(ui.el("span", "gtw-record-date", core.formatMonthDay(battle && battle.timestamp)));
            floorsEl.appendChild(row);
          });
        });
      }
    } else {
      unlocked.forEach(function (floor) {
        const row = ui.el("div", "gtw-floor-row");
        const head = ui.el("div", "gtw-floor-head");
        head.appendChild(ui.el("span", "gtw-floor-name", String(floor.index)));
        head.appendChild(ui.el("span", "gtw-floor-stars", "★" + (floor.star || 0) + "/" + (floor.max_star || 3)));
        const time = core.formatTimestamp(floorClearTime(floor));
        if (time) head.appendChild(ui.el("span", "gtw-floor-time", ui.t("widget.abyss.clearTime", { time: time })));
        row.appendChild(head);
        floorsEl.appendChild(row);
      });
    }
  }

  const item = ui.pickPoetryItem(cache);
  const stat = item && item.stat ? item.stat : null;
  ui.setText(root.querySelector("[data-gt-w-poetry-medals]"), stat ? String(stat.medal_num) : "--");
  ui.setText(root.querySelector("[data-gt-w-poetry-label]"), stat ? ui.t("widget.abyss.medals") : "");
  ui.setText(
    root.querySelector("[data-gt-w-poetry-sub]"),
    stat ? ui.t("widget.abyss.poetrySub", { difficulty: stat.difficulty_id, rounds: stat.max_round_id, coins: stat.coin_num }) : "",
  );

  const roundsEl = root.querySelector("[data-gt-w-poetry-rounds]");
  if (roundsEl) {
    roundsEl.replaceChildren();
    const rounds = item && item.detail && Array.isArray(item.detail.rounds_data) ? item.detail.rounds_data : [];
    rounds.forEach(function (round) {
      if (!round) return;
      if (size === "4x4") {
        /* 每轮一行：[第 N 轮 / 勋章] [队伍头像] [用时] */
        const row = ui.el("div", "gtw-record-row");
        const label = ui.el("div", "gtw-record-label");
        label.appendChild(ui.el("span", "gtw-record-floor", ui.t("app.poetry.round", { round: round.round_id })));
        label.appendChild(ui.el("span", "gtw-record-half", round.is_get_medal ? "🏅" : "—"));
        row.appendChild(label);
        const team = ui.el("div", "gtw-record-team");
        appendRecordAvatars(team, round.avatars, 8);
        row.appendChild(team);
        row.appendChild(ui.el("span", "gtw-record-date", core.formatMonthDay(round.finish_date_time || round.finish_time)));
        roundsEl.appendChild(row);
      } else {
        const row = ui.el("div", "gtw-round-row");
        row.appendChild(ui.el("span", "gtw-round-name", String(round.round_id)));
        const team = ui.el("span", "gtw-team");
        appendTeamAvatars(team, round.avatars, 6);
        row.appendChild(team);
        row.appendChild(ui.el("span", "gtw-round-medal", round.is_get_medal ? "🏅" : "—"));
        roundsEl.appendChild(row);
      }
    });
  }

    ui.renderEmpty(root, cache, Boolean(cache && (cache.abyssCurrent || cache.poetry)));
  },
};
