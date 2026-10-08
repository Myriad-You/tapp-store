const test = require('node:test');
const assert = require('node:assert/strict');

const { createPersonaStickerController } = require('../page/app-controller.js');

function imageResult(name = 'result') {
  return { format: 'image', value: { url: `/api/brew/image-cache/ab/${name}.png`, width: 1024, height: 1024 } };
}

function tasksThatReturn(result = imageResult()) {
  return { create: async () => result, subscribe: async () => () => {}, get: async () => ({}), cancel: async () => ({}) };
}

function readyPersona() {
  return { enabled: true, name: 'Arael', moodBand: 'excited', activity: 'talking', portraitUrl: '/api/brew/image-cache/ab/agent.png' };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('loads the enabled Agent portrait and reports unavailable Persona without inventing a fallback', async () => {
  const ready = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    tasks: tasksThatReturn(),
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/tapp/run/id',
  });
  await ready.mount();
  assert.equal(ready.getState().persona.name, 'Arael');
  assert.deepEqual(ready.getState().references.map((item) => [item.source, item.value]), [['persona', '/api/brew/image-cache/ab/agent.png']]);

  const fallback = createPersonaStickerController({
    personaGet: async () => { throw new Error('bridge unavailable'); },
    tasks: tasksThatReturn(),
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/tapp/run/id',
  });
  await fallback.mount();
  assert.equal(fallback.getState().persona.reason, 'unavailable');
  assert.equal(fallback.getState().references.length, 0);
});

test('blocks generation before calling AI when the user has no usable Agent Persona portrait', async () => {
  let calls = 0;
  const controller = createPersonaStickerController({
    personaGet: async () => ({ enabled: false, portraitUrl: null }),
    tasks: { ...tasksThatReturn(), create: async () => { calls += 1; return imageResult(); } },
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/',
  });
  await controller.mount();

  await assert.rejects(
    controller.generate({ mode: 'emoji', cue: '😭' }),
    (error) => error.code === 'PERSONA_REQUIRED',
  );
  assert.equal(calls, 0);
  assert.equal(controller.getState().error.kind, 'persona');
});

test('keeps exactly one uploaded expression image and replaces it when another is selected', async () => {
  const readFiles = [];
  const controller = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    readFile: async (file) => { readFiles.push(file.name); return 'data:image/png;base64,iVBORw0KGgo='; },
    tasks: tasksThatReturn(),
    hasImagePermission: () => true,
    attemptId: () => 'fixed',
    baseUrl: 'https://myriad.example/',
  });
  await controller.mount();
  await controller.addFiles([{ name: 'first.png', type: 'image/png', size: 8 }]);
  await controller.addFiles([{ name: 'second.png', type: 'image/png', size: 8 }]);

  assert.deepEqual(readFiles, ['first.png', 'second.png']);
  assert.deepEqual(controller.getState().references.map((item) => item.source), ['persona', 'upload']);
  assert.equal(controller.getState().references[1].name, 'second.png');
});

test('keeps the latest expression image when overlapping file reads finish out of order', async () => {
  const reads = new Map();
  const controller = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    readFile: (file) => {
      const gate = deferred();
      reads.set(file.name, gate);
      return gate.promise;
    },
    tasks: tasksThatReturn(),
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/',
  });
  await controller.mount();

  const first = controller.addFiles([{ name: 'first.png', type: 'image/png', size: 8 }]);
  const second = controller.addFiles([{ name: 'second.png', type: 'image/png', size: 8 }]);
  reads.get('second.png').resolve('data:image/png;base64,iVBORw0KGgo=');
  await second;
  reads.get('first.png').resolve('data:image/png;base64,iVBORw0KGgo=');
  await first;

  assert.equal(controller.getState().references[1].name, 'second.png');
});

test('rejects selecting more than one expression image at once', async () => {
  const controller = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    readFile: async () => 'data:image/png;base64,iVBORw0KGgo=',
    tasks: tasksThatReturn(),
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/',
  });
  await controller.mount();

  await assert.rejects(
    controller.addFiles([
      { name: 'one.png', type: 'image/png', size: 8 },
      { name: 'two.png', type: 'image/png', size: 8 },
    ]),
    (error) => error.code === 'AI_IMAGE_REFERENCE_LIMIT' && error.reason === 'count',
  );
  assert.deepEqual(controller.getState().references.map((item) => item.source), ['persona']);
});

test('creates one 1024 square Emoji task using only the Agent portrait', async () => {
  const requests = [];
  const controller = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    tasks: { ...tasksThatReturn(), create: async (request) => { requests.push(request); return imageResult('emoji'); } },
    hasImagePermission: () => true,
    attemptId: () => 'attempt-emoji',
    baseUrl: 'https://myriad.example/tapp/run/id',
  });
  await controller.mount();
  const result = await controller.generate({ mode: 'emoji', cue: '😭' });

  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].input.referenceImages, ['/api/brew/image-cache/ab/agent.png']);
  assert.equal(requests[0].input.width, 1024);
  assert.equal(requests[0].input.height, 1024);
  assert.match(requests[0].input.prompt, /Emoji cue: 😭/);
  assert.doesNotMatch(requests[0].input.prompt, /panel|sheet|grid/i);
  assert.equal(requests[0].operation, 'image');
  assert.equal(requests[0].output.format, 'image');
  assert.equal(requests[0].delivery, 'result');
  assert.equal(requests[0].idempotencyKey, 'persona-stickers-attempt-emoji');
  assert.equal(result.referenceUrl, '/api/brew/image-cache/ab/emoji.png');
});

