const test = require('node:test');
const assert = require('node:assert/strict');

const { createTaskRunner } = require('../page/task-runner.js');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fakeClock() {
  let nextId = 0;
  const timers = new Map();
  return {
    setTimeout(fn) { const id = ++nextId; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    runAll() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((fn) => fn()); },
    size() { return timers.size; },
  };
}

function timedClock() {
  let currentTime = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    now() { return currentTime; },
    setTimeout(fn, delay) {
      const id = ++nextId;
      timers.set(id, { at: currentTime + Number(delay || 0), fn });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    async advanceTo(targetTime) {
      while (true) {
        const next = [...timers.entries()]
          .filter(([, timer]) => timer.at <= targetTime)
          .sort((left, right) => left[1].at - right[1].at)[0];
        if (!next) break;
        currentTime = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
        await flushAsyncWork();
      }
      currentTime = targetTime;
    },
  };
}

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('emits creating, waiting and success for an image task result', async () => {
  const events = [];
  let subscriber;
  let unsubscribed = 0;
  const tasks = {
    create: async () => ({ taskId: 'task-1', status: 'queued' }),
    subscribe: async (_id, callback) => { subscriber = callback; return () => { unsubscribed += 1; }; },
    get: async () => ({ taskId: 'task-1', status: 'running' }),
    cancel: async () => ({}),
  };
  const clock = fakeClock();
  const runner = createTaskRunner({ tasks, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, onState: (state) => events.push(state.status) });
  const completion = runner.run({ operation: 'image' });
  await flushAsyncWork();
  subscriber({ event: 'result', data: { format: 'image', value: { url: '/api/brew/image-cache/ab/result.png', width: 1024, height: 1024 } } });

  const result = await completion;
  assert.equal(result.value.url, '/api/brew/image-cache/ab/result.png');
  assert.deepEqual(events.slice(0, 3), ['creating', 'waiting', 'success']);
  assert.equal(unsubscribed, 1);
  assert.equal(clock.size(), 0);
});

