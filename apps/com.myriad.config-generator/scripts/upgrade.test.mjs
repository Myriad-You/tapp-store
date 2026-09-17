import { generate } from './generator-harness.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let engine = {};
try { engine = require('../upgrade.js'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const yaml = require('../vendor/js-yaml.js');
const workerUrls = 'PERSONA_DATABASE_URL=postgres://myriad_persona:persona@postgres/myriad\nFEDERATION_DATABASE_URL=postgres://myriad_federation:federation@postgres/myriad\n';
const oldEnv = "COMPOSE_PROJECT_NAME=original\nJWT_SECRET='jwt+/=$token'\nPOSTGRES_PASSWORD='db+/=$token'\nPOSTGRES_USER=myriad\nPOSTGRES_DB=myriad\nDATABASE_URL='postgres://myriad:db%2B%2F%3D%24token@postgres:5432/myriad'\nUPDATE_TOKEN='old+/=token'\nEXTRA_CUSTOM='keep $literal'\nMYRIAD_TAG=old\n";
function fixture(external = false) {
  const value = { name: 'original', services: {
    backend: { image: 'myriad/backend:old', environment: {DATABASE_URL:'${DATABASE_URL}',JWT_SECRET:'${JWT_SECRET}',MYRIAD_PROCESS_ROLE:'all',CUSTOM_SETTING:'literal$$secret'},volumes:['backend_data:/app/data','backend_cache:/app/cache'],networks:['myriad-net'] },
    proxy: {image:'myriad/proxy:old',ports:['127.0.0.1:18080:80'],volumes:['./state:/state:ro'],networks:['myriad-net','myriad-admin-net']},
    updater: {image:'myriad/updater:old',environment:{UPDATE_TOKEN:'${UPDATE_TOKEN}'},volumes:['.:/host/compose:ro'],networks:['myriad-admin-net','myriad-docker-guard-net']}
  }, volumes: {backend_data:{driver:'local'},backend_cache:{driver:'local'}},networks:{'myriad-net':{name:'myriad-net'},'myriad-admin-net':{name:'myriad-admin-net'},'myriad-docker-guard-net':{name:'myriad-docker-guard-net',internal:true}} };
  if (!external) value.services.postgres = {image:'postgres:18.1-alpine',environment:{POSTGRES_PASSWORD:'${POSTGRES_PASSWORD}',POSTGRES_USER:'${POSTGRES_USER}',POSTGRES_DB:'${POSTGRES_DB}'},volumes:['./pgdata:/var/lib/postgresql'],networks:['myriad-net']};
  return value;
}
function generated(external = false) {
  const c = fixture(external);
  c.name = 'new';
  Object.values(c.services).forEach(s => {s.image = 'myriad/target:new';});
  c.services.backend.environment.MYRIAD_PROCESS_ROLE='web';
  c.services.backend.environment.PERSONA_DB_PASSWORD='${PERSONA_DB_PASSWORD}';
  c.services.backend.environment.FEDERATION_DB_PASSWORD='${FEDERATION_DB_PASSWORD}';
  for (const role of ['persona','federation']) c.services[role+'-worker'] = {image:'myriad/backend:new',environment:{DATABASE_URL:'${'+role.toUpperCase()+'_DATABASE_URL}',MYRIAD_PROCESS_ROLE:role+'-worker'},volumes:[],networks:['myriad-net']};
  return {compose:JSON.stringify(c),env:oldEnv.replace('original','new').replace('MYRIAD_TAG=old','MYRIAD_TAG=new')+'PERSONA_DB_PASSWORD=PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP\nFEDERATION_DB_PASSWORD=FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF\nMYRIAD_COMPOSE_HOST_ROOT=/srv/myriad\nPERSONA_DATABASE_URL=postgres://persona:new@postgres/myriad\nFEDERATION_DATABASE_URL=postgres://federation:new@postgres/myriad\n',guardEnv:'COMPOSE_PROJECT_NAME=new\n',deploy:'Existing deployment notes'};
}
test('bundled monolith keeps data, credentials, project, PG minor and upgrades application role/images', () => {
  assert.equal(typeof engine.inspectLegacy,'function');
  const legacy=engine.inspectLegacy(JSON.stringify(fixture()),oldEnv);
  assert.equal(legacy.statePatch.dbPassword,'db+/=$token');
  assert.equal(legacy.statePatch.jwtSecret,'jwt+/=$token');
  assert.equal(legacy.statePatch.dbVersion,'18');
  assert.equal(legacy.statePatch.myriadTag,undefined);
  const result=engine.upgradeGenerated(generated(),legacy);
  const c=yaml.load(result.compose);
  assert.equal(c.name,'original');
  assert.equal(c.services.postgres.image,'postgres:18.1-alpine');
  assert.equal(c.services.backend.image,'myriad/target:new');
  assert.equal(c.services.backend.environment.MYRIAD_PROCESS_ROLE,'web');
  assert.equal(c.services.backend.environment.CUSTOM_SETTING,'literal$$secret');
  assert.deepEqual(c.services.postgres.volumes,['./pgdata:/var/lib/postgresql']);
  assert.equal(engine.inspectLegacy(result.compose,result.env).env.EXTRA_CUSTOM,'keep $literal');
  assert.equal(engine.inspectLegacy(result.compose,result.env).env.MYRIAD_TAG,'new');
  assert.match(result.guardEnv,/original/);
  assert.ok(result.report.added.length);
  assert.doesNotMatch(result.deploy,/down -v|volume rm|rm -rf/);
});
test('external split DB URLs and host gateway mapping survive independently',()=>{
  const c=fixture(true); c.services.backend.extra_hosts=['host.docker.internal:host-gateway'];
  c.services['persona-worker']={image:'old',environment:{DATABASE_URL:'postgres://persona:p%2B%2F%3D@host.docker.internal/db'},networks:['myriad-net']};
  const env=oldEnv.replace('@postgres:', '@host.docker.internal:')+'FEDERATION_DATABASE_URL=postgres://myriad_federation:f@host.docker.internal/myriad\n';
  const legacy=engine.inspectLegacy(JSON.stringify(c),env);
  assert.equal(legacy.statePatch.dbMode,'external');
  const result=engine.upgradeGenerated(generated(true),legacy); const out=yaml.load(result.compose);
  assert.equal(engine.inspectLegacy(result.compose,result.env).compose.services['persona-worker'].environment.DATABASE_URL,'postgres://persona:p%2B%2F%3D@host.docker.internal/db');
  assert.deepEqual(out.services['federation-worker'].extra_hosts,c.services.backend.extra_hosts);
});
test('dotenv handles CRLF quotes comments escaped quotes and interpolation without execution',()=>{
  const env=oldEnv+`ONE="line\\nnext" # comment\r\nTWO='it\\'s $literal'\r\nTHREE=plain # comment\r\nFOUR=\${THREE}-tail\r\nFIVE="a$$dollar"\n`;
  const legacy=engine.inspectLegacy(JSON.stringify(fixture()),env);
  assert.equal(legacy.env.ONE,'line\nnext'); assert.equal(legacy.env.TWO,"it's $literal");assert.equal(legacy.env.FOUR,'plain-tail'); assert.equal(legacy.env.FIVE,'a$dollar');
});
test('rejects malformed/duplicate YAML and dotenv without secret snippets',()=>{
  for(const compose of ['services: [secret-needle', 'services: {}\nservices: {}','services: &x {backend: *x}']) {
    assert.throws(()=>engine.inspectLegacy(compose,oldEnv),error=> !error.message.includes('secret-needle'));
  }
  for(const env of [oldEnv+'BROKEN="secret-needle',oldEnv+'JWT_SECRET=secret-needle',oldEnv+'bad line secret-needle']) assert.throws(()=>engine.inspectLegacy(JSON.stringify(fixture()),env),error=>!error.message.includes('secret-needle'));
});
test('missing required references are blocked, including nested defaults',()=>{
 const c=fixture();c.services.backend.environment.REQUIRED='${ABSENT:?secret-needle}';
 assert.throws(()=>engine.inspectLegacy(JSON.stringify(c),oldEnv),e=>e.message.includes('ABSENT')&&!e.message.includes('secret-needle'));
 c.services.backend.environment.REQUIRED='${A:-${B:-fallback}}';
 assert.equal(engine.inspectLegacy(JSON.stringify(c),oldEnv).compose.services.backend.environment.REQUIRED,'fallback');
});
test('blocks old PostgreSQL major, unsafe custom services/mounts and unknown service keys',()=>{
 const edits=[c=>c.services.postgres.image='postgres:17-alpine',c=>c.services.sidecar={image:'private'},c=>c.services.backend.volumes=['/secrets:/app/data'],c=>c.services.postgres.volumes=['dbdata:/var/lib/postgresql'],c=>c.services.backend.privileged=true,c=>c.services.backend.build='.'];
 for(const edit of edits){const c=fixture();edit(c);assert.throws(()=>engine.inspectLegacy(JSON.stringify(c),oldEnv));}
});
test('blocks external database network rename instead of silently disconnecting database',()=>{
 const c=fixture(true);c.networks.db={external:true,name:'existing-db-network'};c.services.backend.networks.push('db');
 assert.throws(()=>engine.inspectLegacy(JSON.stringify(c),oldEnv),/myriad-backend-ext/);
 c.networks.db.name='myriad-backend-ext';
 const l=engine.inspectLegacy(JSON.stringify(c),oldEnv+workerUrls); const r=yaml.load(engine.upgradeGenerated(generated(true),l).compose);
 for(const name of ['backend','persona-worker','federation-worker'])assert.ok(r.services[name].networks.includes('myriad-backend-ext'));
});
test('retains explicit volume identity and absolute standard project bind root; blocks changed identity',()=>{
 const c=fixture();c.volumes.backend_data={external:true,name:'original_backend_data'};c.services.postgres.volumes=['/srv/myriad/pgdata:/var/lib/postgresql'];c.services.updater.volumes=['/srv/myriad:/host/compose:ro'];c.services.proxy.volumes=['/srv/myriad/state:/state:ro'];
 const l=engine.inspectLegacy(JSON.stringify(c),oldEnv);const r=yaml.load(engine.upgradeGenerated(generated(),l).compose);
 assert.deepEqual(r.volumes.backend_data,c.volumes.backend_data);assert.deepEqual(r.services.postgres.volumes,c.services.postgres.volumes);
 c.volumes.backend_data.name='unrelated_data';assert.throws(()=>engine.inspectLegacy(JSON.stringify(c),oldEnv),/volumes/);
});
test('generated image references remain editable through .env for future updater runs',()=>{
 const g=generated();const c=JSON.parse(g.compose);c.services.backend.image='${BACKEND_IMAGE:-myriad/backend}:${MYRIAD_TAG}';g.compose=JSON.stringify(c);
 const out=yaml.load(engine.upgradeGenerated(g,engine.inspectLegacy(JSON.stringify(fixture()),oldEnv)).compose);
 assert.equal(out.services.backend.image,'${BACKEND_IMAGE:-myriad/backend}:${MYRIAD_TAG}');
 assert.equal(out.services.backend.environment.JWT_SECRET,'${JWT_SECRET}');
});
test('external preprovisioned URLs retain non-URL-safe independent passwords',()=>{
 const env=oldEnv+"PERSONA_DATABASE_URL='postgres://myriad_persona:p%2B%2F%3D%24word@postgres:5432/myriad'\nFEDERATION_DATABASE_URL='postgres://myriad_federation:f%2B%2F%3D%24word@postgres:5432/myriad'\n";
 const g=generated(true);const c=JSON.parse(g.compose);c.services['persona-worker'].environment.DATABASE_URL='postgres://myriad_persona:${PERSONA_DB_PASSWORD}@postgres:5432/myriad';g.compose=JSON.stringify(c);
 const output=engine.upgradeGenerated(g,engine.inspectLegacy(JSON.stringify(fixture(true)),env));
 const reimport=engine.inspectLegacy(output.compose,output.env);
 assert.equal(reimport.compose.services['persona-worker'].environment.DATABASE_URL,'postgres://myriad_persona:p%2B%2F%3D%24word@postgres:5432/myriad');
});
test('blocks missing backend storage and custom process/environment paths',()=>{
 for(const edit of [c=>c.services.backend.volumes=[],c=>c.services.backend.environment.DATA_DIR='/custom',c=>c.services['persona-worker']={image:'old',command:['/custom'],environment:{DATABASE_URL:'postgres://p:p@postgres/myriad'}}]){
 const c=fixture();edit(c);assert.throws(()=>engine.inspectLegacy(JSON.stringify(c),oldEnv));}
});
test('does not reuse web credentials as worker login',()=>{
 const c=fixture(true);c.services['persona-worker']={image:'old',environment:{DATABASE_URL:'${DATABASE_URL}'}};
 assert.throws(()=>engine.inspectLegacy(JSON.stringify(c),oldEnv),/independent/);
});
test('explicit Guard token and inline secrets take precedence over stale env and propagate safely',()=>{
 const c=fixture();c.services.updater.environment.DOCKER_GUARD_SELF_UPDATE_TOKEN='inline-token';c.services.backend.environment.JWT_SECRET='inline$$jwt';
 const l=engine.inspectLegacy(JSON.stringify(c),oldEnv);assert.equal(l.statePatch.guardSelfUpdateToken,'inline-token');
 const g=generated();g.guardEnv='COMPOSE_PROJECT_NAME=new\nDOCKER_GUARD_SELF_UPDATE_TOKEN=temporary\n';
 const r=engine.upgradeGenerated(g,l);assert.match(r.guardEnv,/inline-token/);assert.equal(engine.inspectLegacy(r.compose,r.env).env.JWT_SECRET,'inline$jwt');
});

test('real current generator output survives import-upgrade with all topology and image expressions',async()=>{
 const {generate}=await import('./generator-harness.mjs');
 for(const dbMode of ['bundled','external']) {
 const fresh=generate({dbMode,dbHost:'host.docker.internal'});
 assert.ok(fresh.compose);const legacy=engine.inspectLegacy(fresh.compose,fresh.env);
 const out=engine.upgradeGenerated({compose:fresh.compose,env:fresh.env,guardEnv:fresh.guard,deploy:fresh.notes},legacy);
 const check=engine.inspectLegacy(out.compose,out.env);
 assert.equal(check.project,legacy.project);
 assert.equal(check.statePatch.jwtSecret,legacy.statePatch.jwtSecret);
 assert.equal(check.root,'/opt/myriad');
 assert.ok(out.compose.includes('${MYRIAD_TAG}'));
 assert.equal(check.compose.services['persona-worker'].environment.MYRIAD_PROCESS_ROLE,'persona-worker');
 }
});
test('relative original root requires operator supplied original absolute directory',()=>{
 const l=engine.inspectLegacy(JSON.stringify(fixture()),oldEnv);assert.equal(l.statePatch.composeHostRoot,'');
 const g=generated();g.env=g.env.replace('/srv/myriad','/srv/original');
 const out=engine.upgradeGenerated(g,l);assert.equal(engine.parseEnv(out.env).MYRIAD_COMPOSE_HOST_ROOT,'/srv/original');
 assert.deepEqual(yaml.load(out.compose).services.postgres.volumes,['./pgdata:/var/lib/postgresql']);
 const absent=generated();absent.env=absent.env.replace('MYRIAD_COMPOSE_HOST_ROOT=/srv/myriad\n','');assert.throws(()=>engine.upgradeGenerated(absent,l),/absolute/);
});
test('implicit network identity and explicit topology env stay aligned with Guard',()=>{
 const c=fixture();delete c.networks['myriad-net'].name;
 const l=engine.inspectLegacy(JSON.stringify(c),oldEnv);assert.equal(l.statePatch.netMyriad,'original_myriad-net');
 const r=engine.upgradeGenerated(generated(),l);const env=engine.parseEnv(r.env);
 assert.equal(env.MYRIAD_DOCKER_NETWORK,'original_myriad-net');assert.equal(env.GUARD_MYRIAD_DOCKER_NETWORK,'original_myriad-net');
});
test('unsupported custom Guard executable does not disappear silently',()=>{
 const c=fixture();c.services['docker-guard']={image:'guard',command:['/custom-binary']};
 const g=generated();const next=JSON.parse(g.compose);next.services['docker-guard']={image:'guard-new',command:['/usr/local/bin/myriad-docker-guard']};g.compose=JSON.stringify(next);
 assert.throws(()=>engine.upgradeGenerated(g,engine.inspectLegacy(JSON.stringify(c),oldEnv)));
});
test('Docker Compose resolves upgraded YAML/env to exact original dollar/quote/backslash bytes',async t=>{
 const {spawnSync}=await import('node:child_process');
 if(spawnSync('docker',['compose','version']).status!==0){t.skip('Docker Compose unavailable');return;}
 const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'myriad-upgrade-test-'));
 try{
   const env=oldEnv+"ODD='slash\\\\tail \\'quote $literal'\n";
   const legacy=engine.inspectLegacy(JSON.stringify(fixture()),env);legacy.compose.services.backend.environment.ODD=legacy.env.ODD;
   const out=engine.upgradeGenerated(generated(),legacy);writeFileSync(join(dir,'compose.yml'),out.compose);writeFileSync(join(dir,'.env'),out.env);
   const check=spawnSync('docker',['compose','-f',join(dir,'compose.yml'),'--env-file',join(dir,'.env'),'config','--format','json'],{encoding:'utf8'});
   assert.equal(check.status,0,'Docker Compose config must accept output');const resolved=JSON.parse(check.stdout);
   const baseline=fixture();baseline.services.backend.environment.ODD='${ODD}';writeFileSync(join(dir,'before.yml'),JSON.stringify(baseline));writeFileSync(join(dir,'before.env'),env);
   const before=spawnSync('docker',['compose','-f',join(dir,'before.yml'),'--env-file',join(dir,'before.env'),'config','--format','json'],{encoding:'utf8'});
   assert.equal(before.status,0);const original=JSON.parse(before.stdout);
   assert.equal(resolved.services.backend.environment.JWT_SECRET,original.services.backend.environment.JWT_SECRET);
   assert.equal(resolved.services.backend.environment.ODD,original.services.backend.environment.ODD);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('new external worker URLs retain endpoint and TLS options with independently generated credentials',()=>{
 const c=fixture(true);c.services.backend.environment.PERSONA_DB_PASSWORD='P'.repeat(40);c.services.backend.environment.FEDERATION_DB_PASSWORD='F'.repeat(40);const env=oldEnv.replace('@postgres:5432/myriad', '@db.example:6543/myriad?sslmode=verify-full&sslrootcert=%2Fcert.pem');
 const legacy=engine.inspectLegacy(JSON.stringify(c),env);const r=engine.upgradeGenerated(generated(true),legacy);const url=new URL(engine.parseEnv(r.env).PERSONA_DATABASE_URL);
 assert.equal(url.hostname,'db.example');assert.equal(url.port,'6543');assert.equal(url.searchParams.get('sslrootcert'),'/cert.pem');assert.equal(url.username,'myriad_persona');assert.equal(url.password,'P'.repeat(40));
});
test('conflicting existing worker bootstrap password is blocked before generating a reset',()=>{
 const c=fixture();c.services.backend.environment.PERSONA_DB_PASSWORD='mismatched';c.services['persona-worker']={image:'old',environment:{DATABASE_URL:'postgres://myriad_persona:real@postgres/myriad'}};
 assert.throws(()=>engine.inspectLegacy(JSON.stringify(c),oldEnv),/password/);
});
test('backend volume subpath and options cannot silently become full-volume mounts',()=>{
 for(const options of [{subpath:'custom'},{nocopy:true}]){
 const c=fixture();c.services.backend.volumes[0]={type:'volume',source:'backend_data',target:'/app/data',volume:options};
 assert.throws(()=>engine.inspectLegacy(JSON.stringify(c),oldEnv),/volumes/);
 }
});
test('incompatible worker healthcheck and resource overrides never replace fixed current boundaries',async()=>{
 const {generate}=await import('./generator-harness.mjs');const g=generate();
 for(const edit of [c=>c.services['persona-worker'].healthcheck.test=['CMD','/custom'],c=>c.services['federation-worker'].deploy.resources.limits.memory='2G']){
 const c=yaml.load(g.compose);edit(c);const legacy=engine.inspectLegacy(yaml.dump(c),g.env);
 assert.throws(()=>engine.upgradeGenerated({compose:g.compose,env:g.env,guardEnv:g.guard,deploy:g.notes},legacy),/services\.(persona|federation)-worker\.(healthcheck|deploy)/);
 }
});
test('unsupported worker environment keys require manual review rather than Guard rejection later',()=>{
 const c=fixture();c.services['persona-worker']={image:'old',environment:{DATABASE_URL:'postgres://myriad_persona:real@postgres/myriad',LD_PRELOAD:'/custom'}};
 assert.throws(()=>engine.inspectLegacy(JSON.stringify(c),oldEnv),/environment/);
});
test('external preprovisioned worker URLs never enable backend role management',()=>{
 const c=fixture(true);c.services['persona-worker']={image:'old',environment:{DATABASE_URL:'postgres://myriad_persona:p%2B%2F%3D@postgres/myriad'}};
 const out=engine.upgradeGenerated(generated(true),engine.inspectLegacy(JSON.stringify(c),oldEnv+'FEDERATION_DATABASE_URL=postgres://myriad_federation:f@postgres/myriad\n'));const checked=engine.inspectLegacy(out.compose,out.env);
 assert.equal(checked.compose.services.backend.environment.PERSONA_DB_PASSWORD,undefined);
 assert.equal(checked.compose.services.backend.environment.FEDERATION_DB_PASSWORD,undefined);
 assert.equal(checked.compose.services['persona-worker'].environment.DATABASE_URL,c.services['persona-worker'].environment.DATABASE_URL);
});
test('standalone worker URL env cannot disagree with backend role management password',()=>{
 const c=fixture(true);c.services.backend.environment.PERSONA_DB_PASSWORD='declared';
 assert.throws(()=>engine.inspectLegacy(JSON.stringify(c),oldEnv+'PERSONA_DATABASE_URL=postgres://myriad_persona:different@postgres/myriad\n'),/password/);
});
test('external monolith without role management must provide both preprovisioned worker URLs',()=>{
 const l=engine.inspectLegacy(JSON.stringify(fixture(true)),oldEnv);
 assert.throws(()=>engine.upgradeGenerated(generated(true),l),/preprovision|PERSONA_DATABASE_URL/);
});
test('federation subpath mount cannot be inferred from container target alone',()=>{
 const c=fixture();c.services['federation-worker']={image:'old',environment:{DATABASE_URL:'postgres://myriad_federation:p@postgres/myriad'},volumes:['backend_data:/app/data/federation']};
 assert.throws(()=>engine.inspectLegacy(JSON.stringify(c),oldEnv),/volumes/);
});
test('downloadable deployment notes include preserved/added/warnings report without secrets',()=>{
 const l=engine.inspectLegacy(JSON.stringify(fixture()),oldEnv);const out=engine.upgradeGenerated(generated(),l);
 for(const kind of ['preserved','added','warnings'])for(const item of out.report[kind])assert.ok(out.deploy.includes(item));
 assert.ok(!out.deploy.includes(l.statePatch.jwtSecret));
});
test('backend-managed worker passwords must satisfy backend provisioning policy',()=>{
 const c=fixture();c.services.backend.environment.PERSONA_DB_PASSWORD='unsafe+/=$';
 const legacy=engine.inspectLegacy(JSON.stringify(c),oldEnv);
 assert.throws(()=>engine.upgradeGenerated(generated(),legacy),/PERSONA_DB_PASSWORD.*32/);
});
test('bootstrap mode requires a complete independent password pair',()=>{
 const c=fixture(true);c.services.backend.environment.PERSONA_DB_PASSWORD='P'.repeat(40);
 const env=oldEnv+'PERSONA_DATABASE_URL=postgres://myriad_persona:'+'P'.repeat(40)+'@postgres/myriad\nFEDERATION_DATABASE_URL=postgres://myriad_federation:'+'F'.repeat(40)+'@postgres/myriad\n';
 assert.throws(()=>engine.upgradeGenerated(generated(true),engine.inspectLegacy(JSON.stringify(c),env)),/both|pair/);
 const bundled=fixture();bundled.services.backend.environment.PERSONA_DB_PASSWORD='P'.repeat(40);bundled.services.backend.environment.FEDERATION_DB_PASSWORD='P'.repeat(40);
 assert.throws(()=>engine.upgradeGenerated(generated(),engine.inspectLegacy(JSON.stringify(bundled),oldEnv)),/independent|distinct/);
});

test('stale distinct updater pins cannot override fresh or upgraded deployment targets', () => {
  const fresh = generate({ updaterTag: 'v1.2.4', proxyTag: 'v1.1.0' });
  const staleEnv = fresh.env.replace(/^UPDATER_TAG=.*$/m, 'UPDATER_TAG=v1.2.5')
    .replace(/^DOCKER_GUARD_IMAGE=.*$/m, 'DOCKER_GUARD_IMAGE=docker.io/somekawahitomi/myriad-updater@sha256:' + 'b'.repeat(64))
    .replace(/^UPDATER_IMAGE_REF=.*$/m, 'UPDATER_IMAGE_REF=docker.io/somekawahitomi/myriad-updater@sha256:' + 'c'.repeat(64))
    + '\nUPDATER_GATEWAY_IMAGE_REF=docker.io/somekawahitomi/myriad-updater@sha256:' + 'd'.repeat(64) + '\n';
  const legacy = engine.inspectLegacy(fresh.compose, staleEnv);
  function assertShared(resolved, tag) {
    const expected = 'docker.io/somekawahitomi/myriad-updater:' + tag;
    for (const name of ['docker-guard', 'updater', 'updater-gateway']) assert.equal(resolved.compose.services[name].image, expected);
    assert.equal(resolved.compose.services['docker-guard'].environment.DOCKER_GUARD_EXPECTED_IMAGE, expected);
  }
  assertShared(legacy, 'v1.2.5');
  // Simulate the old generator's separate digest references before migration.
  const old = yaml.load(fresh.compose);
  old.services['docker-guard'].image = '${DOCKER_GUARD_IMAGE}';
  old.services['docker-guard'].environment.DOCKER_GUARD_EXPECTED_IMAGE = '${DOCKER_GUARD_IMAGE}';
  for (const name of ['updater', 'updater-gateway']) old.services[name].image = '${UPDATER_IMAGE_REF}';
  const migrated = engine.upgradeGenerated({compose:fresh.compose,env:fresh.env,guardEnv:fresh.guard,deploy:fresh.notes}, engine.inspectLegacy(yaml.dump(old), staleEnv));
  assertShared(engine.inspectLegacy(migrated.compose, migrated.env), 'v1.2.4');
  assertShared(engine.inspectLegacy(migrated.compose, migrated.env.replace(/^UPDATER_TAG=.*$/m, 'UPDATER_TAG=v1.2.6')), 'v1.2.6');
  assert.equal(engine.parseEnv(migrated.env).UPDATER_GATEWAY_IMAGE_REF, undefined);
});
