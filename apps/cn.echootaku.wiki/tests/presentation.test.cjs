const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WikiSession,
  buildNavigation,
  filterArticles,
  mediaPresentation,
  selectLanguage,
} = require('../page/presentation.js');

const catalog = [
  { id: 'child', parentId: 'root', order: 2, title: 'Install', summary: 'Setup guide', tags: ['guide'] },
  { id: 'root', parentId: null, order: 1, title: 'Welcome', summary: 'Start here', tags: ['home'] },
  { id: 'other', parentId: null, order: 0, title: 'FAQ', summary: 'Answers', tags: ['help'] },
];

test('navigation keeps parent-child structure and deterministic order', () => {
  assert.deepEqual(buildNavigation(catalog).map((node) => ({
    id: node.id,
    children: node.children.map((child) => child.id),
  })), [
    { id: 'other', children: [] },
    { id: 'root', children: ['child'] },
  ]);
});

test('orphaned parent references remain reachable at the navigation root', () => {
  const nodes = buildNavigation([{ id: 'lost', parentId: 'missing', order: 0, title: 'Lost' }]);
  assert.equal(nodes[0].id, 'lost');
});

test('reader search includes title, summary, tags and Markdown body', () => {
  const articles = [
    { id: 'a', title: 'Welcome', summary: '', tags: [], markdown: 'Hello reader' },
    { id: 'b', title: 'Install', summary: 'Setup guide', tags: ['docs'], markdown: 'pnpm' },
  ];
  assert.deepEqual(filterArticles(articles, 'hello').map((item) => item.id), ['a']);
  assert.deepEqual(filterArticles(articles, 'DOCS').map((item) => item.id), ['b']);
  assert.deepEqual(filterArticles(articles, 'setup').map((item) => item.id), ['b']);
});

test('failed remote media keeps a placeholder and copyable original HTTPS URL', () => {
  assert.deepEqual(mediaPresentation({
    kind: 'video', alt: 'Tour', url: 'https://cdn.example/tour.mp4',
  }, 'error'), {
    kind: 'video',
    alt: 'Tour',
    url: 'https://cdn.example/tour.mp4',
    showMedia: false,
    showPlaceholder: true,
    canCopyOriginal: true,
  });
});

test('language selection supports Chinese, English, Japanese and English fallback', () => {
  const resources = { zh: { title: '知识库' }, en: { title: 'Wiki' }, ja: { title: 'ウィキ' } };
  assert.equal(selectLanguage(resources, 'zh-CN').title, '知识库');
  assert.equal(selectLanguage(resources, 'en-US').title, 'Wiki');
  assert.equal(selectLanguage(resources, 'ja-JP').title, 'ウィキ');
  assert.equal(selectLanguage(resources, 'fr-FR').title, 'Wiki');
});

test('session refreshes on start, resume and manual refresh but stops after destroy', async () => {
  let loads = 0;
  const repository = {
    async loadSnapshot() { loads += 1; return { catalog: { items: [] }, articles: [], issues: [] }; },
  };
  const roles = [];
  const session = new WikiSession({
    repository,
    resolveAdmin: async () => { roles.push('resolved'); return true; },
  });
  await session.start();
  await session.resume();
  await session.refresh();
  session.destroy();
  await session.resume();
  assert.equal(loads, 3);
  assert.deepEqual(roles, ['resolved']);
  assert.equal(session.state.canManage, true);
});

test('session resolves a failed role check to reader-only mode', async () => {
  const session = new WikiSession({
    repository: { async loadSnapshot() { return { catalog: { items: [] }, articles: [], issues: [] }; } },
    resolveAdmin: async () => { throw new Error('role unavailable'); },
  });
  await session.start();
  assert.equal(session.state.roleResolved, true);
  assert.equal(session.state.canManage, false);
});

test('a slower stale refresh cannot overwrite a newer snapshot', async () => {
  const pending = [];
  const repository = {
    loadSnapshot() {
      return new Promise((resolve) => pending.push(resolve));
    },
  };
  const session = new WikiSession({ repository, resolveAdmin: async () => false });
  const first = session.refresh();
  const second = session.refresh();
  pending[1]({ catalog: { items: [{ id: 'new' }] }, articles: [{ id: 'new' }], issues: [] });
  await second;
  pending[0]({ catalog: { items: [{ id: 'old' }] }, articles: [{ id: 'old' }], issues: [] });
  await first;
  assert.equal(session.state.snapshot.articles[0].id, 'new');
  assert.equal(session.state.loading, false);
});

test('destroyed session ignores a late refresh completion', async () => {
  let resolveLoad;
  const session = new WikiSession({
    repository: { loadSnapshot: () => new Promise((resolve) => { resolveLoad = resolve; }) },
    resolveAdmin: async () => false,
  });
  const refresh = session.refresh();
  session.destroy();
  resolveLoad({ catalog: { items: [{ id: 'late' }] }, articles: [{ id: 'late' }], issues: [] });
  await refresh;
  assert.deepEqual(session.state.snapshot.articles, []);
});
