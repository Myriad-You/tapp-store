const test = require('node:test');
const assert = require('node:assert/strict');

const { ABORT_PREFIX, BATCH_PREFIX, EVENT_PREFIX, WikiRepository } = require('../page/repository.js');
const { MAX_ARTICLES } = require('../page/domain.js');

class MemoryKv {
  constructor(values = {}, quota = 8 * 1024 * 1024) {
    this.values = structuredClone(values);
    this.quota = quota;
    this.setCalls = [];
    this.removeCalls = [];
    this.failSet = null;
    this.failRemove = null;
    this.failGet = null;
    this.onRemove = null;
  }
  async get(key) {
    if (this.failGet && this.failGet(key)) throw new Error(`get failed: ${key}`);
    return structuredClone(this.values[key] ?? null);
  }
  async getAll() { return structuredClone(this.values); }
  async keys() { return Object.keys(this.values); }
  async set(key, value) {
    if (this.failSet && this.failSet(key, value)) throw new Error(`set failed: ${key}`);
    this.setCalls.push(key);
    this.values[key] = structuredClone(value);
  }
  async remove(key) {
    if (this.failRemove && this.failRemove(key)) throw new Error(`remove failed: ${key}`);
    if (this.onRemove) await this.onRemove(key);
    this.removeCalls.push(key);
    delete this.values[key];
  }
  async usage() {
    const used = Buffer.byteLength(JSON.stringify(this.values), 'utf8');
    return { used, quota: this.quota };
  }
}

function article(overrides = {}) {
  return {
    id: 'article_01', slug: 'hello', title: 'Hello', summary: '', tags: [],
    parentId: null, order: 0, markdown: '# Hello', ...overrides,
  };
}

function legacyValues(overrides = {}) {
  const key = 'wiki:article:article_01:rev_old';
  return {
    'wiki:catalog:v1': { schema: 1, revision: 'rev_old', updatedAt: '2026-08-31T00:00:00.000Z', items: [{
      id: 'article_01', slug: 'hello', title: 'Old', summary: '', tags: [], parentId: null,
      order: 0, updatedAt: '2026-08-31T00:00:00.000Z', status: 'published', contentKey: key,
    }] },
    [key]: { ...article({ title: 'Old', markdown: '# Old' }), status: 'published' },
    ...overrides,
  };
}

function makeRepo(shared = new MemoryKv(), privateStorage = new MemoryKv()) {
  let serial = 0;
  return {
    repo: new WikiRepository({
      shared,
      privateStorage,
      now: () => '2026-09-01T00:00:00.000Z',
      createRevision: () => `rev_${++serial}`,
    }),
    shared,
    privateStorage,
  };
}

test('draft autosave writes only when canonical article data changes', async () => {
  const { repo, privateStorage } = makeRepo();
  assert.equal((await repo.saveDraft(article())).changed, true);
  assert.equal((await repo.saveDraft(article())).changed, false);
  assert.deepEqual(privateStorage.setCalls, ['wiki:draft:article_01']);
});

test('publish commits one immutable event and clears the matching private draft', async () => {
  const { repo, shared, privateStorage } = makeRepo();
  await repo.saveDraft(article());
  const result = await repo.publish(article());
  assert.deepEqual(shared.setCalls, [`${EVENT_PREFIX}rev_1:article_01`]);
  assert.equal(result.catalog.items[0].contentKey, `${EVENT_PREFIX}rev_1:article_01`);
  assert.deepEqual(privateStorage.removeCalls, ['wiki:draft:article_01']);
  assert.equal((await repo.loadSnapshot()).articles[0].markdown, '# Hello');
});

test('failed event write leaves the previous reader view and private draft intact', async () => {
  const shared = new MemoryKv(legacyValues());
  shared.failSet = (key) => key.startsWith(EVENT_PREFIX);
  const { repo, privateStorage } = makeRepo(shared);
  await repo.saveDraft(article({ title: 'New', markdown: '# New' }));
  await assert.rejects(repo.publish(article({ title: 'New', markdown: '# New' })), /publish write failed/i);
  assert.equal((await repo.loadSnapshot()).articles[0].title, 'Old');
  assert.equal(privateStorage.values['wiki:draft:article_01'].article.title, 'New');
  assert.deepEqual(privateStorage.removeCalls, []);
});

