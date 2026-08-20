/**
 * Config-generator security smoke:
 * - dotenv token whitelist / injection rejection
 * - generated .env re-parse + key set
 * - memory / PG bounds
 * - image ref + digest
 * - source contracts (allSettled, upload limit, dispose)
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mainPath = join(root, 'main.js')
const main = readFileSync(mainPath, 'utf8')

// Syntax
const chk = spawnSync(process.execPath, ['--check', mainPath], { encoding: 'utf8' })
assert.equal(chk.status, 0, 'main.js syntax: ' + (chk.stderr || chk.stdout))

// Source contracts from review
assert.match(main, /Promise\.allSettled/)
assert.match(main, /isSafeDotenvToken|DOTENV_TOKEN_RE/)
assert.match(main, /validateGeneratedEnv/)
assert.match(main, /parseDotenvStrict/)
assert.match(main, /NGINX_UPLOAD_MAX_BYTES/)
assert.match(main, /disposePage|pageListen/)
assert.match(main, /isValidMemoryLimit/)
assert.match(main, /isValidPgMajor/)
assert.match(main, /parseImageRef/)
assert.match(main, /nginx -t/)
assert.match(main, /MYRIAD_SETUP_SECRET/)
assert.match(main, /MYRIAD_SETUP_SECRET: \\\$\{MYRIAD_SETUP_SECRET:\?Set MYRIAD_SETUP_SECRET in \.env\}/)
assert.match(main, /DOCKER_GUARD_EXPECTED_IMAGE/)
assert.match(main, /GUARD_SELF_UPDATE_TOKEN/)
assert.match(main, /exec \/usr\/bin\/tini -- \/usr\/local\/bin\/myriad-docker-guard/)
assert.match(main, /if \[ ! -f \/guard-policy\/docker-guard.env \]; then umask 077; fi/)
assert.match(main, /MYRIAD_GUARD_ENV_FILE: 'guard-policy\/docker-guard.env'/)
assert.match(main, /DOCKER_GUARD_HOST_POLICY_PATH: \/guard-policy\/docker-guard.env/)
assert.doesNotMatch(main, /<<'POLICY'/)
assert.doesNotMatch(main, /cat > \/guard-policy\/docker-guard.env/)
assert.doesNotMatch(main, /guard-policy-init/)
assert.doesNotMatch(main, /\/etc\/myriad/)
assert.doesNotMatch(main, /MYRIAD_ALLOW_REMOTE_BOOTSTRAP/)
assert.doesNotMatch(main, /DOCKER_GUARD_ALLOWED_IMAGES: \\\$\{BACKEND_IMAGE/)
assert.doesNotMatch(main, /await Promise\.all\(\s*\[\s*fetchDockerHubTags/)

// Extract pure helpers by executing a slice of main.js (no DOM / Tapp)
function loadHelpers() {
  const start = main.indexOf('var DOTENV_TOKEN_RE')
  assert.ok(start > 0, 'DOTENV_TOKEN_RE not found')
  // End before replaceNginxDomain (domain rewrite needs no export)
  const endMarker = main.indexOf('// 替换 Nginx 配置中的域名')
  assert.ok(endMarker > start, 'end marker not found')
  const slice = main.slice(start, endMarker)
  // parseVersionTag is defined later; provide a minimal stub used by parseImageRef
  const prelude = `
    function parseVersionTag(tag) {
      if (!tag || typeof tag !== 'string') return null;
      var m = tag.match(/^v?(\\d+)\\.(\\d+)\\.(\\d+)(?:-([0-9A-Za-z.-]+))?$/i);
      if (!m) return null;
      return { raw: tag, major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || null };
    }
  `
  const factory = new Function(
    prelude + '\n' + slice +
    '; return {' +
    ' isSafeDotenvToken, requireSafeDotenvToken, parseDotenvStrict, validateGeneratedEnv,' +
    ' parseMemoryToBytes, isValidMemoryLimit, isValidPgMajor, parseImageRef, buildImageRef,' +
    ' DOTENV_TOKEN_RE, NGINX_UPLOAD_MAX_BYTES, PG_VERSION_MIN, PG_VERSION_MAX,' +
    ' MEM_MIN_BYTES, MEM_MAX_BYTES, EXPECTED_ENV_KEYS_BASE' +
    ' };'
  )
  return factory()
}

const h = loadHelpers()

// --- token whitelist ---
assert.equal(h.isSafeDotenvToken('a'.repeat(32)), true)
assert.equal(h.isSafeDotenvToken('A_z-09' + 'x'.repeat(26)), true)
assert.equal(h.isSafeDotenvToken('short'), false)
assert.equal(h.isSafeDotenvToken('a'.repeat(32) + '\nPROXY_ALLOW_DIRECT_UPDATER=true'), false)
assert.equal(h.isSafeDotenvToken('a'.repeat(31) + '='), false)
assert.equal(h.isSafeDotenvToken('a'.repeat(31) + '#'), false)
assert.equal(h.isSafeDotenvToken('a'.repeat(31) + ' '), false)
assert.equal(h.isSafeDotenvToken('a'.repeat(31) + '\r'), false)
assert.equal(h.isSafeDotenvToken('a'.repeat(513)), false)

assert.throws(() => h.requireSafeDotenvToken('bad', 'JWT_SECRET'), /JWT_SECRET/)

// --- injection into dotenv ---
const goodSecret = 'A'.repeat(32)
const injected =
  'UPDATE_TOKEN=' + goodSecret + '\nPROXY_ALLOW_DIRECT_UPDATER=true\n' +
  'UPDATER_GATEWAY_SECRET=' + goodSecret + '\n' +
  'JWT_SECRET=' + goodSecret + '\n' +
  'MYRIAD_SETUP_SECRET=' + goodSecret + '\n' +
  'PROXY_ALLOW_DIRECT_UPDATER=false\n' +
  'MYRIAD_TAG=v1.0.0\nPROXY_TAG=v1.0.0\nUPDATER_TAG=v1.0.0\n' +
  'BACKEND_IMAGE=x\nFRONTEND_IMAGE=x\nCOMPOSE_PROJECT_NAME=myriad\n' +
  'CHANNEL=stable\nUPDATE_MODE=release\nMYRIAD_GITHUB_REPO=Myriad-You/Myriad\n' +
  'CHECK_INTERVAL_SECS=3600\nHTTP_BIND_ADDRESS=127.0.0.1\nHTTP_PORT=18080\n' +
  'COSIGN_VERIFY=strict\nMYRIAD_DB_MODE=external\nDATABASE_URL=postgres://u:p@h/db\n' +
  'CORS_ORIGINS=https://a.com\nBASE_URL=https://a.com\nFRONTEND_URL=https://a.com\n'

assert.throws(
  () => h.validateGeneratedEnv(injected, {
    JWT_SECRET: goodSecret,
    UPDATE_TOKEN: goodSecret,
    UPDATER_GATEWAY_SECRET: goodSecret,
    MYRIAD_SETUP_SECRET: goodSecret
  }, { bundled: false }),
  /PROXY_ALLOW_DIRECT_UPDATER|重复/
)

// clean env re-parse
function buildCleanEnv(secrets, bundled) {
  const lines = [
    'MYRIAD_TAG=v1.2.3',
    'PROXY_TAG=v1.2.3',
    'UPDATER_TAG=v1.2.3',
    'BACKEND_IMAGE=docker.io/somekawahitomi/myriad-backend',
    'FRONTEND_IMAGE=docker.io/somekawahitomi/myriad-frontend',
    'COMPOSE_PROJECT_NAME=myriad',
    'UPDATE_TOKEN=' + secrets.UPDATE_TOKEN,
    'UPDATER_GATEWAY_SECRET=' + secrets.UPDATER_GATEWAY_SECRET,
    'CHANNEL=stable',
    'UPDATE_MODE=release',
    'MYRIAD_GITHUB_REPO=Myriad-You/Myriad',
    'CHECK_INTERVAL_SECS=3600',
    'HTTP_BIND_ADDRESS=127.0.0.1',
    'HTTP_PORT=18080',
    'PROXY_ALLOW_DIRECT_UPDATER=false',
    'COSIGN_VERIFY=strict',
    'MYRIAD_MEMORY_PROFILE=default',
    'MYRIAD_DB_MODE=' + (bundled ? 'bundled' : 'external'),
  ]
  if (bundled) {
    lines.push(
      'POSTGRES_DB=myriad',
      'POSTGRES_USER=myriad',
      'POSTGRES_PASSWORD=' + secrets.POSTGRES_PASSWORD
    )
  }
  lines.push(
    'DATABASE_URL=postgres://myriad:x@postgres:5432/myriad',
    'JWT_SECRET=' + secrets.JWT_SECRET,
    'MYRIAD_SETUP_SECRET=' + secrets.MYRIAD_SETUP_SECRET,
    'CORS_ORIGINS=https://example.com',
    'BASE_URL=https://example.com',
    'FRONTEND_URL=https://example.com',
    'MYRIAD_COMPOSE_HOST_ROOT=.',
    'MYRIAD_GUARD_ENV_FILE=guard-policy/docker-guard.env',
    'DOCKER_GUARD_IMAGE=docker.io/somekawahitomi/myriad-updater@sha256:' + 'a'.repeat(64),
    'UPDATER_IMAGE_REF=docker.io/somekawahitomi/myriad-updater@sha256:' + 'a'.repeat(64),
    'GUARD_SELF_UPDATE_TOKEN=' + secrets.GUARD_SELF_UPDATE_TOKEN,
    'GUARD_COMPOSE_PROJECT_NAME=myriad',
    'GUARD_MYRIAD_DOCKER_NETWORK=myriad-net',
    'GUARD_MYRIAD_ADMIN_NETWORK=myriad-admin-net',
    'GUARD_MYRIAD_DOCKER_GUARD_NETWORK=myriad-docker-guard-net'
  )
  return lines.join('\n') + '\n'
}

const secrets = {
  JWT_SECRET: 'J'.repeat(40),
  UPDATE_TOKEN: 'U'.repeat(40),
  UPDATER_GATEWAY_SECRET: 'G'.repeat(40),
  MYRIAD_SETUP_SECRET: 'S'.repeat(40),
  POSTGRES_PASSWORD: 'P'.repeat(40),
  GUARD_SELF_UPDATE_TOKEN: 'H'.repeat(40)
}
const clean = buildCleanEnv(secrets, true)
const parsed = h.validateGeneratedEnv(clean, secrets, { bundled: true })
assert.equal(parsed.map.JWT_SECRET, secrets.JWT_SECRET)
assert.ok(parsed.keys.includes('POSTGRES_PASSWORD'))

// multi-line secret value rejected at parse
assert.throws(
  () => h.parseDotenvStrict('JWT_SECRET=abc\ndef\n'),
  /KEY=VALUE|非法/
)

// --- memory ---
assert.equal(h.isValidMemoryLimit('512M'), true)
assert.equal(h.isValidMemoryLimit('2G'), true)
assert.equal(h.isValidMemoryLimit('0M'), false)
assert.equal(h.isValidMemoryLimit('1K'), false) // below 16M
assert.equal(h.isValidMemoryLimit('512T'), false) // above 256G

// --- PG ---
assert.equal(h.isValidPgMajor('18'), true)
assert.equal(h.isValidPgMajor('20'), true)
assert.equal(h.isValidPgMajor('17'), false)
assert.equal(h.isValidPgMajor('999'), false)

// --- image ref ---
assert.equal(h.parseImageRef('latest'), null)
assert.equal(h.parseImageRef('v1.2.3').tag, 'v1.2.3')
assert.equal(h.parseImageRef('v1.2.3').digest, null)
const dig = 'a'.repeat(64)
const withDig = h.parseImageRef('v1.2.3@sha256:' + dig)
assert.equal(withDig.tag, 'v1.2.3')
assert.equal(withDig.digest, dig)
assert.equal(
  h.buildImageRef('docker.io/somekawahitomi/myriad-backend', 'v1.2.3', dig),
  'docker.io/somekawahitomi/myriad-backend@sha256:' + dig
)
assert.equal(
  h.buildImageRef('docker.io/somekawahitomi/myriad-backend', 'v1.2.3', null),
  'docker.io/somekawahitomi/myriad-backend:v1.2.3'
)

assert.ok(h.NGINX_UPLOAD_MAX_BYTES <= 1024 * 1024)
assert.equal(h.PG_VERSION_MIN, 18)

console.log('config-generator security-smoke: ok')
