'use strict';

function compareItems(left, right) {
  var order = (Number(left.order) || 0) - (Number(right.order) || 0);
  if (order) return order;
  return String(left.title || '').localeCompare(String(right.title || '')) || String(left.id).localeCompare(String(right.id));
}

function buildNavigation(items) {
  items = Array.isArray(items) ? items : [];
  var byId = new Map();
  items.forEach(function (item) {
    if (item && item.id) byId.set(item.id, Object.assign({}, item, { children: [] }));
  });
  function canAttach(node) {
    if (!node.parentId || !byId.has(node.parentId) || node.parentId === node.id) return false;
    var cursor = node.parentId;
    var seen = new Set([node.id]);
    while (cursor && byId.has(cursor)) {
      if (seen.has(cursor)) return false;
      seen.add(cursor);
      cursor = byId.get(cursor).parentId;
    }
    return true;
  }
  var roots = [];
  byId.forEach(function (node) {
    if (canAttach(node)) byId.get(node.parentId).children.push(node);
    else roots.push(node);
  });
  function sort(nodes) {
    nodes.sort(compareItems);
    nodes.forEach(function (node) { sort(node.children); });
  }
  sort(roots);
  return roots;
}

function filterArticles(articles, query) {
  articles = Array.isArray(articles) ? articles : [];
  var needle = String(query || '').trim().toLocaleLowerCase();
  if (!needle) return articles.slice();
  return articles.filter(function (article) {
    var haystack = [article.title, article.summary, article.markdown]
      .concat(Array.isArray(article.tags) ? article.tags : [])
      .join('\n')
      .toLocaleLowerCase();
    return haystack.indexOf(needle) !== -1;
  });
}

function mediaPresentation(media, state) {
  var failed = state === 'error' || state === 'blocked';
  return {
    kind: media.kind,
    alt: media.alt || '',
    url: media.url,
    showMedia: !failed,
    showPlaceholder: failed,
    canCopyOriginal: /^https:\/\//.test(media.url || ''),
  };
}

function selectLanguage(resources, locale) {
  resources = resources || {};
  var normalized = String(locale || '').toLowerCase();
  var key = normalized.indexOf('zh') === 0 ? 'zh' : normalized.indexOf('ja') === 0 ? 'ja' : 'en';
  return resources[key] || resources.en || resources.zh || {};
}

class WikiSession {
  constructor(options) {
    options = options || {};
    this.repository = options.repository;
    this.resolveAdmin = options.resolveAdmin || async function () { return false; };
    this.onChange = options.onChange || function () {};
    this.active = true;
    this.refreshEpoch = 0;
    this.state = {
      roleResolved: false,
      canManage: false,
      loading: false,
      snapshot: { catalog: { schema: 1, items: [] }, articles: [], issues: [] },
      error: null,
    };
  }

  emit() { this.onChange(this.state); }

  async start() {
    try {
      var canManage = !!(await this.resolveAdmin());
      if (!this.active) return this.state.snapshot;
      this.state.canManage = canManage;
    }
    catch (_error) { if (this.active) this.state.canManage = false; }
    if (!this.active) return this.state.snapshot;
    this.state.roleResolved = true;
    this.emit();
    return this.refresh();
  }

  async resume() { return this.refresh(); }

  async refresh() {
    if (!this.active) return this.state.snapshot;
    var epoch = ++this.refreshEpoch;
    this.state.loading = true;
    this.state.error = null;
    this.emit();
    try {
      var snapshot = await this.repository.loadSnapshot();
      if (this.active && epoch === this.refreshEpoch) this.state.snapshot = snapshot;
      return snapshot;
    } catch (error) {
      if (this.active && epoch === this.refreshEpoch) this.state.error = error;
      throw error;
    } finally {
      if (this.active && epoch === this.refreshEpoch) {
        this.state.loading = false;
        this.emit();
      }
    }
  }

  destroy() { this.active = false; this.refreshEpoch += 1; }
}

module.exports = { WikiSession, buildNavigation, filterArticles, mediaPresentation, selectLanguage };