test('v2 replacement overrides legacy content without deleting its referenced body', async () => {
  const oldKey = 'wiki:article:article_01:rev_old';
  const shared = new MemoryKv(legacyValues());
  const { repo } = makeRepo(shared);
  await repo.publish(article({ title: 'New' }));
  assert.equal((await repo.loadSnapshot()).articles[0].title, 'New');
  assert.ok(shared.values[oldKey]);
  assert.deepEqual(shared.removeCalls, []);
});

test('delete commits a tombstone while leaving legacy recovery data untouched', async () => {
  const oldKey = 'wiki:article:article_01:rev_old';
  const shared = new MemoryKv(legacyValues());
  const { repo } = makeRepo(shared);
  await repo.deleteArticle('article_01');
  assert.deepEqual((await repo.loadSnapshot()).articles, []);
  assert.deepEqual(shared.setCalls, [`${EVENT_PREFIX}rev_1:article_01`]);
  assert.equal(shared.values[`${EVENT_PREFIX}rev_1:article_01`].kind, 'tombstone');
  assert.ok(shared.values[oldKey]);
});

test('delete remains available when owner quota is too full to stage a publish', async () => {
  const shared = new MemoryKv(legacyValues(), 256);
  const { repo } = makeRepo(shared);
  await repo.deleteArticle('article_01');
  assert.deepEqual((await repo.loadSnapshot()).articles, []);
  assert.equal(shared.values[`${EVENT_PREFIX}rev_1:article_01`].kind, 'tombstone');
});

test('orphan cleanup removes only an old unreferenced legacy body', async () => {
  const live = 'wiki:article:article_01:rev_live';
  const orphan = 'wiki:article:article_01:rev_orphan';
  const shared = new MemoryKv({
    'wiki:catalog:v1': { schema: 1, revision: 'rev_live', updatedAt: '2026-09-01T00:00:00.000Z', items: [{
      id: 'article_01', slug: 'hello', title: 'Hello', summary: '', tags: [], parentId: null,
      order: 0, updatedAt: '2026-09-01T00:00:00.000Z', status: 'published', contentKey: live,
    }] },
    [live]: { ...article(), updatedAt: '2026-09-01T00:00:00.000Z', status: 'published' },
    [orphan]: { ...article({ markdown: '# Orphan' }), updatedAt: '2026-08-31T00:00:00.000Z', status: 'published' },
  });
  const { repo } = makeRepo(shared);
  const result = await repo.cleanupOrphans();
  assert.deepEqual(result.removed, [orphan]);
  assert.ok(shared.values[live]);
});

test('backup restore stages all events before one atomic batch marker', async () => {
  const { repo, shared } = makeRepo();
  await repo.restoreBackup({ schema: 1, exportedAt: '2026-09-01T00:00:00.000Z', articles: [
    article({ id: 'article_a', slug: 'a', title: 'A', markdown: '# A' }),
    article({ id: 'article_b', slug: 'b', title: 'B', markdown: '# B' }),
  ] });
  assert.deepEqual(shared.setCalls, [
    `${BATCH_PREFIX}rev_1`,
    `${EVENT_PREFIX}rev_1:article_a`,
    `${EVENT_PREFIX}rev_1:article_b`,
    `${BATCH_PREFIX}rev_1`,
  ]);
  assert.equal((await repo.loadSnapshot()).articles.length, 2);
});

test('backup restore accepts an aggregate batch above one MiB when every value is safe', async () => {
  const { repo, shared } = makeRepo();
  const markdown = 'x'.repeat(600 * 1024);
  await repo.restoreBackup({ schema: 1, exportedAt: '2026-09-01T00:00:00.000Z', articles: [
    article({ id: 'article_large_a', slug: 'large-a', title: 'Large A', markdown }),
    article({ id: 'article_large_b', slug: 'large-b', title: 'Large B', markdown }),
  ] });
  assert.equal((await repo.loadSnapshot()).articles.length, 2);
  assert.equal(shared.setCalls.length, 4);
});

