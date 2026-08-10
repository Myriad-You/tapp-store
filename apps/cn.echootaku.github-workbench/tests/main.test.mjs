import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../main.js', import.meta.url), 'utf8');
const context = vm.createContext({ URL, console, Intl, Date, encodeURIComponent });
vm.runInContext(source, context, { filename: 'main.js' });

test('ghSafeUrl only accepts github.com HTTPS URLs', () => {
  assert.equal(context.ghSafeUrl('https://github.com/Myriad-You/tapp-store'), 'https://github.com/Myriad-You/tapp-store');
  assert.equal(context.ghSafeUrl('http://github.com/Myriad-You/tapp-store'), '');
  assert.equal(context.ghSafeUrl('https://example.com/Myriad-You/tapp-store'), '');
  assert.equal(context.ghSafeUrl('not a URL'), '');
});

test('ghNormalizeRepos removes duplicates and unsafe repository URLs', () => {
  const repos = context.ghNormalizeRepos([
    { full_name: 'Myriad-You/tapp-store', name: 'tapp-store', owner: { login: 'Myriad-You' }, html_url: 'https://github.com/Myriad-You/tapp-store' },
    { full_name: 'Myriad-You/tapp-store', name: 'tapp-store', owner: { login: 'Myriad-You' }, html_url: 'https://github.com/Myriad-You/tapp-store' },
    { full_name: 'unsafe/repo', name: 'repo', owner: { login: 'unsafe' }, html_url: 'https://example.com/unsafe/repo' }
  ]);

  assert.equal(repos.length, 1);
  assert.equal(repos[0].fullName, 'Myriad-You/tapp-store');
});

test('ghSelectRepo supports an account with no repositories', () => {
  assert.equal(context.ghSelectRepo([], 'missing/repo'), null);
  const repos = [{ fullName: 'first/repo' }, { fullName: 'second/repo' }];
  assert.equal(context.ghSelectRepo(repos, 'second/repo').fullName, 'second/repo');
  assert.equal(context.ghSelectRepo(repos, 'missing/repo').fullName, 'first/repo');
});

test('ghSnapshotValid requires the normalized snapshot shape', () => {
  const snapshot = {
    version: 1,
    viewer: { login: 'EchoOtaku' },
    repositories: [],
    reviews: [],
    issues: []
  };

  assert.equal(context.ghSnapshotValid(snapshot), true);
  assert.equal(context.ghSnapshotValid({ ...snapshot, version: 2 }), false);
  assert.equal(context.ghSnapshotValid({ ...snapshot, viewer: {} }), false);
  assert.equal(context.ghSnapshotValid({ ...snapshot, repositories: null }), false);
});

test('ghIsCredentialError distinguishes credential failures', () => {
  assert.equal(context.ghIsCredentialError(new Error('HTTP 401 Unauthorized')), true);
  assert.equal(context.ghIsCredentialError(new Error('Missing credential token')), true);
  assert.equal(context.ghIsCredentialError(new Error('GitHub is temporarily unavailable')), false);
});
