/// <reference path="../types/tapp-sdk.d.ts" />
'use strict'

// ============================================
// 手账笔记 · Widget 渲染层
// 三种尺寸：2x2 双条速览 / 4x2 横向分区 / 4x4 笔记墙。
// 数据只读自 Tapp.storage（由 headless core 同步），渲染保持幂等。
// ============================================

var PAYLOAD_KEY = 'journal.notes.payload'
var STATUS_KEY = 'journal.notes.status'
var PING_KEY = 'journal.notes.ping'
var DIAG_KEY = 'journal.notes.diag'
var VALID_SIZES = { '2x2': 1, '4x2': 1, '4x4': 1 }
var PING_THROTTLE_MS = 30000
var PING_STALE_MS = 30 * 60 * 1000

var I18N = {
  'zh-CN': {
    title: '手账笔记',
    count: function (n) { return n + ' 篇' },
    footer: function (n) { return n + ' 篇 · 点击展开' },
    emptyTitle: '暂无笔记',
    emptyHint: '写下第一篇手账笔记',
    errorTitle: '加载失败',
    retry: '重试',
    syncing: '正在同步…',
    close: '关闭',
    noContent: '正文未同步',
    updated: function (time) { return '更新于 ' + time },
    expandHint: '点击展开全文',
    minRead: function (n) { return n + ' 分钟阅读' },
    authTitle: '需要登录',
    authHint: '游客模式无法同步手账，登录 Myriad 后点重试',
    adminTitle: '仅管理员同步',
    adminHint: '此账号为只读，请切换管理员账号',
    cacheBadge: '只读缓存',
  },
  'en-US': {
    title: 'Journal',
    count: function (n) { return n + (n === 1 ? ' note' : ' notes') },
    footer: function (n) { return n + (n === 1 ? ' note · tap to expand' : ' notes · tap to expand') },
    emptyTitle: 'No notes yet',
    emptyHint: 'Write your first journal note',
    errorTitle: 'Failed to load',
    retry: 'Retry',
    syncing: 'Syncing…',
    close: 'Close',
    noContent: 'Content not synced',
    updated: function (time) { return 'Updated ' + time },
    expandHint: 'Tap to read',
    minRead: function (n) { return n + ' min read' },
    authTitle: 'Sign in required',
    authHint: 'Guest mode cannot sync — sign in to Myriad, then retry',
    adminTitle: 'Admin sync only',
    adminHint: 'This account is read-only — switch to the admin account',
    cacheBadge: 'Read-only cache',
  },
  'ja-JP': {
    title: 'ジャーナル',
    count: function (n) { return n + '件' },
    footer: function (n) { return n + '件 · タップで展開' },
    emptyTitle: 'ノートがありません',
    emptyHint: '最初のノートを書いてみましょう',
    errorTitle: '読み込みに失敗',
    retry: '再試行',
    syncing: '同期中…',
    close: '閉じる',
    noContent: '本文は未同期',
    updated: function (time) { return time + ' 更新' },
    expandHint: 'タップで読む',
    minRead: function (n) { return n + '分で読めます' },
    authTitle: 'ログインが必要です',
    authHint: 'ゲストモードでは同期できません。Myriad にログインして再試行',
    adminTitle: '管理者のみ同期',
    adminHint: 'このアカウントは読み取り専用です。管理者アカウントに切り替えてください',
    cacheBadge: 'キャッシュのみ',
  },
}

function normalizeSize(size) {
  return VALID_SIZES[size] ? size : '2x2'
}

function normalizeLocale(locale) {
  if (typeof locale === 'string' && I18N[locale]) return locale
  if (typeof locale === 'string' && locale.indexOf('ja') === 0) return 'ja-JP'
  if (typeof locale === 'string' && locale.indexOf('en') === 0) return 'en-US'
  return 'zh-CN'
}

function dict(locale) {
  return I18N[normalizeLocale(locale)]
}

