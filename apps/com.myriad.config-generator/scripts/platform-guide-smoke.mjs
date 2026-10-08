#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { panels } from './generator-harness.mjs';
const require = createRequire(import.meta.url);
const yaml = require('../vendor/js-yaml.js');
const { buildPlatformGuide, buildTraefikConfig } = require('../platform.js');
const ctx = { domain: 'example.com', extraDomain: 'social.example.com', httpBind: '127.0.0.1', httpPort: 18080, composeHostRoot: '/opt/myriad', netMyriad: 'myriad-net', external: false };
for (const panel of panels) {
  const guide = buildPlatformGuide(panel, ctx);
  assert.ok(guide.includes('/opt/myriad'));
  assert.ok(guide.includes('docker compose --env-file .env config --quiet'));
  assert.ok(guide.includes('实际文件'));
  if (['coolify', 'dokploy', 'npm'].includes(panel)) {
    assert.ok(guide.includes('myriad-proxy:80'));
    assert.ok(guide.includes('docker network connect'));
    assert.ok(guide.includes('重建'));
    assert.ok(!guide.includes('127.0.0.1'), 'Container proxy never instructed to forward to its own loopback');
  }
  const dynamic = buildTraefikConfig(panel, ctx);
  assert.equal(Boolean(dynamic), ['coolify', 'dokploy'].includes(panel));
  if (dynamic) {
    assert.equal(dynamic.filename, 'myriad-traefik.yml');
    const parsed = yaml.load(dynamic.content);
    assert.equal(parsed.http.services['myriad-main'].loadBalancer.servers[0].url, 'http://myriad-proxy:80');
    assert.equal(parsed.http.routers['myriad-main-https'].tls.certResolver, 'letsencrypt');
    assert.ok(dynamic.content.includes('http://myriad-proxy:80'));
    assert.ok(dynamic.content.includes('Host(`example.com`) || Host(`social.example.com`)'));
    assert.ok(dynamic.content.includes(panel === 'coolify' ? 'entryPoints: [https]' : 'entryPoints: [websecure]'));
    assert.ok(!dynamic.content.includes('18080'));
  }
}
assert.throws(() => buildTraefikConfig('coolify', { ...ctx, domain: "bad.example')\nhttp:" }));
assert.throws(() => buildPlatformGuide('generic', { ...ctx, composeHostRoot: '.' }));
assert.throws(() => buildPlatformGuide('generic', { ...ctx, netMyriad: 'x; touch pwn' }));
assert.throws(() => buildPlatformGuide('generic', { ...ctx, httpPort: -1 }));
assert.ok(!buildPlatformGuide('generic', { ...ctx, external: true }).includes('chown -R 70:70 pgdata'));
console.log('platform-guide-smoke: 10 profiles and dynamic proxy routes passed');
