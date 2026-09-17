#!/usr/bin/env node
/** Behavioral deployment matrix. Requires Docker Compose v2+; never contacts a daemon. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { inspectLegacy, upgradeGenerated } = createRequire(import.meta.url)('../upgrade.js');
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generate, panels, root } from './generator-harness.mjs';
const syntax = spawnSync(process.execPath, ['--check', join(root, 'main.js')], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr);
const version = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
assert.equal(version.status, 0, 'Install Docker Compose v2+ to run the daemon-free matrix.');
const dir = mkdtempSync(join(tmpdir(), 'myriad-generator-matrix-'));
const failures = [];
let passed = 0;
let upgraded = 0;
const modes = [
  { name: 'bundled', dbMode: 'bundled' },
  { name: 'external-routed', dbMode: 'external', dbHost: 'db.example.com', dbSslmode: 'require' },
  { name: 'external-host', dbMode: 'external', dbHost: 'host.docker.internal', dbSslmode: 'require' },
  { name: 'external-docker', dbMode: 'external', dbHost: 'database', dbExtraNetwork: 'myriad-backend-ext' }
];
try {
  for (const panelId of panels) for (const mode of modes) {
    const label = `${panelId}/${mode.name}`;
    try {
      const output = generate({ panelId, ...mode });
      assert.ok(output.compose && output.env && output.guard && output.notes, 'Required deployment artifacts exist');
      assert.doesNotMatch(output.compose + output.env + output.guard, /\{\{[A-Z_]+\}\}/, 'Every template placeholder is resolved');
      writeFileSync(join(dir, 'docker-compose.yml'), output.compose);
      writeFileSync(join(dir, '.env'), output.env);
      mkdirSync(join(dir, 'guard-policy'), { recursive: true });
      writeFileSync(join(dir, 'guard-policy/docker-guard.env'), output.guard);
      const result = spawnSync('docker', ['compose', '--project-directory', dir, '--env-file', join(dir, '.env'), '-f', join(dir, 'docker-compose.yml'), 'config', '--format', 'json'], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME } });
      assert.equal(result.status, 0, `Compose config rejects generated artifacts: ${result.stderr}`);
      const config = JSON.parse(result.stdout);
      const services = config.services;
      const names = ['backend', 'federation-worker', 'persona-worker'];
      for (const name of names) {
        const service = services[name];
        assert.ok(service, `${name} exists`);
        if (mode.name === 'external-host') assert.ok(Array.isArray(service.extra_hosts) ? service.extra_hosts.includes('host.docker.internal=host-gateway') : service.extra_hosts['host.docker.internal'] === 'host-gateway');
        assert.equal(Object.hasOwn(service.networks, 'myriad-backend-ext'), mode.name === 'external-docker', `${name} joins the external DB network exactly when needed`);
      }
      if (mode.name === 'external-docker') {
        assert.equal(config.networks['myriad-backend-ext'].name, 'myriad-backend-ext', 'Guard-approved actual Docker network name is fixed');
        assert.equal(config.networks['myriad-backend-ext'].external, true);
        for (const [name, service] of Object.entries(services)) if (!names.includes(name)) assert.ok(!Object.hasOwn(service.networks || {}, 'myriad-backend-ext'), `${name} cannot access the DB external network`);
      }
      assert.equal(Boolean(services.postgres), mode.dbMode === 'bundled');
      assert.deepEqual(Object.keys(services.proxy.networks).sort(), ['myriad-admin-net', 'myriad-net'], 'Platform routing cannot expand Myriad proxy network access');
      const updaterEnvMount = services.updater.volumes.find(v => v.target === '/host/compose/.env');
      assert.equal(updaterEnvMount.source, '/opt/myriad/.env', 'Updater uses the selected physical Docker-host env file');
      if (['coolify', 'dokploy', 'npm'].includes(panelId)) {
        assert.ok(output.notes.includes('myriad-proxy:80'), 'Container reverse proxy instructions use reachable Myriad container and internal port');
      }
      for (const name of ['federation-worker', 'persona-worker']) {
        const env = services[name].environment;
        assert.notEqual(env.DATABASE_URL, services.backend.environment.DATABASE_URL, `${name} gets independent credentials`);
        assert.ok(!Object.values(env).includes('D'.repeat(40)), 'No admin password in worker environment');
        assert.ok(!Object.hasOwn(services[name].networks, 'myriad-admin-net') && !Object.hasOwn(services[name].networks, 'myriad-docker-guard-net'), 'Worker stays outside administrative networks');
      }
      assert.match(services['docker-guard'].image, /@sha256:[a-f0-9]{64}$/);
      assert.match(services.updater.image, /@sha256:[a-f0-9]{64}$/);
      assert.equal(services.proxy.environment.PROXY_ALLOW_DIRECT_UPDATER, 'false');
      assert.ok(services.updater.volumes.some(v => v.target === '/host/compose/.env' && v.type === 'bind'), 'Updater receives a real env file');
      if (panelId === 'caddy') assert.ok(output.caddy.includes('example.com') && output.caddy.includes('reverse_proxy'));
      if (!['coolify', 'dokploy', 'npm', 'caddy'].includes(panelId)) assert.ok(output.nginx.includes('proxy_pass'));
      const legacy = inspectLegacy(output.compose, output.env);
      const newer = generate({ panelId, ...mode, myriadTag: 'v1.2.4', proxyTag: 'v1.2.4', updaterTag: 'v1.2.4' });
      const migrated = upgradeGenerated({ compose: newer.compose, env: newer.env, guardEnv: newer.guard, deploy: newer.notes }, legacy);
      writeFileSync(join(dir, 'docker-compose.yml'), migrated.compose);
      writeFileSync(join(dir, '.env'), migrated.env);
      const migratedResult = spawnSync('docker', ['compose', '--project-directory', dir, '--env-file', join(dir, '.env'), '-f', join(dir, 'docker-compose.yml'), 'config', '--format', 'json'], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME } });
      assert.equal(migratedResult.status, 0, migratedResult.stderr);
      const migratedConfig = JSON.parse(migratedResult.stdout);
      assert.equal(migratedConfig.name, config.name);
      for (const name of names) {
        assert.equal(migratedConfig.services[name].environment.DATABASE_URL, services[name].environment.DATABASE_URL);
        assert.deepEqual(migratedConfig.services[name].networks, services[name].networks);
        assert.match(migratedConfig.services[name].image, /:v1\.2\.4$/);
      }
      assert.deepEqual(migratedConfig.services.backend.volumes, services.backend.volumes);
      if (services.postgres) assert.deepEqual(migratedConfig.services.postgres.volumes, services.postgres.volumes);
      upgraded++;
      passed++;
      console.log(`PASS ${label}`);
    } catch (error) { failures.push(`${label}: ${error.message}`); console.error(`FAIL ${label}: ${error.message}`); }
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log(`${passed}/${panels.length * modes.length} generated deployment scenarios passed (${version.stdout.trim()}; no daemon).`);
console.log(`${upgraded} upgrade scenarios passed with original DB credentials, project, and data mounts preserved.`);
for (const [label, overrides] of [
  ['missing original directory', { composeHostRoot: '' }],
  ['business backend digest', { myriadDigest: 'b'.repeat(64) }],
  ['business proxy digest', { proxyDigest: 'c'.repeat(64) }],
  ['unapproved actual DB network', { dbMode: 'external', dbHost: 'database', dbExtraNetwork: 'custom-db-net' }]
]) {
  try { assert.throws(() => generate(overrides), error => error.code !== 'MODULE_NOT_FOUND' && /digest|businessDigest|镜像|网络|network|badExtraNetwork|目录|badComposeRoot/i.test(error.message), `${label} must be rejected before download`); console.log(`PASS reject ${label}`); }
  catch (error) { failures.push(error.message); console.error(`FAIL ${error.message}`); }
}
if (failures.length) process.exitCode = 1;
