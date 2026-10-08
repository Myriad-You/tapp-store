/**
 * Page 层界面冒烟测试：在 jsdom 里用真的 page.html 挂载界面，
 * 覆盖管理员 / 非管理员两条路径，以及「保存自动提交设置」的完整交互。
 *
 * 需要外部 jsdom：见 README「本地校验」。
 * 运行：JSDOM_MODULE_PATH=<dir with node_modules/jsdom> node --test <本文件>
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

const require = createRequire(import.meta.url)
const jsdomPath = process.env.JSDOM_MODULE_PATH
if (!jsdomPath) {
  throw new Error('请设置 JSDOM_MODULE_PATH 指向含 node_modules/jsdom 的目录')
}
const { JSDOM } = require(jsdomPath + '/node_modules/jsdom')

const APP = new URL('..', import.meta.url)
const CORE_SOURCE = await readFile(new URL('core.js', APP), 'utf8')
const UI_SOURCE = await readFile(new URL('page/ui.js', APP), 'utf8')
const PAGE_HTML = await readFile(new URL('page.html', APP), 'utf8')

async function boot({ role = 'admin' } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="tapp-content">${PAGE_HTML}</div></body></html>`, {
    url: 'https://myriad.example/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  })
  const { window } = dom
  const storage = new Map()
  const apiCalls = []
  const registered = new Map()
  const notifications = []
  const confirms = []
  const notes = []

  const Tapp = {
    storage: {
      async get(key) {
        return storage.has(key) ? JSON.parse(JSON.stringify(storage.get(key))) : null
      },
      async set(key, value) {
        storage.set(key, JSON.parse(JSON.stringify(value)))
        return true
      }
    },
    user: {
      async getRole() {
        return role
      },
      async isAdmin() {
        return role === 'admin'
      }
    },
    ui: {
      getTheme() {
        return 'dark'
      },
      onThemeChange() {},
      async showNotification(options) {
        notifications.push(options)
      },
      async confirm(message) {
        confirms.push(message)
        return true
      }
    },
    api: async (name, params) => {
      apiCalls.push({ name, params })
      return { success: true }
    },
    phantasiList: {
      async list() {
        return { items: notes }
      },
      async sources() {
        return []
      }
    },
    scheduler: {
      async register(task) {
        registered.set(task.taskId, task)
        return { success: true }
      },
      async unregister(taskId) {
        registered.delete(taskId)
        return true
      },
      async get(taskId) {
        return registered.get(taskId) || null
      },
      onTask() {
        return () => {}
      }
    },
    lifecycle: { onReady() {} }
  }

  window.Tapp = Tapp
  window.eval(CORE_SOURCE)
  assert.ok(window.CdnCacheCore, 'core.js 应当注册 window.CdnCacheCore')
  const core = window.CdnCacheCore
  window.eval(`${UI_SOURCE}\n;window.__ui = createUi(window.CdnCacheCore)`)
  await window.__ui.mount()

  return { dom, window, core, storage, apiCalls, registered, notifications, confirms, notes }
}

function click(window, id) {
  const node = window.document.getElementById(id)
  assert.ok(node, `缺少 #${id}`)
  node.dispatchEvent(new window.Event('click', { bubbles: true }))
}

/** 等待挂起的 promise 链跑完（界面处理器是 async 的）。 */
async function settle(times = 12) {
  for (let i = 0; i < times; i++) await new Promise((resolve) => setImmediate(resolve))
}

test('非管理员只看到只读页，不读取配置', async () => {
  const { window, storage } = await boot({ role: 'user' })
  assert.equal(window.document.getElementById('admin-ui').hidden, true)
  assert.equal(window.document.getElementById('public-ui').hidden, false)
  assert.equal(storage.size, 0, '非管理员不应写入任何存储')
})

test('管理员界面挂载后显示控制台与自动化面板', async () => {
  const { window } = await boot()
  assert.equal(window.document.getElementById('admin-ui').hidden, false)
  assert.equal(window.document.getElementById('public-ui').hidden, true)
  assert.equal(window.document.getElementById('auto-state').textContent, '已关闭')
  assert.equal(window.document.getElementById('auto-capability').textContent, '笔记与 RSS 源接口可用')
  assert.equal(window.document.getElementById('auto-plan').textContent, '未注册任何定时任务')
})

