/**
 * 共享层离线测试：用假的 Tapp 沙箱跑通
 *   · 配置归一化与校验
 *   · 路径模板 / CloudFront 路径
 *   · 变更探测的基线、增量与去重
 *   · 调度注册的期望形态
 *
 * 运行：node --test apps/cn.wyyzxzyg.cdn-cache/tests
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const CORE_PATH = fileURLToPath(new URL('../core.js', import.meta.url))

/** 只保留可结构化克隆的字段，模拟宿主 storage 的 JSON 语义。 */
function plain(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value))
}

/** 用假的 Tapp 沙箱加载 core.js，返回引擎与可观测的假宿主。 */
async function loadEngine({ notes = [], sources = [], feedItems = [], role = 'admin' } = {}) {
  const source = await readFile(CORE_PATH, 'utf8')
  const storage = new Map()
  const apiCalls = []
  const registered = new Map()
  const handlers = new Map()
  const host = {
    notes,
    sources,
    feedItems,
    role,
    storage,
    apiCalls,
    registered,
    handlers
  }

  const Tapp = {
    storage: {
      async get(key) {
        return storage.has(key) ? structuredClone(storage.get(key)) : null
      },
      async set(key, value) {
        storage.set(key, plain(value))
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
    api: async (name, params) => {
      apiCalls.push({ name, params })
      return { success: true }
    },
    phantasiList: {
      async list() {
        return { items: structuredClone(host.notes) }
      },
      async sources() {
        return structuredClone(host.sources)
      }
    },
    brewList: {
      async sources() {
        return structuredClone(host.sources)
      },
      async list() {
        return { items: structuredClone(host.feedItems) }
      }
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
      }
    }
  }

  const sandbox = {
    Tapp,
    console,
    crypto,
    TextEncoder,
    URL,
    btoa,
    setTimeout,
    clearTimeout
  }
  sandbox.window = sandbox
  sandbox.globalThis = sandbox
  createContext(sandbox)
  const result = runInContext(`${source}\n;window.CdnCacheCore`, sandbox, { filename: 'core.js' })
  return { engine: result, Tapp, host }
}

function note(id, publishedAt, link) {
  return { id, title: 'note ' + id, link, published_at: publishedAt }
}

test('normalizeConfig 收敛服务商与站点地址', async () => {
  const { engine } = await loadEngine()
  const config = engine.normalizeConfig({
    provider: 'nope',
    siteUrl: 'https://example.com///',
    edgeMethod: 'weird',
    awsDistributionId: ' E123 '
  })
  assert.equal(config.provider, 'cloudflare')
  assert.equal(config.siteUrl, 'https://example.com')
  assert.equal(config.edgeMethod, 'invalidate')
  assert.equal(config.awsDistributionId, 'E123')
})

test('configError 按服务商给出必填项', async () => {
  const { engine } = await loadEngine()
  assert.match(engine.configError({ provider: 'cloudflare', siteUrl: 'http://example.com' }), /HTTPS/)
  assert.match(engine.configError({ provider: 'cloudflare', siteUrl: 'https://example.com' }), /Zone ID/)
  assert.match(
    engine.configError({ provider: 'aws', siteUrl: 'https://example.com', awsDistributionId: 'bad-id', awsAccessKeyId: 'a', awsSecretAccessKey: 'b' }),
    /Distribution ID/
  )
  assert.equal(
    engine.configError({ provider: 'aws', siteUrl: 'https://example.com', awsDistributionId: 'E123', awsAccessKeyId: 'a', awsSecretAccessKey: 'b' }),
    ''
  )
})

test('路径模板与 CloudFront 路径只保留路径与查询串', async () => {
  const { engine } = await loadEngine()
  assert.equal(engine.fillTemplate('{link}', { link: 'https://example.com/a' }), 'https://example.com/a')
  assert.equal(engine.fillTemplate('/notes/{id}', { id: '42' }), '/notes/42')
  assert.equal(engine.fillTemplate('{link}', {}), '')
  assert.equal(
    JSON.stringify(engine.cloudFrontPaths(['https://example.com/a?b=1', 'https://example.com/a?b=1', 'https://example.com/c'], false)),
    JSON.stringify(['/a?b=1', '/c'])
  )
  assert.equal(JSON.stringify(engine.cloudFrontPaths([], true)), JSON.stringify(['/*']))
})

test('首次核对只建立基线，不提交任何刷新', async () => {
  const { engine, host } = await loadEngine({
    notes: [note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')]
  })
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto(engine.normalizeAuto({ enabled: true, siteUrl: 'https://example.com' }))

  const result = await engine.evaluate({ log: true })
  assert.equal(result.count, 0)
  assert.match(result.reason, /首次运行/)
  assert.equal(host.apiCalls.length, 0)

  const record = await engine.readAll()
  assert.deepEqual(record.record.noteIds, ['1'])
})

test('新增笔记会生成 URL 并提交当前服务商接口', async () => {
  const { engine, host } = await loadEngine({
    notes: [note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')]
  })
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto(engine.normalizeAuto({ enabled: true, siteUrl: 'https://example.com' }))
  await engine.evaluate({})

  const baselineAt = (await engine.readAll()).record.acceptedAt
  host.notes = [
    note('2', new Date(baselineAt + 60000).toISOString(), 'https://example.com/notes/2'),
    note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')
  ]

  const result = await engine.evaluate({ log: true })
  assert.equal(result.count, 2, '新笔记 + 首页')
  assert.equal(
    JSON.stringify(result.paths.slice().sort()),
    JSON.stringify(['https://example.com/', 'https://example.com/notes/2'])
  )

  const purge = host.apiCalls.find((call) => call.name === 'cloudflarePurgeUrls')
  assert.ok(purge, '应当调用 cloudflarePurgeUrls')
  assert.deepEqual(purge.params.files.sort(), ['https://example.com/', 'https://example.com/notes/2'])
})

test('历史笔记补齐不会触发提交', async () => {
  const { engine, host } = await loadEngine({
    notes: [note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')]
  })
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto(engine.normalizeAuto({ enabled: true, siteUrl: 'https://example.com' }))
  await engine.evaluate({})

  host.notes = [
    note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1'),
    note('old', '2019-05-05T00:00:00Z', 'https://example.com/notes/old')
  ]
  const result = await engine.evaluate({})
  assert.equal(result.count, 0)
  assert.equal(host.apiCalls.filter((call) => call.name === 'cloudflarePurgeUrls').length, 0)
})

test('RSS 新条目触发按 URL 刷新，AWS 走路径失效', async () => {
  const { engine, host } = await loadEngine({
    sources: [{ id: 's1', name: 'Blog', items: [{ id: 'a', link: 'https://example.com/blog/a' }] }]
  })
  await engine.saveConfig({
    provider: 'aws',
    siteUrl: 'https://example.com',
    awsDistributionId: 'E123',
    awsAccessKeyId: 'AKIAEXAMPLE',
    awsSecretAccessKey: 'secret'
  })
  await engine.saveAuto(engine.normalizeAuto({ enabled: true, siteUrl: 'https://example.com' }))
  await engine.evaluate({})

  const baselineAt = (await engine.readAll()).record.acceptedAt
  host.sources = [
    {
      id: 's1',
      name: 'Blog',
      items: [
        { id: 'b', link: 'https://example.com/blog/b?utm=1&x=2', published_at: new Date(baselineAt + 60000).toISOString() },
        { id: 'a', link: 'https://example.com/blog/a' }
      ]
    }
  ]

  const result = await engine.evaluate({})
  assert.equal(result.count, 2)
  const purge = host.apiCalls.find((call) => call.name === 'awsPurge')
  assert.ok(purge, '应当调用 awsPurge')
  assert.match(purge.params.body, /<Path>\/blog\/b\?utm=1&amp;x=2<\/Path>/)
  assert.match(purge.params.body, /<Path>\/<\/Path>/)
  assert.equal(purge.params.distributionId, 'E123')
  assert.match(purge.params.authorization, /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\//)
})

test('秒精度时间戳的新笔记不会被当成历史补齐', async () => {
  const { engine, host } = await loadEngine({
    notes: [note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')]
  })
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto(engine.normalizeAuto({ enabled: true, siteUrl: 'https://example.com' }))
  await engine.evaluate({})

  // feed 只给到秒，刚刚发布的条目会换算成略早于基线的毫秒值
  const acceptedAt = (await engine.readAll()).record.acceptedAt
  host.notes = [
    note('2', new Date(Math.floor(acceptedAt / 1000) * 1000).toISOString(), 'https://example.com/notes/2'),
    note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')
  ]
  const result = await engine.evaluate({})
  assert.equal(result.count, 2, '同一秒发布的笔记也必须提交')
  assert.ok(host.apiCalls.some((call) => call.name === 'cloudflarePurgeUrls'))
})

test('缺少时间戳时靠 ID 快照识别新增', async () => {
  const { engine, host } = await loadEngine({
    notes: [{ id: '1', link: 'https://example.com/notes/1' }]
  })
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto(engine.normalizeAuto({ enabled: true, siteUrl: 'https://example.com' }))
  await engine.evaluate({})

  // 没有时间戳时，刚建立基线的窗口内不做历史补齐
  host.notes = [
    { id: '2', link: 'https://example.com/notes/2' },
    { id: '1', link: 'https://example.com/notes/1' }
  ]
  assert.equal((await engine.evaluate({})).count, 0)

  // 基线窗口过期后，ID 快照里没有的条目才算新增
  const stale = Date.now() - 7 * 60 * 60 * 1000
  const snapshot = await engine.readAll()
  await engine.saveRecord({
    noteIds: ['1'],
    itemIds: snapshot.record.itemIds,
    sourceIds: snapshot.record.sourceIds,
    acceptedAt: stale
  })
  await engine.saveAuto(Object.assign({}, snapshot.auto, { acceptedAt: stale }))
  host.notes = [
    { id: '3', link: 'https://example.com/notes/3' },
    { id: '1', link: 'https://example.com/notes/1' }
  ]
  const result = await engine.evaluate({})
  assert.equal(result.count, 2)
  assert.ok(host.apiCalls.some((call) => call.name === 'cloudflarePurgeUrls'))
})

test('队列写满时新探测到的 URL 仍会被提交，不丢最新内容', async () => {
  const { engine, host } = await loadEngine({
    notes: [note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')]
  })
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto(engine.normalizeAuto({ enabled: true, siteUrl: 'https://example.com' }))
  await engine.evaluate({})

  // 预置一条塞满容量的队列（MAX_QUEUE = 2000）
  const full = []
  for (let i = 0; i < 2000; i++) full.push('https://example.com/old/' + i)
  await engine.writeQueue({ paths: full, from: '预置' })

  const baselineAt = (await engine.readAll()).record.acceptedAt
  host.notes = [
    note('2', new Date(baselineAt + 60000).toISOString(), 'https://example.com/notes/2'),
    note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')
  ]
  const result = await engine.evaluate({ log: true })
  assert.equal(result.count, 2)

  // 队首是最新、队尾最旧；flush 从队尾取一批，因此新探测到的 URL 会排在最后被提交，
  // 绝不会因为 writeQueue 截断而静默丢失。
  const queue = await engine.readQueue()
  assert.ok(queue.paths.length <= 2000, '队列不能超过容量')
  assert.ok(queue.paths.includes('https://example.com/notes/2'), '新 URL 必须还在队列里等下一轮')

  const purge = host.apiCalls.filter((call) => call.name === 'cloudflarePurgeUrls')
  assert.equal(purge.length, 1)
  assert.equal(purge[0].params.files.length, 300)
  // 队首最旧：溢出掉的是等待最久的 old/0 与 old/1，其余最旧条目先出队
  assert.equal(purge[0].params.files[0], 'https://example.com/old/2')
  assert.equal(queue.paths[queue.paths.length - 1], 'https://example.com/')

  // 反复提交直到队列排空：新 URL 在队尾，但一定会被提交，不会被静默丢弃
  for (let i = 0; i < 12; i++) {
    await engine.flushPending(await engine.readAll().then((all) => all.config))
    if (!(await engine.readQueue()).paths.length) break
  }
  assert.equal((await engine.readQueue()).paths.length, 0, '队列应当最终排空')
  const all = host.apiCalls
    .filter((call) => call.name === 'cloudflarePurgeUrls')
    .flatMap((call) => call.params.files)
  assert.ok(all.includes('https://example.com/notes/2'), '新 URL 最终必须被提交')
})

test('站外同前缀域名不会被当成站内地址提交', async () => {
  const { engine, host } = await loadEngine({
    notes: [note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')]
  })
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto(engine.normalizeAuto({ enabled: true, siteUrl: 'https://example.com' }))
  await engine.evaluate({})

  const baselineAt = (await engine.readAll()).record.acceptedAt
  host.notes = [
    note('evil', new Date(baselineAt + 60000).toISOString(), 'https://example.com.evil.test/y'),
    note('2', new Date(baselineAt + 60000).toISOString(), 'https://example.com/notes/2'),
    note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')
  ]
  const result = await engine.evaluate({})
  assert.equal(result.count, 2)
  assert.equal(
    JSON.stringify(result.paths.slice().sort()),
    JSON.stringify(['https://example.com/', 'https://example.com/notes/2'])
  )
  const purge = host.apiCalls.find((call) => call.name === 'cloudflarePurgeUrls')
  assert.ok(!purge.params.files.some((url) => url.includes('evil.test')), '站外域名不能进同一批请求')
})

test('saveAuto 局部更新不会把 lastCheckAt 归零', async () => {
  const { engine } = await loadEngine()
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto(engine.normalizeAuto({ enabled: true, intervalMinutes: 5, siteUrl: 'https://example.com' }))
  await engine.evaluate({})
  const before = (await engine.readAll()).auto
  assert.ok(before.lastCheckAt > 0)

  // 只改一个字段的调用不能重置基线状态
  await engine.saveAuto({ enabled: true })
  const after = (await engine.readAll()).auto
  assert.equal(after.lastCheckAt, before.lastCheckAt)
  assert.equal(after.acceptedAt, before.acceptedAt)
  assert.equal(after.intervalMinutes, 5)
})

test('重复核对不会重复提交同一批 URL', async () => {  const { engine, host } = await loadEngine({
    notes: [note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')]
  })
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto(engine.normalizeAuto({ enabled: true, siteUrl: 'https://example.com' }))
  await engine.evaluate({})

  const baselineAt = (await engine.readAll()).record.acceptedAt
  host.notes = [
    note('2', new Date(baselineAt + 60000).toISOString(), 'https://example.com/notes/2'),
    note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')
  ]
  await engine.evaluate({})
  const firstRunCalls = host.apiCalls.filter((call) => call.name === 'cloudflarePurgeUrls').length

  const second = await engine.evaluate({})
  assert.equal(second.count, 0)
  assert.equal(host.apiCalls.filter((call) => call.name === 'cloudflarePurgeUrls').length, firstRunCalls)
})

test('EdgeOne 提交带 TC3 签名与规范化 JSON body', async () => {
  const { engine, host } = await loadEngine({
    notes: [note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')]
  })
  await engine.saveConfig({
    provider: 'edgeone',
    zoneId: 'zone-1',
    secretId: 'AKIDEXAMPLE',
    secretKey: 'secret-key',
    siteUrl: 'https://example.com'
  })
  await engine.saveAuto(engine.normalizeAuto({ enabled: true, siteUrl: 'https://example.com' }))
  await engine.evaluate({})

  const baselineAt = (await engine.readAll()).record.acceptedAt
  host.notes = [
    note('2', new Date(baselineAt + 60000).toISOString(), 'https://example.com/notes/2'),
    note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')
  ]
  await engine.evaluate({})

  const purge = host.apiCalls.find((call) => call.name === 'edgeOnePurgeUrls')
  assert.ok(purge, '应当调用 edgeOnePurgeUrls')
  assert.match(purge.params.authorization, /^TC3-HMAC-SHA256 Credential=AKIDEXAMPLE\//)
  assert.deepEqual(purge.params.payload.Targets, ['https://example.com/notes/2', 'https://example.com/'])
  assert.equal(purge.params.payload.Type, 'purge_url')
})

test('syncScheduler 按设置注册与注销定时任务', async () => {
  const { engine, host } = await loadEngine()
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })

  await engine.saveAuto(engine.normalizeAuto({ siteUrl: 'https://example.com' }))
  await engine.syncScheduler()
  assert.equal(host.registered.size, 0)

  await engine.saveAuto(
    engine.normalizeAuto({
      enabled: true,
      intervalMinutes: 7,
      periodicEnabled: true,
      periodicMinutes: 90,
      periodicScope: 'all',
      siteUrl: 'https://example.com'
    })
  )
  const info = await engine.syncScheduler()
  assert.equal(info.reason, 'ok')
  assert.equal(host.registered.size, 2)

  const auto = host.registered.get(engine.AUTO_TASK_ID)
  assert.equal(auto.schedule.interval, 7 * 60000)
  assert.equal(auto.executionTarget, 'frontend')
  assert.equal(auto.missedPolicy, 'run-once')

  const sweep = host.registered.get(engine.SWEEP_TASK_ID)
  assert.equal(sweep.schedule.interval, 90 * 60000)

  await engine.saveAuto(engine.normalizeAuto({ enabled: false, periodicEnabled: false, siteUrl: 'https://example.com' }))
  await engine.syncScheduler()
  assert.equal(host.registered.size, 0)
})

test('定期提交按范围提交全站清理', async () => {
  const { engine, host } = await loadEngine()
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto(
    engine.normalizeAuto({
      periodicEnabled: true,
      periodicScope: 'all',
      intervalMinutes: 5,
      siteUrl: 'https://example.com'
    })
  )
  const result = await engine.runSweep()
  assert.equal(result.ok, true)
  assert.ok(host.apiCalls.some((call) => call.name === 'cloudflarePurgeAll'))
})

test('非管理员不会注册调度任务，但仍可核对', async () => {
  const { engine, host } = await loadEngine({ role: 'user' })
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto(
    engine.normalizeAuto({ enabled: true, intervalMinutes: 5, siteUrl: 'https://example.com' })
  )
  const info = await engine.syncScheduler()
  assert.equal(info.reason, 'not-admin')
  assert.equal(host.registered.size, 0)

  const result = await engine.evaluate({})
  assert.equal(result.count, 0)
})

test('resetBaseline 清空记录并要求重新建立基线', async () => {
  const { engine, host } = await loadEngine({
    notes: [note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1')]
  })
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto(engine.normalizeAuto({ enabled: true, siteUrl: 'https://example.com' }))
  await engine.evaluate({})
  await engine.resetBaseline()

  const record = await engine.readAll()
  assert.deepEqual(record.record.noteIds, [])
  assert.equal(record.auto.lastCheckAt, 0)

  const result = await engine.evaluate({})
  assert.equal(result.count, 0)
  assert.equal(host.apiCalls.length, 0)
})

test('purgeOnStart 会补刷首次运行前的已有内容', async () => {
  const { engine, host } = await loadEngine({
    notes: [
      note('1', '2026-01-01T00:00:00Z', 'https://example.com/notes/1'),
      note('2', '2026-01-02T00:00:00Z', 'https://example.com/notes/2')
    ]
  })
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto(engine.normalizeAuto({ enabled: true, purgeOnStart: true, siteUrl: 'https://example.com' }))
  const result = await engine.evaluate({})
  assert.equal(result.count, 3)
  assert.ok(host.apiCalls.some((call) => call.name === 'cloudflarePurgeUrls'))
})

test('RSS 源列表变化只刷新一次首页并更新快照', async () => {
  const { engine, host } = await loadEngine({ sources: [{ id: 's1' }] })
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto({ enabled: true, onNotes: false, onSourceItems: false, onSourceChange: true, includeHomepage: false })
  await engine.evaluate({})
  host.sources = [{ id: 's1' }, { id: 's2' }]
  const changed = await engine.evaluate({})
  assert.equal(JSON.stringify(changed.paths), JSON.stringify(['https://example.com/']))
  assert.match((await engine.readAll()).record.sourceIds, /s1/)
  assert.match((await engine.readAll()).record.sourceIds, /s2/)
  assert.equal(host.apiCalls.filter((call) => call.name === 'cloudflarePurgeUrls').length, 1)
  assert.equal((await engine.evaluate({})).count, 0)
})

test('RSS 条目从 brewList.list 获取', async () => {
  const { engine, host } = await loadEngine({ sources: [{ id: 's1' }] })
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto({ enabled: true, onNotes: false, onSourceItems: true, onSourceChange: false })
  await engine.evaluate({})
  const acceptedAt = (await engine.readAll()).record.acceptedAt
  host.feedItems = [{ id: 'item-1', link: 'https://example.com/feed/1', published_at: new Date(acceptedAt + 1000).toISOString() }]
  const result = await engine.evaluate({})
  assert.ok(result.paths.includes('https://example.com/feed/1'))
})

test('修改间隔后重新注册任务，非管理员启动不读取私有状态', async () => {
  const { engine, host } = await loadEngine()
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto({ enabled: true, intervalMinutes: 5 })
  await engine.syncScheduler()
  await engine.saveAuto({ intervalMinutes: 10 })
  await engine.syncScheduler()
  assert.equal(host.registered.get(engine.AUTO_TASK_ID).schedule.interval, 600000)

  const guest = await loadEngine({ role: 'user' })
  const reads = []
  const originalGet = guest.Tapp.storage.get
  guest.Tapp.storage.get = async (key) => { reads.push(key); return originalGet(key) }
  await guest.engine.bootstrap()
  assert.deepEqual(reads, [])
})

test('服务商明确返回失败时不会误报提交成功', async () => {
  const { engine, Tapp } = await loadEngine()
  Tapp.api = async () => ({ success: false, errors: [] })
  await assert.rejects(
    engine.purge({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' }, ['https://example.com/a'], false, { dedupe: false }),
    /服务商返回失败/
  )
})

test('调度注册失败会向配置页面报告错误', async () => {
  const { engine, Tapp } = await loadEngine()
  await engine.saveConfig({ provider: 'cloudflare', zoneId: 'z', cfToken: 't', siteUrl: 'https://example.com' })
  await engine.saveAuto({ enabled: true })
  Tapp.scheduler.register = async () => { throw new Error('scheduler unavailable') }
  await assert.rejects(engine.syncScheduler(), /scheduler unavailable/)
})
