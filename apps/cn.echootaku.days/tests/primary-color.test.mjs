import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const values = new Map();
const style = {
  setProperty(name, value) { values.set(name, String(value)); },
  removeProperty(name) { values.delete(name); }
};
const classList = { toggle() {}, remove() {} };
const root = {
  dataset: {},
  style,
  classList,
  isConnected: true,
  querySelector() { return null; },
  querySelectorAll() { return []; }
};
const documentElement = { ...root, dataset: {}, style, classList };
const body = { classList };
let primaryListener = null;
let primaryOffCalls = 0;
const context = {
  console,
  setTimeout,
  clearTimeout,
  requestAnimationFrame(callback) { callback(); },
  document: {
    documentElement,
    body,
    querySelector() { return null; },
    createElement() { return { style, appendChild() {}, className: '', textContent: '' }; }
  },
  Tapp: {
    widgets: {},
    storage: {},
    ui: {
      async getPrimaryColor() { return '#123456'; },
      onPrimaryColorChange(callback) {
        primaryListener = callback;
        return () => { primaryOffCalls += 1; };
      }
    },
    lifecycle: { onReady() {}, onPause() {}, onResume() {}, onDestroy() {} }
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'main.js' });

const systemTheme = { ...context.DAYS_DEFAULT_THEME, preset: 'system' };
context.daysApplyThemeConfig(root, systemTheme, null);
assert.equal(values.get('--days-accent'), 'var(--tapp-primary, #D97757)');
assert.equal(values.get('--days-accent-rgb'), 'var(--tapp-primary-rgb, 217, 119, 87)');

await context.daysInitPrimaryColor(root, context.daysPageState.mountToken);
assert.equal(values.get('--tapp-primary'), '#123456');
assert.equal(values.get('--tapp-primary-rgb'), '18, 52, 86');
assert.equal(values.get('--days-accent'), '#123456');
assert.equal(values.get('--days-accent-rgb'), '18, 52, 86');

const revisionBeforeInvalidColor = context.daysPageState.primaryColorRevision;
primaryListener('not-a-color');
assert.equal(context.daysPageState.primaryColorRevision, revisionBeforeInvalidColor);
assert.equal(values.get('--days-accent'), '#123456');

primaryListener('#AABBCC');
assert.equal(values.get('--days-accent'), '#AABBCC');
assert.equal(values.get('--days-accent-rgb'), '170, 187, 204');

context.daysPageState.theme = { ...context.DAYS_DEFAULT_THEME, preset: 'ocean', accent: '#3C87A8' };
context.daysApplyThemeConfig(root, context.daysPageState.theme, context.daysPageState.primaryColor);
primaryListener('#102030');
assert.equal(values.get('--tapp-primary-rgb'), '16, 32, 48');
assert.equal(values.get('--days-accent'), '#3C87A8');
assert.equal(values.get('--days-accent-rgb'), '60, 135, 168');

context.daysPageState.theme = systemTheme;
context.daysApplyThemeConfig(root, systemTheme, context.daysPageState.primaryColor);
assert.equal(values.get('--days-accent'), '#102030');
assert.equal(values.get('--days-accent-rgb'), '16, 32, 48');

context.daysDestroyPage();
assert.equal(primaryOffCalls, 1);
assert.equal(context.daysPageState.primaryColor, null);
assert.equal(context.daysPageState.primaryColorOff, null);

console.log('days primary color regression: ok');
