import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, realpathSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generate } from './generator-harness.mjs';
const require = createRequire(import.meta.url);
const yaml = require('../vendor/js-yaml.js');
const storage = require('../storage.js');
const engine = require('../upgrade.js');
const targets = {
  'backend': {'/app/data':'./data', '/app/cache':'./cache'},
  'backend-volume-init': {'/app/data':'./data', '/app/cache':'./cache'},
  'persona-worker': {'/app/data':'./data', '/app/cache':'./cache'},
  'federation-worker': {'/app/data':'./data','/app/data/federation':'./data/federation','/app/data/federation_media':'./data/federation_media','/app/data/media':'./data/media','/tmp/cache/images':'./cache/images'}
};
function upgrade(g, legacy) {return engine.upgradeGenerated({compose:g.compose,env:g.env,guardEnv:g.guard,deploy:g.notes},legacy);}
function named(g) {
  const compose = yaml.load(g.compose);
  compose.volumes = {backend_data:{external:true,name:'myriad_backend_data',labels:{keep:'original'}},backend_cache:{driver:'local'}};
  for (const name of storage.BUSINESS) compose.services[name].volumes = storage.mounts({kind:'volume',data:'backend_data',cache:'backend_cache'},name);
  return {compose:yaml.dump(compose),env:g.env};
}
test('fresh storage exactly matches the fixed source/target and readonly boundary',()=>{
  const g=generate(), c=yaml.load(g.compose);
  assert.equal(c.volumes,undefined);
  for(const [name, expected] of Object.entries(targets)) {
    assert.equal(c.services[name].volumes.length,Object.keys(expected).length);
    for(const m of c.services[name].volumes) {
      assert.equal(m.source,expected[m.target]);assert.equal(m.type,'bind');assert.deepEqual(m.bind,{create_host_path:false});
      assert.equal(Boolean(m.read_only),name==='federation-worker'&&m.target==='/app/data');
    }
  }
});
test('directory storage fails closed on old, unknown and prerelease updater targets',()=>{
  for(const tag of ['v0.5.7','0.4.99','latest','dev-abc','v0.5.8-rc.1','v1.0.0-beta','']) assert.throws(()=>generate({updaterTag:tag}),/v0.5.8|storageUpdater/);
  for(const tag of ['v0.5.8','0.5.9','v0.6.0','v1.0.0']) assert.ok(generate({updaterTag:tag}).compose);
  const g=generate(),legacy=engine.inspectLegacy(g.compose,g.env);
  assert.throws(()=>upgrade({...g,env:g.env.replace(/^UPDATER_TAG=.*$/m,'UPDATER_TAG=v0.5.7')},legacy),/v0.5.8/);
});
test('named imports retain definitions and every source; older updater remains usable',()=>{
  const g=generate(),old=named(g),legacy=engine.inspectLegacy(old.compose,old.env);
  const out=upgrade({...g,env:g.env.replace(/^UPDATER_TAG=.*$/m,'UPDATER_TAG=v0.5.7')},legacy);
  const c=yaml.load(out.compose),before=yaml.load(old.compose);
  assert.deepEqual(c.volumes,before.volumes);
  for(const name of storage.BUSINESS) assert.deepEqual(c.services[name].volumes,before.services[name].volumes);
  assert.doesNotMatch(out.deploy,/mkdir -p data cache|type=bind,src=\$PWD\/data/);
  assert.match(out.deploy,/docker volume inspect/);assert.match(out.deploy,/myriad_backend_data/);
  engine.inspectLegacy(out.compose,out.env);
  // Also exercise the complete UI generation entry, not only the pure upgrade helper.
  Object.assign(g.context.upgradeSession,{legacy});g.context.state.updaterTag='v0.5.7';g.context.renderUpgradeReport=()=>{};
  g.context.generateConfigs();
  const result=yaml.load(g.files.get('result-docker-compose').textContent);
  assert.deepEqual(result.volumes,before.volumes);
});
test('direct upgrades preserve absolute sources and require existing roots in instructions',()=>{
  const g=generate(), c=yaml.load(g.compose);
  for(const name of storage.BUSINESS) for(const m of c.services[name].volumes) m.source=m.source.replace('./','/opt/myriad/');
  const legacy=engine.inspectLegacy(yaml.dump(c),g.env),out=upgrade(g,legacy),r=yaml.load(out.compose);
  for(const name of storage.BUSINESS) assert.deepEqual(r.services[name].volumes.sort((a,b)=>a.target.localeCompare(b.target)),c.services[name].volumes.sort((a,b)=>a.target.localeCompare(b.target)));
  assert.equal(r.volumes,undefined);assert.match(out.deploy,/Existing storage is missing/);
});
test('rejects traversal, foreign/mixed/duplicate storage, writable federation root and hidden mount options',()=>{
  const g=generate();
  const edits=[
    c=>c.services.backend.volumes[0].source='./data/../cache',
    c=>c.services.backend.volumes[0].source='/srv/other/cache',
    c=>c.services.backend.volumes[0].type='volume',
    c=>c.services.backend.volumes.push(structuredClone(c.services.backend.volumes[0])),
    c=>c.services.backend.volumes[0].bind.create_host_path=true,
    c=>c.services.backend.volumes[0].bind.propagation='shared',
    c=>c.services.backend.volumes[0].consistency='cached',
    c=>c.services.backend.volumes[0].volume={subpath:'other'},
    c=>c.services['federation-worker'].volumes[0].read_only=false,
    c=>c.services['federation-worker'].volumes[1].source='./data',
    c=>c.services['persona-worker'].volumes[0].read_only=true,
    c=>c.volumes={backend_data:{driver:'local'}}
  ];
  for(const edit of edits){const c=yaml.load(g.compose);edit(c);assert.throws(()=>engine.inspectLegacy(yaml.dump(c),g.env),/volumes/);}
});
test('preparation fails before mkdir when Docker inspection fails',()=>{
  const dir=realpathSync(mkdtempSync(join(tmpdir(),'myriad-storage-shell-')));
  try {
    writeFileSync(join(dir,'docker'),'#!/bin/sh\nexit 42\n',{mode:0o755});
    const result=spawnSync('sh',['-c',storage.preparation(storage.layout(),dir,'myriad')],{env:{...process.env,PATH:dir+':'+process.env.PATH},encoding:'utf8'});
    assert.notEqual(result.status,0);assert.equal(existsSync(join(dir,'data')),false);assert.equal(existsSync(join(dir,'cache')),false);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
if(process.env.MYRIAD_SOURCE_ROOT) test('generated mounts equal the actual Myriad primary and external-db templates',()=>{
  const g=yaml.load(generate().compose);
  for(const file of ['docker-compose.yml','docs/deployment/examples/docker-compose.external-db.example.yml']) {
    const canonical=yaml.load(readFileSync(join(process.env.MYRIAD_SOURCE_ROOT,file),'utf8'));
    for(const name of storage.BUSINESS) {
      const sort=ms=>ms.map(m=>({...m})).sort((a,b)=>a.target.localeCompare(b.target));
      assert.deepEqual(sort(g.services[name].volumes),sort(canonical.services[name].volumes),file+'/'+name);
    }
  }
});

test('persisted handoff selectors cannot bypass the selected updater compatibility floor',()=>{
  const g=generate();
  for(const key of ['MYRIAD_TCB_GUARD_IMAGE','MYRIAD_TCB_UPDATER_IMAGE','MYRIAD_TCB_GATEWAY_IMAGE']) {
    assert.throws(()=>engine.inspectLegacy(g.compose,g.env+'\n'+key+'=old:secret-needle\n'),e=>/handoff-only/.test(e.message)&&!e.message.includes('secret-needle'));
  }
});

test('both host command blocks validate physical storage before other directory writes',()=>{
  const notes=generate().notes;
  const blocks=[...notes.matchAll(/```(?:sh|bash)\n([\s\S]*?)```/g)].map(m=>m[1]).filter(b=>b.includes('# BEGIN MYRIAD STORAGE PREPARATION'));
  assert.equal(blocks.length,2);
  for(const block of blocks) {
    assert.ok(block.indexOf('# END MYRIAD STORAGE PREPARATION') < block.indexOf('chown -R 70:70'));
    assert.match(block,/^cd \S+ \|\| exit 1/m);
  }
});
