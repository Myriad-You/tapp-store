(function (global) {
  'use strict';

  function encode(value) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value);
    var binary = unescape(encodeURIComponent(value));
    return Uint8Array.from(binary, function (character) { return character.charCodeAt(0); });
  }

  function byteLength(value) {
    return encode(value).length;
  }

  function checksum(value) {
    var hash = 2166136261;
    encode(value).forEach(function (byte) {
      hash ^= byte;
      hash = Math.imul(hash, 16777619);
    });
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function splitUtf8(value, maximum) {
    var chunks = [];
    var current = '';
    var currentBytes = 0;
    Array.from(value).forEach(function (character) {
      var size = byteLength(character);
      if (size > maximum) throw new RangeError('Storage chunk limit is too small');
      if (current && currentBytes + size > maximum) {
        chunks.push(current);
        current = '';
        currentBytes = 0;
      }
      current += character;
      currentBytes += size;
    });
    if (current || value === '') chunks.push(current);
    return chunks;
  }

  function createStore(adapter, options) {
    if (!adapter || typeof adapter.get !== 'function' || typeof adapter.set !== 'function') {
      throw new TypeError('Storage adapter is invalid');
    }
    var settings = Object.assign({
      prefix: 'railway-studio.project',
      chunkBytes: 768 * 1024,
      totalBytes: 7 * 1024 * 1024,
      revisionFactory: function () { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
    }, options || {});
    var activeKey = settings.prefix + '.active';
    var saveQueue = Promise.resolve();

    function revisionPrefix(revision) {
      return settings.prefix + '.rev.' + revision;
    }

    async function loadRevision(revision) {
      var prefix = revisionPrefix(revision);
      var manifestText = await adapter.get(prefix + '.manifest');
      if (typeof manifestText !== 'string') throw new Error('Missing snapshot manifest');
      var manifest;
      try { manifest = JSON.parse(manifestText); }
      catch (error) { throw new Error('Snapshot manifest is corrupt'); }
      if (manifest.revision !== revision || !Number.isInteger(manifest.chunks) || manifest.chunks < 1) throw new Error('Snapshot manifest is corrupt');
      var chunks = [];
      for (var index = 0; index < manifest.chunks; index += 1) {
        var chunk = await adapter.get(prefix + '.chunk.' + index);
        if (typeof chunk !== 'string') throw new Error('Missing snapshot chunk ' + index);
        chunks.push(chunk);
      }
      var content = chunks.join('');
      if (byteLength(content) !== manifest.byteLength || checksum(content) !== manifest.checksum) {
        throw new Error('Snapshot checksum mismatch');
      }
      return content;
    }

    async function removeRevision(revision) {
      if (typeof adapter.remove !== 'function') return;
      var prefix = revisionPrefix(revision);
      if (typeof adapter.list === 'function') {
        var keys = await adapter.list(prefix);
        await Promise.all(keys.map(function (key) { return adapter.remove(key); }));
      }
    }

    async function cleanupOtherRevisions(activeRevision) {
      if (typeof adapter.list !== 'function' || typeof adapter.remove !== 'function') return;
      var prefix = settings.prefix + '.rev.';
      var keys = await adapter.list(prefix);
      var keep = revisionPrefix(activeRevision) + '.';
      await Promise.all(keys.filter(function (key) { return !key.startsWith(keep); }).map(function (key) { return adapter.remove(key); }));
    }

    async function writeSnapshot(content) {
      if (typeof content !== 'string') throw new TypeError('Snapshot content must be text');
      var revision = settings.revisionFactory();
      if (!/^[a-zA-Z0-9._-]{1,80}$/.test(revision)) throw new TypeError('Snapshot revision is invalid');
      var chunks = splitUtf8(content, settings.chunkBytes);
      var manifest = {
        revision: revision,
        chunks: chunks.length,
        byteLength: byteLength(content),
        checksum: checksum(content)
      };
      var manifestText = JSON.stringify(manifest);
      var estimatedBytes = manifest.byteLength + byteLength(manifestText) + byteLength(revision) + chunks.length * 48;
      if (estimatedBytes > settings.totalBytes) throw new RangeError('Snapshot exceeds storage budget');

      var prefix = revisionPrefix(revision);
      try {
        for (var index = 0; index < chunks.length; index += 1) {
          await adapter.set(prefix + '.chunk.' + index, chunks[index]);
        }
        await adapter.set(prefix + '.manifest', manifestText);
        await loadRevision(revision);
        await adapter.set(activeKey, revision);
      } catch (error) {
        await removeRevision(revision);
        throw error;
      }
      try { await cleanupOtherRevisions(revision); }
      catch (_) {}
      return manifest;
    }

    function save(content) {
      var result = saveQueue.then(function () { return writeSnapshot(content); });
      saveQueue = result.catch(function () {});
      return result;
    }

    async function load() {
      var revision = await adapter.get(activeKey);
      if (revision === null || typeof revision === 'undefined' || revision === '') return null;
      if (typeof revision !== 'string') throw new Error('Active snapshot pointer is corrupt');
      return loadRevision(revision);
    }

    return { save: save, load: load };
  }

  var api = { createStore: createStore };
  global.RailwayStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