test('保存配置校验站点地址', async () => {
  const { window, notifications, storage } = await boot()
  window.document.getElementById('site-url').value = 'http://not-https.example'
  click(window, 'save-btn')
  await settle()
  assert.ok(notifications.some((item) => /HTTPS/.test(item.message)), '应提示站点地址必须是 HTTPS')
  assert.equal(storage.has('cdn-cache.config.v1'), false)
})

test('保存自动提交设置会落盘配置并注册定时任务', async () => {
  const { window, storage, registered } = await boot()
  window.document.getElementById('provider').value = 'cloudflare'
  window.document.getElementById('zone-id').value = 'zone-1'
  window.document.getElementById('cf-token').value = 'token-1'
  window.document.getElementById('site-url').value = 'https://myriad.example'
  window.document.getElementById('auto-enabled').checked = true
  window.document.getElementById('auto-interval').value = '11'
  window.document.getElementById('periodic-enabled').checked = true
  window.document.getElementById('periodic-interval').value = '45'
  window.document.getElementById('periodic-scope').value = 'list'
  window.document.getElementById('periodic-urls').value = '/\n/index.json'
  click(window, 'auto-save-btn')
  await settle(30)

  const config = storage.get('cdn-cache.config.v1')
  assert.equal(config.siteUrl, 'https://myriad.example')
  assert.equal(config.zoneId, 'zone-1')

  const auto = storage.get('cdn-cache.auto.v1')
  assert.equal(auto.enabled, true)
  assert.equal(auto.intervalMinutes, 11)
  assert.equal(auto.periodicEnabled, true)
  assert.equal(auto.periodicMinutes, 45)
  assert.equal(auto.periodicScope, 'list')
  // 固定 URL 列表原样保存；`/` 开头的路径在执行时才按站点地址展开
  assert.equal(auto.periodicManualUrls, '/\n/index.json')
  // wildcard 是「始终一起刷新」的地址，这里没填
  assert.equal(JSON.stringify(auto.wildcard), '[]')

  assert.equal(registered.size, 2)
  assert.equal(registered.get('cdn-cache-auto-refresh').schedule.interval, 11 * 60000)
  assert.equal(registered.get('cdn-cache-periodic-purge').schedule.interval, 45 * 60000)
})

test('关闭自动提交会注销定时任务', async () => {
  const { window, registered } = await boot()
  window.document.getElementById('zone-id').value = 'zone-1'
  window.document.getElementById('cf-token').value = 'token-1'
  window.document.getElementById('site-url').value = 'https://myriad.example'
  window.document.getElementById('auto-enabled').checked = true
  click(window, 'auto-save-btn')
  await settle(30)
  assert.equal(registered.size, 1)

  window.document.getElementById('auto-enabled').checked = false
  click(window, 'auto-save-btn')
  await settle(30)
  assert.equal(registered.size, 0)
})

test('始终一起刷新的地址会展开为绝对 URL 并随变更提交', async () => {
  const { window, storage, notes, apiCalls } = await boot()
  window.document.getElementById('zone-id').value = 'zone-1'
  window.document.getElementById('cf-token').value = 'token-1'
  window.document.getElementById('site-url').value = 'https://myriad.example'
  window.document.getElementById('auto-enabled').checked = true
  window.document.getElementById('auto-wildcard').value = '/\n/index.json'
  click(window, 'auto-save-btn')
  await settle(30)

  const auto = storage.get('cdn-cache.auto.v1')
  assert.equal(
    JSON.stringify(auto.wildcard),
    JSON.stringify(['https://myriad.example/', 'https://myriad.example/index.json'])
  )
  const baselineAt = storage.get('cdn-cache.record.v1').acceptedAt
  notes.push({
    id: 'n1',
    link: 'https://myriad.example/notes/n1',
    published_at: new Date(baselineAt + 60000).toISOString()
  })
  click(window, 'auto-check-btn')
  await settle(40)

  const purge = apiCalls.filter((call) => call.name === 'cloudflarePurgeUrls')
  assert.equal(purge.length, 1)
  const files = purge[0].params.files.slice().sort()
  assert.equal(
    JSON.stringify(files),
    JSON.stringify([
      'https://myriad.example/',
      'https://myriad.example/index.json',
      'https://myriad.example/notes/n1'
    ])
  )
})

