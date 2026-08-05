#!/usr/bin/env node
// Enforce PR scope for tapp-store contributions.
//
// Rules:
//   1. index.json must not appear in the diff (machine-managed catalog).
//   2. At most one apps/<id>/ tree may change per PR.
//   3. Zero apps is OK (docs / scripts / CI-only PRs).
//
// Usage:
//   node scripts/check-pr-scope.mjs [base_sha] [head_sha]
//
// If SHAs are omitted, uses merge-base(HEAD, origin/main)..HEAD when possible,
// otherwise git diff against HEAD~1 is not assumed — requires env or args.
//
// Env (used by GitHub Actions):
//   BASE_SHA, HEAD_SHA

import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function resolveRange(argv) {
  const base = argv[0] || process.env.BASE_SHA || ''
  const head = argv[1] || process.env.HEAD_SHA || 'HEAD'
  if (base) return { base, head }

  // Local fallback: compare against origin/main (or main) merge-base
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

  console.log(`PR scope check (${base.slice(0, 7)}...${String(head).slice(0, 7)})`)
  console.log(`Changed files (${changed.length}):`)
  for (const f of changed) console.log(`  ${f}`)

  const errors = []

  if (changed.includes('index.json')) {
    errors.push(
      'index.json is protected — do not edit it in PRs.\n' +
        '  Change apps/<id>/manifest.json and package files only.\n' +
        '  After merge, Catalog Sync regenerates index.json from manifests.',
    )
  }

  const appIds = new Set()
  for (const file of changed) {
    const m = file.match(/^apps\/([^/]+)\//)
    if (m) appIds.add(m[1])
    // treat apps/<id> file at top level (shouldn't happen) and renames
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

  if (errors.length) {
    console.error('')
    for (const e of errors) {
      console.error(`::error title=PR scope::${e.split('\n')[0]}`)
      console.error(e)
      console.error('')
    }
    process.exit(1)
  }

  if (appIds.size === 1) {
    console.log(`OK: single app scope → ${[...appIds][0]}`)
  } else {
    console.log('OK: no app package changes (docs/scripts/CI only).')
  }
  process.exit(0)
}

main()
