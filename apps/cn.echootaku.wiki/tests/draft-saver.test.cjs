const test = require('node:test');
const assert = require('node:assert/strict');

const { DraftSaver } = require('../page/draft-saver.js');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('draft saves are serialized and stale completion cannot report the newer edit as saved', async () => {
  const first = deferred();
  const second = deferred();
  const calls = [];
  const statuses = [];
  const saver = new DraftSaver({
    save(snapshot) {
      calls.push(snapshot.markdown);
      return calls.length === 1 ? first.promise : second.promise;
    },
    onStatus(status) { statuses.push(status); },
  });

  saver.markDirty();
  const firstFlush = saver.flush({ markdown: 'first' });
  await new Promise((resolve) => setImmediate(resolve));
  saver.markDirty();
  const secondFlush = saver.flush({ markdown: 'second' });
  assert.deepEqual(calls, ['first']);

  first.resolve({ changed: true });
  await firstFlush;
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ['first', 'second']);
  assert.notEqual(statuses.at(-1), 'saved');

  second.resolve({ changed: true });
  await secondFlush;
  assert.equal(statuses.at(-1), 'saved');
  assert.equal(saver.hasPending(), false);
});

test('a failed current revision remains pending and can be retried', async () => {
  let attempts = 0;
  const saver = new DraftSaver({
    save() {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ changed: true });
    },
  });
  saver.markDirty();
  await assert.rejects(saver.flush({ markdown: 'draft' }), /offline/);
  assert.equal(saver.hasPending(), true);
  await saver.flush({ markdown: 'draft' });
  assert.equal(saver.hasPending(), false);
});