test('立即核对一次会抽取新增笔记并写入队列', async () => {
  const { window, storage, notes, apiCalls } = await boot()
  window.document.getElementById('zone-id').value = 'zone-1'
  window.document.getElementById('cf-token').value = 'token-1'
  window.document.getElementById('site-url').value = 'https://myriad.example'
  window.document.getElementById('auto-enabled').checked = true
  click(window, 'auto-save-btn')
  await settle(30)

  const baselineAt = storage.get('cdn-cache.record.v1').acceptedAt
  notes.push({
    id: 'n1',
    link: 'https://myriad.example/notes/n1',
    title: 'hi',
    published_at: new Date(baselineAt + 60000).toISOString()
  })
  click(window, 'auto-check-btn')
  await settle(40)

  const enriched = apiCalls.filter((call) => call.name === 'cloudflarePurgeUrls')
  assert.equal(enriched.length, 1, '应立即核对并提交新增链接')
  assert.equal(
    JSON.stringify(enriched[0].params.files.slice().sort()),
    JSON.stringify(['https://myriad.example/', 'https://myriad.example/notes/n1'])
  )
  assert.match(window.document.getElementById('auto-check-result').textContent, /发现 2 个需刷新路径并已入队/)
  assert.equal(storage.has('cdn-cache.queue.v1'), true)
})

test('清理全站按钮走二次确认与全站清理接口', async () => {
  const { window, confirms, apiCalls } = await boot()
  window.document.getElementById('zone-id').value = 'zone-1'
  window.document.getElementById('cf-token').value = 'token-1'
  window.document.getElementById('site-url').value = 'https://myriad.example'
  window.document.getElementById('urls').value = 'https://myriad.example/a'
  click(window, 'save-btn')
  await settle()

  click(window, 'auto-all-btn')
  await settle(30)
  assert.equal(confirms.length, 1)
  assert.ok(apiCalls.some((call) => call.name === 'cloudflarePurgeAll'))
})

test('重新挂载会读回已保存的设置', async () => {
  const { window, storage } = await boot()
  window.document.getElementById('zone-id').value = 'zone-1'
  window.document.getElementById('cf-token').value = 'token-1'
  window.document.getElementById('site-url').value = 'https://myriad.example'
  window.document.getElementById('auto-enabled').checked = true
  window.document.getElementById('auto-interval').value = '13'
  click(window, 'auto-save-btn')
  await settle(30)

  const dom = new JSDOM(`<!doctype html><html><body><div id="tapp-content">${PAGE_HTML}</div></body></html>`, {
    url: 'https://myriad.example/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  })
  const win = dom.window
  const Tapp = {
    storage: {
      async get(key) {
        return storage.has(key) ? JSON.parse(JSON.stringify(storage.get(key))) : null
      },
      async set(key, value) {
        storage.set(key, JSON.parse(JSON.stringify(value)))
        return true
      }
    },
    user: { async getRole() { return 'admin' }, async isAdmin() { return true } },
    ui: { getTheme() { return 'light' }, onThemeChange() {}, async showNotification() {}, async confirm() { return true } },
    api: async () => ({ success: true }),
    phantasiList: { async list() { return { items: [] } }, async sources() { return [] } },
    scheduler: { async register() { return {} }, async unregister() { return {} }, async get() { return null }, onTask() {} },
    lifecycle: { onReady() {} }
  }
  win.Tapp = Tapp
  win.eval(CORE_SOURCE)
  win.eval(`${UI_SOURCE}\n;window.__ui = createUi(window.CdnCacheCore)`)
  await win.__ui.mount()

  assert.equal(win.document.getElementById('zone-id').value, 'zone-1')
  assert.equal(win.document.getElementById('site-url').value, 'https://myriad.example')
  assert.equal(win.document.getElementById('auto-enabled').checked, true)
  assert.equal(win.document.getElementById('auto-interval').value, '13')
  assert.equal(win.document.getElementById('auto-state').textContent, '已开启')
})
