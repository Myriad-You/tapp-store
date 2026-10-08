const test = require('node:test');
const assert = require('node:assert/strict');

const { registerLifecycle } = require('../page/lifecycle.js');

test('mounts once and forwards pause, resume and destroy to the active page', async () => {
  const hooks = {};
  const calls = [];
  const tapp = {
    lifecycle: {
      onReady(callback) { hooks.ready = callback; },
      onPause(callback) { hooks.pause = callback; },
      onResume(callback) { hooks.resume = callback; },
      onDestroy(callback) { hooks.destroy = callback; },
    },
  };

  registerLifecycle(tapp, () => ({
    mount: async () => { calls.push('mount'); },
    pause: () => { calls.push('pause'); },
    resume: () => { calls.push('resume'); },
    destroy: () => { calls.push('destroy'); },
  }));

  await hooks.ready();
  await hooks.ready();
  hooks.pause();
  hooks.resume();
  hooks.destroy();
  hooks.resume();

  assert.deepEqual(calls, ['mount', 'pause', 'resume', 'destroy']);
});
