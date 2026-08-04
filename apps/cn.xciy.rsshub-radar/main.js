(function () {
  "use strict";

  var STORAGE_SAVED = "rsshub-radar.saved.v1";
  var STORAGE_HISTORY = "rsshub-radar.history.v1";
  var STORAGE_SETTINGS = "rsshub-radar.settings.v1";
  var STORAGE_PREVIEW_CACHE = "rsshub-radar.preview-cache.v1";
  var MAX_RESULTS = 36;
  var MAX_HISTORY = 8;
  var MAX_PREVIEW_CACHE = 12;
  var MAX_PREVIEW_AGE = 7 * 24 * 60 * 60 * 1000;
  var PREVIEW_INSTANCE = "https://rsshub.app";

  var state = {
    bucketCache: {},
    rulesMeta: null,
    results: [],
    selected: null,
    saved: [],
    history: [],
    previewCache: {},
    instance: "https://rsshub.app",
    listeners: [],
  };

  var readers = [
    {
      name: "Follow",
      color: "#ff5c00",
      build: function (feedUrl) { return "follow://add?url=" + encodeURIComponent(feedUrl); },
    },
    {
      name: "Feedly",
      color: "#2bb24c",
      build: function (feedUrl) { return "https://feedly.com/i/subscription/feed/" + encodeURIComponent(feedUrl); },
    },
    {
      name: "Inoreader",
      color: "#0099eb",
      build: function (feedUrl) { return "https://www.inoreader.com/?add_feed=" + encodeURIComponent(feedUrl); },
    },
    {
      name: "FreshRSS",
      color: "#0062db",
      build: function (feedUrl) { return "https://demo.freshrss.org/i/?c=feed&a=add&url_rss=" + encodeURIComponent(feedUrl); },
    },
    {
      name: "Miniflux",
      color: "#33995b",
      build: function (feedUrl) { return "https://reader.miniflux.app/bookmarklet?uri=" + encodeURIComponent(feedUrl); },
    },
    {
      name: "The Old Reader",
      color: "#ff493b",
      build: function (feedUrl) { return "https://theoldreader.com/feeds/subscribe?url=" + encodeURIComponent(feedUrl); },
    },
    {
      name: "NewsBlur",
      color: "#eebd10",
      build: function (feedUrl) { return "https://newsblur.com/?url=" + encodeURIComponent(feedUrl); },
    },
    {
      name: "系统阅读器",
      color: "#58f2d0",
      build: function (feedUrl) { return "feed://" + feedUrl.replace(/^https?:\/\//, ""); },
    },
  ];

  function query(selector, root) {
    return (root || document).querySelector(selector);
  }

  function queryAll(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function create(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function listen(target, type, handler) {
    if (!target) return;
    target.addEventListener(type, handler);
    state.listeners.push(function () { target.removeEventListener(type, handler); });
  }

  function errorMessage(error) {
    if (!error) return "未知错误";
    if (typeof error === "string") return error;
    return error.message || String(error);
  }

  function showToast(message, type) {
    var toast = query("[data-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.className = "radar-toast show " + (type || "info");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      toast.className = "radar-toast";
    }, 2800);
  }

  async function notify(message, type) {
    var kind = type || "info";
    showToast(message, kind);
    try {
      if (Tapp.ui && typeof Tapp.ui.showNotification === "function") {
        await Tapp.ui.showNotification({
          title: kind === "success" ? "已完成" : kind === "error" ? "无法完成" : "RSSHub 雷达",
          message: message,
          type: kind,
          duration: 2800,
        });
      }
    } catch (error) {
      console.warn("[RSSHub Radar] notification failed", error);
    }
  }

  function applyTheme(theme) {
    var dark = theme === true || String(theme).toLowerCase() === "dark";
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
    if (document.body) {
      document.body.classList.toggle("dark", dark);
      document.body.classList.toggle("light", !dark);
    }
  }

  async function bindTheme() {
    try {
      if (Tapp.ui && typeof Tapp.ui.getTheme === "function") {
        applyTheme(await Tapp.ui.getTheme());
      } else if (window.matchMedia) {
        applyTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      }
      if (Tapp.ui && typeof Tapp.ui.onThemeChange === "function") {
        var stop = Tapp.ui.onThemeChange(applyTheme);
        if (typeof stop === "function") state.listeners.push(stop);
      }
    } catch (error) {
      console.warn("[RSSHub Radar] theme bridge failed", error);
    }
  }

  async function readAssetJson(path) {
    var asset = await Tapp.assets.getArrayBuffer(path);
    var text = new TextDecoder("utf-8").decode(asset.buffer);
    return JSON.parse(text);
  }

  async function loadRulesMeta() {
    try {
      state.rulesMeta = await readAssetJson("assets/rules/index.json");
      var domainCount = query("[data-domain-count]");
      var ruleCount = query("[data-rule-count]");
      if (domainCount) domainCount.textContent = Number(state.rulesMeta.domainCount || 0).toLocaleString("zh-CN");
      if (ruleCount) ruleCount.textContent = Number(state.rulesMeta.ruleCount || 0).toLocaleString("zh-CN");
    } catch (error) {
      console.error("[RSSHub Radar] rule index failed", error);
      await notify("规则索引无法读取，请重新安装应用", "error");
    }
  }

  function bucketFor(domain) {
    var first = String(domain || "").charAt(0).toLowerCase();
    return /^[a-z0-9]$/.test(first) ? first : "other";
  }

  async function loadBucket(bucket) {
    if (state.bucketCache[bucket]) return state.bucketCache[bucket];
    var payload = await readAssetJson("assets/rules/" + bucket + ".json");
    state.bucketCache[bucket] = payload.domains || {};
    return state.bucketCache[bucket];
  }

  function normalizeInputUrl(value) {
    var input = String(value || "").trim();
    if (!input) throw new Error("请输入网页地址");
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) input = "https://" + input;
    var parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("仅支持 HTTP 或 HTTPS 网页地址");
    }
    return parsed;
  }

  function normalizeInstance(value) {
    var parsed = normalizeInputUrl(value || "https://rsshub.app");
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/+$/, "");
  }

  function canPreviewInstance(value) {
    try { return normalizeInstance(value) === PREVIEW_INSTANCE; } catch (error) { return false; }
  }

  function candidateDomains(hostname) {
    var labels = hostname.toLowerCase().replace(/^\.+|\.+$/g, "").split(".").filter(Boolean);
    var result = [];
    for (var i = 0; i < labels.length; i += 1) result.push(labels.slice(i).join("."));
    return result;
  }

  async function findDomainRules(hostname) {
    var candidates = candidateDomains(hostname);
    for (var i = 0; i < candidates.length; i += 1) {
      var candidate = candidates[i];
      var bucket = await loadBucket(bucketFor(candidate));
      if (bucket[candidate]) {
        return { domain: candidate, rules: bucket[candidate] };
      }
    }
    return null;
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function safeDecode(value) {
    try { return decodeURIComponent(value); } catch (error) { return value; }
  }

  function compileSource(segments) {
    var names = [];
    var expression = "^";
    if (!segments.length) expression += "/?";
    segments.forEach(function (segment) {
      if (segment.charAt(0) === "*") {
        names.push(segment.slice(1) || "wildcard");
        expression += "/(.*)";
        return;
      }
      if (segment.charAt(0) === ":") {
        var optional = /\?$/.test(segment);
        var name = segment.slice(1).replace(/\?$/, "").replace(/\{[^}]*\}/g, "") || "param";
        names.push(name);
        expression += optional ? "(?:/([^/]+))?" : "/([^/]+)";
        return;
      }
      expression += "/" + escapeRegex(segment);
    });
    expression += "/?$";
    return { regex: new RegExp(expression), names: names };
  }

  function matchSource(source, pathname) {
    if (typeof source !== "string") return null;
    var clean = source.trim();
    if (!clean || clean.charAt(0) !== "/") return null;
    var segments = clean.split("/").filter(Boolean);
    var compiled = compileSource(segments);
    var matched = compiled.regex.exec(pathname || "/");
    if (!matched) return null;
    var params = {};
    compiled.names.forEach(function (name, index) {
      if (matched[index + 1] !== undefined) params[name] = safeDecode(matched[index + 1]);
    });
    return params;
  }

  function docsUrl(rule) {
    var target = rule && typeof rule.target === "string" ? rule.target : "";
    if (target && target.indexOf("=>") < 0) {
      var namespace = target.match(/^\/([^/:?]+)/);
      if (namespace) return "https://docs.rsshub.app/routes/" + namespace[1];
    }
    return rule && rule.docs ? rule.docs : "https://docs.rsshub.app/routes/";
  }

  function buildRoutePath(target, params) {
    if (typeof target !== "string" || !target || target.indexOf("=>") >= 0 || /function\s*\(/.test(target)) {
      return null;
    }
    var missing = false;
    var result = target.replace(/\/:([A-Za-z0-9_]+)(?:\{[^}]*\})?(\?)?(?=\/|$)/g, function (_, name, optional) {
      if (params[name] !== undefined && params[name] !== "") return "/" + encodeURIComponent(params[name]);
      if (optional) return "";
      missing = true;
      return "";
    });
    if (missing || result.indexOf("://") >= 0 || result.indexOf("\\") >= 0 || result.indexOf("//") === 0) return null;
    if (result.charAt(0) !== "/") result = "/" + result;
    return result.replace(/\/{2,}/g, "/");
  }

  function subdomainFor(hostname, domain) {
    if (hostname === domain) return ".";
    return hostname.slice(0, -(domain.length + 1));
  }

  function routeArrays(domainRules, subdomain) {
    var arrays = [];
    function add(value) {
      if (Array.isArray(value) && arrays.indexOf(value) < 0) arrays.push(value);
    }
    add(domainRules[subdomain]);
    if (subdomain === "www") add(domainRules["."]);
    if (subdomain === ".") add(domainRules.www);
    return arrays;
  }

  function addResult(target, seen, result) {
    var key = [result.title, result.path || "", result.docs || ""].join("|");
    if (seen[key] || target.length >= MAX_RESULTS) return;
    seen[key] = true;
    result.id = "route-" + target.length + "-" + Math.random().toString(36).slice(2, 7);
    target.push(result);
  }

  async function matchUrl(parsedUrl) {
    var found = await findDomainRules(parsedUrl.hostname);
    if (!found) return { siteName: parsedUrl.hostname, domain: null, results: [] };

    var domainRules = found.rules;
    var siteName = domainRules._name || found.domain;
    var subdomain = subdomainFor(parsedUrl.hostname.toLowerCase(), found.domain);
    var directArrays = routeArrays(domainRules, subdomain);
    var results = [];
    var seen = {};

    directArrays.forEach(function (rules) {
      rules.forEach(function (rule) {
        var sources = Array.isArray(rule.source) ? rule.source : [rule.source];
        for (var i = 0; i < sources.length; i += 1) {
          var params = matchSource(sources[i], parsedUrl.pathname || "/");
          if (!params) continue;
          var path = buildRoutePath(rule.target, params);
          addResult(results, seen, {
            kind: path ? "route" : "docs",
            title: rule.title || siteName,
            siteName: siteName,
            path: path,
            docs: docsUrl(rule),
            sourceUrl: parsedUrl.toString(),
            matchedSource: sources[i],
          });
          break;
        }
      });
    });

    Object.keys(domainRules).forEach(function (key) {
      if (key.charAt(0) === "_" || !Array.isArray(domainRules[key])) return;
      domainRules[key].forEach(function (rule) {
        addResult(results, seen, {
          kind: "docs",
          title: rule.title || siteName,
          siteName: siteName,
          path: null,
          docs: docsUrl(rule),
          sourceUrl: parsedUrl.toString(),
          matchedSource: null,
        });
      });
    });

    return { siteName: siteName, domain: found.domain, results: results };
  }

  function feedUrlFor(result) {
    if (!result || !result.path) return result && result.docs ? result.docs : "";
    return state.instance.replace(/\/+$/, "") + result.path;
  }

  function xmlEscape(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function buildOpml(items) {
    var outlines = items.filter(function (item) { return item && item.path; }).map(function (item) {
      var title = item.title || item.siteName || item.path;
      return "      <outline type=\"rss\" text=\"" + xmlEscape(title) + "\" title=\"" + xmlEscape(title)
        + "\" xmlUrl=\"" + xmlEscape(feedUrlFor(item)) + "\" htmlUrl=\"" + xmlEscape(item.sourceUrl || "") + "\"/>";
    });
    return [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<opml version=\"2.0\">",
      "  <head>",
      "    <title>RSSHub Radar 收藏路线</title>",
      "    <dateCreated>" + new Date().toUTCString() + "</dateCreated>",
      "  </head>",
      "  <body>",
      "    <outline text=\"RSSHub Radar\" title=\"RSSHub Radar\">",
      outlines.join("\n"),
      "    </outline>",
      "  </body>",
      "</opml>",
      "",
    ].join("\n");
  }

  async function exportSavedOpml() {
    var routes = state.saved.filter(function (item) { return item && item.path; });
    if (!routes.length) {
      await notify("请先收藏至少一条可订阅路线", "error");
      return;
    }
    if (!Tapp.file || typeof Tapp.file.download !== "function") {
      await notify("当前 TApp 运行时不支持文件导出", "error");
      return;
    }
    try {
      var date = new Date().toISOString().slice(0, 10);
      await Tapp.file.download(buildOpml(routes), "rsshub-radar-" + date + ".opml", "text/x-opml;charset=utf-8");
      await notify("已导出 " + routes.length + " 条订阅路线", "success");
    } catch (error) {
      await notify("OPML 导出失败：" + errorMessage(error), "error");
    }
  }

  function setScanning(active) {
    var scanner = query("[data-scanner]");
    var button = query("[data-scan-button]");
    if (scanner) scanner.classList.toggle("is-scanning", active);
    if (button) {
      button.disabled = active;
      query("span", button).textContent = active ? "扫描中" : "扫描路线";
    }
  }

  function setSignal(kind) {
    var scanner = query("[data-scanner]");
    if (scanner) scanner.setAttribute("data-signal", kind);
  }

  function renderResults(siteName) {
    var list = query("[data-result-list]");
    var count = query("[data-result-count]");
    if (!list) return;
    list.textContent = "";
    if (count) count.textContent = state.results.length ? state.results.length + " 条信号" : "未匹配";

    if (!state.results.length) {
      var empty = create("div", "empty-state");
      empty.appendChild(create("span", "empty-line"));
      empty.appendChild(create("h3", "", "没有找到 " + (siteName || "该网站") + " 的路线"));
      empty.appendChild(create("p", "", "该站点可能尚未收录，或者当前地址需要扩展版读取页面内容才能确定参数。可以前往 RSSHub 文档继续搜索。"));
      var docs = create("button", "text-button", "复制 RSSHub 路由文档地址");
      listen(docs, "click", function () { copyText("https://docs.rsshub.app/routes/"); });
      empty.appendChild(docs);
      list.appendChild(empty);
      return;
    }

    state.results.forEach(function (result) {
      var card = create("article", "result-card " + (result.kind === "route" ? "is-route" : "is-docs"));
      card.setAttribute("data-result-id", result.id);
      card.tabIndex = 0;

      var top = create("div", "result-top");
      top.appendChild(create("span", "signal-type", result.kind === "route" ? "当前页面" : "路线文档"));
      top.appendChild(create("span", "site-name", result.siteName));
      card.appendChild(top);
      card.appendChild(create("h3", "", result.title));
      card.appendChild(create("code", "route-code", result.path || result.docs));

      var actions = create("div", "result-actions");
      var tune = create("button", "mini-button primary", "调到此路线");
      var copy = create("button", "mini-button", result.path ? "复制 Feed" : "复制文档");
      actions.appendChild(tune);
      actions.appendChild(copy);
      card.appendChild(actions);

      listen(tune, "click", function (event) {
        event.stopPropagation();
        selectResult(result);
      });
      listen(copy, "click", function (event) {
        event.stopPropagation();
        copyText(feedUrlFor(result));
      });
      listen(card, "click", function () { selectResult(result); });
      listen(card, "keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectResult(result);
        }
      });
      list.appendChild(card);
    });
  }

  function resultStored(result) {
    var target = feedUrlFor(result);
    return state.saved.some(function (item) { return feedUrlFor(item) === target; });
  }

  function selectResult(result) {
    state.selected = result;
    queryAll("[data-result-id]").forEach(function (card) {
      card.classList.toggle("selected", card.getAttribute("data-result-id") === result.id);
    });
    renderSelected();
  }

  function renderSelected() {
    var root = query("[data-selected-route]");
    if (!root) return;
    root.textContent = "";
    if (!state.selected) {
      root.appendChild(create("div", "small-empty", "从左侧选择一条路线，即可复制地址、预览 Feed 或生成阅读器订阅链接。"));
      return;
    }

    var result = state.selected;
    root.appendChild(create("span", "selected-site", result.siteName));
    root.appendChild(create("h3", "selected-title", result.title));
    var url = create("code", "selected-url", feedUrlFor(result));
    root.appendChild(url);

    var actions = create("div", "selected-actions");
    var copy = create("button", "action-button strong", result.path ? "复制 Feed 地址" : "复制文档地址");
    actions.appendChild(copy);
    listen(copy, "click", function () { copyText(feedUrlFor(result)); });

    if (result.path) {
      var previewAvailable = canPreviewInstance(state.instance);
      var preview = create("button", "action-button" + (previewAvailable ? "" : " restricted"), previewAvailable ? "预览 Feed" : "预览受限");
      var save = create("button", "action-button", resultStored(result) ? "取消收藏" : "收藏路线");
      actions.appendChild(preview);
      actions.appendChild(save);
      listen(preview, "click", function () { previewFeed(result); });
      listen(save, "click", function () { toggleSaved(result); });
    }
    root.appendChild(actions);

    if (result.path && !canPreviewInstance(state.instance)) {
      root.appendChild(create("p", "preview-instance-note", "当前实例用于生成订阅地址；应用内不会回退请求 rsshub.app。"));
    }

    if (result.path) {
      root.appendChild(create("p", "reader-label", "复制到阅读器"));
      var readerGrid = create("div", "reader-grid");
      readers.forEach(function (reader) {
        var button = create("button", "reader-button", reader.name);
        button.style.setProperty("--reader-color", reader.color);
        listen(button, "click", function () {
          copyText(reader.build(feedUrlFor(result)), reader.name + " 订阅链接已复制");
        });
        readerGrid.appendChild(button);
      });
      root.appendChild(readerGrid);
    }
  }

  async function copyText(text, successMessage) {
    if (!text) return;
    var copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch (error) {
      copied = false;
    }
    if (!copied) {
      var area = create("textarea");
      area.value = text;
      area.setAttribute("readonly", "readonly");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try { copied = document.execCommand("copy"); } catch (error) { copied = false; }
      area.remove();
    }
    await notify(copied ? (successMessage || "链接已复制") : "无法访问剪贴板，请手动复制", copied ? "success" : "error");
  }

  async function toggleSaved(result) {
    var url = feedUrlFor(result);
    var index = state.saved.findIndex(function (item) { return feedUrlFor(item) === url; });
    if (index >= 0) {
      state.saved.splice(index, 1);
      await notify("已取消收藏", "success");
    } else {
      state.saved.unshift({
        kind: result.kind,
        title: result.title,
        siteName: result.siteName,
        path: result.path,
        docs: result.docs,
        sourceUrl: result.sourceUrl,
        createdAt: Date.now(),
      });
      state.saved = state.saved.slice(0, 30);
      await notify("路线已收藏", "success");
    }
    await saveStorage(STORAGE_SAVED, state.saved);
    renderSaved();
    renderSelected();
  }

  function renderSaved() {
    var list = query("[data-saved-list]");
    var count = query("[data-saved-count]");
    if (!list) return;
    list.textContent = "";
    if (count) count.textContent = String(state.saved.length);
    var exportButton = query("[data-export-opml]");
    if (exportButton) exportButton.disabled = !state.saved.some(function (item) { return item && item.path; });
    if (!state.saved.length) {
      list.appendChild(create("div", "small-empty", "收藏会保存在当前用户的 TApp 私有空间。"));
      return;
    }
    state.saved.forEach(function (item) {
      var row = create("div", "saved-row");
      var open = create("button", "saved-open");
      open.appendChild(create("strong", "", item.title));
      open.appendChild(create("span", "", item.siteName));
      var remove = create("button", "saved-remove", "移除");
      remove.setAttribute("aria-label", "移除收藏 " + item.title);
      row.appendChild(open);
      row.appendChild(remove);
      listen(open, "click", function () {
        state.selected = Object.assign({ id: "saved-" + Date.now() }, item);
        renderSelected();
      });
      listen(remove, "click", function () { toggleSaved(item); });
      list.appendChild(row);
    });
  }

  async function addHistory(url) {
    state.history = state.history.filter(function (item) { return item.url !== url.toString(); });
    state.history.unshift({ url: url.toString(), host: url.hostname, time: Date.now() });
    state.history = state.history.slice(0, MAX_HISTORY);
    await saveStorage(STORAGE_HISTORY, state.history);
    renderHistory();
  }

  function renderHistory() {
    var list = query("[data-history-list]");
    if (!list) return;
    list.textContent = "";
    if (!state.history.length) {
      list.appendChild(create("div", "small-empty", "最近使用的网址会显示在这里。"));
      return;
    }
    state.history.forEach(function (item) {
      var button = create("button", "history-row");
      button.appendChild(create("strong", "", item.host));
      button.appendChild(create("span", "", new Date(item.time).toLocaleDateString("zh-CN")));
      listen(button, "click", function () {
        var input = query("[data-url-input]");
        if (input) input.value = item.url;
        scan(item.url);
      });
      list.appendChild(button);
    });
  }

  async function saveStorage(key, value) {
    try { await Tapp.storage.set(key, value); } catch (error) {
      console.warn("[RSSHub Radar] storage write failed", key, error);
    }
  }

  async function loadStorage() {
    try {
      var values = await Promise.all([
        Tapp.storage.get(STORAGE_SAVED),
        Tapp.storage.get(STORAGE_HISTORY),
        Tapp.storage.get(STORAGE_SETTINGS),
        Tapp.storage.get(STORAGE_PREVIEW_CACHE),
      ]);
      state.saved = Array.isArray(values[0]) ? values[0] : [];
      state.history = Array.isArray(values[1]) ? values[1] : [];
      if (values[2] && values[2].instance) state.instance = normalizeInstance(values[2].instance);
      state.previewCache = values[3] && typeof values[3] === "object" ? values[3] : {};
      prunePreviewCache();
    } catch (error) {
      console.warn("[RSSHub Radar] storage unavailable", error);
    }
    var instance = query("[data-instance-input]");
    if (instance) instance.value = state.instance;
    syncPreviewServiceStatus();
    renderSaved();
    renderHistory();
  }

  async function scan(value) {
    var parsed;
    try {
      parsed = normalizeInputUrl(value);
    } catch (error) {
      await notify(errorMessage(error), "error");
      return;
    }
    setScanning(true);
    setSignal("scanning");
    try {
      var matched = await matchUrl(parsed);
      state.results = matched.results;
      state.selected = state.results.find(function (item) { return item.kind === "route"; }) || state.results[0] || null;
      renderResults(matched.siteName);
      renderSelected();
      setSignal(state.results.length ? "found" : "quiet");
      await addHistory(parsed);
      if (state.results.length) {
        await notify("发现 " + state.results.length + " 条路线信号", "success");
      }
    } catch (error) {
      console.error("[RSSHub Radar] scan failed", error);
      state.results = [];
      state.selected = null;
      renderResults(parsed.hostname);
      renderSelected();
      setSignal("quiet");
      await notify("扫描失败：" + errorMessage(error), "error");
    } finally {
      setScanning(false);
    }
  }

  function safePreviewPath(path) {
    return typeof path === "string"
      && /^\/[A-Za-z0-9%._~!$&'()*+,;=:@/?-]*$/.test(path)
      && path.indexOf("//") !== 0
      && path.indexOf("..") < 0
      && path.indexOf("://") < 0;
  }

  function apiText(response) {
    if (typeof response === "string") return response;
    if (!response || typeof response !== "object") return "";
    var keys = ["body", "data", "content", "text", "result"];
    for (var i = 0; i < keys.length; i += 1) {
      if (typeof response[keys[i]] === "string") return response[keys[i]];
    }
    return "";
  }

  function isCloudflareChallenge(value) {
    return /(?:HTTP\s*403|cloudflare|just a moment|cf[-_ ]?chl)/i.test(String(value || ""));
  }

  function firstText(node, names) {
    for (var i = 0; i < names.length; i += 1) {
      var found = node.getElementsByTagName(names[i])[0];
      if (found && found.textContent) return found.textContent.trim();
    }
    return "";
  }

  function plainText(value) {
    if (!value) return "";
    try {
      var doc = new DOMParser().parseFromString(String(value), "text/html");
      return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
    } catch (error) {
      return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  function parseFeed(xmlText) {
    var xml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xml.getElementsByTagName("parsererror").length) throw new Error("返回内容不是有效的 RSS 或 Atom");
    var root = xml.documentElement;
    var channel = xml.getElementsByTagName("channel")[0] || root;
    var title = firstText(channel, ["title"]) || "RSSHub Feed";
    var description = plainText(firstText(channel, ["description", "subtitle"]));
    var items = Array.prototype.slice.call(xml.getElementsByTagName("item"));
    if (!items.length) items = Array.prototype.slice.call(xml.getElementsByTagName("entry"));
    return {
      title: title,
      description: description,
      items: items.slice(0, 8).map(function (item) {
        var linkNode = item.getElementsByTagName("link")[0];
        var link = linkNode ? (linkNode.getAttribute("href") || linkNode.textContent || "").trim() : "";
        return {
          title: firstText(item, ["title"]) || "未命名条目",
          link: link,
          date: firstText(item, ["pubDate", "published", "updated"]),
          summary: plainText(firstText(item, ["description", "summary", "content"])).slice(0, 600),
        };
      }),
    };
  }

  function setPreviewService(status, message) {
    var node = query("[data-preview-service-status]");
    if (!node) return;
    node.setAttribute("data-state", status || "idle");
    node.textContent = message || "预览服务 rsshub.app · 尚未检测";
  }

  function syncPreviewServiceStatus() {
    if (canPreviewInstance(state.instance)) {
      setPreviewService("idle", "应用内预览 · rsshub.app 尚未检测");
      return;
    }
    var host = "自定义实例";
    try { host = new URL(state.instance).host || host; } catch (error) { /* validated before storage */ }
    setPreviewService("custom", "当前实例 " + host + " · 仅生成链接");
  }

  function prunePreviewCache() {
    var now = Date.now();
    var entries = Object.keys(state.previewCache || {}).map(function (path) {
      return { path: path, value: state.previewCache[path] };
    }).filter(function (entry) {
      return entry.value && entry.value.feed && Number(entry.value.savedAt) > now - MAX_PREVIEW_AGE;
    }).sort(function (left, right) {
      return Number(right.value.savedAt) - Number(left.value.savedAt);
    }).slice(0, MAX_PREVIEW_CACHE);
    state.previewCache = {};
    entries.forEach(function (entry) { state.previewCache[entry.path] = entry.value; });
  }

  async function cachePreview(path, feed) {
    state.previewCache[path] = { feed: feed, savedAt: Date.now() };
    prunePreviewCache();
    await saveStorage(STORAGE_PREVIEW_CACHE, state.previewCache);
  }

  function cachedPreview(path) {
    prunePreviewCache();
    return state.previewCache[path] || null;
  }

  function previewFailureKind(message) {
    if (isCloudflareChallenge(message)) return "blocked";
    if (/timeout|timed out|超时|abort/i.test(message)) return "timeout";
    if (/有效的 RSS|Atom|XML|parser/i.test(message)) return "invalid";
    return "unavailable";
  }

  function previewFailureCopy(kind, message) {
    if (kind === "blocked") return "rsshub.app 要求完成 Cloudflare 验证，TApp 无法代为通过。";
    if (kind === "timeout") return "rsshub.app 响应超时。";
    if (kind === "invalid") return "服务返回的内容不是有效的 RSS 或 Atom。";
    var safeMessage = plainText(message).slice(0, 180) || "服务没有返回可读取的内容";
    return "实时预览不可用：" + safeMessage + "。";
  }

  function renderFeed(feed, options) {
    options = options || {};
    var panel = query("[data-feed-panel]");
    var title = query("[data-feed-title]");
    var description = query("[data-feed-description]");
    var items = query("[data-feed-items]");
    if (!panel || !items) return;
    panel.hidden = false;
    if (title) title.textContent = feed.title;
    if (description) {
      var cacheText = options.cached && options.savedAt
        ? "缓存于 " + new Date(options.savedAt).toLocaleString("zh-CN") + " · "
        : "";
      description.textContent = cacheText + (feed.description || "最新条目");
    }
    items.textContent = "";
    if (options.cached) {
      var notice = create("div", "feed-notice", "实时服务暂时不可用，当前显示最近一次成功预览。可稍后重试或复制 Feed 地址到阅读器。");
      items.appendChild(notice);
    }
    if (!feed.items.length) {
      items.appendChild(create("div", "feed-empty", "Feed 已返回，但没有可显示的条目。"));
    }
    feed.items.forEach(function (item) {
      var article = create("article", "feed-item");
      var meta = create("div", "feed-meta");
      meta.appendChild(create("span", "", item.date ? formatDate(item.date) : "日期未知"));
      if (item.link) {
        var copy = create("button", "feed-copy", "复制文章地址");
        listen(copy, "click", function () { copyText(item.link); });
        meta.appendChild(copy);
      }
      article.appendChild(meta);
      article.appendChild(create("h3", "", item.title));
      if (item.summary) article.appendChild(create("p", "", item.summary.slice(0, 240)));
      items.appendChild(article);
    });
    panel.scrollIntoView({ behavior: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  function formatDate(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  async function previewFeed(result) {
    if (!canPreviewInstance(state.instance)) {
      await notify("当前实例未在 TApp Manifest 中声明，无法应用内预览；已阻止回退到 rsshub.app。请复制 Feed 地址到阅读器验证。", "error");
      return;
    }
    if (!result || !safePreviewPath(result.path)) {
      await notify("该路线不能安全预览，请复制地址后在阅读器中验证", "error");
      return;
    }
    var panel = query("[data-feed-panel]");
    var title = query("[data-feed-title]");
    var description = query("[data-feed-description]");
    var items = query("[data-feed-items]");
    if (panel) panel.hidden = false;
    if (title) title.textContent = "正在接收 Feed…";
    if (description) description.textContent = result.path;
    if (items) items.textContent = "";
    setPreviewService("loading", "预览服务 rsshub.app · 正在连接");
    try {
      var response = await Tapp.api("previewFeed", { path: result.path });
      var text = apiText(response);
      if (!text) throw new Error("RSSHub 没有返回可读取的 XML 内容");
      if (isCloudflareChallenge(text)) throw new Error("rsshub.app 当前被 Cloudflare 拦截（HTTP 403）");
      var feed = parseFeed(text);
      renderFeed(feed);
      setPreviewService("online", "预览服务 rsshub.app · 正常");
      await cachePreview(result.path, feed);
    } catch (error) {
      var message = errorMessage(error);
      var kind = previewFailureKind(message);
      var cached = cachedPreview(result.path);
      setPreviewService(kind, "预览服务 rsshub.app · " + (kind === "blocked" ? "访问受限" : kind === "timeout" ? "连接超时" : "异常"));
      if (cached) {
        renderFeed(cached.feed, { cached: true, savedAt: cached.savedAt });
        await notify("实时预览失败，已显示缓存内容", "info");
        return;
      }
      if (items) {
        items.textContent = "";
        var failure = create("div", "feed-empty error");
        failure.appendChild(create("p", "", previewFailureCopy(kind, message) + " 可以复制 Feed 地址到阅读器验证。"));
        var retry = create("button", "feed-retry", "重新尝试");
        listen(retry, "click", function () { previewFeed(result); });
        failure.appendChild(retry);
        items.appendChild(failure);
      }
      await notify(kind === "blocked" ? "rsshub.app 暂时拒绝了 Feed 预览" : "Feed 预览失败", "error");
    }
  }

  function bindControls() {
    var form = query("[data-search-form]");
    var input = query("[data-url-input]");
    var instance = query("[data-instance-input]");
    var scanButton = query("[data-scan-button]");
    function submitScan(event) {
      event.preventDefault();
      scan(input ? input.value : "");
    }
    listen(form, "submit", submitScan);
    listen(scanButton, "click", submitScan);
    queryAll("[data-example-url]").forEach(function (button) {
      listen(button, "click", function () {
        if (input) input.value = button.getAttribute("data-example-url") || "";
        scan(input ? input.value : "");
      });
    });
    listen(instance, "change", async function () {
      try {
        state.instance = normalizeInstance(instance.value);
        instance.value = state.instance;
        await saveStorage(STORAGE_SETTINGS, { instance: state.instance });
        var panel = query("[data-feed-panel]");
        if (panel) panel.hidden = true;
        syncPreviewServiceStatus();
        renderSelected();
        renderSaved();
        await notify("RSSHub 实例已保存", "success");
      } catch (error) {
        instance.value = state.instance;
        await notify("实例地址无效", "error");
      }
    });
    listen(query("[data-close-preview]"), "click", function () {
      var panel = query("[data-feed-panel]");
      if (panel) panel.hidden = true;
    });
    listen(query("[data-export-opml]"), "click", exportSavedOpml);
  }

  async function initPage() {
    bindControls();
    bindTheme();
    await Promise.all([loadRulesMeta(), loadStorage()]);
  }

  if (window._TAPP_MODE === "page" || window._TAPP_HAS_HTML) {
    Tapp.lifecycle.onReady(initPage);
  }
  Tapp.lifecycle.onDestroy(function () {
    clearTimeout(showToast.timer);
    state.listeners.forEach(function (stop) {
      try { stop(); } catch (error) { /* iframe is being destroyed */ }
    });
    state.listeners = [];
    if (Tapp.assets && typeof Tapp.assets.revokeAll === "function") Tapp.assets.revokeAll();
  });
})();
