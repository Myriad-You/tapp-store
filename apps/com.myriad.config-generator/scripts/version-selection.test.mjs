import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGenerator } from './generator-harness.mjs';

const digest = 'a'.repeat(64);
function release(tag, images, extra = {}) {
  return { tag_name: tag, body: Object.entries(images).map(([name, version]) =>
    `- ${name}: \`docker.io/somekawahitomi/myriad-${name}:${version}\` (\`sha256:${digest}\`)`).join('\n'), ...extra };
}
const releases = [
  release('v0.8.0', { backend: 'v0.8.0', frontend: 'v0.8.0', proxy: 'v0.8.0' }),
  release('v0.7.0', { backend: 'v0.7.0', frontend: 'v0.7.0', proxy: 'v0.6.0', updater: 'v0.7.0' })
];
function setup({ github = releases, backend = ['v0.8.0'], frontend = ['v0.8.0'], proxy = ['v0.8.0'], updater = ['v0.7.0'] } = {}) {
  const { context } = loadGenerator();
  const lists = { backend, frontend, proxy, updater };
  context.Tapp.api = async (name, params) => {
    const value = name === 'githubReleases' ? github : lists[params.repo.replace('myriad-', '')];
    if (value instanceof Error) throw value;
    return name === 'githubReleases' ? value : { results: value.map(name => ({ name })) };
  };
  return context;
}
function tags(result) { return [result.myriadTag, result.proxyTag, result.updaterTag]; }

