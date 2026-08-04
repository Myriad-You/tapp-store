/// <reference path="./types/tapp-sdk.d.ts" />

var XINGCHEN_DEFAULT_BASE_URL = "https://github-stats-hazel-beta.vercel.app";

/** @type {WeakMap<HTMLElement, XingchenWidgetProps>} */
var XINGCHEN_INSTANCE_PROPS = new WeakMap();
/** @type {WeakSet<HTMLElement>} */
var XINGCHEN_THEME_BOUND = new WeakSet();
/** @type {WeakMap<HTMLElement, number>} */
var XINGCHEN_RENDER_TOKENS = new WeakMap();
/** @type {Set<() => void>} */
var XINGCHEN_THEME_UNSUBSCRIBERS = new Set();
var XINGCHEN_RENDER_SEQUENCE = 0;

/** @typedef {"stats" | "top-langs" | "pin" | "gist" | "wakatime"} XingchenCardType */
/**
 * @typedef {Object} XingchenWidgetProps
 * @property {Record<string, unknown>=} config
 * @property {Record<string, unknown>=} settings
 * @property {string=} size
 * @property {string=} theme
 * @property {string=} primaryColor
 * @property {number=} scale
 * @property {number=} fontScale
 */
/**
 * @typedef {Object} XingchenResolvedConfig
 * @property {string} baseUrl
 * @property {XingchenCardType} cardType
 * @property {string} username
 * @property {string} repository
 * @property {string} gistId
 * @property {string} theme
 * @property {string} locale
 * @property {string} customTitle
 * @property {boolean} showIcons
 * @property {boolean} hideBorder
 * @property {boolean} showShell
 * @property {"transparent" | "auto" | "light" | "dark"} surfaceMode
 * @property {boolean} disableAnimations
 * @property {string} rankIcon
 * @property {boolean} includeAllCommits
 * @property {"short" | "long"} numberFormat
 * @property {string} languageLayout
 * @property {number} langsCount
 * @property {string} hideItems
 * @property {string} showItems
 * @property {string} excludeRepo
 * @property {boolean} showOwner
 * @property {string} accentColor
 * @property {number} borderRadius
 * @property {number} cacheSeconds
 * @property {string} advancedParams
 * @property {"light" | "dark"} hostTheme
 */

/** @type {Record<XingchenCardType, { path: string, label: string, requires: string }>} */
var XINGCHEN_CARD_META = {
  stats: { path: "/api", label: "GitHub 统计", requires: "username" },
  "top-langs": { path: "/api/top-langs/", label: "热门语言", requires: "username" },
  pin: { path: "/api/pin/", label: "仓库卡片", requires: "repository" },
  gist: { path: "/api/gist", label: "Gist 卡片", requires: "gistId" },
  wakatime: { path: "/api/wakatime", label: "WakaTime", requires: "username" }
};

/** @param {unknown} value */
function xingchenText(value) {
  return value === undefined || value === null ? "" : String(value);
}

/** @param {unknown} value @param {boolean} fallback */
function xingchenBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1";
}

