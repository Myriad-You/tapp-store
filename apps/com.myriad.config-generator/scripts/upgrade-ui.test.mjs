/** Real page DOM + production listeners; only host APIs and network responses are simulated.
 * Install jsdom outside the repository and set JSDOM_MODULE_PATH to its package directory.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { generate } from './generator-harness.mjs';
const require = createRequire(new URL('../main.js', import.meta.url));
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_MODULE_PATH || 'jsdom');
const engine = require('./upgrade.js');
const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../page.html', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function openPage(t, api) {
  const errors = [], notifications = [];
  const vc = new VirtualConsole();vc.on('jsdomError', e => {if (!/Not implemented:.*(?:scroll|navigation)/.test(e.message)) errors.push(e);});
  const dom = new JSDOM(html, {runScripts:'outside-only',url:'https://generator.test/',pretendToBeVisual:true,virtualConsole:vc});
  t.after(()=>dom.window.close());
  const w=dom.window;w.require=require;w._TAPP_MODE='page';w.scrollTo=()=>{};
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  let ready;
  w.Tapp={lifecycle:{onReady(cb){ready=cb;},onUnload(){}},ui:{showNotification:async note=>notifications.push(note)},api:async name=>name==='dockerHubTag'?{digest:'sha256:'+'b'.repeat(64)}:{results:[{name:'v1.2.4'}]}};
  if (api) w.Tapp.api = api;
  w.eval(main);assert.equal(typeof ready,'function');ready();await tick();
  const el=id=>w.document.getElementById(id);
  const enter=(id,value)=>{el(id).value=value;el(id).dispatchEvent(new w.Event('input',{bubbles:true}));};
  function inspect(old){el('btn-start-upgrade').click();enter('upgrade-compose',old.compose);enter('upgrade-env',old.env);el('btn-inspect-upgrade').click();}
  async function output(){el('btn-generate-all').click();await tick();return {compose:el('result-docker-compose').textContent,env:el('result-env').textContent};}
  return {w,el,enter,inspect,output,errors,notifications};
}
function legacy(overrides={}){return generate({composeHostRoot:'/srv/existing',...overrides});}
test('real page imports, locks original identities, then generates upgraded output',async t=>{
 const page=await openPage(t);const old=legacy();page.inspect(old);
 assert.ok(page.w.upgradeSession.legacy,page.el('upgrade-status').textContent);
 assert.equal(page.el('db-password').readOnly,true);assert.equal(page.el('compose-host-root').value,'/srv/existing');assert.equal(page.el('compose-host-root').readOnly,true);
 assert.equal(page.el('btn-continue-upgrade').hidden,false);page.el('btn-continue-upgrade').click();assert.equal(page.w.wizardStep,'panel');
 const output=await page.output();assert.ok(output.compose,page.notifications.map(n=>n.message).join('\n'));
 const checked=engine.inspectLegacy(output.compose,output.env);assert.equal(checked.statePatch.jwtSecret,old.state.jwtSecret);assert.equal(checked.root,'/srv/existing');assert.equal(checked.env.MYRIAD_TAG,'v1.2.4');
 assert.equal(page.el('setup-secret-reminder').hidden,true);assert.equal(page.errors.length,0,page.errors.map(e=>e.message).join('\n'));
});
test('editing imported source invalidates inspection and failed reimport cannot continue',async t=>{
 const page=await openPage(t);page.inspect(legacy());page.enter('upgrade-env','INVALID');
 assert.equal(page.w.upgradeSession.legacy,null);assert.equal(page.el('btn-continue-upgrade').hidden,true);assert.equal(page.el('db-password').readOnly,false);
 page.el('btn-inspect-upgrade').click();assert.equal(page.w.upgradeSession.legacy,null);assert.equal(page.el('btn-continue-upgrade').hidden,true);assert.ok(page.el('upgrade-status').textContent);
});
test('switching to fresh installation clears imported credentials even after invalidation',async t=>{
 for(const invalidate of [false,true]){
 const page=await openPage(t);const old=legacy();page.inspect(old);if(invalidate)page.enter('upgrade-env','INVALID');
 page.w.goWizard('welcome','back');page.el('btn-start-new').click();
 assert.equal(page.w.upgradeSession.legacy,null);assert.equal(page.el('upgrade-env').value,'');
 for(const [key,id] of [['jwtSecret','jwt-secret'],['dbPassword','db-password'],['updateToken','update-token'],['setupSecret','setup-secret']]){
 assert.notEqual(page.el(id).value,old.state[key],id+' must not retain imported secret');assert.notEqual(page.w.state[key],old.state[key],key+' state must not retain imported secret');}
 assert.equal(page.el('compose-host-root').readOnly,false);
 }
});
test('unknown original root remains empty until operator supplies original absolute path',async t=>{
 const page=await openPage(t);const old=legacy();old.env=old.env.replace(/MYRIAD_COMPOSE_HOST_ROOT=.*\n/,'MYRIAD_COMPOSE_HOST_ROOT=.\n');page.inspect(old);
 assert.ok(page.w.upgradeSession.legacy,page.el('upgrade-status').textContent);assert.equal(page.el('compose-host-root').value,'');assert.equal(page.el('compose-host-root').readOnly,false);
 const blocked=await page.output();assert.equal(blocked.compose,'');assert.ok(page.notifications.some(n=>/absolute|绝对|目录/.test(n.message)));
 page.enter('compose-host-root','/srv/existing');const output=await page.output();assert.ok(output.compose,page.notifications.map(n=>n.message).join('\n'));assert.equal(engine.parseEnv(output.env).MYRIAD_COMPOSE_HOST_ROOT,'/srv/existing');
});
test('edited import cannot silently generate a fresh deployment while digest resolution is pending',async t=>{
 const page=await openPage(t);const old=legacy();page.inspect(old);let resolveDigest;
 page.w.Tapp.api=async name=>name==='dockerHubTag'?new Promise(resolve=>{resolveDigest=resolve;}):{results:[{name:'v1.2.4'}]};
 page.el('btn-generate-all').click();await tick();assert.equal(typeof resolveDigest,'function');
 page.enter('upgrade-env',old.env+'# edited\n');resolveDigest({digest:'sha256:'+'b'.repeat(64)});await tick();
 assert.equal(page.el('result-docker-compose').textContent,'');assert.equal(page.el('btn-generate-all').disabled,true);
 page.el('btn-generate-all').click();await tick();assert.equal(page.el('result-env').textContent,'');
});
test('editing import while empty image tags resolve cancels the pending generation',async t=>{
 const page=await openPage(t);const old=legacy();page.inspect(old);const pending=[];
 for(const id of ['myriad-tag','proxy-tag','updater-tag'])page.enter(id,'');
 page.w.Tapp.api=async name=>name==='dockerHubTags'?new Promise(resolve=>pending.push(resolve)):{digest:'sha256:'+'b'.repeat(64)};
 page.el('btn-generate-all').click();await tick();assert.equal(pending.length,4);
 page.enter('upgrade-compose',old.compose+'\n# edited\n');pending.forEach(resolve=>resolve({results:[{name:'v1.2.4'}]}));await tick();
 assert.equal(page.el('result-docker-compose').textContent,'');assert.equal(page.el('btn-generate-all').disabled,true);
});
test('switching to new install cancels old pending generation and removes generated old secrets',async t=>{
 const page=await openPage(t);const old=legacy();page.inspect(old);const first=await page.output();assert.ok(first.compose);
 let resolveDigest;page.w.Tapp.api=async()=>new Promise(resolve=>{resolveDigest=resolve;});
 page.el('btn-generate-all').click();await tick();assert.equal(typeof resolveDigest,'function');
 page.w.goWizard('welcome','back');page.el('btn-start-new').click();resolveDigest({digest:'sha256:'+'b'.repeat(64)});await tick();
 assert.equal(page.el('result-env').textContent,'');assert.equal(page.el('upgrade-env').value,'');assert.equal(page.w.state.jwtSecret,'');assert.equal(page.el('btn-generate-all').disabled,false);
});
test('invalidating a previously generated import removes stale downloadable results and reports',async t=>{
 const page=await openPage(t);const old=legacy();page.inspect(old);assert.ok((await page.output()).env);
 page.enter('upgrade-env',old.env+'# changed\n');
 for(const id of ['result-env','result-docker-compose','result-guard-env','result-deploy-notes','upgrade-result-report'])assert.equal(page.el(id).textContent,'',id+' must not expose stale output');
});
test('real click generation preserves quoted legacy JWT and database credentials byte for byte',async t=>{
 const page=await openPage(t);const old=legacy();const password='database+/=$literal';const jwt='  jwt+/=$literal  ';
 old.env=old.env.replace('POSTGRES_PASSWORD='+old.state.dbPassword,"POSTGRES_PASSWORD='"+password+"'").replace('JWT_SECRET='+old.state.jwtSecret,"JWT_SECRET='"+jwt+"'").replace(encodeURIComponent(old.state.dbPassword)+'@postgres',encodeURIComponent(password)+'@postgres');
 page.inspect(old);assert.ok(page.w.upgradeSession.legacy,page.el('upgrade-status').textContent);
 const output=await page.output();assert.ok(output.compose,page.notifications.map(n=>n.message).join('\n'));
 const resolved=engine.inspectLegacy(output.compose,output.env);assert.equal(resolved.statePatch.jwtSecret,jwt);assert.equal(resolved.statePatch.dbPassword,password);
});

test('page blocks directory generation with an incompatible selected updater release',async t=>{
  const page=await openPage(t);page.inspect(legacy());page.enter('updater-tag','v0.5.7');
  const result=await page.output();assert.equal(result.compose,'');
  assert.ok(page.notifications.some(n=>/v0.5.8/.test(n.message)),page.notifications.map(n=>n.message).join('\n'));
  page.enter('updater-tag','v0.5.8');assert.ok((await page.output()).compose);
});

// Exercise the actual refresh and generate listeners, including digest gating.
const releaseDigest = 'a'.repeat(64);
const hubDigest = 'c'.repeat(64);
function versionApi({ githubFails = false, hubFails = false, updater = 'v0.7.0', digestResult = { digest: 'sha256:' + hubDigest }, missingUpdater = false } = {}) {
  const digestRequests = [];
  const images = (versions) => Object.entries(versions).map(([component, tag]) =>
    `- ${component}: \`docker.io/somekawahitomi/myriad-${component}:${tag}\` (\`sha256:${releaseDigest}\`)`).join('\n');
  const releases = [{ tag_name: 'v0.8.0', body: images({ backend: 'v0.8.0', frontend: 'v0.8.0', proxy: 'v0.8.0' }) }];
  if (!missingUpdater) releases.push({ tag_name: 'v0.7.0', body: images({ updater: 'v0.7.0' }) });
  const api = async (name, params) => {
    if (name === 'githubReleases') {
      if (githubFails) throw new Error('GitHub unavailable');
      return releases;
    }
    if (name === 'dockerHubTags') {
      if (hubFails) throw new Error('Hub unavailable');
      if (params.repo === 'myriad-updater' && missingUpdater) return { results: [] };
      return { results: [{ name: params.repo === 'myriad-updater' ? updater : 'v0.8.0' }] };
    }
    assert.equal(name, 'dockerHubTag');
    digestRequests.push(params.tag);
    if (digestResult instanceof Error) throw digestResult;
    return digestResult;
  };
  return { api, digestRequests };
}
for (const [label, options, expectedRequests, expectedDigest] of [
  ['release omits updater', {}, [], releaseDigest],
  ['GitHub unavailable', { githubFails: true }, ['v0.7.0'], hubDigest],
  ['Hub unavailable', { hubFails: true }, [], releaseDigest],
  ['Hub updater is newer than release digest', { updater: 'v0.7.1' }, ['v0.7.1'], hubDigest]
]) test('page generates independent stable versions: ' + label, async t => {
  const mock = versionApi(options);
  const page = await openPage(t, mock.api);page.inspect(legacy());
  const output = await page.output();
  assert.ok(output.compose, page.notifications.map(n => n.message).join('\n'));
  const env = engine.parseEnv(output.env);
  assert.equal(env.MYRIAD_TAG, 'v0.8.0');assert.equal(env.PROXY_TAG, 'v0.8.0');
  assert.equal(env.UPDATER_TAG, options.updater || 'v0.7.0');
  assert.equal(page.w.state.updaterDigest, expectedDigest);
  assert.deepEqual(mock.digestRequests, expectedRequests);
  assert.equal(page.errors.length, 0);
});
for (const [label, response] of [['missing', {}], ['malformed', { digest: 'sha256:invalid' }], ['failed', new Error('HTTP 404 - tag not found')]]) {
  test('page blocks generation when updater digest is ' + label, async t => {
    const mock = versionApi({ githubFails: true, digestResult: response });
    const page = await openPage(t, mock.api);page.inspect(legacy());
    const output = await page.output();
    assert.equal(output.compose, '');assert.equal(output.env, '');
    assert.deepEqual(mock.digestRequests, ['v0.7.0']);
    assert.ok(page.notifications.some(n => /digest|404/i.test(n.message)), JSON.stringify(page.notifications));
  });
}
test('manual updater version cannot reuse the cached release digest for another tag', async t => {
  const mock = versionApi();const page = await openPage(t, mock.api);page.inspect(legacy());
  page.enter('updater-tag', 'v0.7.2');
  const output = await page.output();assert.ok(output.compose);
  assert.deepEqual(mock.digestRequests, ['v0.7.2']);
  assert.equal(page.w.state.updaterDigest, hubDigest);
});
test('page blocks unresolved updater instead of querying the main release version', async t => {
  const mock = versionApi({ missingUpdater: true });const page = await openPage(t, mock.api);page.inspect(legacy());
  const output = await page.output();assert.equal(output.compose, '');
  assert.equal(page.el('updater-tag').value, '');assert.deepEqual(mock.digestRequests, []);
  assert.match(page.el('tag-status').textContent, /未找到稳定版本/);
});
test('fresh-install generate button accepts independently selected stable versions', async t => {
  const mock = versionApi();const page = await openPage(t, mock.api);
  page.el('btn-start-new').click();
  page.enter('main-domain', 'example.com');page.enter('extra-domain', 'social.example.com');
  page.enter('compose-host-root', '/srv/myriad');
  const output = await page.output();
  assert.ok(output.compose, page.notifications.map(n => n.message).join('\n'));
  const env = engine.parseEnv(output.env);
  assert.equal(env.MYRIAD_TAG, 'v0.8.0');assert.equal(env.PROXY_TAG, 'v0.8.0');assert.equal(env.UPDATER_TAG, 'v0.7.0');
  assert.equal(page.w.state.updaterDigest, releaseDigest);
  assert.deepEqual(mock.digestRequests, []);
  assert.equal(page.errors.length, 0);
});
test('refreshing versions during digest lookup cancels generation instead of mixing tags and digest', async t => {
  const mock = versionApi({ githubFails: true });
  const page = await openPage(t, mock.api);page.inspect(legacy());
  let resolveDigest;
  page.w.Tapp.api = async (name, params) => name === 'dockerHubTag'
    ? new Promise(resolve => { resolveDigest = resolve; }) : mock.api(name, params);
  page.el('btn-generate-all').click();await tick();
  assert.equal(typeof resolveDigest, 'function');
  const newer = versionApi({ githubFails: true, updater: 'v0.7.1' });
  page.w.Tapp.api = newer.api;
  page.el('btn-refresh-tags').click();await tick();
  assert.equal(page.el('updater-tag').value, 'v0.7.1');
  resolveDigest({ digest: 'sha256:' + 'd'.repeat(64) });await tick();
  assert.equal(page.el('result-env').textContent, '');
  assert.equal(page.el('updater-tag').value, 'v0.7.1');
  assert.ok(page.notifications.some(n => /生成已取消/.test(n.message)));
  const output = await page.output();assert.ok(output.env);
  assert.equal(engine.parseEnv(output.env).UPDATER_TAG, 'v0.7.1');
  assert.equal(page.w.state.updaterDigest, hubDigest);
  assert.deepEqual(newer.digestRequests, ['v0.7.1']);
});
for (const field of ['myriad-tag', 'proxy-tag', 'updater-tag']) {
  test('manual edit during digest lookup cancels pending generation: ' + field, async t => {
    const mock = versionApi({ githubFails: true });const page = await openPage(t, mock.api);page.inspect(legacy());
    let resolveDigest;
    page.w.Tapp.api = async (name, params) => name === 'dockerHubTag'
      ? new Promise(resolve => { resolveDigest = resolve; }) : mock.api(name, params);
    page.el('btn-generate-all').click();await tick();assert.equal(typeof resolveDigest, 'function');
    page.enter(field, 'v0.9.0');resolveDigest({ digest: 'sha256:' + 'd'.repeat(64) });await tick();
    assert.equal(page.el('result-env').textContent, '');assert.equal(page.el(field).value, 'v0.9.0');
    assert.ok(page.notifications.some(n => /生成已取消/.test(n.message)));
    assert.equal(page.el('btn-generate-all').disabled, false);
  });
}
