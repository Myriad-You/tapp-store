/// <reference path="./types/tapp-sdk.d.ts" />
'use strict'

// ============================================
// 手账笔记 · headless 同步核心
// 运行于 headless core：拉取 Phantasi 笔记 → 写入 Tapp.storage，
// 可见 Widget 幂等读取渲染。Widget 沙箱内 phantasiList 不可用，本文件自行守卫。
// ============================================

var PAYLOAD_KEY = 'journal.notes.payload'
var STATUS_KEY = 'journal.notes.status'
var PING_KEY = 'journal.notes.ping'
var DIAG_KEY = 'journal.notes.diag'
// 安装级共享区使用同名 key：命名空间独立，但同名让 Widget 的 onChanged 监听天然覆盖
// 游客读 shared、admin 读 storage 两条路径。
var SHARED_KEY = 'journal.notes.payload'
var SYNC_TASK_ID = 'journal-notes-sync'
var PAGE_SIZE = 100
var MAX_PAGES = 5
var TITLE_MAX_CHARS = 120
var SUMMARY_MAX_CHARS = 240
var CONTENT_MAX_CHARS = 2500
var DATA_THUMB_MAX_CHARS = 4096
var PING_MIN_INTERVAL_MS = 30000

// 平台自有的媒体路径：转成站内相对地址，Widget 沙箱 CSP 才放行（仅同源 / data:）
var SITE_MEDIA_PATH =
  /^\/(?:media\/(?:assets|federation)\/|api\/media\/\d+\/content$|api\/(?:phantasi|brew)\/image-cache\/|api\/proxy\/image(?:\/|$))/
// 防盗链 CDN：走同源 /api/proxy/image（与 shared/image_proxy_hosts.json 对齐）
var PROXY_HOST_MARKERS = [
  'hdslb.com',
  'bilibili.com',
  'bgm.tv',
  'bangumi.tv',
  'chii.in',
  'steamstatic.com',
  'music.126.net',
  'y.gtimg.cn',
  'twimg.com',
  'myanimelist.net',
]
var PROXY_AKAMAI_AND = 'steam'

var syncState = {
  running: false,
  pending: false,
  lastPayloadJson: '',
  sharedJson: null,
  lastPingAt: 0,
}

function getJournalApi() {
  var api = /** @type {any} */ (Tapp).phantasiList
  if (api && typeof api.list === 'function') return api
  return null
}

// 只有 headless / page 上下文参与同步与诊断标记（Widget 沙箱执行同一份 core 入口但不干活）。
function inSyncContext() {
  try {
    var mode = typeof window !== 'undefined' ? window._TAPP_MODE : undefined
    return mode === 'core' || mode === 'page'
  } catch (e) {
    return false
  }
}

// 诊断标记：Widget 超时时读取，用于定位 headless 死在哪一步（loaded/ready/sync-start）。
function diag(stage, extra) {
  if (!inSyncContext()) return
  try {
    var record = { stage: stage, at: Date.now() }
    if (extra) {
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) record[key] = extra[key]
      }
    }
    var result = Tapp.storage.set(DIAG_KEY, record)
    if (result && typeof result.catch === 'function') result.catch(function () {})
  } catch (e) {}
}

// 仅 admin 账号同步刷新；guest / 普通 user 只读缓存（Widget 直接展示对应状态）。
async function currentRole() {
  try {
    var user = /** @type {any} */ (Tapp).user
    if (user && typeof user.getRole === 'function') {
      var role = await user.getRole()
      return typeof role === 'string' ? role : 'unknown'
    }
  } catch (e) {
    console.warn('[journal-notes] getRole failed', e)
  }
  return 'unknown'
}

function roleAllowsSync(role) {
  // 拿不到角色时放行（保持旧行为，后端仍会校验登录）
  return role !== 'guest' && role !== 'user'
}

