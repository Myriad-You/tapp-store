'use strict';

var controllerModule = require('./app-controller.js');
var domain = require('./domain.js');
var modalAccessibility = require('./modal-accessibility.js');

function createDomApp(options) {
  var tapp = options.Tapp;
  var doc = options.document;
  var root = doc.querySelector('[data-page-root]');
  var aborter = new AbortController();
  var unsubs = [];
  var localError = null;
  var lastState = null;
  var previewReturnFocus = null;
  var downloadStatusKey = '';
  var lastResultUrl = '';

  function t(key, params) {
    try { return tapp.i18n.t(key, params); } catch (_) { return key; }
  }

  function query(selector) { return doc.querySelector(selector); }

  function setText(selector, value) {
    var node = query(selector);
    if (node) node.textContent = value;
  }

  function applyTranslations() {
    doc.querySelectorAll('[data-i18n]').forEach(function (node) { node.textContent = t(node.dataset.i18n); });
    doc.querySelectorAll('[data-i18n-placeholder]').forEach(function (node) { node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder)); });
    doc.querySelectorAll('[data-i18n-aria-label]').forEach(function (node) { node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel)); });
    doc.querySelectorAll('[data-i18n-alt]').forEach(function (node) { node.setAttribute('alt', t(node.dataset.i18nAlt)); });
    if (!lastState) {
      setText('[data-persona-status]', t('persona.loading'));
      setText('[data-persona-detail]', t('persona.loadingDetail'));
    }
  }

  function element(tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function personaReady(persona) {
    return Boolean(persona && persona.enabled && persona.portraitUrl && persona.reason === 'ready');
  }

  function personaDetail(persona) {
    if (persona.reason === 'unavailable') return t('persona.unavailableDetail');
    if (persona.reason === 'disabled') return t('persona.disabledDetail');
    if (persona.reason === 'no-portrait') return t('persona.noPortraitDetail');
    return t('persona.context', { mood: t('mood.' + persona.moodBand), activity: t('activity.' + persona.activity) });
  }

  function renderPersona(state) {
    var status = query('[data-persona-status]');
    var portrait = query('[data-persona-portrait]');
    var ready = personaReady(state.persona);
    setText('[data-persona-name]', state.persona.name);
    setText('[data-persona-detail]', personaDetail(state.persona));
    if (status) {
      status.dataset.tone = ready ? 'ready' : state.persona.reason === 'unavailable' ? 'error' : 'off';
      status.textContent = ready ? t('persona.ready') : state.persona.reason === 'disabled' ? t('persona.disabled') : state.persona.reason === 'no-portrait' ? t('persona.noPortrait') : t('persona.unavailable');
    }
    if (portrait) {
      portrait.replaceChildren();
      if (state.persona.portraitUrl) {
        var image = element('img');
        image.src = new URL(state.persona.portraitUrl, doc.baseURI).href;
        image.alt = '';
        image.addEventListener('error', function () { portrait.replaceChildren(element('span', '', state.persona.name.slice(0, 2).toUpperCase())); }, { once: true });
        portrait.appendChild(image);
      } else {
        portrait.appendChild(element('span', '', state.persona.name.slice(0, 2).toUpperCase()));
      }
    }
    var gate = query('[data-persona-gate]');
    if (gate) gate.hidden = ready;
  }

  function currentMode() {
    var selected = query('input[name="expression-mode"]:checked');
    return selected ? selected.value : 'emoji';
  }

  function syncModePanels() {
    var mode = currentMode();
    doc.querySelectorAll('[data-mode-panel]').forEach(function (panel) {
      panel.hidden = panel.dataset.modePanel !== mode;
    });
  }

  function expressionReference(state) {
    return state.references.find(function (item) { return item.source === 'upload'; }) || null;
  }

  function formatBytes(bytes) {
    return (bytes / (1024 * 1024)).toFixed(bytes >= 1024 * 1024 ? 2 : 3) + ' MiB';
  }

  function renderExpressionReference(state) {
    var preview = query('[data-expression-preview]');
    var image = query('[data-expression-image]');
    var reference = expressionReference(state);
    if (!preview || !image) return;
    preview.hidden = !reference;
    if (!reference) {
      image.removeAttribute('src');
      setText('[data-expression-name]', '');
      setText('[data-expression-meta]', '');
      return;
    }
    image.src = reference.previewUrl;
    setText('[data-expression-name]', reference.name);
    setText('[data-expression-meta]', t('image.localSize', { size: formatBytes(reference.bytes) }));
  }

  function errorMessage(error) {
    var code = error && error.code || 'UNKNOWN_ERROR';
    var key = 'errors.unknown';
    if (error && error.kind === 'provider') key = 'errors.provider';
    else if (error && error.kind === 'permission') key = 'errors.permission';
    else if (error && error.kind === 'persona') key = 'errors.persona';
    else if (error && error.kind === 'input') key = code === 'EXPRESSION_IMAGE_REQUIRED' ? 'errors.expressionImage' : 'errors.expressionCue';
    else if (error && error.kind === 'timeout') key = 'errors.timeout';
    else if (error && error.kind === 'cancelled') key = 'errors.cancelled';
    else if (error && error.kind === 'reference') key = 'errors.reference';
    else if (error && error.kind === 'reference-limit') key = 'errors.referenceLimit';
    else if (error && error.kind === 'input-limit') key = 'errors.inputLimit';
    else if (code === 'AI_API_UNAVAILABLE') key = 'errors.apiUnavailable';
    else if (code === 'FILE_API_UNAVAILABLE') key = 'errors.fileApiUnavailable';
    else if (code === 'DOWNLOAD_API_UNAVAILABLE') key = 'errors.downloadUnavailable';
    else if (code === 'FILE_READ_FAILED' || code === 'FILE_READ_CANCELLED') key = 'errors.fileRead';
    else if (code === 'AI_IMAGE_RESULT_INVALID') key = 'errors.resultInvalid';
    return code + ': ' + t(key);
  }

  function renderFeedback(state) {
    var box = query('[data-feedback]');
    var cancel = query('[data-action="cancel"]');
    var dismiss = query('[data-action="dismiss-error"]');
    if (!box || !cancel || !dismiss) return;
    var taskStatus = state.task.status;
    var busy = taskStatus === 'creating' || taskStatus === 'waiting';
    var error = localError || state.error;
    if (busy) {
      box.hidden = false;
      box.dataset.tone = 'busy';
      setText('[data-feedback-title]', taskStatus === 'creating' ? t('status.creating') : t('status.waiting'));
      setText('[data-feedback-message]', taskStatus === 'creating' ? t('status.creatingDetail') : t('status.waitingDetail'));
      cancel.hidden = false;
      dismiss.hidden = true;
      return;
    }
    if (error) {
      box.hidden = false;
      box.dataset.tone = error.kind === 'cancelled' ? 'neutral' : 'error';
      setText('[data-feedback-title]', error.kind === 'cancelled' ? t('status.cancelled') : t('status.failed'));
      setText('[data-feedback-message]', errorMessage(error));
      cancel.hidden = true;
      dismiss.hidden = false;
      return;
    }
    if (state.latestResult) {
      box.hidden = false;
      box.dataset.tone = 'success';
      setText('[data-feedback-title]', t('status.success'));
      setText('[data-feedback-message]', t('status.successDetail'));
      cancel.hidden = true;
      dismiss.hidden = true;
      return;
    }
    box.hidden = true;
  }

  function renderResult(state) {
    var panel = query('[data-result]');
    var image = query('[data-result-image]');
    if (!panel || !image) return;
    panel.hidden = !state.latestResult;
    if (!state.latestResult) {
      image.removeAttribute('src');
      lastResultUrl = '';
      downloadStatusKey = '';
      renderDownloadStatus();
      closePreview(false);
      return;
    }
    if (lastResultUrl !== state.latestResult.previewUrl) {
      lastResultUrl = state.latestResult.previewUrl;
      downloadStatusKey = '';
      renderDownloadStatus();
    }
    image.src = state.latestResult.previewUrl;
    var viewerImage = query('[data-result-viewer-image]');
    if (viewerImage && isPreviewOpen()) viewerImage.src = state.latestResult.previewUrl;
  }

  function renderDownloadStatus() {
    doc.querySelectorAll('[data-download-status]').forEach(function (status) {
      status.hidden = !downloadStatusKey;
      status.textContent = downloadStatusKey ? t(downloadStatusKey) : '';
    });
  }

  function isPreviewOpen() {
    var viewer = query('[data-result-viewer]');
    return Boolean(viewer && !viewer.hidden);
  }

  function openPreview(trigger) {
    var state = controller.getState();
    var viewer = query('[data-result-viewer]');
    var image = query('[data-result-viewer-image]');
    if (!viewer || !image || !state.latestResult) return;
    previewReturnFocus = trigger || doc.activeElement || null;
    image.src = state.latestResult.previewUrl;
    modalAccessibility.hideBackground(query('[data-page-content]'));
    viewer.hidden = false;
    viewer.setAttribute('aria-hidden', 'false');
    if (doc.body) doc.body.classList.add('result-viewer-open');
    var close = query('[data-preview-close]');
    if (close && typeof close.focus === 'function') close.focus();
  }

  function closePreview(restoreFocus) {
    var viewer = query('[data-result-viewer]');
    modalAccessibility.showBackground(query('[data-page-content]'));
    if (!viewer || viewer.hidden) return;
    viewer.hidden = true;
    viewer.setAttribute('aria-hidden', 'true');
    var image = query('[data-result-viewer-image]');
    if (image) image.removeAttribute('src');
    if (doc.body) doc.body.classList.remove('result-viewer-open');
    if (restoreFocus !== false && previewReturnFocus && typeof previewReturnFocus.focus === 'function') {
      try { previewReturnFocus.focus(); } catch (_) {}
    }
    previewReturnFocus = null;
  }

  function handlePreviewKeydown(event) {
    if (!isPreviewOpen()) return;
    if (event.key === 'Escape') {
      closePreview(true);
      event.preventDefault();
      return;
    }
    if (event.key !== 'Tab') return;
    var viewer = query('[data-result-viewer]');
    var controls = Array.from(viewer.querySelectorAll('button:not([disabled])'));
    if (!controls.length) return;
    var first = controls[0];
    var last = controls[controls.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && doc.activeElement === last) {
      first.focus();
      event.preventDefault();
    } else if (!viewer.contains(doc.activeElement)) {
      first.focus();
      event.preventDefault();
    }
  }

  function renderControls(state) {
    var ready = personaReady(state.persona);
    var busy = state.task.status === 'creating' || state.task.status === 'waiting';
    var mode = currentMode();
    var hasExpressionImage = Boolean(expressionReference(state));
    var generate = query('[data-action="generate"]');
    var fileInput = query('[data-file-input]');
    doc.querySelectorAll('input[name="expression-mode"], input[name$="-preset"], [data-custom-cue], [data-user-prompt]').forEach(function (input) {
      input.disabled = busy || !ready;
    });
    if (fileInput) fileInput.disabled = busy || !ready;
    if (generate) generate.disabled = busy || !ready || (mode === 'image' && !hasExpressionImage);
    doc.querySelectorAll('[data-action="download-png"]').forEach(function (button) { button.disabled = busy || !state.latestResult; });
  }

  function render(state) {
    lastState = state;
    renderPersona(state);
    renderExpressionReference(state);
    renderFeedback(state);
    renderResult(state);
    syncModePanels();
    renderControls(state);
  }

  function localFailure(error) {
    var classified = domain.classifyError(error);
    localError = { kind: classified.kind, code: classified.code || 'UNKNOWN_ERROR', message: String(error && error.message || error || '') };
    if (isPreviewOpen()) closePreview(true);
    renderFeedback(lastState || controller.getState());
  }

  function collectForm() {
    var mode = currentMode();
    var prompt = query('[data-user-prompt]');
    var userPrompt = prompt ? prompt.value.trim() : '';
    if (mode === 'image') return { mode: mode, cue: '', userPrompt: userPrompt };
    var custom = query('[data-custom-cue="' + mode + '"]');
    var preset = query('input[name="' + mode + '-preset"]:checked');
    return { mode: mode, cue: custom && custom.value.trim() ? custom.value.trim() : preset ? preset.value : '', userPrompt: userPrompt };
  }

  function hasImagePermission() {
    try {
      var info = tapp.lifecycle.getInfo();
      return Boolean(info && Array.isArray(info.permissions) && info.permissions.indexOf('ai:image') >= 0);
    } catch (_) {
      return Array.isArray(tapp.permissions) && tapp.permissions.indexOf('ai:image') >= 0;
    }
  }

  var tasks = tapp.ai && tapp.ai.tasks && typeof tapp.ai.tasks.create === 'function' ? tapp.ai.tasks : null;
  var controller = controllerModule.createPersonaStickerController({
    personaGet: tapp.persona && typeof tapp.persona.get === 'function' ? function () { return tapp.persona.get(); } : null,
    tasks: tasks,
    fileDownload: tapp.file && typeof tapp.file.download === 'function' ? function (content, filename, mimeType) { return tapp.file.download(content, filename, mimeType); } : null,
    hasImagePermission: hasImagePermission,
    baseUrl: doc.baseURI,
    onChange: render,
  });

  async function handleFiles(input) {
    var files = Array.from(input.files || []);
    if (!files.length) return;
    localError = null;
    try { await controller.addFiles(files); }
    catch (error) { localFailure(error); }
    finally { input.value = ''; }
  }

  async function handleAction(action) {
    localError = null;
    if (action.dataset.action === 'generate') {
      downloadStatusKey = '';
      renderDownloadStatus();
      controller.generate(collectForm()).catch(function () {});
    } else if (action.dataset.action === 'cancel') {
      await controller.cancel();
    } else if (action.dataset.action === 'dismiss-error') {
      localError = null;
      controller.clearError();
    } else if (action.dataset.action === 'remove-expression') {
      var reference = expressionReference(controller.getState());
      if (reference) controller.removeReference(reference.id);
    } else if (action.dataset.action === 'open-preview') {
      openPreview(action);
    } else if (action.dataset.action === 'close-preview') {
      closePreview(true);
    } else if (action.dataset.action === 'download-png') {
      await controller.downloadPng();
      downloadStatusKey = 'result.downloadStarted';
      renderDownloadStatus();
    }
  }

  function bindEvents() {
    var signal = aborter.signal;
    root.addEventListener('click', function (event) {
      var action = event.target.closest('[data-action]');
      if (action && root.contains(action)) handleAction(action).catch(localFailure);
    }, { signal: signal });
    root.addEventListener('change', function (event) {
      if (event.target.matches('input[name="expression-mode"]')) {
        localError = null;
        syncModePanels();
        renderControls(controller.getState());
      }
    }, { signal: signal });
    query('[data-file-input]').addEventListener('change', function (event) { handleFiles(event.currentTarget); }, { signal: signal });
    doc.addEventListener('keydown', handlePreviewKeydown, { signal: signal });
  }

  async function syncTheme() {
    try {
      var theme = await tapp.ui.getTheme();
      var dark = theme === 'dark' || Boolean(theme && theme.isDark) || Boolean(theme && theme.mode === 'dark');
      doc.documentElement.classList.toggle('dark', dark);
    } catch (_) {}
  }

  async function mount() {
    applyTranslations();
    bindEvents();
    await syncTheme();
    if (tapp.ui && typeof tapp.ui.onThemeChange === 'function') unsubs.push(tapp.ui.onThemeChange(syncTheme));
    if (tapp.ui && typeof tapp.ui.onLocaleChange === 'function') {
      unsubs.push(tapp.ui.onLocaleChange(function () { applyTranslations(); render(controller.getState()); }));
    }
    await controller.mount();
  }

  function pause() { controller.pause(); }
  function resume() { controller.resume(); }
  function destroy() {
    closePreview(false);
    aborter.abort();
    unsubs.splice(0).forEach(function (off) { if (typeof off === 'function') { try { off(); } catch (_) {} } });
    controller.destroy();
  }

  return { mount: mount, pause: pause, resume: resume, destroy: destroy };
}

module.exports = { createDomApp: createDomApp };
