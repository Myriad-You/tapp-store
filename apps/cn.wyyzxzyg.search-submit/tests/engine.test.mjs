/**
 * 引擎级单元测试：在假 Tapp 沙箱里加载 main.js，直接驱动纯函数与自动流程。
 * 覆盖：
 *   · 配置归一化与校验（含 legacy notesEnabled 迁移）
 *   · normalizeCandidate / collectUrls：同站点过滤，含「example.com.evil.test」前缀欺骗
 *   · 站内文章地址模板填充（{id}/{link}/{title}）与手账订阅源文章发现
 *   · 自动发现基线 / 增量 / 去重（首次不提交、只提交新增）
 *   · 队列冲刷与无效条目剔除
 *
 * 运行：node --test apps/cn.wyyzxzyg.search-submit/tests
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const CORE_PATH = fileURLToPath(new URL('../main.js', import.meta.url))

function plain(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value))
}

async function loadEngine({ articles = [], role = 'admin', scripts = {} } = {}) {
  const source = await readFile(CORE_PATH, 'utf8')
  const storage = new Map()
  const apiCalls = []
  const registered = new Map()
  const handlers = new Map()
  const host = { articles, role, scripts, storage, apiCalls, registered, handlers }

  const Tapp = {
    storage: {
      async get(key) {
        return storage.has(key) ? structuredClone(storage.get(key)) : null
      },
      async set(key, value) {
        storage.set(key, plain(value))
        return true
      },
    },
    user: {
      async getRole() {
        return role
      },
      async isAdmin() {
        return role === 'admin'
      },
    },
    api: async (name, params) => {
      apiCalls.push({ name, params })
      if (name === 'fetchScanSource') {
        return { success: true, data: host.scripts[params.url] ?? '' }
      }
      return { success: true, data: { success: 1, remain: 9900 } }
    },
    ui: {
      async showNotification() {},
    },
    phantasiList: {
      async list() {
        return { items: structuredClone(host.articles) }
      },
    },
    scheduler: {
      async register(task) {
        registered.set(task.taskId, task)
        return { success: true }
      },
      async unregister(taskId) {
        registered.delete(taskId)
        return { success: true }
      },
      async get(taskId) {
        return registered.get(taskId) || null
      },
      onTask(taskId, handler) {
        handlers.set(taskId, handler)
        return () => handlers.delete(taskId)
      },
    },
    lifecycle: {
      onReady() {},
    },
  }

  const sandbox = { Tapp, console, URL, setTimeout, clearTimeout }
  sandbox.window = sandbox
  sandbox.globalThis = sandbox
  createContext(sandbox)
  const result = runInContext(`${source}\n;window.SearchSubmitCore`, sandbox, { filename: 'main.js' })
  return { engine: result, Tapp, host }
}

function config(overrides) {
  return {
    provider: 'baidu',
    siteUrl: 'https://example.com',
    baiduToken: 'tok',
    indexNowKey: '',
    keyLocation: '',
    schedule: { enabled: true, type: 'interval', intervalMinutes: 360, time: '09:00', timezone: 'local', missedPolicy: 'run-once' },
    auto: { enabled: true, articlesEnabled: true, articlePathTemplate: '/journal/articles/{id}', mode: 'submit', sourcesEnabled: false, sources: [] },
    ...overrides,
  }
}

function article(id, link) {
  return { id, title: 'article ' + id, link, published_at: 1700000000000 }
}

test('normalizeConfig 收敛字段并补默认值', async () => {
  const { engine } = await loadEngine()
  const normalized = engine.normalizeConfig({
    provider: 'weird',
    siteUrl: 'https://example.com///',
    schedule: { enabled: true },
  })
  assert.equal(normalized.provider, 'baidu')
  assert.equal(normalized.siteUrl, 'https://example.com')
  assert.equal(normalized.schedule.type, 'interval')
  assert.equal(normalized.schedule.intervalMinutes, 360)
})

test('normalizeAuto 迁移 legacy notesEnabled 并保留模板', async () => {
  const { engine } = await loadEngine()
  const legacy = engine.normalizeAuto({ enabled: true, notesEnabled: false })
  assert.equal(legacy.articlesEnabled, false)
  assert.equal(legacy.articlePathTemplate, '/journal/articles/{id}')

  const custom = engine.normalizeAuto({ enabled: true, articlesEnabled: true, articlePathTemplate: '/notes/{id}' })
  assert.equal(custom.articlesEnabled, true)
  assert.equal(custom.articlePathTemplate, '/notes/{id}')

  const fresh = engine.normalizeAuto({ enabled: true })
  assert.equal(fresh.articlesEnabled, true)
})

test('configError 校验 HTTPS 与必填凭证', async () => {
  const { engine } = await loadEngine()
  assert.match(engine.configError(config({ siteUrl: 'http://example.com' })), /HTTPS/)
  assert.match(engine.configError(config({ siteUrl: 'https://example.com', baiduToken: '' })), /Token/)
  assert.match(
    engine.configError(config({ provider: 'indexnow', siteUrl: 'https://example.com', indexNowKey: 'short' })),
    /IndexNow Key/,
  )
  assert.equal(engine.configError(config()), '')
})

test('normalizeCandidate 只接受同站点 HTTPS 且剥离 hash', async () => {
  const { engine } = await loadEngine()
  assert.equal(engine.normalizeCandidate('https://example.com/', 'example.com', '/'), 'https://example.com/')
  assert.equal(engine.normalizeCandidate('/notes/1', 'example.com', '/'), 'https://example.com/notes/1')
  assert.equal(engine.normalizeCandidate('https://example.com/p#top', 'example.com', '/'), 'https://example.com/p')
  assert.equal(engine.normalizeCandidate('http://example.com/p', 'example.com', '/'), '')
  assert.equal(engine.normalizeCandidate('https://other.example/p', 'example.com', '/'), '')
  // 前缀欺骗：hostname 是 example.com.evil.test，不是 example.com
  assert.equal(engine.normalizeCandidate('https://example.com.evil.test/p', 'example.com', '/'), '')
})

test('normalizeCandidate 遵守 IndexNow Key 目录作用域', async () => {
  const { engine } = await loadEngine()
  const scoped = { siteUrl: 'https://example.com', provider: 'indexnow', keyLocation: 'https://example.com/keys/abc.txt' }
  assert.equal(engine.keyScope(scoped), '/keys/')
  assert.equal(engine.normalizeCandidate('https://example.com/keys/1', 'example.com', '/keys/'), 'https://example.com/keys/1')
  assert.equal(engine.normalizeCandidate('https://example.com/other/1', 'example.com', '/keys/'), '')
})

test('collectUrls 过滤外站并去重', async () => {
  const { engine } = await loadEngine()
  const result = engine.collectUrls(
    ['https://example.com/a', 'https://example.com/a', 'https://other.example/b', '/c'],
    config(),
  )
  assert.deepEqual(Array.from(result), ['https://example.com/a', 'https://example.com/c'])
})

test('fillArticleTemplate 填充并编码占位符', async () => {
  const { engine } = await loadEngine()
  const item = { id: 'abc 123', link: 'https://source.example/original', title: 'hello world' }
  assert.equal(engine.fillArticleTemplate('/journal/articles/{id}', item), '/journal/articles/abc%20123')
  assert.equal(engine.fillArticleTemplate('/external?link={link}', item), '/external?link=https://source.example/original')
  assert.equal(engine.fillArticleTemplate('/t/{title}', item), '/t/hello%20world')
  assert.equal(engine.fillArticleTemplate('', item), '/journal/articles/abc%20123')
})

test('discoverFromNotes 用 id 拼站内阅读页，站外原文被过滤', async () => {
  const { engine } = await loadEngine({
    articles: [
      article('a1', 'https://source.example/post/1'),
      article('a2', 'https://source.example/post/2'),
      { title: 'missing id' },
    ],
  })
  const found = await engine.discoverFromNotes(config())
  assert.deepEqual(Array.from(found.urls), ['https://example.com/journal/articles/a1', 'https://example.com/journal/articles/a2'])
  assert.equal(found.error, '')
})

test('discoverFromNotes 支持自定义模板', async () => {
  const { engine } = await loadEngine({ articles: [article('x1', 'https://source.example/p')] })
  const found = await engine.discoverFromNotes(config({ auto: { ...config().auto, articlePathTemplate: '/read/{id}' } }))
  assert.deepEqual(Array.from(found.urls), ['https://example.com/read/x1'])
})

test('自动发现：首次建基线不提交，之后只提交新增', async () => {
  const { engine, host } = await loadEngine({
    articles: [article('a1', 'https://source.example/p1'), article('a2', 'https://source.example/p2')],
  })
  // 预置配置与空去重记录（等价于用户启用后的首轮）
  await host.storage.set('search-submit.config.v1', config())
  await host.storage.set('search-submit.seen.v1', {})

  let result = await engine.runAutomation('测试')
  assert.equal(host.apiCalls.length, 0, '首轮只建基线，不应有任何提交')
  assert.ok(host.storage.has('search-submit.seen.v1'))
  const status1 = await host.storage.get('search-submit.status.v1')
  assert.equal(status1.baselineDone, true)

  // 新增一篇，第二轮只提交它
  host.articles.push(article('a3', 'https://source.example/p3'))
  result = await engine.runAutomation('测试')
  assert.equal(host.apiCalls.length, 1, '只应提交一次')
  assert.equal(host.apiCalls[0].name, 'baiduSubmit')
  assert.ok(host.apiCalls[0].params.body.includes('https://example.com/journal/articles/a3'))

  // 无新增，第三轮不提交
  host.apiCalls.length = 0
  result = await engine.runAutomation('测试')
  assert.equal(host.apiCalls.length, 0)
})

test('自动发现：collect 模式入队而不提交', async () => {
  const { engine, host } = await loadEngine({ articles: [article('c1', 'https://source.example/p')] })
  await host.storage.set('search-submit.config.v1', config({ auto: { ...config().auto, mode: 'collect' } }))
  await host.storage.set('search-submit.status.v1', { baselineDone: true })

  await engine.runAutomation('测试')
  assert.equal(host.apiCalls.length, 0)
  const queue = await host.storage.get('search-submit.queue.v1')
  assert.deepEqual(queue, ['https://example.com/journal/articles/c1'])
})

test('队列冲刷：无效条目被剔除并记录，不静默重试', async () => {
  const { engine, host } = await loadEngine()
  await host.storage.set('search-submit.config.v1', config())
  await host.storage.set('search-submit.queue.v1', [
    'https://example.com/ok',
    'https://evil.example/x',
    'http://example.com/bad',
  ])

  const result = await engine.flushQueue('测试')
  assert.equal(result.submitted, 1)
  assert.equal(result.dropped, 2)
  const queue = await host.storage.get('search-submit.queue.v1')
  assert.deepEqual(queue, [])
})

test('全部无效时清空队列且不调用 API', async () => {
  const { engine, host } = await loadEngine()
  await host.storage.set('search-submit.config.v1', config())
  await host.storage.set('search-submit.queue.v1', ['https://evil.example/x', 'http://example.com/bad'])

  const result = await engine.flushQueue('测试')
  assert.equal(result.skipped, true)
  assert.equal(host.apiCalls.length, 0)
  assert.deepEqual(await host.storage.get('search-submit.queue.v1'), [])
})

test('bootstrap 注册期望的定时任务', async () => {
  const { engine, host } = await loadEngine()
  await host.storage.set('search-submit.config.v1', config())
  await engine.bootstrap()
  const task = host.registered.get('search-submit-auto')
  assert.ok(task, '应注册 search-submit-auto 任务')
  assert.equal(task.scheduleType, 'interval')
  assert.equal(task.executionTarget, 'frontend')
  assert.equal(task.schedule.interval, 360 * 60000)
})
