#!/usr/bin/env node
// Validate static store previews.
//
// Modes:
//   (default)   every preview declared in index.json
//   --app <id>  that app: index entry, catalog.json, and/or on-disk preview.html
//   --disk      also scan apps/*/preview.html not yet in index
//   --json      machine-readable summary
//
// Usage:
//   node scripts/validate-previews.mjs
//   node scripts/validate-previews.mjs --app com.example.app
//   node scripts/validate-previews.mjs --disk

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const blockedHtml = /<(?:script|iframe|frame|object|embed|portal|base|link|form)\b/i
const remoteCss = /@import\b|url\(\s*['"]?https?:/i

function parseArgs(argv) {
  const args = { app: null, disk: false, json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') args.json = true
    else if (a === '--disk') args.disk = true
    else if (a === '--app') args.app = argv[++i]
    else if (a.startsWith('--app=')) args.app = a.slice('--app='.length)
    else {
      console.error('Usage: node scripts/validate-previews.mjs [--app id] [--disk] [--json]')
      process.exit(2)
    }
  }
  return args
}

function fail(appId, message) {
  throw new Error(appId + ': ' + message)
}

async function checkedFile(appId, path, kind) {
  if (typeof path !== 'string' || !path.trim()) fail(appId, kind + ' path is required')
  const target = resolve(root, path)
  const rel = relative(root, target)
  if (rel.startsWith('..') || rel.includes('/../')) fail(appId, kind + ' escapes catalog root')
  const info = await stat(target)
  if (!info.isFile()) fail(appId, kind + ' is not a file: ' + path)
  if (info.size > 512 * 1024) fail(appId, kind + ' exceeds 512 KiB: ' + path)
  return readFile(target, 'utf8')
}

async function validatePreviewObject(appId, preview) {
  if (preview == null) return false
  if (typeof preview !== 'object' || Array.isArray(preview)) fail(appId, 'preview must be an object')
  if (preview.version !== 1) fail(appId, 'preview.version must be 1')
  if (preview.type !== 'snapshot') fail(appId, 'preview.type must be snapshot')
  if (!['cover', 'contain'].includes(preview.fit ?? 'cover')) fail(appId, 'invalid preview.fit')
  if (!['auto', 'light', 'dark'].includes(preview.theme ?? 'auto')) fail(appId, 'invalid preview.theme')

  const width = preview.viewport?.width ?? 1280
  const height = preview.viewport?.height ?? 720
  if (!Number.isInteger(width) || width < 1280 || width > 3840) fail(appId, 'viewport.width must be 1280..3840')
  if (!Number.isInteger(height) || height < 720 || height > 2160) fail(appId, 'viewport.height must be 720..2160')
  for (const axis of ['x', 'y']) {
    const value = preview.focus?.[axis] ?? 0.5
    if (typeof value !== 'number' || value < 0 || value > 1) fail(appId, 'focus.' + axis + ' must be 0..1')
  }

  const html = await checkedFile(appId, preview.html, 'preview HTML')
  if (blockedHtml.test(html)) fail(appId, 'preview HTML contains executable or embedded content')
  const styles = preview.styles ?? []
  if (!Array.isArray(styles) || styles.length > 8) fail(appId, 'preview.styles must contain at most 8 paths')
  for (const path of styles) {
    const css = await checkedFile(appId, path, 'preview stylesheet')
    if (remoteCss.test(css)) fail(appId, 'preview stylesheet may not load remote resources: ' + path)
  }
  return true
}

function packageRel(appId, file) {
  return `apps/${appId}/${file}`
}

function bootstrapFromDisk(appId) {
  const html = packageRel(appId, 'preview.html')
  if (!existsSync(join(root, html))) return null
  const styles = []
  for (const candidate of ['page.css', 'styles.css', 'preview.css']) {
    const rel = packageRel(appId, candidate)
    if (existsSync(join(root, rel))) styles.push(rel)
  }
  return {
    version: 1,
    type: 'snapshot',
    html,
    styles: [...new Set(styles)],
    viewport: { width: 1440, height: 900 },
    fit: 'cover',
    focus: { x: 0.5, y: 0.5 },
    theme: 'dark',
  }
}

function loadCatalogPreview(appId) {
  const catalogPath = join(root, 'apps', appId, 'catalog.json')
  if (!existsSync(catalogPath)) return null
  try {
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
    if (!catalog.preview) return null
    const preview = { ...catalog.preview }
    const fix = (p) => {
      if (typeof p !== 'string') return p
      if (p.startsWith('apps/')) return p
      return packageRel(appId, p.replace(/^\.\//, ''))
    }
    if (preview.html) preview.html = fix(preview.html)
    if (Array.isArray(preview.styles)) preview.styles = preview.styles.map(fix)
    return preview
  } catch {
    return null
  }
}

function pushTarget(targets, appId, preview, source) {
  if (!preview) return
  targets.push({ appId, preview, source })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const index = JSON.parse(await readFile(resolve(root, 'index.json'), 'utf8'))
  const byId = new Map((index.apps || []).map((a) => [a.id, a]))
  const targets = []

  if (args.app) {
    const entry = byId.get(args.app)
    if (entry?.preview) pushTarget(targets, args.app, entry.preview, 'index')
    pushTarget(targets, args.app, loadCatalogPreview(args.app), 'catalog.json')
    const disk = bootstrapFromDisk(args.app)
    if (disk) pushTarget(targets, args.app, disk, 'disk')
  } else {
    for (const app of index.apps || []) {
      if (app.preview) pushTarget(targets, app.id, app.preview, 'index')
    }
    if (args.disk) {
      for (const name of readdirSync(join(root, 'apps'))) {
        const dir = join(root, 'apps', name)
        try {
          if (!statSync(dir).isDirectory()) continue
        } catch {
          continue
        }
        if (byId.get(name)?.preview) continue
        const fromCatalog = loadCatalogPreview(name)
        if (fromCatalog) {
          pushTarget(targets, name, fromCatalog, 'catalog.json')
          continue
        }
        const fromDisk = bootstrapFromDisk(name)
        if (fromDisk) pushTarget(targets, name, fromDisk, 'disk')
      }
    }
  }

  const seen = new Set()
  const unique = []
  for (const t of targets) {
    const key = `${t.appId}|${t.preview?.html || ''}|${t.source}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(t)
  }

  let count = 0
  const errors = []
  for (const t of unique) {
    try {
      if (await validatePreviewObject(t.appId, t.preview)) count += 1
    } catch (err) {
      errors.push(String(err.message || err))
    }
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          count,
          errors,
          targets: unique.map((t) => ({ appId: t.appId, source: t.source })),
        },
        null,
        2,
      ),
    )
  } else if (errors.length) {
    for (const e of errors) console.error(e)
  } else {
    console.log(
      'Validated ' +
        count +
        ' static Tapp preview' +
        (count === 1 ? '' : 's') +
        (args.app ? ` for ${args.app}` : '') +
        '.',
    )
  }

  if (errors.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