function clamp(value, min, max) {
  var n = Number(value)
  if (!isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function truncate(text, max) {
  var s = typeof text === 'string' ? text : ''
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

function isNoteLink(link) {
  return typeof link === 'string' && link.charAt(0) === '/' && link.charAt(1) !== '/'
}

function hostMatchesDomain(host, domain) {
  var h = String(host || '').toLowerCase().replace(/\.$/, '')
  var d = String(domain || '').toLowerCase().replace(/\.$/, '')
  if (!h || !d) return false
  if (h === d) return true
  return h.length > d.length && h.slice(-(d.length + 1)) === '.' + d
}

function needsImageProxy(url, host) {
  for (var i = 0; i < PROXY_HOST_MARKERS.length; i++) {
    if (hostMatchesDomain(host, PROXY_HOST_MARKERS[i])) return true
  }
  var lower = url.toLowerCase()
  return (
    hostMatchesDomain(host, 'akamaihd.net') &&
    (host.indexOf(PROXY_AKAMAI_AND) >= 0 || lower.indexOf(PROXY_AKAMAI_AND) >= 0)
  )
}

// 规范化缩略图地址，尽量变成 Widget CSP 可放行的形式（同源相对路径 / data:）。
// 其余外部绝对地址原样保留，渲染层放行失败时用渐变占位兜底。
function resolveThumb(raw) {
  var u = typeof raw === 'string' ? raw.trim() : ''
  if (!u) return ''
  if (u.slice(0, 5) === 'data:') return u.length <= DATA_THUMB_MAX_CHARS ? u : ''
  if (u.slice(0, 2) === '//') u = 'https:' + u
  else if (u.slice(0, 7) === 'http://') u = 'https://' + u.slice(7)
  if (u.charAt(0) === '/') return u
  var m = /^https?:\/\/([^\/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(u)
  if (!m) return /^[A-Za-z0-9_][^:]*$/.test(u) ? '/' + u : ''
  var pathname = m[2] || '/'
  var search = m[3] || ''
  var hash = m[4] || ''
  var host = m[1]
    .replace(/^[^@]*@/, '')
    .replace(/:\d+$/, '')
    .toLowerCase()
    .replace(/\.$/, '')
  if (SITE_MEDIA_PATH.test(pathname)) return pathname + search + hash
  if (needsImageProxy(u, host)) return '/api/proxy/image?url=' + encodeURIComponent(u)
  return u
}

function firstImageSrc(html) {
  var m = /<img[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i.exec(String(html || ''))
  return m ? m[1] : ''
}

function toPlainText(html) {
  if (!html) return ''
  var text = String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  text = text.replace(/[ \t\u00a0]+/g, ' ')
  text = text.replace(/[ \t]*\n[ \t]*/g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

function normalizeTime(value) {
  var n = Number(value)
  if (!isFinite(n) || n <= 0) return 0
  // 秒级时间戳转毫秒
  return n < 1e12 ? Math.round(n * 1000) : Math.round(n)
}

function toNote(item) {
  var readingTime = Number(item.reading_time)
  return {
    id: String(item.id),
    title: truncate(item.title || '', TITLE_MAX_CHARS),
    link: typeof item.link === 'string' ? item.link : '',
    summary: truncate(toPlainText(item.summary || ''), SUMMARY_MAX_CHARS),
    published_at: normalizeTime(item.published_at),
    author: truncate(item.author || '', 60),
    source_name: truncate(item.source_name || '', 60),
    image: resolveThumb(item.image),
    is_read: item.is_read === true,
    is_starred: item.is_starred === true,
    reading_time: isFinite(readingTime) && readingTime > 0 ? Math.round(readingTime) : 0,
    content: '',
    contentReady: false,
  }
}

async function readSettings() {
  try {
    return (await Tapp.settings.getAll()) || {}
  } catch (error) {
    console.warn('[journal-notes] settings unavailable', error)
    return {}
  }
}

async function collectNotes(api, maxNotes) {
  var notes = []
  var seen = {}
  for (var page = 1; page <= MAX_PAGES && notes.length < maxNotes; page++) {
    var res = await api.list({ limit: PAGE_SIZE, page: page, filter: 'all' })
    var items = (res && res.items) || []
    if (!items.length) break
    for (var i = 0; i < items.length && notes.length < maxNotes; i++) {
      var item = items[i]
      if (!item || item.id == null || seen[item.id]) continue
      if (!isNoteLink(item.link)) continue
      seen[item.id] = true
      notes.push(toNote(item))
    }
    if (items.length < PAGE_SIZE) break
  }
  return notes
}

async function fillContents(api, notes, maxChars) {
  var index = 0
  async function worker() {
    while (index < notes.length) {
      var note = notes[index]
      index += 1
      if (!note) continue
      try {
        var detail = await api.get(note.id)
        if (detail) {
          if (!note.image) {
            if (detail.image) note.image = resolveThumb(detail.image)
            if (!note.image && detail.content) note.image = resolveThumb(firstImageSrc(detail.content))
          }
          if (detail.content) {
            note.content = truncate(toPlainText(detail.content), maxChars)
            note.contentReady = true
          } else if (detail.summary) {
            note.content = truncate(toPlainText(detail.summary), maxChars)
            note.contentReady = true
          }
        }
      } catch (error) {
        console.warn('[journal-notes] get failed', note.id, error)
      }
    }
  }
  var workers = []
  var poolSize = Math.min(3, Math.max(1, notes.length))
  for (var w = 0; w < poolSize; w++) workers.push(worker())
  await Promise.all(workers)
}

// 把 SDK 可能抛出的各种错误形态拍平成一行可读文本（供分类识别与界面展示）。
function errorText(error) {
  if (error == null) return ''
  if (typeof error === 'string') return error
  var parts = []
  var msg = error.message || error.error || error.msg
  if (typeof msg === 'string' && msg) parts.push(msg)
  var code = error.code != null ? error.code : error.status != null ? error.status : error.statusCode
  var resp = error.response
  var respStatus = resp ? resp.status != null ? resp.status : resp.statusCode : null
  var data = resp && resp.data != null ? resp.data : error.data
  if (code != null) parts.push(String(code))
  if (respStatus != null && String(respStatus) !== String(code)) parts.push(String(respStatus))
  if (data != null) {
    var dataText = ''
    if (typeof data === 'string') dataText = data
    else
      try {
        dataText = JSON.stringify(data)
      } catch (e) {
        dataText = ''
      }
    if (dataText) parts.push(dataText)
  }
  if (parts.length) return parts.join(' ')
  try {
    var json = JSON.stringify(error)
    if (json && json !== '{}') return json
  } catch (e) {}
  return String(error)
}

// 识别“未登录 / 未授权”类失败：游客模式下 phantasiList 会被登录校验拒绝。
// 这类失败重试无意义，交由 Widget 展示“需要登录”状态。
function classifySyncError(error) {
  var s = errorText(error)
  return /(401|403|unauthorized|forbidden|unauthenticated|not[\s-]?authenticated|credential|session|token|jwt|log(?:ged)?[\s-]?in|sign[\s-]?in|\bauth\b|guest|未登录|登录|登陆|授权|认证|会话|令牌|凭证|权限不足|游客)/i.test(s)
    ? 'auth'
    : 'error'
}

async function writeStatus(ok, error, code) {
  try {
    if (ok) {
      // 成功且此前已是成功态 → 跳过写入：任何 storage 写都会让宿主重挂载可见卡片（闪骨架），
      // 无数据变化时不应产生可见刷新。
      var prev = null
      try {
        prev = await Tapp.storage.get(STATUS_KEY)
      } catch (e) {
        prev = null
      }
      if (prev && typeof prev === 'object' && prev.ok === true) return
    }
    await Tapp.storage.set(STATUS_KEY, {
      lastSyncAt: Date.now(),
      ok: !!ok,
      code: ok ? '' : (code || 'error'),
      error: ok ? '' : truncate(errorText(error), 300),
    })
  } catch (e) {
    console.warn('[journal-notes] status write failed', e)
  }
}

// headless 重启后用缓存播种，避免首跑把相同 payload 再写一遍触发重挂载。
function seedPayloadJson() {
  try {
    var result = Tapp.storage.get(PAYLOAD_KEY)
    if (result && typeof result.then === 'function') {
      result.then(function (payload) {
        if (payload && Array.isArray(payload.notes)) {
          syncState.lastPayloadJson = JSON.stringify({ notes: payload.notes })
        }
      }).catch(function () {})
    }
  } catch (e) {}
}

// 读一次共享区当前内容做播种：升级后立刻补齐发布，且避免每次会话启动都重复写。
function primeSharedJson() {
  try {
    var result = Tapp.shared.get(SHARED_KEY)
    if (result && typeof result.then === 'function') {
      result.then(function (value) {
        if (value && Array.isArray(value.notes)) {
          syncState.sharedJson = JSON.stringify({ notes: value.notes })
        }
      }).catch(function () {})
    }
  } catch (e) {}
}

// 发布到安装级共享区：写仅 owner/admin，读对所有访客（optional_auth）开放，
// 游客/普通账号的 Widget 读这一份看到 admin 的数据。
function publishShared(payload, json) {
  try {
    var result = Tapp.shared.set(SHARED_KEY, payload)
    if (result && typeof result.then === 'function') {
      result
        .then(function () {
          syncState.sharedJson = json
        })
        .catch(function (error) {
          syncState.sharedJson = null
          console.warn('[journal-notes] shared publish failed', error)
        })
    } else {
      syncState.sharedJson = json
    }
  } catch (error) {
    syncState.sharedJson = null
    console.warn('[journal-notes] shared publish failed', error)
  }
}

async function syncNotes() {
  var api = getJournalApi()
  if (!api) return
  var role = await currentRole()
  if (!roleAllowsSync(role)) {
    diag('skip-role', { role: role })
    return
  }
  if (syncState.running) {
    syncState.pending = true
    return
  }
  syncState.running = true
  diag('sync-start', { role: role })
  try {
    var settings = await readSettings()
    var maxNotes = clamp(settings.maxNotes || 20, 1, 100)
    var fetchContent = settings.fetchContent !== false
    var contentBudget = clamp(settings.contentBudget || CONTENT_MAX_CHARS, 400, 8000)

    var notes = await collectNotes(api, maxNotes)
    if (fetchContent && notes.length) {
      await fillContents(api, notes, contentBudget)
    }

    var payload = {
      v: 1,
      updatedAt: Date.now(),
      total: notes.length,
      notes: notes,
    }
    var json = JSON.stringify({ notes: notes })
    if (json !== syncState.lastPayloadJson) {
      syncState.lastPayloadJson = json
      await Tapp.storage.set(PAYLOAD_KEY, payload)
    }
    // 同步发布安装级共享区（内容有变化才写，避免无谓重挂载）
    if (json !== syncState.sharedJson) publishShared(payload, json)
    await writeStatus(true)
  } catch (error) {
    console.warn('[journal-notes] sync failed', error)
    await writeStatus(false, error, classifySyncError(error))
  } finally {
    syncState.running = false
    if (syncState.pending) {
      syncState.pending = false
      syncNotes()
    }
  }
}

function schedulePeriodicSync() {
  var scheduler = /** @type {any} */ (Tapp).scheduler
  if (!scheduler || typeof scheduler.register !== 'function') return
  readSettings().then(function (settings) {
    var minutes = clamp(settings.syncInterval || 15, 5, 720)
    Promise.resolve(
      scheduler.register({
        taskId: SYNC_TASK_ID,
        name: '手账笔记同步',
        scheduleType: 'interval',
        schedule: { interval: minutes * 60000 },
        executionTarget: 'frontend',
      }),
    )
      .catch(function (error) {
        console.warn('[journal-notes] scheduler register failed', error)
      })
      .then(function () {
        if (typeof scheduler.onTask === 'function') {
          try {
            scheduler.onTask(SYNC_TASK_ID, function () {
              syncNotes()
            })
          } catch (error) {
            console.warn('[journal-notes] onTask failed', error)
          }
        }
      })
  })
}

function listenForWidgetPings() {
  if (typeof Tapp.storage.onChanged !== 'function') return
  try {
    Tapp.storage.onChanged(function (event) {
      if (!event || event.key !== PING_KEY) return
      var now = Date.now()
      if (now - syncState.lastPingAt < PING_MIN_INTERVAL_MS) return
      syncState.lastPingAt = now
      syncNotes()
    })
  } catch (error) {
    console.warn('[journal-notes] onChanged failed', error)
  }
}

diag('loaded')

Tapp.lifecycle.onReady(function () {
  // 只有具备 phantasiList 接口的沙箱（headless / page）才执行同步。
  if (!getJournalApi()) return
  diag('ready', { mode: typeof window !== 'undefined' ? String(window._TAPP_MODE || '') : '' })
  seedPayloadJson()
  primeSharedJson()
  syncNotes()
  schedulePeriodicSync()
  listenForWidgetPings()
})

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PAYLOAD_KEY: PAYLOAD_KEY,
    STATUS_KEY: STATUS_KEY,
    PING_KEY: PING_KEY,
  }
}