test('publish refuses to exceed the documented article-count limit', async () => {
  const items = Array.from({ length: MAX_ARTICLES }, (_, index) => ({
    id: `article_${String(index).padStart(3, '0')}`,
    slug: `article-${index}`,
    title: `Article ${index}`,
    summary: '', tags: [], parentId: null, order: index,
    updatedAt: '2026-09-01T00:00:00.000Z', status: 'published',
    contentKey: `wiki:article:article_${String(index).padStart(3, '0')}:rev_old`,
  }));
  const values = {
    'wiki:catalog:v1': { schema: 1, revision: 'rev_old', updatedAt: '2026-09-01T00:00:00.000Z', items },
  };
  for (const item of items) {
    values[item.contentKey] = {
      ...article({ id: item.id, slug: item.slug, title: item.title, order: item.order }),
      updatedAt: item.updatedAt,
      status: 'published',
    };
  }
  const { repo, shared } = makeRepo(new MemoryKv(values));
  await assert.rejects(repo.publish(article({ id: 'article_new', slug: 'new-article' })), /too many articles/i);
  assert.deepEqual(shared.setCalls, []);
});

test('concurrent publishes from stale snapshots preserve both distinct articles', async () => {
  const { repo } = makeRepo();
  await Promise.all([
    repo.publish(article({ id: 'article_a', slug: 'a', title: 'A' })),
    repo.publish(article({ id: 'article_b', slug: 'b', title: 'B' })),
  ]);
  assert.deepEqual((await repo.loadSnapshot()).articles.map((item) => item.id).sort(), ['article_a', 'article_b']);
});

test('concurrent duplicate slugs preserve both articles even when both stale publishes succeed', async () => {
  const { repo } = makeRepo();
  const results = await Promise.allSettled([
    repo.publish(article({ id: 'article_a', slug: 'same', title: 'A' })),
    repo.publish(article({ id: 'article_b', slug: 'same', title: 'B' })),
  ]);
  assert.deepEqual(results.map((result) => result.status), ['fulfilled', 'fulfilled']);
  const snapshot = await repo.loadSnapshot();
  assert.deepEqual(snapshot.articles.map((item) => item.id).sort(), ['article_a', 'article_b']);
  assert.deepEqual(snapshot.issues, []);
});

test('failed restore marker keeps staged events invisible and records exact recovery keys', async () => {
  const shared = new MemoryKv(legacyValues());
  shared.failSet = (key, value) => key.startsWith(BATCH_PREFIX) && value.kind === 'batch-commit';
  shared.failRemove = (key) => key.startsWith(EVENT_PREFIX);
  const { repo, privateStorage } = makeRepo(shared);
  await assert.rejects(repo.restoreBackup({ schema: 1, articles: [
    article({ id: 'article_new', slug: 'new', title: 'New' }),
  ] }), /backup restore commit failed/i);
  assert.deepEqual((await repo.loadSnapshot()).articles.map((item) => item.title), ['Old']);
  assert.equal(privateStorage.values['wiki:recovery:v1'].orphans.length, 1);
  assert.ok(privateStorage.values['wiki:recovery:v1'].orphans.every((item) => item.key.startsWith(EVENT_PREFIX)));
  shared.failSet = null;
  shared.failRemove = null;
  await repo.cleanupOrphans();
  assert.equal(privateStorage.values['wiki:recovery:v1'], undefined);
  assert.equal(Object.keys(shared.values).some((key) => key.startsWith(EVENT_PREFIX)), false);
});

test('failed restore reclaims its staged events immediately when removal is available', async () => {
  const shared = new MemoryKv(legacyValues());
  shared.failSet = (key, value) => key.startsWith(BATCH_PREFIX) && value.kind === 'batch-commit';
  const { repo, privateStorage } = makeRepo(shared);
  await assert.rejects(repo.restoreBackup({ schema: 1, articles: [
    article({ id: 'article_new', slug: 'new', title: 'New' }),
  ] }), /backup restore commit failed/i);
  assert.equal(Object.keys(shared.values).some((key) => key.startsWith(EVENT_PREFIX)), false);
  assert.equal(privateStorage.values['wiki:recovery:v1'], undefined);
  assert.equal((await repo.loadSnapshot()).articles[0].title, 'Old');
});

