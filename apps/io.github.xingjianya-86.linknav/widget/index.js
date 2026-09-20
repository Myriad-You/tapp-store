/**
 * 链接小窝 · Widget 层
 * 展示置顶（没有置顶则按顺序）链接，点击直达；未命中 openUrls 白名单时复制。
 */

const core = require("../core.js");

function t(key, params) {
  try {
    return Tapp.i18n.t(key, params);
  } catch (err) {
    return key;
  }
}

function letterIcon(link) {
  if (link.icon) return link.icon;
  const title = link.title || link.url || "☆";
  return title.trim().charAt(0).toUpperCase() || "☆";
}

async function copyOrNotify(link) {
  const ok = await core.copyText(link.url);
  try {
    await Tapp.ui.showNotification({
      message: ok ? t("app.copied") : link.url,
      type: ok ? "success" : "info",
      duration: ok ? 2000 : 5000,
    });
  } catch (err) {
    /* Widget 沙箱没有通知时静默 */
  }
}

Tapp.widgets["quick-links"] = {
  render: async function (container, props) {
    const size = props && props.size ? props.size : "2x2";
    const limit = size === "4x2" ? 6 : 3;
    const scale = (props && props.scale) || 1;
    const fontScale = (props && props.fontScale) || 1;
    const root = container.querySelector("[data-widget-root]") || container;
    root.style.setProperty("--lnw-scale", String(scale));
    root.style.setProperty("--lnw-font-scale", String(fontScale));

    const titleEl = root.querySelector("[data-lnw-title]");
    if (titleEl) titleEl.textContent = t("widget.title");

    const listEl = root.querySelector("[data-lnw-list]");
    const emptyEl = root.querySelector("[data-lnw-empty]");
    if (!listEl) return;

    const role = await core.getRole();
    const openUrls = await core.listOpenUrls();
    const links = await core.loadLinks(role);
    const pinned = links.filter(function (link) {
      return link.pinned;
    });
    const shown = (pinned.length ? pinned : links).slice(0, limit);

    listEl.replaceChildren();
    if (!shown.length) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = t("widget.empty");
      }
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    shown.forEach(function (link) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "lnw-item";
      item.setAttribute("aria-label", link.title);
      let icon;
      if (link.iconData) {
        icon = document.createElement("img");
        icon.className = "lnw-icon lnw-icon-img";
        icon.src = link.iconData;
        icon.alt = "";
        icon.decoding = "async";
        icon.loading = "lazy";
      } else {
        icon = document.createElement("span");
        icon.className = "lnw-icon";
        icon.textContent = letterIcon(link);
      }
      const text = document.createElement("span");
      text.className = "lnw-text";
      const name = document.createElement("span");
      name.className = "lnw-name";
      name.textContent = link.title;
      const host = document.createElement("span");
      host.className = "lnw-host";
      host.textContent = core.hostOf(link.url);
      text.appendChild(name);
      text.appendChild(host);
      item.appendChild(icon);
      item.appendChild(text);
      item.addEventListener("click", async function () {
        item.classList.add("is-busy");
        const result = await core.openLink(link, openUrls);
        if (!result.opened) await copyOrNotify(link);
        setTimeout(function () {
          item.classList.remove("is-busy");
        }, 320);
      });
      listEl.appendChild(item);
    });
  },
};
