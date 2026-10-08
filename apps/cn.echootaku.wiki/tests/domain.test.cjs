const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HARD_VALUE_BYTES,
  OWNER_QUOTA_BYTES,
  assessQuota,
  buildBackup,
  parseBackup,
  resolveRoleUi,
  safeDownloadFilename,
  sanitizeExternalUrl,
  validateArticle,
  validateMediaUrl,
} = require('../page/domain.js');

test('role controls stay hidden until admin resolution completes', () => {
  assert.deepEqual(resolveRoleUi({ resolved: false, isAdmin: true }), {
    canRead: true,
    canManage: false,
    showPending: true,
  });
  assert.equal(resolveRoleUi({ resolved: true, isAdmin: false }).canManage, false);
  assert.equal(resolveRoleUi({ resolved: true, isAdmin: true }).canManage, true);
});

test('article validation keeps a stable id and allows duplicate display slugs', () => {
  const article = validateArticle({
    id: 'article_01',
    slug: 'getting-started',
    title: '开始使用',
    summary: '第一篇文档',
    tags: ['入门', ' 文档 '],
    parentId: null,
    order: 2,
    markdown: '# 开始使用',
  }, [{ id: 'article_02', slug: 'faq' }]);

  assert.equal(article.id, 'article_01');
  assert.deepEqual(article.tags, ['入门', '文档']);
  assert.equal(validateArticle({ ...article, slug: 'faq' }, [
    { id: 'article_02', slug: 'faq' },
  ]).slug, 'faq');
});

test('media accepts only HTTPS image and video URLs', () => {
  assert.deepEqual(validateMediaUrl('https://cdn.example/image.webp'), {
    ok: true,
    kind: 'image',
    url: 'https://cdn.example/image.webp',
  });
  assert.equal(validateMediaUrl('https://cdn.example/movie.mp4').kind, 'video');
  for (const url of [
    'http://cdn.example/image.png',
    'data:image/png;base64,AAAA',
    'javascript:alert(1)',
    'https://cdn.example/archive.zip',
  ]) {
    assert.equal(validateMediaUrl(url).ok, false, url);
  }
});

test('external links are copy-only HTTPS values', () => {
  assert.equal(sanitizeExternalUrl('https://example.com/docs?q=1'), 'https://example.com/docs?q=1');
  assert.equal(sanitizeExternalUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeExternalUrl('data:text/html,boom'), '');
  assert.equal(sanitizeExternalUrl('http://example.com'), '');
});

test('quota assessment warns at 70, 85 and 95 percent and reserves publish space', () => {
  assert.equal(assessQuota({ used: OWNER_QUOTA_BYTES * 0.69, writeBytes: 1 }).level, 'normal');
  assert.equal(assessQuota({ used: OWNER_QUOTA_BYTES * 0.70, writeBytes: 1 }).level, 'watch');
  assert.equal(assessQuota({ used: OWNER_QUOTA_BYTES * 0.85, writeBytes: 1 }).level, 'warning');
  assert.equal(assessQuota({ used: OWNER_QUOTA_BYTES * 0.95, writeBytes: 1 }).level, 'critical');
  assert.equal(assessQuota({
    used: OWNER_QUOTA_BYTES - 200,
    writeBytes: 100,
    reserveBytes: 128,
  }).allowed, false);
});

test('quota assessment applies the one MiB limit to each stored value, not the aggregate batch', () => {
  const report = assessQuota({
    used: 0,
    writeBytes: HARD_VALUE_BYTES + 256 * 1024,
    largestValueBytes: 640 * 1024,
    reserveBytes: 0,
  });
  assert.equal(report.allowed, true);
  assert.equal(report.largestValueBytes, 640 * 1024);
});

test('article records cannot reach the one MiB hard value boundary', () => {
  const huge = 'x'.repeat(HARD_VALUE_BYTES);
  assert.throws(() => validateArticle({
    id: 'article_huge', slug: 'huge', title: 'Huge', markdown: huge,
  }, []), /1 MiB|MiB/i);
});

test('backup export and import preserve published content without unsafe extras', () => {
  const backup = buildBackup({
    exportedAt: '2026-09-01T00:00:00.000Z',
    catalog: { schema: 1, revision: 'rev_1', items: [{
      id: 'article_01', slug: 'hello', title: 'Hello', summary: '', tags: [],
      parentId: null, order: 0, updatedAt: '2026-09-01T00:00:00.000Z',
      status: 'published', contentKey: 'wiki:article:article_01:rev_1',
    }] },
    articles: [{
      id: 'article_01', slug: 'hello', title: 'Hello', summary: '', tags: [],
      parentId: null, order: 0, updatedAt: '2026-09-01T00:00:00.000Z',
      status: 'published', markdown: '# Hello',
    }],
  });

  const parsed = parseBackup(JSON.stringify(backup));
  assert.equal(parsed.schema, 1);
  assert.equal(parsed.articles[0].markdown, '# Hello');
  assert.equal(Object.hasOwn(parsed.articles[0], 'contentKey'), false);
  assert.throws(() => parseBackup('{"schema":1,"articles":"nope"}'), /articles/i);
});

test('backup import rejects duplicate article ids before writing shared data', () => {
  assert.throws(() => parseBackup({ schema: 1, articles: [
    { id: 'article_same', slug: 'first', title: 'First', markdown: '# First' },
    { id: 'article_same', slug: 'second', title: 'Second', markdown: '# Second' },
  ] }), /duplicate article id/i);
});

test('backup export refuses to silently omit unreadable published articles', () => {
  assert.throws(() => buildBackup({
    articles: [],
    issues: [{ id: 'article_missing', code: 'read-failed' }],
  }), /unreadable articles/i);
});

test('download filenames contain no separators or traversal segments', () => {
  assert.equal(safeDownloadFilename('../我的/知识库.json', 'json'), '我的-知识库.json');
  assert.equal(safeDownloadFilename('..\\wiki', 'md'), 'wiki.md');
});
