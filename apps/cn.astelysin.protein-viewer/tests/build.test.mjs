// Focused geometry checks for the only supported representation: wireframe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(value) { this.x = value.x; this.y = value.y; this.z = value.z; return this; }
}
class Color {
  constructor(value) {
    this.r = ((value >> 16) & 255) / 255;
    this.g = ((value >> 8) & 255) / 255;
    this.b = (value & 255) / 255;
  }
}
class BufferGeometry {
  constructor() { this.attributes = {}; this.disposed = false; }
  setAttribute(name, value) { this.attributes[name] = value; }
  dispose() { this.disposed = true; }
}
class Float32BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; }
}
class LineBasicMaterial {
  constructor(options) { this.options = options; this.disposed = false; }
  dispose() { this.disposed = true; }
}
class LineSegments {
  constructor(geometry, material) { this.geometry = geometry; this.material = material; }
}

globalThis.THREE = { Vector3, Color, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments };
const build = require(join(root, 'page', 'build.js'));
const parser = require(join(root, 'page', 'parser.js'));
const bondsMod = require(join(root, 'page', 'bonds.js'));
const sample = readFileSync(join(root, 'tests', 'fixtures', 'sample.cif'), 'utf8');
const atoms = parser.parseMmCif(sample).atoms;
const colorFor = () => 0x123456;

test('makeWireframe creates colored line segments from detected bonds', () => {
  const bonds = bondsMod.buildBonds(atoms);
  const line = build.makeWireframe(atoms, bonds, colorFor);

  assert.equal(line.geometry.attributes.position.array.length, bonds.length * 6);
  assert.equal(line.geometry.attributes.color.array.length, bonds.length * 6);
  assert.equal(line.material.options.vertexColors, true);
});

test('makeWireframe connects only contiguous nearby residues for C-alpha data', () => {
  const caAtoms = [
    { atom: 'CA', chain: 'A', resi: 1, x: 0, y: 0, z: 0 },
    { atom: 'CA', chain: 'A', resi: 2, x: 3.8, y: 0, z: 0 },
    { atom: 'CA', chain: 'A', resi: 8, x: 7.6, y: 0, z: 0 },
    { atom: 'CA', chain: 'B', resi: 1, x: 0, y: 4, z: 0 }
  ];
  const line = build.makeWireframe(caAtoms, [], colorFor);

  assert.deepEqual(line.geometry.attributes.position.array, [0, 0, 0, 3.8, 0, 0]);
});

test('computeBounds returns a finite center and covering radius', () => {
  const bounds = build.computeBounds(atoms);

  assert.ok(Number.isFinite(bounds.center.x) && Number.isFinite(bounds.center.y) && Number.isFinite(bounds.center.z));
  assert.ok(bounds.radius >= 10, `radius should cover spread atoms, got ${bounds.radius}`);
  assert.ok(Math.abs(bounds.center.x - 19.5) < 1e-9, `center.x = ${bounds.center.x}`);
});

test('computeBounds returns a stable empty bound', () => {
  const bounds = build.computeBounds([]);
  assert.deepEqual(bounds.center, new Vector3());
  assert.equal(bounds.radius, 1);
});

test('disposeObject releases nested geometry and material arrays', () => {
  const rootGeometry = new BufferGeometry();
  const firstMaterial = new LineBasicMaterial({});
  const secondMaterial = new LineBasicMaterial({});
  const childGeometry = new BufferGeometry();
  const childMaterial = new LineBasicMaterial({});
  const object = {
    geometry: rootGeometry,
    material: [firstMaterial, secondMaterial],
    children: [{ geometry: childGeometry, material: childMaterial, children: [] }]
  };

  build.disposeObject(object);

  assert.equal(rootGeometry.disposed, true);
  assert.equal(firstMaterial.disposed, true);
  assert.equal(secondMaterial.disposed, true);
  assert.equal(childGeometry.disposed, true);
  assert.equal(childMaterial.disposed, true);
});