function tr(locale, key) {
  var d = dict(locale)
  var value = d[key]
  return typeof value === 'function' ? '' : value || key
}

function trFn(locale, key) {
  var value = dict(locale)[key]
  return typeof value === 'function' ? value : function () { return '' }
}

function el(tag, className, text) {
  var node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function noteTitle(note) {
  return note.title || note.source_name || note.link || '…'
}

function formatDay(ts, locale) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleDateString(locale, { month: '2-digit', day: '2-digit' })
  } catch (e) {
    return ''
  }
}

function formatStamp(ts, locale) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString(locale, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (e) {
    return formatDay(ts, locale)
  }
}

function payloadNotes(payload) {
  if (!payload || !Array.isArray(payload.notes)) return []
  return payload.notes.filter(function (note) {
    return note && (typeof note.id === 'string' || typeof note.id === 'number')
  })
}

// --------------------------------------------
// 缩略图
// --------------------------------------------

function hashHue(str) {
  var h = 5381
  var s = String(str || '')
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

// 沙箱 CSP 只放行 data: / blob: / 同源；其余地址渲染成渐变占位，不出破图。
function thumbAllowed(url) {
  if (typeof url !== 'string' || !url) return false
  if (url.charAt(0) === '/') return url.charAt(1) !== '/'
  if (url.slice(0, 5) === 'data:') return true
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch (e) {
    return false
  }
}

function buildThumb(note, variant) {
  var wrap = el('div', 'jn-thumb' + (variant ? ' ' + variant : ''))
  wrap.setAttribute('aria-hidden', 'true')
  wrap.style.setProperty('--jn-hue', String(hashHue(note.id + noteTitle(note))))
  wrap.appendChild(el('span', 'jn-thumb-letter', noteTitle(note).charAt(0) || '·'))
  var url = note.image
  if (url && thumbAllowed(url)) {
    var img = document.createElement('img')
    img.className = 'jn-thumb-img'
    img.alt = ''
    img.setAttribute('draggable', 'false')
    img.loading = 'lazy'
    img.decoding = 'async'
    img.referrerPolicy = 'no-referrer'
    img.addEventListener('load', function () {
      img.classList.add('is-on')
    })
    img.addEventListener('error', function () {
      if (img.parentNode) img.parentNode.removeChild(img)
    })
    try {
      img.src = url
    } catch (e) {
      return wrap
    }
    wrap.appendChild(img)
  }
  return wrap
}

function dateChip(note, locale) {
  if (!note.published_at) return null
  try {
    var d = new Date(note.published_at)
    var chip = el('span', 'jn-chip')
    chip.appendChild(el('b', 'jn-chip-m', String(d.getMonth() + 1).padStart(2, '0')))
    chip.appendChild(el('i', 'jn-chip-d', String(d.getDate()).padStart(2, '0')))
    return chip
  } catch (e) {
    return null
  }
}

// --------------------------------------------
// 结构
// --------------------------------------------

function ensureRoot(container, size, theme, fontScale, scale, isEditMode, primaryColor) {
  var root = container.querySelector('[data-jn-root]')
  if (!root) {
    container.innerHTML = ''
    root = document.createElement('div')
    root.setAttribute('data-jn-root', '')
    root.setAttribute('data-widget-root', 'true')
    container.appendChild(root)
  }
  root.className =
    'jn-root jn-' + size +
    (theme === 'dark' ? ' jn-theme-dark' : ' jn-theme-light') +
    (isEditMode ? ' jn-edit' : '')
  root.style.setProperty('--jn-font', String(fontScale || 1))
  root.style.setProperty('--jn-scale', String(scale || 1))
  if (typeof primaryColor === 'string' && primaryColor) {
    root.style.setProperty('--jn-primary', primaryColor)
  }
  return root
}

function buildHead(ctx, extraRight) {
  var head = el('header', 'jn-head')
  head.appendChild(el('span', 'jn-icon', '📖'))
  head.appendChild(el('span', 'jn-title', tr(ctx.locale, 'title')))
  var spacer = el('span', 'jn-head-spacer', '')
  head.appendChild(spacer)
  if (extraRight != null) head.appendChild(extraRight)
  return head
}

function buildSkeleton(ctx) {
  var root = ctx.root
  root.innerHTML = ''
  root.appendChild(buildHead(ctx, null))
  var body = el('main', 'jn-body jn-skeleton')
  if (ctx.size === '4x2') {
    var split = el('div', 'jn-split')
    var left = el('div', 'jn-sk-left')
    left.appendChild(el('div', 'jn-sk-block jn-sk-lg'))
    left.appendChild(el('div', 'jn-sk-block'))
    left.appendChild(el('div', 'jn-sk-block jn-sk-short'))
    var right = el('div', 'jn-sk-side')
    right.appendChild(el('div', 'jn-sk-block'))
    right.appendChild(el('div', 'jn-sk-block'))
    right.appendChild(el('div', 'jn-sk-block'))
    split.appendChild(left)
    split.appendChild(right)
    body.appendChild(split)
  } else {
    body.appendChild(el('div', 'jn-sk-block jn-sk-lg'))
    body.appendChild(el('div', 'jn-sk-block'))
    body.appendChild(el('div', 'jn-sk-block jn-sk-short'))
  }
  root.appendChild(body)
  if (ctx.size !== '4x2') {
    root.appendChild(el('footer', 'jn-foot', tr(ctx.locale, 'syncing')))
  }
}

function buildState(ctx, kind) {
  var root = ctx.root
  root.innerHTML = ''
  root.appendChild(buildHead(ctx, null))
  var body = el('main', 'jn-body jn-state')
  var locked = kind === 'auth' || kind === 'adminOnly'
  var iconChar = kind === 'error' ? '⚠️' : locked ? '🔒' : '📖'
  body.appendChild(el('span', 'jn-state-icon', iconChar))
  if (kind === 'error' || locked) {
    var titleKey =
      kind === 'auth' ? 'authTitle' : kind === 'adminOnly' ? 'adminTitle' : 'errorTitle'
    body.appendChild(el('span', 'jn-state-title', tr(ctx.locale, titleKey)))
    if (kind === 'auth') body.appendChild(el('span', 'jn-state-hint', tr(ctx.locale, 'authHint')))
    else if (kind === 'adminOnly')
      body.appendChild(el('span', 'jn-state-hint', tr(ctx.locale, 'adminHint')))
    else if (ctx.status && ctx.status.error) {
      var detail = String(ctx.status.error)
      if (detail.length > 160) detail = detail.slice(0, 159) + '…'
      body.appendChild(el('span', 'jn-state-detail', detail))
    }
    if (kind !== 'adminOnly') {
      var retry = el('button', 'jn-state-btn', tr(ctx.locale, 'retry'))
      retry.setAttribute('type', 'button')
      retry.setAttribute('data-jn-retry', '1')
      retry.setAttribute('aria-label', tr(ctx.locale, 'retry'))
      body.appendChild(retry)
    }
  } else {
    body.appendChild(el('span', 'jn-state-title', tr(ctx.locale, 'emptyTitle')))
    body.appendChild(el('span', 'jn-state-hint', tr(ctx.locale, 'emptyHint')))
  }
  root.appendChild(body)
  root.appendChild(el('footer', 'jn-foot', ''))
}

function noteRow(note, ctx, index) {
  var row = el('article', 'jn-note')
  row.setAttribute('data-note-id', String(note.id))
  row.setAttribute('role', 'button')
  row.setAttribute('tabindex', '0')
  row.setAttribute('aria-label', noteTitle(note))
  if (index === 0) row.classList.add('jn-note-lead')
  return row
}

function leadText(ctx, note, lines) {
  var main = el('div', 'jn-lead-main')
  main.appendChild(el('h3', 'jn-lead-title', noteTitle(note)))
  var summary = note.summary || (note.contentReady ? note.content : '')
  if (summary) {
    var p = el('p', 'jn-lead-summary', summary)
    p.style.setProperty('-webkit-line-clamp', String(lines || 3))
    main.appendChild(p)
  }
  var metaBits = []
  if (note.source_name) metaBits.push(note.source_name)
  var day = formatDay(note.published_at, ctx.locale)
  if (day) metaBits.push(day)
  if (note.is_starred) metaBits.push('★')
  if (metaBits.length) main.appendChild(el('div', 'jn-lead-meta', metaBits.join(' · ')))
  return main
}

function render2x2(ctx, notes) {
  var root = ctx.root
  root.innerHTML = ''
  var badge = el('span', 'jn-count', trFn(ctx.locale, 'count')(notes.length))
  root.appendChild(buildHead(ctx, badge))
  var body = el('main', 'jn-body')

  var lead = noteRow(notes[0], ctx, 0)
  lead.classList.add('jn-lead-card')
  if (notes[0].is_read === false) lead.classList.add('jn-unread')
  var leadRow = el('div', 'jn-lead-row')
  leadRow.appendChild(leadText(ctx, notes[0], 2))
  leadRow.appendChild(buildThumb(notes[0], 'jn-thumb-md'))
  lead.appendChild(leadRow)
  body.appendChild(lead)

  if (notes[1]) {
    body.appendChild(el('div', 'jn-divider', ''))
    var mini = noteRow(notes[1], ctx, 1)
    mini.classList.add('jn-mini')
    if (notes[1].is_read === false) mini.classList.add('jn-unread')
    mini.appendChild(el('span', 'jn-mini-title', noteTitle(notes[1])))
    var miniDay = formatDay(notes[1].published_at, ctx.locale)
    if (miniDay) mini.appendChild(el('span', 'jn-mini-date', miniDay))
    body.appendChild(mini)
  }
  root.appendChild(body)
  root.appendChild(el('footer', 'jn-foot', trFn(ctx.locale, 'footer')(notes.length)))
}

function render4x2(ctx, notes) {
  var root = ctx.root
  root.innerHTML = ''
  var badge = el('span', 'jn-count', trFn(ctx.locale, 'count')(notes.length))
  root.appendChild(buildHead(ctx, badge))
  var body = el('main', 'jn-body')
  var split = el('div', 'jn-split')

  var left = el('div', 'jn-left')
  var lead = noteRow(notes[0], ctx, 0)
  lead.classList.add('jn-lead-card', 'jn-lead-cover')
  if (notes[0].is_read === false) lead.classList.add('jn-unread')
  lead.appendChild(buildThumb(notes[0], 'jn-thumb-hero'))
  lead.appendChild(leadText(ctx, notes[0], 2))
  left.appendChild(lead)

  var right = el('div', 'jn-side')
  var rest = notes.slice(1, 4)
  rest.forEach(function (note, i) {
    var side = noteRow(note, ctx, i + 1)
    if (note.is_read === false) side.classList.add('jn-unread')
    side.appendChild(buildThumb(note, 'jn-thumb-sm'))
    var col = el('div', 'jn-side-main')
    col.appendChild(el('span', 'jn-side-title', noteTitle(note)))
    var day = formatDay(note.published_at, ctx.locale)
    if (day) col.appendChild(el('span', 'jn-side-date', day))
    side.appendChild(col)
  })
  if (!rest.length) right.classList.add('jn-side-empty')

  split.appendChild(left)
  split.appendChild(right)
  body.appendChild(split)
  root.appendChild(body)
}

function render4x4(ctx, notes) {
  var root = ctx.root
  root.innerHTML = ''
  var badge = el('span', 'jn-count', trFn(ctx.locale, 'count')(notes.length))
  root.appendChild(buildHead(ctx, badge))
  var body = el('main', 'jn-body')
  var list = el('div', 'jn-list')
  notes.slice(0, 20).forEach(function (note, i) {
    var row = noteRow(note, ctx, i)
    if (note.is_read === false) row.classList.add('jn-unread')

    var thumb = buildThumb(note, 'jn-thumb-sm')
    if (note.is_starred) thumb.appendChild(el('span', 'jn-star', '★'))
    row.appendChild(thumb)

    var main = el('div', 'jn-row-main')
    var title = el('div', 'jn-row-title')
    if (note.is_read === false) title.appendChild(el('span', 'jn-dot'))
    title.appendChild(el('span', 'jn-row-text', noteTitle(note)))
    main.appendChild(title)
    var summary = note.summary || (note.contentReady ? note.content : '')
    if (summary) main.appendChild(el('div', 'jn-row-summary', summary))
    row.appendChild(main)

    var chip = dateChip(note, ctx.locale)
    if (chip) row.appendChild(chip)
    list.appendChild(row)
  })
  body.appendChild(list)
  root.appendChild(body)
  root.appendChild(el('footer', 'jn-foot', trFn(ctx.locale, 'footer')(notes.length)))
}

// --------------------------------------------
// 全文浮层
// --------------------------------------------

function closeOverlay(ctx) {
  ctx.openNoteId = null
  var existing = ctx.root.querySelector('[data-jn-overlay]')
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing)
}

