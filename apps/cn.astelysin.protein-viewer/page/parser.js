// Shared mmCIF / structure parsing for the 3D protein viewer.
// CommonJS so the sandbox require graph and the node test suite can load the
// same implementation.
'use strict';

var ATOM_SITE = '_atom_site.';
var NON_POLYMER_WATER = { HOH: true, H2O: true, WATER: true };

function normalizeElement(typeSymbol, labelAtomId) {
  var symbol = String(typeSymbol || '').trim();
  if (/^[A-Za-z]{1,2}$/.test(symbol)) return symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase();
  var label = String(labelAtomId || '').trim();
  if (label) return label.charAt(0).toUpperCase();
  return 'C';
}

function cleanQuoted(value) {
  var text = String(value || '').trim();
  if (text.length >= 2 && text.charAt(0) === '"' && text.charAt(text.length - 1) === '"') {
    text = text.slice(1, -1);
  } else if (text.length >= 2 && text.charAt(0) === "'" && text.charAt(text.length - 1) === "'") {
    text = text.slice(1, -1);
  }
  return text;
}

// Parse the atom_site loop of an mmCIF string. Ignores alternate conformations,
// waters and malformed rows. `truncated` is set when the atom_site loop runs off
// the end of the text without a terminating `#` (e.g. a sandboxed 2 MiB response
// was cut mid-loop).
function parseMmCif(text) {
  if (typeof text !== 'string') {
    throw new Error('MMCIF_NOT_STRING');
  }
  var lines = text.split(/\r?\n/);
  var atoms = [];
  var title = null;
  var truncated = false;

  for (var li = 0; li < lines.length; li++) {
    var line = lines[li];
    if (line.indexOf('_struct.title') === 0) {
      title = cleanQuoted(line.slice('_struct.title'.length));
      break;
    }
  }

  var i = 0;
  while (i < lines.length) {
    var current = lines[i];
    if (current.indexOf('loop_') === 0) {
      var cols = [];
      var j = i + 1;
      while (j < lines.length && lines[j].indexOf('_') === 0) {
        cols.push(lines[j].trim());
        j++;
      }
      var isAtomSite = false;
      for (var c = 0; c < cols.length; c++) {
        if (cols[c].indexOf(ATOM_SITE) === 0) { isAtomSite = true; break; }
      }
      if (!isAtomSite) { i = j; continue; }

      var idx = {};
      for (var c2 = 0; c2 < cols.length; c2++) {
        idx[cols[c2].slice(ATOM_SITE.length)] = c2;
      }
      var need = ['group_PDB', 'type_symbol', 'label_atom_id', 'label_comp_id',
        'label_asym_id', 'label_seq_id', 'Cartn_x', 'Cartn_y', 'Cartn_z'];
      var missing = false;
      for (var n = 0; n < need.length; n++) {
        if (!(need[n] in idx)) { missing = true; break; }
      }
      if (missing) { i = j; continue; }

      var altIdx = idx.label_alt_id;
      var terminated = false;
      var k = j;
      while (k < lines.length) {
        var data = lines[k];
        var trimmed = data.trim();
        if (trimmed === '' || trimmed === '#') {
          terminated = true;
          k++;
          break;
        }
        var tok = data.trim().split(/\s+/);
        if (tok.length > Math.max(idx.Cartn_z, idx.label_seq_id)) {
          var group = tok[idx.group_PDB];
          if (group === 'ATOM' || group === 'HETATM') {
            var alt = altIdx !== undefined ? tok[altIdx] : '.';
            if (alt === '.' || alt === '?') {
              var comp = cleanQuoted(tok[idx.label_comp_id]);
              if (!NON_POLYMER_WATER[comp]) {
                var resi = parseInt(tok[idx.label_seq_id], 10);
                atoms.push({
                  el: normalizeElement(tok[idx.type_symbol], tok[idx.label_atom_id]),
                  atom: cleanQuoted(tok[idx.label_atom_id]),
                  x: parseFloat(tok[idx.Cartn_x]),
                  y: parseFloat(tok[idx.Cartn_y]),
                  z: parseFloat(tok[idx.Cartn_z]),
                  chain: cleanQuoted(tok[idx.label_asym_id]),
                  resn: comp,
                  resi: Number.isFinite(resi) ? resi : 0,
                  kind: group === 'HETATM' ? 'ligand' : 'polymer'
                });
              }
            }
          }
        }
        k++;
      }
      truncated = truncated || !terminated;
      i = k;
      continue;
    }
    i++;
  }

  if (!atoms.length) {
    throw new Error('MMCIF_NO_ATOMS');
  }
  return { title: title, atoms: atoms, truncated: truncated };
}