test('passes the optional user direction into the generated prompt', async () => {
  const requests = [];
  const controller = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    tasks: { ...tasksThatReturn(), create: async (request) => { requests.push(request); return imageResult('directed'); } },
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/tapp/run/id',
  });
  await controller.mount();
  await controller.generate({ mode: 'emoji', cue: '😭', userPrompt: '双手抱头，眼泪向两侧喷出。' });

  assert.match(requests[0].input.prompt, /PRIMARY USER CREATIVE DIRECTION/);
  assert.match(requests[0].input.prompt, /双手抱头，眼泪向两侧喷出。/);
});

test('downloads the latest generated PNG cache through the public host file bridge', async () => {
  const downloads = [];
  const controller = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    tasks: tasksThatReturn(imageResult('download-me')),
    fileDownload: async (content, filename, mimeType) => { downloads.push({ content, filename, mimeType }); },
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/tapp/run/id',
  });
  await controller.mount();
  await controller.generate({ mode: 'emoji', cue: '😀', userPrompt: '' });
  const downloaded = await controller.downloadPng();

  assert.deepEqual(downloaded, { filename: 'persona-sticker.png', format: 'image/png' });
  assert.equal(downloads.length, 1);
  assert.deepEqual(downloads[0], {
    content: '/api/brew/image-cache/ab/download-me.png',
    filename: 'persona-sticker.png',
    mimeType: undefined,
  });
});

test('does not invoke the PNG download bridge when no generated result exists', async () => {
  let calls = 0;
  const controller = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    tasks: tasksThatReturn(),
    fileDownload: async () => { calls += 1; },
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/',
  });
  await controller.mount();

  await assert.rejects(controller.downloadPng(), (error) => error.code === 'RESULT_REQUIRED');
  assert.equal(calls, 0);
});

test('reports a distinct error when the public host PNG download bridge is unavailable', async () => {
  const controller = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    tasks: tasksThatReturn(imageResult('ready-without-download')),
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/',
  });
  await controller.mount();
  await controller.generate({ mode: 'emoji', cue: '😀' });

  await assert.rejects(controller.downloadPng(), (error) => error.code === 'DOWNLOAD_API_UNAVAILABLE');
});

test('creates image-reference mode with the Agent portrait first and one expression image second', async () => {
  const requests = [];
  const controller = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    readFile: async () => 'data:image/png;base64,iVBORw0KGgo=',
    tasks: { ...tasksThatReturn(), create: async (request) => { requests.push(request); return imageResult('image-mode'); } },
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/',
  });
  await controller.mount();
  await controller.addFiles([{ name: 'expression.png', type: 'image/png', size: 8 }]);
  await controller.generate({ mode: 'image', cue: '' });

  assert.deepEqual(requests[0].input.referenceImages, [
    '/api/brew/image-cache/ab/agent.png',
    'data:image/png;base64,iVBORw0KGgo=',
  ]);
  assert.match(requests[0].input.prompt, /Reference image 2 is only the expression, pose, and composition reference/i);
});

test('requires the single expression image before creating an image-reference task', async () => {
  let calls = 0;
  const controller = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    tasks: { ...tasksThatReturn(), create: async () => { calls += 1; return imageResult(); } },
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/',
  });
  await controller.mount();

  await assert.rejects(
    controller.generate({ mode: 'image', cue: '' }),
    (error) => error.code === 'EXPRESSION_IMAGE_REQUIRED',
  );
  assert.equal(calls, 0);
});

test('does not silently retry without references when the provider rejects an image edit', async () => {
  let calls = 0;
  const controller = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    tasks: {
      ...tasksThatReturn(),
      create: async () => { calls += 1; const error = new Error('unsupported references'); error.code = 'AI_PROVIDER_ERROR'; throw error; },
    },
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/',
  });
  await controller.mount();

  await assert.rejects(controller.generate({ mode: 'emoji', cue: '😀' }), (error) => error.code === 'AI_PROVIDER_ERROR');
  assert.equal(calls, 1);
  assert.equal(controller.getState().error.kind, 'provider');
});

test('reports missing API and permission before creating a task', async () => {
  const noPermission = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    tasks: { create: async () => { throw new Error('must not call'); } },
    hasImagePermission: () => false,
    baseUrl: 'https://myriad.example/',
  });
  await noPermission.mount();
  await assert.rejects(noPermission.generate({ mode: 'emoji', cue: '😀' }), (error) => error.code === 'PERMISSION_DENIED');

  const noApi = createPersonaStickerController({ personaGet: async () => readyPersona(), tasks: null, hasImagePermission: () => true, baseUrl: 'https://myriad.example/' });
  await noApi.mount();
  await assert.rejects(noApi.generate({ mode: 'emoji', cue: '😀' }), (error) => error.code === 'AI_API_UNAVAILABLE');
});

test('destroy clears in-memory image payloads and ignores late Persona or file results', async () => {
  const persona = deferred();
  const localFile = deferred();
  const controller = createPersonaStickerController({
    personaGet: () => persona.promise,
    readFile: () => localFile.promise,
    tasks: tasksThatReturn(),
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/',
  });

  const mounting = controller.mount();
  controller.destroy();
  persona.resolve(readyPersona());
  await mounting;
  assert.equal(controller.getState().references.length, 0);
  assert.equal(controller.getState().persona.reason, 'unavailable');

  const other = createPersonaStickerController({
    personaGet: async () => readyPersona(),
    readFile: () => localFile.promise,
    tasks: tasksThatReturn(),
    hasImagePermission: () => true,
    baseUrl: 'https://myriad.example/',
  });
  await other.mount();
  const adding = other.addFiles([{ name: 'late.png', type: 'image/png', size: 8 }]);
  other.destroy();
  localFile.resolve('data:image/png;base64,iVBORw0KGgo=');
  await assert.rejects(adding, (error) => error.code === 'PAGE_DESTROYED');
  assert.equal(other.getState().references.length, 0);
  assert.equal(other.getState().error, null);
});
