import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mainPath = resolve(appRoot, 'main.js')
const marker = '  if (window._TAPP_MODE === "page" || window._TAPP_HAS_HTML) {'
let source = await readFile(mainPath, 'utf8')
const manifest = JSON.parse(await readFile(resolve(appRoot, 'manifest.json'), 'utf8'))

assert.ok(source.includes(marker), 'Unable to expose matcher functions from main.js')
source = source.replace(
  marker,
  '  globalThis.__radarMatcher = { buildOpml: buildOpml, canPreviewInstance: canPreviewInstance, normalizeInputUrl: normalizeInputUrl, matchUrl: matchUrl, isCloudflareChallenge: isCloudflareChallenge, previewFailureKind: previewFailureKind, previewFeed: previewFeed, setInstance: function (value) { state.instance = normalizeInstance(value); } };\n\n' + marker,
)

let apiCalls = 0
let lastApiParams = null
const sandbox = {
  URL,
  TextDecoder,
  clearTimeout,
  console,
  document: {
    querySelector() { return null },
    querySelectorAll() { return [] },
  },
  setTimeout,
  Tapp: {
    async api(_name, params) {
      apiCalls += 1
      lastApiParams = params
      return ''
    },
    assets: {
      async getArrayBuffer(assetPath) {
        const bytes = await readFile(resolve(appRoot, assetPath))
        return { buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
      },
    },
    lifecycle: {
      onDestroy() {},
      onReady() {},
    },
  },
  window: {
    _TAPP_HAS_HTML: false,
    _TAPP_MODE: 'test',
  },
}

vm.createContext(sandbox)
vm.runInContext(source, sandbox, { filename: mainPath })

const { buildOpml, canPreviewInstance, isCloudflareChallenge, matchUrl, normalizeInputUrl, previewFailureKind, previewFeed, setInstance } = sandbox.__radarMatcher
assert.ok(isCloudflareChallenge("HTTP 403 Just a moment..."), 'Cloudflare challenge was not detected')
assert.ok(!isCloudflareChallenge("<rss><channel><title>Feed</title></channel></rss>"), 'Valid RSS was misclassified as a challenge')
assert.ok(!isCloudflareChallenge("<?xml version=\"1.0\"?><rss><channel><title>Cloudflare status</title></channel></rss>"), 'RSS mentioning Cloudflare was misclassified as a challenge')
assert.ok(!isCloudflareChallenge("Cloudflare published a normal status update"), 'A lone Cloudflare mention was misclassified as a challenge')
assert.equal(previewFailureKind('request timed out'), 'timeout')
assert.equal(previewFailureKind('返回内容不是有效的 RSS 或 Atom'), 'invalid')
assert.equal(canPreviewInstance('https://rsshub.app/'), true)
assert.equal(canPreviewInstance('https://rsshub.example.com'), false)
assert.equal(manifest.apis.previewFeed.endpoint, 'https://rsshub.app/{{params.path}}')
for (const path of ['.evil.com/x', '@evil.com/x', '//evil.com/x']) {
  const expanded = manifest.apis.previewFeed.endpoint.replace('{{params.path}}', path)
  assert.equal(new URL(expanded).origin, 'https://rsshub.app', `Preview endpoint escaped origin for ${path}`)
}

const opml = buildOpml([{ path: '/example/feed', title: 'A & B', siteName: 'Example', sourceUrl: 'https://example.com/?a=1&b=2' }])
assert.match(opml, /text="A &amp; B"/)
assert.match(opml, /xmlUrl="https:\/\/rsshub\.app\/example\/feed"/)
assert.match(opml, /htmlUrl="https:\/\/example\.com\/\?a=1&amp;b=2"/)

setInstance('https://rsshub.app')
await previewFeed({ path: '/github/topic/rsshub' })
assert.equal(apiCalls, 1, 'Official preview did not call the declared API')
assert.equal(lastApiParams.path, 'github/topic/rsshub', 'Preview API path retained a leading slash')

setInstance('https://rsshub.example.com')
await previewFeed({ path: '/example/feed' })
assert.equal(apiCalls, 1, 'Custom instance preview silently called the fixed rsshub.app API')
const cases = [
  {
    url: 'https://github.com/DIYgod/RSSHub',
    expectedPath: '/github/branches/DIYgod/RSSHub',
    rejectedPath: '/github/comments/DIYgod/RSSHub',
  },
  {
    url: 'https://space.bilibili.com/2267573',
    expectedPath: '/bilibili/user/article/2267573',
  },
  {
    url: 'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',
    expectedPath: '/youtube/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',
  },
  {
    url: 'https://github.com/DIYgod/RSSHub/blob/master/docs/guide.md',
    expectedPath: '/github/file/DIYgod/RSSHub/master/docs/guide.md',
  },
]

for (const testCase of cases) {
  const matched = await matchUrl(normalizeInputUrl(testCase.url))
  const paths = matched.results.map((result) => result.path).filter(Boolean)
  assert.ok(paths.includes(testCase.expectedPath), `${testCase.url} did not produce ${testCase.expectedPath}`)
  if (testCase.rejectedPath) {
    assert.ok(!paths.includes(testCase.rejectedPath), `${testCase.url} produced invalid route ${testCase.rejectedPath}`)
  }
  console.log(`${testCase.url} -> ${testCase.expectedPath} (${paths.length} direct routes)`)
}
