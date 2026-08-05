#!/usr/bin/env node
// Enforce PR scope for tapp-store contributions.
//
// Rules:
//   1. index.json must not appear in the diff (machine-managed catalog).
//   2. At most one apps/<id>/ tree may change per PR.
//   3. Zero apps is OK (docs / scripts / CI-only PRs).
//   4. If an existing app has non-doc package changes, manifest.version must increase.
//   5. Reject junk paths (.DS_Store, node_modules, secret-like files).
//
// Usage:
//   node scripts/check-pr-scope.mjs [base_sha] [head_sha]
//
// Env (GitHub Actions): BASE_SHA, HEAD_SHA, GITHUB_OUTPUT
// Exit: 0 ok, 1 policy failure, 2 usage/git error
// Prints APP_ID=<id|none> for downstream steps.

import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const DOC_ONLY = new Set([
  'readme.md',
  'changelog.md',
  'license',
  'license.md',
  'license.txt',
])

const JUNK_PATTERNS = [
  /(^|\/)\.DS_Store$/,
  /(^|\/)node_modules\//,
  /(^|\/)\.git\//,
  /\.pem$/i,
  /\.p12$/i,
  /(^|\/)\.env(\.|$)/,
  /(^|\/)Thumbs\.db$/,
]

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (err) {
    if (allowFail) return ''
    throw err
  }
}

function resolveRange(argv) {
  const base = argv[0] || process.env.BASE_SHA || ''
  const head = argv[1] || process.env.HEAD_SHA || 'HEAD'
  if (base) return { base, head }

  for (const ref of ['origin/main', 'main']) {
    try {
      git(['rev-parse', '--verify', ref])
      const mb = git(['merge-base', ref, head])
      return { base: mb, head }
    } catch {
      // try next
    }
  }
  console.error(
    'Usage: node scripts/check-pr-scope.mjs <base_sha> <head_sha>\n' +
      'Or set BASE_SHA / HEAD_SHA, or have origin/main available.',
  )
  process.exit(2)
}

function parseSemver(v) {
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function semverGt(a, b) {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return false
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true
    if (pa[i] < pb[i]) return false
  }
  return false
}

function readManifestAt(ref, appId) {
  const path = `apps/${appId}/manifest.json`
  const raw = git(['show', `${ref}:${path}`], { allowFail: true })
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isDocOnlyFile(file) {
  const base = file.split('/').pop()?.toLowerCase() || ''
  return DOC_ONLY.has(base)
}

function main() {
  const { base, head } = resolveRange(process.argv.slice(2))
  let changed
  try {
    changed = git(['diff', '--name-only', `${base}...${head}`])
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  } catch (err) {
    console.error(String(err.stderr || err.message || err))
    process.exit(2)
  }

  console.log(`PR scope check (${String(base).slice(0, 7)}...${String(head).slice(0, 7)})`)
  console.log(`Changed files (${changed.length}):`)
  for (const f of changed) console.log(`  ${f}`)

  const errors = []
  const notices = []

  if (changed.includes('index.json')) {
    errors.push(
      'index.json is protected — do not edit it in PRs.\n' +
        '  Change apps/<id>/ (manifest + package files, optional catalog.json) only.\n' +
        '  After merge, Catalog Sync regenerates index.json from manifests.',
    )
  }

  for (const file of changed) {
    for (const re of JUNK_PATTERNS) {
      if (re.test(file)) {
        errors.push(`Junk or secret-like path is not allowed: ${file}`)
      }
    }
  }

  const appIds = new Set()
  for (const file of changed) {
    const m = file.match(/^apps\/([^/]+)\//)
    if (m) appIds.add(m[1])
    const m2 = file.match(/^apps\/([^/]+)$/)
    if (m2) appIds.add(m2[1])
  }

  if (appIds.size > 1) {
    const list = [...appIds].sort().map((id) => `  - ${id}`).join('\n')
    errors.push(
      `One PR may modify at most one app under apps/ (found ${appIds.size}):\n${list}\n` +
        '  Split into separate PRs — one app per PR.',
    )
  }

  const appId = appIds.size === 1 ? [...appIds][0] : null

  if (appId) {
    const appFiles = changed.filter(
      (f) => f === `apps/${appId}` || f.startsWith(`apps/${appId}/`),
    )
    const nonDoc = appFiles.filter((f) => !isDocOnlyFile(f))
    const headManifest = readManifestAt(head, appId)
    const baseManifest = readManifestAt(base, appId)

    if (!headManifest) {
      errors.push(`Missing apps/${appId}/manifest.json on PR head`)
    } else {
      if (headManifest.id && headManifest.id !== appId) {
        errors.push(
          `Folder apps/${appId} must match manifest.id (got "${headManifest.id}")`,
        )
      }
      if (!parseSemver(headManifest.version)) {
        errors.push(
          `manifest.version must be semver (got ${JSON.stringify(headManifest.version)})`,
        )
      }

      if (baseManifest && nonDoc.length > 0) {
        const oldV = baseManifest.version
        const newV = headManifest.version
        if (oldV === newV) {
          errors.push(
            `manifest.version must increase when package files change ` +
              `(still ${JSON.stringify(oldV)}).\n` +
              `  Non-doc changes under apps/${appId}/ require a semver bump.`,
          )
        } else if (!semverGt(newV, oldV)) {
          errors.push(
            `manifest.version must be greater than base (${oldV} → ${newV})`,
          )
        } else {
          notices.push(`version bump ${oldV} → ${newV}`)
        }
      } else if (!baseManifest) {
        notices.push(`new app ${appId} @ ${headManifest.version || '?'}`)
      } else if (nonDoc.length === 0) {
        notices.push('docs-only app change (version bump not required)')
      }
    }
  }

  if (errors.length) {
    console.error('')
    for (const e of errors) {
      console.error(`::error title=PR scope::${e.split('\n')[0]}`)
      console.error(e)
      console.error('')
    }
    process.exit(1)
  }

  for (const n of notices) console.log(`Note: ${n}`)
  if (appId) console.log(`OK: single app scope → ${appId}`)
  else console.log('OK: no app package changes (docs/scripts/CI only).')

  const outPath = process.env.GITHUB_OUTPUT
  if (outPath) appendFileSync(outPath, `app_id=${appId || ''}\n`)
  console.log(`APP_ID=${appId || 'none'}`)
  process.exit(0)
}

main()