test('a failed restore keeps a compact abort tombstone that suppresses late commit writes', async () => {
  const batchId = 'rev_1';
  const eventKey = `${EVENT_PREFIX}${batchId}:article_new`;
  const markerKey = `${BATCH_PREFIX}${batchId}`;
  const abortMarkerKey = `${ABORT_PREFIX}${batchId}`;
  const shared = new MemoryKv(legacyValues());
  shared.failSet = (key, value) => key === markerKey && value.kind === 'batch-commit';
  const { repo } = makeRepo(shared);
  await assert.rejects(repo.restoreBackup({ schema: 1, articles: [
    article({ id: 'article_new', slug: 'new', title: 'New' }),
  ] }), /backup restore commit failed/i);

  assert.equal(shared.values[abortMarkerKey].kind, 'batch-abort');
  assert.deepEqual(shared.values[abortMarkerKey].eventKeys, []);

  shared.failSet = null;
  await shared.set(eventKey, {
    schema: 2, clock: 1, id: 'article_new', kind: 'article', revision: batchId,
    committedAt: '2026-09-01T00:00:00.000Z', batchId,
    article: { ...article({ id: 'article_new', slug: 'new', title: 'New' }), updatedAt: '2026-09-01T00:00:00.000Z' },
  });
  await shared.set(markerKey, {
    schema: 2, kind: 'batch-commit', batchId, revision: batchId, clock: 1,
    committedAt: '2026-09-01T00:00:00.000Z', eventKeys: [eventKey],
  });
  assert.deepEqual((await repo.loadSnapshot()).articles.map((item) => item.title), ['Old']);
});

test('ambiguous marker read preserves every staged key for a later safe cleanup', async () => {
  const shared = new MemoryKv(legacyValues());
  shared.failSet = (key, value) => key.startsWith(BATCH_PREFIX) && value.kind === 'batch-commit';
  shared.failGet = (key) => key.startsWith(BATCH_PREFIX);
  const { repo, privateStorage } = makeRepo(shared);
  await assert.rejects(repo.restoreBackup({ schema: 1, articles: [
    article({ id: 'article_new', slug: 'new', title: 'New' }),
  ] }), /outcome is uncertain/i);
  assert.equal(privateStorage.values['wiki:recovery:v1'].orphans.length, 2);
  assert.equal((await repo.loadSnapshot()).articles[0].title, 'Old');
  shared.failSet = null;
  shared.failGet = null;
  await repo.cleanupOrphans();
  assert.equal(Object.keys(shared.values).some((key) => key.startsWith(EVENT_PREFIX)), false);
  assert.equal(privateStorage.values['wiki:recovery:v1'], undefined);
});

test('cleanup never removes an uncommitted restore event, even after the grace period', async () => {
  const batchId = 'batch_stale';
  const key = `${EVENT_PREFIX}${batchId}:article_new`;
  const shared = new MemoryKv({
    [key]: {
      schema: 2, clock: 1, id: 'article_new', kind: 'article', revision: batchId,
      committedAt: '2026-08-31T00:00:00.000Z', batchId,
      article: { ...article({ id: 'article_new', slug: 'new', title: 'New' }), updatedAt: '2026-08-31T00:00:00.000Z' },
    },
  });
  const { repo } = makeRepo(shared);
  const result = await repo.cleanupOrphans();
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.skippedRecent, [key]);
  assert.ok(shared.values[key]);
  await shared.set(`${BATCH_PREFIX}${batchId}`, {
    schema: 2, kind: 'batch-commit', batchId, revision: batchId, clock: 1,
    committedAt: '2026-09-01T00:00:00.000Z', eventKeys: [key],
  });
  assert.deepEqual((await repo.loadSnapshot()).articles.map((item) => item.id), ['article_new']);
});

