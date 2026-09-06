(function () {
  'use strict';

  var CACHE_KEY = 'latestBrief';
  var state = { items: [], totalSources: 0, updatedAt: 0, filter: 'unread', role: 'guest', settings: { maxItems: 12, defaultFilter: 'unread' }, loading: false };

  function hasPermission(permission) {
    try {
      if (typeof Tapp === 'undefined') return false;
      if (Array.isArray(Tapp.permissions)) return Tapp.permissions.indexOf(permission) >= 0;
      var info = Tapp.lifecycle && Tapp.lifecycle.getInfo ? Tapp.lifecycle.getInfo() : null;
      return Boolean(info && Array.isArray(info.permissions) && info.permissions.indexOf(permission) >= 0);
    } catch (error) {
      return false;
    }
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    return value.items || value.articles || value.data || value.results || [];
  }

  function text(value, fallback) {
    var result = value == null ? '' : String(value).trim();
    return result || fallback || '';
  }

  function normalizeItem(raw, index) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var source = raw.source && typeof raw.source === 'object' ? raw.source : {};
    return {
      id: text(raw.id || raw.item_id || raw.article_id, 'item-' + index),
      title: text(raw.title || raw.name, '未命名内容'),
      excerpt: text(raw.summary || raw.excerpt || raw.description || raw.content_text || raw.content, ''),
      source: text(raw.source_name || raw.feed_name || source.name || source.title, 'Brew'),
      url: text(raw.url || raw.link || raw.external_url, ''),
      publishedAt: raw.published_at || raw.publishedAt || raw.created_at || raw.createdAt || null,
      unread: raw.unread === true || raw.is_read === false || raw.read === false,
      starred: raw.starred === true || raw.is_starred === true || raw.favorite === true
    };
  }

  function trimExcerpt(value, max) {
    var plain = text(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return plain.length > max ? plain.slice(0, max - 1) + '…' : plain;
  }

  function formatDate(value) {
    if (!value) return '最近';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '最近';
    var now = new Date();
    var diff = now.getTime() - date.getTime();
    if (diff >= 0 && diff < 3600000) return Math.max(1, Math.floor(diff / 60000)) + ' 分钟前';
    if (diff >= 0 && diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  function setNodeText(node, value) {
    if (node) node.textContent = value;
  }

  async function loadSettings() {
    try {
      var settings = await Tapp.settings.getAll();
      if (settings && typeof settings === 'object') {
        state.settings.maxItems = Math.max(4, Math.min(30, Number(settings.maxItems) || 12));
        if (/^(unread|starred|all)$/.test(settings.defaultFilter)) state.settings.defaultFilter = settings.defaultFilter;
      }
    } catch (error) {}
    state.filter = state.settings.defaultFilter;
  }

  async function loadRole() {
    try {
      state.role = await Tapp.user.getRole();
    } catch (error) {
      state.role = 'guest';
    }
  }

  function renderAccess() {
    var badge = document.getElementById('roleBadge');
    var title = document.getElementById('accessTitle');
    var note = document.getElementById('accessNote');
    var aiGranted = hasPermission('ai:generate');
    if (state.role === 'admin') {
      setNodeText(badge, '管理员');
      setNodeText(title, '管理员模式');
      setNodeText(note, '可以修改安装设置、生成 AI 摘要、更新缓存并管理主页小组件。');
      if (badge) badge.className = 'role-badge admin';
    } else if (state.role === 'user') {
      setNodeText(badge, aiGranted ? '用户 · AI 已授权' : '登录用户');
      setNodeText(title, '个人访问');
      setNodeText(note, aiGranted ? '可以浏览简报并使用站长已下放的 AI 能力；安装设置仍仅管理员可改。' : '可以浏览简报；AI、安装设置和小组件管理需要管理员授权。');
      if (badge) badge.className = 'role-badge user';
    } else {
      setNodeText(badge, '访客可读');
      setNodeText(title, '访客访问');
      setNodeText(note, '可以浏览公开 Brew 简报和切换栏目；不能修改安装设置、生成 AI 摘要或管理小组件。');
      if (badge) badge.className = 'role-badge guest';
    }
  }

  function queryFor(filter) {
    var query = { limit: state.settings.maxItems };
    if (filter === 'unread') query.unread = true;
    if (filter === 'starred') query.starred = true;
    return query;
  }

  async function fetchItems(filter) {
    if (!Tapp.brewList || typeof Tapp.brewList.list !== 'function') throw new Error('当前环境不支持 Brew 列表');
    var response = await Tapp.brewList.list(queryFor(filter));
    return asArray(response).map(normalizeItem).slice(0, state.settings.maxItems);
  }

  async function fetchSourceCount() {
    if (!Tapp.brewList || typeof Tapp.brewList.sources !== 'function') return 0;
    try {
      var response = await Tapp.brewList.sources();
      if (Array.isArray(response)) return response.length;
      if (!response || typeof response !== 'object') return 0;
      var sources = response.items || response.sources || response.data || response.results;
      return Array.isArray(sources) ? sources.length : Number(response.total || response.count) || 0;
    } catch (error) {
      return 0;
    }
  }

  function filteredItems() {
    if (state.filter === 'unread') return state.items.filter(function (item) { return item.unread; });
    if (state.filter === 'starred') return state.items.filter(function (item) { return item.starred; });
    return state.items;
  }

  async function saveSnapshot(items) {
    var snapshot = { items: items, filter: 'all', totalSources: state.totalSources, updatedAt: Date.now(), summary: '' };
    try {
      var old = await Tapp.shared.get(CACHE_KEY);
      if (old && old.filter === state.filter && old.summary) snapshot.summary = old.summary;
    } catch (error) {}
    try {
      if (state.role === 'admin' && hasPermission('storage:write')) {
        await Tapp.shared.set(CACHE_KEY, snapshot);
      }
    } catch (error) {}
  }

  async function loadPublicSnapshot() {
    var snapshot = await Tapp.shared.get(CACHE_KEY);
    if (!snapshot || !Array.isArray(snapshot.items)) throw new Error('管理员尚未发布公开简报，请稍后再试。');
    state.items = snapshot.items.map(normalizeItem).slice(0, state.settings.maxItems);
    state.totalSources = Number(snapshot.totalSources) || 0;
    state.updatedAt = Number(snapshot.updatedAt) || 0;
  }

  async function loadBrief() {
    if (state.loading) return;
    state.loading = true;
    renderLoading();
    try {
      if (state.role === 'admin') {
        var result = await Promise.all([fetchItems('all'), fetchSourceCount()]);
        state.items = result[0];
        state.totalSources = result[1];
        state.updatedAt = Date.now();
        await saveSnapshot(state.items);
      } else {
        await loadPublicSnapshot();
      }
      renderPage();
    } catch (error) {
      renderError(error && error.message ? error.message : '读取 Brew 失败');
    } finally {
      state.loading = false;
    }
  }

  function renderLoading() {
    setNodeText(document.getElementById('statusText'), '正在整理…');
    var list = document.getElementById('feedList');
    if (list) list.innerHTML = '<div class="loading-card"><span></span><span></span><span></span></div>';
  }

  function make(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = content;
    return node;
  }

  function renderPage() {
    var items = filteredItems();
    var unread = state.items.filter(function (item) { return item.unread; }).length;
    var sources = {};
    state.items.forEach(function (item) { sources[item.source] = true; });
    setNodeText(document.getElementById('itemCount'), String(items.length));
    setNodeText(document.getElementById('unreadCount'), String(unread));
    setNodeText(document.getElementById('sourceCount'), String(state.totalSources || Object.keys(sources).length));
    setNodeText(document.getElementById('updatedTime'), new Date(state.updatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setNodeText(document.getElementById('statusText'), items.length ? '已整理 ' + items.length + ' 条' : '当前栏目暂无内容');
    var summaryButton = document.getElementById('summarizeButton');
    if (summaryButton) {
      var canUseAi = hasPermission('ai:generate') && state.role !== 'guest' && Tapp.ai && Tapp.ai.tasks;
      summaryButton.disabled = !items.length;
      summaryButton.textContent = state.role === 'guest' ? '登录后生成摘要' : (canUseAi ? '生成摘要' : '生成本地摘要');
      summaryButton.title = state.role === 'guest' ? 'AI 摘要需要登录后使用' : (canUseAi ? '' : '当前使用无需 AI 权限的本地提炼');
    }
    document.querySelectorAll('[data-filter]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-filter') === state.filter);
    });

    var list = document.getElementById('feedList');
    if (!list) return;
    list.textContent = '';
    if (!items.length) {
      var empty = make('div', 'empty-state');
      empty.appendChild(make('strong', '', state.filter === 'unread' ? '已经读完了' : '这里暂时是空的'));
      empty.appendChild(make('p', '', '去 Brew 添加订阅或收藏文章，回来后刷新简报。'));
      list.appendChild(empty);
      return;
    }
    items.forEach(function (item, index) {
      var card = make('article', 'feed-card');
      card.style.setProperty('--delay', Math.min(index, 8) * 35 + 'ms');
      var meta = make('div', 'feed-meta');
      meta.appendChild(make('span', 'source-pill', item.source));
      meta.appendChild(make('time', '', formatDate(item.publishedAt)));
      card.appendChild(meta);
      card.appendChild(make('h3', '', item.title));
      if (item.excerpt) card.appendChild(make('p', '', trimExcerpt(item.excerpt, 180)));
      list.appendChild(card);
    });
  }

  function renderError(message) {
    setNodeText(document.getElementById('statusText'), '加载失败');
    var list = document.getElementById('feedList');
    if (list) {
      list.textContent = '';
      var error = make('div', 'empty-state error-state');
      error.appendChild(make('strong', '', '暂时无法生成简报'));
      error.appendChild(make('p', '', message));
      list.appendChild(error);
    }
  }

  function extractAiText(value) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    var queue = [value];
    var seen = [];
    while (queue.length) {
      var current = queue.shift();
      if (typeof current === 'string' && current.trim()) return current.trim();
      if (!current || typeof current !== 'object' || seen.indexOf(current) >= 0) continue;
      seen.push(current);
      var keys = ['text', 'output_text', 'content', 'result', 'output', 'data', 'message', 'value'];
      for (var index = 0; index < keys.length; index++) {
        if (current[keys[index]] != null) queue.push(current[keys[index]]);
      }
      if (Array.isArray(current)) current.forEach(function (entry) { queue.push(entry); });
    }
    return '';
  }

  function localSummary(items) {
    var selected = items.slice(0, 3);
    var lines = selected.map(function (item, index) {
      var detail = trimExcerpt(item.excerpt, 54);
      return (index + 1) + '. ' + item.title + (detail ? '：' + detail : '');
    });
    if (selected[0]) lines.push('建议先读：《' + selected[0].title + '》，它位于当前简报首位。');
    return lines.join('\n');
  }

  async function waitForAiTask(initial) {
    var result = initial;
    var taskId = text(initial && (initial.taskId || initial.task_id || initial.id), '');
    if (!taskId && initial && initial.data) taskId = text(initial.data.taskId || initial.data.task_id || initial.data.id, '');
    for (var attempt = 0; attempt < 80; attempt++) {
      var candidate = extractAiText(result && (result.result || result.output || result));
      if (candidate) return candidate;
      var status = text(result && result.status, '').toLowerCase();
      if (/^(failed|cancelled|expired)$/.test(status)) throw new Error('AI 摘要任务未完成');
      if (!taskId || !Tapp.ai.tasks.get) break;
      await new Promise(function (resolve) { setTimeout(resolve, 1500); });
      result = await Tapp.ai.tasks.get(taskId);
    }
    throw new Error('AI 暂未返回摘要');
  }

  async function summarize() {
    var button = document.getElementById('summarizeButton');
    var output = document.getElementById('summaryText');
    var items = filteredItems();
    if (!items.length || !button || !output) return;
    if (state.role === 'guest') {
      output.textContent = '请先登录 Myriad，再使用 AI 生成本期摘要。访客可以继续浏览公开简报。';
      button.textContent = '登录后生成摘要';
      return;
    }
    var canUseAi = state.role !== 'guest' && hasPermission('ai:generate') && Tapp.ai && Tapp.ai.tasks && typeof Tapp.ai.tasks.create === 'function';
    if (!canUseAi) {
      output.textContent = localSummary(items);
      return;
    }
    button.disabled = true;
    button.textContent = '正在提炼…';
    output.textContent = 'Myriad AI 正在阅读当前标题与摘要。';
    try {
      var data = items.slice(0, 12).map(function (item, index) {
        return (index + 1) + '. [' + item.source + '] ' + item.title + (item.excerpt ? '\n' + trimExcerpt(item.excerpt, 260) : '');
      }).join('\n\n');
      var task = await Tapp.ai.tasks.create({
        version: 2,
        operation: 'generate',
        input: { prompt: '你是阅读简报编辑。请只根据下面提供的文章标题和摘要，用中文生成三条今日阅读重点，每条不超过45字；最后给出一条建议先读哪篇及原因。不要虚构原文信息。\n\n' + data },
        output: { format: 'text' },
        delivery: 'result',
        idempotencyKey: 'daily-brief-' + new Date().toISOString().slice(0, 10) + '-' + state.filter
      });
      var summary = await waitForAiTask(task);
      output.textContent = summary;
      try {
        if (state.role === 'admin' && hasPermission('storage:write')) {
          var snapshot = await Tapp.shared.get(CACHE_KEY) || {};
          snapshot.summary = summary;
          await Tapp.shared.set(CACHE_KEY, snapshot);
        }
      } catch (error) {}
    } catch (error) {
      output.textContent = localSummary(items) + '\n\n（AI 服务暂不可用，已自动使用本地提炼）';
    } finally {
      button.disabled = false;
      button.textContent = canUseAi ? '重新生成' : '生成本地摘要';
    }
  }

  async function initPage() {
    await loadRole();
    await loadSettings();
    renderAccess();
    setNodeText(document.getElementById('todayLabel'), new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }));
    document.querySelectorAll('[data-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.filter = button.getAttribute('data-filter');
        loadBrief();
      });
    });
    document.getElementById('refreshButton').addEventListener('click', loadBrief);
    document.getElementById('summarizeButton').addEventListener('click', summarize);
    await loadBrief();
  }

  async function renderWidget(root, config) {
    var maxLines = Math.max(1, Math.min(6, Number(config.maxLines) || 3));
    root.classList.toggle('is-compact', config.density === 'compact');
    var snapshot = null;
    try { snapshot = await Tapp.shared.get(CACHE_KEY); } catch (error) {}
    var items = snapshot && Array.isArray(snapshot.items) ? snapshot.items : [];
    setNodeText(root.querySelector('[data-widget-date]'), new Date().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
    setNodeText(root.querySelector('[data-widget-count]'), root.classList.contains('size-2x2') ? String(items.length) : items.length + ' 条');
    var summaryNode = root.querySelector('[data-widget-summary]');
    if (summaryNode && config.showSummary === false) summaryNode.hidden = true;
    else if (snapshot && snapshot.summary) setNodeText(summaryNode, trimExcerpt(snapshot.summary, 120));
    if (snapshot && snapshot.updatedAt) setNodeText(root.querySelector('[data-widget-updated]'), formatDate(snapshot.updatedAt) + '更新');
    var list = root.querySelector('[data-widget-list]');
    if (list && items.length) {
      list.textContent = '';
      var sizeLimit = root.classList.contains('size-4x4') ? 6 : 3;
      var limit = Math.min(sizeLimit, maxLines);
      items.slice(0, limit).forEach(function (item) {
        var row = make('p', 'widget-line');
        row.appendChild(make('span', '', item.source));
        row.appendChild(make('b', '', item.title));
        list.appendChild(row);
      });
    }
    var headline = root.querySelector('[data-widget-headline]');
    if (headline && items[0]) headline.textContent = items[0].title;
  }

  async function initWidget() {
    var root = document.querySelector('[data-brief-widget]');
    if (!root) return;
    root.setAttribute('role', 'link');
    root.setAttribute('tabindex', '0');
    root.setAttribute('aria-label', '打开今日简报');
    function openBriefPage() {
      var path = '/tapp/run/' + encodeURIComponent('cn.wyyzxzyg.daily-brief');
      try {
        if (window.top && window.top !== window) window.top.location.assign(path);
        else window.location.assign(path);
      } catch (error) {
        window.open(path, '_top');
      }
    }
    root.addEventListener('click', openBriefPage);
    root.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openBriefPage();
    });
    var props = window._TAPP_WIDGET_PROPS || {};
    var config = props.config || props.settings || {};
    if (!config || typeof config !== 'object') config = {};
    await renderWidget(root, config);
    if (Tapp.shared && typeof Tapp.shared.onChanged === 'function') {
      var unsubscribe = Tapp.shared.onChanged(function (event) {
        if (!event || !event.key || event.key === CACHE_KEY) renderWidget(root, config).catch(function () {});
      });
      if (Tapp.lifecycle && typeof Tapp.lifecycle.onDestroy === 'function') {
        Tapp.lifecycle.onDestroy(function () { if (typeof unsubscribe === 'function') unsubscribe(); });
      }
    }
  }

  async function start() {
    try {
      if (Tapp.ui && Tapp.ui.getTheme) {
        var theme = await Tapp.ui.getTheme();
        document.documentElement.classList.toggle('dark', theme === 'dark' || (theme && theme.mode === 'dark'));
      }
    } catch (error) {}
    if (document.getElementById('feedList')) await initPage();
    else await initWidget();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
