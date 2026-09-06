'use strict';

var domain = require('./domain.js');
var markdown = require('./markdown.js');
var presentation = require('./presentation.js');
var renderer = require('./renderer.js');
var DraftSaver = require('./draft-saver.js').DraftSaver;
var copyText = require('./clipboard.js').copyText;
var Repository = require('./repository.js').WikiRepository;

var locale = 'zh-CN';
var repository = null;
var session = null;
var currentArticleId = '';
var searchQuery = '';
var editor = null;
var draftSaver = null;
var autosaveTimer = null;
var editorReturnFocus = null;
var manageReturnFocus = null;
var editorEpoch = 0;
var ignoredDraftIds = new Set();
var unsubscribeLocale = null;
var destroyed = false;
var managementQueue = Promise.resolve();

function byId(id) { return document.getElementById(id); }
function t(key, values) {
  try {
    if (Tapp.i18n && typeof Tapp.i18n.t === 'function') return Tapp.i18n.t(key, values || {});
  } catch (_error) {}
  return key;
}

function renderMarkdownInto(targetId, source) {
  renderer.renderMarkdown(document, byId(targetId), markdown.parseMarkdown(source), {
    copyUrl: t('copyUrl'),
    copyOriginal: t('copyOriginal'),
    mediaUnavailable: t('mediaUnavailable'),
  });
}

function notify(message, kind) {
  if (!Tapp.ui || typeof Tapp.ui.showNotification !== 'function') return Promise.resolve();
  return Tapp.ui.showNotification({
    title: t('title'),
    message: message,
    type: kind || 'info',
  }).catch(function () {});
}

function runManagementOperation(task) {
  var operation = managementQueue.then(task, task);
  managementQueue = operation.catch(function () {});
  return operation;
}

function setBanner(message, kind) {
  var banner = byId('status-banner');
  if (!message) {
    banner.hidden = true;
    banner.textContent = '';
    banner.removeAttribute('data-kind');
    return;
  }
  banner.textContent = message;
  banner.dataset.kind = kind || 'info';
  banner.hidden = false;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(function (node) {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function (node) {
    node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder));
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(function (node) {
    node.setAttribute('aria-label', t(node.dataset.i18nAria));
  });
}

function setLocale(nextLocale) {
  locale = String(nextLocale || 'en-US');
  document.documentElement.lang = locale;
  applyI18n();
  renderApp();
  renderEditorPreview();
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch (_error) {
    return String(value);
  }
}

function stateView(title, hint, action, actionLabel) {
  var state = byId('reader-state');
  var orbit = document.createElement('div');
  orbit.className = 'state-orbit';
  orbit.setAttribute('aria-hidden', 'true');
  var heading = document.createElement('h2');
  heading.textContent = title;
  var text = document.createElement('p');
  text.textContent = hint;
  var nodes = [orbit, heading, text];
  if (action) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = action === 'create-article' ? 'primary-button' : 'secondary-button';
    button.dataset.action = action;
    button.textContent = actionLabel;
    nodes.push(button);
  }
  state.replaceChildren.apply(state, nodes);
  state.hidden = false;
  byId('article-view').hidden = true;
}

function snapshotState() {
  return session && session.state && session.state.snapshot
    ? session.state.snapshot
    : { catalog: { items: [] }, articles: [], issues: [] };
}

function currentItem() {
  var items = snapshotState().catalog.items || [];
  return items.find(function (item) { return item.id === currentArticleId; }) || null;
}

function currentArticle() {
  return snapshotState().articles.find(function (article) { return article.id === currentArticleId; }) || null;
}

function matchingItems() {
  var snapshot = snapshotState();
  var items = snapshot.catalog.items || [];
  if (!searchQuery.trim()) return items.slice();
  var matches = new Set(presentation.filterArticles(snapshot.articles, searchQuery).map(function (article) { return article.id; }));
  return items.filter(function (item) { return matches.has(item.id); });
}

function createNavigationLevel(nodes) {
  var level = document.createElement('div');
  level.className = 'nav-level';
  nodes.forEach(function (node) {
    var row = document.createElement('div');
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-article';
    button.dataset.articleId = node.id;
    button.textContent = node.title;
    if (node.id === currentArticleId) button.setAttribute('aria-current', 'page');
    row.appendChild(button);
    if (node.children.length) row.appendChild(createNavigationLevel(node.children));
    level.appendChild(row);
  });
  return level;
}