test('a crashed pending batch is globally identifiable and can be canceled without orphaning events', async () => {
  const batchId = 'crashed';
  const eventA = `${EVENT_PREFIX}${batchId}:article_a`;
  const eventB = `${EVENT_PREFIX}${batchId}:article_b`;
  const markerKey = `${BATCH_PREFIX}${batchId}`;
  const shared = new MemoryKv({
    [markerKey]: {
      schema: 2, kind: 'batch-pending', batchId, revision: batchId, clock: 1,
      committedAt: '2026-09-01T00:00:00.000Z', eventKeys: [eventA, eventB],
    },
    [eventA]: {
      schema: 2, clock: 1, id: 'article_a', kind: 'article', revision: batchId,
      committedAt: '2026-09-01T00:00:00.000Z', batchId,
      article: { ...article({ id: 'article_a', slug: 'a', title: 'Partial A' }), updatedAt: '2026-09-01T00:00:00.000Z' },
    },
  });
  shared.failRemove = (key) => key === eventA;
  const { repo } = makeRepo(shared);
  assert.deepEqual((await repo.loadSnapshot()).articles, []);
  const first = await repo.cleanupOrphans();
  assert.ok(first.removed.includes(markerKey));
  assert.ok(first.failed.includes(eventA));
  assert.equal(shared.values[`${ABORT_PREFIX}${batchId}`].kind, 'batch-abort');
  shared.failRemove = null;
  const second = await repo.cleanupOrphans();
  assert.ok(second.removed.includes(eventA));
  assert.equal(shared.values[markerKey], undefined);
  assert.equal(shared.values[eventA], undefined);
  assert.equal(shared.values[`${ABORT_PREFIX}${batchId}`].reason, 'cancel-pending-batch');
  assert.deepEqual(shared.values[`${ABORT_PREFIX}${batchId}`].eventKeys, []);
});

test('cleanup preserves recovery entries added after its initial snapshot', async () => {
  const oldKey = `${EVENT_PREFIX}old_batch:article_old`;
  const newKey = `${EVENT_PREFIX}new_batch:article_new`;
  const oldEvent = {
    schema: 2, clock: 1, id: 'article_old', kind: 'article', revision: 'old_batch',
    committedAt: '2026-09-01T00:00:00.000Z', batchId: 'old_batch',
    article: { ...article({ id: 'article_old', slug: 'old', title: 'Old' }), updatedAt: '2026-09-01T00:00:00.000Z' },
  };
  const newEvent = {
    schema: 2, clock: 2, id: 'article_new', kind: 'article', revision: 'new_batch',
    committedAt: '2026-09-01T00:00:00.000Z', batchId: 'new_batch',
    article: { ...article({ id: 'article_new', slug: 'new', title: 'New' }), updatedAt: '2026-09-01T00:00:00.000Z' },
  };
  const shared = new MemoryKv({ [oldKey]: oldEvent });
  const privateStorage = new MemoryKv({
    'wiki:recovery:v1': { schema: 1, orphans: [{ key: oldKey, reason: 'old', recordedAt: '2026-09-01T00:00:00.000Z' }] },
  });
  let injected = false;
  shared.onRemove = async (key) => {
    if (key !== oldKey || injected) return;
    injected = true;
    shared.values[newKey] = structuredClone(newEvent);
    await privateStorage.set('wiki:recovery:v1', {
      schema: 1,
      orphans: [{ key: newKey, reason: 'new', recordedAt: '2026-09-01T00:00:00.000Z' }],
    });
  };
  const { repo } = makeRepo(shared, privateStorage);
  await repo.cleanupOrphans();
  assert.equal(privateStorage.values['wiki:recovery:v1'].orphans[0].key, newKey);
  assert.ok(shared.values[newKey]);
});

