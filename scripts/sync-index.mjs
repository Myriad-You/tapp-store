#!/usr/bin/env node
// Align root index.json with each apps/<id>/manifest.json.
//
// Manifest is the authority for install-critical fields (id/name/version/
// description/locales/author/category/permissions/icons/theme/download map).
// Store-only merchandising (long_description, tags, featured, preview, ...) is
// preserved from the previous index entry, or bootstrapped for new apps.
//
// Usage:
//   node scripts/sync-index.mjs check     # exit 1 if index out of sync
//   node scripts/sync-index.mjs validate  # package integrity only (PR-safe)
//   node scripts/sync-index.mjs sync      # rewrite index.json
//   node scripts/sync-index.mjs report    # print alignment report (default)
//
// Options:
//   --app <id>     only process one app id
//   --json         machine-readable report on stdout
//   --prune        drop index entries whose apps/ folder is missing

import { createHash } from 'node:crypto'
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const indexPath = join(root, 'index.json')
const appsDir = join(root, 'apps')

const STORE_ONLY_KEYS = [
  'long_description',
  'tags',
  'icon',
  'icon_shell',
  'screenshots',
  'preview',
  'downloads',
  'rating',
  'featured',
  'verified',
  'created_at',
  'license',
  'homepage',
  'repository',
]

const CATEGORY_ALIASES = {
  games: 'game',
  tools: 'utility',
  music: 'media',
  notes: 'productivity',
  social_network: 'social',
}

function parseArgs(argv) {
  const args = {
    mode: 'report',
    app: null,
    json: false,
    prune: false,
  }
  const positionals = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') args.json = true
    else if (a === '--prune') args.prune = true
    else if (a === '--app') args.app = argv[++i]
    else if (a.startsWith('--app=')) args.app = a.slice('--app='.length)
    else if (a.startsWith('-')) {
      console.error(`Unknown option: ${a}`)
      process.exit(2)
    } else positionals.push(a)
  }
  if (positionals[0]) args.mode = positionals[0]
  if (!['check', 'validate', 'sync', 'report'].includes(args.mode)) {
    console.error(
      'Usage: node scripts/sync-index.mjs [check|validate|sync|report] [--app id] [--json] [--prune]',
    )
    process.exit(2)
  }
  return args
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function stableStringify(value) {
  return JSON.stringify(value, null, 2) + '\n'
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalize(value[key])
    }
    return out
  }
  return value
}

function deepEqual(a, b) {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b))
}

function fileExists(rel) {
  try {
    return statSync(join(root, rel)).isFile()
  } catch {
    return false
  }
}

function dirExists(abs) {
  try {
    return statSync(abs).isDirectory()
  } catch {
    return false
  }
}

function listAppIds() {
  return readdirSync(appsDir)
    .filter((name) => !name.startsWith('.') && dirExists(join(appsDir, name)))
    .sort()
}

function normalizeCategory(category) {
  if (typeof category !== 'string' || !category.trim()) return category
  const key = category.trim().toLowerCase()
  return CATEGORY_ALIASES[key] ?? category.trim()
}

function cleanAuthor(author) {
  if (!author || typeof author !== 'object') return { name: 'Unknown' }
  const next = { name: author.name || 'Unknown' }
  if (author.email) next.email = author.email
  if (author.url) next.url = author.url
  return next
}

function cleanLocales(locales) {
  if (!locales || typeof locales !== 'object' || Array.isArray(locales)) return undefined
  const out = {}
  for (const [lang, value] of Object.entries(locales)) {
    if (!value || typeof value !== 'object') continue
    const entry = {}
    if (typeof value.name === 'string' && value.name.trim()) entry.name = value.name
    if (typeof value.description === 'string' && value.description.trim()) {
      entry.description = value.description
    }
    if (Object.keys(entry).length) out[lang] = entry
  }
  return Object.keys(out).length ? out : undefined
}

function packageRel(appId, fileRel) {
  const cleaned = String(fileRel || '').replace(/^\/+/, '')
  return `apps/${appId}/${cleaned}`
}