function openOverlay(ctx, note) {
  closeOverlay(ctx)
  ctx.openNoteId = note.id
  var overlay = el('div', 'jn-overlay')
  overlay.setAttribute('data-jn-overlay', '')

  var bar = el('div', 'jn-ov-bar')
  var closeBtn = el('button', 'jn-ov-close', '✕')
  closeBtn.setAttribute('type', 'button')
  closeBtn.setAttribute('data-jn-close', '1')
  closeBtn.setAttribute('aria-label', tr(ctx.locale, 'close'))
  closeBtn.setAttribute('title', tr(ctx.locale, 'close'))
  bar.appendChild(closeBtn)
  bar.appendChild(el('span', 'jn-ov-title', noteTitle(note)))
  overlay.appendChild(bar)

  overlay.appendChild(buildThumb(note, 'jn-thumb-hero'))

  var metaBits = []
  var stamp = formatStamp(note.published_at, ctx.locale)
  if (stamp) metaBits.push(stamp)
  if (note.source_name) metaBits.push(note.source_name)
  if (note.author) metaBits.push(note.author)
  if (note.reading_time) metaBits.push(trFn(ctx.locale, 'minRead')(note.reading_time))
  if (note.is_starred) metaBits.push('★')
  if (metaBits.length) overlay.appendChild(el('div', 'jn-ov-meta', metaBits.join(' · ')))

  var content = note.content || note.summary
  var body = el('div', 'jn-ov-content', content || tr(ctx.locale, 'noContent'))
  if (!content) body.classList.add('jn-ov-content-empty')
  overlay.appendChild(body)

  ctx.root.appendChild(overlay)
  requestAnimationFrame(function () {
    overlay.classList.add('jn-overlay-in')
  })
}