test('cleanup removes an older non-winning v2 event but preserves the winner', async () => {
  const oldKey = `${EVENT_PREFIX}rev_old:article_01`;
  const newKey = `${EVENT_PREFIX}rev_new:article_01`;
  const shared = new MemoryKv({
    [oldKey]: {
      schema: 2, clock: 1, id: 'article_01', kind: 'article', revision: 'rev_old',
      committedAt: '2026-08-31T00:00:00.000Z', batchId: null,
      article: { ...article({ title: 'Old' }), updatedAt: '2026-08-31T00:00:00.000Z' },
    },
    [newKey]: {
      schema: 2, clock: 2, id: 'article_01', kind: 'article', revision: 'rev_new',
      committedAt: '2026-09-01T00:00:00.000Z', batchId: null,
      article: { ...article({ title: 'New' }), updatedAt: '2026-09-01T00:00:00.000Z' },
    },
  });
  const { repo } = makeRepo(shared);
  assert.deepEqual((await repo.cleanupOrphans()).removed, [oldKey]);
  assert.equal((await repo.loadSnapshot()).articles[0].title, 'New');
  assert.ok(shared.values[newKey]);
});

test('a missing legacy body does not poison backup once a v2 revision supersedes it', async () => {
  const missingKey = 'wiki:article:article_01:missing';
  const event = `${EVENT_PREFIX}rev_new:article_01`;
  const shared = new MemoryKv({
    'wiki:catalog:v1': { schema: 1, revision: 'rev_old', updatedAt: '2026-08-31T00:00:00.000Z', items: [{
      id: 'article_01', slug: 'hello', title: 'Missing', summary: '', tags: [], parentId: null,
      order: 0, updatedAt: '2026-08-31T00:00:00.000Z', status: 'published', contentKey: missingKey,
    }] },
    [event]: {
      schema: 2, clock: 1, id: 'article_01', kind: 'article', revision: 'rev_new',
      committedAt: '2026-09-01T00:00:00.000Z', batchId: null,
      article: { ...article({ title: 'Recovered' }), updatedAt: '2026-09-01T00:00:00.000Z' },
    },
  });
  const { repo } = makeRepo(shared);
  const snapshot = await repo.loadSnapshot();
  assert.equal(snapshot.articles[0].title, 'Recovered');
  assert.deepEqual(snapshot.issues, []);
});

test('logical clocks let a later observer win even when its wall clock is behind', async () => {
  const shared = new MemoryKv();
  const privateStorage = new MemoryKv();
  const fastClockRepo = new WikiRepository({
    shared, privateStorage,
    now: () => '2099-01-01T00:00:00.000Z',
    createRevision: () => 'fast-device',
  });
  const slowClockRepo = new WikiRepository({
    shared, privateStorage,
    now: () => '2000-01-01T00:00:00.000Z',
    createRevision: () => 'slow-device',
  });
  await fastClockRepo.publish(article({ title: 'Fast wall clock' }));
  await slowClockRepo.publish(article({ title: 'Later observer' }));
  assert.equal((await slowClockRepo.loadSnapshot()).articles[0].title, 'Later observer');
  assert.deepEqual(Object.values(shared.values).map((value) => value.clock).sort(), [1, 2]);
});

test('a complete restore generation replaces all earlier data and accepts only later overlays', async () => {
  const restoreEvent = `${EVENT_PREFIX}restore:article_a`;
  const restoreMarker = `${BATCH_PREFIX}restore`;
  const shared = new MemoryKv({
    [`${EVENT_PREFIX}old:article_old`]: {
      schema: 2, clock: 1, id: 'article_old', kind: 'article', revision: 'old',
      committedAt: '2099-01-01T00:00:00.000Z', batchId: null,
      article: { ...article({ id: 'article_old', slug: 'old', title: 'Old' }), updatedAt: '2099-01-01T00:00:00.000Z' },
    },
    [restoreEvent]: {
      schema: 2, clock: 2, id: 'article_a', kind: 'article', revision: 'restore',
      committedAt: '2000-01-01T00:00:00.000Z', batchId: 'restore',
      article: { ...article({ id: 'article_a', slug: 'a', title: 'Restored A' }), updatedAt: '2000-01-01T00:00:00.000Z' },
    },
    [restoreMarker]: {
      schema: 2, kind: 'batch-commit', batchId: 'restore', revision: 'restore', clock: 2,
      committedAt: '2000-01-01T00:00:00.000Z', eventKeys: [restoreEvent],
    },
    [`${EVENT_PREFIX}later:article_b`]: {
      schema: 2, clock: 3, id: 'article_b', kind: 'article', revision: 'later',
      committedAt: '1999-01-01T00:00:00.000Z', batchId: null,
      article: { ...article({ id: 'article_b', slug: 'b', title: 'Later B' }), updatedAt: '1999-01-01T00:00:00.000Z' },
    },
  });
  const { repo } = makeRepo(shared);
  assert.deepEqual((await repo.loadSnapshot()).articles.map((item) => item.title).sort(), ['Later B', 'Restored A']);
});

