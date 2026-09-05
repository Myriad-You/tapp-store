import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const parser = require(join(root, 'page', 'parser.js'));
const loader = require(join(root, 'page', 'structure-loader.js'));
const sample = readFileSync(join(root, 'tests', 'fixtures', 'sample.cif'), 'utf8');
const withTimeout = (promise) => promise;

test('loads and parses the full text structure first', async () => {
  const calls = [];
  const result = await loader.load('4R8P', {
    apis: {
      structure: async (params) => { calls.push(['structure', params]); return { body: sample }; },
      structureCa: async (params) => { calls.push(['structureCa', params]); return { body: sample }; }
    },
    parser,
    withTimeout
  });

  assert.deepEqual(calls, [['structure', { id: '4R8P' }]]);
  assert.equal(result.parsed.id, '4R8P');
  assert.equal(result.parsed.atoms.length, 11);
  assert.equal(result.parsed.simplified, false);
});

test('falls back to the C-alpha endpoint when the full response exceeds the host limit', async () => {
  const calls = [];
  let primary;
  const result = await loader.load('4R8P', {
    apis: {
      structure: async () => {
        calls.push('structure');
        throw new Error('Response exceeds 2097152 bytes');
      },
      structureCa: async () => {
        calls.push('structureCa');
        return { data: sample };
      }
    },
    parser,
    withTimeout,
    onFallback: (error) => { primary = error; }
  });

  assert.deepEqual(calls, ['structure', 'structureCa']);
  assert.match(primary.message, /2097152/);
  assert.equal(result.parsed.atoms.length, 11);
  assert.equal(result.parsed.simplified, true);
});

test('falls back when the full response is not valid mmCIF', async () => {
  const result = await loader.load('4R8P', {
    apis: {
      structure: async () => 'not mmcif',
      structureCa: async () => sample
    },
    parser,
    withTimeout
  });

  assert.equal(result.parsed.simplified, true);
  assert.equal(result.parsed.atoms.length, 11);
});

test('reports the fallback failure while retaining the primary cause', async () => {
  await assert.rejects(
    loader.load('4R8P', {
      apis: {
        structure: async () => { throw new Error('structure failed'); },
        structureCa: async () => { throw new Error('structureCa failed'); }
      },
      parser,
      withTimeout
    }),
    (error) => error.message === 'structureCa failed' && error.primaryError.message === 'structure failed'
  );
});
