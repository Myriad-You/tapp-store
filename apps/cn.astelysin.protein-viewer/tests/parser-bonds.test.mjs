import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const parser = require(join(root, 'page', 'parser.js'));
const bondsMod = require(join(root, 'page', 'bonds.js'));

const sample = readFileSync(join(root, 'tests', 'fixtures', 'sample.cif'), 'utf8');

test('parseMmCif extracts atoms with correct fields', () => {
  const result = parser.parseMmCif(sample);
  assert.equal(result.title, 'A TINY TEST PROTEIN');
  assert.equal(result.truncated, false);
  assert.equal(result.atoms.length, 11);
  const first = result.atoms[0];
  assert.deepEqual(
    { el: first.el, atom: first.atom, chain: first.chain, resn: first.resn, resi: first.resi, kind: first.kind },
    { el: 'N', atom: 'N', chain: 'A', resn: 'VAL', resi: 1, kind: 'polymer' }
  );
  assert.equal(first.x, 10.0);
  assert.equal(first.y, 8.0);
  assert.equal(first.z, 10.0);
});

test('parseMmCif filters waters and alternate conformations, keeps HETATM ligands', () => {
  const result = parser.parseMmCif(sample);
  const comps = result.atoms.map((a) => a.resn);
  assert.ok(!comps.includes('HOH'), 'water must be filtered');
  assert.ok(comps.includes('HEM'), 'non-water HETATM ligand must be kept');
  const fe = result.atoms.find((a) => a.el === 'Fe');
  assert.equal(fe.resn, 'HEM');
  assert.equal(fe.kind, 'ligand');
  const firstN = result.atoms.filter((a) => a.atom === 'N' && a.chain === 'A' && a.resi === 1);
  assert.equal(firstN.length, 1, 'alternate conformer rows must be skipped');
});

test('parseMmCif flags truncated input', () => {
  const lines = sample.split(/\n/);
  // Cut inside the atom_site data rows, before the terminating '#'.
  const cut = lines.slice(0, lines.length - 4).join('\n');
  const result = parser.parseMmCif(cut);
  assert.equal(result.truncated, true);
  assert.ok(result.atoms.length > 0, 'partial atoms should still be parsed');
});

test('extractCA keeps only alpha carbons', () => {
  const result = parser.parseMmCif(sample);
  const ca = parser.extractCA(result.atoms);
  assert.equal(ca.length, 3);
  assert.ok(ca.every((a) => a.atom === 'CA'));
});

test('buildBonds finds intra-residue and peptide bonds only', () => {
  const result = parser.parseMmCif(sample);
  const bonds = bondsMod.buildBonds(result.atoms);
  // 3 (VAL) + 3 (GLY) + 1 (ALA) intra-residue + 1 peptide C-N bridge = 8
  assert.equal(bonds.length, 8);
  // Peptide bridge between VAL A 1 C (index 2) and GLY A 2 N (index 4)
  assert.ok(
    bonds.some(([i, j]) => (i === 2 && j === 4) || (i === 4 && j === 2)),
    'expected peptide bond between VAL C and GLY N'
  );
  // No cross-chain bonds
  for (const [i, j] of bonds) {
    assert.equal(result.atoms[i].chain, result.atoms[j].chain, 'bonds must not cross chains');
  }
  // No hydrogen-hydrogen bonds
  const hh = bonds.filter(([i, j]) => result.atoms[i].el === 'H' && result.atoms[j].el === 'H');
  assert.equal(hh.length, 0);
});

test('toText unwraps observed response shapes', () => {
  assert.equal(parser.toText('raw string'), 'raw string');
  assert.equal(parser.toText({ text: 'a' }), 'a');
  assert.equal(parser.toText({ body: 'b' }), 'b');
  assert.equal(parser.toText({ data: 'c' }), 'c');
  assert.equal(parser.toText({ body: { text: 'd' } }), 'd');
  assert.equal(parser.toText({ data: new TextEncoder().encode('e') }), 'e');
  assert.equal(parser.toText(new TextEncoder().encode('f').buffer), 'f');
  assert.equal(parser.toText({ result: { content: 'g' } }), 'g');
  assert.throws(() => parser.toText(42), /API_NOT_TEXT/);
});

test('normalizePdbId cleans and uppercases input', () => {
  assert.equal(parser.normalizePdbId('1A3N'), '1A3N');
  assert.equal(parser.normalizePdbId(' 1a3n '), '1A3N');
  assert.equal(parser.normalizePdbId('6vxx!'), '6VXX');
  assert.equal(parser.normalizePdbId('1234567890'), '12345678');
});

test('search/lookup helpers parse RCSB responses', () => {
  const entryIds = JSON.parse(parser.buildLookupEntryIds(['1a3n', '4hhb!', '1A3N']));
  assert.deepEqual(entryIds, ['1A3N', '4HHB']);

  const ids = parser.parseSearchResponse({ data: { result_set: [{ identifier: '1a3n' }, { identifier: '4HHB' }, { identifier: '4HHB!' }] } });
  assert.deepEqual(ids, ['1A3N', '4HHB']);

  const items = parser.parseLookupResponse({ body: { data: {
    entries: [
      { rcsb_id: '1A3N', struct: { title: 'DEOXY HUMAN HEMOGLOBIN' }, rcsb_entry_info: { deposited_atom_count: 4997 } }
    ]
  } } });
  assert.equal(items[0].id, '1A3N');
  assert.equal(items[0].title, 'DEOXY HUMAN HEMOGLOBIN');
  assert.equal(items[0].atomCount, 4997);
});

test('real RCSB format: parse a genuine 1A3N excerpt', () => {
  const real = readFileSync(join(root, 'tests', 'fixtures', '1a3n-sample.cif'), 'utf8');
  const result = parser.parseMmCif(real);
  assert.ok(result.atoms.length >= 50, `expected >= 50 atoms, got ${result.atoms.length}`);
  assert.equal(result.truncated, false);
  const first = result.atoms[0];
  assert.ok(Number.isFinite(first.x) && Number.isFinite(first.y) && Number.isFinite(first.z));
  assert.ok(['A', 'B', 'C', 'D'].includes(first.chain));
});
