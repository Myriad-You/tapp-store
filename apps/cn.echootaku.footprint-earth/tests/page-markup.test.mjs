import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('page brand is non-navigating inside the embedded Myriad host', async () => {
  const page = await readFile(new URL('../page.html', import.meta.url), 'utf8');
  const brand = page.match(/<([a-z][a-z0-9]*)\b[^>]*\bclass="brand"[^>]*>/i);

  assert.ok(brand, 'brand element must exist');
  assert.equal(brand[1].toLowerCase(), 'div');
  assert.doesNotMatch(brand[0], /\bhref\s*=/i);
});

test('page waits for host lifecycle readiness and exposes an explicit Room join action', async () => {
  const entry = await readFile(new URL('../page/entry.js', import.meta.url), 'utf8');
  const page = await readFile(new URL('../page.html', import.meta.url), 'utf8');
  assert.match(entry, /lifecycle\.onReady\(start\)/);
  assert.match(page, /data-action="join-room"/);
});