function replayOverlay(ctx, notes) {
  if (ctx.openNoteId == null) return
  var match = null
  for (var i = 0; i < notes.length; i++) {
    if (String(notes[i].id) === String(ctx.openNoteId)) {
      match = notes[i]
      break
    }
  }
  if (match) openOverlay(ctx, match)
  else closeOverlay(ctx)
}

// 点击笔记：命中 openUrls 白名单 → 宿主新标签打开原文（跳出框架）；否则回退浮层。
function openNote(ctx, note) {
  var link = typeof note.link === 'string' ? note.link : ''
  if (link && link.charAt(0) === '/' && link.charAt(1) !== '/') {
    openOriginal(link)
      .then(function (ok) {
        if (!ok) openOverlay(ctx, note)
      })
      .catch(function () {
        openOverlay(ctx, note)
      })
    return
  }
  openOverlay(ctx, note)
}

// srcdoc 沙箱是不透明源，location.origin 不可用；从 referrer（宿主页面地址）取本站 origin。
function siteOrigin() {
  try {
    if (document.referrer) {
      var origin = new URL(document.referrer).origin
      if (origin && origin !== 'null') return origin
    }
  } catch (e) {}
  try {
    var loc = window.location.origin
    if (loc && loc !== 'null' && loc.indexOf('http') === 0) return loc
  } catch (e) {}
  return ''
}

