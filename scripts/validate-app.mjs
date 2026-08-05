#!/usr/bin/env node
// Validate one (or all) store apps beyond download-map existence:
//   - stable category IDs (no aliases)
//   - catalog.json shape (optional merchandising)
//   - elevated permissions require catalog.securityReview or com.myriad.* 
//   - no junk files in package tree
//   - package size soft/hard limits
//
// Usage:
//   node scripts/validate-app.mjs [--app <id>] [--json]
//   node scripts/validate-app.mjs --all

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appsDir = join(root, 'apps')

const STABLE_CATEGORIES = new Set([
  'ai',
  'data',
  'developer',
  'game',
  'media',
  'productivity',
  'social',
  'utility',
])

const CATEGORY_ALIASES = {
  games: 'game',
  tools: 'utility',
  music: 'media',
  notes: 'productivity',
  social_network: 'social',
}

/** Permissions that need explicit security review for third-party apps. */
const ELEVATED_PERMISSIONS = [
  'federation:read',
  'federation:write',
  'federation:message',
  'federation:files',
  'tappList:manage',
  'brew:read',
  'brew:write',
  'report:read',
  'report:write',
  'platform:read',
  'platform:write',
  'admin',
]

const CATALOG_ALLOWED_KEYS = new Set([
  'long_description',
  'tags',
  'icon',
  'icon_shell',
  'screenshots',
  'preview',
  'featured',
  'verified',
  'license',
  'homepage',
  'repository',
  'securityReview',
  'security_review',
])

const JUNK_NAME = /^(?:\.DS_Store|Thumbs\.db|\.env.*)$/i
const MAX_PACKAGE_BYTES = 50 * 1024 * 1024 // 50 MiB hard
const WARN_PACKAGE_BYTES = 15 * 1024 * 1024 // 15 MiB soft

function parseArgs(argv) {
  const args = { app: null, all: false, json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') args.json = true
    else if (a === '--all') args.all = true
    else if (a === '--app') args.app = argv[++i]
    else if (a.startsWith('--app=')) args.app = a.slice('--app='.length)
    else if (!a.startsWith('-') && !args.app) args.app = a
    else {
      console.error('Usage: node scripts/validate-app.mjs [--app id | --all] [--json]')
      process.exit(2)
    }
  }
  if (!args.app && !args.all) args.all = true
  return args
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function listAppIds() {
  return readdirSync(appsDir)
    .filter((name) => {
      try {
        return statSync(join(appsDir, name)).isDirectory() && !name.startsWith('.')
      } catch {
        return false
      }
    })
    .sort()
}

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const abs = join(dir, name)
    const st = statSync(abs)
    if (st.isDirectory()) walkFiles(abs, out)
    else out.push(abs)
  }
  return out
}

function isOfficial(appId) {
  return appId === 'com.myriad' || appId.startsWith('com.myriad.')
}

function validateCatalogJson(appId, catalog, errors, warnings) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    errors.push(`${appId}: catalog.json must be a JSON object`)
    return
  }
  for (const key of Object.keys(catalog)) {
    if (!CATALOG_ALLOWED_KEYS.has(key)) {
      errors.push(`${appId}: catalog.json unknown key "${key}"`)
    }
  }
  if (catalog.tags !== undefined) {
    if (!Array.isArray(catalog.tags) || catalog.tags.some((t) => typeof t !== 'string')) {
      errors.push(`${appId}: catalog.tags must be string[]`)
    } else if (catalog.tags.length > 32) {
      errors.push(`${appId}: catalog.tags accepts at most 32 entries`)
    }
  }
  if (catalog.long_description !== undefined && typeof catalog.long_description !== 'string') {
    errors.push(`${appId}: catalog.long_description must be a string`)
  }
  if (catalog.long_description && catalog.long_description.length > 20000) {
    errors.push(`${appId}: catalog.long_description too long (max 20000)`)
  }
  for (const flag of ['featured', 'verified', 'icon_shell', 'securityReview', 'security_review']) {
    if (catalog[flag] !== undefined && typeof catalog[flag] !== 'boolean') {
      errors.push(`${appId}: catalog.${flag} must be boolean`)
    }
  }
  if (catalog.featured === true && !isOfficial(appId) && !catalog.securityReview && !catalog.security_review) {
    warnings.push(
      `${appId}: featured=true on third-party app — maintainers will review before merge`,
    )
  }
  if (catalog.preview != null) {
    if (typeof catalog.preview !== 'object' || Array.isArray(catalog.preview)) {
      errors.push(`${appId}: catalog.preview must be an object`)
    }
  }
  if (catalog.screenshots !== undefined) {
    if (!Array.isArray(catalog.screenshots)) {
      errors.push(`${appId}: catalog.screenshots must be an array`)
    }
  }
}