function renderNavigation() {
  var items = matchingItems();
  byId('article-count').textContent = String(items.length);
  var navigation = byId('article-navigation');
  var tree = presentation.buildNavigation(items);
  navigation.replaceChildren(tree.length ? createNavigationLevel(tree) : document.createTextNode(''));
}

function breadcrumbFor(item) {
  var items = snapshotState().catalog.items || [];
  var byArticle = new Map(items.map(function (entry) { return [entry.id, entry]; }));
  var labels = [];
  var cursor = item;
  var seen = new Set();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    labels.unshift(cursor.title);
    cursor = cursor.parentId ? byArticle.get(cursor.parentId) : null;
  }
  return labels.join(' / ');
}

function ensureCurrentArticle(items) {
  if (items.some(function (item) { return item.id === currentArticleId; })) return;
  var available = new Set(snapshotState().articles.map(function (article) { return article.id; }));
  var first = items.find(function (item) { return available.has(item.id); });
  currentArticleId = first ? first.id : '';
}

function renderReader() {
  var state = session ? session.state : null;
  var app = byId('wiki-app');
  app.setAttribute('aria-busy', state && state.loading ? 'true' : 'false');

  if (!state || (state.loading && !(state.snapshot.catalog.items || []).length)) {
    stateView(t('loading'), t('loadingHint'));
    return;
  }
  if (state.error) {
    stateView(t('loadErrorTitle'), t('loadErrorHint'), 'refresh', t('retry'));
    return;
  }
  var allItems = state.snapshot.catalog.items || [];
  if (!allItems.length) {
    stateView(
      t('emptyTitle'),
      state.canManage ? t('emptyAdmin') : t('emptyReader'),
      state.canManage ? 'create-article' : '',
      t('newArticle')
    );
    return;
  }
  var visibleItems = matchingItems();
  if (!visibleItems.length) {
    stateView(t('noSearchTitle'), t('noSearchHint'));
    return;
  }
  ensureCurrentArticle(visibleItems);
  var item = currentItem();
  var article = currentArticle();
  if (!item || !article) {
    stateView(t('loadErrorTitle'), t('loadErrorHint'), 'refresh', t('retry'));
    return;
  }

  byId('reader-state').hidden = true;
  byId('article-view').hidden = false;
  byId('article-breadcrumb').textContent = breadcrumbFor(item);
  byId('article-title').textContent = article.title;
  byId('article-summary').textContent = article.summary || '';
  byId('article-summary').hidden = !article.summary;
  var tags = byId('article-tags');
  tags.replaceChildren.apply(tags, (article.tags || []).map(function (tag) {
    var chip = document.createElement('span');
    chip.className = 'article-tag';
    chip.textContent = tag;
    return chip;
  }));
  renderMarkdownInto('article-content', article.markdown);
  byId('article-updated').textContent = formatDate(article.updatedAt || item.updatedAt);
  byId('article-updated').setAttribute('datetime', article.updatedAt || item.updatedAt || '');
  byId('edit-article-button').hidden = !state.canManage;
}

function renderRole() {
  var status = byId('role-status');
  var canManage = !!(session && session.state.canManage);
  var resolved = !!(session && session.state.roleResolved);
  status.textContent = resolved ? t(canManage ? 'roleAdmin' : 'roleReader') : t('roleChecking');
  status.dataset.state = resolved ? (canManage ? 'admin' : 'reader') : 'pending';
  byId('manage-button').hidden = !(resolved && canManage);
  byId('edit-article-button').hidden = !(resolved && canManage && currentArticle());
  if ((!resolved || !canManage) && !byId('manage-panel').hidden) byId('manage-panel').hidden = true;
}

function renderIssues() {
  var issues = snapshotState().issues || [];
  if (issues.length) setBanner(t('loadErrorHint') + ' (' + issues.length + ')', 'error');
  else setBanner('');
}

function renderApp() {
  if (destroyed || !byId('wiki-app')) return;
  renderRole();
  renderNavigation();
  renderReader();
  renderIssues();
}

function articleFromFields() {
  if (!editor) return null;
  return {
    id: editor.id,
    slug: byId('editor-field-slug').value,
    title: byId('editor-field-title').value,
    summary: byId('editor-field-summary').value,
    tags: byId('editor-field-tags').value.split(/[,，]/).map(function (value) { return value.trim(); }).filter(Boolean),
    parentId: byId('editor-field-parent').value || null,
    order: Number(byId('editor-field-order').value) || 0,
    markdown: byId('editor-field-markdown').value,
  };
}