function parseQuery(raw) {
  var query = null
  var pairs = String(raw || '').split('&')
  for (var i = 0; i < pairs.length; i++) {
    if (!pairs[i]) continue
    if (!query) query = {}
    var eq = pairs[i].indexOf('=')
    var key = eq >= 0 ? pairs[i].slice(0, eq) : pairs[i]
    var value = eq >= 0 ? pairs[i].slice(eq + 1) : ''
    try {
      query[decodeURIComponent(key)] = decodeURIComponent(value)
    } catch (e) {
      query[key] = value
    }
  }
  return query
}

async function openOriginal(link) {
  var origin = siteOrigin()
  if (!origin) return false
  var entries = null
  try {
    if (!Tapp.ui || typeof Tapp.ui.listOpenUrls !== 'function') return false
    entries = await Tapp.ui.listOpenUrls()
  } catch (e) {
    return false
  }
  if (!Array.isArray(entries) || !entries.length) return false
  var hit = null
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i]
    if (!entry || !entry.url) continue
    try {
      if (new URL(entry.url).origin === origin) {
        hit = entry
        break
      }
    } catch (e) {}
  }
  if (!hit) return false

  var target = { id: hit.id }
  var path = link
  if (path.charAt(0) === '/') {
    var qIndex = path.indexOf('?')
    var query = qIndex >= 0 ? parseQuery(path.slice(qIndex + 1)) : null
    if (qIndex >= 0) path = path.slice(0, qIndex)
    target.path = path.replace(/^\/+/, '')
    if (query) target.query = query
  } else if (/^https?:\/\//i.test(path)) {
    var url = null
    try {
      url = new URL(path)
    } catch (e) {
      return false
    }
    if (url.origin !== origin) return false
    target.path = url.pathname.replace(/^\/+/, '')
    var uQuery = url.search ? parseQuery(url.search.slice(1)) : null
    if (uQuery) target.query = uQuery
  } else {
    return false
  }

  try {
    await Tapp.ui.openUrl(target)
    return true
  } catch (e) {
    return false
  }
}

