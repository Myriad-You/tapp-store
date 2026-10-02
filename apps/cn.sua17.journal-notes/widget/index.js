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
  var icon = el('span', 'jn-state-icon', kind === 'error' ? '⚠️' : '📖')
  body.appendChild(icon)
  if (kind === 'error') {
    body.appendChild(el('span', 'jn-state-title', tr(ctx.locale, 'errorTitle')))
    var retry = el('button', 'jn-state-btn', tr(ctx.locale, 'retry'))
    retry.setAttribute('type', 'button')
    retry.setAttribute('data-jn-retry', '1')
    retry.setAttribute('aria-label', tr(ctx.locale, 'retry'))
    body.appendChild(retry)
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

// --------------------------------------------
// 渲染调度
// --------------------------------------------

function paint(ctx) {
  var notes = payloadNotes(ctx.payload)
  var status = ctx.status && typeof ctx.status === 'object' ? ctx.status : null
  var hadPayload = !!ctx.payload

  if (!hadPayload) {
    if (status && status.ok === false) buildState(ctx, 'error')
    else buildSkeleton(ctx)
    return
  }
  if (!notes.length) {
    if (status && status.ok === false) buildState(ctx, 'error')
    else buildState(ctx, 'empty')
    return
  }
  if (ctx.size === '4x2') render4x2(ctx, notes)
  else if (ctx.size === '4x4') render4x4(ctx, notes)
  else render2x2(ctx, notes)

  replayOverlay(ctx, notes)
}

function maybePing(ctx) {
  var now = Date.now()
  if (ctx.lastPingAt && now - ctx.lastPingAt < PING_THROTTLE_MS) return
  var age = ctx.payload && ctx.payload.updatedAt ? now - ctx.payload.updatedAt : Infinity
  if (age < PING_STALE_MS) return
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
    var payload = await Tapp.storage.get(PAYLOAD_KEY)
    var status = await Tapp.storage.get(STATUS_KEY)
    if (ctx.seq !== seq) return
    ctx.payload = payload && typeof payload === 'object' ? payload : null
    ctx.status = status && typeof status === 'object' ? status : null
    if (ctx.payload && ctx.watchdog) {
      clearTimeout(ctx.watchdog)
      ctx.watchdog = null
    }
    paint(ctx)
    maybePing(ctx)
  } catch (error) {
    if (ctx.seq !== seq) return
    console.warn('[journal-notes] storage read failed', error)
    paint(ctx)
  }
}

function bindRoot(ctx) {
  if (/** @type {any} */ (ctx.root).__jnBound) return
  /** @type {any} */ (ctx.root).__jnBound = true

  function activateNote(target) {
    var notes = payloadNotes(ctx.payload)
    var id = target.getAttribute('data-note-id')
    for (var i = 0; i < notes.length; i++) {
      if (String(notes[i].id) === id) {
        openOverlay(ctx, notes[i])
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
      ctx.lastPingAt = 0
      maybePing(ctx)
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
        openNoteId: null,
        lastPingAt: 0,
        unsub: null,
        watchdog: null,
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

    // 首次加载看门狗：若 headless 长时间未产出缓存，转入错误态（数据到达后自动覆盖）
    if (!ctx.payload && !ctx.watchdog) {
      ctx.watchdog = setTimeout(function () {
        ctx.watchdog = null
        if (ctx.payload) return
        ctx.status = { ok: false, error: 'timeout' }
        paint(ctx)
      }, 20000)
    }

    await load(ctx)
  },
}