function updateEditorFromFields() {
  if (!editor) return;
  editor = Object.assign(editor, articleFromFields());
}

function renderEditorPreview() {
  if (!editor || !byId('editor-preview')) return;
  renderMarkdownInto('editor-preview', editor.markdown);
}

function populateParentOptions() {
  var select = byId('editor-field-parent');
  var empty = document.createElement('option');
  empty.value = '';
  empty.textContent = t('noParent');
  var options = [empty];
  (snapshotState().catalog.items || []).forEach(function (item) {
    if (editor && item.id === editor.id) return;
    var option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.title;
    options.push(option);
  });
  select.replaceChildren.apply(select, options);
  select.value = editor && editor.parentId || '';
}

function fillEditorFields() {
  byId('editor-field-title').value = editor.title || '';
  byId('editor-field-slug').value = editor.slug || '';
  byId('editor-field-summary').value = editor.summary || '';
  byId('editor-field-tags').value = (editor.tags || []).join(', ');
  byId('editor-field-order').value = String(editor.order || 0);
  byId('editor-field-markdown').value = editor.markdown || '';
  populateParentOptions();
  byId('editor-title').textContent = t(editor.existing ? 'editorTitle' : 'editorCreateTitle');
  byId('delete-article-button').hidden = !editor.existing;
  byId('draft-status').textContent = t('draftIdle');
  renderEditorPreview();
}

function makeArticleId() {
  var token = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : String(Date.now()) + '_' + Math.random().toString(36).slice(2);
  return 'article_' + token;
}

function slugFromText(value) {
  var slug = String(value || '').toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return slug || 'article-' + Date.now().toString(36);
}

function createDraftSaver() {
  return new DraftSaver({
    save: function (snapshot) { return repository.saveDraft(snapshot); },
    onStatus: function (status) {
      if (!editor) return;
      var key = status === 'saving' ? 'draftSaving' : status === 'saved' ? 'draftSaved' : 'draftSaveFailed';
      byId('draft-status').textContent = t(key);
    },
  });
}

function setEditorBackgroundInert(active) {
  ['.wiki-header', '#status-banner', '.wiki-layout', '#manage-panel'].forEach(function (selector) {
    var node = document.querySelector(selector);
    if (!node) return;
    if (active) {
      node.setAttribute('inert', '');
      node.setAttribute('aria-hidden', 'true');
    } else {
      node.removeAttribute('inert');
      node.removeAttribute('aria-hidden');
    }
  });
}