function validateOne(appId) {
  const errors = []
  const warnings = []
  const dir = join(appsDir, appId)
  const manifestPath = join(dir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    return { appId, errors: [`${appId}: missing manifest.json`], warnings }
  }

  let manifest
  try {
    manifest = readJson(manifestPath)
  } catch (err) {
    return { appId, errors: [`${appId}: invalid manifest.json: ${err.message}`], warnings }
  }

  if (manifest.id !== appId) {
    errors.push(`${appId}: manifest.id must equal folder name (got ${JSON.stringify(manifest.id)})`)
  }

  const category = manifest.category
  if (typeof category !== 'string' || !category.trim()) {
    errors.push(`${appId}: manifest.category is required`)
  } else if (!STABLE_CATEGORIES.has(category)) {
    const alias = CATEGORY_ALIASES[category.toLowerCase()]
    if (alias) {
      errors.push(
        `${appId}: category "${category}" is a deprecated alias — use "${alias}" in manifest.json`,
      )
    } else {
      errors.push(
        `${appId}: category must be one of: ${[...STABLE_CATEGORIES].join(', ')}`,
      )
    }
  }

  const catalogPath = join(dir, 'catalog.json')
  let catalog = null
  if (existsSync(catalogPath)) {
    try {
      catalog = readJson(catalogPath)
      validateCatalogJson(appId, catalog, errors, warnings)
    } catch (err) {
      errors.push(`${appId}: invalid catalog.json: ${err.message}`)
    }
  }

  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : []
  const elevated = permissions.filter((p) => ELEVATED_PERMISSIONS.includes(p))
  if (elevated.length) {
    const reviewed = Boolean(catalog?.securityReview || catalog?.security_review)
    if (!isOfficial(appId) && !reviewed) {
      errors.push(
        `${appId}: elevated permissions require apps/${appId}/catalog.json ` +
          `with "securityReview": true after maintainer review. ` +
          `Elevated: ${elevated.join(', ')}`,
      )
    } else if (!isOfficial(appId) && reviewed) {
      warnings.push(`${appId}: elevated permissions present (securityReview=true): ${elevated.join(', ')}`)
    }
  }

  const files = walkFiles(dir)
  let total = 0
  for (const abs of files) {
    const rel = relative(root, abs)
    const name = abs.split('/').pop() || ''
    if (JUNK_NAME.test(name)) {
      errors.push(`${appId}: remove junk file ${rel}`)
    }
    if (/\.(pem|p12|key)$/i.test(name)) {
      errors.push(`${appId}: secret-like file not allowed: ${rel}`)
    }
    try {
      total += statSync(abs).size
    } catch {
      // ignore
    }
  }
  if (total > MAX_PACKAGE_BYTES) {
    errors.push(
      `${appId}: package tree exceeds ${MAX_PACKAGE_BYTES} bytes (${total})`,
    )
  } else if (total > WARN_PACKAGE_BYTES) {
    warnings.push(`${appId}: large package (${total} bytes) — ensure size is intentional`)
  }

  return { appId, errors, warnings, size: total, elevated }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const ids = args.app ? [args.app] : listAppIds()
  if (args.app && !existsSync(join(appsDir, args.app))) {
    console.error(`Unknown app: ${args.app}`)
    process.exit(2)
  }

  const reports = ids.map(validateOne)
  const allErrors = reports.flatMap((r) => r.errors)
  const allWarnings = reports.flatMap((r) => r.warnings)

  if (args.json) {
    console.log(JSON.stringify({ reports, ok: allErrors.length === 0 }, null, 2))
  } else {
    console.log(`validate-app — ${ids.length} app(s)`)
    for (const r of reports) {
      if (!r.errors.length && !r.warnings.length) {
        console.log(`  · ${r.appId} (ok)`)
      } else {
        for (const w of r.warnings) console.warn(`  ! ${w}`)
        for (const e of r.errors) console.error(`  ✗ ${e}`)
      }
    }
    if (allErrors.length === 0) console.log('Result: app validation passed.')
    else console.log(`Result: ${allErrors.length} error(s).`)
  }

  for (const w of allWarnings) {
    console.warn(`::warning::${w}`)
  }
  if (allErrors.length) process.exit(1)
  process.exit(0)
}

main()
