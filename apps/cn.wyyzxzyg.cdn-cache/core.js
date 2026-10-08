/**
 * CDN 缓存刷新 · 共享层 / headless 后台入口
 *
 * 三种沙箱模式（Page / Widget / headless core）都先执行本文件，因此这里只放
 * 不依赖可见 DOM 的内容：
 *   · 配置归一化与校验（含商户凭证字段）
 *   · 四家 CDN 的签名与提交（Cloudflare / EdgeOne TC3 / 阿里云 RPC / CloudFront SigV4）
 *   · 「手帐内容源出现新文章 / 源本身变更」变更探测与自动提交
 *   · 定时任务注册（Tapp.scheduler）与后台常驻循环
 *
 * Page 层（page/index.js）require 本文件拿到同一套配置与提交逻辑，页面不存在时
 * 调度链路依然工作——后台任务不写在 Page 的 onReady 分支里。
 */

'use strict';

var engine = (function () {
  var CONFIG_KEY = 'cdn-cache.config.v1';
  var LOG_KEY = 'cdn-cache.logs.v1';
  var DEDUPE_KEY = 'cdn-cache.dedupe.v1';
  var AUTO_KEY = 'cdn-cache.auto.v1';
  var QUEUE_KEY = 'cdn-cache.queue.v1';
  var RECORD_KEY = 'cdn-cache.record.v1';

  var MAX_LOGS = 80;
  var MAX_AUTO_LOGS = 40;
  var MAX_QUEUE = 2000;
  var MAX_DEDUPE = 60;
  var MAX_SEEN = 400;
  var MAX_ITEMS = 120;
  /**
   * 按 URL 清除的单次批量上限，按服务商拆分。
   *
   * 这里取的都是「非企业套餐也安全」的保守默认值：Cloudflare 免费 / Pro / Business
   * 单次最多 30 条；EdgeOne `purge_url` 与阿里云 `RefreshObjectCaches` 的非企业配额
   * 也明显低于企业档；CloudFront `CreateInvalidation` 单次上限 3000 条路径。
   * 数值可按实际套餐调整；未列出的服务商走 BATCH_URLS_FALLBACK。
   * 整批超出上限会被服务商拒绝，而失败批次留在队首会一直卡住后面的 URL
   * （队列是 FIFO），因此这里宁可取小。
   */
  var BATCH_URLS_BY_PROVIDER = { cloudflare: 30, edgeone: 200, aliyun: 1000, aws: 3000 };
  var BATCH_URLS_FALLBACK = 30;
  var BATCH_PATHS = 3000;
  var DEDUPE_MS = 5000;
  var BACKFILL_MS = 6 * 60 * 60 * 1000;
  /**
   * 启动租约。Page 与 headless 两种沙箱都会执行 core 并各自 bootstrap，
   * 而 `runtime.running` 只在单个沙箱内有效——两边会读到同一份队列和记录，
   * 把同一批 URL 提交两次，AUTO_KEY / 队列的读-改-写也会互相覆盖。
   * 定时任务回调由宿主保证只在最后挂载的 runtime 执行，因此只有「启动时立即核对」
   * 需要这把跨沙箱的锁；租约很短，过期后另一个沙箱会正常接手。
   */
  var LEASE_KEY = 'cdn-cache.lease.v1';
  var LEASE_MS = 8000;

  var PROVIDERS = ['cloudflare', 'edgeone', 'aliyun', 'aws'];
  var PROVIDER_LABELS = {
    cloudflare: 'Cloudflare',
    edgeone: '腾讯云 EdgeOne',
    aliyun: '阿里云 CDN',
    aws: 'AWS CloudFront',
  };

  var AUTO_TASK_ID = 'cdn-cache-auto-refresh';
  var SWEEP_TASK_ID = 'cdn-cache-periodic-purge';

  /**
   * 站内文章阅读页模板。宿主把内容源文章渲染在 `/journal/articles/{id}`
   * （见 Myriad UPGRADE_NOTES「阅读器：用户地址是 /journal/articles/{id}」），
   * 而 `phantasiList.list()` 返回的 `link` 是原文站外地址——站外地址不在本站
   * 缓存里，提交给 CDN 只会被服务商拒绝或白白浪费配额，因此默认刷新站内阅读页。
   */
  var DEFAULT_ARTICLE_PATH = '/journal/articles/{id}';
  // 旧版本用 {link}（站外原文地址）做默认模板，迁移时按这个值识别并改写。
  var LEGACY_LINK_TEMPLATE = '{link}';

  var DEFAULT_AUTO = {
    enabled: false,
    intervalMinutes: 5,
    // 内容源文章（手帐文章）变更后刷新：这是宿主目前唯一可读的内容接口。
    onArticles: true,
    // 订阅源本身增删/改名时刷新站点首页与固定附加地址。
    onSourceChange: true,
    articlePathTemplate: DEFAULT_ARTICLE_PATH,
    includeHomepage: true,
    wildcard: [],
    maxUrls: 80,
    purgeOnStart: false,
    periodicEnabled: false,
    periodicMinutes: 60,
    periodicScope: 'queue',
    periodicManualUrls: '',
    lastCheckAt: 0,
    lastSubmitAt: 0,
    lastReason: '',
    lastCount: 0,
    acceptedAt: 0,
  };

  var EMPTY_AUTO = { logs: [] };
  var EMPTY_QUEUE = { paths: [], from: '' };
  var EMPTY_RECORD = { noteIds: [], itemIds: [], acceptedAt: 0, sourceIds: '' };

  var cache = { config: null, auto: null, record: null };
  var runtime = { running: false, pending: false, lastReason: '', lastCount: 0 };
  var scheduled = {};

  /* ------------------------------------------------------------------ *
   * 基础工具
   * ------------------------------------------------------------------ */

  function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function clamp(value, min, max) {
    var number = Number(value);
    if (!isFinite(number)) number = min;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function mask(text) {
    return String(text || '').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/(?:AKID|AKIA|ASIA|LTAI)[A-Za-z0-9]+/g, '[REDACTED]');
  }

  function safeError(error) {
    return mask(error && error.message ? error.message : String(error || '请求失败'));
  }

  function uid() {
    return Date.now().toString(36) + '-' + Math.random().toString(16).slice(2, 8);
  }

  function providerName(provider) {
    return PROVIDER_LABELS[provider] || String(provider || '');
  }

  function toTime(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return value > 1e12 ? Math.round(value) : value > 1e9 ? Math.round(value * 1000) : 0;
    var numeric = Number(value);
    if (isFinite(numeric) && String(value).trim() !== '') {
      if (numeric > 1e12) return Math.round(numeric);
      if (numeric > 1e9) return Math.round(numeric * 1000);
    }
    var parsed = Date.parse(String(value));
    return isFinite(parsed) ? parsed : 0;
  }

  function pathOf(value) {
    var text = clean(value);
    if (!text) return '';
    try {
      var url = new URL(text, 'https://cdn.invalid');
      return url.pathname + (url.search || '');
    } catch (error) {
      return '';
    }
  }

  function fillTemplate(template, data) {
    var text = clean(template) || '{link}';
    return text.replace(/\{(link|url|id|title|date|source)\}/g, function (match, key) {
      var value = data && data[key] != null ? String(data[key]) : '';
      return key === 'link' || key === 'url' ? value : encodeURIComponent(value);
    });
  }

  function toHttpUrl(candidate, base) {
    var text = clean(candidate);
    if (!text) return '';
    try {
      var url = new URL(text, base || undefined);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  /* ------------------------------------------------------------------ *
   * 配置
   * ------------------------------------------------------------------ */

  function normalizeConfig(value) {
    value = isObject(value) ? value : {};
    return {
      provider: PROVIDERS.indexOf(value.provider) >= 0 ? value.provider : 'cloudflare',
      zoneId: clean(value.zoneId),
      cfToken: clean(value.cfToken),
      secretId: clean(value.secretId),
      secretKey: clean(value.secretKey),
      edgeMethod: value.edgeMethod === 'delete' ? 'delete' : 'invalidate',
      aliAccessKeyId: clean(value.aliAccessKeyId),
      aliAccessKeySecret: clean(value.aliAccessKeySecret),
      awsDistributionId: clean(value.awsDistributionId),
      awsAccessKeyId: clean(value.awsAccessKeyId),
      awsSecretAccessKey: clean(value.awsSecretAccessKey),
      siteUrl: clean(value.siteUrl).replace(/\/+$/, ''),
    };
  }

  function configError(config) {
    var c = normalizeConfig(config);
    if (!c.siteUrl || !/^https:\/\//i.test(c.siteUrl)) return '站点地址必须是 HTTPS URL';
    var parsed = null;
    try {
      parsed = new URL(c.siteUrl);
    } catch (error) {
      parsed = null;
    }
    if (!parsed || parsed.origin === 'null' || !parsed.hostname) return '站点地址不是有效的 URL';
    if (c.provider === 'cloudflare' && !c.zoneId) return '请填写 Zone ID';
    if (c.provider === 'cloudflare' && !c.cfToken) return '请填写 Cloudflare API Token';
    if (c.provider === 'edgeone' && (!c.zoneId || !c.secretId || !c.secretKey)) return '请填写 EdgeOne Zone ID、SecretId 和 SecretKey';
    if (c.provider === 'aliyun' && (!c.aliAccessKeyId || !c.aliAccessKeySecret)) return '请填写阿里云 AccessKey ID 和 AccessKey Secret';
    if (c.provider === 'aws' && (!c.awsDistributionId || !c.awsAccessKeyId || !c.awsSecretAccessKey)) {
      return '请填写 CloudFront Distribution ID、Access Key ID 和 Secret Access Key';
    }
    if (c.provider === 'aws' && !/^[A-Z0-9]+$/.test(c.awsDistributionId)) return 'CloudFront Distribution ID 格式无效';
    return '';
  }

  function wildcardToUrl(pattern, siteUrl) {
    var text = clean(pattern);
    if (!text) return '';
    if (/^https?:\/\//i.test(text)) return text;
    return siteUrl + (text.charAt(0) === '/' ? text : '/' + text);
  }

  function normalizeWildcards(value, siteUrl) {
    var list = Array.isArray(value) ? value : String(value == null ? '' : value).split(/[\n,]/);
    var out = [];
    for (var i = 0; i < list.length && out.length < 40; i++) {
      var url = wildcardToUrl(list[i], siteUrl);
      if (url && /^https?:\/\//i.test(url) && out.indexOf(url) < 0) out.push(url);
    }
    return out;
  }

  function normalizeAuto(value) {
    value = isObject(value) ? value : {};
    var allowed = ['queue', 'all', 'list'];
    // 旧字段名迁移：onNotes / onSourceItems 合并为 onArticles；
    // notePathTemplate / itemPathTemplate 合并为 articlePathTemplate。
    // 旧默认值 {link} 指向站外原文，会破坏站内 origin 校验，因此自动改写为新默认。
    var legacyOn = value.onNotes !== false || value.onSourceItems !== false;
    var articleTemplate = clean(value.articlePathTemplate);
    if (!articleTemplate) {
      var legacyTemplate = clean(value.notePathTemplate) || clean(value.itemPathTemplate);
      articleTemplate = legacyTemplate && legacyTemplate !== LEGACY_LINK_TEMPLATE ? legacyTemplate : DEFAULT_ARTICLE_PATH;
    }
    return {
      enabled: value.enabled === true,
      intervalMinutes: clamp(value.intervalMinutes == null ? DEFAULT_AUTO.intervalMinutes : value.intervalMinutes, 1, 1440),
      onArticles: value.onArticles === false ? false : value.onArticles === true ? true : legacyOn,
      onSourceChange: value.onSourceChange !== false,
      articlePathTemplate: articleTemplate,
      includeHomepage: value.includeHomepage !== false,
      wildcard: normalizeWildcards(value.wildcard, clean(value.siteUrl)),
      maxUrls: clamp(value.maxUrls == null ? DEFAULT_AUTO.maxUrls : value.maxUrls, 1, 500),
      purgeOnStart: value.purgeOnStart === true,
      periodicEnabled: value.periodicEnabled === true,
      periodicMinutes: clamp(value.periodicMinutes == null ? DEFAULT_AUTO.periodicMinutes : value.periodicMinutes, 1, 10080),
      periodicScope: allowed.indexOf(value.periodicScope) >= 0 ? value.periodicScope : 'queue',
      periodicManualUrls: clean(value.periodicManualUrls),
      lastCheckAt: Number(value.lastCheckAt) || 0,
      lastSubmitAt: Number(value.lastSubmitAt) || 0,
      lastReason: clean(value.lastReason),
      lastCount: Number(value.lastCount) || 0,
      acceptedAt: Number(value.acceptedAt) || 0,
    };
  }

  function autoError(auto, config) {
    if (!auto.enabled && !auto.periodicEnabled) return '';
    var c = normalizeConfig(config);
    if (!c.siteUrl) return '自动提交需要先填写站点地址';
    return configError(c);
  }

  function isAdmin() {
    return Promise.resolve()
      .then(function () {
        if (!Tapp.user || typeof Tapp.user.getRole !== 'function') return false;
        return Promise.resolve(Tapp.user.getRole()).then(function (role) {
          if (role !== 'admin') return false;
          if (typeof Tapp.user.isAdmin !== 'function') return true;
          return Promise.resolve(Tapp.user.isAdmin());
        });
      })
      .catch(function () {
        return false;
      });
  }

  /* ------------------------------------------------------------------ *
   * 存储
   * ------------------------------------------------------------------ */

  function readAll() {
    return Promise.all([
      Tapp.storage.get(CONFIG_KEY),
      Tapp.storage.get(AUTO_KEY),
      Tapp.storage.get(QUEUE_KEY),
      Tapp.storage.get(RECORD_KEY),
      Tapp.storage.get(DEDUPE_KEY),
    ]).then(function (values) {
      var auto = isObject(values[1]) ? values[1] : {};
      var config = normalizeConfig(values[0]);
      return {
        config: config,
        auto: normalizeAuto(auto),
        autoLogs: Array.isArray(auto.logs) ? auto.logs : [],
        queue: isObject(values[2]) ? values[2] : { paths: [], from: '' },
        record: isObject(values[3]) ? values[3] : { noteIds: [], itemIds: [] },
        dedupe: isObject(values[4]) ? values[4] : {},
      };
    });
  }

  function prime() {
    if (cache.config && cache.auto && cache.record) {
      return Promise.resolve({ config: cache.config, auto: cache.auto, record: cache.record });
    }
    return readAll().then(function (data) {
      cache.config = data.config;
      cache.auto = data.auto;
      cache.record = data.record;
      return { config: data.config, auto: data.auto, record: data.record };
    });
  }

  function saveConfig(config) {
    var normalized = normalizeConfig(config);
    return Promise.resolve(Tapp.storage.set(CONFIG_KEY, normalized)).then(function () {
      cache.config = normalized;
      return normalized;
    });
  }

  /**
   * 持久化自动提交设置。
   *
   * 未提供的字段从已保存的 auto 对象补齐，避免 `saveAuto({enabled:true})` 这样的
   * 局部调用把 lastCheckAt 归零、让下一轮重新进入「首次运行」并批量补刷。
   */
  function saveAuto(auto) {
    return Promise.resolve(Tapp.storage.get(AUTO_KEY)).then(function (saved) {
      var hydrated = Object.assign({}, isObject(saved) ? saved : {}, isObject(auto) ? auto : {});
      var normalized = normalizeAuto(hydrated);
      var logs = isObject(saved) && Array.isArray(saved.logs) ? saved.logs : [];
      return Tapp.storage.set(AUTO_KEY, {
        enabled: normalized.enabled,
        intervalMinutes: normalized.intervalMinutes,
        onArticles: normalized.onArticles,
        onSourceChange: normalized.onSourceChange,
        articlePathTemplate: normalized.articlePathTemplate,
        includeHomepage: normalized.includeHomepage,
        wildcard: normalized.wildcard,
        maxUrls: normalized.maxUrls,
        purgeOnStart: normalized.purgeOnStart,
        periodicEnabled: normalized.periodicEnabled,
        periodicMinutes: normalized.periodicMinutes,
        periodicScope: normalized.periodicScope,
        periodicManualUrls: normalized.periodicManualUrls,
        lastCheckAt: normalized.lastCheckAt,
        lastSubmitAt: normalized.lastSubmitAt,
        lastReason: normalized.lastReason,
        lastCount: normalized.lastCount,
        acceptedAt: normalized.acceptedAt,
        logs: logs.slice(0, MAX_AUTO_LOGS),
      }).then(function () {
        cache.auto = normalized;
        return normalized;
      });
    });
  }

  function saveRecord(record) {
    var noteIds = (Array.isArray(record.noteIds) ? record.noteIds : []).slice(0, MAX_SEEN);
    var itemIds = (Array.isArray(record.itemIds) ? record.itemIds : []).slice(0, MAX_SEEN);
    var next = {
      noteIds: noteIds,
      itemIds: itemIds,
      acceptedAt: Number(record.acceptedAt) || 0,
      sourceIds: clean(record.sourceIds),
    };
    cache.record = next;
    return Promise.resolve(Tapp.storage.set(RECORD_KEY, next)).then(function () {
      return next;
    });
  }

  function readQueue() {
    return Promise.resolve(Tapp.storage.get(QUEUE_KEY)).then(function (value) {
      var queue = isObject(value) ? value : { paths: [], from: '' };
      return { paths: Array.isArray(queue.paths) ? queue.paths : [], from: clean(queue.from) };
    });
  }

  /**
   * 队列按 FIFO 排列：队首最旧、队尾最新。`writeQueue` 用 `slice(-MAX_QUEUE)`
   * 从队首丢弃溢出的旧条目，因此刚探测到的新 URL（队尾）永远不会被静默丢掉。
   */
  function writeQueue(queue) {
    var paths = Array.isArray(queue.paths) ? queue.paths.slice(-MAX_QUEUE) : [];
    return Tapp.storage.set(QUEUE_KEY, { paths: paths, from: clean(queue.from) });
  }

  function addAutoLog(entry) {
    return Promise.resolve(Tapp.storage.get(AUTO_KEY)).then(function (saved) {
      var data = isObject(saved) ? saved : {};
      var logs = Array.isArray(data.logs) ? data.logs : [];
      logs.unshift({
        id: uid(),
        ok: entry.ok === true,
        reason: clean(entry.reason),
        detail: mask(entry.detail),
        count: Number(entry.count) || 0,
        time: new Date().toISOString(),
      });
      data.logs = logs.slice(0, MAX_AUTO_LOGS);
      return Tapp.storage.set(AUTO_KEY, data);
    });
  }

  function checkDedupe(key) {
    return Promise.resolve(Tapp.storage.get(DEDUPE_KEY)).then(function (saved) {
      var table = isObject(saved) ? saved : {};
      var now = Date.now();
      if (table[key] && now - table[key] < DEDUPE_MS) return false;
      table[key] = now;
      var keys = Object.keys(table);
      if (keys.length > MAX_DEDUPE) {
        keys.sort(function (a, b) {
          return table[a] - table[b];
        });
        while (keys.length > MAX_DEDUPE) delete table[keys.shift()];
      }
      return Tapp.storage.set(DEDUPE_KEY, table).then(function () {
        return true;
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 签名原语
   * ------------------------------------------------------------------ */

  function utf8(value) {
    return new TextEncoder().encode(value);
  }

  function hex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(function (value) {
        return value.toString(16).padStart(2, '0');
      })
      .join('');
  }

  function base64(buffer) {
    var bytes = new Uint8Array(buffer);
    var text = '';
    for (var i = 0; i < bytes.length; i += 8192) {
      text += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(text);
  }

  function requireCrypto() {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error('当前沙箱没有 WebCrypto，无法为该服务商计算签名');
    }
    return crypto.subtle;
  }

  function sha256(value) {
    return requireCrypto()
      .digest('SHA-256', utf8(value))
      .then(hex);
  }

  function hmac(key, message, raw, hash) {
    var bytes = typeof key === 'string' ? utf8(key) : key;
    return requireCrypto()
      .importKey('raw', bytes, { name: 'HMAC', hash: hash || 'SHA-256' }, false, ['sign'])
      .then(function (cryptoKey) {
        return crypto.subtle.sign('HMAC', cryptoKey, utf8(message));
      })
      .then(function (result) {
        return raw ? new Uint8Array(result) : hex(result);
      });
  }

  function sortKeysDeep(value) {
    if (Array.isArray(value)) return value.map(sortKeysDeep);
    if (isObject(value)) {
      var out = {};
      Object.keys(value)
        .sort()
        .forEach(function (key) {
          out[key] = sortKeysDeep(value[key]);
        });
      return out;
    }
    return value;
  }

  function stableStringify(value) {
    return JSON.stringify(sortKeysDeep(value)).replace(/[\u007f-\uffff]/g, function (ch) {
      return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
    });
  }

  function edgePayload(config, urls, all) {
    if (all) return { Method: config.edgeMethod, Type: 'purge_all', ZoneId: config.zoneId };
    return {
      Method: config.edgeMethod,
      Targets: urls.map(function (value) {
        return new URL(value).href;
      }),
      Type: 'purge_url',
      ZoneId: config.zoneId,
    };
  }

  function edgeAuth(config, payload) {
    var timestamp = Math.floor(Date.now() / 1000);
    var date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    var service = 'teo';
    var host = 'teo.tencentcloudapi.com';
    var action = 'createpurgetask';
    var contentType = 'application/json';
    var canonicalBody = stableStringify(payload);
    var canonicalHeaders = 'content-type:' + contentType + '\n' + 'host:' + host + '\n' + 'x-tc-action:' + action + '\n';
    var signedHeaders = 'content-type;host;x-tc-action';
    var scope = date + '/' + service + '/tc3_request';
    return sha256(canonicalBody)
      .then(function (bodyHash) {
        var canonicalRequest = 'POST\n/\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + bodyHash;
        return sha256(canonicalRequest).then(function (requestHash) {
          return 'TC3-HMAC-SHA256\n' + timestamp + '\n' + scope + '\n' + requestHash;
        });
      })
      .then(function (stringToSign) {
        return hmac('TC3' + config.secretKey, date, true)
          .then(function (secretDate) {
            return hmac(secretDate, service, true);
          })
          .then(function (secretService) {
            return hmac(secretService, 'tc3_request', true);
          })
          .then(function (secretSigning) {
            return hmac(secretSigning, stringToSign, false);
          });
      })
      .then(function (signature) {
        return {
          timestamp: String(timestamp),
          canonicalBody: canonicalBody,
          authorization:
            'TC3-HMAC-SHA256 Credential=' +
            config.secretId +
            '/' +
            scope +
            ', SignedHeaders=' +
            signedHeaders +
            ', Signature=' +
            signature,
        };
      });
  }

  function percentEncode(value) {
    return encodeURIComponent(String(value)).replace(/[!'()*]/g, function (ch) {
      return '%' + ch.charCodeAt(0).toString(16).toUpperCase();
    });
  }

  function nonce() {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function aliyunQuery(config, urls, all) {
    var params = {
      AccessKeyId: config.aliAccessKeyId,
      Action: 'RefreshObjectCaches',
      Format: 'JSON',
      ObjectPath: all ? config.siteUrl + '/' : urls.join('\n'),
      ObjectType: all ? 'Directory' : 'File',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: nonce(),
      SignatureVersion: '1.0',
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      Version: '2018-05-10',
    };
    var canonical = Object.keys(params)
      .sort()
      .map(function (key) {
        return percentEncode(key) + '=' + percentEncode(params[key]);
      })
      .join('&');
    var stringToSign = 'GET&%2F&' + percentEncode(canonical);
    return hmac(config.aliAccessKeySecret + '&', stringToSign, true, 'SHA-1').then(function (signature) {
      return canonical + '&Signature=' + percentEncode(base64(signature));
    });
  }

  function xmlEscape(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function uniquePaths(values) {
    var seen = {};
    var out = [];
    for (var i = 0; i < values.length; i++) {
      var path = pathOf(values[i]);
      if (!path || seen[path]) continue;
      seen[path] = true;
      out.push(path);
    }
    return out;
  }

  function cloudFrontPaths(urls, all) {
    if (all) return ['/*'];
    return uniquePaths(urls);
  }

  function awsInvalidationXml(paths, callerReference) {
    return (
      '<?xml version="1.0" encoding="UTF-8"?><InvalidationBatch xmlns="http://cloudfront.amazonaws.com/doc/2020-05-31/"><Paths><Quantity>' +
      paths.length +
      '</Quantity><Items>' +
      paths
        .map(function (path) {
          return '<Path>' + xmlEscape(path) + '</Path>';
        })
        .join('') +
      '</Items></Paths><CallerReference>' +
      xmlEscape(callerReference) +
      '</CallerReference></InvalidationBatch>'
    );
  }

  function awsAuth(config, body) {
    var amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    var date = amzDate.slice(0, 8);
    var region = 'us-east-1';
    var service = 'cloudfront';
    var host = 'cloudfront.amazonaws.com';
    var contentType = 'application/xml';
    var canonicalUri = '/2020-05-31/distribution/' + encodeURIComponent(config.awsDistributionId) + '/invalidation';
    var scope = date + '/' + region + '/' + service + '/aws4_request';
    return sha256(body).then(function (payloadHash) {
      var canonicalHeaders =
        'content-type:' + contentType + '\n' +
        'host:' + host + '\n' +
        'x-amz-content-sha256:' + payloadHash + '\n' +
        'x-amz-date:' + amzDate + '\n';
      var signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
      var canonicalRequest = 'POST\n' + canonicalUri + '\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + payloadHash;
      return sha256(canonicalRequest).then(function (requestHash) {
        var stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + scope + '\n' + requestHash;
        return hmac('AWS4' + config.awsSecretAccessKey, date, true)
          .then(function (dateKey) {
            return hmac(dateKey, region, true);
          })
          .then(function (regionKey) {
            return hmac(regionKey, service, true);
          })
          .then(function (serviceKey) {
            return hmac(serviceKey, 'aws4_request', true);
          })
          .then(function (signingKey) {
            return hmac(signingKey, stringToSign, false);
          })
          .then(function (signature) {
            return {
              amzDate: amzDate,
              payloadHash: payloadHash,
              authorization:
                'AWS4-HMAC-SHA256 Credential=' +
                config.awsAccessKeyId +
                '/' +
                scope +
                ', SignedHeaders=' +
                signedHeaders +
                ', Signature=' +
                signature,
            };
          });
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 提交
   * ------------------------------------------------------------------ */

  function dedupeKey(config, urls, all) {
    if (all) return config.provider + '|' + config.siteUrl + '|all';
    var sorted = urls.slice().sort();
    return config.provider + '|' + config.siteUrl + '|' + (config.awsDistributionId || config.zoneId || '') + '|' + sorted.join('|');
  }

  function checkPayload(payload) {
    if (!payload || typeof payload !== 'object') return '';
    if (payload.success === false) {
      var first = Array.isArray(payload.errors) && payload.errors[0];
      return first && first.message ? String(first.message) : '服务商返回失败';
    }
    if (payload.errors && payload.errors.length && payload.errors[0] && payload.errors[0].message) {
      return String(payload.errors[0].message);
    }
    if (payload.Code) return String(payload.Code) + ': ' + String(payload.Message || '服务商返回失败');
    if (payload.code != null && payload.code !== 0 && payload.code !== '0' && payload.code !== 'Success') {
      return String(payload.code) + ': ' + String(payload.message || payload.Message || '请求被拒绝');
    }
    if (payload.Response && payload.Response.Error) {
      return String(payload.Response.Error.Code) + ': ' + String(payload.Response.Error.Message);
    }
    return '';
  }

  /** 把 Manifest 声明的 API 调用集中在这里，静态可校验每个 api 名。 */
  function dispatch(api, params) {
    if (api === 'cloudflarePurgeUrls') {
      var cloudflareUrls = params.urls;
      return Tapp.api('cloudflarePurgeUrls', {
        zoneId: params.config.zoneId,
        token: params.config.cfToken,
        files: cloudflareUrls,
      });
    }
    if (api === 'cloudflarePurgeAll') {
      return Tapp.api('cloudflarePurgeAll', { zoneId: params.config.zoneId, token: params.config.cfToken });
    }
    if (api === 'edgeOnePurgeAll') {
      var edgeAll = edgePayload(params.config, params.urls, true);
      return edgeAuth(params.config, edgeAll).then(function (signature) {
        return Tapp.api('edgeOnePurgeAll', {
          payload: edgeAll,
          timestamp: signature.timestamp,
          authorization: signature.authorization,
        });
      });
    }
    if (api === 'edgeOnePurgeUrls') {
      var edgeUrls = edgePayload(params.config, params.urls, false);
      return edgeAuth(params.config, edgeUrls).then(function (signature) {
        return Tapp.api('edgeOnePurgeUrls', {
          payload: edgeUrls,
          timestamp: signature.timestamp,
          authorization: signature.authorization,
        });
      });
    }
    if (api === 'aliyunPurge') {
      return aliyunQuery(params.config, params.urls, params.all).then(function (query) {
        return Tapp.api('aliyunPurge', { query: query });
      });
    }
    if (api === 'awsPurge') {
      var paths = cloudFrontPaths(params.urls, params.all);
      if (!paths.length) return Promise.reject(new Error('没有可提交的 CloudFront 失效路径'));
      if (paths.length > BATCH_PATHS) return Promise.reject(new Error('CloudFront 单次最多提交 ' + BATCH_PATHS + ' 个失效路径'));
      var callerReference = 'myriad-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      var body = awsInvalidationXml(paths, callerReference);
      return awsAuth(params.config, body).then(function (signature) {
        return Tapp.api('awsPurge', {
          distributionId: params.config.awsDistributionId,
          body: body,
          amzDate: signature.amzDate,
          payloadHash: signature.payloadHash,
          authorization: signature.authorization,
        });
      });
    }
    return Promise.reject(new Error('不支持的 CDN 服务商'));
  }

  /** 本服务商「按 URL 刷新」与「全站清理」对应的声明式 API 名称。 */
  function apisFor(provider) {
    if (provider === 'cloudflare') return { urls: 'cloudflarePurgeUrls', all: 'cloudflarePurgeAll' };
    if (provider === 'edgeone') return { urls: 'edgeOnePurgeUrls', all: 'edgeOnePurgeAll' };
    if (provider === 'aliyun') return { urls: 'aliyunPurge', all: 'aliyunPurge' };
    if (provider === 'aws') return { urls: 'awsPurge', all: 'awsPurge' };
    return null;
  }

  function send(api, config, urls, all) {
    return dispatch(api, { config: config, urls: urls, all: all }).then(function (payload) {
      var failure = checkPayload(payload);
      if (failure) throw new Error(failure);
      return payload;
    });
  }

  function buildRequest(config, urls, all) {
    var names = apisFor(config.provider);
    if (!names) return Promise.reject(new Error('不支持的 CDN 服务商'));
    return send(all ? names.all : names.urls, config, urls, all);
  }

  function purge(config, urls, all, options) {
    options = options || {};
    var normalized = normalizeConfig(config);
    var label = all ? '全站缓存' : urls.length + ' 个 URL';
    var error = configError(normalized);
    if (error) return Promise.reject(new Error(error));
    if (!all && !urls.length) return Promise.reject(new Error('没有需要刷新的 URL'));
    // 自动提交另有「只提交新增内容」的判据，不再叠加手动按钮的 5 秒防重复。
    if (options.dedupe === false) {
      return buildRequest(normalized, urls, all).then(function (payload) {
        return { skipped: false, label: label, provider: normalized.provider, payload: payload };
      });
    }
    return checkDedupe(dedupeKey(normalized, urls, all)).then(function (fresh) {
      if (!fresh && options.force !== true) {
        return { skipped: true, label: label, provider: normalized.provider };
      }
      return buildRequest(normalized, urls, all).then(function (payload) {
        return { skipped: false, label: label, provider: normalized.provider, payload: payload };
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 变更探测
   * ------------------------------------------------------------------ */

  function pickUrl(candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var text = clean(candidates[i]);
      if (/^https?:\/\//i.test(text)) return text;
    }
    return '';
  }

  /**
   * 把 `phantasiList.list()` 的条目归一化。
   * `link` 是原文站外地址，`id` 用来生成站内阅读页地址（/journal/articles/{id}）。
   */
  function articleEntry(raw) {
    if (!isObject(raw)) return null;
    var id = raw.id != null ? String(raw.id) : '';
    if (!id) return null;
    var candidates = [raw.link, raw.url, raw.permalink, raw.source_url];
    if (isObject(raw.source)) candidates.push(raw.source.link, raw.source.url);
    if (isObject(raw.feed)) candidates.push(raw.feed.link, raw.feed.url);
    return {
      id: id,
      link: pickUrl(candidates),
      title: clean(raw.title || raw.name || ''),
      source_name: clean(raw.source_name || (isObject(raw.source) ? raw.source.name : '')),
      published_at: raw.published_at != null ? raw.published_at : raw.publishedAt != null ? raw.publishedAt : raw.created_at,
      updated_at: raw.updated_at != null ? raw.updated_at : raw.updatedAt,
    };
  }

  /**
   * 读取手帐内容源与文章。
   *
   * 重要：`phantasiList.list()` 返回的是**订阅源里的文章**，`link` 是原文站外地址；
   * 它并不是「本站自己发布的笔记」，宿主目前也没有提供列出站内笔记的只读 Tapp API
   * （沙箱契约里与 note 相关的只有 `federation.createNote`，是写入操作）。
   * `phantasiList.sources()` 只返回源元数据（id/name/url/item_count…），不含 items。
   * 因此「新文章」与「源变更」共用这一次 list() 结果，不重复请求也不重复计数。
   */
  function readPhantasi() {
    var api = Tapp.phantasiList;
    if (!api || typeof api.list !== 'function') {
      return Promise.resolve({ available: false, sourcesAvailable: false, articles: [], sources: [] });
    }
    var articles = api.list({ limit: MAX_ITEMS, page: 1, filter: 'all' })
      .then(function (result) {
        var raw = isObject(result) && Array.isArray(result.items) ? result.items : Array.isArray(result) ? result : [];
        return { available: true, articles: raw.map(articleEntry).filter(Boolean) };
      })
      .catch(function (error) {
        return { available: false, articles: [], error: safeError(error) };
      });
    var sources = typeof api.sources === 'function'
      ? Promise.resolve(api.sources())
          .then(function (result) {
            var list = Array.isArray(result) ? result : isObject(result) && Array.isArray(result.sources) ? result.sources : isObject(result) && Array.isArray(result.items) ? result.items : [];
            return { available: true, sources: list.filter(isObject) };
          })
          .catch(function (error) {
            return { available: false, sources: [], error: safeError(error) };
          })
      : Promise.resolve({ available: false, sources: [] });
    return Promise.all([articles, sources]).then(function (values) {
      return {
        available: values[0].available,
        articles: values[0].articles,
        sourcesAvailable: values[1].available,
        sources: values[1].sources,
      };
    });
  }

  function resolveTargets(auto, entries, template, siteUrl) {
    var urls = [];
    var seen = {};
    // 必须按 origin 比较：字符串前缀会把 https://example.com.evil.test/ 当成站内地址，
    // 这类 URL 会让服务商整批拒绝，连带站内 URL 也刷不掉。
    var siteOrigin = '';
    try {
      siteOrigin = new URL(siteUrl).origin;
    } catch (error) {
      return urls;
    }
    function push(url) {
      // 统一去掉 hash；顺便把根地址规范为 https://site/
      var normalized = toHttpUrl(url, siteUrl + '/');
      if (!normalized) return;
      var parsed;
      try {
        parsed = new URL(normalized);
      } catch (error) {
        return;
      }
      parsed.hash = '';
      normalized = parsed.href;
      if (parsed.origin !== siteOrigin) return;
      if (seen[normalized]) return;
      seen[normalized] = true;
      urls.push(normalized);
    }
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var candidate = fillTemplate(template, entry);
      if (!candidate || !toHttpUrl(candidate, siteUrl + '/')) candidate = entry.link;
      if (candidate) push(candidate);
    }
    if (auto.includeHomepage) push(siteUrl + '/');
    for (var j = 0; j < auto.wildcard.length; j++) push(auto.wildcard[j]);
    return urls.slice(0, clamp(auto.maxUrls, 1, 500));
  }

  /**
   * 挑出「基线之后新增」的条目。
   *
   * 基线时间戳是毫秒，而 feed 常只给到秒精度，同一秒发布的内容换算回来会略小于
   * 基线，因此比较时必须留 5 秒容差，否则刚发布的笔记会被误判成历史补齐。
   * 没有可用时间戳的条目靠 ID 快照判断，且刚建立基线时不补刷。
   */
  function freshEntries(entries, known, acceptedAt) {
    var seen = {};
    for (var i = 0; i < known.length; i++) seen[known[i]] = true;
    var floor = acceptedAt ? acceptedAt - 5000 : 0;
    return entries.filter(function (entry) {
      if (seen[entry.id]) return false;
      var stamp = toTime(entry.published_at);
      if (stamp) return stamp >= floor;
      // 无时间戳：基线前就存在的内容不补刷
      return !acceptedAt || Date.now() - acceptedAt >= BACKFILL_MS;
    });
  }

  function idsOf(entries) {
    var out = [];
    for (var i = 0; i < entries.length && out.length < MAX_SEEN; i++) out.push(entries[i].id);
    return out;
  }

  function acknowledgeReason(auto) {
    if (auto.lastCheckAt) return '';
    return auto.purgeOnStart ? '首次运行（按设置补刷启动前内容）' : '首次运行（已记录基线，不补刷历史内容）';
  }

  /** 取某个服务商的按 URL 批量上限；未知服务商退回保守默认值。 */
  function batchLimit(provider) {
    return BATCH_URLS_BY_PROVIDER[provider] || BATCH_URLS_FALLBACK;
  }

  function flushPending(config) {
    if (runtime.running) {
      runtime.pending = true;
      return Promise.resolve({ skipped: true, reason: '已有自动提交在执行' });
    }
    runtime.running = true;
    return readQueue()
      .then(function (queue) {
        if (!queue.paths.length) return null;
        // 队首最旧、队尾最新：从队首取一批先提交（FIFO），新探测到的内容留在队尾。
        // 批量上限按服务商取（非企业套餐也安全），出队与剩余必须用同一个上限。
        var limit = batchLimit(config && config.provider);
        var urls = queue.paths.slice(0, limit);
        var rest = queue.paths.slice(limit);
        var label = clean(queue.from) || '自动提交';
        return purge(config, urls, false, { dedupe: false })
          .then(function (result) {
            if (result && result.skipped) {
              return { ok: false, reason: label, detail: '与最近一次提交重复，已跳过', count: urls.length };
            }
            return writeQueue({ paths: rest, from: rest.length ? queue.from : '' }).then(function () {
              return { ok: true, reason: label, detail: urls.join(' · '), count: urls.length, rest: rest.length };
            });
          })
          .catch(function (error) {
            return { ok: false, reason: label, detail: safeError(error), count: urls.length };
          });
      })
      .then(function (result) {
        if (!result) return null;
        return addAutoLog(result).then(function () {
          return prime().then(function () {
            return saveAuto(
              Object.assign({}, cache.auto, {
                lastSubmitAt: result.ok ? Date.now() : cache.auto.lastSubmitAt,
                lastReason: result.reason,
                lastCount: result.count,
              }),
            );
          });
        }).then(function () {
          return result;
        });
      })
      .then(function (result) {
        runtime.running = false;
        if (runtime.pending) {
          runtime.pending = false;
          return prime().then(function () {
            return flushPending(cache.config);
          });
        }
        return result;
      })
      .catch(function (error) {
        runtime.running = false;
        runtime.pending = false;
        // 落盘失败不能只是静默重抛：留一条日志，界面才能看到队列为什么没动。
        var detail = safeError(error);
        return addAutoLog({
          ok: false,
          reason: '自动提交',
          detail: '写入本地状态失败：' + detail,
          count: 0,
        })
          .catch(function () {
            return null;
          })
          .then(function () {
            return { ok: false, reason: '自动提交', detail: detail, count: 0 };
          });
      });
  }

  function submitAll(config) {
    var reason = '定时全站清理';
    var urls = [config.siteUrl + '/'];
    return purge(config, urls, true, { dedupe: false })
      .then(function (result) {
        if (result && result.skipped) return { ok: false, reason: reason, detail: '与最近一次提交重复，已跳过', count: 1 };
        return { ok: true, reason: reason, detail: '已提交全站缓存清理', count: 1 };
      })
      .catch(function (error) {
        return { ok: false, reason: reason, detail: safeError(error), count: 1 };
      })
      .then(function (result) {
        return addAutoLog(result).then(function () {
          return prime();
        }).then(function () {
          return saveAuto(Object.assign({}, cache.auto, {
            lastSubmitAt: result.ok ? Date.now() : cache.auto.lastSubmitAt,
            lastReason: result.reason,
            lastCount: result.count,
          }));
        }).then(function () {
          return result;
        });
      });
  }

  function submitList(config, patterns) {
    var urls = normalizeWildcards(patterns, config.siteUrl);
    var reason = '定时清理自定义 URL';
    if (!urls.length) {
      return Promise.resolve({ ok: false, reason: reason, detail: '自定义 URL 列表为空', count: 0 });
    }
    // 超出服务商单次上限的部分本轮不会提交，因此 count 必须报实际提交条数，
    // 并在 detail 里说明被跳过的内容，避免日志谎报提交条数。
    var limit = batchLimit(config && config.provider);
    var batch = urls.slice(0, limit);
    var truncated = urls.length - batch.length;
    var detail = batch.join(' · ');
    if (truncated > 0) {
      detail += (detail ? ' ｜ ' : '') + '已提交 ' + batch.length + ' / ' + urls.length + ' 条，超出服务商单次上限的部分已跳过';
    }
    return purge(config, batch, false, { dedupe: false })
      .then(function (result) {
        if (result && result.skipped) return { ok: false, reason: reason, detail: '与最近一次提交重复，已跳过', count: batch.length };
        return { ok: true, reason: reason, detail: detail, count: batch.length };
      })
      .catch(function (error) {
        return { ok: false, reason: reason, detail: safeError(error), count: batch.length };
      })
      .then(function (result) {
        return addAutoLog(result).then(prime).then(function () {
          return saveAuto(Object.assign({}, cache.auto, {
            lastSubmitAt: result.ok ? Date.now() : cache.auto.lastSubmitAt,
            lastReason: result.reason,
            lastCount: result.count,
          }));
        }).then(function () {
          return result;
        });
      });
  }

  function evaluate(options) {
    options = options || {};
    return prime().then(function (data) {
      return readAll().then(function (snapshot) {
        var auto = snapshot.auto;
        var config = normalizeConfig(snapshot.config);
        cache.config = config;
        var record = snapshot.record;
        // v1.2.0 把「笔记」与「RSS 条目」两条链路合并成一条「手帐文章」链路，
        // noteIds / itemIds 两个键现在都保存文章 ID；取并集是为了让升级前的
        // 旧记录仍被认作「已知」，不会把已见文章重复当成新增。
        var noteIds = Array.isArray(record.noteIds) ? record.noteIds : [];
        var itemIds = Array.isArray(record.itemIds) ? record.itemIds : [];
        var knownArticleIds = [];
        var seenKnown = {};
        var allKnown = noteIds.concat(itemIds);
        for (var ki = 0; ki < allKnown.length; ki++) {
          if (allKnown[ki] && !seenKnown[allKnown[ki]]) {
            seenKnown[allKnown[ki]] = true;
            knownArticleIds.push(allKnown[ki]);
          }
        }
        var previousSourceIds = clean(record.sourceIds);
        var nextSourceIds = previousSourceIds;
        record.noteIds = noteIds;
        record.itemIds = itemIds;

        var initializing = !auto.lastCheckAt;
        var acceptedAt = initializing ? Date.now() : auto.acceptedAt || Date.now();
        var acknowledged = acknowledgeReason(auto);
        var reason = acknowledged;
        var paths = [];
        var jobs = [];
        var articlesAvailable = true;
        var sourcesAvailable = true;

        /**
         * 自动提交没开启时不能写任何状态。
         *
         * 否则每次启动（含 bootstrap 的立即核对）都会把 lastCheckAt / acceptedAt 提前写上，
         * 管理员过几天才打开自动提交时 initializing 已经是 false、快照是空的，
         * freshEntries 会把安装以来发布的全部文章当成新增一次性刷掉——这与
         * 「首次运行只建立基线、不补刷历史内容」的承诺相反。
         */
        if (!auto.enabled) {
          return { checked: false, reason: '', paths: [], count: 0, articlesAvailable: articlesAvailable, sourcesAvailable: sourcesAvailable };
        }

        function finish(extraReasons) {
          for (var i = 0; i < extraReasons.length; i++) {
            if (extraReasons[i] && reason.indexOf(extraReasons[i]) < 0) reason = reason ? reason + ' · ' + extraReasons[i] : extraReasons[i];
          }
          var unique = [];
          var seenPaths = {};
          for (var j = 0; j < paths.length; j++) {
            var wildcard = wildcardToUrl(paths[j], config.siteUrl);
            var path = pathOf(wildcard);
            if (!path || seenPaths[path]) continue;
            seenPaths[path] = true;
            unique.push(wildcard);
          }
          record.acceptedAt = acceptedAt;
          record.sourceIds = nextSourceIds;
          var nextAuto = Object.assign({}, auto, {
            lastCheckAt: Date.now(),
            acceptedAt: acceptedAt,
            lastCount: unique.length,
            lastReason: unique.length ? reason : acknowledged,
          });
          var queueJobs = [];
          var queueOverflow = 0;
          if (unique.length) queueJobs.push(readQueue().then(function (queue) {
            var merged = [];
            var seenQueue = {};
            // 队首最旧、队尾最新：新探测到的 URL 追加到队尾
            for (var k = 0; k < queue.paths.length; k++) {
              if (!seenQueue[queue.paths[k]]) {
                seenQueue[queue.paths[k]] = true;
                merged.push(queue.paths[k]);
              }
            }
            for (var m = 0; m < unique.length; m++) {
              if (!seenQueue[unique[m]]) {
                seenQueue[unique[m]] = true;
                merged.push(unique[m]);
              }
            }
            queueOverflow = Math.max(0, merged.length - MAX_QUEUE);
            return writeQueue({ paths: merged, from: reason }).then(function () {
              if (!queueOverflow || !options.log) return null;
              // 溢出条目在下一轮不会再被探测到，必须留痕，否则是静默漏刷
              return addAutoLog({
                ok: false,
                reason: reason,
                detail: '队列已满，丢弃 ' + queueOverflow + ' 个最旧地址',
                count: queueOverflow,
              });
            });
          }));
          if (options.log) {
            queueJobs.push(addAutoLog({
              ok: true,
              reason: reason,
              detail: unique.length ? unique.join(' · ') : '未发现需要刷新的内容变更',
              count: unique.length,
            }));
          }
          // 先落变更基线再更新状态：顺序反过来的话，记录写失败会让 lastCheckAt
          // 前进而 noteIds 仍是旧值，下一轮把已见内容重复提交一遍。
          return Promise.all(queueJobs)
            .then(function () {
              return saveRecord(record);
            })
            .then(function () {
              return saveAuto(nextAuto);
            })
            .then(function () {
              runtime.lastReason = reason;
              runtime.lastCount = unique.length;
              var result = {
                checked: true,
                reason: reason,
                paths: unique,
                count: unique.length,
                articlesAvailable: articlesAvailable,
                sourcesAvailable: sourcesAvailable,
              };
              if (!options.dryRun && unique.length) {
                return flushPending(config).then(function () {
                  return result;
                });
              }
              return result;
            });
        }

        if (auto.enabled && (auto.onArticles || auto.onSourceChange)) {
          jobs.push(readPhantasi().then(function (data) {
            if (!data.available) articlesAvailable = false;
            if (!data.sourcesAvailable) sourcesAvailable = false;
            if (!data.available) return '手帐文章接口不可用';
            var reasons = [];
            // 1) 新文章：把新增文章映射到站内阅读页
            if (auto.onArticles) {
              var fresh = initializing
                ? (auto.purgeOnStart ? data.articles.slice(0, clamp(auto.maxUrls, 1, 500)) : [])
                : freshEntries(data.articles, knownArticleIds, acceptedAt).slice(0, clamp(auto.maxUrls, 1, 500));
              if (fresh.length) {
                paths = paths.concat(resolveTargets(auto, fresh, auto.articlePathTemplate, config.siteUrl));
                reasons.push('手帐新文章 +' + fresh.length);
              }
            }
            // 每轮都回写快照，否则下一轮会把同一批文章再提交一遍。
            // noteIds / itemIds 是 v1.2.0 遗留的两个键，现在都保存文章 ID，
            // 读取时取并集，升级后不会把旧记录里的已见文章重新当成新增。
            var snapshot = idsOf(data.articles);
            record.noteIds = snapshot;
            record.itemIds = snapshot;
            // 2) 源本身变更：没有对应站内条目地址，刷新站点首页与固定附加地址
            var sourceIds = data.sources.map(function (source) {
              return [source.id, source.url, source.name || source.title, source.updated_at || source.updatedAt]
                .map(clean).join('|');
            }).sort().join(',');
            if (data.sourcesAvailable) nextSourceIds = sourceIds;
            if (auto.onSourceChange && data.sourcesAvailable && !initializing && previousSourceIds !== sourceIds) {
              reasons.push('订阅源列表已变更');
              paths.push(config.siteUrl + '/');
              paths = paths.concat(auto.wildcard);
            }
            return reasons.join(' · ');
          }).catch(function (error) {
            articlesAvailable = false;
            return '手帐内容探测失败：' + safeError(error);
          }));
        }

        return Promise.all(jobs).then(function (reasons) {
          return finish(reasons);
        });
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 调度
   * ------------------------------------------------------------------ */

  function resetBaseline() {
    return Promise.resolve()
      .then(function () {
        return saveRecord({ noteIds: [], itemIds: [], acceptedAt: 0, sourceIds: '' });
      })
      .then(function () {
        return prime();
      })
      .then(function () {
        return saveAuto(Object.assign({}, cache.auto, { lastCheckAt: 0, acceptedAt: 0, lastReason: '基线已重置', lastCount: 0 }));
      });
  }

  function schedulerAvailable() {
    return !!(Tapp.scheduler && typeof Tapp.scheduler.register === 'function');
  }

  function onTask(taskId, handler) {
    if (!Tapp.scheduler || typeof Tapp.scheduler.onTask !== 'function') return;
    try {
      Tapp.scheduler.onTask(taskId, handler);
    } catch (error) {
      console.warn('[CDN Cache] onTask 注册失败', taskId, error);
    }
  }

  function unregister(taskId) {
    if (!Tapp.scheduler || typeof Tapp.scheduler.unregister !== 'function') return Promise.resolve();
    return Promise.resolve(Tapp.scheduler.unregister(taskId)).catch(function () {
      return null;
    });
  }

  /**
   * 尝试取得一次性启动租约。两个沙箱同时启动时只有一个能拿到，
   * 另一个直接跳过启动核对（定时任务回调不受影响）。
   * 存储失败时返回 true：宁可多做一次核对，也不要让后台链路整个不动。
   */
  function acquireStartupLease() {
    var now = Date.now();
    return Promise.resolve(Tapp.storage.get(LEASE_KEY))
      .then(function (saved) {
        var until = isObject(saved) ? Number(saved.until) || 0 : 0;
        if (until > now) return false;
        return Promise.resolve(Tapp.storage.set(LEASE_KEY, { until: now + LEASE_MS })).then(function () {
          return true;
        });
      })
      .catch(function () {
        return true;
      });
  }

  function runSweep() {
    return prime()
      .then(function () {
        return readAll();
      })
      .then(function (snapshot) {
        var auto = snapshot.auto;
        var config = normalizeConfig(snapshot.config);
        cache.config = config;
        if (!auto.periodicEnabled) return null;
        if (configError(config)) return null;
        if (auto.periodicScope === 'all') return submitAll(config);
        if (auto.periodicScope === 'list') return submitList(config, auto.periodicManualUrls);
        return flushPending(config);
      });
  }

  function syncScheduler(options) {
    options = options || {};
    if (!schedulerAvailable()) return Promise.resolve({ reason: 'scheduler-unavailable' });
    return isAdmin().then(function (admin) {
      if (!admin) return { reason: 'not-admin' };
      return prime().then(function () {
        return readAll();
      }).then(function (snapshot) {
        var auto = snapshot.auto;
        var valid = !configError(snapshot.config);
        var tasks = [];
        if (auto.enabled && valid) {
          tasks.push({
            taskId: AUTO_TASK_ID,
            name: 'CDN 缓存 · 内容变更自动提交',
            scheduleType: 'interval',
            schedule: { interval: auto.intervalMinutes * 60000 },
            executionTarget: 'frontend',
            missedPolicy: 'run-once',
          });
        }
        if (auto.periodicEnabled && valid) {
          tasks.push({
            taskId: SWEEP_TASK_ID,
            name: 'CDN 缓存 · 定期提交',
            scheduleType: 'interval',
            schedule: { interval: auto.periodicMinutes * 60000 },
            executionTarget: 'frontend',
            missedPolicy: 'run-once',
          });
        }
        var chain = Promise.resolve();
        [AUTO_TASK_ID, SWEEP_TASK_ID].forEach(function (taskId) {
          var desired = null;
          for (var i = 0; i < tasks.length; i++) if (tasks[i].taskId === taskId) desired = tasks[i];
          chain = chain.then(function () {
            if (!desired) return unregister(taskId);
            if (typeof Tapp.scheduler.get === 'function') {
              return Promise.resolve(Tapp.scheduler.get(taskId))
                .catch(function () {
                  return null;
                })
                .then(function (current) {
                  if (current && current.scheduleType === desired.scheduleType &&
                    current.schedule && current.schedule.interval === desired.schedule.interval &&
                    current.executionTarget === desired.executionTarget && current.missedPolicy === desired.missedPolicy) return null;
                  return Tapp.scheduler.register(desired);
                });
            }
            return Tapp.scheduler.register(desired);
          });
        });
        return chain.then(function () {
          scheduled = {
            auto: auto.enabled,
            sweep: auto.periodicEnabled,
            intervalMinutes: auto.intervalMinutes,
            periodicMinutes: auto.periodicMinutes,
            periodicScope: auto.periodicScope,
          };
          return { reason: 'ok', auto: auto.enabled, sweep: auto.periodicEnabled };
        });
      });
    });
  }

  /**
   * 调度回调里必须重新确认管理员身份：任务 ID 属于安装级，注册时是管理员，
   * 之后用户可能登出或降级。非管理员直接跳过，不读取配置也不出站。
   */
  function guardAdminTask(label, run) {
    return isAdmin()
      .then(function (admin) {
        if (!admin) return { skipped: true, reason: '当前用户不是管理员' };
        return run();
      })
      .catch(function (error) {
        console.warn('[CDN Cache] ' + label + '失败', error);
        return null;
      });
  }

  /**
   * 注册 onTask 回调并做一次立即核对。core 在 headless 下也要调用，
   * 因此不能依赖 Page 层的 DOM 或 onReady UI 分支。
   *
   * 启动核对会先抢一次跨沙箱租约：Page 与 headless 同时 bootstrap 时只有一个
   * 沙箱执行，避免同一批 URL 被提交两遍、以及 AUTO_KEY / 队列的读-改-写互相覆盖。
   */
  function bootstrap() {
    var tasks = [];
    if (schedulerAvailable()) {
      onTask(AUTO_TASK_ID, function () {
        return guardAdminTask('自动核对', function () {
          return evaluate({});
        });
      });
      onTask(SWEEP_TASK_ID, function () {
        return guardAdminTask('定期提交', function () {
          return runSweep();
        });
      });
      tasks.push(syncScheduler());
    }
    tasks.push(
      isAdmin().then(function (admin) {
        if (!admin) return null;
        return acquireStartupLease().then(function (acquired) {
          if (!acquired) return null;
          return evaluate({});
        });
      }).catch(function (error) {
        console.warn('[CDN Cache] 首次核对失败', error);
        return null;
      }),
    );
    return Promise.all(tasks);
  }

  /* ------------------------------------------------------------------ *
   * 对外接口
   * ------------------------------------------------------------------ */

  return {
    CONFIG_KEY: CONFIG_KEY,
    LOG_KEY: LOG_KEY,
    AUTO_KEY: AUTO_KEY,
    QUEUE_KEY: QUEUE_KEY,
    RECORD_KEY: RECORD_KEY,
    DEDUPE_KEY: DEDUPE_KEY,
    LEASE_KEY: LEASE_KEY,
    DEFAULT_ARTICLE_PATH: DEFAULT_ARTICLE_PATH,
    MAX_LOGS: MAX_LOGS,
    MAX_AUTO_LOGS: MAX_AUTO_LOGS,
    DEDUPE_MS: DEDUPE_MS,
    AUTO_TASK_ID: AUTO_TASK_ID,
    SWEEP_TASK_ID: SWEEP_TASK_ID,
    PROVIDERS: PROVIDERS,
    providerName: providerName,
    normalizeConfig: normalizeConfig,
    configError: configError,
    normalizeAuto: normalizeAuto,
    autoError: autoError,
    mask: mask,
    safeError: safeError,
    toTime: toTime,
    pathOf: pathOf,
    fillTemplate: fillTemplate,
    cloudFrontPaths: cloudFrontPaths,
    checkDedupe: checkDedupe,
    isAdmin: isAdmin,
    prime: prime,
    readAll: readAll,
    saveConfig: saveConfig,
    saveAuto: saveAuto,
    saveRecord: saveRecord,
    readQueue: readQueue,
    writeQueue: writeQueue,
    addAutoLog: addAutoLog,
    purge: purge,
    dispatch: dispatch,
    apisFor: apisFor,
    buildRequest: buildRequest,
    flushPending: flushPending,
    batchLimit: batchLimit,
    submitAll: submitAll,
    submitList: submitList,
    runSweep: runSweep,
    evaluate: evaluate,
    resetBaseline: resetBaseline,
    syncScheduler: syncScheduler,
    schedulerAvailable: schedulerAvailable,
    acquireStartupLease: acquireStartupLease,
    bootstrap: bootstrap,
    state: cache,
    runtime: runtime,
  };
})();

if (typeof window !== 'undefined') window.CdnCacheCore = engine;
if (typeof module !== 'undefined' && module.exports) module.exports = engine;

// core 是 headless 常驻唯一执行的代码，因此调度回调与首次核对在这里自启动，
// 不能依赖 Page 的 onReady 分支（沙箱三种模式都会先执行 core）。
if (typeof Tapp !== 'undefined' && Tapp) {
  engine.bootstrap().catch(function (error) {
    console.warn('[CDN Cache] 后台任务初始化失败', error);
  });
}