function editorFocusableNodes() {
  return Array.from(byId('editor-panel').querySelectorAll(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(function (node) { return !node.closest('[hidden]'); });
}

function trapEditorFocus(event) {
  if (!editor || event.key !== 'Tab') return false;
  var nodes = editorFocusableNodes();
  if (!nodes.length) {
    event.preventDefault();
    return true;
  }
  var first = nodes[0];
  var last = nodes[nodes.length - 1];
  if (event.shiftKey && (document.activeElement === first || !byId('editor-panel').contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (document.activeElement === last || !byId('editor-panel').contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

function setEditorBusy(active) {
  var panel = byId('editor-panel');
  if (active) panel.setAttribute('aria-busy', 'true');
  else panel.removeAttribute('aria-busy');
  panel.querySelectorAll('button, input, textarea, select').forEach(function (node) {
    node.disabled = !!active;
  });
}

async function settleEditorDraft(ignoreFailure) {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = null;
  if (!draftSaver || !draftSaver.hasPending()) return;
  try { await persistDraft(); }
  catch (error) { if (!ignoreFailure) throw error; }
}

async function openEditor(article) {
  if (!session || !session.state.canManage) return;
  var epoch = ++editorEpoch;
  editorReturnFocus = document.activeElement;
  var existing = !!article && article.existing !== false;
  var id = existing ? article.id : makeArticleId();
  var candidate = Object.assign({
    id: id,
    slug: existing ? article.slug : 'article-' + id.slice(-8).replace(/[^a-z0-9]/gi, '').toLowerCase(),
    title: '', summary: '', tags: [], parentId: null, order: 0, markdown: '', existing: existing,
  }, article || {}, { existing: existing });

  try {
    var saved = existing
      ? (ignoredDraftIds.has(id) ? null : await repository.getDraft(id))
      : (!article ? await repository.getLatestNewDraft(Array.from(ignoredDraftIds)) : null);
    if (epoch !== editorEpoch) return;
    if (saved && saved.article) {
      var useDraft = await Tapp.ui.confirm(t('draftRecoveryConfirm'));
      if (epoch !== editorEpoch) return;
      if (useDraft) {
        candidate = Object.assign(candidate, saved.article, { existing: saved.article.existing !== false && existing });
        notify(t('recoveredDraft'), 'info');
      } else ignoredDraftIds.add(String(saved.article.id));
    }
  } catch (_error) {}
  if (epoch !== editorEpoch) return;
  editor = candidate;
  draftSaver = createDraftSaver();
  setEditorBusy(false);
  byId('manage-panel').hidden = true;
  byId('editor-panel').hidden = false;
  setEditorBackgroundInert(true);
  fillEditorFields();
  byId('editor-field-title').focus();
}

async function persistDraft(options) {
  options = options || {};
  if (!editor || !draftSaver || (destroyed && !options.allowDestroyed)) return;
  updateEditorFromFields();
  return draftSaver.flush(Object.assign({}, editor));
}

function scheduleDraftSave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(function () {
    autosaveTimer = null;
    persistDraft().catch(function () {});
  }, 1000);
}

function closeEditor() {
  editorEpoch += 1;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = null;
  setEditorBusy(false);
  byId('editor-panel').hidden = true;
  setEditorBackgroundInert(false);
  editor = null;
  draftSaver = null;
  var returnFocus = editorReturnFocus;
  editorReturnFocus = null;
  if (returnFocus && returnFocus.isConnected && !returnFocus.closest('[hidden]')) returnFocus.focus();
  else byId('manage-button').focus();
}

async function cancelEditor() {
  if (!editor) return;
  setEditorBusy(true);
  try {
    await settleEditorDraft(false);
    closeEditor();
  } finally {
    setEditorBusy(false);
  }
}

async function publishEditor() {
  if (!editor || !session.state.canManage) return;
  updateEditorFromFields();
  if (editor.existing && !(await Tapp.ui.confirm(t('overwriteConfirm')))) return;
  var button = byId('publish-button');
  setEditorBusy(true);
  button.textContent = t('publishing');
  try {
    await settleEditorDraft(true);
    var published = await repository.publish(Object.assign({}, editor));
    currentArticleId = published.article.id;
    closeEditor();
    await session.refresh();
    notify(t('published'), 'success');
  } catch (error) {
    setBanner(t('operationFailed') + ': ' + String(error && error.message || error), 'error');
    notify(t('operationFailed'), 'error');
  } finally {
    setEditorBusy(false);
    button.textContent = t('publish');
  }
}

async function deleteEditorArticle() {
  if (!editor || !editor.existing || !session.state.canManage) return;
  if (!(await Tapp.ui.confirm(t('deleteConfirm')))) return;
  setEditorBusy(true);
  try {
    await settleEditorDraft(true);
    await repository.deleteArticle(editor.id);
    currentArticleId = '';
    closeEditor();
    await session.refresh();
    notify(t('deleted'), 'success');
  } catch (error) {
    setBanner(t('operationFailed') + ': ' + String(error && error.message || error), 'error');
  } finally {
    setEditorBusy(false);
  }
}

async function refreshQuota() {
  try {
    var usage = await Tapp.shared.usage();
    var report = domain.assessQuota({ used: usage.used, quota: usage.quota, writeBytes: 0 });
    var percent = Math.min(100, Math.round(report.ratio * 100));
    byId('quota-detail').textContent = (report.used / 1024 / 1024).toFixed(2) + ' / ' + (report.quota / 1024 / 1024).toFixed(0) + ' MiB';
    byId('quota-bar').style.width = percent + '%';
    byId('quota-bar').style.background = report.level === 'critical' ? 'var(--wiki-danger)' : report.level === 'warning' ? '#c78a34' : 'var(--wiki-primary)';
    byId('quota-message').textContent = t(report.level === 'critical' ? 'quotaCritical' : report.level === 'warning' ? 'quotaWarning' : report.level === 'watch' ? 'quotaWatch' : 'quotaHint');
  } catch (error) {
    byId('quota-detail').textContent = '—';
    byId('quota-message').textContent = t('operationFailed') + ': ' + String(error && error.message || error);
  }
}

function openManage() {
  if (!session || !session.state.canManage) return;
  manageReturnFocus = document.activeElement;
  byId('manage-panel').hidden = false;
  byId('manage-close-button').focus();
  refreshQuota();
}

function closeManage() {
  byId('manage-panel').hidden = true;
  var returnFocus = manageReturnFocus;
  manageReturnFocus = null;
  if (returnFocus && returnFocus.isConnected && !returnFocus.closest('[hidden]')) returnFocus.focus();
  else byId('manage-button').focus();
}

async function exportJson() {
  var snapshot = snapshotState();
  if (Array.isArray(snapshot.issues) && snapshot.issues.length) throw new Error(t('backupIncomplete'));
  var backup = domain.buildBackup({
    exportedAt: new Date().toISOString(),
    catalog: snapshot.catalog,
    articles: snapshot.articles,
    issues: snapshot.issues,
  });
  var content = JSON.stringify(backup, null, 2) + '\n';
  if (domain.utf8Bytes(content) > 10 * 1024 * 1024) throw new Error(t('fileTooLarge'));
  var date = new Date().toISOString().slice(0, 10);
  await Tapp.file.download(content, domain.safeDownloadFilename('wiki-backup-' + date, 'json'), 'application/json;charset=utf-8');
}

async function exportMarkdown() {
  var article = currentArticle();
  if (!article) return;
  var filename = domain.safeDownloadFilename(article.slug || article.title, 'md');
  await Tapp.file.download(article.markdown, filename, 'text/markdown;charset=utf-8');
}

function markInvalidFile(error) {
  var result = error && typeof error === 'object'
    ? error
    : new Error(String(error || t('invalidFile')));
  result.wikiInvalidFile = true;
  return result;
}

function importErrorMessage(error) {
  var key = error && error.wikiInvalidFile ? 'invalidFile' : 'operationFailed';
  return t(key) + ': ' + String(error && error.message || error);
}

async function importMarkdownFile(file) {
  if (!file) return;
  var content;
  try {
    if (file.size > domain.MAX_ARTICLE_BYTES) throw new Error(t('fileTooLarge'));
    content = await file.text();
  } catch (error) {
    throw markInvalidFile(error);
  }
  var title = String(file.name || '').replace(/\.(?:md|markdown|txt)$/i, '').trim() || t('newArticle');
  await openEditor({
    id: makeArticleId(),
    slug: slugFromText(title),
    title: title,
    summary: '',
    tags: [],
    parentId: null,
    order: 0,
    markdown: content,
    existing: false,
  });
}

async function importJsonFile(file) {
  if (!file) return;
  var backup;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error(t('fileTooLarge'));
    backup = domain.parseBackup(await file.text());
  } catch (error) {
    throw markInvalidFile(error);
  }
  if (!(await Tapp.ui.confirm(t('restoreConfirm')))) return;
  var result = await repository.restoreBackup(backup);
  currentArticleId = result.catalog.items.length ? result.catalog.items[0].id : '';
  closeManage();
  await session.refresh();
  notify(t('restored'), 'success');
}

async function cleanupOrphans() {
  if (!(await Tapp.ui.confirm(t('cleanupConfirm')))) return;
  var result = await repository.cleanupOrphans();
  await refreshQuota();
  notify(t('cleanupDone') + ': ' + result.removed.length, 'success');
}

async function copyUrl(url) {
  if (!url) return;
  var copied = await copyText(url, { navigator: navigator, document: document });
  notify(t(copied ? 'copied' : 'copyUnavailable'), copied ? 'success' : 'warning');
}

async function handleAction(action) {
  try {
    if (action === 'refresh') {
      await session.refresh();
      notify(t('manualRefresh'), 'success');
    } else if (action === 'open-manage') openManage();
    else if (action === 'close-manage') closeManage();
    else if (action === 'create-article') await openEditor(null);
    else if (action === 'edit-current') await openEditor(currentArticle());
    else if (action === 'cancel-editor') await cancelEditor();
    else if (action === 'publish') await runManagementOperation(publishEditor);
    else if (action === 'delete-current') await runManagementOperation(deleteEditorArticle);
    else if (action === 'export-json') await exportJson();
    else if (action === 'export-markdown') await exportMarkdown();
    else if (action === 'import-markdown') byId('markdown-file').click();
    else if (action === 'import-json') byId('json-file').click();
    else if (action === 'cleanup-orphans') await runManagementOperation(cleanupOrphans);
  } catch (error) {
    setBanner(t('operationFailed') + ': ' + String(error && error.message || error), 'error');
    notify(t('operationFailed'), 'error');
  }
}

function bindEvents() {
  byId('wiki-app').addEventListener('click', function (event) {
    var copy = event.target.closest('[data-copy-url]');
    if (copy) { copyUrl(copy.dataset.copyUrl); return; }
    var article = event.target.closest('[data-article-id]');
    if (article) {
      currentArticleId = article.dataset.articleId;
      renderApp();
      byId('reader-pane').scrollTop = 0;
      return;
    }
    var action = event.target.closest('[data-action]');
    if (action) handleAction(action.dataset.action);
  });

  byId('search-input').addEventListener('input', function (event) {
    searchQuery = event.target.value;
    renderApp();
  });

  byId('editor-panel').addEventListener('input', function (event) {
    if (!event.target.matches('[data-editor-field]')) return;
    if (event.target.id === 'editor-field-title' && !byId('editor-field-slug').value.trim()) {
      byId('editor-field-slug').value = slugFromText(event.target.value);
    }
    updateEditorFromFields();
    renderEditorPreview();
    ignoredDraftIds.delete(String(editor.id));
    if (draftSaver) draftSaver.markDirty();
    scheduleDraftSave();
  });
  byId('editor-panel').addEventListener('change', function (event) {
    if (!event.target.matches('[data-editor-field]')) return;
    updateEditorFromFields();
    renderEditorPreview();
    ignoredDraftIds.delete(String(editor.id));
    if (draftSaver) draftSaver.markDirty();
    scheduleDraftSave();
  });

  byId('markdown-file').addEventListener('change', async function (event) {
    try { await importMarkdownFile(event.target.files && event.target.files[0]); }
    catch (error) { setBanner(importErrorMessage(error), 'error'); }
    event.target.value = '';
  });
  byId('json-file').addEventListener('change', async function (event) {
    var file = event.target.files && event.target.files[0];
    try { await runManagementOperation(function () { return importJsonFile(file); }); }
    catch (error) { setBanner(importErrorMessage(error), 'error'); }
    event.target.value = '';
  });

  document.addEventListener('keydown', function (event) {
    var target = event.target;
    var isEditing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    if (trapEditorFocus(event)) return;
    if (event.key === 'Escape' && editor) { event.preventDefault(); handleAction('cancel-editor'); return; }
    if (event.key === 'Escape' && !byId('manage-panel').hidden) { event.preventDefault(); closeManage(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && editor) {
      event.preventDefault();
      publishEditor();
      return;
    }
    if (event.key === '/' && !isEditing && byId('editor-panel').hidden) {
      event.preventDefault();
      byId('search-input').focus();
    }
  });
}

async function start() {
  repository = new Repository({ shared: Tapp.shared, privateStorage: Tapp.storage });
  bindEvents();
  try {
    var initialLocale = Tapp.i18n && typeof Tapp.i18n.getLocale === 'function'
      ? Tapp.i18n.getLocale()
      : await Tapp.ui.getLocale();
    setLocale(initialLocale || 'en-US');
  } catch (_error) {
    setLocale('en-US');
  }
  try {
    unsubscribeLocale = Tapp.ui.onLocaleChange(function (nextLocale) { setLocale(nextLocale); });
  } catch (_error) {}
  session = new presentation.WikiSession({
    repository: repository,
    resolveAdmin: function () { return Tapp.user.isAdmin(); },
    onChange: renderApp,
  });
  try { await session.start(); } catch (_error) { renderApp(); }
}

Tapp.lifecycle.onReady(start);

Tapp.lifecycle.onPause(function () {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
    persistDraft().catch(function () {});
  }
});

Tapp.lifecycle.onResume(function () {
  if (session) session.resume().catch(function () {});
});

Tapp.lifecycle.onDestroy(function () {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = null;
  if (draftSaver && draftSaver.hasPending()) persistDraft({ allowDestroyed: true }).catch(function () {});
  destroyed = true;
  if (typeof unsubscribeLocale === 'function') unsubscribeLocale();
  if (session) session.destroy();
});