function buildDownload(appId, manifest) {
  const main = (manifest.main && String(manifest.main).trim()) || 'main.js'
  // Build in a stable key order matching historical catalog entries.
  const staged = {
    manifest: packageRel(appId, 'manifest.json'),
    code: packageRel(appId, main),
    readme: null,
    styles: null,
    widget_styles: null,
    page_styles: null,
    page_template: null,
    widget_templates: null,
    i18n: null,
    page_modules: null,
  }

  if (fileExists(packageRel(appId, 'README.md'))) {
    staged.readme = packageRel(appId, 'README.md')
  }

  if (manifest.styles) staged.styles = packageRel(appId, manifest.styles)
  if (manifest.widgetStyles) staged.widget_styles = packageRel(appId, manifest.widgetStyles)

  if (manifest.pageStyles) {
    staged.page_styles = packageRel(appId, manifest.pageStyles)
  } else if (manifest.pageTemplate && manifest.styles) {
    // unified cssMode: page still needs a stylesheet path for installers that read page_styles
    staged.page_styles = packageRel(appId, manifest.styles)
  }

  if (manifest.pageTemplate) {
    staged.page_template = packageRel(appId, manifest.pageTemplate)
  }

  if (Array.isArray(manifest.widgets) && manifest.widgets.length) {
    const widgetTemplates = {}
    for (const widget of manifest.widgets) {
      if (!widget?.id || !widget.templates || typeof widget.templates !== 'object') continue
      const sizes = {}
      for (const [size, path] of Object.entries(widget.templates)) {
        if (path) sizes[size] = packageRel(appId, path)
      }
      if (Object.keys(sizes).length) widgetTemplates[widget.id] = sizes
    }
    if (Object.keys(widgetTemplates).length) staged.widget_templates = widgetTemplates
  }

  const i18nDir = join(appsDir, appId, 'i18n')
  if (dirExists(i18nDir)) {
    const i18n = {}
    // Prefer zh → en → ja then remaining sorted (historical Aro order).
    const preferred = ['zh', 'en', 'ja']
    const names = readdirSync(i18nDir).filter((n) => n.endsWith('.json'))
    const langs = names.map((n) => n.slice(0, -'.json'.length))
    const ordered = [
      ...preferred.filter((l) => langs.includes(l)),
      ...langs.filter((l) => !preferred.includes(l)).sort(),
    ]
    for (const lang of ordered) {
      i18n[lang] = packageRel(appId, `i18n/${lang}.json`)
    }
    if (Object.keys(i18n).length) staged.i18n = i18n
  }

  if (Array.isArray(manifest.pageModules) && manifest.pageModules.length) {
    const pageModules = {}
    for (const mod of manifest.pageModules) {
      const file = String(mod).replace(/^\/+/, '')
      const base = file.split('/').pop()
      pageModules[base] = packageRel(appId, file.includes('/') ? file : `page/${file}`)
    }
    staged.page_modules = pageModules
  }

  const download = {}
  for (const [key, value] of Object.entries(staged)) {
    if (value != null) download[key] = value
  }
  return download
}