// --------------------------------------------
// 渲染调度
// --------------------------------------------

function paint(ctx) {
  var notes = payloadNotes(ctx.payload)
  var status = ctx.status && typeof ctx.status === 'object' ? ctx.status : null
  var hadPayload = !!ctx.payload
  var isAuth = !!(status && status.ok === false && status.code === 'auth')
  var role = ctx.role

  // 非 admin：只读缓存（有缓存渲染缓存 + 角标；无缓存给对应提示），不触发任何同步
  if (role === 'guest' || role === 'user') {
    if (!notes.length) {
      buildState(ctx, role === 'guest' ? 'auth' : 'adminOnly')
      return
    }
    renderNotes(ctx, notes, true)
    return
  }

  if (!hadPayload) {
    if (isAuth) buildState(ctx, 'auth')
    else if (status && status.ok === false) buildState(ctx, 'error')
    else buildSkeleton(ctx)
    return
  }
  if (!notes.length) {
    if (isAuth) buildState(ctx, 'auth')
    else if (status && status.ok === false) buildState(ctx, 'error')
    else buildState(ctx, 'empty')
    return
  }
  renderNotes(ctx, notes, false)
}

function renderNotes(ctx, notes, readOnly) {
  if (ctx.size === '4x2') render4x2(ctx, notes)
  else if (ctx.size === '4x4') render4x4(ctx, notes)
  else render2x2(ctx, notes)
  if (readOnly) markReadOnly(ctx)
  replayOverlay(ctx, notes)
}

