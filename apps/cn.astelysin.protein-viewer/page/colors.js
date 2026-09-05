// Color palettes for structure rendering. Returns numeric 0xRRGGBB values;
// the renderer wraps them in THREE.Color.
'use strict';

var CPK = {
  H: 0xffffff, C: 0x909090, N: 0x3050f8, O: 0xff0d0d, S: 0xffff30,
  P: 0xff8000, F: 0x90e050, Cl: 0x1ff01f, Br: 0xa62929, I: 0x940094,
  Na: 0xab5cf2, Mg: 0x8aff00, K: 0x8f40d4, Ca: 0x3dff00, Mn: 0x9c7ac7,
  Fe: 0xe06633, Co: 0xf090a0, Ni: 0x50d050, Cu: 0xc88033, Zn: 0x7d80b0,
  Se: 0xffa100, B: 0xffb5b5, default: 0xe0e0e0
};

function colorForElement(el) {
  var value = CPK[el];
  return value !== undefined ? value : CPK.default;
}

// High-contrast palette for per-chain coloring. Rotates for chains beyond the
// palette length.
var CHAIN_COLORS = [
  0x4f8cff, 0xff6b6b, 0x51cf66, 0xffd43b, 0xcc5de8, 0x22b8cf,
  0xff922b, 0x9775fa, 0x38d9a9, 0xf06595, 0x74c0fc, 0xebc50f
];

function chainColors(count) {
  var out = [];
  for (var i = 0; i < count; i++) {
    out.push(CHAIN_COLORS[i % CHAIN_COLORS.length]);
  }
  return out;
}

module.exports = { colorForElement: colorForElement, chainColors: chainColors };
