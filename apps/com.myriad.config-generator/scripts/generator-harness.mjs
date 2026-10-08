/** Executes the complete production entry point; only DOM presentation is stubbed. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const panels = ['1panel', 'baota', 'aapanel', 'generic', 'portainer', 'dockge', 'coolify', 'dokploy', 'npm', 'caddy'];
export function loadGenerator() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', hidden: false, innerHTML: '', value: '', dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, querySelectorAll() { return []; } });
    return elements.get(id);
  };
  const context = vm.createContext({ require: createRequire(new URL('../main.js', import.meta.url)), console, URL, TextEncoder, TextDecoder, crypto: webcrypto, Uint8Array, setTimeout, clearTimeout,
    window: { _TAPP_MODE: 'core' }, navigator: {},
    document: { getElementById: element, querySelectorAll: () => [], querySelector: () => null },
    Tapp: { lifecycle: { onReady() {} }, ui: { showNotification: async () => {} } }
  });
  vm.runInContext(readFileSync(root + 'main.js', 'utf8'), context, { filename: 'main.js' });
  // Presentation calls are deliberately excluded; generation, validation, templates and helpers are real.
  for (const name of ['applyDoneResultChrome', 'renderDoneGuide', 'goWizard', 'showNotification']) context[name] = () => {};
  return { context, elements };
}
export function generate(overrides = {}) {
  const { context, elements } = loadGenerator();
  Object.assign(context.state, {
    composeHostRoot: '/opt/myriad', mainDomain: 'example.com', extraDomain: 'social.example.com',
    dbPassword: 'D'.repeat(40), jwtSecret: 'J'.repeat(40), updateToken: 'U'.repeat(40),
    updaterGatewaySecret: 'G'.repeat(40), setupSecret: 'S'.repeat(40),
    personaDbPassword: 'P'.repeat(40), federationDbPassword: 'F'.repeat(40),
    analyticsSalt: 'a'.repeat(64), guardSelfUpdateToken: 'H'.repeat(40),
    myriadTag: 'v1.2.3', proxyTag: 'v1.2.3', updaterTag: 'v1.2.3', updaterDigest: 'a'.repeat(64),
    ...overrides
  });
  context.generateConfigs();
  const text = id => elements.get('result-' + id)?.textContent || '';
  return { context, state: context.state, compose: text('docker-compose'), env: text('env'), guard: text('guard-env'), notes: text('deploy-notes'), nginx: text('main-nginx'), caddy: text('caddyfile'), files: elements };
}