test('preserves AI_PROVIDER_ERROR from a failed terminal state', async () => {
  let subscriber;
  const tasks = {
    create: async () => ({ taskId: 'task-provider' }),
    subscribe: async (_id, callback) => { subscriber = callback; return () => {}; },
    get: async () => ({ status: 'running' }),
    cancel: async () => ({}),
  };
  const clock = fakeClock();
  const runner = createTaskRunner({ tasks, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  const completion = runner.run({ operation: 'image' });
  await flushAsyncWork();
  subscriber({ event: 'error', data: { status: 'failed', error: { code: 'AI_PROVIDER_ERROR', message: 'provider failed' } } });

  await assert.rejects(completion, (error) => error.code === 'AI_PROVIDER_ERROR' && error.message === 'provider failed');
});

test('times out, cancels the remote task, and releases timers', async () => {
  const cancelled = [];
  const tasks = {
    create: async () => ({ taskId: 'task-timeout' }),
    subscribe: () => new Promise(() => {}),
    get: async () => ({ status: 'running' }),
    cancel: async (taskId) => { cancelled.push(taskId); },
  };
  const clock = fakeClock();
  const runner = createTaskRunner({ tasks, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  const completion = runner.run({ operation: 'image' });
  await flushAsyncWork();
  clock.runAll();

  await assert.rejects(completion, (error) => error.code === 'AI_TASK_TIMEOUT');
  assert.deepEqual(cancelled, ['task-timeout']);
  assert.equal(clock.size(), 0);
});

test('observes a backend terminal state after the 300 second execution limit', async () => {
  const clock = timedClock();
  const tasks = {
    create: async () => ({ taskId: 'task-300s-terminal', status: 'queued' }),
    subscribe: async () => () => {},
    get: async () => clock.now() >= 300000
      ? {
          taskId: 'task-300s-terminal',
          status: 'succeeded',
          result: {
            format: 'image',
            value: { url: '/api/brew/image-cache/ab/300s-terminal.png', width: 1024, height: 1024 },
          },
        }
      : { taskId: 'task-300s-terminal', status: 'running' },
    cancel: async () => ({}),
  };
  const runner = createTaskRunner({
    tasks,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  });
  const completion = runner.run({ operation: 'image' }).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await flushAsyncWork();
  await clock.advanceTo(302000);

  const outcome = await completion;
  if (outcome.error) throw outcome.error;
  assert.equal(outcome.value.value.url, '/api/brew/image-cache/ab/300s-terminal.png');
});

test('polls to completion while the task event subscription is still pending', async () => {
  const clock = timedClock();
  const tasks = {
    create: async () => ({ taskId: 'task-poll-fallback', status: 'queued' }),
    subscribe: () => new Promise(() => {}),
    get: async () => ({
      taskId: 'task-poll-fallback',
      status: 'succeeded',
      result: {
        format: 'image',
        value: { url: '/api/brew/image-cache/ab/poll-fallback.png', width: 1024, height: 1024 },
      },
    }),
    cancel: async () => ({}),
  };
  const runner = createTaskRunner({
    tasks,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  });
  const completion = runner.run({ operation: 'image' }).then(
    (value) => ({ type: 'result', value }),
    (error) => ({ type: 'error', error }),
  );
  await flushAsyncWork();
  await clock.advanceTo(2000);

  const outcome = await Promise.race([
    completion,
    flushAsyncWork().then(() => ({ type: 'pending' })),
  ]);
  assert.equal(outcome.type, 'result');
  assert.equal(outcome.value.value.url, '/api/brew/image-cache/ab/poll-fallback.png');
});

test('manual cancellation maps to a cancelled terminal state', async () => {
  const gate = deferred();
  const tasks = {
    create: async () => ({ taskId: 'task-cancel' }),
    subscribe: async () => gate.promise,
    get: async () => ({ status: 'running' }),
    cancel: async () => ({}),
  };
  const clock = fakeClock();
  const runner = createTaskRunner({ tasks, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  const completion = runner.run({ operation: 'image' });
  await flushAsyncWork();
  await runner.cancel();

  await assert.rejects(completion, (error) => error.code === 'AI_TASK_CANCELLED');
  assert.equal(clock.size(), 0);
});

test('manual cancellation during task creation cancels the remote task once its id arrives', async () => {
  const createGate = deferred();
  const cancelled = [];
  const tasks = {
    create: () => createGate.promise,
    subscribe: async () => () => {},
    get: async () => ({ status: 'running' }),
    cancel: async (taskId) => { cancelled.push(taskId); },
  };
  const clock = fakeClock();
  const runner = createTaskRunner({ tasks, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  const completion = runner.run({ operation: 'image' });
  await flushAsyncWork();
  await runner.cancel();

  await assert.rejects(completion, (error) => error.code === 'AI_TASK_CANCELLED');
  createGate.resolve({ taskId: 'task-late-cancel', status: 'queued' });
  await flushAsyncWork();

  assert.deepEqual(cancelled, ['task-late-cancel']);
  assert.equal(clock.size(), 0);
});

test('destroy during task creation cancels the remote task once its id arrives', async () => {
  const createGate = deferred();
  const cancelled = [];
  const tasks = {
    create: () => createGate.promise,
    subscribe: async () => () => {},
    get: async () => ({ status: 'running' }),
    cancel: async (taskId) => { cancelled.push(taskId); },
  };
  const clock = fakeClock();
  const runner = createTaskRunner({ tasks, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  const completion = runner.run({ operation: 'image' });
  await flushAsyncWork();
  runner.destroy();

  await assert.rejects(completion, (error) => error.code === 'AI_TASK_DESTROYED');
  createGate.resolve({ taskId: 'task-late-destroy', status: 'queued' });
  await flushAsyncWork();

  assert.deepEqual(cancelled, ['task-late-destroy']);
  assert.equal(clock.size(), 0);
});

test('destroy unsubscribes, clears timers and prevents late results from settling as success', async () => {
  let subscriber;
  let unsubscribed = 0;
  const tasks = {
    create: async () => ({ taskId: 'task-destroy' }),
    subscribe: async (_id, callback) => { subscriber = callback; return () => { unsubscribed += 1; }; },
    get: async () => ({ status: 'running' }),
    cancel: async () => ({}),
  };
  const clock = fakeClock();
  const runner = createTaskRunner({ tasks, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  const completion = runner.run({ operation: 'image' });
  await flushAsyncWork();
  runner.destroy();
  subscriber({ event: 'result', data: { format: 'image', value: { url: '/api/brew/image-cache/late.png' } } });

  await assert.rejects(completion, (error) => error.code === 'AI_TASK_DESTROYED');
  assert.equal(unsubscribed, 1);
  assert.equal(clock.size(), 0);
});
