(function (global) {
  'use strict';

  var Serialization = global.RailwaySerialization;
  if (!Serialization && typeof require === 'function') Serialization = require('./serialization.js');

  var IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

  function validateImageFile(file, limits) {
    var options = Object.assign({ maxBytes: 32 * 1024 * 1024 }, limits || {});
    if (!file || typeof file.name !== 'string' || typeof file.type !== 'string' || !Number.isFinite(file.size)) {
      throw new TypeError('Image file metadata is invalid');
    }
    if (!IMAGE_TYPES.has(file.type)) throw new TypeError('Unsupported image type');
    if (file.size <= 0) throw new RangeError('Image file is empty');
    if (file.size > options.maxBytes) throw new RangeError('Image exceeds byte limit');
    return { name: file.name, type: file.type, size: file.size };
  }

  function validateImageDimensions(metadata, limits) {
    var options = Object.assign({ maxDimension: 16384, maxPixels: 40000000 }, limits || {});
    if (!metadata || !Number.isInteger(metadata.width) || !Number.isInteger(metadata.height) || metadata.width <= 0 || metadata.height <= 0) {
      throw new TypeError('Image dimensions are invalid');
    }
    if (metadata.width > options.maxDimension || metadata.height > options.maxDimension) throw new RangeError('Image exceeds dimension limit');
    var pixels = metadata.width * metadata.height;
    if (pixels > options.maxPixels) throw new RangeError('Image exceeds pixel limit');
    return { width: metadata.width, height: metadata.height, pixels: pixels };
  }

  function validateImageSignature(buffer, mimeType) {
    if (!(buffer instanceof ArrayBuffer)) throw new TypeError('Image binary content is invalid');
    var bytes = new Uint8Array(buffer);
    var matches = mimeType === 'image/png'
      ? bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
      : mimeType === 'image/jpeg'
        ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : mimeType === 'image/webp' && bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (!matches) throw new TypeError('Image signature does not match declared MIME type');
    return buffer;
  }

  function fileReader(file, method) {
    return new Promise(function (resolve, reject) {
      if (typeof FileReader === 'undefined') return reject(new Error('FileReader is unavailable'));
      var reader = new FileReader();
      reader.onerror = function () { reject(reader.error || new Error('File read failed')); };
      reader.onload = function () { resolve(reader.result); };
      reader[method](file);
    });
  }

  function defaultReadText(file) {
    return fileReader(file, 'readAsText');
  }

  function defaultReadDataUrl(file) {
    return fileReader(file, 'readAsDataURL');
  }

  function defaultReadArrayBuffer(file) {
    return fileReader(file, 'readAsArrayBuffer');
  }

  function defaultDecodeDimensions(dataUrl) {
    return new Promise(function (resolve, reject) {
      if (typeof Image === 'undefined') return reject(new Error('Image decoder is unavailable'));
      var image = new Image();
      image.onload = function () { resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
      image.onerror = function () { reject(new Error('Image decode failed')); };
      image.src = dataUrl;
    });
  }

  async function defaultDigestHex(buffer) {
    if (!global.crypto || !global.crypto.subtle) throw new Error('SHA-256 is unavailable');
    var digest = await global.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest), function (value) { return value.toString(16).padStart(2, '0'); }).join('');
  }

  async function readProjectFile(file, dependencies) {
    var options = dependencies || {};
    if (!file || !Number.isFinite(file.size) || file.size <= 0 || file.size > (options.maxBytes || 10 * 1024 * 1024)) {
      throw new RangeError('Project file size is invalid');
    }
    var readText = options.readText || defaultReadText;
    var text = await readText(file);
    var project = Serialization.parseProjectText(text, { maxBytes: options.maxBytes || 10 * 1024 * 1024 });
    if (typeof options.onAccept === 'function') options.onAccept(project);
    return project;
  }

  async function readImageFile(file, dependencies) {
    var options = dependencies || {};
    var metadata = validateImageFile(file, options);
    var readDataUrl = options.readDataUrl || defaultReadDataUrl;
    var readArrayBuffer = options.readArrayBuffer || defaultReadArrayBuffer;
    var decodeDimensions = options.decodeDimensions || defaultDecodeDimensions;
    var digestHex = options.digestHex || defaultDigestHex;
    var buffer = await readArrayBuffer(file);
    validateImageSignature(buffer, metadata.type);
    var dataUrl = await readDataUrl(file);
    var dimensions = validateImageDimensions(await decodeDimensions(dataUrl), options);
    var digest = await digestHex(buffer);
    if (!/^[a-f0-9]{64}$/i.test(digest)) throw new Error('Image digest is invalid');
    var embedded = metadata.size <= (Number.isFinite(options.embedMaxBytes) ? options.embedMaxBytes : 5 * 1024 * 1024);
    var asset = {
      id: 'asset-' + digest.slice(0, 20).toLowerCase(),
      kind: 'image',
      mode: embedded ? 'embedded' : 'detached',
      name: metadata.name,
      mimeType: metadata.type,
      width: dimensions.width,
      height: dimensions.height,
      byteLength: metadata.size,
      sha256: digest.toLowerCase()
    };
    if (embedded) asset.dataUrl = dataUrl;
    return { asset: asset, previewDataUrl: dataUrl };
  }

  async function downloadText(tapp, content, filename, mimeType) {
    if (typeof content !== 'string') throw new TypeError('Download requires string content');
    if (!tapp || !tapp.file || typeof tapp.file.download !== 'function') throw new Error('Host file download is unavailable');
    if (typeof filename !== 'string' || !filename || /[\\/]|\.\./.test(filename)) throw new TypeError('Download filename is invalid');
    if (typeof mimeType !== 'string' || !mimeType) throw new TypeError('Download MIME type is invalid');
    return tapp.file.download(content, filename, mimeType);
  }

  var api = {
    validateImageFile: validateImageFile,
    validateImageDimensions: validateImageDimensions,
    validateImageSignature: validateImageSignature,
    readProjectFile: readProjectFile,
    readImageFile: readImageFile,
    downloadText: downloadText
  };
  global.RailwayFiles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
