import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadSandboxYaml() {
  const context = vm.createContext({});
  // Match the intrinsic freezing in Myriad's sandbox before loading app code.
  vm.runInContext(`
    for (const value of [Object, Array, Function, String, Number, Boolean, Date,
      RegExp, Error, Promise, Map, Set, WeakMap, WeakSet, Symbol]) {
      Object.freeze(value.prototype);
    }
    Object.freeze(JSON); Object.freeze(Math); Object.freeze(Reflect);
  `, context);
  vm.runInContext(readFileSync(new URL('../vendor/js-yaml.js', import.meta.url), 'utf8'), context);
  return context;
}

test('bundled YAML loads and round-trips Compose with frozen sandbox prototypes', () => {
  const context = loadSandboxYaml();
  assert.equal(vm.runInContext(`
    const compose = jsyaml.load('services:\\n  backend:\\n    image: myriad/backend:latest\\n');
    jsyaml.load(jsyaml.dump(compose)).services.backend.image;
  `, context), 'myriad/backend:latest');
  assert.equal(vm.runInContext('Object.isFrozen(Error.prototype)', context), true);
});

test('invalid YAML preserves YAMLException diagnostics under frozen sandbox prototypes', () => {
  const context = loadSandboxYaml();
  assert.equal(vm.runInContext(`
    let validError = false;
    try { jsyaml.load('services: ['); } catch (error) {
      validError = error instanceof Error && error instanceof jsyaml.YAMLException
        && error.constructor === jsyaml.YAMLException
        && error.name === 'YAMLException' && typeof error.reason === 'string'
        && error.message.includes(error.reason)
        && error.toString().startsWith('YAMLException: ')
        && typeof error.stack === 'string' && typeof error.mark.line === 'number';
    }
    validError;
  `, context), true);
});