function collectPackageFiles(appId, manifest, download) {
  const files = new Set()
  const add = (rel) => {
    if (rel && fileExists(rel)) files.add(rel)
  }

  const walk = (value) => {
    if (!value) return
    if (typeof value === 'string') add(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else if (typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(download)

  for (const asset of manifest.assets || []) {
    add(packageRel(appId, asset.startsWith('assets/') ? asset : `assets/${asset}`))
  }

  return [...files]
}

function computeSize(files) {
  let total = 0
  for (const rel of files) {
    try {
      total += statSync(join(root, rel)).size
    } catch {
      // ignore
    }
  }
  return total
}

function validateDownloadFiles(appId, download) {
  const missing = []
  const walk = (value, path) => {
    if (typeof value === 'string') {
      if (!fileExists(value)) missing.push(`${path}=${value}`)
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`)
    }
  }
  walk(download, 'download')
  return missing
}

function bootstrapPreview(appId, manifest) {
  const html = packageRel(appId, 'preview.html')
  if (!fileExists(html)) return undefined
  const styles = []
  if (manifest.pageStyles && fileExists(packageRel(appId, manifest.pageStyles))) {
    styles.push(packageRel(appId, manifest.pageStyles))
  } else if (manifest.styles && fileExists(packageRel(appId, manifest.styles))) {
    styles.push(packageRel(appId, manifest.styles))
  }
  if (fileExists(packageRel(appId, 'preview.css'))) {
    styles.push(packageRel(appId, 'preview.css'))
  }
  return {
    version: 1,
    type: 'snapshot',
    html,
    styles,
    viewport: { width: 1440, height: 900 },
    fit: 'cover',
    focus: { x: 0.5, y: 0.5 },
    theme: 'dark',
  }
}

/**
 * Keep merchandising preview config, but rewrite broken paths back under apps/<id>/.
 */
function sanitizePreview(appId, preview, manifest) {
  if (!preview || typeof preview !== 'object' || Array.isArray(preview)) {
    return bootstrapPreview(appId, manifest)
  }
  const next = { ...preview }
  const prefix = `apps/${appId}/`

  const fixPath = (path) => {
    if (typeof path !== 'string' || !path.trim()) return path
    if (fileExists(path)) return path
    // common typos: app/s… or missing apps/ prefix
    const base = path.split('/').pop()
    const candidates = [
      packageRel(appId, base),
      path.replace(/^app\/s/, 'apps/'),
      path.replace(/^app\//, 'apps/'),
      path.includes(appId) ? path.replace(/^.*?apps\//, 'apps/') : null,
    ].filter(Boolean)
    for (const c of candidates) {
      if (fileExists(c)) return c
    }
    if (base && fileExists(packageRel(appId, base))) return packageRel(appId, base)
    return path
  }

  if (next.html) next.html = fixPath(next.html)
  if (Array.isArray(next.styles)) next.styles = next.styles.map(fixPath)

  if (next.html && !fileExists(next.html)) {
    return bootstrapPreview(appId, manifest) || next
  }
  // ensure html stays under this app when possible
  if (typeof next.html === 'string' && !next.html.startsWith(prefix) && fileExists(packageRel(appId, 'preview.html'))) {
    next.html = packageRel(appId, 'preview.html')
  }
  return next
}

function loadManifest(appId) {
  const path = join(appsDir, appId, 'manifest.json')
  if (!existsSync(path)) {
    throw new Error(`Missing manifest: apps/${appId}/manifest.json`)
  }
  const manifest = readJson(path)
  if (!manifest.id) throw new Error(`apps/${appId}/manifest.json missing id`)
  if (manifest.id !== appId) {
    throw new Error(
      `Folder apps/${appId} does not match manifest.id "${manifest.id}"`,
    )
  }
  return manifest
}

function buildAlignedEntry(appId, previous = null) {
  const manifest = loadManifest(appId)
  const download = buildDownload(appId, manifest)
  const missing = validateDownloadFiles(appId, download)
  if (missing.length) {
    throw new Error(`${appId}: missing download targets:\n  - ${missing.join('\n  - ')}`)
  }

  const files = collectPackageFiles(appId, manifest, download)
  const size = computeSize(files)
  const now = new Date().toISOString()

  const entry = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description || '',
  }

  const locales = cleanLocales(manifest.locales)
  if (locales) entry.locales = locales

  // preserve store-only merchandising first, then overlay aligned fields
  if (previous) {
    for (const key of STORE_ONLY_KEYS) {
      if (previous[key] !== undefined) entry[key] = previous[key]
    }
    if (entry.preview) {
      entry.preview = sanitizePreview(appId, entry.preview, manifest)
    } else {
      const preview = bootstrapPreview(appId, manifest)
      if (preview) entry.preview = preview
    }
  } else {
    entry.long_description = manifest.description || ''
    entry.tags = []
    entry.screenshots = []
    entry.downloads = 0
    entry.rating = 0
    entry.featured = false
    entry.verified = false
    entry.created_at = now
    const preview = bootstrapPreview(appId, manifest)
    if (preview) entry.preview = preview
  }

  entry.author = cleanAuthor(manifest.author)
  if (manifest.license && !entry.license) entry.license = manifest.license
  if (manifest.homepage && !entry.homepage) entry.homepage = manifest.homepage
  if (manifest.repository && !entry.repository) entry.repository = manifest.repository

  // default homepage/repository for official packaging layout
  if (!entry.homepage) {
    entry.homepage = `https://github.com/Myriad-You/tapp-store/tree/main/apps/${appId}`
  }
  if (!entry.repository) {
    entry.repository = 'https://github.com/Myriad-You/tapp-store'
  }

  const rawCategory = manifest.category
  entry.category = normalizeCategory(rawCategory)
  if (rawCategory && entry.category !== rawCategory) {
    // Non-fatal: host also normalizes aliases; prefer fixing the manifest.
    console.warn(
      `  ! ${appId}: category alias "${rawCategory}" → "${entry.category}" (update manifest to the stable id)`,
    )
  }
  entry.permissions = Array.isArray(manifest.permissions) ? [...manifest.permissions] : []

  if (manifest.iconSvg) entry.icon_svg = manifest.iconSvg
  else if (previous?.icon_svg) entry.icon_svg = previous.icon_svg

  if (manifest.themeColor) entry.theme_color = manifest.themeColor
  else if (previous?.theme_color) entry.theme_color = previous.theme_color

  if (manifest.iconShell !== undefined && manifest.iconShell !== null) {
    entry.icon_shell = manifest.iconShell
  }

  entry.download = download
  entry.size = size

  if (!entry.created_at) entry.created_at = previous?.created_at || now

  const versionChanged = previous && previous.version !== entry.version
  const downloadChanged = previous && !deepEqual(previous.download, entry.download)
  if (!previous || versionChanged || downloadChanged) {
    entry.updated_at = now
  } else if (previous.updated_at) {
    entry.updated_at = previous.updated_at
  } else {
    entry.updated_at = now
  }

  // keep stable field order similar to existing catalog
  return orderEntry(entry)
}

function orderEntry(entry) {
  const order = [
    'id',
    'name',
    'version',
    'description',
    'long_description',
    'locales',
    'author',
    'license',
    'homepage',
    'repository',
    'category',
    'tags',
    'permissions',
    'icon',
    'icon_svg',
    'icon_shell',
    'theme_color',
    'screenshots',
    'preview',
    'download',
    'size',
    'downloads',
    'rating',
    'featured',
    'verified',
    'created_at',
    'updated_at',
  ]
  const out = {}
  for (const key of order) {
    if (entry[key] !== undefined) out[key] = entry[key]
  }
  for (const key of Object.keys(entry)) {
    if (!(key in out)) out[key] = entry[key]
  }
  return out
}

function diffEntry(previous, next) {
  const changes = []
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(next || {})])
  for (const key of keys) {
    if (key === 'updated_at' || key === 'size') {
      // report size separately; ignore pure timestamp noise unless other fields change
      continue
    }
    if (!deepEqual(previous?.[key], next?.[key])) {
      changes.push(key)
    }
  }
  if (previous?.size !== next?.size) changes.push('size')
  return changes
}

function buildDesiredIndex(current, { appFilter = null, prune = false } = {}) {
  const diskIds = listAppIds()
  const byId = new Map((current.apps || []).map((a) => [a.id, a]))
  const warnings = []
  const errors = []
  const reports = []

  // preserve existing order, then append new disk apps
  const orderedIds = []
  for (const app of current.apps || []) {
    if (appFilter && app.id !== appFilter) {
      orderedIds.push(app.id)
      continue
    }
    if (diskIds.includes(app.id)) orderedIds.push(app.id)
    else if (prune) {
      warnings.push(`pruned missing app folder: ${app.id}`)
    } else {
      warnings.push(`index lists ${app.id} but apps/${app.id} is missing (use --prune to drop)`)
      orderedIds.push(app.id)
    }
  }
  for (const id of diskIds) {
    if (appFilter && id !== appFilter) continue
    if (!orderedIds.includes(id)) orderedIds.push(id)
  }

  const apps = []
  for (const id of orderedIds) {
    if (appFilter && id !== appFilter) {
      const prev = byId.get(id)
      if (prev) apps.push(prev)
      continue
    }

    if (!diskIds.includes(id)) {
      const prev = byId.get(id)
      if (prev) apps.push(prev)
      continue
    }

    try {
      const previous = byId.get(id) || null
      const next = buildAlignedEntry(id, previous)
      const changes = diffEntry(previous, next)
      const status = !previous ? 'added' : changes.length ? 'updated' : 'unchanged'
      reports.push({
        id,
        status,
        changes,
        version: next.version,
        category: next.category,
        size: next.size,
      })
      apps.push(next)
    } catch (err) {
      errors.push(String(err.message || err))
      const prev = byId.get(id)
      if (prev) apps.push(prev)
    }
  }

  const nextIndex = {
    ...current,
    updated_at: new Date().toISOString(),
    apps,
  }

  // bump catalog patch version when content changes
  const contentChanged = stableStringify({ ...current, updated_at: null, version: null }) !==
    stableStringify({ ...nextIndex, updated_at: null, version: null })
  if (contentChanged) {
    nextIndex.version = bumpPatch(current.version || '0.0.0')
  }

  return { nextIndex, reports, warnings, errors, contentChanged }
}

function bumpPatch(version) {
  const parts = String(version).split('.').map((p) => Number.parseInt(p, 10))
  if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
    parts[2] += 1
    return parts.join('.')
  }
  return version
}

function appsFingerprint(index) {
  const apps = (index.apps || []).map((app) => {
    const copy = { ...app }
    delete copy.updated_at
    // size is recomputed from disk; keep it so real package growth still fails check
    return canonicalize(copy)
  })
  return createHash('sha256').update(JSON.stringify(apps)).digest('hex')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const current = readJson(indexPath)
  const { nextIndex, reports, warnings, errors, contentChanged } = buildDesiredIndex(current, {
    appFilter: args.app,
    prune: args.prune,
  })

  const changedApps = reports.filter((r) => r.status !== 'unchanged')
  const alignedNow =
    appsFingerprint(current) === appsFingerprint(nextIndex) && errors.length === 0

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          mode: args.mode,
          aligned: alignedNow,
          contentChanged,
          changedApps,
          warnings,
          errors,
          reports,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(`Catalog sync (${args.mode}) — ${reports.length} app(s) considered`)
    for (const r of reports) {
      if (r.status === 'unchanged') {
        console.log(`  · ${r.id} @ ${r.version} (ok)`)
      } else if (r.status === 'added') {
        console.log(`  + ${r.id} @ ${r.version} (new catalog entry from manifest)`)
      } else {
        console.log(`  ~ ${r.id} @ ${r.version} — align: ${r.changes.join(', ')}`)
      }
    }
    for (const w of warnings) console.warn(`  ! ${w}`)
    for (const e of errors) console.error(`  ✗ ${e}`)
    if (args.mode === 'validate') {
      if (errors.length === 0) {
        console.log('Result: all app packages are valid for catalog generation.')
        if (!alignedNow) {
          console.log(
            'Note: index.json is stale vs manifests; it will be auto-synced on merge to main.',
          )
        }
      } else {
        console.log('Result: package validation failed.')
      }
    } else if (alignedNow) {
      console.log('Result: index.json is aligned with manifests.')
    } else {
      console.log('Result: index.json needs sync (or has errors).')
    }
  }

  if (errors.length) process.exit(1)

  if (args.mode === 'validate') {
    // PR-safe: packages must be complete; index drift is OK (bot syncs on main).
    process.exit(0)
  }

  if (args.mode === 'check') {
    if (!alignedNow) {
      if (!args.json) {
        console.error('\nindex.json is out of sync with apps/<id>/manifest.json')
        console.error(
          'Maintainers: run `node scripts/sync-index.mjs sync` (or merge and let the bot run it).',
        )
        console.error('Contributors: do NOT edit index.json — only change apps/<id>/ files.')
      }
      process.exit(1)
    }
    process.exit(0)
  }

  if (args.mode === 'sync') {
    if (!contentChanged && alignedNow) {
      if (!args.json) console.log('No index.json changes written.')
      process.exit(0)
    }
    writeFileSync(indexPath, stableStringify(nextIndex))
    if (!args.json) {
      console.log(`Wrote ${relative(root, indexPath)} (catalog version ${nextIndex.version})`)
    }
    process.exit(0)
  }

  // report
  process.exit(alignedNow ? 0 : 1)
}

main()
