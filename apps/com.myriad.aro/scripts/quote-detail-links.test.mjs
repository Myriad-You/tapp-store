import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const views = readFileSync(new URL('../page/views.js', import.meta.url), 'utf8')
const helpers = readFileSync(new URL('../page/helpers.js', import.meta.url), 'utf8')

function load() {
  const context = vm.createContext({
    URL,
    window: {},
    document: { baseURI: 'https://myriad.example/tapp/run/com.myriad.aro' },
    lang: {},
    require: () => ({ value() {}, live() {} }),
    attributedToLabel: () => '',
    stripHtmlPreview: value => value,
    extractNoteAttachments: () => [],
  })
  // The actual layer functions run with the same shared helper names as Aro.
  vm.runInContext(helpers, context)
  vm.runInContext(views, context)
  return context
}

test('prefers a webpage URL over the ActivityPub object id', () => {
  const c = load()
  assert.equal(c.quoteDetailUrl({ id: 'https://peer.example/objects/1', url: 'https://peer.example/@alice/1' }), 'https://peer.example/@alice/1')
  assert.equal(c.quoteDetailUrl({ url: [{ href: 'https://peer.example/post/1' }] }), 'https://peer.example/post/1')
  assert.equal(c.quoteDetailUrl({ url: 'javascript:bad', id: 'https://peer.example/objects/1' }), 'https://peer.example/objects/1')
  for (const url of ['javascript:bad', 'data:text/html,hi', 'https://user:password@peer.example/1']) {
    assert.equal(c.quoteDetailUrl({ url }), '')
  }
})

test('same-origin opening is constructed from the inherited host base URL', () => {
  const c = load()
  assert.deepEqual(JSON.parse(JSON.stringify(c.quoteDetailOpenRequest('https://myriad.example/journal/articles/1?a=1&a=2#fragment'))),
    { id: 'site', path: '/journal/articles/1?a=1&a=2' })
  assert.equal(c.quoteDetailOpenRequest('https://peer.example/notes/1'), null)
  assert.equal(c.quoteDetailOpenRequest('https://myriad.example.evil/notes/1'), null)
  c.document.baseURI = 'about:srcdoc'
  assert.equal(c.quoteDetailOpenRequest('https://myriad.example/notes/1'), null)
})

test('remote links have a working copy action instead of a sandbox popup', () => {
  const c = load()
  const remote = c.renderQuoteViewDetailHtml({ id: 'https://peer.example/objects/1', content: 'hello' }, null, 'feed')
  assert.match(remote, /data-quote-copy-link="https:\/\/peer.example\/objects\/1"/)
  assert.doesNotMatch(remote, /data-quote-open-link|target="_blank"/)
  const local = c.renderQuoteViewDetailHtml({ id: 'https://myriad.example/notes/1' }, null, 'api')
  assert.match(local, /data-quote-open-link="https:\/\/myriad.example\/notes\/1"/)
  assert.match(local, /data-quote-copy-link/)
})

test('click handlers call the host, report denied grants, and copy remote links', async () => {
  const c = load()
  const calls = []
  const failures = []
  let copied
  // Keep per-button callbacks separate, as a real dynamically rendered dialog does.
  const buttons = ['https://myriad.example/notes/1', 'https://peer.example/post/1'].map(url => ({
    getAttribute: () => url,
    addEventListener(_, fn) { this.click = fn },
  }))
  c.copyTextToClipboard = async text => { copied = text }
  c.notifyError = (title, error) => failures.push([title, error.message])
  c.Tapp = { ui: { openUrl: async request => { calls.push(JSON.parse(JSON.stringify(request))) } } }
  c.bindQuoteDetailLinks({ querySelectorAll: selector => [buttons[selector.includes('copy') ? 1 : 0]] })
  await buttons[0].click()
  assert.deepEqual(calls, [{ id: 'site', path: '/notes/1' }])
  await buttons[1].click()
  assert.equal(copied, 'https://peer.example/post/1')
  c.Tapp.ui.openUrl = async () => { throw new Error('permission denied') }
  await buttons[0].click()
  assert.deepEqual(failures, [['Could not open link', 'permission denied']])
})