test('an incomplete restore marker never exposes a partial generation', async () => {
  const eventA = `${EVENT_PREFIX}restore:article_a`;
  const eventB = `${EVENT_PREFIX}restore:article_b`;
  const shared = new MemoryKv({
    ...legacyValues(),
    [eventA]: {
      schema: 2, clock: 2, id: 'article_a', kind: 'article', revision: 'restore',
      committedAt: '2026-09-01T00:00:00.000Z', batchId: 'restore',
      article: { ...article({ id: 'article_a', slug: 'a', title: 'Partial A' }), updatedAt: '2026-09-01T00:00:00.000Z' },
    },
    [`${BATCH_PREFIX}restore`]: {
      schema: 2, kind: 'batch-commit', batchId: 'restore', revision: 'restore', clock: 2,
      committedAt: '2026-09-01T00:00:00.000Z', eventKeys: [eventA, eventB],
    },
  });
  const { repo } = makeRepo(shared);
  const snapshot = await repo.loadSnapshot();
  assert.deepEqual(snapshot.articles.map((item) => item.title), ['Old']);
  assert.equal(snapshot.issues[0].code, 'incomplete-batch');
});

test('semantic or non-canonical batch records cannot replace the previous baseline', async () => {
  const batchId = 'corrupt';
  const badEventKey = `${EVENT_PREFIX}${batchId}:article_a`;
  const shared = new MemoryKv({
    ...legacyValues(),
    [badEventKey]: {
      schema: 2, clock: 2, id: 'article_a', kind: 'article', revision: batchId,
      committedAt: '2026-09-01T00:00:00.000Z', batchId,
      article: { ...article({ id: 'article_other', slug: 'other', title: 'Mismatched' }), updatedAt: '2026-09-01T00:00:00.000Z' },
    },
    [`${BATCH_PREFIX}${batchId}`]: {
      schema: 2, kind: 'batch-commit', batchId, revision: batchId, clock: 2,
      committedAt: '2026-09-01T00:00:00.000Z', eventKeys: [badEventKey],
    },
    [`${BATCH_PREFIX}wrong-key`]: {
      schema: 2, kind: 'batch-commit', batchId: 'different', revision: 'different', clock: 3,
      committedAt: '2026-09-01T00:00:00.000Z', eventKeys: [],
    },
  });
  const { repo } = makeRepo(shared);
  const snapshot = await repo.loadSnapshot();
  assert.deepEqual(snapshot.articles.map((item) => item.title), ['Old']);
  assert.ok(snapshot.issues.some((issue) => issue.code === 'invalid-event-content'));
  assert.ok(snapshot.issues.some((issue) => issue.code === 'invalid-batch-marker'));
});

test('cleanup compacts superseded successful batches but preserves the active generation', async () => {
  const { repo, shared } = makeRepo();
  await repo.restoreBackup({ schema: 1, articles: [article({ id: 'article_a', slug: 'a', title: 'A' })] });
  const oldKeys = shared.setCalls.slice();
  await repo.restoreBackup({ schema: 1, articles: [article({ id: 'article_b', slug: 'b', title: 'B' })] });
  const result = await repo.cleanupOrphans();
  assert.ok(oldKeys.every((key) => result.removed.includes(key)));
  assert.deepEqual((await repo.loadSnapshot()).articles.map((item) => item.id), ['article_b']);
});

test('latest canceled new draft can be recovered without becoming shared content', async () => {
  const { repo } = makeRepo();
  await repo.saveDraft(article({ id: 'draft_new', slug: 'draft-new', title: 'Draft', existing: false }));
  const recovered = await repo.getLatestNewDraft();
  assert.equal(recovered.article.id, 'draft_new');
  assert.equal((await repo.loadSnapshot()).articles.length, 0);
});
