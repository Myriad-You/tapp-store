// ========================================
// Crypto 页面模块（纯 JS 加密工具）
// SHA-256 + HMAC-SHA256 + MD5
// ========================================

(function () {
  // ---- SHA-256 ----
  var K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  function utf8Bytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) bytes.push(code);
      else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      else if (code < 0xd800 || code >= 0xe000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      else {
        i++;
        var low = str.charCodeAt(i);
        var cp = 0x10000 + (((code & 0x3ff) << 10) | (low & 0x3ff));
        bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      }
    }
    return bytes;
  }

  function bytesToWords(bytes) {
    var words = [];
    for (var i = 0; i < bytes.length; i += 4) {
      words.push((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]);
    }
    return words;
  }

  function sha256(message) {
    var bytes = typeof message === 'string' ? utf8Bytes(message) : message;
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0);
    bytes.push(0, 0, 0, 0, 0, 0, 0, 0);
    // high 32 bits, low 32 bits of bit length
    var hi = Math.floor(bitLen / 0x100000000);
    var lo = bitLen >>> 0;
    bytes[bytes.length - 8] = (hi >>> 24) & 0xff;
    bytes[bytes.length - 7] = (hi >>> 16) & 0xff;
    bytes[bytes.length - 6] = (hi >>> 8) & 0xff;
    bytes[bytes.length - 5] = hi & 0xff;
    bytes[bytes.length - 4] = (lo >>> 24) & 0xff;
    bytes[bytes.length - 3] = (lo >>> 16) & 0xff;
    bytes[bytes.length - 2] = (lo >>> 8) & 0xff;
    bytes[bytes.length - 1] = lo & 0xff;

    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    for (var chunk = 0; chunk < bytes.length; chunk += 64) {
      var w = new Array(64);
      for (var i = 0; i < 16; i++) {
        var b = chunk + i * 4;
        w[i] = (bytes[b] << 24) | (bytes[b + 1] << 16) | (bytes[b + 2] << 8) | bytes[b + 3];
      }
      for (var j = 16; j < 64; j++) {
        var s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

      for (var t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K256[t] + w[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;

        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }

      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }

    var out = [h0, h1, h2, h3, h4, h5, h6, h7];
    var hex = '';
    for (var k = 0; k < out.length; k++) {
      var v = out[k] >>> 0;
      hex += ('00000000' + v.toString(16)).slice(-8);
    }
    return hex;
  }

  function hmacSha256(key, message) {
    var blockSize = 64;
    var keyBytes = typeof key === 'string' ? utf8Bytes(key) : key;
    var msgBytes = typeof message === 'string' ? utf8Bytes(message) : message;

    if (keyBytes.length > blockSize) {
      keyBytes = hexToBytes(sha256(keyBytes));
    }
    while (keyBytes.length < blockSize) keyBytes.push(0);

    var oKeyPad = [], iKeyPad = [];
    for (var i = 0; i < blockSize; i++) {
      oKeyPad[i] = keyBytes[i] ^ 0x5c;
      iKeyPad[i] = keyBytes[i] ^ 0x36;
    }

    var inner = sha256(iKeyPad.concat(msgBytes));
    var outer = sha256(oKeyPad.concat(hexToBytes(inner)));
    return outer;
  }

  function hexToBytes(hex) {
    var bytes = [];
    for (var i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }

  // ---- MD5 ----
  function rotateLeft(x, c) { return (x << c) | (x >>> (32 - c)); }

  function md5(message) {
    var msg = typeof message === 'string' ? utf8Bytes(message) : message;
    var msgLen = msg.length;
    var bitLen = msgLen * 8;
    msg.push(0x80);
    while ((msg.length % 64) !== 56) msg.push(0);
    var hi = Math.floor(bitLen / 0x100000000);
    var lo = bitLen >>> 0;
    msg.push((lo >>> 0) & 0xff, (lo >>> 8) & 0xff, (lo >>> 16) & 0xff, (lo >>> 24) & 0xff);
    msg.push((hi >>> 0) & 0xff, (hi >>> 8) & 0xff, (hi >>> 16) & 0xff, (hi >>> 24) & 0xff);

    var s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    var K = [];
    for (var k = 0; k < 64; k++) {
      K[k] = Math.floor(Math.abs(Math.sin(k + 1)) * 0x100000000);
    }

    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

    for (var chunk = 0; chunk < msg.length; chunk += 64) {
      var M = [];
      for (var i = 0; i < 16; i++) {
        var b = chunk + i * 4;
        M.push((msg[b + 3] << 24) | (msg[b + 2] << 16) | (msg[b + 1] << 8) | msg[b]);
      }
      var A = a0, B = b0, C = c0, D = d0;
      for (var t = 0; t < 64; t++) {
        var F, g;
        if (t < 16) { F = (B & C) | (~B & D); g = t; }
        else if (t < 32) { F = (D & B) | (~D & C); g = (5 * t + 1) % 16; }
        else if (t < 48) { F = B ^ C ^ D; g = (3 * t + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * t) % 16; }
        F = (F + A + K[t] + M[g]) | 0;
        A = D; D = C; C = B;
        B = (B + rotateLeft(F, s[t])) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }

    var words = [a0, b0, c0, d0];
    var hex = '';
    for (var k = 0; k < 4; k++) {
      var v = words[k] >>> 0;
      for (var b3 = 0; b3 < 4; b3++) {
        var byte = (v >>> (b3 * 8)) & 0xff;
        hex += (byte < 16 ? '0' : '') + byte.toString(16);
      }
    }
    return hex;
  }

  window.__arkCrypto = {
    sha256: sha256,
    hmacSha256: hmacSha256,
    md5: md5
  };
})();
