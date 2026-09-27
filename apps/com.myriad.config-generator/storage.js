/* Canonical backend storage shared by fresh generation, imports and host instructions. */
'use strict';
var BUSINESS = ['backend', 'backend-volume-init', 'persona-worker', 'federation-worker'];
function supportsBind(tag) {
  var m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag || '');
  return !!m && (+m[1] > 0 || +m[2] > 5 || (+m[2] === 5 && +m[3] >= 8));
}
function layout(kind, data, cache) { return {kind:kind || 'bind', data:data || './data', cache:cache || './cache'}; }
function mounts(storage, service) {
  function entry(key, target, child, readonly) {
    var m = {type:storage.kind, source:storage[key], target:target};
    if (readonly) m.read_only = true;
    if (storage.kind === 'bind') {if (child) m.source += '/' + child; m.bind = {create_host_path:false};}
    else if (child) m.volume = {subpath:child, nocopy:true};
    return m;
  }
  if (service === 'federation-worker') return [entry('data','/app/data','',true), entry('data','/app/data/federation','federation'), entry('data','/app/data/federation_media','federation_media'), entry('data','/app/data/media','media'), entry('cache','/tmp/cache/images','images')];
  return [entry('cache','/app/cache'), entry('data','/app/data')];
}
function inspect(all, root, volumes) {
  function reject() {throw new Error('services.backend.volumes: unsupported or inconsistent storage; preserve original data and review manually');}
  var backend = all.backend || [];
  var data = backend.filter(function(m){return m.target === '/app/data';});
  var cache = backend.filter(function(m){return m.target === '/app/cache';});
  if (backend.length !== 2 || data.length !== 1 || cache.length !== 1 || data[0].type !== cache[0].type) reject();
  var storage = layout(data[0].type, data[0].source, cache[0].source);
  if (['bind','volume'].indexOf(storage.kind) < 0) reject();
  ['data','cache'].forEach(function(key){
    if (storage.kind === 'bind') {
      if (storage[key] !== './'+key && !(root[0] === '/' && storage[key] === root+'/'+key)) reject();
    } else if (storage[key] !== 'backend_'+key || !Object.prototype.hasOwnProperty.call(volumes, storage[key])) reject();
  });
  if (storage.kind === 'bind' && Object.keys(volumes).length) reject();
  BUSINESS.forEach(function(service){
    var actual = all[service]; if (!actual || !actual.length && service !== 'backend') return;
    var expected = mounts(storage,service), seen = {};
    if (actual.length !== expected.length) reject();
    function absolute(source) {return typeof source === 'string' && source.indexOf('./') === 0 && root[0] === '/' ? root + source.slice(1) : source;}
    actual.forEach(function(m){
      var e = expected.filter(function(item){return item.target === m.target;})[0];
      if (!e || seen[m.target] || m.type !== e.type || absolute(m.source) !== absolute(e.source) || (m.read_only || false) !== (e.read_only || false)) reject();
      seen[m.target] = true;
      if (Object.keys(m).some(function(k){return ['type','source','target','read_only','bind','volume','options'].indexOf(k) < 0;})) reject();
      if (m.options && !/^(?:ro|rw)$/.test(m.options)) reject();
      if (m.bind && (typeof m.bind !== 'object' || Array.isArray(m.bind) || storage.kind !== 'bind' || Object.keys(m.bind).some(function(k){return k !== 'create_host_path';}) || m.bind.create_host_path !== undefined && m.bind.create_host_path !== false)) reject();
      if (e.volume) {if (!m.volume || m.volume.subpath !== e.volume.subpath || m.volume.nocopy !== true || Object.keys(m.volume).length !== 2) reject();}
      else if (m.volume) reject();
    });
  });
  storage.existing = true;
  return storage;
}
function quote(value) {return "'" + String(value).replace(/'/g, "'\\''") + "'";}
function preparation(storage, root, project) {
  storage = storage || layout(); project = project || 'myriad';
  if (!/^\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(root) || !/^[a-z0-9][a-z0-9_-]*$/.test(project)) throw new Error('Invalid storage deployment identity');
  var lines = ['# BEGIN MYRIAD STORAGE PREPARATION', "sh -eu <<'MYRIAD_STORAGE_PREP' || exit 1", 'cd '+quote(root), '[ "$(pwd -P)" = '+quote(root)+' ] || { echo "Deployment directory must not contain symlinks" >&2; exit 1; }'];
  if (storage.kind === 'bind') {
    lines.push('# Compose-local data/cache requires stable updater/Guard v0.5.8+.', '# Prepare child sources before Compose creates worker containers.', 'storage_volumes=$(docker volume ls --format "{{.Name}}")');
    ['data','cache'].forEach(function(key){
      lines.push('if printf "%s\\n" "$storage_volumes" | grep -Fxq '+quote(project+'_backend_'+key)+'; then echo "Legacy volume exists; migrate explicitly before using bind storage" >&2; exit 1; fi',
        '[ ! -L '+key+' ] && { [ ! -e '+key+' ] || [ -d '+key+' ]; } || { echo "Storage must be a real directory" >&2; exit 1; }');
      if (storage.existing) lines.push('[ -d '+key+' ] || { echo "Existing storage is missing; restore it first" >&2; exit 1; }');
    });
    lines.push('umask 077', 'mkdir -p data cache');
  } else {
    ['data','cache'].forEach(function(key){
      lines.push('storage_driver=$(docker volume inspect --format \'{{.Driver}} {{json .Options}}\' '+quote(project+'_backend_'+key)+')',
        'case "$storage_driver" in "local null"|"local {}") ;; *) echo "Custom volume driver options require manual verification" >&2; exit 1 ;; esac');
    });
  }
  var mount = function(key){return storage.kind === 'bind' ? '"type=bind,src=$PWD/'+key+',dst=/app/'+key+'"' : quote('type=volume,src='+project+'_backend_'+key+',dst=/app/'+key+',volume-nocopy');};
  lines.push('docker run --rm --network none --mount '+mount('data')+' --mount '+mount('cache')+' alpine:3.20 sh -eu -c '+quote([
    'for dir in /app/data/federation /app/data/federation_media /app/data/media /app/cache/images; do',
    '  [ ! -L "$dir" ] && { [ ! -e "$dir" ] || [ -d "$dir" ]; } || { echo "Storage child must be a real directory" >&2; exit 1; }',
    'done', 'umask 077', 'mkdir -p /app/data/federation /app/data/federation_media /app/data/media /app/cache/images', 'chmod 700 /app/data /app/cache'
  ].join('\n')), 'MYRIAD_STORAGE_PREP', '# END MYRIAD STORAGE PREPARATION');
  return lines.join('\n');
}
function replacePreparation(notes, storage, root, project) {
  return String(notes || '').replace(/# BEGIN MYRIAD STORAGE PREPARATION[\s\S]*?# END MYRIAD STORAGE PREPARATION/g, function(){return preparation(storage,root,project);});
}
module.exports = {BUSINESS:BUSINESS, layout:layout, mounts:mounts, inspect:inspect, supportsBind:supportsBind, preparation:preparation, replacePreparation:replacePreparation};
