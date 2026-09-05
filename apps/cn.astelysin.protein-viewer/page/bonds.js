// Covalent bond detection for ball-and-stick rendering.
// Pure logic, shared by the sandbox renderer and the node test suite.
'use strict';

var COVALENT = {
  H: 0.31, C: 0.76, N: 0.71, O: 0.66, F: 0.57, P: 1.07, S: 1.05,
  Cl: 1.02, Br: 1.20, I: 1.39, Na: 1.66, Mg: 1.41, Fe: 1.32, Zn: 1.39,
  Ca: 1.47, K: 2.03, Mn: 1.39, Cu: 1.32, Se: 1.20, B: 0.84, default: 1.0
};

function covalentRadius(el) {
  return COVALENT[el] !== undefined ? COVALENT[el] : COVALENT.default;
}

// Main-chain atoms bond only via the known backbone pattern (N-CA, CA-C, C-O);
// a plain distance test would create false bonds (e.g. CA-O sits ~1.4 A apart).
var MAINCHAIN = { N: 1, CA: 1, C: 1, O: 1 };
var MAINCHAIN_KEYS = { 'CA:N': 1, 'C:CA': 1, 'C:O': 1 };

function pairKey(a, b) { return a < b ? a + ':' + b : b + ':' + a; }
function distance(a, b) {
  var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Intra-residue: backbone pairs only through the white-list; everything else
// uses a distance criterion. Hydrogen pairs are never bonded.
function intraBonded(a, b) {
  if (a.el === 'H' && b.el === 'H') return false;
  if (MAINCHAIN[a.atom] && MAINCHAIN[b.atom]) {
    return !!MAINCHAIN_KEYS[pairKey(a.atom, b.atom)] && distance(a, b) < 2.0;
  }
  return distance(a, b) < covalentRadius(a.el) + covalentRadius(b.el) + 0.45;
}

// Inter-residue: only the peptide C-N bridge or the phosphodiester O3'-P
// bridge. A blanket distance test would bond H-bonded neighbors and other
// near-contacts (CA-N, O-N, ...) into false bonds.
function interBonded(prev, next) {
  if (prev.el === 'H' && next.el === 'H') return false;
  if (prev.atom === 'C' && next.atom === 'N') return distance(prev, next) < 1.9;
  if (prev.atom === "O3'" && next.atom === 'P') return distance(prev, next) < 2.0;
  return false;
}

// Bonds: intra-residue pairs plus peptide/phosphodiester bridges between
// adjacent residues of the same chain.
function buildBonds(atoms) {
  var bonds = [];
  var seen = {};
  var groups = {};
  var chainMap = {};

  for (var i = 0; i < atoms.length; i++) {
    var atom = atoms[i];
    var key = atom.chain + '|' + atom.resi;
    if (!groups[key]) groups[key] = [];
    groups[key].push(i);
    if (!chainMap[atom.chain]) chainMap[atom.chain] = [];
  }

  var chains = Object.keys(chainMap);
  for (var c = 0; c < chains.length; c++) {
    chainMap[chains[c]] = [];
  }
  for (var g in groups) {
    var sep = g.lastIndexOf('|');
    var chainKey = g.slice(0, sep);
    var resi = parseInt(g.slice(sep + 1), 10);
    chainMap[chainKey].push({ resi: resi, indices: groups[g] });
  }
  for (var c2 = 0; c2 < chains.length; c2++) {
    chainMap[chains[c2]].sort(function (a, b) { return a.resi - b.resi; });
  }

  function add(i, j) {
    var lo = i < j ? i : j;
    var hi = i < j ? j : i;
    var s = lo + ':' + hi;
    if (seen[s]) return;
    seen[s] = true;
    bonds.push([lo, hi]);
  }

  for (var key in groups) {
    var list = groups[key];
    for (var m = 0; m < list.length; m++) {
      for (var n = m + 1; n < list.length; n++) {
        if (intraBonded(atoms[list[m]], atoms[list[n]])) add(list[m], list[n]);
      }
    }
  }

  for (var ch = 0; ch < chains.length; ch++) {
    var residues = chainMap[chains[ch]];
    for (var r = 0; r < residues.length - 1; r++) {
      var a = residues[r], b = residues[r + 1];
      if (Math.abs(b.resi - a.resi) !== 1) continue;
      for (var m2 = 0; m2 < a.indices.length; m2++) {
        for (var n2 = 0; n2 < b.indices.length; n2++) {
          if (interBonded(atoms[a.indices[m2]], atoms[b.indices[n2]])) add(a.indices[m2], b.indices[n2]);
        }
      }
    }
  }

  return bonds;
}

module.exports = { buildBonds: buildBonds };