/** @param {unknown} value @param {number} fallback @param {number} min @param {number} max */
function xingchenNumber(value, fallback, min, max) {
  var parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** @param {unknown} value @param {string} fallback */
function xingchenColor(value, fallback) {
  var color = xingchenText(value).trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

/** @param {unknown} value @returns {"" | "light" | "dark"} */
function xingchenNormalizeTheme(value) {
  if (value === true) return "dark";
  if (value === false) return "light";
  if (typeof value === "object" && value !== null) {
    var themeObject = /** @type {Record<string, unknown>} */ (value);
    return xingchenNormalizeTheme(
      themeObject.resolvedTheme || themeObject.theme || themeObject.mode || themeObject.colorScheme
    );
  }
  var theme = xingchenText(value).trim().toLowerCase();
  if (theme.indexOf("dark") !== -1) return "dark";
  if (theme.indexOf("light") !== -1) return "light";
  return "";
}

/**
 * @returns {{ getTheme?: () => Promise<unknown>, onThemeChange?: (callback: (theme: unknown) => void) => (() => void) } | null}
 */
function xingchenUiBridge() {
  var sdk = /** @type {{ ui?: { getTheme?: () => Promise<unknown>, onThemeChange?: (callback: (theme: unknown) => void) => (() => void) } }} */ (
    /** @type {unknown} */ (Tapp)
  );
  return sdk.ui || null;
}

/** @param {XingchenWidgetProps} props @returns {"light" | "dark"} */
function xingchenHostTheme(props) {
  var propTheme = xingchenNormalizeTheme(props && props.theme);
  if (propTheme) return propTheme;
  if (document.documentElement.classList.contains("dark") || document.body.classList.contains("dark")) {
    return "dark";
  }
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

/** @param {XingchenWidgetProps} props @returns {Promise<"light" | "dark">} */
async function xingchenCurrentTheme(props) {
  try {
    var ui = xingchenUiBridge();
    if (ui && typeof ui.getTheme === "function") {
      var runtimeTheme = xingchenNormalizeTheme(await ui.getTheme());
      if (runtimeTheme) return runtimeTheme;
    }
  } catch (_error) {
    // Fall back to widget props and browser color-scheme detection.
  }
  return xingchenHostTheme(props);
}

/** @param {unknown} value */
function xingchenNormalizeBaseUrl(value) {
  var raw = xingchenText(value).trim() || XINGCHEN_DEFAULT_BASE_URL;
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  var url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("服务域名只支持 HTTP 或 HTTPS");
  }
  url.search = "";
  url.hash = "";
  return (url.origin + url.pathname).replace(/\/+$/, "");
}

/** @param {URLSearchParams} params @param {unknown} rawValue */
function xingchenApplyAdvancedParams(params, rawValue) {
  var raw = xingchenText(rawValue).trim().replace(/^[?#&]+/, "");
  if (!raw) return;
  var advanced = new URLSearchParams(raw);
  advanced.forEach(function (value, key) {
    if (/^[a-z][a-z0-9_-]{0,63}$/i.test(key)) params.set(key, value);
  });
}

/** @param {URLSearchParams} params @param {string} key @param {unknown} value */
function xingchenSetOptional(params, key, value) {
  var text = xingchenText(value).trim();
  if (text) params.set(key, text);
}

/** @param {XingchenWidgetProps} props @param {"light" | "dark"} hostTheme @returns {XingchenResolvedConfig} */
function xingchenResolvedConfig(props, hostTheme) {
  var config = props && (props.config || props.settings) ? (props.config || props.settings || {}) : {};
  var requestedType = xingchenText(config.cardType);
  var cardType = Object.prototype.hasOwnProperty.call(XINGCHEN_CARD_META, requestedType)
    ? /** @type {XingchenCardType} */ (requestedType)
    : "stats";
  return {
    baseUrl: xingchenNormalizeBaseUrl(config.baseUrl),
    cardType: cardType,
    username: xingchenText(config.username).trim(),
    repository: xingchenText(config.repository).trim(),
    gistId: xingchenText(config.gistId).trim(),
    theme: xingchenText(config.theme).trim() || "auto",
    locale: xingchenText(config.locale).trim() || "cn",
    customTitle: xingchenText(config.customTitle).trim(),
    showIcons: xingchenBoolean(config.showIcons, true),
    hideBorder: xingchenBoolean(config.hideBorder, true),
    showShell: xingchenBoolean(config.showShell, false),
    surfaceMode: ["transparent", "auto", "light", "dark"].indexOf(xingchenText(config.surfaceMode).trim()) !== -1
      ? /** @type {"transparent" | "auto" | "light" | "dark"} */ (xingchenText(config.surfaceMode).trim())
      : "transparent",
    disableAnimations: xingchenBoolean(config.disableAnimations, true),
    rankIcon: xingchenText(config.rankIcon).trim() || "github",
    includeAllCommits: xingchenBoolean(config.includeAllCommits, true),
    numberFormat: config.numberFormat === "long" ? "long" : "short",
    languageLayout: xingchenText(config.languageLayout).trim() || "compact",
    langsCount: Math.round(xingchenNumber(config.langsCount, 6, 1, 20)),
    hideItems: xingchenText(config.hideItems).trim(),
    showItems: xingchenText(config.showItems).trim(),
    excludeRepo: xingchenText(config.excludeRepo).trim(),
    showOwner: xingchenBoolean(config.showOwner, true),
    accentColor: xingchenColor(config.accentColor, "#7C3AED"),
    borderRadius: xingchenNumber(config.borderRadius, 8, 0, 24),
    cacheSeconds: Math.round(xingchenNumber(config.cacheSeconds, 21600, 21600, 86400)),
    advancedParams: xingchenText(config.advancedParams).trim(),
    hostTheme: hostTheme
  };
}

/** @param {XingchenResolvedConfig} config */
function xingchenValidateRequired(config) {
  if (config.cardType === "gist" && !config.gistId) return "请在小组件设置中填写 Gist ID";
  if (config.cardType === "pin" && !config.repository) return "请在小组件设置中填写仓库名称";
  if (config.cardType !== "gist" && !config.username) return "请在小组件设置中填写用户名";
  return "";
}

/** @param {XingchenResolvedConfig} config */
function xingchenBuildCardUrl(config) {
  var meta = XINGCHEN_CARD_META[config.cardType];
  var params = new URLSearchParams();
  xingchenApplyAdvancedParams(params, config.advancedParams);

  if (config.cardType === "gist") {
    params.set("id", config.gistId);
  } else {
    params.set("username", config.username);
  }
  if (config.cardType === "pin") params.set("repo", config.repository);

  params.set("locale", config.locale);
  params.set("hide_border", String(config.hideBorder));
  params.set("disable_animations", String(config.disableAnimations));
  params.set("border_radius", String(config.borderRadius));
  params.set("cache_seconds", String(config.cacheSeconds));
  xingchenSetOptional(params, "custom_title", config.customTitle);
  xingchenSetOptional(params, "hide", config.hideItems);
  xingchenSetOptional(params, "show", config.showItems);
  xingchenSetOptional(params, "exclude_repo", config.excludeRepo);

  if (config.theme === "auto") {
    var accent = config.accentColor.slice(1);
    var surfaceTheme = xingchenSurfaceTheme(config);
    var isDark = surfaceTheme === "dark" || (surfaceTheme === "transparent" && config.hostTheme === "dark");
    params.set("theme", surfaceTheme === "transparent" ? "transparent" : (isDark ? "dark" : "default"));
    params.set("title_color", accent);
    params.set("icon_color", accent);
    params.set("ring_color", accent);
    params.set("text_color", isDark ? "C9D1D9" : "24292F");
    params.set("bg_color", surfaceTheme === "transparent" ? "FFFFFF00" : (isDark ? "000000" : "FFFFFF"));
    params.set("border_color", isDark ? "30363D" : "D0D7DE");
  } else {
    params.set("theme", config.theme);
  }

  if (config.cardType === "stats") {
    params.set("show_icons", String(config.showIcons));
    params.set("include_all_commits", String(config.includeAllCommits));
    params.set("number_format", config.numberFormat);
    if (config.rankIcon === "hidden") {
      params.set("hide_rank", "true");
      params.delete("rank_icon");
    } else {
      params.set("hide_rank", "false");
      params.set("rank_icon", config.rankIcon);
    }
  }

  if (config.cardType === "top-langs") {
    params.set("layout", config.languageLayout);
    params.set("langs_count", String(config.langsCount));
  }

  if (config.cardType === "wakatime") {
    params.set("layout", config.languageLayout === "normal" ? "default" : "compact");
    params.set("langs_count", String(config.langsCount));
  }

  if (config.cardType === "pin") {
    params.set("show_owner", String(config.showOwner));
    params.set("show_icons", String(config.showIcons));
    params.set("number_format", config.numberFormat);
  }

  if (config.cardType === "gist") params.set("show_owner", String(config.showOwner));

  return config.baseUrl + meta.path + "?" + params.toString();
}

/** @param {XingchenResolvedConfig} config @returns {"transparent" | "light" | "dark"} */
function xingchenSurfaceTheme(config) {
  if (config.surfaceMode === "transparent") return "transparent";
  return config.surfaceMode === "dark" || (config.surfaceMode === "auto" && config.hostTheme === "dark")
    ? "dark"
    : "light";
}

/** @param {HTMLElement} container @returns {HTMLElement} */
function xingchenEnsureMarkup(container) {
  var shell = /** @type {HTMLElement | null} */ (container.querySelector("[data-xingchen-shell]"));
  if (shell) return shell;
  container.innerHTML = [
    '<section class="xingchen-widget" data-xingchen-shell>',
    '  <div class="xingchen-orbit xingchen-orbit-a"></div>',
    '  <div class="xingchen-orbit xingchen-orbit-b"></div>',
    '  <header class="xingchen-header">',
    '    <div class="xingchen-brand"><span class="xingchen-mark" aria-hidden="true">★</span><span><b>星辰</b><small data-xingchen-type>GitHub 统计</small></span></div>',
    '    <span class="xingchen-status" data-xingchen-status>连接中</span>',
    '  </header>',
    '  <div class="xingchen-media" data-xingchen-media>',
    '    <div class="xingchen-placeholder" data-xingchen-placeholder><span></span><i></i><i></i><i></i></div>',
    '    <img data-xingchen-image alt="GitHub Stats Extended card" />',
    '    <div class="xingchen-message" data-xingchen-message hidden><strong>暂时无法显示卡片</strong><span></span></div>',
    '  </div>',
    '  <footer class="xingchen-footer"><span data-xingchen-identity>—</span><span data-xingchen-origin>—</span></footer>',
    '</section>'
  ].join("");
  return /** @type {HTMLElement} */ (container.querySelector("[data-xingchen-shell]"));
}

/** @param {HTMLElement} shell @param {string} title @param {string} detail */
function xingchenSetMessage(shell, title, detail) {
  var message = /** @type {HTMLElement} */ (shell.querySelector("[data-xingchen-message]"));
  var image = /** @type {HTMLImageElement} */ (shell.querySelector("[data-xingchen-image]"));
  var placeholder = /** @type {HTMLElement} */ (shell.querySelector("[data-xingchen-placeholder]"));
  message.hidden = false;
  /** @type {HTMLElement} */ (message.querySelector("strong")).textContent = title;
  /** @type {HTMLElement} */ (message.querySelector("span")).textContent = detail;
  image.removeAttribute("src");
  image.classList.remove("is-ready");
  placeholder.hidden = true;
}

/** @param {unknown} error */
function xingchenErrorMessage(error) {
  return error instanceof Error ? error.message : xingchenText(error);
}

/** @param {HTMLElement} container @param {XingchenWidgetProps} props */
function xingchenBindTheme(container, props) {
  XINGCHEN_INSTANCE_PROPS.set(container, props);
  if (XINGCHEN_THEME_BOUND.has(container)) return;
  var ui = xingchenUiBridge();
  if (!ui || typeof ui.onThemeChange !== "function") return;
  XINGCHEN_THEME_BOUND.add(container);
  var unsubscribe = ui.onThemeChange(function (theme) {
    var currentProps = XINGCHEN_INSTANCE_PROPS.get(container) || {};
    var nextTheme = xingchenNormalizeTheme(theme);
    xingchenRenderGitHubStats(container, {
      config: currentProps.config,
      settings: currentProps.settings,
      size: currentProps.size,
      theme: nextTheme || currentProps.theme
    });
  });
  if (typeof unsubscribe === "function") XINGCHEN_THEME_UNSUBSCRIBERS.add(unsubscribe);
}

/** @param {HTMLElement} container @param {number} token @param {HTMLImageElement} image @param {string} url */
function xingchenIsCurrentImageRequest(container, token, image, url) {
  return XINGCHEN_RENDER_TOKENS.get(container) === token && image.getAttribute("src") === url;
}

/** @param {HTMLElement} container @param {XingchenWidgetProps} props */
async function xingchenRenderGitHubStats(container, props) {
    var renderToken = ++XINGCHEN_RENDER_SEQUENCE;
    XINGCHEN_RENDER_TOKENS.set(container, renderToken);
    xingchenBindTheme(container, props || {});
    var shell = xingchenEnsureMarkup(container);
    var typeField = /** @type {HTMLElement} */ (shell.querySelector("[data-xingchen-type]"));
    var statusField = /** @type {HTMLElement} */ (shell.querySelector("[data-xingchen-status]"));
    var identityField = /** @type {HTMLElement} */ (shell.querySelector("[data-xingchen-identity]"));
    var originField = /** @type {HTMLElement} */ (shell.querySelector("[data-xingchen-origin]"));
    var image = /** @type {HTMLImageElement} */ (shell.querySelector("[data-xingchen-image]"));
    var placeholder = /** @type {HTMLElement} */ (shell.querySelector("[data-xingchen-placeholder]"));
    var message = /** @type {HTMLElement} */ (shell.querySelector("[data-xingchen-message]"));
    image.onload = null;
    image.onerror = null;
    image.removeAttribute("src");
    image.classList.remove("is-ready");

    try {
      var currentTheme = await xingchenCurrentTheme(props || {});
      if (XINGCHEN_RENDER_TOKENS.get(container) !== renderToken) return;
      var config = xingchenResolvedConfig(props || {}, currentTheme);
      var meta = XINGCHEN_CARD_META[config.cardType];
      var missing = xingchenValidateRequired(config);
      var surfaceTheme = xingchenSurfaceTheme(config);
      container.style.background = "transparent";
      container.ownerDocument.documentElement.style.background = "transparent";
      if (container.ownerDocument.body) container.ownerDocument.body.style.background = "transparent";
      shell.setAttribute("data-size", props && props.size ? props.size : "4x2");
      shell.setAttribute("data-card-type", config.cardType);
      shell.setAttribute("data-show-shell", String(config.showShell));
      shell.setAttribute("data-host-theme", config.hostTheme);
      shell.setAttribute("data-surface-theme", surfaceTheme);
      shell.style.setProperty("--xingchen-accent", config.accentColor);
      typeField.textContent = meta.label;
      identityField.textContent = config.cardType === "gist" ? "Gist · " + (config.gistId || "未配置") : "@" + (config.username || "未配置");
      originField.textContent = new URL(config.baseUrl).host;

      if (missing) {
        statusField.textContent = "待配置";
        statusField.setAttribute("data-state", "warning");
        xingchenSetMessage(shell, "还差一项设置", missing);
        return;
      }

      var cardUrl = xingchenBuildCardUrl(config);
      var nextImage = /** @type {HTMLImageElement} */ (container.ownerDocument.createElement("img"));
      nextImage.setAttribute("data-xingchen-image", "");
      nextImage.alt = meta.label + " · " + (config.username || config.gistId);
      message.hidden = true;
      placeholder.hidden = false;
      statusField.textContent = "加载中";
      statusField.setAttribute("data-state", "loading");

      nextImage.onload = function () {
        if (!xingchenIsCurrentImageRequest(container, renderToken, nextImage, cardUrl)) return;
        nextImage.onload = null;
        nextImage.onerror = null;
        image.replaceWith(nextImage);
        placeholder.hidden = true;
        message.hidden = true;
        nextImage.classList.add("is-ready");
        statusField.textContent = "已同步";
        statusField.setAttribute("data-state", "ready");
      };
      nextImage.onerror = function () {
        if (!xingchenIsCurrentImageRequest(container, renderToken, nextImage, cardUrl)) return;
        nextImage.onload = null;
        nextImage.onerror = null;
        statusField.textContent = "加载失败";
        statusField.setAttribute("data-state", "error");
        xingchenSetMessage(shell, "卡片加载失败", "请检查用户名、服务域名和 network:fetch 授权");
      };
      nextImage.src = cardUrl;
    } catch (error) {
      if (XINGCHEN_RENDER_TOKENS.get(container) !== renderToken) return;
      statusField.textContent = "配置错误";
      statusField.setAttribute("data-state", "error");
      xingchenSetMessage(shell, "配置无法使用", xingchenErrorMessage(error));
    }
}

Tapp.widgets["github-stats-card"] = {
  render: xingchenRenderGitHubStats
};

/** @typedef {"views" | "unique_visitors"} VisitorMetric */
/**
 * @typedef {Object} VisitorResolvedConfig
 * @property {VisitorMetric} metric
 * @property {string} label
 * @property {string} numberLocale
 * @property {boolean} showGrouping
 * @property {string} containerColor
 * @property {string} labelColor
 * @property {string} valueColor
 * @property {number} cornerRadius
 */

/** @param {XingchenWidgetProps} props @returns {VisitorResolvedConfig} */
function visitorResolvedConfig(props) {
  var config = props && (props.config || props.settings) ? (props.config || props.settings || {}) : {};
  var locale = xingchenText(config.numberLocale).trim();
  var metricValue = xingchenText(config.metric).trim();
  var metric = /** @type {VisitorMetric} */ (
    metricValue === "unique_visitors" ? "unique_visitors" : "views"
  );
  var configuredLabel = xingchenText(config.label).trim();
  var label = configuredLabel || (metric === "views" ? "Views" : "Visitors");
  return {
    metric: metric,
    label: label.slice(0, 40),
    numberLocale: ["en-US", "zh-CN", "de-DE"].indexOf(locale) !== -1 ? locale : "en-US",
    showGrouping: xingchenBoolean(config.showGrouping, true),
    containerColor: xingchenColor(
      config.containerColor,
      xingchenColor(config.backgroundColor, "#F2D8EC")
    ),
    labelColor: xingchenColor(config.labelColor, "#27162B"),
    valueColor: xingchenColor(config.valueColor, "#925553"),
    cornerRadius: xingchenNumber(config.cornerRadius, 42, 0, 80)
  };
}

/** @param {unknown} value @returns {number} */
function visitorNormalizeCount(value) {
  if (value === null || value === undefined) {
    throw new Error("系统统计没有返回累计访问数据");
  }
  var normalized = typeof value === "string" ? value.replace(/[,\s]/g, "") : value;
  var count = Number(normalized);
  if (!Number.isFinite(count) || count < 0) {
    throw new Error("系统统计返回了无效的累计访问数据");
  }
  return Math.floor(count);
}

/** @param {number} count @param {VisitorResolvedConfig} config @returns {string} */
function visitorFormatCount(count, config) {
  return count.toLocaleString(config.numberLocale, { useGrouping: config.showGrouping });
}

/** @param {unknown} value @returns {unknown} */
function visitorUnwrapAnalyticsSummary(value) {
  var payload = value;
  var depth = 0;
  while (payload && depth < 4) {
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (_error) {
        break;
      }
    }
    if (!payload || typeof payload !== "object") break;
    var record = /** @type {Record<string, unknown>} */ (payload);
    if (record.data !== undefined) payload = record.data;
    else if (record.body !== undefined) payload = record.body;
    else if (record.result !== undefined) payload = record.result;
    else break;
    depth += 1;
  }
  return payload;
}

/** @returns {Promise<Record<string, unknown>>} */
async function visitorGetAnalyticsSummary() {
  var analytics = typeof Tapp === "undefined"
    ? null
    : /** @type {{ getSummary?: (range?: { days?: number; from?: string; to?: string }) => Promise<unknown> }} */ (
      /** @type {unknown} */ (Tapp.analytics)
    );
  if (!analytics || typeof analytics.getSummary !== "function") {
    throw new Error("当前系统版本不支持站点分析接口");
  }
  var summary = visitorUnwrapAnalyticsSummary(await analytics.getSummary({ days: 7 }));
  if (!summary || typeof summary !== "object") {
    throw new Error("系统统计没有返回有效数据");
  }
  var record = /** @type {Record<string, unknown>} */ (summary);
  if (record.success === false) throw new Error("系统统计查询失败");
  if (record.enabled === false) throw new Error("系统站点统计尚未启用");
  return record;
}

/** @param {Record<string, unknown>} summary @param {VisitorMetric} metric @returns {number} */
function visitorReadAnalyticsCount(summary, metric) {
  var allTime = summary.all_time;
  if (!allTime || typeof allTime !== "object") {
    throw new Error("系统统计没有返回 all_time 数据");
  }
  return visitorNormalizeCount(/** @type {Record<string, unknown>} */ (allTime)[metric]);
}

/** @param {HTMLElement} container @returns {HTMLElement} */
function visitorEnsureMarkup(container) {
  var shell = /** @type {HTMLElement | null} */ (container.querySelector("[data-visitor-shell]"));
  if (shell) return shell;
  container.innerHTML = [
    '<section class="visitor-widget" data-visitor-shell data-size="4x1" role="status" aria-live="polite">',
    '  <span class="visitor-label" data-visitor-label>Visitors</span>',
    '  <strong class="visitor-count" data-visitor-count>—</strong>',
    '</section>'
  ].join("");
  return /** @type {HTMLElement} */ (container.querySelector("[data-visitor-shell]"));
}

/** @param {HTMLElement} shell @param {HTMLElement} countField @param {VisitorResolvedConfig} config @param {number} count */
function visitorShowCount(shell, countField, config, count) {
  var formatted = visitorFormatCount(count, config);
  countField.textContent = formatted;
  shell.setAttribute("aria-label", config.label + " " + formatted);
}

/** @param {HTMLElement} container @param {XingchenWidgetProps} props */
async function visitorRender(container, props) {
  var shell = visitorEnsureMarkup(container);
  var labelField = /** @type {HTMLElement} */ (shell.querySelector("[data-visitor-label]"));
  var countField = /** @type {HTMLElement} */ (shell.querySelector("[data-visitor-count]"));

  try {
    var config = visitorResolvedConfig(props || {});

    container.style.background = "transparent";
    container.ownerDocument.documentElement.style.background = "transparent";
    if (container.ownerDocument.body) container.ownerDocument.body.style.background = "transparent";
    shell.setAttribute("data-size", props && props.size ? props.size : "4x1");
    shell.setAttribute("data-state", "loading");
    shell.style.setProperty("--visitor-container", config.containerColor);
    shell.style.setProperty("--visitor-label", config.labelColor);
    shell.style.setProperty("--visitor-value", config.valueColor);
    shell.style.setProperty("--visitor-radius", config.cornerRadius + "px");
    labelField.textContent = config.label;
    shell.title = "正在读取系统站点分析数据";

    countField.textContent = "—";

    var summary = await visitorGetAnalyticsSummary();
    var count = visitorReadAnalyticsCount(summary, config.metric);
    visitorShowCount(shell, countField, config, count);
    shell.setAttribute("data-state", "ready");
    shell.title = config.metric === "views"
      ? "累计访问量（PV）· 系统站点分析"
      : "累计独立访客（UV）· 受系统保留期限制";
  } catch (error) {
    shell.setAttribute("data-state", countField.textContent !== "—" ? "stale" : "error");
    shell.title = "访客数据加载失败：" + xingchenErrorMessage(error);
  }
}

Tapp.widgets["website-visitors"] = {
  render: visitorRender
};

/** @typedef {"auto" | "mosaic" | "grid"} PhotoWallLayout */
/**
 * @typedef {Object} PhotoWallResolvedConfig
 * @property {string[]} images
 * @property {PhotoWallLayout} layout
 * @property {number} gap
 * @property {number} cornerRadius
 * @property {number} tileRadius
 * @property {string} focus
 * @property {string} backgroundColor
 */

var PHOTO_WALL_DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=82"
];

/** @param {unknown} value @returns {string[]} */
function photoWallParseImages(value) {
  var raw = value === undefined || value === null
    ? PHOTO_WALL_DEFAULT_IMAGES.join(" | ")
    : xingchenText(value);
  var seen = Object.create(null);
  return raw.split(/\r?\n|\|/).map(function (item) {
    return item.trim();
  }).filter(function (item) {
    if (!item || seen[item]) return false;
    try {
      var url = new URL(item);
      if (url.protocol !== "https:" && url.protocol !== "http:") return false;
      seen[item] = true;
      return true;
    } catch (_error) {
      return false;
    }
  }).slice(0, 9);
}

/** @param {unknown} value @returns {PhotoWallLayout} */
function photoWallLayout(value) {
  var layout = xingchenText(value).trim();
  return layout === "grid" || layout === "mosaic" ? layout : "auto";
}

/** @param {unknown} value @returns {string} */
function photoWallFocus(value) {
  var focus = xingchenText(value).trim();
  var positions = {
    center: "50% 50%",
    top: "50% 20%",
    bottom: "50% 80%",
    left: "20% 50%",
    right: "80% 50%"
  };
  return positions[focus] || positions.center;
}

/** @param {XingchenWidgetProps} props @returns {PhotoWallResolvedConfig} */
function photoWallResolvedConfig(props) {
  var config = props && (props.config || props.settings) ? (props.config || props.settings || {}) : {};
  return {
    images: photoWallParseImages(config.images),
    layout: photoWallLayout(config.layout),
    gap: Math.round(xingchenNumber(config.gap, 4, 0, 16)),
    cornerRadius: xingchenNumber(config.cornerRadius, 18, 0, 40),
    tileRadius: xingchenNumber(config.tileRadius, 10, 0, 24),
    focus: photoWallFocus(config.focus),
    backgroundColor: xingchenColor(config.backgroundColor, "#0F172A")
  };
}

/** @param {string} size @returns {number} */
function photoWallVisibleLimit(size) {
  var limits = { "2x1": 3, "4x1": 5, "2x2": 4, "4x2": 6, "4x4": 9 };
  return limits[size] || limits["4x2"];
}

/** @param {HTMLElement} container @returns {HTMLElement} */
function photoWallEnsureMarkup(container) {
  var shell = /** @type {HTMLElement | null} */ (container.querySelector("[data-photo-wall-shell]"));
  if (shell) return shell;
  container.innerHTML = '<section class="photo-wall-widget" data-photo-wall-shell data-size="4x2" role="group" aria-label="照片墙"></section>';
  return /** @type {HTMLElement} */ (container.querySelector("[data-photo-wall-shell]"));
}

/** @param {HTMLElement} container @param {XingchenWidgetProps} props */
function photoWallRender(container, props) {
  var shell = photoWallEnsureMarkup(container);
  var config = photoWallResolvedConfig(props || {});
  var size = props && props.size ? props.size : "4x2";
  var visibleLimit = photoWallVisibleLimit(size);
  var images = config.images.slice(0, visibleLimit);
  var resolvedLayout = config.layout === "grid"
    ? "grid"
    : (images.length === visibleLimit && images.length >= 3 ? "mosaic" : "grid");

  container.style.background = "transparent";
  container.ownerDocument.documentElement.style.background = "transparent";
  if (container.ownerDocument.body) container.ownerDocument.body.style.background = "transparent";
  shell.setAttribute("data-size", size);
  shell.setAttribute("data-layout", resolvedLayout);
  shell.setAttribute("data-count", String(images.length));
  shell.setAttribute("aria-label", "照片墙，共 " + images.length + " 张照片");
  shell.style.setProperty("--photo-wall-gap", config.gap + "px");
  shell.style.setProperty("--photo-wall-radius", config.cornerRadius + "px");
  shell.style.setProperty("--photo-tile-radius", (config.gap === 0 ? 0 : config.tileRadius) + "px");
  shell.style.setProperty("--photo-focus", config.focus);
  shell.style.setProperty("--photo-wall-background", config.backgroundColor);
  shell.innerHTML = "";

  if (!images.length) {
    var empty = container.ownerDocument.createElement("div");
    empty.className = "photo-wall-empty";
    empty.innerHTML = '<span aria-hidden="true">▧</span><strong>添加照片链接</strong><small>使用竖线分隔多张图片</small>';
    shell.appendChild(empty);
    return;
  }

  var fragment = container.ownerDocument.createDocumentFragment();
  images.forEach(function (url, index) {
    var item = container.ownerDocument.createElement("figure");
    var image = /** @type {HTMLImageElement} */ (container.ownerDocument.createElement("img"));
    item.className = "photo-wall-item";
    item.setAttribute("data-index", String(index + 1));
    image.alt = "照片 " + (index + 1);
    image.decoding = "async";
    image.loading = "eager";
    image.referrerPolicy = "no-referrer";
    image.onload = function () {
      item.setAttribute("data-state", "ready");
      image.onload = null;
      image.onerror = null;
    };
    image.onerror = function () {
      item.setAttribute("data-state", "error");
      image.onload = null;
      image.onerror = null;
    };
    image.src = url;
    item.appendChild(image);
    fragment.appendChild(item);
  });
  shell.appendChild(fragment);
}

Tapp.widgets["photo-wall"] = {
  render: photoWallRender
};

/** @typedef {"auto" | "countdown" | "countup"} AnniversaryMode */
/** @typedef {"starlight" | "letter" | "glass" | "minimal"} AnniversaryStyle */
/** @typedef {"left" | "center" | "right"} AnniversaryAlignment */
/**
 * @typedef {Object} AnniversaryResolvedConfig
 * @property {string} title
 * @property {string} date
 * @property {AnniversaryMode} mode
 * @property {boolean} repeatAnnual
 * @property {AnniversaryStyle} style
 * @property {AnniversaryAlignment} alignment
 * @property {string} icon
 * @property {string} subtitle
 * @property {string} label
 * @property {string} unit
 * @property {boolean} showIcon
 * @property {boolean} showDate
 * @property {boolean} showProgress
 * @property {boolean} useCustomColors
 * @property {string} accentColor
 * @property {string} backgroundColor
 * @property {string} textColor
 * @property {string} mutedColor
 * @property {string} backgroundImage
 * @property {number} overlayOpacity
 * @property {number} cornerRadius
 * @property {number} numberScale
 * @property {"dot" | "cn" | "slash"} dateFormat
 */

/** @param {unknown} value @returns {AnniversaryMode} */
function anniversaryMode(value) {
  var mode = xingchenText(value).trim();
  return mode === "countdown" || mode === "countup" ? mode : "auto";
}

/** @param {unknown} value @returns {AnniversaryStyle} */
function anniversaryStyle(value) {
  var style = xingchenText(value).trim();
  return style === "letter" || style === "glass" || style === "minimal" ? style : "starlight";
}

/** @param {unknown} value @returns {AnniversaryAlignment} */
function anniversaryAlignment(value) {
  var alignment = xingchenText(value).trim();
  return alignment === "center" || alignment === "right" ? alignment : "left";
}

/** @param {unknown} value @returns {string} */
function anniversaryBackgroundImage(value) {
  var raw = xingchenText(value).trim();
  if (!raw) return "";
  try {
    var url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch (_error) {
    return "";
  }
}

/** @param {XingchenWidgetProps} props @returns {AnniversaryResolvedConfig} */
function anniversaryResolvedConfig(props) {
  var config = props && (props.config || props.settings) ? (props.config || props.settings || {}) : {};
  var dateFormat = xingchenText(config.dateFormat).trim();
  return {
    title: (xingchenText(config.title).trim() || "我们的纪念日").slice(0, 64),
    date: xingchenText(config.date).trim() || "2026-12-31",
    mode: anniversaryMode(config.mode),
    repeatAnnual: xingchenBoolean(config.repeatAnnual, true),
    style: anniversaryStyle(config.style),
    alignment: anniversaryAlignment(config.alignment),
    icon: personalLimitCharacters(xingchenText(config.icon).trim() || "♡", 4),
    subtitle: xingchenText(config.subtitle).trim().slice(0, 120),
    label: xingchenText(config.label).trim().slice(0, 40),
    unit: (xingchenText(config.unit).trim() || "天").slice(0, 8),
    showIcon: xingchenBoolean(config.showIcon, true),
    showDate: xingchenBoolean(config.showDate, true),
    showProgress: xingchenBoolean(config.showProgress, true),
    useCustomColors: xingchenBoolean(config.useCustomColors, false),
    accentColor: xingchenColor(config.accentColor, "#A78BFA"),
    backgroundColor: xingchenColor(config.backgroundColor, "#111827"),
    textColor: xingchenColor(config.textColor, "#F8FAFC"),
    mutedColor: xingchenColor(config.mutedColor, "#CBD5E1"),
    backgroundImage: anniversaryBackgroundImage(config.backgroundImage),
    overlayOpacity: xingchenNumber(config.overlayOpacity, 0.42, 0, 0.9),
    cornerRadius: xingchenNumber(config.cornerRadius, 22, 0, 40),
    numberScale: xingchenNumber(config.numberScale, 1, 0.7, 1.4),
    dateFormat: dateFormat === "cn" || dateFormat === "slash" ? dateFormat : "dot"
  };
}

/** @param {string} value @returns {Date | null} */
function anniversaryParseDate(value) {
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  var date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/** @returns {Date} */
function anniversaryToday() {
  var now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
}

/** @param {Date} date @param {number} year @returns {Date} */
function anniversaryDateForYear(date, year) {
  var lastDay = new Date(year, date.getMonth() + 1, 0, 12, 0, 0, 0).getDate();
  return new Date(year, date.getMonth(), Math.min(date.getDate(), lastDay), 12, 0, 0, 0);
}

/** @param {Date} from @param {Date} to @returns {number} */
function anniversaryDiffDays(from, to) {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/** @param {Date} date @param {Date} today @returns {Date} */
function anniversaryNextOccurrence(date, today) {
  var occurrence = anniversaryDateForYear(date, today.getFullYear());
  return anniversaryDiffDays(today, occurrence) >= 0
    ? occurrence
    : anniversaryDateForYear(date, today.getFullYear() + 1);
}

/** @param {Date} date @param {Date} today @returns {number} */
function anniversaryCycleProgress(date, today) {
  var next = anniversaryNextOccurrence(date, today);
  var previous = anniversaryDateForYear(date, next.getFullYear() - 1);
  if (anniversaryDiffDays(today, next) === 0) return 1;
  var total = Math.max(1, anniversaryDiffDays(previous, next));
  return Math.min(1, Math.max(0, anniversaryDiffDays(previous, today) / total));
}

/** @param {Date} date @param {AnniversaryResolvedConfig} config @returns {string} */
function anniversaryFormatDate(date, config) {
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  if (config.dateFormat === "cn") return year + "年" + month + "月" + day + "日";
  var mm = String(month).padStart(2, "0");
  var dd = String(day).padStart(2, "0");
  return config.dateFormat === "slash" ? year + "/" + mm + "/" + dd : year + "." + mm + "." + dd;
}

/**
 * @param {AnniversaryResolvedConfig} config
 * @returns {{ days: number, direction: "future" | "past" | "today", label: string, date: Date, progress: number }}
 */
function anniversaryState(config) {
  var originalDate = anniversaryParseDate(config.date);
  if (!originalDate) throw new Error("日期格式应为 YYYY-MM-DD");
  var today = anniversaryToday();
  var displayDate = originalDate;
  if (config.repeatAnnual && config.mode !== "countup") {
    displayDate = anniversaryNextOccurrence(originalDate, today);
  }
  var diff = anniversaryDiffDays(today, displayDate);
  var direction = diff === 0 ? "today" : (diff > 0 ? "future" : "past");
  var days = Math.abs(diff);
  if (config.mode === "countup") {
    var countupDiff = anniversaryDiffDays(originalDate, today);
    direction = countupDiff === 0 ? "today" : (countupDiff > 0 ? "past" : "future");
    days = Math.abs(countupDiff);
    displayDate = originalDate;
  }
  var automaticLabel = direction === "today"
    ? "就是今天"
    : (direction === "future" ? "距离这一天还有" : "已经一起走过");
  return {
    days: days,
    direction: direction,
    label: config.label || automaticLabel,
    date: displayDate,
    progress: anniversaryCycleProgress(originalDate, today)
  };
}

/** @param {HTMLElement} container @returns {HTMLElement} */
function anniversaryEnsureMarkup(container) {
  var shell = /** @type {HTMLElement | null} */ (container.querySelector("[data-anniversary-shell]"));
  if (shell && shell.querySelector("[data-anniversary-days]")) return shell;
  container.innerHTML = [
    '<section class="anniversary-widget" data-anniversary-shell data-size="4x2" data-style="starlight" role="timer">',
    '  <div class="anniversary-backdrop" data-anniversary-backdrop aria-hidden="true"></div>',
    '  <div class="anniversary-pattern" aria-hidden="true"></div>',
    '  <header class="anniversary-header">',
    '    <span class="anniversary-icon" data-anniversary-icon aria-hidden="true">♡</span>',
    '    <span class="anniversary-label" data-anniversary-label>距离这一天还有</span>',
    '  </header>',
    '  <div class="anniversary-time">',
    '    <strong data-anniversary-days>0</strong><span data-anniversary-unit>天</span>',
    '  </div>',
    '  <div class="anniversary-copy">',
    '    <h2 data-anniversary-title>我们的纪念日</h2>',
    '    <p data-anniversary-subtitle></p>',
    '  </div>',
    '  <footer class="anniversary-footer">',
    '    <time data-anniversary-date>2026.12.31</time>',
    '    <span class="anniversary-progress-label" data-anniversary-progress-label>年度轨迹 0%</span>',
    '    <div class="anniversary-progress" data-anniversary-progress><i></i><b></b></div>',
    '  </footer>',
    '</section>'
  ].join("");
  return /** @type {HTMLElement} */ (container.querySelector("[data-anniversary-shell]"));
}

/** @param {HTMLElement} shell @param {string} property @param {string} value @param {boolean} enabled */
function anniversarySetCustomProperty(shell, property, value, enabled) {
  if (enabled) shell.style.setProperty(property, value);
  else shell.style.removeProperty(property);
}

/** @param {HTMLElement} container @param {XingchenWidgetProps} props */
function anniversaryRender(container, props) {
  var shell = anniversaryEnsureMarkup(container);
  var config = anniversaryResolvedConfig(props || {});
  var size = props && props.size ? props.size : "4x2";
  var hostScale = xingchenNumber(props && props.scale, 1, 0.1, 2);
  var hostFontScale = xingchenNumber(props && props.fontScale, 1, 0.6, 1.2);
  var hostPrimary = xingchenColor(props && props.primaryColor, "#8B5CF6");
  shell.setAttribute("data-size", size);
  shell.setAttribute("data-layout-version", "3");
  shell.setAttribute("data-style", config.style);
  shell.setAttribute("data-align", config.alignment);
  shell.setAttribute("data-host-theme", xingchenHostTheme(props || {}));
  shell.setAttribute("data-show-icon", String(config.showIcon));
  shell.setAttribute("data-show-date", String(config.showDate));
  shell.setAttribute("data-show-progress", String(config.showProgress));
  shell.style.setProperty("--anniversary-host-scale", String(hostScale));
  shell.style.setProperty("--anniversary-host-font-scale", String(hostFontScale));
  shell.style.setProperty("--anniversary-host-primary", hostPrimary);
  var state;
  try {
    state = anniversaryState(config);
  } catch (error) {
    shell.setAttribute("data-state", "error");
    shell.setAttribute("aria-label", xingchenErrorMessage(error));
    /** @type {HTMLElement} */ (shell.querySelector("[data-anniversary-label]")).textContent = "日期无法使用";
    /** @type {HTMLElement} */ (shell.querySelector("[data-anniversary-title]")).textContent = xingchenErrorMessage(error);
    /** @type {HTMLElement} */ (shell.querySelector("[data-anniversary-days]")).textContent = "—";
    return;
  }

  var backdrop = /** @type {HTMLElement} */ (shell.querySelector("[data-anniversary-backdrop]"));
  var icon = /** @type {HTMLElement} */ (shell.querySelector("[data-anniversary-icon]"));
  var label = /** @type {HTMLElement} */ (shell.querySelector("[data-anniversary-label]"));
  var days = /** @type {HTMLElement} */ (shell.querySelector("[data-anniversary-days]"));
  var unit = /** @type {HTMLElement} */ (shell.querySelector("[data-anniversary-unit]"));
  var title = /** @type {HTMLElement} */ (shell.querySelector("[data-anniversary-title]"));
  var subtitle = /** @type {HTMLElement} */ (shell.querySelector("[data-anniversary-subtitle]"));
  var date = /** @type {HTMLElement} */ (shell.querySelector("[data-anniversary-date]"));
  var progress = /** @type {HTMLElement} */ (shell.querySelector("[data-anniversary-progress]"));
  var progressLabel = /** @type {HTMLElement} */ (shell.querySelector("[data-anniversary-progress-label]"));
  var progressPercent = Math.round(state.progress * 100);

  container.style.background = "transparent";
  container.ownerDocument.documentElement.style.background = "transparent";
  if (container.ownerDocument.body) container.ownerDocument.body.style.background = "transparent";
  shell.setAttribute("data-direction", state.direction);
  shell.setAttribute("data-digits", String(Math.min(String(state.days).length, 6)));
  var titleLength = Array.from(config.title.trim()).length;
  shell.setAttribute("data-title-length", titleLength > 14 ? "very-long" : titleLength > 8 ? "long" : "normal");
  shell.setAttribute("data-state", "ready");
  shell.setAttribute("data-has-image", String(Boolean(config.backgroundImage)));
  shell.style.setProperty("--anniversary-radius", config.cornerRadius + "px");
  shell.style.setProperty("--anniversary-number-scale", String(config.numberScale));
  shell.style.setProperty("--anniversary-overlay-opacity", String(config.overlayOpacity));
  shell.style.setProperty("--anniversary-progress-value", progressPercent + "%");
  anniversarySetCustomProperty(shell, "--anniversary-accent", config.accentColor, config.useCustomColors);
  anniversarySetCustomProperty(shell, "--anniversary-background", config.backgroundColor, config.useCustomColors);
  anniversarySetCustomProperty(shell, "--anniversary-text", config.textColor, config.useCustomColors);
  anniversarySetCustomProperty(shell, "--anniversary-muted", config.mutedColor, config.useCustomColors);
  backdrop.style.backgroundImage = config.backgroundImage ? 'url("' + config.backgroundImage.replace(/"/g, "%22") + '")' : "none";
  icon.textContent = config.icon;
  label.textContent = state.label;
  days.textContent = String(state.days);
  unit.textContent = config.unit;
  title.textContent = config.title;
  subtitle.textContent = config.subtitle;
  subtitle.hidden = !config.subtitle;
  date.textContent = anniversaryFormatDate(state.date, config);
  progressLabel.textContent = "年度轨迹 " + progressPercent + "%";
  progress.setAttribute("aria-label", "年度轨迹 " + progressPercent + "%");
  shell.setAttribute("aria-label", state.label + " " + state.days + " " + config.unit + "，" + config.title);
}

Tapp.widgets["anniversary"] = {
  render: anniversaryRender
};

/** @typedef {"email" | "qq" | "wechat" | "telegram" | "github" | "gitee" | "bilibili" | "custom"} PersonalPlatform */
/**
 * @typedef {Object} PersonalResolvedConfig
 * @property {PersonalPlatform} platform
 * @property {string} title
 * @property {string} content
 * @property {string} customIcon
 * @property {string} customSvg
 * @property {boolean} showIcon
 * @property {string} accentColor
 * @property {string} cardColor
 * @property {string} titleColor
 * @property {string} contentColor
 * @property {string} iconColor
 * @property {number} cornerRadius
 * @property {number} iconRadius
 */

/** @type {Record<PersonalPlatform, { title: string, color: string }>} */
var PERSONAL_PLATFORM_META = {
  email: { title: "E-mail", color: "#2F68B2" },
  qq: { title: "QQ", color: "#1EBAFC" },
  wechat: { title: "微信", color: "#07C160" },
  telegram: { title: "Telegram", color: "#229ED9" },
  github: { title: "GitHub", color: "#24292F" },
  gitee: { title: "Gitee", color: "#C71D23" },
  bilibili: { title: "哔哩哔哩", color: "#00AEEC" },
  custom: { title: "个人信息", color: "#7C3AED" }
};

/** @param {unknown} value @returns {PersonalPlatform} */
function personalPlatform(value) {
  var platform = xingchenText(value).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PERSONAL_PLATFORM_META, platform)
    ? /** @type {PersonalPlatform} */ (platform)
    : "email";
}

/** @param {string} value @param {number} length @returns {string} */
function personalLimitCharacters(value, length) {
  return Array.from(value).slice(0, length).join("");
}

/** @param {XingchenWidgetProps} props @returns {PersonalResolvedConfig} */
function personalResolvedConfig(props) {
  var config = props && (props.config || props.settings) ? (props.config || props.settings || {}) : {};
  var platform = personalPlatform(config.platform);
  var meta = PERSONAL_PLATFORM_META[platform];
  var useBrandColor = xingchenBoolean(config.useBrandColor, true);
  return {
    platform: platform,
    title: (xingchenText(config.title).trim() || meta.title).slice(0, 48),
    content: (xingchenText(config.content).trim() || "未填写内容").slice(0, 160),
    customIcon: personalLimitCharacters(xingchenText(config.customIcon).trim() || "✦", 2),
    customSvg: xingchenText(config.customSvg).trim().slice(0, 12000),
    showIcon: xingchenBoolean(config.showIcon, true),
    accentColor: useBrandColor ? meta.color : xingchenColor(config.accentColor, meta.color),
    cardColor: xingchenColor(config.cardColor, "#DCE5FA"),
    titleColor: xingchenColor(config.titleColor, "#111827"),
    contentColor: xingchenColor(config.contentColor, "#5B6478"),
    iconColor: xingchenColor(config.iconColor, "#FFFFFF"),
    cornerRadius: xingchenNumber(config.cornerRadius, 42, 0, 80),
    iconRadius: xingchenNumber(config.iconRadius, 16, 0, 32)
  };
}

var PERSONAL_SVG_NAMESPACE = "http://www.w3.org/2000/svg";
var PERSONAL_SVG_ELEMENTS = new Set([
  "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon",
  "defs", "lineargradient", "radialgradient", "stop", "text", "tspan"
]);
var PERSONAL_SVG_ATTRIBUTES = new Set([
  "viewbox", "preserveaspectratio", "fill", "fill-rule", "stroke", "stroke-width",
  "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray",
  "stroke-dashoffset", "clip-rule", "opacity", "fill-opacity", "stroke-opacity", "d",
  "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width",
  "height", "points", "transform", "offset", "stop-color", "stop-opacity", "id",
  "gradientunits", "gradienttransform", "font-size", "font-weight", "text-anchor",
  "dominant-baseline", "dx", "dy"
]);

/** @param {string} value @returns {boolean} */
function personalSafeSvgAttributeValue(value) {
  var normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 4096) return false;
  if (/javascript:|vbscript:|data:|https?:|expression\s*\(|@import|<|>/i.test(normalized)) return false;
  if (normalized.indexOf("url(") !== -1 && !/^url\(#[a-z_][a-z0-9_.:-]{0,63}\)$/i.test(normalized)) {
    return false;
  }
  return true;
}

/** @param {Element} source @param {Document} documentRef @returns {Element | null} */
function personalCloneSafeSvgElement(source, documentRef) {
  var tagName = source.localName.toLowerCase();
  if (!PERSONAL_SVG_ELEMENTS.has(tagName)) return null;
  var clone = documentRef.createElementNS(PERSONAL_SVG_NAMESPACE, source.localName);
  for (var attributeIndex = 0; attributeIndex < source.attributes.length; attributeIndex += 1) {
    var attribute = source.attributes[attributeIndex];
    var attributeName = attribute.name.toLowerCase();
    if (!PERSONAL_SVG_ATTRIBUTES.has(attributeName)) continue;
    if (!personalSafeSvgAttributeValue(attribute.value)) continue;
    clone.setAttribute(attribute.name, attribute.value);
  }
  for (var childIndex = 0; childIndex < source.childNodes.length; childIndex += 1) {
    var child = source.childNodes[childIndex];
    if (child.nodeType === Node.TEXT_NODE && (tagName === "text" || tagName === "tspan")) {
      clone.appendChild(documentRef.createTextNode((child.textContent || "").slice(0, 120)));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      var safeChild = personalCloneSafeSvgElement(/** @type {Element} */ (child), documentRef);
      if (safeChild) clone.appendChild(safeChild);
    }
  }
  return clone;
}

/** @param {string} rawSvg @returns {string} */
function personalSanitizeSvg(rawSvg) {
  if (!rawSvg) return "";
  try {
    var parser = new DOMParser();
    var parsed = parser.parseFromString(rawSvg, "image/svg+xml");
    var sourceRoot = parsed.documentElement;
    if (!sourceRoot || sourceRoot.localName.toLowerCase() !== "svg" || parsed.querySelector("parsererror")) {
      return "";
    }
    var safeDocument = document.implementation.createDocument(PERSONAL_SVG_NAMESPACE, "svg", null);
    var safeRoot = personalCloneSafeSvgElement(sourceRoot, safeDocument);
    if (!safeRoot || safeRoot.localName.toLowerCase() !== "svg") return "";
    if (!safeRoot.getAttribute("viewBox")) safeRoot.setAttribute("viewBox", "0 0 24 24");
    safeRoot.removeAttribute("width");
    safeRoot.removeAttribute("height");
    safeRoot.setAttribute("aria-hidden", "true");
    safeRoot.setAttribute("focusable", "false");
    return new XMLSerializer().serializeToString(safeRoot);
  } catch (_error) {
    return "";
  }
}

/** @param {PersonalPlatform} platform @returns {string} */
function personalIconSvg(platform) {
  var open = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">';
  var close = "</svg>";
  if (platform === "email") {
    return open
      + '<rect x="3.5" y="5.5" width="17" height="13" rx="2.2" fill="none" stroke="currentColor" stroke-width="2"/>'
      + '<path d="m5 7 7 5 7-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      + close;
  }
  if (platform === "qq") {
    return open
      + '<path d="M21.395 15.035a40 40 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a39 39 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673" fill="currentColor"/>'
      + close;
  }
  if (platform === "wechat") {
    return open
      + '<path d="M10.4 4.2c-4 0-7.2 2.6-7.2 5.8 0 1.8 1 3.4 2.7 4.5l-.7 2.3 2.7-1.3c.8.2 1.6.3 2.5.3 4 0 7.2-2.6 7.2-5.8s-3.2-5.8-7.2-5.8Z" fill="currentColor"/>'
      + '<path d="M15.2 9.4c3.1 0 5.6 2 5.6 4.5 0 1.4-.8 2.7-2.1 3.5l.5 1.9-2.1-1c-.6.2-1.3.2-1.9.2-3.1 0-5.6-2-5.6-4.5s2.5-4.6 5.6-4.6Z" fill="currentColor" stroke="var(--personal-accent)" stroke-width="1.2"/>'
      + '<circle cx="7.8" cy="9.4" r=".8" fill="var(--personal-accent)"/><circle cx="12.6" cy="9.4" r=".8" fill="var(--personal-accent)"/>'
      + '<circle cx="13.5" cy="13.7" r=".65" fill="var(--personal-accent)"/><circle cx="17" cy="13.7" r=".65" fill="var(--personal-accent)"/>'
      + close;
  }
  if (platform === "telegram") {
    return open
      + '<path d="M23.91 3.79 20.3 20.84c-.27 1.21-.98 1.5-1.99.93l-5.5-4.05-2.65 2.55c-.29.29-.54.54-1.11.54l.39-5.6L19.64 6c.44-.39-.1-.61-.68-.22L6.35 13.72.92 12.02c-1.18-.37-1.2-1.18.25-1.75L22.4 2.09c.98-.36 1.84.24 1.51 1.7Z" fill="currentColor"/>'
      + close;
  }
  if (platform === "github") {
    return open
      + '<path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.84a9.5 9.5 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>'
      + close;
  }
  if (platform === "gitee") {
    return open
      + '<path d="M5.2 3.5h13.6c1 0 1.7.8 1.7 1.7v2.2H8.4c-.6 0-1 .4-1 1v7.2c0 .6.4 1 1 1h7.2c.6 0 1-.4 1-1v-2.1h-5.2v-3.9h9.1v8.2c0 1.5-1.2 2.7-2.7 2.7H6.2a2.7 2.7 0 0 1-2.7-2.7V5.2c0-1 .8-1.7 1.7-1.7Z" fill="currentColor"/>'
      + close;
  }
  if (platform === "bilibili") {
    return open
      + '<path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z" fill="currentColor"/>'
      + close;
  }
  return "";
}

/** @param {HTMLElement} container @returns {HTMLElement} */
function personalEnsureMarkup(container) {
  var shell = /** @type {HTMLElement | null} */ (container.querySelector("[data-personal-shell]"));
  if (shell) return shell;
  container.innerHTML = [
    '<section class="personal-widget" data-personal-shell data-size="4x1" data-show-icon="true" role="group" aria-label="个人信息">',
    '  <span class="personal-icon" data-personal-icon aria-hidden="true"></span>',
    '  <span class="personal-copy">',
    '    <strong class="personal-title" data-personal-title>E-mail</strong>',
    '    <span class="personal-content" data-personal-content>your@email.com</span>',
    '  </span>',
    '</section>'
  ].join("");
  return /** @type {HTMLElement} */ (container.querySelector("[data-personal-shell]"));
}

/** @param {HTMLElement} container @param {XingchenWidgetProps} props */
function personalRender(container, props) {
  var shell = personalEnsureMarkup(container);
  var iconField = /** @type {HTMLElement} */ (shell.querySelector("[data-personal-icon]"));
  var titleField = /** @type {HTMLElement} */ (shell.querySelector("[data-personal-title]"));
  var contentField = /** @type {HTMLElement} */ (shell.querySelector("[data-personal-content]"));
  var config = personalResolvedConfig(props || {});

  container.style.background = "transparent";
  container.ownerDocument.documentElement.style.background = "transparent";
  if (container.ownerDocument.body) container.ownerDocument.body.style.background = "transparent";
  shell.setAttribute("data-size", props && props.size ? props.size : "4x1");
  shell.setAttribute("data-platform", config.platform);
  shell.setAttribute("data-show-icon", String(config.showIcon));
  shell.style.setProperty("--personal-accent", config.accentColor);
  shell.style.setProperty("--personal-card", config.cardColor);
  shell.style.setProperty("--personal-title", config.titleColor);
  shell.style.setProperty("--personal-content", config.contentColor);
  shell.style.setProperty("--personal-icon-color", config.iconColor);
  shell.style.setProperty("--personal-radius", config.cornerRadius + "px");
  shell.style.setProperty("--personal-icon-radius", config.iconRadius + "px");

  iconField.innerHTML = "";
  if (config.platform === "custom") {
    var safeCustomSvg = personalSanitizeSvg(config.customSvg);
    if (safeCustomSvg) iconField.innerHTML = safeCustomSvg;
    else iconField.textContent = config.customIcon;
  } else {
    iconField.innerHTML = personalIconSvg(config.platform);
  }
  titleField.textContent = config.title;
  contentField.textContent = config.content;
  shell.setAttribute("aria-label", config.title + "，" + config.content);
  shell.title = config.title + " · " + config.content;
}

Tapp.widgets["personal-info"] = {
  render: personalRender
};

Tapp.lifecycle.onDestroy(function () {
  XINGCHEN_THEME_UNSUBSCRIBERS.forEach(function (unsubscribe) {
    try {
      unsubscribe();
    } catch (_error) {
      // Ignore teardown failures from an already-disposed host subscription.
    }
  });
  XINGCHEN_THEME_UNSUBSCRIBERS.clear();
  XINGCHEN_INSTANCE_PROPS = new WeakMap();
  XINGCHEN_THEME_BOUND = new WeakSet();
  XINGCHEN_RENDER_TOKENS = new WeakMap();
});
