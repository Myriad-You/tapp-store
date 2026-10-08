/**
 * CDN 缓存刷新 · Page 界面层
 *
 * 只负责管理员界面与交互；配置读写、签名、提交、调度注册全部委托给共享层
 * （core.js / CdnCacheCore）。headless core 不加载本文件，因此这里出现的任何
 * DOM 操作都不会进入后台链路。Page 入口通过 require 取得下面的 createUi。
 */

'use strict';

function createUi(core) {
  var state = {
    config: null,
    auto: null,
    logs: [],
    autoLogs: [],
    queue: [],
    isAdmin: false,
    busy: false,
    checks: null,
    lastResult: '等待操作',
  };
  var toastTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function text(id, value) {
    var node = $(id);
    if (node) node.textContent = value == null ? '' : String(value);
  }

  function value(id) {
    var node = $(id);
    return node ? node.value : '';
  }

  function checked(id) {
    var node = $(id);
    return node ? node.checked === true : false;
  }

  function localNotify(message, type) {
    var toast = $('local-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'local-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.className = 'local-toast ' + (type || 'info') + ' show';
    toast.textContent = message;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 3200);
  }

  function notify(message, type) {
    var kind = type || 'info';
    localNotify(message, kind);
    try {
      if (Tapp.ui && typeof Tapp.ui.showNotification === 'function') {
        Tapp.ui.showNotification({
          title: kind === 'success' ? '成功' : kind === 'error' ? '错误' : kind === 'warning' ? '注意' : '提示',
          message: message,
          type: kind,
          duration: 3200,
        });
      }
    } catch (error) {
      console.warn('[CDN Cache] 通知桥接失败', error);
    }
    return Promise.resolve();
  }

  async function currentAdmin() {
    try {
      return (await Tapp.user.getRole()) === 'admin' && (await Tapp.user.isAdmin());
    } catch (error) {
      return false;
    }
  }

  function showAccess(admin) {
    if ($('admin-ui')) $('admin-ui').hidden = !admin;
    if ($('public-ui')) $('public-ui').hidden = admin;
  }

  async function requireAdmin() {
    var allowed = await currentAdmin();
    state.isAdmin = allowed;
    if (!allowed) {
      showAccess(false);
      await notify('仅站点管理员可以管理 CDN', 'error');
    }
    return allowed;
  }

  /* ---------------------------- 配置表单 ---------------------------- */

  function readInputs() {
    return core.normalizeConfig({
      provider: value('provider'),
      zoneId: value('zone-id'),
      cfToken: value('cf-token'),
      secretId: value('secret-id'),
      secretKey: value('secret-key'),
      edgeMethod: value('edge-method'),
      aliAccessKeyId: value('ali-access-key-id'),
      aliAccessKeySecret: value('ali-access-key-secret'),
      awsDistributionId: value('aws-distribution-id'),
      awsAccessKeyId: value('aws-access-key-id'),
      awsSecretAccessKey: value('aws-secret-access-key'),
      siteUrl: value('site-url'),
    });
  }

  function fillInputs(config) {
    if (!config) return;
    if ($('provider')) $('provider').value = config.provider;
    if ($('zone-id')) $('zone-id').value = config.zoneId;
    if ($('cf-token')) $('cf-token').value = config.cfToken;
    if ($('secret-id')) $('secret-id').value = config.secretId;
    if ($('secret-key')) $('secret-key').value = config.secretKey;
    if ($('edge-method')) $('edge-method').value = config.edgeMethod;
    if ($('ali-access-key-id')) $('ali-access-key-id').value = config.aliAccessKeyId;
    if ($('ali-access-key-secret')) $('ali-access-key-secret').value = config.aliAccessKeySecret;
    if ($('aws-distribution-id')) $('aws-distribution-id').value = config.awsDistributionId;
    if ($('aws-access-key-id')) $('aws-access-key-id').value = config.awsAccessKeyId;
    if ($('aws-secret-access-key')) $('aws-secret-access-key').value = config.awsSecretAccessKey;
    if ($('site-url')) $('site-url').value = config.siteUrl;
    renderProvider();
  }

  function renderProvider() {
    var provider = value('provider');
    ['cloudflare', 'edgeone', 'aliyun', 'aws'].forEach(function (name) {
      var node = $(name + '-fields');
      if (node) node.hidden = provider !== name;
    });
    var resourceField = $('resource-id-field');
    if (resourceField) resourceField.hidden = provider === 'aliyun' || provider === 'aws';
    text('resource-id-label', provider === 'edgeone' ? 'EdgeOne Zone ID' : 'Zone ID');
    text('provider-badge', core.providerName(provider));
  }

  function parseUrls() {
    var seen = {};
    return String(value('urls'))
      .split(/\r?\n|,/)
      .map(function (item) {
        return String(item || '').trim();
      })
      .filter(function (url) {
        if (!/^https?:\/\//i.test(url) || seen[url]) return false;
        seen[url] = true;
        return true;
      });
  }

  function setBusy(busy) {
    state.busy = busy;
    ['save-btn', 'clear-config-btn', 'purge-urls-btn', 'purge-all-btn', 'auto-save-btn', 'auto-check-btn', 'auto-flush-btn', 'auto-reset-btn', 'auto-all-btn'].forEach(function (id) {
      var node = $(id);
      if (node) node.disabled = busy;
    });
  }

  /* ---------------------------- 日志 ---------------------------- */

  async function saveLogs() {
    await Tapp.storage.set(core.LOG_KEY, state.logs.slice(0, core.MAX_LOGS));
  }

  async function addLog(ok, title, detail) {
    state.logs.unshift({
      id: Date.now() + '-' + Math.random().toString(16).slice(2),
      ok: !!ok,
      title: title,
      detail: detail,
      time: new Date().toISOString(),
    });
    state.logs = state.logs.slice(0, core.MAX_LOGS);
    await saveLogs();
    renderLogs();
  }

  function logRow(item, source) {
    var row = document.createElement('div');
    row.className = 'log' + (item.ok ? '' : ' error');
    var dot = document.createElement('span');
    dot.className = 'log-status';
    var main = document.createElement('div');
    main.className = 'log-main';
    var title = document.createElement('div');
    title.className = 'log-title';
    title.textContent = item.title || item.reason || '操作';
    var detail = document.createElement('div');
    detail.className = 'log-detail';
    detail.textContent = core.mask(item.detail || '');
    var meta = document.createElement('time');
    meta.className = 'log-time';
    meta.textContent = (source ? source + ' · ' : '') + new Date(item.time).toLocaleString();
    main.appendChild(title);
    main.appendChild(detail);
    row.appendChild(dot);
    row.appendChild(main);
    row.appendChild(meta);
    return row;
  }

  function renderLogs() {
    var box = $('logs');
    if (!box) return;
    box.replaceChildren();
    var rows = [];
    state.autoLogs.forEach(function (item) {
      rows.push(logRow(item, '自动'));
    });
    state.logs.forEach(function (item) {
      rows.push(logRow(item, '手动'));
    });
    if (!rows.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '暂无刷新记录';
      box.appendChild(empty);
      return;
    }
    rows.forEach(function (row) {
      box.appendChild(row);
    });
  }

  /* ---------------------------- 自动化面板 ---------------------------- */

  function relative(timestamp) {
    var value = Number(timestamp) || 0;
    if (!value) return '尚未运行';
    return new Date(value).toLocaleString();
  }

  function readAutoInputs(existing) {
    // siteUrl 只在 config 里，必须显式传给 normalizeAuto，
    // 否则站点根地址与 `/` 开头的固定路径无法展开。
    return core.normalizeAuto(
      Object.assign({}, existing || {}, {
        siteUrl: core.normalizeConfig(readInputs()).siteUrl,
        enabled: checked('auto-enabled'),
        intervalMinutes: value('auto-interval'),
        onNotes: checked('auto-notes'),
        onSourceItems: checked('auto-source-items'),
        onSourceChange: checked('auto-source-change'),
        notePathTemplate: value('auto-note-template'),
        itemPathTemplate: value('auto-item-template'),
        includeHomepage: checked('auto-homepage'),
        wildcard: value('auto-wildcard'),
        maxUrls: value('auto-max-urls'),
        purgeOnStart: checked('auto-purge-on-start'),
        periodicEnabled: checked('periodic-enabled'),
        periodicMinutes: value('periodic-interval'),
        periodicScope: value('periodic-scope'),
        periodicManualUrls: value('periodic-urls'),
      })
    )
  }

  function fillAutoInputs(auto) {
    if (!auto) return;
    if ($('auto-enabled')) $('auto-enabled').checked = auto.enabled;
    if ($('auto-interval')) $('auto-interval').value = auto.intervalMinutes;
    if ($('auto-notes')) $('auto-notes').checked = auto.onNotes;
    if ($('auto-source-items')) $('auto-source-items').checked = auto.onSourceItems;
    if ($('auto-source-change')) $('auto-source-change').checked = auto.onSourceChange;
    if ($('auto-note-template')) $('auto-note-template').value = auto.notePathTemplate;
    if ($('auto-item-template')) $('auto-item-template').value = auto.itemPathTemplate;
    if ($('auto-homepage')) $('auto-homepage').checked = auto.includeHomepage;
    if ($('auto-wildcard')) $('auto-wildcard').value = (auto.wildcard || []).join('\n');
    if ($('auto-max-urls')) $('auto-max-urls').value = auto.maxUrls;
    if ($('auto-purge-on-start')) $('auto-purge-on-start').checked = auto.purgeOnStart;
    if ($('periodic-enabled')) $('periodic-enabled').checked = auto.periodicEnabled;
    if ($('periodic-interval')) $('periodic-interval').value = auto.periodicMinutes;
    if ($('periodic-scope')) $('periodic-scope').value = auto.periodicScope;
    if ($('periodic-urls')) $('periodic-urls').value = auto.periodicManualUrls;
    renderPeriodicScope();
  }

  function renderPeriodicScope() {
    var scope = value('periodic-scope');
    var box = $('periodic-urls-field');
    if (box) box.hidden = scope !== 'manual';
  }

  function renderAutomation(schedulerInfo) {
    var auto = state.auto || core.normalizeAuto(null);
    var monitored = [];
    if (auto.onNotes) monitored.push('Myriad 笔记');
    if (auto.onSourceItems) monitored.push('RSS 新条目');
    if (auto.onSourceChange) monitored.push('RSS 源变更');
    text('auto-state', auto.enabled ? '已开启' : auto.periodicEnabled ? '仅定期提交' : '已关闭');
    text('auto-monitor', monitored.length ? monitored.join(' · ') : '未选择监听内容');
    text('auto-last-check', relative(auto.lastCheckAt));
    text('auto-last-submit', relative(auto.lastSubmitAt));
    text('auto-last-reason', auto.lastReason || '—');
    var lines = [];
    if (auto.enabled) lines.push('内容变更核对：每 ' + auto.intervalMinutes + ' 分钟');
    if (auto.periodicEnabled) {
      var scopeLabel = auto.periodicScope === 'all' ? '清理全站缓存' : auto.periodicScope === 'list' ? '刷新固定 URL 列表' : '提交待处理队列';
      lines.push('定期提交：每 ' + auto.periodicMinutes + ' 分钟 · ' + scopeLabel);
    }
    text('auto-plan', lines.length ? lines.join('；') : '未注册任何定时任务');
    text('auto-queue', state.queue.length ? state.queue.length + ' 个待提交 URL' : '队列为空');
    if (schedulerInfo && schedulerInfo.reason && schedulerInfo.reason !== 'ok') {
      text('auto-scheduler', schedulerInfo.reason === 'not-admin' ? '需要管理员登录后才会注册' : schedulerInfo.reason === 'scheduler-unavailable' ? '当前宿主不支持定时任务' : schedulerInfo.reason);
      return;
    }
    text('auto-scheduler', lines.length ? '定时任务已注册' : '—');
  }

  function capabilityNotes() {
    var notes = [];
    if (!core.schedulerAvailable()) notes.push('当前宿主不支持 Tapp.scheduler');
    if (!Tapp.phantasiList) notes.push('当前宿主没有 phantasiList 接口，无法监听笔记');
    if (!Tapp.phantasiList && !Tapp.brewList) notes.push('当前宿主没有内容源接口，无法监听 RSS 源');
    return notes;
  }

  async function refreshState(options) {
    var all = await core.readAll();
    state.config = all.config;
    state.auto = all.auto;
    state.autoLogs = Array.isArray(all.autoLogs) ? all.autoLogs : [];
    state.queue = Array.isArray(all.queue.paths) ? all.queue.paths : [];
    var storedLogs = await Tapp.storage.get(core.LOG_KEY);
    if (Array.isArray(storedLogs)) state.logs = storedLogs;
    if (!options || options.fill !== false) {
      fillInputs(state.config);
      fillAutoInputs(state.auto);
    }
    renderAutomation(state.schedulerInfo);
    renderLogs();
  }

  /* ---------------------------- 提交 ---------------------------- */

  async function runManualPurge(urls, all) {
    if (!(await requireAdmin())) return;
    var config = readInputs();
    var error = core.configError(config);
    if (error) return notify(error, 'warning');
    if (!all && !urls.length) return notify('请输入至少一个有效的 HTTP(S) URL', 'warning');
    var label = all ? '全站缓存' : urls.length + ' 个 URL';
    setBusy(true);
    text('last-result', '正在提交…');
    try {
      var result = await core.purge(config, urls, all);
      if (result && result.skipped) {
        text('last-result', '已跳过重复请求');
        await notify('相同刷新请求 5 秒内不会重复提交', 'warning');
        return;
      }
      text('last-result', '提交成功');
      await addLog(true, core.providerName(config.provider) + ' · ' + label, all ? '已提交全站缓存清理' : urls.join(' · '));
      await notify('CDN 缓存刷新任务已提交', 'success');
    } catch (error) {
      var message = core.safeError(error);
      text('last-result', '提交失败');
      await addLog(false, core.providerName(config.provider) + ' · ' + label, message);
      await notify(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveAutomation() {
    if (!(await requireAdmin())) return;
    var config = readInputs();
    var error = core.configError(config);
    if (error) return notify(error, 'warning');
    var next = readAutoInputs(state.auto);
    var autoIssue = core.autoError(next, config);
    if (autoIssue) return notify(autoIssue, 'warning');
    try {
      await core.saveConfig(config);
      state.auto = await core.saveAuto(next);
      if ($('auto-status')) $('auto-status').textContent = '已保存';
      state.schedulerInfo = await core.syncScheduler();
      // 第一次打开自动提交时立刻建立基线：否则用户在面板上点「立即核对」
      // 只会得到「首次运行」，看起来像没生效。
      if (next.enabled && !next.lastCheckAt) {
        await core.evaluate({ log: false });
      }
      await refreshState({ fill: true });
      await notify('CDN 配置与自动提交设置已保存', 'success');
    } catch (error) {
      if ($('auto-status')) $('auto-status').textContent = '保存失败';
      await notify('保存自动提交设置失败：' + core.safeError(error), 'error');
    }
  }

  async function checkNow() {
    if (!(await requireAdmin())) return;
    setBusy(true);
    text('auto-check-result', '正在核对…');
    try {
      var result = await core.evaluate({ log: true });
      await refreshState({ fill: false });
      var message = result && result.count ? '发现 ' + result.count + ' 个需刷新路径并已入队' : '未发现需要刷新的内容变更';
      text('auto-check-result', message + (result && result.reason ? '（' + result.reason + '）' : ''));
      await notify(message, result && result.count ? 'success' : 'info');
      var notes = [];
      if (result && result.notesAvailable === false) notes.push('笔记接口不可用');
      if (result && result.sourcesAvailable === false) notes.push('RSS 源接口不可用');
      if (notes.length) await notify(notes.join('；'), 'warning');
    } catch (error) {
      text('auto-check-result', '核对失败');
      await notify('核对失败：' + core.safeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function flushQueue() {
    if (!(await requireAdmin())) return;
    var config = readInputs();
    var error = core.configError(config);
    if (error) return notify(error, 'warning');
    if (!state.queue.length) return notify('待提交队列为空', 'info');
    setBusy(true);
    text('auto-check-result', '正在提交队列…');
    try {
      var result = await core.flushPending(config);
      await refreshState({ fill: false });
      if (result && result.skipped) {
        text('auto-check-result', result.reason || '已有提交在执行');
        await notify(result.reason || '已有自动提交在执行，稍后会自动重试', 'info');
      } else if (result && result.ok) {
        text('auto-check-result', '已提交 ' + result.count + ' 个 URL');
        await notify('待提交队列已提交', 'success');
      } else {
        text('auto-check-result', '提交未完成');
        await notify('待提交队列提交失败：' + ((result && result.detail) || '未知原因'), 'error');
      }
    } catch (error) {
      await notify('提交队列失败：' + core.safeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function purgeAllNow() {
    if (!(await requireAdmin())) return;
    var config = readInputs();
    var error = core.configError(config);
    if (error) return notify(error, 'warning');
    if (!(await Tapp.ui.confirm('立即清理全站缓存？这会删除该 CDN 上的全部缓存内容。'))) return;
    await runManualPurge([config.siteUrl + '/'], true);
  }

  async function resetAutomation() {
    if (!(await requireAdmin())) return;
    if (!(await Tapp.ui.confirm('重置变更基线？下次核对会把当前已有笔记与条目视为「已知」，之后只提交新增内容。'))) return;
    try {
      await core.resetBaseline();
      await refreshState({ fill: false });
      text('auto-check-result', '基线已重置');
      await notify('变更基线已重置', 'success');
    } catch (error) {
      await notify('重置基线失败：' + core.safeError(error), 'error');
    }
  }

  /* ---------------------------- 主题 ---------------------------- */

  function applyTheme(theme) {
    var isDark = theme === true || theme === 'dark' || theme === 'Dark';
    try {
      document.documentElement.classList.toggle('dark', !!isDark);
      document.documentElement.classList.toggle('light', !isDark);
      if (document.body) {
        document.body.classList.toggle('dark', !!isDark);
        document.body.classList.toggle('light', !isDark);
      }
    } catch (error) {
      /* ignore */
    }
  }

  async function bindTheme() {
    try {
      if (Tapp.ui && typeof Tapp.ui.getTheme === 'function') {
        var initial = Tapp.ui.getTheme();
        applyTheme(initial && typeof initial.then === 'function' ? await initial : initial);
      } else if (window.matchMedia) {
        applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
      if (Tapp.ui && typeof Tapp.ui.onThemeChange === 'function') {
        Tapp.ui.onThemeChange(function (theme) {
          applyTheme(theme);
        });
      } else if (window.matchMedia) {
        var query = window.matchMedia('(prefers-color-scheme: dark)');
        var onChange = function (event) {
          applyTheme(event.matches ? 'dark' : 'light');
        };
        if (query.addEventListener) query.addEventListener('change', onChange);
        else if (query.addListener) query.addListener(onChange);
      }
    } catch (error) {
      console.warn('[CDN Cache] 主题桥接失败', error);
    }
  }

  /* ---------------------------- 绑定 ---------------------------- */

  function bind() {
    if ($('provider')) $('provider').addEventListener('change', renderProvider);
    if ($('periodic-scope')) $('periodic-scope').addEventListener('change', renderPeriodicScope);

    if ($('save-btn')) {
      $('save-btn').addEventListener('click', async function () {
        if (!(await requireAdmin())) return;
        var config = readInputs();
        var error = core.configError(config);
        if (error) return notify(error, 'warning');
        try {
          await core.saveConfig(config);
          state.config = config;
          if ($('save-status')) $('save-status').textContent = '已保存';
          await notify('CDN 配置已保存', 'success');
        } catch (error) {
          if ($('save-status')) $('save-status').textContent = '保存失败';
          await notify('保存配置失败：' + core.safeError(error), 'error');
        }
      });
    }

    if ($('clear-config-btn')) {
      $('clear-config-btn').addEventListener('click', async function () {
        if (!(await requireAdmin())) return;
        if (!(await Tapp.ui.confirm('确定清除当前保存的 CDN 密钥吗？自动提交会同时暂停。'))) return;
        try {
          var next = core.normalizeConfig({ provider: value('provider') });
          await core.saveConfig(next);
          state.config = next;
          var auto = core.normalizeAuto(Object.assign({}, state.auto, { enabled: false, periodicEnabled: false }));
          state.auto = await core.saveAuto(auto);
          state.schedulerInfo = await core.syncScheduler();
          fillInputs(next);
          fillAutoInputs(state.auto);
          renderAutomation(state.schedulerInfo);
          if ($('save-status')) $('save-status').textContent = '密钥已清除';
          await notify('CDN 密钥已清除，自动提交已暂停', 'success');
        } catch (error) {
          if ($('save-status')) $('save-status').textContent = '清除失败';
          await notify('清除密钥失败：' + core.safeError(error), 'error');
        }
      });
    }

    if ($('add-home-btn')) {
      $('add-home-btn').addEventListener('click', function () {
        var config = readInputs();
        if (!config.siteUrl) return notify('请先填写站点地址', 'warning');
        var urls = parseUrls();
        if (urls.indexOf(config.siteUrl + '/') < 0) urls.unshift(config.siteUrl + '/');
        if ($('urls')) $('urls').value = urls.join('\n');
      });
    }
    if ($('dedupe-btn')) {
      $('dedupe-btn').addEventListener('click', function () {
        if ($('urls')) $('urls').value = parseUrls().join('\n');
      });
    }
    if ($('clear-urls-btn')) {
      $('clear-urls-btn').addEventListener('click', function () {
        if ($('urls')) $('urls').value = '';
      });
    }
    if ($('purge-urls-btn')) {
      $('purge-urls-btn').addEventListener('click', function () {
        runManualPurge(parseUrls(), false);
      });
    }
    if ($('purge-all-btn')) {
      $('purge-all-btn').addEventListener('click', purgeAllNow);
    }
    if ($('auto-save-btn')) {
      $('auto-save-btn').addEventListener('click', saveAutomation);
    }
    if ($('auto-check-btn')) {
      $('auto-check-btn').addEventListener('click', checkNow);
    }
    if ($('auto-flush-btn')) {
      $('auto-flush-btn').addEventListener('click', flushQueue);
    }
    if ($('auto-reset-btn')) {
      $('auto-reset-btn').addEventListener('click', resetAutomation);
    }
    if ($('auto-all-btn')) {
      $('auto-all-btn').addEventListener('click', purgeAllNow);
    }
    if ($('clear-logs-btn')) {
      $('clear-logs-btn').addEventListener('click', async function () {
        if (!(await requireAdmin())) return;
        if (!(await Tapp.ui.confirm('确定清空全部刷新日志吗？'))) return;
        state.logs = [];
        state.autoLogs = [];
        await saveLogs();
        await Tapp.storage.set(core.AUTO_KEY, Object.assign({}, await Tapp.storage.get(core.AUTO_KEY), { logs: [] }));
        await refreshState({ fill: false });
        await notify('日志已清空', 'success');
      });
    }
  }

  async function mount() {
    await bindTheme();
    state.isAdmin = await currentAdmin();
    showAccess(state.isAdmin);
    if (!state.isAdmin) return;
    await refreshState({ fill: true });
    bind();
    var notes = capabilityNotes();
    if (notes.length) text('auto-capability', notes.join('；'));
    else text('auto-capability', '笔记与 RSS 源接口可用');
    // 定时任务状态要主动读一次，否则面板只会显示兜底文案
    try {
      state.schedulerInfo = await core.syncScheduler();
      renderAutomation(state.schedulerInfo);
    } catch (error) {
      console.warn('[CDN Cache] 读取定时任务状态失败', error);
    }
  }

  return { mount: mount, refresh: refreshState };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { createUi: createUi };
if (typeof window !== 'undefined') window.createCdnCacheUi = createUi;
