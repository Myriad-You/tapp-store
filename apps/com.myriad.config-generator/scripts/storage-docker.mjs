/** Execute downloaded host preparation against a real Docker daemon. Only owns uniquely named test storage. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, mkdirSync, symlinkSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const storage=createRequire(import.meta.url)('../storage.js');
const root=realpathSync(mkdtempSync(join(tmpdir(),'myriad-storage-docker-')));
const project='generator_storage_'+process.pid;
const volumes=[];
function docker(args) {
  const r=spawnSync('docker',args,{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);return r.stdout.trim();
}
function prep(layout,dir=root,success=true) {
  const r=spawnSync('sh',['-c',storage.preparation(layout,dir,project)],{encoding:'utf8'});
  if(success)assert.equal(r.status,0,r.stderr);else assert.notEqual(r.status,0,'Unsafe storage must reject preparation');
}
function helper(layout,script) {
  const args=['run','--rm','--network','none'];
  for(const key of ['data','cache'])args.push('--mount',layout.kind==='bind'?`type=bind,src=${root}/${key},dst=/app/${key}`:`type=volume,src=${project}_backend_${key},dst=/app/${key},volume-nocopy`);
  return docker([...args,'alpine:3.20','sh','-eu','-c',script]);
}
function workerBoundary(layout) {
  helper(layout,'chown -R 1000:1000 /app/data /app/cache');
  const args=['run','--rm','--network','none','--read-only','--cap-drop','ALL','--user','1000:1000'];
  for(const m of storage.mounts(layout,'federation-worker')) {
    const source=layout.kind==='bind'?root+m.source.slice(1):project+'_'+m.source;
    let spec='type='+m.type+',src='+source+',dst='+m.target;
    if(m.read_only)spec+=',readonly';
    if(m.volume)spec+=',volume-subpath='+m.volume.subpath+',volume-nocopy';
    args.push('--mount',spec);
  }
  docker([...args,'alpine:3.20','sh','-eu','-c',
    'if touch /app/data/forbidden 2>/dev/null; then exit 1; fi; for dir in /app/data/federation /app/data/federation_media /app/data/media /tmp/cache/images; do touch "$dir/allowed"; done']);
}
try {
  docker(['info','--format','{{.ServerVersion}}']);
  const fresh=storage.layout(),existing={...fresh,existing:true};
  prep(existing,root,false);assert.equal(existsSync(join(root,'data')),false);
  // Ancestor/final symlink must fail before data creation.
  const alias=root+'-link';symlinkSync(root,alias);
  try{prep(fresh,alias,false);}finally{rmSync(alias);}
  symlinkSync(root,join(root,'data'));prep(fresh,root,false);rmSync(join(root,'data'));
  prep(fresh);
  helper(fresh,'echo preserved > /app/data/sentinel; chown 1000:1000 /app/data /app/cache; chmod 700 /app/data /app/cache');
  prep(existing);
  assert.equal(helper(fresh,'cat /app/data/sentinel; stat -c %a /app/data /app/cache'),'preserved\n700\n700');
  helper(fresh,'rmdir /app/data/media; ln -s /tmp /app/data/media');prep(existing,root,false);
  helper(fresh,'rm /app/data/media');prep(existing);
  helper(fresh,'rmdir /app/cache/images; touch /app/cache/images');prep(existing,root,false);
  helper(fresh,'rm /app/cache/images');prep(existing);
  workerBoundary(fresh);
  console.log('PASS direct storage: bootstrap, repeat preparation, preservation, private roots, missing roots and symlink/file rejection');
  const named={kind:'volume',data:'backend_data',cache:'backend_cache',existing:true};
  prep(named,root,false);
  assert.ok(!docker(['volume','ls','--format','{{.Name}}']).split('\n').includes(project+'_backend_data'));
  for(const key of ['data','cache']) {const name=project+'_backend_'+key;docker(['volume','create',name]);volumes.push(name);}
  helper(named,'echo original > /app/data/sentinel; chown 1000:1000 /app/data /app/cache; chmod 700 /app/data /app/cache');
  prep(named);prep(named);
  assert.equal(helper(named,'cat /app/data/sentinel; stat -c %a /app/data /app/cache'),'original\n700\n700');
  prep(fresh,root,false); // Refuse implicit migration even if bind roots already exist.
  workerBoundary(named);
  console.log('PASS named storage: missing volumes do not get created, data survives, and bind/legacy collision is rejected');
  docker(['volume','rm',project+'_backend_cache']);
  docker(['volume','create','--opt','type=none','--opt','o=bind','--opt','device='+root,project+'_backend_cache']);
  prep(named,root,false);
  console.log('PASS custom runtime volume options require manual verification');
} finally {
  for(const name of volumes)spawnSync('docker',['volume','rm',name],{encoding:'utf8'});
  // Container-created roots may be uid 1000/0700. Clean only this test-owned mount.
  if(existsSync(root)) {
    spawnSync('docker',['run','--rm','--network','none','--mount',`type=bind,src=${root},dst=/test`,'alpine:3.20','sh','-c','rm -rf /test/data /test/cache'],{encoding:'utf8'});
    rmSync(root,{recursive:true,force:true});
  }
}