// Reduce a structure to its alpha-carbon backbone (one atom per residue).
function extractCA(atoms) {
  var out = [];
  for (var i = 0; i < atoms.length; i++) {
    if (atoms[i].atom === 'CA') out.push(atoms[i]);
  }
  return out;
}

// Defensively unwrap a Tapp.api response into a text string. Depending on the
// host bridge, a text body may arrive as a string, a nested wrapper, or bytes.
function asBytes(value) {
  var bytes = null;
  var tag = Object.prototype.toString.call(value);
  if (typeof ArrayBuffer !== 'undefined' && (value instanceof ArrayBuffer || tag === '[object ArrayBuffer]')) {
    bytes = new Uint8Array(value);
  } else if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(value)) {
    bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  } else if (Array.isArray(value) && value.length && value.every(function (item) {
    return Number.isInteger(item) && item >= 0 && item <= 255;
  })) {
    bytes = new Uint8Array(value);
  }
  return bytes;
}

function decodeBytes(value) {
  var bytes = asBytes(value);
  if (!bytes) return null;
  if (typeof TextDecoder === 'function') return new TextDecoder('utf-8').decode(bytes);
  var out = '';
  for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function toText(result) {
  var queue = [result];
  var seen = [];
  while (queue.length) {
    var current = queue.shift();
    if (typeof current === 'string') return current;
    var decoded = decodeBytes(current);
    if (decoded !== null) return decoded;
    if (!current || typeof current !== 'object' || seen.indexOf(current) !== -1) continue;
    seen.push(current);
    if (typeof current.text === 'string') return current.text;
    ['body', 'data', 'content', 'result'].forEach(function (key) {
      if (current[key] !== undefined && current[key] !== null) queue.push(current[key]);
    });
  }
  throw new Error('API_NOT_TEXT');
}

function normalizePdbId(input) {
  return String(input || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function unwrapStructuredResponse(result, field) {
  var current = result;
  var seen = [];
  for (var depth = 0; depth < 8; depth++) {
    if (!current || typeof current !== 'object') break;
    if (Array.isArray(current[field])) return current;
    if (seen.indexOf(current) !== -1) break;
    seen.push(current);
    var next = current.data;
    if (next === undefined) next = current.body;
    if (next === undefined) next = current.result;
    if (next === undefined) next = current.content;
    if (next === undefined) break;
    current = next;
  }
  return current && typeof current === 'object' ? current : {};
}

// Build the JSON array injected into the manifest's fixed GraphQL query.
function buildLookupEntryIds(ids) {
  var normalized = [];
  var seen = {};
  for (var i = 0; i < (Array.isArray(ids) ? ids.length : 0); i++) {
    var id = normalizePdbId(ids[i]);
    if (id && !seen[id]) { seen[id] = true; normalized.push(id); }
  }
  return JSON.stringify(normalized);
}

function parseSearchResponse(result) {
  var root = unwrapStructuredResponse(result, 'result_set');
  if (!Array.isArray(root.result_set)) throw new Error('SEARCH_BAD_RESPONSE');
  var ids = [];
  var seen = {};
  for (var i = 0; i < root.result_set.length; i++) {
    var id = normalizePdbId(root.result_set[i] && root.result_set[i].identifier);
    if (id && !seen[id]) { seen[id] = true; ids.push(id); }
  }
  return ids;
}

function parseLookupResponse(result) {
  var root = unwrapStructuredResponse(result, 'entries');
  var list = Array.isArray(root.entries) ? root.entries : [];
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i] || {};
    var count = item.rcsb_entry_info && item.rcsb_entry_info.deposited_atom_count;
    var id = normalizePdbId(item.rcsb_id);
    if (!id) continue;
    out.push({
      id: id,
      title: (item.struct && item.struct.title) || '',
      atomCount: typeof count === 'number' ? count : 0
    });
  }
  return out;
}

module.exports = {
  parseMmCif: parseMmCif,
  extractCA: extractCA,
  toText: toText,
  normalizePdbId: normalizePdbId,
  buildLookupEntryIds: buildLookupEntryIds,
  parseSearchResponse: parseSearchResponse,
  parseLookupResponse: parseLookupResponse
};
