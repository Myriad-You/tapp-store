import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

function source(name) {
  return fs.readFileSync(new URL('../page/' + name, import.meta.url), 'utf8');
}

function createThemeContext(overrides = {}) {
  const properties = new Map();
  const classes = new Set();
  const requested = [];
  const revoked = [];
  const assets = {
    async getUrl(path) {
      requested.push(path);
      return { url: 'blob:' + path };
    },
    revoke(url) { revoked.push(url); },
    ...overrides.assets
  };
  const context = {
    console,
    Tapp: { assets },
    document: {
      documentElement: {
        classList: {
          toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
          remove(name) { classes.delete(name); }
        },
        style: {
          setProperty(name, value) { properties.set(name, value); },
          removeProperty(name) { properties.delete(name); }
        }
      }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source('theme.js'), context, { filename: 'theme.js' });
  return { context, properties, classes, requested, revoked };
}

describe('theme asset lifecycle', () => {
  it('keeps the classic theme asset-free and loads all declared Iroha layers on demand', async () => {
    const fixture = createThemeContext();
    await fixture.context.DDZ.theme.set('classic');
    assert.equal(fixture.requested.length, 0);
    assert.equal(fixture.classes.has('iroha-theme'), false);

    await fixture.context.DDZ.theme.set('iroha');
    assert.equal(fixture.requested.length, 16);
    assert.equal(new Set(fixture.requested).size, 16);
    assert.equal(fixture.properties.size, 16);
    assert.equal(fixture.classes.has('iroha-theme'), true);

    await fixture.context.DDZ.theme.set('classic');
    assert.equal(fixture.revoked.length, 16);
    assert.equal(fixture.properties.size, 0);
    assert.equal(fixture.classes.has('iroha-theme'), false);
  });

  it('revokes assets that finish loading after the selected theme changed', async () => {
    let resolveAsset;
    const pendingAsset = new Promise((resolve) => { resolveAsset = resolve; });
    const fixture = createThemeContext({
      assets: {
        getUrl() { return pendingAsset; }
      }
    });
    const loading = fixture.context.DDZ.theme.set('iroha');
    await fixture.context.DDZ.theme.set('classic');
    resolveAsset({ url: 'blob:stale' });
    await loading;
    assert.equal(fixture.classes.has('iroha-theme'), false);
    assert.equal(fixture.properties.size, 0);
    assert.equal(fixture.revoked.length, 16);
    assert.ok(fixture.revoked.every((url) => url === 'blob:stale'));
  });
});

describe('personal theme preference', () => {
  it('defaults and normalizes to classic, then persists an explicit Iroha selection', async () => {
    const values = new Map();
    const context = {
      console,
      Date,
      Tapp: {
        storage: {
          async get(key) { return values.get(key); },
          async set(key, value) { values.set(key, value); },
          async remove(key) { values.delete(key); }
        }
      }
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(source('storage.js'), context, { filename: 'storage.js' });

    assert.equal((await context.DDZ.storage.loadSettings()).theme, 'classic');
    values.set('settings:v2', { theme: 'unknown' });
    assert.equal((await context.DDZ.storage.loadSettings()).theme, 'classic');
    await context.DDZ.storage.saveSetting('theme', 'iroha');
    assert.equal((await context.DDZ.storage.loadSettings()).theme, 'iroha');
  });
});
