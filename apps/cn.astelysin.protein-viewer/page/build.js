// Geometry helpers for the fixed wireframe representation. The host injects
// THREE through runtimeModules: ["three"].
'use strict';

var THREE = globalThis.THREE;

function ensureThree() {
  if (!THREE && typeof globalThis !== 'undefined') THREE = globalThis.THREE;
  if (!THREE) throw new Error('THREE_MISSING');
}

function distanceBetween(a, b) {
  var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Render detected bonds as line segments. A Cα-only response has no explicit
// bonds, so contiguous residues are connected per chain as a visual fallback.
function makeWireframe(atoms, bonds, colorFor) {
  ensureThree();
  var lineBonds = bonds ? bonds.slice() : [];
  if (!lineBonds.length) {
    var caByChain = {};
    for (var c = 0; c < atoms.length; c++) {
      if (atoms[c].atom !== 'CA') continue;
      if (!caByChain[atoms[c].chain]) caByChain[atoms[c].chain] = [];
      caByChain[atoms[c].chain].push(c);
    }
    Object.keys(caByChain).forEach(function (chain) {
      var list = caByChain[chain].sort(function (a, b) { return atoms[a].resi - atoms[b].resi; });
      for (var s = 0; s < list.length - 1; s++) {
        var current = atoms[list[s]], next = atoms[list[s + 1]];
        if (next.resi - current.resi === 1 && distanceBetween(next, current) < 5.5) {
          lineBonds.push([list[s], list[s + 1]]);
        }
      }
    });
  }

  var positions = [];
  var vertexColors = [];
  for (var i = 0; i < lineBonds.length; i++) {
    var p = atoms[lineBonds[i][0]], q = atoms[lineBonds[i][1]];
    positions.push(p.x, p.y, p.z, q.x, q.y, q.z);
    var pColor = new THREE.Color(colorFor(p, lineBonds[i][0]));
    var qColor = new THREE.Color(colorFor(q, lineBonds[i][1]));
    vertexColors.push(pColor.r, pColor.g, pColor.b, qColor.r, qColor.g, qColor.b);
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  var material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92 });
  return new THREE.LineSegments(geometry, material);
}

function computeBounds(atoms) {
  ensureThree();
  if (!atoms.length) return { center: new THREE.Vector3(), radius: 1 };
  var minX = Infinity, minY = Infinity, minZ = Infinity;
  var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (var i = 0; i < atoms.length; i++) {
    var atom = atoms[i];
    if (atom.x < minX) minX = atom.x; if (atom.x > maxX) maxX = atom.x;
    if (atom.y < minY) minY = atom.y; if (atom.y > maxY) maxY = atom.y;
    if (atom.z < minZ) minZ = atom.z; if (atom.z > maxZ) maxZ = atom.z;
  }
  var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  var radius = Math.sqrt(Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2) + Math.pow(maxZ - minZ, 2)) / 2;
  return { center: new THREE.Vector3(cx, cy, cz), radius: Math.max(radius, 0.5) };
}

function disposeObject(object) {
  if (!object) return;
  if (object.geometry && typeof object.geometry.dispose === 'function') object.geometry.dispose();
  if (object.material) {
    var materials = Array.isArray(object.material) ? object.material : [object.material];
    for (var i = 0; i < materials.length; i++) {
      if (materials[i] && typeof materials[i].dispose === 'function') materials[i].dispose();
    }
  }
  if (object.children) {
    for (var c = 0; c < object.children.length; c++) disposeObject(object.children[c]);
  }
}

module.exports = {
  makeWireframe: makeWireframe,
  computeBounds: computeBounds,
  disposeObject: disposeObject
};
