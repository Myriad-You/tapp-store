(function (root) {
  "use strict";

  var Core = require("../main.js");
  var renderGeneration = 0;
  var unsubscribeShared = null;

  function t(key, fallback) {
    try {
      var value = root.Tapp.i18n.t(key);
      return value && value !== key ? value : fallback;
    } catch (_error) { return fallback; }
  }

  function setText(scope, selector, value) {
    var node = scope.querySelector(selector);
    if (node) node.textContent = String(value == null ? "—" : value);
  }

  function safeImage(value) {
    return typeof value === "string" && /^data:image\/(?:jpeg|png|webp);base64,/i.test(value) ? value : "";
  }

  function formatPublishedAt(value, locale) {
    if (!value) return t("widget.snapshotMissing", "等待管理员发布");
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("widget.snapshotPublished", "快照已发布");
    try {
      return date.toLocaleString(locale || undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (_error) { return date.toLocaleString(); }
  }

  async function sharedGet(key) {
    try { return await root.Tapp.shared.get(key); }
    catch (_error) { return null; }
  }

  async function render(container, props) {
    var generation = ++renderGeneration;
    var results = await Promise.all([
      sharedGet(Core.SHARED_KEYS.active),
      sharedGet(Core.SHARED_KEYS.guestSnapshot)
    ]);
    if (generation !== renderGeneration) return;

    var config = results[0] && typeof results[0] === "object" ? results[0] : null;
    var snapshot = results[1] && typeof results[1] === "object" ? results[1] : null;
    var currentSnapshot = Boolean(config && snapshot && snapshot.boardId === config.boardId);
    var imageUrl = currentSnapshot ? safeImage(snapshot.dataUrl) : "";
    var archives = config && Array.isArray(config.archives) ? config.archives.length : 0;
    var dimensions = currentSnapshot && snapshot.canvas || config && config.canvas || { width: Core.LIMITS.canvasWidth, height: Core.LIMITS.canvasHeight };
    var scope = container.querySelector("[data-widget-root]") || container;
    var theme = props && props.theme === "dark" ? "dark" : "light";
    var size = props && props.size || "4x2";

    scope.dataset.theme = theme;
    scope.dataset.size = size;
    scope.style.setProperty("--signature-widget-scale", String(props && props.scale || 1));
    scope.style.setProperty("--signature-widget-font-scale", String(props && props.fontScale || 1));
    scope.setAttribute("aria-label", currentSnapshot ? t("widget.readyAria", "共享签名板最近快照") : t("widget.emptyAria", "共享签名板尚无公开快照"));

    setText(scope, "[data-widget-title]", t("widget.title", "共享签名板"));
    setText(scope, "[data-widget-status]", currentSnapshot ? t("widget.snapshotReady", "最近公开快照") : t("widget.snapshotWaiting", "等待快照"));
    setText(scope, "[data-widget-live]", currentSnapshot ? t("widget.live", "共享中") : t("widget.waiting", "待发布"));
    setText(scope, "[data-widget-empty-copy]", t("widget.empty", "还没有公开快照"));
    setText(scope, "[data-widget-intro]", t("widget.intro", "所有人的签名与画作，共同留在一块画布上。"));
    setText(scope, "[data-widget-drawings-label]", size === "2x2" ? t("widget.drawingsShort", "作品") : t("widget.drawings", "公开作品"));
    setText(scope, "[data-widget-occupancy-label]", t("widget.occupancy", "占用"));
    setText(scope, "[data-widget-archives-label]", t("widget.archives", "归档"));
    setText(scope, "[data-widget-drawings]", currentSnapshot && Number.isFinite(Number(snapshot.drawingCount)) ? Number(snapshot.drawingCount) : "—");
    setText(scope, "[data-widget-occupancy]", currentSnapshot && Number.isFinite(Number(snapshot.occupancyRatio)) ? Math.round(Number(snapshot.occupancyRatio) * 100) + "%" : "—");
    setText(scope, "[data-widget-archives]", archives);
    setText(scope, "[data-widget-canvas-size]", Number(dimensions.width || Core.LIMITS.canvasWidth) + " × " + Number(dimensions.height || Core.LIMITS.canvasHeight));
    setText(scope, "[data-widget-updated]", currentSnapshot ? formatPublishedAt(snapshot.createdAt, props && props.locale) : t("widget.snapshotMissing", "等待管理员发布"));

    var image = scope.querySelector("[data-widget-image]");
    var empty = scope.querySelector("[data-widget-empty]");
    if (image) {
      image.hidden = !imageUrl;
      image.removeAttribute("src");
      if (imageUrl) {
        image.addEventListener("error", function () { image.hidden = true; if (empty) empty.hidden = false; }, { once: true });
        image.src = imageUrl;
      }
    }
    if (empty) empty.hidden = Boolean(imageUrl);
  }

  if (root.Tapp && root.Tapp.widgets) root.Tapp.widgets["board-preview"] = { render: render };

  if (root.Tapp && root.Tapp.shared && typeof root.Tapp.shared.onChanged === "function") {
    try {
      unsubscribeShared = root.Tapp.shared.onChanged(function (event) {
        if (event && event.key && event.key !== Core.SHARED_KEYS.active && event.key !== Core.SHARED_KEYS.guestSnapshot) return;
        try {
          if (root.Tapp.widget && typeof root.Tapp.widget.invalidate === "function") {
            var request = root.Tapp.widget.invalidate("signature-board-updated");
            if (request && typeof request.catch === "function") request.catch(function () {});
          }
        } catch (_error) { /* visible refresh remains best effort */ }
      });
    } catch (_error) { unsubscribeShared = null; }
  }

  if (root.Tapp && root.Tapp.lifecycle && typeof root.Tapp.lifecycle.onDestroy === "function") {
    root.Tapp.lifecycle.onDestroy(function () {
      renderGeneration += 1;
      if (typeof unsubscribeShared === "function") unsubscribeShared();
      unsubscribeShared = null;
    });
  }
})(globalThis);
