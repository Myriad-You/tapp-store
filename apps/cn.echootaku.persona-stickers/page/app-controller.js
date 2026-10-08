'use strict';

var domain = require('./domain.js');
var taskRunner = require('./task-runner.js');
var fileReader = require('./file-reader.js');

function defaultAttemptId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

function createPersonaStickerController(options) {
  options = options || {};
  var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
  var personaGet = typeof options.personaGet === 'function' ? options.personaGet : null;
  var readFile = typeof options.readFile === 'function' ? options.readFile : fileReader.readFileAsDataUrl;
  var fileDownload = typeof options.fileDownload === 'function' ? options.fileDownload : null;
  var hasImagePermission = typeof options.hasImagePermission === 'function' ? options.hasImagePermission : function () { return false; };
  var attemptId = typeof options.attemptId === 'function' ? options.attemptId : defaultAttemptId;
  var baseUrl = String(options.baseUrl || 'https://localhost/');
  var state = {
    mounted: false,
    destroyed: false,
    persona: domain.normalizePersona(null),
    references: [],
    task: { status: 'idle', taskId: '' },
    latestResult: null,
    error: null,
  };
  var referenceReadRevision = 0;
  var runner = options.tasks ? taskRunner.createTaskRunner({
    tasks: options.tasks,
    onState: function (taskState) {
      state.task = { status: taskState.status, taskId: taskState.taskId || '' };
      publish();
    },
  }) : null;

  function snapshot() {
    return {
      mounted: state.mounted,
      destroyed: state.destroyed,
      persona: Object.assign({}, state.persona),
      references: state.references.map(function (item) { return Object.assign({}, item); }),
      task: Object.assign({}, state.task),
      latestResult: state.latestResult ? Object.assign({}, state.latestResult) : null,
      error: state.error ? Object.assign({}, state.error) : null,
    };
  }

  function publish() { onChange(snapshot()); }

  function fail(error) {
    if (state.destroyed) return error;
    var classification = domain.classifyError(error);
    state.error = { kind: classification.kind, code: classification.code, message: String(error && error.message || error || classification.code) };
    publish();
    return error;
  }

  async function mount() {
    if (state.destroyed || state.mounted) return snapshot();
    state.mounted = true;
    if (!personaGet) {
      state.persona = domain.normalizePersona(null);
      publish();
      return snapshot();
    }
    try {
      var personaCard = await personaGet();
      if (state.destroyed) return snapshot();
      state.persona = domain.normalizePersona(personaCard);
      if (state.persona.portraitUrl) {
        state.references = [{
          id: 'persona-primary',
          source: 'persona',
          name: state.persona.name,
          value: state.persona.portraitUrl,
          previewUrl: new URL(state.persona.portraitUrl, baseUrl).href,
          bytes: 0,
        }];
      }
    } catch (_) {
      if (state.destroyed) return snapshot();
      state.persona = domain.normalizePersona(null);
    }
    publish();
    return snapshot();
  }

  async function addFiles(files) {
    if (state.destroyed) throw fail(domain.codedError('PAGE_DESTROYED', 'Page has been destroyed'));
    var readRevision = ++referenceReadRevision;
    var list = Array.from(files || []);
    if (list.length !== 1) {
      throw fail(domain.codedError('AI_IMAGE_REFERENCE_LIMIT', 'Choose exactly one expression reference image', 'count'));
    }
    var selected = list[0];
    if (Math.max(0, Number(selected && selected.size) || 0) > domain.MAX_REFERENCE_BYTES) {
      throw fail(domain.codedError('AI_IMAGE_REFERENCE_LIMIT', 'Expression image exceeds 10 MiB', 'bytes'));
    }
    var dataUrl = await readFile(selected);
    if (state.destroyed) throw domain.codedError('PAGE_DESTROYED', 'Page has been destroyed');
    if (readRevision !== referenceReadRevision) return snapshot();
    var checked = domain.validateLocalImageDataUrl(dataUrl);
    if (checked.bytes > domain.MAX_REFERENCE_BYTES) {
      throw fail(domain.codedError('AI_IMAGE_REFERENCE_LIMIT', 'Expression image exceeds 10 MiB', 'bytes'));
    }
    var personaReferences = state.references.filter(function (item) { return item.source === 'persona'; });
    state.references = personaReferences.concat({
      id: 'upload-' + attemptId(),
      source: 'upload',
      name: String(selected.name || 'expression-reference').slice(0, 120),
      value: dataUrl,
      previewUrl: dataUrl,
      bytes: checked.bytes,
      mime: checked.mime,
    });
    state.error = null;
    publish();
    return snapshot();
  }

  function removeReference(id) {
    if (state.destroyed) return;
    referenceReadRevision += 1;
    state.references = state.references.filter(function (item) { return item.id !== id; });
    publish();
  }

  async function generate(form) {
    form = form || {};
    if (!state.persona.enabled || !state.persona.portraitUrl) {
      throw fail(domain.codedError('PERSONA_REQUIRED', 'Create and enable an Agent Persona portrait before generating a sticker'));
    }
    if (!options.tasks || !runner) throw fail(domain.codedError('AI_API_UNAVAILABLE', 'Myriad AI task API is unavailable'));
    if (!hasImagePermission()) throw fail(domain.codedError('PERMISSION_DENIED', 'The ai:image permission is not granted'));
    var mode = String(form.mode || '').trim();
    var expressionReference = state.references.find(function (item) { return item.source === 'upload'; });
    if (mode === 'image' && !expressionReference) {
      throw fail(domain.codedError('EXPRESSION_IMAGE_REQUIRED', 'Choose one expression reference image'));
    }
    state.error = null;
    publish();
    var promptOptions = { persona: state.persona, mode: mode, cue: form.cue, userPrompt: form.userPrompt };
    var requestReferences = [state.persona.portraitUrl];
    if (mode === 'image') requestReferences.push(expressionReference.value);
    var request = {
      version: 2,
      operation: 'image',
      input: {
        prompt: domain.buildPrompt(promptOptions),
        width: 1024,
        height: 1024,
        referenceImages: requestReferences,
      },
      output: { format: 'image' },
      delivery: 'result',
      idempotencyKey: 'persona-stickers-' + attemptId(),
    };
    try {
      var raw = await runner.run(request);
      var result = domain.normalizeImageResult(raw, baseUrl);
      if (!result.previewUrl || !result.referenceUrl) throw domain.codedError('AI_IMAGE_RESULT_INVALID', 'The image task did not return a safe Myriad cache path');
      state.latestResult = Object.assign({ prompt: request.input.prompt, mode: mode, userPrompt: String(form.userPrompt || '').trim() }, result);
      state.error = null;
      publish();
      return Object.assign({}, state.latestResult);
    } catch (error) {
      throw fail(error);
    }
  }

  async function downloadPng() {
    if (state.destroyed) throw fail(domain.codedError('PAGE_DESTROYED', 'Page has been destroyed'));
    if (!state.latestResult) throw fail(domain.codedError('RESULT_REQUIRED', 'Generate a sticker before downloading PNG'));
    if (!fileDownload) throw fail(domain.codedError('DOWNLOAD_API_UNAVAILABLE', 'The host file download bridge is unavailable'));
    try {
      await fileDownload(state.latestResult.referenceUrl, 'persona-sticker.png');
      state.error = null;
      publish();
      return { filename: 'persona-sticker.png', format: 'image/png' };
    } catch (error) {
      throw fail(error);
    }
  }

  function cancel() { return runner ? runner.cancel() : Promise.resolve(false); }
  function pause() { if (runner) runner.pause(); }
  function resume() { if (runner) runner.resume(); }
  function clearError() { state.error = null; publish(); }
  function destroy() {
    if (state.destroyed) return;
    state.destroyed = true;
    referenceReadRevision += 1;
    if (runner) runner.destroy();
    state.references = [];
    state.latestResult = null;
    publish();
  }

  return {
    mount: mount,
    addFiles: addFiles,
    removeReference: removeReference,
    generate: generate,
    downloadPng: downloadPng,
    cancel: cancel,
    pause: pause,
    resume: resume,
    clearError: clearError,
    destroy: destroy,
    getState: snapshot,
  };
}

module.exports = { createPersonaStickerController: createPersonaStickerController };