function markReadOnly(ctx) {
  var head = ctx.root.querySelector('.jn-head')
  if (!head || head.querySelector('[data-jn-ro]')) return
  var badge = el('span', 'jn-badge-ro', tr(ctx.locale, 'cacheBadge'))
  badge.setAttribute('data-jn-ro', '')
  head.insertBefore(badge, head.firstChild)
}

function maybePing(ctx) {
  if (ctx.role === 'guest' || ctx.role === 'user') return
  var now = Date.now()
  if (ctx.lastPingAt && now - ctx.lastPingAt < PING_THROTTLE_MS) return
  // 新鲜度取三者最大：数据更新时间 / 最近一次成功同步 / 最近一次 ping。
  // 笔记没有新内容时 payload.updatedAt 永远过期，必须把 ping 与同步结果算进去，
  // 否则每次渲染都会触发 ping → 同步 → storage 写 → 卡片重挂载的风暴。
  var fresh = 0
  if (ctx.payload && ctx.payload.updatedAt) fresh = Math.max(fresh, ctx.payload.updatedAt)
  if (ctx.status && ctx.status.lastSyncAt) fresh = Math.max(fresh, ctx.status.lastSyncAt)
  if (ctx.lastPingAt) fresh = Math.max(fresh, ctx.lastPingAt)
  if (fresh && now - fresh < PING_STALE_MS) return
  ctx.lastPingAt = now
  try {
    var result = Tapp.storage.set(PING_KEY, { t: now })
    if (result && typeof result.catch === 'function') {
      result.catch(function (error) {
        console.warn('[journal-notes] ping failed', error)
      })
    }
  } catch (error) {
    console.warn('[journal-notes] ping failed', error)
  }
}

async function load(ctx) {
  var seq = ++ctx.seq
  try {
    if (ctx.role === 'unknown') {
      try {
        var userApi = /** @type {any} */ (Tapp).user
        if (userApi && typeof userApi.getRole === 'function') {
          var role = await userApi.getRole()
          if (ctx.seq !== seq) return
          ctx.role =
            role === 'admin' || role === 'user' || role === 'guest' ? role : 'unknown'
        }
      } catch (error) {
        if (ctx.seq !== seq) return
        console.warn('[journal-notes] role read failed', error)
      }
    }
    var payload = await Tapp.storage.get(PAYLOAD_KEY)
    var status = await Tapp.storage.get(STATUS_KEY)
    if (ctx.seq !== seq) return
    ctx.payload = payload && typeof payload === 'object' ? payload : null
    ctx.status = status && typeof status === 'object' ? status : null
    // payload 或 status 任一到达都说明链路活着：挂狗（超时兜底）立即作废，
    // 真实错误/登录状态绝不能被 timeout 覆盖。
    if (ctx.payload || ctx.status) {
      if (ctx.watchdog) {
        clearTimeout(ctx.watchdog)
        ctx.watchdog = null
      }
    }
    paint(ctx)
    maybePing(ctx)
    armWatchdogFor(ctx)
  } catch (error) {
    if (ctx.seq !== seq) return
    console.warn('[journal-notes] storage read failed', error)
    paint(ctx)
    armWatchdogFor(ctx)
  }
}

function armWatchdogFor(ctx) {
  if (ctx.payload || ctx.status) return
  if (ctx.role === 'guest' || ctx.role === 'user') return
  armWatchdog(ctx, 20000)
}

function armWatchdog(ctx, delay) {
  if (ctx.watchdog) return
  ctx.watchdog = setTimeout(function () {
    ctx.watchdog = null
    if (ctx.payload || ctx.status) return
    handleTimeout(ctx)
  }, delay)
}

