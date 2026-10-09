/**
 * 搜索引擎收录提交 · core
 *
 * 三条提交路径共用同一段提交实现（submitToProvider）：
 *   1. 手动提交：页面里粘贴 URL 后点「提交这些 URL」。
 *   2. 定时提交：Tapp.scheduler 周期任务，冲刷待提交队列。
 *   3. 自动发现：扫描 Myriad 手账订阅源文章与自定义来源，只把「新增」URL 提交出去。
 *
 * core 同时运行在 headless 与 Page 沙箱，因此调度注册放在 bootstrap()，
 * 不依赖 DOM；页面专属的绑定放在 init()。
 */
var SearchSubmitCore = (function () {
  'use strict';

  var CK = 'search-submit.config.v1';
  var LK = 'search-submit.logs.v1';
  var QK = 'search-submit.queue.v1';
  var SK = 'search-submit.seen.v1';
  var STK = 'search-submit.status.v1';
  var TASK_ID = 'search-submit-auto';

  var LOG_LIMIT = 80;
  var QUEUE_LIMIT = 2000;
  // 宿主 storage 单值上限 1 MiB（ARCHITECTURE.md）。URL 越长占用越大，
  // 所以既限条数也限序列化字节数，写入前先裁剪，避免整轮自动流程因配额失败。
  var SEEN_LIMIT = 1500;
  var SEEN_MAX_BYTES = 480 * 1024;
  var SOURCE_LIMIT = 10;
  var NESTED_SITEMAP_LIMIT = 10;
  var NOTE_PAGE_SIZE = 50;
  var NOTE_MAX_PAGES = 3;

  var state = {
    config: normalizeConfig(null),
    logs: [],
    queue: [],
    seen: {},
    status: {},
    running: false,
  };

  /* ------------------------------------------------------------------ utils */

  function hasDom() {
    return typeof document !== 'undefined' && typeof document.getElementById === 'function';
  }

  function hasPageHost() {
    return typeof window !== 'undefined' && (window._TAPP_MODE === 'page' || window._TAPP_HAS_HTML);
  }

  function $(id) {
    return hasDom() ? document.getElementById(id) : null;
  }

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function clamp(value, min, max, fallback) {
    var n = Number(value);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function decodeEntities(text) {
    return String(text || '')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#0*39;|&apos;/gi, "'")
      .replace(/&amp;/gi, '&');
  }

  function redact(message) {
    return String(message || '')
      .replace(/token=[^&\s"']+/gi, 'token=[REDACTED]')
      .replace(/("?key"?\s*[:=]\s*)[^,}\s"']+/gi, '$1[REDACTED]');
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function formatTime(value) {
    if (!value) return '—';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '—';
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  /* --------------------------------------------------------------- messaging */

  async function note(message, type) {
    try {
      await Tapp.ui.showNotification({
        title: type === 'error' ? '错误' : type === 'warning' ? '注意' : '成功',
        message: message,
        type: type || 'success',
        duration: 3200,
      });
    } catch (error) {
      /* 通知不可用时静默降级 */
    }
  }

  async function admin() {
    try {
      return (await Tapp.user.getRole()) === 'admin' && (await Tapp.user.isAdmin());
    } catch (error) {
      return false;
    }
  }

  /**
   * 确认框只在 Page/Widget 可见沙箱存在。headless core 里没有人可以点「确定」，
   * 所以一律返回 false，让调用方安静地跳过。
   */
  async function confirmAction(message) {
    if (!hasDom() || !Tapp.ui || typeof Tapp.ui.confirm !== 'function') return false;
    try {
      return !!(await Tapp.ui.confirm(message));
    } catch (error) {
      return false;
    }
  }

  function access(ok) {
    var adminUi = $('admin-ui');
    var publicUi = $('public-ui');
    if (adminUi) adminUi.hidden = !ok;
    if (publicUi) publicUi.hidden = !!ok;
  }

  async function guard() {
    var ok = await admin();
    access(ok);
    if (!ok) await note('仅管理员可以提交', 'error');
    return ok;
  }

  function apiData(value) {
    return value && value.success === true && Object.prototype.hasOwnProperty.call(value, 'data')
      ? value.data
      : value;
  }

  /* ------------------------------------------------------------------ config */

  function normalizeSchedule(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var type = raw.type === 'daily' ? 'daily' : 'interval';
    var time = clean(raw.time) || '09:00';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) time = '09:00';
    return {
      enabled: raw.enabled === true,
      type: type,
      intervalMinutes: clamp(raw.intervalMinutes, 5, 1440, 360),
      time: time,
      timezone: clean(raw.timezone) || 'local',
      missedPolicy: clean(raw.missedPolicy) || 'run-once',
    };
  }

  function normalizeAuto(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var mode = raw.mode === 'collect' ? 'collect' : 'submit';
    // 旧键 notesEnabled 兼容迁移到 articlesEnabled。
    var legacyNotes = raw.notesEnabled !== undefined ? raw.notesEnabled : true;
    return {
      enabled: raw.enabled === true,
      articlesEnabled: raw.articlesEnabled !== undefined ? raw.articlesEnabled !== false : legacyNotes !== false,
      articlePathTemplate: clean(raw.articlePathTemplate) || DEFAULT_ARTICLE_PATH,
      mode: mode,
      sourcesEnabled: raw.sourcesEnabled === true,
      sources: normalizeSourceList(raw.sources),
    };
  }

  function normalizeSourceList(raw) {
    var list = Array.isArray(raw) ? raw : [];
    var out = [];
    var seen = {};
    for (var i = 0; i < list.length && out.length < SOURCE_LIMIT; i++) {
      var url = clean(list[i]);
      if (!url || seen[url]) continue;
      seen[url] = true;
      out.push(url);
    }
    return out;
  }

  function normalizeConfig(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    return {
      provider: raw.provider === 'indexnow' ? 'indexnow' : 'baidu',
      siteUrl: clean(raw.siteUrl).replace(/\/+$/, ''),
      baiduToken: clean(raw.baiduToken),
      indexNowKey: clean(raw.indexNowKey),
      keyLocation: clean(raw.keyLocation),
      schedule: normalizeSchedule(raw.schedule),
      auto: normalizeAuto(raw.auto),
    };
  }

  function configError(config) {
    if (!config) return '配置尚未加载';
    var siteUrl = clean(config.siteUrl);
    if (!siteUrl) return '尚未保存站点地址';
    try {
      if (new URL(siteUrl).protocol !== 'https:') return '站点必须使用 HTTPS';
    } catch (error) {
      return '站点地址无效';
    }
    if (config.provider === 'baidu' && !config.baiduToken) return '尚未保存百度 Token';
    if (config.provider === 'indexnow') {
      if (!/^[A-Za-z0-9-]{8,128}$/.test(config.indexNowKey)) return 'IndexNow Key 格式不正确';
      if (config.keyLocation) {
        try {
          if (new URL(config.keyLocation).protocol !== 'https:') return 'Key 文件必须使用 HTTPS';
          if (new URL(config.keyLocation).pathname.endsWith('/')) return 'Key 文件地址必须指向具体文件';
        } catch (error) {
          return 'Key 文件地址无效';
        }
      }
    }
    return '';
  }

  function providerName(provider) {
    return provider === 'indexnow' ? 'IndexNow' : '百度主动推送';
  }

  function submitLimit(provider) {
    return provider === 'baidu' ? 2000 : 10000;
  }

  function keyScope(config) {
    if (config.provider !== 'indexnow' || !config.keyLocation) return '/';
    var path = new URL(config.keyLocation).pathname;
    return path.slice(0, path.lastIndexOf('/') + 1) || '/';
  }

  function inKeyScope(path, scope) {
    if (scope === '/') return true;
    var root = scope.slice(0, -1);
    return path === root || path.startsWith(scope);
  }

  /* ------------------------------------------------------------------ 提交 */

  async function submitToProvider(config, urls) {
    var data;
    if (config.provider === 'baidu') {
      data = apiData(
        await Tapp.api('baiduSubmit', {
          site: encodeURIComponent(config.siteUrl),
          token: encodeURIComponent(config.baiduToken),
          body: urls.join('\n'),
        }),
      );
      if (data && data.error) throw new Error(data.message || String(data.error));
      var success = data && typeof data.success === 'number' ? data.success : urls.length;
      var remain = data && typeof data.remain === 'number' ? '，剩余额度 ' + data.remain : '';
      var rejected =
        (data && Array.isArray(data.not_same_site) ? data.not_same_site.length : 0) +
        (data && Array.isArray(data.not_valid) ? data.not_valid.length : 0);
      return '成功 ' + success + ' 条' + remain + (rejected ? '，拒绝 ' + rejected + ' 条' : '');
    }

    var payload = { host: new URL(config.siteUrl).hostname, key: config.indexNowKey, urls: urls };
    if (config.keyLocation) {
      data = apiData(await Tapp.api('indexNowSubmitWithLocation', Object.assign({}, payload, { keyLocation: config.keyLocation })));
    } else {
      data = apiData(await Tapp.api('indexNowSubmit', payload));
    }
    if (data && data.error) throw new Error(data.message || String(data.error));
    return '已接受 ' + urls.length + ' 条 URL';
  }

  async function submitBatch(config, urls, label) {
    var limit = submitLimit(config.provider);
    var chunks = [];
    for (var i = 0; i < urls.length; i += limit) chunks.push(urls.slice(i, i + limit));
    var parts = [];
    for (var c = 0; c < chunks.length; c++) {
      parts.push(await submitToProvider(config, chunks[c]));
    }
    var summary = parts.join('；');
    await record(true, label || providerName(config.provider), '共 ' + urls.length + ' 条：' + summary);
    return summary;
  }

  /* ------------------------------------------------------------ URL 解析 */

  function normalizeCandidate(raw, siteHost, scope) {
    var value = clean(raw);
    if (!value) return '';
    if (value.indexOf('//') === 0) value = 'https:' + value;
    if (value.charAt(0) === '/') value = 'https://' + siteHost + value;
    var parsed;
    try {
      parsed = new URL(value);
    } catch (error) {
      return '';
    }
    if (parsed.protocol !== 'https:') return '';
    if (parsed.hostname !== siteHost) return '';
    parsed.hash = '';
    if (scope !== '/' && !inKeyScope(parsed.pathname, scope)) return '';
    return parsed.toString();
  }

  function collectUrls(rawList, config) {
    var host = new URL(config.siteUrl).hostname;
    var scope = keyScope(config);
    var out = [];
    var seen = {};
    for (var i = 0; i < rawList.length; i++) {
      var url = normalizeCandidate(rawList[i], host, scope);
      if (!url || seen[url]) continue;
      seen[url] = 1;
      out.push(url);
    }
    return out;
  }

  function parseTextarea(config, text) {
    var scope = keyScope(config);
    var host = new URL(config.siteUrl).hostname;
    var raw = [];
    var ignored = 0;
    var outOfScope = 0;
    var seen = {};
    String(text || '')
      .split(/\r?\n/)
      .map(clean)
      .forEach(function (value) {
        if (!value) return;
        // 以「归一化后的 URL」为键去重：`https://example.com` 与
        // `https://example.com/` 归一化后相同，只应保留一条。
        var normalized = normalizeCandidate(value, host, scope);
        if (!normalized) {
          ignored++;
          if (/^https:\/\//i.test(value)) {
            try {
              if (new URL(value).hostname === host && scope !== '/' &&
                !inKeyScope(new URL(value).pathname, scope)) outOfScope++;
            } catch (error) {
              /* 忽略解析失败 */
            }
          }
          return;
        }
        if (seen[normalized]) {
          ignored++;
          return;
        }
        seen[normalized] = 1;
        raw.push(normalized);
      });
    return { urls: raw, ignored: ignored, outOfScope: outOfScope, scope: scope };
  }

  function ignoredSummary(parsed) {
    var text = parsed.ignored + ' 条无效、重复或非本站 URL';
    if (parsed.outOfScope) text += '，其中 ' + parsed.outOfScope + ' 条超出 Key 授权目录 ' + parsed.scope;
    return text;
  }

  function emptyUrlMessage(parsed) {
    return parsed.ignored
      ? '没有可提交的 URL；已忽略 ' + ignoredSummary(parsed)
      : '请输入当前站点的 HTTPS URL';
  }

  /* -------------------------------------------------------------- 持久化 */

  async function readAll() {
    var values = await Promise.all([
      Tapp.storage.get(CK),
      Tapp.storage.get(LK),
      Tapp.storage.get(QK),
      Tapp.storage.get(SK),
      Tapp.storage.get(STK),
    ]);
    state.config = normalizeConfig(values[0]);
    state.logs = Array.isArray(values[1]) ? values[1] : [];
    state.queue = Array.isArray(values[2]) ? values[2].map(clean).filter(Boolean) : [];
    state.seen = values[3] && typeof values[3] === 'object' && !Array.isArray(values[3]) ? values[3] : {};
    state.status = values[4] && typeof values[4] === 'object' ? values[4] : {};
    return state.config;
  }

  async function saveConfig(config) {
    var next = normalizeConfig(config);
    var previous = state.config;
    state.config = next;
    await Tapp.storage.set(CK, next);
    // 换了站点之后旧的去重记录不再适用，重新建基线避免一次性全量推送。
    if (previous && previous.siteUrl && previous.siteUrl !== next.siteUrl) {
      state.seen = {};
      await Promise.all([saveSeen(), saveStatus({ baselineDone: false })]);
    }
  }

  async function saveQueue() {
    await Tapp.storage.set(QK, state.queue.slice(0, QUEUE_LIMIT));
  }

  /** 按条数与序列化字节双重裁剪，保证不会撞上宿主 storage 单值 1 MiB 上限。 */
  async function saveSeen() {
    var keys = Object.keys(state.seen).sort(function (a, b) {
      return (state.seen[a] || 0) - (state.seen[b] || 0);
    });
    if (keys.length > SEEN_LIMIT) {
      keys.slice(0, keys.length - SEEN_LIMIT).forEach(function (key) {
        delete state.seen[key];
      });
    }
    var payload = JSON.stringify(state.seen);
    while (payload.length > SEEN_MAX_BYTES) {
      var oldest = Object.keys(state.seen).sort(function (a, b) {
        return (state.seen[a] || 0) - (state.seen[b] || 0);
      }).shift();
      if (!oldest) break;
      delete state.seen[oldest];
      payload = JSON.stringify(state.seen);
    }
    await Tapp.storage.set(SK, state.seen);
  }

  async function saveStatus(patch) {
    state.status = Object.assign({}, state.status, patch);
    await Tapp.storage.set(STK, state.status);
  }

  async function saveLogs() {
    await Tapp.storage.set(LK, state.logs.slice(0, LOG_LIMIT));
  }

  async function record(ok, title, detail) {
    try {
      state.logs.unshift({ ok: ok, title: title, detail: detail, time: new Date().toISOString() });
      await saveLogs();
      renderLogs();
      return true;
    } catch (error) {
      renderLogs();
      return false;
    }
  }

  function markSeen(urls) {
    var now = Date.now();
    for (var i = 0; i < urls.length; i++) state.seen[urls[i]] = now;
  }

  /* -------------------------------------------------- 自动发现：来源解析 */

  var URL_KEYS = {
    url: 1, link: 1, permalink: 1, href: 1, loc: 1,
    homepage: 1, website: 1, site_url: 1, canonical: 1,
  };

  function walkJson(node, out, depth) {
    if (depth > 8 || out.length > 4000) return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) walkJson(node[i], out, depth + 1);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (var key in node) {
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
      var value = node[key];
      if (typeof value === 'string') {
        if (URL_KEYS[key.toLowerCase()]) out.push(decodeEntities(value));
      } else if (value && typeof value === 'object') {
        walkJson(value, out, depth + 1);
      }
    }
  }

  /**
   * 解析一份来源文档，区分「要提交的页面 URL」和「还要继续抓取的 sitemap」。
   *
   * 根元素决定语义，否则会把 sitemap 本身的地址当成页面推给搜索引擎：
   *   <sitemapindex> → <loc> 是子 sitemap，继续抓
   *   <urlset>      → <loc> 是页面
   *   robots.txt    → `Sitemap:` 行是子 sitemap，继续抓
   *   RSS / Atom / OPML / JSON → 都是页面
   */
  function extractDocument(text) {
    var source = String(text || '');
    var pages = [];
    var sitemaps = [];
    var match;
    var pattern;

    var isSitemapIndex = /<sitemapindex\b/i.test(source);
    var isUrlSet = /<urlset\b/i.test(source);
    var isFeed = /<(rss|feed|rdf:RDF)\b/i.test(source);
    var isOpml = /<opml\b/i.test(source);

    // robots.txt 的 Sitemap 指令：无论是否同时有 XML，都当作子 sitemap。
    pattern = /^[ \t]*sitemap[ \t]*:[ \t]*(\S+)/gim;
    while ((match = pattern.exec(source)) !== null) {
      var declared = clean(decodeEntities(match[1]));
      if (declared) sitemaps.push(declared);
    }

    pattern = /<loc\b[^>]*>([\s\S]*?)<\/loc>/gi;
    while ((match = pattern.exec(source)) !== null) {
      var loc = clean(decodeEntities(match[1]));
      if (!loc) continue;
      if (isSitemapIndex || (!isUrlSet && !isFeed && !isOpml && !sitemaps.length && /^https?:\/\//i.test(source))) {
        sitemaps.push(loc);
      } else {
        pages.push(loc);
      }
    }

    // Atom 的 <link href>；跳过 rel 为导航语义的那些（feed 自身的 self、
    // 分页 next/prev/first/last、search），它们不是内容页。
    if (isFeed || isOpml) {
      pattern = /<link\b[^>]*\bhref[ \t]*=[ \t]*["']([^"']+)["'][^>]*>/gi;
      while ((match = pattern.exec(source)) !== null) {
        var relMatch = /\brel[ \t]*=[ \t]*["']([^"']*)["']/i.exec(match[0]);
        var rel = relMatch ? relMatch[1].toLowerCase() : '';
        if (/^(self|next|prev|previous|first|last|search|hub|license)$/.test(rel)) continue;
        pages.push(decodeEntities(match[1]));
      }
      // RSS 2.0 的 <link>URL</link> 是文本内容，没有 href 属性。
      pattern = /<link\b[^>]*>([\s\S]*?)<\/link>/gi;
      while ((match = pattern.exec(source)) !== null) {
        var linkText = clean(decodeEntities(match[1]));
        if (/^https?:\/\//i.test(linkText)) pages.push(linkText);
      }
      // Atom 条目的 <id> 通常就是永久链接。
      pattern = /<id\b[^>]*>([\s\S]*?)<\/id>/gi;
      while ((match = pattern.exec(source)) !== null) {
        var idText = clean(decodeEntities(match[1]));
        if (/^https?:\/\//i.test(idText)) pages.push(idText);
      }
    }

    pattern = /<guid\b[^>]*>([\s\S]*?)<\/guid>/gi;
    while ((match = pattern.exec(source)) !== null) {
      var guid = clean(decodeEntities(match[1]));
      if (/^https?:\/\//i.test(guid)) pages.push(guid);
    }

    if (isOpml) {
      pattern = /<outline\b[^>]*\burl[ \t]*=[ \t]*["']([^"']+)["'][^>]*>/gi;
      while ((match = pattern.exec(source)) !== null) pages.push(decodeEntities(match[1]));
    }

    if (/^[ \t]*[[{]/.test(source)) {
      try {
        walkJson(JSON.parse(source), pages, 0);
      } catch (error) {
        /* 不是 JSON 就跳过 JSON 分支 */
      }
    }
    return { pages: pages, sitemaps: sitemaps };
  }

  /**
   * 校验自定义来源地址。endpoint 是整条 URL 模板，这里必须挡住会破坏
   * 模板解析或请求结构的字符：花括号、空白、控制字符、URL 内嵌凭据。
   */
  function validateSourceUrl(raw) {
    var url = clean(raw);
    if (!url) return '';
    if (/[{}<>|\\^`\s]/.test(url)) return '';
    var parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      return '';
    }
    if (parsed.protocol !== 'https:') return '';
    if (parsed.username || parsed.password) return '';
    parsed.hash = '';
    return parsed.toString();
  }

  /**
   * endpoint 是 `{{params.url}}` 整条替换，宿主按字面量注入，
   * 所以这里传原始地址（和 baiduSubmit 对 query 值做 encodeURIComponent 不同）。
   */
  async function fetchScanSource(url) {
    var result = await Tapp.api('fetchScanSource', { url: url });
    var data = apiData(result);
    if (typeof data === 'string') return data;
    if (data && typeof data.text === 'string') return data.text;
    if (data && typeof data.body === 'string') return data.body;
    if (data && typeof data.content === 'string') return data.content;
    if (data === undefined || data === null) return '';
    return JSON.stringify(data);
  }

  /**
   * 扫描自定义来源。返回 {urls, errors}；单个来源失败不影响其余来源。
   * 最多跟进 NESTED_SITEMAP_LIMIT 个子 sitemap，只跟进一层。
   */
  async function discoverFromSources(config) {
    var urls = [];
    var errors = [];
    var fetched = 0;
    var queue = [];
    for (var i = 0; i < config.auto.sources.length; i++) {
      var source = validateSourceUrl(config.auto.sources[i]);
      if (!source) {
        errors.push('来源地址无效（必须是 HTTPS，且不含空白或花括号）');
        continue;
      }
      queue.push(source);
    }
    while (queue.length && fetched < NESTED_SITEMAP_LIMIT) {
      var current = queue.shift();
      fetched++;
      try {
        var document = extractDocument(await fetchScanSource(current));
        for (var p = 0; p < document.pages.length; p++) urls.push(document.pages[p]);
        for (var m = 0; m < document.sitemaps.length && queue.length < NESTED_SITEMAP_LIMIT; m++) {
          var nested = validateSourceUrl(document.sitemaps[m]);
          if (nested && nested !== current) queue.push(nested);
        }
      } catch (error) {
        errors.push(current + '：' + redact((error && error.message) || String(error)));
      }
    }
    return { urls: collectUrls(urls, config), errors: errors };
  }

  /* ----------------------------------- 自动发现：Myriad 手账订阅源文章 */

  function journalApi() {
    var api = Tapp.phantasiList;
    return api && typeof api.list === 'function' ? api : null;
  }

  /**
   * 站内文章阅读页模板。宿主把内容源文章渲染在 `/journal/articles/{id}`
   * （见 Myriad UPGRADE_NOTES「阅读器：用户地址是 /journal/articles/{id}」）。
   * 注意：`phantasiList.list()` 返回的是**订阅源里的文章**，`link` 是原文站外
   * 地址；它并不是「本站自己发布的笔记」，宿主目前也没有列出站内笔记的只读
   * Tapp API。所以默认用 `id` 拼站内阅读页地址，站外原文会被 origin 过滤丢弃。
   */
  var DEFAULT_ARTICLE_PATH = '/journal/articles/{id}';

  /** 模板占位符：{id}/{link}/{url}/{title}/{date}/{source}；link/url 原样，其余 encodeURIComponent。 */
  function fillArticleTemplate(template, item) {
    var text = clean(template) || DEFAULT_ARTICLE_PATH;
    return text.replace(/\{(link|url|id|title|date|source)\}/g, function (match, key) {
      var value = item && item[key] != null ? String(item[key]) : '';
      return key === 'link' || key === 'url' ? value : encodeURIComponent(value);
    });
  }

  /**
   * 读取手账订阅源文章，生成「站内阅读页 URL」。
   * 模板字段缺失时跳过该条（不会拿空串去拼 URL）。
   */
  async function discoverFromNotes(config) {
    var api = journalApi();
    if (!api) return { urls: [], error: '当前宿主未提供 Tapp.phantasiList' };
    var urls = [];
    try {
      for (var page = 1; page <= NOTE_MAX_PAGES; page++) {
        var result = await api.list({ limit: NOTE_PAGE_SIZE, page: page, filter: 'all' });
        var items = (result && result.items) || [];
        if (!items.length) break;
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (!item || item.id == null) continue;
          var candidate = fillArticleTemplate(config.auto.articlePathTemplate, item);
          if (!candidate) continue;
          urls.push(candidate);
        }
        if (items.length < NOTE_PAGE_SIZE) break;
      }
    } catch (error) {
      return { urls: collectUrls(urls, config), error: redact((error && error.message) || String(error)) };
    }
    return { urls: collectUrls(urls, config), error: '' };
  }

  /* ------------------------------------------------------- 自动发现编排 */

  /**
   * 一次自动流程：读配置 → 发现 → 与去重记录求差 → 按模式提交或入队。
   * 首次运行建立基线（只记录不提交），避免一启用就全量推送。
   */
  async function runAutomation(trigger) {
    if (state.running) return { skipped: true, reason: 'busy' };
    state.running = true;
    try {
      var config = await readAll();
      var invalid = configError(config);
      if (invalid) {
        await saveStatus({ lastRunAt: Date.now(), lastRunReason: invalid, lastRunTrigger: trigger });
        return { skipped: true, reason: invalid };
      }

      var discovered = [];
      var warnings = [];

      if (config.auto.enabled && config.auto.articlesEnabled) {
        var notes = await discoverFromNotes(config);
        for (var n = 0; n < notes.urls.length; n++) discovered.push(notes.urls[n]);
        if (notes.error) warnings.push('手账文章：' + notes.error);
      }

      if (config.auto.enabled && config.auto.sourcesEnabled && config.auto.sources.length) {
        var sources = await discoverFromSources(config);
        for (var s = 0; s < sources.urls.length; s++) discovered.push(sources.urls[s]);
        for (var e = 0; e < sources.errors.length; e++) warnings.push('来源：' + sources.errors[e]);
      }

      var unique = collectUrls(discovered, config);
      var baselineDone = state.status.baselineDone === true;
      var fresh = baselineDone
        ? unique.filter(function (url) {
            return !state.seen[url];
          })
        : unique;

      var enqueued = [];
      var result = '';

      if (!baselineDone) {
        // 只做一次基线：把当前已存在的 URL 全部记为「已提交」，
        // 之后每轮只推送真正新出现的链接，避免一启用就全量推送。
        markSeen(unique);
        await Promise.all([saveSeen(), saveStatus({ baselineDone: true })]);
        result = '已建立基线：记录 ' + unique.length + ' 条 URL，下次运行只提交新增内容';
      } else if (!fresh.length) {
        result = '本次未发现新增 URL（共扫描 ' + unique.length + ' 条）';
      } else if (config.auto.mode === 'collect') {
        var merged = state.queue.concat(fresh);
        var queueSeen = {};
        state.queue = [];
        for (var m = 0; m < merged.length; m++) {
          var item = merged[m];
          if (queueSeen[item]) continue;
          queueSeen[item] = 1;
          state.queue.push(item);
        }
        await saveQueue();
        enqueued = fresh;
        result = '发现 ' + fresh.length + ' 条新增 URL，已加入待提交队列';
      } else {
        markSeen(fresh);
        await saveSeen();
        result = '新增 ' + fresh.length + ' 条：' + (await submitBatch(config, fresh, '自动提交 · ' + trigger));
      }

      if (warnings.length) result += '；' + warnings.join('；');
      await saveStatus({
        lastRunAt: Date.now(),
        lastRunReason: result,
        lastRunTrigger: trigger,
        lastRunFound: unique.length,
        lastRunFresh: fresh.length,
        lastRunEnqueued: enqueued.length,
      });
      await record(true, '自动提交 · ' + trigger, result);
      return { fresh: fresh.length, enqueued: enqueued.length, reason: result };
    } catch (error) {
      var message = redact((error && error.message) || String(error));
      await saveStatus({ lastRunAt: Date.now(), lastRunReason: message, lastRunTrigger: trigger });
      await record(false, '自动提交 · ' + trigger, message);
      return { error: message };
    } finally {
      state.running = false;
      renderStatus();
    }
  }

  /**
   * 定时任务冲刷队列：手动攒下的 URL 到点自动送出。
   * 队列里过不了校验（非本站 / 非 HTTPS / 超出 Key 目录）的条目会被剔除并记日志，
   * 否则它们会每轮静默重试，永远留在队列里。
   */
  async function flushQueue(trigger) {
    var config = await readAll();
    var invalid = configError(config);
    if (invalid) {
      await saveStatus({ lastFlushAt: Date.now(), lastFlushReason: invalid });
      return { skipped: true, reason: invalid };
    }
    if (!state.queue.length) {
      await saveStatus({ lastFlushAt: Date.now(), lastFlushReason: '队列为空' });
      return { skipped: true, reason: 'empty' };
    }
    var pending = collectUrls(state.queue, config);
    var keep = state.queue.filter(function (url) {
      return pending.indexOf(url) >= 0;
    });
    var dropped = state.queue.length - keep.length;
    if (!pending.length) {
      state.queue = [];
      await saveQueue();
      await saveStatus({ lastFlushAt: Date.now(), lastFlushReason: '队列内 ' + dropped + ' 条全部无效，已清空' });
      await record(false, '定时提交 · ' + trigger, '队列内 ' + dropped + ' 条 URL 均未通过校验（非 HTTPS / 非本站 / 超出 Key 目录），已移出队列');
      return { skipped: true, reason: 'all-invalid', dropped: dropped };
    }
    var result = await submitBatch(config, pending, '定时提交 · ' + trigger);
    state.queue = [];
    markSeen(pending);
    await Promise.all([saveQueue(), saveSeen()]);
    var reason = '已提交 ' + pending.length + ' 条';
    if (dropped) reason += '，移除 ' + dropped + ' 条无效 URL';
    await saveStatus({ lastFlushAt: Date.now(), lastFlushReason: reason });
    await record(true, '定时提交 · ' + trigger, result + (dropped ? '；移除 ' + dropped + ' 条无效 URL' : ''));
    return { submitted: pending.length, dropped: dropped };
  }

  /* ------------------------------------------------------------ 定时任务 */

  function schedulerAvailable() {
    return !!(Tapp.scheduler && typeof Tapp.scheduler.register === 'function');
  }

  function onTask(taskId, handler) {
    if (!Tapp.scheduler || typeof Tapp.scheduler.onTask !== 'function') return;
    try {
      Tapp.scheduler.onTask(taskId, handler);
    } catch (error) {
      console.warn('[Search Submit] onTask 注册失败', taskId, error);
    }
  }

  function unregister(taskId) {
    if (!Tapp.scheduler || typeof Tapp.scheduler.unregister !== 'function') return Promise.resolve();
    return Promise.resolve(Tapp.scheduler.unregister(taskId)).catch(function () {
      return null;
    });
  }

  function sameSchedule(current, desired) {
    if (!current) return false;
    if (current.scheduleType !== desired.scheduleType) return false;
    if (current.executionTarget !== desired.executionTarget) return false;
    if (current.missedPolicy !== desired.missedPolicy) return false;
    var a = current.schedule || {};
    var b = desired.schedule || {};
    if (desired.scheduleType === 'interval') return a.interval === b.interval;
    return a.time === b.time && (a.timezone || 'local') === (b.timezone || 'local');
  }

  function desiredTask(config) {
    var schedule = config.schedule;
    var task = {
      taskId: TASK_ID,
      name: '搜索引擎收录提交 · ' + providerName(config.provider) +
        (schedule.type === 'daily' ? ' 每日 ' + schedule.time : ' 每 ' + schedule.intervalMinutes + ' 分钟'),
      scheduleType: schedule.type,
      schedule: schedule.type === 'daily'
        ? { time: schedule.time, timezone: schedule.timezone }
        : { interval: schedule.intervalMinutes * 60000 },
      executionTarget: 'frontend',
      missedPolicy: schedule.missedPolicy,
    };
    return task;
  }

  async function syncScheduler() {
    if (!schedulerAvailable()) return { reason: 'scheduler-unavailable' };
    if (!(await admin())) return { reason: 'not-admin' };
    var config = await readAll();
    if (!config.schedule.enabled || configError(config)) return unregister(TASK_ID).then(function () {
      return { reason: 'disabled' };
    });
    var desired = desiredTask(config);
    var current = typeof Tapp.scheduler.get === 'function'
      ? await Promise.resolve(Tapp.scheduler.get(TASK_ID)).catch(function () {
          return null;
        })
      : null;
    if (sameSchedule(current, desired)) return { reason: 'ok', unchanged: true };
    await Tapp.scheduler.register(desired);
    return { reason: 'ok' };
  }

  /**
   * 调度回调里重新确认管理员身份：任务 ID 是安装级的，注册者是管理员，
   * 但之后可能登出或降级。非管理员直接跳过，不读配置也不出站。
   */
  function guardAdminTask(label, run) {
    return admin()
      .then(function (ok) {
        if (!ok) return { skipped: true, reason: '当前用户不是管理员' };
        return run();
      })
      .catch(function (error) {
        console.warn('[Search Submit] ' + label + '失败', error);
        return null;
      });
  }

  async function runScheduledTask() {
    // flushQueue / runAutomation 各自 readAll，这里不再重复读一次存储。
    await flushQueue('定时任务');
    await runAutomation('定时任务');
  }

  function bootstrap() {
    var tasks = [];
    if (schedulerAvailable()) {
      onTask(TASK_ID, function () {
        return guardAdminTask('定时提交', runScheduledTask);
      });
      tasks.push(syncScheduler().catch(function (error) {
        console.warn('[Search Submit] scheduler sync failed', error);
        return null;
      }));
    }
    return Promise.all(tasks);
  }

  /* --------------------------------------------------------------- 渲染 */

  function renderLogs() {
    if (!hasDom()) return;
    var box = $('logs');
    if (!box) return;
    box.replaceChildren();
    if (!state.logs.length) {
      box.textContent = '暂无记录';
      return;
    }
    state.logs.forEach(function (entry) {
      var row = document.createElement('div');
      row.className = 'log ' + (entry.ok ? 'ok' : 'error');
      row.textContent = formatTime(entry.time) + ' · ' + entry.title + ' · ' + entry.detail;
      box.appendChild(row);
    });
  }

  function renderQueue() {
    var box = $('queue-box');
    if (!box) return;
    box.value = state.queue.join('\n');
    var counter = $('queue-count');
    if (counter) counter.textContent = state.queue.length + ' 条待提交';
  }

  function renderStatus() {
    var badge = $('task-status');
    if (badge) {
      if (!schedulerAvailable()) badge.textContent = '当前宿主不支持 Tapp.scheduler';
      else if (!state.config.schedule.enabled) badge.textContent = '定时任务未启用';
      else badge.textContent = '定时任务已启用：' +
        (state.config.schedule.type === 'daily'
          ? '每天 ' + state.config.schedule.time
          : '每 ' + state.config.schedule.intervalMinutes + ' 分钟');
    }
    var seenBox = $('seen-count');
    if (seenBox) seenBox.textContent = Object.keys(state.seen).length + ' 条已提交记录';
    var lastRun = $('last-run');
    if (lastRun) {
      lastRun.textContent = state.status.lastRunAt
        ? '上次自动运行 ' + formatTime(state.status.lastRunAt) + ' · ' + (state.status.lastRunReason || '')
        : '尚未自动运行';
    }
    var lastFlush = $('last-flush');
    if (lastFlush) {
      lastFlush.textContent = state.status.lastFlushAt
        ? '上次定时冲刷 ' + formatTime(state.status.lastFlushAt) + ' · ' + (state.status.lastFlushReason || '')
        : '尚未定时冲刷';
    }
  }

  function render() {
    var select = $('provider');
    if (!select) return;
    var provider = select.value;
    var isIndexNow = provider === 'indexnow';
    var baiduFields = $('baidu-fields');
    var indexNowFields = $('indexnow-fields');
    if (baiduFields) {
      baiduFields.hidden = isIndexNow;
      baiduFields.style.display = isIndexNow ? 'none' : 'block';
    }
    if (indexNowFields) {
      indexNowFields.hidden = !isIndexNow;
      indexNowFields.style.display = isIndexNow ? 'block' : 'none';
    }
    var badge = $('provider-badge');
    if (badge) badge.textContent = providerName(provider);
    var type = $('schedule-type');
    if (!type) return;
    var daily = type.value === 'daily';
    var intervalWrap = $('schedule-interval-wrap');
    var dailyWrap = $('schedule-daily-wrap');
    if (intervalWrap) intervalWrap.hidden = daily;
    if (dailyWrap) dailyWrap.hidden = !daily;
  }

  function fillSchedule(config) {
    $('schedule-enabled').checked = config.schedule.enabled;
    $('schedule-type').value = config.schedule.type;
    $('schedule-interval').value = config.schedule.intervalMinutes;
    $('schedule-time').value = config.schedule.time;
    render();
  }

  function fillAuto(config) {
    $('auto-enabled').checked = config.auto.enabled;
    $('auto-notes').checked = config.auto.articlesEnabled;
    $('article-path-template').value = config.auto.articlePathTemplate;
    $('auto-mode').value = config.auto.mode;
    $('auto-sources-enabled').checked = config.auto.sourcesEnabled;
    $('auto-sources').value = config.auto.sources.join('\n');
  }

  function fill(config) {
    $('provider').value = config.provider;
    $('site-url').value = config.siteUrl;
    $('baidu-token').value = config.baiduToken;
    $('indexnow-key').value = config.indexNowKey;
    $('key-location').value = config.keyLocation;
    fillSchedule(config);
    fillAuto(config);
    render();
  }

  function readConfig() {
    return normalizeConfig({
      provider: $('provider').value,
      siteUrl: $('site-url').value,
      baiduToken: $('baidu-token').value,
      indexNowKey: $('indexnow-key').value,
      keyLocation: $('key-location').value,
      schedule: {
        enabled: $('schedule-enabled').checked,
        type: $('schedule-type').value,
        intervalMinutes: $('schedule-interval').value,
        time: $('schedule-time').value,
        timezone: 'local',
        missedPolicy: 'run-once',
      },
      auto: {
        enabled: $('auto-enabled').checked,
        articlesEnabled: $('auto-notes').checked,
        articlePathTemplate: $('article-path-template').value,
        mode: $('auto-mode').value,
        sourcesEnabled: $('auto-sources-enabled').checked,
        sources: String($('auto-sources').value || '').split(/\r?\n/).map(clean).filter(Boolean),
      },
    });
  }

  /* ------------------------------------------------------- 页面动作 */

  async function doSubmit() {
    if (!(await guard())) return;
    var config = readConfig();
    var invalid = configError(config);
    if (invalid) return note(invalid, 'warning');
    var parsed = parseTextarea(config, $('urls').value);
    if (!parsed.urls.length) return note(emptyUrlMessage(parsed), 'warning');
    var limit = submitLimit(config.provider);
    if (parsed.urls.length > limit) return note('单次最多 ' + limit + ' 条', 'warning');

    var ignoredText = parsed.ignored ? '（已忽略 ' + ignoredSummary(parsed) + '）' : '';
    var prompt = '确认向 ' + providerName(config.provider) + ' 提交 ' + parsed.urls.length + ' 条 URL 吗？' + ignoredText;
    if (!(await confirmAction(prompt))) return;

    var button = $('submit-btn');
    button.disabled = true;
    button.textContent = '正在提交…';
    $('last-result').textContent = '正在提交…';
    try {
      await saveConfig(config);
      var message = await submitBatch(config, parsed.urls);
      if (parsed.ignored) message += '，本地忽略 ' + parsed.ignored + ' 条';
      markSeen(parsed.urls);
      await saveSeen();
      $('last-result').textContent = message;
      renderStatus();
      await note(message);
    } catch (error) {
      var text = redact((error && error.message) || String(error));
      $('last-result').textContent = '提交失败';
      await record(false, providerName(config.provider), text);
      await note(text, 'error');
    } finally {
      button.disabled = false;
      button.textContent = '提交这些 URL';
    }
  }

  async function saveAll() {
    if (!(await guard())) return;
    var config = readConfig();
    var invalid = configError(config);
    if (invalid) return note(invalid, 'warning');
    await saveConfig(config);
    var synced = await syncScheduler();
    fill(config);
    renderStatus();
    var status = $('save-status');
    if (status) status.textContent = '已保存';
    // syncScheduler 的 reason 要如实反映，不能一律报「已同步」。
    var message = '配置已保存';
    var kind = 'success';
    if (synced.reason === 'disabled') message += '；定时任务未启用';
    else if (synced.reason === 'scheduler-unavailable') {
      message += '；当前宿主不支持 Tapp.scheduler，定时提交未生效';
      kind = 'warning';
    } else if (synced.reason === 'not-admin') {
      message += '；当前身份无法注册定时任务';
      kind = 'warning';
    } else message += '，定时任务已同步';
    await note(message, kind);
  }

  async function enqueueCurrent() {
    if (!(await guard())) return;
    var config = readConfig();
    var invalid = configError(config);
    if (invalid) return note(invalid, 'warning');
    var parsed = parseTextarea(config, $('urls').value);
    var incoming = parsed.urls;
    if (!incoming.length) return note(emptyUrlMessage(parsed), 'warning');
    var exists = {};
    for (var i = 0; i < state.queue.length; i++) exists[state.queue[i]] = 1;
    var added = 0;
    for (var j = 0; j < incoming.length; j++) {
      if (exists[incoming[j]]) continue;
      exists[incoming[j]] = 1;
      state.queue.push(incoming[j]);
      added++;
    }
    await saveQueue();
    renderQueue();
    await note(added ? '已加入 ' + added + ' 条到待提交队列' : '这些 URL 已经在队列里', added ? 'success' : 'warning');
  }

  async function runNow() {
    if (!(await guard())) return;
    var button = $('run-now-btn');
    if (button) {
      button.disabled = true;
      button.textContent = '正在运行…';
    }
    try {
      await saveConfig(readConfig());
      var flush = await flushQueue('手动');
      var auto = await runAutomation('手动');
      renderQueue();
      renderStatus();
      var parts = [];
      if (flush && flush.submitted) parts.push('已提交队列 ' + flush.submitted + ' 条');
      if (auto && auto.reason) parts.push(auto.reason);
      await note(parts.join('；') || '没有需要执行的内容', parts.length ? 'success' : 'warning');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = '立即运行一次';
      }
    }
  }

  async function resetSeen() {
    if (!(await guard())) return;
    if (!(await confirmAction('确定清空去重记录吗？下次自动运行会重建基线，不会全量提交。'))) return;
    state.seen = {};
    await Promise.all([saveSeen(), saveStatus({ baselineDone: false })]);
    renderStatus();
    await note('去重记录已清空，下次自动运行将重建基线', 'success');
  }

  async function copyGuideFallback(url) {
    var ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        ok = true;
      }
    } catch (error) {
      /* 退回 execCommand */
    }
    if (!ok) {
      var box = document.createElement('textarea');
      box.value = url;
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      try {
        ok = document.execCommand('copy');
      } catch (error) {
        ok = false;
      }
      box.remove();
    }
    await note(ok ? '无法直接打开，官方地址已复制' : '复制失败，请手动复制：' + url, ok ? 'warning' : 'error');
  }

  async function openGuide(id, url) {
    try {
      await Tapp.ui.openUrl({ id: id });
      return;
    } catch (error) {
      await copyGuideFallback(url);
    }
  }

  async function bindTheme() {
    try {
      var initial = Tapp.ui.getTheme();
      applyTheme(initial && typeof initial.then === 'function' ? await initial : initial);
      Tapp.ui.onThemeChange(applyTheme);
    } catch (error) {
      if (window.matchMedia) {
        applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
    }
  }

  function applyTheme(theme) {
    var dark = theme === true || theme === 'dark' || theme === 'Dark';
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
    if (document.body) {
      document.body.classList.toggle('dark', dark);
      document.body.classList.toggle('light', !dark);
    }
  }

  async function init() {
    await bindTheme();
    var ok = await admin();
    access(ok);
    if (!ok) return;

    var config = await readAll();
    fill(config);
    renderLogs();
    renderQueue();
    renderStatus();

    document.querySelectorAll('[data-guide-url]').forEach(function (button) {
      button.addEventListener('click', function () {
        openGuide(button.getAttribute('data-guide-id'), button.getAttribute('data-guide-url'));
      });
    });

    $('provider').addEventListener('change', render);
    $('provider').addEventListener('input', render);
    $('schedule-type').addEventListener('change', render);

    $('save-btn').onclick = saveAll;
    $('clear-config-btn').onclick = async function () {
      if (!(await guard())) return;
      if (!(await confirmAction('确定清除配置吗？'))) return;
      await saveConfig({ provider: $('provider').value });
      renderQueue();
      renderStatus();
      await note('配置已清除', 'success');
    };

    $('add-home-btn').onclick = function () {
      var config = readConfig();
      if (config.siteUrl) $('urls').value = config.siteUrl + '/\n' + $('urls').value;
    };
    $('dedupe-btn').onclick = function () {
      var config = readConfig();
      var invalid = configError(config);
      if (invalid) return note(invalid, 'warning');
      var parsed = parseTextarea(config, $('urls').value);
      $('urls').value = parsed.urls.join('\n');
      note(parsed.ignored ? '已清洗并忽略 ' + ignoredSummary(parsed) : 'URL 已去重', 'success');
    };
    $('clear-urls-btn').onclick = function () {
      $('urls').value = '';
      note('URL 列表已清空', 'success');
    };
    $('submit-btn').onclick = doSubmit;
    $('enqueue-btn').onclick = enqueueCurrent;
    $('run-now-btn').onclick = runNow;
    $('reset-seen-btn').onclick = resetSeen;
    $('clear-queue-btn').onclick = async function () {
      if (!(await guard())) return;
      if (!(await confirmAction('确定清空待提交队列吗？'))) return;
      state.queue = [];
      await saveQueue();
      renderQueue();
      await note('待提交队列已清空', 'success');
    };
    $('clear-logs-btn').onclick = async function () {
      if (!(await guard())) return;
      if (!(await confirmAction('确定清空日志吗？'))) return;
      state.logs = [];
      await saveLogs();
      renderLogs();
    };
    $('queue-box').addEventListener('change', async function () {
      state.queue = String($('queue-box').value || '').split(/\r?\n/).map(clean).filter(Boolean);
      await saveQueue();
      renderQueue();
    });
  }

  /** headless 与 Page 都要跑：注册调度回调并对齐一次任务状态。 */
  var bootstrapped = bootstrap().catch(function (error) {
    console.warn('[Search Submit] bootstrap failed', error);
    return null;
  });

  if (hasPageHost()) {
    Tapp.lifecycle.onReady(function () {
      bootstrapped.then(init);
    });
  }

  return {
    DEFAULT_ARTICLE_PATH: DEFAULT_ARTICLE_PATH,
    TASK_ID: TASK_ID,
    SEEN_LIMIT: SEEN_LIMIT,
    normalizeConfig: normalizeConfig,
    normalizeAuto: normalizeAuto,
    configError: configError,
    normalizeCandidate: normalizeCandidate,
    collectUrls: collectUrls,
    parseTextarea: parseTextarea,
    keyScope: keyScope,
    fillArticleTemplate: fillArticleTemplate,
    discoverFromNotes: discoverFromNotes,
    runAutomation: runAutomation,
    flushQueue: flushQueue,
    saveSeen: saveSeen,
    bootstrap: bootstrap,
  };
})();

if (typeof window !== 'undefined') window.SearchSubmitCore = SearchSubmitCore;
if (typeof module !== 'undefined' && module.exports) module.exports = SearchSubmitCore;
