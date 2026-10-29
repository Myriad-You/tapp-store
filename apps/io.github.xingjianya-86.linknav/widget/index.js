/**
 * 链接小窝 · Widget 层
 * 展示置顶（没有置顶则按顺序）链接，点击直达；未命中 openUrls 白名单时复制。
 */

const core = require("../core.js");

// 渲染签名：数据 / 尺寸 / 角色 / 语言都没变就跳过（宿主重挂载后 ctx 全新，
// 首帧必然渲染；同 iframe 内重复 render 才会被这道闸门拦下）。
let lastRenderSig = "";

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
    const scale = (props && props.scale) || 0;
    const fontScale = (props && props.fontScale) || 0;
    const root = container.querySelector("[data-widget-root]") || container;
    // 宿主 render 之后才下发真实缩放（props.scale 在 render 时恒为 1）：
    // 只有拿到非 1 的显式值才内联覆盖，否则交给 CSS 回落宿主 --tapp-* 变量。
    if (scale && scale !== 1) root.style.setProperty("--lnw-scale", String(scale));
    else root.style.removeProperty("--lnw-scale");
    if (fontScale && fontScale !== 1) root.style.setProperty("--lnw-font-scale", String(fontScale));
    else root.style.removeProperty("--lnw-font-scale");

    const titleEl = root.querySelector("[data-lnw-title]");
    if (titleEl) titleEl.textContent = t("widget.title");

    const listEl = root.querySelector("[data-lnw-list]");
    const emptyEl = root.querySelector("[data-lnw-empty]");
    if (!listEl) return;

    const role = await core.getRole();
    const openUrls = await core.listOpenUrls();
    // 只读「要展示的那几条」的图标：原实现为显示 ≤6 条会 getAll 整个 4MB 图标库
    const shown = await core.loadWidgetLinks(role, limit);

    const sig = [
      size,
      role,
      t("widget.title"),
      shown
        .map(function (link) {
          return link.id + "\u0001" + link.title + "\u0001" + (link.iconData ? link.iconData.length : link.icon || "");
        })
        .join("\u0002"),
    ].join("\u0000");
    if (sig === lastRenderSig) return;
    lastRenderSig = sig;

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