test('missing updater in latest release never borrows the main version', async () => {
  const result = await setup().resolveLatestImageTags();
  assert.deepEqual(tags(result), ['v0.8.0', 'v0.8.0', 'v0.7.0']);
  assert.equal(result.updaterDigest, digest);
});
test('Hub versions newer than release metadata win independently; old digest is not reused', async () => {
  const result = await setup({ backend: ['v0.9.0'], frontend: ['v0.9.0'], proxy: ['v0.10.0'], updater: ['v0.7.1'] }).resolveLatestImageTags();
  assert.deepEqual(tags(result), ['v0.9.0', 'v0.10.0', 'v0.7.1']);
  assert.equal(result.updaterDigest, '');
  assert.equal(result.githubConfirmed, false);
});
test('GitHub failure still selects separate stable Hub versions', async () => {
  const result = await setup({ github: new Error('GitHub unavailable') }).resolveLatestImageTags();
  assert.deepEqual(tags(result), ['v0.8.0', 'v0.8.0', 'v0.7.0']);
  assert.equal(result.updaterDigest, '');
});
test('proxy omitted from the newest release uses its own historical tag', async () => {
  const github = [release('v0.8.0', { backend: 'v0.8.0', frontend: 'v0.8.0' }), releases[1]];
  const result = await setup({ github, proxy: new Error('proxy unavailable') }).resolveLatestImageTags();
  assert.deepEqual(tags(result), ['v0.8.0', 'v0.6.0', 'v0.7.0']);
});
test('one missing main Hub response still requires evidence for both images', async () => {
  const frontend = new Error('frontend unavailable');
  const result = await setup({ backend: ['v0.9.0', 'v0.8.0'], frontend }).resolveLatestImageTags();
  assert.equal(result.myriadTag, 'v0.8.0');
  const unconfirmed = await setup({ github: [], frontend }).resolveLatestImageTags();
  assert.equal(unconfirmed.myriadTag, '');
});
test('Hub failure falls back to explicit images from historical stable releases', async () => {
  const unavailable = new Error('Hub unavailable');
  const result = await setup({ backend: unavailable, frontend: unavailable, proxy: unavailable, updater: unavailable }).resolveLatestImageTags();
  assert.deepEqual(tags(result), ['v0.8.0', 'v0.8.0', 'v0.7.0']);
  assert.equal(result.updaterDigest, digest);
  assert.equal(result.hubConfirmed, false);
});
test('automatic selection excludes floating tags, semver prereleases, drafts and marked prereleases', async () => {
  const all = ['latest', 'stable', 'preview', 'v3.0.0-rc.1', 'v2.1.0-beta.2', 'v0.7.0', 'v0.8.0'];
  const images = tag => ({ backend: tag, frontend: tag, proxy: tag, updater: tag });
  const github = [release('v9.0.0', images('v9.0.0'), { draft: true }),
    release('v8.0.0', images('v8.0.0'), { prerelease: true }),
    release('v7.0.0-rc.1', images('v7.0.0')), release('v6.0.0', images('v6.0.0-beta.1')), ...releases];
  const result = await setup({ github, backend: all, frontend: all, proxy: all, updater: all }).resolveLatestImageTags();
  assert.deepEqual(tags(result), ['v0.8.0', 'v0.8.0', 'v0.8.0']);
});
test('main uses highest stable tag present in both backend and frontend', async () => {
  const result = await setup({ github: [], backend: ['v0.10.0', 'v0.8.0'], frontend: ['v0.9.0', 'v0.8.0'] }).resolveLatestImageTags();
  assert.equal(result.myriadTag, 'v0.8.0');
  assert.equal(result.versionAligned, false);
});
test('no common main version or missing component stays unresolved without guessing', async () => {
  await assert.rejects(setup({ github: [release('v0.8.0', { backend: 'v0.8.0' })],
    backend: ['v0.8.0'], frontend: ['v0.7.0'], proxy: [], updater: [] }).resolveLatestImageTags(), /稳定版本标签/);
  const partial = await setup({ github: [releases[0]], updater: [] }).resolveLatestImageTags();
  assert.equal(partial.updaterTag, '');
  assert.equal(partial.updaterDigest, '');
});
test('all sources unavailable or only prereleases rejects automatic selection', async () => {
  await assert.rejects(setup({ github: [], backend: [], frontend: [], proxy: ['v1.0.0-rc.1'], updater: ['latest'] }).resolveLatestImageTags());
  const failure = new Error('offline');
  await assert.rejects(setup({ github: failure, backend: failure, frontend: failure, proxy: failure, updater: failure }).resolveLatestImageTags(), /offline/);
});
test('partial resolution clears previously automatic values instead of retaining a guessed version', async () => {
  const ctx = setup({ github: [releases[0]], updater: [] });
  const notifications = [];
  ctx.showNotification = (message, kind) => notifications.push({ message, kind });
  const inputs = { myriad: { value: '', dataset: {} }, proxy: { value: '', dataset: {} },
    updater: { value: 'v0.8.0', dataset: { autoFilled: 'true' } } };
  await ctx.refreshLatestTags(inputs, null, { notify: true });
  assert.equal(inputs.updater.value, '');
  assert.equal(ctx.state.updaterTag, '');
  assert.equal(ctx.tagFetchState.confirmedDigest, null);
  assert.equal(notifications[0].kind, 'error');
  assert.match(notifications[0].message, /未找到稳定版本/);
});
test('refresh retains manual tags and associates cached digest only with the resolved updater', async () => {
  const ctx = setup();
  const inputs = { myriad: { value: '', dataset: {} }, proxy: { value: 'v0.6.0', dataset: {} }, updater: { value: 'v0.7.1', dataset: {} } };
  await ctx.refreshLatestTags(inputs, null, {});
  assert.deepEqual([ctx.state.myriadTag, ctx.state.proxyTag, ctx.state.updaterTag], ['v0.8.0', 'v0.6.0', 'v0.7.1']);
  assert.equal(ctx.tagFetchState.confirmedDigest.tag, 'v0.7.0');
  await ctx.refreshLatestTags(inputs, null, { force: true });
  assert.deepEqual([ctx.state.myriadTag, ctx.state.proxyTag, ctx.state.updaterTag], ['v0.8.0', 'v0.8.0', 'v0.7.0']);
});