// 超时时读诊断标记：core 死在哪一步 + storage 是否可读，把真实原因显示在错误详情里。
async function handleTimeout(ctx) {
  if (ctx.payload || ctx.status) return
  var stage = 'none'
  var ageText = ''
  try {
    var diag = await Tapp.storage.get(DIAG_KEY)
    if (diag && typeof diag === 'object' && diag.stage) {
      stage = String(diag.stage)
      if (diag.at) {
        var secs = Math.max(0, Math.round((Date.now() - Number(diag.at)) / 1000))
        ageText = ', ' + secs + 's ago'
      }
    }
  } catch (error) {
    if (ctx.payload || ctx.status) return
    ctx.status = {
      ok: false,
      error: 'timeout (storage unavailable: ' + String((error && error.message) || error) + ')',
    }
    paint(ctx)
    return
  }
  if (stage === 'sync-start' && !ctx.watchdogExtended) {
    // core 正在同步：再宽限 40 秒，保持“正在同步”而不是误报失败
    ctx.watchdogExtended = true
    armWatchdog(ctx, 40000)
    return
  }
  if (ctx.payload || ctx.status) return
  ctx.status = { ok: false, error: 'timeout (core: ' + stage + ageText + ')' }
  paint(ctx)
}

function bindRoot(ctx) {
  if (/** @type {any} */ (ctx.root).__jnBound) return
  /** @type {any} */ (ctx.root).__jnBound = true

  function activateNote(target) {
    var notes = payloadNotes(ctx.payload)
    var id = target.getAttribute('data-note-id')
    for (var i = 0; i < notes.length; i++) {
      if (String(notes[i].id) === id) {
        openNote(ctx, notes[i])
        return true
      }
    }
    return false
  }

  ctx.root.addEventListener('click', function (event) {
    var target = event.target
    if (!target || !target.closest) return
    if (target.closest('[data-jn-close]')) {
      closeOverlay(ctx)
      return
    }
    if (target.closest('[data-jn-retry]')) {
      // 重新查角色（游客登录后点重试即可进入正常流程）
      ctx.lastPingAt = 0
      ctx.role = 'unknown'
      ctx.watchdogExtended = false
      load(ctx)
      return
    }
    var row = target.closest('[data-note-id]')
    if (row) activateNote(row)
  })

  ctx.root.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    var target = event.target
    if (!target || !target.closest) return
    var row = target.closest('[data-note-id]')
    if (!row) return
    event.preventDefault()
    activateNote(row)
  })
}

Tapp.widgets['journal-notes'] = {
  render: async function (container, props) {
    var p = props && typeof props === 'object' ? props : {}
    var anyContainer = /** @type {any} */ (container)
    var ctx = anyContainer.__jnCtx
    if (!ctx) {
      ctx = {
        seq: 0,
        payload: null,
        status: null,
        role: 'unknown',
        openNoteId: null,
        lastPingAt: 0,
        unsub: null,
        watchdog: null,
        watchdogExtended: false,
        root: null,
        size: '2x2',
        locale: 'zh-CN',
      }
      anyContainer.__jnCtx = ctx
    }
    ctx.size = normalizeSize(p.size)
    ctx.locale = normalizeLocale(p.locale)
    ctx.root = ensureRoot(container, ctx.size, p.theme, p.fontScale, p.scale, !!p.isEditMode, p.primaryColor)
    bindRoot(ctx)

    if (!ctx.unsub && Tapp.storage && typeof Tapp.storage.onChanged === 'function') {
      ctx.unsub = Tapp.storage.onChanged(function (event) {
        if (!event || (event.key !== PAYLOAD_KEY && event.key !== STATUS_KEY)) return
        load(ctx)
      })
    }

    paint(ctx)

    await load(ctx)
  },
}
